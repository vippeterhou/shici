export interface Corpus {
  key: string;
  name: string;
  era: string;
  description: string;
  sortOrder: number;
  poemCount: number;
}

export interface CorpusStats {
  corpus: string;
  poemCount: number;
  authorCount: number;
  characterCount: number;
  averageCharacters: number;
}

export interface Poem {
  id: string;
  corpus: string;
  title: string;
  author: string;
  paragraphs: string[];
  tags: string[];
  chapter: string | null;
  section: string | null;
  sentenceCount: number;
  sentenceLengths: number[];
  uniformSentenceLength: number | null;
  characterCount: number;
  lineType: string;
}

export interface PoemSummary {
  id: string;
  corpus: string;
  corpusName: string;
  title: string;
  author: string;
  excerpt: string;
  tags: string[];
  sentenceCount: number;
  characterCount: number;
}

export interface PaginatedPoems {
  items: PoemSummary[];
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
}

export interface SearchResponse extends PaginatedPoems {
  query: string;
}

export interface InsightDatum {
  label: string;
  value: number;
}

export interface FormatCombinationDatum {
  sentenceCount: number;
  lineType: string;
  value: number;
}

export interface HierarchyDatum {
  chapter: string;
  section: string;
  value: number;
}

export type CorpusStructure =
  | {
      kind: "tunes";
      data: InsightDatum[];
    }
  | {
      kind: "hierarchy";
      data: HierarchyDatum[];
    };

export interface CorpusInsights {
  corpus: Corpus;
  stats: CorpusStats;
  authors: InsightDatum[];
  sentenceCounts: InsightDatum[];
  lineTypes: InsightDatum[];
  characters: InsightDatum[];
  bigrams: InsightDatum[];
  trigrams: InsightDatum[];
  formatCombinations: FormatCombinationDatum[];
  structure: CorpusStructure | null;
}
