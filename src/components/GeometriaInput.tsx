"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  CategoriaElemento,
  FormaElemento,
  GeometriaElemento,
  LadoGeometria,
  Hueco,
  ConfigCaraMuro,
  DIAMETROS_DISPONIBLES,
} from "@/lib/types";
import NumInput from "./NumInput";
import { getTipoGeometria, getLadosForma, getLadosSuperficie, getNombresZonaSuperficie, getGeometriaDefault, resolverEtiquetaLado } from "@/lib/generadores";

// =============================================
// EditableLabel — click para editar la etiqueta
// =============================================
function EditableLabel({ label, onSave, className }: { label: string; onSave: (v: string) => void; className?: string }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(label);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setVal(label); }, [label]);
  useEffect(() => { if (editing) inputRef.current?.select(); }, [editing]);

  if (!editing) {
    return (
      <span
        onClick={() => setEditing(true)}
        title="Click para editar etiqueta"
        className={`cursor-pointer hover:bg-accent/20 rounded px-0.5 transition-colors ${className || ""}`}
      >
        {label}
      </span>
    );
  }

  return (
    <input
      ref={inputRef}
      value={val}
      onChange={(e) => setVal(e.target.value.slice(0, 6))}
      onBlur={() => { setEditing(false); onSave(val.trim()); }}
      onKeyDown={(e) => {
        if (e.key === "Enter") { setEditing(false); onSave(val.trim()); }
        if (e.key === "Escape") { setEditing(false); setVal(label); }
      }}
      className="bg-accent/20 border border-accent rounded px-1 text-xs font-bold text-accent w-10 text-center focus:outline-none"
      maxLength={6}
    />
  );
}

// =============================================
// SVG Interactivo — geometria grande con huecos
// =============================================
interface SVGInteractivoProps {
  geometria: GeometriaElemento;
  tipo: string;
  getEtiqueta: (idx: number) => string;
  onHuecoMove?: (idx: number, x: number, y: number) => void;
}

