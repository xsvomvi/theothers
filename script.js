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

/* START EXPERIENCE */
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

    observersSpawned = false; // reset per video

    // alleen triggeren op laatste video
    if (index === videos.length - 1) {
        setupObserverSpawns();
    }
}

/* NEXT VIDEO */
mainVideo.addEventListener("ended", () => {
    continueBtn.style.display = "block";
});

/* CONTINUE BUTTON */
continueBtn.addEventListener("click", () => {

    // play sound every click
    buttonSound.currentTime = 0;
    buttonSound.play();

    currentVideo++;

    if (currentVideo < videos.length) {
        playVideo(currentVideo);
    } else {
        alert("End of experience");
    }
});

/* OBSERVER SPAWNER */
function spawnObservers() {
    const img = document.createElement("img");
    img.src = "images/observers.png";
    img.classList.add("observer");

    img.style.left = Math.random() * 100 + "%";
    img.style.top = Math.random() * 100 + "%";

    overlay.appendChild(img);
}

/* TIMED SPAWNING DURING VIDEO */
function setupObserverSpawns() {

    mainVideo.addEventListener("timeupdate", () => {

        if (currentVideo !== videos.length - 1) return;

        const t = mainVideo.currentTime;

        // fixed spooky moments
        if (t > 1.5 && t < 2 && !observersSpawned) {
            spawnObservers();
            observersSpawned = true;
        }

        if (t > 3 && t < 3.5) {
            spawnObservers();
        }

        if (t > 5 && t < 5.5) {
            spawnObservers();
        }

        // random extra horror effect
        if (Math.random() < 0.005) {
            spawnObservers();
        }
    });
}