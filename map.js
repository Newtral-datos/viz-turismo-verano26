// Paleta secuencial de un solo tono, centrada en el verde corporativo #01f3b3
// (claro → oscuro, mismo hue ~164°, saturación/luminosidad escalonadas).
const SEQUENTIAL_BRAND = [
  "#e3f7f2",
  "#adf0de",
  "#5af2c9",
  "#01f3b3", // ancla: color corporativo exacto
  "#0ab88a",
  "#0e8162",
  "#0e4335",
];

const MESES_CORTO = [
  "ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic",
];

const JJA_2026 = new Set(["2026-06", "2026-07", "2026-08"]);

const fmt = new Intl.NumberFormat("es-ES");
const fmtCompact = new Intl.NumberFormat("es-ES", { notation: "compact", maximumFractionDigits: 1 });

function mesLabel(mes) {
  const [y, m] = mes.split("-");
  return `${MESES_CORTO[Number(m) - 1]} ${y.slice(2)}`;
}

const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
// Esri "Gray Canvas": basemap monocromo pensado para overlays temáticos, sin API key.
const BASEMAP_URL = isDark
  ? "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
  : "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}";
const NO_DATA_COLOR = isDark ? "#2c2c2a" : "#e1e0d9";
const ZERO_COLOR = "#d8d8d8";

// Con ~200 países la distribución es muy asimétrica (más de la mitad con
// cifras casi nulas, un puñado con millones): los cuantiles —por cantidad de
// países o incluso en escala logarítmica— dejaban el último tramo estirado
// desde 32 mil hasta 2,7 millones, un salto enorme dentro del mismo color.
// En su lugar se usan cortes fijos en potencias "redondas" (1, 1 mil, 5 mil,
// 20 mil, 100 mil, 500 mil), elegidos mirando los percentiles reales del
// dataset para que cada tramo agrupe un número razonable de países:
//   0–1: 59 países · 1–1.000: 41 · 1.000–5.000: 41 · 5.000–20.000: 24
//   20.000–100.000: 18 · 100.000–500.000: 9 · >500.000: 4
const FIXED_BREAKS = [1, 1000, 5000, 20000, 100000, 500000];

function buildColorExpression(breaks) {
  // ["case", sin_dato, NO_DATA_COLOR, valor_cero, ZERO_COLOR, ["step", valor, color0, break0, ...]]
  const step = ["step", ["get", "jja2026"], SEQUENTIAL_BRAND[0]];
  breaks.forEach((b, i) => step.push(b, SEQUENTIAL_BRAND[i + 1]));
  return [
    "case",
    ["!", ["has", "jja2026"]],
    NO_DATA_COLOR,
    ["==", ["get", "jja2026"], 0],
    ZERO_COLOR,
    step,
  ];
}

function buildLegend(breaks, max) {
  const edges = [1, ...breaks, max];
  const colors = SEQUENTIAL_BRAND.slice(0, breaks.length + 1);
  const el = document.getElementById("legend");
  el.innerHTML = '<p class="legend__title">Turistas españoles — jun-ago 2026</p>';

  const zeroRow = document.createElement("div");
  zeroRow.className = "legend__row";
  zeroRow.innerHTML = `<span class="legend__swatch" style="background:${ZERO_COLOR}"></span><span>0</span>`;
  el.appendChild(zeroRow);

  colors.forEach((hex, i) => {
    const row = document.createElement("div");
    row.className = "legend__row";
    const label =
      i === colors.length - 1
        ? `> ${fmtCompact.format(edges[i])}`
        : `${fmtCompact.format(edges[i])} – ${fmtCompact.format(edges[i + 1])}`;
    row.innerHTML = `<span class="legend__swatch" style="background:${hex}"></span><span>${label}</span>`;
    el.appendChild(row);
  });
  const noDataRow = document.createElement("div");
  noDataRow.className = "legend__row legend__row--no-data";
  noDataRow.innerHTML = `<span class="legend__swatch legend__swatch--no-data"></span><span>Sin datos</span>`;
  el.appendChild(noDataRow);
}

