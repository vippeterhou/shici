import Database from "better-sqlite3";
import { copyFileSync, renameSync, rmSync } from "node:fs";

export function installGuangyunDictionary(source, target) {
  installDictionary(source, target, (database) => {
    const { count } = database.prepare(
      "SELECT COUNT(*) AS count FROM character_readings",
    ).get();
    const { invalid } = database.prepare(`
      SELECT COUNT(*) AS invalid FROM character_readings
      WHERE trim(character) = '' OR tone NOT IN ('平', '上', '去', '入')
         OR trim(rhyme) = ''
    `).get();
    database.prepare(
      "SELECT input_character, target_character FROM character_aliases LIMIT 1",
    ).all();
    const metadata = readMetadata(database);
    const dictionary = JSON.parse(metadata.dictionary ?? "{}");
    if (
      !count || invalid || !metadata.license_text ||
      !dictionary.name || !dictionary.source_url || !dictionary.license
    ) {
      throw new Error(`Incomplete Guangyun lookup database: ${source}`);
    }
  });
}

export function installPingshuiyunDictionary(source, target) {
  installDictionary(source, target, (database) => {
    const { count } = database.prepare(
      "SELECT COUNT(*) AS count FROM rhyme_groups",
    ).get();
    const toneCounts = Object.fromEntries(
      database.prepare(
        "SELECT tone, COUNT(*) AS count FROM rhyme_groups GROUP BY tone",
      ).all().map(({ tone, count: toneCount }) => [tone, toneCount]),
    );
    const { characterCount } = database.prepare(
      "SELECT COUNT(*) AS characterCount FROM character_rhymes",
    ).get();
    const { aliasCount } = database.prepare(
      "SELECT COUNT(*) AS aliasCount FROM character_aliases",
    ).get();
    database.prepare(`
      SELECT character, canonical_character, tone, register, ordinal, rhyme,
             section, is_supplement, supplement_kind, match_type
      FROM character_lookup LIMIT 1
    `).all();
    const metadata = readMetadata(database);
    const dictionary = JSON.parse(metadata.dictionary ?? "{}");
    if (
      count !== 106 ||
      toneCounts["平"] !== 30 || toneCounts["上"] !== 29 ||
      toneCounts["去"] !== 30 || toneCounts["入"] !== 17 ||
      !characterCount || !aliasCount || !metadata.license_text ||
      !dictionary.name || !dictionary.scope || !dictionary.license
    ) {
      throw new Error(`Incomplete Pingshuiyun lookup database: ${source}`);
    }
  });
}

function installDictionary(source, target, validate) {
  const database = new Database(source, {
    readonly: true,
    fileMustExist: true,
  });
  try {
    const checks = database.pragma("quick_check");
    if (checks.length !== 1 || checks[0].quick_check !== "ok") {
      throw new Error(`Invalid lookup database: ${source}`);
    }
    validate(database);
  } finally {
    database.close();
  }
  const temporaryTarget = `${target}.building`;
  try {
    copyFileSync(source, temporaryTarget);
    renameSync(temporaryTarget, target);
  } finally {
    rmSync(temporaryTarget, { force: true });
  }
}

function readMetadata(database) {
  return Object.fromEntries(
    database.prepare("SELECT key, value FROM metadata").all()
      .map(({ key, value }) => [key, value]),
  );
}
