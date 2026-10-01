import { Store } from "../api/client";

const DEFAULT_THEME_COLOR = "#EE6795";

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const num = parseInt(full, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function rgbToHex([r, g, b]: [number, number, number]): string {
  return "#" + [r, g, b].map((c) => Math.round(c).toString(16).padStart(2, "0")).join("");
}

/** Igual que applyStoreTheme() del mockup: tinte suave (14% color + 86% blanco) y color de tinta por contraste. */
export function applyStoreTheme(store: Store | null | undefined) {
  const hex = store?.themeColor || DEFAULT_THEME_COLOR;
  const [r, g, b] = hexToRgb(hex);
  const soft = rgbToHex([r * 0.14 + 255 * 0.86, g * 0.14 + 255 * 0.86, b * 0.14 + 255 * 0.86]);
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  const ink = luminance > 150 ? "#232329" : "#FFFFFF";

  const root = document.documentElement.style;
  root.setProperty("--accent", hex);
  root.setProperty("--accent-soft", soft);
  root.setProperty("--accent-ink", ink);
}
