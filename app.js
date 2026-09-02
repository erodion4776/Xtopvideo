// ============================================
// STATE
// ============================================
const state = {
    audio: null,
    audioBuffer: null,
    audioCtx: null,
    sourceNode: null,
    duration: 30,
    currentTime: 0,
    isPlaying: false,
    width: 1920,
    height: 1080,
    fps: 30,
    animFrameId: null,
    startTimestamp: 0,
    exportCancelled: false,
    htmlApplied: false,
    userHTML: ''
};

const $ = id => document.getElementById(id);

// ============================================
// INIT
// ============================================
window.addEventListener('DOMContentLoaded', () => {
    setupAudioUpload();
    setupHTMLEditor();
    setupExamples();
    setupProjects();
    setupPlayer();
    setupExport();
    updateAspectRatio();
    window.addEventListener('resize', scalePreview);
});

// ============================================
// HTML EDITOR
// ============================================
function setupHTMLEditor() {
    const editor = $('htmlEditor');

    $('applyBtn').onclick = applyHTML;
    $('clearBtn').onclick = () => {
        if (confirm('Clear editor?')) {
            editor.value = '';
            state.userHTML = '';
            state.htmlApplied = false;
            $('previewFrame').srcdoc = '';
            $('previewStatus').textContent = 'Waiting for HTML...';
            $('previewStatus').className = 'status';
            checkExportReady();
        }
    };

    $('formatBtn').onclick = () => {
        // Basic HTML beautify
        try {
            const raw = editor.value;
            editor.value = raw
                .replace(/></g, '>\n<')
                .replace(/\n\s*\n/g, '\n');
        } catch(e) {}
    };

    // Tab key support in editor
    editor.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
            e.preventDefault();
            const start = editor.selectionStart;
            const end = editor.selectionEnd;
            editor.value = editor.value.substring(0, start) + '    ' + editor.value.substring(end);
            editor.selectionStart = editor.selectionEnd = start + 4;
        }
    });
}

function applyHTML() {
    const html = $('htmlEditor').value.trim();
    if (!html) {
        alert('Please paste HTML code first!');
        return;
    }

    state.userHTML = html;
    state.htmlApplied = true;

    const iframe = $('previewFrame');
    iframe.srcdoc = html;

    // Wait for iframe to load, then setup
    iframe.onload = () => {
        try {
            // Reset time
            state.currentTime = 0;
            updatePlayback(0);
            $('previewStatus').textContent = '✅ Ready';
            $('previewStatus').className = 'status ready';
            checkExportReady();
            scalePreview();
        } catch (err) {
            console.error(err);
            $('previewStatus').textContent = '❌ Error';
            $('previewStatus').className = 'status error';
        }
    };
}

// ============================================
// EXAMPLES
// ============================================
function setupExamples() {
    $('loadExampleBtn').onclick = () => {
        const key = $('exampleTemplate').value;
        if (!key || !EXAMPLES[key]) {
            alert('Please select an example template first.');
            return;
        }
        if ($('htmlEditor').value.trim() && !confirm('This will replace your current HTML. Continue?')) {
            return;
        }
        $('htmlEditor').value = EXAMPLES[key];
        applyHTML();
    };
}

// ============================================
// AUDIO
// ============================================
function setupAudioUpload() {
    const dz = $('dropZone');
    const input = $('audioInput');

    dz.addEventListener('click', (e) => {
        e.preventDefault();
        input.click();
    });

    ['dragenter', 'dragover'].forEach(evt => {
        dz.addEventListener(evt, (e) => {
            e.preventDefault();
            dz.classList.add('drag');
        });
    });
    ['dragleave', 'drop'].forEach(evt => {
        dz.addEventListener(evt, (e) => {
            e.preventDefault();
            dz.classList.remove('drag');
        });
    });
    dz.addEventListener('drop', (e) => {
        if (e.dataTransfer.files[0]) handleAudio(e.dataTransfer.files[0]);
    });
    input.addEventListener('change', (e) => {
        if (e.target.files[0]) handleAudio(e.target.files[0]);
    });
}

