# Moteur des animations d'exercices (src/assets/exercise-animations/*.gif).
#
# Un bonhomme articulé (cinématique directe : angles absolus des segments), vu
# de profil, de face ou de dessus, avec son matériel, et des repères pour
# comprendre la technique :
#   - les étapes numérotées en haut (avec leur durée), l'étape en cours en orange ;
#   - la consigne clé de l'étape sous le sol ;
#   - des marqueurs orange sur le corps (ligne du dos, genou, flèche du mouvement) ;
#   - la position de départ en fantôme et la trajectoire d'un point (option).
#
# Angles en degrés, sens trigonométrique, 0 = vers la droite, 90 = vers le haut.
# De profil, le bonhomme regarde à droite ; le côté « R » est le plus proche
# (foncé), le côté « L » le plus éloigné (gris).
import math
from dataclasses import dataclass, field
from PIL import Image, ImageDraw, ImageFont

W, H, S = 640, 360, 2
INK = (29, 42, 58)
FAR = (138, 148, 162)
GHOST = (226, 230, 235)
GROUND = (195, 202, 211)
PROP = (210, 216, 224)
PROP_DARK = (150, 160, 172)
ORANGE = (232, 89, 12)
BG = (255, 255, 255)
GY = 300  # ligne du sol

BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
REG = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
F_CHIP = ImageFont.truetype(BOLD, 13 * S)
F_CUE = ImageFont.truetype(BOLD, 17 * S)
F_TAG = ImageFont.truetype(BOLD, 12 * S)
F_VIEW = ImageFont.truetype(REG, 11 * S)

# Longueurs des segments (px, image 640×360).
L = dict(torso=72, neck=11, head=14, thigh=58, shin=54, foot=20, uarm=45, farm=41, hand=6)
HIP_UP = GY - 6 - 58 - 54 + 0.5  # hanche debout, pieds à plat

# Pose debout de profil (angles absolus).
STAND = dict(
    t=90, h=90,
    thR=-90, shR=-90, ftR=0, thL=-90, shL=-90, ftL=0,
    uaR=-90, faR=-90, uaL=-90, faL=-90,
)


def pose(base=STAND, **kw):
    p = dict(base)
    p.update(kw)
    return p


def rad(a):
    return math.radians(a)


def off(p, a, l):
    return (p[0] + l * math.cos(rad(a)), p[1] - l * math.sin(rad(a)))


def fk(p, root=(0, 0), view="side"):
    """Positions des articulations à partir des angles, hanche au point root."""
    j = {}
    hip = root
    j["hip"] = hip
    k = lambda name: p.get("k_" + name, 1.0)
    neck = off(hip, p["t"], L["torso"] * k("torso"))
    j["neck"] = neck
    j["shoulder"] = off(hip, p["t"], (L["torso"] - 8) * k("torso"))
    j["head"] = off(neck, p["h"], (L["neck"] + L["head"]) * k("head"))
    sw = p.get("sw", 0 if view == "side" else 24)
    hw = p.get("hw", 0 if view == "side" else 12)
    perp = p["t"] - 90  # vers la droite du torse
    for s, sign in (("R", -1), ("L", 1)):
        # De face : le côté droit de l'athlète est à gauche de l'image.
        sh = off(j["shoulder"], perp, sign * sw) if sw else j["shoulder"]
        hp = off(hip, perp, sign * hw) if hw else hip
        j["sh" + s] = sh
        j["hp" + s] = hp
        j["knee" + s] = off(hp, p["th" + s], L["thigh"] * k("th" + s))
        j["ankle" + s] = off(j["knee" + s], p["sh" + s], L["shin"] * k("sh" + s))
        j["toe" + s] = off(j["ankle" + s], p["ft" + s], L["foot"] * k("ft" + s))
        j["heel" + s] = off(j["ankle" + s], p["ft" + s] + 180, 5 * k("ft" + s))
        j["elbow" + s] = off(sh, p["ua" + s], L["uarm"] * k("ua" + s))
        j["wrist" + s] = off(j["elbow" + s], p["fa" + s], L["farm"] * k("fa" + s))
        j["hand" + s] = off(j["wrist" + s], p["fa" + s], L["hand"])
    return j


