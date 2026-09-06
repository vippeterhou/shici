from pathlib import Path

from poetry.json_repository import JsonPoemRepository


DATA_PATH = Path(__file__).parents[1] / "data" / "tangshisanbaishou.json"


def test_repository_loads_all_poems() -> None:
    poems = JsonPoemRepository(DATA_PATH).list_poems()

    assert len(poems) == 366
    assert sum(poem.author == "李白" for poem in poems) == 51
    assert all(poem.id and poem.title and poem.author for poem in poems)
    assert all(poem.format.sentence_count > 0 for poem in poems)
