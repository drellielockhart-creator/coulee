import { describe, expect, it } from 'vitest';
import { packJson, unpackJson } from './serialization.ts';

describe('lossless save encoding', () => {
  it('round trips repeated trees without aliasing and accepts plain legacy JSON', () => {
    const original = {
      a: { text: 'remembered', values: [1, -1, null, true] },
      b: { text: 'remembered', values: [1, -1, null, true] },
    };
    const decoded = unpackJson<typeof original>(JSON.parse(JSON.stringify(packJson(original))));
    expect(decoded).toEqual(original);
    decoded.a.values[0] = 42;
    expect(decoded.b.values[0]).toBe(1);
    expect(unpackJson(original)).toEqual(original);
  });
  it('rejects forward or cyclic references', () => {
    expect(() => unpackJson({ format: 'coulee.packed-json.v1', shapes: [], nodes: [[-1, 0]], root: 0 })).toThrow(
      'Invalid packed save reference',
    );
  });
});
