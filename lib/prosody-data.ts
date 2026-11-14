import "server-only";

import {
  getGuangyunDatabase,
  getPingshuiyunDatabase,
} from "@/lib/db";
import {
  formatPingshuiRhyme,
  supportsProsody,
  type CharacterReading,
  type ProsodyBook,
  type PoemProsody,
} from "@/lib/prosody";
import { getPoemDisplayLines } from "@/lib/poem-lines";
import type { Poem } from "@/lib/types";
import { isHanCharacter } from "@/scripts/ngrams.mjs";

interface ReadingRow extends CharacterReading {
  inputCharacter: string;
}

interface PingshuiReadingRow {
  inputCharacter: string;
  headword: string;
  tone: CharacterReading["tone"];
  rhyme: string;
  ordinal: number;
  section: string;
  isSupplement: number;
  supplementKind: string;
}

export function getPoemProsody(
  poem: Poem,
  displayLines: string[] | null = getPoemDisplayLines(poem),
): PoemProsody | null {
  if (!supportsProsody(poem)) {
    return null;
  }
  if (!displayLines) {
    throw new Error(`Poem structure does not match prosody lines: ${poem.id}`);
  }
  const characters = [
    ...new Set(displayLines.flatMap((line) => [...line].filter(isHanCharacter))),
  ];
  const books = [
    readGuangyunBook(characters, displayLines),
    readPingshuiyunBook(characters, displayLines),
  ].filter((book): book is ProsodyBook => book !== null);
  if (!books.length) {
    return {
      status: "unavailable",
      message: "当前数据版本未包含可用的韵书数据。",
    };
  }
  return { status: "ready", books };
}

function readGuangyunBook(
  characters: string[],
  lines: string[],
): ProsodyBook | null {
  const database = getGuangyunDatabase();
  if (!database) {
    return null;
  }
  const rows = database.prepare<string[], ReadingRow>(`
    WITH requested(character) AS (VALUES ${characters.map(() => "(?)").join(",")}),
    matches AS (
    SELECT requested.character AS inputCharacter,
           r.character AS headword, r.tone, r.rhyme,
           r.rhyme || '韵' AS compactRhyme,
           r.rhyme || '韵' AS displayRhyme
    FROM requested
    JOIN character_readings r ON r.character = requested.character
    UNION
    SELECT requested.character AS inputCharacter,
           r.character AS headword, r.tone, r.rhyme,
           r.rhyme || '韵' AS compactRhyme,
           r.rhyme || '韵' AS displayRhyme
    FROM requested
    JOIN character_aliases a ON a.input_character = requested.character
    JOIN character_readings r ON r.character = a.target_character
    )
    SELECT * FROM matches
    ORDER BY inputCharacter, headword,
             CASE tone WHEN '平' THEN 0 WHEN '上' THEN 1 WHEN '去' THEN 2 ELSE 3 END,
             rhyme
  `).all(...characters);
  return {
    key: "guangyun",
    label: "广韵",
    lines: mapReadingLines(lines, rows),
  };
}

function readPingshuiyunBook(
  characters: string[],
  lines: string[],
): ProsodyBook | null {
  const database = getPingshuiyunDatabase();
  if (!database) {
    return null;
  }
  const rows = database.prepare<string[], PingshuiReadingRow>(`
    WITH requested(character) AS (VALUES ${characters.map(() => "(?)").join(",")})
    SELECT lookup.character AS inputCharacter,
           lookup.canonical_character AS headword,
           lookup.tone, lookup.rhyme, lookup.ordinal, lookup.section,
           lookup.is_supplement AS isSupplement,
           lookup.supplement_kind AS supplementKind
    FROM requested
    JOIN character_lookup lookup ON lookup.character = requested.character
    ORDER BY inputCharacter,
             CASE tone WHEN '平' THEN 0 WHEN '上' THEN 1 WHEN '去' THEN 2 ELSE 3 END,
             section, ordinal, rhyme, headword, isSupplement
  `).all(...characters);
  const readings: ReadingRow[] = rows.map((row) => ({
    inputCharacter: row.inputCharacter,
    headword: row.headword,
    tone: row.tone,
    rhyme: row.rhyme,
    compactRhyme: `${row.rhyme}韵`,
    displayRhyme: formatPingshuiRhyme(row.section, row.ordinal, row.rhyme),
    supplementKind: row.isSupplement ? row.supplementKind : undefined,
  }));
  return {
    key: "pingshuiyun",
    label: "平水韵",
    lines: mapReadingLines(lines, readings),
  };
}

function mapReadingLines(
  lines: string[],
  rows: ReadingRow[],
) {
  const byCharacter = new Map<string, CharacterReading[]>();
  for (const { inputCharacter, ...reading } of rows) {
    const values = byCharacter.get(inputCharacter) ?? [];
    if (!values.some((value) =>
      value.headword === reading.headword &&
      value.tone === reading.tone &&
      value.compactRhyme === reading.compactRhyme &&
      value.displayRhyme === reading.displayRhyme &&
      value.supplementKind === reading.supplementKind
    )) {
      values.push(reading);
    }
    byCharacter.set(inputCharacter, values);
  }
  return lines.map((text) => ({
    text,
    tokens: [...text].map((character) => ({
      character,
      readings: isHanCharacter(character) ? byCharacter.get(character) ?? [] : null,
    })),
  }));
}

