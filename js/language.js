/* ==========================================================
   LANGUAGE.JS
   PSA VALENCIA OPEN
========================================================== */

const translations = {

    es: {

        menu: {
            home: "Inicio",
            tournament: "Torneo",
            players: "Jugadores",
            programming: "Programación",
            schedule: "Horarios",
            draw: "Cuadros",
            live: "Directo",
            news: "Noticias",
            gallery: "Galería",
            venue: "Sede"
        },

        hero: {
            
    live: "VER DIRECTO",
    draw: "CUADROS",
    days: "DÍAS",
    hours: "HORAS",
    minutes: "MIN",
    seconds: "SEG"
},
quick: {

    tournament: {
        title: "TORNEO",
        text: "Información principal del evento"
    },

    live: {
        title: "DIRECTO",
        text: "Ver los partidos en vivo"
    },

    draw: {
        title: "CUADRO",
        text: "Resultados y enfrentamientos"
    },

    programming: {
        title: "PROGRAMACIÓN",
        text: "Agenda oficial del evento"
    },

    players: {
        title: "JUGADORES",
        text: "Conoce a todos los participantes"
    }

},

    },

    va: {

        menu: {
            home: "Inici",
            tournament: "Torneig",
            players: "Jugadors",
            programming: "Programació",
            schedule: "Horaris",
            draw: "Quadres",
            live: "Directe",
            news: "Notícies",
            gallery: "Galeria",
            venue: "Seu"
        },

        hero: {
    live: "VEURE DIRECTE",
    draw: "QUADRES",
    days: "DIES",
    hours: "HORES",
    minutes: "MIN",
    seconds: "SEG"
},
quick: {

    tournament: {
        title: "TORNEIG",
        text: "Informació principal de l'esdeveniment"
    },

    live: {
        title: "DIRECTE",
        text: "Veure els partits en directe"
    },

    draw: {
        title: "QUADRE",
        text: "Resultats i enfrontaments"
    },

    programming: {
        title: "PROGRAMACIÓ",
        text: "Agenda oficial de l'esdeveniment"
    },

    players: {
        title: "JUGADORS",
        text: "Coneix tots els participants"
    }

},
    },

    en: {

        menu: {
            home: "Home",
            tournament: "Tournament",
            players: "Players",
            programming: "Program",
            schedule: "Schedule",
            draw: "Draws",
            live: "Live",
            news: "News",
            gallery: "Gallery",
            venue: "Venue"
        },

hero: {
    live: "WATCH LIVE",
    draw: "DRAWS",
    days: "DAYS",
    hours: "HOURS",
    minutes: "MIN",
    seconds: "SEC"
},
quick: {

    tournament: {
        title: "TOURNAMENT",
        text: "Main event information"
    },

    live: {
        title: "LIVE",
        text: "Watch matches live"
    },

    draw: {
        title: "DRAW",
        text: "Results and matchups"
    },

    programming: {
        title: "SCHEDULE",
        text: "Official event agenda"
    },

    players: {
        title: "PLAYERS",
        text: "Meet all participants"
    }

},
    },

    fr: {

        menu: {
            home: "Accueil",
            tournament: "Tournoi",
            players: "Joueurs",
            programming: "Programme",
            schedule: "Programme",
            draw: "Tableaux",
            live: "Direct",
            news: "Actualités",
            gallery: "Galerie",
            venue: "Lieu"
        },

hero: {
    live: "DIRECT",
    draw: "TABLEAUX",
    days: "JOURS",
    hours: "HEURES",
    minutes: "MIN",
    seconds: "SEC"
},
quick: {

    tournament: {
        title: "TOURNOI",
        text: "Informations principales de l'événement"
    },

    live: {
        title: "DIRECT",
        text: "Regarder les matchs en direct"
    },

    draw: {
        title: "TABLEAU",
        text: "Résultats et confrontations"
    },

    programming: {
        title: "PROGRAMME",
        text: "Agenda officiel de l'événement"
    },

    players: {
        title: "JOUEURS",
        text: "Découvrez tous les participants"
    }

},

    }

};

