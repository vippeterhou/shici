from __future__ import annotations

from functools import partial
from pathlib import Path

import altair as alt
import pandas as pd
import streamlit as st

from poetry.analytics import (
    author_counts,
    character_counts,
    duplicate_text_groups,
    filter_poems,
    length_distribution,
    poem_character_count,
    poems_containing_character,
    poems_in_length_bucket,
    poem_text,
    summarize,
    tag_counts,
    title_counts,
)
from poetry.json_repository import JsonPoemRepository
from poetry.models import Poem

DATA_PATH = Path(__file__).parent / "data" / "tangshisanbaishou.json"

st.set_page_config(
    page_title="唐诗三百首数据仪表板",
    page_icon="诗",
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


def selected_chart_value(event: object, selection_name: str, field: str) -> str | None:
    if event is None:
        return None
    selection = getattr(event, "selection", {})
    selected_points = selection.get(selection_name, [])
    if not selected_points:
        return None
    return selected_points[0].get(field)


def activate_chart_drilldown(
    chart_key: str,
    selection_name: str,
    field: str,
    kind: str,
) -> None:
    value = selected_chart_value(
        st.session_state.get(chart_key),
        selection_name,
        field,
    )
    if value:
        st.session_state["active_drilldown"] = {
            "kind": kind,
            "value": value,
        }
    elif st.session_state.get("active_drilldown", {}).get("kind") == kind:
        st.session_state.pop("active_drilldown", None)


def clear_active_drilldown() -> None:
    st.session_state.pop("active_drilldown", None)


@st.dialog(
    "诗作明细",
    width="large",
    dismissible=True,
    on_dismiss=clear_active_drilldown,
)
def render_poem_collection(
    heading: str,
    selected_poems: list[Poem],
    *,
    key: str,
) -> None:
    if not selected_poems:
        return

    st.markdown(f"**{heading} · {len(selected_poems)} 首**")
    rows = [
        {
            "题目": poem.title,
            "作者": poem.author,
            "字数": poem_character_count(poem),
            "正文": poem_text(poem),
        }
        for poem in selected_poems
    ]
    st.dataframe(
        pd.DataFrame(rows),
        hide_index=True,
        width="stretch",
        height=min(420, 38 + len(rows) * 35),
        key=key,
        column_config={
            "题目": st.column_config.TextColumn(width="medium"),
            "作者": st.column_config.TextColumn(width="small"),
            "字数": st.column_config.NumberColumn(width="small"),
            "正文": st.column_config.TextColumn(width="large"),
        },
    )

with st.sidebar:
    st.header("筛选")
    selected_authors = st.multiselect("作者", all_authors)
    selected_tags = st.multiselect("标签（符合任一）", all_tags)
    selected_length = st.slider(
        "篇幅（字数）",
        min_value=min(all_lengths),
        max_value=max(all_lengths),
        value=(min(all_lengths), max(all_lengths)),
    )
    text_query = st.text_input("正文包含", placeholder="例如：明月")
    st.caption("所有图表和表格会随筛选条件同步更新。")

filtered_poems = filter_poems(
    poems,
    authors=selected_authors,
    tags=selected_tags,
    length_range=selected_length,
    text_query=text_query,
)
summary = summarize(filtered_poems)

st.title("唐诗三百首数据仪表板")
st.caption("探索作者、标签、篇幅、常用字与数据质量")

metric_columns = st.columns(5)
metric_columns[0].metric("诗作", f"{summary.poem_count:,}")
metric_columns[1].metric("作者", f"{summary.author_count:,}")
metric_columns[2].metric("标签", f"{summary.tag_count:,}")
metric_columns[3].metric("总字数", f"{summary.character_count:,}")
metric_columns[4].metric("平均篇幅", f"{summary.average_characters:.1f}")

if not filtered_poems:
    st.warning("目前的筛选条件没有符合的诗作。")
    st.stop()

overview_tab, characters_tab, explorer_tab, quality_tab = st.tabs(
    ["总览", "常用字", "诗作浏览", "数据质量"]
)

with overview_tab:
    author_column, length_column = st.columns(2)

    with author_column:
        st.subheader("作品最多的作者")
        author_data = pd.DataFrame(
            author_counts(filtered_poems)[:15],
            columns=["作者", "诗作数"],
        )
        author_selection = alt.selection_point(
            name="author_selection",
            fields=["作者"],
            clear="dblclick",
        )
        author_chart = (
            alt.Chart(author_data)
            .mark_bar()
            .encode(
                x=alt.X(
                    "诗作数:Q",
                    title="诗作数",
                    scale=alt.Scale(domainMin=0, nice=True),
                ),
                y=alt.Y("作者:N", title=None, sort="-x"),
                tooltip=["作者:N", "诗作数:Q"],
                opacity=alt.condition(author_selection, alt.value(1), alt.value(0.55)),
            )
            .add_params(author_selection)
            .properties(height=430)
        )
        st.altair_chart(
            author_chart,
            use_container_width=True,
            key="author-chart",
            on_select=partial(
                activate_chart_drilldown,
                "author-chart",
                "author_selection",
                "作者",
                "author",
            ),
            selection_mode="author_selection",
        )

    with length_column:
        st.subheader("篇幅分布")
        length_data = pd.DataFrame(
            length_distribution(filtered_poems),
            columns=["字数范围", "诗作数"],
        )
        length_selection = alt.selection_point(
            name="length_selection",
            fields=["字数范围"],
            clear="dblclick",
        )
        length_chart = (
            alt.Chart(length_data)
            .mark_bar()
            .encode(
                x=alt.X("字数范围:N", title="字数范围", sort=None),
                y=alt.Y(
                    "诗作数:Q",
                    title="诗作数",
                    scale=alt.Scale(domainMin=0, nice=True),
                ),
                tooltip=["字数范围:N", "诗作数:Q"],
                opacity=alt.condition(length_selection, alt.value(1), alt.value(0.55)),
            )
            .add_params(length_selection)
            .properties(height=430)
        )
        st.altair_chart(
            length_chart,
            use_container_width=True,
            key="length-chart",
            on_select=partial(
                activate_chart_drilldown,
                "length-chart",
                "length_selection",
                "字数范围",
                "length",
            ),
            selection_mode="length_selection",
        )

    st.subheader("最常见标签")
    tag_data = pd.DataFrame(
        tag_counts(filtered_poems)[:20],
        columns=["标签", "诗作数"],
    )
    tag_selection = alt.selection_point(
        name="tag_selection",
        fields=["标签"],
        clear="dblclick",
    )
    tag_chart = (
        alt.Chart(tag_data)
        .mark_bar()
        .encode(
            x=alt.X(
                "诗作数:Q",
                title="诗作数",
                scale=alt.Scale(domainMin=0, nice=True),
            ),
            y=alt.Y("标签:N", title=None, sort="-x"),
            tooltip=["标签:N", "诗作数:Q"],
            opacity=alt.condition(tag_selection, alt.value(1), alt.value(0.55)),
        )
        .add_params(tag_selection)
        .properties(height=480)
    )
    st.altair_chart(
        tag_chart,
        use_container_width=True,
        key="tag-chart",
        on_select=partial(
            activate_chart_drilldown,
            "tag-chart",
            "tag_selection",
            "标签",
            "tag",
        ),
        selection_mode="tag_selection",
    )

with characters_tab:
    st.subheader("正文常用字")
    character_limit = st.slider("显示数量", 10, 100, 30, 5)
    character_data = pd.DataFrame(
        character_counts(filtered_poems)[:character_limit],
        columns=["字", "出现次数"],
    )
    chart_column, table_column = st.columns([3, 2])
    with chart_column:
        character_selection = alt.selection_point(
            name="character_selection",
            fields=["字"],
            clear="dblclick",
        )
        character_chart = (
            alt.Chart(character_data)
            .mark_bar()
            .encode(
                x=alt.X(
                    "出现次数:Q",
                    title="出现次数",
                    scale=alt.Scale(domainMin=0, nice=True),
                ),
                y=alt.Y(
                    "字:N",
                    title=None,
                    sort="-x",
                    axis=alt.Axis(labelOverlap=False),
                ),
                tooltip=["字:N", "出现次数:Q"],
                opacity=alt.condition(
                    character_selection,
                    alt.value(1),
                    alt.value(0.55),
                ),
            )
            .add_params(character_selection)
            .properties(height=max(400, character_limit * 22))
        )
        st.altair_chart(
            character_chart,
            use_container_width=True,
            key="character-chart",
            on_select=partial(
                activate_chart_drilldown,
                "character-chart",
                "character_selection",
                "字",
                "character",
            ),
            selection_mode="character_selection",
        )
    with table_column:
        st.dataframe(character_data, hide_index=True, width="stretch")
    st.caption("只统计汉字，排除标点、空格、数字及其他非汉字。")

with explorer_tab:
    st.subheader("诗作目录")
    poem_rows = [
        {
            "题目": poem.title,
            "作者": poem.author,
            "篇幅": poem_character_count(poem),
            "段落": len(poem.paragraphs),
            "标签数": len(poem.tags),
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
    selected_poem_label = st.selectbox("阅读诗作", poem_options)
    selected_poem = poem_options[selected_poem_label]
    detail_column, metadata_column = st.columns([3, 1])
    with detail_column:
        st.markdown(f"### {selected_poem.title}")
        for paragraph in selected_poem.paragraphs:
            st.write(paragraph)
    with metadata_column:
        st.markdown(f"**作者**  \n{selected_poem.author}")
        st.markdown(f"**篇幅**  \n{poem_character_count(selected_poem)} 字")
        st.markdown(f"**标签**  \n{'、'.join(selected_poem.tags) or '无'}")

with quality_tab:
    duplicates = duplicate_text_groups(filtered_poems)
    repeated_titles = [
        (title, count)
        for title, count in title_counts(filtered_poems)
        if count > 1
    ]
    missing_tags = sum(not poem.tags for poem in filtered_poems)

    quality_metrics = st.columns(3)
    quality_metrics[0].metric("完全相同正文组", len(duplicates))
    quality_metrics[1].metric("重复题目", len(repeated_titles))
    quality_metrics[2].metric("无标签诗作", missing_tags)

    duplicate_column, title_column = st.columns(2)
    with duplicate_column:
        st.subheader("完全相同正文")
        if duplicates:
            duplicate_rows = [
                {
                    "作品数": len(group),
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
            st.success("没有发现完全相同的正文。")

    with title_column:
        st.subheader("重复题目")
        if repeated_titles:
            st.dataframe(
                pd.DataFrame(repeated_titles, columns=["题目", "作品数"]),
                hide_index=True,
                width="stretch",
            )
        else:
            st.success("没有重复题目。")

active_drilldown = st.session_state.get("active_drilldown")
if active_drilldown:
    drilldown_kind = active_drilldown["kind"]
    drilldown_value = active_drilldown["value"]

    if drilldown_kind == "author":
        drilldown_heading = drilldown_value
        drilldown_poems = [
            poem for poem in filtered_poems if poem.author == drilldown_value
        ]
    elif drilldown_kind == "length":
        drilldown_heading = f"{drilldown_value} 字"
        drilldown_poems = poems_in_length_bucket(filtered_poems, drilldown_value)
    elif drilldown_kind == "tag":
        drilldown_heading = drilldown_value
        drilldown_poems = [
            poem for poem in filtered_poems if drilldown_value in poem.tags
        ]
    else:
        drilldown_heading = f"包含「{drilldown_value}」"
        drilldown_poems = poems_containing_character(
            filtered_poems,
            drilldown_value,
        )

    if drilldown_poems:
        render_poem_collection(
            drilldown_heading,
            drilldown_poems,
            key=f"{drilldown_kind}-poems-dialog",
        )
    else:
        clear_active_drilldown()
