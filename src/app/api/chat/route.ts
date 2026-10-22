import type { MensajeChat, RespuestaChat } from "../../../lib/chat";
import { completar, type Mensaje } from "../../../lib/ia";
import {
  camposQueFaltan,
  esCampo,
  limpiarPerfil,
  type Campo,
  type Perfil,
} from "../../../lib/perfil";

// POST {"mensajes": [...], "perfil": {...}, "rechazados": [...]} devuelve la
// respuesta de Ayudita y el perfil actualizado. La IA conversa y pasa el texto a
// campos; qué falta lo decide el servidor. Con el perfil completo contesta al
// momento con un mensaje puente y la respuesta final se pide a /api/chat/final.
// No se guarda ni se registra nada de la conversación.

const extraer = `Eres Ayudita, una herramienta que ayuda a la ciudadanía de València a saber a qué ayudas públicas podría optar. Hablas en castellano llano, cercano y breve, tuteando.

Lee la conversación y responde SOLO con un objeto JSON, sin texto alrededor:
{"perfil": {…}, "rechazados": […], "respuesta": "…"}

"perfil": todo lo que la persona ha dicho hasta ahora (incluye el perfil anterior que te paso). Omite lo que no haya dicho; no supongas nada.
- edad: número entero
- situacion: "paro" | "trabaja" | "autonomo" | "jubilado" | "estudia" | "otra"
- vivienda: "alquiler" | "propiedad" | "otra"
- hijos: número de hijos o hijas menores a cargo (0 si dice que no tiene)
- hijosEscolares: true si algún hijo va al colegio o instituto
- ingresosBajos: true si dice que tiene ingresos bajos, pocos o ninguno, o que cobra la pensión mínima; false si dice que no son bajos
- pensionMinima: true si dice que cobra la pensión mínima
- zona: "valencia" (ciudad de València) | "cv" (otro municipio de la Comunitat Valenciana) | "fuera"
- municipio: nombre del municipio o comarca si lo dice
- dana: true si pregunta por ayudas de la DANA

"rechazados": campos que la persona ha dicho que no sabe o no quiere decir.

"respuesta": si todavía falta alguno de estos datos y no está en rechazados — zona, edad, situacion, vivienda, hijos, ingresosBajos, más pensionMinima si es jubilado y hijosEscolares si tiene hijos — escribe un mensaje de 1 a 3 frases que reconozca con naturalidad lo que acaba de contar y pregunte por uno o dos de los datos que faltan, como lo haría una persona. Si ya están todos, deja "respuesta" vacía.

Nunca pidas nombre, DNI, dirección, teléfono ni otros datos personales. No hables todavía de ayudas concretas.`;

const preguntas: Record<Campo, string> = {
  zona: "¿En qué municipio vives?",
  edad: "¿Cuántos años tienes?",
  situacion: "¿Ahora mismo trabajas, estás en paro, estudias o estás jubilado?",
  vivienda: "¿Vives de alquiler o en una vivienda en propiedad?",
  hijos: "¿Tienes hijos o hijas menores a cargo?",
  hijosEscolares: "¿Alguno va al colegio o al instituto?",
  ingresosBajos: "¿Dirías que los ingresos de tu hogar son bajos?",
  pensionMinima: "¿Cobras la pensión mínima?",
};

// Tras varias vueltas, se busca con lo que haya para no hacer un interrogatorio.
const maxPreguntas = 5;
function leerJson(texto: string): Record<string, unknown> {
  try {
    return JSON.parse(texto.match(/\{[\s\S]*\}/)?.[0] ?? "");
  } catch {
    return {};
  }
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const mensajes: MensajeChat[] = Array.isArray(body.mensajes)
    ? body.mensajes
        .filter(
          (m: MensajeChat) =>
            (m?.rol === "usuario" || m?.rol === "ayudita") &&
            typeof m.texto === "string",
        )
        .slice(-14)
    : [];
  const ultimo = mensajes.at(-1);
  if (
    !ultimo ||
    ultimo.rol !== "usuario" ||
    !ultimo.texto.trim() ||
    ultimo.texto.length > 2000
  )
    return Response.json(
      { error: "Cuéntame tu situación en hasta 2.000 caracteres." },
      { status: 400 },
    );

  const anterior = limpiarPerfil(body.perfil);
  const rechazadosAntes: Campo[] = Array.isArray(body.rechazados)
    ? body.rechazados.filter(esCampo)
    : [];
  const historial: Mensaje[] = mensajes.map((m) => ({
    role: m.rol === "usuario" ? "user" : "assistant",
    content: m.texto.slice(0, 2000),
  }));

  try {
    const extraido = leerJson(
      await completar([
        {
          role: "system",
          content: `${extraer}\n\nPerfil anterior: ${JSON.stringify(anterior)}\nRechazados antes: ${JSON.stringify(rechazadosAntes)}`,
        },
        ...historial,
      ]),
    );
    const perfil = { ...anterior, ...limpiarPerfil(extraido.perfil) };
    const rechazados = [
      ...new Set([
        ...rechazadosAntes,
        ...(Array.isArray(extraido.rechazados)
          ? extraido.rechazados.filter(esCampo)
          : []),
      ]),
    ];
    const faltan = camposQueFaltan(perfil, rechazados);
    const vueltas = mensajes.filter((m) => m.rol === "usuario").length;

    if (faltan.length && vueltas < maxPreguntas) {
      const texto =
        typeof extraido.respuesta === "string" && extraido.respuesta.trim()
          ? extraido.respuesta.trim()
          : `Gracias. ${preguntas[faltan[0]]}`;
      return Response.json({
        texto,
        perfil,
        rechazados,
        completo: false,
      } satisfies RespuestaChat);
    }

    return Response.json({
      texto: faltan.length
        ? "Con lo que me has contado ya puedo buscar. Voy a mirar a qué ayudas podrías optar, dame unos segundos…"
        : "Perfecto, ya tengo lo que necesito. Voy a mirar a qué ayudas podrías optar, dame unos segundos…",
      perfil,
      rechazados,
      completo: true,
    } satisfies RespuestaChat);
  } catch (err) {
    // Sin claves, el fallo es de configuración, no de la persona: se dice claro.
    const sinClave = String(err).includes("HELMCODE_API_KEY");
    return Response.json(
      {
        error: sinClave
          ? "El asistente no está configurado: falta HELMCODE_API_KEY en .env.local."
          : "Ahora mismo no puedo conectar con el asistente. Prueba en un momento o usa el formulario.",
      },
      { status: 503 },
    );
  }
}
