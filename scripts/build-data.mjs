import { createHash } from "node:crypto";
import { createReadStream, createWriteStream, existsSync, mkdirSync, readFileSync, renameSync, rmSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { createGunzip } from "node:zlib";
import { createInterface } from "node:readline";
import Database from "better-sqlite3";
import OpenCC from "opencc-js";
import {
  collectNgrams,
  countCandidateNgrams,
  SpaceSaving,
} from "./ngrams.mjs";

const INDEX_SCHEMA_VERSION = 4;
const TRIGRAM_CANDIDATE_LIMIT = 20_000;
const FREQUENCY_DISPLAY_LIMIT = 100;

const root = resolve(import.meta.dirname, "..");
const configuredManifest = process.env.SHICI_DATA_MANIFEST;
const manifestPath = configuredManifest
  ? resolve(root, configuredManifest)
  : join(root, "data_release.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const outputPath = join(root, "data", "shici.sqlite");
const temporaryOutputPath = `${outputPath}.building`;
const downloadsPath = join(root, ".data-downloads");
const toSimplified = OpenCC.Converter({ from: "hk", to: "cn" });

const corpusCatalog = [
  {
    key: "shijing",
    name: "诗经",
    era: "先秦",
    description: "中国最早的诗歌总集，循风、雅、颂进入先民的声音。",
  },
  {
    key: "qinhan",
    name: "秦汉诗",
    era: "秦汉",
    description: "从楚声余韵到汉乐府，见证古诗体式的生长。",
  },
  {
    key: "wjnbc",
    name: "魏晋南北朝诗",
    era: "魏晋南北朝",
    description: "山水、田园与玄言交汇，五言诗逐渐成熟。",
  },
  {
    key: "ts300",
    name: "唐诗三百首",
    era: "唐",
    description: "适合初识唐诗的经典选本，名篇与名家汇聚。",
  },
  {
    key: "qts",
    name: "全唐诗",
    era: "唐",
    description: "纵览唐代诗歌全貌，从大家名篇到时代细部。",
  },
  {
    key: "sc300",
    name: "宋词三百首",
    era: "宋",
    description: "以经典选本进入宋词，体会词牌中的声情流转。",
  },
  {
    key: "qsc",
    name: "全宋词",
    era: "宋",
    description: "从婉约到豪放，完整探索宋代词作与词人。",
  },
  {
    key: "qss",
    name: "全宋诗",
    era: "宋",
    description: "二十五万余首宋诗构成广阔而细密的时代切面。",
  },
];

mkdirSync(dirname(outputPath), { recursive: true });
mkdirSync(downloadsPath, { recursive: true });

const fingerprint = createHash("sha256")
  .update(String(INDEX_SCHEMA_VERSION))
  .update(JSON.stringify(manifest))
  .digest("hex");

if (databaseMatches(outputPath, fingerprint)) {
  console.log(`Data index is current: ${outputPath}`);
  process.exit(0);
}

rmSync(temporaryOutputPath, { force: true });
const database = new Database(temporaryOutputPath);
database.pragma("journal_mode = OFF");
database.pragma("synchronous = OFF");
database.pragma("temp_store = MEMORY");
database.pragma("cache_size = -131072");

createSchema(database);

const insertCorpus = database.prepare(`
  INSERT INTO corpora (key, name, era, description, sort_order, poem_count)
  VALUES (@key, @name, @era, @description, @sortOrder, @poemCount)
`);
const insertPoem = database.prepare(`
  INSERT INTO poems (
    id, corpus, title, author, body, tags_json,
    chapter, section, sentence_count, sentence_lengths_json,
    uniform_sentence_length, character_count, line_type,
    title_normalized, author_normalized
  ) VALUES (
    @id, @corpus, @title, @author, @body, @tagsJson,
    @chapter, @section, @sentenceCount, @sentenceLengthsJson,
    @uniformSentenceLength, @characterCount, @lineType,
    @titleNormalized, @authorNormalized
  )
`);
const insertSearch = database.prepare(`
  INSERT INTO poems_fts (
    rowid, title, author, tune, tags, body
  ) VALUES (
    @rowid, @title, @author, @tune, @tags, @body
  )
`);

for (const [sortOrder, corpus] of corpusCatalog.entries()) {
  const asset = manifest.corpora[corpus.key];
  if (!asset) {
    throw new Error(`Manifest does not define corpus: ${corpus.key}`);
  }
  const assetPath = await obtainAsset(asset);
  insertCorpus.run({
    ...corpus,
    sortOrder,
    poemCount: asset.poem_count,
  });
  const characterCounts = new Map();
  const bigramCandidates = new SpaceSaving(TRIGRAM_CANDIDATE_LIMIT);
  const trigramCandidates = new SpaceSaving(TRIGRAM_CANDIDATE_LIMIT);
  let importedCount = 0;

  const transaction = database.transaction((records) => {
    for (const record of records) {
      validateRecord(record, corpus.key);
      const paragraphs = record.paragraphs;
      const body = paragraphs.join("\n");
      const tags = [
        ...(record.tags ?? []),
        ...(record.chapter ? [record.chapter] : []),
        ...(record.section ? [record.section] : []),
      ];
      const format = record.format;
      const characterCount = countHanCharacters(body);
      const lineType = format.uniform_sentence_length
        ? `${format.uniform_sentence_length}言`
        : "杂言";
      const titleNormalized = normalizeText(record.title);
      const authorNormalized = normalizeText(record.author);
      const result = insertPoem.run({
        id: record.id,
        corpus: corpus.key,
        title: record.title,
        author: record.author,
        body,
        tagsJson: JSON.stringify(tags),
        chapter: record.chapter ?? null,
        section: record.section ?? null,
        sentenceCount: format.sentence_count,
        sentenceLengthsJson: JSON.stringify(format.sentence_lengths),
        uniformSentenceLength: format.uniform_sentence_length,
        characterCount,
        lineType,
        titleNormalized,
        authorNormalized,
      });
      const tune = isCiCorpus(corpus.key)
        ? extractTune(record.title)
        : "";
      insertSearch.run({
        rowid: Number(result.lastInsertRowid),
        title: tokenizeSearch(titleNormalized),
        author: tokenizeSearch(authorNormalized),
        tune: tokenizeSearch(normalizeText(tune)),
        tags: tokenizeSearch(normalizeText(tags.join(" "))),
        body: tokenizeSearch(normalizeText(body)),
      });
      for (const character of body) {
        if (isHanCharacter(character)) {
          characterCounts.set(
            character,
            (characterCounts.get(character) ?? 0) + 1,
          );
        }
      }
      for (const paragraph of paragraphs) {
        collectNgrams(paragraph, bigramCandidates, trigramCandidates);
      }
      importedCount += 1;
    }
  });

  let batch = [];
  const input = createReadStream(assetPath).pipe(createGunzip());
  const lines = createInterface({ input, crlfDelay: Infinity });
  for await (const line of lines) {
    if (!line.trim()) {
      continue;
    }
    batch.push(JSON.parse(line));
    if (batch.length >= 1_000) {
      transaction(batch);
      batch = [];
    }
  }
  if (batch.length) {
    transaction(batch);
  }
  if (importedCount !== asset.poem_count) {
    throw new Error(
      `${corpus.key} count mismatch: expected ${asset.poem_count}, got ${importedCount}`,
    );
  }

  const insertCharacter = database.prepare(`
    INSERT INTO character_stats (corpus, character, count)
    VALUES (?, ?, ?)
  `);
  const insertCharacters = database.transaction((entries) => {
    for (const [character, count] of entries) {
      insertCharacter.run(corpus.key, character, count);
    }
  });
  insertCharacters(
    [...characterCounts.entries()].sort((left, right) => right[1] - left[1]),
  );
  storeTextFrequencies(
    database,
    corpus.key,
    bigramCandidates.tokens(),
    trigramCandidates.tokens(),
  );
  console.log(`Imported ${corpus.name}: ${importedCount.toLocaleString()} works`);
}

buildStatistics(database);
database.prepare("INSERT INTO metadata (key, value) VALUES (?, ?)").run(
  "fingerprint",
  fingerprint,
);
database.prepare("INSERT INTO metadata (key, value) VALUES (?, ?)").run(
  "release_version",
  manifest.version,
);
database.prepare("INSERT INTO metadata (key, value) VALUES (?, ?)").run(
  "schema_version",
  String(INDEX_SCHEMA_VERSION),
);
database.pragma("optimize");
database.close();
rmSync(outputPath, { force: true });
renameSync(temporaryOutputPath, outputPath);
console.log(`Built ${outputPath}`);

function createSchema(db) {
  db.exec(`
    CREATE TABLE metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE corpora (
      key TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      era TEXT NOT NULL,
      description TEXT NOT NULL,
      sort_order INTEGER NOT NULL,
      poem_count INTEGER NOT NULL
    );
    CREATE TABLE poems (
      rowid INTEGER PRIMARY KEY,
      id TEXT NOT NULL UNIQUE,
      corpus TEXT NOT NULL REFERENCES corpora(key),
      title TEXT NOT NULL,
      author TEXT NOT NULL,
      body TEXT NOT NULL,
      tags_json TEXT NOT NULL,
      chapter TEXT,
      section TEXT,
      sentence_count INTEGER NOT NULL,
      sentence_lengths_json TEXT NOT NULL,
      uniform_sentence_length INTEGER,
      character_count INTEGER NOT NULL,
      line_type TEXT NOT NULL,
      title_normalized TEXT NOT NULL,
      author_normalized TEXT NOT NULL
    );
    CREATE VIRTUAL TABLE poems_fts USING fts5(
      title,
      author,
      tune,
      tags,
      body,
      content = '',
      tokenize = 'unicode61 remove_diacritics 2'
    );
    CREATE TABLE corpus_stats (
      corpus TEXT PRIMARY KEY,
      poem_count INTEGER NOT NULL,
      author_count INTEGER NOT NULL,
      character_count INTEGER NOT NULL,
      average_characters REAL NOT NULL
    );
    CREATE TABLE author_stats (
      corpus TEXT NOT NULL,
      author TEXT NOT NULL,
      count INTEGER NOT NULL,
      PRIMARY KEY (corpus, author)
    );
    CREATE TABLE sentence_stats (
      corpus TEXT NOT NULL,
      sentence_count INTEGER NOT NULL,
      count INTEGER NOT NULL,
      PRIMARY KEY (corpus, sentence_count)
    );
    CREATE TABLE line_stats (
      corpus TEXT NOT NULL,
      line_type TEXT NOT NULL,
      count INTEGER NOT NULL,
      PRIMARY KEY (corpus, line_type)
    );
    CREATE TABLE format_combination_stats (
      corpus TEXT NOT NULL,
      sentence_count INTEGER NOT NULL,
      line_type TEXT NOT NULL,
      count INTEGER NOT NULL,
      PRIMARY KEY (corpus, sentence_count, line_type)
    );
    CREATE TABLE character_stats (
      corpus TEXT NOT NULL,
      character TEXT NOT NULL,
      count INTEGER NOT NULL,
      PRIMARY KEY (corpus, character)
    );
    CREATE TABLE text_frequency_stats (
      corpus TEXT NOT NULL,
      size INTEGER NOT NULL,
      term TEXT NOT NULL,
      count INTEGER NOT NULL,
      PRIMARY KEY (corpus, size, term)
    );
    CREATE INDEX poems_corpus_rowid ON poems(corpus, rowid);
    CREATE INDEX poems_corpus_author ON poems(corpus, author_normalized);
    CREATE INDEX poems_title_normalized ON poems(title_normalized);
    CREATE INDEX poems_author_normalized ON poems(author_normalized);
  `);
}

function buildStatistics(db) {
  db.exec(`
    INSERT INTO corpus_stats
    SELECT
      corpus,
      COUNT(*),
      COUNT(DISTINCT author_normalized),
      SUM(character_count),
      AVG(character_count)
    FROM poems
    GROUP BY corpus;

    INSERT INTO author_stats
    SELECT corpus, author, COUNT(*)
    FROM poems
    GROUP BY corpus, author;

    INSERT INTO sentence_stats
    SELECT corpus, sentence_count, COUNT(*)
    FROM poems
    GROUP BY corpus, sentence_count;

    INSERT INTO line_stats
    SELECT corpus, line_type, COUNT(*)
    FROM poems
    GROUP BY corpus, line_type;

    INSERT INTO format_combination_stats
    SELECT corpus, sentence_count, line_type, COUNT(*)
    FROM poems
    GROUP BY corpus, sentence_count, line_type;
  `);
}

async function obtainAsset(asset) {
  const localDirectory = process.env.SHICI_DATA_ASSET_DIRECTORY;
  if (localDirectory) {
    const localPath = resolve(root, localDirectory, asset.asset);
    await verifyChecksum(localPath, asset.sha256);
    return localPath;
  }

  const url = `https://github.com/${manifest.repository}/releases/download/${manifest.version}/${asset.asset}`;
  const target = join(downloadsPath, `${manifest.version}-${basename(asset.asset)}`);
  if (existsSync(target)) {
    try {
      await verifyChecksum(target, asset.sha256);
      return target;
    } catch {
      rmSync(target, { force: true });
    }
  }
  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error(`Unable to download ${url}: HTTP ${response.status}`);
  }
  const temporaryTarget = `${target}.download`;
  rmSync(temporaryTarget, { force: true });
  await pipeline(
    Readable.fromWeb(response.body),
    createWriteStream(temporaryTarget),
  );
  await verifyChecksum(temporaryTarget, asset.sha256);
  renameSync(temporaryTarget, target);
  return target;
}

async function verifyChecksum(path, expected) {
  const digest = createHash("sha256");
  for await (const chunk of createReadStream(path)) {
    digest.update(chunk);
  }
  const actual = digest.digest("hex");
  if (actual !== expected) {
    throw new Error(
      `Checksum mismatch for ${path}: expected ${expected}, got ${actual}`,
    );
  }
}

function databaseMatches(path, expectedFingerprint) {
  if (!existsSync(path)) {
    return false;
  }
  try {
    const existing = new Database(path, { readonly: true, fileMustExist: true });
    const row = existing
      .prepare("SELECT value FROM metadata WHERE key = 'fingerprint'")
      .get();
    existing.close();
    return row?.value === expectedFingerprint;
  } catch {
    return false;
  }
}

function normalizeText(value) {
  return toSimplified(value.normalize("NFKC")).toLocaleLowerCase("zh-CN");
}

function tokenizeSearch(value) {
  const tokens = [];
  for (const chunk of value.match(/[\p{L}\p{N}]+/gu) ?? []) {
    if (/\p{Script=Han}/u.test(chunk)) {
      tokens.push(...chunk);
    } else {
      tokens.push(chunk);
    }
  }
  return tokens.join(" ");
}

function countHanCharacters(value) {
  let count = 0;
  for (const character of value) {
    if (isHanCharacter(character)) {
      count += 1;
    }
  }
  return count;
}

function isHanCharacter(value) {
  return /\p{Script=Han}/u.test(value) || value === "〇";
}

function isCiCorpus(key) {
  return key === "sc300" || key === "qsc";
}

function extractTune(title) {
  return title.split(/[·・]/u, 1)[0].trim();
}

function storeTextFrequencies(
  database,
  corpus,
  bigramCandidateTerms,
  trigramCandidateTerms,
) {
  const bigramCounts = new Map(
    [...bigramCandidateTerms].map((term) => [term, 0]),
  );
  const trigramCounts = new Map(
    [...trigramCandidateTerms].map((term) => [term, 0]),
  );
  const rows = database
    .prepare("SELECT body FROM poems WHERE corpus = ?")
    .iterate(corpus);
  for (const { body } of rows) {
    countCandidateNgrams(body, bigramCounts, trigramCounts);
  }
  const insert = database.prepare(`
    INSERT INTO text_frequency_stats (corpus, size, term, count)
    VALUES (?, ?, ?, ?)
  `);
  const insertTop = database.transaction((size, counts) => {
    const topCounts = [...counts.entries()]
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .slice(0, FREQUENCY_DISPLAY_LIMIT);
    for (const [term, count] of topCounts) {
      insert.run(corpus, size, term, count);
    }
  });
  insertTop(2, bigramCounts);
  insertTop(3, trigramCounts);
}

function validateRecord(record, corpus) {
  if (
    !record ||
    typeof record !== "object" ||
    typeof record.id !== "string" ||
    !record.id.startsWith(`${corpus}:`) ||
    typeof record.title !== "string" ||
    typeof record.author !== "string" ||
    !Array.isArray(record.paragraphs) ||
    record.paragraphs.length === 0 ||
    !record.paragraphs.every((value) => typeof value === "string") ||
    !record.format ||
    !Number.isInteger(record.format.sentence_count) ||
    !Array.isArray(record.format.sentence_lengths) ||
    record.format.sentence_lengths.length !== record.format.sentence_count
  ) {
    throw new Error(`Invalid ${corpus} release record: ${record?.id ?? "unknown"}`);
  }
}
