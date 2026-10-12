# P8 catalog transcription notes

The current coverage test follows 03 §6.1–6.14, including cookware, packaging, food and the replacement horn arrows and English scraper. `arrows_flint_dozen` and `knapped_flint_blade` remain compatibility ids for saved inventories; their definitions now describe horn arrows and an imported English scraper. Current kits and coverage use the new ids.

Prices are the catalog's reference retail prices. The tin canister and oilcloth bag were corrected from 120/60 cents to 30/15 cents; the crock and brine keg were corrected to 40/75 cents. Store markup and shunning are separate, explained transaction modifiers.

Existing scenario quantities mean pounds of potatoes and individual eggs. These ids retain those units: potatoes cost 1 cent/lb rather than the catalog's 10 cents/15-lb peck; eggs cost 1 cent each rather than 10 cents/dozen. Integer cents cannot represent those per-unit fractions. Egg energy, mass and protein are rounded per egg. The reflector's bake magnitude 0.75 is represented as 0.8 in the one-decimal affordance schema. Container bulk is external occupied space: soft bags expand, and rigid containers have at least their declared internal capacity.

Cookware and food have their full nutrition, keeping, wetness and preparation fields. Beans retain the authored four-hour quick-boil variant (30 active minutes), rather than the catalog's overnight soaking recipe; salt cod likewise retains its authored preparation variant. These are deliberate preparation differences, not changes to their listed keeping nutrition. General preservation work remains a later crafting feature.

Conditional catalog behaviors still need their crafting/environment actions: wet-moss creel cooling, rubber cracking below 0°F, tobacco wet ruin/keeping, and lard as a frying ingredient’s morale bonus. The current rows provide the goods, capacities, supplies and nutrition; tags/copy for those conditional behaviors are descriptive until those actions exist.
