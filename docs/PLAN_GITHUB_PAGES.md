# Recuperación de GitHub Pages

Fecha: 14 de octubre de 2026 (America/Sao_Paulo).

## Objetivo

Publicar el panel existente en <https://tylordev.github.io/bobtv-canales/> y comprobar que entrega el HTML, JavaScript, CSS y el informe de disponibilidad de la misma ejecución de GitHub Actions.

## Diagnóstico confirmado

- La web pertenece a `TylorDev/bobtv-canales`; `TylorDev/BOBTV` contiene la aplicación Android.
- Se ejecutó `git pull --ff-only origin main` en ambos checkouts. No había cambios remotos pendientes. La web está en `7d85a471be6cebe70574a5fa0193fa943d25d184`; la rama de Android conserva su commit local `a43d812`.
- La API del repositorio devuelve `has_pages: false`; `GET /repos/TylorDev/bobtv-canales/pages` devuelve 404. La URL pública también devuelve HTTP 404.
- La [ejecución 38659191230](https://github.com/TylorDev/bobtv-canales/actions/runs/38659191230) pasó TypeScript, las 59 pruebas, el monitor y el build. Falló en `actions/configure-pages` con `Get Pages site failed` / `Not Found`, antes de subir o desplegar el artefacto.
- `.github/workflows/pages.yml` ya declara `pages: write`, `id-token: write`, el entorno `github-pages`, el artefacto `dist` y la comprobación HTTP posterior. `vite.config.ts` ya utiliza la base `/bobtv-canales/`.
- La sesión normal de GitHub CLI tiene permisos de administración sobre el repositorio. La sesión aislada del sandbox tiene credenciales inválidas; para la configuración remota se utiliza la sesión normal, sin copiar credenciales al proyecto.

## Plan de corrección

1. **Habilitar el sitio.** Con la sesión administradora, crear Pages con `build_type=workflow`, porque el sitio todavía no existe. Si una nueva comprobación revela que ya existe, actualizar su origen en lugar de volver a crearlo. Mantener la ruta pública `/bobtv-canales/`.
2. **Ejecutar la publicación existente.** Lanzar manualmente `pages.yml` desde `main`, registrar el ID de la nueva ejecución y comprobar su resultado. No basta con reintentar una ejecución fallida sin haber habilitado Pages.
3. **Verificar el despliegue real.** Exigir éxito del workflow, de `configure-pages`, de la subida del artefacto, del despliegue y de `verify:deployment`. Comprobar además por HTTP la URL pública, sus recursos JS/CSS y `data/status.json`, y relacionar el informe con la nueva ejecución.
4. **Documentar y guardar.** Actualizar el enlace público del README y el campo Website del repositorio; registrar aquí la configuración, la ejecución y el resultado. Crear un commit detallado de los cambios de documentación.

## Criterios de aceptación

- La API de Pages informa `build_type: workflow`, HTTPS y la URL prevista.
- La nueva ejecución de `pages.yml` termina en `success`, incluida la comprobación posterior al despliegue.
- El HTML y sus recursos JavaScript y CSS responden HTTP 200 con el tipo de contenido esperado.
- `data/status.json` responde HTTP 200, cumple el contrato v1 y declara como origen la ejecución que acaba de publicar.
- El catálogo `canales.m3u` conserva su contenido y el proyecto Android conserva su estado previo.
- Las comprobaciones se realizan por API, logs y HTTP. No se inicia un servidor local ni se realiza una verificación visual.

## Referencias

- [Configuración de workflows de Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).
- [Crear un sitio de Pages mediante la API](https://docs.github.com/en/rest/pages/pages#create-a-github-pages-site).
- [Desarrollo y funcionamiento del panel](PANEL_DISPONIBILIDAD.md).

## Resultado

- Pages se creó mediante `POST /repos/TylorDev/bobtv-canales/pages` con `build_type=workflow`. La API confirma la URL prevista y `https_enforced: true`.
- Se lanzó manualmente la [ejecución 38672148222](https://github.com/TylorDev/bobtv-canales/actions/runs/38672148222) desde `main`, commit `7d85a471be6cebe70574a5fa0193fa943d25d184`. Terminó en `success`, incluidas las comprobaciones de código, monitor, build, configuración, subida del artefacto, despliegue y verificación HTTP.
- La comprobación independiente `npm run verify:deployment -- https://tylordev.github.io/bobtv-canales/` terminó correctamente desde este equipo: panel, dos recursos JS/CSS y JSON válidos.
- Una consulta adicional confirmó HTTP 200 y los tipos `text/html`, `application/javascript`, `text/css` y `application/json` para la página, sus dos recursos y el informe.
- El JSON respondió HTTP 200, con `schemaVersion: 1`, 13 canales y 16 fuentes. Su `origin.runUrl` coincide con la ejecución anterior; `generatedAt` es `2026-10-15T02:40:13.315Z` (14 de octubre, 23:40:13 en America/Sao_Paulo).
- El informe publicado identifica el SHA-256 del catálogo como `af2cb65912ea2c0699404e89e2125f5bf62a50fd33ad5f38c2fc5c14d1773a32`. `git diff` confirma que `canales.m3u` no cambió durante esta tarea.
- El campo Website del repositorio apunta ahora a <https://tylordev.github.io/bobtv-canales/> y la API confirma `has_pages: true`.
- El cron existente y la consulta del panel conservan sus intervalos configurados. Los retrasos de programación de GitHub siguen sujetos a las limitaciones documentadas en la guía del panel.
- No se iniciaron servidores locales ni procesos persistentes.
