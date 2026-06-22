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
window.snapshots = []; // window scope zodat je het makkelijk kunt debuggen in console

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

/* TUTORIAL + PRE-GAME */
const tutorialScreen = document.getElementById("tutorialScreen");
const readyBtn = document.getElementById("readyBtn");

const preGameOverlay = document.getElementById("preGameOverlay");
const preGameTimer = document.getElementById("preGameTimer");

/* SHUTDOWN */
const shutdownScreen = document.getElementById("shutdownScreen");
const readMessageBtn = document.getElementById("readMessageBtn");

const othersEyeLogo = document.getElementById("othersEyeLogo");

/* =========================
   START
========================= */
fingerprint.addEventListener("click", () => {
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

    const x = Math.random() * (window.innerWidth - 200);
    const y = Math.random() * (window.innerHeight - 200);

    dodgeBox.style.left = x + "px";
    dodgeBox.style.top = y + "px";
    dodgeBox.style.display = "flex";

    moveBox();
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

    // Sla de boxRect OP op het moment van de flash (niet 250ms later)
    const boxRect = dodgeBox.getBoundingClientRect();

    setTimeout(() => {

        // Volledige webcamframe tekenen
        canvas.width = webcamVideo.videoWidth || 640;
        canvas.height = webcamVideo.videoHeight || 480;
        ctx.drawImage(webcamVideo, 0, 0, canvas.width, canvas.height);

        // Schaalverhouding scherm → videoresolutie
        const scaleX = canvas.width / window.innerWidth;
        const scaleY = canvas.height / window.innerHeight;

        const cropX = Math.max(0, boxRect.left * scaleX);
        const cropY = Math.max(0, boxRect.top * scaleY);
        const cropW = Math.min(boxRect.width * scaleX, canvas.width - cropX);
        const cropH = Math.min(boxRect.height * scaleY, canvas.height - cropY);

        // Crop canvas
        const cropCanvas = document.createElement("canvas");
        cropCanvas.width = cropW;
        cropCanvas.height = cropH;
        const cropCtx = cropCanvas.getContext("2d");

        cropCtx.drawImage(
            canvas,
            cropX, cropY, cropW, cropH,
            0, 0, cropW, cropH
        );

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
   BOX MOVEMENT
========================= */
function moveBox() {

    if (!gameActive) {
        setTimeout(moveBox, 200);
        return;
    }

    const x = Math.random() * (window.innerWidth - 200);
    const y = Math.random() * (window.innerHeight - 200);

    dodgeBox.style.left = x + "px";
    dodgeBox.style.top = y + "px";

    setTimeout(moveBox, 1200);
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
        continueBtn.style.display = "block";
    };

    // theothers_02.mov = index 1 → polaroids spawnen
    if (index === 1) {
        // Wacht tot duration bekend is via loadedmetadata
        mainVideo.addEventListener("loadedmetadata", function onMeta() {
            mainVideo.removeEventListener("loadedmetadata", onMeta);
            spawnPolaroidsDuringVideo();
        });
    }

    // theothers_04.mov = index 3
    if (index === 4) {
        clearPolaroids();
    }
}

/* =========================
   POLAROID SYSTEEM
========================= */
function getRandomPolaroidPosition() {
    const pw = 180;
    const ph = 170;
    const W = window.innerWidth;
    const H = window.innerHeight;

    // Middenvak vermijden (waar de video speelt)
    const midX1 = W * 0.10;
    const midX2 = W * 0.90;
    const midY1 = H * 0.15;
    const midY2 = H * 0.85;

    // Kies een van de 4 hoekzones
    const zones = [
        // links boven
        { x: [20, W * 0.22], y: [20, H * 0.40] },
        // rechts boven
        { x: [W * 0.78, W - pw - 20], y: [20, H * 0.40] },
        // links onder
        { x: [20, W * 0.22], y: [H * 0.60, H - ph - 20] },
        // rechts onder
        { x: [W * 0.78, W - pw - 20], y: [H * 0.60, H - ph - 20] },
        // boven midden
        { x: [W * 0.35, W * 0.65 - pw], y: [20, H * 0.14] },
        // onder midden
        { x: [W * 0.35, W * 0.65 - pw], y: [H * 0.86, H - ph - 20] },
    ];

    const zone = zones[Math.floor(Math.random() * zones.length)];

    const x = zone.x[0] + Math.random() * Math.max(0, zone.x[1] - zone.x[0]);
    const y = zone.y[0] + Math.random() * Math.max(0, zone.y[1] - zone.y[0]);

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

    // Verdeel over de video: 10%, 22%, 35%, 50%, 63%, 76%
    const spawnFractions = [0.10, 0.22, 0.35, 0.50, 0.63, 0.76];

    function onTimeUpdate() {

        if (polaroidIndex >= window.snapshots.length) {
            mainVideo.removeEventListener("timeupdate", onTimeUpdate);
            return;
        }

        const fraction = mainVideo.currentTime / duration;
        const targetFraction = spawnFractions[polaroidIndex];

        if (fraction >= targetFraction) {
            spawnPolaroid(window.snapshots[polaroidIndex], polaroidIndex);
            polaroidIndex++;
        }
    }

    mainVideo.addEventListener("timeupdate", onTimeUpdate);
}

function clearPolaroids() {
    polaroidOverlay.innerHTML = "";
}