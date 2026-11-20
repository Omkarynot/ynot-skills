"""Colour helpers for Pantone matching.
  python color.py <hex> <L> <a> <b>          -> logo hex as Lab (D50) + CIEDE2000 distance to a Pantone Lab
  python color.py lookup <hex>               -> cached Pantone Connect result for that exact hex, or "miss"
  python color.py save <hex> <code> <L> <a> <b>   -> store a Pantone Connect best match (code e.g. "1795 C")
The cache (pantone_cache.json next to this file, not in git) only holds values read from Pantone Connect.
Pantone Connect reports Lab under D50, so the sRGB (D65) conversion is Bradford-adapted to D50.
ΔE00 guide: <1 identical, 1-2 very close, 2-3 close, >3 noticeably different (flag it to the user)."""
import sys, math, os, json

def hex_to_lab(h):
    h = h.lstrip('#')
    rgb = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    lin = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in rgb]
    # sRGB -> XYZ (D50, Bradford-adapted matrix)
    M = [[0.4360747, 0.3850649, 0.1430804], [0.2225045, 0.7168786, 0.0606169], [0.0139322, 0.0971045, 0.7141733]]
    X, Y, Z = (sum(M[r][c] * lin[c] for c in range(3)) for r in range(3))
    Xn, Yn, Zn = 0.96422, 1.0, 0.82521
    f = lambda t: t ** (1 / 3) if t > 216 / 24389 else (24389 / 27 * t + 16) / 116
    fx, fy, fz = f(X / Xn), f(Y / Yn), f(Z / Zn)
    return 116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)

def de2000(l1, l2):
    L1, a1, b1 = l1; L2, a2, b2 = l2
    C1, C2 = math.hypot(a1, b1), math.hypot(a2, b2); Cb = (C1 + C2) / 2
    G = 0.5 * (1 - math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)))
    a1p, a2p = (1 + G) * a1, (1 + G) * a2
    C1p, C2p = math.hypot(a1p, b1), math.hypot(a2p, b2)
    h1p = math.degrees(math.atan2(b1, a1p)) % 360; h2p = math.degrees(math.atan2(b2, a2p)) % 360
    dLp, dCp = L2 - L1, C2p - C1p
    dh = h2p - h1p
    if C1p * C2p == 0: dh = 0
    elif dh > 180: dh -= 360
    elif dh < -180: dh += 360
    dHp = 2 * math.sqrt(C1p * C2p) * math.sin(math.radians(dh / 2))
    Lbp, Cbp = (L1 + L2) / 2, (C1p + C2p) / 2
    hs = h1p + h2p
    if C1p * C2p == 0: hbp = hs
    elif abs(h1p - h2p) <= 180: hbp = hs / 2
    else: hbp = (hs + 360) / 2 if hs < 360 else (hs - 360) / 2
    T = 1 - 0.17 * math.cos(math.radians(hbp - 30)) + 0.24 * math.cos(math.radians(2 * hbp)) \
        + 0.32 * math.cos(math.radians(3 * hbp + 6)) - 0.20 * math.cos(math.radians(4 * hbp - 63))
    SL = 1 + 0.015 * (Lbp - 50) ** 2 / math.sqrt(20 + (Lbp - 50) ** 2)
    SC, SH = 1 + 0.045 * Cbp, 1 + 0.015 * Cbp * T
    RT = -2 * math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7)) * math.sin(math.radians(60 * math.exp(-((hbp - 275) / 25) ** 2)))
    return math.sqrt((dLp / SL) ** 2 + (dCp / SC) ** 2 + (dHp / SH) ** 2 + RT * (dCp / SC) * (dHp / SH))

CACHE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'pantone_cache.json')

def _load():
    try: return json.load(open(CACHE, encoding='utf-8'))
    except (OSError, ValueError): return {}

if __name__ == '__main__':
    if len(sys.argv) == 3 and sys.argv[1] == 'lookup':
        r = _load().get(sys.argv[2].lstrip('#').upper())
        print(json.dumps(r) if r else 'miss')
    elif len(sys.argv) >= 7 and sys.argv[1] == 'save':
        h = sys.argv[2].lstrip('#').upper(); code = ' '.join(sys.argv[3:-3]); lab = tuple(map(float, sys.argv[-3:]))
        c = _load(); c[h] = {'code': code, 'lab': lab, 'dE00': round(de2000(hex_to_lab(h), lab), 2)}
        json.dump(c, open(CACHE, 'w', encoding='utf-8'), indent=0, sort_keys=True)
        print('saved', h, c[h])
    elif len(sys.argv) == 5:
        lab = hex_to_lab(sys.argv[1]); p = tuple(map(float, sys.argv[2:5]))
        print('logo Lab(D50): %.2f, %.2f, %.2f   dE00 to Pantone: %.2f' % (*lab, de2000(lab, p)))
    else:  # self-check: Pantone Connect lists 123 C as hex FFC72C, Lab 84.11 12.65 77.81
        d = de2000(hex_to_lab('FFC72C'), (84.11, 12.65, 77.81))
        assert d < 1.5, d
        assert abs(de2000((50, 2.6772, -79.7751), (50, 0, -82.7485)) - 2.0425) < 1e-3  # Sharma test pair 1
        print('ok', round(d, 2))
