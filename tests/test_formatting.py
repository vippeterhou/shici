from poetry.formatting import analyze_poem_format
from poetry.models import PoemFormat
from scripts.enrich_format import serialize_records


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
