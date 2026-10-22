"use client";
import { Fragment, useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ruta } from "@/config/sitio";
import type { MensajeChat, RespuestaChat } from "@/lib/chat";
import type { Campo, Perfil } from "@/lib/perfil";

const saludo: MensajeChat = {
  rol: "ayudita",
  texto:
    "Hola, soy Ayudita. Cuéntame un poco tu situación: dónde vives, cuántos años tienes, si trabajas o estás en paro y si tienes hijos. Con eso te digo a qué ayudas podrías optar.",
};

// Los perfiles de prueba de SETUP.md, para empezar con un toque.
const ejemplos = [
  "Tengo 24 años, estoy en paro y vivo de alquiler en València. No tengo hijos.",
  "Soy autónoma con 2 hijos en Castelló y tengo ingresos bajos.",
  "Tengo 70 años, vivo en un pueblo de la Safor, cobro la pensión mínima y la factura de la luz es muy alta.",
  "Somos una familia con 3 hijos en edad escolar en València.",
];

const prefiereMenosMovimiento = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Convierte las URL en enlaces sin interpretar ningún HTML del modelo.
function ConEnlaces({ texto }: { texto: string }) {
  return texto.split(/(https?:\/\/[^\s]+)/g).map((parte, i) => {
    if (!/^https?:\/\//.test(parte))
      return <Fragment key={i}>{parte}</Fragment>;
    const url = parte.replace(/[.,;:)]+$/, "");
    return (
      <Fragment key={i}>
        <a
          href={url}
          className="font-medium underline underline-offset-4 [overflow-wrap:anywhere] hover:no-underline"
        >
          {new URL(url).hostname.replace(/^www\./, "")}
          <span aria-hidden="true"> ↗</span>
        </a>
        {parte.slice(url.length)}
      </Fragment>
    );
  });
}

// Las líneas «- …» son el nombre de cada ayuda; el resto, párrafos.
function TextoAyudita({ texto }: { texto: string }) {
  const bloques = texto.split(/\n+/).filter((l) => l.trim());
  return (
    <div className="grid gap-2">
      {bloques.map((linea, i) =>
        linea.startsWith("- ") ? (
          <p key={i} className="mt-2 font-medium">
            <ConEnlaces texto={linea.slice(2)} />
          </p>
        ) : (
          <p key={i}>
            <ConEnlaces texto={linea} />
          </p>
        ),
      )}
    </div>
  );
}

// Lo que hace el servidor mientras prepara la respuesta final. Las dos
// primeras son instantáneas; la última es la redacción, la que tarda.
const pasosBusqueda = [
  "Revisando ayudas del Estado y de la Generalitat",
  "Consultando convocatorias de la BDNS",
  "Preparando tu respuesta",
];

function Escribiendo() {
  return (
    <div
      role="status"
      aria-label="Ayudita está escribiendo"
      className="flex h-6 items-center gap-1.5"
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="size-2 rounded-full bg-(--text-secondary) animate-[escribiendo_1.2s_ease-in-out_infinite] motion-reduce:animate-none"
          style={{ animationDelay: `${i * 0.16}s` }}
        />
      ))}
    </div>
  );
}

