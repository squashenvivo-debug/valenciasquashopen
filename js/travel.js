async function loadTravelCards(){
    const container = document.getElementById("travelGrid");
    if (!container) return;

    const response = await fetch("data/travel.json");
    if (!response.ok) return;

    const data = await response.json();

    let html = "";

    data.cards.forEach(card=>{

        html += `

        <article class="travel-card">

            <img src="${card.image}" alt="${card.title}">

            <div class="travel-overlay">

                <span>${card.icon}</span>

                <h3>${card.title}</h3>

                <p>${card.description}</p>

                <button>${card.button}</button>

            </div>

        </article>

        `;

    });

    container.innerHTML = html;

}

document.addEventListener("DOMContentLoaded",loadTravelCards);