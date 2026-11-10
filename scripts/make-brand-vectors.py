#!/usr/bin/env python3
"""Dessine l'identité Perokado en vectoriel (emblème, logotype, slogan).

    pip install --break-system-packages fonttools brotli
    python3 scripts/make-brand-vectors.py

Sorties dans `public/brand/` :

    perokado-emblem.svg              emblème carré (badge bleu nuit + « P » doré)
    perokado-wordmark-navy.svg       mot « Perokado » sur fond clair
    perokado-wordmark-white.svg      mot « Perokado » sur fond bleu nuit
    perokado-slogan-white.svg        slogan, sur fond bleu nuit
    perokado-slogan-navy.svg         slogan, sur fond clair

Toutes les lettres sont converties en **contours** (et non en texte SVG) : la
génération des images ne dépend donc d'aucune police installée sur la machine,
et le rendu est identique sur un poste de développement, sur GitHub Actions et
sur Vercel.

Police : Poppins Bold (licence SIL OFL 1.1, fichier et licence conservés dans
`scripts/brand/`). C'est une géométrique très lisible en petites tailles, qui
tient aussi bien sur une icône de 32 px que sur une bannière.

Ces SVG sont ensuite composés en PNG par `scripts/make-brand-assets.ts`.
"""
from __future__ import annotations

import pathlib

from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.ttLib import TTFont

ROOT = pathlib.Path(__file__).resolve().parent.parent
BRAND = ROOT / "public" / "brand"
HERE = ROOT / "scripts" / "brand"
FONT = HERE / "poppins-latin-700-normal.woff2"

# Couleurs de la charte (identiques à celles de `src/app/globals.css`).
NAVY = "#0e2340"
NAVY_DEEP = "#081729"
NAVY_LIGHT = "#1b3f6b"
GOLD = "#f2b705"
WHITE = "#ffffff"

# Interlettrage du logotype, en unités de police (léger resserrement).
TRACKING = -18

SLOGAN = "Tout ce que vous cherchez au même endroit."


class Face:
    """Accès aux contours d'une police pour un mot donné."""

    def __init__(self, path: pathlib.Path) -> None:
        self.font = TTFont(path)
        self.upem = self.font["head"].unitsPerEm
        self.cmap = self.font.getBestCmap()
        self.glyphs = self.font.getGlyphSet()
        self.hmtx = self.font["hmtx"]
        self.cap = self.font["OS/2"].sCapHeight
        self._cache: dict[str, tuple[str, float, tuple[float, float, float, float]]] = {}

    def glyph(self, char: str):
        """(commandes SVG, avance, boîte englobante) d'un caractère."""
        if char in self._cache:
            return self._cache[char]
        name = self.cmap[ord(char)]
        pen = SVGPathPen(self.glyphs)
        self.glyphs[name].draw(pen)
        bounds = BoundsPen(self.glyphs)
        self.glyphs[name].draw(bounds)
        box = bounds.bounds or (0.0, 0.0, 0.0, 0.0)
        entry = (pen.getCommands(), float(self.hmtx[name][0]), box)
        self._cache[char] = entry
        return entry

    def word(self, text: str, tracking: float = TRACKING):
        """Contours d'un mot, ancrés sur la ligne de base (y = 0 vers le haut).

        Le retour est exprimé dans le repère **écran** (y vers le bas) : chaque
        contour est déjà retourné, si bien que le dessin occupe `y ∈ [0, top-bottom]`
        et que seul un décalage horizontal reste à appliquer.
        """
        parts: list[str] = []
        x = 0.0
        right = 0.0
        top = float("inf")
        bottom = 0.0
        space_advance = self.upem * 0.26
        for index, char in enumerate(text):
            if char == " ":
                x += space_advance + tracking
                continue
            commands, advance, (x0, y0, x1, y1) = self.glyph(char)
            if commands:
                # Le contour est retourné autour de la hauteur de capitale :
                # la ligne de base tombe alors à y = cap, l'axe des y descend.
                parts.append(
                    f'<path transform="translate({x:.1f} {self.cap}) scale(1 -1)" d="{commands}"/>'
                )
                right = max(right, x + x1)
                top = min(top, self.cap - y1)
                bottom = max(bottom, self.cap - y0)
            x += advance
            if index < len(text) - 1:
                x += tracking
        return parts, right, top, bottom


