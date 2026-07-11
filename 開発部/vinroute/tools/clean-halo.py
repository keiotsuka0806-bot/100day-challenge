# 生成画像の半透明もや（ハロー）除去: alpha<200 を完全透明にする
# 使い方: python3 tools/clean-halo.py <dir...>
import sys, os
from PIL import Image

dirs = sys.argv[1:] or ["assets/landmarks"]
for d in dirs:
    for f in sorted(os.listdir(d)):
        if not f.endswith(".png"):
            continue
        path = os.path.join(d, f)
        im = Image.open(path).convert("RGBA")
        px = im.load()
        w, h = im.size
        for y in range(h):
            for x in range(w):
                r, g, b, a = px[x, y]
                if a < 200:
                    px[x, y] = (r, g, b, 0)
        im.save(path)
        print("cleaned:", path)
print("done")