/* Textos de todas las secciones estáticas de la página. */
const pageTranslations = {
    es: {
        menu: { discover: "Experience Valencia", sponsors: "Patrocinadores" },
        cta: { live: "DIRECTO" },
        sectionHeaders: {
            quick: { label: "ACCESO", title: "ACCESOS DIRECTOS", intro: "Entra rápido a las secciones más importantes del torneo." },
            tournament: { label: "PSA WORLD TOUR COPPER", title: "TORNEO", intro: "Toda la información oficial del PSA Valencia Open 2026." },
            live: { label: "DIRECTO", title: "EN DIRECTO", intro: "Sigue los partidos en tiempo real desde la pista principal." },
            players: { label: "PLAYERS", title: "JUGADORES", intro: "Conoce a los protagonistas del cuadro y su trayectoria." },
            programming: { label: "PROGRAMA", title: "PROGRAMACIÓN", intro: "Actos destacados y momentos clave del evento." },
            schedule: { label: "SCHEDULE", title: "HORARIOS", intro: "Consulta el orden de juego y no te pierdas ningún partido." },
            draw: { label: "DRAW", title: "CUADROS", intro: "Resultados, cruces y evolución completa del torneo." },
            news: { label: "NEWS", title: "NOTICIAS", intro: "Actualidad del evento, entrevistas y momentos destacados." },
            gallery: { label: "GALLERY", title: "GALERÍA", intro: "Revive los mejores instantes del PSA Valencia Open." },
            venue: { label: "VENUE", title: "SEDE DEL TORNEO", intro: "Olympia Hotel, Events & Spa será la sede oficial del PSA Valencia Open · Memorial Chimo Marmaneu." },
            discover: { label: "VALENCIA", title: "EXPERIENCE VALENCIA", intro: "Mucho más que squash. Descubre una de las ciudades más atractivas del Mediterráneo durante tu estancia." },
            sponsors: { label: "SPONSORS", title: "PATROCINADORES", intro: "Gracias a nuestros patrocinadores por hacer posible el PSA Valencia Open 2026." }
        },
        event: { label: "MEMORIAL", title: "CHIMO MARMANEAU", location: "Alboraya · Valencia" },
        tournament: { kicker: "PSA WORLD TOUR COPPER", title: "Torneo", intro: "Descubre todo sobre el PSA Valencia Open 2026 – Memorial Chimo Marmaneu." },
        live: { title: "EN DIRECTO", videoTitle: "Streaming PSA Valencia Open", videoIntro: "Aquí aparecerá el reproductor de YouTube.", court1: "PISTA 1", court2: "PISTA 2", upcoming: "Próximamente", pending: "Partido pendiente" },
        sections: { players: "JUGADORES", schedule: "HORARIOS", draw: "CUADROS", news: "NOTICIAS", gallery: "GALERÍA" },
        venue: { title: "SEDE DEL TORNEO", intro: "Olympia Hotel, Events & Spa será la sede oficial del PSA Valencia Open · Memorial Chimo Marmaneu.", address: "Dirección", phone: "Teléfono", directions: "Cómo llegar", parking: "🅿 Parking", cafe: "☕ Cafetería", restaurant: "🍴 Restaurante", accessible: "♿ Accesible", changing: "🚿 Vestuarios" },
        discover: { label: "VALENCIA", title: "EXPERIENCE VALENCIA", intro: "Mucho más que squash. Descubre una de las ciudades más atractivas del Mediterráneo durante tu estancia.", arts: "Ciudad de las Artes y las Ciencias", artsText: "El lugar más icónico de Valencia. Descubre el Oceanogràfic, el Museo de las Ciencias, el Hemisfèric y uno de los complejos arquitectónicos más espectaculares de Europa.", beach: "Playa de la Malvarrosa", beachText: "Relájate junto al mar Mediterráneo, disfruta de restaurantes locales, chiringuitos y una de las playas más famosas de Valencia.", centre: "Centro histórico", centreText: "Explora la Catedral de Valencia, la Plaza de la Virgen, el Mercado Central y la Lonja de la Seda, Patrimonio Mundial de la UNESCO.", food: "Gastronomía valenciana", foodText: "Prueba la auténtica paella valenciana, horchata, fideuà y cocina mediterránea en la ciudad donde nacieron.", explore: "Explorar ->" },
        sponsors: { title: "PATROCINADORES", intro: "Gracias a nuestros patrocinadores por hacer posible el PSA Valencia Open 2026." },
        footer: { copyright: "© 2026 PSA Valencia Open · Memorial Chimo Marmaneu" }
    },
    va: {
        menu: { discover: "Experience València", sponsors: "Patrocinadors" },
        cta: { live: "DIRECTE" },
        sectionHeaders: {
            quick: { label: "ACCÉS", title: "ACCESSOS DIRECTES", intro: "Entra ràpid a les seccions més importants del torneig." },
            tournament: { label: "PSA WORLD TOUR COPPER", title: "TORNEIG", intro: "Tota la informació oficial del PSA Valencia Open 2026." },
            live: { label: "LIVE", title: "EN DIRECTE", intro: "Segueix els partits en temps real des de la pista principal." },
            players: { label: "PLAYERS", title: "JUGADORS", intro: "Coneix els protagonistes del quadre i la seua trajectòria." },
            programming: { label: "PROGRAMA", title: "PROGRAMACIÓ", intro: "Actes destacats i moments clau de l'esdeveniment." },
            schedule: { label: "SCHEDULE", title: "HORARIS", intro: "Consulta l'ordre de joc i no et perdes cap partit." },
            draw: { label: "DRAW", title: "QUADRES", intro: "Resultats, encreuaments i evolució completa del torneig." },
            news: { label: "NEWS", title: "NOTÍCIES", intro: "Actualitat de l'esdeveniment, entrevistes i moments destacats." },
            gallery: { label: "GALLERY", title: "GALERIA", intro: "Reviu els millors instants del PSA Valencia Open." },
            venue: { label: "VENUE", title: "SEU DEL TORNEIG", intro: "Olympia Hotel, Events & Spa serà la seu oficial del PSA Valencia Open · Memorial Chimo Marmaneu." },
            discover: { label: "VALÈNCIA", title: "EXPERIENCE VALÈNCIA", intro: "Molt més que esquaix. Descobreix una de les ciutats més atractives de la Mediterrània durant la teua estada." },
            sponsors: { label: "SPONSORS", title: "PATROCINADORS", intro: "Gràcies als nostres patrocinadors per fer possible el PSA Valencia Open 2026." }
        },
        event: { label: "MEMORIAL", title: "CHIMO MARMANEAU", location: "Alboraia · València" },
        tournament: { kicker: "PSA WORLD TOUR COPPER", title: "Torneig", intro: "Descobreix tot sobre el PSA Valencia Open 2026 – Memorial Chimo Marmaneu." },
        live: { title: "EN DIRECTE", videoTitle: "Retransmissió PSA Valencia Open", videoIntro: "Ací apareixerà el reproductor de YouTube.", court1: "PISTA 1", court2: "PISTA 2", upcoming: "Pròximament", pending: "Partit pendent" },
        sections: { players: "JUGADORS", schedule: "HORARIS", draw: "QUADRES", news: "NOTÍCIES", gallery: "GALERIA" },
        venue: { title: "SEU DEL TORNEIG", intro: "Olympia Hotel, Events & Spa serà la seu oficial del PSA Valencia Open · Memorial Chimo Marmaneu.", address: "Adreça", phone: "Telèfon", directions: "Com arribar", parking: "🅿 Aparcament", cafe: "☕ Cafeteria", restaurant: "🍴 Restaurant", accessible: "♿ Accessible", changing: "🚿 Vestidors" },
        discover: { label: "VALÈNCIA", title: "EXPERIENCE VALÈNCIA", intro: "Molt més que esquaix. Descobreix una de les ciutats més atractives de la Mediterrània durant la teua estada.", arts: "Ciutat de les Arts i les Ciències", artsText: "El lloc més icònic de València. Descobreix l'Oceanogràfic, el Museu de les Ciències, l'Hemisfèric i un dels complexos arquitectònics més espectaculars d'Europa.", beach: "Platja de la Malva-rosa", beachText: "Relaxa't vora la mar Mediterrània, gaudeix de restaurants locals, xiringuitos i una de les platges més famoses de València.", centre: "Centre històric", centreText: "Explora la Catedral de València, la Plaça de la Mare de Déu, el Mercat Central i la Llotja de la Seda, Patrimoni Mundial de la UNESCO.", food: "Gastronomia valenciana", foodText: "Tasta l'autèntica paella valenciana, orxata, fideuà i cuina mediterrània a la ciutat on van nàixer.", explore: "Explorar ->" },
        sponsors: { title: "PATROCINADORS", intro: "Gràcies als nostres patrocinadors per fer possible el PSA Valencia Open 2026." },
        footer: { copyright: "© 2026 PSA Valencia Open · Memorial Chimo Marmaneu" }
    },
    en: {
        menu: { discover: "Experience Valencia", sponsors: "Sponsors" },
        cta: { live: "LIVE" },
        sectionHeaders: {
            quick: { label: "ACCESS", title: "QUICK ACCESS", intro: "Jump directly to the most important tournament sections." },
            tournament: { label: "PSA WORLD TOUR COPPER", title: "TOURNAMENT", intro: "All official information about PSA Valencia Open 2026." },
            live: { label: "LIVE", title: "LIVE", intro: "Follow matches in real time from the main court." },
            players: { label: "PLAYERS", title: "PLAYERS", intro: "Meet the draw protagonists and follow their journey." },
            programming: { label: "PROGRAM", title: "PROGRAM", intro: "Featured activities and key event moments." },
            schedule: { label: "SCHEDULE", title: "SCHEDULE", intro: "Check the order of play and do not miss a match." },
            draw: { label: "DRAW", title: "DRAWS", intro: "Results, matchups and full tournament progression." },
            news: { label: "NEWS", title: "NEWS", intro: "Event updates, interviews and key highlights." },
            gallery: { label: "GALLERY", title: "GALLERY", intro: "Relive the best moments of the PSA Valencia Open." },
            venue: { label: "VENUE", title: "TOURNAMENT VENUE", intro: "Olympia Hotel, Events & Spa will be the official venue for the PSA Valencia Open · Memorial Chimo Marmaneu." },
            discover: { label: "VALENCIA", title: "EXPERIENCE VALENCIA", intro: "Much more than squash. Discover one of the Mediterranean's most attractive cities during your stay." },
            sponsors: { label: "SPONSORS", title: "SPONSORS", intro: "Thank you to our sponsors for making the PSA Valencia Open 2026 possible." }
        },
        event: { label: "MEMORIAL", title: "CHIMO MARMANEAU", location: "Alboraya · Valencia" },
        tournament: { kicker: "PSA WORLD TOUR COPPER", title: "Tournament", intro: "Discover everything about the PSA Valencia Open 2026 – Memorial Chimo Marmaneu." },
        live: { title: "LIVE", videoTitle: "PSA Valencia Open streaming", videoIntro: "The YouTube player will appear here.", court1: "COURT 1", court2: "COURT 2", upcoming: "Coming soon", pending: "Match pending" },
        sections: { players: "PLAYERS", schedule: "SCHEDULE", draw: "DRAWS", news: "NEWS", gallery: "GALLERY" },
        venue: { title: "TOURNAMENT VENUE", intro: "Olympia Hotel, Events & Spa will be the official venue for the PSA Valencia Open · Memorial Chimo Marmaneu.", address: "Address", phone: "Phone", directions: "Get directions", parking: "🅿 Parking", cafe: "☕ Café", restaurant: "🍴 Restaurant", accessible: "♿ Accessible", changing: "🚿 Changing rooms" },
        discover: { label: "VALENCIA", title: "EXPERIENCE VALENCIA", intro: "Much more than squash. Discover one of the Mediterranean's most attractive cities during your stay.", arts: "City of Arts & Sciences", artsText: "Valencia's most iconic landmark. Discover the Oceanogràfic, Science Museum, Hemisfèric and one of Europe's most spectacular architectural complexes.", beach: "Malvarrosa Beach", beachText: "Relax by the Mediterranean Sea, enjoy local restaurants, beach bars and one of Valencia's most famous beaches.", centre: "Historic Centre", centreText: "Explore Valencia Cathedral, Plaza de la Virgen, the Central Market and the UNESCO World Heritage Silk Exchange.", food: "Valencian Gastronomy", foodText: "Taste authentic Paella Valenciana, Horchata, Fideuà and Mediterranean cuisine in the city where they were born.", explore: "Explore ->" },
        sponsors: { title: "SPONSORS", intro: "Thank you to our sponsors for making the PSA Valencia Open 2026 possible." },
        footer: { copyright: "© 2026 PSA Valencia Open · Memorial Chimo Marmaneu" }
    },
    fr: {
        menu: { discover: "Experience Valencia", sponsors: "Sponsors" },
        cta: { live: "DIRECT" },
        sectionHeaders: {
            quick: { label: "ACCÈS", title: "ACCÈS RAPIDES", intro: "Accédez rapidement aux sections les plus importantes du tournoi." },
            tournament: { label: "PSA WORLD TOUR COPPER", title: "TOURNOI", intro: "Toutes les informations officielles du PSA Valencia Open 2026." },
            live: { label: "LIVE", title: "EN DIRECT", intro: "Suivez les matchs en temps réel depuis le court principal." },
            players: { label: "PLAYERS", title: "JOUEURS", intro: "Découvrez les protagonistes du tableau et leur parcours." },
            programming: { label: "PROGRAMME", title: "PROGRAMME", intro: "Temps forts et moments clés de l'événement." },
            schedule: { label: "SCHEDULE", title: "PROGRAMME", intro: "Consultez l'ordre des matchs et ne manquez aucune rencontre." },
            draw: { label: "DRAW", title: "TABLEAUX", intro: "Résultats, confrontations et évolution complète du tournoi." },
            news: { label: "NEWS", title: "ACTUALITÉS", intro: "Actualité de l'événement, interviews et moments forts." },
            gallery: { label: "GALLERY", title: "GALERIE", intro: "Revivez les meilleurs moments du PSA Valencia Open." },
            venue: { label: "VENUE", title: "LIEU DU TOURNOI", intro: "Olympia Hotel, Events & Spa sera le lieu officiel du PSA Valencia Open · Memorial Chimo Marmaneu." },
            discover: { label: "VALENCE", title: "EXPERIENCE VALENCIA", intro: "Bien plus que le squash. Découvrez l'une des villes les plus attrayantes de la Méditerranée pendant votre séjour." },
            sponsors: { label: "SPONSORS", title: "PARTENAIRES", intro: "Merci à nos partenaires de rendre possible le PSA Valencia Open 2026." }
        },
        event: { label: "MÉMORIAL", title: "CHIMO MARMANEAU", location: "Alboraia · Valence" },
        tournament: { kicker: "PSA WORLD TOUR COPPER", title: "Tournoi", intro: "Découvrez tout sur le PSA Valencia Open 2026 – Memorial Chimo Marmaneu." },
        live: { title: "EN DIRECT", videoTitle: "Diffusion PSA Valencia Open", videoIntro: "Le lecteur YouTube apparaîtra ici.", court1: "COURT 1", court2: "COURT 2", upcoming: "Prochainement", pending: "Match en attente" },
        sections: { players: "JOUEURS", schedule: "PROGRAMME", draw: "TABLEAUX", news: "ACTUALITÉS", gallery: "GALERIE" },
        venue: { title: "LIEU DU TOURNOI", intro: "Olympia Hotel, Events & Spa sera le lieu officiel du PSA Valencia Open · Memorial Chimo Marmaneu.", address: "Adresse", phone: "Téléphone", directions: "Itinéraire", parking: "🅿 Parking", cafe: "☕ Cafétéria", restaurant: "🍴 Restaurant", accessible: "♿ Accessible", changing: "🚿 Vestiaires" },
        discover: { label: "VALENCE", title: "EXPERIENCE VALENCIA", intro: "Bien plus que le squash. Découvrez l'une des villes les plus attrayantes de la Méditerranée pendant votre séjour.", arts: "Cité des Arts et des Sciences", artsText: "Le lieu le plus emblématique de Valence. Découvrez l'Oceanogràfic, le Musée des Sciences, l'Hemisfèric et l'un des ensembles architecturaux les plus spectaculaires d'Europe.", beach: "Plage de la Malvarrosa", beachText: "Détendez-vous au bord de la Méditerranée, profitez des restaurants locaux, des bars de plage et de l'une des plages les plus célèbres de Valence.", centre: "Centre historique", centreText: "Explorez la Cathédrale de Valence, la Plaza de la Virgen, le Marché Central et la Bourse de la Soie, classée au patrimoine mondial de l'UNESCO.", food: "Gastronomie valencienne", foodText: "Goûtez l'authentique Paella Valenciana, l'horchata, la fideuà et la cuisine méditerranéenne dans la ville où elles sont nées.", explore: "Explorer ->" },
        sponsors: { title: "PARTENAIRES", intro: "Merci à nos partenaires de rendre possible le PSA Valencia Open 2026." },
        footer: { copyright: "© 2026 PSA Valencia Open · Memorial Chimo Marmaneu" }
    }
};

