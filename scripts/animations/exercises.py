# Les 38 exercices animés. Chaque exercice : une pose de départ, des étapes
# (pose d'arrivée, durée, nom, consigne, repères). Génération :
#   python3 scripts/animations/build.py            (tous)
#   python3 scripts/animations/build.py goblet-squat
from engine import *

A = GY - 6  # hauteur des chevilles, pied à plat au sol
ALL = []


def add(ex, glue=None):
    """glue : articulation qui reste fixée au sol pendant tout le mouvement
    (le pied d'appui) — le corps s'articule autour au lieu de glisser."""
    if glue:
        j = fk(ex.start, ex.start["root"], ex.view)
        ex.anchor = (glue, j[glue])
    ALL.append(ex)
    return ex


def up(**kw):
    return pose(STAND, **kw)


# Bras qui tiennent une charge contre la poitrine (goblet).
GOB = dict(uaR=-72, faR=72, uaL=-72, faL=72)

# ------------------------------------------------------------- Goblet squat
g_up = solve(up(**GOB), hip=(320, HIP_UP), ankleR=(322, A), ankleL=(318, A))
g_down = solve(up(t=66, h=80, **GOB), hip=(278, 244), ankleR=(322, A), ankleL=(318, A))
add(Exercise(
    "goblet-squat.gif", g_up, [
        Phase(g_down, 3, "Descendre", "Talons au sol, poitrine fière",
              [("line", "hip", "shoulder", "dos droit", 16, (-46, 0)),
               ("ring", "kneeR", "genou dans l'axe du pied", (20, -22))]),
        Phase(g_down, 1, "Tenir en bas", "Talons au sol, poitrine fière",
              [("line", "hip", "shoulder", "dos droit", 16, (-46, 0)), ("ring", "heelR", "talon collé", (-22, 20))], hold=True),
        Phase(g_up, 1.5, "Remonter", "Pousser le sol avec tout le pied",
              [("arrow", ("off", "hip", -34, 10), 0, -44, "pousser", (-6, 0))]),
    ], anchor=None, props=[kettlebell("handR", 9)]), glue="ankleR")

gp_down = solve(up(t=72, h=84, **GOB), hip=(292, 246), ankleR=(322, A), ankleL=(318, A))
add(Exercise(
    "goblet-squat-pause.gif", g_up, [
        Phase(gp_down, 2.5, "Descendre", "Genoux qui avancent, talons au sol",
              [("vline", "toeR", "orteils", 150), ("ring", "kneeR", "genoux en avant", (20, -22))]),
        Phase(gp_down, 2, "Pause en bas", "2 s immobile, buste haut",
              [("vline", "toeR", "orteils", 150), ("ring", "heelR", "talon au sol", (-22, 20))], hold=True),
        Phase(g_up, 1.5, "Remonter", "Pousser le sol, sans décoller les talons",
              [("arrow", ("off", "hip", -34, 10), 0, -44, "pousser", (-6, 0))]),
    ], anchor=None, props=[kettlebell("handR", 9)]), glue="ankleR")


# ------------------------------------------------- Split squat genou en avant
@prop()
def wedge(d, j, ctx):
    d.polygon([P(372, GY), P(438, GY), P(438, GY - 12)], fill=PROP_DARK)


ss_up = solve(up(uaR=-88, faR=-90, uaL=-92, faL=-90, ftR=10), hip=(320, HIP_UP), ankleR=(392, GY - 13), ankleL=(232, A - 6), kneeR=1, kneeL=1)
ss_up["ftL"] = -40
ss_down = solve(up(uaR=-88, faR=-90, uaL=-92, faL=-90, ftR=10, t=86), hip=(328, 238), ankleR=(392, GY - 13), ankleL=(234, A - 6), kneeR=1, kneeL=1)
ss_down["ftL"] = -40
add(Exercise(
    "split-squat-genou-en-avant.gif", ss_up, [
        Phase(ss_down, 3, "Descendre", "Le genou avant part loin devant",
              [("ring", "kneeR", "genou loin devant", (18, -22)), ("vline", "toeR", "", 150), ("ring", "heelR", "talon collé", (-20, 22))]),
        Phase(ss_up, 1.5, "Remonter", "Pousser dans le pied avant",
              [("arrow", ("off", "hip", -30, 0), 0, -44, "pousser", (-6, 0))]),
    ], anchor=None, props=[wedge, dumbbell_side("handR")]), glue="ankleR")


# ------------------------------------------------------------ Fente genou-mur
fm_base = up(t=90, uaR=-20, faR=5, uaL=-25, faL=5)
fm_a = solve(fm_base, hip=(332, 244), ankleR=(400, A), ankleL=(258, GY - 10), kneeR=1, kneeL=1)
fm_a["ftL"] = 180
fm_b = solve(dict(fm_base, t=84), hip=(376, 254), ankleR=(400, A), ankleL=(258, GY - 10), kneeR=1, kneeL=1)
fm_b["ftL"] = 180
# Mains contre le mur.
fm_a = solve(fm_a, wristR=(478, 168), wristL=(476, 172), elbowR=-1, elbowL=-1)
fm_b = solve(fm_b, wristR=(478, 172), wristL=(476, 176), elbowR=-1, elbowL=-1)
add(Exercise(
    "fente-genou-mur.gif", fm_a, [
        Phase(fm_b, 1.5, "Genou vers le mur", "Le genou avance, le talon reste collé",
              [("arrow", ("off", "kneeR", 18, 0), 40, 0, "", (0, 0)), ("ring", "heelR", "talon collé", (-22, 22))]),
        Phase(fm_b, 1, "Tenir", "Talon au sol, genou dans l'axe du pied",
              [("ring", "heelR", "talon collé", (-22, 22))], hold=True),
        Phase(fm_a, 1, "Revenir", "Talon au sol, genou dans l'axe du pied"),
    ], anchor=None, props=[wall(484)], ghost=True), glue="ankleR")


# ------------------------------------------------------------ Step-down lent
@prop()
def step_box(d, j, ctx):
    d.rounded_rectangle([P(250, GY - 40), P(352, GY)], radius=3 * S, fill=PROP)


SB = GY - 40 - 6  # cheville sur la box
sd_up = solve(up(uaR=-70, faR=-40, uaL=-60, faL=-30), hip=(318, SB - 112), ankleR=(320, SB), ankleL=(372, SB - 6), kneeR=1, kneeL=1)
sd_up["ftL"] = -10
sd_down = solve(up(t=76, uaR=-40, faR=-10, uaL=-35, faL=-5), hip=(290, SB - 66), ankleR=(320, SB), ankleL=(388, GY - 8), kneeR=1, kneeL=-1)
sd_down["ftL"] = 10
add(Exercise(
    "step-down-lent.gif", sd_up, [
        Phase(sd_down, 3, "Descendre lentement", "3 s : le talon libre vient effleurer le sol",
              [("ring", "kneeR", "genou dans l'axe du pied", (20, -22)), ("ring", "heelL", "effleure", (16, 22))]),
        Phase(sd_up, 1.5, "Remonter", "Pousser dans le talon sur la box",
              [("arrow", ("off", "hip", -30, 0), 0, -40, "pousser", (-6, 0))]),
    ], anchor=None, props=[step_box]), glue="ankleR")


