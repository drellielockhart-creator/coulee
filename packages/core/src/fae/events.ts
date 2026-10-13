import type { EventOf } from '../events/base.ts';
import type { ActorId, HouseholdId, ItemId, PlaceId } from '../ids.ts';
/** How a charm left the story (13 §6.6). */
export type CharmDisposal = 'buried' | 'destroyed' | 'returned';
export type FaeEvent =
  | EventOf<'fae.refused', { actorId: ActorId; signId: string; reason: string }>
  | EventOf<
      'fae.omen',
      { signId: string; placeId: PlaceId; family: string; text: string; witnesses: ActorId[]; truth: 'fae' | 'mundane' }
    >
  | EventOf<'fae.investigated', { signId: string; actorId: ActorId; found: boolean; text: string }>
  | EventOf<'fae.read', { signId: string; actorId: ActorId; text: string }>
  // ---- charms (slice 1b, 13 §7.2) ----
  /** Someone came upon a charm (Found). The finder knows; the truth of it is omniscient. */
  | EventOf<'fae.charm_arrived', { itemId: ItemId; charm: string; finderId: ActorId; placeId: PlaceId; text: string }>
  /** A use or its result was witnessed (at most one per charm per day, plus the holder's first). */
  | EventOf<
      'fae.charm_used',
      {
        itemId: ItemId;
        charm: string;
        keeperId: ActorId | null;
        placeId: PlaceId | null;
        witnesses: ActorId[];
        text: string;
      }
    >
  /** A dawn draw (omniscient: nobody knows until a count, a shortage or a trace finds it). */
  | EventOf<
      'fae.charm_drew',
      {
        itemId: ItemId;
        charm: string;
        def: string;
        qty: number;
        source: string;
        householdId: HouseholdId | null;
        placeId: PlaceId;
      }
    >
  /** Tied for the night, an offering set out, hung in the dew, thanked aloud. */
  | EventOf<
      'fae.charm_tended',
      {
        itemId: ItemId;
        charm: string;
        actorId: ActorId;
        act: 'tie' | 'offering' | 'hang' | 'thank' | 'stow';
        text: string;
      }
    >
  | EventOf<
      'fae.charm_recharged',
      { itemId: ItemId; charm: string; actorId: ActorId | null; amount: number; text: string }
    >
  /** Someone learned a true fact by inspection, study or a traced shortfall. */
  | EventOf<
      'fae.charm_revealed',
      { itemId: ItemId; charm: string; actorId: ActorId; facts: string[]; text: string; householdId?: HouseholdId }
    >
  | EventOf<
      'fae.charm_disposed',
      { itemId: ItemId; charm: string; actorId: ActorId; kind: CharmDisposal; placeId: PlaceId; text: string }
    >
  /** A count or a shortage found flour missing (13 §5.2); public to the household. */
  | EventOf<
      'fae.shortfall',
      {
        householdId: HouseholdId;
        actorId: ActorId;
        def: string;
        units: number;
        first: boolean;
        trigger: 'count' | 'shortage' | 'trace';
        misfortuneId: number | null;
        text: string;
      }
    >
  /** A count that found nothing amiss (private to the counter). */
  | EventOf<'fae.stock_counted', { householdId: HouseholdId; actorId: ActorId; placeId: PlaceId; text: string }>
  | EventOf<'fae.charm_refused', { actorId: ActorId; itemId: ItemId | null; command: string; reason: string }>
  /** A keeper turned a neighbor away (wave 6): the keeper's duty-guilt (inner) and the count so far. */
  | EventOf<
      'fae.turned_away',
      { itemId: ItemId; keeperId: ActorId; askerId: ActorId; guilt: number; refusals: number; text: string }
    >;
