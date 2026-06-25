import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getDatabase, ref, onValue, set, push } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-database.js";

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
let localStream = null;

const rtcConfig = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" }
    ]
};

async function startWebRTC(stream) {
    await set(ref(db, "webrtc"), null);

    peerConnection = new RTCPeerConnection(rtcConfig);

    stream.getTracks().forEach(track => {
        peerConnection.addTrack(track, stream);
    });

    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            push(ref(db, "webrtc/offerCandidates"), event.candidate.toJSON());
        }
    };

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    await set(ref(db, "webrtc/offer"), {
        type: offer.type,
        sdp: offer.sdp
    });

    onValue(ref(db, "webrtc/answer"), async (snapshot) => {
        const answer = snapshot.val();
        if (answer && peerConnection.signalingState !== "stable") {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
        }
    });

    onValue(ref(db, "webrtc/answerCandidates"), (snapshot) => {
        snapshot.forEach((child) => {
            const candidate = child.val();
            if (candidate) {
                peerConnection.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
            }
        });
    });
}

/* =========================
   FIREBASE HELPERS
========================= */
function listenToBoxPosition() {
    onValue(ref(db, "game/boxPosition"), (snapshot) => {
        const data = snapshot.val();
        if (!data || !gameActive) return;

        const boxW = dodgeBox.offsetWidth;
        const boxH = dodgeBox.offsetHeight;
        const padding = 20;

        const minX = padding;
        const maxX = window.innerWidth - boxW - padding;
        const minY = padding;
        const maxY = window.innerHeight - boxH - padding;

        const x = minX + data.x * (maxX - minX);
        const y = minY + data.y * (maxY - minY);

        dodgeBox.style.left = x + "px";
        dodgeBox.style.top = y + "px";
    });
}

function listenToMessage() {
    onValue(ref(db, "game/message"), (snapshot) => {
        const msg = snapshot.val();
        if (msg) window.__controllerMessage = msg;
    });
}

function listenToName() {
    onValue(ref(db, "game/photographerName"), (snapshot) => {
        const name = snapshot.val();
        if (name) window.__photographerName = name;
    });
}

function setGameStatus(status) {
    set(ref(db, "game/status"), status);
}

function resetFirebase() {
    set(ref(db, "game/status"), "waiting");
    set(ref(db, "game/boxPosition"), {
        x: window.innerWidth / 2,
        y: window.innerHeight / 2
    });
    set(ref(db, "game/screen"), {
        w: window.innerWidth,
        h: window.innerHeight
    });
}

/* =========================
   VIDEOS
========================= */
const videos = [
    "videos/innervoice_01.mov",
    "videos/innervoice_02.mov",
    "videos/innervoice_03.mov",
    "videos/innervoice_04.mov",
    "videos/innervoice_05.mov"
];

const othersVideos = [
    "videos/theothers_01.mov",
    "videos/theothers_02.mov",
    "videos/theothers_03.mov",
    "videos/theothers_04.mov"
];

let othersIndex = 0;
let othersActive = false;
let currentVideo = 0;

/* OBSERVERS */
let observerInit = false;
let observerCount = 0;
let observerEnabled = false;

/* GAME */
let round = 0;
const TOTAL_ROUNDS = 6;
let gameActive = false;
let heartbeatStarted = false;

/* =========================
   JITTER PER RONDE
   6 verschillende profielen (3 milder, 3 extremer waarvan 1 MEGA EXTREEM),
   elke ronde een ander. Volgorde verschilt per sessie.
========================= */
const jitterProfileOrder = (() => {
    const profiles = ["calm", "tipsy", "wander", "snappy", "extreme", "mega"];
    for (let i = profiles.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [profiles[i], profiles[j]] = [profiles[j], profiles[i]];
    }
    return profiles;
})();

function updateJitterLevel(r) {
    const profile = jitterProfileOrder[r] ?? "tipsy";
    set(ref(db, "game/jitterLevel"), profile);
    console.log(`Ronde ${r + 1} jitter: ${profile}`);
}

/* SNAPSHOTS */
window.snapshots = [];
window.__controllerMessage = "";
window.__photographerName = "";

/* =========================
   DOM
========================= */
const startScreen = document.getElementById("startScreen");
const experience = document.getElementById("experience");
const fingerprint = document.getElementById("fingerprint");

const mainVideo = document.getElementById("mainVideo");
const continueBtn = document.getElementById("continueBtn");
const buttonSound = new Audio("sounds/button.mp3");

const overlay = document.getElementById("observerOverlay");
const polaroidOverlay = document.getElementById("polaroidOverlay");

const gameScreen = document.getElementById("gameScreen");
const webcamVideo = document.getElementById("webcamVideo");
const dodgeBox = document.getElementById("dodgeBox");

