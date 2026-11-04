/* Mandatos: indicadores clave comparados por periodo presidencial.
   Sin juicio de valor: se muestra que paso entre el inicio y el fin de cada mandato, con las
   convenciones y limites de los datos a la vista. Usa EconoSeries.historia (historia larga). */
(function () {
  "use strict";

  var MANDATOS = [
    { id: "cfk", nombre: "Cristina Kirchner", sub: "2º mandato", ini: "2011-12-10", fin: "2015-12-09", rango: "dic 2011 – dic 2015", anios: "2011–15" },
    { id: "mm", nombre: "Mauricio Macri", sub: "", ini: "2015-12-10", fin: "2019-12-09", rango: "dic 2015 – dic 2019", anios: "2015–19" },
    { id: "af", nombre: "Alberto Fernández", sub: "", ini: "2019-12-10", fin: "2023-12-09", rango: "dic 2019 – dic 2023", anios: "2019–23" },
    { id: "jm", nombre: "Javier Milei", sub: "en curso", ini: "2023-12-10", fin: null, rango: "desde dic 2023", anios: "2023–hoy" }
  ];

  var MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; return e; }

  function nf(v, dec) { return v.toLocaleString("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec }); }
  function pct(v, dec) { return (v > 0 ? "+" : v < 0 ? "−" : "") + nf(Math.abs(v), dec === undefined ? (Math.abs(v) >= 100 ? 0 : 1) : dec) + "%"; }
  function pp(v) { return (v > 0 ? "+" : v < 0 ? "−" : "") + nf(Math.abs(v), 1) + " pp"; }

  /* ---------- fechas ---------- */

  function ym(d) { return d.slice(0, 7); }
  function sumaMes(m, n) {
    var a = +m.slice(0, 4), b = +m.slice(5, 7) - 1 + n;
    a += Math.floor(b / 12); b = ((b % 12) + 12) % 12;
    return a + "-" + (b < 9 ? "0" : "") + (b + 1);
  }
  function etiqueta(m) { return MESES[+m.slice(5, 7) - 1] + " " + m.slice(0, 4); }

  /* ---------- lecturas sobre una serie [[fecha, valor], ...] ---------- */

  function enMes(pts, m) {
    for (var i = pts.length - 1; i >= 0; i--) if (ym(pts[i][0]) === m) return pts[i];
    return null;
  }
  function hasta(pts, fecha) {
    for (var i = pts.length - 1; i >= 0; i--) if (pts[i][0] <= fecha) return pts[i];
    return null;
  }
  function desde(pts, fecha) {
    for (var i = 0; i < pts.length; i++) if (pts[i][0] >= fecha) return pts[i];
    return null;
  }
  function entre(pts, a, b) { return pts.filter(function (p) { return p[0] >= a && p[0] <= b; }); }

  /* Ventana mensual: del mes anterior a la asuncion al mes anterior al fin (o el ultimo dato). */
  function ventanaMensual(pts, mand) {
    var m0 = sumaMes(ym(mand.ini), -1);
    var m1 = mand.fin ? sumaMes(ym(mand.fin), -1) : ym(pts[pts.length - 1][0]);
    return { m0: m0, m1: m1 };
  }

  /* Inflacion compuesta de los meses (m0, m1], por ejemplo (nov 2015, nov 2019]. */
  function inflAcum(inf, m0, m1) {
    var p = 1, n = 0;
    for (var m = sumaMes(m0, 1); m <= m1; m = sumaMes(m, 1)) {
      var x = enMes(inf, m);
      if (!x) return null;
      p *= 1 + x[1] / 100; n++;
    }
    return n ? { acum: (p - 1) * 100, n: n, medio: (Math.pow(p, 1 / n) - 1) * 100 } : null;
  }

  function celda(valor, texto, detalle, extra, tono) {
    return { valor: valor, texto: texto, detalle: detalle || [], extra: extra || "", tono: tono };
  }
  function sinDato(motivo) { return { valor: null, texto: "—", detalle: motivo ? [motivo] : [], extra: "", tono: null }; }
  function tonoDe(v) { return v > 0 ? "up" : v < 0 ? "down" : "flat"; }

  /* ---------- indicadores ---------- */

  var INDICADORES = [
    {
      id: "inflacion", nombre: "Inflación acumulada", que: "Cuánto subieron los precios en total durante el mandato (de diciembre a noviembre).",
      claves: ["infM"],
      calc: function (S, md) {
        var inf = S.infM; var w = ventanaMensual(inf, md);
        var r = inflAcum(inf, w.m0, w.m1);
        if (!r) return sinDato("sin datos mensuales completos");
        return celda(r.acum, pct(r.acum), ["Promedio de " + nf(r.medio, 1) + "% por mes", etiqueta(sumaMes(w.m0, 1)) + " a " + etiqueta(w.m1)], "", tonoDe(r.acum));
      }
    },
    {
      id: "dolar", nombre: "Dólar oficial", que: "Cuánto subió el precio del dólar oficial, y cuánto en términos reales (descontando la inflación en pesos).",
      claves: ["dOficial", "infM"],
      calc: function (S, md) {
        var d = S.dOficial; var a = desde(d, md.ini); var b = md.fin ? hasta(d, md.fin) : d[d.length - 1];
        if (!a || !b || a[0] === b[0]) return sinDato();
        var nom = (b[1] / a[1] - 1) * 100;
        var det = ["$ " + nf(a[1], a[1] < 100 ? 2 : 0) + " → $ " + nf(b[1], b[1] < 100 ? 2 : 0)];
        var w = ventanaMensual(S.infM, md); var inf = inflAcum(S.infM, w.m0, w.m1);
        var extra = "";
        if (inf) { var real = ((1 + nom / 100) / (1 + inf.acum / 100) - 1) * 100; extra = "En términos reales " + pct(real); }
        return celda(nom, pct(nom), det, extra, tonoDe(nom));
      }
    },
    {
      id: "riesgo", nombre: "Riesgo país", que: "Cuánto más rinden los bonos argentinos que los de EE. UU., en puntos básicos: mide la desconfianza de los inversores.",
      claves: ["riesgo"],
      calc: function (S, md) {
        var r = S.riesgo; var a = desde(r, md.ini); var b = md.fin ? hasta(r, md.fin) : r[r.length - 1];
        if (!a || !b || a[0] === b[0]) return sinDato();
        var v = entre(r, a[0], b[0]).map(function (p) { return p[1]; });
        var d = b[1] - a[1];
        return celda(d, (d > 0 ? "+" : d < 0 ? "−" : "") + nf(Math.abs(d), 0) + " pb", [nf(a[1], 0) + " → " + nf(b[1], 0) + " pb", "Máximo " + nf(Math.max.apply(null, v), 0) + " · mínimo " + nf(Math.min.apply(null, v), 0)], "", tonoDe(d));
      }
    },
    {
      id: "reservas", nombre: "Reservas internacionales", que: "Los dólares que tiene el Banco Central (reservas brutas, a fin de mes).",
      claves: ["reservasMes"], opcionales: ["reservas"],
      calc: function (S, md) {
        var s = S.reservasMes; var w = ventanaMensual(s, md);
        var a = enMes(s, w.m0), b = enMes(s, w.m1), fin = etiqueta(w.m1);
        // la serie mensual se actualiza con retraso: para el mandato en curso se usa el ultimo dato diario del BCRA
        var d = S.reservas;
        if (!md.fin && d && d.length && d[d.length - 1][0] > s[s.length - 1][0] && ym(d[d.length - 1][0]) > w.m1) {
          b = d[d.length - 1]; var f = b[0].split("-"); fin = +f[2] + " " + MESES[+f[1] - 1] + " " + f[0];
        }
        if (!a || !b) return sinDato();
        var v = (b[1] / a[1] - 1) * 100;
        return celda(v, pct(v), ["USD " + nf(a[1], 0) + " M → " + nf(b[1], 0) + " M", etiqueta(w.m0) + " a " + fin], "", tonoDe(v));
      }
    },
    {
      id: "actividad", nombre: "Actividad (EMAE)", que: "Cuánto creció o cayó la actividad económica entre el inicio y el fin (serie sin estacionalidad).",
      claves: ["emae"],
      calc: function (S, md) {
        var s = S.emae; var w = ventanaMensual(s, md);
        var a = enMes(s, w.m0), b = enMes(s, w.m1);
        if (!a || !b) return sinDato();
        var v = (b[1] / a[1] - 1) * 100;
        return celda(v, pct(v), ["Índice " + nf(a[1], 1) + " → " + nf(b[1], 1), etiqueta(w.m0) + " a " + etiqueta(w.m1)], "", tonoDe(v));
      }
    },
    {
      id: "desocupacion", nombre: "Desocupación", que: "Porcentaje de la población activa que busca trabajo y no lo consigue (EPH, trimestral).",
      claves: ["desocupacion"],
      calc: function (S, md) {
        var s = S.desocupacion;
        // ultimo trimestre completo antes de asumir y antes de terminar (cada punto es el inicio del trimestre)
        var a = hasta(s, sumaMes(ym(md.ini), -3) + "-31"), b = md.fin ? hasta(s, sumaMes(ym(md.fin), -3) + "-31") : s[s.length - 1];
        if (!a || !b || a[0] === b[0]) return sinDato();
        var d = b[1] - a[1];
        return celda(d, pp(d), [nf(a[1], 1) + "% → " + nf(b[1], 1) + "%", trim(a[0]) + " a " + trim(b[0])], "", tonoDe(d));
      }
    },
    {
      id: "pobreza", nombre: "Pobreza", que: "Porcentaje de personas bajo la línea de pobreza (EPH, 31 aglomerados, semestral). El INDEC la publica desde el 2º semestre de 2016.",
      claves: ["pobreza"],
      calc: function (S, md) {
        var s = S.pobreza;
        var a = hasta(s, sumaMes(ym(md.ini), -6) + "-31"), b = md.fin ? hasta(s, sumaMes(ym(md.fin), -6) + "-31") : s[s.length - 1];
        var nota = "";
        if (!a) { a = desde(s, md.ini); nota = "Desde el primer dato publicado"; if (md.fin && a && a[0] > md.fin) return sinDato("El INDEC no la publicaba"); }
        if (!a || !b || a[0] === b[0]) return sinDato(md.fin && md.fin < s[0][0] ? "El INDEC no la publicaba" : "");
        var d = b[1] - a[1];
        var v = entre(s, a[0], b[0]);
        var mx = v.reduce(function (m, p) { return p[1] > m[1] ? p : m; }, v[0]);
        var det = [nf(a[1], 1) + "% → " + nf(b[1], 1) + "%", sem(a[0]) + " a " + sem(b[0])];
        if (mx[0] !== a[0] && mx[0] !== b[0]) det.push("Máximo " + nf(mx[1], 1) + "% (" + sem(mx[0]) + ")");
        return celda(d, pp(d), det, nota, tonoDe(d));
      }
    },
    {
      id: "salario", nombre: "Salario real (registrado)", que: "Cuánto subieron los salarios formales frente a los precios: si es positivo, alcanzan para comprar más.",
      claves: ["salarios", "infM"],
      calc: function (S, md) {
        var s = S.salarios; var w = ventanaMensual(s, md);
        var primero = ym(s[0][0]);
        var m0 = w.m0;
        if (m0 < primero) return sinDato("El índice de salarios empieza en " + etiqueta(primero));
        var a = enMes(s, m0), b = enMes(s, w.m1);
        if (!a || !b || m0 >= w.m1) return sinDato();
        var inf = inflAcum(S.infM, m0, w.m1); if (!inf) return sinDato();
        var nom = (b[1] / a[1] - 1) * 100;
        var real = ((1 + nom / 100) / (1 + inf.acum / 100) - 1) * 100;
        return celda(real, pct(real), ["Salario " + pct(nom) + " · precios " + pct(inf.acum), etiqueta(m0) + " a " + etiqueta(w.m1)], "", tonoDe(real));
      }
    }
  ];

  function trim(d) { return Math.floor((+d.slice(5, 7) - 1) / 3) + 1 + "º trim " + d.slice(0, 4); }
  function sem(d) { return (d.slice(5, 7) === "01" ? "1º" : "2º") + " sem " + d.slice(0, 4); }

  /* ---------- pantalla ---------- */

  var listo = false;

  function armar() {
    var raiz = document.getElementById("mandatos-contenido");
    if (!raiz || listo) return;
    listo = true;
    var S = window.EconoSeries;
    raiz.textContent = "";

    var aviso = el("p", "rec__aviso", "Los mismos indicadores medidos en cada mandato presidencial: cómo estaba cada cosa cuando asumió el gobierno, cómo estaba al terminar (o cómo está hoy) y cuánto cambió. Los números muestran qué pasó, no por qué: el resultado depende también de la herencia, del contexto internacional y de decisiones de política económica. No es un ranking.");
    raiz.appendChild(aviso);

    var estado = el("p", "hint", "Cargando historia de los indicadores…");
    raiz.appendChild(estado);
    var caja = el("div", "mand"); raiz.appendChild(caja);

    var claves = {};
    var opc = {};
    INDICADORES.forEach(function (i) {
      i.claves.forEach(function (k) { claves[k] = true; });
      (i.opcionales || []).forEach(function (k) { opc[k] = true; });
    });
    var keys = Object.keys(claves), datos = {}, fallas = [];
    Promise.all(keys.map(function (k) {
      return S.historia(k).then(function (p) { datos[k] = p; }, function () { fallas.push(k); });
    }).concat(Object.keys(opc).map(function (k) {
      return S.historia(k).then(function (p) { datos[k] = p; }, function () { /* opcional */ });
    }))).then(function () {
      estado.textContent = "";
      if (fallas.length) {
        var f = el("p", "hint", "No se pudo bajar la historia de: " + fallas.join(", ") + ". Esas filas pueden aparecer vacías; probá de nuevo en un rato.");
        raiz.insertBefore(f, caja);
      }
      pintar(caja, datos);
      raiz.appendChild(notas());
      var hasta0 = el("p", "hint mand__fuente", "Fuentes: INDEC (precios, actividad, salarios, empleo y pobreza, incluida su API oficial), BCRA y ArgentinaDatos. Reservas: datos.gob.ar. La última publicación del INDEC puede tener unas semanas de retraso respecto de la fecha de hoy.");
      raiz.appendChild(hasta0);
    });
  }

  function calcularTodo(datos) {
    return INDICADORES.map(function (ind) {
      var S = {};
      ind.claves.concat(ind.opcionales || []).forEach(function (k) { S[k] = datos[k]; });
      var faltan = ind.claves.some(function (k) { return !datos[k] || !datos[k].length; });
      return MANDATOS.map(function (m) {
        try { return faltan ? sinDato("sin datos") : ind.calc(S, m); } catch (e) { return sinDato("sin datos"); }
      });
    });
  }

  /* Una tarjeta por indicador con una barra por mandato. Si hay valores negativos, las barras salen
     de una linea central (izquierda baja, derecha sube); si no, todas arrancan del borde. */
  function pintarBarras(caja, res) {
    var grilla = el("div", "mbar__grilla");
    INDICADORES.forEach(function (ind, i) {
      var celdas = res[i];
      var vals = celdas.map(function (c) { return c.valor; }).filter(function (v) { return v !== null && isFinite(v); });
      var max = Math.max.apply(null, vals.map(Math.abs).concat([1e-9]));
      var conNeg = vals.some(function (v) { return v < 0; });
      var card = el("article", "mbar" + (conNeg ? " mbar--div" : ""));
      card.appendChild(el("h3", "mbar__tit", ind.nombre));
      card.appendChild(el("p", "mbar__que", ind.que));
      var ul = el("ul", "mbar__lista");
      MANDATOS.forEach(function (m, j) {
        var c = celdas[j], li = el("li", "mbar__fila");
        var q = el("span", "mbar__quien"); q.appendChild(document.createTextNode(m.nombre.split(" ").slice(-1)[0]));
        q.appendChild(el("small", "", m.anios)); li.appendChild(q);
        var pista = el("span", "mbar__pista"); pista.setAttribute("aria-hidden", "true");
        if (c.valor !== null) {
          var w = Math.abs(c.valor) / max * (conNeg ? 50 : 100);
          var barra = el("span", "mbar__barra " + (c.tono || "flat") + (c.valor < 0 ? " neg" : ""));
          barra.style.width = Math.max(w, 0.8).toFixed(2) + "%";
          barra.style.left = (conNeg ? (c.valor < 0 ? 50 - w : 50) : 0).toFixed(2) + "%";
          barra.style.setProperty("--i", j);
          pista.appendChild(barra);
        }
        li.appendChild(pista);
        li.appendChild(el("span", "mbar__val" + (c.tono && c.tono !== "flat" ? " " + c.tono : ""), c.texto));
        var det = el("span", "mbar__det", c.detalle[0] || "");
        li.appendChild(det);
        var mas = el("span", "mbar__mas", c.detalle.slice(1).concat(c.extra ? [c.extra] : []).join(" · "));
        if (mas.textContent) li.appendChild(mas);
        ul.appendChild(li);
      });
      card.appendChild(ul);
      var b = el("button", "mbar__ver", "Ver detalle"); b.type = "button"; b.setAttribute("aria-expanded", "false");
      b.addEventListener("click", function () {
        var on = card.classList.toggle("abierto");
        b.textContent = on ? "Ver menos" : "Ver detalle"; b.setAttribute("aria-expanded", on ? "true" : "false");
      });
      card.appendChild(b);
      grilla.appendChild(card);
    });
    caja.appendChild(grilla);
    // las barras crecen cuando la grilla entra en pantalla
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("visible"); io.unobserve(e.target); } });
      }, { threshold: 0.2 });
      [].forEach.call(grilla.children, function (c) { io.observe(c); });
      setTimeout(function () { [].forEach.call(grilla.children, function (c) { c.classList.add("visible"); }); }, 2500);
    } else [].forEach.call(grilla.children, function (c) { c.classList.add("visible"); });
  }

  function pintar(caja, datos) {
    var res = calcularTodo(datos);
    pintarBarras(caja, res);
    var d = el("details", "mand__comotabla");
    d.appendChild(el("summary", "", "Ver todo como tabla"));
    caja.appendChild(d);
    caja = d;
    var tabla = el("table", "mand__tabla");
    var cap = el("caption", "sr-only", "Indicadores por mandato presidencial"); tabla.appendChild(cap);
    var th = el("thead"), tr = el("tr");
    tr.appendChild(el("th", "mand__vacio", "Indicador"));
    MANDATOS.forEach(function (m) {
      var h = el("th", "mand__mand");
      h.scope = "col";
      h.appendChild(el("span", "mand__nombre", m.nombre));
      h.appendChild(el("span", "mand__rango", m.rango + (m.sub ? " · " + m.sub : "")));
      tr.appendChild(h);
    });
    th.appendChild(tr); tabla.appendChild(th);

    var tb = el("tbody");
    INDICADORES.forEach(function (ind) {
      var fila = el("tr");
      var c0 = el("th", "mand__ind"); c0.scope = "row";
      c0.appendChild(el("span", "mand__indn", ind.nombre));
      c0.appendChild(el("span", "mand__que", ind.que));
      fila.appendChild(c0);
      MANDATOS.forEach(function (m, j) {
        var td = el("td", "mand__celda"); td.setAttribute("data-mandato", m.nombre);
        var c = res[INDICADORES.indexOf(ind)][j];
        var v = el("span", "mand__valor" + (c.tono && c.tono !== "flat" ? " " + c.tono : ""), c.texto);
        td.appendChild(v);
        c.detalle.forEach(function (t) { td.appendChild(el("span", "mand__det", t)); });
        if (c.extra) td.appendChild(el("span", "mand__extra", c.extra));
        fila.appendChild(td);
      });
      tb.appendChild(fila);
    });
    tabla.appendChild(tb);
    caja.appendChild(tabla);
  }

  function notas() {
    var d = el("details", "mand__notas"); d.open = true;
    d.appendChild(el("summary", "", "Cómo leer esta comparación"));
    var ul = el("ul");
    [
      "Ventanas: los indicadores mensuales se miden desde el mes anterior a la asunción hasta el mes anterior al fin (por ejemplo, de noviembre a noviembre); la inflación acumulada incluye de diciembre a noviembre. Para el mandato en curso, hasta el último dato publicado de cada indicador. Los diarios (dólar, riesgo país) usan el día de la asunción y el último día del mandato.",
      "Dólar en términos reales: la suba del dólar oficial descontada la inflación en pesos del mismo período. No incluye la inflación de EE. UU.",
      "Cristina Kirchner (2011-2015): el INDEC estuvo intervenido entre 2007 y 2015 y sus cifras de inflación y de pobreza de esa época fueron cuestionadas; acá se muestra lo que publicó oficialmente, que no es comparable con el resto. La pobreza no se publicó hasta 2016.",
      "Mauricio Macri (2015-2019): el INDEC se reorganizó al inicio de ese gobierno y no publicó un IPC nacional hasta 2017, así que la inflación de fines de 2015 y de 2016 viene de series empalmadas por la fuente.",
      "Salarios: el índice de salarios del INDEC empieza en octubre de 2015, por eso no hay salario real para el mandato anterior.",
      "Dólar: las cotizaciones son las que publica ArgentinaDatos; en los primeros años vienen redondeadas, así que las variaciones son aproximadas.",
      "Pobreza: se toma el último semestre publicado antes de que cambie el gobierno, por lo que no incluye el semestre en que asumió cada gestión. Si en ese lapso hubo un máximo, se muestra aparte."
    ].forEach(function (t) { ul.appendChild(el("li", "", t)); });
    d.appendChild(ul);
    return d;
  }

  window.EconoMandatos = { armar: armar };
})();
