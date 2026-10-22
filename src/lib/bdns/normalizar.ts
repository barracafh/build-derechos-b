// La ficha de la API y la copia del pack usan nombres distintos (ver SETUP.md,
// «Materiales»). Aquí las dos pasan al mismo tipo Convocatoria.
import { BASE, urlFicha } from "./cliente";
import { calcularEstado } from "./estado";
import type { Ambito, ConvocatoriaInterna } from "./tipos";

type Desc = { descripcion?: string | null };
const textos = (xs: (Desc | string)[] | null | undefined) =>
  (xs ?? [])
    .map((x) => (typeof x === "string" ? x : x.descripcion ?? ""))
    .map((s) => s.trim())
    .filter(Boolean);

export function ambitoDe(nivel1: string | undefined): Ambito {
  const n = (nivel1 ?? "").toUpperCase();
  if (n.startsWith("AUTON")) return "autonomica";
  if (n.startsWith("LOCAL")) return "local";
  return "estatal";
}

export function textoPlano(html: string | null | undefined, max = 1500) {
  if (!html) return null;
  const t = html
    .replace(/<\/p>|<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

export function desdeApi(f: any): ConvocatoriaInterna {
  const indefinido = Boolean(f.abierto);
  const inicio = f.fechaInicioSolicitud ?? null;
  const fin = f.fechaFinSolicitud ?? null;
  const organo = {
    nivel1: f.organo?.nivel1 ?? "",
    nivel2: f.organo?.nivel2 ?? "",
    nivel3: f.organo?.nivel3 ?? "",
  };
  return {
    numeroBDNS: String(f.codigoBDNS),
    titulo: f.descripcion ?? "",
    tituloValenciano: f.descripcionLeng ?? null,
    ambito: ambitoDe(organo.nivel1),
    organo,
    tipoConvocatoria: f.tipoConvocatoria ?? null,
    finalidad: f.descripcionFinalidad ?? null,
    beneficiarios: textos(f.tiposBeneficiarios),
    regiones: textos(f.regiones),
    presupuestoTotal: f.presupuestoTotal ?? null,
    plazo: {
      inicio,
      fin,
      textoInicio: f.textInicio ?? null,
      textoFin: f.textFin ?? null,
      indefinido,
    },
    estado: calcularEstado(inicio, fin, indefinido),
    bases: {
      titulo: f.descripcionBasesReguladoras ?? null,
      url: f.urlBasesReguladoras ?? null,
    },
    sedeElectronica: f.sedeElectronica ?? null,
    anuncios: (f.anuncios ?? []).map((a: any) => ({
      diario: a.desDiarioOficial ?? "",
      fecha: a.datPublicacion ?? "",
      titulo: a.titulo ?? "",
      url: a.url ?? null,
    })),
    documentos: (f.documentos ?? []).map((d: any) => ({
      descripcion: d.descripcion ?? "",
      nombre: d.nombreFic ?? "",
      url: `${BASE}/convocatorias/documentos?idDocumento=${d.id}`,
    })),
    urlFicha: urlFicha(String(f.codigoBDNS)),
    fechaRecepcion: f.fechaRecepcion ?? "",
    extracto: textoPlano(f.anuncios?.[0]?.texto),
  };
}

export function desdeCopia(c: any): ConvocatoriaInterna {
  const p = c.plazoSolicitud ?? {};
  const indefinido = Boolean(p.abierto);
  const inicio = p.fechaInicioSolicitud ?? null;
  const fin = p.fechaFinSolicitud ?? null;
  return {
    numeroBDNS: String(c.numeroBDNS),
    titulo: c.titulo ?? "",
    tituloValenciano: c.tituloLenguaCooficial ?? null,
    ambito: ambitoDe(c.organo?.nivel1),
    organo: {
      nivel1: c.organo?.nivel1 ?? "",
      nivel2: c.organo?.nivel2 ?? "",
      nivel3: c.organo?.nivel3 ?? "",
    },
    tipoConvocatoria: c.tipoConvocatoria ?? null,
    finalidad: c.finalidad ?? null,
    beneficiarios: textos(c.tiposBeneficiario),
    regiones: textos(c.regiones),
    presupuestoTotal: c.presupuestoTotal ?? null,
    plazo: {
      inicio,
      fin,
      textoInicio: p.textoInicio ?? null,
      textoFin: p.textoFin ?? null,
      indefinido,
    },
    estado: calcularEstado(inicio, fin, indefinido),
    bases: {
      titulo: c.basesReguladoras?.titulo ?? null,
      url: c.basesReguladoras?.url ?? null,
    },
    sedeElectronica: c.sedeElectronica ?? null,
    anuncios: (c.publicacionesDiarioOficial ?? []).map((a: any) => ({
      diario: a.diario ?? "",
      fecha: a.fechaPublicacion ?? "",
      titulo: a.titulo ?? "",
      url: a.url ?? null,
    })),
    documentos: (c.documentos ?? []).map((d: any) => ({
      descripcion: d.descripcion ?? "",
      nombre: d.nombreFichero ?? "",
      url: d.url ?? "",
    })),
    urlFicha: c.urlFichaOficial ?? urlFicha(String(c.numeroBDNS)),
    fechaRecepcion: c.fechaRecepcion ?? "",
    extracto: null,
  };
}
