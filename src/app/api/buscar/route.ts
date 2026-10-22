import { suficiente, validarPerfil } from "../../../lib/opciones";
import { buscar, buscarPorTexto } from "../../../lib/motor";

// La primera consulta en frío tarda ~20 s (la BDNS admite 1 petición por segundo).
export const maxDuration = 60;

// POST { perfil: PerfilCiudadano } (nube de preguntas, o chat tras /api/motor/perfil)
// POST { texto: "tengo 24 años…" } (atajo: hace también el paso 1 con IA)
// Devuelve RespuestaBuscar (src/lib/bdns/tipos.ts). No se guarda ni se registra nada.
export async function POST(req: Request) {
  const { texto, perfil } = await req.json().catch(() => ({}));
  try {
    if (perfil !== undefined) {
      const p = validarPerfil(perfil);
      if (!suficiente(p))
        return Response.json(
          { error: "Indica al menos dónde vives o algo de tu situación." },
          { status: 400 },
        );
      return Response.json(await buscar(p));
    }
    if (typeof texto !== "string" || !texto.trim() || texto.length > 2000)
      return Response.json(
        { error: "Manda un perfil, o cuéntanos tu situación en hasta 2.000 caracteres." },
        { status: 400 },
      );
    return Response.json(await buscarPorTexto(texto));
  } catch {
    return Response.json(
      { error: "No hemos podido hacer la búsqueda. Inténtalo de nuevo en un momento." },
      { status: 502 },
    );
  }
}
