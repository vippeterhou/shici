import type { Poem } from "@/lib/types";
import { isHanCharacter } from "@/scripts/ngrams.mjs";

export type HistoricalTone = "平" | "上" | "去" | "入";
export type RhymeBookKey = "guangyun" | "pingshuiyun";

export interface CharacterReading {
  headword: string;
  tone: HistoricalTone;
  rhyme: string;
  compactRhyme: string;
  displayRhyme: string;
  supplementKind?: string;
}

export interface ProsodyToken {
  character: string;
  readings: CharacterReading[] | null;
}

export interface ProsodyLine {
  text: string;
  tokens: ProsodyToken[];
}

export interface ProsodyBook {
  key: RhymeBookKey;
  label: string;
  lines: ProsodyLine[];
}

export type PoemProsody =
  | {
      status: "ready";
      books: ProsodyBook[];
    }
  | { status: "unavailable"; message: string };

export function supportsProsody(
  poem: Pick<Poem, "corpus" | "uniformSentenceLength" | "sentenceCount">,
): boolean {
  return (poem.corpus === "ts300" || poem.corpus === "qts" || poem.corpus === "qss") &&
    (poem.uniformSentenceLength === 5 || poem.uniformSentenceLength === 7) &&
    (poem.sentenceCount === 4 || poem.sentenceCount === 8);
}

export function splitProsodyLines(paragraphs: string[]): string[] {
  return paragraphs.flatMap((paragraph) =>
    (paragraph.match(/[^，。！？!?；：:;\n]+[，。！？!?；：:;]*/gu) ?? [])
      .map((line) => line.trim())
      .filter((line) => [...line].some(isHanCharacter)),
  );
}

export function toneLabel(readings: CharacterReading[]): "平" | "仄" | "平/仄" | "?" {
  if (!readings.length) {
    return "?";
  }
  const level = readings.some((reading) => reading.tone === "平");
  const oblique = readings.some((reading) => reading.tone !== "平");
  return level && oblique ? "平/仄" : level ? "平" : "仄";
}

export function rhymeLabels(readings: CharacterReading[]): string[] {
  if (!readings.length) {
    return ["归韵未匹配"];
  }
  return [...new Set(readings.map((reading) => reading.compactRhyme))];
}

export function formatPingshuiRhyme(
  section: string,
  ordinal: number,
  rhyme: string,
): string {
  return `${section.replace("聲", "")}${formatChineseOrdinal(ordinal)}${rhyme}`;
}

function formatChineseOrdinal(value: number): string {
  const digits = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九"];
  if (value <= 10) {
    return value === 10 ? "十" : digits[value];
  }
  const tens = Math.floor(value / 10);
  const units = value % 10;
  return `${tens === 1 ? "" : digits[tens]}十${units ? digits[units] : ""}`;
}
