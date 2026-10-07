import OpenCC from "opencc-js";

const toSimplified = OpenCC.Converter({ from: "hk", to: "cn" });

export function normalizeSearchText(value: string): string {
  return toSimplified(value.normalize("NFKC")).toLocaleLowerCase("zh-CN");
}

export function tokenizeSearchText(value: string): string {
  const tokens: string[] = [];
  for (const chunk of normalizeSearchText(value).match(/[\p{L}\p{N}]+/gu) ?? []) {
    if (/\p{Script=Han}/u.test(chunk)) {
      tokens.push(...chunk);
    } else {
      tokens.push(chunk);
    }
  }
  return tokens.join(" ");
}

export function findFirstSearchMatch(
  text: string,
  query: string,
): { index: number; length: number } | null {
  const normalizedText = normalizeSearchText(text);
  const matches = normalizeSearchText(query)
    .split(/\s+/u)
    .filter(Boolean)
    .map((term) => ({
      index: normalizedText.indexOf(term),
      length: term.length,
    }))
    .filter(({ index }) => index >= 0)
    .sort((left, right) => left.index - right.index);
  return matches[0] ?? null;
}

export function toFtsQuery(value: string): string {
  const normalized = normalizeSearchText(value).trim();
  const phrases = normalized
    .split(/\s+/u)
    .filter(Boolean)
    .map((term) => tokenizeSearchText(term))
    .filter(Boolean)
    .map((tokens) => `"${tokens.replaceAll('"', '""')}"`);
  if (!phrases.length) {
    throw new Error("请输入搜索内容");
  }
  return phrases.join(" AND ");
}
