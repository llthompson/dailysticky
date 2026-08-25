#!/usr/bin/env python3
"""
Remove one or more tags from stickers.db, everywhere or within one category.

Matches the schema used by sticker-admin-v3.html:
  stickers(id, file, name, primary_category, secondary_category, ...)
  tags(id, name)                       -- names stored lowercase/trimmed
  sticker_tags(sticker_id, tag_id)     -- join table

This script only ever deletes rows from sticker_tags (the association
between a sticker and a tag). It never deletes rows from the tags table
itself, so a tag name stays available for other stickers / future use
even after you strip it from everywhere.

SAFETY:
  - Dry run by default. Nothing is touched unless you pass --apply.
  - Always prints an exact preview of every sticker/tag pair that would
    be removed, before anything happens.
  - With --apply, still requires a typed "yes" confirmation.
  - Makes a timestamped copy of the .db file before writing.
  - All deletes run inside a single explicit transaction (BEGIN/COMMIT,
    with ROLLBACK on any error), so a failure partway through leaves the
    database unchanged.

USAGE

  # Preview: remove "cute" and "adorable" from every sticker
  python3 remove-tags.py --tags cute adorable

  # Preview: remove them only from the Animals & Nature category
  python3 remove-tags.py --tags cute adorable --category "Animals & Nature"

  # Same, but comma-separated also works
  python3 remove-tags.py --tags cute,adorable --category "Animals & Nature"

  # After checking the preview looks right, actually apply it
  python3 remove-tags.py --tags cute adorable --apply

  # Point at a different .db file (default: ./stickers.db)
  python3 remove-tags.py --tags cute --db path/to/stickers.db --apply

Category matching: a sticker counts as "in" a category if it matches
either primary_category or secondary_category, same as the category
filter in sticker-admin-v3.html.
"""

import argparse
import datetime
import shutil
import sqlite3
import sys
from pathlib import Path


def parse_args():
    parser = argparse.ArgumentParser(
        description="Remove specific tags from stickers.db (dry run by default).",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        "--tags",
        nargs="+",
        required=True,
        help="Tag name(s) to remove. Space- or comma-separated, e.g. "
             "--tags cute adorable  OR  --tags cute,adorable",
    )
    parser.add_argument(
        "--category",
        default=None,
        help="Optional. Only remove the tag(s) from stickers whose "
             "primary_category or secondary_category matches this exactly "
             "(e.g. \"Animals & Nature\"). Omit to remove everywhere.",
    )
    parser.add_argument(
        "--db",
        default="stickers.db",
        help="Path to the SQLite database (default: stickers.db)",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Actually make the change. Without this flag, the script only previews.",
    )
    return parser.parse_args()


def normalize_tags(raw_tags):
    """Split on commas too, lowercase + trim, drop empties/dupes, keep order."""
    names = []
    for item in raw_tags:
        names.extend(item.split(","))
    seen = set()
    cleaned = []
    for name in names:
        name = name.strip().lower()
        if name and name not in seen:
            seen.add(name)
            cleaned.append(name)
    return cleaned


def find_affected_rows(conn, tag_names, category):
    """Return (matches, missing_tags).

    matches: list of dicts with sticker_id, sticker_name, primary_category,
             secondary_category, tag_id, tag_name — one row per
             sticker/tag pair that would be removed.
    missing_tags: tag names in tag_names that don't exist in the tags table.
    """
    placeholders = ",".join("?" for _ in tag_names)

    existing = conn.execute(
        f"SELECT name FROM tags WHERE name IN ({placeholders})", tag_names
    ).fetchall()
    existing_names = {row[0] for row in existing}
    missing_tags = [t for t in tag_names if t not in existing_names]

    sql = f"""
        SELECT s.id, s.name, s.primary_category, s.secondary_category,
               t.id, t.name
        FROM sticker_tags st
        JOIN stickers s ON s.id = st.sticker_id
        JOIN tags t ON t.id = st.tag_id
        WHERE t.name IN ({placeholders})
    """
    params = list(tag_names)

    if category:
        sql += " AND (s.primary_category = ? OR s.secondary_category = ?)"
        params.extend([category, category])

    sql += " ORDER BY s.id, t.name"

    rows = conn.execute(sql, params).fetchall()

    matches = [
        {
            "sticker_id": r[0],
            "sticker_name": r[1],
            "primary_category": r[2],
            "secondary_category": r[3],
            "tag_id": r[4],
            "tag_name": r[5],
        }
        for r in rows
    ]
    return matches, missing_tags


def print_preview(matches, missing_tags, tag_names, category):
    scope = f'category "{category}"' if category else "the whole database"
    print(f"Tags to remove: {', '.join(tag_names)}")
    print(f"Scope: {scope}")
    print()

    if missing_tags:
        print(f"Note: not found in tags table (nothing to remove for these): "
              f"{', '.join(missing_tags)}")
        print()

    if not matches:
        print("No matching sticker/tag associations found. Nothing to do.")
        return

    by_sticker = {}
    for m in matches:
        by_sticker.setdefault(m["sticker_id"], []).append(m)

    for sticker_id, rows in by_sticker.items():
        first = rows[0]
        cats = first["primary_category"] or "uncategorized"
        if first["secondary_category"]:
            cats += f" / {first['secondary_category']}"
        label = first["sticker_name"] or sticker_id
        print(f"  {sticker_id} ({label}) [{cats}]")
        for r in rows:
            print(f"    - {r['tag_name']}")

    print()
    print(f"Total: {len(matches)} tag removal(s) across {len(by_sticker)} sticker(s).")


def backup_db(db_path):
    timestamp = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    backup_path = db_path.with_name(f"{db_path.stem}-backup-{timestamp}{db_path.suffix}")
    shutil.copy2(db_path, backup_path)
    return backup_path


def apply_removal(conn, matches):
    pairs = [(m["sticker_id"], m["tag_id"]) for m in matches]
    conn.isolation_level = None  # manual transaction control
    try:
        conn.execute("BEGIN")
        conn.executemany(
            "DELETE FROM sticker_tags WHERE sticker_id = ? AND tag_id = ?", pairs
        )
        conn.execute("COMMIT")
    except Exception:
        conn.execute("ROLLBACK")
        raise


def main():
    args = parse_args()
    tag_names = normalize_tags(args.tags)

    if not tag_names:
        sys.exit("No valid tag names given.")

    db_path = Path(args.db)
    if not db_path.exists():
        sys.exit(f"Database not found: {db_path}")

    conn = sqlite3.connect(db_path)
    try:
        matches, missing_tags = find_affected_rows(conn, tag_names, args.category)
        print_preview(matches, missing_tags, tag_names, args.category)

        if not matches:
            return

        if not args.apply:
            print()
            print("DRY RUN — no changes made. Re-run with --apply to make this change.")
            return

        print()
        answer = input(
            f"Type 'yes' to permanently remove these {len(matches)} tag "
            f"association(s) from {db_path}: "
        ).strip().lower()
        if answer != "yes":
            print("Aborted. No changes made.")
            return

        backup_path = backup_db(db_path)
        print(f"Backup written to {backup_path}")

        apply_removal(conn, matches)
        print(f"Done. Removed {len(matches)} tag association(s).")
    finally:
        conn.close()


if __name__ == "__main__":
    main()