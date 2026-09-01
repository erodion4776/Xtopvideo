// ===== STATE =====
const state = {
    audio: null, audioBuffer: null, audioContext: null,
    analyser: null, sourceNode: null, duration: 0,
    isPlaying: false, currentTime: 0, captions: [],
    layers: [],
    settings: {
        resolution: [1280, 720], fps: 30,
        bgType: 'gradient',
        gradColor1: '#667eea', gradColor2: '#764ba2',
        animateGradient: true, solidColor: '#1a1a2e',
        bgImage: null, bgVideo: null,
        captionFont: 'Poppins', captionSize: 48,
        captionColor: '#ffffff', highlightColor: '#ffdd57',
        textShadow: 'soft', captionAnimation: 'fadeIn',
        captionPosition: 'center', enableEmoji: true,
        showWaveform: true, showProgress: true,
        progressColor: '#ffdd57'
    },
    animationId: null, startTimestamp: 0,
    bgImageObj: null, bgVideoObj: null,
    particles: []
};

const $ = id => document.getElementById(id);
const canvas = $('previewCanvas');
const ctx = canvas.getContext('2d');

// ===== INIT =====
function init() {
    generateParticles();
    setupAudioUpload();
    setupControls();
    setupCaptionEditor();
    setupLayers();
    setupExport();
    resizeCanvas();
}

// ===== PARTICLES =====
function generateParticles() {
    state.particles = Array.from({ length: 60 }, (_, i) => ({
        x: Math.random(), y: Math.random(),
        speed: 0.2 + Math.random() * 0.8,
        size: 1 + Math.random() * 3,
        phase: Math.random() * Math.PI * 2
    }));
}

// ===== AUDIO =====
function setupAudioUpload() {
    const dz = $('audioDropZone'), inp = $('audioInput');
    dz.addEventListener('click', () => inp.click());
    dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('dragover'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('dragover'));
    dz.addEventListener('drop', e => {
        e.preventDefault(); dz.classList.remove('dragover');
        if (e.dataTransfer.files[0]) loadAudio(e.dataTransfer.files[0]);
    });
    inp.addEventListener('change', e => { if (e.target.files[0]) loadAudio(e.target.files[0]); });
}

async function loadAudio(file) {
    state.audio = file;
    $('audioFileName').textContent = file.name;
    $('audioInfo').classList.remove('hidden');

    if (!state.audioContext) state.audioContext = new (window.AudioContext || window.webkitAudioContext)();

    const buf = await file.arrayBuffer();
    state.audioBuffer = await state.audioContext.decodeAudioData(buf);
    state.duration = state.audioBuffer.duration;

    $('audioDuration').textContent = formatTime(state.duration);
    $('totalTime').textContent = formatTime(state.duration);
    $('previewOverlay').classList.add('hidden');
    $('playBtn').disabled = false;
    $('exportBtn').disabled = false;
    $('scrubber').max = state.duration;

    state.analyser = state.audioContext.createAnalyser();
    state.analyser.fftSize = 256;

    resizeCanvas();
    renderFrame(0);
}

