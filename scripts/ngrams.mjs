export class SpaceSaving {
  constructor(capacity) {
    this.capacity = capacity;
    this.heap = [];
    this.nodes = new Map();
  }

  add(term) {
    const existing = this.nodes.get(term);
    if (existing) {
      existing.count += 1;
      this.#moveDown(existing.index);
      return;
    }
    if (this.heap.length < this.capacity) {
      const node = { term, count: 1, index: this.heap.length };
      this.heap.push(node);
      this.nodes.set(term, node);
      this.#moveUp(node.index);
      return;
    }
    const minimum = this.heap[0];
    this.nodes.delete(minimum.term);
    minimum.term = term;
    minimum.count += 1;
    this.nodes.set(term, minimum);
    this.#moveDown(0);
  }

  tokens() {
    return this.nodes.keys();
  }

  #moveUp(startIndex) {
    let index = startIndex;
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      if (this.heap[parentIndex].count <= this.heap[index].count) {
        break;
      }
      this.#swap(index, parentIndex);
      index = parentIndex;
    }
  }

  #moveDown(startIndex) {
    let index = startIndex;
    while (true) {
      const left = index * 2 + 1;
      const right = left + 1;
      let smallest = index;
      if (
        left < this.heap.length &&
        this.heap[left].count < this.heap[smallest].count
      ) {
        smallest = left;
      }
      if (
        right < this.heap.length &&
        this.heap[right].count < this.heap[smallest].count
      ) {
        smallest = right;
      }
      if (smallest === index) {
        return;
      }
      this.#swap(index, smallest);
      index = smallest;
    }
  }

  #swap(leftIndex, rightIndex) {
    const left = this.heap[leftIndex];
    const right = this.heap[rightIndex];
    this.heap[leftIndex] = right;
    this.heap[rightIndex] = left;
    left.index = rightIndex;
    right.index = leftIndex;
  }
}

export function collectNgrams(text, bigramCandidates, trigramCandidates) {
  visitNgrams(text, (bigram) => bigramCandidates.add(bigram), (trigram) =>
    trigramCandidates.add(trigram),
  );
}

export function countCandidateNgrams(text, bigramCounts, trigramCounts) {
  visitNgrams(
    text,
    (bigram) => incrementCandidate(bigramCounts, bigram),
    (trigram) => incrementCandidate(trigramCounts, trigram),
  );
}

function visitNgrams(text, visitBigram, visitTrigram) {
  let previous = "";
  let previousPrevious = "";
  for (const character of text) {
    if (!isHanCharacter(character)) {
      previous = "";
      previousPrevious = "";
      continue;
    }
    if (previous) {
      visitBigram(`${previous}${character}`);
    }
    if (previousPrevious) {
      visitTrigram(`${previousPrevious}${previous}${character}`);
    }
    previousPrevious = previous;
    previous = character;
  }
}

function incrementCandidate(counts, term) {
  const count = counts.get(term);
  if (count !== undefined) {
    counts.set(term, count + 1);
  }
}

function isHanCharacter(value) {
  return /\p{Script=Han}/u.test(value) || value === "〇";
}
