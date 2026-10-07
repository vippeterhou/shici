import { InsightChart } from "@/components/insight-chart";
import type { CorpusStructure, HierarchyDatum } from "@/lib/types";

export function CorpusStructureInsight({
  structure,
}: {
  structure: CorpusStructure;
}) {
  if (structure.kind === "tunes") {
    return (
      <article className="chart-card chart-card-wide">
        <h2>文库结构 · 词牌数量</h2>
        <p>显示收录作品最多的 20 个词牌，词牌从题目中的点号之前提取。</p>
        <InsightChart data={structure.data} horizontal />
      </article>
    );
  }

  return (
    <article className="chart-card chart-card-wide">
      <h2>文库结构 · 篇章与小节</h2>
      <p>按照《诗经》原有编排汇总各篇章与小节的收录数量。</p>
      <HierarchySummary data={structure.data} />
    </article>
  );
}

function HierarchySummary({ data }: { data: HierarchyDatum[] }) {
  const chapters = new Map<string, HierarchyDatum[]>();
  for (const item of data) {
    const sections = chapters.get(item.chapter) ?? [];
    sections.push(item);
    chapters.set(item.chapter, sections);
  }
  const maximum = Math.max(...data.map((item) => item.value), 1);

  return (
    <div className="hierarchy-groups">
      {[...chapters].map(([chapter, sections]) => {
        const total = sections.reduce((sum, item) => sum + item.value, 0);
        return (
          <section className="hierarchy-group" key={chapter}>
            <header>
              <h3>{chapter}</h3>
              <span>{total.toLocaleString("zh-CN")} 篇</span>
            </header>
            <div className="hierarchy-sections">
              {sections.map((item) => (
                <div className="hierarchy-row" key={`${chapter}-${item.section}`}>
                  <div>
                    <span>{item.section}</span>
                    <strong>{item.value}</strong>
                  </div>
                  <span className="hierarchy-track" aria-hidden="true">
                    <span
                      className="hierarchy-fill"
                      style={{ width: `${(item.value / maximum) * 100}%` }}
                    />
                  </span>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
