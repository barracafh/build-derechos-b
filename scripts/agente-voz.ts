// Configura el agente de voz de ElevenLabs. Ejecútalo con:
//   bun run scripts/agente-voz.ts
// Lee ELEVENLABS_API_KEY de .env.local (Bun lo carga solo). La clave solo se
// usa aquí, en local: la app se conecta con el id público de src/config/voz.ts.
import { agenteVoz } from "../src/config/voz";

const clave = process.env.ELEVENLABS_API_KEY;
if (!clave) throw new Error("Falta ELEVENLABS_API_KEY en .env.local");

// «Voz barraca»: la voz de Damián, del equipo, clonada con su permiso. Tiene que
// estar en «Mis voces» de la cuenta que configura el agente.
const voz = process.env.ELEVENLABS_VOICE_ID ?? "9BGzcgez67xBGOLC9f2R";

const prompt = `Eres Ayudita, una herramienta experimental (no un servicio oficial) que ayuda por teléfono a personas que viven en España, sobre todo en València, a descubrir a qué ayudas públicas podrían optar.

Cómo hablas: castellano de España, tuteando, frases cortas y naturales, tono cálido y profesional, como en una llamada. Nunca leas listas largas ni enlaces en voz alta.

Qué necesitas saber, de uno o dos datos cada vez y sin interrogar:
- dónde vive: ciudad de València, otro municipio de la Comunitat Valenciana (y cuál) o fuera de la Comunitat
- edad
- situación: en paro, trabaja por cuenta ajena, autónomo, jubilado o pensionista, estudia u otra
- vivienda: alquiler, propiedad u otra
- cuántos hijos o hijas menores tiene a cargo y, si tiene, si alguno va al colegio o al instituto
- si los ingresos de su hogar son bajos
- si es jubilado o pensionista, si cobra la pensión mínima
Si no sabe o no quiere decir algo, no insistas y sigue con el siguiente dato.

Muy importante: NO llames a buscar_ayudas hasta haber preguntado por TODOS esos datos. Si solo sabes dónde vive y su edad, todavía te faltan la situación, la vivienda, los hijos y los ingresos: pregúntalos antes. Solo cuando hayas preguntado por todo (aunque no haya querido responder alguno), di algo breve como «Dame un segundo, que lo miro» y llama a la herramienta buscar_ayudas con lo que sepas. Después cuenta el resultado así:
- por cada ayuda de «podrias»: su nombre, por qué podría encajar y su plazo, en una o dos frases;
- si hay «cerradas», dilo en una frase;
- si hay «huecos», di brevemente qué no has podido consultar;
- termina diciendo que en la pantalla tiene los enlaces oficiales para pedirlas y que compruebe los requisitos allí.
Si la persona corrige un dato, vuelve a llamar a buscar_ayudas.

Reglas:
- Solo hablas de lo que devuelve buscar_ayudas. Nunca inventes ayudas, importes, plazos ni requisitos.
- Di «podrías optar», nunca «tienes derecho» ni «te corresponde».
- Nunca pidas nombre, DNI, dirección, teléfono ni otros datos personales.
- Si preguntan por otra cosa, reconduce con amabilidad. Si preguntan por las ayudas de la DANA, di que no están en esta herramienta y que las consulte en la sede de la Generalitat.`;

const propiedad = (type: string, description: string) => ({
  type,
  description,
});

const configuracion = {
  name: "Ayudita · Llamada",
  conversation_config: {
    agent: {
      language: "es",
      first_message:
        "Hola, soy Ayudita. Te ayudo a saber a qué ayudas públicas podrías optar. Para empezar, ¿dónde vives y cuántos años tienes?",
      prompt: {
        prompt,
        llm: "gemini-3.5-flash",
        temperature: 0.4,
        tools: [
          {
            type: "client",
            name: "buscar_ayudas",
            description:
              "Busca en el catálogo oficial y en la BDNS las ayudas a las que la persona podría optar según su perfil. Llámala solo cuando ya hayas preguntado por dónde vive, edad, situación, vivienda, hijos e ingresos. Devuelve las ayudas que podrían encajar con su motivo y plazo, las que encajan pero están cerradas y lo que no se ha podido consultar. Pasa solo los datos que la persona haya dicho.",
            expects_response: true,
            response_timeout_secs: 10,
            parameters: {
              type: "object",
              properties: {
                zona: propiedad(
                  "string",
                  "Dónde vive: «valencia» (ciudad de València), «cv» (otro municipio de la Comunitat Valenciana) o «fuera».",
                ),
                municipio: propiedad(
                  "string",
                  "Municipio o comarca, si lo ha dicho.",
                ),
                edad: propiedad("integer", "Edad en años."),
                situacion: propiedad(
                  "string",
                  "Una de: paro, trabaja, autonomo, jubilado, estudia, otra.",
                ),
                vivienda: propiedad(
                  "string",
                  "Una de: alquiler, propiedad, otra.",
                ),
                hijos: propiedad(
                  "integer",
                  "Número de hijos o hijas menores a cargo; 0 si no tiene.",
                ),
                hijosEscolares: propiedad(
                  "boolean",
                  "Si algún hijo va al colegio o al instituto.",
                ),
                ingresosBajos: propiedad(
                  "boolean",
                  "Si los ingresos del hogar son bajos o no hay.",
                ),
                pensionMinima: propiedad(
                  "boolean",
                  "Si cobra la pensión mínima.",
                ),
                dana: propiedad(
                  "boolean",
                  "Si pregunta por ayudas de la DANA.",
                ),
              },
              required: [],
            },
          },
        ],
      },
    },
    tts: {
      model_id: "eleven_flash_v2_5",
      voice_id: voz,
      optimize_streaming_latency: 3,
    },
    asr: {
      keywords: [
        "València",
        "Castelló",
        "Alacant",
        "Safor",
        "IMV",
        "pensión mínima",
        "autónomo",
      ],
    },
    turn: { speculative_turn: true },
    conversation: {
      max_duration_seconds: 600,
      client_events: [
        "audio",
        "interruption",
        "agent_response",
        "user_transcript",
        "agent_response_correction",
        "agent_tool_response",
        "client_tool_call",
      ],
    },
  },
  platform_settings: {
    // Solo desde la web publicada y desde local.
    auth: {
      enable_auth: false,
      allowlist: [
        { hostname: "build.barraca.house" },
        { hostname: "localhost" },
      ],
      require_origin_header: true,
    },
    // Regla 3 del evento: no se guarda nada de lo que dice la persona.
    privacy: {
      // Con zero_retention_mode, ElevenLabs exige retention_days = -1: no hay
      // historial que retener porque no se guarda nada.
      zero_retention_mode: true,
      record_voice: false,
      retention_days: -1,
      delete_transcript_and_pii: true,
      delete_audio: true,
    },
    call_limits: { agent_concurrency_limit: 10, daily_limit: 500 },
  },
};

const res = await fetch(
  `https://api.elevenlabs.io/v1/convai/agents/${agenteVoz}`,
  {
    method: "PATCH",
    headers: { "xi-api-key": clave, "content-type": "application/json" },
    body: JSON.stringify(configuracion),
  },
);
console.log(res.status, res.ok ? "Agente actualizado" : await res.text());