Object.entries(pageTranslations).forEach(([lang, content]) => {
    const { menu, ...sections } = content;
    Object.assign(translations[lang], sections);
    Object.assign(translations[lang].menu, menu);
});

const languageNames = {

    es: "ES",

    va: "VA",

    en: "EN",

    fr: "FR"

};

let currentLanguage =
localStorage.getItem("language") || "es";

const TOURNAMENT_MODE_KEY = "tournamentContentMode";
const TOURNAMENT_API_URL_KEY = "tournamentApiUrl";
const TOURNAMENT_MANUAL_CONTENT_KEY = "tournamentManualContent";
const HERO_SETTINGS_KEY = "heroSettings";
const LANGUAGE_CLOUD_KEYS = [
    TOURNAMENT_MODE_KEY,
    TOURNAMENT_API_URL_KEY,
    TOURNAMENT_MANUAL_CONTENT_KEY,
    HERO_SETTINGS_KEY
];

const tournamentIntroByLanguage = {
        es: `
<article class="tournament-article">
    <div class="tournament-card">
        <header class="tournament-header">
            <h3>¡Bienvenidos al PSA Valencia 2026 - Memorial Chimo Marmaneu!</h3>
            <p>Valencia se convierte de nuevo en el epicentro del squash internacional.</p>
        </header>
        <section class="tournament-content">
            <p>Del <strong>11 al 15 de agosto de 2026</strong>, nuestra ciudad acogerá el <strong>PSA Valencia 2026 - Memorial Chimo Marmaneu</strong>, una cita imprescindible dentro del calendario de la Asociación Profesional de Squash (PSA).</p>
            <p>Este año, el torneo da un salto histórico de categoría al consolidarse como un evento <strong>PSA World Tour Copper</strong> en la modalidad masculina. Con un coste de organización de <strong>más de 50.000 dólares</strong>, atraerá a varias de las mejores raquetas del planeta, garantizando un espectáculo deportivo del más alto nivel, una intensidad física inigualable y puntos cruciales para el ranking mundial.</p>
            <section class="tournament-history">
                <h4>Nuestro legado: El camino hasta el World Tour</h4>
                <p>El PSA Valencia no es solo un torneo; es un homenaje al legado de nuestro deporte y una evolución constante:</p>
                <ul>
                    <li><strong>Edición 2025:</strong> El año pasado, el torneo (en categoría Challenger 15K) coronó al jugador español <strong>Iker Pajares</strong> como campeón indiscutible, levantando el trofeo sin ceder un solo juego.</li>
                    <li><strong>Consolidación:</strong> Tras años de éxito organizativo, la confianza de la PSA y el apoyo de los aficionados han hecho posible el ascenso a la prestigiosa categoría <em>Copper</em>, situando a Valencia en el mapa mundial.</li>
                </ul>
            </section>
            <footer class="tournament-footer">
                <p class="lead">Prepárate para vivir cinco días de pura adrenalina, velocidad y estrategia.</p>
                <p>Sigue los partidos en directo en el club o vibra con la retransmisión global a través de <a href="https://squash.tv" target="_blank" rel="noopener">SquashTV</a>.</p>
            </footer>
        </section>
    </div>
</article>`,
        va: `
<article class="tournament-article">
    <div class="tournament-card">
        <header class="tournament-header">
            <h3>Benvinguts al PSA Valencia 2026 - Memorial Chimo Marmaneu!</h3>
            <p>Valencia es convertix de nou en l'epicentre del squash internacional.</p>
        </header>
        <section class="tournament-content">
            <p>Del <strong>11 al 15 d'agost de 2026</strong>, la nostra ciutat acollirà el <strong>PSA Valencia 2026 - Memorial Chimo Marmaneu</strong>, una cita imprescindible dins del calendari de l'Associació Professional de Squash (PSA).</p>
            <p>Enguany, el torneig fa un salt històric de categoria en consolidar-se com un esdeveniment <strong>PSA World Tour Copper</strong> en la modalitat masculina. Amb un cost d'organització de <strong>més de 50.000 dòlars</strong>, atraurà algunes de les millors raquetes del planeta, garantint un espectacle del més alt nivell.</p>
            <section class="tournament-history">
                <h4>El nostre llegat: El camí cap al World Tour</h4>
                <p>El PSA Valencia no és només un torneig; és un homenatge al llegat del nostre esport i una evolució constant:</p>
                <ul>
                    <li><strong>Edició 2025:</strong> L'any passat, el torneig (categoria Challenger 15K) va coronar el jugador espanyol <strong>Iker Pajares</strong> com a campió indiscutible.</li>
                    <li><strong>Consolidació:</strong> Després d'anys d'èxit organitzatiu, la confiança de la PSA i el suport dels aficionats han fet possible l'ascens a la categoria <em>Copper</em>.</li>
                </ul>
            </section>
            <footer class="tournament-footer">
                <p class="lead">Prepara't per a viure cinc dies de pura adrenalina, velocitat i estratègia.</p>
                <p>Seguix els partits en directe al club o a través de <a href="https://squash.tv" target="_blank" rel="noopener">SquashTV</a>.</p>
            </footer>
        </section>
    </div>
</article>`,
        en: `
<article class="tournament-article">
    <div class="tournament-card">
        <header class="tournament-header">
            <h3>Welcome to PSA Valencia 2026 - Memorial Chimo Marmaneu!</h3>
            <p>Valencia once again becomes the epicenter of international squash.</p>
        </header>
        <section class="tournament-content">
            <p>From <strong>August 11th to 15th, 2026</strong>, our city will host the <strong>PSA Valencia 2026 - Memorial Chimo Marmaneu</strong>, an essential stop on the Professional Squash Association (PSA) calendar.</p>
            <p>This year, the tournament reaches a historic milestone by upgrading to a <strong>PSA World Tour Copper</strong> men's event. With an organizational cost of <strong>more than $50,000</strong>, it will bring top players together for elite-level performance, unmatched intensity and crucial ranking points.</p>
            <section class="tournament-history">
                <h4>Our Legacy: The Road to the World Tour</h4>
                <p>PSA Valencia is more than a tournament; it is a tribute to our sport and a story of constant growth:</p>
                <ul>
                    <li><strong>2025 Edition:</strong> Last year, as a Challenger 15K event, Spain's <strong>Iker Pajares</strong> claimed the title without dropping a single game.</li>
                    <li><strong>Consolidation:</strong> Years of organizational success, PSA trust and fan support made this promotion to the prestigious <em>Copper</em> category possible.</li>
                </ul>
            </section>
            <footer class="tournament-footer">
                <p class="lead">Get ready for five days of pure adrenaline, speed and strategy.</p>
                <p>Watch matches live at the club or worldwide on <a href="https://squash.tv" target="_blank" rel="noopener">SquashTV</a>.</p>
            </footer>
        </section>
    </div>
</article>`,
        fr: `
<article class="tournament-article">
    <div class="tournament-card">
        <header class="tournament-header">
            <h3>Bienvenue au PSA Valencia 2026 - Memorial Chimo Marmaneu!</h3>
            <p>Valence redevient le centre névralgique du squash international.</p>
        </header>
        <section class="tournament-content">
            <p>Du <strong>11 au 15 août 2026</strong>, notre ville accueillera le <strong>PSA Valencia 2026 - Memorial Chimo Marmaneu</strong>, un rendez-vous majeur du calendrier de la Professional Squash Association (PSA).</p>
            <p>Cette année, le tournoi franchit un cap historique en rejoignant la catégorie <strong>PSA World Tour Copper</strong> chez les hommes. Avec un coût d'organisation de <strong>plus de 50 000 dollars</strong>, l'événement réunira des joueurs d'élite et des points précieux pour le classement mondial.</p>
            <section class="tournament-history">
                <h4>Notre héritage: Le chemin vers le World Tour</h4>
                <p>Le PSA Valencia est bien plus qu'un tournoi; c'est un hommage à l'histoire de notre sport et une évolution continue:</p>
                <ul>
                    <li><strong>Édition 2025:</strong> L'an dernier, en Challenger 15K, l'Espagnol <strong>Iker Pajares</strong> a été sacré champion sans perdre un seul jeu.</li>
                    <li><strong>Consolidation:</strong> Le succès organisationnel, la confiance de la PSA et le soutien des supporters ont permis l'ascension vers la catégorie <em>Copper</em>.</li>
                </ul>
            </section>
            <footer class="tournament-footer">
                <p class="lead">Préparez-vous à vivre cinq jours de pure adrénaline, vitesse et stratégie.</p>
                <p>Suivez les matchs en direct au club ou à travers la diffusion mondiale sur <a href="https://squash.tv" target="_blank" rel="noopener">SquashTV</a>.</p>
            </footer>
        </section>
    </div>
</article>`
};

