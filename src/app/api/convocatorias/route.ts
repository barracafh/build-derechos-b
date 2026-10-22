import copia from "../../../../datos/bdns-convocatorias-cv.json";
import { desdeCopia, type RespuestaConvocatorias } from "../../../lib/bdns";

// GET devuelve las convocatorias ya normalizadas. De momento salen de la copia
// de respaldo; aquí irá la consulta en vivo a la API de la BDNS, con la copia
// como respaldo si la API no responde.
export async function GET() {
  const respuesta: RespuestaConvocatorias = {
    fuente: "copia",
    consultado: copia.consultado,
    convocatorias: copia.convocatorias.map(desdeCopia),
  };
  return Response.json(respuesta);
}
