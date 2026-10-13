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

**Cost revision:** the scheduled Director samples the complete survival term once on the
first observed hour of each game-day (and immediately on a change of focus actor), then
holds that integer observation between samples. Its actor, calendar day, minute and value
are saved in `survival_sample`, so restoring mid-day does not resample. This is measurement
state, not a cache of inventories or planner work. The other six terms, including cash and
physical danger, remain hourly. Direct `measureTension` calls without a held observation
still perform the exact projection. The latest Explain identifies the survival sample time.

This deliberately chooses daily sampling over coupling Director to household planning:
those decisions do not necessarily describe the PC's current carried kit, ration or location.
A 3-day food outlook changes slowly enough for this observational term and the 7-day slow
EMA; the 6-hour fast EMA still responds hourly to the other terms. Within-day survival changes
can appear up to 23 hours late. No claim of equality with the former hourly tension curve is
made; the [year baselines](2026-10-13-d0-baseline.md) measure the difference. P8 meal and storage kernels are unchanged.

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
This observes partial matches as well as prose milestones. Full records are admitted only
for a PC role, a planted gun, or a detector milestone. A generic pattern importance score
on an unmatched off-screen partial is not evidence of concrete stakes. Filtered partials
may be admitted later if their projection becomes relevant. Roles, stakes and questions
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
30 days from the recorded opening of the most recently admitted other thread of that pattern.
Repetition rises by 250 per retained resolution in 30 calendar days, capped at 1000; daily
per-pattern buckets bound this history. Mode fit is neutral 500 because this runtime has no
adventurer/witch run-mode selector. The report retains the ten highest **daily scores attained**, plus
a separate current top ten open threads. Interest is not a per-mille value; it may exceed
1000 or be negative, as specified by the formula.

Director tension events use slice-local IDs; only the latest full seven-term Explain is
retained. Monthly sums/maxima and the event sequence preserve the aggregate history.
Adding these events to the shared log would shift causal IDs and violate D0 invariance.
The Ledger retains seven daily assessments with compact decision Explains; older rows
compact to a count. It does not retain duplicate tension Explains. Monthly aggregates remain
permanent (one small row per calendar month).

The registry retains at most **64 total threads**, including at most **24 Latent** records.
Retention ranks PC involvement, stakes, daily interest, then ascending ID; the total limit
prefers open over closed records. Interest Explains survive for the current top ten open
threads and the all-time top ten daily peaks. Peak snapshots contain no duplicate guns.
Resolved/Abandoned records compact after **7 days**, once their gun windows finish; capacity
may compact them earlier. Each thread retains at most **8 guns**, favoring unfinished windows;
settled guns disappear after 7 days. At most eight callback references remain per thread.
These limits hold after every projection, not just at the daily assessment.

Pattern opened/resolved/abandoned totals now describe **admitted records**. Retention is not
a fictional ending: capacity removal increments `capacity_evictions`, never resolved or
abandoned. `compacted_threads` includes both normal retirement and capacity removal.
`candidates` counts first-observed monotonically allocated Chronicle IDs, including filtered
partials; `filtered_projections` counts rejected observations, not unique candidates.
A 512-ID retirement set plus a monotonically advancing retired-ID floor prevents reopening
or double-counting compacted records. Once the floor advances, an older unadmitted partial
can no longer enter; currently retained threads below the floor continue normally.

Gun totals describe admitted and retained observation windows. Capacity removal of an
unfinished gun increments `compacted_unfired_guns`, never fired or expired. Thus
`planted - fired - expired - compacted_unfired_guns` is the live retained gun count.
Seen totals stop tracking a gun when its record retires. These are bounded observation
statistics, not an exhaustive census of all world stories; compare them to the previous
unbounded baseline only with that cohort change stated. The baseline report retains the
original cost/size and describes the change in candidate coverage.

Saves retain the held survival measurement and remaining records; an absent Director slice
in a legacy save initializes on restoration. Older version-1 D0 saves lack the optional
sampling/retention fields and initialize these on their next observation. No fair observation
exposes any of this state. God observations, CLI manifests and
`coulee director report --run <dir>` do.
