#!/usr/bin/env python3
"""Génère le dossier PDF de la boutique Perokado.

    python3 scripts/make-store-brief.py

Sortie : docs/MeDi-dossier-boutique.pdf

Trois parties :
  1. page de garde — informations de la boutique + QR code vers la boutique ;
  2. comportement du site e-commerce et expérience client ;
  3. ce qu'il reste à faire, étape par étape (hébergement, domaine, Wave,
     WhatsApp, intégrations, légal, lancement).

Dépendances : reportlab, segno (QR), Pillow.
Le script est volontairement autonome : il ne lit ni la base ni les variables
d'environnement, pour qu'un PDF identique soit reproductible partout.
"""

from __future__ import annotations

import os
from pathlib import Path

import segno
from PIL import Image
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas as pdfcanvas
from reportlab.platypus import (
    BaseDocTemplate,
    Flowable,
    Frame,
    Image as RLImage,
    KeepTogether,
    NextPageTemplate,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "docs" / "Perokado-dossier-boutique.pdf"
# Le même fichier est publié par le site : https://<domaine>/dossier/dossier-boutique-perokado.pdf
PUBLIC_OUT = ROOT / "public" / "dossier" / "dossier-boutique-perokado.pdf"
BUILD = ROOT / ".brief-build"
LOGO_WHITE = ROOT / "public" / "brand" / "perokado-logo-horizontal-blanc.png"
# Proportions réelles du logo (il s'élargit quand le nom s'allonge).
with Image.open(LOGO_WHITE) as _logo:
    LOGO_WHITE_RATIO = _logo.size[1] / _logo.size[0]

STORE_URL = "https://perokado.vercel.app"
GENERATED = "Novembre 2026"

# Charte de la boutique (voir src/app/globals.css)
NAVY = colors.HexColor("#16304F")
NAVY_DARK = colors.HexColor("#0E2340")
NAVY_SOFT = colors.HexColor("#F1F5FB")
NAVY_LINE = colors.HexColor("#DDE7F4")
ACCENT = colors.HexColor("#EA580C")
ACCENT_SOFT = colors.HexColor("#FFF7ED")
GREEN = colors.HexColor("#047857")
GREEN_SOFT = colors.HexColor("#ECFDF5")
AMBER = colors.HexColor("#B45309")
AMBER_SOFT = colors.HexColor("#FFFBEB")
GREY = colors.HexColor("#4B5563")
GREY_LIGHT = colors.HexColor("#9CA3AF")
INK = colors.HexColor("#1F2937")

# Informations de la boutique, telles qu'enregistrées dans /admin/parametres
# (voir scripts/store-config.ts et docs/ETAT-DU-PROJET.md).
STORE = {
    "name": "Perokado",
    "sector": "Quincaillerie — outillage, plomberie, électricité, peinture",
    "city": "Daloa, Côte d'Ivoire",
    "hours": "Lundi au samedi : 7h30 – 18h00 · Dimanche : fermé",
    "phone": "+225 07 08 90 48 91",
    "wave": "+225 07 08 90 48 91 — numéro provisoire",
    "currency": "FCFA (XOF)",
    "payment": "Wave (vérifié manuellement) · espèces à la livraison dans Daloa",
    "delivery": "Retrait gratuit · Daloa 1 000 à 2 000 FCFA · autres villes en prépaiement",
}

FONTS = {
    "DejaVu": "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "DejaVu-Bold": "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
}


def register_fonts() -> None:
    for name, path in FONTS.items():
        if os.path.exists(path):
            pdfmetrics.registerFont(TTFont(name, path))
    pdfmetrics.registerFontFamily("DejaVu", normal="DejaVu", bold="DejaVu-Bold")


def styles() -> dict[str, ParagraphStyle]:
    return {
        "cover_kicker": ParagraphStyle(
            "cover_kicker", fontName="DejaVu-Bold", fontSize=10,
            textColor=colors.HexColor("#FDBA74"), leading=13, spaceAfter=5,
        ),
        "cover_title": ParagraphStyle(
            "cover_title", fontName="DejaVu-Bold", fontSize=27, textColor=colors.white, leading=32,
        ),
        "cover_sub": ParagraphStyle(
            "cover_sub", fontName="DejaVu", fontSize=11.5,
            textColor=colors.HexColor("#DDE7F4"), leading=17, spaceBefore=8,
        ),
        "h1": ParagraphStyle(
            "h1", fontName="DejaVu-Bold", fontSize=18.5, textColor=NAVY, leading=23, spaceAfter=2,
        ),
        "kicker": ParagraphStyle(
            "kicker", fontName="DejaVu-Bold", fontSize=8.5, textColor=ACCENT, leading=11, spaceAfter=4,
        ),
        "lead": ParagraphStyle("lead", fontSize=10.4, textColor=GREY, leading=15.5, spaceBefore=5, spaceAfter=9),
        "h2": ParagraphStyle(
            "h2", fontName="DejaVu-Bold", fontSize=12.5, textColor=NAVY, leading=16,
            spaceBefore=8, spaceAfter=4.5,
        ),
        "h3": ParagraphStyle(
            "h3", fontName="DejaVu-Bold", fontSize=10, textColor=NAVY_DARK, leading=13.5,
            spaceBefore=2, spaceAfter=3,
        ),
        "body": ParagraphStyle("body", fontName="DejaVu", fontSize=9.5, textColor=INK, leading=14.5),
        "label": ParagraphStyle("label", fontName="DejaVu", fontSize=7.6, textColor=GREY_LIGHT, leading=10),
        "value": ParagraphStyle("value", fontName="DejaVu-Bold", fontSize=9.8, textColor=NAVY_DARK, leading=13.2),
        "small": ParagraphStyle("small", fontName="DejaVu", fontSize=8.2, textColor=GREY, leading=11.6),
        "cell": ParagraphStyle("cell", fontName="DejaVu", fontSize=8.8, textColor=INK, leading=12.8),
        "cell_bold": ParagraphStyle(
            "cell_bold", fontName="DejaVu-Bold", fontSize=8.8, textColor=NAVY_DARK, leading=12.8,
        ),
        "qr_caption": ParagraphStyle(
            "qr_caption", fontName="DejaVu-Bold", fontSize=9.5, textColor=NAVY,
            alignment=TA_CENTER, leading=12,
        ),
        "qr_url": ParagraphStyle(
            "qr_url", fontName="DejaVu", fontSize=7.8, textColor=GREY, alignment=TA_CENTER, leading=10.4,
        ),
    }


# ─────────────────────────────── Illustration ───────────────────────────────


def pil(path: Path) -> str:
    BUILD.mkdir(exist_ok=True)
    out = BUILD / path.name
    if not out.exists():
        Image.open(path).convert("RGBA").save(out)
    return str(out)


def qr_png(url: str, scale: int = 8) -> str:
    BUILD.mkdir(exist_ok=True)
    out = BUILD / "qr-boutique.png"
    if not out.exists():
        segno.make(url, error="h").save(str(out), scale=scale, border=2, dark="#16304F", light="#FFFFFF")
    return str(out)


def pill(text: str, bg: colors.Color, fg: colors.Color, size: float = 7.4) -> Table:
    table = Table([[Paragraph(text, ParagraphStyle(
        "pill", fontName="DejaVu-Bold", fontSize=size, textColor=fg, leading=size + 2.5, alignment=TA_CENTER,
    ))]], hAlign="LEFT")
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), bg),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 2.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("ROUNDEDCORNERS", [6, 6, 6, 6]),
    ]))
    return table


