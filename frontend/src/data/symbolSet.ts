// 80 visually distinct symbols for pattern charts
// Ordered by readability: letters first, then shapes
export const SYMBOL_SET: string[] = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J',
  'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T',
  'U', 'V', 'W', 'X', 'Y', 'Z',
  'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j',
  'k', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u',
  'v', 'w', 'x', 'y', 'z',
  '+', '*', '#', '@', '&', '%', '=', '~',
  '/', '\\', '<', '>', '^', '!', '?', '$',
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
];

export type ViewMode = 'color' | 'symbol' | 'combined';

// Build a map of DMC number -> symbol from an ordered list of unique DMC numbers
export function assignSymbols(dmcNumbers: string[]): Map<string, string> {
  const map = new Map<string, string>();
  for (let i = 0; i < dmcNumbers.length; i++) {
    map.set(dmcNumbers[i], SYMBOL_SET[i % SYMBOL_SET.length]);
  }
  return map;
}
