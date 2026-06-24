const WELLS = __WELLS__;
const TITLES = __TITLES__;
const TI = __TI__;
const PROD = __PROD__;
const PIATT = __PIATT__;
const ISTANZE = __ISTANZE__;
const NATPROD = __NATPROD__;
const VIA = __VIA__;
const ECOL = {
  gas: '#e6550d',
  olio: '#31a354',
  misto: '#756bb1',
  indizi: '#3182bd',
  sterile: '#8a8f98',
  altro: '#c3c7cd',
};
const ELAB = {
  gas: 'Gas',
  olio: 'Olio',
  misto: 'Olio + gas',
  indizi: 'Indizi / manifestazioni',
  sterile: 'Non produttivo',
  altro: 'Altro / n.d.',
};
const EORD = ['gas', 'olio', 'misto', 'indizi', 'sterile', 'altro'];

function dec(s) {
  try {
    let v = decodeURIComponent(s);
    try {
      v = decodeURIComponent(v);
    } catch (e) {}
    return v;
  } catch (e) {
    return s;
  }
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

const P = new URLSearchParams(location.search);

if (P.get('mapTitle')) document.getElementById('mtitle').textContent = dec(P.get('mapTitle'));
const chips = [
  ['categoria', P.get('categoria') || 'Energia'],
  ['territorio', P.get('territorio') || 'Italia'],
  ['anno', P.get('anno') || '2026'],
];

if (P.get('autore')) chips.push(['autore', P.get('autore')]);
document.getElementById('chips').innerHTML =
  chips
    .map(function (c) {
      return '<span class="chip">' + esc(c[0]) + ': <b>' + esc(dec(c[1])) + '</b></span>';
    })
    .join('') +
  '<a class="chip" href="https://github.com/gbell27/trivellazioni-italia" target="_blank" style="text-decoration:none;color:var(--amber)">\u2197 repo</a>';

const CARTO = {
  dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
  light: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
  sat: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
};

function tilesFor(k) {
  const u = CARTO[k];
  return k === 'sat' ? [u] : [u.replace('{s}', 'a'), u.replace('{s}', 'b'), u.replace('{s}', 'c')];
}

let baseKey = 'dark';
const map = new maplibregl.Map({
  container: 'map',
  hash: true,
  attributionControl: false,
  style: {
    version: 8,
    sources: {
      carto: {
        type: 'raster',
        tiles: tilesFor('dark'),
        tileSize: 256,
        attribution: '\u00A9 OpenStreetMap, \u00A9 CARTO \u00B7 dati ViDEPI/UNMIG (CC BY 4.0)',
      },
    },
    layers: [{ id: 'base', type: 'raster', source: 'carto' }],
  },
  center: [12.5, 42.2],
  zoom: 5.2,
});

map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-right');
map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');

function polyColor() {
  return [
    'match',
    ['get', 'tipo'],
    'Concessione di coltivazione',
    '#d95f0e',
    'Permesso di ricerca',
    '#2c7fb8',
    '#8856a7',
  ];
}

// area (planare, solo per confronto) di ogni titolo: serve a scegliere l'area piu' piccola quando sono annidate
function _ringArea(r) {
  var a = 0,
    n = r.length;
  for (var i = 0; i < n; i++) {
    var j = (i + 1) % n;
    a += r[i][0] * r[j][1] - r[j][0] * r[i][1];
  }
  return Math.abs(a / 2);
}

function _geomArea(g) {
  if (!g) return 0;
  var s = 0;
  if (g.type === 'Polygon')
    g.coordinates.forEach(function (r) {
      s += _ringArea(r);
    });
  else if (g.type === 'MultiPolygon')
    g.coordinates.forEach(function (p) {
      p.forEach(function (r) {
        s += _ringArea(r);
      });
    });
  return s;
}
var TAREA = {};
TITLES.features.forEach(function (f) {
  var n = f.properties.titolo;
  TAREA[n] = (TAREA[n] || 0) + _geomArea(f.geometry);
});
map.on('load', function () {
  map.addSource('titoli', { type: 'geojson', data: TITLES });
  map.addLayer({
    id: 'titoli-fill',
    type: 'fill',
    source: 'titoli',
    paint: { 'fill-color': polyColor(), 'fill-opacity': 0.16 },
  });
  map.addLayer({
    id: 'titoli-line',
    type: 'line',
    source: 'titoli',
    paint: { 'line-color': polyColor(), 'line-width': 1.2 },
  });
  map.addSource('pozzi', { type: 'geojson', data: WELLS });
  map.addLayer({
    id: 'pozzi',
    type: 'circle',
    source: 'pozzi',
    paint: {
      'circle-color': [
        'match',
        ['get', 'ecls'],
        'gas',
        '#e6550d',
        'olio',
        '#31a354',
        'misto',
        '#756bb1',
        'indizi',
        '#3182bd',
        'sterile',
        '#8a8f98',
        '#c3c7cd',
      ],
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 2, 8, 4, 12, 7],
      'circle-stroke-color': '#111',
      'circle-stroke-width': 0.5,
      'circle-opacity': 0.9,
    },
  });
  // strati MASE extra (nascosti, attivabili dalla toolbar)
  map.addSource('istanze', { type: 'geojson', data: ISTANZE });
  map.addLayer(
    {
      id: 'istanze-fill',
      type: 'fill',
      source: 'istanze',
      layout: { visibility: 'none' },
      paint: { 'fill-color': '#e8c23a', 'fill-opacity': 0.14 },
    },
    'pozzi',
  );
  map.addLayer(
    {
      id: 'istanze-line',
      type: 'line',
      source: 'istanze',
      layout: { visibility: 'none' },
      paint: { 'line-color': '#e8c23a', 'line-width': 1, 'line-dasharray': [2, 1.5] },
    },
    'pozzi',
  );
  map.addSource('piatt', { type: 'geojson', data: PIATT });
  map.addLayer({
    id: 'piatt',
    type: 'circle',
    source: 'piatt',
    layout: { visibility: 'none' },
    paint: {
      'circle-color': '#46b3a4',
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 3, 10, 6],
      'circle-stroke-color': '#fff',
      'circle-stroke-width': 1,
      'circle-opacity': 0.95,
    },
  });
  // un solo click: priorità ai punti (con tolleranza in px), poi le aree
  function nearest(fs, pt) {
    var b = fs[0],
      bd = 1e9;
    fs.forEach(function (f) {
      var c = map.project(f.geometry.coordinates);
      var d = (c.x - pt.x) * (c.x - pt.x) + (c.y - pt.y) * (c.y - pt.y);
      if (d < bd) {
        bd = d;
        b = f;
      }
    });
    return b;
  }
  map.on('click', function (e) {
    var R = 6,
      box = [
        [e.point.x - R, e.point.y - R],
        [e.point.x + R, e.point.y + R],
      ];
    var pts = map.queryRenderedFeatures(box, { layers: ['pozzi', 'piatt'] });
    if (pts.length) {
      var f = nearest(pts, e.point),
        c = f.geometry.coordinates;
      popupAt(
        c,
        (f.layer.id === 'piatt' ? platHTML(f.properties) : wellHTML(f.properties)) + zlink(c),
      );
      return;
    }
    var tf = map.queryRenderedFeatures(e.point, { layers: ['titoli-fill'] });
    if (tf.length) {
      var pick = tf[0].properties.titolo;
      tf.forEach(function (f) {
        var n = f.properties.titolo;
        if ((TAREA[n] || 1e9) < (TAREA[pick] || 1e9)) pick = n;
      });
      popupAt(e.lngLat, titleHTML(pick));
      return;
    }
    var iz = map.queryRenderedFeatures(e.point, { layers: ['istanze-fill'] });
    if (iz.length) {
      popupAt(e.lngLat, istanzaHTML(iz[0].properties));
    }
  });
  ['pozzi', 'piatt', 'titoli-fill', 'istanze-fill'].forEach(function (l) {
    map.on('mouseenter', l, function () {
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', l, function () {
      map.getCanvas().style.cursor = '';
    });
  });
  buildEsiti();
  initDecades();
  initTitolari();
  restoreFromURL();
  apply();
});
function popupAt(lngLat, html) {
  var pp = new maplibregl.Popup({ maxWidth: '320px' })
    .setLngLat(lngLat)
    .setHTML('<div class="pp">' + html + '</div>')
    .addTo(map);
  wireCharts(pp.getElement());
}
function popup(e, html) {
  popupAt(e.lngLat, html);
}
// --- zoom: ai risultati di ricerca e dai popup ---
function extGeom(b, g) {
  if (!g) return;
  if (g.type === 'Point') b.extend(g.coordinates);
  else if (g.type === 'Polygon')
    g.coordinates.forEach(function (r) {
      r.forEach(function (c) {
        b.extend(c);
      });
    });
  else if (g.type === 'MultiPolygon')
    g.coordinates.forEach(function (p) {
      p.forEach(function (r) {
        r.forEach(function (c) {
          b.extend(c);
        });
      });
    });
}
function resultBounds() {
  var b = new maplibregl.LngLatBounds();
  (LASTFEATS || []).forEach(function (f) {
    extGeom(b, f.geometry);
  });
  var q = (document.getElementById('q').value || '').trim().toLowerCase();
  TITLES.features.forEach(function (f) {
    var n = f.properties.titolo;
    if ((LASTALLOWED && LASTALLOWED.has(n)) || (q && n && n.toLowerCase().indexOf(q) >= 0))
      extGeom(b, f.geometry);
  });
  return b;
}
function zoomToCurrent() {
  var b = resultBounds();
  if (b.isEmpty()) return;
  var sw = b.getSouthWest(),
    ne = b.getNorthEast();
  if (sw.lng === ne.lng && sw.lat === ne.lat) {
    map.flyTo({ center: [sw.lng, sw.lat], zoom: 11, speed: 1.2 });
    return;
  }
  map.fitBounds(b, { padding: 70, maxZoom: 12, duration: 900 });
}
window._zoom = function (x, y) {
  map.flyTo({ center: [x, y], zoom: 12, speed: 1.2 });
  return false;
};
function zlink(c) {
  return (
    '<div style="margin-top:6px"><a href="#" onclick="return _zoom(' +
    c[0] +
    ',' +
    c[1] +
    ')">\u2295 Zoom qui</a></div>'
  );
}
function provHTML(list) {
  if (!list || !list.length) return '<span class="k">nessun decreto collegato</span>';
  return (
    '<ul class="pv">' +
    list
      .map(function (p) {
        return (
          '<li><span class="k">' +
          p.data +
          '</span> \u2014 <a href="' +
          p.pdf +
          '" target="_blank">' +
          p.natura +
          '</a></li>'
        );
      })
      .join('') +
    '</ul>'
  );
}
function fmtVol(m, v) {
  var L = function (x, d) {
    return x.toLocaleString('it', { maximumFractionDigits: d });
  };
  if (m === 'Gas') {
    if (v >= 1e9) return L(v / 1e9, 2) + ' mld Sm\u00B3';
    if (v >= 1e6) return L(v / 1e6, 2) + ' Mln Sm\u00B3';
    if (v >= 1e3) return L(v / 1e3, 0) + ' mila Sm\u00B3';
    return L(v, 0) + ' Sm\u00B3';
  }
  if (v >= 1e9) return L(v / 1e9, 2) + ' Mt';
  if (v >= 1e3) return L(v / 1e3, 0) + ' t';
  return L(v, 0) + ' kg';
}
function buildLine(s, color, minKey, w, h, pl, pr, pt, pb, axis) {
  if (!s || s.length < 2) return '';
  var ys = s.map(function (d) {
    return d[1];
  });
  var mx = Math.max.apply(null, ys) || 1;
  var mi = ys.indexOf(mx);
  var x0 = s[0][0],
    x1 = s[s.length - 1][0],
    dx = x1 - x0 || 1;
  function X(yr) {
    return pl + ((yr - x0) / dx) * (w - pl - pr);
  }
  function Y(v) {
    return h - pb - (v / mx) * (h - pb - pt);
  }
  var pts = s
    .map(function (d) {
      return X(d[0]).toFixed(1) + ',' + Y(d[1]).toFixed(1);
    })
    .join(' ');
  var L = s[s.length - 1];
  var sz = axis ? 'width="100%"' : 'width="' + w + '" height="' + h + '"';
  var o =
    '<svg class="ichart" viewBox="0 0 ' +
    w +
    ' ' +
    h +
    '" ' +
    sz +
    ' style="display:block;margin:' +
    (axis ? '2px 0 12px' : '2px 0 2px') +
    ';overflow:visible;touch-action:none;cursor:crosshair"' +
    " data-s='" +
    JSON.stringify(s) +
    '\' data-m="' +
    minKey +
    '" data-w="' +
    w +
    '" data-pl="' +
    pl +
    '" data-pr="' +
    pr +
    '" data-pt="' +
    pt +
    '" data-pb="' +
    pb +
    '" data-mx="' +
    mx +
    '">' +
    '<line x1="' +
    pl +
    '" y1="' +
    (h - pb) +
    '" x2="' +
    (w - pr) +
    '" y2="' +
    (h - pb) +
    '" stroke="#33414b" stroke-width="1"/>';
  if (axis)
    o +=
      '<text x="' +
      (pl - 5) +
      '" y="' +
      (h - pb) +
      '" fill="#7f8b94" font-size="9" text-anchor="end">0</text>';
  o +=
    '<polyline points="' +
    pts +
    '" fill="none" stroke="' +
    color +
    '" stroke-width="2"/>' +
    '<circle cx="' +
    X(s[mi][0]).toFixed(1) +
    '" cy="' +
    Y(mx).toFixed(1) +
    '" r="2" fill="#e0902f"/>' +
    '<text x="' +
    X(s[mi][0]).toFixed(1) +
    '" y="' +
    (Y(mx) - 3).toFixed(1) +
    '" fill="#e0902f" font-size="8.5" text-anchor="middle">picco ' +
    fmtVol(minKey, mx) +
    '</text>' +
    '<circle cx="' +
    X(L[0]).toFixed(1) +
    '" cy="' +
    Y(L[1]).toFixed(1) +
    '" r="2.5" fill="' +
    color +
    '"/>' +
    '<text x="' +
    pl +
    '" y="' +
    (h - 3) +
    '" fill="#7f8b94" font-size="8.5">' +
    x0 +
    '</text>' +
    '<text x="' +
    (w - pr) +
    '" y="' +
    (h - 3) +
    '" fill="#7f8b94" font-size="8.5" text-anchor="end">' +
    x1 +
    '</text>' +
    '<line class="sl" x1="0" y1="' +
    pt +
    '" x2="0" y2="' +
    (h - pb) +
    '" stroke="#cdd6dd" stroke-width="1" stroke-dasharray="2 2" visibility="hidden"/>' +
    '<circle class="sd" r="3" fill="' +
    color +
    '" stroke="#0d1116" stroke-width="1" visibility="hidden"/>' +
    '<text class="sv" y="10" font-size="9.5" text-anchor="middle" style="paint-order:stroke" stroke="#0d1116" stroke-width="3" fill="#e8edf1" visibility="hidden"></text></svg>';
  return o;
}
function spark(series, dom, color) {
  return buildLine(series, color || '#46b3a4', dom, 232, 66, 8, 10, 16, 16, false);
}
function wireCharts(root) {
  if (!root) return;
  root.querySelectorAll('svg.ichart').forEach(function (svg) {
    if (svg._w) return;
    svg._w = 1;
    var s = JSON.parse(svg.getAttribute('data-s')),
      m = svg.getAttribute('data-m');
    var w = +svg.getAttribute('data-w'),
      pl = +svg.getAttribute('data-pl'),
      pr = +svg.getAttribute('data-pr'),
      pt = +svg.getAttribute('data-pt'),
      pb = +svg.getAttribute('data-pb'),
      mx = +svg.getAttribute('data-mx');
    var h = svg.viewBox.baseVal.height,
      x0 = s[0][0],
      x1 = s[s.length - 1][0],
      dx = x1 - x0 || 1;
    function X(yr) {
      return pl + ((yr - x0) / dx) * (w - pl - pr);
    }
    function Y(v) {
      return h - pb - (v / mx) * (h - pb - pt);
    }
    var sl = svg.querySelector('.sl'),
      sd = svg.querySelector('.sd'),
      sv = svg.querySelector('.sv');
    function at(cx) {
      var bi = 0,
        bd = 1e9;
      for (var i = 0; i < s.length; i++) {
        var d = Math.abs(X(s[i][0]) - cx);
        if (d < bd) {
          bd = d;
          bi = i;
        }
      }
      var px = X(s[bi][0]),
        py = Y(s[bi][1]);
      sl.setAttribute('x1', px);
      sl.setAttribute('x2', px);
      sl.setAttribute('visibility', 'visible');
      sd.setAttribute('cx', px);
      sd.setAttribute('cy', py);
      sd.setAttribute('visibility', 'visible');
      sv.setAttribute('x', Math.max(pl + 24, Math.min(w - pr - 24, px)));
      sv.textContent = s[bi][0] + ': ' + fmtVol(m, s[bi][1]);
      sv.setAttribute('visibility', 'visible');
    }
    function vb(e) {
      var r = svg.getBoundingClientRect(),
        cx = e.touches ? e.touches[0].clientX : e.clientX;
      return ((cx - r.left) / r.width) * w;
    }
    function go(e) {
      at(vb(e));
      if (e.cancelable) e.preventDefault();
    }
    svg.addEventListener('pointerdown', go);
    svg.addEventListener('pointermove', go);
    svg.addEventListener('pointerleave', function (e) {
      if (e.pointerType === 'mouse') {
        sl.setAttribute('visibility', 'hidden');
        sd.setAttribute('visibility', 'hidden');
        sv.setAttribute('visibility', 'hidden');
      }
    });
  });
  root.querySelectorAll('svg.ibar').forEach(function (svg) {
    if (svg._w) return;
    svg._w = 1;
    var s = JSON.parse(svg.getAttribute('data-s')),
      bin = svg.getAttribute('data-bin'),
      w = +svg.getAttribute('data-w'),
      pl = +svg.getAttribute('data-pl'),
      pr = +svg.getAttribute('data-pr');
    var n = s.length,
      bw = (w - pl - pr) / n,
      hl = svg.querySelector('.bh'),
      sv = svg.querySelector('.sv');
    function at(cx) {
      var i = Math.floor((cx - pl) / bw);
      if (i < 0) i = 0;
      if (i >= n) i = n - 1;
      hl.setAttribute('x', (pl + i * bw).toFixed(1));
      hl.setAttribute('width', bw.toFixed(1));
      hl.setAttribute('visibility', 'visible');
      sv.setAttribute('x', Math.max(pl + 34, Math.min(w - pr - 34, pl + i * bw + bw / 2)));
      sv.textContent =
        bin === 'year'
          ? s[i][0] + ': ' + s[i][1] + ' pozzi'
          : 'anni ' + s[i][0] + '\u2013' + (s[i][0] + 9) + ': ' + s[i][1] + ' pozzi';
      sv.setAttribute('visibility', 'visible');
    }
    function vb(e) {
      var r = svg.getBoundingClientRect(),
        cx = e.touches ? e.touches[0].clientX : e.clientX;
      return ((cx - r.left) / r.width) * w;
    }
    function go(e) {
      at(vb(e));
      if (e.cancelable) e.preventDefault();
    }
    svg.addEventListener('pointerdown', go);
    svg.addEventListener('pointermove', go);
    svg.addEventListener('pointerleave', function (e) {
      if (e.pointerType === 'mouse') {
        hl.setAttribute('visibility', 'hidden');
        sv.setAttribute('visibility', 'hidden');
      }
    });
  });
}
var MINCOL = { Gas: '#e6550d', Olio: '#31a354', Gasolina: '#9c8cc4', GPL: '#c3a06b' };
function prodBlock(name) {
  var pr = PROD[name];
  if (!pr)
    return '<div class="k" style="margin-top:6px">Nessun dato di produzione per il titolo</div>';
  var stato = pr.attivo
    ? '<span style="color:#46b3a4">attivo</span>'
    : '<span class="k">non attivo di recente</span>';
  var smin = pr.smin || {};
  var mins = Object.keys(smin);
  mins.sort(function (a, b) {
    var sa = smin[a].reduce(function (t, d) {
        return t + d[1];
      }, 0),
      sb = smin[b].reduce(function (t, d) {
        return t + d[1];
      }, 0);
    return sb - sa;
  });
  var body = mins
    .map(function (m) {
      var s = smin[m];
      var c = MINCOL[m] || '#46b3a4';
      var oggi =
        pr.lyt && pr.lyt[m] != null ? ' \u00B7 ' + pr.ly + ': ' + fmtVol(m, pr.lyt[m]) : '';
      return (
        '<div class="k" style="font-size:10.5px;margin-top:5px"><span style="color:' +
        c +
        '">\u25CF</span> ' +
        m +
        oggi +
        '</div>' +
        spark(s, m, c)
      );
    })
    .join('');
  return (
    '<div class="k" style="margin-top:8px">PRODUZIONE DEL TITOLO <span style="font-weight:400;color:var(--faint)">(intero campo, non il singolo pozzo)</span> \u00B7 ' +
    stato +
    '</div>' +
    (body || '<div class="k">serie non disponibile</div>')
  );
}
function titleBlock(name, withProd) {
  const t = TI[name];
  if (!t) return '';
  return (
    '<div class="k" style="margin-top:6px">TITOLO</div><b>' +
    name +
    '</b><br>' +
    (t.tipo || '') +
    '<br><span class="k">Titolari:</span> ' +
    (t.titolari || '\u2014') +
    '<br><span class="k">Conferimento:</span> ' +
    (t.conferimento || '\u2014') +
    '<br><span class="k">Stato:</span> ' +
    (t.vigenza || '\u2014') +
    (withProd === false ? '' : prodBlock(name)) +
    '<div class="k" style="margin-top:6px">DECRETI</div>' +
    provHTML(t.provv)
  );
}
function titleHTML(name) {
  return titleBlock(name) || '<b>' + name + '</b>';
}
function wellHTML(p) {
  let h =
    '<b>' +
    p.nome +
    '</b> <span class="k">(' +
    (p.anno || '?') +
    ' \u00B7 ' +
    (p.tm || '') +
    ')</span><br><span class="k">Esito:</span> ' +
    p.esito +
    '<br><span class="k">Scopo:</span> ' +
    p.scopo +
    '<br><span class="k">Profondit\u00E0:</span> ' +
    (p.prof != null ? p.prof + ' m' : '\u2014') +
    '<br><span class="k">Operatore:</span> ' +
    (p.op || '\u2014');
  if (p.pdf)
    h += '<br><a href="' + p.pdf + '" target="_blank">Scheda del pozzo \u2014 ViDEPI \u2197</a>';
  h += p.titolo
    ? titleBlock(p.titolo, false)
    : '<div class="k" style="margin-top:6px">Titolo non pi\u00F9 vigente (cessato)</div>' +
      (p.pdf ? '' : '<span class="k">storia negli archivi ViDEPI</span>');
  return h;
}
function platHTML(p) {
  return (
    '<b>' +
    p.nome +
    '</b> <span class="k">(piattaforma marina)</span><br><span class="k">Operatore:</span> ' +
    (p.op || '\u2014') +
    '<br><span class="k">Minerale:</span> ' +
    (p.min || '\u2014') +
    '<br><span class="k">Anno:</span> ' +
    (p.anno || '\u2014') +
    (p.dist ? '<br><span class="k">Distanza costa:</span> ' + p.dist + ' km' : '') +
    (p.titolo ? '<br><span class="k">Titolo:</span> ' + p.titolo : '')
  );
}
var ISTANZE_FONTE =
  'https://unmig.mase.gov.it/ricerca-e-coltivazione-di-idrocarburi/elenco-dei-titoli-minerari/';
