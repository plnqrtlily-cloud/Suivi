# Génère src/assets/exercise-animations/cou-isometrique-allonge.gif : cou en
# isométrie allongé sur le dos — genoux fléchis, bras le long du corps, les
# épaules restent au sol ; menton rentré, la tête se décolle nettement et reste
# hors du sol (tenue), puis se repose. Même style que les autres animations :
# bonhomme bleu nuit, sol gris, légende orange, 640×360. Personnage agrandi
# pour que le décollement de la tête se voie bien sur téléphone.
# Usage : python3 scripts/animations/cou-isometrique-allonge.py
import math
from PIL import Image, ImageDraw, ImageFont

W, H, S = 640, 360, 3  # dessin en ×3 puis réduction (traits lissés)
INK, GROUND, ORANGE, BG = (29, 42, 58), (195, 202, 211), (232, 89, 12), (255, 255, 255)
FONT = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 22 * S)
SMALL = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 15 * S)
GY = 300  # sol
LW = 9  # épaisseur des traits

def P(x, y):
    return (x * S, y * S)

def seg(d, a, b, w=LW, col=INK):
    d.line([P(*a), P(*b)], fill=col, width=int(w * S))
    for pt in (a, b):
        d.ellipse([P(pt[0] - w / 2, pt[1] - w / 2), P(pt[0] + w / 2, pt[1] + w / 2)], fill=col)

def frame(lift: float, label: str, hold: float | None = None) -> Image.Image:
    im = Image.new("RGB", (W * S, H * S), BG)
    d = ImageDraw.Draw(im)
    d.line([P(20, GY), P(620, GY)], fill=GROUND, width=4 * S)
    y = GY - LW / 2 - 2  # axe du corps posé au sol
    shoulder, hip = (215, y), (390, y)
    knee, ankle, foot = (465, y - 105), (500, y), (535, y)
    elbow, hand = (290, y), (350, y)
    # Tête : rotation autour de la base du cou, de 0° (posée) à 50° (décollée).
    a = math.radians(50 * lift)
    ux, uy = -math.cos(a), -math.sin(a)  # direction épaule → tête
    neck_len, r = 40, 20
    neck_top = (shoulder[0] + ux * neck_len, shoulder[1] + uy * neck_len)
    head = (shoulder[0] + ux * (neck_len + r - 4), shoulder[1] + uy * (neck_len + r - 4))
    for a_, b_ in [(shoulder, hip), (hip, knee), (knee, ankle), (ankle, foot), (shoulder, elbow), (elbow, hand), (shoulder, neck_top)]:
        seg(d, a_, b_)
    d.ellipse([P(head[0] - r, head[1] - r), P(head[0] + r, head[1] + r)], fill=INK)
    # Nez : regarde le plafond, puis vers les genoux quand le menton rentre.
    nx, ny = -uy, ux  # perpendiculaire, côté plafond
    if ny > 0:
        nx, ny = -nx, -ny
    nose = (head[0] + nx * (r + 3), head[1] + ny * (r + 3))
    seg(d, (head[0] + nx * (r - 4), head[1] + ny * (r - 4)), nose, w=6)
    # Espace sous la tête : double flèche orange + « hors du sol ».
    bottom = head[1] + r
    gap = GY - 2 - bottom
    if gap > 14:
        x = head[0]
        d.line([P(x, bottom + 4), P(x, GY - 6)], fill=ORANGE, width=3 * S)
        for yy, s in ((bottom + 4, 1), (GY - 6, -1)):
            d.polygon([P(x, yy), P(x - 6, yy + 9 * s), P(x + 6, yy + 9 * s)], fill=ORANGE)
        d.text(((x - 125) * S, (GY - 34) * S), "hors du sol", font=SMALL, fill=ORANGE)
    # Légende + barre de tenue.
    tw = d.textlength(label, font=FONT)
    d.text((615 * S - tw, 28 * S), label, font=FONT, fill=ORANGE)
    if hold is not None:
        d.rounded_rectangle([P(455, 64), P(615, 74)], radius=5 * S, fill=GROUND)
        d.rounded_rectangle([P(455, 64), P(455 + max(10, 160 * hold), 74)], radius=5 * S, fill=ORANGE)
    return im.resize((W, H), Image.LANCZOS)

def ease(t):
    return 0.5 - 0.5 * math.cos(math.pi * t)

frames = []
frames += [frame(0, "Sur le dos")] * 10
frames += [frame(ease(i / 10), "Menton rentré") for i in range(1, 11)]
frames += [frame(1, "Tenir la tête", i / 39) for i in range(40)]
frames += [frame(1 - ease(i / 10), "Reposer") for i in range(1, 11)]
frames += [frame(0, "Reposer")] * 8

# Palette fixe : dégradés fond→encre, fond→sol, fond→orange (pas de franges
# de couleur parasites sur les bords lissés).
def ramp(c, n):
    return [tuple(round(BG[k] + (c[k] - BG[k]) * i / n) for k in range(3)) for i in range(1, n + 1)]
colors = [BG] + ramp(INK, 14) + ramp(GROUND, 4) + ramp(ORANGE, 10)
palimg = Image.new("P", (1, 1))
palimg.putpalette([v for c in colors for v in c] + [0] * (768 - 3 * len(colors)))
pal = [f.quantize(palette=palimg, dither=Image.Dither.NONE) for f in frames]
pal[0].save(
    "src/assets/exercise-animations/cou-isometrique-allonge.gif",
    save_all=True,
    append_images=pal[1:],
    duration=80,
    loop=0,
    optimize=True,
    disposal=1,
)
print(len(frames), "images")
