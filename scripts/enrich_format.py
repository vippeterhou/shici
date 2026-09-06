from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

from poetry.formatting import analyze_poem_format

_SENTENCE_LENGTHS_BLOCK = re.compile(
    r'("sentence_lengths": \[)\s*([\d,\s]*?)\s*(\])'
)


def json_indent(source: str) -> int:
    match = re.search(r"^\[\r?\n( +)\{", source)
    return len(match.group(1)) if match else 2


def serialize_records(
    records: list[dict[str, object]],
    *,
    indent: int = 2,
) -> str:
    formatted = json.dumps(records, ensure_ascii=False, indent=indent)

    def compact_lengths(match: re.Match[str]) -> str:
        lengths = re.findall(r"\d+", match.group(2))
        return f'{match.group(1)}{", ".join(lengths)}{match.group(3)}'

    return _SENTENCE_LENGTHS_BLOCK.sub(compact_lengths, formatted) + "\n"


def enrich_file(path: Path) -> None:
    source = path.read_text(encoding="utf-8")
    records = json.loads(source)
    if not isinstance(records, list):
        raise ValueError("Poetry data must be a top-level JSON array")

    for record in records:
        paragraphs = record.get("paragraphs")
        if not isinstance(paragraphs, list) or not all(
            isinstance(paragraph, str) for paragraph in paragraphs
        ):
            raise ValueError(f"Invalid paragraphs for poem {record.get('id')}")
        record["format"] = analyze_poem_format(paragraphs).to_dict()

    path.write_text(
        serialize_records(records, indent=json_indent(source)),
        encoding="utf-8",
    )


def enrich_path(path: Path) -> int:
    if path.is_file():
        enrich_file(path)
        return 1
    if not path.is_dir():
        raise ValueError(f"Poetry data path does not exist: {path}")

    files = sorted(path.glob("*.json"))
    if not files:
        raise ValueError(f"No JSON files found in: {path}")
    for file_path in files:
        enrich_file(file_path)
    return len(files)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("path", type=Path)
    args = parser.parse_args()
    file_count = enrich_path(args.path)
    print(f"Enriched {file_count} JSON file(s)")


if __name__ == "__main__":
    main()
