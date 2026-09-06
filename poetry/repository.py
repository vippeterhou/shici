from __future__ import annotations

from typing import Protocol, Sequence

from .models import Poem


class PoemRepository(Protocol):
    def list_poems(self) -> Sequence[Poem]:
        """Return all available poems."""
