import { describe, expect, it } from "vitest";
import {
  findFirstSearchMatch,
  findSearchMatches,
  normalizeSearchText,
  toFtsQuery,
  tokenizeSearchText,
} from "@/lib/search-normalization";

describe("search normalization", () => {
  it("normalizes traditional and simplified text equally", () => {
    expect(normalizeSearchText("黃河入海")).toBe(
      normalizeSearchText("黄河入海"),
    );
  });

  it("tokenizes Chinese text by character for short phrase search", () => {
    expect(tokenizeSearchText("明月")).toBe("明 月");
  });

  it("requires all space-separated phrases", () => {
    expect(toFtsQuery("李白 明月")).toBe('"李 白" AND "明 月"');
  });

  it("finds the earliest normalized query term", () => {
    expect(findFirstSearchMatch("黃河遠上白雲間", "白云 黄河")).toEqual({
      index: 0,
      length: 2,
    });
  });

  it("maps supplementary simplified characters back to the original text", () => {
    expect(findFirstSearchMatch("为絺为绤，服之无斁", "服之")).toEqual({
      index: 5,
      length: 2,
    });
    expect(findFirstSearchMatch("絺兮绤兮", "𫄨")).toEqual({
      index: 0,
      length: 1,
    });
  });

  it("finds and merges all visible query matches", () => {
    expect(findSearchMatches("明月照明月", "明 明月")).toEqual([
      { index: 0, length: 2 },
      { index: 3, length: 2 },
    ]);
  });
});
