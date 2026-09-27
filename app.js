/* Band 27: Entschlüsseln, Seiten bauen, Blättern, Brief, Konfetti, Musik.
   Die Inhalte stehen verschlüsselt in inhalt.enc.js (Quelle: inhalt/data.js). */
(function () {
  'use strict';

  var ENC = window.BUCH_ENC;
  var KEY_STORE = 'band27-key';
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var D = null;          // entschlüsselter Inhalt
  var IMAGES = {};
  var cryptoKey = null;

  /* ------------------------------------------------------------------ */
  /* Helfer                                                              */
  /* ------------------------------------------------------------------ */

  function $(sel, root) { return (root || document).querySelector(sel); }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  // *kursiv* und [Platzhalter]
  function fmt(s) {
    return esc(s)
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/\[([^\]]+)\]/g, '<mark class="ph">[$1]</mark>');
  }

  function paras(list, cls) {
    return (list || []).map(function (t, i) {
      return '<p' + (cls && i === 0 ? ' class="' + cls + '"' : '') + '>' + fmt(t) + '</p>';
    }).join('');
  }

  function fromB64(s) {
    var bin = atob(s), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function toB64(buf) {
    var bytes = new Uint8Array(buf), s = '';
    for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s);
  }

  /* ------------------------------------------------------------------ */
  /* Entschlüsseln                                                       */
  /* ------------------------------------------------------------------ */

  function deriveKey(password) {
    var enc = new TextEncoder().encode(String(password).trim().toLowerCase());
    return crypto.subtle.importKey('raw', enc, 'PBKDF2', false, ['deriveKey']).then(function (base) {
      return crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt: fromB64(ENC.salt), iterations: ENC.iter, hash: 'SHA-256' },
        base, { name: 'AES-GCM', length: 256 }, true, ['decrypt']
      );
    });
  }

  function decryptPayload(key) {
    return crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(ENC.iv) }, key, fromB64(ENC.data))
      .then(function (buf) { return JSON.parse(new TextDecoder().decode(buf)); });
  }

  function remember(key) {
    crypto.subtle.exportKey('raw', key).then(function (raw) {
      try { sessionStorage.setItem(KEY_STORE, toB64(raw)); } catch (e) { /* egal */ }
    });
  }

  function storedKey() {
    var raw = null;
    try { raw = sessionStorage.getItem(KEY_STORE); } catch (e) { /* egal */ }
    if (!raw) return Promise.reject();
    return crypto.subtle.importKey('raw', fromB64(raw), { name: 'AES-GCM' }, true, ['decrypt']);
  }

  /* ------------------------------------------------------------------ */
  /* Passwort-Bildschirm                                                 */
  /* ------------------------------------------------------------------ */

  function setupGate() {
    var form = $('#gate-form'), input = $('#gate-input'), btn = $('#gate-btn'), err = $('#gate-error');

    if (!ENC || !window.crypto || !crypto.subtle) {
      err.textContent = !ENC
        ? 'Inhalt fehlt. Bitte zuerst "Website bauen" ausführen.'
        : 'Bitte die Seite über https öffnen.';
      btn.disabled = true;
      return;
    }
    if (ENC.hint) { $('#gate-hint').textContent = ENC.hint; $('#gate-hint').hidden = false; }
    if (ENC.numeric) input.setAttribute('inputmode', 'numeric');

    // Schon in diesem Tab entsperrt?
    storedKey().then(function (key) {
      return decryptPayload(key).then(function (p) { cryptoKey = key; open(p, true); });
    }).catch(function () { /* Passwort nötig */ });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (btn.classList.contains('is-busy') || !input.value.trim()) return;
      btn.classList.add('is-busy');
      err.textContent = '';
      deriveKey(input.value).then(function (key) {
        return decryptPayload(key).then(function (p) {
          cryptoKey = key;
          remember(key);
          input.blur();
          setTimeout(function () { open(p, false); }, 150);
        });
      }).catch(function () {
        btn.classList.remove('is-busy');
        err.textContent = 'Das war leider nicht das richtige Passwort.';
        form.classList.remove('is-wrong');
        void form.offsetWidth;
        form.classList.add('is-wrong');
        input.select();
      });
    });
  }

  function open(payload, instant) {
    D = payload.content;
    IMAGES = payload.images || {};
    var gate = $('#gate');
    if (instant) gate.remove();
    else {
      gate.classList.add('is-leaving');
      setTimeout(function () { gate.remove(); }, 600);
    }
    buildBook();
    if (payload.hasAudio) setupMusic();
  }

  /* ------------------------------------------------------------------ */
  /* Seiten                                                              */
  /* ------------------------------------------------------------------ */

  var screens = [];
  var special = {};

  function screen(html, cls) {
    var s = document.createElement('section');
    s.className = 'screen' + (cls ? ' ' + cls : '');
    s.innerHTML = '<div class="screen__inner">' + html + '</div>';
    screens.push(s);
    return s;
  }

  function chapterHead(label, title) {
    return '<header class="chap reveal">' +
      '<p class="eyebrow">' + fmt(label) + '</p>' +
      '<h2 class="chap__title">' + fmt(title) + '</h2>' +
      '</header>';
  }

  function runningHead(text) {
    return '<p class="running reveal">' + fmt(text) + '</p>';
  }

  function buildPages() {
    screens = [];
    special = {};

    // 1. Cover
    var c = D.cover;
    var chat = (c.chat || []).map(function (m, i) {
      return '<div class="bubble bubble--' + (m.von === 'ich' ? 'me' : 'her') + ' reveal" style="--d:' + (0.35 + i * 0.12) + 's">' + fmt(m.text) + '</div>';
    }).join('');
    screen(
      '<div class="cover">' +
        '<div class="cover__head">' +
          '<span class="cover__rule reveal"></span>' +
          '<h1 class="cover__title reveal" style="--d:.08s">' + fmt(c.titel) + '</h1>' +
          '<p class="cover__sub reveal" style="--d:.18s">' + fmt(c.untertitel) + '</p>' +
        '</div>' +
        (chat ? '<div class="chat">' + chat + '</div>' : '') +
        '<p class="swipe-hint reveal" style="--d:.9s">' + fmt(D.ui && D.ui.blaetternHinweis || '') +
          ' <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></p>' +
      '</div>', 'screen--cover');

    // 2. Widmung
    screen('<div class="dedication reveal">' + paras(D.widmung.text) + '</div>', 'screen--center');

    // 3. Prolog
    var pr = D.prolog;
    (pr.seiten || []).forEach(function (seite, i) {
      screen(
        (i ? runningHead(pr.label) : chapterHead(pr.label, pr.titel)) +
        '<div class="prose reveal" style="--d:.12s">' + paras(seite, i ? '' : 'lead') + '</div>');
    });

    // 4. Kapitel 27
    var k = D.kapitel;
    screen(chapterHead(k.label, k.titel) + '<div class="prose reveal" style="--d:.12s">' + paras(k.intro, 'lead') + '</div>');
    (k.fotos || []).forEach(function (f, i) {
      var src = IMAGES[f.bild];
      var media = src
        ? '<img class="photo__img" src="' + src + '" alt="">'
        : '<div class="photo__img photo__img--missing"><span>Foto folgt<small>' + esc(f.bild) + '</small></span></div>';
      screen(
        runningHead(k.label + ' · ' + k.titel) +
        '<figure class="photo">' +
          '<div class="reveal" style="--d:.05s">' + media + '</div>' +
          '<figcaption class="reveal" style="--d:.2s"><span class="photo__no">Abb. ' + (i + 1) + '</span>' + fmt(f.text) + '</figcaption>' +
        '</figure>', 'screen--photo');
    });

    // 5. Epilog
    var ep = D.epilog;
    special.epilog = screens.length;
    screen(
      chapterHead(ep.label, ep.titel) +
      '<div class="prose reveal" style="--d:.12s">' + paras(ep.text, 'lead') + '</div>' +
      (ep.gruss ? '<p class="signature reveal" style="--d:.3s">' + fmt(ep.gruss) + '</p>' : ''),
      'screen--epilog').appendChild(document.createElement('canvas')).className = 'confetti';

    // 6. Anhang
    special.anhang = screens.length;
    screen(letterHtml(), 'screen--letter');

    // 7. Rückseite
    var r = D.rueckseite;
    screen(
      '<div class="back">' +
        '<p class="back__blurb reveal">' + fmt(r.klappentext) + '</p>' +
        '<div class="back__reviews">' + (r.rezensionen || []).map(function (x, i) {
          return '<blockquote class="review reveal" style="--d:' + (0.15 + i * 0.1) + 's"><p>' + fmt(x.text) + '</p><cite>' + fmt(x.quelle) + '</cite></blockquote>';
        }).join('') + '</div>' +
        '<div class="back__foot reveal" style="--d:.4s">' +
          '<button type="button" class="restart">Von vorn lesen</button>' +
          '<div class="barcode"><span class="barcode__bars"></span><span class="barcode__num">' + fmt(r.isbn || '') + '</span></div>' +
        '</div>' +
      '</div>', 'screen--back');
  }

  /* ------------------------------------------------------------------ */
  /* Anhang: Umschlag                                                    */
  /* ------------------------------------------------------------------ */

  function letterHtml() {
    var a = D.anhang, b = a.brief, g = b.gutschein;
    return chapterHead(a.label, a.titel) +
      '<div class="env-scene reveal" style="--d:.12s">' +
        '<div class="env" role="button" tabindex="0" aria-label="Brief öffnen">' +
          '<span class="env__back"></span>' +
          '<span class="env__letter"><span class="env__letter-line"></span><span class="env__letter-line"></span><span class="env__letter-line short"></span></span>' +
          '<span class="env__pocket"><span class="env__label">' + fmt(a.umschlag || '') + '</span></span>' +
          '<span class="env__flap"></span>' +
        '</div>' +
        '<p class="env-hint">' + fmt(a.hinweis) + '</p>' +
      '</div>' +
      '<article class="letter" data-no-flip hidden>' +
        '<div class="letter__body">' +
          '<p class="letter__salute">' + fmt(b.anrede) + '</p>' +
          paras(b.text) +
          '<div class="voucher">' +
            '<div class="voucher__row"><span class="voucher__title">' + fmt(g.titel) + '</span><span class="voucher__value">' + fmt(g.wert) + '</span></div>' +
            '<div class="voucher__code" data-code="' + esc(g.code) + '">' + fmt(g.code) + '</div>' +
            '<button type="button" class="voucher__btn"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/></svg><span>' + esc(g.buttonText) + '</span></button>' +
          '</div>' +
          (b.gruss ? '<p class="letter__sign">' + fmt(b.gruss) + '</p>' : '') +
        '</div>' +
      '</article>';
  }

  function wireLetter(page) {
    var env = $('.env', page);
    var scene = $('.env-scene', page);
    var paper = $('.env__letter', page);
    var letter = $('.letter', page);
    var btn = $('.voucher__btn', page);
    var opened = false;

    function openEnvelope() {
      if (opened) return;
      opened = true;
      var t = reduceMotion ? 0.1 : 1;
      env.classList.add('is-open');
      setTimeout(function () { env.classList.add('is-rising'); }, 450 * t);
      setTimeout(function () { env.classList.add('is-fading'); }, 1000 * t);
      setTimeout(function () {
        // FLIP: vom Briefpapier im Umschlag zur großen Karte
        var from = paper.getBoundingClientRect();
        scene.hidden = true;
        letter.hidden = false;
        var to = letter.getBoundingClientRect();
        var dy = from.top - to.top, dx = from.left - to.left;
        letter.style.transformOrigin = '0 0';
        letter.style.transform = 'translate(' + dx + 'px,' + dy + 'px) scale(' + (from.width / to.width) + ',' + (from.height / to.height) + ')';
        letter.getBoundingClientRect();
        letter.classList.add('is-morphing');
        letter.style.transform = '';
        setTimeout(function () {
          letter.classList.remove('is-morphing');
          letter.classList.add('is-shown');
        }, 650 * t);
      }, 1250 * t);
    }

    env.addEventListener('click', openEnvelope);
    env.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openEnvelope(); }
    });

    btn.addEventListener('click', function () {
      var code = $('.voucher__code', page).getAttribute('data-code');
      var label = btn.querySelector('span');
      var g = D.anhang.brief.gutschein;
      copyText(code).then(function (ok) {
        label.textContent = ok ? g.kopiertText : 'Bitte manuell kopieren';
        btn.classList.toggle('is-done', ok);
        if (!ok) selectText($('.voucher__code', page));
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

    var colors = ['#B4583A', '#1F1F1F', '#D9CFC3', '#E3B7A3', '#8A8580'];
    var parts = [];
    for (var i = 0; i < 60; i++) {
      parts.push({
        x: Math.random() * w,
        y: -10 - Math.random() * h * 0.5,
        vy: 1.1 + Math.random() * 1.6,
        phase: Math.random() * 6.28,
        sway: 4 + Math.random() * 8,
        rot: Math.random() * 3.14,
        vr: (Math.random() - 0.5) * 0.1,
        size: 4 + Math.random() * 4,
        round: Math.random() < 0.4,
        color: colors[i % colors.length]
      });
    }
    var start = performance.now(), dur = 3800;
    canvas.style.opacity = '1';
    (function frame(now) {
      var t = now - start;
      ctx.clearRect(0, 0, w, h);
      parts.forEach(function (p) {
        p.y += p.vy;
        p.phase += 0.03;
        p.rot += p.vr;
        ctx.save();
        ctx.translate(p.x + Math.sin(p.phase) * p.sway, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        if (p.round) { ctx.beginPath(); ctx.arc(0, 0, p.size / 2.4, 0, 6.28); ctx.fill(); }
        else ctx.fillRect(-p.size / 2, -p.size / 5, p.size, p.size / 2.5);
        ctx.restore();
      });
      if (t > dur - 800) canvas.style.opacity = '0';
      if (t < dur) requestAnimationFrame(frame); else ctx.clearRect(0, 0, w, h);
    })(start);
  }

  /* ------------------------------------------------------------------ */
  /* Blättern                                                            */
  /* ------------------------------------------------------------------ */

  var current = 0;
  var track, deck, bar;

  function buildBook() {
    buildPages();
    track = $('#track');
    deck = $('#deck');
    bar = $('#progress span');
    screens.forEach(function (s) { track.appendChild(s); });
    wireLetter(screens[special.anhang]);
    $('.restart', track).addEventListener('click', function () { go(0); });

    deck.hidden = false;
    $('#progress').hidden = false;
    setupGestures();
    go(0, true);
  }

  function go(i, instant) {
    i = Math.max(0, Math.min(screens.length - 1, i));
    var forward = i > current;
    current = i;
    track.classList.toggle('no-anim', !!instant);
    track.style.transform = 'translate3d(' + (-i * 100) + '%,0,0)';
    screens.forEach(function (s, n) {
      var active = n === i;
      s.classList.toggle('is-active', active);
      if (active) s.removeAttribute('inert'); else s.setAttribute('inert', '');
      s.setAttribute('aria-hidden', active ? 'false' : 'true');
    });
    if (forward || instant) screens[i].scrollTop = 0;
    bar.style.transform = 'scaleX(' + ((i + 1) / screens.length) + ')';
    document.body.classList.toggle('on-dark', screens[i].classList.contains('screen--back'));

    if (i === special.epilog) {
      var cv = $('.confetti', screens[i]);
      setTimeout(function () { if (current === special.epilog) confetti(cv); }, 350);
    }
  }

  function next() { if (current < screens.length - 1) go(current + 1); }
  function prev() { if (current > 0) go(current - 1); }

  function setupGestures() {
    var start = null, dragging = false, width = 1;

    function isInteractive(t) {
      return t.closest && t.closest('button, a, input, textarea, .env, [data-no-flip], .voucher__code');
    }

    deck.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      start = { x: e.clientX, y: e.clientY, t: performance.now(), interactive: isInteractive(e.target) };
      dragging = false;
      width = deck.clientWidth;
    });

    deck.addEventListener('pointermove', function (e) {
      if (!start) return;
      var dx = e.clientX - start.x, dy = e.clientY - start.y;
      if (!dragging) {
        if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.2) {
          dragging = true;
          track.classList.add('is-dragging');
          try { deck.setPointerCapture(e.pointerId); } catch (err) { /* egal */ }
        } else return;
      }
      var atEdge = (current === 0 && dx > 0) || (current === screens.length - 1 && dx < 0);
      var off = atEdge ? dx * 0.3 : dx;
      track.style.transform = 'translate3d(calc(' + (-current * 100) + '% + ' + off + 'px),0,0)';
    });

    function end(e, cancelled) {
      if (!start) return;
      var dx = e.clientX - start.x, dy = e.clientY - start.y;
      var dt = performance.now() - start.t;
      var s = start;
      start = null;
      track.classList.remove('is-dragging');

      if (dragging) {
        dragging = false;
        var fast = Math.abs(dx) / dt > 0.45;
        if (!cancelled && (Math.abs(dx) > width * 0.22 || fast)) {
          if (dx < 0) next(); else prev();
          if ((dx < 0 && current === screens.length - 1) || (dx > 0 && current === 0)) go(current);
        } else go(current);
        return;
      }
      // Tippen: linkes Drittel zurück, sonst weiter
      if (!cancelled && !s.interactive && Math.abs(dx) < 10 && Math.abs(dy) < 10 && dt < 500) {
        var sel = window.getSelection && String(window.getSelection());
        if (sel) return;
        if (e.clientX < width * 0.3) prev(); else next();
      }
    }

    deck.addEventListener('pointerup', function (e) { end(e, false); });
    deck.addEventListener('pointercancel', function (e) { end(e, true); });

    document.addEventListener('keydown', function (e) {
      if (e.target.closest && e.target.closest('input, textarea')) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); next(); }
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); prev(); }
    });
  }

  /* ------------------------------------------------------------------ */
  /* Musik (verschlüsselt, wird erst beim ersten Antippen geladen)       */
  /* ------------------------------------------------------------------ */

  function setupMusic() {
    var btn = $('#music');
    var audio = null;

    function setState(on) {
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      btn.setAttribute('aria-label', on ? 'Musik aus' : 'Musik an');
      btn.classList.toggle('is-on', on);
    }

    // Im Hintergrund laden und entschlüsseln, damit play() direkt beim Antippen
    // passiert (iOS erlaubt Musik nur unmittelbar nach einer Berührung).
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
      } else {
        audio.pause();
        setState(false);
      }
    });
  }

  setupGate();
})();
