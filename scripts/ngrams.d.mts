export const NGRAM_CANDIDATE_LIMIT: number;

export class SpaceSaving {
  constructor(capacity: number);
  add(term: string): void;
  tokens(): IterableIterator<string>;
}

export function collectNgrams(
  text: string,
  bigramCandidates: SpaceSaving,
  trigramCandidates: SpaceSaving,
): void;

export function countCandidateNgrams(
  text: string,
  bigramCounts: Map<string, number>,
  trigramCounts: Map<string, number>,
): void;

export function isHanCharacter(value: string): boolean;
