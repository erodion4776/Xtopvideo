// ===== STATE MANAGEMENT =====
const state = {
    audio: null,
    audioBuffer: null,
    audioContext: null,
    analyser: null,
    sourceNode: null,
    duration: 0,
    isPlaying: false,
    currentTime: 0,
    captions: [],
    settings: {
        resolution: [1280, 720],
        fps: 30,
        bgType: 'gradient',
        gradColor1: '#667eea',
        gradColor2: '#764ba2',
        animateGradient: true,
        solidColor: '#1a1a2e',
        bgImage: null,
        captionFont: 'Poppins',
        captionSize: 48,
        captionColor: '#ffffff',
        highlightColor: '#ffdd57',
        textShadow: 'soft',
        captionAnimation: 'fadeIn',
        captionPosition: 'center',
        showWaveform: true,
        showProgress: true,
        progressColor: '#ffdd57'
    },
    animationId: null,
    startTimestamp: 0,
    bgImageObj: null
};

// ===== DOM ELEMENTS =====
const $ = id => document.getElementById(id);
const canvas = $('previewCanvas');
const ctx = canvas.getContext('2d');

// ===== INITIALIZE =====
function init() {
    setupAudioUpload();
    setupControls();
    setupCaptionEditor();
    setupExport();
    resizeCanvas();
}

// ===== AUDIO UPLOAD =====
function setupAudioUpload() {
    const dropZone = $('audioDropZone');
    const audioInput = $('audioInput');

    dropZone.addEventListener('click', () => audioInput.click());

    dropZone.addEventListener('dragover', e => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', e => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        if (e.dataTransfer.files[0]) loadAudio(e.dataTransfer.files[0]);
    });

    audioInput.addEventListener('change', e => {
        if (e.target.files[0]) loadAudio(e.target.files[0]);
    });
}

