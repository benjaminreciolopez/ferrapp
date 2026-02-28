import {
  BarraNecesaria,
  CategoriaElemento,
  FormaElemento,
  GeometriaElemento,
  TipoGeometria,
  CATEGORIA_A_GEOMETRIA,
  SUBTIPO_GEOMETRIA_OVERRIDE,
  LadoGeometria,
} from "./types";
import { getPlantilla } from "./plantillas";

type BarraBase = Omit<BarraNecesaria, "id">;

/** Devuelve la etiqueta custom del lado o la letra automática (a,b,c...) */
export function resolverEtiquetaLado(lado: LadoGeometria, idx: number): string {
  return lado.etiqueta || String.fromCharCode(97 + idx);
}

/**
 * Obtiene el tipo de geometria para un subtipo/categoria dados
 */
export function getTipoGeometria(categoria: CategoriaElemento, subtipo?: string): TipoGeometria {
  if (subtipo && SUBTIPO_GEOMETRIA_OVERRIDE[subtipo]) {
    return SUBTIPO_GEOMETRIA_OVERRIDE[subtipo];
  }
  return CATEGORIA_A_GEOMETRIA[categoria] || "superficie";
}

/**
 * Genera barras automaticamente desde la geometria del elemento.
 * Usa los diametros de la plantilla como referencia.
 */
export function generarBarrasDesdeGeometria(
  geometria: GeometriaElemento,
  categoria: CategoriaElemento,
  subtipo?: string
): BarraBase[] {
  const tipo = getTipoGeometria(categoria, subtipo);

  switch (tipo) {
    case "superficie":
      return generarBarrasSuperficie(geometria, subtipo);
    case "muro":
      return generarBarrasMuro(geometria, subtipo);
    case "lineal":
      return generarBarrasLineal(geometria, subtipo);
    case "pilar":
      return generarBarrasPilar(geometria, subtipo);
    case "escalera":
      return generarBarrasEscalera(geometria, subtipo);
    default:
      return generarBarrasSuperficie(geometria, subtipo);
  }
}

/**
 * Obtiene los diametros de referencia de la plantilla.
 * Busca en barrasDefault las barras que coincidan con etiquetas clave.
 */
function getDiametrosPlantilla(subtipo?: string): Record<string, number> {
  if (!subtipo) return {};
  const plantilla = getPlantilla(subtipo);
  if (!plantilla) return {};

  const map: Record<string, number> = {};
  for (const b of plantilla.barrasDefault) {
    map[b.etiqueta] = b.diametro;
  }
  return map;
}

