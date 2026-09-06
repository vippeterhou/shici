from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

from poetry.formatting import analyze_poem_format

_SENTENCE_LENGTHS_BLOCK = re.compile(
    r'("sentence_lengths": \[)\s*([\d,\s]*?)\s*(\])'
)


def serialize_records(records: list[dict[str, object]]) -> str:
    formatted = json.dumps(records, ensure_ascii=False, indent=2)

    def compact_lengths(match: re.Match[str]) -> str:
        lengths = re.findall(r"\d+", match.group(2))
        return f'{match.group(1)}{", ".join(lengths)}{match.group(3)}'

    return _SENTENCE_LENGTHS_BLOCK.sub(compact_lengths, formatted) + "\n"


def enrich_file(path: Path) -> None:
    records = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(records, list):
        raise ValueError("Poetry data must be a top-level JSON array")

    for record in records:
        paragraphs = record.get("paragraphs")
        if not isinstance(paragraphs, list) or not all(
            isinstance(paragraph, str) for paragraph in paragraphs
        ):
            raise ValueError(f"Invalid paragraphs for poem {record.get('id')}")
        record["format"] = analyze_poem_format(paragraphs).to_dict()

    path.write_text(serialize_records(records), encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("path", type=Path)
    args = parser.parse_args()
    enrich_file(args.path)


if __name__ == "__main__":
    main()
