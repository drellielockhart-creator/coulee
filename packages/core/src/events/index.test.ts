import { expect, it } from 'vitest';
import type { Explain } from '../explain.ts';
import { asActorId, asEventId } from '../ids.ts';
import { asGameMinute } from '../time.ts';
import { appendEvent, type EventInput, emptyLog } from './index.ts';

it('detaches nested payloads, roles, causes and Explains before normalizing', () => {
  const explain: Explain = {
    kind: 'choice',
    label: 'probe',
    subjects: [asActorId(1)],
    knowledge: 'self',
    terms: [{ source: 'other', label: 'live reason', value: -0.1 }],
    total: -0.1,
    outcome: 'chosen',
  };
  const input: EventInput = {
    kind: 'core.command',
    roles: [{ actor: asActorId(1), role: 'agent' }],
    causes: [asEventId(1)],
    data: {
      command: { kind: 'core.urge', actorId: asActorId(1), data: { urge: { kind: 'activity', activityId: 'sleep' } } },
    },
    explain: { ...explain, children: [explain] },
  };
  const log = emptyLog();
  appendEvent(log, input, asGameMinute(0));
  const saved = JSON.stringify(log.events);
  expect(explain.total).toBe(-0.1);
  if (input.data.command.kind === 'core.urge' && input.data.command.data.urge.kind === 'activity')
    input.data.command.data.urge.activityId = 'work';
  input.roles?.push({ actor: asActorId(2), role: 'witness' });
  input.causes?.push(asEventId(2));
  explain.subjects.push(asActorId(2));
  if (explain.terms[0]) explain.terms[0].label = 'rewritten';
  explain.terms.push({ source: 'psyche', label: 'decay', value: -1 });
  expect(JSON.stringify(log.events)).toBe(saved);
  expect(log.events[0]?.explain?.children?.[0]?.total).toBe(0);
});
