import copia from "../../../../datos/bdns-convocatorias-cv.json";
import { buscarAyudas } from "../../../lib/ayudas";
import { convocatoriasPara, desdeCopia } from "../../../lib/bdns";
import type { MensajeChat, RespuestaChat } from "../../../lib/chat";
import { completar, type Mensaje } from "../../../lib/ia";
import {
  camposQueFaltan,
  esCampo,
  limpiarPerfil,
  resumenPerfil,
  type Campo,
  type Perfil,
} from "../../../lib/perfil";

// POST {"mensajes": [...], "perfil": {...}, "rechazados": [...]} devuelve la
// respuesta de Ayudita y el perfil actualizado. La IA conversa y pasa el texto a
// campos; qué falta y qué ayudas encajan lo decide el servidor con las reglas
// de lib/. No se guarda ni se registra nada de la conversación.

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

const redactar = `Eres Ayudita. Escribe la respuesta final para la persona, en castellano llano, cercano y claro, tuteando. Usa SOLO los datos del JSON que te paso.

Formato:
- Una frase de entrada que resuma su situación.
- Por cada ayuda de "podrias", un bloque (si trae "aviso", inclúyelo en ese bloque) que empiece con una línea "- " con su nombre; debajo, en una o dos frases, por qué podría encajar (solo los motivos dados) y su plazo tal cual; y una línea final "Pídela aquí: <enlace>" con el enlace exacto.
- Si hay "convocatorias", menciónalas igual de breve, con su enlace exacto.
- Si hay "cerradas", dilo en una frase.
- Si hay "huecos", explica en una o dos frases lo que no has podido consultar.
- Cierra con una frase que recuerde comprobar los requisitos en la web oficial antes de pedirla.

Reglas: di «podrías optar», nunca «tienes derecho» ni «te corresponde». No añadas importes, plazos, requisitos ni enlaces que no estén en el JSON. Sin negritas, sin títulos y sin markdown, salvo las líneas que empiezan por "- ". Los enlaces van como URL completa.`;

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
const convocatorias = copia.convocatorias.map(desdeCopia);

function leerJson(texto: string): Record<string, unknown> {
  try {
    return JSON.parse(texto.match(/\{[\s\S]*\}/)?.[0] ?? "");
  } catch {
    return {};
  }
}

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

    const datos = datosFinales(perfil);
    const permitidos = new Set([
      ...datos.podrias.map((a) => a.enlace),
      ...datos.convocatorias.map((c) => c.enlace),
    ]);
    const final = await completar([
      { role: "system", content: redactar },
      { role: "user", content: JSON.stringify(datos) },
    ]);
    return Response.json({
      texto: revisar(final, permitidos),
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
