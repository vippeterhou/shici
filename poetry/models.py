from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class PoemFormat:
    sentence_count: int
    sentence_lengths: tuple[int, ...]
    uniform_sentence_length: int | None

    @classmethod
    def from_dict(cls, value: object) -> "PoemFormat":
        if not isinstance(value, dict):
            raise ValueError("Poem format must be an object")

        sentence_count = value.get("sentence_count")
        sentence_lengths = value.get("sentence_lengths")
        uniform_sentence_length = value.get("uniform_sentence_length")

        if not isinstance(sentence_count, int) or sentence_count < 1:
            raise ValueError("Poem sentence_count must be a positive integer")
        if not isinstance(sentence_lengths, list) or not all(
            isinstance(length, int) and length > 0 for length in sentence_lengths
        ):
            raise ValueError("Poem sentence_lengths must contain positive integers")
        if sentence_count != len(sentence_lengths):
            raise ValueError("Poem sentence_count must match sentence_lengths")
        if uniform_sentence_length is not None and (
            not isinstance(uniform_sentence_length, int)
            or uniform_sentence_length < 1
            or any(
                length != uniform_sentence_length for length in sentence_lengths
            )
        ):
            raise ValueError("Poem uniform_sentence_length is inconsistent")

        return cls(
            sentence_count=sentence_count,
            sentence_lengths=tuple(sentence_lengths),
            uniform_sentence_length=uniform_sentence_length,
        )

    def to_dict(self) -> dict[str, object]:
        return {
            "sentence_count": self.sentence_count,
            "sentence_lengths": list(self.sentence_lengths),
            "uniform_sentence_length": self.uniform_sentence_length,
        }


@dataclass(frozen=True)
class Poem:
    id: str
    title: str
    author: str
    paragraphs: tuple[str, ...]
    format: PoemFormat
    tags: tuple[str, ...] = ()

    @classmethod
    def from_dict(cls, value: dict[str, object]) -> "Poem":
        required = ("id", "title", "author", "paragraphs", "format")
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
            format=PoemFormat.from_dict(value["format"]),
            tags=tuple(tags),
        )