const canvas = document.getElementById("snapshotCanvas");
const ctx = canvas.getContext("2d");

const timerEl = document.getElementById("timer");
const flash = document.getElementById("flash");

const heartbeatSound = document.getElementById("heartbeatSound");
const shutterSound = document.getElementById("shutterSound");

const tutorialScreen = document.getElementById("tutorialScreen");
const readyBtn = document.getElementById("readyBtn");

const preGameOverlay = document.getElementById("preGameOverlay");
const preGameTimer = document.getElementById("preGameTimer");

const shutdownScreen = document.getElementById("shutdownScreen");
const readMessageBtn = document.getElementById("readMessageBtn");

const othersEyeLogo = document.getElementById("othersEyeLogo");

const endScreen = document.getElementById("endScreen");
const endPolaroids = document.getElementById("endPolaroids");
const endText = document.getElementById("endText");

/* =========================
   START
========================= */
fingerprint.addEventListener("click", () => {
    if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
    }
    listenToMessage();
    listenToName();
    resetFirebase();
    startScreen.style.display = "none";
    experience.style.display = "flex";
    playVideo(currentVideo);
});

/* =========================
   VIDEO SYSTEM
========================= */
function playVideo(index) {

    continueBtn.style.display = "none";

    mainVideo.src = videos[index];
    mainVideo.load();

    mainVideo.oncanplay = () => mainVideo.play();

    mainVideo.onended = () => {
        continueBtn.style.display = "block";
    };

    observerInit = false;
    observerCount = 0;

    observerEnabled = (index === videos.length - 1);

    if (observerEnabled) {
        setupObserverSpawns();
    }
}

/* =========================
   CONTINUE
========================= */
continueBtn.addEventListener("click", () => {

    buttonSound.currentTime = 0;
    buttonSound.play();

    if (othersActive) {
        othersIndex++;
        if (othersIndex < othersVideos.length) {
            playOthersVideo(othersIndex);
        }
        return;
    }

    currentVideo++;

    if (currentVideo < videos.length) {
        playVideo(currentVideo);
    } else {
        showTutorial();
    }
});

/* =========================
   TUTORIAL
========================= */
function showTutorial() {
    experience.style.display = "none";
    tutorialScreen.style.display = "flex";
}

readyBtn.addEventListener("click", () => {
    tutorialScreen.style.display = "none";
    startWebcamGame();
});

/* =========================
   OBSERVERS
========================= */
function spawnObservers() {
    const img = document.createElement("img");
    img.src = "images/observers.png";
    img.classList.add("observer");
    img.style.left = Math.random() * 100 + "%";
    img.style.top = Math.random() * 100 + "%";
    overlay.appendChild(img);
}

function setupObserverSpawns() {

    if (observerInit || !observerEnabled) return;
    observerInit = true;

    mainVideo.addEventListener("timeupdate", () => {

        if (!observerEnabled) return;

        const t = mainVideo.currentTime;

        if (observerCount >= 6) return;

        const spawnTimes = [1, 2, 3, 4, 5, 6];

        if (t >= spawnTimes[observerCount]) {
            spawnObservers();
            observerCount++;
        }
    });
}

function clearObservers() {
    overlay.innerHTML = "";
}

/* =========================
   WEBCAM START
========================= */
async function startWebcamGame() {

    gameScreen.style.display = "block";

    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    webcamVideo.srcObject = stream;
    localStream = stream;

    await startWebRTC(stream);

    gameActive = false;

    startPreGameCountdown();
}

/* =========================
   PRE-GAME
========================= */
function startPreGameCountdown() {

    dodgeBox.style.display = "none";
    preGameOverlay.style.display = "flex";

    setGameStatus("pregame");

    let timeLeft = 7;
    preGameTimer.innerText = timeLeft;

    const countdown = setInterval(() => {

        timeLeft--;
        preGameTimer.innerText = timeLeft;

        if (timeLeft <= 0) {
            clearInterval(countdown);
            preGameOverlay.style.display = "none";
            startActualGame();
        }

    }, 1000);
}

/* =========================
   GAME START
========================= */
function startActualGame() {

    gameActive = true;
    round = 0;

    updateBoxSize();
    updateJitterLevel(round);

    dodgeBox.style.left = (window.innerWidth / 2 - 100) + "px";
    dodgeBox.style.top = (window.innerHeight / 2 - 80) + "px";
    dodgeBox.style.display = "flex";

    set(ref(db, "game/screen"), {
        w: window.innerWidth,
        h: window.innerHeight
    });

    listenToBoxPosition();
    setGameStatus("started");

    startRounds();
}

