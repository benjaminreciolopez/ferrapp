// Tipos fundamentales de FERRAPP

/** Una pieza que necesitamos cortar */
export interface BarraNecesaria {
  id: string;
  longitud: number; // en metros
  diametro: number; // en mm (8, 10, 12, 16, 20, 25, 32)
  cantidad: number;
  etiqueta: string; // ej: "Losa inferior - Dir X", "Negativo viga V1"
  patas?: number; // 0, 1 o 2 patas (ganchos de anclaje)
  longitudPata?: number; // longitud de cada pata en metros (default 0.15)
}

/** Una barra comercial con los cortes asignados */
export interface BarraComercial {
  id: number;
  longitudTotal: number; // 12m por defecto
  cortes: CorteAsignado[];
  sobrante: number; // metros de desperdicio
}

/** Un corte específico dentro de una barra comercial */
export interface CorteAsignado {
  barraId: string;
  longitud: number;
  etiqueta: string;
  diametro: number;
}

/** Resultado del optimizador para un diámetro */
export interface ResultadoOptimizacion {
  diametro: number;
  barrasComerciales: BarraComercial[];
  totalBarrasComerciales: number;
  totalPiezas: number;
  metrosUtilizados: number;
  metrosDesperdicio: number;
  porcentajeDesperdicio: number;
  pesoKg: number;
}

/** Resultado global del despiece */
export interface ResultadoDespiece {
  resultadosPorDiametro: ResultadoOptimizacion[];
  pesoTotal: number;
  desperdicioTotal: number;
  costoEstimado?: number;
}

/** Configuración constructiva */
export interface ConfigConstruccion {
  longitudBarraComercial: number; // longitud principal (para compat)
  longitudesDisponibles: number[]; // longitudes de barra disponibles [6, 12]
  recubrimiento: number; // en metros, por defecto 0.05 (5cm)
  solape: Record<number, number>; // diámetro -> longitud solape en metros
  precioKg?: number; // precio por kg de acero
}

/** Peso por metro lineal según diámetro (kg/m) - datos reales */
export const PESO_POR_METRO: Record<number, number> = {
  6: 0.222,
  8: 0.395,
  10: 0.617,
  12: 0.888,
  14: 1.21,
  16: 1.58,
  20: 2.47,
  25: 3.85,
  32: 6.31,
};

/** Peso de barra comercial completa de 6m (kg) */
export const PESO_BARRA_6M: Record<number, number> = {
  6: 1.33, 8: 2.37, 10: 3.70, 12: 5.33,
  14: 7.26, 16: 9.48, 20: 14.82, 25: 23.10, 32: 37.86,
};

/** Peso de barra comercial completa de 12m (kg) */
export const PESO_BARRA_12M: Record<number, number> = {
  6: 2.66, 8: 4.74, 10: 7.40, 12: 10.66,
  14: 14.52, 16: 18.96, 20: 29.64, 25: 46.20, 32: 75.72,
};

/** Solapes estándar por diámetro (en metros) - EHE-08 */
export const SOLAPES_ESTANDAR: Record<number, number> = {
  6: 0.30,
  8: 0.35,
  10: 0.40,
  12: 0.50,
  14: 0.55,
  16: 0.60,
  20: 0.80,
  25: 1.00,
  32: 1.30,
};

export const DIAMETROS_DISPONIBLES = [6, 8, 10, 12, 14, 16, 20, 25, 32];

export const CONFIG_DEFAULT: ConfigConstruccion = {
  longitudBarraComercial: 12,
  longitudesDisponibles: [12],
  recubrimiento: 0.05,
  solape: SOLAPES_ESTANDAR,
};

// ===== SISTEMA DE PROYECTO =====

/** Un sobrante reutilizable de un elemento anterior */
export interface Sobrante {
  id: string;
  longitud: number; // metros
  diametro: number; // mm
  origen: string; // "Losa PB - Barra #45"
  usado: boolean;
}

// ===== SISTEMA DE CATEGORIAS =====

export type CategoriaElemento =
  | "cimentacion"
  | "vertical"
  | "forjado"
  | "vigas"
  | "escaleras"
  | "especiales"
  | "libre";

export interface PlantillaElemento {
  subtipo: string;
  nombre: string;
  categoria: CategoriaElemento;
  descripcion: string;
  icono: string;
  barrasDefault: Omit<BarraNecesaria, "id">[];
}

export const CATEGORIAS_INFO: Record<CategoriaElemento, { nombre: string; icono: string }> = {
  cimentacion: { nombre: "Cimentacion", icono: "C" },
  vertical: { nombre: "Vertical", icono: "V" },
  forjado: { nombre: "Forjados", icono: "F" },
  vigas: { nombre: "Vigas/Zunchos", icono: "Z" },
  escaleras: { nombre: "Escaleras", icono: "E" },
  especiales: { nombre: "Especiales", icono: "S" },
  libre: { nombre: "Libre", icono: "L" },
};

// ===== GEOMETRIA PARAMETRICA =====

export type FormaElemento = "rectangular" | "recto" | "l" | "u" | "cerrado" | "circular";

export interface LadoGeometria {
  nombre: string;    // "Izquierdo", "Fondo", "Derecho"
  longitud: number;  // metros
}

export interface GeometriaElemento {
  forma: FormaElemento;
  lados: LadoGeometria[];     // lados del elemento
  alto?: number;              // altura (muros, pilares)
  espaciado?: number;         // separacion entre barras (default 0.20)
  seccionAncho?: number;      // ancho seccion (vigas, pilares)
  seccionAlto?: number;       // alto seccion (vigas, pilares)
}

/** Que tipo de geometria usa cada categoria */
export type TipoGeometria = "superficie" | "muro" | "lineal" | "pilar" | "escalera";

export const CATEGORIA_A_GEOMETRIA: Record<CategoriaElemento, TipoGeometria> = {
  cimentacion: "superficie",  // zapatas y losas son superficies; muros se sobreescriben por subtipo
  vertical: "muro",           // muros y pantallas; pilares se sobreescriben por subtipo
  forjado: "superficie",
  vigas: "lineal",
  escaleras: "escalera",
  especiales: "superficie",
  libre: "superficie",
};

/** Subtipos que usan geometria diferente a su categoria */
export const SUBTIPO_GEOMETRIA_OVERRIDE: Record<string, TipoGeometria> = {
  pilar_rectangular: "pilar",
  pilar_circular: "pilar",
  muro_contencion: "muro",
  viga_riostra: "lineal",
};

/** Un elemento estructural dentro del proyecto */
export interface ElementoEstructural {
  id: string;
  nombre: string;
  categoria?: CategoriaElemento;
  subtipo?: string;
  geometria?: GeometriaElemento;
  barrasNecesarias: BarraNecesaria[];
  resultado?: ResultadoDespiece;
  sobrantesGenerados: Sobrante[];
  sobrantesConsumidos: string[];
  calculado: boolean;
}

/** Proyecto completo de obra */
export interface Proyecto {
  id: string;
  nombre: string;
  config: ConfigConstruccion;
  elementos: ElementoEstructural[];
  fechaCreacion: string;
  fechaModificacion: string;
}

/** Resultado extendido con info de sobrantes reutilizados */
export interface ResultadoDespieceExtendido extends ResultadoDespiece {
  sobrantesUsados: Sobrante[]; // sobrantes de elementos previos que se usaron
  sobrantesNuevos: Sobrante[]; // nuevos sobrantes generados por este elemento
  barrasComercialAhorradas: number; // cuántas barras nuevas se evitaron gracias a sobrantes
}