class Rule(Flowable):
    def __init__(self, width: float, color=NAVY_LINE, thickness: float = 0.7):
        super().__init__()
        self.width = width
        self.color = color
        self.thickness = thickness
        self.height = 2

    def draw(self) -> None:
        self.canv.setStrokeColor(self.color)
        self.canv.setLineWidth(self.thickness)
        self.canv.line(0, 1, self.width, 1)


# ─────────────────────────────── Document ───────────────────────────────────


class Brief(BaseDocTemplate):
    """Modèle « cover » pour la première page, « body » pour les suivantes."""

    def __init__(self, path: str, **kwargs):
        super().__init__(path, **kwargs)
        frame_cover = Frame(
            self.leftMargin, self.bottomMargin, self.width, self.height - 14 * mm,
            id="cover", leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0,
        )
        frame_body = Frame(
            self.leftMargin, self.bottomMargin, self.width, self.height,
            id="body", leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0,
        )
        self.addPageTemplates([
            PageTemplate(id="cover", frames=[frame_cover], onPage=self.cover_bg),
            PageTemplate(id="body", frames=[frame_body], onPage=self.body_bg),
        ])

    def cover_bg(self, canv: pdfcanvas.Canvas, doc: BaseDocTemplate) -> None:
        w, h = A4
        band = 112 * mm
        canv.setFillColor(NAVY)
        canv.rect(0, h - band, w, band, stroke=0, fill=1)
        canv.setFillColor(NAVY_DARK)
        canv.rect(0, h - band, w, 3 * mm, stroke=0, fill=1)
        canv.setFillColor(ACCENT)
        canv.rect(0, h - band - 2.6 * mm, w, 2.6 * mm, stroke=0, fill=1)

    def body_bg(self, canv: pdfcanvas.Canvas, doc: BaseDocTemplate) -> None:
        w, h = A4
        top = h - 14 * mm
        canv.setStrokeColor(NAVY_LINE)
        canv.setLineWidth(0.6)
        canv.line(doc.leftMargin, top, w - doc.rightMargin, top)
        canv.setFont("DejaVu-Bold", 8)
        canv.setFillColor(NAVY)
        canv.drawString(doc.leftMargin, top + 3.5 * mm, "Perokado  ·  dossier de la boutique")
        canv.setFont("DejaVu", 8)
        canv.setFillColor(GREY_LIGHT)
        canv.drawRightString(w - doc.rightMargin, top + 3.5 * mm, GENERATED)
        canv.line(doc.leftMargin, 14 * mm, w - doc.rightMargin, 14 * mm)
        canv.setFont("DejaVu", 7.4)
        canv.setFillColor(GREY_LIGHT)
        canv.drawString(doc.leftMargin, 9.5 * mm, STORE_URL)
        canv.drawRightString(w - doc.rightMargin, 9.5 * mm, f"page {doc.page}")


# ─────────────────────────────── Page 1 ─────────────────────────────────────


