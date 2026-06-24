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

    // Ontvang videostream van apparaat 1
    peerConnection.ontrack = (event) => {
        const remoteVideo = document.getElementById("remoteVideo");
        if (remoteVideo && event.streams[0]) {
            remoteVideo.srcObject = event.streams[0];
        }
    };

    // Stuur ICE candidates naar Firebase
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            push(ref(db, "webrtc/answerCandidates"), event.candidate.toJSON());
        }
    };

    // Luister op offer van apparaat 1
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

    // Luister op ICE candidates van apparaat 1
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
   STAP 1 → 2
========================= */
introBtn.addEventListener("click", () => {
    introScreen.classList.add("hidden");
    messageScreen.classList.remove("hidden");
    messageInput.focus();

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

    // Start WebRTC alvast zodat verbinding klaar is als game begint
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
========================= */
let targetX = 960;
let targetY = 540;
let currentX = 960;
let currentY = 540;
let lastSend = 0;

function smoothLoop() {
    const speed = 0.08;
    currentX += (targetX - currentX) * speed;
    currentY += (targetY - currentY) * speed;

    const now = Date.now();
    if (now - lastSend > 50) {
        lastSend = now;
        set(ref(db, "game/boxPosition"), {
            x: Math.round(currentX),
            y: Math.round(currentY)
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
========================= */
function handleMove(clientX, clientY) {
    const rect = controllerArea.getBoundingClientRect();

    const fracX = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const fracY = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));

    controllerDot.style.left = (fracX * 100) + "%";
    controllerDot.style.top = (fracY * 100) + "%";

    const padding = 20;
    targetX = padding + fracX * (screenW - 400 - padding * 2);
    targetY = padding + fracY * (screenH - 300 - padding * 2);
}