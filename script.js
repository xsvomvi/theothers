const videos = [
    "videos/innervoice_01.mov",
    "videos/innervoice_02.mov",
    "videos/innervoice_03.mov",
    "videos/innervoice_04.mov",
    "videos/innervoice_05.mov"
];

let currentVideo = 0;
let observersSpawned = false;

let round = 0;
const TOTAL_ROUNDS = 6;

let gameActive = false;

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

const MIN_SIZE = 18;
const MAX_SIZE = 38;

let heartbeatStarted = false;

/* =========================
   START
========================= */
fingerprint.addEventListener("click", () => {
    startScreen.style.display = "none";
    experience.style.display = "flex";
    playVideo(currentVideo);
});

/* =========================
   VIDEO
========================= */
function playVideo(index){

    continueBtn.style.display = "none";

    mainVideo.src = videos[index];
    mainVideo.load();

    mainVideo.oncanplay = () => mainVideo.play();

    mainVideo.onended = () => continueBtn.style.display = "block";

    observersSpawned = false;
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
        startWebcamGame();
    }
});

/* =========================
   WEBCAM GAME
========================= */
async function startWebcamGame() {

    experience.style.display = "none";
    gameScreen.style.display = "block";

    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    webcamVideo.srcObject = stream;

    gameActive = true;
    round = 0;

    updateBoxSize();

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

        updateBoxSize(); // 🔥 FIX: per round groeien

        let timeLeft = 7;
        timerEl.innerText = timeLeft;
        timerEl.classList.remove("stress");

        // heartbeat start 1x
        if (!heartbeatStarted) {
            heartbeatSound.loop = true;
            heartbeatSound.volume = 0.2;
            heartbeatSound.play();
            heartbeatStarted = true;
        }

        const countdown = setInterval(() => {

            timeLeft--;
            timerEl.innerText = timeLeft;

            if (timeLeft <= 3) {
                timerEl.classList.add("stress");
                heartbeatSound.volume = 0.6;
            } else {
                timerEl.classList.remove("stress");
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
   SNAPSHOT FX
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
    const size = MIN_SIZE + (MAX_SIZE - MIN_SIZE) * progress;

    dodgeBox.style.width = size + "vw";
    dodgeBox.style.height = (size * 0.65) + "vw";
}

/* =========================
   END
========================= */
function endGame() {

    gameActive = false;

    heartbeatSound.pause();

    alert("Fragments collected... returning to The Others");

    gameScreen.style.display = "none";

    currentVideo = 0;
    playVideo(currentVideo);
}