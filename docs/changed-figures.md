# Changes from the old figures to the new

Step 5 of `fixes-plan.md`. Old is database `cricket` with the old app; new is `cricket_next` with branch `stat-fixes`. Both held the same data: 9,769 matches, 4,732,062 deliveries, latest 2026-09-01. So every difference comes from the code. ♀ marks women.

## The old default players

Old → new; a single value did not change.

| Player | Format | Average | Strike rate | Boundary % | Era index |
|---|---|---|---|---|---|
| V Kohli | Test | 46.85 | 55.58 | 46.5 | 1.02 → 1.09 |
| V Kohli | ODI | 58.34 | 93.89 | 44.2 → 44.1 | 1.14 → 1.12 |
| V Kohli | T20 | 48.33 | 135.95 | 52.5 | 1.21 → 1.13 |
| RG Sharma | Test | 40.58 | 57.06 | 56.3 | 1.15 → 1.11 |
| RG Sharma | ODI | 48.25 → 48.45 | 92.42 | 56.3 → 56.2 | 1.16 → 1.10 |
| RG Sharma | T20 | 30.74 → 31.46 | 140.31 | 65.1 → 65.0 | 1.23 → 1.16 |
| KS Williamson | Test | 54.06 | 51.98 | 46.7 → 46.5 | 1.01 → 1.00 |
| KS Williamson | ODI | 47.95 → 48.28 | 81.67 | 41.8 → 41.7 | 0.98 → 0.96 |
| KS Williamson | T20 | 32.81 → 33.24 | 124.01 | 51.9 | 1.21 → 1.03 |
| SPD Smith | Test | 56.00 | 53.96 | 47.8 → 47.3 | 1.01 → 1.03 |
| SPD Smith | ODI | 42.94 | 86.91 | 42.1 → 42.0 | 1.05 → 1.02 |
| SPD Smith | T20 | 25.35 | 125.58 | 49.5 → 49.2 | 1.12 → 1.06 |

## How the changes were traced

Each old figure was rebuilt from the new tables using the old rules and compared with the old database. The fixes were then applied one at a time, in the order of the columns below, so the columns add up to the change (to rounding). A step's size depends on that order. Row 12 (players found only by exact scorecard name) is used for a related fault the table does not spell out: a player whose scorecard name changed had a separate career under each name.

| Check | Compared | Failed |
|---|---|---|
| old career rows rebuilt | 10,650 | 0 |
| career steps end at the new figures | 10,688 | 0 |
| old yearly era values rebuilt | 33,646 | 0 |
| old yearly era row count | 1 | 0 |
| old matchup rows rebuilt | 277,987 | 0 |
| matchup dismissal steps add up | 320,319 | 0 |
| old recommender batting rebuilt | 10,617 | 0 |
| old recommender bowling rebuilt | 7,939 | 0 |
| recommender batting steps end at the new figures | 10,635 | 0 |
| recommender bowling steps end at the new figures | 7,949 | 0 |
| listed careers match both apps | 79 | 0 |
| listed era values match both apps | 79 | 0 |
| listed recommender baselines match both apps | 31 | 0 |

## Reach of each fix

| Figure | Row in “What gets fixed” | Changed |
|---|---|---|
| Career batting | #1 namesakes | 124 |
| Career batting | #12 spellings | 26 |
| Career batting | #5 retirements | 212 |
| Career batting | #9 boundaries | 433 |
| Career batting | out without batting | 10 |
| Career era index | #1 namesakes | 120 |
| Career era index | #12 spellings | 25 |
| Career era index | #2 wides | 7,693 |
| Career era index | #2 men/women | 8,890 |
| Career era index | #3 weighting | 6,404 |
| Recommender batting baseline | #1 namesakes | 86 |
| Recommender batting baseline | #12 spellings | 26 |
| Recommender batting baseline | #8 hidden wides | 2 |
| Recommender batting baseline | #5 retirements | 153 |
| Recommender batting baseline | #6 non-striker | 3,346 |
| Recommender batting baseline | #7 second wicket | 2 |
| Recommender bowling baseline | #1 namesakes | 48 |
| Recommender bowling baseline | #12 spellings | 15 |
| Recommender bowling baseline | #8 extras | 394 |
| Recommender bowling baseline | #7 second wicket | 1 |
| Matchup dismissals (pairs) | #1/#12 identity | 125 |
| Matchup dismissals (pairs) | #6 non-striker out | 5,499 |
| Matchup dismissals (pairs) | #5 retirement | 166 |
| Matchup dismissals (pairs) | #4 not the bowler’s wicket | 5,959 |
| Matchup dismissals (pairs) | #7 second wicket | 1 |
| Matchup balls (pairs) | #4 wides | 65,529 |
| Matchup rows (pairs) | #4 formats mixed | 37,942 |
| Grounds | #11 spellings | 138 grounds merged; 597 spellings → 460 grounds |

“Changed” counts player and format pairs unless stated. #1: 61 scorecard names belong to two or more batters. #12: 18 players batted under more than one scorecard name, which the old app showed as separate people. Rows 10 and 13–15 change wording, notices or loading, and no figure.

“Out without batting” has no row of its own: an innings now counts for a player who was dismissed without batting or standing at the other end (for example timed out).

## Career batting

What the home, player, compare and duel screens show. “Old” is the figure shown for the player’s scorecard name.

### Runs

143 player and format pairs changed.

