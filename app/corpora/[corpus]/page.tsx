import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Pagination } from "@/components/pagination";
import { PoemCard } from "@/components/poem-card";
import { SearchForm } from "@/components/search-form";
import {
  getCorpora,
  getCorpus,
  getCorpusStats,
  listCorpusPoems,
} from "@/lib/data";
import { corpusHref, formatNumber } from "@/lib/format";

interface CorpusPageProps {
  params: Promise<{ corpus: string }>;
  searchParams: Promise<{ page?: string }>;
}

export const revalidate = 3_600;

export function generateStaticParams() {
  return getCorpora().map((corpus) => ({ corpus: corpus.key }));
}

export async function generateMetadata({
  params,
}: CorpusPageProps): Promise<Metadata> {
  const { corpus: corpusKey } = await params;
  const corpus = getCorpus(corpusKey);
  return corpus
    ? {
        title: corpus.name,
        description: `${corpus.description} 收录 ${formatNumber(corpus.poemCount)} 首作品。`,
      }
    : { title: "文库未找到" };
}

export default async function CorpusPage({
  params,
  searchParams,
}: CorpusPageProps) {
  const [{ corpus: corpusKey }, query] = await Promise.all([
    params,
    searchParams,
  ]);
  const corpus = getCorpus(corpusKey);
  const stats = getCorpusStats(corpusKey);
  if (!corpus || !stats) {
    notFound();
  }
  const page = Number.parseInt(query.page ?? "1", 10);
  const poems = listCorpusPoems(corpusKey, { page });

  return (
    <>
      <header className="page-shell page-hero">
        <nav className="breadcrumbs" aria-label="面包屑">
          <Link href="/corpora">文库</Link>
          <span>/</span>
          <span>{corpus.name}</span>
        </nav>
        <p className="eyebrow">{corpus.era}</p>
        <h1>{corpus.name}</h1>
        <p>{corpus.description}</p>
        <div className="stats-grid">
          <div className="stat-card">
            <span>作品</span>
            <strong>{formatNumber(stats.poemCount)}</strong>
          </div>
          <div className="stat-card">
            <span>作者</span>
            <strong>{formatNumber(stats.authorCount)}</strong>
          </div>
          <div className="stat-card">
            <span>正文汉字</span>
            <strong>{formatNumber(stats.characterCount)}</strong>
          </div>
        </div>
        <SearchForm
          compact={false}
          corpus={corpusKey}
          label={`在${corpus.name}中搜索`}
        />
      </header>

      <section className="page-shell section">
        <div className="results-summary">
          <p>按原始文集顺序浏览</p>
          <Link className="text-link" href={`/insights/${corpusKey}`}>
            查看数据洞察 →
          </Link>
        </div>
        <div className="poem-grid">
          {poems.items.map((poem) => (
            <PoemCard poem={poem} key={poem.id} />
          ))}
        </div>
        <Pagination
          page={poems.page}
          pageCount={poems.pageCount}
          hrefForPage={(nextPage) =>
            `${corpusHref(corpusKey)}?page=${nextPage}`
          }
        />
      </section>
    </>
  );
}
