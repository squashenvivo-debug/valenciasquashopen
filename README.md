# PSA Valencia Open

## Fase 1: backend Supabase

El repositorio contiene únicamente código y la infraestructura se declara en
`supabase/migrations/20260803000000_phase_1_backend.sql`.

1. Crea un proyecto de Supabase y ejecuta `supabase db push` (o la migración en
   SQL Editor).
2. En Authentication activa Email y desactiva el registro público. Crea los
   usuarios del equipo desde el panel de Supabase.
3. Asigna el primer administrador con la sentencia de *bootstrap* al final de
   la migración. Los roles disponibles son `administrator`, `photographer`,
   `editor` y `user`.
4. Configura `SUPABASE_URL` y `SUPABASE_ANON_KEY` desde `.env.example` en el
   entorno de despliegue e inyéctalas en `window.PSA_CONFIG`. Nunca uses ni
   subas una `service_role` key. `config.js` no contiene valores sensibles.
5. Los buckets son `photos`, `processed`, `news`, `avatars` y `documents`. Las
   políticas limitan su gestión según el rol.

Los datos de ejecución y las cargas nuevas están excluidos por `.gitignore`.
No se han implementado fases posteriores a la 2.

## Fase 2: subida de fotografías

Ejecuta también la migración `20260803000001_phase_2_photo_uploads.sql`. La página de Galería permite seleccionar fotos sueltas, múltiples fotos o una carpeta (navegadores Chromium), y las carga directamente en el bucket `photos` mediante TUS: bloques de 6 MiB, tres transferencias paralelas y reintentos automáticos. La URL de reanudación se conserva en el navegador para que una transferencia interrumpida continúe al volver a seleccionar el mismo archivo; las imágenes y sus datos binarios no se guardan en Git ni en `localStorage`.

## Fase 3: procesamiento IA

La función `supabase/functions/process-photo/index.ts` procesa una fotografía original bajo demanda: detecta jugador y pelota, restaura contraluz/ruido/nitidez, exige preservar marcas visibles y guarda únicamente los resultados aprobados en el bucket `processed`. La original nunca se sobrescribe. Antes de desplegarla, añade `OPENAI_API_KEY` en **Supabase Dashboard → Edge Functions → Secrets**; no la incluyas en `config.js`, `.env.example` ni Git. Despliega la función `process-photo` desde **Edge Functions → Deploy a new function → Via Editor** y usa el botón **Procesar con IA** en el editor de galerías.

## Fase 8: publicacion

Esta fase deja el proyecto listo para publicacion automatica y operacion estable en produccion.
Checklist operativa: [`PRODUCTION_CHECKLIST.md`](PRODUCTION_CHECKLIST.md).

Modo estricto "solo codigo": el repositorio no almacena binarios de imagen en `assets/`.
Los recursos visuales deben servirse desde CDN/Storage externo con `ASSET_CDN_BASE`.
En local (`localhost` y `127.0.0.1`) `config.js` aplica un fallback temporal a `https://psavalenciaopen.com` solo para evitar pantallas sin imagen mientras configuras tu CDN real.

### 1) Deploy automatico en GitHub Pages

El workflow [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml) publica en cada push a `main`.
El pipeline genera un artefacto `dist/` limpio (solo archivos publicos del sitio) antes de desplegar.
Puedes ejecutar comprobaciones de salida en produccion con [`.github/workflows/smoke-production.yml`](.github/workflows/smoke-production.yml), que tambien se dispara automaticamente cuando finaliza con exito el deploy de Pages.

Configura estos **Repository Secrets** en GitHub:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `ASSET_CDN_BASE` (obligatorio en produccion)

Durante el deploy, el workflow inyecta esos valores en `config.js` del artefacto publicado. No se suben secretos sensibles al repositorio.

### 2) HTTPS y dominio propio

El dominio ya se define en [`CNAME`](CNAME) (`psavalenciaopen.com`).

En GitHub:

1. Ve a **Settings → Pages**.
2. Verifica que el origen sea **GitHub Actions**.
3. Confirma que `psavalenciaopen.com` aparece como dominio personalizado.
4. Activa **Enforce HTTPS**.

### 3) Publicacion con Docker (alternativa)

Se incluyeron:

- [`Dockerfile`](Dockerfile)
- [`docker/nginx.conf`](docker/nginx.conf)
- [`docker/entrypoint.sh`](docker/entrypoint.sh)
- [`docker-compose.production.yml`](docker-compose.production.yml)
- [`.github/workflows/docker-image.yml`](.github/workflows/docker-image.yml)

Build local:

```bash
docker build -t psavalencia-web:latest .
docker run --rm -p 8080:80 \
   -e SUPABASE_URL="https://your-project.supabase.co" \
   -e SUPABASE_ANON_KEY="your-anon-key" \
   -e ASSET_CDN_BASE="" \
   psavalencia-web:latest
```

Con Compose:

```bash
docker compose -f docker-compose.production.yml up -d --build
```

La imagen Docker tambien se construye y publica automaticamente en GHCR tras push a `main`.

### 4) Configuracion de produccion recomendada

- Mantener `SUPABASE_URL` y `SUPABASE_ANON_KEY` solo en secretos de plataforma.
- No usar ni exponer `service_role` en frontend.
- Si usas CDN para estaticos, define `ASSET_CDN_BASE`.
- Verificar despues de cada deploy:
   - Carga de `index.html`, `gallery.html`, `news.html`.
   - Login admin y lectura/escritura en Supabase.
   - Consola sin errores runtime.
