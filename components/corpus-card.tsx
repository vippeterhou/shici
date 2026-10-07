import Link from "next/link";
import { corpusHref, formatNumber } from "@/lib/format";
import type { Corpus } from "@/lib/types";

export function CorpusCard({ corpus }: { corpus: Corpus }) {
  return (
    <Link className="corpus-card" href={corpusHref(corpus.key)}>
      <span className="corpus-era">{corpus.era}</span>
      <h3>{corpus.name}</h3>
      <p>{corpus.description}</p>
      <span className="corpus-count">
        收录 {formatNumber(corpus.poemCount)} 首
      </span>
    </Link>
  );
}