| Player | Format | Old | New | Change | #1 namesakes | #12 spellings |
|---|---|---|---|---|---|---|
| Steven Ryan Taylor (as “SR Taylor”) | ODI | 3,821 | 1,139 | -2,682 | -2,728 | +46 |
| Steven Ryan Taylor (as “SR Taylor”) | T20 | 3,017 | 822 | -2,195 | -2,195 |  |
| Mohammad Yousuf | ODI | 2,783 | 4,523 | +1,740 |  | +1,740 |
| Zeeshan Ali (3) (as “Zeeshan Ali”) | T20 | 1,597 | 130 | -1,467 | -1,467 |  |
| Tawananyasha Marumani (as “T Marumani”) ♀ | T20 | 1,482 | 25 | -1,457 | -1,457 |  |
| Shahid Afridi (2) (as “Shahid Afridi”) | T20 | 1,723 | 327 | -1,396 | -1,396 |  |
| NR Sciver ♀ | ODI | 2,668 | 4,013 | +1,345 |  | +1,345 |
| NR Sciver ♀ | T20 | 1,833 | 3,061 | +1,228 |  | +1,228 |
| SR Taylor ♀ | ODI | 3,821 | 2,728 | -1,093 | -1,093 |  |
| Muhammad Usman (4) (as “Muhammad Usman”) | T20 | 959 | 45 | -914 | -914 |  |

### Innings

155 player and format pairs changed.

| Player | Format | Old | New | Change | #1 namesakes | #12 spellings |
|---|---|---|---|---|---|---|
| Shahid Afridi (2) (as “Shahid Afridi”) | T20 | 110 | 23 | -87 | -87 |  |
| Steven Ryan Taylor (as “SR Taylor”) | T20 | 113 | 29 | -84 | -84 |  |
| Steven Ryan Taylor (as “SR Taylor”) | ODI | 126 | 46 | -80 | -81 | +1 |
| Tawananyasha Marumani (as “T Marumani”) ♀ | T20 | 79 | 4 | -75 | -75 |  |
| Zeeshan Ali (3) (as “Zeeshan Ali”) | T20 | 72 | 10 | -62 | -62 |  |
| Shahadat Hossain Dipu (as “Shahadat Hossain”) | Test | 73 | 12 | -61 | -61 |  |
| Mohammad Yousuf | ODI | 76 | 129 | +53 |  | +53 |
| Junaid Siddique | ODI | 95 | 45 | -50 | -50 |  |
| K Joshi | T20 | 47 | 1 | -46 | -46 |  |
| S Singh | T20 | 46 | 1 | -45 | -45 |  |

Largest from counting rules alone (same player before and after; 10 changed):

| Player | Format | Old | New | Change | out without batting |
|---|---|---|---|---|---|
| Vaishnave Mahesh ♀ | T20 | 34 | 35 | +1 | +1 |
| AD Mathews | ODI | 184 | 185 | +1 | +1 |
| ATS Silva ♀ | T20 | 5 | 6 | +1 | +1 |
| I Nandakumar ♀ | T20 | 16 | 17 | +1 | +1 |
| L Keny ♀ | T20 | 36 | 37 | +1 | +1 |

### Average

164 player and format pairs changed (of those with 500+ balls faced).

| Player | Format | Old | New | Change | #1 namesakes | #12 spellings | #5 retirements |
|---|---|---|---|---|---|---|---|
| Steven Ryan Taylor (as “SR Taylor”) | ODI | 32.66 | 24.76 | -7.90 | -8.37 | +0.47 |  |
| SR Taylor ♀ | ODI | 32.66 | 39.54 | +6.88 | +5.23 |  | +1.65 |
| Junaid Siddique | ODI | 14.36 | 20.36 | +6.00 | +6.00 |  |  |
| NR Sciver ♀ | T20 | 25.82 | 31.56 | +5.74 |  | +5.74 |  |
| A Chopra | Test | 27.63 | 33.17 | +5.54 | +5.54 |  |  |
| Mohammad Yousuf | Test | 52.72 | 48.08 | -4.64 |  | -4.64 |  |
| NR Sciver ♀ | Test | 48.89 | 45.58 | -3.31 |  | -3.31 |  |
| G Kirsten | Test | 48.69 | 51.93 | +3.24 |  |  | +3.24 |
| NR Sciver ♀ | ODI | 45.22 | 48.35 | +3.13 |  | +3.13 |  |
| Shoaib Khan | ODI | 28.33 | 31.22 | +2.89 | +2.89 |  |  |

Largest from counting rules alone (same player before and after; 143 changed):

| Player | Format | Old | New | Change | #5 retirements |
|---|---|---|---|---|---|
| G Kirsten | Test | 48.69 | 51.93 | +3.24 | +3.24 |
| T de Zorzi | ODI | 39.13 | 41.73 | +2.60 | +2.60 |
| MG Bevan | ODI | 41.94 | 44.41 | +2.47 | +2.47 |
| CD Cumming | Test | 29.14 | 31.38 | +2.24 | +2.24 |
| AB Barath | ODI | 28.14 | 30.31 | +2.17 | +2.17 |

### Strike rate

23 player and format pairs changed (of those with 500+ balls faced).

| Player | Format | Old | New | Change | #1 namesakes | #12 spellings |
|---|---|---|---|---|---|---|
| Steven Ryan Taylor (as “SR Taylor”) | T20 | 106.99 | 133.66 | +26.67 | +26.67 |  |
| Muhammad Usman | T20 | 123.90 | 113.89 | -10.01 | -10.01 |  |
| NR Sciver ♀ | T20 | 113.43 | 121.56 | +8.13 |  | +8.13 |
| L Winfield ♀ | Test | 25.07 | 32.55 | +7.48 |  | +7.48 |
| SR Taylor ♀ | T20 | 106.99 | 99.55 | -7.44 | -7.44 |  |
| NR Sciver ♀ | Test | 51.28 | 57.66 | +6.38 |  | +6.38 |
| Shahid Afridi | T20 | 158.22 | 152.57 | -5.65 | -5.65 |  |
| Steven Ryan Taylor (as “SR Taylor”) | ODI | 72.75 | 77.33 | +4.58 | +5.55 | -0.97 |
| Zeeshan Ali (2) (as “Zeeshan Ali”) | T20 | 133.19 | 137.62 | +4.43 | +4.43 |  |
| Mohammad Nawaz (3) (as “Mohammad Nawaz”) | T20 | 138.96 | 134.61 | -4.35 |  | -4.35 |