# ----------------------------------------------- Squat profond + rotation
sp_down = solve(up(t=74, h=82), hip=(286, 250), ankleR=(328, A), ankleL=(322, A))
sp_down = solve(sp_down, wristR=(352, 222), wristL=(350, 226), elbowR=-1, elbowL=-1)
sp_rot = dict(sp_down, uaR=96, faR=96, h=110, face=40)
add(Exercise(
    "squat-profond-rotation.gif", g_up, [
        Phase(sp_down, 1.5, "Squat profond", "Talons au sol, coudes à l'intérieur des genoux",
              [("ring", "heelR", "talons au sol", (-22, 20))]),
        Phase(sp_rot, 1.5, "Bras vers le ciel", "On ouvre le buste, le regard suit la main",
              [("arrow", ("off", "handR", 14, 30), 0, -50, "ouvrir le buste", (10, 10))]),
        Phase(sp_rot, 1, "Tenir", "Le regard suit la main", hold=True),
        Phase(sp_down, 1, "Ramener", "Puis l'autre côté"),
        Phase(g_up, 1.2, "", ""),
    ], anchor=None), glue="ankleR")


# ------------------------------------------ Soulevé de terre jambes tendues
rdl_up = solve(up(uaR=-84, faR=-88, uaL=-84, faL=-88), hip=(320, HIP_UP), ankleR=(320, A), ankleL=(318, A))
# Jambes quasi tendues : les tibias restent presque verticaux, ce sont les
# hanches qui reculent et le buste qui bascule, dos plat.
rdl_down = dict(rdl_up, t=20, h=8, face=-70, thR=-114, shR=-86, thL=-114, shL=-86, uaR=-104, faR=-100, uaL=-104, faL=-100)
add(Exercise(
    "souleve-de-terre-jambes-tendues.gif", rdl_up, [
        Phase(rdl_down, 3, "Hanches en arrière", "Dos plat, les haltères glissent le long des jambes",
              [("line", "hip", "neck", "dos plat", 18, (0, -26)), ("arrow", ("off", "hip", -16, 0), -40, 0, "hanches en arrière", (-6, -16))]),
        Phase(rdl_up, 1.5, "Remonter", "Pousser les hanches vers l'avant",
              [("arrow", ("off", "hip", -20, 0), 34, 0, "", (0, 0))]),
    ], anchor=None, props=[dumbbell_side("handR")], trail="handR"), glue="ankleR")


# --------------------------------------------- Soulevé de terre une jambe
sl_up = solve(up(uaR=-84, faR=-88, uaL=-84, faL=-88, ftL=-20), hip=(320, HIP_UP), ankleR=(320, A), ankleL=(306, A - 14), kneeR=1, kneeL=-1)
sl_down = solve(up(t=8, h=0, uaR=-90, faR=-90, uaL=-90, faL=-90, face=-80, ftL=-80), hip=(296, 190), ankleR=(320, A), ankleL=(196, 172), kneeR=1, kneeL=1)
add(Exercise(
    "souleve-de-terre-une-jambe.gif", sl_up, [
        Phase(sl_down, 3, "Basculer", "Une seule ligne de la tête au talon",
              [("line", "ankleL", "head", "tête → talon alignés", 10, (0, -24)), ("ring", "kneeR", "genou souple", (16, 22))]),
        Phase(sl_up, 1.5, "Remonter", "Serrer la fesse de la jambe d'appui",
              [("arrow", ("off", "hip", -20, -6), 30, 0, "", (0, 0))]),
    ], anchor=None, props=[dumbbell_side("handR")]), glue="ankleR")


# ================================================================ Au sol
BODY = GY - 12  # axe du corps allongé au sol
TS = L["torso"] - 8  # hanche → épaule
LIE = up(t=180, h=180, uaR=-4, faR=0, uaL=-4, faL=0)  # sur le dos, tête à gauche


def bridge(phi, sh=(196, BODY), **kw):
    """Hanche placée sur la droite épaule → hanche inclinée de phi degrés."""
    hip = toward(sh, phi, TS)
    return dict(LIE, t=180 + phi, **kw), hip


# ------------------------------------------------------------ Pont fessier
p0, hip0 = bridge(0)
pb_down = solve(p0, hip=hip0, ankleR=(342, A), ankleL=(338, A), kneeR=1, kneeL=1)
p1, hip1 = bridge(26)
pb_up = solve(p1, hip=hip1, ankleR=(342, A), ankleL=(338, A), kneeR=1, kneeL=1)
add(Exercise(
    "pont-fessier.gif", pb_down, [
        Phase(pb_up, 1.2, "Monter", "Pousser dans les talons",
              [("arrow", ("off", "hip", 0, 22), 0, -40, "pousser dans les talons", (10, 6))]),
        Phase(pb_up, 2, "Tenir en haut", "Épaules au sol, fessiers serrés",
              [("line", "shoulder", "kneeR", "épaules · bassin · genoux alignés", 12, (0, -26)),
               ("ring", "shoulder", "épaules au sol", (-10, -24))], hold=True),
        Phase(pb_down, 1.5, "Redescendre", "Lentement, vertèbre par vertèbre"),
    ], anchor=None, zoom=1.7, cx=270))

# ------------------------------------------------------- Pont sur une jambe
pu_down = dict(pb_down)
pu_leg = solve(dict(p0), hip=hip0, ankleL=(338, A), kneeL=1)
pu_leg.update(thR=18, shR=18, ftR=60)
pu_up = solve(dict(p1), hip=hip1, ankleL=(338, A), kneeL=1)
pu_up.update(thR=26, shR=26, ftR=60)
add(Exercise(
    "pont-une-jambe.gif", pb_down, [
        Phase(pu_leg, 1, "Tendre une jambe", "Cuisses parallèles"),
        Phase(pu_up, 1.2, "Monter", "Pousser dans le talon au sol",
              [("arrow", ("off", "hip", 0, 22), 0, -40, "pousser", (10, 6))]),
        Phase(pu_up, 2, "Tenir", "Le bassin reste horizontal",
              [("line", "shoulder", "ankleR", "une seule ligne", 8, (0, -26)), ("tag", ("off", "hip", -40, 30), "bassin à plat")], hold=True),
        Phase(pu_leg, 1.2, "Redescendre", "Le bassin reste horizontal"),
        Phase(pb_down, 0.8, "", ""),
    ], anchor=None, zoom=1.6, cx=280))


# --------------------------------------------------------------- Hip thrust
@prop()
def thrust_bench(d, j, ctx):
    d.rounded_rectangle([P(70, GY - 66), P(196, GY - 54)], radius=3 * S, fill=PROP_DARK)
    d.rectangle([P(84, GY - 54), P(184, GY)], fill=PROP)


