from __future__ import annotations

import re
import unicodedata
from collections import Counter, defaultdict
from dataclasses import dataclass
from typing import Callable, Iterable, Sequence

from .models import Poem
from .search import (
    normalize_filter_value,
    normalize_search_text,
    normalized_filter_values,
)
from .text import is_han_character

SENTENCE_COUNT_GROUP_ORDER = ["四句", "八句", "其他句数"]
SENTENCE_COUNT_EXACT_LIMIT = 32
SENTENCE_COUNT_RANGES = (
    (33, 40, "33–40"),
    (41, 50, "41–50"),
    (51, 100, "51–100"),
    (101, None, "101+"),
)
SHIJING_CATEGORY_BY_CHAPTER = {
    "国风": "风",
    "小雅": "雅",
    "大雅": "雅",
    "周颂": "颂",
    "鲁颂": "颂",
    "商颂": "颂",
}


@dataclass(frozen=True)
class CorpusSummary:
    poem_count: int
    author_count: int
    tag_count: int
    character_count: int
    average_characters: float


@dataclass(frozen=True)
class DerivedStatistics:
    summary: CorpusSummary
    author_counts: tuple[tuple[str, int], ...]
    tune_family_counts: tuple[tuple[str, int], ...]
    line_length_type_counts: tuple[tuple[str, int], ...]
    sentence_count_distribution: tuple[tuple[int, int], ...]
    sentence_count_bucket_distribution: tuple[tuple[str, int], ...]
    format_combination_counts: tuple[tuple[int, str, int], ...]
    format_bucket_combination_counts: tuple[tuple[str, str, int], ...]
    structure_type_counts: tuple[tuple[str, int], ...]
    structure_breakdown_counts: tuple[tuple[str, str, int], ...]
    character_counts: tuple[tuple[str, int], ...]
    duplicate_text_groups: tuple[tuple[Poem, ...], ...]
    poem_catalog: tuple[tuple[str, str, int, int], ...]


@dataclass(frozen=True)
class NgramSummary:
    counts: tuple[tuple[str, int], ...]
    occurrence_count: int


def poem_text(poem: Poem) -> str:
    return "".join(poem.paragraphs)


def poem_character_count(poem: Poem) -> int:
    return sum(is_han_character(character) for character in poem_text(poem))


def summarize(poems: Sequence[Poem]) -> CorpusSummary:
    lengths = [poem_character_count(poem) for poem in poems]
    return CorpusSummary(
        poem_count=len(poems),
        author_count=len({poem.author for poem in poems}),
        tag_count=len({tag for poem in poems for tag in poem.tags}),
        character_count=sum(lengths),
        average_characters=sum(lengths) / len(lengths) if lengths else 0,
    )


def filter_poems(
    poems: Sequence[Poem],
    *,
    authors: Iterable[str] = (),
    tags: Iterable[str] = (),
    tune_families: Iterable[str] = (),
    line_types: Iterable[str] = (),
    sentence_counts: Iterable[int] = (),
    length_range: tuple[int, int] | None = None,
    text_query: str = "",
    normalized_texts: Sequence[str] = (),
    normalized_query: str = "",
) -> list[Poem]:
    author_filter = normalized_filter_values(authors)
    tag_filter = normalized_filter_values(tags)
    tune_family_filter = normalized_filter_values(tune_families)
    line_type_filter = normalized_filter_values(line_types)
    sentence_count_filter = set(sentence_counts)
    script_normalized_query = normalize_search_text(
        normalized_query or text_query.strip()
    )
    if (
        script_normalized_query
        and normalized_texts
        and len(normalized_texts) != len(poems)
    ):
        raise ValueError(
            "Normalized search texts must align with the poems"
        )
    filtered: list[Poem] = []

    for poem_index, poem in enumerate(poems):
        if (
            author_filter
            and normalize_filter_value(poem.author) not in author_filter
        ):
            continue
        if tag_filter and not tag_filter.intersection(
            normalize_filter_value(tag) for tag in poem.tags
        ):
            continue
        if (
            tune_family_filter
            and normalize_filter_value(
                tune_family_name(
                    poem.title,
                    poem.format.sentence_lengths,
                )
            )
            not in tune_family_filter
        ):
            continue
        if (
            line_type_filter
            and normalize_filter_value(line_length_type(poem))
            not in line_type_filter
        ):
            continue
        if (
            sentence_count_filter
            and poem.format.sentence_count not in sentence_count_filter
        ):
            continue

        length = poem_character_count(poem)
        if length_range and not length_range[0] <= length <= length_range[1]:
            continue
        if script_normalized_query:
            normalized_poem_text = (
                normalized_texts[poem_index]
                if normalized_texts
                else normalize_search_text(poem_text(poem))
            )
            if script_normalized_query not in normalized_poem_text:
                continue

        filtered.append(poem)

    return filtered


