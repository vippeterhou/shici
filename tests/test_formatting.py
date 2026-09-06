import json

from poetry.formatting import analyze_poem_format
from poetry.models import PoemFormat
from scripts.enrich_format import enrich_path, json_indent, serialize_records


def test_analyzes_uniform_five_character_poem() -> None:
    result = analyze_poem_format(
        (
            "白日依山盡，黃河入海流。",
            "欲窮千里目，更上一層樓。",
        )
    )

    assert result == PoemFormat(
        sentence_count=4,
        sentence_lengths=(5, 5, 5, 5),
        uniform_sentence_length=5,
    )


def test_analyzes_mixed_length_poem() -> None:
    result = analyze_poem_format(("岑夫子，丹丘生，將進酒，君莫停。",))

    assert result.sentence_count == 4
    assert result.sentence_lengths == (3, 3, 3, 3)
    assert result.uniform_sentence_length == 3


def test_non_han_content_is_not_counted() -> None:
    result = analyze_poem_format(("明 月，ABC 123。〇！",))

    assert result.sentence_lengths == (2, 1)
    assert result.uniform_sentence_length is None


def test_serializes_sentence_lengths_on_one_line() -> None:
    output = serialize_records(
        [
            {
                "format": {
                    "sentence_count": 4,
                    "sentence_lengths": [5, 5, 5, 5],
                    "uniform_sentence_length": 5,
                }
            }
        ]
    )

    assert '"sentence_lengths": [5, 5, 5, 5]' in output


def test_detects_and_preserves_source_indentation() -> None:
    source = '[\n    {\n        "title": "詩"\n    }\n]\n'

    assert json_indent(source) == 4
    output = serialize_records([{"title": "詩"}], indent=json_indent(source))
    assert '\n    {\n        "title": "詩"\n    }\n' in output


def test_enriches_all_json_files_in_directory(tmp_path) -> None:
    record = {
        "title": "登鸛雀樓",
        "author": "王之渙",
        "paragraphs": ["白日依山盡，黃河入海流。"],
    }
    for file_name in ("001.json", "002.json"):
        (tmp_path / file_name).write_text(
            json.dumps([record], ensure_ascii=False),
            encoding="utf-8",
        )

    assert enrich_path(tmp_path) == 2
    enriched = json.loads((tmp_path / "001.json").read_text(encoding="utf-8"))
    assert enriched[0]["format"] == {
        "sentence_count": 2,
        "sentence_lengths": [5, 5],
        "uniform_sentence_length": 5,
    }
