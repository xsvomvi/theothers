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


/* =========================
   START EXPERIENCE
========================= */
fingerprint.addEventListener("click", () => {
    startScreen.style.display = "none";
    experience.style.display = "flex";
    playVideo(currentVideo);
});


/* =========================
   PLAY VIDEO
========================= */
function playVideo(index){

    continueBtn.style.display = "none";

    mainVideo.src = videos[index];
    mainVideo.load();

    mainVideo.oncanplay = () => {
        mainVideo.play();
    };

    mainVideo.onended = () => {
        continueBtn.style.display = "block";
    };

    observersSpawned = false;

    if (index === videos.length - 1) {
        setupObserverSpawns();
    }
}


/* =========================
   CONTINUE BUTTON
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
   OBSERVERS SYSTEM
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

    mainVideo.addEventListener("timeupdate", () => {

        const t = mainVideo.currentTime;

        if (t > 1.5 && t < 2 && !observersSpawned) {
            spawnObservers();
            observersSpawned = true;
        }

        if (t > 3 && t < 3.5) spawnObservers();
        if (t > 5 && t < 5.5) spawnObservers();

        if (Math.random() < 0.005) spawnObservers();
    });
}


/* =========================
   START WEBCAM GAME
========================= */
async function startWebcamGame() {

    experience.style.display = "none";
    gameScreen.style.display = "block";

    const stream = await navigator.mediaDevices.getUserMedia({
        video: true
    });

    webcamVideo.srcObject = stream;

    gameActive = true;
    round = 0;

    moveBox();
    startRounds();
}


/* =========================
   ROUNDS SYSTEM (6 x 7s)
========================= */
function startRounds() {

    function nextRound() {

        if (round >= TOTAL_ROUNDS) {
            endGame();
            return;
        }

        let timeLeft = 7;
        timerEl.innerText = timeLeft;

        heartbeatSound.volume = 0.2;
        heartbeatSound.play();

        const countdown = setInterval(() => {

            timeLeft--;
            timerEl.innerText = timeLeft;

            // 🔥 STRESS MODE laatste 3 sec
            if (timeLeft <= 3) {
                timerEl.classList.add("stress");

                // heartbeat sneller / luider gevoel
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
   SNAPSHOT + FLASH + FREEZE
========================= */
function snapshotSequence() {

    // FLASH START
    flash.style.opacity = "1";

    // 🔊 CAMERA SHUTTER SOUND
    shutterSound.currentTime = 0;
    shutterSound.play();

    // freeze game
    gameActive = false;

    setTimeout(() => {

        canvas.width = webcamVideo.videoWidth;
        canvas.height = webcamVideo.videoHeight;

        ctx.drawImage(webcamVideo, 0, 0);

        // FLASH OUT
        flash.style.opacity = "0";

        // freeze delay (1 sec horror pause)
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
   END GAME
========================= */
function endGame() {

    gameActive = false;

    alert("Fragments collected... returning to The Others");

    gameScreen.style.display = "none";

    currentVideo = 0;
    playVideo(currentVideo);
}