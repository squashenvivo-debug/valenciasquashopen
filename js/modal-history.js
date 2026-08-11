/**
 * modal-history.js — hace que el botón "atrás" del móvil cierre el modal abierto (cuadro
 * completo, noticia, ficha de jugador, head-to-head...) en vez de sacar al usuario de la web.
 *
 * Cada modal, al abrirse, empuja una entrada en el historial del navegador; si el usuario
 * pulsa atrás, ese "popstate" cierra el modal en vez de navegar. Cerrar con la X hace lo mismo
 * por el mismo camino (history.back()), así solo hay un sitio que realmente oculta el modal y
 * el historial nunca se desincroniza de lo que se ve en pantalla. Los modales pueden anidarse
 * (p.ej. Head-to-head abierto encima de Cuadro completo) — por eso es una pila, no un único
 * modal activo.
 */
(function () {
    "use strict";

    const stack = [];
    let suppressNextPopstate = false;

    window.addEventListener("popstate", () => {
        if (suppressNextPopstate) {
            suppressNextPopstate = false;
            return;
        }
        const closeFn = stack.pop();
        if (closeFn) closeFn();
    });

    function pushModal(closeFn) {
        stack.push(closeFn);
        history.pushState({ psaModal: true, psaModalDepth: stack.length }, "");
    }

    function closeModal(closeFn) {
        const idx = stack.lastIndexOf(closeFn);
        if (idx === -1) {
            closeFn();
            return;
        }

        const wasTop = idx === stack.length - 1;
        stack.splice(idx, 1);
        closeFn();

        if (wasTop) {
            // Su entrada de historial (la que empujó al abrirse) sigue ahí — la consumimos
            // con history.back() para que el siguiente "atrás" no encuentre un hueco vacío.
            // El popstate que esto dispara ya no tiene nada que cerrar (ya lo hicimos aquí).
            suppressNextPopstate = true;
            history.back();
        }
    }

    window.PSAModalHistory = { pushModal, closeModal };
})();
