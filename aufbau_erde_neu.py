"""
Aufbau der Erde – Präsentation mit Bildplatzhaltern rechts
Person 1: Entstehung, Erdkruste, Ob. Mantel, Unt. Mantel
Person 2: Äuß. Kern, Inn. Kern, Vulkane/Erdbeben, Bedeutung
+ Zusammenfassung + Danke
"""

from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN

OUT = "/home/user/pulsewave-app/Aufbau_der_Erde.pptx"

BG      = RGBColor(0x0a, 0x16, 0x28)
ACCENT  = RGBColor(0x1e, 0x40, 0xaf)
WHITE   = RGBColor(0xFF, 0xFF, 0xFF)
GRAY    = RGBColor(0x94, 0xa3, 0xb8)
GREEN   = RGBColor(0x4a, 0xde, 0x80)
BLUE    = RGBColor(0x60, 0xa5, 0xfa)
ORANGE  = RGBColor(0xfb, 0x92, 0x3c)
RED     = RGBColor(0xf8, 0x71, 0x71)
YELLOW  = RGBColor(0xfb, 0xbf, 0x24)
TEAL    = RGBColor(0x2d, 0xd4, 0xbf)
PURPLE  = RGBColor(0xc0, 0x84, 0xfc)
CARD    = RGBColor(0x0f, 0x23, 0x3d)
IMGBG   = RGBColor(0x0d, 0x1e, 0x35)

P1 = TEAL
P2 = PURPLE

W = Inches(13.33)
H = Inches(7.5)

# Layout constants
LEFT_W   = 7.6   # text area width
IMG_X    = 8.05  # image placeholder x
IMG_Y    = 1.25  # image placeholder y
IMG_W    = 5.0   # image placeholder width
IMG_H    = 6.0   # image placeholder height


def new_prs():
    prs = Presentation()
    prs.slide_width  = W
    prs.slide_height = H
    return prs

def blank(prs):
    return prs.slides.add_slide(prs.slide_layouts[6])

def rect(slide, x, y, w, h, fill):
    sh = slide.shapes.add_shape(1, Inches(x), Inches(y), Inches(w), Inches(h))
    sh.fill.solid(); sh.fill.fore_color.rgb = fill
    sh.line.fill.background()
    return sh

def tb(slide, text, x, y, w, h, size=18, bold=False,
       color=WHITE, align=PP_ALIGN.LEFT, italic=False):
    box = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf  = box.text_frame; tf.word_wrap = True
    p   = tf.paragraphs[0]; p.alignment = align
    r   = p.add_run(); r.text = text
    r.font.size = Pt(size); r.font.bold = bold
    r.font.italic = italic; r.font.color.rgb = color
    return box

def add_lines(tf, lines, size=16, color=WHITE, bold=False):
    for i, line in enumerate(lines):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = PP_ALIGN.LEFT
        r = p.add_run(); r.text = line
        r.font.size = Pt(size); r.font.bold = bold
        r.font.color.rgb = color

def bg(slide):
    rect(slide, 0, 0, 13.33, 7.5, BG)

def header(slide, title, color, tag=None):
    rect(slide, 0, 0, 13.33, 1.1, ACCENT)
    rect(slide, 0, 0, 0.08,  1.1, color)
    tb(slide, title, 0.25, 0.1, 9.5, 0.9, size=30, bold=True)
    if tag:
        tb(slide, tag, 10.5, 0.28, 2.6, 0.5, size=13,
           bold=True, color=color, align=PP_ALIGN.RIGHT)
    rect(slide, 0, 1.1, 13.33, 0.04, color)

def card(slide, x, y, w, h, title, lines, color, lsize=15):
    rect(slide, x, y, w, h, CARD)
    rect(slide, x, y, 0.06, h, color)
    tb(slide, title, x+0.15, y+0.1, w-0.25, 0.38,
       size=14, bold=True, color=color)
    box = slide.shapes.add_textbox(
        Inches(x+0.15), Inches(y+0.5), Inches(w-0.25), Inches(h-0.6))
    box.text_frame.word_wrap = True
    add_lines(box.text_frame, lines, size=lsize)

