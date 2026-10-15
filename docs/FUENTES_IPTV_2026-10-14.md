# Búsqueda de alternativas IPTV — 14 de octubre de 2026

## Resultado

**No se incorporan fuentes nuevas.** La búsqueda y las comprobaciones se completaron, pero ninguna candidata reunió acceso, decodificación y evidencia suficiente de pertenecer a la señal requerida. Se aplica la salida prevista del plan: documentar los resultados y conservar el catálogo.

`canales.m3u` mantiene sus **13 canales y 16 fuentes**, con los mismos identificadores, nombres, grupos, números y prioridades. Su contenido publicado conserva el SHA-256 `af2cb65912ea2c0699404e89e2125f5bf62a50fd33ad5f38c2fc5c14d1773a32`. La aplicación Android y su catálogo incluido no se modificaron; no se generó otro APK.

La evidencia detallada está en [verificacion/fuentes-2026-10-14.json](../verificacion/fuentes-2026-10-14.json). Estas mediciones proceden del PC y de su red durante la noche del 14 de octubre, hora de São Paulo; sus fechas UTC corresponden al 15 de octubre. No son una prueba física del TV Box ni una certificación de disponibilidad permanente.

## Búsqueda y acceso

Se consultaron el [archivo de Bolivia de iptv-org](https://github.com/iptv-org/iptv/blob/master/streams/bo.m3u), su [lista generada por país](https://iptv-org.github.io/iptv/countries/bo.m3u), las listas de [12carloshc](https://github.com/12carloshc/canales-de-bolivia-IPTV) y [codemonchit0](https://github.com/codemonchit0/canales-digitales-de-bolivia-iptv-hd), Free-TV, gists, otros catálogos y las páginas de los emisores. [IPTV Cat](https://iptvcat.com/bolivia) aportó seis enlaces públicos de descarga que se resolvieron hasta sus URLs de emisión, sin crear cuenta ni lista guardada.

Se probaron **65 endpoints distintos**: los 16 actuales y 49 adicionales. Las variantes que solo añaden el parámetro de seguimiento `checkedby` se cuentan una vez. De los adicionales, 29 se anunciaban dentro de las familias Unitel, Red Uno o Bolivisión; los otros 20 se examinaron únicamente como documentación de otras señales actuales o variantes que requieren aclarar su identidad.

| Resultado de acceso al comprobar | Endpoints |
| --- | ---: |
| Manifiesto HLS y muestra reconocible de segmento | 21 |
| HTTP 404 observado | 19 |
| Timeout, DNS u otro resultado inconcluso | 22 |
| Acceso restringido, HTTP 403 | 3 |

Un resultado accesible solo acredita esos recursos. No confirma identidad, reproducción audible ni continuidad. Los errores observados tampoco acreditan una caída global del canal. No se eliminó ninguna fuente existente.

Las peticiones iniciales utilizaron `BOBTV/2.0`, un máximo de cuatro trabajadores, diez segundos por petición y un presupuesto nominal de 25 segundos por endpoint. Los manifiestos se limitaron a 1 MiB y las muestras iniciales a 256 KiB. Las URLs con credenciales o firmas temporales se excluyeron de la incorporación; el informe omite los valores de las sesiones. Los acortadores publicados por 12carloshc devolvieron errores de certificado desde esta red: se leyó directamente el catálogo de GitHub y se contrastó su espejo, manteniendo la verificación TLS.

## Candidata accesible sin identidad confirmada

IPTV Cat etiqueta `https://master.tucableip.com/tvhome/index.m3u8` como **Unitel Santa Cruz**. La URL directa, sin el parámetro de seguimiento ni el intermediario de descarga, respondió con HLS en directo y segmentos MPEG-TS.

Se descargaron dos muestras independientes con segmentos distintos y comprobación normal de certificados HTTPS. Cada captura contiene 34,52 segundos declarados de medios. FFprobe y FFmpeg **9.0.2** identificaron video **H.264, 1280×720**, y audio **AAC, 48 kHz, estéreo**. Se decodificaron aproximadamente 30 segundos por muestra:

| Muestra | Fotogramas de video | Tiempo de video | Bloques de audio | Audio decodificado | Secuencia HLS |
| --- | ---: | ---: | ---: | ---: | --- |
| 1 | 869 | 29,960 s | 1.406 | 29,9947 s | 30314 → 30317 |
| 2 | 869 | 29,970 s | 1.400 | 29,8667 s | 30330 → 30332 |

Los hashes de audio y video cambiaron y ambos procesos finalizaron correctamente. El tiempo de video se midió por sus marcas de presentación: el campo nominal `r_frame_rate` del flujo no es una medida fiable de FPS. La comprobación no utilizó capturas ni inspección visual.

La etiqueta del proveedor se contrastó mediante correlación de envolventes de audio con las dos fuentes existentes de Unitel Santa Cruz. No se obtuvo una coincidencia suficiente: correlaciones máximas de **0,179346** frente a Mediastream y **0,167589** frente a la fuente HTTP, usando envolventes de 20 ms y al menos 30 segundos de solapamiento. La captura de la referencia HTTP terminó con un timeout; la parte descargada contenía paquetes corruptos y discontinuidades de tiempo. Diferentes retrasos o programación regional también pueden impedir una correlación.

**El resultado es inconcluso: no demuestra que sea otro canal, pero tampoco confirma la señal requerida.** Por ese motivo, `tvhome` no se añadió bajo `UnitelSantaCruz.bo@SD` ni bajo otro identificador. Se conserva como candidata documentada para una futura comprobación de identidad.

FFmpeg no pudo validar directamente los certificados de las subpeticiones HTTPS de esta instalación portátil. No se desactivó esa validación: las descargas satisfactorias se hicieron con Python y comprobación HTTPS normal, y la decodificación se realizó sobre los segmentos locales acotados.

## Otras señales y descartes

- Las alternativas revisadas de Bolivisión devolvieron 403, 404, DNS sin resolver o timeouts. Las dos señales actuales se conservan. Los enlaces firmados y los anuncios de UPP TV no se equipararon automáticamente con Bolivisión regional.
- Las alternativas revisadas de Unitel La Paz/Cochabamba y las de Red Uno no aportaron otra URL admitida. Los HUB públicos de Red Uno devolvieron 404 al comprobarlos; los reproductores de Dailymotion no se convirtieron en URLs firmadas para publicar.
- Se encontraron muestras HLS accesibles de RTP, Gigavisión y Bolivia TV. Se documentan en el JSON, sin calificarlas como decodificadas o como la misma variante regional. ATB y CTV también se revisaron. BOBTV solo agrupa alternativas para los siete identificadores existentes de Unitel, Red Uno y Bolivisión: agregar bloques repetidos para los otros canales no los convertiría en alternativas utilizables.
- Los homónimos de otros países, los cambios de señal regional no acreditados y los enlaces que requieren cambios en la app quedan fuera de esta ampliación.

## Validación del repositorio

- El lector real compilado de Android, `M3uParser`, y `ChannelNumbers` confirmaron 13 canales, 16 fuentes y la conservación de metadatos, numeración y prioridades. Se usaron las clases ya compiladas, sin modificar ni compilar la app.
- El lector `shared/catalog.ts` confirmó las mismas cantidades. El blob de Git de `canales.m3u` es idéntico al de la base; los finales de línea locales de Windows no se confunden con cambios de contenido publicado.
- `npm run typecheck` y `npm run build` finalizaron correctamente.
- `npm test` ejecutó 59 pruebas: **58 correctas y un fallo previo del caso CLI en Windows**. Esa prueba pasa una ruta absoluta de Windows a `node --import` y falla antes de ejecutar el CLI. Una adaptación temporal de la invocación, fuera del repositorio publicado, alcanzó después una limitación del sandbox en `uv_os_get_passwd`; no se modificaron la prueba ni el código del monitor.
- El [workflow Linux existente](https://github.com/TylorDev/bobtv-canales/actions/runs/38672148222), sobre el mismo código de parser, monitor y pruebas, ya había completado **59 pruebas**, monitor, build, despliegue y verificación HTTP. Esta entrega solo añade documentación y evidencia; no cambia código, dependencias, workflow ni catálogo.

El endpoint utilizado por BOBTV sigue siendo [el M3U público de main](https://raw.githubusercontent.com/TylorDev/bobtv-canales/main/canales.m3u). No hay nuevas fuentes que activar mediante **Actualizar canales** en esta búsqueda.
