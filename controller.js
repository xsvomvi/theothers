import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getDatabase, ref, set, push, onValue } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-database.js";

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
   WEBRTC
========================= */
let peerConnection = null;

const rtcConfig = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" }
    ]
};

async function startWebRTC() {
    peerConnection = new RTCPeerConnection(rtcConfig);

    peerConnection.ontrack = (event) => {
        const remoteVideo = document.getElementById("remoteVideo");
        if (remoteVideo && event.streams[0]) {
            remoteVideo.srcObject = event.streams[0];
        }
    };

    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            push(ref(db, "webrtc/answerCandidates"), event.candidate.toJSON());
        }
    };

    onValue(ref(db, "webrtc/offer"), async (snapshot) => {
        const offer = snapshot.val();
        if (!offer || peerConnection.signalingState !== "stable") return;

        await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);

        await set(ref(db, "webrtc/answer"), {
            type: answer.type,
            sdp: answer.sdp
        });
    });

    onValue(ref(db, "webrtc/offerCandidates"), (snapshot) => {
        snapshot.forEach((child) => {
            const candidate = child.val();
            if (candidate) {
                peerConnection.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
            }
        });
    });
}

/* =========================
   DOM
========================= */
const messageScreen = document.getElementById("messageScreen");
const nameScreen = document.getElementById("nameScreen");
const introScreen = document.getElementById("introScreen");
const waitScreen = document.getElementById("waitScreen");
const controllerScreen = document.getElementById("controllerScreen");
const doneScreen = document.getElementById("doneScreen");

const messageInput = document.getElementById("messageInput");
const messageBtn = document.getElementById("messageBtn");
const nameInput = document.getElementById("nameInput");
const nameBtn = document.getElementById("nameBtn");
const introBtn = document.getElementById("introBtn");
const controllerArea = document.getElementById("controllerArea");
const controllerDot = document.getElementById("controllerDot");
const controllerInstruction = document.getElementById("controllerInstruction");

/* =========================
   SCHERMGROOTTE VAN APPARAAT 1
========================= */
let screenW = 1920;
let screenH = 1080;

onValue(ref(db, "game/screen"), (snapshot) => {
    const data = snapshot.val();
    if (data) {
        screenW = data.w;
        screenH = data.h;
    }
});

/* =========================
   SUGGESTIES
========================= */
document.querySelectorAll(".suggestion").forEach(btn => {
    btn.addEventListener("click", () => {
        messageInput.value = btn.innerText;
        document.querySelectorAll(".suggestion").forEach(b => b.classList.remove("selected"));
        btn.classList.add("selected");
        messageInput.focus();
    });
});

/* =========================
   STAP 1 → 2 (caption → naam)
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
    nameScreen.classList.remove("hidden");
    nameInput.focus();
});

/* =========================
   STAP 2 → 3 (naam → intro)
========================= */
nameBtn.addEventListener("click", () => {
    const name = nameInput.value.trim();
    if (!name) {
        nameInput.style.borderBottom = "1px solid rgba(255,255,255,0.6)";
        nameInput.placeholder = "please write your name first.";
        return;
    }

    set(ref(db, "game/photographerName"), name);

    nameScreen.classList.add("hidden");
    introScreen.classList.remove("hidden");
});

