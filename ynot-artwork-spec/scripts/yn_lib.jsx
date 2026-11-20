// Y-Not spec-sheet helpers for Illustrator ExtendScript.
// Load it with the adobe MCP: run_jsx({app:"illustrator", file:"<job>/build.jsx", include:["<skill>/scripts/yn_lib.jsx"]}).
// It also loads its siblings yn_box.jsx (box dielines) and yn_sheet.jsx (spec.json -> sheet builder).
// ALL positions/sizes are INCHES from the artboard's TOP-LEFT, y grows DOWN.
// ponytail: one global doc/state (YN); fine because one sheet is built per script run.

var YN = {};

function _pt(v) { return v * 72; }
function _cmyk(c, m, y, k) { var o = new CMYKColor(); o.cyan = c; o.magenta = m; o.yellow = y; o.black = k; return o; }

// Colours used by the team's sheets (#00AEEF cyan, #ED1C24 red, #231F20 black).
var YN_C = {
  cyan: _cmyk(100, 0, 0, 0), red: _cmyk(0, 100, 100, 0), black: _cmyk(0, 0, 0, 100),
  white: _cmyk(0, 0, 0, 0), green: _cmyk(75, 0, 100, 0), yellow: _cmyk(0, 0, 100, 0), grey: _cmyk(0, 0, 0, 15)
};

// 2.25 -> 2.25" (5.72 cm)
function ynIn(v) { return (Math.round(v * 100) / 100) + '" (' + (Math.round(v * 254) / 100).toFixed(2) + ' cm)'; }

function ynInit(wIn, hIn) {
  var doc = app.documents.add(DocumentColorSpace.CMYK, _pt(wIn), _pt(hIn));
  var r = doc.artboards[0].artboardRect; // [left, top, right, bottom]
  YN = { doc: doc, x0: r[0], y0: r[1], layers: {} };
  YN.fontR = app.textFonts.getByName('ArialMT');
  YN.fontB = app.textFonts.getByName('Arial-BoldMT');
  doc.layers[0].name = 'Header';
  YN.layers.Header = doc.layers[0];
  return doc;
}

function ynLayer(name) {
  if (!YN.layers[name]) { var l = YN.doc.layers.add(); l.name = name; YN.layers[name] = l; }
  return YN.layers[name];
}

function _X(x) { return YN.x0 + _pt(x); }
function _Y(y) { return YN.y0 - _pt(y); }

// Resize the artboard height (inches) once content height is known.
function ynSetHeight(hIn) {
  var r = YN.doc.artboards[0].artboardRect;
  YN.doc.artboards[0].artboardRect = [r[0], r[1], r[2], r[1] - _pt(hIn)];
}

// Point text. align: 'L' | 'C' | 'R' (x is the anchor). y = top of text.
function ynText(layer, str, x, y, size, bold, color, align) {
  var tf = ynLayer(layer).textFrames.add();
  tf.contents = str;
  var a = tf.textRange.characterAttributes;
  a.textFont = bold ? YN.fontB : YN.fontR; a.size = size; a.tracking = 0;
  a.fillColor = color || YN_C.black;
  // lookup, not a chained ?: (ExtendScript groups a ? b : c ? d : e wrongly)
  var j = { C: Justification.CENTER, R: Justification.RIGHT }[align] || Justification.LEFT;
  for (var i = 0; i < tf.paragraphs.length; i++) tf.paragraphs[i].justification = j;
  tf.position = [_X(x), _Y(y)];
  var w = tf.width;
  if (align === 'C') tf.left -= w / 2; else if (align === 'R') tf.left -= w;
  return tf;
}

// Area text that wraps inside a w-inch column.
function ynPara(layer, str, x, y, w, h, size, color) {
  var rect = ynLayer(layer).pathItems.rectangle(_Y(y), _X(x), _pt(w), _pt(h));
  var tf = ynLayer(layer).textFrames.areaText(rect);
  tf.contents = str;
  var a = tf.textRange.characterAttributes;
  a.textFont = YN.fontR; a.size = size || 9; a.tracking = 0; a.fillColor = color || YN_C.black;
  return tf;
}

