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
    format_combination_counts,
    length_distribution,
    line_length_type_counts,
    poem_character_count,
    poems_containing_character,
    poems_in_length_bucket,
    poems_with_format_combination,
    poems_with_line_length_type,
    poems_with_sentence_count,
    poems_with_structure_type,
    poem_text,
    sentence_count_distribution,
    structure_type_counts,
    summarize,
    tag_counts,
    title_counts,
)
from poetry.json_repository import JsonPoemRepository
from poetry.models import Poem

DATA_PATH = Path(__file__).parent / "data" / "tangshisanbaishou.json"
DATA_SCHEMA_VERSION = 2

st.set_page_config(
    page_title="唐诗三百首数据仪表板",
    page_icon="诗",
    layout="wide",
)

@st.cache_data(show_spinner=False)
def load_poems(
    data_path: str,
    modified_time_ns: int,
    schema_version: int,
) -> tuple[Poem, ...]:
    _ = modified_time_ns, schema_version
    return JsonPoemRepository(data_path).list_poems()


poems = load_poems(
    str(DATA_PATH),
    DATA_PATH.stat().st_mtime_ns,
    DATA_SCHEMA_VERSION,
)
all_lengths = [poem_character_count(poem) for poem in poems]
all_authors = sorted({poem.author for poem in poems})
all_tags = sorted({tag for poem in poems for tag in poem.tags})


def selected_chart_record(
    event: object,
    selection_name: str,
) -> dict[str, object] | None:
    if event is None:
        return None
    selection = getattr(event, "selection", {})
    selected_points = selection.get(selection_name, [])
    if not selected_points:
        return None
    return dict(selected_points[0])


