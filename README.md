# Seclusa Lockdown

**Very early development.** This is a first public build, not a finished game.
Decks, combat, balance, and the look are still changing. Expect rough edges,
including the install icons.

Your ship crash-lands on a strange planet. A sealed fortress sits nearby —
fight through its decks, salvage the parts, and get airborne again.

Offline PWA. Data stays on the device; nothing is sent anywhere.

## What it does

- Version 0.1.49
- Twenty fortress decks, from the crash site to the salvage bay
- Keycards, doors, ammo crates, shootable credit scrap, side caches, and a salvage terminal
- Pistol, scatter, auto, rifle, and lance, plus dash, breach, and a hull patch
- Progress (unlocks, guns, best score) saved locally

## Run

```bash
python3 -m http.server 18846 --bind 127.0.0.1
```

Open `http://127.0.0.1:18846/`.

## Play

- WASD move, 1–5 switch guns, Shift dash, F breach, Space fire, E terminal, P pause
- Credits come from drops (enemies) and yellow CR scrap boxes you shoot open
- Doors open red, then green, then blue
- Clear the fortress core, then hold E at the wreck to patch the hull

## Tests

```bash
./test.sh
```

## License

GPL-3.0. See [LICENSE](LICENSE).
