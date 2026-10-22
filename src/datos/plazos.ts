// Plazos de las ayudas del catálogo, pasados a fechas desde el campo `plazo`
// de datos/catalogo-tramites-ayudas.json (comprobado a 18/10/2026). El estado
// se calcula con estas fechas; donde el catálogo no da plazo, no se inventa.
export type Plazo =
  | { tipo: "permanente" }
  | { tipo: "fechas"; inicio: string; fin: string }
  | { tipo: "cerrada"; nota: string }
  | { tipo: "sin-confirmar" };

export const plazos: Record<string, Plazo> = {
  "subsidio-desempleo": { tipo: "sin-confirmar" },
  "ingreso-minimo-vital": { tipo: "permanente" },
  "complemento-ayuda-infancia": { tipo: "sin-confirmar" },
  "renta-valenciana-inclusion": { tipo: "sin-confirmar" },
  "bono-social-electrico": { tipo: "permanente" },
  "bono-alquiler-joven": {
    tipo: "fechas",
    inicio: "2026-08-24",
    fin: "2026-09-11",
  },
  "ayudas-comedor-escolar": {
    tipo: "cerrada",
    nota: "El plazo ordinario está cerrado. Si el alumno se incorpora más tarde al curso, hay 10 días hábiles desde la matrícula.",
  },
  "xarxa-llibres": { tipo: "fechas", inicio: "2026-06-18", fin: "2026-11-10" },
};
