import { sugerirMunicipios } from "@/lib/bdns/territorio";

// GET ?q=gand → [{ municipio: "Gandia", provincia: "València" }, …] (máx. 8)
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q") ?? "";
  try {
    return Response.json({ municipios: await sugerirMunicipios(q.slice(0, 60)) });
  } catch {
    return Response.json({ error: "La BDNS no responde ahora mismo." }, { status: 502 });
  }
}
