import { Proyecto, CONFIG_DEFAULT, ElementoEstructural, BarraNecesaria } from "./types";
import { getPlantilla } from "./plantillas";
import { getGeometriaDefault } from "./generadores";
import { markDirty, markDeleted, syncEtiquetas } from "./sync";

const PROJECTS_KEY = "ferrapp_proyectos";
const ACTIVE_KEY = "ferrapp_activo";

function generarId() {
  return Math.random().toString(36).substring(2, 9);
}

export function crearBarraInicial(): BarraNecesaria {
  return {
    id: generarId(),
    longitud: 5.0,
    diametro: 12,
    cantidad: 10,
    etiqueta: "",
  };
}

export function crearElemento(nombre: string, subtipo?: string): ElementoEstructural {
  const plantilla = subtipo ? getPlantilla(subtipo) : null;
  const categoria = plantilla?.categoria || "libre";
  return {
    id: generarId(),
    nombre,
    categoria,
    subtipo: subtipo || undefined,
    geometria: subtipo ? getGeometriaDefault(subtipo, categoria) : undefined,
    barrasNecesarias: plantilla
      ? plantilla.barrasDefault.map((b) => ({ ...b, id: generarId() }))
      : [crearBarraInicial()],
    sobrantesGenerados: [],
    sobrantesConsumidos: [],
    calculado: false,
  };
}

export function crearProyecto(nombre: string): Proyecto {
  return {
    id: generarId(),
    nombre,
    config: { ...CONFIG_DEFAULT },
    elementos: [crearElemento("Elemento 1")],
    fechaCreacion: new Date().toISOString(),
    fechaModificacion: new Date().toISOString(),
  };
}

export function getProyectos(): Proyecto[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(PROJECTS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as Proyecto[];
  } catch {
    return [];
  }
}

export function guardarProyectos(proyectos: Proyecto[]) {
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(proyectos));
}

export function getProyecto(id: string): Proyecto | undefined {
  return getProyectos().find((p) => p.id === id);
}

export function guardarProyecto(proyecto: Proyecto) {
  const proyectos = getProyectos();
  const idx = proyectos.findIndex((p) => p.id === proyecto.id);
  if (idx >= 0) {
    proyectos[idx] = { ...proyecto, fechaModificacion: new Date().toISOString() };
  } else {
    proyectos.push(proyecto);
  }
  guardarProyectos(proyectos);
  markDirty(proyecto.id); // sync → Supabase (debounced)
}

export function eliminarProyecto(id: string) {
  guardarProyectos(getProyectos().filter((p) => p.id !== id));
  markDeleted(id); // sync → Supabase (inmediato)
}

export function getProyectoActivo(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACTIVE_KEY);
}

export function setProyectoActivo(id: string) {
  localStorage.setItem(ACTIVE_KEY, id);
}

// ============================================================
// ETIQUETAS PERSONALIZADAS
// ============================================================
const ETIQUETAS_KEY = "ferrapp_etiquetas_custom";

/** Leer todas las etiquetas custom guardadas (por categoría) */
export function getEtiquetasCustom(): Record<string, string[]> {
  if (typeof window === "undefined") return {};
  const raw = localStorage.getItem(ETIQUETAS_KEY);
  return raw ? JSON.parse(raw) : {};
}

/** Guardar nueva etiqueta custom para una categoría */
export function guardarEtiquetaCustom(categoria: string, etiqueta: string) {
  const todas = getEtiquetasCustom();
  const lista = todas[categoria] || [];
  if (!lista.includes(etiqueta)) {
    lista.push(etiqueta);
    todas[categoria] = lista;
    localStorage.setItem(ETIQUETAS_KEY, JSON.stringify(todas));
    syncEtiquetas(); // sync → Supabase
  }
}
