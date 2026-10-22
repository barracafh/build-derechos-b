# API del motor (BDNS)

Para probarlo desde la web: `http://localhost:3000/derechos-b/motor`. Tiene el laboratorio del paso 1 (buscador, chat y nube de preguntas) y un formulario para cada endpoint.

Tipos en `src/lib/bdns/tipos.ts` y respuesta real de ejemplo en `src/datos/ejemplo-buscar.json`.

## La idea

```
 Buscador ─┐  POST /api/motor/perfil
 Chat ─────┤  (IA, llamada 1)
           ├──► PerfilCiudadano ──► POST /api/buscar { perfil } ──► resultados
 Nube ─────┘  GET /api/motor/perfil/opciones
              (sin IA: el front construye el perfil)
```

El front elige cómo preguntar. La búsqueda solo recibe un `PerfilCiudadano`.

## PerfilCiudadano

```ts
{
  ubicacion: { municipio, provincia, ccaa },   // texto o null; con el municipio basta
  tipoPersona: "fisica" | "juridica" | null,     // null cuenta como física
  edad: number | null,
  situacion: "paro" | "empleo" | "autonomo" | "jubilado" | "estudiante" | null,
  hijos: number | null,
  vivienda: "alquiler" | "propiedad" | "otra" | null,
  ingresos: "bajos" | "medios" | "altos" | null,
  sexo: "mujer" | "hombre" | null,                // opcionales: los usa el índice local
  discapacidad: "si" | "no" | null,
  familia: "numerosa" | "monoparental" | "ninguna" | null,
  temas: ("vivienda" | "empleo" | "educacion" | "familia" | "energia" | "salud"
        | "servicios_sociales" | "emprendimiento" | "transporte" | "cultura")[]
}
```

- **`tipoPersona` + `situacion`** deciden el tipo de beneficiario que se manda a la BDNS:

  | Perfil | `tiposBeneficiario` |
  |---|---|
  | física | `1`: personas físicas sin actividad económica |
  | física + `situacion: "autonomo"` | `1,3`: también como autónoma, para que vea las de familia **y** las de autónomos |
  | jurídica | `2,3`: entidades sin actividad económica (asociaciones…) y pymes |

  A una jurídica no se le aplican edad, hijos, vivienda, ingresos ni situación: `faltan` no los pide y no añaden temas.
- Todo es opcional, pero `/api/buscar` pide al menos la ubicación o algo de la situación.
- Los valores que no están en el catálogo se ignoran (se quedan en `null`).
- La traducción a la BDNS (temas → finalidades y palabras clave, temas implícitos, edad → «joven» o «mayores») está en `src/lib/opciones.ts`.

## Endpoints

### `GET /api/motor/perfil/opciones`
Para la nube: `{ preguntas: [{ id, pregunta, tipo, opciones? }], perfilVacio }`.
- `id` es el campo del perfil.
- `tipo` es `ubicacion`, `numero`, `opcion` o `multiple`.
- `opciones` son `{ valor, etiqueta }`.

### `GET /api/motor/perfil/municipios?q=gand`
Autocompletado de «¿Dónde vives?»: `{ municipios: [{ municipio, provincia }] }`, hasta 8, de toda España. Usa una pausa de unos 300 ms entre teclas.

### `POST /api/motor/perfil` · `{ mensaje, perfil? }`
Para el chat y el buscador. Devuelve `{ perfil, faltan: [{ id, pregunta }], conIa }`.
- En el chat, manda en cada mensaje el `perfil` de la respuesta anterior: se completa sin perder lo anterior.
- `faltan[0]` es la siguiente pregunta que puede hacer el chat.

### `POST /api/buscar` · `{ perfil }` (o el atajo `{ texto }`)
Tarda **entre 6 y 20 s** en frío, porque la BDNS admite 1 petición por segundo. Lánzalo solo al enviar. Devuelve `RespuestaBuscar`:

