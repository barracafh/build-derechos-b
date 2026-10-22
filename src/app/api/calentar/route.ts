import { buscarPorTexto } from "../../../lib/motor";
import { precargarTerritorio } from "../../../lib/bdns/territorio";

export const maxDuration = 300;

// Antes de la demo: GET /api/calentar precarga los catálogos y los perfiles de
// prueba del SETUP.md en la caché en memoria de esta instancia.
const PERFILES = [
  "Tengo 24 años, estoy en paro y vivo de alquiler en València, sin hijos.",
  "Soy madre autónoma con 2 hijos en Castelló de la Plana y tengo ingresos bajos.",
  "Tengo 70 años, vivo en un pueblo de la Safor, cobro la pensión mínima y la factura de la luz es alta.",
  "Somos una familia con 3 hijos en edad escolar en València.",
];

export async function GET() {
  const inicio = Date.now();
  await precargarTerritorio();
  const perfiles = [];
  for (const texto of PERFILES) {
    const t = Date.now();
    const r = await buscarPorTexto(texto).catch(() => null);
    perfiles.push({ texto, resultados: r?.resultados.length ?? null, ms: Date.now() - t });
  }
  return Response.json({ ms: Date.now() - inicio, perfiles });
}