function getTournamentMode(){

    const mode = localStorage.getItem(TOURNAMENT_MODE_KEY);

    return mode === "api" ? "api" : "manual";

}

function getTournamentApiUrl(){

    return (localStorage.getItem(TOURNAMENT_API_URL_KEY) || "").trim();

}

function readTournamentApiResponse(payload, lang){

    if(!payload) return "";

    if(typeof payload === "string"){

        return payload;

    }

    if(typeof payload === "object"){

        return payload[lang]
            || payload.html
            || payload.content?.[lang]
            || payload.content
            || "";

    }

    return "";

}

function readTournamentManualContent(){

    try{

        const raw = localStorage.getItem(TOURNAMENT_MANUAL_CONTENT_KEY);
        if(!raw) return null;

        const parsed = JSON.parse(raw);
        if(!parsed || typeof parsed !== "object") return null;

        return {
            title: parsed?.title || null,
            body: parsed?.body || null
        };

    } catch(error){

        return null;

    }

}

function getLocalizedValue(value, lang){

    if(!value) return "";

    if(typeof value === "string"){

        return value;

    }

    if(typeof value === "object"){

        return value[lang] || value.es || value.va || value.en || value.fr || "";

    }

    return "";

}

function escapeHtml(value){

    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");

}

function renderTournamentManualHtml(content, lang){

    if(!content) return "";

    const title = getLocalizedValue(content.title, lang).trim();
    const body = getLocalizedValue(content.body, lang).trim();

    if(!title || !body) return "";

    const paragraphs = body
        .split(/\n{2,}/)
        .map((chunk) => chunk.trim())
        .filter(Boolean)
        .map((chunk) => `<p>${escapeHtml(chunk).replace(/\n/g, "<br>")}</p>`)
        .join("");

    return `
<article class="tournament-article">
    <div class="tournament-card">
        <header class="tournament-header">
            <h3>${escapeHtml(title)}</h3>
        </header>
        <section class="tournament-content">
            ${paragraphs}
        </section>
    </div>
</article>`;

}

