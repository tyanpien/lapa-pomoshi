export function takeFirstSentences(text: string, count: number): string {
  const t = text.trim();
  if (!t || count < 1) return t;

  let pos = 0;
  for (let i = 0; i < count; i++) {
    const chunk = t.slice(pos);
    const m = chunk.search(/[.!?](\s|$)/);
    if (m === -1) {
      return t;
    }
    pos += m + 1;
    if (i === count - 1) {
      return t.slice(0, pos).trim();
    }
  }
  return t.slice(0, pos).trim();
}