/* =========================
   ROUNDS
========================= */
function startRounds() {

    function nextRound() {

        if (round >= TOTAL_ROUNDS) {
            endGame();
            return;
        }

        updateBoxSize();
        updateJitterLevel(round);

        let timeLeft = 7;
        timerEl.innerText = timeLeft;

        if (!heartbeatStarted) {
            heartbeatSound.loop = true;
            heartbeatSound.volume = 0.2;
            heartbeatSound.play().catch(() => {
                document.addEventListener("click", () => {
                    heartbeatSound.play().catch(() => {});
                }, { once: true });
            });
            heartbeatStarted = true;
        }

        const countdown = setInterval(() => {

            timeLeft--;
            timerEl.innerText = timeLeft;

            if (timeLeft <= 3) {
                heartbeatSound.volume = 0.6;
            } else {
                heartbeatSound.volume = 0.2;
            }

            if (timeLeft <= 0) {
                clearInterval(countdown);
                snapshotSequence();
                round++;
                nextRound();
            }

        }, 1000);
    }

    nextRound();
}

/* =========================
   SNAPSHOT — ALLEEN DODGEBOX
========================= */
function snapshotSequence() {

    flash.style.opacity = "1";
    shutterSound.currentTime = 0;
    shutterSound.play();

    gameActive = false;

    const boxRect = dodgeBox.getBoundingClientRect();

    setTimeout(() => {

        canvas.width = webcamVideo.videoWidth || 640;
        canvas.height = webcamVideo.videoHeight || 480;
        ctx.drawImage(webcamVideo, 0, 0, canvas.width, canvas.height);

        const scaleX = canvas.width / window.innerWidth;
        const scaleY = canvas.height / window.innerHeight;

        const cropX = Math.max(0, boxRect.left * scaleX);
        const cropY = Math.max(0, boxRect.top * scaleY);
        const cropW = Math.min(boxRect.width * scaleX, canvas.width - cropX);
        const cropH = Math.min(boxRect.height * scaleY, canvas.height - cropY);

        const cropCanvas = document.createElement("canvas");
        cropCanvas.width = cropW;
        cropCanvas.height = cropH;
        const cropCtx = cropCanvas.getContext("2d");

        cropCtx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

        const dataURL = cropCanvas.toDataURL("image/jpeg", 0.85);
        window.snapshots.push(dataURL);

        flash.style.opacity = "0";

        setTimeout(() => {
            gameActive = true;
        }, 1000);

    }, 250);
}

/* =========================
   BOX SIZE
========================= */
function updateBoxSize() {
    const progress = round / (TOTAL_ROUNDS - 1);
    const size = 24 + (44 - 24) * progress;
    dodgeBox.style.width = size + "vw";
    dodgeBox.style.height = (size * 0.65) + "vw";

    // Publiceer de echte box-grootte als fractie van het scherm,
    // zodat de controller exact hetzelfde frame kan tekenen.
    set(ref(db, "game/boxSize"), {
        w: dodgeBox.offsetWidth / window.innerWidth,
        h: dodgeBox.offsetHeight / window.innerHeight
    });
}

/* =========================
   END GAME → SHUTDOWN
========================= */
function endGame() {

    gameActive = false;
    heartbeatSound.pause();
    dodgeBox.style.display = "none";

    setGameStatus("ended");
    startShutdownTransition();
}

function startShutdownTransition() {

    document.body.classList.add("glitch");

    flash.style.opacity = "1";

    setTimeout(() => {
        flash.style.opacity = "0";
    }, 200);

    setTimeout(() => {
        gameScreen.style.display = "none";
        shutdownScreen.style.display = "none";
    }, 2600);

    setTimeout(() => {
        document.body.classList.remove("glitch");
        clearObservers();
        showShutdownScreen();
    }, 3300);
}

function showShutdownScreen() {

    document.body.classList.add("glitch");

    setTimeout(() => {
        document.body.classList.remove("glitch");

        shutdownScreen.style.opacity = "0";
        shutdownScreen.style.transition = "opacity 1.5s ease";
        shutdownScreen.style.display = "flex";
        shutdownScreen.classList.remove("hidden");

        setTimeout(() => {
            shutdownScreen.style.opacity = "1";
        }, 50);

    }, 2000);
}

/* =========================
   READ MESSAGE
========================= */
readMessageBtn.addEventListener("click", () => {
    shutdownScreen.style.display = "none";
    startOthersExperience();
});

function startOthersExperience() {

    othersActive = true;
    othersIndex = 0;

    experience.style.display = "flex";
    othersEyeLogo.classList.remove("hidden");

    playOthersVideo(othersIndex);
}

