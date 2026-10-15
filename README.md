# Canales de BOBTV

Lista pública para BOBTV, la app de televisión para Android 10 y posteriores.

La app descarga el archivo **canales.m3u** de la rama **main**. Puedes agregar, cambiar o quitar canales desde GitHub sin generar ni instalar otro APK.

## Editar desde GitHub

1. Abre [canales.m3u](https://github.com/TylorDev/bobtv-canales/blob/main/canales.m3u).
2. Pulsa el lápiz para editar.
3. Agrega dos líneas por canal o fuente alternativa compatible, o modifica las existentes.
4. Guarda los cambios con **Commit changes** en la rama **main**.
5. En BOBTV, pulsa **OK**, baja hasta **Actualizar canales** y pulsa **OK**.

BOBTV también revisa la lista al abrir y cada 30 minutos mientras está abierta. GitHub puede tardar unos minutos en servir el cambio. Una actualización de la lista no corta el canal que se está viendo.

## Formato de cada canal

Mantén la primera línea del archivo: #EXTM3U.

Ejemplo:

    #EXTINF:-1 tvg-id="MiCanal.bo" group-title="Bolivia | Nacionales",Mi canal
    https://ejemplo.com/directo/index.m3u8

- **tvg-id:** identificador único y estable por canal. Consérvalo al cambiar el nombre o la dirección; la app lo usa para recordar el último canal. Las fuentes alternativas de los canales oficiales de Unitel, Red Uno y Bolivisión repiten el mismo identificador.
- **group-title:** grupo descriptivo opcional.
- El nombre después de la coma es el que aparece en la TV. Usa nombres breves y claros.
- La siguiente línea es la dirección pública de la señal HLS (.m3u8), HTTP o HTTPS.
- El orden de los canales en el archivo es el orden del control remoto.
- Para quitar un canal, elimina todos los bloques con su identificador. Para renombrarlo, cambia solo el nombre.
- Guarda el archivo como texto UTF-8 y conserva el nombre canales.m3u y la rama main.

No se necesitan usuarios, contraseñas ni tokens de GitHub en el TV box. La app conserva su última lista válida si no puede actualizarla. La reproducción de video sí requiere Internet y que el emisor esté disponible.

## Fuentes alternativas verificadas

La [búsqueda del 14 de octubre de 2026](docs/FUENTES_IPTV_2026-10-14.md) comprobó 65 endpoints y conserva **13 canales y 16 fuentes**. Ninguna alternativa nueva reunió la verificación completa: una candidata etiquetada como Unitel Santa Cruz decodificó audio y video, pero su identidad quedó inconclusa. No se añadieron enlaces fallidos ni señales sin confirmar. Consulta la [evidencia JSON](verificacion/fuentes-2026-10-14.json).

El 13 de octubre de 2026 se agregaron **tres fuentes** de Unitel y Red Uno Bolivia tras comprobar HLS, segmentos reales, decodificación de audio/video y avance del directo. El catálogo contiene **13 canales y 16 fuentes**. Consulta la [verificación y los descartes](docs/FUENTES_IPTV_2026-10-13.md) y el [informe JSON](verificacion/fuentes-2026-10-13.json).

Se priorizan las señales nuevas de UNITEL Santa Cruz y RED UNO Santa Cruz. RED UNO mantiene primero su fuente HTTPS con AAC y agrega La Paz como alternativa. Todas las direcciones originales siguen disponibles en el archivo.

BOBTV 2.0 utiliza la primera entrada de cada identificador. El lector de fuentes múltiples de BOBTV 2.1 agrupa las entradas repetidas de estos canales; así las alternativas pertenecen al mismo canal. Las pruebas se realizaron desde el equipo de desarrollo: las señales nuevas de Red Uno tienen audio MP2 y su reproducción en el TV box requiere un decodificador compatible. Unitel presentó incidencias en algunas muestras, aunque completó la comprobación final de 30 segundos.

## Fuente y disponibilidad

Los 13 canales iniciales proceden del archivo bolivia_canales_publicos_iptv.m3u aportado por el usuario el 2026-10-13, basado en [iptv-org/iptv, streams/bo.m3u](https://github.com/iptv-org/iptv/blob/master/streams/bo.m3u).

Se conservaron los identificadores y las direcciones originales; los nombres se simplificaron para la interfaz. Este repositorio distribuye enlaces, no aloja ni retransmite las emisiones. La disponibilidad, horarios, restricciones geográficas y derechos corresponden a cada emisor.

Fuente directa de la app: https://raw.githubusercontent.com/TylorDev/bobtv-canales/main/canales.m3u

## Fuentes alternativas de Unitel, Red Uno y Bolivisión

Las fuentes alternativas requieren **BOBTV 2.1 o posterior**. Se administran en el mismo [canales.m3u de GitHub](https://github.com/TylorDev/bobtv-canales/blob/main/canales.m3u), sin recompilar ni reinstalar la app.

Cada fuente es una URL directa de transmisión **HLS HTTP o HTTPS**, normalmente terminada en .m3u8. Mantén **#EXTM3U** al principio y guarda el archivo como UTF-8.

### Identificadores compatibles

Repite exactamente el **tvg-id** del canal para añadir otra fuente. Las variantes regionales permanecen separadas:

| Canal | tvg-id |
|---|---|
| Unitel Santa Cruz | UnitelSantaCruz.bo@SD |
| Unitel La Paz | UnitelLaPaz.bo@SD |
| Unitel Cochabamba | UnitelCochabamba.bo@SD |
| Red Uno | RedUno.bo@SD |
| Red Uno Santa Cruz | RedUnoSantaCruz.bo@SD |
| Bolivisión Bolivia | Bolivision.bo@SD |
| Bolivisión Santa Cruz | BolivisionSantaCruz.bo@SD |

La app reúne las URLs del mismo identificador en una sola entrada visible y elimina URLs repetidas. El nombre, grupo y posición del canal corresponden a su primera entrada. Otros identificadores siguen usando su primera URL.

### Ejemplo: dos fuentes por canal

**Las direcciones siguientes son ejemplos; reemplázalas por tus URLs reales. No las añadas a la lista publicada sin sustituirlas.**

~~~m3u
#EXTM3U
#EXTINF:-1 tvg-id="UnitelSantaCruz.bo@SD" group-title="Bolivia | Nacionales",UNITEL Santa Cruz
https://principal.example/unitel-sc/index.m3u8
#EXTINF:-1 tvg-id="UnitelSantaCruz.bo@SD" group-title="Bolivia | Nacionales",UNITEL Santa Cruz
https://alternativa.example/unitel-sc/index.m3u8

#EXTINF:-1 tvg-id="RedUno.bo@SD" group-title="Bolivia | Nacionales",RED UNO
https://principal.example/red-uno/index.m3u8
#EXTINF:-1 tvg-id="RedUno.bo@SD" group-title="Bolivia | Nacionales",RED UNO
https://alternativa.example/red-uno/index.m3u8

#EXTINF:-1 tvg-id="Bolivision.bo@SD" group-title="Bolivia | Nacionales",BOLIVISIÓN Bolivia
https://principal.example/bolivision/index.m3u8
#EXTINF:-1 tvg-id="Bolivision.bo@SD" group-title="Bolivia | Nacionales",BOLIVISIÓN Bolivia
https://alternativa.example/bolivision/index.m3u8
~~~

Para las demás regiones, usa su identificador de la tabla y las URLs de esa misma señal regional. Por ejemplo, una alternativa de Unitel La Paz debe repetir **UnitelLaPaz.bo@SD**.

### Agregar, ordenar, sustituir y eliminar

1. Abre el archivo en GitHub y pulsa el lápiz.
2. Para agregar una fuente, añade un bloque de dos líneas: **#EXTINF** con el identificador existente y su nueva URL.
3. Pon las fuentes preferidas antes que las alternativas. Se comienza con la primera confirmada disponible; si falla, se recorren las demás.
4. Para sustituir una fuente, modifica solo su URL. Para eliminarla, borra únicamente ese bloque de dos líneas. Para quitar el canal completo, elimina todos sus bloques.
5. Para renombrar un canal, conserva su **tvg-id** y cambia el nombre de la primera entrada; mantener el mismo nombre en sus alternativas facilita la edición.
6. Guarda con **Commit changes** en **main**.
7. En BOBTV pulsa **OK → Actualizar canales**. La actualización conserva el video actual y actualiza sus alternativas.

La lista también se descarga al abrir y cada 30 minutos mientras la app está activa. GitHub puede tardar unos minutos en servir los cambios.

### Disponibilidad y diagnóstico

La app comprueba las señales desde la red del TV box al abrir, al actualizar y cada dos minutos mientras está activa. Valida el manifiesto y una muestra de datos de un segmento, con dos comprobaciones simultáneas y un límite de diez segundos por fuente.

Solo aparecen canales con alguna fuente disponible. Los canales ocultos permanecen en el catálogo y reaparecen si recuperan señal. La reproducción puede fallar entre comprobaciones; el reproductor entonces cambia de fuente y permite dos nuevas pasadas, con esperas de dos y cinco segundos.

Si se agotan las fuentes, la app registra los errores y muestra **Aceptar y cambiar**. Al aceptar abre el siguiente canal en línea; si ninguno está disponible muestra la lista vacía con sus acciones.

Para copiar el diagnóstico pulsa **Menú → Exportar logs al portapapeles**, o **OK → Configuración → Exportar logs al portapapeles**. Los logs incluyen solo la sesión actual, hasta 2.000 eventos y 256 KiB. Las credenciales y los parámetros de las URLs se ocultan.

## Panel de disponibilidad IPTV

El panel web de este repositorio utiliza `canales.m3u` y publica los resultados de comprobaciones desde GitHub Actions. Consulta las [instrucciones de desarrollo, despliegue y límites del monitor](docs/PANEL_DISPONIBILIDAD.md).

**Panel público:** [Abrir disponibilidad de canales BOBTV](https://tylordev.github.io/bobtv-canales/). El workflow comprueba cada cinco minutos y la página consulta los resultados cada 30 segundos. La programación puede sufrir retrasos; «Disponible» confirma acceso al HLS y a una muestra real de segmento, sin certificar reproducción en el TV Box.

El [plan y la verificación de publicación](docs/PLAN_GITHUB_PAGES.md) documentan la habilitación de Pages y la ejecución comprobada.
