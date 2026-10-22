"use client";
// Cómo se vería la respuesta del motor: resumen legible encima del JSON.
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type {
  Convocatoria,
  PerfilCiudadano,
  PeticionBdns,
  RespuestaBuscar,
} from "@/lib/bdns/tipos";

const ESTADO: Record<Convocatoria["estado"], string> = {
  abierta: "Abierta",
  proxima: "Próxima",
  permanente: "Permanente",
  consultar: "Plazo en texto",
  cerrada: "Cerrada",
};

const fecha = (s: string | null) => (s ? s.split("-").reverse().join("/") : "—");

function TarjetaConvocatoria({
  c,
  motivo,
  aComprobar,
  encaje,
}: {
  c: Convocatoria;
  motivo?: string;
  aComprobar?: string[];
  encaje?: string;
}) {
  return (
    <Card render={<article />} className="gap-3 px-5 py-5 text-base">
      <div className="flex flex-wrap gap-2">
        <Badge variant={c.estado === "abierta" ? "default" : "outline"}>{ESTADO[c.estado]}</Badge>
        <Badge variant="outline">{c.ambito}</Badge>
        {encaje && <Badge variant="secondary">encaje {encaje}</Badge>}
        <span className="font-mono text-xs text-(--text-secondary)">BDNS {c.numeroBDNS}</span>
      </div>
      <h4 className="font-medium [overflow-wrap:anywhere]">{c.titulo}</h4>
      <p className="text-sm text-(--text-secondary)">
        {[c.organo.nivel2, c.organo.nivel3].filter(Boolean).join(" · ")}
      </p>
      {motivo && <p>{motivo}</p>}
      {aComprobar && aComprobar.length > 0 && (
        <ul className="list-disc pl-5 text-sm">
          {aComprobar.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      )}
      <p className="text-sm">
        <span className="text-(--text-secondary)">Plazo: </span>
        {c.plazo.inicio || c.plazo.fin
          ? `${fecha(c.plazo.inicio)} → ${fecha(c.plazo.fin)}`
          : c.plazo.textoFin ?? "Consulta la ficha"}
      </p>
      <a
        href={c.urlFicha}
        className="w-fit font-mono text-sm underline underline-offset-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        Ficha oficial ↗
      </a>
    </Card>
  );
}

function Lista({ titulo, items }: { titulo: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <h4 className="text-sm font-medium text-(--text-secondary)">{titulo}</h4>
      <ul className="mt-1 list-disc pl-5 text-sm">
        {items.map((x) => (
          <li key={x}>{x}</li>
        ))}
      </ul>
    </div>
  );
}

// «Hemos entendido: 24 años, en paro…» a partir del perfil estructurado.
export function resumenPerfil(p: PerfilCiudadano) {
  const lugar = p.ubicacion.municipio ?? p.ubicacion.provincia ?? p.ubicacion.ccaa;
  return [
    lugar,
    p.tipoPersona && (p.tipoPersona === "juridica" ? "entidad (persona jurídica)" : "persona física"),
    p.edad != null && `${p.edad} años`,
    p.situacion,
    p.hijos != null && `${p.hijos} hijos`,
    p.vivienda,
    p.ingresos && `ingresos ${p.ingresos}`,
    p.temas.length > 0 && `temas: ${p.temas.join(", ")}`,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function TablaPeticiones({ peticiones }: { peticiones: PeticionBdns[] }) {
  if (!peticiones?.length) return null;
  return (
    <details className="rounded-xl ring-1 ring-foreground/10">
      <summary className="cursor-pointer px-4 py-3 text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
        Peticiones a la BDNS ({peticiones.length}, {peticiones.filter((p) => p.cache).length} desde caché)
      </summary>
      <ol className="divide-y border-t font-mono text-xs">
        {peticiones.map((p, i) => (
          <li key={i} className="grid gap-1 px-4 py-2">
            <span className="text-(--text-secondary)">
              {p.cache ? "caché" : "red"} · {p.ok === false ? "error" : `${p.resultados ?? "—"} resultados`}
              {p.ms != null && !p.cache ? ` · ${p.ms} ms` : ""}
            </span>
            <a href={p.url} className="break-all underline-offset-4 hover:underline">
              {decodeURIComponent(p.url.replace("https://www.infosubvenciones.es/bdnstrans/api", ""))}
            </a>
          </li>
        ))}
      </ol>
    </details>
  );
}

export function VistaBuscar(json: unknown) {
  const r = json as RespuestaBuscar;
  return (
    <div className="grid gap-4">
      <Card className="gap-3 bg-muted px-5 py-5 text-base ring-0">
        <p>
          <span className="text-(--text-secondary)">Hemos entendido: </span>
          {resumenPerfil(r.perfil) || "—"}
        </p>
        <p className="font-mono text-xs text-(--text-secondary) [overflow-wrap:anywhere]">
          temas {r.filtros.temas.join(", ") || "—"} · finalidades {JSON.stringify(r.filtros.finalidades)} ·
          beneficiarios {JSON.stringify(r.filtros.tiposBeneficiario)} · palabras {r.filtros.palabrasClave.join(", ")}
        </p>
        <Lista titulo="Consultado" items={r.consultado} />
        <Lista titulo="No consultado" items={r.noConsultado} />
        <Lista titulo="Avisos" items={r.avisos} />
        <p className="font-mono text-xs text-(--text-secondary)">
          origen {r.origen} · {r.cita} · {new Date(r.consultadoEn).toLocaleString("es-ES")}
        </p>
      </Card>
      <TablaPeticiones peticiones={r.peticionesBdns} />
      {r.sinCoincidencias && <p>{r.sinCoincidencias}</p>}
      {r.resultados.map((x) => (
        <TarjetaConvocatoria
          key={x.convocatoria.numeroBDNS}
          c={x.convocatoria}
          motivo={x.motivo}
          aComprobar={x.aComprobar}
          encaje={x.encaje}
        />
      ))}
    </div>
  );
}

export function VistaLista(json: unknown) {
  const r = json as {
    consultado: string[];
    noConsultado: string[];
    avisos: string[];
    total: number;
    convocatorias: Convocatoria[];
    peticionesBdns: PeticionBdns[];
  };
  return (
    <div className="grid gap-4">
      <Card className="gap-3 bg-muted px-5 py-5 text-base ring-0">
        <p>
          {r.convocatorias.length} convocatorias mostradas de {r.total} encontradas en la búsqueda.
        </p>
        <Lista titulo="Consultado" items={r.consultado} />
        <Lista titulo="No consultado" items={r.noConsultado} />
        <Lista titulo="Avisos" items={r.avisos} />
      </Card>
      <TablaPeticiones peticiones={r.peticionesBdns} />
      {r.convocatorias.map((c) => (
        <TarjetaConvocatoria key={c.numeroBDNS} c={c} />
      ))}
    </div>
  );
}

export function VistaFicha(json: unknown) {
  return <TarjetaConvocatoria c={(json as { convocatoria: Convocatoria }).convocatoria} />;
}
