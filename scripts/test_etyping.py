"""Audit annual coverage, source fidelity and kana boundaries without network/NLP deps."""
from pathlib import Path
from unittest.mock import patch
import contextlib
import hashlib
import io
import json
import runpy
import shutil
import sys
import tempfile
from types import SimpleNamespace
import unittest
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
SOURCES = ROOT / 'data/sources/etyping'
FETCH = runpy.run_path(str(ROOT / 'scripts/fetch-etyping-year.py'))


class EtypingYearTest(unittest.TestCase):
    def test_latest_52_rounds_resolve_to_26_unique_canonical_titles(self):
        catalog = json.loads((SOURCES / 'weekly-catalog.json').read_text())
        raw = (SOURCES / catalog['index_file']).read_bytes()
        self.assertEqual(hashlib.sha256(raw).hexdigest(), catalog['index_sha256'])
        weeks = FETCH['latest_weeks'](raw.decode())
        self.assertEqual([w['round'] for w in weeks], list(range(1332, 1280, -1)))
        self.assertEqual([{k: w[k] for k in ('round', 'title', 'url')} for w in catalog['weeks']], weeks)
        canonical = {s['title']: s for s in catalog['sets']}
        self.assertEqual(len(canonical), 26)
        self.assertEqual(sum(not s['existing'] for s in canonical.values()), 20)
        self.assertEqual(len({s['id'] for s in canonical.values()}), 26)
        for week in catalog['weeks']:
            source = canonical[week['title']]
            self.assertEqual(week['set_id'], source['id'])
            self.assertEqual(week['canonical_file'], source['file'])
            raw = (SOURCES / source['file']).read_bytes()
            self.assertEqual(FETCH['clean_title'](ET.fromstring(raw).findtext('Name')), week['title'])
            if not source['existing']:
                self.assertEqual(hashlib.sha256(raw).hexdigest(), source['xml_sha256'])
                self.assertEqual(len(source['archive_sha256']), 64)

    def test_missing_week_is_rejected_and_repeated_title_is_retained_in_coverage(self):
        raw = (SOURCES / 'weekly-index.html').read_text()
        self.assertRaises(ValueError, FETCH['latest_weeks'], raw.replace('1331回', '1332回'))
        self.assertRaises(ValueError, FETCH['latest_weeks'], '<table></table>')
        self.assertEqual(FETCH['clean_title']('春の言葉（1301回）'), '春の言葉')
        self.assertEqual(FETCH['clean_title']('春の言葉(1301回)'), '春の言葉')

    def test_every_generated_pair_retains_original_xml_order_and_receipt(self):
        generated = json.loads((ROOT / 'src/data/generated/etyping.json').read_text())
        self.assertEqual(sum(len(s['entries']) for s in generated), 5687)
        self.assertEqual(len({s['title'] for s in generated}), len(generated))
        annotations = json.loads((SOURCES / 'word-segmentation.json').read_text())
        self.assertEqual(len(annotations['entries']), 5341)
        for corpus in generated:
            for receipt in corpus['sources']:
                raw = (SOURCES / receipt['file']).read_bytes()
                digest = hashlib.sha256(raw).hexdigest()
                self.assertEqual(digest, receipt['sha256'])
                self.assertEqual(digest, annotations['metadata']['sources_sha256'][receipt['file']])
                pairs = [[w.findtext('Display'), w.findtext('Characters')] for w in ET.fromstring(raw).findall('.//Word')]
                self.assertEqual(pairs, [row[:2] for row in corpus['entries']])
                self.assertEqual(len(pairs), receipt['count'])

    def test_authoring_rejects_ambiguous_tail_even_after_matching_dictionary_prefix(self):
        # No NLP package is needed to test the alignment algorithm. These fake
        # morphemes model the rendaku ambiguity after the trusted 月/見 prefix.
        with patch.dict(sys.modules, sudachipy=SimpleNamespace(dictionary=None)):
            author = runpy.run_path(str(ROOT / 'scripts/segment-etyping.py'))
        class Morpheme:
            def __init__(self, surface, reading):
                self._surface, self._reading = surface, reading
            def surface(self):
                return self._surface
            def reading_form(self):
                return self._reading
        tokenizer = SimpleNamespace(tokenize=lambda text: [Morpheme(s, r) for s, r in [('月', 'ツキ'), ('見', 'ミ'), ('一', 'イチ'), ('杯', 'バイ')]])
        with self.assertRaisesRegex(ValueError, 'Review word reading'):
            author['annotate']('月見一杯', 'つきみいっぱい', tokenizer)

    def test_refresh_reuses_existing_snapshots_without_redownloading_same_titles(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory)
            for path in SOURCES.glob('*.xml'):
                shutil.copy(path, target)
            shutil.copy(SOURCES / 'weekly-catalog.json', target)
            before = {p.name: p.read_bytes() for p in target.glob('*.xml')}
            main = FETCH['main']
            with patch.dict(main.__globals__, SOURCES=target), patch.object(sys, 'argv', ['fetch-etyping-year.py', '--index', str(SOURCES / 'weekly-index.html')]), patch.dict(main.__globals__, download=lambda url: self.fail(f'Unexpected download: {url}')), contextlib.redirect_stdout(io.StringIO()):
                main()
            self.assertEqual(before, {p.name: p.read_bytes() for p in target.glob('*.xml')})
            self.assertEqual(len(json.loads((target / 'weekly-catalog.json').read_text())['sets']), 26)


if __name__ == '__main__':
    unittest.main()
