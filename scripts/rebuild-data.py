"""Regenerate runtime JSON offline, or check it without modifying tracked files.

python3 scripts/rebuild-data.py [--check]
"""
import argparse
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]


def rebuild(output):
    env = {**os.environ, 'GALACTYPE_DATA_OUTPUT': str(output)}
    for name in ('rtc', 'etyping', 'trainers', 'constitution'):
        subprocess.run([sys.executable, str(ROOT / f'scripts/import-{name}.py')],
                       cwd=ROOT, env=env, check=True)
    for source in ('typewell/typewell.json', 'space/spaceCatalogue.json'):
        shutil.copyfile(ROOT / 'data/sources' / source, output / Path(source).name)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='compare only; never rewrite generated files')
    parser.add_argument('--output', type=Path, default=ROOT / 'src/data/generated', help='runtime JSON directory')
    args = parser.parse_args()
    with tempfile.TemporaryDirectory(prefix='galactype-data-') as directory:
        output = Path(directory)
        rebuild(output)
        expected = {p.name for p in output.iterdir()}
        existing = {p.name for p in args.output.iterdir()} if args.output.exists() else set()
        if args.check:
            differences = sorted((expected ^ existing) | {
                name for name in expected & existing
                if not (args.output / name).is_file() or
                (args.output / name).read_bytes() != (output / name).read_bytes()
            })
            if differences:
                print('Generated data differs: ' + ', '.join(differences), file=sys.stderr)
                print('Run python3 scripts/rebuild-data.py', file=sys.stderr)
                if existing - expected:
                    print('Remove unexpected files from the output directory.', file=sys.stderr)
                return 1
            print(f'All {len(expected)} generated JSON files are up to date.')
        else:
            # No tracked output is changed until every importer has succeeded.
            args.output.mkdir(parents=True, exist_ok=True)
            for name in sorted(expected):
                shutil.copyfile(output / name, args.output / name)
            print(f'Rebuilt {len(expected)} JSON files in {args.output}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