export function Chat({
  perfil,
  onPerfil,
  completo,
  onCompleto,
}: {
  perfil: Perfil;
  onPerfil: (p: Perfil) => void;
  completo: boolean;
  onCompleto: (completo: boolean) => void;
}) {
  const [mensajes, setMensajes] = useState<MensajeChat[]>([saludo]);
  const [rechazados, setRechazados] = useState<Campo[]>([]);
  const [texto, setTexto] = useState("");
  const [pensando, setPensando] = useState(false);
  // Palabras visibles del último mensaje mientras «se escribe».
  const [visibles, setVisibles] = useState<number | null>(null);
  // Paso de la búsqueda final que se muestra, o null si no se está buscando.
  const [buscando, setBuscando] = useState<number | null>(null);
  const final = useRef<HTMLDivElement>(null);
  const caja = useRef<HTMLTextAreaElement>(null);

  const ultimo = mensajes.at(-1)!;
  const palabras = ultimo.texto.split(/(\s+)/);

  useEffect(() => {
    if (visibles === null) return;
    if (visibles >= palabras.length) {
      setVisibles(null);
      return;
    }
    // Los textos largos se escriben más deprisa: como mucho, unos 1,5 s.
    const paso = Math.max(4, Math.ceil(palabras.length / 50));
    const t = setTimeout(() => setVisibles((v) => (v ?? 0) + paso), 28);
    return () => clearTimeout(t);
  }, [visibles, palabras.length]);

  useEffect(() => {
    final.current?.scrollIntoView({
      block: "end",
      behavior: prefiereMenosMovimiento() ? "auto" : "smooth",
    });
  }, [mensajes.length, pensando, visibles, buscando]);

  async function pedirFinal(conversacion: MensajeChat[], p: Perfil) {
    setBuscando(0);
    const relojes = [
      setTimeout(() => setBuscando(1), 1200),
      setTimeout(() => setBuscando(2), 2600),
    ];
    let respuesta: string;
    try {
      const res = await fetch(ruta("/api/chat/final"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ perfil: p }),
      });
      const data: { texto?: string; error?: string } = await res
        .json()
        .catch(() => ({}));
      respuesta =
        data.texto ??
        data.error ??
        "No he podido preparar la respuesta ahora mismo. Abajo tienes el detalle de cada ayuda.";
    } catch {
      respuesta =
        "No he podido preparar la respuesta ahora mismo. Abajo tienes el detalle de cada ayuda.";
    }
    relojes.forEach(clearTimeout);
    setBuscando(null);
    setMensajes([...conversacion, { rol: "ayudita", texto: respuesta }]);
    setVisibles(prefiereMenosMovimiento() ? null : 0);
    // Los resultados de abajo aparecen con la respuesta, no antes.
    onCompleto(true);
    caja.current?.focus();
  }

  async function enviar(contenido: string) {
    const t = contenido.trim();
    if (!t || pensando || visibles !== null || buscando !== null) return;
    const conversacion: MensajeChat[] = [
      ...mensajes,
      { rol: "usuario", texto: t },
    ];
    setMensajes(conversacion);
    setTexto("");
    setPensando(true);
    try {
      const res = await fetch(ruta("/api/chat"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mensajes: conversacion, perfil, rechazados }),
      });
      const data: Partial<RespuestaChat> & { error?: string } = await res
        .json()
        .catch(() => ({}));
      if (!res.ok || !data.texto) throw new Error(data.error);
      const nuevo = data.perfil ?? perfil;
      onPerfil(nuevo);
      setRechazados(data.rechazados ?? rechazados);
      onCompleto(false);
      const conPuente: MensajeChat[] = [
        ...conversacion,
        { rol: "ayudita", texto: data.texto },
      ];
      setMensajes(conPuente);
      setVisibles(prefiereMenosMovimiento() ? null : 0);
      // Con el perfil completo, el mensaje puente sale ya y la respuesta final
      // se pide aparte mientras se ven los pasos de la búsqueda.
      if (data.completo) {
        setPensando(false);
        await pedirFinal(conPuente, nuevo);
      }
    } catch (err) {
      setMensajes([
        ...conversacion,
        {
          rol: "ayudita",
          texto:
            (err as Error).message ||
            "Algo ha fallado al contestarte. Prueba de nuevo en un momento.",
        },
      ]);
    } finally {
      setPensando(false);
      caja.current?.focus();
    }
  }

  function alEnviar(e: FormEvent) {
    e.preventDefault();
    enviar(texto);
  }

  const ocupado = pensando || visibles !== null || buscando !== null;

  return (
    <div className="grid gap-6 text-base">
      <ol aria-label="Conversación con Ayudita" className="grid gap-4">
        {mensajes.map((m, i) => {
          const esUltimo = i === mensajes.length - 1;
          const mostrado =
            esUltimo && visibles !== null
              ? palabras.slice(0, visibles).join("")
              : m.texto;
          return m.rol === "usuario" ? (
            <li
              key={i}
              className="max-w-[85%] justify-self-end rounded-2xl rounded-br-md bg-primary px-4 py-3 text-primary-foreground"
            >
              <span className="sr-only">Tú: </span>
              {m.texto}
            </li>
          ) : (
            <li key={i} className="flex max-w-[92%] items-end gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- SVG estático */}
              <img
                src={ruta("/ayudita-isotipo.svg")}
                alt=""
                width={36}
                height={36}
                className="size-8 shrink-0"
              />
              <div className="min-w-0 rounded-2xl rounded-bl-md bg-muted px-4 py-3">
                <span className="sr-only">Ayudita: </span>
                <TextoAyudita texto={mostrado} />
              </div>
            </li>
          );
        })}
        {pensando && (
          <li className="flex items-end gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- SVG estático */}
            <img
              src={ruta("/ayudita-isotipo.svg")}
              alt=""
              width={36}
              height={36}
              className="size-8 shrink-0"
            />
            <div className="rounded-2xl rounded-bl-md bg-muted px-4 py-3">
              <Escribiendo />
            </div>
          </li>
        )}
        {buscando !== null && (
          <li className="flex items-end gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- SVG estático */}
            <img
              src={ruta("/ayudita-isotipo.svg")}
              alt=""
              width={36}
              height={36}
              className="size-8 shrink-0"
            />
            <ol
              aria-label="Buscando ayudas"
              className="grid gap-1.5 rounded-2xl rounded-bl-md bg-muted px-4 py-3"
            >
              {pasosBusqueda.slice(0, buscando + 1).map((paso, i) =>
                i < buscando ? (
                  <li key={paso} className="text-(--text-secondary)">
                    {paso}
                  </li>
                ) : (
                  <li
                    key={paso}
                    className="flex items-center gap-3 font-medium"
                  >
                    {paso}
                    <Escribiendo />
                  </li>
                ),
              )}
            </ol>
          </li>
        )}
      </ol>

      {mensajes.length === 1 && (
        <div>
          <p className="text-(--text-secondary)">O prueba con un ejemplo:</p>
          <div className="mt-3 grid gap-2">
            {ejemplos.map((ej) => (
              <Button
                key={ej}
                variant="outline"
                size="lg"
                onClick={() => enviar(ej)}
                className="h-auto justify-start py-2.5 text-left text-base whitespace-normal"
              >
                {ej}
              </Button>
            ))}
          </div>
        </div>
      )}

      {completo && !ocupado && (
        <a
          href="#resultado"
          className="justify-self-start rounded-lg font-medium underline underline-offset-4 outline-none hover:no-underline focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          Ver el detalle y los requisitos de cada ayuda ↓
        </a>
      )}

      <div ref={final} />

      <form
        onSubmit={alEnviar}
        className="sticky bottom-0 -mx-1 grid gap-2 bg-background px-1 pt-2 pb-1"
      >
        <label htmlFor="mensaje" className="sr-only">
          Escribe a Ayudita
        </label>
        <div className="flex items-end gap-2 rounded-2xl p-1.5 ring-1 ring-foreground/15 focus-within:ring-3 focus-within:ring-ring/50">
          <Textarea
            id="mensaje"
            ref={caja}
            value={texto}
            maxLength={2000}
            rows={1}
            placeholder="Escribe aquí…"
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                enviar(texto);
              }
            }}
            className="max-h-40 min-h-10 resize-none border-0 px-3 py-2 shadow-none focus-visible:ring-0 md:text-base"
          />
          <Button
            type="submit"
            variant={completo ? "outline" : "sunset"}
            size="icon-lg"
            aria-label="Enviar"
            disabled={ocupado || !texto.trim()}
            className="size-10 shrink-0 rounded-xl"
          >
            <ArrowUp aria-hidden="true" />
          </Button>
        </div>
        <p className="px-2 text-(--text-secondary)">
          No escribas datos personales: no guardamos esta conversación.
        </p>
      </form>
    </div>
  );
}
