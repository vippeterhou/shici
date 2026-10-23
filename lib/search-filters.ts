import { tokenizeSearchText } from "@/lib/search-normalization";
import type { PoemSearchOptions } from "@/lib/types";

export type FilterParameters = Record<string, string | string[] | undefined>;
export type FilterPage = "/corpora" | "/insights";

export interface AdvancedSearchValues {
  query: string;
  authors: string[];
  lineType: string;
  sentenceCount: string;
}

function first(value: FilterParameters[string]): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

export function parseSearchFilters(parameters: FilterParameters) {
  return {
    corpus: first(parameters.corpus) || "ts300",
    page: Number.parseInt(first(parameters.page) || "1", 10),
    values: {
      query: first(parameters.q).trim(),
      authors: [...new Set(
        (Array.isArray(parameters.author) ? parameters.author : [parameters.author])
          .filter((author): author is string => Boolean(author?.trim())),
      )],
      lineType: first(parameters.lineType),
      sentenceCount: first(parameters.sentenceCount),
    },
  };
}

export function readSearchFilters(parameters: Pick<URLSearchParams, "getAll">) {
  const keys = ["corpus", "q", "author", "lineType", "sentenceCount", "page"];
  return parseSearchFilters(Object.fromEntries(keys.map((key) => [key, parameters.getAll(key)])));
}

export function validateSearchFilters(
  values: AdvancedSearchValues,
  lineTypes: string[],
  sentenceCounts: string[],
): string | undefined {
  if ([...values.query].length > 80) return "关键词不能超过 80 个字符。";
  if (values.query && !tokenizeSearchText(values.query)) return "请输入包含文字或数字的关键词。";
  if (values.lineType && !lineTypes.includes(values.lineType)) {
    return "请选择当前文库支持的每句字数。";
  }
  if (values.sentenceCount && !sentenceCounts.includes(values.sentenceCount)) {
    return "请选择当前文库支持的句数。";
  }
}

export function poemFilterOptions(
  corpus: string,
  values: AdvancedSearchValues,
): PoemSearchOptions & { corpus: string } {
  return {
    corpus,
    authors: values.authors,
    lineType: values.lineType || undefined,
    sentenceCount: values.sentenceCount ? Number(values.sentenceCount) : undefined,
  };
}

export function filterHref(
  path: FilterPage,
  corpus: string,
  values: AdvancedSearchValues,
  page = 1,
): string {
  const query = new URLSearchParams({ corpus });
  if (values.query) query.set("q", values.query);
  for (const author of values.authors) query.append("author", author);
  if (values.lineType) query.set("lineType", values.lineType);
  if (values.sentenceCount) query.set("sentenceCount", values.sentenceCount);
  if (path === "/corpora" && page > 1) query.set("page", String(page));
  return `${path}?${query.toString()}`;
}

export function filterNavigationHref(
  path: FilterPage,
  pathname: string,
  parameters: Pick<URLSearchParams, "getAll">,
): string {
  const keys = ["corpus", "q", "author", "lineType", "sentenceCount"];
  const query = Object.fromEntries(keys.map((key) => [key, parameters.getAll(key)]));
  if (!query.corpus.length) {
    const corpus = /^\/(?:corpora|insights|poems)\/([^/]+)/.exec(pathname)?.[1];
    if (corpus) query.corpus = [corpus];
  }
  const filters = parseSearchFilters(query);
  return filterHref(path, filters.corpus, filters.values);
}
