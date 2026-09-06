from pathlib import Path

from poetry.json_repository import JsonPoemRepository


DATA_PATH = Path(__file__).parents[1] / "data" / "tangshisanbaishou.json"
QUANTANGSHI_PATH = Path(__file__).parents[1] / "data" / "quantangshi"


def test_repository_loads_all_poems() -> None:
    poems = JsonPoemRepository(DATA_PATH).list_poems()

    assert len(poems) == 366
    assert sum(poem.author == "李白" for poem in poems) == 51
    assert all(poem.id and poem.title and poem.author for poem in poems)
    assert all(poem.format.sentence_count > 0 for poem in poems)


def test_repository_loads_directory_and_generates_stable_ids() -> None:
    poems = JsonPoemRepository(QUANTANGSHI_PATH).list_poems()

    assert len(poems) == 43_103
    assert len({poem.id for poem in poems}) == len(poems)
    assert poems[0].id == "quantangshi/001.json:0"
    assert all(poem.format.sentence_count > 0 for poem in poems)
