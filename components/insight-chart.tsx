"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { InsightDatum } from "@/lib/types";

export function InsightChart({
  data,
  horizontal = false,
  height,
}: {
  data: InsightDatum[];
  horizontal?: boolean;
  height?: number;
}) {
  if (horizontal) {
    return (
      <div className="chart-shell" style={height ? { height } : undefined}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 4, right: 12, bottom: 4, left: 16 }}
          >
            <CartesianGrid stroke="var(--cp-border)" horizontal={false} />
            <XAxis
              type="number"
              tick={{ fill: "var(--cp-text-muted)", fontSize: 11 }}
              axisLine={{ stroke: "var(--cp-border)" }}
              tickLine={false}
            />
            <YAxis
              dataKey="label"
              type="category"
              interval={0}
              width={74}
              tick={{ fill: "var(--cp-text-muted)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                background: "var(--cp-surface)",
                border: "1px solid var(--cp-border)",
                borderRadius: "0.625rem",
                color: "var(--cp-text)",
              }}
              cursor={{ fill: "var(--cp-accent-soft)" }}
              formatter={(value) => [Number(value).toLocaleString("zh-CN"), "数量"]}
            />
            <Bar
              dataKey="value"
              fill="var(--cp-accent)"
              radius={[0, 4, 4, 0]}
              barSize={12}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return (
    <div className="chart-shell">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 8, bottom: 8, left: 0 }}>
          <CartesianGrid stroke="var(--cp-border)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: "var(--cp-text-muted)", fontSize: 11 }}
            axisLine={{ stroke: "var(--cp-border)" }}
            tickLine={false}
            interval={0}
          />
          <YAxis
            tick={{ fill: "var(--cp-text-muted)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={44}
          />
          <Tooltip
            contentStyle={{
              background: "var(--cp-surface)",
              border: "1px solid var(--cp-border)",
              borderRadius: "0.625rem",
              color: "var(--cp-text)",
            }}
            cursor={{ fill: "var(--cp-accent-soft)" }}
            formatter={(value) => [Number(value).toLocaleString("zh-CN"), "数量"]}
          />
          <Bar dataKey="value" fill="var(--cp-accent)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
