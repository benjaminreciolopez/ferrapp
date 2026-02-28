"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Proyecto } from "@/lib/types";
import {
  getProyectos,
  crearProyecto,
  guardarProyecto,
  eliminarProyecto,
  setProyectoActivo,
} from "@/lib/storage";
import SyncIndicator from "@/components/SyncIndicator";

export default function Home() {
  const router = useRouter();
  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => {
    setProyectos(getProyectos());
    // Refrescar lista cuando llegan datos remotos
    const handler = () => setProyectos(getProyectos());
    window.addEventListener("ferrapp-sync-pull", handler);
    return () => window.removeEventListener("ferrapp-sync-pull", handler);
  }, []);

  const crearNuevo = () => {
    const nombre = nuevoNombre.trim() || `Obra ${proyectos.length + 1}`;
    const p = crearProyecto(nombre);
    guardarProyecto(p);
    setProyectoActivo(p.id);
    setProyectos(getProyectos());
    setNuevoNombre("");
    router.push(`/obra/${p.id}`);
  };

  const abrirProyecto = (id: string) => {
    setProyectoActivo(id);
    router.push(`/obra/${id}`);
  };

  const borrarProyecto = (id: string) => {
    eliminarProyecto(id);
    setProyectos(getProyectos());
    setConfirmDelete(null);
  };

  const cargarEjemplo = () => {
    const p = crearProyecto("Edificio ejemplo");

    const losa = {
      id: Math.random().toString(36).substring(2, 9),
      nombre: "Losa de cimentacion",
      barrasNecesarias: [
        { id: "a1", longitud: 15.80, diametro: 12, cantidad: 58, etiqueta: "Losa inf - Dir X (ancha)" },
        { id: "a2", longitud: 6.05, diametro: 12, cantidad: 58, etiqueta: "Losa inf - Dir X (baja)" },
        { id: "a3", longitud: 11.40, diametro: 12, cantidad: 80, etiqueta: "Losa inf - Dir Y (izq)" },
        { id: "a4", longitud: 6.50, diametro: 12, cantidad: 48, etiqueta: "Losa inf - Dir Y (der)" },
        { id: "a5", longitud: 15.80, diametro: 12, cantidad: 58, etiqueta: "Losa sup - Dir X (ancha)" },
        { id: "a6", longitud: 6.05, diametro: 12, cantidad: 58, etiqueta: "Losa sup - Dir X (baja)" },
        { id: "a7", longitud: 11.40, diametro: 12, cantidad: 80, etiqueta: "Losa sup - Dir Y (izq)" },
        { id: "a8", longitud: 6.50, diametro: 12, cantidad: 48, etiqueta: "Losa sup - Dir Y (der)" },
      ],
      sobrantesGenerados: [],
      sobrantesConsumidos: [],
      calculado: false,
    };

    const muro = {
      id: Math.random().toString(36).substring(2, 9),
      nombre: "Muro sotano",
      barrasNecesarias: [
        { id: "b1", longitud: 3.50, diametro: 12, cantidad: 120, etiqueta: "Muro vertical ext" },
        { id: "b2", longitud: 3.50, diametro: 12, cantidad: 120, etiqueta: "Muro vertical int" },
        { id: "b3", longitud: 11.40, diametro: 10, cantidad: 48, etiqueta: "Muro horiz ext" },
        { id: "b4", longitud: 11.40, diametro: 10, cantidad: 48, etiqueta: "Muro horiz int" },
        { id: "b5", longitud: 0.40, diametro: 8, cantidad: 960, etiqueta: "Horquillas muro" },
      ],
      sobrantesGenerados: [],
      sobrantesConsumidos: [],
      calculado: false,
    };

    const zuncho = {
      id: Math.random().toString(36).substring(2, 9),
      nombre: "Zunchos perimetrales",
      barrasNecesarias: [
        { id: "c1", longitud: 11.40, diametro: 16, cantidad: 8, etiqueta: "Zuncho long 4d16" },
        { id: "c2", longitud: 15.80, diametro: 16, cantidad: 8, etiqueta: "Zuncho long 4d16" },
        { id: "c3", longitud: 0.96, diametro: 8, cantidad: 360, etiqueta: "Estribos zuncho" },
      ],
      sobrantesGenerados: [],
      sobrantesConsumidos: [],
      calculado: false,
    };

    p.elementos = [losa, muro, zuncho];
    guardarProyecto(p);
    setProyectoActivo(p.id);
    setProyectos(getProyectos());
    router.push(`/obra/${p.id}`);
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <header className="mb-10 text-center relative">
          <div className="absolute top-0 right-0"><SyncIndicator /></div>
          <h1 className="text-5xl font-bold text-accent mb-2">FERRAPP</h1>
          <p className="text-gray-400 text-lg">Optimizador de despiece de ferralla</p>
        </header>

        {/* Crear nueva obra */}
        <div className="bg-surface rounded-xl border border-border p-6 mb-8">
          <h2 className="text-lg font-semibold text-foreground mb-4">Nueva obra</h2>
          <div className="flex gap-3">
            <input
              type="text"
              value={nuevoNombre}
              onChange={(e) => setNuevoNombre(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && crearNuevo()}
              placeholder="Nombre de la obra (ej: Edificio Residencial C/ Mayor)"
              className="bg-surface-light border border-border rounded-lg px-4 py-3 text-foreground flex-1 focus:outline-none focus:border-accent placeholder:text-gray-500"
            />
            <button
              onClick={crearNuevo}
              className="bg-accent hover:bg-accent-dark text-black font-bold py-3 px-8 rounded-lg transition-colors"
            >
              Crear
            </button>
          </div>
          <button
            onClick={cargarEjemplo}
            className="mt-3 text-sm text-gray-400 hover:text-accent transition-colors"
          >
            O cargar edificio de ejemplo con datos de prueba
          </button>
        </div>

        {/* Lista de obras */}
        {proyectos.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">
              Mis obras ({proyectos.length})
            </h2>
            <div className="space-y-3">
              {proyectos
                .sort((a, b) => new Date(b.fechaModificacion).getTime() - new Date(a.fechaModificacion).getTime())
                .map((p) => (
                  <div
                    key={p.id}
                    className="bg-surface rounded-xl border border-border p-5 hover:border-accent/50 transition-colors cursor-pointer group"
                    onClick={() => abrirProyecto(p.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-foreground group-hover:text-accent transition-colors">
                          {p.nombre}
                        </h3>
                        <div className="flex gap-4 mt-1 text-sm text-gray-500">
                          <span>{p.elementos.length} elementos</span>
                          <span>{p.elementos.filter((e) => e.calculado).length} calculados</span>
                          <span>
                            Modificado: {new Date(p.fechaModificacion).toLocaleDateString("es-ES", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirmDelete === p.id) {
                              borrarProyecto(p.id);
                            } else {
                              setConfirmDelete(p.id);
                              setTimeout(() => setConfirmDelete(null), 3000);
                            }
                          }}
                          className={`text-sm px-3 py-1 rounded transition-colors ${
                            confirmDelete === p.id
                              ? "bg-danger text-white"
                              : "text-gray-500 hover:text-danger"
                          }`}
                        >
                          {confirmDelete === p.id ? "Confirmar borrado" : "Eliminar"}
                        </button>
                        <span className="text-accent text-xl group-hover:translate-x-1 transition-transform">
                          &rarr;
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {proyectos.length === 0 && (
          <div className="text-center py-16 text-gray-500">
            <p className="text-lg mb-2">No tienes obras creadas</p>
            <p className="text-sm">Crea una nueva obra o carga el ejemplo para empezar</p>
          </div>
        )}
      </div>
    </div>
  );
}
