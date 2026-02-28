import { supabase } from "./supabase";
import { Proyecto } from "./types";

// ============================================================
// DEVICE ID
// ============================================================
function getDeviceId(): string {
  let id = localStorage.getItem("ferrapp_device_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("ferrapp_device_id", id);
  }
  return id;
}

// ============================================================
// SYNC STATUS
// ============================================================
export type SyncStatus = "idle" | "syncing" | "error" | "offline";
type SyncListener = (status: SyncStatus) => void;

const listeners = new Set<SyncListener>();
let currentStatus: SyncStatus = "idle";

export function onSyncStatus(listener: SyncListener): () => void {
  listeners.add(listener);
  listener(currentStatus);
  return () => listeners.delete(listener);
}

function setSyncStatus(status: SyncStatus) {
  currentStatus = status;
  listeners.forEach((l) => l(status));
}

// ============================================================
// DIRTY TRACKING + DEBOUNCED PUSH
// ============================================================
const dirtyProjects = new Set<string>();
let syncInProgress = false;
let pushTimer: ReturnType<typeof setTimeout> | null = null;

const PROJECTS_KEY = "ferrapp_proyectos";

function getLocalProyectos(): Proyecto[] {
  const raw = localStorage.getItem(PROJECTS_KEY);
  return raw ? JSON.parse(raw) : [];
}

function saveLocalProyectos(proyectos: Proyecto[]) {
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(proyectos));
}

/** Marca un proyecto como "pendiente de push" */
export function markDirty(projectId: string) {
  if (!supabase) return;
  dirtyProjects.add(projectId);
  debouncedPush();
}

/** Push inmediato de soft-delete */
export async function markDeleted(projectId: string) {
  if (!supabase) return;
  try {
    await supabase
      .from("ferrapp_proyectos")
      .upsert({
        id: projectId,
        nombre: "(eliminado)",
        data: {},
        deleted: true,
        fecha_modificacion: new Date().toISOString(),
        device_id: getDeviceId(),
      }, { onConflict: "id" });
  } catch {
    console.warn("[sync] delete push failed");
  }
}

function debouncedPush() {
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(pushDirty, 2500);
}

async function pushDirty() {
  if (!supabase || dirtyProjects.size === 0 || syncInProgress) return;
  syncInProgress = true;
  setSyncStatus("syncing");

  try {
    const proyectos = getLocalProyectos();
    const toPush = proyectos.filter((p) => dirtyProjects.has(p.id));

    if (toPush.length > 0) {
      const rows = toPush.map((p) => ({
        id: p.id,
        nombre: p.nombre,
        data: p,
        fecha_modificacion: p.fechaModificacion,
        deleted: false,
        device_id: getDeviceId(),
      }));

      const { error } = await supabase
        .from("ferrapp_proyectos")
        .upsert(rows, { onConflict: "id" });

      if (!error) {
        toPush.forEach((p) => dirtyProjects.delete(p.id));
        setSyncStatus("idle");
      } else {
        console.warn("[sync] push error:", error.message);
        setSyncStatus("error");
      }
    } else {
      setSyncStatus("idle");
    }
  } catch {
    setSyncStatus("error");
  }

  syncInProgress = false;
}

