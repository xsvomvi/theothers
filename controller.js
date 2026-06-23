import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getDatabase, ref, set, onValue } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-database.js";

/* =========================
   FIREBASE
========================= */
const firebaseConfig = {
    apiKey: "AIzaSyD6KYh4VL5yepFU61vV9FcnBNKRT2ZMdBQ",
    authDomain: "the-others-experience.firebaseapp.com",
    databaseURL: "https://the-others-experience-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "the-others-experience",
    storageBucket: "the-others-experience.firebasestorage.app",
    messagingSenderId: "834987892004",
    appId: "1:834987892004:web:af4d1126191d083ed0e7b1"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

/* =========================
   DOM
========================= */
const introScreen = document.getElementById("introScreen");
const messageScreen = document.getElementById("messageScreen");
const waitScreen = document.getElementById("waitScreen");
const controllerScreen = document.getElementById("controllerScreen");
const doneScreen = document.getElementById("doneScreen");

const introBtn = document.getElementById("introBtn");
const messageInput = document.getElementById("messageInput");
const messageBtn = document.getElementById("messageBtn");
const controllerArea = document.getElementById("controllerArea");
const controllerDot = document.getElementById("controllerDot");

/* =========================
   STAP 1 → 2
========================= */
introBtn.addEventListener("click", () => {
    introScreen.classList.add("hidden");
    messageScreen.classList.remove("hidden");
    messageInput.focus();

    // Suggesties klikken vult het inputveld
    document.querySelectorAll(".suggestion").forEach(btn => {
        btn.addEventListener("click", () => {
            messageInput.value = btn.innerText;
            document.querySelectorAll(".suggestion").forEach(b => b.classList.remove("selected"));
            btn.classList.add("selected");
            messageInput.focus();
        });
    });
});

/* =========================
   STAP 2 → 3
========================= */
messageBtn.addEventListener("click", () => {
    const msg = messageInput.value.trim();
    if (!msg) {
        messageInput.style.borderBottom = "1px solid rgba(255,255,255,0.6)";
        messageInput.placeholder = "please write something first.";
        return;
    }

    set(ref(db, "game/message"), msg);

    messageScreen.classList.add("hidden");
    waitScreen.classList.remove("hidden");

    // Luister op game status van apparaat 1
    onValue(ref(db, "game/status"), (snapshot) => {
        const status = snapshot.val();

        if (status === "started") {
            waitScreen.classList.add("hidden");
            controllerScreen.classList.remove("hidden");
        }

        if (status === "ended") {
            controllerScreen.classList.add("hidden");
            doneScreen.classList.remove("hidden");
        }
    });
});

/* =========================
   CONTROLLER — MUIS
========================= */
controllerArea.addEventListener("mousemove", (e) => {
    handleMove(e.clientX, e.clientY);
});

/* =========================
   CONTROLLER — TOUCH
========================= */
controllerArea.addEventListener("touchmove", (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    handleMove(touch.clientX, touch.clientY);
}, { passive: false });

/* =========================
   POSITIE STUREN
========================= */
let lastSend = 0;

function handleMove(clientX, clientY) {

    const now = Date.now();
    if (now - lastSend < 50) return; // max 20x per seconde
    lastSend = now;

    const rect = controllerArea.getBoundingClientRect();

    const fracX = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const fracY = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));

    // Dot bewegen in het controller vlak
    controllerDot.style.left = (fracX * 100) + "%";
    controllerDot.style.top = (fracY * 100) + "%";

    // Omrekenen naar schermcoördinaten
    const targetW = 1920;
    const targetH = 1080;
    const padding = 20;

    const x = padding + fracX * (targetW - 400 - padding * 2);
    const y = padding + fracY * (targetH - 300 - padding * 2);

    set(ref(db, "game/boxPosition"), { x, y });
}