/* Inspecteur pour les cours.
   Un bouton « Inspecter » flotte en bas à gauche de chaque page (ordinateur seulement).
   - Survoler un élément : marges en orange, padding en vert, tailles écrites dans le CSS, police.
   - Cliquer : sélectionne l'élément. Survoler un autre élément : distance entre les deux.
   - Échap : désélectionne. Re-cliquer sur le bouton : arrête l'inspection.
   Le mode reste allumé d'une page à l'autre. ?inspect dans l'adresse l'allume directement. */
(function () {
  // Pas de survol sur téléphone et tablette : on n'affiche rien.
  if (!window.matchMedia || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  var COL = {
    marge: '#f6a35b', margeFond: 'rgba(246, 163, 91, .32)',
    padding: '#6fcf87', paddingFond: 'rgba(111, 207, 135, .32)',
    contenu: '#5b8cff', mesure: '#ff4d7d', fond: '#16181d', bord: '#5a6070', texte: '#f2f3f5', doux: '#9aa0ad'
  };
  var FONT = 'font-family:system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;';
  var KEY = 'inspecteur-actif';

  var on = false, selected = null, hovered = null, mouseX = -1, mouseY = -1;
  var layer, panel, button;

  function make(tag, css, parent, html) {
    var e = document.createElement(tag);
    e.style.cssText = css;
    if (html) e.innerHTML = html;
    (parent || layer).appendChild(e);
    return e;
  }

  function n(v) { return Math.round(parseFloat(v) || 0); }

  function store(v) { try { localStorage.setItem(KEY, v ? '1' : '0'); } catch (e) {} }
  function stored() { try { return localStorage.getItem(KEY) === '1'; } catch (e) { return false; } }

  /* ---------- Dessin sur la page ---------- */

  function rect(r, css) {
    if (r.w <= 0 || r.h <= 0) return;
    make('div', 'position:fixed;left:' + r.x + 'px;top:' + r.y + 'px;width:' + r.w + 'px;height:' + r.h + 'px;' + css);
  }

  // Les 4 bandes entre un cadre extérieur et un cadre intérieur.
  function bands(o, i, fill) {
    rect({ x: o.x, y: o.y, w: o.w, h: i.y - o.y }, 'background:' + fill);
    rect({ x: o.x, y: i.y + i.h, w: o.w, h: o.y + o.h - i.y - i.h }, 'background:' + fill);
    rect({ x: o.x, y: i.y, w: i.x - o.x, h: i.h }, 'background:' + fill);
    rect({ x: i.x + i.w, y: i.y, w: o.x + o.w - i.x - i.w, h: i.h }, 'background:' + fill);
  }

  function chip(text, x, y, color) {
    make('div', 'position:fixed;left:' + x + 'px;top:' + y + 'px;transform:translate(-50%,-50%);padding:2px 6px;border-radius:4px;background:' + color + ';color:#fff;' + FONT + 'font-size:11px;font-weight:600;line-height:1.3;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,.3);', null, text);
  }

  function boxes(node) {
    var r = node.getBoundingClientRect(), s = getComputedStyle(node);
    var m = { t: n(s.marginTop), r: n(s.marginRight), b: n(s.marginBottom), l: n(s.marginLeft) };
    var p = { t: n(s.paddingTop), r: n(s.paddingRight), b: n(s.paddingBottom), l: n(s.paddingLeft) };
    var bw = { t: n(s.borderTopWidth), r: n(s.borderRightWidth), b: n(s.borderBottomWidth), l: n(s.borderLeftWidth) };
    var border = { x: r.left, y: r.top, w: r.width, h: r.height };
    var outer = { x: border.x - m.l, y: border.y - m.t, w: border.w + m.l + m.r, h: border.h + m.t + m.b };
    var pad = { x: border.x + bw.l, y: border.y + bw.t, w: border.w - bw.l - bw.r, h: border.h - bw.t - bw.b };
    var content = { x: pad.x + p.l, y: pad.y + p.t, w: pad.w - p.l - p.r, h: pad.h - p.t - p.b };
    return { border: border, outer: outer, pad: pad, content: content, m: m, p: p, s: s };
  }

  function line(x1, y1, x2, y2) {
    var len = Math.round(Math.abs(x2 - x1) + Math.abs(y2 - y1));
    if (len < 1) return;
    if (y1 === y2) rect({ x: Math.min(x1, x2), y: y1, w: Math.abs(x2 - x1), h: 1 }, 'background:' + COL.mesure);
    else rect({ x: x1, y: Math.min(y1, y2), w: 1, h: Math.abs(y2 - y1) }, 'background:' + COL.mesure);
    chip(len + ' px', (x1 + x2) / 2, (y1 + y2) / 2, COL.mesure);
  }

  function distances(a, b) {
    var A = a.getBoundingClientRect(), B = b.getBoundingClientRect();
    var cx = A.left + A.width / 2, cy = A.top + A.height / 2;
    if (A.left >= B.left && A.right <= B.right && A.top >= B.top && A.bottom <= B.bottom) {
      line(cx, B.top, cx, A.top); line(cx, A.bottom, cx, B.bottom);
      line(B.left, cy, A.left, cy); line(A.right, cy, B.right, cy);
      return;
    }
    var mx = (Math.max(A.left, B.left) + Math.min(A.right, B.right)) / 2;
    var my = (Math.max(A.top, B.top) + Math.min(A.bottom, B.bottom)) / 2;
    if (B.top >= A.bottom) line(mx, A.bottom, mx, B.top);
    else if (A.top >= B.bottom) line(mx, B.bottom, mx, A.top);
    if (B.left >= A.right) line(A.right, my, B.left, my);
    else if (A.left >= B.right) line(B.right, my, A.left, my);
  }

  /* ---------- Tailles écrites dans le code ---------- */
  // Un texte a toujours une taille à l'écran, mais elle vient de son contenu.
  // On n'affiche que les tailles écrites dans le CSS (ou dans le HTML pour une image).
  var SIZE_PROPS = ['width', 'height', 'min-width', 'max-width', 'min-height', 'max-height'];
  var rulesCache = null;

  function allRules() {
    if (rulesCache) return rulesCache;
    rulesCache = [];
    function walk(list, media) {
      for (var i = 0; i < list.length; i++) {
        var r = list[i];
        if (r.selectorText !== undefined && r.style) rulesCache.push({ rule: r, media: media });
        else if (r.media && r.cssRules) walk(r.cssRules, r.media.mediaText);
        else if (r.cssRules) walk(r.cssRules, media);
      }
    }
    for (var i = 0; i < document.styleSheets.length; i++) {
      try { walk(document.styleSheets[i].cssRules, null); } catch (e) { /* feuille d'un autre site (polices) */ }
    }
    return rulesCache;
  }

  function authored(node) {
    var found = {};
    ['width', 'height'].forEach(function (k) { if (node.hasAttribute && node.hasAttribute(k) && /^(IMG|VIDEO|IFRAME|CANVAS|SVG)$/i.test(node.tagName)) found[k] = node.getAttribute(k) + ' px'; });
    allRules().forEach(function (o) {
      if (o.media && !matchMedia(o.media).matches) return;
      var ok = false;
      try { ok = node.matches(o.rule.selectorText); } catch (e) { return; }
      if (!ok) return;
      SIZE_PROPS.forEach(function (k) { var v = o.rule.style.getPropertyValue(k); if (v) found[k] = v; });
    });
    SIZE_PROPS.forEach(function (k) { var v = node.style.getPropertyValue(k); if (v) found[k] = v; });
    var out = {};
    SIZE_PROPS.forEach(function (k) { var v = found[k]; if (v && !/^(auto|none|initial|unset|normal)$/.test(v)) out[k] = v; });
    return out;
  }

  /* ---------- Panneau d'infos ---------- */

  function name(node) {
    var t = '<span style="color:' + COL.contenu + '">' + node.tagName.toLowerCase() + '</span>';
    if (node.classList.length) t += '<span style="color:' + COL.texte + '">.' + [].slice.call(node.classList).join('.') + '</span>';
    return t;
  }

  // Petit schéma marge > padding > contenu, comme dans l'inspecteur du navigateur.
  function schema(R) {
    var v = function (x) { return '<span style="display:inline-block;min-width:18px;text-align:center">' + (x || '–') + '</span>'; };
    var lbl = function (t, c) { return '<span style="position:absolute;left:6px;top:3px;font-size:9px;letter-spacing:.06em;text-transform:uppercase;color:' + c + '">' + t + '</span>'; };
    return '' +
      '<div style="position:relative;margin-top:10px;padding:16px 8px 6px;border:1px dashed ' + COL.marge + ';border-radius:6px;background:rgba(246,163,91,.12);text-align:center;">' + lbl('margin', COL.marge) +
        '<div>' + v(R.m.t) + '</div>' +
        '<div style="display:flex;align-items:center;gap:6px;">' + v(R.m.l) +
          '<div style="position:relative;flex:1;padding:16px 8px 6px;border:1px solid ' + COL.padding + ';border-radius:5px;background:rgba(111,207,135,.12);">' + lbl('padding', COL.padding) +
            '<div>' + v(R.p.t) + '</div>' +
            '<div style="display:flex;align-items:center;gap:6px;">' + v(R.p.l) +
              '<div style="flex:1;padding:6px 4px;border:1px solid ' + COL.contenu + ';border-radius:4px;background:rgba(91,140,255,.14);color:' + COL.texte + ';white-space:nowrap;">' + (R.a.width || R.a.height ? Math.round(R.content.w) + ' × ' + Math.round(R.content.h) : 'auto') + '</div>' +
            v(R.p.r) + '</div>' +
            '<div>' + v(R.p.b) + '</div>' +
          '</div>' +
        v(R.m.r) + '</div>' +
        '<div>' + v(R.m.b) + '</div>' +
      '</div>';
  }

  function row(k, val) {
    return '<div style="display:flex;justify-content:space-between;gap:12px;margin-top:4px;"><span style="color:' + COL.doux + '">' + k + '</span><span style="text-align:right">' + val + '</span></div>';
  }

  function info(node, R) {
    var s = R.s, html = '<div style="font-family:Menlo,Consolas,monospace;font-size:12px;word-break:break-all;margin-bottom:4px;">' + name(node) + '</div>';
    var keys = Object.keys(R.a);
    if (keys.length) keys.forEach(function (k) { html += row(k, R.a[k]); });
    else html += row('Taille', '<span style="color:' + COL.doux + '">auto, selon le contenu</span>');
    if (/flex|grid/.test(s.display)) {
      var gap = s.gap === 'normal' ? '0' : s.gap.replace(/(\d+(\.\d+)?)px/g, function (_, x) { return Math.round(x) + ' px'; });
      html += row('Display', s.display + (s.display.indexOf('flex') > -1 ? ' (' + s.flexDirection + ')' : ''));
      html += row('Gap', gap);
    }
    var font = s.fontFamily.split(',')[0].replace(/["']/g, '');
    if (!/^(IMG|VIDEO|SVG|IFRAME|CANVAS)$/i.test(node.tagName)) html += row('Police', font + ' ' + s.fontWeight + ', ' + n(s.fontSize) + ' px');
    html += schema(R);
    return html;
  }

  function help() {
    return '<div style="font-weight:600;color:' + COL.texte + '">Survolez un élément</div>' +
      '<div style="margin-top:6px;color:' + COL.doux + ';line-height:1.5;">' +
      '<span style="color:' + COL.marge + '">■</span> marge &nbsp; <span style="color:' + COL.padding + '">■</span> padding &nbsp; <span style="color:' + COL.mesure + '">■</span> distance<br>' +
      'Clic : sélectionner, puis survoler un autre élément pour mesurer l\'écart.<br>Échap : désélectionner.</div>';
  }

  /* ---------- Boucle d'affichage ---------- */

  function draw() {
    layer.innerHTML = '';
    if (!on) return;
    var target = hovered || selected;
    if (selected) rect(rectOf(selected), 'outline:2px solid ' + COL.mesure + ';');
    if (!target) { panel.innerHTML = help(); place(); return; }

    var R = boxes(target);
    R.a = authored(target);
    bands(R.outer, R.border, COL.margeFond);
    bands(R.pad, R.content, COL.paddingFond);
    rect(R.border, 'outline:1px solid ' + COL.contenu + ';');
    var dims = [];
    if (R.a.width) dims.push('width ' + R.a.width);
    if (R.a.height) dims.push('height ' + R.a.height);
    if (target !== selected && dims.length) {
      var y = R.border.y + R.border.h + 12;
      if (y > innerHeight - 10) y = R.border.y - 12;
      chip(dims.join(' · '), R.border.x + R.border.w / 2, y, COL.contenu);
    }
    if (selected && hovered && hovered !== selected) distances(selected, hovered);

    panel.innerHTML = info(target, R);
    place();
  }

  function rectOf(node) { var r = node.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; }

  // Le panneau se met au-dessus du bouton, et passe à droite si la souris s'en approche.
  var side = 'left';
  function setSide(s) {
    side = s;
    panel.style.left = s === 'left' ? '16px' : '';
    panel.style.right = s === 'right' ? '16px' : '';
  }
  function place() {
    setSide(side);
    var r = panel.getBoundingClientRect();
    if (mouseX > r.left - 30 && mouseX < r.right + 30 && mouseY > r.top - 30 && mouseY < r.bottom + 30) {
      setSide(side === 'left' ? 'right' : 'left');
    }
  }

  function ours(node) { return !!node && (panel.contains(node) || button.contains(node) || layer.contains(node)); }

  // L'élément vraiment sous la souris (un lien étiré sur une card avec ::after ne compte
  // que si la souris est sur le lien lui-même).
  function under(x, y) {
    var list = document.elementsFromPoint(x, y);
    for (var i = 0; i < list.length; i++) {
      var el = list[i], r = el.getBoundingClientRect();
      if (ours(el) || el === document.documentElement || el === document.body) continue;
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return el;
    }
    return null;
  }

  /* ---------- Allumer / éteindre ---------- */

  var ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><rect x="8" y="8" width="8" height="8" rx="1"/></svg>';

  function setOn(v) {
    on = v;
    store(v);
    selected = hovered = null;
    button.setAttribute('aria-pressed', v ? 'true' : 'false');
    button.innerHTML = ICON + '<span>' + (v ? 'Arrêter' : 'Inspecter') + '</span>';
    button.style.background = v ? COL.mesure : COL.fond;
    button.style.borderColor = v ? COL.mesure : COL.bord;
    panel.hidden = !v;
    document.documentElement.style.cursor = v ? 'crosshair' : '';
    draw();
  }

  function start() {
    layer = make('div', 'position:fixed;inset:0;pointer-events:none;z-index:2147483645;', document.body);
    panel = make('div', 'position:fixed;left:16px;bottom:68px;z-index:2147483646;width:280px;max-height:calc(100vh - 100px);overflow:auto;padding:12px 14px;border:1px solid ' + COL.bord + ';border-radius:12px;background:' + COL.fond + ';color:' + COL.texte + ';' + FONT + 'font-size:12.5px;line-height:1.4;box-shadow:0 8px 24px rgba(0,0,0,.35);pointer-events:none;', document.body);
    panel.hidden = true;
    button = make('button', 'position:fixed;left:16px;bottom:16px;z-index:2147483647;display:flex;align-items:center;gap:8px;padding:10px 16px;border:1px solid ' + COL.bord + ';border-radius:999px;background:' + COL.fond + ';color:#fff;' + FONT + 'font-size:13px;font-weight:600;line-height:1;cursor:pointer;box-shadow:0 6px 18px rgba(0,0,0,.3);', document.body);
    button.type = 'button';
    button.title = 'Voir les marges, le padding et les distances';
    button.addEventListener('click', function (e) { e.stopPropagation(); setOn(!on); });

    document.addEventListener('mousemove', function (e) {
      if (!on) return;
      mouseX = e.clientX; mouseY = e.clientY;
      var t = under(mouseX, mouseY);
      if (t !== hovered) { hovered = t; draw(); }
    });
    document.addEventListener('mouseleave', function () { if (on) { hovered = null; draw(); } });
    // En inspection, un clic sélectionne au lieu de suivre un lien ou d'envoyer un formulaire.
    document.addEventListener('click', function (e) {
      if (!on || ours(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
      var t = under(e.clientX, e.clientY);
      selected = t && t !== selected ? t : null;
      draw();
    }, true);
    document.addEventListener('keydown', function (e) {
      if (on && e.key === 'Escape') { selected = null; draw(); }
    });
    window.addEventListener('scroll', function () { if (on) draw(); }, { passive: true });
    window.addEventListener('resize', function () { if (on) draw(); });

    setOn(/[?&]inspect\b/.test(location.search) || stored());
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
