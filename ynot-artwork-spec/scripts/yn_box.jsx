// Box dielines drawn from box dimensions (inches), when the factory has not supplied one.
// Loaded by yn_lib.jsx. Standard colours: Die-cut yellow / Fold red (dashed) / Bleed green, all "(Do not Print)".
// The flat is traced clockwise as one closed cut outline; every flap's hinge is a fold line.
// ponytail: geometry follows the team's sheets (#08 tuck end, #20 mailer); the sheet says "confirm with factory die".

var YN_DL = { cut: _cmyk(0, 0, 100, 0), fold: _cmyk(0, 100, 100, 0), bleed: _cmyk(75, 0, 100, 0), bleedIn: 0.125 };

// edges: clockwise list of {a:[x,y], b:[x,y], flap:{d, ins, c, next}} (flap optional).
// d = depth out from the hinge, ins = taper at each end of the far edge, c = corner chamfer, next = flap on the far edge.
function _dlTrace(edges) {
  var pts = [], folds = [];
  function P(p) { var l = pts[pts.length - 1]; if (!l || Math.abs(l[0] - p[0]) > 1e-6 || Math.abs(l[1] - p[1]) > 1e-6) pts.push(p); }
  function edge(a, b, f) {
    if (!f) { P(a); P(b); return; }
    folds.push([a, b]);
    var ux = b[0] - a[0], uy = b[1] - a[1], L = Math.sqrt(ux * ux + uy * uy); ux /= L; uy /= L;
    var nx = uy, ny = -ux, d = f.d, ins = f.ins || 0, c = f.c || 0;
    function at(s, t) { return [a[0] + ux * s + nx * t, a[1] + uy * s + ny * t]; } // s along hinge, t outward
    P(a);
    if (f.next) { edge(at(ins, d), at(L - ins, d), f.next); }
    else { P(at(ins, d - c)); P(at(ins + c, d)); P(at(L - ins - c, d)); P(at(L - ins, d - c)); }
    P(b);
  }
  for (var i = 0; i < edges.length; i++) edge(edges[i].a, edges[i].b, edges[i].flap);
  return { pts: pts, folds: folds };
}

function _dlDraw(t) {
  var L = 'Dieline', cut = ynPath(L, t.pts, true, null, YN_DL.cut, 0.75);
  cut.name = 'Die-cut';
  // Bleed: the cut outline pushed out by YN_DL.bleedIn (mitred corners). Computed, not the Offset Path effect,
  // because live effects can open a dialog and block the script.
  // Slits between neighbouring flaps (edge goes down to the hinge and straight back up) are bridged first,
  // otherwise the offset folds over itself there.
  var b = YN_DL.bleedIn, P = t.pts.slice(), N = [], out = [], k, changed = true;
  while (changed) {
    changed = false;
    for (k = 0; k < P.length && P.length > 3; k++) {
      var A = P[(k + P.length - 1) % P.length], C = P[k], D2 = P[(k + 1) % P.length];
      var ix = C[0] - A[0], iy = C[1] - A[1], ox = D2[0] - C[0], oy = D2[1] - C[1];
      var li = Math.sqrt(ix * ix + iy * iy) || 1, lo = Math.sqrt(ox * ox + oy * oy) || 1;
      if ((ix * ox + iy * oy) / (li * lo) < -0.9) { P.splice(k, 1); changed = true; break; }
    }
  }
  var n = P.length;
  for (k = 0; k < n; k++) {
    var q = P[(k + 1) % n], dx = q[0] - P[k][0], dy = q[1] - P[k][1], len = Math.sqrt(dx * dx + dy * dy) || 1;
    N.push([dy / len, -dx / len]);
  }
  for (k = 0; k < n; k++) {
    var a = N[(k + n - 1) % n], c = N[k], dot = a[0] * c[0] + a[1] * c[1];
    out.push(1 + dot < 0.2 ? [P[k][0] + c[0] * b, P[k][1] + c[1] * b] : [P[k][0] + b * (a[0] + c[0]) / (1 + dot), P[k][1] + b * (a[1] + c[1]) / (1 + dot)]);
  }
  var bl = ynPath(L, out, true, null, YN_DL.bleed, 0.5); bl.name = 'Bleed'; bl.zOrder(ZOrderMethod.SENDTOBACK);
  for (var i = 0; i < t.folds.length; i++) {
    var f = t.folds[i]; ynLine(L, f[0][0], f[0][1], f[1][0], f[1][1], YN_DL.fold, 0.5, [4, 2]).name = 'Fold';
  }
  return cut;
}

