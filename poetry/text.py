from __future__ import annotations


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
