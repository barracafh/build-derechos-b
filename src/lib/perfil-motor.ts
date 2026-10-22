// Perfil del front (formulario y llamada, src/lib/perfil.ts) → PerfilCiudadano del
// motor, para buscar con POST /api/buscar. Lo que no tiene equivalente se queda en null.
import type { PerfilCiudadano, Situacion, Tema } from "@/lib/bdns/tipos";
import type { Perfil } from "@/lib/perfil";

const SITUACION: Record<string, Situacion | null> = {
  paro: "paro",
  trabaja: "empleo",
  autonomo: "autonomo",
  jubilado: "jubilado",
  estudia: "estudiante",
  otra: null,
};

export function aPerfilCiudadano(p: Perfil): PerfilCiudadano {
  const temas: Tema[] = [];
  if (p.hijosEscolares) temas.push("educacion");
  const enCv = p.zona === "valencia" || p.zona === "cv";
  return {
    ubicacion: {
      municipio: p.zona === "valencia" ? "València" : (p.municipio ?? null),
      provincia: null,
      ccaa: enCv ? "Comunitat Valenciana" : null,
    },
    tipoPersona: "fisica",
    edad: p.edad ?? null,
    situacion: p.situacion ? (SITUACION[p.situacion] ?? null) : null,
    hijos: p.hijos ?? null,
    vivienda: p.vivienda ?? null,
    ingresos:
      p.ingresosBajos || p.pensionMinima ? "bajos" : p.ingresosBajos === false ? "medios" : null,
    sexo: null,
    discapacidad: null,
    familia: null,
    temas,
  };
}
