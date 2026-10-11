import { describe, expect, it } from 'vitest';
import { rng } from '../rng.ts';
import { buildTemplateIndex, expand, renderTemplate, type TemplateIndex, tidy, whenMatches } from './prose.ts';
import { joinList, moneyText, numberWord, tallWord } from './text.ts';

const index: TemplateIndex = {
  byOn: {
    'x.y': [
      { id: 'a', on: 'x.y', voice: 'paper', min_importance: 0, when: {}, text: ['plain {actor}.'] },
      {
        id: 'b',
        on: 'x.y',
        voice: 'paper',
        min_importance: 0,
        when: { success: true },
        text: ['{^actor} won{_at}.', 'it was a win for {actor}.'],
        headline: 'Won{_at}',
      },
      {
        id: 'c',
        on: 'x.y',
        voice: 'journal',
        min_importance: 50,
        tone: 'piety',
        when: {},
        text: ['I prayed.'],
      },
    ],
  },
  lexicon: { greet: ['Hail', 'Well met'], deep: ['#greet# friend'] },
};

describe('prose engine', () => {
  it('fills slots, capitalizes, and drops empty optional slots with their space', () => {
    expect(expand('{^actor} won{_at}.', { actor: 'gussie' }, index, rng(1, 'chronicle', 0, 1))).toBe('Gussie won.');
    expect(expand('{^actor} won{_at}.', { actor: 'gussie', at: 'at the mill' }, index, rng(1, 'chronicle', 0, 1))).toBe(
      'Gussie won at the mill.',
    );
  });

  it('expands inline alternatives and nested lexicon deterministically', () => {
    const a = expand('#deep#, {a|b|c}.', {}, index, rng(7, 'chronicle', 5, 9));
    const b = expand('#deep#, {a|b|c}.', {}, index, rng(7, 'chronicle', 5, 9));
    expect(a).toBe(b);
    expect(a).toMatch(/^(Hail|Well met) friend, [abc]\.$/);
  });

  it('capitalizes after a sentence end and tidies spacing', () => {
    expect(tidy('one  thing .  and another , ,fine')).toBe('One thing. And another,fine');
    expect(tidy('He said "no." a thing followed.')).toBe('He said "no." A thing followed.');
  });

  it('chooses the most specific template whose conditions hold', () => {
    const v: Record<string, number> = {};
    const win = renderTemplate(
      index,
      rng(1, 'chronicle', 0, 3),
      v,
      'x.y',
      'paper',
      10,
      { actor: 'a', success: true },
      null,
    );
    expect(win?.templateId).toBe('b');
    expect(win?.headline).toBe('Won');
    const plain = renderTemplate(
      index,
      rng(1, 'chronicle', 0, 3),
      v,
      'x.y',
      'paper',
      10,
      { actor: 'a', success: false },
      null,
    );
    expect(plain?.templateId).toBe('a');
  });

  it('honors min_importance and tone, and returns null when nothing fits', () => {
    const v: Record<string, number> = {};
    expect(renderTemplate(index, rng(1, 'chronicle', 0, 1), v, 'x.y', 'journal', 10, {}, 'piety')).toBeNull();
    expect(renderTemplate(index, rng(1, 'chronicle', 0, 1), v, 'x.y', 'journal', 60, {}, 'piety')?.text).toBe(
      'I prayed.',
    );
    expect(renderTemplate(index, rng(1, 'chronicle', 0, 1), v, 'x.y', 'journal', 60, {}, null)).toBeNull();
    expect(renderTemplate(index, rng(1, 'chronicle', 0, 1), v, 'nope', 'paper', 60, {}, null)).toBeNull();
  });

  it('does not repeat the same variant twice in a row', () => {
    const v: Record<string, number> = {};
    const seen: string[] = [];
    for (let i = 0; i < 12; i++) {
      seen.push(
        renderTemplate(index, rng(3, 'chronicle', i, 1), v, 'x.y', 'paper', 10, { actor: 'a', success: true }, null)
          ?.text ?? '',
      );
    }
    for (let i = 1; i < seen.length; i++) expect(seen[i]).not.toBe(seen[i - 1]);
  });

  it('matches when-conditions on strings, numbers, booleans and lists', () => {
    expect(whenMatches({ level: 2 }, { level: 2 })).toBe(true);
    expect(whenMatches({ level: [2, 3] }, { level: 3 })).toBe(true);
    expect(whenMatches({ level: [2, 3] }, { level: 4 })).toBe(false);
    expect(whenMatches({ across: false }, {})).toBe(true);
    expect(whenMatches({ across: true }, {})).toBe(false);
    expect(whenMatches({ cls: 'harm' }, { cls: 'help' })).toBe(false);
  });

  it('builds an index sorted by id from a bundle-shaped object', () => {
    const idx = buildTemplateIndex({
      chronicleTemplates: {
        z: { id: 'z', on: 'k', voice: 'paper', min_importance: 0, when: {}, text: ['z'] },
        a: { id: 'a', on: 'k', voice: 'paper', min_importance: 0, when: {}, text: ['a'] },
      },
      chronicleLexicon: { w: { id: 'w', words: ['x'] } },
    } as never);
    expect(idx.byOn.k?.map((t) => t.id)).toEqual(['a', 'z']);
    expect(idx.lexicon.w).toEqual(['x']);
  });
});

describe('period text helpers', () => {
  it('writes numbers, money and lists in period style', () => {
    expect(numberWord(3)).toBe('three');
    expect(numberWord(40)).toBe('forty');
    expect(numberWord(26)).toBe('twenty-six');
    expect(numberWord(140)).toBe('140');
    expect(tallWord(3)).toBe('half a dozen');
    expect(moneyText(35)).toBe('35¢');
    expect(moneyText(420)).toBe('$4.20');
    expect(joinList(['a', 'b', 'c'])).toBe('a, b and c');
  });
});
