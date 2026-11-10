import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getCorpusInsights,
  getCorpusSearchOptions,
  getFilteredAuthorOptions,
  getFilteredCorpusInsights,
  getFilteredCorpusStats,
  getAdjacentPoems,
  getPoem,
  listCorpusPoems,
  searchPoems,
} from "@/lib/data";
import { normalizeSearchText, tokenizeSearchText } from "@/lib/search-normalization";
import type { PoemSearchOptions } from "@/lib/types";
import { isHanCharacter } from "@/scripts/ngrams.mjs";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ getDatabase: () => database }));

let database: Database.Database;

function addPoem(record: {
  id: string;
  corpus: string;
  author: string;
  body: string;
  lineType: string;
  sentences: number;
  title?: string;
  workId?: string;
  textId?: string;
  volume?: number;
  chapter?: string;
  section?: string;
}) {
  const title = record.title ?? `作品${record.id}`;
  const result = database.prepare(`
    INSERT INTO poems (
      id, work_id, text_id, volume, corpus, title, author, body, tags_json,
      sentence_count,
      character_count, line_type, title_normalized, author_normalized,
      chapter, section
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, '[]', ?, ?, ?, ?, ?, ?, ?)
  `).run(
    record.id, record.workId ?? record.id,
    record.textId ?? record.workId ?? record.id, record.volume ?? null,
    record.corpus, title,
    record.author, record.body,
    record.sentences, [...record.body].filter(isHanCharacter).length,
    record.lineType, normalizeSearchText(title), normalizeSearchText(record.author),
    record.chapter ?? null, record.section ?? null,
  );
  database.prepare(`
    INSERT INTO poems_fts (rowid, title, author, tune, tags, body)
    VALUES (?, ?, ?, '', '', ?)
  `).run(
    result.lastInsertRowid, tokenizeSearchText(title),
    tokenizeSearchText(record.author), tokenizeSearchText(record.body),
  );
}

beforeEach(() => {
  database = new Database(":memory:");
  database.exec(`
    CREATE TABLE corpora (
      key TEXT PRIMARY KEY, name TEXT, era TEXT DEFAULT '',
      description TEXT DEFAULT '', sort_order INTEGER DEFAULT 0,
      poem_count INTEGER DEFAULT 0, record_count INTEGER DEFAULT 0
    );
    CREATE TABLE poems (
      id TEXT, work_id TEXT, text_id TEXT, volume INTEGER, corpus TEXT, title TEXT,
      author TEXT, body TEXT,
      tags_json TEXT, sentence_count INTEGER, character_count INTEGER,
      line_type TEXT, title_normalized TEXT, author_normalized TEXT,
      chapter TEXT, section TEXT, sentence_lengths_json TEXT DEFAULT '[]',
      uniform_sentence_length INTEGER
    );
    CREATE VIEW works AS
      SELECT p.rowid AS rowid, p.* FROM poems p
      JOIN (
        SELECT corpus, work_id, MIN(rowid) AS rowid
        FROM poems GROUP BY corpus, work_id
      ) representative ON representative.rowid = p.rowid;
    CREATE VIRTUAL TABLE poems_fts USING fts5(title, author, tune, tags, body);
    INSERT INTO corpora (key, name) VALUES ('qts', '全唐诗'), ('qss', '全宋诗'),
      ('shijing', '诗经'), ('sc300', '宋词三百首'), ('qsc', '全宋词');
  `);
  const records = [
    { id: "1", corpus: "qts", author: "李白", body: "明月光", lineType: "5言", sentences: 4 },
    { id: "2", corpus: "qts", author: "杜甫", body: "明月照", lineType: "5言", sentences: 8 },
    { id: "3", corpus: "qts", author: "李白", body: "黄河流", lineType: "7言", sentences: 4 },
    { id: "4", corpus: "qts", author: "王维", body: "明月松间", lineType: "5言", sentences: 4 },
    { id: "5", corpus: "qss", author: "蘇軾", body: "黃河水", lineType: "5言", sentences: 4 },
    { id: "6", corpus: "qss", author: "蘇軾", body: "明月夜", lineType: "5言", sentences: 8 },
  ];
  for (const record of records) addPoem(record);
  database.exec(`
    CREATE TABLE author_stats AS
      SELECT corpus, author, COUNT(*) AS count FROM poems GROUP BY corpus, author;
    CREATE TABLE line_stats AS
      SELECT corpus, line_type, COUNT(*) AS count FROM poems GROUP BY corpus, line_type;
    CREATE TABLE sentence_stats AS
      SELECT corpus, sentence_count, COUNT(*) AS count FROM poems GROUP BY corpus, sentence_count;
    CREATE TABLE corpus_stats AS
      SELECT corpus, COUNT(*) AS poem_count, COUNT(DISTINCT author_normalized) AS author_count,
        SUM(character_count) AS character_count, AVG(character_count) AS average_characters
      FROM poems GROUP BY corpus;
    CREATE TABLE format_combination_stats AS
      SELECT corpus, sentence_count, line_type, COUNT(*) AS count
      FROM poems GROUP BY corpus, sentence_count, line_type;
    CREATE TABLE character_stats (corpus TEXT, character TEXT, count INTEGER);
    CREATE TABLE text_frequency_stats (corpus TEXT, size INTEGER, term TEXT, count INTEGER);
    UPDATE corpora SET
      poem_count = (SELECT COUNT(DISTINCT work_id) FROM poems WHERE corpus = corpora.key),
      record_count = (SELECT COUNT(*) FROM poems WHERE corpus = corpora.key);
  `);
});