### Fours

517 player and format pairs changed.

| Player | Format | Old | New | Change | #1 namesakes | #12 spellings |
|---|---|---|---|---|---|---|
| Steven Ryan Taylor (as “SR Taylor”) | ODI | 377 | 130 | -247 | -252 | +5 |
| Steven Ryan Taylor (as “SR Taylor”) | T20 | 306 | 90 | -216 | -216 |  |
| NR Sciver ♀ | T20 | 195 | 363 | +168 |  | +168 |
| Zeeshan Ali (3) (as “Zeeshan Ali”) | T20 | 167 | 6 | -161 | -161 |  |
| NR Sciver ♀ | ODI | 281 | 434 | +153 |  | +153 |
| Tawananyasha Marumani (as “T Marumani”) ♀ | T20 | 155 | 3 | -152 | -152 |  |
| Mohammad Yousuf | ODI | 236 | 362 | +126 |  | +126 |
| SR Taylor ♀ | ODI | 377 | 252 | -125 | -125 |  |
| Shahid Afridi (2) (as “Shahid Afridi”) | T20 | 121 | 19 | -102 | -102 |  |
| Junaid Siddique (2) (as “Junaid Siddique”) | ODI | 95 | 5 | -90 | -90 |  |

Largest from counting rules alone (same player before and after; 407 changed):

| Player | Format | Old | New | Change | #9 boundaries |
|---|---|---|---|---|---|
| DA Warner | Test | 1,055 | 1,036 | -19 | -19 |
| SPD Smith | Test | 1,202 | 1,190 | -12 | -12 |
| RT Ponting | Test | 767 | 758 | -9 | -9 |
| M Labuschagne | Test | 536 | 527 | -9 | -9 |
| JE Root | Test | 1,536 | 1,528 | -8 | -8 |

### Sixes

128 player and format pairs changed.

| Player | Format | Old | New | Change | #1 namesakes |
|---|---|---|---|---|---|
| Shahid Afridi (2) (as “Shahid Afridi”) | T20 | 105 | 33 | -72 | -72 |
| Adil Butt | T20 | 57 | 0 | -57 | -57 |
| Tawananyasha Marumani (as “T Marumani”) ♀ | T20 | 54 | 0 | -54 | -54 |
| Zeeshan Ali (3) (as “Zeeshan Ali”) | T20 | 56 | 5 | -51 | -51 |
| Ahmed Hassan | T20 | 46 | 2 | -44 | -44 |
| Muhammad Usman (4) (as “Muhammad Usman”) | T20 | 41 | 3 | -38 | -38 |
| SR Taylor ♀ | T20 | 69 | 34 | -35 | -35 |
| Rupesh Kumar Singh (as “RK Singh”) | T20 | 34 | 0 | -34 | -34 |
| Steven Ryan Taylor (as “SR Taylor”) | T20 | 69 | 35 | -34 | -34 |
| Shahid Afridi | T20 | 105 | 72 | -33 | -33 |

Largest from counting rules alone (same player before and after; 42 changed):

| Player | Format | Old | New | Change | #9 boundaries |
|---|---|---|---|---|---|
| S Bau | T20 | 34 | 32 | -2 | -2 |
| V Kohli | ODI | 173 | 171 | -2 | -2 |
| Shahadat Hossain | Test | 7 | 6 | -1 | -1 |
| BOP Fernando | Test | 12 | 11 | -1 | -1 |
| Azhar Ali | Test | 23 | 22 | -1 | -1 |

### Boundary %

372 player and format pairs changed (of those with 500+ balls faced).

| Player | Format | Old | New | Change | #1 namesakes | #12 spellings | #9 boundaries |
|---|---|---|---|---|---|---|---|
| Steven Ryan Taylor (as “SR Taylor”) | T20 | 54.3 | 69.3 | +15.0 | +15.0 |  |  |
| Steven Ryan Taylor (as “SR Taylor”) | ODI | 46.4 | 58.3 | +11.9 | +12.5 | -0.6 |  |
| L Winfield ♀ | Test | 51.1 | 60.2 | +9.1 |  | +9.1 |  |
| Mohammad Nawaz (3) (as “Mohammad Nawaz”) | ODI | 53.8 | 47.4 | -6.4 |  | -6.4 |  |
| Muhammad Usman | T20 | 55.7 | 49.4 | -6.3 | -6.3 |  |  |
| SR Taylor ♀ | T20 | 54.3 | 48.7 | -5.6 | -5.6 |  |  |
| SR Taylor ♀ | ODI | 46.4 | 41.3 | -5.1 | -5.1 |  |  |
| NR Sciver ♀ | T20 | 46.5 | 51.2 | +4.7 |  | +4.7 |  |
| A Chopra | Test | 48.9 | 44.2 | -4.7 | -2.7 |  | -2.0 |
| Shahid Afridi | T20 | 64.7 | 60.2 | -4.5 | -4.5 |  |  |

Largest from counting rules alone (same player before and after; 354 changed):

| Player | Format | Old | New | Change | #9 boundaries |
|---|---|---|---|---|---|
| GA Elwiss ♀ | Test | 38.6 | 35.9 | -2.7 | -2.7 |
| RS Williams ♀ | ODI | 39.4 | 37.3 | -2.1 | -2.1 |
| RJ Harris | Test | 52.7 | 50.7 | -2.0 | -2.0 |
| A Chopra | Test | 46.2 | 44.2 | -2.0 | -2.0 |
| BJ Curran | Test | 46.5 | 44.9 | -1.6 | -1.6 |

### Not-out % (was “Survival Rate”, #10)

161 player and format pairs changed (of those with 500+ balls faced).

