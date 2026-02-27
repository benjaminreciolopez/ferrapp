import {
  BarraNecesaria,
  BarraComercial,
  ResultadoOptimizacion,
  ResultadoDespieceExtendido,
  ConfigConstruccion,
  CONFIG_DEFAULT,
  PESO_POR_METRO,
  Sobrante,
} from "./types";

interface PiezaPlana {
  longitud: number;
  diametro: number;
  etiqueta: string;
  id: string;
}

const SOBRANTE_MINIMO = 0.20;

/**
 * Optimizador de cortes con multi-longitud y reutilizacion de sobrantes.
 *
 * Soporta:
 * - Multiples longitudes de barra comercial (6m, 12m o ambas)
 * - Patas (ganchos) que anaden longitud a cada pieza
 * - Reutilizacion de sobrantes de elementos anteriores
 */
export function optimizarCortes(
  barrasNecesarias: BarraNecesaria[],
  config: ConfigConstruccion = CONFIG_DEFAULT,
  sobrantesDisponibles: Sobrante[] = []
): ResultadoDespieceExtendido {
  // Longitudes disponibles ordenadas de mayor a menor
  const longitudes = (config.longitudesDisponibles && config.longitudesDisponibles.length > 0)
    ? [...config.longitudesDisponibles].sort((a, b) => b - a)
    : [config.longitudBarraComercial];
  const Lmax = longitudes[0]; // la mas larga para calculo de solapes

  // Fase 1: Expandir cantidades y descomponer piezas largas
  const piezasPlanas = expandirPiezas(barrasNecesarias, config, Lmax);

  // Agrupar por diametro
  const porDiametro = new Map<number, PiezaPlana[]>();
  for (const pieza of piezasPlanas) {
    const grupo = porDiametro.get(pieza.diametro) || [];
    grupo.push(pieza);
    porDiametro.set(pieza.diametro, grupo);
  }

  // Agrupar sobrantes por diametro
  const sobrantesPorDiametro = new Map<number, Sobrante[]>();
  for (const s of sobrantesDisponibles) {
    if (s.usado) continue;
    const grupo = sobrantesPorDiametro.get(s.diametro) || [];
    grupo.push({ ...s });
    sobrantesPorDiametro.set(s.diametro, grupo);
  }

  const resultadosPorDiametro: ResultadoOptimizacion[] = [];
  let pesoTotal = 0;
  let desperdicioTotal = 0;
  const todosLosNuevosSobrantes: Sobrante[] = [];
  const todosLosSobrantesUsados: Sobrante[] = [];
  let barrasAhorradas = 0;

  for (const [diametro, piezas] of porDiametro) {
    const sobrantesDeEsteDiametro = sobrantesPorDiametro.get(diametro) || [];

    const resultado = bestFitMultiLongitud(
      piezas,
      diametro,
      longitudes,
      sobrantesDeEsteDiametro
    );

    resultadosPorDiametro.push(resultado.optimizacion);
    pesoTotal += resultado.optimizacion.pesoKg;
    desperdicioTotal += resultado.optimizacion.metrosDesperdicio;
    todosLosNuevosSobrantes.push(...resultado.nuevosSobrantes);
    todosLosSobrantesUsados.push(...resultado.sobrantesUsados);
    barrasAhorradas += resultado.barrasAhorradas;
  }

  resultadosPorDiametro.sort((a, b) => a.diametro - b.diametro);

  return {
    resultadosPorDiametro,
    pesoTotal,
    desperdicioTotal,
    sobrantesUsados: todosLosSobrantesUsados,
    sobrantesNuevos: todosLosNuevosSobrantes,
    barrasComercialAhorradas: barrasAhorradas,
  };
}

