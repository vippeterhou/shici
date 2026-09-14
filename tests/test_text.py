from poetry.text import clean_display_text, compact_poem_title


def test_cleans_embedded_title_whitespace() -> None:
    assert clean_display_text("題目\r\n續題") == "題目 續題"


def test_uses_specific_name_for_long_group_poem_title() -> None:
    title = "過梅裏七首家於無錫四十載今敝廬數堵猶存今列題於後：上家山\r\n"

    assert compact_poem_title(title) == "上家山"


def test_preserves_short_title_with_separator() -> None:
    assert compact_poem_title("組詩：其一") == "組詩：其一"


def test_labels_missing_title() -> None:
    assert compact_poem_title(" \r\n ") == "无题"
