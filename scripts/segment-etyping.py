"""Author the pinned Japanese word/reading snapshot (not needed by rebuild/CI).

uv run --python 3.12 --with sudachipy==0.7.0 --with sudachidict_core==20261015 python scripts/segment-etyping.py
XML Characters are authoritative. Dictionary readings only locate boundaries when
they match those characters; ambiguous unmatched alignments require review.
"""
from functools import lru_cache
from importlib.metadata import version
from pathlib import Path
import hashlib
import json
import re
import runpy
import xml.etree.ElementTree as ET
from sudachipy import dictionary

ROOT = Path(__file__).resolve().parents[1]
SOURCES = ROOT / 'data/sources/etyping'
IMPORTER = runpy.run_path(str(ROOT / 'scripts/import-etyping.py'))
normalize = IMPORTER['normalize']
align = IMPORTER['align']
OVERRIDES = json.loads((SOURCES / 'reviewed-readings.json').read_text())['word_overrides']
# Reviewed product names and expressive kana that dictionary tokenizers fragment.
PROTECTED = sorted([
    'ぴよりん', 'みたらしだんご', 'ねるねるねるね', 'さくふわ', 'とろふわ',
    'ふわもち', 'ふわっふわ', 'ぷにぷに', 'ぷるぷる', 'ぷるるん', 'ほわほわ',
    'じゅわっと', 'さっくり', 'もっちり', 'すっぱうまい', 'のびーる',
    'さつまりこ', 'たこせん', 'なげわ', 'まけんグミ', 'ごほうび',
    '噛みごたえ', 'やみつき', 'わらびーもち', 'いしやーきいもー', 'いしやーきーいもー',
], key=lambda word: (-len(word), word))


def words_for(text, tokenizer):
    words = []
    for item in tokenizer.tokenize(text):
        word = item.surface()
        if words and re.match(r'[ぁぃぅぇぉゃゅょゎっァィゥェォャュョヮッー々]', word):
            words[-1][0] += word
            words[-1][1] += normalize(item.reading_form())
        else:
            words.append([word, normalize(item.reading_form())])
    # Protected ranges can cross several morphemes; retain every surface character.
    ranges = []
    for word in PROTECTED:
        for match in re.finditer(re.escape(word), text):
            if not any(match.start() < end and start < match.end() for start, end in ranges):
                ranges.append((match.start(), match.end()))
    result = []
    offset = 0
    for surface, reading in words:
        if result and any(start < offset < end for start, end in ranges):
            result[-1][0] += surface
            result[-1][1] += reading
        else:
            result.append([surface, reading])
        offset += len(surface)
    if ''.join(word[0] for word in result) != text:
        raise ValueError(f'Tokenizer changed the surface: {text}')
    return result


def annotate(text, reading, tokenizer):
    original = align(text, reading)
    offsets = {0: 0}
    text_offset = reading_offset = 0
    for surface, kana in original:
        text_offset += len(surface)
        reading_offset += len(kana)
        offsets[text_offset] = reading_offset
    words = words_for(text, tokenizer)
    bounds = [0]
    for surface, _ in words:
        bounds.append(bounds[-1] + len(surface))

    @lru_cache(None)
    def find(index, position):
        if index == len(words):
            return [()] if position == len(reading) else []
        if bounds[index] in offsets and position != offsets[bounds[index]]:
            return []
        surface, hint = words[index]
        target_end = offsets.get(bounds[index + 1])
        if target_end is not None:
            ends = [target_end]
        elif not re.search(r'[一-龯々]', surface):
            literal = normalize(surface).replace('・', '/')
            ends = [position + len(literal)] if reading.startswith(literal, position) else []
        else:
            ends = list(range(position + 1, len(reading) + 1))
        preferred = position + len(hint)
        if reading.startswith(hint, position) and preferred in ends:
            matched = find(index + 1, preferred)
            if matched:
                return [(reading[position:preferred],) + tail for tail in matched]
        solutions = []
        for end in ends:
            if end < position:
                continue
            for tail in find(index + 1, end):
                solutions.append((reading[position:end],) + tail)
                if len(solutions) == 2:
                    return solutions
        return solutions

    solutions = [tuple(kana for _, kana in OVERRIDES[text])] if text in OVERRIDES else find(0, 0)
    if text in OVERRIDES:
        words = OVERRIDES[text]
    if len(solutions) != 1:
        raise ValueError(f'Review word reading: {text} / {reading} / {words}')
    segments = []
    starts = []
    offset = 0
    for (surface, _), kana in zip(words, solutions[0]):
        if re.search(r'[\w一-龯々ぁ-ヿ]', surface) and offset:
            starts.append(offset)
        segments.extend(align(surface, kana))
        offset += len(surface)
    if ''.join(t for t, _ in segments) != text or ''.join(r for _, r in segments) != reading:
        raise ValueError(f'Reading mismatch: {text}')
    return [text, reading, segments, starts]


def main():
    if version('sudachipy') != '0.7.0' or version('sudachidict_core') != '20261015':
        raise ValueError('Use the pinned authoring dependencies in this script header')
    tokenizer = dictionary.Dictionary().tokenizer(mode='C')
    records = {}
    errors = []
    sources = {}
    for path in sorted(SOURCES.glob('*.xml')):
        raw = path.read_bytes()
        sources[path.name] = hashlib.sha256(raw).hexdigest()
        for word in ET.fromstring(raw).findall('.//Word'):
            pair = (word.findtext('Display'), word.findtext('Characters'))
            if pair in records:
                continue
            try:
                records[pair] = annotate(*pair, tokenizer)
            except ValueError as error:
                errors.append(str(error))
    if errors:
        for error in dict.fromkeys(errors):
            print(error)
        raise ValueError(f'{len(errors)} unresolved annotations; no snapshot written')
    metadata = {'tokenizer': 'SudachiPy 0.7.0 / SudachiDict core 20261015 / mode C',
                'protected_words': PROTECTED, 'sources_sha256': sources,
                'reviewed_readings_sha256': hashlib.sha256((SOURCES / 'reviewed-readings.json').read_bytes()).hexdigest()}
    lines = ['{"metadata":' + json.dumps(metadata, ensure_ascii=False, separators=(',', ':')) + ',"entries":[']
    lines += [json.dumps(row, ensure_ascii=False, separators=(',', ':')) + (',' if index < len(records) - 1 else '')
              for index, row in enumerate(records.values())]
    lines.append(']}')
    (SOURCES / 'word-segmentation.json').write_text('\n'.join(lines) + '\n')
    print(f'Wrote {len(records)} unique word/reading annotations')


if __name__ == '__main__':
    main()
