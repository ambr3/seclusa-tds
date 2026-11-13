# Changelog

## [0.1.63] - 2026-11-13

- PWA / home-screen icons: white background with black vault mark only (no orange bars).

## [0.1.62] - 2026-11-13

- Renamed the game to Seclusa TDS (Top Down Shooter). Install id and cache prefix stay `/seclusa-lockdown/` so existing installs keep working.

## [0.1.61] - 2026-11-13

- Menu content advisory: suggested 12+, sci-fi combat note, and photosensitive / flash / loud-SFX health warning.

## [0.1.60] - 2026-11-12

- Touch pads share one layout (FIRE/USE/DASH draw + hit). Audio unlocks on first gesture. Towers fire through their mount wall. Drop door flash, screen shake, unused textures, and committed level-image dumps. Victory survives pause/suspend; run snapshot keeps victory/loot state.

## [0.1.59] - 2026-11-12

- Polish pass: deck-identity litter (beds/ducts/mess props), crash-site skids, per-weapon shot feel + SFX, enemy alert pips, salvage victory beat, richer level-image markers.

## [0.1.58] - 2026-11-12

- Stronger deck audit: sealed floors, floating doors, orphan pillars, unreachable/wall-stuck enemies. Retired crawler mark F (use E/D). Rebuilt Vent crawl, Med bay, Mess hall so every tile is reachable. Spawns nudge off walls.

## [0.1.57] - 2026-11-12

- Deck audit tool (biome, wall clearance, chokes, solids, ASCII/PPM previews, pickup reach). Floor objects nudge clear of walls. Indoor scrap no longer paints grass. Open sealed med-bay / lift / command pickup rooms.

## [0.1.56] - 2026-11-12

- Sealed scrap never blocks doors/gaps (all decks). Guns fire distinct blaster / plasma / pulse / beam / lance shots instead of orange blobs.

## [0.1.55] - 2026-11-12

- Settings → Clear progress wipes score, continue, and found guns (browser history does not).

## [0.1.54] - 2026-11-12

- Cleanup: drop unused textures/sheets, docs/ DOS sources, and dead shop code. Single top bar for chrome + HUD. Only some scrap boxes shoot open; no floating world labels that walls clip.

## [0.1.53] - 2026-11-12

- Removed supply terminal and credits. Shoot LOOT boxes for ammo, health, guns, and gear. Floor gun pickups, off-path HEALTH booths, clearer world labels.

## [0.1.52] - 2026-11-12

- Doors read as wall plates with a big key-colour lock bar. Stronger open-edge trim. Photo wall/joins stamp one MACRO cell only (no long runs).

## [0.1.51] - 2026-11-12

- Dress the 0.1.3 metal walls: panel seams, rivet density, indoor/outdoor wear. Deck bands — warm early, cool mid, darker late.

## [0.1.50] - 2026-11-11

- Nicer 0.1.3-style walls: cooler concrete, softer bevels, clearer panel rivets. Doors match.

## [0.1.49] - 2026-11-10

- Restore 0.1.3 metal walls and doors (neighbor lips for corners/crosses). Drop textured join overlap.

## [0.1.48] - 2026-11-10

- Walls use wall.jpg on straight cells; L / T / + join pieces at corners and crosses (clipped). Doors on top as bold key-coloured gates.

## [0.1.47] - 2026-11-10

- Deck 2 only: stop wall-cache carve punching a hole in the corridor wall (matches layout overview). Deck 1 unchanged.

## [0.1.46] - 2026-11-10

- Doors fill the whole wall cell again (0.1.3-style), so decks 2+ no longer show missing wall gaps. Door draw fills that block (not a thin shutter). Deck 2 layout matches 0.1.3.

## [0.1.45] - 2026-11-10

- Easy and medium much easier: fewer deck enemies, tiny wave caps, slower/weaker fire, more HP/ammo, hits bank before a heart drops (hard unchanged).

## [0.1.44] - 2026-11-10

- Unlock doors from farther away so you are not standing in the doorway when campers open fire.

## [0.1.43] - 2026-11-10

- Easy and medium are gentler: fewer foes, slower waves/enemies, more ammo (hard unchanged).

## [0.1.42] - 2026-11-10

- Hard-defringe crashed/fixed ship (JPEG white matte). Corner towers are cannon-on-wall again — drop the oversized guard-body room stamp from 0.1.40.

## [0.1.41] - 2026-11-10

- Walls draw over mobile enemies so robots no longer look stuck through concrete; smaller pilot/robot/drone sprites; eject stuck spawns. Robots shoot. Clean pilot/enemy/ship edges. CACHE is an ammo/hull floor pickup.

## [0.1.40] - 2026-11-10

- Clean crashed-ship white fringe. Thin doors to a one-tile metal gate with colour lamp (no thick wall-door stretch).

## [0.1.39] - 2026-11-10

- Cap live enemies by difficulty (easy 8 / normal 12 / hard 16). Drop old crawler enemies; waves use only robot + drone art.

## [0.1.38] - 2026-11-10

- Keep outdoor grass without the FPS hit: pre-bake a small grass stamp and drawImage it (no JPEG createPattern).

## [0.1.37] - 2026-11-10

- Restore grass on outdoor crash-site ground (still one stamp per 48px block).

## [0.1.36] - 2026-11-10

- Fix unplayable framerate: paint floor/grass once per 48px block (not thousands of JPEG pattern fills), cull off-screen litter, cache minimap tiles, guard wall tiling loop.

