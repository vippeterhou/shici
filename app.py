from __future__ import annotations

import html
from dataclasses import dataclass
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
    format_bucket_combination_counts,
    format_combination_counts,
    line_length_type_counts,
    poem_character_count,
    poems_containing_character,
    poems_containing_word,
    poems_with_format_bucket_combination,
    poems_with_format_combination,
    poems_with_line_length_type,
    poems_with_sentence_count_bucket,
    poems_with_sentence_count,
    poems_with_structure_breakdown,
    poems_with_structure_type,
    poem_text,
    sentence_count_bucket_distribution,
    sentence_count_distribution,
    structure_breakdown_counts,
    structure_type_counts,
    summarize,
    title_counts,
    word_counts,
)
from poetry.json_repository import JsonPoemRepository
from poetry.models import Poem


@dataclass(frozen=True)
class CorpusConfig:
    query_id: str
    path: Path


DATA_DIRECTORY = Path(__file__).parent / "data"
CORPORA = {
    "唐诗三百首": CorpusConfig(
        query_id="ts300",
        path=DATA_DIRECTORY / "ts300" / "ts300.json",
    ),
    "全唐诗": CorpusConfig(
        query_id="qts",
        path=DATA_DIRECTORY / "qts",
    ),
}
DEFAULT_CORPORA = ["唐诗三百首"]
DATA_SCHEMA_VERSION = 3
AUTHOR_PREVIEW_LIMIT = 20
FREQUENCY_DISPLAY_LIMIT = 100
FREQUENCY_BAR_HEIGHT = 22
FREQUENCY_TABLE_ROW_HEIGHT = 21
DATAFRAME_HEADER_HEIGHT = 38
BAR_COLOR = "#3F7C73"
CORPUS_QUERY_PARAMETER = "corpus"

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


@st.cache_data(show_spinner=False, max_entries=8)
def cached_word_counts(
    cache_key: tuple[object, ...],
    _selected_poems: tuple[Poem, ...],
) -> list[tuple[str, int]]:
    _ = cache_key
    return word_counts(_selected_poems)


def corpus_modified_time_ns(path: Path) -> int:
    if path.is_file():
        return path.stat().st_mtime_ns
    return max(
        (file_path.stat().st_mtime_ns for file_path in path.glob("*.json")),
        default=path.stat().st_mtime_ns,
    )


def corpora_from_query_parameters() -> list[str]:
    requested_ids = set(
        st.query_params.get_all(CORPUS_QUERY_PARAMETER)
    )
    return [
        corpus_name
        for corpus_name, config in CORPORA.items()
        if config.query_id in requested_ids
    ]


def update_corpus_query_parameters() -> None:
    selected_corpora = st.session_state["selected_corpora"]
    if selected_corpora == DEFAULT_CORPORA:
        if CORPUS_QUERY_PARAMETER in st.query_params:
            del st.query_params[CORPUS_QUERY_PARAMETER]
        return

    selected_ids = [
        CORPORA[corpus_name].query_id for corpus_name in selected_corpora
    ]
    if selected_ids:
        st.query_params[CORPUS_QUERY_PARAMETER] = selected_ids
    elif CORPUS_QUERY_PARAMETER in st.query_params:
        del st.query_params[CORPUS_QUERY_PARAMETER]


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


def chart_widget_key(base_key: str) -> str:
    reset_version = st.session_state.get("chart_reset_version", 0)
    return f"{base_key}-{reset_version}"


def with_percentage(
    data: pd.DataFrame,
    count_column: str,
    total: int,
) -> pd.DataFrame:
    result = data.copy()
    result["占比"] = result[count_column] / total if total else 0
    return result


def clear_active_drilldown() -> None:
    st.session_state.pop("active_drilldown", None)
    st.session_state["chart_reset_version"] = (
        st.session_state.get("chart_reset_version", 0) + 1
    )


def poem_text_html(poem: Poem, highlight_text: str | None = None) -> str:
    text = poem_text(poem)
    if not highlight_text:
        return html.escape(text)

    highlighted = (
        f'<span class="poem-grid-highlight">{html.escape(highlight_text)}</span>'
    )
    return highlighted.join(html.escape(part) for part in text.split(highlight_text))