// Tuck-end retail box (reverse tuck). W = front width, D = depth (side), H = height. x,y = top-left of the flat.
// Flat, left -> right: glue | Back W | Side D | Front W | Side D. Top lid on the Front, bottom lid on the Back.
// opts: {glue: 0.5, tuck: 0.6, hangTab: 0 (inches tall, on the Back top), straight: false (both lids on the Front)}
function ynTuckEnd(x, y, W, D, H, opts) {
  opts = opts || {};
  var g = opts.glue || 0.5, t = opts.tuck || Math.min(0.75, Math.max(0.45, D * 0.6)), df = Math.min(W / 2 - 0.05, D + 0.1);
  var hang = opts.hangTab || 0, top = Math.max(D + t, df, hang), bot = Math.max(D + t, df);
  var x1 = x + g, xs = [x1, x1 + W, x1 + W + D, x1 + 2 * W + D, x1 + 2 * W + 2 * D], yT = y + top, yB = yT + H;
  var dust = { d: df, ins: 0.12, c: 0.1 }, lid = { d: D, next: { d: t, ins: 0.06, c: Math.min(0.25, t * 0.45) } };
  var topBack = hang ? { d: hang, ins: 0.05, c: 0.25 } : null, botFront = opts.straight ? lid : null, botBack = opts.straight ? null : lid;
  var tr = _dlTrace([
    { a: [x1, yT], b: [xs[1], yT], flap: topBack },
    { a: [xs[1], yT], b: [xs[2], yT], flap: dust },
    { a: [xs[2], yT], b: [xs[3], yT], flap: lid },
    { a: [xs[3], yT], b: [xs[4], yT], flap: dust },
    { a: [xs[4], yT], b: [xs[4], yB] },
    { a: [xs[4], yB], b: [xs[3], yB], flap: dust },
    { a: [xs[3], yB], b: [xs[2], yB], flap: botFront },
    { a: [xs[2], yB], b: [xs[1], yB], flap: dust },
    { a: [xs[1], yB], b: [x1, yB], flap: botBack },
    { a: [x1, yB], b: [x1, yT], flap: { d: g, ins: Math.min(0.35, H * 0.1) } }
  ]);
  for (var i = 1; i < 4; i++) tr.folds.push([[xs[i], yT], [xs[i], yB]]);
  _dlDraw(tr);
  if (hang) { var sw = Math.min(1.1, W * 0.4); // euro slot
    var sx = x1 + W / 2 - sw / 2, sy = yT - hang / 2 - 0.09;
    ynLayer('Dieline').pathItems.roundedRectangle(_Y(sy), _X(sx), _pt(sw), _pt(0.18), 6, 6).strokeColor = YN_DL.cut;
  }
  var p = {
    Back: { x: x1, y: yT, w: W, h: H }, Side1: { x: xs[1], y: yT, w: D, h: H }, Front: { x: xs[2], y: yT, w: W, h: H },
    Side2: { x: xs[3], y: yT, w: D, h: H }, Top: { x: xs[2], y: yT - D, w: W, h: D, rotate: 180 },
    Bottom: { x: opts.straight ? xs[2] : x1, y: yB, w: W, h: D }
  };
  return { x: x, y: y, w: xs[4] - x, h: top + H + bot, panels: p, widths: [g, W, D, W, D], bodyY: yT, bodyH: H };
}

