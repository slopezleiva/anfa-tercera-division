/*
 * generar-respaldo.js — convierte datos/clubes-tercera-division-2026.json
 * al formato de respaldo que la app importa desde ⚙ → Importar.
 *
 *   node datos/generar-respaldo.js
 *
 * Salida: datos/respaldo-tercera-division-2026.json
 */
const fs = require('fs');
const path = require('path');

const DIR = __dirname;
const ORIGEN = path.join(DIR, 'clubes-tercera-division-2026.json');
const FIXTURE = path.join(DIR, 'fixture-tercera-division-2026.csv');
const DESTINO = path.join(DIR, 'respaldo-tercera-division-2026.json');

// Fecha de captura: los partidos sin resultado anteriores a este día
// se consideran suspendidos; los posteriores, programados.
const HOY = '2026-08-24';
const MAX_ESTADIOS = 2;

const ROLES_CT = [
  'Director Técnico', 'Preparador Físico',
  'Asistente de Campo 1', 'Asistente de Campo 2', 'Asistente de Campo 3',
  'Entrenador Ayudante', 'Preparador de Arqueros', 'Enfermero',
  'Kinesiólogo', 'Videoanalista',
  'Puesto Libre 1', 'Puesto Libre 2', 'Puesto Libre 3', 'Puesto Libre 4'
];
const ROLES_LIBRES_DESDE = 10;
const MAX_JUGADORES = 35;

let n = 0;
const uid = (p) => `${p}_${(Date.now() + (n++)).toString(36)}${Math.random().toString(36).slice(2, 7)}`;

const limpiaNombre = (s) => s
  .replace(/\{\{[^}]*\}?\}?/g, ' ')   // restos de plantillas wiki
  .replace(/\([^)]*\)/g, ' ')          // desambiguadores: "(futbolista)"
  .replace(/\s+/g, ' ')
  .trim();

const clave = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

function construyeJugadores(bruto) {
  const numerosUsados = new Set();
  const nombresVistos = new Set();
  const salida = [];

  for (const linea of bruto) {
    const [numRaw, nomRaw, posRaw] = linea.split('~');
    const nombre = limpiaNombre(nomRaw || '');
    if (!nombre) continue;

    // un mismo jugador puede venir repetido entre secciones de la fuente
    const k = clave(nombre);
    if (nombresVistos.has(k)) continue;
    nombresVistos.add(k);

    // la app exige dorsales únicos: si viene repetido, se deja en blanco
    let numero = (numRaw || '').trim();
    if (numero && numerosUsados.has(numero)) numero = '';
    if (numero) numerosUsados.add(numero);

    salida.push({
      id: uid('jug'),
      numero,
      nombre,
      posicion: (posRaw || '').trim(),
      rut: '',
      fechaNac: '',
      activo: true
    });
    if (salida.length >= MAX_JUGADORES) break;
  }
  return salida;
}

function cuerpoTecnicoVacio() {
  return ROLES_CT.map((rol, i) => ({
    id: uid('ct'), rol, libre: i >= ROLES_LIBRES_DESDE,
    nombre: '', rut: '', telefono: ''
  }));
}

const origen = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'));

// nombre de club -> nombre de archivo del escudo (igual que en bajar-escudos.js)
const slug = (nombre) => nombre.toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '');

// El escudo se guarda como ruta relativa, no incrustado: los 42 PNG pesan
// ~1 MB y en base64 inflarían el respaldo sin necesidad.
const DIR_ESCUDOS = path.join(__dirname, '..', 'img', 'escudos');
const sinEscudo = [];
function rutaEscudo(nombreClub) {
  const archivo = slug(nombreClub) + '.png';
  if (fs.existsSync(path.join(DIR_ESCUDOS, archivo))) return 'img/escudos/' + archivo;
  sinEscudo.push(nombreClub);
  return '';
}

const equipos = origen.clubes.map((c) => ({
  id: uid('eq'),
  nombre: c.nombre,
  division: c.division,
  region: c.region || '',
  colores: '',
  escudo: rutaEscudo(c.nombre),
  fuentePlantel: c.fuente || '',
  cuerpoTecnico: cuerpoTecnicoVacio(),
  jugadores: construyeJugadores(c.jugadores || []),
  estadios: []
}));

/* ============ fixture ============ */

const porNombre = new Map(equipos.map((e) => [e.nombre, e]));

const filas = fs.readFileSync(FIXTURE, 'utf8')
  .split(/\r?\n/)
  .filter((l) => l.trim() && !l.startsWith('«'))
  .map((l) => {
    const [division, jornada, fecha, hora, local, visita, gl, gv, estadio] = l.split('|');
    return { division, jornada, fecha, hora, local, visita, gl, gv, estadio: (estadio || '').trim() };
  });