@st.dialog(
    "诗作明细",
    width="large",
    dismissible=True,
    on_dismiss=clear_active_drilldown,
)
def render_poem_collection(
    heading: str,
    selected_poems: list[Poem],
    highlight_text: str | None = None,
) -> None:
    if not selected_poems:
        return

    st.markdown(f"**{heading} · {len(selected_poems)} 首**")
    rows = "".join(
        (
            '<div class="poem-grid-row">'
            f"<div>{html.escape(poem.title)}</div>"
            f"<div>{html.escape(poem.author)}</div>"
            f"<div>{poem.format.uniform_sentence_length or '杂'}</div>"
            f"<div>{poem.format.sentence_count}</div>"
            f"<div>{poem_character_count(poem)}</div>"
            f'<div class="poem-grid-text">{poem_text_html(poem, highlight_text)}</div>'
            "</div>"
        )
        for poem in selected_poems
    )
    st.markdown(
        f"""
        <style>
        .poem-grid {{
          border: 1px solid rgba(127, 127, 127, 0.28);
          border-radius: 0.5rem;
          max-height: 68vh;
          overflow: auto;
        }}
        .poem-grid-header,
        .poem-grid-row {{
          display: grid;
          grid-template-columns: 108px 62px 28px 28px 42px minmax(420px, 1fr);
          column-gap: 6px;
          padding: 0.42rem 0.5rem;
        }}
        .poem-grid-header {{
          background: rgba(127, 127, 127, 0.14);
          font-size: 0.76rem;
          font-weight: 700;
          position: sticky;
          top: 0;
          z-index: 1;
        }}
        .poem-grid-row {{
          border-top: 1px solid rgba(127, 127, 127, 0.18);
          font-size: 0.78rem;
          line-height: 1.45;
        }}
        .poem-grid-row > div:nth-child(3),
        .poem-grid-row > div:nth-child(4),
        .poem-grid-row > div:nth-child(5) {{
          text-align: center;
        }}
        .poem-grid-text {{
          white-space: normal;
          word-break: break-word;
        }}
        .poem-grid .poem-grid-highlight {{
          background: #ffe066 !important;
          border-bottom: 2px solid #d98e00;
          border-radius: 0.15rem;
          color: #1f2328 !important;
          font-weight: 700;
          padding: 0.02rem 0.12rem;
        }}
        </style>
        <div class="poem-grid">
          <div class="poem-grid-header">
            <div>题目</div><div>作者</div><div>言</div>
            <div>句</div><div>字数</div><div>正文</div>
          </div>
          {rows}
        </div>
        """,
        unsafe_allow_html=True,
    )

with st.sidebar:
    st.header("筛选")
    default_corpora = corpora_from_query_parameters() or DEFAULT_CORPORA
    selected_corpora = st.pills(
        "数据集",
        list(CORPORA),
        selection_mode="multi",
        default=default_corpora,
        key="selected_corpora",
        on_change=update_corpus_query_parameters,
    )
    if not selected_corpora:
        st.warning("请至少选择一个数据集。")
        st.stop()

    selected_corpus_versions = {
        corpus_name: corpus_modified_time_ns(CORPORA[corpus_name].path)
        for corpus_name in selected_corpora
    }
    poems = tuple(
        poem
        for corpus_name in selected_corpora
        for poem in load_poems(
            str(CORPORA[corpus_name].path),
            selected_corpus_versions[corpus_name],
            DATA_SCHEMA_VERSION,
        )
    )
    all_authors = sorted({poem.author for poem in poems})
    all_line_types = [name for name, _ in line_length_type_counts(poems)]
    all_sentence_counts = sorted({poem.format.sentence_count for poem in poems})
    selected_authors = st.multiselect("作者", all_authors)
    with st.expander("格式", expanded=True):
        selected_line_types = st.multiselect("言", all_line_types)
        selected_sentence_counts = st.multiselect(
            "句数",
            all_sentence_counts,
        )
    text_query = st.text_input("正文包含", placeholder="例如：明月")
    st.caption("所有图表和表格会随筛选条件同步更新。")

filtered_poems = filter_poems(
    poems,
    authors=selected_authors,
    line_types=selected_line_types,
    sentence_counts=selected_sentence_counts,
    text_query=text_query,
)
summary = summarize(filtered_poems)

