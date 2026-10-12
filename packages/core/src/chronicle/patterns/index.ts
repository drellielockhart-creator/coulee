/**
 * Registry of story-pattern detectors (05 §9.2). OWNER: module:chronicle.
 *
 * Order matters only for rendering ties: patterns see every fact, in this order.
 */
import { betrayal } from './betrayal.ts';
import { charm } from './charm.ts';
import { courtship } from './courtship.ts';
import { debt } from './debt.ts';
import { defenseFired } from './defense_fired.ts';
import { faekinSuspicion } from './faekin.ts';
import { feud } from './feud.ts';
import { friendship } from './friendship.ts';
import { kindness } from './kindness.ts';
import { reversal } from './reversal.ts';
import { scapegoat } from './scapegoat.ts';
import { shortage } from './shortage.ts';
import type { PatternDef } from './types.ts';
import { whispers } from './whispers.ts';

export const PATTERNS: readonly PatternDef[] = [
  feud,
  betrayal,
  friendship,
  courtship,
  debt,
  reversal,
  shortage,
  scapegoat,
  whispers,
  faekinSuspicion,
  defenseFired,
  kindness,
  charm,
];