def anchored(p, anchor, view):
    """Place le corps pour qu'une articulation tombe sur un point fixe."""
    if anchor is None:
        return fk(p, p["root"], view)
    name, (ax, ay) = anchor
    j0 = fk(p, (0, 0), view)
    bx, by = j0[name]
    return fk(p, (ax - bx, ay - by), view)


def ik2(a, b, l1, l2, bend=1):
    """Angles (segment 1, segment 2) pour aller de a à b ; bend choisit le côté
    de l'articulation (+1 : à gauche du trajet a→b, -1 : à droite)."""
    dx, dy = b[0] - a[0], -(b[1] - a[1])
    dist = min(math.hypot(dx, dy), l1 + l2 - 0.01)
    base = math.degrees(math.atan2(dy, dx))
    cos_a = (l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * dist)
    a1 = base + bend * math.degrees(math.acos(max(-1, min(1, cos_a))))
    j = off(a, a1, l1)
    a2 = math.degrees(math.atan2(-(b[1] - j[1]), b[0] - j[0]))
    return a1, a2


def solve(p, hip=None, ankleR=None, ankleL=None, wristR=None, wristL=None,
          kneeR=1, kneeL=1, elbowR=-1, elbowL=-1, view="side"):
    """Pose dont la hanche est en `hip` et les chevilles / poignets aux points
    donnés (côté du genou : +1 = genou vers l'avant quand la jambe descend)."""
    q = dict(p)
    if hip is not None:
        q["root"] = hip
    hip = q["root"]
    j = fk(q, hip, view)
    for s, tgt, bend in (("R", ankleR, kneeR), ("L", ankleL, kneeL)):
        if tgt is not None:
            q["th" + s], q["sh" + s] = ik2(j["hp" + s], tgt, L["thigh"], L["shin"], bend)
    for s, tgt, bend in (("R", wristR, elbowR), ("L", wristL, elbowL)):
        if tgt is not None:
            q["ua" + s], q["fa" + s] = ik2(j["sh" + s], tgt, L["uarm"], L["farm"], bend)
    return q


def lerp(a, b, t):
    return a + (b - a) * t


def ease(t, kind="io"):
    if kind == "lin":
        return t
    if kind == "out":
        return 1 - (1 - t) ** 2
    if kind == "in":
        return t * t
    return 0.5 - 0.5 * math.cos(math.pi * t)


def lerp_pose(a, b, t):
    out = {}
    for k in set(a) | set(b):
        va, vb = a.get(k, b.get(k)), b.get(k, a.get(k))
        if isinstance(va, (int, float)) and isinstance(vb, (int, float)):
            out[k] = lerp(va, vb, t)
        elif isinstance(va, tuple) and isinstance(vb, tuple):
            out[k] = tuple(lerp(x, y, t) for x, y in zip(va, vb))
        else:
            out[k] = vb if t > 0.5 else va
    return out


@dataclass
class Phase:
    to: dict  # pose d'arrivée
    secs: float  # durée réelle annoncée (affichée dans l'étape)
    label: str  # nom de l'étape (vide = étape non affichée, ex. retour rapide)
    cue: str = ""  # consigne affichée sous le sol
    marks: list = field(default_factory=list)  # repères orange
    frames: int | None = None  # nombre d'images (défaut : selon secs)
    kind: str = "io"
    hold: bool = False  # tenue : barre de progression
    anchor: tuple | None = None  # (articulation, (x, y)) fixe pendant l'étape


