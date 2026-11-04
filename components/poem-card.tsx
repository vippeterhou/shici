import Link from "next/link";
import { poemHref } from "@/lib/format";
import {
  findFirstSearchMatch,
  findSearchMatches,
} from "@/lib/search-normalization";
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
  const matchingTags = query
    ? poem.tags.filter((tag) => findFirstSearchMatch(tag, query))
    : [];
  const displayedTags = [
    ...matchingTags,
    ...poem.tags.filter((tag) => !matchingTags.includes(tag)),
  ].slice(0, 2);
  return (
    <Link className="poem-card" href={poemHref(poem.corpus, poem.id)}>
      {showCorpus ? <span className="corpus-era">{poem.corpusName}</span> : null}
      <h2><HighlightedText text={poem.title} query={query} /></h2>
      <span className="poem-card-author">
        <HighlightedText text={poem.author} query={query} />
      </span>
      {displayedTags.length ? (
        <span className="tag-list">
          {displayedTags.map((tag) => (
            <span className="tag" key={tag}>
              <HighlightedText text={tag} query={query} />
            </span>
          ))}
        </span>
      ) : null}
      <p className="poem-card-excerpt">
        <HighlightedText text={poem.excerpt} query={query} />
      </p>
      <span className="poem-card-meta">
        <span>{poem.sentenceCount} 句</span>
        <span>{poem.characterCount} 字</span>
      </span>
    </Link>
  );
}

function HighlightedText({
  text,
  query,
}: {
  text: string;
  query: string;
}) {
  if (!query) {
    return text;
  }
  const matches = findSearchMatches(text, query);
  if (!matches.length) {
    return text;
  }
  const parts: React.ReactNode[] = [];
  let offset = 0;
  for (const match of matches) {
    parts.push(text.slice(offset, match.index));
    parts.push(
      <mark key={`${match.index}-${match.length}`}>
        {text.slice(match.index, match.index + match.length)}
      </mark>,
    );
    offset = match.index + match.length;
  }
  parts.push(text.slice(offset));
  return parts;
}
