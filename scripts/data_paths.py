"""Shared output location; an override keeps regeneration checks isolated."""
from pathlib import Path
import os

ROOT = Path(__file__).resolve().parents[1]


def generated_path(name):
    directory = Path(os.environ.get('GALACTYPE_DATA_OUTPUT', ROOT / 'src/data/generated'))
    directory.mkdir(parents=True, exist_ok=True)
    return directory / name
