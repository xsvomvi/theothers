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
const controllerBox = document.getElementById("controllerBox");
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
   BOX-GROOTTE VAN APPARAAT 1
   Fractie van het scherm (breedte/hoogte). Verandert per ronde.
========================= */
let boxFracW = 0.24;
let boxFracH = 0.20;

onValue(ref(db, "game/boxSize"), (snapshot) => {
    const data = snapshot.val();
    if (data) {
        boxFracW = data.w;
        boxFracH = data.h;
    }
});

/* =========================
   JITTER-PROFIEL PER RONDE
   6 verschillende profielen, gevarieerd in VERTE (maxOffset / pull) en
   SNELHEID (velKick / damp / smooth). Elke ronde een ander profiel.

   maxOffset = hoe ver de box max van het doel kan afdwalen (fractie scherm)
   velKick   = hoe hard elke frame duwt (meer = sneller/twitchy)
   damp      = demping van de snelheid (lager = schokkeriger)
   pull      = terugtrekking naar het doel (dichter bij 1 = dwaalt verder weg)
   smooth    = hoe snel de box de trilling volgt (lager = trager/zwaarder)
   intMin/intMax = bereik van de intensiteit-golf
   changeMin/changeVar = hoe vaak de intensiteit van karakter wisselt (ms)
========================= */
const JITTER_PROFILES = {
    // --- 3 mildere / rustigere ---
    calm:   { maxOffset: 0.05, velKick: 0.010, damp: 0.90, pull: 0.965, smooth: 0.15, intMin: 0.15, intMax: 0.55, changeMin: 1500, changeVar: 2500 },
    tipsy:  { maxOffset: 0.09, velKick: 0.014, damp: 0.90, pull: 0.960, smooth: 0.18, intMin: 0.30, intMax: 0.90, changeMin: 1200, changeVar: 2000 },
    wander: { maxOffset: 0.20, velKick: 0.012, damp: 0.92, pull: 0.986, smooth: 0.10, intMin: 0.40, intMax: 1.00, changeMin: 1800, changeVar: 2500 },

    // --- 3 extremere ---
    snappy: { maxOffset: 0.18, velKick: 0.055, damp: 0.85, pull: 0.945, smooth: 0.30, intMin: 0.60, intMax: 1.30, changeMin: 600,  changeVar: 1100 },
    extreme:{ maxOffset: 0.40, velKick: 0.040, damp: 0.90, pull: 0.958, smooth: 0.22, intMin: 0.80, intMax: 1.60, changeMin: 900,  changeVar: 1600 },
    // MEGA EXTREEM: schiet super ver, grote trage uithalen naar de randen
    mega:   { maxOffset: 0.62, velKick: 0.030, damp: 0.93, pull: 0.994, smooth: 0.13, intMin: 0.90, intMax: 1.90, changeMin: 1400, changeVar: 2200 }
};

let jitterProfile = "tipsy";

onValue(ref(db, "game/jitterLevel"), (snapshot) => {
    const val = snapshot.val();
    if (val && JITTER_PROFILES[val]) jitterProfile = val;
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

    const p = JITTER_PROFILES[jitterProfile] || JITTER_PROFILES.tipsy;

    // --- Intensiteit varieert over tijd: soms rustig, soms heftig ---
    if (now - lastIntensityChange > p.changeMin + Math.random() * p.changeVar) {
        lastIntensityChange = now;
        shakeIntensityTarget = p.intMin + Math.random() * (p.intMax - p.intMin);
    }
    shakeIntensity += (shakeIntensityTarget - shakeIntensity) * 0.02;

    // --- Trilling als gedempte random-walk (vloeiend, niet hoekig) ---
    shakeVelX += (Math.random() - 0.5) * p.velKick * shakeIntensity;
    shakeVelY += (Math.random() - 0.5) * p.velKick * shakeIntensity;
    shakeVelX *= p.damp;
    shakeVelY *= p.damp;
    shakeOffsetX += shakeVelX;
    shakeOffsetY += shakeVelY;
    // Trek de offset terug naar 0; dichter bij 1 = dwaalt verder weg
    shakeOffsetX *= p.pull;
    shakeOffsetY *= p.pull;
    shakeOffsetX = Math.max(-p.maxOffset, Math.min(p.maxOffset, shakeOffsetX));
    shakeOffsetY = Math.max(-p.maxOffset, Math.min(p.maxOffset, shakeOffsetY));

    // --- Doel + trilling, daarna smoothing en clamp ---
    const goalX = Math.max(0, Math.min(1, targetX + shakeOffsetX));
    const goalY = Math.max(0, Math.min(1, targetY + shakeOffsetY));

    currentX += (goalX - currentX) * p.smooth;
    currentY += (goalY - currentY) * p.smooth;

    // Toon hetzelfde shaky frame op de controller
    positionControllerBox(currentX, currentY);

    if (now - lastSend > 40) {
        lastSend = now;
        set(ref(db, "game/boxPosition"), {
            x: currentX,
            y: currentY
        });
    }

    requestAnimationFrame(smoothLoop);
}

/* =========================
   CONTROLLER-FRAME TEKENEN
   Zelfde mapping als op de experiencer: fractie 0-1 → top-left over het
   geldige bereik (rekening houdend met de box-grootte).
========================= */
function positionControllerBox(fx, fy) {
    const areaW = controllerArea.clientWidth;
    const areaH = controllerArea.clientHeight;

    const boxW = boxFracW * areaW;
    const boxH = boxFracH * areaH;

    const left = fx * (areaW - boxW);
    const top = fy * (areaH - boxH);

    controllerBox.style.width = boxW + "px";
    controllerBox.style.height = boxH + "px";
    controllerBox.style.left = left + "px";
    controllerBox.style.top = top + "px";
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

    targetX = fracX;
    targetY = fracY;
}