# 中国古诗词数据概览

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

The app downloads the selected corpus from the pinned
[`vippeterhou/shici-data`](https://github.com/vippeterhou/shici-data) release
defined in `data_release.json`. Release assets are checksum-verified and cached
for the lifetime of the Streamlit server process.

### Preview local data changes

Build the same compressed artifacts used by production, then point the app at
the generated manifest:

```bash
cd ~/Github/shici-data
python3 scripts/build_release.py --version local

cd ~/Github/shici
SHICI_DATA_MANIFEST=../shici-data/dist/manifest.json \
  streamlit run app.py
```

The override is environment-only: `data_release.json` remains the production
source of truth. Local assets receive the same schema, checksum, and poem-count
validation as published release assets. Rebuilding changes their checksums and
invalidates the relevant Streamlit data caches.

## Test

```bash
pytest -q
```

## Architecture

`RemoteJsonPoemRepository` loads versioned, compressed artifacts from either
the pinned GitHub release or an explicitly selected local build, while
`poetry/analytics.py` contains framework-independent filtering and aggregation
logic. Raw-data maintenance, validation, processing, and release publishing
belong to `shici-data`.
