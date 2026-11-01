"""Import the pinned TypeLighter archive offline, newest round per English title.

Keep English strings verbatim (including case, punctuation and internal spaces).
The archive has 38 English e-typing rounds from 2012, not a current-year feed.
"""
from pathlib import Path
import hashlib
import json
import re
import xml.etree.ElementTree as ET
from zipfile import ZipFile
from data_paths import generated_path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'data/sources/english/TypeLighter.zip'
URL = 'https://github.com/physics-HTFI/TypeLighter'


def import_archive(path=SOURCE):
    groups = {}
    with ZipFile(path) as archive:
        for entry in archive.infolist():
            name = entry.filename if entry.flag_bits & 0x800 else entry.filename.encode('cp437').decode('cp932')
            if not name.endswith('.tpl'):
                continue
            match = re.search(r'e-typing/英語/第(\d+)回\s*(.*?)\s*[（(]\d+[)）]\.tpl$', name)
            tw = re.search(r'TWEW215/(\d)-(.*?)\s*[（(]\d+[)）]\.tpl$', name)
            if not match and not tw:
                continue
            number, title = (match or tw).groups()
            title = title.strip()
            raw = archive.read(entry)
            words = [word.get('roman') for word in ET.fromstring(raw).findall('Word')]
            if not words or any(not text or not re.fullmatch(r'[ -~]+', text) for text in words):
                raise ValueError(f'Unsupported or empty English entry in {name}')
            metadata = {'file': name, 'sha256': hashlib.sha256(raw).hexdigest(),
                        'round': int(number) if match else None, 'count': len(words)}
            group = groups.setdefault(('etyping' if match else 'typewell', title), [])
            group.append((metadata, list(dict.fromkeys(words))))
    result = []
    for (kind, title), versions in groups.items():
        versions.sort(key=lambda row: row[0]['round'] or 0, reverse=True)
        chosen, words = versions[0]
        # First observed round is a stable identifier; later snapshots retain it.
        identifier = min(row[0]['round'] for row in versions) if kind == 'etyping' else int(re.search(r'TWEW215/(\d)', chosen['file'])[1])
        result.append({'id': f'en-{kind}-{identifier:02}', 'title': title,
                       'kind': kind, 'source': chosen,
                       'aliases': [row[0] for row in versions[1:]], 'entries': words})
    return result


def main():
    sets = import_archive()
    generated_path('english.json').write_text(json.dumps(sets, ensure_ascii=False, separators=(',', ':')) + '\n')
    print(f"English: {len(sets)} unique titles, {sum(len(s['entries']) for s in sets)} entries; e-typing rounds 1–38 (2012).")


if __name__ == '__main__':
    main()
