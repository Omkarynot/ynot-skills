// spec.json -> complete Y-Not sheet. Loaded by yn_lib.jsx.
//   ynBuildSheet(JSON.parse(ynRead(job + "spec.json")).sheet, job)  ->  {height, log}
// Sections stack top to bottom and size themselves; the artboard height follows. Section types:
//   mockup  {title, views:[{label, file, dims:[{x1,y1,x2,y2,value,label}], callouts:[{x,y,text,side}]}], color, height}
//           dims/callouts use FRACTIONS of the placed image (0..1, may go slightly outside), so they survive resizing.
//   artwork {panels:[{title, sub, logos:[{file, w, gapAfter}], chipTitle, chips:[{code, lab:[L,a,b]}],
//            gradients:[{name, stops:[code...], at:[0..100...]}], notes:[{text, color:'red'|'black'}]}]}
//   image   {title, file, caption, height}
//   specs   {panels:[{title, lines:[[key, value]...]}]}
//   dieline {title, box:'tuck'|'mailer', dims:[a,b,c], opts, art:{Panel: file | {file, w}}, note}  (w = art width, else fit the panel)
//   notes   {lines:[{text, color}]}
// ponytail: one generic stacker; per product type only the section list in spec.json changes.

function ynRead(path) { var f = new File(path); f.encoding = 'UTF-8'; f.open('r'); var s = f.read(); f.close(); return s; }

// Wrapped paragraph that sizes its frame to its lines. Returns the y below it.
function _paraAuto(layer, str, x, y, w, size, color) {
  var tf = ynPara(layer, str, x, y, w, 10, size, color), a = tf.textRange.characterAttributes, lh = size * 1.25;
  a.autoLeading = false; a.leading = lh;
  var n = Math.max(1, tf.lines.length); tf.textPath.height = n * lh + 4; tf.textPath.top = _Y(y);
  return y + (n * lh + 4) / 72;
}

function _colours(c) { return { red: YN_C.red, cyan: YN_C.cyan }[c] || YN_C.black; } // no chained ?: in ExtendScript
function _r2(v) { return Math.round(v * 100) / 100; }

