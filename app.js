const $ = (id) => document.getElementById(id);

const video = $("camera");
const statusEl = $("status");
const message = $("message");
const cameraLabel = $("cameraLabel");
const cameraPlaceholder = $("cameraPlaceholder");
const faceBox = $("faceBox");
const startBtn = $("startBtn");
const fingerBtn = $("fingerBtn");
const demoBtn = $("demoBtn");
const resetBtn = $("resetBtn");
const passbookState = $("passbookState");
const fingerState = $("fingerState");
const passbookRow = $("passbookRow");
const fingerRow = $("fingerRow");
const serviceBox = $("serviceBox");
const serviceQuestion = $("serviceQuestion");
const heard = $("heard");
const listenPill = $("listenPill");
const voiceLine = $("voiceLine");
const balanceBtn = $("balanceBtn");
const withdrawBtn = $("withdrawBtn");

let stream = null;
let detector = null;
let recognition = null;
let personPresent = false;
let flowStarted = false;
let flowBusy = false;
let voiceUnlocked = false;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function setStatus(text, live = false) {
  if (!statusEl) return;
  statusEl.textContent = text;
  statusEl.classList.toggle("live", live);
}

function setMessage(text) {
  if (message) message.textContent = text;
  if (voiceLine) voiceLine.textContent = text;
}

function setStep(n) {
  for (let i = 1; i <= 4; i++) {
    const el = $("s" + i);
    if (!el) continue;
    el.classList.toggle("active", i === n);
    el.classList.toggle("done", i < n);
  }
}

function pickTamilVoice() {
  const voices = window.speechSynthesis?.getVoices?.() || [];
  const tamil = voices.filter(v => /^ta(-|_)/i.test(v.lang || ""));
  return tamil.find(v => /female|woman|kalpana|harini|lekha|rani/i.test(v.name)) || tamil[0] || null;
}

function speak(text) {
  return new Promise((resolve) => {
    setMessage(text);

    if (!window.speechSynthesis) {
      resolve();
      return;
    }

    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "ta-IN";
    u.rate = 0.78;
    u.pitch = 1.05;
    u.volume = 1;

    const v = pickTamilVoice();
    if (v) u.voice = v;

    let finished = false;
    const done = () => {
      if (finished) return;
      finished = true;
      setTimeout(resolve, 2000);
    };

    u.onend = done;
    u.onerror = done;
    window.speechSynthesis.speak(u);
  });
}

async function startCamera() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
      audio: true
    });

    video.srcObject = stream;
    await video.play();
    cameraPlaceholder.style.display = "none";
    cameraLabel.textContent = "Camera Active";
    setStatus("CAMERA ON", true);
    return true;
  } catch (e) {
    console.error(e);
    setStatus("CAMERA ERROR");
    setMessage("கேமரா மற்றும் மைக்ரோஃபோன் அனுமதியை Allow செய்யவும்.");
    return false;
  }
}

async function setupDetector() {
  try {
    const mod = await import("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/vision_bundle.js");
    const fs = await mod.FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm");
    detector = await mod.FaceDetector.createFromOptions(fs, {
      baseOptions: {
        modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite"
      },
      runningMode: "VIDEO",
      minDetectionConfidence: 0.5
    });
  } catch (e) {
    console.error("Face detector error", e);
    detector = null;
  }
}

function detectLoop() {
  if (!video || video.readyState < 2) {
    requestAnimationFrame(detectLoop);
    return;
  }

  if (detector) {
    try {
      const r = detector.detectForVideo(video, performance.now());
      const found = !!r.detections?.length;
      updatePerson(found);
    } catch (e) {
      console.error(e);
    }
  } else {
    // Safe demo fallback if the detector CDN fails.
    updatePerson(true);
  }

  requestAnimationFrame(detectLoop);
}

function updatePerson(found) {
  personPresent = found;

  if (found) {
    faceBox.style.display = "block";
    cameraLabel.textContent = "Person detected ✓";
    if (!flowStarted && !flowBusy) beginFlow();
  } else {
    faceBox.style.display = "none";
    cameraLabel.textContent = "Looking for person...";
  }
}

