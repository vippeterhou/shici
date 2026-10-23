import { describe, expect, it } from "vitest";
import { getCacheKeyForDynamicParam } from "next/dist/client/route-params";
import { createCacheKey } from "next/dist/client/components/segment-cache/cache-key";
import { addSearchParamsIfPageSegment } from "next/dist/shared/lib/segment";
import {
  filterHref,
  filterNavigationHref,
  parseSearchFilters,
  readSearchFilters,
  poemFilterOptions,
  validateSearchFilters,
} from "@/lib/search-filters";

describe("shared search and analysis filters", () => {
  it("defaults to ts300 and deduplicates repeated authors without losing selections", () => {
    expect(parseSearchFilters({}).corpus).toBe("ts300");
    const filters = parseSearchFilters({ q: " 明月 ", author: ["李白", "", "杜甫", "李白"], page: "2" });
    expect(filters.values.query).toBe("明月");
    expect(filters.values.authors).toEqual(["李白", "杜甫"]);
    expect(filters.page).toBe(2);
  });

  it("reads live URL criteria without dropping repeated author selections", () => {
    const parameters = new URLSearchParams([
      ["corpus", "qts"], ["q", "明月"], ["author", "李白"], ["author", "杜甫"],
      ["lineType", "5言"], ["sentenceCount", "8"], ["minSentences", "4"], ["maxSentences", "8"], ["page", "2"],
    ]);
    expect(readSearchFilters(parameters)).toEqual({
      corpus: "qts", page: 2,
      values: { query: "明月", authors: ["李白", "杜甫"], lineType: "5言", sentenceCount: "8" },
    });
  });

  it("keeps Next.js client and server page keys consistent for multiple authors", () => {
    const multiple = createCacheKey("https://example.com/?author=李白&author=杜甫", null);
    const single = createCacheKey("https://example.com/?author=杜甫", null);
    const multipleKey = getCacheKeyForDynamicParam("__PAGE__", multiple.search);
    expect(multipleKey).toBe(addSearchParamsIfPageSegment("__PAGE__", { author: ["李白", "杜甫"] }));
    expect(multipleKey).not.toBe(getCacheKeyForDynamicParam("__PAGE__", single.search));
  });

  it("round-trips every applied condition across both views, excluding pagination", () => {
    const source = new URLSearchParams([
      ["corpus", "qts"], ["q", "明月"], ["author", "李白"], ["author", "杜甫"],
      ["lineType", "5言"], ["sentenceCount", "8"], ["minSentences", "4"], ["maxSentences", "8"],
      ["page", "5"], ["unrelated", "ignored"],
    ]);
    const analysis = new URL(filterNavigationHref("/insights", "/corpora", source), "https://example.com");
    expect(analysis.pathname).toBe("/insights");
    expect(analysis.searchParams.getAll("author")).toEqual(["李白", "杜甫"]);
    expect(analysis.searchParams.get("sentenceCount")).toBe("8");
    expect(analysis.searchParams.has("page")).toBe(false);
    expect(analysis.searchParams.has("unrelated")).toBe(false);
    expect(analysis.searchParams.has("minSentences")).toBe(false);
    expect(analysis.searchParams.has("maxSentences")).toBe(false);
    const listing = new URL(filterNavigationHref("/corpora", "/insights", analysis.searchParams), analysis);
    expect(listing.pathname).toBe("/corpora");
    expect([...listing.searchParams]).toEqual([...analysis.searchParams]);
    const filters = parseSearchFilters(Object.fromEntries(
      [...new Set(listing.searchParams.keys())].map((key) => [key, listing.searchParams.getAll(key)]),
    ));
    expect(poemFilterOptions(filters.corpus, filters.values)).toEqual({
      corpus: "qts", authors: ["李白", "杜甫"], lineType: "5言", sentenceCount: 8,
    });
    expect(new URL(filterHref("/corpora", filters.corpus, filters.values, 3), listing).searchParams.get("page")).toBe("3");
    expect(new URL(filterHref("/insights", filters.corpus, filters.values, 3), listing).searchParams.has("page")).toBe(false);
  });

  it.each(["/corpora/qts", "/insights/qts", "/poems/qts/123"])("recognizes the corpus of nested route %s", (pathname) => {
    const href = filterNavigationHref("/insights", pathname, new URLSearchParams());
    expect(href).toBe("/insights?corpus=qts");
  });

  it.each([
    { parameters: { q: "月".repeat(81) }, message: "关键词不能超过 80 个字符。" },
    { parameters: { q: "!!!" }, message: "请输入包含文字或数字的关键词。" },
    { parameters: { lineType: "7言" }, message: "请选择当前文库支持的每句字数。" },
    { parameters: { sentenceCount: "0" }, message: "请选择当前文库支持的句数。" },
    { parameters: { sentenceCount: "-1" }, message: "请选择当前文库支持的句数。" },
    { parameters: { sentenceCount: "4.5" }, message: "请选择当前文库支持的句数。" },
    { parameters: { sentenceCount: "6" }, message: "请选择当前文库支持的句数。" },
  ])("validates consistently before either query: $parameters", ({ parameters, message }) => {
    expect(validateSearchFilters(parseSearchFilters(parameters).values, ["5言"], ["4", "8"])).toBe(message);
  });

  it("accepts blank criteria and ignores removed sentence-range parameters", () => {
    expect(validateSearchFilters(parseSearchFilters({}).values, ["5言"], ["4", "8"])).toBeUndefined();
    const { values } = parseSearchFilters({ minSentences: "9", maxSentences: "4", lineType: "5言" });
    expect(values).toEqual({ query: "", authors: [], lineType: "5言", sentenceCount: "" });
    expect(validateSearchFilters(values, ["5言"], ["4", "8"])).toBeUndefined();
    expect(poemFilterOptions("ts300", values)).toEqual({
      corpus: "ts300", authors: [], lineType: "5言",
    });

  });

  it("accepts available exact sentence counts and allows clearing the selection", () => {
    const { values } = parseSearchFilters({ sentenceCount: "4" });
    expect(validateSearchFilters(values, ["5言"], ["4", "8"])).toBeUndefined();
    expect(poemFilterOptions("ts300", values).sentenceCount).toBe(4);
    expect(filterHref("/corpora", "ts300", values)).toBe("/corpora?corpus=ts300&sentenceCount=4");
    expect(filterHref("/corpora", "ts300", { ...values, sentenceCount: "" })).toBe("/corpora?corpus=ts300");
  });
});
