const videos = [
    "videos/innervoice_01.mov",
    "videos/innervoice_02.mov",
    "videos/innervoice_03.mov",
    "videos/innervoice_04.mov",
    "videos/innervoice_05.mov"
];

let currentVideo = 0;

/* OBSERVERS */
let observerInit = false;
let observerCount = 0;

/* GAME */
let round = 0;
const TOTAL_ROUNDS = 6;

let gameActive = false;
let heartbeatStarted = false;

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

    if (index === videos.length - 1) {
        setupObserverSpawns();
    }
}

/* =========================
   CONTINUE
========================= */
continueBtn.addEventListener("click", () => {

    buttonSound.currentTime = 0;
    buttonSound.play();

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

    if (observerInit) return;
    observerInit = true;

    mainVideo.addEventListener("timeupdate", () => {

        const t = mainVideo.currentTime;

        if (observerCount >= 6) return;

        const spawnTimes = [1, 2, 3, 4, 5, 6];

        if (t >= spawnTimes[observerCount]) {
            spawnObservers();
            observerCount++;
        }
    });
}

/* =========================
   WEBCAM START
========================= */
async function startWebcamGame() {

    gameScreen.style.display = "block";

    const stream = await navigator.mediaDevices.getUserMedia({
        video: true
    });

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
   SNAPSHOT
========================= */
function snapshotSequence() {

    flash.style.opacity = "1";

    shutterSound.currentTime = 0;
    shutterSound.play();

    gameActive = false;

    setTimeout(() => {

        canvas.width = webcamVideo.videoWidth;
        canvas.height = webcamVideo.videoHeight;

        ctx.drawImage(webcamVideo, 0, 0);

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

    gameScreen.style.display = "none";

    showShutdownScreen();
}

/* =========================
   SHUTDOWN SCREEN
========================= */
function showShutdownScreen() {

    document.body.classList.add("glitch");

    setTimeout(() => {

        document.body.classList.remove("glitch");

        shutdownScreen.classList.remove("hidden");

    }, 2000);
}

/* =========================
   READ MESSAGE
========================= */
readMessageBtn.addEventListener("click", () => {

    console.log("MESSAGE OPENED");

    // volgende scene hier
});