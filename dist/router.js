/*==================================================
 ROUTER
==================================================*/

const Router = {

    go(id){

        const section = document.getElementById(id);

        if(!section) return;

        section.scrollIntoView({

            behavior:"smooth"

        });

    }

};