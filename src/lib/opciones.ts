// Catálogo del paso 1: qué se pregunta, con qué opciones, y cómo se traduce cada
// respuesta a filtros de la BDNS. El front no ve ids de la BDNS: solo esto.
import type {
  Ingresos,
  PerfilCiudadano,
  Situacion,
  Tema,
  TipoSolicitante,
  Vivienda,
} from "./bdns/tipos";

type Opcion<T extends string> = { valor: T; etiqueta: string };

export type Pregunta =
  | { id: "ubicacion"; pregunta: string; tipo: "ubicacion"; ayuda: string }
  | { id: "tipoSolicitante"; pregunta: string; tipo: "opcion"; opciones: Opcion<TipoSolicitante>[] }
  | { id: "edad" | "hijos"; pregunta: string; tipo: "numero"; min: number; max: number }
  | { id: "situacion"; pregunta: string; tipo: "opcion"; opciones: Opcion<Situacion>[] }
  | { id: "vivienda"; pregunta: string; tipo: "opcion"; opciones: Opcion<Vivienda>[] }
  | { id: "ingresos"; pregunta: string; tipo: "opcion"; opciones: Opcion<Ingresos>[] }
  | { id: "temas"; pregunta: string; tipo: "multiple"; opciones: Opcion<Tema>[] };

export type IdPregunta = Pregunta["id"];

export const PREGUNTAS: Pregunta[] = [
  {
    id: "ubicacion",
    pregunta: "¿Dónde vives?",
    tipo: "ubicacion",
    ayuda: "Municipio (mejor) o, si no, provincia o comunidad. GET /api/motor/perfil/municipios?q= sugiere nombres.",
  },
  {
    id: "tipoSolicitante",
    pregunta: "¿Pides la ayuda como particular o para tu actividad de autónomo?",
    tipo: "opcion",
    opciones: [
      { valor: "persona", etiqueta: "Como particular" },
      { valor: "autonomo", etiqueta: "Como autónomo o autónoma" },
    ],
  },
  { id: "edad", pregunta: "¿Cuántos años tienes?", tipo: "numero", min: 0, max: 120 },
  {
    id: "situacion",
    pregunta: "¿Cuál es tu situación laboral?",
    tipo: "opcion",
    opciones: [
      { valor: "paro", etiqueta: "En paro" },
      { valor: "empleo", etiqueta: "Trabajo por cuenta ajena" },
      { valor: "autonomo", etiqueta: "Autónomo o autónoma" },
      { valor: "jubilado", etiqueta: "Jubilado o jubilada" },
      { valor: "estudiante", etiqueta: "Estudiando" },
    ],
  },
  { id: "hijos", pregunta: "¿Cuántos hijos o hijas tienes a tu cargo?", tipo: "numero", min: 0, max: 20 },
  {
    id: "vivienda",
    pregunta: "¿Cómo es tu vivienda?",
    tipo: "opcion",
    opciones: [
      { valor: "alquiler", etiqueta: "De alquiler" },
      { valor: "propiedad", etiqueta: "En propiedad" },
      { valor: "otra", etiqueta: "Otra situación" },
    ],
  },
  {
    id: "ingresos",
    pregunta: "¿Cómo son los ingresos de tu hogar?",
    tipo: "opcion",
    opciones: [
      { valor: "bajos", etiqueta: "Bajos" },
      { valor: "medios", etiqueta: "Medios" },
      { valor: "altos", etiqueta: "Altos" },
    ],
  },
  {
    id: "temas",
    pregunta: "¿Con qué necesitas ayuda?",
    tipo: "multiple",
    opciones: [
      { valor: "vivienda", etiqueta: "Vivienda" },
      { valor: "empleo", etiqueta: "Encontrar trabajo" },
      { valor: "educacion", etiqueta: "Estudios y becas" },
      { valor: "familia", etiqueta: "Familia e hijos" },
      { valor: "energia", etiqueta: "Luz y suministros" },
      { valor: "salud", etiqueta: "Salud" },
      { valor: "servicios_sociales", etiqueta: "Servicios sociales" },
      { valor: "emprendimiento", etiqueta: "Mi negocio" },
      { valor: "transporte", etiqueta: "Transporte" },
      { valor: "cultura", etiqueta: "Cultura y deporte" },
    ],
  },
];