HS = (190, GY - 72)  # omoplates sur le bord du banc
ht_low_hip = toward(HS, -48, TS)
ht_low = solve(dict(LIE, t=ang(ht_low_hip, HS), h=150, uaR=-40, faR=12, uaL=-40, faL=12), hip=ht_low_hip, ankleR=(352, A), ankleL=(348, A))
ht_top_hip = toward(HS, 0, TS)
ht_top = solve(dict(LIE, t=180, h=160, uaR=-40, faR=12, uaL=-40, faL=12), hip=ht_top_hip, ankleR=(352, A), ankleL=(348, A))
add(Exercise(
    "hip-thrust.gif", ht_low, [
        Phase(ht_top, 1.2, "Monter", "Pousser dans les talons",
              [("arrow", ("off", "hip", 0, 24), 0, -44, "pousser", (10, 6))]),
        Phase(ht_top, 1, "Tenir 1 s", "Bassin en table, menton rentré",
              [("line", "shoulder", "kneeR", "épaules · bassin · genoux", 10, (0, -24)),
               ("vline", "kneeR", "", 210), ("tag", ("off", "head", -20, -30), "menton rentré", "mm")], hold=True),
        Phase(ht_low, 1.5, "Redescendre", "Contrôler la descente"),
    ], anchor=None, props=[thrust_bench], zoom=1.45, cx=230))


# ------------------------------------------------------------- Dead bug
DB_HIP = (320, BODY)
db_base = dict(LIE, uaR=90, faR=90, uaL=90, faL=90, thR=90, shR=0, ftR=90, thL=90, shL=0, ftL=90, root=DB_HIP)
db_ext1 = dict(db_base, uaR=172, faR=172, thL=14, shL=10, ftL=60)
db_ext2 = dict(db_base, uaL=172, faL=172, thR=14, shR=10, ftR=60)
add(Exercise(
    "dead-bug.gif", db_base, [
        Phase(db_ext1, 2, "Allonger", "Bras et jambe opposés s'éloignent",
              [("arrow", ("off", "handR", 10, -10), -40, 0, "", (0, 0)), ("ring", ("off", "hip", -20, 6), "bas du dos plaqué", (-30, -30))]),
        Phase(db_base, 1.2, "Revenir", "Le bas du dos ne décolle pas"),
        Phase(db_ext2, 2, "Autre côté", "Bras et jambe opposés s'éloignent",
              [("arrow", ("off", "ankleR", 16, 0), 40, 0, "", (0, 0)), ("ring", ("off", "hip", -20, 6), "bas du dos plaqué", (-30, -30))]),
        Phase(db_base, 1.2, "Revenir ", "Le bas du dos ne décolle pas"),
    ], anchor=None, zoom=1.6, cx=310))


# --------------------------------------------- Cou en isométrie (allongé)
cou0 = solve(dict(LIE, h=180, root=(250, BODY)), ankleR=(338, A), ankleL=(334, A), kneeR=1, kneeL=1)
cou1 = dict(cou0, h=124)
add(Exercise(
    "cou-isometrique-allonge.gif", cou0, [
        Phase(cou1, 1.2, "Menton rentré", "Rentrer le menton puis décoller la tête",
              [("arrow", ("off", "head", 0, -22), 0, -26, "", (0, 0))]),
        Phase(cou1, 4, "Tenir la tête", "La tête reste hors du sol, épaules posées",
              [("tag", ("off", "head", 0, -30), "tête hors du sol", "mm")], hold=True),
        Phase(cou0, 1.2, "Reposer", "Reposer doucement la tête"),
    ], anchor=None, zoom=1.7, cx=280, view_note="La tête se décolle de quelques centimètres"))


# --------------------------------------------------- Développé haltères
@prop()
def flat_bench(d, j, ctx):
    d.rounded_rectangle([P(150, GY - 70), P(320, GY - 58)], radius=3 * S, fill=PROP_DARK)
    for x in (166, 296):
        d.rectangle([P(x, GY - 58), P(x + 8, GY)], fill=PROP)


BB = GY - 70 - 11
dh_base = solve(dict(LIE, root=(270, BB)), ankleR=(380, A), ankleL=(376, A), kneeR=1, kneeL=1)
dh_sh = fk(dh_base, dh_base["root"])["shoulder"]
dh_low = solve(dh_base, wristR=(dh_sh[0] + 4, dh_sh[1] - 10), wristL=(dh_sh[0] + 2, dh_sh[1] - 10), elbowR=-1, elbowL=-1)
dh_top = solve(dh_base, wristR=(dh_sh[0] + 2, dh_sh[1] - 84), wristL=(dh_sh[0], dh_sh[1] - 84), elbowR=-1, elbowL=-1)
add(Exercise(
    "developpe-halteres.gif", dh_low, [
        Phase(dh_top, 1.2, "Pousser", "Vers le plafond, au-dessus des épaules",
              [("arrow", ("off", "handR", 22, 30), 0, -46, "", (0, 0)), ("vline", "shoulder", "au-dessus des épaules", 66)]),
        Phase(dh_low, 2, "Descendre", "2 s, coudes à 45° du buste",
              [("vline", "handR", "trajectoire verticale", 66)]),
    ], anchor=None, props=[flat_bench, dumbbell_side("handR")], zoom=1.4, cx=270))


# ------------------------------------------------ Planche (touches d'épaule)
pl_sh = (420, GY - 92)
pl_t = ang((210, GY - 46), pl_sh)
pl_hip = toward(pl_sh, pl_t + 180, TS)
pl = solve(dict(STAND, t=pl_t, h=pl_t - 10, ftR=-62, ftL=-62), hip=pl_hip, ankleR=(214, GY - 14), ankleL=(210, GY - 14), kneeR=1, kneeL=1)
pl = solve(pl, wristR=(pl_sh[0] + 2, GY - 8), wristL=(pl_sh[0] - 2, GY - 8), elbowR=-1, elbowL=-1)
pl_tap = solve(pl, wristR=(pl_sh[0] - 6, pl_sh[1] - 20), elbowR=1)
add(Exercise(
    "planche-touches-epaule.gif", pl, [
        Phase(pl_tap, 0.8, "Toucher l'épaule", "Une main touche l'épaule opposée",
              [("hline", "hip", 150, 470, "bassin immobile")]),
        Phase(pl, 0.8, "Reposer", "Le bassin ne bouge pas", [("hline", "hip", 150, 470, "")]),
        Phase(pl_tap, 0.8, "Autre main", "Le bassin ne bouge pas", [("hline", "hip", 150, 470, "bassin immobile")]),
        Phase(pl, 0.8, "Reposer ", "Le bassin ne bouge pas", [("hline", "hip", 150, 470, "")]),
    ], anchor=None, zoom=1.35, cx=320))


# ---------------------------------------------- Planche latérale / Copenhagen
# Vue de face, couché sur le côté droit (tête à gauche), appui sur l'avant-bras.
def side_lying(hip, sh, **kw):
    q = dict(STAND, t=ang(hip, sh), h=ang(hip, sh), sw=16, hw=11, noface=True, **kw)
    q["root"] = hip
    return q


SL_SH = (200, GY - 50)