describe("filtered corpus analysis", () => {
  const cases: Array<{ query: string; options: PoemSearchOptions & { corpus: string } }> = [
    { query: "", options: { corpus: "qts", authors: ["李白", "杜甫"] } },
    { query: "明月", options: { corpus: "qts", authors: ["李白", "杜甫"], lineType: "5言" } },
    { query: "明月", options: { corpus: "qts", authors: ["杜甫"] } },
    { query: "", options: { corpus: "qts", sentenceCount: 8 } },
    { query: "明月", options: { corpus: "qts", authors: ["李白", "杜甫"], lineType: "5言", sentenceCount: 4 } },
    { query: "黄河", options: { corpus: "qss", authors: ["苏轼", "蘇軾"] } },
    { query: "", options: { corpus: "qts", lineType: "7言" } },
    { query: "李白 明月", options: { corpus: "qts" } },
    { query: "", options: { corpus: "qts", authors: ["' OR 1=1 --"] } },
  ];

  it.each(cases)("analyzes exactly the matching poems: $query $options", ({ query, options }) => {
    const listing = searchPoems(query, { ...options, page: 2, pageSize: 1 });
    const insights = getFilteredCorpusInsights(query, options)!;
    expect(getFilteredCorpusStats(query, options)).toEqual(insights.stats);
    expect(insights.stats.poemCount).toBe(listing.total);
    expect(insights.authors.reduce((sum, item) => sum + item.value, 0)).toBe(listing.total);
    expect(insights.lineTypes.reduce((sum, item) => sum + item.value, 0)).toBe(listing.total);
    expect(insights.formatCombinations.reduce((sum, item) => sum + item.value, 0)).toBe(listing.total);
    expect(insights.characters.reduce((sum, item) => sum + item.value, 0)).toBe(insights.stats.characterCount);
  });

  it("counts characters and overlapping terms only in the selected bodies", () => {
    const insights = getFilteredCorpusInsights("明月", {
      corpus: "qts", authors: ["李白", "杜甫"],
    })!;
    expect(insights.stats).toEqual({
      corpus: "qts", poemCount: 2, authorCount: 2, characterCount: 6, sentenceCount: 12, averageCharacters: 3,
    });
    expect(insights.characters).toContainEqual({ label: "明", value: 2 });
    expect(insights.characters).toContainEqual({ label: "月", value: 2 });
    expect(insights.bigrams).toEqual([
      { label: "明月", value: 2 }, { label: "月光", value: 1 }, { label: "月照", value: 1 },
    ]);
    expect(insights.trigrams).toEqual([
      { label: "明月光", value: 1 }, { label: "明月照", value: 1 },
    ]);
    expect(insights.formatCombinations).toEqual([
      { sentenceCount: 4, lineType: "5言", value: 1 },
      { sentenceCount: 8, lineType: "5言", value: 1 },
    ]);
  });

  it("counts the complete filtered selection independently of pagination", () => {
    expect(getFilteredCorpusStats("", {
      corpus: "qts", authors: ["李白", "杜甫"], page: 2, pageSize: 1,
    })).toEqual({
      corpus: "qts", poemCount: 3, authorCount: 2, characterCount: 9, sentenceCount: 16, averageCharacters: 3,
    });
  });

  it("counts only exact sentence matches in filtered summaries and analysis", () => {
    const options = { corpus: "qts", sentenceCount: 8, page: 2, pageSize: 1 };
    expect(getFilteredCorpusStats("", options)).toEqual({
      corpus: "qts", poemCount: 1, authorCount: 1, characterCount: 3, sentenceCount: 8, averageCharacters: 3,
    });
    expect(getFilteredCorpusInsights("", options)!.formatCombinations).toEqual([
      { sentenceCount: 8, lineType: "5言", value: 1 },
    ]);
    expect(getFilteredCorpusStats("", { corpus: "qts", sentenceCount: 6 })!.poemCount).toBe(0);
  });

  it("keeps raw author labels but counts normalized author identities", () => {
    addPoem({ id: "7", corpus: "qss", author: "苏轼", body: "明月", lineType: "5言", sentences: 4 });
    const insights = getFilteredCorpusInsights("", { corpus: "qss", authors: ["苏轼", "蘇軾"] })!;
    expect(insights.stats.poemCount).toBe(3);
    expect(insights.stats.authorCount).toBe(1);
    expect(getFilteredCorpusStats("", { corpus: "qss", authors: ["苏轼", "蘇軾"] })).toEqual(insights.stats);
    expect(insights.authors).toEqual([{ label: "蘇軾", value: 2 }, { label: "苏轼", value: 1 }]);
  });

  it("uses the build-time Han and n-gram boundaries, including paragraphs", () => {
    addPoem({
      id: "7", corpus: "qts", author: "李白", body: "春風，秋月\n江山。〇𠮷",
      lineType: "杂言", sentences: 4,
    });
    const insights = getFilteredCorpusInsights("春风", { corpus: "qts" })!;
    expect(insights.stats.characterCount).toBe(8);
    expect(insights.characters).toContainEqual({ label: "〇", value: 1 });
    expect(insights.characters).toContainEqual({ label: "𠮷", value: 1 });
    expect(insights.bigrams.map((item) => item.label).sort()).toEqual(["春風", "秋月", "江山", "〇𠮷"].sort());
    expect(insights.trigrams).toEqual([]);
  });

  it.each(["sc300", "qsc"])("filters tune structure for %s using the same FTS selection", (corpus) => {
    for (const [id, title, body] of [
      ["7", "如夢令·春", "春風"], ["8", "如夢令・秋", "春風"], ["9", "聲聲慢・夜", "明月"],
    ]) {
      addPoem({ id, corpus, title, body, author: "李清照", lineType: "杂言", sentences: 4 });
    }
    expect(getFilteredCorpusInsights("春风", { corpus })!.structure).toEqual({
      kind: "tunes", data: [{ label: "如夢令", value: 2 }],
    });
    expect(getFilteredCorpusInsights("明月", { corpus })!.structure).toEqual({
      kind: "tunes", data: [{ label: "聲聲慢", value: 1 }],
    });
  });

  it("filters chapter structure and retains original chapter order", () => {
    for (const [id, chapter, section] of [
      ["7", "國風", "周南"], ["8", "國風", "召南"], ["9", "國風", "召南"],
    ]) {
      addPoem({ id, chapter, section, corpus: "shijing", body: "明月", author: "佚名", lineType: "4言", sentences: 4 });
    }
    addPoem({
      id: "10", chapter: "小雅", section: "鹿鳴", corpus: "shijing", body: "關關",
      author: "佚名", lineType: "4言", sentences: 4,
    });
    expect(getFilteredCorpusInsights("明月", { corpus: "shijing" })!.structure).toEqual({
      kind: "hierarchy",
      data: [
        { chapter: "國風", section: "周南", value: 1 },
        { chapter: "國風", section: "召南", value: 2 },
      ],
    });
  });

  it("returns empty distributions and zero totals for an empty selection", () => {
    const insights = getFilteredCorpusInsights("不存在", { corpus: "qts" })!;
    expect(insights.stats).toEqual({
      corpus: "qts", poemCount: 0, authorCount: 0, characterCount: 0, sentenceCount: 0, averageCharacters: 0,
    });
    for (const key of ["authors", "sentenceCounts", "lineTypes", "characters", "bigrams", "trigrams", "formatCombinations"] as const) {
      expect(insights[key]).toEqual([]);
    }
  });

  it("reuses precomputed statistics when no additional filters are applied", () => {
    expect(getFilteredCorpusInsights("", { corpus: "qts" })).toEqual(getCorpusInsights("qts"));
    expect(getFilteredCorpusStats("", { corpus: "qts" })!.sentenceCount).toBe(20);
    expect(getFilteredCorpusStats("", { corpus: "qts" })).toEqual(getCorpusInsights("qts")!.stats);
    expect(getFilteredCorpusStats("", { corpus: "qts", page: 2, pageSize: 1 })).toEqual(getCorpusInsights("qts")!.stats);
    expect(getFilteredCorpusStats("明月", { corpus: "missing" })).toBeNull();
    expect(getFilteredCorpusInsights("明月", { corpus: "missing" })).toBeNull();
  });
});

