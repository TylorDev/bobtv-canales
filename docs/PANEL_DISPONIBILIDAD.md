# Panel de disponibilidad IPTV

Panel previsto: https://tylordev.github.io/bobtv-canales/. El mismo despliegue de Pages contiene la web y `data/status.json`. El catálogo es siempre `canales.m3u` de `main`. No modifica ni requiere el proyecto Android y no incluye reproductor ni historial.

## Desarrollo

Requisito: Node.js 24 (también indicado en `.nvmrc`). Desde la raíz de este checkout:

```sh
npm ci
npm run typecheck
npm test
npm run monitor
npm run dev
```

`npm run monitor` genera `public/data/status.json`, ignorado por Git. Desde un equipo local se identifica explícitamente como «Entorno local», y sus resultados no equivalen a los de GitHub Actions. Si todavía no hay JSON, el panel muestra el catálogo con estado «Sin comprobar». `npm run build` crea `dist/` con la ruta base `/bobtv-canales/`. `npm run verify:deployment` comprueba por HTTP la página pública, sus recursos y el contrato JSON. Admite una URL base alternativa y un archivo de informe esperado como segundo argumento.

Estructura: `shared/` contiene el lector del catálogo y el contrato de datos compartido; `monitor/`, el comprobador y su CLI; `src/components/`, los componentes React y sus SCSS Modules; `src/styles/_tokens.scss`, los tokens de tema. Los selectores accesibles usan Radix UI; los estados se distinguen con texto, icono y color. No se cargan fuentes, scripts ni estilos externos.

## Publicación en GitHub Pages

En Settings → Pages del repositorio, seleccionar **GitHub Actions** como origen. Requiere administración del repositorio; para utilizar la CLI debe funcionar `gh api repos/TylorDev/bobtv-canales/pages`. Con una sesión autenticada y los permisos correspondientes:

```sh
# Si Pages aún no existe:
gh api --method POST repos/TylorDev/bobtv-canales/pages -f build_type=workflow
# Si existe con otro origen:
gh api --method PUT repos/TylorDev/bobtv-canales/pages -f build_type=workflow

gh workflow run pages.yml --ref main
gh run list --workflow pages.yml --limit 5
```

No ejecutar ambas operaciones de configuración sin comprobar el estado existente. Si la autenticación no es válida, renovarla en un terminal seguro con `gh auth login`; no guardar tokens en el repositorio ni compartirlos en el chat. Un `GH_TOKEN` definido tiene prioridad sobre las credenciales guardadas y debe renovarse mediante la configuración segura de la sesión.

El workflow `.github/workflows/pages.yml` se ejecuta al cambiar el catálogo, la web, el monitor, las pruebas o su configuración en `main`; también manualmente y con `*/5 * * * *` (UTC). Usa Node.js 24, `npm ci`, comprobación de TypeScript, pruebas, monitor, build y las acciones oficiales `configure-pages`, `upload-pages-artifact` y `deploy-pages`. Tiene permisos `contents: read`, `pages: write` e `id-token: write`. Las ejecuciones se serializan mediante un grupo de concurrencia y no cancelan un despliegue en curso. GitHub puede reemplazar una ejecución pendiente por otra más nueva.

Un catálogo inválido o una excepción general abortan antes de subir el artefacto: el despliegue válido anterior se conserva. Los errores individuales de emisores son datos y no fallan el workflow. Después del despliegue se comprueban por HTTP el panel, JavaScript, CSS y JSON, verificando que el informe corresponde a esta ejecución; se reintenta durante un máximo aproximado de un minuto por la propagación de CDN.

### Frecuencia y límites de GitHub

El cron cada cinco minutos expresa la frecuencia solicitada, no una garantía de puntualidad. GitHub puede retrasar o descartar ejecuciones cuando hay carga, especialmente al inicio de la hora. Solo ejecuta cron desde la rama predeterminada. En repositorios públicos, GitHub desactiva automáticamente las programaciones tras **60 días sin actividad**; hay que reactivarlas en Actions. Consulta las [limitaciones oficiales de schedule](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).

