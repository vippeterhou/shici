import { CorpusStructureInsight } from "@/components/corpus-structure-insight";
import { FormatHeatmap } from "@/components/format-heatmap";
import { InsightChart } from "@/components/insight-chart";
import { TextFrequencyExplorer } from "@/components/text-frequency-explorer";
import type { CorpusInsights } from "@/lib/types";

export function CorpusAnalysis({ insights }: { insights: CorpusInsights }) {
  return (
    <div className="chart-grid">
      <article className="chart-card chart-card-wide">
        <h2>每句字数 × 句数组合</h2>
        <p>横轴是作品句数，纵轴是每句字数类型；颜色越深，作品数量越多。</p>
        <FormatHeatmap data={insights.formatCombinations} />
      </article>
      {insights.structure ? <CorpusStructureInsight structure={insights.structure} /> : null}
      <article className="chart-card">
        <h2>作品数量较多的作者</h2>
        <p>作者名称按数据原貌统计，别名与简繁体可能分列。</p>
        <InsightChart data={insights.authors} horizontal />
      </article>
      <article className="chart-card">
        <h2>常见句数</h2>
        <p>显示作品数量最多的句数类型。</p>
        <InsightChart data={insights.sentenceCounts} />
      </article>
      <article className="chart-card">
        <h2>每句字数类型</h2>
        <p>整齐句式按字数归类，长短不齐的作品归入杂言。</p>
        <InsightChart data={insights.lineTypes} />
      </article>
      <article className="chart-card chart-card-wide">
        <h2>正文语言频率</h2>
        <p>在同一位置切换观察单字、二字与三字组合，避免重复堆叠图表。</p>
        <TextFrequencyExplorer
          characters={insights.characters}
          bigrams={insights.bigrams}
          trigrams={insights.trigrams}
        />
      </article>
    </div>
  );
}
