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
    width: 1280,
    height: 720,
    fps: 30,
    animFrameId: null,
    startTimestamp: 0,
    exportCancelled: false,
    htmlApplied: false,
    scenes: [],
    editingSceneId: null,
    currentSceneImage: null
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
    setupScenes();
    updateAspectRatio();
    scalePreview();
    renderScenesList();
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
            $('htmlLayer').innerHTML = '';
            state.htmlApplied = false;
            $('previewStatus').textContent = 'Waiting...';
            $('previewStatus').className = 'status';
            checkExportReady();
        }
    };
    editor.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
            e.preventDefault();
            const start = editor.selectionStart;
            editor.value = editor.value.substring(0, start) + '    ' + editor.value.substring(editor.selectionEnd);
            editor.selectionStart = editor.selectionEnd = start + 4;
        }
    });
}

function applyHTML() {
    const html = $('htmlEditor').value.trim();
    if (!html) return alert('Paste HTML first!');

    const layer = $('htmlLayer');
    
    // Extract body content and styles from user HTML
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // Get styles
    const styles = doc.querySelectorAll('style');
    let styleContent = '';
    styles.forEach(s => { styleContent += s.innerHTML; });
    
    // Get body content
    const bodyContent = doc.body ? doc.body.innerHTML : html;
    
    // Get body inline styles
    const bodyStyles = doc.body ? doc.body.getAttribute('style') || '' : '';
    
    // Inject scoped
    layer.innerHTML = `
        <style>
            .html-layer > .user-content { 
                width: 100%; 
                height: 100%; 
                ${bodyStyles}
            }
            ${styleContent.replace(/body\s*[,{]/g, '.user-content$&').replace(/html\s*[,{]/g, '.user-content$&')}
        </style>
        <div class="user-content">${bodyContent}</div>
    `;
    
    // Execute scripts
    doc.querySelectorAll('script').forEach(oldScript => {
        try {
            const newScript = document.createElement('script');
            newScript.textContent = oldScript.textContent;
            // Execute in global scope so __updateAtTime is accessible
            eval(oldScript.textContent);
        } catch(e) {
            console.warn('Script error:', e);
        }
    });
    
    state.htmlApplied = true;
    $('previewStatus').textContent = '✅ Ready';
    $('previewStatus').className = 'status ready';
    checkExportReady();
    updatePlayback(0);
}

