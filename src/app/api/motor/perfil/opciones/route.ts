import { PREGUNTAS, perfilVacio } from "@/lib/opciones";

// GET → las preguntas del paso 1 con sus opciones, y un perfil vacío de ejemplo.
// La nube de preguntas se pinta con esto y construye el PerfilCiudadano sin IA.
export function GET() {
  return Response.json({ preguntas: PREGUNTAS, perfilVacio: perfilVacio() });
}
