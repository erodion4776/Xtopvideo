const state = {
    audio: null,
    audioBuffer: null,
    audioCtx: null,
    sourceNode: null,
    duration: 60,
    currentTime: 0,
    isPlaying: false,
    width: 1280,
    height: 720,
    images: [],         // Array of { id, name, dataUrl }
    imageUrls: [],      // Array of blob URLs passed to HTML
    animFrameId: null,
    startTimestamp: 0,
    htmlApplied: false,
    exportCancelled: false
};

const $ = id => document.getElementById(id);

// ============================================
// INIT
// ============================================
window.addEventListener('DOMContentLoaded', () => {
    setupAudio();
    setupImageUpload();
    setupEditor();
    setupPlayer();
    setupExport();
    setupProjects();
    setupTemplates();
    updateSize();
    scaleStage();
    window.addEventListener('resize', scaleStage);
});

// ============================================
// AUDIO
// ============================================
function setupAudio() {
    const dz = $('audioDropZone');
    const inp = $('audioInput');
    dz.onclick = e => { e.preventDefault(); inp.click(); };
    dz.ondragover = e => { e.preventDefault(); dz.classList.add('drag'); };
    dz.ondragleave = () => dz.classList.remove('drag');
    dz.ondrop = e => { e.preventDefault(); dz.classList.remove('drag'); if(e.dataTransfer.files[0]) loadAudio(e.dataTransfer.files[0]); };
    inp.onchange = e => { if(e.target.files[0]) loadAudio(e.target.files[0]); };
}

async function loadAudio(file) {
    $('audioDropText').textContent = '⏳ Loading...';
    try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!state.audioCtx) state.audioCtx = new AC();
        if (state.audioCtx.state === 'suspended') await state.audioCtx.resume();
        state.audio = file;
        const buf = await file.arrayBuffer();
        state.audioBuffer = await new Promise((res, rej) => { state.audioCtx.decodeAudioData(buf.slice(0), res, rej); });
        state.duration = state.audioBuffer.duration;
        $('audioMeta').innerHTML = `🎵 <b>${file.name}</b> | ${fmt(state.duration)}`;
        $('audioMeta').classList.remove('hidden');
        $('audioDropText').innerHTML = `✅ <b>${file.name}</b>`;
        $('scrubber').max = state.duration;
        $('playBtn').disabled = false;
        checkReady();
        update(0);
    } catch(e) {
        alert('Audio error: ' + e.message);
        $('audioDropText').textContent = '❌ Click to retry';
    } finally { $('audioInput').value = ''; }
}

// ============================================
// BULK IMAGE UPLOAD
// ============================================
function setupImageUpload() {
    const dz = $('imageDropZone');
    const inp = $('imageInput');
    dz.onclick = e => { e.preventDefault(); inp.click(); };
    dz.ondragover = e => { e.preventDefault(); dz.classList.add('drag'); };
    dz.ondragleave = () => dz.classList.remove('drag');
    dz.ondrop = e => { e.preventDefault(); dz.classList.remove('drag'); handleImages(e.dataTransfer.files); };
    inp.onchange = e => { handleImages(e.target.files); };
}

function handleImages(files) {
    if (!files || files.length === 0) return;
    
    const fileArray = Array.from(files).filter(f => f.type.startsWith('image/'));
    
    // Sort by name for consistent ordering
    fileArray.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    
    let loaded = 0;
    $('imageDropText').textContent = `⏳ Loading ${fileArray.length} images...`;
    
    fileArray.forEach((file, idx) => {
        const reader = new FileReader();
        reader.onload = () => {
            state.images.push({
                id: Date.now() + idx,
                name: file.name,
                dataUrl: reader.result
            });
            loaded++;
            if (loaded === fileArray.length) {
                rebuildImageUrls();
                renderImageList();
                $('imageDropText').textContent = `✅ ${state.images.length} images loaded`;
                if (state.htmlApplied) applyHTML();
            }
        };
        reader.readAsDataURL(file);
    });
}

function rebuildImageUrls() {
    state.imageUrls = state.images.map(img => img.dataUrl);
    window.__images = state.imageUrls;
}

