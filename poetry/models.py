from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Poem:
    id: str
    title: str
    author: str
    paragraphs: tuple[str, ...]
    tags: tuple[str, ...] = ()

    @classmethod
    def from_dict(cls, value: dict[str, object]) -> "Poem":
        required = ("id", "title", "author", "paragraphs")
        missing = [field for field in required if field not in value]
        if missing:
            raise ValueError(f"Poem record is missing fields: {', '.join(missing)}")

        paragraphs = value["paragraphs"]
        tags = value.get("tags", [])
        if not isinstance(paragraphs, list) or not all(
            isinstance(item, str) for item in paragraphs
        ):
            raise ValueError("Poem paragraphs must be a list of strings")
        if not isinstance(tags, list) or not all(isinstance(item, str) for item in tags):
            raise ValueError("Poem tags must be a list of strings")

        return cls(
            id=str(value["id"]),
            title=str(value["title"]),
            author=str(value["author"]),
            paragraphs=tuple(paragraphs),
            tags=tuple(tags),
        )