def side_arms(q):
    """Bras du dessous : coude au sol sous l'épaule (avant-bras vers nous) ;
    main du dessus posée sur la hanche."""
    j = fk(q, q["root"], "front")
    q["uaR"], q["k_uaR"] = ang(j["shR"], (j["shR"][0], GY - 8)), max(0.2, (GY - 8 - j["shR"][1]) / L["uarm"])
    q["faR"], q["k_faR"] = -90, 0.12
    hp = j["hpL"]
    q.update(solve(q, wristL=(hp[0] - 4, hp[1] - 10), elbowL=1, view="front"))
    return q

plat_low = side_lying((268, GY - 18), SL_SH)
plat_low = solve(plat_low, ankleR=(452, A), ankleL=(452, A - 18), kneeR=1, kneeL=1, view="front")
plat_low = side_arms(plat_low)
plat_up = side_lying(toward(SL_SH, ang(SL_SH, (452, A - 8)), TS), SL_SH)
plat_up = solve(plat_up, ankleR=(452, A), ankleL=(452, A - 18), kneeR=1, kneeL=1, view="front")
plat_up = side_arms(plat_up)
add(Exercise(
    "planche-laterale.gif", plat_low, [
        Phase(plat_up, 1.2, "Monter le bassin", "Coude sous l'épaule",
              [("arrow", ("off", "hip", 0, 20), 0, -34, "", (0, 0)), ("tag", ("off", "elbowR", 0, 20), "coude sous l'épaule", "mm")]),
        Phase(plat_up, 4, "Tenir", "Corps aligné de la tête aux pieds, bassin haut",
              [("line", "head", "ankleR", "une seule ligne", 6, (0, -30))], hold=True),
        Phase(plat_low, 1.2, "Reposer", "Puis l'autre côté"),
    ], view="front", anchor=None, zoom=1.35, cx=330, view_note="Vue de face · couché sur le côté"))


@prop()
def cop_bench(d, j, ctx):
    d.rounded_rectangle([P(380, GY - 62), P(540, GY - 50)], radius=3 * S, fill=PROP_DARK)
    for x in (394, 520):
        d.rectangle([P(x, GY - 50), P(x + 8, GY)], fill=PROP)


KB = (410, GY - 72)  # genou du dessus sur le banc
cop_low = side_lying((268, GY - 18), SL_SH)
cop_up = side_lying(toward(SL_SH, ang(SL_SH, KB), TS), SL_SH)
for q in (cop_low, cop_up):
    j0 = fk(q, q["root"], "front")
    q["thL"] = ang(j0["hpL"], KB)
    q["k_thL"] = math.dist(j0["hpL"], KB) / L["thigh"]
    q["shL"], q["ftL"] = 0, 0
    q.update(solve(q, ankleR=(330, A), kneeR=1, view="front"))
    side_arms(q)
add(Exercise(
    "copenhagen.gif", cop_low, [
        Phase(cop_up, 1.2, "Monter le bassin", "Le genou du dessus appuie sur le banc",
              [("arrow", ("off", "hip", 0, 20), 0, -34, "", (0, 0)), ("ring", "kneeL", "genou sur le banc", (0, -30))]),
        Phase(cop_up, 3, "Tenir", "Le bassin s'aligne avec les épaules",
              [("line", "shoulder", "kneeL", "bassin aligné", 6, (0, -28))], hold=True),
        Phase(cop_low, 1.2, "Reposer", "Puis l'autre côté"),
    ], view="front", anchor=None, props=[cop_bench], zoom=1.3, cx=360, view_note="Vue de face · couché sur le côté"))


# ================================================================ Debout
HU = HIP_UP


def hands_on_hips(q, view="side"):
    j = fk(q, q["root"], view)
    return solve(q, wristR=(j["hip"][0] + 8, j["hip"][1] - 6), wristL=(j["hip"][0] + 4, j["hip"][1] - 6), elbowR=-1, elbowL=-1, view=view)


# ---------------------------------------------------- Rowing haltère un bras
@prop()
def row_bench(d, j, ctx):
    d.rounded_rectangle([P(250, GY - 70), P(450, GY - 58)], radius=3 * S, fill=PROP_DARK)
    for x in (264, 430):
        d.rectangle([P(x, GY - 58), P(x + 8, GY)], fill=PROP)


RK = (322, GY - 76)  # genou du dessus sur le banc
row = dict(STAND, t=6, h=0, face=-80, root=(RK[0] + 2, RK[1] - L["thigh"]))
row.update(thL=-90, shL=180, ftL=-170)
row = solve(row, ankleR=(268, A), kneeR=1)
rsh = fk(row, row["root"])["shoulder"]
row = solve(row, wristL=(rsh[0] + 18, GY - 76), elbowL=-1)
row_low = solve(row, wristR=(rsh[0] + 4, rsh[1] + 84), elbowR=-1)
row_top = solve(row, wristR=(rsh[0] - 26, rsh[1] + 30), elbowR=-1)
add(Exercise(
    "rowing-haltere.gif", row_low, [
        Phase(row_top, 1.2, "Tirer", "Le coude monte vers la hanche",
              [("arrow", ("off", "elbowR", 6, -10), -30, -22, "coude vers la hanche", (-6, -10)), ("line", "hip", "neck", "dos plat", 14, (0, -24))]),
        Phase(row_top, 1, "Tenir", "Dos plat, épaule loin de l'oreille",
              [("line", "hip", "neck", "dos plat", 14, (0, -24))], hold=True),
        Phase(row_low, 2, "Descendre", "Bras tendu, sans tourner le buste"),
    ], anchor=None, props=[row_bench, dumbbell_side("handR")], zoom=1.25, cx=340))


# ------------------------------------------- Développé militaire un bras
dm = hands_on_hips(dict(STAND, root=(320, HU)))
dm_sh = fk(dm, dm["root"])["shoulder"]
dm_low = solve(dm, wristR=(dm_sh[0] + 10, dm_sh[1] - 14), elbowR=-1)
dm_top = solve(dm, wristR=(dm_sh[0] + 2, dm_sh[1] - 74), elbowR=-1)
add(Exercise(
    "developpe-militaire-un-bras.gif", dm_low, [
        Phase(dm_top, 1.2, "Pousser", "Au-dessus de la tête, le bras finit près de l'oreille",
              [("arrow", ("off", "handR", 22, 20), 0, -44, "", (0, 0)), ("vline", "hip", "buste vertical", 60)]),
        Phase(dm_low, 2, "Descendre", "Gainage serré, sans se pencher",
              [("vline", "hip", "buste vertical", 60)]),
    ], anchor=None, props=[dumbbell_side("handR")], trail="handR"), glue="ankleR")


# ----------------------------------------------------- Tractions assistées
BAR_Y = 74
tr_hang = dict(STAND, uaR=90, faR=90, uaL=90, faL=90, h=88, thR=-100, shR=-176, ftR=-150, thL=-104, shL=-178, ftL=-150)
tr_top = dict(tr_hang, uaR=-72, faR=96, uaL=-72, faL=96, h=92)


@prop()
def tr_band(d, j, ctx):
    for x in (310, 334):
        d.line([P(x, BAR_Y), P(j["kneeR"][0] + (x - 322) / 4, j["kneeR"][1] + 6)], fill=ORANGE, width=3 * S)


