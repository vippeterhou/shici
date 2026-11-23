import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getRhymeDirectory } from "@/lib/rhyme-data";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({
  getPingshuiyunDatabase: () => activeDatabase,
}));

let database: Database.Database;
let activeDatabase: Database.Database | null;

beforeEach(() => {
  database = new Database(":memory:");
  activeDatabase = database;
  database.exec(`
    CREATE TABLE rhyme_groups (
      id TEXT, section_id TEXT, section TEXT, tone TEXT, ordinal INTEGER, name TEXT
    );
    CREATE TABLE character_rhymes (
      rhyme_id TEXT, character TEXT, is_supplement INTEGER,
      supplement_kind TEXT, source_order INTEGER
    );
    CREATE TABLE character_aliases (input_character TEXT, target_character TEXT);
    INSERT INTO rhyme_groups VALUES
      ('departing:01', 'departing', '去聲', '去', 1, '送'),
      ('upper_level:02', 'upper_level', '上平聲', '平', 2, '冬'),
      ('upper_level:01', 'upper_level', '上平聲', '平', 1, '東'),
      ('entering:05', 'entering', '入聲', '入', 5, '物'),
      ('lower_level:14', 'lower_level', '下平聲', '平', 14, '鹽'),
      ('rising:24', 'rising', '上聲', '上', 24, '迥');
    INSERT INTO character_rhymes VALUES
      ('upper_level:01', '蠓', 1, '詞', 0),
      ('upper_level:01', '同', 0, '', 1),
      ('upper_level:01', '東', 0, '', 0),
      ('upper_level:01', '𠋫', 1, '辭', 0),
      ('upper_level:02', '冬', 0, '', 0),
      ('upper_level:02', '同', 1, '詞', 1),
      ('departing:01', '送', 0, '', 0),
      ('departing:01', '東', 0, '', 1),
      ('lower_level:14', '鹽', 0, '', 0);
    INSERT INTO character_aliases VALUES
      ('东', '東'), ('别', '東'), ('别', '冬'), ('别', '缺');
  `);
});

afterEach(() => {
  database.close();
});

describe("rhyme directory", () => {
  it("orders the sections and rhymes canonically and keeps supplement provenance", () => {
    const directory = getRhymeDirectory("");
    expect(directory?.sections.map((section) => section.id)).toEqual([
      "upper_level", "lower_level", "rising", "departing", "entering",
    ]);
    expect(directory?.sections[0].groups.map((group) => group.id)).toEqual([
      "upper_level:01", "upper_level:02",
    ]);
    expect(directory?.sections[0].groups[0].characters).toEqual([
      { character: "東", supplementKind: "" },
      { character: "同", supplementKind: "" },
      { character: "蠓", supplementKind: "詞" },
      { character: "𠋫", supplementKind: "辭" },
    ]);
    expect(directory?.characterCount).toBe(7);
    expect(directory?.sections[0].groups[0].characters.some((entry) => entry.character === "东")).toBe(false);
  });

  it("finds all assignments of a simplified alias and highlights actual headwords", () => {
    const directory = getRhymeDirectory("东");
    const allGroups = directory?.sections.flatMap((section) => section.groups);
    const groups = allGroups?.filter((group) => directory?.matchedGroupIds.includes(group.id));
    expect(allGroups).toHaveLength(6);
    expect(groups?.map((group) => group.id)).toEqual(["upper_level:01", "departing:01"]);
    expect(groups?.map((group) => group.matchedCharacters)).toEqual([["東"], ["東"]]);
    expect(groups?.[0].characters).toHaveLength(4);
    expect(getRhymeDirectory("東")?.matchedGroupCount).toBe(2);
  });

  it("preserves ambiguous alias targets and supplemental or supplementary-plane matches", () => {
    const directory = getRhymeDirectory("别");
    expect(directory?.matchedGroupCount).toBe(3);
    expect(getRhymeDirectory("同")?.matchedGroupCount).toBe(2);
    const supplementary = getRhymeDirectory("𠋫");
    expect(supplementary?.isCharacterSearch).toBe(true);
    expect(supplementary?.sections[0].groups[0].matchedCharacters).toEqual(["𠋫"]);
  });

  it("searches simplified and traditional rhyme labels without confusing them with character lookup", () => {
    expect(getRhymeDirectory("上平")?.matchedGroupCount).toBe(2);
    expect(getRhymeDirectory("上平声一东")?.matchedGroupIds).toEqual(["upper_level:01"]);
    expect(getRhymeDirectory(" 東韻 ")?.matchedGroupIds).toEqual(["upper_level:01"]);
    expect(getRhymeDirectory("盐韵")?.matchedGroupIds).toEqual(["lower_level:14"]);
    expect(getRhymeDirectory("不存在")?.matchedGroupCount).toBe(0);
    expect(getRhymeDirectory("🪷")?.matchedGroupCount).toBe(0);
    expect(getRhymeDirectory("' OR 1=1 --")?.matchedGroupCount).toBe(0);
  });

  it("keeps the complete directory for rhyme-label searches and queries without matches", () => {
    const initial = getRhymeDirectory("")!;
    const expectedGroups = initial.sections.map((section) => section.groups.map((group) => group.id));
    for (const query of ["上平", "上平声一东", "不存在"]) {
      const directory = getRhymeDirectory(query)!;
      expect(directory.sections.map((section) => section.groups.map((group) => group.id)))
        .toEqual(expectedGroups);
    }
    expect(getRhymeDirectory("上平")?.matchedGroupIds.sort()).toEqual(["upper_level:01", "upper_level:02"]);
    expect(getRhymeDirectory("上平声一东")?.matchedGroupIds).toEqual(["upper_level:01"]);
    expect(getRhymeDirectory("不存在")?.matchedGroupIds).toEqual([]);
  });

  it("distinguishes original tongyong groups from later merging and splitting", () => {
    const directory = getRhymeDirectory("");
    const groups = directory!.sections.flatMap((section) => section.groups);
    const winter = groups.find((group) => group.id === "upper_level:02")!;
    expect(winter.note.description).toBe("冬、鍾同用");
    expect(winter.note.isSpecial).toBe(false);
    const east = groups.find((group) => group.id === "upper_level:01")!;
    expect(east.note.description).toBe("東独用");
    expect(east.note.isSpecial).toBe(false);
    const salt = groups.find((group) => group.id === "lower_level:14")!;
    expect(salt.note.description).toBe("鹽、添同用，另并嚴（原与凡同用）");
    expect(salt.note.isSpecial).toBe(true);
    const jiong = groups.find((group) => group.id === "rising:24")!;
    expect(jiong.note.description).toBe("拯、等同用，另并迥（原独用）");
    expect(jiong.note.isSpecial).toBe(true);
    const wu = groups.find((group) => group.id === "entering:05")!;
    expect(wu.note.description).toBe("物、迄合并（原各独用）");
    expect(wu.note.isSpecial).toBe(true);
  });

  it("returns an explicit unavailable state when the dictionary is missing", () => {
    activeDatabase = null;
    expect(getRhymeDirectory("东")).toBeNull();
  });
});
