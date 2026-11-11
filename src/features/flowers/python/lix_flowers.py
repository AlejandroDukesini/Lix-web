#!/usr/bin/env python3
"""
Lix Flowers: motor de animaciones de flores en arte ASCII.

Este archivo es la única implementación del motor y se ejecuta en dos lugares:

* Dentro de la app: Pyodide (CPython 3.14 compilado a WebAssembly) lo carga en un
  Web Worker del navegador. No hay servidor: Python corre en el propio dispositivo.
* En un computador: ``python lix_flowers.py --ayuda`` (necesita Pillow para leer
  fotos y escribir GIF).

Proceso con una imagen:
  1. Lectura y validación (Pillow): formato, tamaño, píxeles, orientación EXIF.
  2. Redimensionado a una rejilla de celdas (una celda de texto es el doble de alta que ancha).
  3. Escala de grises para la densidad y colores (originales cuantizados, tema o monocromo).
  4. Cada celda se convierte en un carácter según su intensidad.
  5. Un efecto (floración, brisa, brillo, pétalos, latido) genera los fotogramas.
  6. La secuencia se devuelve como texto + colores (para pintarla en la app) o como GIF (Pillow).

Las plantillas no usan imagen: dibujan la escena con Python puro sobre la misma rejilla.
Todo es determinista: la misma configuración y semilla producen los mismos fotogramas.
"""
from __future__ import annotations

import io
import json
import math
import random

ENGINE_VERSION = 1

MAX_SOURCE_BYTES = 12 * 1024 * 1024
MAX_SOURCE_PIXELS = 40_000_000
ACCEPTED_FORMATS = ('PNG', 'JPEG', 'WEBP')
MIN_COLS, MAX_COLS = 32, 120
MIN_FRAMES, MAX_FRAMES = 12, 72
MAX_ROWS = 90
# Una celda de la fuente de mapa de bits mide 6 × 11 px: casi el doble de alta que ancha.
CELL_W, CELL_H = 6, 11
CELL_ASPECT = CELL_W / CELL_H
GIF_LIMIT_BYTES = 3 * 1024 * 1024
TAU = math.tau

# Rampas de densidad, de menos tinta a más. Solo caracteres ASCII y Latin-1 que la fuente del GIF dibuja.
CHARSETS = {
    'sencillo': ' .:*@',
    'medio': ' .·:-=+*%@',
    'detallado': " .'`^\",:;!i~+-?)(|/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$",
}

# Glifos por papel en las escenas, según la cantidad de caracteres elegida.
GLYPHS = {
    'sencillo': {'petal': '@*.', 'center': '@', 'stem': '|', 'leaf': '~', 'grass': ',', 'star': '*.', 'fall': '*.', 'seed': 'o'},
    'medio': {'petal': '@%*+:.', 'center': '@o', 'stem': '|()', 'leaf': '~<>', 'grass': ',\'`"', 'star': '*+·.', 'fall': "*o`'.", 'seed': 'o·'},
    'detallado': {'petal': '@B%&*#+=~:·.', 'center': '@$#o', 'stem': '|()!', 'leaf': '~<>{}', 'grass': ',\'`";', 'star': '*+°·.', 'fall': "*o°`',.", 'seed': 'o0·°'},
}

THEMES = {
    'jardin': {'label': 'Jardín', 'petals': ['#ff6f91', '#ff9671', '#ffc75f', '#c780fa', '#f9f871'], 'center': '#ffc75f', 'stem': '#4f9d5d', 'leaf': '#7cc47f', 'glow': '#fff1a8', 'star': '#e9e6ff', 'soil': '#7a5236'},
    'rosa': {'label': 'Rosas', 'petals': ['#ff4d6d', '#ff758f', '#ff8fa3', '#c9184a', '#ffb3c1'], 'center': '#ffd6a5', 'stem': '#3a7d44', 'leaf': '#6aa36f', 'glow': '#ffe5ec', 'star': '#ffe5ec', 'soil': '#6b3e2e'},
    'atardecer': {'label': 'Atardecer', 'petals': ['#ff7b54', '#ffb26b', '#ffd56b', '#e94f64', '#b5446e'], 'center': '#fff3b0', 'stem': '#5f7f4a', 'leaf': '#8fae5d', 'glow': '#ffe0a3', 'star': '#ffd9b3', 'soil': '#7a4a2b'},
    'lavanda': {'label': 'Lavanda', 'petals': ['#b8a1ff', '#9d7bff', '#d7c4ff', '#7f6bd8', '#e8a7ff'], 'center': '#fff0b3', 'stem': '#4f8a6e', 'leaf': '#79b39a', 'glow': '#efe6ff', 'star': '#f1ecff', 'soil': '#5a4a6b'},
    'luna': {'label': 'Luz de luna', 'petals': ['#dfe7ff', '#b9c8ff', '#9fb4f2', '#f2f5ff', '#c8b8ff'], 'center': '#fff7d6', 'stem': '#5b7a8c', 'leaf': '#7d9aa8', 'glow': '#ffffff', 'star': '#ffffff', 'soil': '#3c4757'},
}

BACKGROUNDS = {'noche': '#0e0b17', 'papel': '#f6efe3', 'vino': '#25101c', 'bosque': '#0d1a14'}

TEMPLATES = {
    'crecer': 'Flores creciendo',
    'petalos': 'Pétalos cayendo',
    'rosa': 'Rosa animada',
    'girasol': 'Girasol',
    'jardin': 'Jardín',
    'lluvia': 'Lluvia de flores',
    'corazon': 'Corazón de flores',
    'brillantes': 'Flores brillantes',
    'floracion': 'Floración progresiva',
    'nocturno': 'Jardín nocturno',
}

EFFECTS = {
    'floracion': 'Floración progresiva',
    'brisa': 'Brisa',
    'brillo': 'Brillo',
    'petalos': 'Pétalos cayendo',
    'latido': 'Latido',
}


class FlowerError(ValueError):
    """Error explicable a la persona (configuración o archivo no válidos)."""


# --------------------------------------------------------------------------------------
# Colores
# --------------------------------------------------------------------------------------

def hex_to_rgb(value):
    value = value.lstrip('#')
    return tuple(int(value[i:i + 2], 16) for i in (0, 2, 4))


def rgb_to_hex(rgb):
    return '#%02x%02x%02x' % tuple(max(0, min(255, int(round(c)))) for c in rgb)


def luminance(rgb):
    r, g, b = (c / 255 for c in rgb)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def mix(a, b, t):
    return tuple(a[i] + (b[i] - a[i]) * t for i in range(3))


def is_hex(value):
    return isinstance(value, str) and len(value) == 7 and value[0] == '#' and all(c in '0123456789abcdefABCDEF' for c in value[1:])


