"use client";

import type { CSSProperties } from "react";
import { useMemo, useState } from "react";
import {
  compareLineTypes,
  displayLineType,
  prepareFormatHeatmap,
} from "@/lib/format-combinations";
import type { FormatCombinationDatum } from "@/lib/types";

type HeatStyle = CSSProperties & { "--heat-level": number };

export function FormatHeatmap({
  data,
}: {
  data: FormatCombinationDatum[];
}) {
  const [groupLargeCounts, setGroupLargeCounts] = useState(true);
  const [useLogScale, setUseLogScale] = useState(false);
  const heatmap = useMemo(
    () => prepareFormatHeatmap(data, groupLargeCounts),
    [data, groupLargeCounts],
  );
  const sentenceLabels = useMemo(
    () =>
      [...new Map(
        heatmap.map((item) => [
          item.sentenceLabel,
          item.sentenceOrder,
        ]),
      ).entries()]
        .sort((left, right) => left[1] - right[1])
        .map(([label]) => label),
    [heatmap],
  );
  const lineTypes = useMemo(
    () =>
      [...new Set(heatmap.map((item) => item.lineType))].sort(
        compareLineTypes,
      ),
    [heatmap],
  );
  const counts = useMemo(
    () =>
      new Map(
        heatmap.map((item) => [
          `${item.sentenceLabel}\u0000${item.lineType}`,
          item.value,
        ]),
      ),
    [heatmap],
  );
  const maximum = Math.max(...heatmap.map((item) => item.value), 1);

  function intensity(value: number): number {
    if (!value) {
      return 0;
    }
    const ratio = useLogScale
      ? Math.log1p(value) / Math.log1p(maximum)
      : value / maximum;
    return Math.max(0.08, ratio);
  }

  return (
    <div>
      <div className="heatmap-controls">
        <label>
          <input
            type="checkbox"
            checked={groupLargeCounts}
            onChange={(event) => setGroupLargeCounts(event.target.checked)}
          />
          合并 33 句以上
        </label>
        <label>
          <input
            type="checkbox"
            checked={useLogScale}
            onChange={(event) => setUseLogScale(event.target.checked)}
          />
          对数颜色
        </label>
      </div>
      <div
        className="format-heatmap-scroll"
        tabIndex={0}
        role="region"
        aria-label="字句组合分布表，可横向滚动"
      >
        <table className="format-heatmap">
          <thead>
            <tr>
              <th scope="col">每句字数</th>
              {sentenceLabels.map((label) => (
                <th scope="col" key={label}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lineTypes.map((lineType) => (
              <tr key={lineType}>
                <th scope="row">{displayLineType(lineType)}</th>
                {sentenceLabels.map((sentenceLabel) => {
                  const value =
                    counts.get(`${sentenceLabel}\u0000${lineType}`) ?? 0;
                  const level = intensity(value);
                  return (
                    <td
                      className={
                        level > 0.55
                          ? "heatmap-cell heatmap-cell-strong"
                          : "heatmap-cell"
                      }
                      key={sentenceLabel}
                      style={{ "--heat-level": level } as HeatStyle}
                      title={`${sentenceLabel} 句 · ${displayLineType(lineType)} · ${value.toLocaleString("zh-CN")} 首`}
                      aria-label={`${sentenceLabel} 句，${displayLineType(lineType)}，${value.toLocaleString("zh-CN")} 首`}
                    >
                      {value ? value.toLocaleString("zh-CN") : ""}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="heatmap-legend" aria-hidden>
        <span>少</span>
        <span className="heatmap-gradient" />
        <span>多</span>
      </div>
    </div>
  );
}