function ynBuildSheet(S, job) {
  var W = S.width || 14, M = 0.5, IW = W - 2 * M, GAP = 0.2, log = [];
  function abs(p) { return /^([A-Za-z]:|\/|~)/.test(p) ? p : job + p; }
  ynInit(W, 200);
  var spots = {};
  function spot(ch) { if (!spots[ch.code]) spots[ch.code] = ynAddSpot('PANTONE ' + ch.code, { l: ch.lab[0], a: ch.lab[1], b: ch.lab[2] }); return spots[ch.code]; }

  // Title: wrap at ~55 characters per line
  var words = S.title.split(' '), lines = [''], y = 0.35;
  for (var i = 0; i < words.length; i++) {
    var cur = lines[lines.length - 1];
    if (cur && (cur + ' ' + words[i]).length > 55) lines.push(words[i]); else lines[lines.length - 1] = cur ? cur + ' ' + words[i] : words[i];
  }
  for (i = 0; i < lines.length; i++, y += 0.37) ynText('Header', lines[i], W / 2, y, 23, true, YN_C.black, 'C');
  ynText('Header', S.subtitle || 'Specs', W / 2, y + 0.05, 23, true, YN_C.cyan, 'C');
  y += 0.6;

  function frame(top, h, titles, subs) { // box + header per column, column dividers
    var n = titles.length, cw = IW / n;
    ynRect('Header', M, top, IW, h, null);
    for (var c = 0; c < n; c++) {
      if (c) ynLine('Header', M + c * cw, top, M + c * cw, top + h, YN_C.black, 0.75);
      if (titles[c]) ynText('Header', titles[c], M + c * cw + cw / 2, top + 0.08, 15, true, YN_C.cyan, 'C');
      if (subs && subs[c]) ynText('Header', '(' + subs[c] + ')', M + c * cw + cw / 2, top + 0.32, 12, true, YN_C.cyan, 'C');
    }
  }

  var B = {
    mockup: function (s, top) {
      var n = s.views.length, cw = IW / n, h = s.height || 5.8, head = 0.75;
      var titles = []; for (var c = 0; c < n; c++) titles.push(s.title || 'Mockup');
      for (c = 0; c < n; c++) {
        var v = s.views[c], cx = M + c * cw;
        if (v.label) ynText('Header', v.label, cx + cw / 2, top + 0.4, 12, true, YN_C.red, 'C');
        var it = ynPlace('Mockup', abs(v.file), cx + 1.5, top + head + 0.3, cw - 3.0, h - head - 0.8);
        var p = ynPos(it), z = ynSize(it);
        function X(f) { return p.x + f * z.w; } function Y(f) { return p.y + f * z.h; }
        for (var k = 0; v.dims && k < v.dims.length; k++) {
          var d = v.dims[k], horiz = Math.abs(d.y2 - d.y1) < Math.abs(d.x2 - d.x1);
          if (horiz) { ynDim(X(d.x1), Y(d.y1), (d.x2 - d.x1) * z.w, 'H', d.value); if (d.label) ynText('Dimensions', d.label, X((d.x1 + d.x2) / 2), Y(d.y1) - 0.17, 8, false, YN_C.red, 'C'); }
          else ynDim(X(d.x1), Y(d.y1), (d.y2 - d.y1) * z.h, 'V', d.value);
        }
        for (k = 0; v.callouts && k < v.callouts.length; k++) {
          var o = v.callouts[k], right = o.side ? o.side === 'R' : o.x >= 0.5;
          var tw = o.text.length * 0.065; // ~8.4 pt Arial: keep the label inside its column
          var lx = right ? Math.min(p.x + z.w + 0.3, cx + cw - tw - 0.15) : Math.max(p.x - 0.3, cx + tw + 0.15);
          ynCallout(X(o.x), Y(o.y), lx, Y(o.ly === undefined ? o.y : o.ly), o.text);
        }
      }
      if (s.color) {
        ynRect('Mockup', M + IW - 2.6, top + h - 0.45, 0.22, 0.22, YN_C.white, YN_C.grey, 0.5);
        ynText('Mockup', 'Product Color: ' + s.color, M + IW - 2.3, top + h - 0.41, 10.2, false);
      }
      frame(top, h, titles);
      return h;
    },

    artwork: function (s, top) {
      var n = s.panels.length, cw = IW / n, bottom = top, titles = [], subs = [];
      for (var c = 0; c < n; c++) {
        var P = s.panels[c], cx = M + c * cw, yy = top + (P.sub ? 0.75 : 0.55) + 0.35, lx = cx + 0.9, sizes = [];
        titles.push(P.title); subs.push(P.sub);
        for (var k = 0; P.logos && k < P.logos.length; k++) {
          var L = P.logos[k], it = ynPlace('Logo Artwork', abs(L.file), lx, yy, L.w, 20);
          ynScaleToWidth(it, L.w); _moveTo(it, _X(lx), _Y(yy)); // top-left at the cursor, not centred in the fit box
          var z = ynSize(it), p = ynPos(it), zw = _r2(z.w), zh = _r2(z.h);
          // width dim above the first logo, below the others (above would collide with the logo before it)
          ynDim(p.x, k ? p.y + z.h + 0.12 : p.y - 0.22, z.w, 'H', zw); ynDim(p.x - 0.15, p.y, z.h, 'V', zh);
          sizes.push((L.name ? L.name + ' ' : '') + ynIn(zw) + ' x ' + ynIn(zh)); log.push((L.name || L.file) + ' ' + zw + 'x' + zh);
          yy = p.y + z.h + (k ? 0.35 : 0) + (L.gapAfter !== undefined ? L.gapAfter : 0.45);
        }
        var chx = cx + Math.max(2.4, cw * 0.48), chy = top + (P.sub ? 0.75 : 0.55) + 0.1;
        if (P.chips && P.chips.length) {
          ynText('Logo Artwork', P.chipTitle || 'PMS Colors', chx, chy, 9, true); chy += 0.27;
          var two = P.chips.length > 6, colW = (M + (c + 1) * cw - chx) / 2;
          for (k = 0; k < P.chips.length; k++) {
            var row = two ? k % Math.ceil(P.chips.length / 2) : k, col = two && k >= Math.ceil(P.chips.length / 2) ? 1 : 0;
            ynChip(chx + col * colW, chy + row * 0.32, spot(P.chips[k]), P.chips[k].code);
          }
          chy += (two ? Math.ceil(P.chips.length / 2) : P.chips.length) * 0.32 + 0.1;
        }
        for (k = 0; P.gradients && k < P.gradients.length; k++) {
          var G = P.gradients[k], gr = YN.doc.gradients.add(); gr.name = G.name; gr.type = GradientType.LINEAR;
          for (var q = 0; q < G.stops.length; q++) {
            var st = q < 2 ? gr.gradientStops[q === 0 ? 0 : 1] : gr.gradientStops.add();
            st.rampPoint = G.at ? G.at[q] : q * 100 / (G.stops.length - 1); st.color = spots[G.stops[q]];
          }
          ynText('Logo Artwork', G.name + ':', chx, chy, 9, true);
          var gc = new GradientColor(); gc.gradient = gr;
          var bar = ynRect('Logo Artwork', chx, chy + 0.2, 2.2, 0.16, null, YN_C.grey, 0.25); bar.filled = true; bar.fillColor = gc;
          ynText('Logo Artwork', '(Gradient similar to the Pantone codes above)', chx, chy + 0.42, 8, false);
          chy += 0.7;
        }
        yy = Math.max(yy, chy) + 0.1;
        for (k = 0; P.notes && k < P.notes.length; k++) yy = _paraAuto('Notes', P.notes[k].text, cx + 0.2, yy, cw - 0.4, 8.4, _colours(P.notes[k].color)) + 0.05;
        P._sizes = sizes; bottom = Math.max(bottom, yy + 0.15);
      }
      frame(top, bottom - top, titles, subs);
      return bottom - top;
    },

    image: function (s, top) {
      var it = ynPlace('Reference', abs(s.file), M + 0.2, top + 0.45, IW - 0.4, s.height || 4.4);
      var p = ynPos(it), z = ynSize(it), yy = p.y + z.h + 0.1;
      if (s.caption) { ynText('Reference', s.caption, W / 2, yy, 8.4, false, YN_C.black, 'C'); yy += 0.2; }
      frame(top, yy - top + 0.1, [s.title || 'Reference Images']);
      return yy - top + 0.1;
    },

    specs: function (s, top) {
      var n = s.panels.length, cw = IW / n, bottom = top, titles = [];
      for (var c = 0; c < n; c++) {
        titles.push(s.panels[c].title);
        bottom = Math.max(bottom, ynSpecs('Specs', s.panels[c].lines, M + c * cw + 0.2, top + 0.45, 9.4, cw - 0.4));
      }
      frame(top, bottom - top + 0.15, titles);
      return bottom - top + 0.15;
    },

    dieline: function (s, top) {
      var d = s.dims, bx = M + 0.6, by = top + 0.7;
      var box = s.box === 'mailer' ? ynMailer(bx, by, d[0], d[1], d[2], s.opts) : ynTuckEnd(bx, by, d[0], d[1], d[2], s.opts);
      var art = s.art || {}; // ES3: for-in over undefined throws
      for (var k in art) if (art.hasOwnProperty(k) && box.panels[k]) { var A = typeof art[k] === 'string' ? { file: art[k] } : art[k]; ynPanelArt(box.panels[k], abs(A.file), A.pad, A.w); }
      ynDielineDims(box);
      ynDielineLegend(M + IW - 2.6, top + 0.45);
      var yy = box.y + box.h + 0.75;
      yy = _paraAuto('Notes', s.note || 'Dieline for reference only. Confirm with the factory die line before printing.', M + 0.3, yy, IW - 0.6, 8.4, YN_C.red);
      frame(top, yy - top + 0.15, [s.title || 'Dieline (1:1)']);
      return yy - top + 0.15;
    },

    notes: function (s, top) {
      var yy = top + 0.45;
      for (var k = 0; k < s.lines.length; k++) yy = _paraAuto('Notes', s.lines[k].text, M + 0.3, yy, IW - 0.6, 9, _colours(s.lines[k].color)) + 0.04;
      frame(top, yy - top + 0.1, [s.title || 'Notes']);
      return yy - top + 0.1;
    }
  };

  for (i = 0; i < S.sections.length; i++) {
    var sec = S.sections[i];
    if (!B[sec.type]) throw new Error('Unknown section type "' + sec.type + '" (section ' + (i + 1) + ')');
    y += B[sec.type](sec, y) + GAP;
  }
  ynSetHeight(y + 0.3);
  return { height: _r2(y + 0.3), log: log };
}