// ============================================================
// SUPERFICIES (losas, zapatas, forjados) — soporta multi-zona
// ============================================================
function generarBarrasSuperficie(g: GeometriaElemento, subtipo?: string): BarraBase[] {
  const esp = g.espaciado || 0.20;
  const diam = getDiametrosPlantilla(subtipo);
  const barras: BarraBase[] = [];

  // Extraer zonas rectangulares desde los lados
  interface Zona { largo: number; ancho: number; }
  const zonas: Zona[] = [];

  if (g.forma === "l" && g.lados.length >= 6) {
    // L con 6 lados perimetrales → 2 zonas rectangulares
    // [0]=Superior, [1]=Derecho, [2]=Entrante H, [3]=Entrante V, [4]=Inferior, [5]=Izquierdo
    // Zona sup: Superior × Derecho (franja ancha superior)
    zonas.push({ largo: g.lados[0].longitud, ancho: g.lados[1].longitud });
    // Zona inf: Inferior × Entrante V (franja estrecha inferior)
    zonas.push({ largo: g.lados[4].longitud, ancho: g.lados[3].longitud });
  } else {
    // Rectangular, U, etc: cada par (largo, ancho) es una zona
    for (let i = 0; i < g.lados.length; i += 2) {
      zonas.push({
        largo: g.lados[i]?.longitud || 5,
        ancho: g.lados[i + 1]?.longitud || g.lados[i]?.longitud || 5,
      });
    }
    if (zonas.length === 0) zonas.push({ largo: 5, ancho: 5 });
  }

  const multiZona = zonas.length > 1;
  const tieneSuper = !subtipo || !subtipo.includes("zapata_aislada");

  // Diametros referencia
  const dInf = diam["Inferior largo"] || diam["Parrilla lado largo"] || diam["Inferior principal"] || 12;
  const dInfAncho = diam["Inferior ancho"] || diam["Parrilla lado corto"] || diam["Inferior reparto"] || dInf;
  const dSup = diam["Superior largo"] || diam["Superior (negativos)"] || 10;
  const dSupAncho = diam["Superior ancho"] || diam["Superior reparto"] || dSup;

  // Forjados especiales tienen su propia logica
  if (subtipo === "forjado_unidireccional") {
    const dNeg = diam["Negativos gruesos"] || 12;
    const dNegFino = diam["Negativos finos"] || 10;
    const dMalla = diam["Malla reparto largo"] || 6;
    const zwUni = g.anchoZuncho || 0;
    const huecosUni = g.huecos || [];
    for (const [idx, z] of zonas.entries()) {
      const nombres = getNombresZonaSuperficie(g.forma);
      const prefix = multiZona ? `${nombres[idx] || `Ala ${idx + 1}`} ` : "";
      const netLargo = Math.max(z.largo - 2 * zwUni, 0);
      const netAncho = Math.max(z.ancho - 2 * zwUni, 0);
      let cantL = Math.round(netAncho / esp);
      let cantA = Math.round(netLargo / esp);
      if (idx === 0) {
        for (const h of huecosUni) {
          cantL = Math.max(0, cantL - Math.round(h.ancho / esp));
          cantA = Math.max(0, cantA - Math.round(h.largo / esp));
        }
      }
      barras.push(
        { longitud: +(netAncho * 0.5).toFixed(2), diametro: dNeg, cantidad: cantL, etiqueta: `${prefix}Negativos gruesos` },
        { longitud: +(netAncho * 0.3).toFixed(2), diametro: dNegFino, cantidad: cantL, etiqueta: `${prefix}Negativos finos` },
        { longitud: +netLargo.toFixed(2), diametro: dMalla, cantidad: cantL, etiqueta: `${prefix}Malla reparto largo` },
        { longitud: +netAncho.toFixed(2), diametro: dMalla, cantidad: cantA, etiqueta: `${prefix}Malla reparto ancho` },
      );
    }
    // Refuerzo perimetral de huecos
    for (const h of huecosUni) {
      barras.push({ longitud: +h.largo.toFixed(2), diametro: dMalla, cantidad: 4, etiqueta: `Refuerzo hueco ${h.nombre} largo` });
      barras.push({ longitud: +h.ancho.toFixed(2), diametro: dMalla, cantidad: 4, etiqueta: `Refuerzo hueco ${h.nombre} ancho` });
    }
    return barras;
  }

  if (subtipo === "forjado_reticular") {
    const dNervio = diam["Nervios abajo largo"] || 12;
    const dMalla = diam["Malla base"] || 6;
    const dCap = diam["Refuerzo capiteles"] || 16;
    const zw = g.anchoZuncho || 0; // ancho zuncho perimetral
    const huecos = g.huecos || [];

    for (const [idx, z] of zonas.entries()) {
      const nombres = getNombresZonaSuperficie(g.forma);
      const prefix = multiZona ? `${nombres[idx] || `Ala ${idx + 1}`} ` : "";

      // Dimensiones netas (descontando zunchos perimetrales)
      const netLargo = Math.max(z.largo - 2 * zw, 0);
      const netAncho = Math.max(z.ancho - 2 * zw, 0);

      // Cantidades base (zona neta)
      let cantL = Math.round(netAncho / esp);
      let cantA = Math.round(netLargo / esp);

      // Descontar huecos (solo en zona principal, idx=0)
      if (idx === 0) {
        for (const h of huecos) {
          cantL = Math.max(0, cantL - Math.round(h.ancho / esp));
          cantA = Math.max(0, cantA - Math.round(h.largo / esp));
        }
      }

      barras.push(
        { longitud: +netLargo.toFixed(2), diametro: dNervio, cantidad: cantL, etiqueta: `${prefix}Nervios abajo largo` },
        { longitud: +netAncho.toFixed(2), diametro: dNervio, cantidad: cantA, etiqueta: `${prefix}Nervios abajo ancho` },
        { longitud: +(netLargo * 0.5).toFixed(2), diametro: dNervio, cantidad: cantL, etiqueta: `${prefix}Nervios arriba largo` },
        { longitud: +(netAncho * 0.5).toFixed(2), diametro: dNervio, cantidad: cantA, etiqueta: `${prefix}Nervios arriba ancho` },
        { longitud: +netLargo.toFixed(2), diametro: dMalla, cantidad: Math.round(netAncho / 0.30), etiqueta: `${prefix}Malla base` },
      );
    }
    barras.push({ longitud: 1.50, diametro: dCap, cantidad: 16, etiqueta: "Refuerzo capiteles" });

    // Refuerzo perimetral de huecos
    for (const h of huecos) {
      const periHueco = +((h.largo + h.ancho) * 2).toFixed(2);
      const dRef = diam["Nervios abajo largo"] || 12;
      barras.push({ longitud: +h.largo.toFixed(2), diametro: dRef, cantidad: 4, etiqueta: `Refuerzo hueco ${h.nombre} largo` });
      barras.push({ longitud: +h.ancho.toFixed(2), diametro: dRef, cantidad: 4, etiqueta: `Refuerzo hueco ${h.nombre} ancho` });
    }

    return barras;
  }

  // Caso general: losas, zapatas, forjados bidireccionales
  const zw2 = g.anchoZuncho || 0; // zuncho perimetral (forjados)
  const huecos = g.huecos || [];

  for (const [idx, z] of zonas.entries()) {
    const nombres = getNombresZonaSuperficie(g.forma);
    const prefix = multiZona ? `${nombres[idx] || `Ala ${idx + 1}`} ` : "";
    // Dimensiones netas (descontando zunchos si los hay)
    const netLargo = Math.max(z.largo - 2 * zw2, 0);
    const netAncho = Math.max(z.ancho - 2 * zw2, 0);
    let cantLargo = Math.round(netAncho / esp);
    let cantAncho = Math.round(netLargo / esp);

    // Descontar huecos (solo zona principal idx=0)
    if (idx === 0) {
      for (const h of huecos) {
        cantLargo = Math.max(0, cantLargo - Math.round(h.ancho / esp));
        cantAncho = Math.max(0, cantAncho - Math.round(h.largo / esp));
      }
    }

    barras.push({
      longitud: +(zw2 > 0 ? netLargo : z.largo).toFixed(2),
      diametro: dInf,
      cantidad: cantLargo,
      etiqueta: `${prefix}Inferior largo`,
    });
    barras.push({
      longitud: +(zw2 > 0 ? netAncho : z.ancho).toFixed(2),
      diametro: dInfAncho,
      cantidad: cantAncho,
      etiqueta: `${prefix}Inferior ancho`,
    });

    if (tieneSuper) {
      barras.push({
        longitud: +(zw2 > 0 ? netLargo : z.largo).toFixed(2),
        diametro: dSup,
        cantidad: cantLargo,
        etiqueta: `${prefix}Superior largo`,
      });
      barras.push({
        longitud: +(zw2 > 0 ? netAncho : z.ancho).toFixed(2),
        diametro: dSupAncho,
        cantidad: cantAncho,
        etiqueta: `${prefix}Superior ancho`,
      });
    }
  }

  // Refuerzo perimetral de huecos
  for (const h of huecos) {
    barras.push({ longitud: +h.largo.toFixed(2), diametro: dInf, cantidad: 4, etiqueta: `Refuerzo hueco ${h.nombre} largo` });
    barras.push({ longitud: +h.ancho.toFixed(2), diametro: dInf, cantidad: 4, etiqueta: `Refuerzo hueco ${h.nombre} ancho` });
  }

  // Zapatas: añadir arranque pilar
  if (subtipo && subtipo.includes("zapata")) {
    const dArr = diam["Arranque pilar"] || 12;
    barras.push({
      longitud: 0.90,
      diametro: dArr,
      cantidad: 4,
      etiqueta: "Arranque pilar",
    });
  }

  return barras;
}

