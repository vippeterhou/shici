import "server-only";

import { cache } from "react";
import type { Database } from "better-sqlite3";
import { getDatabase } from "@/lib/db";
import { compactExcerpt } from "@/lib/format";
import { compareLineTypes } from "@/lib/format-combinations";
import {
  collectNgrams,
  countCandidateNgrams,
  isHanCharacter,
  NGRAM_CANDIDATE_LIMIT,
  SpaceSaving,
} from "@/scripts/ngrams.mjs";
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
  PoemSearchOptions,
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
  sentence_count: number;
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
              average_characters,
              COALESCE((
                SELECT SUM(s.sentence_count * s.count)
                FROM sentence_stats s
                WHERE s.corpus = corpus_stats.corpus
              ), 0) AS sentence_count
       FROM corpus_stats
       WHERE corpus = ?`,
    )
    .get(key) as StatsRow | undefined;
  return row ? mapStats(row) : null;
});

export const getCorpusSearchOptions = cache((key: string) => {
  const database = getDatabase();
  return {
    authors: readInsightRows(
      database,
      `SELECT author AS label, count AS value
       FROM author_stats WHERE corpus = ?
       ORDER BY count DESC, author`,
      key,
    ),
    lineTypes: readInsightRows(
      database,
      `SELECT line_type AS label, count AS value
       FROM line_stats WHERE corpus = ?
       ORDER BY
         CASE WHEN line_type = '杂言' THEN 1 ELSE 0 END,
         CAST(REPLACE(line_type, '言', '') AS INTEGER)`,
      key,
    ),
    sentenceCounts: readInsightRows(
      database,
      `SELECT sentence_count AS label, count AS value
       FROM sentence_stats WHERE corpus = ?
       ORDER BY sentence_count`,
      key,
    ),
  };
});

export function getFilteredAuthorOptions(
  query: string,
  options: PoemSearchOptions & { corpus: string },
): InsightDatum[] {
  const authors = getCorpusSearchOptions(options.corpus).authors.map((author) => ({
    ...author,
    normalized: normalizeSearchText(author.label),
  }));
  // Author selections are ORed; counts describe each option under the other filters.
  const criteria = {
    corpus: options.corpus,
    lineType: options.lineType,
    sentenceCount: options.sentenceCount,
  };
  const trimmedQuery = query.trim();
  const counts = new Map<string, number>();
  if (hasAdditionalFilters(trimmedQuery, criteria)) {
    const { from, condition, baseParameters } = selectPoems(trimmedQuery, criteria);
    const rows = readInsightRows(
      getDatabase(),
      `SELECT p.author_normalized AS label, COUNT(*) AS value
       ${from} WHERE ${condition}
       GROUP BY p.author_normalized`,
      ...baseParameters,
    );
    for (const row of rows) counts.set(row.label, row.value);
  } else {
    for (const author of authors) {
      counts.set(author.normalized, (counts.get(author.normalized) ?? 0) + author.value);
    }
  }
  return authors.map(({ label, normalized }) => ({ label, value: counts.get(normalized) ?? 0 }));
}

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
  options: PoemSearchOptions = {},
): SearchResponse {
  const trimmedQuery = query.trim();
  if (!trimmedQuery && !options.corpus) {
    return {
      query: "",
      items: [],
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
      total: 0,
      pageCount: 1,
    };
  }
  const requestedPage = positiveInteger(options.page, 1);
  const pageSize = Math.min(
    positiveInteger(options.pageSize, DEFAULT_PAGE_SIZE),
    MAX_PAGE_SIZE,
  );
  const normalizedQuery = normalizeSearchText(trimmedQuery);
  const { from, condition, baseParameters } = selectPoems(trimmedQuery, options);
  const database = getDatabase();
  const total = (
    database
      .prepare(
        `SELECT COUNT(*) AS count
         ${from}
         WHERE ${condition}`,
      )
      .get(...baseParameters) as CountRow
  ).count;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requestedPage, pageCount);
  const ranking = trimmedQuery
    ? `,
              CASE
                WHEN p.title_normalized = ? THEN 0
                WHEN p.author_normalized = ? THEN 1
                WHEN instr(p.title_normalized, ?) > 0 THEN 2
                WHEN instr(p.author_normalized, ?) > 0 THEN 3
                ELSE 4
              END AS exact_rank,
              bm25(poems_fts, 12.0, 8.0, 6.0, 4.0, 1.0) AS text_rank`
    : "";
  const rankingParameters = trimmedQuery
    ? [normalizedQuery, normalizedQuery, normalizedQuery, normalizedQuery]
    : [];
  const rows = database
    .prepare(
      `SELECT p.id, p.corpus, c.name AS corpus_name, p.title, p.author,
              p.body, p.tags_json, p.sentence_count, p.character_count
              ${ranking}
       ${from}
       JOIN corpora c ON c.key = p.corpus
       WHERE ${condition}
       ORDER BY ${trimmedQuery ? "exact_rank, text_rank, p.character_count," : ""} p.rowid
       LIMIT ? OFFSET ?`,
    )
    .all(
      ...rankingParameters,
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

export function getFilteredCorpusStats(
  query: string,
  options: PoemSearchOptions & { corpus: string },
): CorpusStats | null {
  const trimmedQuery = query.trim();
  if (!hasAdditionalFilters(trimmedQuery, options)) return getCorpusStats(options.corpus);
  if (!getCorpus(options.corpus)) return null;
  const { from, condition, baseParameters } = selectPoems(trimmedQuery, options);
  const row = getDatabase().prepare(
    `SELECT COUNT(*) AS poem_count,
            COUNT(DISTINCT p.author_normalized) AS author_count,
            COALESCE(SUM(p.character_count), 0) AS character_count,
            COALESCE(SUM(p.sentence_count), 0) AS sentence_count,
            COALESCE(AVG(p.character_count), 0) AS average_characters
     ${from} WHERE ${condition}`,
  ).get(...baseParameters) as Omit<StatsRow, "corpus">;
  return mapStats({ ...row, corpus: options.corpus });
}

export function getFilteredCorpusInsights(
  query: string,
  options: PoemSearchOptions & { corpus: string },
): CorpusInsights | null {
  const trimmedQuery = query.trim();
  if (!hasAdditionalFilters(trimmedQuery, options)) {
    return getCorpusInsights(options.corpus);
  }
  const corpus = getCorpus(options.corpus);
  if (!corpus) return null;
  const selection = selectPoems(trimmedQuery, options);
  const database = getDatabase();
  const { from, condition, baseParameters } = selection;
  const rows = database.prepare(
    `SELECT p.author, p.author_normalized, p.body, p.sentence_count,
            p.character_count, p.line_type
     ${from} WHERE ${condition} ORDER BY p.rowid`,
  );
  const authors = new Map<string, number>();
  const normalizedAuthors = new Set<string>();
  const sentences = new Map<number, number>();
  const lines = new Map<string, number>();
  const characters = new Map<string, number>();
  const combinations = new Map<string, FormatCombinationDatum>();
  const bigramCandidates = new SpaceSaving(NGRAM_CANDIDATE_LIMIT);
  const trigramCandidates = new SpaceSaving(NGRAM_CANDIDATE_LIMIT);
  let poemCount = 0;
  let characterCount = 0;
  let sentenceCount = 0;

  for (const value of rows.iterate(...baseParameters)) {
    const row = value as {
      author: string;
      author_normalized: string;
      body: string;
      sentence_count: number;
      character_count: number;
      line_type: string;
    };
    poemCount += 1;
    characterCount += row.character_count;
    sentenceCount += row.sentence_count;
    normalizedAuthors.add(row.author_normalized);
    incrementCount(authors, row.author);
    incrementCount(sentences, row.sentence_count);
    incrementCount(lines, row.line_type);
    const combinationKey = `${row.sentence_count}:${row.line_type}`;
    const combination = combinations.get(combinationKey);
    if (combination) {
      combination.value += 1;
    } else {
      combinations.set(combinationKey, {
        sentenceCount: row.sentence_count,
        lineType: row.line_type,
        value: 1,
      });
    }
    for (const character of row.body) {
      if (isHanCharacter(character)) incrementCount(characters, character);
    }
    collectNgrams(row.body, bigramCandidates, trigramCandidates);
  }

  // Use the same bounded candidates and exact second pass as the data build.
  const bigrams = new Map([...bigramCandidates.tokens()].map((term) => [term, 0]));
  const trigrams = new Map([...trigramCandidates.tokens()].map((term) => [term, 0]));
  const bodies = database.prepare(`SELECT p.body ${from} WHERE ${condition}`);
  for (const value of bodies.iterate(...baseParameters)) {
    const { body } = value as { body: string };
    countCandidateNgrams(body, bigrams, trigrams);
  }

  return {
    corpus,
    stats: {
      corpus: corpus.key,
      poemCount,
      authorCount: normalizedAuthors.size,
      characterCount,
      sentenceCount,
      averageCharacters: poemCount ? characterCount / poemCount : 0,
    },
    authors: rankedCounts(authors, 20),
    sentenceCounts: [...sentences]
      .sort((left, right) => right[1] - left[1] || left[0] - right[0])
      .slice(0, 16)
      .sort((left, right) => left[0] - right[0])
      .map(([label, value]) => ({ label: String(label), value })),
    lineTypes: rankedCounts(lines, lines.size)
      .sort((left, right) => compareLineTypes(left.label, right.label)),
    characters: rankedCounts(characters, 100),
    bigrams: rankedCounts(bigrams, 100),
    trigrams: rankedCounts(trigrams, 100),
    formatCombinations: [...combinations.values()].sort(
      (left, right) => left.sentenceCount - right.sentenceCount ||
        compareLineTypes(left.lineType, right.lineType),
    ),
    structure: readCorpusStructure(database, corpus.key, selection),
  };
}

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
  ...parameters: Array<string | number>
): InsightDatum[] {
  return (database.prepare(query).all(...parameters) as DatumRow[]).map((row) => ({
    label: String(row.label),
    value: row.value,
  }));
}

function readCorpusStructure(
  database: Database,
  corpus: string,
  selection = selectPoems("", { corpus }),
): CorpusStructure | null {
  const { from, condition, baseParameters } = selection;
  if (corpus === "sc300" || corpus === "qsc") {
    return {
      kind: "tunes",
      data: readInsightRows(
        database,
        `SELECT tune AS label, COUNT(*) AS value
         FROM (
           SELECT CASE
             WHEN instr(p.title, '·') > 0
               THEN substr(p.title, 1, instr(p.title, '·') - 1)
             WHEN instr(p.title, '・') > 0
               THEN substr(p.title, 1, instr(p.title, '・') - 1)
             ELSE p.title
           END AS tune
           ${from}
           WHERE ${condition}
         )
         GROUP BY tune
         ORDER BY value DESC, tune
         LIMIT 20`,
        ...baseParameters,
      ),
    };
  }
  if (corpus === "shijing") {
    const data = database
      .prepare(
        `SELECT chapter, section, count
         FROM (
           SELECT p.chapter, p.section, COUNT(*) AS count, MIN(p.rowid) AS first_row
           ${from}
           WHERE ${condition} AND p.chapter IS NOT NULL AND p.section IS NOT NULL
           GROUP BY p.chapter, p.section
         )
         ORDER BY first_row`,
      )
      .all(...baseParameters) as Array<{
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

function hasAdditionalFilters(query: string, options: PoemSearchOptions): boolean {
  return Boolean(query || options.authors?.length || options.lineType || options.sentenceCount !== undefined);
}

function selectPoems(query: string, options: PoemSearchOptions) {
  if ([...query].length > 80) {
    throw new Error("搜索内容不能超过 80 个字符");
  }
  const where: string[] = [];
  const baseParameters: Array<string | number> = [];
  if (query) {
    where.push("poems_fts MATCH ?");
    baseParameters.push(toFtsQuery(query));
  }
  if (options.corpus) {
    where.push("p.corpus = ?");
    baseParameters.push(options.corpus);
  }
  if (options.authors?.length) {
    const authors = [...new Set(options.authors.map(normalizeSearchText))];
    where.push(`p.author_normalized IN (${authors.map(() => "?").join(", ")})`);
    baseParameters.push(...authors);
  }
  if (options.lineType) {
    where.push("p.line_type = ?");
    baseParameters.push(options.lineType);
  }
  if (options.sentenceCount !== undefined) {
    where.push("p.sentence_count = ?");
    baseParameters.push(options.sentenceCount);
  }
  return {
    from: `FROM poems p ${query ? "JOIN poems_fts ON poems_fts.rowid = p.rowid" : ""}`,
    condition: where.join(" AND "),
    baseParameters,
  };
}

function incrementCount<T>(counts: Map<T, number>, key: T) {
  counts.set(key, (counts.get(key) ?? 0) + 1);
}

function rankedCounts(counts: Map<string, number>, limit: number): InsightDatum[] {
  return [...counts].map(([label, value]) => ({ label, value }))
    .sort((left, right) => right.value - left.value ||
      (left.label < right.label ? -1 : left.label > right.label ? 1 : 0))
    .slice(0, limit);
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
    sentenceCount: row.sentence_count,
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
