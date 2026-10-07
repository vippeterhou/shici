import Link from "next/link";
import { poemHref } from "@/lib/format";
import { findFirstSearchMatch } from "@/lib/search-normalization";
import type { PoemSummary } from "@/lib/types";

export function PoemCard({
  poem,
  showCorpus = false,
  query = "",
}: {
  poem: PoemSummary;
  showCorpus?: boolean;
  query?: string;
}) {
  return (
    <Link className="poem-card" href={poemHref(poem.corpus, poem.id)}>
      {showCorpus ? <span className="corpus-era">{poem.corpusName}</span> : null}
      <h2>{poem.title}</h2>
      <span className="poem-card-author">{poem.author}</span>
      {poem.tags.length ? (
        <span className="tag-list">
          {poem.tags.slice(0, 2).map((tag) => (
            <span className="tag" key={tag}>
              {tag}
            </span>
          ))}
        </span>
      ) : null}
      <p className="poem-card-excerpt">
        <HighlightedExcerpt text={poem.excerpt} query={query} />
      </p>
      <span className="poem-card-meta">
        <span>{poem.sentenceCount} 句</span>
        <span>{poem.characterCount} 字</span>
      </span>
    </Link>
  );
}

function HighlightedExcerpt({
  text,
  query,
}: {
  text: string;
  query: string;
}) {
  if (!query) {
    return text;
  }
  const match = findFirstSearchMatch(text, query);
  if (!match) {
    return text;
  }
  return (
    <>
      {text.slice(0, match.index)}
      <mark>{text.slice(match.index, match.index + match.length)}</mark>
      {text.slice(match.index + match.length)}
    </>
  );
}