// "Key: Value" spec lines, keys bold. lines = [['Product','Tee'], ...]; [] = blank line. Returns next y.
// maxW (inches): wrap long lines inside that width instead of running off the column.
function ynSpecs(layer, lines, x, y, size, maxW) {
  size = size || 9.4; var lh = size * 1.25 / 72;
  for (var i = 0; i < lines.length; i++) {
    if (!lines[i].length) { y += lh; continue; }
    var str = lines[i][0] + (lines[i].length > 1 ? ': ' + lines[i][1] : ''), tf, n = 1;
    if (maxW) {
      tf = ynPara(layer, str, x, y, maxW, lh * 30, size);
      var a = tf.textRange.characterAttributes; a.autoLeading = false; a.leading = size * 1.25;
      n = Math.max(1, tf.lines.length);
      tf.textPath.height = _pt(n * lh) + 4; tf.textPath.top = _Y(y);
    } else tf = ynText(layer, str, x, y, size, false);
    if (lines[i].length > 1)
      for (var c = 0, k = lines[i][0].length + 1; c < k; c++) tf.textRange.characters[c].characterAttributes.textFont = YN.fontB;
    y += lh * n;
  }
  return y;
}

function ynRect(layer, x, y, w, h, fill, stroke, sw) {
  var r = ynLayer(layer).pathItems.rectangle(_Y(y), _X(x), _pt(w), _pt(h));
  r.filled = !!fill; if (fill) r.fillColor = fill;
  r.stroked = stroke !== null; if (r.stroked) { r.strokeColor = stroke || YN_C.black; r.strokeWidth = sw || 0.75; }
  return r;
}

function ynLine(layer, x1, y1, x2, y2, color, sw, dash) {
  var p = ynLayer(layer).pathItems.add();
  p.setEntirePath([[_X(x1), _Y(y1)], [_X(x2), _Y(y2)]]);
  p.filled = false; p.stroked = true; p.strokeColor = color || YN_C.black; p.strokeWidth = sw || 0.75;
  if (dash) p.strokeDashes = dash;
  return p;
}

// Section box with centred cyan header (+ optional imprint method line in brackets). Returns y below header.
function ynSection(x, y, w, h, title, sub) {
  ynRect('Header', x, y, w, h, null);
  ynText('Header', title, x + w / 2, y + 0.08, 15, true, YN_C.cyan, 'C');
  if (sub) { ynText('Header', '(' + sub + ')', x + w / 2, y + 0.32, 12, true, YN_C.cyan, 'C'); return y + 0.55; }
  return y + 0.35;
}

// Red dimension line with end ticks. dir 'H' (label below) or 'V' (label left). len in inches = drawn length.
function ynDim(x, y, len, dir, valueIn) {
  var g = ynLayer('Dimensions').groupItems.add(), t = 0.06, lbl = ynIn(valueIn);
  function L(a, b, c, d) { ynLine('Dimensions', a, b, c, d, YN_C.red, 0.5).move(g, ElementPlacement.PLACEATEND); }
  if (dir === 'H') {
    L(x, y, x + len, y); L(x, y - t, x, y + t); L(x + len, y - t, x + len, y + t);
    ynText('Dimensions', lbl, x + len / 2, y + 0.05, 8, false, YN_C.red, 'C').move(g, ElementPlacement.PLACEATEND);
  } else {
    L(x, y, x, y + len); L(x - t, y, x + t, y); L(x - t, y + len, x + t, y + len);
    var parts = lbl.split(' (');
    ynText('Dimensions', parts[0], x - 0.08, y + len / 2 - 0.12, 8, false, YN_C.red, 'R').move(g, ElementPlacement.PLACEATEND);
    ynText('Dimensions', '(' + parts[1], x - 0.08, y + len / 2 + 0.01, 8, false, YN_C.red, 'R').move(g, ElementPlacement.PLACEATEND);
  }
  return g;
}

// Cyan leader from the target (x1,y1) to the label point (x2,y2); text placed at the label end.
function ynCallout(x1, y1, x2, y2, text, align) {
  var g = ynLayer('Callouts').groupItems.add();
  ynLine('Callouts', x1, y1, x2, y2, YN_C.cyan, 0.5).move(g, ElementPlacement.PLACEATEND);
  var d = ynLayer('Callouts').pathItems.ellipse(_Y(y1) + 1.5, _X(x1) - 1.5, 3, 3);
  d.fillColor = YN_C.cyan; d.stroked = false; d.move(g, ElementPlacement.PLACEATEND);
  align = align || (x2 >= x1 ? 'L' : 'R');
  ynText('Callouts', text, x2 + (align === 'L' ? 0.05 : -0.05), y2 - 0.06, 8.4, false, YN_C.black, align).move(g, ElementPlacement.PLACEATEND);
  return g;
}