// ============================================
// EXAMPLES
// ============================================
function setupExamples() {
    $('loadExampleBtn').onclick = () => {
        const key = $('exampleTemplate').value;
        if (!key || !EXAMPLES[key]) return alert('Select a template!');
        if ($('htmlEditor').value.trim() && !confirm('Replace current HTML?')) return;
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
    dz.onclick = (e) => { e.preventDefault(); input.click(); };
    dz.ondragover = e => { e.preventDefault(); dz.classList.add('drag'); };
    dz.ondragleave = () => dz.classList.remove('drag');
    dz.ondrop = e => { 
        e.preventDefault(); 
        dz.classList.remove('drag'); 
        if (e.dataTransfer.files[0]) handleAudio(e.dataTransfer.files[0]); 
    };
    input.onchange = e => { if (e.target.files[0]) handleAudio(e.target.files[0]); };
}

async function handleAudio(file) {
    $('dropZoneText').innerHTML = '⏳ Loading...';
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!state.audioCtx) state.audioCtx = new AudioCtx();
        if (state.audioCtx.state === 'suspended') await state.audioCtx.resume();
        
        state.audio = file;
        const arrayBuf = await file.arrayBuffer();
        state.audioBuffer = await new Promise((res, rej) => { 
            state.audioCtx.decodeAudioData(arrayBuf.slice(0), res, rej); 
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
// SCENES
// ============================================
function setupScenes() {
    $('addSceneBtn').onclick = () => {
        state.editingSceneId = null;
        state.currentSceneImage = null;
        $('sceneName').value = `Scene ${state.scenes.length + 1}`;
        $('sceneStart').value = state.scenes.length > 0 
            ? state.scenes[state.scenes.length - 1].end 
            : 0;
        $('sceneEnd').value = parseFloat($('sceneStart').value) + 10;
        $('sceneBgType').value = 'gradient';
        $('sceneColor1').value = '#667eea';
        $('sceneColor2').value = '#764ba2';
        $('sceneSolidColor').value = '#1a1a2e';
        $('sceneEffect').value = 'none';
        $('sceneImagePreview').innerHTML = '';
        toggleSceneBgType();
        $('sceneModal').classList.remove('hidden');
    };

    $('sceneBgType').onchange = toggleSceneBgType;

    $('sceneImageInput').onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            state.currentSceneImage = reader.result;
            $('sceneImagePreview').innerHTML = `<img src="${reader.result}" style="max-width:100%;max-height:120px;border-radius:6px;">`;
        };
        reader.readAsDataURL(file);
    };

    $('saveSceneBtn').onclick = saveScene;
    $('cancelSceneBtn').onclick = () => $('sceneModal').classList.add('hidden');
}

function toggleSceneBgType() {
    const type = $('sceneBgType').value;
    $('sceneGradient').classList.toggle('hidden', type !== 'gradient');
    $('sceneSolid').classList.toggle('hidden', type !== 'solid');
    $('sceneImage').classList.toggle('hidden', type !== 'image');
}

function saveScene() {
    const scene = {
        id: state.editingSceneId || Date.now(),
        name: $('sceneName').value || `Scene ${state.scenes.length + 1}`,
        start: parseFloat($('sceneStart').value) || 0,
        end: parseFloat($('sceneEnd').value) || 10,
        bgType: $('sceneBgType').value,
        color1: $('sceneColor1').value,
        color2: $('sceneColor2').value,
        solidColor: $('sceneSolidColor').value,
        image: state.currentSceneImage,
        effect: $('sceneEffect').value
    };

    // If editing, preserve existing image if not changed
    if (state.editingSceneId) {
        const existing = state.scenes.find(s => s.id === state.editingSceneId);
        if (existing && !state.currentSceneImage && scene.bgType === 'image') {
            scene.image = existing.image;
        }
        state.scenes = state.scenes.map(s => s.id === state.editingSceneId ? scene : s);
    } else {
        state.scenes.push(scene);
    }

    state.scenes.sort((a, b) => a.start - b.start);
    renderScenesList();
    $('sceneModal').classList.add('hidden');
    updatePlayback(state.currentTime);
}

function renderScenesList() {
    const list = $('scenesList');
    if (state.scenes.length === 0) {
        list.innerHTML = '<p class="hint">No scenes yet. Click "Add New Scene" to start.</p>';
        return;
    }
    list.innerHTML = state.scenes.map(s => {
        let thumb = '';
        if (s.bgType === 'gradient') thumb = `background:linear-gradient(135deg,${s.color1},${s.color2});`;
        else if (s.bgType === 'solid') thumb = `background:${s.solidColor};`;
        else if (s.image) thumb = `background-image:url(${s.image});`;
        
        return `
            <div class="scene-item">
                <div class="scene-thumb" style="${thumb}"></div>
                <div class="scene-info" onclick="window._editScene(${s.id})">
                    <div class="name">${escapeHtml(s.name)}</div>
                    <div class="time">${formatTime(s.start)} → ${formatTime(s.end)}</div>
                </div>
                <div class="scene-actions">
                    <button onclick="window._editScene(${s.id})" title="Edit">✏️</button>
                    <button class="delete" onclick="window._deleteScene(${s.id})" title="Delete">🗑️</button>
                </div>
            </div>
        `;
    }).join('');
}

window._editScene = (id) => {
    const scene = state.scenes.find(s => s.id === id);
    if (!scene) return;
    state.editingSceneId = id;
    state.currentSceneImage = scene.image;
    $('sceneName').value = scene.name;
    $('sceneStart').value = scene.start;
    $('sceneEnd').value = scene.end;
    $('sceneBgType').value = scene.bgType;
    $('sceneColor1').value = scene.color1;
    $('sceneColor2').value = scene.color2;
    $('sceneSolidColor').value = scene.solidColor;
    $('sceneEffect').value = scene.effect;
    $('sceneImagePreview').innerHTML = scene.image ? `<img src="${scene.image}" style="max-width:100%;max-height:120px;border-radius:6px;">` : '';
    toggleSceneBgType();
    $('sceneModal').classList.remove('hidden');
};

window._deleteScene = (id) => {
    if (!confirm('Delete this scene?')) return;
    state.scenes = state.scenes.filter(s => s.id !== id);
    renderScenesList();
    updatePlayback(state.currentTime);
};

function updateSceneAtTime(time) {
    const layer = $('sceneLayer');
    const active = state.scenes.find(s => time >= s.start && time <= s.end);
    
    if (!active) {
        layer.style.background = 'linear-gradient(135deg, #1a1a2e, #16213e)';
        layer.style.backgroundImage = '';
        layer.className = 'scene-layer';
        return;
    }

    // Apply background
    if (active.bgType === 'gradient') {
        layer.style.background = `linear-gradient(135deg, ${active.color1}, ${active.color2})`;
        layer.style.backgroundImage = '';
    } else if (active.bgType === 'solid') {
        layer.style.background = active.solidColor;
        layer.style.backgroundImage = '';
    } else if (active.bgType === 'image' && active.image) {
        layer.style.background = `#000`;
        layer.style.backgroundImage = `url(${active.image})`;
        layer.style.backgroundSize = 'cover';
        layer.style.backgroundPosition = 'center';
    }

    // Apply effect class
    layer.className = 'scene-layer';
    if (active.effect && active.effect !== 'none') {
        layer.classList.add(`scene-${active.effect}`);
    }
}

// ============================================
// VIDEO SIZE
// ============================================
function updateAspectRatio() {
    $('aspectRatio').onchange = () => {
        const [w, h] = $('aspectRatio').value.split('x').map(Number);
        state.width = w;
        state.height = h;
        $('videoStage').style.width = `${w}px`;
        $('videoStage').style.height = `${h}px`;
        scalePreview();
    };
    $('fps').onchange = () => { state.fps = parseInt($('fps').value); };
    const [w, h] = $('aspectRatio').value.split('x').map(Number);
    state.width = w;
    state.height = h;
    $('videoStage').style.width = `${w}px`;
    $('videoStage').style.height = `${h}px`;
}

function scalePreview() {
    const wrap = document.querySelector('.stage-wrap');
    const stage = $('videoStage');
    if (!wrap || !stage) return;
    const scale = Math.min(
        (wrap.clientWidth - 20) / state.width, 
        (wrap.clientHeight - 20) / state.height, 
        1
    );
    stage.style.transform = `scale(${scale})`;
}

// ============================================
// PLAYER
// ============================================
function setupPlayer() {
    $('playBtn').onclick = togglePlay;
    $('scrubber').oninput = e => {
        state.currentTime = parseFloat(e.target.value);
        updatePlayback(state.currentTime);
    };
}

function togglePlay() {
    state.isPlaying ? pauseAudio() : playAudio();
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
    
    // Update scene
    updateSceneAtTime(time);
    
    // Update HTML captions
    try {
        if (window.__updateAtTime) window.__updateAtTime(time);
    } catch(e) {}
}

// ============================================
// PROJECTS
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
        scenes: state.scenes,
        savedAt: new Date().toISOString()
    };
    const projects = JSON.parse(localStorage.getItem('htmlVideoProjects') || '{}');
    projects[name] = project;
    localStorage.setItem('htmlVideoProjects', JSON.stringify(projects));
    alert(`✅ Saved "${name}"`);
}

