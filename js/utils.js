/* utils.js — helpers compartidos (namespace global U) */
window.U = (function () {

  /* ---------- ids y texto ---------- */
  function uid(p) {
    return (p || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function iniciales(nombre) {
    var p = String(nombre || '?').trim().split(/\s+/);
    return ((p[0] || '?')[0] + (p[1] ? p[1][0] : '')).toUpperCase();
  }

  /* ---------- fechas ---------- */
  var MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  var DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

  // "2026-08-23" -> "sáb 23 ago"
  function fechaCorta(iso) {
    if (!iso) return '—';
    var p = iso.split('-');
    var d = new Date(+p[0], +p[1] - 1, +p[2]);
    if (isNaN(d.getTime())) return iso;
    return DIAS[d.getDay()] + ' ' + (+p[2]) + ' ' + MESES[+p[1] - 1];
  }

  // "2026-08-23" -> "23/08/2026"
  function fechaLarga(iso) {
    if (!iso) return '—';
    var p = iso.split('-');
    return p[2] + '/' + p[1] + '/' + p[0];
  }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  function hoyISO() {
    var d = new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  /* ---------- reloj de partido ---------- */
  // ms -> "MM:SS"
  function reloj(ms) {
    var t = Math.max(0, Math.floor(ms / 1000));
    return pad2(Math.floor(t / 60)) + ':' + pad2(t % 60);
  }

  // ms -> minuto de juego que se anota en la planilla (arranca en 1')
  function minutoDe(ms) {
    return Math.floor(ms / 60000) + 1;
  }

  /* ---------- DOM ---------- */
  function el(html) {
    var d = document.createElement('div');
    d.innerHTML = html.trim();
    return d.firstElementChild;
  }

  function on(root, sel, evt, fn) {
    root.addEventListener(evt, function (e) {
      var t = e.target.closest(sel);
      if (t && root.contains(t)) fn(e, t);
    });
  }

  /* ---------- toast ---------- */
  function toast(msg, tipo) {
    var root = document.getElementById('toastRoot');
    var t = el('<div class="toast ' + (tipo || '') + '">' + esc(msg) + '</div>');
    root.appendChild(t);
    setTimeout(function () {
      t.style.transition = 'opacity .25s';
      t.style.opacity = '0';
      setTimeout(function () { t.remove(); }, 260);
    }, 2100);
  }

  /* ---------- modal ---------- */
  // modal({titulo, cuerpo(HTML), okTexto, cancelTexto, onOk(bgEl)})
  // onOk devuelve false para dejar el modal abierto (validación fallida).
  function modal(opt) {
    var root = document.getElementById('modalRoot');
    var bg = el(
      '<div class="modal-bg"><div class="modal">' +
      '<h3>' + esc(opt.titulo || '') + '</h3>' +
      '<div class="modal-body"></div>' +
      '<div class="modal-actions">' +
      (opt.cancelTexto === null ? '' : '<button class="btn ghost" data-x>' + esc(opt.cancelTexto || 'Cancelar') + '</button>') +
      (opt.okTexto === null ? '' : '<button class="btn primary" data-ok>' + esc(opt.okTexto || 'Guardar') + '</button>') +
      '</div></div></div>'
    );
    bg.querySelector('.modal-body').innerHTML = opt.cuerpo || '';
    function cerrar() { bg.remove(); }
    bg.addEventListener('click', function (e) { if (e.target === bg) cerrar(); });
    var bx = bg.querySelector('[data-x]');
    if (bx) bx.addEventListener('click', cerrar);
    var bok = bg.querySelector('[data-ok]');
    if (bok) bok.addEventListener('click', function () {
      if (opt.onOk && opt.onOk(bg) === false) return;
      cerrar();
    });
    root.appendChild(bg);
    if (opt.onAbrir) opt.onAbrir(bg);
    var first = bg.querySelector('input,select,textarea');
    if (first) setTimeout(function () { first.focus(); }, 80);
    return { cerrar: cerrar, elemento: bg };
  }

  function confirmar(msg, onSi) {
    modal({
      titulo: 'Confirmar',
      cuerpo: '<p class="muted" style="margin:0">' + esc(msg) + '</p>',
      okTexto: 'Sí, continuar',
      onOk: function () { onSi(); }
    });
  }

  /* ---------- lectura de formularios ---------- */
  function val(cont, name) {
    var e = cont.querySelector('[name="' + name + '"]');
    return e ? String(e.value).trim() : '';
  }

  /* ---------- imágenes: redimensiona a dataURL para no reventar localStorage ---------- */
  function leerImagen(file, maxLado, cb) {
    var fr = new FileReader();
    fr.onload = function () {
      var img = new Image();
      img.onload = function () {
        var w = img.width, h = img.height, m = maxLado || 900;
        if (w > m || h > m) {
          if (w > h) { h = Math.round(h * m / w); w = m; }
          else { w = Math.round(w * m / h); h = m; }
        }
        var c = document.createElement('canvas');
        c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        cb(c.toDataURL('image/jpeg', 0.72));
      };
      img.onerror = function () { cb(null); };
      img.src = fr.result;
    };
    fr.onerror = function () { cb(null); };
    fr.readAsDataURL(file);
  }

  /* ---------- <option> de un <select> ---------- */
  function opciones(lista, sel, textoVacio) {
    var h = textoVacio ? '<option value="">' + esc(textoVacio) + '</option>' : '';
    lista.forEach(function (o) {
      h += '<option value="' + esc(o.v) + '"' +
        (String(o.v) === String(sel) ? ' selected' : '') + '>' + esc(o.t) + '</option>';
    });
    return h;
  }

  return {
    uid: uid, esc: esc, iniciales: iniciales,
    fechaCorta: fechaCorta, fechaLarga: fechaLarga, hoyISO: hoyISO, pad2: pad2,
    reloj: reloj, minutoDe: minutoDe,
    el: el, on: on, toast: toast, modal: modal, confirmar: confirmar,
    val: val, leerImagen: leerImagen, opciones: opciones
  };
})();
