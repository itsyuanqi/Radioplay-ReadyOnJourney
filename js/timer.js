let timerEl = document.getElementById("timeDisplay");
let recordsEl = document.getElementById("records");
let records = [];
let running = false;
let startTime = 0;
let elapsed = 0;

function updateTimer() {
    let h = String(Math.floor(elapsed / 3600000)).padStart(2, '0');
    let m = String(Math.floor((elapsed % 3600000) / 60000)).padStart(2, '0');
    let s = String(Math.floor((elapsed % 60000) / 1000)).padStart(2, '0');
    let ms = String(Math.floor((elapsed % 1000) / 10)).padStart(2, '0');
    timerEl.textContent = `${m}:${s}.${ms}`;
}

function tick() {
    if (!running) return;
    elapsed = performance.now() - startTime;
    updateTimer();
    requestAnimationFrame(tick);
}

function startTimer() {
    if (running) return;
    running = true;
    startTime = performance.now() - elapsed;
    requestAnimationFrame(tick);
}

function pauseTimer() {
    running = false;
}

function resetTimer() {
    pauseTimer();
    elapsed = 0;
    updateTimer();
    records = [];
    recordsEl.innerHTML = "";
}

function markTime() {
    let current = timerEl.textContent;
    records.push(current);

    // 避免 innerHTML 大量重排，逐行 append
    const div = document.createElement("div");
    div.textContent = `${records.length}. ${current}`;
    recordsEl.appendChild(div);
}

// 初始化
updateTimer();


let isDragging = false;
let offsetX = 0,
    offsetY = 0;

timerBox.addEventListener("mousedown", (e) => {
    isDragging = true;
    timerBox.classList.add("dragging");
    // 记录鼠标相对 box 的位置
    offsetX = e.clientX - timerBox.getBoundingClientRect().left;
    offsetY = e.clientY - timerBox.getBoundingClientRect().top;
    e.preventDefault();
});

document.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    // 更新位置
    timerBox.style.left = (e.clientX - offsetX) + "px";
    timerBox.style.top = (e.clientY - offsetY) + "px";
    timerBox.style.right = "auto"; // 禁止 right/top 冲突
});

document.addEventListener("mouseup", () => {
    if (isDragging) {
        isDragging = false;
        timerBox.classList.remove("dragging");
    }
});