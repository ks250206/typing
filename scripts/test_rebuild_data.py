"""Verify deterministic offline regeneration and the read-only CI check."""
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
GENERATED = ROOT / 'src/data/generated'


def files(directory):
    return {p.name: p.read_bytes() for p in directory.iterdir()}


def run(*args):
    return subprocess.run([sys.executable, str(ROOT / 'scripts/rebuild-data.py'), *args],
                          cwd=ROOT, capture_output=True, text=True)


class RebuildDataTest(unittest.TestCase):
    def test_checked_in_json_matches_offline_regeneration(self):
        before = files(GENERATED)
        result = run('--check')
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual(before, files(GENERATED))

    def test_check_reports_stale_missing_and_unexpected_files_without_writing(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory)
            shutil.copytree(GENERATED, output, dirs_exist_ok=True)
            (output / 'trainers.json').write_text('[]\n')
            (output / 'rtc.json').unlink()
            (output / 'unexpected.json').write_text('{}\n')
            before = files(output)
            result = run('--check', '--output', str(output))
            self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
            for name in ('trainers.json', 'rtc.json', 'unexpected.json'):
                self.assertIn(name, result.stderr)
            self.assertEqual(before, files(output))

    def test_fresh_output_is_byte_identical_and_ignores_working_directory(self):
        with tempfile.TemporaryDirectory() as directory:
            result = subprocess.run(
                [sys.executable, str(ROOT / 'scripts/rebuild-data.py'), '--output', directory],
                cwd=directory, capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            self.assertEqual(files(GENERATED), files(Path(directory)))


if __name__ == '__main__':
    unittest.main()
