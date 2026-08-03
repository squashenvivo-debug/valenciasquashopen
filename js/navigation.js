/*==================================================
 NAVIGATION
==================================================*/

document.addEventListener("DOMContentLoaded", () => {

    const header = document.getElementById("header");

    const menu = document.getElementById("main-menu");

    const menuButton = document.getElementById("menu-button");

    /*==============================
    HEADER
    ==============================*/

    window.addEventListener("scroll", () => {

        if (window.scrollY > 40) {

            header.classList.add("scrolled");

        } else {

            header.classList.remove("scrolled");

        }

    });

    /*==============================
    MENU MOBILE
    ==============================*/

    if (menuButton) {

        menuButton.addEventListener("click", () => {

            menu.classList.toggle("open");

            menuButton.classList.toggle("active");

        });

    }

    /*==============================
    CERRAR MENU
    ==============================*/

    document.querySelectorAll("#main-menu a").forEach(link => {

        link.addEventListener("click", () => {

            if (window.innerWidth <= 992) {

                menu.classList.remove("open");

                menuButton.classList.remove("active");

            }

        });

    });

    /*==============================
    SCROLL SUAVE
    ==============================*/

    document.querySelectorAll('a[href^="#"]').forEach(anchor => {

        anchor.addEventListener("click", function (e) {

            const target = document.querySelector(this.getAttribute("href"));

            if (!target) return;

            e.preventDefault();

            target.scrollIntoView({

                behavior: "smooth"

            });

        });

    });

    /*==============================
    MENU ACTIVO
    ==============================*/

    const sections = document.querySelectorAll("section[id]");

    window.addEventListener("scroll", () => {

        let current = "";

        sections.forEach(section => {

            const top = section.offsetTop - 120;

            const height = section.offsetHeight;

            if (window.scrollY >= top &&
                window.scrollY < top + height) {

                current = section.id;

            }

        });

        document.querySelectorAll("#main-menu a").forEach(link => {

            link.classList.remove("active");

            if (link.getAttribute("href") === "#" + current) {

                link.classList.add("active");

            }

        });

    });

});