function newProject() {
    if (!confirm('Start new project? Current work will be lost.')) return;
    $('projectName').value = 'my-video';
    $('htmlEditor').value = '';
    $('htmlLayer').innerHTML = '';
    state.scenes = [];
    state.htmlApplied = false;
    renderScenesList();
    $('previewStatus').textContent = 'Waiting...';
    $('previewStatus').className = 'status';
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
        list.innerHTML = '<p class="hint">No saved projects.</p>';
        return;
    }
    list.innerHTML = keys.map(name => `
        <div class="project-item">
            <span onclick="window._loadProject('${name.replace(/'/g, "\\'")}')">📄 ${escapeHtml(name)}</span>
            <button onclick="window._deleteProject('${name.replace(/'/g, "\\'")}')">🗑️</button>
        </div>
    `).join('');
}

window._loadProject = (name) => {
    const p = JSON.parse(localStorage.getItem('htmlVideoProjects') || '{}')[name];
    if (!p) return;
    $('projectName').value = p.name;
    $('htmlEditor').value = p.html;
    $('aspectRatio').value = p.aspectRatio;
    $('fps').value = p.fps;
    state.scenes = p.scenes || [];
    updateAspectRatio();
    renderScenesList();
    applyHTML();
    $('projectsList').classList.add('hidden');
};

