import * as vscode from "vscode";

let currentTimer: NodeJS.Timeout | undefined;
let isRunning = false;
let contextGlobal: vscode.ExtensionContext;
let statusBarItem: vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext) {
  contextGlobal = context;

  // Inisialisasi status bar item
  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    100
  );
  statusBarItem.command = "pomodoro.start";
  statusBarItem.text = `🍅 Start Pomodoro`;
  statusBarItem.tooltip = "Start 25-minute Pomodoro session 💪";
  statusBarItem.show();

  const startCommand = vscode.commands.registerCommand("pomodoro.start", () => {
    if (isRunning) {
      vscode.window.showInformationMessage("Pomodoro already running!");
      return;
    }

    isRunning = true;
    startPomodoroSession();
  });

  const stopCommand = vscode.commands.registerCommand("pomodoro.stop", () => {
    stopAllTimers();
    vscode.window.showInformationMessage("Pomodoro stopped.");
  });

  context.subscriptions.push(startCommand, stopCommand, statusBarItem);
}

function startPomodoroSession() {
  vscode.window.showInformationMessage(
    "Pomodoro started! 25 minutes of focus."
  );
  let timeLeft = 25 * 60;
  // let timeLeft = 1 * 10;

  updateStatusBar(timeLeft);

  currentTimer = setInterval(() => {
    timeLeft--;
    updateStatusBar(timeLeft);

    if (timeLeft <= 0) {
      clearInterval(currentTimer);
      statusBarItem.text = `$(clock) Break Time!`;
      vscode.window.showInformationMessage(
        "Time's up! Take a 5-minute break 🍵"
      );
      startBreakSession();
    }
  }, 1000);
}

function updateStatusBar(timeLeft: number) {
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  statusBarItem.text = `🍅 ${String(minutes).padStart(2, "0")}:${String(
    seconds
  ).padStart(2, "0")}`;
}

function startBreakSession() {
  let panel = vscode.window.createWebviewPanel(
    "breakTimer",
    "Break Time ⏳",
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(contextGlobal.extensionUri, "media"),
      ],
    }
  );

  const breakDuration = 5 * 60;
  // const breakDuration = 1 * 15;

  panel.webview.html = getBreakHtml(breakDuration, panel);

  currentTimer = setInterval(() => {
    panel.webview.postMessage({ command: "tick" });
  }, 1000);

  panel.webview.onDidReceiveMessage((message) => {
    if (message.command === "done") {
      clearInterval(currentTimer);
      panel.dispose();

      if (isRunning) {
        vscode.window.showInformationMessage(
          "Break is over! Starting next Pomodoro 🧠"
        );
        startPomodoroSession();
      }
    }
  });

  panel.onDidDispose(() => {
    clearInterval(currentTimer);
  });
}

function stopAllTimers() {
  isRunning = false;
  if (currentTimer) {
    clearInterval(currentTimer);
    currentTimer = undefined;
  }
  statusBarItem.text = `🍅 Start Pomodoro`;
}

