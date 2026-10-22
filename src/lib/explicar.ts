// Perfil + fichas → por qué podría encajar cada convocatoria (IA nº 2, una llamada).
import { completar } from "./ia";
import { leerJson } from "./interpretar";
import type { ConvocatoriaInterna, PerfilCiudadano, Resultado } from "./bdns/tipos";

const SISTEMA = `Ayudas a una persona a ver a qué convocatorias públicas podría optar.
Recibes su perfil y una lista de convocatorias de la BDNS. Para cada una decide el encaje con el perfil:
- "alto": el objeto y los beneficiarios encajan claramente con su situación
- "medio": podría encajar, pero depende de requisitos que hay que comprobar
- "bajo": no encaja (otro colectivo, otra actividad, para entidades, etc.)
Reglas:
- Usa solo lo que dicen los datos de cada convocatoria. No inventes importes, plazos ni requisitos.
- Escribe en castellano llano y en segunda persona. Di "podrías optar", nunca "tienes derecho".
- motivo: una frase de hasta 30 palabras.
- aComprobar: de 1 a 4 requisitos concretos que la persona debe revisar en las bases (según el extracto si lo hay; si no, "Revisa los requisitos en las bases").
Responde SOLO con un JSON: [{"numeroBDNS": "...", "encaje": "alto"|"medio"|"bajo", "motivo": "...", "aComprobar": ["..."]}]`;

const resumen = (c: ConvocatoriaInterna) => ({
  numeroBDNS: c.numeroBDNS,
  titulo: c.titulo,
  organo: [c.organo.nivel2, c.organo.nivel3].filter(Boolean).join(" · "),
  finalidad: c.finalidad,
  beneficiarios: c.beneficiarios,
  regiones: c.regiones,
  extracto: c.extracto,
});

// Quita el extracto antes de mandar la convocatoria a la interfaz.
const publica = ({ extracto: _extracto, ...c }: ConvocatoriaInterna) => c;

export async function explicar(
  perfil: PerfilCiudadano,
  cs: ConvocatoriaInterna[],
): Promise<{ resultados: Resultado[]; conIa: boolean }> {
  if (cs.length === 0) return { resultados: [], conIa: true };
  try {
    const r = await completar([
      { role: "system", content: SISTEMA },
      {
        role: "user",
        content: JSON.stringify({ perfil, convocatorias: cs.map(resumen) }),
      },
    ], { rapido: true });
    const lista = leerJson(r);
    if (!Array.isArray(lista)) throw new Error("Formato inesperado");
    const porNumero = new Map(cs.map((c) => [c.numeroBDNS, c]));
    const resultados: Resultado[] = [];
    for (const x of lista as Record<string, unknown>[]) {
      const c = porNumero.get(String(x.numeroBDNS));
      if (!c || (x.encaje !== "alto" && x.encaje !== "medio")) continue;
      resultados.push({
        convocatoria: publica(c),
        encaje: x.encaje,
        motivo: typeof x.motivo === "string" ? x.motivo : "",
        aComprobar: Array.isArray(x.aComprobar)
          ? x.aComprobar.filter((s): s is string => typeof s === "string").slice(0, 4)
          : [],
      });
    }
    resultados.sort((a, b) => (a.encaje === b.encaje ? 0 : a.encaje === "alto" ? -1 : 1));
    return { resultados, conIa: true };
  } catch {
    // Sin IA: se devuelven todas como «medio», sin motivo inventado.
    return {
      resultados: cs.map((c) => ({
        convocatoria: publica(c),
        encaje: "medio",
        motivo: "Coincide con palabras de tu descripción. Revisa si eres parte del colectivo al que se dirige.",
        aComprobar: ["Revisa los requisitos en las bases"],
      })),
      conIa: false,
    };
  }
}
