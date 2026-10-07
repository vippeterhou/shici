import { describe, expect, it } from "vitest";
import {
  collectNgrams,
  countCandidateNgrams,
  SpaceSaving,
} from "./ngrams.mjs";

describe("n-gram collection", () => {
  it("does not connect characters across punctuation or paragraphs", () => {
    const bigrams = new SpaceSaving(20);
    const trigrams = new SpaceSaving(20);

    collectNgrams("春風，秋月\n江山", bigrams, trigrams);

    expect([...bigrams.tokens()].sort()).toEqual(["春風", "江山", "秋月"]);
    expect([...trigrams.tokens()]).toEqual([]);
  });

  it("generates overlapping bigrams and trigrams", () => {
    const bigrams = new SpaceSaving(20);
    const trigrams = new SpaceSaving(20);

    collectNgrams("春風又綠", bigrams, trigrams);

    expect([...bigrams.tokens()].sort()).toEqual(["又綠", "春風", "風又"]);
    expect([...trigrams.tokens()].sort()).toEqual(["春風又", "風又綠"]);
  });

  it("counts retained candidates exactly", () => {
    const bigrams = new Map([
      ["春風", 0],
      ["明月", 0],
    ]);
    const trigrams = new Map([
      ["春風又", 0],
      ["明月照", 0],
    ]);

    countCandidateNgrams("春風又綠，春風。明月照我", bigrams, trigrams);

    expect([...bigrams]).toEqual([
      ["春風", 2],
      ["明月", 1],
    ]);
    expect([...trigrams]).toEqual([
      ["春風又", 1],
      ["明月照", 1],
    ]);
  });
});
