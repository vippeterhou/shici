from __future__ import annotations

import re
import unicodedata
from collections import Counter, defaultdict
from dataclasses import dataclass
from typing import Iterable, Sequence

import jieba
from opencc import OpenCC

from .models import Poem
from .text import is_han_character

BASE_STRUCTURE_TYPE_ORDER = [
    "五言四句",
    "五言八句",
    "其他五言",
    "七言四句",
    "七言八句",
    "其他七言",
]
SENTENCE_COUNT_GROUP_ORDER = ["四句", "八句", "其他句数"]
SENTENCE_COUNT_EXACT_LIMIT = 32
SENTENCE_COUNT_RANGES = (
    (33, 40, "33–40"),
    (41, 50, "41–50"),
    (51, 100, "51–100"),
    (101, None, "101+"),
)
WORD_TOKENIZER = jieba.Tokenizer()
TRADITIONAL_TO_SIMPLIFIED = OpenCC("t2s")


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
        return f"其他{length_type}"
    return length_type


def structure_type_counts(poems: Sequence[Poem]) -> list[tuple[str, int]]:
    counts = Counter(structure_type(poem) for poem in poems)
    result = [
        (structure_name, counts[structure_name])
        for structure_name in BASE_STRUCTURE_TYPE_ORDER
        if counts[structure_name]
    ]
    other_lengths = sorted(
        {
            poem.format.uniform_sentence_length
            for poem in poems
            if poem.format.uniform_sentence_length not in {None, 5, 7}
        }
    )
    result.extend(
        (line_length_label(length), counts[line_length_label(length)])
        for length in other_lengths
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


def poem_words(poem: Poem) -> list[str]:
    original_text = poem_text(poem)
    segmentation_text = TRADITIONAL_TO_SIMPLIFIED.convert(original_text)
    words: list[str] = []
    offset = 0

    for segmented_word in WORD_TOKENIZER.cut(segmentation_text):
        original_word = original_text[offset : offset + len(segmented_word)]
        offset += len(segmented_word)
        if len(original_word) >= 2 and all(
            is_han_character(character) for character in original_word
        ):
            words.append(original_word)

    return words


def word_counts(poems: Sequence[Poem]) -> list[tuple[str, int]]:
    counter: Counter[str] = Counter()
    for poem in poems:
        counter.update(poem_words(poem))
    return counter.most_common()


def poems_containing_word(
    poems: Sequence[Poem],
    word: str,
) -> list[Poem]:
    if len(word) < 2 or not all(is_han_character(character) for character in word):
        raise ValueError("word must contain at least two Han characters")
    return [poem for poem in poems if word in poem_text(poem)]


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
