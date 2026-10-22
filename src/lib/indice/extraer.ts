// Una convocatoria → sus requisitos estructurados (RequisitosConvocatoria), con la IA.
// Lo usa scripts/indexar.ts, una vez por convocatoria y fuera de la web.
// Regla 4: cada requisito que excluye necesita una cita literal del extracto;
// si la cita no está en el texto, el requisito se descarta («no lo dice»).
import { completar } from "../ia";
import { leerJson } from "../interpretar";
import type { ConvocatoriaInterna, RequisitosConvocatoria, Tema } from "../bdns/tipos";

export const VERSION_EXTRACCION = 2;

const TEMAS: Tema[] = [
  "vivienda", "empleo", "educacion", "familia", "energia",
  "salud", "servicios_sociales", "emprendimiento", "transporte", "cultura",
];

const SISTEMA = `Lees una convocatoria de ayudas públicas de España y extraes a quién va dirigida.
Responde SOLO con JSON, sin texto alrededor, con esta forma exacta:
{
  "solicitable": true | false  (false si es nominativa, de concesión directa a una entidad concreta, o no se puede pedir),
  "resumen": "una frase llana de qué ayuda es y para quién, sin importes ni plazos",
  "temas": [${TEMAS.map((t) => `"${t}"`).join(", ")}] (solo los que apliquen),
  "quien": {
    "tipoPersona": ["fisica" | "juridica"]  (fisica = personas, también autónomos; juridica = asociaciones, empresas, entidades),
    "sexo": "mujer" | "hombre" | null,
    "edad": { "min": número | null, "max": número | null },
    "situacion": ["paro" | "empleo" | "autonomo" | "jubilado" | "estudiante"],
    "hijosMin": número | null,
    "familia": ["numerosa" | "monoparental"],
    "vivienda": ["alquiler" | "propiedad"],
    "ingresos": "bajos" | "medios" | null  (si hay un tope de renta: "bajos" si es cercano al IPREM o a rentas mínimas),
    "discapacidad": true | null,
    "empadronamiento": { "municipio": solo el nombre del municipio | null, "provincia": texto | null, "ccaa": texto | null },
    "otros": ["otros requisitos importantes, en frases cortas"]
  },
  "importe": { "texto": "lo que diga sobre la cuantía, copiado" | null, "maximo": número en euros por beneficiario | null },
  "evidencias": [{ "campo": "sexo" | "edad" | "situacion" | "hijosMin" | "familia" | "vivienda" | "ingresos" | "discapacidad" | "empadronamiento" | "tipoPersona", "cita": "fragmento COPIADO LITERALMENTE del texto, máximo 200 caracteres" }],
  "confianza": "alta" | "media" | "baja"
}
Reglas:
- Usa null o [] cuando el texto no lo diga. [] y null significan «sin restricción o no consta». NO deduzcas ni inventes.
- Rellena un campo de "quien" (salvo "otros") solo si es un REQUISITO para pedir la ayuda, no una mención de paso.
- Cada campo de "quien" que rellenes necesita su evidencia con una cita literal del texto.
- "sexo": solo si la ayuda es exclusivamente para mujeres u hombres.
- "situacion": las situaciones que la ayuda exige (p. ej. estar en paro). Si no exige ninguna, [].
- "empadronamiento": el territorio donde hay que residir o estar empadronado, si se exige.
- "confianza": "baja" si el texto es corto o no explica los beneficiarios.`;

export function entradaIa(c: ConvocatoriaInterna) {
  return [
    `Título: ${c.titulo}`,
    `Órgano: ${[c.organo.nivel1, c.organo.nivel2, c.organo.nivel3].filter(Boolean).join(" · ")}`,
    `Finalidad: ${c.finalidad ?? "—"}`,
    `Tipos de beneficiario (BDNS): ${c.beneficiarios.join("; ") || "—"}`,
    `Regiones: ${c.regiones.join("; ") || "—"}`,
    `Texto del extracto:\n${c.extracto ?? "(sin extracto)"}`,
  ].join("\n");
}

const plano = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9ñ]+/g, " ").trim();

