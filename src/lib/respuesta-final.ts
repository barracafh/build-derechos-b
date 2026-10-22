import copia from "../../datos/bdns-convocatorias-cv.json";
import { buscarAyudas } from "@/lib/ayudas";
import { convocatoriasPara, desdeCopia } from "@/lib/bdns";
import { completar } from "@/lib/ia";
import { resumenPerfil, type Perfil } from "@/lib/perfil";

// La respuesta final del chat: el servidor calcula qué ayudas encajan con las
// reglas de lib/ y la IA solo lo redacta. Solo se usa desde rutas de servidor.
const redactar = `Eres Ayudita. Escribe la respuesta final para la persona, en castellano llano, cercano y claro, tuteando. Usa SOLO los datos del JSON que te paso.

Formato:
- Una frase de entrada que resuma su situación.
- Por cada ayuda de "podrias", un bloque (si trae "aviso", inclúyelo en ese bloque) que empiece con una línea "- " con su nombre; debajo, en una o dos frases, por qué podría encajar (solo los motivos dados) y su plazo tal cual; y una línea final "Pídela aquí: <enlace>" con el enlace exacto.
- Si hay "convocatorias", menciónalas igual de breve, con su enlace exacto.
- Si hay "cerradas", dilo en una frase.
- Si hay "huecos", explica en una o dos frases lo que no has podido consultar.
- Cierra con una frase que recuerde comprobar los requisitos en la web oficial antes de pedirla.

Reglas: di «podrías optar» (con la preposición: «las ayudas a las que podrías optar»), nunca «tienes derecho» ni «te corresponde». No añadas importes, plazos, requisitos ni enlaces que no estén en el JSON. Sin negritas, sin títulos y sin markdown, salvo las líneas que empiezan por "- ". Los enlaces van como URL completa.`;

const convocatorias = copia.convocatorias.map(desdeCopia);

function datosFinales(p: Perfil) {
  const b = buscarAyudas(p);
  const bdns = convocatoriasPara(convocatorias, p);
  return {
    situacion: resumenPerfil(p),
    podrias: b.podrias.map((r) => ({
      nombre: r.ayuda.titulo,
      motivos: r.motivos,
      plazo: r.estado.texto,
      // Sin trámite publicado (la RVI), se remite a la sede, no a la ley.
      enlace: r.ayuda.enlace_tramite ?? "https://sede.gva.es",
      aviso: r.ayuda.verificado
        ? undefined
        : "La ley cambió el 20/10/2026 y el procedimiento nuevo no está publicado: que pregunte en servicios sociales o en el 012.",
    })),
    convocatorias: bdns.encajan.map((c) => ({
      nombre: c.convocatoria.titulo,
      motivo: c.motivo,
      plazo: c.estado.texto,
      enlace: c.convocatoria.url,
    })),
    cerradas: b.cerradas.map((r) => `${r.ayuda.titulo}: ${r.estado.texto}`),
    huecos: b.huecos,
  };
}

// Quita cualquier enlace que no venga de los datos y la promesa de derechos.
function revisar(texto: string, permitidos: Set<string>) {
  return texto
    .replace(/https?:\/\/[^\s)]+/g, (url) => {
      const limpia = url.replace(/[.,;:]+$/, "");
      return permitidos.has(limpia) ? url : "";
    })
    .replace(/tienes derecho a/gi, "podrías optar a")
    .replace(/te corresponde/gi, "podría encajarte")
    .replace(/\*\*/g, "")
    .trim();
}

export async function respuestaFinal(perfil: Perfil): Promise<string> {
  const datos = datosFinales(perfil);
  const permitidos = new Set([
    ...datos.podrias.map((a) => a.enlace),
    ...datos.convocatorias.map((c) => c.enlace),
  ]);
  const texto = await completar([
    { role: "system", content: redactar },
    { role: "user", content: JSON.stringify(datos) },
  ]);
  return revisar(texto, permitidos);
}