def shijing_classification(
    poem: Poem,
) -> tuple[str, str, str] | None:
    if not poem.id.startswith("shijing:") or len(poem.tags) < 2:
        return None

    chapter, section = poem.tags[:2]
    category = SHIJING_CATEGORY_BY_CHAPTER.get(chapter)
    if category is None:
        return None
    if category == "风":
        return category, section, ""
    return category, chapter, section


def filter_shijing_poems(
    poems: Sequence[Poem],
    *,
    categories: Iterable[str] = (),
    divisions: Iterable[str] = (),
    sections: Iterable[str] = (),
    titles: Iterable[str] = (),
) -> list[Poem]:
    category_filter = normalized_filter_values(categories)
    division_filter = normalized_filter_values(divisions)
    section_filter = normalized_filter_values(sections)
    title_filter = normalized_filter_values(titles)
    filtered: list[Poem] = []

    for poem in poems:
        classification = shijing_classification(poem)
        if classification is None:
            filtered.append(poem)
            continue

        category, division, section = classification
        if (
            category_filter
            and normalize_filter_value(category) not in category_filter
        ):
            continue
        if (
            division_filter
            and normalize_filter_value(division) not in division_filter
        ):
            continue
        if (
            section_filter
            and normalize_filter_value(section) not in section_filter
        ):
            continue
        if (
            title_filter
            and normalize_filter_value(poem.title) not in title_filter
        ):
            continue
        filtered.append(poem)

    return filtered


def shijing_group(poem: Poem) -> tuple[str, str] | None:
    classification = shijing_classification(poem)
    if classification is None:
        return None

    category, division, section = classification
    label = (
        f"风 · {division}"
        if category == "风"
        else f"{division} · {section}"
    )
    return category, label


def shijing_group_counts(
    poems: Sequence[Poem],
) -> list[tuple[str, str, int]]:
    counts: Counter[tuple[str, str]] = Counter(
        group
        for poem in poems
        if (group := shijing_group(poem)) is not None
    )
    return [
        (category, label, count)
        for (category, label), count in counts.items()
    ]


def poems_with_shijing_group(
    poems: Sequence[Poem],
    label: str,
) -> list[Poem]:
    normalized_label = normalize_filter_value(label)
    return [
        poem
        for poem in poems
        if (group := shijing_group(poem)) is not None
        and normalize_filter_value(group[1]) == normalized_label
    ]


def author_counts(poems: Sequence[Poem]) -> list[tuple[str, int]]:
    return Counter(poem.author for poem in poems).most_common()


def tag_counts(poems: Sequence[Poem]) -> list[tuple[str, int]]:
    return Counter(tag for poem in poems for tag in poem.tags).most_common()


def title_counts(poems: Sequence[Poem]) -> list[tuple[str, int]]:
    return Counter(poem.title for poem in poems).most_common()


