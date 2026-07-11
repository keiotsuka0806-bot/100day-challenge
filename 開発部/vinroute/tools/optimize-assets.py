# 生成素材をWeb用に縮小して assets/game/ に配置する（元素材は残す）
# 使い方: python3 tools/optimize-assets.py
import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
A = lambda *p: os.path.join(ROOT, "assets", *p)

def resize(src, dst, size):
    im = Image.open(src).convert("RGBA")
    im.thumbnail((size, size * 2), Image.LANCZOS)  # 縦長キャラは高さ2倍まで許容
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    im.save(dst, optimize=True)
    print(f"{os.path.relpath(dst, ROOT)}  {im.size}  {os.path.getsize(dst)//1024}KB")

# キャラ（縦長 1024x1536 → 高さ384）
for cid in ["sommelier", "vincent", "elodie", "marco", "amelie", "colette"]:
    src = A("characters", f"{cid}.png")
    if os.path.exists(src):
        im = Image.open(src).convert("RGBA")
        im.thumbnail((256, 384), Image.LANCZOS)
        dst = A("game", "char", f"{cid}.png")
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        im.save(dst, optimize=True)
        print(f"char/{cid}.png {im.size} {os.path.getsize(dst)//1024}KB")

# 名所・名産（1024→384）
lm_dir = A("landmarks")
if os.path.isdir(lm_dir):
    for f in sorted(os.listdir(lm_dir)):
        if f.endswith(".png"):
            resize(os.path.join(lm_dir, f), A("game", "lm", f), 384)

# 共通の駒・タイル・テクスチャ
COMMON = [
    (A("concept6", "cell_green.png"),  A("game", "tile", "cell_green.png"), 128),
    (A("concept6", "cell_yellow.png"), A("game", "tile", "cell_yellow.png"), 128),
    (A("concept6", "cell_red.png"),    A("game", "tile", "cell_red.png"), 128),
    (A("concept6", "cell_blue.png"),   A("game", "tile", "cell_blue.png"), 128),
    (A("concept6", "cell_purple.png"), A("game", "tile", "cell_purple.png"), 128),
    (A("concept6", "cell_cyan.png"),   A("game", "tile", "cell_cyan.png"), 128),
    (A("concept6", "plaza_red.png"),     A("game", "tile", "plaza_red.png"), 256),
    (A("concept6", "plaza_white.png"),   A("game", "tile", "plaza_white.png"), 256),
    (A("concept6", "plaza_sparkle.png"), A("game", "tile", "plaza_sparkle.png"), 256),
    (A("concept6", "plaza_rose.png"),    A("game", "tile", "plaza_rose.png"), 256),
    (A("concept6", "plaza_city.png"),    A("game", "tile", "plaza_city.png"), 256),
    (A("concept3", "road_tile.png"),   A("game", "tile", "road.png"), 256),
    (A("concept4", "grass_tex.png"),   A("game", "tile", "grass.png"), 512),
    (A("concept4", "sea_tex.png"),     A("game", "tile", "sea.png"), 512),
    # 汎用デコ
    (A("concept6", "tree_v2.png"),        A("game", "deco", "tree.png"), 384),
    (A("concept5", "vineyard_row.png"),   A("game", "deco", "vineyard.png"), 384),
    (A("concept5", "house_front.png"),    A("game", "deco", "house.png"), 384),
    (A("concept6", "flowers_white.png"),  A("game", "deco", "flowers_white.png"), 256),
    (A("concept6", "flowers_orange.png"), A("game", "deco", "flowers_orange.png"), 256),
    (A("concept6", "fence_log.png"),      A("game", "deco", "fence.png"), 256),
    (A("concept6", "eiffel_v10.png"),     A("game", "lm", "ct_paris.png"), 512),
]
for src, dst, size in COMMON:
    if os.path.exists(src):
        resize(src, dst, size)
    else:
        print("見つからない:", src)
print("done")
