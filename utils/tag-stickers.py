#!/usr/bin/env python3
"""
Batch-tag sticker images with the Claude API.

Implements the workflow from the tagging spec:
  - loops over STICKERS_DIR/*.webp, skipping ids in disabled-stickers.json
  - sends each image + its OLD category (as a hint) + the tagging prompt
  - expects strict JSON back; validates required fields
  - retries once on parse/validation failure, then flags for manual entry
  - writes stickers-tagged.json (all results), failed-stickers.json
    (unparseable after retry), and needs-review.json (needsReview: true)

Setup:
  pip install anthropic
  export ANTHROPIC_API_KEY=sk-ant-...

Old categories: by default, read from old-categories.json, a mapping of
  {"sticker-id": "Old Category Name", ...}
If the file is absent, the old-category hint is sent as "Unknown".
"""

import base64
import json
import os
import sys
import time
from pathlib import Path

import anthropic

# --- Config ---
STICKERS_DIR   = Path("stickers")
DISABLED_FILE  = Path("disabled-stickers.json")     # list of ids to skip
OLD_CATS_FILE  = Path("old-categories.json")        # {id: old category}
OUTPUT_FILE    = Path("stickers-tagged.json")
FAILED_FILE    = Path("failed-stickers.json")
REVIEW_FILE    = Path("needs-review.json")
MODEL          = "claude-haiku-4-5"   # cheap + fast; bump to claude-sonnet-4-6 if quality lags
MAX_RETRIES    = 1                    # retries after the first attempt
SLEEP_BETWEEN  = 0.3                  # seconds between calls, gentle pacing
# --------------

REQUIRED_FIELDS = ["id", "name", "tags", "primaryCategory",
                   "secondaryCategory", "needsReview"]

VALID_CATEGORIES = {
    # Internal World emotion families
    "Joy & Fun", "Calm & Peace", "Love & Connection", "Sad & Down",
    "Stressed & Anxious", "Angry & Frustrated", "Tired & Drained",
    "Confused & Mixed",
    # External World
    "People & Body", "Animals & Nature", "Food & Drink",
    "Travel & Places", "Activities", "Objects",
}

SYSTEM_PROMPT = """You are labeling a sticker from a digital journaling app. \
Look at the image and return ONLY valid JSON, no other text, no markdown \
fences, matching this exact schema:

{
  "id": "<sticker id, provided to you>",
  "name": "short descriptive name, 2-5 words, plain language",
  "tags": ["3 to 5 lowercase single or short-phrase tags"],
  "primaryCategory": "<one category from the list below>",
  "secondaryCategory": "<one category from the list below, or null if it doesn't clearly fit a second one>",
  "needsReview": false
}

You will also be given the sticker's OLD category as context. Treat this as \
a hint only, not a rule — the image itself should always drive your actual \
category choice. Old categories often contain stickers that belong to a \
different new category than the hint suggests (e.g. a stressed face filed \
under "Working" should be categorized by the expression, not the old label).

Old category -> new category hints:
- Adulting, Appointments, Books, Cleaning, Health, Money, School, Shopping, \
Working, Writing, Holiday -> Objects
- Exercise -> Activities
- Fun -> Objects or Activities
- Food All, Food Beverages, Food Desserts, Food Fruits Veggies -> Food & Drink
- Nature, Seasons, Pets -> Animals & Nature
- Places, Travel -> Travel & Places
- Animal Vibes, Emoticon A, Emoticon B, Emoticon C, Emoticon Xtra, \
People Women, Words, Love, Mental Health (relax), Pride -> Internal World \
(pick the specific emotion family below)
- Objects -> Objects

If the old category is an "Internal World" hint, you must still choose one \
specific emotion family — never output "Internal World" itself.

Categories:

Internal World (emotion families) — use when the sticker's primary content \
is a facial expression, mood, feeling-word, or emotionally-toned \
illustration (including stylized animals or people whose main purpose is \
conveying a vibe/feeling):
- Joy & Fun — happy, silly, playful, excited, amused
- Calm & Peace — relaxed, cozy, content, at ease
- Love & Connection — affection, warmth, closeness, gratitude
- Sad & Down — low, blue, disappointed, lonely
- Stressed & Anxious — overwhelmed, worried, nervous, panicked
- Angry & Frustrated — irritated, mad, annoyed, fed up
- Tired & Drained — exhausted, burnt out, sleepy, low energy
- Confused & Mixed — numb, meh, uncertain, "don't know how I feel"

External World (literal content) — use when the sticker's primary content \
is a concrete object, place, activity, or literal (non-mood-focused) \
depiction of a person/animal:
- People & Body — literal human figures/body parts not primarily conveying \
an emotion
- Animals & Nature — literal animals, plants, weather, outdoors (not \
stylized "vibe" animals — those go to Internal World)
- Food & Drink
- Travel & Places
- Activities — sports, hobbies, events, celebrations
- Objects — household items, tools, money, tech, books, chores, work/school \
items

Rules:
- Exactly one primaryCategory. secondaryCategory only if a second category \
genuinely applies (e.g. a "coffee with a friend" scene could be \
Love & Connection primary, Food & Drink secondary).
- Stylized/expressive animals, people, or word/phrase stickers meant to \
convey a mood belong in an Internal World category — sort by the feeling \
they convey.
- Tags should describe what's visually there AND/OR the mood it evokes — \
whichever is more useful for someone searching later.
- Set "needsReview": true (and still fill in your best guess for every \
other field) if the image is abstract, ambiguous, or you are not confident \
in the category assignment.
- Do not invent new categories."""