// ===== CONTROLS =====
function setupControls() {
    $('resolution').onchange = e => {
        state.settings.resolution = e.target.value.split('x').map(Number);
        resizeCanvas(); renderFrame(state.currentTime);
    };
    $('fps').onchange = e => { state.settings.fps = +e.target.value; };

    // BG type
    document.querySelectorAll('.bg-option').forEach(o => {
        o.addEventListener('click', () => {
            document.querySelectorAll('.bg-option').forEach(x => x.classList.remove('active'));
            o.classList.add('active');
            state.settings.bgType = o.dataset.bg;
            ['gradient','solid','image','video'].forEach(t => {
                const el = $(t + 'Options');
                if (el) el.classList.toggle('hidden', state.settings.bgType !== t);
            });
            renderFrame(state.currentTime);
        });
    });

    $('gradColor1').oninput = e => { state.settings.gradColor1 = e.target.value; renderFrame(state.currentTime); };
    $('gradColor2').oninput = e => { state.settings.gradColor2 = e.target.value; renderFrame(state.currentTime); };
    $('animateGradient').onchange = e => { state.settings.animateGradient = e.target.checked; };
    $('solidColor').oninput = e => { state.settings.solidColor = e.target.value; renderFrame(state.currentTime); };

    $('bgImageInput').onchange = e => {
        const f = e.target.files[0];
        if (!f) return;
        const img = new Image();
        img.onload = () => { state.bgImageObj = img; renderFrame(state.currentTime); };
        img.src = URL.createObjectURL(f);
    };

    // Background Video
    $('bgVideoInput').onchange = e => {
        const f = e.target.files[0];
        if (!f) return;
        const vid = $('bgVideo');
        vid.src = URL.createObjectURL(f);
        vid.play();
        state.bgVideoObj = vid;
        renderFrame(state.currentTime);
    };

    // Caption settings
    const captionSettings = [
        ['captionFont', 'captionFont'], ['captionColor', 'captionColor'],
        ['highlightColor', 'highlightColor'], ['textShadow', 'textShadow'],
        ['captionAnimation', 'captionAnimation'], ['captionPosition', 'captionPosition']
    ];
    captionSettings.forEach(([id, key]) => {
        $(id).onchange = e => { state.settings[key] = e.target.value; renderFrame(state.currentTime); };
    });

    $('captionSize').oninput = e => {
        state.settings.captionSize = +e.target.value;
        $('fontSizeVal').textContent = e.target.value;
        renderFrame(state.currentTime);
    };

    $('enableEmoji').onchange = e => { state.settings.enableEmoji = e.target.checked; renderFrame(state.currentTime); };
    $('showWaveform').onchange = e => { state.settings.showWaveform = e.target.checked; renderFrame(state.currentTime); };
    $('showProgress').onchange = e => { state.settings.showProgress = e.target.checked; renderFrame(state.currentTime); };
    $('progressColor').oninput = e => { state.settings.progressColor = e.target.value; renderFrame(state.currentTime); };

    $('playBtn').onclick = togglePlayback;
    $('scrubber').oninput = e => {
        state.currentTime = +e.target.value;
        $('currentTime').textContent = formatTime(state.currentTime);
        if (!state.isPlaying) renderFrame(state.currentTime);
    };
}

// ===== PLAYBACK =====
function togglePlayback() {
    state.isPlaying ? stopPlayback() : startPlayback();
}

function startPlayback() {
    if (!state.audioBuffer) return;
    state.isPlaying = true;
    $('playBtn').textContent = '⏸️';

    state.sourceNode = state.audioContext.createBufferSource();
    state.sourceNode.buffer = state.audioBuffer;
    state.sourceNode.connect(state.analyser);
    state.analyser.connect(state.audioContext.destination);

    const offset = state.currentTime;
    state.startTimestamp = state.audioContext.currentTime - offset;
    state.sourceNode.start(0, offset);
    state.sourceNode.onended = () => { if (state.isPlaying) stopPlayback(); };

    (function animate() {
        if (!state.isPlaying) return;
        state.currentTime = state.audioContext.currentTime - state.startTimestamp;
        if (state.currentTime >= state.duration) { stopPlayback(); return; }
        $('scrubber').value = state.currentTime;
        $('currentTime').textContent = formatTime(state.currentTime);
        renderFrame(state.currentTime);
        state.animationId = requestAnimationFrame(animate);
    })();
}

function stopPlayback() {
    state.isPlaying = false;
    $('playBtn').textContent = '▶️';
    if (state.sourceNode) { try { state.sourceNode.stop(); } catch(e){} state.sourceNode = null; }
    if (state.animationId) { cancelAnimationFrame(state.animationId); state.animationId = null; }
}