@dataclass
class Exercise:
    file: str
    start: dict
    phases: list
    anchor: tuple = ("ankleR", (300, GY - 6))
    view: str = "side"  # side | front | top
    view_note: str = ""  # précision affichée en petit (ex. « Vue de dessus »)
    props: list = field(default_factory=list)  # fonctions (draw, joints, frame_ctx)
    ghost: bool = True
    trail: str | None = None  # articulation dont on trace la trajectoire
    ground: bool = True
    hold_frames: int = 6  # pause sur la pose de départ en début de boucle
    labels_far: bool = True
    zoom: float = 1.0  # grossissement de la scène (exercices au sol)
    cx: float = W / 2  # centre horizontal du zoom
    cy: float | None = None  # centre vertical (sinon : le sol reste en place)


# ---------------------------------------------------------------- dessin
def P(x, y):
    return (x * S, y * S)


def seg(d, a, b, w, col):
    d.line([P(*a), P(*b)], fill=col, width=int(w * S))
    r = w / 2
    for q in (a, b):
        d.ellipse([P(q[0] - r, q[1] - r), P(q[0] + r, q[1] + r)], fill=col)


def disc(d, c, r, col):
    d.ellipse([P(c[0] - r, c[1] - r), P(c[0] + r, c[1] + r)], fill=col)


def draw_figure(d, p, j, view, ghost=False):
    far = GHOST if ghost else (FAR if view == "side" else INK)
    near = GHOST if ghost else INK
    LW = 10
    # Membres éloignés d'abord.
    def leg(s, col):
        seg(d, j["hp" + s], j["knee" + s], LW, col)
        seg(d, j["knee" + s], j["ankle" + s], LW - 1, col)
        seg(d, j["heel" + s], j["toe" + s], LW - 3, col)

    def arm(s, col):
        seg(d, j["sh" + s], j["elbow" + s], LW - 2, col)
        seg(d, j["elbow" + s], j["wrist" + s], LW - 3, col)
        disc(d, j["hand" + s], 5.5, col)

    if view == "side":
        leg("L", far)
        arm("L", far)
    else:
        leg("L", near)
        leg("R", near)
    # Tronc (plus épais), cou, tête.
    if view == "side":
        # Buste : plus large à la poitrine qu'au bassin.
        hx, hy = j["hip"]
        sx, sy = j["shoulder"]
        n = math.hypot(sx - hx, sy - hy) or 1
        px, py = -(sy - hy) / n, (sx - hx) / n
        poly = [(hx + px * 8, hy + py * 8), (sx + px * 11, sy + py * 11), (sx - px * 11, sy - py * 11), (hx - px * 8, hy - py * 8)]
        d.polygon([P(*q) for q in poly], fill=near)
        disc(d, j["hip"], 9, near)
        disc(d, j["shoulder"], 11, near)
    else:
        if p.get("k_torso", 1) < 0.3:
            # Vu d'en haut, debout : les épaules forment une ellipse autour de la tête.
            a, b = j["shR"], j["shL"]
            cx, cy = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
            hw_ = abs(b[0] - a[0]) / 2 + 10
            d.ellipse([P(cx - hw_, cy - 15), P(cx + hw_, cy + 15)], fill=near)
            disc(d, (cx, cy), L["head"] + 2, BG if not ghost else GHOST)
            disc(d, (cx, cy), L["head"], near)
            if not ghost:
                face = p.get("face", -90)
                seg(d, off((cx, cy), face, L["head"] - 3), off((cx, cy), face, L["head"] + 6), 6, near)
            return draw_top_arms(d, j, near)
        # De face / dessus : buste plein (épaules → bassin).
        poly = [j["shR"], j["shL"], j["hpL"], j["hpR"]]
        d.polygon([P(*q) for q in poly], fill=near)
        seg(d, j["shR"], j["shL"], LW, near)
        seg(d, j["hpR"], j["hpL"], LW + 2, near)
    seg(d, j["neck"], off(j["neck"], p["h"], L["neck"]), LW - 2, near)
    disc(d, j["head"], L["head"], near)
    if (view == "side" or "face" in p) and not ghost and not p.get("noface"):
        # Nez : indique où regarde la tête.
        face = p.get("face", p["h"] - 90)
        a = off(j["head"], face, L["head"] - 3)
        b = off(j["head"], face, L["head"] + 4)
        seg(d, a, b, 5, near)
    if view == "side":
        leg("R", near)
        arm("R", near)
    else:
        arm("L", near)
        arm("R", near)


