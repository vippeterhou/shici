import type { Poem } from "@/lib/types";
import { isHanCharacter } from "@/scripts/ngrams.mjs";

export function splitPoemLines(paragraphs: string[]): string[] {
  return paragraphs.flatMap((paragraph) =>
    (paragraph.match(/[^，。！？!?；：:;\n]+[，。！？!?；：:;]*/gu) ?? [])
      .map((line) => line.trim())
      .filter((line) => [...line].some(isHanCharacter)),
  );
}

export function getPoemDisplayLines(
  poem: Pick<Poem, "paragraphs" | "sentenceCount" | "uniformSentenceLength">,
): string[] | null {
  if (poem.uniformSentenceLength === null) {
    return null;
  }
  const lines = splitPoemLines(poem.paragraphs);
  if (
    lines.length !== poem.sentenceCount ||
    lines.some((line) =>
      [...line].filter(isHanCharacter).length !== poem.uniformSentenceLength
    )
  ) {
    return null;
  }
  return lines;
}
