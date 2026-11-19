#!/usr/bin/env python3
"""Builds src/domain/catalogData.ts from the manufacturer lists in this folder.

Run from the repo root:  python3 scripts/catalog/build.py

The lists are plain text so they are easy to correct or extend by hand. Codes
and names come from the makers' own published catalogs (see each file's
header). Color families are guessed from the names; fix a wrong guess by adding
the code to FAMILY_OVERRIDES below.
"""

import json
import pathlib
import re

HERE = pathlib.Path(__file__).resolve().parent
OUT = HERE.parent.parent / "src" / "domain" / "catalogData.ts"

# Earliest keyword in the name wins, so "Teal Green/White" is green and
# "White/Light Blue" is white-led but blue is what she'd search for: see LEAD_WHITE.
KEYWORDS = {
    "red": ["red", "ruby", "cherry", "cranberry", "garnet", "carnelian", "scarlet", "cinnabar", "flame", "inferno", "strawberr"],
    "orange": ["orange", "tangerine", "pumpkin", "persimmon", "coral", "salmon", "rust", "terra cotta", "amber", "butterscotch", "peach"],
    "yellow": ["yellow", "canary", "sunflower", "marigold", "lemon", "citron", "mimosa", "meadowlark", "golden"],
    "green": ["green", "jade", "mint", "olive", "emerald", "lime", "fern", "leaf", "moss", "celadon", "avocado", "artichoke",
              "chartreuse", "pea pod", "lily pad", "olivine", "cilantro", "seafoam", "congo", "rainforest", "lagoon",
              "lemongrass", "amazon", "kelly", "pine", "grass", "tea", "teal", "spruce", "ming", "khaki", "petrified"],
    "blue": ["blue", "cobalt", "turquoise", "aqua", "periwinkle", "indigo", "sapphire", "cyan", "sky", "navy", "steel",
             "caribbean", "peacock", "robin", "glacier", "juniper", "mariner", "hydrangea", "chambray", "atlantis",
             "vienna", "yonder", "colonial", "azure"],
    "purple": ["purple", "plum", "violet", "lavender", "lilac", "amethyst", "grape", "blackberry", "monterrey"],
    "pink": ["pink", "rose", "blush", "rhubarb", "erbium", "fuchsia", "champagne"],
    "brown": ["brown", "umber", "sienna", "bronze", "chocolate", "chestnut", "tan", "mink", "almond", "marzipan",
              "nougat", "copper tint", "hawkwings", "topaz", "caramel"],
    "black": ["black", "licorice"],
    "gray": ["gray", "grey", "pewter", "charcoal", "slate", "smoke", "raincloud", "driftwood", "murano"],
    "white": ["white", "vanilla", "cream", "ivory", "opaline", "pearl opal", "crystal opal", "firelight"],
    "clear": ["clear", "icicle", "reactive ice", "reactive cloud"],
}

# Two-word names that must not be split by the keyword search.
PHRASES = {"gold purple": "purple", "copper blue": "blue", "blue topaz": "blue", "brown topaz": "brown",
           "sierra red": "red", "aventurine blue": "blue", "aventurine black": "black", "aventurine bronze": "brown"}

FAMILY_OVERRIDES = {
    ("Bullseye", "0009"): "white",  # Reactive Cloud Opalescent
    ("Bullseye", "0227"): "green",  # Golden Green
    ("Bullseye", "0345"): "green",  # Steel Jade
    ("Bullseye", "1109"): "brown",  # Dark Rose Brown
    ("Bullseye", "1311"): "pink",   # Cranberry Pink
    ("Bullseye", "1422"): "green",  # Lemon Lime Green
    ("Bullseye", "1831"): "pink",   # Ruby Pink Tint
    ("Oceanside", "6000-81CC-F"): "white",
    ("Oceanside", "308S-F"): "white",
    ("Oceanside", "307S-F"): "white",
    ("Oceanside", "223-74S-F"): "green",  # Peacock Green
}

# Where the catalog's opacity heading doesn't match how she'd describe the glass.
TYPE_OVERRIDES = {
    ("Oceanside", "110-1A-F"): "cathedral",
    ("Oceanside", "110-1S-F"): "cathedral",
    ("Oceanside", "318-05S-F"): "streaky",
    ("Oceanside", "591-1RR-F"): "textured",
    ("Oceanside", "591-1W-F"): "textured",
}


