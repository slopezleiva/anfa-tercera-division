# ANFA · Gestión de Torneo

Prototipo web **mobile-first** para administrar un torneo de fútbol amateur: registro de equipos,
calendario, convocatorias, planilla en vivo del partido, incidencias disciplinarias y estadísticas.

No requiere instalación ni backend: es HTML + CSS + JavaScript plano, y todos los datos quedan
guardados en el `localStorage` del navegador del dispositivo.

---

## Cómo abrirlo

**Opción A — abrir el archivo directamente**

Abre `index.html` en el navegador (funciona también en el celular si copias la carpeta al teléfono).

**Opción B — servirlo por HTTP (recomendado)**

```bash
python -m http.server 8123
```

Luego entra a `http://localhost:8123`. Para probarlo desde el celular en la misma red WiFi,
usa la IP del computador, por ejemplo `http://192.168.1.20:8123`.

> Servirlo por HTTP es más confiable: algunos navegadores restringen `localStorage` cuando la
> página se abre con `file://`, y ahí se perderían los datos entre sesiones.

---

## Estructura

```
index.html               Punto de entrada: cabecera, contenedor de vistas y barra inferior
css/styles.css           Estilos (tema oscuro, mobile-first, safe-area para iOS)
js/utils.js              Helpers: fechas, reloj, modales, toasts, imágenes  -> global U
js/store.js              Estado, persistencia y cálculos derivados          -> global S
js/app.js                Arranque, router por hash y configuración          -> global App
js/views/equipos.js      Registro de equipos (cuerpo técnico, plantel, estadios)
js/views/calendario.js   Programación de partidos y generador de fixture
js/views/convocatoria.js Citación de ambos equipos y terna arbitral
js/views/partido.js      Cronómetro y planilla editable de eventos
js/views/incidencias.js  Registro y resolución de incidencias
js/views/datos.js        Estadísticas, tabla de posiciones y suspensiones
.claude/launch.json      Configuración del servidor estático local
img/logo-anfa.png        Logo oficial que va en la cabecera
img/escudos/             Escudo de cada club, un PNG por equipo
datos/                   Datos precargados del torneo y scripts para regenerarlos
```

Los scripts son clásicos (no módulos ES) a propósito, para que la app funcione al abrirse
directamente desde el sistema de archivos.

---

## Las seis páginas

### 1. Equipos (`#/equipos`)
- **Cuerpo técnico**: 14 cargos por club — Director Técnico, Preparador Físico,
  3 Asistentes de Campo, Entrenador Ayudante, Preparador de Arqueros, Enfermero,
  Kinesiólogo, Videoanalista y **4 puestos libres cuyo nombre se puede editar**
  (utilero, dirigente, médico, etc.).
- **Plantel**: hasta **35 jugadores** con número, nombre, posición, RUT y fecha de nacimiento.
  El número de camiseta no se puede repetir. Un jugador puede marcarse como inactivo para
  excluirlo de las convocatorias.
- **Estadios**: hasta **2 por club**, con dirección, capacidad, camarines, superficie,
  iluminación, características libres y **fotos** (se redimensionan automáticamente antes
  de guardarse).

Cada club tiene además **división** y **región**. Cuando hay más de una división registrada, el
listado se agrupa por división.

### Filtro de torneo

Si hay más de una división registrada, bajo la cabecera aparece una barra con un botón por torneo
más **"Todos los torneos"**. Lo que elijas ahí **filtra la aplicación completa**:

| Página | Qué acota |
|---|---|
| Equipos | Solo los clubes del torneo; al crear uno nuevo, la división viene puesta |
| Calendario | Partidos, jornadas, selector de equipos y el generador de fixture |
| Convocatoria y Partido | La lista de partidos donde eliges cuál dirigir |
| Incidencias | Las de clubes del torneo, y los desplegables de equipo y partido |
| Datos | Totales, goleadores, tabla individual, suspendidos y tabla de posiciones |