add(Exercise(
    "tractions-assistees.gif", tr_hang, [
        Phase(tr_top, 1.5, "Tirer", "Le menton passe au-dessus de la barre",
              [("hline", ("off", "head", 0, 0), 230, 420, ""), ("arrow", ("off", "head", 30, 30), 0, -40, "", (0, 0))]),
        Phase(tr_top, 0.8, "Tenir", "Menton au-dessus de la barre", [("tag", ("off", "head", 34, -10), "menton au-dessus")], hold=True),
        Phase(tr_hang, 2, "Descendre", "Jusqu'aux bras tendus", [("tag", ("off", "elbowR", 24, 0), "bras tendus")]),
    ], anchor=("handR", (322, BAR_Y)), props=[bar(BAR_Y, 220, 424), tr_band], ground=False))


# ---------------------------------------------------- Suspension à la barre
su_pass = dict(STAND, uaR=90, faR=90, uaL=90, faL=90, h=84, thR=-76, shR=-150, thL=-80, shL=-154, ftR=-120, ftL=-120, k_uaR=1.0, k_uaL=1.0)
su_act = dict(su_pass, k_uaR=0.8, k_uaL=0.8, h=90)
add(Exercise(
    "suspension-barre.gif", su_pass, [
        Phase(su_act, 0.8, "Épaules actives", "Tirer les épaules loin des oreilles",
              [("arrow", ("off", "shoulder", 28, -26), 0, 26, "épaules basses", (10, 0))]),
        Phase(su_act, 4, "Tenir", "Le plus longtemps possible, bras tendus", hold=True),
        Phase(su_pass, 0.8, "Relâcher", ""),
    ], anchor=("handR", (322, BAR_Y)), props=[bar(BAR_Y, 220, 424)], ground=False))


# ------------------------------------------------------------ Farmer walk
def gait(phase_r, hip=(320, HU), arms=-90):
    """phase_r : 1 = pied droit devant, -1 = pied gauche devant."""
    q = dict(STAND, uaR=arms, faR=arms, uaL=arms, faL=arms, root=(hip[0], hip[1] + 2))
    f, b = (hip[0] + 30, A), (hip[0] - 30, A - 4)
    if phase_r > 0:
        q = solve(q, ankleR=f, ankleL=b)
        q["ftL"] = -18
    else:
        q = solve(q, ankleL=f, ankleR=b)
        q["ftR"] = -18
    return q


fw_mid = solve(dict(STAND, uaR=-90, faR=-90, uaL=-90, faL=-90, root=(320, HU - 2)), ankleR=(322, A), ankleL=(310, A - 22), kneeL=1)
fw_mid2 = solve(dict(STAND, uaR=-90, faR=-90, uaL=-90, faL=-90, root=(320, HU - 2)), ankleL=(322, A), ankleR=(310, A - 22), kneeR=1)
fw_marks = [("vline", "ankleR", "", 46), ("tag", ("off", "shoulder", 26, -6), "épaules basses")]
add(Exercise(
    "farmer-walk.gif", gait(1), [
        Phase(fw_mid, 0.4, "Marcher", "Buste droit, une charge dans chaque main", [("line", "hip", "head", "buste droit", 20, (-46, 0))], kind="lin"),
        Phase(gait(-1), 0.4, "Marcher", "", kind="lin"),
        Phase(fw_mid2, 0.4, "Marcher", "", kind="lin"),
        Phase(gait(1), 0.4, "Marcher", "", kind="lin"),
    ], anchor=None, props=[dumbbell_side("handR")], ghost=False, hold_frames=0))
for ph in ALL[-1].phases:
    ph.cue = "Buste droit, épaules basses, une charge dans chaque main"
    ph.marks = [("line", "hip", "head", "buste droit", 20, (-46, 0)), ("tag", ("off", "shoulder", 24, -14), "épaules basses")]


# ---------------------------------------------------------- Suitcase carry
def front_step(lift_r):
    q = dict(STAND, uaR=-92, faR=-90, uaL=-88, faL=-90, ftR=-90, ftL=-90, k_ftR=0.3, k_ftL=0.3, root=(320, HU))
    q["k_thR"] = 1 - 0.6 * max(0, lift_r)
    q["k_thL"] = 1 - 0.6 * max(0, -lift_r)
    q["root"] = (320, HU - 4 * abs(lift_r))
    q["t"] = 90 + 0 * lift_r
    return q


sc_marks = [("line", ("mid", "hpR", "hpL"), "head", "", 30), ("line", "shR", "shL", "", 30), ("tag", ("off", "head", 40, -6), "buste vertical"), ("tag", ("off", "shL", 34, 0), "épaules à niveau")]
add(Exercise(
    "suitcase-carry.gif", front_step(0), [
        Phase(front_step(1), 0.45, "Marcher", "Charge d'un seul côté, le buste reste droit", sc_marks),
        Phase(front_step(0), 0.45, "Marcher", "Charge d'un seul côté, le buste reste droit", sc_marks),
        Phase(front_step(-1), 0.45, "Marcher", "Charge d'un seul côté, le buste reste droit", sc_marks),
        Phase(front_step(0), 0.45, "Marcher", "Charge d'un seul côté, le buste reste droit", sc_marks),
    ], view="front", anchor=None, props=[dumbbell_side("handR")], ghost=False, hold_frames=0, view_note="Vue de face"))


# ------------------------------------------------------- Pince de disques
@prop(behind=False)
def plates(d, j, ctx):
    for s in ("R", "L"):
        c = j["hand" + s]
        d.rounded_rectangle([P(c[0] - 5, c[1] - 14), P(c[0] + 5, c[1] + 22)], radius=3 * S, fill=PROP_DARK)
        disc(d, c, 5.5, INK)
    # Encadré : la prise vue de près.
    x0, y0 = 450, 84
    d.rounded_rectangle([P(x0, y0), P(x0 + 150, y0 + 150)], radius=12 * S, outline=GROUND, width=2 * S, fill=BG)
    d.rounded_rectangle([P(x0 + 62, y0 + 30), P(x0 + 74, y0 + 130)], radius=3 * S, fill=PROP_DARK)
    d.rounded_rectangle([P(x0 + 76, y0 + 30), P(x0 + 88, y0 + 130)], radius=3 * S, fill=PROP_DARK)
    seg(d, (x0 + 54, y0 + 44), (x0 + 54, y0 + 92), 9, INK)  # pouce
    for k in range(4):
        seg(d, (x0 + 96, y0 + 40 + k * 16), (x0 + 104, y0 + 46 + k * 16), 8, INK)  # doigts
    d.text(P(x0 + 10, y0 + 104), "pouce", font=F_TAG, fill=ORANGE)
    d.text(P(x0 + 100, y0 + 104), "doigts", font=F_TAG, fill=ORANGE)
    d.text(P(x0 + 26, y0 + 8), "2 disques serrés", font=F_TAG, fill=ORANGE)


