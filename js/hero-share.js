/* ==========================================================
   HERO-SHARE.JS
   Botón "Compartir" bajo los accesos rápidos de la portada: comparte la
   imagen promocional del torneo (assets/images/hero/instagram-share.jpg,
   1080x1350, lista para Instagram Story/Reel) usando la Web Share API con
   archivo real — igual que en news.js/gallery.js, para que Instagram la
   trate como contenido visual y no solo como mensaje de texto.
========================================================== */

const HERO_SHARE_IMAGE_URL = "assets/images/hero/instagram-share.jpg";

async function fetchHeroShareFile() {
    const response = await fetch(HERO_SHARE_IMAGE_URL, { cache: "reload" });
    if (!response.ok) throw new Error(`No se pudo cargar la imagen (HTTP ${response.status})`);
    const blob = await response.blob();
    return new File([blob], "psa-valencia-open.jpg", { type: "image/jpeg" });
}

async function shareHeroImage(button) {
    const shareUrl = `${window.location.origin}/`;
    const shareTitle = (typeof t === "function" ? t("quick.share.title") : "") || "PSA Valencia Open";
    const originalLabel = button ? button.innerHTML : "";

    if (button) button.disabled = true;

    try {
        if (typeof navigator.share === "function") {
            if (typeof navigator.canShare === "function") {
                try {
                    const file = await fetchHeroShareFile();
                    if (navigator.canShare({ files: [file] })) {
                        await navigator.share({ files: [file], title: shareTitle, text: shareTitle, url: shareUrl });
                        return;
                    }
                } catch (error) {
                    // sigue al share solo-texto si no se pudo preparar el archivo
                }
            }
            await navigator.share({ title: shareTitle, url: shareUrl }).catch(() => {});
            return;
        }

        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(shareUrl);
            if (button) {
                button.innerHTML = `✅ ${(typeof t === "function" ? t("psaGallery.linkCopied") : "") || "Enlace copiado"}`;
                setTimeout(() => { button.innerHTML = originalLabel; }, 2000);
            }
            return;
        }

        window.open(shareUrl, "_blank", "noopener");
    } finally {
        if (button) button.disabled = false;
    }
}

window.shareHeroImage = shareHeroImage;
