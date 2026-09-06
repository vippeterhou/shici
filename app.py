from __future__ import annotations

from pathlib import Path

import pandas as pd
import streamlit as st

from poetry.analytics import (
    author_counts,
    character_counts,
    duplicate_text_groups,
    filter_poems,
    length_distribution,
    poem_character_count,
    poem_text,
    summarize,
    tag_counts,
    title_counts,
)
from poetry.json_repository import JsonPoemRepository

DATA_PATH = Path(__file__).parent / "data" / "唐诗三百首.json"

st.set_page_config(
    page_title="唐詩三百首資料儀表板",
    page_icon="詩",
    layout="wide",
)

@st.cache_resource
def load_repository() -> JsonPoemRepository:
    return JsonPoemRepository(DATA_PATH)


repository = load_repository()
poems = repository.list_poems()
all_lengths = [poem_character_count(poem) for poem in poems]
all_authors = sorted({poem.author for poem in poems})
all_tags = sorted({tag for poem in poems for tag in poem.tags})

with st.sidebar:
    st.header("篩選")
    selected_authors = st.multiselect("作者", all_authors)
    selected_tags = st.multiselect("標籤（符合任一）", all_tags)
    selected_length = st.slider(
        "篇幅（字数）",
        min_value=min(all_lengths),
        max_value=max(all_lengths),
        value=(min(all_lengths), max(all_lengths)),
    )
    text_query = st.text_input("正文包含", placeholder="例如：明月")
    st.caption("所有圖表和表格會隨篩選條件同步更新。")

filtered_poems = filter_poems(
    poems,
    authors=selected_authors,
    tags=selected_tags,
    length_range=selected_length,
    text_query=text_query,
)
summary = summarize(filtered_poems)

st.title("唐詩三百首資料儀表板")
st.caption("探索作者、標籤、篇幅、常用字與資料品質")

metric_columns = st.columns(5)
metric_columns[0].metric("詩作", f"{summary.poem_count:,}")
metric_columns[1].metric("作者", f"{summary.author_count:,}")
metric_columns[2].metric("標籤", f"{summary.tag_count:,}")
metric_columns[3].metric("總字数", f"{summary.character_count:,}")
metric_columns[4].metric("平均篇幅", f"{summary.average_characters:.1f}")

if not filtered_poems:
    st.warning("目前的篩選條件沒有符合的詩作。")
    st.stop()

overview_tab, characters_tab, explorer_tab, quality_tab = st.tabs(
    ["總覽", "常用字", "詩作瀏覽", "資料品質"]
)

with overview_tab:
    author_column, length_column = st.columns(2)

    with author_column:
        st.subheader("作品最多的作者")
        author_data = pd.DataFrame(
            author_counts(filtered_poems)[:15],
            columns=["作者", "詩作數"],
        ).set_index("作者")
        st.bar_chart(author_data, horizontal=True, height=430)

    with length_column:
        st.subheader("篇幅分布")
        length_data = pd.DataFrame(
            length_distribution(filtered_poems),
            columns=["字数範圍", "詩作數"],
        ).set_index("字数範圍")
        st.bar_chart(length_data, height=430)

    st.subheader("最常見標籤")
    tag_data = pd.DataFrame(
        tag_counts(filtered_poems)[:25],
        columns=["標籤", "詩作數"],
    )
    st.dataframe(
        tag_data,
        hide_index=True,
        width="stretch",
        column_config={
            "詩作數": st.column_config.ProgressColumn(
                "詩作數",
                min_value=0,
                max_value=int(tag_data["詩作數"].max()),
            )
        },
    )

with characters_tab:
    st.subheader("正文常用字")
    character_limit = st.slider("顯示數量", 10, 100, 30, 5)
    character_data = pd.DataFrame(
        character_counts(filtered_poems)[:character_limit],
        columns=["字", "出現次數"],
    )
    chart_column, table_column = st.columns([3, 2])
    with chart_column:
        st.bar_chart(
            character_data.set_index("字"),
            horizontal=True,
            height=max(400, character_limit * 22),
        )
    with table_column:
        st.dataframe(character_data, hide_index=True, width="stretch")
    st.caption("只統計漢字，排除標點、空格、數字及其他非漢字。")

with explorer_tab:
    st.subheader("詩作目錄")
    poem_rows = [
        {
            "題目": poem.title,
            "作者": poem.author,
            "篇幅": poem_character_count(poem),
            "段落": len(poem.paragraphs),
            "標籤數": len(poem.tags),
        }
        for poem in filtered_poems
    ]
    st.dataframe(
        pd.DataFrame(poem_rows),
        hide_index=True,
        width="stretch",
        height=360,
    )

    poem_options = {
        f"{poem.title} — {poem.author} [{poem.id[:8]}]": poem
        for poem in filtered_poems
    }
    selected_poem_label = st.selectbox("閱讀詩作", poem_options)
    selected_poem = poem_options[selected_poem_label]
    detail_column, metadata_column = st.columns([3, 1])
    with detail_column:
        st.markdown(f"### {selected_poem.title}")
        for paragraph in selected_poem.paragraphs:
            st.write(paragraph)
    with metadata_column:
        st.markdown(f"**作者**  \n{selected_poem.author}")
        st.markdown(f"**篇幅**  \n{poem_character_count(selected_poem)} 字")
        st.markdown(f"**標籤**  \n{'、'.join(selected_poem.tags) or '無'}")

with quality_tab:
    duplicates = duplicate_text_groups(filtered_poems)
    repeated_titles = [
        (title, count)
        for title, count in title_counts(filtered_poems)
        if count > 1
    ]
    missing_tags = sum(not poem.tags for poem in filtered_poems)

    quality_metrics = st.columns(3)
    quality_metrics[0].metric("完全相同正文組", len(duplicates))
    quality_metrics[1].metric("重複題目", len(repeated_titles))
    quality_metrics[2].metric("無標籤詩作", missing_tags)

    duplicate_column, title_column = st.columns(2)
    with duplicate_column:
        st.subheader("完全相同正文")
        if duplicates:
            duplicate_rows = [
                {
                    "作品數": len(group),
                    "作品": "；".join(
                        f"{poem.title}（{poem.author}）" for poem in group
                    ),
                }
                for group in duplicates
            ]
            st.dataframe(
                pd.DataFrame(duplicate_rows),
                hide_index=True,
                width="stretch",
            )
        else:
            st.success("沒有發現完全相同的正文。")

    with title_column:
        st.subheader("重複題目")
        if repeated_titles:
            st.dataframe(
                pd.DataFrame(repeated_titles, columns=["題目", "作品數"]),
                hide_index=True,
                width="stretch",
            )
        else:
            st.success("沒有重複題目。")
