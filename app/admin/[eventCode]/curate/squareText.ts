const PLACEHOLDER_RE = /^Q\d+:\s*picked/i;

export const SQUARE_TEXT_MAX = 36;

export function isPlaceholderSquareText(s: string): boolean {
  return PLACEHOLDER_RE.test(s.trim());
}
