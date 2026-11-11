import Database from "better-sqlite3";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  installGuangyunDictionary,
  installPingshuiyunDictionary,
} from "./guangyun-data.mjs";

let directory;

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "shici-guangyun-"));
});

afterEach(() => {
  rmSync(directory, { recursive: true, force: true });
});

describe("Guangyun dictionary installation", () => {
  it("preserves the original database, aliases and source notices", () => {
    const source = join(directory, "source.sqlite");
    const target = join(directory, "lookup.sqlite");
    const database = new Database(source);
    database.exec(`
      CREATE TABLE character_readings (character TEXT, tone TEXT, rhyme TEXT);
      CREATE TABLE character_aliases (input_character TEXT, target_character TEXT);
      CREATE TABLE metadata (key TEXT, value TEXT);
      INSERT INTO character_readings VALUES ('淸', '平', '淸'), ('⿰隺犬', '入', '覺');
      INSERT INTO character_aliases VALUES ('清', '淸');
      INSERT INTO metadata VALUES ('license_text', 'Source notice');
    `);
    database.prepare("INSERT INTO metadata VALUES ('dictionary', ?)").run(
      JSON.stringify({
        name: "Test dictionary",
        source_url: "https://example.org/dictionary",
        license: "GPL-2.0",
      }),
    );
    database.close();

    installGuangyunDictionary(source, target);

    expect(readFileSync(target)).toEqual(readFileSync(source));
  });

  describe("Pingshuiyun dictionary installation", () => {
    it("preserves the independent 106-rhyme lookup and metadata", () => {
      const source = join(directory, "pingshuiyun-source.sqlite");
      const target = join(directory, "pingshuiyun-lookup.sqlite");
      const database = new Database(source);
      database.exec(`
        CREATE TABLE rhyme_groups (tone TEXT);
        CREATE TABLE character_rhymes (character TEXT);
        CREATE TABLE character_aliases (input_character TEXT, target_character TEXT);
        CREATE TABLE metadata (key TEXT, value TEXT);
        CREATE VIEW character_lookup AS
          SELECT '東' AS character, '東' AS canonical_character, '平' AS tone,
            '上' AS register, 1 AS ordinal, '東' AS rhyme, '上平聲' AS section,
            0 AS is_supplement, '' AS supplement_kind, 'canonical' AS match_type;
        INSERT INTO character_rhymes VALUES ('東');
        INSERT INTO character_aliases VALUES ('东', '東');
        INSERT INTO metadata VALUES ('license_text', 'Source notice');
      `);
      const insertTone = database.prepare("INSERT INTO rhyme_groups VALUES (?)");
      for (const [tone, count] of [["平", 30], ["上", 29], ["去", 30], ["入", 17]]) {
        for (let index = 0; index < count; index += 1) {
          insertTone.run(tone);
        }
      }
      database.prepare("INSERT INTO metadata VALUES ('dictionary', ?)").run(
        JSON.stringify({ name: "平水韵", scope: "106韵", license: "MIT" }),
      );
      database.close();

      installPingshuiyunDictionary(source, target);

      expect(readFileSync(target)).toEqual(readFileSync(source));
    });
  });

  it("rejects an incomplete dictionary without replacing the installed file", () => {
    const source = join(directory, "source.sqlite");
    const target = join(directory, "lookup.sqlite");
    const database = new Database(source);
    database.exec("CREATE TABLE character_readings (character TEXT)");
    database.close();
    writeFileSync(target, "previous dictionary");

    expect(() => installGuangyunDictionary(source, target)).toThrow();
    expect(readFileSync(target, "utf8")).toBe("previous dictionary");
  });
});
