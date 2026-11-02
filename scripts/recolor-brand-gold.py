#!/usr/bin/env python3
"""Passe l'identité visuelle de l'orange au jaune doré.

    python3 scripts/recolor-brand-gold.py

La boutique a demandé le jaune comme couleur d'action. Les logos fournis par le
propriétaire sont des PNG générés depuis `medi-logo-source.png` : plutôt que de
redessiner le logo, on remplace la teinte orange par le doré de la charte
(#F2B705) en conservant la luminance et la transparence, ce qui garde l'épaisseur
des traits, les dégradés et l'anticrénelage d'origine.

Le script est idempotent : relancé, il ne change plus rien.
"""

from __future__ import annotations

import colorsys
import re
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
BRAND = ROOT / "public" / "brand"

# Teinte cible : jaune doré de la charte (#F2B705), en HSV.
TARGET = (0.125, 0.96)

PNG_FILES = [
    "medi-logo-source.png",
    "medi-logo.png",
    "medi-logo-blanc.png",
    "medi-logo-horizontal.png",
    "medi-logo-horizontal-blanc.png",
    "medi-icon.png",
    "apple-touch-icon.png",
    "favicon-32.png",
    "medi-og.png",
]

SVG_FILES = ["medi-logo.svg", "medi-logo-blanc.svg", "medi-icon.svg"]

# Toutes les variantes d'orange utilisées dans les sources (SVG et logos).
SVG_ORANGES = ["#F97316", "#FB923C", "#F56D10", "#EA580C", "#FDBA74", "#FF6B00", "#F97316"]


def recolor_pixels(image: Image.Image) -> Image.Image:
    image = image.convert("RGBA")
    pixels = image.load()
    width, height = image.size

    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            if a == 0:
                continue
            h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            # La plage orange (≈ 0,02 à 0,13 tour) laisse intacts le bleu nuit,
            # le blanc et les gris : seules les zones commerciales changent.
            if 0.015 <= h <= 0.135 and s >= 0.35:
                nr, ng, nb = colorsys.hsv_to_rgb(TARGET[0], min(1.0, s), v)
                pixels[x, y] = (round(nr * 255), round(ng * 255), round(nb * 255), a)

    return image


def recolor_png(path: Path) -> None:
    before = path.read_bytes()
    image = recolor_pixels(Image.open(path))
    image.save(path, optimize=True)
    changed = before != path.read_bytes()
    print(f"  {path.name:<34} {'modifié' if changed else 'déjà doré'}")


def recolor_svg(path: Path) -> None:
    text = path.read_text(encoding="utf-8")
    updated = text
    for orange in SVG_ORANGES:
        updated = re.sub(re.escape(orange), "#F2B705", updated, flags=re.IGNORECASE)
    # Variante sombre du doré utilisée pour les traits fins sur fond clair.
    if updated != text:
        path.write_text(updated, encoding="utf-8")
        print(f"  {path.name:<34} modifié")
    else:
        print(f"  {path.name:<34} déjà doré")


def main() -> None:
    print("→ Identité visuelle MeDi : orange → jaune doré")
    for name in PNG_FILES:
        path = BRAND / name
        if path.exists():
            recolor_png(path)
    for name in SVG_FILES:
        path = BRAND / name
        if path.exists():
            recolor_svg(path)
    print("Terminé.")


if __name__ == "__main__":
    main()