// Mailer box (roll-end front tuck). L = length (left-right), W = width (front-back), H = wall height.
// Centre column, top -> bottom: lid tuck | Lid W | Back wall H | Base W | Front wall H | front tuck.
// Side columns (H wide): lid side flaps, dust flaps, side walls, ears. Lid art reads 180 deg to the base.
function ynMailer(x, y, L, W, H, opts) {
  opts = opts || {};
  var tf = opts.tuck || Math.min(0.9, Math.max(0.5, H * 0.6)), ft = opts.frontTuck || H * 0.9;
  var x0 = x + H, x1 = x0 + L, y0 = y + tf, yLid = y0 + W, yBack = yLid + H, yBase = yBack + W, yFront = yBase + H;
  var sideW = { d: H, ins: 0 }, dust = { d: H - 0.04, ins: 0.15, c: 0.12 }, lidFlap = { d: H - 0.08, ins: Math.min(0.5, W * 0.15), c: 0.15 };
  var ear = { d: H - 0.06, ins: 0.1, c: 0.2 };
  var tr = _dlTrace([
    { a: [x0, y0], b: [x1, y0], flap: { d: tf, ins: 0.15, c: Math.min(0.3, tf * 0.45) } },
    { a: [x1, y0], b: [x1, yLid], flap: lidFlap },
    { a: [x1, yLid], b: [x1, yBack], flap: dust },
    { a: [x1, yBack], b: [x1, yBase], flap: sideW },
    { a: [x1, yBase], b: [x1, yFront], flap: ear },
    { a: [x1, yFront], b: [x0, yFront], flap: { d: ft, ins: 0.1, c: Math.min(0.35, ft * 0.4) } },
    { a: [x0, yFront], b: [x0, yBase], flap: ear },
    { a: [x0, yBase], b: [x0, yBack], flap: sideW },
    { a: [x0, yBack], b: [x0, yLid], flap: dust },
    { a: [x0, yLid], b: [x0, y0], flap: lidFlap }
  ]);
  var ys = [yLid, yBack, yBase];
  for (var i = 0; i < ys.length; i++) tr.folds.push([[x0, ys[i]], [x1, ys[i]]]);
  _dlDraw(tr);
  return {
    x: x, y: y, w: L + 2 * H, h: tf + 2 * W + 2 * H + ft, widths: [H, L, H], bodyY: y0, bodyH: 2 * W + 2 * H,
    panels: { Lid: { x: x0, y: y0, w: L, h: W, rotate: 180 }, Back: { x: x0, y: yLid, w: L, h: H, rotate: 180 },
      Base: { x: x0, y: yBack, w: L, h: W }, Front: { x: x0, y: yBase, w: L, h: H },
      Left: { x: x, y: yBack, w: H, h: W }, Right: { x: x1, y: yBack, w: H, h: W } },
    rows: [tf, W, H, W, H, ft]
  };
}

// Panel widths along the bottom (one row of tick dims) and the body height on the right, as on the team's sheets.
function ynDielineDims(box) {
  var x = box.x, yb = box.y + box.h + 0.3;
  for (var i = 0; i < box.widths.length; i++) { ynDim(x, yb, box.widths[i], 'H', box.widths[i]); x += box.widths[i]; }
  ynDim(box.x + box.w + 1.0, box.bodyY, box.bodyH, 'V', box.bodyH); // label sits left of the line, clear of the bleed
}

// Legend: three swatches + labels, top-left at x,y.
function ynDielineLegend(x, y) {
  var rows = [['Die-cut line', YN_DL.cut, null], ['Fold line', YN_DL.fold, [4, 2]], ['Bleed line', YN_DL.bleed, null]];
  for (var i = 0; i < rows.length; i++) {
    var yy = y + i * 0.22;
    ynLine('Dieline', x, yy + 0.07, x + 0.45, yy + 0.07, rows[i][1], 1, rows[i][2]);
    ynText('Dieline', rows[i][0] + ' (Do not Print)', x + 0.55, yy, 8.4, false);
  }
}

// Place art centred in a box panel: at width w (inches) if given, else fitted inside it (pad inches).
// Rotated when the panel folds over (lid/back) so it reads correctly once folded.
function ynPanelArt(panel, path, pad, w) {
  pad = pad === undefined ? 0.15 : pad;
  var it = ynPlace('Artwork', path, panel.x + pad, panel.y + pad, panel.w - 2 * pad, panel.h - 2 * pad);
  if (w) { ynScaleToWidth(it, w); var z = ynSize(it); _moveTo(it, _X(panel.x + (panel.w - z.w) / 2), _Y(panel.y + (panel.h - z.h) / 2)); }
  if (panel.rotate) it.rotate(panel.rotate);
  return it;
}
