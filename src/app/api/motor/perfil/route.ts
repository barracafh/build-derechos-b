import { perfilVacio, validarPerfil } from "@/lib/opciones";
import { interpretar } from "@/lib/interpretar";

// Paso 1 para el chat y el buscador.
// POST { mensaje, perfil? } → { perfil, faltan: [{ id, pregunta }], conIa }
// En el chat, manda en cada mensaje el perfil de la respuesta anterior.
// No se guarda ni se registra el mensaje.
export async function POST(req: Request) {
  const { mensaje, perfil } = await req.json().catch(() => ({}));
  if (typeof mensaje !== "string" || !mensaje.trim() || mensaje.length > 2000)
    return Response.json(
      { error: "Escribe un mensaje de hasta 2.000 caracteres." },
      { status: 400 },
    );
  const previo = perfil ? validarPerfil(perfil) : perfilVacio();
  return Response.json(await interpretar(mensaje, previo));
}