async function fetchTournamentIntroFromApi(lang, apiUrl){

    const separator = apiUrl.includes("?") ? "&" : "?";

    const urlWithLang = `${apiUrl}${separator}lang=${encodeURIComponent(lang)}`;

    const response = await fetch(urlWithLang, { headers: { "Accept": "application/json, text/html" } });

    if(!response.ok){

        throw new Error(`API status ${response.status}`);

    }

    const contentType = response.headers.get("content-type") || "";

    if(contentType.includes("application/json")){

        const payload = await response.json();

        return readTournamentApiResponse(payload, lang);

    }

    return response.text();

}

async function renderTournamentIntro(lang){

    const container = document.getElementById("tournament-intro");
    if(!container) return;

    const manualHtml = tournamentIntroByLanguage[lang] || tournamentIntroByLanguage.es;
    const manualContent = readTournamentManualContent();
    const customManualHtml = renderTournamentManualHtml(manualContent, lang);
    const defaultManualHtml = customManualHtml || manualHtml;
    const mode = getTournamentMode();

    if(mode !== "api"){

        container.innerHTML = defaultManualHtml;
        return;

    }

    const apiUrl = getTournamentApiUrl();

    if(!apiUrl){

        container.innerHTML = defaultManualHtml;
        return;

    }

    try{

        const apiHtml = await fetchTournamentIntroFromApi(lang, apiUrl);

        container.innerHTML = apiHtml || defaultManualHtml;

    } catch(error){

        console.warn("No se pudo cargar Torneo desde API. Usando contenido manual.", error);

        container.innerHTML = defaultManualHtml;

    }

}

