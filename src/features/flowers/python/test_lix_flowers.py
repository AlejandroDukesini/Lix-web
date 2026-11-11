"""Pruebas del motor con CPython nativo + Pillow.

Uso:  python -m unittest discover -s src/features/flowers/python   (o npm run test:python)
"""
import io
import json
import os
import tempfile
import unittest

import lix_flowers as L
from PIL import Image


def png(size=(200, 150), color=(240, 80, 120)):
    im = Image.new('RGB', size, (20, 40, 25))
    im.paste(color, (size[0] // 4, size[1] // 4, size[0] * 3 // 4, size[1] * 3 // 4))
    buf = io.BytesIO()
    im.save(buf, 'PNG')
    return buf.getvalue()


class TemplatesTest(unittest.TestCase):
    def test_every_template_builds_and_exports(self):
        for template in L.TEMPLATES:
            with self.subTest(template=template):
                anim = json.loads(L.build(json.dumps({'template': template, 'cols': 40, 'frames': 12})))
                self.assertEqual(len(anim['frames']), 12)
                self.assertTrue(all(len(f['c']) == 40 * anim['rows'] for f in anim['frames']))
                gif = L.render_gif(10, 1)
                self.assertEqual(gif[:6], b'GIF89a')
                self.assertEqual(Image.open(io.BytesIO(gif)).n_frames, 12)

    def test_background_is_palette_zero(self):
        anim = json.loads(L.build(json.dumps({'template': 'rosa', 'background': '#123456'})))
        self.assertEqual(anim['palette'][0], '#123456')


class ImageTest(unittest.TestCase):
    def test_effects(self):
        for effect in L.EFFECTS:
            with self.subTest(effect=effect):
                anim = json.loads(L.build(json.dumps({'source': 'image', 'effect': effect, 'cols': 40, 'frames': 12}), png()))
                self.assertEqual(anim['info']['format'], 'PNG')
                self.assertGreater(len(anim['frames'][-1]['c'].replace(' ', '')), 10)

    def test_rejects_bad_files(self):
        with self.assertRaisesRegex(L.FlowerError, 'válida'):
            L.build('{"source": "image"}', b'no soy una imagen')
        with self.assertRaisesRegex(L.FlowerError, 'pequeña'):
            L.build('{"source": "image"}', png((10, 10)))
        with self.assertRaisesRegex(L.FlowerError, '12 MB'):
            L.build('{"source": "image"}', b'0' * (L.MAX_SOURCE_BYTES + 1))


class CliTest(unittest.TestCase):
    def test_cli_writes_gif(self):
        with tempfile.TemporaryDirectory() as tmp:
            out = os.path.join(tmp, 'flores.gif')
            self.assertEqual(L.main(['--plantilla', 'corazon', '--columnas', '40', '--fotogramas', '12', '-o', out]), 0)
            with Image.open(out) as gif:
                self.assertEqual(gif.n_frames, 12)


if __name__ == '__main__':
    unittest.main()
