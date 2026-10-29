"""Extract data from user-supplied CP932 trainer HTML without executing scripts.

Usage: python3 scripts/import-trainers.py [path/to/high-speed.html path/to/longform.htm]
No arguments: rebuild from bundled data-only source snapshots.
"""
from pathlib import Path
from data_paths import generated_path
import hashlib
import json
import re
import sys
import unicodedata

ROOT = Path(__file__).resolve().parents[1]
SOURCES = ROOT / 'data/sources/trainers'
SETS = {
    'http://typing.tsurizamurai.com/daken_010/type.cgi': ('trainer-high-speed', '高速タイピング'),
    'http://typing.tsurizamurai.com/daken_003/type.cgi': ('trainer-longform', '長文鍛錬用'),
}


def extract(path):
    raw = path.read_bytes()
    html = raw.decode('cp932')
    origin = re.search(r'<!-- saved from url=\(\d+\)([^\s]+) -->', html)
    if not origin or origin[1] not in SETS:
        raise ValueError(f'Unknown source: {path.name}')
    identifier, title = SETS[origin[1]]
    arrays = {}
    for name in ('view', 'input', 'advance'):
        matches = re.findall(r'\b' + name + r'_base\s*=\s*new Array\(([^;]*)\);', html)
        if len(matches) != 1:
            raise ValueError(f'Missing or duplicate {name}_base in {path.name}')
        arrays[name] = json.loads('[' + matches[0] + ']')
    duration = re.search(r'\bvar playtime\s*=\s*(\d+)\s*;', html)
    if not duration or int(duration[1]) != 60:
        raise ValueError('Expected 60-second trainer')
    return {'id': identifier, 'title': title, 'durationMs': 60000,
            'source': {'file': unicodedata.normalize('NFC', path.name), 'url': origin[1],
                       'sha256': hashlib.sha256(raw).hexdigest(), 'encoding': 'cp932'},
            **arrays}


def align(text, reading, advance):
    # Each non-'>' marker completes one displayed character. The preceding '>'
    # markers belong to that same character's reading (as in source setAdvancePos).
    if len(advance) != len(reading) or len(advance.replace('>', '')) != len(text):
        raise ValueError(f'Invalid source alignment: {text}')
    segments = []
    start = 0
    index = 0
    for end, marker in enumerate(advance, 1):
        if marker == '>':
            continue
        character = text[index]
        value = reading[start:end]
        kanji = bool(re.fullmatch(r'[一-龯々]', character))
        if not kanji:
            normalized = unicodedata.normalize('NFKC', character)
            normalized = ''.join(chr(ord(c) - 0x60) if 'ァ' <= c <= 'ヶ' else c for c in normalized)
            if normalized != value:
                raise ValueError(f'Literal alignment mismatch: {character} / {value}')
        if kanji and segments and re.fullmatch(r'[一-龯々]+', segments[-1][0]):
            segments[-1][0] += character
            segments[-1][1] += value
        else:
            segments.append([character, value])
        start = end
        index += 1
    if start != len(reading):
        raise ValueError(f'Unfinished reading: {text}')
    return segments


def build(snapshot):
    if snapshot['id'] == 'sakusaku-trainer':
        rows = []
        for text, reading, groups in snapshot['entries']:
            kanji = iter(groups.split('/') if groups else [])
            segments = []
            for part in re.findall(r'[一-龯々]+|.', text):
                kana = (next(kanji, '') if re.match(r'[一-龯々]', part) else
                        ''.join(chr(ord(c)-0x60) if 'ァ' <= c <= 'ヶ' else c for c in part))
                if not kana:
                    raise ValueError('Missing sakusaku reading: '+part)
                segments.append([part, kana])
            if ''.join(s[1] for s in segments) != reading or next(kanji, None) is not None:
                raise ValueError('Sakusaku reading mismatch: '+text)
            rows.append([text, reading, segments])
        return {k: v for k, v in snapshot.items() if k != 'entries'} | {'entries': rows}
    arrays = [snapshot[name] for name in ('view', 'input', 'advance')]
    if len({len(a) for a in arrays}) != 1 or not arrays[0]:
        raise ValueError('Mismatched or empty source arrays')
    if any(a[-1] != '' or any(not isinstance(s, str) or not s for s in a[:-1]) for a in arrays):
        raise ValueError('Expected exactly one trailing empty sentinel per array')
    return {k: v for k, v in snapshot.items() if k not in ('view', 'input', 'advance')} | {
        'entries': [[text, reading, align(text, reading, advance)]
                    for text, reading, advance in zip(*(a[:-1] for a in arrays))]}


def main():
    if sys.argv[1:]:
        snapshots = [extract(Path(p)) for p in sys.argv[1:]]
        # Validate before writing snapshots, so malformed inputs cannot replace data.
        for snapshot in snapshots:
            build(snapshot)
        SOURCES.mkdir(parents=True, exist_ok=True)
        for snapshot in snapshots:
            (SOURCES / (snapshot['id'] + '.json')).write_text(json.dumps(snapshot, ensure_ascii=False, indent=2) + '\n')
    snapshots = [json.loads(p.read_text()) for p in sorted(SOURCES.glob('*.json'))]
    if {s['id'] for s in snapshots} != ({s[0] for s in SETS.values()} | {'sakusaku-trainer'}):
        raise ValueError('All three trainer source snapshots are required')
    data = [build(s) for s in snapshots]
    generated_path('trainers.json').write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n')
    for item in data:
        print(item['title'], len(item['entries']), item['durationMs'], 'ms')


if __name__ == '__main__':
    main()