afterEach(() => database.close());

describe("live author facet counts", () => {
  it.each([
    { query: "", options: { corpus: "qts" }, expected: { 李白: 2, 杜甫: 1, 王维: 1 } },
    { query: "", options: { corpus: "qts", authors: ["杜甫"] }, expected: { 李白: 2, 杜甫: 1, 王维: 1 } },
    { query: "明月", options: { corpus: "qts", authors: ["李白"] }, expected: { 李白: 1, 杜甫: 1, 王维: 1 } },
    { query: "李白", options: { corpus: "qts" }, expected: { 李白: 2, 杜甫: 0, 王维: 0 } },
    { query: "作品1", options: { corpus: "qts" }, expected: { 李白: 1, 杜甫: 0, 王维: 0 } },
    { query: "", options: { corpus: "qts", lineType: "7言" }, expected: { 李白: 1, 杜甫: 0, 王维: 0 } },
    { query: "", options: { corpus: "qts", sentenceCount: 8 }, expected: { 李白: 0, 杜甫: 1, 王维: 0 } },
    {
      query: "明月",
      options: { corpus: "qts", authors: ["杜甫"], lineType: "5言", sentenceCount: 4, page: 2, pageSize: 1 },
      expected: { 李白: 1, 杜甫: 0, 王维: 1 },
    },
    { query: "不存在", options: { corpus: "qts" }, expected: { 李白: 0, 杜甫: 0, 王维: 0 } },
  ])("counts each author under the other criteria: $query $options", ({ query, options, expected }) => {
    const authors = getFilteredAuthorOptions(query, options);
    expect(Object.fromEntries(authors.map(({ label, value }) => [label, value]))).toEqual(expected);
    expect(authors.map(({ label }) => label)).toEqual(
      getCorpusSearchOptions(options.corpus).authors.map(({ label }) => label),
    );
    for (const author of authors) {
      expect(author.value).toBe(searchPoems(query, { ...options, authors: [author.label] }).total);
    }
  });

  it("uses normalized author identities for both precomputed and filtered counts", () => {
    addPoem({ id: "7", corpus: "qss", author: "苏轼", body: "明月", lineType: "5言", sentences: 4 });
    database.prepare("INSERT INTO author_stats (corpus, author, count) VALUES (?, ?, ?)")
      .run("qss", "苏轼", 1);
    for (const [query, count] of [["", 3], ["明月", 2]] as const) {
      expect(getFilteredAuthorOptions(query, { corpus: "qss" })).toEqual([
        { label: "蘇軾", value: count },
        { label: "苏轼", value: count },
      ]);
    }
  });
});

