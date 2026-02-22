export type ThemeId = "blue-sky" | "green" | "red" | "oled-sky-blue" | "oled-green" | "custom";

export type CustomThemeConfig = {
  backgroundStartHex: string;
  backgroundEndHex: string;
  colorBackgroundHex: string;
  colorSurfaceHex: string;
  colorForegroundHex: string;
  colorAccentHex: string;
  colorAccentForegroundHex: string;
  colorBorderHex: string;
  colorRingHex: string;
  terminalBackgroundHex: string;
  terminalForegroundHex: string;
  shadowX: string;
  shadowY: string;
  hideBorders: boolean;
};

export const themeOptions: Array<{ id: ThemeId; label: string }> = [
  { id: "blue-sky", label: "Blue Sky" },
  { id: "green", label: "Green" },
  { id: "red", label: "Red" },
  { id: "oled-sky-blue", label: "OLED Sky Blue" },
  { id: "oled-green", label: "OLED Green" },
  { id: "custom", label: "Custom" },
];

export const defaultThemeId: ThemeId = "oled-green";
export const themeStorageKey = "epub-forge-theme";
export const customThemeStorageKey = "epub-forge-custom-theme";

export const defaultCustomTheme: CustomThemeConfig = {
  backgroundStartHex: "#000000",
  backgroundEndHex: "#000000",
  colorBackgroundHex: "#000000",
  colorSurfaceHex: "#141414",
  colorForegroundHex: "#ffffff",
  colorAccentHex: "#00ff88",
  colorAccentForegroundHex: "#08140e",
  colorBorderHex: "#ffffff",
  colorRingHex: "#00ff88",
  terminalBackgroundHex: "#000000",
  terminalForegroundHex: "#00ff88",
  shadowX: "0px",
  shadowY: "0px",
  hideBorders: true,
};

const hexPattern = /^#([\da-f]{6})$/i;

function isHex(value: unknown): value is string {
  return typeof value === "string" && hexPattern.test(value);
}

export function isThemeId(value: string): value is ThemeId {
  return themeOptions.some((option) => option.id === value);
}

export function normalizeCustomTheme(input: unknown): CustomThemeConfig {
  if (!input || typeof input !== "object") {
    return defaultCustomTheme;
  }

  const source = input as Partial<CustomThemeConfig>;
  return {
    backgroundStartHex: isHex(source.backgroundStartHex) ? source.backgroundStartHex : defaultCustomTheme.backgroundStartHex,
    backgroundEndHex: isHex(source.backgroundEndHex) ? source.backgroundEndHex : defaultCustomTheme.backgroundEndHex,
    colorBackgroundHex: isHex(source.colorBackgroundHex) ? source.colorBackgroundHex : defaultCustomTheme.colorBackgroundHex,
    colorSurfaceHex: isHex(source.colorSurfaceHex) ? source.colorSurfaceHex : defaultCustomTheme.colorSurfaceHex,
    colorForegroundHex: isHex(source.colorForegroundHex) ? source.colorForegroundHex : defaultCustomTheme.colorForegroundHex,
    colorAccentHex: isHex(source.colorAccentHex) ? source.colorAccentHex : defaultCustomTheme.colorAccentHex,
    colorAccentForegroundHex: isHex(source.colorAccentForegroundHex)
      ? source.colorAccentForegroundHex
      : defaultCustomTheme.colorAccentForegroundHex,
    colorBorderHex: isHex(source.colorBorderHex) ? source.colorBorderHex : defaultCustomTheme.colorBorderHex,
    colorRingHex: isHex(source.colorRingHex) ? source.colorRingHex : defaultCustomTheme.colorRingHex,
    terminalBackgroundHex: isHex(source.terminalBackgroundHex) ? source.terminalBackgroundHex : defaultCustomTheme.terminalBackgroundHex,
    terminalForegroundHex: isHex(source.terminalForegroundHex) ? source.terminalForegroundHex : defaultCustomTheme.terminalForegroundHex,
    shadowX: source.shadowX || defaultCustomTheme.shadowX,
    shadowY: source.shadowY || defaultCustomTheme.shadowY,
    hideBorders: source.hideBorders ?? defaultCustomTheme.hideBorders,
  };
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const sanitized = hex.replace("#", "");
  return {
    r: Number.parseInt(sanitized.slice(0, 2), 16),
    g: Number.parseInt(sanitized.slice(2, 4), 16),
    b: Number.parseInt(sanitized.slice(4, 6), 16),
  };
}

function srgbToLinear(value: number): number {
  const normalized = value / 255;
  if (normalized <= 0.04045) {
    return normalized / 12.92;
  }
  return ((normalized + 0.055) / 1.055) ** 2.4;
}

export function hexToOklchTriplet(hex: string): string {
  const { r, g, b } = hexToRgb(hex);
  const rl = srgbToLinear(r);
  const gl = srgbToLinear(g);
  const bl = srgbToLinear(b);

  const l = 0.4122214708 * rl + 0.5363325363 * gl + 0.0514459929 * bl;
  const m = 0.2119034982 * rl + 0.6806995451 * gl + 0.1073969566 * bl;
  const s = 0.0883024619 * rl + 0.2817188376 * gl + 0.6299787005 * bl;

  const lRoot = Math.cbrt(l);
  const mRoot = Math.cbrt(m);
  const sRoot = Math.cbrt(s);

  const lightness = 0.2104542553 * lRoot + 0.793617785 * mRoot - 0.0040720468 * sRoot;
  const a = 1.9779984951 * lRoot - 2.428592205 * mRoot + 0.4505937099 * sRoot;
  const bAxis = 0.0259040371 * lRoot + 0.7827717662 * mRoot - 0.808675766 * sRoot;

  const chroma = Math.sqrt(a * a + bAxis * bAxis);
  let hue = (Math.atan2(bAxis, a) * 180) / Math.PI;
  if (hue < 0) {
    hue += 360;
  }

  return `${(lightness * 100).toFixed(2)}% ${chroma.toFixed(4)} ${hue.toFixed(2)}`;
}
