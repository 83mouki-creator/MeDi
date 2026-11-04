#!/usr/bin/env python3
"""Trace le mot « Shop » qui complète le logotype « MeDi ».

Le logo fourni par le propriétaire ne contient que le mot « MeDi ». Pour écrire
« MeDi Shop » sur le site, `scripts/make-brand-assets.ts` colle ce tracé vectoriel
à droite du mot d'origine : même hauteur de capitale, même graisse, même couleur
que les lettres existantes. Le tracé est fourni en contours (et non en texte SVG)
pour que la génération des images ne dépende d'aucune police installée sur la
machine.

    pip install --break-system-packages fonttools brotli
    python3 scripts/make-shop-wordmark.py

Sortie : scripts/brand/shop-wordmark.svg

Police : Poppins Bold (SIL Open Font License 1.1), la plus proche des lettres
capitales du logo fourni (capitales pleines, « o » et « e » circulaires, jambages
droits). Le fichier de police et sa licence sont conservés à côté du tracé.
"""
from __future__ import annotations

import pathlib

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.ttLib import TTFont

HERE = pathlib.Path(__file__).resolve().parent / "brand"
FONT = HERE / "poppins-latin-700-normal.woff2"
OUT = HERE / "shop-wordmark.svg"

WORD = "Shop"
# Interlettrage du logo d'origine : les lettres sont très serrées (-5,5 % du corps).
TRACKING_UNITS = -55
# Espace entre « MeDi » et « Shop » (un peu plus large qu'une espace normale).
SPACE_UNITS = 222
# Couleur des lettres bleu nuit du logo (relevée sur l'image fournie).
NAVY = "#002e6a"
# Marge au-dessus du haut de capitale : le « S » dépasse légèrement la ligne des
# capitales (phénomène d'optique) et ne doit pas être rogné par le cadre du SVG.
TOP_MARGIN_UNITS = 40


def main() -> None:
    font = TTFont(FONT)
    upem = font["head"].unitsPerEm
    cmap = font.getBestCmap()
    glyphs = font.getGlyphSet()
    hmtx = font["hmtx"]
    cap = font["OS/2"].sCapHeight

    parts: list[str] = []
    x = 0
    for index, char in enumerate(WORD):
        name = cmap[ord(char)]
        pen = SVGPathPen(glyphs)
        glyphs[name].draw(pen)
        commands = pen.getCommands()
        advance = hmtx[name][0]
        if commands:
            parts.append(f'<path transform="translate({x} {cap}) scale(1 -1)" d="{commands}"/>')
        x += advance
        if index < len(WORD) - 1:
            x += TRACKING_UNITS
    width = x

    # Hauteur du dessin : marge optique en haut, haut de capitale à y = 0,
    # ligne de base à y = cap, jambage du « p » sous la ligne de base.
    descender = abs(min(font["hhea"].descent, font["OS/2"].sTypoDescender))
    top = -TOP_MARGIN_UNITS
    height = TOP_MARGIN_UNITS + cap + descender

    svg = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 {top} {width} {height}" '
        f'width="{width}" height="{height}" role="img" aria-label="Shop">',
        "  <!-- « Shop » tracé pour compléter le logotype « MeDi » (scripts/make-shop-wordmark.py).",
        "       Police Poppins Bold, SIL Open Font License 1.1 — voir scripts/brand/Poppins-OFL.txt.",
        f"       Repères : y = 0 = haut de capitale, y = {cap} = ligne de base, hauteur de capitale = {cap},",
        f"       marge de {TOP_MARGIN_UNITS} unités au-dessus du haut de capitale, cadre de {width} × {height} unités.",
        f"       le mot occupe toute la largeur ({width} unités). -->",
        f'  <g fill="{NAVY}">',
        *(f"    {part}" for part in parts),
        "  </g>",
        "</svg>",
        "",
    ]
    OUT.write_text("\n".join(svg), encoding="utf-8")
    print(f"✔ {OUT.relative_to(HERE.parent.parent)} — {width}×{height} unités, capitale {cap}")


if __name__ == "__main__":
    main()
