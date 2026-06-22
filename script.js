const videos = [
    "videos/innervoice_01.mov",
    "videos/innervoice_02.mov",
    "videos/innervoice_03.mov",
    "videos/innervoice_04.mov",
    "videos/innervoice_05.mov"
];

let currentVideo = 0;
let observersSpawned = false;

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

let gameActive = false;
let wins = 0;
let fragments = [];

/* START */
fingerprint.addEventListener("click", () => {
    startScreen.style.display = "none";
    experience.style.display = "flex";
    playVideo(currentVideo);
});

/* PLAY VIDEO */
function playVideo(index){

    continueBtn.style.display = "none";

    mainVideo.src = videos[index];
    mainVideo.load();
    mainVideo.play();

    observersSpawned = false;

    if (index === videos.length - 1) {
        setupObserverSpawns();
    }
}

/* END VIDEO */
mainVideo.addEventListener("ended", () => {
    continueBtn.style.display = "block";
});

/* CONTINUE */
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

/* OBSERVERS */
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
   WEBCAM GAME (FIXED)
========================= */

async function startWebcamGame() {

    experience.style.display = "none";
    gameScreen.style.display = "block";

    const stream = await navigator.mediaDevices.getUserMedia({
        video: true
    });

    webcamVideo.srcObject = stream;

    gameActive = true;
    wins = 0;

    moveBox();
    startSnapshots();
}

/* BOX MOVE */
function moveBox() {

    if (!gameActive) return;

    const x = Math.random() * (window.innerWidth - 200);
    const y = Math.random() * (window.innerHeight - 200);

    dodgeBox.style.left = x + "px";
    dodgeBox.style.top = y + "px";

    setTimeout(moveBox, 1200);
}

/* SNAPSHOTS */
function startSnapshots() {

    setInterval(() => {
        if (!gameActive) return;
        takeSnapshot();
    }, 7000);
}

/* SNAPSHOT */
function takeSnapshot() {

    canvas.width = webcamVideo.videoWidth;
    canvas.height = webcamVideo.videoHeight;

    ctx.drawImage(webcamVideo, 0, 0);

    const xRatio = canvas.width / window.innerWidth;
    const yRatio = canvas.height / window.innerHeight;

    const box = dodgeBox.getBoundingClientRect();

    const sx = box.left * xRatio;
    const sy = box.top * yRatio;
    const sw = box.width * xRatio;
    const sh = box.height * yRatio;

    const imageData = ctx.getImageData(sx, sy, sw, sh);

    let hit = 0;

    for (let i = 0; i < imageData.data.length; i += 4) {
        if (imageData.data[i] > 20) hit++;
    }

    const threshold = imageData.data.length * 0.05;

    if (hit > threshold) {
        fragments.push(Date.now());
    } else {
        wins++;
    }

    checkGameEnd();
}

/* WIN CHECK */
function checkGameEnd() {

    if (wins >= 5) {

        gameActive = false;

        alert("Fragments collected... returning to The Others");

        gameScreen.style.display = "none";

        currentVideo = 0;
        playVideo(currentVideo);
    }
}