import type { FormatCombinationDatum } from "@/lib/types";

const SENTENCE_RANGES = [
  { lower: 33, upper: 40, label: "33–40" },
  { lower: 41, upper: 50, label: "41–50" },
  { lower: 51, upper: 100, label: "51–100" },
  { lower: 101, upper: Number.POSITIVE_INFINITY, label: "101+" },
] as const;

export interface HeatmapDatum {
  sentenceLabel: string;
  sentenceOrder: number;
  lineType: string;
  value: number;
}

export function prepareFormatHeatmap(
  data: FormatCombinationDatum[],
  groupLargeSentenceCounts: boolean,
): HeatmapDatum[] {
  const counts = new Map<string, HeatmapDatum>();
  for (const datum of data) {
    const bucket =
      groupLargeSentenceCounts && datum.sentenceCount > 32
        ? sentenceBucket(datum.sentenceCount)
        : {
            label: String(datum.sentenceCount),
            order: datum.sentenceCount,
          };
    const key = `${bucket.label}\u0000${datum.lineType}`;
    const existing = counts.get(key);
    counts.set(key, {
      sentenceLabel: bucket.label,
      sentenceOrder: bucket.order,
      lineType: datum.lineType,
      value: (existing?.value ?? 0) + datum.value,
    });
  }
  return [...counts.values()].sort(
    (left, right) =>
      left.sentenceOrder - right.sentenceOrder ||
      compareLineTypes(left.lineType, right.lineType),
  );
}

export function compareLineTypes(left: string, right: string): number {
  if (left === "杂言") {
    return right === "杂言" ? 0 : 1;
  }
  if (right === "杂言") {
    return -1;
  }
  return Number.parseInt(left, 10) - Number.parseInt(right, 10);
}

export function displayLineType(value: string): string {
  if (value === "杂言") {
    return value;
  }
  const length = Number.parseInt(value, 10);
  return `${chineseNumber(length)}言`;
}

function sentenceBucket(sentenceCount: number): {
  label: string;
  order: number;
} {
  const range = SENTENCE_RANGES.find(
    ({ lower, upper }) =>
      sentenceCount >= lower && sentenceCount <= upper,
  );
  if (!range) {
    throw new Error(`Unsupported sentence count: ${sentenceCount}`);
  }
  return { label: range.label, order: range.lower };
}

function chineseNumber(value: number): string {
  const digits = "零一二三四五六七八九";
  if (value < 10) {
    return digits[value];
  }
  if (value < 20) {
    return value === 10 ? "十" : `十${digits[value % 10]}`;
  }
  if (value < 100) {
    const ones = value % 10 ? digits[value % 10] : "";
    return `${digits[Math.floor(value / 10)]}十${ones}`;
  }
  return String(value);
}
