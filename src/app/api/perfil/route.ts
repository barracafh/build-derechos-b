import { completar } from "../../../lib/ia";
import { limpiarPerfil } from "../../../lib/perfil";

// POST {"texto": "…", "perfil": {…}} devuelve {"perfil": {…}}. La IA solo pasa
// el texto a campos; qué ayudas encajan lo deciden las reglas de lib/ayudas.
// No se guarda ni se registra el texto.
const instrucciones = `Extrae el perfil de una persona a partir de lo que cuenta. Responde SOLO con un objeto JSON, sin texto alrededor.
Campos (omite los que no se digan; no supongas nada):
- edad: número entero
- situacion: "paro" | "trabaja" | "autonomo" | "jubilado" | "estudia" | "otra"
- vivienda: "alquiler" | "propiedad" | "otra"
- hijos: número de hijos o hijas menores a cargo (0 si dice que no tiene)
- hijosEscolares: true si algún hijo va al colegio o instituto
- ingresosBajos: true si dice que tiene ingresos bajos, pocos ingresos, ninguno o pensión mínima; false si dice que no son bajos
- pensionMinima: true si dice que cobra la pensión mínima
- zona: "valencia" (ciudad de València) | "cv" (otro municipio de la Comunitat Valenciana) | "fuera"
- municipio: nombre del municipio o comarca si lo dice
- dana: true si pregunta por ayudas de la DANA
Si te dan un perfil anterior, actualízalo con lo nuevo y devuelve el perfil completo.`;

export async function POST(req: Request) {
  const { texto, perfil } = await req.json().catch(() => ({}));
  if (typeof texto !== "string" || !texto.trim() || texto.length > 2000)
    return Response.json(
      { error: "Cuéntanos tu situación en hasta 2.000 caracteres." },
      { status: 400 },
    );

  let respuesta: string;
  try {
    respuesta = await completar([
      { role: "system", content: instrucciones },
      {
        role: "user",
        content: `Perfil anterior: ${JSON.stringify(limpiarPerfil(perfil))}\nTexto: ${texto}`,
      },
    ]);
  } catch {
    return Response.json(
      { error: "No hemos podido entender el texto ahora. Prueba con el formulario." },
      { status: 503 },
    );
  }

  const json = respuesta.match(/\{[\s\S]*\}/)?.[0];
  try {
    return Response.json({ perfil: limpiarPerfil(JSON.parse(json ?? "")) });
  } catch {
    return Response.json(
      { error: "No hemos podido entender el texto. Prueba a contarlo de otra forma o usa el formulario." },
      { status: 502 },
    );
  }
}
