"""Regenerate runtime JSON offline, or check it without modifying tracked files.

python3 scripts/rebuild-data.py [--check]
"""
import argparse
import os
from pathlib import Path
import runpy
import shutil
import subprocess
import sys
import tempfile
from data_paths import rtc_sources_dir

ROOT = Path(__file__).resolve().parents[1]


def rebuild(output, rtc_sources, require_rtc_sources):
    env = {**os.environ, 'GALACTYPE_DATA_OUTPUT': str(output),
           'GALACTYPE_RTC_SOURCES': str(rtc_sources)}
    archives = runpy.run_path(str(ROOT / 'scripts/import-rtc.py'))['FILES']
    missing = [name for name in archives if not (rtc_sources / name).is_file()]
    if missing:
        if require_rtc_sources:
            raise ValueError('Missing RTC originals: ' + ', '.join(missing))
        shutil.copyfile(ROOT / 'src/data/generated/rtc.json', output / 'rtc.json')
        print('RTC: keeping registered rtc.json; original ZIP comparison skipped. Missing: ' + ', '.join(missing))
    else:
        subprocess.run([sys.executable, str(ROOT / 'scripts/import-rtc.py')],
                       cwd=ROOT, env=env, check=True)
    for name in ('etyping', 'trainers', 'constitution', 'original-long'):
        subprocess.run([sys.executable, str(ROOT / f'scripts/import-{name}.py')],
                       cwd=ROOT, env=env, check=True)
    for source in ('typewell/typewell.json', 'space/spaceCatalogue.json'):
        shutil.copyfile(ROOT / 'data/sources' / source, output / Path(source).name)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='compare only; never rewrite generated files')
    parser.add_argument('--output', type=Path, default=ROOT / 'src/data/generated', help='runtime JSON directory')
    parser.add_argument('--rtc-sources', type=Path, default=rtc_sources_dir(), help='directory containing local RTC ZIP originals')
    parser.add_argument('--require-rtc-sources', action='store_true', help='fail if any RTC original is missing instead of retaining registered rtc.json')
    args = parser.parse_args()
    with tempfile.TemporaryDirectory(prefix='galactype-data-') as directory:
        output = Path(directory)
        try:
            rebuild(output, args.rtc_sources.resolve(), args.require_rtc_sources)
        except ValueError as error:
            print(error, file=sys.stderr)
            return 1
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
            print(f'All {len(expected)} JSON files match the available sources / retained RTC data.')
        else:
            # No tracked output is changed until every importer has succeeded.
            args.output.mkdir(parents=True, exist_ok=True)
            for name in sorted(expected):
                shutil.copyfile(output / name, args.output / name)
            print(f'Rebuilt {len(expected)} JSON files in {args.output}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
