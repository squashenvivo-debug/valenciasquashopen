/**
 * draw-modal.js — "Ver Cuadro Completo" ya no navega a draw.html: mueve el propio cuadro (ya
 * renderizado, con datos en vivo) dentro de una ventana modal, y lo devuelve a su sitio al
 * cerrar. Así no hay que repetir el fetch a PSA ni duplicar ids, y al cerrar el usuario sigue
 * exactamente donde estaba en la portada.
 */
(function () {
    "use strict";

    let originalParent = null;
    let originalNextSibling = null;

    function hideDrawFullModal() {
        const viewport = document.getElementById("drawFullModalMount")?.querySelector(".psa-bracket-viewport");
        const modal = document.getElementById("drawFullModal");

        if (viewport && originalParent) {
            if (originalNextSibling && originalNextSibling.parentElement === originalParent) {
                originalParent.insertBefore(viewport, originalNextSibling);
            } else {
                originalParent.appendChild(viewport);
            }
        }

        if (modal) modal.classList.remove("active");
        document.body.style.overflow = "";

        window.redrawPsaBracketConnectors?.();
    }

    window.openDrawFullModal = function () {
        const viewport = document.querySelector("#draw .psa-bracket-viewport");
        const mount = document.getElementById("drawFullModalMount");
        const modal = document.getElementById("drawFullModal");
        if (!viewport || !mount || !modal) return;

        originalParent = viewport.parentElement;
        originalNextSibling = viewport.nextSibling;
        mount.appendChild(viewport);

        modal.classList.add("active");
        document.body.style.overflow = "hidden";
        window.PSAModalHistory?.pushModal(hideDrawFullModal);

        // El cuadro cambia de tamaño al entrar en el modal — las líneas conectoras se miden
        // por posición real en pantalla, así que hay que recalcularlas aquí.
        window.redrawPsaBracketConnectors?.();
    };

    // El botón atrás del móvil (o la X) cierran el modal en vez de salir de la web — ver
    // js/modal-history.js. Si por lo que sea ese script no está cargado, cae al cierre directo.
    window.closeDrawFullModal = function () {
        if (window.PSAModalHistory) window.PSAModalHistory.closeModal(hideDrawFullModal);
        else hideDrawFullModal();
    };
})();
