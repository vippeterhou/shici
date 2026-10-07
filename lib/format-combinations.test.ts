import { describe, expect, it } from "vitest";
import {
  displayLineType,
  prepareFormatHeatmap,
} from "@/lib/format-combinations";

describe("format combination heatmap", () => {
  const data = [
    { sentenceCount: 4, lineType: "5言", value: 12 },
    { sentenceCount: 36, lineType: "5言", value: 3 },
    { sentenceCount: 38, lineType: "5言", value: 4 },
    { sentenceCount: 52, lineType: "杂言", value: 2 },
  ];

  it("keeps exact sentence counts when grouping is disabled", () => {
    expect(prepareFormatHeatmap(data, false).map((item) => item.sentenceLabel))
      .toEqual(["4", "36", "38", "52"]);
  });

  it("combines sentence counts above 32 into readable ranges", () => {
    expect(prepareFormatHeatmap(data, true)).toEqual([
      {
        sentenceLabel: "4",
        sentenceOrder: 4,
        lineType: "5言",
        value: 12,
      },
      {
        sentenceLabel: "33–40",
        sentenceOrder: 33,
        lineType: "5言",
        value: 7,
      },
      {
        sentenceLabel: "51–100",
        sentenceOrder: 51,
        lineType: "杂言",
        value: 2,
      },
    ]);
  });

  it("formats numeric line lengths in Chinese", () => {
    expect(displayLineType("5言")).toBe("五言");
    expect(displayLineType("杂言")).toBe("杂言");
  });
});
