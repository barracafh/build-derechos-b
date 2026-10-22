// Buscador local: PerfilCiudadano × índice (src/datos/indice) → resultados, sin
// llamar a la BDNS ni a la IA. Un requisito excluye solo si los dos lados se
// conocen y chocan; si el perfil no tiene el dato, va a «aComprobar».
import alacant from "../../datos/indice/alacant.json";
import castello from "../../datos/indice/castello.json";
import valencia from "../../datos/indice/valencia.json";
import provAlacant from "../../datos/indice/prov-alacant.json";
import provCastello from "../../datos/indice/prov-castello.json";
import provValencia from "../../datos/indice/prov-valencia.json";
import { enSuTerritorio } from "../bdns/buscar";
import { calcularEstado } from "../bdns/estado";
import { normalizar, resolverTerritorio } from "../bdns/territorio";
import type {
  ConvocatoriaIndexada,
  Indice,
  PerfilCiudadano,
  RequisitosConvocatoria,
  Resultado,
  Situacion,
} from "../bdns/tipos";
import { derivarFiltros, esJuridica, PREGUNTAS, tiposBeneficiario, type IdPregunta } from "../opciones";

const INDICES = [valencia, alacant, castello, provValencia, provAlacant, provCastello]
  .map((i) => i as unknown as Indice)
  .filter((i) => i.convocatorias?.length);

// «València» coincide con «Valencia / València» y con «València (Marítimo)».
const coincide = (a: string, b: string) => {
  const na = normalizar(a);
  const nb = normalizar(b);
  return na.some((x) => nb.some((y) => x === y || ` ${y} `.includes(` ${x} `) || ` ${x} `.includes(` ${y} `)));
};

// Junta los índices de su comunidad y se queda con lo que le corresponde:
// Estado y comunidad (si no están limitadas a otro territorio), su diputación y
// su ayuntamiento (organo.nivel2 es el municipio que convoca). Devuelve null si
// no hay índice que cubra su ayuntamiento: entonces se busca en la API en vivo.
export async function indicePara(
  p: PerfilCiudadano,
): Promise<{ indice: Indice; consultado: string[]; noConsultado: string[] } | null> {
  const { municipio, provincia, ccaa } = p.ubicacion;
  if (!municipio && !provincia && !ccaa) return null;
  const t = await resolverTerritorio(p.ubicacion).catch(() => null);
  const nuts = t?.nuts;
  if (!t || !nuts || nuts.length < 4) return null;
  const deSuCcaa = INDICES.filter((i) => i.lugar?.nuts?.slice(0, 4) === nuts.slice(0, 4));
  if (!deSuCcaa.length) return null;

  // Solo sabemos la comunidad: Estado y comunidad desde el índice, sin locales.
  if (nuts.length === 4) {
    const vistos = new Set<string>();
    const convocatorias = deSuCcaa
      .flatMap((i) => i.convocatorias)
      .filter((c) => c.ambito !== "local" && !vistos.has(c.numeroBDNS) && vistos.add(c.numeroBDNS))
      .filter((c) => enSuTerritorio({ ...c, extracto: null }, nuts));
    if (!convocatorias.length) return null;
    return {
      indice: { ...deSuCcaa[0], generado: deSuCcaa.map((i) => i.generado).sort()[0], convocatorias },
      consultado: ["Estado", t.ccaa?.nombre].filter(Boolean) as string[],
      noConsultado: [...t.noResuelto, "Ayuntamiento y diputación: dinos tu municipio para incluirlos"],
    };
  }
  const nombres = [municipio, t.municipio?.nombre.replace(/^Ayuntamiento de /, "")].filter(Boolean) as string[];
  const esSuyo = (x: string | null | undefined) => !!x && nombres.some((n) => coincide(n, x));
  // Su ayuntamiento está cubierto por un índice de su ciudad o de su provincia.
  const cubreLocal = deSuCcaa.some((i) => (i.lugar.municipio ? esSuyo(i.lugar.municipio) : i.lugar.nuts === nuts));
  const cubreGeneral = deSuCcaa.some((i) => i.convocatorias.some((c) => c.ambito !== "local"));
  if (!cubreLocal || !cubreGeneral) return null;

  const vistos = new Set<string>();
  const convocatorias = deSuCcaa
    .flatMap((i) => i.convocatorias)
    .filter((c) => !vistos.has(c.numeroBDNS) && vistos.add(c.numeroBDNS))
    .filter((c) => enSuTerritorio({ ...c, extracto: null }, nuts))
    .filter(
      (c) =>
        c.ambito !== "local" ||
        /^DIPUTACI/i.test(c.organo.nivel2) ||
        esSuyo(c.organo.nivel2) ||
        // Mancomunidades y consorcios: solo si exigen estar empadronado en su municipio.
        esSuyo(c.requisitos?.quien.empadronamiento.municipio),
    );
  const generado = deSuCcaa.map((i) => i.generado).sort()[0];
  return {
    indice: { ...deSuCcaa[0], generado, convocatorias },
    consultado: ["Estado", t.ccaa?.nombre, t.diputacion?.nombre, t.municipio?.nombre].filter(Boolean) as string[],
    noConsultado: [],
  };
}