| Player | Format | Old | New | Change | #1 namesakes | #5 retirements |
|---|---|---|---|---|---|---|
| Junaid Siddique | ODI | 23.2 | 2.2 | -21.0 | -21.0 |  |
| SR Taylor ♀ | ODI | 7.1 | 14.8 | +7.7 | +4.0 | +3.7 |
| Steven Ryan Taylor (as “SR Taylor”) | T20 | 17.7 | 10.3 | -7.4 | -7.4 |  |
| Steven Ryan Taylor (as “SR Taylor”) | ODI | 7.1 | 0.0 | -7.1 | -7.1 |  |
| AB Barath | ODI | 0.0 | 7.1 | +7.1 |  | +7.1 |
| CD Cumming | Test | 6.7 | 13.3 | +6.6 |  | +6.6 |
| G Kirsten | Test | 0.0 | 6.3 | +6.3 |  | +6.3 |
| BJ Bennett | Test | 0.0 | 6.3 | +6.3 |  | +6.3 |
| SR Taylor ♀ | T20 | 17.7 | 23.8 | +6.1 | +2.5 | +3.6 |
| T de Zorzi | ODI | 5.9 | 11.8 | +5.9 |  | +5.9 |

Largest from counting rules alone (same player before and after; 144 changed):

| Player | Format | Old | New | Change | #5 retirements |
|---|---|---|---|---|---|
| AB Barath | ODI | 0.0 | 7.1 | +7.1 | +7.1 |
| CD Cumming | Test | 6.7 | 13.3 | +6.6 | +6.6 |
| G Kirsten | Test | 0.0 | 6.3 | +6.3 | +6.3 |
| BJ Bennett | Test | 0.0 | 6.3 | +6.3 | +6.3 |
| T de Zorzi | ODI | 5.9 | 11.8 | +5.9 | +5.9 |

### Balls per dismissal

164 player and format pairs changed (of those with 500+ balls faced).

| Player | Format | Old | New | Change | #1 namesakes | #12 spellings | #5 retirements |
|---|---|---|---|---|---|---|---|
| A Chopra | Test | 83.8 | 100.5 | +16.7 | +16.7 |  |  |
| NR Sciver ♀ | Test | 95.3 | 79.1 | -16.2 |  | -16.2 |  |
| Steven Ryan Taylor (as “SR Taylor”) | ODI | 44.9 | 32.0 | -12.9 | -13.9 | +1.0 |  |
| SR Taylor ♀ | ODI | 44.9 | 55.9 | +11.0 | +8.7 |  | +2.3 |
| Mohammad Yousuf | Test | 94.5 | 84.5 | -10.0 |  | -10.0 |  |
| Junaid Siddique | ODI | 21.1 | 29.3 | +8.2 | +8.2 |  |  |
| G Kirsten | Test | 104.8 | 111.7 | +6.9 |  |  | +6.9 |
| Steven Ryan Taylor (as “SR Taylor”) | T20 | 30.3 | 23.7 | -6.6 | -6.6 |  |  |
| CD Cumming | Test | 79.6 | 85.7 | +6.1 |  |  | +6.1 |
| L Winfield ♀ | Test | 62.5 | 56.7 | -5.8 |  | -5.8 |  |

Largest from counting rules alone (same player before and after; 143 changed):

| Player | Format | Old | New | Change | #5 retirements |
|---|---|---|---|---|---|
| G Kirsten | Test | 104.8 | 111.7 | +6.9 | +6.9 |
| CD Cumming | Test | 79.6 | 85.7 | +6.1 | +6.1 |
| NE Bonner | Test | 106.5 | 111.5 | +5.0 | +5.0 |
| C Campher | Test | 61.8 | 65.6 | +3.8 | +3.8 |
| MG Bevan | ODI | 63.4 | 67.1 | +3.7 | +3.7 |

## Era index

Old is the career value on screen: the plain mean of yearly values. Players with 500+ balls faced; 1,824 changed.

| Player | Format | Old | New | Change | #2 wides | #2 men/women | #3 weighting |
|---|---|---|---|---|---|---|---|
| Dilara Akter ♀ | T20 | 0.71 | 1.29 | +0.58 | +0.01 | +0.16 | +0.40 |
| W Hornero-Garcia ♀ | T20 | 0.59 | 1.15 | +0.56 | +0.04 | +0.14 | +0.38 |
| RJ Harris | Test | 1.76 | 1.25 | -0.51 | +0.09 | -0.01 | -0.59 |
| LC Sthalekar ♀ | Test | 0.73 | 1.23 | +0.50 |  | +0.42 | +0.08 |
| HMD Rasangika ♀ | T20 | 0.84 | 1.33 | +0.49 | +0.01 | +0.19 | +0.28 |
| MA Wood | Test | 1.86 | 1.38 | -0.48 | +0.01 | -0.01 | -0.48 |
| SJ Taylor ♀ | Test | 0.90 | 1.37 | +0.47 | -0.01 | +0.32 | +0.16 |
| EJ Villani ♀ | T20 | 0.83 | 1.28 | +0.45 |  | +0.16 | +0.28 |
| S Dharnidharka ♀ | T20 | 0.56 | 1.00 | +0.44 | +0.01 | +0.13 | +0.31 |
| HK Matthews ♀ | T20 | 0.90 | 1.34 | +0.44 |  | +0.19 | +0.24 |
| S Mtae ♀ | T20 | 0.84 | 1.25 | +0.41 | +0.04 | +0.19 | +0.17 |
| MDT Kamini ♀ | ODI | 0.59 | 0.99 | +0.40 | +0.01 | +0.14 | +0.25 |
| AJ Healy ♀ | T20 | 1.04 | 1.44 | +0.40 |  | +0.21 | +0.19 |
| MR Meshram ♀ | ODI | 0.43 | 0.83 | +0.40 | +0.01 | +0.07 | +0.33 |
| SHT Kandamby | ODI | 0.47 | 0.87 | +0.40 |  |  | +0.40 |


Largest from namesakes and spellings alone (22 changed):

