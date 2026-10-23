/* Version imprimable A4 paysage — fidèle à l'ancien système Publisher */
"use strict";

const MOIS_NOMS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
const JOURS_NOMS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const TYPE_ICONES = { "naissance": "🎂", "mariage": "💍", "rencontre": "❤️", "deces": "🕊️" };

function calcGrille(n) {
    const table = {
        1: { cols: 1, rows: 1 }, 2: { cols: 2, rows: 1 }, 3: { cols: 3, rows: 1 },
        4: { cols: 2, rows: 2 }, 5: { cols: 3, rows: 2 }, 6: { cols: 3, rows: 2 },
        7: { cols: 4, rows: 2 }, 8: { cols: 4, rows: 2 }, 9: { cols: 3, rows: 3 },
        10: { cols: 4, rows: 3 }, 11: { cols: 4, rows: 3 }, 12: { cols: 4, rows: 3 },
        13: { cols: 5, rows: 3 }, 14: { cols: 5, rows: 3 }, 15: { cols: 5, rows: 3 }
    };
    if (n <= 0) return { cols: 1, rows: 1 };
    if (table[n]) return table[n];
    const cols = Math.ceil(Math.sqrt(n * 1.8));
    return { cols, rows: Math.ceil(n / cols) };
}

function escapeHtml(s) {
    return String(s ?? "").replace(/[&<>"']/g, c => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[c]);
}

async function genererImpression(annee, donnees) {
    const area = document.getElementById("print-area");
    let html = "";

    for (let m = 0; m < 12; m++) {
        const mois = m + 1;
        const annivs = donnees.anniversaires
            .filter(a => a.mois === mois && !state.exclus.has(a.nom))
            .sort((a, b) => a.jour - b.jour);

        const evenements = [];
        (donnees.jours_feries[annee] || []).forEach(f => {
            if (parseInt(f.date.split("-")[1]) === mois)
                evenements.push({ jour: parseInt(f.date.split("-")[2]), libelle: f.label, icone: "🎉" });
        });
        (donnees.evenements_speciaux[annee] || []).forEach(e => {
            if (parseInt(e.date.split("-")[1]) === mois)
                evenements.push({ jour: parseInt(e.date.split("-")[2]), libelle: e.label, icone: e.icone || "📌" });
        });
        evenements.sort((a, b) => a.jour - b.jour);

        const conges = [...new Set((donnees.vacances[annee] || [])
            .filter(v => {
                const d = parseInt(v.debut.split("-")[1]), f = parseInt(v.fin.split("-")[1]);
                return mois >= d && mois <= f;
            }).map(v => v.label))];

        const avecPhotos = (await Promise.all(annivs.map(async a => {
            const url = await resoudrePhoto(a.nom);
            return url ? { ...a, _url: url } : null;
        }))).filter(Boolean);
        let photosHtml;
        if (avecPhotos.length === 0) {
            photosHtml = `<div style="grid-column:1/-1;display:flex;align-items:center;justify-content:center;color:#bbb;font-style:italic;">Aucune photo</div>`;
        } else {
            const g = calcGrille(avecPhotos.length);
            photosHtml = `<div class="print-photos" style="grid-template-columns:repeat(${g.cols},1fr);grid-template-rows:repeat(${g.rows},1fr);">` +
                avecPhotos.map(a => {
                    const note = (a.note && a.note.trim()) ? `<span class="photo-note">${escapeHtml(a.note)}</span>` : "";
                    return `<div class="photo-wrapper">
                        <div class="photo-img-wrap"><img src="${a._url}" alt="">${note}</div>
                        <div class="photo-label">${escapeHtml(a.nom)}</div>
                    </div>`;
                }).join("") + `</div>`;
        }

        const infosHtml = `<div class="print-infos">
            <h3 class="p-h3">🎂 Anniversaires</h3>
            <ul class="p-ul">${annivs.map(a => `<li><strong>${a.jour}</strong> : ${TYPE_ICONES[a.type] || "🎂"} ${escapeHtml(a.nom)} ${(a.annee && a.annee !== "") ? `(${annee - a.annee} ans)` : ""}</li>`).join("")}</ul>
            ${evenements.length ? `<h3 class="p-h3">📅 Événements</h3><ul class="p-ul">${evenements.map(e => `<li><strong>${e.jour}</strong> : ${e.icone} ${escapeHtml(e.libelle)}</li>`).join("")}</ul>` : ""}
            ${conges.length ? `<h3 class="p-h3">🏖️ Congés</h3><ul class="p-ul">${conges.map(c => `<li>${escapeHtml(c)}</li>`).join("")}</ul>` : ""}
            <div class="p-legende">Bleu : Congés scolaires — Rouge : Congés légaux</div>
        </div>`;

        const premierJour = (new Date(annee, m, 1).getDay() + 6) % 7;
        const joursDansMois = new Date(annee, m + 1, 0).getDate();
        let calHtml = `<table class="print-cal"><tr>${JOURS_NOMS.map(j => `<th>${j}</th>`).join("")}</tr><tr>`;
        for (let i = 0; i < premierJour; i++) calHtml += `<td></td>`;
        for (let d = 1; d <= joursDansMois; d++) {
            if ((premierJour + d - 1) % 7 === 0 && d > 1) calHtml += "</tr><tr>";
            const dateStr = `${annee}-${String(mois).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
            const isWE = [0, 6].includes(new Date(annee, m, d).getDay());
            const ferie = (donnees.jours_feries[annee] || []).find(f => f.date === dateStr);
            const spec = (donnees.evenements_speciaux[annee] || []).find(e => e.date === dateStr);
            const vac = (donnees.vacances[annee] || []).find(v => dateStr >= v.debut && dateStr <= v.fin);
            const cls = ferie ? "is-holiday" : (vac ? "is-vacation" : (isWE ? "is-weekend" : ""));
            const icons = annivs.filter(a => a.jour === d).map(a => TYPE_ICONES[a.type] || "🎂").join("")
                + (ferie ? "🎉" : "") + (spec ? (spec.icone || "📌") : "");
            calHtml += `<td class="${cls}"><span class="p-day">${d}</span><div class="p-icons">${icons}</div></td>`;
        }
        calHtml += "</tr></table>";

        html += `<div class="page">
            <h1 class="print-month-title">${MOIS_NOMS[m]} ${annee}</h1>
            <div class="print-flex">${photosHtml}${infosHtml}</div>
            <div class="print-cal-wrapper">${calHtml}</div>
        </div>`;
    }

    area.innerHTML = html;
    window.print();
}