def draw_top_arms(d, j, col):
    LW = 10
    for s_ in ("R", "L"):
        seg(d, j["sh" + s_], j["elbow" + s_], LW - 2, col)
        seg(d, j["elbow" + s_], j["wrist" + s_], LW - 3, col)
        disc(d, j["hand" + s_], 5.5, col)


def dashed(d, a, b, col=ORANGE, w=3, dash=8, gap=6):
    dx, dy = b[0] - a[0], b[1] - a[1]
    n = math.hypot(dx, dy)
    if n < 1:
        return
    ux, uy = dx / n, dy / n
    t = 0
    while t < n:
        e = min(n, t + dash)
        d.line([P(a[0] + ux * t, a[1] + uy * t), P(a[0] + ux * e, a[1] + uy * e)], fill=col, width=int(w * S))
        t += dash + gap


def arrow(d, a, b, col=ORANGE, w=4):
    d.line([P(*a), P(*b)], fill=col, width=int(w * S))
    ang = math.atan2(b[1] - a[1], b[0] - a[0])
    hl = 11
    p1 = (b[0] - hl * math.cos(ang - 0.5), b[1] - hl * math.sin(ang - 0.5))
    p2 = (b[0] - hl * math.cos(ang + 0.5), b[1] - hl * math.sin(ang + 0.5))
    d.polygon([P(*b), P(*p1), P(*p2)], fill=col)


def tag(d, xy, text, anchor="lm"):
    x, y = xy
    x = max(6, min(W - 6, x))
    y = max(48, min(GY - 12, y))
    tw = d.textlength(text, font=F_TAG) / S
    if anchor == "rm":
        x -= tw
    elif anchor == "mm":
        x -= tw / 2
    x = max(6, min(W - 6 - tw, x))
    # Petit fond blanc pour rester lisible sur le dessin.
    d.rounded_rectangle([P(x - 3, y - 9), P(x + tw + 3, y + 9)], radius=4 * S, fill=BG)
    d.text(P(x, y - 8), text, font=F_TAG, fill=ORANGE)


def resolve(j, pt):
    """Un point : nom d'articulation, tuple, ou ('mid', a, b) / ('off', a, dx, dy)."""
    if isinstance(pt, str):
        return j[pt]
    if isinstance(pt, tuple) and pt and pt[0] == "mid":
        a, b = resolve(j, pt[1]), resolve(j, pt[2])
        return ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
    if isinstance(pt, tuple) and pt and pt[0] == "off":
        a = resolve(j, pt[1])
        return (a[0] + pt[2], a[1] + pt[3])
    return pt