// ============================================================
// MUROS (muro de carga, contencion, pantalla, nucleo)
// ============================================================
function generarBarrasMuro(g: GeometriaElemento, subtipo?: string): BarraBase[] {
  const alto = g.alto || 3;
  const esp = g.espaciado || 0.20;
  const diam = getDiametrosPlantilla(subtipo);
  const barras: BarraBase[] = [];

  // Diametros referencia
  const dVert = diam["Vertical cara 1"] || diam["Muro vertical exterior"] || diam["Vertical exterior"] || 12;
  const dHoriz = diam["Horizontal cara 1"] || diam["Muro horizontal exterior"] || diam["Horizontal exterior"] || 10;
  const dHorq = diam["Horquillas"] || diam["Horquillas muro"] || 8;

  // Generar barras por cada lado
  for (const lado of g.lados) {
    const cantVert = Math.round(lado.longitud / esp);
    const cantHoriz = Math.round(alto / esp);
    const nombre = g.lados.length > 1 ? ` ${lado.nombre}` : "";

    barras.push({
      longitud: +alto.toFixed(2),
      diametro: dVert,
      cantidad: cantVert,
      etiqueta: `Vertical exterior${nombre}`,
    });
    barras.push({
      longitud: +alto.toFixed(2),
      diametro: dVert,
      cantidad: cantVert,
      etiqueta: `Vertical interior${nombre}`,
    });
    barras.push({
      longitud: +lado.longitud.toFixed(2),
      diametro: dHoriz,
      cantidad: cantHoriz,
      etiqueta: `Horizontal exterior${nombre}`,
    });
    barras.push({
      longitud: +lado.longitud.toFixed(2),
      diametro: dHoriz,
      cantidad: cantHoriz,
      etiqueta: `Horizontal interior${nombre}`,
    });
  }

  // Horquillas: total por area
  const areaTotal = g.lados.reduce((s, l) => s + l.longitud * alto, 0);
  const cantHorquillas = Math.round(areaTotal / (esp * esp));
  barras.push({
    longitud: 0.30,
    diametro: dHorq,
    cantidad: cantHorquillas,
    etiqueta: "Horquillas",
  });

  // Muro contencion: añadir zapata
  if (subtipo === "muro_contencion") {
    const longitudTotal = g.lados.reduce((s, l) => s + l.longitud, 0);
    const dZap = diam["Zapata ancho"] || 12;
    barras.push(
      { longitud: 2.00, diametro: dZap, cantidad: Math.round(longitudTotal / esp), etiqueta: "Zapata ancho" },
      { longitud: +longitudTotal.toFixed(2), diametro: dZap, cantidad: 4, etiqueta: "Zapata largo" },
    );
  }

  return barras;
}