// Gráfico de líneas sin dependencias: evolución mensual completa, con los
// tres meses usados para colorear el mapa (jun-ago 2026) resaltados en verde
// corporativo sobre un fondo sombreado, para dejar claro qué representa el
// color del país en el mapa.
function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function lineChartSvg(serie) {
  const brand = cssVar("--brand") || "#01f3b3";
  const muted = cssVar("--text-muted") || "#898781";
  const border = cssVar("--border") || "#e1e0d9";

  const w = 288;
  const h = 108;
  const padL = 8;
  const padR = 8;
  const padT = 10;
  const padB = 18;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;

  const values = serie.map((d) => d.valor).filter((v) => v != null);
  const maxV = Math.max(...values, 1);
  const xStep = serie.length > 1 ? plotW / (serie.length - 1) : 0;

  const xAt = (i) => padL + i * xStep;
  const yAt = (v) => padT + plotH * (1 - v / maxV);

  let path = "";
  let drawing = false;
  serie.forEach((d, i) => {
    if (d.valor == null) {
      drawing = false;
      return;
    }
    const cmd = drawing ? "L" : "M";
    path += `${cmd}${xAt(i).toFixed(1)},${yAt(d.valor).toFixed(1)} `;
    drawing = true;
  });

  const jjaIdx = serie.reduce((acc, d, i) => (JJA_2026.has(d.mes) ? [...acc, i] : acc), []);
  let shade = "";
  let jjaPath = "";
  if (jjaIdx.length) {
    const first = jjaIdx[0];
    const last = jjaIdx[jjaIdx.length - 1];
    const x0 = xAt(Math.max(first - 0.5, 0));
    const x1 = xAt(Math.min(last + 0.5, serie.length - 1));
    shade = `<rect x="${x0.toFixed(1)}" y="${padT}" width="${(x1 - x0).toFixed(1)}" height="${plotH}" fill="${brand}" opacity="0.12" />`;

    let seg = "";
    let segDrawing = false;
    for (let i = first; i <= last; i++) {
      const d = serie[i];
      if (d.valor == null) {
        segDrawing = false;
        continue;
      }
      seg += `${segDrawing ? "L" : "M"}${xAt(i).toFixed(1)},${yAt(d.valor).toFixed(1)} `;
      segDrawing = true;
    }
    jjaPath = seg;
  }

  const dots = jjaIdx
    .filter((i) => serie[i].valor != null)
    .map((i) => `<circle cx="${xAt(i).toFixed(1)}" cy="${yAt(serie[i].valor).toFixed(1)}" r="2.3" fill="${brand}" />`)
    .join("");

  const firstLabel = mesLabel(serie[0].mes);
  const lastLabel = mesLabel(serie[serie.length - 1].mes);

  return `
    <svg class="popup__chart" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet">
      ${shade}
      <line x1="${padL}" y1="${(padT + plotH).toFixed(1)}" x2="${w - padR}" y2="${(padT + plotH).toFixed(1)}" stroke="${border}" stroke-width="1" />
      <path d="${path}" fill="none" stroke="${muted}" stroke-width="1.4" />
      <path d="${jjaPath}" fill="none" stroke="${brand}" stroke-width="2" />
      ${dots}
      <text x="${padL}" y="${h - 4}" font-size="9" fill="${muted}">${firstLabel}</text>
      <text x="${w - padR}" y="${h - 4}" font-size="9" fill="${muted}" text-anchor="end">${lastLabel}</text>
    </svg>
  `;
}

function popupHtml(props) {
  const serie = JSON.parse(props.serie_json);
  return `
    <div class="popup">
      <p class="popup__title">${props.nombre_es}</p>
      <p class="popup__value">${fmt.format(props.jja2026)}</p>
      <p class="popup__label">turistas españoles — jun-ago 2026</p>
      <p class="popup__chart-title">Evolución mensual (jul 2019 – ago 2026)</p>
      ${lineChartSvg(serie)}
    </div>
  `;
}

const POPUP_OPTIONS = { closeButton: true, maxWidth: "304px" };

function flyToCountry(map, props) {
  map.fitBounds(
    [
      [props.bbox_minx, props.bbox_miny],
      [props.bbox_maxx, props.bbox_maxy],
    ],
    { padding: 60, maxZoom: 6, duration: 700 }
  );
}

function openCountryPopup(map, props) {
  const center = [(props.bbox_minx + props.bbox_maxx) / 2, (props.bbox_miny + props.bbox_maxy) / 2];
  new maplibregl.Popup(POPUP_OPTIONS).setLngLat(center).setHTML(popupHtml(props)).addTo(map);
}

