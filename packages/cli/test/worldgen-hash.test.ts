import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { sha256 } from '../../worldgen/src/hash.ts';

it.each([
  '',
  'abc',
  'a'.repeat(55),
  'a'.repeat(56),
  'a'.repeat(64),
  'a'.repeat(1000),
  'Sølvklokke — Jørgen 🌲',
  '\ud800',
])('SHA-256 matches the authored loader for %j', (text) => {
  expect(sha256(text)).toBe(createHash('sha256').update(text).digest('hex'));
});