| Campo | Para qué |
|---|---|
| `perfil` | Perfil usado, para «Hemos entendido…» |
| `filtros` | Traducción a la BDNS (temas, finalidades, palabras, tipo de beneficiario). Para depurar |
| `consultado` / `noConsultado` | Qué administraciones se han mirado y cuáles no. Muéstralo siempre |
| `resultados[]` | `{ convocatoria, encaje: "alto" \| "medio", motivo, aComprobar[] }`, ya ordenados |
| `convocatoria.estado` | `abierta`, `proxima`, `permanente` o `consultar` (el plazo solo viene en texto: muestra `plazo.textoFin`). Las cerradas no llegan |
| `convocatoria.urlFicha` | El enlace oficial, para `<Fuentes />` |
| `cita` + `consultadoEn` | Obligatorios por el aviso legal de la BDNS |
| `origen` | `"copia"` si la BDNS no respondía. Muestra `avisos[0]` |
| `avisos[]`, `sinCoincidencias` | Notas, y el texto si no hay resultados |
| `peticionesBdns[]` | Cada URL pedida a la BDNS, si vino de la caché y cuántos resultados dio. Para depurar |

Texto: «podrías optar», nunca «tienes derecho».

### Extras sin IA
- `GET /api/motor/convocatorias?municipio=Gandia&claves=alquiler,joven&finalidad=8&beneficiarios=1&limite=5`: la lista filtrada.
- `GET /api/motor/convocatorias/937126`: una ficha.
- `GET /api/calentar`: precarga los 4 perfiles del SETUP antes de la demo (tarda 1–2 min).

## Cómo funciona por dentro

1. **Perfil**: `src/lib/opciones.ts` (catálogo y traducción) y `src/lib/interpretar.ts` (IA). Sin IA, se usan reglas y el municipio se busca en el catálogo de la BDNS.
2. **Territorio**: `src/lib/bdns/territorio.ts`. Municipio, provincia o comunidad → ids de `/regiones` y `/organos`, para toda España.
3. **Búsquedas**: `src/lib/bdns/buscar.ts`. Estado, comunidad, diputación y ayuntamiento, de los últimos 12 meses. Se ordenan por coincidencia del título y se abren fichas hasta tener 10 válidas (máximo 15). Se descartan las instrumentales, las cerradas y las de otro territorio.
4. **Explicación**: `src/lib/explicar.ts`, la IA (llamada 2). Decide el encaje y escribe el motivo; las de encaje `bajo` se quitan.
5. **Caché en memoria**: `src/lib/bdns/cliente.ts`. Fichas 1 h, búsquedas 10 min y catálogos 24 h. Solo datos públicos; el texto del ciudadano ni se guarda ni se registra.

`BDNS_FORZAR_COPIA=1` obliga a usar la copia `datos/bdns-convocatorias-cv.json`.

## Índice local (nuestra propuesta de valor)
La BDNS no filtra por sexo, edad, situación, familia ni empadronamiento: eso está en el texto. `scripts/indexar.ts` lo saca **una vez por convocatoria** con la IA y lo guarda en `src/datos/indice/valencia.json` (`RequisitosConvocatoria` en `tipos.ts`).

```
bun scripts/indexar.ts --sin-ia        # solo fichas (1/s, ~1 h para València; reanudable)
bun scripts/indexar.ts --limite=20     # prueba con IA
bun scripts/indexar.ts                 # todo, con IA ×2 (reutiliza las fichas de scripts/.cache)
```

- Cada requisito lleva una **cita literal** del extracto; si la cita no está en el texto, se descarta.
- `[]` y `null` = «no lo dice»: nunca excluye. Excluye solo si el perfil y la convocatoria se conocen y chocan (mujer ≠ hombre).
- Si el perfil no tiene el dato, la convocatoria sale con `aComprobar` («Es solo para mujeres») y `preguntasUtiles` dice qué preguntar después.
- Para añadir ciudades: `docs/indexar-ciudades.md`.
- Si el municipio del perfil tiene índice, `/api/buscar` responde en local: `origen: "indice"`, sin BDNS ni IA. Si no, usa la API en vivo. `MOTOR_SIN_INDICE=1` lo desactiva.

## Pendiente
- Paso 3: la BDNS solo nos da las 50 convocatorias más recientes por administración. Se puede filtrar en origen por palabras del título (`descripcion` + `descripcionTipoBusqueda=2`).
- La IA no se ha probado: falta `.env.local` con la clave de HelmCode.
