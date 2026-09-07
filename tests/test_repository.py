from pathlib import Path

from poetry.json_repository import JsonPoemRepository


TS300_PATH = Path(__file__).parents[1] / "data" / "ts300" / "ts300.json"
QTS_PATH = Path(__file__).parents[1] / "data" / "qts"
QUANSONGSHI_PATH = Path(__file__).parents[1] / "data" / "quansongshi"
SHIJING_PATH = Path(__file__).parents[1] / "data" / "shijing" / "shijing.json"
QINHAN_PATH = Path(__file__).parents[1] / "data" / "qinhan"
WEIJINNANBEICHAO_PATH = (
    Path(__file__).parents[1] / "data" / "weijinnanbeichao"
)
EARLY_CORPORA = {
    "qinhan/qin.json": (7, "垓下歌", "项羽"),
    "qinhan/han.json": (362, "桂", "杨孚"),
    "weijinnanbeichao/wei.json": (178, "从军行", "左延年"),
    "weijinnanbeichao/jin.json": (181, "七夕观织女诗", "王鉴"),
    "weijinnanbeichao/nanbeichao.json": (
        481,
        "人日思归",
        "薛道衡",
    ),
}


def test_repository_loads_all_poems() -> None:
    poems = JsonPoemRepository(TS300_PATH).list_poems()

    assert len(poems) == 366
    assert sum(poem.author == "李白" for poem in poems) == 51
    assert all(poem.id and poem.title and poem.author for poem in poems)
    assert all(poem.format.sentence_count > 0 for poem in poems)


def test_repository_loads_directory_and_generates_stable_ids() -> None:
    poems = JsonPoemRepository(QTS_PATH).list_poems()

    assert len(poems) == 43_103
    assert len({poem.id for poem in poems}) == len(poems)
    assert poems[0].id == "qts/001.json:0"
    assert all(poem.format.sentence_count > 0 for poem in poems)


def test_repository_loads_quansongshi() -> None:
    poems = JsonPoemRepository(QUANSONGSHI_PATH).list_poems()

    assert len(poems) == 254_223
    assert len({poem.id for poem in poems}) == len(poems)
    assert poems[0].title == "日詩"
    assert poems[0].author == "宋太祖"
    assert all(poem.format.sentence_count > 0 for poem in poems)


def test_repository_loads_shijing() -> None:
    poems = JsonPoemRepository(SHIJING_PATH).list_poems()

    assert len(poems) == 305
    assert poems[0].id == "shijing:000"
    assert poems[0].title == "关雎"
    assert poems[0].author == "佚名"
    assert poems[0].tags == ("国风", "周南")
    assert all(poem.format.sentence_count > 0 for poem in poems)


def test_repository_loads_early_historical_corpora() -> None:
    data_directory = Path(__file__).parents[1] / "data"

    for relative_path, (
        expected_count,
        expected_title,
        expected_author,
    ) in EARLY_CORPORA.items():
        poems = JsonPoemRepository(data_directory / relative_path).list_poems()

        assert len(poems) == expected_count
        assert poems[0].title == expected_title
        assert poems[0].author == expected_author
        assert len({poem.id for poem in poems}) == len(poems)
        assert all(poem.format.sentence_count > 0 for poem in poems)


def test_repository_loads_merged_historical_corpora() -> None:
    qinhan_poems = JsonPoemRepository(QINHAN_PATH).list_poems()
    weijinnanbeichao_poems = JsonPoemRepository(
        WEIJINNANBEICHAO_PATH
    ).list_poems()

    assert len(qinhan_poems) == 369
    assert len(weijinnanbeichao_poems) == 840


def test_repository_excludes_comments_and_fixes_missing_line_breaks() -> None:
    poems = JsonPoemRepository(QTS_PATH).list_poems()
    poems_by_author_and_title = {
        (poem.author, poem.title): poem for poem in poems
    }

    meeting_poem = poems_by_author_and_title[("王麗真", "與曾季衡冥會詩")]
    assert meeting_poem.format.sentence_count == 8
    assert meeting_poem.format.uniform_sentence_length == 7

    butterfly_poem = poems_by_author_and_title[("李煜", "蝶戀花")]
    assert butterfly_poem.format.sentence_lengths == (
        7,
        4,
        5,
        7,
        7,
        7,
        4,
        5,
        7,
        7,
    )
    assert all("一名一籮金" not in paragraph for paragraph in butterfly_poem.paragraphs)