TUNE_FAMILY_ALIASES = {
    "一翦梅": "一剪梅",
    "一箩金": "蝶恋花",
    "丑奴儿": "采桑子",
    "买坡塘": "摸鱼儿",
    "买陂塘": "摸鱼儿",
    "乳燕飞": "贺新郎",
    "凤栖梧": "蝶恋花",
    "南柯子": "南歌子",
    "卷珠帘": "蝶恋花",
    "台城路": "齐天乐",
    "安阳好": "忆江南",
    "忆仙姿": "如梦令",
    "望江南": "忆江南",
    "梦江南": "忆江南",
    "江神子": "江城子",
    "浣沙溪": "浣溪沙",
    "浣溪纱": "浣溪沙",
    "浪涛沙": "浪淘沙",
    "湘月": "念奴娇",
    "满庭霜": "满庭芳",
    "甘州": "八声甘州",
    "百字令": "念奴娇",
    "百字谣": "念奴娇",
    "秦楼月": "忆秦娥",
    "罗敷媚": "采桑子",
    "玉交枝": "相思引",
    "玉胡蝶": "玉蝴蝶",
    "珍珠帘": "真珠帘",
    "贺新凉": "贺新郎",
    "醉桃源": "阮郎归",
    "醉落魄": "一斛珠",
    "酹江月": "念奴娇",
    "金缕曲": "贺新郎",
    "金缕歌": "贺新郎",
    "重叠金": "菩萨蛮",
    "鹊踏枝": "蝶恋花",
    "蹋莎行": "踏莎行",
    "壶中天": "念奴娇",
    "大江东去": "念奴娇",
    "宴山亭": "燕山亭",
    "扫花游": "扫地游",
    "渔父": "渔歌子",
    "渔父乐": "渔歌子",
    "绿头鸭": "多丽",
    "豆叶黄": "忆王孙",
    "龙吟曲": "水龙吟",
    "凤皇台上忆吹箫": "凤凰台上忆吹箫",
}
TUNE_CONTEXTUAL_ALIASES = {
    ("木兰花", (7, 7, 7, 7, 7, 7, 7, 7)): "玉楼春",
}
TUNE_VARIANT_PREFIXES = ("减字", "摊破", "转调", "小")
TUNE_VARIANT_SUFFIXES = ("慢", "引", "令", "近")


def tune_family_name(
    title: str,
    sentence_lengths: Sequence[int] = (),
) -> str:
    alias_name, separator, _ = title.partition("・")
    alias_name = alias_name.strip()
    if separator and (
        alias_name.startswith(TUNE_VARIANT_PREFIXES)
        or alias_name.endswith(TUNE_VARIANT_SUFFIXES)
    ):
        return alias_name

    contextual_name = TUNE_CONTEXTUAL_ALIASES.get(
        (alias_name, tuple(sentence_lengths))
    )
    if contextual_name:
        return contextual_name

    mapped_name = TUNE_FAMILY_ALIASES.get(alias_name)
    if mapped_name:
        return mapped_name
    return title.strip()


def tune_family_counts(poems: Sequence[Poem]) -> list[tuple[str, int]]:
    return Counter(
        tune_family_name(poem.title, poem.format.sentence_lengths)
        for poem in poems
    ).most_common()


def sentence_count_distribution(poems: Sequence[Poem]) -> list[tuple[int, int]]:
    return sorted(Counter(poem.format.sentence_count for poem in poems).items())


def sentence_count_bucket(sentence_count: int) -> str:
    if sentence_count <= SENTENCE_COUNT_EXACT_LIMIT:
        return str(sentence_count)
    for lower, upper, label in SENTENCE_COUNT_RANGES:
        if sentence_count >= lower and (
            upper is None or sentence_count <= upper
        ):
            return label
    raise ValueError(f"Unsupported sentence count: {sentence_count}")