pd = dict(STAND, uaR=-94, faR=-92, uaL=-86, faL=-88, ftR=-90, ftL=-90, k_ftR=0.3, k_ftL=0.3, root=(260, HU))
pd2 = dict(pd, uaR=-95, uaL=-85)
add(Exercise(
    "pince-de-disques.gif", pd, [
        Phase(pd2, 30, "Tenir", "Disques serrés entre les doigts, bras le long du corps",
              [("tag", ("off", "handR", -16, 58), "bras le long du corps", "mm")], hold=True, frames=50),
    ], view="front", anchor=None, props=[plates], ghost=False, hold_frames=0, view_note="Vue de face"))


# ------------------------------------------------------- Mollets une jambe
@prop()
def calf_step(d, j, ctx):
    d.rounded_rectangle([P(478, GY - 20), P(580, GY)], radius=3 * S, fill=PROP)
    d.rectangle([P(612, 60), P(624, GY)], fill=PROP)


TOE = (500, GY - 23)
ml = dict(STAND, thL=-100, shL=-170, ftL=-150, ftR=24)
ml["root"] = (0, 0)
ml_low = dict(ml, ftR=26)
ml_top = dict(ml, ftR=-44)
for q in (ml_low, ml_top):
    jj = anchored(q, ("toeR", TOE), "side")
    q["root"] = jj["hip"]
    q.update(solve(q, wristR=(610, jj["shoulder"][1] + 26), wristL=(608, jj["shoulder"][1] + 30), elbowR=1, elbowL=1))
add(Exercise(
    "mollets-une-jambe.gif", ml_low, [
        Phase(ml_top, 1.2, "Monter", "Monter le plus haut possible sur la pointe",
              [("arrow", ("off", "heelR", -16, 0), 0, -40, "talon haut", (-6, 0))]),
        Phase(ml_top, 1, "Tenir", "1 s en haut", hold=True),
        Phase(ml_low, 3, "Descendre lentement", "3 s, le talon passe sous la marche",
              [("hline", ("off", "toeR", 0, 4), 410, 490, ""), ("tag", ("off", "heelR", -24, 18), "talon sous la marche", "rm")]),
    ], anchor=None, props=[calf_step]), glue="toeR")


# ---------------------------------------------------- Équilibre sur une jambe
eq0 = hands_on_hips(dict(STAND, root=(320, HU)))
eq1 = dict(eq0, thL=-6, shL=-92, ftL=-30)
add(Exercise(
    "equilibre-une-jambe.gif", eq0, [
        Phase(eq1, 0.8, "Lever le genou", "Genou à hauteur de hanche",
              [("hline", "hip", 260, 420, "")]),
        Phase(eq1, 20, "Tenir", "Bassin stable, sans pencher", [("vline", "ankleR", "bassin au-dessus du pied", 120), ("hline", "hip", 260, 420, "")], hold=True, frames=40),
        Phase(eq0, 0.8, "Reposer", "Puis l'autre jambe"),
    ], anchor=None, view_note="Semaine 2 : les yeux fermés"), glue="ankleR")


# ------------------------------------------------ Charnière de hanche au bâton
def back_pt(j, p, along, out=13):
    """Point sur le dos : à `along` px de la hanche le long du buste, décalé vers l'arrière."""
    a = off(j["hip"], p["t"], along)
    return off(a, p["t"] + 90, out)


@prop(behind=False)
def hinge_stick(d, j, ctx):
    p = ctx["p"]
    a = back_pt(j, p, -26)
    b = off(j["head"], p["t"] + 90, 15)
    b = off(b, p["t"], 18)
    seg(d, a, b, 6, ORANGE)


ch0 = dict(STAND, root=(330, HU))
ch1 = solve(dict(STAND, t=34, h=34, face=-60), hip=(292, HU + 8), ankleR=(330, A), ankleL=(328, A))
for q in (ch0, ch1):
    jj = fk(q, q["root"])
    q.update(solve(q, wristR=off(jj["head"], q["t"] + 90, 15), wristL=back_pt(jj, q, -6, 15), elbowR=1, elbowL=1))
add(Exercise(
    "charniere-hanche-baton.gif", ch0, [
        Phase(ch1, 2, "Basculer", "Les hanches reculent, le bâton ne décolle pas",
              [("arrow", ("off", "hip", -14, 16), -36, 0, "hanches en arrière", (-6, 12)),
               ("tag", ("off", "head", -6, -26), "tête", "rm"), ("tag", ("off", "shoulder", -24, -24), "haut du dos", "rm"),
               ("tag", ("off", "hip", -30, -12), "bassin", "rm")]),
        Phase(ch1, 0.8, "Tenir", "3 points de contact : tête, haut du dos, bassin", hold=True),
        Phase(ch0, 1.5, "Remonter", "Pousser les hanches vers l'avant"),
    ], anchor=None, props=[hinge_stick]), glue="ankleR")


# ------------------------------------------------------- Passage de bâton
pb0 = dict(STAND, uaR=-72, faR=-72, uaL=-72, faL=-72, root=(320, HU))
pb1 = dict(pb0, uaR=90, faR=90, uaL=90, faL=90)
pb2 = dict(pb0, uaR=246, faR=246, uaL=246, faL=246)


@prop(behind=False)
def stick_end(d, j, ctx):
    disc(d, j["handR"], 8, ORANGE)


add(Exercise(
    "passage-de-baton.gif", pb0, [
        Phase(pb1, 1.2, "Monter", "Bras tendus, prise large", [("line", "shoulder", "handR", "bras tendus", 6, (22, 0))]),
        Phase(pb2, 1.2, "Passer derrière", "Le bâton passe derrière les hanches", [("line", "shoulder", "handR", "bras tendus", 6, (22, 0))]),
        Phase(pb1, 1.2, "Revenir", "Sans plier les coudes"),
        Phase(pb0, 1.2, "Devant", "Sans plier les coudes"),
    ], anchor=None, props=[stick_end], trail="handR", view_note="Le bâton est vu de profil (point orange)"))


# --------------------------------------------- Lancer de médecine-ball
WALLX = 486
mb = solve(dict(STAND, t=86), hip=(316, HU + 8), ankleR=(334, A), ankleL=(298, A))
mbj = fk(mb, mb["root"])
mb_chest = solve(mb, wristR=(mbj["shoulder"][0] + 26, mbj["shoulder"][1] + 18), wristL=(mbj["shoulder"][0] + 24, mbj["shoulder"][1] + 20), elbowR=1, elbowL=1)
mb_out = solve(mb, wristR=(mbj["shoulder"][0] + 84, mbj["shoulder"][1] + 2), wristL=(mbj["shoulder"][0] + 82, mbj["shoulder"][1] + 4), elbowR=1, elbowL=1)


@prop(behind=False)
def med_ball(d, j, ctx):
    c = j["handR"]
    c = (c[0] + 14, c[1])
    lab = ctx["phase"].label if ctx["t"] is not None else ""
    if lab == "Le ballon rebondit":
        t = ctx["t"]
        x = c[0] + (WALLX - 16 - c[0]) * (1 - abs(1 - 2 * t))
        c = (x, c[1] - 6 * math.sin(math.pi * t))
    disc(d, c, 14, ORANGE)
    d.rectangle([P(WALLX, 40), P(WALLX + 12, GY)], fill=PROP)


