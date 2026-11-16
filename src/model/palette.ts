/** Soft fills that stay readable under near-black text and look different from each other. */
export const VENUE_PALETTE: string[] = [
  '#a9c8f5', // blue
  '#b7e4a8', // green
  '#f5a9a9', // red
  '#e3b3f0', // purple
  '#f7e08a', // yellow
  '#9edcd6', // teal
  '#f8c58c', // orange
  '#c9c3f2', // lavender
  '#e2cfa8', // sand
  '#c8f0c0', // mint
  '#f6bfd7', // rose
  '#b9c9d8', // gray-blue
];

export function suggestVenueColor(used: string[]): string {
  const taken = new Set(used.map((c) => c.toLowerCase()));
  return VENUE_PALETTE.find((c) => !taken.has(c)) ?? VENUE_PALETTE[used.length % VENUE_PALETTE.length];
}