La elección se guarda en `localStorage` bajo `anfa_division_activa` —aparte del respaldo, para que
importar datos no la pise— y sobrevive al cerrar la app. Si cambias de torneo mientras tienes
abierta una ficha de club o partido, vuelves al listado, porque esa ficha ya no pertenece al torneo
seleccionado.

### Datos precargados de la Tercera División ANFA 2026

En `datos/` viene el listado de los **42 clubes** de la temporada 2026, tomado del sitio oficial
`anfaterceradivision.cl`, separados en sus tres divisiones (14 clubes cada una):

```bash
node datos/generar-respaldo.js
```

Eso genera `datos/respaldo-tercera-division-2026.json`; ábrelo, copia su contenido y pégalo en
**⚙ → Importar**.

Los planteles solo pudieron obtenerse para **17 de los 42 clubes** (351 jugadores), porque el resto
no tiene nómina publicada en ninguna fuente accesible. La procedencia queda registrada por club en
el campo `fuentePlantel` y se muestra en su ficha. **No son la nómina oficial de la ANFA**:
verifícalos antes de usarlos en una planilla con validez reglamentaria.

El mismo respaldo trae el **fixture completo de la temporada**: 546 partidos (182 por división,
todos contra todos ida y vuelta), con 392 finalizados, 148 programados y 6 suspendidos, más los
**55 estadios** deducidos de las sedes donde cada club hizo de local. La fuente es
`datos/fixture-tercera-division-2026.csv`, tomado del calendario oficial; las fechas 21, 22 y 23 de
Tercera A llevan día y hora confirmados desde Sofascore, que el sitio oficial aún no publica.

De las 148 fechas por jugar, **127 todavía no tienen día asignado** por la ANFA: se importan con la
fecha en blanco y aparecen al final del listado hasta que se programen.

#### Escudos

Los **42 escudos oficiales** están en `img/escudos/`, uno por club. Para volver a bajarlos:

```bash
node datos/bajar-escudos.js
```

Ese script lee las URL de `datos/escudos-urls.json` y guarda los originales, que pesan unos
800 KB cada uno. Los que vienen en el repositorio ya están reducidos a 128×128 px (24 KB de
promedio, 1 MB en total), así que **si los vuelves a descargar conviene reducirlos** antes de usarlos.

En el respaldo, `equipo.escudo` guarda una **ruta relativa** (`img/escudos/naval.png`), no la imagen
incrustada: en base64 los 42 escudos sumarían 1,35 MB al archivo y al `localStorage` sin ganar nada.
Si abres la app sin la carpeta `img/`, cada escudo cae automáticamente al recuadro con las iniciales
del club.

#### Marcador de los partidos ya jugados

Las actas oficiales publican el resultado pero **no los goleadores**. Para no inventar datos, cada
partido finalizado guarda su resultado en `marcadorOficial` y llega con la lista de eventos vacía:

- Mientras no registres ningún gol en la planilla, la app muestra el marcador oficial.
- Apenas anotas el primer gol, el marcador pasa a calcularse de los eventos que tú registres.
- Si borras ese gol, vuelve a mostrarse el oficial.

La tabla de posiciones usa ese mismo marcador, y se calcula **una por división**. Verificada contra
la tabla publicada por la ANFA: coincide posición por posición.

### 2. Calendario (`#/calendario`)
Programa cada partido eligiendo **local, visita, día, hora y estadio** (el selector ofrece los
estadios de todos los clubes registrados). Permite número de jornada y estado
(programado / en curso / finalizado / suspendido), con filtros por equipo, estado y jornada.

Cuando el torneo tiene más de 4 jornadas, el calendario abre mostrando solo la **fecha vigente**
—la primera con partidos por jugar— y desde el selector puedes ver otra o todas. Con un fixture
completo de 546 partidos, dibujarlos todos de una vez tarda más de un segundo en un celular.

El botón **⚡** genera automáticamente todos los cruces entre los equipos inscritos, una jornada
por semana, con opción de partidos de vuelta. No duplica partidos ya existentes.

