"""Import supplied Words XML, retaining exact Display/Characters pairs and source order.

Usage: python3 scripts/import-etyping.py path/to/*.xml
With no paths, rebuild from the bundled source snapshots.
Only identical same-title sets are deduplicated; differing sets fail explicitly.
"""
from functools import lru_cache
from pathlib import Path
from data_paths import generated_path
import hashlib
import json
import re
import sys
import unicodedata
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
SOURCES = ROOT / 'data/sources/etyping'
IDS = {'バレンタイン': 'valentine', '元気が出る言葉': 'encouragement',
       '春の言葉': 'spring', '思い出の言葉': 'memories', '顔の慣用句': 'face-idioms', '擬音・擬態語': 'onomatopoeia'}

# Reviewed ambiguities: kana anchors also occur inside these kanji readings.
REVIEWED = {
    '思わず目頭が熱くなった': 'おも/めがしら/あつ',
    '固く口を閉ざしたままだ': 'かた/くち/と',
    '可愛い姿に頬がゆるむ': 'かわい/すがた/ほお',
    '空元気も本物になる': 'からげんき/ほんもの',
    '君には無限の可能性がある': 'きみ/むげん/かのうせい',
    '失敗は恥じゃない': 'しっぱい/はじ',
    '自分でやらずに他人に頼るな': 'じぶん/たにん/たよ',
    '自分の可能性を信じよう': 'じぶん/かのうせい/しん',
    '少しだけ余計に毎日続けよう': 'すこ/よけい/まいにちつづ',
    '苦手が得意に変わると強い': 'にがて/とくい/か/つよ',
    '人は可能性の生き物': 'ひと/かのうせい/い/もの',
    'あなたの笑顔が好きだから': 'えがお/す',
    '今こそが受験の天王山だ': 'いま/じゅけん/てんのうざん',
    '困難な時期は最良の時期': 'こんなん/じき/さいりょう/じき',
    'ようやく笑顔が戻ったね': 'えがお/もど',
    '草餅も好きだけど、桜餅も好き': 'くさもち/す/さくらもち/す',
    '笑顔が好きです': 'えがお/す',
    'チョコより君の笑顔が欲しい': 'きみ/えがお/ほ',
}


def normalize(text):
    return ''.join(chr(ord(c) - 0x60) if 'ァ' <= c <= 'ヶ' else c
                   for c in unicodedata.normalize('NFKC', text))


def align(text, reading):
    parts = re.findall(r'[一-龯々]+|.', text)

    reviewed = iter(REVIEWED.get(text, '').split('/'))
    fixed = {i: next(reviewed) for i, part in enumerate(parts) if text in REVIEWED and re.match(r'[一-龯々]', part)}

    @lru_cache(None)
    def find(i, offset):
        if i == len(parts):
            return [()] if offset == len(reading) else []
        part = parts[i]
        if re.match(r'[一-龯々]', part):
            choices = ([offset + len(fixed[i])] if reading.startswith(fixed[i], offset) else []) if i in fixed else range(offset + 1, len(reading) + 1)
        else:
            literal = '/' if part == '・' else normalize(part)
            choices = [offset + len(literal)] if reading.startswith(literal, offset) else []
        found = []
        for end in choices:
            for rest in find(i + 1, end):
                found.append(((part, reading[offset:end]),) + rest)
                if len(found) == 2:
                    return found
        return found
    solutions = find(0, 0)
    if not solutions:
        raise ValueError(f'Cannot align {text!r} / {reading!r}')
    if len(solutions) > 1:
        raise ValueError(f'Review ambiguous reading: {text!r}')
    return solutions[0]


def main():
    paths = list(map(Path, sys.argv[1:])) or sorted(SOURCES.glob('*.xml'))
    result = {}
    for path in paths:
        raw = path.read_bytes()
        root = ET.fromstring(raw)
        title = re.sub(r'\(\d+回\)$', '', root.findtext('Name', '')).strip()
        identifier = IDS[title]
        pairs = [(w.findtext('Display'), w.findtext('Characters')) for w in root.findall('.//Word')]
        if not pairs or any(not t or not r for t, r in pairs):
            raise ValueError(f'Empty word in {path}')
        source = {'file': path.name, 'sha256': hashlib.sha256(raw).hexdigest(), 'count': len(pairs)}
        if identifier in result:
            if pairs != [(r[0], r[1]) for r in result[identifier]['entries']]:
                raise ValueError(f'Different data for same title: {title}')
            result[identifier]['sources'].append(source)
            continue
        rows = [[text, reading, align(text, reading)] for text, reading in pairs]
        result[identifier] = {'id': 'etyping-' + identifier, 'title': title, 'sources': [source], 'entries': rows}
    output = generated_path('etyping.json')
    output.write_text(json.dumps(list(result.values()), ensure_ascii=False, separators=(',', ':')) + '\n')
    for data in result.values():
        print(data['title'], len(data['entries']), 'sources:', len(data['sources']))


if __name__ == '__main__':
    main()