// Existing document swatch/spot by name (e.g. "PANTONE 143 C"), else null. Spots come from the logo
// file or Pantone Connect values — never typed from memory.
function ynSpot(name) {
  try { var s = new SpotColor(); s.spot = YN.doc.spots.getByName(name); s.tint = 100; return s; } catch (e) { return null; }
}

// Create a spot from official values (as Pantone Connect's own panel does): lab = {l,a,b}.
function ynAddSpot(name, lab) {
  try { YN.doc.spots.getByName(name); } catch (e) {
    // Order matters: colorType + spotKind BEFORE color, else Illustrator throws PARM.
    var sp = YN.doc.spots.add(); sp.name = name; sp.colorType = ColorModel.SPOT;
    sp.spotKind = SpotColorKind.SPOTLAB;
    var c = new LabColor(); c.l = lab.l; c.a = lab.a; c.b = lab.b; sp.color = c;
  }
  return ynSpot(name);
}

// PMS chip: square + "PMS: 143 C". color = SpotColor/CMYKColor.
function ynChip(x, y, color, label, size) {
  size = size || 0.22;
  var g = ynLayer('Logo Artwork').groupItems.add();
  ynRect('Logo Artwork', x, y, size, size, color, YN_C.grey, 0.25).move(g, ElementPlacement.PLACEATEND);
  ynText('Logo Artwork', 'PMS: ' + label, x + size + 0.08, y + size / 2 - 0.08, 10.2, false).move(g, ElementPlacement.PLACEATEND);
  return g;
}

// Table: rows = [['', 'M', 'L'], ['Body Length', '29', '30']]; first row bold. colW in inches.
function ynTable(layer, x, y, colW, rowH, rows, size) {
  size = size || 11; var tw = 0;
  for (var c = 0; c < colW.length; c++) tw += colW[c];
  for (var r = 0; r < rows.length; r++) {
    var cx = x, ry = y + r * rowH;
    ynRect(layer, x, ry, tw, rowH, null, YN_C.black, 0.5);
    for (c = 0; c < colW.length; c++) {
      if (c) ynLine(layer, cx, ry, cx, ry + rowH, YN_C.black, 0.5);
      var v = rows[r][c]; if (v !== undefined && v !== '')
        ynText(layer, String(v), c ? cx + colW[c] / 2 : cx + 0.08, ry + rowH / 2 - size / 144, size, r === 0, YN_C.black, c ? 'C' : 'L');
      cx += colW[c];
    }
  }
  return y + rows.length * rowH;
}

// Visible bounds [l,t,r,b] in points: for clipped groups (PDF/AI imports) use the clip path,
// not the hidden artwork outside it.
function _vb(it) {
  if (it.typename === 'GroupItem') {
    if (it.clipped) for (var i = 0; i < it.pageItems.length; i++) {
      var p = it.pageItems[i];
      if ((p.typename === 'PathItem' && p.clipping) || (p.typename === 'CompoundPathItem' && p.pathItems.length && p.pathItems[0].clipping)) return p.geometricBounds;
    }
    if (it.pageItems.length === 1) return _vb(it.pageItems[0]);
  }
  return it.visibleBounds;
}
function _w(it) { var b = _vb(it); return b[2] - b[0]; }
function _h(it) { var b = _vb(it); return b[1] - b[3]; }
function _moveTo(it, l, t) { var b = _vb(it); it.translate(l - b[0], t - b[1]); }

// Scale an item to fit inside maxW x maxH inches, keeping its aspect ratio (logos are any shape).
// Then centre it in the box at (x,y). Returns the item; read its true size with ynSize(item).
function ynFit(item, x, y, maxW, maxH) {
  var s = Math.min(_pt(maxW) / _w(item), _pt(maxH) / _h(item)) * 100;
  item.resize(s, s, true, true, true, true, s, Transformation.CENTER);
  _moveTo(item, _X(x) + (_pt(maxW) - _w(item)) / 2, _Y(y) - (_pt(maxH) - _h(item)) / 2);
  return item;
}

// Set an item to an exact width (inches), height follows the aspect ratio.
function ynScaleToWidth(item, wIn) {
  var b = _vb(item), s = _pt(wIn) / (b[2] - b[0]) * 100;
  item.resize(s, s, true, true, true, true, s, Transformation.CENTER);
  _moveTo(item, b[0], b[1]);
  return item;
}

