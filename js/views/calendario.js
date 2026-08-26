/* views/calendario.js — planilla de calendario: programación de partidos por día, hora y estadio */
window.V = window.V || {};
window.V.calendario = (function () {

  var filtroEquipo = '';
  var filtroEstado = '';
  var filtroJornada = null; // null = aún sin inicializar; '' = todas

  // Jornada "actual": la primera que todavía tiene partidos por jugar.
  // Con fixtures largos evita dibujar cientos de tarjetas de una vez.
  function jornadaActual() {
    var pend = S.partidosVisibles()
      .filter(function (p) { return p.jornada && p.estado !== 'finalizado'; })
      .map(function (p) { return Number(p.jornada); })
      .filter(function (n) { return !isNaN(n); });
    if (pend.length) return String(Math.min.apply(null, pend));
    var todas = S.partidosVisibles().map(function (p) { return Number(p.jornada); })
      .filter(function (n) { return !isNaN(n); });
    return todas.length ? String(Math.max.apply(null, todas)) : '';
  }

  function jornadasDisponibles() {
    var vistas = {};
    S.partidosVisibles().forEach(function (p) { if (p.jornada) vistas[p.jornada] = 1; });
    return Object.keys(vistas).sort(function (a, b) { return Number(a) - Number(b); });
  }

  var ESTADOS = {
    programado: { t: 'Programado', c: '' },
    en_curso: { t: 'En curso', c: 'ok' },
    finalizado: { t: 'Finalizado', c: 'info' },
    suspendido: { t: 'Suspendido', c: 'dang' }
  };

  function chipEstado(p) {
    var e = ESTADOS[p.estado] || ESTADOS.programado;
    return '<span class="chip ' + e.c + '">' + e.t + '</span>';
  }

  /* ---------------- vista ---------------- */
  function render(root) {
    var eqs = S.equiposVisibles();
    var jornadas = jornadasDisponibles();
    // con muchas jornadas se parte mostrando solo la vigente
    if (filtroJornada === null) filtroJornada = jornadas.length > 4 ? jornadaActual() : '';
    // si el torneo activo cambió, la jornada elegida puede ya no existir
    if (filtroJornada && jornadas.indexOf(String(filtroJornada)) < 0) filtroJornada = jornadaActual();

    var partidos = S.partidosVisibles().filter(function (p) {
      if (filtroEquipo && p.localId !== filtroEquipo && p.visitaId !== filtroEquipo) return false;
      if (filtroEstado && p.estado !== filtroEstado) return false;
      if (filtroJornada && String(p.jornada) !== String(filtroJornada)) return false;
      return true;
    });

    var h = '<div class="page-head"><h1>Calendario</h1>' +
      '<p>' + U.esc(S.divisionActiva() || S.d.torneo.division) + ' · ' +
      S.partidosVisibles().length + ' partido(s)</p></div>';

    if (eqs.length < 2) {
      h += '<div class="card"><div class="empty">Necesitas al menos 2 equipos registrados para calendarizar.<br>' +
        '<a class="chip info" style="margin-top:10px" href="#/equipos">Ir a Equipos</a></div></div>';
      root.innerHTML = h;
      return;
    }

    h += '<div class="row" style="margin-bottom:10px">' +
      '<button class="btn primary grow" data-nuevo>+ Programar partido</button>' +
      '<button class="btn" data-fixture title="Generar todos contra todos">⚡</button>' +
      '</div>';

    h += '<div class="grid-2" style="margin-bottom:8px">' +
      '<label class="f" style="margin:0"><span>EQUIPO</span><select name="fEq">' +
      U.opciones(eqs.map(function (e) { return { v: e.id, t: e.nombre }; }), filtroEquipo, 'Todos') +
      '</select></label>' +
      '<label class="f" style="margin:0"><span>ESTADO</span><select name="fEst">' +
      U.opciones(Object.keys(ESTADOS).map(function (k) { return { v: k, t: ESTADOS[k].t }; }), filtroEstado, 'Todos') +
      '</select></label></div>';

    if (jornadas.length) {
      h += '<label class="f" style="margin-bottom:12px"><span>FECHA / JORNADA</span><select name="fJor">' +
        U.opciones(jornadas.map(function (j) { return { v: j, t: 'Fecha ' + j }; }), filtroJornada,
          'Todas las fechas (' + S.partidosVisibles().length + ' partidos)') +
        '</select></label>';
    }

    if (!partidos.length) {
      h += '<div class="card"><div class="empty">No hay partidos con esos filtros.</div></div>';
    } else {
      var fechaActual = null;
      partidos.forEach(function (p) {
        if (p.fecha !== fechaActual) {
          fechaActual = p.fecha;
          h += '<div class="tiny dim" style="margin:14px 0 7px;font-weight:700;text-transform:uppercase;letter-spacing:.6px">' +
            (p.fecha ? U.fechaCorta(p.fecha) + ' · ' + U.fechaLarga(p.fecha) : 'Día por confirmar') +
            '</div>';
        }
        h += tarjetaPartido(p);
      });
    }

    root.innerHTML = h;

    root.querySelector('[data-nuevo]').addEventListener('click', function () { modalPartido(null); });
    root.querySelector('[data-fixture]').addEventListener('click', function () { modalFixture(); });
    root.querySelector('[name="fEq"]').addEventListener('change', function () {
      filtroEquipo = this.value; render(root);
    });
    root.querySelector('[name="fEst"]').addEventListener('change', function () {
      filtroEstado = this.value; render(root);
    });
    var selJ = root.querySelector('[name="fJor"]');
    if (selJ) selJ.addEventListener('change', function () {
      filtroJornada = this.value; render(root);
    });

    U.on(root, '[data-edit]', 'click', function (ev, b) {
      modalPartido(S.partido(b.getAttribute('data-edit')));
    });
    U.on(root, '[data-del]', 'click', function (ev, b) {
      var id = b.getAttribute('data-del');
      var p = S.partido(id);
      U.confirmar('¿Eliminar el partido ' + S.etiquetaPartido(p) + '? Se perderán su convocatoria y sus eventos.', function () {
        S.d.partidos = S.d.partidos.filter(function (x) { return x.id !== id; });
        S.save(); U.toast('Partido eliminado', 'ok'); render(root);
      });
    });
  }

  function tarjetaPartido(p) {
    var L = S.equipo(p.localId), Vi = S.equipo(p.visitaId);
    var est = S.estadio(p.estadioId);
    var m = S.marcador(p);
    var jugado = p.estado === 'finalizado' || p.estado === 'en_curso';

    return '<div class="card">' +
      '<div class="row" style="justify-content:space-between;margin-bottom:9px">' +
      '<span class="chip">🕒 ' + U.esc(p.hora || '--:--') + (p.jornada ? ' · Fecha ' + U.esc(p.jornada) : '') + '</span>' +
      chipEstado(p) + '</div>' +

      '<div class="score">' +
      '<div class="tm">' + V.equipos.escudoHTML(L, '') + '<b>' + U.esc(L ? L.nombre : '—') + '</b></div>' +
      '<div class="gg">' + (jugado ? m.local + ' - ' + m.visita : 'vs') + '</div>' +
      '<div class="tm">' + V.equipos.escudoHTML(Vi, '') + '<b>' + U.esc(Vi ? Vi.nombre : '—') + '</b></div>' +
      '</div>' +

      '<div class="tiny muted center" style="margin-top:9px">🏟️ ' +
      (est ? U.esc(est.nombre) + (est.direccion ? ' · ' + U.esc(est.direccion) : '') : '<span class="dim">Sede por definir</span>') +
      '</div>' +

      '<div class="row" style="margin-top:11px">' +
      '<a class="btn sm grow" href="#/convocatoria/' + p.id + '">📋 Citación</a>' +
      '<a class="btn sm grow primary" href="#/partido/' + p.id + '">⏱️ Planilla</a>' +
      '<button class="btn sm" data-edit="' + p.id + '">✎</button>' +
      '<button class="btn sm danger" data-del="' + p.id + '">✕</button>' +
      '</div></div>';
  }

  /* ---------------- alta / edición ---------------- */
  function opcionesEstadio() {
    return S.todosLosEstadios().map(function (x) {
      return { v: x.estadio.id, t: x.estadio.nombre + ' (' + x.equipo.nombre + ')' };
    });
  }

  function modalPartido(p) {
    // solo se cruzan equipos del torneo activo
    var eqOpts = S.equiposVisibles().map(function (e) { return { v: e.id, t: e.nombre }; });
    var estOpts = opcionesEstadio();

    U.modal({
      titulo: p ? 'Editar partido' : 'Programar partido',
      cuerpo:
        '<label class="f"><span>EQUIPO LOCAL *</span><select name="localId">' + U.opciones(eqOpts, p ? p.localId : '', 'Seleccionar…') + '</select></label>' +
        '<label class="f"><span>EQUIPO VISITA *</span><select name="visitaId">' + U.opciones(eqOpts, p ? p.visitaId : '', 'Seleccionar…') + '</select></label>' +
        '<div class="grid-2">' +
        '<label class="f"><span>DÍA *</span><input type="date" name="fecha" value="' + U.esc(p ? p.fecha : U.hoyISO()) + '"></label>' +
        '<label class="f"><span>HORA *</span><input type="time" name="hora" value="' + U.esc(p ? p.hora : '16:00') + '"></label>' +
        '</div>' +
        '<label class="f"><span>ESTADIO</span><select name="estadioId">' +
        U.opciones(estOpts, p ? p.estadioId : '', estOpts.length ? 'Por definir' : 'No hay estadios registrados') + '</select></label>' +
        '<div class="grid-2">' +
        '<label class="f"><span>FECHA / JORNADA N°</span><input type="number" name="jornada" min="1" value="' + U.esc(p ? p.jornada : '') + '"></label>' +
        '<label class="f"><span>ESTADO</span><select name="estado">' +
        U.opciones(Object.keys(ESTADOS).map(function (k) { return { v: k, t: ESTADOS[k].t }; }), p ? p.estado : 'programado') + '</select></label>' +
        '</div>',
      onOk: function (bg) {
        var localId = U.val(bg, 'localId'), visitaId = U.val(bg, 'visitaId');
        if (!localId || !visitaId) { U.toast('Debes elegir ambos equipos', 'err'); return false; }
        if (localId === visitaId) { U.toast('Un equipo no puede jugar contra sí mismo', 'err'); return false; }
        var fecha = U.val(bg, 'fecha');
        if (!fecha) { U.toast('El día es obligatorio', 'err'); return false; }

        var t = p;
        if (!t) {
          t = {
            id: U.uid('pt'),
            arbitros: { central: '', linea1: '', linea2: '', cuarto: '' },
            convocatoria: S.convocatoriaVacia(),
            eventos: [],
            timer: S.timerVacio()
          };
          S.d.partidos.push(t);
        } else if (t.localId !== localId || t.visitaId !== visitaId) {
          // cambiar de equipos invalida la convocatoria ya registrada
          t.convocatoria = S.convocatoriaVacia();
        }
        t.localId = localId;
        t.visitaId = visitaId;
        t.fecha = fecha;
        t.hora = U.val(bg, 'hora');
        t.estadioId = U.val(bg, 'estadioId');
        t.jornada = U.val(bg, 'jornada');
        t.estado = U.val(bg, 'estado') || 'programado';
        S.save();
        U.toast(p ? 'Partido actualizado' : 'Partido programado', 'ok');
        App.render();
      }
    });
  }

  /* ---------------- generador todos contra todos ---------------- */
  function modalFixture() {
    U.modal({
      titulo: 'Generar fixture',
      cuerpo:
        '<p class="tiny muted" style="margin:0 0 12px">Crea automáticamente los cruces entre los ' +
        S.equiposVisibles().length + ' equipos de ' +
        U.esc(S.divisionActiva() || 'todos los torneos') +
        ', una jornada por semana. Los partidos ya existentes no se duplican.</p>' +
        '<div class="grid-2">' +
        '<label class="f"><span>PRIMERA FECHA</span><input type="date" name="inicio" value="' + U.hoyISO() + '"></label>' +
        '<label class="f"><span>HORA</span><input type="time" name="hora" value="16:00"></label>' +
        '</div>' +
        '<label class="f row" style="gap:8px;align-items:center">' +
        '<input type="checkbox" name="vuelta" style="width:auto">' +
        '<span style="margin:0">Incluir partidos de vuelta</span></label>',
      okTexto: 'Generar',
      onOk: function (bg) {
        var inicio = U.val(bg, 'inicio');
        if (!inicio) { U.toast('Indica la primera fecha', 'err'); return false; }
        var hora = U.val(bg, 'hora') || '16:00';
        var vuelta = bg.querySelector('[name="vuelta"]').checked;
        var creados = generarFixture(inicio, hora, vuelta);
        S.save();
        U.toast(creados + ' partido(s) generados', 'ok');
        App.render();
      }
    });
  }

  // Round-robin simple: cada equipo enfrenta al resto; una jornada por semana.
  function generarFixture(inicioISO, hora, vuelta) {
    var eqs = S.equiposVisibles().map(function (e) { return e.id; });
    if (eqs.length < 2) return 0;

    var cruces = [];
    for (var i = 0; i < eqs.length; i++) {
      for (var j = i + 1; j < eqs.length; j++) {
        cruces.push([eqs[i], eqs[j]]);
        if (vuelta) cruces.push([eqs[j], eqs[i]]);
      }
    }

    var porJornada = Math.floor(eqs.length / 2) || 1;
    var d0 = new Date(inicioISO + 'T00:00:00');
    var creados = 0;

    cruces.forEach(function (c, idx) {
      var yaExiste = S.d.partidos.some(function (p) {
        return p.localId === c[0] && p.visitaId === c[1];
      });
      if (yaExiste) return;

      var semana = Math.floor(idx / porJornada);
      var d = new Date(d0.getTime());
      d.setDate(d.getDate() + semana * 7);
      var fecha = d.getFullYear() + '-' + U.pad2(d.getMonth() + 1) + '-' + U.pad2(d.getDate());

      var local = S.equipo(c[0]);
      var sede = local && local.estadios.length ? local.estadios[0].id : '';

      S.d.partidos.push({
        id: U.uid('pt'),
        localId: c[0], visitaId: c[1],
        fecha: fecha, hora: hora,
        estadioId: sede,
        jornada: String(semana + 1),
        estado: 'programado',
        arbitros: { central: '', linea1: '', linea2: '', cuarto: '' },
        convocatoria: S.convocatoriaVacia(),
        eventos: [],
        timer: S.timerVacio()
      });
      creados++;
    });

    return creados;
  }

  return { render: render, chipEstado: chipEstado, ESTADOS: ESTADOS, opcionesEstadio: opcionesEstadio };
})();
