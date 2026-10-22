# Añadir una ciudad al índice local

El índice local (`src/datos/indice/<ciudad>.json`) guarda las convocatorias de la BDNS con sus requisitos ya leídos por la IA: sexo, edad, situación, familia, empadronamiento… Si el ciudadano vive en una ciudad con índice, `/api/buscar` responde en local, sin llamar a la BDNS ni a la IA. Si no, usa la API en vivo, sin requisitos.

Hoy hay tres: `valencia` (completo), `alacant` y `castello` (solo locales).

## Antes de empezar

- Tener el repo al día (`git pull`, `bun install`).
- Tener `.env.local` con `HELMCODE_API_KEY` y `HELMCODE_MODEL=glm5.3-flash`.
- Elegir un identificador corto, sin acentos ni espacios. En los ejemplos, `elx`.

## 1. Darla de alta en el script

En `scripts/indexar.ts`, añade la ciudad a `LUGARES`:

```ts
const LUGARES = {
  valencia: { municipio: "València", provincia: "Valencia", ccaa: null },
  ...
  elx: { municipio: "Elx / Elche", provincia: null, ccaa: null },
};
```

- Si tiene dos nombres oficiales, pon los dos separados por « / ». Así el buscador reconoce «Elche» y también «Elx».
- Si hay otro municipio con el mismo nombre en otra provincia, rellena `provincia` para desambiguar.

## 2. Crear el índice vacío y registrarlo

El buscador importa los índices de forma estática. Así funciona publicado en Vercel sin base de datos, pero el fichero tiene que existir antes del build.

**a) Crea el fichero vacío:**

```bash
echo '{"version":2,"ambito":"elx","lugar":{"municipio":null,"nuts":null},"generado":"","cita":"Origen de los datos: Intervención General de la Administración del Estado","convocatorias":[]}' > src/datos/indice/elx.json
```

**b) Impórtalo en `src/lib/indice/buscar.ts`:**

```ts
import elx from "../../datos/indice/elx.json";
...
const INDICES = [valencia, alacant, castello, elx]
```

**c) En `src/lib/motor.ts` (`buscarLocal`), añade el nombre de su provincia:**

```ts
const provincia = { valencia: "València", alacant: "Alacant", castello: "Castelló", elx: "Alacant" }[indice.ambito] ?? municipio;
```

**d) Comprueba que compila:**

```bash
./node_modules/.bin/tsc --noEmit
bun run build
```

## 3. Probar con pocas

```bash
bun scripts/indexar.ts --ambito=elx --solo-local --limite=20 --salida=/tmp/prueba-elx.json
```

Mira el log (`Hecho: N convocatorias, M con requisitos`) y revisa a mano unas cuantas extracciones en `/tmp/prueba-elx.json`:

- el `resumen` dice lo que es;
- `quien` solo tiene lo que de verdad exige;
- cada requisito tiene su cita en `evidencias`.

## 4. Pasada completa

**¿Lleva `--solo-local` o no?**

| La ciudad está en… | Comando | Qué baja |
|---|---|---|
| Una comunidad que **ya** tiene un índice completo (hoy, la CV, por `valencia`) | `bun scripts/indexar.ts --ambito=elx --solo-local` | Ayuntamiento y diputación. Estado y comunidad se reutilizan del otro índice. 10–20 min |
| **Otra** comunidad (Madrid, Andalucía…) | `bun scripts/indexar.ts --ambito=sevilla` | Ayuntamiento, diputación, comunidad y Estado. Puede pasar de 1 hora, sobre todo por el Estado (~2.200 fichas) |

Dentro de una misma comunidad, solo un índice necesita la pasada completa. El resto pueden ser `--solo-local`.

**Opciones útiles:**

- `--meses=12`: cuánto hacia atrás se busca (por defecto, 12).
- `--concurrencia=2`: llamadas simultáneas a la IA. No subas de 2: la cuota de HelmCode es compartida por todos los equipos.
- `--sin-ia`: solo descarga fichas. Sirve para adelantar trabajo sin clave; después se relanza sin esa opción.

**Si se corta, relanza el mismo comando.** Fichas y requisitos están en `scripts/.cache/`, que no se sube, y se reutilizan. El fichero del índice se va guardando cada 20 convocatorias, así que funciona aunque esté a medias.

## 5. Probar la búsqueda

Con `bun run dev`, en `http://localhost:3000/derechos-b/motor`, laboratorio o `POST /api/buscar`:

```json
{ "perfil": { "ubicacion": { "municipio": "Elche" }, "edad": 30, "situacion": "paro", "sexo": "mujer" } }
```

Comprueba que la respuesta trae:

- `"origen": "indice"`;
- `peticionesBdns` vacío;
- en `consultado`, el ayuntamiento correcto.

## 6. Subirlo

```bash
git add scripts/indexar.ts src/lib/indice/buscar.ts src/lib/motor.ts src/datos/indice/elx.json
git commit -m "Índice Elx"
git pull --rebase && bun run build && git push
```

Si alguien está ejecutando la pasada de otra ciudad, no hagas `git add` de **su** `.json`: lo está escribiendo.

## Reglas que no hay que romper

- **BDNS:** como mucho 1 petición por segundo por proceso, y el script ya lo respeta. No lancéis más de 2 o 3 ciudades a la vez.
- **IA:** una llamada por convocatoria y una sola vez; las que se descartan por reglas (concesión directa, nominativas, cerradas, de otro territorio) no gastan IA. Si cambias el prompt de `src/lib/indice/extraer.ts`, sube `VERSION_EXTRACCION`: se reprocesa todo.
- **Requisitos:** cada requisito necesita una cita literal del extracto. Si no aparece en el texto, se descarta. `[]` o `null` significan «no lo dice» y nunca excluyen a nadie.
- **Datos:** el índice solo tiene datos públicos de la BDNS. Nada del ciudadano.
- **Caducidad:** el índice es una foto del día en que se generó. La respuesta lo avisa («Datos de la BDNS a…») y enlaza siempre la ficha oficial. Antes de la demo, conviene relanzar el script para refrescarlo; las fichas en caché no se vuelven a pedir.
