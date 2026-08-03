# Fase 8: checklist de publicacion

## 1) Antes de desplegar

1. Verificar secrets del repositorio en GitHub:
   - SUPABASE_URL
   - SUPABASE_ANON_KEY
   - ASSET_CDN_BASE (obligatorio, URL HTTPS absoluta, sin / final)
2. Verificar que ASSET_CDN_BASE sirve las rutas de imagen referenciadas por el sitio (el workflow Deploy GitHub Pages ahora falla si no son accesibles).
2. Verificar que no hay binarios en assets/ dentro del repo.
2. Confirmar dominio objetivo en CNAME: psavalenciaopen.com.
3. Confirmar que no existe ninguna clave service_role en frontend ni workflows.
4. Confirmar que el workflow Deploy GitHub Pages esta en branch main.

## 2) DNS y dominio propio

1. Si usas dominio apex (psavalenciaopen.com), crear A records hacia GitHub Pages:
   - 185.199.108.153
   - 185.199.109.153
   - 185.199.110.153
   - 185.199.111.153
2. Si usas subdominio www, crear CNAME de www a <usuario>.github.io.
3. Esperar propagacion DNS y validar con herramientas DNS publicas.

## 3) Despliegue

1. Hacer push a main.
2. Revisar en GitHub Actions:
   - Deploy GitHub Pages en verde.
   - Build Docker Image en verde (si se usa imagen GHCR).
3. Confirmar que github-pages publica una nueva URL de deployment.

## 4) HTTPS

1. Ir a Settings > Pages.
2. Confirmar dominio personalizado: psavalenciaopen.com.
3. Activar Enforce HTTPS.
4. Verificar certificado valido y candado en navegador.

## 5) Validacion post-deploy

1. Validar rutas publicas:
   - /index.html
   - /gallery.html
   - /news.html
   - /draw.html
2. Validar rutas admin:
   - /admin-dashboard.html
   - /admin-gallery.html
3. Validar login admin y lectura/escritura en Supabase.
4. Revisar consola de navegador: cero errores runtime.
5. Confirmar que config.js publicado contiene supabaseUrl, supabaseAnonKey y assetCdnBase.
6. Validar que al menos una URL de imagen cargue desde ASSET_CDN_BASE.
6. Confirmar que el workflow Smoke Test Production se ejecuta automaticamente tras Deploy GitHub Pages exitoso.
7. Si necesitas repetir la prueba, ejecutar Smoke Test Production manual con base URL de produccion.

## 6) Criterios de aceptacion

1. Deploy completado sin fallos.
2. Dominio propio activo con HTTPS forzado.
3. Flujos publicos y admin operativos.
4. Sin errores runtime visibles.
5. Workflow Smoke Test Production en verde (automatico o manual).

## 7) Rollback rapido

1. Re-ejecutar un deployment anterior exitoso desde GitHub Actions.
2. Si el problema es de configuracion, corregir secrets y volver a desplegar.
3. Si el problema es de codigo, revertir commit en main y redeploy automatico.
