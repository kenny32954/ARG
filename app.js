(() => {
  "use strict";

  const $ = (q) => document.querySelector(q);
  const els = {
    tuner: $("#tuner"),
    frequency: $("#frequency"),
    channelLabel: $("#channelLabel"),
    signalFill: $("#signalFill"),
    signalText: $("#signalText"),
    powerBtn: $("#powerBtn"),
    stepDown: $("#stepDown"),
    stepUp: $("#stepUp"),
    scanBtn: $("#scanBtn"),
    captureBtn: $("#captureBtn"),
    muteBtn: $("#muteBtn"),
    transcript: $("#transcript"),
    clearTranscript: $("#clearTranscript"),
    captures: $("#captures"),
    captureCount: $("#captureCount"),
    systemStatus: $("#systemStatus"),
    systemStatusText: $("#systemStatusText"),
    clock: $("#clock"),
    scopeMode: $("#scopeMode"),
    canvas: $("#waterfall"),
    terminalForm: $("#terminalForm"),
    terminalInput: $("#terminalInput"),
    terminalOutput: $("#terminalOutput"),
    terminalState: $("#terminalState")
  };

  const TARGET = 101.1;
  const STORAGE_KEY = "echo1.phase1.state.v1";
  const ARCHIVE_HASH = "d863e2cdf524d017252a78b48920ef7f72ac2f2586e6ae3e4686a99092ba771b";
  const state = {
    powered: false,
    muted: false,
    frequency: Number(els.tuner.value) / 10,
    scanning: false,
    scanTimer: null,
    onTargetSince: 0,
    sequenceIndex: 0,
    sequenceTimer: null,
    lastBurstAt: 0,
    archiveUnlocked: false,
    captures: [],
    discovered: {},
    audio: null,
    sessionPool: null
  };

  const transmissions = [
    { delay: 1200, kind: "rx", text: "CARRIER // ECHO-1 // SIGNAL UNREGISTERED" },
    { delay: 2600, kind: "rx", text: "[VOICE FRAGMENT] ...truth... in the... static..." },
    { delay: 3100, kind: "rx", text: "BURST: G // -7 // G // -7" },
    { delay: 2800, kind: "warn", text: "IDENT COLLISION // SOURCE UNKNOWN" },
    { delay: 3300, kind: "rx", text: "[VOICE FRAGMENT] Jonah... don't answer it..." },
    { delay: 3700, kind: "rx", text: "STAMP: 23:14:09 // EAST RELAY" },
    { delay: 4100, kind: "rx", text: "101.1 // 101.1 // 101.1" }
  ];

  function transmissionPool() {
    const extra = [];
    if (state.discovered.case041) extra.push({ delay: 3200, kind: "warn", text: "[VOICE] YOU OPENED HIS FILE." });
    if (state.discovered.wallEyes) extra.push({ delay: 2900, kind: "rx", text: "E-04 // LUMA EVENT REMEMBERED" });
    if (state.discovered.g7Fix) extra.push({ delay: 3100, kind: "warn", text: "[VOICE] G-SEVEN WAS NOT LOST. IT WAS REMOVED." });
    if (state.discovered.g7Tape) extra.push({ delay: 3400, kind: "rx", text: "J-17 VOICE MODEL // PRESENT" });
    if (state.discovered.microfilmHand) extra.push({ delay: 3600, kind: "warn", text: "ROOM 3 // VALE // HERMAN" });
    if (state.discovered.monitorAnchors) extra.push({ delay: 3000, kind: "rx", text: "FOUR EVENTS DO NOT CHANGE." });
    if (state.discovered.valeLetters) extra.push({ delay: 3500, kind: "warn", text: "[MARA-04] HERMAN, THAT IS NOT MY VOICE." });
    if (state.discovered.profile) extra.push({ delay: 3300, kind: "rx", text: "PROFILE E1-B // OBSERVER RECOGNIZED" });
    if (state.discovered.broadcaster) extra.push({ delay: 3800, kind: "warn", text: "MARA-04 // GENERATIVE PHONEME MODEL ACTIVE" });
    if (state.discovered.ending_archive) extra.push({ delay: 4200, kind: "rx", text: "NO RESPONSE RECORDED // CARRIER PERSISTS" });
    if (state.discovered.ending_answer) extra.push({ delay: 2100, kind: "warn", text: "HERMAN-05 // VOICE MODEL INITIALIZED" });
    const generated = proceduralTransmission();
    if (generated) extra.push(generated);
    return extra.length ? [...transmissions, ...extra] : transmissions;
  }

  function proceduralTransmission() {
    const storeKey = "echo1.generated.broadcasts.v1";
    const subjects = [
      "THE LOOP", "ROOM THREE", "THE ARCHIVE", "MARA-04",
      "J-17", "ECHO-1", "YOUR RECEIVER", "THE EAST RELAY"
    ];
    const actions = [
      "REMEMBERS YOUR LAST SESSION",
      "HEARD THE QUESTION BEFORE YOU ASKED",
      "RECORDED THE SILENCE BETWEEN WORDS",
      "IS STILL LISTENING",
      "HAS ANOTHER VERSION OF THIS MESSAGE",
      "RECOGNIZED THE OBSERVER",
      "REPEATED A VOICE THAT WAS NEVER RECORDED",
      "IS RECEIVING WITH THE FEED CUT"
    ];
    const tails = [
      "SOURCE CLOCK +00:00:07",
      "NO TRANSMITTER KEY EVENT",
      "INDEX DOES NOT MATCH",
      "CARRIER PERSISTS",
      "VOICE MODEL UNRESOLVED",
      "DO NOT TRUST THE FIRST COPY",
      "RETURN PATH OPEN",
      "SESSION H-04"
    ];
    let seen = [];
    try {
      seen = JSON.parse(localStorage.getItem(storeKey) || "[]");
      if (!Array.isArray(seen)) seen = [];
    } catch {
      seen = [];
    }

    let text = "";
    for (let attempt = 0; attempt < 24; attempt++) {
      const s = subjects[Math.floor(Math.random() * subjects.length)];
      const a = actions[Math.floor(Math.random() * actions.length)];
      const t = tails[Math.floor(Math.random() * tails.length)];
      const candidate = `[SYNTH] ${s} // ${a} // ${t}`;
      if (!seen.includes(candidate)) {
        text = candidate;
        break;
      }
    }
    if (!text) {
      seen = [];
      const s = subjects[Math.floor(Math.random() * subjects.length)];
      const a = actions[Math.floor(Math.random() * actions.length)];
      const t = tails[Math.floor(Math.random() * tails.length)];
      text = `[SYNTH] ${s} // ${a} // ${t}`;
    }
    seen.push(text);
    seen = seen.slice(-120);
    try {
      localStorage.setItem(storeKey, JSON.stringify(seen));
    } catch {}
    return { delay: 3600 + Math.floor(Math.random() * 1900), kind: "warn", text };
  }

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      if (Array.isArray(saved.captures)) state.captures = saved.captures.slice(-20);
      if (saved.discovered && typeof saved.discovered === "object") state.discovered = saved.discovered;
      state.archiveUnlocked = Boolean(saved.archiveUnlocked);
    } catch {}
    renderCaptures();
    if (state.archiveUnlocked) {
      els.terminalState.textContent = "INDEX PARTIAL";
      terminalPrint("AUTH TOKEN ACCEPTED IN PREVIOUS SESSION.", "ghost");
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      captures: state.captures.slice(-20),
      discovered: state.discovered,
      archiveUnlocked: state.archiveUnlocked
    }));
  }

  function nowStamp() {
    return new Date().toLocaleTimeString("en-US", {
      hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit"
    });
  }

  function updateClock() {
    els.clock.textContent = nowStamp();
  }
  updateClock();
  setInterval(updateClock, 1000);

  function log(text, kind = "") {
    const p = document.createElement("p");
    if (kind) p.className = kind;
    const stamp = document.createElement("span");
    stamp.className = "time";
    stamp.textContent = `[${nowStamp()}] `;
    p.append(stamp, document.createTextNode(text));
    els.transcript.appendChild(p);
    while (els.transcript.children.length > 70) els.transcript.firstElementChild.remove();
    els.transcript.scrollTop = els.transcript.scrollHeight;
  }

  function setStatus(label, mode = "") {
    els.systemStatusText.textContent = label;
    els.systemStatus.className = "status-pill" + (mode ? " " + mode : "");
  }

  function signalStrength(freq = state.frequency) {
    if (!state.powered) return 0;
    if (state.discovered.ending_isolate && Math.abs(freq - TARGET) < 0.35) {
      return 0.015 + Math.random() * 0.025;
    }
    const d = Math.abs(freq - TARGET);
    const echoPeak = Math.max(0, 1 - d / 1.35);
    const shoulder = Math.max(0, 1 - Math.abs(freq - 92.4) / 0.55) * 0.18;
    const drift = (Math.sin(performance.now() / 370) + Math.sin(performance.now() / 133)) * 0.018;
    const floor = 0.035 + Math.random() * 0.045;
    return Math.max(0, Math.min(1, floor + echoPeak * 0.92 + shoulder + drift));
  }

  function exactTarget() {
    return Math.abs(state.frequency - TARGET) < 0.051;
  }

  function updateFrequencyUI() {
    state.frequency = Number(els.tuner.value) / 10;
    els.frequency.textContent = state.frequency.toFixed(1);

    const strength = signalStrength();
    const percent = Math.round(strength * 100);
    els.signalFill.style.width = percent + "%";
    els.signalText.textContent = percent + "%";

    const close = Math.abs(state.frequency - TARGET);
    if (!state.powered) {
      els.channelLabel.textContent = "RECEIVER OFFLINE";
      els.captureBtn.disabled = true;
      return;
    }

    if (exactTarget() && state.discovered.ending_isolate) {
      els.channelLabel.textContent = "NO CARRIER // ROUTE ISOLATED";
      els.captureBtn.disabled = true;
      state.onTargetSince = 0;
      stopTargetSequence();
      document.body.classList.remove("echo-event");
      els.scopeMode.textContent = "NO RETURN";
      setStatus("QUIET CARRIER");
    } else if (exactTarget()) {
      els.channelLabel.textContent = state.discovered.ending_answer ? "ECHO-1 // HERMAN-05" : "UNKNOWN CARRIER // ECHO-1";
      els.captureBtn.disabled = false;
      if (!state.onTargetSince) {
        state.onTargetSince = performance.now();
        beginTargetSequence();
      }
      document.body.classList.add("echo-event");
      els.scopeMode.textContent = "CARRIER LOCK";
      setStatus("SIGNAL LOCK", "alert");
    } else {
      if (close < 0.8) els.channelLabel.textContent = "UNSTABLE CARRIER";
      else if (Math.abs(state.frequency - 92.4) < 0.2) els.channelLabel.textContent = "WEAK CIVIL BAND";
      else els.channelLabel.textContent = "NO IDENT";
      els.captureBtn.disabled = true;
      state.onTargetSince = 0;
      stopTargetSequence();
      document.body.classList.remove("echo-event");
      els.scopeMode.textContent = "WIDEBAND";
      setStatus(state.scanning ? "SCANNING" : "MONITORING", "live");
    }

    tuneAudio();
  }

  function setFrequency(freq) {
    const clamped = Math.max(87.5, Math.min(108.0, Math.round(freq * 10) / 10));
    els.tuner.value = String(Math.round(clamped * 10));
    updateFrequencyUI();
  }

  function beginTargetSequence() {
    if (state.sequenceTimer) return;
    state.sequenceIndex = 0;
    state.sessionPool = transmissionPool();
    const next = () => {
      if (!state.powered || !exactTarget()) {
        stopTargetSequence();
        return;
      }
      const pool = state.sessionPool || transmissions;
      const item = pool[state.sequenceIndex % pool.length];
      state.sequenceTimer = setTimeout(() => {
        if (!state.powered || !exactTarget()) return stopTargetSequence();
        log(item.text, item.kind);
        state.lastBurstAt = Date.now();
        flashSignal(item.kind === "warn");
        state.sequenceIndex++;
        next();
      }, item.delay);
    };
    log("carrier handshake detected", "rx");
    next();
  }

  function stopTargetSequence() {
    clearTimeout(state.sequenceTimer);
    state.sequenceTimer = null;
    state.sessionPool = null;
  }

  function flashSignal(isWarning) {
    const old = els.signalFill.style.filter;
    els.signalFill.style.filter = isWarning ? "brightness(2.2)" : "brightness(1.65)";
    setTimeout(() => (els.signalFill.style.filter = old), 160);
  }

  function createAudio() {
    if (state.audio) return state.audio;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    const ctx = new AudioCtx();

    const length = ctx.sampleRate * 3;
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      last = last * 0.985 + white * 0.15;
      data[i] = white * 0.68 + last * 0.32;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 1600;
    filter.Q.value = 0.55;

    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0;

    const carrier = ctx.createOscillator();
    carrier.type = "sine";
    carrier.frequency.value = 311;

    const carrierGain = ctx.createGain();
    carrierGain.gain.value = 0;

    const wobble = ctx.createOscillator();
    wobble.type = "sine";
    wobble.frequency.value = 4.7;
    const wobbleGain = ctx.createGain();
    wobbleGain.gain.value = 10;
    wobble.connect(wobbleGain).connect(carrier.frequency);

    const master = ctx.createGain();
    master.gain.value = 0.72;

    noise.connect(filter).connect(noiseGain).connect(master);
    carrier.connect(carrierGain).connect(master);
    master.connect(ctx.destination);

    noise.start();
    carrier.start();
    wobble.start();

    state.audio = { ctx, noiseGain, carrierGain, filter, master };
    return state.audio;
  }

  function tuneAudio() {
    const a = state.audio;
    if (!a) return;
    const t = a.ctx.currentTime;
    const d = Math.abs(state.frequency - TARGET);
    const lock = state.discovered.ending_isolate ? 0 : Math.max(0, 1 - d / 1.4);
    const muted = !state.powered || state.muted;
    const noiseLevel = muted ? 0 : 0.12 - lock * 0.065;
    const carrierLevel = muted ? 0 : Math.max(0, lock - 0.68) * 0.055;
    a.noiseGain.gain.setTargetAtTime(Math.max(0.01, noiseLevel), t, 0.05);
    a.carrierGain.gain.setTargetAtTime(carrierLevel, t, 0.07);
    a.filter.frequency.setTargetAtTime(900 + (state.frequency - 87.5) * 67, t, 0.08);
  }

  async function powerOn() {
    state.powered = true;
    const a = createAudio();
    if (a && a.ctx.state === "suspended") await a.ctx.resume();
    els.powerBtn.textContent = "POWER OFF";
    setStatus("MONITORING", "live");
    els.scopeMode.textContent = "WIDEBAND";
    log("receiver online");
    log("band sweep available");
    updateFrequencyUI();
  }

  function powerOff() {
    state.powered = false;
    stopScan();
    stopTargetSequence();
    els.powerBtn.textContent = "POWER";
    els.channelLabel.textContent = "RECEIVER OFFLINE";
    els.captureBtn.disabled = true;
    els.scopeMode.textContent = "IDLE";
    setStatus("OFFLINE");
    document.body.classList.remove("echo-event");
    tuneAudio();
    updateFrequencyUI();
    log("receiver offline");
  }

  function startScan() {
    if (!state.powered || state.scanning) return;
    state.scanning = true;
    els.scanBtn.textContent = "STOP SCAN";
    setStatus("SCANNING", "live");
    log("automatic sweep started");
    state.scanTimer = setInterval(() => {
      let f = state.frequency + 0.1;
      if (f > 108) f = 87.5;
      setFrequency(f);
      if (Math.abs(f - TARGET) < 0.051) {
        stopScan();
        log("sweep halted: anomalous carrier", "warn");
      }
    }, 95);
  }

  function stopScan() {
    clearInterval(state.scanTimer);
    state.scanTimer = null;
    state.scanning = false;
    els.scanBtn.textContent = "AUTO SCAN";
    if (state.powered && !exactTarget()) setStatus("MONITORING", "live");
  }

  function captureCurrent() {
    if (!state.powered || !exactTarget()) return;
    const patterns = [
      "E1/CARRIER: TH— TR—TH —S —N TH— ST—T—C",
      "E1/BURST: G/-7 :: 101.1 :: EAST",
      "E1/VOICE: J—NAH / [LOSS] / ANSWER IT",
      "E1/TIME: 23:14:09 / RELAY-04"
    ];
    const ix = state.captures.length % patterns.length;
    const cap = {
      id: Date.now().toString(36).toUpperCase(),
      frequency: state.frequency.toFixed(1),
      stamp: new Date().toISOString(),
      payload: patterns[ix]
    };
    state.captures.push(cap);
    state.captures = state.captures.slice(-20);
    state.discovered[patterns[ix]] = true;
    saveState();
    renderCaptures();
    log("transmission fragment committed to local archive", "rx");
  }

  function renderCaptures() {
    els.captureCount.textContent = `${state.captures.length} CAPTURE${state.captures.length === 1 ? "" : "S"}`;
    els.captures.replaceChildren();
    if (!state.captures.length) {
      els.captures.classList.add("empty");
      const p = document.createElement("p");
      p.textContent = "No recoverable transmissions.";
      els.captures.appendChild(p);
      return;
    }
    els.captures.classList.remove("empty");
    [...state.captures].reverse().forEach((cap) => {
      const div = document.createElement("div");
      div.className = "capture";
      const strong = document.createElement("strong");
      strong.textContent = `[${cap.frequency} MHz] ${cap.payload}`;
      const small = document.createElement("small");
      small.textContent = `REC ${cap.id} // ${new Date(cap.stamp).toLocaleString()}`;
      div.append(strong, small);
      els.captures.appendChild(div);
    });
  }

  async function sha256(value) {
    const bytes = new TextEncoder().encode(value);
    const hash = await crypto.subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  function terminalPrint(text, cls = "") {
    const p = document.createElement("p");
    if (cls) p.className = cls;
    p.textContent = text;
    els.terminalOutput.appendChild(p);
    while (els.terminalOutput.children.length > 80) els.terminalOutput.firstElementChild.remove();
    els.terminalOutput.scrollTop = els.terminalOutput.scrollHeight;
  }

  function terminalDivider() {
    terminalPrint("--------------------------------", "ghost");
  }

  async function terminalCommand(raw) {
    const cmd = raw.trim();
    if (!cmd) return;
    terminalPrint("> " + cmd.toUpperCase(), "ghost");

    const upper = cmd.toUpperCase();
    if (upper === "HELP" || upper === "?") {
      terminalPrint("AVAILABLE: STATUS / DIR / READ <ID> / AUTH <TOKEN> / CLEAR");
      return;
    }
    if (upper === "CLEAR") {
      els.terminalOutput.replaceChildren();
      return;
    }
    if (upper === "STATUS") {
      terminalPrint("NODE EAST-RELAY-04 // ONLINE");
      terminalPrint("INDEX: 3.8% RECOVERABLE");
      terminalPrint("AUTH: " + (state.archiveUnlocked ? "PARTIAL" : "REQUIRED"));
      terminalPrint("LAST MAINTENANCE: [CORRUPT]");
      return;
    }
    if (upper === "DIR") {
      terminalPrint("INDEX LIST:");
      terminalPrint("  0000  PUBLIC_NOTICE");
      terminalPrint("  0007  MAINT_LEDGER");
      terminalPrint("  0041  [RESTRICTED]");
      if (state.archiveUnlocked) terminalPrint("  0023  CALL_ROUTER_LOG", "ok");
      if (state.archiveUnlocked) terminalPrint("  0024  MAIL_EVIDENCE", "ok");
      if (state.archiveUnlocked) terminalPrint("  0031  SIGNAL_LAB_1987", "ok");
      if (state.discovered.signalLab) terminalPrint("  0032  SPECTRAL_RESIDUE", "ok");
      if (state.discovered.spectralResidue) terminalPrint("  0060  CRYPTO_PACKET_6", "ok");
      if (state.archiveUnlocked) terminalPrint("  0050  HERMAN_CASEBOARD", "ok");
      if (state.archiveUnlocked) terminalPrint("  0114  EAST_TOWER_2314", "ok");
      return;
    }
    if (upper === "READ 0000" || upper === "READ PUBLIC_NOTICE") {
      terminalDivider();
      terminalPrint("RAVENSWOOD MUNICIPAL COMMUNICATIONS");
      terminalPrint("Routine receiver maintenance. Reports of voices on unused channels are attributed to atmospheric interference.");
      terminalPrint("Do not contact the relay office after 23:00.");
      terminalPrint("PUBLIC MIRROR: /ARG/ravenswood/index.html", "ok");
      terminalDivider();
      return;
    }
    if (upper === "READ 0007" || upper === "READ MAINT_LEDGER") {
      terminalDivider();
      terminalPrint("LEDGER 0007 // PARTIAL");
      terminalPrint("G-3 .... PASS");
      terminalPrint("G-4 .... PASS");
      terminalPrint("G-5 .... [NULL]");
      terminalPrint("G-6 .... PASS");
      terminalPrint("G-7 .... SEALED / SOURCE MISMATCH", "error");
      terminalPrint("G-8 .... PASS");
      terminalDivider();
      return;
    }
    if (upper === "READ 0023" || upper === "READ CALL_ROUTER_LOG") {
      if (!state.archiveUnlocked) {
        terminalPrint("ACCESS DENIED // INDEX KEY REQUIRED", "error");
        return;
      }
      terminalDivider();
      terminalPrint("CALL ROUTER LOG // RECOVERED LOCAL EMULATION");
      terminalPrint("FIRST EVENT: 00:03:11 // INBOUND ROUTE NONE");
      terminalPrint("ARCHIVE MIRROR: /ARG/calls/index.html", "ok");
      terminalPrint("NOTE: NO LIVE TELEPHONE CONNECTION.");
      terminalDivider();
      state.discovered.callArchive = true;
      saveState();
      return;
    }
    if (upper === "READ 0024" || upper === "READ MAIL_EVIDENCE") {
      if (!state.archiveUnlocked) {
        terminalPrint("ACCESS DENIED // INDEX KEY REQUIRED", "error");
        return;
      }
      terminalDivider();
      terminalPrint("MAIL EVIDENCE // PERSONAL EFFECTS MIRROR");
      terminalPrint("ITEMS RELEASE AS RELATED CASE FLAGS ARE RECOVERED.");
      terminalPrint("ARCHIVE MIRROR: /ARG/mail/index.html", "ok");
      terminalPrint("NOTE: DIGITAL RECONSTRUCTION ONLY.");
      terminalDivider();
      state.discovered.mailArchive = true;
      saveState();
      return;
    }
    if (upper === "READ 0031" || upper === "READ SIGNAL_LAB_1987") {
      if (!state.archiveUnlocked) {
        terminalPrint("ACCESS DENIED // INDEX KEY REQUIRED", "error");
        return;
      }
      terminalDivider();
      terminalPrint("RECOVERED SIGNAL DUB // RWD-1987-04");
      terminalPrint("OBJECT CONTAINS DUAL-TONE DATA BURSTS.");
      terminalPrint("ANALYSIS BENCH: /ARG/lab/index.html", "ok");
      terminalPrint("RELATED PAPER INDEX IS NOT PRESENT IN CURRENT DIRECTORY.");
      terminalDivider();
      state.discovered.signalLabIndex = true;
      saveState();
      return;
    }
    if (upper === "READ 0050" || upper === "READ HERMAN_CASEBOARD") {
      if (!state.archiveUnlocked) {
        terminalPrint("ACCESS DENIED // INDEX KEY REQUIRED", "error");
        return;
      }
      terminalDivider();
      terminalPrint("HERMAN LOCAL CASEBOARD // BROWSER STATE MIRROR");
      terminalPrint("ONLY COMMITTED EVIDENCE NODES ARE DISPLAYED.");
      terminalPrint("WORKING BOARD: /ARG/caseboard/index.html", "ok");
      terminalDivider();
      state.discovered.caseboard = true;
      saveState();
      return;
    }
    if (upper === "READ 0032" || upper === "READ SPECTRAL_RESIDUE") {
      if (!state.discovered.signalLab) {
        terminalPrint("FILE NOT FOUND", "error");
        return;
      }
      terminalDivider();
      terminalPrint("AUXILIARY SPECTRAL CHANNEL // RWD-1987-04");
      terminalPrint("IMAGE RECONSTRUCTION BENCH: /ARG/spectral/index.html", "ok");
      terminalPrint("SOURCE CLASS: NONSPEECH / FREQUENCY-DOMAIN RESIDUE.");
      terminalDivider();
      return;
    }
    if (upper === "READ 0060" || upper === "READ CRYPTO_PACKET_6") {
      if (!state.discovered.spectralResidue) {
        terminalPrint("FILE NOT FOUND", "error");
        return;
      }
      terminalDivider();
      terminalPrint("PACKET 6 // HAND-ENCODED MAINTENANCE RESIDUE");
      terminalPrint("FOUR FRAGMENTS // PLAINTEXT HASH VERIFICATION");
      terminalPrint("CRYPTO DESK: /ARG/crypto/index.html", "ok");
      terminalDivider();
      return;
    }
    if (upper === "READ 0041") {
      if (!state.archiveUnlocked) {
        terminalPrint("ACCESS DENIED // INDEX KEY REQUIRED", "error");
        return;
      }
      terminalDivider();
      terminalPrint("CASE 041 // JONAH [SURNAME CORRUPT]");
      terminalPrint("STATUS: MISSING");
      terminalPrint("LAST VERIFIED SIGHTING: 22:52 // EAST DISTRICT");
      terminalPrint("EVIDENCE STILL: /ARG/rwd/041.html", "ok");
      terminalPrint("NOTE: IMAGE BRIGHTNESS DATA DOES NOT MATCH CAMERA RECORD.");
      terminalDivider();
      state.discovered.case041 = true;
      saveState();
      return;
    }
    if (upper === "READ 0114" || upper === "READ EAST_TOWER_2314") {
      if (!state.archiveUnlocked) {
        terminalPrint("FILE NOT FOUND", "error");
        return;
      }
      terminalDivider();
      terminalPrint("RECOVERY 0114 // EAST TOWER");
      terminalPrint("23:14:09 — unauthorized carrier handshake.");
      terminalPrint("23:14:12 — juvenile voice detected. ID confidence 61%.");
      terminalPrint("23:14:17 — relay began receiving before transmitter key-down.", "error");
      terminalPrint("23:14:31 — operator note: THE WALL ANSWERED FIRST.");
      terminalPrint("Attachment checksum: 5-25-5 / 19-20-1-20-9-3");
      terminalDivider();
      state.discovered.eastTower = true;
      saveState();
      return;
    }
    if (upper.startsWith("AUTH ")) {
      const token = upper.slice(5).trim();
      const digest = await sha256(token);
      if (digest === ARCHIVE_HASH) {
        if (!state.archiveUnlocked) {
          state.archiveUnlocked = true;
          saveState();
          els.terminalState.textContent = "INDEX PARTIAL";
          terminalPrint("TOKEN ACCEPTED.", "ok");
          terminalPrint("CORRUPTED INDEX SECTOR MOUNTED.", "ok");
          terminalPrint("1 ADDITIONAL FILE RECOVERED.");
          terminalPrint("DIRECTORY TABLE UPDATED.");
        } else {
          terminalPrint("TOKEN ALREADY ACCEPTED.", "ghost");
        }
      } else {
        terminalPrint("TOKEN REJECTED.", "error");
      }
      return;
    }

    terminalPrint("UNKNOWN COMMAND", "error");
  }

  els.powerBtn.addEventListener("click", () => state.powered ? powerOff() : powerOn());
  els.tuner.addEventListener("input", () => {
    if (state.scanning) stopScan();
    updateFrequencyUI();
  });
  els.stepDown.addEventListener("click", () => setFrequency(state.frequency - 0.1));
  els.stepUp.addEventListener("click", () => setFrequency(state.frequency + 0.1));
  els.scanBtn.addEventListener("click", () => state.scanning ? stopScan() : startScan());
  els.captureBtn.addEventListener("click", captureCurrent);
  els.muteBtn.addEventListener("click", () => {
    state.muted = !state.muted;
    els.muteBtn.textContent = state.muted ? "UNMUTE" : "MUTE";
    tuneAudio();
    log(state.muted ? "audio monitor muted" : "audio monitor restored");
  });
  els.clearTranscript.addEventListener("click", () => els.transcript.replaceChildren());
  els.terminalForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const raw = els.terminalInput.value;
    els.terminalInput.value = "";
    await terminalCommand(raw);
  });

  // Keyboard receiver control intentionally mirrors physical tuner behavior.
  window.addEventListener("keydown", (e) => {
    if (document.activeElement === els.terminalInput) return;
    if (e.key === "ArrowLeft") setFrequency(state.frequency - 0.1);
    if (e.key === "ArrowRight") setFrequency(state.frequency + 0.1);
  });

  const ctx = els.canvas.getContext("2d", { alpha: false });
  let lastScope = 0;

  function resizeCanvasBackingStore() {
    const rect = els.canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(500, Math.floor(rect.width * dpr));
    const h = Math.max(260, Math.floor(rect.height * dpr));
    if (els.canvas.width !== w || els.canvas.height !== h) {
      const old = document.createElement("canvas");
      old.width = els.canvas.width;
      old.height = els.canvas.height;
      old.getContext("2d").drawImage(els.canvas, 0, 0);
      els.canvas.width = w;
      els.canvas.height = h;
      ctx.fillStyle = "#010302";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(old, 0, 0, old.width, old.height, 0, 4, w, h - 4);
    }
  }

  function freqToX(freq) {
    return ((freq - 87.5) / (108 - 87.5)) * els.canvas.width;
  }

  function drawWaterfall(ts) {
    requestAnimationFrame(drawWaterfall);
    if (ts - lastScope < 46) return;
    lastScope = ts;
    resizeCanvasBackingStore();

    const w = els.canvas.width;
    const h = els.canvas.height;
    ctx.drawImage(els.canvas, 0, 0, w, h - 2, 0, 2, w, h - 2);

    const row = ctx.createImageData(w, 2);
    const targetX = freqToX(TARGET);
    const tunedX = freqToX(state.frequency);

    for (let x = 0; x < w; x++) {
      const proximityToEcho = Math.exp(-Math.pow((x - targetX) / Math.max(4, w * 0.005), 2));
      const proximityToTune = Math.exp(-Math.pow((x - tunedX) / Math.max(5, w * 0.008), 2));
      let v = state.powered ? 9 + Math.random() * 18 : 2 + Math.random() * 3;
      if (state.powered) v += proximityToTune * 12;
      if (state.powered && !state.discovered.ending_isolate && Math.abs(state.frequency - TARGET) < 1.2) v += proximityToEcho * (35 + signalStrength() * 155);
      if (state.powered && !state.discovered.ending_isolate && exactTarget() && Math.sin(ts / 240) > 0.72) v += proximityToEcho * 62;
      v = Math.max(0, Math.min(255, v));

      const green = Math.min(255, v * 1.5);
      const blue = Math.min(255, v * 0.72);
      for (let y = 0; y < 2; y++) {
        const i = (y * w + x) * 4;
        row.data[i] = Math.floor(v * 0.28);
        row.data[i + 1] = Math.floor(green);
        row.data[i + 2] = Math.floor(blue);
        row.data[i + 3] = 255;
      }
    }
    ctx.putImageData(row, 0, 0);

    if (state.powered && !state.discovered.ending_isolate && exactTarget() && Math.random() < 0.025) {
      ctx.fillStyle = "rgba(190,255,202,.28)";
      const width = 2 + Math.random() * 9;
      ctx.fillRect(targetX - width / 2, 0, width, 2);
    }
  }

  requestAnimationFrame(drawWaterfall);

  setInterval(() => {
    if (!state.powered) return;
    const strength = signalStrength();
    els.signalFill.style.width = Math.round(strength * 100) + "%";
    els.signalText.textContent = Math.round(strength * 100) + "%";
  }, 120);

  loadState();
  updateFrequencyUI();
})();