function renderImageList() {
    const list = $('imageList');
    if (state.images.length === 0) {
        list.innerHTML = '';
        return;
    }
    
    list.innerHTML = state.images.map((img, i) => `
        <div class="img-thumb" draggable="true" 
             ondragstart="window._dragStart(event, ${i})"
             ondragover="window._dragOver(event, ${i})"
             ondrop="window._dragDrop(event, ${i})"
             ondragend="window._dragEnd(event)">
            <img src="${img.dataUrl}" alt="${img.name}">
            <div class="label">scene${i}</div>
            <button class="remove-img" onclick="window._removeImg(${i})">✕</button>
        </div>
    `).join('');
}

// Drag & Drop reordering
let dragIdx = null;

window._dragStart = (e, i) => {
    dragIdx = i;
    e.target.closest('.img-thumb').classList.add('dragging');
};

window._dragOver = (e, i) => {
    e.preventDefault();
    document.querySelectorAll('.img-thumb').forEach(el => el.classList.remove('dragover'));
    e.target.closest('.img-thumb')?.classList.add('dragover');
};

window._dragDrop = (e, i) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === i) return;
    const moved = state.images.splice(dragIdx, 1)[0];
    state.images.splice(i, 0, moved);
    rebuildImageUrls();
    renderImageList();
    if (state.htmlApplied) applyHTML();
};

window._dragEnd = (e) => {
    dragIdx = null;
    document.querySelectorAll('.img-thumb').forEach(el => {
        el.classList.remove('dragging', 'dragover');
    });
};

window._removeImg = (i) => {
    state.images.splice(i, 1);
    rebuildImageUrls();
    renderImageList();
    $('imageDropText').textContent = state.images.length > 0 
        ? `✅ ${state.images.length} images loaded` 
        : '📁 Upload Multiple Images';
    if (state.htmlApplied) applyHTML();
};

// ============================================
// HTML EDITOR
// ============================================
function setupEditor() {
    $('applyBtn').onclick = applyHTML;
    $('clearEditorBtn').onclick = () => {
        if (confirm('Clear editor?')) {
            $('htmlEditor').value = '';
            $('videoStage').innerHTML = '';
            state.htmlApplied = false;
            $('statusBadge').textContent = 'Waiting';
            $('statusBadge').className = 'badge';
            checkReady();
        }
    };
    
    $('htmlEditor').addEventListener('keydown', e => {
        if (e.key === 'Tab') {
            e.preventDefault();
            const s = e.target.selectionStart;
            e.target.value = e.target.value.substring(0, s) + '    ' + e.target.value.substring(e.target.selectionEnd);
            e.target.selectionStart = e.target.selectionEnd = s + 4;
        }
    });
}

function applyHTML() {
    const html = $('htmlEditor').value.trim();
    if (!html) return alert('Paste your HTML design first!');
    
    const stage = $('videoStage');
    
    // Set global variables BEFORE injecting HTML
    window.__images = state.imageUrls;
    window.__totalDuration = state.duration;
    
    // Parse user HTML
    const parser = new DOMParser();
    const doc = parser.parseFromString('<body>' + html + '</body>', 'text/html');
    
    // Extract styles
    let styles = '';
    doc.querySelectorAll('style').forEach(s => {
        styles += s.innerHTML;
        s.remove();
    });
    
    // Extract scripts
    const scripts = [];
    doc.querySelectorAll('script').forEach(s => {
        scripts.push(s.textContent);
        s.remove();
    });
    
    // Build stage content
    const bodyHTML = doc.body.innerHTML;
    
    stage.innerHTML = `
        <style>
            .video-stage {
                position: relative;
                width: ${state.width}px;
                height: ${state.height}px;
                overflow: hidden;
                background: #000;
            }
            ${styles}
        </style>
        ${bodyHTML}
    `;
    
    // Execute scripts in global scope
    scripts.forEach(code => {
        try {
            const fn = new Function(code);
            fn();
        } catch(e) {
            console.warn('Script error:', e);
        }
    });
    
    state.htmlApplied = true;
    $('statusBadge').textContent = '✅ Ready';
    $('statusBadge').className = 'badge ok';
    checkReady();
    update(state.currentTime);
}

// ============================================
// VIDEO SIZE
// ============================================
function updateSize() {
    $('aspectRatio').onchange = () => {
        const [w, h] = $('aspectRatio').value.split('x').map(Number);
        state.width = w;
        state.height = h;
        $('videoStage').style.width = w + 'px';
        $('videoStage').style.height = h + 'px';
        scaleStage();
        if (state.htmlApplied) applyHTML();
    };
    const [w, h] = $('aspectRatio').value.split('x').map(Number);
    state.width = w;
    state.height = h;
    $('videoStage').style.width = w + 'px';
    $('videoStage').style.height = h + 'px';
}

