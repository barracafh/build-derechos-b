"use client";
// Formulario para probar un endpoint del motor desde la web y ver la petición,
// el tiempo y la respuesta. Solo para la página interna /motor.
import { useState, type FormEvent, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ruta } from "@/config/sitio";

export type Campo = {
  nombre: string;
  etiqueta: string;
  ayuda?: string;
  valor?: string;
  largo?: boolean;
  enRuta?: boolean; // se sustituye en la ruta: /api/motor/convocatorias/[numero]
  json?: boolean; // en POST, se manda como JSON y no como texto
};

type Estado =
  | { tipo: "inicio" }
  | { tipo: "cargando"; desde: number }
  | { tipo: "hecho"; status: number; ms: number; json: unknown };

export function Probador({
  metodo,
  path,
  campos,
  principal = false,
  aviso,
  ejemplos,
  vista,
}: {
  metodo: "GET" | "POST";
  path: string;
  campos: Campo[];
  principal?: boolean;
  aviso?: string;
  ejemplos?: { etiqueta: string; valores: Record<string, string> }[];
  vista?: (json: unknown) => ReactNode;
}) {
  const [valores, setValores] = useState<Record<string, string>>(
    Object.fromEntries(campos.map((c) => [c.nombre, c.valor ?? ""])),
  );
  const [estado, setEstado] = useState<Estado>({ tipo: "inicio" });
  const id = path.replace(/\W+/g, "-");

  let url = path;
  const query = new URLSearchParams();
  const cuerpo: Record<string, unknown> = {};
  for (const c of campos) {
    const v = valores[c.nombre]?.trim() ?? "";
    if (c.enRuta) url = url.replace(`[${c.nombre}]`, encodeURIComponent(v));
    else if (metodo === "GET" && v) query.set(c.nombre, v);
    else if (metodo === "POST" && c.json) {
      if (v) {
        try {
          cuerpo[c.nombre] = JSON.parse(v);
        } catch {
          cuerpo[c.nombre] = v;
        }
      }
    } else if (metodo === "POST") cuerpo[c.nombre] = v;
  }
  const completa = `${url}${query.size ? `?${query}` : ""}`;

  async function enviar(e: FormEvent) {
    e.preventDefault();
    const desde = Date.now();
    setEstado({ tipo: "cargando", desde });
    try {
      const res = await fetch(ruta(completa), {
        method: metodo,
        headers: metodo === "POST" ? { "content-type": "application/json" } : undefined,
        body: metodo === "POST" ? JSON.stringify(cuerpo) : undefined,
      });
      const json = await res.json().catch(() => ({ error: "La respuesta no es JSON" }));
      setEstado({ tipo: "hecho", status: res.status, ms: Date.now() - desde, json });
    } catch {
      setEstado({
        tipo: "hecho",
        status: 0,
        ms: Date.now() - desde,
        json: { error: "No se ha podido conectar con el servidor" },
      });
    }
  }

  return (
    <div className="grid gap-5">
      <form onSubmit={enviar} className="grid gap-4" aria-describedby={aviso ? `${id}-aviso` : undefined}>
        {ejemplos && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-(--text-secondary)">Ejemplos:</span>
            {ejemplos.map((ej) => (
              <Button
                key={ej.etiqueta}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setValores((v) => ({ ...v, ...ej.valores }))}
              >
                {ej.etiqueta}
              </Button>
            ))}
          </div>
        )}
        {campos.map((c) => (
          <div key={c.nombre} className="grid gap-1.5">
            <label htmlFor={`${id}-${c.nombre}`} className="text-sm font-medium">
              {c.etiqueta} <span className="font-mono text-xs text-(--text-secondary)">{c.nombre}</span>
            </label>
            {c.largo ? (
              <Textarea
                id={`${id}-${c.nombre}`}
                value={valores[c.nombre]}
                onChange={(e) => setValores({ ...valores, [c.nombre]: e.target.value })}
                rows={c.json ? 8 : 3}
                className={c.json ? "font-mono text-xs" : undefined}
              />
            ) : (
              <Input
                id={`${id}-${c.nombre}`}
                value={valores[c.nombre]}
                onChange={(e) => setValores({ ...valores, [c.nombre]: e.target.value })}
              />
            )}
            {c.ayuda && <p className="text-sm text-(--text-secondary)">{c.ayuda}</p>}
          </div>
        ))}
        <p className="font-mono text-sm break-all text-(--text-secondary)">
          {metodo} {completa}
          {metodo === "POST" && ` · ${JSON.stringify(cuerpo)}`}
        </p>
        {aviso && (
          <p id={`${id}-aviso`} className="rounded-lg bg-(--warning) px-3 py-2 text-sm text-(--warning-foreground)">
            {aviso}
          </p>
        )}
        <div>
          <Button
            type="submit"
            size="lg"
            variant={principal ? "sunset" : "outline"}
            disabled={estado.tipo === "cargando"}
          >
            {estado.tipo === "cargando" ? "Consultando…" : `Probar ${metodo}`}
          </Button>
        </div>
      </form>

      <div aria-live="polite">
        {estado.tipo === "cargando" && (
          <p className="text-sm text-(--text-secondary)">
            Esperando a la BDNS. En frío puede tardar hasta 20 s.
          </p>
        )}
        {estado.tipo === "hecho" && (
          <div className="grid gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={estado.status >= 200 && estado.status < 300 ? "secondary" : "destructive"}>
                HTTP {estado.status || "—"}
              </Badge>
              <Badge variant="outline">{(estado.ms / 1000).toFixed(1)} s</Badge>
            </div>
            {vista && estado.status === 200 && vista(estado.json)}
            <details className="rounded-xl ring-1 ring-foreground/10" open={!vista}>
              <summary className="cursor-pointer px-4 py-3 text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                Respuesta JSON completa
              </summary>
              <pre className="max-h-[480px] overflow-auto border-t bg-muted px-4 py-3 font-mono text-xs leading-relaxed">
                {JSON.stringify(estado.json, null, 2)}
              </pre>
            </details>
          </div>
        )}
      </div>
    </div>
  );
}
