"""Build continuous original passages from the supplied text and explicit readings.

Only Python's standard library is required; tokenizers are not used at rebuild time.
"""
from pathlib import Path
import hashlib
import json
import re
from data_paths import generated_path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'data/sources/original-long'
TOKEN = re.compile(r'〈([^|〈〉]+)\|([^〈〉]+)〉|([^〈〉]+)')
KANJI = re.compile(r'[一-龯々〇]')


def normalize(text):
    return ''.join(chr(ord(c) - 0x60) if 'ァ' <= c <= 'ヶ' else c for c in text)


def parse_annotation(annotated):
    segments = []
    cursor = 0
    for match in TOKEN.finditer(annotated):
        if match.start() != cursor:
            raise ValueError('Malformed reading annotation')
        cursor = match.end()
        if match[1]:
            if not re.fullmatch(r'[ぁ-ゖー]+', match[2]):
                raise ValueError('Invalid annotated reading')
            segments.append({'text': match[1], 'reading': match[2]})
        else:
            if KANJI.search(match[3]):
                raise ValueError('Missing kanji reading')
            for char in match[3]:
                reading = normalize(char)
                if not re.fullmatch(r'[ぁ-ゖー、。・「」！？ ]', reading):
                    raise ValueError('Unsupported literal: ' + char)
                segments.append({'text': char, 'reading': reading})
    if cursor != len(annotated) or not segments:
        raise ValueError('Incomplete reading annotation')
    return segments


def build(source_bytes, annotations):
    digest = hashlib.sha256(source_bytes).hexdigest()
    if digest != annotations['sourceSha256']:
        raise ValueError('Original source SHA-256 mismatch')
    source = json.loads(source_bytes)
    originals = source['passages']
    readings = annotations['passages']
    if len({p['id'] for p in originals}) != len(originals):
        raise ValueError('Duplicate source ID')
    if [p['id'] for p in originals] != [p['id'] for p in readings]:
        raise ValueError('Reading IDs/order do not match original')
    result = []
    for original, annotation in zip(originals, readings):
        segments = parse_annotation(''.join(annotation['annotated']))
        if ''.join(s['text'] for s in segments) != original['text']:
            raise ValueError('Text mismatch: ' + original['id'])
        if len(original['text']) != original['charCount']:
            raise ValueError('Character count mismatch: ' + original['id'])
        result.append({**original, 'reading': ''.join(s['reading'] for s in segments), 'segments': segments})
    return {'version': 1, 'sourceFile': annotations['sourceFile'], 'sourceSha256': digest, 'passages': result}


def main():
    annotations = json.loads((SOURCE / 'readings.json').read_text())
    result = build((SOURCE / 'typing_long_passages_21.json').read_bytes(), annotations)
    generated_path('originalLong.json').write_text(json.dumps(result, ensure_ascii=False, separators=(',', ':')) + '\n')
    print('Original long passages:', len(result['passages']), 'complete texts; no sentence splitting')


if __name__ == '__main__':
    main()
