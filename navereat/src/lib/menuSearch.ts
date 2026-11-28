import type { MenuItem } from '../data/demo';
import type { MenuGroup } from '../components/menu/menuTypes';

/**
 * Search scoring ported from restaurant-shell.html (Nearbite 0cca76b:
 * ssNorm / ssWords / ssDist / ssFuzzyWord / ssSearch / ssHighlight).
 */
export interface SearchEntry {
  item: MenuItem;
  category: string;
  categoryIndex: number;
  price: number;
  original: number | null;
  desc: string;
  badge: string;
  popular: boolean;
  nameN: string;
  descN: string;
  catN: string;
  nameW: string[];
  restW: string[];
  order: number;
}

export const norm = (value: unknown): string =>
  String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const words = (value: string): string[] => value.split(/[\s\-_,.&/()+:;!?'"]+/).filter(Boolean);

const isEgg = (item: MenuItem): boolean =>
  (item as MenuItem & { isEgg?: boolean; egg?: boolean; diet?: string }).isEgg === true ||
  (item as MenuItem & { egg?: boolean }).egg === true ||
  (item as MenuItem & { diet?: string }).diet === 'egg';

/** Edit distance where swapping two neighbouring letters counts as one mistake. */
export function distance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const al = a.length;
  const bl = b.length;
  let prev2: number[] | null = null;
  let prev = new Array<number>(bl + 1);
  let cur = new Array<number>(bl + 1);
  for (let j = 0; j <= bl; j += 1) prev[j] = j;
  for (let i = 1; i <= al; i += 1) {
    cur[0] = i;
    let rowMin = cur[0];
    for (let j = 1; j <= bl; j += 1) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      let value = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a.charCodeAt(i - 1) === b.charCodeAt(j - 2) && a.charCodeAt(i - 2) === b.charCodeAt(j - 1)) {
        value = Math.min(value, (prev2 as number[])[j - 2] + 1);
      }
      cur[j] = value;
      if (value < rowMin) rowMin = value;
    }
    if (rowMin > max) return max + 1;
    prev2 = prev;
    prev = cur;
    cur = new Array<number>(bl + 1);
  }
  return prev[bl];
}

export function fuzzyWord(token: string, candidates: string[]): boolean {
  const max = token.length >= 8 ? 2 : token.length >= 4 ? 1 : 0;
  if (!max) return false;
  return candidates.some(
    (word) =>
      distance(token, word, max) <= max ||
      (word.length > token.length && distance(token, word.slice(0, token.length), max) <= max),
  );
}

export function buildEntries(groups: MenuGroup[]): SearchEntry[] {
  const entries: SearchEntry[] = [];
  let order = 0;
  groups.forEach((group, categoryIndex) => {
    group.items.forEach((item) => {
      const price = Number(item.price) || 0;
      const rawOriginal = Number(item.originalPrice);
      const original = Number.isFinite(rawOriginal) && rawOriginal > price ? rawOriginal : null;
      const badge = item.bestseller ? 'Bestseller' : '';
      entries.push({
        item,
        category: group.name,
        categoryIndex,
        price,
        original,
        desc: item.desc ?? '',
        badge,
        popular:
          item.bestseller === true || /best.?seller|popular|must try|reorder/i.test(String(badge)),
        nameN: norm(item.name),
        descN: norm(item.desc ?? ''),
        catN: norm(group.name),
        nameW: words(norm(item.name)),
        restW: words(`${norm(item.desc ?? '')} ${norm(group.name)}`),
        order: order++,
      });
    });
  });
  return entries;
}

export type Diet = 'veg' | 'nonveg' | null;

export function visible(entries: SearchEntry[], diet: Diet): SearchEntry[] {
  if (!diet) return entries;
  return entries.filter(({ item }) => {
    if (typeof item.isVeg !== 'boolean') return false;
    if (isEgg(item)) return false;
    return diet === 'veg' ? item.isVeg === true : item.isVeg === false;
  });
}

export interface SearchResult {
  list: SearchEntry[];
  fuzzy: boolean;
  tokens: string[];
}

export function search(entries: SearchEntry[], query: string, diet: Diet): SearchResult {
  const qn = norm(query);
  const tokens = qn.split(' ').filter(Boolean);
  if (!tokens.length) return { list: [], fuzzy: false, tokens };
  const pool = visible(entries, diet);

  const run = (useFuzzy: boolean): SearchEntry[] => {
    const scored: { entry: SearchEntry; score: number }[] = [];
    pool.forEach((entry) => {
      let total = 0;
      for (const token of tokens) {
        let score: number;
        if (entry.nameN.startsWith(token)) score = 0;
        else if (` ${entry.nameN}`.includes(` ${token}`)) score = 1;
        else if (entry.nameN.includes(token)) score = 2;
        else if (` ${entry.catN} ${entry.descN}`.includes(token)) score = 3;
        else if (useFuzzy && fuzzyWord(token, entry.nameW)) score = 4;
        else if (useFuzzy && fuzzyWord(token, entry.restW)) score = 5;
        else return;
        total += score;
      }
      let score = total / tokens.length;
      if (entry.nameN.startsWith(qn)) score = -1;
      scored.push({ entry, score });
    });
    scored.sort((a, b) => a.score - b.score || a.entry.order - b.entry.order);
    return scored.map(({ entry }) => entry);
  };

  let list = run(false);
  const fuzzy = list.length === 0;
  if (fuzzy) list = run(true);
  return { list, fuzzy: fuzzy && list.length > 0, tokens };
}

export interface HighlightPart {
  text: string;
  match: boolean;
}

/** The typed letters inside a dish name, as renderable pieces (no HTML). */
export function highlight(name: string, tokens: string[], fuzzy: boolean): HighlightPart[] {
  const lower = name.toLowerCase();
  if (!tokens.length || lower.length !== name.length) return [{ text: name, match: false }];
  const marks = new Array<boolean>(name.length).fill(false);
  tokens.forEach((token) => {
    if (!token) return;
    let index = lower.indexOf(token);
    let found = false;
    while (index !== -1) {
      found = true;
      for (let k = index; k < index + token.length; k += 1) marks[k] = true;
      index = lower.indexOf(token, index + token.length);
    }
    if (found || !fuzzy) return;
    const max = token.length >= 8 ? 2 : token.length >= 4 ? 1 : 0;
    if (!max) return;
    const re = /[^\s\-_,.&/()+:;!?'"]+/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(lower))) {
      const candidate = match[0];
      let length = 0;
      if (distance(token, candidate, max) <= max) length = candidate.length;
      else if (candidate.length > token.length && distance(token, candidate.slice(0, token.length), max) <= max) {
        length = token.length;
      }
      if (length) {
        for (let k = match.index; k < match.index + length; k += 1) marks[k] = true;
        break;
      }
    }
  });
  const parts: HighlightPart[] = [];
  name.split('').forEach((char, index) => {
    const last = parts[parts.length - 1];
    if (last && last.match === marks[index]) last.text += char;
    else parts.push({ text: char, match: marks[index] });
  });
  return parts;
}
