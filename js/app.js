/* app.js — arranque, router por hash y configuración del torneo */
window.App = (function () {

  var RUTAS = ['equipos', 'calendario', 'convocatoria', 'partido', 'incidencias', 'datos'];
  var viewEl, tabbar, barraTorneo;

  /* ---------------- filtro de torneo ---------------- */
  // Se dibuja solo si hay más de una división registrada; filtra todas las páginas.
  function pintaBarraTorneo() {
    var divs = S.divisionesUsadas();
    if (divs.length < 2) {
      barraTorneo.hidden = true;
      barraTorneo.innerHTML = '';
      return;
    }
    var activa = S.divisionActiva();
    var h = '<button data-div="" class="' + (activa === '' ? 'on' : '') + '">Todos los torneos</button>';
    divs.forEach(function (d) {
      h += '<button data-div="' + U.esc(d) + '" class="' + (activa === d ? 'on' : '') + '">' + U.esc(d) + '</button>';
    });
    barraTorneo.innerHTML = h;
    barraTorneo.hidden = false;
  }

  function parseHash() {
    var h = (location.hash || '').replace(/^#\/?/, '');
    var partes = h.split('/').filter(Boolean);
    var ruta = partes[0] || 'equipos';
    if (RUTAS.indexOf(ruta) < 0) ruta = 'equipos';
    return { ruta: ruta, args: partes.slice(1) };
  }

  function render() {
    var r = parseHash();

    // contenedor nuevo en cada render: los listeners mueren con él
    viewEl.innerHTML = '';
    var cont = document.createElement('div');
    viewEl.appendChild(cont);

    try {
      V[r.ruta].render(cont, r.args);
    } catch (err) {
      cont.innerHTML = '<div class="card"><div class="empty">Ocurrió un error al dibujar esta página.<br>' +
        '<span class="tiny dim">' + U.esc(err.message) + '</span></div></div>';
      if (window.console) console.error(err);
    }

    Array.prototype.forEach.call(tabbar.querySelectorAll('a'), function (a) {
      a.classList.toggle('active', a.getAttribute('data-tab') === r.ruta);
    });

    pintaBarraTorneo();
    document.getElementById('torneoNombre').textContent = S.d.torneo.nombre || 'Torneo ANFA';
    document.getElementById('torneoDivision').textContent =
      S.divisionActiva() || S.d.torneo.division || '';
    window.scrollTo(0, 0);
  }

  function ir(hash) {
    if (location.hash === hash) render();
    else location.hash = hash;
  }

  /* ---------------- configuración ---------------- */
  function modalConfig() {
    var c = S.d.config;
    U.modal({
      titulo: 'Configuración',
      cuerpo:
        '<label class="f"><span>NOMBRE DEL TORNEO</span><input type="text" name="nombre" value="' + U.esc(S.d.torneo.nombre) + '"></label>' +
        '<label class="f"><span>DIVISIÓN / SERIE</span><input type="text" name="division" value="' + U.esc(S.d.torneo.division) + '"></label>' +
        '<div class="hr"></div>' +
        '<div class="tiny dim" style="margin-bottom:8px;font-weight:700">REGLAMENTO DISCIPLINARIO</div>' +
        '<div class="grid-2">' +
        '<label class="f"><span>AMARILLAS = 1 FECHA</span><input type="number" name="am" min="1" value="' + U.esc(c.amarillasPorFecha) + '"></label>' +
        '<label class="f"><span>FECHAS POR ROJA</span><input type="number" name="rj" min="0" value="' + U.esc(c.fechasPorRoja) + '"></label>' +
        '</div>' +
        '<label class="f"><span>DURACIÓN DE CADA TIEMPO (MIN)</span><input type="number" name="dur" min="1" value="' + U.esc(c.duracionPeriodo) + '"></label>' +
        '<label class="f row" style="gap:8px;align-items:center">' +
        '<input type="checkbox" name="dbl" style="width:auto" ' + (c.dobleAmarillaNoAcumula ? 'checked' : '') + '>' +
        '<span style="margin:0">Las 2 amarillas de una expulsión no acumulan</span></label>' +
        '<div class="hr"></div>' +
        '<div class="row wrap">' +
        '<button class="btn sm grow" data-exportar>⬇ Exportar respaldo</button>' +
        '<button class="btn sm grow" data-importar>⬆ Importar</button>' +
        '</div>' +
        '<div class="row wrap" style="margin-top:7px">' +
        '<button class="btn sm grow ghost" data-demo>Cargar datos de ejemplo</button>' +
        '<button class="btn sm grow danger" data-borrar>Borrar todo</button>' +
        '</div>',
      onAbrir: function (bg) {
        bg.querySelector('[data-exportar]').addEventListener('click', function () {
          bg.remove(); modalExportar();
        });
        bg.querySelector('[data-importar]').addEventListener('click', function () {
          bg.remove(); modalImportar();
        });
        bg.querySelector('[data-demo]').addEventListener('click', function () {
          bg.remove();
          U.confirmar('Se agregarán equipos y jugadores de ejemplo para probar la app. ¿Continuar?', function () {
            cargarDemo(); S.save(); U.toast('Datos de ejemplo cargados', 'ok'); render();
          });
        });
        bg.querySelector('[data-borrar]').addEventListener('click', function () {
          bg.remove();
          U.confirmar('Se borrarán TODOS los datos del torneo en este dispositivo. No se puede deshacer.', function () {
            S.borrarTodo(); U.toast('Datos borrados', 'ok'); ir('#/equipos'); render();
          });
        });
      },
      onOk: function (bg) {
        S.d.torneo.nombre = U.val(bg, 'nombre') || 'Torneo ANFA';
        S.d.torneo.division = U.val(bg, 'division');
        S.d.config.amarillasPorFecha = Math.max(1, Number(U.val(bg, 'am')) || 3);
        S.d.config.fechasPorRoja = Math.max(0, Number(U.val(bg, 'rj')) || 0);
        S.d.config.duracionPeriodo = Math.max(1, Number(U.val(bg, 'dur')) || 45);
        S.d.config.dobleAmarillaNoAcumula = bg.querySelector('[name="dbl"]').checked;
        S.save();
        U.toast('Configuración guardada', 'ok');
        render();
      }
    });
  }

  function modalExportar() {
    U.modal({
      titulo: 'Respaldo del torneo',
      cuerpo: '<p class="tiny muted" style="margin:0 0 9px">Copia este texto y guárdalo. Sirve para restaurar el torneo ' +
        'en este u otro dispositivo desde "Importar".</p>' +
        '<textarea name="json" style="min-height:180px;font-size:11px" readonly>' + U.esc(S.exportarJSON()) + '</textarea>',
      okTexto: 'Copiar',
      cancelTexto: 'Cerrar',
      onOk: function (bg) {
        var ta = bg.querySelector('[name="json"]');
        ta.select();
        try {
          document.execCommand('copy');
          U.toast('Respaldo copiado', 'ok');
        } catch (e) {
          U.toast('Copia manualmente el texto', 'err');
          return false;
        }
      }
    });
  }

  function modalImportar() {
    U.modal({
      titulo: 'Importar respaldo',
      cuerpo: '<p class="tiny muted" style="margin:0 0 9px">Pega aquí el respaldo. Reemplazará todos los datos actuales.</p>' +
        '<textarea name="json" style="min-height:180px;font-size:11px" placeholder="{ … }"></textarea>',
      okTexto: 'Importar',
      onOk: function (bg) {
        var txt = U.val(bg, 'json');
        if (!txt) { U.toast('Pega el respaldo', 'err'); return false; }
        try {
          S.importarJSON(txt);
          U.toast('Respaldo importado', 'ok');
          ir('#/equipos'); render();
        } catch (e) {
          U.toast('Respaldo inválido', 'err');
          return false;
        }
      }
    });
  }

  /* ---------------- datos de ejemplo ---------------- */
  function cargarDemo() {
    var clubes = ['Deportivo Aurora', 'Unión Cordillera', 'Atlético Costa', 'Club Estrella Sur'];
    var apellidos = ['Rojas', 'Muñoz', 'Contreras', 'Silva', 'Fuentes', 'Vergara', 'Cáceres',
      'Bravo', 'Herrera', 'Paredes', 'Navarro', 'Sandoval', 'Reyes', 'Aguilar', 'Poblete',
      'Sepúlveda', 'Cortés', 'Riquelme'];
    var pilas = ['Juan', 'Luis', 'Diego', 'Matías', 'Cristian', 'Felipe', 'Andrés', 'Nicolás',
      'Camilo', 'Rodrigo', 'Sebastián', 'Ignacio', 'Álvaro', 'Marcos', 'Tomás', 'Pablo', 'Óscar', 'Vicente'];

    clubes.forEach(function (nom, idx) {
      if (S.d.equipos.some(function (e) { return e.nombre === nom; })) return;

      var eq = {
        id: U.uid('eq'), nombre: nom, colores: '', escudo: '',
        cuerpoTecnico: S.cuerpoTecnicoVacio(), jugadores: [], estadios: []
      };
      eq.cuerpoTecnico[0].nombre = pilas[idx] + ' ' + apellidos[idx];
      eq.cuerpoTecnico[1].nombre = pilas[idx + 4] + ' ' + apellidos[idx + 4];

      for (var i = 0; i < 18; i++) {
        eq.jugadores.push({
          id: U.uid('jug'),
          numero: String(i + 1),
          nombre: pilas[(i + idx * 3) % pilas.length] + ' ' + apellidos[(i + idx * 5) % apellidos.length],
          posicion: i === 0 ? 'Arquero' : i < 7 ? 'Defensa' : i < 13 ? 'Mediocampista' : 'Delantero',
          rut: '', fechaNac: '', activo: true
        });
      }
      eq.estadios.push({
        id: U.uid('est'), nombre: 'Estadio ' + nom.split(' ').pop(),
        direccion: 'Av. Principal ' + (100 + idx * 25),
        capacidad: String(1200 + idx * 400), camarines: '2',
        superficie: idx % 2 ? 'Pasto sintético' : 'Pasto natural',
        iluminacion: idx % 2 === 0,
        caracteristicas: 'Graderías techadas, estacionamiento y cierre perimetral.',
        fotos: []
      });
      S.d.equipos.push(eq);
    });
  }

  /* ---------------- arranque ---------------- */
  function init() {
    S.load();
    viewEl = document.getElementById('view');
    tabbar = document.querySelector('.tabbar');
    barraTorneo = document.getElementById('barraTorneo');

    document.getElementById('btnConfig').addEventListener('click', modalConfig);
    window.addEventListener('hashchange', render);

    U.on(barraTorneo, '[data-div]', 'click', function (ev, b) {
      S.setDivisionActiva(b.getAttribute('data-div'));
      // al cambiar de torneo, cualquier detalle abierto deja de ser válido
      var r = parseHash();
      if (r.args.length) location.hash = '#/' + r.ruta;
      else render();
    });

    if (!location.hash) location.hash = '#/equipos';
    render();
  }

  document.addEventListener('DOMContentLoaded', init);

  return { render: render, ir: ir, modalConfig: modalConfig };
})();