def cover(st: dict[str, ParagraphStyle]) -> list[Flowable]:
    story: list[Flowable] = []
    story.append(Spacer(1, 6 * mm))
    story.append(RLImage(pil(LOGO_WHITE), width=64 * mm, height=64 * mm * LOGO_WHITE_RATIO))
    story.append(Spacer(1, 7 * mm))
    story.append(Paragraph("DOSSIER DE LA BOUTIQUE", st["cover_kicker"]))
    story.append(Paragraph("Tout ce qu'il faut savoir<br/>sur Perokado en ligne", st["cover_title"]))
    story.append(Paragraph(
        "Comment la boutique fonctionne pour vos clients, comment l'équipe la fait vivre, "
        "et ce qu'il reste à mettre en place avant l'ouverture au public.",
        st["cover_sub"],
    ))
    story.append(Spacer(1, 20 * mm))

    rows = [
        ("Boutique", STORE["name"]),
        ("Métier", STORE["sector"]),
        ("Ville", STORE["city"]),
        ("Horaires", STORE["hours"]),
        ("Téléphone / WhatsApp", STORE["phone"]),
        ("Numéro Wave marchand", STORE["wave"]),
        ("Monnaie", STORE["currency"]),
        ("Paiement", STORE["payment"]),
        ("Livraison", STORE["delivery"]),
    ]
    info = Table(
        [[Paragraph(k.upper(), st["label"]), Paragraph(v, st["value"])] for k, v in rows],
        colWidths=[35 * mm, 77 * mm],
    )
    info.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 3.4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3.4),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("LINEBELOW", (0, 0), (-1, -2), 0.4, NAVY_LINE),
    ]))

    qr = Table(
        [
            [Paragraph("Ouvrir la boutique", st["qr_caption"])],
            [RLImage(qr_png(STORE_URL), width=44 * mm, height=44 * mm)],
            [Paragraph("perokado.vercel.app", st["qr_url"])],
            [Paragraph("Scannez avec l'appareil photo<br/>du téléphone.", st["qr_url"])],
        ],
        colWidths=[52 * mm],
    )
    qr.setStyle(TableStyle([
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("BACKGROUND", (0, 0), (-1, -1), colors.white),
        ("BOX", (0, 0), (-1, -1), 0.8, NAVY_LINE),
        ("TOPPADDING", (0, 0), (-1, 0), 7),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 5),
        ("TOPPADDING", (0, 1), (-1, 1), 2),
        ("BOTTOMPADDING", (0, -1), (-1, -1), 7),
    ]))

    identity = Table([[info, qr]], colWidths=[120 * mm, 54 * mm])
    identity.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ]))
    story.append(identity)
    story.append(Spacer(1, 9 * mm))
    story.append(Rule(174 * mm))
    story.append(Spacer(1, 4 * mm))
    toc = Table(
        [[
            Paragraph("<b>1.</b> La boutique en un coup d'œil", st["small"]),
            Paragraph("<b>2.</b> Le site et l'expérience client", st["small"]),
            Paragraph("<b>3.</b> Ce qu'il reste à faire", st["small"]),
        ]],
        colWidths=[58 * mm] * 3,
    )
    toc.setStyle(TableStyle([
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    story.append(toc)
    story.append(Spacer(1, 4 * mm))
    story.append(Rule(174 * mm))
    story.append(Spacer(1, 3.5 * mm))
    story.append(Paragraph(
        "Document préparé pour la direction de Perokado. Les informations commerciales ci-dessus "
        "proviennent des réglages de la boutique et se modifient à tout moment dans "
        "<b>/admin/parametres</b>. Le QR code ouvre la version en ligne actuelle — il sera "
        "régénéré au nom de domaine définitif.",
        st["small"],
    ))
    return story


# ─────────────────────────────── Page 2 ─────────────────────────────────────


def behaviour(st: dict[str, ParagraphStyle]) -> list[Flowable]:
    story: list[Flowable] = []
    story.append(Paragraph("LE SITE VU PAR LE CLIENT", st["kicker"]))
    story.append(Paragraph("Comment la boutique se comporte, du premier clic au colis reçu", st["h1"]))
    story.append(Paragraph(
        "C'est une boutique de quincaillerie : on y cherche une pièce précise, on vérifie qu'elle "
        "est disponible, on commande, on paie par Wave ou en espèces, puis on suit sa commande. "
        "Tout est en français, pensé d'abord pour un téléphone, en FCFA.",
        st["lead"],
    ))

    steps = [
        ("1", "Il arrive", "Rayons, promotions, nouveautés, marques, et la recherche dès la première page."),
        ("2", "Il cherche", "Par nom, référence, marque, catégorie ou <b>photo</b> ; les fautes de frappe sont pardonnées."),
        ("3", "Il vérifie", "Prix, photos, caractéristiques, stock réel, frais et délai de livraison, avant de décider."),
        ("4", "Il commande", "Panier recalculé sur le serveur, quantités bornées au stock, doublons fusionnés."),
        ("5", "Il paie", "Wave depuis son téléphone, ou espèces à la livraison dans Daloa."),
        ("6", "Il suit", "Numéro de commande + téléphone : statut en clair, jusqu'à la remise du colis."),
    ]
    rows = [
        [
            Paragraph(n, ParagraphStyle(
                "n", fontName="DejaVu-Bold", fontSize=13, textColor=colors.white,
                alignment=TA_CENTER, leading=16,
            )),
            Paragraph(f"<b>{title}</b><br/>{text}", st["cell"]),
        ]
        for n, title, text in steps
    ]
    grid = Table(rows, colWidths=[8.5 * mm, 79 * mm])
    grid.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), NAVY),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 4.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4.5),
        ("LEFTPADDING", (0, 0), (0, -1), 0),
        ("RIGHTPADDING", (0, 0), (0, -1), 0),
        ("LEFTPADDING", (1, 0), (1, -1), 7),
        ("LINEBELOW", (1, 0), (-1, -2), 0.4, NAVY_LINE),
    ]))

    side = [
        Paragraph("Les règles de la maison", st["h3"]),
        Paragraph(
            "• Hors de Daloa, le colis part après paiement.<br/>"
            "• Le stock est réservé 2 heures, puis libéré seul.<br/>"
            "• Un stock ne peut jamais devenir négatif.<br/>"
            "• Une capture d'écran Wave n'est jamais une preuve.",
            st["small"],
        ),
        Spacer(1, 6),
        Paragraph("Ce qu'il ne peut pas faire", st["h3"]),
        Paragraph(
            "Voir les données d'un autre client : chaque commande a son jeton, chaque compte "
            "est isolé. Aucun prix n'est calculé dans son navigateur.",
            st["small"],
        ),
    ]
    side_box = Table([[side]], colWidths=[68 * mm])
    side_box.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), NAVY_SOFT),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
    ]))
    two = Table([[grid, side_box]], colWidths=[92 * mm, 80 * mm])
    two.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (0, 0), 4),
        ("LEFTPADDING", (1, 0), (1, 0), 8),
    ]))
    story.append(two)

    story.append(Paragraph("L'expérience client, concrètement", st["h2"]))
    ux_rows = [
        [
            Paragraph("Sur un téléphone", st["cell_bold"]),
            Paragraph("Tout se fait au pouce : boutons larges, prix lisibles, photos légères, "
                      "recherche à partir de l'appareil photo.", st["cell"]),
            Paragraph("Il ne perd jamais le fil", st["cell_bold"]),
            Paragraph("Son panier et ses filtres survivent au rafraîchissement, et son numéro de "
                      "téléphone suffit pour retrouver sa commande.", st["cell"]),
        ],
        [
            Paragraph("La confiance", st["cell_bold"]),
            Paragraph("Coordonnées réelles, horaires, frais annoncés avant le paiement. Une "
                      "information non confirmée est affichée « à compléter », jamais inventée.", st["cell"]),
            Paragraph("Une réponse humaine", st["cell_bold"]),
            Paragraph("Un bouton WhatsApp mène à la boutique ; chaque message du formulaire devient "
                      "une demande suivie dans le back-office.", st["cell"]),
        ],
    ]
    ux = Table(ux_rows, colWidths=[24 * mm, 62 * mm, 26 * mm, 60 * mm])
    ux.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOX", (0, 0), (-1, -1), 0.6, NAVY_LINE),
        ("INNERGRID", (0, 0), (-1, -1), 0.4, NAVY_LINE),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("BACKGROUND", (0, 0), (0, -1), NAVY_SOFT),
        ("BACKGROUND", (2, 0), (2, -1), NAVY_SOFT),
    ]))
    story.append(ux)

    story.append(PageBreak())
    story.append(Paragraph("ET CÔTÉ ÉQUIPE", st["kicker"]))
    story.append(Paragraph("Une équipe outillée, sans jargon", st["h1"]))
    story.append(Spacer(1, 3 * mm))
    story.append(Paragraph("Chacun ne voit que son métier", st["h2"]))
    story.append(Paragraph(
        "Chaque personne reçoit un code personnel par WhatsApp et n'ouvre que les écrans de son "
        "métier : la caisse voit les encaissements, le magasin voit le stock, la direction voit "
        "tout. Les libellés sont en mots simples, et le journal d'activité raconte « qui a fait "
        "quoi » sans un seul terme technique. Aucun agent ne peut créer un compte : seul un "
        "administrateur le fait, et chaque action sensible reste tracée.",
        st["body"],
    ))
    legend = Table([[
        pill("Commande reçue", NAVY_SOFT, NAVY),
        pill("Argent reçu", GREEN_SOFT, GREEN),
        pill("Colis prêt", AMBER_SOFT, AMBER),
        pill("Colis livré", GREEN_SOFT, GREEN),
    ]], colWidths=[43 * mm] * 4)
    legend.setStyle(TableStyle([
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 2),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    story.append(Spacer(1, 2 * mm))
    story.append(legend)
    story.append(Spacer(1, 1.5 * mm))
    story.append(Paragraph(
        "Quatre étapes remplacent les onze statuts internes : c'est le même chemin que le client, vu du comptoir.",
        st["small"],
    ))

    story.append(Paragraph("Comment se passe un paiement Wave", st["h2"]))
    pay_steps = [
        ("Le client paie", "Depuis son application Wave, vers le numéro marchand de la boutique."),
        ("Il indique sa référence", "La commande passe en « paiement à vérifier » : c'est une déclaration, pas une preuve."),
        ("La caisse vérifie", "Un caissier ouvre son propre téléphone, contrôle le crédit, puis confirme avec une phrase de justification."),
        ("La commande continue", "« Argent reçu » : le colis peut être préparé. Un refus renvoie la commande en attente de paiement."),
    ]
    pay_rows = [[
        Paragraph(f"<b>{i}</b>. {title}", st["cell_bold"]),
        Paragraph(text, st["cell"]),
    ] for i, (title, text) in enumerate(pay_steps, start=1)]
    pay = Table(pay_rows, colWidths=[42 * mm, 132 * mm])
    pay.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOX", (0, 0), (-1, -1), 0.6, NAVY_LINE),
        ("INNERGRID", (0, 0), (-1, -1), 0.4, NAVY_LINE),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("BACKGROUND", (0, 0), (0, -1), GREEN_SOFT),
    ]))
    story.append(pay)

    story.append(Paragraph("Les engagements de la boutique", st["h2"]))
    promises = [
        ("Le prix affiché est le prix payé",
         "Aucun frais surprise : les frais de livraison apparaissent avant le paiement, et le total est recalculé sur le serveur."),
        ("Le stock affiché est le stock réel",
         "« Disponible » veut dire pièces en rayon moins pièces déjà promises. Quand il en reste peu, le site le dit."),
        ("Pas d'information inventée",
         "Adresse, horaires, numéro Wave : si une donnée manque, le site l'affiche « à compléter » plutôt que d'inventer."),
        ("Chaque action laisse une trace",
         "Prix, stock, paiements, accès : tout est horodaté avec le nom de la personne. Rien ne peut être effacé en douce."),
        ("Les données restent privées",
         "Un client ne voit que ses propres commandes. Aucun mot de passe n'est stocké en clair, aucune donnée n'est revendue."),
        ("Une réponse humaine",
         "WhatsApp de la boutique et formulaire de contact : un message n'est jamais perdu, il devient une demande suivie."),
    ]
    promise_rows = [
        [
            Paragraph(f"<b>{title}</b>", st["cell_bold"]),
            Paragraph(text, st["small"]),
        ]
        for title, text in promises
    ]
    promise_table = Table(promise_rows, colWidths=[52 * mm, 122 * mm])
    promise_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOX", (0, 0), (-1, -1), 0.6, NAVY_LINE),
        ("INNERGRID", (0, 0), (-1, -1), 0.4, NAVY_LINE),
        ("TOPPADDING", (0, 0), (-1, -1), 3.6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3.6),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("BACKGROUND", (0, 0), (0, -1), NAVY_SOFT),
    ]))
    story.append(promise_table)

    story.append(Paragraph("Les postes que le site sait gérer", st["h2"]))
    roles = [
        ("Propriétaire / Administrateur", "Tout, y compris la création des comptes."),
        ("Caissier / Comptable", "Encaissements à vérifier, statistiques, journal."),
        ("Conseiller de vente", "Commandes, messages des clients, suivi des livraisons."),
        ("Magasinier", "Stock, inventaire, commandes à préparer."),
        ("Gestionnaire catalogue", "Fiches produits, prix, photos, imports."),
        ("Responsable livraisons", "Zones, frais, transporteurs, expéditions."),
        ("Service client", "Demandes reçues et suivi des commandes, en lecture."),
    ]
    half = (len(roles) + 1) // 2
    role_rows = []
    for i in range(half):
        left = roles[i]
        right = roles[i + half] if i + half < len(roles) else ("", "")
        role_rows.append([
            Paragraph(f"<b>{left[0]}</b><br/>{left[1]}", st["small"]),
            Paragraph(f"<b>{right[0]}</b><br/>{right[1]}" if right[0] else "", st["small"]),
        ])
    role_table = Table(role_rows, colWidths=[87 * mm] * 2)
    role_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOX", (0, 0), (-1, -1), 0.6, NAVY_LINE),
        ("INNERGRID", (0, 0), (-1, -1), 0.4, NAVY_LINE),
        ("TOPPADDING", (0, 0), (-1, -1), 3.6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3.6),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(role_table)
    return story