function ynSize(item) { return { w: _w(item) / 72, h: _h(item) / 72 }; }
function ynPos(item) { var b = _vb(item); return { x: (b[0] - YN.x0) / 72, y: (YN.y0 - b[1]) / 72 }; }

// Place an image (embedded) or a vector file (.ai/.pdf/.svg/.eps stays editable).
function ynPlace(layer, path, x, y, maxW, maxH) {
  var f = new File(path), it;
  if (/\.(ai|svg|eps)$/i.test(path)) it = ynLayer(layer).groupItems.createFromFile(f);
  else { it = ynLayer(layer).placedItems.add(); it.file = f; it.embed(); it = ynLayer(layer).pageItems[0]; }
  return ynFit(it, x, y, maxW, maxH);
}

// Vector path for flat product drawings. pts = [[x,y], ...] (corner) or [[x,y],[inX,inY],[outX,outY]] (bezier
// anchor with its in/out handles), all inches. Returns the PathItem.
function ynPath(layer, pts, closed, fill, stroke, sw) {
  var p = ynLayer(layer).pathItems.add();
  for (var i = 0; i < pts.length; i++) {
    var q = p.pathPoints.add(), a = pts[i].length === 3 ? pts[i] : [pts[i], pts[i], pts[i]];
    q.anchor = [_X(a[0][0]), _Y(a[0][1])]; q.leftDirection = [_X(a[1][0]), _Y(a[1][1])];
    q.rightDirection = [_X(a[2][0]), _Y(a[2][1])];
  }
  p.closed = closed !== false;
  p.filled = !!fill; if (fill) p.fillColor = fill;
  p.stroked = stroke !== null; if (p.stroked) { p.strokeColor = stroke || YN_C.black; p.strokeWidth = sw || 0.75; }
  return p;
}

// Dotted cyan imprint-area box drawn around an item or an array of items (pad inches). Not printed.
function ynImprintArea(item, pad) {
  var its = item.length ? item : [item], b = _vb(its[0]).slice(), p = _pt(pad === undefined ? 0.1 : pad);
  for (var i = 1; i < its.length; i++) {
    var c = _vb(its[i]); b = [Math.min(b[0], c[0]), Math.max(b[1], c[1]), Math.max(b[2], c[2]), Math.min(b[3], c[3])];
  }
  var r = ynLayer('Logo Placement').pathItems.rectangle(b[1] + p, b[0] - p, b[2] - b[0] + 2 * p, b[1] - b[3] + 2 * p);
  r.filled = false; r.stroked = true; r.strokeColor = YN_C.cyan; r.strokeWidth = 0.5; r.strokeDashes = [1.5, 1.5];
  return r;
}

// Insert space: move every top-level item whose top is at/below yIn down by dyIn, and grow the artboard.
function ynShiftBelow(yIn, dyIn) {
  var lim = _Y(yIn) + 0.5;
  for (var l = 0; l < YN.doc.layers.length; l++) {
    var items = YN.doc.layers[l].pageItems;
    for (var i = 0; i < items.length; i++)
      if (items[i].parent.typename === 'Layer' && items[i].visibleBounds[1] <= lim) items[i].translate(0, -_pt(dyIn));
  }
  var r = YN.doc.artboards[0].artboardRect;
  YN.doc.artboards[0].artboardRect = [r[0], r[1], r[2], r[3] - _pt(dyIn)];
}

function ynExportPNG(path, scale) {
  var o = new ExportOptionsPNG24(); o.artBoardClipping = true; o.antiAliasing = true;
  o.horizontalScale = o.verticalScale = scale || 50;
  YN.doc.exportFile(new File(path), ExportType.PNG24, o);
}

function ynSave(aiPath, pdfPath) {
  YN.doc.saveAs(new File(aiPath), new IllustratorSaveOptions());
  if (pdfPath) { var p = new PDFSaveOptions(); p.preserveEditability = true; YN.doc.saveAs(new File(pdfPath), p); }
}