def draw_marks(d, j, marks):
    for m in marks:
        kind = m[0]
        if kind == "line":  # ligne pointillée entre deux points, prolongée
            _, a, b, text, *rest = m + (None,) * 0
            a, b = resolve(j, a), resolve(j, b)
            ext = rest[0] if rest else 14
            dx, dy = b[0] - a[0], b[1] - a[1]
            n = math.hypot(dx, dy) or 1
            a2 = (a[0] - dx / n * ext, a[1] - dy / n * ext)
            b2 = (b[0] + dx / n * ext, b[1] + dy / n * ext)
            dashed(d, a2, b2)
            if text:
                side = rest[1] if len(rest) > 1 else (14, -14)
                tag(d, ((a[0] + b[0]) / 2 + side[0], (a[1] + b[1]) / 2 + side[1]), text, "mm")
        elif kind == "arrow":  # flèche de mouvement à partir d'un point
            _, a, dx, dy, *rest = m
            a = resolve(j, a)
            arrow(d, a, (a[0] + dx, a[1] + dy))
            if rest and rest[0]:
                ox, oy = rest[1] if len(rest) > 1 else (8, 0)
                tag(d, (a[0] + dx + ox, a[1] + dy + oy), rest[0], "lm" if ox >= 0 else "rm")
        elif kind == "ring":  # cercle autour d'une articulation
            _, a, *rest = m
            a = resolve(j, a)
            r = 15
            d.ellipse([P(a[0] - r, a[1] - r), P(a[0] + r, a[1] + r)], outline=ORANGE, width=3 * S)
            if rest and rest[0]:
                ox, oy = rest[1] if len(rest) > 1 else (20, -18)
                tag(d, (a[0] + ox, a[1] + oy), rest[0], "lm" if ox >= 0 else "rm")
        elif kind == "vline":  # repère vertical passant par un point
            _, a, *rest = m
            a = resolve(j, a)
            top = rest[1] if len(rest) > 1 else a[1] - 90
            dashed(d, (a[0], top), (a[0], GY), w=2, dash=6, gap=5)
            if rest and rest[0]:
                tag(d, (a[0] + 6, top - 2), rest[0])
        elif kind == "hline":  # repère horizontal passant par un point
            _, a, x0, x1, *rest = m
            a = resolve(j, a)
            dashed(d, (x0, a[1]), (x1, a[1]), w=2, dash=6, gap=5)
            if rest and rest[0]:
                tag(d, (x1 + 4, a[1]), rest[0])
        elif kind == "tag":
            _, a, text, *rest = m
            a = resolve(j, a)
            tag(d, a, text, rest[0] if rest else "lm")


def chips(d, ex, cur, hold_t):
    labels = []
    for ph in ex.phases:
        if ph.label and ph.label not in [x[0] for x in labels]:
            labels.append((ph.label, ph.secs, ph.hold))
    x, y = 12, 12
    for i, (lab, secs, hold) in enumerate(labels):
        text = f"{i + 1}  {lab}" + (f" · {fmt_secs(secs)}" if secs >= 1 else "")
        tw = d.textlength(text, font=F_CHIP) / S
        if x + tw + 20 > W - 10:
            x, y = 12, y + 30
        active = lab == cur
        d.rounded_rectangle([P(x, y), P(x + tw + 18, y + 24)], radius=12 * S,
                            fill=ORANGE if active else (243, 244, 246))
        d.text(P(x + 9, y + 5), text, font=F_CHIP, fill=BG if active else (110, 118, 130))
        if active and hold and hold_t is not None:
            d.rounded_rectangle([P(x + 9, y + 26), P(x + tw + 9, y + 30)], radius=2 * S, fill=GROUND)
            d.rounded_rectangle([P(x + 9, y + 26), P(x + 9 + max(4, tw * hold_t), y + 30)], radius=2 * S, fill=ORANGE)
        x += tw + 26


def fmt_secs(s):
    return f"{s:g} s".replace(".", ",")


