// Avatar tokens: the four strings on `person.avatar` and how they turn into drawing choices.
// Unknown values never break a drawing - they fall back to a stable pick derived from the string.

export type AvatarTokens = {
  skin: string;
  hair: string;
  outfit: string;
  accessory: string;
};

export const OUTLINE = "#1d1a16";

const SKIN: Record<string, string> = {
  porcelain: "#fbe3cf",
  warm: "#f3c9a2",
  tan: "#e0a878",
  brown: "#b97a4e",
  deep: "#8a5433",
};

const HAIR_COLOUR: Record<string, string> = {
  black: "#23201f",
  brown: "#5a3a26",
  auburn: "#9a4a2a",
  grey: "#a9a7a2",
  blonde: "#d9a94e",
  red: "#c0452c",
};

const OUTFIT_COLOUR: Record<string, string> = {
  teal: "#2a9d8f",
  plum: "#7b3f61",
  rose: "#e58fa0",
  mustard: "#e3a72f",
  cream: "#f4ead2",
  slate: "#6b7a8f",
  sky: "#6fb1e4",
  navy: "#2c3e63",
  coral: "#ef6f55",
  olive: "#7c8b45",
};

export const HAIR_STYLES = ["short", "quiff", "curly", "bob", "long", "bun", "ponytail"] as const;
export type HairStyle = (typeof HAIR_STYLES)[number];

export const OUTFIT_STYLES = ["polo", "blazer", "cardigan", "blouse", "barong", "hoodie"] as const;
export type OutfitStyle = (typeof OUTFIT_STYLES)[number];

export const ACCESSORIES = ["none", "glasses", "headset", "lanyard", "earrings", "clipboard", "notebook", "mug", "bow"] as const;
export type Accessory = (typeof ACCESSORIES)[number];

export type AvatarLook = {
  skin: string;
  hairStyle: HairStyle;
  hairColour: string;
  outfitStyle: OutfitStyle;
  outfitColour: string;
  accessory: Accessory;
};

export function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function isHex(value: string): boolean {
  return /^#[0-9a-f]{3,8}$/i.test(value);
}

function pick<T>(list: readonly T[], seed: string): T {
  return list[hash(seed) % list.length] as T;
}

// "bun-black" -> style "bun", colour "black". Either half may be missing or a raw hex colour.
function split<S extends string>(
  token: string,
  styles: readonly S[],
  colours: Record<string, string>,
): { style: S; colour: string } {
  const parts = (token || "").toLowerCase().split(/[-_\s]+/).filter(Boolean);
  const style = parts.find((part): part is S => (styles as readonly string[]).includes(part));
  const named = parts.find((part) => part in colours);
  const hex = parts.find(isHex) ?? (isHex(token) ? token : undefined);
  return {
    style: style ?? pick(styles, token || "style"),
    colour: hex ?? (named ? (colours[named] as string) : pick(Object.values(colours), token || "colour")),
  };
}

export function resolveLook(avatar: Partial<AvatarTokens> | undefined, seed = "someone"): AvatarLook {
  const skinToken = (avatar?.skin ?? "").toLowerCase();
  const hair = split(avatar?.hair ?? seed, HAIR_STYLES, HAIR_COLOUR);
  const outfit = split(avatar?.outfit ?? seed, OUTFIT_STYLES, OUTFIT_COLOUR);
  const accessoryToken = (avatar?.accessory ?? "none").toLowerCase();
  return {
    skin: isHex(skinToken) ? skinToken : (SKIN[skinToken] ?? pick(Object.values(SKIN), seed + skinToken)),
    hairStyle: hair.style,
    hairColour: hair.colour,
    outfitStyle: outfit.style,
    outfitColour: outfit.colour,
    accessory: (ACCESSORIES as readonly string[]).includes(accessoryToken) ? (accessoryToken as Accessory) : "none",
  };
}

// Mix a hex colour towards black (amount < 0) or white (amount > 0). Used for shading.
export function shade(hex: string, amount: number): string {
  const full = hex.length === 4 ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}` : hex.slice(0, 7);
  const target = amount < 0 ? 0 : 255;
  const mix = Math.min(1, Math.abs(amount));
  const channel = (offset: number) => {
    const value = parseInt(full.slice(offset, offset + 2), 16);
    return Math.round(value + (target - value) * mix)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${channel(1)}${channel(3)}${channel(5)}`;
}

// A stable 0..1 number per person, used to desynchronise idle animations.
export function phase(seed: string): number {
  return (hash(seed) % 1000) / 1000;
}
