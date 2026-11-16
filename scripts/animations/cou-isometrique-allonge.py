# Génère src/assets/exercise-animations/cou-isometrique.gif : cou en isométrie
# allongé sur le dos — genoux fléchis, la tête se décolle (menton rentré) et
# reste hors du sol, puis se repose. Même style que les autres animations :
# bonhomme bleu nuit, sol gris, légende orange en bas à droite, 640×360, 80 ms.
# Usage : python3 scripts/animations/cou-isometrique-allonge.py
import math
from PIL import Image, ImageDraw, ImageFont

W, H, S = 640, 360, 3  # dessin en ×3 puis réduction (traits lissés)
INK, GROUND, ORANGE, BG = (29, 42, 58), (195, 202, 211), (232, 89, 12), (255, 255, 255)
FONT = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 19 * S)
GY = 334  # sol
LW = 6  # épaisseur des traits

def P(x, y):
    return (x * S, y * S)

def frame(lift: float, label: str) -> Image.Image:
    im = Image.new("RGB", (W * S, H * S), BG)
    d = ImageDraw.Draw(im)
    d.line([P(10, GY), P(630, GY)], fill=GROUND, width=3 * S)
    y = GY - 9  # axe du corps posé au sol
    shoulder = (190, y)
    hip = (303, y)
    knee = (360, y - 58)
    ankle = (378, y + 4)
    foot = (400, y + 4)
    hand = (276, y + 2)
    # Tête : rotation autour de la base du cou, de 0° (posée) à 32° (décollée).
    a = math.radians(32 * lift)
    neck_len, r = 17, 12
    neck_top = (shoulder[0] - neck_len * math.cos(a), shoulder[1] - neck_len * math.sin(a))
    head = (shoulder[0] - (neck_len + r - 2) * math.cos(a), shoulder[1] - (neck_len + r - 2) * math.sin(a) - 1)
    for a_, b_ in [(shoulder, hip), (hip, knee), (knee, ankle), (ankle, foot), (shoulder, hand), (shoulder, neck_top)]:
        d.line([P(*a_), P(*b_)], fill=INK, width=LW * S, joint="curve")
        for pt in (a_, b_):
            d.ellipse([P(pt[0] - LW / 2, pt[1] - LW / 2), P(pt[0] + LW / 2, pt[1] + LW / 2)], fill=INK)
    d.ellipse([P(head[0] - r, head[1] - r), P(head[0] + r, head[1] + r)], fill=INK)
    # Repère « hors du sol » pendant la tenue : petit espace pointillé sous la tête.
    if lift > 0.95:
        for x in range(int(head[0]) - 10, int(head[0]) + 12, 6):
            d.line([P(x, GY - 4), P(x + 3, GY - 4)], fill=ORANGE, width=2 * S)
    tw = d.textlength(label, font=FONT)
    d.text((620 * S - tw, 305 * S), label, font=FONT, fill=ORANGE)
    return im.resize((W, H), Image.LANCZOS)

def ease(t):
    return 0.5 - 0.5 * math.cos(math.pi * t)

frames = []
frames += [frame(0, "Sur le dos")] * 8
frames += [frame(ease(i / 8), "Menton rentré") for i in range(1, 9)]
frames += [frame(1, "Tenir")] * 26
frames += [frame(1 - ease(i / 8), "Reposer") for i in range(1, 9)]
frames += [frame(0, "Reposer")] * 6

# Palette fixe : dégradés fond→encre, fond→sol, fond→orange (pas de franges
# de couleur parasites sur les bords lissés).
def ramp(c, n):
    return [tuple(round(BG[k] + (c[k] - BG[k]) * i / n) for k in range(3)) for i in range(1, n + 1)]
colors = [BG] + ramp(INK, 14) + ramp(GROUND, 4) + ramp(ORANGE, 10)
palimg = Image.new("P", (1, 1))
palimg.putpalette([v for c in colors for v in c] + [0] * (768 - 3 * len(colors)))
pal = [f.quantize(palette=palimg, dither=Image.Dither.NONE) for f in frames]
pal[0].save(
    "src/assets/exercise-animations/cou-isometrique.gif",
    save_all=True,
    append_images=pal[1:],
    duration=80,
    loop=0,
    optimize=True,
    disposal=1,
)
print(len(frames), "images")