| Player | Format | Old | New | Change | #1 namesakes | #12 spellings |
|---|---|---|---|---|---|---|
| Mohammad Nawaz (3) (as “Mohammad Nawaz”) | T20 | 1.50 | 1.20 | -0.30 |  | -0.30 |
| L Winfield ♀ | Test | 0.51 | 0.74 | +0.23 |  | +0.23 |
| Steven Ryan Taylor (as “SR Taylor”) | T20 | 0.99 | 1.22 | +0.23 | +0.23 |  |
| Mohammad Yousuf | Test | 1.05 | 1.27 | +0.22 |  | +0.22 |
| Mohammad Nawaz (3) (as “Mohammad Nawaz”) | ODI | 1.02 | 0.87 | -0.15 |  | -0.15 |
| Sukhdeep Singh (as “S Singh”) | T20 | 0.85 | 0.99 | +0.14 | +0.14 |  |
| Aryansh Sharma (as “A Sharma”) | ODI | 1.05 | 0.93 | -0.12 | -0.12 |  |
| NR Sciver ♀ | Test | 0.84 | 0.96 | +0.11 |  | +0.11 |
| NR Sciver ♀ | T20 | 0.98 | 1.09 | +0.11 |  | +0.11 |
| SR Taylor ♀ | T20 | 0.99 | 0.89 | -0.10 | -0.10 |  |

Largest from **#2 wides** alone:

| Player | Format | Old | New | Change | #2 wides |
|---|---|---|---|---|---|
| Afif Hossain | ODI | 1.13 | 1.25 | +0.12 | +0.12 |
| R Satheesan | T20 | 1.37 | 1.46 | +0.09 | +0.09 |
| RJ Harris | Test | 1.76 | 1.85 | +0.09 | +0.09 |
| L Barnett ♀ | T20 | 1.50 | 1.58 | +0.08 | +0.08 |
| C Magaia ♀ | T20 | 0.77 | 0.86 | +0.08 | +0.08 |

Largest from **#2 men/women** alone:

| Player | Format | Old | New | Change | #2 men/women |
|---|---|---|---|---|---|
| LC Sthalekar ♀ | Test | 0.73 | 1.15 | +0.42 | +0.42 |
| CM Edwards ♀ | Test | 0.84 | 1.25 | +0.41 | +0.41 |
| AJ Blackwell ♀ | Test | 0.70 | 1.04 | +0.34 | +0.34 |
| KA Blackwell ♀ | Test | 0.62 | 0.95 | +0.33 | +0.33 |
| L Barnett ♀ | T20 | 1.58 | 1.92 | +0.33 | +0.33 |

Largest from **#3 weighting** alone:

| Player | Format | Old | New | Change | #3 weighting |
|---|---|---|---|---|---|
| RJ Harris | Test | 1.84 | 1.25 | -0.59 | -0.59 |
| MA Wood | Test | 1.86 | 1.38 | -0.48 | -0.48 |
| Dilara Akter ♀ | T20 | 0.89 | 1.29 | +0.40 | +0.40 |
| SHT Kandamby | ODI | 0.47 | 0.87 | +0.40 | +0.40 |
| W Hornero-Garcia ♀ | T20 | 0.77 | 1.15 | +0.38 | +0.38 |

### Baselines (#2)

Runs per 100 balls. Largest changes among years with 3,000+ balls:

| Year | Format | Gender | Old (pooled, wides counted) | New | Change | Balls |
|---|---|---|---|---|---|---|
| 2018 | T20 | male | 106.47 | 133.12 | +26.65 | 16,297 |
| 2013 | T20 | female | 111.90 | 89.41 | -22.49 | 4,013 |
| 2025 | T20 | male | 96.75 | 119.16 | +22.41 | 112,438 |
| 2015 | T20 | female | 106.76 | 85.74 | -21.02 | 4,131 |
| 2015 | ODI | female | 84.87 | 64.18 | -20.69 | 5,916 |
| 2012 | T20 | female | 105.09 | 86.03 | -19.06 | 7,115 |
| 2026 | T20 | male | 101.11 | 119.44 | +18.33 | 90,469 |
| 2023 | T20 | male | 96.46 | 113.99 | +17.53 | 74,406 |
| 2019 | T20 | male | 99.63 | 116.58 | +16.95 | 45,143 |
| 2021 | T20 | female | 101.16 | 84.24 | -16.92 | 20,931 |

| Format | Old 2024 baseline | New, men | New, women |
|---|---|---|---|
| Test | 57.20 | 57.50 | 54.91 |
| ODI | 74.81 | 79.83 | 73.13 |
| T20 | 96.93 | 112.44 | 84.01 |

## Matchups

### Dismissals no longer credited (#4, #5, #6)

Pairs added up over all formats, to separate the counting rules from the format split.

| Batter | Bowler | Old balls / outs | New balls / outs, formats added | outs: #1/#12 identity | outs: #6 non-striker out | outs: #5 retirement | outs: #4 not the bowler’s wicket | outs: #7 second wicket | balls: #4 wides |
|---|---|---|---|---|---|---|---|---|---|
| MS Wade | R Ashwin | 398 / 9 | 397 / 5 |  | -3 |  | -1 |  | -1 |
| R Dravid | Naved-ul-Hasan | 146 / 6 | 144 / 3 |  |  |  | -3 |  | -2 |
| S Veerapathiran | Sayed Monib | 13 / 3 | 12 / 0 |  | -2 |  | -1 |  | -1 |
| Sarfraz Ahmed | NLTC Perera | 97 / 8 | 95 / 5 |  | -1 |  | -2 |  | -2 |
| V Ooko ♀ | MD Bimenyimana ♀ | 51 / 3 | 49 / 0 |  | -1 |  | -2 |  | -2 |
| Amarpal Kaur ♀ | K Amuge ♀ | 26 / 4 | 26 / 1 |  | -2 |  | -1 |  |  |
| Abdul Razzaq | M Muralitharan | 147 / 5 | 142 / 2 |  | -3 |  |  |  | -5 |
| Emma Kamara (as “E Kamara”) ♀ | R Samson ♀ | 11 / 3 | 11 / 0 |  | -2 |  | -1 |  |  |
| S Krisheta ♀ | J Gunasekar ♀ | 22 / 3 | 22 / 0 |  | -3 |  |  |  |  |
| MEK Hussey | Harbhajan Singh | 658 / 7 | 654 / 4 |  | -2 |  | -1 |  | -4 |

