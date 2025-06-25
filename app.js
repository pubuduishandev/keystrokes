let currentPhase = 0;
let keystrokes = [];
let currentSentence = "";
let startTime = null;
let sessionTimer, sentenceTimer;
let correctCountRelaxed = 0;
let correctCountStressed = 0;
let backgroundMusic = null;

const app = document.getElementById("app");

function showConsent() {
  app.innerHTML = `
    <h2>Welcome!</h2>
    <p>This is a typing survey that measures your typing rhythm to study stress levels.</p>
    <p><strong>✅ What is recorded:</strong><br>- Timing of each keystroke<br>- Key pressed/released (NOT the actual content you type)</p>
    <p><strong>🕒 Each session lasts 5 minutes.</strong><br></p>
    <p><strong>Do you consent to participate?</strong><br>
    <div class="confirmation">
      <button class="agree" onclick="startPhase()">I Agree</button>
      <button class="do-not-agree" onclick="window.close()">I Do Not Agree</button>
    </div>
  `;
}

function startPhase() {
  keystrokes = [];
  startTime = performance.now();
  showTypingUI();
  startSessionTimer();
  playMusic();
  nextSentence();
}

function showTypingUI() {
  const s = stimuli[currentPhase];
  app.innerHTML = `
    <h2>${s.title}</h2>
    <p>${s.instruction}</p>
    <p><strong>Time Left:</strong> <span id="countdown">00:00</span></p>
    <p><strong>Correct Sentences:</strong> <span id="correctCount">0</span></p>
    <div id="progressBar"><div class="progress-fill" id="fill"></div></div>
    <div id="sentenceBar" style="display:none;"><div class="progress-fill" id="sentenceFill" style="background:red;"></div></div>
    <p id="sentenceDisplay" style="background:#add8e6;padding:10px;"></p>
    <textarea id="textInput"></textarea>
    <br>
    <button onclick="submitSentence()">Done with Sentence</button>
  `;
  document.getElementById("textInput").addEventListener("keydown", logKeyDown);
  document.getElementById("textInput").addEventListener("keyup", logKeyUp);
}

function logKeyDown(e) {
  keystrokes.push({ event: "down", key: e.key, time: performance.now(), label: stimuli[currentPhase].label });
}

function logKeyUp(e) {
  keystrokes.push({ event: "up", key: e.key, time: performance.now(), label: stimuli[currentPhase].label });
}

function nextSentence() {
  const s = stimuli[currentPhase];
  currentSentence = s.sentences[Math.floor(Math.random() * s.sentences.length)];
  document.getElementById("sentenceDisplay").textContent = currentSentence;
  document.getElementById("textInput").value = "";
  if (s.label === "stressed") {
    document.getElementById("sentenceBar").style.display = "block";
    startSentenceTimer();
  }
}

function submitSentence() {
  const typed = document.getElementById("textInput").value.trim().toLowerCase();
  const expected = currentSentence.trim().toLowerCase();
  if (typed === expected) {
    if (stimuli[currentPhase].label === "relaxed") {
      correctCountRelaxed++;
    } else {
      correctCountStressed++;
    }
  }
  document.getElementById("correctCount").textContent = stimuli[currentPhase].label === "relaxed" ? correctCountRelaxed : correctCountStressed;
  nextSentence();
}

function startSessionTimer() {
  const duration = stimuli[currentPhase].duration;
  let remaining = duration;
  sessionTimer = setInterval(() => {
    const progress = ((duration - remaining) / duration) * 100;
    document.getElementById("fill").style.width = progress + "%";

    const mins = String(Math.floor(remaining / 60)).padStart(2, '0');
    const secs = String(remaining % 60).padStart(2, '0');
    document.getElementById("countdown").textContent = `${mins}:${secs}`;

    if (--remaining < 0) {
      clearInterval(sessionTimer);
      finishPhase();
    }
  }, 1000);
}

