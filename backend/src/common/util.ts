import { randomInt } from 'node:crypto';

export const DAY = 86_400_000;

export const code = (prefix: string) =>
  `${prefix}-${Date.now().toString(36).toUpperCase()}${randomInt(100, 999)}`;

export const floorTo = (n: number, step = 1000) => Math.max(0, Math.floor(n / step) * step);

export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export const daysBetween = (a: Date, b: Date) =>
  Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / DAY);

export const sum = <T>(items: T[], pick: (t: T) => number) =>
  items.reduce((acc, t) => acc + pick(t), 0);

export const pct = (part: number, total: number) => (total ? Math.round((part / total) * 1000) / 10 : 0);

// Minimal CSV: comma or semicolon separated, first row is the header, quoted fields allowed.
export function parseCsv(text: string): Record<string, string>[] {
  const lines = text
    .replace(/^﻿/, '')
    .split(/\r?\n/)
    .filter((l) => l.trim());
  if (!lines.length) return [];
  const sep = lines[0].includes(';') ? ';' : ',';
  const split = (line: string) => {
    const out: string[] = [];
    let cur = '';
    let quoted = false;
    for (const ch of line) {
      if (ch === '"') quoted = !quoted;
      else if (ch === sep && !quoted) {
        out.push(cur.trim());
        cur = '';
      } else cur += ch;
    }
    out.push(cur.trim());
    return out;
  };
  const header = split(lines[0]).map((h) => h.toLowerCase());
  return lines.slice(1).map((line) => {
    const cells = split(line);
    return Object.fromEntries(header.map((h, i) => [h, cells[i] ?? '']));
  });
}

export function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return '';
  const header = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v instanceof Date ? v.toISOString() : String(v ?? '');
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [header.join(','), ...rows.map((r) => header.map((h) => esc(r[h])).join(','))].join('\n');
}
