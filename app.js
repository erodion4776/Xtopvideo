// ===== STATE =====
const state = {
    audio: null,
    audioBuffer: null,
    audioCtx: null,
    analyser: null,
    sourceNode: null,
    duration: 0,
    currentTime: 0,
    isPlaying: false,
    captions: [],
    width: 1080,
    height: 1920,
    animFrameId: null,
    startTimeStamp: 0
};

const $ = id => document.getElementById(id);
const stage = $('videoStage');
const exportCanvas = $('exportCanvas');
const exportCtx = exportCanvas.getContext('2d');

// ===== INITIALIZATION =====
window.addEventListener('DOMContentLoaded', () => {
    setupStageScaling();
    setupAudioEvents();
    setupControls();
    createVisualizerBars();
    window.addEventListener('resize', setupStageScaling);
});

// ===== STAGE FIT & RESIZE =====
function setupStageScaling() {
    const [w, h] = $('aspectRatio').value.split('x').map(Number);
    state.width = w;
    state.height = h;

    stage.style.width = `${w}px`;
    stage.style.height = `${h}px`;

    const container = document.querySelector('.stage-container');
    const maxW = container.clientWidth - 40;
    const maxH = container.clientHeight - 40;

    const scale = Math.min(maxW / w, maxH / h, 1);
    stage.style.transform = `scale(${scale})`;
}

// ===== AUDIO UPLOAD & PARSING =====
function setupAudioEvents() {
    const dropZone = $('dropZone');
    const audioInput = $('audioInput');

    dropZone.onclick = () => audioInput.click();
    dropZone.ondragover = e => { e.preventDefault(); dropZone.style.borderColor = 'var(--primary)'; };
    dropZone.ondragleave = () => { dropZone.style.borderColor = 'var(--border)'; };
    dropZone.ondrop = e => {
        e.preventDefault();
        if (e.dataTransfer.files[0]) loadAudioFile(e.dataTransfer.files[0]);
    };
    audioInput.onchange = e => {
        if (e.target.files[0]) loadAudioFile(e.target.files[0]);
    };
}

async function loadAudioFile(file) {
    state.audio = file;
    $('audioMeta').textContent = `🎵 ${file.name}`;
    $('audioMeta').classList.remove('hidden');

    if (!state.audioCtx) {
        state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }

    const arrayBuffer = await file.arrayBuffer();
    state.audioBuffer = await state.audioCtx.decodeAudioData(arrayBuffer);
    state.duration = state.audioBuffer.duration;

    state.analyser = state.audioCtx.createAnalyser();
    state.analyser.fftSize = 64;

    $('timeScrubber').max = state.duration;
    $('playBtn').disabled = false;
    $('exportWebmBtn').disabled = false;
    $('exportMp4Btn').disabled = false;

    updatePlaybackUI(0);
}

// ===== VISUALIZER BARS =====
function createVisualizerBars() {
    const vis = $('stageVisualizer');
    vis.innerHTML = '';
    for (let i = 0; i < 16; i++) {
        const bar = document.createElement('div');
        bar.className = 'vis-bar';
        vis.appendChild(bar);
    }
}

function updateVisualizer() {
    if (!state.analyser || !state.isPlaying) return;
    const data = new Uint8Array(state.analyser.frequencyBinCount);
    state.analyser.getByteFrequencyData(data);
    const bars = document.querySelectorAll('.vis-bar');
    bars.forEach((bar, i) => {
        const h = Math.max(10, (data[i] / 255) * 80);
        bar.style.height = `${h}px`;
    });
}