### Namesakes and spellings (#1, #12)

| Batter | Bowler | Old balls / outs | New balls / outs, formats added | outs: #1/#12 identity | outs: #6 non-striker out | outs: #5 retirement | outs: #4 not the bowler’s wicket | outs: #7 second wicket | balls: #4 wides |
|---|---|---|---|---|---|---|---|---|---|
| Mohammad Yousuf | IK Pathan | 137 / 2 | 202 / 6 | +4 |  |  |  |  | -2 |
| Mohammad Yousuf (as “Yousuf Youhana”) | AB Agarkar | 30 / 0 | 51 / 4 | +4 |  |  |  |  | -2 |
| AC Kerr ♀ | NR Sciver (as “NR Sciver-Brunt”) ♀ | 94 / 4 | 152 / 6 | +3 | -1 |  |  |  | -3 |
| Mohammad Yousuf | SM Pollock | 180 / 4 | 254 / 6 | +3 | -1 |  |  |  |  |
| NR Sciver ♀ | JL Jonassen ♀ | 285 / 8 | 338 / 9 | +3 | -1 |  | -1 |  | -1 |

### Balls no longer counted (#4 wides)

| Batter | Bowler | Old balls / outs | New balls / outs, formats added | outs: #1/#12 identity | outs: #6 non-striker out | outs: #5 retirement | outs: #4 not the bowler’s wicket | outs: #7 second wicket | balls: #4 wides |
|---|---|---|---|---|---|---|---|---|---|
| WU Tharanga | Z Khan | 286 / 8 | 264 / 8 |  |  |  |  |  | -22 |
| SR Tendulkar | MG Johnson | 741 / 7 | 720 / 6 |  |  |  | -1 |  | -21 |
| GA Priandana | GC Murtaza | 110 / 6 | 90 / 6 |  |  |  |  |  | -20 |
| S Mandhana ♀ | D Brown ♀ | 228 / 7 | 208 / 7 |  |  |  |  |  | -20 |
| S Matijevic ♀ | B Shotorova ♀ | 61 / 0 | 41 / 0 |  |  |  |  |  | -20 |

### One format at a time (#4)

The old row mixed formats. The old rows with the most dismissals, split as the app now shows them (balls / runs / dismissals):

| Batter | Bowler | Old, all formats | New Test | New ODI | New T20 |
|---|---|---|---|---|---|
| DA Warner | SCJ Broad | 952 / 564 / 21 | 862 / 456 / 17 | 71 / 86 / 2 | 16 / 22 / 1 |
| JM Bairstow | MA Starc | 498 / 309 / 19 | 379 / 200 / 12 | 96 / 93 / 5 | 18 / 16 / 1 |
| BA Stokes | MA Starc | 481 / 282 / 18 | 409 / 225 / 14 | 66 / 55 / 2 | 5 / 2 / 0 |
| BA Stokes | R Ashwin | 711 / 309 / 17 | 647 / 253 / 13 | 64 / 56 / 4 | – |
| LRPL Taylor | SCJ Broad | 600 / 336 / 17 | 412 / 212 / 10 | 157 / 97 / 4 | 26 / 27 / 1 |
| DPMD Jayawardene | Saeed Ajmal | 707 / 381 / 16 | 507 / 238 / 10 | 175 / 123 / 5 | 16 / 20 / 1 |
| JE Root | PJ Cummins | 646 / 348 / 16 | 559 / 294 / 13 | 84 / 54 / 3 | – |
| JE Root | RA Jadeja | 1465 / 738 / 15 | 1308 / 602 / 9 | 147 / 126 / 5 | 10 / 10 / 0 |
| JE Root | MA Starc | 901 / 535 / 15 | 766 / 417 / 11 | 128 / 110 / 3 | 4 / 8 / 0 |
| JE Root | JJ Bumrah | 774 / 418 / 15 | 666 / 333 / 11 | 88 / 74 / 3 | 17 / 11 / 1 |

### The table on screen

V Kohli (bowler: balls / runs / dismissals):

| Row | Old screen (all formats) | New screen, ODI |
|---|---|---|
| 1 | JR Hazlewood: 504 / 283 / 11 | TG Southee: 219 / 231 / 7 |
| 2 | MM Ali: 519 / 307 / 11 | R Rampaul: 144 / 127 / 6 |
| 3 | K Rabada: 655 / 423 / 11 | A Zampa: 295 / 302 / 6 |
| 4 | AU Rashid: 685 / 500 / 11 | JR Hazlewood: 106 / 67 / 5 |
| 5 | TG Southee: 516 / 386 / 11 | AU Rashid: 153 / 139 / 5 |

RG Sharma (bowler: balls / runs / dismissals):

| Row | Old screen (all formats) | New screen, ODI |
|---|---|---|
| 1 | K Rabada: 473 / 301 / 14 | AD Mathews: 175 / 103 / 7 |
| 2 | TG Southee: 354 / 242 / 14 | TG Southee: 153 / 115 / 6 |
| 3 | AD Mathews: 261 / 161 / 11 | M Morkel: 183 / 123 / 5 |
| 4 | PJ Cummins: 486 / 353 / 11 | K Rabada: 160 / 131 / 5 |
| 5 | NM Lyon: 482 / 301 / 9 | TA Boult: 177 / 132 / 4 |

## Recommender

