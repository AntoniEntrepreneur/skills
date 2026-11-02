(function () {
  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };
  var meta = JSON.parse($('#rows-data').textContent);
  var flags = {}, approvals = {}, db = null;
  // What this view just asked for, kept until the store agrees, so a late snapshot can't undo a click.
  var intent = { flags: {}, approvals: {} };
  // The note text is owned here once seen: snapshots only ever seed it, so they can't wipe what was typed.
  var notes = {}, timers = {}, noteState = {}, armed = {};
  var want = {}, busy = {};
  var save = $('#save');

  function status(text, isErr) { save.textContent = text; save.className = isErr ? 'save err' : 'save'; }
  function isFlagged(id) { return id in intent.flags ? intent.flags[id] : !!flags[id]; }
  function picked(id) { return id in intent.approvals ? intent.approvals[id] : (approvals[id] || null); }
  function hasNote(id) { return !!(notes[id] && notes[id].trim()); }
  function rowEl(id) { return document.getElementById('r-' + id); }

  function render() {
    var done = 0, flagged = 0, total = 0;
    Object.keys(meta).forEach(function (id) {
      var r = rowEl(id), f = isFlagged(id), p = picked(id);
      var flagBtn = r.querySelector('[data-flag]'), ta = r.querySelector('[data-note]');
      var st = r.querySelector('[data-note-status]');
      total++;
      if (f) flagged++;
      if (p) done++;
      r.classList.toggle('is-flagged', f);
      r.classList.toggle('is-done', !!p);
      // A flagged row counts as finished once it's left alone: nothing being typed or saved, and no failed save.
      r.classList.toggle('is-settled', f && !r.contains(document.activeElement) && !timers[id] && !busy['flags/' + id] && !want['flags/' + id] && noteState[id] !== 'Not saved. Try again.');
      flagBtn.setAttribute('aria-pressed', f ? 'true' : 'false');
      flagBtn.textContent = armed[id] === 'unflag' ? 'Remove flag and note?' : f ? 'Flagged' : 'Flag';
      flagBtn.disabled = !db;
      r.querySelectorAll('[data-pick]').forEach(function (b) {
        var on = p === b.dataset.version;
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
        b.textContent = armed[id] === 'pick:' + b.dataset.version ? b.dataset.idle + ' and drop note?' : on ? b.dataset.on : b.dataset.idle;
        b.disabled = !db;
      });
      r.querySelectorAll('[data-version-cell]').forEach(function (c) {
        c.classList.toggle('is-picked', p === c.dataset.versionCell);
      });
      r.querySelector('.notebox').hidden = !f;
      if (f && notes[id] === undefined) notes[id] = (flags[id] && flags[id].note) || '';
      if (f && document.activeElement !== ta && ta.value !== notes[id]) ta.value = notes[id];
      st.textContent = noteState[id] || '';
      st.classList.toggle('bad', noteState[id] === 'Not saved. Try again.');
    });
    $$('[data-section]').forEach(function (sec) {
      var n = sec.querySelectorAll('.row [data-flag]').length, fl = sec.querySelectorAll('.row.is-flagged').length, ap = sec.querySelectorAll('.row.is-done').length;
      var left = n - fl - ap, c = sec.querySelector('[data-count]'), chip = $('[data-chip="' + sec.dataset.section + '"]');
      sec.classList.toggle('all-done', n > 0 && ap === n);
      sec.classList.toggle('all-finished', n > 0 && sec.querySelectorAll('.row.is-done, .row.is-settled').length === n);
      if (c) c.textContent = n === 0 ? 'Nothing to review' : ap + ' of ' + n + ' done' + (fl ? ', ' + fl + ' flagged' : '') + (left ? ', ' + left + ' left' : '');
      if (chip) { chip.classList.toggle('done', n > 0 && ap === n); chip.classList.toggle('flagged', fl > 0); }
    });
    $('#s-done').textContent = done;
    $('#s-flag').textContent = flagged;
    $('#s-left').textContent = total - done - flagged;
  }

  // One write at a time per doc: a change made during a write is sent when it finishes, and only the latest counts.
  function send(path, value, after) {
    want[path] = { value: value, after: after };
    if (!busy[path]) flush(path);
  }

  function flush(path) {
    var w = want[path], d = db.doc(path);
    delete want[path];
    busy[path] = true;
    status('Saving…');
    (w.value ? d.set(w.value) : d.delete()).then(function () { return true; }, function (e) {
      status('Not saved: ' + ((e && e.message) || 'try again') + '.', true);
      return false;
    }).then(function (ok) {
      busy[path] = false;
      if (want[path]) { flush(path); return; }
      if (ok) status('Saved');
      if (w.after) w.after(ok);
    });
  }

  function flagDoc(id) {
    var m = meta[id];
    return { group: m.group, text: m.judged, versions: m.versions, note: notes[id] || '' };
  }

  function saveNote(id) {
    clearTimeout(timers[id]);
    delete timers[id];
    if (!isFlagged(id)) return;
    noteState[id] = 'Saving…';
    render();
    send('flags/' + id, flagDoc(id), function (ok) {
      if (!isFlagged(id)) return;
      noteState[id] = ok ? (hasNote(id) ? 'Note saved' : '') : 'Not saved. Try again.';
      render();
    });
  }

  function setFlag(id, on) {
    intent.flags[id] = on;
    if (on) {
      if (notes[id] === undefined) notes[id] = '';
      saveNote(id);
      return;
    }
    clearTimeout(timers[id]);
    delete notes[id]; delete noteState[id];
    send('flags/' + id, null, function (ok) {
      if (!ok) { delete intent.flags[id]; render(); }
    });
  }

  function setPicked(id, label) {
    var m = meta[id], chosen = m.versions.filter(function (v) { return v.label === label; })[0];
    intent.approvals[id] = label;
    send('approvals/' + id, label ? { group: m.group, version: label, text: chosen.text, at: new Date().toISOString() } : null, function (ok) {
      if (!ok) { delete intent.approvals[id]; render(); }
    });
  }

  function arm(id, what) {
    armed[id] = what;
    setTimeout(function () { if (armed[id] === what) { delete armed[id]; render(); } }, 4000);
  }

  document.addEventListener('click', function (ev) {
    if (!db) return;
    var f = ev.target.closest('[data-flag]'), p = ev.target.closest('[data-pick]'), sn = ev.target.closest('[data-save-note]');
    if (sn) { sn.blur(); saveNote(sn.dataset.saveNote); return; }
    if (f) {
      var id = f.dataset.flag;
      if (isFlagged(id)) {
        if (hasNote(id) && armed[id] !== 'unflag') { arm(id, 'unflag'); render(); return; }
        delete armed[id];
        setFlag(id, false);
        render();
        return;
      }
      delete armed[id];
      if (picked(id)) setPicked(id, null);
      setFlag(id, true);
      render();
      var ta = document.getElementById('note-' + id);
      if (ta) ta.focus();
      return;
    }
    if (p) {
      var rid = p.dataset.pick, label = p.dataset.version;
      if (picked(rid) === label) { setPicked(rid, null); render(); return; }
      if (isFlagged(rid)) {
        if (hasNote(rid) && armed[rid] !== 'pick:' + label) { arm(rid, 'pick:' + label); render(); return; }
        setFlag(rid, false);
      }
      delete armed[rid];
      setPicked(rid, label);
      render();
    }
  });

  document.addEventListener('input', function (ev) {
    var ta = ev.target.closest('[data-note]');
    if (!ta || !db) return;
    var id = ta.dataset.note;
    notes[id] = ta.value;
    noteState[id] = 'Typing…';
    var st = rowEl(id).querySelector('[data-note-status]');
    if (st) st.textContent = noteState[id];
    clearTimeout(timers[id]);
    timers[id] = setTimeout(function () { saveNote(id); }, 700);
  });

  document.addEventListener('focusout', function (ev) {
    var ta = ev.target.closest && ev.target.closest('[data-note]');
    if (ta && db && timers[ta.dataset.note]) saveNote(ta.dataset.note);
    setTimeout(render, 0);
  });

  $('#only-open').addEventListener('change', function (ev) {
    document.body.classList.toggle('only-open', ev.target.checked);
  });

  render();

  function offline() {
    $('#offline').hidden = false;
    status('Not saving');
    render();
  }

  function boot() {
    if (!window.claude || !window.claude.use) { return offline(); }
    var loading = setTimeout(function () { status('Saved answers are taking a while to load.', true); }, 10000);
    window.claude.use('db').then(function (handle) {
      if (!handle) { clearTimeout(loading); return offline(); }
      db = handle;
      db.collection('flags').onSnapshot(function (snap) {
        clearTimeout(loading);
        var next = {};
        snap.docs.forEach(function (d) { next[d.id] = d.data() || {}; });
        flags = next;
        Object.keys(intent.flags).forEach(function (id) { if (intent.flags[id] === !!next[id]) delete intent.flags[id]; });
        if (save.textContent.indexOf('Loading') === 0) status('Saved');
        render();
      }, function (e) { clearTimeout(loading); status('Couldn\'t load flags: ' + e.message, true); });
      db.collection('approvals').onSnapshot(function (snap) {
        var next = {};
        snap.docs.forEach(function (d) { next[d.id] = (d.data() || {}).version; });
        approvals = next;
        Object.keys(intent.approvals).forEach(function (id) { if (intent.approvals[id] === (next[id] || null)) delete intent.approvals[id]; });
        render();
      }, function (e) { status('Couldn\'t load approvals: ' + e.message, true); });
      render();
    }, offline);
  }

  boot();
})();
