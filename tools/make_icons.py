#!/usr/bin/env python3
"""Regenerate Seclusa TDS icons.

    python3 tools/make_icons.py

Needs Pillow. White plate, black mark only (home-screen / PWA install).
"""

from pathlib import Path

from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
ICONS = HERE.parent / "static" / "icons"

SIZE = 1024
BG = (255, 255, 255, 255)
FG = (10, 10, 10, 255)


def draw_mark(size, colour=FG, cut=BG):
    s = int(size)
    layer = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    # vault door
    d.rounded_rectangle(
        [int(s * 0.22), int(s * 0.24), int(s * 0.78), int(s * 0.76)],
        radius=int(s * 0.05),
        fill=colour,
    )
    # inner panel cut (shows plate colour)
    inset = [int(s * 0.30), int(s * 0.32), int(s * 0.70), int(s * 0.60)]
    d.rounded_rectangle(inset, radius=int(s * 0.03), fill=cut)
    # lock
    cx, cy = s // 2, int(s * 0.46)
    r = int(s * 0.045)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=colour)
    d.rounded_rectangle(
        [cx - int(s * 0.02), cy, cx + int(s * 0.02), cy + int(s * 0.09)],
        radius=int(s * 0.01),
        fill=colour,
    )
    return layer


def make_tile(size):
    plate = Image.new("RGBA", (size, size), BG)
    mark = draw_mark(size, FG, BG)
    plate.paste(mark, (0, 0), mark)
    return plate


def make_maskable(size):
    out = Image.new("RGBA", (size, size), BG)
    inner = int(size * 0.72)
    mark = draw_mark(inner, FG, BG)
    off = (size - inner) // 2
    out.paste(mark, (off, off), mark)
    return out


SVG = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" role="img" aria-label="Seclusa TDS">
  <rect width="1024" height="1024" rx="200" fill="#ffffff"/>
  <rect x="220" y="250" width="584" height="524" rx="48" fill="#0a0a0a"/>
  <rect x="300" y="330" width="424" height="280" rx="28" fill="#ffffff"/>
  <circle cx="512" cy="470" r="46" fill="#0a0a0a"/>
  <rect x="490" y="470" width="44" height="90" rx="14" fill="#0a0a0a"/>
</svg>
"""


def main():
    ICONS.mkdir(parents=True, exist_ok=True)

    for size in (192, 512):
        make_tile(size).save(ICONS / f"icon-{size}.png")

    make_maskable(512).save(ICONS / "icon-maskable-512.png")
    (ICONS / "icon.svg").write_text(SVG, encoding="utf-8")

    for name in ("icon-192.png", "icon-512.png", "icon-maskable-512.png", "icon.svg"):
        print(f"static/icons/{name}")


if __name__ == "__main__":
    main()
