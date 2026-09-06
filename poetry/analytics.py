from __future__ import annotations

import re
import unicodedata
from collections import Counter, defaultdict
from dataclasses import dataclass
from typing import Iterable, Sequence

from .models import Poem
from .text import is_han_character


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
    length_range: tuple[int, int] | None = None,
    text_query: str = "",
) -> list[Poem]:
    author_filter = set(authors)
    tag_filter = set(tags)
    normalized_query = text_query.strip().casefold()
    filtered: list[Poem] = []

    for poem in poems:
        if author_filter and poem.author not in author_filter:
            continue
        if tag_filter and not tag_filter.intersection(poem.tags):
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


def line_length_type(poem: Poem) -> str:
    length = poem.format.uniform_sentence_length
    if length == 5:
        return "五言"
    if length == 7:
        return "七言"
    if length is None:
        return "杂言"
    return "其他齐言"


def line_length_type_counts(poems: Sequence[Poem]) -> list[tuple[str, int]]:
    order = {"五言": 0, "七言": 1, "杂言": 2, "其他齐言": 3}
    counts = Counter(line_length_type(poem) for poem in poems)
    return sorted(counts.items(), key=lambda item: order[item[0]])


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


def structure_type(poem: Poem) -> str:
    length_type = line_length_type(poem)
    if length_type in {"五言", "七言"} and poem.format.sentence_count in {4, 8}:
        sentence_name = {4: "四", 8: "八"}[poem.format.sentence_count]
        return f"{length_type}{sentence_name}句"
    if length_type in {"五言", "七言"}:
        return f"其他{length_type}"
    return length_type


def structure_type_counts(poems: Sequence[Poem]) -> list[tuple[str, int]]:
    return Counter(structure_type(poem) for poem in poems).most_common()


def poems_with_sentence_count(
    poems: Sequence[Poem],
    sentence_count: int,
) -> list[Poem]:
    return [
        poem for poem in poems if poem.format.sentence_count == sentence_count
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


def poems_with_structure_type(
    poems: Sequence[Poem],
    selected_structure_type: str,
) -> list[Poem]:
    return [
        poem
        for poem in poems
        if structure_type(poem) == selected_structure_type
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
