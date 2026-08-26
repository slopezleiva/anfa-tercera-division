/* views/convocatoria.js — citación de ambos equipos (titulares / suplentes) y terna arbitral */
window.V = window.V || {};
window.V.convocatoria = (function () {

  var MAX_TITULARES = 11;
  var lado = 'local'; // local | visita | arbitros

  function render(root, args) {
    if (!args || !args[0]) return selector(root);
    var p = S.partido(args[0]);
    if (!p) { root.innerHTML = '<div class="card"><div class="empty">Partido no encontrado.</div></div>'; return; }
    detalle(root, p);
  }

  /* ---------------- selector de partido ---------------- */
  function selector(root) {
    var ps = S.partidosVisibles();
    var h = '<div class="page-head"><h1>Convocatoria</h1><p>' +
      (S.divisionActiva() ? U.esc(S.divisionActiva()) + ' · ' : '') +
      'Elige el partido para armar la citación</p></div>';

    if (!ps.length) {
      h += '<div class="card"><div class="empty">No hay partidos calendarizados.<br>' +
        '<a class="chip info" style="margin-top:10px" href="#/calendario">Ir al Calendario</a></div></div>';
    } else {
      h += '<div class="list">';
      ps.forEach(function (p) {
        var tot = p.convocatoria.local.titulares.length + p.convocatoria.local.suplentes.length +
          p.convocatoria.visita.titulares.length + p.convocatoria.visita.suplentes.length;
        h += '<a class="list-item" href="#/convocatoria/' + p.id + '">' +
          '<div class="grow"><div class="t">' + U.esc(S.nombreEquipo(p.localId)) + ' vs ' + U.esc(S.nombreEquipo(p.visitaId)) + '</div>' +
          '<div class="s">' + U.fechaCorta(p.fecha) + ' · ' + U.esc(p.hora || '--:--') + ' · ' + tot + ' citados</div></div>' +
          '<span class="dim">›</span></a>';
      });
      h += '</div>';
    }
    root.innerHTML = h;
  }

  /* ---------------- detalle ---------------- */
  function detalle(root, p) {
    var L = S.equipo(p.localId), Vi = S.equipo(p.visitaId);
    var est = S.estadio(p.estadioId);

    root.innerHTML = '' +
      '<a class="tiny dim" href="#/convocatoria">‹ Otros partidos</a>' +
      '<div class="card" style="margin-top:10px">' +
      '<div class="score">' +
      '<div class="tm">' + V.equipos.escudoHTML(L, '') + '<b>' + U.esc(L ? L.nombre : '—') + '</b></div>' +
      '<div class="gg" style="font-size:20px">vs</div>' +
      '<div class="tm">' + V.equipos.escudoHTML(Vi, '') + '<b>' + U.esc(Vi ? Vi.nombre : '—') + '</b></div>' +
      '</div>' +
      '<div class="tiny muted center" style="margin-top:9px">' +
      U.fechaCorta(p.fecha) + ' · ' + U.esc(p.hora || '--:--') +
      (est ? ' · 🏟️ ' + U.esc(est.nombre) : '') + '</div>' +
      '<a class="btn sm block primary" style="margin-top:11px" href="#/partido/' + p.id + '">Ir a la planilla del partido ›</a>' +
      '</div>' +

      '<div class="pill-tabs">' +
      '<button data-l="local" class="' + (lado === 'local' ? 'on' : '') + '">Local</button>' +
      '<button data-l="visita" class="' + (lado === 'visita' ? 'on' : '') + '">Visita</button>' +
      '<button data-l="arbitros" class="' + (lado === 'arbitros' ? 'on' : '') + '">Árbitros</button>' +
      '</div><div id="sub"></div>';

    U.on(root, '[data-l]', 'click', function (ev, b) {
      lado = b.getAttribute('data-l');
      detalle(root, p);
    });

    var sub = root.querySelector('#sub');
    if (lado === 'arbitros') pintaArbitros(sub, p);
    else pintaPlantel(sub, p, lado);
  }

  /* ---------------- plantel citable ---------------- */
  function pintaPlantel(sub, p, ladoEq) {
    var eqId = ladoEq === 'local' ? p.localId : p.visitaId;
    var eq = S.equipo(eqId);
    if (!eq) { sub.innerHTML = '<div class="card"><div class="empty">Equipo no disponible.</div></div>'; return; }

    var c = p.convocatoria[ladoEq];
    var susp = S.idsSuspendidos();
    var js = eq.jugadores.slice()
      .filter(function (j) { return j.activo !== false; })
      .sort(function (a, b) { return (Number(a.numero) || 999) - (Number(b.numero) || 999); });

    var h = '<div class="card tight">' +
      '<div class="card-head"><h3>' + U.esc(eq.nombre) + '</h3>' +
      '<div class="row">' +
      '<span class="chip ' + (c.titulares.length === MAX_TITULARES ? 'ok' : 'warn') + '">XI: ' + c.titulares.length + '/' + MAX_TITULARES + '</span>' +
      '<span class="chip info">Banca: ' + c.suplentes.length + '</span>' +
      '</div></div>' +
      '<p class="tiny dim" style="margin:0 0 10px">Toca un jugador para alternar: sin citar → <b>titular</b> → <b>suplente</b> → sin citar.</p>';

    if (!js.length) {
      h += '<div class="empty">Este equipo no tiene jugadores habilitados.</div>';
    } else {
      h += '<div class="list">';
      js.forEach(function (j) {
        var esT = c.titulares.indexOf(j.id) >= 0;
        var esS = c.suplentes.indexOf(j.id) >= 0;
        var sus = susp[j.id];
        h += '<div class="pick ' + (esT ? 'tit' : esS ? 'sup' : '') + (sus ? ' sus' : '') + '" data-j="' + j.id + '">' +
          '<div class="mk">' + (esT ? 'T' : esS ? 'S' : '') + '</div>' +
          '<div class="num">' + U.esc(j.numero || '–') + '</div>' +
          '<div class="grow">' +
          '<div class="t">' + U.esc(j.nombre) + '</div>' +
          '<div class="s">' + U.esc(j.posicion || 'Sin posición') +
          (sus ? ' · <span style="color:#ff7b72;font-weight:700">SUSPENDIDO (' + sus.pendientes + ' fecha/s)</span>' : '') +
          '</div></div></div>';
      });
      h += '</div>';
    }

    h += '<div class="row" style="margin-top:11px">' +
      '<button class="btn sm grow ghost" data-limpiar>Limpiar citación</button></div></div>';

    // resumen para leer o dictar
    h += '<div class="card"><div class="card-head"><h3>Resumen</h3></div>' +
      '<div class="tiny stack">' +
      '<div><b>Titulares (' + c.titulares.length + ')</b><br><span class="muted">' +
      (c.titulares.map(nombreConNumero).join(' · ') || '—') + '</span></div>' +
      '<div><b>Suplentes (' + c.suplentes.length + ')</b><br><span class="muted">' +
      (c.suplentes.map(nombreConNumero).join(' · ') || '—') + '</span></div>' +
      '</div></div>';

    sub.innerHTML = h;

    U.on(sub, '[data-j]', 'click', function (ev, row) {
      var jid = row.getAttribute('data-j');
      var iT = c.titulares.indexOf(jid), iS = c.suplentes.indexOf(jid);

      if (iT < 0 && iS < 0) {
        if (c.titulares.length >= MAX_TITULARES) {
          c.suplentes.push(jid);
          U.toast('Titulares completos: va a la banca', 'ok');
        } else {
          c.titulares.push(jid);
        }
        if (susp[jid]) U.toast('Ojo: ' + susp[jid].nombre + ' está suspendido', 'err');
      } else if (iT >= 0) {
        c.titulares.splice(iT, 1);
        c.suplentes.push(jid);
      } else {
        c.suplentes.splice(iS, 1);
      }
      S.save();
      pintaPlantel(sub, p, ladoEq);
    });

    sub.querySelector('[data-limpiar]').addEventListener('click', function () {
      U.confirmar('¿Borrar la citación completa de ' + eq.nombre + '?', function () {
        c.titulares = []; c.suplentes = [];
        S.save(); U.toast('Citación limpiada', 'ok');
        pintaPlantel(sub, p, ladoEq);
      });
    });
  }

  function nombreConNumero(jid) {
    var r = S.buscarJugador(jid);
    if (!r) return '—';
    return (r.jugador.numero ? r.jugador.numero + '. ' : '') + r.jugador.nombre;
  }

  /* ---------------- terna arbitral ---------------- */
  function pintaArbitros(sub, p) {
    var h = '<div class="card"><div class="card-head"><h3>Terna arbitral</h3></div>';
    S.ROLES_ARBITRO.forEach(function (r) {
      h += '<label class="f"><span>' + r.t.toUpperCase() + '</span>' +
        '<input type="text" name="' + r.k + '" value="' + U.esc(p.arbitros[r.k] || '') + '" placeholder="Nombre completo"></label>';
    });
    h += '<label class="f"><span>OBSERVACIONES DE LA TERNA</span>' +
      '<textarea name="obsArbitros" placeholder="Cambios de última hora, atrasos, etc.">' + U.esc(p.arbitros.observaciones || '') + '</textarea></label>' +
      '<button class="btn primary block" data-guardar>Guardar árbitros</button></div>';

    sub.innerHTML = h;

    sub.querySelector('[data-guardar]').addEventListener('click', function () {
      S.ROLES_ARBITRO.forEach(function (r) {
        p.arbitros[r.k] = U.val(sub, r.k);
      });
      p.arbitros.observaciones = U.val(sub, 'obsArbitros');
      S.save();
      U.toast('Terna arbitral guardada', 'ok');
    });
  }

  return { render: render, MAX_TITULARES: MAX_TITULARES };
})();
