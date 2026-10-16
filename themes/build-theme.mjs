#!/usr/bin/env node
// Build a Power BI report theme from brand tokens on top of Microsoft's base theme.
// The base theme's per-visual safeguards (textbox padding, card spacing, table styling,
// hidden visual headers) are kept; only colors and fonts are swapped for token values.
//
// Usage:  node themes/build-theme.mjs [tokens.json]
// Default tokens: themes/brand-tokens.json
// Output: themes/<Name>-<hash>.json. Power BI caches themes by name, so the file name carries
// a content hash and the theme's "name" matches the file name (both required by the validator).
// Register the output under StaticResources/RegisteredResources with the same name.

import { createHash } from "node:crypto";
import { readdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const basePath = resolve(here, "../.claude/skills/brillit-report-standards/assets/ms-base-theme.json");
const tokensPath = resolve(process.argv[2] ?? join(here, "brand-tokens.json"));

const t = JSON.parse(readFileSync(tokensPath, "utf8"));
const base = JSON.parse(readFileSync(basePath, "utf8"));

// --- validate tokens -------------------------------------------------------
const HEX = /^#[0-9a-f]{6}$/i;
const errors = [];
const get = (path) => path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), t);
const colorPaths = [
  "brand.primary", "brand.secondary", "brand.accent",
  "surface.page", "surface.card", "surface.alt", "surface.border", "surface.headerBand", "surface.headerText",
  "text.primary", "text.secondary", "text.muted", "chrome.gridline",
  "sequential.min", "sequential.max", "diverging.negative", "diverging.center", "diverging.positive",
  "semantic.good", "semantic.warning", "semantic.bad", "null",
];
for (const p of colorPaths) if (!HEX.test(get(p) ?? "")) errors.push(`${p} must be a #rrggbb color`);
if (!Array.isArray(t.categorical) || t.categorical.length < 3 || t.categorical.length > 8) {
  errors.push("categorical must list 3 to 8 colors");
} else {
  t.categorical.forEach((c, i) => { if (!HEX.test(c)) errors.push(`categorical[${i}] must be a #rrggbb color`); });
}
if (typeof t.name !== "string" || !t.name.trim()) errors.push("name is required");
for (const p of ["typography.body", "typography.semibold"]) if (typeof get(p) !== "string") errors.push(`${p} is required`);

// WCAG contrast for text on the surfaces it sits on
const lum = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
const warnings = [];
if (!errors.length) {
  const pairs = [
    ["text.primary", "surface.card", 4.5], ["text.primary", "surface.page", 4.5],
    ["text.secondary", "surface.card", 4.5], ["surface.headerText", "surface.headerBand", 4.5],
  ];
  if (HEX.test(t.text.heading ?? "")) pairs.push(["text.heading", "surface.card", 4.5]);
  if (HEX.test(t.brand.accentText ?? "")) pairs.push(["brand.accentText", "surface.card", 4.5]);
  for (const [fg, bg, min] of pairs) {
    const r = contrast(get(fg), get(bg));
    if (r < min) errors.push(`${fg} on ${bg} contrast ${r.toFixed(2)} is below ${min}:1`);
  }
  t.categorical.forEach((c, i) => {
    const r = contrast(c, t.surface.card);
    if (r < 3) warnings.push(`categorical[${i}] ${c} is ${r.toFixed(2)}:1 on the card surface — show data labels or a table view when it's used`);
  });
}
if (errors.length) {
  console.error(`Token errors in ${tokensPath}:\n - ${errors.join("\n - ")}`);
  process.exit(1);
}

// --- map base theme colors and fonts to tokens -----------------------------
const colorMap = new Map(Object.entries({
  "#252423": t.text.primary,
  "#605E5C": t.text.secondary,
  "#E8E8E8": t.surface.border,
  "#F3F2F1": t.chrome.gridline,
  "#F9F9F8": t.surface.alt,
  "#FFFFFF": t.surface.card,
}));
const fontMap = new Map(Object.entries({
  "Segoe UI Variable, Segoe UI, sans-serif": t.typography.body,
  "Segoe UI Semibold": t.typography.semibold,
}));
const remap = (node) => {
  if (Array.isArray(node)) return node.map(remap);
  if (node && typeof node === "object") return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, remap(v)]));
  if (typeof node === "string") return HEX.test(node) ? colorMap.get(node.toUpperCase()) ?? node : fontMap.get(node) ?? node;
  return node;
};

// Microsoft's base theme sets three cardVisual container properties that
// powerbi-report-author 0.5.0 rejects in a theme (border.radius, spacing.customizeSpacing,
// padding sides). Drop them so the theme validates; the "*" defaults still apply.
// Re-check when the CLI or the base theme is updated.
const visualStyles = remap(base.visualStyles);
const card = visualStyles.cardVisual?.["*"];
if (card) {
  delete card.padding;
  card.border = card.border?.map(({ radius, ...rest }) => rest);
  card.spacing = card.spacing?.map(({ customizeSpacing, ...rest }) => rest);
}

const solid = (color) => ({ solid: { color } });
const theme = {
  $schema: base.$schema,
  name: "",
  dataColors: t.categorical,
  good: t.semantic.good,
  neutral: t.semantic.warning,
  bad: t.semantic.bad,
  maximum: t.sequential.max,
  center: t.diverging.center,
  minimum: t.sequential.min,
  null: t.null,
  foreground: t.text.primary,
  foregroundNeutralSecondary: t.text.secondary,
  background: t.surface.card,
  tableAccent: t.brand.primary,
  textClasses: (() => {
    const classes = remap(base.textClasses);
    // Optional: visual titles in a brand heading color (e.g. BrilliT heading navy)
    if (HEX.test(t.text.heading ?? "") && classes.title) classes.title.color = t.text.heading;
    return classes;
  })(),
  visualStyles: {
    ...visualStyles,
    page: {
      "*": {
        background: [{ color: solid(t.surface.page), transparency: 0 }],
        outspace: [{ color: solid(t.surface.page), transparency: 0 }],
      },
    },
  },
};

const stem = t.name.replace(/[^A-Za-z0-9]+/g, "");
const hash = createHash("sha256").update(JSON.stringify(theme)).digest("hex").slice(0, 8);
const fileName = `${stem}-${hash}.json`;
theme.name = fileName;

// Replace earlier builds of the same theme so only the current file remains.
const previous = new RegExp(`^${stem}-[0-9a-f]{8}\\.json$`);
for (const f of readdirSync(here)) if (previous.test(f) && f !== fileName) unlinkSync(join(here, f));

const outPath = join(here, fileName);
writeFileSync(outPath, JSON.stringify(theme, null, 2) + "\n");
console.log(`Wrote ${outPath}`);
console.log(`Register it as "${fileName}" in report.json (themeCollection.customTheme and RegisteredResources).`);
for (const w of warnings) console.log(`note: ${w}`);