def sentence_count_bucket_distribution(
    poems: Sequence[Poem],
) -> list[tuple[str, int]]:
    counts = Counter(
        sentence_count_bucket(poem.format.sentence_count) for poem in poems
    )
    exact_labels = [
        str(sentence_count)
        for sentence_count in sorted(
            {
                poem.format.sentence_count
                for poem in poems
                if poem.format.sentence_count <= SENTENCE_COUNT_EXACT_LIMIT
            }
        )
    ]
    range_labels = [
        label for _, _, label in SENTENCE_COUNT_RANGES if counts[label]
    ]
    return [(label, counts[label]) for label in exact_labels + range_labels]


def chinese_number(value: int) -> str:
    digits = "零一二三四五六七八九"
    if value < 10:
        return digits[value]
    if value < 20:
        return f"十{digits[value % 10]}" if value % 10 else "十"
    if value < 100:
        ones = digits[value % 10] if value % 10 else ""
        return f"{digits[value // 10]}十{ones}"
    return str(value)


def line_length_label(length: int) -> str:
    return f"{chinese_number(length)}言"


def line_length_type(poem: Poem) -> str:
    length = poem.format.uniform_sentence_length
    if length is None:
        return "杂言"
    return line_length_label(length)


def line_length_type_counts(poems: Sequence[Poem]) -> list[tuple[str, int]]:
    counts = Counter(poem.format.uniform_sentence_length for poem in poems)
    result = [
        (line_length_label(length), counts[length])
        for length in sorted(value for value in counts if value is not None)
    ]
    if counts[None]:
        result.append(("杂言", counts[None]))
    return result


def format_combination_counts(
    poems: Sequence[Poem],
) -> list[tuple[int, str, int]]:
    counts = Counter(
        (poem.format.sentence_count, line_length_type(poem)) for poem in poems
    )
    return [
        (sentence_count, length_type, count)
        for (sentence_count, length_type), count in sorted(
            counts.items(),
            key=lambda item: (item[0][0], item[0][1]),
        )
    ]


def format_bucket_combination_counts(
    poems: Sequence[Poem],
) -> list[tuple[str, str, int]]:
    counts = Counter(
        (
            sentence_count_bucket(poem.format.sentence_count),
            line_length_type(poem),
        )
        for poem in poems
    )
    sentence_order = [
        label for label, _ in sentence_count_bucket_distribution(poems)
    ]
    line_type_order = [name for name, _ in line_length_type_counts(poems)]
    return [
        (sentence_bucket, length_type, counts[sentence_bucket, length_type])
        for sentence_bucket in sentence_order
        for length_type in line_type_order
        if counts[sentence_bucket, length_type]
    ]


def structure_type(poem: Poem) -> str:
    length_type = line_length_type(poem)
    if length_type in {"五言", "七言"} and poem.format.sentence_count in {4, 8}:
        sentence_name = {4: "四", 8: "八"}[poem.format.sentence_count]
        return f"{length_type}{sentence_name}句"
    if length_type in {"五言", "七言"}:
        return f"{length_type}其他"
    return length_type


def structure_type_counts(poems: Sequence[Poem]) -> list[tuple[str, int]]:
    counts = Counter(structure_type(poem) for poem in poems)
    line_lengths = sorted(
        {
            poem.format.uniform_sentence_length
            for poem in poems
            if poem.format.uniform_sentence_length is not None
        }
    )
    result: list[tuple[str, int]] = []
    for length in line_lengths:
        length_type = line_length_label(length)
        structure_names = (
            [
                f"{length_type}四句",
                f"{length_type}八句",
                f"{length_type}其他",
            ]
            if length in {5, 7}
            else [length_type]
        )
        result.extend(
            (structure_name, counts[structure_name])
            for structure_name in structure_names
            if counts[structure_name]
        )
    if counts["杂言"]:
        result.append(("杂言", counts["杂言"]))
    return result


def sentence_count_group(poem: Poem) -> str:
    if poem.format.sentence_count == 4:
        return "四句"
    if poem.format.sentence_count == 8:
        return "八句"
    return "其他句数"