// ---------- QC: checks the active document; returns {ok, issues:[...]} ----------
// Catches the team's usual slips: non-Arial fonts, inch/cm that disagree, chips without a matching spot (or the
// reverse), placeholder text, overset text, items off the artboard, missing links, wrong file name.
// o.doc = document name (use it: the user may have another document active).
function ynQC(o) {
  o = o || {}; var d = o.doc ? app.documents.getByName(o.doc) : app.activeDocument, out = [], i, k, m, chips = {}, groups = [];
  function add(t, msg) { out.push(t + ': ' + msg); }
  function _sh(s) { s = s.replace(/[\r\n]+/g, ' '); return s.length > 50 ? s.slice(0, 50) + '...' : s; }
  for (i = 0; i < d.textFrames.length; i++) {
    var tf = d.textFrames[i], s = tf.contents;
    if (!s.replace(/\s/g, '')) { add('empty text', 'layer ' + tf.layer.name); continue; }
    for (k = 0; k < tf.textRanges.length; k++) {
      var f = tf.textRanges[k].characterAttributes.textFont;
      if (f.family !== 'Arial') { add('font', f.name + ' in "' + _sh(s) + '"'); break; }
    }
    if (/X{3,}|\bTBD\b|\bTBC\b|lorem|\?\?|placeholder|\[[^\]]*\]/i.test(s)) add('placeholder', _sh(s));
    if (tf.kind === TextType.AREATEXT) {
      var n = 0; for (k = 0; k < tf.lines.length; k++) n += tf.lines[k].characters.length;
      if (n < tf.characters.length) add('overset text', _sh(s));
    }
    if ((m = s.match(/^PMS:\s*(.+)$/))) chips[m[1]] = 1;
    // vertical dims split the inch and cm over two frames in one group: check them together
    var g = tf.parent.typename === 'GroupItem' ? tf.parent : null;
    if (g) { for (k = 0; k < groups.length && groups[k].g !== g; k++); if (k === groups.length) groups.push({ g: g, s: '' }); groups[k].s += ' ' + s; }
    else groups.push({ g: null, s: s });
  }
  for (i = 0; i < groups.length; i++) {
    var re = /(\d+(?:\.\d+)?)["\u201D]\s*\(\s*(\d+(?:\.\d+)?)\s*cm\s*\)/g;
    while ((m = re.exec(groups[i].s))) if (Math.abs(m[1] * 2.54 - m[2]) > 0.02)
      add('inch/cm mismatch', m[0] + ' (' + m[1] + '" = ' + (m[1] * 2.54).toFixed(2) + ' cm)');
  }
  var spots = {};
  for (i = 0; i < d.spots.length; i++) if (/^PANTONE /.test(d.spots[i].name)) {
    var code = d.spots[i].name.replace(/^PANTONE /, ''); spots[code] = 1;
    if (!chips[code]) add('spot swatch without chip', d.spots[i].name);
  }
  for (k in chips) if (!spots[k]) add('chip without spot swatch', 'PMS: ' + k + ' (create it from Pantone Connect values)');
  var ab = d.artboards[0].artboardRect;
  for (i = 1; i < d.artboards.length; i++) { var r = d.artboards[i].artboardRect; ab = [Math.min(ab[0], r[0]), Math.max(ab[1], r[1]), Math.max(ab[2], r[2]), Math.min(ab[3], r[3])]; }
  for (i = 0; i < d.layers.length; i++) for (k = 0; k < d.layers[i].pageItems.length; k++) {
    var it = d.layers[i].pageItems[k], b = _vb(it); // clip-aware: hidden content outside a logo's clip doesn't count
    if (b[0] < ab[0] - 2 || b[2] > ab[2] + 2 || b[1] > ab[1] + 2 || b[3] < ab[3] - 2) add('off artboard', d.layers[i].name + ' / ' + it.typename + (it.name ? ' ' + it.name : ''));
  }
  for (i = 0; i < d.placedItems.length; i++) { try { if (!d.placedItems[i].file.exists) throw 0; } catch (e) { add('missing link', 'placed item ' + i); } }
  var saved = /\.(ai|pdf)$/i.test(d.name); // unsaved docs are "Untitled-N": checked again after saving
  if (saved && !/^\d{4,6}-[A-Z0-9]{2,8}-[A-Z0-9-]+-SPEC-101-\d{8}\.(ai|pdf)$/.test(d.name)) add('file name', d.name + ' (want OPP-CLIENT-PROJECT-SPEC-101-YYYYMMDD)');
  if (o.opp) { var found = false; for (i = 0; i < d.textFrames.length && !found; i++) found = d.textFrames[i].contents.indexOf(String(o.opp)) === 0; if (!found) add('title', 'no text starts with OPP ' + o.opp); }
  return { ok: !out.length, issues: out, counted: { texts: d.textFrames.length, chips: _keys(chips).length, spots: _keys(spots).length } };
}
function _keys(o) { var a = []; for (var k in o) if (o.hasOwnProperty(k)) a.push(k); return a; }