def svg(width: float, height: float, body: list[str], view: str | None = None,
        title: str | None = None) -> str:
    view_box = view or f"0 0 {width:g} {height:g}"
    label = f' role="img" aria-label="{title}"' if title else ' aria-hidden="true"'
    return "\n".join(
        [
            '<?xml version="1.0" encoding="UTF-8"?>',
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{view_box}" width="{width:g}" '
            f'height="{height:g}"{label}>',
            *(f"  {line}" for line in body),
            "</svg>",
            "",
        ]
    )


def emblem(face: Face) -> str:
    """Badge carré : « P » de Perokado, en doré, sur un fond bleu nuit."""
    size = 512
    commands, advance, (x0, y0, x1, y1) = face.glyph("P")
    # Hauteur de capitale visée : 58 % du badge, ce qui reste lisible à 32 px.
    scale = (size * 0.58) / face.cap
    ink_w = (x1 - x0) * scale
    # Centrage optique sur la boîte d'encre (et non sur l'avance de la lettre).
    left = (size - ink_w) / 2 - x0 * scale
    baseline = (size + face.cap * scale) / 2

    body = [
        "<defs>",
        '  <linearGradient id="badge" x1="0" y1="0" x2="1" y2="1">',
        f'    <stop offset="0" stop-color="{NAVY_LIGHT}"/>',
        f'    <stop offset="0.55" stop-color="{NAVY}"/>',
        f'    <stop offset="1" stop-color="{NAVY_DEEP}"/>',
        "  </linearGradient>",
        '  <radialGradient id="glow" cx="0.28" cy="0.18" r="0.75">',
        '    <stop offset="0" stop-color="#ffffff" stop-opacity="0.14"/>',
        '    <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>',
        "  </radialGradient>",
        "</defs>",
        '<rect width="512" height="512" rx="120" ry="120" fill="url(#badge)"/>',
        '<rect width="512" height="512" rx="120" ry="120" fill="url(#glow)"/>',
        f'<path transform="translate({left:.2f} {baseline:.2f}) scale({scale:.5f} {-scale:.5f})" '
        f'd="{commands}" fill="{GOLD}"/>',
    ]
    return svg(size, size, body, title="Perokado")


def wordmark(face: Face, colour: str) -> str:
    """Logotype horizontal « Perokado », cadré au plus juste sur son encre."""
    parts, right, top, bottom = face.word("Perokado")
    pad = 10
    width = right + pad * 2
    height = (bottom - top) + pad * 2
    body = [
        f'<g fill="{colour}" transform="translate({pad:.1f} {pad - top:.1f})">',
        *(f"  {part}" for part in parts),
        "</g>",
    ]
    return svg(width, height, body, title="Perokado")


def slogan(face: Face, colour: str) -> str:
    """Slogan tracé, sur une seule ligne (utilisé sur les images de partage)."""
    parts, right, top, bottom = face.word(SLOGAN, tracking=-4)
    pad = 8
    width = right + pad * 2
    height = (bottom - top) + pad * 2
    body = [
        f'<g fill="{colour}" transform="translate({pad:.1f} {pad - top:.1f})">',
        *(f"  {part}" for part in parts),
        "</g>",
    ]
    return svg(width, height, body, title=SLOGAN)


def main() -> None:
    face = Face(FONT)
    BRAND.mkdir(parents=True, exist_ok=True)
    outputs = {
        "perokado-emblem.svg": emblem(face),
        "perokado-wordmark-navy.svg": wordmark(face, NAVY),
        "perokado-wordmark-white.svg": wordmark(face, WHITE),
        "perokado-slogan-navy.svg": slogan(face, NAVY),
        "perokado-slogan-white.svg": slogan(face, WHITE),
        "perokado-slogan-gold.svg": slogan(face, GOLD),
    }
    for name, content in outputs.items():
        (BRAND / name).write_text(content, encoding="utf-8")
        print(f"✔ public/brand/{name}")


if __name__ == "__main__":
    main()
