/* Band 27: Buch mit StPageFlip (page-flip.js), Collage, Sprachnachricht, Konfetti, Musik.
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
    preloadImages();
    buildBook();
    if (data.hasAudio) setupMusic();
  }

  // Alle Fotos sofort dekodieren und die Objekte behalten, damit beim Blättern nichts nachlädt oder flackert
  var preloaded = [];
  function preloadImages() {
    Object.keys(IMAGES).forEach(function (k) {
      if (!IMAGES[k]) return;
      var im = new Image();
      im.src = IMAGES[k];
      if (im.decode) im.decode().catch(function () { /* egal */ });
      preloaded.push(im);
    });
  }

  /* ------------------------------------------------------------------ */
  /* Seiten                                                              */
  /* ------------------------------------------------------------------ */

  var pages = [];         // { el, label, key } in Buchreihenfolge, wie StPageFlip sie bekommt
  var special = {};       // key -> Seitenindex

  // Kleines Geburtstags-Emoji in einer Ecke der Seite: tr = oben rechts, br = unten rechts
  function accentHtml(emoji, pos, deg) {
    if (!emoji) return '';
    var html = '<span class="accent accent--' + pos + '" style="--r:' + deg + 'deg" aria-hidden="true">' + esc(emoji) + '</span>';
    // inline: Ankerpunkt ohne eigene Größe, damit ein großes Emoji die Zeile nicht verschiebt
    return pos === 'inline' ? '<span class="accent-anchor">' + html + '</span>' : html;
  }
  function acc(key, i) {
    var v = (D.akzente || {})[key];
    return Array.isArray(v) ? v[i % v.length] : (i ? '' : v);
  }

  // Inhalt einer Buchseite (ohne äußeres Seitenelement)
  function pgHtml(label, bodyHtml, cls, opts, n) {
    var leaves = /\bpg--leaves\b/.test(cls || '') ? '<div class="leaves" aria-hidden="true"></div>' : '';
    return '<div class="pg ' + (cls || '') + '">' + leaves + (opts.accent || '') +
        (opts.head === false ? '' : '<header class="pg__head">' + fmt(opts.head || label) + '</header>') +
        '<div class="pg__body">' + bodyHtml + '</div>' +
        (opts.number === false || !n ? '' : '<footer class="pg__num">' + n + '</footer>') +
      '</div>';
  }

  // Seitenelement für StPageFlip: data-density "hard" = Buchdeckel
  function addPage(key, label, innerHtml, cls, hard) {
    var el = document.createElement('div');
    el.className = 'page ' + (cls || '');
    el.setAttribute('data-density', hard ? 'hard' : 'soft');
    el.innerHTML = innerHtml;
    special[key] = pages.length;
    pages.push({ el: el, label: label, key: key });
    return el;
  }

  var pageNo = 0;
  function contentPage(key, label, bodyHtml, cls, opts) {
    opts = opts || {};
    return addPage(key, label, pgHtml(label, bodyHtml, cls, opts, opts.number === false ? 0 : ++pageNo), '');
  }

  /* Kapiteltext auf Buchseiten verteilen: Absätze werden in einer unsichtbaren Seite
     gleicher Größe gemessen und notfalls zwischen zwei Wörtern umbrochen. So passt jede
     Seite genau, ohne Scrollen und ohne abgeschnittene Zeilen. */
  var measureEl = null;

  function paginateChapter() {
    var k = D.kapitel, list = k.text || [];
    if (!measureEl) {
      measureEl = document.createElement('div');
      measureEl.className = 'page-measure';
      measureEl.setAttribute('aria-hidden', 'true');
      document.body.appendChild(measureEl);
    }
    var out = [], body, box, html;

    function newPage() {
      var first = !out.length;
      measureEl.innerHTML = '<div class="page">' +
        pgHtml(k.label, (first ? opener(k.label, k.titel) : '') + '<div class="chapter"></div>',
          'pg--chapter pg--leaves', { head: first ? false : k.label }, 1) + '</div>';
      body = $('.pg__body', measureEl);
      box = $('.chapter', body);
      html = [];
    }
    function fits() {                         // Textende mit kleinem Puffer gegen Rundungsunterschiede
      return box.getBoundingClientRect().bottom <= body.getBoundingClientRect().bottom - 3;
    }
    function commit() {
      out.push((out.length ? '' : opener(k.label, k.titel)) + '<div class="chapter">' + html.join('') + '</div>');
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
    return out;
  }

  function opener(label, title) {
    return '<p class="eyebrow">' + fmt(label) + '</p><h2 class="title">' + fmt(title) + '</h2>';
  }

  function coverHtml() {
    var c = D.cover;
    var img = c.bild && IMAGES[c.bild];
    return '<div class="cover__front' + (img ? ' has-image' : '') + '">' +
        (img ? '<img class="cover__img" src="' + img + '" alt="" draggable="false" style="object-position:' + esc(c.fokus || '50% 30%') + '">' +
               '<span class="cover__veil" aria-hidden="true"></span>' : '') +
        '<div class="cover__content">' +
          '<p class="cover__band">' + fmt(c.untertitel) + accentHtml(acc('cover', 0), 'inline', -10) + '</p>' +
          '<h1 class="cover__title">' + fmt(c.titel) + '</h1>' +
        '</div>' +
      '</div>';
  }

  /* Reihenfolge: Cover | Chat · Kapitel-Anfang | Kapitel … | Collage · Geschenk | Rückseite.
     In der Doppelseite muss die Zahl der Innenseiten gerade sein, sonst endet das Buch nicht
     mit der Rückseite als geschlossenem Deckel. Dafür kommt nach dem Kapitel eine Leerseite. */
  function buildPages(spread) {
    pages = [];
    special = {};
    pageNo = 0;

    addPage('cover', D.cover.untertitel || 'Cover', coverHtml(), 'page--cover', true);

    contentPage('chat', D.widmung.titel || 'Chat', tiktokChatHtml(D.widmung), 'pg--chat pg--leaves',
      { head: D.widmung.titel || false, accent: accentHtml(acc('chat', 0), 'br', -8) });

    var k = D.kapitel;
    chapterPages.forEach(function (html, i) {
      var el = contentPage('k' + i, k.label, html, 'pg--chapter pg--leaves', {
        head: i ? k.label : false,
        accent: accentHtml(acc('kapitel', i), i ? 'br' : 'tr', [9, -7, 6][i % 3])
      });
      if (!i) {
        var cv = document.createElement('canvas');
        cv.className = 'confetti';
        el.appendChild(cv);
      }
    });
    special.confetti = special.k0;

    var co = k.collage;
    var inner = 1 + chapterPages.length + (co ? 1 : 0) + (D.geschenk ? 1 : 0);
    if (spread && inner % 2) {
      addPage('blank', k.label, pgHtml(k.label, '', 'pg--blank pg--leaves', { head: false, number: false }), '');
    }

    if (co) {
      contentPage('collage', k.label,
        (co.titel ? '<h2 class="collage__title">' + fmt(co.titel) + '</h2>' : '') +
        '<div class="collage">' + (co.bilder || []).map(function (f) {
          var src = IMAGES[f.bild];
          return '<button type="button" class="collage__photo' + (f.ganz ? ' collage__photo--full' : '') + '" aria-label="Foto nach vorne holen">' +
            (src ? '<img src="' + src + '" alt="" draggable="false"' + (f.fokus ? ' style="object-position:' + esc(f.fokus) + '"' : '') + '>'
                 : '<span class="collage__missing">' + esc(f.bild) + '</span>') +
          '</button>';
        }).join('') + '</div>' +
        '<p class="collage__caption">' + fmt(co.unterschrift) + '</p>', 'pg--collage pg--leaves',
        { head: false, accent: accentHtml(acc('collage', 0), 'tr', -9) });
    }

    if (D.geschenk) {
      contentPage('gift', D.geschenk.label, giftHtml(D.geschenk), 'pg--gift',
        { head: false, accent: accentHtml(acc('geschenk', 0), 'tr', -8) });
    }

    var r = D.rueckseite;
    addPage('back', 'Rückseite', pgHtml('Rückseite',
      '<div class="back">' +
        (IMAGES[r.bild] ? '<img class="back__img" src="' + IMAGES[r.bild] + '" alt="" draggable="false"' +
          (r.fokus ? ' style="object-position:' + esc(r.fokus) + '"' : '') + '>' : '') +
        (r.sprachnachricht ? voiceHtml(r.sprachnachricht) : '') +
      '</div>', 'pg--back', { head: false, number: false }), 'page--backcover', true);
  }

  /* ------------------------------------------------------------------ */
  /* Sprachnachricht auf der Rückseite (iMessage-Stil, nur per Antippen) */
  /* ------------------------------------------------------------------ */

  var WAVE = [.35, .55, .8, .5, .95, .7, .4, .65, 1, .75, .5, .85, .6, .3, .7, .9, .55, .8, .45, .65, .95, .6, .4, .7, .5, .3];

  function voiceHtml(v) {
    return '<div class="voice">' +
      '<button type="button" class="voice__bubble" aria-label="Sprachnachricht abspielen">' +
        '<span class="voice__play" aria-hidden="true">' +
          '<svg class="voice__icon voice__icon--play" viewBox="0 0 24 24"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.2-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/></svg>' +
          '<svg class="voice__icon voice__icon--pause" viewBox="0 0 24 24"><rect x="6.5" y="5" width="4" height="14" rx="1.3"/><rect x="13.5" y="5" width="4" height="14" rx="1.3"/></svg>' +
        '</span>' +
        '<span class="voice__wave" aria-hidden="true">' + WAVE.map(function (h) {
          return '<i style="--h:' + h + '"></i>';
        }).join('') + '</span>' +
        '<span class="voice__time">' + esc(v.dauer || '') + '</span>' +
      '</button>' +
      '<audio class="voice__audio" preload="metadata" playsinline webkit-playsinline src="' + esc(v.datei) + '"></audio>' +
    '</div>';
  }

  var voiceStop = null;

  function wireVoice(root) {
    var btn = $('.voice__bubble', root), audio = $('.voice__audio', root);
    if (!btn || !audio) return;
    var bars = btn.querySelectorAll('.voice__wave i'), time = $('.voice__time', btn);
    var total = time.textContent, raf = 0;

    function mmss(sec) {
      sec = Math.max(0, Math.round(sec || 0));
      return Math.floor(sec / 60) + ':' + ('0' + (sec % 60)).slice(-2);
    }
    function paint() {
      var d = audio.duration, p = d ? audio.currentTime / d : 0;
      var n = Math.round(p * bars.length);
      for (var i = 0; i < bars.length; i++) bars[i].classList.toggle('is-played', i < n);
      time.textContent = mmss(audio.currentTime);
      if (!audio.paused) raf = requestAnimationFrame(paint);
    }
    function reset() {
      cancelAnimationFrame(raf);
      btn.classList.remove('is-playing');
      btn.setAttribute('aria-label', 'Sprachnachricht abspielen');
      for (var i = 0; i < bars.length; i++) bars[i].classList.remove('is-played');
      time.textContent = total;
    }

    audio.addEventListener('loadedmetadata', function () {
      if (isFinite(audio.duration) && audio.duration > 0) { total = mmss(audio.duration); if (audio.paused) time.textContent = total; }
    });
    audio.addEventListener('ended', function () { audio.currentTime = 0; reset(); });
    audio.addEventListener('pause', function () {
      cancelAnimationFrame(raf);
      btn.classList.remove('is-playing');
      btn.setAttribute('aria-label', 'Sprachnachricht abspielen');
    });

    btn.addEventListener('click', function () {
      if (!audio.paused) { audio.pause(); return; }
      pauseMusic();
      var pr = audio.play();                          // direkt im Tap, damit iOS Safari es erlaubt
      btn.classList.add('is-playing');
      btn.setAttribute('aria-label', 'Sprachnachricht pausieren');
      haptic(8);
      raf = requestAnimationFrame(paint);
      if (pr && pr.catch) pr.catch(function () { reset(); });
    });

    voiceStop = function () { if (!audio.paused) audio.pause(); };
  }

  /* ------------------------------------------------------------------ */
  /* Geschenk: hüpfende Box öffnen, Karte mit Code, fliegende Emojis     */
  /* ------------------------------------------------------------------ */

  // Geschenkbox als SVG: Box und Deckel getrennt, damit der Deckel wegspringen kann
  var GIFT_BOX =
    '<svg class="gift__svg" viewBox="0 0 120 120" aria-hidden="true">' +
      '<defs>' +
        '<linearGradient id="gbBox" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#ECECF1"/></linearGradient>' +
        '<linearGradient id="gbLid" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#F3F3F6"/></linearGradient>' +
        '<linearGradient id="gbRib" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FF4D6A"/><stop offset="1" stop-color="#E8284A"/></linearGradient>' +
      '</defs>' +
      '<g class="gift__body">' +
        '<rect x="22" y="56" width="76" height="54" rx="8" fill="url(#gbBox)"/>' +
        '<rect x="22" y="56" width="76" height="7" fill="#000" opacity=".05"/>' +
        '<rect x="54" y="56" width="12" height="54" fill="url(#gbRib)"/>' +
      '</g>' +
      '<g class="gift__lid">' +
        '<path d="M58 40c-6-12-26-16-27-5-1 8 15 8 27 5z" fill="#FF4D6A"/>' +
        '<path d="M62 40c6-12 26-16 27-5 1 8-15 8-27 5z" fill="#FF4D6A"/>' +
        '<path d="M58 40c-8-7-19-9-20-4" stroke="#C81E3E" stroke-width="1.6" fill="none" stroke-linecap="round" opacity=".45"/>' +
        '<path d="M62 40c8-7 19-9 20-4" stroke="#C81E3E" stroke-width="1.6" fill="none" stroke-linecap="round" opacity=".45"/>' +
        '<rect x="16" y="40" width="88" height="19" rx="6" fill="url(#gbLid)"/>' +
        '<rect x="54" y="40" width="12" height="19" fill="url(#gbRib)"/>' +
        '<rect x="54" y="35" width="12" height="9" rx="4" fill="#E8284A"/>' +
      '</g>' +
    '</svg>';

  function giftHtml(g) {
    var bg = g.bild && IMAGES[g.bild];
    return (bg ? '<span class="gift__bg" aria-hidden="true"><img src="' + bg + '" alt="" draggable="false"' +
        (g.fokus ? ' style="object-position:' + esc(g.fokus) + '"' : '') + '></span>' : '') +
      '<div class="gift">' +
        '<div class="gift__stage">' +
          '<button type="button" class="gift__box" aria-label="Geschenk öffnen">' +
            '<span class="gift__shadow" aria-hidden="true"></span><span class="gift__hop">' + GIFT_BOX + '</span>' +
          '</button>' +
        '</div>' +
        '<div class="gift__card">' +
          '<p class="gift__title">' + fmt(g.titel) + '</p>' +
          '<p class="gift__name">' + fmt([g.gutschein, g.wert].filter(Boolean).join(' · ')) + '</p>' +
          (g.freigegeben === false ?
            // Code noch zensiert: Platzhalter und Freischalt-Hinweis, kein Kopieren
            '<p class="gift__code gift__code--hidden" aria-label="Code noch nicht freigeschaltet">' + esc(g.zensiert || '•••-•••-•••') + '</p>' +
            '<p class="gift__release">' + fmt(g.zensiertHinweis) + '</p>'
          :
            '<p class="gift__code" data-code="' + esc(g.code) + '">' + fmt(g.code) + '</p>' +
            '<button type="button" class="gift__copy" tabindex="-1">' +
              '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2.5"/><path d="M5 15V6.5A2.5 2.5 0 0 1 7.5 4H15"/></svg>' +
              '<span>' + esc(g.buttonText) + '</span></button>') +
          (g.schritte && g.schritte.length ?
            '<div class="gift__steps">' +
              '<p class="gift__steps-title">' + fmt(g.schritteTitel) + '</p>' +
              '<ol>' + g.schritte.map(function (s) { return '<li>' + fmt(s) + '</li>'; }).join('') + '</ol>' +
            '</div>' : '') +
          (g.notiz ? '<p class="gift__note">' + fmt(g.notiz) + '</p>' : '') +
          (g.einloesenLink ? '<a class="gift__redeem" href="' + esc(g.einloesenLink) + '" target="_blank" rel="noopener" tabindex="-1">' +
            esc(g.einloesenText || 'Jetzt einlösen') + '</a>' : '') +
        '</div>' +
        '<p class="gift__hint">' + fmt(g.hinweis) + '</p>' +
      '</div>';
  }

  function wireGift(root) {
    var gift = $('.gift', root), box = $('.gift__box', root), copy = $('.gift__copy', root), redeem = $('.gift__redeem', root);
    var g = D.geschenk, opened = false;

    box.addEventListener('click', function () {
      if (opened) return;
      opened = true;
      haptic(12);
      var t = reduceMotion ? 0.1 : 1;
      gift.classList.add('is-open');                  // Deckel springt weg
      setTimeout(function () { gift.classList.add('is-out'); emojiBurst(g.emojis); }, 380 * t);
      setTimeout(function () {
        gift.classList.add('is-done');
        if (copy) copy.removeAttribute('tabindex');
        if (redeem) redeem.removeAttribute('tabindex');
      }, 1200 * t);
    });

    if (copy) copy.addEventListener('click', function () {
      var label = copy.querySelector('span'), code = $('.gift__code', root);
      copyText(code.getAttribute('data-code')).then(function (ok) {
        haptic(10);
        label.textContent = ok ? g.kopiertText : 'Bitte manuell kopieren';
        copy.classList.toggle('is-copied', ok);
        if (!ok) selectText(code);
        setTimeout(function () { label.textContent = g.buttonText; copy.classList.remove('is-copied'); }, 2000);
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
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(r);
  }

  // Emojis steigen einmal von unten nach oben über den ganzen Bildschirm und verschwinden
  function emojiBurst(list) {
    if (!list || !list.length) return;
    var layer = document.createElement('div');
    layer.className = 'burst';
    layer.setAttribute('aria-hidden', 'true');
    document.body.appendChild(layer);
    var vw = window.innerWidth, vh = window.innerHeight, n = reduceMotion ? 10 : 26, longest = 0;   // ruhiger bei „Bewegung reduzieren“
    for (var i = 0; i < n; i++) {
      var el = document.createElement('span');
      el.textContent = list[i % list.length];
      var size = 20 + Math.random() * 22, x = Math.random() * (vw - size), drift = (Math.random() - 0.5) * 90;
      var rot0 = reduceMotion ? 0 : (Math.random() - 0.5) * 40, rot1 = reduceMotion ? 0 : rot0 + (Math.random() - 0.5) * 120;
      var dur = 1700 + Math.random() * 1000, delay = Math.random() * 500;
      longest = Math.max(longest, dur + delay);
      el.style.cssText = 'left:' + x + 'px;font-size:' + size + 'px';
      layer.appendChild(el);
      el.animate([
        { transform: 'translate(0,' + (vh + 40) + 'px) rotate(' + rot0 + 'deg)', opacity: 0 },
        { opacity: 1, offset: 0.12 },
        { opacity: 1, offset: 0.75 },
        { transform: 'translate(' + drift + 'px,' + (-size - 40) + 'px) rotate(' + rot1 + 'deg)', opacity: 0 }
      ], { duration: dur, delay: delay, easing: 'cubic-bezier(.2,.6,.35,1)', fill: 'both' });
    }
    setTimeout(function () { layer.remove(); }, longest + 100);
  }

  /* ------------------------------------------------------------------ */
  /* Collage                                                             */
  /* ------------------------------------------------------------------ */

  // Antippen holt ein Foto nach vorne und vergrößert es kurz; nochmal tippen legt es zurück
  function wireCollage(root) {
    var z = 10;
    Array.prototype.forEach.call(root.querySelectorAll('.collage__photo'), function (ph) {
      ph.addEventListener('click', function () {
        var was = ph.classList.contains('is-front');
        Array.prototype.forEach.call(root.querySelectorAll('.collage__photo.is-front'), function (x) { x.classList.remove('is-front'); });
        if (!was) { ph.style.zIndex = ++z; ph.classList.add('is-front'); haptic(6); }
      });
    });
  }

  /* ------------------------------------------------------------------ */
  /* Herbstblätter auf den hellen Buchseiten (Chat, Kapitel, Collage)    */
  /* ------------------------------------------------------------------ */

  // Blattformen (viewBox 0 0 100 100, Stiel unten), Farbe kommt über currentColor
  var LEAF_SHAPES = [
    // Ahorn
    '<path fill="currentColor" d="M50 4 57 22 66 17 63 37 78 27 82 35 94 32 88 48 96 53 74 67 77 76 55 72 53 90 47 90 45 72 23 76 26 67 4 53 12 48 6 32 18 35 22 27 37 37 34 17 43 22Z"/>' +
    '<path d="M50 96V30M50 62 78 40M50 62 22 40M50 74 70 66M50 74 30 66" stroke="rgba(0,0,0,.2)" stroke-width="2" fill="none" stroke-linecap="round"/>',
    // Eiche
    '<path fill="currentColor" d="M50 6C58 6 60 14 57 19 66 16 71 24 64 30 74 29 77 39 67 43 77 45 77 56 66 57 74 62 70 72 60 69 63 77 57 83 52 80V94H48V80C43 83 37 77 40 69 30 72 26 62 34 57 23 56 23 45 33 43 23 39 26 29 36 30 29 24 34 16 43 19 40 14 42 6 50 6Z"/>' +
    '<path d="M50 90V14M50 36 61 28M50 36 39 28M50 52 64 46M50 52 36 46M50 66 58 62M50 66 42 62" stroke="rgba(0,0,0,.2)" stroke-width="2" fill="none" stroke-linecap="round"/>'
  ];
  var LEAF_COLORS = ['#E07A2E', '#B4472B', '#D3A23A', '#8B5A35', '#CC6A2C', '#C08A2E'];
  var LEAF_COUNT = 10;
  var WIND_LINE = '<svg viewBox="0 0 120 14" preserveAspectRatio="none"><path pathLength="100" d="M2 9C26 3 46 3 64 7S100 12 118 5"/></svg>';

  var leafFields = {};        // Blattfelder je Seitenindex
  var leafActive = [], leafRaf = 0, leafLast = 0, leafTime = 0;
  var gust = { t: 0, next: 5, dir: 1, power: 0 };

  function rnd(a, b) { return a + Math.random() * (b - a); }

  // Eher am Rand: meist in den äußeren 22 % links oder rechts
  function edgeX(w) {
    var r = Math.random();
    if (r < .42) return rnd(-.04, .22) * w;
    if (r < .84) return rnd(.78, 1.02) * w;
    return rnd(.2, .8) * w;
  }

  function makeLeaf(layer, w, h, scattered) {
    var el = document.createElement('span');
    el.className = 'leaf';
    var size = w * rnd(.058, .095);
    el.style.width = el.style.height = size + 'px';
    el.style.color = LEAF_COLORS[Math.floor(Math.random() * LEAF_COLORS.length)];
    el.innerHTML = '<svg viewBox="0 0 100 100">' + LEAF_SHAPES[Math.random() < .55 ? 0 : 1] + '</svg>';
    layer.appendChild(el);
    var lf = { el: el, size: size };
    resetLeaf(lf, w, h, scattered);
    return lf;
  }

  function resetLeaf(lf, w, h, scattered) {
    lf.x = edgeX(w);
    lf.y = scattered ? rnd(-.1, 1) * h : -lf.size - rnd(0, h * .3);
    lf.vy = rnd(14, 26);                      // langsam fallen (px/s)
    lf.drag = rnd(.7, 1.3);                   // wie stark der Wind das Blatt trägt
    lf.amp = rnd(8, 18);                      // Schaukeln hin und her
    lf.ph = rnd(0, 6.28);
    lf.om = rnd(.7, 1.3);
    lf.rot = rnd(0, 360);
    lf.spin = rnd(12, 38) * (Math.random() < .5 ? -1 : 1);
    lf.flip = rnd(0, 6.28);
    lf.alpha = rnd(.5, .7);
  }

  function drawLeaf(lf, w) {
    var sx = lf.x + Math.sin(lf.ph) * lf.amp;
    var tilt = Math.sin(lf.ph) * 18;          // pendelt beim Schaukeln mit
    var fx = .75 + .25 * Math.cos(lf.flip);   // leichtes Wenden im Fallen
    // in der Seitenmitte etwas blasser, damit Text und Chat gut lesbar bleiben
    var mid = 1 - Math.min(1, Math.abs(sx / w - .5) / .32);
    lf.el.style.transform = 'translate3d(' + sx.toFixed(1) + 'px,' + lf.y.toFixed(1) + 'px,0) rotate(' + (lf.rot + tilt).toFixed(1) + 'deg) scaleX(' + fx.toFixed(3) + ')';
    lf.el.style.opacity = (lf.alpha * (1 - .45 * mid)).toFixed(3);
  }

  function setupLeaves() {
    stopLeaves();
    leafFields = {};
    pages.forEach(function (pg, i) {
      var layer = $('.leaves', pg.el);
      if (!layer) return;
      layer.innerHTML = '';
      var w = geo.pw, h = geo.ph;
      var f = { layer: layer, w: w, h: h, leaves: [] };
      for (var n = 0; n < LEAF_COUNT; n++) f.leaves.push(makeLeaf(layer, w, h, true));
      f.leaves.forEach(function (lf) { drawLeaf(lf, w); });
      leafFields[i] = f;
    });
  }

  // Nur die aufgeschlagenen Seiten animieren; bei „Bewegung reduzieren“ bleiben die Blätter stehen
  function leavesFor(list) {
    stopLeaves();
    leafActive = list.map(function (i) { return leafFields[i]; }).filter(Boolean);
    if (!leafActive.length || reduceMotion) return;
    leafLast = 0;
    leafRaf = requestAnimationFrame(leafFrame);
  }
  function stopLeaves() {
    cancelAnimationFrame(leafRaf);
    leafRaf = 0;
    leafActive = [];
  }

  function leafFrame(now) {
    if (!leafActive.length) return;
    var dt = leafLast ? Math.min(.05, (now - leafLast) / 1000) : 0;
    leafLast = now;
    leafTime += dt;

    // leichter Grundwind, der langsam die Richtung wechselt
    var breeze = 7 * Math.sin(leafTime * 6.28 / 46);
    // gelegentlicher Windstoß: schnell an, langsam aus
    gust.next -= dt;
    if (gust.next <= 0) {
      gust.t = 0;
      gust.dir = Math.abs(breeze) > 2 ? (breeze > 0 ? 1 : -1) : (Math.random() < .5 ? -1 : 1);
      gust.power = rnd(55, 85);
      gust.next = rnd(8, 15);
      leafActive.forEach(function (f) { windLines(f, gust.dir); });
    }
    gust.t += dt;
    var env = gust.t < .45 ? gust.t / .45 : Math.max(0, 1 - (gust.t - .45) / 1.9);
    var g = gust.dir * gust.power * env * env;
    var wind = breeze + g;

    leafActive.forEach(function (f) {
      var w = f.w, h = f.h;
      f.leaves.forEach(function (lf) {
        lf.y += lf.vy * dt * (1 + Math.abs(g) / 160);
        lf.x += wind * lf.drag * dt;
        lf.ph += lf.om * dt;
        lf.rot += lf.spin * dt * (1 + Math.abs(g) / 40);
        lf.flip += dt * (1.1 + Math.abs(g) / 25);
        if (lf.y > h + lf.size) resetLeaf(lf, w, h, false);
        else if (lf.x > w + lf.size * 2) lf.x = -lf.size * 1.5;
        else if (lf.x < -lf.size * 2) lf.x = w + lf.size * .5;
        drawLeaf(lf, w);
      });
    });
    leafRaf = requestAnimationFrame(leafFrame);
  }

  // Feine Windlinien, die kurz über die Seite ziehen
  function windLines(f, dir) {
    var n = 2 + Math.floor(Math.random() * 2);
    for (var i = 0; i < n; i++) {
      var el = document.createElement('span');
      el.className = 'wind';
      el.innerHTML = WIND_LINE;
      var lw = f.w * rnd(.35, .5);
      el.style.width = lw + 'px';
      el.style.top = (f.h * rnd(.12, .85)) + 'px';
      if (dir < 0) el.style.scale = '-1 1';
      f.layer.appendChild(el);
      var from = dir > 0 ? -lw : f.w, to = dir > 0 ? f.w : -lw;
      var dur = rnd(1100, 1600), delay = i * rnd(120, 280);
      var a = el.animate([
        { transform: 'translateX(' + from + 'px)', opacity: 0 },
        { opacity: 1, offset: .25 },
        { opacity: 1, offset: .65 },
        { transform: 'translateX(' + to + 'px)', opacity: 0 }
      ], { duration: dur, delay: delay, easing: 'cubic-bezier(.3,.1,.4,1)', fill: 'both' });
      var path = el.querySelector('path');
      path.animate([{ strokeDashoffset: 40 }, { strokeDashoffset: -100 }], { duration: dur, delay: delay, fill: 'both' });
      a.onfinish = (function (x) { return function () { x.remove(); }; })(el);
    }
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
  /* Buch (StPageFlip): Aufbau, Größe, Blättern                          */
  /* ------------------------------------------------------------------ */

  var RATIO = 1.45;                                // Seitenhöhe / Seitenbreite
  var FLIP_MS = reduceMotion ? 300 : 900;
  var FORWARD = 0;                                 // FlipDirection.FORWARD in StPageFlip
  var stage, holder, flip = null, geo = null, chapterPages = null, shown = [], simple = false;

  function buildBook() {
    stage = $('#stage');
    holder = $('#book');
    stage.hidden = false;
    layout(true);
    setupControls();
    window.addEventListener('resize', debounce(function () { layout(false); }, 200));
    // Nach dem Laden der Schriften neu umbrechen (Maße ändern sich leicht)
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { rebuild(); });
  }

  /* Größe: Doppelseite bei Querformat (Desktop, Handy quer), Einzelseite bei Hochformat.
     Die Seite wird so groß wie möglich, aber nie größer als der freie Platz. */
  function measure() {
    var cs = getComputedStyle(stage);
    var availW = stage.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - 56;
    var availH = stage.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - 8;
    var spread = window.innerWidth > window.innerHeight * 1.05;
    var pw = Math.min((spread ? availW / 2 : availW), availH / RATIO, spread ? 440 : 420);
    if (spread && pw < 150) { spread = false; pw = Math.min(availW, availH / RATIO, 420); }
    pw = Math.max(150, Math.floor(pw));
    return { spread: spread, pw: pw, ph: Math.floor(pw * RATIO) };
  }

  function layout(force) {
    var g = measure();
    if (!force && geo && g.spread === geo.spread && Math.abs(g.pw - geo.pw) < 2) return;
    geo = g;
    var root = document.documentElement.style;
    root.setProperty('--bw', geo.pw + 'px');
    root.setProperty('--bh', geo.ph + 'px');
    stage.classList.toggle('is-spread', geo.spread);
    rebuild();
  }

  // Buch komplett (neu) aufbauen, die aktuelle Seite bleibt erhalten
  function rebuild() {
    if (flip && flip.getState() !== 'read') { setTimeout(rebuild, 300); return; }
    var key = flip ? pages[flip.getCurrentPageIndex()].key : 'cover';
    stopLeaves();
    if (voiceStop) voiceStop();
    if (flip) { flip.destroy(); flip = null; }

    chapterPages = paginateChapter();
    buildPages(geo.spread);

    // In Originalgröße einpassen, solange alle Seiten sichtbar sind
    pages.forEach(function (p) { measureEl.appendChild(p.el); });
    fitAll();
    setupLeaves();
    if (special.collage != null) wireCollage(pages[special.collage].el);
    if (special.gift != null) wireGift(pages[special.gift].el);
    wireVoice(pages[special.back].el);
    pages.forEach(function (p) { shield(p.el); });

    var start = special[key] != null ? special[key] : 0;
    // Fehlt die Library (z. B. Datei noch nicht ausgeliefert) oder scheitert ihr Start,
    // zeigt die Seite das Buch trotzdem: einfacher Modus, eine Seite nach der anderen
    try {
      if (!window.St || !window.St.PageFlip) throw new Error('page-flip.js nicht geladen');
      simple = false;
      createFlip(start);
    } catch (err) {
      if (window.console) console.error('Blättern im einfachen Modus:', err);
      if (flip && flip.destroy) { try { flip.destroy(); } catch (e) { /* egal */ } }
      simple = true;
      flip = simpleFlip(start);
    }
    measureEl.innerHTML = '';
    shown = [];
    settle(true);
  }

  function createFlip(start) {
    holder.innerHTML = '<div class="flip"></div>';
    holder.style.width = (geo.spread ? geo.pw * 2 : geo.pw) + 'px';
    flip = new St.PageFlip($('.flip', holder), {
      width: geo.pw,
      height: geo.ph,
      size: 'stretch',
      // Grenzen so gesetzt, dass StPageFlip dieselbe Ausrichtung wählt wie measure()
      minWidth: geo.spread ? Math.floor(geo.pw * 0.8) : Math.ceil(geo.pw * 0.6),
      maxWidth: geo.pw,
      minHeight: Math.floor(geo.ph * 0.5),
      maxHeight: geo.ph,
      usePortrait: !geo.spread,
      showCover: true,
      autoSize: true,
      drawShadow: true,
      maxShadowOpacity: 0.8,                     // Falz beim Umschlagen deutlich sichtbar
      flippingTime: FLIP_MS,
      startPage: start,
      mobileScrollSupport: false,
      clickEventForward: true,
      showPageCorners: !reduceMotion,
      swipeDistance: 30
    });
    flip.on('flip', function () { settle(); });
    flip.on('changeState', function (e) { onState(e.data); });
    flip.loadFromHTML(pages.map(function (p) { return p.el; }));
    loosenRelease(flip.getFlipController());
  }

  // Ersatz ohne Library: gleiche Schnittstelle, Einzelseiten, Wechsel ohne Animation
  function simpleFlip(start) {
    holder.innerHTML = '<div class="flip flip--simple"></div>';
    holder.style.width = geo.pw + 'px';
    var box = $('.flip', holder), cur = start;
    pages.forEach(function (p) { p.el.classList.add('--right'); box.appendChild(p.el); });
    function go(i) { if (i >= 0 && i < pages.length && i !== cur) { cur = i; settle(); } }
    return {
      getCurrentPageIndex: function () { return cur; },
      getState: function () { return 'read'; },
      flipNext: function () { go(cur + 1); },
      flipPrev: function () { go(cur - 1); },
      destroy: function () { box.remove(); }
    };
  }

  /* Loslassen beim Ziehen: StPageFlip blättert nur fertig, wenn die Ecke über den Buchrücken
     gezogen wurde (Hochformat: fast bis zum linken Seitenrand). Hier reichen ~35 % der Seite,
     sonst federt das Blatt zurück. */
  function loosenRelease(fc) {
    var stopMove = fc.stopMove;
    if (!stopMove || !fc.animateFlippingTo) return;          // andere Library-Version: Standard behalten
    fc.stopMove = function () {
      var calc = this.calc;
      if (calc) {
        var pos = calc.getPosition(), rect = this.getBoundsRect();
        if (pos.x > 0 && pos.x < rect.pageWidth * 0.65) {
          this.animateFlippingTo(pos, { x: -rect.pageWidth, y: calc.getCorner() === 'bottom' ? rect.height : 0 }, true);
          return;
        }
      }
      stopMove.call(this);
    };
  }

  // Seiten einpassen: Schrift der Seite verkleinern, bis alles passt (notfalls scrollt sie)
  function fitAll() {
    measureEl.classList.add('is-fitting');
    pages.forEach(function (p) {
      var body = $('.pg__body', p.el);
      if (!body) return;
      var f = 1, min = p.el.querySelector('.tchat') ? 0.5 : 0.74;   // der Chat darf nie scrollen
      body.style.setProperty('--fit', '1');
      while (body.scrollHeight > body.clientHeight + 1 && f > min) {
        f -= 0.03;
        body.style.setProperty('--fit', f.toFixed(3));
      }
      body.classList.toggle('is-scroll', body.scrollHeight > body.clientHeight + 1);
    });
    measureEl.classList.remove('is-fitting');
  }

  // Bedienelemente auf den Seiten dürfen nie ein Umblättern starten
  function shield(root) {
    Array.prototype.forEach.call(root.querySelectorAll('.gift__card, .gift__box, .voice, .collage__photo, button, a'), function (el) {
      ['mousedown', 'touchstart'].forEach(function (ev) {
        el.addEventListener(ev, function (e) { e.stopPropagation(); }, { passive: true });
      });
    });
  }

  // Sichtbare Seiten zu einem Seitenindex
  function visibleAt(i) {
    var last = pages.length - 1;
    if (simple || !geo.spread || i === 0 || i === last) return [i];
    return [i, Math.min(i + 1, last)];
  }

  // Geschlossenes Buch mittig: Cover liegt rechts vom Rücken, Rückseite links davon
  function setShift(i) {
    var last = pages.length - 1, x = 0;
    if (geo.spread && !simple) x = i === 0 ? -geo.pw / 2 : (i === last ? geo.pw / 2 : 0);
    holder.style.transform = 'translate3d(' + x + 'px,0,0)';
    var closed = i === 0 || i === last;
    stage.classList.toggle('is-closed', closed);
    stage.classList.toggle('is-front', i === 0);
  }

  function onState(state) {
    if (state === 'flipping' || state === 'user_fold') stopLeaves();
    if (state === 'flipping') {
      // Zielseite schon beim Start kennen, damit das Buch gleichzeitig in die Mitte gleitet
      var calc = flip.getFlipController().calc, i = flip.getCurrentPageIndex(), last = pages.length - 1;
      if (calc && calc.getDirection) {
        var fwd = calc.getDirection() === FORWARD;
        var step = geo.spread ? 2 : 1;
        var dest = fwd ? (i === 0 ? 1 : i + step) : (i === last && geo.spread ? last - 2 : i - step);
        dest = Math.max(0, Math.min(last, dest));
        setShift(dest);
        setBar(dest > 0);
        updateBar(visibleAt(dest));
      }
    }
    if (state === 'read') settle();
  }

  // Ruhezustand nach dem Blättern: sichtbare Seiten markieren, Leiste, Blätter, Konfetti
  function settle(initial) {
    if (!flip) return;
    var i = flip.getCurrentPageIndex(), vis = visibleAt(i);
    var before = shown;
    shown = vis;
    pages.forEach(function (p, n) { p.el.classList.toggle('is-shown', vis.indexOf(n) >= 0); });
    setShift(i);
    setBar(i > 0, initial);
    updateBar(vis);
    if (voiceStop && vis.indexOf(special.back) < 0) voiceStop();
    if (flip.getState() === 'read') leavesFor(vis);
    if (!initial && vis.indexOf(special.confetti) >= 0 && before.indexOf(special.confetti) < 0) {
      var cv = $('.confetti', pages[special.confetti].el);
      setTimeout(function () { if (shown.indexOf(special.confetti) >= 0) confetti(cv); }, 150);
    }
  }

  var barTimer = 0;
  function setBar(show, instant) {
    var bar = $('#bar');
    clearTimeout(barTimer);
    if (show) {
      if (bar.hidden) {
        bar.hidden = false;
        requestAnimationFrame(function () { requestAnimationFrame(function () { bar.classList.add('is-shown'); }); });
      } else bar.classList.add('is-shown');
    } else {
      bar.classList.remove('is-shown');
      if (instant) bar.hidden = true;
      else barTimer = setTimeout(function () { bar.hidden = true; }, 500);
    }
  }

  // Fortschritt: Titel der ersten sichtbaren Inhaltsseite, Balken bis zur letzten sichtbaren Seite
  function updateBar(vis) {
    var p = pages[vis[0]];
    if (p.key === 'blank' && vis[1] != null) p = pages[vis[1]];
    $('#bar-label').textContent = p.label;
    $('#bar-fill').style.transform = 'scaleX(' + ((vis[vis.length - 1] + 1) / pages.length) + ')';
    $('#prev').disabled = vis[0] === 0;
    $('#next').disabled = vis[vis.length - 1] >= pages.length - 1;
  }

  function next() { if (flip && flip.getState() === 'read') flip.flipNext(); }
  function prev() { if (flip && flip.getState() === 'read') flip.flipPrev(); }

  /* Tippen auf dem Handy: StPageFlip beginnt eine Touch-Geste erst nach 250 ms Halten,
     ein kurzer Tap würde sonst nichts tun. Links (bzw. linker Rand der Einzelseite) = zurück,
     sonst weiter. Bedienelemente erreichen diesen Handler nicht (shield). */
  function setupTap() {
    var t0 = null;
    holder.addEventListener('touchstart', function (e) {
      var t = e.changedTouches[0];
      t0 = e.touches.length === 1 ? { x: t.clientX, y: t.clientY, time: Date.now() } : null;
    }, { passive: true });
    holder.addEventListener('touchend', function (e) {
      var t = e.changedTouches[0], s = t0;
      t0 = null;
      if (simple) return;                                          // einfacher Modus: der Klick danach blättert
      if (!s || !flip || flip.getState() !== 'read') return;
      if (Date.now() - s.time > 240 || Math.abs(t.clientX - s.x) > 10 || Math.abs(t.clientY - s.y) > 10) return;
      var r = holder.getBoundingClientRect(), i = flip.getCurrentPageIndex(), last = pages.length - 1;
      var x = t.clientX - r.left, back;
      if (i === 0) back = false;                                   // geschlossen vorne: öffnen
      else if (i === last) back = true;                            // geschlossen hinten: wieder aufschlagen
      else if (geo.spread) back = x < r.width / 2;                 // linke Seite = zurück
      else back = x < r.width * 0.3;                               // Einzelseite: linker Rand = zurück
      if (back) flip.flipPrev(); else flip.flipNext();
    });
  }

  // Einfacher Modus (ohne Library): Klick mit der Maus blättert wie ein Tap
  function setupClick() {
    holder.addEventListener('click', function (e) {
      if (!simple || e.target.closest('button, a, .gift__card, .voice')) return;
      var r = holder.getBoundingClientRect();
      if (e.clientX - r.left < r.width * 0.3 && flip.getCurrentPageIndex() > 0) flip.flipPrev(); else flip.flipNext();
    });
  }

  function setupControls() {
    setupTap();
    setupClick();
    $('#prev').addEventListener('click', prev);
    $('#next').addEventListener('click', next);
    document.addEventListener('keydown', function (e) {
      if (e.target.closest && e.target.closest('input')) return;
      if (e.repeat) return;                         // gedrückt gehaltene Taste blättert nicht durch
      if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); next(); }
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); prev(); }
    });
  }

  /* ------------------------------------------------------------------ */
  /* Musik (nur per Button, kein Autoplay)                               */
  /* ------------------------------------------------------------------ */

  var pauseMusic = function () {};

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
    pauseMusic = function () { if (!audio.paused) { audio.pause(); setState(false); } };
    btn.addEventListener('click', function () {
      if (audio.paused) {
        if (voiceStop) voiceStop();
        var p = audio.play();
        setState(true);
        if (p && p.catch) p.catch(function () { setState(false); });
      } else { audio.pause(); setState(false); }
    });
  }

  start();
})();