def img_placeholder(slide, label="📷  Bild hier einfügen"):
    """Empty box on right side for user to insert image."""
    rect(slide, IMG_X, IMG_Y, IMG_W, IMG_H, IMGBG)
    # border effect – thin coloured lines
    rect(slide, IMG_X,            IMG_Y,            IMG_W, 0.04, GRAY)
    rect(slide, IMG_X,            IMG_Y+IMG_H-0.04, IMG_W, 0.04, GRAY)
    rect(slide, IMG_X,            IMG_Y,            0.04,  IMG_H, GRAY)
    rect(slide, IMG_X+IMG_W-0.04, IMG_Y,            0.04,  IMG_H, GRAY)
    # label centered in the box
    tb(slide, label,
       IMG_X, IMG_Y + IMG_H/2 - 0.3, IMG_W, 0.6,
       size=15, color=GRAY, align=PP_ALIGN.CENTER, italic=True)


# ═══════════════════════════════════════════════════════════════
# SLIDES
# ═══════════════════════════════════════════════════════════════

def s_titel(prs):
    s = blank(prs); bg(s)
    # decorative circles right side
    for r_in, col in [(3.6,RGBColor(0x1e,0x3a,0x5f)),
                      (2.7,RGBColor(0x1e,0x40,0xaf)),
                      (1.9,RGBColor(0xfb,0x92,0x3c)),
                      (1.2,RGBColor(0xf8,0x71,0x71)),
                      (0.6,RGBColor(0xfb,0xbf,0x24))]:
        cx,cy = 10.8, 3.75
        s.shapes.add_shape(9, Inches(cx-r_in), Inches(cy-r_in),
                           Inches(r_in*2), Inches(r_in*2))
        ov = s.shapes[-1]
        ov.fill.solid(); ov.fill.fore_color.rgb = col
        ov.line.fill.background()
    rect(s, 0, 0, 7.5, 7.5, BG)
    rect(s, 0, 0, 0.08, 7.5, TEAL)
    tb(s, "🌍", 0.5, 0.6, 1.5, 1.2, size=52)
    tb(s, "Aufbau der Erde", 0.5, 1.7, 6.8, 1.4, size=44, bold=True)
    tb(s, "Erdkruste  ·  Erdmantel  ·  Erdkern",
       0.5, 3.1, 6.8, 0.7, size=20, color=GRAY)
    rect(s, 0.5, 3.85, 6.0, 0.04, TEAL)
    tb(s, "👤 Person 1  —  Folien 2–5", 0.5, 4.05, 6.0, 0.5, size=15, color=P1)
    tb(s, "👤 Person 2  —  Folien 6–9", 0.5, 4.55, 6.0, 0.5, size=15, color=P2)
    tb(s, "Geographie Referat  ·  2026",
       0.5, 6.7, 6.0, 0.5, size=13, color=GRAY)


def s_entstehung(prs):
    s = blank(prs); bg(s)
    header(s, "🌑  Entstehung der Erde", P1, "👤 Person 1  ·  Folie 2")
    card(s, 0.3, 1.25, LEFT_W, 2.9,
         "Entstehung & Differenzierung",
         ["• Vor ~4,6 Mrd. Jahren aus Staub & Gas",
          "• Gravitation → Protoerde",
          "• Erde war komplett geschmolzen",
          "• Schwere Elemente (Eisen) → Kern",
          "• Leichte Gesteine → Kruste"],
         TEAL)
    card(s, 0.3, 4.3, LEFT_W, 2.9,
         "Abkühlung & erste Erde",
         ["• Oberfläche kühlte langsam ab",
          "• Erste feste Erdkruste entstand",
          "• Wasser kondensierte → Ozeane",
          "• Erdradius: 6.371 km",
          "• 5 Schichten: je tiefer → heißer & dichter"],
         YELLOW)
    img_placeholder(s, "📷  Bild: Entstehung der Erde")