add(Exercise(
    "lancer-medecine-ball.gif", mb_chest, [
        Phase(mb_out, 0.5, "Pousser fort", "Depuis la poitrine, bras qui se tendent", [("arrow", ("off", "handR", 30, -22), 46, 0, "", (0, 0))], kind="out"),
        Phase(mb_out, 0.9, "Le ballon rebondit", "Le ballon part au mur et revient"),
        Phase(mb_chest, 0.5, "Rattraper", "Amortir en ramenant à la poitrine, et recommencer"),
    ], anchor=None, props=[med_ball]), glue="ankleR")


# ================================================================ Sauts
def stance(hip, ax, ay=A, gap=4, arms=(-90, -90), **kw):
    q = dict(STAND, uaR=arms[0], faR=arms[1], uaL=arms[0], faL=arms[1], **kw)
    return solve(q, hip=hip, ankleR=(ax + gap / 2, ay), ankleL=(ax - gap / 2, ay))


# ------------------------------------------------------------ Saut sur box
BOX_TOP = GY - 52
sb0 = stance((250, HU), 250)
sb1 = stance((232, HU + 34), 252, arms=(-140, -130), t=62, h=70)
sb_air = stance((340, HU - 18), 350, ay=HU - 18 + 80, arms=(20, 30), t=80)
sb_air["ftR"] = sb_air["ftL"] = -30
sb2 = stance((404, BOX_TOP - 6 - 96), 424, ay=BOX_TOP - 6, arms=(-20, 10), t=66, h=74)
sb3 = stance((424, BOX_TOP - 6 - 112 + 2), 424, ay=BOX_TOP - 6, arms=(-90, -90))
add(Exercise(
    "saut-sur-box.gif", sb0, [
        Phase(sb1, 0.6, "Élan des bras", "Bras en arrière, hanches en arrière",
              [("arrow", ("off", "handR", -10, 0), -30, -10, "", (0, 0))]),
        Phase(sb_air, 0.5, "Sauter", "Les bras lancent le saut", kind="out"),
        Phase(sb2, 0.35, "Réception douce", "Atterrir genoux fléchis, sans bruit",
              [("ring", "kneeR", "genoux souples", (18, -20))], kind="in"),
        Phase(sb2, 2, "Tenir 2 s", "Stable sur la box, genoux dans l'axe", [("ring", "kneeR", "genoux souples", (18, -20))], hold=True),
        Phase(sb3, 0.6, "Se redresser", "Puis redescendre en marchant"),
    ], anchor=None, props=[box(392, 476, BOX_TOP)], trail="hip"))

# ------------------------------------------------------ Sauts verticaux
sv_g = stance((320, HU + 6), 320)
sv_g["ftR"] = sv_g["ftL"] = -16
sv_g = solve(sv_g, ankleR=(322, A - 6), ankleL=(318, A - 6))
sv_air = stance((320, HU - 26), 320, ay=A - 34)
sv_air["ftR"] = sv_air["ftL"] = -40
sv_m = [("ring", "toeR", "avant du pied", (18, -12))]
add(Exercise(
    "sauts-verticaux.gif", sv_g, [
        Phase(sv_air, 0.25, "Rebondir", "Petits sauts rapides, chevilles toniques", [("arrow", ("off", "hip", -36, 10), 0, -30, "", (0, 0))], kind="out"),
        Phase(sv_g, 0.25, "Réception", "Se recevoir sur l'avant du pied", sv_m, kind="in"),
        Phase(sv_air, 0.25, "Rebondir", "Petits sauts rapides, chevilles toniques", [("arrow", ("off", "hip", -36, 10), 0, -30, "", (0, 0))], kind="out"),
        Phase(sv_g, 0.25, "Réception", "Se recevoir sur l'avant du pied", sv_m, kind="in"),
        Phase(sv_air, 0.25, "Rebondir", "Petits sauts rapides, chevilles toniques", [("arrow", ("off", "hip", -36, 10), 0, -30, "", (0, 0))], kind="out"),
        Phase(sv_g, 0.25, "Réception", "Se recevoir sur l'avant du pied", sv_m, kind="in"),
    ], anchor=None, hold_frames=8))

# ------------------------------------------------------ Saut en longueur
sl0 = stance((170, HU), 170)
sl1 = stance((152, HU + 34), 172, arms=(-140, -130), t=58, h=66)
sl_air = stance((300, HU - 18), 304, ay=HU - 18 + 80, arms=(20, 30), t=70)
sl_air["ftR"] = sl_air["ftL"] = -20
sl2 = stance((424, HU + 40), 446, arms=(-10, 10), t=58, h=68)
sl3 = stance((446, HU), 446)
add(Exercise(
    "saut-en-longueur.gif", sl0, [
        Phase(sl1, 0.6, "Élan des bras", "Bras en arrière, hanches en arrière", [("arrow", ("off", "handR", -10, 0), -30, -10, "", (0, 0))]),
        Phase(sl_air, 0.5, "Sauter", "Les bras lancent vers l'avant", kind="out"),
        Phase(sl2, 0.4, "Réception", "Les deux pieds ensemble, genoux fléchis", [("ring", "kneeR", "amortir", (18, -20))], kind="in"),
        Phase(sl2, 1.5, "Tenir", "Réception tenue, sans faire de pas", [("ring", "heelR", "pieds fixes", (14, -26))], hold=True),
        Phase(sl3, 0.6, "Se redresser", ""),
    ], anchor=None, trail="hip"))


# ------------------------------------------------ World's greatest stretch
wg_hip = (318, 226)
wg0 = solve(dict(STAND, t=34, h=24, face=-50), hip=wg_hip, ankleR=(404, A), ankleL=(176, A - 6), kneeR=1, kneeL=1)
wg0["ftL"] = -40
wg0 = solve(wg0, wristR=(386, GY - 8), wristL=(380, GY - 8), elbowR=-1, elbowL=-1)
wg1 = solve(dict(wg0, t=22, h=14), wristR=(370, GY - 20), elbowR=1)
wg2 = dict(wg0, t=40, uaR=96, faR=96, h=70, face=30)
add(Exercise(
    "worlds-greatest-stretch.gif", wg0, [
        Phase(wg1, 1.2, "Coude vers le pied", "Le coude descend vers l'intérieur du pied avant",
              [("arrow", ("off", "elbowR", 10, -16), 0, 26, "", (0, 0))]),
        Phase(wg2, 1.5, "Bras vers le ciel", "Ouvrir le buste, le regard suit la main",
              [("arrow", ("off", "handR", 16, 40), 0, -46, "ouvrir", (8, 10)), ("tag", ("off", "kneeL", -10, -26), "genou arrière décollé", "rm")]),
        Phase(wg2, 1.5, "Tenir", "Le regard suit la main", hold=True),
        Phase(wg0, 1.2, "Revenir", "Puis l'autre côté"),
    ], anchor=None), glue="ankleR")