// ===== CANVAS RENDERING =====
function resizeCanvas() {
    const [w, h] = state.settings.resolution;
    canvas.width = w; canvas.height = h;
    const maxW = canvas.parentElement.clientWidth;
    const maxH = window.innerHeight * 0.42;
    const s = Math.min(maxW / w, maxH / h, 1);
    canvas.style.width = (w * s) + 'px';
    canvas.style.height = (h * s) + 'px';
}

function renderFrame(time) {
    const w = canvas.width, h = canvas.height, s = state.settings;
    ctx.clearRect(0, 0, w, h);

    drawBackground(w, h, time);
    if (s.showWaveform) drawWaveform(w, h);
    if (s.showProgress && state.duration > 0) drawProgressBar(w, h, time);

    // Draw text layers (behind captions)
    drawLayers(w, h, time);

    // Draw captions
    drawCaptions(w, h, time);
}

function drawBackground(w, h, time) {
    const s = state.settings;
    switch (s.bgType) {
        case 'gradient': {
            const angle = s.animateGradient ? (time * 30) % 360 : 135;
            const rad = angle * Math.PI / 180;
            const g = ctx.createLinearGradient(
                w/2 + Math.cos(rad)*w/2, h/2 + Math.sin(rad)*h/2,
                w/2 - Math.cos(rad)*w/2, h/2 - Math.sin(rad)*h/2
            );
            g.addColorStop(0, s.gradColor1);
            g.addColorStop(1, s.gradColor2);
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, w, h);
            break;
        }
        case 'solid':
            ctx.fillStyle = s.solidColor;
            ctx.fillRect(0, 0, w, h);
            break;
        case 'image':
            if (state.bgImageObj) {
                const img = state.bgImageObj;
                const sc = Math.max(w/img.width, h/img.height);
                ctx.drawImage(img, (w-img.width*sc)/2, (h-img.height*sc)/2, img.width*sc, img.height*sc);
                ctx.fillStyle = 'rgba(0,0,0,0.35)';
                ctx.fillRect(0, 0, w, h);
            } else { ctx.fillStyle = '#111'; ctx.fillRect(0, 0, w, h); }
            break;
        case 'video':
            if (state.bgVideoObj && state.bgVideoObj.readyState >= 2) {
                const vid = state.bgVideoObj;
                const sc = Math.max(w/vid.videoWidth, h/vid.videoHeight);
                ctx.drawImage(vid, (w-vid.videoWidth*sc)/2, (h-vid.videoHeight*sc)/2, vid.videoWidth*sc, vid.videoHeight*sc);
                ctx.fillStyle = 'rgba(0,0,0,0.3)';
                ctx.fillRect(0, 0, w, h);
            } else { ctx.fillStyle = '#111'; ctx.fillRect(0, 0, w, h); }
            break;
        case 'particles':
            ctx.fillStyle = '#0a0a1a';
            ctx.fillRect(0, 0, w, h);
            state.particles.forEach(p => {
                const x = ((p.x * w + time * 20 * p.speed) % w);
                const y = ((p.y * h + time * 15 * p.speed) % h);
                const alpha = 0.2 + (Math.sin(time * 2 + p.phase) + 1) * 0.3;
                ctx.beginPath();
                ctx.arc(x, y, p.size, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(102,126,234,${alpha})`;
                ctx.fill();
            });
            break;
    }
}

function drawWaveform(w, h) {
    const bars = 60, barW = w/bars*0.6, centerY = h*0.75, maxH = h*0.06;
    ctx.save(); ctx.globalAlpha = 0.25;
    for (let i = 0; i < bars; i++) {
        const x = (w/bars)*i + (w/bars)*0.2;
        const bH = maxH * (0.3 + Math.sin(i * 0.5 + state.currentTime * 3) * 0.35 + 0.35);
        ctx.fillStyle = state.settings.captionColor;
        ctx.fillRect(x, centerY - bH/2, barW, bH);
    }
    ctx.restore();
}

function drawProgressBar(w, h, time) {
    const progress = state.duration > 0 ? time / state.duration : 0;
    const y = h - 18, barH = 4, pad = w * 0.05;
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    roundRect(ctx, pad, y, w - pad*2, barH, 2); ctx.fill();
    ctx.fillStyle = state.settings.progressColor;
    roundRect(ctx, pad, y, (w - pad*2) * progress, barH, 2); ctx.fill();
    ctx.font = `12px ${state.settings.captionFont}`;
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.textAlign = 'left'; ctx.fillText(formatTime(time), pad, y - 5);
    ctx.textAlign = 'right'; ctx.fillText(formatTime(state.duration), w - pad, y - 5);
}

// ===== TEXT LAYERS =====
function setupLayers() {
    $('addLayerBtn').onclick = () => {
        state.layers.push({
            id: Date.now(), text: 'Text Layer',
            x: 50, y: 10, size: 24,
            color: '#ffffff', position: 'top-left'
        });
        renderLayersList();
        renderFrame(state.currentTime);
    };
}

function renderLayersList() {
    $('layersList').innerHTML = state.layers.map(l => `
        <div class="layer-item">
            <input type="text" value="${esc(l.text)}" onchange="updateLayer(${l.id},'text',this.value)">
            <input type="color" value="${l.color}" onchange="updateLayer(${l.id},'color',this.value)">
            <select onchange="updateLayer(${l.id},'position',this.value)">
                <option value="top-left" ${l.position==='top-left'?'selected':''}>↖</option>
                <option value="top-right" ${l.position==='top-right'?'selected':''}>↗</option>
                <option value="bottom-left" ${l.position==='bottom-left'?'selected':''}>↙</option>
                <option value="bottom-right" ${l.position==='bottom-right'?'selected':''}>↘</option>
            </select>
            <button class="delete-caption" onclick="deleteLayer(${l.id})">🗑️</button>
        </div>
    `).join('');
}

function drawLayers(w, h, time) {
    state.layers.forEach(l => {
        ctx.save();
        ctx.font = `600 ${l.size}px ${state.settings.captionFont}`;
        ctx.fillStyle = l.color;
        ctx.globalAlpha = 0.8;

        let x, y;
        const pad = 40;
        switch (l.position) {
            case 'top-left': x = pad; y = pad + l.size; ctx.textAlign = 'left'; break;
            case 'top-right': x = w - pad; y = pad + l.size; ctx.textAlign = 'right'; break;
            case 'bottom-left': x = pad; y = h - pad - 30; ctx.textAlign = 'left'; break;
            case 'bottom-right': x = w - pad; y = h - pad - 30; ctx.textAlign = 'right'; break;
        }
        ctx.fillText(l.text, x, y);
        ctx.restore();
    });
}

window.updateLayer = (id, field, val) => {
    const l = state.layers.find(x => x.id === id);
    if (l) { l[field] = val; renderFrame(state.currentTime); }
};
window.deleteLayer = id => {
    state.layers = state.layers.filter(x => x.id !== id);
    renderLayersList(); renderFrame(state.currentTime);
};

// ===== CAPTIONS =====
function setupCaptionEditor() {
    $('addCaptionBtn').onclick = addCaption;
    $('autoGenerateBtn').onclick = autoSplit;
    $('importSrtBtn').onclick = () => $('srtInput').click();
    $('srtInput').onchange = importSRT;
}

function addCaption() {
    const last = state.captions.length ? state.captions[state.captions.length-1].endTime : 0;
    state.captions.push({ id: Date.now(), text: 'New caption', startTime: last, endTime: Math.min(last+3, state.duration||10) });
    renderCaptionList(); renderFrame(state.currentTime);
}

function autoSplit() {
    const script = $('scriptInput')?.value?.trim();
    if (!script) return alert('Paste your script first!');
    const sentences = script.match(/[^.!?]+[.!?]*/g) || [script];
    const dur = state.duration || sentences.length * 3;
    const per = dur / sentences.length;
    state.captions = sentences.map((t, i) => ({
        id: Date.now()+i, text: t.trim(),
        startTime: +(i*per).toFixed(2), endTime: +((i+1)*per).toFixed(2)
    }));
    renderCaptionList(); renderFrame(state.currentTime);
}

function importSRT(e) {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = ev => {
        state.captions = parseSRT(ev.target.result);
        renderCaptionList(); renderFrame(state.currentTime);
    };
    r.readAsText(f);
}

function parseSRT(text) {
    return text.trim().split(/\n\s*\n/).map((b, i) => {
        const lines = b.split('\n');
        const tl = lines.find(l => l.includes('-->'));
        if (!tl) return null;
        const [s, e] = tl.split('-->').map(t => {
            const p = t.trim().replace(',','.').split(':');
            return +p[0]*3600 + +p[1]*60 + +p[2];
        });
        return { id: Date.now()+i, text: lines.filter(l => l!==lines[0] && l!==tl).join(' ').replace(/<[^>]+>/g,'').trim(), startTime: s, endTime: e };
    }).filter(Boolean);
}

function renderCaptionList() {
    const list = $('captionList');
    if (!state.captions.length) {
        list.innerHTML = `<div class="caption-empty"><p>No captions yet.</p><textarea id="scriptInput" placeholder="Paste script here..."></textarea></div>`;
        return;
    }
    list.innerHTML = state.captions.map((c, i) => `
        <div class="caption-item">
            <span style="color:var(--text-secondary);font-size:0.65rem;min-width:18px">${i+1}</span>
            <div class="caption-times">
                <div><span class="time-label">Start</span><input type="number" step="0.1" min="0" value="${c.startTime.toFixed(1)}" onchange="updateCap(${c.id},'startTime',+this.value)"></div>
                <div><span class="time-label">End</span><input type="number" step="0.1" min="0" value="${c.endTime.toFixed(1)}" onchange="updateCap(${c.id},'endTime',+this.value)"></div>
            </div>
            <input type="text" class="caption-text-input" value="${esc(c.text)}" onchange="updateCap(${c.id},'text',this.value)">
            <button class="delete-caption" onclick="deleteCap(${c.id})">🗑️</button>
        </div>
    `).join('');
}

window.updateCap = (id, f, v) => { const c = state.captions.find(x=>x.id===id); if(c){c[f]=v; renderFrame(state.currentTime);} };
window.deleteCap = id => { state.captions = state.captions.filter(x=>x.id!==id); renderCaptionList(); renderFrame(state.currentTime); };

function drawCaptions(w, h, time) {
    const s = state.settings;
    const cap = state.captions.find(c => time >= c.startTime && time < c.endTime);
    if (!cap) return;

    const elapsed = time - cap.startTime;
    const dur = cap.endTime - cap.startTime;
    const prog = Math.min(elapsed / 0.3, 1);

    const fontStr = `700 ${s.captionSize}px ${s.captionFont}`;
    ctx.font = fontStr;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    let y;
    switch (s.captionPosition) {
        case 'top': y = h*0.2; break;
        case 'bottom': y = h*0.8; break;
        default: y = h*0.45;
    }

    applyShadow(s.textShadow);
    ctx.save();

    switch (s.captionAnimation) {
        case 'fadeIn':
            ctx.globalAlpha = prog;
            ctx.fillStyle = s.captionColor;
            wrapText(ctx, cap.text, w/2, y, w*0.85, s.captionSize*1.3);
            break;
        case 'typewriter': {
            const chars = Math.floor(cap.text.length * Math.min(elapsed/(dur*0.6), 1));
            ctx.fillStyle = s.captionColor;
            wrapText(ctx, cap.text.substring(0, chars), w/2, y, w*0.85, s.captionSize*1.3);
            break;
        }
        case 'slideUp':
            ctx.globalAlpha = prog;
            ctx.fillStyle = s.captionColor;
            wrapText(ctx, cap.text, w/2, y + (1-easeOutCubic(prog))*60, w*0.85, s.captionSize*1.3);
            break;
        case 'scaleIn': {
            const sc = easeOutBack(prog);
            ctx.translate(w/2, y); ctx.scale(sc, sc); ctx.translate(-w/2, -y);
            ctx.globalAlpha = prog; ctx.fillStyle = s.captionColor;
            wrapText(ctx, cap.text, w/2, y, w*0.85, s.captionSize*1.3);
            break;
        }
        case 'wordByWord': {
            const words = cap.text.split(' ');
            const wDur = dur / words.length;
            const idx = Math.min(Math.floor(elapsed / wDur), words.length - 1);
            ctx.globalAlpha = 0.35; ctx.fillStyle = s.captionColor;
            wrapText(ctx, cap.text, w/2, y, w*0.85, s.captionSize*1.3);
            ctx.globalAlpha = 1; ctx.fillStyle = s.highlightColor;
            wrapText(ctx, words.slice(0, idx+1).join(' '), w/2, y, w*0.85, s.captionSize*1.3);
            break;
        }
        default:
            ctx.fillStyle = s.captionColor;
            wrapText(ctx, cap.text, w/2, y, w*0.85, s.captionSize*1.3);
    }
    ctx.restore();
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
}

function applyShadow(type) {
    const s = state.settings;
    switch (type) {
        case 'soft': ctx.shadowColor='rgba(0,0,0,0.7)'; ctx.shadowBlur=15; ctx.shadowOffsetX=2; ctx.shadowOffsetY=2; break;
        case 'hard': ctx.shadowColor='rgba(0,0,0,0.9)'; ctx.shadowBlur=0; ctx.shadowOffsetX=4; ctx.shadowOffsetY=4; break;
        case 'outline': ctx.shadowColor='#000'; ctx.shadowBlur=8; break;
        case 'glow': ctx.shadowColor=s.highlightColor; ctx.shadowBlur=25; break;
    }
}

function wrapText(c, text, x, y, maxW, lh) {
    const words = text.split(' ');
    let line = '', lines = [];
    for (const w of words) {
        const test = line + (line ? ' ' : '') + w;
        if (c.measureText(test).width > maxW && line) { lines.push(line); line = w; }
        else line = test;
    }
    lines.push(line);
    const startY = y - (lines.length * lh)/2 + lh/2;
    lines.forEach((l, i) => c.fillText(l, x, startY + i * lh));
}

// ===== EXPORT =====
function setupExport() { $('exportBtn').onclick = exportVideo; }

async function exportVideo() {
    if (!state.audioBuffer) return alert('Upload audio first!');

    const format = $('exportFormat').value;
    $('exportBtn').disabled = true;
    $('exportProgress').classList.remove('hidden');

    try {
        if (format === 'mp4') {
            await exportMP4();
        } else {
            await exportWebM();
        }
    } catch (err) {
        console.error(err);
        alert('Export failed: ' + err.message);
        $('exportBtn').disabled = false;
        $('exportProgress').classList.add('hidden');
    }
}

async function exportWebM() {
    const fps = state.settings.fps;
    const [w, h] = state.settings.resolution;
    canvas.width = w; canvas.height = h;

    const stream = canvas.captureStream(fps);

    const audioCtx = new AudioContext();
    const source = audioCtx.createBufferSource();
    source.buffer = state.audioBuffer;
    const dest = audioCtx.createMediaStreamDestination();
    source.connect(dest); source.connect(audioCtx.destination);
    stream.addTrack(dest.stream.getAudioTracks()[0]);

    const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
        ? 'video/webm;codecs=vp9,opus' : 'video/webm';
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 5000000 });
    const chunks = [];
    rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    rec.onstop = () => {
        const blob = new Blob(chunks, { type: mime });
        downloadBlob(blob, 'video.webm');
        finishExport();
    };

    rec.start(); source.start(0);
    const t0 = performance.now();

    (function render() {
        const el = (performance.now() - t0) / 1000;
        if (el >= state.duration) { rec.stop(); source.stop(); return; }
        updateProgress(el);
        renderFrame(el);
        requestAnimationFrame(render);
    })();
}

async function exportMP4() {
    const { FFmpeg } = FFmpegWASM;
    const { fetchFile } = FFmpegUtil;

    const ffmpeg = new FFmpeg();
    const [w, h] = state.settings.resolution;
    const fps = state.settings.fps;
    const totalFrames = Math.ceil(state.duration * fps);

    // Load FFmpeg
    $('progressText').textContent = 'Loading FFmpeg.wasm...';
    await ffmpeg.load({
        coreURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js',
        wasmURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.wasm',
    });

    // Write audio
    $('progressText').textContent = 'Preparing audio...';
    const audioData = await fetchFile(state.audio);
    await ffmpeg.writeFile('audio.mp3', audioData);

    // Render frames
    canvas.width = w; canvas.height = h;
    for (let i = 0; i < totalFrames; i++) {
        const time = i / fps;
        renderFrame(time);

        // Capture frame as PNG
        const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
        const data = new Uint8Array(await blob.arrayBuffer());
        const frameName = `frame_${String(i).padStart(5, '0')}.png`;
        await ffmpeg.writeFile(frameName, data);

        if (i % 10 === 0) {
            const pct = Math.round((i / totalFrames) * 80);
            $('progressFill').style.width = pct + '%';
            $('progressText').textContent = `Rendering frames... ${pct}% (${i}/${totalFrames})`;
            await new Promise(r => setTimeout(r, 0)); // yield
        }
    }

    // Encode with FFmpeg
    $('progressText').textContent = 'Encoding MP4...';
    $('progressFill').style.width = '85%';

    await ffmpeg.exec([
        '-framerate', String(fps),
        '-i', 'frame_%05d.png',
        '-i', 'audio.mp3',
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac',
        '-shortest',
        '-y',
        'output.mp4'
    ]);

    const output = await ffmpeg.readFile('output.mp4');
    const blob = new Blob([output.buffer], { type: 'video/mp4' });
    downloadBlob(blob, 'video.mp4');

    // Cleanup
    for (let i = 0; i < totalFrames; i++) {
        try { await ffmpeg.deleteFile(`frame_${String(i).padStart(5, '0')}.png`); } catch(e){}
    }
    await ffmpeg.deleteFile('audio.mp3');
    await ffmpeg.deleteFile('output.mp4');

    finishExport();
}

function updateProgress(elapsed) {
    const pct = Math.round((elapsed / state.duration) * 100);
    $('progressFill').style.width = pct + '%';
    $('progressText').textContent = `Rendering... ${pct}% (${formatTime(elapsed)} / ${formatTime(state.duration)})`;
}

function finishExport() {
    $('exportBtn').disabled = false;
    $('progressText').textContent = '✅ Done! Video downloaded.';
    $('progressFill').style.width = '100%';
    resizeCanvas();
    setTimeout(() => $('exportProgress').classList.add('hidden'), 3000);
}

function downloadBlob(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
}

// ===== UTILS =====
function formatTime(s) {
    if (!s || isNaN(s)) return '0:00';
    return `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;
}
function esc(t) { const d = document.createElement('div'); d.textContent = t; return d.innerHTML.replace(/"/g,'&quot;'); }
function easeOutCubic(t) { return 1 - Math.pow(1-t, 3); }
function easeOutBack(t) { const c = 1.70158; return 1 + (c+1)*Math.pow(t-1,3) + c*Math.pow(t-1,2); }

function roundRect(c, x, y, w, h, r) {
    if (w < 0) return;
    c.beginPath();
    c.moveTo(x+r, y);
    c.arcTo(x+w, y, x+w, y+h, r);
    c.arcTo(x+w, y+h, x, y+h, r);
    c.arcTo(x, y+h, x, y, r);
    c.arcTo(x, y, x+w, y, r);
    c.closePath();
}

document.addEventListener('DOMContentLoaded', init);
window.addEventListener('resize', resizeCanvas);