def structure_breakdown_counts(
    poems: Sequence[Poem],
) -> list[tuple[str, str, int]]:
    counts = Counter(
        (line_length_type(poem), sentence_count_group(poem)) for poem in poems
    )
    line_type_order = [name for name, _ in line_length_type_counts(poems)]
    return [
        (line_type, sentence_group, counts[line_type, sentence_group])
        for line_type in line_type_order
        for sentence_group in SENTENCE_COUNT_GROUP_ORDER
        if counts[line_type, sentence_group]
    ]


def poems_with_sentence_count(
    poems: Sequence[Poem],
    sentence_count: int,
) -> list[Poem]:
    return [
        poem for poem in poems if poem.format.sentence_count == sentence_count
    ]


def poems_with_sentence_count_bucket(
    poems: Sequence[Poem],
    sentence_bucket: str,
) -> list[Poem]:
    return [
        poem
        for poem in poems
        if sentence_count_bucket(poem.format.sentence_count) == sentence_bucket
    ]


def poems_with_line_length_type(
    poems: Sequence[Poem],
    length_type: str,
) -> list[Poem]:
    return [poem for poem in poems if line_length_type(poem) == length_type]


def poems_with_format_combination(
    poems: Sequence[Poem],
    sentence_count: int,
    length_type: str,
) -> list[Poem]:
    return [
        poem
        for poem in poems
        if poem.format.sentence_count == sentence_count
        and line_length_type(poem) == length_type
    ]


def poems_with_format_bucket_combination(
    poems: Sequence[Poem],
    sentence_bucket: str,
    length_type: str,
) -> list[Poem]:
    return [
        poem
        for poem in poems
        if sentence_count_bucket(poem.format.sentence_count) == sentence_bucket
        and line_length_type(poem) == length_type
    ]


def poems_with_structure_type(
    poems: Sequence[Poem],
    selected_structure_type: str,
) -> list[Poem]:
    return [
        poem
        for poem in poems
        if structure_type(poem) == selected_structure_type
    ]


def poems_with_structure_breakdown(
    poems: Sequence[Poem],
    length_type: str,
    sentence_group: str,
) -> list[Poem]:
    return [
        poem
        for poem in poems
        if line_length_type(poem) == length_type
        and sentence_count_group(poem) == sentence_group
    ]


def character_counts(poems: Sequence[Poem]) -> list[tuple[str, int]]:
    counter: Counter[str] = Counter()
    for poem in poems:
        counter.update(
            character
            for character in poem_text(poem)
            if is_han_character(character)
        )
    return counter.most_common()


def batched_ngram_summary(
    poems: Sequence[Poem],
    size: int,
    *,
    batch_size: int,
    limit: int | None = None,
    on_batch_complete: Callable[[int, int], None] | None = None,
) -> NgramSummary:
    if size < 1:
        raise ValueError("ngram size must be positive")
    if batch_size < 1:
        raise ValueError("batch size must be positive")

    counter: Counter[str] = Counter()
    batch_count = (len(poems) + batch_size - 1) // batch_size
    for batch_index, batch_start in enumerate(
        range(0, len(poems), batch_size),
        start=1,
    ):
        for poem in poems[batch_start : batch_start + batch_size]:
            for paragraph in poem.paragraphs:
                counter.update(
                    paragraph[index : index + size]
                    for index in range(len(paragraph) - size + 1)
                    if all(
                        is_han_character(character)
                        for character in paragraph[index : index + size]
                    )
                )
        if on_batch_complete:
            on_batch_complete(batch_index, batch_count)

    return NgramSummary(
        counts=tuple(counter.most_common(limit)),
        occurrence_count=sum(counter.values()),
    )


def ngram_counts(
    poems: Sequence[Poem],
    size: int,
) -> list[tuple[str, int]]:
    return list(
        batched_ngram_summary(
            poems,
            size,
            batch_size=max(1, len(poems)),
        ).counts
    )


def bigram_counts(poems: Sequence[Poem]) -> list[tuple[str, int]]:
    return ngram_counts(poems, 2)


