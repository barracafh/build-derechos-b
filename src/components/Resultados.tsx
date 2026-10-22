import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Fuentes, type Source } from "@/components/Fuentes";
import type { Busqueda, Resultado } from "@/lib/ayudas";
import {
  convocatoriasPara,
  type ConvocatoriaEncaja,
  type RespuestaConvocatorias,
} from "@/lib/bdns";
import { resumenPerfil, type Perfil } from "@/lib/perfil";

const sedeGva = "https://sede.gva.es";
const bdnsWeb = "https://www.infosubvenciones.es/bdnstrans/GE/es/convocatorias";
const ambitos = {
  estatal: "Estado",
  autonomica: "Generalitat Valenciana",
  local: "Ayuntamiento de València",
};

const fechaHora = (iso: string) =>
  new Date(iso).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

function Convocatoria({ c }: { c: ConvocatoriaEncaja }) {
  const { convocatoria, estado } = c;
  return (
    <Card render={<article />} className="gap-4 px-6 py-6 text-base">
      <div>
        <h4 className="leading-snug font-medium [overflow-wrap:anywhere]">
          {convocatoria.titulo}
        </h4>
        <p className="mt-1 text-(--text-secondary)">
          {ambitos[convocatoria.ambito]} · {convocatoria.organo.toLowerCase()}
        </p>
      </div>
      <p>
        <span className="font-medium">{estado.texto}.</span> {estado.nota}
      </p>
      <p>
        <span className="text-(--text-secondary)">
          Por qué podría interesarte:{" "}
        </span>
        {c.motivo} Revisa las bases para saber si puedes pedirla.
      </p>
      <div>
        <a
          href={convocatoria.url}
          className={buttonVariants({ variant: "outline", size: "lg" })}
        >
          Ver la ficha oficial <span aria-hidden="true">↗</span>
        </a>
      </div>
    </Card>
  );
}

function Convocatorias({
  perfil,
  bdns,
}: {
  perfil: Perfil;
  bdns: RespuestaConvocatorias;
}) {
  const { encajan, cerradas } = convocatoriasPara(bdns.convocatorias, perfil);
  return (
    <div>
      <h3 className="text-sm font-medium text-(--text-secondary)">
        Convocatorias publicadas en la BDNS
      </h3>
      <p className="mt-3 text-base">
        {encajan.length
          ? "Convocatorias para personas físicas del Estado, la Generalitat y el Ayuntamiento de València que podrían interesarte."
          : "No encuentro convocatorias abiertas de la BDNS que encajen con estos datos."}
        {cerradas > 0 && ` Otras ${cerradas} que encajan ya han cerrado.`}
      </p>
      {encajan.length > 0 && (
        <div className="mt-3 grid gap-3">
          {encajan.map((c) => (
            <Convocatoria key={c.convocatoria.numero} c={c} />
          ))}
        </div>
      )}
      <p className="mt-3 text-base text-(--text-secondary)">
        Origen de los datos: Intervención General de la Administración del
        Estado. Consultado el {fechaHora(bdns.consultado)}
        {bdns.fuente === "copia" && " (copia de respaldo)"}.
      </p>
    </div>
  );
}

function SinVerificar({ r }: { r: Resultado }) {
  if (r.ayuda.verificado) return null;
  return (
    <p className="rounded-lg bg-(--warning) px-4 py-3 text-base text-(--warning-foreground)">
      No podemos confirmar cómo se pide ahora: la ley de esta ayuda cambió el
      20/10/2026 y el procedimiento nuevo no está publicado. Pregunta en los
      servicios sociales de tu ayuntamiento o llama al 012.
    </p>
  );
}

function Requisitos({ r }: { r: Resultado }) {
  return (
    <div>
      <h4 className="text-sm font-medium text-(--text-secondary)">
        Requisitos que tienes que comprobar
      </h4>
      <ul className="mt-2 grid list-disc gap-2 pl-5">
        {r.ayuda.requisitos_clave.map((req) => (
          <li key={req}>{req}</li>
        ))}
      </ul>
    </div>
  );
}