## [0.1.35] - 2026-11-10

- Restore smooth float camera + simple rAF step (drop CSS slide / fixed 120 Hz).
- Re-slice pilot/robot/drone/cannon 8-dir frames from Dave's sheets; draw without double-rotation.

## [0.1.34] - 2026-11-09

- Real movement smooth: CSS sub-pixel camera + macro-aligned floors (no scroll flicker). Local preview skips the service worker so refreshes actually load new code. Menu shows v0.1.34.

## [0.1.33] - 2026-11-09

- Movement judder fix: device-pixel camera snap, diagonal moves as one step, crisp floor blit, fixed 120 Hz sim, HUD DOM only on change.
- Restore crashed/fixed ship art (gentle white-key only — no erode/resize).

## [0.1.31] - 2026-11-09

- Remove white halo around the crashed ship sprite.

## [0.1.30] - 2026-11-09

- Larger robot and drone sprites so enemies read clearly.

## [0.1.29] - 2026-11-09

- Show sliced robot/drone frames instead of whole sheets. Camera scrolls without pixel snap so movement stays smooth.

## [0.1.28] - 2026-11-09

- Deck themes: each deck uses a different floor and wall set from the labeled docs art. Pilot, robots, drones, ships, and floor props wired in.

## [0.1.27] - 2026-11-09

- Fix mouse aim at high DPR, HUD gun clicks, menu camera slide, resize backdrop, and tower spawn clearance.

## [0.1.26] - 2026-11-07

- Camera stays locked to the pilot and the canvas slides the sub-pixel, so movement is continuous.

## [0.1.25] - 2026-11-07

- Scatter floor junk with a gap so piles do not touch. Corner towers block movement and mount a cannon.

## [0.1.24] - 2026-11-07

- Floor rubble, gravel, and drains from the labeled sheets. Camera slides smoothly again.

## [0.1.23] - 2026-11-07

- Vertical walls, L/T/cross joins, guard towers, and grass use the labeled art.

## [0.1.22] - 2026-11-07

- Use labeled art: floor, straight wall, corner, door, crate, barrel.

## [0.1.21] - 2026-11-07

- Indoor floors, outdoor ground, and walls use tiles cut from docs/ground parts.jpeg.

## [0.1.19] - 2026-11-07

- Revert stamped floor-plan image tiles. Back to prior procedural ground/walls.

## [0.1.17] - 2026-11-07

- Match docs/floor-plan.jpg: thick concrete walls, grimy slab floors with yellow lines, dirt/gravel yard with grass tufts.

## [0.1.16] - 2026-11-07

- Corner towers sit on wall joins. Outdoor side of perimeter walls is grass. Richer grass/floor detail.

## [0.1.15] - 2026-11-07

- Clean floors (no fine-grid checkerboard), doors merge into wall beams, walls sit on continuous ground.

## [0.1.14] - 2026-11-07

- Smooth continuous wall beams (merged runs). Soft camera follow + pixel-snap so movement is less juddery on the fine grid.

## [0.1.13] - 2026-11-07

- Treat 48px wall squares as a bug: fine 16px grid (ASCII×3), walls are thin continuous metal strips over floor — not fat metal pads.

## [0.1.12] - 2026-11-07

- Keycards and other outdoor props no longer sit on a metal floor tile in the grass (they inherit outdoor from neighbouring sand/grass cells).

## [0.1.11] - 2026-11-07

- Walls are opaque metal cells with a raised riveted beam (no see-through pipe gaps). Keycards and scrap boxes larger.

## [0.1.10] - 2026-11-07

- Corner towers are one shootable gun on the wall cell (bullets ignore that wall tile). Scrap and keycards sized up.

## [0.1.9] - 2026-11-07

- Keep the 48px collision grid, but draw thin riveted walls, smaller keycards/props, and a smaller pilot so art is not locked to one cell pad.

## [0.1.7] - 2026-11-07

- Map cells are 5px. Decks expand from the ASCII layout so the world scale stays playable; walls are true thin metal strips.

## [0.1.6] - 2026-11-07

- Walls are thin riveted metal strips. Armed towers sit on outdoor-facing corners.

## [0.1.5] - 2026-11-07

- Crash site is open grass with no approach walls; fortress gate has armed towers.
- Yellow CR scrap boxes explode for credits when shot. Walls are thinner with more plate detail.

## [0.1.4] - 2026-11-07

- Auto gun and Lance join the terminal shop; Scatter and Rifle cost a little less.
- Bought guns stay unlocked on a new Begin run. Switch them from the HUD bar or keys 1–5.

## [0.1.3] - 2026-11-07

- Score, hull, ammo, and keycards sit in a bar above the play view instead of covering it.

## [0.1.2] - 2026-11-06

- Cache stamp so an installed copy loads the 0.1.1 install id and icons.

## [0.1.1] - 2026-11-06

- The install id is `/seclusa-lockdown/`, so this app is not the same installed app as the others on ambr3.github.io.
- Install icons are drawn at 192 and 512, not cropped from the corner of a larger image.

## [0.1.0] - 2026-11-06

- Named the game Seclusa Lockdown and published it as its own app.
- Light stays on the upper left while visors, guns, and blades turn with facing.
- The crashed ship, checker-plate decks, and wall runs match the concept sheet.

## [1.8.17] - 2026-11-06

- Draft builds in `project ideas/` before this release. Cache versions 1.8.x were local only.
