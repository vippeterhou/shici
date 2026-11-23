import "server-only";

import { getPingshuiyunDatabase } from "@/lib/db";
import { formatPingshuiRhyme, type HistoricalTone } from "@/lib/prosody";
import { getRhymeNote, rhymeSections, type RhymeNote, type RhymeSectionId } from "@/lib/rhyme-notes";
import { normalizeSearchText } from "@/lib/search-normalization";

interface RhymeRow {
  id: string;
  sectionId: RhymeSectionId;
  section: string;
  tone: HistoricalTone;
  ordinal: number;
  name: string;
}

interface RhymeCharacter {
  character: string;
  supplementKind: string;
}

interface RhymeGroup extends RhymeRow {
  label: string;
  characters: RhymeCharacter[];
  note: RhymeNote;
  matchedCharacters: string[];
}

export function getRhymeDirectory(query: string) {
  const database = getPingshuiyunDatabase();
  if (!database) return null;
  const groups = database.prepare<[], RhymeRow>(`
    SELECT id, section_id AS sectionId, section, tone, ordinal, name
    FROM rhyme_groups
  `).all();
  const rows = database.prepare<[], RhymeCharacter & { rhymeId: string }>(`
    SELECT rhyme_id AS rhymeId, character, supplement_kind AS supplementKind
    FROM character_rhymes
    ORDER BY is_supplement, supplement_kind, source_order, character
  `).all();
  const byGroup = new Map<string, RhymeCharacter[]>();
  for (const { rhymeId, ...entry } of rows) {
    const characters = byGroup.get(rhymeId) ?? [];
    characters.push(entry);
    byGroup.set(rhymeId, characters);
  }
  const search = query.trim();
  const isCharacterSearch = [...search].length === 1;
  const matches = isCharacterSearch
    ? database.prepare<[string, string], { rhymeId: string; character: string }>(`
        SELECT rhyme_id AS rhymeId, character FROM character_rhymes WHERE character = ?
        UNION
        SELECT r.rhyme_id AS rhymeId, r.character
        FROM character_aliases a
        JOIN character_rhymes r ON r.character = a.target_character
        WHERE a.input_character = ?
      `).all(search, search)
    : [];
  const normalizedQuery = normalizeSearchText(search).replace(/[韵聲声]/gu, "");
  const rhymes: RhymeGroup[] = groups.map((group) => {
    if (!rhymeSections.some((section) => section.id === group.sectionId)) {
      throw new Error(`Unknown Pingshui section: ${group.sectionId}`);
    }
    return {
      ...group,
      label: formatPingshuiRhyme(group.section, group.ordinal, group.name),
      characters: byGroup.get(group.id) ?? [],
      note: getRhymeNote(group.sectionId, group.ordinal),
      matchedCharacters: matches
        .filter((match) => match.rhymeId === group.id)
        .map((match) => match.character),
    };
  });
  const filtered = rhymes.filter((group) =>
    !search || (isCharacterSearch
      ? group.matchedCharacters.length > 0
      : Boolean(normalizedQuery) &&
        normalizeSearchText(group.label).includes(normalizedQuery)),
  );
  return {
    groupCount: rhymes.length,
    characterCount: new Set(rows.map((row) => row.character)).size,
    sections: rhymeSections.map((section) => ({
      ...section,
      groups: rhymes
        .filter((group) => group.sectionId === section.id)
        .sort((left, right) => left.ordinal - right.ordinal),
    })),
    matchedGroupCount: filtered.length,
    matchedGroupIds: filtered.map((group) => group.id),
    isCharacterSearch,
  };
}
