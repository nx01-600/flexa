import { BadRequestException } from '@nestjs/common';
import { csvUpload, exceedsVariance, parseAmount } from './util.js';

describe('parseAmount', () => {
  it.each([
    ['1.500.000', 1500000],
    ['1500000', 1500000],
    ['1500000.50', 1500001],
    ['1500000,4', 1500000],
    ['1500000,5', 1500001],
    ['1,500,000.75', 1500001],
    ['1.500.000,25', 1500000],
    ['-5.000', -5000],
    ['103000.00', 103000],
    ['7,5', 8],
    ['$ 1.500.000', 1500000],
    ['1.500.000 COP', 1500000],
    ['  $2,000,000  ', 2000000],
    ['1.500', 1500],
    ['1500,000', 1500000],
    ['-0', 0],
    [1500000.5, 1500001],
    [1500000, 1500000],
    [-3000, -3000],
  ])('%j -> %j', (raw, expected) => {
    expect(parseAmount(raw)).toBe(expected);
  });

  it.each(['abc', '', '   ', '-', '$', '1.5.0', '1,5.3,4', '1.2,3.4', '12a', '1 2 x', '--5', '1e5', '.5'])('%j -> null', (raw) => {
    expect(parseAmount(raw)).toBeNull();
  });

  it.each([null, undefined, {}, [], true, NaN, Infinity])('non-amount %j -> null', (raw) => {
    expect(parseAmount(raw)).toBeNull();
  });

  it('keeps decimals when asked (overtime hours)', () => {
    expect(parseAmount('2,5', 1)).toBe(2.5);
    expect(parseAmount('2.25', 1)).toBe(2.3);
    expect(parseAmount(7.5, 1)).toBe(7.5);
  });

  it('rejects values that do not fit a safe integer', () => {
    expect(parseAmount('99999999999999999999')).toBeNull();
  });
});

describe('exceedsVariance', () => {
  it('flags moves above 30 % in either direction', () => {
    expect(exceedsVariance(1_400_000, 1_000_000)).toBe(true);
    expect(exceedsVariance(600_000, 1_000_000)).toBe(true);
  });

  it('allows up to 30 % and an unchanged salary', () => {
    expect(exceedsVariance(1_300_000, 1_000_000)).toBe(false);
    expect(exceedsVariance(700_000, 1_000_000)).toBe(false);
    expect(exceedsVariance(1_000_000, 1_000_000)).toBe(false);
  });

  it('has nothing to compare against when the registered salary is 0', () => {
    expect(exceedsVariance(5_000_000, 0)).toBe(false);
  });

  it('catches the x10 / x100 misparse the old num() produced', () => {
    expect(exceedsVariance(150_000_050, 1_500_000)).toBe(true);
  });
});

describe('csvUpload.fileFilter', () => {
  const run = (originalname: string, mimetype: string) => {
    let result: { error: Error | null; accept: boolean } | undefined;
    csvUpload.fileFilter(null, { originalname, mimetype }, (error, accept) => (result = { error, accept }));
    return result!;
  };

  it('accepts a .csv with a csv-like mimetype', () => {
    expect(run('nomina.CSV', 'text/csv')).toEqual({ error: null, accept: true });
    expect(run('nomina.csv', 'application/vnd.ms-excel').accept).toBe(true);
  });

  it('rejects other extensions and mimetypes with a 400', () => {
    for (const [name, mime] of [['nomina.xlsx', 'text/csv'], ['nomina.csv', 'image/png'], ['nomina.csv.exe', 'text/csv'], ['nomina', 'text/csv']]) {
      const r = run(name, mime);
      expect(r.accept).toBe(false);
      expect(r.error).toBeInstanceOf(BadRequestException);
    }
  });

  it('caps the file at 5 MB', () => {
    expect(csvUpload.limits.fileSize).toBe(5 * 1024 * 1024);
  });
});