class Palette:
    """Colores únicos de la animación. Cada celda guarda el índice de su color."""

    def __init__(self, background):
        self.background = hex_to_rgb(background)
        self.light = luminance(self.background) > 0.55
        # Índice 0: el fondo, tal cual (el GIF lo usa para las celdas vacías).
        self.colors = [rgb_to_hex(self.background)]
        self.index = {self.colors[0]: 0}

    def adapt(self, rgb):
        # Sobre fondos claros, los tonos muy luminosos (estrellas, brillos) se oscurecen para seguir viéndose.
        if self.light and luminance(rgb) > 0.72:
            rgb = mix(rgb, (60, 40, 70), 0.55)
        if not self.light and luminance(rgb) < 0.08:
            rgb = mix(rgb, (255, 255, 255), 0.18)
        return rgb

    def add(self, color):
        rgb = self.adapt(hex_to_rgb(color) if isinstance(color, str) else color)
        key = rgb_to_hex(rgb)
        found = self.index.get(key)
        if found is None:
            found = len(self.colors)
            self.colors.append(key)
            self.index[key] = found
        return found


# --------------------------------------------------------------------------------------
# Rejilla de caracteres
# --------------------------------------------------------------------------------------

class Grid:
    __slots__ = ('w', 'h', 'chars', 'cols')

    def __init__(self, w, h):
        self.w = w
        self.h = h
        self.chars = [' '] * (w * h)
        self.cols = [0] * (w * h)

    def put(self, x, y, ch, col):
        x = int(round(x))
        y = int(round(y))
        if 0 <= x < self.w and 0 <= y < self.h:
            i = y * self.w + x
            self.chars[i] = ch
            self.cols[i] = col

    def get(self, x, y):
        if 0 <= x < self.w and 0 <= y < self.h:
            return self.chars[y * self.w + x]
        return ' '

    def text(self, x, y, value, col):
        for i, ch in enumerate(value):
            if ch != ' ':
                self.put(x + i, y, ch, col)

    def freeze(self):
        return {'c': ''.join(self.chars), 'k': ''.join(chr(0x100 + c) for c in self.cols)}


def ramp_char(ramp, t):
    """Carácter de una rampa para una intensidad 0..1 (0 = vacío)."""
    if t <= 0:
        return ramp[0]
    return ramp[min(len(ramp) - 1, max(1, int(t * (len(ramp) - 1) + 0.5)))]


# --------------------------------------------------------------------------------------
# Configuración
# --------------------------------------------------------------------------------------

def clamp(value, low, high, fallback):
    try:
        number = float(value)
    except (TypeError, ValueError):
        return fallback
    if math.isnan(number):
        return fallback
    return max(low, min(high, number))


def normalize_spec(raw):
    """Valida y completa la configuración. Nunca confía en lo que llega de la interfaz."""
    raw = raw if isinstance(raw, dict) else {}
    source = raw.get('source') if raw.get('source') in ('template', 'image') else 'template'
    spec = {
        'source': source,
        'template': raw.get('template') if raw.get('template') in TEMPLATES else 'jardin',
        'effect': raw.get('effect') if raw.get('effect') in EFFECTS else 'brisa',
        'cols': int(clamp(raw.get('cols'), MIN_COLS, MAX_COLS, 72)),
        'frames': int(clamp(raw.get('frames'), MIN_FRAMES, MAX_FRAMES, 36)),
        'charset': raw.get('charset') if raw.get('charset') in CHARSETS else 'medio',
        'colors': raw.get('colors') if raw.get('colors') in (*THEMES, 'original', 'mono') else 'jardin',
        'mono': raw.get('mono') if is_hex(raw.get('mono')) else '#ff8fa3',
        'background': raw.get('background') if is_hex(raw.get('background')) else BACKGROUNDS['noche'],
        'intensity': clamp(raw.get('intensity'), 0.1, 1.0, 0.6),
        'seed': int(clamp(raw.get('seed'), 0, 2**31 - 1, 7)),
    }
    if source == 'template' and spec['colors'] == 'original':
        spec['colors'] = 'jardin'
    return spec


def theme_for(spec):
    if spec['colors'] in THEMES:
        return THEMES[spec['colors']]
    if spec['colors'] == 'mono':
        base = hex_to_rgb(spec['mono'])
        shades = [rgb_to_hex(mix(base, (255, 255, 255), t)) for t in (0.0, 0.2, 0.35)] + [rgb_to_hex(mix(base, (0, 0, 0), t)) for t in (0.2, 0.35)]
        return {'petals': shades, 'center': rgb_to_hex(mix(base, (255, 255, 255), 0.55)), 'stem': rgb_to_hex(mix(base, (0, 0, 0), 0.45)),
                'leaf': rgb_to_hex(mix(base, (0, 0, 0), 0.3)), 'glow': rgb_to_hex(mix(base, (255, 255, 255), 0.75)),
                'star': rgb_to_hex(mix(base, (255, 255, 255), 0.8)), 'soil': rgb_to_hex(mix(base, (0, 0, 0), 0.6))}
    return THEMES['jardin']


# --------------------------------------------------------------------------------------
# Primitivas de dibujo de flores (coordenadas en celdas; las distancias corrigen la proporción)
# --------------------------------------------------------------------------------------

def draw_flower(g, cx, cy, radius, petals, opened, rot, petal_col, center_col, glyphs, edge_col=None):
    """Cabeza de flor: `petals` lóbulos, abierta de 0 a 1 y girada `rot` radianes."""
    r = radius * max(0.0, min(1.0, opened))
    if r < 0.7:
        g.put(cx, cy, glyphs['center'][-1] if r > 0.3 else '.', center_col)
        return
    ry = r * CELL_ASPECT
    ramp = ' ' + glyphs['petal'][::-1]
    for y in range(int(math.floor(cy - ry - 1)), int(math.ceil(cy + ry + 1)) + 1):
        dy = (y - cy) / CELL_ASPECT
        for x in range(int(math.floor(cx - r - 1)), int(math.ceil(cx + r + 1)) + 1):
            dx = x - cx
            d = math.hypot(dx, dy)
            if d > r + 0.8:
                continue
            if d <= r * 0.26:
                g.put(x, y, glyphs['center'][0], center_col)
                continue
            theta = math.atan2(dy, dx)
            edge = r * (0.55 + 0.45 * abs(math.cos(petals * (theta - rot) / 2)))
            if d <= edge:
                g.put(x, y, ramp_char(ramp, 1 - (d / edge) * 0.85), petal_col)
            elif d <= edge + 0.6 and edge_col is not None:
                g.put(x, y, '.', edge_col)


