"""Generates the pixel-art category icons in img/icons/. Each icon is a 16x16 grid."""
import os

C = {
    'o': '#3b2a78',  # outline
    'p': '#7f56ff',  # purple
    'h': '#a98bff',  # light purple
    'd': '#120b2b',  # dark
    'w': '#f4f0ff',  # white
    's': '#a89bd6',  # silver
    'y': '#ffd166',  # gold
    'r': '#ff4d6a',  # red
}

def icon_cpu():
    r = []
    for x in (4, 6, 9, 11):
        r += [(x, 1, 1, 2, 'y'), (x, 13, 1, 2, 'y'), (1, x, 2, 1, 'y'), (13, x, 2, 1, 'y')]
    r += [(3, 3, 10, 10, 'o'), (4, 4, 8, 8, 'p'), (6, 6, 4, 4, 'h'), (7, 7, 2, 2, 'd'), (4, 4, 1, 1, 'w')]
    return r

def icon_gpu():
    return [
        (0, 3, 16, 9, 'o'), (1, 4, 14, 7, 'p'),
        (3, 5, 5, 5, 'd'), (4, 6, 3, 3, 'h'), (5, 7, 1, 1, 'd'),
        (9, 5, 5, 5, 'd'), (10, 6, 3, 3, 'h'), (11, 7, 1, 1, 'd'),
        (0, 3, 2, 9, 's'), (11, 2, 3, 1, 'd'),
        (3, 12, 10, 2, 'y'), (7, 12, 1, 2, 'o'),
    ]

def icon_ram():
    r = [(0, 4, 16, 7, 'o'), (1, 5, 14, 5, 'p')]
    for x in (2, 6, 10):
        r += [(x, 6, 3, 3, 'd'), (x + 1, 7, 1, 1, 'h')]
    for x in range(1, 15, 2):
        if x != 7:
            r.append((x, 11, 1, 2, 'y'))
    return r

def icon_storage():
    return [
        (2, 5, 13, 6, 'o'), (3, 6, 11, 4, 'p'),
        (0, 6, 3, 4, 'y'), (1, 7, 1, 2, 'o'),
        (5, 7, 3, 2, 'd'), (5, 7, 1, 1, 'h'),
        (9, 7, 3, 2, 'd'), (9, 7, 1, 1, 'h'),
        (13, 7, 1, 2, 'd'),
    ]

def icon_board():
    return [
        (1, 1, 14, 14, 'o'), (2, 2, 12, 12, 'p'),
        (4, 4, 5, 5, 'd'), (5, 5, 3, 3, 'h'), (6, 6, 1, 1, 'd'),
        (10, 3, 1, 7, 'd'), (12, 3, 1, 7, 'd'),
        (3, 11, 8, 1, 'd'), (11, 11, 2, 2, 'h'),
        (3, 13, 1, 1, 'w'), (12, 13, 1, 1, 'w'), (3, 3, 1, 1, 'w'),
    ]

def icon_case():
    return [
        (3, 0, 10, 15, 'o'), (4, 1, 8, 13, 'p'),
        (5, 2, 6, 8, 'd'), (5, 2, 1, 3, 'w'),
        (7, 3, 2, 2, 'h'), (7, 6, 2, 2, 'h'),
        (7, 11, 2, 1, 'r'), (5, 13, 6, 1, 'd'),
        (4, 15, 2, 1, 's'), (10, 15, 2, 1, 's'),
    ]

def icon_cooler():
    return [
        (1, 1, 14, 14, 'o'), (2, 2, 12, 12, 'p'),
        (4, 3, 8, 10, 'd'), (3, 4, 10, 8, 'd'),
        (7, 4, 2, 3, 'h'), (7, 9, 2, 3, 'h'),
        (4, 7, 3, 2, 'h'), (9, 7, 3, 2, 'h'),
        (7, 7, 2, 2, 'w'),
        (2, 2, 1, 1, 's'), (13, 2, 1, 1, 's'), (2, 13, 1, 1, 's'), (13, 13, 1, 1, 's'),
    ]

def icon_psu():
    return [
        (1, 3, 14, 10, 'o'), (2, 4, 12, 8, 'p'),
        (5, 5, 4, 6, 'd'), (4, 6, 6, 4, 'd'), (6, 7, 2, 2, 'h'),
        (12, 5, 1, 2, 'y'), (11, 7, 2, 1, 'y'), (11, 8, 1, 2, 'y'),
    ]

ICONS = {
    'cpu': icon_cpu, 'gpu': icon_gpu, 'ram': icon_ram, 'storage': icon_storage,
    'board': icon_board, 'case': icon_case, 'cooler': icon_cooler, 'psu': icon_psu,
}

os.makedirs('img/icons', exist_ok=True)
for name, fn in ICONS.items():
    rects = ''.join(
        f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{C[c]}"/>' for x, y, w, h, c in fn()
    )
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" shape-rendering="crispEdges">{rects}</svg>\n'
    with open(f'img/icons/{name}.svg', 'w') as f:
        f.write(svg)
    print('wrote', name)
