"""Reject stale originals and mismatched explicit reading annotations."""
import copy
import importlib.util
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('original_long', ROOT / 'scripts/import-original-long.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
SOURCE = ROOT / 'data/sources/original-long'


class OriginalLongTest(unittest.TestCase):
    def setUp(self):
        self.raw = (SOURCE / 'typing_long_passages_21.json').read_bytes()
        self.readings = json.loads((SOURCE / 'readings.json').read_text())

    def test_source_and_generated_data_match(self):
        result = module.build(self.raw, self.readings)
        self.assertEqual(result, json.loads((ROOT / 'src/data/generated/originalLong.json').read_text()))
        self.assertEqual(len(result['passages']), 21)

    def test_stale_source_and_missing_reading_are_rejected(self):
        with self.assertRaisesRegex(ValueError, 'SHA-256'):
            module.build(self.raw + b' ', self.readings)
        for malformed in ('〈研究|けんきゅう', '研究', '〈研究|abc〉', ''):
            with self.subTest(malformed=malformed), self.assertRaises(ValueError):
                module.parse_annotation(malformed)

    def test_text_and_id_changes_are_rejected(self):
        changed = copy.deepcopy(self.readings)
        changed['passages'][0]['annotated'][0] += '。'
        with self.assertRaisesRegex(ValueError, 'Text mismatch'):
            module.build(self.raw, changed)
        changed['passages'].reverse()
        with self.assertRaisesRegex(ValueError, 'IDs/order'):
            module.build(self.raw, changed)
