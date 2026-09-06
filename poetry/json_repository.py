from __future__ import annotations

import json
from pathlib import Path

from .models import Poem


class JsonPoemRepository:
    def __init__(self, path: str | Path) -> None:
        self.path = Path(path)
        self._poems: tuple[Poem, ...] | None = None

    def list_poems(self) -> tuple[Poem, ...]:
        if self._poems is None:
            self._poems = self._load()
        return self._poems

    def _load(self) -> tuple[Poem, ...]:
        if self.path.is_file():
            return self._load_file(self.path)
        if self.path.is_dir():
            files = sorted(self.path.glob("*.json"))
            if not files:
                raise ValueError(f"No JSON files found in: {self.path}")
            return tuple(
                poem
                for file_path in files
                for poem in self._load_file(file_path)
            )
        raise ValueError(f"Poetry data path does not exist: {self.path}")

    def _load_file(self, path: Path) -> tuple[Poem, ...]:
        with path.open(encoding="utf-8") as file:
            records = json.load(file)
        if not isinstance(records, list):
            raise ValueError("Poetry data must be a top-level JSON array")

        poems = []
        for index, record in enumerate(records):
            if not isinstance(record, dict):
                raise ValueError(f"Poetry record must be an object: {path}")
            normalized_record = dict(record)
            normalized_record.setdefault(
                "id",
                f"{self.path.name}/{path.name}:{index}",
            )
            poems.append(Poem.from_dict(normalized_record))
        return tuple(poems)