function buildRanking(map, paises) {
  const listEl = document.getElementById("ranking-list");
  const max = Math.max(...paises.map((p) => p.jja2026));
  listEl.innerHTML = "";

  paises.forEach((props, i) => {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ranking__item";
    btn.dataset.iso = props.iso_a3;
    const pct = (props.jja2026 / max) * 100;
    btn.innerHTML = `
      <span class="ranking__row">
        <span class="ranking__pos">${i + 1}</span>
        <span class="ranking__name">${props.nombre_es}</span>
        <span class="ranking__value">${fmtCompact.format(props.jja2026)}</span>
      </span>
      <span class="ranking__bar-track"><span class="ranking__bar-fill" style="width:${pct.toFixed(1)}%"></span></span>
    `;
    btn.addEventListener("click", () => {
      flyToCountry(map, props);
      openCountryPopup(map, props);
      document.body.classList.add("panel-collapsed");
      document.getElementById("panel-toggle")?.classList.remove("is-active");
    });
    li.appendChild(btn);
    listEl.appendChild(li);
  });
}

function overallBounds(paises) {
  let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
  for (const p of paises) {
    if (p.bbox_minx < minx) minx = p.bbox_minx;
    if (p.bbox_miny < miny) miny = p.bbox_miny;
    if (p.bbox_maxx > maxx) maxx = p.bbox_maxx;
    if (p.bbox_maxy > maxy) maxy = p.bbox_maxy;
  }
  return [[minx, miny], [maxx, maxy]];
}

async function main() {
  const res = await fetch("data/world.geojson");
  const world = await res.json();

  const paises = world.features.map((f) => f.properties).filter((p) => "jja2026" in p);
  paises.sort((a, b) => b.jja2026 - a.jja2026);

  const values = paises.map((p) => p.jja2026);
  const breaks = FIXED_BREAKS;
  const max = Math.max(...values);
  buildLegend(breaks, max);

  const map = new maplibregl.Map({
    container: "map",
    style: {
      version: 8,
      sources: {
        basemap: {
          type: "raster",
          tiles: [BASEMAP_URL],
          tileSize: 256,
          attribution: "Tiles &copy; Esri",
        },
        world: {
          type: "geojson",
          data: world,
          promoteId: "iso_a3",
        },
      },
      layers: [
        { id: "basemap", type: "raster", source: "basemap" },
        {
          id: "world-fill",
          type: "fill",
          source: "world",
          paint: {
            "fill-color": buildColorExpression(breaks),
            "fill-opacity": 0.85,
          },
        },
        {
          id: "world-outline",
          type: "line",
          source: "world",
          paint: { "line-color": "rgba(11,11,11,0.25)", "line-width": 0.4 },
        },
        {
          id: "world-hover",
          type: "line",
          source: "world",
          paint: {
            "line-color": isDark ? "#ffffff" : "#0b0b0b",
            "line-width": ["case", ["boolean", ["feature-state", "hover"], false], 2, 0],
          },
        },
      ],
    },
    bounds: overallBounds(paises),
    fitBoundsOptions: { padding: 40 },
    maxZoom: 8,
    minZoom: 1.2,
    attributionControl: true,
  });

  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");

  // Hover vía feature-state (barato, solo GPU) en vez de setFilter en cada
  // mousemove. Solo resalta países que están en el top 20 (tienen jja2026).
  const hoverTarget = { source: "world", id: null };

  function setHover(id, value) {
    if (id == null) return;
    hoverTarget.id = id;
    map.setFeatureState(hoverTarget, { hover: value });
  }

  let hoveredId = null;
  map.on("mousemove", "world-fill", (e) => {
    if (!e.features.length) return;
    const f = e.features[0];
    const hasData = "jja2026" in f.properties;
    map.getCanvas().style.cursor = hasData ? "pointer" : "";
    if (!hasData) {
      setHover(hoveredId, false);
      hoveredId = null;
      return;
    }
    const id = f.id;
    if (id === hoveredId) return;
    setHover(hoveredId, false);
    hoveredId = id;
    setHover(hoveredId, true);
  });
  map.on("mouseleave", "world-fill", () => {
    map.getCanvas().style.cursor = "";
    setHover(hoveredId, false);
    hoveredId = null;
  });

  map.on("click", "world-fill", (e) => {
    const props = e.features[0].properties;
    if (!("jja2026" in props)) return;
    new maplibregl.Popup(POPUP_OPTIONS).setLngLat(e.lngLat).setHTML(popupHtml(props)).addTo(map);
  });

  buildRanking(map, paises);
  setupMobileToggles();
}

function setupMobileToggles() {
  const panelBtn = document.getElementById("panel-toggle");
  const legendBtn = document.getElementById("legend-toggle");

  panelBtn.addEventListener("click", () => {
    const open = document.body.classList.toggle("panel-collapsed") === false;
    panelBtn.classList.toggle("is-active", open);
  });
  legendBtn.addEventListener("click", () => {
    const open = document.body.classList.toggle("legend-collapsed") === false;
    legendBtn.classList.toggle("is-active", open);
  });
}

main();
