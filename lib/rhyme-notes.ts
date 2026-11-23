export const rhymeSections = [
  { id: "upper_level", label: "上平声" },
  { id: "lower_level", label: "下平声" },
  { id: "rising", label: "上声" },
  { id: "departing", label: "去声" },
  { id: "entering", label: "入声" },
] as const;

export type RhymeSectionId = (typeof rhymeSections)[number]["id"];

export interface RhymeNote {
  guangyunRhymes: string[];
  description: string;
  isSpecial: boolean;
}

// Each position follows the published Pingshui section/ordinal identity.
const correspondences: Record<RhymeSectionId, string[]> = {
  upper_level: [
    "東", "冬鍾", "江", "支脂之", "微", "魚", "虞模", "齊", "佳皆",
    "灰咍", "真諄臻", "文欣", "元魂痕", "寒桓", "刪山",
  ],
  lower_level: [
    "先仙", "蕭宵", "肴", "豪", "歌戈", "麻", "陽唐", "庚耕清",
    "青", "蒸登", "尤侯幽", "侵", "覃談", "鹽添嚴", "咸銜凡",
  ],
  rising: [
    "董", "腫", "講", "紙旨止", "尾", "語", "麌姥", "薺", "蟹駭",
    "賄海", "軫準", "吻隱", "阮混很", "旱緩", "潸產", "銑獮",
    "篠小", "巧", "皓", "哿果", "馬", "養蕩", "梗耿靜", "迥拯等",
    "有厚黝", "寢", "感敢", "琰忝儼", "豏檻范",
  ],
  departing: [
    "送", "宋用", "絳", "寘至志", "未", "御", "遇暮", "霽祭", "泰",
    "卦怪夬", "隊代廢", "震稕", "問焮", "願慁恨", "翰換", "諫襉",
    "霰線", "嘯笑", "效", "號", "箇過", "禡", "漾宕", "映諍勁",
    "徑證嶝", "宥候幼", "沁", "勘闞", "豔㮇釅", "陷鑑梵",
  ],
  entering: [
    "屋", "沃燭", "覺", "質術櫛", "物迄", "月沒", "曷末", "黠鎋",
    "屑薛", "藥鐸", "陌麥昔", "錫", "職德", "緝", "合盍",
    "葉帖業", "洽狎乏",
  ],
};

const specialDescriptions: Partial<Record<string, string>> = {
  "lower_level:14": "鹽、添同用，另并嚴（原与凡同用）",
  "lower_level:15": "咸、銜同用，另并凡（原与嚴同用）",
  "rising:24": "拯、等同用，另并迥（原独用）",
  "departing:11": "隊、代同用，另并廢（原独用）",
  "departing:13": "問、焮合并（原各独用）",
  "departing:25": "證、嶝同用，另并徑（原独用）",
  "entering:05": "物、迄合并（原各独用）",
  "entering:16": "葉、帖同用，另并業（原与乏同用）",
  "entering:17": "洽、狎同用，另并乏（原与業同用）",
};

export function getRhymeNote(section: RhymeSectionId, ordinal: number): RhymeNote {
  const correspondence = correspondences[section][ordinal - 1];
  if (!correspondence) {
    throw new Error(`Unknown Pingshui rhyme: ${section}:${ordinal}`);
  }
  const guangyunRhymes = [...correspondence];
  const id = `${section}:${String(ordinal).padStart(2, "0")}`;
  return {
    guangyunRhymes,
    description: specialDescriptions[id] ?? (guangyunRhymes.length === 1
      ? `${correspondence}独用`
      : `${guangyunRhymes.join("、")}同用`),
    isSpecial: specialDescriptions[id] !== undefined,
  };
}
