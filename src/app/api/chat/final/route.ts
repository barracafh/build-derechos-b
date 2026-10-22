import { limpiarPerfil } from "../../../../lib/perfil";
import { respuestaFinal } from "../../../../lib/respuesta-final";

// POST {"perfil": {...}} devuelve {"texto": "…"}: la respuesta final del chat,
// redactada con las ayudas que encajan. No se guarda ni se registra nada.
export async function POST(req: Request) {
  const { perfil } = await req.json().catch(() => ({}));
  try {
    return Response.json({
      texto: await respuestaFinal(limpiarPerfil(perfil)),
    });
  } catch {
    return Response.json(
      {
        error:
          "No he podido preparar la respuesta ahora mismo. Abajo tienes el detalle de cada ayuda.",
      },
      { status: 503 },
    );
  }
}
