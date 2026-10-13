# Director D0 measurement contract

D0 writes only `World.director`. It makes no RNG draws, pins, nudges, or actor Commands.
The seven nonzero-budget personality records are dormant; only `land_itself` can be selected.
Foresight (`off`, `tiltable`, `full`) is saved configuration with no behavioral branch.

## Tension

The seven terms use 05 §8.4 weights: 22/18/20/15/8/7/10. Owning modules expose read APIs.
This checkout has vigor/wounds and warmth needs rather than a separate HP/core-temperature
or disease model, so physical danger uses lost vigor, wounds, warmth deficit, nearby grudge
holders and hostile tactical participants. Survival takes the maximum of need deficit,
scurvy and the P8 planner's food pressure. No missing subsystem is invented.

Food pressure is `max(0, floor((30 - daysOfFoodTenths) * 1000 / 30))`, capped at 1000.
The planner uses the actor's currently accessible holder (home pantry or carried kit),
current ration and the existing meal/preparation/storage kernels. A three-day horizon is
sufficient. If other survival terms already dominate a shorter food horizon, projection
stops there: `ceil(3 * (1000 - otherPressure) / 1000)` days. This preserves the **maximum**
exactly; the bounded food result alone is not an independent days-of-food readout.
The API uses a transient inventory pass, never a saved planning cache.

Belief supplies grudges targeting the actor, their household or an attached Figure;
persecution uses `[0,50,150,300,500,800,1000]`, multiplied by `1 + heat/1000` and clamped.
Social pressure adds ten points per grudge-intensity point, rung pressure and up to 500
points of outstanding cents. Economic pressure is the uncovered share of positive
creditor balances. The current ledger has no separate due-date schedule for this query.
Pinned hostile pursuit decreases with route minutes, with half weight off-site where
co-presence does not confirm knowledge of the PC's location. Fae intensity contributes
200 points per intensity level. Inner pressure reads anxiety directly.

The fixed-point EMA state preserves fractional progress as integers. The two Q16 alpha
samples are 10061 (6h) and 389 (7d), computed offline. The proposed general `decayQ16`
table does not exist in this checkout; D0 supplies only the required literals. Both
averages start at the first measured sample, avoiding an artificial zero-tension opening.

Land Itself's observational classifier uses RELAX 7 days, peak threshold 700 and a 12h
peak. FADE requires 12 consecutive hours below 300 before returning to RELAX. These
thresholds classify the pure sim; a long BUILD is a measurement, not an instruction to
manufacture a peak. The other personality curves are unused in D0.

## Knowledge and notability

CLI all-AI runs observe the fixture's `scenario.player`, without changing `meta.playerId`,
controller or agency. Play uses its actual PC. Director and play share social's fair
perception gate, including event-order movement, private events and hidden defenses.

An hour is dead air if no perceived, non-Chronicle event with positive base importance
reaches the Chronicle Journal threshold through `scoreStory` (notoriety, PC involvement,
and crowded-week fatigue included). Repeat suppression is excluded: it controls prose
selection, not whether an event happened. A dead-air day is a complete 24-hour measurement
block with no such event; a quiet hour is counted even if another hour that day was notable.
Longest consecutive quiet hours is also reported. This is an operational salience metric,
not a claim that a player found the hour boring. Reading already-known journal text does
not restart the clock.

## Threads, guns, and retention

Chronicle patterns own an optional `openState` projection. The engine sends it to the
Director after each accepted fact and at closure, before Chronicle buffers can be evicted.
This captures partial matches as well as prose milestones. Roles, stakes and questions
are observations of those patterns. Prose templates and output selection are unchanged.
Unmatched threads start Latent; seeing a planted gun can make them Foreshadowed; detector
milestones become Active and Climax. Repayment, accepted/refused proposal and charm disposal
are explicit endings. Other matched stories resolve when their detector closes them;
unmatched closures and unpaid debt closures are Abandoned. Threads inactive for 120 days
also become Abandoned, including those dropped from Chronicle's bounded working buffers.

Guns are positive-event threats, loans/duns, courtship overtures, accusations, rumor tellings
and charm arrivals/losses in the corresponding patterns. Windows are 1–30 days (debt uses
its content overdue window). A later consequence in the same pattern can fire a gun;
this is conservative pattern-local linkage, not a causal claim about every cross-pattern
rumor. Seen means fair perception or an event-linked PC memory, never “public somewhere.”
Expired-unseen counts visibility **at expiry**, even if someone later learns the event.
Callbacks link high-salience (>=600) PC memories to the other participants or planted event;
merely sharing the PC does not make two unrelated experiences a callback.

Interest follows 05 §8.6's `/10` formula, including zero implausibility. Ripeness is linearly
interpolated through days 0/7/21/60/90 with values 0/1000/1000/200/0. Novelty recovers over
30 days since another thread of that pattern opened. Repetition rises by 250 per resolution
in 30 days, capped at 1000. Mode fit is neutral 500 because this runtime has no adventurer/
witch run-mode selector. The report retains the ten highest **daily scores attained**, plus
a separate current top ten open threads. Interest is not a per-mille value; it may exceed
1000 or be negative, as specified by the formula.

Director tension events use an independent, 168-hour journal with local IDs. Adding them
to the shared log would shift causal IDs and violate D0's hard invariance rule. The Ledger
retains 90 daily assessments, with older row counts and permanent monthly aggregates.
Closed threads compact after 90 days only after all gun windows finish. Pattern/gun totals,
recency, monthly statistics and the all-time top ten survive this compaction. Saves retain
all remaining records; an absent Director slice in a legacy save initializes on restoration.
No fair observation exposes any of this state. God observations, CLI manifests and
`coulee director report --run <dir>` do.
