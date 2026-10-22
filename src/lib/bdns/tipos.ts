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
export type TipoSolicitante = "persona" | "autonomo";
export type Situacion = "paro" | "empleo" | "autonomo" | "jubilado" | "estudiante";
export type Vivienda = "alquiler" | "propiedad" | "otra";
export type Ingresos = "bajos" | "medios" | "altos";
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
  // Quién pide la ayuda. Decide el tipo de beneficiario en la BDNS:
  // "persona" → 1 (personas físicas), "autonomo" → 3 (autónomos y pymes).
  tipoSolicitante: TipoSolicitante | null;
  edad: number | null;
  situacion: Situacion | null;
  hijos: number | null;
  vivienda: Vivienda | null;
  ingresos: Ingresos | null;
  temas: Tema[];
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
  origen: "api" | "copia";
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
  // Lo que se ha pedido a la BDNS, en orden. Para depurar; la interfaz no lo necesita.
  peticionesBdns: PeticionBdns[];
};
