/* views/equipos.js — registro interno de equipos: cuerpo técnico, plantel y estadios */
window.V = window.V || {};
window.V.equipos = (function () {

  var subtab = 'jugadores'; // pestaña activa dentro del detalle de equipo

  /* =========================================================
     LISTADO DE EQUIPOS
     ========================================================= */
  function render(root, args) {
    if (args && args[0]) return detalle(root, args[0]);

    var visibles = S.equiposVisibles();
    var divisiones = S.divisionesUsadas();
    var activa = S.divisionActiva();

    var h = '' +
      '<div class="page-head">' +
      '<h1>Equipos</h1>' +
      '<p>Registro interno · ' + visibles.length + ' equipo(s)' +
      (activa ? ' en ' + U.esc(activa) : divisiones.length > 1 ? ' en ' + divisiones.length + ' divisiones' : '') +
      '</p></div>' +
      '<button class="btn primary block" data-nuevo>+ Registrar equipo</button>' +
      '<div class="hr"></div>';

    if (!visibles.length) {
      h += '<div class="card"><div class="empty">' +
        (S.d.equipos.length ? 'Ningún equipo en este torneo.' : 'Aún no hay equipos.<br>Registra el primero para armar el fixture.') +
        '</div></div>';
    } else {
      // agrupa por división respetando el orden del catálogo
      var grupos = {};
      visibles.forEach(function (e) {
        var d = e.division || S.SIN_DIVISION;
        (grupos[d] = grupos[d] || []).push(e);
      });
      divisiones.forEach(function (d) {
        if (!grupos[d]) return;
        if (divisiones.length > 1 && !activa) {
          h += '<div class="tiny dim" style="margin:16px 0 7px;font-weight:700;' +
            'text-transform:uppercase;letter-spacing:.6px">' + U.esc(d) +
            ' · ' + grupos[d].length + ' equipos</div>';
        }
        h += '<div class="list">';
        grupos[d].forEach(function (e) {
          var ctOk = e.cuerpoTecnico.filter(function (c) { return c.nombre; }).length;
          h += '<a class="list-item" href="#/equipos/' + e.id + '">' +
            escudoHTML(e, '') +
            '<div class="grow">' +
            '<div class="t">' + U.esc(e.nombre) +
            (e.region ? ' <span class="dim" style="font-weight:400">· ' + U.esc(e.region) + '</span>' : '') + '</div>' +
            '<div class="s">' + e.jugadores.length + '/' + S.MAX_JUGADORES + ' jugadores · ' +
            ctOk + '/' + S.ROLES_CT.length + ' cuerpo técnico · ' +
            e.estadios.length + '/' + S.MAX_ESTADIOS + ' estadios</div>' +
            '</div><span class="dim">›</span></a>';
        });
        h += '</div>';
      });
    }

    root.innerHTML = h;
    root.querySelector('[data-nuevo]').addEventListener('click', function () { modalEquipo(null); });
  }

  function escudoHTML(e, cls) {
    if (!e) return '<div class="crest ' + (cls || '') + '">?</div>';
    var ini = U.esc(U.iniciales(e.nombre));
    if (e.escudo) {
      // si el archivo no está (respaldo importado sin la carpeta img/), cae a las iniciales
      return '<img class="crest ' + (cls || '') + '" src="' + U.esc(e.escudo) + '"' +
        ' alt="' + U.esc(e.nombre) + '" data-ini="' + ini + '" data-cls="' + (cls || '') + '"' +
        ' onerror="V.equipos.falloEscudo(this)">';
    }
    return '<div class="crest ' + (cls || '') + '">' + ini + '</div>';
  }

  // reemplaza un escudo que no cargó por el recuadro de iniciales
  function falloEscudo(img) {
    var d = document.createElement('div');
    d.className = 'crest ' + (img.getAttribute('data-cls') || '');
    d.textContent = img.getAttribute('data-ini') || '?';
    img.replaceWith(d);
  }

  function modalEquipo(eq) {
    U.modal({
      titulo: eq ? 'Editar equipo' : 'Registrar equipo',
      cuerpo:
        '<label class="f"><span>NOMBRE DEL CLUB *</span><input type="text" name="nombre" value="' + U.esc(eq ? eq.nombre : '') + '" placeholder="Ej: Deportivo Aurora"></label>' +
        '<label class="f"><span>DIVISIÓN</span><input type="text" name="division" list="listaDivisiones" value="' +
        U.esc(eq ? eq.division : S.divisionActiva()) + '" placeholder="Ej: Tercera A Nacional">' +
        '<datalist id="listaDivisiones">' +
        S.DIVISIONES.map(function (d) { return '<option value="' + U.esc(d) + '">'; }).join('') +
        '</datalist></label>' +
        '<div class="grid-2">' +
        '<label class="f"><span>REGIÓN</span><input type="text" name="region" value="' + U.esc(eq ? eq.region : '') + '" placeholder="Ej: Biobío"></label>' +
        '<label class="f"><span>COLORES</span><input type="text" name="colores" value="' + U.esc(eq ? eq.colores : '') + '" placeholder="Rojo y blanco"></label>' +
        '</div>' +
        '<label class="f"><span>ESCUDO (opcional)</span><input type="file" name="escudo" accept="image/*"></label>',
      onOk: function (bg) {
        var nombre = U.val(bg, 'nombre');
        if (!nombre) { U.toast('El nombre es obligatorio', 'err'); return false; }
        var target = eq;
        if (!target) {
          target = {
            id: U.uid('eq'), nombre: '', colores: '', escudo: '',
            cuerpoTecnico: S.cuerpoTecnicoVacio(), jugadores: [], estadios: []
          };
          S.d.equipos.push(target);
        }
        target.nombre = nombre;
        target.division = U.val(bg, 'division');
        target.region = U.val(bg, 'region');
        target.colores = U.val(bg, 'colores');

        var f = bg.querySelector('[name="escudo"]').files[0];
        if (f) {
          U.leerImagen(f, 240, function (dataUrl) {
            if (dataUrl) target.escudo = dataUrl;
            S.save(); App.render();
          });
        } else {
          S.save(); App.render();
        }
        U.toast(eq ? 'Equipo actualizado' : 'Equipo registrado', 'ok');
      }
    });
  }

  /* =========================================================
     DETALLE DE EQUIPO
     ========================================================= */
  function detalle(root, eqId) {
    var e = S.equipo(eqId);
    if (!e) { root.innerHTML = '<div class="card"><div class="empty">Equipo no encontrado.</div></div>'; return; }

    root.innerHTML = '' +
      '<a class="tiny dim" href="#/equipos">‹ Volver a equipos</a>' +
      '<div class="card" style="margin-top:10px">' +
      '<div class="row">' + escudoHTML(e, 'lg') +
      '<div class="grow">' +
      '<div style="font-size:18px;font-weight:700">' + U.esc(e.nombre) + '</div>' +
      '<div class="row wrap" style="margin-top:4px">' +
      (e.division ? '<span class="chip info">' + U.esc(e.division) + '</span>' : '') +
      (e.region ? '<span class="chip">📍 ' + U.esc(e.region) + '</span>' : '') +
      (e.colores ? '<span class="chip">' + U.esc(e.colores) + '</span>' : '') +
      '</div>' +
      '</div></div>' +
      (e.fuentePlantel
        ? '<div class="tiny dim" style="margin-top:9px">Plantel importado de ' + U.esc(e.fuentePlantel) +
        ' · verifica los datos antes de usarlos en una planilla oficial.</div>'
        : '') +
      '<div class="row" style="margin-top:11px">' +
      '<button class="btn sm grow" data-edit>Editar datos</button>' +
      '<button class="btn sm danger" data-del>Eliminar</button>' +
      '</div></div>' +

      '<div class="pill-tabs">' +
      '<button data-st="tecnico" class="' + (subtab === 'tecnico' ? 'on' : '') + '">Cuerpo técnico</button>' +
      '<button data-st="jugadores" class="' + (subtab === 'jugadores' ? 'on' : '') + '">Jugadores</button>' +
      '<button data-st="estadios" class="' + (subtab === 'estadios' ? 'on' : '') + '">Estadios</button>' +
      '</div><div id="sub"></div>';

    root.querySelector('[data-edit]').addEventListener('click', function () { modalEquipo(e); });
    root.querySelector('[data-del]').addEventListener('click', function () {
      U.confirmar('Eliminar "' + e.nombre + '" y todos sus datos. Los partidos que lo incluyan quedarán incompletos.', function () {
        S.d.equipos = S.d.equipos.filter(function (x) { return x.id !== e.id; });
        S.save(); U.toast('Equipo eliminado', 'ok');
        location.hash = '#/equipos';
      });
    });
    U.on(root, '[data-st]', 'click', function (ev, b) {
      subtab = b.getAttribute('data-st');
      detalle(root, eqId);
    });

    var sub = root.querySelector('#sub');
    if (subtab === 'tecnico') pintaTecnico(sub, e);
    else if (subtab === 'jugadores') pintaJugadores(sub, e);
    else pintaEstadios(sub, e);
  }

  /* ---------------- Cuerpo técnico ---------------- */
  function pintaTecnico(sub, e) {
    var completos = e.cuerpoTecnico.filter(function (c) { return c.nombre; }).length;
    var h = '<div class="card tight"><div class="card-head"><h3>Cuerpo técnico</h3>' +
      '<span class="chip ' + (completos === e.cuerpoTecnico.length ? 'ok' : '') + '">' + completos + '/' + e.cuerpoTecnico.length + '</span></div>' +
      '<div class="list">';

    e.cuerpoTecnico.forEach(function (c) {
      h += '<div class="list-item" data-ct="' + c.id + '" style="cursor:pointer">' +
        '<div class="grow">' +
        '<div class="s">' + U.esc(c.rol) + (c.libre ? ' <span class="dim">(libre)</span>' : '') + '</div>' +
        '<div class="t">' + (c.nombre ? U.esc(c.nombre) : '<span class="dim" style="font-weight:400">Sin asignar</span>') + '</div>' +
        (c.telefono ? '<div class="s">' + U.esc(c.telefono) + '</div>' : '') +
        '</div><span class="dim">✎</span></div>';
    });

    h += '</div></div>';
    sub.innerHTML = h;

    U.on(sub, '[data-ct]', 'click', function (ev, row) {
      var id = row.getAttribute('data-ct');
      var c = null;
      e.cuerpoTecnico.forEach(function (x) { if (x.id === id) c = x; });
      if (!c) return;
      U.modal({
        titulo: c.rol,
        cuerpo:
          (c.libre ? '<label class="f"><span>NOMBRE DEL PUESTO</span><input type="text" name="rol" value="' + U.esc(c.rol) + '" placeholder="Ej: Utilero"></label>' : '') +
          '<label class="f"><span>NOMBRE COMPLETO</span><input type="text" name="nombre" value="' + U.esc(c.nombre) + '"></label>' +
          '<div class="grid-2">' +
          '<label class="f"><span>RUT</span><input type="text" name="rut" value="' + U.esc(c.rut) + '" placeholder="12.345.678-9"></label>' +
          '<label class="f"><span>TELÉFONO</span><input type="tel" name="telefono" value="' + U.esc(c.telefono) + '"></label>' +
          '</div>',
        onOk: function (bg) {
          if (c.libre) c.rol = U.val(bg, 'rol') || c.rol;
          c.nombre = U.val(bg, 'nombre');
          c.rut = U.val(bg, 'rut');
          c.telefono = U.val(bg, 'telefono');
          S.save(); pintaTecnico(sub, e);
          U.toast('Cargo actualizado', 'ok');
        }
      });
    });
  }

  /* ---------------- Jugadores ---------------- */
  function pintaJugadores(sub, e) {
    var js = e.jugadores.slice().sort(function (a, b) {
      return (Number(a.numero) || 999) - (Number(b.numero) || 999);
    });
    var lleno = e.jugadores.length >= S.MAX_JUGADORES;

    var h = '<div class="card tight">' +
      '<div class="card-head"><h3>Plantel</h3>' +
      '<span class="chip ' + (lleno ? 'warn' : '') + '">' + e.jugadores.length + '/' + S.MAX_JUGADORES + '</span></div>' +
      '<button class="btn primary block sm" data-add ' + (lleno ? 'disabled' : '') + '>+ Agregar jugador</button>';

    if (!js.length) {
      h += '<div class="empty">Sin jugadores inscritos.</div>';
    } else {
      h += '<div class="list" style="margin-top:10px">';
      js.forEach(function (j) {
        h += '<div class="list-item" data-j="' + j.id + '" style="cursor:pointer">' +
          '<div class="num">' + U.esc(j.numero || '–') + '</div>' +
          '<div class="grow">' +
          '<div class="t">' + U.esc(j.nombre) + (j.activo === false ? ' <span class="chip">Inactivo</span>' : '') + '</div>' +
          '<div class="s">' + U.esc(j.posicion || 'Sin posición') + (j.rut ? ' · ' + U.esc(j.rut) : '') + '</div>' +
          '</div><span class="dim">✎</span></div>';
      });
      h += '</div>';
    }
    h += '</div>';
    sub.innerHTML = h;

    sub.querySelector('[data-add]').addEventListener('click', function () { modalJugador(e, null, sub); });
    U.on(sub, '[data-j]', 'click', function (ev, row) {
      var j = S.jugador(e.id, row.getAttribute('data-j'));
      if (j) modalJugador(e, j, sub);
    });
  }

  function modalJugador(e, j, sub) {
    var posOpts = S.POSICIONES.map(function (p) { return { v: p, t: p }; });
    U.modal({
      titulo: j ? 'Editar jugador' : 'Nuevo jugador',
      cuerpo:
        '<div class="grid-2">' +
        '<label class="f"><span>N° CAMISETA</span><input type="number" name="numero" min="1" max="99" value="' + U.esc(j ? j.numero : '') + '"></label>' +
        '<label class="f"><span>POSICIÓN</span><select name="posicion">' + U.opciones(posOpts, j ? j.posicion : '', 'Sin definir') + '</select></label>' +
        '</div>' +
        '<label class="f"><span>NOMBRE COMPLETO *</span><input type="text" name="nombre" value="' + U.esc(j ? j.nombre : '') + '"></label>' +
        '<div class="grid-2">' +
        '<label class="f"><span>RUT</span><input type="text" name="rut" value="' + U.esc(j ? j.rut : '') + '" placeholder="12.345.678-9"></label>' +
        '<label class="f"><span>NACIMIENTO</span><input type="date" name="fechaNac" value="' + U.esc(j ? j.fechaNac : '') + '"></label>' +
        '</div>' +
        '<label class="f row" style="gap:8px;align-items:center">' +
        '<input type="checkbox" name="activo" style="width:auto" ' + (!j || j.activo !== false ? 'checked' : '') + '>' +
        '<span style="margin:0">Habilitado para ser convocado</span></label>' +
        (j ? '<button class="btn danger block sm" data-borrar style="margin-top:6px">Eliminar del plantel</button>' : ''),
      onAbrir: function (bg) {
        var b = bg.querySelector('[data-borrar]');
        if (b) b.addEventListener('click', function () {
          bg.remove();
          U.confirmar('¿Eliminar a ' + j.nombre + ' del plantel?', function () {
            e.jugadores = e.jugadores.filter(function (x) { return x.id !== j.id; });
            S.save(); U.toast('Jugador eliminado', 'ok');
            pintaJugadores(sub, e);
          });
        });
      },
      onOk: function (bg) {
        var nombre = U.val(bg, 'nombre');
        if (!nombre) { U.toast('El nombre es obligatorio', 'err'); return false; }
        var numero = U.val(bg, 'numero');
        var dup = e.jugadores.filter(function (x) {
          return numero && String(x.numero) === String(numero) && (!j || x.id !== j.id);
        })[0];
        if (dup) { U.toast('El número ' + numero + ' ya está en uso', 'err'); return false; }

        var t = j;
        if (!t) {
          if (e.jugadores.length >= S.MAX_JUGADORES) { U.toast('Máximo ' + S.MAX_JUGADORES + ' jugadores', 'err'); return false; }
          t = { id: U.uid('jug') };
          e.jugadores.push(t);
        }
        t.numero = numero;
        t.nombre = nombre;
        t.posicion = U.val(bg, 'posicion');
        t.rut = U.val(bg, 'rut');
        t.fechaNac = U.val(bg, 'fechaNac');
        t.activo = bg.querySelector('[name="activo"]').checked;
        S.save();
        U.toast(j ? 'Jugador actualizado' : 'Jugador agregado', 'ok');
        pintaJugadores(sub, e);
      }
    });
  }

  /* ---------------- Estadios ---------------- */
  function pintaEstadios(sub, e) {
    var lleno = e.estadios.length >= S.MAX_ESTADIOS;
    var h = '<div class="card tight">' +
      '<div class="card-head"><h3>Estadios</h3>' +
      '<span class="chip ' + (lleno ? 'warn' : '') + '">' + e.estadios.length + '/' + S.MAX_ESTADIOS + '</span></div>' +
      '<button class="btn primary block sm" data-add ' + (lleno ? 'disabled' : '') + '>+ Agregar estadio</button></div>';

    if (!e.estadios.length) {
      h += '<div class="card"><div class="empty">Sin estadios registrados.<br>Se necesitan para calendarizar partidos.</div></div>';
    }

    e.estadios.forEach(function (s) {
      h += '<div class="card">' +
        '<div class="card-head"><h3>' + U.esc(s.nombre) + '</h3>' +
        '<div class="row"><button class="btn xs" data-edit-est="' + s.id + '">Editar</button>' +
        '<button class="btn xs danger" data-del-est="' + s.id + '">✕</button></div></div>' +
        '<div class="tiny muted stack">' +
        (s.direccion ? '<div>📍 ' + U.esc(s.direccion) + '</div>' : '') +
        '<div class="row wrap">' +
        (s.capacidad ? '<span class="chip">👥 ' + U.esc(s.capacidad) + '</span>' : '') +
        (s.superficie ? '<span class="chip">🌱 ' + U.esc(s.superficie) + '</span>' : '') +
        '<span class="chip ' + (s.iluminacion ? 'ok' : '') + '">💡 ' + (s.iluminacion ? 'Con iluminación' : 'Sin iluminación') + '</span>' +
        (s.camarines ? '<span class="chip">🚿 ' + U.esc(s.camarines) + ' camarines</span>' : '') +
        '</div>' +
        (s.caracteristicas ? '<div style="white-space:pre-wrap">' + U.esc(s.caracteristicas) + '</div>' : '') +
        '</div>' +
        '<div class="photos">' +
        s.fotos.map(function (f, i) {
          return '<figure><img src="' + f + '" alt=""><button data-del-foto="' + s.id + ':' + i + '">✕</button></figure>';
        }).join('') +
        '</div>' +
        '<label class="f" style="margin-top:10px"><span>AGREGAR FOTOS</span>' +
        '<input type="file" accept="image/*" multiple data-foto="' + s.id + '"></label>' +
        '</div>';
    });

    sub.innerHTML = h;

    sub.querySelector('[data-add]').addEventListener('click', function () { modalEstadio(e, null, sub); });

    U.on(sub, '[data-edit-est]', 'click', function (ev, b) {
      var s = buscaEstadio(e, b.getAttribute('data-edit-est'));
      if (s) modalEstadio(e, s, sub);
    });
    U.on(sub, '[data-del-est]', 'click', function (ev, b) {
      var id = b.getAttribute('data-del-est');
      U.confirmar('¿Eliminar este estadio? Los partidos programados ahí quedarán sin sede.', function () {
        e.estadios = e.estadios.filter(function (x) { return x.id !== id; });
        S.save(); U.toast('Estadio eliminado', 'ok');
        pintaEstadios(sub, e);
      });
    });
    U.on(sub, '[data-del-foto]', 'click', function (ev, b) {
      var p = b.getAttribute('data-del-foto').split(':');
      var s = buscaEstadio(e, p[0]);
      if (!s) return;
      s.fotos.splice(Number(p[1]), 1);
      S.save(); pintaEstadios(sub, e);
    });
    U.on(sub, '[data-foto]', 'change', function (ev, inp) {
      var s = buscaEstadio(e, inp.getAttribute('data-foto'));
      if (!s) return;
      var files = Array.prototype.slice.call(inp.files);
      if (!files.length) return;
      var pend = files.length;
      files.forEach(function (f) {
        U.leerImagen(f, 900, function (dataUrl) {
          if (dataUrl) s.fotos.push(dataUrl);
          if (--pend === 0) {
            S.save(); U.toast('Foto(s) agregada(s)', 'ok');
            pintaEstadios(sub, e);
          }
        });
      });
    });
  }

  function buscaEstadio(e, id) {
    for (var i = 0; i < e.estadios.length; i++) if (e.estadios[i].id === id) return e.estadios[i];
    return null;
  }

  function modalEstadio(e, s, sub) {
    var supOpts = ['Pasto natural', 'Pasto sintético', 'Mixto', 'Tierra'].map(function (x) { return { v: x, t: x }; });
    U.modal({
      titulo: s ? 'Editar estadio' : 'Nuevo estadio',
      cuerpo:
        '<label class="f"><span>NOMBRE *</span><input type="text" name="nombre" value="' + U.esc(s ? s.nombre : '') + '" placeholder="Ej: Estadio Municipal"></label>' +
        '<label class="f"><span>DIRECCIÓN</span><input type="text" name="direccion" value="' + U.esc(s ? s.direccion : '') + '"></label>' +
        '<div class="grid-2">' +
        '<label class="f"><span>CAPACIDAD</span><input type="number" name="capacidad" min="0" value="' + U.esc(s ? s.capacidad : '') + '"></label>' +
        '<label class="f"><span>CAMARINES</span><input type="number" name="camarines" min="0" value="' + U.esc(s ? s.camarines : '') + '"></label>' +
        '</div>' +
        '<label class="f"><span>SUPERFICIE</span><select name="superficie">' + U.opciones(supOpts, s ? s.superficie : '', 'Sin definir') + '</select></label>' +
        '<label class="f row" style="gap:8px;align-items:center">' +
        '<input type="checkbox" name="iluminacion" style="width:auto" ' + (s && s.iluminacion ? 'checked' : '') + '>' +
        '<span style="margin:0">Cuenta con iluminación artificial</span></label>' +
        '<label class="f"><span>OTRAS CARACTERÍSTICAS</span><textarea name="caracteristicas" placeholder="Graderías, estacionamiento, accesos, cierre perimetral…">' + U.esc(s ? s.caracteristicas : '') + '</textarea></label>',
      onOk: function (bg) {
        var nombre = U.val(bg, 'nombre');
        if (!nombre) { U.toast('El nombre es obligatorio', 'err'); return false; }
        var t = s;
        if (!t) {
          if (e.estadios.length >= S.MAX_ESTADIOS) { U.toast('Máximo ' + S.MAX_ESTADIOS + ' estadios', 'err'); return false; }
          t = { id: U.uid('est'), fotos: [] };
          e.estadios.push(t);
        }
        t.nombre = nombre;
        t.direccion = U.val(bg, 'direccion');
        t.capacidad = U.val(bg, 'capacidad');
        t.camarines = U.val(bg, 'camarines');
        t.superficie = U.val(bg, 'superficie');
        t.iluminacion = bg.querySelector('[name="iluminacion"]').checked;
        t.caracteristicas = U.val(bg, 'caracteristicas');
        S.save();
        U.toast(s ? 'Estadio actualizado' : 'Estadio agregado', 'ok');
        pintaEstadios(sub, e);
      }
    });
  }

  return { render: render, escudoHTML: escudoHTML, falloEscudo: falloEscudo };
})();
