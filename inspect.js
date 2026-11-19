/* Inspecteur pour les cours.
   Un bouton « Inspecter » flotte en bas à gauche de chaque page (ordinateur seulement).
   - Cliquer sur un élément : marges en orange, padding en vert, et tous ses réglages,
     rangés comme dans le panneau Style de Webflow.
   - Au survol, un simple contour montre l'élément qu'on va sélectionner.
   - Échap ou re-clic : désélectionne. Re-cliquer sur le bouton : arrête l'inspection.
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

  /* ---------- Tailles écrites dans le code ---------- */
  // Un texte a toujours une taille à l'écran, mais elle vient de son contenu.
  // On n'affiche que les tailles écrites dans le CSS (comme le panneau Style de Webflow).
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

  // Valeurs écrites pour l'élément lui-même (pas héritées), dernière règle gagnante.
  function written(node, props) {
    var found = {};
    allRules().forEach(function (o) {
      if (o.media && !matchMedia(o.media).matches) return;
      var ok = false;
      try { ok = node.matches(o.rule.selectorText); } catch (e) { return; }
      if (!ok) return;
      props.forEach(function (k) { var v = o.rule.style.getPropertyValue(k); if (v) found[k] = v; });
    });
    props.forEach(function (k) { var v = node.style.getPropertyValue(k); if (v) found[k] = v; });
    return found;
  }

  function authored(node) {
    var found = {};
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

  /* ---------- Réglages affichés, rangés comme le panneau Style de Webflow ---------- */
  var WEIGHTS = { 100: 'Thin', 200: 'Extra Light', 300: 'Light', 400: 'Regular', 500: 'Medium', 600: 'Semi Bold', 700: 'Bold', 800: 'Extra Bold', 900: 'Black' };
  var MEDIA = /^(IMG|VIDEO|SVG|IFRAME|CANVAS|PICTURE)$/i;

  function hex(rgb) {
    var m = rgb.match(/\d+(\.\d+)?/g);
    if (!m) return rgb;
    var h = '#' + m.slice(0, 3).map(function (x) { return ('0' + Math.round(+x).toString(16)).slice(-2); }).join('');
    if (m[3] !== undefined && +m[3] < 1) h += ' (' + Math.round(m[3] * 100) + ' %)';
    return h;
  }

  function swatch(c) {
    return '<span style="display:inline-block;width:10px;height:10px;margin-right:6px;vertical-align:-1px;border:1px solid #fff4;border-radius:2px;background:' + c + '"></span>';
  }

  function color(c) { return swatch(c) + hex(c); }

  // rgb(...) dans une valeur (ombre, bordure) remplacé par son code hexa.
  function hexIn(v) { return v.replace(/rgba?\([^)]*\)/g, function (c) { return hex(c); }); }

  function px(v) { return v.replace(/(-?\d+\.\d+)px/g, function (_, x) { return Math.round(x * 10) / 10 + 'px'; }); }

  function short(v, max) { return v.length > max ? v.slice(0, max - 1) + '…' : v; }

  var HER = function () { return ' <span style="color:' + COL.doux + ';font-size:10.5px">hérité</span>'; };

  // Valeur écrite dans le CSS si elle existe (ex. 4rem), avec la valeur calculée entre parenthèses.
  function both(w, k, computed) {
    var v = w[k];
    if (!v || /var\(/.test(v)) return computed;
    return v.replace(/\s/g, '') === computed.replace(/\s/g, '') ? v : v + ' <span style="color:' + COL.doux + '">(' + computed + ')</span>';
  }

  function section(title, rows) {
    if (!rows.length) return '';
    return '<div style="margin-top:12px;padding-top:10px;border-top:1px solid ' + COL.bord + ';font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:' + COL.doux + '">' + title + '</div>' +
      rows.map(function (r) { return row(r[0], r[1]); }).join('');
  }

  function layout(node, s) {
    var w = written(node, ['grid-template-columns', 'grid-template-rows', 'flex', 'grid-column', 'grid-row']);
    var rows = [['display', s.display]];
    var gap = function () { return s.gap === 'normal' ? '0' : px(s.gap); };
    if (s.display.indexOf('flex') > -1) {
      rows.push(['flex-direction', s.flexDirection]);
      if (s.flexWrap !== 'nowrap') rows.push(['flex-wrap', s.flexWrap]);
      if (!/^(normal|flex-start|start)$/.test(s.justifyContent)) rows.push(['justify-content', s.justifyContent]);
      if (!/^(normal|stretch)$/.test(s.alignItems)) rows.push(['align-items', s.alignItems]);
      rows.push(['gap', gap()]);
    } else if (s.display.indexOf('grid') > -1) {
      rows.push(['columns', w['grid-template-columns'] || px(s.gridTemplateColumns)]);
      if (w['grid-template-rows']) rows.push(['rows', w['grid-template-rows']]);
      if (!/^(normal|stretch)$/.test(s.alignItems)) rows.push(['align-items', s.alignItems]);
      rows.push(['gap', gap()]);
    }
    // Réglages de l'enfant dans un parent flex ou grid (« Flex child » / « Grid child » dans Webflow).
    var parent = node.parentElement && getComputedStyle(node.parentElement).display;
    if (parent && parent.indexOf('flex') > -1) {
      var f = s.flexGrow + ' ' + s.flexShrink + ' ' + s.flexBasis;
      if (f !== '0 1 auto') rows.push(['flex (enfant)', w.flex || f]);
    }
    if (parent && parent.indexOf('grid') > -1) {
      if (w['grid-column']) rows.push(['grid-column', w['grid-column']]);
      if (w['grid-row']) rows.push(['grid-row', w['grid-row']]);
    }
    if (s.alignSelf !== 'auto') rows.push(['align-self', s.alignSelf]);
    if (s.order !== '0') rows.push(['order', s.order]);
    return section('Mise en page', rows);
  }

  function size(node, s, R) {
    var rows = [];
    Object.keys(R.a).forEach(function (k) { rows.push([k, R.a[k]]); });
    if (!rows.length) rows.push(['taille', '<span style="color:' + COL.doux + '">auto, selon le contenu</span>']);
    var w = written(node, ['aspect-ratio']);
    if (w['aspect-ratio'] && w['aspect-ratio'] !== 'auto') rows.push(['aspect-ratio', w['aspect-ratio']]);
    // Les images ont overflow: clip par défaut dans le navigateur : rien à régler.
    if (s.overflow !== 'visible' && !(MEDIA.test(node.tagName) && s.overflow === 'clip')) rows.push(['overflow', s.overflow]);
    if (MEDIA.test(node.tagName)) {
      if (s.objectFit !== 'fill') rows.push(['object-fit', s.objectFit]);
      if (s.objectFit !== 'fill' && s.objectPosition !== '50% 50%') rows.push(['object-position', s.objectPosition]);
    }
    return section('Taille', rows);
  }

  function position(node, s) {
    if (s.position === 'static') return '';
    var w = written(node, ['top', 'right', 'bottom', 'left', 'inset']);
    var rows = [['position', s.position]];
    ['top', 'right', 'bottom', 'left'].forEach(function (k) {
      if (w[k] && w[k] !== 'auto') rows.push([k, w[k]]);
      else if (!w[k] && s[k] !== 'auto' && s.position !== 'relative') rows.push([k, px(s[k])]);
    });
    if (s.zIndex !== 'auto') rows.push(['z-index', s.zIndex]);
    return section('Position', rows);
  }

  function typo(node, s) {
    var w = written(node, ['font-family', 'font-weight', 'font-size', 'line-height', 'color', 'text-align', 'font-style', 'letter-spacing', 'text-transform', 'text-decoration-line']);
    // Un bloc sans texte à lui et sans réglage de texte : rien à régler côté typo.
    var ownText = [].some.call(node.childNodes, function (c) { return c.nodeType === 3 && c.textContent.trim(); });
    if (!ownText && !Object.keys(w).length) return '';
    var tag = function (k) { return w[k] ? '' : HER(); };
    var rows = [];
    rows.push(['font-family', s.fontFamily.split(',')[0].replace(/["']/g, '').trim() + tag('font-family')]);
    var wt = parseInt(s.fontWeight, 10);
    rows.push(['font-weight', wt + (WEIGHTS[wt] ? ' ' + WEIGHTS[wt] : '') + tag('font-weight')]);
    rows.push(['font-size', both(w, 'font-size', n(s.fontSize) + ' px') + tag('font-size')]);
    rows.push(['line-height', both(w, 'line-height', s.lineHeight === 'normal' ? 'normal' : n(s.lineHeight) + ' px') + tag('line-height')]);
    rows.push(['color', color(s.color) + tag('color')]);
    // Les réglages suivants ne s'affichent que s'ils changent quelque chose.
    if (!/^(start|left)$/.test(s.textAlign)) rows.push(['text-align', s.textAlign + tag('text-align')]);
    if (s.fontStyle !== 'normal') rows.push(['font-style', s.fontStyle + tag('font-style')]);
    if (s.letterSpacing !== 'normal') rows.push(['letter-spacing', both(w, 'letter-spacing', (Math.round(parseFloat(s.letterSpacing) * 100) / 100) + ' px') + tag('letter-spacing')]);
    if (s.textTransform !== 'none') rows.push(['text-transform', s.textTransform + tag('text-transform')]);
    if (s.textDecorationLine !== 'none') rows.push(['text-decoration', s.textDecorationLine + tag('text-decoration-line')]);
    return section('Typographie', rows);
  }

  // Découpe aux virgules qui ne sont pas entre parenthèses (plusieurs fonds superposés).
  function splitTop(v) {
    var out = [], depth = 0, cur = '';
    for (var i = 0; i < v.length; i++) {
      var ch = v[i];
      if (ch === '(') depth++;
      if (ch === ')') depth--;
      if (ch === ',' && depth === 0) { out.push(cur); cur = ''; } else cur += ch;
    }
    out.push(cur);
    return out;
  }

  function backgrounds(node, s) {
    var rows = [];
    if (!/rgba\(0, 0, 0, 0\)|transparent/.test(s.backgroundColor)) rows.push(['background-color', color(s.backgroundColor)]);
    if (s.backgroundImage !== 'none') {
      var parts = splitTop(s.backgroundImage).map(function (p) {
        p = p.trim();
        if (/^url\(/.test(p)) return 'image : ' + p.replace(/^url\(["']?|["']?\)$/g, '').split('/').pop();
        return short(hexIn(p), 70);
      });
      rows.push(['background-image', parts.join('<br>')]);
      if (s.backgroundSize !== 'auto') rows.push(['background-size', s.backgroundSize]);
      if (s.backgroundPosition !== '0% 0%') rows.push(['background-position', s.backgroundPosition]);
    }
    return section('Fonds', rows);
  }

  function borders(node, s) {
    var rows = [];
    var w = written(node, ['border-radius']);
    if (s.borderRadius !== '0px') rows.push(['border-radius', w['border-radius'] || px(s.borderRadius)]);
    var side = function (k) {
      var c = k.charAt(0).toUpperCase() + k.slice(1);
      return { w: s['border' + c + 'Width'], st: s['border' + c + 'Style'], c: s['border' + c + 'Color'] };
    };
    var sides = ['top', 'right', 'bottom', 'left'].map(side);
    var txt = function (b) { return b.st === 'none' || b.w === '0px' ? '' : px(b.w) + ' ' + b.st + ' ' + swatch(b.c) + hex(b.c); };
    var t = sides.map(txt);
    if (t.every(function (x) { return x === t[0]; })) { if (t[0]) rows.push(['border', t[0]]); }
    else ['top', 'right', 'bottom', 'left'].forEach(function (k, i) { if (t[i]) rows.push(['border-' + k, t[i]]); });
    return section('Bordures', rows);
  }

  function effects(node, s) {
    var rows = [];
    var w = written(node, ['transform', 'transition']);
    if (s.opacity !== '1') rows.push(['opacity', Math.round(s.opacity * 100) + ' %']);
    if (s.mixBlendMode !== 'normal') rows.push(['blend mode', s.mixBlendMode]);
    if (s.boxShadow !== 'none') rows.push(['box-shadow', short(hexIn(px(s.boxShadow)), 70)]);
    if (s.transform !== 'none') rows.push(['transform', w.transform || s.transform]);
    if (s.filter !== 'none') rows.push(['filter', s.filter]);
    if (w.transition) rows.push(['transition', w.transition]);
    if (s.cursor === 'pointer') rows.push(['cursor', 'pointer']);
    return section('Effets', rows);
  }

  /* ---------- Panneau d'infos ---------- */

  // Nom de l'élément tel qu'on le trouve dans le panneau Add de Webflow.
  function type(node) {
    var t = node.tagName.toLowerCase(), c = node.classList;
    if (c.contains('w-container')) return 'Container';
    if (c.contains('w-button') || t === 'button' || (t === 'a' && c.contains('button'))) return 'Button';
    if (t === 'a') return [].some.call(node.children, function (k) { return /^(DIV|IMG|H\d|P)$/.test(k.tagName); }) ? 'Link Block' : 'Text Link';
    var map = {
      img: 'Image', p: 'Paragraph', h1: 'Heading 1', h2: 'Heading 2', h3: 'Heading 3', h4: 'Heading 4', h5: 'Heading 5', h6: 'Heading 6',
      section: 'Section', span: 'Text Span', strong: 'Bold Text', b: 'Bold Text', em: 'Italic Text', i: 'Italic Text',
      ul: 'List', ol: 'List', li: 'List Item', form: 'Form', input: 'Input', textarea: 'Text Area', select: 'Select',
      label: 'Field Label', video: 'Video', iframe: 'Embed', svg: 'Image (SVG)', blockquote: 'Block Quote', sup: 'Text Span (sup)'
    };
    if (map[t]) return map[t];
    if (/^(div|main|header|footer|nav|article|aside)$/.test(t)) return 'Div Block' + (t === 'div' ? '' : ' (balise ' + t + ')');
    return t;
  }

  function name(node) {
    var html = row('Type', '<b style="color:' + COL.texte + '">' + type(node) + '</b>');
    var classes = [].slice.call(node.classList);
    var tags = classes.length
      ? classes.map(function (c) { return '<span style="display:inline-block;margin:2px 0 2px 4px;padding:1px 7px;border:1px solid ' + COL.contenu + ';border-radius:4px;color:' + COL.texte + ';font-family:Menlo,Consolas,monospace;font-size:11.5px;">' + c + '</span>'; }).join('')
      : '<span style="color:' + COL.doux + '">aucune</span>';
    return html + row('Classe' + (classes.length > 1 ? 's' : ''), tags);
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
    return '<div style="display:flex;justify-content:space-between;gap:12px;margin-top:4px;"><span style="color:' + COL.doux + ';white-space:nowrap">' + k + '</span><span style="text-align:right;word-break:break-word">' + val + '</span></div>';
  }

  function info(node, R) {
    var s = R.s;
    var html = name(node);
    html += layout(node, s);
    html += '<div style="margin-top:12px;padding-top:10px;border-top:1px solid ' + COL.bord + ';font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:' + COL.doux + '">Espacement</div>' + schema(R);
    html += size(node, s, R);
    html += position(node, s);
    if (!MEDIA.test(node.tagName)) html += typo(node, s);
    html += backgrounds(node, s);
    html += borders(node, s);
    html += effects(node, s);
    return html;
  }

  function help() {
    return '<div style="font-weight:600;color:' + COL.texte + '">Cliquez sur un élément</div>' +
      '<div style="margin-top:6px;color:' + COL.doux + ';line-height:1.5;">Pour voir tous ses réglages, rangés comme dans Webflow.<br>' +
      '<span style="color:' + COL.marge + '">■</span> marge &nbsp; <span style="color:' + COL.padding + '">■</span> padding<br>Échap : fermer.</div>';
  }

  /* ---------- Boucle d'affichage ---------- */

  function draw() {
    layer.innerHTML = '';
    if (!on) return;
    // Survol : simple contour pour voir ce qu'on va sélectionner.
    if (hovered && hovered !== selected) rect(rectOf(hovered), 'outline:1px dashed ' + COL.contenu + ';');
    if (!selected) { panel.innerHTML = help(); place(); return; }

    var R = boxes(selected);
    R.a = authored(selected);
    bands(R.outer, R.border, COL.margeFond);
    bands(R.pad, R.content, COL.paddingFond);
    rect(R.border, 'outline:2px solid ' + COL.contenu + ';');
    panel.innerHTML = info(selected, R);
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
    panel = make('div', 'position:fixed;left:16px;bottom:68px;z-index:2147483646;width:300px;max-height:calc(100vh - 100px);overflow:auto;padding:12px 14px;border:1px solid ' + COL.bord + ';border-radius:12px;background:' + COL.fond + ';color:' + COL.texte + ';' + FONT + 'font-size:12.5px;line-height:1.4;box-shadow:0 8px 24px rgba(0,0,0,.35);pointer-events:none;', document.body);
    panel.hidden = true;
    button = make('button', 'position:fixed;left:16px;bottom:16px;z-index:2147483647;display:flex;align-items:center;gap:8px;padding:10px 16px;border:1px solid ' + COL.bord + ';border-radius:999px;background:' + COL.fond + ';color:#fff;' + FONT + 'font-size:13px;font-weight:600;line-height:1;cursor:pointer;box-shadow:0 6px 18px rgba(0,0,0,.3);', document.body);
    button.type = 'button';
    button.title = 'Cliquer sur un élément pour voir ses marges, son padding et ses réglages';
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
