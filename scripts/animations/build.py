# Génère les animations d'exercices dans public/exercise-animations/.
#   python3 scripts/animations/build.py              (toutes)
#   python3 scripts/animations/build.py goblet-squat (une seule)
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from engine import render
from exercises import ALL

OUT = os.path.join(os.path.dirname(__file__), "..", "..", "public", "exercise-animations")
only = set(sys.argv[1:])
for ex in ALL:
    name = ex.file[:-4]
    if only and name not in only:
        continue
    frames, _ = render(ex, os.path.join(OUT, ex.file))
    print(f"{ex.file:42s} {len(frames):3d} images  {os.path.getsize(os.path.join(OUT, ex.file)) // 1024} Ko")