# ─────────────────────────────── Page 3-4 ───────────────────────────────────

STEPS: list[tuple[str, str, list[tuple[str, str, str, str, str]]]] = [
    (
        "1",
        "Hébergement et nom de domaine professionnel",
        [
            ("Acheter le nom de domaine", "Vous",
             "perokado.com ou perokado.ci — .ci auprès du NIC.CI, ou OVH, Namecheap, Cloudflare",
             "≈ 12 000 à 25 000 FCFA par an. À prendre au nom de la boutique, pas d'un prestataire.", "attente"),
            ("Le connecter à Vercel", "Prestataire", "Réglages du projet Vercel, côté domaines",
             "15 minutes : le certificat HTTPS est automatique. Il suffit d'accès au gestionnaire DNS.", "pret"),
            ("Passer l'hébergement en offre payante", "Vous", "Vercel, offre Pro",
             "Aujourd'hui le site tourne sur l'offre gratuite, faite pour les essais : ≈ 20 $ par mois pour des garanties de service et des journaux fiables.", "attente"),
            ("Mettre à jour l'adresse du site", "Prestataire", "Variable APP_URL sur Vercel",
             "Une ligne à changer puis redéploiement : les liens Wave et le plan du site suivent le nouveau domaine.", "pret"),
            ("Sauvegardes de la base", "Prestataire", "Neon — restauration à une date choisie",
             "Vérifier l'offre retenue, puis faire une restauration d'essai une fois : une sauvegarde non testée n'existe pas.", "pret"),
        ],
    ),
    (
        "2",
        "Numéro Wave marchand",
        [
            ("Ouvrir ou confirmer le compte marchand", "Vous", "Wave Business, au nom de la boutique",
             "Wave demande une pièce d'identité et le registre du commerce, puis vérifie le compte avant d'autoriser l'encaissement.", "attente"),
            ("Saisir le vrai numéro marchand", "Vous", "Admin → Réglages → Numéro Wave",
             "Le numéro affiché aujourd'hui est provisoire : c'est le numéro WhatsApp. Il doit devenir celui du compte marchand.", "attente"),
            ("Choisir le mode de paiement", "Vous", "Manuel (conseillé au départ) ou automatique",
             "Manuel : un caissier vérifie chaque crédit sur son téléphone. Automatique : le paiement se confirme seul.", "attente"),
            ("Activer le mode automatique", "Prestataire", "Clé API + secret de webhook Wave",
             "À faire seulement après un test réel avec un petit montant, jamais directement en production.", "pret"),
            ("Trancher le paiement à la livraison", "Vous", "Autorisé ou non, et jusqu'à quel montant",
             "Aujourd'hui limité à Daloa. À ajuster selon votre organisation de livraison et vos risques d'impayé.", "attente"),
        ],
    ),
    (
        "3",
        "Numéro WhatsApp du service client",
        [
            ("Choisir un numéro dédié", "Vous", "Une ligne distincte du téléphone personnel du gérant",
             "Un numéro que plusieurs personnes peuvent consulter, pour ne pas perdre les messages en cas d'absence.", "attente"),
            ("Ouvrir WhatsApp Business", "Vous", "Application gratuite, profil de la boutique",
             "Nom, adresse, horaires, catalogue et message d'absence : c'est ce que le client voit avant d'écrire.", "attente"),
            ("Renseigner le numéro dans le site", "Prestataire", "Admin → Réglages → WhatsApp",
             "Le bouton d'appel de la boutique et les liens de partage utiliseront ce numéro.", "pret"),
            ("Automatiser les envois (optionnel)", "Prestataire", "API WhatsApp Business (Meta) + modèle de message validé",
             "Permet d'envoyer seul les codes d'accès des agents. Sans cela, l'envoi reste manuel depuis « Comptes et accès ».", "option"),
            ("Organiser les réponses", "Vous", "Qui répond, et sous quel délai",
             "Objectif simple : une réponse dans l'heure ouvrée. Les demandes restent aussi visibles dans le back-office.", "attente"),
        ],
    ),
    (
        "4",
        "Intégrations et comptes techniques",
        [
            ("E-mail transactionnel", "Prestataire", "Resend ou Brevo : clé API + adresse d'expédition",
             "Aujourd'hui, les liens d'activation et de réinitialisation sont remis à la main par WhatsApp. L'e-mail les enverrait seul.", "pret"),
            ("Stockage des images", "Prestataire", "Cloudinary : identifiants",
             "Les photos sont aujourd'hui sur un disque qui ne survit pas à un redéploiement. À brancher avant d'envoyer le vrai catalogue.", "pret"),
            ("Catalogue réel", "Vous", "Les 200+ produits : une photo par produit, référence lisible",
             "Nom, rayon, prix et stock s'importent ensuite en une fois ; c'est la partie la plus longue du projet.", "attente"),
            ("Recherche visuelle avancée", "Prestataire", "Fournisseur de vision externe",
             "Le client photographie une pièce et retrouve les produits proches. Le mode local fonctionne déjà, le mode avancé est un abonnement.", "option"),
            ("Mesure d'audience", "Prestataire", "Vercel Analytics ou équivalent",
             "Savoir quelles pages et quels produits sont consultés, sans collecter de données personnelles inutiles.", "option"),
        ],
    ),
    (
        "5",
        "Documents légaux et confiance",
        [
            ("Identité juridique", "Vous", "RCCM, compte contribuable, forme juridique, adresse exacte",
             "Ces mentions sont obligatoires sur le site. Elles restent affichées « à compléter » tant qu'elles ne sont pas fournies.", "attente"),
            ("Conditions de vente et de retour", "Vous", "Garanties, échanges, remboursements",
             "Une page claire évite les litiges. La page retours décrit aujourd'hui la procédure, pas encore vos conditions définitives.", "attente"),
            ("Données personnelles", "Vous", "Déclaration ARTCI, responsable de traitement",
             "Le site collecte noms, téléphones et adresses : une déclaration est nécessaire en Côte d'Ivoire.", "attente"),
            ("Coordonnées de la boutique", "Vous", "Adresse exacte, e-mail de contact",
             "Aucune adresse n'a été inventée : la page « Nous trouver » attend la vôtre.", "attente"),
        ],
    ),
    (
        "6",
        "Avant d'ouvrir au public",
        [
            ("Test réel sur un téléphone", "Prestataire", "Une commande complète, du panier à la livraison",
             "Un vrai téléphone, un vrai numéro Wave, un petit montant : c'est le seul test qui compte vraiment.", "pret"),
            ("Formation de l'équipe", "Prestataire", "Une heure avec la personne de la caisse",
             "Les écrans sont en mots simples et le journal raconte tout : une démonstration suffit, pas un manuel.", "pret"),
            ("Annonce et lancement", "Vous", "WhatsApp, réseaux sociaux, affiche avec le QR code",
             "Le QR code de la première page est prêt à être imprimé tel quel.", "attente"),
        ],
    ),
]