async function loadAudio(file) {
    state.audio = file;

    // Show file info
    $('audioFileName').textContent = file.name;
    $('audioInfo').classList.remove('hidden');

    // Create audio context
    if (!state.audioContext) {
        state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    // Decode audio
    const arrayBuffer = await file.arrayBuffer();
    state.audioBuffer = await state.audioContext.decodeAudioData(arrayBuffer);
    state.duration = state.audioBuffer.duration;

    $('audioDuration').textContent = formatTime(state.duration);
    $('totalTime').textContent = formatTime(state.duration);
    $('previewOverlay').classList.add('hidden');

    // Setup audio player
    const audioPlayer = $('audioPlayer');
    audioPlayer.src = URL.createObjectURL(file);

    // Setup analyser
    state.analyser = state.audioContext.createAnalyser();
    state.analyser.fftSize = 256;

    // Enable buttons
    $('playBtn').disabled = false;
    $('exportBtn').disabled = false;

    // Setup scrubber
    $('scrubber').max = state.duration;

    resizeCanvas();
    renderFrame(0);
}

// ===== CONTROLS =====
function setupControls() {
    // Resolution
    $('resolution').addEventListener('change', e => {
        const [w, h] = e.target.value.split('x').map(Number);
        state.settings.resolution = [w, h];
        resizeCanvas();
        renderFrame(state.currentTime);
    });

    // FPS
    $('fps').addEventListener('change', e => {
        state.settings.fps = parseInt(e.target.value);
    });

    // Background type
    document.querySelectorAll('.bg-option').forEach(opt => {
        opt.addEventListener('click', () => {
            document.querySelectorAll('.bg-option').forEach(o => o.classList.remove('active'));
            opt.classList.add('active');
            state.settings.bgType = opt.dataset.bg;

            $('gradientOptions').classList.toggle('hidden', state.settings.bgType !== 'gradient');
            $('solidOptions').classList.toggle('hidden', state.settings.bgType !== 'solid');
            $('imageOptions').classList.toggle('hidden', state.settings.bgType !== 'image');

            renderFrame(state.currentTime);
        });
    });

    // Gradient colors
    $('gradColor1').addEventListener('input', e => {
        state.settings.gradColor1 = e.target.value;
        renderFrame(state.currentTime);
    });
    $('gradColor2').addEventListener('input', e => {
        state.settings.gradColor2 = e.target.value;
        renderFrame(state.currentTime);
    });
    $('animateGradient').addEventListener('change', e => {
        state.settings.animateGradient = e.target.checked;
    });

    // Solid color
    $('solidColor').addEventListener('input', e => {
        state.settings.solidColor = e.target.value;
        renderFrame(state.currentTime);
    });

    // Background image
    $('bgImageInput').addEventListener('change', e => {
        const file = e.target.files[0];
        if (file) {
            const img = new Image();
            img.onload = () => {
                state.bgImageObj = img;
                renderFrame(state.currentTime);
            };
            img.src = URL.createObjectURL(file);
        }
    });

    // Caption settings
    $('captionFont').addEventListener('change', e => {
        state.settings.captionFont = e.target.value;
        renderFrame(state.currentTime);
    });

    $('captionSize').addEventListener('input', e => {
        state.settings.captionSize = parseInt(e.target.value);
        $('fontSizeVal').textContent = e.target.value;
        renderFrame(state.currentTime);
    });

    $('captionColor').addEventListener('input', e => {
        state.settings.captionColor = e.target.value;
        renderFrame(state.currentTime);
    });

    $('highlightColor').addEventListener('input', e => {
        state.settings.highlightColor = e.target.value;
        renderFrame(state.currentTime);
    });

    $('textShadow').addEventListener('change', e => {
        state.settings.textShadow = e.target.value;
        renderFrame(state.currentTime);
    });

    $('captionAnimation').addEventListener('change', e => {
        state.settings.captionAnimation = e.target.value;
        renderFrame(state.currentTime);
    });

    $('captionPosition').addEventListener('change', e => {
        state.settings.captionPosition = e.target.value;
        renderFrame(state.currentTime);
    });

    // Elements
    $('showWaveform').addEventListener('change', e => {
        state.settings.showWaveform = e.target.checked;
        renderFrame(state.currentTime);
    });

    $('showProgress').addEventListener('change', e => {
        state.settings.showProgress = e.target.checked;
        renderFrame(state.currentTime);
    });

    $('progressColor').addEventListener('input', e => {
        state.settings.progressColor = e.target.value;
        renderFrame(state.currentTime);
    });

    // Playback
    $('playBtn').addEventListener('click', togglePlayback);

    $('scrubber').addEventListener('input', e => {
        state.currentTime = parseFloat(e.target.value);
        $('currentTime').textContent = formatTime(state.currentTime);
        if (!state.isPlaying) renderFrame(state.currentTime);
    });
}

// ===== PLAYBACK =====
function togglePlayback() {
    if (state.isPlaying) {
        stopPlayback();
    } else {
        startPlayback();
    }
}

function startPlayback() {
    if (!state.audioBuffer) return;

    state.isPlaying = true;
    $('playBtn').textContent = '⏸️';

    // Create audio source
    state.sourceNode = state.audioContext.createBufferSource();
    state.sourceNode.buffer = state.audioBuffer;

    // Connect analyser
    state.sourceNode.connect(state.analyser);
    state.analyser.connect(state.audioContext.destination);

    // Start from current position
    const offset = state.currentTime;
    state.startTimestamp = state.audioContext.currentTime - offset;
    state.sourceNode.start(0, offset);

    state.sourceNode.onended = () => {
        if (state.isPlaying) stopPlayback();
    };

    // Animation loop
    function animate() {
        if (!state.isPlaying) return;

        state.currentTime = state.audioContext.currentTime - state.startTimestamp;

        if (state.currentTime >= state.duration) {
            stopPlayback();
            return;
        }

        $('scrubber').value = state.currentTime;
        $('currentTime').textContent = formatTime(state.currentTime);

        renderFrame(state.currentTime);
        state.animationId = requestAnimationFrame(animate);
    }

    animate();
}

function stopPlayback() {
    state.isPlaying = false;
    $('playBtn').textContent = '▶️';

    if (state.sourceNode) {
        try { state.sourceNode.stop(); } catch(e) {}
        state.sourceNode = null;
    }

    if (state.animationId) {
        cancelAnimationFrame(state.animationId);
        state.animationId = null;
    }
}

// ===== CANVAS RENDERING =====
function resizeCanvas() {
    const [w, h] = state.settings.resolution;
    canvas.width = w;
    canvas.height = h;

    // Scale preview
    const container = canvas.parentElement;
    const maxW = container.clientWidth;
    const maxH = window.innerHeight * 0.45;
    const scale = Math.min(maxW / w, maxH / h, 1);
    canvas.style.width = (w * scale) + 'px';
    canvas.style.height = (h * scale) + 'px';
}

function renderFrame(time) {
    const w = canvas.width;
    const h = canvas.height;
    const s = state.settings;

    ctx.clearRect(0, 0, w, h);

    // ===== BACKGROUND =====
    drawBackground(w, h, time);

    // ===== WAVEFORM =====
    if (s.showWaveform) {
        drawWaveform(w, h);
    }

    // ===== PROGRESS BAR =====
    if (s.showProgress && state.duration > 0) {
        drawProgressBar(w, h, time);
    }

    // ===== CAPTIONS =====
    drawCaptions(w, h, time);
}

function drawBackground(w, h, time) {
    const s = state.settings;

    switch (s.bgType) {
        case 'gradient': {
            const angle = s.animateGradient ? (time * 30) % 360 : 135;
            const rad = (angle * Math.PI) / 180;
            const x1 = w/2 + Math.cos(rad) * w/2;
            const y1 = h/2 + Math.sin(rad) * h/2;
            const x2 = w/2 - Math.cos(rad) * w/2;
            const y2 = h/2 - Math.sin(rad) * h/2;

            const grad = ctx.createLinearGradient(x1, y1, x2, y2);
            grad.addColorStop(0, s.gradColor1);
            grad.addColorStop(1, s.gradColor2);
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, w, h);
            break;
        }
        case 'solid': {
            ctx.fillStyle = s.solidColor;
            ctx.fillRect(0, 0, w, h);
            break;
        }
        case 'image': {
            if (state.bgImageObj) {
                const img = state.bgImageObj;
                const scale = Math.max(w / img.width, h / img.height);
                const iw = img.width * scale;
                const ih = img.height * scale;
                ctx.drawImage(img, (w - iw) / 2, (h - ih) / 2, iw, ih);
                // Dark overlay
                ctx.fillStyle = 'rgba(0,0,0,0.4)';
                ctx.fillRect(0, 0, w, h);
            } else {
                ctx.fillStyle = '#111';
                ctx.fillRect(0, 0, w, h);
            }
            break;
        }
        case 'particles': {
            ctx.fillStyle = '#0a0a1a';
            ctx.fillRect(0, 0, w, h);
            drawParticles(w, h, time);
            break;
        }
    }
}

