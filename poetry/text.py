from __future__ import annotations


def clean_display_text(value: str) -> str:
    return " ".join(value.split())


def compact_poem_title(title: str, max_length: int = 16) -> str:
    cleaned_title = clean_display_text(title)
    if not cleaned_title:
        return "无题"
    if len(cleaned_title) <= max_length:
        return cleaned_title

    separator_index = max(
        cleaned_title.rfind("："),
        cleaned_title.rfind(":"),
    )
    if separator_index >= 0:
        specific_title = cleaned_title[separator_index + 1 :].strip()
        if specific_title:
            return specific_title

    return cleaned_title


def is_han_character(character: str) -> bool:
    codepoint = ord(character)
    return (
        codepoint == 0x3007
        or 0x3400 <= codepoint <= 0x4DBF
        or 0x4E00 <= codepoint <= 0x9FFF
        or 0xF900 <= codepoint <= 0xFAFF
        or 0x20000 <= codepoint <= 0x2EE5F
        or 0x30000 <= codepoint <= 0x323AF
    )
