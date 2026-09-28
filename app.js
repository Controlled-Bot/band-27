/* Band 27: Sperrbildschirm, Entschlüsseln, 3D-Buch, Wallet-Karte, Konfetti, Musik.
   Die Inhalte stehen verschlüsselt in inhalt.enc.js (Quelle: inhalt/data.js). */
(function () {
  'use strict';

  var ENC = window.BUCH_ENC;
  var KEY_STORE = 'band27-key';
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var D = null, IMAGES = {}, cryptoKey = null;

  /* ------------------------------------------------------------------ */
  /* Helfer                                                              */
  /* ------------------------------------------------------------------ */

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function fmt(s) {
    return esc(s)
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/\[([^\]]+)\]/g, '<mark class="ph">[$1]</mark>');
  }
  function paras(list, leadCls) {
    return (list || []).map(function (t, i) {
      if (t === '#chat') return chatHtml();
      return '<p' + (leadCls && i === 0 ? ' class="' + leadCls + '"' : '') + '>' + fmt(t) + '</p>';
    }).join('');
  }
  function chatHtml() {
    var chat = (D.cover && D.cover.chat) || [];
    if (!chat.length) return '';
    return '<div class="imsgs">' + chat.map(function (m) {
      return '<div class="imsg imsg--' + (m.von === 'ich' ? 'me' : 'them') + '">' + fmt(m.text) + '</div>';
    }).join('') + '</div>';
  }
  function fromB64(s) {
    var bin = atob(s), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function toB64(buf) {
    var b = new Uint8Array(buf), s = '';
    for (var i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
    return btoa(s);
  }
  function haptic(ms) {
    if (navigator.vibrate) { try { navigator.vibrate(ms || 8); } catch (e) { /* egal */ } }
  }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function debounce(fn, ms) {
    var t;
    return function () { clearTimeout(t); t = setTimeout(fn, ms); };
  }

  /* ------------------------------------------------------------------ */
  /* Krypto                                                              */
  /* ------------------------------------------------------------------ */

  function deriveKey(password) {
    var enc = new TextEncoder().encode(String(password).trim().toLowerCase());
    return crypto.subtle.importKey('raw', enc, 'PBKDF2', false, ['deriveKey']).then(function (base) {
      return crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt: fromB64(ENC.salt), iterations: ENC.iter, hash: 'SHA-256' },
        base, { name: 'AES-GCM', length: 256 }, true, ['decrypt']);
    });
  }
  function decryptPayload(key) {
    return crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(ENC.iv) }, key, fromB64(ENC.data))
      .then(function (buf) { return JSON.parse(new TextDecoder().decode(buf)); });
  }
  function remember(key) {
    crypto.subtle.exportKey('raw', key).then(function (raw) {
      try { sessionStorage.setItem(KEY_STORE + ENC.salt, toB64(raw)); } catch (e) { /* egal */ }
    });
  }
  function storedKey() {
    var raw = null;
    try { raw = sessionStorage.getItem(KEY_STORE + ENC.salt); } catch (e) { /* egal */ }
    if (!raw) return Promise.reject();
    return crypto.subtle.importKey('raw', fromB64(raw), { name: 'AES-GCM' }, true, ['decrypt']);
  }

  /* ------------------------------------------------------------------ */
  /* Sperrbildschirm                                                     */
  /* ------------------------------------------------------------------ */

  var KEYS = [['1', ''], ['2', 'ABC'], ['3', 'DEF'], ['4', 'GHI'], ['5', 'JKL'], ['6', 'MNO'],
              ['7', 'PQRS'], ['8', 'TUV'], ['9', 'WXYZ'], null, ['0', ''], null];

  function setupLock() {
    var lock = $('#lock'), msg = $('#lock-msg'), dots = $('#dots'), del = $('#lock-del');
    var entry = '', busy = false;

    if (!ENC || !window.crypto || !crypto.subtle) {
      msg.textContent = !ENC ? 'Inhalt fehlt. Bitte zuerst "Website bauen" ausführen.' : 'Bitte die Seite über https öffnen.';
      $('#keypad').hidden = true;
      del.hidden = true;
      return;
    }
    if (ENC.hint) { $('#lock-hint').textContent = ENC.hint; $('#lock-hint').hidden = false; }

    storedKey().then(function (key) {
      return decryptPayload(key).then(function (p) { cryptoKey = key; start(p, true); });
    }).catch(function () { /* Code nötig */ });

    function attempt(value) {
      busy = true;
      lock.classList.add('is-busy');
      msg.textContent = '';
      return deriveKey(value).then(function (key) {
        return decryptPayload(key).then(function (p) {
          cryptoKey = key;
          remember(key);
          haptic(12);
          lock.classList.remove('is-busy');
          lock.classList.add('is-ok');
          return wait(260).then(function () { start(p, false); });
        });
      }).catch(function () {
        busy = false;
        lock.classList.remove('is-busy');
        haptic([30, 40, 30]);
        msg.textContent = 'Falscher Code';
        lock.classList.remove('is-wrong');
        void lock.offsetWidth;
        lock.classList.add('is-wrong');
        return wait(450).then(function () { entry = ''; render(); });
      });
    }

    if (!ENC.numeric) {
      // Passwort mit Buchstaben: klassisches Eingabefeld
      $('#keypad').hidden = true;
      del.hidden = true;
      dots.hidden = true;
      var form = $('#lock-form'), input = $('#lock-input');
      form.hidden = false;
      $('.lock__title').textContent = 'Passwort eingeben';
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        if (busy || !input.value.trim()) return;
        input.blur();
        attempt(input.value).then(function () { input.value = ''; });
      });
      return;
    }

    var len = ENC.len || 4;
    dots.innerHTML = new Array(len + 1).join('<span class="dot"></span>');
    var pad = $('#keypad');
    pad.innerHTML = KEYS.map(function (k) {
      if (!k) return '<span class="key key--empty"></span>';
      return '<button type="button" class="key" data-digit="' + k[0] + '" aria-label="' + k[0] + '">' +
        '<span class="key__num">' + k[0] + '</span>' + (k[1] ? '<span class="key__abc">' + k[1] + '</span>' : '') + '</button>';
    }).join('');

    function render() {
      $$('.dot', dots).forEach(function (d, i) { d.classList.toggle('is-filled', i < entry.length); });
      del.classList.toggle('is-visible', entry.length > 0);
    }

    function press(d) {
      if (busy || entry.length >= len) return;
      haptic(6);
      entry += d;
      render();
      if (entry.length === len) setTimeout(function () { attempt(entry); }, 120);
    }

    pad.addEventListener('click', function (e) {
      var k = e.target.closest('.key[data-digit]');
      if (k) press(k.getAttribute('data-digit'));
    });
    del.addEventListener('click', function () {
      if (busy || !entry) return;
      entry = entry.slice(0, -1);
      render();
    });
    document.addEventListener('keydown', function onKey(e) {
      if (!document.body.contains(lock)) { document.removeEventListener('keydown', onKey); return; }
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace' && !busy) { entry = entry.slice(0, -1); render(); }
    });
    render();
  }

  function start(payload, instant) {
    D = payload.content;
    IMAGES = payload.images || {};
    var lock = $('#lock');
    buildBook();
    if (instant) lock.remove();
    else {
      lock.classList.add('is-leaving');
      setTimeout(function () { lock.remove(); }, 700);
    }
    if (payload.hasAudio) setupMusic();
  }

  /* ------------------------------------------------------------------ */
  /* Seiten                                                              */
  /* ------------------------------------------------------------------ */

  var sheets = [];        // { el, label }
  var special = {};

  function page(label, bodyHtml, cls, opts) {
    opts = opts || {};
    var n = sheets.length + 1;
    var el = document.createElement('div');
    el.className = 'sheet';
    el.innerHTML =
      '<div class="face face--front"><div class="pg ' + (cls || '') + '">' +
        (opts.head === false ? '' : '<header class="pg__head">' + fmt(opts.head || label) + '</header>') +
        '<div class="pg__body">' + bodyHtml + '</div>' +
        (opts.number === false ? '' : '<footer class="pg__num">' + n + '</footer>') +
      '</div><span class="shade" aria-hidden="true"></span></div>' +
      '<div class="face face--back"><span class="shade" aria-hidden="true"></span></div>';
    sheets.push({ el: el, label: label });
    return el;
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
          '<p class="cover__band">' + fmt(c.untertitel) + '</p>' +
          '<h1 class="cover__title">' + fmt(c.titel) + '</h1>' +
        '</div>' +
      '</div>' +
      '<div class="face face--back cover__inside"></div>';
  }

  function buildPages() {
    sheets = [];
    special = {};

    page('Widmung', '<div class="dedication">' + paras(D.widmung.text) + '</div>', 'pg--center', { head: false });

    var pr = D.prolog;
    (pr.seiten || []).forEach(function (s, i) {
      page(pr.label, (i ? '' : opener(pr.label, pr.titel)) + '<div class="prose">' + paras(s, i ? '' : 'lead') + '</div>',
        '', { head: i ? pr.label : false });
    });

    var k = D.kapitel;
    page(k.label, opener(k.label, k.titel) + '<div class="prose">' + paras(k.intro, 'lead') + '</div>', '', { head: false });
    (k.fotos || []).forEach(function (f, i) {
      var src = IMAGES[f.bild];
      page(k.label,
        '<figure class="photo">' +
          (src ? '<img class="photo__img" src="' + src + '" alt="" draggable="false"' + (f.fokus ? ' style="object-position:' + esc(f.fokus) + '"' : '') + '>'
               : '<div class="photo__img photo__img--missing"><span>Foto folgt<small>' + esc(f.bild) + '</small></span></div>') +
          '<figcaption><span class="photo__no">Abb. ' + (i + 1) + '</span>' + fmt(f.text) + '</figcaption>' +
        '</figure>', 'pg--photo', { head: k.label + ' · ' + k.titel });
    });

    var ep = D.epilog;
    special.epilog = sheets.length;
    var epEl = page(ep.label, opener(ep.label, ep.titel) + '<div class="prose">' + paras(ep.text, 'lead') + '</div>' +
      (ep.gruss ? '<p class="signature">' + fmt(ep.gruss) + '</p>' : ''), '', { head: false });
    var cv = document.createElement('canvas');
    cv.className = 'confetti';
    $('.face--front', epEl).appendChild(cv);

    var a = D.anhang, b = a.brief;
    page(a.label, opener(a.label, a.titel) +
      '<div class="letter"><p class="letter__salute">' + fmt(b.anrede) + '</p>' + paras(b.text) +
      (b.gruss ? '<p class="signature">' + fmt(b.gruss) + '</p>' : '') + '</div>', '', { head: false });

    special.wallet = sheets.length;
    page(a.label, walletHtml(), 'pg--wallet', { head: a.label + ' · ' + (b.gutschein.titel || '') });

    var r = D.rueckseite;
    page('Rückseite',
      '<div class="back">' +
        '<p class="back__blurb">' + fmt(r.klappentext) + '</p>' +
        '<div class="back__reviews">' + (r.rezensionen || []).map(function (x) {
          return '<blockquote class="review"><p>' + fmt(x.text) + '</p><cite>' + fmt(x.quelle) + '</cite></blockquote>';
        }).join('') + '</div>' +
        '<div class="back__foot"><button type="button" class="pill pill--ghost restart">Von vorn lesen</button>' +
        '<span class="back__isbn">' + fmt(r.isbn || '') + '</span></div>' +
      '</div>', 'pg--back', { head: false, number: false });
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
  var TURN_MS = 720;

  function buildBook() {
    buildPages();
    stage = $('#stage');
    book = $('#book');
    book.innerHTML =
      '<span class="book__board" aria-hidden="true"></span>' +
      '<span class="book__edges" aria-hidden="true"></span>' +
      '<div class="book__pages"></div>' +
      '<div class="cover" role="button" tabindex="0" aria-label="Buch öffnen">' + coverHtml() + '</div>';
    cover = $('.cover', book);
    var holder = $('.book__pages', book);
    // Umgekehrte Reihenfolge: In 3D-Kontexten (Safari) zählt die DOM-Reihenfolge statt z-index,
    // das aktuelle Blatt muss also nach den folgenden Blättern kommen.
    sheets.slice().reverse().forEach(function (s) { holder.appendChild(s.el); });

    wireWallet(sheets[special.wallet].el);
    $('.restart', book).addEventListener('click', restart);

    stage.hidden = false;
    layout();
    placeSheets();
    setupGestures();
    window.addEventListener('resize', debounce(layout, 150));
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitAll);
  }

  function layout() {
    var vw = window.innerWidth, vh = window.innerHeight;
    var reserve = 116;                       // Navigationsleiste + Abstände
    var w = Math.min(vw - 56, (vh - reserve - 40) / 1.45, 420);
    w = Math.max(230, Math.floor(w));
    var root = document.documentElement.style;
    root.setProperty('--bw', w + 'px');
    root.setProperty('--bh', Math.floor(w * 1.45) + 'px');
    fitAll();
  }

  // Texte an die Seitengröße anpassen (notfalls scrollt die Seite)
  function fitAll() {
    sheets.forEach(function (s) {
      var body = $('.pg__body', s.el);
      if (!body || s.el.querySelector('.pg--wallet')) return;
      var f = 1;
      body.style.setProperty('--fit', '1');
      while (body.scrollHeight > body.clientHeight + 1 && f > 0.74) {
        f -= 0.03;
        body.style.setProperty('--fit', f.toFixed(3));
      }
      body.classList.toggle('is-scroll', body.scrollHeight > body.clientHeight + 1);
    });
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
    if (current === special.epilog) {
      var cv = $('.confetti', sheets[current].el);
      setTimeout(function () { if (current === special.epilog) confetti(cv); }, 200);
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
  /* Musik (verschlüsselt, wird im Hintergrund entschlüsselt)            */
  /* ------------------------------------------------------------------ */

  function setupMusic() {
    var btn = $('#music'), audio = null;
    function setState(on) {
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      btn.setAttribute('aria-label', on ? 'Musik aus' : 'Musik an');
      btn.classList.toggle('is-on', on);
    }
    fetch('musik.enc').then(function (r) {
      if (!r.ok) throw new Error('404');
      return r.arrayBuffer();
    }).then(function (buf) {
      var bytes = new Uint8Array(buf);
      return crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.slice(0, 12) }, cryptoKey, bytes.slice(12));
    }).then(function (plain) {
      audio = new Audio(URL.createObjectURL(new Blob([plain], { type: 'audio/mpeg' })));
      audio.loop = true;
      audio.preload = 'auto';
      audio.volume = D.musik && D.musik.lautstaerke != null ? D.musik.lautstaerke : 0.5;
      btn.hidden = false;
    }).catch(function () { btn.hidden = true; });

    btn.addEventListener('click', function () {
      if (!audio) return;
      if (audio.paused) {
        var p = audio.play();
        setState(true);
        if (p && p.catch) p.catch(function () { setState(false); });
      } else { audio.pause(); setState(false); }
    });
  }

  setupLock();
})();
