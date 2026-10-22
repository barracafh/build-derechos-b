// El perfil que se compara con el catálogo. Sale del formulario o, en chat y
// llamada, de la IA. Lo que no se sabe se deja sin poner: nunca se supone.
export const situaciones = {
  paro: "en paro",
  trabaja: "trabaja por cuenta ajena",
  autonomo: "autónomo o autónoma",
  jubilado: "jubilado o pensionista",
  estudia: "estudia",
  otra: "otra situación",
} as const;
export const viviendas = {
  alquiler: "vive de alquiler",
  propiedad: "vivienda en propiedad",
  otra: "otra vivienda",
} as const;
export const zonas = {
  valencia: "València ciudad",
  cv: "otro municipio de la Comunitat Valenciana",
  fuera: "fuera de la Comunitat Valenciana",
} as const;

export type Situacion = keyof typeof situaciones;
export type Vivienda = keyof typeof viviendas;
export type Zona = keyof typeof zonas;

export type Perfil = {
  edad?: number;
  situacion?: Situacion;
  vivienda?: Vivienda;
  // Hijos e hijas menores a cargo.
  hijos?: number;
  hijosEscolares?: boolean;
  ingresosBajos?: boolean;
  pensionMinima?: boolean;
  zona?: Zona;
  municipio?: string;
  // Solo lo marca la IA si el texto pregunta por la DANA.
  dana?: boolean;
};

const entero = (v: unknown, min: number, max: number) =>
  typeof v === "number" && Number.isInteger(v) && v >= min && v <= max
    ? v
    : undefined;
const clave = <T extends object>(v: unknown, opciones: T) =>
  typeof v === "string" && v in opciones ? (v as keyof T) : undefined;
const booleano = (v: unknown) => (typeof v === "boolean" ? v : undefined);

// Deja solo campos válidos: lo que venga de la IA no se usa tal cual.
export function limpiarPerfil(datos: unknown): Perfil {
  const d = (datos && typeof datos === "object" ? datos : {}) as Record<
    string,
    unknown
  >;
  const municipio =
    typeof d.municipio === "string" && d.municipio.trim()
      ? d.municipio.trim().slice(0, 60)
      : undefined;
  const perfil: Perfil = {
    edad: entero(d.edad, 0, 120),
    situacion: clave(d.situacion, situaciones),
    vivienda: clave(d.vivienda, viviendas),
    hijos: entero(d.hijos, 0, 20),
    hijosEscolares: booleano(d.hijosEscolares),
    ingresosBajos: booleano(d.ingresosBajos),
    pensionMinima: booleano(d.pensionMinima),
    zona: clave(d.zona, zonas),
    municipio,
    dana: booleano(d.dana),
  };
  return Object.fromEntries(
    Object.entries(perfil).filter(([, v]) => v !== undefined),
  ) as Perfil;
}

export const perfilVacio = (p: Perfil) =>
  Object.keys(p).filter((k) => k !== "dana").length === 0;

export function resumenPerfil(p: Perfil): string {
  const partes: string[] = [];
  if (p.edad !== undefined) partes.push(`${p.edad} años`);
  if (p.situacion) partes.push(situaciones[p.situacion]);
  if (p.vivienda) partes.push(viviendas[p.vivienda]);
  if (p.hijos !== undefined)
    partes.push(
      p.hijos === 0
        ? "sin hijos a cargo"
        : p.hijos === 1
          ? "1 hijo o hija a cargo"
          : `${p.hijos >= 4 ? "4 o más" : p.hijos} hijos a cargo`,
    );
  if (p.hijos !== 0 && p.hijosEscolares) partes.push("hijos en edad escolar");
  if (p.ingresosBajos !== undefined)
    partes.push(p.ingresosBajos ? "ingresos bajos" : "ingresos no bajos");
  if (p.pensionMinima) partes.push("pensión mínima");
  if (p.municipio) partes.push(p.municipio);
  else if (p.zona) partes.push(zonas[p.zona]);
  return partes.join(" · ");
}

// Lo que el chat necesita saber antes de buscar. Las preguntas que dependen de
// otra solo cuentan cuando aplican, como en el formulario paso a paso.
export type Campo = Exclude<keyof Perfil, "municipio" | "dana">;

export function camposNecesarios(p: Perfil): Campo[] {
  const campos: Campo[] = [
    "zona",
    "edad",
    "situacion",
    "vivienda",
    "hijos",
    "ingresosBajos",
  ];
  if (p.situacion === "jubilado") campos.push("pensionMinima");
  if (p.hijos) campos.push("hijosEscolares");
  return campos;
}

// Los campos que faltan, sin contar los que la persona prefiere no decir.
export const camposQueFaltan = (p: Perfil, rechazados: Campo[]) =>
  camposNecesarios(p).filter(
    (c) => p[c] === undefined && !rechazados.includes(c),
  );

export const esCampo = (v: unknown): v is Campo =>
  typeof v === "string" &&
  [
    "zona",
    "edad",
    "situacion",
    "vivienda",
    "hijos",
    "hijosEscolares",
    "ingresosBajos",
    "pensionMinima",
  ].includes(v);