def load_json(path, default):
    if path.exists():
        with open(path) as f:
            return json.load(f)
    return default


def parse_response(text, sticker_id):
    """Parse and validate the model's JSON. Returns dict or raises ValueError."""
    clean = text.strip()
    # Strip markdown fences if the model added them despite instructions.
    if clean.startswith("```"):
        clean = clean.strip("`")
        if clean.startswith("json"):
            clean = clean[4:]
        clean = clean.strip()

    data = json.loads(clean)  # raises on bad JSON

    missing = [f for f in REQUIRED_FIELDS if f not in data]
    if missing:
        raise ValueError(f"missing fields: {missing}")

    if data["primaryCategory"] not in VALID_CATEGORIES:
        raise ValueError(f"invalid primaryCategory: {data['primaryCategory']!r}")
    if data["secondaryCategory"] is not None \
            and data["secondaryCategory"] not in VALID_CATEGORIES:
        raise ValueError(f"invalid secondaryCategory: {data['secondaryCategory']!r}")
    if not isinstance(data["tags"], list) or not (3 <= len(data["tags"]) <= 5):
        raise ValueError(f"tags must be a list of 3-5 items, got {data['tags']!r}")

    # Force the id we sent, in case the model mangled it.
    data["id"] = sticker_id
    return data


def tag_sticker(client, image_path, sticker_id, old_category):
    """One API call for one sticker. Returns validated dict or raises."""
    with open(image_path, "rb") as f:
        image_b64 = base64.standard_b64encode(f.read()).decode("utf-8")

    message = client.messages.create(
        model=MODEL,
        max_tokens=500,
        system=SYSTEM_PROMPT,
        messages=[{
            "role": "user",
            "content": [
                {
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": "image/webp",
                        "data": image_b64,
                    },
                },
                {
                    "type": "text",
                    "text": f'Sticker id: "{sticker_id}"\n'
                            f'OLD category (hint only): "{old_category}"',
                },
            ],
        }],
    )
    text = "".join(b.text for b in message.content if b.type == "text")
    return parse_response(text, sticker_id)


def main():
    if not os.environ.get("ANTHROPIC_API_KEY"):
        sys.exit("ANTHROPIC_API_KEY not set.")
    if not STICKERS_DIR.is_dir():
        sys.exit(f"Stickers directory not found: {STICKERS_DIR}")

    disabled = set(load_json(DISABLED_FILE, []))
    old_cats = load_json(OLD_CATS_FILE, {})
    # Resume support: skip anything already tagged in a previous run.
    tagged = load_json(OUTPUT_FILE, [])
    done_ids = {t["id"] for t in tagged}

    client = anthropic.Anthropic()
    failed = []

    stickers = sorted(STICKERS_DIR.glob("*.webp"))
    todo = [p for p in stickers
            if p.stem not in disabled and p.stem not in done_ids]
    print(f"{len(stickers)} stickers found, {len(todo)} to process "
          f"({len(disabled)} disabled, {len(done_ids)} already tagged).")

    for i, path in enumerate(todo, 1):
        sticker_id = path.stem
        old_category = old_cats.get(sticker_id, "Unknown")
        print(f"[{i}/{len(todo)}] {sticker_id} ... ",
              end="", flush=True)

        result = None
        last_err = None
        for attempt in range(1 + MAX_RETRIES):
            try:
                result = tag_sticker(client, path, sticker_id, old_category)
                break
            except (json.JSONDecodeError, ValueError) as e:
                last_err = f"bad response: {e}"
            except anthropic.APIError as e:
                last_err = f"API error: {e}"
                time.sleep(2)  # brief backoff on API-side errors
            if attempt < MAX_RETRIES:
                print(f"retry ({last_err}) ... ", end="", flush=True)

        if result is None:
            print(f"FAILED ({last_err})")
            failed.append({"id": sticker_id, "error": last_err,
                           "oldCategory": old_category})
        else:
            flag = " [needsReview]" if result["needsReview"] else ""
            print(f"{result['primaryCategory']}{flag}")
            tagged.append(result)

        # Write incrementally so an interrupted run loses nothing.
        with open(OUTPUT_FILE, "w") as f:
            json.dump(tagged, f, indent=2)

        time.sleep(SLEEP_BETWEEN)

    with open(FAILED_FILE, "w") as f:
        json.dump(failed, f, indent=2)

    review = [t for t in tagged if t.get("needsReview")]
    with open(REVIEW_FILE, "w") as f:
        json.dump(review, f, indent=2)

    print(f"\nDone. {len(tagged)} tagged, {len(failed)} failed, "
          f"{len(review)} flagged for review.")
    print(f"  results : {OUTPUT_FILE}")
    print(f"  failures: {FAILED_FILE}")
    print(f"  review  : {REVIEW_FILE}")


if __name__ == "__main__":
    main()