describe("advanced poem search", () => {
  it("groups QTS entries by work while preserving every title", () => {
    addPoem({
      id: "7",
      workId: "qts-work:shared",
      textId: "qts-text:shared",
      volume: 19,
      corpus: "qts",
      title: "相和歌辞：王昭君",
      author: "上官儀",
      body: "玉關春色晚",
      lineType: "5言",
      sentences: 8,
    });
    addPoem({
      id: "8",
      workId: "qts-work:shared",
      textId: "qts-text:shared",
      volume: 40,
      corpus: "qts",
      title: "王昭君",
      author: "上官儀",
      body: "玉關春色晚",
      lineType: "5言",
      sentences: 8,
    });
    addPoem({
      id: "9",
      workId: "qts-work:other-author",
      textId: "qts-text:shared",
      volume: 95,
      corpus: "qts",
      title: "王昭君",
      author: "另一作者",
      body: "玉關春色晚",
      lineType: "5言",
      sentences: 8,
    });

    expect(searchPoems("", { corpus: "qts" }).total).toBe(6);
    expect(listCorpusPoems("qts").total).toBe(6);
    expect(searchPoems("王昭君", { corpus: "qts" }).total).toBe(2);
    expect(searchPoems("王昭君", { corpus: "qts" }).items[0]?.id).toBe("8");
    expect(getPoem("qts", "7")?.entries).toEqual([
      { id: "7", title: "相和歌辞：王昭君", volume: 19 },
      { id: "8", title: "王昭君", volume: 40 },
    ]);
    expect(getPoem("qts", "7")?.volume).toBe(19);
    expect(getPoem("qts", "8")?.volume).toBe(40);
    expect(getPoem("qts", "7")?.volumeCount).toBe(95);
    expect(getPoem("qts", "7")?.alternateAttributions).toEqual([
      {
        id: "9",
        title: "王昭君",
        author: "另一作者",
        volume: 95,
      },
    ]);
    expect(getPoem("qts", "7")?.recordPosition).toBe(5);
    expect(getPoem("qts", "8")?.recordPosition).toBe(6);
    expect(getAdjacentPoems("qts", "7")).toMatchObject({
      previous: { id: "4" },
      next: { id: "8" },
    });
    expect(getAdjacentPoems("qts", "8")).toMatchObject({
      previous: { id: "7" },
      next: { id: "9" },
    });
  });

  it("browses one corpus without requiring keywords", () => {
    expect(searchPoems("", { corpus: "qts" }).total).toBe(4);
    expect(searchPoems("").items).toEqual([]);
  });

  it("unions selected authors and intersects structural filters", () => {
    expect(searchPoems("", {
      corpus: "qts", authors: ["李白", "杜甫"],
    }).total).toBe(3);
    const response = searchPoems("", {
      corpus: "qts", authors: ["李白", "杜甫"], lineType: "5言", sentenceCount: 4,
    });
    expect(response.items.map((poem) => poem.id)).toEqual(["1"]);
  });

  it("combines full-text matching with all advanced conditions", () => {
    const response = searchPoems("明月", {
      corpus: "qts", authors: ["李白", "杜甫"], lineType: "5言", sentenceCount: 8,
    });
    expect(response.items.map((poem) => poem.id)).toEqual(["2"]);
  });

  it("normalizes exact author selections and traditional keywords", () => {
    expect(searchPoems("黄河", {
      corpus: "qss", authors: ["苏轼", "蘇軾"],
    }).items.map((poem) => poem.id)).toEqual(["5"]);
  });

  it("paginates and clamps pages while retaining filters", () => {
    const response = searchPoems("", { corpus: "qts", page: 99, pageSize: 2 });
    expect(response.total).toBe(4);
    expect(response.page).toBe(2);
    expect(response.items.map((poem) => poem.id)).toEqual(["3", "4"]);
  });

  it("keeps existing keyword-only search and author ranking", () => {
    expect(searchPoems("李白").items.map((poem) => poem.id)).toEqual(["1", "3"]);
  });

  it("returns no results for mismatched filters without broadening the search", () => {
    expect(searchPoems("", { corpus: "qts", authors: ["蘇軾"] }).total).toBe(0);
    expect(searchPoems("", { corpus: "qts", authors: ["' OR 1=1 --"] }).total).toBe(0);
  });

  it("loads author and line-type choices only from the selected corpus", () => {
    const options = getCorpusSearchOptions("qts");
    expect(options.authors.map((author) => author.label).sort()).toEqual(["李白", "杜甫", "王维"].sort());
    expect(options.lineTypes).toEqual([{ label: "5言", value: 3 }, { label: "7言", value: 1 }]);
    expect(options.sentenceCounts).toEqual([{ label: "4", value: 3 }, { label: "8", value: 1 }]);
  });
});
