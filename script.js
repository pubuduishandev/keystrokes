const sentences = [
  "Birds chirp gently in the morning sun.",
  "The sky is painted with hues of orange and red.",
  "A gentle breeze whispers through the trees.",
  "Clouds drift lazily across the sky.",
  "Raindrops patter softly on the rooftop.",
  "Leaves rustle with a calming sound.",
  "The forest hums with peaceful life.",
  "Sunlight filters through the window.",
  "The candle flickers in the quiet room.",
  "Footsteps echo softly in the hallway."
];

let current = 0;
let timer;
let timeLeft = 120;
let correctCount = 0;

const TYPING_SPEED = 126.9447072;
const ERROR_RATE = 1205.696203;
const LABEL = "relaxed";

const keystrokeData = [];
const keyDownTimes = new Map();
let lastKeyTime = null;

const sentenceBox = document.getElementById("target-sentence");
const inputBox = document.getElementById("user-input");
const timerText = document.getElementById("timer");
const sentenceCount = document.getElementById("sentence-count");
const submitBtn = document.getElementById("submit-btn");
const resultBox = document.getElementById("result-box");
const bgMusic = document.getElementById("background-music");

function loadSentence() {
  sentenceBox.textContent = sentences[current];
  inputBox.value = "";
  inputBox.disabled = false;
  sentenceCount.textContent = current + 1;
  timeLeft = 120;
  updateTimerText();
  clearInterval(timer);
  timer = setInterval(updateTimer, 1000);
}

function updateTimer() {
  timeLeft--;
  updateTimerText();
  if (timeLeft <= 0) {
    clearInterval(timer);
    evaluateSentence();
  }
}

function updateTimerText() {
  const min = String(Math.floor(timeLeft / 60)).padStart(2, '0');
  const sec = String(timeLeft % 60).padStart(2, '0');
  timerText.textContent = `${min}:${sec}`;
}

function evaluateSentence() {
  inputBox.disabled = true;
  const userInput = inputBox.value.trim();
  const target = sentences[current].trim();
  if (userInput === target) {
    correctCount++;
    resultBox.textContent = "Correct ✅";
    resultBox.style.color = "green";
  } else {
    resultBox.textContent = "Incorrect ❌";
    resultBox.style.color = "red";
  }

  current++;
  if (current < sentences.length) {
    setTimeout(() => {
      resultBox.textContent = "";
      loadSentence();
    }, 1000);
  } else {
    sentenceBox.textContent = "Session Complete!";
    inputBox.disabled = true;
    submitBtn.disabled = true;
    resultBox.textContent = `You typed ${correctCount} out of 10 sentences correctly.`;
    resultBox.style.color = "#333";

    // Stop background music after session ends
    bgMusic.pause();
    bgMusic.currentTime = 0;

    exportKeystrokeData(); // 👈 Export data here
  }
}

submitBtn.addEventListener("click", () => {
  clearInterval(timer);
  evaluateSentence();
});

function enableMusicPlayback() {
  bgMusic.play().catch(e => console.warn("Autoplay blocked"));
  window.removeEventListener("click", enableMusicPlayback);
}
window.addEventListener("click", enableMusicPlayback);
window.onload = loadSentence;

// ------------------ Keystroke Tracking ------------------

inputBox.addEventListener("keydown", (e) => {
  const time = Date.now();
  keyDownTimes.set(e.code, time);

  keystrokeData.push({
    key: e.code,
    event: "down",
    time: Math.floor(time / 1000),
    label: LABEL,
    hold_time: null,
    flight_time: lastKeyTime ? ((time - lastKeyTime) / 1000).toFixed(9) : "",
    typing_speed: TYPING_SPEED,
    error_rate: ERROR_RATE
  });

  lastKeyTime = time;
});

inputBox.addEventListener("keyup", (e) => {
  const time = Date.now();
  const downTime = keyDownTimes.get(e.code);
  const holdTime = downTime ? ((time - downTime) / 1000).toFixed(9) : "";

  keystrokeData.push({
    key: e.code,
    event: "up",
    time: Math.floor(time / 1000),
    label: LABEL,
    hold_time: "",
    flight_time: "",
    typing_speed: TYPING_SPEED,
    error_rate: ERROR_RATE
  });

  for (let i = keystrokeData.length - 2; i >= 0; i--) {
    if (
      keystrokeData[i].key === e.code &&
      keystrokeData[i].event === "down" &&
      keystrokeData[i].hold_time === null
    ) {
      keystrokeData[i].hold_time = holdTime;
      break;
    }
  }
});

// ------------------ Export CSV ------------------

function exportKeystrokeData() {
  const headers = [
    "key", "event", "time", "label",
    "hold_time", "flight_time",
    "typing_speed", "error_rate"
  ];

  const rows = keystrokeData.map(row =>
    headers.map(h => row[h] ?? "").join(",")
  );

  const csvContent = [headers.join(","), ...rows].join("\n");
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const fileName = `keystroke_data_${LABEL}_${timestamp}.csv`;

  const blob = new Blob([csvContent], { type: "text/csv" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
