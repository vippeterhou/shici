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
        with self.path.open(encoding="utf-8") as file:
            records = json.load(file)

        if not isinstance(records, list):
            raise ValueError("Poetry data must be a top-level JSON array")

        return tuple(Poem.from_dict(record) for record in records)
