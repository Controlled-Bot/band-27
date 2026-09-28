/* Band 27: 3D-Buch, Wallet-Karte, Konfetti, Musik.
   Die Inhalte stehen in inhalt.js (erzeugt aus inhalt/data.js). */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var D = null, IMAGES = {};

  /* ------------------------------------------------------------------ */
  /* Helfer                                                              */
  /* ------------------------------------------------------------------ */

  function $(sel, root) { return (root || document).querySelector(sel); }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function fmt(s) {
    return esc(s)
      .replace(/\n/g, '<br>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/\[([^\]]+)\]/g, '<mark class="ph">[$1]</mark>');
  }
  function paras(list, leadCls) {
    return (list || []).map(function (t, i) {
      return '<p' + (leadCls && i === 0 ? ' class="' + leadCls + '"' : '') + '>' + fmt(t) + '</p>';
    }).join('');
  }

  // Erster Chat im TikTok-Stil. Das Profilbild steht nur an der letzten Nachricht einer Gruppe.
  function tiktokChatHtml(w) {
    var chat = w.chat || [], av = w.avatare || {};
    return '<div class="tchat">' + chat.map(function (m, i) {
      if (m.typ === 'zeit' || m.typ === 'hinweis') {
        return '<p class="tchat__sys' + (m.rechts ? ' tchat__sys--right' : '') + '">' + fmt(m.text) + '</p>';
      }
      if (m.typ === 'story') return '<div class="tchat__story">' + fmt(m.text) + '</div>';
      var side = m.von === 'ich' ? 'me' : 'them';
      var nx = chat[i + 1];
      var last = !nx || nx.typ || nx.von !== m.von;
      var src = IMAGES[av[m.von]];
      return '<div class="tchat__row tchat__row--' + side + (m.reaktion ? ' tchat__row--react' : '') + '">' +
        '<span class="tchat__av">' + (last && src ? '<img src="' + src + '" alt="" draggable="false">' : '') + '</span>' +
        '<div class="tchat__msg">' + fmt(m.text) +
          (m.reaktion ? '<span class="tchat__react">' + esc(m.reaktion) + '</span>' : '') +
        '</div>' +
      '</div>';
    }).join('') + '</div>';
  }
  function haptic(ms) {
    if (navigator.vibrate) { try { navigator.vibrate(ms || 8); } catch (e) { /* egal */ } }
  }
  function debounce(fn, ms) {
    var t;
    return function () { clearTimeout(t); t = setTimeout(fn, ms); };
  }

  /* ------------------------------------------------------------------ */
  /* Start                                                               */
  /* ------------------------------------------------------------------ */

  function start() {
    var data = window.BUCH;
    if (!data) {
      document.body.textContent = 'Inhalt fehlt. Bitte zuerst "Website bauen" ausführen.';
      return;
    }
    D = data.content;
    IMAGES = data.images || {};
    buildBook();
    if (data.hasAudio) setupMusic();
  }

  /* ------------------------------------------------------------------ */
  /* Seiten                                                              */
  /* ------------------------------------------------------------------ */

  var sheets = [];        // { el, label }
  var special = {};

  // Kleines Geburtstags-Emoji in einer Ecke der Seite: tr = oben rechts, br = unten rechts
  function accentHtml(emoji, pos, deg) {
    if (!emoji) return '';
    return '<span class="accent accent--' + pos + '" style="--r:' + deg + 'deg" aria-hidden="true">' + esc(emoji) + '</span>';
  }
  function acc(key, i) {
    var v = (D.akzente || {})[key];
    return Array.isArray(v) ? v[i % v.length] : (i ? '' : v);
  }

  function sheetHtml(label, bodyHtml, cls, opts, n) {
    return '<div class="face face--front"><div class="pg ' + (cls || '') + '">' + (opts.accent || '') +
        (opts.head === false ? '' : '<header class="pg__head">' + fmt(opts.head || label) + '</header>') +
        '<div class="pg__body">' + bodyHtml + '</div>' +
        (opts.number === false ? '' : '<footer class="pg__num">' + n + '</footer>') +
      '</div><span class="shade" aria-hidden="true"></span></div>' +
      '<div class="face face--back"><span class="shade" aria-hidden="true"></span></div>';
  }

  function page(label, bodyHtml, cls, opts) {
    opts = opts || {};
    var el = document.createElement('div');
    el.className = 'sheet';
    el.innerHTML = sheetHtml(label, bodyHtml, cls, opts, sheets.length + 1);
    sheets.push({ el: el, label: label });
    return el;
  }

  /* Kapiteltext auf Buchseiten verteilen: Absätze werden in einer unsichtbaren Seite
     gleicher Größe gemessen und notfalls zwischen zwei Wörtern umbrochen. So passt jede
     Seite genau, ohne Scrollen und ohne abgeschnittene Zeilen. */
  var measureEl = null;

  function paginateChapter() {
    var k = D.kapitel, list = k.text || [];
    if (!measureEl) {
      measureEl = document.createElement('div');
      measureEl.className = 'book book--measure is-fitting';
      measureEl.setAttribute('aria-hidden', 'true');
      document.body.appendChild(measureEl);
    }
    var pages = [], body, box, html;

    function newPage() {
      var first = !pages.length;
      measureEl.innerHTML = '<div class="sheet">' +
        sheetHtml(k.label, (first ? opener(k.label, k.titel) : '') + '<div class="chapter"></div>',
          'pg--chapter', { head: first ? false : k.label }, 1) + '</div>';
      body = $('.pg__body', measureEl);
      box = $('.chapter', body);
      html = [];
    }
    function fits() {                         // Textende mit kleinem Puffer gegen Rundungsunterschiede
      return box.getBoundingClientRect().bottom <= body.getBoundingClientRect().bottom - 3;
    }
    function commit() {
      pages.push((pages.length ? '' : opener(k.label, k.titel)) + '<div class="chapter">' + html.join('') + '</div>');
    }

    newPage();
    list.forEach(function (text, i) {
      var cls = i === 0 ? 'dropcap' : (i === list.length - 1 && list.length > 1 ? 'coda' : '');
      var words = text.split(' ');
      while (words.length) {
        box.insertAdjacentHTML('beforeend', '<p class="' + cls + '">' + fmt(words.join(' ')) + '</p>');
        var p = box.lastElementChild;
        if (fits()) { html.push(p.outerHTML); break; }
        // Größte Wortzahl finden, die noch auf die Seite passt
        p.classList.add('split');
        var lo = 0, hi = words.length - 1;
        while (lo < hi) {
          var mid = Math.ceil((lo + hi) / 2);
          p.innerHTML = fmt(words.slice(0, mid).join(' '));
          if (fits()) lo = mid; else hi = mid - 1;
        }
        var take = Math.min(lo, words.length - 4);          // keine einzelnen Wörter oben auf der nächsten Seite
        if (take < 6 && html.length) {                       // zu wenig Platz: Absatz komplett auf die nächste Seite
          p.remove();
        } else {
          take = Math.max(take, 1);
          p.innerHTML = fmt(words.slice(0, take).join(' '));
          html.push(p.outerHTML);
          words = words.slice(take);
          cls = (cls === 'dropcap' ? '' : cls) + ' cont';
        }
        commit();
        newPage();
      }
    });
    if (html.length) commit();
    measureEl.innerHTML = '';
    return pages;
  }

  function opener(label, title) {
    return '<p class="eyebrow">' + fmt(label) + '</p><h2 class="title">' + fmt(title) + '</h2>';
  }

  function coverHtml() {
    var c = D.cover;
    var img = c.bild && IMAGES[c.bild];
    return '<div class="face face--front cover__front' + (img ? ' has-image' : '') + '">' +
        (img ? '<img class="cover__img" src="' + img + '" alt="" draggable="false" style="object-position:' + esc(c.fokus || '50% 30%') + '">' +
               '<span class="cover__veil" aria-hidden="true"></span>' : '') +
        '<div class="cover__content">' +
          '<p class="cover__band">' + fmt(c.untertitel) + accentHtml(acc('cover', 0), 'inline', -10) + '</p>' +
          '<h1 class="cover__title">' + fmt(c.titel) + '</h1>' +
        '</div>' +
      '</div>' +
      '<div class="face face--back cover__inside"></div>';
  }

  function buildPages() {
    sheets = [];
    special = {};

    page(D.widmung.titel || 'Chat', tiktokChatHtml(D.widmung), 'pg--chat',
      { head: D.widmung.titel || false, accent: accentHtml(acc('chat', 0), 'br', -8) });

    var k = D.kapitel;
    special.confetti = sheets.length;
    chapterPages.forEach(function (html, i) {
      var el = page(k.label, html, 'pg--chapter', {
        head: i ? k.label : false,
        accent: accentHtml(acc('kapitel', i), i ? 'br' : 'tr', [9, -7, 6][i % 3])
      });
      if (!i) {
        var cv = document.createElement('canvas');
        cv.className = 'confetti';
        $('.face--front', el).appendChild(cv);
      }
    });
    var co = k.collage;
    if (co) {
      special.collage = sheets.length;
      page(k.label,
        (co.titel ? '<h2 class="collage__title">' + fmt(co.titel) + '</h2>' : '') +
        '<div class="collage">' + (co.bilder || []).map(function (f) {
          var src = IMAGES[f.bild];
          return '<button type="button" class="collage__photo' + (f.ganz ? ' collage__photo--full' : '') + '" aria-label="Foto nach vorne holen">' +
            (src ? '<img src="' + src + '" alt="" draggable="false"' + (f.fokus ? ' style="object-position:' + esc(f.fokus) + '"' : '') + '>'
                 : '<span class="collage__missing">' + esc(f.bild) + '</span>') +
          '</button>';
        }).join('') + '</div>' +
        '<p class="collage__caption">' + fmt(co.unterschrift) + '</p>', 'pg--collage',
        { head: false, accent: accentHtml(acc('collage', 0), 'tr', -9) });
    }

    var a = D.anhang, b = a.brief;
    page(a.label, opener(a.label, a.titel) +
      '<div class="letter"><p class="letter__salute">' + fmt(b.anrede) + '</p>' + paras(b.text) +
      (b.gruss ? '<p class="signature">' + fmt(b.gruss) + '</p>' : '') + '</div>', '',
      { head: false, accent: accentHtml(acc('brief', 0), 'tr', 8) });

    special.wallet = sheets.length;
    page(a.label, walletHtml(), 'pg--wallet',
      { head: a.label + ' · ' + (b.gutschein.titel || ''), accent: accentHtml(acc('gutschein', 0), 'br', -6) });

    var r = D.rueckseite;
    page('Rückseite',
      '<div class="back">' +
        '<p class="back__blurb">' + fmt(r.klappentext) + '</p>' +
        '<div class="back__reviews">' + (r.rezensionen || []).map(function (x) {
          return '<blockquote class="review"><p>' + fmt(x.text) + '</p><cite>' + fmt(x.quelle) + '</cite></blockquote>';
        }).join('') + '</div>' +
        '<div class="back__foot"><button type="button" class="pill pill--ghost restart">Von vorn lesen</button>' +
        '<span class="back__isbn">' + fmt(r.isbn || '') + '</span></div>' +
      '</div>', 'pg--back', { head: false, number: false, accent: accentHtml(acc('rueckseite', 0), 'tr', 7) });
  }

  /* ------------------------------------------------------------------ */
  /* Wallet-Karte im Umschlag                                            */
  /* ------------------------------------------------------------------ */

  function walletHtml() {
    var a = D.anhang, g = a.brief.gutschein;
    return '<div class="wallet">' +
      '<div class="envelope" role="button" tabindex="0" aria-label="Umschlag öffnen">' +
        '<span class="env env--back"></span>' +
        '<div class="pass">' +
          '<div class="pass__row"><span class="pass__brand">' + fmt(g.titel) + '</span><span class="pass__value">' + fmt(g.wert) + '</span></div>' +
          '<div class="pass__code-wrap"><span class="pass__label">Code</span><span class="pass__code" data-code="' + esc(g.code) + '">' + fmt(g.code) + '</span></div>' +
          '<div class="pass__row pass__row--foot"><span>' + fmt(D.cover.untertitel || '') + '</span><span>' + fmt(D.name || '') + '</span></div>' +
        '</div>' +
        '<span class="env env--pocket"><span class="env__label">' + fmt(a.umschlag || '') + '</span></span>' +
        '<span class="env env--flap"></span>' +
      '</div>' +
      '<p class="wallet__hint">' + fmt(a.hinweis || '') + '</p>' +
      '<button type="button" class="pill copy"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2.5"/><path d="M5 15V6.5A2.5 2.5 0 0 1 7.5 4H15"/></svg><span>' + esc(g.buttonText) + '</span></button>' +
    '</div>';
  }

  function wireWallet(sheet) {
    var wallet = $('.wallet', sheet), env = $('.envelope', sheet), pass = $('.pass', sheet), btn = $('.copy', sheet);
    var opened = false;

    function open() {
      if (opened) return;
      opened = true;
      haptic(10);
      var t = reduceMotion ? 0.1 : 1;
      env.classList.add('is-open');
      setTimeout(function () {
        // Karte bis an den oberen Rand der Szene heben
        var lift = env.offsetTop + pass.offsetTop - 4;
        pass.style.setProperty('--lift', (-lift) + 'px');
        wallet.classList.add('is-out');
      }, 420 * t);
      setTimeout(function () { wallet.classList.add('is-done'); }, 1250 * t);
    }
    env.addEventListener('click', open);
    env.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
    });

    btn.addEventListener('click', function () {
      var g = D.anhang.brief.gutschein;
      var label = btn.querySelector('span');
      copyText($('.pass__code', sheet).getAttribute('data-code')).then(function (ok) {
        haptic(10);
        label.textContent = ok ? g.kopiertText : 'Bitte manuell kopieren';
        btn.classList.toggle('is-done', ok);
        if (!ok) selectText($('.pass__code', sheet));
        setTimeout(function () { label.textContent = g.buttonText; btn.classList.remove('is-done'); }, 2200);
      });
    });
  }

  // Antippen holt ein Foto nach vorne und vergrößert es kurz; nochmal tippen legt es zurück
  function wireCollage(sheet) {
    var z = 10;
    Array.prototype.forEach.call(sheet.querySelectorAll('.collage__photo'), function (ph) {
      ph.addEventListener('click', function () {
        var was = ph.classList.contains('is-front');
        Array.prototype.forEach.call(sheet.querySelectorAll('.collage__photo.is-front'), function (x) { x.classList.remove('is-front'); });
        if (!was) { ph.style.zIndex = ++z; ph.classList.add('is-front'); haptic(6); }
      });
    });
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(function () { return true; }, fallback);
    }
    return Promise.resolve(fallback());
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;font-size:16px';
      document.body.appendChild(ta);
      ta.select();
      ta.setSelectionRange(0, text.length);
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      ta.remove();
      return ok;
    }
  }
  function selectText(node) {
    var r = document.createRange();
    r.selectNodeContents(node);
    var s = window.getSelection();
    s.removeAllRanges();
    s.addRange(r);
  }

  /* ------------------------------------------------------------------ */
  /* Konfetti                                                            */
  /* ------------------------------------------------------------------ */

  function confetti(canvas) {
    if (reduceMotion || !canvas) return;
    var w = canvas.clientWidth, h = canvas.clientHeight;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var colors = ['#0A84FF', '#FF9F0A', '#30D158', '#FF375F', '#BF5AF2', '#FFD60A'];
    var parts = [];
    for (var i = 0; i < 55; i++) {
      parts.push({
        x: Math.random() * w, y: -10 - Math.random() * h * 0.5,
        vy: 1 + Math.random() * 1.5, phase: Math.random() * 6.28, sway: 3 + Math.random() * 7,
        rot: Math.random() * 3.14, vr: (Math.random() - 0.5) * 0.12, size: 4 + Math.random() * 3.5,
        round: Math.random() < 0.35, color: colors[i % colors.length]
      });
    }
    var t0 = performance.now(), dur = 3600;
    canvas.style.opacity = '1';
    (function frame(now) {
      var t = now - t0;
      ctx.clearRect(0, 0, w, h);
      parts.forEach(function (p) {
        p.y += p.vy; p.phase += 0.03; p.rot += p.vr;
        ctx.save();
        ctx.translate(p.x + Math.sin(p.phase) * p.sway, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        if (p.round) { ctx.beginPath(); ctx.arc(0, 0, p.size / 2.3, 0, 6.28); ctx.fill(); }
        else ctx.fillRect(-p.size / 2, -p.size / 5, p.size, p.size / 2.5);
        ctx.restore();
      });
      if (t > dur - 800) canvas.style.opacity = '0';
      if (t < dur) requestAnimationFrame(frame); else ctx.clearRect(0, 0, w, h);
    })(t0);
  }

  /* ------------------------------------------------------------------ */
  /* Buch: Aufbau, Größe, Öffnen, Blättern                               */
  /* ------------------------------------------------------------------ */

  var book, cover, stage, isOpen = false, current = 0, animating = false;
  var chapterPages = null;
  var TURN_MS = 720;

  function buildBook() {
    stage = $('#stage');
    book = $('#book');
    book.innerHTML =
      '<span class="book__board" aria-hidden="true"></span>' +
      '<span class="book__edges" aria-hidden="true"></span>' +
      '<div class="book__pages"></div>' +
      '<div class="cover" role="button" tabindex="0" aria-label="Buch öffnen">' + coverHtml() + '</div>';
    cover = $('.cover', book);

    stage.hidden = false;
    layout();
    setupGestures();
    window.addEventListener('resize', debounce(layout, 150));
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(refresh);
    window.addEventListener('load', refresh);
  }

  // Blätter (neu) erzeugen und einsetzen
  function mountSheets() {
    buildPages();
    var holder = $('.book__pages', book);
    holder.innerHTML = '';
    // Umgekehrte Reihenfolge: In 3D-Kontexten (Safari) zählt die DOM-Reihenfolge statt z-index,
    // das aktuelle Blatt muss also nach den folgenden Blättern kommen.
    sheets.slice().reverse().forEach(function (s) { holder.appendChild(s.el); });
    wireWallet(sheets[special.wallet].el);
    if (special.collage != null) wireCollage(sheets[special.collage].el);
    $('.restart', book).addEventListener('click', restart);
    current = Math.min(current, sheets.length - 1);
    placeSheets();
  }

  // Nach Größen- oder Schriftänderung: Kapitel neu umbrechen (nur wenn sich etwas ändert), dann Texte einpassen
  function refresh() {
    if (animating) { setTimeout(refresh, 400); return; }
    var pages = paginateChapter();
    if (!chapterPages || pages.join('|') !== chapterPages.join('|')) {
      chapterPages = pages;
      mountSheets();
    }
    fitAll();
  }

  function layout() {
    var vw = window.innerWidth, vh = window.innerHeight;
    var reserve = 116;                       // Navigationsleiste + Abstände
    var w = Math.min(vw - 56, (vh - reserve - 40) / 1.45, 420);
    w = Math.max(230, Math.floor(w));
    var root = document.documentElement.style;
    root.setProperty('--bw', w + 'px');
    root.setProperty('--bh', Math.floor(w * 1.45) + 'px');
    refresh();
  }

  // Texte an die Seitengröße anpassen (notfalls scrollt die Seite)
  function fitAll() {
    if (book) book.classList.add('is-fitting');
    sheets.forEach(function (s) {
      var body = $('.pg__body', s.el);
      if (!body || s.el.querySelector('.pg--wallet')) return;
      var f = 1, min = s.el.querySelector('.tchat') ? 0.5 : 0.74;   // der Chat darf nie scrollen
      body.style.setProperty('--fit', '1');
      while (body.scrollHeight > body.clientHeight + 1 && f > min) {
        f -= 0.03;
        body.style.setProperty('--fit', f.toFixed(3));
      }
      body.classList.toggle('is-scroll', body.scrollHeight > body.clientHeight + 1);
    });
    if (book) { void book.offsetWidth; book.classList.remove('is-fitting'); }
  }

  // Grundstellung aller Blätter: umgeblättert (links, unsichtbar) oder flach
  function placeSheets() {
    var n = sheets.length;
    sheets.forEach(function (s, i) {
      var turned = i < current;
      s.el.classList.remove('is-turning');
      s.el.style.transition = 'none';
      s.el.style.setProperty('--p', turned ? '1' : '0');
      s.el.style.zIndex = turned ? i : n - i;
      s.el.style.visibility = (!turned && i <= current + 1) ? 'visible' : 'hidden';
      if (i === current) s.el.removeAttribute('inert'); else s.el.setAttribute('inert', '');
    });
    void book.offsetWidth;
    sheets.forEach(function (s) { s.el.style.transition = ''; });
    updateBar();
  }

  function updateBar() {
    $('#bar-label').textContent = sheets[current] ? sheets[current].label : '';
    $('#bar-fill').style.transform = 'scaleX(' + ((current + 1) / sheets.length) + ')';
    $('#next').disabled = current >= sheets.length - 1;
  }

  function onArrive() {
    if (current === special.confetti) {
      var cv = $('.confetti', sheets[current].el);
      setTimeout(function () { if (current === special.confetti) confetti(cv); }, 200);
    }
  }

  function openBook() {
    if (isOpen || animating) return;
    animating = true;
    isOpen = true;
    haptic(10);
    stage.classList.add('is-open');
    cover.setAttribute('aria-label', 'Buch');
    var bar = $('#bar');
    bar.hidden = false;
    requestAnimationFrame(function () { requestAnimationFrame(function () { bar.classList.add('is-shown'); }); });
    setTimeout(function () {
      cover.classList.add('is-gone');
      animating = false;
    }, reduceMotion ? 50 : 1150);
  }

  function closeBook() {
    if (!isOpen || animating) return;
    animating = true;
    isOpen = false;
    cover.classList.remove('is-gone');
    void cover.offsetWidth;
    stage.classList.remove('is-open');
    cover.setAttribute('aria-label', 'Buch öffnen');
    $('#bar').classList.remove('is-shown');
    setTimeout(function () { $('#bar').hidden = true; animating = false; }, reduceMotion ? 50 : 1100);
  }

  function restart() {
    current = 0;
    placeSheets();
    closeBook();
  }

  function setTurn(s, p, instant) {
    if (instant) s.el.style.transition = 'none';
    s.el.style.setProperty('--p', p.toFixed(4));
  }

  function prepareTurn(idx) {
    for (var i = idx - 1; i <= idx + 1; i++) if (sheets[i] && i >= current - 1) sheets[i].el.style.visibility = 'visible';
    sheets[idx].el.style.zIndex = 500;
    sheets[idx].el.classList.add('is-turning');
  }

  // Blatt drehen: dir 1 = weiter, -1 = zurück; p0 = Startfortschritt (beim Wischen)
  function turn(dir, p0) {
    if (animating) return;
    var idx = dir > 0 ? current : current - 1;
    var s = sheets[idx];
    if (!s) return;
    animating = true;
    haptic(6);
    var from = p0 == null ? (dir > 0 ? 0 : 1) : p0;
    var to = dir > 0 ? 1 : 0;
    prepareTurn(idx);
    setTurn(s, from, true);
    void s.el.offsetWidth;
    var ms = reduceMotion ? 1 : Math.max(280, TURN_MS * Math.abs(to - from));
    s.el.style.transition = '--p ' + ms + 'ms var(--ease-page)';
    setTurn(s, to);
    setTimeout(function () {
      current += dir;
      animating = false;
      placeSheets();
      onArrive();
    }, ms + 30);
  }

  function next() {
    if (!isOpen) { openBook(); return; }
    if (current < sheets.length - 1) turn(1);
  }
  function prev() {
    if (!isOpen) return;
    if (current > 0) turn(-1); else closeBook();
  }

  /* Wischen und Tippen */
  function setupGestures() {
    var st = null;

    function interactive(t) {
      return t.closest && t.closest('button, a, input, .envelope, .pass, .bar');
    }

    stage.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (animating) return;
      st = { x: e.clientX, y: e.clientY, t: performance.now(), inter: interactive(e.target), drag: 0, idx: -1, p: 0 };
    });

    stage.addEventListener('pointermove', function (e) {
      if (!st || !isOpen || animating) return;
      var dx = e.clientX - st.x, dy = e.clientY - st.y;
      if (!st.drag) {
        if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.2) {
          st.drag = dx < 0 ? 1 : -1;
          st.idx = st.drag > 0 ? current : current - 1;
          if (!sheets[st.idx] || (st.drag > 0 && current >= sheets.length - 1)) { st = null; return; }
          prepareTurn(st.idx);
          try { stage.setPointerCapture(e.pointerId); } catch (err) { /* egal */ }
        } else return;
      }
      var w = book.clientWidth * 0.95;
      var p = st.drag > 0 ? -dx / w : 1 - dx / w;
      st.p = Math.min(1, Math.max(0, p));
      setTurn(sheets[st.idx], st.p, true);
    });

    function end(e, cancelled) {
      if (!st) return;
      var s = st;
      st = null;
      var dx = e.clientX - s.x, dy = e.clientY - s.y, dt = performance.now() - s.t;
      if (s.drag) {
        var fast = Math.abs(dx) / dt > 0.5;
        var done = !cancelled && (s.drag > 0 ? (s.p > 0.3 || (fast && dx < 0)) : (s.p < 0.7 || (fast && dx > 0)));
        if (done) { turn(s.drag, s.p); return; }
        animating = true;
        var sheet = sheets[s.idx];
        sheet.el.style.transition = '--p 280ms var(--ease-page)';
        setTurn(sheet, s.drag > 0 ? 0 : 1);
        setTimeout(function () { animating = false; placeSheets(); }, 300);
        return;
      }
      if (cancelled || s.inter || Math.abs(dx) > 10 || Math.abs(dy) > 10 || dt > 600) return;
      if (String(window.getSelection ? window.getSelection() : '')) return;
      if (!isOpen) {
        if (e.target.closest('.book')) openBook();
        return;
      }
      var r = book.getBoundingClientRect();
      if (e.clientX < r.left + r.width * 0.3) prev(); else next();
    }

    stage.addEventListener('pointerup', function (e) { end(e, false); });
    stage.addEventListener('pointercancel', function (e) { end(e, true); });

    cover.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openBook(); }
    });
    $('#prev').addEventListener('click', prev);
    $('#next').addEventListener('click', next);
    document.addEventListener('keydown', function (e) {
      if (e.target.closest && e.target.closest('input')) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); next(); }
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); prev(); }
    });
  }

  /* ------------------------------------------------------------------ */
  /* Musik (nur per Button, kein Autoplay)                               */
  /* ------------------------------------------------------------------ */

  function setupMusic() {
    var btn = $('#music');
    var audio = new Audio('musik.mp3');
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = D.musik && D.musik.lautstaerke != null ? D.musik.lautstaerke : 0.5;
    audio.addEventListener('error', function () { btn.hidden = true; });
    btn.hidden = false;

    function setState(on) {
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      btn.setAttribute('aria-label', on ? 'Musik aus' : 'Musik an');
      btn.classList.toggle('is-on', on);
    }
    btn.addEventListener('click', function () {
      if (audio.paused) {
        var p = audio.play();
        setState(true);
        if (p && p.catch) p.catch(function () { setState(false); });
      } else { audio.pause(); setState(false); }
    });
  }

  start();
})();
