/* Stockage : données JSON dans localStorage, photos dans IndexedDB ou dossier Photos/
   Toutes les fonctions sont tolérantes aux pannes (navigation privée, stockage bloqué). */
"use strict";

const DB_NAME = "calendrier-familial";
const DB_STORE = "photos";
const LS_KEY = "calendrier-familial-donnees";

let db = null;
let dbDisponible = null;

function openDB() {
    return new Promise((resolve) => {
        if (db) return resolve(db);
        if (dbDisponible === false) return resolve(null);
        let req;
        try {
            req = indexedDB.open(DB_NAME, 1);
        } catch (e) {
            dbDisponible = false;
            return resolve(null);
        }
        req.onupgradeneeded = (e) => {
            e.target.result.createObjectStore(DB_STORE);
        };
        req.onsuccess = (e) => { db = e.target.result; dbDisponible = true; resolve(db); };
        req.onerror = () => { dbDisponible = false; resolve(null); };
        req.onblocked = () => { dbDisponible = false; resolve(null); };
    });
}

async function photoSave(nom, blob) {
    const d = await openDB();
    if (!d) return;
    return new Promise((resolve, reject) => {
        const tx = d.transaction(DB_STORE, "readwrite");
        tx.objectStore(DB_STORE).put(blob, nom);
        tx.oncomplete = resolve;
        tx.onerror = (e) => reject(e.target.error);
    });
}

async function photoDelete(nom) {
    const d = await openDB();
    if (!d) return;
    return new Promise((resolve, reject) => {
        const tx = d.transaction(DB_STORE, "readwrite");
        tx.objectStore(DB_STORE).delete(nom);
        tx.oncomplete = resolve;
        tx.onerror = (e) => reject(e.target.error);
    });
}

async function photoGetURL(nom) {
    const d = await openDB();
    if (!d) return null;
    return new Promise((resolve) => {
        const tx = d.transaction(DB_STORE, "readonly");
        const req = tx.objectStore(DB_STORE).get(nom);
        req.onsuccess = () => resolve(req.result ? URL.createObjectURL(req.result) : null);
        req.onerror = () => resolve(null);
    });
}

async function photoListeNoms() {
    const d = await openDB();
    if (!d) return [];
    return new Promise((resolve) => {
        const tx = d.transaction(DB_STORE, "readonly");
        const req = tx.objectStore(DB_STORE).getAllKeys();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
    });
}

/* ----- Photos : IndexedDB d'abord, sinon dossier Photos/ à côté de l'app ----- */
const PHOTO_DIR = "Photos/";
const PHOTO_EXTS = ["jpg", "jpeg", "png", "webp", "gif"];
const cachePhotosDossier = {};

function normaliserNom(nom) {
    return String(nom).normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .toLowerCase().replace(/\s+/g, " ").trim();
}

async function photoDossierURL(nom) {
    const cle = normaliserNom(nom);
    if (cle in cachePhotosDossier) return cachePhotosDossier[cle];
    const essais = [`${PHOTO_DIR}${encodeURIComponent(nom)}`, ...PHOTO_EXTS.map(e => `${PHOTO_DIR}${encodeURIComponent(nom)}.${e}`)];
    for (const url of essais) {
        if (await imageExiste(url)) {
            cachePhotosDossier[cle] = url;
            return url;
        }
    }
    cachePhotosDossier[cle] = null;
    return null;
}

function imageExiste(url) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(true);
        img.onerror = () => resolve(false);
        img.src = url;
    });
}

async function resoudrePhoto(nom) {
    return state.cachePhotos[nom] || await photoDossierURL(nom);
}

/* ----- Données ----- */
function chargerDonnees() {
    let brut = null;
    try { brut = localStorage.getItem(LS_KEY); } catch (e) { }
    if (brut) {
        try { return JSON.parse(brut); } catch (e) { }
    }
    const base = JSON.parse(JSON.stringify(mesDonnees));
    return base;
}

function sauverDonnees(donnees) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(donnees)); } catch (e) { }
}

function reinitialiserDonnees() {
    try { localStorage.removeItem(LS_KEY); } catch (e) { }
    return chargerDonnees();
}