function istanzaHTML(p) {
  var vk = (p.nome || '').toLowerCase().split(/\s+/).join(' ').trim(),
    vu = VIA[vk];
  return (
    '<div class="k">ISTANZA \u2014 nuovo titolo</div><b>' +
    p.nome +
    '</b><br>' +
    (p.tipo || '') +
    '<br><span class="k">Presentata:</span> ' +
    (p.data || '\u2014') +
    '<br><span class="k">Superficie:</span> ' +
    (p.sup ? p.sup + ' km\u00B2' : '\u2014') +
    '<br><span class="k">Richiedente:</span> ' +
    (p.rich || '\u2014') +
    (p.loc ? '<br><span class="k">Ubicazione:</span> ' + p.loc : '') +
    (vu
      ? '<div class="k" style="margin-top:6px">PROCEDURA AMBIENTALE</div><a href="' +
        vu +
        '" target="_blank">Procedura VIA/VAS \u2014 va.mite.gov.it \u2197</a>'
      : '') +
    '<div class="k" style="margin-top:6px">DOCUMENTO</div><a href="' +
    ISTANZE_FONTE +
    '" target="_blank">Registro istanze e titoli \u2014 UNMIG \u2197</a>'
  );
}
function buildEsiti() {
  const d = document.getElementById('esiti');
  var cnt = {};
  WELLS.features.forEach(function (f) {
    var k = f.properties.ecls;
    cnt[k] = (cnt[k] || 0) + 1;
  });
  EORD.forEach(function (k) {
    if (!cnt[k]) return;
    const el = document.createElement('label');
    el.className = 'chk';
    el.dataset.k = k;
    el.innerHTML =
      '<span class="dot" style="background:' +
      ECOL[k] +
      '"></span>' +
      ELAB[k] +
      ' <span style="color:var(--faint);font:10px var(--mono)">' +
      cnt[k].toLocaleString('it') +
      '</span>';
    el.addEventListener('click', function () {
      el.classList.toggle('off');
      apply();
    });
    d.appendChild(el);
  });
}
function activeEsiti() {
  const s = new Set();
  document.querySelectorAll('#esiti .chk').forEach(function (e) {
    if (!e.classList.contains('off')) s.add(e.dataset.k);
  });
  return s;
}
function initDecades() {
  const ys = WELLS.features
    .map(function (f) {
      return f.properties.anno;
    })
    .filter(function (x) {
      return x != null;
    });
  const lo = Math.min.apply(null, ys),
    hi = Math.max.apply(null, ys);
  ['dmin', 'dmax'].forEach(function (id, i) {
    const el = document.getElementById(id);
    el.min = lo;
    el.max = hi;
    el.step = 1;
    el.value = i ? hi : lo;
    document.getElementById(id + 'L').textContent = el.value;
  });
}
function initTitolari() {
  const c = {};
  Object.values(TI).forEach(function (t) {
    (t.holders || []).forEach(function (h) {
      c[h] = (c[h] || 0) + 1;
    });
  });
  const names = Object.keys(c).sort();
  const box = document.getElementById('titlist');
  box.innerHTML = names
    .map(function (n) {
      return (
        '<label><input type="checkbox" class="th" value="' +
        n.replace(/"/g, '&quot;') +
        '">' +
        n +
        '<span class="n">' +
        c[n] +
        '</span></label>'
      );
    })
    .join('');
  box.querySelectorAll('.th').forEach(function (cb) {
    cb.addEventListener('change', apply);
  });
}
function selectedHolders() {
  return Array.prototype.slice
    .call(document.querySelectorAll('#titlist .th:checked'))
    .map(function (c) {
      return c.value;
    });
}
var LASTFEATS = [],
  LASTALLOWED = null;
function apply() {
  const es = activeEsiti();
  const dmin = +document.getElementById('dmin').value,
    dmax = +document.getElementById('dmax').value;
  const onlyT = document.getElementById('onlyT').checked;
  const q = document.getElementById('q').value.trim().toLowerCase();
  const onlyProd = document.getElementById('onlyProd').checked;
  const selH = selectedHolders();
  let allowed = null;
  if (selH.length) {
    allowed = new Set();
    Object.keys(TI).forEach(function (name) {
      const hs = TI[name].holders || [];
      if (
        hs.some(function (h) {
          return selH.indexOf(h) >= 0;
        })
      )
        allowed.add(name);
    });
  }
  if (onlyProd) {
    var ps = new Set(
      Object.keys(PROD).filter(function (k) {
        return PROD[k].attivo;
      }),
    );
    allowed = allowed
      ? new Set(
          Array.from(allowed).filter(function (x) {
            return ps.has(x);
          }),
        )
      : ps;
  }
  const feats = WELLS.features.filter(function (f) {
    const p = f.properties;
    if (!es.has(p.ecls)) return false;
    if (p.anno != null && (p.anno < dmin || p.anno > dmax)) return false;
    if (onlyT && !p.titolo) return false;
    if (allowed && (!p.titolo || !allowed.has(p.titolo))) return false;
    if (
      q &&
      !(
        (p.nome || '').toLowerCase().indexOf(q) >= 0 ||
        (p.titolo || '').toLowerCase().indexOf(q) >= 0 ||
        (p.op || '').toLowerCase().indexOf(q) >= 0 ||
        (p.prov || '').toLowerCase().indexOf(q) >= 0
      )
    )
      return false;
    return true;
  });
  map.getSource('pozzi').setData({ type: 'FeatureCollection', features: feats });
  // Le aree (titoli) seguono gli stessi filtri trasversali dei pozzi: titolari/onlyProd (allowed)
  // e la ricerca q (per nome del titolo, per titolare, o se contengono un pozzo filtrato).
  let titleSet = allowed;
  if (q) {
    const wt = new Set(
      feats
        .map(function (f) {
          return f.properties.titolo;
        })
        .filter(Boolean),
    );
    const qs = new Set();
    Object.keys(TI).forEach(function (name) {
      const hs = TI[name].holders || [];
      if (
        name.toLowerCase().indexOf(q) >= 0 ||
        wt.has(name) ||
        hs.some(function (h) {
          return (h || '').toLowerCase().indexOf(q) >= 0;
        })
      )
        qs.add(name);
    });
    titleSet = titleSet
      ? new Set(
          Array.from(titleSet).filter(function (x) {
            return qs.has(x);
          }),
        )
      : qs;
  }
  if (titleSet) {
    const list = Array.from(titleSet);
    map.setFilter('titoli-fill', ['in', ['get', 'titolo'], ['literal', list]]);
    map.setFilter('titoli-line', ['in', ['get', 'titolo'], ['literal', list]]);
  } else {
    map.setFilter('titoli-fill', null);
    map.setFilter('titoli-line', null);
  }
  const nAree = titleSet ? titleSet.size : TITLES.features.length;
  document.getElementById('count').textContent = feats.length.toLocaleString('it');
  document.getElementById('cntlbl').textContent = 'pozzi \u00B7 ' + nAree + ' aree';
  LASTFEATS = feats;
  LASTALLOWED = allowed;
  syncURL();
}
function syncURL() {
  var p = new URLSearchParams(location.search);
  var act = Array.from(activeEsiti());
  var nEsiti = document.querySelectorAll('#esiti .chk').length;
  act.length === nEsiti ? p.delete('esito') : p.set('esito', act.join(',')); 
  var dn = document.getElementById('dmin'),
    dx = document.getElementById('dmax');
  +dn.value > +dn.min ? p.set('dmin', dn.value) : p.delete('dmin');
  +dx.value < +dx.max ? p.set('dmax', dx.value) : p.delete('dmax');
  document.getElementById('onlyT').checked ? p.set('t', '1') : p.delete('t');
  document.getElementById('onlyProd').checked ? p.set('prod', '1') : p.delete('prod');
  var sel = selectedHolders();
  sel.length ? p.set('tit', sel.join('|')) : p.delete('tit');
  var q = document.getElementById('q').value.trim();
  q ? p.set('q', q) : p.delete('q');
  var vis = Object.keys(LAYERS).filter(layerVisible);
  var defv = Object.keys(LAYERS).filter(function (k) {
    return LAYERS[k].def;
  });
  vis.slice().sort().join(',') === defv.slice().sort().join(',')
    ? p.delete('lay')
    : p.set('lay', vis.join(','));
  var qs = p.toString();
  history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + location.hash);
}
function restoreFromURL() {
  var p = new URLSearchParams(location.search);
  if (p.has('esito')) {
    var on = new Set(p.get('esito').split(','));
    document.querySelectorAll('#esiti .chk').forEach(function (e) {
      e.classList.toggle('off', !on.has(e.dataset.k));
    });
  }
  if (p.has('dmin')) {
    var d = document.getElementById('dmin');
    d.value = p.get('dmin');
    document.getElementById('dminL').textContent = d.value;
  }
  if (p.has('dmax')) {
    var d2 = document.getElementById('dmax');
    d2.value = p.get('dmax');
    document.getElementById('dmaxL').textContent = d2.value;
  }
  document.getElementById('onlyT').checked = p.get('t') === '1';
  document.getElementById('onlyProd').checked = p.get('prod') === '1';
  if (p.has('tit')) {
    var want = new Set(p.get('tit').split('|'));
    document.querySelectorAll('#titlist .th').forEach(function (c) {
      c.checked = want.has(c.value);
    });
  }
  if (p.has('q')) document.getElementById('q').value = p.get('q');
  if (p.has('lay')) {
    var laySet = new Set(p.get('lay').split(',').filter(Boolean));
    Object.keys(LAYERS).forEach(function (key) {
      setLayer(key, laySet.has(key));
    });
  }
}
['dmin', 'dmax'].forEach(function (id) {
  document.getElementById(id).addEventListener('input', function () {
    document.getElementById(id + 'L').textContent = this.value;
    apply();
  });
});
document.getElementById('onlyT').addEventListener('change', apply);
document.getElementById('onlyProd').addEventListener('change', apply);
document.getElementById('q').addEventListener('input', apply);
document.getElementById('q').addEventListener('keydown', function (e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    zoomToCurrent();
  }
});
document.getElementById('b-zoomres').addEventListener('click', function () {
  zoomToCurrent();
});
document.getElementById('reset').addEventListener('click', function () {
  document.querySelectorAll('#esiti .chk').forEach(function (e) {
    e.classList.remove('off');
  });
  initDecades();
  document.querySelectorAll('#titlist .th').forEach(function (c) {
    c.checked = false;
  });
  document.getElementById('onlyT').checked = false;
  document.getElementById('onlyProd').checked = false;
  document.getElementById('q').value = '';
  apply();
  zoomToCurrent();
});
// ---- livelli: toggle + stato condiviso nell'URL ----
var LAYERS = {
  pozzi: { ids: ['pozzi'], btn: 'b-pozzi', def: true },
  aree: { ids: ['titoli-fill', 'titoli-line'], btn: 'b-poly', def: true },
  piatt: { ids: ['piatt'], btn: 'b-piatt', def: false },
  istanze: { ids: ['istanze-fill', 'istanze-line'], btn: 'b-istanze', def: false },
};
function layerVisible(key) {
  return map.getLayoutProperty(LAYERS[key].ids[0], 'visibility') !== 'none';
}
function setLayer(key, on) {
  LAYERS[key].ids.forEach(function (i) {
    map.setLayoutProperty(i, 'visibility', on ? 'visible' : 'none');
  });
  document.getElementById(LAYERS[key].btn).classList.toggle('on', on);
}
Object.keys(LAYERS).forEach(function (key) {
  document.getElementById(LAYERS[key].btn).addEventListener('click', function () {
    setLayer(key, !layerVisible(key));
    syncURL();
  });
});
document.getElementById('b-base').addEventListener('click', function () {
  baseKey = baseKey === 'dark' ? 'light' : baseKey === 'light' ? 'sat' : 'dark';
  map.getSource('carto').setTiles(tilesFor(baseKey));
  document.body.style.setProperty('--bg', baseKey === 'light' ? '#f0f4f8' : '#1a1a1a');
});
const modal = document.getElementById('modal');
document.getElementById('b-info').addEventListener('click', function () {
  modal.classList.add('show');
});
document.getElementById('b-close').addEventListener('click', function () {
  modal.classList.remove('show');
});
modal.addEventListener('click', function (e) {
  if (e.target === modal) modal.classList.remove('show');
});
document.querySelectorAll('.mbox .tabs button').forEach(function (b) {
  b.addEventListener('click', function () {
    document.querySelectorAll('.mbox .tabs button').forEach(function (x) {
      x.classList.remove('on');
    });
    b.classList.add('on');
    document.querySelectorAll('.mbox section').forEach(function (s) {
      s.classList.remove('on');
    });
    document.getElementById(b.dataset.t).classList.add('on');
  });
});

