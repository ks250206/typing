"""Snapshot the latest 52 published Weather Typing weeks, deduplicating by title.

Online acquisition only; offline regeneration remains import-etyping.py.
Existing XML and set identifiers take precedence to preserve saved seeds.
"""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from html import unescape
from io import BytesIO
from pathlib import Path
from urllib.parse import urljoin
from urllib.request import Request, urlopen
from zipfile import ZipFile
import argparse
import hashlib
import json
import re
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
SOURCES = ROOT / 'data/sources/etyping'
INDEX = 'https://uaaaaaaaa.com/typing/word'
IDS = {
    '元気が出る言葉': 'encouragement', '顔の慣用句': 'face-idioms',
    '擬音・擬態語': 'onomatopoeia', '思い出の言葉': 'memories',
    '春の言葉': 'spring', 'バレンタイン': 'valentine',
    '秋の言葉': 'autumn', '数のある言葉': 'numbers', '食感ことば': 'textures',
    '大好きなおやつ': 'favorite-snacks', '学校にあるもの': 'school',
    '慣用句': 'idioms', '給食のおかず': 'school-lunch', 'ことわざ': 'proverbs',
    '夏のおやつ': 'summer-snacks', '夏の言葉': 'summer', 'エコライフ': 'eco-life',
    '短いことわざ': 'short-proverbs', '初夏の言葉': 'early-summer',
    '梅雨の言葉': 'rainy-season', '魚のことわざ': 'fish-proverbs',
    'おふくろの味': 'home-cooking', '冬の言葉': 'winter', '体の慣用句': 'body-idioms',
    'いろはかるた': 'iroha-karuta', '大掃除の言葉': 'year-end-cleaning',
}


def clean_title(name):
    return re.sub(r'[（(]\d+回[）)]$', '', name).strip()


def latest_weeks(index, count=52):
    rows = []
    for row in re.findall(r'<tr\b[^>]*>(.*?)</tr>', index, re.S):
        cells = re.findall(r'<td\b[^>]*>(.*?)</td>', row, re.S)
        if len(cells) != 4:
            continue
        number = re.search(r'(\d+)回', cells[0])
        link = re.search(r'href="([^"]+_wt\.zip)"', cells[2])
        if number and link:
            rows.append({'round': int(number[1]),
                         'title': unescape(re.sub('<[^>]+>', '', cells[1])).strip(),
                         'url': urljoin(INDEX, unescape(link[1]))})
    rows.sort(key=lambda row: row['round'], reverse=True)
    rows = rows[:count]
    if len(rows) != count or [row['round'] for row in rows] != list(range(rows[0]['round'], rows[0]['round'] - count, -1)):
        raise ValueError('Expected 52 consecutive published Weather Typing rounds')
    return rows


def download(url):
    with urlopen(Request(url, headers={'User-Agent': 'GALACTYPE dataset importer'}), timeout=30) as response:
        return response.read()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--index', type=Path, help='use a previously captured index HTML')
    args = parser.parse_args()
    raw = args.index.read_bytes() if args.index else download(INDEX)
    weeks = latest_weeks(raw.decode('utf-8'))
    previous_path = SOURCES / 'weekly-catalog.json'
    previous = {entry['file']: entry for entry in json.loads(previous_path.read_text())['sets']} if previous_path.exists() else {}
    existing = {}
    for path in sorted(SOURCES.glob('*.xml'), key=lambda path: (path.name.startswith('annual-'), path.name)):
        title = clean_title(ET.fromstring(path.read_bytes()).findtext('Name', ''))
        existing.setdefault(title, path.name)
    representatives = {}
    for week in weeks:
        if week['title'] not in IDS:
            raise ValueError(f"Assign a stable identifier for the new title: {week['title']}")
        representatives.setdefault(week['title'], week)

    def acquire(item):
        title, week = item
        identifier = IDS[title]
        if title in existing:
            saved = previous.get(existing[title])
            if saved and 'xml_sha256' in saved:
                actual = hashlib.sha256((SOURCES / saved['file']).read_bytes()).hexdigest()
                if actual != saved['xml_sha256']:
                    raise ValueError(f'Existing XML changed: {saved["file"]}')
                return dict(saved)
            return {'id': 'etyping-' + identifier, 'title': title,
                    'file': existing[title], 'existing': True}
        archive = download(week['url'])
        with ZipFile(BytesIO(archive)) as package:
            members = [name for name in package.namelist() if name.lower().endswith('.xml')]
            if len(members) != 1:
                raise ValueError(f'Expected one Words XML in {week["url"]}')
            xml = package.read(members[0])
        if clean_title(ET.fromstring(xml).findtext('Name', '')) != title:
            raise ValueError(f'Title mismatch for round {week["round"]}')
        return {'id': 'etyping-' + identifier, 'title': title,
                'file': f'annual-{identifier}.xml', 'existing': False,
                'round': week['round'], 'url': week['url'],
                'archive_sha256': hashlib.sha256(archive).hexdigest(),
                'member': members[0], 'xml_sha256': hashlib.sha256(xml).hexdigest(),
                '_xml': xml}

    # A failed download or unexpected title never leaves a partial snapshot.
    with ThreadPoolExecutor(max_workers=4) as pool:
        sets = list(pool.map(acquire, representatives.items()))
    added = sum('_xml' in entry for entry in sets)
    for entry in sets:
        xml = entry.pop('_xml', None)
        if xml is not None:
            (SOURCES / entry['file']).write_bytes(xml)
    (SOURCES / 'weekly-index.html').write_bytes(raw)
    by_title = {entry['title']: entry for entry in sets}
    for week in weeks:
        entry = by_title[week['title']]
        week.update({'set_id': entry['id'], 'canonical_file': entry['file']})
    manifest = {'source_url': INDEX, 'retrieved_at': datetime.now(timezone.utc).isoformat(),
                'index_file': 'weekly-index.html', 'index_sha256': hashlib.sha256(raw).hexdigest(),
                'policy': 'Latest 52 published rounds; same title means one set. Existing XML takes precedence.',
                'weeks': weeks, 'sets': sets}
    (SOURCES / 'weekly-catalog.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    print(f"Rounds {weeks[-1]['round']}–{weeks[0]['round']}: {len(weeks)} weeks, {len(sets)} titles, {added} new sets")


if __name__ == '__main__':
    main()
