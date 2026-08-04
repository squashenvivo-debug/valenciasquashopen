# Deploy de psa-proxy

Esta funcion no debe exponer la API key de PSA en frontend.

## Secretos necesarios en Supabase

- `PSA_API_KEY`: la key de PSA facilitada para esta integracion.
- `PSA_API_BASE_URL`: opcional. Por defecto usa `https://data.psasquashtour.com`.

## Si no tienes Supabase CLI disponible

1. Abre Supabase Dashboard del proyecto `texjzaanugmssmolzwgb`.
2. Ve a `Edge Functions`.
3. Crea una funcion nueva llamada `psa-proxy`.
4. Pega el contenido de `supabase/functions/psa-proxy/index.ts`.
5. Añade el secreto `PSA_API_KEY`.
6. Despliega la funcion.

## URL esperada

`https://texjzaanugmssmolzwgb.supabase.co/functions/v1/psa-proxy`

La pagina `psa-api-test.html` ya intenta usar esa URL automaticamente en local y usara la `SUPABASE_URL` inyectada en GitHub Pages cuando este publicada.