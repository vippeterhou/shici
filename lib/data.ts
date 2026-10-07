import "server-only";

import { cache } from "react";
import type { Database } from "better-sqlite3";
import { getDatabase } from "@/lib/db";
import { compactExcerpt } from "@/lib/format";
import {
  findFirstSearchMatch,
  normalizeSearchText,
  toFtsQuery,
} from "@/lib/search-normalization";
import type {
  Corpus,
  CorpusInsights,
  CorpusStats,
  InsightDatum,
  FormatCombinationDatum,
  CorpusStructure,
  PaginatedPoems,
  Poem,
  PoemSummary,
  SearchResponse,
} from "@/lib/types";

const DEFAULT_PAGE_SIZE = 24;
const MAX_PAGE_SIZE = 48;

interface CorpusRow {
  key: string;
  name: string;
  era: string;
  description: string;
  sort_order: number;
  poem_count: number;
}

interface StatsRow {
  corpus: string;
  poem_count: number;
  author_count: number;
  character_count: number;
  average_characters: number;
}

interface PoemRow {
  id: string;
  corpus: string;
  corpus_name?: string;
  title: string;
  author: string;
  body: string;
  tags_json: string;
  chapter?: string | null;
  section?: string | null;
  sentence_count: number;
  sentence_lengths_json?: string;
  uniform_sentence_length?: number | null;
  character_count: number;
  line_type?: string;
}

interface CountRow {
  count: number;
}

interface DatumRow {
  label: string | number;
  value: number;
}

export const getCorpora = cache((): Corpus[] => {
  const rows = getDatabase()
    .prepare(
      `SELECT key, name, era, description, sort_order, poem_count
       FROM corpora
       ORDER BY sort_order`,
    )
    .all() as CorpusRow[];
  return rows.map(mapCorpus);
});

export const getCorpus = cache((key: string): Corpus | null => {
  const row = getDatabase()
    .prepare(
      `SELECT key, name, era, description, sort_order, poem_count
       FROM corpora
       WHERE key = ?`,
    )
    .get(key) as CorpusRow | undefined;
  return row ? mapCorpus(row) : null;
});

export const getCorpusStats = cache((key: string): CorpusStats | null => {
  const row = getDatabase()
    .prepare(
      `SELECT corpus, poem_count, author_count, character_count,
              average_characters
       FROM corpus_stats
       WHERE corpus = ?`,
    )
    .get(key) as StatsRow | undefined;
  return row ? mapStats(row) : null;
});

export const getPoem = cache((corpus: string, id: string): Poem | null => {
  const row = getDatabase()
    .prepare(
      `SELECT id, corpus, title, author, body, tags_json,
              chapter, section, sentence_count, sentence_lengths_json,
              uniform_sentence_length, character_count, line_type
       FROM poems
       WHERE corpus = ? AND id = ?`,
    )
    .get(corpus, id) as PoemRow | undefined;
  if (!row?.sentence_lengths_json || !row.line_type) {
    return null;
  }
  return {
    id: row.id,
    corpus: row.corpus,
    title: row.title,
    author: row.author,
    paragraphs: row.body.split("\n"),
    tags: JSON.parse(row.tags_json) as string[],
    chapter: row.chapter ?? null,
    section: row.section ?? null,
    sentenceCount: row.sentence_count,
    sentenceLengths: JSON.parse(row.sentence_lengths_json) as number[],
    uniformSentenceLength: row.uniform_sentence_length ?? null,
    characterCount: row.character_count,
    lineType: row.line_type,
  };
});