function GeometriaSVGInteractivo({ geometria, tipo, getEtiqueta, onHuecoMove }: SVGInteractivoProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const g = geometria;

  // Calcular dimensiones reales de la geometria
  const getDimensiones = useCallback((): { totalW: number; totalH: number } => {
    if (tipo === "superficie") {
      if (g.forma === "rectangular") {
        return { totalW: g.lados[0]?.longitud || 10, totalH: g.lados[1]?.longitud || 8 };
      }
      if (g.forma === "l" && g.lados.length >= 6) {
        // totalH = b + d (zonas apiladas: Derecho + Entrante V)
        const b = g.lados[1]?.longitud || 4;
        const d = g.lados[3]?.longitud || 4;
        return { totalW: g.lados[0]?.longitud || 10, totalH: b + d };
      }
      if (g.forma === "u") {
        const maxL = Math.max(...[0, 2, 4].map(i => g.lados[i]?.longitud || 5));
        const maxA = Math.max(...[1, 3, 5].map(i => g.lados[i]?.longitud || 5));
        return { totalW: maxL, totalH: maxA };
      }
    }
    if (tipo === "muro") {
      const totalL = g.lados.reduce((s, l) => s + l.longitud, 0);
      return { totalW: totalL, totalH: g.alto || 3 };
    }
    return { totalW: 10, totalH: 8 };
  }, [g, tipo]);

  const { totalW, totalH } = getDimensiones();

  // SVG layout
  const pad = 40;
  const svgW = 380, svgH = 260;
  const drawW = svgW - pad * 2, drawH = svgH - pad * 2;
  const scaleX = drawW / (totalW || 1);
  const scaleY = drawH / (totalH || 1);
  const scale = Math.min(scaleX, scaleY);
  const shapeW = totalW * scale, shapeH = totalH * scale;
  const offX = pad + (drawW - shapeW) / 2;
  const offY = pad + (drawH - shapeH) / 2;

  // Convertir metros a SVG
  const mToSvgX = (m: number) => offX + m * scale;
  const mToSvgY = (m: number) => offY + (totalH - m) * scale; // Y invertido

  // Convertir SVG a metros
  const svgToM = (svgX: number, svgY: number): { mx: number; my: number } => {
    const mx = Math.max(0, Math.min(totalW, (svgX - offX) / scale));
    const my = Math.max(0, Math.min(totalH, totalH - (svgY - offY) / scale));
    return { mx: +mx.toFixed(2), my: +my.toFixed(2) };
  };

  // Drag hueco
  const handlePointerDown = (idx: number) => (e: React.PointerEvent) => {
    e.preventDefault();
    setDragging(idx);
    (e.target as SVGElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (dragging === null || !svgRef.current || !onHuecoMove) return;
    const rect = svgRef.current.getBoundingClientRect();
    const svgX = (e.clientX - rect.left) / rect.width * svgW;
    const svgY = (e.clientY - rect.top) / rect.height * svgH;
    const { mx, my } = svgToM(svgX, svgY);
    onHuecoMove(dragging, mx, my);
  };

  const handlePointerUp = () => setDragging(null);

  // Click en area vacia para colocar ultimo hueco
  const handleSvgClick = (e: React.MouseEvent) => {
    if (!onHuecoMove || !svgRef.current || (g.huecos || []).length === 0) return;
    if ((e.target as SVGElement).closest("[data-hueco]")) return; // no si click en hueco
    const rect = svgRef.current.getBoundingClientRect();
    const svgX = (e.clientX - rect.left) / rect.width * svgW;
    const svgY = (e.clientY - rect.top) / rect.height * svgH;
    const { mx, my } = svgToM(svgX, svgY);
    const lastIdx = (g.huecos || []).length - 1;
    onHuecoMove(lastIdx, mx, my);
  };

  // Renderizar forma
  const renderForma = () => {
    const stroke = "#f59e0b";
    const fill = "rgba(245,158,11,0.05)";

    if (tipo === "superficie" && g.forma === "rectangular") {
      const x1 = offX, y1 = offY, w = shapeW, h = shapeH;
      const corners = [
        { x: x1, y: y1, n: 1 },
        { x: x1 + w, y: y1, n: 2 },
        { x: x1 + w, y: y1 + h, n: 3 },
        { x: x1, y: y1 + h, n: 4 },
      ];
      return (
        <>
          <rect x={x1} y={y1} width={w} height={h} fill={fill} stroke={stroke} strokeWidth="2" />
          {/* Labels en los lados */}
          <text x={x1 + w / 2} y={y1 - 6} textAnchor="middle" fontSize="12" fontWeight="bold" fill={stroke}>{getEtiqueta(0)} = {g.lados[0]?.longitud}m</text>
          <text x={x1 + w + 6} y={y1 + h / 2} textAnchor="start" fontSize="12" fontWeight="bold" fill={stroke} transform={`rotate(90,${x1 + w + 6},${y1 + h / 2})`}>{getEtiqueta(1)} = {g.lados[1]?.longitud}m</text>
          {/* Esquinas numeradas */}
          {corners.map(c => (
            <g key={c.n}>
              <circle cx={c.x} cy={c.y} r={8} fill="#1f2937" stroke={stroke} strokeWidth="1.5" />
              <text x={c.x} y={c.y + 3.5} textAnchor="middle" fontSize="9" fontWeight="bold" fill={stroke}>{c.n}</text>
            </g>
          ))}
        </>
      );
    }

    if (tipo === "superficie" && g.forma === "l" && g.lados.length >= 6) {
      const a = g.lados[0].longitud; // Superior (ancho total arriba)
      const b = g.lados[1].longitud; // Derecho (alto zona sup)
      const d = g.lados[3].longitud; // Entrante V (alto zona inf)
      const e = g.lados[4].longitud; // Inferior (ancho zona inf)
      const h = b + d; // altura total real = zona sup + zona inf
      const pts = [
        [0, h], [a, h], [a, d], [e, d], [e, 0], [0, 0], [0, h],
      ].map(([x, y]) => `${mToSvgX(x)},${mToSvgY(y)}`).join(" ");
      const zonaDivY = mToSvgY(d);
      // Esquinas numeradas: P1=top-left → P6=bottom-left (lado[i] va de P(i+1) a P(i+2))
      const corners = [
        { x: mToSvgX(0), y: mToSvgY(h), n: 1 },
        { x: mToSvgX(a), y: mToSvgY(h), n: 2 },
        { x: mToSvgX(a), y: mToSvgY(d), n: 3 },
        { x: mToSvgX(e), y: mToSvgY(d), n: 4 },
        { x: mToSvgX(e), y: mToSvgY(0), n: 5 },
        { x: mToSvgX(0), y: mToSvgY(0), n: 6 },
      ];
      return (
        <>
          <polygon points={pts} fill={fill} stroke={stroke} strokeWidth="2" />
          <line x1={mToSvgX(0)} y1={zonaDivY} x2={mToSvgX(e)} y2={zonaDivY} stroke={stroke} strokeWidth="0.5" strokeDasharray="4,3" opacity="0.3" />
          {/* Labels por lado */}
          <text x={mToSvgX(a / 2)} y={mToSvgY(h) - 6} textAnchor="middle" fontSize="11" fontWeight="bold" fill={stroke}>{getEtiqueta(0)}</text>
          <text x={mToSvgX(a) + 8} y={mToSvgY(d + b / 2)} textAnchor="start" fontSize="11" fontWeight="bold" fill={stroke}>{getEtiqueta(1)}</text>
          <text x={mToSvgX((a + e) / 2)} y={mToSvgY(d) + 14} textAnchor="middle" fontSize="11" fontWeight="bold" fill={stroke}>{getEtiqueta(2)}</text>
          <text x={mToSvgX(e) + 8} y={mToSvgY(d / 2)} textAnchor="start" fontSize="11" fontWeight="bold" fill={stroke}>{getEtiqueta(3)}</text>
          <text x={mToSvgX(e / 2)} y={mToSvgY(0) + 14} textAnchor="middle" fontSize="11" fontWeight="bold" fill={stroke}>{getEtiqueta(4)}</text>
          <text x={mToSvgX(0) - 8} y={mToSvgY(h / 2)} textAnchor="end" fontSize="11" fontWeight="bold" fill={stroke}>{getEtiqueta(5)}</text>
          {/* Esquinas numeradas */}
          {corners.map(c => (
            <g key={c.n}>
              <circle cx={c.x} cy={c.y} r={8} fill="#1f2937" stroke={stroke} strokeWidth="1.5" />
              <text x={c.x} y={c.y + 3.5} textAnchor="middle" fontSize="9" fontWeight="bold" fill={stroke}>{c.n}</text>
            </g>
          ))}
        </>
      );
    }

    if (tipo === "superficie" && g.forma === "u") {
      // U = 3 zonas: izq + centro + der
      const zonas = [];
      for (let i = 0; i < g.lados.length; i += 2) {
        zonas.push({ largo: g.lados[i]?.longitud || 5, ancho: g.lados[i + 1]?.longitud || 5 });
      }
      const centroW = zonas[1]?.largo || 5;
      const izqW = zonas[0]?.ancho || 3;
      const derW = zonas[2]?.ancho || 3;
      const uTotalW = izqW + centroW + derW;
      const wingH = zonas[0]?.largo || 5;
      const centroA = zonas[1]?.ancho || 5;
      const uTotalH = Math.max(wingH, centroA);
      const sc = Math.min(drawW / uTotalW, drawH / uTotalH);
      const oX = pad + (drawW - uTotalW * sc) / 2;
      const oY = pad + (drawH - uTotalH * sc) / 2;

      const pts = [
        [0, 0], [izqW, 0], [izqW, wingH - centroA], [izqW + centroW, wingH - centroA],
        [izqW + centroW, 0], [uTotalW, 0], [uTotalW, uTotalH],
        [0, uTotalH],
      ].map(([x, y]) => `${oX + x * sc},${oY + y * sc}`).join(" ");

      return (
        <>
          <polygon points={pts} fill={fill} stroke={stroke} strokeWidth="2" />
          {/* Dashed zone separators */}
          <line x1={oX + izqW * sc} y1={oY} x2={oX + izqW * sc} y2={oY + uTotalH * sc} stroke={stroke} strokeWidth="0.5" strokeDasharray="4,3" opacity="0.4" />
          <line x1={oX + (izqW + centroW) * sc} y1={oY} x2={oX + (izqW + centroW) * sc} y2={oY + uTotalH * sc} stroke={stroke} strokeWidth="0.5" strokeDasharray="4,3" opacity="0.4" />
          {/* Labels */}
          <text x={oX + izqW * sc / 2} y={oY - 6} textAnchor="middle" fontSize="10" fontWeight="bold" fill={stroke}>{getEtiqueta(1)}</text>
          <text x={oX - 6} y={oY + uTotalH * sc / 2} textAnchor="end" fontSize="10" fontWeight="bold" fill={stroke}>{getEtiqueta(0)}</text>
          <text x={oX + (izqW + centroW / 2) * sc} y={oY + uTotalH * sc + 14} textAnchor="middle" fontSize="10" fontWeight="bold" fill={stroke}>{getEtiqueta(2)}</text>
          <text x={oX + (izqW + centroW / 2) * sc} y={oY + (wingH - centroA) * sc - 4} textAnchor="middle" fontSize="10" fontWeight="bold" fill={stroke}>{getEtiqueta(3)}</text>
          <text x={oX + uTotalW * sc + 6} y={oY + uTotalH * sc / 2} textAnchor="start" fontSize="10" fontWeight="bold" fill={stroke}>{getEtiqueta(4)}</text>
          <text x={oX + (izqW + centroW + derW / 2) * sc} y={oY - 6} textAnchor="middle" fontSize="10" fontWeight="bold" fill={stroke}>{getEtiqueta(5)}</text>
          {/* Esquinas numeradas (8 puntos del U) */}
          {[
            { x: oX, y: oY, n: 1 },
            { x: oX + izqW * sc, y: oY, n: 2 },
            { x: oX + izqW * sc, y: oY + (wingH - centroA) * sc, n: 3 },
            { x: oX + (izqW + centroW) * sc, y: oY + (wingH - centroA) * sc, n: 4 },
            { x: oX + (izqW + centroW) * sc, y: oY, n: 5 },
            { x: oX + uTotalW * sc, y: oY, n: 6 },
            { x: oX + uTotalW * sc, y: oY + uTotalH * sc, n: 7 },
            { x: oX, y: oY + uTotalH * sc, n: 8 },
          ].map(c => (
            <g key={c.n}>
              <circle cx={c.x} cy={c.y} r={7} fill="#1f2937" stroke={stroke} strokeWidth="1.5" />
              <text x={c.x} y={c.y + 3.5} textAnchor="middle" fontSize="8" fontWeight="bold" fill={stroke}>{c.n}</text>
            </g>
          ))}
        </>
      );
    }

    if (tipo === "muro") {
      if (g.forma === "recto") {
        return (
          <>
            <rect x={offX} y={offY} width={shapeW} height={shapeH} fill={fill} stroke={stroke} strokeWidth="2" />
            <text x={offX + shapeW / 2} y={offY - 6} textAnchor="middle" fontSize="12" fontWeight="bold" fill={stroke}>{getEtiqueta(0)} = {g.lados[0]?.longitud}m</text>
          </>
        );
      }
      // Muro L, U, cerrado — polyline
      let cx = offX;
      const segments: { x1: number; y1: number; x2: number; y2: number; idx: number }[] = [];
      const directions = g.forma === "l" ? [0, -90] : g.forma === "u" ? [0, -90, 0] : [0, -90, 180, 90];
      let angle = 0;
      let px = offX, py = offY + shapeH;

      for (let i = 0; i < g.lados.length && i < directions.length; i++) {
        angle = directions[i];
        const len = g.lados[i].longitud * scale;
        const rad = (angle * Math.PI) / 180;
        const nx = px + Math.cos(rad) * len;
        const ny = py + Math.sin(rad) * len;
        segments.push({ x1: px, y1: py, x2: nx, y2: ny, idx: i });
        px = nx; py = ny;
      }

      return (
        <>
          {segments.map((s, i) => (
            <g key={i}>
              <line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={stroke} strokeWidth="3" />
              <text x={(s.x1 + s.x2) / 2 + (s.y2 !== s.y1 ? -12 : 0)} y={(s.y1 + s.y2) / 2 + (s.x2 !== s.x1 ? -8 : 0)} textAnchor="middle" fontSize="11" fontWeight="bold" fill={stroke}>{getEtiqueta(s.idx)}</text>
            </g>
          ))}
        </>
      );
    }

    return null;
  };

  // Renderizar huecos
  const renderHuecos = () => {
    if (!g.huecos || g.huecos.length === 0 || tipo !== "superficie") return null;

    return g.huecos.map((h, idx) => {
      const hx = h.x ?? totalW / 2;
      const hy = h.y ?? totalH / 2;
      const hw = h.largo * scale;
      const hh = h.ancho * scale;
      const sx = mToSvgX(hx) - hw / 2;
      const sy = mToSvgY(hy) - hh / 2;

      return (
        <g key={idx} data-hueco={idx}
          onPointerDown={handlePointerDown(idx)}
          style={{ cursor: dragging === idx ? "grabbing" : "grab" }}
        >
          <rect x={sx} y={sy} width={hw} height={hh}
            fill="rgba(239,68,68,0.15)" stroke="#ef4444" strokeWidth="1.5" strokeDasharray="4,2" rx="2"
          />
          <text x={sx + hw / 2} y={sy + hh / 2 + 4} textAnchor="middle" fontSize="9" fill="#ef4444" fontWeight="bold">{h.nombre}</text>
          <text x={sx + hw / 2} y={sy + hh / 2 + 14} textAnchor="middle" fontSize="8" fill="#ef4444" opacity="0.7">{h.largo}×{h.ancho}m</text>
        </g>
      );
    });
  };

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${svgW} ${svgH}`}
      className="w-full max-w-[400px] bg-surface-light/30 rounded-lg border border-border/30"
      onClick={handleSvgClick}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      {renderForma()}
      {renderHuecos()}
      {/* Ejes de referencia */}
      {tipo === "superficie" && g.huecos && g.huecos.length > 0 && (
        <>
          <text x={offX} y={offY + shapeH + 16} fontSize="8" fill="#666">0</text>
          <text x={offX + shapeW} y={offY + shapeH + 16} textAnchor="end" fontSize="8" fill="#666">{totalW}m</text>
          <text x={offX - 4} y={offY + shapeH} textAnchor="end" fontSize="8" fill="#666">0</text>
          <text x={offX - 4} y={offY + 4} textAnchor="end" fontSize="8" fill="#666">{totalH}m</text>
        </>
      )}
    </svg>
  );
}

// =============================================
// Componente principal
// =============================================
interface GeometriaInputProps {
  geometria: GeometriaElemento | undefined;
  categoria: CategoriaElemento;
  subtipo?: string;
  onGeometriaChange: (g: GeometriaElemento) => void;
  onGenerarBarras: () => void;
}

export default function GeometriaInput({
  geometria,
  categoria,
  subtipo,
  onGeometriaChange,
  onGenerarBarras,
}: GeometriaInputProps) {
  if (!geometria) {
    return (
      <div className="bg-surface rounded-xl border border-border/50 p-3 flex items-center justify-between">
        <span className="text-xs text-gray-500">Sin geometria definida</span>
        <button
          onClick={() => onGeometriaChange(getGeometriaDefault(subtipo || categoria, categoria))}
          className="bg-accent/20 hover:bg-accent/30 text-accent font-medium py-1 px-3 rounded-lg text-xs transition-colors"
        >
          Activar geometria
        </button>
      </div>
    );
  }

  const tipo = getTipoGeometria(categoria, subtipo);
  const g = geometria;

  // Migrar L antigua (4 lados) a nueva (6 lados perimetrales)
  useEffect(() => {
    if (g.forma === "l" && tipo === "superficie" && g.lados.length < 6) {
      const nombres = getLadosSuperficie("l");
      const prevLargo = g.lados[0]?.longitud || 10;
      const prevAncho = g.lados[1]?.longitud || 8;
      onGeometriaChange({
        ...g,
        lados: [
          { nombre: nombres[0], longitud: prevLargo },
          { nombre: nombres[1], longitud: +(prevAncho * 0.5).toFixed(1) },
          { nombre: nombres[2], longitud: +(prevLargo * 0.5).toFixed(1) },
          { nombre: nombres[3], longitud: +(prevAncho * 0.5).toFixed(1) },
          { nombre: nombres[4], longitud: +(prevLargo * 0.5).toFixed(1) },
          { nombre: nombres[5], longitud: prevAncho },
        ],
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [g.forma, g.lados.length]);

  const updateField = (field: Partial<GeometriaElemento>) => {
    onGeometriaChange({ ...g, ...field });
  };

  const updateLado = (idx: number, longitud: number) => {
    const nuevos = [...g.lados];
    nuevos[idx] = { ...nuevos[idx], longitud };
    onGeometriaChange({ ...g, lados: nuevos });
  };

  const updateLadoEtiqueta = (idx: number, etiqueta: string) => {
    const nuevos = [...g.lados];
    nuevos[idx] = { ...nuevos[idx], etiqueta: etiqueta || undefined };
    onGeometriaChange({ ...g, lados: nuevos });
  };

  // Etiqueta resuelta: custom o auto-letra
  const getEtiqueta = (idx: number) => resolverEtiquetaLado(g.lados[idx] || { nombre: "", longitud: 0 }, idx);

  // Gestion de huecos
  const addHueco = () => {
    const huecos = [...(g.huecos || [])];
    // Default al centro de la geometria
    let cx = 5, cy = 4;
    if (tipo === "superficie") {
      if (g.forma === "rectangular") {
        cx = (g.lados[0]?.longitud || 10) / 2;
        cy = (g.lados[1]?.longitud || 8) / 2;
      } else if (g.forma === "l" && g.lados.length >= 6) {
        cx = (g.lados[0]?.longitud || 10) / 2;
        cy = ((g.lados[1]?.longitud || 4) + (g.lados[3]?.longitud || 4)) / 2;
      }
    }
    huecos.push({ nombre: `Hueco ${huecos.length + 1}`, largo: 3, ancho: 1.2, x: +cx.toFixed(2), y: +cy.toFixed(2) });
    onGeometriaChange({ ...g, huecos });
  };
  const removeHueco = (idx: number) => {
    const huecos = [...(g.huecos || [])];
    huecos.splice(idx, 1);
    onGeometriaChange({ ...g, huecos });
  };
  const updateHueco = (idx: number, field: Partial<Hueco>) => {
    const huecos = [...(g.huecos || [])];
    huecos[idx] = { ...huecos[idx], ...field };
    onGeometriaChange({ ...g, huecos });
  };

  const esForjado = categoria === "forjado";

  // Cambiar forma para muros
  const cambiarFormaMuro = (forma: FormaElemento) => {
    const nombres = getLadosForma(forma);
    const lados: LadoGeometria[] = nombres.map((nombre, i) => ({
      nombre,
      longitud: g.lados[i]?.longitud || 5,
    }));
    onGeometriaChange({ ...g, forma, lados });
  };

  // Cambiar forma para superficies
  const cambiarFormaSuperficie = (forma: FormaElemento) => {
    const nombres = getLadosSuperficie(forma);
    let lados: LadoGeometria[];

    if (forma === "l" && g.forma !== "l") {
      const prevLargo = g.lados[0]?.longitud || 10;
      const prevAncho = g.lados[1]?.longitud || 8;
      lados = [
        { nombre: nombres[0], longitud: prevLargo },
        { nombre: nombres[1], longitud: +(prevAncho * 0.5).toFixed(1) },
        { nombre: nombres[2], longitud: +(prevLargo * 0.5).toFixed(1) },
        { nombre: nombres[3], longitud: +(prevAncho * 0.5).toFixed(1) },
        { nombre: nombres[4], longitud: +(prevLargo * 0.5).toFixed(1) },
        { nombre: nombres[5], longitud: prevAncho },
      ];
    } else {
      lados = nombres.map((nombre, i) => ({
        nombre,
        longitud: g.lados[i]?.longitud || 5,
      }));
    }
    onGeometriaChange({ ...g, forma, lados });
  };

  // Agrupar lados de superficie en zonas (pares de largo/ancho)
  const getZonasSuperficie = () => {
    const zonas: { largo: LadoGeometria; ancho: LadoGeometria; idx: number }[] = [];
    for (let i = 0; i < g.lados.length; i += 2) {
      zonas.push({
        largo: g.lados[i],
        ancho: g.lados[i + 1] || { nombre: "Ancho", longitud: 5 },
        idx: i,
      });
    }
    return zonas;
  };

  const formasSuperficie: { forma: FormaElemento; label: string }[] = [
    { forma: "rectangular", label: "□ Rect" },
    { forma: "l", label: "L" },
    { forma: "u", label: "U" },
  ];

  const formasMuro: { forma: FormaElemento; label: string }[] = [
    { forma: "recto", label: "━ Recto" },
    { forma: "l", label: "L" },
    { forma: "u", label: "U" },
    { forma: "cerrado", label: "□ Cerrado" },
  ];

  return (
    <div className="bg-surface rounded-xl border border-accent/20 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-accent uppercase tracking-wide">
          Geometria
        </h3>
        <button
          onClick={onGenerarBarras}
          className="bg-accent hover:bg-accent-dark text-black font-medium py-1 px-3 rounded-lg text-xs transition-colors"
        >
          Generar barras
        </button>
      </div>

      {/* SUPERFICIE: selector de forma */}
      {tipo === "superficie" && (
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-gray-400 mr-1">Forma:</label>
          {formasSuperficie.map(({ forma, label }) => (
            <button
              key={forma}
              onClick={() => cambiarFormaSuperficie(forma)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                g.forma === forma
                  ? "bg-accent text-black"
                  : "bg-surface-light text-gray-400 hover:text-foreground border border-border"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* MURO: selector de forma */}
      {tipo === "muro" && (
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-gray-400 mr-1">Forma:</label>
          {formasMuro.map(({ forma, label }) => (
            <button
              key={forma}
              onClick={() => cambiarFormaMuro(forma)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                g.forma === forma
                  ? "bg-accent text-black"
                  : "bg-surface-light text-gray-400 hover:text-foreground border border-border"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* ===== SVG INTERACTIVO + INPUTS ===== */}
      {(tipo === "superficie" || tipo === "muro") && (
        <div className="flex gap-3 flex-col sm:flex-row">
          {/* SVG grande */}
          <GeometriaSVGInteractivo
            geometria={g}
            tipo={tipo}
            getEtiqueta={getEtiqueta}
            onHuecoMove={(idx, x, y) => updateHueco(idx, { x, y })}
          />

          {/* Panel de inputs */}
          <div className="flex-1 space-y-2 min-w-0">
            {/* SUPERFICIE L: 6 lados */}
            {tipo === "superficie" && g.forma === "l" && (
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                {g.lados.map((lado, idx) => (
                  <div key={idx} className="flex items-center gap-1">
                    <EditableLabel
                      label={getEtiqueta(idx)}
                      onSave={(v) => updateLadoEtiqueta(idx, v)}
                      className="text-xs font-bold text-accent w-fit min-w-[12px]"
                    />
                    <label className="text-xs text-gray-400 shrink-0 truncate max-w-[50px]">{lado.nombre}:</label>
                    <NumInput
                      value={lado.longitud}
                      onChange={(v) => updateLado(idx, v)}
                      className="bg-surface-light border border-border rounded px-2 py-1 text-sm w-16 text-foreground focus:outline-none focus:border-accent"
                    />
                    <span className="text-xs text-gray-500">m</span>
                  </div>
                ))}
              </div>
            )}

            {/* SUPERFICIE U: zonas */}
            {tipo === "superficie" && g.forma === "u" && (
              <div className="space-y-1.5">
                {getZonasSuperficie().map((zona, zIdx) => {
                  const nombresZona = getNombresZonaSuperficie(g.forma);
                  return (
                    <div key={zIdx} className="flex items-center gap-2 flex-wrap">
                      {nombresZona.length > 0 && (
                        <span className="text-[10px] font-bold text-accent/60 w-10">{nombresZona[zIdx]}</span>
                      )}
                      <EditableLabel label={getEtiqueta(zona.idx)} onSave={(v) => updateLadoEtiqueta(zona.idx, v)} className="text-xs font-bold text-accent" />
                      <NumInput
                        value={zona.largo.longitud}
                        onChange={(v) => updateLado(zona.idx, v)}
                        className="bg-surface-light border border-border rounded px-2 py-1 text-sm w-14 text-foreground focus:outline-none focus:border-accent"
                      />
                      <span className="text-[10px] text-gray-500">×</span>
                      <EditableLabel label={getEtiqueta(zona.idx + 1)} onSave={(v) => updateLadoEtiqueta(zona.idx + 1, v)} className="text-xs font-bold text-accent" />
                      <NumInput
                        value={zona.ancho.longitud}
                        onChange={(v) => updateLado(zona.idx + 1, v)}
                        className="bg-surface-light border border-border rounded px-2 py-1 text-sm w-14 text-foreground focus:outline-none focus:border-accent"
                      />
                      <span className="text-xs text-gray-500">m</span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* SUPERFICIE rectangular: zonas */}
            {tipo === "superficie" && g.forma === "rectangular" && (
              <div className="space-y-2">
                {getZonasSuperficie().map((zona, zIdx) => {
                  const nombresZona = getNombresZonaSuperficie(g.forma);
                  return (
                    <div key={zIdx} className="flex items-center gap-3 flex-wrap">
                      {nombresZona.length > 0 && (
                        <span className="text-[10px] font-bold text-accent/60 w-14">{nombresZona[zIdx]}</span>
                      )}
                      <div className="flex items-center gap-1">
                        <EditableLabel label={getEtiqueta(zona.idx)} onSave={(v) => updateLadoEtiqueta(zona.idx, v)} className="text-xs font-bold text-accent" />
                        <label className="text-xs text-gray-400">Largo:</label>
                        <NumInput
                          value={zona.largo.longitud}
                          onChange={(v) => updateLado(zona.idx, v)}
                          className="bg-surface-light border border-border rounded px-2 py-1 text-sm w-16 text-foreground focus:outline-none focus:border-accent"
                        />
                        <span className="text-xs text-gray-500">m</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <EditableLabel label={getEtiqueta(zona.idx + 1)} onSave={(v) => updateLadoEtiqueta(zona.idx + 1, v)} className="text-xs font-bold text-accent" />
                        <label className="text-xs text-gray-400">Ancho:</label>
                        <NumInput
                          value={zona.ancho.longitud}
                          onChange={(v) => updateLado(zona.idx + 1, v)}
                          className="bg-surface-light border border-border rounded px-2 py-1 text-sm w-16 text-foreground focus:outline-none focus:border-accent"
                        />
                        <span className="text-xs text-gray-500">m</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* MURO: lados */}
            {tipo === "muro" && (
              <div className="flex items-center gap-3 flex-wrap">
                {g.lados.map((lado, idx) => (
                  <div key={idx} className="flex items-center gap-1">
                    <EditableLabel label={getEtiqueta(idx)} onSave={(v) => updateLadoEtiqueta(idx, v)} className="text-xs font-bold text-accent" />
                    <label className="text-xs text-gray-400">{lado.nombre}:</label>
                    <NumInput
                      value={lado.longitud}
                      onChange={(v) => updateLado(idx, v)}
                      className="bg-surface-light border border-border rounded px-2 py-1 text-sm w-16 text-foreground focus:outline-none focus:border-accent"
                    />
                    <span className="text-xs text-gray-500">m</span>
                  </div>
                ))}
                {/* Alto */}
                <div className="flex items-center gap-1">
                  <label className="text-xs text-gray-400">Alto:</label>
                  <NumInput
                    value={g.alto || 3}
                    onChange={(v) => updateField({ alto: v })}
                    className="bg-surface-light border border-border rounded px-2 py-1 text-sm w-16 text-foreground focus:outline-none focus:border-accent"
                  />
                  <span className="text-xs text-gray-500">m</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* LINEAL / PILAR / ESCALERA: lados normales (sin SVG grande) */}
      {tipo !== "superficie" && tipo !== "muro" && (
        <div className="flex items-center gap-3 flex-wrap">
          {g.lados.map((lado, idx) => (
            <div key={idx} className="flex items-center gap-1">
              <EditableLabel label={getEtiqueta(idx)} onSave={(v) => updateLadoEtiqueta(idx, v)} className="text-xs font-bold text-accent" />
              <label className="text-xs text-gray-400">{lado.nombre}:</label>
              <NumInput
                value={lado.longitud}
                onChange={(v) => updateLado(idx, v)}
                className="bg-surface-light border border-border rounded px-2 py-1 text-sm w-16 text-foreground focus:outline-none focus:border-accent"
              />
              <span className="text-xs text-gray-500">m</span>
            </div>
          ))}

          {/* Alto (pilares) */}
          {tipo === "pilar" && (
            <div className="flex items-center gap-1">
              <label className="text-xs text-gray-400">Alto:</label>
              <NumInput
                value={g.alto || 3}
                onChange={(v) => updateField({ alto: v })}
                className="bg-surface-light border border-border rounded px-2 py-1 text-sm w-16 text-foreground focus:outline-none focus:border-accent"
              />
              <span className="text-xs text-gray-500">m</span>
            </div>
          )}

          {/* Seccion (vigas, pilares) */}
          {(tipo === "lineal" || tipo === "pilar") && (
            <div className="flex items-center gap-1">
              <label className="text-xs text-gray-400">Seccion:</label>
              <NumInput
                value={g.seccionAncho || 0.30}
                onChange={(v) => updateField({ seccionAncho: v })}
                className="bg-surface-light border border-border rounded px-2 py-1 text-sm w-14 text-foreground focus:outline-none focus:border-accent"
              />
              <span className="text-xs text-gray-500">x</span>
              <NumInput
                value={g.seccionAlto || 0.30}
                onChange={(v) => updateField({ seccionAlto: v })}
                className="bg-surface-light border border-border rounded px-2 py-1 text-sm w-14 text-foreground focus:outline-none focus:border-accent"
              />
              <span className="text-xs text-gray-500">m</span>
            </div>
          )}
        </div>
      )}

      {/* Espaciado — comun a todos */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1">
          <label className="text-xs text-gray-400">Separacion:</label>
          <NumInput
            value={Math.round((g.espaciado || 0.20) * 100)}
            onChange={(v) => updateField({ espaciado: (v || 20) / 100 })}
            decimals={false}
            className="bg-surface-light border border-border rounded px-2 py-1 text-sm w-16 text-foreground focus:outline-none focus:border-accent"
          />
          <span className="text-xs text-gray-500">cm</span>
        </div>

        {/* Zuncho — forjados */}
        {esForjado && (
          <div className="flex items-center gap-1">
            <label className="text-xs text-gray-400">Zuncho:</label>
            <NumInput
              value={Math.round((g.anchoZuncho || 0.30) * 100)}
              onChange={(v) => updateField({ anchoZuncho: (v || 30) / 100 })}
              decimals={false}
              className="bg-surface-light border border-border rounded px-2 py-1 text-sm w-16 text-foreground focus:outline-none focus:border-accent"
            />
            <span className="text-xs text-gray-500">cm</span>
          </div>
        )}
      </div>

      {/* Armadura por cara — muros */}
      {tipo === "muro" && (() => {
        const defExt: ConfigCaraMuro = g.caraExterior || { diametroVertical: 12, diametroHorizontal: 10, espaciado: g.espaciado || 0.20 };
        const defInt: ConfigCaraMuro = g.caraInterior || { diametroVertical: 12, diametroHorizontal: 10, espaciado: g.espaciado || 0.20 };
        const dHorq = g.diametroHorquillas || 8;

        const updateCara = (cara: "caraExterior" | "caraInterior", field: keyof ConfigCaraMuro, value: number) => {
          const current = cara === "caraExterior" ? defExt : defInt;
          updateField({ [cara]: { ...current, [field]: value } });
        };

        const DiamSelect = ({ value, onChange }: { value: number; onChange: (v: number) => void }) => (
          <select
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            className="bg-surface-light border border-border rounded px-1.5 py-0.5 text-xs text-foreground focus:outline-none focus:border-accent w-14"
          >
            {DIAMETROS_DISPONIBLES.map((d) => (
              <option key={d} value={d}>Ø{d}</option>
            ))}
          </select>
        );

        return (
          <div className="bg-surface-light/50 border border-border rounded-lg p-3 space-y-2">
            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Armadura por cara</label>
            <div className="grid grid-cols-2 gap-3">
              {/* Cara exterior */}
              <div className="space-y-1">
                <span className="text-[10px] font-medium text-accent">Cara exterior</span>
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="text-[10px] text-gray-400">V:</span>
                  <DiamSelect value={defExt.diametroVertical} onChange={(v) => updateCara("caraExterior", "diametroVertical", v)} />
                  <span className="text-[10px] text-gray-400">H:</span>
                  <DiamSelect value={defExt.diametroHorizontal} onChange={(v) => updateCara("caraExterior", "diametroHorizontal", v)} />
                  <span className="text-[10px] text-gray-400">@</span>
                  <NumInput
                    value={Math.round(defExt.espaciado * 100)}
                    onChange={(v) => updateCara("caraExterior", "espaciado", (v || 20) / 100)}
                    decimals={false}
                    className="bg-surface-light border border-border rounded px-1.5 py-0.5 text-xs w-12 text-foreground focus:outline-none focus:border-accent"
                  />
                  <span className="text-[10px] text-gray-500">cm</span>
                </div>
              </div>
              {/* Cara interior */}
              <div className="space-y-1">
                <span className="text-[10px] font-medium text-blue-400">Cara interior</span>
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="text-[10px] text-gray-400">V:</span>
                  <DiamSelect value={defInt.diametroVertical} onChange={(v) => updateCara("caraInterior", "diametroVertical", v)} />
                  <span className="text-[10px] text-gray-400">H:</span>
                  <DiamSelect value={defInt.diametroHorizontal} onChange={(v) => updateCara("caraInterior", "diametroHorizontal", v)} />
                  <span className="text-[10px] text-gray-400">@</span>
                  <NumInput
                    value={Math.round(defInt.espaciado * 100)}
                    onChange={(v) => updateCara("caraInterior", "espaciado", (v || 20) / 100)}
                    decimals={false}
                    className="bg-surface-light border border-border rounded px-1.5 py-0.5 text-xs w-12 text-foreground focus:outline-none focus:border-accent"
                  />
                  <span className="text-[10px] text-gray-500">cm</span>
                </div>
              </div>
            </div>
            {/* Horquillas + Esperas */}
            <div className="flex items-center gap-4 pt-1">
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-gray-400">Horquillas:</span>
                <DiamSelect value={dHorq} onChange={(v) => updateField({ diametroHorquillas: v })} />
              </div>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={g.incluirEsperas || false}
                  onChange={(e) => updateField({ incluirEsperas: e.target.checked })}
                  className="accent-amber-500 w-3.5 h-3.5"
                />
                <span className="text-[10px] text-gray-400">Incluir esperas</span>
              </label>
            </div>
          </div>
        );
      })()}

      {/* Huecos — superficies */}
      {tipo === "superficie" && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Huecos</label>
            <button
              onClick={addHueco}
              className="text-[10px] text-accent hover:text-accent-dark font-medium"
            >
              + Añadir hueco
            </button>
          </div>
          {(g.huecos || []).length > 0 && (
            <div className="space-y-1.5">
              {(g.huecos || []).map((h, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-surface-light/50 rounded-lg px-2 py-1.5 flex-wrap">
                  <input
                    type="text"
                    value={h.nombre}
                    onChange={(e) => updateHueco(idx, { nombre: e.target.value })}
                    className="bg-transparent border-b border-border text-xs w-20 text-foreground focus:outline-none focus:border-accent"
                    placeholder="Nombre"
                  />
                  <div className="flex items-center gap-1">
                    <label className="text-[10px] text-gray-500">L:</label>
                    <NumInput
                      value={h.largo}
                      onChange={(v) => updateHueco(idx, { largo: v })}
                      className="bg-surface-light border border-border rounded px-1.5 py-0.5 text-xs w-14 text-foreground focus:outline-none focus:border-accent"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <label className="text-[10px] text-gray-500">A:</label>
                    <NumInput
                      value={h.ancho}
                      onChange={(v) => updateHueco(idx, { ancho: v })}
                      className="bg-surface-light border border-border rounded px-1.5 py-0.5 text-xs w-14 text-foreground focus:outline-none focus:border-accent"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <label className="text-[10px] text-gray-500">X:</label>
                    <NumInput
                      value={h.x ?? 0}
                      onChange={(v) => updateHueco(idx, { x: v })}
                      className="bg-surface-light border border-border rounded px-1.5 py-0.5 text-xs w-14 text-foreground focus:outline-none focus:border-accent"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <label className="text-[10px] text-gray-500">Y:</label>
                    <NumInput
                      value={h.y ?? 0}
                      onChange={(v) => updateHueco(idx, { y: v })}
                      className="bg-surface-light border border-border rounded px-1.5 py-0.5 text-xs w-14 text-foreground focus:outline-none focus:border-accent"
                    />
                  </div>
                  <span className="text-[10px] text-gray-500">m</span>
                  <button
                    onClick={() => removeHueco(idx)}
                    className="text-red-400 hover:text-red-300 text-xs ml-auto"
                  >
                    ×
                  </button>
                </div>
              ))}
              <p className="text-[9px] text-gray-500 italic">Click en el diagrama o arrastra los huecos para posicionarlos</p>
            </div>
          )}
        </div>
      )}

      {/* Info preview — superficies */}
      {tipo === "superficie" && (() => {
        const esp = g.espaciado || 0.20;
        const zw = g.anchoZuncho || 0;
        const huecos = g.huecos || [];

        let zonasInfo: string[] = [];
        if (g.forma === "l" && g.lados.length >= 6) {
          const a = g.lados[0].longitud, b = g.lados[1].longitud;
          const d = g.lados[3].longitud, e = g.lados[4].longitud;
          const nA = zw > 0 ? Math.max(a - 2 * zw, 0) : a;
          const nB = zw > 0 ? Math.max(b - 2 * zw, 0) : b;
          const nD = zw > 0 ? Math.max(d - 2 * zw, 0) : d;
          const nE = zw > 0 ? Math.max(e - 2 * zw, 0) : e;
          zonasInfo.push(`Sup: ${getEtiqueta(0)}=${a}m×${Math.round(nB / esp)}uds + ${getEtiqueta(1)}=${b}m×${Math.round(nA / esp)}uds`);
          zonasInfo.push(`Inf: ${getEtiqueta(4)}=${e}m×${Math.round(nD / esp)}uds + ${getEtiqueta(3)}=${d}m×${Math.round(nE / esp)}uds`);
        } else {
          const zonas = getZonasSuperficie();
          const nombresZ = getNombresZonaSuperficie(g.forma);
          for (let i = 0; i < zonas.length; i++) {
            const z = zonas[i];
            const netL = zw > 0 ? Math.max(z.largo.longitud - 2 * zw, 0) : z.largo.longitud;
            const netA = zw > 0 ? Math.max(z.ancho.longitud - 2 * zw, 0) : z.ancho.longitud;
            const cantL = Math.round(netA / esp);
            const cantA = Math.round(netL / esp);
            const prefix = nombresZ.length > 0 ? `${nombresZ[i]}: ` : "";
            const lL = getEtiqueta(z.idx), lA = getEtiqueta(z.idx + 1);
            zonasInfo.push(`${prefix}${lL}=${z.largo.longitud}m×${cantL}uds + ${lA}=${z.ancho.longitud}m×${cantA}uds`);
          }
        }

        const parts: string[] = [...zonasInfo];
        if (zw > 0) parts.push(`Zuncho: ${Math.round(zw * 100)}cm`);
        if (huecos.length > 0) {
          const hStr = huecos.map(h => {
            const pos = (h.x !== undefined && h.y !== undefined) ? ` @(${h.x},${h.y})` : "";
            return `${h.nombre} ${h.largo}×${h.ancho}m${pos}`;
          }).join(", ");
          parts.push(`Huecos: ${hStr}`);
        }

        return (
          <div className="text-[10px] text-gray-600">
            {parts.join(" | ")} <span>(por capa)</span>
          </div>
        );
      })()}
      {/* Info preview — muro */}
      {tipo === "muro" && (
        <div className="text-[10px] text-gray-600">
          {g.lados.map((l, i) => `${getEtiqueta(i)}=${l.longitud}m`).join(" + ")}
          {g.alto ? ` — Alto ${g.alto}m` : ""}
        </div>
      )}
      {/* Info preview — lineal */}
      {tipo === "lineal" && (
        <div className="text-[10px] text-gray-600">
          {g.lados.map((l, i) => `${getEtiqueta(i)}=${l.longitud}m`).join(" + ")}
          {g.seccionAncho && g.seccionAlto ? ` — Seccion ${g.seccionAncho}×${g.seccionAlto}m` : ""}
        </div>
      )}
      {/* Info preview — pilar */}
      {tipo === "pilar" && (
        <div className="text-[10px] text-gray-600">
          {g.lados.map((l, i) => `${getEtiqueta(i)}=${l.longitud}m`).join(", ")}
          {g.alto ? ` — Alto ${g.alto}m` : ""}
          {g.seccionAncho && g.seccionAlto ? ` — Seccion ${g.seccionAncho}×${g.seccionAlto}m` : ""}
        </div>
      )}
    </div>
  );
}