window._deleteProject = (name) => {
    if (!confirm(`Delete "${name}"?`)) return;
    const p = JSON.parse(localStorage.getItem('htmlVideoProjects') || '{}');
    delete p[name];
    localStorage.setItem('htmlVideoProjects', JSON.stringify(p));
    renderProjects();
};

// ============================================
// EXPORT (Fixed with html2canvas)
// ============================================
function setupExport() {
    $('exportBtn').onclick = () => renderVideo($('exportFormat').value);
    $('cancelExportBtn').onclick = () => { state.exportCancelled = true; };
}

function checkExportReady() {
    $('exportBtn').disabled = !state.audioBuffer;
}

async function captureStageToCanvas(canvas) {
    const stage = $('videoStage');
    try {
        const rendered = await html2canvas(stage, {
            width: state.width,
            height: state.height,
            backgroundColor: '#000000',
            scale: 1,
            logging: false,
            useCORS: true,
            allowTaint: true
        });
        canvas.width = state.width;
        canvas.height = state.height;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, state.width, state.height);
        ctx.drawImage(rendered, 0, 0, state.width, state.height);
        return true;
    } catch (err) {
        console.error('Capture error:', err);
        return false;
    }
}

async function renderVideo(format) {
    if (!state.audioBuffer) return alert('Upload audio first!');
    pauseAudio();
    state.exportCancelled = false;
    
    $('exportModal').classList.remove('hidden');
    $('exportTitle').textContent = `Exporting ${format.toUpperCase()}...`;
    $('exportProgress').style.width = '0%';
    $('exportDetail').textContent = 'Starting...';
    
    const canvas = $('exportCanvas');
    
    try {
        if (format === 'webm') {
            await exportWebM(canvas);
        } else {
            await exportMP4(canvas);
        }
    } catch (err) {
        console.error(err);
        if (!state.exportCancelled) alert('Export failed: ' + err.message);
    } finally {
        $('exportModal').classList.add('hidden');
    }
}

async function exportWebM(canvas) {
    const w = state.width, h = state.height, fps = state.fps;
    canvas.width = w;
    canvas.height = h;
    
    // Do initial capture to make sure canvas is ready
    await captureStageToCanvas(canvas);
    
    const stream = canvas.captureStream(fps);
    
    // Setup audio
    const audioCtx = new AudioContext();
    const src = audioCtx.createBufferSource();
    src.buffer = state.audioBuffer;
    const dest = audioCtx.createMediaStreamDestination();
    src.connect(dest);
    stream.addTrack(dest.stream.getAudioTracks()[0]);
    
    // Pick supported mime
    let mime = 'video/webm';
    if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')) {
        mime = 'video/webm;codecs=vp9,opus';
    } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')) {
        mime = 'video/webm;codecs=vp8,opus';
    }
    
    const rec = new MediaRecorder(stream, { 
        mimeType: mime, 
        videoBitsPerSecond: 3000000 
    });
    
    const chunks = [];
    rec.ondataavailable = e => { 
        if (e.data && e.data.size > 0) chunks.push(e.data); 
    };
    
    return new Promise((resolve, reject) => {
        rec.onstop = () => {
            console.log(`Recorded ${chunks.length} chunks`);
            if (chunks.length === 0) {
                reject(new Error('No video data recorded'));
                return;
            }
            const blob = new Blob(chunks, { type: mime });
            console.log(`Blob size: ${blob.size} bytes`);
            downloadBlob(blob, `${$('projectName').value || 'video'}.webm`);
            resolve();
        };
        rec.onerror = (e) => {
            console.error('Recorder error:', e);
            reject(new Error('Recording failed'));
        };
        
        rec.start(100); // Collect data every 100ms
        src.start(0);
        
        const t0 = performance.now();
        
        async function loop() {
            if (state.exportCancelled) {
                rec.stop();
                try { src.stop(); } catch(e){}
                reject(new Error('Cancelled'));
                return;
            }
            
            const el = (performance.now() - t0) / 1000;
            
            if (el >= state.duration) {
                // Ensure last frame captured
                updatePlayback(state.duration - 0.01);
                await captureStageToCanvas(canvas);
                await new Promise(r => setTimeout(r, 200));
                rec.stop();
                try { src.stop(); } catch(e){}
                return;
            }
            
            updatePlayback(el);
            await captureStageToCanvas(canvas);
            
            const pct = Math.round((el / state.duration) * 100);
            $('exportProgress').style.width = `${pct}%`;
            $('exportDetail').textContent = `Recording: ${pct}% (${formatTime(el)} / ${formatTime(state.duration)})`;
            
            requestAnimationFrame(loop);
        }
        loop();
    });
}