def s_erdkruste(prs):
    s = blank(prs); bg(s)
    header(s, "🟢  Die Erdkruste", GREEN, "👤 Person 1  ·  Folie 3")
    card(s, 0.3, 1.25, LEFT_W, 2.9,
         "Kontinentale & Ozeanische Kruste",
         ["• Kontinental: 30–70 km, Granit → Kontinente",
          "• Ozeanisch: 5–10 km, Basalt → Ozeane",
          "• Dünnste Schicht, nur 1% der Erdmasse",
          "• Hauptelemente: Sauerstoff, Silizium"],
         GREEN)
    card(s, 0.3, 4.3, LEFT_W, 2.9,
         "Tektonische Platten",
         ["• Kruste in ~15 große Platten geteilt",
          "• Bewegung: 2–10 cm/Jahr",
          "• Angetrieben durch Konvektion im Mantel",
          "• An Grenzen: Erdbeben, Vulkane, Gebirge"],
         ORANGE)
    img_placeholder(s, "📷  Bild: Erdkruste / Platten")


def s_ob_mantel(prs):
    s = blank(prs); bg(s)
    header(s, "🔵  Der obere Erdmantel", BLUE, "👤 Person 1  ·  Folie 4")
    card(s, 0.3, 1.25, LEFT_W, 2.9,
         "Aufbau & Asthenosphäre",
         ["• Tiefe: 70 – 660 km",
          "• Zustand: zähflüssig / plastisch",
          "• Temperatur: 1.000 – 1.600°C",
          "• Platten 'schwimmen' auf der Asthenosphäre",
          "• Magma kann hier entstehen"],
         BLUE)
    card(s, 0.3, 4.3, LEFT_W, 2.9,
         "Konvektion",
         ["• Heißes Gestein steigt auf",
          "• Kühlt ab und sinkt wieder",
          "• Wie in einem Kochtopf",
          "• Treibt die tektonischen Platten an"],
         TEAL)
    img_placeholder(s, "📷  Bild: Oberer Erdmantel")


def s_unt_mantel(prs):
    s = blank(prs); bg(s)
    header(s, "🟠  Der untere Erdmantel", ORANGE, "👤 Person 1  ·  Folie 5")
    card(s, 0.3, 1.25, LEFT_W, 2.9,
         "Aufbau & Mesosphäre",
         ["• Tiefe: 660 – 2.900 km",
          "• Zustand: FEST (wegen extremem Druck!)",
          "• Temperatur: 1.600 – 3.700°C",
          "• Dickste Schicht → 74% des Erdvolumens",
          "• Gestein: Silikate & Oxide"],
         ORANGE)
    card(s, 0.3, 4.3, LEFT_W, 2.9,
         "Bedeutung",
         ["• Wärmeleitung vom Kern zur Kruste",
          "• Übergang zum Kern bei 2.900 km",
          "• Grenze: Gutenberg-Diskontinuität",
          "• Treibt langfristig Plattenbewegung"],
         RED)
    img_placeholder(s, "📷  Bild: Unterer Erdmantel")


def s_auss_kern(prs):
    s = blank(prs); bg(s)
    header(s, "🔴  Der äußere Erdkern", RED, "👤 Person 2  ·  Folie 6")
    card(s, 0.3, 1.25, LEFT_W, 2.9,
         "Aufbau & Eigenschaften",
         ["• Tiefe: 2.900 – 5.150 km",
          "• Zustand: FLÜSSIG",
          "• Material: Eisen & Nickel",
          "• Temperatur: 4.000 – 5.000°C"],
         RED)
    card(s, 0.3, 4.3, LEFT_W, 2.9,
         "Das Magnetfeld",
         ["• Flüssiges Eisen rotiert → Dynamo-Effekt",
          "• → Erdmagnetfeld entsteht",
          "• Magnetfeld schützt vor Sonnenwind",
          "• Ohne Magnetfeld → kein Leben auf Erde!"],
         PURPLE)
    img_placeholder(s, "📷  Bild: Äußerer Erdkern")