// ============================================================
// LINEALES (vigas, zunchos, riostras, brochales)
// ============================================================
function generarBarrasLineal(g: GeometriaElemento, subtipo?: string): BarraBase[] {
  const longitud = g.lados[0]?.longitud || 5;
  const secAncho = g.seccionAncho || 0.30;
  const secAlto = g.seccionAlto || 0.30;
  const espEstribos = g.espaciado || 0.15;
  const diam = getDiametrosPlantilla(subtipo);
  const barras: BarraBase[] = [];

  // Diametros referencia
  const dAbajo = diam["Barras abajo"] || 16;
  const dArriba = diam["Barras arriba"] || 12;
  const dEstribo = diam["Estribos"] || 8;

  // Cantidades de barras longitudinales: usar las de la plantilla
  const plantilla = subtipo ? getPlantilla(subtipo) : null;
  const cantAbajo = plantilla?.barrasDefault.find(b => b.etiqueta === "Barras abajo")?.cantidad || 3;
  const cantArriba = plantilla?.barrasDefault.find(b => b.etiqueta === "Barras arriba")?.cantidad || 2;

  barras.push({
    longitud: +longitud.toFixed(2),
    diametro: dAbajo,
    cantidad: cantAbajo,
    etiqueta: "Barras abajo",
  });
  barras.push({
    longitud: +longitud.toFixed(2),
    diametro: dArriba,
    cantidad: cantArriba,
    etiqueta: "Barras arriba",
  });

  // Estribos: perimetro seccion
  const periEstribos = +((secAncho + secAlto) * 2 - 0.04).toFixed(2); // descontar recubrimientos
  const cantEstribos = Math.round(longitud / espEstribos);
  barras.push({
    longitud: periEstribos,
    diametro: dEstribo,
    cantidad: cantEstribos,
    etiqueta: "Estribos",
  });

  // Refuerzo negativo (si la plantilla lo tiene)
  if (plantilla?.barrasDefault.some(b => b.etiqueta === "Refuerzo negativo")) {
    const dNeg = diam["Refuerzo negativo"] || dAbajo;
    barras.push({
      longitud: +(longitud * 0.5).toFixed(2),
      diametro: dNeg,
      cantidad: 2,
      etiqueta: "Refuerzo negativo",
    });
  }

  // Portaestribos
  if (plantilla?.barrasDefault.some(b => b.etiqueta === "Portaestribos")) {
    barras.push({
      longitud: +longitud.toFixed(2),
      diametro: dEstribo,
      cantidad: 2,
      etiqueta: "Portaestribos",
    });
  }

  return barras;
}

