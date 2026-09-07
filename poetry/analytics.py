from __future__ import annotations

import re
import unicodedata
from collections import Counter, defaultdict
from dataclasses import dataclass
from typing import Iterable, Sequence

from .models import Poem
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
    line_types: Iterable[str] = (),
    sentence_counts: Iterable[int] = (),
    length_range: tuple[int, int] | None = None,
    text_query: str = "",
) -> list[Poem]:
    author_filter = set(authors)
    tag_filter = set(tags)
    line_type_filter = set(line_types)
    sentence_count_filter = set(sentence_counts)
    normalized_query = text_query.strip().casefold()
    filtered: list[Poem] = []

    for poem in poems:
        if author_filter and poem.author not in author_filter:
            continue
        if tag_filter and not tag_filter.intersection(poem.tags):
            continue
        if line_type_filter and line_length_type(poem) not in line_type_filter:
            continue
        if (
            sentence_count_filter
            and poem.format.sentence_count not in sentence_count_filter
        ):
            continue

        length = poem_character_count(poem)
        if length_range and not length_range[0] <= length <= length_range[1]:
            continue
        if normalized_query and normalized_query not in poem_text(poem).casefold():
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
    category_filter = set(categories)
    division_filter = set(divisions)
    section_filter = set(sections)
    title_filter = set(titles)
    filtered: list[Poem] = []

    for poem in poems:
        classification = shijing_classification(poem)
        if classification is None:
            filtered.append(poem)
            continue

        category, division, section = classification
        if category_filter and category not in category_filter:
            continue
        if division_filter and division not in division_filter:
            continue
        if section_filter and section not in section_filter:
            continue
        if title_filter and poem.title not in title_filter:
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
    return [
        poem
        for poem in poems
        if (group := shijing_group(poem)) is not None
        and group[1] == label
    ]


def author_counts(poems: Sequence[Poem]) -> list[tuple[str, int]]:
    return Counter(poem.author for poem in poems).most_common()


def tag_counts(poems: Sequence[Poem]) -> list[tuple[str, int]]:
    return Counter(tag for poem in poems for tag in poem.tags).most_common()


def title_counts(poems: Sequence[Poem]) -> list[tuple[str, int]]:
    return Counter(poem.title for poem in poems).most_common()


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


def ngram_counts(
    poems: Sequence[Poem],
    size: int,
) -> list[tuple[str, int]]:
    if size < 1:
        raise ValueError("ngram size must be positive")

    counter: Counter[str] = Counter()
    for poem in poems:
        for paragraph in poem.paragraphs:
            counter.update(
                paragraph[index : index + size]
                for index in range(len(paragraph) - size + 1)
                if all(
                    is_han_character(character)
                    for character in paragraph[index : index + size]
                )
            )
    return counter.most_common()


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