def s_inn_kern(prs):
    s = blank(prs); bg(s)
    header(s, "🟡  Der innere Erdkern", YELLOW, "👤 Person 2  ·  Folie 7")
    card(s, 0.3, 1.25, LEFT_W, 2.9,
         "Aufbau & Eigenschaften",
         ["• Tiefe: 5.150 – 6.371 km",
          "• Zustand: FEST",
          "• Material: Eisen & Nickel",
          "• Temperatur: ~5.500°C",
          "• Radius: ~1.220 km"],
         YELLOW)
    card(s, 0.3, 4.3, LEFT_W, 2.9,
         "Besonderheiten",
         ["• Fest trotz 5.500°C → Druck: 3,6 Mio. bar",
          "• Rotiert leicht schneller als die Erde",
          "• Entdeckt 1936 von Inge Lehmann",
          "• Heißeste Stelle der Erde"],
         ORANGE)
    img_placeholder(s, "📷  Bild: Innerer Erdkern")


def s_vulkane(prs):
    s = blank(prs); bg(s)
    header(s, "🌋  Vulkane & Erdbeben", ORANGE, "👤 Person 2  ·  Folie 8")
    card(s, 0.3, 1.25, LEFT_W, 2.9,
         "Wie entstehen Vulkane & Erdbeben?",
         ["• An Plattengrenzen drückt Magma hoch",
          "• Subduktion → Platte schmilzt → Vulkan",
          "• Platten spannen sich → Entladung = Erdbeben",
          "• Beispiel: Pazifischer Feuerring"],
         RED)
    card(s, 0.3, 4.3, LEFT_W, 2.9,
         "Arten von Plattengrenzen",
         ["• Divergent: Platten entfernen sich → Vulkane",
          "• Konvergent: stoßen zusammen → Gebirge",
          "• Transform: gleiten aneinander → Erdbeben",
          "• Beispiele: Vesuv, Eyjafjallajökull, Himalaya"],
         ORANGE)
    img_placeholder(s, "📷  Bild: Vulkan / Erdbeben")


def s_bedeutung(prs):
    s = blank(prs); bg(s)
    header(s, "🌿  Bedeutung für das Leben", GREEN, "👤 Person 2  ·  Folie 9")
    card(s, 0.3, 1.25, LEFT_W, 2.9,
         "Magnetfeld & Schutz",
         ["• Erdkern erzeugt Magnetfeld",
          "• Schützt vor gefährlichem Sonnenwind",
          "• Ohne Magnetfeld → keine Atmosphäre",
          "• → Kein Leben möglich (wie auf dem Mars)"],
         PURPLE)
    card(s, 0.3, 4.3, LEFT_W, 2.9,
         "Wärme, Energie & Lebensgrundlagen",
         ["• Geothermie: nutzbare Erdwärme",
          "• Vulkane → fruchtbarer Boden",
          "• Gebirge durch Platten → Wasser & Klima",
          "• Kohlenstoffkreislauf durch Tektonik"],
         GREEN)
    img_placeholder(s, "📷  Bild: Leben auf der Erde")


