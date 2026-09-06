# 唐诗三百首数据仪表板

A Streamlit dashboard for exploring the bundled 唐诗三百首 dataset.

## Dashboard

- Global filtering by author, tag, poem length, and body text
- Corpus metrics for poems, authors, tags, Han-character count, and average length
- Top-author and poem-length charts
- Tag and character-frequency analysis
- Sentence-count, line-length, structure, and format-combination analysis
- Clickable chart drill-downs that open matching poems in a modal
- Interactive poem catalog and reader
- Duplicate-text, repeated-title, and missing-tag quality checks

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

`JsonPoemRepository` loads `data/tangshisanbaishou.json`, while
`poetry/analytics.py` contains framework-independent filtering and aggregation
logic. A future Supabase repository can replace JSON storage without coupling
the dashboard to a specific data source.

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
python -m scripts.enrich_format data/tangshisanbaishou.json
```
