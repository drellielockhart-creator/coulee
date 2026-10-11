# Notes - socialite gentown7
cmd0 start: 00:00 Apr 1, Wagon Bell Tavern. Here: Patrick, Honora, Johanna Sheehan, Timothy Costello. $50.
cmd1 help, cmd2 look: `look` prints no prose description, same as status block.
cmd3 inspect Ellis Wayfarer: dumps RAW JSON (~600 lines). Mind: ego/superego/id 50/50/50, no thoughts. Thirst decay -80/hr (850->0 in ~10h?!), Hunger -42/hr, Rest -55/hr.
Carrying 2 armloads of firewood (18 kg) into a tavern at start.
cmd4 "13" introduce Patrick at 01:00: "did not take place" - Patrick sleeping, but menu offers chat/introduce to sleeper. Status shows me "at home, at leisure" in a tavern.
 explain 263 provisions.shortage: "Larder horizon and ration cut: 50" - rations auto cut to 50% with 6.8 days food?
 sleep (bed $0.25). wait until 07:00 stopped at 07:00 by social.interaction; "[301] Pray > Honora: success", "[302] Chat > Honora" - who did these? ambiguous actor. Status says I am "cooking".
 journal: "It has been a day. The ration is at 50 in the hundred and the children no longer ask. That is the worst of it: they no longer ask." (I have no children?? lone traveler)
 introduce Patrick again 08:00: fail again (still sleeping at 8am).
 typed "introduce Honora Sheehan" -> "No available action matches" + just exits code 2. "talk Honora Sheehan" works -> Chat success, no content text at all. "[471] Repay > $4.38: success" unexplained.
 actions pages: 247 actions, 20/page = 13 pages; top-15 menu shows only Patrick (sleeping) social options. Rich verbs: flirt court propose gossip deep_talk confide compliment gift warn toast tell_tale comfort ask_about preach_at pray_with confess slight snub mock insult threaten fight accuse shun_lobby lend borrow repay dun.
 Absurd pack options: pack knapsack into canteen, hardtack into canteen.
 ask_about Honora 09:00->10:00: FAIL, whole tavern left for church during the hour. go church (29 people). attend_church locks hour. wait 1h - auto-ate (Meal 396 kcal cold).
 introduce Absalon Vik (pastor?) 13:00: FAIL again, he left. 4 of 6 targeted social attempts failed due to hourly resolution + NPC movement.
 chat Elijah Carter: success, no text content.
 inspect self social: opinions with reasons exist! Richard Trevenna affection -4 and Timothy -5 but only listed reason is "Introduced themselves civilly +3" -> reasons don't sum. Honora 11 vs reasons 3+0.
 Memory "Heard Patrick Sheehan telling Honora Sheehan the news" - no content of news.
 Introduction w/ Patrick recorded at t=540 (09:00) though my attempt at 08:00 said "did not take place".
 Psyche: player command = "Voices 1000 x100%" always wins; "A command holds the hour: the voices are heard, and overruled." Ego/superego static 50/50.
 gossip Elijah (15:00) FAIL. Conscience line: "You don't know that. You're only repeating it." (good!)
 introduce Marit Vik FAIL. Richard Trevenna preached at me (d20 15 +1 vs DC 13), "Cares for my soul" +respect.
 gossip Richard FAIL (he left; "Here: no one else").
 go tavern 19:00; meal $0.20; Hunger 412->578 still "Peckish". Food days jumped 6.0 -> 6.8 on arrival at tavern (?).
 ask_about Honora 20:00 SUCCESS - but NO news content. memory "Asked Honora Sheehan for the news" only. beliefs empty.
 flirt Honora 21:00 FAIL "may have left" - she's listed Here but asleep. Misleading message.
 ** "Heard: Timothy Costello is of the hidden folk" ** - rumor popped at 22:00! explain 1587 -> "That explanation is not known to your character". inspect Timothy still says people: Human.