// --- estadios: se deducen de los partidos de local de cada club ---
const sedes = new Map(); // nombreEquipo -> Map(nombreEstadio -> veces)
for (const f of filas) {
  if (!f.estadio) continue;
  if (!sedes.has(f.local)) sedes.set(f.local, new Map());
  const m = sedes.get(f.local);
  m.set(f.estadio, (m.get(f.estadio) || 0) + 1);
}
for (const [nombreEq, usos] of sedes) {
  const eq = porNombre.get(nombreEq);
  if (!eq) continue;
  [...usos.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_ESTADIOS)
    .forEach(([nombre, veces]) => {
      eq.estadios.push({
        id: uid('est'),
        nombre,
        direccion: '',
        capacidad: '',
        camarines: '',
        superficie: '',
        iluminacion: false,
        caracteristicas: `Sede de ${veces} partido(s) de local en el fixture oficial 2026.`,
        fotos: []
      });
    });
}

// --- partidos ---
const partidos = [];
const sinEquipo = [];

for (const f of filas) {
  const local = porNombre.get(f.local);
  const visita = porNombre.get(f.visita);
  if (!local || !visita) { sinEquipo.push(`${f.local} vs ${f.visita}`); continue; }

  const jugado = f.gl !== '' && f.gv !== '';
  let estado;
  if (jugado) estado = 'finalizado';
  else if (f.fecha && f.fecha < HOY) estado = 'suspendido';
  else estado = 'programado';

  const sede = (local.estadios.find((s) => s.nombre === f.estadio) || local.estadios[0] || {}).id || '';

  const p = {
    id: uid('pt'),
    localId: local.id,
    visitaId: visita.id,
    fecha: f.fecha || '',
    hora: f.hora || '',
    estadioId: sede,
    jornada: f.jornada || '',
    estado,
    arbitros: { central: '', linea1: '', linea2: '', cuarto: '', observaciones: '' },
    convocatoria: {
      local: { titulares: [], suplentes: [] },
      visita: { titulares: [], suplentes: [] }
    },
    eventos: [],
    timer: { corriendo: false, periodo: 1, acumuladoMs: 0, inicioTs: null }
  };
  // el marcador viene del acta oficial; los goleadores no se publican
  if (jugado) p.marcadorOficial = { local: Number(f.gl), visita: Number(f.gv) };
  partidos.push(p);
}

const respaldo = {
  v: 1,
  config: {
    amarillasPorFecha: 3,
    fechasPorRoja: 1,
    duracionPeriodo: 45,
    dobleAmarillaNoAcumula: true
  },
  torneo: { nombre: 'Tercera División ANFA 2026', division: 'Tercera A y Tercera B' },
  equipos,
  partidos,
  incidencias: []
};

fs.writeFileSync(DESTINO, JSON.stringify(respaldo, null, 2), 'utf8');

// ---- resumen por consola ----
const porDivision = {};
for (const e of equipos) {
  const d = (porDivision[e.division] = porDivision[e.division] || { equipos: 0, jugadores: 0, sinPlantel: [] });
  d.equipos++;
  d.jugadores += e.jugadores.length;
  if (!e.jugadores.length) d.sinPlantel.push(e.nombre);
}

const porId = new Map(equipos.map((e) => [e.id, e]));
const fx = {};
for (const p of partidos) {
  const div = porId.get(p.localId).division;
  const d = (fx[div] = fx[div] || { total: 0, finalizado: 0, programado: 0, suspendido: 0, sinFecha: 0 });
  d.total++; d[p.estado]++;
  if (!p.fecha) d.sinFecha++;
}

console.log(`Respaldo escrito en ${path.relative(process.cwd(), DESTINO)}\n`);
for (const [div, d] of Object.entries(porDivision)) {
  console.log(`${div}: ${d.equipos} equipos, ${d.jugadores} jugadores`);
  if (d.sinPlantel.length) console.log(`  sin plantel (${d.sinPlantel.length}): ${d.sinPlantel.join(', ')}`);
}
console.log(`\nFIXTURE`);
for (const [div, d] of Object.entries(fx)) {
  console.log(`${div}: ${d.total} partidos — ${d.finalizado} finalizados, ${d.programado} programados, ` +
    `${d.suspendido} suspendidos (${d.sinFecha} sin fecha asignada)`);
}
if (sinEquipo.length) console.log(`\nPartidos descartados por club no encontrado: ${sinEquipo.join(' / ')}`);

const totEst = equipos.reduce((a, e) => a + e.estadios.length, 0);
const conEscudo = equipos.filter((e) => e.escudo).length;
console.log(`\nESCUDOS: ${conEscudo}/${equipos.length} enlazados desde img/escudos/`);
if (sinEscudo.length) console.log(`  faltan: ${sinEscudo.join(', ')}`);

console.log(`\nTOTAL: ${equipos.length} equipos, ${equipos.reduce((a, e) => a + e.jugadores.length, 0)} jugadores, ` +
  `${totEst} estadios, ${partidos.length} partidos`);