def family_for(name: str) -> str:
    n = name.lower()
    best = None  # (index, -length, family)
    for phrase, fam in PHRASES.items():
        i = n.find(phrase)
        if i >= 0:
            best = min(best or (i, -len(phrase), fam), (i, -len(phrase), fam))
    for fam, words in KEYWORDS.items():
        for w in words:
            m = re.search(r"\b" + re.escape(w), n)
            if m:
                cand = (m.start(), -len(w), fam)
                best = cand if best is None else min(best, cand)
    fam = best[2] if best else "multi"
    # "White/Light Blue" or "Clear, Red Opalescent" are bought for the color, not the white or clear.
    if fam in ("white", "clear"):
        rest = [f for f in (family_for_word(n, skip=fam))]
        if rest:
            return rest[0]
    return fam


def family_for_word(n: str, skip: str):
    found = []
    for phrase, fam in PHRASES.items():
        i = n.find(phrase)
        if i >= 0 and fam != skip:
            found.append((i, fam))
    for fam, words in KEYWORDS.items():
        if fam in (skip, "white", "clear"):
            continue
        for w in words:
            m = re.search(r"\b" + re.escape(w), n)
            if m:
                found.append((m.start(), fam))
    return [f for _, f in sorted(found)]


def rows(path):
    for line in (HERE / path).read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#"):
            yield [p.strip() for p in line.split("|")]


def bullseye():
    hexes = {int(code): hx for code, hx in rows("bullseye-hex.txt")}
    out = []
    for section, style, name in rows("bullseye-styles.txt"):
        n = int(style)
        code = f"{n:04d}"
        glass_type = {"opal": "opalescent", "clear": "clear", "trans": "cathedral", "streaky": "streaky"}[section]
        label = name
        if section == "opal" and not re.search(r"opal|rod|tint|white|black", name, re.I):
            label = f"{name} Opal"
        elif section == "trans" and not re.search(r"tint|rod", name, re.I):
            label = f"{name} Transparent"
        if section == "streaky":
            fam = "multi"
        elif section == "clear":
            fam = "clear"
        else:
            fam = family_for(name)
        fam = FAMILY_OVERRIDES.get(("Bullseye", code), fam)
        out.append([code, label, glass_type, fam, hexes.get(n, "")])
    return out


def oceanside():
    out = []
    for code, name, kind in rows("oceanside-compatible.txt"):
        k = kind.lower()
        if "iridescent" in k:
            t = "iridized"
        elif "aventurine" in k:
            t = "other"
        elif "wispy" in name.lower():
            t = "wispy"
        elif k.startswith("transparent"):
            if re.match(r"(clear|icicle|crystal clear)\b", name, re.I):
                t = "clear"
            else:
                t = "textured" if "texture" in k else "cathedral"
        elif "/" in name or "," in name:
            t = "streaky"
        else:
            t = "opalescent"
        t = TYPE_OVERRIDES.get(("Oceanside", code), t)
        fam = "clear" if t == "clear" else family_for(name)
        fam = FAMILY_OVERRIDES.get(("Oceanside", code), fam)
        out.append([code, name, t, fam, ""])
    return out


def table(rows):
    return ",\n".join("  " + json.dumps(r, ensure_ascii=False) for r in rows) + ","


def main():
    b, o = bullseye(), oceanside()
    body = (
        "// Generated by scripts/catalog/build.py from the makers' published catalogs. Do not edit by hand;\n"
        "// change the .txt lists in scripts/catalog/ and run the script again.\n"
        "//\n"
        "// Each row: [code, name, glass type, color family, hex]. Hex is the maker's own screen\n"
        "// approximation where published (Bullseye), otherwise empty.\n\n"
        "import type { GlassType } from '../db/types.ts';\n\n"
        "export type CatalogRow = [code: string, name: string, type: GlassType, family: string, hex: string];\n\n"
        f"export const BULLSEYE_COE90: CatalogRow[] = [\n{table(b)}\n];\n\n"
        f"export const OCEANSIDE_COE96: CatalogRow[] = [\n{table(o)}\n];\n"
    )
    OUT.write_text(body)
    print(f"wrote {OUT.relative_to(HERE.parent.parent)}: {len(b)} Bullseye, {len(o)} Oceanside")


if __name__ == "__main__":
    main()
