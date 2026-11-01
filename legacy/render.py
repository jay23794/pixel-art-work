import numpy as np, math, os, sys
from PIL import Image

W, H, S, FPS, DUR = 135, 240, 8, 24, 40.0
OUT = '/home/claude/work/frames'
os.makedirs(OUT, exist_ok=True)
beats = np.load('/home/claude/work/beats.npy')
env = np.load('/home/claude/work/env.npy')
strong = beats[::2]  # half-time pulse (song feels ~68 bpm)
rng = np.random.default_rng(7)

def pulse(t, k=5.0):
    past = strong[strong <= t]
    return math.exp(-(t - past[-1]) * k) if len(past) else 0.0

def C(h):
    h = h.lstrip('#'); return np.array([int(h[i:i+2], 16) for i in (0, 2, 4)], float)

# palette: amber/sand + cold teal
P = dict(sky1=C('1b1030'), sky2=C('5a2a4a'), sky3=C('d0643a'), sky4=C('f2b25c'),
         night1=C('05070f'), night2=C('0e1a2a'), night3=C('163447'),
         sand=C('8a5a3a'), sand2=C('5c3a2a'), mtn=C('2a1830'), mtn2=C('3d2238'),
         road=C('1c1a22'), line=C('e8c46a'), teal=C('2fd3c4'), teal2=C('147a78'),
         pink=C('ff4f7a'), amber=C('ffb347'), lamp=C('ffd98a'), dark=C('0a0a10'))

def grad(img, y0, y1, cols):
    n = len(cols) - 1
    for y in range(y0, y1):
        f = (y - y0) / max(1, y1 - y0 - 1) * n
        i = min(int(f), n - 1); fr = f - i
        fr = round(fr * 4) / 4  # banded, pixel-art style
        img[y, :] = cols[i] * (1 - fr) + cols[i + 1] * fr

def ridge(seed, base, amp, freq):
    r = np.random.default_rng(seed); ph = r.uniform(0, 6.28, 3)
    x = np.arange(W)
    return (base - amp * (0.6 * np.sin(x * freq + ph[0]) + 0.3 * np.sin(x * freq * 2.3 + ph[1])
            + 0.1 * np.sin(x * freq * 5.1 + ph[2]))).astype(int)

STARS = [(rng.integers(0, W), rng.integers(0, 110), rng.uniform(0, 6.28)) for _ in range(70)]
RAIN = [(rng.uniform(0, W), rng.uniform(0, H), rng.uniform(2.5, 4.5)) for _ in range(120)]
DROPS = [(rng.uniform(0, W), rng.uniform(0, H), rng.uniform(0.5, 2.5), rng.integers(1, 3)) for _ in range(60)]
M1, M2 = ridge(1, 120, 14, 0.05), ridge(2, 130, 9, 0.09)

def stars(img, t, ymax=110, a=1.0):
    for x, y, ph in STARS:
        if y < ymax:
            b = (0.5 + 0.5 * math.sin(t * 2 + ph)) * a
            img[y, x] = img[y, x] * (1 - b) + C('fff4d6') * b

