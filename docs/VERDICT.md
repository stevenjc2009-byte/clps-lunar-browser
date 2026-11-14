# Verdict rules

Code: `frontend/src/lib/verdict.ts`. Tests: `frontend/src/lib/verdict.test.ts` (the table below is its `CASES` list).
The verdict is a pure function of the rows shown on the page. The same inputs always give the same badges, stars and sentences.
It does not depend on site ids or on how many sites there are.

## Inputs, one row per compared site

| Field | Meaning |
|---|---|
| `sunPct` | Share of the window with the Sun visible (upper limb by default), 0.1 % rounded. |
| `commsPct` | Link % (Earth visible and a DSN dish sees the Moon at 10° or more). This is Earth % when DSN is off or not loaded. |
| `dark` | Longest night overlapping the window, counted in full. Status is `exact`, or `at_least` when the night touches either edge of the loaded data. |
| `terrain` | Whether a LOLA horizon was used. `false` means the flat-horizon fallback. |

## Rules

Margins are compared on the 0.1-rounded values that the cards show.

| Badge | Winner if | Otherwise |
|---|---|---|
| Best for energy | Highest `sunPct`, and at least **2.0 points** above the runner-up. | `comparable`: every site within 2 points of the leader is in the group. |
| Best for communication | Highest `commsPct`, and at least **2.0 points** above the runner-up. | `comparable` (same group rule). |
| Shortest night | Shortest *exact* night, at least **24 h** shorter than every other exact night. No `at_least` night may be shorter than leader + 24 h: its real length is unknown and could be shorter. | Two or more exact nights within 24 h of the leader: `comparable`. Otherwise, if a censored night blocks the call: `undetermined`. If every night is censored: `undetermined`. |
| Balanced | Highest worst-case score, at least **2.0 points** above the runner-up, **and** at least **25** out of 100 (audit B2). | Best score under 25: `below_floor`. Margin under 2: `comparable`. |

- **Worst-case score** = min(Sun %, comms %, night score).
- **Night score** = 100 · (1 − hours / 708.7 h), where 708.7 h is one synodic month, clamped to 0–100. An `at_least` night scores 0.
- These are fixed references. A site's score never depends on which other sites are on the page.
- **Single site**: every rule is `single` and no badges are given.

## Derived outputs

- `badges[id]`: the rules this site won. A site can hold several badges.
- `stars`: the winners of energy, comms and night, shown on that row of the card. Stars are exactly the winners, so a starred card always has a badge. A censored night never gets a star.
- `cardState[id]`:
  - `badged` if the site has any badge;
  - `close` if it is in any `comparable` or `undetermined` group (shown as "Too close to call");
  - `none` otherwise.
- `provisional`: true if any compared site uses the flat horizon. A sentence names those sites with the spec 6.4 warning: "Terrain data not loaded: flat-horizon approximation, not reliable for ranking."
- `sentences`: one per rule, quoting the numbers that decided it, plus the provisional sentence. The page shows them under "Why these labels". The `comparable` and `undetermined` ones also appear in the caveats banner.

## Snapshot table (mirrors `CASES`)

D = 24 h. A row is (Sun %, comms %, night). `*` marks an `at_least` night. All rows use terrain unless marked flat.

| # | Case | Rows | Expected |
|---|---|---|---|
| 1 | Clear winners on every rule | a (80, 30, 5D), b (40, 90, 12D), c (60, 60, 2D) | energy a; comms b; night c; balanced c |
| 2 | Near-tie on Sun (1.9 pts) | a (52.0, 30, 5D), b (50.1, 90, 12D) | energy comparable |
| 3 | Lead of exactly 2.0 pts counts | a (52.1, 30, 5D), b (50.1, 90, 12D) | energy a |
| 4 | Exact tie on comms | a (80, 70, 5D), b (40, 70, 12D) | comms comparable |
| 5 | Night: exact vs exact, 1 day apart | a (50, 50, 10D), b (50, 50, 11D) | night a |
| 6 | Night: exact vs exact, 23 h apart | a 10D, b 10D+23 h | night comparable |
| 7 | Night: exact tie | a 10D, b 10D | night comparable |
| 8 | Night: censored bound already ≥ 1 day longer | a 10D, b 12D* | night a |
| 9 | Night: censored with a shorter bound | a 10D, b 17 h* | night undetermined |
| 10 | Night: censored bound within 1 day | a 10D, b 10D+5 h* | night undetermined |
| 11 | Night: censored vs censored | a 10D*, b 30D* | night undetermined |
| 12 | Two close exact nights plus one censored blocker | a 10D, b 10D+3 h, c 2 h* | night comparable |
| 13 | Single site | a (90, 90, 1 h) | every rule single, no badges |
| 14 | Balanced below the floor (B2) | a (10, 90, 5D), b (11, 12, 5D), c (30, 14, 5D) | balanced below_floor |
| 15 | Censored night scores 0 in the worst case | a (60, 60, 2D*), b (55, 55, 10D) | balanced b |
| 16 | All flat | a (80, 30, 5D, flat), b (40, 90, 12D, flat) | energy a; comms b; provisional |
| 17 | Seven sites, six within 2 pts on Sun | a 50, b 49.5, c 49, d 48.6, e 48.5, f 48.1, g 20 | energy comparable, group a–f; g is `none` |

Other tests in the same file check:

- stars are exactly the winners;
- a censored night is never starred;
- group sentences name every member;
- sentences quote the deciding numbers;
- the provisional sentence wording;
- the comms wording (DSN link vs Earth only);
- scores are independent of the other sites;
- removing a site outside every group changes no outcome.

`frontend/src/lib/ported.test.ts` also checks that one site can hold all four badges.
