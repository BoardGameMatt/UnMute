#!/usr/bin/env python3
"""Build cover-story-agencies-v1.json from the authored CSV plus alias lists.

Run from repo root:
  python3 docs/protocols/cover-story-aliases-v1.py
"""

from __future__ import annotations

import csv
import json
import re
import unicodedata
from pathlib import Path

CSV_PATH = Path(
    "/Users/matthendricks/Downloads/cover_story_agencies_final50.csv"
)
OUT_JSON = Path(__file__).with_name("cover-story-agencies-v1.json")
OUT_CSV = Path(__file__).with_name("cover-story-agencies-v1.csv")

# Official name is matched separately. These are extra strings the suggester
# should treat as correct. Keep them as category/franchise names, not the
# planted tell-words, except where the alternate name *is* the property.
ALIASES: dict[str, list[str]] = {
    "Green Vegetables": [
        "vegetables",
        "veggies",
        "greens",
        "green veggies",
        "leafy greens",
        "green vegetable",
        "leafy vegetables",
    ],
    "Chess": [
        "chess game",
        "chess pieces",
        "chessboard",
        "playing chess",
        "game of chess",
    ],
    "Sewing and Tailoring": [
        "sewing",
        "tailoring",
        "needlework",
        "dressmaking",
        "seamstress",
        "tailor",
        "sewing tailoring",
    ],
    "Card Games": [
        "cards",
        "playing cards",
        "card game",
        "card games",
        "games with cards",
        "poker",
    ],
    "Astronomy": [
        "space",
        "stars and planets",
        "the cosmos",
        "astrophysics",
        "astronomy and space",
        "celestial",
    ],
    "Pasta Shapes": [
        "pasta",
        "pasta types",
        "types of pasta",
        "italian pasta",
        "pasta noodles",
        "pasta shapes",
    ],
    "Spices": [
        "spice",
        "seasoning",
        "seasonings",
        "spice rack",
        "cooking spices",
        "spice cabinet",
    ],
    "Fruit": [
        "fruits",
        "fruit names",
        "types of fruit",
        "fresh fruit",
        "fruit bowl",
    ],
    "Dog Breeds": [
        "dogs",
        "dog breed",
        "dog breeds",
        "types of dogs",
        "canine",
        "puppies",
        "dog",
    ],
    "Seafood": [
        "fish",
        "fish and seafood",
        "shellfish",
        "sea food",
        "ocean fish",
    ],
    "Workshop Tools": [
        "tools",
        "hand tools",
        "hardware tools",
        "workshop",
        "tool bench",
        "garage tools",
    ],
    "Dance Styles": [
        "dance",
        "dancing",
        "dances",
        "types of dance",
        "dance styles",
        "ballroom",
        "ballroom dance",
    ],
    "Sailing": [
        "sailboats",
        "sailboat",
        "boating",
        "nautical sailing",
        "yachting",
        "sail boat",
    ],
    "Rivers of the World": [
        "rivers",
        "river",
        "world rivers",
        "famous rivers",
        "river names",
        "major rivers",
    ],
    "US National Parks": [
        "national parks",
        "us parks",
        "american national parks",
        "national park",
        "nps",
        "national park service",
    ],
    "Capital Cities": [
        "capitals",
        "capital city",
        "world capitals",
        "capital cities",
        "capitals of the world",
        "country capitals",
    ],
    "Gemstones": [
        "gems",
        "jewels",
        "gemstone",
        "precious stones",
        "birthstones",
        "gem stones",
    ],
    "Flowers": [
        "flower",
        "flower names",
        "types of flowers",
        "florist",
        "blooming flowers",
        "garden flowers",
    ],
    "Herbs": [
        "herb",
        "culinary herbs",
        "cooking herbs",
        "fresh herbs",
        "herb garden",
        "kitchen herbs",
    ],
    "Teas": [
        "tea",
        "types of tea",
        "tea varieties",
        "tea types",
        "hot tea",
        "loose leaf tea",
    ],
    "Pottery": [
        "ceramics",
        "ceramic",
        "pottery making",
        "clay pottery",
        "pots and ceramics",
        "studio pottery",
    ],
    "Ancient Egypt": [
        "egypt",
        "egyptian",
        "egyptians",
        "ancient egyptian",
        "pharaonic egypt",
        "egyptology",
    ],
    "Castles": [
        "castle",
        "medieval castles",
        "fortress",
        "fortresses",
        "castle architecture",
        "medieval fortress",
    ],
    "Beekeeping": [
        "bees",
        "bee keeping",
        "honeybees",
        "apiculture",
        "beekeeper",
        "honey bees",
        "keeping bees",
    ],
    "Dinosaurs": [
        "dinosaur",
        "dino",
        "dinos",
        "prehistoric animals",
        "prehistoric creatures",
        "dinosauria",
    ],
    "Star Wars": [
        "starwars",
        "star wars movies",
        "star wars film",
        "a galaxy far away",
        "george lucas",
        "lucasfilm",
        "jedi universe",
    ],
    "Harry Potter": [
        "potter",
        "hogwarts",
        "jk rowling",
        "j k rowling",
        "harry potter books",
        "wizarding world",
        "the wizarding world",
    ],
    "Lord of the Rings": [
        "lotr",
        "the lord of the rings",
        "tolkien",
        "jrr tolkien",
        "middle earth",
        "middleearth",
        "the hobbit",
    ],
    "The Office": [
        "the office us",
        "office tv show",
        "the office tv",
        "dunder mifflin",
        "michael scott show",
        "nbc the office",
    ],
    "The Wizard of Oz": [
        "wizard of oz",
        "oz",
        "the wizard of oz movie",
        "judy garland",
        "oz movie",
        "wizard oz",
    ],
    "Willy Wonka": [
        "wonka",
        "charlie and the chocolate factory",
        "chocolate factory",
        "roald dahl",
        "willy wonka and the chocolate factory",
        "wonka factory",
    ],
    "Disney Princesses": [
        "disney princess",
        "disney princesses",
        "princesses",
        "disney",
        "disney fairy tales",
        "fairy tale princesses",
    ],
    "Back to the Future": [
        "bttf",
        "back to the future movies",
        "back to the future film",
        "marty mcfly",
        "doc brown",
        "hill valley",
    ],
    "Jaws": [
        "jaws movie",
        "the shark movie",
        "jaws the movie",
        "spielberg shark",
        "jaws film",
    ],
    "Monopoly": [
        "monopoly game",
        "the game monopoly",
        "monopoly board game",
        "boardwalk game",
        "monopoly board",
    ],
    "Sesame Street": [
        "sesame",
        "sesame st",
        "sesame street show",
        "sesame street muppets",
        "jim henson sesame",
    ],
    "Peanuts": [
        "peanuts comic",
        "charlie brown",
        "peanuts cartoon",
        "charles schulz",
        "peanuts strip",
        "snoopy comic",
    ],
    "Sherlock Holmes": [
        "sherlock",
        "holmes",
        "sherlock holmes stories",
        "arthur conan doyle",
        "conan doyle",
        "detective holmes",
        "221b baker street",
    ],
    "Cheese": [
        "cheeses",
        "types of cheese",
        "cheese types",
        "cheese board",
        "fromage",
        "cheese names",
    ],
    "Sushi": [
        "sushi rolls",
        "japanese sushi",
        "sushi types",
        "sushi restaurant",
        "nigiri and rolls",
    ],
    "Whales and Dolphins": [
        "whales",
        "dolphins",
        "whale",
        "dolphin",
        "cetaceans",
        "marine mammals",
        "whales dolphins",
    ],
    "Horse Breeds": [
        "horses",
        "horse",
        "horse breed",
        "horse breeds",
        "types of horses",
        "equine",
        "horse types",
    ],
    "Volcanoes": [
        "volcano",
        "volcanic",
        "volcano names",
        "volcanos",
        "volcanic eruptions",
    ],
    "Lighthouses": [
        "lighthouse",
        "lighthouse keeping",
        "maritime lighthouses",
        "coastal lighthouses",
        "light houses",
    ],
    "Clocks and Watches": [
        "clocks",
        "watches",
        "timepieces",
        "clock",
        "watch",
        "horology",
        "clocks watches",
    ],
    "Scuba Diving": [
        "scuba",
        "diving",
        "scuba dive",
        "scuba diving",
        "underwater diving",
        "dive gear",
    ],
    "Glassblowing": [
        "glass blowing",
        "blown glass",
        "glass art",
        "glassblower",
        "glass blowing studio",
    ],
    "Cartography": [
        "maps",
        "mapmaking",
        "map making",
        "map maker",
        "making maps",
        "cartographer",
    ],
    "Photography": [
        "photos",
        "cameras",
        "taking photos",
        "photography terms",
        "camera work",
        "photo",
    ],
    "Climbing": [
        "rock climbing",
        "mountaineering",
        "climbers",
        "rock climbing gear",
        "alpine climbing",
        "rockclimb",
    ],
}