La página consulta el JSON cada 30 segundos mientras está abierta. **Actualizar resultados** vuelve a descargar el informe; no inicia una comprobación en GitHub Actions. La hora visible procede del informe, no del momento en que la página lo descargó. Un informe con más de 15 minutos muestra un aviso. Si la descarga, el JSON o su versión fallan, se conservan los datos en memoria y su fecha; si no hubo descarga válida, se muestra el catálogo sin comprobar. La CDN y el propio monitor pueden añadir demora. No hay historial ni persistencia local entre visitas.

## Criterio y límites de la comprobación

Se accede por GET al manifiesto HLS y a una muestra real de segmento desde el runner de GitHub Actions. Se resuelven redirecciones (máximo cinco), manifiestos maestros y variantes (la de menor ancho de banda), URLs relativas, mapas de inicialización, rangos explícitos e implícitos y claves AES-128. Se comprueba una de las últimas dos entradas completas para evitar el borde del directo. El límite de manifiestos anidados es cinco.

Cada intento dispone de **10 segundos en total**, incluidos manifiestos, mapas, claves y segmento. Hay un máximo de **cuatro fuentes simultáneas**, manifiestos de **1 MiB**, muestras por recurso de **64 KiB** y claves AES de 16 bytes. Las peticiones de muestras llevan `Range`; si un servidor ignora un rango con desplazamiento distinto de cero, el resultado es inconcluso. Se cancelan las respuestas después del límite. AES-128 se descifra para reconocer la muestra, usando el IV explícito o la secuencia HLS; un mapa cifrado requiere IV explícito. DRM/SAMPLE-AES, respuestas demasiado grandes y formatos no compatibles no se dan por accesibles. No se almacena video ni claves.

Se reconocen contenedores MPEG-TS, MP4 fragmentado, AAC/MP3 y WebVTT; se rechazan respuestas vacías o HTML. **No se decodifica ni se certifica reproducción en el TV Box**, identidad de la programación, disponibilidad geográfica, audio, continuidad ni todas las variantes. «Disponible» significa acceso al HLS y a bytes reconocibles de la muestra desde el origen indicado.

| Estado de fuente   | Regla                                                                                                                   |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| Disponible         | Manifiesto, mapa/clave si se requieren y segmento accesibles y reconocibles.                                            |
| No disponible      | Dos resultados concluyentes negativos, separados por 15 segundos: por ejemplo HTTP 404/410, HLS vacío o respuesta HTML. |
| Acceso restringido | HTTP 401 o 403 en cualquiera de los recursos requeridos.                                                                |
| No concluyente     | Timeout, error de red, HTTP 5xx/408/429, límites del monitor, cifrado no compatible u otras respuestas ambiguas.        |
| Sin comprobar      | Aún no hay resultados publicados para el catálogo inicial.                                                              |

Solo se reintenta automáticamente un primer resultado concluyente negativo. Un segundo resultado disponible, restringido o inconcluso sustituye ese diagnóstico negativo. La duración presentada acumula el tiempo de los intentos, sin incluir los 15 segundos de espera; la hora de la fuente corresponde al final del último intento. Las URLs repetidas dentro de un canal se eliminan. Se conserva el nombre, grupo, orden e identificador de su primera entrada y la prioridad de sus fuentes.

Un canal es disponible si alguna fuente está disponible; no disponible solo si todas están confirmadas como no disponibles. Para el resto, la precedencia es: sin comprobar si queda alguna pendiente, no concluyente si existe alguna fuente inconclusa y acceso restringido cuando las restantes fuentes son restringidas o no disponibles.

## Contrato `data/status.json`

`shared/status.ts` define y valida la versión **1**. Raíz: `schemaVersion`, `generatedAt` (ISO UTC), `catalogCommit` (último commit que cambió `canales.m3u`), `catalogSha256`, `origin` (`name`, `runUrl`) y `channels` ordenados. Cada canal tiene `id`, `name`, `group`, `status` y `sources`. Cada fuente incluye `url`, `priority`, `status`, `diagnostic`, `httpStatus` cuando existe, `durationMs`, `checkedAt` y `attempts` con las mediciones de esta ejecución, sin historial entre ejecuciones. Los estados de máquina son `available`, `unavailable`, `restricted`, `inconclusive` y `unchecked`.

El CLI valida el documento antes de escribirlo y sustituye el archivo mediante un renombrado atómico. Los tipos son compartidos con la web y la web vuelve a validar cada respuesta antes de reemplazar su estado visible.