export function listCorpusPoems(
  corpus: string,
  options: {
    page?: number;
    pageSize?: number;
    author?: string;
  } = {},
): PaginatedPoems {
  const requestedPage = positiveInteger(options.page, 1);
  const pageSize = Math.min(
    positiveInteger(options.pageSize, DEFAULT_PAGE_SIZE),
    MAX_PAGE_SIZE,
  );
  const author = options.author?.trim();
  const where = ["p.corpus = ?"];
  const parameters: Array<string | number> = [corpus];
  if (author) {
    where.push("p.author_normalized = ?");
    parameters.push(normalizeSearchText(author));
  }
  const database = getDatabase();
  const total = (
    database
      .prepare(`SELECT COUNT(*) AS count FROM poems p WHERE ${where.join(" AND ")}`)
      .get(...parameters) as CountRow
  ).count;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requestedPage, pageCount);
  const rows = database
    .prepare(
      `SELECT p.id, p.corpus, c.name AS corpus_name, p.title, p.author,
              p.body, p.tags_json, p.sentence_count, p.character_count
       FROM poems p
       JOIN corpora c ON c.key = p.corpus
       WHERE ${where.join(" AND ")}
       ORDER BY p.rowid
       LIMIT ? OFFSET ?`,
    )
    .all(...parameters, pageSize, (page - 1) * pageSize) as PoemRow[];
  return {
    items: rows.map((row) => mapSummary(row)),
    page,
    pageSize,
    total,
    pageCount,
  };
}

export function searchPoems(
  query: string,
  options: {
    corpus?: string;
    page?: number;
    pageSize?: number;
  } = {},
): SearchResponse {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return {
      query: "",
      items: [],
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
      total: 0,
      pageCount: 1,
    };
  }
  if ([...trimmedQuery].length > 80) {
    throw new Error("搜索内容不能超过 80 个字符");
  }
  const requestedPage = positiveInteger(options.page, 1);
  const pageSize = Math.min(
    positiveInteger(options.pageSize, DEFAULT_PAGE_SIZE),
    MAX_PAGE_SIZE,
  );
  const ftsQuery = toFtsQuery(trimmedQuery);
  const normalizedQuery = normalizeSearchText(trimmedQuery);
  const corpusWhere = options.corpus ? "AND p.corpus = ?" : "";
  const baseParameters: Array<string | number> = [ftsQuery];
  if (options.corpus) {
    baseParameters.push(options.corpus);
  }
  const database = getDatabase();
  const total = (
    database
      .prepare(
        `SELECT COUNT(*) AS count
         FROM poems_fts
         JOIN poems p ON p.rowid = poems_fts.rowid
         WHERE poems_fts MATCH ? ${corpusWhere}`,
      )
      .get(...baseParameters) as CountRow
  ).count;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requestedPage, pageCount);
  const rows = database
    .prepare(
      `SELECT p.id, p.corpus, c.name AS corpus_name, p.title, p.author,
              p.body, p.tags_json, p.sentence_count, p.character_count,
              CASE
                WHEN p.title_normalized = ? THEN 0
                WHEN p.author_normalized = ? THEN 1
                WHEN instr(p.title_normalized, ?) > 0 THEN 2
                WHEN instr(p.author_normalized, ?) > 0 THEN 3
                ELSE 4
              END AS exact_rank,
              bm25(poems_fts, 12.0, 8.0, 6.0, 4.0, 1.0) AS text_rank
       FROM poems_fts
       JOIN poems p ON p.rowid = poems_fts.rowid
       JOIN corpora c ON c.key = p.corpus
       WHERE poems_fts MATCH ? ${corpusWhere}
       ORDER BY exact_rank, text_rank, p.character_count, p.rowid
       LIMIT ? OFFSET ?`,
    )
    .all(
      normalizedQuery,
      normalizedQuery,
      normalizedQuery,
      normalizedQuery,
      ...baseParameters,
      pageSize,
      (page - 1) * pageSize,
    ) as PoemRow[];
  return {
    query: trimmedQuery,
    items: rows.map((row) => mapSummary(row, 88, trimmedQuery)),
    page,
    pageSize,
    total,
    pageCount,
  };
}