// ===== CAPTIONS & WORD-LEVEL KARAOKE =====
function updateHTMLCaptions(time) {
    const activeCaption = state.captions.find(c => time >= c.start && time < c.end);
    const container = $('stageCaptions');

    if (!activeCaption) {
        container.innerHTML = '';
        return;
    }

    const duration = activeCaption.end - activeCaption.start;
    const elapsed = time - activeCaption.start;
    const words = activeCaption.text.split(' ');
    const wordDur = duration / words.length;
    const currentWordIndex = Math.min(Math.floor(elapsed / wordDur), words.length - 1);

    // Build the rich HTML representation of captions!
    const anim = $('captionAnimation').value;
    const highlightColor = $('highlightColor').value;
    document.documentElement.style.setProperty('--accent', highlightColor);

    let html = `<div class="caption-box anim-${anim}">`;
    words.forEach((word, index) => {
        const isActive = index <= currentWordIndex ? 'active' : '';
        html += `<span class="word ${isActive}">${escapeHtml(word)}</span>`;
    });
    html += `</div>`;

    container.innerHTML = html;
}

// ===== CONTROLS =====
function setupControls() {
    $('aspectRatio').onchange = setupStageScaling;
    
    $('bgPreset').onchange = e => {
        $('bgLayer').style.background = e.target.value;
    };
    
    $('badgeInput').oninput = e => {
        $('stageBadge').innerHTML = e.target.value || '';
    };

    $('fontSize').oninput = e => {
        $('fontSizeLabel').textContent = e.target.value;
        document.querySelector('.caption-box')?.style.setProperty('font-size', `${e.target.value}px`);
    };

    $('fontFamily').onchange = e => {
        stage.style.fontFamily = e.target.value;
    };

    $('textColor').oninput = e => {
        const box = document.querySelector('.caption-box');
        if (box) box.style.color = e.target.value;
    };

    $('playBtn').onclick = togglePlay;
    
    $('timeScrubber').oninput = e => {
        state.currentTime = parseFloat(e.target.value);
        updatePlaybackUI(state.currentTime);
    };

    $('autoSplitBtn').onclick = autoSplitCaptions;
    $('addCaptionBtn').onclick = addCaptionManual;
    $('exportWebmBtn').onclick = () => renderVideo('webm');
    $('exportMp4Btn').onclick = () => renderVideo('mp4');
}

// ===== SCRIPT TO KARAOKE SPLITTER =====
function autoSplitCaptions() {
    const text = $('scriptInput').value.trim();
    if (!text) return alert('Please enter script text first.');

    const sentences = text.match(/[^.!?\n]+[.!?\n]*/g) || [text];
    const totalDuration = state.duration || sentences.length * 2.5;
    const segmentDuration = totalDuration / sentences.length;

    state.captions = sentences.map((sentence, idx) => ({
        id: idx,
        start: parseFloat((idx * segmentDuration).toFixed(2)),
        end: parseFloat(((idx + 1) * segmentDuration).toFixed(2)),
        text: sentence.trim()
    }));

    renderCaptionListUI();
}

function addCaptionManual() {
    const lastEnd = state.captions.length ? state.captions[state.captions.length - 1].end : 0;
    state.captions.push({
        id: Date.now(),
        start: lastEnd,
        end: lastEnd + 3,
        text: 'New Caption'
    });
    renderCaptionListUI();
}

function renderCaptionListUI() {
    $('captionList').innerHTML = state.captions.map((c, i) => `
        <div class="caption-row">
            <input type="number" step="0.1" value="${c.start}" onchange="updateCapTime(${i}, 'start', this.value)">
            <input type="number" step="0.1" value="${c.end}" onchange="updateCapTime(${i}, 'end', this.value)">
            <input type="text" value="${escapeHtml(c.text)}" oninput="updateCapText(${i}, this.value)">
        </div>
    `).join('');
}

window.updateCapTime = (i, prop, val) => { state.captions[i][prop] = parseFloat(val); };
window.updateCapText = (i, val) => { state.captions[i].text = val; };

// ===== PLAYBACK =====
function togglePlay() {
    state.isPlaying ? pauseAudio() : playAudio();
}

