import { Badge } from "@/components/ui/badge";
import { BotonAviso } from "@/components/BotonAviso";
import { Buscador } from "@/components/Buscador";
import { ruta } from "@/config/sitio";
import ficha from "../../ficha.json";

const dominio = (url: string) => new URL(url).hostname.replace(/^www\./, "");

export default function Home() {
  return (
    <>
      <header className="mx-auto flex w-full max-w-(--container-content) flex-wrap items-center justify-between gap-4 px-(--page-gutter) py-3">
        {/* eslint-disable-next-line @next/next/no-img-element -- SVG estático */}
        <img
          src={ruta("/ayudita-logo.svg")}
          alt={ficha.nombre}
          width={242}
          height={56}
          className="h-9 w-auto"
        />
        <Badge variant="outline">
          {ficha.datos === "reales" ? "Datos públicos" : "Datos simulados"}
        </Badge>
      </header>

      <main
        id="contenido"
        tabIndex={-1}
        className="flex flex-1 flex-col px-2 outline-none"
      >
        {/* El sol de Sol sobre tinta: los colores del botón sunset, en grande. */}
        <section
          aria-labelledby="titular"
          className="flex flex-1 flex-col justify-between gap-8 rounded-[28px] px-(--page-gutter) pt-[clamp(32px,8dvh,96px)] pb-(--page-gutter) text-white [background:var(--brand-sun),var(--primary)] md:px-10 md:pb-10"
        >
          <div className="mx-auto max-w-[900px] text-center">
            <h1
              id="titular"
              className="text-[clamp(36px,min(6vw,8dvh),76px)] leading-[1.05] tracking-[-0.02em]"
            >
              Las ayudas a las que podrías optar.
            </h1>
            <p className="mx-auto mt-5 max-w-[640px] text-lg text-white/85 md:text-xl [@media(max-height:640px)]:hidden">
              Ayudas del Estado y de la Comunitat Valenciana, con el motivo por
              el que podrían encajar, su plazo y dónde se piden. Elige cómo
              quieres contarnos tu situación.
            </p>
          </div>

          <div className="mx-auto w-full max-w-[1000px] text-foreground">
            <Buscador />
          </div>
        </section>
      </main>

      <footer className="mx-auto w-full max-w-(--container-content) px-(--page-gutter) pt-4 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-x-10 gap-y-3">
          <div className="flex min-w-0 items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element -- SVG estático */}
            <img
              src={ruta("/ayudita-isotipo.svg")}
              alt=""
              width={36}
              height={36}
              className="size-8 shrink-0"
            />
            <p className="text-[15px] leading-snug">
              <span className="font-medium">{ficha.nombre}</span>
              <span className="block text-(--text-secondary) max-md:hidden">
                {ficha.frase}
              </span>
            </p>
          </div>

          <nav
            aria-label="Fuentes de los datos"
            className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[15px] max-md:hidden"
          >
            <span className="text-(--text-secondary)">Datos de</span>
            {ficha.fuentes.map((f) => (
              <a
                key={f.url}
                href={f.url}
                className="inline-flex min-h-11 items-center gap-1 rounded-md font-mono text-sm underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {dominio(f.url)} <span aria-hidden="true">↗</span>
              </a>
            ))}
          </nav>

          <BotonAviso />
        </div>

        <p className="mt-3 border-t pt-3 text-[15px] text-(--text-secondary) max-md:hidden">
          Herramienta experimental: no es un servicio oficial y no guarda lo que
          escribes. Una pieza del squad{" "}
          <span className="font-mono">{ficha.equipo}</span> · Build night,
          València.
        </p>
      </footer>
    </>
  );
}
