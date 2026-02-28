"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import {
  BarraNecesaria,
  ConfigConstruccion,
  ElementoEstructural,
  Proyecto,
  Sobrante,
  ResultadoDespieceExtendido,
  CATEGORIAS_INFO,
  SOLAPES_ESTANDAR,
} from "@/lib/types";
import { optimizarCortes } from "@/lib/optimizador";
import { getProyecto, guardarProyecto, crearElemento, crearBarraInicial } from "@/lib/storage";
import BarraInput from "@/components/BarraInput";
import ResultadoCortes from "@/components/ResultadoCortes";
import VistaImpresion from "@/components/VistaImpresion";
import ResumenImpresion from "@/components/ResumenImpresion";
import SelectorElemento from "@/components/SelectorElemento";
import GeometriaInput from "@/components/GeometriaInput";
import { generarBarrasDesdeGeometria, getGeometriaDefault, getTipoGeometria } from "@/lib/generadores";

function generarId() {
  return Math.random().toString(36).substring(2, 9);
}

export default function ObraPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [proyecto, setProyecto] = useState<Proyecto | null>(null);
  const [elementoActivo, setElementoActivo] = useState(0);
  const [resultados, setResultados] = useState<Map<string, ResultadoDespieceExtendido>>(new Map());
  const [usarSobrantes, setUsarSobrantes] = useState(true);
  const [tab, setTab] = useState<"despiece" | "resumen">("despiece");
  const [mostrarSelector, setMostrarSelector] = useState(false);
  const [sidebarBoton, setSidebarBoton] = useState(false);   // abierto por boton
  const [sidebarHover, setSidebarHover] = useState(false);    // abierto por hover
  const sidebarAbierto = sidebarBoton || sidebarHover;

  useEffect(() => {
    const p = getProyecto(id);
    if (p) {
      setProyecto(p);
    } else {
      router.push("/");
    }
  }, [id, router]);

  // Auto-save
  useEffect(() => {
    if (proyecto) {
      guardarProyecto(proyecto);
    }
  }, [proyecto]);

  if (!proyecto) return <div className="min-h-screen bg-background flex items-center justify-center text-gray-400">Cargando...</div>;

  const config: ConfigConstruccion = proyecto.config;
  const elemento = proyecto.elementos[elementoActivo];

  const getSobrantesDisponibles = (): Sobrante[] => {
    if (!usarSobrantes) return [];
    const sobrantes: Sobrante[] = [];
    for (let i = 0; i < elementoActivo; i++) {
      const el = proyecto.elementos[i];
      if (el.calculado) {
        const res = resultados.get(el.id);
        if (res) {
          sobrantes.push(...res.sobrantesNuevos.filter((s) => !s.usado));
        }
      }
    }
    return sobrantes;
  };

  const actualizarElemento = (elem: ElementoEstructural) => {
    const nuevos = [...proyecto.elementos];
    nuevos[elementoActivo] = elem;
    setProyecto({ ...proyecto, elementos: nuevos });
  };

  const agregarElemento = (nombre: string, subtipo?: string) => {
    const nuevo = crearElemento(nombre, subtipo);
    setProyecto({ ...proyecto, elementos: [...proyecto.elementos, nuevo] });
    setElementoActivo(proyecto.elementos.length);
    setMostrarSelector(false);
  };

  const eliminarElemento = (idx: number) => {
    if (proyecto.elementos.length === 1) return;
    const nuevos = proyecto.elementos.filter((_, i) => i !== idx);
    const nuevosResultados = new Map(resultados);
    nuevosResultados.delete(proyecto.elementos[idx].id);
    setResultados(nuevosResultados);
    setProyecto({ ...proyecto, elementos: nuevos });
    setElementoActivo(Math.min(elementoActivo, nuevos.length - 1));
  };

  const agregarBarra = () => {
    actualizarElemento({
      ...elemento,
      barrasNecesarias: [crearBarraInicial(), ...elemento.barrasNecesarias],
    });
  };

  const actualizarBarra = (idx: number, barra: BarraNecesaria) => {
    const nuevas = [...elemento.barrasNecesarias];
    nuevas[idx] = barra;
    actualizarElemento({ ...elemento, barrasNecesarias: nuevas });
  };

  const eliminarBarra = (idx: number) => {
    if (elemento.barrasNecesarias.length === 1) return;
    actualizarElemento({
      ...elemento,
      barrasNecesarias: elemento.barrasNecesarias.filter((_, i) => i !== idx),
    });
  };

  const calcular = () => {
    const barrasValidas = elemento.barrasNecesarias.filter((b) => b.longitud > 0 && b.cantidad > 0);
    if (barrasValidas.length === 0) return;

    const barrasConEtiqueta = barrasValidas.map((b, i) => ({
      ...b,
      etiqueta: b.etiqueta || `${elemento.nombre} - Pieza ${i + 1}`,
    }));

    const sobrantesDisp = getSobrantesDisponibles();
    const res = optimizarCortes(barrasConEtiqueta, config, sobrantesDisp);

    const nuevosResultados = new Map(resultados);
    nuevosResultados.set(elemento.id, res);
    setResultados(nuevosResultados);

    actualizarElemento({
      ...elemento,
      calculado: true,
      sobrantesGenerados: res.sobrantesNuevos,
      sobrantesConsumidos: res.sobrantesUsados.map((s) => s.id),
    });
  };

  // Calcular todos secuencialmente
  const calcularTodos = () => {
    const nuevosResultados = new Map<string, ResultadoDespieceExtendido>();

    for (let i = 0; i < proyecto.elementos.length; i++) {
      const el = proyecto.elementos[i];
      const barrasValidas = el.barrasNecesarias.filter((b) => b.longitud > 0 && b.cantidad > 0);
      if (barrasValidas.length === 0) continue;

      const barrasConEtiqueta = barrasValidas.map((b, idx) => ({
        ...b,
        etiqueta: b.etiqueta || `${el.nombre} - Pieza ${idx + 1}`,
      }));

      // Sobrantes de elementos anteriores
      const sobrantesDisp: Sobrante[] = [];
      if (usarSobrantes) {
        for (let j = 0; j < i; j++) {
          const resAnterior = nuevosResultados.get(proyecto.elementos[j].id);
          if (resAnterior) {
            sobrantesDisp.push(...resAnterior.sobrantesNuevos.filter((s) => !s.usado));
          }
        }
      }

      const res = optimizarCortes(barrasConEtiqueta, config, sobrantesDisp);
      nuevosResultados.set(el.id, res);

      // Actualizar elemento
      proyecto.elementos[i] = {
        ...el,
        calculado: true,
        sobrantesGenerados: res.sobrantesNuevos,
        sobrantesConsumidos: res.sobrantesUsados.map((s) => s.id),
      };
    }

    setResultados(nuevosResultados);
    setProyecto({ ...proyecto });
  };

  // Recalcular todos los elementos con una nueva config (para cambio de barras 6m/12m)
  const recalcularConConfig = (nuevaConfig: ConfigConstruccion) => {
    const nuevosResultados = new Map<string, ResultadoDespieceExtendido>();
    const elementosActualizados = [...proyecto.elementos];

    for (let i = 0; i < elementosActualizados.length; i++) {
      const el = elementosActualizados[i];
      const barrasValidas = el.barrasNecesarias.filter((b) => b.longitud > 0 && b.cantidad > 0);
      if (barrasValidas.length === 0) continue;

      const barrasConEtiqueta = barrasValidas.map((b, idx) => ({
        ...b,
        etiqueta: b.etiqueta || `${el.nombre} - Pieza ${idx + 1}`,
      }));

      // Sobrantes de elementos anteriores
      const sobrantesDisp: Sobrante[] = [];
      if (usarSobrantes) {
        for (let j = 0; j < i; j++) {
          const resAnterior = nuevosResultados.get(elementosActualizados[j].id);
          if (resAnterior) {
            sobrantesDisp.push(...resAnterior.sobrantesNuevos.filter((s) => !s.usado));
          }
        }
      }

      const res = optimizarCortes(barrasConEtiqueta, nuevaConfig, sobrantesDisp);
      nuevosResultados.set(el.id, res);

      elementosActualizados[i] = {
        ...el,
        calculado: true,
        sobrantesGenerados: res.sobrantesNuevos,
        sobrantesConsumidos: res.sobrantesUsados.map((s) => s.id),
      };
    }

    setResultados(nuevosResultados);
    setProyecto({ ...proyecto, elementos: elementosActualizados, config: nuevaConfig });
  };

  const resumenGlobal = () => {
    let barrasTotal = 0;
    let pesoTotal = 0;
    let desperdicioTotal = 0;
    let metrosCompra = 0;
    let sobrantesDisponibles = 0;
    let barrasAhorradas = 0;
    const barrasPorLongitud = new Map<number, number>();

    for (const [, res] of resultados) {
      for (const r of res.resultadosPorDiametro) {
        barrasTotal += r.totalBarrasComerciales;
        // Sumar metros reales de cada barra comercial
        for (const bc of r.barrasComerciales) {
          if (bc.id > 0) {
            metrosCompra += bc.longitudTotal;
            barrasPorLongitud.set(bc.longitudTotal, (barrasPorLongitud.get(bc.longitudTotal) || 0) + 1);
          }
        }
      }
      pesoTotal += res.pesoTotal;
      desperdicioTotal += res.desperdicioTotal;
      sobrantesDisponibles += res.sobrantesNuevos.filter((s) => !s.usado).length;
      barrasAhorradas += res.barrasComercialAhorradas;
    }

    const barrasTexto = [...barrasPorLongitud.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([L, n]) => `${n} de ${L}m`)
      .join(" + ");

    return { barrasTotal, pesoTotal, desperdicioTotal, metrosCompra, sobrantesDisponibles, barrasAhorradas, barrasTexto, barrasPorLongitud };
  };

  const global = resumenGlobal();
  const resultado = resultados.get(elemento?.id || "");

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <div className="bg-surface border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => { setSidebarBoton(!sidebarBoton); setSidebarHover(false); }}
            className={`text-gray-400 hover:text-accent transition-colors p-1 ${sidebarAbierto ? "text-accent" : ""}`}
            title={sidebarAbierto ? "Ocultar panel" : "Mostrar panel"}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="5" x2="17" y2="5" />
              <line x1="3" y1="10" x2="17" y2="10" />
              <line x1="3" y1="15" x2="17" y2="15" />
            </svg>
          </button>
          <button
            onClick={() => router.push("/")}
            className="text-gray-400 hover:text-accent transition-colors text-sm"
          >
            &larr; Mis obras
          </button>
          <h1 className="text-xl font-bold text-accent">FERRAPP</h1>
          <span className="text-gray-500">|</span>
          <input
            type="text"
            value={proyecto.nombre}
            onChange={(e) => setProyecto({ ...proyecto, nombre: e.target.value })}
            className="bg-transparent border-none text-foreground font-medium focus:outline-none text-lg"
          />
        </div>
        <div className="flex items-center gap-3">
          {/* Tabs */}
          <div className="flex bg-surface-light rounded-lg p-0.5">
            <button
              onClick={() => setTab("despiece")}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                tab === "despiece" ? "bg-accent text-black" : "text-gray-400 hover:text-foreground"
              }`}
            >
              Despiece
            </button>
            <button
              onClick={() => setTab("resumen")}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                tab === "resumen" ? "bg-accent text-black" : "text-gray-400 hover:text-foreground"
              }`}
            >
              Resumen
            </button>
          </div>
          <button
            onClick={calcularTodos}
            className="bg-accent hover:bg-accent-dark text-black font-medium py-1.5 px-4 rounded-lg text-sm transition-colors"
          >
            Calcular todo
          </button>
        </div>
      </div>

      {tab === "resumen" ? (
        /* TAB RESUMEN — Vista previa por zonas */
        <div className="h-[calc(100vh-57px)] overflow-y-auto">
          {resultados.size > 0 ? (
            <ResumenImpresion
              proyecto={proyecto}
              resultados={resultados}
              longitudBarraComercial={config.longitudBarraComercial}
            />
          ) : (
            <div className="text-center py-20 text-gray-500">
              <p className="text-lg mb-2">No hay resultados todavia</p>
              <p className="text-sm">Calcula los elementos para ver el resumen</p>
            </div>
          )}
        </div>
      ) : (
        /* TAB DESPIECE */
        <div className="flex h-[calc(100vh-57px)] relative overflow-hidden">
          {/* Zona hover izquierda para abrir sidebar */}
          {!sidebarAbierto && (
            <div
              className="absolute left-0 top-0 bottom-0 w-3 z-20 cursor-pointer hover:bg-accent/10 transition-colors"
              onMouseEnter={() => setSidebarHover(true)}
            />
          )}

          {/* Backdrop — click para cerrar (solo cuando abierto por boton) */}
          {sidebarBoton && (
            <div
              className="absolute inset-0 z-20"
              onClick={() => setSidebarBoton(false)}
            />
          )}

          {/* Sidebar de elementos */}
          <div
            className={`bg-surface border-r border-border p-4 overflow-y-auto w-64 shrink-0 absolute left-0 top-0 bottom-0 z-30 transition-transform duration-300 ${
              sidebarAbierto ? "translate-x-0 shadow-2xl shadow-black/30" : "-translate-x-full"
            }`}
            onMouseLeave={() => setSidebarHover(false)}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">Elementos</h2>
              <button
                onClick={() => setMostrarSelector(true)}
                className="bg-accent hover:bg-accent-dark text-black font-bold w-7 h-7 rounded text-sm transition-colors"
              >
                +
              </button>
            </div>

            <div className="space-y-1 mb-4">
              {proyecto.elementos.map((el, idx) => (
                <div
                  key={el.id}
                  className={`flex items-center gap-2 p-2.5 rounded-lg cursor-pointer transition-colors ${
                    idx === elementoActivo
                      ? "bg-accent/20 border border-accent/40"
                      : "hover:bg-surface-light border border-transparent"
                  }`}
                  onClick={() => setElementoActivo(idx)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      {el.categoria && el.categoria !== "libre" && (
                        <span className="text-[10px] font-bold bg-accent/20 text-accent px-1.5 py-0.5 rounded leading-none shrink-0">
                          {CATEGORIAS_INFO[el.categoria]?.icono || ""}
                        </span>
                      )}
                      <div className="text-sm font-medium truncate">{el.nombre}</div>
                    </div>
                    <div className="text-xs text-gray-500">
                      {el.calculado ? (
                        <>
                          <span className="text-success">OK</span>
                          {resultados.get(el.id) && (
                            <span className="ml-1">{resultados.get(el.id)!.pesoTotal.toFixed(0)} kg</span>
                          )}
                        </>
                      ) : (
                        <span>Pendiente</span>
                      )}
                    </div>
                  </div>
                  {proyecto.elementos.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        eliminarElemento(idx);
                      }}
                      className="text-gray-600 hover:text-danger text-xs p-1 opacity-0 group-hover:opacity-100"
                    >
                      X
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Config */}
            <div className="border-t border-border pt-4 space-y-3">
              <div>
                <label className="text-xs text-gray-400 block mb-1.5">Barras disponibles:</label>
                <div className="flex gap-2">
                  {[6, 12].map((L) => {
                    const activas = config.longitudesDisponibles || [config.longitudBarraComercial];
                    const activo = activas.includes(L);
                    return (
                      <label key={L} className="flex items-center gap-1.5 text-xs text-gray-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={activo}
                          onChange={() => {
                            let nuevas: number[];
                            if (activo) {
                              nuevas = activas.filter((x) => x !== L);
                              if (nuevas.length === 0) nuevas = [L]; // al menos una
                            } else {
                              nuevas = [...activas, L].sort((a, b) => a - b);
                            }
                            const nuevaConfig: ConfigConstruccion = {
                              ...config,
                              longitudesDisponibles: nuevas,
                              longitudBarraComercial: Math.max(...nuevas),
                            };
                            // Auto-recalcular si hay elementos ya calculados
                            const hayCalculados = proyecto.elementos.some((el) => el.calculado);
                            if (hayCalculados) {
                              recalcularConConfig(nuevaConfig);
                            } else {
                              setProyecto({
                                ...proyecto,
                                config: nuevaConfig,
                              });
                            }
                          }}
                          className="rounded border-border accent-accent"
                        />
                        {L}m
                      </label>
                    );
                  })}
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={usarSobrantes}
                  onChange={(e) => setUsarSobrantes(e.target.checked)}
                  className="rounded border-border accent-accent"
                />
                Reutilizar sobrantes
              </label>
            </div>

            {/* Sobrantes disponibles */}
            {elementoActivo > 0 && usarSobrantes && (
              <div className="border-t border-border pt-4 mt-4">
                <h3 className="text-xs font-semibold text-green-400 mb-2 uppercase">Sobrantes disponibles</h3>
                {(() => {
                  const sobrantes = getSobrantesDisponibles();
                  if (sobrantes.length === 0) {
                    return <p className="text-xs text-gray-600">Calcula elementos anteriores</p>;
                  }
                  const porDiam = new Map<number, { count: number; metros: number }>();
                  for (const s of sobrantes) {
                    const g = porDiam.get(s.diametro) || { count: 0, metros: 0 };
                    g.count++;
                    g.metros += s.longitud;
                    porDiam.set(s.diametro, g);
                  }
                  return (
                    <div className="space-y-1">
                      {[...porDiam.entries()].sort((a, b) => a[0] - b[0]).map(([d, g]) => (
                        <div key={d} className="flex justify-between text-xs">
                          <span className="text-gray-300">d{d}: {g.count} trozos</span>
                          <span className="text-green-400">{g.metros.toFixed(1)}m</span>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          {/* Main content */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-5xl mx-auto space-y-4">
              {/* Elemento header */}
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={elemento.nombre}
                      onChange={(e) => actualizarElemento({ ...elemento, nombre: e.target.value })}
                      className="bg-surface border border-border rounded-lg px-3 py-2 text-xl font-bold text-foreground flex-1 focus:outline-none focus:border-accent"
                    />
                    <select
                      value={elemento.categoria || "libre"}
                      onChange={(e) => {
                        const cat = e.target.value as import("@/lib/types").CategoriaElemento;
                        const geo = getGeometriaDefault(elemento.subtipo || cat, cat);
                        actualizarElemento({ ...elemento, categoria: cat, geometria: geo });
                      }}
                      className="bg-surface border border-border rounded-lg px-2 py-2 text-sm text-gray-400 focus:outline-none focus:border-accent shrink-0"
                    >
                      {(Object.entries(CATEGORIAS_INFO) as [import("@/lib/types").CategoriaElemento, { nombre: string; icono: string }][]).map(([cat, info]) => (
                        <option key={cat} value={cat}>{info.nombre}</option>
                      ))}
                      <option value="libre">Libre</option>
                    </select>
                  </div>
                  {elemento.subtipo && (
                    <div className="text-xs text-gray-600 mt-1 px-1">Plantilla aplicada</div>
                  )}
                </div>
                <span className="text-sm text-gray-500 whitespace-nowrap">
                  {elementoActivo + 1} / {proyecto.elementos.length}
                </span>
              </div>

              {/* Geometria */}
              <GeometriaInput
                geometria={elemento.geometria}
                categoria={elemento.categoria || "libre"}
                subtipo={elemento.subtipo}
                onGeometriaChange={(g) => actualizarElemento({ ...elemento, geometria: g, calculado: false })}
                onGenerarBarras={() => {
                  if (!elemento.geometria) return;
                  const barras = generarBarrasDesdeGeometria(
                    elemento.geometria,
                    elemento.categoria || "libre",
                    elemento.subtipo
                  );
                  actualizarElemento({
                    ...elemento,
                    barrasNecesarias: barras.map((b) => ({ ...b, id: generarId() })),
                    calculado: false,
                  });
                }}
              />

              {/* Recuento de esperas — solo muros con toggle activo */}
              {(() => {
                const g = elemento.geometria;
                if (!g || !g.incluirEsperas) return null;
                const tipoGeo = getTipoGeometria(elemento.categoria || "libre", elemento.subtipo);
                if (tipoGeo !== "muro") return null;

                const espGlobal = g.espaciado || 0.20;
                const ext = g.caraExterior || { diametroVertical: 12, diametroHorizontal: 10, espaciado: espGlobal };
                const int = g.caraInterior || { diametroVertical: 12, diametroHorizontal: 10, espaciado: espGlobal };

                let totalExt = 0, totalInt = 0;
                for (const lado of g.lados) {
                  totalExt += Math.round(lado.longitud / ext.espaciado);
                  totalInt += Math.round(lado.longitud / int.espaciado);
                }

                const solExt = SOLAPES_ESTANDAR[ext.diametroVertical] || 0.50;
                const solInt = SOLAPES_ESTANDAR[int.diametroVertical] || 0.50;

                return (
                  <div className="bg-amber-900/20 border border-amber-700/30 rounded-lg p-3">
                    <h3 className="text-xs font-semibold text-amber-400 uppercase tracking-wide mb-1.5">
                      Esperas (recuento para losa/cimentacion)
                    </h3>
                    <div className="flex gap-6 text-xs text-gray-300">
                      <div>
                        <span className="text-amber-400 font-medium">Ext:</span>{" "}
                        {totalExt} uds. Ø{ext.diametroVertical} × {solExt}m
                      </div>
                      <div>
                        <span className="text-blue-400 font-medium">Int:</span>{" "}
                        {totalInt} uds. Ø{int.diametroVertical} × {solInt}m
                      </div>
                      <div className="text-gray-400">
                        Total: {totalExt + totalInt} esperas
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Sobrantes reutilizados */}
              {resultado && resultado.sobrantesUsados.length > 0 && (
                <div className="bg-green-900/20 border border-green-700/30 rounded-lg p-3">
                  <span className="text-sm text-green-400 font-medium">
                    Se reutilizaron {resultado.sobrantesUsados.length} sobrantes
                    {resultado.barrasComercialAhorradas > 0 && (
                      <span> — ~{resultado.barrasComercialAhorradas} barras ahorradas</span>
                    )}
                  </span>
                </div>
              )}

              {/* Barras */}
              <div className="bg-surface rounded-xl border border-border p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">
                    Barras necesarias ({elemento.barrasNecesarias.reduce((s, b) => s + b.cantidad, 0)} piezas)
                  </h2>
                  <button
                    onClick={agregarBarra}
                    className="bg-accent hover:bg-accent-dark text-black font-medium py-1.5 px-4 rounded-lg text-sm transition-colors"
                  >
                    + Agregar
                  </button>
                </div>
                <div className="space-y-2">
                  {elemento.barrasNecesarias.map((barra, idx) => (
                    <BarraInput
                      key={barra.id}
                      barra={barra}
                      longitudMax={config.longitudBarraComercial}
                      solapeActual={config.solape[barra.diametro] || 0.50}
                      categoria={elemento.categoria || "libre"}
                      onSolapeChange={(diametro, valor) => {
                        setProyecto({
                          ...proyecto,
                          config: {
                            ...config,
                            solape: { ...config.solape, [diametro]: valor },
                          },
                        });
                      }}
                      onChange={(b) => actualizarBarra(idx, b)}
                      onDelete={() => eliminarBarra(idx)}
                    />
                  ))}
                </div>
              </div>

              <button
                onClick={calcular}
                className="w-full bg-accent hover:bg-accent-dark text-black font-bold py-3 px-6 rounded-xl text-lg transition-colors shadow-lg shadow-accent/20"
              >
                OPTIMIZAR CORTES
                {usarSobrantes && elementoActivo > 0 && " (con sobrantes)"}
              </button>

              {resultado && (
                <>
                  <div className="flex gap-2">
                    <VistaImpresion
                      resultado={resultado}
                      longitudBarraComercial={config.longitudBarraComercial}
                      nombreElemento={elemento.nombre}
                      nombreProyecto={proyecto.nombre}
                      geometria={elemento.geometria}
                      categoria={elemento.categoria}
                      subtipo={elemento.subtipo}
                    />
                  </div>
                  <ResultadoCortes
                    resultado={resultado}
                    longitudBarraComercial={config.longitudBarraComercial}
                  />
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal selector de elemento */}
      {mostrarSelector && (
        <SelectorElemento
          onSelect={agregarElemento}
          onClose={() => setMostrarSelector(false)}
        />
      )}
    </div>
  );
}