function playAudio() {
    if (!state.audioBuffer) return;
    state.isPlaying = true;
    $('playBtn').textContent = '⏸';

    state.sourceNode = state.audioCtx.createBufferSource();
    state.sourceNode.buffer = state.audioBuffer;
    state.sourceNode.connect(state.analyser);
    state.analyser.connect(state.audioCtx.destination);

    const offset = state.currentTime;
    state.startTimeStamp = state.audioCtx.currentTime - offset;
    state.sourceNode.start(0, offset);

    function tick() {
        if (!state.isPlaying) return;
        state.currentTime = state.audioCtx.currentTime - state.startTimeStamp;
        if (state.currentTime >= state.duration) {
            pauseAudio();
            state.currentTime = 0;
            return;
        }
        updatePlaybackUI(state.currentTime);
        state.animFrameId = requestAnimationFrame(tick);
    }
    tick();
}

function pauseAudio() {
    state.isPlaying = false;
    $('playBtn').textContent = '▶';
    if (state.sourceNode) {
        try { state.sourceNode.stop(); } catch(e){}
        state.sourceNode = null;
    }
    cancelAnimationFrame(state.animFrameId);
}

function updatePlaybackUI(time) {
    $('timeScrubber').value = time;
    $('timeDisplay').textContent = `${formatTime(time)} / ${formatTime(state.duration)}`;
    
    // Update HTML progress bar inside video stage
    const pct = (time / (state.duration || 1)) * 100;
    $('stageProgressBar').style.width = `${pct}%`;

    updateHTMLCaptions(time);
    updateVisualizer();
}

// ===== SERIALIZE HTML DOM STAGE TO CANVAS IMAGE =====
function domToCanvas(element, canvas, width, height) {
    return new Promise((resolve) => {
        // Clone and extract full HTML
        const html = new XMLSerializer().serializeToString(element);
        
        // Wrap inside SVG foreignObject
        const svgData = `
            <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
                <foreignObject width="100%" height="100%">
                    <div xmlns="http://www.w3.org/1999/xhtml">
                        <style>
                            @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700;900&family=Poppins:wght@400;700;900&family=Bebas+Neue&family=Space+Grotesk:wght@700&display=swap');
                            ${getComputedCSS(element)}
                        </style>
                        ${html}
                    </div>
                </foreignObject>
            </svg>
        `;

        const img = new Image();
        const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);

        img.onload = () => {
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);
            URL.revokeObjectURL(url);
            resolve();
        };
        img.src = url;
    });
}

function getComputedCSS() {
    return `
        * { box-sizing: border-box; font-family: ${stage.style.fontFamily || "'Montserrat', sans-serif"}; }
        .video-stage { position: relative; width: 100%; height: 100%; overflow: hidden; display: flex; flex-direction: column; justify-content: center; align-items: center; }
        .stage-bg { position: absolute; inset: 0; background: ${$('bgLayer').style.background || 'linear-gradient(135deg, #8A2387, #E94057, #F27121)'}; }
        .stage-badge { position: absolute; top: 60px; background: rgba(0,0,0,0.4); padding: 12px 28px; border-radius: 50px; font-size: 28px; font-weight: 700; color: #fff; }
        .stage-captions { position: relative; z-index: 10; width: 85%; text-align: center; }
        .caption-box { font-size: ${$('fontSize').value}px; font-weight: 900; line-height: 1.35; color: ${$('textColor').value}; word-wrap: break-word; }
        .caption-box .word { display: inline-block; margin: 0 6px; }
        .caption-box .word.active { color: ${$('highlightColor').value}; transform: scale(1.18); }
        .stage-progress-container { position: absolute; bottom: 0; left: 0; right: 0; height: 14px; background: rgba(0,0,0,0.3); }
        .stage-progress-bar { height: 100%; width: ${$('stageProgressBar').style.width}; background: ${$('highlightColor').value}; }
    `;
}

