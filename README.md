# Noticias diarias (proceso con IA)

Cada mañana este proceso elige, para cada uno de los 32 países, de 0 a 2 hechos que conviene tener presentes con los clientes (elecciones, catástrofes, huelgas nacionales, alertas meteorológicas, luto oficial, decisiones económicas que afectan al consumo, emergencias sanitarias). Publica un único archivo `news-feed.json` que la Home lee al abrirse.

Las claves nunca viajan dentro de la app: el proceso corre fuera, una vez al día, y todo el equipo comparte esa misma ejecución.

## Dos modos

- **Gratuito (sin clave).** Es el modo actual. Usa solo avisos oficiales: catástrofes de GDACS en alerta naranja o roja y avisos meteorológicos naranja y rojo de MeteoAlarm (la red de los servicios meteorológicos europeos; Albania no está en ella). Los textos salen de plantillas en español e inglés. No recoge elecciones, huelgas ni luto oficial.
- **Con IA (con clave).** En cuanto exista el secreto `ANTHROPIC_API_KEY`, el proceso pasa solo a este modo: añade la prensa local y Claude elige y redacta. Si un día falla la IA, ese día se usa el modo gratuito.

Para el modo con IA, saca la clave en https://console.anthropic.com: crea la cuenta, añade crédito en **Billing** y genera la clave en **API Keys**. Después guárdala como secreto del repositorio (paso 3 de abajo).

## Cómo funciona el modo con IA

1. **Recoge titulares** de fuentes gratuitas y sin clave:
   - **GDACS** (alertas de catástrofes UE/ONU): solo alertas naranja y roja en nuestros países.
   - **GDELT** (prensa local de cada país, últimas 36 h, con traducción automática): solo temas de elecciones, huelgas, incendios, inundaciones, terremotos, temporales, estado de emergencia, luto, apagones y brotes.
   - **RSS de medios públicos** opcionales (`EXTRA_FEEDS` en `markets.mjs`): hoy BBC Europa, Tagesschau y franceinfo. Se pueden añadir más.
   - Los hechos publicados ayer, para que un tema que sigue abierto no desaparezca de un día para otro.
2. **Claude elige y redacta.** Lee todos los titulares en una sola llamada y devuelve, en español e inglés, el título y la línea "Tenlo en cuenta". Solo puede elegir entre los titulares recibidos: el enlace, la fuente y la fecha salen siempre del titular original, nunca de la IA. Lo que no encaja se descarta.
3. **Publica `news-feed.json`.** Si algo falla, no se sobrescribe el del día anterior y la app sigue mostrando el último bueno (también lo guarda en el ordenador por si no hay conexión).

Si una fuente no responde, se salta y el resto sigue. Si fallan todas, el proceso termina con error y se mantiene el archivo anterior. Los avisos de MeteoAlarm se usan con licencia CC BY 4.0: la fuente aparece en cada noticia.

## Ponerlo en marcha (recomendado: GitHub)

1. Este repositorio ya tiene el proceso y la tarea diaria (`.github/workflows/news.yml`).
2. El repositorio es público porque GitHub Pages gratis solo publica repositorios públicos. Aquí no hay claves ni datos de clientes.
3. Solo para el modo con IA: **Settings > Secrets and variables > Actions > New repository secret**, nombre `ANTHROPIC_API_KEY`, valor tu clave de la API de Anthropic. Sin este paso funciona en modo gratuito.
4. **Settings > Pages > Source: GitHub Actions.**
5. En **Actions > Daily news feed > Run workflow** lánzalo una vez a mano. Después corre solo cada día a las 05:30 (hora de Madrid en invierno).
6. El archivo queda en `https://jeriesgo.github.io/cheil-news/news-feed.json`. Esa dirección se pone en la app (abajo).

Cualquier otro servidor con Node 20 y una tarea programada (cron) sirve igual: `npm install` y `node run.mjs --out <carpeta pública>` con `ANTHROPIC_API_KEY` en el entorno.

## Conectarlo a la app

Antes de cargar la Home, la app define la dirección del archivo:

```html
<script>window.CHEIL_NEWS_FEED = "https://jeriesgo.github.io/cheil-news/news-feed.json";</script>
```

Sin esa línea la Home sigue mostrando las noticias de ejemplo, marcadas como tales.

## Probar sin clave

```bash
npm install
node run.mjs --dry-run                                         # recoge titulares y los guarda en out/candidates.json
node run.mjs --candidates fixtures/candidates-alerts.json        # modo gratuito con avisos de prueba
node run.mjs --candidates fixtures/candidates-sample.json --mock  # recorre todo el proceso sin IA ni coste
```

`fixtures/news-feed-example.json` es un ejemplo del archivo final.

## Coste

Una llamada al día a Claude Opus 5.5 con unos cientos de titulares: del orden de céntimos al día. Se puede ajustar con `NEWS_EFFORT` (`low`, `medium` por defecto, `high`) o cambiar de modelo con `NEWS_MODEL`.

Si el modelo rechaza la petición por sus filtros de seguridad (poco probable con noticias), la API la repite automáticamente con el modelo de respaldo que recomienda Anthropic (`fallbacks: "default"`).

## Archivos

| Archivo | Qué hace |
| --- | --- |
| `run.mjs` | Punto de entrada. Opciones `--free`, `--dry-run`, `--candidates`, `--mock`, `--out`. |
| `sources.mjs` | Lectura de GDACS, MeteoAlarm, GDELT y RSS, y limpieza de duplicados. |
| `select.mjs` | Modo con IA: instrucciones para Claude, esquema de respuesta y validación. |
| `free.mjs` | Modo gratuito: textos fijos a partir de los avisos oficiales. |
| `markets.mjs` | Los 32 países con sus códigos para GDELT y GDACS, y los RSS opcionales. |
| `.github/workflows/news.yml` | Ejecución diaria y publicación en GitHub Pages. |
| `fixtures/` | Titulares de prueba y un ejemplo del archivo final. |

## Formato de `news-feed.json`

```json
{ "version": 1, "generatedAt": "2026-11-18T04:31:10Z", "mode": "free | ai", "model": "free | claude-opus-5-5", "markets": ["AL", "..."],
  "items": [ { "id": "ES-b34786093f86", "market": "ES", "category": "weather",
    "title": { "es": "...", "en": "..." }, "note": { "es": "...", "en": "..." },
    "source": "example.org", "url": "https://...", "publishedAt": "2026-11-17T08:10:00Z", "sample": false } ] }
```

Categorías: `election`, `disaster`, `strike`, `weather`, `mourning`, `economy`, `health`.