def todo(st: dict[str, ParagraphStyle]) -> list[Flowable]:
    story: list[Flowable] = []
    story.append(Paragraph("LA SUITE DU PROJET", st["kicker"]))
    story.append(Paragraph("Ce qu'il reste à faire, étape par étape", st["h1"]))
    story.append(Paragraph(
        "Le logiciel est en place et testé. Ce qui reste tient à des comptes, des numéros et des "
        "documents à obtenir — pas à du développement. Les étapes sont dans l'ordre recommandé : "
        "chacune débloque la suivante. « À décider » signale ce qui attend une décision de votre "
        "part ; « À exécuter » ce que le prestataire fait ensuite.",
        st["lead"],
    ))

    status = {
        "attente": lambda: pill("À décider", AMBER_SOFT, AMBER),
        "pret": lambda: pill("À exécuter", NAVY_SOFT, NAVY),
        "option": lambda: pill("Optionnel", colors.HexColor("#F3F4F6"), GREY),
    }

    for number, title, items in STEPS:
        head = Table(
            [[
                Paragraph(number, ParagraphStyle(
                    "step_n", fontName="DejaVu-Bold", fontSize=11, textColor=colors.white,
                    alignment=TA_CENTER, leading=14,
                )),
                Paragraph(title, ParagraphStyle(
                    "step_t", fontName="DejaVu-Bold", fontSize=11.5, textColor=NAVY, leading=15,
                )),
            ]],
            colWidths=[8 * mm, 166 * mm],
        )
        head.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (0, 0), ACCENT),
            ("BACKGROUND", (1, 0), (1, 0), ACCENT_SOFT),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("LEFTPADDING", (0, 0), (0, 0), 0),
            ("RIGHTPADDING", (0, 0), (0, 0), 0),
            ("LEFTPADDING", (1, 0), (1, 0), 8),
            ("TOPPADDING", (0, 0), (-1, -1), 5.5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5.5),
        ]))

        rows = [
            [
                Paragraph(f"<b>{label}</b>", st["cell"]),
                Paragraph(f"<b>Qui :</b> {who}<br/><b>Où :</b> {where}", st["small"]),
                Paragraph(why, st["small"]),
                status[state](),
            ]
            for label, who, where, why, state in items
        ]
        table = Table(rows, colWidths=[37 * mm, 51 * mm, 60 * mm, 26 * mm], repeatRows=0)
        table.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("BOX", (0, 0), (-1, -1), 0.5, NAVY_LINE),
            ("INNERGRID", (0, 0), (-1, -1), 0.35, NAVY_LINE),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("LEFTPADDING", (0, 0), (-1, -1), 5),
            ("RIGHTPADDING", (0, 0), (-1, -1), 5),
            ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#FAFBFD")),
        ]))
        story.append(KeepTogether([head, Spacer(1, 1.6 * mm), table]))
        story.append(Spacer(1, 4.6 * mm))

    story.append(Paragraph("Vos trois décisions de la semaine", st["h2"]))
    decisions = [
        ("Le nom du site",
         "Quel nom de domaine ? Par exemple perokado.com. Une fois choisi, tout le reste en dépend : "
         "carte de visite, affiche, QR code, liens Wave."),
        ("Le numéro qui encaisse",
         "Quel numéro Wave marchand reçoit l'argent ? Le numéro actuel n'est que provisoire. "
         "C'est la première question que posera Wave pour ouvrir le compte."),
        ("Le numéro qui répond",
         "Quel numéro WhatsApp les clients verront ? Idéalement une ligne dédiée à la boutique, "
         "consultable par deux personnes, pour ne jamais laisser un client sans réponse."),
    ]
    dec_rows = [
        [Paragraph(f"<b>{i}</b>", ParagraphStyle(
            "dn", fontName="DejaVu-Bold", fontSize=14, textColor=ACCENT, leading=17, alignment=TA_CENTER,
        )),
         Paragraph(f"<b>{title}</b><br/>{text}", st["cell"])]
        for i, (title, text) in enumerate(decisions, start=1)
    ]
    dec_table = Table(dec_rows, colWidths=[10 * mm, 164 * mm])
    dec_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOX", (0, 0), (-1, -1), 0.7, ACCENT),
        ("INNERGRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#FED7AA")),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (0, -1), 0),
        ("RIGHTPADDING", (0, 0), (0, -1), 0),
        ("LEFTPADDING", (1, 0), (1, -1), 7),
        ("RIGHTPADDING", (1, 0), (1, -1), 7),
        ("BACKGROUND", (0, 0), (-1, -1), ACCENT_SOFT),
    ]))
    story.append(dec_table)
    story.append(Spacer(1, 2.5 * mm))
    story.append(Paragraph(
        "Une fois ces trois réponses obtenues, le prestataire termine la configuration en une "
        "demi-journée. Aucune autre information n'est bloquante.",
        st["small"],
    ))

    # Page finale : budget, ce qui est déjà livré, et par où commencer demain.
    story.append(PageBreak())
    story.append(Paragraph("BUDGET ET POINT DE DÉPART", st["kicker"]))
    story.append(Paragraph("Combien ça coûte, et ce qui est déjà payé", st["h1"]))
    story.append(Paragraph(
        "Le logiciel est terminé : il n'y a plus de développement à financer. Les seuls frais "
        "récurrents sont les services qui font tourner la boutique en ligne. Voici les ordres de "
        "grandeur pour décider, pas pour engager.",
        st["lead"],
    ))
    story.append(Paragraph("Budget de mise en route (ordres de grandeur)", st["h2"]))
    budget = [
        ("Nom de domaine (.ci ou .com)", "12 000 – 30 000 FCFA / an",
         "Une seule fois par an, au nom de la boutique."),
        ("Hébergement Vercel Pro", "≈ 12 000 FCFA / mois",
         "Remplace l'offre gratuite : garanties de service et journaux."),
        ("Base de données Neon", "0 FCFA au départ",
         "L'offre gratuite suffit pour démarrer ; offre payante seulement si le trafic grandit."),
        ("Stockage des photos (Cloudinary)", "0 – 10 000 FCFA / mois",
         "Gratuit jusqu'à un volume confortable de photos produit."),
        ("E-mails (Resend ou Brevo)", "0 FCFA au départ",
         "Gratuit jusqu'à quelques centaines d'envois par mois."),
        ("WhatsApp Business", "0 FCFA",
         "Application gratuite ; l'envoi automatique par API est facturé à l'usage."),
        ("Compte marchand Wave", "Commission Wave",
         "Selon le contrat marchand : à confirmer avec Wave, non inclus dans le logiciel."),
    ]
    budget_rows = [
        [Paragraph(f"<b>{a}</b>", st["cell"]), Paragraph(b, st["cell_bold"]), Paragraph(c, st["small"])]
        for a, b, c in budget
    ]
    budget_table = Table(budget_rows, colWidths=[60 * mm, 40 * mm, 74 * mm])
    budget_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOX", (0, 0), (-1, -1), 0.6, NAVY_LINE),
        ("INNERGRID", (0, 0), (-1, -1), 0.4, NAVY_LINE),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("BACKGROUND", (0, 0), (-1, 0), colors.white),
        ("ALIGN", (1, 0), (1, -1), "LEFT"),
    ]))
    story.append(budget_table)
    story.append(Spacer(1, 2 * mm))
    story.append(Paragraph(
        "Estimations de novembre 2026, hors taxes et hors prestation de développement : "
        "elles servent à décider, pas à engager. Un seul poste est vraiment indispensable "
        "au lancement — le nom de domaine.",
        st["small"],
    ))
    story.append(Spacer(1, 4 * mm))

    story.append(Paragraph("Ce qui est déjà livré et testé", st["h2"]))
    delivered = [
        ("Boutique complète", "Accueil, rayons, fiches produits, recherche texte et photo, panier."),
        ("Commande et suivi", "Livraison à domicile, paiement Wave ou à la livraison, suivi par téléphone."),
        ("Espace client", "Compte, adresses, historique, réinitialisation de mot de passe."),
        ("Back-office complet", "Produits, stock, commandes, paiements, messages, livraisons, réglages."),
        ("Comptes et rôles", "Codes d'accès à usage unique, sept métiers, droits limités, traçabilité."),
        ("Journal lisible", "« Qui a fait quoi », en phrases simples, sans jargon technique."),
        ("Sauvegardes et sécurité", "Sessions serveur, anti-bruteforce, double vérification des paiements."),
        ("Version arabe", "Tout le back-office, avec mise en page de droite à gauche."),
    ]
    half = (len(delivered) + 1) // 2
    rows = []
    for i in range(half):
        left = delivered[i]
        right = delivered[i + half] if i + half < len(delivered) else ("", "")
        rows.append([
            Paragraph(f"<b>✔ {left[0]}</b><br/>{left[1]}", st["small"]),
            Paragraph(f"<b>✔ {right[0]}</b><br/>{right[1]}" if right[0] else "", st["small"]),
        ])
    done_table = Table(rows, colWidths=[87 * mm] * 2)
    done_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOX", (0, 0), (-1, -1), 0.6, NAVY_LINE),
        ("INNERGRID", (0, 0), (-1, -1), 0.4, NAVY_LINE),
        ("TOPPADDING", (0, 0), (-1, -1), 4.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4.5),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("BACKGROUND", (0, 0), (-1, -1), GREEN_SOFT),
    ]))
    story.append(done_table)
    story.append(Spacer(1, 5 * mm))

    closing = [
        Rule(174 * mm),
        Spacer(1, 3 * mm),
        Paragraph(
            "<b>Par où commencer demain :</b> réserver le nom de domaine et le compte marchand Wave. "
            "Ce sont les deux seules démarches qui empêchent une vente réelle aujourd'hui. Tout le "
            "reste — WhatsApp, photos, catalogue, documents — peut avancer en parallèle, sans "
            "retoucher une ligne du site.",
            st["small"],
        ),
    ]
    story.append(KeepTogether(closing))
    return story