st.title("唐诗数据仪表板")
st.caption(f"当前数据集：{'、'.join(selected_corpora)}")
st.caption("探索作者、格式、常用字与数据质量")
if len(selected_corpora) > 1:
    st.info(
        "合并统计按原始作者名精确匹配，作者异名不会自动合并；"
        "两个数据集中的相同诗作也不会自动去重，因此可能重复计数。"
        "仅有异体字、繁简或标点差异的诗作也会被视为不同记录。"
    )

metric_columns = st.columns(3)
metric_columns[0].metric("诗作", f"{summary.poem_count:,}")
metric_columns[1].metric("作者", f"{summary.author_count:,}")
metric_columns[2].metric("总字数", f"{summary.character_count:,}")

if not filtered_poems:
    st.warning("目前的筛选条件没有符合的诗作。")
    st.stop()

overview_tab, format_tab, characters_tab, explorer_tab, quality_tab = st.tabs(
    ["总览", "格式分布", "常用字词", "诗作浏览", "数据质量"]
)

with format_tab:
    st.subheader("格式分布")
    st.caption("点击柱形或热力图单元格查看对应的全部诗作。")
    option_columns = st.columns(2)
    with option_columns[0]:
        group_large_sentence_counts = st.toggle(
            "合并大句数",
            value=False,
            help="保留 1–32 句的精确值，并将更大的句数合并为区间。",
            on_change=clear_active_drilldown,
        )
        if group_large_sentence_counts:
            st.caption("保留 1–32 句的精确值，33 句以上按区间合并。")
        else:
            st.caption("显示所有精确句数，不合并长尾区间。")
    with option_columns[1]:
        use_log_color_scale = st.toggle(
            "使用对数颜色",
            value=False,
            help="增强数量较少的格式组合与高频组合之间的颜色差异。",
        )
        if use_log_color_scale:
            st.caption("对数刻度使数量较少的组合也能清晰区分。")
        else:
            st.caption("线性刻度直接反映不同组合的数量差距。")

    # Reserve display positions before computing the shared sentence-count axis.
    combination_column = st.container()
    st.divider()
    sentence_column = st.container()

    with sentence_column:
        st.markdown("#### 句数分布")
        if group_large_sentence_counts:
            sentence_distribution = sentence_count_bucket_distribution(
                filtered_poems
            )
            sentence_field = "句数范围"
            sentence_drilldown_kind = "sentence_count_bucket"
        else:
            sentence_distribution = sentence_count_distribution(filtered_poems)
            sentence_field = "句数"
            sentence_drilldown_kind = "sentence_count"
        sentence_data = with_percentage(
            pd.DataFrame(
                sentence_distribution,
                columns=[sentence_field, "诗作数"],
            ),
            "诗作数",
            len(filtered_poems),
        )
        sentence_count_order = sentence_data[sentence_field].tolist()
        sentence_selection = alt.selection_point(
            name="sentence_selection",
            fields=[sentence_field],
            clear="dblclick",
        )
        sentence_chart = (
            alt.Chart(sentence_data)
            .mark_bar(color=BAR_COLOR)
            .encode(
                x=alt.X(
                    f"{sentence_field}:O",
                    title="句数",
                    sort=sentence_count_order,
                    scale=alt.Scale(domain=sentence_count_order),
                    axis=alt.Axis(labelOverlap="greedy"),
                ),
                y=alt.Y(
                    "诗作数:Q",
                    title="诗作数",
                    scale=alt.Scale(domainMin=0, nice=True),
                    axis=alt.Axis(minExtent=90, maxExtent=90),
                ),
                tooltip=[
                    f"{sentence_field}:O",
                    "诗作数:Q",
                    alt.Tooltip("占比:Q", format=".1%"),
                ],
                opacity=alt.condition(
                    sentence_selection,
                    alt.value(1),
                    alt.value(0.55),
                ),
            )
            .add_params(sentence_selection)
            .properties(height=420)
        )
        sentence_chart_key = chart_widget_key("sentence-chart")
        st.altair_chart(
            sentence_chart,
            use_container_width=True,
            key=sentence_chart_key,
            on_select=partial(
                activate_chart_drilldown,
                sentence_chart_key,
                "sentence_selection",
                sentence_drilldown_kind,
            ),
            selection_mode="sentence_selection",
        )

    with combination_column:
        st.markdown("#### 字句组合分布")
        if group_large_sentence_counts:
            combination_counts = format_bucket_combination_counts(
                filtered_poems
            )
            combination_drilldown_kind = "format_bucket"
        else:
            combination_counts = format_combination_counts(filtered_poems)
            combination_drilldown_kind = "combination"
        combination_data = pd.DataFrame(
            combination_counts,
            columns=[sentence_field, "类型", "诗作数"],
        )
        combination_selection = alt.selection_point(
            name="combination_selection",
            fields=[sentence_field, "类型"],
            clear="dblclick",
        )
        combination_type_count = combination_data["类型"].nunique()
        combination_base = alt.Chart(combination_data).encode(
            x=alt.X(
                f"{sentence_field}:O",
                title="句数",
                sort=sentence_count_order,
                scale=alt.Scale(domain=sentence_count_order),
                axis=alt.Axis(labelOverlap="greedy"),
            ),
            y=alt.Y(
                "类型:N",
                title="每句字数类型",
                axis=alt.Axis(
                    minExtent=90,
                    maxExtent=90,
                    labelLimit=70,
                ),
            ),
            tooltip=[f"{sentence_field}:O", "类型:N", "诗作数:Q"],
        )
        combination_color_scale = (
            alt.Scale(type="log", scheme="reds")
            if use_log_color_scale
            else alt.Scale(scheme="reds")
        )
        combination_color_title = (
            "诗作数（对数）" if use_log_color_scale else "诗作数"
        )
        combination_chart = (
            combination_base.mark_rect()
            .encode(
            color=alt.Color(
                "诗作数:Q",
                title=combination_color_title,
                scale=combination_color_scale,
                legend=alt.Legend(
                    orient="top",
                    direction="horizontal",
                ),
            ),
            opacity=alt.condition(
                combination_selection,
                alt.value(1),
                alt.value(0.65),
            ),
            )
            .add_params(combination_selection)
            .properties(height=max(240, combination_type_count * 32))
        )
        combination_chart_key = chart_widget_key("combination-chart")
        st.altair_chart(
            combination_chart,
            use_container_width=True,
            key=combination_chart_key,
            on_select=partial(
                activate_chart_drilldown,
                combination_chart_key,
                "combination_selection",
                combination_drilldown_kind,
            ),
            selection_mode="combination_selection",
        )
    st.divider()
    line_type_column, structure_type_column = st.columns(2)

    with line_type_column:
        st.subheader("每句字数类型")
        line_type_data = with_percentage(
            pd.DataFrame(
                line_length_type_counts(filtered_poems),
                columns=["类型", "诗作数"],
            ),
            "诗作数",
            len(filtered_poems),
        )
        line_type_selection = alt.selection_point(
            name="line_type_selection",
            fields=["类型"],
            clear="dblclick",
        )
        line_type_chart = (
            alt.Chart(line_type_data)
            .mark_bar(color=BAR_COLOR)
            .encode(
                x=alt.X(
                    "诗作数:Q",
                    title="诗作数",
                    scale=alt.Scale(domainMin=0, nice=True),
                ),
                y=alt.Y("类型:N", title=None, sort="-x"),
                tooltip=[
                    "类型:N",
                    "诗作数:Q",
                    alt.Tooltip("占比:Q", format=".1%"),
                ],
                opacity=alt.condition(
                    line_type_selection,
                    alt.value(1),
                    alt.value(0.55),
                ),
            )
            .add_params(line_type_selection)
            .properties(height=330)
        )
        line_type_chart_key = chart_widget_key("line-type-chart")
        st.altair_chart(
            line_type_chart,
            use_container_width=True,
            key=line_type_chart_key,
            on_select=partial(
                activate_chart_drilldown,
                line_type_chart_key,
                "line_type_selection",
                "line_type",
            ),
            selection_mode="line_type_selection",
        )

    with structure_type_column:
        st.subheader("结构类型")
        structure_type_data = with_percentage(
            pd.DataFrame(
                structure_type_counts(filtered_poems),
                columns=["结构类型", "诗作数"],
            ),
            "诗作数",
            len(filtered_poems),
        )
        structure_type_order = structure_type_data["结构类型"].tolist()
        structure_type_selection = alt.selection_point(
            name="structure_type_selection",
            fields=["结构类型"],
            clear="dblclick",
        )
        structure_type_chart = (
            alt.Chart(structure_type_data)
            .mark_bar(color=BAR_COLOR)
            .encode(
                x=alt.X(
                    "诗作数:Q",
                    title="诗作数",
                    scale=alt.Scale(domainMin=0, nice=True),
                ),
                y=alt.Y(
                    "结构类型:N",
                    title=None,
                    sort=structure_type_order,
                ),
                tooltip=[
                    "结构类型:N",
                    "诗作数:Q",
                    alt.Tooltip("占比:Q", format=".1%"),
                ],
                opacity=alt.condition(
                    structure_type_selection,
                    alt.value(1),
                    alt.value(0.55),
                ),
            )
            .add_params(structure_type_selection)
            .properties(height=330)
        )
        structure_type_chart_key = chart_widget_key("structure-type-chart")
        st.altair_chart(
            structure_type_chart,
            use_container_width=True,
            key=structure_type_chart_key,
            on_select=partial(
                activate_chart_drilldown,
                structure_type_chart_key,
                "structure_type_selection",
                "structure_type",
            ),
            selection_mode="structure_type_selection",
        )