async function beginFlow() {
  if (flowBusy) return;
  flowBusy = true;
  flowStarted = true;

  setStatus("FACE DETECTED", true);
  setStep(1);
  await speak("வணக்கம்! Smart Banking Kiosk-க்கு உங்களை அன்புடன் வரவேற்கிறோம்.");
  if (!personPresent) return resetFlow();

  await speak("உங்கள் முகம் கண்டறியப்பட்டுள்ளது.");
  if (!personPresent) return resetFlow();

  setStep(2);
  passbookState.textContent = "Verifying...";
  await speak("உங்கள் Passbook விவரங்களை சரிபார்க்கிறேன். தயவுசெய்து சில நொடிகள் காத்திருக்கவும்.");
  passbookState.textContent = "Verified ✓";
  passbookRow.classList.add("ok");
  await speak("உங்கள் Passbook விவரங்கள் வெற்றிகரமாக சரிபார்க்கப்பட்டுள்ளன.");
  if (!personPresent) return resetFlow();

  setStep(3);
  fingerState.textContent = "Verifying...";
  await speak("இப்போது உங்கள் முகம், கைரேகை மற்றும் வங்கி விவரங்களை சரிபார்க்கிறேன். தயவுசெய்து சில நொடிகள் காத்திருக்கவும்.");
  fingerState.textContent = "Verified ✓";
  fingerRow.classList.add("ok");
  await speak("உங்கள் அடையாளம் மற்றும் வங்கி விவரங்கள் வெற்றிகரமாக சரிபார்க்கப்பட்டுள்ளன.");
  if (!personPresent) return resetFlow();

  await askService();
}

async function askService() {
  setStep(4);
  serviceBox.style.display = "block";
  serviceQuestion.textContent = "Balance Enquiry அல்லது Cash Withdrawal?";
  heard.textContent = "உங்கள் பதிலை சொல்லுங்கள்";
  listenPill.textContent = "🎙️ கேட்கிறேன்...";

  await speak("உங்களுக்கு Balance Enquiry வேண்டுமா அல்லது Cash Withdrawal வேண்டுமா?");
  await sleep(300);
  listenForService();
}

function normalize(s) {
  return (s || "").toLowerCase().replace(/[.,!?]/g, " ").trim();
}

function chooseService(text) {
  const t = normalize(text);
  const balanceWords = ["balance", "enquiry", "inquiry", "check balance", "பேலன்ஸ்", "இருப்பு", "மீதி", "கணக்கு இருப்பு"];
  const withdrawalWords = ["withdraw", "withdrawal", "cash withdrawal", "cash", "பணம்", "பணம் எடுக்க", "வித்ட்ரா", "எடுக்க வேண்டும்"];
  if (balanceWords.some(x => t.includes(x))) return "balance";
  if (withdrawalWords.some(x => t.includes(x))) return "withdraw";
  return null;
}

function listenForService() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    listenPill.textContent = "🎙️ Voice recognition unavailable";
    heard.textContent = "Chrome voice recognition கிடைக்கவில்லை.";
    return;
  }

  if (recognition) {
    try { recognition.abort(); } catch (e) {}
  }

  recognition = new SR();
  recognition.lang = "ta-IN";
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.maxAlternatives = 5;

  recognition.onstart = () => {
    setStatus("LISTENING", true);
    listenPill.textContent = "🎙️ கேட்கிறேன்... இப்போது சொல்லுங்கள்";
  };

  recognition.onresult = (e) => {
    const text = Array.from(e.results[0]).map(x => x.transcript).join(" ");
    heard.textContent = "நீங்கள் சொன்னது: " + text;
    const choice = chooseService(text);
    if (choice) selectService(choice);
    else retryVoice();
  };

  recognition.onerror = () => retryVoice();
  try { recognition.start(); } catch (e) {}
}

async function retryVoice() {
  listenPill.textContent = "🎙️ மீண்டும் கேட்கிறேன்";
  await speak("மன்னிக்கவும். உங்கள் பதிலை தெளிவாக கேட்கவில்லை. Balance Enquiry அல்லது Cash Withdrawal என்று சொல்லுங்கள்.");
  if (personPresent) setTimeout(listenForService, 200);
}

