from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any


SUPPORTED_SCHEMA_VERSION = 2


@dataclass(frozen=True)
class CorpusAsset:
    name: str
    poem_count: int
    sha256: str


@dataclass(frozen=True)
class DataRelease:
    version: str
    schema_version: int
    corpora: dict[str, CorpusAsset]
    repository: str | None = None
    asset_directory: Path | None = None

    @property
    def is_local(self) -> bool:
        return self.asset_directory is not None

    @property
    def display_version(self) -> str:
        suffix = "（本地）" if self.is_local else ""
        return f"{self.version}{suffix}"


@dataclass(frozen=True)
class CorpusSource:
    location: str
    version: tuple[str, ...]
    checksum: str
    expected_count: int


def load_data_release(
    release_config_path: Path,
    local_manifest_path: str | None = None,
) -> DataRelease:
    if local_manifest_path:
        manifest_path = Path(local_manifest_path).expanduser().resolve()
        if not manifest_path.is_file():
            raise FileNotFoundError(
                f"Local data manifest not found: {manifest_path}"
            )
        config = _read_config(manifest_path)
        return _parse_config(config, asset_directory=manifest_path.parent)

    config = _read_config(release_config_path)
    return _parse_config(config)


def corpus_source(release: DataRelease, asset_key: str) -> CorpusSource:
    try:
        asset = release.corpora[asset_key]
    except KeyError as error:
        raise ValueError(
            f"Data manifest does not define corpus: {asset_key}"
        ) from error

    if release.asset_directory is not None:
        asset_path = (release.asset_directory / asset.name).resolve()
        if not asset_path.is_file():
            raise FileNotFoundError(
                f"Local data asset not found: {asset_path}"
            )
        location = asset_path.as_uri()
        source_version = ("local", release.version, asset.sha256)
    else:
        if release.repository is None:
            raise ValueError("Remote data release is missing its repository")
        location = (
            f"https://github.com/{release.repository}/releases/download/"
            f"{release.version}/{asset.name}"
        )
        source_version = ("release", release.version, asset.sha256)

    return CorpusSource(
        location=location,
        version=source_version,
        checksum=asset.sha256,
        expected_count=asset.poem_count,
    )


def _read_config(path: Path) -> dict[str, Any]:
    try:
        config = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as error:
        raise ValueError(f"Invalid data manifest JSON: {path}") from error
    if not isinstance(config, dict):
        raise ValueError(f"Data manifest must contain an object: {path}")
    return config


def _parse_config(
    config: dict[str, Any],
    *,
    asset_directory: Path | None = None,
) -> DataRelease:
    version = _required_string(config, "version")
    schema_version = config.get("schema_version")
    if schema_version != SUPPORTED_SCHEMA_VERSION:
        raise ValueError(
            "Unsupported data release schema version: "
            f"{schema_version}"
        )

    raw_corpora = config.get("corpora")
    if not isinstance(raw_corpora, dict):
        raise ValueError("Data manifest is missing its corpora")

    corpora = {
        str(key): _parse_corpus_asset(str(key), value)
        for key, value in raw_corpora.items()
    }
    repository = None
    if asset_directory is None:
        repository = _required_string(config, "repository")

    return DataRelease(
        version=version,
        schema_version=schema_version,
        corpora=corpora,
        repository=repository,
        asset_directory=asset_directory,
    )


def _parse_corpus_asset(key: str, value: object) -> CorpusAsset:
    if not isinstance(value, dict):
        raise ValueError(f"Invalid corpus metadata: {key}")
    poem_count = value.get("poem_count")
    if not isinstance(poem_count, int) or poem_count < 0:
        raise ValueError(f"Invalid poem count for corpus: {key}")
    sha256 = value.get("sha256")
    if not isinstance(sha256, str) or len(sha256) != 64:
        raise ValueError(f"Invalid checksum for corpus: {key}")
    asset = value.get("asset")
    if not isinstance(asset, str) or not asset:
        raise ValueError(f"Invalid asset name for corpus: {key}")
    return CorpusAsset(
        name=asset,
        poem_count=poem_count,
        sha256=sha256,
    )


def _required_string(config: dict[str, Any], key: str) -> str:
    value = config.get(key)
    if not isinstance(value, str) or not value:
        raise ValueError(f"Data manifest is missing {key}")
    return value
