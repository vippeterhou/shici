# 中国古诗数据概览

A Streamlit dashboard for exploring Chinese poetry from 诗经 through the
秦汉, 魏晋南北朝, 唐, and 宋 corpora.

## Dashboard

- Exclusive, chronological corpus selection from 诗经 through 全宋诗
- Global filtering by author, format, and body text
- Hierarchical 诗经 filters and a flattened 风雅颂 classification chart
- Corpus metrics for poems, authors, and Han-character count
- Top-author poem-count chart with full-list expansion
- Character-, bigram-, and trigram-frequency analysis with poem drill-downs
- Sentence-count, line-length, structure, and format-combination analysis
- Dedicated format-distribution tab
- Clickable chart drill-downs that open matching poems in a modal
- Interactive poem catalog and reader
- Duplicate-text quality checks

## Run locally

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
streamlit run app.py
```

Open <http://localhost:8501>.

By default, the app downloads the selected corpus from the pinned
[`vippeterhou/shici-data`](https://github.com/vippeterhou/shici-data) release
defined in `data_release.json`. Release assets are checksum-verified and cached
for the lifetime of the Streamlit server process.

Use the retained local data copy for offline development:

```bash
SHICI_DATA_SOURCE=local streamlit run app.py
```

## Test

```bash
pytest -q
```

## Architecture

`RemoteJsonPoemRepository` loads versioned, compressed release assets from the
independent data repository. `JsonPoemRepository` remains available for local
and offline development, while
`poetry/analytics.py` contains framework-independent filtering and aggregation
logic. The local `data/` directory is temporarily retained while the remote
release path is verified.

The 全宋诗 corpus is derived from
[`chinese-poetry/chinese-poetry`](https://github.com/chinese-poetry/chinese-poetry)
and is distributed under the MIT license included in
`data/quansongshi/LICENSE`. Empty records and records containing only
placeholder squares are excluded during normalization.

Each poem includes deterministic format metadata:

```json
{
  "format": {
    "sentence_count": 4,
    "sentence_lengths": [5, 5, 5, 5],
    "uniform_sentence_length": 5
  }
}
```

Regenerate this metadata after changing poem text:

```bash
python -m scripts.enrich_format data/ts300/ts300.json
```

The enrichment command also accepts a directory and processes every JSON file
directly inside it:

```bash
python -m scripts.enrich_format data/qts
```
