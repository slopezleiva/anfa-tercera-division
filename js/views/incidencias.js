/* views/incidencias.js — registro, resolución y conclusiones de incidencias del torneo */
window.V = window.V || {};
window.V.incidencias = (function () {

  var filtro = '';

  var ESTADOS = {
    abierta: { t: 'Abierta', c: 'warn' },
    en_estudio: { t: 'En estudio', c: 'info' },
    resuelta: { t: 'Resuelta', c: 'ok' }
  };

  var SANCIONES = [
    { v: 'ninguna', t: 'Sin sanción' },
    { v: 'amonestacion', t: 'Amonestación (advertencia)' },
    { v: 'suspension', t: 'Suspensión de fechas' },
    { v: 'multa', t: 'Multa' }
  ];

  /* ---------------- vista ---------------- */
  function render(root) {
    // solo las incidencias de clubes del torneo activo
    var delTorneo = S.d.incidencias.filter(function (i) {
      return !S.divisionActiva() || !i.equipoId || S.divisionDeEquipo(i.equipoId) === S.divisionActiva();
    });

    var lista = delTorneo.slice().sort(function (a, b) {
      return (b.fecha || '').localeCompare(a.fecha || '');
    }).filter(function (i) { return !filtro || i.estado === filtro; });

    var abiertas = delTorneo.filter(function (i) { return i.estado !== 'resuelta'; }).length;

    var h = '<div class="page-head"><h1>Incidencias</h1>' +
      '<p>' + (S.divisionActiva() ? U.esc(S.divisionActiva()) + ' · ' : '') +
      delTorneo.length + ' registradas · ' + abiertas + ' pendientes de resolución</p></div>' +
      '<button class="btn primary block" data-nueva>+ Registrar incidencia</button>' +
      '<div class="pill-tabs" style="margin-top:12px">' +
      '<button data-f="" class="' + (filtro === '' ? 'on' : '') + '">Todas</button>' +
      '<button data-f="abierta" class="' + (filtro === 'abierta' ? 'on' : '') + '">Abiertas</button>' +
      '<button data-f="en_estudio" class="' + (filtro === 'en_estudio' ? 'on' : '') + '">En estudio</button>' +
      '<button data-f="resuelta" class="' + (filtro === 'resuelta' ? 'on' : '') + '">Resueltas</button>' +
      '</div>';

    if (!lista.length) {
      h += '<div class="card"><div class="empty">No hay incidencias en esta categoría.</div></div>';
    } else {
      lista.forEach(function (i) { h += tarjeta(i); });
    }

    root.innerHTML = h;

    root.querySelector('[data-nueva]').addEventListener('click', function () { modalIncidencia(null); });
    U.on(root, '[data-f]', 'click', function (ev, b) { filtro = b.getAttribute('data-f'); render(root); });
    U.on(root, '[data-edit]', 'click', function (ev, b) { modalIncidencia(buscar(b.getAttribute('data-edit'))); });
    U.on(root, '[data-resolver]', 'click', function (ev, b) { modalResolucion(buscar(b.getAttribute('data-resolver'))); });
    U.on(root, '[data-del]', 'click', function (ev, b) {
      var id = b.getAttribute('data-del');
      U.confirmar('¿Eliminar esta incidencia y su resolución?', function () {
        S.d.incidencias = S.d.incidencias.filter(function (x) { return x.id !== id; });
        S.save(); U.toast('Incidencia eliminada', 'ok'); render(root);
      });
    });
  }

  function buscar(id) {
    for (var i = 0; i < S.d.incidencias.length; i++) if (S.d.incidencias[i].id === id) return S.d.incidencias[i];
    return null;
  }

  function nombrePersona(inc) {
    if (!inc.personaId) return 'Sin individualizar';
    var r = S.buscarJugador(inc.personaId);
    if (r) return (r.jugador.numero ? r.jugador.numero + '. ' : '') + r.jugador.nombre;
    var eq = S.equipo(inc.equipoId);
    if (eq) {
      for (var i = 0; i < eq.cuerpoTecnico.length; i++) {
        if (eq.cuerpoTecnico[i].id === inc.personaId) {
          return eq.cuerpoTecnico[i].nombre + ' (' + eq.cuerpoTecnico[i].rol + ')';
        }
      }
    }
    return 'Persona no encontrada';
  }

  function textoSancion(inc) {
    var s = inc.sancion || {};
    if (!s.tipo || s.tipo === 'ninguna') return '<span class="chip">Sin sanción</span>';
    if (s.tipo === 'amonestacion') return '<span class="chip warn">Amonestación</span>';
    if (s.tipo === 'multa') return '<span class="chip warn">Multa ' + U.esc(s.monto || '') + '</span>';
    return '<span class="chip dang">Suspensión: ' + U.esc(s.partidos || 0) + ' fecha(s)</span>';
  }

  function tarjeta(i) {
    var est = ESTADOS[i.estado] || ESTADOS.abierta;
    var p = i.partidoId ? S.partido(i.partidoId) : null;

    return '<div class="card">' +
      '<div class="card-head"><h3>' + U.esc(i.tipo || 'Incidencia') + '</h3>' +
      '<span class="chip ' + est.c + '">' + est.t + '</span></div>' +

      '<div class="tiny muted stack">' +
      '<div>📅 ' + U.fechaLarga(i.fecha) + (p ? ' · ⚽ ' + U.esc(S.etiquetaPartido(p)) : '') + '</div>' +
      '<div>🛡️ ' + U.esc(S.nombreEquipo(i.equipoId)) + ' · 👤 ' + U.esc(nombrePersona(i)) + '</div>' +
      '</div>' +

      '<div class="hr"></div>' +
      '<div class="tiny"><b>Hechos</b><div class="muted" style="white-space:pre-wrap">' +
      U.esc(i.descripcion || '—') + '</div></div>' +

      (i.resolucion || (i.sancion && i.sancion.tipo && i.sancion.tipo !== 'ninguna')
        ? '<div class="hr"></div><div class="tiny"><b>Resolución y conclusiones</b>' +
        '<div class="muted" style="white-space:pre-wrap;margin-bottom:7px">' + U.esc(i.resolucion || '—') + '</div>' +
        textoSancion(i) +
        (i.fechaResolucion ? ' <span class="chip">Resuelta el ' + U.fechaLarga(i.fechaResolucion) + '</span>' : '') +
        '</div>'
        : '') +

      '<div class="row" style="margin-top:12px">' +
      '<button class="btn sm grow primary" data-resolver="' + i.id + '">⚖️ Resolver</button>' +
      '<button class="btn sm" data-edit="' + i.id + '">✎</button>' +
      '<button class="btn sm danger" data-del="' + i.id + '">✕</button>' +
      '</div></div>';
  }

  /* ---------------- alta / edición ---------------- */
  function opcionesPersona(equipoId) {
    var eq = S.equipo(equipoId);
    if (!eq) return [];
    var out = eq.jugadores.slice().sort(function (a, b) {
      return (Number(a.numero) || 999) - (Number(b.numero) || 999);
    }).map(function (j) {
      return { v: j.id, t: (j.numero ? j.numero + '. ' : '') + j.nombre + ' — jugador' };
    });
    eq.cuerpoTecnico.forEach(function (c) {
      if (c.nombre) out.push({ v: c.id, t: c.nombre + ' — ' + c.rol });
    });
    return out;
  }

  function modalIncidencia(inc) {
    var eqOpts = S.equiposVisibles().map(function (e) { return { v: e.id, t: e.nombre }; });
    var ptOpts = S.partidosVisibles().map(function (p) { return { v: p.id, t: S.etiquetaPartido(p) }; });
    var tipoOpts = S.TIPOS_INCIDENCIA.map(function (t) { return { v: t, t: t }; });

    U.modal({
      titulo: inc ? 'Editar incidencia' : 'Registrar incidencia',
      cuerpo:
        '<label class="f"><span>TIPO *</span><select name="tipo">' + U.opciones(tipoOpts, inc ? inc.tipo : '', 'Seleccionar…') + '</select></label>' +
        '<div class="grid-2">' +
        '<label class="f"><span>FECHA *</span><input type="date" name="fecha" value="' + U.esc(inc ? inc.fecha : U.hoyISO()) + '"></label>' +
        '<label class="f"><span>ESTADO</span><select name="estado">' +
        U.opciones(Object.keys(ESTADOS).map(function (k) { return { v: k, t: ESTADOS[k].t }; }), inc ? inc.estado : 'abierta') + '</select></label>' +
        '</div>' +
        '<label class="f"><span>PARTIDO RELACIONADO</span><select name="partidoId">' +
        U.opciones(ptOpts, inc ? inc.partidoId : '', 'Sin partido asociado') + '</select></label>' +
        '<label class="f"><span>EQUIPO</span><select name="equipoId">' + U.opciones(eqOpts, inc ? inc.equipoId : '', 'Seleccionar…') + '</select></label>' +
        '<label class="f"><span>PERSONA INVOLUCRADA</span><select name="personaId"></select></label>' +
        '<label class="f"><span>DESCRIPCIÓN DE LOS HECHOS *</span>' +
        '<textarea name="descripcion" placeholder="Qué ocurrió, minuto, participantes, informe del árbitro…">' + U.esc(inc ? inc.descripcion : '') + '</textarea></label>',
      onAbrir: function (bg) {
        var selEq = bg.querySelector('[name="equipoId"]');
        var selP = bg.querySelector('[name="personaId"]');
        function pintaPersonas() {
          selP.innerHTML = U.opciones(opcionesPersona(selEq.value), inc ? inc.personaId : '', 'Sin individualizar');
        }
        selEq.addEventListener('change', pintaPersonas);
        pintaPersonas();
      },
      onOk: function (bg) {
        var tipo = U.val(bg, 'tipo');
        var desc = U.val(bg, 'descripcion');
        if (!tipo) { U.toast('Selecciona el tipo de incidencia', 'err'); return false; }
        if (!desc) { U.toast('Describe los hechos', 'err'); return false; }

        var t = inc;
        if (!t) {
          t = { id: U.uid('inc'), resolucion: '', fechaResolucion: '', sancion: { tipo: 'ninguna', partidos: 0, monto: '' } };
          S.d.incidencias.push(t);
        }
        t.tipo = tipo;
        t.fecha = U.val(bg, 'fecha') || U.hoyISO();
        t.estado = U.val(bg, 'estado') || 'abierta';
        t.partidoId = U.val(bg, 'partidoId');
        t.equipoId = U.val(bg, 'equipoId');
        t.personaId = U.val(bg, 'personaId');
        t.personaTipo = t.personaId ? (S.buscarJugador(t.personaId) ? 'jugador' : 'tecnico') : '';
        t.descripcion = desc;
        S.save();
        U.toast(inc ? 'Incidencia actualizada' : 'Incidencia registrada', 'ok');
        App.render();
      }
    });
  }

  /* ---------------- resolución ---------------- */
  function modalResolucion(inc) {
    if (!inc) return;
    var s = inc.sancion || { tipo: 'ninguna', partidos: 0, monto: '' };

    U.modal({
      titulo: 'Resolución y conclusiones',
      cuerpo:
        '<p class="tiny dim" style="margin:0 0 12px">' + U.esc(inc.tipo) + ' · ' + U.esc(nombrePersona(inc)) +
        ' · ' + U.esc(S.nombreEquipo(inc.equipoId)) + '</p>' +
        '<label class="f"><span>CONCLUSIÓN DEL TRIBUNAL *</span>' +
        '<textarea name="resolucion" placeholder="Fundamentos, artículos aplicados y decisión adoptada…">' + U.esc(inc.resolucion || '') + '</textarea></label>' +
        '<label class="f"><span>SANCIÓN</span><select name="stipo">' + U.opciones(SANCIONES, s.tipo || 'ninguna') + '</select></label>' +
        '<div class="grid-2">' +
        '<label class="f"><span>FECHAS DE SUSPENSIÓN</span><input type="number" name="spartidos" min="0" value="' + U.esc(s.partidos || 0) + '"></label>' +
        '<label class="f"><span>MONTO MULTA</span><input type="text" name="smonto" value="' + U.esc(s.monto || '') + '" placeholder="Ej: $50.000"></label>' +
        '</div>' +
        '<label class="f"><span>FECHA DE RESOLUCIÓN</span><input type="date" name="fechaResolucion" value="' + U.esc(inc.fechaResolucion || U.hoyISO()) + '"></label>' +
        '<p class="tiny dim" style="margin:0">Al resolver con suspensión, las fechas se descuentan automáticamente ' +
        'en la página de Datos y se avisa al armar la convocatoria.</p>',
      okTexto: 'Guardar y marcar resuelta',
      onOk: function (bg) {
        var res = U.val(bg, 'resolucion');
        if (!res) { U.toast('Escribe la conclusión', 'err'); return false; }
        inc.resolucion = res;
        inc.sancion = {
          tipo: U.val(bg, 'stipo') || 'ninguna',
          partidos: Number(U.val(bg, 'spartidos')) || 0,
          monto: U.val(bg, 'smonto')
        };
        inc.fechaResolucion = U.val(bg, 'fechaResolucion') || U.hoyISO();
        inc.estado = 'resuelta';
        S.save();
        U.toast('Incidencia resuelta', 'ok');
        App.render();
      }
    });
  }

  return { render: render, ESTADOS: ESTADOS };
})();