function drawParticles(w, h, time) {
    const count = 50;
    for (let i = 0; i < count; i++) {
        const seed = i * 137.508;
        const x = ((seed * 1.1 + time * 20 * (i % 3 + 1)) % w);
        const y = ((seed * 0.7 + time * 15 * ((i + 1) % 3 + 1)) % h);
        const size = 2 + (i % 4);
        const alpha = 0.2 + (Math.sin(time * 2 + i) + 1) * 0.3;

        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(102, 126, 234, ${alpha})`;
        ctx.fill();
    }
}

function drawWaveform(w, h) {
    if (!state.analyser || !state.isPlaying) {
        // Draw static waveform
        drawStaticWaveform(w, h);
        return;
    }

    const bufferLength = state.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    state.analyser.getByteFrequencyData(dataArray);

    const barWidth = w / bufferLength * 2;
    const centerY = h * 0.75;
    const maxBarHeight = h * 0.15;

    ctx.save();
    for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * maxBarHeight;
        const x = i * barWidth;

        const gradient = ctx.createLinearGradient(0, centerY - barHeight, 0, centerY + barHeight);
        gradient.addColorStop(0, state.settings.highlightColor);
        gradient.addColorStop(0.5, state.settings.captionColor);
        gradient.addColorStop(1, state.settings.highlightColor);

        ctx.fillStyle = gradient;
        ctx.globalAlpha = 0.6;
        ctx.fillRect(x, centerY - barHeight / 2, barWidth - 1, barHeight);
    }
    ctx.restore();
}

function drawStaticWaveform(w, h) {
    const bars = 60;
    const barWidth = w / bars * 0.6;
    const centerY = h * 0.75;
    const maxHeight = h * 0.06;

    ctx.save();
    ctx.globalAlpha = 0.2;
    for (let i = 0; i < bars; i++) {
        const x = (w / bars) * i + (w / bars) * 0.2;
        const barH = maxHeight * (0.3 + Math.random() * 0.7);
        ctx.fillStyle = state.settings.captionColor;
        ctx.fillRect(x, centerY - barH / 2, barWidth, barH);
    }
    ctx.restore();
}

function drawProgressBar(w, h, time) {
    const progress = state.duration > 0 ? time / state.duration : 0;
    const barY = h - 20;
    const barH = 4;
    const padding = w * 0.05;

    // Background
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.beginPath();
    ctx.roundRect(padding, barY, w - padding * 2, barH, 2);
    ctx.fill();

    // Fill
    ctx.fillStyle = state.settings.progressColor;
    ctx.beginPath();
    ctx.roundRect(padding, barY, (w - padding * 2) * progress, barH, 2);
    ctx.fill();

    // Time labels
    ctx.font = `12px ${state.settings.captionFont}`;
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.textAlign = 'left';
    ctx.fillText(formatTime(time), padding, barY - 6);
    ctx.textAlign = 'right';
    ctx.fillText(formatTime(state.duration), w - padding, barY - 6);
}

function drawCaptions(w, h, time) {
    const s = state.settings;
    const activeCaption = state.captions.find(c =>
        time >= c.startTime && time < c.endTime
    );

    if (!activeCaption) return;

    const elapsed = time - activeCaption.startTime;
    const captionDuration = activeCaption.endTime - activeCaption.startTime;
    const progress = Math.min(elapsed / 0.3, 1); // Animation progress (0.3s)

    // Font setup
    ctx.font = `700 ${s.captionSize}px ${s.captionFont}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Position
    let y;
    switch (s.captionPosition) {
        case 'top': y = h * 0.2; break;
        case 'bottom': y = h * 0.8; break;
        default: y = h * 0.45; break;
    }

    // Text Shadow
    applyShadow(s.textShadow);

    // Animation
    ctx.save();

    switch (s.captionAnimation) {
        case 'fadeIn':
            ctx.globalAlpha = progress;
            ctx.fillStyle = s.captionColor;
            wrapText(ctx, activeCaption.text, w / 2, y, w * 0.85, s.captionSize * 1.3);
            break;

        case 'typewriter': {
            ctx.globalAlpha = 1;
            const charCount = Math.floor(activeCaption.text.length * Math.min(elapsed / (captionDuration * 0.6), 1));
            const displayText = activeCaption.text.substring(0, charCount);
            ctx.fillStyle = s.captionColor;
            wrapText(ctx, displayText, w / 2, y, w * 0.85, s.captionSize * 1.3);
            break;
        }

        case 'slideUp': {
            const offsetY = (1 - easeOutCubic(progress)) * 60;
            ctx.globalAlpha = progress;
            ctx.fillStyle = s.captionColor;
            wrapText(ctx, activeCaption.text, w / 2, y + offsetY, w * 0.85, s.captionSize * 1.3);
            break;
        }

        case 'scaleIn': {
            const scale = easeOutBack(progress);
            ctx.translate(w / 2, y);
            ctx.scale(scale, scale);
            ctx.translate(-w / 2, -y);
            ctx.globalAlpha = progress;
            ctx.fillStyle = s.captionColor;
            wrapText(ctx, activeCaption.text, w / 2, y, w * 0.85, s.captionSize * 1.3);
            break;
        }

        case 'wordByWord': {
            const words = activeCaption.text.split(' ');
            const wordDur = captionDuration / words.length;
            const activeWordIdx = Math.min(Math.floor(elapsed / wordDur), words.length - 1);

            let fullText = '';
            words.forEach((word, i) => {
                fullText += (i > 0 ? ' ' : '') + word;
            });

            // Draw all words first
            ctx.fillStyle = s.captionColor;
            ctx.globalAlpha = 0.4;
            wrapText(ctx, fullText, w / 2, y, w * 0.85, s.captionSize * 1.3);

            // Highlight active word
            ctx.globalAlpha = 1;
            ctx.fillStyle = s.highlightColor;
            // Simple approach: draw highlighted words up to current
            const highlightText = words.slice(0, activeWordIdx + 1).join(' ');
            ctx.fillStyle = s.highlightColor;
            wrapText(ctx, highlightText, w / 2, y, w * 0.85, s.captionSize * 1.3);
            break;
        }

        default:
            ctx.fillStyle = s.captionColor;
            wrapText(ctx, activeCaption.text, w / 2, y, w * 0.85, s.captionSize * 1.3);
    }

    ctx.restore();

    // Reset shadow
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
}

function applyShadow(type) {
    switch (type) {
        case 'soft':
            ctx.shadowColor = 'rgba(0,0,0,0.7)';
            ctx.shadowBlur = 15;
            ctx.shadowOffsetX = 2;
            ctx.shadowOffsetY = 2;
            break;
        case 'hard':
            ctx.shadowColor = 'rgba(0,0,0,0.9)';
            ctx.shadowBlur = 0;
            ctx.shadowOffsetX = 4;
            ctx.shadowOffsetY = 4;
            break;
        case 'outline':
            ctx.shadowColor = '#000';
            ctx.shadowBlur = 8;
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 6;
            break;
        case 'glow':
            ctx.shadowColor = state.settings.highlightColor;
            ctx.shadowBlur = 25;
            break;
    }
}

function wrapText(context, text, x, y, maxWidth, lineHeight) {
    const words = text.split(' ');
    let line = '';
    let lines = [];

    for (let word of words) {
        const testLine = line + (line ? ' ' : '') + word;
        const metrics = context.measureText(testLine);
        if (metrics.width > maxWidth && line) {
            lines.push(line);
            line = word;
        } else {
            line = testLine;
        }
    }
    lines.push(line);

    const totalHeight = lines.length * lineHeight;
    const startY = y - totalHeight / 2 + lineHeight / 2;

    for (let i = 0; i < lines.length; i++) {
        context.fillText(lines[i], x, startY + i * lineHeight);
    }
}

// ===== CAPTION EDITOR =====
function setupCaptionEditor() {
    $('addCaptionBtn').addEventListener('click', addCaption);
    $('autoGenerateBtn').addEventListener('click', autoSplitCaptions);
    $('importSrtBtn').addEventListener('click', () => $('srtInput').click());
    $('srtInput').addEventListener('change', importSRT);
}

function addCaption() {
    const lastEnd = state.captions.length > 0
        ? state.captions[state.captions.length - 1].endTime
        : 0;

    state.captions.push({
        id: Date.now(),
        text: 'New caption',
        startTime: lastEnd,
        endTime: Math.min(lastEnd + 3, state.duration || 10)
    });

    renderCaptionList();
    renderFrame(state.currentTime);
}

function autoSplitCaptions() {
    const script = $('scriptInput')?.value?.trim();
    if (!script) {
        alert('Please paste your script in the text area first.');
        return;
    }

    // Split into sentences
    const sentences = script.match(/[^.!?]+[.!?]*/g) || [script];
    const totalDuration = state.duration || sentences.length * 3;
    const durationPerCaption = totalDuration / sentences.length;

    state.captions = sentences.map((text, i) => ({
        id: Date.now() + i,
        text: text.trim(),
        startTime: parseFloat((i * durationPerCaption).toFixed(2)),
        endTime: parseFloat(((i + 1) * durationPerCaption).toFixed(2))
    }));

    renderCaptionList();
    renderFrame(state.currentTime);
}

function importSRT(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = event => {
        const content = event.target.result;
        state.captions = parseSRT(content);
        renderCaptionList();
        renderFrame(state.currentTime);
    };
    reader.readAsText(file);
}

function parseSRT(text) {
    const blocks = text.trim().split(/\n\s*\n/);
    return blocks.map((block, i) => {
        const lines = block.split('\n');
        const timeLine = lines.find(l => l.includes('-->'));
        if (!timeLine) return null;

        const [start, end] = timeLine.split('-->').map(t => {
            const parts = t.trim().replace(',', '.').split(':');
            return parseFloat(parts[0]) * 3600 +
                   parseFloat(parts[1]) * 60 +
                   parseFloat(parts[2]);
        });

        const textLines = lines.filter(l => l !== lines[0] && l !== timeLine);

        return {
            id: Date.now() + i,
            text: textLines.join(' ').replace(/<[^>]+>/g, '').trim(),
            startTime: start,
            endTime: end
        };
    }).filter(Boolean);
}

function renderCaptionList() {
    const list = $('captionList');

    if (state.captions.length === 0) {
        list.innerHTML = `
            <div class="caption-empty">
                <p>No captions yet. Add manually or paste your script below:</p>
                <textarea id="scriptInput" placeholder="Paste your full script here and click 'Auto Split' to generate timed captions..."></textarea>
            </div>`;
        return;
    }

    list.innerHTML = state.captions.map((cap, i) => `
        <div class="caption-item" data-id="${cap.id}">
            <span style="color:var(--text-secondary);font-size:0.7rem;min-width:20px">${i + 1}</span>
            <div class="caption-times">
                <div>
                    <span class="time-label">Start</span>
                    <input type="number" step="0.1" min="0" value="${cap.startTime.toFixed(1)}"
                        onchange="updateCaption(${cap.id}, 'startTime', parseFloat(this.value))">
                </div>
                <div>
                    <span class="time-label">End</span>
                    <input type="number" step="0.1" min="0" value="${cap.endTime.toFixed(1)}"
                        onchange="updateCaption(${cap.id}, 'endTime', parseFloat(this.value))">
                </div>
            </div>
            <input type="text" class="caption-text-input" value="${escapeHtml(cap.text)}"
                onchange="updateCaption(${cap.id}, 'text', this.value)"
                onfocus="seekToCaption(${cap.id})">
            <button class="delete-caption" onclick="deleteCaption(${cap.id})">🗑️</button>
        </div>
    `).join('');
}

function updateCaption(id, field, value) {
    const cap = state.captions.find(c => c.id === id);
    if (cap) {
        cap[field] = value;
        renderFrame(state.currentTime);
    }
}

function deleteCaption(id) {
    state.captions = state.captions.filter(c => c.id !== id);
    renderCaptionList();
    renderFrame(state.currentTime);
}

function seekToCaption(id) {
    const cap = state.captions.find(c => c.id === id);
    if (cap) {
        state.currentTime = cap.startTime;
        $('scrubber').value = cap.startTime;
        $('currentTime').textContent = formatTime(cap.startTime);
        renderFrame(cap.startTime);
    }
}

// ===== EXPORT VIDEO =====
function setupExport() {
    $('exportBtn').addEventListener('click', exportVideo);
}

async function exportVideo() {
    if (!state.audioBuffer) {
        alert('Please upload an audio file first.');
        return;
    }

    $('exportBtn').disabled = true;
    $('exportProgress').classList.remove('hidden');

    try {
        const fps = state.settings.fps;
        const totalFrames = Math.ceil(state.duration * fps);
        const [w, h] = state.settings.resolution;

        // Create offscreen canvas
        const offCanvas = new OffscreenCanvas(w, h);
        const offCtx = offCanvas.getContext('2d');

        // Setup MediaRecorder with canvas stream
        // We use the visible canvas for recording
        canvas.width = w;
        canvas.height = h;

        const stream = canvas.captureStream(fps);

        // Add audio track
        const audioCtx = new AudioContext();
        const source = audioCtx.createBufferSource();
        source.buffer = state.audioBuffer;

        const dest = audioCtx.createMediaStreamDestination();
        source.connect(dest);
        source.connect(audioCtx.destination);

        // Combine video and audio streams
        const audioTrack = dest.stream.getAudioTracks()[0];
        stream.addTrack(audioTrack);

        const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
            ? 'video/webm;codecs=vp9,opus'
            : 'video/webm';

        const recorder = new MediaRecorder(stream, {
            mimeType,
            videoBitsPerSecond: 5000000
        });

        const chunks = [];
        recorder.ondataavailable = e => {
            if (e.data.size > 0) chunks.push(e.data);
        };

        recorder.onstop = () => {
            const blob = new Blob(chunks, { type: mimeType });
            const url = URL.createObjectURL(blob);

            // Download
            const a = document.createElement('a');
            a.href = url;
            a.download = 'video_output.webm';
            a.click();

            $('exportBtn').disabled = false;
            $('progressText').textContent = 'Done! Video downloaded.';
            $('progressFill').style.width = '100%';

            // Restore preview size
            resizeCanvas();

            setTimeout(() => {
                $('exportProgress').classList.add('hidden');
            }, 3000);
        };

        // Start recording
        recorder.start();
        source.start(0);

        // Render frames in real-time
        const startTime = performance.now();

        function renderExportFrame() {
            const elapsed = (performance.now() - startTime) / 1000;

            if (elapsed >= state.duration) {
                recorder.stop();
                source.stop();
                return;
            }

            // Update progress
            const percent = Math.round((elapsed / state.duration) * 100);
            $('progressFill').style.width = percent + '%';
            $('progressText').textContent = `Rendering... ${percent}% (${formatTime(elapsed)} / ${formatTime(state.duration)})`;

            // Render the frame
            renderFrame(elapsed);

            requestAnimationFrame(renderExportFrame);
        }

        renderExportFrame();

    } catch (error) {
        console.error('Export error:', error);
        alert('Export failed: ' + error.message);
        $('exportBtn').disabled = false;
        $('exportProgress').classList.add('hidden');
    }
}

// ===== UTILITY FUNCTIONS =====
function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML.replace(/"/g, '&quot;');
}

function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
}

function easeOutBack(t) {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

// Add roundRect polyfill if needed
if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
        if (w < 2 * r) r = w / 2;
        if (h < 2 * r) r = h / 2;
        this.moveTo(x + r, y);
        this.arcTo(x + w, y, x + w, y + h, r);
        this.arcTo(x + w, y + h, x, y + h, r);
        this.arcTo(x, y + h, x, y, r);
        this.arcTo(x, y, x + w, y, r);
        this.closePath();
        return this;
    };
}

// Make functions global for inline handlers
window.updateCaption = updateCaption;
window.deleteCaption = deleteCaption;
window.seekToCaption = seekToCaption;

// ===== START =====
document.addEventListener('DOMContentLoaded', init);
window.addEventListener('resize', resizeCanvas);