def slugify(name: str) -> str:
    nfkd = unicodedata.normalize("NFKD", name)
    ascii_name = nfkd.encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-z0-9]+", "-", ascii_name.lower()).strip("-")
    return slug


def normalize(value: str) -> str:
    lowered = value.strip().lower()
    lowered = unicodedata.normalize("NFKD", lowered)
    lowered = lowered.encode("ascii", "ignore").decode("ascii")
    lowered = re.sub(r"[^a-z0-9\s]", " ", lowered)
    return re.sub(r"\s+", " ", lowered).strip()


def main() -> None:
    with CSV_PATH.open(newline="", encoding="utf-8") as handle:
        rows = list(csv.DictReader(handle))

    if len(rows) != 50:
        raise SystemExit(f"expected 50 agencies, got {len(rows)}")

    missing = [row["agency_name"] for row in rows if row["agency_name"] not in ALIASES]
    extra = sorted(set(ALIASES) - {row["agency_name"] for row in rows})
    if missing or extra:
        raise SystemExit(f"alias map mismatch. missing={missing} extra={extra}")

    agencies = []
    claimed: dict[str, str] = {}
    collisions: list[str] = []

    def claim(raw: str, owner: str, kind: str) -> str:
        key = normalize(raw)
        if not key:
            raise SystemExit(f"empty {kind} for {owner}")
        prior = claimed.get(key)
        if prior and prior != owner:
            collisions.append(f"{kind!r} {raw!r} -> {key!r} claimed by {prior} and {owner}")
        claimed[key] = owner
        return key

    for row in rows:
        name = row["agency_name"]
        aliases = [normalize(alias) for alias in ALIASES[name]]
        # de-dupe while preserving order
        seen: set[str] = set()
        unique_aliases = []
        for alias in aliases:
            if alias not in seen and alias != normalize(name):
                seen.add(alias)
                unique_aliases.append(alias)

        claim(name, name, "official_name")
        for alias in unique_aliases:
            claim(alias, name, "alias")

        words = []
        for ordinal in range(1, 6):
            words.append(
                {
                    "ordinal": ordinal,
                    "phrase": row[f"word_{ordinal}"],
                    "difficulty": int(row[f"diff_{ordinal}"]),
                }
            )

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
                "words": words,
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
        "deal": {
            "hand_size": 3,
            "unique_per_session": True,
            "shuffle": "server_side_at_deal",
            "burn_shown": True,
        },
        "difficulty_scale": {
            "min": 1,
            "max": 5,
            "meaning": "1 = easy to sneak into a professional meeting; 5 = almost unsayable without giving the agency away",
        },
        "agencies": agencies,
    }

    OUT_JSON.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")

    fieldnames = [
        "id",
        "source_id",
        "status",
        "agency_name",
        "kind",
        "aliases",
        "word_1",
        "word_2",
        "word_3",
        "word_4",
        "word_5",
        "diff_1",
        "diff_2",
        "diff_3",
        "diff_4",
        "diff_5",
        "pop_culture",
        "tier",
        "change_log",
        "notes",
    ]
    with OUT_CSV.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for agency in agencies:
            writer.writerow(
                {
                    "id": agency["id"],
                    "source_id": agency["source_id"],
                    "status": agency["status"],
                    "agency_name": agency["official_name"],
                    "kind": agency["kind"],
                    "aliases": " | ".join(agency["aliases"]),
                    **{f"word_{word['ordinal']}": word["phrase"] for word in agency["words"]},
                    **{f"diff_{word['ordinal']}": word["difficulty"] for word in agency["words"]},
                    "pop_culture": "Y" if agency["pop_culture"] else "N",
                    "tier": agency["tier"],
                    "change_log": agency["change_log"],
                    "notes": agency["notes"],
                }
            )

    print(f"wrote {OUT_JSON}")
    print(f"wrote {OUT_CSV}")
    print(f"{len(agencies)} agencies, {sum(len(a['aliases']) for a in agencies)} aliases, 0 collisions")


if __name__ == "__main__":
    main()
