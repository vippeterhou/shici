from __future__ import annotations

import unicodedata
from functools import lru_cache
from typing import Iterable

from opencc import OpenCC


@lru_cache(maxsize=1)
def simplified_converter() -> OpenCC:
    return OpenCC("t2s")


def normalize_search_text(text: str) -> str:
    normalized_text = unicodedata.normalize("NFC", text)
    return simplified_converter().convert(normalized_text).casefold()


@lru_cache(maxsize=32_768)
def normalize_filter_value(value: str) -> str:
    return normalize_search_text(value)


def normalized_filter_values(values: Iterable[str]) -> set[str]:
    return {normalize_filter_value(value) for value in values}


def resolve_equivalent_option(
    options: Iterable[str],
    selected_value: str,
) -> str:
    normalized_selection = normalize_filter_value(selected_value)
    return next(
        (
            option
            for option in options
            if normalize_filter_value(option) == normalized_selection
        ),
        selected_value,
    )


def resolve_equivalent_options(
    options: Iterable[str],
    selected_values: Iterable[str],
) -> tuple[str, ...]:
    option_values = tuple(options)
    return tuple(
        dict.fromkeys(
            resolve_equivalent_option(option_values, selected_value)
            for selected_value in selected_values
        )
    )
