/* views/datos.js — estadísticas del torneo: goles, asistencias, tarjetas y suspensiones */
window.V = window.V || {};
window.V.datos = (function () {

  var seccion = 'resumen';   // resumen | jugadores | suspendidos | partido
  var filtroPartido = '';    // '' = toda la temporada

  // ¿el club pertenece al torneo activo? (sin torneo activo, todos entran)
  function enTorneo(equipoId) {
    var a = S.divisionActiva();
    return !a || S.divisionDeEquipo(equipoId) === a;
  }

  function render(root) {
    // si el partido elegido no es del torneo activo, se descarta la selección
    if (filtroPartido) {
      var pSel = S.partido(filtroPartido);
      if (!pSel || !enTorneo(pSel.localId)) filtroPartido = '';
    }

    var ptOpts = S.partidosVisibles()
      .filter(function (p) { return p.estado === 'finalizado' || p.estado === 'en_curso'; })
      .map(function (p) {
        var m = S.marcador(p);
        return {
          v: p.id,
          t: S.nombreEquipo(p.localId) + ' ' + m.local + '-' + m.visita + ' ' + S.nombreEquipo(p.visitaId) + ' · ' + U.fechaCorta(p.fecha)
        };
      });

    root.innerHTML = '<div class="page-head"><h1>Datos</h1>' +
      '<p>' + U.esc(S.d.torneo.nombre) + ' · ' +
      U.esc(S.divisionActiva() || S.d.torneo.division) + '</p></div>' +

      '<label class="f"><span>ÁMBITO</span><select name="fp">' +
      U.opciones(ptOpts, filtroPartido,
        'Global de ' + (S.divisionActiva() || 'todos los torneos')) + '</select></label>' +

      '<div class="pill-tabs">' +
      '<button data-s="resumen" class="' + (seccion === 'resumen' ? 'on' : '') + '">Resumen</button>' +
      '<button data-s="jugadores" class="' + (seccion === 'jugadores' ? 'on' : '') + '">Jugadores</button>' +
      '<button data-s="suspendidos" class="' + (seccion === 'suspendidos' ? 'on' : '') + '">Suspendidos</button>' +
      '<button data-s="partido" class="' + (seccion === 'partido' ? 'on' : '') + '">Partidos</button>' +
      '</div><div id="sec"></div>';

    root.querySelector('[name="fp"]').addEventListener('change', function () {
      filtroPartido = this.value;
      render(root);
    });
    U.on(root, '[data-s]', 'click', function (ev, b) {
      seccion = b.getAttribute('data-s');
      render(root);
    });

    var sec = root.querySelector('#sec');
    if (seccion === 'resumen') pintaResumen(sec);
    else if (seccion === 'jugadores') pintaJugadores(sec);
    else if (seccion === 'suspendidos') pintaSuspendidos(sec);
    else pintaPartidos(sec);
  }

  /* ---------------- resumen ---------------- */
  function pintaResumen(sec) {
    var stats = statsDelTorneo();
    var tot = { goles: 0, asist: 0, am: 0, rj: 0 };
    stats.forEach(function (s) {
      tot.goles += s.goles; tot.asist += s.asistencias;
      tot.am += s.amarillas; tot.rj += s.rojas;
    });
    var jugados = S.partidosVisibles().filter(function (p) {
      return (p.estado === 'finalizado' || p.estado === 'en_curso') && (!filtroPartido || p.id === filtroPartido);
    }).length;

    var h = '<div class="card"><div class="card-head"><h3>' +
      (filtroPartido ? 'Totales del partido' : 'Totales de ' + U.esc(S.divisionActiva() || 'la temporada')) +
      '</h3></div>' +
      '<div class="grid-2">' +
      caja('Partidos', jugados) + caja('Goles', tot.goles) +
      caja('Asistencias', tot.asist) + caja('Amarillas', tot.am) +
      caja('Rojas', tot.rj) + caja('Equipos', S.equiposVisibles().length) +
      '</div></div>';

    if (!filtroPartido) {
      var tabla = S.tablaPosiciones();
      // cada división compite por separado: una tabla por división
      var divPorEquipo = {};
      S.d.equipos.forEach(function (e) { divPorEquipo[e.id] = e.division || S.SIN_DIVISION; });

      if (!tabla.length) {
        h += '<div class="card tight"><div class="card-head"><h3>Tabla de posiciones</h3></div>' +
          '<div class="empty">Sin equipos registrados.</div></div>';
      } else {
        var divs = S.divisionesUsadas().filter(function (d) {
          return !S.divisionActiva() || d === S.divisionActiva();
        });
        divs.forEach(function (div) {
          var filas = tabla.filter(function (r) { return divPorEquipo[r.id] === div; });
          if (!filas.length) return;
          h += '<div class="card tight"><div class="card-head"><h3>Posiciones · ' + U.esc(div) + '</h3></div>' +
            '<div class="tbl-wrap"><table><thead><tr>' +
            '<th class="n">#</th><th>Equipo</th><th class="n">PJ</th><th class="n">G</th><th class="n">E</th>' +
            '<th class="n">P</th><th class="n">GF</th><th class="n">GC</th><th class="n">DIF</th><th class="n">PTS</th>' +
            '</tr></thead><tbody>';
          filas.forEach(function (r, i) {
            h += '<tr><td class="n">' + (i + 1) + '</td><td>' + U.esc(r.nombre) + '</td>' +
              '<td class="n">' + r.pj + '</td><td class="n">' + r.g + '</td><td class="n">' + r.e + '</td>' +
              '<td class="n">' + r.p + '</td><td class="n">' + r.gf + '</td><td class="n">' + r.gc + '</td>' +
              '<td class="n">' + (r.dif > 0 ? '+' : '') + r.dif + '</td>' +
              '<td class="n"><b>' + r.pts + '</b></td></tr>';
          });
          h += '</tbody></table></div></div>';
        });
      }
    }

    h += topLista('Goleadores', stats.filter(function (s) { return s.goles > 0; })
      .sort(function (a, b) { return b.goles - a.goles; }), 'goles', '⚽');
    h += topLista('Asistencias', stats.filter(function (s) { return s.asistencias > 0; })
      .sort(function (a, b) { return b.asistencias - a.asistencias; }), 'asistencias', '🅰️');

    sec.innerHTML = h;
  }

  // estadísticas individuales acotadas al torneo activo
  function statsDelTorneo() {
    return S.statsJugadores(filtroPartido || null).filter(function (s) {
      return enTorneo(s.equipoId);
    });
  }

  function caja(t, v) {
    return '<div class="card tight center" style="margin:0">' +
      '<div style="font-size:24px;font-weight:800" class="mono">' + v + '</div>' +
      '<div class="tiny dim">' + U.esc(t) + '</div></div>';
  }

  function topLista(titulo, lista, campo, ic) {
    var h = '<div class="card tight"><div class="card-head"><h3>' + ic + ' ' + titulo + '</h3></div>';
    if (!lista.length) return h + '<div class="empty">Sin registros.</div></div>';
    h += '<div class="list">';
    lista.slice(0, 15).forEach(function (s, i) {
      h += '<div class="list-item">' +
        '<div class="num">' + (i + 1) + '</div>' +
        '<div class="grow"><div class="t">' + U.esc(s.nombre) + '</div>' +
        '<div class="s">' + U.esc(s.equipo) + '</div></div>' +
        '<div class="chip ok mono">' + s[campo] + '</div></div>';
    });
    return h + '</div></div>';
  }

  /* ---------------- jugadores ---------------- */
  function pintaJugadores(sec) {
    var stats = statsDelTorneo()
      .sort(function (a, b) {
        return b.goles - a.goles || b.asistencias - a.asistencias || a.nombre.localeCompare(b.nombre);
      });

    var h = '<div class="card tight"><div class="card-head"><h3>Estadística individual</h3>' +
      '<span class="chip">' + stats.length + '</span></div>';

    if (!stats.length) {
      sec.innerHTML = h + '<div class="empty">Aún no hay partidos jugados con datos registrados.</div></div>';
      return;
    }

    h += '<div class="tbl-wrap"><table><thead><tr>' +
      '<th>Jugador</th><th>Equipo</th><th class="n">PJ</th><th class="n">⚽</th><th class="n">🅰️</th>' +
      '<th class="n">🟨</th><th class="n">🟥</th></tr></thead><tbody>';
    stats.forEach(function (s) {
      h += '<tr><td>' + (s.numero ? U.esc(s.numero) + '. ' : '') + U.esc(s.nombre) + '</td>' +
        '<td>' + U.esc(s.equipo) + '</td>' +
        '<td class="n">' + s.pj + '</td>' +
        '<td class="n">' + s.goles + (s.autogoles ? ' <span class="dim">(' + s.autogoles + ' ag)</span>' : '') + '</td>' +
        '<td class="n">' + s.asistencias + '</td>' +
        '<td class="n">' + s.amarillas + '</td>' +
        '<td class="n">' + s.rojas + '</td></tr>';
    });
    h += '</tbody></table></div></div>';

    sec.innerHTML = h;
  }

  /* ---------------- suspendidos ---------------- */
  function pintaSuspendidos(sec) {
    var sus = S.suspensiones().filter(function (s) { return enTorneo(s.equipoId); });
    var cfg = S.d.config;

    var h = '<div class="card"><div class="card-head"><h3>Reglamento aplicado</h3></div>' +
      '<div class="tiny muted row wrap">' +
      '<span class="chip warn">' + cfg.amarillasPorFecha + ' amarillas = 1 fecha</span>' +
      '<span class="chip dang">1 roja = ' + cfg.fechasPorRoja + ' fecha(s)</span>' +
      '<span class="chip">' + (cfg.dobleAmarillaNoAcumula ? 'La doble amarilla no acumula' : 'La doble amarilla acumula') + '</span>' +
      '</div><p class="tiny dim" style="margin:9px 0 0">Se descuentan automáticamente las fechas ya cumplidas ' +
      'según los partidos finalizados de cada equipo.</p></div>';

    h += '<div class="card tight"><div class="card-head"><h3>Jugadores suspendidos</h3>' +
      '<span class="chip ' + (sus.length ? 'dang' : 'ok') + '">' + sus.length + '</span></div>';

    if (!sus.length) {
      h += '<div class="empty">Ningún jugador tiene fechas pendientes.</div></div>';
    } else {
      h += '<div class="list">';
      sus.forEach(function (s) {
        h += '<div class="list-item" style="align-items:flex-start">' +
          '<div class="num">' + U.esc(s.numero || '–') + '</div>' +
          '<div class="grow">' +
          '<div class="t">' + U.esc(s.nombre) + '</div>' +
          '<div class="s">' + U.esc(s.equipo) + ' · ' + s.amarillasAcum + ' amarilla(s) acumuladas</div>' +
          '<div class="row wrap" style="margin-top:6px">' +
          s.motivos.map(function (m) { return '<span class="chip ' + m.clase + '">' + U.esc(m.txt) + '</span>'; }).join('') +
          '</div></div>' +
          '<div class="chip dang">' + s.pendientes + ' fecha(s)</div></div>';
      });
      h += '</div></div>';
    }

    // a una amarilla de la suspensión
    var stats = S.statsJugadores(null).filter(function (s) { return enTorneo(s.equipoId); });
    var riesgo = stats.filter(function (x) {
      return x.amarillas > 0 && (x.amarillas % cfg.amarillasPorFecha) === cfg.amarillasPorFecha - 1;
    });
    h += '<div class="card tight"><div class="card-head"><h3>⚠️ Al límite de amarillas</h3>' +
      '<span class="chip warn">' + riesgo.length + '</span></div>';
    if (!riesgo.length) {
      h += '<div class="empty">Nadie está a una amarilla de la suspensión.</div>';
    } else {
      h += '<div class="list">';
      riesgo.forEach(function (x) {
        h += '<div class="list-item"><div class="num">' + U.esc(x.numero || '–') + '</div>' +
          '<div class="grow"><div class="t">' + U.esc(x.nombre) + '</div>' +
          '<div class="s">' + U.esc(x.equipo) + '</div></div>' +
          '<div class="chip warn">' + x.amarillas + ' 🟨</div></div>';
      });
      h += '</div>';
    }
    h += '</div>';

    // sanciones dictadas por el tribunal (incluye cuerpo técnico)
    var incs = S.d.incidencias.filter(function (i) {
      return i.estado === 'resuelta' && i.sancion && i.sancion.tipo && i.sancion.tipo !== 'ninguna' &&
        (!i.equipoId || enTorneo(i.equipoId));
    });
    h += '<div class="card tight"><div class="card-head"><h3>⚖️ Sanciones por incidencia</h3>' +
      '<span class="chip">' + incs.length + '</span></div>';
    if (!incs.length) {
      h += '<div class="empty">Sin sanciones dictadas.</div>';
    } else {
      h += '<div class="list">';
      incs.forEach(function (i) {
        var s = i.sancion;
        var txt = s.tipo === 'suspension' ? s.partidos + ' fecha(s)'
          : s.tipo === 'multa' ? 'Multa ' + (s.monto || '')
            : 'Amonestación';
        h += '<div class="list-item"><div class="grow">' +
          '<div class="t">' + U.esc(i.tipo) + '</div>' +
          '<div class="s">' + U.esc(S.nombreEquipo(i.equipoId)) + ' · ' + U.esc(nombrePersonaCorto(i)) +
          ' · ' + U.fechaLarga(i.fechaResolucion || i.fecha) + '</div></div>' +
          '<div class="chip ' + (s.tipo === 'suspension' ? 'dang' : 'warn') + '">' + U.esc(txt) + '</div></div>';
      });
      h += '</div>';
    }
    h += '</div>';

    sec.innerHTML = h;
  }

  function nombrePersonaCorto(inc) {
    if (!inc.personaId) return 'Sin individualizar';
    var r = S.buscarJugador(inc.personaId);
    if (r) return r.jugador.nombre;
    var eq = S.equipo(inc.equipoId);
    if (eq) {
      for (var i = 0; i < eq.cuerpoTecnico.length; i++) {
        if (eq.cuerpoTecnico[i].id === inc.personaId) return eq.cuerpoTecnico[i].nombre;
      }
    }
    return '—';
  }

  /* ---------------- detalle por partido ---------------- */
  function pintaPartidos(sec) {
    var ps = S.partidosVisibles().filter(function (p) {
      if (filtroPartido) return p.id === filtroPartido;
      return p.estado === 'finalizado' || p.estado === 'en_curso';
    });

    if (!ps.length) {
      sec.innerHTML = '<div class="card"><div class="empty">No hay partidos jugados todavía.</div></div>';
      return;
    }

    var h = '';
    ps.forEach(function (p) {
      var m = S.marcador(p);
      var est = S.estadio(p.estadioId);
      var evs = S.eventosOrdenados(p);

      h += '<div class="card">' +
        '<div class="row" style="justify-content:space-between;margin-bottom:8px">' +
        '<span class="chip">' + U.fechaCorta(p.fecha) + ' · ' + U.esc(p.hora || '--:--') + '</span>' +
        V.calendario.chipEstado(p) + '</div>' +

        '<div class="score">' +
        '<div class="tm">' + V.equipos.escudoHTML(S.equipo(p.localId), '') + '<b>' + U.esc(S.nombreEquipo(p.localId)) + '</b></div>' +
        '<div class="gg">' + m.local + ' - ' + m.visita + '</div>' +
        '<div class="tm">' + V.equipos.escudoHTML(S.equipo(p.visitaId), '') + '<b>' + U.esc(S.nombreEquipo(p.visitaId)) + '</b></div>' +
        '</div>' +

        '<div class="tiny muted center" style="margin-top:8px">' +
        (est ? '🏟️ ' + U.esc(est.nombre) : '🏟️ Sede sin definir') + '</div>' +

        '<div class="hr"></div>' +
        '<div class="tiny"><b>Terna arbitral</b><div class="muted">' +
        S.ROLES_ARBITRO.map(function (r) {
          return U.esc(r.t) + ': ' + U.esc(p.arbitros[r.k] || '—');
        }).join(' · ') + '</div></div>' +

        '<div class="hr"></div>' +
        '<div class="tiny"><b>Incidencias del juego (' + evs.length + ')</b></div>';

      if (!evs.length) {
        h += '<div class="empty tiny">Sin eventos registrados.</div>';
      } else {
        h += '<div class="list" style="margin-top:8px">';
        evs.forEach(function (e) {
          h += '<div class="ev"><div class="min">' + e.minuto + "'</div>" +
            '<div class="ic">' + (S.TIPOS_EVENTO[e.tipo] ? S.TIPOS_EVENTO[e.tipo].ic : '•') + '</div>' +
            '<div class="bd"><b>' + U.esc(resumenEvento(e)) + '</b>' +
            '<small>' + U.esc(S.nombreEquipo(e.equipoId)) + '</small></div></div>';
        });
        h += '</div>';
      }

      h += '<div class="hr"></div>' +
        '<div class="tiny"><b>Formaciones</b>' +
        '<div class="muted" style="margin-top:5px">' +
        '<u>' + U.esc(S.nombreEquipo(p.localId)) + '</u><br>' + listaCitados(p, 'local') + '</div>' +
        '<div class="muted" style="margin-top:7px">' +
        '<u>' + U.esc(S.nombreEquipo(p.visitaId)) + '</u><br>' + listaCitados(p, 'visita') + '</div>' +
        '</div>' +
        '<a class="btn sm block" style="margin-top:11px" href="#/partido/' + p.id + '">Abrir planilla ›</a>' +
        '</div>';
    });

    sec.innerHTML = h;
  }

  function resumenEvento(e) {
    var jn = e.jugadorId ? S.nombreJugador(e.jugadorId) : '';
    switch (e.tipo) {
      case 'gol': return 'Gol de ' + jn + (e.asistenteId ? ' (asist. ' + S.nombreJugador(e.asistenteId) + ')' : '');
      case 'autogol': return 'Autogol de ' + jn;
      case 'amarilla': return 'Amarilla a ' + jn;
      case 'roja': return 'Roja a ' + jn;
      case 'cambio': return 'Sale ' + S.nombreJugador(e.saleId) + ', entra ' + S.nombreJugador(e.entraId);
      default: return 'Obs.: ' + (e.detalle || '');
    }
  }

  function listaCitados(p, lado) {
    var c = p.convocatoria[lado];
    function nom(jid) {
      var r = S.buscarJugador(jid);
      return r ? U.esc((r.jugador.numero ? r.jugador.numero + '. ' : '') + r.jugador.nombre) : '—';
    }
    return 'XI: ' + (c.titulares.map(nom).join(', ') || '—') +
      '<br>Banca: ' + (c.suplentes.map(nom).join(', ') || '—');
  }

  return { render: render };
})();
