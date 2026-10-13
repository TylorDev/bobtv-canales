# Canales de BOBTV

Lista pública para BOBTV, la app de televisión para Android 10 y posteriores.

La app descarga el archivo **canales.m3u** de la rama **main**. Puedes agregar, cambiar o quitar canales desde GitHub sin generar ni instalar otro APK.

## Editar desde GitHub

1. Abre [canales.m3u](https://github.com/TylorDev/bobtv-canales/blob/main/canales.m3u).
2. Pulsa el lápiz para editar.
3. Agrega dos líneas por canal, o modifica las existentes.
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
- Para quitar un canal, elimina sus dos líneas. Para renombrarlo, cambia solo el nombre.
- Guarda el archivo como texto UTF-8 y conserva el nombre canales.m3u y la rama main.

No se necesitan usuarios, contraseñas ni tokens de GitHub en el TV box. La app conserva su última lista válida si no puede actualizarla. La reproducción de video sí requiere Internet y que el emisor esté disponible.

## Fuentes alternativas verificadas

El 13 de octubre de 2026 se agregaron **tres fuentes** de Unitel y Red Uno Bolivia tras comprobar HLS, segmentos reales, decodificación de audio/video y avance del directo. El catálogo contiene **13 canales y 16 fuentes**. Consulta la [verificación y los descartes](docs/FUENTES_IPTV_2026-10-13.md) y el [informe JSON](verificacion/fuentes-2026-10-13.json).

Se priorizan las señales nuevas de UNITEL Santa Cruz y RED UNO Santa Cruz. RED UNO mantiene primero su fuente HTTPS con AAC y agrega La Paz como alternativa. Todas las direcciones originales siguen disponibles en el archivo.

BOBTV 2.0 utiliza la primera entrada de cada identificador. El lector de fuentes múltiples de BOBTV 2.1 agrupa las entradas repetidas de estos canales; así las alternativas pertenecen al mismo canal. Las pruebas se realizaron desde el equipo de desarrollo: las señales nuevas de Red Uno tienen audio MP2 y su reproducción en el TV box requiere un decodificador compatible. Unitel presentó incidencias en algunas muestras, aunque completó la comprobación final de 30 segundos.

## Fuente y disponibilidad

Los 13 canales iniciales proceden del archivo bolivia_canales_publicos_iptv.m3u aportado por el usuario el 2026-10-13, basado en [iptv-org/iptv, streams/bo.m3u](https://github.com/iptv-org/iptv/blob/master/streams/bo.m3u).

Se conservaron los identificadores y las direcciones originales; los nombres se simplificaron para la interfaz. Este repositorio distribuye enlaces, no aloja ni retransmite las emisiones. La disponibilidad, horarios, restricciones geográficas y derechos corresponden a cada emisor.

Fuente directa de la app: https://raw.githubusercontent.com/TylorDev/bobtv-canales/main/canales.m3u