function getBreakHtml(duration: number, panel: vscode.WebviewPanel): string {
  const imageList = ["nature1.jpg", "nature2.jpg", "nature3.jpg"];
  const randomImage = imageList[Math.floor(Math.random() * imageList.length)];
  const imageUri = panel.webview.asWebviewUri(
    vscode.Uri.joinPath(contextGlobal.extensionUri, "media", randomImage)
  );
  const audioUri = panel.webview.asWebviewUri(
    vscode.Uri.joinPath(contextGlobal.extensionUri, "media", "sound.mp3")
  );

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Break Timer</title>
  <style>
    body {
      margin: 0;
      font-family: 'Segoe UI', sans-serif;
      background: url('${imageUri}') no-repeat center center/cover;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
      color: #ffffff;
      text-shadow: 1px 1px 3px rgba(0,0,0,0.5);
    }
    h1 {
      font-size: 3rem;
      margin-bottom: 0.5rem;
    }
    #timer {
      font-size: 4rem;
      background: rgba(0,0,0,0.5);
      padding: 1rem 2rem;
      border-radius: 10px;
    }
    #message {
      margin-top: 1.5rem;
      font-size: 1.5rem;
      padding: 0.5rem 1rem;
      background: rgba(0,0,0,0.3);
      border-radius: 8px;
      text-align: center;
      max-width: 90%;
    }
    .breathing-circle {
      width: 120px;
      height: 120px;
      border-radius: 50%;
      background: rgba(255,255,255,0.3);
      animation: breathe 4s ease-in-out infinite;
      margin-top: 2rem;
      position: relative; /* Tambahkan ini */
    }

    #toggle-audio {
      position: absolute;   /* Tambahkan ini */
      top: 50%;             /* Tambahkan ini */
      left: 50%;            /* Tambahkan ini */
      transform: translate(-50%, -50%); /* Tambahkan ini */
      background: rgba(0, 0, 0, 0.4);
      border: none;
      color: white;
      font-size: 1.5rem;
      border-radius: 50%;
      width: 60px;
      height: 60px;
      cursor: pointer;
    }

    @keyframes breathe {
      0% { transform: scale(1); }
      50% { transform: scale(1.4); }
      100% { transform: scale(1); }
    }
  </style>
</head>
<body>
  <h1>Istirahat Dulu Yuk 🍃</h1>
  <div id="timer">00:00</div>
  <div id="message">Relax and enjoy your break...</div>
  <div class="breathing-circle" id="circle-control">
    <button id="toggle-audio" title="Play/Pause Music">▶️</button>
  </div>

  <audio id="break-audio" loop muted>
    <source src="${audioUri}" type="audio/mpeg" />
    Your browser does not support the audio element.
  </audio>

  <script>
    const vscode = acquireVsCodeApi();
    const audio = document.getElementById("break-audio");
    const toggleButton = document.getElementById("toggle-audio");

    let timeLeft = ${duration};

    function playAudio() {
      if (audio.paused) {
        audio.muted = false;
        audio.currentTime = 0;
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch((err) => {
            console.warn("Autoplay blocked:", err);
          });
        }
        toggleButton.textContent = "⏸️";
      }
    }

    function pauseAudio() {
      audio.pause();
      toggleButton.textContent = "▶️";
    }

    // Tombol play/pause toggle
    toggleButton.addEventListener("click", () => {
      if (audio.paused) {
        playAudio();
      } else {
        pauseAudio();
      }
    });

    // Coba autoplay dengan delay untuk menghindari pemblokiran autoplay
    window.addEventListener("load", () => {
      setTimeout(() => {
        pauseAudio();
      }, 500);
    });

    const messages = [
      "Waktu istirahat! Tarik napas dalam-dalam.",
      "Santai sejenak. Kamu hebat!",
      "Tutup mata sejenak, relaksasikan bahumu.",
      "Minum air putih 💧 dan istirahatkan mata.",
      "Break ini milikmu. Nikmati! 🌿",
    ];
    let msgIndex = 0;

    function updateTimer() {
      const minutes = Math.floor(timeLeft / 60);
      const seconds = timeLeft % 60;
      document.getElementById("timer").textContent =
        String(minutes).padStart(2, "0") + ":" + String(seconds).padStart(2, "0");
    }

    function updateMessage() {
      const messageEl = document.getElementById("message");
      messageEl.textContent = messages[msgIndex];
      msgIndex = (msgIndex + 1) % messages.length;
    }

    updateTimer();
    updateMessage();

    setInterval(updateMessage, 5000);

    window.addEventListener("message", (event) => {
      if (event.data.command === "tick") {
        timeLeft--;
        updateTimer();
        if (timeLeft <= 0) {
          vscode.postMessage({ command: "done" });
        }
      }
    });
  </script>
</body>
</html>`;
}

export function deactivate() {
  stopAllTimers();
}
