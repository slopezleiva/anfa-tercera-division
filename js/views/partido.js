/* views/partido.js — planilla en vivo: cronómetro y registro editable de eventos */
window.V = window.V || {};
window.V.partido = (function () {

  var tick = null;

  function render(root, args) {
    pararTick();
    if (!args || !args[0]) return selector(root);
    var p = S.partido(args[0]);
    if (!p) { root.innerHTML = '<div class="card"><div class="empty">Partido no encontrado.</div></div>'; return; }
    planilla(root, p);
  }

  function pararTick() {
    if (tick) { clearInterval(tick); tick = null; }
  }

  /* ---------------- selector ---------------- */
  function selector(root) {
    var ps = S.partidosVisibles();
    var h = '<div class="page-head"><h1>Partido</h1><p>' +
      (S.divisionActiva() ? U.esc(S.divisionActiva()) + ' · ' : '') +
      'Elige el partido a dirigir</p></div>';
    if (!ps.length) {
      h += '<div class="card"><div class="empty">No hay partidos calendarizados.<br>' +
        '<a class="chip info" style="margin-top:10px" href="#/calendario">Ir al Calendario</a></div></div>';
    } else {
      h += '<div class="list">';
      ps.forEach(function (p) {
        var m = S.marcador(p);
        var jugado = p.estado === 'finalizado' || p.estado === 'en_curso';
        h += '<a class="list-item" href="#/partido/' + p.id + '">' +
          '<div class="grow"><div class="t">' + U.esc(S.nombreEquipo(p.localId)) + ' ' +
          (jugado ? m.local + ' - ' + m.visita : 'vs') + ' ' + U.esc(S.nombreEquipo(p.visitaId)) + '</div>' +
          '<div class="s">' + U.fechaCorta(p.fecha) + ' · ' + U.esc(p.hora || '--:--') + ' · ' + p.eventos.length + ' eventos</div></div>' +
          V.calendario.chipEstado(p) + '</a>';
      });
      h += '</div>';
    }
    root.innerHTML = h;
  }

  /* ---------------- cronómetro ---------------- */
  function transcurrido(p) {
    var t = p.timer;
    return t.acumuladoMs + (t.corriendo && t.inicioTs ? Date.now() - t.inicioTs : 0);
  }

  function nombrePeriodo(n) {
    return ({ 1: '1er tiempo', 2: '2do tiempo', 3: 'Alargue 1', 4: 'Alargue 2' })[n] || 'Periodo ' + n;
  }

  /* ---------------- planilla ---------------- */
  function planilla(root, p) {
    pararTick();
    var sinCitacion = !S.convocados(p, p.localId).length || !S.convocados(p, p.visitaId).length;

    root.innerHTML = '' +
      '<a class="tiny dim" href="#/partido">‹ Otros partidos</a>' +

      '<div class="card" style="margin-top:10px">' +
      '<div class="row" style="justify-content:space-between;margin-bottom:8px">' +
      '<span class="chip">' + U.fechaCorta(p.fecha) + ' · ' + U.esc(p.hora || '--:--') + '</span>' +
      V.calendario.chipEstado(p) + '</div>' +
      '<div class="score" id="mk"></div>' +
      '</div>' +

      '<div class="card">' +
      '<div class="periodo" id="per"></div>' +
      '<div class="clock" id="clk">00:00</div>' +
      '<div class="row" style="margin-top:11px">' +
      '<button class="btn primary grow" data-play></button>' +
      '<button class="btn" data-perio>Periodo ›</button>' +
      '<button class="btn" data-ajuste title="Ajustar reloj">✎</button>' +
      '</div>' +
      '<div class="row" style="margin-top:8px">' +
      '<button class="btn sm grow ghost" data-reset>Reiniciar reloj</button>' +
      '<button class="btn sm grow ' + (p.estado === 'finalizado' ? 'ghost' : 'danger') + '" data-fin>' +
      (p.estado === 'finalizado' ? 'Reabrir partido' : 'Finalizar partido') + '</button>' +
      '</div></div>' +

      (sinCitacion
        ? '<div class="card"><div class="empty">Falta la convocatoria de uno o ambos equipos.<br>' +
        '<a class="chip warn" style="margin-top:10px" href="#/convocatoria/' + p.id + '">Completar citación</a></div></div>'
        : '') +

      '<div class="card tight"><div class="card-head"><h3>Registrar</h3></div>' +
      '<div class="row wrap">' +
      '<button class="btn sm grow" data-ev="gol">⚽ Gol</button>' +
      '<button class="btn sm grow" data-ev="amarilla">🟨 Amarilla</button>' +
      '<button class="btn sm grow" data-ev="roja">🟥 Roja</button>' +
      '</div><div class="row wrap" style="margin-top:7px">' +
      '<button class="btn sm grow" data-ev="cambio">🔁 Cambio</button>' +
      '<button class="btn sm grow" data-ev="observacion">📝 Observación</button>' +
      '</div></div>' +

      '<div class="card tight"><div class="card-head"><h3>Eventos del partido</h3>' +
      '<span class="chip">' + p.eventos.length + '</span></div>' +
      '<div id="evs"></div></div>';

    // --- acciones del reloj ---
    root.querySelector('[data-play]').addEventListener('click', function () {
      var t = p.timer;
      if (t.corriendo) {
        t.acumuladoMs = transcurrido(p);
        t.corriendo = false; t.inicioTs = null;
      } else {
        t.corriendo = true; t.inicioTs = Date.now();
        if (p.estado === 'programado') p.estado = 'en_curso';
      }
      S.save(); planilla(root, p);
    });

    root.querySelector('[data-perio]').addEventListener('click', function () {
      var t = p.timer;
      var dur = Number(S.d.config.duracionPeriodo) || 45;
      t.acumuladoMs = t.periodo * dur * 60000; // el periodo siguiente arranca en su minuto real
      t.periodo = t.periodo + 1;
      t.corriendo = false; t.inicioTs = null;
      S.save();
      U.toast('Comienza ' + nombrePeriodo(t.periodo), 'ok');
      planilla(root, p);
    });

    root.querySelector('[data-ajuste]').addEventListener('click', function () {
      var ms = transcurrido(p);
      U.modal({
        titulo: 'Ajustar reloj',
        cuerpo: '<div class="grid-2">' +
          '<label class="f"><span>MINUTOS</span><input type="number" name="min" min="0" value="' + Math.floor(ms / 60000) + '"></label>' +
          '<label class="f"><span>SEGUNDOS</span><input type="number" name="seg" min="0" max="59" value="' + (Math.floor(ms / 1000) % 60) + '"></label>' +
          '</div>',
        onOk: function (bg) {
          var t = p.timer;
          t.acumuladoMs = (Number(U.val(bg, 'min')) || 0) * 60000 + (Number(U.val(bg, 'seg')) || 0) * 1000;
          if (t.corriendo) t.inicioTs = Date.now();
          S.save(); planilla(root, p);
        }
      });
    });

    root.querySelector('[data-reset]').addEventListener('click', function () {
      U.confirmar('¿Reiniciar el cronómetro a 00:00? Los eventos ya registrados se conservan.', function () {
        p.timer = S.timerVacio();
        S.save(); planilla(root, p);
      });
    });

    root.querySelector('[data-fin]').addEventListener('click', function () {
      if (p.estado === 'finalizado') {
        p.estado = 'en_curso';
        S.save(); U.toast('Partido reabierto', 'ok'); planilla(root, p);
        return;
      }
      U.confirmar('¿Finalizar el partido? El resultado pasará a las estadísticas del torneo.', function () {
        var t = p.timer;
        if (t.corriendo) { t.acumuladoMs = transcurrido(p); t.corriendo = false; t.inicioTs = null; }
        p.estado = 'finalizado';
        S.save(); U.toast('Partido finalizado', 'ok'); planilla(root, p);
      });
    });

    U.on(root, '[data-ev]', 'click', function (ev, b) {
      modalEvento(root, p, b.getAttribute('data-ev'), null);
    });

    pintaEventos(root, p);
    pintaMarcador(root, p);
    refrescaReloj(root, p);

    tick = setInterval(function () {
      if (!document.body.contains(root)) { pararTick(); return; }
      refrescaReloj(root, p);
    }, 300);
  }

  function pintaMarcador(root, p) {
    var L = S.equipo(p.localId), Vi = S.equipo(p.visitaId), m = S.marcador(p);
    root.querySelector('#mk').innerHTML =
      '<div class="tm">' + V.equipos.escudoHTML(L, '') + '<b>' + U.esc(L ? L.nombre : '—') + '</b></div>' +
      '<div class="gg">' + m.local + ' - ' + m.visita + '</div>' +
      '<div class="tm">' + V.equipos.escudoHTML(Vi, '') + '<b>' + U.esc(Vi ? Vi.nombre : '—') + '</b></div>';
  }

  function refrescaReloj(root, p) {
    var clk = root.querySelector('#clk');
    if (!clk) return;
    var ms = transcurrido(p);
    clk.textContent = U.reloj(ms);
    clk.className = 'clock' + (p.timer.corriendo ? ' run' : '');
    root.querySelector('#per').textContent = nombrePeriodo(p.timer.periodo) + ' · minuto ' + U.minutoDe(ms) + "'";
    var play = root.querySelector('[data-play]');
    if (play) play.textContent = p.timer.corriendo ? '⏸ Pausar' : '▶ Iniciar';
  }

  /* ---------------- lista de eventos ---------------- */
  function pintaEventos(root, p) {
    var cont = root.querySelector('#evs');
    var evs = S.eventosOrdenados(p);
    if (!evs.length) {
      cont.innerHTML = '<div class="empty">Sin eventos registrados todavía.</div>';
      return;
    }
    var h = '';
    evs.forEach(function (e) {
      h += '<div class="ev">' +
        '<div class="min">' + e.minuto + "'</div>" +
        '<div class="ic">' + (S.TIPOS_EVENTO[e.tipo] ? S.TIPOS_EVENTO[e.tipo].ic : '•') + '</div>' +
        '<div class="bd">' + textoEvento(p, e) + '</div>' +
        '<div class="row">' +
        '<button class="btn xs" data-edit-ev="' + e.id + '">✎</button>' +
        '<button class="btn xs danger" data-del-ev="' + e.id + '">✕</button>' +
        '</div></div>';
    });
    cont.innerHTML = h;

    U.on(cont, '[data-edit-ev]', 'click', function (ev, b) {
      var e = buscaEvento(p, b.getAttribute('data-edit-ev'));
      if (e) modalEvento(root, p, e.tipo, e);
    });
    U.on(cont, '[data-del-ev]', 'click', function (ev, b) {
      var id = b.getAttribute('data-del-ev');
      U.confirmar('¿Eliminar este evento de la planilla?', function () {
        p.eventos = p.eventos.filter(function (x) { return x.id !== id; });
        S.save(); U.toast('Evento eliminado', 'ok');
        pintaEventos(root, p); pintaMarcador(root, p);
      });
    });
  }

  function buscaEvento(p, id) {
    for (var i = 0; i < p.eventos.length; i++) if (p.eventos[i].id === id) return p.eventos[i];
    return null;
  }

  function textoEvento(p, e) {
    var eqNom = U.esc(S.nombreEquipo(e.equipoId));
    var jn = e.jugadorId ? U.esc(S.nombreJugador(e.jugadorId)) : '';
    switch (e.tipo) {
      case 'gol':
        return '<b>Gol de ' + jn + '</b>' +
          '<small>' + eqNom + (e.subtipo ? ' · ' + U.esc(e.subtipo) : '') +
          (e.asistenteId ? ' · asistencia: ' + U.esc(S.nombreJugador(e.asistenteId)) : '') + '</small>';
      case 'autogol':
        return '<b>Autogol de ' + jn + '</b><small>' + eqNom + '</small>';
      case 'amarilla':
        return '<b>Amarilla a ' + jn + '</b><small>' + eqNom + (e.detalle ? ' · ' + U.esc(e.detalle) : '') + '</small>';
      case 'roja':
        return '<b>Roja a ' + jn + '</b><small>' + eqNom +
          (e.subtipo === 'doble_amarilla' ? ' · doble amarilla' : ' · directa') +
          (e.detalle ? ' · ' + U.esc(e.detalle) : '') + '</small>';
      case 'cambio':
        return '<b>Cambio en ' + eqNom + '</b><small>Sale ' + U.esc(S.nombreJugador(e.saleId)) +
          ' · Entra ' + U.esc(S.nombreJugador(e.entraId)) + (e.detalle ? ' · ' + U.esc(e.detalle) : '') + '</small>';
      default:
        return '<b>Observación</b><small>' + (e.equipoId ? eqNom + ' · ' : '') + U.esc(e.detalle || '') + '</small>';
    }
  }

  /* ---------------- jugadores disponibles ---------------- */
  function enCancha(p, eqId) {
    var lado = S.ladoDe(p, eqId);
    var lista = p.convocatoria[lado].titulares.slice();
    S.eventosOrdenados(p).forEach(function (e) {
      if (e.tipo === 'cambio' && e.equipoId === eqId) {
        lista = lista.filter(function (x) { return x !== e.saleId; });
        if (e.entraId && lista.indexOf(e.entraId) < 0) lista.push(e.entraId);
      }
      if (e.tipo === 'roja' && e.equipoId === eqId) {
        lista = lista.filter(function (x) { return x !== e.jugadorId; });
      }
    });
    return lista;
  }

  function enBanca(p, eqId) {
    var lado = S.ladoDe(p, eqId);
    var usados = {};
    p.eventos.forEach(function (e) { if (e.tipo === 'cambio' && e.entraId) usados[e.entraId] = 1; });
    return p.convocatoria[lado].suplentes.filter(function (j) { return !usados[j]; });
  }

  function opcJugadores(ids) {
    return ids.map(function (jid) {
      var r = S.buscarJugador(jid);
      return { v: jid, t: r ? ((r.jugador.numero ? r.jugador.numero + '. ' : '') + r.jugador.nombre) : jid };
    });
  }

  /* ---------------- modal de evento (alta y corrección) ---------------- */
  function modalEvento(root, p, tipo, ev) {
    var minutoDefault = ev ? ev.minuto : U.minutoDe(transcurrido(p));
    var eqSel = ev ? ev.equipoId : p.localId;
    var esAutogol = tipo === 'autogol' || (ev && ev.tipo === 'autogol');
    var tipoBase = esAutogol ? 'gol' : tipo;

    var eqOpts = [
      { v: p.localId, t: S.nombreEquipo(p.localId) + ' (local)' },
      { v: p.visitaId, t: S.nombreEquipo(p.visitaId) + ' (visita)' }
    ];

    U.modal({
      titulo: (ev ? 'Editar ' : 'Registrar ') + (S.TIPOS_EVENTO[tipoBase] ? S.TIPOS_EVENTO[tipoBase].t.toLowerCase() : tipoBase),
      cuerpo:
        '<div class="grid-2">' +
        '<label class="f"><span>MINUTO</span><input type="number" name="minuto" min="1" value="' + minutoDefault + '"></label>' +
        '<label class="f"><span>EQUIPO</span><select name="equipoId">' + U.opciones(eqOpts, eqSel) + '</select></label>' +
        '</div><div id="dyn"></div>',
      onAbrir: function (bg) {
        var selEq = bg.querySelector('[name="equipoId"]');
        function pintaDyn() {
          bg.querySelector('#dyn').innerHTML = camposDe(p, tipoBase, selEq.value, ev, esAutogol);
        }
        selEq.addEventListener('change', pintaDyn);
        pintaDyn();
      },
      onOk: function (bg) {
        var equipoId = U.val(bg, 'equipoId');
        var minuto = Number(U.val(bg, 'minuto')) || 1;
        var autogolChk = bg.querySelector('[name="autogol"]');
        var esAuto = autogolChk ? autogolChk.checked : false;

        // se trabaja sobre un borrador y solo se inserta si la validación pasa,
        // para que un cancelado no deje eventos basura en la planilla
        var t = ev || { id: U.uid('ev'), ts: Date.now() };
        t.minuto = minuto;
        t.periodo = p.timer.periodo;
        t.equipoId = equipoId;
        t.tipo = tipoBase === 'gol' ? (esAuto ? 'autogol' : 'gol') : tipoBase;
        t.jugadorId = ''; t.asistenteId = ''; t.saleId = ''; t.entraId = ''; t.subtipo = ''; t.detalle = '';

        if (tipoBase === 'gol') {
          t.jugadorId = U.val(bg, 'jugadorId');
          if (!t.jugadorId) { U.toast('Selecciona al jugador', 'err'); return false; }
          if (!esAuto) {
            t.asistenteId = U.val(bg, 'asistenteId');
            t.subtipo = U.val(bg, 'subtipoGol');
          }
        } else if (tipoBase === 'amarilla') {
          t.jugadorId = U.val(bg, 'jugadorId');
          if (!t.jugadorId) { U.toast('Selecciona al jugador', 'err'); return false; }
          t.detalle = U.val(bg, 'detalle');
        } else if (tipoBase === 'roja') {
          t.jugadorId = U.val(bg, 'jugadorId');
          if (!t.jugadorId) { U.toast('Selecciona al jugador', 'err'); return false; }
          t.subtipo = U.val(bg, 'subtipoRoja') || 'directa';
          t.detalle = U.val(bg, 'detalle');
        } else if (tipoBase === 'cambio') {
          t.saleId = U.val(bg, 'saleId');
          t.entraId = U.val(bg, 'entraId');
          if (!t.saleId || !t.entraId) { U.toast('Indica quién sale y quién entra', 'err'); return false; }
          t.detalle = U.val(bg, 'detalle');
        } else {
          t.detalle = U.val(bg, 'detalle');
          if (!t.detalle) { U.toast('Escribe la observación', 'err'); return false; }
        }

        if (!ev) p.eventos.push(t);
        S.save();
        U.toast(ev ? 'Evento corregido' : 'Evento registrado', 'ok');
        pintaEventos(root, p);
        pintaMarcador(root, p);
      }
    });
  }

  // garantiza que el jugador ya guardado en el evento siga siendo seleccionable
  // aunque haya salido de la cancha (expulsado o sustituido)
  function conJugador(lista, jid) {
    if (!jid || lista.some(function (o) { return o.v === jid; })) return lista;
    return lista.concat(opcJugadores([jid]));
  }

  function camposDe(p, tipo, equipoId, ev, esAutogol) {
    var cancha = opcJugadores(enCancha(p, equipoId));
    var citados = opcJugadores(S.convocados(p, equipoId));
    var pool = cancha.length ? cancha : citados;
    if (ev && ev.equipoId === equipoId) {
      pool = conJugador(conJugador(pool, ev.jugadorId), ev.asistenteId);
      cancha = conJugador(cancha, ev.saleId);
    }

    if (tipo === 'gol') {
      return '<label class="f row" style="gap:8px;align-items:center">' +
        '<input type="checkbox" name="autogol" style="width:auto" ' + (esAutogol ? 'checked' : '') + '>' +
        '<span style="margin:0">Es autogol (suma al rival)</span></label>' +
        '<label class="f"><span>GOLEADOR *</span><select name="jugadorId">' +
        U.opciones(pool, ev ? ev.jugadorId : '', 'Seleccionar…') + '</select></label>' +
        '<label class="f"><span>ASISTENCIA</span><select name="asistenteId">' +
        U.opciones(pool, ev ? ev.asistenteId : '', 'Sin asistencia') + '</select></label>' +
        '<label class="f"><span>TIPO DE GOL</span><select name="subtipoGol">' +
        U.opciones(['Jugada', 'Penal', 'Tiro libre', 'Cabeza', 'Contragolpe'].map(function (x) { return { v: x, t: x }; }),
          ev ? ev.subtipo : '', 'Sin especificar') + '</select></label>';
    }

    if (tipo === 'amarilla') {
      return '<label class="f"><span>JUGADOR *</span><select name="jugadorId">' +
        U.opciones(pool, ev ? ev.jugadorId : '', 'Seleccionar…') + '</select></label>' +
        '<label class="f"><span>MOTIVO</span><input type="text" name="detalle" value="' + U.esc(ev ? ev.detalle : '') +
        '" placeholder="Juego brusco, reclamo, pérdida de tiempo…"></label>';
    }

    if (tipo === 'roja') {
      return '<label class="f"><span>JUGADOR *</span><select name="jugadorId">' +
        U.opciones(pool, ev ? ev.jugadorId : '', 'Seleccionar…') + '</select></label>' +
        '<label class="f"><span>TIPO</span><select name="subtipoRoja">' +
        U.opciones([{ v: 'directa', t: 'Roja directa' }, { v: 'doble_amarilla', t: 'Doble amarilla' }],
          ev ? ev.subtipo : 'directa') + '</select></label>' +
        '<label class="f"><span>MOTIVO</span><input type="text" name="detalle" value="' + U.esc(ev ? ev.detalle : '') +
        '" placeholder="Agresión, última falta, insultos…"></label>' +
        '<p class="tiny dim" style="margin:0">La expulsión genera fecha(s) de suspensión automáticamente. ' +
        'Si además hubo agresión, registra una incidencia.</p>';
    }

    if (tipo === 'cambio') {
      // al editar, el suplente que ya entró debe seguir apareciendo en su propio evento
      var banca = conJugador(opcJugadores(enBanca(p, equipoId)), ev ? ev.entraId : '');
      return (banca.length ? '' :
        '<p class="tiny" style="color:#e3b341;margin:0 0 10px">No quedan suplentes disponibles en la banca. ' +
        'Revisa la citación de este equipo.</p>') +
        '<label class="f"><span>SALE *</span><select name="saleId">' +
        U.opciones(cancha, ev ? ev.saleId : '', 'Seleccionar…') + '</select></label>' +
        '<label class="f"><span>ENTRA *</span><select name="entraId">' +
        U.opciones(banca, ev ? ev.entraId : '', 'Seleccionar…') + '</select></label>' +
        '<label class="f"><span>MOTIVO</span><input type="text" name="detalle" value="' + U.esc(ev ? ev.detalle : '') +
        '" placeholder="Táctico, lesión…"></label>';
    }

    return '<label class="f"><span>OBSERVACIÓN *</span><textarea name="detalle" placeholder="Incidente, lesión, reclamo, condición de cancha…">' +
      U.esc(ev ? ev.detalle : '') + '</textarea></label>';
  }

  return { render: render, transcurrido: transcurrido, enCancha: enCancha };
})();
