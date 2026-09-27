/* Geburtstagsbuch: Aufbau, Blättern, Passwort, Brief, Konfetti, Musik.
   Texte und Bilder stehen in js/data.js. */
(function () {
  'use strict';

  var D = window.BUCH;
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ------------------------------------------------------------------ */
  /* Helfer                                                              */
  /* ------------------------------------------------------------------ */

  function $(sel, root) { return (root || document).querySelector(sel); }

  function get(path) {
    return path.split('.').reduce(function (o, k) { return o == null ? o : o[k]; }, D);
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  // *kursiv* und [Platzhalter] (werden markiert)
  function fmt(s) {
    return esc(s)
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/\[([^\]]+)\]/g, '<mark class="ph">[$1]</mark>');
  }

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  function paragraphs(list) {
    return (list || []).map(function (t) { return '<p>' + fmt(t) + '</p>'; }).join('');
  }

  // Erster Absatz mit ornamentaler Initiale
  function withInitial(list) {
    if (!list || !list.length) return '';
    var first = list[0];
    var m = /^([„"»]?)([A-Za-zÄÖÜäöü])/.exec(first);
    if (!m) return paragraphs(list);
    var letter = m[2].toUpperCase();
    var rest = m[1] + first.slice(m[0].length);
    return '<p class="has-initial"><span class="initial" aria-hidden="true"><span>' + letter +
      '</span></span><span class="visually-hidden">' + letter + '</span>' + fmt(rest) + '</p>' +
      paragraphs(list.slice(1));
  }

  function chunk(arr, n) {
    var out = [];
    for (var i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
    return out;
  }

  // Unterbindet das Blättern, wenn man auf interaktive Elemente tippt
  function guard(node, when) {
    ['mousedown', 'touchstart', 'pointerdown'].forEach(function (ev) {
      node.addEventListener(ev, function (e) {
        if (!when || when()) e.stopPropagation();
      }, { passive: true });
    });
  }

  /* ------------------------------------------------------------------ */
  /* Ornamente (SVG)                                                     */
  /* ------------------------------------------------------------------ */

  var ORN = {
    rule:
      '<svg class="orn-rule" viewBox="0 0 200 20" aria-hidden="true">' +
      '<path d="M8 10H78M122 10H192" stroke="currentColor" stroke-width=".7" fill="none"/>' +
      '<path d="M78 10c5-6 11-6 14 0M122 10c-5 6-11 6-14 0" stroke="currentColor" stroke-width=".8" fill="none"/>' +
      '<path d="M100 3l6 7-6 7-6-7z" fill="currentColor"/>' +
      '<circle cx="84" cy="10" r="1.2" fill="currentColor"/><circle cx="116" cy="10" r="1.2" fill="currentColor"/>' +
      '<circle cx="8" cy="10" r="1" fill="currentColor"/><circle cx="192" cy="10" r="1" fill="currentColor"/></svg>',
    fleuron:
      '<svg class="orn-fleuron" viewBox="0 0 60 20" aria-hidden="true">' +
      '<path d="M30 4l4 6-4 6-4-6z" fill="currentColor"/>' +
      '<path d="M25 10c-4-5-9-6-13-3-3 2-6 2-9 0M35 10c4-5 9-6 13-3 3 2 6 2 9 0" fill="none" stroke="currentColor" stroke-width=".9"/>' +
      '<path d="M25 10c-3 3-7 4-10 2M35 10c3 3 7 4 10 2" fill="none" stroke="currentColor" stroke-width=".7"/>' +
      '<circle cx="18" cy="10" r="1.1" fill="currentColor"/><circle cx="42" cy="10" r="1.1" fill="currentColor"/></svg>',
    corner:
      '<svg viewBox="0 0 60 60" aria-hidden="true">' +
      '<path d="M3 57V15Q3 3 15 3h42" fill="none" stroke="currentColor" stroke-width="1.3"/>' +
      '<path d="M9 51V19q0-10 10-10h32" fill="none" stroke="currentColor" stroke-width=".6"/>' +
      '<path d="M14 14c9 1 13 5 14 14-9-1-13-5-14-14z" fill="currentColor"/>' +
      '<circle cx="33" cy="33" r="1.6" fill="currentColor"/>' +
      '<path d="M9 30c4 0 6 2 6 6M30 9c0 4 2 6 6 6" fill="none" stroke="currentColor" stroke-width=".6"/></svg>',
    crest:
      '<svg class="orn-crest" viewBox="0 0 120 30" aria-hidden="true">' +
      '<path d="M60 4l5 11-5 11-5-11z" fill="currentColor"/>' +
      '<path d="M50 15c-8-9-20-9-28-2-5 4-11 4-16 1M70 15c8-9 20-9 28-2 5 4 11 4 16 1" fill="none" stroke="currentColor" stroke-width="1"/>' +
      '<path d="M50 15c-6 6-14 7-20 3M70 15c6 6 14 7 20 3" fill="none" stroke="currentColor" stroke-width=".7"/>' +
      '<circle cx="42" cy="15" r="1.4" fill="currentColor"/><circle cx="78" cy="15" r="1.4" fill="currentColor"/></svg>'
  };

  /* ------------------------------------------------------------------ */
  /* Seiten bauen                                                        */
  /* ------------------------------------------------------------------ */

  var pageMeta = [];   // { label }
  var special = {};    // Indizes besonderer Seiten

  function paperPage(opts) {
    var p = el('div', 'page page--paper' + (opts.cls ? ' ' + opts.cls : ''));
    p.setAttribute('data-density', 'soft');
    var inner = el('div', 'page__inner');
    if (opts.head) inner.appendChild(el('div', 'page__head', esc(opts.head)));
    var body = el('div', 'page__body', opts.html || '');
    inner.appendChild(body);
    if (opts.number !== false) inner.appendChild(el('div', 'page__foot', '<span></span>'));
    p.appendChild(inner);
    return p;
  }

  function chapterHead(label, title) {
    return '<header class="chap">' +
      '<div class="chap__label">' + fmt(label) + '</div>' +
      '<h2 class="chap__title">' + fmt(title) + '</h2>' + ORN.rule + '</header>';
  }

  function coverPage() {
    var c = D.cover;
    var chat = (c.chat || []).map(function (m) {
      return '<div class="bubble bubble--' + (m.von === 'ich' ? 'me' : 'her') + '">' + fmt(m.text) + '</div>';
    }).join('');
    var p = el('div', 'page page--cover');
    p.setAttribute('data-density', 'hard');
    p.innerHTML =
      '<div class="leather">' +
        '<div class="leather__frame">' +
          ['tl', 'tr', 'bl', 'br'].map(function (k) { return '<span class="corner corner--' + k + '">' + ORN.corner + '</span>'; }).join('') +
          '<div class="page__body cover__body">' +
            '<div class="gold">' + ORN.crest + '</div>' +
            '<h1 class="cover__title gold-text">' + fmt(c.titel) + '</h1>' +
            '<div class="gold cover__rule">' + ORN.rule + '</div>' +
            '<p class="cover__sub gold-text">' + fmt(c.untertitel) + '</p>' +
            (chat ? '<div class="cover__chat"><div class="cover__chat-label">' + fmt(c.chatUeberschrift || '') + '</div>' + chat + '</div>' : '') +
          '</div>' +
        '</div>' +
      '</div>';
    return p;
  }

  function backPage() {
    var r = D.rueckseite;
    var reviews = (r.rezensionen || []).map(function (x) {
      return '<blockquote class="review"><p>„' + fmt(x.text) + '“</p><cite>' + fmt(x.quelle) + '</cite></blockquote>';
    }).join('');
    var p = el('div', 'page page--cover page--back');
    p.setAttribute('data-density', 'hard');
    p.innerHTML =
      '<div class="leather">' +
        '<div class="leather__frame">' +
          ['tl', 'tr', 'bl', 'br'].map(function (k) { return '<span class="corner corner--' + k + '">' + ORN.corner + '</span>'; }).join('') +
          '<div class="page__body back__body">' +
            '<div class="gold">' + ORN.fleuron + '</div>' +
            '<p class="blurb">' + fmt(r.klappentext) + '</p>' +
            '<div class="gold">' + ORN.rule + '</div>' +
            reviews +
            '<div class="barcode"><div class="barcode__bars"></div><div class="barcode__num">' + fmt(r.isbn || '') + '</div></div>' +
          '</div>' +
        '</div>' +
      '</div>';
    return p;
  }

  function buildPages() {
    var pages = [];
    pageMeta = [];
    special = {};

    function add(page, label) { pages.push(page); pageMeta.push({ label: label }); return page; }

    // 1. Cover
    add(coverPage(), 'Cover');

    // Titelblatt
    var t = D.titelblatt;
    add(paperPage({
      cls: 'page--title', number: false,
      html: '<div class="titlepage">' +
        '<div class="ink-gold">' + ORN.crest + '</div>' +
        '<h2 class="titlepage__title">' + fmt(t.titel) + '</h2>' +
        '<p class="titlepage__sub">' + fmt(t.untertitel) + '</p>' +
        '<div class="ink-gold">' + ORN.rule + '</div>' +
        '<p class="titlepage__line">' + fmt(t.zeile) + '</p>' +
        '<p class="titlepage__imprint">' + fmt(t.verlag) + '</p>' +
      '</div>'
    }), 'Titelblatt');

    // 2. Widmung
    add(paperPage({
      cls: 'page--dedication', number: false,
      html: '<div class="dedication"><div class="ink-gold">' + ORN.fleuron + '</div>' + paragraphs(D.widmung.text) + '</div>'
    }), 'Widmung');

    // 3. Prolog (eine oder mehrere Seiten)
    var pr = D.prolog;
    (pr.seiten || []).forEach(function (seite, i) {
      add(paperPage({
        head: i ? pr.label + ' · ' + pr.titel : null,
        html: i ? '<div class="prose">' + paragraphs(seite) + '</div>'
                : chapterHead(pr.label, pr.titel) + '<div class="prose">' + withInitial(seite) + '</div>'
      }), pr.label);
    });

    // 4. Kapitel 27
    var k = D.kapitel;
    add(paperPage({
      html: chapterHead(k.label, k.titel) + '<div class="prose">' + withInitial(k.intro) + '</div>'
    }), k.label);

    var n = Math.max(1, k.fotosProSeite || 2);
    var fig = 0;
    chunk(k.fotos || [], n).forEach(function (group) {
      var html = group.map(function (f) {
        fig++;
        var side = fig % 2 ? 'l' : 'r';
        return '<figure class="polaroid polaroid--' + side + '">' +
          '<span class="tape" aria-hidden="true"></span>' +
          '<div class="polaroid__img"><img src="' + esc(f.bild) + '" alt="" decoding="async" data-src="' + esc(f.bild) + '"></div>' +
          '<figcaption><span class="polaroid__no">Abb. ' + fig + '</span> ' + fmt(f.text) + '</figcaption>' +
          '</figure>';
      }).join('');
      var pg = add(paperPage({ head: k.label + ' · ' + k.titel, cls: 'page--photos', html: '<div class="photos" style="--n:' + group.length + '">' + html + '</div>' }), k.label);
      pg.querySelectorAll('img').forEach(function (img) {
        img.addEventListener('error', function () {
          var box = img.parentNode;
          box.classList.add('is-missing');
          box.innerHTML = '<span>Foto folgt<br><small>' + esc(img.getAttribute('data-src')) + '</small></span>';
        }, { once: true });
      });
    });

    // 5. Epilog
    var ep = D.epilog;
    special.epilog = pages.length;
    add(paperPage({
      cls: 'page--epilog',
      html: chapterHead(ep.label, ep.titel) + '<div class="prose">' + withInitial(ep.text) + '</div>' +
        (ep.gruss ? '<p class="signature">' + fmt(ep.gruss) + '</p>' : '')
    }), ep.label).appendChild(el('canvas', 'confetti'));

    // 6. Anhang: Brief
    special.anhang = pages.length;
    add(letterPage(), D.anhang.label);

    // Seitenzahl gerade halten (Rückseite muss links liegen)
    if ((pages.length + 1) % 2 !== 0) {
      add(paperPage({
        cls: 'page--blank', number: false,
        html: '<div class="blank"><div class="ink-gold">' + ORN.fleuron + '</div><p>' + fmt(D.ui.leereSeite) + '</p></div>'
      }), '');
    }

    // 7. Rückseite
    add(backPage(), 'Rückseite');

    // Seitenzahlen und Bundsteg-Seite
    pages.forEach(function (p, i) {
      var foot = p.querySelector('.page__foot span');
      if (foot) foot.textContent = i;
      p.classList.add(i % 2 ? 'page--left' : 'page--right');
    });

    return pages;
  }

  /* ------------------------------------------------------------------ */
  /* Anhang: Umschlag mit Wachssiegel                                    */
  /* ------------------------------------------------------------------ */

  function letterPage() {
    var a = D.anhang, b = a.brief, g = b.gutschein;
    var pocket =
      '<svg class="env__pocket" viewBox="0 0 160 100" preserveAspectRatio="none" aria-hidden="true">' +
        '<path d="M0 0L80 56 0 100z" fill="#e3cfa6"/><path d="M160 0L80 56l80 44z" fill="#e3cfa6"/>' +
        '<path d="M0 100l80-46 80 46z" fill="#ecdcb8"/>' +
        '<path d="M0 0L80 56 160 0M0 100l80-46 80 46" fill="none" stroke="rgba(110,70,30,.28)" stroke-width=".5"/></svg>';
    var flap =
      '<svg class="env__flap" viewBox="0 0 160 100" preserveAspectRatio="none" aria-hidden="true">' +
        '<path d="M0 0h160L84 58q-4 3-8 0z" fill="#ead8b2" stroke="rgba(110,70,30,.3)" stroke-width=".5"/></svg>';
    var sealFace = '<span class="seal__face"><span>' + esc(a.siegel || '') + '</span></span>';

    var html =
      chapterHead(a.label, a.titel) +
      '<p class="env-hint">' + fmt(a.hinweis) + '</p>' +
      '<div class="env-stage">' +
        '<div class="envelope" role="button" tabindex="0" aria-label="Brief öffnen">' +
          '<span class="env__back"></span>' +
          '<div class="letter">' +
            '<div class="letter__peek">Für dich</div>' +
            '<div class="letter__content">' +
              '<p class="letter__salute">' + fmt(b.anrede) + '</p>' +
              paragraphs(b.text) +
              '<div class="voucher">' +
                '<div class="voucher__top"><span class="voucher__title">' + fmt(g.titel) + '</span><span class="voucher__value">' + fmt(g.wert) + '</span></div>' +
                '<div class="voucher__code" data-code="' + esc(g.code) + '">' + fmt(g.code) + '</div>' +
                '<button type="button" class="voucher__btn"><span>' + esc(g.buttonText) + '</span></button>' +
              '</div>' +
              (b.gruss ? '<p class="letter__sign">' + fmt(b.gruss) + '</p>' : '') +
            '</div>' +
          '</div>' +
          pocket + flap +
          '<span class="seal">' +
            '<span class="seal__half seal__half--l">' + sealFace + '</span>' +
            '<span class="seal__half seal__half--r">' + sealFace + '</span>' +
          '</span>' +
        '</div>' +
      '</div>';

    return paperPage({ cls: 'page--letter', html: html });
  }

  function wireLetter(page) {
    var env = $('.envelope', page);
    var letter = $('.letter', page);
    var stage = $('.env-stage', page);
    var content = $('.letter__content', page);
    var btn = $('.voucher__btn', page);
    var state = 'closed';

    guard(env, function () { return state !== 'done'; });
    guard(btn);

    function open() {
      if (state !== 'closed') return;
      state = 'opening';
      var t = reduceMotion ? 0.15 : 1;
      env.classList.add('is-cracking');
      setTimeout(function () { env.classList.add('is-open'); }, 380 * t);
      setTimeout(function () { env.classList.add('is-rising'); }, 1150 * t);
      setTimeout(function () {
        // Brief aus dem Umschlag nach vorne holen und entfalten
        letter.style.top = (-env.offsetTop) + 'px';
        letter.style.left = (-env.offsetLeft) + 'px';
        letter.style.width = stage.clientWidth + 'px';
        letter.style.height = stage.clientHeight + 'px';
        env.classList.add('is-out');
      }, 2050 * t);
      setTimeout(function () {
        fitBody(content, 0.62);
        env.classList.add('is-read');
        env.setAttribute('aria-label', 'Brief');
        env.removeAttribute('tabindex');
        state = 'done';
      }, 2850 * t);
    }

    env.addEventListener('click', open);
    env.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
    });

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var code = $('.voucher__code', page).getAttribute('data-code');
      copyText(code).then(function (ok) {
        var label = btn.querySelector('span');
        label.textContent = ok ? D.anhang.brief.gutschein.kopiertText : 'Bitte manuell kopieren';
        btn.classList.toggle('is-done', ok);
        if (!ok) selectText($('.voucher__code', page));
        setTimeout(function () {
          label.textContent = D.anhang.brief.gutschein.buttonText;
          btn.classList.remove('is-done');
        }, 2200);
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
  /* Text an Seitengröße anpassen                                         */
  /* ------------------------------------------------------------------ */

  function fitBody(body, min) {
    var s = 1;
    body.style.setProperty('--fit', '1');
    while (body.scrollHeight > body.clientHeight + 1 && s > (min || 0.7)) {
      s -= 0.03;
      body.style.setProperty('--fit', s.toFixed(3));
    }
  }

  /* ------------------------------------------------------------------ */
  /* Konfetti                                                            */
  /* ------------------------------------------------------------------ */

  function confetti(canvas) {
    if (reduceMotion || !canvas) return;
    var page = canvas.parentNode;
    var w = page.clientWidth, h = page.clientHeight;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    var colors = ['#c8a24c', '#e6cf8f', '#a67c2e', '#7b2230', '#f3e7cc'];
    var parts = [];
    for (var i = 0; i < 70; i++) {
      parts.push({
        x: Math.random() * w,
        y: -20 - Math.random() * h * 0.6,
        vy: 0.9 + Math.random() * 1.4,
        sway: 0.6 + Math.random() * 1.2,
        phase: Math.random() * Math.PI * 2,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.12,
        size: 3 + Math.random() * 4,
        color: colors[i % colors.length]
      });
    }

    var start = performance.now();
    var dur = 4200;
    canvas.style.opacity = '1';

    function frame(now) {
      var t = now - start;
      ctx.clearRect(0, 0, w, h);
      parts.forEach(function (p) {
        p.y += p.vy;
        p.phase += 0.035;
        p.rot += p.vr;
        var x = p.x + Math.sin(p.phase) * p.sway * 8;
        ctx.save();
        ctx.translate(x, p.y);
        ctx.rotate(p.rot);
        ctx.scale(1, Math.abs(Math.cos(p.phase * 1.3)) + 0.2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = 0.85;
        ctx.fillRect(-p.size / 2, -p.size * 0.3, p.size, p.size * 0.6);
        ctx.restore();
      });
      if (t > dur - 900) canvas.style.opacity = '0';
      if (t < dur) requestAnimationFrame(frame);
      else ctx.clearRect(0, 0, w, h);
    }
    requestAnimationFrame(frame);
  }

  /* ------------------------------------------------------------------ */
  /* Buch                                                                */
  /* ------------------------------------------------------------------ */

  var flip = null;
  var dims = null;
  var confettiShown = false;
  var flippedOnce = false;
  var building = false;
  var bookPages = [];

  function computeDims() {
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var controls = 78;               // Navigation unter dem Buch
    var ratio = 1.5;                 // Höhe / Breite einer Seite
    var landscape = vw > vh && vw >= 720;
    var availH = vh - controls - 20;
    var w = landscape
      ? Math.min((vw - 48) / 2, availH / ratio, 440)
      : Math.min(vw - 28, availH / ratio, 470);
    w = Math.floor(Math.max(w, 220));
    return { w: w, h: Math.floor(w * ratio), landscape: landscape };
  }

  function waitFonts() {
    if (!document.fonts || !document.fonts.ready) return Promise.resolve();
    return Promise.race([
      document.fonts.ready,
      new Promise(function (r) { setTimeout(r, 2500); })
    ]);
  }

  function build(startPage) {
    if (building) return;
    building = true;
    dims = computeDims();

    var root = document.documentElement;
    root.style.setProperty('--pw', dims.w + 'px');
    root.style.setProperty('--ph', dims.h + 'px');

    var host = $('#book-host');
    host.classList.toggle('is-landscape', dims.landscape);
    host.classList.toggle('is-portrait', !dims.landscape);

    if (flip) { try { flip.destroy(); } catch (e) { /* egal */ } flip = null; }
    host.innerHTML = '';

    var pages = buildPages();

    // Unsichtbar messen und Texte einpassen
    var measure = $('#measure');
    measure.innerHTML = '';
    pages.forEach(function (p) {
      p.style.width = dims.w + 'px';
      p.style.height = dims.h + 'px';
      measure.appendChild(p);
    });

    waitFonts().then(function () {
      pages.forEach(function (p) {
        var body = p.querySelector('.page__body');
        if (body) fitBody(body, p.classList.contains('page--cover') ? 0.6 : 0.7);
      });

      var book = el('div', 'book');
      host.appendChild(book);
      pages.forEach(function (p) { p.style.width = ''; p.style.height = ''; });

      flip = new St.PageFlip(book, {
        width: dims.w,
        height: dims.h,
        size: 'fixed',
        showCover: true,
        usePortrait: true,
        mobileScrollSupport: false,
        maxShadowOpacity: 0.35,
        flippingTime: 850,
        swipeDistance: 24,
        startPage: Math.min(startPage || 0, pages.length - 1),
        autoSize: true
      });
      flip.loadFromHTML(pages);
      bookPages = pages;
      measure.innerHTML = '';

      wireLetter(pages[special.anhang]);

      flip.on('flip', function (e) { onPage(e.data); });
      flip.on('changeState', function (e) {
        if (e.data === 'user_fold' || e.data === 'flipping') hideHint();
      });

      onPage(flip.getCurrentPageIndex());
      building = false;
    });
  }

  function visiblePages(i) {
    if (!dims.landscape) return [i];
    return [i, i + 1];
  }

  function onPage(i) {
    var total = flip.getPageCount();
    $('#counter').textContent = (i + 1) + ' / ' + total;
    $('#prev').disabled = i <= 0;
    $('#next').disabled = i >= total - (dims.landscape ? 2 : 1);
    if (i > 0) hideHint();

    var vis = visiblePages(i);
    if (vis.indexOf(special.epilog) !== -1) {
      if (!confettiShown) {
        confettiShown = true;
        var page = bookPages[special.epilog];
        setTimeout(function () { confetti(page.querySelector('.confetti')); }, 150);
      }
    } else {
      confettiShown = false;   // beim erneuten Aufschlagen wieder
    }
  }

  function hideHint() {
    if (flippedOnce) return;
    flippedOnce = true;
    $('#flip-hint').classList.add('is-hidden');
  }

  /* ------------------------------------------------------------------ */
  /* Musik                                                               */
  /* ------------------------------------------------------------------ */

  function setupMusic() {
    var m = D.musik;
    var btn = $('#music');
    if (!m || !m.aktiv || !m.datei) return;

    var audio = new Audio();
    audio.loop = true;
    audio.preload = 'none';
    audio.src = m.datei;
    audio.volume = m.lautstaerke == null ? 0.5 : m.lautstaerke;

    function setState(on) {
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      btn.setAttribute('aria-label', on ? D.ui.musikAus : D.ui.musikAn);
      btn.classList.toggle('is-on', on);
    }
    setState(false);
    btn.hidden = false;

    // Datei nicht vorhanden? Dann Button ausblenden (klappt nur online, lokal egal).
    if (location.protocol.indexOf('http') === 0 && window.fetch) {
      fetch(m.datei, { method: 'HEAD' }).then(function (r) { if (!r.ok) btn.hidden = true; }).catch(function () {});
    }

    audio.addEventListener('error', function () { btn.hidden = true; });
    btn.addEventListener('click', function () {
      if (audio.paused) {
        var p = audio.play();
        if (p && p.then) p.then(function () { setState(true); }, function () { setState(false); });
        else setState(true);
      } else {
        audio.pause();
        setState(false);
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /* Passwort                                                            */
  /* ------------------------------------------------------------------ */

  function norm(s) { return String(s || '').trim().toLowerCase(); }

  function unlock() {
    var gate = $('#gate');
    try { sessionStorage.setItem('buch-offen', '1'); } catch (e) { /* egal */ }
    gate.classList.add('is-leaving');
    $('#stage').hidden = false;
    setTimeout(function () { gate.remove(); }, 700);
    build(0);
    setupMusic();
  }

  function setupGate() {
    document.querySelectorAll('[data-text]').forEach(function (n) {
      var v = get(n.getAttribute('data-text'));
      if (v) n.innerHTML = fmt(v); else n.remove();
    });
    $('#flip-hint').textContent = D.ui.blaetternHinweis;

    var ok = false;
    try { ok = sessionStorage.getItem('buch-offen') === '1'; } catch (e) { /* egal */ }
    if (ok) { $('#gate').remove(); $('#stage').hidden = false; build(0); setupMusic(); return; }

    var form = $('#gate-form'), input = $('#gate-input'), err = $('#gate-error');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (norm(input.value) === norm(D.passwort)) {
        input.blur();
        // Tastatur auf dem Handy erst einfahren lassen, dann Maße berechnen
        setTimeout(unlock, 250);
      } else {
        err.textContent = D.passwortSeite.fehler;
        form.classList.remove('is-wrong');
        void form.offsetWidth;
        form.classList.add('is-wrong');
        input.select();
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /* Start                                                               */
  /* ------------------------------------------------------------------ */

  $('#prev').addEventListener('click', function () { if (flip) flip.flipPrev(); });
  $('#next').addEventListener('click', function () { if (flip) flip.flipNext(); });
  document.addEventListener('keydown', function (e) {
    if (!flip || document.activeElement && document.activeElement.tagName === 'INPUT') return;
    if (e.key === 'ArrowRight') flip.flipNext();
    if (e.key === 'ArrowLeft') flip.flipPrev();
  });

  // Bei Drehen des Handys / Fenstergröße neu aufbauen
  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      if (!flip || !dims) return;
      var next = computeDims();
      if (Math.abs(next.w - dims.w) > 2 || next.landscape !== dims.landscape) {
        build(flip.getCurrentPageIndex());
      }
    }, 300);
  });

  setupGate();
})();
