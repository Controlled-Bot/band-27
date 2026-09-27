"""Verkleinert und komprimiert alle Fotos in /images für schnelles Laden auf dem Handy.

Einmalig installieren:   pip install pillow
Ausführen (im Ordner Gift):   python tools/bilder-komprimieren.py

- Originale landen als Sicherung in images/_original/
- JPG/JPEG/PNG/HEIC werden auf max. 1200 px (lange Kante) verkleinert und als .jpg gespeichert
- first-chat.png wird übersprungen (dient nur als Vorlage)
"""
from pathlib import Path
import shutil

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent / "images"
BACKUP = ROOT / "_original"
MAX = 1200
QUALITY = 78
SKIP = {"first-chat.png"}

try:
    import pillow_heif  # optional, für iPhone-Fotos (.heic)
    pillow_heif.register_heif_opener()
except ImportError:
    pass

BACKUP.mkdir(exist_ok=True)
for f in sorted(ROOT.iterdir()):
    if not f.is_file() or f.name in SKIP or f.suffix.lower() not in {".jpg", ".jpeg", ".png", ".heic"}:
        continue
    backup = BACKUP / f.name
    if not backup.exists():
        shutil.copy2(f, backup)
    before = f.stat().st_size
    img = ImageOps.exif_transpose(Image.open(backup)).convert("RGB")
    img.thumbnail((MAX, MAX), Image.LANCZOS)
    target = f.with_suffix(".jpg")
    img.save(target, "JPEG", quality=QUALITY, optimize=True, progressive=True)
    if target != f:
        f.unlink()
    print(f"{f.name:<20} {before // 1024:>6} KB -> {target.stat().st_size // 1024:>5} KB")
