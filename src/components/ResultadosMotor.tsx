import { ChevronDown } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Fuentes } from "@/components/Fuentes";
import type { Convocatoria, RespuestaBuscar, Resultado } from "@/lib/bdns/tipos";
import { tituloCorto } from "@/lib/titulo-corto";

// Resultados del motor (POST /api/buscar). Cada ayuda es una línea con su
// título corto; al pulsarla se abre el detalle: motivo, plazo, qué comprobar y
// la ficha oficial.

const ambitos = { estatal: "Estado", autonomica: "Generalitat", local: "Ayuntamiento o diputación" };

const fecha = (iso: string) => iso.split("-").reverse().join("/");

export function textoPlazo(c: Convocatoria) {
  if (c.estado === "abierta") return c.plazo.fin ? `Abierta hasta el ${fecha(c.plazo.fin)}` : "Abierta";
  if (c.estado === "proxima") return c.plazo.inicio ? `Se abre el ${fecha(c.plazo.inicio)}` : "Próximamente";
  if (c.estado === "permanente") return "Se puede pedir en cualquier momento";
  return "Plazo en la ficha oficial";
}

// El motivo empieza por el resumen de la ayuda; «Podrías optar: …» es lo personal.
function partirMotivo(motivo: string) {
  const i = motivo.indexOf(" Podrías optar:");
  return i > 0
    ? { resumen: motivo.slice(0, i), porQue: motivo.slice(i + 1) }
    : { resumen: motivo, porQue: null };
}

export function AyudaPlegable({ r }: { r: Resultado }) {
  const { convocatoria: c, motivo, aComprobar, encaje } = r;
  const { resumen, porQue } = partirMotivo(motivo);
  return (
    <details className="group rounded-xl bg-background ring-1 ring-foreground/10 open:ring-foreground/25">
      <summary className="flex cursor-pointer list-none items-start gap-3 rounded-xl px-4 py-3 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
        <span
          aria-hidden="true"
          className={`mt-2 size-2 shrink-0 rounded-full ${encaje === "alto" ? "bg-brand" : "bg-foreground/25"}`}
        />
        <span className="min-w-0 flex-1">
          <span className="block font-medium leading-snug">{tituloCorto(c.titulo)}</span>
          <span className="mt-0.5 block text-sm text-(--text-secondary)">
            {ambitos[c.ambito]} · {textoPlazo(c)}
          </span>
        </span>
        <ChevronDown
          aria-hidden="true"
          className="mt-1 size-5 shrink-0 text-(--text-secondary) transition-transform group-open:rotate-180 motion-reduce:transition-none"
        />
      </summary>
      <div className="grid gap-3 px-4 pt-1 pb-4 text-base [&>*]:ml-5">
        <p>{resumen}</p>
        {porQue && <p className="font-medium">{porQue}</p>}
        {aComprobar.length > 0 && (
          <div>
            <p className="text-sm font-medium text-(--text-secondary)">Tienes que comprobar</p>
            <ul className="mt-1 grid list-disc gap-1 pl-5">
              {aComprobar.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </div>
        )}
        <p className="text-sm text-(--text-secondary) [overflow-wrap:anywhere]">{c.titulo}</p>
        <div>
          <a href={c.urlFicha} className={buttonVariants({ variant: "outline", size: "lg" })}>
            Ver la ficha oficial <span aria-hidden="true">↗</span>
          </a>
        </div>
      </div>
    </details>
  );
}

export function ResultadosMotor({ r }: { r: RespuestaBuscar }) {
  const consultado = new Date(r.consultadoEn).toLocaleDateString("es-ES", { timeZone: "Europe/Madrid" });
  return (
    <section id="resultado" aria-labelledby="resultado-titulo" className="[&>*+*]:mt-6">
      <div>
        <h2 id="resultado-titulo" className="text-3xl leading-tight tracking-[-0.01em]">
          {r.resultados.length
            ? `${r.resultados.length} ayudas a las que podrías optar`
            : "No hemos encontrado ayudas que encajen"}
        </h2>
        <p className="mt-2 text-base text-(--text-secondary)">
          Pulsa una para ver por qué podría encajarte y dónde pedirla.
        </p>
      </div>

      {r.sinCoincidencias && <p className="text-base">{r.sinCoincidencias}</p>}

      <div className="grid gap-2">
        {r.resultados.map((x) => (
          <AyudaPlegable key={x.convocatoria.numeroBDNS} r={x} />
        ))}
      </div>

      <details className="text-base text-(--text-secondary)">
        <summary className="cursor-pointer rounded-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          Qué hemos consultado
        </summary>
        <div className="mt-3 grid gap-2">
          <p>
            {r.consultado.join(", ") || "La BDNS"}.
            {r.noConsultado.length > 0 && ` No hemos podido mirar: ${r.noConsultado.join("; ")}.`}
          </p>
          {r.avisos.map((a) => (
            <p key={a}>{a}</p>
          ))}
        </div>
      </details>

      <Fuentes
        fuentes={[
          { nombre: "Base de Datos Nacional de Subvenciones (BDNS)", url: "https://www.infosubvenciones.es/bdnstrans/GE/es/convocatorias" },
        ]}
      />
      <p className="text-base text-(--text-secondary)">
        {r.cita}. Datos consultados el {consultado}.
      </p>
    </section>
  );
}