Baselines before any venue or opposition filter. Of balls with two kinds of extra, the old rule mis-counted the ball on 466, charged byes or other extras to the bowler on 28 and missed wide or no-ball runs on 466 (#8).

### Batting: expected runs per dismissal

1,187 changed (of those with 500+ balls).

| Player | Format | Old | New | Change | #12 spellings | #6 non-striker |
|---|---|---|---|---|---|---|
| I Chathurani ♀ | T20 | 70.86 | 62.00 | -8.86 |  | -8.86 |
| JA Rudolph | ODI | 51.25 | 43.16 | -8.09 |  | -8.09 |
| Emma Kamara (as “E Kamara”) ♀ | T20 | 27.53 | 19.50 | -8.03 |  | -8.03 |
| Naeem Islam | Test | 42.56 | 34.82 | -7.74 |  | -7.74 |
| GA Elwiss ♀ | Test | 36.25 | 29.00 | -7.25 |  | -7.25 |
| Mohammad Yousuf | Test | 54.92 | 48.08 | -6.84 | -5.15 | -1.69 |
| RN ten Doeschate | ODI | 66.00 | 59.40 | -6.60 |  | -6.60 |
| MS Sinclair | ODI | 36.70 | 30.58 | -6.12 |  | -6.12 |
| SHT Kandamby | ODI | 37.59 | 31.81 | -5.78 |  | -5.78 |
| Haris Sohail | ODI | 51.79 | 46.19 | -5.60 |  | -5.60 |

Largest from counting rules alone (1,183 changed):

| Player | Format | Old | New | Change | #6 non-striker |
|---|---|---|---|---|---|
| I Chathurani ♀ | T20 | 70.86 | 62.00 | -8.86 | -8.86 |
| JA Rudolph | ODI | 51.25 | 43.16 | -8.09 | -8.09 |
| Emma Kamara (as “E Kamara”) ♀ | T20 | 27.53 | 19.50 | -8.03 | -8.03 |
| Naeem Islam | Test | 42.56 | 34.82 | -7.74 | -7.74 |
| GA Elwiss ♀ | Test | 36.25 | 29.00 | -7.25 | -7.25 |

### Bowling: economy

129 changed (of those with 500+ balls).

| Player | Format | Old | New | Change | #1 namesakes | #12 spellings | #8 extras |
|---|---|---|---|---|---|---|---|
| Mohammad Nawaz (3) (as “Mohammad Nawaz”) | Test | 3.64 | 3.10 | -0.54 |  | -0.54 |  |
| Shahid Afridi | T20 | 6.88 | 6.62 | -0.26 | -0.26 |  |  |
| NR Sciver ♀ | T20 | 6.46 | 6.62 | +0.16 |  | +0.16 |  |
| Imran Khan (5) (as “Imran Khan”) | T20 | 7.11 | 7.21 | +0.10 | +0.10 |  |  |
| KH Brunt ♀ | T20 | 5.80 | 5.89 | +0.09 |  | +0.09 |  |
| Mohammad Nawaz (3) (as “Mohammad Nawaz”) | T20 | 7.34 | 7.26 | -0.08 |  | -0.08 |  |
| NR Sciver ♀ | Test | 2.50 | 2.58 | +0.08 |  | +0.08 |  |
| M Syrioti ♀ | T20 | 5.71 | 5.77 | +0.06 |  |  | +0.06 |
| G Sesay | T20 | 5.34 | 5.39 | +0.05 |  |  | +0.05 |
| NR Sciver ♀ | ODI | 4.57 | 4.62 | +0.05 |  | +0.05 |  |

Largest from counting rules alone (117 changed):

| Player | Format | Old | New | Change | #8 extras |
|---|---|---|---|---|---|
| M Syrioti ♀ | T20 | 5.71 | 5.77 | +0.06 | +0.06 |
| G Sesay | T20 | 5.34 | 5.39 | +0.05 | +0.05 |
| Mohammad Kamran | T20 | 5.22 | 5.25 | +0.03 | +0.03 |
| Bilal Hassun | T20 | 6.80 | 6.83 | +0.03 | +0.03 |
| M Akayezu | T20 | 7.79 | 7.82 | +0.03 | +0.03 |

### Bowling: average

149 changed (of those with 500+ balls).

| Player | Format | Old | New | Change | #1 namesakes | #12 spellings |
|---|---|---|---|---|---|---|
| NR Sciver ♀ | Test | 33.11 | 39.18 | +6.07 |  | +6.07 |
| Mohammad Nawaz (3) (as “Mohammad Nawaz”) | ODI | 40.85 | 38.34 | -2.51 |  | -2.51 |
| NR Sciver ♀ | T20 | 21.84 | 24.34 | +2.50 |  | +2.50 |
| Shahid Afridi | T20 | 22.18 | 24.39 | +2.21 | +2.21 |  |
| Mohammad Nawaz (3) (as “Mohammad Nawaz”) | T20 | 19.85 | 21.43 | +1.58 |  | +1.58 |
| Ali Khan | ODI | 17.76 | 16.42 | -1.34 | -1.34 |  |
| Mohammad Nawaz (3) (as “Mohammad Nawaz”) | Test | 31.73 | 31.00 | -0.73 |  | -0.73 |
| Steven Ryan Taylor (as “SR Taylor”) | ODI | 27.95 | 28.54 | +0.59 |  | +0.59 |
| KH Brunt ♀ | T20 | 19.52 | 20.03 | +0.51 |  | +0.51 |
| A Shukla | T20 | 26.93 | 26.45 | -0.48 | -0.48 |  |

Largest from counting rules alone (136 changed):

| Player | Format | Old | New | Change | #8 extras |
|---|---|---|---|---|---|
| D Ravu | ODI | 61.88 | 62.00 | +0.12 | +0.12 |
| Bismah Maroof ♀ | ODI | 54.78 | 54.89 | +0.11 | +0.11 |
| Aliya Riaz ♀ | ODI | 79.60 | 79.70 | +0.10 | +0.10 |
| M Syrioti ♀ | T20 | 18.13 | 18.23 | +0.10 | +0.10 |
| SN Thakur | Test | 30.94 | 31.03 | +0.09 | +0.09 |

### Top ten, old and new

These lists come from the two apps. The causes are the baseline changes above.

T20, batters, men, no filters:

| Rank | Old | New | New pick’s old rank |
|---|---|---|---|
| 1 | Karanbir Singh | Karanbir Singh | 1 |
| 2 | Mohammad Rizwan | Mohammad Rizwan | 2 |
| 3 | J van Heerden | V Kohli | 4 |
| 4 | V Kohli | D Visser | 5 |
| 5 | D Visser | Tilak Varma | 6 |
| 6 | Tilak Varma | MK Pandey | 10 |
| 7 | Sohail Ahmed | DMW Rawlins | 11 |
| 8 | Zubair Ali | J Baker | 12 |
| 9 | IA Karim | Sohail Ahmed | 7 |
| 10 | MK Pandey | IA Karim | 9 |

T20, bowlers, men, no filters:

| Rank | Old | New | New pick’s old rank |
|---|---|---|---|
| 1 | B Ito-Davis | B Ito-Davis | 1 |
| 2 | J Coetzee | J Coetzee | 2 |
| 3 | MA Baig | MA Baig | 3 |
| 4 | AR Ramjani | AR Ramjani | 4 |
| 5 | D Maisuria | D Maisuria | 5 |
| 6 | Waqar Ali | Waqar Ali | 6 |
| 7 | C Rumistrzewicz | C Rumistrzewicz | 7 |
| 8 | Abdul Samad | Abdul Samad (2) | 8 |
| 9 | Shoaib Rafiq | Shoaib Rafiq | 9 |
| 10 | Lucas Rossi | Lucas Rossi | 10 |

ODI, batters, men, no filters:

| Rank | Old | New | New pick’s old rank |
|---|---|---|---|
| 1 | AM Tribe | AM Tribe | 1 |
| 2 | BJ Curran | BJ Curran | 2 |
| 3 | Milind Kumar | Milind Kumar | 3 |
| 4 | RN ten Doeschate | MP Breetzke | 5 |
| 5 | MP Breetzke | RN ten Doeschate | 4 |
| 6 | V Kohli | DJ Mitchell | 7 |
| 7 | DJ Mitchell | V Kohli | 6 |
| 8 | MM English | Shubman Gill | 12 |
| 9 | AB de Villiers | DJ Malan | 10 |
| 10 | DJ Malan | SV Samson | 11 |

ODI, bowlers, men, no filters:

| Rank | Old | New | New pick’s old rank |
|---|---|---|---|
| 1 | BJ Currie | BJ Currie | 1 |
| 2 | Shakeel Ahmed | Shakeel Ahmed (2) | 2 |
| 3 | XC Bartlett | XC Bartlett | 3 |
| 4 | S Bhari | S Bhari | 4 |
| 5 | Usman Shinwari | Ali Khan | 6 |
| 6 | Ali Khan | Usman Shinwari | 5 |
| 7 | JR Lennox | JR Lennox | 7 |
| 8 | GT Main | GT Main | 8 |
| 9 | MS Kasprowicz | MS Kasprowicz | 9 |
| 10 | Nahid Rana | Nahid Rana | 10 |

Test, batters, men, no filters:

| Rank | Old | New | New pick’s old rank |
|---|---|---|---|
| 1 | CL Cairns | CL Cairns | 1 |
| 2 | GS Dinusha | GS Dinusha | 2 |
| 3 | SR Waugh | SR Waugh | 3 |
| 4 | D Padikkal | D Padikkal | 4 |
| 5 | BC Lara | BC Lara | 5 |
| 6 | Z de Bruyn | Z de Bruyn | 6 |
| 7 | DE Bernard | DE Bernard | 7 |
| 8 | KJ O'Brien | KJ O'Brien | 8 |
| 9 | I Kaia | I Kaia | 9 |
| 10 | AC Voges | AC Voges | 10 |

Test, bowlers, men, no filters:

| Rank | Old | New | New pick’s old rank |
|---|---|---|---|
| 1 | TJ Murtagh | TJ Murtagh | 1 |
| 2 | JA Duffy | JA Duffy | 2 |
| 3 | N Burger | N Burger | 3 |
| 4 | Hasan Murad | Hasan Murad | 4 |
| 5 | KR Mayers | KR Mayers | 5 |
| 6 | SE Bond | SE Bond | 6 |
| 7 | SM Boland | SM Boland | 7 |
| 8 | C Bosch | C Bosch | 8 |
| 9 | MG Neser | MG Neser | 9 |
| 10 | OE Robinson | OE Robinson | 10 |

## Grounds (#11)

Venue filters now take every approved spelling together. Largest merges:

| Ground | Matches now | Old: matches under each spelling |
|---|---|---|
| R Premadasa Stadium | 173 | R Premadasa Stadium (84); R Premadasa Stadium, Colombo (64); R.Premadasa Stadium, Khettarama (19); R.Premadasa Stadium (6) |
| Queens Sports Club | 103 | Queens Sports Club, Bulawayo (56); Queens Sports Club (47) |
| Edgbaston | 85 | Edgbaston (49); Edgbaston, Birmingham (36) |
| Gaddafi Stadium | 87 | Gaddafi Stadium, Lahore (51); Gaddafi Stadium (36) |
| ICC Academy | 77 | ICC Academy, Dubai (42); ICC Academy (35) |
| Lord's | 104 | Lord's (73); Lord's, London (31) |
| National Stadium | 74 | National Stadium, Karachi (45); National Stadium (29) |
| Bay Oval | 58 | Bay Oval (30); Bay Oval, Mount Maunganui (28) |
| Hagley Oval | 61 | Hagley Oval, Christchurch (34); Hagley Oval (27) |
| Seddon Park | 81 | Seddon Park (55); Seddon Park, Hamilton (26) |
