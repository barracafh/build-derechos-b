import { pedir, TTL } from "@/lib/bdns/cliente";
import { desdeApi } from "@/lib/bdns/normalizar";
import { CITA } from "@/lib/bdns/tipos";

// GET /api/motor/convocatorias/937126 → { origen, consultadoEn, cita, convocatoria }
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ numero: string }> },
) {
  const { numero } = await params;
  if (!/^\d{1,9}$/.test(numero))
    return Response.json({ error: "Número BDNS no válido." }, { status: 400 });
  try {
    const ficha = await pedir<unknown>("/convocatorias", { numConv: numero }, TTL.ficha);
    if (!ficha)
      return Response.json({ error: "No existe esa convocatoria en la BDNS." }, { status: 404 });
    const { extracto: _e, ...convocatoria } = desdeApi(ficha);
    return Response.json({
      origen: "api",
      consultadoEn: new Date().toISOString(),
      cita: CITA,
      convocatoria,
    });
  } catch {
    return Response.json({ error: "La BDNS no responde ahora mismo." }, { status: 502 });
  }
}
