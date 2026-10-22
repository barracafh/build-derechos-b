// PerfilCiudadano → RespuestaBuscar (pasos 2 a 6). Lo usa POST /api/buscar.
import { buscarConvocatorias } from "./bdns/buscar";
import { conRegistro } from "./bdns/cliente";
import { resolverTerritorio } from "./bdns/territorio";
import { CITA, type Indice, type PerfilCiudadano, type RespuestaBuscar } from "./bdns/tipos";
import { explicar } from "./explicar";
import { derivarFiltros } from "./opciones";
import { interpretar } from "./interpretar";
import { buscarEnIndice, indicePara } from "./indice/buscar";

export async function buscar(perfil: PerfilCiudadano): Promise<RespuestaBuscar> {
  // Si hay índice local para su municipio: sin BDNS ni IA, y con los requisitos.
  const local = process.env.MOTOR_SIN_INDICE === "1" ? null : await indicePara(perfil);
  if (local) return buscarLocal(perfil, local.indice, local.consultado);
  const { resultado, peticiones } = await conRegistro(() => buscarSinRegistro(perfil));
  return { ...resultado, peticionesBdns: peticiones };
}

// Atajo para el buscador de una sola caja: paso 1 con IA y después buscar().
export async function buscarPorTexto(texto: string): Promise<RespuestaBuscar> {
  const { perfil, conIa } = await interpretar(texto);
  const r = await buscar(perfil);
  if (!conIa && !r.avisos.some((a) => a.startsWith("La IA")))
    r.avisos.push("La IA no está disponible: el perfil se ha sacado con reglas sencillas.");
  return r;
}

async function buscarSinRegistro(
  perfil: PerfilCiudadano,
): Promise<Omit<RespuestaBuscar, "peticionesBdns">> {
  const territorio = await resolverTerritorio(perfil.ubicacion).catch(() => ({
    nuts: null,
    ccaa: null,
    diputacion: null,
    municipio: null,
    noResuelto: ["Territorio: no se ha podido consultar el catálogo de la BDNS"],
  }));

  const filtros = derivarFiltros(perfil);
  const datos = await buscarConvocatorias(territorio, {
    palabrasClave: filtros.palabrasClave,
    finalidades: filtros.finalidades,
    tiposBeneficiario: filtros.tiposBeneficiario,
    limite: 10,
    meses: 12,
  });

  const { resultados, conIa } = await explicar(perfil, datos.convocatorias);
  const avisos = [...datos.avisos];
  if (!conIa)
    avisos.push("La IA no está disponible: el resultado se ha calculado con reglas sencillas.");

  return {
    perfil,
    filtros,
    consultado: datos.consultado,
    noConsultado: territorio.noResuelto,
    origen: datos.origen,
    consultadoEn: new Date().toISOString(),
    cita: CITA,
    avisos,
    resultados,
    sinCoincidencias: resultados.length
      ? null
      : `No hemos encontrado convocatorias abiertas que encajen en ${datos.consultado.join(", ") || "la BDNS"}. ` +
        "Esto no quiere decir que no haya ayudas para ti: consulta la BDNS o los servicios sociales de tu ayuntamiento.",
  };
}

function buscarLocal(perfil: PerfilCiudadano, indice: Indice, consultado: string[]): RespuestaBuscar {
  const { resultados, preguntasUtiles, descartadas } = buscarEnIndice(perfil, indice);
  const fecha = new Date(indice.generado).toLocaleDateString("es-ES", { timeZone: "Europe/Madrid" });
  const avisos = [`Datos de la BDNS a ${fecha}. Comprueba el plazo y los requisitos en la ficha oficial.`];
  if (descartadas)
    avisos.push(`Se han descartado ${descartadas} convocatorias cuyos requisitos no encajan con tu perfil.`);
  return {
    perfil,
    filtros: derivarFiltros(perfil),
    consultado,
    noConsultado: [],
    origen: "indice",
    consultadoEn: indice.generado,
    cita: CITA,
    avisos,
    resultados,
    sinCoincidencias: resultados.length
      ? null
      : `No hemos encontrado convocatorias abiertas que encajen en ${consultado.join(", ")}. ` +
        "Esto no quiere decir que no haya ayudas para ti: consulta la BDNS o los servicios sociales de tu ayuntamiento.",
    preguntasUtiles,
    peticionesBdns: [],
  };
}
