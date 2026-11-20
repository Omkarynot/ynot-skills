// Skill self-check, no client files needed. With the adobe MCP:
//   run_jsx({app:"illustrator", file:"<skill>/test/selftest.jsx", include:["<skill>/scripts/yn_lib.jsx"], rollbackOnError:true})
// Builds a sheet (specs + tuck-end + mailer dielines + notes), runs ynQC, closes it, and returns what failed.
var fails = [];
function check(ok, what) { if (!ok) fails.push(what); }
check(ynIn(2.25) === '2.25" (5.72 cm)', 'ynIn');
var r = ynBuildSheet({
  title: '00000 - TEST - Self Check Sheet',
  sections: [
    { type: 'specs', panels: [{ title: 'Specs', lines: [['Product', 'Test box'], ['Packaging Method', 'A deliberately long value that has to wrap onto a second line inside the column instead of running off the edge of the sheet.']] },
                              { title: 'Features', lines: [['\u2022 One', 'First']] }] },
    { type: 'dieline', box: 'tuck', dims: [3.8, 1.1, 6.1], opts: { hangTab: 1 } },
    { type: 'dieline', box: 'mailer', dims: [7.27, 3.69, 1.52] },
    { type: 'notes', lines: [{ text: 'Self check.', color: 'red' }] }
  ]
}, '');
var d = YN.doc, q = ynQC({ opp: '00000', doc: d.name });
check(q.ok, 'QC: ' + q.issues.join('; '));
var cuts = 0; for (var i = 0; i < d.pathItems.length; i++) if (d.pathItems[i].name === 'Die-cut') cuts++;
check(cuts === 2, 'expected 2 die-cut outlines, got ' + cuts);
check(r.height > 20 && r.height < 60, 'sheet height ' + r.height);
d.close(SaveOptions.DONOTSAVECHANGES);
fails.length ? 'FAIL: ' + fails.join(' | ') : 'ok (sheet ' + r.height + ' in)'
