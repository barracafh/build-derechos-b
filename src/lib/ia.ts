// HelmCode habla la API de OpenAI. Úsalo solo desde el servidor (rutas de
// src/app/api o Server Actions): en el navegador la clave no existe, y así debe ser.
// El modelo del evento (glm5.3-flash) lee texto e imágenes: para una imagen,
// manda `content` como lista de partes, con la imagen en data URL o https.
export type Parte =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };
export type Mensaje = {
  role: "system" | "user" | "assistant";
  content: string | Parte[];
};

// `rapido`: sin razonamiento previo. El modelo razona por defecto (~4–13 s);
// para extraer datos sencillos no hace falta y responde en ~0,5 s.
export async function completar(
  messages: Mensaje[],
  { rapido = false }: { rapido?: boolean } = {},
): Promise<string> {
  const { HELMCODE_API_KEY, HELMCODE_BASE_URL, HELMCODE_MODEL } = process.env;
  if (!HELMCODE_API_KEY || !HELMCODE_MODEL)
    throw new Error("Faltan HELMCODE_API_KEY o HELMCODE_MODEL en .env.local");
  // Todos los equipos comparten límites: ante un 429, espera y reintenta.
  for (let intento = 0; ; intento++) {
    const res = await fetch(
      `${HELMCODE_BASE_URL ?? "https://api.helmcode.com/v1"}/chat/completions`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${HELMCODE_API_KEY}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: HELMCODE_MODEL,
          messages,
          ...(rapido && { reasoning_effort: "none" }),
        }),
      },
    );
    if (res.status === 429 && intento < 3) {
      const espera = Number(res.headers.get("retry-after")) || 2 ** intento;
      await new Promise((r) => setTimeout(r, Math.min(espera, 10) * 1000));
      continue;
    }
    if (!res.ok) throw new Error(`HelmCode respondió ${res.status}`);
    const data = await res.json();
    return data.choices[0].message.content;
  }
}