def draw_stem(g, x0, y0, x1, y1, bend, col, leaf_col, glyphs, leaves=2, leaf_phase=0.0):
    """Tallo curvo desde la base (x0, y0) hasta la flor (x1, y1)."""
    steps = max(2, int(abs(y0 - y1) * 1.5))
    last = None
    for i in range(steps + 1):
        t = i / steps
        x = x0 + (x1 - x0) * t + bend * math.sin(math.pi * t)
        y = y0 + (y1 - y0) * t
        cell = (int(round(x)), int(round(y)))
        if cell == last:
            continue
        slope = 0 if last is None else cell[0] - last[0]
        ch = glyphs['stem'][0] if slope == 0 or len(glyphs['stem']) < 3 else (glyphs['stem'][1] if slope < 0 else glyphs['stem'][2])
        g.put(cell[0], cell[1], ch, col)
        last = cell
    for k in range(leaves):
        t = 0.3 + 0.4 * k / max(1, leaves - 1) if leaves > 1 else 0.45
        x = x0 + (x1 - x0) * t + bend * math.sin(math.pi * t)
        y = y0 + (y1 - y0) * t
        side = -1 if k % 2 == 0 else 1
        sway = math.sin(leaf_phase + k) * 0.4
        leaf = glyphs['leaf']
        g.put(x + side, y + sway * 0.3, leaf[0] if len(leaf) < 3 else (leaf[1] if side < 0 else leaf[2]), leaf_col)
        g.put(x + side * 2, y - 0.4 + sway * 0.3, leaf[0], leaf_col)


def scene_size(spec):
    w = spec['cols']
    return w, max(14, min(MAX_ROWS, int(round(w * 0.42))))


def particle_count(w, h, density, intensity):
    return max(4, int(w * h * density * (0.4 + intensity)))


# --------------------------------------------------------------------------------------
# Plantillas (escenas generadas sin imagen)
# --------------------------------------------------------------------------------------

def tpl_crecer(spec, pal, theme, glyphs, rnd, w, h, frames):
    n = max(3, int(w / 14 + spec['intensity'] * 3))
    plants = []
    for i in range(n):
        plants.append({
            'x': (i + 0.5 + rnd.uniform(-0.25, 0.25)) * w / n,
            'top': rnd.uniform(h * 0.22, h * 0.55),
            'bend': rnd.uniform(-2.5, 2.5),
            'r': rnd.uniform(0.07, 0.1) * w,
            'petals': rnd.choice((5, 6, 8)),
            'col': pal.add(rnd.choice(theme['petals'])),
            'delay': rnd.uniform(0, 0.25),
        })
    stem, leaf, center, soil = pal.add(theme['stem']), pal.add(theme['leaf']), pal.add(theme['center']), pal.add(theme['soil'])
    out = []
    for f in range(frames):
        t = f / (frames - 1)
        g = Grid(w, h)
        for x in range(w):
            g.put(x, h - 1, glyphs['grass'][x % len(glyphs['grass'])], soil)
        for p in plants:
            grow = max(0.0, min(1.0, (t - p['delay']) / 0.5))
            if grow <= 0:
                g.put(p['x'], h - 2, '.', stem)
                continue
            top = (h - 2) - ((h - 2) - p['top']) * grow
            draw_stem(g, p['x'], h - 2, p['x'] + p['bend'] * 0.3, top, p['bend'] * grow, stem, leaf, glyphs, leaves=2 if grow > 0.5 else 0)
            opened = max(0.0, min(1.0, (t - p['delay'] - 0.45) / 0.3))
            draw_flower(g, p['x'] + p['bend'] * 0.3, top, p['r'], p['petals'], opened, 0.3, p['col'], center, glyphs)
        out.append(g.freeze())
    return out


def falling(rnd, count, w, h, cycles=(1, 2)):
    return [{'x': rnd.uniform(0, w), 'phase': rnd.random(), 'speed': rnd.choice(cycles), 'sway': rnd.uniform(0.5, 2.2), 'spin': rnd.randrange(8)} for _ in range(count)]


