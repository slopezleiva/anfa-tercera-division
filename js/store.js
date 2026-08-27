/* store.js — estado del torneo, persistencia y cálculos derivados (namespace global S) */
window.S = (function () {

  var KEY = 'anfa_torneo_v1';
  var RESPALDO_INICIAL = 'datos/respaldo-tercera-division-2026.json';

  /* ============ catálogos fijos ============ */

  // 10 cargos nominados + 4 puestos libres reconfigurables.
  var ROLES_CT = [
    'Director Técnico',
    'Preparador Físico',
    'Asistente de Campo 1',
    'Asistente de Campo 2',
    'Asistente de Campo 3',
    'Entrenador Ayudante',
    'Preparador de Arqueros',
    'Enfermero',
    'Kinesiólogo',
    'Videoanalista',
    'Puesto Libre 1',
    'Puesto Libre 2',
    'Puesto Libre 3',
    'Puesto Libre 4'
  ];
  var ROLES_LIBRES_DESDE = 10; // índice del primer puesto libre (rol editable)

  var POSICIONES = ['Arquero', 'Defensa', 'Mediocampista', 'Delantero'];

  var ROLES_ARBITRO = [
    { k: 'central', t: 'Árbitro Central' },
    { k: 'linea1', t: 'Juez de Línea 1' },
    { k: 'linea2', t: 'Juez de Línea 2' },
    { k: 'cuarto', t: 'Cuarto Árbitro' }
  ];

  var TIPOS_EVENTO = {
    gol: { t: 'Gol', ic: '⚽' },
    autogol: { t: 'Autogol', ic: '🥅' },
    amarilla: { t: 'Tarjeta amarilla', ic: '🟨' },
    roja: { t: 'Tarjeta roja', ic: '🟥' },
    cambio: { t: 'Cambio', ic: '🔁' },
    observacion: { t: 'Observación', ic: '📝' }
  };

  var TIPOS_INCIDENCIA = [
    'Expulsión', 'Agresión', 'Conducta antideportiva', 'Reclamo de equipo',
    'Insultos al árbitro', 'Suspensión de partido', 'Jugador mal inscrito', 'Otra'
  ];

  var MAX_JUGADORES = 35;
  var MAX_ESTADIOS = 2;

  // Divisiones sugeridas; el campo es texto libre y esto solo alimenta el autocompletado.
  var DIVISIONES = ['Tercera A Nacional', 'Tercera B Norte', 'Tercera B Sur'];
  var SIN_DIVISION = 'Sin división asignada';

  // Torneo activo: preferencia de interfaz, guardada aparte del respaldo para
  // que importar datos no la pise. '' = ver todos los torneos juntos.
  var KEY_DIV = 'anfa_division_activa';
  var divActiva = '';

  function divisionActiva() { return divActiva; }

  function setDivisionActiva(d) {
    divActiva = d || '';
    try {
      if (divActiva) localStorage.setItem(KEY_DIV, divActiva);
      else localStorage.removeItem(KEY_DIV);
    } catch (e) { /* modo privado: se pierde al cerrar, no es crítico */ }
  }

  function divisionDeEquipo(eqId) {
    var e = equipo(eqId);
    return e ? (e.division || SIN_DIVISION) : '';
  }

  // Un partido pertenece a la división de sus equipos (ambos comparten torneo).
  function divisionDePartido(p) {
    return p ? divisionDeEquipo(p.localId) : '';
  }

  function enDivisionActiva(div) {
    return !divActiva || div === divActiva;
  }

  function equiposVisibles() {
    return data.equipos.filter(function (e) {
      return enDivisionActiva(e.division || SIN_DIVISION);
    });
  }

  function partidosVisibles() {
    return partidosOrdenados().filter(function (p) {
      return enDivisionActiva(divisionDePartido(p));
    });
  }

  /* ============ estado ============ */

  var data = null;

  function base() {
    return {
      v: 1,
      config: {
        amarillasPorFecha: 3,
        fechasPorRoja: 1,
        duracionPeriodo: 45,
        dobleAmarillaNoAcumula: true
      },
      torneo: { nombre: 'Torneo ANFA', division: 'Primera División' },
      equipos: [],
      partidos: [],
      incidencias: []
    };
  }

  function cuerpoTecnicoVacio() {
    return ROLES_CT.map(function (r, i) {
      return { id: U.uid('ct'), rol: r, libre: i >= ROLES_LIBRES_DESDE, nombre: '', rut: '', telefono: '' };
    });
  }

  function convocatoriaVacia() {
    return {
      local: { titulares: [], suplentes: [] },
      visita: { titulares: [], suplentes: [] }
    };
  }

  function timerVacio() {
    return { corriendo: false, periodo: 1, acumuladoMs: 0, inicioTs: null };
  }

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      data = raw ? JSON.parse(raw) : base();
    } catch (e) {
      data = base();
    }
    // saneamiento: tolera JSON incompleto o de una versión previa
    var b = base();
    if (!data.config) data.config = b.config;
    Object.keys(b.config).forEach(function (k) {
      if (data.config[k] === undefined) data.config[k] = b.config[k];
    });
    if (!data.torneo) data.torneo = b.torneo;
    ['equipos', 'partidos', 'incidencias'].forEach(function (k) {
      if (!Array.isArray(data[k])) data[k] = [];
    });
    data.equipos.forEach(function (e) {
      if (!Array.isArray(e.jugadores)) e.jugadores = [];
      if (!Array.isArray(e.estadios)) e.estadios = [];
      if (!Array.isArray(e.cuerpoTecnico) || !e.cuerpoTecnico.length) e.cuerpoTecnico = cuerpoTecnicoVacio();
    });
    data.partidos.forEach(function (p) {
      if (!p.arbitros) p.arbitros = { central: '', linea1: '', linea2: '', cuarto: '' };
      if (!p.convocatoria) p.convocatoria = convocatoriaVacia();
      if (!Array.isArray(p.eventos)) p.eventos = [];
      if (!p.timer) p.timer = timerVacio();
      if (!p.estado) p.estado = 'programado';
    });

    // recupera el torneo activo y lo descarta si ya no existe en los datos
    try { divActiva = localStorage.getItem(KEY_DIV) || ''; } catch (e) { divActiva = ''; }
    if (divActiva && divisionesUsadas().indexOf(divActiva) < 0) setDivisionActiva('');

    return data;
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      U.toast('No se pudo guardar: almacenamiento lleno', 'err');
      return false;
    }
  }

  // Arranque de la app: si este navegador nunca guardó un torneo, precarga
  // el respaldo de los 42 clubes (servido como archivo estático) para no
  // depender de que cada dispositivo lo importe a mano desde Configuración.
  function cargarConSemilla(cb) {
    var yaHayDatos;
    try { yaHayDatos = !!localStorage.getItem(KEY); } catch (e) { yaHayDatos = true; }
    if (yaHayDatos) { load(); cb(); return; }

    fetch(RESPALDO_INICIAL)
      .then(function (r) { if (!r.ok) throw new Error('sin semilla'); return r.json(); })
      .then(function (obj) { localStorage.setItem(KEY, JSON.stringify(obj)); })
      .catch(function () { /* sin conexión o sin archivo: arranca vacío como antes */ })
      .then(function () { load(); cb(); });
  }

  /* ============ accesores ============ */

  function equipo(id) {
    for (var i = 0; i < data.equipos.length; i++) if (data.equipos[i].id === id) return data.equipos[i];
    return null;
  }

  function nombreEquipo(id) {
    var e = equipo(id);
    return e ? e.nombre : '—';
  }

  function partido(id) {
    for (var i = 0; i < data.partidos.length; i++) if (data.partidos[i].id === id) return data.partidos[i];
    return null;
  }

  function jugador(equipoId, jid) {
    var e = equipo(equipoId);
    if (!e) return null;
    for (var i = 0; i < e.jugadores.length; i++) if (e.jugadores[i].id === jid) return e.jugadores[i];
    return null;
  }

  // Busca en todos los equipos: devuelve {jugador, equipo} o null.
  function buscarJugador(jid) {
    for (var i = 0; i < data.equipos.length; i++) {
      var e = data.equipos[i];
      for (var j = 0; j < e.jugadores.length; j++) {
        if (e.jugadores[j].id === jid) return { jugador: e.jugadores[j], equipo: e };
      }
    }
    return null;
  }

  function nombreJugador(jid) {
    var r = buscarJugador(jid);
    return r ? r.jugador.nombre : '—';
  }

  function estadio(estadioId) {
    for (var i = 0; i < data.equipos.length; i++) {
      var es = data.equipos[i].estadios;
      for (var j = 0; j < es.length; j++) if (es[j].id === estadioId) return es[j];
    }
    return null;
  }

  // Divisiones presentes en los equipos registrados: primero las del catálogo
  // en su orden oficial, luego cualquier otra que el usuario haya escrito.
  function divisionesUsadas() {
    var vistas = {}, orden = [];
    data.equipos.forEach(function (e) { vistas[e.division || SIN_DIVISION] = 1; });
    DIVISIONES.forEach(function (d) { if (vistas[d]) { orden.push(d); delete vistas[d]; } });
    Object.keys(vistas).sort().forEach(function (d) { orden.push(d); });
    return orden;
  }

  function todosLosEstadios() {
    var out = [];
    data.equipos.forEach(function (e) {
      e.estadios.forEach(function (s) { out.push({ estadio: s, equipo: e }); });
    });
    return out;
  }

  /* ============ orden y filtros de partidos ============ */

  function clavePartido(p) { return (p.fecha || '9999-12-31') + ' ' + (p.hora || '23:59'); }

  function partidosOrdenados() {
    return data.partidos.slice().sort(function (a, b) {
      var ka = clavePartido(a), kb = clavePartido(b);
      return ka < kb ? -1 : ka > kb ? 1 : 0;
    });
  }

  function partidosDeEquipo(eqId, soloFinalizados) {
    return partidosOrdenados().filter(function (p) {
      if (p.localId !== eqId && p.visitaId !== eqId) return false;
      return soloFinalizados ? p.estado === 'finalizado' : true;
    });
  }

  function etiquetaPartido(p) {
    if (!p) return '—';
    return nombreEquipo(p.localId) + ' vs ' + nombreEquipo(p.visitaId) + ' · ' + U.fechaCorta(p.fecha);
  }

  /* ============ marcador ============ */

  function marcador(p) {
    var m = { local: 0, visita: 0 };
    if (!p) return m;

    // Un partido importado trae el marcador oficial pero sin goleadores.
    // Mientras no se registre ningún gol en la planilla, manda el oficial;
    // apenas se anota el primero, el marcador pasa a calcularse de los eventos.
    var hayGoles = p.eventos.some(function (ev) {
      return ev.tipo === 'gol' || ev.tipo === 'autogol';
    });
    if (!hayGoles && p.marcadorOficial) {
      return { local: p.marcadorOficial.local || 0, visita: p.marcadorOficial.visita || 0 };
    }

    p.eventos.forEach(function (ev) {
      if (ev.tipo === 'gol') {
        if (ev.equipoId === p.localId) m.local++;
        else if (ev.equipoId === p.visitaId) m.visita++;
      } else if (ev.tipo === 'autogol') {
        // el autogol suma al rival del equipo del jugador
        if (ev.equipoId === p.localId) m.visita++;
        else if (ev.equipoId === p.visitaId) m.local++;
      }
    });
    return m;
  }

  function eventosOrdenados(p) {
    return p.eventos.slice().sort(function (a, b) {
      if (a.minuto !== b.minuto) return a.minuto - b.minuto;
      return (a.ts || 0) - (b.ts || 0);
    });
  }

  /* ============ convocatoria ============ */

  function ladoDe(p, eqId) { return p.localId === eqId ? 'local' : 'visita'; }

  function convocados(p, eqId) {
    var c = p.convocatoria[ladoDe(p, eqId)];
    return c.titulares.concat(c.suplentes);
  }

  function esTitular(p, eqId, jid) {
    return p.convocatoria[ladoDe(p, eqId)].titulares.indexOf(jid) >= 0;
  }

  /* ============ estadísticas de jugador ============ */

  function statsJugadores(filtroPartidoId) {
    var mapa = {};

    function fila(jid) {
      if (!mapa[jid]) {
        var r = buscarJugador(jid);
        mapa[jid] = {
          jid: jid,
          nombre: r ? r.jugador.nombre : '(jugador eliminado)',
          numero: r ? r.jugador.numero : '',
          posicion: r ? r.jugador.posicion : '',
          equipoId: r ? r.equipo.id : '',
          equipo: r ? r.equipo.nombre : '—',
          pj: 0, goles: 0, autogoles: 0, asistencias: 0, amarillas: 0, rojas: 0
        };
      }
      return mapa[jid];
    }

    data.partidos.forEach(function (p) {
      if (filtroPartidoId && p.id !== filtroPartidoId) return;
      if (p.estado !== 'finalizado' && p.estado !== 'en_curso') return;

      // partidos jugados = titulares + suplentes que ingresaron
      ['local', 'visita'].forEach(function (lado) {
        p.convocatoria[lado].titulares.forEach(function (jid) { fila(jid).pj++; });
      });
      p.eventos.forEach(function (ev) {
        if (ev.tipo === 'cambio' && ev.entraId) fila(ev.entraId).pj++;
      });

      p.eventos.forEach(function (ev) {
        if (ev.tipo === 'gol' && ev.jugadorId) {
          fila(ev.jugadorId).goles++;
          if (ev.asistenteId) fila(ev.asistenteId).asistencias++;
        } else if (ev.tipo === 'autogol' && ev.jugadorId) {
          fila(ev.jugadorId).autogoles++;
        } else if (ev.tipo === 'amarilla' && ev.jugadorId) {
          fila(ev.jugadorId).amarillas++;
        } else if (ev.tipo === 'roja' && ev.jugadorId) {
          fila(ev.jugadorId).rojas++;
        }
      });
    });

    return Object.keys(mapa).map(function (k) { return mapa[k]; });
  }

  /* ============ tabla de posiciones ============ */

  function tablaPosiciones() {
    var t = {};
    data.equipos.forEach(function (e) {
      t[e.id] = { id: e.id, nombre: e.nombre, pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, dif: 0, pts: 0 };
    });
    data.partidos.forEach(function (p) {
      if (p.estado !== 'finalizado') return;
      var L = t[p.localId], V = t[p.visitaId];
      if (!L || !V) return;
      var m = marcador(p);
      L.pj++; V.pj++;
      L.gf += m.local; L.gc += m.visita;
      V.gf += m.visita; V.gc += m.local;
      if (m.local > m.visita) { L.g++; V.p++; L.pts += 3; }
      else if (m.local < m.visita) { V.g++; L.p++; V.pts += 3; }
      else { L.e++; V.e++; L.pts++; V.pts++; }
    });
    return Object.keys(t).map(function (k) {
      var r = t[k]; r.dif = r.gf - r.gc; return r;
    }).sort(function (a, b) {
      return b.pts - a.pts || b.dif - a.dif || b.gf - a.gf || a.nombre.localeCompare(b.nombre);
    });
  }

  /* ============ suspensiones ============ */

  // Fechas del equipo finalizadas después del partido/fecha que originó la incidencia.
  function fechasCumplidasDesde(eqId, inc) {
    var ref = null;
    if (inc.partidoId) {
      var p = partido(inc.partidoId);
      if (p) ref = clavePartido(p);
    }
    if (!ref && inc.fecha) ref = inc.fecha + ' 00:00';
    if (!ref) return 0;
    return partidosDeEquipo(eqId, true).filter(function (p) {
      return clavePartido(p) > ref;
    }).length;
  }

  // Simula fecha a fecha la acumulación sobre los partidos finalizados de cada equipo.
  // -> [{jid, nombre, numero, equipoId, equipo, pendientes, motivos:[{clase,txt}], amarillasAcum}]
  function suspensiones() {
    var cfg = data.config;
    var out = [];

    data.equipos.forEach(function (eq) {
      var fechas = partidosDeEquipo(eq.id, true);

      eq.jugadores.forEach(function (j) {
        var pendientes = 0, amarillas = 0, motivos = [];

        fechas.forEach(function (p) {
          // 1) si arrastraba castigo, esta fecha lo cumple
          if (pendientes > 0) pendientes--;

          // 2) tarjetas recibidas en este partido
          var am = 0, rojaDirecta = 0, rojaDoble = 0;
          p.eventos.forEach(function (ev) {
            if (ev.jugadorId !== j.id) return;
            if (ev.tipo === 'amarilla') am++;
            else if (ev.tipo === 'roja') {
              if (ev.subtipo === 'doble_amarilla') rojaDoble++; else rojaDirecta++;
            }
          });

          // las 2 amarillas que derivan en roja no suman a la acumulación
          if (rojaDoble && cfg.dobleAmarillaNoAcumula) am = Math.max(0, am - 2);

          for (var k = 0; k < am; k++) {
            amarillas++;
            if (amarillas % cfg.amarillasPorFecha === 0) {
              pendientes += 1;
              motivos.push({
                clase: 'warn',
                txt: 'Acumulación de ' + cfg.amarillasPorFecha + ' amarillas (' + U.fechaCorta(p.fecha) + ')'
              });
            }
          }
          var rojas = rojaDirecta + rojaDoble;
          if (rojas) {
            pendientes += rojas * cfg.fechasPorRoja;
            motivos.push({
              clase: 'dang',
              txt: 'Tarjeta roja' + (rojaDoble ? ' (doble amarilla)' : ' directa') + ' — ' + U.fechaCorta(p.fecha)
            });
          }
        });

        // 3) sanciones por incidencia resuelta
        data.incidencias.forEach(function (inc) {
          if (inc.personaId !== j.id) return;
          if (!inc.sancion || inc.sancion.tipo !== 'suspension') return;
          if (inc.estado !== 'resuelta') return;
          var totales = Number(inc.sancion.partidos) || 0;
          if (!totales) return;
          var cumplidos = fechasCumplidasDesde(eq.id, inc);
          var resta = Math.max(0, totales - cumplidos);
          if (resta > 0) {
            pendientes += resta;
            motivos.push({
              clase: 'dang',
              txt: 'Incidencia: ' + (inc.tipo || 'sanción') + ' (' + resta + ' de ' + totales + ' fechas por cumplir)'
            });
          }
        });

        if (pendientes > 0) {
          out.push({
            jid: j.id, nombre: j.nombre, numero: j.numero,
            equipoId: eq.id, equipo: eq.nombre,
            pendientes: pendientes, motivos: motivos, amarillasAcum: amarillas
          });
        }
      });
    });

    return out.sort(function (a, b) {
      return a.equipo.localeCompare(b.equipo) || b.pendientes - a.pendientes;
    });
  }

  // Mapa jid -> registro de suspensión, para consultas rápidas en la convocatoria.
  function idsSuspendidos() {
    var s = {};
    suspensiones().forEach(function (x) { s[x.jid] = x; });
    return s;
  }

  /* ============ backup ============ */

  function exportarJSON() { return JSON.stringify(data, null, 2); }

  function importarJSON(txt) {
    var obj = JSON.parse(txt);
    if (!obj || !Array.isArray(obj.equipos)) throw new Error('Formato inválido');
    localStorage.setItem(KEY, JSON.stringify(obj));
    load();
  }

  function borrarTodo() {
    localStorage.removeItem(KEY);
    load();
  }

  /* ============ API ============ */

  return {
    KEY: KEY,
    ROLES_CT: ROLES_CT, ROLES_LIBRES_DESDE: ROLES_LIBRES_DESDE,
    POSICIONES: POSICIONES, ROLES_ARBITRO: ROLES_ARBITRO,
    TIPOS_EVENTO: TIPOS_EVENTO, TIPOS_INCIDENCIA: TIPOS_INCIDENCIA,
    MAX_JUGADORES: MAX_JUGADORES, MAX_ESTADIOS: MAX_ESTADIOS,
    DIVISIONES: DIVISIONES, SIN_DIVISION: SIN_DIVISION, divisionesUsadas: divisionesUsadas,
    divisionActiva: divisionActiva, setDivisionActiva: setDivisionActiva,
    divisionDeEquipo: divisionDeEquipo, divisionDePartido: divisionDePartido,
    equiposVisibles: equiposVisibles, partidosVisibles: partidosVisibles,

    get d() { return data; },
    load: load, save: save, cargarConSemilla: cargarConSemilla,
    cuerpoTecnicoVacio: cuerpoTecnicoVacio, convocatoriaVacia: convocatoriaVacia, timerVacio: timerVacio,

    equipo: equipo, nombreEquipo: nombreEquipo, partido: partido,
    jugador: jugador, buscarJugador: buscarJugador, nombreJugador: nombreJugador,
    estadio: estadio, todosLosEstadios: todosLosEstadios,

    clavePartido: clavePartido, partidosOrdenados: partidosOrdenados,
    partidosDeEquipo: partidosDeEquipo, etiquetaPartido: etiquetaPartido,

    marcador: marcador, eventosOrdenados: eventosOrdenados,
    ladoDe: ladoDe, convocados: convocados, esTitular: esTitular,

    statsJugadores: statsJugadores, tablaPosiciones: tablaPosiciones,
    suspensiones: suspensiones, idsSuspendidos: idsSuspendidos,

    exportarJSON: exportarJSON, importarJSON: importarJSON, borrarTodo: borrarTodo
  };
})();
