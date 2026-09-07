# Archivo histórico — cómo guardar una edición

Congela la edición actual del torneo (galerías, noticias, jugadores, programa, cuadro) en
`archivo/<año>/`, como una página autocontenida que no depende de Supabase, R2 ni ningún otro
servicio externo. Sirve para poder ver cómo quedó cada año aunque algún proveedor cambie o
desaparezca con el tiempo.

## Cuándo ejecutarlo

Justo después de que termine cada edición, **antes** de que el panel de admin empiece a
preparar la siguiente (galerías, noticias y cuadro viven en una única fila de Supabase que se
reutiliza año tras año, no se acumula sola).

## Cómo ejecutarlo

```
node tools/archive-snapshot/build.js 2027
```

(si se omite el año, usa el año actual). Tarda varios minutos: descarga cada foto referenciada
por las galerías/noticias en vivo, las comprime y genera `archivo/2027/index.html` + `archivo/2027/img/`.
También añade automáticamente la tarjeta del año nuevo a `archivo/index.html`.

Requiere que `node_modules/sharp` esté instalado (ya lo está en este repo, se usa también en
`api/mirror-to-r2.js`).

## Después de ejecutarlo

1. Abre `archivo/<año>/index.html` con doble clic para revisarlo antes de subir nada — funciona
   sin conexión, sin servidor.
2. Si todo se ve bien, `git add archivo/`, commit y push. Como Vercel sirve la raíz del repo
   directamente, en cuanto se despliegue queda publicado en `psavalenciaopen.com/archivo/<año>/`
   sin configuración adicional.

## Si algo cambia el año que viene

- `tools/archive-snapshot/template/` tiene el HTML/CSS/JS reutilizable (sin datos). Si quieres
  cambiar el diseño del archivo, edítalo ahí — afecta a todas las ediciones futuras, no a las
  ya publicadas.
- El script vuelve a leer Supabase en el momento de ejecutarlo, así que si cambia la estructura
  de `site_content` (columnas, nombres de campos) habrá que actualizar `build.js` en consecuencia.