# ================================================================ Vues de dessus
TOPC = (320, 150)
TOP_STAND = dict(STAND, t=90, k_torso=0.08, k_head=0.05, noface=False, face=-90,
                 thR=-90, thL=-90, shR=-90, shL=-90, k_thR=0.05, k_thL=0.05, k_shR=0.05, k_shL=0.05,
                 ftR=-90, ftL=-90, k_ftR=0.01, k_ftL=0.01, sw=30, hw=14, root=TOPC)

# ---------------------------------------------- Rotation externe élastique
re0 = dict(TOP_STAND, uaR=-96, uaL=-84, k_uaR=0.3, k_uaL=0.3, faR=-90, faL=-90)
re1 = dict(re0, faR=-155, faL=-25)


@prop(behind=False)
def re_band(d, j, ctx):
    d.line([P(*j["handR"]), P(*j["handL"])], fill=ORANGE, width=3 * S)


add(Exercise(
    "rotation-externe-elastique.gif", re0, [
        Phase(re1, 1.2, "Ouvrir", "Coudes collés au corps, les avant-bras s'écartent",
              [("arrow", ("off", "handR", -10, 0), -30, -6, "", (0, 0)), ("arrow", ("off", "handL", 10, 0), 30, -6, "", (0, 0)),
               ("tag", ("off", "elbowR", -40, -28), "coudes collés", "rm")]),
        Phase(re1, 1, "Tenir", "Omoplates serrées", hold=True),
        Phase(re0, 2, "Revenir", "Lentement, contre l'élastique"),
    ], view="top", anchor=None, props=[re_band], ground=False, zoom=1.6, cx=320, cy=170, view_note="Vue de dessus · l'élastique entre les mains"))


# --------------------------------------------------------------- Pallof press
PA_ANCHOR = (110, 196)
pa0 = dict(TOP_STAND)
pa0 = solve(pa0, wristR=(TOPC[0] - 4, TOPC[1] + 30), wristL=(TOPC[0] + 4, TOPC[1] + 30), elbowR=-1, elbowL=1, view="top")
pa1 = solve(dict(TOP_STAND), wristR=(TOPC[0] - 3, TOPC[1] + 94), wristL=(TOPC[0] + 3, TOPC[1] + 94), elbowR=-1, elbowL=1, view="top")


@prop(behind=False)
def pa_band(d, j, ctx):
    d.rounded_rectangle([P(PA_ANCHOR[0] - 6, PA_ANCHOR[1] - 16), P(PA_ANCHOR[0] + 6, PA_ANCHOR[1] + 16)], radius=2 * S, fill=PROP_DARK)
    c = ((j["handR"][0] + j["handL"][0]) / 2, (j["handR"][1] + j["handL"][1]) / 2)
    d.line([P(*PA_ANCHOR), P(*c)], fill=ORANGE, width=3 * S)


pa_m = [("line", "shR", "shL", "épaules face à l'avant", 26, (0, -24))]
add(Exercise(
    "pallof-press.gif", pa0, [
        Phase(pa1, 1, "Pousser", "Mains devant la poitrine, puis bras tendus", pa_m + [("arrow", ("off", "handL", 24, -30), 0, 40, "", (0, 0))]),
        Phase(pa1, 2, "Tenir", "Le buste ne tourne pas, l'élastique tire sur le côté", pa_m, hold=True),
        Phase(pa0, 1.2, "Ramener", "Les mains reviennent au sternum", pa_m),
    ], view="top", anchor=None, props=[pa_band], ground=False, zoom=1.3, cx=300, cy=190, view_note="Vue de dessus · l'élastique tire sur le côté"))


# ---------------------------------------------------------------------- Y-T-W
YC = (320, 196)
yt0 = dict(STAND, t=90, sw=26, hw=12, noface=True, uaR=-96, faR=-96, uaL=-84, faL=-84, ftR=-90, ftL=-90, k_ftR=0.6, k_ftL=0.6, root=YC)
yY = dict(yt0, uaR=140, faR=140, uaL=40, faL=40)
yT = dict(yt0, uaR=180, faR=180, uaL=0, faL=0)
yW = dict(yt0, uaR=-150, faR=130, uaL=-30, faL=50)
pouce = [("tag", ("off", "handR", -6, -18), "pouce vers le ciel", "rm")]
add(Exercise(
    "y-t-w.gif", yt0, [
        Phase(yY, 1, "Y", "Bras en Y, pouces vers le ciel", pouce),
        Phase(yY, 1.2, "Tenir Y", "Bras décollés du sol", pouce, hold=True),
        Phase(yT, 1, "T", "Bras en T, omoplates serrées", pouce),
        Phase(yT, 1.2, "Tenir T", "Bras décollés du sol", pouce, hold=True),
        Phase(yW, 1, "W", "Coudes pliés, on serre les omoplates", [("tag", ("off", "neck", 0, 30), "omoplates serrées", "mm")]),
        Phase(yW, 1.2, "Tenir W", "Coudes pliés, on serre les omoplates", hold=True),
        Phase(yt0, 1, "", ""),
    ], view="top", anchor=None, ground=False, zoom=1.2, cx=320, view_note="Vue de dessus · allongé sur le ventre"))


# --------------------------------------------------------------- 90/90 hanches
NC = (320, 168)
nn = dict(STAND, t=90, k_torso=0.35, k_head=0.6, sw=26, hw=14, noface=False, face=-90, root=NC,
          uaR=160, faR=200, uaL=20, faL=-20, k_uaR=0.55, k_uaL=0.55, k_faR=0.7, k_faL=0.7)
n_a = dict(nn, thR=-170, shR=100, ftR=100, thL=-45, shL=-135, ftL=-135, k_ftR=0.6, k_ftL=0.6)
n_b = dict(nn, thR=-135, shR=-45, ftR=-45, thL=-10, shL=80, ftL=80, k_ftR=0.6, k_ftL=0.6)
n_mid = dict(nn, thR=-112, shR=-80, ftR=-80, thL=-68, shL=-100, ftL=-100, k_thR=0.45, k_thL=0.45, k_shR=0.7, k_shL=0.7, k_ftR=0.6, k_ftL=0.6)
nm = [("ring", "kneeR", "", (0, 0)), ("ring", "kneeL", "", (0, 0)), ("tag", ("off", "kneeL", 20, 20), "genoux à 90°")]
add(Exercise(
    "90-90-hanches.gif", n_a, [
        Phase(n_mid, 0.9, "Genoux vers le haut", "Buste droit, les deux genoux pivotent ensemble"),
        Phase(n_b, 0.9, "Basculer", "Les deux jambes passent de l'autre côté", nm),
        Phase(n_b, 1, "Tenir", "Buste droit, genoux à 90°", nm, hold=True),
        Phase(n_mid, 0.9, "Genoux vers le haut", "Buste droit, les deux genoux pivotent ensemble"),
        Phase(n_a, 0.9, "Basculer", "Les deux jambes passent de l'autre côté", nm),
    ], view="top", anchor=None, ground=False, zoom=1.25, cx=320, view_note="Vue de dessus · assis au sol"))
