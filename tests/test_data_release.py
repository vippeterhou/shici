from __future__ import annotations

import json
from pathlib import Path

import pytest

from poetry.data_release import corpus_source, load_data_release


CHECKSUM = "a" * 64


def write_manifest(
    path: Path,
    *,
    repository: str | None = None,
    schema_version: int = 2,
) -> None:
    manifest = {
        "version": "v1.2.3",
        "schema_version": schema_version,
        "corpora": {
            "qts": {
                "asset": "qts.jsonl.gz",
                "poem_count": 2,
                "sha256": CHECKSUM,
            }
        },
    }
    if repository is not None:
        manifest["repository"] = repository
    path.write_text(json.dumps(manifest), encoding="utf-8")


def test_resolves_remote_release_asset(tmp_path: Path) -> None:
    config_path = tmp_path / "data_release.json"
    write_manifest(config_path, repository="owner/data")

    release = load_data_release(config_path)
    source = corpus_source(release, "qts")

    assert source.location == (
        "https://github.com/owner/data/releases/download/"
        "v1.2.3/qts.jsonl.gz"
    )
    assert source.version == ("release", "v1.2.3", CHECKSUM)
    assert release.display_version == "v1.2.3"


def test_resolves_local_asset_beside_manifest(tmp_path: Path) -> None:
    manifest_path = tmp_path / "manifest.json"
    asset_path = tmp_path / "qts.jsonl.gz"
    asset_path.touch()
    write_manifest(manifest_path)

    release = load_data_release(
        tmp_path / "unused.json",
        str(manifest_path),
    )
    source = corpus_source(release, "qts")

    assert source.location == asset_path.as_uri()
    assert source.version == ("local", "v1.2.3", CHECKSUM)
    assert release.display_version == "v1.2.3（本地）"


def test_rejects_missing_local_asset(tmp_path: Path) -> None:
    manifest_path = tmp_path / "manifest.json"
    write_manifest(manifest_path)
    release = load_data_release(
        tmp_path / "unused.json",
        str(manifest_path),
    )

    with pytest.raises(FileNotFoundError, match="Local data asset not found"):
        corpus_source(release, "qts")


def test_rejects_unsupported_schema(tmp_path: Path) -> None:
    manifest_path = tmp_path / "manifest.json"
    write_manifest(manifest_path, schema_version=3)

    with pytest.raises(
        ValueError,
        match="Unsupported data release schema version",
    ):
        load_data_release(tmp_path / "unused.json", str(manifest_path))
