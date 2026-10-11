import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  asGameMinute,
  calendarAt,
  civilFromDays,
  dayLengthMinutes,
  daysFromCivil,
  formatDate,
  formatStamp,
  moonAt,
  parseGameDate,
  toGameMinute,
  weekdayOf,
  yearsBetween,
} from './time.ts';

describe('calendar', () => {
  it('epoch is Sunday 1855-04-01 00:00', () => {
    const c = calendarAt(asGameMinute(0));
    expect([c.year, c.month, c.day, c.hour, c.weekday, c.season, c.isSabbath]).toEqual([
      1855,
      4,
      1,
      0,
      'sun',
      'spring',
      true,
    ]);
    expect(formatDate(asGameMinute(0))).toBe('Sunday, the 1st of April, 1855');
  });

  it('civil <-> days round-trips (property)', () => {
    fc.assert(
      fc.property(fc.integer({ min: -200_000, max: 200_000 }), (d) => {
        const { year, month, day } = civilFromDays(d);
        return daysFromCivil(year, month, day) === d;
      }),
    );
  });

  it('handles leap years and negative minutes', () => {
    expect(formatStamp(toGameMinute(1856, 2, 29, 13, 5))).toBe('1856-02-29 13:05');
    expect(formatStamp(toGameMinute(1857, 3, 1))).toBe('1857-03-01 00:00');
    const before = asGameMinute(-1);
    expect(formatStamp(before)).toBe('1855-03-31 23:59');
    expect(weekdayOf(before)).toBe('sat');
    expect(parseGameDate('1855-07-04T12:30')).toBe(toGameMinute(1855, 7, 4, 12, 30));
  });

  it('weekday advances one per day', () => {
    expect(weekdayOf(toGameMinute(1855, 4, 2))).toBe('mon');
    expect(weekdayOf(toGameMinute(1855, 7, 4))).toBe('wed'); // July 4, 1855 was a Wednesday
  });

  it('ages', () => {
    expect(yearsBetween(toGameMinute(1803, 5, 1), toGameMinute(1855, 4, 1))).toBe(51);
    expect(yearsBetween(toGameMinute(1803, 3, 1), toGameMinute(1855, 4, 1))).toBe(52);
  });
});

describe('moon', () => {
  it('new moon mid-April 1855, full moon around April 1-2 and May 1', () => {
    expect(moonAt(toGameMinute(1855, 4, 16, 14)).phase).toBe('new');
    expect(moonAt(toGameMinute(1855, 4, 1, 12)).phase).toBe('full');
    expect(moonAt(toGameMinute(1855, 5, 1, 12)).phase).toBe('full');
    expect(moonAt(toGameMinute(1855, 4, 23, 12)).phase).toBe('first_quarter');
  });

  it('illumination is 0..1000 and peaks at full', () => {
    const full = moonAt(toGameMinute(1855, 5, 1, 12)).illuminationPermille;
    const nw = moonAt(toGameMinute(1855, 4, 16, 14)).illuminationPermille;
    expect(full).toBeGreaterThan(950);
    expect(nw).toBeLessThan(50);
  });
});

describe('daylight', () => {
  it('matches 05 §4.2 anchors', () => {
    expect(dayLengthMinutes(1855, 6, 21)).toBeGreaterThan(900);
    expect(dayLengthMinutes(1855, 12, 21)).toBeLessThan(560);
    expect(Math.abs(dayLengthMinutes(1855, 3, 20) - 720)).toBeLessThan(10);
    const c = calendarAt(toGameMinute(1855, 6, 21, 12));
    expect(c.isDaylight).toBe(true);
    expect(calendarAt(toGameMinute(1855, 12, 21, 6)).isDaylight).toBe(false);
  });
});