const SITUACION: Record<Situacion, string> = {
  paro: "personas en paro",
  empleo: "personas trabajadoras",
  autonomo: "autónomos",
  jubilado: "personas jubiladas",
  estudiante: "estudiantes",
};

// Tipos de beneficiario de la BDNS presentes en la ficha (1, 2, 3, 4).
function tiposDeFicha(c: ConvocatoriaIndexada): number[] {
  const t = c.beneficiarios.join(" | ");
  const r: number[] = [];
  if (/F[IÍ]SICAS QUE NO/i.test(t)) r.push(1);
  if (/JUR[IÍ]DICAS QUE NO/i.test(t)) r.push(2);
  if (/PYME|F[IÍ]SICAS QUE DESARROLLAN/i.test(t)) r.push(3);
  if (/GRAN EMPRESA/i.test(t)) r.push(4);
  return r;
}

const raices = (s: string) =>
  normalizar(s).join(" ").split(" ").filter((w) => w.length >= 4).map((w) => w.slice(0, 6));

type Evaluacion = {
  excluida: boolean;
  cumple: string[];
  aComprobar: string[];
  faltan: IdPregunta[];
};

function evaluar(p: PerfilCiudadano, r: RequisitosConvocatoria | null): Evaluacion {
  const ev: Evaluacion = { excluida: false, cumple: [], aComprobar: [], faltan: [] };
  if (!r) {
    ev.aComprobar.push("Revisa los requisitos en la ficha oficial: no hemos podido leerlos.");
    return ev;
  }
  const q = r.quien;
  const fuera = () => (ev.excluida = true);
  const falta = (id: IdPregunta, texto: string) => {
    ev.faltan.push(id);
    ev.aComprobar.push(texto);
  };
  const persona = !esJuridica(p);
  const tipo = esJuridica(p) ? "juridica" : "fisica";
  if (q.tipoPersona.length && !q.tipoPersona.includes(tipo)) fuera();

  if (persona) {
    if (q.sexo) {
      const quien = q.sexo === "mujer" ? "mujeres" : "hombres";
      if (!p.sexo) falta("sexo", `Es solo para ${quien}.`);
      else if (p.sexo !== q.sexo) fuera();
      else ev.cumple.push(`es para ${quien}`);
    }
    const { min, max } = q.edad;
    if (min != null || max != null) {
      const rango = min != null && max != null ? `de ${min} a ${max} años` : min != null ? `desde ${min} años` : `hasta ${max} años`;
      if (p.edad == null) falta("edad", `Pide tener ${rango}.`);
      else if ((min != null && p.edad < min) || (max != null && p.edad > max)) fuera();
      else ev.cumple.push(`pide tener ${rango}`);
    }
    if (q.situacion.length) {
      const txt = q.situacion.map((s) => SITUACION[s]).join(" o ");
      if (!p.situacion) falta("situacion", `Es para ${txt}.`);
      else if (!q.situacion.includes(p.situacion)) fuera();
      else ev.cumple.push(`es para ${txt}`);
    }
    if (q.hijosMin != null) {
      if (p.hijos == null) falta("hijos", `Pide tener al menos ${q.hijosMin} hijos o hijas a cargo.`);
      else if (p.hijos < q.hijosMin) fuera();
      else ev.cumple.push("pide tener hijos a cargo");
    }
    if (q.familia.length) {
      const txt = q.familia.map((f) => `familia ${f}`).join(" o ");
      if (!p.familia) falta("familia", `Es para ${txt}.`);
      else if (!q.familia.includes(p.familia as "numerosa" | "monoparental")) fuera();
      else ev.cumple.push(`es para ${txt}`);
    }
    if (q.vivienda.length) {
      const txt = q.vivienda.map((v) => (v === "alquiler" ? "vivir de alquiler" : "tener vivienda en propiedad")).join(" o ");
      if (!p.vivienda) falta("vivienda", `Pide ${txt}.`);
      else if (!q.vivienda.includes(p.vivienda as "alquiler" | "propiedad")) fuera();
      else ev.cumple.push(`pide ${txt}`);
    }
    if (q.ingresos) {
      if (!p.ingresos) falta("ingresos", "Tiene un límite de ingresos.");
      else if (p.ingresos === "altos" || (q.ingresos === "bajos" && p.ingresos === "medios")) fuera();
      else ev.cumple.push("tiene un límite de ingresos");
    }
    if (q.discapacidad) {
      if (!p.discapacidad) falta("discapacidad", "Pide tener reconocida una discapacidad.");
      else if (p.discapacidad === "no") fuera();
      else ev.cumple.push("es para personas con discapacidad");
    }
  }
  const e = q.empadronamiento.municipio;
  if (e && p.ubicacion.municipio && !coincide(p.ubicacion.municipio, e)) fuera();
  else if (e) ev.cumple.push(`pide estar empadronado en ${e}`);
  ev.aComprobar.push(...q.otros.slice(0, 3));
  return ev;
}

