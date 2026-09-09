import gzip
import hashlib
import json
from pathlib import Path

import pytest

from poetry.remote_repository import RemoteJsonPoemRepository


def write_remote_fixture(path: Path) -> str:
    records = [
        {
            "id": "fixture:1",
            "title": "测试",
            "author": "作者",
            "paragraphs": ["天地玄黄。"],
            "format": {
                "sentence_count": 1,
                "sentence_lengths": [4],
                "uniform_sentence_length": 4,
            },
        }
    ]
    with gzip.open(path, mode="wt", encoding="utf-8") as file:
        for record in records:
            file.write(json.dumps(record, ensure_ascii=False))
            file.write("\n")
    return hashlib.sha256(path.read_bytes()).hexdigest()


def test_loads_and_verifies_remote_gzip_json(tmp_path: Path) -> None:
    path = tmp_path / "poems.json.gz"
    checksum = write_remote_fixture(path)
    repository = RemoteJsonPoemRepository(
        path.as_uri(),
        sha256=checksum,
        expected_count=1,
    )

    poems = repository.list_poems()

    assert len(poems) == 1
    assert poems[0].id == "fixture:1"


def test_rejects_remote_checksum_mismatch(tmp_path: Path) -> None:
    path = tmp_path / "poems.json.gz"
    write_remote_fixture(path)
    repository = RemoteJsonPoemRepository(
        path.as_uri(),
        sha256="0" * 64,
        expected_count=1,
    )

    with pytest.raises(ValueError, match="checksum mismatch"):
        repository.list_poems()
