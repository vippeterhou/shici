# 中国古诗数据概览

A Streamlit dashboard for exploring the bundled 唐诗三百首, 全唐诗, 全宋诗,
and 诗经 datasets.

## Dashboard

- Exclusive corpus selection for 唐诗三百首, 全唐诗, 全宋诗, or 诗经
- Global filtering by author, format, and body text
- Hierarchical 诗经 filters and a flattened 风雅颂 classification chart
- Corpus metrics for poems, authors, and Han-character count
- Top-author poem-count chart with full-list expansion
- Character- and word-frequency analysis with poem drill-downs
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

## Test

```bash
pytest -q
```

## Architecture

`JsonPoemRepository` loads normalized JSON poetry records, while
`poetry/analytics.py` contains framework-independent filtering and aggregation
logic. A future Supabase repository can replace JSON storage without coupling
the dashboard to a specific data source.

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