async function handleAudio(file) {
    $('dropZoneText').innerHTML = '⏳ Loading...';
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!state.audioCtx) state.audioCtx = new AudioCtx();
        if (state.audioCtx.state === 'suspended') await state.audioCtx.resume();

        state.audio = file;
        const arrayBuffer = await file.arrayBuffer();
        state.audioBuffer = await new Promise((res, rej) => {
            state.audioCtx.decodeAudioData(arrayBuffer.slice(0), res, rej);
        });
        state.duration = state.audioBuffer.duration;

        $('audioMeta').innerHTML = `🎵 <strong>${file.name}</strong> | ${formatTime(state.duration)}`;
        $('audioMeta').classList.remove('hidden');
        $('dropZoneText').innerHTML = `✅ <strong>${file.name}</strong>`;
        $('scrubber').max = state.duration;
        $('playBtn').disabled = false;
        checkExportReady();
        updatePlayback(0);
    } catch (err) {
        console.error(err);
        alert('Could not load audio: ' + err.message);
        $('dropZoneText').innerHTML = '❌ Click to retry';
    } finally {
        $('audioInput').value = '';
    }
}

// ============================================
// VIDEO SIZE
// ============================================
function updateAspectRatio() {
    $('aspectRatio').addEventListener('change', () => {
        const [w, h] = $('aspectRatio').value.split('x').map(Number);
        state.width = w;
        state.height = h;
        scalePreview();
    });

    $('fps').addEventListener('change', () => {
        state.fps = parseInt($('fps').value);
    });

    // Set initial
    const [w, h] = $('aspectRatio').value.split('x').map(Number);
    state.width = w;
    state.height = h;
    scalePreview();
}

function scalePreview() {
    const wrap = document.querySelector('.preview-frame-wrap');
    const iframe = $('previewFrame');

    // Set actual iframe size to video dimensions
    iframe.style.width = `${state.width}px`;
    iframe.style.height = `${state.height}px`;

    // Calculate scale
    const maxW = wrap.clientWidth - 20;
    const maxH = wrap.clientHeight - 20;
    const scale = Math.min(maxW / state.width, maxH / state.height, 1);
    iframe.style.transform = `scale(${scale})`;
}

// ============================================
// PLAYER
// ============================================
function setupPlayer() {
    $('playBtn').onclick = togglePlay;
    $('scrubber').oninput = (e) => {
        state.currentTime = parseFloat(e.target.value);
        updatePlayback(state.currentTime);
    };
}

function togglePlay() {
    if (state.isPlaying) pauseAudio();
    else playAudio();
}

