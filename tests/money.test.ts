import { describe, expect, it } from 'vitest';
import { formatINR, formatPaise, lineTotal, parseAmount, sumPaise, toDecimalString, toPaise } from '@/lib/money';
import { csvCell, toCSV } from '@/lib/csv';
import { addDays, startOfWeek, todayIST } from '@/lib/dates';

describe('money', () => {
  it('parses user input exactly', () => {
    expect(parseAmount('150')).toBe(15000);
    expect(parseAmount('1,250.5')).toBe(125050);
    expect(parseAmount('₹ 99.99')).toBe(9999);
    expect(parseAmount('0.1')).toBe(10);
  });
  it('rejects invalid input', () => {
    for (const bad of ['', 'abc', '-5', '1.234', '1..2', '123456789', '.']) expect(parseAmount(bad)).toBeNull();
  });
  it('never drifts like floating point', () => {
    expect(sumPaise([parseAmount('0.1')!, parseAmount('0.2')!])).toBe(30);
    expect(toDecimalString(sumPaise([10, 20]))).toBe('0.30');
  });
  it('formats rupees with Indian grouping', () => {
    expect(formatPaise(125000000)).toBe('₹12,50,000');
    expect(formatINR(1250.5)).toBe('₹1,250.50');
    expect(formatINR('300')).toBe('₹300');
  });
  it('converts DB numerics', () => { expect(toPaise(19.99)).toBe(1999); expect(toPaise('0.07')).toBe(7); expect(toPaise(null)).toBe(0); });
  it('item-wise example from the brief totals ₹100', () => {
    const total = sumPaise([lineTotal(2, 3000), lineTotal(1, 2000), lineTotal(2, 1000)]);
    expect(total).toBe(10000);
  });
  it('rounds line totals half-up like the database', () => { expect(lineTotal(0.5, 5)).toBe(3); expect(lineTotal(1.5, 1999)).toBe(2999); });
  it('decimal strings are exact', () => { expect(toDecimalString(15050)).toBe('150.50'); expect(toDecimalString(-5)).toBe('-0.05'); });
});

describe('ledger arithmetic (mirrors DB scenarios 1-5)', () => {
  it('Ravi: 100 + 200 − 150 + 50 = 200', () => {
    let out = 0; for (const d of [100, 200, -150, 50]) out += d * 100; expect(formatPaise(out)).toBe('₹200');
  });
});

describe('csv', () => {
  it('escapes quotes, commas and newlines', () => { expect(csvCell('a,"b"\nc')).toBe('"a,""b"" c"'); });
  it('neutralises spreadsheet formulas but keeps numbers', () => { expect(csvCell('=SUM(A1)')).toBe("'=SUM(A1)"); expect(csvCell(-5)).toBe('-5'); });
  it('keeps Tamil intact', () => { expect(toCSV(['பெயர்'], [['ரவி']])).toBe('பெயர்\r\nரவி'); });
});

describe('dates (Asia/Kolkata)', () => {
  it('uses the India day, not UTC', () => { expect(todayIST(new Date('2026-10-30T19:00:00Z'))).toBe('2026-10-31'); });
  it('adds days across month ends', () => { expect(addDays('2026-10-31', 1)).toBe('2026-11-01'); });
  it('week starts Monday', () => { expect(startOfWeek('2026-10-30')).toBe('2026-10-26'); });
});
