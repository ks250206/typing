"""Aggregate all public source pages, preserving text/reading pairs and duplicates.

Run from the repository: python3 scripts/import-typewell.py
A dataset change requires a new replay version in src/typewell.ts.
"""
from data_paths import generated_path
import html
import json
from pathlib import Path
import re
import urllib.request

PAGES = {
    "basic": [91013, 91435, 91437],
    "katakana": [91438, 91440, 91441, 91442, 91443, 91444],
    "kanji": [91453, 91454, 91457, 91461],
    "idioms": [91462, 91466, 91467, 91468],
}

result = {}
for category, ids in PAGES.items():
    pairs = []
    for page_id in ids:
        with urllib.request.urlopen(f"https://typing.twi1.me/game/{page_id}", timeout=30) as response:
            source = response.read().decode("utf-8")
        rows = re.findall(
            r'<span class="kana">\((.*?)\)</span>\s*<span class="kanji">(.*?)</span>',
            source, re.S,
        )
        if not rows:
            raise ValueError(f"Missing problem rows: {page_id}")
        for kana, text in rows:
            readings = html.unescape(re.sub(r"<[^>]*>", "", kana)).split()
            words = html.unescape(re.sub(r"<[^>]*>", "", text)).split()
            if len(readings) != len(words):
                raise ValueError(f"Alignment mismatch: {page_id}, {text}")
            pairs.extend(zip(words, readings))
        print(category, page_id, len(rows))
    result[category] = pairs

output = Path(__file__).resolve().parents[1] / "data/sources/typewell/typewell.json"
output.write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
generated_path("typewell.json").write_bytes(output.read_bytes())
