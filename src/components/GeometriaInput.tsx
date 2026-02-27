"use client";

import { useEffect } from "react";
import {
  CategoriaElemento,
  FormaElemento,
  GeometriaElemento,
  LadoGeometria,
} from "@/lib/types";
import { getTipoGeometria, getLadosForma, getLadosSuperficie, getNombresZonaSuperficie, getGeometriaDefault } from "@/lib/generadores";

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
      // Al cambiar a L: crear 6 lados perimetrales coherentes
      const prevLargo = g.lados[0]?.longitud || 10;
      const prevAncho = g.lados[1]?.longitud || 8;
      lados = [
        { nombre: nombres[0], longitud: prevLargo },                            // Superior (ancho total)
        { nombre: nombres[1], longitud: +(prevAncho * 0.5).toFixed(1) },        // Derecho (alto parcial)
        { nombre: nombres[2], longitud: +(prevLargo * 0.5).toFixed(1) },        // Entrante H
        { nombre: nombres[3], longitud: +(prevAncho * 0.5).toFixed(1) },        // Entrante V
        { nombre: nombres[4], longitud: +(prevLargo * 0.5).toFixed(1) },        // Inferior (ancho parcial)
        { nombre: nombres[5], longitud: prevAncho },                            // Izquierdo (alto total)
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

      {/* SUPERFICIE L: 6 lados perimetrales individuales */}
      {tipo === "superficie" && g.forma === "l" && (
        <div className="space-y-2">
          {/* Diagrama mini + inputs */}
          <div className="flex gap-3">
            {/* Mini diagrama L */}
            <svg viewBox="0 0 100 90" className="w-24 h-20 shrink-0 text-accent/40">
              <path d="M 5,5 L 95,5 L 95,40 L 50,40 L 50,85 L 5,85 Z"
                fill="none" stroke="currentColor" strokeWidth="2" />
              <text x="50" y="3" textAnchor="middle" fontSize="7" fill="#f59e0b">Sup</text>
              <text x="98" y="24" textAnchor="start" fontSize="7" fill="#f59e0b">Der</text>
              <text x="73" y="38" textAnchor="middle" fontSize="6" fill="#f59e0b">Ent.H</text>
              <text x="52" y="64" textAnchor="start" fontSize="6" fill="#f59e0b">Ent.V</text>
              <text x="28" y="88" textAnchor="middle" fontSize="7" fill="#f59e0b">Inf</text>
              <text x="3" y="48" textAnchor="end" fontSize="7" fill="#f59e0b" transform="rotate(-90,3,48)">Izq</text>
            </svg>
            {/* 6 inputs en grid 3x2 */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 flex-1">
              {g.lados.map((lado, idx) => (
                <div key={idx} className="flex items-center gap-1">
                  <label className="text-xs text-gray-400 w-16 shrink-0">{lado.nombre}:</label>
                  <input
                    type="number"
                    value={lado.longitud}
                    onChange={(e) => updateLado(idx, parseFloat(e.target.value) || 0)}
                    step={0.1}
                    min={0.1}
                    className="bg-surface-light border border-border rounded px-2 py-1 text-sm w-16 text-foreground focus:outline-none focus:border-accent"
                  />
                  <span className="text-xs text-gray-500">m</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SUPERFICIE rectangular/U: zonas agrupadas */}
      {tipo === "superficie" && g.forma !== "l" && (
        <div className="space-y-2">
          {getZonasSuperficie().map((zona, zIdx) => {
            const nombresZona = getNombresZonaSuperficie(g.forma);
            return (
              <div key={zIdx} className="flex items-center gap-3 flex-wrap">
                {nombresZona.length > 0 && (
                  <span className="text-[10px] font-bold text-accent/60 w-14">{nombresZona[zIdx]}</span>
                )}
                <div className="flex items-center gap-1">
                  <label className="text-xs text-gray-400">Largo:</label>
                  <input
                    type="number"
                    value={zona.largo.longitud}
                    onChange={(e) => updateLado(zona.idx, parseFloat(e.target.value) || 0)}
                    step={0.1}
                    min={0.1}
                    className="bg-surface-light border border-border rounded px-2 py-1 text-sm w-16 text-foreground focus:outline-none focus:border-accent"
                  />
                  <span className="text-xs text-gray-500">m</span>
                </div>
                <div className="flex items-center gap-1">
                  <label className="text-xs text-gray-400">Ancho:</label>
                  <input
                    type="number"
                    value={zona.ancho.longitud}
                    onChange={(e) => updateLado(zona.idx + 1, parseFloat(e.target.value) || 0)}
                    step={0.1}
                    min={0.1}
                    className="bg-surface-light border border-border rounded px-2 py-1 text-sm w-16 text-foreground focus:outline-none focus:border-accent"
                  />
                  <span className="text-xs text-gray-500">m</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MURO / LINEAL / PILAR / ESCALERA: lados normales */}
      {tipo !== "superficie" && (
        <div className="flex items-center gap-3 flex-wrap">
          {g.lados.map((lado, idx) => (
            <div key={idx} className="flex items-center gap-1">
              <label className="text-xs text-gray-400">{lado.nombre}:</label>
              <input
                type="number"
                value={lado.longitud}
                onChange={(e) => updateLado(idx, parseFloat(e.target.value) || 0)}
                step={0.1}
                min={0.1}
                className="bg-surface-light border border-border rounded px-2 py-1 text-sm w-16 text-foreground focus:outline-none focus:border-accent"
              />
              <span className="text-xs text-gray-500">m</span>
            </div>
          ))}

          {/* Alto (muros, pilares) */}
          {(tipo === "muro" || tipo === "pilar") && (
            <div className="flex items-center gap-1">
              <label className="text-xs text-gray-400">Alto:</label>
              <input
                type="number"
                value={g.alto || 3}
                onChange={(e) => updateField({ alto: parseFloat(e.target.value) || 0 })}
                step={0.1}
                min={0.1}
                className="bg-surface-light border border-border rounded px-2 py-1 text-sm w-16 text-foreground focus:outline-none focus:border-accent"
              />
              <span className="text-xs text-gray-500">m</span>
            </div>
          )}

          {/* Seccion (vigas, pilares) */}
          {(tipo === "lineal" || tipo === "pilar") && (
            <div className="flex items-center gap-1">
              <label className="text-xs text-gray-400">Seccion:</label>
              <input
                type="number"
                value={g.seccionAncho || 0.30}
                onChange={(e) => updateField({ seccionAncho: parseFloat(e.target.value) || 0 })}
                step={0.05}
                min={0.1}
                className="bg-surface-light border border-border rounded px-2 py-1 text-sm w-14 text-foreground focus:outline-none focus:border-accent"
              />
              <span className="text-xs text-gray-500">x</span>
              <input
                type="number"
                value={g.seccionAlto || 0.30}
                onChange={(e) => updateField({ seccionAlto: parseFloat(e.target.value) || 0 })}
                step={0.05}
                min={0.1}
                className="bg-surface-light border border-border rounded px-2 py-1 text-sm w-14 text-foreground focus:outline-none focus:border-accent"
              />
              <span className="text-xs text-gray-500">m</span>
            </div>
          )}
        </div>
      )}

      {/* Espaciado — comun a todos */}
      <div className="flex items-center gap-1">
        <label className="text-xs text-gray-400">Separacion:</label>
        <input
          type="number"
          value={Math.round((g.espaciado || 0.20) * 100)}
          onChange={(e) => updateField({ espaciado: (parseFloat(e.target.value) || 20) / 100 })}
          step={1}
          min={5}
          className="bg-surface-light border border-border rounded px-2 py-1 text-sm w-16 text-foreground focus:outline-none focus:border-accent"
        />
        <span className="text-xs text-gray-500">cm</span>
      </div>

      {/* Info preview — L con 6 lados */}
      {tipo === "superficie" && g.forma === "l" && g.lados.length >= 6 && (() => {
        const esp = g.espaciado || 0.20;
        const sup = g.lados[0].longitud, der = g.lados[1].longitud;
        const entV = g.lados[3].longitud, inf = g.lados[4].longitud;
        return (
          <div className="text-[10px] text-gray-600">
            <span>Zona sup: {sup}m x {Math.round(der / esp)}uds + {der}m x {Math.round(sup / esp)}uds</span>
            <span> | Zona inf: {inf}m x {Math.round(entV / esp)}uds + {entV}m x {Math.round(inf / esp)}uds</span>
            <span> (por capa)</span>
          </div>
        );
      })()}
      {/* Info preview — rectangular/U */}
      {tipo === "superficie" && g.forma !== "l" && g.lados.length >= 2 && (
        <div className="text-[10px] text-gray-600">
          {getZonasSuperficie().map((z, i) => {
            const esp = g.espaciado || 0.20;
            const cantL = Math.round(z.ancho.longitud / esp);
            const cantA = Math.round(z.largo.longitud / esp);
            const nombresZ = getNombresZonaSuperficie(g.forma);
            const prefix = nombresZ.length > 0 ? `${nombresZ[i]}: ` : "";
            return (
              <span key={i}>
                {i > 0 && " | "}
                {prefix}{z.largo.longitud}m x {cantL}uds + {z.ancho.longitud}m x {cantA}uds
              </span>
            );
          })}
          <span> (por capa)</span>
        </div>
      )}
      {tipo === "muro" && (
        <div className="text-[10px] text-gray-600">
          {g.lados.length} lado{g.lados.length > 1 ? "s" : ""}: {g.lados.map(l => `${l.nombre} ${l.longitud}m`).join(" + ")}
          {g.alto ? ` — Alto ${g.alto}m` : ""}
        </div>
      )}
    </div>
  );
}
