import { buscarConvocatorias } from "@/lib/bdns/buscar";
import { conRegistro } from "@/lib/bdns/cliente";
import { resolverTerritorio } from "@/lib/bdns/territorio";
import { CITA } from "@/lib/bdns/tipos";

export const maxDuration = 60;

// Sin IA, para depurar o para una vista de detalle:
// GET ?municipio=Gandia&provincia=&ccaa=&claves=alquiler,joven&finalidad=8&beneficiarios=1,3&limite=5
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const lista = (k: string) =>
    (q.get(k) ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const { resultado, peticiones } = await conRegistro(async () => {
  const territorio = await resolverTerritorio({
    municipio: q.get("municipio"),
    provincia: q.get("provincia"),
    ccaa: q.get("ccaa"),
  });
  const datos = await buscarConvocatorias(territorio, {
    palabrasClave: lista("claves"),
    finalidades: lista("finalidad").map(Number).filter(Boolean),
    tiposBeneficiario: lista("beneficiarios").map(Number).filter(Boolean).length
      ? lista("beneficiarios").map(Number)
      : [1],
    limite: Number(q.get("limite")) || 10,
    meses: Number(q.get("meses")) || 12,
  });
  return { territorio, datos };
  });
  const { territorio, datos } = resultado;
  return Response.json({
    origen: datos.origen,
    consultadoEn: new Date().toISOString(),
    cita: CITA,
    consultado: datos.consultado,
    noConsultado: territorio.noResuelto,
    avisos: datos.avisos,
    total: datos.total,
    convocatorias: datos.convocatorias.map(({ extracto: _e, ...c }) => c),
    peticionesBdns: peticiones,
  });
}
