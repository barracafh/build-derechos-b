import type { Estado } from "@/lib/ayudas";
import type { Perfil } from "@/lib/perfil";

// Forma común de una convocatoria, venga de la copia de datos/ o de la API.
// La copia usa otros nombres de campo (ver SETUP.md): se pasan aquí.
export type Convocatoria = {
  numero: string;
  titulo: string;
  organo: string;
  ambito: "estatal" | "autonomica" | "local";
  finalidad: string;
  tipo: string;
  plazo: {
    inicio: string | null;
    fin: string | null;
    texto: string | null;
    // El campo `abierto` de la BDNS: plazo indefinido, no «abierta hoy».
    indefinido: boolean;
  };
  url: string;
};

export type RespuestaConvocatorias = {
  fuente: "copia" | "api";
  consultado: string;
  convocatorias: Convocatoria[];
};

type DeLaCopia = {
  numeroBDNS: string;
  titulo: string;
  grupoConsulta: string;
  organo: { nivel3: string };
  tipoConvocatoria: string;
  finalidad: string;
  plazoSolicitud: {
    abierto: boolean;
    fechaInicioSolicitud: string | null;
    fechaFinSolicitud: string | null;
    textoFin: string | null;
  };
  urlFichaOficial: string;
};

const ambitos: Record<string, Convocatoria["ambito"]> = {
  estatal: "estatal",
  autonomica_cv: "autonomica",
  local_ayuntamiento_valencia: "local",
};

export function desdeCopia(c: DeLaCopia): Convocatoria {
  return {
    numero: c.numeroBDNS,
    titulo: c.titulo,
    organo: c.organo.nivel3,
    ambito: ambitos[c.grupoConsulta] ?? "estatal",
    finalidad: c.finalidad,
    tipo: c.tipoConvocatoria,
    plazo: {
      inicio: c.plazoSolicitud.fechaInicioSolicitud,
      fin: c.plazoSolicitud.fechaFinSolicitud,
      texto: c.plazoSolicitud.textoFin,
      indefinido: c.plazoSolicitud.abierto,
    },
    url: c.urlFichaOficial,
  };
}

const fecha = (iso: string) => iso.split("-").reverse().join("/");

// El estado sale de las fechas de la ficha; si no hay fechas, no se supone.
export function estadoConvocatoria(c: Convocatoria, hoy = new Date()): Estado {
  const { inicio, fin, texto, indefinido } = c.plazo;
  const dia = hoy.toISOString().slice(0, 10);
  if (fin) {
    if (inicio && dia < inicio)
      return { clave: "cerrada", texto: `Abre el ${fecha(inicio)}` };
    if (dia > fin) return { clave: "cerrada", texto: `Cerró el ${fecha(fin)}` };
    return { clave: "abierta", texto: `Abierta hasta el ${fecha(fin)}` };
  }
  if (texto)
    return {
      clave: "sin-confirmar",
      texto: "Sin fecha de cierre en la BDNS",
      nota: `La convocatoria dice: «${texto}». Comprueba la fecha en la ficha oficial.`,
    };
  return {
    clave: "sin-confirmar",
    texto: indefinido
      ? "La BDNS no fija fechas de plazo"
      : "Sin fechas en la BDNS: consulta la ficha oficial",
  };
}

// Convocatorias de la copia que ya están en el catálogo con datos comprobados.
const enCatalogo = new Set(["925677"]);

// Premios y concursos no son ayudas a la ciudadanía; las de «entidades» o las
// que financian formación o contratos se dirigen a quien los organiza.
const noEsAyuda = /premio|concurso|entidades|tesis|financia(r|ción)/i;
const escolar = /escolar|alumn|libros|comedor|infantil|primaria/i;

// Qué finalidades de la BDNS pueden interesar a este perfil y por qué.
function motivo(c: Convocatoria, p: Perfil): string | null {
  switch (c.finalidad) {
    case "Desempleo":
    case "Fomento del Empleo":
      return p.situacion === "paro"
        ? "Es una convocatoria de empleo y estás en paro."
        : null;
    case "Educación":
      if (p.hijosEscolares && p.hijos !== 0 && escolar.test(c.titulo))
        return "Es una ayuda escolar y tienes hijos en edad escolar.";
      if (p.situacion === "estudia")
        return "Es una convocatoria de educación y estudias.";
      return null;
    case "Acceso a la vivienda y fomento de la edificación":
      if (/alquiler/i.test(c.titulo))
        return p.vivienda === "alquiler"
          ? "Es una ayuda al alquiler y vives de alquiler."
          : null;
      return p.vivienda === "propiedad"
        ? "Es una convocatoria de vivienda y tienes vivienda en propiedad."
        : null;
    case "Servicios Sociales y Promoción Social":
      return p.ingresosBajos || p.situacion === "jubilado"
        ? "Es una convocatoria de servicios sociales."
        : null;
    case "Otras Prestaciones económicas":
      return p.situacion === "estudia" || p.situacion === "paro"
        ? "Es una beca o prestación para personas físicas."
        : null;
    default:
      return null;
  }
}

export type ConvocatoriaEncaja = {
  convocatoria: Convocatoria;
  motivo: string;
  estado: Estado;
};

export function convocatoriasPara(
  lista: Convocatoria[],
  p: Perfil,
  hoy = new Date(),
): { encajan: ConvocatoriaEncaja[]; cerradas: number } {
  const encajan: ConvocatoriaEncaja[] = [];
  let cerradas = 0;
  for (const c of lista) {
    if (c.tipo.startsWith("Concesión directa")) continue;
    if (enCatalogo.has(c.numero) || noEsAyuda.test(c.titulo)) continue;
    if (c.ambito === "local" && p.zona && p.zona !== "valencia") continue;
    if (c.ambito === "autonomica" && p.zona === "fuera") continue;
    const m = motivo(c, p);
    if (!m) continue;
    const estado = estadoConvocatoria(c, hoy);
    if (estado.clave === "cerrada") cerradas++;
    else encajan.push({ convocatoria: c, motivo: m, estado });
  }
  encajan.sort(
    (a, b) =>
      Number(b.estado.clave === "abierta") -
      Number(a.estado.clave === "abierta"),
  );
  return { encajan: encajan.slice(0, 8), cerradas };
}