// Tema → finalidad de la BDNS (catálogo /finalidades) y palabras de títulos.
const TEMAS: Record<Tema, { finalidad: number; palabras: string[] }> = {
  vivienda: { finalidad: 8, palabras: ["vivienda", "alquiler", "rehabilitación"] },
  empleo: { finalidad: 6, palabras: ["empleo", "desempleo", "formación", "contratación"] },
  educacion: { finalidad: 10, palabras: ["becas", "estudios", "alumnado", "libros", "comedor"] },
  familia: { finalidad: 5, palabras: ["familia", "familias", "infancia", "natalidad", "hijos"] },
  energia: { finalidad: 13, palabras: ["energía", "eléctrico", "suministros", "eficiencia"] },
  salud: { finalidad: 9, palabras: ["salud", "sanitaria", "tratamiento"] },
  servicios_sociales: { finalidad: 5, palabras: ["social", "mayores", "dependencia", "vulnerabilidad", "emergencia"] },
  emprendimiento: { finalidad: 14, palabras: ["autónomos", "emprendimiento", "comercio", "trabajo"] },
  transporte: { finalidad: 15, palabras: ["transporte", "movilidad", "bono"] },
  cultura: { finalidad: 11, palabras: ["cultura", "deporte", "artes", "premios"] },
};

// Temas que se deducen del resto del perfil aunque no se marquen.
function temasImplicitos(p: PerfilCiudadano): Tema[] {
  const t: Tema[] = [];
  if (p.situacion === "paro") t.push("empleo");
  if (esAutonomo(p)) t.push("emprendimiento");
  if (p.situacion === "estudiante") t.push("educacion");
  if (p.situacion === "jubilado") t.push("servicios_sociales");
  if (p.vivienda === "alquiler") t.push("vivienda");
  if ((p.hijos ?? 0) > 0) t.push("familia", "educacion");
  if (p.ingresos === "bajos") t.push("servicios_sociales");
  return t;
}

export type FiltrosPerfil = {
  temas: Tema[];
  finalidades: number[];
  palabrasClave: string[];
  tiposBeneficiario: number[];
};

// Si no lo dice, se deduce de la situación laboral.
export const esAutonomo = (p: PerfilCiudadano) =>
  p.tipoSolicitante ? p.tipoSolicitante === "autonomo" : p.situacion === "autonomo";

export function derivarFiltros(p: PerfilCiudadano): FiltrosPerfil {
  const temas = [...new Set([...p.temas, ...temasImplicitos(p)])];
  const palabras = temas.flatMap((t) => TEMAS[t].palabras);
  if (p.edad != null && p.edad < 36) palabras.push("joven", "jóvenes", "juventud");
  if (p.edad != null && p.edad >= 65) palabras.push("mayores");
  return {
    temas,
    finalidades: [...new Set(temas.map((t) => TEMAS[t].finalidad))],
    palabrasClave: [...new Set(palabras)],
    // 1 personas físicas que no desarrollan actividad económica;
    // 3 pymes y personas físicas que desarrollan actividad económica (autónomos).
    tiposBeneficiario: esAutonomo(p) ? [3] : [1],
  };
}

export const perfilVacio = (): PerfilCiudadano => ({
  ubicacion: { municipio: null, provincia: null, ccaa: null },
  tipoSolicitante: null,
  edad: null,
  situacion: null,
  hijos: null,
  vivienda: null,
  ingresos: null,
  temas: [],
});