/* =========================
   STAP 3 → 4 (intro → wachten)
========================= */
introBtn.addEventListener("click", () => {
    introScreen.classList.add("hidden");
    waitScreen.classList.remove("hidden");

    startWebRTC();

    onValue(ref(db, "game/status"), (snapshot) => {
        const status = snapshot.val();
        console.log("game status:", status);

        if (status === "pregame") {
            waitScreen.classList.add("hidden");
            controllerScreen.classList.remove("hidden");
            controllerInstruction.innerText = "get ready. the experience is about to begin.";
            controllerArea.style.opacity = "0.2";
            controllerArea.style.pointerEvents = "none";
        }

        if (status === "started") {
            controllerInstruction.innerText = "move the frame. find the perfect shot.";
            controllerArea.style.opacity = "1";
            controllerArea.style.pointerEvents = "auto";
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
   SMOOTH BEWEGING + DRONKEN TRILLING
   De experiencer stuurt 1-op-1 (geen sensitivity), maar het vierkantje
   krijgt een onstabiele "dronken" trilling die in intensiteit varieert:
   soms rustig, soms heftig. De experiencer moet continu bijsturen om het
   shot gecentreerd te houden.
========================= */
let targetX = 0.5;   // gewenste positie (volgt de muis, fractie 0-1)
let targetY = 0.5;
let currentX = 0.5;  // verzonden positie (= doel + trilling)
let currentY = 0.5;
let lastSend = 0;

// Trilling-state: een zachte random-walk offset bovenop het doel
let shakeOffsetX = 0;
let shakeOffsetY = 0;
let shakeVelX = 0;
let shakeVelY = 0;

// Intensiteit-envelope: wandelt langzaam tussen rustig en heftig
let shakeIntensity = 0.4;
let shakeIntensityTarget = 0.4;
let lastIntensityChange = 0;

function smoothLoop() {
    const now = Date.now();

    // --- Intensiteit varieert over tijd: soms rustig, soms heftig ---
    if (now - lastIntensityChange > 1200 + Math.random() * 2000) {
        lastIntensityChange = now;
        // Nieuw doel: meestal mild, af en toe een flinke uitschieter
        shakeIntensityTarget = Math.random() < 0.3
            ? 0.7 + Math.random() * 0.6   // heftige bui
            : 0.15 + Math.random() * 0.45; // rustiger
    }
    shakeIntensity += (shakeIntensityTarget - shakeIntensity) * 0.02;

    // --- Trilling als gedempte random-walk (vloeiend, niet hoekig) ---
    const maxOffset = 0.06; // hoe ver de box max kan afdwalen (fractie)
    shakeVelX += (Math.random() - 0.5) * 0.012 * shakeIntensity;
    shakeVelY += (Math.random() - 0.5) * 0.012 * shakeIntensity;
    shakeVelX *= 0.9;  // demping
    shakeVelY *= 0.9;
    shakeOffsetX += shakeVelX;
    shakeOffsetY += shakeVelY;
    // Trek de offset zacht terug naar 0, zodat hij blijft "rond het doel"
    shakeOffsetX *= 0.96;
    shakeOffsetY *= 0.96;
    shakeOffsetX = Math.max(-maxOffset, Math.min(maxOffset, shakeOffsetX));
    shakeOffsetY = Math.max(-maxOffset, Math.min(maxOffset, shakeOffsetY));

    // --- Doel + trilling, daarna smoothing en clamp ---
    const goalX = Math.max(0, Math.min(1, targetX + shakeOffsetX));
    const goalY = Math.max(0, Math.min(1, targetY + shakeOffsetY));

    const smoothSpeed = 0.18;
    currentX += (goalX - currentX) * smoothSpeed;
    currentY += (goalY - currentY) * smoothSpeed;

    if (now - lastSend > 50) {
        lastSend = now;
        set(ref(db, "game/boxPosition"), {
            x: currentX,
            y: currentY
        });
    }

    requestAnimationFrame(smoothLoop);
}

smoothLoop();

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
   POSITIE BEREKENEN
   Directe 1-op-1 mapping: muis links = box links, muis rechts = box rechts.
   De moeilijkheid komt niet van sensitivity maar van de trilling in smoothLoop.
========================= */
function handleMove(clientX, clientY) {
    const rect = controllerArea.getBoundingClientRect();

    // Fractie 0-1 binnen het controller vlak
    const fracX = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const fracY = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));

    // Dot beweegt direct en identiek
    controllerDot.style.left = (fracX * 100) + "%";
    controllerDot.style.top = (fracY * 100) + "%";

    targetX = fracX;
    targetY = fracY;
}