def road(img, t, horizon, night):
    vx = W // 2
    for y in range(horizon, H):
        d = (y - horizon) / (H - horizon)
        half = int(4 + d * 80)
        img[y, :] = (P['sand2'] if night else P['sand']) * (0.5 + 0.5 * d) * (0.55 if night else 1)
        img[y, max(0, vx - half):min(W, vx + half)] = P['road'] * (0.8 + 0.4 * d)
        z = 1.0 / (d + 0.05)
        if (int(z * 3 - t * 12)) % 4 < 2 and d > 0.02:
            w = max(1, int(d * 4)); img[y, vx - w // 2: vx - w // 2 + w] = P['line'] * (0.6 + 0.4 * d)

def scene_highway(img, t, lt):  # dusk desert highway
    grad(img, 0, 125, [P['sky1'], P['sky2'], P['sky3'], P['sky4']])
    stars(img, t, 60, 0.6)
    sy = int(118 - lt * 1.2)  # setting sun
    for y in range(sy - 14, sy + 14):
        for x in range(W // 2 - 14, W // 2 + 14):
            if 0 <= y < 125 and (x - W // 2) ** 2 + (y - sy) ** 2 < 196 and not (y > sy and (y - sy) % 3 == 0):
                img[y, x] = C('ffd27a') * (0.9 + 0.1 * pulse(t))
    for x in range(W):
        img[M1[x]:125, x] = P['mtn2']; img[M2[x]:125, x] = P['mtn']
    road(img, t, 125, False)
    # roadside poles scrolling
    for k in range(4):
        d = ((t * 0.35 + k / 4) % 1.0); y = int(125 + d * d * 115); h = int(2 + d * 40)
        x = int(W / 2 + 10 + d * d * 70)
        if x < W: img[max(0, y - h):y, x:x + max(1, int(d * 3))] = P['dark']

def scene_motel(img, t, lt):  # flickering neon motel sign
    grad(img, 0, H, [P['night1'], P['night2'], P['night3']])
    stars(img, t, 90)
    img[170:, :] = C('101018')
    img[140:200, 70:135] = C('1a1622')  # building
    for wx in range(76, 132, 12):
        on = (int(wx * 7 + t * 0.5) % 3) != 0
        img[155:165, wx:wx + 7] = P['amber'] * (0.7 if on else 0.15)
    img[60:170, 28:31] = C('2a2a34')  # pole
    fl = 1.0 if (math.sin(t * 23) > -0.85 or pulse(t) > 0.5) else 0.25
    br = (0.65 + 0.35 * pulse(t)) * fl
    # sign box with letters-free neon shapes (arrow + frame)
    for (y0, y1, x0, x1) in [(40, 42, 8, 60), (78, 80, 8, 60), (40, 80, 8, 10), (40, 80, 58, 60)]:
        img[y0:y1, x0:x1] = P['pink'] * br
    for i in range(5):  # neon bars
        img[48 + i * 6:50 + i * 6, 16:52 - i * 4] = P['teal'] * br
    for i in range(10):  # arrow
        img[86 + i, 30 + i:44 + i] = P['amber'] * br * (1 if (i + int(t * 6)) % 10 < 7 else 0.3)
    yy, xx = np.mgrid[0:H, 0:W]
    glow = np.clip(1 - np.sqrt(((xx - 34) / 50.0) ** 2 + ((yy - 62) / 45.0) ** 2), 0, 1) ** 2
    glow = np.round(glow * 4) / 4
    img[:] = img + glow[..., None] * P['pink'] * 0.18 * br
    for y in range(176, H, 2):  # reflection on wet ground
        img[y, 8:60] = img[y, 8:60] * 0.7 + P['pink'] * 0.12 * br * ((y + int(t * 10)) % 6 < 3)

def scene_rain(img, t, lt):  # rain on windshield, city bokeh
    grad(img, 0, H, [C('0a0f1c'), C('13263a'), C('1e3a4c')])
    for i in range(18):
        x = int((i * 37 + t * 4) % W); y = 90 + (i * 53) % 90
        c = [P['amber'], P['teal'], P['pink']][i % 3]
        r = 3 + i % 3
        for yy in range(y - r, y + r):
            for xx in range(x - r, x + r):
                if 0 <= yy < H and 0 <= xx < W and (xx - x) ** 2 + (yy - y) ** 2 < r * r:
                    img[yy, xx] = img[yy, xx] * 0.5 + c * 0.5 * (0.7 + 0.3 * pulse(t))
    img[:40, :] = C('050508'); img[200:, :] = C('07070c')  # car roof/dash
    img[205:210, 20:115] = P['teal2'] * (0.6 + 0.4 * pulse(t))  # dash glow
    for x, y, sp, w in DROPS:
        yy = int((y + t * sp * 6) % 160) + 40
        if yy < 200: img[yy:yy + 3, int(x):int(x) + w] = C('9ad8e0') * 0.8
    wiper = (t * 0.6) % 2.0
    if wiper < 1.0:  # wiper sweep
        ang = math.pi * wiper
        for r in range(0, 120):
            x = int(W / 2 + math.cos(ang) * r * 0.9); y = int(200 - math.sin(ang) * r * 1.2)
            if 0 <= x < W and 40 <= y < 200: img[y, max(0, x - 1):x + 1] = C('0b0b10')

def scene_streetlight(img, t, lt):  # lone figure under lamp in rain
    grad(img, 0, H, [P['night1'], C('0c1420'), C('121c26')])
    img[190:, :] = C('0d0d14')
    img[50:190, 90:93] = C('2a2a34'); img[48:51, 70:93] = C('2a2a34')
    lamp = 0.75 + 0.25 * pulse(t)
    img[51:54, 68:78] = P['lamp'] * lamp
    yy, xx = np.mgrid[0:H, 0:W]
    cone = ((yy > 54) & (yy < 200) & (np.abs(xx - 73) < (yy - 54) * 0.42 + 2)).astype(float)
    img[:] = img + cone[..., None] * P['lamp'] * 0.13 * lamp
    pool = (((xx - 73) / 34.0) ** 2 + ((yy - 196) / 6.0) ** 2 < 1).astype(float)
    img[:] = img + pool[..., None] * P['lamp'] * 0.2 * lamp
    # figure (original silhouette: hooded coat, hands in pockets)
    fx = 66; sway = int(round(math.sin(t * 1.2) * 0.6))
    img[160:166, fx + 3 + sway:fx + 9 + sway] = C('15151c')  # hood/head
    img[166:186, fx + 1:fx + 11] = C('1a1a24')  # coat
    img[166:186, fx + 1:fx + 2] = P['lamp'] * 0.35  # rim light
    img[186:195, fx + 3:fx + 5] = C('111118'); img[186:195, fx + 7:fx + 9] = C('111118')
    for x, y, sp in RAIN:
        y2 = int((y + t * sp * 40) % H); x2 = int(x - y2 * 0.1) % W
        c = P['lamp'] * 0.6 if cone[y2, x2] else C('5a7a90') * 0.6
        img[y2:y2 + 3, x2] = c

def scene_night_drive(img, t, lt):  # taillights fading into night
    grad(img, 0, 125, [P['night1'], P['night2'], C('2a2440')])
    stars(img, t, 110)
    for x in range(W):
        img[M1[x]:125, x] = C('120f1c'); img[M2[x]:125, x] = C('0c0a14')
    road(img, t, 125, True)
    d = max(0.0, 1 - lt / 8.0) ** 1.5  # car recedes
    y = int(125 + d * 90); half = int(3 + d * 22); h = max(1, int(d * 10))
    cx = W // 2 - 4
    img[y - h:y, cx - half:cx + half] = C('08080c')
    tl = P['pink'] * (0.8 + 0.2 * pulse(t))
    w = max(1, int(d * 5))
    img[y - h // 2 - 1:y - h // 2 + 1, cx - half:cx - half + w] = tl
    img[y - h // 2 - 1:y - h // 2 + 1, cx + half - w:cx + half] = tl

SCENES = [(0, 8, scene_highway), (8, 16, scene_motel), (16, 24, scene_rain),
          (24, 32, scene_streetlight), (32, 40, scene_night_drive)]
GRAIN = rng.normal(0, 1, (8, H, W))

def frame(n):
    t = n / FPS
    for a, b, fn in SCENES:
        if a <= t < b: break
    img = np.zeros((H, W, 3)); fn(img, t, t - a)
    e = env[min(n, len(env) - 1)]
    img *= 0.85 + 0.25 * e
    img += GRAIN[n % 8][..., None] * 4
    # cut flash + fade at scene edges
    edge = min(t - a, b - t)
    if edge < 0.25: img *= 0.3 + 2.8 * edge
    if t < 1.2: img *= t / 1.2
    if t > 38.5: img *= max(0, (40 - t) / 1.5)
    # vignette
    yy, xx = np.mgrid[0:H, 0:W]
    v = 1 - 0.45 * (((xx - W / 2) / (W / 2)) ** 2 + ((yy - H / 2) / (H / 2)) ** 2) / 2
    img *= v[..., None]
    img = np.clip(img, 0, 255).astype(np.uint8)
    Image.fromarray(img).resize((W * S, H * S), Image.NEAREST).save(f'{OUT}/f{n:04d}.png', compress_level=1)

if __name__ == '__main__':
    a, b = int(sys.argv[1]), int(sys.argv[2])
    for n in range(a, b): frame(n)
