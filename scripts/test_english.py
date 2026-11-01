from pathlib import Path
import hashlib
import importlib.util
import json
import unittest
import xml.etree.ElementTree as ET
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('english_import', ROOT / 'scripts/import-english.py')
importer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(importer)


class EnglishImportTest(unittest.TestCase):
    def test_archive_provenance_and_latest_title_deduplication(self):
        manifest = json.loads((ROOT / 'data/sources/english/manifest.json').read_text())
        self.assertEqual(hashlib.sha256(importer.SOURCE.read_bytes()).hexdigest(), manifest['sha256'])
        sets = importer.import_archive()
        self.assertEqual(len(sets), 23)
        self.assertEqual(len([s for s in sets if s['kind'] == 'etyping']), 19)
        self.assertEqual(sorted(a['round'] for s in sets if s['kind'] == 'etyping' for a in [s['source'], *s['aliases']]), list(range(1, 39)))
        for item in sets:
            if item['kind'] == 'etyping':
                self.assertGreaterEqual(item['source']['round'], max([a['round'] for a in item['aliases']], default=0))

    def test_every_runtime_string_matches_the_chosen_xml_without_case_or_punctuation_changes(self):
        with ZipFile(importer.SOURCE) as archive:
            files = {e.filename.encode('cp437').decode('cp932'): e for e in archive.infolist()}
            for item in importer.import_archive():
                raw = archive.read(files[item['source']['file']])
                self.assertEqual(hashlib.sha256(raw).hexdigest(), item['source']['sha256'])
                original = [word.get('roman') for word in ET.fromstring(raw).findall('Word')]
                self.assertEqual(item['entries'], list(dict.fromkeys(original)))
                self.assertEqual(len(item['entries']), len(set(item['entries'])))
        self.assertEqual(importer.import_archive(), json.loads((ROOT / 'src/data/generated/english.json').read_text()))


if __name__ == '__main__':
    unittest.main()
