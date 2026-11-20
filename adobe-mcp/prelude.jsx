// Sent by server.mjs in front of every run_jsx script. ExtendScript is ES3: keep it that way.
// Polyfill only when the host has no JSON; marked so a newer prelude replaces an older one without an app restart.
if (typeof JSON !== 'object') JSON = { __mcp: 1 };
if (!JSON.stringify || JSON.__mcp) JSON.stringify = function (v) {
  var t = typeof v;
  if (v === null || t === 'undefined' || (t === 'number' && !isFinite(v))) return 'null';
  if (t === 'number' || t === 'boolean') return String(v);
  // ponytail: lookup table, not a ternary chain (ExtendScript mis-evaluates long nested ternaries)
  if (t === 'string') return '"' + v.replace(/[\\"\u0000-\u001f]/g, function (c) {
    var m = { '"': '\\"', '\\': '\\\\', '\n': '\\n', '\r': '\\r', '\t': '\\t' }[c];
    return m || '\\u' + ('000' + c.charCodeAt(0).toString(16)).slice(-4);
  }) + '"';
  var a = [], k;
  if (v instanceof Array) { for (k = 0; k < v.length; k++) a.push(JSON.stringify(v[k])); return '[' + a.join(',') + ']'; }
  if (v.constructor !== Object) return JSON.stringify(String(v)); // DOM objects -> their name
  for (k in v) if (v.hasOwnProperty(k) && typeof v[k] !== 'function') a.push(JSON.stringify(k) + ':' + JSON.stringify(v[k]));
  return '{' + a.join(',') + '}';
};
if (!JSON.parse || JSON.__mcp) JSON.parse = function (s) { return eval('(' + s + ')'); }; // ponytail: trusted local files only

function __mcpOut(v) {
  return v !== null && typeof v === 'object' && (v instanceof Array || v.constructor === Object) ? JSON.stringify(v) : String(v);
}
function __mcpErr(e, src) {
  var file = /[\/\\]/.test(String(e.fileName || '')) ? String(e.fileName) : '', line = e.line, code = '';
  try {
    var f = file && new File(file);
    if (f && f.exists) { f.encoding = 'UTF-8'; f.open('r'); code = f.read().split('\n')[line - 1]; f.close(); }
    else code = src.split('\n')[line - 1];
  } catch (x) {}
  return 'ERROR: ' + e + ' (' + (file ? File.decode(file) + ', ' : '') + 'line ' + line + ')' + (code ? '\n  > ' + code.replace(/^\s+/, '') : '');
}
function __mcpDocs() {
  try { var n = {}; for (var i = 0; i < app.documents.length; i++) n[app.documents[i].name] = 1; return n; } catch (e) { return null; }
}
function __mcpRollback(before) {
  if (!before) return;
  try { for (var i = app.documents.length - 1; i >= 0; i--) if (!before[app.documents[i].name]) app.documents[i].close(SaveOptions.DONOTSAVECHANGES); } catch (e) {}
}

// No modal alerts while a script runs (a dialog would block the bridge until someone clicks it); restored after.
var __mcpUI = {};
try { __mcpUI.ai = app.userInteractionLevel; app.userInteractionLevel = UserInteractionLevel.DONTDISPLAYALERTS; } catch (e) {}
try { if (app.displayDialogs !== undefined) { __mcpUI.ps = app.displayDialogs; app.displayDialogs = DialogModes.NO; } } catch (e) {}
function __mcpRestore() {
  try { if (__mcpUI.ai !== undefined) app.userInteractionLevel = __mcpUI.ai; } catch (e) {}
  try { if (__mcpUI.ps !== undefined) app.displayDialogs = __mcpUI.ps; } catch (e) {}
}
