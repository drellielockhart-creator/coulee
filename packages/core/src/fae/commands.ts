import type { CommandOf } from '../command.ts';
import type { ItemId } from '../ids.ts';

/** Charm Commands (13 §7.2): each is the same act an NPC's arbitration can choose. */
type ItemCommand<K extends string> = CommandOf<K, { itemId: ItemId }>;
export type FaeCommand =
  | CommandOf<'fae.investigate', { signId: string }>
  | CommandOf<'fae.signs', Record<string, never>>
  /** Use a charm: tie the Never-Empty Sack for the night. */
  | ItemCommand<'fae.use'>
  /** Set out its offering (porridge and butter, overnight at your hearth). */
  | ItemCommand<'fae.recharge'>
  /** Thank it aloud (an `unthanked` charm sulks a moon). */
  | ItemCommand<'fae.thank'>
  | ItemCommand<'fae.inspect'>
  | ItemCommand<'fae.study'>
  /** Pick up a charm you found lying where it was. */
  | ItemCommand<'fae.take'>
  | ItemCommand<'fae.bury'>
  | ItemCommand<'fae.destroy'>
  /** Give it back to the Good Neighbors where tribute is kept. */
  | ItemCommand<'fae.return'>
  /** Put it away with your household's stores, or take it out of them. */
  | ItemCommand<'fae.stow'>
  | ItemCommand<'fae.fetch'>
  /** Count the stock where you stand against the book. */
  | CommandOf<'fae.count', Record<string, never>>;