/** Descompone barras en piezas (incluye patas en la longitud) */
function expandirPiezas(
  barrasNecesarias: BarraNecesaria[],
  config: ConfigConstruccion,
  Lmax: number
): PiezaPlana[] {
  const piezas: PiezaPlana[] = [];

  for (const barra of barrasNecesarias) {
    // Longitud real incluyendo patas
    const nPatas = barra.patas || 0;
    const lPata = barra.longitudPata || 0.15;
    const longitudReal = barra.longitud + nPatas * lPata;

    for (let i = 0; i < barra.cantidad; i++) {
      const baseId = `${barra.id}_${i + 1}`;

      if (longitudReal <= Lmax) {
        piezas.push({
          longitud: +longitudReal.toFixed(3),
          diametro: barra.diametro,
          etiqueta: barra.etiqueta + (nPatas > 0 ? ` (+${nPatas}p)` : ""),
          id: baseId,
        });
      } else {
        // Pieza mas larga que la barra mas grande -> dividir con solape
        const solape = config.solape[barra.diametro] || 0.50;
        const longitudEfectiva = Lmax - solape;
        const numTramos = Math.ceil(longitudReal / longitudEfectiva);

        let restante = longitudReal;
        for (let t = 0; t < numTramos; t++) {
          let longitudTramo: number;
          if (t < numTramos - 1) {
            longitudTramo = Lmax;
            restante -= longitudEfectiva;
          } else {
            longitudTramo = Math.min(restante + solape, Lmax);
          }

          piezas.push({
            longitud: +longitudTramo.toFixed(3),
            diametro: barra.diametro,
            etiqueta: numTramos > 1
              ? `${barra.etiqueta} (tramo ${t + 1}/${numTramos})`
              : barra.etiqueta,
            id: `${baseId}_t${t + 1}`,
          });
        }
      }
    }
  }

  return piezas;
}

/**
 * BFD con multi-longitud y sobrantes.
 * Para cada pieza:
 * 1. Intenta en sobrantes existentes (Best Fit)
 * 2. Intenta en barras comerciales ya abiertas (Best Fit)
 * 3. Abre barra nueva: elige la MAS CORTA que quepa la pieza (minimiza desperdicio)
 */
