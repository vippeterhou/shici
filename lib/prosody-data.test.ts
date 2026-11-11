import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getPoemProsody } from "@/lib/prosody-data";
import { rhymeLabels, splitProsodyLines, supportsProsody, toneLabel } from "@/lib/prosody";
import type { Poem } from "@/lib/types";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({
  getGuangyunDatabase: () => activeGuangyunDatabase,
  getPingshuiyunDatabase: () => activePingshuiyunDatabase,
}));

let guangyunDatabase: Database.Database;
let pingshuiyunDatabase: Database.Database;
let activeGuangyunDatabase: Database.Database | null;
let activePingshuiyunDatabase: Database.Database | null;

function poem(overrides: Partial<Poem> = {}): Poem {
  return {
    id: "ts300:sample", workId: "sample", textId: "sample",
    recordPosition: 1, volume: null, volumeCount: null, corpus: "ts300",
    title: "测试", author: "作者",
    paragraphs: ["清清清清瀟，清清清清思。", "清清清清霜，清清清清蝴。"],
    tags: [], chapter: null, section: null,
    sentenceCount: 4, sentenceLengths: [5, 5, 5, 5],
    uniformSentenceLength: 5, characterCount: 20, lineType: "5言",
    entries: [], alternateAttributions: [],
    ...overrides,
  };
}

beforeEach(() => {
  guangyunDatabase = new Database(":memory:");
  activeGuangyunDatabase = guangyunDatabase;
  guangyunDatabase.exec(`
    CREATE TABLE character_readings (character TEXT, tone TEXT, rhyme TEXT);
    CREATE TABLE character_aliases (input_character TEXT, target_character TEXT);
    INSERT INTO character_readings VALUES
      ('淸', '平', '淸'), ('瀟', '平', '蕭'),
      ('潚', '平', '蕭'), ('潚', '入', '屋'),
      ('思', '平', '之'), ('思', '去', '志'), ('霜', '平', '陽');
    INSERT INTO character_aliases VALUES
      ('清', '淸'), ('清', '缺'), ('瀟', '潚'), ('瀟', '潚');
  `);
  pingshuiyunDatabase = new Database(":memory:");
  activePingshuiyunDatabase = pingshuiyunDatabase;
  pingshuiyunDatabase.exec(`
    CREATE TABLE character_lookup (
      character TEXT, canonical_character TEXT, tone TEXT, register TEXT,
      ordinal INTEGER, rhyme TEXT, section TEXT, is_supplement INTEGER,
      supplement_kind TEXT, match_type TEXT
    );
    INSERT INTO character_lookup VALUES
      ('清', '淸', '平', '下', 9, '青', '下平聲', 0, '', 'alias'),
      ('瀟', '瀟', '平', '下', 2, '蕭', '下平聲', 0, '', 'canonical'),
      ('思', '思', '平', '上', 4, '支', '上平聲', 0, '', 'canonical'),
      ('思', '思', '去', NULL, 4, '寘', '去聲', 0, '', 'canonical'),
      ('霜', '霜', '平', '下', 7, '陽', '下平聲', 1, '詞', 'canonical');
  `);
});

afterEach(() => {
  guangyunDatabase.close();
  pingshuiyunDatabase.close();
});

describe("poem prosody", () => {
  it.each([[5, 4], [5, 8], [7, 4], [7, 8]])(
    "supports only the requested Tang 300 structures: %i by %i",
    (uniformSentenceLength, sentenceCount) => {
      expect(supportsProsody(poem({ uniformSentenceLength, sentenceCount }))).toBe(true);
    },
  );

  it("leaves other corpora and structures untouched", () => {
    expect(getPoemProsody(poem({ corpus: "qts" }))).toBeNull();
    expect(getPoemProsody(poem({ sentenceCount: 12 }))).toBeNull();
    expect(getPoemProsody(poem({ uniformSentenceLength: null }))).toBeNull();
  });

  it("splits paired sentences and retains punctuation and supplementary characters", () => {
    expect(splitProsodyLines(["𠋫清，明月。\n", "上山！下海？"])).toEqual([
      "𠋫清，", "明月。", "上山！", "下海？",
    ]);
  });

  it("combines original and alias candidates without selecting or duplicating readings", () => {
    const analysis = getPoemProsody(poem());
    expect(analysis?.status).toBe("ready");
    if (analysis?.status !== "ready") throw new Error("Missing analysis");
    expect(analysis.books.map((book) => book.key)).toEqual([
      "guangyun", "pingshuiyun",
    ]);
    const guangyun = analysis.books[0];
    expect(guangyun.lines).toHaveLength(4);
    const tokens = guangyun.lines[0].tokens;
    expect(tokens[0]).toEqual({
      character: "清",
      readings: [{
        headword: "淸", tone: "平", rhyme: "淸", displayRhyme: "淸韵",
        compactRhyme: "淸韵",
      }],
    });
    expect(tokens[4].readings).toHaveLength(3);
    expect(toneLabel(tokens[4].readings!)).toBe("平/仄");
    expect(rhymeLabels(tokens[4].readings!)).toEqual(["蕭韵", "屋韵"]);
    expect(tokens[5]).toEqual({ character: "，", readings: null });
    expect(toneLabel(guangyun.lines[1].tokens[4].readings!)).toBe("平/仄");
    expect(rhymeLabels(guangyun.lines[2].tokens[4].readings!)).toEqual(["陽韵"]);
    expect(toneLabel(guangyun.lines[3].tokens[4].readings!)).toBe("?");
    expect(rhymeLabels(guangyun.lines[3].tokens[4].readings!)).toEqual(["归韵未匹配"]);

    const pingshuiyun = analysis.books[1];
    expect(rhymeLabels(pingshuiyun.lines[0].tokens[0].readings!))
      .toEqual(["青韵"]);
    expect(rhymeLabels(pingshuiyun.lines[0].tokens[4].readings!))
      .toEqual(["蕭韵"]);
    expect(toneLabel(pingshuiyun.lines[1].tokens[4].readings!)).toBe("平/仄");
    expect(pingshuiyun.lines[2].tokens[4].readings![0].supplementKind).toBe("詞");
  });

  it("keeps tonal and rhyme uncertainty separate", () => {
    const readings = [
      {
        headword: "甲", tone: "上" as const, rhyme: "感",
        compactRhyme: "感韵", displayRhyme: "上十三感",
      },
      {
        headword: "甲", tone: "去" as const, rhyme: "勘",
        compactRhyme: "勘韵", displayRhyme: "去二十八勘",
      },
    ];
    expect(toneLabel(readings)).toBe("仄");
    expect(rhymeLabels(readings)).toEqual(["感韵", "勘韵"]);
  });

  it("reports missing dictionary resources explicitly", () => {
    activeGuangyunDatabase = null;
    activePingshuiyunDatabase = null;
    expect(getPoemProsody(poem())).toMatchObject({
      status: "unavailable", message: expect.stringContaining("未包含可用的韵书"),
    });
  });

  it("does not annotate text inconsistent with its format metadata", () => {
    expect(() => getPoemProsody(poem({ paragraphs: ["清清清清瀟。"] })))
      .toThrow("Poem structure does not match");
  });
});