export const getDailyPoem = cache((): PoemSummary => {
  const database = getDatabase();
  const dayNumber = Math.floor(Date.now() / 86_400_000);
  const featuredCorpora = ["shijing", "ts300", "sc300"];
  const corpus = featuredCorpora[dayNumber % featuredCorpora.length];
  const count = (
    database
      .prepare("SELECT COUNT(*) AS count FROM poems WHERE corpus = ?")
      .get(corpus) as CountRow
  ).count;
  const row = database
    .prepare(
      `SELECT p.id, p.corpus, c.name AS corpus_name, p.title, p.author,
              p.body, p.tags_json, p.sentence_count, p.character_count
       FROM poems p
       JOIN corpora c ON c.key = p.corpus
       WHERE p.corpus = ?
       ORDER BY p.rowid
       LIMIT 1 OFFSET ?`,
    )
    .get(corpus, dayNumber % count) as PoemRow;
  return mapSummary(row, 140);
});

export const getCorpusInsights = cache(
  (corpusKey: string): CorpusInsights | null => {
    const corpus = getCorpus(corpusKey);
    const stats = getCorpusStats(corpusKey);
    if (!corpus || !stats) {
      return null;
    }
    const database = getDatabase();
    return {
      corpus,
      stats,
      authors: readInsightRows(
        database,
        `SELECT author AS label, count AS value
         FROM author_stats
         WHERE corpus = ?
         ORDER BY count DESC, author
         LIMIT 20`,
        corpusKey,
      ),
      sentenceCounts: readInsightRows(
        database,
        `SELECT CAST(sentence_count AS TEXT) AS label, count AS value
         FROM (
           SELECT sentence_count, count
           FROM sentence_stats
           WHERE corpus = ?
           ORDER BY count DESC, sentence_count
           LIMIT 16
         )
         ORDER BY sentence_count`,
        corpusKey,
      ),
      lineTypes: readInsightRows(
        database,
        `SELECT line_type AS label, count AS value
         FROM line_stats
         WHERE corpus = ?
         ORDER BY
           CASE WHEN line_type = '杂言' THEN 1 ELSE 0 END,
           CAST(REPLACE(line_type, '言', '') AS INTEGER)`,
        corpusKey,
      ),
      characters: readInsightRows(
        database,
        `SELECT character AS label, count AS value
         FROM character_stats
         WHERE corpus = ?
         ORDER BY count DESC
         LIMIT 100`,
        corpusKey,
      ),
      bigrams: readInsightRows(
        database,
        `SELECT term AS label, count AS value
         FROM text_frequency_stats
         WHERE corpus = ? AND size = 2
         ORDER BY count DESC, term
         LIMIT 100`,
        corpusKey,
      ),
      trigrams: readInsightRows(
        database,
        `SELECT term AS label, count AS value
         FROM text_frequency_stats
         WHERE corpus = ? AND size = 3
         ORDER BY count DESC, term
         LIMIT 100`,
        corpusKey,
      ),
      formatCombinations: (
        database
          .prepare(
            `SELECT sentence_count, line_type, count
             FROM format_combination_stats
             WHERE corpus = ?
             ORDER BY sentence_count, line_type`,
          )
          .all(corpusKey) as Array<{
          sentence_count: number;
          line_type: string;
          count: number;
        }>
      ).map(
        (row): FormatCombinationDatum => ({
          sentenceCount: row.sentence_count,
          lineType: row.line_type,
          value: row.count,
        }),
      ),
      structure: readCorpusStructure(database, corpusKey),
    };
  },
);

export function getAdjacentPoems(
  corpus: string,
  id: string,
): { previous: PoemSummary | null; next: PoemSummary | null } {
  const database = getDatabase();
  const current = database
    .prepare("SELECT rowid FROM poems WHERE corpus = ? AND id = ?")
    .get(corpus, id) as { rowid: number } | undefined;
  if (!current) {
    return { previous: null, next: null };
  }
  const selection = `
    SELECT p.id, p.corpus, c.name AS corpus_name, p.title, p.author,
           p.body, p.tags_json, p.sentence_count, p.character_count
    FROM poems p
    JOIN corpora c ON c.key = p.corpus
    WHERE p.corpus = ? AND p.rowid %OPERATOR% ?
    ORDER BY p.rowid %ORDER%
    LIMIT 1
  `;
  const previous = database
    .prepare(selection.replace("%OPERATOR%", "<").replace("%ORDER%", "DESC"))
    .get(corpus, current.rowid) as PoemRow | undefined;
  const next = database
    .prepare(selection.replace("%OPERATOR%", ">").replace("%ORDER%", "ASC"))
    .get(corpus, current.rowid) as PoemRow | undefined;
  return {
    previous: previous ? mapSummary(previous) : null,
    next: next ? mapSummary(next) : null,
  };
}