// ============================================================
// PULL FROM CLOUD
// ============================================================
export async function pullFromCloud(): Promise<{ pulled: number; pushed: number }> {
  if (!supabase) return { pulled: 0, pushed: 0 };
  if (!navigator.onLine) {
    setSyncStatus("offline");
    return { pulled: 0, pushed: 0 };
  }

  setSyncStatus("syncing");

  try {
    const { data: remoteRows, error } = await supabase
      .from("ferrapp_proyectos")
      .select("id, data, fecha_modificacion, deleted");

    if (error || !remoteRows) {
      setSyncStatus("error");
      return { pulled: 0, pushed: 0 };
    }

    const localProyectos = getLocalProyectos();
    const localMap = new Map(localProyectos.map((p) => [p.id, p]));
    let pulled = 0;
    let pushed = 0;
    let localChanged = false;

    // Procesar remotos
    for (const row of remoteRows) {
      const local = localMap.get(row.id);

      if (row.deleted) {
        if (local) {
          localMap.delete(row.id);
          localChanged = true;
          pulled++;
        }
        continue;
      }

      const remoteDate = new Date(row.fecha_modificacion).getTime();
      const localDate = local ? new Date(local.fechaModificacion).getTime() : 0;

      if (!local || remoteDate > localDate) {
        // Remoto es más nuevo → sobrescribir local
        const proyecto = row.data as Proyecto;
        localMap.set(row.id, proyecto);
        localChanged = true;
        pulled++;
      }

      // Marcar como "visto" — no hace falta push
      if (local) localMap.delete(row.id); // se queda en el nuevo map
    }

    // Reconstruir array local
    if (localChanged) {
      // Combinar: los remotos actualizados + los locales que no estaban en remoto
      const updated = getLocalProyectos().map((p) => {
        // Si estaba en remoto y fue actualizado, usar el remoto
        for (const row of remoteRows) {
          if (row.id === p.id && !row.deleted) {
            const remoteDate = new Date(row.fecha_modificacion).getTime();
            const localDate = new Date(p.fechaModificacion).getTime();
            if (remoteDate > localDate) return row.data as Proyecto;
          }
        }
        return p;
      }).filter((p) => {
        // Eliminar los borrados remotamente
        const remoteRow = remoteRows.find((r) => r.id === p.id);
        return !remoteRow?.deleted;
      });

      // Añadir proyectos remotos que no existían localmente
      for (const row of remoteRows) {
        if (!row.deleted && !updated.find((p) => p.id === row.id)) {
          updated.push(row.data as Proyecto);
          pulled++;
        }
      }

      saveLocalProyectos(updated);
    }

    // Locales que no están en remoto → push
    const remoteIds = new Set(remoteRows.filter((r) => !r.deleted).map((r) => r.id));
    const localesNuevos = getLocalProyectos().filter((p) => !remoteIds.has(p.id));
    for (const p of localesNuevos) {
      dirtyProjects.add(p.id);
      pushed++;
    }
    if (pushed > 0) pushDirty();

    if (pulled > 0) {
      window.dispatchEvent(new CustomEvent("ferrapp-sync-pull"));
    }

    setSyncStatus("idle");
    return { pulled, pushed };
  } catch {
    setSyncStatus("error");
    return { pulled: 0, pushed: 0 };
  }
}

// ============================================================
// ETIQUETAS SYNC
// ============================================================
export async function syncEtiquetas() {
  if (!supabase || !navigator.onLine) return;

  try {
    // Pull remoto
    const { data: remoteEtiquetas } = await supabase
      .from("ferrapp_etiquetas_custom")
      .select("categoria, etiqueta");

    const raw = localStorage.getItem("ferrapp_etiquetas_custom");
    const localMap: Record<string, string[]> = raw ? JSON.parse(raw) : {};

    // Merge: remoto → local
    if (remoteEtiquetas) {
      for (const row of remoteEtiquetas) {
        const lista = localMap[row.categoria] || [];
        if (!lista.includes(row.etiqueta)) {
          lista.push(row.etiqueta);
          localMap[row.categoria] = lista;
        }
      }
      localStorage.setItem("ferrapp_etiquetas_custom", JSON.stringify(localMap));
    }

    // Push: local → remoto (upsert)
    const rows: { categoria: string; etiqueta: string }[] = [];
    for (const [cat, etiquetas] of Object.entries(localMap)) {
      for (const et of etiquetas) {
        rows.push({ categoria: cat, etiqueta: et });
      }
    }
    if (rows.length > 0) {
      await supabase
        .from("ferrapp_etiquetas_custom")
        .upsert(rows, { onConflict: "categoria,etiqueta", ignoreDuplicates: true });
    }
  } catch {
    console.warn("[sync] etiquetas sync failed");
  }
}

// ============================================================
// INIT
// ============================================================
let initialized = false;

export function initSync() {
  if (typeof window === "undefined" || initialized) return;
  initialized = true;

  // Sin Supabase → no sync, solo localStorage
  if (!supabase) {
    console.info("[sync] Supabase no configurado, modo solo-local");
    return;
  }

  // Estado online/offline
  window.addEventListener("online", () => {
    setSyncStatus("idle");
    pullFromCloud();
    syncEtiquetas();
  });
  window.addEventListener("offline", () => setSyncStatus("offline"));

  if (!navigator.onLine) {
    setSyncStatus("offline");
    return;
  }

  // Pull inicial
  pullFromCloud();
  syncEtiquetas();

  // Pull al volver a la pestaña
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && navigator.onLine) {
      pullFromCloud();
    }
  });

  // Fallback: pull cada 60s
  setInterval(() => {
    if (document.visibilityState === "visible" && navigator.onLine) {
      pullFromCloud();
    }
  }, 60000);

  // Push pendientes antes de cerrar
  window.addEventListener("beforeunload", () => {
    if (dirtyProjects.size > 0) {
      pushDirty();
    }
  });
}