async function exportMP4(canvas) {
    const w = state.width, h = state.height, fps = state.fps;
    
    if (typeof FFmpegWASM === 'undefined') {
        return alert('FFmpeg not loaded. Try WebM instead.');
    }
    
    const { FFmpeg } = FFmpegWASM;
    const { fetchFile } = FFmpegUtil;
    
    $('exportDetail').textContent = 'Loading FFmpeg (first time may take a moment)...';
    const ffmpeg = new FFmpeg();
    
    try {
        await ffmpeg.load({
            coreURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js',
            wasmURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.wasm'
        });
    } catch (err) {
        throw new Error('FFmpeg failed to load. Use WebM instead. Error: ' + err.message);
    }
    
    $('exportDetail').textContent = 'Preparing audio...';
    const audioData = await fetchFile(state.audio);
    await ffmpeg.writeFile('audio.mp3', audioData);
    
    const totalFrames = Math.ceil(state.duration * fps);
    
    for (let i = 0; i < totalFrames; i++) {
        if (state.exportCancelled) throw new Error('Cancelled');
        
        const frameTime = i / fps;
        updatePlayback(frameTime);
        
        // Wait for DOM to update
        await new Promise(r => setTimeout(r, 30));
        
        await captureStageToCanvas(canvas);
        
        const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.9));
        if (!blob) continue;
        
        const buffer = new Uint8Array(await blob.arrayBuffer());
        await ffmpeg.writeFile(`f_${String(i).padStart(6, '0')}.jpg`, buffer);
        
        if (i % 3 === 0) {
            const pct = Math.round((i / totalFrames) * 80);
            $('exportProgress').style.width = `${pct}%`;
            $('exportDetail').textContent = `Rendering frame ${i}/${totalFrames}`;
        }
    }
    
    $('exportDetail').textContent = 'Encoding MP4...';
    $('exportProgress').style.width = '85%';
    
    await ffmpeg.exec([
        '-framerate', String(fps),
        '-i', 'f_%06d.jpg',
        '-i', 'audio.mp3',
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac',
        '-shortest',
        '-y',
        'output.mp4'
    ]);
    
    const data = await ffmpeg.readFile('output.mp4');
    const blob = new Blob([data.buffer], { type: 'video/mp4' });
    downloadBlob(blob, `${$('projectName').value || 'video'}.mp4`);
    
    // Cleanup
    for (let i = 0; i < totalFrames; i++) {
        try { await ffmpeg.deleteFile(`f_${String(i).padStart(6, '0')}.jpg`); } catch(e){}
    }
    try { 
        await ffmpeg.deleteFile('audio.mp3'); 
        await ffmpeg.deleteFile('output.mp4'); 
    } catch(e){}
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

function downloadBlob(blob, filename) {
    console.log(`Downloading: ${filename}, size: ${blob.size} bytes`);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 1000);
}