// ---------- Logo colours ----------
// SVG: exact hex values written in the file (fill/stroke/stop-color, attributes and style), most used first.
// Use this for SVG logos: placing an SVG into the CMYK sheet converts its colours.
function ynSvgColors(path) {
  var src = ynRead(path), hits = src.match(/(fill|stroke|stop-color)\s*[:=]\s*["']?\s*#[0-9a-fA-F]{3,6}/g) || [], n = {}, list = [], i, h, k;
  for (i = 0; i < hits.length; i++) {
    h = hits[i].replace(/^[^#]*#/, '').toUpperCase();
    if (h.length === 3) h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2);
    if (h.length === 6) n[h] = (n[h] || 0) + 1;
  }
  for (k in n) if (n.hasOwnProperty(k)) list.push({ hex: '#' + k, uses: n[k] });
  list.sort(function (a, b) { return b.uses - a.uses; });
  return { colors: list, embeddedImages: (src.match(/<image/g) || []).length };
}

// Placed logo (AI/EPS/PDF/SVG): fills/strokes/gradient stops, largest area first.
// Returns [{hex, model, area (sq in), spot?}]; also raster count (raster parts can't be matched by fill).
function ynLogoColors(item) {
  var acc = {}, rasters = 0;
  function hex2(v) { v = Math.max(0, Math.min(255, Math.round(v))); return (v < 16 ? '0' : '') + v.toString(16).toUpperCase(); }
  function rec(c, area) {
    var key, model = c.typename, spot = null, h;
    if (model === 'SpotColor') { spot = c.spot.name; c = c.spot.color; model = c.typename; }
    if (model === 'RGBColor') h = hex2(c.red) + hex2(c.green) + hex2(c.blue);
    else if (model === 'CMYKColor') { // colour-managed, like the Color panel (naive maths is far off for blues)
      var v = app.convertSampleColor(ImageColorSpace.CMYK, [c.cyan, c.magenta, c.yellow, c.black], ImageColorSpace.RGB, ColorConvertPurpose.defaultpurpose);
      h = hex2(v[0]) + hex2(v[1]) + hex2(v[2]);
    }
    else if (model === 'GrayColor') h = hex2(255 * (1 - c.gray / 100)) + hex2(255 * (1 - c.gray / 100)) + hex2(255 * (1 - c.gray / 100));
    else if (model === 'GradientColor') { for (var s = 0; s < c.gradient.gradientStops.length; s++) rec(c.gradient.gradientStops[s].color, area / c.gradient.gradientStops.length); return; }
    else return;
    key = h + (spot || '');
    if (!acc[key]) acc[key] = { hex: '#' + h, model: model, area: 0, spot: spot };
    acc[key].area += area;
  }
  function path(p) {
    var a = Math.abs(p.area) / 5184;
    if (p.filled) rec(p.fillColor, a);
    if (p.stroked && p.strokeWidth > 0) rec(p.strokeColor, Math.max(a * 0.05, p.length * p.strokeWidth / 5184));
  }
  function walk(it) {
    var t = it.typename, i;
    if (t === 'PathItem') { if (!it.clipping && !it.guides) path(it); }
    else if (t === 'CompoundPathItem') { if (it.pathItems.length) { var a = 0; for (i = 0; i < it.pathItems.length; i++) a += it.pathItems[i].area; var p0 = it.pathItems[0]; if (!p0.clipping) { if (p0.filled) rec(p0.fillColor, Math.abs(a) / 5184); if (p0.stroked) rec(p0.strokeColor, Math.abs(a) / 5184 * 0.05); } } }
    else if (t === 'GroupItem') { for (i = 0; i < it.pageItems.length; i++) walk(it.pageItems[i]); }
    else if (t === 'TextFrame') rec(it.textRange.characterAttributes.fillColor, it.width * it.height / 5184);
    else if (t === 'RasterItem' || t === 'PlacedItem') rasters++;
  }
  walk(item);
  var list = []; for (var k in acc) if (acc.hasOwnProperty(k)) { acc[k].area = Math.round(acc[k].area * 1000) / 1000; list.push(acc[k]); }
  list.sort(function (a, b) { return b.area - a.area; });
  return { colors: list, rasters: rasters };
}

// Top level on purpose: $.evalFile inside a function would make the siblings' functions local to it.
var YN_DIR = String(File($.fileName).parent);
$.evalFile(YN_DIR + '/yn_box.jsx');
$.evalFile(YN_DIR + '/yn_sheet.jsx');