function playAudio() {
    if (!state.audioBuffer) return;
    state.isPlaying = true;
    $('playBtn').textContent = '⏸';

    state.sourceNode = state.audioCtx.createBufferSource();
    state.sourceNode.buffer = state.audioBuffer;
    state.sourceNode.connect(state.audioCtx.destination);

    const offset = state.currentTime;
    state.startTimestamp = state.audioCtx.currentTime - offset;
    state.sourceNode.start(0, offset);

    function loop() {
        if (!state.isPlaying) return;
        state.currentTime = state.audioCtx.currentTime - state.startTimestamp;
        if (state.currentTime >= state.duration) {
            pauseAudio();
            state.currentTime = 0;
            updatePlayback(0);
            return;
        }
        updatePlayback(state.currentTime);
        state.animFrameId = requestAnimationFrame(loop);
    }
    loop();
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

function updatePlayback(time) {
    $('scrubber').value = time;
    $('timeDisplay').textContent = `${formatTime(time)} / ${formatTime(state.duration)}`;

    // Call the user's HTML __updateAtTime function
    const iframe = $('previewFrame');
    try {
        if (iframe.contentWindow && iframe.contentWindow.__updateAtTime) {
            iframe.contentWindow.__updateAtTime(time);
        }
    } catch(e) {
        // Silent fail
    }
}

// ============================================
// PROJECTS (Save/Load in localStorage)
// ============================================
function setupProjects() {
    $('saveBtn').onclick = saveProject;
    $('newBtn').onclick = newProject;
    $('showProjectsBtn').onclick = toggleProjectsList;
}

function saveProject() {
    const name = $('projectName').value.trim();
    if (!name) return alert('Enter a project name!');

    const project = {
        name,
        html: $('htmlEditor').value,
        aspectRatio: $('aspectRatio').value,
        fps: $('fps').value,
        savedAt: new Date().toISOString()
    };

    const projects = JSON.parse(localStorage.getItem('htmlVideoProjects') || '{}');
    projects[name] = project;
    localStorage.setItem('htmlVideoProjects', JSON.stringify(projects));
    alert(`✅ Saved "${name}"`);
}

function newProject() {
    if ($('htmlEditor').value.trim() && !confirm('Start new project? Current work will be cleared.')) return;
    $('projectName').value = 'my-video';
    $('htmlEditor').value = '';
    $('previewFrame').srcdoc = '';
    $('previewStatus').textContent = 'Waiting for HTML...';
    $('previewStatus').className = 'status';
    state.userHTML = '';
    state.htmlApplied = false;
    checkExportReady();
}

function toggleProjectsList() {
    const list = $('projectsList');
    list.classList.toggle('hidden');
    if (!list.classList.contains('hidden')) renderProjects();
}

function renderProjects() {
    const projects = JSON.parse(localStorage.getItem('htmlVideoProjects') || '{}');
    const list = $('projectsList');
    const keys = Object.keys(projects);
    if (keys.length === 0) {
        list.innerHTML = '<p style="font-size:0.7rem;color:var(--text-muted);padding:8px;">No saved projects</p>';
        return;
    }
    list.innerHTML = keys.map(name => `
        <div class="project-item">
            <span onclick="window._loadProject('${escapeAttr(name)}')">📄 ${escapeHtml(name)}</span>
            <button onclick="window._deleteProject('${escapeAttr(name)}')">🗑️</button>
        </div>
    `).join('');
}

window._loadProject = (name) => {
    const projects = JSON.parse(localStorage.getItem('htmlVideoProjects') || '{}');
    const p = projects[name];
    if (!p) return;
    $('projectName').value = p.name;
    $('htmlEditor').value = p.html;
    $('aspectRatio').value = p.aspectRatio;
    $('fps').value = p.fps;
    updateAspectRatio();
    applyHTML();
    $('projectsList').classList.add('hidden');
};

window._deleteProject = (name) => {
    if (!confirm(`Delete "${name}"?`)) return;
    const projects = JSON.parse(localStorage.getItem('htmlVideoProjects') || '{}');
    delete projects[name];
    localStorage.setItem('htmlVideoProjects', JSON.stringify(projects));
    renderProjects();
};

// ============================================
// EXPORT (Iframe → Canvas → Video)
// ============================================
function setupExport() {
    $('exportBtn').onclick = () => renderVideo($('exportFormat').value);
    $('cancelExportBtn').onclick = () => { state.exportCancelled = true; };
}

function checkExportReady() {
    $('exportBtn').disabled = !(state.audioBuffer && state.htmlApplied);
}

/**
 * Convert current iframe frame to canvas.
 * This uses SVG foreignObject with the iframe's document.
 */
async function iframeToCanvas(canvas, w, h) {
    return new Promise((resolve, reject) => {
        const iframe = $('previewFrame');
        const doc = iframe.contentDocument;
        if (!doc) return reject(new Error('No iframe document'));

        // Get the full HTML of the iframe (current state, including live JS updates)
        const docClone = doc.documentElement.cloneNode(true);

        // Remove <script> tags to prevent execution in SVG
        docClone.querySelectorAll('script').forEach(s => s.remove());

        // Serialize
        const html = new XMLSerializer().serializeToString(docClone);

        // Wrap in SVG foreignObject
        const svg = `
            <svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
                <foreignObject width="100%" height="100%">
                    <html xmlns="http://www.w3.org/1999/xhtml" style="width:${w}px;height:${h}px;">
                        ${html.replace(/<html[^>]*>|<\/html>/g, '')}
                    </html>
                </foreignObject>
            </svg>
        `;

        const img = new Image();
        const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);

        img.onload = () => {
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, w, h);
            ctx.drawImage(img, 0, 0, w, h);
            URL.revokeObjectURL(url);
            resolve();
        };
        img.onerror = (e) => {
            URL.revokeObjectURL(url);
            reject(new Error('Frame render failed. Check your HTML for external resources or errors.'));
        };
        img.src = url;
    });
}

async function renderVideo(format) {
    if (!state.audioBuffer) return alert('Upload audio first!');
    if (!state.htmlApplied) return alert('Apply your HTML first!');

    pauseAudio();
    state.exportCancelled = false;

    $('exportModal').classList.remove('hidden');
    $('exportTitle').textContent = `Exporting ${format.toUpperCase()}...`;
    $('exportProgress').style.width = '0%';
    $('exportDetail').textContent = 'Preparing...';

    const canvas = $('exportCanvas');
    const w = state.width;
    const h = state.height;
    const fps = state.fps;

    try {
        if (format === 'webm') {
            await exportWebM(canvas, w, h, fps);
        } else {
            await exportMP4(canvas, w, h, fps);
        }
    } catch (err) {
        console.error(err);
        if (!state.exportCancelled) alert('Export failed: ' + err.message);
    } finally {
        $('exportModal').classList.add('hidden');
    }
}