def activate_chart_drilldown(
    chart_key: str,
    selection_name: str,
    kind: str,
) -> None:
    selected_record = selected_chart_record(
        st.session_state.get(chart_key),
        selection_name,
    )
    if selected_record:
        st.session_state["active_drilldown"] = {
            "kind": kind,
            "selection": selected_record,
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
            "tag",
        ),
        selection_mode="tag_selection",
    )

    st.divider()
    st.subheader("格式分析")
    st.caption("点击柱形或热力图单元格查看对应的全部诗作。")

    sentence_column, line_type_column = st.columns(2)

    with sentence_column:
        st.markdown("#### 句数分布")
        sentence_data = pd.DataFrame(
            sentence_count_distribution(filtered_poems),
            columns=["句数", "诗作数"],
        )
        sentence_selection = alt.selection_point(
            name="sentence_selection",
            fields=["句数"],
            clear="dblclick",
        )
        sentence_chart = (
            alt.Chart(sentence_data)
            .mark_bar()
            .encode(
                x=alt.X("句数:O", title="句数", sort="ascending"),
                y=alt.Y(
                    "诗作数:Q",
                    title="诗作数",
                    scale=alt.Scale(domainMin=0, nice=True),
                ),
                tooltip=["句数:O", "诗作数:Q"],
                opacity=alt.condition(
                    sentence_selection,
                    alt.value(1),
                    alt.value(0.55),
                ),
            )
            .add_params(sentence_selection)
            .properties(height=330)
        )
        st.altair_chart(
            sentence_chart,
            use_container_width=True,
            key="sentence-chart",
            on_select=partial(
                activate_chart_drilldown,
                "sentence-chart",
                "sentence_selection",
                "sentence_count",
            ),
            selection_mode="sentence_selection",
        )

    with line_type_column:
        st.markdown("#### 每句字数类型")
        line_type_data = pd.DataFrame(
            line_length_type_counts(filtered_poems),
            columns=["类型", "诗作数"],
        )
        line_type_selection = alt.selection_point(
            name="line_type_selection",
            fields=["类型"],
            clear="dblclick",
        )
        line_type_chart = (
            alt.Chart(line_type_data)
            .mark_bar()
            .encode(
                x=alt.X(
                    "诗作数:Q",
                    title="诗作数",
                    scale=alt.Scale(domainMin=0, nice=True),
                ),
                y=alt.Y("类型:N", title=None, sort="-x"),
                tooltip=["类型:N", "诗作数:Q"],
                opacity=alt.condition(
                    line_type_selection,
                    alt.value(1),
                    alt.value(0.55),
                ),
            )
            .add_params(line_type_selection)
            .properties(height=330)
        )
        st.altair_chart(
            line_type_chart,
            use_container_width=True,
            key="line-type-chart",
            on_select=partial(
                activate_chart_drilldown,
                "line-type-chart",
                "line_type_selection",
                "line_type",
            ),
            selection_mode="line_type_selection",
        )

    combination_column, structure_column = st.columns([3, 2])

    with combination_column:
        st.markdown("#### 句数 × 每句字数类型")
        combination_data = pd.DataFrame(
            format_combination_counts(filtered_poems),
            columns=["句数", "类型", "诗作数"],
        )
        combination_selection = alt.selection_point(
            name="combination_selection",
            fields=["句数", "类型"],
            clear="dblclick",
        )
        combination_base = alt.Chart(combination_data).encode(
            x=alt.X("类型:N", title="每句字数类型"),
            y=alt.Y(
                "句数:O",
                title="句数",
                sort="ascending",
                axis=alt.Axis(labelOverlap=False),
            ),
            tooltip=["句数:O", "类型:N", "诗作数:Q"],
        )
        combination_chart = (
            combination_base.mark_rect()
            .encode(
            color=alt.Color(
                "诗作数:Q",
                title="诗作数",
                scale=alt.Scale(scheme="reds"),
            ),
            opacity=alt.condition(
                combination_selection,
                alt.value(1),
                alt.value(0.65),
            ),
            )
            .add_params(combination_selection)
            .properties(height=420)
        )
        st.altair_chart(
            combination_chart,
            use_container_width=True,
            key="combination-chart",
            on_select=partial(
                activate_chart_drilldown,
                "combination-chart",
                "combination_selection",
                "combination",
            ),
            selection_mode="combination_selection",
        )

    with structure_column:
        st.markdown("#### 结构类型")
        structure_data = pd.DataFrame(
            structure_type_counts(filtered_poems),
            columns=["结构类型", "诗作数"],
        )
        structure_selection = alt.selection_point(
            name="structure_selection",
            fields=["结构类型"],
            clear="dblclick",
        )
        structure_chart = (
            alt.Chart(structure_data)
            .mark_bar()
            .encode(
                x=alt.X(
                    "诗作数:Q",
                    title="诗作数",
                    scale=alt.Scale(domainMin=0, nice=True),
                ),
                y=alt.Y("结构类型:N", title=None, sort="-x"),
                tooltip=["结构类型:N", "诗作数:Q"],
                opacity=alt.condition(
                    structure_selection,
                    alt.value(1),
                    alt.value(0.55),
                ),
            )
            .add_params(structure_selection)
            .properties(height=420)
        )
        st.altair_chart(
            structure_chart,
            use_container_width=True,
            key="structure-chart",
            on_select=partial(
                activate_chart_drilldown,
                "structure-chart",
                "structure_selection",
                "structure",
            ),
            selection_mode="structure_selection",
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
    drilldown_selection = active_drilldown["selection"]

    if drilldown_kind == "author":
        drilldown_value = str(drilldown_selection["作者"])
        drilldown_heading = drilldown_value
        drilldown_poems = [
            poem for poem in filtered_poems if poem.author == drilldown_value
        ]
    elif drilldown_kind == "length":
        drilldown_value = str(drilldown_selection["字数范围"])
        drilldown_heading = f"{drilldown_value} 字"
        drilldown_poems = poems_in_length_bucket(filtered_poems, drilldown_value)
    elif drilldown_kind == "tag":
        drilldown_value = str(drilldown_selection["标签"])
        drilldown_heading = drilldown_value
        drilldown_poems = [
            poem for poem in filtered_poems if drilldown_value in poem.tags
        ]
    elif drilldown_kind == "character":
        drilldown_value = str(drilldown_selection["字"])
        drilldown_heading = f"包含「{drilldown_value}」"
        drilldown_poems = poems_containing_character(
            filtered_poems,
            drilldown_value,
        )
    elif drilldown_kind == "sentence_count":
        sentence_count = int(drilldown_selection["句数"])
        drilldown_heading = f"{sentence_count} 句"
        drilldown_poems = poems_with_sentence_count(
            filtered_poems,
            sentence_count,
        )
    elif drilldown_kind == "line_type":
        line_type = str(drilldown_selection["类型"])
        drilldown_heading = line_type
        drilldown_poems = poems_with_line_length_type(
            filtered_poems,
            line_type,
        )
    elif drilldown_kind == "combination":
        sentence_count = int(drilldown_selection["句数"])
        line_type = str(drilldown_selection["类型"])
        drilldown_heading = f"{sentence_count} 句 · {line_type}"
        drilldown_poems = poems_with_format_combination(
            filtered_poems,
            sentence_count,
            line_type,
        )
    else:
        selected_structure_type = str(drilldown_selection["结构类型"])
        drilldown_heading = selected_structure_type
        drilldown_poems = poems_with_structure_type(
            filtered_poems,
            selected_structure_type,
        )

    if drilldown_poems:
        render_poem_collection(
            drilldown_heading,
            drilldown_poems,
            key=f"{drilldown_kind}-poems-dialog",
        )
    else:
        clear_active_drilldown()