function t(path){

    const keys = path.split(".");

    let value = translations[currentLanguage];

    for(const key of keys){

        value = value?.[key];

    }

    return value ?? "";

}

function setLanguage(lang){

    if(!translations[lang]) return;

    currentLanguage = lang;

    localStorage.setItem("language",lang);

    document.documentElement.lang = lang;

    document
        .querySelectorAll("[data-i18n]")
        .forEach(el=>{

            const text=t(el.dataset.i18n);

            if(text){

                el.textContent=text;

            }

        });

    renderTournamentIntro(lang);

    const toggle=document.getElementById("languageToggle");

    if(toggle){

        toggle.innerHTML = "🌐 <strong>" + languageNames[lang] + "</strong> ▼";

    }
    document
        .querySelectorAll("#languageMenu button")
        .forEach(button=>{

            button.classList.toggle(
                "active",
                button.dataset.lang===lang
            );

        });

    document.dispatchEvent(new CustomEvent("app-language-changed", {
        detail: { language: lang }
    }));

}

function openLanguageMenu(){

    const menu=document.getElementById("languageMenu");
    if (!menu) return;

        menu.classList.toggle("show");

    

}

function closeLanguageMenu(){

    const menu=document.getElementById("languageMenu");

    if(menu){

        menu.classList.remove("show");

    }

}

async function syncLanguageStateFromCloud(){

    const cloud = window.PSACloudStore;
    if(!cloud?.isReady?.()) return;

    await cloud.syncLocalStorageFromCloud(LANGUAGE_CLOUD_KEYS);

}

document.addEventListener("DOMContentLoaded", async ()=>{

    await syncLanguageStateFromCloud();

    setLanguage(currentLanguage);

    const toggle=document.getElementById("languageToggle");

    const menu=document.getElementById("languageMenu");

    if(toggle){

        toggle.addEventListener("click",(e)=>{

            e.stopPropagation();

            openLanguageMenu();

        });

    }

    document
        .querySelectorAll("#languageMenu button")
        .forEach(button=>{

            button.addEventListener("click",()=>{

                setLanguage(button.dataset.lang);

                closeLanguageMenu();

            });

        });

    document.addEventListener("click",(e)=>{

        const selector=document.querySelector(".language-selector");

        if(selector && !selector.contains(e.target)){

            closeLanguageMenu();

        }

    });

});