with overview_tab:
    st.subheader("诗体结构")
    st.caption("每根柱形表示每句字数类型，颜色区分四句、八句和其他句数。")
    structure_data = with_percentage(
        pd.DataFrame(
            structure_breakdown_counts(filtered_poems),
            columns=["类型", "句数类别", "诗作数"],
        ),
        "诗作数",
        len(filtered_poems),
    )
    line_type_order = list(dict.fromkeys(structure_data["类型"]))
    sentence_group_order = ["四句", "八句", "其他句数"]
    sentence_group_rank = {
        group: index for index, group in enumerate(sentence_group_order)
    }
    structure_data["句数顺序"] = structure_data["句数类别"].map(
        sentence_group_rank
    )
    structure_selection = alt.selection_point(
        name="structure_selection",
        fields=["类型", "句数类别"],
        clear="dblclick",
    )
    structure_chart = (
        alt.Chart(structure_data)
        .mark_bar()
        .encode(
            x=alt.X(
                "诗作数:Q",
                title="诗作数",
                stack="zero",
                scale=alt.Scale(domainMin=0, nice=True),
            ),
            y=alt.Y(
                "类型:N",
                title=None,
                sort=line_type_order,
            ),
            color=alt.Color(
                "句数类别:N",
                title="句数",
                sort=sentence_group_order,
                scale=alt.Scale(
                    domain=sentence_group_order,
                    range=["#2F5D8A", "#C6533C", "#C89B3C"],
                ),
                legend=alt.Legend(
                    orient="top",
                    direction="horizontal",
                ),
            ),
            order=alt.Order(
                "句数顺序:Q",
                sort="ascending",
            ),
            tooltip=[
                "类型:N",
                "句数类别:N",
                "诗作数:Q",
                alt.Tooltip("占比:Q", format=".1%"),
            ],
            opacity=alt.condition(
                structure_selection,
                alt.value(1),
                alt.value(0.55),
            ),
        )
        .add_params(structure_selection)
        .properties(height=max(280, len(line_type_order) * 38))
    )
    structure_chart_key = chart_widget_key("structure-chart")
    st.altair_chart(
        structure_chart,
        use_container_width=True,
        key=structure_chart_key,
        on_select=partial(
            activate_chart_drilldown,
            structure_chart_key,
            "structure_selection",
            "structure_breakdown",
        ),
        selection_mode="structure_selection",
    )

    st.divider()
    st.subheader("作者诗词数量")
    all_author_counts = author_counts(filtered_poems)
    show_all_authors = st.toggle(
        f"显示全部作者（{len(all_author_counts)} 位）",
        value=False,
    )
    visible_author_counts = (
        all_author_counts
        if show_all_authors
        else all_author_counts[:AUTHOR_PREVIEW_LIMIT]
    )
    author_data = with_percentage(
        pd.DataFrame(
            visible_author_counts,
            columns=["作者", "诗作数"],
        ),
        "诗作数",
        len(filtered_poems),
    )
    author_selection = alt.selection_point(
        name="author_selection",
        fields=["作者"],
        clear="dblclick",
    )
    author_chart = (
        alt.Chart(author_data)
        .mark_bar(color=BAR_COLOR)
        .encode(
            x=alt.X(
                "诗作数:Q",
                title="诗作数",
                scale=alt.Scale(domainMin=0, nice=True),
            ),
            y=alt.Y(
                "作者:N",
                title=None,
                sort="-x",
                axis=alt.Axis(labelOverlap=False),
            ),
            tooltip=[
                "作者:N",
                "诗作数:Q",
                alt.Tooltip("占比:Q", format=".1%"),
            ],
            opacity=alt.condition(author_selection, alt.value(1), alt.value(0.55)),
        )
        .add_params(author_selection)
        .properties(height=max(430, len(author_data) * 22))
    )
    author_chart_key = chart_widget_key("author-chart")
    st.altair_chart(
        author_chart,
        use_container_width=True,
        key=author_chart_key,
        on_select=partial(
            activate_chart_drilldown,
            author_chart_key,
            "author_selection",
            "author",
        ),
        selection_mode="author_selection",
    )
    if not show_all_authors and len(all_author_counts) > len(visible_author_counts):
        st.caption(f"当前显示前 {len(visible_author_counts)} 位作者。")

