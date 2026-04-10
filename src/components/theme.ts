/* Catppuccin Latte palette */
export const C = {
  base:     "#eff1f5",
  mantle:   "#e6e9ef",
  crust:    "#dce0e8",
  surface0: "#ccd0da",
  surface1: "#bcc0cc",
  surface2: "#acb0be",
  overlay0: "#9ca0b0",
  overlay1: "#8c8fa1",
  subtext0: "#6c6f85",
  subtext1: "#5c5f77",
  text:     "#4c4f69",
  mauve:    "#8839ef",
  blue:     "#1e66f5",
  green:    "#40a02b",
  yellow:   "#df8e1d",
  red:      "#d20f39",
  teal:     "#179299",
  lavender: "#7287fd",
  sky:      "#04a5e5",
  sapphire: "#209fb5",
  pink:     "#ea76cb",
  peach:    "#fe640b",
  maroon:   "#e64553",
  flamingo: "#dd7878",
};

/* Catppuccin Mocha palette */
export const CM = {
  base:     "#1e1e2e",
  mantle:   "#181825",
  crust:    "#11111b",
  surface0: "#313244",
  surface1: "#45475a",
  surface2: "#585b70",
  overlay0: "#6c7086",
  overlay1: "#7f849c",
  subtext0: "#a6adc8",
  subtext1: "#bac2de",
  text:     "#cdd6f4",
  mauve:    "#cba6f7",
  blue:     "#89b4fa",
  green:    "#a6e3a1",
  yellow:   "#f9e2af",
  red:      "#f38ba8",
  teal:     "#94e2d5",
  lavender: "#b4befe",
  sky:      "#89dceb",
  sapphire: "#74c7ec",
  pink:     "#f5c2e7",
  peach:    "#fab387",
  maroon:   "#eba0ac",
  flamingo: "#f2cdcd",
};

/** Returns the active palette based on dark mode flag. */
export function tc(dark: boolean) { return dark ? CM : C; }

const BRANCH_PALETTE_LIGHT = [C.mauve, C.blue, C.teal, C.green, C.peach, C.pink, C.sapphire, C.maroon];
const BRANCH_PALETTE_DARK  = [CM.mauve, CM.blue, CM.teal, CM.green, CM.peach, CM.pink, CM.sapphire, CM.maroon];

const NODE_W = 240;

/** Returns the branch color for a given node position. */
export function branchColor(posX: number, dark = false): string {
  const col = Math.max(0, Math.round(posX / NODE_W));
  return (dark ? BRANCH_PALETTE_DARK : BRANCH_PALETTE_LIGHT)[col % 8];
}

/** Slightly transparent background tint for a node. */
export function branchBg(posX: number, dark = false): string {
  const col = Math.max(0, Math.round(posX / NODE_W));
  const lightBgs = [
    "#f0eeff", "#eef3ff", "#edfcfc", "#edfcf0",
    "#fff4ec", "#fef0f8", "#edf5ff", "#fff0f0",
  ];
  const darkBgs = [
    "#2a2040", "#1e2845", "#1a3535", "#1a3028",
    "#3a2820", "#3a2038", "#1a2838", "#3a2028",
  ];
  return (dark ? darkBgs : lightBgs)[col % 8];
}