def trigram_counts(poems: Sequence[Poem]) -> list[tuple[str, int]]:
    return ngram_counts(poems, 3)


def poems_containing_ngram(
    poems: Sequence[Poem],
    ngram: str,
    size: int,
) -> list[Poem]:
    if len(ngram) != size or not all(
        is_han_character(character) for character in ngram
    ):
        raise ValueError(
            f"ngram must contain exactly {size} Han characters"
        )
    return [
        poem
        for poem in poems
        if any(ngram in paragraph for paragraph in poem.paragraphs)
    ]


def poems_containing_bigram(
    poems: Sequence[Poem],
    bigram: str,
) -> list[Poem]:
    return poems_containing_ngram(poems, bigram, 2)


def poems_containing_trigram(
    poems: Sequence[Poem],
    trigram: str,
) -> list[Poem]:
    return poems_containing_ngram(poems, trigram, 3)


def length_distribution(
    poems: Sequence[Poem],
    *,
    bucket_size: int = 25,
) -> list[tuple[str, int]]:
    if bucket_size <= 0:
        raise ValueError("bucket_size must be positive")

    buckets: Counter[int] = Counter()
    for poem in poems:
        length = poem_character_count(poem)
        buckets[(length // bucket_size) * bucket_size] += 1

    return [
        (f"{start}–{start + bucket_size - 1}", count)
        for start, count in sorted(buckets.items())
    ]


def poems_in_length_bucket(
    poems: Sequence[Poem],
    bucket_label: str,
    *,
    bucket_size: int = 25,
) -> list[Poem]:
    start_text, separator, end_text = bucket_label.partition("–")
    if not separator:
        raise ValueError(f"Invalid length bucket: {bucket_label}")

    start = int(start_text)
    end = int(end_text)
    if end != start + bucket_size - 1:
        raise ValueError(f"Unexpected length bucket size: {bucket_label}")

    return [
        poem
        for poem in poems
        if start <= poem_character_count(poem) <= end
    ]


def poems_containing_character(
    poems: Sequence[Poem],
    character: str,
) -> list[Poem]:
    if len(character) != 1 or not is_han_character(character):
        raise ValueError("character must be one Han character")
    return [poem for poem in poems if character in poem_text(poem)]


def duplicate_text_groups(poems: Sequence[Poem]) -> list[tuple[Poem, ...]]:
    groups: dict[str, list[Poem]] = defaultdict(list)
    for poem in poems:
        normalized = "".join(
            character
            for character in unicodedata.normalize("NFKC", poem_text(poem))
            if re.match(r"\w", character, flags=re.UNICODE)
        )
        groups[normalized].append(poem)

    return [
        tuple(group)
        for group in groups.values()
        if len(group) > 1 and group[0].paragraphs
    ]


def derive_statistics(poems: Sequence[Poem]) -> DerivedStatistics:
    return DerivedStatistics(
        summary=summarize(poems),
        author_counts=tuple(author_counts(poems)),
        tune_family_counts=tuple(tune_family_counts(poems)),
        line_length_type_counts=tuple(line_length_type_counts(poems)),
        sentence_count_distribution=tuple(sentence_count_distribution(poems)),
        sentence_count_bucket_distribution=tuple(
            sentence_count_bucket_distribution(poems)
        ),
        format_combination_counts=tuple(format_combination_counts(poems)),
        format_bucket_combination_counts=tuple(
            format_bucket_combination_counts(poems)
        ),
        structure_type_counts=tuple(structure_type_counts(poems)),
        structure_breakdown_counts=tuple(structure_breakdown_counts(poems)),
        character_counts=tuple(character_counts(poems)),
        duplicate_text_groups=tuple(duplicate_text_groups(poems)),
        poem_catalog=tuple(
            (
                poem.title,
                poem.author,
                poem_character_count(poem),
                len(poem.paragraphs),
            )
            for poem in poems
        ),
    )
