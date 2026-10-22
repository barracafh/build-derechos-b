import catalogo from "../../datos/catalogo-tramites-ayudas.json";
import { plazos, type Plazo } from "@/datos/plazos";
import type { Perfil } from "@/lib/perfil";

export type Ayuda = (typeof catalogo.items)[number];

export type Estado = {
  clave: "abierta" | "permanente" | "sin-confirmar" | "cerrada";
  texto: string;
  nota?: string;
};

export type Resultado = {
  ayuda: Ayuda;
  // Por qué podría encajar, solo con datos que la persona ha dado.
  motivos: string[];
  estado: Estado;
};

export type Busqueda = {
  podrias: Resultado[];
  cerradas: Resultado[];
  // Lo que la herramienta no ha podido consultar para este perfil.
  huecos: string[];
};

const fecha = (iso: string) => iso.split("-").reverse().join("/");

export function estadoDe(plazo: Plazo | undefined, hoy = new Date()): Estado {
  if (!plazo || plazo.tipo === "sin-confirmar")
    return {
      clave: "sin-confirmar",
      texto: "Plazo sin confirmar: consúltalo en la web oficial",
    };
  if (plazo.tipo === "permanente")
    return {
      clave: "permanente",
      texto: "Se puede pedir en cualquier momento",
    };
  if (plazo.tipo === "cerrada")
    return { clave: "cerrada", texto: "Plazo cerrado", nota: plazo.nota };
  const dia = hoy.toISOString().slice(0, 10);
  if (dia < plazo.inicio)
    return { clave: "cerrada", texto: `Abre el ${fecha(plazo.inicio)}` };
  if (dia > plazo.fin)
    return { clave: "cerrada", texto: `Cerró el ${fecha(plazo.fin)}` };
  return { clave: "abierta", texto: `Abierta hasta el ${fecha(plazo.fin)}` };
}

const orden: Record<Estado["clave"], number> = {
  abierta: 0,
  permanente: 1,
  "sin-confirmar": 2,
  cerrada: 3,
};

// Cada regla devuelve los motivos si hay alguna señal de que la ayuda encaja y
// nada en el perfil la descarta. Los requisitos se comprueban en la fuente.
type Regla = (p: Perfil) => string[] | null;

const reglas: Record<string, Regla> = {
  "subsidio-desempleo": (p) =>
    p.situacion === "paro" ? ["Estás en paro."] : null,

  "ingreso-minimo-vital": (p) => {
    if (!p.ingresosBajos && p.situacion !== "paro") return null;
    if (p.edad !== undefined && p.edad < 23 && !p.hijos) return null;
    const m: string[] = [];
    if (p.ingresosBajos) m.push("Tus ingresos son bajos.");
    else
      m.push(
        "Estás en paro: si los ingresos de tu hogar son bajos, podría encajar.",
      );
    if (p.edad !== undefined && p.edad >= 23)
      m.push(`Tienes ${p.edad} años; la edad mínima general es 23.`);
    return m;
  },

  "complemento-ayuda-infancia": (p) =>
    p.hijos
      ? [
          `Tienes ${p.hijos === 1 ? "un hijo o hija menor" : p.hijos >= 4 ? "4 o más hijos menores" : `${p.hijos} hijos menores`} a cargo.`,
        ]
      : null,

  "renta-valenciana-inclusion": (p) => {
    if (p.zona === "fuera") return null;
    if (p.situacion === "trabaja" || p.situacion === "autonomo") return null;
    if (p.edad !== undefined && p.edad < 23) return null;
    if (!p.ingresosBajos && p.situacion !== "paro") return null;
    return [
      "Vives en la Comunitat Valenciana.",
      p.ingresosBajos
        ? "Tus ingresos son bajos."
        : "Estás en paro: si los ingresos de tu hogar son bajos, podría encajar.",
    ];
  },

  "bono-social-electrico": (p) => {
    const m: string[] = [];
    if (p.ingresosBajos) m.push("Tus ingresos son bajos.");
    if (p.pensionMinima) m.push("Cobras la pensión mínima.");
    else if (p.situacion === "jubilado" && p.pensionMinima === undefined)
      m.push("Eres pensionista: si cobras la pensión mínima, podría encajar.");
    if (p.hijos && p.hijos >= 3)
      m.push("Con 3 o más hijos podrías ser familia numerosa: compruébalo.");
    return m.length ? m : null;
  },

  "bono-alquiler-joven": (p) => {
    if (p.zona === "fuera" || p.vivienda !== "alquiler") return null;
    if (p.edad === undefined || p.edad < 18 || p.edad > 35) return null;
    return [`Tienes ${p.edad} años y vives de alquiler.`];
  },

  "ayudas-comedor-escolar": (p) =>
    p.zona !== "fuera" && p.hijosEscolares && p.hijos !== 0
      ? ["Tienes hijos en edad escolar."]
      : null,

  "xarxa-llibres": (p) =>
    p.zona !== "fuera" && p.hijosEscolares && p.hijos !== 0
      ? ["Tienes hijos en edad escolar."]
      : null,
};

export function buscarAyudas(p: Perfil, hoy = new Date()): Busqueda {
  const resultados: Resultado[] = [];
  for (const ayuda of catalogo.items) {
    const motivos = reglas[ayuda.id]?.(p);
    if (motivos)
      resultados.push({
        ayuda,
        motivos,
        estado: estadoDe(plazos[ayuda.id], hoy),
      });
  }
  resultados.sort((a, b) => orden[a.estado.clave] - orden[b.estado.clave]);

  const huecos: string[] = [];
  if (p.zona === "fuera")
    huecos.push(
      "Solo tengo ayudas estatales y de la Comunitat Valenciana. No he consultado las de tu comunidad autónoma ni las de tu ayuntamiento.",
    );
  else if (p.zona === "cv")
    huecos.push(
      `No tengo ayudas municipales de ${p.municipio ?? "tu municipio"}. Pregunta en su ayuntamiento o en los servicios sociales.`,
    );
  else if (!p.zona)
    huecos.push(
      "No sé dónde vives: he supuesto que es en la Comunitat Valenciana.",
    );
  if (p.situacion === "autonomo")
    huecos.push("No he consultado ayudas específicas para autónomos.");
  if (p.dana)
    huecos.push(
      "Las ayudas por la DANA de 2024 no están en esta herramienta. Consúltalas en la sede de la Generalitat.",
    );
  return {
    podrias: resultados.filter((r) => r.estado.clave !== "cerrada"),
    cerradas: resultados.filter((r) => r.estado.clave === "cerrada"),
    huecos,
  };
}