// ============================================================
// PILARES
// ============================================================
function generarBarrasPilar(g: GeometriaElemento, subtipo?: string): BarraBase[] {
  const alto = g.alto || 3;
  const secAncho = g.seccionAncho || 0.30;
  const secAlto = g.seccionAlto || 0.30;
  const espEstribos = g.espaciado || 0.15;
  const diam = getDiametrosPlantilla(subtipo);
  const barras: BarraBase[] = [];

  const dLong = diam["Longitudinales"] || diam["Barras longitudinales"] || 16;
  const dEstribo = diam["Estribos"] || diam["Cercos"] || diam["Cercos circulares"] || 8;

  const plantilla = subtipo ? getPlantilla(subtipo) : null;
  const cantLong = plantilla?.barrasDefault.find(b =>
    b.etiqueta.includes("ongitudinal") || b.etiqueta.includes("Longitudinal")
  )?.cantidad || 4;

  barras.push({
    longitud: +alto.toFixed(2),
    diametro: dLong,
    cantidad: cantLong,
    etiqueta: "Longitudinales",
  });

  // Estribos/cercos
  const esCircular = g.forma === "circular" || subtipo === "pilar_circular";
  const periEstribos = esCircular
    ? +((secAncho * Math.PI) - 0.04).toFixed(2)
    : +((secAncho + secAlto) * 2 - 0.04).toFixed(2);
  const cantEstribos = Math.round(alto / espEstribos);

  barras.push({
    longitud: periEstribos,
    diametro: dEstribo,
    cantidad: cantEstribos,
    etiqueta: esCircular ? "Cercos circulares" : "Estribos",
  });

  return barras;
}

// ============================================================
// ESCALERAS
// ============================================================
function generarBarrasEscalera(g: GeometriaElemento, subtipo?: string): BarraBase[] {
  const desarrollo = g.lados[0]?.longitud || 4.5;
  const ancho = g.lados[1]?.longitud || 1.2;
  const esp = g.espaciado || 0.20;
  const diam = getDiametrosPlantilla(subtipo);

  const dInfLargo = diam["Inferior a lo largo"] || 12;
  const dInfAncho = diam["Inferior a lo ancho"] || 10;
  const dSupLargo = diam["Superior a lo largo"] || 10;
  const dSupAncho = diam["Superior a lo ancho"] || 8;

  return [
    { longitud: +desarrollo.toFixed(2), diametro: dInfLargo, cantidad: Math.round(ancho / esp), etiqueta: "Inferior a lo largo" },
    { longitud: +ancho.toFixed(2), diametro: dInfAncho, cantidad: Math.round(desarrollo / esp), etiqueta: "Inferior a lo ancho" },
    { longitud: +desarrollo.toFixed(2), diametro: dSupLargo, cantidad: Math.round(ancho / (esp * 2)), etiqueta: "Superior a lo largo" },
    { longitud: +ancho.toFixed(2), diametro: dSupAncho, cantidad: Math.round(desarrollo / esp), etiqueta: "Superior a lo ancho" },
  ];
}