function startSentenceTimer() {
  let remaining = 15;
  sentenceTimer = setInterval(() => {
    document.getElementById("sentenceFill").style.width = (100 - (remaining / 15 * 100)) + "%";
    if (--remaining < 0) {
      clearInterval(sentenceTimer);
      nextSentence();
    }
  }, 1000);
}

function playMusic() {
  if (backgroundMusic) {
    backgroundMusic.pause();
    backgroundMusic = null;
  }
  const track = stimuli[currentPhase].label === "relaxed" ? "assets/calm_music.mp3" : "assets/stress_music.mp3";
  backgroundMusic = new Audio(track);
  backgroundMusic.loop = true;
  backgroundMusic.play();
}

function finishPhase() {
  if (sentenceTimer) clearInterval(sentenceTimer);
  saveData();
  currentPhase++;
  if (currentPhase < stimuli.length) {
    startPhase();
  } else {
    if (backgroundMusic) backgroundMusic.pause();
    showThankYou();
  }
}

function saveData() {
  const data = keystrokes.filter(k => k.label === stimuli[currentPhase].label);
  if (!data.length) return;

  // Calculate hold times
  const holdTimes = {};
  for (let i = 0; i < data.length; i++) {
    if (data[i].event === 'down') {
      const key = data[i].key;
      for (let j = i + 1; j < data.length; j++) {
        if (data[j].key === key && data[j].event === 'up') {
          holdTimes[i] = data[j].time - data[i].time;
          break;
        }
      }
    }
  }

  // Flight times between down events
  const downEvents = data.filter(d => d.event === 'down');
  const flightTimes = [null];
  for (let i = 1; i < downEvents.length; i++) {
    flightTimes.push(downEvents[i].time - downEvents[i - 1].time);
  }

  // Typing speed (chars/min)
  const downTimeStamps = downEvents.map(d => d.time);
  const sessionDuration = downTimeStamps.length ? downTimeStamps.at(-1) - downTimeStamps[0] : 0;
  const typingSpeed = sessionDuration > 0 ? (downTimeStamps.length / sessionDuration) * 60000 : 0;

  // Error rate
  const expected = stimuli[currentPhase].sentences.join(" ").toLowerCase().replace(/\s+/g, "");
  const typed = downEvents.map(d => d.key).join("").toLowerCase().replace(/\s+/g, "");
  let errors = 0;
  for (let i = 0; i < Math.min(expected.length, typed.length); i++) {
    if (expected[i] !== typed[i]) errors++;
  }
  errors += Math.abs(expected.length - typed.length);
  const errorRate = (errors / Math.max(expected.length, 1)) * 100;

  const csvHeader = "key,event,time,label,hold_time,flight_time,typing_speed,error_rate";
  let csvRows = [];
  let downIndex = 0;
  for (let i = 0; i < data.length; i++) {
    const k = data[i];
    const holdTime = holdTimes[i] !== undefined ? holdTimes[i].toFixed(2) : "";
    const flightTime = k.event === 'down' ? (flightTimes[downIndex++]?.toFixed(2) || "") : "";
    csvRows.push([
      k.key,
      k.event,
      k.time.toFixed(2),
      k.label,
      holdTime,
      flightTime,
      typingSpeed.toFixed(2),
      errorRate.toFixed(2)
    ].join(","));
  }

  const csv = [csvHeader, ...csvRows].join("\n");
  const blob = new Blob([csv], { type: 'text/csv' });
  const label = stimuli[currentPhase].label;
  const now = new Date();
  const timestamp = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}${String(now.getSeconds()).padStart(2,'0')}`;
  const filename = `keystroke_data_${label}_${timestamp}.csv`;

  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
}

function showThankYou() {
  app.innerHTML = `
    <h2>🎉 Thank you for participating! 🎉</h2>
    <p><strong>Relaxed Mode Correct Sentences:</strong> ${correctCountRelaxed}</p>
    <p><strong>Stressed Mode Correct Sentences:</strong> ${correctCountStressed}</p>
    <p>Your CSV files have been downloaded automatically.</p>
  `;
}

showConsent();
