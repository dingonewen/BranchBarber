/* Catppuccin Latte palette — single source of truth */
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
  // Extended Latte colors for branch coloring
  sky:      "#04a5e5",
  sapphire: "#209fb5",
  pink:     "#ea76cb",
  peach:    "#fe640b",
  maroon:   "#e64553",
  flamingo: "#dd7878",
};

// Branch color palette — column 0 = main branch, each +1 = one branch right.
// Cycles after running out.
const BRANCH_PALETTE = [
  C.mauve,    // col 0 — main
  C.blue,     // col 1
  C.teal,     // col 2
  C.green,    // col 3
  C.peach,    // col 4
  C.pink,     // col 5
  C.sapphire, // col 6
  C.maroon,   // col 7
];

const NODE_W = 240;

/** Returns the branch color for a given node position. */
export function branchColor(posX: number): string {
  const col = Math.max(0, Math.round(posX / NODE_W));
  return BRANCH_PALETTE[col % BRANCH_PALETTE.length];
}

/** Slightly transparent background tint from a branch color. */
export function branchBg(posX: number): string {
  const col = Math.max(0, Math.round(posX / NODE_W));
  // Alternate soft backgrounds per column
  const bgs = [
    "#f0eeff", // mauve tint
    "#eef3ff", // blue tint
    "#edfcfc", // teal tint
    "#edfcf0", // green tint
    "#fff4ec", // peach tint
    "#fef0f8", // pink tint
    "#edf5ff", // sapphire tint
    "#fff0f0", // maroon tint
  ];
  return bgs[col % bgs.length];
}