// ============================================================
// GEOMETRIA POR DEFECTO para cada subtipo
// ============================================================
export function getGeometriaDefault(subtipo: string, categoria: CategoriaElemento): GeometriaElemento {
  const tipo = getTipoGeometria(categoria, subtipo);

  // Forjados tienen espaciado especifico (bovedillas/casetones)
  if (subtipo === "forjado_unidireccional") {
    return {
      forma: "rectangular",
      lados: [
        { nombre: "Largo", longitud: 5 },
        { nombre: "Ancho", longitud: 5 },
      ],
      espaciado: 0.70,
      anchoZuncho: 0.25,
    };
  }
  if (subtipo === "forjado_reticular") {
    return {
      forma: "rectangular",
      lados: [
        { nombre: "Largo", longitud: 5 },
        { nombre: "Ancho", longitud: 5 },
      ],
      espaciado: 0.72,
      anchoZuncho: 0.30,
    };
  }

  switch (tipo) {
    case "superficie":
      return {
        forma: "rectangular",
        lados: [
          { nombre: "Largo", longitud: 5 },
          { nombre: "Ancho", longitud: 5 },
        ],
        espaciado: 0.20,
      };
    case "muro":
      return {
        forma: "recto",
        lados: [{ nombre: "Longitud", longitud: 5 }],
        alto: 3,
        espaciado: 0.20,
      };
    case "lineal":
      return {
        forma: "recto",
        lados: [{ nombre: "Longitud", longitud: 5 }],
        seccionAncho: 0.30,
        seccionAlto: 0.30,
        espaciado: 0.15,
      };
    case "pilar":
      return {
        forma: subtipo === "pilar_circular" ? "circular" : "rectangular",
        lados: [],
        alto: 3,
        seccionAncho: 0.30,
        seccionAlto: 0.30,
        espaciado: 0.15,
      };
    case "escalera":
      return {
        forma: "rectangular",
        lados: [
          { nombre: "Desarrollo", longitud: 4.5 },
          { nombre: "Ancho", longitud: 1.2 },
        ],
        espaciado: 0.20,
      };
    default:
      return {
        forma: "rectangular",
        lados: [
          { nombre: "Largo", longitud: 5 },
          { nombre: "Ancho", longitud: 5 },
        ],
        espaciado: 0.20,
      };
  }
}

/**
 * Nombres de lados segun la forma del muro
 */
export function getLadosForma(forma: FormaElemento): string[] {
  switch (forma) {
    case "recto": return ["Longitud"];
    case "l": return ["Lado 1", "Lado 2"];
    case "u": return ["Izquierdo", "Fondo", "Derecho"];
    case "cerrado": return ["Frontal", "Derecho", "Fondo", "Izquierdo"];
    default: return ["Longitud"];
  }
}

/**
 * Nombres de lados para superficies segun la forma.
 * Cada par (Largo, Ancho) define una zona rectangular.
 */
export function getLadosSuperficie(forma: FormaElemento): string[] {
  switch (forma) {
    case "rectangular": return ["Largo", "Ancho"];
    case "l": return ["Superior", "Derecho", "Entrante H", "Entrante V", "Inferior", "Izquierdo"];
    case "u": return ["Ala izq Largo", "Ala izq Ancho", "Centro Largo", "Centro Ancho", "Ala der Largo", "Ala der Ancho"];
    default: return ["Largo", "Ancho"];
  }
}

/** Nombres de zona para mostrar en UI */
export function getNombresZonaSuperficie(forma: FormaElemento): string[] {
  switch (forma) {
    case "l": return ["Ala 1", "Ala 2"];
    case "u": return ["Ala izq", "Centro", "Ala der"];
    default: return [];
  }
}
