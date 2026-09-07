from poetry.analytics import (
    author_counts,
    bigram_counts,
    character_counts,
    duplicate_text_groups,
    filter_poems,
    filter_shijing_poems,
    format_bucket_combination_counts,
    format_combination_counts,
    is_han_character,
    length_distribution,
    line_length_type,
    line_length_type_counts,
    poem_character_count,
    poems_containing_bigram,
    poems_containing_character,
    poems_in_length_bucket,
    poems_with_format_bucket_combination,
    poems_with_format_combination,
    poems_with_line_length_type,
    poems_with_sentence_count,
    poems_with_sentence_count_bucket,
    poems_with_structure_breakdown,
    poems_with_structure_type,
    poems_with_shijing_group,
    sentence_count_bucket,
    sentence_count_bucket_distribution,
    sentence_count_distribution,
    shijing_classification,
    shijing_group,
    shijing_group_counts,
    structure_breakdown_counts,
    structure_type,
    structure_type_counts,
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
    assert filter_poems(POEMS, line_types=["七言"]) == [POEMS[0]]
    assert filter_poems(POEMS, sentence_counts=[2]) == list(POEMS[1:])
    assert filter_poems(
        POEMS,
        line_types=["五言"],
        sentence_counts=[2],
    ) == list(POEMS[1:])


def test_classifies_and_filters_shijing_hierarchy() -> None:
    wind = Poem(
        id="shijing:000",
        title="关雎",
        author="佚名",
        paragraphs=("关关雎鸠，在河之洲。",),
        format=PoemFormat(
            sentence_count=2,
            sentence_lengths=(4, 4),
            uniform_sentence_length=4,
        ),
        tags=("国风", "周南"),
    )
    ode = Poem(
        id="shijing:160",
        title="鹿鸣",
        author="佚名",
        paragraphs=("呦呦鹿鸣，食野之苹。",),
        format=PoemFormat(
            sentence_count=2,
            sentence_lengths=(4, 4),
            uniform_sentence_length=4,
        ),
        tags=("小雅", "鹿鸣之什"),
    )

    assert shijing_classification(wind) == ("风", "周南", "")
    assert shijing_classification(ode) == ("雅", "小雅", "鹿鸣之什")
    assert filter_shijing_poems(
        (*POEMS, wind, ode),
        categories=["雅"],
        divisions=["小雅"],
        sections=["鹿鸣之什"],
        titles=["鹿鸣"],
    ) == [*POEMS, ode]
    assert shijing_group(wind) == ("风", "风 · 周南")
    assert shijing_group(ode) == ("雅", "小雅 · 鹿鸣之什")
    assert shijing_group_counts((wind, ode)) == [
        ("风", "风 · 周南", 1),
        ("雅", "小雅 · 鹿鸣之什", 1),
    ]
    assert poems_with_shijing_group((wind, ode), "小雅 · 鹿鸣之什") == [
        ode
    ]


def test_analytics_counts_and_distribution() -> None:
    assert author_counts(POEMS)[0][1] == 1
    assert character_counts(POEMS)[0][1] >= 2
    assert sum(count for _, count in length_distribution(POEMS)) == 3


def test_selects_poems_for_chart_drilldowns() -> None:
    distribution = length_distribution(POEMS)
    bucket = distribution[0][0]

    assert poems_in_length_bucket(POEMS, bucket)
    assert len(poems_containing_character(POEMS, "黃")) == 3


def test_bigram_counts_include_overlaps_without_crossing_punctuation() -> None:
    poem = Poem(
        id="bigrams",
        title="二字组合",
        author="作者",
        paragraphs=("明月明月，月光。",),
        format=FIVE_CHARACTER_FORMAT,
    )

    assert bigram_counts((poem,)) == [
        ("明月", 2),
        ("月明", 1),
        ("月光", 1),
    ]
    assert poems_containing_bigram((poem,), "月明") == [poem]


def test_format_analytics_and_drilldowns() -> None:
    assert sentence_count_distribution(POEMS) == [(1, 1), (2, 2)]
    assert line_length_type_counts(POEMS) == [("五言", 2), ("七言", 1)]
    assert format_combination_counts(POEMS) == [
        (1, "七言", 1),
        (2, "五言", 2),
    ]
    assert line_length_type(POEMS[0]) == "七言"
    assert structure_type(POEMS[1]) == "五言其他"
    assert structure_type_counts(POEMS) == [
        ("五言其他", 2),
        ("七言其他", 1),
    ]
    assert structure_breakdown_counts(POEMS) == [
        ("五言", "其他句数", 2),
        ("七言", "其他句数", 1),
    ]
    assert poems_with_sentence_count(POEMS, 2) == list(POEMS[1:])
    assert poems_with_line_length_type(POEMS, "七言") == [POEMS[0]]
    assert poems_with_format_combination(POEMS, 2, "五言") == list(POEMS[1:])
    assert poems_with_structure_type(POEMS, "五言其他") == list(POEMS[1:])
    assert poems_with_structure_breakdown(
        POEMS,
        "五言",
        "其他句数",
    ) == list(POEMS[1:])
    assert sentence_count_bucket_distribution(POEMS) == [("1", 1), ("2", 2)]
    assert format_bucket_combination_counts(POEMS) == [
        ("1", "七言", 1),
        ("2", "五言", 2),
    ]
    assert poems_with_sentence_count_bucket(POEMS, "2") == list(POEMS[1:])
    assert poems_with_format_bucket_combination(
        POEMS,
        "2",
        "五言",
    ) == list(POEMS[1:])


def test_groups_large_sentence_counts_into_ranges() -> None:
    assert sentence_count_bucket(32) == "32"
    assert sentence_count_bucket(33) == "33–40"
    assert sentence_count_bucket(40) == "33–40"
    assert sentence_count_bucket(41) == "41–50"
    assert sentence_count_bucket(50) == "41–50"
    assert sentence_count_bucket(51) == "51–100"
    assert sentence_count_bucket(100) == "51–100"
    assert sentence_count_bucket(101) == "101+"


def test_groups_structure_breakdown_by_sentence_count() -> None:
    four_line_poem = Poem(
        id="four-lines",
        title="四句",
        author="作者",
        paragraphs=("天地玄黃。",),
        format=PoemFormat(
            sentence_count=4,
            sentence_lengths=(5, 5, 5, 5),
            uniform_sentence_length=5,
        ),
    )
    eight_line_poem = Poem(
        id="eight-lines",
        title="八句",
        author="作者",
        paragraphs=("宇宙洪荒。",),
        format=PoemFormat(
            sentence_count=8,
            sentence_lengths=(7, 7, 7, 7, 7, 7, 7, 7),
            uniform_sentence_length=7,
        ),
    )
    poems = (four_line_poem, eight_line_poem)

    assert structure_breakdown_counts(poems) == [
        ("五言", "四句", 1),
        ("七言", "八句", 1),
    ]
    assert poems_with_structure_breakdown(poems, "五言", "四句") == [
        four_line_poem
    ]
    assert poems_with_structure_breakdown(poems, "七言", "八句") == [
        eight_line_poem
    ]


def test_labels_other_uniform_line_lengths_with_specific_number() -> None:
    four_character_poem = Poem(
        id="four",
        title="四言",
        author="作者",
        paragraphs=("天地玄黃，宇宙洪荒。",),
        format=PoemFormat(
            sentence_count=2,
            sentence_lengths=(4, 4),
            uniform_sentence_length=4,
        ),
    )
    twenty_eight_character_poem = Poem(
        id="twenty-eight",
        title="二十八言",
        author="作者",
        paragraphs=("天地",),
        format=PoemFormat(
            sentence_count=1,
            sentence_lengths=(28,),
            uniform_sentence_length=28,
        ),
    )

    poems = (four_character_poem, twenty_eight_character_poem)
    assert line_length_type(four_character_poem) == "四言"
    assert line_length_type(twenty_eight_character_poem) == "二十八言"
    assert line_length_type_counts(poems) == [("四言", 1), ("二十八言", 1)]
    assert structure_type_counts(poems) == [("四言", 1), ("二十八言", 1)]
    assert structure_type_counts((*poems, *POEMS)) == [
        ("四言", 1),
        ("五言其他", 2),
        ("七言其他", 1),
        ("二十八言", 1),
    ]


def test_finds_exact_duplicate_text() -> None:
    duplicate_groups = duplicate_text_groups(POEMS)

    assert len(duplicate_groups) == 1
    assert {poem.id for poem in duplicate_groups[0]} == {"2", "3"}
