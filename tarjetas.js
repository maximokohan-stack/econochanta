/*
 * Tarjetas que se abren de a una: un dato principal y un dibujo chico; al tocarla, el detalle aparece debajo.
 * Se usan en Precios, Actividad y empleo, Tu plata y la deuda de Cuentas del Estado.
 * Datos: data/indec_extra.json y data/indec.json (Action del INDEC).
 */
(function () {
  "use strict";

  var MES_L = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  var cache = {};

  function json(ruta) {
    if (!cache[ruta]) {
      cache[ruta] = fetch(ruta, { cache: "no-cache" }).then(function (r) { if (!r.ok) throw new Error(ruta); return r.json(); })
        .catch(function (e) { delete cache[ruta]; throw e; });
    }
    return cache[ruta];
  }
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function coma(v, d) { d = d == null ? 1 : d; return Number(v).toLocaleString("es-AR", { minimumFractionDigits: d, maximumFractionDigits: d }); }
  function pesos(v) { return "$ " + Math.round(v).toLocaleString("es-AR"); }
  function mes(f) { return MES_L[Number(f.slice(5, 7)) - 1]; }
  function ultimo(p) { return p[p.length - 1]; }
  function variacion(p, n) { return (p[p.length - 1][1] / p[p.length - 1 - n][1] - 1) * 100; }
  function trim(f) { return (Math.floor((Number(f.slice(5, 7)) - 1) / 3) + 1) + "º trimestre de " + f.slice(0, 4); }
  function sem(f) { return (f.slice(5, 7) === "01" ? "1er" : "2º") + " semestre de " + f.slice(0, 4); }

  /* ---------- dibujos chicos ---------- */
  function miniLinea(vals) {
    var W = 160, H = 36, lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals), r = hi - lo || 1;
    var d = vals.map(function (v, i) { return (i ? "L" : "M") + (2 + (W - 4) * i / (vals.length - 1)).toFixed(1) + "," + (H - 3 - (H - 6) * (v - lo) / r).toFixed(1); }).join(" ");
    return '<svg class="nx-ml" viewBox="0 0 ' + W + " " + H + '" preserveAspectRatio="none" aria-hidden="true"><path d="' + d + '" vector-effect="non-scaling-stroke"/></svg>';
  }
  function miniBarras(vals) {
    var hi = Math.max.apply(null, vals);
    return '<span class="nx-mbs" aria-hidden="true">' + vals.map(function (v) { return '<i style="height:' + Math.max(0, v / hi * 100).toFixed(0) + '%"></i>'; }).join("") + "</span>";
  }
  function miniPartes(partes) {
    return '<span class="nx-mb" aria-hidden="true">' + partes.map(function (p) { return '<i class="' + p[0] + '" style="width:' + p[1].toFixed(1) + '%"></i>'; }).join("") + "</span>";
  }
  function barrasH(filas, max, fmt, marca) {
    return '<div class="nx-fs">' + filas.map(function (f) {
      return '<div class="nx-f"><span class="nx-fe">' + f[0] + '</span><span class="nx-fb"><i style="width:' + (Math.max(0, f[1]) / max * 100).toFixed(1) + '%"></i>' +
        (marca != null ? '<b style="left:' + (marca / max * 100).toFixed(1) + '%"></b>' : "") + '</span><span class="nx-fv">' + fmt(f[1]) + '</span><span class="nx-fx">' + (f[2] || "") + "</span></div>";
    }).join("") + "</div>";
  }
  function lineaGrande(vals, etiquetas, ancho) {
    var W = Math.max(300, Math.round(ancho || 600)), H = 120, lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals), r = hi - lo || 1;
    function X(i) { return 10 + (W - 20) * i / (vals.length - 1); }
    function Y(v) { return H - 28 - (H - 48) * (v - lo) / r; }
    var d = vals.map(function (v, i) { return (i ? "L" : "M") + X(i).toFixed(1) + "," + Y(v).toFixed(1); }).join(" ");
    var t = '<text x="' + X(0) + '" y="' + (H - 8) + '" class="nx-lab">' + esc(etiquetas[0]) + '</text><text x="' + X(vals.length - 1) + '" y="' + (H - 8) + '" text-anchor="end" class="nx-lab">' + esc(etiquetas[1]) + "</text>";
    return '<svg viewBox="0 0 ' + W + " " + H + '" width="100%" aria-hidden="true"><path d="' + d + '" class="nx-lg"/>' + t + "</svg>";
  }

  /* ---------- la grilla ---------- */
  // cfg: { titulo, sub, clase, tarjetas: [{ id, titulo, valor, texto, mini, detalle: function (panel) }] }
  function grilla(caja, cfg) {
    caja.textContent = "";
    var sec = el("section", "nx " + (cfg.clase || ""));
    if (cfg.titulo) {
      var cab = el("div", "nx-cab");
      cab.appendChild(el("h2", "nx-h", cfg.titulo));
      cab.appendChild(el("span", "nx-hint", cfg.sub || "Tocá una tarjeta para ver el detalle"));
      sec.appendChild(cab);
    }
    var g = el("div", "nx-g" + (cfg.tarjetas.length <= 2 ? " nx-g--2" : "")), panel = el("div", "nx-panel"), abierta = null;
    panel.hidden = true; panel.id = "nx-p-" + Math.random().toString(36).slice(2, 8);
    var botones = {};
    cfg.tarjetas.forEach(function (t) {
      var b = el("button", "nx-c"); b.type = "button"; b.setAttribute("aria-expanded", "false"); b.setAttribute("aria-controls", panel.id);
      b.innerHTML = '<span class="nx-ct">' + esc(t.titulo) + '</span><span class="nx-cv">' + esc(t.valor) + '</span><span class="nx-cx">' + esc(t.texto) + "</span>" + (t.mini || "") + '<span class="nx-ver">Ver detalle ↓</span>';
      b.addEventListener("click", function () { abrir(abierta === t.id ? null : t.id); });
      botones[t.id] = b;
      g.appendChild(b);
    });
    function abrir(id) {
      abierta = id;
      Object.keys(botones).forEach(function (k) {
        var on = k === id, b = botones[k];
        b.classList.toggle("on", on); b.setAttribute("aria-expanded", on ? "true" : "false");
        b.querySelector(".nx-ver").textContent = on ? "Cerrar ↑" : "Ver detalle ↓";
      });
      panel.textContent = "";
      if (!id) { panel.hidden = true; return; }
      var t = cfg.tarjetas.filter(function (x) { return x.id === id; })[0];
      var pc = el("div", "nx-pcab"); pc.appendChild(el("h3", "nx-pt", t.titulo));
      var cerrar = el("button", "nx-cerrar", "Cerrar ✕"); cerrar.type = "button";
      cerrar.addEventListener("click", function () { abrir(null); botones[t.id].focus(); });
      pc.appendChild(cerrar); panel.appendChild(pc);
      var cuerpo = el("div", "nx-pc"); panel.appendChild(cuerpo);
      panel.hidden = false;
      t.detalle(cuerpo);
    }
    sec.appendChild(g); sec.appendChild(panel);
    caja.appendChild(sec);
    return { abrir: abrir };
  }

  /* ---------- Precios ---------- */
  function precios(caja) {
    return Promise.all([json("data/indec_extra.json"), json("data/indec.json")]).then(function (r) {
      var X = r[0].datos, I = r[1].series, R = X.ipc_rubros || {};
      var nuevos = { "01": "Alimentos y bebidas", "04": "Vivienda, agua, luz y gas", "09": "Recreación y cultura", "11": "Restaurantes y hoteles", "12": "Bienes y servicios varios" };
      var viejos = [["Salud", "ipcSalud"], ["Educación", "ipcEducacion"], ["Transporte", "ipcTransporte"], ["Comunicación", "ipcComunicaciones"],
        ["Equipamiento del hogar", "ipcEquipamiento"], ["Bebidas alcohólicas y tabaco", "ipcBebidas"], ["Prendas y calzado", "ipcPrendas"]];
      var rub = [];
      Object.keys(nuevos).forEach(function (c) { if (R[c] && R[c].puntos.length > 13) rub.push({ n: nuevos[c], p: R[c].puntos, nuevo: true }); });
      viejos.forEach(function (v) { if (I[v[1]] && I[v[1]].length > 13) rub.push({ n: v[0], p: I[v[1]] }); });
      rub.forEach(function (x) { x.a = variacion(x.p, 12); x.m = variacion(x.p, 1); x.f = ultimo(x.p)[0]; });
      rub.sort(function (a, b) { return b.a - a.a; });
      var gen = variacion(I.ipcGeneral, 12), mesIpc = mes(ultimo(I.ipcGeneral)[0]);
      var top = rub[0], bajo = rub[rub.length - 1];
      var viv = rub.filter(function (x) { return x.n.indexOf("Vivienda") === 0; })[0], ali = rub.filter(function (x) { return x.n.indexOf("Alimentos") === 0; })[0];
      var reg = [], NOM = { GBA: "Gran Buenos Aires", Pampeana: "Pampeana", Noreste: "Noreste (NEA)", Noroeste: "Noroeste (NOA)", Cuyo: "Cuyo", Patagonia: "Patagonia" };
      var RG = X.ipc_regiones || {};
      Object.keys(RG).forEach(function (k) { if (k !== "Nacional" && RG[k].infM.length) reg.push({ n: NOM[k] || k, m: ultimo(RG[k].infM)[1], a: ultimo(RG[k].infIA)[1] }); });
      reg.sort(function (a, b) { return b.m - a.m; });
      var nac = RG.Nacional ? ultimo(RG.Nacional.infM)[1] : null;
      function detRub(c) {
        c.innerHTML = '<p class="nx-p">En los últimos 12 meses el que más subió fue <b>' + esc(top.n.toLowerCase()) + " (" + coma(top.a) + "%)</b> y el que menos, " + esc(bajo.n.toLowerCase()) + " (" + coma(bajo.a) + "%). La línea punteada es el nivel general (" + coma(gen) + "%). Alimentos y vivienda son los que más pesan en el gasto de un hogar.</p>" +
          barrasH(rub.map(function (x) { return [esc(x.n), x.a, coma(x.m) + "% en " + mes(x.f)]; }), top.a * 1.05, function (v) { return coma(v) + "%"; }, gen) +
          '<p class="nx-fu">INDEC, IPC nacional por división, índice base diciembre 2016 = 100. Variación a ' + mesIpc + ".</p>";
      }
      var t = [{ id: "rub", titulo: "Los 12 rubros", valor: top.n.split(",")[0] + " +" + coma(top.a) + "%", texto: "en un año, el que más subió; el nivel general fue " + coma(gen) + "%", mini: miniBarras(rub.map(function (x) { return x.a; })), detalle: detRub }];
      if (viv) t.push({ id: "viv", titulo: "Vivienda y servicios", valor: "+" + coma(viv.m) + "% en " + mes(viv.f), texto: "agua, luz y gas; " + coma(viv.a) + "% en un año", mini: miniLinea(viv.p.slice(-14).map(function (p) { return p[1]; })), detalle: detRub });
      if (ali) t.push({ id: "ali", titulo: "Alimentos", valor: "+" + coma(ali.m) + "% en " + mes(ali.f), texto: coma(ali.a) + "% en un año: lo que más pesa en el changuito", mini: miniLinea(ali.p.slice(-14).map(function (p) { return p[1]; })), detalle: detRub });
      if (reg.length) t.push({ id: "reg", titulo: "Por región", valor: reg[0].n.split(" (")[0] + " " + coma(reg[0].m) + "%", texto: "la que más subió en " + mesIpc + "; " + reg[reg.length - 1].n.split(" (")[0] + " la que menos (" + coma(reg[reg.length - 1].m) + "%)", mini: miniBarras(reg.map(function (x) { return x.m; })),
        detalle: function (c) {
          c.innerHTML = '<p class="nx-p">En ' + mesIpc + " los precios subieron <b>" + coma(nac) + "%</b> en todo el país, pero no igual en todas partes: de " + coma(reg[reg.length - 1].m) + "% en " + esc(reg[reg.length - 1].n) + " a " + coma(reg[0].m) + "% en " + esc(reg[0].n) + ". La línea punteada es el promedio del país.</p>" +
            barrasH(reg.map(function (x) { return [esc(x.n), x.m, coma(x.a) + "% en 12 meses"]; }), reg[0].m * 1.1, function (v) { return coma(v) + "%"; }, nac) +
            '<p class="nx-fu">INDEC, IPC por región, nivel general.</p>';
        } });
      grilla(caja, { titulo: "Más sobre los precios", clase: "nx--inf", tarjetas: t });
    });
  }

  /* ---------- Actividad y empleo ---------- */
  function trabajo(caja) {
    return Promise.all([json("data/indec_extra.json"), json("data/indec.json")]).then(function (r) {
      var T = r[0].datos.trabajo, PH = r[0].datos.pobreza_hogares, I = r[1].series;
      if (!T || !T.tasa_de_empleo) throw new Error("sin trabajo");
      function tl(k) { return ultimo(T[k])[1]; }
      var emp = {}; T.tasa_de_empleo.forEach(function (p) { emp[p[0]] = p[1]; });
      var inf = T.tasa_de_empleo_informal.filter(function (p) { return emp[p[0]]; }).map(function (p) { return [p[0], p[1] / emp[p[0]] * 100]; });
      var share = ultimo(inf)[1], fT = trim(ultimo(T.tasa_de_empleo)[0]);
      var tasas = [["Actividad", tl("tasa_de_actividad"), "trabaja o busca trabajo, sobre la población"], ["Empleo", tl("tasa_de_empleo"), "trabaja, sobre la población"],
        ["Desocupación", tl("tasa_de_desocupacion"), "busca y no consigue, sobre los activos"], ["Subocupación", tl("tasa_de_subocupacion"), "trabaja menos de 35 horas y quiere más"],
        ["Ocupados que buscan otro trabajo", tl("tasa_de_ocupacion_demandante"), "sobre los activos"]];
      function detTasas(c) {
        c.innerHTML = barrasH(tasas, 60, function (v) { return coma(v) + "%"; }) +
          '<p class="nx-p">La subocupación (' + coma(tl("tasa_de_subocupacion")) + "%) se divide en quienes buscan activamente más horas (" + coma(tl("tasa_de_subocupacion_demandante")) + "%) y quienes no (" + coma(tl("tasa_de_subocupacion_no_demandante")) + "%).</p>" +
          '<p class="nx-fu">INDEC, EPH, 31 aglomerados urbanos, ' + fT + ".</p>";
      }
      var t = [
        { id: "inf", titulo: "Trabajo en negro", valor: coma(share, 0) + "% de los ocupados", texto: "no tiene aportes ni obra social (" + fT + ")", mini: miniLinea(inf.map(function (p) { return p[1]; })),
          detalle: function (c) {
            c.innerHTML = '<p class="nx-p">De cada 100 personas que trabajan, <b>' + coma(share, 0) + " lo hacen en negro</b>: sin aportes ni obra social. La desocupación (" + coma(tl("tasa_de_desocupacion")) + "%) no lo muestra, porque cuenta como ocupado a quien trabaja aunque sea informal.</p>" +
              '<div class="nx-split"><span class="nx-sf" style="width:' + (100 - share).toFixed(1) + '%">Formal ' + coma(100 - share, 0) + '%</span><span class="nx-si" style="width:' + share.toFixed(1) + '%">Informal ' + coma(share, 0) + "%</span></div>" +
              '<p class="nx-p">Cómo vino, en % de los ocupados: <b>' + coma(inf[0][1]) + "%</b> en el " + trim(inf[0][0]) + " (el primer dato de esta serie en la API) y <b>" + coma(share) + "%</b> en el " + fT + ".</p>" +
              '<div class="nx-linea"></div><p class="nx-fu">INDEC, EPH, 31 aglomerados urbanos. El INDEC publica el empleo formal e informal sobre la población total; la proporción sobre los ocupados es un cálculo de Econochanta.</p>';
            var l = c.querySelector(".nx-linea"); l.innerHTML = lineaGrande(inf.map(function (p) { return p[1]; }), [trim(inf[0][0]), fT], l.clientWidth);
          } },
        { id: "sub", titulo: "Subocupación", valor: coma(tl("tasa_de_subocupacion")) + "%", texto: "trabaja menos horas de las que quiere", mini: miniLinea(T.tasa_de_subocupacion.map(function (p) { return p[1]; })), detalle: detTasas },
        { id: "emp", titulo: "Tasa de empleo", valor: coma(tl("tasa_de_empleo")) + "%", texto: "de la población trabaja; " + coma(tl("tasa_de_actividad")) + "% trabaja o busca", mini: miniLinea(T.tasa_de_empleo.map(function (p) { return p[1]; })), detalle: detTasas }
      ];
      if (PH && PH.tasa_pobreza_hogares && I.pobreza) {
        var ph = ultimo(PH.tasa_pobreza_hogares)[1], ih = ultimo(PH.tasa_indigencia_hogares)[1], pp = ultimo(I.pobreza)[1], ip = ultimo(I.indigencia)[1], fs = sem(ultimo(PH.tasa_pobreza_hogares)[0]);
        t.push({ id: "pob", titulo: "Pobreza en hogares", valor: coma(ph) + "% de los hogares", texto: coma(pp) + "% de las personas (" + fs + ")", mini: miniLinea(PH.tasa_pobreza_hogares.map(function (p) { return p[1]; })),
          detalle: function (c) {
            c.innerHTML = '<table class="nx-tab"><thead><tr><th></th><th>Personas</th><th>Hogares</th></tr></thead><tbody>' +
              '<tr><td><b>Pobreza</b></td><td class="nx-n">' + coma(pp) + '%</td><td class="nx-n">' + coma(ph) + "%</td></tr>" +
              '<tr><td><b>Indigencia</b></td><td class="nx-n">' + coma(ip) + '%</td><td class="nx-n">' + coma(ih) + "%</td></tr></tbody></table>" +
              '<p class="nx-p">El porcentaje de personas es mayor que el de hogares porque los hogares pobres suelen tener más integrantes, sobre todo chicos.</p><p class="nx-fu">INDEC, EPH, 31 aglomerados urbanos, ' + fs + ".</p>";
          } });
      }
      grilla(caja, { titulo: "Más sobre el trabajo", clase: "nx--act", tarjetas: t });
    });
  }

  /* ---------- Tu plata: ¿alcanza? ---------- */
  function plata(caja) {
    return json("data/indec_extra.json").then(function (r) {
      var C = r.datos.canastas, CR = r.datos.crianza;
      if (!C || !C["CBT H2|Hogar 2"]) throw new Error("sin canastas");
      function u(k) { return ultimo(C[k].puntos)[1]; }
      var HOG = [["H1", "3 personas", "mujer de 35 años, su hijo de 18 y su madre de 61", u("CBA H1|Hogar 1"), u("CBT H1|Hogar 1")],
        ["H2", "4 personas", "pareja de 35 y 31 años con dos hijos de 6 y 8", u("CBA H2|Hogar 2"), u("CBT H2|Hogar 2")],
        ["H3", "5 personas", "pareja de 30 años con tres hijos de 5, 3 y 1", u("CBA H3|Hogar 3"), u("CBT H3|Hogar 3")]];
      var mesC = mes(ultimo(C["CBT|CBT"].puntos)[0]);
      var t = [{ id: "can", titulo: "Canasta básica", valor: pesos(HOG[1][4]), texto: "necesita por mes un hogar de 4 para no ser pobre (" + mesC + ")",
        mini: miniLinea(C["CBT H2|Hogar 2"].puntos.slice(-14).map(function (p) { return p[1]; })),
        detalle: function (c) {
          c.innerHTML = '<p class="nx-p">El INDEC calcula cuánto necesita un hogar por mes para no ser <b>indigente</b> (canasta básica alimentaria: solo comida) y para no ser <b>pobre</b> (canasta básica total: comida más ropa, transporte, salud, educación y otros). Valores de ' + mesC + ", Gran Buenos Aires.</p>" +
            '<table class="nx-tab"><thead><tr><th>Hogar</th><th>Para no ser indigente</th><th>Para no ser pobre</th></tr></thead><tbody>' +
            HOG.map(function (h) { return "<tr><td><b>" + h[1] + "</b><span>" + h[2] + '</span></td><td class="nx-n">' + pesos(h[3]) + '</td><td class="nx-n">' + pesos(h[4]) + "</td></tr>"; }).join("") + "</tbody></table>" +
            '<div class="nx-calc"><p class="nx-p"><b>¿Alcanza tu ingreso?</b> Elegí el hogar que más se parece al tuyo y escribí cuánto entra por mes, sumando todos los ingresos.</p>' +
            '<div class="nx-hogs" role="group" aria-label="Tipo de hogar">' + HOG.map(function (h) { return '<button type="button" class="nx-hb" data-h="' + h[0] + '" aria-pressed="' + (h[0] === "H2") + '">' + h[1] + "</button>"; }).join("") + "</div>" +
            '<label class="nx-in"><span>Ingreso del hogar por mes</span><input inputmode="numeric" autocomplete="off" placeholder="Ej.: 1.500.000"></label>' +
            '<div class="nx-esc" aria-hidden="true"><span class="nx-esc-b"><i class="nx-esc-ind"></i><i class="nx-esc-pob"></i></span><b class="nx-esc-tu"></b></div>' +
            '<p class="nx-res" aria-live="polite">Escribí un ingreso para comparar.</p></div>' +
            '<p class="nx-fu">INDEC, valorización mensual de la CBA y la CBT. En ' + mesC + " la canasta total subió " + coma(ultimo(C["CBT|v_m"].puntos)[1]) + "% en el mes y " + coma(ultimo(C["CBT|v_ia"].puntos)[1]) + "% en un año. El resultado es orientativo: el INDEC mide la pobreza con el ingreso y la composición exacta de cada hogar. Lo que escribís no se guarda ni se envía.</p>";
          var hog = "H2", inp = c.querySelector("input"), res = c.querySelector(".nx-res"), tu = c.querySelector(".nx-esc-tu"), bi = c.querySelector(".nx-esc-ind"), bp = c.querySelector(".nx-esc-pob");
          function calc() {
            var h = HOG.filter(function (x) { return x[0] === hog; })[0], ing = parseInt(String(inp.value).replace(/\D/g, ""), 10) || 0, tope = Math.max(h[4] * 1.6, ing * 1.1);
            bi.style.width = (h[3] / tope * 100).toFixed(1) + "%"; bp.style.width = ((h[4] - h[3]) / tope * 100).toFixed(1) + "%";
            tu.style.left = ing ? Math.min(99, ing / tope * 100).toFixed(1) + "%" : "-10%"; tu.hidden = !ing;
            res.textContent = !ing ? "Escribí un ingreso para comparar." : ing < h[3] ? "Está por debajo de la canasta alimentaria: faltan " + pesos(h[3] - ing) + " para cubrir solo la comida." :
              ing < h[4] ? "Cubre la comida, pero no la canasta total: faltan " + pesos(h[4] - ing) + " para no ser pobre." : "Supera la canasta total por " + pesos(ing - h[4]) + " al mes.";
          }
          [].forEach.call(c.querySelectorAll(".nx-hb"), function (b) {
            b.addEventListener("click", function () { hog = b.dataset.h; [].forEach.call(c.querySelectorAll(".nx-hb"), function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); }); calc(); });
          });
          inp.addEventListener("input", function () { var n = parseInt(inp.value.replace(/\D/g, ""), 10); inp.value = isNaN(n) ? "" : n.toLocaleString("es-AR"); calc(); });
          calc();
        } }];
      if (CR && CR.tot_6a12) {
        var tramos = [["Menos de 1 año", "men1"], ["1 a 3 años", "1a3"], ["4 a 5 años", "4a5"], ["6 a 12 años", "6a12"]].map(function (x) {
          return { n: x[0], t: ultimo(CR["tot_" + x[1]])[1], b: ultimo(CR["bys_" + x[1]])[1], c: ultimo(CR["cuid_" + x[1]])[1] };
        });
        var mx = Math.max.apply(null, tramos.map(function (x) { return x.t; })), mesCr = mes(ultimo(CR.tot_6a12)[0]);
        t.push({ id: "cri", titulo: "Criar a un chico", valor: pesos(tramos[3].t), texto: "por mes, de 6 a 12 años; " + pesos(tramos[0].t) + " si tiene menos de 1", mini: miniBarras(tramos.map(function (x) { return x.t; })),
          detalle: function (c) {
            c.innerHTML = '<p class="nx-p">Cuánto cuesta por mes criar a un chico en Gran Buenos Aires, según la edad. Se divide en <b>bienes y servicios</b> (comida, ropa, salud, escuela) y el <b>tiempo de cuidado</b>, valorizado como si se pagara. Valores de ' + mesCr + ".</p>" +
              '<div class="nx-fs">' + tramos.map(function (x) {
                return '<div class="nx-f"><span class="nx-fe">' + x.n + '</span><span class="nx-fb nx-fb--dos"><i style="width:' + (x.b / mx * 100).toFixed(1) + '%"></i><i class="nx-cuid" style="width:' + (x.c / mx * 100).toFixed(1) + '%"></i></span><span class="nx-fv">' + pesos(x.t) + '</span><span class="nx-fx">' + pesos(x.b) + " en cosas · " + pesos(x.c) + " en cuidado</span></div>";
              }).join("") + "</div>" +
              '<p class="nx-ley"><span><i class="nx-ley-a"></i>Bienes y servicios</span><span><i class="nx-ley-b"></i>Tiempo de cuidado</span></p><p class="nx-fu">INDEC, canasta de crianza de la primera infancia, la niñez y la adolescencia.</p>';
          } });
      }
      grilla(caja, { titulo: "¿Alcanza?", clase: "nx--pla", tarjetas: t });
    });
  }

  /* ---------- cuándo se pinta cada una ---------- */
  var VISTAS = { inflacion: ["inf-mas", precios], actividad: ["act-mas", trabajo], miplata: ["plata-mas", plata] };
  function revisar() {
    var v = (location.hash.replace(/^#/, "").split(/[/?]/)[0]) || "inicio", x = VISTAS[v];
    if (!x) return;
    var caja = document.getElementById(x[0]);
    if (!caja || caja.__nx) return;
    caja.__nx = true;
    x[1](caja).catch(function () { caja.__nx = false; caja.textContent = ""; });
  }
  window.addEventListener("hashchange", function () { setTimeout(revisar, 0); });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", revisar); else setTimeout(revisar, 0);

  window.EconoTarjetas = { grilla: grilla, json: json, miniLinea: miniLinea, miniBarras: miniBarras, miniPartes: miniPartes, barrasH: barrasH, coma: coma, pesos: pesos };
})();
