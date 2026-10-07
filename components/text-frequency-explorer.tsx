"use client";

import { useState } from "react";
import { InsightChart } from "@/components/insight-chart";
import type { InsightDatum } from "@/lib/types";

const frequencyTypes = [
  {
    key: "characters",
    label: "单字",
    heading: "正文高频字",
    description: "统计正文中的汉字，不计标点与空白。",
  },
  {
    key: "bigrams",
    label: "二字组合",
    heading: "正文常见二字组合",
    description: "只连接正文中连续的汉字，不跨越标点或段落。",
  },
  {
    key: "trigrams",
    label: "三字组合",
    heading: "正文常见三字组合",
    description: "只连接正文中连续的汉字，不跨越标点或段落。",
  },
] as const;

type FrequencyKey = (typeof frequencyTypes)[number]["key"];
type DisplayLimit = 20 | 50 | 100;

export function TextFrequencyExplorer({
  characters,
  bigrams,
  trigrams,
}: {
  characters: InsightDatum[];
  bigrams: InsightDatum[];
  trigrams: InsightDatum[];
}) {
  const [activeType, setActiveType] = useState<FrequencyKey>("characters");
  const [displayLimit, setDisplayLimit] = useState<DisplayLimit>(20);
  const active = frequencyTypes.find((item) => item.key === activeType)!;
  const data = { characters, bigrams, trigrams }[activeType].slice(
    0,
    displayLimit,
  );
  const expanded = displayLimit > 20;
  const chartHeight = Math.max(352, Math.round(data.length * 17.2 + 8));

  return (
    <div>
      <div className="frequency-controls">
        <div className="segmented-control" role="group" aria-label="频率统计单位">
          {frequencyTypes.map((type) => (
            <button
              className={type.key === activeType ? "active" : undefined}
              type="button"
              aria-pressed={type.key === activeType}
              onClick={() => setActiveType(type.key)}
              key={type.key}
            >
              {type.label}
            </button>
          ))}
        </div>
        <label className="frequency-limit">
          <span>显示范围</span>
          <select
            value={displayLimit}
            onChange={(event) =>
              setDisplayLimit(Number(event.target.value) as DisplayLimit)
            }
          >
            <option value={20}>前 20 项</option>
            <option value={50}>前 50 项</option>
            <option value={100}>前 100 项</option>
          </select>
        </label>
      </div>
      <div className="frequency-heading">
        <h3>{active.heading}</h3>
        <p>{active.description}</p>
      </div>
      <div
        className={expanded ? "frequency-chart-viewport" : undefined}
        key={`${activeType}-${displayLimit}`}
      >
        <InsightChart
          data={data}
          horizontal
          height={chartHeight}
        />
      </div>
    </div>
  );
}