function playOthersVideo(index) {

    continueBtn.style.display = "none";

    mainVideo.src = othersVideos[index];
    mainVideo.load();

    mainVideo.oncanplay = () => mainVideo.play();

    mainVideo.onended = () => {
        if (index === othersVideos.length - 1) {
            continueBtn.innerText = "rooting for me?";
            continueBtn.style.display = "block";

            continueBtn.onclick = () => {
                continueBtn.style.display = "none";
                continueBtn.innerText = "continue";
                continueBtn.onclick = null;
                playConnectionVideo();
            };
        } else {
            continueBtn.style.display = "block";
        }
    };

    if (index === 1) {
        mainVideo.addEventListener("loadedmetadata", function onMeta() {
            mainVideo.removeEventListener("loadedmetadata", onMeta);
            spawnPolaroidsDuringVideo();
        });
    }
}

function playConnectionVideo() {

    mainVideo.src = "videos/connection.mov";
    mainVideo.load();

    mainVideo.oncanplay = () => mainVideo.play();

    mainVideo.onended = () => {
        mainVideo.style.transition = "opacity 1.5s ease";
        mainVideo.style.opacity = "0";

        setTimeout(() => {
            mainVideo.style.opacity = "1";
            mainVideo.style.transition = "";
            experience.style.display = "none";
            othersEyeLogo.classList.add("hidden");
            showEndScreen();
        }, 1500);
    };
}

/* =========================
   POLAROID SYSTEEM
   Geen labels op de polaroids zelf
========================= */
function getRandomPolaroidPosition() {
    const pw = 200;
    const ph = 190;
    const padding = 24;
    const W = window.innerWidth;
    const H = window.innerHeight;

    const midX1 = W * 0.28;
    const midX2 = W * 0.72;
    const midY1 = H * 0.22;
    const midY2 = H * 0.78;

    let x, y, attempts = 0;

    do {
        x = padding + Math.random() * (W - pw - padding * 2);
        y = padding + Math.random() * (H - ph - padding * 2);
        attempts++;
    } while (
        x + pw > midX1 && x < midX2 &&
        y + ph > midY1 && y < midY2 &&
        attempts < 30
    );

    return { x, y };
}

function spawnPolaroid(dataURL, labelIndex) {

    const el = document.createElement("div");
    el.classList.add("polaroid");

    const img = document.createElement("img");
    img.src = dataURL;

    el.appendChild(img);

    const rot = (Math.random() * 20 - 10).toFixed(1);
    el.style.setProperty("--rot", rot + "deg");

    const { x, y } = getRandomPolaroidPosition();
    el.style.left = x + "px";
    el.style.top = y + "px";

    polaroidOverlay.appendChild(el);
}

function spawnPolaroidsDuringVideo() {

    if (window.snapshots.length === 0) {
        console.warn("Geen snapshots beschikbaar!");
        return;
    }

    let polaroidIndex = 0;
    const duration = mainVideo.duration;
    const spawnFractions = [0.10, 0.22, 0.35, 0.50, 0.63, 0.76];

    function onTimeUpdate() {

        if (polaroidIndex >= window.snapshots.length) {
            mainVideo.removeEventListener("timeupdate", onTimeUpdate);
            return;
        }

        const fraction = mainVideo.currentTime / duration;

        if (fraction >= spawnFractions[polaroidIndex]) {
            spawnPolaroid(window.snapshots[polaroidIndex], polaroidIndex);
            polaroidIndex++;
        }
    }

    mainVideo.addEventListener("timeupdate", onTimeUpdate);
}

/* =========================
   END SCREEN
   Caption + naam alleen onderaan de pagina, niet op de polaroids
========================= */
function showEndScreen() {

    endScreen.style.display = "flex";
    endScreen.style.backgroundColor = "black";

    endPolaroids.innerHTML = "";

    window.snapshots.forEach((dataURL, i) => {
        const el = document.createElement("div");
        el.classList.add("polaroid");

        const img = document.createElement("img");
        img.src = dataURL;

        el.appendChild(img);

        const rot = (Math.random() * 10 - 5).toFixed(1);
        el.style.setProperty("--rot", rot + "deg");
        el.style.animationDelay = (i * 0.15) + "s";

        endPolaroids.appendChild(el);
    });

    const caption = window.__controllerMessage || "you are seen by the others.";
    const name = window.__photographerName || "the others";

    setTimeout(() => {
        endScreen.style.backgroundColor = "white";
    }, 100);

    setTimeout(() => {
        // Caption
        endText.innerText = caption;
        endText.style.color = "black";
        endText.style.opacity = "1";

        // Naam eronder
        const creditEl = document.getElementById("endCredit");
        creditEl.innerText = `from one of the others, ${name}.`;
        creditEl.style.color = "black";
        creditEl.style.opacity = "1";
    }, 2500);
}