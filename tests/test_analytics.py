from poetry.analytics import (
    author_counts,
    character_counts,
    duplicate_text_groups,
    filter_poems,
    is_han_character,
    length_distribution,
    poem_character_count,
    poems_containing_character,
    poems_in_length_bucket,
    summarize,
)
from poetry.models import Poem, PoemFormat


FIVE_CHARACTER_FORMAT = PoemFormat(
    sentence_count=1,
    sentence_lengths=(5,),
    uniform_sentence_length=5,
)


POEMS = (
    Poem(
        id="1",
        title="將進酒",
        author="李白",
        paragraphs=("黃河之水天上來。",),
        format=PoemFormat(
            sentence_count=1,
            sentence_lengths=(7,),
            uniform_sentence_length=7,
        ),
        tags=("樂府", "黃河"),
    ),
    Poem(
        id="2",
        title="登鸛雀樓",
        author="王之渙",
        paragraphs=("白日依山盡，黃河入海流。",),
        format=PoemFormat(
            sentence_count=2,
            sentence_lengths=(5, 5),
            uniform_sentence_length=5,
        ),
        tags=("五言絕句", "黃河"),
    ),
    Poem(
        id="3",
        title="異題",
        author="佚名",
        paragraphs=("白日依山盡，黃河入海流。",),
        format=PoemFormat(
            sentence_count=2,
            sentence_lengths=(5, 5),
            uniform_sentence_length=5,
        ),
        tags=(),
    ),
)


def test_summarize_corpus() -> None:
    summary = summarize(POEMS)

    assert summary.poem_count == 3
    assert summary.author_count == 3
    assert summary.tag_count == 3
    assert summary.character_count > 0


def test_poem_length_counts_only_han_characters() -> None:
    poem = Poem(
        id="mixed",
        title="測試",
        author="作者",
        paragraphs=("明 月，ABC 123。〇",),
        format=FIVE_CHARACTER_FORMAT,
    )

    assert poem_character_count(poem) == 3
    assert is_han_character("明")
    assert is_han_character("〇")
    assert not is_han_character("A")
    assert not is_han_character("，")


def test_filters_across_dashboard_dimensions() -> None:
    assert [poem.title for poem in filter_poems(POEMS, authors=["李白"])] == [
        "將進酒"
    ]
    assert len(filter_poems(POEMS, tags=["黃河"])) == 2
    assert len(filter_poems(POEMS, text_query="入海")) == 2
    assert filter_poems(POEMS, text_query="李白") == []


def test_analytics_counts_and_distribution() -> None:
    assert author_counts(POEMS)[0][1] == 1
    assert character_counts(POEMS)[0][1] >= 2
    assert sum(count for _, count in length_distribution(POEMS)) == 3


def test_selects_poems_for_chart_drilldowns() -> None:
    distribution = length_distribution(POEMS)
    bucket = distribution[0][0]

    assert poems_in_length_bucket(POEMS, bucket)
    assert len(poems_containing_character(POEMS, "黃")) == 3


def test_finds_exact_duplicate_text() -> None:
    duplicate_groups = duplicate_text_groups(POEMS)

    assert len(duplicate_groups) == 1
    assert {poem.id for poem in duplicate_groups[0]} == {"2", "3"}