function Principal({ r }: { r: Resultado }) {
  const { ayuda, estado } = r;
  const tramite = ayuda.enlace_tramite;
  return (
    <article className="[&>*+*]:mt-8">
      <div>
        <h3 className="text-2xl leading-tight font-medium">{ayuda.titulo}</h3>
        <p className="mt-2 text-base text-(--text-secondary)">
          {ayuda.organismo}
        </p>
      </div>

      {/* Una sola tarjeta con el sol por vista: el plazo de la ayuda principal. */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
        <Card
          render={<section />}
          className="gap-2 bg-muted px-6 py-6 text-base ring-0"
        >
          <h4 className="text-sm font-medium text-(--text-secondary)">
            Por qué podría encajar
          </h4>
          {r.motivos.map((m) => (
            <p key={m}>{m}</p>
          ))}
        </Card>
        <Card
          render={<section />}
          className="gap-2 px-6 py-6 text-base ring-0 [background:radial-gradient(120%_90%_at_100%_0%,#ffd34d_0%,rgba(255,211,77,0)_60%),var(--brand-yellow)]"
        >
          <h4 className="text-sm font-medium">Plazo</h4>
          <p className="font-medium">{estado.texto}</p>
          {estado.nota && <p>{estado.nota}</p>}
        </Card>
      </div>

      <SinVerificar r={r} />
      <Requisitos r={r} />

      <div>
        <h4 className="text-sm font-medium text-(--text-secondary)">
          Cómo pedirla
        </h4>
        <ol className="mt-4 grid gap-5">
          {ayuda.pasos.map((paso, i) => (
            <li
              key={paso}
              className="grid grid-cols-[24px_minmax(0,1fr)] gap-x-3 md:grid-cols-[32px_minmax(0,1fr)] md:gap-x-4"
            >
              <span className="text-[22px] leading-[1.1] font-light text-brand tabular-nums md:text-[26px]">
                {i + 1}
              </span>
              <p>{paso}</p>
            </li>
          ))}
        </ol>
      </div>

      <Card
        render={<section />}
        className="flex-row flex-wrap items-center justify-between gap-x-6 gap-y-4 px-6 py-6 text-base"
      >
        <div className="min-w-0 flex-[1_1_260px]">
          <p className="text-sm text-(--text-secondary)">Dónde se hace</p>
          <h4 className="mt-1 text-lg leading-[1.35] font-medium">
            {tramite
              ? ayuda.organismo.split(" (")[0]
              : "En los servicios sociales de tu ayuntamiento o en el 012"}
          </h4>
          <p className="mt-1 font-mono text-sm [overflow-wrap:anywhere] text-(--text-secondary)">
            {new URL(tramite ?? sedeGva).hostname}
          </p>
        </div>
        <a
          href={tramite ?? sedeGva}
          className={cn(
            buttonVariants({ variant: "outline", size: "lg" }),
            "max-md:w-full",
          )}
        >
          {tramite ? "Ir a solicitarla" : "Buscar en la sede"}{" "}
          <span aria-hidden="true">↗</span>
        </a>
      </Card>
    </article>
  );
}

// La acción principal de la pantalla: pedir la ayuda que mejor encaja. Al pasar
// el ratón sube el sol de Sol (--brand-sun) y se balancea; quieto si se pide
// menos movimiento.
function PedirAyuda({ r }: { r: Resultado }) {
  const { ayuda, estado } = r;
  const enlace = ayuda.enlace_tramite ?? sedeGva;
  return (
    <a
      href={enlace}
      className="group relative isolate flex flex-wrap items-center justify-between gap-x-6 gap-y-4 overflow-hidden rounded-2xl bg-primary px-6 py-6 text-primary-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:px-8 md:py-8"
    >
      <span
        aria-hidden="true"
        className="absolute inset-0 -z-1 bg-(image:--brand-sun) bg-size-[160%_100%] bg-position-[50%_100%] bg-no-repeat opacity-40 translate-y-[45%] [transition:opacity_300ms_linear,translate_500ms_var(--ease-brand)] group-hover:translate-y-[12%] group-hover:animate-[sol-baila_2.4s_ease-in-out_infinite_alternate] group-hover:opacity-100 group-focus-visible:translate-y-[12%] group-focus-visible:opacity-100 motion-reduce:animate-none motion-reduce:transition-none"
      />
      <span className="min-w-0 flex-[1_1_280px]">
        <span className="block text-base text-primary-foreground/80">
          Lo primero que puedes pedir
        </span>
        <span className="mt-1 block text-[clamp(24px,3.5vw,30px)] leading-tight font-medium tracking-[-0.02em]">
          {ayuda.titulo.split(" (")[0]}
        </span>
        <span className="mt-2 block text-base text-primary-foreground/80">
          {estado.texto} · {new URL(enlace).hostname}
        </span>
      </span>
      <span className="inline-flex h-12 items-center gap-2 rounded-xl bg-background px-5 text-base font-medium text-foreground max-md:w-full max-md:justify-center">
        {ayuda.enlace_tramite ? "Pedir la ayuda" : "Buscar en la sede"}
        <span
          aria-hidden="true"
          className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transition-none"
        >
          ↗
        </span>
      </span>
    </a>
  );
}

function Compacta({ r }: { r: Resultado }) {
  const { ayuda, estado } = r;
  const cerrada = estado.clave === "cerrada";
  return (
    <Card
      render={<article />}
      className={cn("gap-4 px-6 py-6 text-base", cerrada && "bg-muted ring-0")}
    >
      <div>
        <h4 className="text-lg leading-snug font-medium">{ayuda.titulo}</h4>
        <p className="mt-1 font-mono text-sm text-(--text-secondary)">
          {ayuda.administracion}
        </p>
      </div>
      <p>
        <span className="font-medium">{estado.texto}.</span> {estado.nota}
      </p>
      <p>
        <span className="text-(--text-secondary)">
          Por qué podría encajar:{" "}
        </span>
        {r.motivos.join(" ")}
      </p>
      <SinVerificar r={r} />
      {!cerrada && <Requisitos r={r} />}
      <div className="flex flex-wrap gap-2">
        <a
          href={ayuda.enlace_info}
          className={buttonVariants({ variant: "outline", size: "lg" })}
        >
          Más información <span aria-hidden="true">↗</span>
        </a>
        {!cerrada &&
          ayuda.enlace_tramite &&
          ayuda.enlace_tramite !== ayuda.enlace_info && (
            <a
              href={ayuda.enlace_tramite}
              className={buttonVariants({ variant: "outline", size: "lg" })}
            >
              Solicitar <span aria-hidden="true">↗</span>
            </a>
          )}
      </div>
    </Card>
  );
}

export function Resultados({
  perfil,
  busqueda,
  bdns,
}: {
  perfil: Perfil;
  busqueda: Busqueda;
  bdns: RespuestaConvocatorias | "error" | null;
}) {
  const { podrias, cerradas } = busqueda;
  const [principal, ...resto] = podrias;
  const huecos = [...busqueda.huecos];
  if (bdns === "error")
    huecos.push("No he podido cargar las convocatorias de la BDNS.");
  else if (bdns?.fuente === "copia")
    huecos.push(
      `Las convocatorias de la BDNS son una copia del ${fechaHora(bdns.consultado)}: puede haber otras más recientes en infosubvenciones.es.`,
    );

  const fuentes: Source[] = [];
  for (const r of [...podrias, ...cerradas])
    if (!fuentes.some((f) => f.url === r.ayuda.enlace_info))
      fuentes.push({ nombre: r.ayuda.titulo, url: r.ayuda.enlace_info });
  if (bdns && bdns !== "error")
    fuentes.push({
      nombre: "Base de Datos Nacional de Subvenciones",
      url: bdnsWeb,
    });
  if (huecos.length)
    fuentes.push({ nombre: "Sede de la Generalitat", url: sedeGva });

  return (
    <section
      aria-labelledby="resultado"
      aria-live="polite"
      className="text-lg [&>*+*]:mt-12"
    >
      <div>
        <h2
          id="resultado"
          className="font-sans text-[clamp(30px,5vw,44px)] leading-[1.08] tracking-[-0.03em]"
        >
          ¿A qué ayudas podrías optar?
        </h2>
        <p className="mt-3 text-[15px] text-(--text-secondary)">
          {resumenPerfil(perfil) || "Sin datos todavía"}
        </p>
        <p className="mt-4">
          {podrias.length
            ? `Podrías optar a ${podrias.length} ${podrias.length === 1 ? "ayuda" : "ayudas"}. Esto no garantiza que te la concedan: comprueba los requisitos en la web oficial.`
            : "Con estos datos no encuentro ayudas abiertas que encajen. Eso no significa que no haya ninguna: revisa lo que no he podido consultar o pregunta en los servicios sociales o en el 012."}
        </p>
      </div>

      {principal && <PedirAyuda r={principal} />}

      {principal && <Principal r={principal} />}

      {resto.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-(--text-secondary)">
            También podrías optar a
          </h3>
          <div className="mt-3 grid gap-3">
            {resto.map((r) => (
              <Compacta key={r.ayuda.id} r={r} />
            ))}
          </div>
        </div>
      )}

      {cerradas.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-(--text-secondary)">
            Encajan, pero el plazo está cerrado
          </h3>
          <div className="mt-3 grid gap-3">
            {cerradas.map((r) => (
              <Compacta key={r.ayuda.id} r={r} />
            ))}
          </div>
        </div>
      )}

      {bdns === null && (
        <p role="status" className="text-base text-(--text-secondary)">
          Cargando convocatorias de la BDNS…
        </p>
      )}
      {bdns && bdns !== "error" && (
        <Convocatorias perfil={perfil} bdns={bdns} />
      )}

      <Card
        render={<section />}
        className="gap-3 bg-muted px-6 py-6 text-base ring-0"
      >
        <h3 className="text-sm font-medium text-(--text-secondary)">
          Lo que no he podido consultar
        </h3>
        <ul className="grid list-disc gap-2 pl-5">
          {huecos.map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ul>
      </Card>

      <Fuentes fuentes={fuentes} />
    </section>
  );
}