// La cita está en el texto (tal cual, o con al menos el 85 % de sus palabras).
export function citaValida(cita: string, texto: string) {
  const c = plano(cita);
  const t = plano(texto);
  if (c.length < 4) return false;
  if (t.includes(c)) return true;
  const palabras = c.split(" ").filter((w) => w.length >= 4);
  if (palabras.length < 3) return false;
  const tw = new Set(t.split(" "));
  return palabras.filter((w) => tw.has(w)).length / palabras.length >= 0.85;
}

const arr = <T extends string>(v: unknown, ok: readonly T[]): T[] =>
  [...new Set((Array.isArray(v) ? v : []).filter((x): x is T => ok.includes(x as T)))];
const uno = <T extends string>(v: unknown, ok: readonly T[]): T | null =>
  ok.includes(v as T) ? (v as T) : null;
const num = (v: unknown, max: number) =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= max ? Math.round(v) : null;
const str = (v: unknown, max = 200) =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;

// Valida la respuesta de la IA y quita los requisitos sin cita comprobable.
export function validarRequisitos(x: unknown, texto: string): RequisitosConvocatoria {
  const o = (x && typeof x === "object" ? x : {}) as Record<string, any>;
  const q = (o.quien && typeof o.quien === "object" ? o.quien : {}) as Record<string, any>;
  const e = (q.empadronamiento ?? {}) as Record<string, unknown>;
  const im = (o.importe ?? {}) as Record<string, unknown>;

  const evidencias = (Array.isArray(o.evidencias) ? o.evidencias : [])
    .map((v: any) => ({ campo: String(v?.campo ?? ""), cita: str(v?.cita, 300) ?? "" }))
    .filter((v) => v.campo && citaValida(v.cita, texto));
  const citado = (campo: string) => evidencias.some((v) => v.campo === campo);
  const siCitado = <T>(campo: string, valor: T, vacio: T): T => (citado(campo) ? valor : vacio);

  const edad = { min: num(q.edad?.min, 120), max: num(q.edad?.max, 120) };
  return {
    solicitable: o.solicitable !== false,
    resumen: str(o.resumen, 300),
    temas: arr(o.temas, TEMAS),
    quien: {
      // El tipo de persona también lo da la BDNS: no exige cita.
      tipoPersona: arr(q.tipoPersona, ["fisica", "juridica"] as const),
      sexo: siCitado("sexo", uno(q.sexo, ["mujer", "hombre"] as const), null),
      edad: siCitado("edad", edad, { min: null, max: null }),
      situacion: siCitado("situacion", arr(q.situacion, ["paro", "empleo", "autonomo", "jubilado", "estudiante"] as const), []),
      hijosMin: siCitado("hijosMin", num(q.hijosMin, 20), null),
      familia: siCitado("familia", arr(q.familia, ["numerosa", "monoparental"] as const), []),
      vivienda: siCitado("vivienda", arr(q.vivienda, ["alquiler", "propiedad"] as const), []),
      ingresos: siCitado("ingresos", uno(q.ingresos, ["bajos", "medios"] as const), null),
      discapacidad: siCitado("discapacidad", q.discapacidad === true ? true : null, null),
      empadronamiento: siCitado(
        "empadronamiento",
        { municipio: str(e.municipio, 80), provincia: str(e.provincia, 80), ccaa: str(e.ccaa, 80) },
        { municipio: null, provincia: null, ccaa: null },
      ),
      otros: (Array.isArray(q.otros) ? q.otros : []).map((s: unknown) => str(s)).filter(Boolean).slice(0, 6) as string[],
    },
    importe: { texto: str(im.texto, 300), maximo: num(im.maximo, 10_000_000) },
    evidencias,
    confianza: uno(o.confianza, ["alta", "media", "baja"] as const) ?? "baja",
  };
}

export async function extraerRequisitos(c: ConvocatoriaInterna): Promise<RequisitosConvocatoria> {
  const texto = entradaIa(c);
  const r = await completar([
    { role: "system", content: SISTEMA },
    { role: "user", content: texto },
  ]);
  return validarRequisitos(leerJson(r), texto);
}
