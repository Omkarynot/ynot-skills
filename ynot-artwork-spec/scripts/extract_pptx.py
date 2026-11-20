"""Dump a mockup PPTX: slide text, tables and notes -> <out>/pptx.txt; embedded images -> <out>/media/.
Usage: python extract_pptx.py deck.pptx out_dir"""
import sys, os
from pptx import Presentation
from pptx.enum.shapes import MSO_SHAPE_TYPE

src, out = sys.argv[1], sys.argv[2]
os.makedirs(os.path.join(out, 'media'), exist_ok=True)
lines = []

def walk(shapes, n):
    for sh in shapes:
        if sh.shape_type == MSO_SHAPE_TYPE.GROUP:
            walk(sh.shapes, n); continue
        if sh.has_text_frame and sh.text_frame.text.strip():
            lines.append(f'  [{sh.name}] {sh.text_frame.text.strip()}')
        if getattr(sh, 'has_table', False) and sh.has_table:
            lines.append(f'  [table {sh.name}]')
            for row in sh.table.rows:
                lines.append('    | ' + ' | '.join(c.text.strip() for c in row.cells) + ' |')
        if sh.shape_type == MSO_SHAPE_TYPE.PICTURE:
            img = sh.image
            name = f'slide{n:02d}_{sh.shape_id}.{img.ext}'
            with open(os.path.join(out, 'media', name), 'wb') as f: f.write(img.blob)
            lines.append(f'  [image] media/{name}')

for n, slide in enumerate(Presentation(src).slides, 1):
    lines.append(f'--- slide {n} ---')
    walk(slide.shapes, n)
    if slide.has_notes_slide and slide.notes_slide.notes_text_frame.text.strip():
        lines.append('  [notes] ' + slide.notes_slide.notes_text_frame.text.strip())

open(os.path.join(out, 'pptx.txt'), 'w', encoding='utf-8').write('\n'.join(lines))
print('\n'.join(lines))
