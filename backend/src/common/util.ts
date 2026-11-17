import { BadRequestException } from '@nestjs/common';
import { randomInt } from 'node:crypto';

export const DAY = 86_400_000;

// Largest value an Int column holds; anything above would fail in Postgres.
export const INT_MAX = 2_147_483_647;

export const code = (prefix: string) =>
  `${prefix}-${Date.now().toString(36).toUpperCase()}${randomInt(100, 999)}`;

export const floorTo = (n: number, step = 1000) => Math.max(0, Math.floor(n / step) * step);

export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export const daysBetween = (a: Date, b: Date) =>
  Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / DAY);

export const sum = <T>(items: T[], pick: (t: T) => number) =>
  items.reduce((acc, t) => acc + pick(t), 0);

export const pct = (part: number, total: number) => (total ? Math.round((part / total) * 1000) / 10 : 0);

// Parses a money amount typed by a person or an ERP: "$ 1.500.000", "1,500,000.75", "1.500.000,25", 1500000.5.
// Returns pesos rounded to `decimals` (0 = integer column), or null when it cannot be read without guessing.
export function parseAmount(raw: unknown, decimals = 0): number | null {
  let n: number;
  if (typeof raw === 'number') n = raw;
  else if (typeof raw === 'string') {
    const t = raw.trim().replace(/\$|\s|cop/gi, '');
    const neg = t.startsWith('-');
    const s = neg ? t.slice(1) : t;
    const dots = s.split('.').length - 1;
    const commas = s.split(',').length - 1;
    // Decimal separator: the last one when both appear; a lone one unless it is followed by exactly 3 digits.
    let dec = '';
    if (dots && commas) dec = s.lastIndexOf('.') > s.lastIndexOf(',') ? '.' : ',';
    else if (dots + commas === 1 && !/^\d+[.,]\d{3}$/.test(s)) dec = dots ? '.' : ',';
    const [int, frac = '', ...extra] = dec ? s.split(dec) : [s];
    // What is left in the integer part must be plain digits or well-formed thousands groups of one separator.
    if (extra.length || !/^(?:\d+|\d+([.,])\d{3}(?:\1\d{3})*)$/.test(int) || !/^\d*$/.test(frac)) return null;
    n = Number(`${int.replace(/[.,]/g, '')}.${frac || '0'}`);
    if (neg) n = -n;
  } else return null;
  if (!Number.isFinite(n)) return null;
  const f = 10 ** decimals;
  const r = Math.round(n * f) / f;
  // `+ 0` turns -0 into 0.
  return Number.isSafeInteger(r * f) ? r + 0 : null;
}

// True when `next` moves more than `limit` (30 % by default) away from `current`; no baseline means nothing to compare.
export const exceedsVariance = (next: number, current: number, limit = 0.3) =>
  current > 0 && Math.abs(next - current) / current > limit;

// Shared multer options for CSV uploads: 5 MB cap, .csv extension and a text-like mimetype only.
const CSV_MIMES = ['text/csv', 'application/csv', 'text/x-csv', 'application/vnd.ms-excel', 'text/plain', 'application/octet-stream'];
export const csvUpload = {
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req: unknown, file: { originalname: string; mimetype: string }, cb: (error: Error | null, accept: boolean) => void) => {
    const ok = /\.csv$/i.test(file.originalname) && CSV_MIMES.includes(file.mimetype.toLowerCase());
    cb(ok ? null : new BadRequestException('Solo se aceptan archivos CSV de hasta 5 MB'), ok);
  },
};

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