export type SalidaLocal = {
  resultados: Resultado[];
  preguntasUtiles: { id: string; pregunta: string }[];
  descartadas: number;
};

export function buscarEnIndice(p: PerfilCiudadano, indice: Indice, limite = 15): SalidaLocal {
  const filtros = derivarFiltros(p);
  const claves = new Set(filtros.palabrasClave.flatMap(raices));
  const permitidos = tiposBeneficiario(p);
  const faltanTodas = new Map<IdPregunta, number>();
  let descartadas = 0;

  const puntuadas = indice.convocatorias.flatMap((c) => {
    const estado = calcularEstado(c.plazo.inicio, c.plazo.fin, c.plazo.indefinido);
    if (estado === "cerrada") return [];
    const tipos = tiposDeFicha(c);
    if (tipos.length && !tipos.some((t) => permitidos.includes(t))) return [];
    const r = c.requisitos;
    if (r && r.solicitable === false) return [];
    const ev = evaluar(p, r);
    if (ev.excluida) {
      descartadas++;
      return [];
    }
    const temas = (r?.temas ?? []).filter((t) => filtros.temas.includes(t)).length;
    const titulo = new Set(raices(`${c.titulo} ${r?.resumen ?? ""}`));
    const palabras = [...claves].filter((k) => titulo.has(k)).length;
    // Relevancia mínima: algún tema, palabra o requisito propio en común.
    // (estar empadronado aquí no cuenta: lo cumplen casi todas las locales).
    const personales = ev.cumple.filter((x) => !x.startsWith("pide estar empadronado")).length;
    if (filtros.temas.length && !temas && !palabras && !personales) return [];
    for (const id of ev.faltan) faltanTodas.set(id, (faltanTodas.get(id) ?? 0) + 1);
    const puntos =
      temas * 3 + palabras + ev.cumple.length * 2 - ev.faltan.length +
      (c.ambito === "local" ? 2 : c.ambito === "autonomica" ? 1 : 0) +
      (estado === "abierta" || estado === "permanente" ? 1 : 0);
    const encaje: Resultado["encaje"] = (temas || palabras) && ev.cumple.length && !ev.faltan.length ? "alto" : "medio";
    const base = r?.resumen ?? c.titulo;
    const motivo = ev.cumple.length
      ? `${base} Podrías optar: ${ev.cumple.join(", ")}.`
      : `${base} No pide requisitos personales concretos en el extracto: podrías optar si cumples las bases.`;
    const { requisitos: _, ...convocatoria } = c;
    return [{ puntos, resultado: { convocatoria: { ...convocatoria, estado }, encaje, motivo, aComprobar: ev.aComprobar } }];
  });

  const resultados = puntuadas
    .sort((a, b) =>
      Number(b.resultado.encaje === "alto") - Number(a.resultado.encaje === "alto") ||
      b.puntos - a.puntos || b.resultado.convocatoria.fechaRecepcion.localeCompare(a.resultado.convocatoria.fechaRecepcion))
    .slice(0, limite)
    .map((x) => x.resultado);

  const preguntasUtiles = [...faltanTodas.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => PREGUNTAS.find((q) => q.id === id)!)
    .filter(Boolean)
    .map((q) => ({ id: q.id, pregunta: q.pregunta }));

  return { resultados, preguntasUtiles, descartadas };
}