function scaleStage() {
    const wrap = document.querySelector('.stage-wrap');
    const stage = $('videoStage');
    if (!wrap) return;
    const scale = Math.min((wrap.clientWidth - 16) / state.width, (wrap.clientHeight - 16) / state.height, 1);
    stage.style.transform = `scale(${scale})`;
}

// ============================================
// PLAYER
// ============================================
function setupPlayer() {
    $('playBtn').onclick = togglePlay;
    $('scrubber').oninput = e => {
        state.currentTime = parseFloat(e.target.value);
        update(state.currentTime);
    };
}

function togglePlay() { state.isPlaying ? pause() : play(); }

function play() {
    if (!state.audioBuffer) return;
    state.isPlaying = true;
    $('playBtn').textContent = '⏸';
    state.sourceNode = state.audioCtx.createBufferSource();
    state.sourceNode.buffer = state.audioBuffer;
    state.sourceNode.connect(state.audioCtx.destination);
    state.startTimestamp = state.audioCtx.currentTime - state.currentTime;
    state.sourceNode.start(0, state.currentTime);
    function loop() {
        if (!state.isPlaying) return;
        state.currentTime = state.audioCtx.currentTime - state.startTimestamp;
        if (state.currentTime >= state.duration) { pause(); state.currentTime = 0; update(0); return; }
        update(state.currentTime);
        state.animFrameId = requestAnimationFrame(loop);
    }
    loop();
}

function pause() {
    state.isPlaying = false;
    $('playBtn').textContent = '▶';
    if (state.sourceNode) { try { state.sourceNode.stop(); } catch(e){} state.sourceNode = null; }
    cancelAnimationFrame(state.animFrameId);
}

function update(time) {
    $('scrubber').value = time;
    $('timeDisplay').textContent = `${fmt(time)} / ${fmt(state.duration)}`;
    try { if (window.__updateAtTime) window.__updateAtTime(time); } catch(e) {}
}

// ============================================
// TEMPLATES
// ============================================
function setupTemplates() {
    $('loadTemplateBtn').onclick = () => {
        const key = $('templateSelect').value;
        if (!key || !TEMPLATES[key]) return alert('Select a template!');
        if ($('htmlEditor').value.trim() && !confirm('Replace current HTML?')) return;
        $('htmlEditor').value = TEMPLATES[key];
        applyHTML();
    };
}

// ============================================
// PROJECTS
// ============================================
function setupProjects() {
    $('saveBtn').onclick = () => {
        const name = $('projectName').value.trim();
        if (!name) return alert('Enter a name!');
        const p = JSON.parse(localStorage.getItem('vidProjects') || '{}');
        p[name] = { name, html: $('htmlEditor').value, aspect: $('aspectRatio').value, images: state.images };
        localStorage.setItem('vidProjects', JSON.stringify(p));
        alert('Saved!');
    };
    $('newBtn').onclick = () => {
        if (!confirm('New project?')) return;
        $('projectName').value = 'my-video';
        $('htmlEditor').value = '';
        $('videoStage').innerHTML = '';
        state.images = [];
        state.imageUrls = [];
        window.__images = [];
        state.htmlApplied = false;
        renderImageList();
        $('imageDropText').textContent = '📁 Upload Multiple Images';
        $('statusBadge').textContent = 'Waiting';
        $('statusBadge').className = 'badge';
        checkReady();
    };
    $('loadBtn').onclick = () => {
        const list = $('projectsList');
        list.classList.toggle('hidden');
        if (!list.classList.contains('hidden')) {
            const p = JSON.parse(localStorage.getItem('vidProjects') || '{}');
            const keys = Object.keys(p);
            list.innerHTML = keys.length === 0 
                ? '<p class="hint">No projects saved.</p>'
                : keys.map(k => `<div class="proj-item"><span onclick="window._loadProj('${k.replace(/'/g,'\\\'')}')">${k}</span><button onclick="window._delProj('${k.replace(/'/g,'\\\'')}')">&times;</button></div>`).join('');
        }
    };
}

