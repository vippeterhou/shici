from poetry.analytics import filter_poems, poem_text
from poetry.models import Poem, PoemFormat
from poetry.search import (
    normalize_search_text,
    normalized_value_lookup,
    resolve_equivalent_option,
    resolve_equivalent_options,
)


def test_normalizes_traditional_text_for_search() -> None:
    assert (
        normalize_search_text("白日依山盡，黃河入海流。")
        == "白日依山尽，黄河入海流。"
    )


def test_normalizes_simplified_and_traditional_queries_equally() -> None:
    assert normalize_search_text("黃河入海") == normalize_search_text(
        "黄河入海"
    )


def test_resolves_selection_to_original_option_text() -> None:
    assert resolve_equivalent_option(("李紳", "李白"), "李绅") == "李紳"
    assert resolve_equivalent_option(("周邦彦", "苏轼"), "周邦彥") == "周邦彦"


def test_resolves_multiple_selections_without_duplicates() -> None:
    assert resolve_equivalent_options(
        ("李紳", "李白"),
        ("李绅", "李紳", "李白"),
    ) == ("李紳", "李白")


def test_normalized_lookup_stores_each_original_value_once() -> None:
    assert normalized_value_lookup(("後世", "後世", "后世")) == {
        "後世": "后世",
        "后世": "后世",
    }


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


def test_filters_both_scripts_for_either_substring_query() -> None:
    poems = (
        Poem(
            id="simplified",
            title="简体",
            author="后世",
            paragraphs=("流传后世。",),
            format=PoemFormat(1, (4,), 4),
        ),
        Poem(
            id="traditional",
            title="繁體",
            author="後世",
            paragraphs=("流傳後世。",),
            format=PoemFormat(1, (4,), 4),
        ),
    )

    assert filter_poems(poems, text_query="后世") == list(poems)
    assert filter_poems(poems, text_query="後世") == list(poems)
