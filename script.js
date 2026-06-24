import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getDatabase, ref, onValue, set } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-database.js";

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

function listenToBoxPosition() {
    onValue(ref(db, "game/boxPosition"), (snapshot) => {
        const data = snapshot.val();
        if (!data || !gameActive) return;

        const boxW = dodgeBox.offsetWidth;
        const boxH = dodgeBox.offsetHeight;
        const padding = 20;

        const x = Math.max(padding, Math.min(data.x, window.innerWidth - boxW - padding));
        const y = Math.max(padding, Math.min(data.y, window.innerHeight - boxH - padding));

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

function setGameStatus(status) {
    set(ref(db, "game/status"), status);
}

function resetFirebase() {
    // message NIET resetten — die komt van de controller
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

/* SNAPSHOTS */
window.snapshots = [];
window.__controllerMessage = "";

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
    listenToMessage(); // eerst luisteren
    resetFirebase();   // dan pas resetten (zonder message)
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

    dodgeBox.style.left = (window.innerWidth / 2 - 100) + "px";
    dodgeBox.style.top = (window.innerHeight / 2 - 80) + "px";
    dodgeBox.style.display = "flex";

    set(ref(db, "game/screen"), {
        w: window.innerWidth,
        h: window.innerHeight
    });

    listenToBoxPosition();
    setGameStatus("started");
    startRandomBlackouts();

    startRounds();
}

/* =========================
   RANDOM BLACKOUTS
========================= */
function startRandomBlackouts() {
    function scheduleNext() {
        const delay = 8000 + Math.random() * 12000; // elke 8-20 seconden
        setTimeout(() => {
            if (!gameActive) return;
            gameScreen.style.filter = "brightness(0)";
            setTimeout(() => {
                gameScreen.style.filter = "";
                scheduleNext();
            }, 600);
        }, delay);
    }
    scheduleNext();
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

        console.log(`Snapshot ${window.snapshots.length} opgeslagen`, cropW, cropH);

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
}

/* =========================
   END GAME → SHUTDOWN
========================= */
function endGame() {

    gameActive = false;
    heartbeatSound.pause();
    dodgeBox.style.display = "none";
    gameScreen.style.filter = ""; // reset blackout filter

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

    const label = document.createElement("div");
    label.classList.add("polaroid-label");
    label.innerText = `subject_0${labelIndex + 1}`;

    el.appendChild(img);
    el.appendChild(label);

    const rot = (Math.random() * 20 - 10).toFixed(1);
    el.style.setProperty("--rot", rot + "deg");

    const { x, y } = getRandomPolaroidPosition();
    el.style.left = x + "px";
    el.style.top = y + "px";

    polaroidOverlay.appendChild(el);

    console.log(`Polaroid ${labelIndex + 1} gespawnd op`, x, y);
}

function spawnPolaroidsDuringVideo() {

    console.log("spawnPolaroidsDuringVideo gestart, snapshots:", window.snapshots.length);

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

        const label = document.createElement("div");
        label.classList.add("polaroid-label");
        label.innerText = `subject_0${i + 1}`;

        el.appendChild(img);
        el.appendChild(label);

        const rot = (Math.random() * 10 - 5).toFixed(1);
        el.style.setProperty("--rot", rot + "deg");
        el.style.animationDelay = (i * 0.15) + "s";

        endPolaroids.appendChild(el);
    });

    const message = window.__controllerMessage || "you are seen by the others.";

    setTimeout(() => {
        endScreen.style.backgroundColor = "white";
    }, 100);

    setTimeout(() => {
        endText.innerText = message;
        endText.style.color = "black";
        endText.style.opacity = "1";
    }, 2500);
}