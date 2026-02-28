"use client";

import {
  Proyecto,
  ResultadoDespieceExtendido,
  PESO_POR_METRO,
  GeometriaElemento,
  CategoriaElemento,
  CATEGORIAS_INFO,
} from "@/lib/types";
import { getTipoGeometria, resolverEtiquetaLado } from "@/lib/generadores";

interface ResumenImpresionProps {
  proyecto: Proyecto;
  resultados: Map<string, ResultadoDespieceExtendido>;
  longitudBarraComercial: number;
}

// ============================================================
// SVG GEOMETRY DIAGRAMS
// ============================================================

function letraLado(i: number, lado?: { etiqueta?: string }): string {
  if (lado?.etiqueta) return lado.etiqueta;
  return String.fromCharCode(97 + i);
}

function generarSVGGeometria(
  g: GeometriaElemento,
  categoria: CategoriaElemento,
  subtipo?: string
): string {
  const tipo = getTipoGeometria(categoria, subtipo);

  const lbl = (i: number) => letraLado(i, g.lados[i]);

  // Superficie rectangular
  if (tipo === "superficie" && g.forma === "rectangular") {
    const a = g.lados[0]?.longitud || 5;
    const b = g.lados[1]?.longitud || 5;
    // Positioned huecos
    const scX = 150 / a, scY = 100 / b;
    const huecosHtml = g.huecos && g.huecos.length > 0 ? g.huecos.map((h) => {
      const hx = h.x ?? a / 2;
      const hy = h.y ?? b / 2;
      const hw = h.largo * scX, hh = h.ancho * scY;
      const sx = 35 + hx * scX - hw / 2;
      const sy = 30 + (b - hy) * scY - hh / 2;
      return `<rect x="${sx.toFixed(1)}" y="${sy.toFixed(1)}" width="${hw.toFixed(1)}" height="${hh.toFixed(1)}" fill="none" stroke="#999" stroke-dasharray="3,2"/>
        <text x="${(sx + hw / 2).toFixed(1)}" y="${(sy + hh / 2 + 3).toFixed(1)}" text-anchor="middle" font-size="7" fill="#999">${h.nombre}</text>`;
    }).join("") : "";
    return `<svg viewBox="0 0 220 160" width="200" height="140" xmlns="http://www.w3.org/2000/svg">
      <rect x="35" y="30" width="150" height="100" fill="#f8f8f8" stroke="#333" stroke-width="1.5"/>
      <text x="110" y="22" text-anchor="middle" font-size="11" font-weight="bold" fill="#b45309">${lbl(0)} = ${a}m</text>
      <text x="195" y="82" text-anchor="start" font-size="11" font-weight="bold" fill="#b45309">${lbl(1)} = ${b}m</text>
      ${huecosHtml}
    </svg>`;
  }

  // Superficie L (6 lados perimetrales)
  if (tipo === "superficie" && g.forma === "l" && g.lados.length >= 6) {
    const dims = g.lados.map(l => l.longitud);
    const [la, lb, lc, ld, le, lf] = dims;
    // Proporcionar al viewBox
    const totalW = la, totalH = lf;
    const scale = Math.min(150 / totalW, 110 / totalH);
    const ox = 35, oy = 25;
    const w = totalW * scale, h = totalH * scale;
    const bh = lb * scale; // altura lado derecho
    const cw = lc * scale; // ancho entrante H
    const ew = le * scale; // ancho inferior

    // Path del L: P0(ox,oy) → P1(ox+w,oy) → P2(ox+w,oy+bh) → P3(ox+w-cw,oy+bh) → P4(ox+w-cw,oy+h) → P5(ox,oy+h) → close
    const pts = [
      [ox, oy], [ox + w, oy], [ox + w, oy + bh],
      [ox + w - cw, oy + bh], [ox + w - cw, oy + h],
      [ox, oy + h]
    ];
    const path = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ") + " Z";

    // Midpoints for labels
    const mid = (i: number) => {
      const p1 = pts[i], p2 = pts[(i + 1) % 6];
      return [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2];
    };
    const labels = [
      { pos: mid(0), text: `${lbl(0)}=${la}m`, anchor: "middle", dy: -6, dx: 0 },
      { pos: mid(1), text: `${lbl(1)}=${lb}m`, anchor: "start", dy: 0, dx: 6 },
      { pos: mid(2), text: `${lbl(2)}=${lc}m`, anchor: "middle", dy: -6, dx: 0 },
      { pos: mid(3), text: `${lbl(3)}=${ld}m`, anchor: "start", dy: 0, dx: 6 },
      { pos: mid(4), text: `${lbl(4)}=${le}m`, anchor: "middle", dy: 14, dx: 0 },
      { pos: mid(5), text: `${lbl(5)}=${lf}m`, anchor: "end", dy: 0, dx: -6 },
    ];

    return `<svg viewBox="0 0 220 160" width="200" height="140" xmlns="http://www.w3.org/2000/svg">
      <path d="${path}" fill="#f8f8f8" stroke="#333" stroke-width="1.5"/>
      ${labels.map((l, i) => `<text x="${(l.pos[0] + l.dx).toFixed(1)}" y="${(l.pos[1] + l.dy).toFixed(1)}" text-anchor="${l.anchor}" font-size="9" font-weight="bold" fill="#b45309">${l.text}</text>`).join("\n      ")}
    </svg>`;
  }

  // Superficie U (3 zonas)
  if (tipo === "superficie" && g.forma === "u" && g.lados.length >= 6) {
    const alaIzqL = g.lados[0]?.longitud || 5;
    const alaIzqA = g.lados[1]?.longitud || 2;
    const centroL = g.lados[2]?.longitud || 10;
    const centroA = g.lados[3]?.longitud || 3;
    const alaDerL = g.lados[4]?.longitud || 5;
    const alaDerA = g.lados[5]?.longitud || 2;

    const totalW = centroL;
    const totalH = Math.max(alaIzqL, alaDerL);
    const scale = Math.min(150 / totalW, 110 / totalH);
    const ox = 35, oy = 20;
    const w = totalW * scale, h = totalH * scale;
    const lw = alaIzqA * scale;
    const rw = alaDerA * scale;
    const bh = centroA * scale;

    // U path: open at top between arms
    const pts = [
      [ox, oy], [ox + lw, oy], [ox + lw, oy + h - bh],
      [ox + w - rw, oy + h - bh], [ox + w - rw, oy],
      [ox + w, oy], [ox + w, oy + h], [ox, oy + h]
    ];
    const path = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ") + " Z";

    return `<svg viewBox="0 0 220 160" width="200" height="140" xmlns="http://www.w3.org/2000/svg">
      <path d="${path}" fill="#f8f8f8" stroke="#333" stroke-width="1.5"/>
      <text x="${ox - 4}" y="${oy + h / 2}" text-anchor="end" font-size="9" font-weight="bold" fill="#b45309">${lbl(0)}=${alaIzqL}m</text>
      <text x="${ox + lw / 2}" y="${oy - 4}" text-anchor="middle" font-size="9" font-weight="bold" fill="#b45309">${lbl(1)}=${alaIzqA}m</text>
      <text x="${ox + w / 2}" y="${oy + h + 12}" text-anchor="middle" font-size="9" font-weight="bold" fill="#b45309">${lbl(2)}=${centroL}m</text>
      <text x="${ox + w / 2}" y="${oy + h - bh - 4}" text-anchor="middle" font-size="9" font-weight="bold" fill="#b45309">${lbl(3)}=${centroA}m</text>
      <text x="${ox + w + 4}" y="${oy + h / 2}" text-anchor="start" font-size="9" font-weight="bold" fill="#b45309">${lbl(4)}=${alaDerL}m</text>
      <text x="${ox + w - rw / 2}" y="${oy - 4}" text-anchor="middle" font-size="9" font-weight="bold" fill="#b45309">${lbl(5)}=${alaDerA}m</text>
    </svg>`;
  }

  // Muro recto
  if (tipo === "muro" && (g.forma === "recto" || g.lados.length === 1)) {
    const a = g.lados[0]?.longitud || 5;
    const alto = g.alto || 3;
    return `<svg viewBox="0 0 220 120" width="200" height="100" xmlns="http://www.w3.org/2000/svg">
      <rect x="30" y="30" width="160" height="60" fill="#f8f8f8" stroke="#333" stroke-width="1.5"/>
      <text x="110" y="22" text-anchor="middle" font-size="11" font-weight="bold" fill="#b45309">${lbl(0)} = ${a}m</text>
      <text x="200" y="62" text-anchor="start" font-size="10" fill="#666">h = ${alto}m</text>
    </svg>`;
  }

  // Muro L
  if (tipo === "muro" && g.forma === "l" && g.lados.length >= 2) {
    const a = g.lados[0]?.longitud || 5;
    const b = g.lados[1]?.longitud || 5;
    return `<svg viewBox="0 0 220 140" width="200" height="120" xmlns="http://www.w3.org/2000/svg">
      <polyline points="30,30 30,110 150,110" fill="none" stroke="#333" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
      <text x="18" y="70" text-anchor="end" font-size="11" font-weight="bold" fill="#b45309">${lbl(0)}=${a}m</text>
      <text x="90" y="128" text-anchor="middle" font-size="11" font-weight="bold" fill="#b45309">${lbl(1)}=${b}m</text>
      ${g.alto ? `<text x="160" y="110" font-size="10" fill="#666">h=${g.alto}m</text>` : ""}
    </svg>`;
  }

  // Muro U
  if (tipo === "muro" && g.forma === "u" && g.lados.length >= 3) {
    const a = g.lados[0]?.longitud || 5;
    const b = g.lados[1]?.longitud || 5;
    const c = g.lados[2]?.longitud || 5;
    return `<svg viewBox="0 0 220 140" width="200" height="120" xmlns="http://www.w3.org/2000/svg">
      <polyline points="30,30 30,110 170,110 170,30" fill="none" stroke="#333" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
      <text x="18" y="72" text-anchor="end" font-size="10" font-weight="bold" fill="#b45309">${lbl(0)}=${a}m</text>
      <text x="100" y="128" text-anchor="middle" font-size="10" font-weight="bold" fill="#b45309">${lbl(1)}=${b}m</text>
      <text x="182" y="72" text-anchor="start" font-size="10" font-weight="bold" fill="#b45309">${lbl(2)}=${c}m</text>
      ${g.alto ? `<text x="100" y="22" text-anchor="middle" font-size="10" fill="#666">h=${g.alto}m</text>` : ""}
    </svg>`;
  }

  // Muro cerrado
  if (tipo === "muro" && g.forma === "cerrado" && g.lados.length >= 4) {
    return `<svg viewBox="0 0 220 160" width="200" height="140" xmlns="http://www.w3.org/2000/svg">
      <rect x="35" y="30" width="150" height="100" fill="none" stroke="#333" stroke-width="6" rx="2"/>
      ${g.lados.slice(0, 4).map((l, i) => {
        const positions = [
          { x: 110, y: 20, anchor: "middle" },
          { x: 196, y: 82, anchor: "start" },
          { x: 110, y: 145, anchor: "middle" },
          { x: 24, y: 82, anchor: "end" },
        ];
        const p = positions[i];
        return `<text x="${p.x}" y="${p.y}" text-anchor="${p.anchor}" font-size="10" font-weight="bold" fill="#b45309">${lbl(i)}=${l.longitud}m</text>`;
      }).join("\n      ")}
      ${g.alto ? `<text x="110" y="85" text-anchor="middle" font-size="10" fill="#666">h=${g.alto}m</text>` : ""}
    </svg>`;
  }

  // Pilar
  if (tipo === "pilar") {
    const sw = g.seccionAncho || 0.30;
    const sh = g.seccionAlto || 0.30;
    const alto = g.alto || 3;
    return `<svg viewBox="0 0 220 140" width="200" height="120" xmlns="http://www.w3.org/2000/svg">
      <rect x="60" y="30" width="100" height="80" fill="#f8f8f8" stroke="#333" stroke-width="1.5"/>
      <text x="110" y="22" text-anchor="middle" font-size="10" font-weight="bold" fill="#b45309">${sw}m</text>
      <text x="170" y="72" text-anchor="start" font-size="10" font-weight="bold" fill="#b45309">${sh}m</text>
      <text x="110" y="128" text-anchor="middle" font-size="10" fill="#666">Alto: ${alto}m</text>
    </svg>`;
  }

  // Lineal (viga/zuncho)
  if (tipo === "lineal") {
    const a = g.lados[0]?.longitud || 5;
    const sw = g.seccionAncho || 0.30;
    const sh = g.seccionAlto || 0.30;
    return `<svg viewBox="0 0 220 100" width="200" height="80" xmlns="http://www.w3.org/2000/svg">
      <rect x="20" y="30" width="180" height="30" fill="#f8f8f8" stroke="#333" stroke-width="1.5"/>
      <text x="110" y="22" text-anchor="middle" font-size="11" font-weight="bold" fill="#b45309">${lbl(0)} = ${a}m</text>
      <text x="110" y="80" text-anchor="middle" font-size="9" fill="#666">Seccion: ${sw} × ${sh}m</text>
    </svg>`;
  }

  // Escalera
  if (tipo === "escalera") {
    const a = g.lados[0]?.longitud || 4;
    const b = g.lados[1]?.longitud || 1.2;
    return `<svg viewBox="0 0 220 140" width="200" height="120" xmlns="http://www.w3.org/2000/svg">
      <polygon points="30,110 180,30 195,38 45,118" fill="#f8f8f8" stroke="#333" stroke-width="1.5"/>
      <text x="105" y="55" text-anchor="middle" font-size="11" font-weight="bold" fill="#b45309" transform="rotate(-25,105,55)">${lbl(0)} = ${a}m</text>
      <text x="195" y="22" text-anchor="start" font-size="11" font-weight="bold" fill="#b45309">${lbl(1)} = ${b}m</text>
    </svg>`;
  }

  // Fallback genérico: lista de lados
  return `<svg viewBox="0 0 220 80" width="200" height="60" xmlns="http://www.w3.org/2000/svg">
    ${g.lados.map((l, i) => `<text x="10" y="${16 + i * 14}" font-size="10" font-weight="bold" fill="#b45309">${lbl(i)} = ${l.longitud}m (${l.nombre})</text>`).join("\n    ")}
  </svg>`;
}