export function getReleaseVersion(): string {
  const row = getDatabase()
    .prepare("SELECT value FROM metadata WHERE key = 'release_version'")
    .get() as { value: string };
  return row.value;
}

function readInsightRows(
  database: Database,
  query: string,
  corpus: string,
): InsightDatum[] {
  return (database.prepare(query).all(corpus) as DatumRow[]).map((row) => ({
    label: String(row.label),
    value: row.value,
  }));
}

function readCorpusStructure(
  database: Database,
  corpus: string,
): CorpusStructure | null {
  if (corpus === "sc300" || corpus === "qsc") {
    return {
      kind: "tunes",
      data: readInsightRows(
        database,
        `SELECT tune AS label, COUNT(*) AS value
         FROM (
           SELECT CASE
             WHEN instr(title, '·') > 0
               THEN substr(title, 1, instr(title, '·') - 1)
             WHEN instr(title, '・') > 0
               THEN substr(title, 1, instr(title, '・') - 1)
             ELSE title
           END AS tune
           FROM poems
           WHERE corpus = ?
         )
         GROUP BY tune
         ORDER BY value DESC, tune
         LIMIT 20`,
        corpus,
      ),
    };
  }
  if (corpus === "shijing") {
    const data = database
      .prepare(
        `SELECT chapter, section, count
         FROM (
           SELECT chapter, section, COUNT(*) AS count, MIN(rowid) AS first_row
           FROM poems
           WHERE corpus = ? AND chapter IS NOT NULL AND section IS NOT NULL
           GROUP BY chapter, section
         )
         ORDER BY first_row`,
      )
      .all(corpus) as Array<{
      chapter: string;
      section: string;
      count: number;
    }>;
    return {
      kind: "hierarchy",
      data: data.map((row) => ({
        chapter: row.chapter,
        section: row.section,
        value: row.count,
      })),
    };
  }
  return null;
}

function mapCorpus(row: CorpusRow): Corpus {
  return {
    key: row.key,
    name: row.name,
    era: row.era,
    description: row.description,
    sortOrder: row.sort_order,
    poemCount: row.poem_count,
  };
}

function mapStats(row: StatsRow): CorpusStats {
  return {
    corpus: row.corpus,
    poemCount: row.poem_count,
    authorCount: row.author_count,
    characterCount: row.character_count,
    averageCharacters: row.average_characters,
  };
}

function mapSummary(
  row: PoemRow,
  excerptLength = 88,
  query = "",
): PoemSummary {
  return {
    id: row.id,
    corpus: row.corpus,
    corpusName: row.corpus_name ?? row.corpus,
    title: row.title,
    author: row.author,
    excerpt: query
      ? matchingExcerpt(row.body, query, excerptLength)
      : compactExcerpt(row.body, excerptLength),
    tags: JSON.parse(row.tags_json) as string[],
    sentenceCount: row.sentence_count,
    characterCount: row.character_count,
  };
}

function matchingExcerpt(body: string, query: string, length: number): string {
  const match = findFirstSearchMatch(body, query);
  if (!match || body.length <= length) {
    return compactExcerpt(body, length);
  }
  const start = Math.max(0, match.index - Math.floor(length / 3));
  const end = Math.min(body.length, start + length);
  return `${start ? "…" : ""}${body.slice(start, end)}${
    end < body.length ? "…" : ""
  }`;
}

function positiveInteger(value: number | undefined, fallback: number): number {
  return value && Number.isInteger(value) && value > 0 ? value : fallback;
}