Score so far player-initiated social: 3 success / 10 attempts.
 Day 2 (Mon). Conscience: "On the Lord's day? Let Keep house wait till Monday." deep_talk Timothy success (no content). flirt Honora FAIL again while she is awake & "working".
 FORKS (fork-flirt, fork-flirt2, fork-flirt3 at 09:00 Apr 2): chat Honora OK; compliment Honora OK (d20 10 +1 vs DC 10); flirt Johanna FAIL "did not take place"; flirt Timothy OK (16 vs DC 13).
 => flirt refusal is an eligibility rule (married? sex? kin?) masked by the generic "may have left or be unavailable" message. My sex is never shown anywhere.
 Note: --fork <dir> with a command errors "exactly one of"; fork then run separately.
 flirt Timothy main: nat 1 fail (2 vs 13). flirt again -> "did not take place" (cooldown/refusal masked). My opinion of Timothy now -6 incl. "Gave me the cold shoulder", "We talked long and honest".
 go store 12:00: "[2273] Bought 45 cornmeal for $1.35" - autonomous purchase charged to MY purse ($49.10->47.75) but cornmeal not in my inventory / plan. BUG?
 gossip Submit Crane: success; arbitration shows Gossip total 348 "chosen" while Take a meal 869 "rejected" -> player command wins but numbers presented confusingly. Nice: "-400 Conscientiousness: not gossip; -300 Benevolence: not gossip". "Call for the mail" choice annotated "+300 The pantry is nearly bare: go to the store" (label mismatch).
 belief: "Timothy Costello is of the hidden folk" credence 3, evidence 1, voiced False. Gossip "Told Submit Crane the news" - which news? no content.
 introduce Silas OK; warn Silas OK ("Warned Silas Crane" - of what? no content).
 ** Appetite surfaced: "A drink would stop my hands shaking." Raw JSON thoughts reveal great Conscience lines w/ speakers:
   Father: "There's work wanting, and you're thinking of Drink at the tavern?"
   the Pastor: "Remember the Sabbath day, to keep it holy." (on a MONDAY)
   the neighbors: "Everyone's watching. Everyone will hear of it." (Onlookers 2 +100)
   Mother: "Not one glass. You know where one glass goes."
   Mother: "Money down your throat is money gone."
   Conscience 'Daily round: Work' reason "Hired hand 550" -> I'm a hired hand?! never told whose.
  These lines only visible via raw JSON inspect; status shows one line per voice.
 Work -> moves me to Wagon Bell (I'm the tavern's hired hand, yet pay $0.25 bed & $0.20 meals?). wait until 20:00 stops every hour on social.interaction.
 drink_at_tavern 17:00: no cost. toast Timothy 18:00 success (18 vs DC 10): Purse unchanged $47.75 -> standing drinks is FREE (exploit/bug). Drink need 729->977.
 Food-days counter jumps back to 6.8 at 19:00 each evening at tavern (6.0->6.8) - odd.
 provisions.prep_failed explain: "Cannot prepare food: 0 () -> failure" - unreadable.
 accuse Timothy 19:00: success "19 () vs DC 10" (empty modifiers). What was the accusation? not stated. Then rumor event [2883] "Choose a rumor to tell: 320 (d1000 233...)": memory "Timothy Costello told me the news" + "Timothy Costello is of the hidden folk | told | fear" -> Timothy told ME he's hidden folk?? credence 3->5.
 My opinion of Timothy: -7/-4, reasons "Gave me the cold shoulder", "Had it coming" (post-hoc justification for my accusation - lovely). Anxiety 285 (real 32, neur 158, moral 95). Honora 25: "Stood by me when I was low".
 confide Honora 20:00 FAIL ("did not take place", she was Here). Then "Slight > Ellis" by Timothy.
 Overnight: Appetite: "I haven't forgotten, Timothy Costello. I won't." Conscience: "What will people say?" Self-Command: "A quick bite, then back to it"
 JOURNAL day 2-3 is the best thing in the game. Quotes:
  "Honora Sheehan came by again with something for the pot, and would not stay to be thanked. I am learning to let a gift be a gift."
  "I made eyes at Timothy Costello. Whether it was welcome I cannot tell; the face he made could be read either way."
  "It was the sensible thing; anyone would agree. I have asked myself and I agree." (11:00, after failed 2nd flirt)
  "Patrick Sheehan borrowed of Honora Sheehan ... Money passes, and so do obligations; I have begun to keep a list."
  "I had every reason for it, and I have written the reasons down so I shall not lose them. They are good ones. They read better each time." (after accusing Timothy)
  "Miss Ellis Wayfarer was seen in earnest talk with Mr. T. Costello at The Wagon Bell Tavern on Monday of an evening; there was a look of news about it." (newspaper voice)
  "Timothy Costello slighted me ... and I shall not soon forget it."
  "It is agreeable to relate that Miss Ellis Wayfarer was seen carrying relief to the door of Mrs. H. Sheehan, whose table has been poor of late."
 Journal BUGS: "I was in close talk with Submit Crane ... I would give a good deal to know the subject." - narrator doesn't know subject of her OWN conversation (x3). Duplicate pair lines for Timothy 19:00 (I with him / he with me). Same 06:00: Honora brings me food AND I carry relief to Honora - contradictory.
 Learned I'm "Miss" Ellis (female) only from journal newspaper line.
 Day 3: drink water (1 hr; thirst 390->1000). Smithy: introduce Johann, Karl OK; flirt Karl FAIL (opaque; inspect Karl shows only "keeping house"). tell_tale Johann 12 vs 12 success.
 Parsonage: introduce Marit, confess Marit OK -> memory "Unburdened my conscience to Marit Vik" (shame). Moral anxiety 95 -> 100 (confession didn't relieve it?). Total anxiety 285->194.
 Appetite now pushing Insult (at Timothy): Conscience lines: the neighbors "Is Insult any way to treat a neighbor?"; Mother "Insult? Think how it looks."; Pastor "Is Drink at the tavern how a Christian spends the Lord's time?"; Father "Daylight's for working. Drink at the tavern can wait."
 belief.grudges = [] even though Appetite says "I haven't forgotten, Timothy Costello. I won't." (inconsistent)
 insult Timothy 17:00 FAIL; mock 18:00 FAIL: Timothy "sleeping" at 18:00 (day-sleeper - fae hint?) - menu offers anyway, message says "may have left".
 lend Honora 19:00: "Lend > $1.00 success" then "[4300] Repay: $1.00 ... (Cents asked, From the purse, From the household cash) -> success" but my purse stays $46.10 (lost $1). owedFavors Honora -1. BUG? money vanished.
 OPINION LEGIBILITY BUG: Elijah Carter affection -3 with reasons +3,+3,+3 only; Johann -3 with only "Civil on first meeting +3" (after I told him a tale successfully); Submit -3 same. Totals drift negative with no listed reason. Timothy -11.
 Day 4: insult Timothy at 05:00 while he sleeps (my error; menu allows). At 07:00 he's "working"; insult -> failure "2 () vs DC 16" (empty modifiers, DC 16 unexplained).
 Journal: "Honora Sheehan settled with me ... One more account closed" -> repayment recorded but purse never got the $1 back. BUG confirmed.
 Journal: "I notice I am saying the same thing to myself over and over, in the same words. A person ought to be able to say a thing once and be done." (rumination - great)
 Journal: "I insulted Timothy Costello ... and was sorry before the day was out." (written 07:00, roll had failed)
 Journal: "Marit Vik comforted me ... and would not hear thanks. Entered here so I do not forget the debt."
 Work: 4+ hours of "work" as hired hand, never paid. Purse only declines (meals/bed).
 WAIT PROBLEM: "wait 1d" / "wait until 22:00" / "wait 2d" all stop after 1-2h with "Stopped: social.interaction". Went to empty Bellwether Spring to wait 2d -> autonomy walked me back to tavern to work after 1h and stopped. Can't fast-forward days. commands.jsonl = 120 lines at day 4 noon (queries count).
 Day 4-6: shun_lobby Honora (6 () vs DC 10 fail) - ambiguous who is being shunned. gossip Honora OK (no content). Repeated apologize to Timothy: "did not take place" x3, one real roll failed 9 vs DC 14. Repeat same interaction soon = masked failure.
 Midday sleep allowed. Chained commands while asleep -> "No available action matches".
 Journal: "More trouble between the Sheehans and the Newcomer lodgingses: two wrongs now in a day, by my count. I keep out of it, which in Iron Ford is a labor." -> BUG: "Newcomer lodgingses" (bad pluralized household name = me); narrator claims to keep out of a feud she's party to.
 Journal: "Timothy Costello forgave me ... I had meant to hold out longer; I did not have the heart to." -> perspective flipped (line is written for the forgiver).
 Appetite evolved: "I keep going over what Timothy Costello did."
 Command count 141 at day 6 07:00. --verify at 128: "Verified 128 commands; final hash 0a0416818231b0ea."
