// Fake db: a write lands after 120 ms, and its snapshot echo arrives 400 ms after that, so echoes can be stale.
(function () {
  var store = { flags: {}, approvals: {} }, subs = { flags: [], approvals: [] };
  window.__writes = []; window.__store = store; window.__overlaps = 0;
  var active = {};
  function emit(c, copy) {
    var snap = { docs: Object.keys(copy).map(function (k) { return { id: k, data: function () { return copy[k]; } }; }) };
    subs[c].forEach(function (f) { f(snap); });
  }
  function commit(c) { var copy = JSON.parse(JSON.stringify(store[c])); setTimeout(function () { emit(c, copy); }, 400); }
  function write(path, apply, entry) {
    var a = path.split('/');
    if (active[path]) window.__overlaps++;
    active[path] = true;
    window.__writes.push(entry);
    return new Promise(function (r) { setTimeout(function () { active[path] = false; apply(a); commit(a[0]); r(); }, 120); });
  }
  var db = {
    doc: function (p) {
      return {
        set: function (d) { return write(p, function (a) { store[a[0]][a[1]] = d; }, d.version || d.note); },
        delete: function () { return write(p, function (a) { delete store[a[0]][a[1]]; }, 'DELETE'); }
      };
    },
    collection: function (c) { return { onSnapshot: function (f) { subs[c].push(f); setTimeout(function () { emit(c, store[c]); }, 0); return function () {}; } }; }
  };
  window.claude = { use: function () { return Promise.resolve(db); } };
})();