function bestFitMultiLongitud(
  piezas: PiezaPlana[],
  diametro: number,
  longitudes: number[],
  sobrantesDisp: Sobrante[]
): {
  optimizacion: ResultadoOptimizacion;
  nuevosSobrantes: Sobrante[];
  sobrantesUsados: Sobrante[];
  barrasAhorradas: number;
} {
  const pesoPorMetro = PESO_POR_METRO[diametro] || 0;

  // Ordenar piezas de mayor a menor
  const ordenadas = [...piezas].sort((a, b) => b.longitud - a.longitud);

  // Sobrantes tracker
  const sobrantesTracker = sobrantesDisp
    .filter((s) => !s.usado && s.longitud >= SOBRANTE_MINIMO)
    .map((s) => ({ ...s, restante: s.longitud }));

  const barrasComerciales: BarraComercial[] = [];
  const barrasDeSobrante: BarraComercial[] = [];
  let barraId = 1;
  let barrasobranteId = -1;
  const sobrantesUsadosIds = new Set<string>();
  let piezasEnSobrantes = 0;

  for (const pieza of ordenadas) {
    let colocada = false;

    // PRIORIDAD 1: Sobrantes existentes (Best Fit)
    let mejorSobranteIdx = -1;
    let menorResto = Infinity;

    for (let i = 0; i < sobrantesTracker.length; i++) {
      const st = sobrantesTracker[i];
      if (st.restante >= pieza.longitud) {
        const resto = st.restante - pieza.longitud;
        if (resto < menorResto) {
          menorResto = resto;
          mejorSobranteIdx = i;
        }
      }
    }

    if (mejorSobranteIdx >= 0) {
      const st = sobrantesTracker[mejorSobranteIdx];
      sobrantesUsadosIds.add(st.id);
      st.restante = +(st.restante - pieza.longitud).toFixed(3);

      let barraExistente = barrasDeSobrante.find(
        (b) => b.id === parseInt(st.id.replace(/\D/g, "")) * -1 ||
               b.cortes[0]?.barraId.startsWith(`sob_${st.id}`)
      );

      if (!barraExistente) {
        const bid = barrasobranteId--;
        barraExistente = {
          id: bid,
          longitudTotal: st.longitud,
          cortes: [],
          sobrante: st.longitud,
        };
        barrasDeSobrante.push(barraExistente);
      }

      barraExistente.cortes.push({
        barraId: pieza.id,
        longitud: pieza.longitud,
        etiqueta: pieza.etiqueta,
        diametro,
      });
      barraExistente.sobrante = +(barraExistente.sobrante - pieza.longitud).toFixed(3);
      piezasEnSobrantes++;
      colocada = true;
    }

    if (!colocada) {
      // PRIORIDAD 2: Barras comerciales abiertas (Best Fit)
      let mejorIdx = -1;
      let menorSobrante = Infinity;

      for (let i = 0; i < barrasComerciales.length; i++) {
        const bc = barrasComerciales[i];
        if (bc.sobrante >= pieza.longitud) {
          const nuevoSobrante = bc.sobrante - pieza.longitud;
          if (nuevoSobrante < menorSobrante) {
            menorSobrante = nuevoSobrante;
            mejorIdx = i;
          }
        }
      }

      if (mejorIdx >= 0) {
        barrasComerciales[mejorIdx].cortes.push({
          barraId: pieza.id,
          longitud: pieza.longitud,
          etiqueta: pieza.etiqueta,
          diametro,
        });
        barrasComerciales[mejorIdx].sobrante =
          +(barrasComerciales[mejorIdx].sobrante - pieza.longitud).toFixed(3);
      } else {
        // PRIORIDAD 3: Abrir barra nueva
        // Elegir la barra MAS CORTA que quepa la pieza (menos desperdicio)
        let mejorLongitud = longitudes[0]; // fallback a la mas larga
        let menorDesperdicio = Infinity;

        for (const L of longitudes) {
          if (L >= pieza.longitud) {
            const desp = L - pieza.longitud;
            if (desp < menorDesperdicio) {
              menorDesperdicio = desp;
              mejorLongitud = L;
            }
          }
        }

        barrasComerciales.push({
          id: barraId++,
          longitudTotal: mejorLongitud,
          cortes: [{
            barraId: pieza.id,
            longitud: pieza.longitud,
            etiqueta: pieza.etiqueta,
            diametro,
          }],
          sobrante: +(mejorLongitud - pieza.longitud).toFixed(3),
        });
      }
    }
  }

  // Generar nuevos sobrantes
  const nuevosSobrantes: Sobrante[] = [];
  let sobranteCounter = 1;

  for (const bc of barrasComerciales) {
    if (bc.sobrante >= SOBRANTE_MINIMO) {
      nuevosSobrantes.push({
        id: `s_${diametro}_${sobranteCounter++}`,
        longitud: bc.sobrante,
        diametro,
        origen: `Barra #${bc.id} ${bc.longitudTotal}m (${bc.cortes.map((c) => c.etiqueta).join(" + ")})`,
        usado: false,
      });
    }
  }

  // Restos de sobrantes reutilizados
  for (const st of sobrantesTracker) {
    if (sobrantesUsadosIds.has(st.id) && st.restante >= SOBRANTE_MINIMO) {
      nuevosSobrantes.push({
        id: `s_${diametro}_${sobranteCounter++}`,
        longitud: st.restante,
        diametro,
        origen: `Retal de sobrante reutilizado (${st.origen})`,
        usado: false,
      });
    }
  }

  const sobrantesUsados = sobrantesDisp.filter((s) => sobrantesUsadosIds.has(s.id));

  // Combinar barras para visualizacion
  const todasLasBarras: BarraComercial[] = [
    ...barrasDeSobrante.map((b) => ({
      ...b,
      cortes: b.cortes.map((c) => ({
        ...c,
        etiqueta: `♻️ ${c.etiqueta}`,
      })),
    })),
    ...barrasComerciales,
  ];

  // Metricas
  const totalPiezas = piezas.length;
  const metrosUtilizados = piezas.reduce((sum, p) => sum + p.longitud, 0);
  const metrosTotalCompra = barrasComerciales.reduce((sum, bc) => sum + bc.longitudTotal, 0);
  const metrosEnSobrantes = barrasDeSobrante.reduce(
    (sum, b) => sum + b.cortes.reduce((s, c) => s + c.longitud, 0),
    0
  );
  const metrosDesperdicio = +(metrosTotalCompra - (metrosUtilizados - metrosEnSobrantes)).toFixed(3);
  const porcentajeDesperdicio = metrosTotalCompra > 0
    ? +((metrosDesperdicio / metrosTotalCompra) * 100).toFixed(1)
    : 0;

  const barrasAhorradas = barrasDeSobrante.length > 0
    ? Math.round(metrosEnSobrantes / (longitudes[0] || 12))
    : 0;

  return {
    optimizacion: {
      diametro,
      barrasComerciales: todasLasBarras,
      totalBarrasComerciales: barrasComerciales.length,
      totalPiezas,
      metrosUtilizados: +metrosUtilizados.toFixed(3),
      metrosDesperdicio: Math.max(0, metrosDesperdicio),
      porcentajeDesperdicio: Math.max(0, porcentajeDesperdicio),
      pesoKg: +(metrosUtilizados * pesoPorMetro).toFixed(2),
    },
    nuevosSobrantes,
    sobrantesUsados,
    barrasAhorradas,
  };
}
