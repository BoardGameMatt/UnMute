#!/usr/bin/env python3
"""Build cover-story-agencies-v1.json from the authored CSV plus alias lists."""

from __future__ import annotations

import csv
import json
import re
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CSV_PATH = Path("/Users/matthendricks/Downloads/cover_story_agencies_final50.csv")
ALIASES_PATH = Path(__file__).with_name("cover-story-aliases.json")
OUT_JSON = ROOT / "supabase" / "seed-data" / "cover-story-agencies-v1.json"


def slugify(name: str) -> str:
    nfkd = unicodedata.normalize("NFKD", name)
    ascii_name = nfkd.encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-z0-9]+", "-", ascii_name.lower()).strip("-")


def normalize(value: str) -> str:
    lowered = value.strip().lower()
    lowered = unicodedata.normalize("NFKD", lowered)
    lowered = lowered.encode("ascii", "ignore").decode("ascii")
    lowered = re.sub(r"[^a-z0-9\s]", " ", lowered)
    return re.sub(r"\s+", " ", lowered).strip()


def main() -> None:
    aliases_map: dict[str, list[str]] = json.loads(ALIASES_PATH.read_text())
    with CSV_PATH.open(newline="", encoding="utf-8") as handle:
        rows = list(csv.DictReader(handle))

    if len(rows) != 50:
        raise SystemExit(f"expected 50 agencies, got {len(rows)}")

    missing = [row["agency_name"] for row in rows if row["agency_name"] not in aliases_map]
    extra = sorted(set(aliases_map) - {row["agency_name"] for row in rows})
    if missing or extra:
        raise SystemExit(f"alias map mismatch. missing={missing} extra={extra}")

    agencies = []
    claimed: dict[str, str] = {}
    collisions: list[str] = []

    def claim(raw: str, owner: str) -> None:
        key = normalize(raw)
        prior = claimed.get(key)
        if prior and prior != owner:
            collisions.append(f"{raw!r} -> {key!r} claimed by {prior} and {owner}")
        claimed[key] = owner

    for row in rows:
        name = row["agency_name"]
        unique_aliases: list[str] = []
        seen: set[str] = set()
        for alias in aliases_map[name]:
            key = normalize(alias)
            if key and key not in seen and key != normalize(name):
                seen.add(key)
                unique_aliases.append(key)

        claim(name, name)
        for alias in unique_aliases:
            claim(alias, name)

        agencies.append(
            {
                "id": int(row["id"]),
                "source_id": row["source_id"],
                "slug": slugify(name),
                "official_name": name,
                "aliases": unique_aliases,
                "kind": row["kind"],
                "pop_culture": row["pop_culture"] == "Y",
                "tier": int(row["tier"]),
                "playable": True,
                "active": True,
                "hr_safe": True,
                "status": row["status"],
                "words": [
                    {
                        "ordinal": ordinal,
                        "phrase": row[f"word_{ordinal}"],
                        "difficulty": int(row[f"diff_{ordinal}"]),
                    }
                    for ordinal in range(1, 6)
                ],
                "change_log": row["change_log"],
                "notes": row["notes"],
            }
        )

    if collisions:
        raise SystemExit("alias collisions:\n" + "\n".join(collisions))

    payload = {
        "version": 1,
        "slug": "cover-story",
        "playable_count": len(agencies),
        "agencies": agencies,
    }
    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {OUT_JSON} ({len(agencies)} agencies)")


if __name__ == "__main__":
    main()