with characters_tab:
    frequency_type = st.radio(
        "统计类型",
        ["常用字", "常用词语"],
        horizontal=True,
    )

    if frequency_type == "常用字":
        st.subheader("正文常用字")
        frequency_counts = character_counts(filtered_poems)
        frequency_data = with_percentage(
            pd.DataFrame(
                frequency_counts[:FREQUENCY_DISPLAY_LIMIT],
                columns=["字", "出现次数"],
            ),
            "出现次数",
            sum(count for _, count in frequency_counts),
        )
        selection = alt.selection_point(
            name="character_selection",
            fields=["字"],
            clear="dblclick",
        )
        category_field = "字"
        selection_name = "character_selection"
        drilldown_kind = "character"
        chart_base_key = "character-chart"
        caption = "只统计汉字，排除标点、空格、数字及其他非汉字。"
    else:
        st.subheader("正文常用词语")
        with st.spinner("正在进行中文分词统计……"):
            word_count_cache_key = (
                DATA_SCHEMA_VERSION,
                tuple(selected_corpus_versions.items()),
                tuple(poem.id for poem in filtered_poems),
            )
            frequency_counts = cached_word_counts(
                word_count_cache_key,
                tuple(filtered_poems),
            )
            frequency_data = with_percentage(
                pd.DataFrame(
                    frequency_counts[:FREQUENCY_DISPLAY_LIMIT],
                    columns=["词语", "出现次数"],
                ),
                "出现次数",
                sum(count for _, count in frequency_counts),
            )
        selection = alt.selection_point(
            name="word_selection",
            fields=["词语"],
            clear="dblclick",
        )
        category_field = "词语"
        selection_name = "word_selection"
        drilldown_kind = "word"
        chart_base_key = "word-chart"
        caption = "使用中文分词统计，只保留由至少两个汉字组成的词语。"

    frequency_chart_height = (
        max(1, len(frequency_data)) * FREQUENCY_BAR_HEIGHT
    )
    frequency_table_height = (
        max(1, len(frequency_data)) * FREQUENCY_TABLE_ROW_HEIGHT
        + DATAFRAME_HEADER_HEIGHT
    )
    chart_column, table_column = st.columns(
        [3, 2],
        vertical_alignment="top",
    )
    with chart_column:
        frequency_chart = (
            alt.Chart(frequency_data)
            .mark_bar(color=BAR_COLOR)
            .encode(
                x=alt.X(
                    "出现次数:Q",
                    title="出现次数",
                    scale=alt.Scale(domainMin=0, nice=True),
                ),
                y=alt.Y(
                    f"{category_field}:N",
                    title=None,
                    sort="-x",
                    axis=alt.Axis(labelOverlap=False),
                ),
                tooltip=[
                    f"{category_field}:N",
                    "出现次数:Q",
                    alt.Tooltip("占比:Q", format=".1%"),
                ],
                opacity=alt.condition(
                    selection,
                    alt.value(1),
                    alt.value(0.55),
                ),
            )
            .add_params(selection)
            .properties(
                height=frequency_chart_height,
                padding={"top": DATAFRAME_HEADER_HEIGHT},
            )
        )
        chart_key = chart_widget_key(chart_base_key)
        st.altair_chart(
            frequency_chart,
            use_container_width=True,
            key=chart_key,
            on_select=partial(
                activate_chart_drilldown,
                chart_key,
                selection_name,
                drilldown_kind,
            ),
            selection_mode=selection_name,
        )
    with table_column:
        frequency_table = frequency_data.copy()
        frequency_table["占比"] = frequency_table["占比"].map("{:.1%}".format)
        st.dataframe(
            frequency_table[[category_field, "出现次数", "占比"]],
            hide_index=True,
            width="stretch",
            height=frequency_table_height,
            row_height=FREQUENCY_TABLE_ROW_HEIGHT,
        )
    st.caption(caption)

