from __future__ import annotations

import gzip
import hashlib
import json
import tempfile
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from .models import Poem


class RemoteJsonPoemRepository:
    def __init__(
        self,
        url: str,
        *,
        sha256: str,
        expected_count: int,
        timeout: int = 120,
    ) -> None:
        self.url = url
        self.sha256 = sha256
        self.expected_count = expected_count
        self.timeout = timeout
        self._poems: tuple[Poem, ...] | None = None

    def list_poems(self) -> tuple[Poem, ...]:
        if self._poems is None:
            self._poems = self._load()
        return self._poems

    def _load(self) -> tuple[Poem, ...]:
        request = Request(
            self.url,
            headers={"User-Agent": "vippeterhou/shici"},
        )
        digest = hashlib.sha256()

        try:
            with urlopen(request, timeout=self.timeout) as response:
                with tempfile.SpooledTemporaryFile(max_size=8 * 1024 * 1024) as file:
                    for chunk in iter(lambda: response.read(1024 * 1024), b""):
                        digest.update(chunk)
                        file.write(chunk)
                    actual_sha256 = digest.hexdigest()
                    if actual_sha256 != self.sha256:
                        raise ValueError(
                            "Downloaded poetry data checksum mismatch: "
                            f"expected {self.sha256}, got {actual_sha256}"
                        )
                    file.seek(0)
                    poems = []
                    with gzip.open(file, mode="rt", encoding="utf-8") as source:
                        for line_number, line in enumerate(source, start=1):
                            try:
                                record = json.loads(line)
                            except json.JSONDecodeError as error:
                                raise ValueError(
                                    "Invalid remote poetry JSON at line "
                                    f"{line_number}"
                                ) from error
                            if not isinstance(record, dict):
                                raise ValueError(
                                    "Poetry record must be an object: "
                                    f"remote line {line_number}"
                                )
                            poems.append(Poem.from_dict(record))
        except (HTTPError, URLError, TimeoutError) as error:
            raise RuntimeError(
                f"Unable to download poetry data from {self.url}"
            ) from error

        if len(poems) != self.expected_count:
            raise ValueError(
                "Downloaded poetry data count mismatch: "
                f"expected {self.expected_count:,}, got {len(poems):,}"
            )
        return tuple(poems)