def s_zusammenfassung(prs):
    s = blank(prs); bg(s)
    header(s, "📊  Zusammenfassung", TEAL, None)

    rows = [
        ("🟢 Erdkruste",      "0–70 km",        "0–1.000°C",   "Fest",       "Tektonische Platten",   GREEN),
        ("🔵 Ob. Mantel",     "70–660 km",       "1.000–1.600°C","Zähflüssig","Platten schwimmen drauf",BLUE),
        ("🟠 Unt. Mantel",    "660–2.900 km",    "1.600–3.700°C","Fest",      "Konvektion",            ORANGE),
        ("🔴 Äuß. Kern",      "2.900–5.150 km",  "4.000–5.000°C","Flüssig",  "Erzeugt Magnetfeld",    RED),
        ("🟡 Inn. Kern",      "5.150–6.371 km",  "~5.500°C",    "Fest",       "3,6 Mio. bar Druck",    YELLOW),
    ]

    # header row
    for i, h_txt in enumerate(["Schicht","Tiefe","Temperatur","Zustand","Besonderheit"]):
        rect(s, 0.3 + i*2.52, 1.25, 2.47, 0.5, ACCENT)
        tb(s, h_txt, 0.35 + i*2.52, 1.28, 2.4, 0.44,
           size=13, bold=True, align=PP_ALIGN.CENTER)

    for row_i, (name, tiefe, temp, zust, beson, col) in enumerate(rows):
        y = 1.85 + row_i * 1.05
        bg_col = CARD if row_i % 2 == 0 else RGBColor(0x0a,0x1c,0x35)
        rect(s, 0.3, y, 12.6, 1.0, bg_col)
        rect(s, 0.3, y, 0.06, 1.0, col)
        for ci, val in enumerate([name, tiefe, temp, zust, beson]):
            c = col if ci == 0 else WHITE
            tb(s, val, 0.42 + ci*2.52, y+0.28, 2.4, 0.5,
               size=14, bold=(ci==0), color=c, align=PP_ALIGN.CENTER)

    tb(s, "Je tiefer → desto heißer, dichter und unter höherem Druck",
       0.3, 7.0, 12.6, 0.4, size=14, color=TEAL,
       align=PP_ALIGN.CENTER, italic=True)


def s_danke(prs):
    s = blank(prs); bg(s)
    for r_in, col in [(3.5,RGBColor(0x0f,0x23,0x3d)),
                      (2.6,RGBColor(0x1e,0x40,0xaf)),
                      (1.8,RGBColor(0xfb,0x92,0x3c)),
                      (1.1,RGBColor(0xf8,0x71,0x71)),
                      (0.5,RGBColor(0xfb,0xbf,0x24))]:
        cx,cy = 6.66, 3.4
        s.shapes.add_shape(9, Inches(cx-r_in), Inches(cy-r_in),
                           Inches(r_in*2), Inches(r_in*2))
        ov = s.shapes[-1]
        ov.fill.solid(); ov.fill.fore_color.rgb = col
        ov.line.fill.background()
    rect(s, 0, 0, 13.33, 7.5, RGBColor(0x0a,0x16,0x28))
    tb(s, "🌍", 5.9, 0.3, 1.5, 1.2, size=52, align=PP_ALIGN.CENTER)
    tb(s, "Danke fürs Zuhören!", 1.5, 1.6, 10.3, 1.3,
       size=42, bold=True, align=PP_ALIGN.CENTER)
    tb(s, "Fragen?", 1.5, 2.85, 10.3, 0.8,
       size=28, color=GRAY, align=PP_ALIGN.CENTER)
    rect(s, 2.5, 3.75, 8.33, 0.04, TEAL)
    tb(s, "👤 Person 1  —  Entstehung · Erdkruste · Ob. Mantel · Unt. Mantel",
       1.5, 4.05, 10.3, 0.5, size=13, color=P1, align=PP_ALIGN.CENTER)
    tb(s, "👤 Person 2  —  Äuß. Kern · Inn. Kern · Vulkane & Erdbeben · Bedeutung",
       1.5, 4.55, 10.3, 0.5, size=13, color=P2, align=PP_ALIGN.CENTER)


def main():
    prs = new_prs()
    steps = [
        ("Titel",              s_titel),
        ("Entstehung",         s_entstehung),
        ("Erdkruste",          s_erdkruste),
        ("Oberer Mantel",      s_ob_mantel),
        ("Unterer Mantel",     s_unt_mantel),
        ("Äußerer Kern",       s_auss_kern),
        ("Innerer Kern",       s_inn_kern),
        ("Vulkane & Erdbeben", s_vulkane),
        ("Bedeutung",          s_bedeutung),
        ("Zusammenfassung",    s_zusammenfassung),
        ("Danke",              s_danke),
    ]
    for name, fn in steps:
        print(f"  Folie: {name}...")
        fn(prs)
    prs.save(OUT)
    print(f"\nGespeichert: {OUT}  ({len(steps)} Folien)")

if __name__ == "__main__":
    main()