def tpl_petalos(spec, pal, theme, glyphs, rnd, w, h, frames):
    branch, leaf, center = pal.add(theme['soil']), pal.add(theme['leaf']), pal.add(theme['center'])
    petal_cols = [pal.add(c) for c in theme['petals']]
    # Rama de cerezo: un trazo principal con ramitas; las flores se agrupan en sus puntas.
    def branch_y(x):
        return 1.2 + 0.18 * x * (h / w) * 2.2 + 0.9 * math.sin(x / 7)
    span = int(w * 0.62)
    twigs = []
    for k in range(max(3, w // 16)):
        x0 = rnd.uniform(w * 0.06, span * 0.95)
        twigs.append((x0, branch_y(x0), rnd.choice((-1, 1)) * rnd.uniform(2.5, 5), rnd.uniform(1.5, 3.5)))
    blooms = []
    for x0, y0, dx, dy in twigs:
        for _ in range(2):
            blooms.append((x0 + dx + rnd.uniform(-1.5, 1.5), y0 + dy * (1 if dx > 0 else 0.6) + rnd.uniform(-0.8, 0.8), rnd.choice(petal_cols), rnd.uniform(0.028, 0.04) * w))
    petals = falling(rnd, particle_count(w, h, 0.012, spec['intensity']), w, h)
    for p in petals:
        p['col'] = rnd.choice(petal_cols)
    fall = glyphs['fall']
    out = []
    for f in range(frames):
        t = f / frames
        g = Grid(w, h)
        for x in range(span):
            y = branch_y(x)
            g.put(x, y, '=' if x < span * 0.6 else '-', branch)
            if x < span * 0.4:
                g.put(x, y + 1, '_', branch)
        for x0, y0, dx, dy in twigs:
            for i in range(1, 6):
                g.put(x0 + dx * i / 5, y0 + dy * i / 5, '/' if dx * dy < 0 else '\\', branch)
        for bx, by, col, br in blooms:
            draw_flower(g, bx, by, br, 5, 1, t * TAU / 5 + bx, col, center, glyphs)
        for p in petals:
            y = ((p['phase'] + t * p['speed']) % 1) * (h + 2) - 1
            x = p['x'] + math.sin(TAU * (t * p['speed'] + p['phase'])) * p['sway'] * (0.5 + spec['intensity'])
            g.put(x % w, y, fall[(p['spin'] + f // 3) % len(fall)], p['col'])
        out.append(g.freeze())
    return out


def tpl_rosa(spec, pal, theme, glyphs, rnd, w, h, frames):
    cx, cy = w / 2, h * 0.42
    radius = min(w * 0.22, h * 0.36 / CELL_ASPECT)
    inner, outer = pal.add(mix(hex_to_rgb(theme['petals'][3]), (0, 0, 0), 0.15)), pal.add(theme['petals'][0])
    light = pal.add(theme['petals'][2])
    stem, leaf = pal.add(theme['stem']), pal.add(theme['leaf'])
    ramp = ' ' + glyphs['petal'][::-1]
    turns = 2.6 + spec['intensity'] * 1.4
    out = []
    for f in range(frames):
        t = f / frames
        g = Grid(w, h)
        draw_stem(g, cx - 1, h - 1, cx, cy + radius * CELL_ASPECT, -1.5, stem, leaf, glyphs, leaves=2, leaf_phase=TAU * t)
        breathe = 0.94 + 0.06 * math.sin(TAU * t)
        r = radius * breathe
        for y in range(int(cy - r * CELL_ASPECT) - 1, int(cy + r * CELL_ASPECT) + 2):
            for x in range(int(cx - r) - 1, int(cx + r) + 2):
                dx, dy = x - cx, (y - cy) / CELL_ASPECT
                d = math.hypot(dx, dy)
                if d > r:
                    continue
                theta = math.atan2(dy, dx)
                fold = ((theta + (d / r) * turns * TAU - t * TAU) % TAU) / TAU
                if fold < 0.62:
                    shade = 1 - fold / 0.62 * 0.7
                    col = inner if d < r * 0.45 else (outer if fold < 0.4 else light)
                    g.put(x, y, ramp_char(ramp, shade * (1 - 0.3 * d / r)), col)
                elif d > r * 0.85:
                    g.put(x, y, '.', light)
        out.append(g.freeze())
    return out


def tpl_girasol(spec, pal, theme, glyphs, rnd, w, h, frames):
    cx, cy = w / 2, h * 0.45
    radius = min(w * 0.24, h * 0.4 / CELL_ASPECT)
    yellow = pal.add('#ffcf3f' if spec['colors'] == 'jardin' else theme['petals'][2])
    yellow2 = pal.add('#ffad1f' if spec['colors'] == 'jardin' else theme['petals'][1])
    seed_a, seed_b = pal.add('#6b3b1f' if spec['colors'] == 'jardin' else theme['soil']), pal.add('#a8632b' if spec['colors'] == 'jardin' else theme['center'])
    stem, leaf = pal.add(theme['stem']), pal.add(theme['leaf'])
    n_petals = 21
    golden = math.radians(137.508)
    disc = radius * 0.5
    seeds = int(disc * disc * 1.6)
    seed_glyphs = glyphs['seed']
    out = []
    for f in range(frames):
        t = f / frames
        g = Grid(w, h)
        draw_stem(g, cx, h - 1, cx, cy + radius * CELL_ASPECT, 1.2, stem, leaf, glyphs, leaves=2, leaf_phase=TAU * t)
        rot = t * TAU / n_petals  # gira exactamente un pétalo por vuelta: el bucle no salta
        for y in range(int(cy - radius * CELL_ASPECT) - 1, int(cy + radius * CELL_ASPECT) + 2):
            for x in range(int(cx - radius) - 1, int(cx + radius) + 2):
                dx, dy = x - cx, (y - cy) / CELL_ASPECT
                d = math.hypot(dx, dy)
                if disc < d <= radius:
                    theta = math.atan2(dy, dx) - rot
                    lobe = abs(math.cos(n_petals * theta / 2))
                    reach = disc + (radius - disc) * (0.45 + 0.55 * lobe)
                    if d <= reach:
                        angle = (math.atan2(dy, dx) % math.pi) / math.pi
                        ch = '-' if angle < 0.125 or angle > 0.875 else ('\\' if angle < 0.375 else ('|' if angle < 0.625 else '/'))
                        g.put(x, y, ch if len(glyphs['petal']) > 3 else glyphs['petal'][0], yellow if lobe > 0.6 else yellow2)
        for i in range(seeds):  # filotaxis: cada semilla a 137,5° de la anterior
            r = disc * math.sqrt(i / seeds)
            a = i * golden + rot * 3
            pulse = 0.5 + 0.5 * math.sin(TAU * t - r)
            g.put(cx + r * math.cos(a), cy + r * math.sin(a) * CELL_ASPECT, seed_glyphs[i % len(seed_glyphs)], seed_b if pulse > 0.7 else seed_a)
        out.append(g.freeze())
    return out


def tpl_jardin(spec, pal, theme, glyphs, rnd, w, h, frames):
    n = max(4, int(w / 12))
    plants = []
    for i in range(n):
        plants.append({'x': (i + 0.5) * w / n + rnd.uniform(-2, 2), 'top': rnd.uniform(h * 0.25, h * 0.7), 'r': rnd.uniform(0.05, 0.075) * w,
                       'petals': rnd.choice((4, 5, 6, 8)), 'col': pal.add(rnd.choice(theme['petals'])), 'phase': rnd.random() * TAU,
                       'rot': rnd.random() * TAU})
    plants.sort(key=lambda p: -p['top'])  # las más altas detrás
    stem, leaf, center, grass = pal.add(theme['stem']), pal.add(theme['leaf']), pal.add(theme['center']), pal.add(theme['leaf'])
    amp = 0.8 + spec['intensity'] * 2.4
    out = []
    for f in range(frames):
        t = f / frames
        g = Grid(w, h)
        for x in range(w):
            sway = math.sin(TAU * t + x * 0.4)
            g.put(x, h - 1, glyphs['grass'][int((sway + 1) * 1.5) % len(glyphs['grass'])], grass)
            if (x * 7) % 3 == 0:
                g.put(x + round(sway * 0.6), h - 2, glyphs['grass'][0], grass)
        for p in plants:
            sway = math.sin(TAU * t + p['phase']) * amp * (1 - p['top'] / h)
            hx = p['x'] + sway
            draw_stem(g, p['x'], h - 1, hx, p['top'], sway * 0.5, stem, leaf, glyphs, leaves=2, leaf_phase=TAU * t + p['phase'])
            draw_flower(g, hx, p['top'], p['r'], p['petals'], 1, p['rot'] + sway * 0.1, p['col'], center, glyphs)
        out.append(g.freeze())
    return out


def tpl_lluvia(spec, pal, theme, glyphs, rnd, w, h, frames):
    cols = [pal.add(c) for c in theme['petals']]
    center = pal.add(theme['center'])
    drops = falling(rnd, particle_count(w, h, 0.02, spec['intensity']), w, h, cycles=(1, 2, 3))
    shapes = ['@', '*', 'o'] if len(glyphs['petal']) > 3 else ['*', '@']
    out = []
    for f in range(frames):
        t = f / frames
        g = Grid(w, h)
        for i, d in enumerate(drops):
            y = ((d['phase'] + t * d['speed']) % 1) * (h + 3) - 2
            x = d['x'] + math.sin(TAU * (t + d['phase'])) * d['sway'] * 0.5
            col = cols[i % len(cols)]
            if i % 4 == 0:  # flor pequeña de cinco puntos
                for ox, oy in ((0, -1), (-1, 0), (1, 0), (0, 1)):
                    g.put(x + ox, y + oy * 0.6, '·' if len(glyphs['petal']) > 3 else '.', col)
                g.put(x, y, 'o', center)
            else:
                g.put(x, y, shapes[i % len(shapes)], col)
                g.put(x, y - 1, "'", col)
        out.append(g.freeze())
    return out


def in_heart(x, y):
    """Curva implícita del corazón: (x² + y² − 1)³ − x²·y³ ≤ 0, con x, y en [-1.5, 1.5]."""
    a = x * x + y * y - 1
    return a * a * a - x * x * y * y * y <= 0


def tpl_corazon(spec, pal, theme, glyphs, rnd, w, h, frames):
    cx, cy = w / 2, h * 0.5
    sx = min(w * 0.3, h * 0.42 / CELL_ASPECT)
    cols = [pal.add(c) for c in theme['petals']]
    center, leaf = pal.add(theme['center']), pal.add(theme['leaf'])
    spots = []
    tries = 0
    while len(spots) < int(10 + spec['intensity'] * 16) and tries < 4000:
        tries += 1
        hx, hy = rnd.uniform(-1.2, 1.2), rnd.uniform(-1.1, 1.3)
        if in_heart(hx, hy):
            spots.append({'x': cx + hx * sx, 'y': cy - hy * sx * CELL_ASPECT, 'r': rnd.uniform(0.022, 0.04) * w, 'col': rnd.choice(cols), 'delay': rnd.random() * 0.5,
                          'petals': rnd.choice((4, 5, 6))})
    spots.sort(key=lambda s: s['delay'])
    out = []
    for f in range(frames):
        t = f / frames
        beat = 1 + 0.06 * max(0.0, math.sin(TAU * t * 2)) ** 3
        g = Grid(w, h)
        for i in range(160):  # contorno de hojas
            a = TAU * i / 160
            hx = 16 * math.sin(a) ** 3 / 13
            hy = (13 * math.cos(a) - 5 * math.cos(2 * a) - 2 * math.cos(3 * a) - math.cos(4 * a)) / 13
            g.put(cx + hx * sx * 1.1 * beat, cy - hy * sx * 1.1 * CELL_ASPECT * beat, glyphs['leaf'][i % len(glyphs['leaf'])], leaf)
        for s in spots:
            opened = max(0.0, min(1.0, (t - s['delay']) / 0.3)) if t < 0.85 else max(0.0, (1 - t) / 0.15)
            draw_flower(g, cx + (s['x'] - cx) * beat, cy + (s['y'] - cy) * beat, s['r'], s['petals'], opened, s['delay'] * 9, s['col'], center, glyphs)
        out.append(g.freeze())
    return out


def tpl_brillantes(spec, pal, theme, glyphs, rnd, w, h, frames):
    n = max(3, int(w / 22) + 1)
    flowers = [{'x': (i + 0.5) * w / n, 'y': h * rnd.uniform(0.4, 0.6), 'r': rnd.uniform(0.07, 0.09) * w, 'phase': i / n, 'petals': rnd.choice((5, 6, 8)),
                'cols': [pal.add(c) for c in rnd.sample(theme['petals'], 2)]} for i in range(n)]
    glow, center, star = pal.add(theme['glow']), pal.add(theme['center']), pal.add(theme['star'])
    sparks = falling(rnd, particle_count(w, h, 0.008, spec['intensity']), w, h)
    out = []
    for f in range(frames):
        t = f / frames
        g = Grid(w, h)
        for fl in flowers:
            wave = (t + fl['phase']) % 1
            halo = fl['r'] * (1.2 + wave * 0.9)
            if wave < 0.85:  # anillo de luz punteado que se expande y se apaga
                dots = int(halo * 3)
                for i in range(dots):
                    a = TAU * (i + 0.5 * (i % 2)) / dots
                    if i % 2 == 0:
                        g.put(fl['x'] + math.cos(a) * halo, fl['y'] + math.sin(a) * halo * CELL_ASPECT, '·' if wave > 0.45 else '°', glow)
            col = fl['cols'][0] if math.sin(TAU * (t + fl['phase'])) > 0 else fl['cols'][1]
            draw_flower(g, fl['x'], fl['y'], fl['r'], fl['petals'], 1, TAU * t / fl['petals'], col, center, glyphs, edge_col=glow)
        for i, s in enumerate(sparks):
            on = math.sin(TAU * (t * s['speed'] + s['phase'])) > 0.6
            if on:
                g.put(s['x'], (s['phase'] * h * 1.7) % h, glyphs['star'][i % len(glyphs['star'])], star)
        out.append(g.freeze())
    return out


def tpl_floracion(spec, pal, theme, glyphs, rnd, w, h, frames):
    cx, cy = w / 2, h * 0.42
    radius = min(w * 0.26, h * 0.4 / CELL_ASPECT)
    layers = [(1.0, 5, 0.0, theme['petals'][0]), (0.75, 5, math.pi / 5, theme['petals'][1]), (0.5, 6, 0.2, theme['petals'][2]), (0.3, 8, 0.4, theme['petals'][4])]
    layer_cols = [pal.add(c) for _, _, _, c in layers]
    center, stem, leaf = pal.add(theme['center']), pal.add(theme['stem']), pal.add(theme['leaf'])
    out = []
    for f in range(frames):
        t = f / (frames - 1)
        g = Grid(w, h)
        draw_stem(g, cx, h - 1, cx, cy + radius * CELL_ASPECT * 0.4, -1, stem, leaf, glyphs, leaves=2, leaf_phase=TAU * t)
        for i, (scale, k, rot, _) in enumerate(layers):
            opened = max(0.0, min(1.0, (t - i * 0.14) / 0.35))  # cada capa se abre después de la anterior
            if t > 0.75:
                opened *= 1 + 0.04 * math.sin(TAU * (t - 0.75) * 4)
            draw_flower(g, cx, cy, radius * scale, k, opened, rot + (1 - opened) * 0.6, layer_cols[i], center, glyphs)
        out.append(g.freeze())
    return out


def tpl_nocturno(spec, pal, theme, glyphs, rnd, w, h, frames):
    moon, star, glow = pal.add('#f4efd2'), pal.add(theme['star']), pal.add(theme['glow'])
    stem, leaf, center = pal.add(mix(hex_to_rgb(theme['stem']), (10, 10, 30), 0.4)), pal.add(mix(hex_to_rgb(theme['leaf']), (10, 10, 30), 0.4)), pal.add(theme['center'])
    flower_cols = [(pal.add(c), pal.add(mix(hex_to_rgb(c), (20, 20, 50), 0.55))) for c in theme['petals']]
    stars = [(rnd.randrange(w), rnd.randrange(int(h * 0.55)), rnd.random(), rnd.choice((1, 2))) for _ in range(particle_count(w, h, 0.012, spec['intensity']))]
    flies = [{'cx': rnd.uniform(0, w), 'cy': rnd.uniform(h * 0.4, h * 0.85), 'ax': rnd.uniform(3, 9), 'ay': rnd.uniform(1, 3), 'p': rnd.random()} for _ in range(max(3, int(w / 14 * (0.5 + spec['intensity']))))]
    n = max(4, int(w / 13))
    plants = [{'x': (i + 0.5) * w / n + rnd.uniform(-1.5, 1.5), 'top': rnd.uniform(h * 0.5, h * 0.75), 'r': rnd.uniform(0.04, 0.055) * w, 'col': rnd.choice(flower_cols),
               'phase': rnd.random()} for i in range(n)]
    mx, my, mr = w * 0.8, h * 0.24, max(4.0, w * 0.085)
    out = []
    for f in range(frames):
        t = f / frames
        g = Grid(w, h)
        for x, y, phase, speed in stars:
            level = math.sin(TAU * (t * speed + phase))
            if level > -0.3:
                g.put(x, y, glyphs['star'][0] if level > 0.8 else glyphs['star'][-1], star)
        for y in range(int(my - mr * CELL_ASPECT) - 1, int(my + mr * CELL_ASPECT) + 2):  # luna creciente
            for x in range(int(mx - mr) - 1, int(mx + mr) + 2):
                d = math.hypot(x - mx, (y - my) / CELL_ASPECT)
                d2 = math.hypot(x - (mx + mr * 0.45), (y - my) / CELL_ASPECT + mr * 0.15)
                if d <= mr and d2 > mr * 0.82:
                    g.put(x, y, ramp_char(' .:*%@', 1 - (d / mr) ** 3 * 0.6), moon)
        for p in plants:
            breathe = 0.5 + 0.5 * math.sin(TAU * (t + p['phase']))
            draw_stem(g, p['x'], h - 1, p['x'], p['top'], 0.6, stem, leaf, glyphs, leaves=1)
            draw_flower(g, p['x'], p['top'], p['r'], 5, 1, p['phase'] * 6, p['col'][0] if breathe > 0.5 else p['col'][1], center, glyphs)
        for fl in flies:  # luciérnagas en curvas de Lissajous: vuelven a su punto en cada vuelta
            a = TAU * (t + fl['p'])
            on = math.sin(a * 3) > -0.2
            if on:
                g.put(fl['cx'] + math.sin(a) * fl['ax'], fl['cy'] + math.sin(2 * a) * fl['ay'], '*' if math.sin(a * 3) > 0.5 else '·', glow)
        out.append(g.freeze())
    return out


TEMPLATE_BUILDERS = {
    'crecer': tpl_crecer, 'petalos': tpl_petalos, 'rosa': tpl_rosa, 'girasol': tpl_girasol, 'jardin': tpl_jardin,
    'lluvia': tpl_lluvia, 'corazon': tpl_corazon, 'brillantes': tpl_brillantes, 'floracion': tpl_floracion, 'nocturno': tpl_nocturno,
}


# --------------------------------------------------------------------------------------
# Imágenes (Pillow)
# --------------------------------------------------------------------------------------

def open_image(data):
    """Lee y valida una imagen. Devuelve (imagen RGBA, formato)."""
    from PIL import Image, ImageOps, UnidentifiedImageError

    if hasattr(data, 'to_bytes'):  # Uint8Array de JavaScript (Pyodide)
        data = data.to_bytes()
    if not isinstance(data, (bytes, bytearray, memoryview)) or len(data) == 0:
        raise FlowerError('No se recibió ninguna imagen.')
    if len(data) > MAX_SOURCE_BYTES:
        raise FlowerError('La imagen pesa más de 12 MB.')
    Image.MAX_IMAGE_PIXELS = MAX_SOURCE_PIXELS
    try:
        probe = Image.open(io.BytesIO(bytes(data)))
        fmt = probe.format
        probe.verify()
        img = Image.open(io.BytesIO(bytes(data)))
        img.load()
    except (UnidentifiedImageError, OSError, SyntaxError, ValueError):
        raise FlowerError('El archivo no es una imagen válida o está dañado.') from None
    except Image.DecompressionBombError:
        raise FlowerError('La imagen tiene demasiados píxeles.') from None
    if fmt not in ACCEPTED_FORMATS:
        raise FlowerError('Formato no admitido. Usa PNG, JPG o WEBP.')
    if img.width < 16 or img.height < 16:
        raise FlowerError('La imagen es demasiado pequeña (mínimo 16 × 16 píxeles).')
    img = ImageOps.exif_transpose(img)
    return img.convert('RGBA'), fmt


def image_cells(img, spec, pal, theme):
    """Rejilla base de la imagen: lista de (densidad 0..1, índice de color) por celda."""
    from PIL import Image, ImageEnhance, ImageOps

    w = spec['cols']
    h = max(8, min(MAX_ROWS, int(round(w * img.height / img.width * CELL_ASPECT))))
    flat = Image.new('RGBA', img.size, pal.background + (255,))
    flat.alpha_composite(img)
    small = flat.convert('RGB').resize((w, h), Image.LANCZOS)
    small = ImageEnhance.Color(small).enhance(1 + spec['intensity'] * 0.6)
    gray = ImageOps.autocontrast(small.convert('L'), cutoff=1 + spec['intensity'] * 3)
    lum = list(gray.getdata())
    pixels = list(small.getdata())
    # El «fondo» de la foto se estima con la mediana de los bordes: las flores son lo que se separa de él.
    border = [pixels[x] for x in range(w)] + [pixels[(h - 1) * w + x] for x in range(w)] + [pixels[y * w] for y in range(h)] + [pixels[y * w + w - 1] for y in range(h)]
    ref = tuple(sorted(c[i] for c in border)[len(border) // 2] for i in range(3))
    distance = [math.sqrt(sum((c[i] - ref[i]) ** 2 for i in range(3))) for c in pixels]
    top = sorted(distance)[int(len(distance) * 0.97)] or 1
    bg_lum = luminance(pal.background) * 255
    tone = [((255 - v) / 255) if pal.light else max(0.0, (v - bg_lum * 0.6) / max(1, 255 - bg_lum * 0.6)) for v in lum]
    weight = 0.12 if pal.light else 0.3
    density = [min(1.0, (1 - weight) * min(1.0, distance[i] / top) + weight * tone[i]) for i in range(w * h)]
    density = [d if d > 0.14 else 0.0 for d in density]  # el ruido del fondo de la foto queda vacío
    gamma = 1.25 - spec['intensity'] * 0.5
    density = [d ** gamma for d in density]

    if spec['colors'] == 'original':
        quant = small.quantize(colors=28, method=Image.Quantize.MEDIANCUT)
        raw = quant.getpalette()[: 28 * 3]
        mapping = [pal.add((raw[i * 3], raw[i * 3 + 1], raw[i * 3 + 2])) for i in range(len(raw) // 3)]
        colors = [mapping[i] if i < len(mapping) else mapping[0] for i in quant.getdata()]
    else:
        stops = [hex_to_rgb(c) for c in sorted(theme['petals'], key=lambda c: luminance(hex_to_rgb(c)))]
        steps = 10
        ramp = []
        for i in range(steps):
            pos = i / (steps - 1) * (len(stops) - 1)
            a = int(pos)
            ramp.append(pal.add(mix(stops[a], stops[min(a + 1, len(stops) - 1)], pos - a)))
        colors = [ramp[min(steps - 1, int(d * steps))] for d in density]
    return w, h, density, colors


def image_frames(img, spec, pal, theme, glyphs, rnd):
    w, h, density, colors = image_cells(img, spec, pal, theme)
    ramp = CHARSETS[spec['charset']]
    frames = spec['frames']
    effect = spec['effect']
    intensity = spec['intensity']
    glow, star = pal.add(theme['glow']), pal.add(theme['star'])
    petal_cols = [pal.add(c) for c in theme['petals']]
    base_chars = [ramp_char(ramp, d) for d in density]
    out = []

    if effect == 'floracion':
        cx, cy = w / 2, h / 2
        order = sorted(range(w * h), key=lambda i: math.hypot(i % w - cx, (i // w - cy) / CELL_ASPECT) / w - density[i] * 0.6)
        rank = [0] * (w * h)
        for position, i in enumerate(order):
            rank[i] = position / (w * h)
        for f in range(frames):
            t = f / (frames - 1)
            progress = min(1.0, t / 0.7)
            g = Grid(w, h)
            for i in range(w * h):
                if base_chars[i] == ' ':
                    continue
                age = (progress - rank[i]) * 12
                if age <= 0:
                    continue
                g.chars[i] = base_chars[i] if age >= 1 else ramp_char(ramp, density[i] * age)
                g.cols[i] = colors[i]
            out.append(g.freeze())
        return out

    petals = falling(rnd, particle_count(w, h, 0.01, intensity), w, h) if effect == 'petalos' else []
    for p in petals:
        p['col'] = rnd.choice(petal_cols)
    sparkle = random.Random(spec['seed'] + 1)
    for f in range(frames):
        t = f / frames
        g = Grid(w, h)
        if effect == 'brisa':
            amp = 0.6 + intensity * 2.6
            for y in range(h):
                shift = int(round(amp * (1 - y / h) ** 1.3 * math.sin(TAU * t + y * 0.32)))
                row = y * w
                for x in range(w):
                    sx = x - shift
                    if 0 <= sx < w:
                        g.chars[row + x] = base_chars[row + sx]
                        g.cols[row + x] = colors[row + sx]
        elif effect == 'latido':
            k = 0.55 + 0.45 * (0.5 + 0.5 * math.cos(TAU * t))
            for i in range(w * h):
                g.chars[i] = ramp_char(ramp, density[i] * k)
                g.cols[i] = colors[i]
        else:
            g.chars = list(base_chars)
            g.cols = list(colors)
        if effect == 'brillo':
            chance = 0.015 + intensity * 0.07
            for i in range(w * h):
                if density[i] > 0.55 and sparkle.random() < chance:
                    g.chars[i] = '*' if sparkle.random() < 0.5 else '+'
                    g.cols[i] = glow if sparkle.random() < 0.6 else star
        for p in petals:
            y = ((p['phase'] + t * p['speed']) % 1) * (h + 2) - 1
            x = p['x'] + math.sin(TAU * (t * p['speed'] + p['phase'])) * p['sway']
            g.put(x % w, y, glyphs['fall'][(p['spin'] + f // 3) % len(glyphs['fall'])], p['col'])
        out.append(g.freeze())
    return out


# --------------------------------------------------------------------------------------
# API para la app y para la terminal
# --------------------------------------------------------------------------------------

_LAST = {}


def build(spec_json, image_bytes=None):
    """Genera la animación. Recibe la configuración en JSON y, si es de imagen, sus bytes.

    Devuelve JSON: {cols, rows, palette, background, frames: [{c: caracteres, k: colores}], spec, info}.
    En `k`, cada carácter es chr(0x100 + índice de color), para viajar como texto compacto.
    """
    try:
        raw = json.loads(spec_json) if isinstance(spec_json, str) else spec_json
    except json.JSONDecodeError:
        raise FlowerError('Configuración no válida.') from None
    spec = normalize_spec(raw)
    rnd = random.Random(spec['seed'])
    pal = Palette(spec['background'])
    theme = theme_for(spec)
    glyphs = GLYPHS[spec['charset']]
    info = {}
    if spec['source'] == 'image':
        if image_bytes is None:
            raise FlowerError('Primero elige una imagen.')
        img, fmt = open_image(image_bytes)
        info = {'format': fmt, 'width': img.width, 'height': img.height}
        frames = image_frames(img, spec, pal, theme, glyphs, rnd)
    else:
        w, h = scene_size(spec)
        n = spec['frames']
        frames = TEMPLATE_BUILDERS[spec['template']](spec, pal, theme, glyphs, rnd, w, h, n)
    rows = len(frames[0]['c']) // spec['cols']
    result = {'engine': ENGINE_VERSION, 'cols': spec['cols'], 'rows': rows, 'palette': pal.colors, 'background': spec['background'], 'frames': frames, 'spec': spec, 'info': info}
    _LAST.clear()
    _LAST.update(result)
    return json.dumps(result, ensure_ascii=False, separators=(',', ':'))


def _glyph_rows(font):
    cache = {}

    def rows_for(ch):
        found = cache.get(ch)
        if found is None:
            mask = font.getmask(ch)
            mw, mh = mask.size
            bits = []
            for y in range(CELL_H):
                row = []
                for x in range(CELL_W):
                    row.append(1 if x < mw and y < mh and mask.getpixel((x, y)) else 0)
                bits.append(row)
            cache[ch] = found = bits
        return found

    return rows_for


def render_gif(fps=10, scale=2, anim=None):
    """Convierte la última animación (o `anim`) en un GIF con Pillow. Devuelve los bytes.

    Cada carácter se dibuja con la fuente de mapa de bits de Pillow (6 × 11 px, monoespaciada)
    componiendo las filas de píxeles en bloque; después se amplía sin suavizado.
    Si el resultado supera 3 MB se repite a escala 1.
    """
    from PIL import Image, ImageFont

    anim = anim or _LAST
    if not anim:
        raise FlowerError('Primero genera una animación.')
    fps = int(clamp(fps, 2, 30, 10))
    scale = int(clamp(scale, 1, 3, 2))
    cols, rows = anim['cols'], anim['rows']
    palette = [hex_to_rgb(c) for c in anim['palette']]
    flat_palette = [v for rgb in palette for v in rgb] + [0, 0, 0] * (256 - len(palette))
    rows_for = _glyph_rows(ImageFont.load_default_imagefont())
    segment_cache = {}

    def segment(ch, col, y):
        key = (ch, col, y)
        seg = segment_cache.get(key)
        if seg is None:
            bits = rows_for(ch)[y]
            seg = bytes(col if b else 0 for b in bits)
            segment_cache[key] = seg
        return seg

    blank = bytes(CELL_W)
    images = []
    for frame in anim['frames']:
        chars = frame['c']
        colors = [ord(k) - 0x100 for k in frame['k']]
        buf = bytearray()
        for r in range(rows):
            base = r * cols
            for y in range(CELL_H):
                buf += b''.join(blank if chars[base + c] == ' ' else segment(chars[base + c], colors[base + c], y) for c in range(cols))
        im = Image.frombytes('P', (cols * CELL_W, rows * CELL_H), bytes(buf))
        im.putpalette(flat_palette)
        if scale > 1:
            im = im.resize((im.width * scale, im.height * scale), Image.NEAREST)
        images.append(im)
    out = io.BytesIO()
    images[0].save(out, format='GIF', save_all=True, append_images=images[1:], duration=int(1000 / fps), loop=0, optimize=False, disposal=1)
    data = out.getvalue()
    if len(data) > GIF_LIMIT_BYTES and scale > 1:
        return render_gif(fps, 1, anim)
    return data


def catalog():
    """Opciones disponibles, para que la interfaz no duplique listas."""
    return json.dumps({'engine': ENGINE_VERSION, 'templates': TEMPLATES, 'effects': EFFECTS, 'charsets': list(CHARSETS),
                       'themes': {k: v['label'] for k, v in THEMES.items()}, 'backgrounds': BACKGROUNDS,
                       'limits': {'cols': [MIN_COLS, MAX_COLS], 'frames': [MIN_FRAMES, MAX_FRAMES], 'bytes': MAX_SOURCE_BYTES}}, ensure_ascii=False)


def _play_in_terminal(anim, fps, loops):
    """Reproduce la animación en la terminal con color verdadero ANSI."""
    import sys
    import time

    palette = [hex_to_rgb(c) for c in anim['palette']]
    cols = anim['cols']
    sys.stdout.write('\x1b[2J')
    try:
        for _ in range(loops):
            for frame in anim['frames']:
                lines = []
                for r in range(anim['rows']):
                    parts, current = [], None
                    for c in range(cols):
                        i = r * cols + c
                        col = ord(frame['k'][i]) - 0x100
                        if col != current:
                            parts.append('\x1b[38;2;%d;%d;%dm' % palette[col])
                            current = col
                        parts.append(frame['c'][i])
                    lines.append(''.join(parts))
                sys.stdout.write('\x1b[H' + '\x1b[0m\n'.join(lines) + '\x1b[0m\n')
                sys.stdout.flush()
                time.sleep(1 / fps)
    except KeyboardInterrupt:
        pass
    sys.stdout.write('\x1b[0m\n')


def main(argv=None):
    import argparse
    import sys

    parser = argparse.ArgumentParser(prog='lix_flowers', description='Lix Flowers: animaciones de flores en arte ASCII (GIF o terminal).', add_help=False)
    parser.add_argument('--ayuda', '-h', action='help', help='Muestra esta ayuda.')
    parser.add_argument('--imagen', help='Foto de flores (PNG, JPG o WEBP). Sin imagen se usa una plantilla.')
    parser.add_argument('--plantilla', choices=sorted(TEMPLATES), default='jardin')
    parser.add_argument('--efecto', choices=sorted(EFFECTS), default='brisa', help='Efecto para animar la imagen.')
    parser.add_argument('--columnas', type=int, default=72)
    parser.add_argument('--fotogramas', type=int, default=36)
    parser.add_argument('--caracteres', choices=sorted(CHARSETS), default='medio')
    parser.add_argument('--colores', choices=sorted((*THEMES, 'original', 'mono')), default='jardin')
    parser.add_argument('--color', default='#ff8fa3', help='Color base para --colores mono.')
    parser.add_argument('--fondo', default='noche', help='noche, papel, vino, bosque o un color #rrggbb.')
    parser.add_argument('--intensidad', type=float, default=0.6)
    parser.add_argument('--semilla', type=int, default=7)
    parser.add_argument('--fps', type=int, default=10)
    parser.add_argument('--salida', '-o', help='Archivo GIF de salida.')
    parser.add_argument('--terminal', action='store_true', help='Reproduce la animación en la terminal.')
    args = parser.parse_args(argv)

    spec = {'source': 'image' if args.imagen else 'template', 'template': args.plantilla, 'effect': args.efecto, 'cols': args.columnas,
            'frames': args.fotogramas, 'charset': args.caracteres, 'colors': args.colores, 'mono': args.color,
            'background': BACKGROUNDS.get(args.fondo, args.fondo), 'intensity': args.intensidad, 'seed': args.semilla}
    image = None
    if args.imagen:
        with open(args.imagen, 'rb') as handle:
            image = handle.read()
    try:
        anim = json.loads(build(json.dumps(spec), image))
    except FlowerError as error:
        print('Error:', error, file=sys.stderr)
        return 2
    if args.salida:
        data = render_gif(args.fps, 2, anim)
        with open(args.salida, 'wb') as handle:
            handle.write(data)
        print(f'GIF guardado en {args.salida} ({len(data) // 1024} KB, {len(anim["frames"])} fotogramas, {anim["cols"]}×{anim["rows"]} caracteres).')
    if args.terminal or not args.salida:
        _play_in_terminal(anim, args.fps, loops=3)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