const valores = <T extends string>(id: IdPregunta) => {
  const p = PREGUNTAS.find((x) => x.id === id);
  return p && "opciones" in p ? (p.opciones.map((o) => o.valor) as T[]) : [];
};

// Acepta cualquier cosa (JSON del front o de la IA) y devuelve un perfil válido:
// lo que no encaja con el catálogo se queda en null.
export function validarPerfil(x: unknown): PerfilCiudadano {
  const o = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
  const u = (o.ubicacion && typeof o.ubicacion === "object" ? o.ubicacion : {}) as Record<string, unknown>;
  const str = (v: unknown) =>
    typeof v === "string" && v.trim() ? v.trim().slice(0, 80) : null;
  const num = (v: unknown, max: number) => {
    const n = typeof v === "string" && v.trim() ? Number(v) : v;
    return typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= max ? n : null;
  };
  const uno = <T extends string>(v: unknown, id: IdPregunta) =>
    valores<T>(id).includes(v as T) ? (v as T) : null;
  const temas = valores<Tema>("temas");
  return {
    ubicacion: { municipio: str(u.municipio), provincia: str(u.provincia), ccaa: str(u.ccaa) },
    tipoSolicitante: uno<TipoSolicitante>(o.tipoSolicitante, "tipoSolicitante"),
    edad: num(o.edad, 120),
    situacion: uno<Situacion>(o.situacion, "situacion"),
    hijos: num(o.hijos, 20),
    vivienda: uno<Vivienda>(o.vivienda, "vivienda"),
    ingresos: uno<Ingresos>(o.ingresos, "ingresos"),
    temas: [...new Set((Array.isArray(o.temas) ? o.temas : []).filter((t): t is Tema => temas.includes(t)))],
  };
}

// Lo nuevo manda; lo que no se dice ahora se conserva de antes.
export function combinarPerfiles(antes: PerfilCiudadano, ahora: PerfilCiudadano): PerfilCiudadano {
  return {
    ubicacion: {
      municipio: ahora.ubicacion.municipio ?? antes.ubicacion.municipio,
      provincia: ahora.ubicacion.provincia ?? antes.ubicacion.provincia,
      ccaa: ahora.ubicacion.ccaa ?? antes.ubicacion.ccaa,
    },
    tipoSolicitante: ahora.tipoSolicitante ?? antes.tipoSolicitante,
    edad: ahora.edad ?? antes.edad,
    situacion: ahora.situacion ?? antes.situacion,
    hijos: ahora.hijos ?? antes.hijos,
    vivienda: ahora.vivienda ?? antes.vivienda,
    ingresos: ahora.ingresos ?? antes.ingresos,
    temas: [...new Set([...antes.temas, ...ahora.temas])],
  };
}

// Qué preguntas siguen sin respuesta, en el orden del catálogo.
export function faltan(p: PerfilCiudadano): { id: IdPregunta; pregunta: string }[] {
  const vacia: Record<IdPregunta, boolean> = {
    ubicacion: !p.ubicacion.municipio && !p.ubicacion.provincia && !p.ubicacion.ccaa,
    tipoSolicitante: p.tipoSolicitante == null && p.situacion !== "autonomo",
    edad: p.edad == null,
    situacion: p.situacion == null,
    hijos: p.hijos == null,
    vivienda: p.vivienda == null,
    ingresos: p.ingresos == null,
    temas: p.temas.length === 0 && temasImplicitos(p).length === 0,
  };
  return PREGUNTAS.filter((q) => vacia[q.id]).map((q) => ({ id: q.id, pregunta: q.pregunta }));
}

// Mínimo para buscar con sentido: saber dónde vive o algo de su situación.
export function suficiente(p: PerfilCiudadano) {
  return derivarFiltros(p).temas.length > 0 || Boolean(p.ubicacion.municipio || p.ubicacion.provincia || p.ubicacion.ccaa);
}
