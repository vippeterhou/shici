from __future__ import annotations

import unicodedata
from functools import lru_cache

from opencc import OpenCC


@lru_cache(maxsize=1)
def simplified_converter() -> OpenCC:
    return OpenCC("t2s")


def normalize_search_text(text: str) -> str:
    normalized_text = unicodedata.normalize("NFC", text)
    return simplified_converter().convert(normalized_text).casefold()