// ===== EXPORT VIDEO =====
async function renderVideo(format) {
    if (!state.audioBuffer) return;
    pauseAudio();

    $('exportModal').classList.remove('hidden');
    $('exportStatusTitle').textContent = `Rendering ${format.toUpperCase()} Video...`;

    const fps = 30;
    const totalFrames = Math.ceil(state.duration * fps);
    const [w, h] = [state.width, state.height];

    if (format === 'webm') {
        // Native Real-time MediaRecorder Export
        exportCanvas.width = w;
        exportCanvas.height = h;
        const stream = exportCanvas.captureStream(fps);

        const audioCtx = new AudioContext();
        const source = audioCtx.createBufferSource();
        source.buffer = state.audioBuffer;
        const dest = audioCtx.createMediaStreamDestination();
        source.connect(dest);
        stream.addTrack(dest.stream.getAudioTracks()[0]);

        const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
        const chunks = [];
        recorder.ondataavailable = e => chunks.push(e.data);

        recorder.onstop = () => {
            const blob = new Blob(chunks, { type: 'video/webm' });
            downloadFile(blob, 'html_video.webm');
            $('exportModal').classList.add('hidden');
        };

        recorder.start();
        source.start(0);

        const startTime = performance.now();
        async function drawWebmLoop() {
            const el = (performance.now() - startTime) / 1000;
            if (el >= state.duration) {
                recorder.stop();
                source.stop();
                return;
            }
            updatePlaybackUI(el);
            await domToCanvas(stage, exportCanvas, w, h);
            
            const pct = Math.round((el / state.duration) * 100);
            $('exportProgressBar').style.width = `${pct}%`;
            $('exportStatusDetail').textContent = `Rendering frame: ${pct}%`;
            requestAnimationFrame(drawWebmLoop);
        }
        drawWebmLoop();

    } else if (format === 'mp4') {
        // High Quality Frame-by-Frame FFmpeg.wasm Export
        const { FFmpeg } = FFmpegWASM;
        const { fetchFile } = FFmpegUtil;
        const ffmpeg = new FFmpeg();

        $('exportStatusDetail').textContent = 'Loading FFmpeg.wasm...';
        await ffmpeg.load({
            coreURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js',
            wasmURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.wasm'
        });

        const audioData = await fetchFile(state.audio);
        await ffmpeg.writeFile('audio.mp3', audioData);

        for (let i = 0; i < totalFrames; i++) {
            const frameTime = i / fps;
            updatePlaybackUI(frameTime);
            await domToCanvas(stage, exportCanvas, w, h);

            const blob = await new Promise(res => exportCanvas.toBlob(res, 'image/png'));
            const buffer = new Uint8Array(await blob.arrayBuffer());
            await ffmpeg.writeFile(`f_${String(i).padStart(5, '0')}.png`, buffer);

            const pct = Math.round((i / totalFrames) * 80);
            $('exportProgressBar').style.width = `${pct}%`;
            $('exportStatusDetail').textContent = `Rendering HTML frames: ${pct}% (${i}/${totalFrames})`;
        }

        $('exportStatusDetail').textContent = 'Encoding MP4 Video...';
        await ffmpeg.exec([
            '-framerate', String(fps),
            '-i', 'f_%05d.png',
            '-i', 'audio.mp3',
            '-c:v', 'libx264',
            '-pix_fmt', 'yuv420p',
            '-c:a', 'aac',
            '-shortest',
            'output.mp4'
        ]);

        const data = await ffmpeg.readFile('output.mp4');
        const mp4Blob = new Blob([data.buffer], { type: 'video/mp4' });
        downloadFile(mp4Blob, 'html_video.mp4');
        $('exportModal').classList.add('hidden');
    }
}

// ===== UTILITIES =====
function formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
}

function escapeHtml(t) {
    const d = document.createElement('div');
    d.textContent = t;
    return d.innerHTML;
}

function downloadFile(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
}
