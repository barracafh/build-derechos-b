// Catálogo del paso 1: qué se pregunta, con qué opciones, y cómo se traduce cada
// respuesta a filtros de la BDNS. El front no ve ids de la BDNS: solo esto.
import type {
  Familia,
  Ingresos,
  Sexo,
  SiNo,
  PerfilCiudadano,
  Situacion,
  Tema,
  TipoPersona,
  Vivienda,
} from "./bdns/tipos";

type Opcion<T extends string> = { valor: T; etiqueta: string };

export type Pregunta =
  | { id: "ubicacion"; pregunta: string; tipo: "ubicacion"; ayuda: string }
  | { id: "tipoPersona"; pregunta: string; tipo: "opcion"; opciones: Opcion<TipoPersona>[] }
  | { id: "edad" | "hijos"; pregunta: string; tipo: "numero"; min: number; max: number }
  | { id: "situacion"; pregunta: string; tipo: "opcion"; opciones: Opcion<Situacion>[] }
  | { id: "vivienda"; pregunta: string; tipo: "opcion"; opciones: Opcion<Vivienda>[] }
  | { id: "ingresos"; pregunta: string; tipo: "opcion"; opciones: Opcion<Ingresos>[] }
  | { id: "sexo"; pregunta: string; tipo: "opcion"; opciones: Opcion<Sexo>[] }
  | { id: "discapacidad"; pregunta: string; tipo: "opcion"; opciones: Opcion<SiNo>[] }
  | { id: "familia"; pregunta: string; tipo: "opcion"; opciones: Opcion<Familia>[] }
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
    id: "tipoPersona",
    pregunta: "¿Quién pide la ayuda?",
    tipo: "opcion",
    opciones: [
      { valor: "fisica", etiqueta: "Una persona (también si eres autónomo)" },
      { valor: "juridica", etiqueta: "Una entidad: asociación, fundación o empresa" },
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
    id: "sexo",
    pregunta: "¿Eres mujer u hombre?",
    tipo: "opcion",
    opciones: [
      { valor: "mujer", etiqueta: "Mujer" },
      { valor: "hombre", etiqueta: "Hombre" },
    ],
  },
  {
    id: "discapacidad",
    pregunta: "¿Tienes reconocida una discapacidad?",
    tipo: "opcion",
    opciones: [
      { valor: "si", etiqueta: "Sí" },
      { valor: "no", etiqueta: "No" },
    ],
  },
  {
    id: "familia",
    pregunta: "¿Tu familia es numerosa o monoparental?",
    tipo: "opcion",
    opciones: [
      { valor: "numerosa", etiqueta: "Familia numerosa" },
      { valor: "monoparental", etiqueta: "Familia monoparental" },
      { valor: "ninguna", etiqueta: "Ninguna de las dos" },
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
  if (esJuridica(p)) return t; // son circunstancias personales: no aplican a una entidad
  if (p.situacion === "paro") t.push("empleo");
  if (esAutonomo(p)) t.push("emprendimiento");
  if (p.situacion === "estudiante") t.push("educacion");
  if (p.situacion === "jubilado") t.push("servicios_sociales");
  if (p.vivienda === "alquiler") t.push("vivienda");
  if ((p.hijos ?? 0) > 0) t.push("familia", "educacion");
  if (p.familia === "numerosa" || p.familia === "monoparental") t.push("familia");
  if (p.ingresos === "bajos") t.push("servicios_sociales");
  return t;
}

export type FiltrosPerfil = {
  temas: Tema[];
  finalidades: number[];
  palabrasClave: string[];
  tiposBeneficiario: number[];
};

export const esJuridica = (p: PerfilCiudadano) => p.tipoPersona === "juridica";
export const esAutonomo = (p: PerfilCiudadano) => !esJuridica(p) && p.situacion === "autonomo";

// Tipos de beneficiario de la BDNS (catálogo /beneficiarios):
// 1 personas físicas que no desarrollan actividad económica
// 2 personas jurídicas que no desarrollan actividad económica (asociaciones…)
// 3 pymes y personas físicas que desarrollan actividad económica (autónomos)
// 4 gran empresa: no se busca, la herramienta es para la ciudadanía.
export function tiposBeneficiario(p: PerfilCiudadano): number[] {
  if (esJuridica(p)) return [2, 3];
  // Un autónomo puede pedir como particular (familia, vivienda) y por su actividad.
  if (esAutonomo(p)) return [1, 3];
  return [1];
}

export function derivarFiltros(p: PerfilCiudadano): FiltrosPerfil {
  const temas = [...new Set([...p.temas, ...temasImplicitos(p)])];
  const palabras = temas.flatMap((t) => TEMAS[t].palabras);
  if (!esJuridica(p) && p.edad != null && p.edad < 36) palabras.push("joven", "jóvenes", "juventud");
  if (!esJuridica(p) && p.edad != null && p.edad >= 65) palabras.push("mayores");
  if (esJuridica(p)) palabras.push("entidades", "asociaciones");
  return {
    temas,
    finalidades: [...new Set(temas.map((t) => TEMAS[t].finalidad))],
    palabrasClave: [...new Set(palabras)],
    tiposBeneficiario: tiposBeneficiario(p),
  };
}

export const perfilVacio = (): PerfilCiudadano => ({
  ubicacion: { municipio: null, provincia: null, ccaa: null },
  tipoPersona: null,
  edad: null,
  situacion: null,
  hijos: null,
  vivienda: null,
  ingresos: null,
  sexo: null,
  discapacidad: null,
  familia: null,
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
    tipoPersona: uno<TipoPersona>(o.tipoPersona, "tipoPersona"),
    edad: num(o.edad, 120),
    situacion: uno<Situacion>(o.situacion, "situacion"),
    hijos: num(o.hijos, 20),
    vivienda: uno<Vivienda>(o.vivienda, "vivienda"),
    ingresos: uno<Ingresos>(o.ingresos, "ingresos"),
    sexo: uno<Sexo>(o.sexo, "sexo"),
    discapacidad: uno<SiNo>(o.discapacidad, "discapacidad"),
    familia: uno<Familia>(o.familia, "familia"),
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
    tipoPersona: ahora.tipoPersona ?? antes.tipoPersona,
    edad: ahora.edad ?? antes.edad,
    situacion: ahora.situacion ?? antes.situacion,
    hijos: ahora.hijos ?? antes.hijos,
    vivienda: ahora.vivienda ?? antes.vivienda,
    ingresos: ahora.ingresos ?? antes.ingresos,
    sexo: ahora.sexo ?? antes.sexo,
    discapacidad: ahora.discapacidad ?? antes.discapacidad,
    familia: ahora.familia ?? antes.familia,
    temas: [...new Set([...antes.temas, ...ahora.temas])],
  };
}

// Qué preguntas siguen sin respuesta, en el orden del catálogo.
export function faltan(p: PerfilCiudadano): { id: IdPregunta; pregunta: string }[] {
  const personal = !esJuridica(p);
  const vacia: Record<IdPregunta, boolean> = {
    ubicacion: !p.ubicacion.municipio && !p.ubicacion.provincia && !p.ubicacion.ccaa,
    tipoPersona: p.tipoPersona == null,
    // Estas solo se preguntan a personas físicas.
    edad: personal && p.edad == null,
    situacion: personal && p.situacion == null,
    hijos: personal && p.hijos == null,
    vivienda: personal && p.vivienda == null,
    ingresos: personal && p.ingresos == null,
    // Opcionales: no se piden de entrada. El buscador local las pide si alguna
    // convocatoria depende de ellas (aComprobar).
    sexo: false,
    discapacidad: false,
    familia: false,
    temas: p.temas.length === 0 && temasImplicitos(p).length === 0,
  };
  return PREGUNTAS.filter((q) => vacia[q.id]).map((q) => ({ id: q.id, pregunta: q.pregunta }));
}

// Mínimo para buscar con sentido: saber dónde vive o algo de su situación.
export function suficiente(p: PerfilCiudadano) {
  return derivarFiltros(p).temas.length > 0 || Boolean(p.ubicacion.municipio || p.ubicacion.provincia || p.ubicacion.ccaa);
}
