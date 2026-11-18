// Parties d'une séance de musculation et leur couleur, pour les repérer d'un
// coup d'œil (séance, fiche d'exercice, formulaire de construction).
export type BlockPart = "Échauffement" | "Corps de séance" | "Gainage" | "Retour au calme";

export const PART_OF_BLOCK_TYPE: Record<string, BlockPart> = {
  warmup_mobility: "Échauffement",
  warmup_plyo: "Échauffement",
  warmup_proprio: "Échauffement",
  main: "Corps de séance",
  secondary: "Corps de séance",
  complementary: "Corps de séance",
  specific: "Corps de séance",
  core: "Gainage",
  cooldown: "Retour au calme",
};

export const PART_COLORS: Record<BlockPart, { color: string; bg: string; line: string }> = {
  Échauffement: { color: "#c25a2e", bg: "#fdf1ea", line: "#f0c3ab" },
  "Corps de séance": { color: "#1b4b4f", bg: "#e8f1f0", line: "#b4cfcc" },
  Gainage: { color: "#6a4cc0", bg: "#f2eefc", line: "#d3c8f2" },
  "Retour au calme": { color: "#2b7fb0", bg: "#e9f3fa", line: "#bcdaee" },
};

export function partOf(blockType: string): BlockPart {
  return PART_OF_BLOCK_TYPE[blockType] ?? "Corps de séance";
}

export function partColors(blockType: string) {
  return PART_COLORS[partOf(blockType)];
}
