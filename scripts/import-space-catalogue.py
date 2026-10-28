"""Rebuild factual celestial-name additions (names/readings only, no prose).

python3 scripts/import-space-catalogue.py
Changes to this snapshot require a new replay version.
"""
import html
import json
from pathlib import Path
import re
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
STARS = "https://www6338.la.coocan.jp/starnames.html"
CONSTELLATIONS = "https://www.nao.ac.jp/new-info/constellation.html"
# Keep the familiar NAOJ spellings already present in GALACTYPE's first corpus.
ORIGINAL_STARS = {
    "Arcturus", "Acrux", "Achernar", "Adhara", "Algol", "Altair", "Aldebaran",
    "Antares", "Castor", "Canopus", "Capella", "Sirius", "Spica", "Deneb",
    "Denebola", "Hadar", "Fomalhaut", "Procyon", "Vega", "Betelgeuse", "Pollux", "Polaris",
}

def fetch(url):
    with urllib.request.urlopen(url, timeout=30) as response:
        body = response.read()
        encoding = re.search(br"charset\s*=\s*['\"]?([a-zA-Z0-9_-]+)", body[:4096], re.I)
        return body.decode(encoding.group(1).decode("ascii") if encoding else "utf-8")

def clean(value):
    return html.unescape(re.sub(r"<[^>]*>", "", value)).strip()

def reading(name):
    return "".join(chr(ord(c) - 0x60) if "ァ" <= c <= "ヶ" else c for c in name).replace("・", "").replace(" ", "")

legacy = ROOT.joinpath("src/spaceWords.ts").read_text().split("export const legacySpaceWords")[0]
seen = set(re.findall(r"\['([^']+)', '[^']+'\]", legacy))
stars = []
for row in re.findall(r"<tr[^>]*>(.*?)</tr>", fetch(STARS), re.S):
    columns = re.findall(r"<td[^>]*>(.*?)</td>", row, re.S)
    if len(columns) < 6 or "<b>" not in columns[0]:
        continue
    english, japanese = clean(columns[0]), clean(columns[5])
    if english in ORIGINAL_STARS or japanese in seen or not re.fullmatch("[ァ-ヶー・ ]+", japanese):
        continue
    stars.append([japanese, reading(japanese)])
    seen.add(japanese)

constellations = []
for value in re.findall(r'<td[^>]*class="name(?:5)?"[^>]*>(.*?)</td>', fetch(CONSTELLATIONS), re.S | re.I):
    name = re.split("[（＊]", clean(value))[0]
    if re.fullmatch("[ぁ-ゖァ-ヶー]+", name):
        constellations.append([name + "座", reading(name) + "ざ"])
if len(constellations) != 88 or len(stars) < 400:
    raise ValueError("Source format/count changed; inspect the source before updating")
result = {"恒星": stars, "星座": constellations}
ROOT.joinpath("src/data/spaceCatalogue.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"Added {len(stars)} stars and {len(constellations)} constellations")