### 3. Convocatoria (`#/convocatoria`)
Para el partido elegido se arma la citación de **ambos equipos**: al tocar un jugador este
alterna entre *titular* → *suplente* → *sin citar*. Muestra el contador del XI (tope 11) y de la
banca, y **advierte si el jugador está suspendido**.

La pestaña **Árbitros** registra la terna: Árbitro Central, Juez de Línea 1, Juez de Línea 2 y
Cuarto Árbitro, más observaciones.

### 4. Partido (`#/partido`)
- **Cronómetro** con iniciar/pausar, avance de periodo (arranca en el minuto real del tiempo
  siguiente) y ajuste manual del reloj.
- **Registro de eventos**: gol (con asistencia, tipo de gol y opción de autogol), tarjeta
  amarilla, tarjeta roja (directa o por doble amarilla), cambio y observación.
- Todo evento se puede **editar o eliminar** desde la lista, para corregir errores. El marcador
  se recalcula solo.
- Los selectores de jugador respetan quién está en cancha y quién queda en la banca.

### 5. Incidencias (`#/incidencias`)
Registro de hechos (expulsión, agresión, conducta antideportiva, reclamos, etc.) asociados a un
partido, un equipo y una persona —jugador **o** miembro del cuerpo técnico—, con su
**resolución y conclusiones** y la sanción aplicada: amonestación, suspensión de N fechas o multa.

### 6. Datos (`#/datos`)
Con selector de ámbito: **global del torneo** o **un partido específico**.
- **Resumen**: totales, tabla de posiciones, goleadores y asistencias.
- **Jugadores**: tabla con PJ, goles, asistencias, amarillas y rojas.
- **Suspendidos**: quién no puede jugar y por qué, más el listado de quienes están *a una
  amarilla* de la sanción y las sanciones dictadas por el tribunal.
- **Partidos**: ficha completa de cada encuentro con marcador, terna arbitral, cronología de
  eventos y formaciones.

---

## Cómo se calculan las suspensiones

El cálculo recorre, equipo por equipo, sus partidos **finalizados** en orden cronológico:

1. Si el jugador arrastraba fechas pendientes, ese partido las descuenta.
2. Se suman las amarillas del partido; al llegar al múltiplo configurado (3 por defecto)
   se agrega una fecha de castigo.
3. Cada roja agrega las fechas configuradas (1 por defecto).
4. Se suman las fechas pendientes de las incidencias **resueltas** con sanción de suspensión,
   descontando los partidos del equipo ya jugados desde esa fecha.

Por regla estándar, las dos amarillas que derivan en una expulsión **no** suman a la
acumulación; esto es configurable.

Todos los parámetros —amarillas por fecha, fechas por roja, duración del tiempo y el trato de la
doble amarilla— se ajustan en **⚙ Configuración**.

---

## Configuración y respaldo (botón ⚙)

- Nombre del torneo y división.
- Reglamento disciplinario.
- **Exportar respaldo**: entrega todo el torneo en JSON para copiar y guardar.
- **Importar**: restaura un respaldo en este u otro dispositivo.
- **Cargar datos de ejemplo**: 4 clubes con plantel y estadio para probar la app.
- **Borrar todo**.

---

## Limitaciones conocidas del prototipo

- Los datos viven **solo en el navegador donde se cargan**. No hay servidor ni sincronización
  entre dispositivos: para traspasar información se usa exportar/importar.
- Borrar los datos de navegación del navegador elimina el torneo. Conviene exportar un respaldo
  al terminar cada fecha.
- El `localStorage` ronda los 5 MB por sitio; las fotos de estadios se comprimen, pero si se
  cargan muchas puede llenarse (la app avisa cuando no logra guardar).
- No hay control de usuarios ni permisos: cualquiera con el dispositivo puede editar.
- El cronómetro corre mientras la pestaña está abierta; al cerrarla se conserva el tiempo
  acumulado hasta la última pausa o guardado.