def render(ex: Exercise, out_path: str, frame_ms=80):
    # Liste des images : (pose, ancre, étape, t dans l'étape)
    seq = []
    cur = ex.start
    cur_anchor = ex.anchor
    for _ in range(ex.hold_frames):
        seq.append((cur, cur_anchor, ex.phases[0], None, cur))
    ends = []
    for ph in ex.phases:
        n = ph.frames or max(4, round(ph.secs * 1000 / frame_ms))
        a_from = cur_anchor
        a_to = ph.anchor or cur_anchor
        for i in range(1, n + 1):
            t = i / n
            seq.append((lerp_pose(cur, ph.to, ease(t, ph.kind) if not ph.hold else 1.0), (a_from, a_to, t), ph, t, cur))
        cur = ph.to
        cur_anchor = a_to
        ends.append(len(seq) - 1)

    start_j = anchored(ex.start, ex.anchor, ex.view)
    trail_pts = []
    if ex.trail:
        for p, anc, ph, t, prev in seq:
            trail_pts.append(joints_for(p, anc, ex.view)[ex.trail])

    frames = []
    for p, anc, ph, t, prev in seq:
        im = Image.new("RGB", (W * S, H * S), BG)
        d = ImageDraw.Draw(im)
        if ex.ground:
            d.line([P(16, GY), P(W - 16, GY)], fill=GROUND, width=3 * S)
        j = joints_for(p, anc, ex.view)
        ctx = dict(p=p, phase=ph, t=t, start=start_j)
        for pr in ex.props:
            if getattr(pr, "behind", True):
                pr(d, j, ctx)
        if ex.ghost:
            draw_figure(d, ex.start, start_j, ex.view, ghost=True)
        if trail_pts:
            d.line([P(*q) for q in trail_pts], fill=(246, 190, 160), width=2 * S, joint="curve")
        draw_figure(d, p, j, ex.view)
        for pr in ex.props:
            if not getattr(pr, "behind", True):
                pr(d, j, ctx)
        if t is not None and ph.marks:
            draw_marks(d, j, ph.marks)
        if ex.zoom != 1:
            z = ex.zoom
            x0 = max(0, min(W - W / z, ex.cx - W / (2 * z)))
            y0 = GY - GY / z if ex.cy is None else max(0, min(H - H / z, ex.cy - H / (2 * z)))
            im = im.crop((int(x0 * S), int(y0 * S), int((x0 + W / z) * S), int((y0 + H / z) * S))).resize((W * S, H * S), Image.LANCZOS)
            d = ImageDraw.Draw(im)
            # La consigne s'écrit sur un fond propre sous le sol.
            d.rectangle([P(0, GY + 3), P(W, H)], fill=BG)
        label = ph.label if t is not None else (ex.phases[0].label)
        chips(d, ex, label if t is not None else None, t if (t is not None and ph.hold) else None)
        cue = ph.cue if t is not None else ex.phases[0].cue
        if cue:
            tw = d.textlength(cue, font=F_CUE) / S
            d.text(P((W - tw) / 2, GY + 14), cue, font=F_CUE, fill=ORANGE)
        if ex.view_note:
            tw = d.textlength(ex.view_note, font=F_VIEW) / S
            d.text(P(W - 12 - tw, GY + 40), ex.view_note, font=F_VIEW, fill=(140, 148, 160))
        frames.append(im.resize((W, H), Image.LANCZOS))
    save_gif(frames, out_path, frame_ms)
    return frames, ends


def joints_for(p, anc, view):
    if isinstance(anc, tuple) and len(anc) == 3 and isinstance(anc[2], float):
        a_from, a_to, t = anc
        if a_to is None:
            return fk(p, p["root"], view)
        if a_from == a_to or a_from is None:
            return anchored(p, a_to, view)
        ja = anchored(p, a_from, view)
        jb = anchored(p, a_to, view)
        root = (lerp(ja["hip"][0], jb["hip"][0], t), lerp(ja["hip"][1], jb["hip"][1], t))
        return fk(p, root, view)
    return anchored(p, anc, view)


def save_gif(frames, path, frame_ms):
    def ramp(c, n):
        return [tuple(round(BG[k] + (c[k] - BG[k]) * i / n) for k in range(3)) for i in range(1, n + 1)]

    colors = [BG] + ramp(INK, 16) + ramp(FAR, 6) + ramp(PROP_DARK, 6) + ramp(GROUND, 4) + ramp(ORANGE, 14)
    colors += [(243, 244, 246), (110, 118, 130), GHOST, PROP, (246, 190, 160)]
    colors = colors[:256]
    palimg = Image.new("P", (1, 1))
    palimg.putpalette([v for c in colors for v in c] + [0] * (768 - 3 * len(colors)))
    pal = [f.quantize(palette=palimg, dither=Image.Dither.NONE) for f in frames]
    pal[0].save(path, save_all=True, append_images=pal[1:], duration=frame_ms, loop=0, optimize=True, disposal=1)


# ---------------------------------------------------------------- matériel
def prop(behind=True):
    def deco(fn):
        fn.behind = behind
        return fn
    return deco