// --- pannello laterale: chiudi/mostra (utile da mobile) ---
document.getElementById('b-panel-close').addEventListener('click', function () {
  document.body.classList.add('panel-hidden');
});
document.getElementById('b-panel-open').addEventListener('click', function () {
  document.body.classList.remove('panel-hidden');
});

// --- ANDAMENTO NAZIONALE: produzione per minerale + pozzi per decennio ---
function decadeBars() {
  var c = {};
  WELLS.features.forEach(function (f) {
    var a = f.properties.anno;
    if (a) {
      var d = Math.floor(a / 10) * 10;
      c[d] = (c[d] || 0) + 1;
    }
  });
  var ks = Object.keys(c)
    .map(Number)
    .sort(function (a, b) {
      return a - b;
    });
  var out = [];
  for (var y = ks[0]; y <= ks[ks.length - 1]; y += 10) out.push([y, c[y] || 0]);
  return out;
}
function yearBars() {
  var c = {},
    mn = 1e9,
    mx = -1e9;
  WELLS.features.forEach(function (f) {
    var a = f.properties.anno;
    if (a) {
      c[a] = (c[a] || 0) + 1;
      if (a < mn) mn = a;
      if (a > mx) mx = a;
    }
  });
  var out = [];
  for (var y = mn; y <= mx; y++) out.push([y, c[y] || 0]);
  return out;
}
function drawPoz(m) {
  var year = m === 'year';
  document.getElementById('pozChart').innerHTML = barChart(
    year ? yearBars() : decadeBars(),
    '#46b3a4',
    year ? 'year' : 'decade',
  );
}
function barChart(pairs, color, bin) {
  bin = bin || 'decade';
  var w = 320,
    h = 146,
    pl = 34,
    pr = 10,
    pt = 20,
    pb = 26;
  var mx =
    Math.max.apply(
      null,
      pairs.map(function (p) {
        return p[1];
      }),
    ) || 1;
  var n = pairs.length;
  var bw = (w - pl - pr) / n;
  var gap = Math.max(0, Math.min(2, bw * 0.3));
  var bars = pairs
    .map(function (p, i) {
      var x = pl + i * bw;
      var bh = (p[1] / mx) * (h - pb - pt);
      return (
        '<rect x="' +
        (x + gap / 2).toFixed(1) +
        '" y="' +
        (h - pb - bh).toFixed(1) +
        '" width="' +
        (bw - gap).toFixed(1) +
        '" height="' +
        bh.toFixed(1) +
        '" fill="' +
        color +
        '"/>'
      );
    })
    .join('');
  var labs = pairs
    .map(function (p, i) {
      var show = bin === 'year' ? p[0] % 20 === 0 : i % 2 === 0;
      return show
        ? '<text x="' +
            (pl + i * bw + bw / 2).toFixed(1) +
            '" y="' +
            (h - 8) +
            '" fill="#7f8b94" font-size="8.5" text-anchor="middle">' +
            p[0] +
            '</text>'
        : '';
    })
    .join('');
  return (
    '<svg class="ibar" viewBox="0 0 ' +
    w +
    ' ' +
    h +
    '" width="100%" style="display:block;margin:2px 0 6px;touch-action:none;cursor:crosshair"' +
    " data-s='" +
    JSON.stringify(pairs) +
    '\' data-w="' +
    w +
    '" data-pl="' +
    pl +
    '" data-pr="' +
    pr +
    '" data-pt="' +
    pt +
    '" data-pb="' +
    pb +
    '" data-bin="' +
    bin +
    '">' +
    '<text x="' +
    (pl - 4) +
    '" y="' +
    pt +
    '" fill="#7f8b94" font-size="9" text-anchor="end">' +
    mx +
    '</text>' +
    '<line x1="' +
    pl +
    '" y1="' +
    (h - pb) +
    '" x2="' +
    (w - pr) +
    '" y2="' +
    (h - pb) +
    '" stroke="#33414b"/>' +
    bars +
    '<rect class="bh" y="' +
    pt +
    '" height="' +
    (h - pb - pt) +
    '" fill="#ffffff" opacity="0.12" visibility="hidden"/>' +
    labs +
    '<text class="sv" y="12" font-size="9.5" text-anchor="middle" style="paint-order:stroke" stroke="#0d1116" stroke-width="3" fill="#e8edf1" visibility="hidden"></text></svg>'
  );
}
var trendDone = false;
function renderTrend() {
  var g = NATPROD.Gas || [],
    o = NATPROD.Olio || [];
  var h = '';
  h +=
    '<div class="h3row"><h3>Numero di pozzi perforati nel tempo</h3>' +
    '<span class="seg"><button class="on" data-m="year">anno</button>' +
    '<button data-m="dec">decennio</button></span></div><div id="pozChart"></div>';
  h +=
    '<h3>Gas \u2014 produzione nazionale annua</h3>' +
    (g.length
      ? buildLine(g, '#e6550d', 'Gas', 320, 150, 58, 12, 18, 26, true)
      : '<div class="k">n.d.</div>');
  h +=
    '<h3>Olio \u2014 produzione nazionale annua</h3>' +
    (o.length
      ? buildLine(o, '#31a354', 'Olio', 320, 150, 58, 12, 18, 26, true)
      : '<div class="k">n.d.</div>');
  document.getElementById('trendBody').innerHTML = h;
  drawPoz('year');
  wireCharts(document.getElementById('trendBody'));
  var seg = document.querySelector('#trendBody .seg');
  if (seg)
    seg.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      seg.querySelectorAll('button').forEach(function (x) {
        x.classList.remove('on');
      });
      b.classList.add('on');
      drawPoz(b.getAttribute('data-m'));
      wireCharts(document.getElementById('trendBody'));
    });
}
var trend = document.getElementById('trend');
document.getElementById('b-trend').addEventListener('click', function () {
  if (!trendDone) {
    renderTrend();
    trendDone = true;
  }
  trend.classList.add('show');
});
document.getElementById('b-trend-close').addEventListener('click', function () {
  trend.classList.remove('show');
});
trend.addEventListener('click', function (e) {
  if (e.target === trend) trend.classList.remove('show');
});
