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
   SENSITIVITY SYNC
   De sensitivity bepaalt hoe groot het bereik is op het scherm van apparaat 1.
   De muis op de controller beweegt altijd even snel — alleen het effect op
   apparaat 1 verandert.
========================= */
let currentSensitivity = 1.0;

onValue(ref(db, "game/sensitivity"), (snapshot) => {
    const val = snapshot.val();
    if (val !== null) currentSensitivity = val;
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
   SMOOTH BEWEGING
   De dot beweegt direct — de box op apparaat 1 volgt met delay.
   Sensitivity past het bereik aan op apparaat 1, niet de muissnelheid hier.
========================= */
let targetX = 0.5;
let targetY = 0.5;
let currentX = 0.5;
let currentY = 0.5;
let lastSend = 0;

function smoothLoop() {
    const smoothSpeed = 0.08;
    currentX += (targetX - currentX) * smoothSpeed;
    currentY += (targetY - currentY) * smoothSpeed;

    const now = Date.now();
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
   Sensitivity schaalt het bereik op apparaat 1:
   hoog = kleine muisbeweging → grote beweging op apparaat 1 (moeilijk voor experiencer)
   laag = grote muisbeweging → kleine beweging op apparaat 1 (makkelijk voor experiencer)
========================= */
function handleMove(clientX, clientY) {
    const rect = controllerArea.getBoundingClientRect();

    // Fractie 0-1 binnen het controller vlak
    const fracX = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const fracY = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));

    // Dot beweegt direct en identiek
    controllerDot.style.left = (fracX * 100) + "%";
    controllerDot.style.top = (fracY * 100) + "%";

    targetX = Math.max(0, Math.min(1, 0.5 + (fracX - 0.5) * currentSensitivity));
    targetY = Math.max(0, Math.min(1, 0.5 + (fracY - 0.5) * currentSensitivity));
}