// Los títulos de la BDNS son el texto de la resolución («Resolución de 18 de
// agosto de 2026, de la Vicepresidencia…, por la que se convocan las ayudas del
// Bono Alquiler Joven para 2026»). Para la lista nos quedamos con lo que se convoca.
const CORTES = /(?:se convocan?|convocatoria (?:de|del|para)|convocatoria|se aprueban? las bases reguladoras (?:de|del|para))\s+/gi;

export function tituloCorto(titulo: string, max = 80) {
  let t = titulo.replace(/\s+/g, " ").trim();
  // Lo que va tras el último «se convoca(n)» / «convocatoria de…».
  let corte = -1;
  for (const m of t.matchAll(CORTES)) if (t.length - (m.index + m[0].length) > 12) corte = m.index + m[0].length;
  if (corte > 0) t = t.slice(corte);
  t = t
    .replace(/^(de |del |para )?(las|los|la|el|unas|unos)\s+/i, "")
    .replace(/^(subvenciones|ayudas), a través de procedimiento de concurrencia competitiva,?\s*/i, "$1 ")
    .replace(/[.;:,\s]+$/, "");
  // Todo en mayúsculas → frase normal.
  if (t === t.toUpperCase()) t = t.toLowerCase();
  t = t.charAt(0).toUpperCase() + t.slice(1);
  return t.length > max ? `${t.slice(0, max).replace(/\s+\S*$/, "")}…` : t;
}
