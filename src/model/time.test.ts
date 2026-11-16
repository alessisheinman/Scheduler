import { describe, expect, test } from 'vitest';
import { formatHours, formatShift, formatTime, parseShift, parseTime, shiftHours } from './time';

describe('parseShift', () => {
  test('reads plain and spaced shifts', () => {
    expect(parseShift('7AM-9PM')).toEqual({ start: 420, end: 1260 });
    expect(parseShift('7:30am - 10:30PM')).toEqual({ start: 450, end: 1350 });
    expect(parseShift('12PM-12AM')).toEqual({ start: 720, end: 0 });
  });

  test.each([
    '9PAM-9PM', '10AM-8P', '5:30-9PM', '6:30AM-5:PM', '500AM-9PM', '5AM6PM', '\\', '7AM-9AM 5PM-9PM', '7AM-7AM', '',
  ])('rejects %j in strict mode', (text) => {
    expect(parseShift(text)).toBeNull();
  });
});

describe('parseTime', () => {
  test('strict mode needs AM or PM', () => {
    expect(parseTime('7p')).toBeNull();
    expect(parseTime('7')).toBeNull();
    expect(parseTime('12AM')).toBe(0);
    expect(parseTime('12pm')).toBe(720);
  });

  test('lenient mode accepts short forms for typing', () => {
    expect(parseTime('7p', { lenient: true })).toBe(1140);
    expect(parseTime('7:30p', { lenient: true })).toBe(1170);
    expect(parseTime('7', { lenient: true })).toBe(420);
    expect(parseTime('12', { lenient: true })).toBe(720);
    expect(parseTime('3', { lenient: true })).toBe(900);
    expect(parseTime('13', { lenient: true })).toBeNull();
  });
});

describe('shiftHours', () => {
  test('same-day shift', () => expect(shiftHours(420, 1260)).toBe(14));
  test('ends at midnight', () => expect(shiftHours(960, 0)).toBe(8));
  test('noon to midnight', () => expect(shiftHours(720, 0)).toBe(12));
  test('starts at midnight', () => expect(shiftHours(0, 480)).toBe(8));
  test('crosses midnight', () => expect(shiftHours(480, 240)).toBe(20));
  test('quarter hours', () => expect(shiftHours(465, 1260)).toBe(13.25));
});

describe('formatting', () => {
  test('times', () => {
    expect(formatTime(0)).toBe('12AM');
    expect(formatTime(720)).toBe('12PM');
    expect(formatTime(450)).toBe('7:30AM');
    expect(formatTime(1305)).toBe('9:45PM');
  });
  test('shift', () => expect(formatShift(450, 0)).toBe('7:30AM-12AM'));
  test('hours', () => {
    expect(formatHours(13.25)).toBe('13.25');
    expect(formatHours(14)).toBe('14');
    expect(formatHours(0.1 + 0.2)).toBe('0.3');
  });
});