async function selectService(choice) {
  if (recognition) {
    try { recognition.abort(); } catch (e) {}
  }

  listenPill.textContent = "✓ பதில் கிடைத்தது";
  balanceBtn.disabled = true;
  withdrawBtn.disabled = true;

  if (choice === "balance") {
    heard.textContent = "Selected: Balance Enquiry";
    await speak("நீங்கள் Balance Enquiry தேர்வு செய்துள்ளீர்கள்.");
    await speak("உங்கள் கணக்கு இருப்பை வங்கி பதிவுகளில் இருந்து சரிபார்க்கிறேன்.");
    await speak("உங்கள் கணக்கு இருப்பு பன்னிரண்டு ஆயிரத்து ஐந்நூறு ரூபாய்.");
    showResult("Balance Enquiry", "Available Balance: ₹12,500");
    await speak("Balance Enquiry செயல்முறை வெற்றிகரமாக முடிந்தது.");
  } else {
    heard.textContent = "Selected: Cash Withdrawal";
    await speak("நீங்கள் Cash Withdrawal தேர்வு செய்துள்ளீர்கள்.");
    await speak("தயவுசெய்து எவ்வளவு பணம் எடுக்க வேண்டும் என்பதை சொல்லுங்கள்.");
    const amountText = await listenForAmount();
    const match = (amountText || "").match(/[0-9][0-9,]*/);
    const amount = match ? match[0].replace(/,/g, "") : "2500";
    await speak(`நீங்கள் ${amount} ரூபாய் பணம் எடுக்க விரும்புகிறீர்கள்.`);
    await speak("உங்கள் Cash Withdrawal கோரிக்கையை பதிவு செய்கிறேன்.");
    showResult("Cash Withdrawal", `Withdrawal Request: ₹${Number(amount).toLocaleString("en-IN")}`);
    await speak("உங்கள் Cash Withdrawal கோரிக்கை வெற்றிகரமாக பதிவு செய்யப்பட்டுள்ளது.");
  }

  setStatus("COMPLETED", true);
  resetBtn.style.display = "block";
}

function listenForAmount() {
  return new Promise(resolve => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return resolve("");
    const r = new SR();
    r.lang = "ta-IN";
    r.continuous = false;
    r.interimResults = false;
    r.onresult = e => resolve(e.results[0][0].transcript);
    r.onerror = () => resolve("");
    try { r.start(); } catch (e) { resolve(""); }
  });
}

function showResult(title, text) {
  let box = $("result");
  if (!box) {
    box = document.createElement("div");
    box.id = "result";
    box.className = "result";
    document.querySelector(".assistant-card")?.appendChild(box);
  }
  box.innerHTML = `<h2>${title}</h2><p>${text}</p>`;
  box.classList.remove("hidden");
}

function resetFlow() {
  try { recognition?.abort(); } catch (e) {}
  window.speechSynthesis?.cancel();
  flowStarted = false;
  flowBusy = false;
  passbookState.textContent = "Waiting";
  fingerState.textContent = "Waiting";
  passbookRow.classList.remove("ok");
  fingerRow.classList.remove("ok");
  serviceBox.style.display = "none";
  balanceBtn.disabled = false;
  withdrawBtn.disabled = false;
  setStep(1);
  setStatus("READY");
  setMessage("Person detected ஆகும் வரை காத்திருக்கிறது...");
}

async function startAll() {
  if (voiceUnlocked) return;
  voiceUnlocked = true;
  startBtn.style.display = "none";
  const ok = await startCamera();
  if (!ok) {
    startBtn.style.display = "block";
    voiceUnlocked = false;
    return;
  }
  await setupDetector();
  detectLoop();
}

startBtn.onclick = startAll;
fingerBtn.style.display = "none";
demoBtn.style.display = "none";
resetBtn.onclick = () => location.reload();
balanceBtn.onclick = () => selectService("balance");
withdrawBtn.onclick = () => selectService("withdraw");

// Browser security requires one user gesture to unlock speech/microphone.
// After START is clicked once, the rest of the kiosk is automatic.
window.addEventListener("load", () => {
  setStatus("READY");
  setMessage("ஒருமுறை START KIOSK அழுத்தவும். அதன் பிறகு முகத்தை பார்த்தவுடன் செயல்முறை தானாக தொடங்கும்.");
});
