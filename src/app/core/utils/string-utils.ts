export function normalizeName(name: string | null | undefined): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/^(dra?|psic|lic|ing|arq|mtra?)\.?\s+/i, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim();
}

export function areNamesEquivalent(name1: string | null | undefined, name2: string | null | undefined): boolean {
  if (!name1 || !name2) return false;

  const norm1 = normalizeName(name1);
  const norm2 = normalizeName(name2);

  if (norm1 === norm2) return true;

  const filterTokens = (tokens: string[]) => tokens.filter((t) => t.length > 0);

  const t1 = filterTokens(norm1.split(/\s+/));
  const t2 = filterTokens(norm2.split(/\s+/));

  const set1 = new Set(t1);
  const set2 = new Set(t2);

  const t1IsSubset = t1.every((token) => set2.has(token));
  const t2IsSubset = t2.every((token) => set1.has(token));

  return t1IsSubset || t2IsSubset;
}
