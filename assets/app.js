/* PowerChapter prototype — application script (no build step, no dependencies beyond d3 + topojson-client). */
(function () {
'use strict';

var C = window.PC_CONFIG, M = window.MAPDATA;
if (!C || !M) { document.getElementById('app').innerHTML = '<div class="wrap section"><p>Data files did not load.</p></div>'; return; }
var DATA = M.data, STN = M.stnames, F2S = M.fips2st, TOP = M.top;
var hasMap = !!(window.d3 && window.topojson);

/* ---------------- helpers ---------------- */
function $(s, r) { return (r || document).querySelector(s); }
function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function fmt(n) { return Math.round(n).toLocaleString('en-US'); }
function pct(a, b) { return b ? (a / b * 100).toFixed(1) + '%' : '—'; }
function norm(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim(); }
function toast(msg) { var t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove('show'); }, 3200); }
var ICON = {
  search: '<svg class="ico" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2"/><path d="m20 20-3.5-3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  pin: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12Z" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="10" r="2.6" fill="currentColor"/></svg>',
  target: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="7" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="2.5" fill="currentColor"/><path d="M12 1v4M12 19v4M1 12h4M19 12h4" stroke="currentColor" stroke-width="2"/></svg>',
  img: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" stroke-width="1.6"/><circle cx="9" cy="10" r="2" stroke="currentColor" stroke-width="1.6"/><path d="m21 16-5-5-8 8" stroke="currentColor" stroke-width="1.6"/></svg>',
  x: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'
};
function photo(src, label) {
  return '<div class="photo"><div class="ph">' + ICON.img + '<span>' + esc(label) + '</span></div>' +
    '<img src="' + esc(src) + '" alt="" loading="lazy" onerror="this.remove()"></div>';
}

/* ---------------- data prep ---------------- */
var TOT = {};
Object.keys(DATA).forEach(function (f) { var v = DATA[f]; var t = TOT[v[1]] || (TOT[v[1]] = { e: 0, m: 0 }); t.e += v[2]; t.m += v[3]; });
var CH = {}, SERVED = {};
C.CHAPTERS.forEach(function (c) { CH[c.id] = c; c.counties.forEach(function (f) { SERVED[f] = c.id; }); });
function chStats(c) {
  var e = 0, m = 0, byState = {};
  c.counties.forEach(function (f) { var v = DATA[f]; if (!v) return; e += v[2]; m += v[3]; byState[v[1]] = 1; });
  var stE = 0; Object.keys(byState).forEach(function (s) { stE += TOT[s].e; });
  return { e: e, m: m, share: stE ? e / stE : 0 };
}
function statusPill(c) { return c.status === 'live' ? '<span class="pill live">Acknowledged · Benefits live</span>' : '<span class="pill onb">Acknowledged · Onboarding</span>'; }
function liveBenefits(c) { return c.status === 'live' ? C.BENEFITS.filter(function (b) { return !b.slot && b.live && benefitOn(c.id, b.id); }) : []; }

/* ---------------- per-viewer state (browser only) ---------------- */
var KEY = 'pc-proto-v1';
var S = { home: null, homeStatus: null, browse: null, browseSrc: null, loc: null, user: null, activated: [], ann: {}, toggles: {}, codes: {}, visited: false };
try { var raw = localStorage.getItem(KEY); if (raw) { var o = JSON.parse(raw); if (o && typeof o === 'object') Object.keys(S).forEach(function (k) { if (k in o) S[k] = o[k]; }); } } catch (e) { /* storage unavailable */ }
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignore */ } }
function benefitOn(cid, bid) { var t = S.toggles[cid]; return !(t && t[bid] === false); }
function codeFor(c) { return S.codes[c.id] || c.inviteCode; }

/* ---------------- geography ---------------- */
function miles(a, b) {
  var R = 3958.8, r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
  var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * R * Math.asin(Math.sqrt(h));
}
function nearestList(loc) { return C.CHAPTERS.map(function (c) { return { c: c, d: miles(loc, c) }; }).sort(function (a, b) { return a.d - b.d; }); }
function distTo(c) { return S.loc ? miles(S.loc, c) : null; }
function distLabel(c) { var d = distTo(c); return d == null ? '' : (d < 1 ? '<1 mi' : fmt(d) + ' mi'); }

var ZIP = null, CITY = null;
function zipIndex() {
  if (ZIP) return true;
  if (!window.ZIPDATA) return false;
  ZIP = {}; CITY = {};
  var cities = window.ZIPDATA.cities;
  window.ZIPDATA.rows.split(';').forEach(function (r) {
    var p = r.split(','); var lat = +p[1], lng = +p[2], ci = +p[3];
    ZIP[p[0]] = [lat, lng, ci];
    var k = cities[ci], cc = CITY[k] || (CITY[k] = [0, 0, 0]); cc[0] += lat; cc[1] += lng; cc[2]++;
  });
  return true;
}

var proj = hasMap ? d3.geoAlbersUsa().scale(1300).translate([487.5, 305]) : null;
var COUNTIES = [], STATE_MESH = null, BOUNDS = {}, BYSTATE = {}, GEOMS = {}, path = null;
if (hasMap) {
  path = d3.geoPath();
  COUNTIES = topojson.feature(M.topo, M.topo.objects.counties).features;
  STATE_MESH = topojson.mesh(M.topo, M.topo.objects.states, function (a, b) { return a !== b; });
  COUNTIES.forEach(function (f) { BOUNDS[f.id] = path.bounds(f); var s = F2S[f.id.slice(0, 2)]; if (s) (BYSTATE[s] = BYSTATE[s] || []).push(f); });
  M.topo.objects.counties.geometries.forEach(function (g) { GEOMS[g.id] = g; });
}
function countyAt(lat, lng) {
  if (!hasMap) return null;
  var p = proj([lng, lat]); if (!p) return null;
  for (var i = 0; i < COUNTIES.length; i++) {
    var f = COUNTIES[i], b = BOUNDS[f.id];
    if (p[0] < b[0][0] || p[0] > b[1][0] || p[1] < b[0][1] || p[1] > b[1][1]) continue;
    var polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates, inside = false;
    polys.forEach(function (poly) { var n = 0; poly.forEach(function (ring) { if (d3.polygonContains(ring, p)) n++; }); if (n % 2 === 1) inside = true; });
    if (inside) return f.id;
  }
  return null;
}
function stateOfLoc(loc) { var f = countyAt(loc.lat, loc.lng); return f ? F2S[f.slice(0, 2)] : (loc.st || null); }

/* ---------------- chapter resolution ---------------- */
/* Priority: verified membership (home) → saved choice (browse) → browser location → IP suggestion → search. */
function current() { var id = S.browse || S.home; return id ? CH[id] : null; }
function setLoc(loc, src) { S.loc = { lat: loc.lat, lng: loc.lng, label: loc.label, src: src }; save(); }
function suggestFromLoc(src) {
  var n = nearestList(S.loc)[0];
  if (n && n.d <= C.nearRadiusMiles) { if (!S.browse || S.browseSrc === 'ip' || src !== 'ip') { S.browse = n.c.id; S.browseSrc = src; } }
  else if (!S.browse || S.browseSrc === 'ip') { S.browse = null; S.browseSrc = 'none'; }
  save(); chrome();
  return n;
}
function setBrowse(id, src) { S.browse = id; S.browseSrc = src || 'choice'; save(); chrome(); }

function chrome() {
  var c = current(), lbl = $('#chipLbl'), val = $('#chipVal');
  if (c) {
    var isHome = S.home === c.id;
    lbl.textContent = isHome ? (S.homeStatus === 'verified' ? 'My chapter (verified):' : 'My chapter (pending):') : (S.browseSrc === 'ip' ? 'Suggested chapter:' : 'Browsing chapter:');
    val.textContent = c.name.replace('Sample Chapter — ', '') + ' · ' + c.city + ', ' + c.st;
  } else if (S.browseSrc === 'none' && S.loc) { lbl.textContent = 'Near ' + (S.loc.label || 'you') + ':'; val.textContent = 'No chapter yet'; }
  else { lbl.textContent = 'Your chapter:'; val.textContent = 'Choose a chapter'; }
  $('#utilAcct').textContent = S.user ? 'My dashboard' : 'Sign in';
  $('#utilAcct').setAttribute('href', S.user ? '#/member' : '#/activate');
  var cta = $('#navCta'); cta.textContent = S.user ? 'My dashboard' : 'Activate membership'; cta.setAttribute('href', S.user ? '#/member' : '#/activate');
}

/* ---------------- search ---------------- */
function suggestions(q) {
  var out = [], n = norm(q); if (!n) return out;
  if (/^\d{5}$/.test(n)) {
    if (zipIndex() && ZIP[n]) { var z = ZIP[n]; out.push({ k: 'ZIP', t: n + ' · ' + window.ZIPDATA.cities[z[2]], go: { type: 'loc', lat: z[0], lng: z[1], label: window.ZIPDATA.cities[z[2]] } }); }
    else out.push({ k: 'ZIP', t: n, s: window.ZIPDATA ? 'ZIP not found' : 'Loading ZIP data…', go: null });
    return out;
  }
  C.CHAPTERS.forEach(function (c) { if (norm(c.name + ' ' + c.city + ' ' + STN[c.st] + ' ' + c.st).indexOf(n) > -1) out.push({ k: 'Chapter', t: c.name, s: c.city + ', ' + c.st, go: { type: 'chapter', id: c.id } }); });
  Object.keys(STN).forEach(function (s) { if (norm(STN[s]).indexOf(n) === 0 || n === s.toLowerCase()) out.push({ k: 'State', t: STN[s], s: C.CHAPTERS.filter(function (c) { return c.st === s; }).length + ' chapter(s)', go: { type: 'state', st: s } }); });
  var cn = 0; Object.keys(DATA).some(function (f) { var v = DATA[f]; if (norm(v[0]).indexOf(n.replace(/ county$/, '')) === 0) { out.push({ k: 'County', t: v[0] + ' County, ' + v[1], s: fmt(v[2]) + ' businesses', go: { type: 'county', fips: f } }); cn++; } return cn >= 4; });
  if (zipIndex() && n.length >= 3) { var k = 0; Object.keys(CITY).some(function (name) { if (norm(name).indexOf(n) === 0) { var cc = CITY[name]; out.push({ k: 'City', t: name, go: { type: 'loc', lat: cc[0] / cc[2], lng: cc[1] / cc[2], label: name } }); k++; } return k >= 4; }); }
  return out.slice(0, 9);
}
function attachSearch(input, box, onPick) {
  var items = [], act = -1;
  function draw() {
    items = suggestions(input.value); act = -1;
    if (!input.value.trim()) { box.hidden = true; return; }
    if (!items.length) { box.innerHTML = '<button type="button" disabled><span class="t">No match. Try a ZIP code, city, county, or chamber name.</span></button>'; box.hidden = false; return; }
    box.innerHTML = items.map(function (it, i) { return '<button type="button" data-i="' + i + '"' + (it.go ? '' : ' disabled') + '><span class="k">' + esc(it.k) + '</span><span class="t">' + esc(it.t) + '</span>' + (it.s ? '<span class="s">' + esc(it.s) + '</span>' : '') + '</button>'; }).join('');
    box.hidden = false;
  }
  function pick(i) { var it = items[i]; if (!it || !it.go) return; box.hidden = true; input.value = it.t; onPick(it.go); }
  input.addEventListener('input', draw);
  input.addEventListener('focus', function () { if (input.value.trim()) draw(); });
  input.addEventListener('keydown', function (e) {
    var bs = $$('button[data-i]', box);
    if (e.key === 'ArrowDown' && bs.length) { e.preventDefault(); act = Math.min(bs.length - 1, act + 1); bs.forEach(function (b, i) { b.classList.toggle('act', i === act); }); }
    else if (e.key === 'ArrowUp' && bs.length) { e.preventDefault(); act = Math.max(0, act - 1); bs.forEach(function (b, i) { b.classList.toggle('act', i === act); }); }
    else if (e.key === 'Enter') { e.preventDefault(); if (!items.length) draw(); pick(act > -1 ? act : 0); }
    else if (e.key === 'Escape') { box.hidden = true; }
  });
  box.addEventListener('mousedown', function (e) { var b = e.target.closest('button[data-i]'); if (b) { e.preventDefault(); pick(+b.dataset.i); } });
  document.addEventListener('click', function (e) { if (!box.contains(e.target) && e.target !== input) box.hidden = true; });
}
function searchBox(id, placeholder) {
  return '<div class="search-box">' + ICON.search + '<input class="input" id="' + id + '" type="search" autocomplete="off" placeholder="' + esc(placeholder) + '" aria-label="' + esc(placeholder) + '"><div class="suggest" id="' + id + 'Box" hidden></div></div>';
}

/* ---------------- geolocation ---------------- */
function useMyLocation(done) {
  if (!navigator.geolocation) { toast('Location is not available in this browser. Search by ZIP instead.'); return; }
  toast('Asking your browser for your location…');
  navigator.geolocation.getCurrentPosition(function (p) {
    setLoc({ lat: p.coords.latitude, lng: p.coords.longitude, label: 'your location' }, 'geo');
    var n = suggestFromLoc('geo');
    toast(n && n.d <= C.nearRadiusMiles ? 'Nearest chapter: ' + n.c.name.replace('Sample Chapter — ', '') + ' (' + fmt(n.d) + ' mi)' : 'No chapter within ' + C.nearRadiusMiles + ' miles yet.');
    if (done) done();
  }, function () { toast('Location was not shared. Search by ZIP, city, or chamber instead.'); }, { timeout: 10000, maximumAge: 600000 });
}

