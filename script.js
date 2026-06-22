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
const overlay = document.getElementById("observerOverlay");

const gameScreen = document.getElementById("gameScreen");
const webcamVideo = document.getElementById("webcamVideo");
const dodgeBox = document.getElementById("dodgeBox");
const canvas = document.getElementById("snapshotCanvas");
const ctx = canvas.getContext("2d");

const timerEl = document.getElementById("timer");
const flash = document.getElementById("flash");

let round = 0;
let gameActive = false;

/* START */
fingerprint.addEventListener("click", () => {
    startScreen.style.display = "none";
    experience.style.display = "flex";
    playVideo(currentVideo);
});

/* VIDEO */
function playVideo(i){
    continueBtn.style.display = "none";
    mainVideo.src = videos[i];
    mainVideo.play();
}

/* CONTINUE */
continueBtn.addEventListener("click", () => {

    currentVideo++;

    if(currentVideo < videos.length){
        playVideo(currentVideo);
    } else {
        startGame();
    }
});

/* OBSERVERS */
function spawnObserver(){
    const img = document.createElement("img");
    img.src = "images/observers.png";
    img.classList.add("observer");

    img.style.left = Math.random()*100+"%";
    img.style.top = Math.random()*100+"%";

    overlay.appendChild(img);
}

/* GAME START */
async function startGame(){

    experience.style.display = "none";
    gameScreen.style.display = "block";

    const stream = await navigator.mediaDevices.getUserMedia({video:true});
    webcamVideo.srcObject = stream;

    gameActive = true;
    startRounds();
    moveBox();
}

/* ROUNDS (6x 7 sec) */
function startRounds(){

    round = 0;

    function nextRound(){

        if(round >= 6){
            alert("game done (placeholder ending)");
            return;
        }

        let timeLeft = 7;
        timerEl.innerText = timeLeft;

        const countdown = setInterval(() => {

            timeLeft--;
            timerEl.innerText = timeLeft;

            if(timeLeft <= 0){
                clearInterval(countdown);

                takeSnapshot();

                round++;
                nextRound();
            }

        },1000);
    }

    nextRound();
}

/* SNAPSHOT + FLASH */
function takeSnapshot(){

    flash.style.opacity = 1;

    setTimeout(() => {
        flash.style.opacity = 0;
    }, 300);

    setTimeout(() => {
        canvas.width = webcamVideo.videoWidth;
        canvas.height = webcamVideo.videoHeight;

        ctx.drawImage(webcamVideo,0,0);
    }, 1000); // 1 sec “pause feel”
}

/* BOX MOVE */
function moveBox(){

    if(!gameActive) return;

    dodgeBox.style.left = Math.random()*80+"vw";
    dodgeBox.style.top = Math.random()*80+"vh";

    setTimeout(moveBox,1200);
}