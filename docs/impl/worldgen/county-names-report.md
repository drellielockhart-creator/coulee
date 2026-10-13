# County v3 names: one qualifier

Collision handling keeps any qualifier inherited from a creek and applies at most one geographic qualifier to an unqualified base. It tries alternative local and family bases, then possessive surnames, surname/landmark holdings, and full founder names for large windows. Founders remain naming templates; no census actors are created. No numeric labels or stacked compass/elevation adjectives are used.

Feature names are reserved before settlement naming, so settlements cannot duplicate a named valley. The generator's QA rejects repeated/empty feature or settlement names and more than one qualifier. All candidate ordering remains deterministic and uses the existing family deal; no shared random stream is advanced.

The county naming functions are separate from the standalone town namer. County-derived town context intentionally receives the corrected county labels and aggregate county hash.

Validation: `just test packages/cli/test/county.test.ts` sweeps county seeds 1–64 in both presets and tests 500 forced mill-name collisions, including an inherited `Upper Silver Creek` base. Scratch before/after audits compare all six layer hashes, names-stripped settlement/feature/graph payloads, and complete standalone town output for seeds 1–50 (including 30-day QA). Results below count name occurrences, not distinct names across different counties; uniqueness is required within each county.

## Seeds 1–64, both presets

| Preset | Settlements | Features | Duplicate full names, before → after | Names with 2+ qualifiers, before → after |
| --- | ---: | ---: | ---: | ---: |
| coulee | 1,385 | 9,614 | 245 → 0 | 553 → 0 |
| river | 1,441 | 9,614 | 241 → 0 | 553 → 0 |

All **22,054** settlement/feature name occurrences across **128** counties pass. Duplicates include settlement/valley overlaps; names repeated in different counties are permitted. The ordinary matrix did not need possessive fallbacks; the forced-collision test exercises those paths.

## Hash audit

Compared with the original branch baseline at `fea9d18`, terrain, hydrology, ecology and fae hashes are identical in all 128 counties. Settlement-layer hashes (which include named features), route-layer hashes (which include node names), and aggregate county hashes change in all 128. Names-stripped settlement, feature and complete graph payload hashes are identical in all 128: IDs, cells, founding families, feature associations, routes and costs are unchanged. Recipe and layer versions are unchanged so this naming correction does not reseed placement or roads. The QA report adds a feature-name check and expands the settlement-name check.

## Twenty most common shapes

A shape records the literal qualifier, family versus geographic/vegetation landmark base, and final suffix. Counts cover both presets and include settlements, creeks and valleys. Equal counts sort alphabetically.

| Shape | Occurrences |
| --- | ---: |
| Upper + landmark + Creek | 1,694 |
| Little + family + Creek | 1,664 |
| North + family + Creek | 1,664 |
| South + family + Creek | 1,664 |
| family + Creek | 1,664 |
| West + family + Creek | 1,636 |
| East + family + Creek | 1,586 |
| Upper + family + Creek | 1,380 |
| family + Valley | 1,319 |
| landmark + Creek | 1,098 |
| South + landmark + Creek | 830 |
| Little + landmark + Creek | 794 |
| East + landmark + Creek | 784 |
| West + landmark + Creek | 742 |
| North + landmark + Creek | 698 |
| landmark + Valley | 644 |
| Upper + landmark + Valley | 330 |
| family + Ford | 256 |
| Lower + landmark + Creek | 226 |
| family + Prairie | 186 |

## Sample of thirty names

Deterministic distinct names from the audit, including settlements and geographic features.

1. Trevenna Ford
2. Upper Plum Landing
3. Willow Mills
4. Kvale Diggings
5. Whitcomb Prairie
6. Penhallow Landing
7. Glover Ford
8. Stoughton Ridge
9. Haugen Ford
10. Upper Silver Landing
11. Upper Hasp Valley
12. West Limestone Valley
13. Upper Lead Valley
14. Upper Silver Creek
15. Upper Silver Valley
16. Upper Rush Creek
17. Upper Rush Valley
18. Upper Hasp Creek
19. East Willow Creek
20. Bluff Valley
21. Tveit Valley
22. Trevenna Valley
23. Brenner Valley
24. Bell Valley
25. Pratt Valley
26. Whitcomb Valley
27. Penhallow Valley
28. Kettle Creek
29. Kettle Valley
30. Willow Creek

## Standalone town audit

Default `gen:town` (coulee preset), seeds **1–50**: **50/50 byte-identical complete output hashes**, including the normal 30-day playtest/QA output. The standalone namer is not shared with the county namer. No town files or golden chronicles changed.

## Gate

`just check` **passed**: 80 test files, 830 tests, lint, all package/script typechecks, invariants (235 files), and content validation (110 files). A fresh worktree needed `just bundle` first: the initial gate's 18 worker-test failures were all the absent generated `@coulee/content/bundle.json?url`; rebuilding the ignored bundle resolved them. No web or content source was changed.

Tracked files touched: `packages/worldgen/src/county/names.ts`, `packages/worldgen/src/county/qa.ts`, `packages/cli/test/county.test.ts`, and this report. Audit script, baseline/after JSON and logs live under ignored `runs/scratch/`. No commit made.