with explorer_tab:
    st.subheader("诗作目录")
    poem_rows = [
        {
            "题目": poem.title,
            "作者": poem.author,
            "字数": poem_character_count(poem),
            "段落": len(poem.paragraphs),
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
        st.markdown(f"**字数**  \n{poem_character_count(selected_poem)}")

with quality_tab:
    duplicates = duplicate_text_groups(filtered_poems)
    repeated_titles = [
        (title, count)
        for title, count in title_counts(filtered_poems)
        if count > 1
    ]
    quality_metrics = st.columns(2)
    quality_metrics[0].metric("完全相同正文组", len(duplicates))
    quality_metrics[1].metric("重复题目", len(repeated_titles))

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
    highlight_text = None

    if drilldown_kind == "author":
        drilldown_value = str(drilldown_selection["作者"])
        drilldown_heading = drilldown_value
        drilldown_poems = [
            poem for poem in filtered_poems if poem.author == drilldown_value
        ]
    elif drilldown_kind == "character":
        drilldown_value = str(drilldown_selection["字"])
        drilldown_heading = f"包含「{drilldown_value}」"
        highlight_text = drilldown_value
        drilldown_poems = poems_containing_character(
            filtered_poems,
            drilldown_value,
        )
    elif drilldown_kind == "word":
        drilldown_value = str(drilldown_selection["词语"])
        drilldown_heading = f"包含「{drilldown_value}」"
        highlight_text = drilldown_value
        drilldown_poems = poems_containing_word(
            filtered_poems,
            drilldown_value,
        )
    elif drilldown_kind == "sentence_count_bucket":
        sentence_bucket = str(drilldown_selection["句数范围"])
        drilldown_heading = f"{sentence_bucket} 句"
        drilldown_poems = poems_with_sentence_count_bucket(
            filtered_poems,
            sentence_bucket,
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
    elif drilldown_kind == "format_bucket":
        sentence_bucket = str(drilldown_selection["句数范围"])
        line_type = str(drilldown_selection["类型"])
        drilldown_heading = f"{sentence_bucket} 句 · {line_type}"
        drilldown_poems = poems_with_format_bucket_combination(
            filtered_poems,
            sentence_bucket,
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
    elif drilldown_kind == "structure_breakdown":
        line_type = str(drilldown_selection["类型"])
        sentence_group = str(drilldown_selection["句数类别"])
        drilldown_heading = f"{line_type} · {sentence_group}"
        drilldown_poems = poems_with_structure_breakdown(
            filtered_poems,
            line_type,
            sentence_group,
        )
    elif drilldown_kind == "structure_type":
        selected_structure_type = str(drilldown_selection["结构类型"])
        drilldown_heading = selected_structure_type
        drilldown_poems = poems_with_structure_type(
            filtered_poems,
            selected_structure_type,
        )
    else:
        drilldown_heading = ""
        drilldown_poems = []

    if drilldown_poems:
        render_poem_collection(
            drilldown_heading,
            drilldown_poems,
            highlight_text=highlight_text,
        )
    else:
        clear_active_drilldown()
