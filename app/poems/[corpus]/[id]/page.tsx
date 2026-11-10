import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdjacentPoems, getCorpus, getPoem } from "@/lib/data";
import {
  corpusHref,
  decodeRouteSegment,
  formatNumber,
  poemHref,
} from "@/lib/format";
import { displayLineType } from "@/lib/format-combinations";

interface PoemPageProps {
  params: Promise<{ corpus: string; id: string }>;
}

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PoemPageProps): Promise<Metadata> {
  const routeParams = await params;
  const corpus = decodeRouteSegment(routeParams.corpus);
  const id = decodeRouteSegment(routeParams.id);
  const poem = getPoem(corpus, id);
  if (!poem) {
    return { title: "作品未找到" };
  }
  const description = poem.paragraphs.join("").slice(0, 120);
  return {
    title: `${poem.title} · ${poem.author}`,
    description,
    openGraph: {
      type: "article",
      title: poem.title,
      description: `${poem.author}：${description}`,
    },
  };
}

export default async function PoemPage({ params }: PoemPageProps) {
  const routeParams = await params;
  const corpusKey = decodeRouteSegment(routeParams.corpus);
  const id = decodeRouteSegment(routeParams.id);
  const poem = getPoem(corpusKey, id);
  const corpus = getCorpus(corpusKey);
  if (!poem || !corpus) {
    notFound();
  }
  const adjacent = getAdjacentPoems(corpusKey, id);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: poem.title,
    author: {
      "@type": "Person",
      name: poem.author,
    },
    text: poem.paragraphs.join("\n"),
    inLanguage: "zh",
    isPartOf: corpus.name,
  };

  return (
    <div className="page-shell">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replaceAll("<", "\\u003c"),
        }}
      />
      <header className="page-hero">
        <nav className="breadcrumbs" aria-label="面包屑">
          <Link href={`/corpora?corpus=${corpus.key}`}>高级搜索</Link>
          <span>/</span>
          <Link href={corpusHref(corpus.key)}>{corpus.name}</Link>
          <span>/</span>
          <span>{poem.title}</span>
        </nav>
      </header>
      <div className="reader-wrap">
        <article className="reader-panel">
          <h1 className="reader-title">{poem.title}</h1>
          <p className="reader-author">{poem.author}</p>
          <div className="reader-body">
            {poem.paragraphs.map((paragraph, index) => (
              <p key={`${poem.id}-${index}`}>{paragraph}</p>
            ))}
          </div>
          <nav className="adjacent-nav" aria-label="相邻作品">
            {adjacent.previous ? (
              <Link
                href={poemHref(adjacent.previous.corpus, adjacent.previous.id)}
              >
                <span>上一篇</span>
                {adjacent.previous.title}
              </Link>
            ) : (
              <span />
            )}
            {adjacent.next ? (
              <Link href={poemHref(adjacent.next.corpus, adjacent.next.id)}>
                <span>下一篇</span>
                {adjacent.next.title}
              </Link>
            ) : (
              <span />
            )}
          </nav>
        </article>
        <aside className="reader-meta" aria-label="作品信息">
          <dl>
            <div>
              <dt>文库</dt>
              <dd>
                <Link className="text-link" href={corpusHref(corpus.key)}>
                  {corpus.name}
                </Link>
              </dd>
            </div>
            <div>
              <dt>时代</dt>
              <dd>{corpus.era}</dd>
            </div>
            <div>
              <dt>结构</dt>
              <dd>
                {poem.sentenceCount} 句 · {displayLineType(poem.lineType)}
              </dd>
            </div>
            <div>
              <dt>正文</dt>
              <dd>{poem.characterCount} 个汉字</dd>
            </div>
            {corpus.recordCount !== corpus.poemCount ? (
              <div>
                <dt>全唐诗位置</dt>
                <dd>
                  {poem.volume && poem.volumeCount
                    ? `第 ${formatNumber(poem.volume)} / ${formatNumber(poem.volumeCount)} 卷 · `
                    : ""}
                  第 {formatNumber(poem.recordPosition)} /{" "}
                  {formatNumber(corpus.recordCount)} 条
                </dd>
              </div>
            ) : null}
            {poem.entries.length > 1 ? (
              <div>
                <dt>收录题名</dt>
                <dd>
                  {poem.entries.map((entry, index) => (
                    <span key={entry.id}>
                      {index ? " · " : ""}
                      {entry.id === poem.id ? (
                        <>
                          {entry.title}
                          {entry.volume
                            ? `（第 ${formatNumber(entry.volume)} 卷）`
                            : ""}
                        </>
                      ) : (
                        <Link
                          className="text-link"
                          href={poemHref(poem.corpus, entry.id)}
                        >
                          {entry.title}
                          {entry.volume
                            ? `（第 ${formatNumber(entry.volume)} 卷）`
                            : ""}
                        </Link>
                      )}
                    </span>
                  ))}
                </dd>
              </div>
            ) : null}
            {poem.alternateAttributions.length ? (
              <div>
                <dt>另有异署</dt>
                <dd>
                  {poem.alternateAttributions.map((entry, index) => (
                    <span key={entry.id}>
                      {index ? " · " : ""}
                      <Link
                        className="text-link"
                        href={poemHref(poem.corpus, entry.id)}
                      >
                        {entry.author}《{entry.title}》
                        {entry.volume
                          ? `（第 ${formatNumber(entry.volume)} 卷）`
                          : ""}
                      </Link>
                    </span>
                  ))}
                </dd>
              </div>
            ) : null}
            {poem.chapter ? (
              <div>
                <dt>篇章</dt>
                <dd>
                  {poem.chapter}
                  {poem.section ? ` · ${poem.section}` : ""}
                </dd>
              </div>
            ) : null}
          </dl>
          {poem.tags.length ? (
            <div className="tag-list">
              {poem.tags.map((tag) => (
                <span className="tag" key={tag}>
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