window._loadProj = name => {
    const p = JSON.parse(localStorage.getItem('vidProjects') || '{}')[name];
    if (!p) return;
    $('projectName').value = p.name;
    $('htmlEditor').value = p.html;
    $('aspectRatio').value = p.aspect;
    state.images = p.images || [];
    rebuildImageUrls();
    renderImageList();
    updateSize();
    applyHTML();
    $('projectsList').classList.add('hidden');
    $('imageDropText').textContent = state.images.length > 0 ? `✅ ${state.images.length} images` : '📁 Upload Multiple Images';
};

window._delProj = name => {
    if (!confirm(`Delete "${name}"?`)) return;
    const p = JSON.parse(localStorage.getItem('vidProjects') || '{}');
    delete p[name];
    localStorage.setItem('vidProjects', JSON.stringify(p));
    $('loadBtn').click(); $('loadBtn').click();
};

// ============================================
// EXPORT
// ============================================
function setupExport() {
    $('exportBtn').onclick = exportVideo;
    $('cancelBtn').onclick = () => { state.exportCancelled = true; };
}

function checkReady() {
    $('exportBtn').disabled = !state.audioBuffer;
}

async function captureFrame(canvas) {
    const stage = $('videoStage');
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
    ctx.drawImage(rendered, 0, 0, state.width, state.height);
}

async function exportVideo() {
    if (!state.audioBuffer) return alert('Upload audio first!');
    pause();
    state.exportCancelled = false;
    
    $('exportModal').classList.remove('hidden');
    $('progBar').style.width = '0%';
    $('progText').textContent = 'Starting...';
    
    const canvas = $('exportCanvas');
    const fps = 30;
    
    try {
        canvas.width = state.width;
        canvas.height = state.height;
        
        // Initial capture
        update(0);
        await new Promise(r => setTimeout(r, 100));
        await captureFrame(canvas);
        
        const stream = canvas.captureStream(fps);
        
        // Audio
        const actx = new AudioContext();
        const src = actx.createBufferSource();
        src.buffer = state.audioBuffer;
        const dest = actx.createMediaStreamDestination();
        src.connect(dest);
        stream.addTrack(dest.stream.getAudioTracks()[0]);
        
        let mime = 'video/webm';
        if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')) mime = 'video/webm;codecs=vp9,opus';
        else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')) mime = 'video/webm;codecs=vp8,opus';
        
        const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 4000000 });
        const chunks = [];
        rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
        
        await new Promise((resolve, reject) => {
            rec.onstop = () => {
                if (chunks.length === 0) { reject(new Error('No data recorded')); return; }
                const blob = new Blob(chunks, { type: mime });
                download(blob, ($('projectName').value || 'video') + '.webm');
                resolve();
            };
            rec.onerror = reject;
            
            rec.start(100);
            src.start(0);
            
            const t0 = performance.now();
            
            async function loop() {
                if (state.exportCancelled) {
                    rec.stop(); try { src.stop(); } catch(e){}
                    reject(new Error('Cancelled'));
                    return;
                }
                
                const elapsed = (performance.now() - t0) / 1000;
                
                if (elapsed >= state.duration) {
                    update(state.duration - 0.01);
                    await captureFrame(canvas);
                    await new Promise(r => setTimeout(r, 300));
                    rec.stop();
                    try { src.stop(); } catch(e){}
                    return;
                }
                
                update(elapsed);
                await captureFrame(canvas);
                
                const pct = Math.round((elapsed / state.duration) * 100);
                $('progBar').style.width = pct + '%';
                $('progText').textContent = `Recording: ${pct}% (${fmt(elapsed)} / ${fmt(state.duration)})`;
                
                requestAnimationFrame(loop);
            }
            loop();
        });
        
        $('progBar').style.width = '100%';
        $('progText').textContent = '✅ Done! Downloading...';
        await new Promise(r => setTimeout(r, 1500));
        
    } catch(err) {
        console.error(err);
        if (!state.exportCancelled) alert('Export failed: ' + err.message);
    } finally {
        $('exportModal').classList.add('hidden');
    }
}

// ============================================
// UTILS
// ============================================
function fmt(s) {
    if (!s || isNaN(s)) return '0:00';
    return Math.floor(s/60) + ':' + String(Math.floor(s%60)).padStart(2, '0');
}

function download(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 2000);
}