def dumbbell_at(*joints, horizontal=False):
    @prop(behind=False)
    def draw(d, j, ctx):
        for name in joints:
            c = j[name]
            if horizontal:
                a, b = (c[0] - 13, c[1]), (c[0] + 13, c[1])
            else:
                a, b = (c[0] - 11, c[1]), (c[0] + 11, c[1])
            seg(d, a, b, 5, ORANGE)
            for q in (a, b):
                d.rounded_rectangle([P(q[0] - 4, q[1] - 9), P(q[0] + 4, q[1] + 9)], radius=2 * S, fill=ORANGE)
    return draw


def dumbbell_side(*joints):
    """Haltère vu de bout (de profil) : un disque orange."""
    @prop(behind=False)
    def draw(d, j, ctx):
        for name in joints:
            c = j[name]
            d.ellipse([P(c[0] - 11, c[1] - 11), P(c[0] + 11, c[1] + 11)], outline=ORANGE, width=5 * S)
            disc(d, c, 3, ORANGE)
    return draw


def kettlebell(joint="handR", dy=10):
    @prop(behind=False)
    def draw(d, j, ctx):
        c = j[joint]
        body = (c[0] + 4, c[1] + dy)
        d.arc([P(body[0] - 9, body[1] - 22), P(body[0] + 9, body[1] - 4)], 180, 360, fill=ORANGE, width=4 * S)
        disc(d, body, 13, ORANGE)
    return draw


def rect(x0, y0, x1, y1, col=PROP, behind=True):
    @prop(behind=behind)
    def draw(d, j, ctx):
        d.rounded_rectangle([P(x0, y0), P(x1, y1)], radius=3 * S, fill=col)
    return draw


def bench(x0, x1, top, legs=True):
    @prop()
    def draw(d, j, ctx):
        d.rounded_rectangle([P(x0, top), P(x1, top + 10)], radius=3 * S, fill=PROP_DARK)
        if legs:
            for x in (x0 + 10, x1 - 14):
                d.rectangle([P(x, top + 10), P(x + 5, GY)], fill=PROP)
    return draw


def box(x0, x1, top):
    return rect(x0, top, x1, GY, PROP)


def wall(x):
    @prop()
    def draw(d, j, ctx):
        d.rectangle([P(x, 40), P(x + 12, GY)], fill=PROP)
    return draw


def bar(y, x0, x1):
    @prop()
    def draw(d, j, ctx):
        seg(d, (x0, y), (x1, y), 6, PROP_DARK)
        d.rectangle([P(x0 - 4, y - 30), P(x0 + 2, y)], fill=PROP)
        d.rectangle([P(x1 - 2, y - 30), P(x1 + 4, y)], fill=PROP)
    return draw


def band(anchor_xy, joint):
    @prop(behind=False)
    def draw(d, j, ctx):
        a = anchor_xy
        d.rounded_rectangle([P(a[0] - 5, a[1] - 14), P(a[0] + 5, a[1] + 14)], radius=2 * S, fill=PROP_DARK)
        b = resolve(j, joint)
        d.line([P(*a), P(*b)], fill=ORANGE, width=3 * S)
    return draw


def stick(j1, j2, ext=(30, 30), col=ORANGE):
    @prop(behind=False)
    def draw(d, j, ctx):
        a, b = resolve(j, j1), resolve(j, j2)
        dx, dy = b[0] - a[0], b[1] - a[1]
        n = math.hypot(dx, dy) or 1
        a2 = (a[0] - dx / n * ext[0], a[1] - dy / n * ext[0])
        b2 = (b[0] + dx / n * ext[1], b[1] + dy / n * ext[1])
        seg(d, a2, b2, 5, col)
    return draw


def label_far():
    return None


def ang(a, b):
    """Angle (degrés) du segment a → b."""
    return math.degrees(math.atan2(-(b[1] - a[1]), b[0] - a[0]))


def toward(a, angle, l):
    return off(a, angle, l)
