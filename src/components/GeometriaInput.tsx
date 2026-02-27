"use client";

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
    const lados: LadoGeometria[] = nombres.map((nombre, i) => ({
      nombre,
      longitud: g.lados[i]?.longitud || 5,
    }));
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

      {/* SUPERFICIE: zonas agrupadas */}
      {tipo === "superficie" && (
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

      {/* Info preview */}
      {tipo === "superficie" && g.lados.length >= 2 && (
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
