from poetry.analytics import filter_poems, poem_text
from poetry.models import Poem, PoemFormat
from poetry.search import normalize_search_text


def test_normalizes_traditional_text_for_search() -> None:
    assert (
        normalize_search_text("白日依山盡，黃河入海流。")
        == "白日依山尽，黄河入海流。"
    )


def test_normalizes_simplified_and_traditional_queries_equally() -> None:
    assert normalize_search_text("黃河入海") == normalize_search_text(
        "黄河入海"
    )


def test_filters_traditional_text_with_simplified_query() -> None:
    poem = Poem(
        id="traditional",
        title="登鸛雀樓",
        author="王之渙",
        paragraphs=("白日依山盡，黃河入海流。",),
        format=PoemFormat(
            sentence_count=2,
            sentence_lengths=(5, 5),
            uniform_sentence_length=5,
        ),
    )
    normalized_text = normalize_search_text(poem_text(poem))

    assert filter_poems(
        [poem],
        normalized_texts=[normalized_text],
        normalized_query=normalize_search_text("黄河入海"),
    ) == [poem]