async function exportWebM(canvas, w, h, fps) {
    canvas.width = w;
    canvas.height = h;

    const stream = canvas.captureStream(fps);

    // Audio
    const audioCtx = new AudioContext();
    const src = audioCtx.createBufferSource();
    src.buffer = state.audioBuffer;
    const dest = audioCtx.createMediaStreamDestination();
    src.connect(dest);
    stream.addTrack(dest.stream.getAudioTracks()[0]);

    const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
        ? 'video/webm;codecs=vp9,opus' : 'video/webm';
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 5000000 });
    const chunks = [];
    rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };

    return new Promise((resolve, reject) => {
        rec.onstop = () => {
            const blob = new Blob(chunks, { type: mime });
            downloadBlob(blob, `${$('projectName').value || 'video'}.webm`);
            resolve();
        };
        rec.onerror = reject;

        rec.start();
        src.start(0);

        const t0 = performance.now();
        async function loop() {
            if (state.exportCancelled) {
                rec.stop(); src.stop();
                reject(new Error('Cancelled'));
                return;
            }
            const el = (performance.now() - t0) / 1000;
            if (el >= state.duration) {
                rec.stop(); src.stop();
                return;
            }
            updatePlayback(el);
            try { await iframeToCanvas(canvas, w, h); } catch(e) { console.warn(e); }
            const pct = Math.round((el / state.duration) * 100);
            $('exportProgress').style.width = `${pct}%`;
            $('exportDetail').textContent = `Recording: ${pct}%`;
            requestAnimationFrame(loop);
        }
        loop();
    });
}

async function exportMP4(canvas, w, h, fps) {
    const { FFmpeg } = FFmpegWASM;
    const { fetchFile } = FFmpegUtil;

    $('exportDetail').textContent = 'Loading FFmpeg...';
    const ffmpeg = new FFmpeg();
    await ffmpeg.load({
        coreURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js',
        wasmURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.wasm'
    });

    $('exportDetail').textContent = 'Preparing audio...';
    const audioData = await fetchFile(state.audio);
    await ffmpeg.writeFile('audio.mp3', audioData);

    const totalFrames = Math.ceil(state.duration * fps);
    for (let i = 0; i < totalFrames; i++) {
        if (state.exportCancelled) throw new Error('Cancelled');
        const frameTime = i / fps;
        updatePlayback(frameTime);

        // Wait for DOM to update
        await new Promise(r => setTimeout(r, 20));

        await iframeToCanvas(canvas, w, h);
        const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
        const buffer = new Uint8Array(await blob.arrayBuffer());
        await ffmpeg.writeFile(`f_${String(i).padStart(6, '0')}.png`, buffer);

        if (i % 3 === 0) {
            const pct = Math.round((i / totalFrames) * 80);
            $('exportProgress').style.width = `${pct}%`;
            $('exportDetail').textContent = `Frame ${i}/${totalFrames} (${pct}%)`;
        }
    }

    $('exportDetail').textContent = 'Encoding MP4...';
    $('exportProgress').style.width = '85%';

    await ffmpeg.exec([
        '-framerate', String(fps),
        '-i', 'f_%06d.png',
        '-i', 'audio.mp3',
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac',
        '-shortest',
        '-y',
        'output.mp4'
    ]);

    const data = await ffmpeg.readFile('output.mp4');
    downloadBlob(new Blob([data.buffer], { type: 'video/mp4' }), `${$('projectName').value || 'video'}.mp4`);

    $('exportProgress').style.width = '100%';
    $('exportDetail').textContent = '✅ Done! Downloading...';
    await new Promise(r => setTimeout(r, 1500));

    // Cleanup
    for (let i = 0; i < totalFrames; i++) {
        try { await ffmpeg.deleteFile(`f_${String(i).padStart(6, '0')}.png`); } catch(e){}
    }
    try { await ffmpeg.deleteFile('audio.mp3'); } catch(e){}
    try { await ffmpeg.deleteFile('output.mp4'); } catch(e){}
}

// ============================================
// UTILS
// ============================================
function formatTime(s) {
    if (!s || isNaN(s)) return '0:00';
    return `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;
}
function escapeHtml(t) {
    const d = document.createElement('div');
    d.textContent = t;
    return d.innerHTML;
}
function escapeAttr(t) {
    return String(t).replace(/'/g, "\\'").replace(/"/g, '&quot;');
}
function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
}
