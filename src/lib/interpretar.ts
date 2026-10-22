// Paso 1 para el chat y el buscador: mensaje (y perfil previo) → PerfilCiudadano.
// La nube de preguntas no pasa por aquí: el front construye el perfil directamente.
// El mensaje no se guarda ni se registra: solo viaja a HelmCode en esta llamada.
import { completar } from "./ia";
import { detectarMunicipio } from "./bdns/territorio";
import type { PerfilCiudadano, Tema } from "./bdns/tipos";
import {
  PREGUNTAS,
  combinarPerfiles,
  faltan,
  perfilVacio,
  validarPerfil,
} from "./opciones";

const catalogo = PREGUNTAS.map((p) =>
  "opciones" in p
    ? `- ${p.id}: ${p.opciones.map((o) => `"${o.valor}" (${o.etiqueta})`).join(", ")}`
    : `- ${p.id}: ${p.tipo === "numero" ? "número entero o null" : "objeto { municipio, provincia, ccaa }, cada uno texto o null"}`,
).join("\n");

const SISTEMA = `Conviertes lo que cuenta una persona sobre su situación en un perfil para buscar ayudas públicas en España.
Recibes un mensaje. Responde SOLO con un JSON, sin texto alrededor, que tenga ÚNICAMENTE las claves que el mensaje dice (omite el resto), con estas claves y valores:
${catalogo}
Reglas:
- Usa null si no se dice. No deduzcas ni inventes datos.
- municipio: nombre oficial si lo dice (p. ej. "València", "Castelló de la Plana"). Si solo dice una comarca, municipio null, pero rellena la provincia si es inequívoca.
- tipoPersona: "juridica" si quien pide es una entidad (asociación, fundación, empresa, sociedad, club…); "fisica" si es una persona, también si es autónoma (eso va en situacion: "autonomo"); null si no está claro.
- sexo: solo si se deduce sin duda del mensaje ("soy madre" → "mujer"); si no, null.
- discapacidad y familia: solo si se dicen expresamente.
- temas: solo los que la persona pide o describe como necesidad.`;

export function leerJson(s: string): unknown {
  const m = s.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (!m) throw new Error("La IA no devolvió JSON");
  return JSON.parse(m[0]);
}

export type Interpretacion = {
  perfil: PerfilCiudadano;
  faltan: ReturnType<typeof faltan>;
  conIa: boolean;
};

export async function interpretar(
  mensaje: string,
  previo: PerfilCiudadano = perfilVacio(),
): Promise<Interpretacion> {
  let perfil: PerfilCiudadano;
  let conIa = true;
  try {
    const r = await completar([
      { role: "system", content: SISTEMA },
      { role: "user", content: mensaje },
    ], { rapido: true });
    // Se combina con el previo por si la IA olvida algo de lo que ya sabíamos.
    perfil = combinarPerfiles(previo, validarPerfil(leerJson(r)));
  } catch {
    conIa = false;
    const nuevo = heuristico(mensaje);
    if (!nuevo.ubicacion.municipio)
      nuevo.ubicacion.municipio = await detectarMunicipio(mensaje).catch(() => null);
    perfil = combinarPerfiles(previo, nuevo);
  }
  return { perfil, faltan: faltan(perfil), conIa };
}

// Sin IA (falta la clave o HelmCode no responde): reglas sencillas.
function heuristico(texto: string): PerfilCiudadano {
  const t = texto.toLowerCase();
  const tiene = (re: RegExp) => re.test(t);
  const p = perfilVacio();
  p.situacion = tiene(/aut[oó]nom/) ? "autonomo"
    : tiene(/\bparo\b|desemplead|sin trabajo/) ? "paro"
    : tiene(/jubilad|pensi[oó]n/) ? "jubilado"
    : tiene(/estudi/) ? "estudiante"
    : tiene(/trabaj/) ? "empleo" : null;
  if (tiene(/asociaci[oó]n|fundaci[oó]n|empresa|sociedad|\bs\.?l\.?\b|cooperativa|\bclub\b|\bong\b/))
    p.tipoPersona = "juridica";
  else if (tiene(/\b(soy|tengo|vivo|estoy)\b/)) p.tipoPersona = "fisica";
  p.vivienda = tiene(/alquiler/) ? "alquiler" : tiene(/propiedad|hipoteca/) ? "propiedad" : null;
  p.ingresos = tiene(/ingresos bajos|pocos ingresos|pensi[oó]n m[ií]nima|no llego/) ? "bajos" : null;
  p.sexo = tiene(/\b(mujer|madre|soy una|jubilada|parada|autónoma|autonoma|viuda)\b/) ? "mujer"
    : tiene(/\b(hombre|padre|jubilado|parado|viudo)\b/) ? "hombre" : null;
  p.familia = tiene(/familia numerosa/) ? "numerosa" : tiene(/monoparental/) ? "monoparental" : null;
  if (tiene(/discapacidad|minusval/)) p.discapacidad = "si";
  const edad = t.match(/(\d{1,3})\s*años/);
  if (edad) p.edad = Number(edad[1]);
  const hijos = t.match(/(\d+)\s*hij/);
  if (hijos) p.hijos = Number(hijos[1]);
  else if (tiene(/sin hijos/)) p.hijos = 0;
  const temas: [RegExp, Tema][] = [
    [/luz|electric|energ|factura|gas\b/, "energia"],
    [/salud|m[eé]dic|tratamiento/, "salud"],
    [/beca|estudi|colegio|libros|comedor/, "educacion"],
    [/transporte|autob[uú]s|metro/, "transporte"],
    [/negocio|emprend/, "emprendimiento"],
  ];
  p.temas = temas.filter(([re]) => tiene(re)).map(([, tema]) => tema);
  return p;
}