def main() -> None:
    register_fonts()
    st = styles()
    doc = Brief(
        str(OUT),
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=20 * mm,
        bottomMargin=18 * mm,
        title="Perokado — dossier de la boutique",
        author="Perokado",
        subject="Informations boutique, expérience client et étapes restantes",
        creator="scripts/make-store-brief.py",
    )
    story: list[Flowable] = [
        *cover(st),
        NextPageTemplate("body"),
        PageBreak(),
        *behaviour(st),
        PageBreak(),
        *todo(st),
    ]
    doc.build(story)

    # Signets de navigation (panneau « sommaire » du lecteur PDF).
    try:
        import pymupdf
    except ImportError:  # pragma: no cover - confort de lecture seulement
        pymupdf = None
    if pymupdf is not None:
        with pymupdf.open(OUT) as pdf:
            pdf.set_toc([
                [1, "1. La boutique en un coup d'œil", 1],
                [1, "2. Le site et l'expérience client", 2],
                [2, "Le parcours du client", 2],
                [2, "L'équipe et le paiement Wave", 3],
                [1, "3. Ce qu'il reste à faire", 4],
                [2, "Hébergement et nom de domaine", 4],
                [2, "Numéro Wave marchand", 4],
                [2, "Numéro WhatsApp", 5],
                [2, "Intégrations techniques", 5],
                [2, "Documents légaux", 6],
                [2, "Avant l'ouverture", 6],
                [1, "4. Budget et point de départ", 7],
            ])
            pdf.saveIncr()

    PUBLIC_OUT.parent.mkdir(parents=True, exist_ok=True)
    PUBLIC_OUT.write_bytes(OUT.read_bytes())
    print(f"PDF écrit : {OUT} — {OUT.stat().st_size // 1024} Ko")
    print(f"Publié    : {PUBLIC_OUT}")


if __name__ == "__main__":
    main()
