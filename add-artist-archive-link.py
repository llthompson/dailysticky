import pathlib

ROOT = pathlib.Path(__file__).parent
ANCHOR = '<a class="menu-item" href="/blog/">Sticky Notes</a>'
LINK_HREF = "/artists.html"
LINK_TEXT = "Meet the Artists"

updated = []
skipped_no_anchor = []
skipped_already_has_link = []

for path in ROOT.rglob("*.html"):
    if "node_modules" in path.parts:
        continue

    text = path.read_text(encoding="utf-8")

    if LINK_HREF in text:
        skipped_already_has_link.append(path)
        continue

    lines = text.splitlines(keepends=True)
    anchor_index = None

    for i, line in enumerate(lines):
        if ANCHOR in line:
            anchor_index = i
            break

    if anchor_index is None:
        skipped_no_anchor.append(path)
        continue

    anchor_line = lines[anchor_index]
    indent = anchor_line[: len(anchor_line) - len(anchor_line.lstrip())]
    newline = "\n" if anchor_line.endswith("\n") else ""

    new_line = f'{indent}<a class="menu-item" href="{LINK_HREF}">{LINK_TEXT}</a>{newline}'
    lines.insert(anchor_index + 1, new_line)

    path.write_text("".join(lines), encoding="utf-8")
    updated.append(path)

print(f"Updated ({len(updated)}):")
for p in updated:
    print(f"  {p}")

print(f"\nSkipped — already had the link ({len(skipped_already_has_link)}):")
for p in skipped_already_has_link:
    print(f"  {p}")

print(f"\nSkipped — no anchor line found, needs manual edit ({len(skipped_no_anchor)}):")
for p in skipped_no_anchor:
    print(f"  {p}")