/* ---------------- drawer (Walmart-style chapter picker) ---------------- */
function openDrawer() {
  var d = $('#drawer'), c = current();
  var list = S.loc ? nearestList(S.loc) : C.CHAPTERS.map(function (x) { return { c: x, d: null }; });
  d.innerHTML =
    '<div class="drawer-head"><h3 id="drawerTitle">Choose your chapter</h3><button class="x" id="drawerX" type="button" aria-label="Close">' + ICON.x + '</button></div>' +
    '<div class="drawer-body">' +
      (S.home ? '<div class="cur"><span class="lbl">Membership chapter</span><b>' + esc(CH[S.home].name) + '</b><span class="status-line">' + (S.homeStatus === 'verified' ? '<span class="pill ver">Verified by chamber</span>' : '<span class="pill pend">Awaiting chamber verification</span>') + '</span><span class="hint">Benefits follow your membership chapter. Browsing another chapter changes local news and events only.</span></div>' : '') +
      '<div style="display:flex;gap:8px;flex-direction:column">' + searchBox('drawerQ', 'ZIP, city, county, or chamber') +
      '<button class="btn btn-ghost btn-sm" id="drawerGeo" type="button" style="align-self:flex-start">' + ICON.target + 'Use my current location</button></div>' +
      (S.loc ? '<p class="small muted">Sorted by distance from ' + esc(S.loc.label || 'you') + (S.loc.src === 'ip' ? ' (approximate, from your connection)' : '') + '.</p>' : '<p class="small muted">Share your location or search to sort by distance.</p>') +
      list.map(function (it) {
        var x = it.c, sel = c && c.id === x.id;
        return '<div class="opt' + (sel ? ' sel' : '') + '"><div class="nm"><b>' + esc(x.name) + '</b><span>' + esc(x.city) + ', ' + x.st + '</span><div style="margin-top:6px">' + statusPill(x) + '</div></div>' +
          '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px">' + (it.d != null ? '<span class="dist">' + fmt(it.d) + ' mi</span>' : '') +
          (sel ? '<span class="pill plain ver">Selected</span>' : '<button class="btn btn-primary btn-sm" type="button" data-set="' + x.id + '">' + (S.home ? 'Browse this chapter' : 'Set as my chapter') + '</button>') + '</div></div>';
      }).join('') +
      '<a class="btn btn-ghost" href="#/chapters" id="drawerFull">Open the full chapter finder</a>' +
    '</div>';
  d.classList.add('open'); d.setAttribute('aria-hidden', 'false'); $('#scrim').classList.add('open');
  $('#drawerX').focus();
  attachSearch($('#drawerQ'), $('#drawerQBox'), function (go) { applyTarget(go, true); openDrawer(); });
  $('#drawerGeo').addEventListener('click', function () { useMyLocation(openDrawer); });
  $$('[data-set]', d).forEach(function (b) { b.addEventListener('click', function () { setBrowse(b.dataset.set, 'choice'); toast('Chapter set: ' + CH[b.dataset.set].name.replace('Sample Chapter — ', '')); closeDrawer(); render(); }); });
  $('#drawerFull').addEventListener('click', closeDrawer);
}
function closeDrawer() { var d = $('#drawer'); d.classList.remove('open'); d.setAttribute('aria-hidden', 'true'); $('#scrim').classList.remove('open'); }

/* Apply a search result. Returns the finder focus it implies. */
function applyTarget(go, quiet) {
  if (!go) return {};
  if (go.type === 'chapter') { return { sel: go.id, focus: CH[go.id].st }; }
  if (go.type === 'state') { return { focus: go.st, sel: '' }; }
  if (go.type === 'county') {
    var v = DATA[go.fips], sid = SERVED[go.fips];
    return { focus: v[1], sel: sid || '', county: go.fips };
  }
  if (go.type === 'loc') {
    setLoc(go, 'search');
    var n = suggestFromLoc('search'), st = stateOfLoc(S.loc);
    if (n && n.d <= C.nearRadiusMiles) { if (!quiet) toast('Nearest chapter: ' + n.c.name.replace('Sample Chapter — ', '') + ' (' + fmt(n.d) + ' mi)'); return { sel: n.c.id, focus: n.c.st }; }
    return { focus: st || '', sel: '' };
  }
  return {};
}

