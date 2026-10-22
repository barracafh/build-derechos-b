import type { PeticionBdns } from "./cliente";

// Contrato del motor con la interfaz. Si cambias algo aquí, avisa al equipo visual
// y actualiza docs/api-motor.md y src/datos/ejemplo-buscar.json.

export type { PeticionBdns };

export type Estado = "abierta" | "proxima" | "cerrada" | "permanente" | "consultar";
export type Ambito = "estatal" | "autonomica" | "local";

export type Convocatoria = {
  numeroBDNS: string;
  titulo: string;
  tituloValenciano: string | null;
  ambito: Ambito;
  organo: { nivel1: string; nivel2: string; nivel3: string };
  tipoConvocatoria: string | null;
  finalidad: string | null;
  beneficiarios: string[];
  regiones: string[];
  presupuestoTotal: number | null;
  plazo: {
    inicio: string | null;
    fin: string | null;
    textoInicio: string | null;
    textoFin: string | null;
    indefinido: boolean;
  };
  estado: Estado;
  bases: { titulo: string | null; url: string | null };
  sedeElectronica: string | null;
  anuncios: { diario: string; fecha: string; titulo: string; url: string | null }[];
  documentos: { descripcion: string; nombre: string; url: string }[];
  urlFicha: string;
  fechaRecepcion: string;
};

// Solo para el servidor: el extracto del anuncio se pasa a la IA, no a la interfaz.
export type ConvocatoriaInterna = Convocatoria & { extracto: string | null };

// El formato único del paso 1. Lo rellenan el chat y el buscador (con la IA,
// POST /api/motor/perfil) o la nube de preguntas (el front, con GET /api/motor/perfil/opciones).
// Valores cerrados: los posibles están en src/lib/opciones.ts.
export type TipoPersona = "fisica" | "juridica";
export type Situacion = "paro" | "empleo" | "autonomo" | "jubilado" | "estudiante";
export type Vivienda = "alquiler" | "propiedad" | "otra";
export type Ingresos = "bajos" | "medios" | "altos";
export type Sexo = "mujer" | "hombre";
export type SiNo = "si" | "no";
export type Familia = "numerosa" | "monoparental" | "ninguna";
export type Tema =
  | "vivienda"
  | "empleo"
  | "educacion"
  | "familia"
  | "energia"
  | "salud"
  | "servicios_sociales"
  | "emprendimiento"
  | "transporte"
  | "cultura";

export type PerfilCiudadano = {
  ubicacion: { municipio: string | null; provincia: string | null; ccaa: string | null };
  // Quién pide la ayuda. Con `situacion` decide el tipo de beneficiario en la
  // BDNS (ver derivarFiltros en src/lib/opciones.ts). null = persona física.
  tipoPersona: TipoPersona | null;
  edad: number | null;
  situacion: Situacion | null;
  hijos: number | null;
  vivienda: Vivienda | null;
  ingresos: Ingresos | null;
  // Solo para cruzar con los requisitos del índice (src/datos/indice). Viven en la
  // petición: no se guardan ni se registran.
  sexo: Sexo | null;
  discapacidad: SiNo | null;
  familia: Familia | null;
  temas: Tema[];
};

// Requisitos de una convocatoria, sacados por la IA del extracto (scripts/indexar.ts).
// [] y null significan «no lo dice»: nunca excluyen. Solo excluye lo escrito y citado.
export type RequisitosConvocatoria = {
  solicitable: boolean; // false: nominativa o de concesión directa a alguien concreto
  resumen: string | null;
  temas: Tema[];
  quien: {
    tipoPersona: TipoPersona[];
    sexo: Sexo | null;
    edad: { min: number | null; max: number | null };
    situacion: Situacion[];
    hijosMin: number | null;
    familia: Exclude<Familia, "ninguna">[];
    vivienda: Exclude<Vivienda, "otra">[];
    ingresos: Exclude<Ingresos, "altos"> | null; // tope de renta
    discapacidad: boolean | null;
    empadronamiento: { municipio: string | null; provincia: string | null; ccaa: string | null };
    otros: string[]; // requisitos que no encajan arriba → «a comprobar»
  };
  importe: { texto: string | null; maximo: number | null };
  evidencias: { campo: string; cita: string }[];
  confianza: "alta" | "media" | "baja";
};

// Una entrada del índice local: la convocatoria normalizada + sus requisitos
// (null si la IA no pudo extraerlos: se busca solo con los datos de la BDNS).
export type ConvocatoriaIndexada = Convocatoria & {
  requisitos: RequisitosConvocatoria | null;
};

export type Indice = {
  version: number;
  ambito: string;
  // Territorio que cubre: el índice solo se usa si el ciudadano vive ahí.
  lugar: { municipio: string | null; nuts: string | null };
  generado: string;
  cita: typeof CITA;
  convocatorias: ConvocatoriaIndexada[];
};

export type Resultado = {
  convocatoria: Convocatoria;
  encaje: "alto" | "medio";
  motivo: string;
  aComprobar: string[];
};

export const CITA =
  "Origen de los datos: Intervención General de la Administración del Estado";

export type RespuestaBuscar = {
  perfil: PerfilCiudadano;
  consultado: string[];
  noConsultado: string[];
  origen: "api" | "copia" | "indice";
  consultadoEn: string;
  cita: typeof CITA;
  avisos: string[];
  resultados: Resultado[];
  sinCoincidencias: string | null;
  // Cómo se ha traducido el perfil (src/lib/opciones.ts) antes de ir a la BDNS.
  filtros: {
    temas: Tema[];
    finalidades: number[];
    palabrasClave: string[];
    tiposBeneficiario: number[];
  };
  // Preguntas que, contestadas, afinarían el resultado (las usa el buscador local
  // cuando alguna convocatoria depende de un dato que el perfil no tiene).
  preguntasUtiles?: { id: string; pregunta: string }[];
  // Lo que se ha pedido a la BDNS, en orden. Para depurar; la interfaz no lo necesita.
  peticionesBdns: PeticionBdns[];
};
