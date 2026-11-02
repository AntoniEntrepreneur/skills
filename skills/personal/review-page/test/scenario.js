// A: flag, type, click away at once. B: type, then press Flagged once. C: approve, then flag. D: Approve on a flagged row with a note, twice.
// E: pick A, then B straight away. F: flag with a note, then Pick B twice. H: pick, then unpick.
// J: with finished rows hidden, flag and type: the row stays until focus leaves and the note is saved.
setTimeout(function () {
  var rows = document.querySelectorAll('.row[data-row]'), log = {};
  var flag = function (r) { return r.querySelector('[data-flag]'); };
  var pick = function (r, v) { return r.querySelector('[data-pick][data-version="' + v + '"]'); };
  var ta = function (r) { return r.querySelector('[data-note]'); };
  var type = function (t, v) { t.focus(); t.value = v; t.dispatchEvent(new Event('input', { bubbles: true })); };
  var st = function (c, r) { return window.__store[c][r.dataset.row]; };
  var A = rows[0], B = rows[1], C = rows[2], D = rows[3], E = rows[4], F = rows[5], H = rows[6], J = rows[7];
  var shown = function (el) { return getComputedStyle(el).display !== 'none'; };
  flag(A).click();
  setTimeout(function () { type(ta(A), 'note A'); ta(A).blur(); }, 100);
  setTimeout(function () { flag(B).click(); }, 1500);
  setTimeout(function () { type(ta(B), 'note B'); ta(B).blur(); }, 1600);
  setTimeout(function () { flag(B).click(); }, 3200);
  setTimeout(function () { log.B_armed = flag(B).textContent; }, 3300);
  setTimeout(function () { pick(C, 'New').click(); }, 3400);
  setTimeout(function () { log.C_label = pick(C, 'New').textContent; flag(C).click(); }, 4400);
  setTimeout(function () { flag(D).click(); }, 4500);
  setTimeout(function () { type(ta(D), 'note D'); ta(D).blur(); }, 4600);
  setTimeout(function () { pick(D, 'New').click(); }, 6000);
  setTimeout(function () { log.D_armed = pick(D, 'New').textContent; pick(D, 'New').click(); }, 6100);
  setTimeout(function () { pick(E, 'A').click(); }, 6200);
  setTimeout(function () { pick(E, 'B').click(); log.E_label = pick(E, 'B').textContent; }, 6230);
  setTimeout(function () { flag(F).click(); }, 6300);
  setTimeout(function () { type(ta(F), 'note F'); ta(F).blur(); }, 6350);
  setTimeout(function () { pick(F, 'B').click(); }, 7300);
  setTimeout(function () { log.F_armed = pick(F, 'B').textContent; pick(F, 'B').click(); }, 7350);
  setTimeout(function () { pick(H, 'A').click(); }, 7400);
  setTimeout(function () { pick(H, 'A').click(); }, 8100);
  setTimeout(function () { document.getElementById('only-open').click(); flag(J).click(); }, 8500);
  setTimeout(function () { log.J_afterFlag = shown(J); type(ta(J), 'note J'); }, 8700);
  setTimeout(function () { log.J_typing = shown(J); ta(J).blur(); }, 8900);
  setTimeout(function () {
    log.hide = { J: shown(J), A_note: shown(A), C_noNote: shown(C), D_approved: shown(D), H_untouched: shown(H), E_picked: shown(E), firstSection: shown(A.closest('.topic')), secondSection: shown(H.closest('.topic')) };
    log.A = { shown: ta(A).value, stored: (st('flags', A) || {}).note };
    log.B = { shown: ta(B).value, hidden: ta(B).closest('.notebox').hidden, stored: (st('flags', B) || {}).note, button: flag(B).textContent };
    log.C = { approved: !!st('approvals', C), flagged: !!st('flags', C), cls: C.className };
    log.D = { approved: !!st('approvals', D), flagged: !!st('flags', D) };
    log.E = { version: (st('approvals', E) || {}).version, text: (st('approvals', E) || {}).text, cls: E.querySelector('.is-picked').dataset.versionCell };
    log.F = { version: (st('approvals', F) || {}).version, flagged: !!st('flags', F) };
    log.H = { approved: !!st('approvals', H), label: pick(H, 'A').textContent };
    log.flagDoc = st('flags', A);
    log.lockedButtons = document.querySelectorAll('.row.locked button').length;
    log.counts = ['s-done', 's-flag', 's-left'].map(function (i) { return document.getElementById(i).textContent; });
    log.overlaps = window.__overlaps;
    var p = document.createElement('pre'); p.id = 'result'; p.textContent = JSON.stringify(log); document.body.appendChild(p);
  }, 9600);
}, 300);