/* ---------------- router ---------------- */
var PENDING = null, FINDER = { focus: '', sel: '', metric: 'e', county: '' };
function route() {
  var h = location.hash.replace(/^#\/?/, ''), q = '';
  var qi = h.indexOf('?'); if (qi > -1) { q = h.slice(qi + 1); h = h.slice(0, qi); }
  var parts = h.split('/').filter(Boolean);
  return { name: parts[0] || 'home', arg: parts[1] || '', q: new URLSearchParams(q) };
}
var VIEWS = {};
function render() {
  var r = route(), v = VIEWS[r.name] || VIEWS.notfound;
  $$('#mainNav a[data-nav]').forEach(function (a) { if (a.dataset.nav === r.name || (r.name === 'chapter' && a.dataset.nav === 'chapters') || (r.name === 'benefit' && a.dataset.nav === 'book')) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  $('#mainNav').classList.remove('open'); $('#menuBtn').setAttribute('aria-expanded', 'false');
  var app = $('#app'); app.innerHTML = v.html(r); if (v.mount) v.mount(r);
  chrome();
}
function go(hash) { if (location.hash === hash) render(); else location.hash = hash; }
window.addEventListener('hashchange', function () { render(); window.scrollTo(0, 0); });

/* ---------------- HOME ---------------- */
VIEWS.home = {
  html: function () {
    var c = current(), liveCount = C.CHAPTERS.filter(function (x) { return x.status === 'live'; }).length;
    var states = {}; C.CHAPTERS.forEach(function (x) { states[x.st] = 1; });
    var biz = 0; C.CHAPTERS.forEach(function (x) { biz += chStats(x).e; });
    return '' +
    '<section class="hero"><div class="wrap hero-grid">' +
      '<div><span class="eyebrow">Chamber of Commerce member benefits</span>' +
      '<h1>The benefits your chamber vetted, organized around your chapter.</h1>' +
      '<p class="lede">PowerChapter connects members of acknowledged chambers to business-building services their chamber offers at no cost. Find your chapter, activate your membership, and everything here follows it.</p>' +
      '<div class="hero-search">' + searchBox('heroQ', 'ZIP, city, county, or chamber name') + '<button class="btn btn-primary" type="button" id="heroGo">Find</button></div>' +
      '<div class="hero-actions"><button class="btn-link" id="heroGeo" type="button">' + ICON.target + ' Use my current location</button></div></div>' +
      '<div class="mcard-stage"><div class="mcard" aria-label="Membership card preview">' +
        '<svg class="seal" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="46" fill="none" stroke="#E2B64B" stroke-width="2"/><circle cx="50" cy="50" r="38" fill="none" stroke="#E2B64B" stroke-width="1" stroke-dasharray="2 3"/><path d="M50 22l18 10v18c0 9-7.6 15.5-18 19-10.4-3.5-18-10-18-19V32l18-10Z" fill="none" stroke="#E2B64B" stroke-width="2"/></svg>' +
        '<div class="top"><span class="wm">Power<span>Chapter</span></span><span class="tier">' + (S.user && S.homeStatus === 'verified' ? 'Verified member' : 'Member') + '</span></div>' +
        '<div class="chap"><small>Chapter</small><b>' + esc(c ? c.name.replace('Sample Chapter — ', '') + ' · ' + c.city + ', ' + c.st : 'Your chamber goes here') + '</b></div>' +
        '<div class="meta"><div><small>Member</small><span>' + esc(S.user ? S.user.name : 'Your name') + '</span></div><div style="text-align:right"><small>Member ID</small><span>' + (S.user ? esc(S.user.id) : 'PC-•••• ••••') + '</span></div></div>' +
      '</div><div class="mcard-note">' + (c ? statusPill(c) : '<span class="pill plain pend">No chapter selected</span>') + '</div></div>' +
    '</div></section>' +

    '<section class="section-tight" style="padding-top:8px"><div class="wrap" id="nearestSlot">' + nearestStrip() + '</div></section>' +

    '<section class="section"><div class="wrap">' +
      '<div class="section-head"><div><span class="eyebrow">How membership works</span><h2 style="margin-top:8px">From chamber member to active benefits in four steps</h2></div></div>' +
      '<div class="steps">' +
        step('01', 'Find your chapter', 'We suggest the nearest acknowledged chamber from your approximate location. You can change it any time, the way you pick a store.') +
        step('02', 'Verify with your chamber', 'Use the invite code or link your chamber sends, or ask your chamber to confirm you. Location alone never decides eligibility.') +
        step('03', 'Use the benefits', 'Each benefit opens in the provider\'s own account. What you enter there stays with the provider — not with PowerChapter, not with chamber staff.') +
        step('04', 'Stay connected locally', 'Your dashboard carries your chapter\'s news, events, and any new benefits your chamber turns on.') +
      '</div></div></section>' +

    '<section class="section band"><div class="wrap">' +
      '<div class="section-head"><div><span class="eyebrow">From The Book</span><h2 style="margin-top:8px">Benefits that meet the Gold Standard</h2><p class="lede">Every listed benefit is vetted for longevity and reliability before it reaches a single member, and offered through your chamber at no cost.</p></div><a class="btn btn-ghost" href="#/book">Open The Book</a></div>' +
      '<div class="grid-3">' + C.BENEFITS.slice(0, 3).map(benefitCard).join('') + '</div>' +
    '</div></section>' +

    '<section class="section band-dark on-dark"><div class="wrap">' +
      '<div class="section-head"><div><span class="eyebrow">The network</span><h2 style="margin-top:8px">Chapters are local. The standard is national.</h2><p class="lede">Each chapter serves the counties around it. The business figures below are real county counts for the areas our sample chapters serve.</p></div><a class="btn btn-gold" href="#/chapters">Explore the chapter map</a></div>' +
      '<div class="stats">' +
        '<div class="stat"><div class="v">' + liveCount + '</div><div class="k">Chapters with benefits live <span class="sample">sample</span></div></div>' +
        '<div class="stat"><div class="v">' + (C.CHAPTERS.length - liveCount) + '</div><div class="k">Chapters onboarding <span class="sample">sample</span></div></div>' +
        '<div class="stat"><div class="v">' + Object.keys(states).length + '</div><div class="k">States represented</div></div>' +
        '<div class="stat"><div class="v">' + fmt(biz) + '</div><div class="k">Businesses in chapter service areas (QCEW 2024)</div></div>' +
      '</div></div></section>' +

    '<section class="section"><div class="wrap two-col">' +
      '<div><span class="eyebrow">For chambers</span><h2 style="margin-top:8px">Reputation is the gate, not size or revenue</h2><p class="lede" style="margin-top:12px">Chambers earn acknowledgement on length of operation, member retention, community visibility, peer recognition, and leadership stability. Acknowledged chambers offer every benefit under their own name, at no cost and with no added administration.</p>' +
      '<div class="hero-actions" style="margin-top:20px"><a class="btn btn-primary" href="#/for-chambers">Apply for acknowledgement</a><a class="btn btn-ghost" href="#/admin">See the chamber admin view</a></div></div>' +
      '<div class="card"><h3>What a chamber controls</h3><ul class="checklist"><li>Who is verified as a member, by invite code or roster</li><li>Which benefits are turned on for its members</li><li>Chapter news, events, and announcements</li><li>Totals-only reporting. Chamber staff never receive members\' financial information</li></ul></div>' +
    '</div></section>';
  },
  mount: function () {
    attachSearch($('#heroQ'), $('#heroQBox'), function (g) { PENDING = g; go('#/chapters'); });
    $('#heroGo').addEventListener('click', function () { var s = suggestions($('#heroQ').value); if (s[0] && s[0].go) { PENDING = s[0].go; go('#/chapters'); } else go('#/chapters'); });
    $('#heroGeo').addEventListener('click', function () { useMyLocation(render); });
    bindNearest();
  }
};
function step(n, t, p) { return '<div class="step"><span class="n">STEP ' + n + '</span><h3>' + t + '</h3><p>' + p + '</p></div>'; }
function nearestStrip() {
  var c = current();
  if (!S.loc && !c) return '<div class="nearest"><div class="ico">' + ICON.pin + '</div><div class="txt"><b>No chapter selected yet.</b><div class="small muted">Share your location or search above and we will suggest the nearest acknowledged chamber.</div></div><div class="acts"><button class="btn btn-ghost btn-sm" data-act="drawer" type="button">Choose a chapter</button></div></div>';
  if (!c && S.loc) {
    var n = nearestList(S.loc)[0];
    return '<div class="nearest"><div class="ico">' + ICON.pin + '</div><div class="txt"><b>No acknowledged chapter within ' + C.nearRadiusMiles + ' miles of ' + esc(S.loc.label) + '.</b><div class="small muted">The closest is ' + esc(n.c.name) + ', ' + fmt(n.d) + ' miles away. If your chamber is not listed yet, ask it to apply.</div></div><div class="acts"><a class="btn btn-primary btn-sm" href="#/for-chambers">Ask your chamber to join</a><button class="btn btn-ghost btn-sm" data-act="drawer" type="button">Choose anyway</button></div></div>';
  }
  var why = S.home === c.id ? 'Your membership chapter' : (S.browseSrc === 'ip' ? 'Suggested from your approximate location' + (S.loc ? ' (' + esc(S.loc.label) + ')' : '') : S.browseSrc === 'geo' ? 'Nearest to your current location' : S.browseSrc === 'search' ? 'Nearest to your search' : 'Your chosen chapter');
  return '<div class="nearest"><div class="ico">' + ICON.pin + '</div><div class="txt"><span class="small muted">' + why + '</span><div><b>' + esc(c.name) + '</b> · ' + esc(c.city) + ', ' + c.st + (distLabel(c) ? ' · <span class="num">' + distLabel(c) + '</span>' : '') + '</div></div>' +
    '<div class="acts">' + (S.browseSrc === 'ip' && S.home !== c.id ? '<button class="btn btn-gold btn-sm" type="button" data-act="confirm">Yes, this is my chapter</button>' : '') + '<a class="btn btn-ghost btn-sm" href="#/chapter/' + c.id + '">Chapter page</a><button class="btn btn-ghost btn-sm" type="button" data-act="drawer">Change</button></div></div>';
}
function bindNearest() {
  $$('[data-act="drawer"]').forEach(function (b) { b.addEventListener('click', openDrawer); });
  $$('[data-act="confirm"]').forEach(function (b) { b.addEventListener('click', function () { setBrowse(current().id, 'choice'); toast('Saved as your chapter. Activate your membership to verify it.'); render(); }); });
}
function benefitCard(b) {
  if (b.slot) return '<div class="bcard slot"><div class="body"><span class="prov">' + esc(b.cat) + '</span><h3>' + esc(b.title) + '</h3><p class="muted small">' + esc(b.blurb) + '</p></div></div>';
  var inner = (b.logo ? '<div class="logo-plate"><img src="' + esc(b.logo) + '" alt="' + esc(b.provider) + '"></div>'
    : '<div class="logo-plate pending"><span>' + esc(b.provider) + '</span><small>Logo pending</small></div>') +
    '<div class="body"><span class="prov">' + esc(b.provider) + ' · ' + esc(b.cat) + '</span><h3>' + esc(b.short) + '</h3><p class="muted small">' + esc(b.blurb) + '</p>' +
    '<div class="val"><span class="muted">Listed value</span><b>' + esc(b.listedValue) + '</b></div></div>';
  return '<article class="bcard">' + (b.detail ? '<a class="cover" href="#/benefit/' + b.id + '">' + inner + '</a>' : inner) + '</article>';
}

/* ---------------- FINDER ---------------- */
var STEPS = ['#1c3556', '#24487a', '#2f5f9f', '#3f78bf', '#5f95d4', '#8db6e6', '#c3dbf5'], EMPTY = '#14263f';
VIEWS.chapters = {
  html: function () {
    return '<section class="page-head"><div class="wrap"><span class="eyebrow">Find a chapter</span><h1 style="margin-top:8px">Find your chamber and see the market it serves</h1>' +
      '<p class="lede">Search by ZIP, city, county, or chamber name, or pick a state. Select a chapter to see its profile, the counties it serves, and how many businesses operate there.</p></div></section>' +
      '<section class="section-tight"><div class="wrap">' +
      '<div class="finder-controls">' + searchBox('finderQ', 'ZIP, city, county, or chamber name') +
        '<select class="input" id="finderState" aria-label="State"><option value="">All states</option>' + Object.keys(STN).sort(function (a, b) { return STN[a].localeCompare(STN[b]); }).map(function (s) { return '<option value="' + s + '">' + STN[s] + '</option>'; }).join('') + '</select>' +
        '<div class="seg" role="group" aria-label="Map metric"><button type="button" data-m="e" aria-pressed="true">Businesses</button><button type="button" data-m="m" aria-pressed="false">Employees</button></div>' +
        '<button class="btn btn-ghost" id="finderGeo" type="button">' + ICON.target + 'Near me</button>' +
      '</div>' +
      '<div class="finder">' +
        '<div class="panel map-panel">' + (hasMap ? '<div class="map-tools"><button type="button" id="mapReset">United States</button></div><svg id="finderMap" viewBox="0 0 975 610" role="img" aria-label="Map of U.S. counties shaded by number of businesses, with chapter locations"></svg>' +
        '<div class="legend"><span id="lgLo" class="num"></span><span class="ramp" id="lgRamp"></span><span id="lgHi" class="num"></span><span class="sw"><span class="o"></span>Chapter service area</span><span class="sw"><span class="dot"></span>Benefits live</span><span class="sw"><span class="dot h"></span>Onboarding</span>' + (S.loc ? '<span class="sw"><span class="you"></span>You</span>' : '') + '</div>' : '<p style="padding:20px">The map library did not load. The chapter list still works.</p>') + '</div>' +
        '<div class="panel side" id="finderSide" aria-live="polite"></div>' +
      '</div>' +
      '<p class="source-note">Business counts are annual-average employer establishments from the U.S. Bureau of Labor Statistics (QCEW, 2024). Chapter names and chamber profiles are samples for this prototype.</p>' +
      '</div></section>';
  },
  mount: function (r) {
    var F = FINDER;
    if (PENDING) { var t = applyTarget(PENDING); PENDING = null; F.focus = t.focus || ''; F.sel = t.sel || ''; F.county = t.county || ''; }
    else if (r.q.get('chapter') && CH[r.q.get('chapter')]) { F.sel = r.q.get('chapter'); F.focus = CH[F.sel].st; }
    else if (!F.focus && !F.sel && current()) { F.sel = current().id; F.focus = current().st; }
    var map = hasMap ? finderMap($('#finderMap')) : null;
    function update(zoom) {
      $('#finderState').value = F.focus;
      $$('.seg button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.m === F.metric)); });
      if (map) { map.paint(); if (zoom) map.zoomTo(F.focus); }
      renderSide();
    }
    function renderSide() {
      var el = $('#finderSide');
      el.innerHTML = F.sel ? chapterPanel(CH[F.sel]) : F.focus ? statePanel(F.focus) : networkPanel();
      $$('[data-ch]', el).forEach(function (b) { b.addEventListener('click', function () { F.sel = b.dataset.ch; F.focus = CH[F.sel].st; update(true); }); });
      $$('[data-st]', el).forEach(function (b) { b.addEventListener('click', function () { F.sel = ''; F.focus = b.dataset.st; update(true); }); });
      $$('[data-mine]', el).forEach(function (b) { b.addEventListener('click', function () { setBrowse(b.dataset.mine, 'choice'); toast('Chapter set: ' + CH[b.dataset.mine].name.replace('Sample Chapter — ', '')); renderSide(); }); });
      $$('[data-back]', el).forEach(function (b) { b.addEventListener('click', function () { F.sel = ''; update(false); }); });
      $$('[data-hover]', el).forEach(function (b) { b.addEventListener('mouseenter', function () { if (map) map.highlight(b.dataset.hover); }); b.addEventListener('mouseleave', function () { if (map) map.highlight(null); }); });
    }
    F.onSelect = function (id) { F.sel = id; F.focus = CH[id].st; update(true); };
    F.onState = function (st, fips) { var sid = fips && SERVED[fips]; if (st !== F.focus || sid) { F.focus = st; F.sel = sid || ''; update(true); } };
    attachSearch($('#finderQ'), $('#finderQBox'), function (g) { var t = applyTarget(g); F.focus = t.focus || ''; F.sel = t.sel || ''; F.county = t.county || ''; render(); });
    $('#finderState').addEventListener('change', function (e) { F.focus = e.target.value; F.sel = ''; update(true); });
    $$('.seg button').forEach(function (b) { b.addEventListener('click', function () { F.metric = b.dataset.m; update(false); }); });
    $('#finderGeo').addEventListener('click', function () { useMyLocation(function () { var n = nearestList(S.loc)[0]; if (n.d <= C.nearRadiusMiles) { F.sel = n.c.id; F.focus = n.c.st; } else { F.sel = ''; F.focus = stateOfLoc(S.loc) || ''; } render(); }); });
    if ($('#mapReset')) $('#mapReset').addEventListener('click', function () { F.focus = ''; F.sel = ''; update(true); });
    update(true);
  }
};

function finderMap(svgEl) {
  var F = FINDER, svg = d3.select(svgEl), g = svg.append('g'), k = 1, th = [];
  var cg = g.append('g').selectAll('path').data(COUNTIES).join('path').attr('class', 'c-county').attr('d', path);
  g.append('path').datum(STATE_MESH).attr('class', 'c-state').attr('d', path).attr('vector-effect', 'non-scaling-stroke');
  var serveG = g.append('g'), youG = g.append('g'), pinG = g.append('g');
  var outlines = C.CHAPTERS.map(function (c) { return { id: c.id, geo: topojson.merge(M.topo, c.counties.map(function (f) { return GEOMS[f]; }).filter(Boolean)) }; });
  var so = serveG.selectAll('path').data(outlines).join('path').attr('class', 'c-serve').attr('d', function (d) { return path(d.geo); }).attr('vector-effect', 'non-scaling-stroke');
  var pins = pinG.selectAll('g').data(C.CHAPTERS.filter(function (c) { return proj([c.lng, c.lat]); })).join('g')
    .attr('class', function (c) { return 'c-pin' + (c.status === 'live' ? '' : ' onb'); })
    .attr('tabindex', 0).attr('role', 'button').attr('aria-label', function (c) { return c.name + ', ' + c.city + ', ' + c.st; });
  pins.append('circle').attr('class', 'halo');
  pins.append('circle').attr('class', 'dot');
  pins.on('click', function (ev, c) { ev.stopPropagation(); F.onSelect(c.id); })
    .on('keydown', function (ev, c) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); F.onSelect(c.id); } })
    .on('mousemove', function (ev, c) { var s = chStats(c); showTip(ev, '<b>' + esc(c.name) + '</b><div><span>City</span><span>' + esc(c.city) + ', ' + c.st + '</span></div><div><span>Service-area businesses</span><span>' + fmt(s.e) + '</span></div><span class="srv">' + (c.status === 'live' ? 'Benefits live' : 'Onboarding') + '</span>'); })
    .on('mouseleave', hideTip);
  var tip = $('#tip');
  function showTip(ev, html) { tip.innerHTML = html; tip.style.opacity = 1; tip.style.left = Math.min(ev.clientX + 14, window.innerWidth - 250) + 'px'; tip.style.top = Math.min(ev.clientY + 14, window.innerHeight - 130) + 'px'; }
  function hideTip() { tip.style.opacity = 0; }
  cg.on('mousemove', function (ev, f) {
    var v = DATA[f.id]; if (!v) { hideTip(); return; }
    var sid = SERVED[f.id], r = TOP[v[1]] ? TOP[v[1]].indexOf(f.id) : -1;
    showTip(ev, '<b>' + esc(v[0]) + ', ' + v[1] + (r > -1 ? ' · #' + (r + 1) + ' in ' + v[1] : '') + '</b><div><span>Businesses</span><span>' + fmt(v[2]) + '</span></div><div><span>Employees</span><span>' + fmt(v[3]) + '</span></div><div><span>Share of state</span><span>' + pct(v[2], TOT[v[1]].e) + '</span></div><span class="srv">' + (sid ? 'Served by ' + esc(CH[sid].name) : 'No chapter serves this county yet') + '</span>');
  }).on('mouseleave', hideTip)
    .on('click', function (ev, f) { var s = F2S[f.id.slice(0, 2)]; if (s) F.onState(s, f.id); });
  svg.on('click', function (ev) { if (ev.target === svgEl) { F.focus = ''; F.sel = ''; } });
  function thresholds() {
    var key = F.metric === 'e' ? 2 : 3;
    var vals = Object.keys(DATA).map(function (f) { return DATA[f][key]; }).filter(function (x) { return x > 0; }).sort(d3.ascending);
    th = [0.35, 0.6, 0.8, 0.9, 0.96, 0.99].map(function (q) { return d3.quantile(vals, q); });
  }
  function color(v) { if (!v) return EMPTY; var i = 0; while (i < th.length && v >= th[i]) i++; return STEPS[i]; }
  function sizePins() {
    pins.attr('transform', function (c) { var p = proj([c.lng, c.lat]); return 'translate(' + p[0] + ',' + p[1] + ')'; });
    pins.select('.dot').attr('r', 5.5 / k).attr('stroke-width', 1.6 / k);
    pins.select('.halo').attr('r', function (c) { return c.id === F.sel ? 14 / k : 0; });
    youG.selectAll('*').remove();
    if (S.loc) { var p = proj([S.loc.lng, S.loc.lat]); if (p) { var yg = youG.append('g').attr('class', 'c-you').attr('transform', 'translate(' + p[0] + ',' + p[1] + ') scale(' + (1 / k) + ')'); yg.append('circle').attr('class', 'pulse').attr('r', 5); yg.append('circle').attr('r', 5); } }
  }
  function paint() {
    thresholds(); var key = F.metric === 'e' ? 2 : 3;
    cg.attr('fill', function (f) { var v = DATA[f.id]; return v ? color(v[key]) : EMPTY; })
      .classed('dim', function (f) { return F.focus && F2S[f.id.slice(0, 2)] !== F.focus; });
    so.classed('sel', function (d) { return d.id === F.sel; });
    pins.classed('sel', function (c) { return c.id === F.sel; }).style('opacity', function (c) { return F.focus && c.st !== F.focus ? 0.35 : 1; });
    sizePins();
    $('#lgRamp').innerHTML = STEPS.map(function (c) { return '<i style="background:' + c + '"></i>'; }).join('');
    $('#lgLo').textContent = '<' + fmt(th[0]); $('#lgHi').textContent = fmt(th[th.length - 1]) + '+';
  }
  function zoomTo(s) {
    var b;
    if (F.sel) { b = [[Infinity, Infinity], [-Infinity, -Infinity]]; var ext = BYSTATE[CH[F.sel].st] || []; ext.forEach(function (f) { var bb = BOUNDS[f.id]; b[0][0] = Math.min(b[0][0], bb[0][0]); b[0][1] = Math.min(b[0][1], bb[0][1]); b[1][0] = Math.max(b[1][0], bb[1][0]); b[1][1] = Math.max(b[1][1], bb[1][1]); }); }
    else if (s && BYSTATE[s]) { b = [[Infinity, Infinity], [-Infinity, -Infinity]]; BYSTATE[s].forEach(function (f) { var bb = BOUNDS[f.id]; b[0][0] = Math.min(b[0][0], bb[0][0]); b[0][1] = Math.min(b[0][1], bb[0][1]); b[1][0] = Math.max(b[1][0], bb[1][0]); b[1][1] = Math.max(b[1][1], bb[1][1]); }); }
    if (!b) { k = 1; g.transition().duration(500).attr('transform', 'translate(0,0) scale(1)'); sizePins(); return; }
    var dx = b[1][0] - b[0][0], dy = b[1][1] - b[0][1], cx = (b[0][0] + b[1][0]) / 2, cy = (b[0][1] + b[1][1]) / 2;
    k = Math.min(9, 0.86 / Math.max(dx / 975, dy / 610));
    g.transition().duration(500).attr('transform', 'translate(' + (975 / 2 - k * cx) + ',' + (610 / 2 - k * cy) + ') scale(' + k + ')');
    sizePins();
  }
  function highlight(fips) { cg.classed('dim', function (f) { return fips ? f.id !== fips : (F.focus && F2S[f.id.slice(0, 2)] !== F.focus); }); }
  return { paint: paint, zoomTo: zoomTo, highlight: highlight };
}

function chapterPanel(c) {
  var s = chStats(c), bs = liveBenefits(c), isMine = current() && current().id === c.id;
  var rows = c.counties.filter(function (f) { return DATA[f]; }).sort(function (a, b) { return DATA[b][2] - DATA[a][2]; });
  return '<div class="lbl"><span>Chapter</span><span class="sample">Sample profile</span></div>' +
    '<div><h3>' + esc(c.name) + '</h3><div class="sub" style="margin-top:4px">' + esc(c.city) + ', ' + esc(STN[c.st]) + (distLabel(c) ? ' · <span class="num">' + distLabel(c) + '</span> from ' + esc(S.loc.label || 'you') : '') + '</div><div style="margin-top:10px">' + statusPill(c) + '</div></div>' +
    '<div class="kv"><div><small>Founded</small><b>' + c.profile.founded + '</b></div><div><small>Members</small><b>' + fmt(c.profile.members) + '</b></div><div><small>Acknowledged</small><b>' + c.profile.acknowledgedYear + '</b></div><div><small>Benefits live</small><b>' + bs.length + '</b></div></div>' +
    '<div class="lbl"><span>Service-area market</span><span>BLS QCEW 2024</span></div>' +
    '<div class="kv"><div><small>Businesses</small><b>' + fmt(s.e) + '</b></div><div><small>Employees</small><b>' + fmt(s.m) + '</b></div><div><small>Share of state businesses</small><b>' + (s.share * 100).toFixed(1) + '%</b></div><div><small>Counties served</small><b>' + rows.length + '</b></div></div>' +
    '<div>' + rows.map(function (f, i) { var v = DATA[f]; return '<div class="row" data-hover="' + f + '"><span class="rank">' + (i + 1) + '</span><span class="nm"><b>' + esc(v[0]) + ' County</b><span>' + fmt(v[2]) + ' businesses · ' + pct(v[2], TOT[v[1]].e) + ' of state</span></span><span class="rt">' + fmt(v[3]) + '<br>employees</span></div>'; }).join('') + '</div>' +
    '<div class="acts">' + (isMine ? '<span class="pill plain ver">This is your chapter</span>' : '<button class="btn btn-gold" type="button" data-mine="' + c.id + '">Make this my chapter</button>') + '<a class="btn btn-ghost" href="#/chapter/' + c.id + '">Chapter page</a><button class="btn-link" type="button" data-back style="color:var(--accent)">All of ' + esc(STN[c.st]) + '</button></div>' +
    '<p class="note">Choosing a chapter personalizes what you see. Benefits unlock after your chamber verifies your membership.</p>';
}
function statePanel(st) {
  var t = TOT[st] || { e: 0, m: 0 }, here = C.CHAPTERS.filter(function (c) { return c.st === st; });
  var top = (TOP[st] || []).slice().sort(function (a, b) { return DATA[b][2] - DATA[a][2]; });
  var out = '<div class="lbl"><span>State</span><span>BLS QCEW 2024</span></div><div><h3>' + esc(STN[st]) + '</h3><div class="sub" style="margin-top:4px">' + fmt(t.e) + ' businesses · ' + fmt(t.m) + ' employees statewide</div></div>';
  if (here.length) {
    out += '<div class="lbl"><span>Chapters in ' + esc(STN[st]) + '</span><span>' + here.length + '</span></div><div>' + here.map(function (c) { var s = chStats(c); return '<button class="row btnrow" type="button" data-ch="' + c.id + '"><span class="rank' + (c.status === 'live' ? '' : ' h') + '">' + ICON.pin.replace('width="20" height="20"', 'width="14" height="14"') + '</span><span class="nm"><b>' + esc(c.name) + '</b><span>' + esc(c.city) + ' · ' + fmt(s.e) + ' businesses served · ' + (c.status === 'live' ? 'benefits live' : 'onboarding') + '</span></span><span class="rt">' + (distLabel(c) || 'View') + '</span></button>'; }).join('') + '</div>';
  } else {
    var n = null;
    if (hasMap && BYSTATE[st]) { var b = [[Infinity, Infinity], [-Infinity, -Infinity]]; BYSTATE[st].forEach(function (f) { var bb = BOUNDS[f.id]; b[0][0] = Math.min(b[0][0], bb[0][0]); b[0][1] = Math.min(b[0][1], bb[0][1]); b[1][0] = Math.max(b[1][0], bb[1][0]); b[1][1] = Math.max(b[1][1], bb[1][1]); }); var ll = proj.invert([(b[0][0] + b[1][0]) / 2, (b[0][1] + b[1][1]) / 2]); if (ll) n = nearestList({ lat: ll[1], lng: ll[0] })[0]; }
    out += '<div class="empty"><b>No acknowledged chapter in ' + esc(STN[st]) + ' yet.</b><br>' + (n ? 'The closest is <button class="btn-link" type="button" data-ch="' + n.c.id + '" style="color:var(--accent)">' + esc(n.c.name) + '</button>, about ' + fmt(n.d) + ' miles from the center of the state. ' : '') + 'If your chamber operates here, it can apply for acknowledgement.<div class="acts" style="margin-top:12px"><a class="btn btn-gold btn-sm" href="#/for-chambers">Ask your chamber to apply</a></div></div>';
  }
  out += '<div class="lbl"><span>Largest business counties</span><span>Top 5</span></div><div>' + top.map(function (f, i) { var v = DATA[f], sid = SERVED[f]; return '<div class="row" data-hover="' + f + '"><span class="rank' + (sid ? '' : ' h') + '">' + (i + 1) + '</span><span class="nm"><b>' + esc(v[0]) + ' County</b><span>' + fmt(v[2]) + ' businesses · ' + pct(v[2], t.e) + ' of state</span></span><span class="rt">' + (sid ? '<button class="btn-link" type="button" data-ch="' + sid + '" style="color:var(--accent);font-size:.78rem">Served</button>' : 'No chapter') + '</span></div>'; }).join('') + '</div>';
  return out;
}
function networkPanel() {
  var list = S.loc ? nearestList(S.loc) : C.CHAPTERS.slice().sort(function (a, b) { return a.st.localeCompare(b.st); }).map(function (c) { return { c: c, d: null }; });
  return '<div class="lbl"><span>' + (S.loc ? 'Nearest to ' + esc(S.loc.label || 'you') : 'Chapters in the network') + '</span><span class="sample">Sample chapters</span></div>' +
    '<div><h3>' + (S.loc ? 'Chapters near you' : 'Every acknowledged chapter') + '</h3><div class="sub" style="margin-top:4px">Select a chapter, click a state on the map, or search above.</div></div>' +
    '<div>' + list.map(function (it) { var c = it.c; return '<button class="row btnrow" type="button" data-ch="' + c.id + '"><span class="rank' + (c.status === 'live' ? '' : ' h') + '">' + c.st + '</span><span class="nm"><b>' + esc(c.name.replace('Sample Chapter — ', '')) + '</b><span>' + esc(c.city) + ', ' + c.st + ' · ' + (c.status === 'live' ? 'benefits live' : 'onboarding') + '</span></span><span class="rt">' + (it.d != null ? fmt(it.d) + ' mi' : '') + '</span></button>'; }).join('') + '</div>';
}

/* ---------------- CHAPTER PAGE ---------------- */
VIEWS.chapter = {
  html: function (r) {
    var c = CH[r.arg]; if (!c) return VIEWS.notfound.html();
    var s = chStats(c), bs = liveBenefits(c), isMine = current() && current().id === c.id;
    var rows = c.counties.filter(function (f) { return DATA[f]; }).sort(function (a, b) { return DATA[b][2] - DATA[a][2]; });
    var maxE = rows.length ? DATA[rows[0]][2] : 1, ann = (S.ann[c.id] || []).concat(C.SAMPLE_ANNOUNCEMENTS);
    return '<div class="ch-hero">' + photo('assets/photos/' + c.id + '-hero.jpg', 'Chapter photo · 1600×500') + '</div>' +
      '<section class="ch-id"><div class="wrap"><div class="who"><div class="ch-logo">' + photo('assets/photos/' + c.id + '-logo.png', 'Logo') + '</div><div style="min-width:0"><div class="crumbs" style="margin:0 0 4px"><a href="#/chapters">Chapters</a> / ' + esc(STN[c.st]) + '</div><h1 style="font-size:clamp(1.5rem,3vw,2.2rem)">' + esc(c.name) + '</h1><div class="ch-meta">' + esc(c.city) + ', ' + esc(STN[c.st]) + ' ' + statusPill(c) + ' <span class="sample">Sample profile</span></div></div></div>' +
      '<div class="hero-actions" style="margin:0">' + (isMine ? '<span class="pill plain ver">Your chapter</span>' : '<button class="btn btn-gold" type="button" id="chMine">Make this my chapter</button>') + (S.user ? '' : '<a class="btn btn-primary" href="#/activate">Activate membership</a>') + '</div></div></section>' +
      '<section class="section-tight"><div class="wrap two-col">' +
        '<div style="display:flex;flex-direction:column;gap:20px">' +
          '<div class="card"><h3>About this chapter</h3><p class="muted">This space holds the chamber\'s own description: its history, the communities it serves, and how members get involved. Chambers edit it from the admin view.</p>' +
          '<div class="kv on-dark" style="margin-top:16px;--panel-2:var(--surface-2);--panel-line:var(--line);--panel-ink:var(--ink);--panel-mute:var(--ink-3)"><div><small>Founded</small><b>' + c.profile.founded + '</b></div><div><small>Members</small><b>' + fmt(c.profile.members) + '</b></div><div><small>Acknowledged</small><b>' + c.profile.acknowledgedYear + '</b></div><div><small>Benefits live</small><b>' + bs.length + '</b></div></div></div>' +
          '<div class="card"><div style="display:flex;justify-content:space-between;gap:10px;align-items:baseline;flex-wrap:wrap"><h3>Service area and local market</h3><span class="tiny muted">BLS QCEW, 2024 annual averages</span></div>' +
          '<div class="table-wrap"><table class="data"><thead><tr><th>County</th><th class="n">Businesses</th><th class="n">Employees</th><th class="n">Share of state</th><th style="width:22%"></th></tr></thead><tbody>' +
          rows.map(function (f) { var v = DATA[f]; return '<tr><td>' + esc(v[0]) + ' County, ' + v[1] + '</td><td class="n">' + fmt(v[2]) + '</td><td class="n">' + fmt(v[3]) + '</td><td class="n">' + pct(v[2], TOT[v[1]].e) + '</td><td><div class="bar"><i style="width:' + (v[2] / maxE * 100).toFixed(1) + '%"></i></div></td></tr>'; }).join('') +
          '</tbody><tfoot><tr><td>Service area</td><td class="n">' + fmt(s.e) + '</td><td class="n">' + fmt(s.m) + '</td><td class="n">' + (s.share * 100).toFixed(1) + '%</td><td></td></tr></tfoot></table></div>' +
          (hasMap ? '<div class="mini-map" style="margin-top:16px"><svg id="miniMap" viewBox="0 0 975 610" role="img" aria-label="Map of ' + esc(STN[c.st]) + ' highlighting the counties this chapter serves"></svg></div>' : '') + '</div>' +
          '<div class="card"><h3>Chapter leadership</h3><div class="people">' + C.SAMPLE_LEADERS.map(function (p, i) { return '<div class="person">' + photo('assets/photos/' + c.id + '-leader-' + (i + 1) + '.jpg', 'Headshot') + '<b>Name pending</b><span>' + esc(p.r) + '</span></div>'; }).join('') + '</div></div>' +
        '</div>' +
        '<div style="display:flex;flex-direction:column;gap:20px">' +
          '<div class="card"><h3>Benefits at this chapter</h3>' + (bs.length ? '<div class="list">' + bs.map(function (b) { return '<div class="it">' + (b.logo ? '<img class="row-logo" src="' + esc(b.logo) + '" alt="' + esc(b.provider) + '">' : '') + '<div class="nm"><b>' + esc(b.short) + '</b><span>' + esc(b.provider) + ' · ' + esc(b.cat) + '</span></div>' + (b.detail ? '<a class="btn btn-ghost btn-sm" href="#/benefit/' + b.id + '">Details</a>' : '') + '</div>'; }).join('') + '</div>' : '<p class="muted">Benefits go live when this chapter finishes onboarding.</p>') + '</div>' +
          '<div class="card"><h3>Upcoming events <span class="sample">sample</span></h3><div class="events">' + C.SAMPLE_EVENTS.map(function (e) { return '<div class="event"><div class="date"><small>' + e.m + '</small><b>' + e.d + '</b></div><div><b>' + esc(e.t) + '</b><div class="small muted">' + esc(e.w) + '</div></div></div>'; }).join('') + '</div></div>' +
          '<div class="card"><h3>Announcements</h3>' + ann.map(function (a) { return '<div class="ann"><b>' + esc(a.t) + '</b><span>' + esc(a.when) + '</span></div>'; }).join('') + '</div>' +
        '</div>' +
      '</div></section>';
  },
  mount: function (r) {
    var c = CH[r.arg]; if (!c) return;
    var b = $('#chMine'); if (b) b.addEventListener('click', function () { setBrowse(c.id, 'choice'); toast('Chapter set: ' + c.name.replace('Sample Chapter — ', '')); render(); });
    if (hasMap && $('#miniMap')) {
      var svg = d3.select('#miniMap'), feats = BYSTATE[c.st] || [], set = {}; c.counties.forEach(function (f) { set[f] = 1; });
      var bb = [[Infinity, Infinity], [-Infinity, -Infinity]]; feats.forEach(function (f) { var x = BOUNDS[f.id]; bb[0][0] = Math.min(bb[0][0], x[0][0]); bb[0][1] = Math.min(bb[0][1], x[0][1]); bb[1][0] = Math.max(bb[1][0], x[1][0]); bb[1][1] = Math.max(bb[1][1], x[1][1]); });
      var dx = bb[1][0] - bb[0][0], dy = bb[1][1] - bb[0][1], k = 0.92 / Math.max(dx / 975, dy / 610), cx = (bb[0][0] + bb[1][0]) / 2, cy = (bb[0][1] + bb[1][1]) / 2;
      var g = svg.append('g').attr('transform', 'translate(' + (975 / 2 - k * cx) + ',' + (610 / 2 - k * cy) + ') scale(' + k + ')');
      var vals = feats.map(function (f) { return DATA[f.id] ? DATA[f.id][2] : 0; }).sort(d3.ascending), th = [0.35, 0.6, 0.8, 0.9, 0.96, 0.99].map(function (q) { return d3.quantile(vals, q); });
      g.selectAll('path.c').data(feats).join('path').attr('d', path).attr('fill', function (f) { var v = DATA[f.id]; if (!v) return EMPTY; var i = 0; while (i < th.length && v[2] >= th[i]) i++; return STEPS[i]; }).attr('stroke', '#0E1D33').attr('stroke-width', 0.4).attr('vector-effect', 'non-scaling-stroke');
      g.append('path').datum(topojson.merge(M.topo, c.counties.map(function (f) { return GEOMS[f]; }).filter(Boolean))).attr('d', path).attr('fill', 'none').attr('stroke', '#FFD774').attr('stroke-width', 2.2).attr('vector-effect', 'non-scaling-stroke');
      var p = proj([c.lng, c.lat]); if (p) g.append('circle').attr('cx', p[0]).attr('cy', p[1]).attr('r', 6 / k).attr('fill', '#E2B64B').attr('stroke', '#0E1D33').attr('stroke-width', 1.5 / k);
    }
  }
};

/* ---------------- BOOK ---------------- */
var BOOKCAT = 'All';
VIEWS.book = {
  html: function () {
    var cats = ['All'].concat(C.BENEFITS.map(function (b) { return b.cat; }).filter(function (v, i, a) { return a.indexOf(v) === i; }));
    var list = C.BENEFITS.filter(function (b) { return BOOKCAT === 'All' || b.cat === BOOKCAT; });
    return '<section class="page-head"><div class="wrap"><span class="eyebrow">The Book of Business Building Benefits</span><h1 style="margin-top:8px">Every benefit is vetted before it is listed</h1><p class="lede">Each benefit meets a Gold Standard of longevity and reliability. Members of acknowledged chambers use them at no cost through their chamber, with no purchase required.</p></div></section>' +
      '<section class="section-tight"><div class="wrap"><div class="filters" role="group" aria-label="Filter by category">' + cats.map(function (c) { return '<button type="button" data-cat="' + esc(c) + '" aria-pressed="' + (c === BOOKCAT) + '">' + esc(c) + '</button>'; }).join('') + '</div>' +
      '<div class="grid-3">' + list.map(benefitCard).join('') + '</div>' +
      '<div class="callout" style="margin-top:24px"><b>Where your information goes.</b> PowerChapter holds your name, email, business name, chapter, and consent record — nothing else. Each provider runs its own account and holds what you enter there under its own terms. Your chamber keeps its membership records, as it always has. <a href="#/privacy">See the full boundary</a>.</div>' +
      '</div></section>' +
      '<section class="section band"><div class="wrap"><div class="section-head"><div><span class="eyebrow">Member questions</span><h2 style="margin-top:8px">What members ask before they sign up</h2></div></div>' +
      '<div class="grid-2">' + C.BENEFIT_FAQ.map(function (f) { return '<div class="qa"><h4>' + esc(f.q) + '</h4><p class="muted small">' + esc(f.a) + '</p></div>'; }).join('') + '</div></div></section>';
  },
  mount: function () { $$('[data-cat]').forEach(function (b) { b.addEventListener('click', function () { BOOKCAT = b.dataset.cat; render(); }); }); }
};

/* ---------------- BENEFIT DETAIL ---------------- */
VIEWS.benefit = {
  html: function (r) {
    var b = C.BENEFITS.filter(function (x) { return x.id === r.arg; })[0]; if (!b || !b.detail) return VIEWS.notfound.html();
    var c = S.home ? CH[S.home] : current(), req = S.activated.filter(function (a) { return a.id === b.id; })[0];
    var isZen = b.id === 'zenhur';
    return '<section class="page-head"><div class="wrap"><div class="crumbs"><a href="#/book">The Book</a> / ' + esc(b.provider) + '</div>' +
      (b.logo ? '<div class="logo-plate lg" style="margin-bottom:16px"><img src="' + esc(b.logo) + '" alt="' + esc(b.provider) + '"></div>' : '') +
      '<span class="eyebrow">' + esc(b.provider) + ' · ' + esc(b.cat) + '</span><h1 style="margin-top:8px">' + esc(b.title) + '</h1><p class="lede">' + esc(b.blurb) + '</p></div></section>' +
      '<section class="section-tight"><div class="wrap two-col">' +
      '<div style="display:flex;flex-direction:column;gap:24px">' +
        (b.descriptionPending
          ? '<div class="callout" style="border-left-color:var(--warn)"><b>Description pending.</b> ' + esc(b.provider) + ' has not yet supplied a description of what the app does. This page stays in draft until it does — a benefit page should say what the service is, in the provider\'s own words.</div>'
          : '<p class="muted" style="max-width:65ch">' + esc(b.whatItIs) + '</p>') +
        (isZen ? '<div><h3 style="margin-bottom:12px">What the free readiness assessment includes</h3><div class="inc">' +
          '<div><h4>Business credit</h4><p>What the available information shows about your business credit profile, and where more preparation could help.</p></div>' +
          '<div><h4>Funding readiness</h4><p>How ready your business is for the funding you want, what to prepare, and potential paths for further review.</p></div>' +
          '<div><h4>Personal credit</h4><p>Which factors in the credit information you share may affect business financing, and why they matter.</p></div></div>' +
          '<p class="hint" style="margin-top:10px">Offered inside the dashboard. You choose whether to request it.</p></div>' : '') +
        '<div class="card"><h3>What to know</h3><ul class="checklist">' + b.whatToKnow.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div>' +
        (isZen ? '<div class="card"><h3>What you may be asked for</h3><ul class="checklist"><li>Basic business details: legal name, entity type, location, industry, and time in business</li><li>Your funding goals: what you are looking for, roughly how much, and what it is for</li><li>A general picture of your business finances</li><li>Credit information you choose to provide, such as a recent report or score</li><li>Your consent to the review and to how your information will be used</li></ul></div>' : '') +
        '<div class="callout"><b>Two separate accounts.</b> Your PowerChapter membership and your ' + esc(b.provider) + ' account are not the same login. PowerChapter passes your chapter reference so ' + esc(b.provider) + ' knows which chamber you came from. Everything you enter with ' + esc(b.provider) + ' stays with ' + esc(b.provider) + '.</div>' +
        (isZen ? '<div class="callout" style="border-left-color:var(--ink-3)"><b>Good to know.</b> A readiness assessment is not an approval, preapproval, credit decision, or commitment to provide financing. Results and funding amounts are not guaranteed. A self-reported credit score is not a verified credit report, and results note where report information is missing. Any credit inquiry requires separate disclosures and your authorization.</div>' : '') +
      '</div>' +
      '<aside class="sticky-side"><div class="card" style="display:flex;flex-direction:column;gap:14px"><span class="eyebrow">Get access</span>' +
        '<div class="kv on-dark" style="--panel-2:var(--surface-2);--panel-line:var(--line);--panel-ink:var(--ink);--panel-mute:var(--ink-3)"><div><small>Listed value</small><b style="font-size:.86rem">' + esc(b.listedValue) + '</b></div><div><small>Your cost through your chamber</small><b>$0</b></div></div>' +
        '<div class="status-line">' + (c ? 'Chapter: <b>' + esc(c.name.replace('Sample Chapter — ', '')) + '</b>' : 'No chapter selected') + '</div>' +
        (req ? '<div class="status-line"><span class="pill ver">Access requested</span> ' + esc(req.when) + '</div>' : '') +
        '<button class="btn btn-gold" type="button" id="reqBtn">' + (req ? 'Open ' + esc(b.provider) + ' again' : 'Get access') + '</button>' +
        '<p class="hint">' + (b.intakeUrl ? 'Opens ' + esc(b.intakeUrl.replace('https://', '')) + ' in a new window.' : 'Access details come from your chamber.') + '</p></div></aside>' +
      '</div></section>';
  },
  mount: function (r) {
    var b = C.BENEFITS.filter(function (x) { return x.id === r.arg; })[0]; if (!b) return;
    $('#reqBtn').addEventListener('click', function () {
      if (!S.user) return modal('Activate your membership first', '<p class="muted">This benefit is for members of acknowledged chambers. Activating takes about a minute, and your chamber confirms your membership.</p>', [{ t: 'Activate membership', cls: 'btn-primary', go: '#/activate' }]);
      var hc = CH[S.home];
      if (S.homeStatus !== 'verified') return modal('Waiting on your chamber', '<p class="muted">' + esc(hc.name) + ' has not verified your membership yet. You can enter the invite code your chamber sent from your dashboard.</p>', [{ t: 'Go to my dashboard', cls: 'btn-primary', go: '#/member' }]);
      if (hc.status !== 'live' || !benefitOn(hc.id, b.id)) return modal('Not live at your chapter yet', '<p class="muted">' + esc(hc.name) + ' has not turned this benefit on yet. We will show it on your dashboard when it goes live.</p>', [{ t: 'Close', cls: 'btn-ghost' }]);
      if (!b.intakeUrl) return modal('Access comes from your chamber', '<p class="muted">' + esc(b.provider) + ' has not published a sign-up link yet. ' + esc(hc.name) + ' will send access details to its members once it does.</p>', [{ t: 'Close', cls: 'btn-ghost' }]);
      var ref = 'PC-' + hc.id.slice(0, 3).toUpperCase() + '-' + Math.random().toString(36).slice(2, 8).toUpperCase();
      modal('You are leaving PowerChapter', '<p class="muted">Next, ' + esc(b.provider) + ' opens at <span class="mono">' + esc(b.intakeUrl.replace('https://', '')) + '</span>. PowerChapter sends only these two references:</p><div class="table-wrap"><table class="data"><tbody><tr><td>Chapter</td><td class="n">' + esc(hc.id) + '</td></tr><tr><td>One-time reference</td><td class="n">' + ref + '</td></tr></tbody></table></div><p class="hint">Your name, contact details, and anything financial are entered directly with ' + esc(b.provider) + ', in its own account. PowerChapter does not receive them.</p>',
        [{ t: 'Continue to ' + b.provider, cls: 'btn-gold', fn: function () { var ex = S.activated.filter(function (a) { return a.id === b.id; })[0]; if (!ex) S.activated.push({ id: b.id, ref: ref, when: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }); save(); window.open(b.intakeUrl, '_blank', 'noopener'); render(); } }, { t: 'Cancel', cls: 'btn-ghost' }]);
    });
  }
};

/* ---------------- ACTIVATE ---------------- */
var ACT = { step: 1, chapter: null, mode: 'code', code: '', name: '', email: '', biz: '', consent: false, err: '' };
VIEWS.activate = {
  html: function () {
    if (S.user) return '<section class="section"><div class="wrap"><div class="form-card"><h2>You are signed in</h2><p class="muted" style="margin:10px 0 18px">Your membership is already active on this device.</p><a class="btn btn-primary" href="#/member">Go to my dashboard</a></div></div></section>';
    if (!ACT.chapter) ACT.chapter = current() ? current().id : null;
    var c = ACT.chapter ? CH[ACT.chapter] : null, body = '';
    if (ACT.step === 1) {
      body = '<h2>Which chamber are you a member of?</h2><p class="muted">Your chapter decides which benefits you can use.</p>' +
        '<div class="field"><label for="actCh">Chapter</label><select class="input" id="actCh"><option value="">Select your chapter</option>' + C.CHAPTERS.map(function (x) { return '<option value="' + x.id + '"' + (x.id === ACT.chapter ? ' selected' : '') + '>' + esc(x.name) + ' (' + x.city + ', ' + x.st + ')</option>'; }).join('') + '</select>' +
        (c && S.browse === c.id ? '<span class="hint">Pre-filled from your selected chapter.</span>' : '') + '</div>' +
        '<p class="small muted">Not listed? <a href="#/for-chambers">Ask your chamber to apply</a>.</p>';
    } else if (ACT.step === 2) {
      body = '<h2>Verify your membership</h2><p class="muted">' + esc(c.name) + ' confirms who its members are. Location alone never grants access.</p>' +
        '<div class="radio-cards"><label><input type="radio" name="mode" id="modeCode" value="code"' + (ACT.mode === 'code' ? ' checked' : '') + '><span><b>I have an invite code</b><br><span class="small muted">Your chamber sends it by email or in its member newsletter.</span></span></label>' +
        '<label><input type="radio" name="mode" id="modeReq" value="request"' + (ACT.mode === 'request' ? ' checked' : '') + '><span><b>Ask my chamber to confirm me</b><br><span class="small muted">Your chamber reviews the request. Benefits unlock once it approves.</span></span></label></div>' +
        (ACT.mode === 'code' ? '<div class="field"><label for="actCode">Invite code</label><input class="input mono" id="actCode" autocomplete="off" value="' + esc(ACT.code) + '" placeholder="e.g. ' + esc(c.inviteCode.slice(0, 3)) + '-XXXX"><span class="hint">Prototype: this chapter\'s demo code is <b class="mono">' + esc(codeFor(c)) + '</b>.</span></div>' : '');
    } else if (ACT.step === 3) {
      body = '<h2>Your details</h2><p class="muted">This is everything PowerChapter keeps about you.</p>' +
        '<div class="field"><label for="actName">Full name</label><input class="input" id="actName" autocomplete="name" value="' + esc(ACT.name) + '"></div>' +
        '<div class="field"><label for="actEmail">Work email</label><input class="input" id="actEmail" type="email" autocomplete="email" value="' + esc(ACT.email) + '"></div>' +
        '<div class="field"><label for="actBiz">Business name</label><input class="input" id="actBiz" autocomplete="organization" value="' + esc(ACT.biz) + '"></div>' +
        '<label class="check"><input type="checkbox" id="actConsent"' + (ACT.consent ? ' checked' : '') + '><span>PowerChapter may store my name, email, business name, and chapter so I can use my chamber\'s benefits. I understand benefit providers collect their own information directly. <a href="#/privacy">What we store</a></span></label>';
    } else {
      body = '<h2>Check your email</h2><p class="muted">We sent a sign-in link to <b>' + esc(ACT.email) + '</b>. There is no password to remember.</p><div class="callout">Prototype: no email is sent. Use the button below to follow the link.</div>';
    }
    return '<section class="section"><div class="wrap"><div class="form-card"><div class="progress" aria-hidden="true">' + [1, 2, 3, 4].map(function (i) { return '<i class="' + (i <= ACT.step ? 'on' : '') + '"></i>'; }).join('') + '</div>' +
      '<form id="actForm" novalidate>' + body + (ACT.err ? '<p class="err" role="alert">' + esc(ACT.err) + '</p>' : '') +
      '<div style="display:flex;gap:10px;justify-content:space-between;flex-wrap:wrap">' + (ACT.step > 1 && ACT.step < 4 ? '<button class="btn btn-ghost" type="button" id="actBack">Back</button>' : '<span></span>') +
      '<button class="btn btn-primary" type="submit">' + (ACT.step === 3 ? 'Send sign-in link' : ACT.step === 4 ? 'Open sign-in link (demo)' : 'Continue') + '</button></div></form></div></div></section>';
  },
  mount: function () {
    if (S.user) return;
    var f = $('#actForm');
    $$('input[name="mode"]').forEach(function (r) { r.addEventListener('change', function () { ACT.mode = r.value; ACT.err = ''; render(); }); });
    var back = $('#actBack'); if (back) back.addEventListener('click', function () { ACT.step--; ACT.err = ''; render(); });
    f.addEventListener('submit', function (e) {
      e.preventDefault(); ACT.err = '';
      if (ACT.step === 1) { ACT.chapter = $('#actCh').value || null; if (!ACT.chapter) { ACT.err = 'Choose your chapter to continue.'; return render(); } ACT.step = 2; }
      else if (ACT.step === 2) {
        if (ACT.mode === 'code') { ACT.code = $('#actCode').value.trim(); if (ACT.code.toUpperCase() !== codeFor(CH[ACT.chapter]).toUpperCase()) { ACT.err = 'That code does not match ' + CH[ACT.chapter].name + '. Check the code your chamber sent, or ask your chamber to confirm you instead.'; return render(); } }
        ACT.step = 3;
      } else if (ACT.step === 3) {
        ACT.name = $('#actName').value.trim(); ACT.email = $('#actEmail').value.trim(); ACT.biz = $('#actBiz').value.trim(); ACT.consent = $('#actConsent').checked;
        if (!ACT.name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(ACT.email)) { ACT.err = 'Enter your name and a valid email address.'; return render(); }
        if (!ACT.consent) { ACT.err = 'Check the consent box to continue.'; return render(); }
        ACT.step = 4;
      } else {
        S.user = { name: ACT.name, email: ACT.email, biz: ACT.biz, id: 'PC-' + Math.floor(1000 + Math.random() * 9000) + ' ' + Math.floor(1000 + Math.random() * 9000) };
        S.home = ACT.chapter; S.homeStatus = ACT.mode === 'code' ? 'verified' : 'pending'; S.browse = ACT.chapter; S.browseSrc = 'member'; save();
        ACT = { step: 1, chapter: null, mode: 'code', code: '', name: '', email: '', biz: '', consent: false, err: '' };
        toast(S.homeStatus === 'verified' ? 'Membership verified. Welcome.' : 'Request sent to your chamber.'); return go('#/member');
      }
      render();
    });
  }
};

/* ---------------- MEMBER DASHBOARD ---------------- */
VIEWS.member = {
  html: function () {
    if (!S.user) return '<section class="section"><div class="wrap"><div class="form-card"><h2>Sign in</h2><p class="muted" style="margin:10px 0 18px">Members sign in with a one-time link sent to their email. New here? Activate your membership first.</p><a class="btn btn-primary" href="#/activate">Activate membership</a></div></div></section>';
    var h = CH[S.home], b = current(), bs = liveBenefits(h), ann = (S.ann[h.id] || []).concat(C.SAMPLE_ANNOUNCEMENTS);
    return '<section class="page-head"><div class="wrap"><span class="eyebrow">Member dashboard</span><h1 style="margin-top:8px">Welcome, ' + esc(S.user.name.split(' ')[0]) + '</h1><p class="lede">' + esc(S.user.biz || 'Your business') + ' · Member ID <span class="num">' + esc(S.user.id) + '</span></p></div></section>' +
      '<section class="section-tight"><div class="wrap dash">' +
        '<div style="display:flex;flex-direction:column;gap:20px">' +
          '<div class="home-chap on-dark"><span class="lbl">Membership chapter</span><h3>' + esc(h.name) + '</h3><div class="sub" style="color:var(--panel-mute)">' + esc(h.city) + ', ' + esc(STN[h.st]) + '</div><div style="display:flex;gap:8px;flex-wrap:wrap">' + (S.homeStatus === 'verified' ? '<span class="pill ver">Verified by chamber</span>' : '<span class="pill pend">Awaiting chamber verification</span>') + statusPill(h) + '</div>' +
            (S.homeStatus !== 'verified' ? '<form id="lateCode" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px"><input class="input mono" id="lateCodeIn" placeholder="Have an invite code?" style="max-width:220px" aria-label="Invite code"><button class="btn btn-gold btn-sm" type="submit">Verify</button></form><span class="note" style="font-size:.78rem;color:var(--panel-mute)">Prototype: code is ' + esc(codeFor(h)) + ', or approve yourself from the chamber admin view.</span>' : '') +
            (b && b.id !== h.id ? '<div class="empty" style="margin-top:6px">You are browsing <b>' + esc(b.name) + '</b>. Local news follows the browsing chapter. Benefits follow your membership chapter. <button class="btn-link" type="button" id="backHome" style="color:var(--accent)">Switch back</button></div>' : '') +
            '<div class="acts" style="display:flex;gap:8px;flex-wrap:wrap"><a class="btn btn-ghost btn-sm" href="#/chapter/' + h.id + '">Chapter page</a></div></div>' +
          '<div class="card"><h3>Your benefits</h3>' + (bs.length ? '<div class="list">' + bs.map(function (x) { var a = S.activated.filter(function (y) { return y.id === x.id; })[0]; return '<div class="it">' + (x.logo ? '<img class="row-logo" src="' + esc(x.logo) + '" alt="' + esc(x.provider) + '">' : '') + '<div class="nm"><b>' + esc(x.short) + '</b><span>' + esc(x.provider) + ' · ' + (a ? 'Requested ' + esc(a.when) : 'Not started') + '</span></div>' + (a ? '<span class="pill ver">Requested</span>' : x.detail ? '<a class="btn btn-primary btn-sm" href="#/benefit/' + x.id + '">Start</a>' : '<span class="pill plain onb">Details soon</span>') + '</div>'; }).join('') + '</div>' : '<p class="muted">Benefits go live when your chapter finishes onboarding.</p>') + '</div>' +
          '<div class="card"><h3>Chapter events <span class="sample">sample</span></h3><div class="events">' + C.SAMPLE_EVENTS.map(function (e) { return '<div class="event"><div class="date"><small>' + e.m + '</small><b>' + e.d + '</b></div><div><b>' + esc(e.t) + '</b><div class="small muted">' + esc(e.w) + '</div></div></div>'; }).join('') + '</div></div>' +
        '</div>' +
        '<div style="display:flex;flex-direction:column;gap:20px">' +
          '<div class="card"><h3>From your chamber</h3>' + ann.map(function (a) { return '<div class="ann"><b>' + esc(a.t) + '</b><span>' + esc(a.when) + '</span></div>'; }).join('') + '</div>' +
          '<div class="card"><h3>What PowerChapter stores about you</h3><div class="table-wrap"><table class="data"><tbody><tr><td>Name</td><td>' + esc(S.user.name) + '</td></tr><tr><td>Email</td><td>' + esc(S.user.email) + '</td></tr><tr><td>Business</td><td>' + esc(S.user.biz || '—') + '</td></tr><tr><td>Chapter</td><td>' + esc(h.name) + '</td></tr><tr><td>Consent</td><td>Given at activation</td></tr></tbody></table></div><p class="hint" style="margin-top:10px">That is the whole record. No financial or credit information, nothing from your provider accounts, and no location history. Each provider account is a separate login holding its own data. <a href="#/privacy">See the boundary</a>.</p></div>' +
          '<button class="btn btn-ghost" type="button" id="signOut">Sign out and clear this demo</button>' +
        '</div>' +
      '</div></section>';
  },
  mount: function () {
    if (!S.user) return;
    var lc = $('#lateCode'); if (lc) lc.addEventListener('submit', function (e) { e.preventDefault(); if ($('#lateCodeIn').value.trim().toUpperCase() === codeFor(CH[S.home]).toUpperCase()) { S.homeStatus = 'verified'; save(); toast('Membership verified.'); render(); } else toast('That code does not match your chapter.'); });
    var bh = $('#backHome'); if (bh) bh.addEventListener('click', function () { setBrowse(S.home, 'member'); render(); });
    $('#signOut').addEventListener('click', function () { resetAll(); toast('Signed out. Demo data cleared.'); go('#/'); });
  }
};

/* ---------------- CHAMBER ADMIN ---------------- */
var ADMIN_CH = null;
VIEWS.admin = {
  html: function () {
    var c = CH[ADMIN_CH] || (S.home && CH[S.home]) || current() || C.CHAPTERS[0]; ADMIN_CH = c.id;
    var mem = c.profile.members, inv = Math.round(mem * 0.64), act = Math.round(inv * 0.41) + (S.user && S.home === c.id ? 1 : 0), hand = Math.round(act * 0.22) + S.activated.length * (S.home === c.id ? 1 : 0);
    var pending = S.user && S.home === c.id && S.homeStatus !== 'verified';
    return '<section class="page-head"><div class="wrap"><span class="eyebrow">Chamber admin · preview</span><h1 style="margin-top:8px">' + esc(c.name) + '</h1><p class="lede">What chamber staff see. Counts only: staff never see members\' financial information or what they submit to providers.</p>' +
      '<div class="field" style="max-width:360px;margin-top:16px"><label for="admCh">Preview as chamber</label><select class="input" id="admCh">' + C.CHAPTERS.map(function (x) { return '<option value="' + x.id + '"' + (x.id === c.id ? ' selected' : '') + '>' + esc(x.name) + '</option>'; }).join('') + '</select></div></div></section>' +
      '<section class="section-tight"><div class="wrap" style="display:flex;flex-direction:column;gap:20px">' +
        '<div class="kpis"><div class="kpi"><div class="v">' + fmt(mem) + '</div><div class="k">Chamber members <span class="sample">sample</span></div></div><div class="kpi"><div class="v">' + fmt(inv) + '</div><div class="k">Invited <span class="sample">sample</span></div></div><div class="kpi"><div class="v">' + fmt(act) + '</div><div class="k">Activated · ' + pct(act, inv) + '</div></div><div class="kpi"><div class="v">' + fmt(hand) + '</div><div class="k">Benefit handoffs</div></div></div>' +
        '<div class="dash">' +
          '<div style="display:flex;flex-direction:column;gap:20px">' +
            '<div class="card"><h3>Verification requests</h3>' + (pending ? '<div class="list"><div class="it"><div class="nm"><b>' + esc(S.user.name) + '</b><span>' + esc(S.user.biz || '') + ' · ' + esc(S.user.email) + '</span></div><button class="btn btn-primary btn-sm" type="button" id="approve">Approve</button></div></div>' : '<p class="muted">No pending requests. Members who ask to be confirmed appear here.</p>') + '</div>' +
            '<div class="card"><h3>Invite members</h3><p class="muted small" style="margin-bottom:14px">Share the chapter invite code, or upload a roster so members are recognized when they sign in.</p>' +
              '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><span class="mono" style="font-size:1.2rem;padding:8px 14px;border:1px dashed var(--line-2);border-radius:8px">' + esc(codeFor(c)) + '</span><button class="btn btn-ghost btn-sm" type="button" id="newCode">Generate a new code</button></div>' +
              '<div class="field" style="margin-top:16px"><label for="roster">Roster file (CSV: name, email)</label><input class="input" type="file" id="roster" accept=".csv,text/csv"><span class="hint">Prototype: the file is counted in your browser and not uploaded or kept.</span></div></div>' +
            '<div class="card"><h3>Post an announcement</h3><form id="annForm" style="display:flex;flex-direction:column;gap:10px"><label class="sr" for="annText" style="font-size:.84rem;font-weight:600;color:var(--ink-2)">Message to members</label><textarea class="input" id="annText" maxlength="160" placeholder="e.g. Member breakfast moved to 8:00 AM"></textarea><button class="btn btn-primary" type="submit" style="align-self:flex-start">Post to members</button></form></div>' +
          '</div>' +
          '<div style="display:flex;flex-direction:column;gap:20px">' +
            '<div class="card"><h3>Benefits for your members</h3>' + (c.status !== 'live' ? '<p class="muted small" style="margin-bottom:10px">Your chapter is onboarding. Toggles take effect at launch.</p>' : '') + '<div class="list">' + C.BENEFITS.filter(function (b) { return !b.slot; }).map(function (b) { return '<div class="it"><div class="nm"><b>' + esc(b.short) + '</b><span>' + esc(b.provider) + '</span></div><label class="toggle"><input type="checkbox" data-tog="' + b.id + '"' + (benefitOn(c.id, b.id) ? ' checked' : '') + ' aria-label="Offer ' + esc(b.short) + '"><span></span></label></div>'; }).join('') + '</div></div>' +
            '<div class="card"><h3>Your acknowledged-chamber guide</h3><div class="list">' +
              '<div class="it"><div class="nm"><b>PowerChapter generates no revenue</b><span>A nonprofit. Its operators receive no income from it.</span></div></div>' +
              '<div class="it"><div class="nm"><b>No cost to your chamber or your members</b><span>Benefits are offered through your chamber at no charge under current provider agreements.</span></div></div>' +
              '<div class="it"><div class="nm"><b>Your member records stay yours</b><span>PowerChapter holds only what a member enters when activating: name, email, business, chapter, consent.</span></div></div>' +
              '<div class="it"><div class="nm"><b>Benefits carry your name</b><span>Members experience the program as your chamber\'s member benefit program.</span></div></div>' +
              '<div class="it"><div class="nm"><b>Every benefit meets the Gold Standard</b><span>Evaluated for longevity and reliability before it is listed.</span></div></div>' +
              '<div class="it"><div class="nm"><b>No trade-offs</b><span>No data harvesting, no upsell funnels, no enrollment friction built to capture leads.</span></div></div>' +
            '</div><p class="hint" style="margin-top:12px">If a provider ever charges your members, collects data without consent, or restricts access, contact PowerChapter. The benefit is removed from The Book and every chamber is notified.</p></div>' +
            '<div class="card"><h3>What you can and cannot see</h3><ul class="checklist"><li>Who has activated, and when</li><li>Totals of benefit handoffs by benefit</li><li>Member feedback your chamber collects</li></ul><p class="hint" style="margin-top:12px">Not visible to staff: members\' financial information, credit information, assessment results, or anything entered with a provider.</p></div>' +
          '</div>' +
        '</div></div></section>';
  },
  mount: function () {
    var c = CH[ADMIN_CH];
    $('#admCh').addEventListener('change', function (e) { ADMIN_CH = e.target.value; render(); });
    var ap = $('#approve'); if (ap) ap.addEventListener('click', function () { S.homeStatus = 'verified'; save(); toast('Member approved. Benefits are unlocked for them.'); render(); });
    $('#newCode').addEventListener('click', function () { S.codes[c.id] = c.id.slice(0, 3).toUpperCase() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase(); save(); toast('New invite code created. The old code stops working.'); render(); });
    $('#roster').addEventListener('change', function (e) { var file = e.target.files[0]; if (!file) return; var rd = new FileReader(); rd.onload = function () { var n = String(rd.result).split(/\r?\n/).filter(function (l) { return l.trim(); }).length; toast('Read ' + Math.max(0, n - 1) + ' member rows. Nothing was uploaded.'); e.target.value = ''; }; rd.readAsText(file); });
    $('#annForm').addEventListener('submit', function (e) { e.preventDefault(); var t = $('#annText').value.trim(); if (!t) return toast('Write a message first.'); (S.ann[c.id] = S.ann[c.id] || []).unshift({ t: t, when: 'Just now' }); save(); toast('Posted to ' + c.name.replace('Sample Chapter — ', '') + ' members.'); render(); });
    $$('[data-tog]').forEach(function (t) { t.addEventListener('change', function () { (S.toggles[c.id] = S.toggles[c.id] || {})[t.dataset.tog] = t.checked; save(); toast(t.checked ? 'Benefit turned on for your members.' : 'Benefit turned off for your members.'); }); });
  }
};

/* ---------------- STANDARD / CHAMBERS / PRIVACY ---------------- */
var PROXIES = [
  ['Length of operation', 'How long the chamber has been serving its community. A chamber active for 20 or more years has demonstrated durability — it has survived economic cycles, leadership transitions, and changes in its community. Time in service is the most fundamental proof of institutional viability.'],
  ['Member retention', 'Do businesses stay, or do they churn? Retention is the most honest reputation signal, because members vote with their feet. A chamber that keeps its members year over year is delivering value those members recognize. High turnover says the pitch is stronger than the experience.'],
  ['Community visibility', 'Is the chamber a recognized voice in its region? Do local media, government, and institutions reference or partner with it? A chamber nobody turns to is not providing institutional leadership, however many members it has.'],
  ['Peer recognition', 'Do other chambers know it? Is it active in state or national chamber associations? Reputation among peers is harder to manufacture than reputation among members, because peers have no reason to recognize an institution they do not respect.'],
  ['Leadership stability', 'How often does executive leadership turn over? Long tenure, or planned and orderly transitions, signals an institution that is governed well. Planned retirements and growth hires are not red flags; a pattern of instability — three or more leaders in ten years without clear explanation — is.']
];
VIEWS.standard = {
  html: function () {
    return '<section class="page-head"><div class="wrap"><span class="eyebrow">The Acknowledgement Standard</span><h1 style="margin-top:8px">Reputation is the gate</h1><p class="lede">A PowerChapter Acknowledged Chamber is acknowledged for its demonstrated standing in its business community. Not size, not revenue, not member count — standing.</p></div></section>' +
      '<section class="section-tight"><div class="wrap">' +
      '<div class="section-head"><div><span class="eyebrow">What acknowledgement weighs</span><h2 style="margin-top:8px">Five proxies for standing</h2></div></div>' +
      '<div class="grid-2">' + PROXIES.map(function (p, i) { return '<div class="card"><div style="display:flex;gap:12px;align-items:center"><span class="rank">' + (i + 1) + '</span><h3>' + esc(p[0]) + '</h3></div><p class="muted small" style="margin-top:10px">' + esc(p[1]) + '</p></div>'; }).join('') + '</div>' +
      '</div></section>' +
      '<section class="section band"><div class="wrap two-col">' +
        '<div class="card"><h3>What is not evaluated</h3><div class="list">' +
          '<div class="it"><div class="nm"><b>Member count minimums</b><span>There is no minimum. A 150-member chamber can be acknowledged; a 3,000-member chamber can be declined.</span></div></div>' +
          '<div class="it"><div class="nm"><b>Revenue thresholds</b><span>A chamber\'s financial size is not a proxy for its reputation.</span></div></div>' +
          '<div class="it"><div class="nm"><b>Geographic requirements</b><span>Rural, suburban and urban chambers are evaluated on the same standard.</span></div></div>' +
        '</div><p class="hint" style="margin-top:14px">These are excluded because they push toward size-based credentialing, which is the opposite of what this standard is for. A 150-member chamber run with integrity for 30 years has proven something a two-year-old chamber chasing growth has not.</p></div>' +
        '<div class="card"><h3>How the standard is applied</h3><ul class="checklist">' +
          '<li>The same five proxies, the same questions, and the same criteria for every applicant</li>' +
          '<li>Judged as a whole, not scored — a chamber strong in four areas and weak in one may still be acknowledged</li>' +
          '<li>Every decision documented with a written rationale mapped to the five proxies</li>' +
          '<li>Acknowledgement is ongoing, not annual, and may be reviewed if credible information suggests the standard is no longer met</li>' +
        '</ul><a class="btn btn-primary" href="#/for-chambers" style="margin-top:18px">How to apply</a></div>' +
      '</div></section>';
  }
};
VIEWS['for-chambers'] = {
  html: function () {
    var secs = [
      ['Institutional identity', 'Legal and common name, year established, address, website, primary contact, and current executive leadership.'],
      ['Length of operation', 'Year established, whether operation has been continuous, and years serving the current community.'],
      ['Member retention', 'Retention rate or a description of it, how it is tracked, and why members renew or leave. Member count is collected for context only and is not a criterion.'],
      ['Community visibility', 'Media references, partnerships with local government and civic institutions, and two or three examples of community work in the past 24 months.'],
      ['Peer recognition', 'State association and U.S. Chamber membership, regional coalitions, and collaborations with other chambers.'],
      ['Leadership stability', 'Current leadership and year appointed, how many have held the role in the past decade, average tenure, and the governance structure.'],
      ['Acknowledgement interest', 'How the chamber heard about PowerChapter, why it is interested, and anything else about its standing worth knowing.']
    ];
    var benefits = C.BENEFITS.filter(function (b) { return !b.slot; });
    return '' +
    '<section class="hero" style="padding-block:52px 44px"><div class="wrap hero-grid">' +
      '<div><span class="eyebrow">For Chambers of Commerce</span>' +
      '<h1 style="margin-top:14px">Hand every member $3,199.88 a year in business services. Under your name. At no cost to anyone.</h1>' +
      '<p class="lede" style="margin-top:18px">PowerChapter acknowledges chambers on reputation, then gives them The Book of Business Building Benefits to offer their members as a benefit of membership. Your chamber pays nothing, your members pay nothing, and your member list never leaves your chamber.</p>' +
      '<div class="hero-actions" style="margin-top:24px"><a class="btn btn-primary" href="https://www.powerchapter.com/apply.html" target="_blank" rel="noopener">Apply for Acknowledgement</a><a class="btn btn-ghost" href="#/book">See what is in The Book</a></div>' +
      '<p class="tiny muted" style="margin-top:14px">Figures are the providers\' published list prices. Acknowledgement is granted on standing, not on size, revenue, or member count.</p></div>' +
      '<div class="mcard-stage"><div class="mcard" style="transform:none">' +
        '<svg class="seal" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="46" fill="none" stroke="#E2B64B" stroke-width="2"/><circle cx="50" cy="50" r="38" fill="none" stroke="#E2B64B" stroke-width="1" stroke-dasharray="2 3"/><path d="M50 22l18 10v18c0 9-7.6 15.5-18 19-10.4-3.5-18-10-18-19V32l18-10Z" fill="none" stroke="#E2B64B" stroke-width="2"/></svg>' +
        '<div class="top"><span class="wm">Power<span>Chapter</span></span><span class="tier">Acknowledged</span></div>' +
        '<div class="chap"><small>Your chamber</small><b>[Your Chamber of Commerce]</b></div>' +
        '<div class="meta"><div><small>Member benefit value</small><span>$3,199.88 / yr</span></div><div style="text-align:right"><small>Cost to your chamber</small><span>$0.00</span></div></div>' +
      '</div></div>' +
    '</div></section>' +

    '<section class="section-tight band-dark on-dark"><div class="wrap"><div class="stats">' +
      '<div class="stat"><div class="v">$0</div><div class="k">Cost to your chamber</div></div>' +
      '<div class="stat"><div class="v">$0</div><div class="k">Cost to each member</div></div>' +
      '<div class="stat"><div class="v">' + benefits.length + '</div><div class="k">Services in The Book today, with more under review</div></div>' +
      '<div class="stat"><div class="v">None</div><div class="k">Member records shared with PowerChapter</div></div>' +
    '</div></div></section>' +

    '<section class="section"><div class="wrap">' +
      '<div class="section-head"><div><span class="eyebrow">What your members receive</span><h2 style="margin-top:8px">Services they would otherwise pay for</h2><p class="lede">Each one is vetted for longevity and reliability before it enters The Book, and each is offered to your members at no charge.</p></div></div>' +
      '<div class="grid-2">' + benefits.map(benefitCard).join('') + '</div>' +
    '</div></section>' +

    '<section class="section band"><div class="wrap two-col">' +
      '<div><span class="eyebrow">What your chamber receives</span><h2 style="margin-top:8px">A member benefit program you did not have to build</h2>' +
      '<div class="list" style="margin-top:18px">' +
        '<div class="it"><div class="nm"><b>Offering rights under your own brand</b><span>You present every benefit as your chamber\'s member benefit program. Members deal with you, not with us.</span></div></div>' +
        '<div class="it"><div class="nm"><b>A chapter page and directory listing</b><span>Your chamber by name in the national directory, with your service area, events, announcements, and photos.</span></div></div>' +
        '<div class="it"><div class="nm"><b>Member verification that runs itself</b><span>Share an invite code or upload a roster. Members verify themselves — no staff queue to work through.</span></div></div>' +
        '<div class="it"><div class="nm"><b>An admin view with totals</b><span>Who has activated, how many, and which benefits are being used. Counts only: staff never see a member\'s financial information.</span></div></div>' +
        '<div class="it"><div class="nm"><b>A renewal argument you can put in writing</b><span>A documented dollar figure members can weigh against their dues.</span></div></div>' +
        '<div class="it"><div class="nm"><b>Every future benefit, automatically</b><span>When The Book grows, your members get the new service at no cost and no new application.</span></div></div>' +
      '</div></div>' +
      '<div class="card"><h3>What it costs you</h3><div class="table-wrap"><table class="data"><tbody>' +
        '<tr><td>Fees to PowerChapter</td><td class="n">$0</td></tr>' +
        '<tr><td>Fees to the providers</td><td class="n">$0</td></tr>' +
        '<tr><td>Cost to your members</td><td class="n">$0</td></tr>' +
        '<tr><td>Software to buy or run</td><td class="n">None</td></tr>' +
        '<tr><td>Member data you hand over</td><td class="n">None</td></tr>' +
        '<tr><td>Exclusivity or term commitment</td><td class="n">None</td></tr>' +
        '<tr><td>Reporting required of your staff</td><td class="n">None</td></tr>' +
      '</tbody></table></div>' +
      '<p class="hint" style="margin-top:12px">What it does ask of you: tell your members the benefits exist, and keep operating with the standing that earned Acknowledgement.</p></div>' +
    '</div></section>' +

    '<section class="section"><div class="wrap">' +
      '<div class="section-head"><div><span class="eyebrow">Why it works this way</span><h2 style="margin-top:8px">The providers are paying for trust, not for leads</h2></div></div>' +
      '<div class="grid-3">' +
        '<div class="card"><h3>They chose the chamber channel</h3><p class="muted small" style="margin-top:8px">A business owner ignores an advertisement and answers the chamber they have belonged to for fifteen years. That difference is worth more to a provider than a paid campaign, and it is why the service arrives free.</p></div>' +
        '<div class="card"><h3>The standard protects the channel</h3><p class="muted small" style="margin-top:8px">Acknowledgement is granted on standing, not on size or payment. A provider knows its service is reaching members of institutions that have been vetted — which is the whole reason it agreed to the arrangement.</p></div>' +
        '<div class="card"><h3>Nobody is extracting anything</h3><p class="muted small" style="margin-top:8px">No fees, no data harvesting, no upsell funnels, no enrollment friction built to capture leads. If a provider breaks that, it comes out of The Book and every chamber hears about it.</p></div>' +
      '</div>' +
    '</div></section>' +

    '<section class="section band"><div class="wrap">' +
      '<div class="section-head"><div><span class="eyebrow">Straight answers</span><h2 style="margin-top:8px">What chambers ask before they apply</h2></div></div>' +
      '<div class="grid-2">' + C.CHAMBER_FAQ.map(function (f) { return '<div class="qa"><h4>' + esc(f.q) + '</h4><p class="muted small">' + esc(f.a) + '</p></div>'; }).join('') + '</div>' +
    '</div></section>' +

    '<section class="section"><div class="wrap">' +
      '<div class="section-head"><div><span class="eyebrow">How Acknowledgement works</span><h2 style="margin-top:8px">Four steps to a decision, four more to launch</h2></div></div>' +
      '<div class="steps">' +
        step('01', 'Inquiry', 'Tell PowerChapter about your chamber. You receive an overview and the Acknowledgement Application.') +
        step('02', 'Application', 'A formal application covering your history, community role, retention, and leadership. Submit it on your own timeline.') +
        step('03', 'Review', 'A substantive review against the five proxies of the Acknowledgement Standard, documented with a written rationale.') +
        step('04', 'Decision', 'Approved, held for more detail, or declined. A decline is not permanent — chambers are welcome to apply again.') +
      '</div>' +
      '<div class="steps" style="margin-top:16px">' +
        step('05', 'Onboarding', 'An orientation call: what Acknowledgement means, what is in The Book, how members get access, and who does what.') +
        step('06', 'Launch', 'Your chapter page goes up, your service-area counties are mapped, and you receive the invite code to share with members.') +
        step('07', 'Follow-up', 'Check-ins at 30 and 90 days, then periodic contact. No fees, no reporting requirements, no data-sharing obligations.') +
        step('08', 'Ongoing', 'Acknowledgement continues without reapplication, and may be reviewed if a chamber\'s standing materially changes.') +
      '</div>' +
      '<div class="two-col" style="margin-top:28px">' +
        '<div class="card"><h3>What the application asks</h3><div class="list">' + secs.map(function (x) { return '<div class="it"><div class="nm"><b>' + esc(x[0]) + '</b><span>' + esc(x[1]) + '</span></div></div>'; }).join('') + '</div>' +
        '<p class="hint" style="margin-top:12px">No timeline is promised at inquiry. Review is substantive, and every applicant receives the same process.</p></div>' +
        '<div style="display:flex;flex-direction:column;gap:20px">' +
          '<div class="card"><h3>What your chamber commits to</h3><ul class="checklist"><li>Offer the benefits under your own name, at no charge to members</li><li>Keep your member relationships and member records with your chamber</li><li>Represent the program accurately, and never sell or gate access to a benefit offered at no cost</li><li>Continue operating with the standing that earned Acknowledgement</li></ul></div>' +
          '<div class="card"><h3>What PowerChapter commits to</h3><ul class="checklist"><li>Curate The Book and manage the provider relationships</li><li>Apply the standard consistently and document every decision</li><li>Charge your chamber and your members nothing</li><li>Hold no member financial or credit information, ever</li></ul></div>' +
        '</div>' +
      '</div>' +
    '</div></section>' +

    '<section class="section band-dark on-dark"><div class="wrap" style="display:flex;gap:28px;align-items:center;justify-content:space-between;flex-wrap:wrap">' +
      '<div style="max-width:60ch"><span class="eyebrow">Next step</span><h2 style="margin-top:8px">Reputation is the gate. Yours may already qualify.</h2><p class="lede" style="margin-top:10px">If your chamber has served its community with integrity, kept its members, and earned the respect of its peers, it meets the standard. The application takes one sitting.</p></div>' +
      '<div class="hero-actions" style="margin:0"><a class="btn btn-gold" href="https://www.powerchapter.com/apply.html" target="_blank" rel="noopener">Apply for Acknowledgement</a><a class="btn btn-ghost" href="#/standard">Read the Standard</a></div>' +
    '</div></section>';
  }
};
VIEWS.privacy = {
  html: function () {
    return '<section class="page-head"><div class="wrap"><span class="eyebrow">Data, location &amp; privacy</span><h1 style="margin-top:8px">Who holds what, and why</h1><p class="lede">Three organizations are involved in a benefit: PowerChapter, your chamber, and the provider. Each holds a different thing, and the boundaries do not move.</p></div></section>' +
      '<section class="section-tight"><div class="wrap">' +
      '<div class="card"><h3>The boundary</h3><div class="table-wrap"><table class="data"><thead><tr><th>Who</th><th>Holds</th><th>Never holds</th></tr></thead><tbody>' +
        '<tr><td><b>PowerChapter</b></td><td>Your name, email, business name, chapter, and consent record. Before you have an account, only the chapter you picked, kept in your browser.</td><td>Financial or credit information, anything you submit to a provider, your chamber\'s membership records, a location history</td></tr>' +
        '<tr><td><b>Your chamber</b></td><td>Its own membership records, as it always has, plus counts of how many members activated and used a benefit.</td><td>What you submit to a provider, your credit or financial information, your provider results</td></tr>' +
        '<tr><td><b>The provider</b></td><td>Your account with that provider and everything you enter in it, under its own terms and privacy policy.</td><td>Anything from PowerChapter beyond your chapter reference and a one-time reference number</td></tr>' +
      '</tbody></table></div></div>' +
      '<div class="grid-2" style="margin-top:20px">' +
        '<div class="card"><h3>Separate logins, on purpose</h3><p class="muted small">Your PowerChapter membership is one account. Each provider account is another — Zenhur\'s dashboard, for example, is reached at <span class="mono">admin.zenhur.com</span> and is governed by Zenhur\'s own terms. PowerChapter passes a chapter reference so the provider knows which chamber you came from, and nothing else. Signing out of one does not sign you out of the other, and closing one does not close the other.</p><p class="muted small" style="margin-top:10px">This is why the two are kept apart: the work you do inside a provider\'s platform — funding, credit, anything financial — belongs in that provider\'s system, not in a chamber directory.</p></div>' +
        '<div class="card"><h3>How your chapter is chosen</h3><div class="table-wrap"><table class="data"><thead><tr><th>Order</th><th>Signal</th><th>What it does</th></tr></thead><tbody>' +
          '<tr><td class="num">1</td><td>Verified membership</td><td>Your chamber confirmed you. Sets your membership chapter and your benefits.</td></tr>' +
          '<tr><td class="num">2</td><td>Your saved choice</td><td>The chapter you picked. Changes local news and events.</td></tr>' +
          '<tr><td class="num">3</td><td>Device location</td><td>Used only when you tap "Use my current location" and your browser asks permission.</td></tr>' +
          '<tr><td class="num">4</td><td>Approximate location</td><td>Estimated from your internet connection to suggest the nearest chapter. Often off by many miles, so we always ask you to confirm. Not stored.</td></tr>' +
          '<tr><td class="num">5</td><td>Your search</td><td>ZIP, city, county, or chamber name.</td></tr>' +
        '</tbody></table></div><p class="hint" style="margin-top:10px">Location never decides eligibility. Only your chamber\'s verification does.</p></div>' +
      '</div>' +
      '<div class="callout" style="margin-top:20px"><b>Prototype note.</b> Everything in this demo stays in your browser. Nothing is sent anywhere. Use "Demo controls" to reset it.</div>' +
      '</div></section>';
  }
};
VIEWS.notfound = { html: function () { return '<section class="section"><div class="wrap"><h2>Page not found</h2><p class="muted" style="margin:10px 0 18px">That page does not exist in this prototype.</p><a class="btn btn-primary" href="#/">Go home</a></div></section>'; } };

/* ---------------- modal ---------------- */
function modal(title, html, buttons) {
  var m = document.createElement('div'); m.className = 'modal'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true');
  m.innerHTML = '<div class="box"><h3>' + esc(title) + '</h3>' + html + '<div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end">' + buttons.map(function (b, i) { return '<button class="btn ' + b.cls + '" type="button" data-b="' + i + '">' + esc(b.t) + '</button>'; }).join('') + '</div></div>';
  document.body.appendChild(m);
  function close() { m.remove(); document.removeEventListener('keydown', onKey); }
  function onKey(e) { if (e.key === 'Escape') close(); }
  document.addEventListener('keydown', onKey);
  m.addEventListener('click', function (e) { if (e.target === m) close(); var b = e.target.closest('[data-b]'); if (!b) return; var cfg = buttons[+b.dataset.b]; close(); if (cfg.fn) cfg.fn(); if (cfg.go) go(cfg.go); });
  $('[data-b]', m).focus();
}

/* ---------------- prototype controls ---------------- */
function resetAll() { S = { home: null, homeStatus: null, browse: null, browseSrc: null, loc: null, user: null, activated: [], ann: {}, toggles: {}, codes: {}, visited: true }; save(); chrome(); }
function simulateVisitor(v) { setLoc({ lat: v.lat, lng: v.lng, label: v.city }, 'ip'); if (S.browseSrc !== 'member' && S.browseSrc !== 'choice') { S.browse = null; S.browseSrc = null; } suggestFromLoc('ip'); }
function protoPanel() {
  var p = $('#protoPop');
  p.innerHTML = '<span class="lbl">Simulate approximate (IP) location</span><div class="opts">' + C.DEMO_VISITORS.map(function (v, i) { return '<button type="button" data-v="' + i + '">' + esc(v.label) + '</button>'; }).join('') + '</div>' +
    '<span class="lbl">Demo state</span><div class="opts"><button type="button" id="pReset">Reset everything (new visitor)</button></div>' +
    '<p class="hint">In production, approximate location comes from the hosting platform\'s edge headers. Nothing leaves this browser in the prototype.</p>';
  $$('[data-v]', p).forEach(function (b) { b.addEventListener('click', function () { var v = C.DEMO_VISITORS[+b.dataset.v]; if (S.browseSrc === 'choice') { S.browseSrc = 'ip'; } simulateVisitor(v); toast('Simulated visitor: ' + v.city); p.hidden = true; $('#protoFab').setAttribute('aria-expanded', 'false'); FINDER.focus = ''; FINDER.sel = ''; render(); }); });
  $('#pReset').addEventListener('click', function () { resetAll(); FINDER.focus = ''; FINDER.sel = ''; ACT.step = 1; ACT.chapter = null; simulateVisitor(C.DEMO_VISITORS[0]); toast('Reset. Simulating a new visitor from Tampa, FL.'); p.hidden = true; go('#/'); });
}

/* ---------------- boot ---------------- */
$('#chipLoc').addEventListener('click', openDrawer);
$('#scrim').addEventListener('click', closeDrawer);
document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && $('#drawer').classList.contains('open')) closeDrawer(); });
$('#menuBtn').addEventListener('click', function () { var n = $('#mainNav'), o = n.classList.toggle('open'); this.setAttribute('aria-expanded', String(o)); });
$('#protoFab').addEventListener('click', function () { var p = $('#protoPop'); p.hidden = !p.hidden; this.setAttribute('aria-expanded', String(!p.hidden)); if (!p.hidden) protoPanel(); });

if (!S.visited) { S.visited = true; simulateVisitor(C.DEMO_VISITORS[0]); }
render();

})();
