# assets/game 内のスプライトを内容(不透明部分)ぎりぎりでトリミングする
# 浮いて見える原因＝画像下部の透明余白を除去し、足元＝画像下端に揃える
import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
for sub in ["lm", "deco", "char"]:
    d = os.path.join(ROOT, "assets", "game", sub)
    if not os.path.isdir(d):
        continue
    for f in sorted(os.listdir(d)):
        if not f.endswith(".png"):
            continue
        path = os.path.join(d, f)
        im = Image.open(path).convert("RGBA")
        bbox = im.getchannel("A").getbbox()
        if not bbox:
            continue
        pad = max(2, im.size[0] // 100)
        l = max(0, bbox[0] - pad); t = max(0, bbox[1] - pad)
        r = min(im.size[0], bbox[2] + pad); b = min(im.size[1], bbox[3] + pad)
        im.crop((l, t, r, b)).save(path, optimize=True)
        print(f"{sub}/{f}: {im.size} -> {(r-l, b-t)}")
print("done")