// ============================================================
// MAIN COMPONENT
// ============================================================

export default function ResumenImpresion({
  proyecto,
  resultados,
  longitudBarraComercial,
}: ResumenImpresionProps) {

  const imprimir = () => {
    const fecha = new Date().toLocaleDateString("es-ES", {
      day: "2-digit", month: "2-digit", year: "numeric",
    });

    // ── Agregar datos globales ──
    let barrasTotal = 0, pesoTotal = 0, desperdicioTotal = 0, metrosCompra = 0;
    let sobrantesDisponibles = 0, barrasAhorradas = 0;
    const materialGlobal = new Map<number, { barras: number; peso: number }>();

    for (const [, res] of resultados) {
      for (const r of res.resultadosPorDiametro) {
        barrasTotal += r.totalBarrasComerciales;
        const prev = materialGlobal.get(r.diametro) || { barras: 0, peso: 0 };
        prev.barras += r.totalBarrasComerciales;
        prev.peso += r.pesoKg;
        materialGlobal.set(r.diametro, prev);
        for (const bc of r.barrasComerciales) {
          if (bc.id > 0) metrosCompra += bc.longitudTotal;
        }
      }
      pesoTotal += res.pesoTotal;
      desperdicioTotal += res.desperdicioTotal;
      sobrantesDisponibles += res.sobrantesNuevos.filter(s => !s.usado).length;
      barrasAhorradas += res.barrasComercialAhorradas;
    }
    const despPct = metrosCompra > 0 ? ((desperdicioTotal / metrosCompra) * 100).toFixed(1) : "0";

    // Material global ordenado por diámetro
    const matSorted = [...materialGlobal.entries()].sort((a, b) => a[0] - b[0]);

    // ── CSS ──
    const css = `
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: Arial, sans-serif; font-size: 10px; color: #000; padding: 8mm; }
@media print {
  @page { margin: 8mm; size: A4 portrait; }
  .page { page-break-after: always; }
  .page:last-child { page-break-after: auto; }
}
.page { min-height: 100%; }
h1 { font-size: 16px; margin-bottom: 2px; }
h2 { font-size: 13px; margin: 10px 0 5px; border-bottom: 2px solid #000; padding-bottom: 2px; }
h3 { font-size: 11px; margin: 6px 0 3px; }
.header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #000; padding-bottom: 6px; margin-bottom: 8px; }
.header-right { text-align: right; font-size: 9px; color: #555; }
.stats { display: flex; gap: 10px; margin: 8px 0; }
.stat { background: #f0f0f0; padding: 5px 10px; border-radius: 3px; text-align: center; flex: 1; }
.stat-val { font-size: 15px; font-weight: bold; }
.stat-lbl { font-size: 8px; color: #666; }
table { border-collapse: collapse; width: 100%; margin: 4px 0; }
th, td { border: 1px solid #ccc; padding: 2px 5px; font-size: 9px; }
th { background: #333; color: #fff; font-size: 8px; text-transform: uppercase; }
td { text-align: center; }
td:first-child { text-align: left; }
.mat-table th, .mat-table td { padding: 3px 8px; }
.element-content { display: flex; gap: 12px; margin-top: 6px; }
.element-left { width: 38%; }
.element-right { width: 62%; }
.geo-info { font-size: 9px; margin-top: 6px; }
.geo-info div { margin: 1px 0; }
.geo-info .label { color: #666; }
.geo-info .amber { color: #b45309; font-weight: bold; }
.barras-table { margin-top: 6px; }
.barras-table td, .barras-table th { font-size: 8px; padding: 1px 4px; }
.footer { margin-top: 10px; padding-top: 5px; border-top: 1px solid #ccc; font-size: 8px; color: #888; display: flex; justify-content: space-between; }
.green { color: #16a34a; }
.amber { color: #b45309; }
.red { color: #dc2626; }
`;

    // ── PÁGINA 1: RESUMEN GLOBAL ──
    let html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>Resumen - ${proyecto.nombre}</title><style>${css}</style></head><body>
<div class="page">
<div class="header">
  <div>
    <h1>RESUMEN DE FERRALLA</h1>
    <div style="font-size:12px;margin-top:2px;"><strong>${proyecto.nombre}</strong></div>
  </div>
  <div class="header-right">
    <div>Fecha: ${fecha}</div>
    <div>Barra comercial: ${longitudBarraComercial}m</div>
    <div>Elementos: ${proyecto.elementos.length}</div>
    <div>FERRAPP v1.0</div>
  </div>
</div>

<div class="stats">
  <div class="stat"><div class="stat-val">${barrasTotal}</div><div class="stat-lbl">BARRAS ${longitudBarraComercial}m</div></div>
  <div class="stat"><div class="stat-val">${pesoTotal.toFixed(0)} kg</div><div class="stat-lbl">PESO TOTAL</div></div>
  <div class="stat"><div class="stat-val">${despPct}%</div><div class="stat-lbl">DESPERDICIO</div></div>
  <div class="stat"><div class="stat-val">${sobrantesDisponibles}</div><div class="stat-lbl">SOBRANTES</div></div>
  <div class="stat"><div class="stat-val">${barrasAhorradas}</div><div class="stat-lbl">BARRAS AHORRADAS</div></div>
</div>

<h2>MATERIAL A COMPRAR (barras de ${longitudBarraComercial}m)</h2>
<table class="mat-table">
  <thead><tr>
    ${matSorted.map(([d]) => `<th>&oslash;${d}</th>`).join("")}
    <th>TOTAL</th>
  </tr></thead>
  <tbody>
    <tr>${matSorted.map(([, v]) => `<td><strong>${v.barras}</strong> barras</td>`).join("")}<td><strong>${barrasTotal}</strong> barras</td></tr>
    <tr>${matSorted.map(([, v]) => `<td>${v.peso.toFixed(0)} kg</td>`).join("")}<td><strong>${pesoTotal.toFixed(0)}</strong> kg</td></tr>
  </tbody>
</table>

<h2>RECUENTO TOTAL DE PIEZAS A CORTAR</h2>`;

    // Recuento global: agregar todos los cortes de todos los elementos
    {
      const globalCuts = new Map<number, Map<string, { longitud: number; count: number }>>();
      for (const [, res] of resultados) {
        for (const r of res.resultadosPorDiametro) {
          if (!globalCuts.has(r.diametro)) globalCuts.set(r.diametro, new Map());
          const dMap = globalCuts.get(r.diametro)!;
          for (const bc of r.barrasComerciales) {
            for (const c of bc.cortes) {
              const key = c.longitud.toFixed(2);
              const prev = dMap.get(key);
              if (prev) { prev.count++; }
              else { dMap.set(key, { longitud: c.longitud, count: 1 }); }
            }
          }
        }
      }
      const diametros = [...globalCuts.keys()].sort((a, b) => a - b);
      html += `<table class="mat-table"><thead><tr>
        <th>Diametro</th><th>Cant.</th><th>Medida</th>
      </tr></thead><tbody>`;
      for (const d of diametros) {
        const cuts = [...globalCuts.get(d)!.values()].sort((a, b) => b.longitud - a.longitud);
        const barrasCompra = materialGlobal.get(d)?.barras || 0;
        // Primera fila con separador de diámetro
        html += `<tr style="border-top:2px solid #333;">
          <td rowspan="${cuts.length}" style="font-weight:bold;vertical-align:top;background:#f5f5f5">&oslash;${d}mm<br><small style="color:#666">${barrasCompra} barras</small></td>
          <td style="font-weight:bold">${cuts[0].count}</td>
          <td style="text-align:left">&oslash;${d} a ${cuts[0].longitud.toFixed(2)}m</td>
        </tr>`;
        for (let i = 1; i < cuts.length; i++) {
          html += `<tr>
            <td style="font-weight:bold">${cuts[i].count}</td>
            <td style="text-align:left">&oslash;${d} a ${cuts[i].longitud.toFixed(2)}m</td>
          </tr>`;
        }
      }
      html += `</tbody></table>`;
    }

    html += `
<h2>DESGLOSE POR ELEMENTO</h2>
<table>
  <thead><tr>
    <th style="width:30px">#</th><th style="text-align:left">Elemento</th><th>Categoria</th>
    <th>Barras</th><th>Peso (kg)</th><th>Desperdicio</th><th>Sobrantes</th>
  </tr></thead>
  <tbody>`;

    proyecto.elementos.forEach((el, idx) => {
      const res = resultados.get(el.id);
      if (!res) {
        html += `<tr><td>${idx + 1}</td><td style="text-align:left">${el.nombre}</td><td colspan="5" style="color:#999">No calculado</td></tr>`;
        return;
      }
      const b = res.resultadosPorDiametro.reduce((s, r) => s + r.totalBarrasComerciales, 0);
      const mc = res.resultadosPorDiametro.reduce(
        (s, r) => s + r.barrasComerciales.filter(bc => bc.id > 0).reduce((sum, bc) => sum + bc.longitudTotal, 0), 0
      );
      const pct = mc > 0 ? ((res.desperdicioTotal / mc) * 100).toFixed(1) : "0";
      const catNombre = el.categoria ? CATEGORIAS_INFO[el.categoria]?.nombre || el.categoria : "-";
      const pctClass = Number(pct) < 5 ? "green" : Number(pct) < 15 ? "amber" : "red";
      html += `<tr>
        <td>${idx + 1}</td>
        <td style="text-align:left;font-weight:bold">${el.nombre}</td>
        <td>${catNombre}${el.subtipo ? `<br><small>${el.subtipo.replace(/_/g, " ")}</small>` : ""}</td>
        <td>${b}</td>
        <td>${res.pesoTotal.toFixed(0)}</td>
        <td class="${pctClass}">${pct}%</td>
        <td>${res.sobrantesNuevos.length}</td>
      </tr>`;
    });

    html += `</tbody></table>
<div class="footer"><span>FERRAPP &mdash; ${proyecto.nombre}</span><span>${fecha}</span></div>
</div>`;

    // ── PÁGINAS POR ELEMENTO ──
    const totalPages = 1 + proyecto.elementos.filter(el => resultados.has(el.id)).length;

    let pageNum = 1;
    for (const el of proyecto.elementos) {
      const res = resultados.get(el.id);
      if (!res) continue;
      pageNum++;

      const catNombre = el.categoria ? CATEGORIAS_INFO[el.categoria]?.nombre || el.categoria : "-";
      const subLabel = el.subtipo ? el.subtipo.replace(/_/g, " ") : "";

      // SVG del diagrama (fallback a "libre" si no hay categoria)
      const svgDiagram = el.geometria
        ? generarSVGGeometria(el.geometria, el.categoria || "libre", el.subtipo)
        : '<div style="color:#999;font-size:10px;">Sin geometria</div>';

      // Metadata de geometria
      let geoMeta = "";
      if (el.geometria) {
        const g = el.geometria;
        geoMeta += `<div><span class="label">Forma:</span> ${g.forma}</div>`;
        geoMeta += `<div><span class="label">Lados:</span> ${g.lados.map((l, i) => `<span class="amber">${letraLado(i, l)}</span>=${l.longitud}m`).join(", ")}</div>`;
        if (g.alto) geoMeta += `<div><span class="label">Alto:</span> ${g.alto}m</div>`;
        if (g.seccionAncho && g.seccionAlto) geoMeta += `<div><span class="label">Seccion:</span> ${g.seccionAncho}&times;${g.seccionAlto}m</div>`;
        geoMeta += `<div><span class="label">Separacion:</span> ${Math.round((g.espaciado || 0.20) * 100)}cm</div>`;
        if (g.anchoZuncho) geoMeta += `<div><span class="label">Zuncho:</span> ${Math.round(g.anchoZuncho * 100)}cm</div>`;
        if (g.huecos && g.huecos.length > 0) {
          geoMeta += `<div><span class="label">Huecos:</span> ${g.huecos.map(h => {
            const pos = (h.x !== undefined && h.y !== undefined) ? ` @(${h.x},${h.y})` : "";
            return `${h.nombre} ${h.largo}&times;${h.ancho}m${pos}`;
          }).join(", ")}</div>`;
        }
      }

      // Tabla resumen por diámetro
      let diaTable = `<table><thead><tr><th>&oslash;</th><th>Barras</th><th>Piezas</th><th>Peso (kg)</th><th>Desp.</th></tr></thead><tbody>`;
      let elBarrasTotal = 0, elPesoTotal = 0;
      for (const r of res.resultadosPorDiametro) {
        elBarrasTotal += r.totalBarrasComerciales;
        elPesoTotal += r.pesoKg;
        diaTable += `<tr>
          <td>&oslash;${r.diametro}</td>
          <td>${r.totalBarrasComerciales}</td>
          <td>${r.totalPiezas}</td>
          <td>${r.pesoKg.toFixed(1)}</td>
          <td>${r.porcentajeDesperdicio}%</td>
        </tr>`;
      }
      diaTable += `<tr style="font-weight:bold;border-top:2px solid #333;">
        <td>Total</td><td>${elBarrasTotal}</td><td>${res.resultadosPorDiametro.reduce((s, r) => s + r.totalPiezas, 0)}</td><td>${elPesoTotal.toFixed(0)}</td><td></td>
      </tr></tbody></table>`;

      // Material a comprar del elemento
      let matEl = `<table class="mat-table"><thead><tr><th>&oslash;</th><th>Barras ${longitudBarraComercial}m</th><th>Peso (kg)</th></tr></thead><tbody>`;
      for (const r of res.resultadosPorDiametro) {
        const peso = +(r.totalBarrasComerciales * longitudBarraComercial * (PESO_POR_METRO[r.diametro] || 0)).toFixed(1);
        matEl += `<tr><td>&oslash;${r.diametro}</td><td>${r.totalBarrasComerciales}</td><td>${peso}</td></tr>`;
      }
      matEl += `</tbody></table>`;

      // ── Recuento de piezas a cortar (agrupado por diámetro y medida) ──
      let recuento = "";
      for (const r of res.resultadosPorDiametro) {
        // Contar TODOS los cortes agrupados por longitud
        const countByLength = new Map<string, { longitud: number; count: number; etiquetas: string[] }>();
        for (const bc of r.barrasComerciales) {
          for (const c of bc.cortes) {
            const key = c.longitud.toFixed(2);
            const prev = countByLength.get(key);
            if (prev) {
              prev.count++;
              if (!prev.etiquetas.includes(c.etiqueta)) prev.etiquetas.push(c.etiqueta);
            } else {
              countByLength.set(key, { longitud: c.longitud, count: 1, etiquetas: [c.etiqueta] });
            }
          }
        }

        const sorted = [...countByLength.values()].sort((a, b) => b.longitud - a.longitud);

        recuento += `<table class="barras-table"><thead><tr>
          <th colspan="3" style="text-align:left;background:#555;">&oslash;${r.diametro}mm &mdash; Comprar ${r.totalBarrasComerciales} barras de ${longitudBarraComercial}m &rarr; ${r.totalPiezas} piezas</th>
        </tr><tr>
          <th style="width:50px">Cant.</th>
          <th style="text-align:left">Medida</th>
          <th style="text-align:left">Descripcion</th>
        </tr></thead><tbody>`;

        for (const item of sorted) {
          recuento += `<tr>
            <td style="text-align:center;font-weight:bold">${item.count}</td>
            <td style="text-align:left;font-weight:bold">&oslash;${r.diametro} a ${item.longitud.toFixed(2)}m</td>
            <td style="text-align:left;color:#888;font-size:8px">${item.etiquetas.join(", ")}</td>
          </tr>`;
        }

        recuento += `</tbody></table>`;
      }

      html += `
<div class="page">
<div class="header">
  <div>
    <h1>${el.nombre}</h1>
    <div style="font-size:11px;color:#555;">${catNombre}${subLabel ? ` &mdash; ${subLabel}` : ""}</div>
  </div>
  <div class="header-right">
    <div>${proyecto.nombre}</div>
    <div>Pag. ${pageNum} de ${totalPages}</div>
  </div>
</div>

<div class="element-content">
  <div class="element-left">
    ${svgDiagram}
    <div class="geo-info">${geoMeta}</div>
  </div>
  <div class="element-right">
    <h3>RESUMEN POR DIAMETRO</h3>
    ${diaTable}
    <h3 style="margin-top:8px;">MATERIAL A COMPRAR</h3>
    ${matEl}
  </div>
</div>

<h3 style="margin-top:8px;">RECUENTO DE PIEZAS A CORTAR</h3>
${recuento}

<div class="footer"><span>FERRAPP &mdash; ${proyecto.nombre} / ${el.nombre}</span><span>${fecha}</span></div>
</div>`;
    }

    html += `</body></html>`;

    // ── Imprimir via iframe oculto ──
    let iframe = document.getElementById("ferrapp-resumen-frame") as HTMLIFrameElement | null;
    if (!iframe) {
      iframe = document.createElement("iframe");
      iframe.id = "ferrapp-resumen-frame";
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "none";
      document.body.appendChild(iframe);
    }

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return;
    doc.open();
    doc.write(html);
    doc.close();

    setTimeout(() => {
      iframe!.contentWindow?.print();
    }, 500);
  };

  return (
    <button
      onClick={imprimir}
      className="flex items-center gap-2 bg-accent hover:bg-accent-dark text-black font-medium py-2 px-4 rounded-lg text-sm transition-colors"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/>
        <rect x="6" y="14" width="12" height="8"/>
      </svg>
      Imprimir resumen
    </button>
  );
}
