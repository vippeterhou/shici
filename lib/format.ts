const numberFormatter = new Intl.NumberFormat("zh-CN");

export function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

export function poemHref(corpus: string, id: string): string {
  return `/poems/${encodeURIComponent(corpus)}/${encodeURIComponent(id)}`;
}

export function decodeRouteSegment(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function corpusHref(corpus: string): string {
  return `/corpora/${encodeURIComponent(corpus)}`;
}

export function compactExcerpt(value: string, length = 88): string {
  const compact = value.replace(/\s+/gu, " ").trim();
  return compact.length > length
    ? `${compact.slice(0, length).trimEnd()}…`
    : compact;
}
