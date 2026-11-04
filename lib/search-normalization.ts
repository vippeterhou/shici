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
  const match = searchTerms(query)
    .map((term) => ({
      index: normalizedText.indexOf(term),
      length: term.length,
    }))
    .filter(({ index }) => index >= 0)
    .sort((left, right) => left.index - right.index)[0];
  return match
    ? mapNormalizedRangeToSource(text, normalizedText, match)
    : null;
}

export function findSearchMatches(
  text: string,
  query: string,
): Array<{ index: number; length: number }> {
  const normalizedText = normalizeSearchText(text);
  const normalizedMatches: Array<{ index: number; length: number }> = [];
  for (const term of searchTerms(query)) {
    let index = normalizedText.indexOf(term);
    while (index >= 0) {
      normalizedMatches.push({ index, length: term.length });
      index = normalizedText.indexOf(term, index + term.length);
    }
  }
  const matches = normalizedMatches
    .map((match) => mapNormalizedRangeToSource(text, normalizedText, match))
    .sort((left, right) => left.index - right.index || right.length - left.length);
  const merged: Array<{ index: number; length: number }> = [];
  for (const match of matches) {
    const previous = merged.at(-1);
    if (previous && match.index < previous.index + previous.length) {
      previous.length =
        Math.max(previous.index + previous.length, match.index + match.length) -
        previous.index;
    } else {
      merged.push({ ...match });
    }
  }
  return merged;
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

function searchTerms(query: string): string[] {
  return [...new Set(
    normalizeSearchText(query)
      .split(/\s+/u)
      .filter(Boolean),
  )];
}

function mapNormalizedRangeToSource(
  source: string,
  normalized: string,
  range: { index: number; length: number },
): { index: number; length: number } {
  const sourceCharacters = Array.from(source);
  const normalizedCharacters = Array.from(normalized);
  const normalizedStart = Array.from(normalized.slice(0, range.index)).length;
  const normalizedEnd = Array.from(
    normalized.slice(0, range.index + range.length),
  ).length;

  if (sourceCharacters.length === normalizedCharacters.length) {
    const index = sourceCharacters.slice(0, normalizedStart).join("").length;
    const end = sourceCharacters.slice(0, normalizedEnd).join("").length;
    return { index, length: end - index };
  }

  const sourceBoundaries = [0];
  let sourceIndex = 0;
  for (const character of sourceCharacters) {
    sourceIndex += character.length;
    sourceBoundaries.push(sourceIndex);
  }
  const normalizedBoundaries = sourceBoundaries.map((boundary) =>
    normalizeSearchText(source.slice(0, boundary)).length
  );
  const index = boundaryAtOrBefore(
    sourceBoundaries,
    normalizedBoundaries,
    range.index,
  );
  const end = boundaryAtOrAfter(
    sourceBoundaries,
    normalizedBoundaries,
    range.index + range.length,
  );
  return { index, length: end - index };
}

function boundaryAtOrBefore(
  sourceBoundaries: number[],
  normalizedBoundaries: number[],
  target: number,
): number {
  let result = sourceBoundaries[0];
  for (let index = 1; index < normalizedBoundaries.length; index += 1) {
    if (normalizedBoundaries[index] > target) {
      break;
    }
    result = sourceBoundaries[index];
  }
  return result;
}

function boundaryAtOrAfter(
  sourceBoundaries: number[],
  normalizedBoundaries: number[],
  target: number,
): number {
  for (let index = 0; index < normalizedBoundaries.length; index += 1) {
    if (normalizedBoundaries[index] >= target) {
      return sourceBoundaries[index];
    }
  }
  return sourceBoundaries[sourceBoundaries.length - 1];
}
