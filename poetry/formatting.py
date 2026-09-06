from __future__ import annotations

import re
from collections.abc import Sequence

from .models import PoemFormat
from .text import is_han_character

_SENTENCE_SEPARATOR = re.compile(r"[，。！？；：,.!?;:\n]+")


def analyze_poem_format(paragraphs: Sequence[str]) -> PoemFormat:
    sentence_lengths = tuple(
        length
        for paragraph in paragraphs
        for sentence in _SENTENCE_SEPARATOR.split(paragraph)
        if (length := sum(is_han_character(character) for character in sentence))
    )
    uniform_sentence_length = (
        sentence_lengths[0]
        if sentence_lengths and len(set(sentence_lengths)) == 1
        else None
    )
    return PoemFormat(
        sentence_count=len(sentence_lengths),
        sentence_lengths=sentence_lengths,
        uniform_sentence_length=uniform_sentence_length,
    )
