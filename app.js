// ============================================
// STATE
// ============================================
const state = {
    audio: null,
    audioBuffer: null,
    audioCtx: null,
    analyser: null,
    sourceNode: null,
    duration: 60,
    currentTime: 0,
    isPlaying: false,
    captions: [],
    width: 1920,
    height: 1080,
    animFrameId: null,
    startTimestamp: 0,
    currentTemplate: 'blank',
    exportCancelled: false,
    bgMediaUrl: null,
    bgMediaType: null
};

const $ = id => document.getElementById(id);

// ============================================
// INIT
// ============================================
window.addEventListener('DOMContentLoaded', () => {
    renderTemplateGrid();
    setupStageScaling();
    setupAudioEvents();
    setupControls();
    setupCaptionEditor();
    setupProjectManager();
    createVisualizerBars();
    applyTemplate('blank');
    renderCaptionListUI();
    window.addEventListener('resize', setupStageScaling);
});

// ============================================
// TEMPLATE SYSTEM
// ============================================
function renderTemplateGrid() {
    const grid = $('templateGrid');
    grid.innerHTML = Object.entries(TEMPLATES).map(([key, tpl]) => {
        const icon = tpl.name.split(' ')[0];
        const name = tpl.name.replace(icon, '').trim();
        return `
            <div class="template-item ${key === 'blank' ? 'active' : ''}" data-template="${key}">
                <span class="tpl-icon">${icon}</span>
                <div class="tpl-name">${name}</div>
                <div class="tpl-desc">${tpl.description}</div>
            </div>
        `;
    }).join('');

    grid.querySelectorAll('.template-item').forEach(item => {
        item.onclick = () => {
            grid.querySelectorAll('.template-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            applyTemplate(item.dataset.template);
        };
    });
}

function applyTemplate(templateKey) {
    const tpl = TEMPLATES[templateKey];
    if (!tpl) return;
    state.currentTemplate = templateKey;

    // Apply all settings
    $('aspectRatio').value = tpl.aspectRatio;
    $('bgType').value = tpl.bgType;
    $('bgColor1').value = tpl.bgColor1;
    $('bgColor2').value = tpl.bgColor2;
    if (tpl.bgSolid) $('bgSolid').value = tpl.bgSolid;
    $('titleFont').value = tpl.titleFont;
    $('titleColor').value = tpl.titleColor;
    $('captionFont').value = tpl.captionFont;
    $('captionColor').value = tpl.captionColor;
    $('highlightColor').value = tpl.highlightColor;
    $('captionSize').value = tpl.captionSize;
    $('capSizeVal').textContent = tpl.captionSize;
    $('captionStyle').value = tpl.captionStyle;
    $('captionAnimation').value = tpl.captionAnimation;
    $('captionPosition').value = tpl.captionPosition;
    $('showTitle').checked = tpl.showTitle;
    $('showSubtitle').checked = tpl.showSubtitle;
    $('showBadge').checked = tpl.showBadge;
    $('showVisualizer').checked = tpl.showVisualizer;
    $('showProgress').checked = tpl.showProgress;
    $('titleInput').value = tpl.title || '';
    $('subTitleInput').value = tpl.subtitle || '';
    if (tpl.badge) $('badgeInput').value = tpl.badge;

    // Show/hide relevant pickers
    togglePickers(tpl.bgType);

    // Update the stage
    updateAllStyles();
    setupStageScaling();
}

function togglePickers(bgType) {
    $('gradientPicker').classList.toggle('hidden', bgType !== 'gradient');
    $('solidPicker').classList.toggle('hidden', bgType !== 'solid');
    $('mediaPicker').classList.toggle('hidden', bgType !== 'image' && bgType !== 'video');
}

// ============================================
// STYLE APPLICATION
// ============================================
function updateAllStyles() {
    // Aspect ratio
    const [w, h] = $('aspectRatio').value.split('x').map(Number);
    state.width = w;
    state.height = h;
    const stage = $('videoStage');
    stage.style.width = `${w}px`;
    stage.style.height = `${h}px`;

    // Background
    const bgType = $('bgType').value;
    const bgLayer = $('stageBg');
    const bgImg = $('stageBgImg');
    const bgVid = $('stageBgVideo');
    const overlay = $('stageOverlay');

    bgImg.classList.add('hidden');
    bgVid.classList.add('hidden');
    overlay.classList.add('hidden');

    if (bgType === 'gradient') {
        bgLayer.style.background = `linear-gradient(135deg, ${$('bgColor1').value}, ${$('bgColor2').value})`;
    } else if (bgType === 'solid') {
        bgLayer.style.background = $('bgSolid').value;
    } else if (bgType === 'image' && state.bgMediaUrl && state.bgMediaType === 'image') {
        bgLayer.style.background = '#000';
        bgImg.src = state.bgMediaUrl;
        bgImg.classList.remove('hidden');
        if ($('bgOverlay').checked) overlay.classList.remove('hidden');
    } else if (bgType === 'video' && state.bgMediaUrl && state.bgMediaType === 'video') {
        bgLayer.style.background = '#000';
        bgVid.src = state.bgMediaUrl;
        bgVid.play();
        bgVid.classList.remove('hidden');
        if ($('bgOverlay').checked) overlay.classList.remove('hidden');
    } else {
        bgLayer.style.background = `linear-gradient(135deg, ${$('bgColor1').value}, ${$('bgColor2').value})`;
    }

    // Title & subtitle
    const title = $('stageTitle');
    const subtitle = $('stageSubtitle');
    const header = $('stageHeader');

    title.textContent = $('titleInput').value;
    subtitle.textContent = $('subTitleInput').value;
    title.style.fontFamily = $('titleFont').value;
    title.style.color = $('titleColor').value;
    title.style.display = $('showTitle').checked ? '' : 'none';
    subtitle.style.display = $('showSubtitle').checked ? '' : 'none';
    header.style.display = (!$('showTitle').checked && !$('showSubtitle').checked) ? 'none' : '';

    // Badge
    const badge = $('stageBadge');
    badge.textContent = $('badgeInput').value;
    badge.classList.toggle('hidden', !$('showBadge').checked);

    // Visualizer
    $('stageVisualizer').classList.toggle('hidden', !$('showVisualizer').checked);

    // Progress
    $('stageProgress').classList.toggle('hidden', !$('showProgress').checked);

    // Caption position
    const capContainer = $('stageCaptions');
    capContainer.classList.remove('pos-top', 'pos-center', 'pos-bottom');
    capContainer.classList.add(`pos-${$('captionPosition').value}`);

    // Highlight color CSS var
    document.documentElement.style.setProperty('--accent', $('highlightColor').value);

    // Re-render captions
    updatePlaybackUI(state.currentTime);
}

// ============================================
// STAGE SCALING
// ============================================
function setupStageScaling() {
    const container = document.querySelector('.stage-container');
    const maxW = container.clientWidth - 30;
    const maxH = container.clientHeight - 30;
    const scale = Math.min(maxW / state.width, maxH / state.height, 1);
    $('videoStage').style.transform = `scale(${scale})`;
}

// ============================================
// AUDIO
// ============================================
function setupAudioEvents() {
    const dropZone = $('dropZone');
    const audioInput = $('audioInput');

    dropZone.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        audioInput.click();
    });

    ['dragenter', 'dragover'].forEach(evt => {
        dropZone.addEventListener(evt, (e) => {
            e.preventDefault(); e.stopPropagation();
            dropZone.classList.add('drag-active');
        });
    });
    ['dragleave', 'drop'].forEach(evt => {
        dropZone.addEventListener(evt, (e) => {
            e.preventDefault(); e.stopPropagation();
            dropZone.classList.remove('drag-active');
        });
    });
    dropZone.addEventListener('drop', (e) => {
        if (e.dataTransfer.files[0]) handleAudioFile(e.dataTransfer.files[0]);
    });
    audioInput.addEventListener('change', (e) => {
        if (e.target.files[0]) handleAudioFile(e.target.files[0]);
    });
}

async function handleAudioFile(file) {
    const dropZoneText = $('dropZoneText');
    dropZoneText.innerHTML = '⏳ Loading...';

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

        state.analyser = state.audioCtx.createAnalyser();
        state.analyser.fftSize = 64;

        $('audioMeta').innerHTML = `🎵 <strong>${file.name}</strong> | ${formatTime(state.duration)}`;
        $('audioMeta').classList.remove('hidden');
        dropZoneText.innerHTML = `✅ <strong>${file.name}</strong>`;

        $('timeScrubber').max = state.duration;
        $('playBtn').disabled = false;
        $('exportBtn').disabled = false;

        updatePlaybackUI(0);
    } catch (err) {
        console.error(err);
        alert('Could not load audio: ' + err.message);
        dropZoneText.innerHTML = '❌ Click to retry';
    } finally {
        $('audioInput').value = '';
    }
}

// ============================================
// VISUALIZER
// ============================================
function createVisualizerBars() {
    const vis = $('stageVisualizer');
    vis.innerHTML = '';
    for (let i = 0; i < 24; i++) {
        const bar = document.createElement('div');
        bar.className = 'vis-bar';
        bar.style.height = '6px';
        vis.appendChild(bar);
    }
}

function updateVisualizer() {
    const bars = document.querySelectorAll('.vis-bar');
    if (!state.analyser || !state.isPlaying) {
        bars.forEach((bar, i) => {
            bar.style.height = `${6 + Math.sin(i * 0.7 + state.currentTime * 2) * 10}px`;
        });
        return;
    }
    const data = new Uint8Array(state.analyser.frequencyBinCount);
    state.analyser.getByteFrequencyData(data);
    bars.forEach((bar, i) => {
        const val = data[i] || 0;
        bar.style.height = `${Math.max(6, (val / 255) * 60)}px`;
    });
}

// ============================================
// CONTROLS
// ============================================
function setupControls() {
    // Every input triggers a full re-render
    const inputs = [
        'aspectRatio', 'bgType', 'bgColor1', 'bgColor2', 'bgSolid',
        'titleFont', 'titleColor', 'captionFont', 'captionColor',
        'highlightColor', 'captionSize', 'captionStyle', 'captionAnimation',
        'captionPosition', 'titleInput', 'subTitleInput', 'badgeInput'
    ];
    inputs.forEach(id => {
        const el = $(id);
        if (!el) return;
        el.addEventListener('input', () => {
            if (id === 'captionSize') $('capSizeVal').textContent = el.value;
            if (id === 'bgType') togglePickers(el.value);
            if (id === 'aspectRatio') setupStageScaling();
            updateAllStyles();
        });
    });

    ['showTitle', 'showSubtitle', 'showBadge', 'showVisualizer', 'showProgress', 'bgOverlay'].forEach(id => {
        $(id).addEventListener('change', updateAllStyles);
    });

    $('bgMediaInput').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        state.bgMediaUrl = URL.createObjectURL(file);
        state.bgMediaType = file.type.startsWith('video/') ? 'video' : 'image';
        $('bgType').value = state.bgMediaType;
        togglePickers(state.bgMediaType);
        updateAllStyles();
    });

    $('playBtn').onclick = togglePlay;
    $('timeScrubber').oninput = e => {
        state.currentTime = parseFloat(e.target.value);
        updatePlaybackUI(state.currentTime);
    };

    $('exportBtn').onclick = () => renderVideo($('exportFormat').value);
    $('cancelExportBtn').onclick = () => { state.exportCancelled = true; };
}

// ============================================
// PROJECT MANAGER (Save/Load)
// ============================================
function setupProjectManager() {
    $('newProjectBtn').onclick = () => {
        if (confirm('Start a new project? Unsaved changes will be lost.')) {
            $('projectName').value = 'My New Video';
            state.captions = [];
            state.bgMediaUrl = null;
            applyTemplate('blank');
            renderCaptionListUI();
        }
    };

    $('saveProjectBtn').onclick = saveProject;
    $('loadProjectBtn').onclick = toggleProjectList;
}

function saveProject() {
    const projectData = {
        name: $('projectName').value,
        template: state.currentTemplate,
        settings: {
            aspectRatio: $('aspectRatio').value,
            bgType: $('bgType').value,
            bgColor1: $('bgColor1').value,
            bgColor2: $('bgColor2').value,
            bgSolid: $('bgSolid').value,
            titleFont: $('titleFont').value,
            titleColor: $('titleColor').value,
            captionFont: $('captionFont').value,
            captionColor: $('captionColor').value,
            highlightColor: $('highlightColor').value,
            captionSize: $('captionSize').value,
            captionStyle: $('captionStyle').value,
            captionAnimation: $('captionAnimation').value,
            captionPosition: $('captionPosition').value,
            title: $('titleInput').value,
            subtitle: $('subTitleInput').value,
            badge: $('badgeInput').value,
            showTitle: $('showTitle').checked,
            showSubtitle: $('showSubtitle').checked,
            showBadge: $('showBadge').checked,
            showVisualizer: $('showVisualizer').checked,
            showProgress: $('showProgress').checked
        },
        captions: state.captions
    };

    const projects = JSON.parse(localStorage.getItem('videoProjects') || '{}');
    projects[projectData.name] = projectData;
    localStorage.setItem('videoProjects', JSON.stringify(projects));
    alert(`✅ Project "${projectData.name}" saved!`);
}

function toggleProjectList() {
    const list = $('savedProjectsList');
    list.classList.toggle('hidden');
    if (!list.classList.contains('hidden')) {
        renderProjectList();
    }
}

function renderProjectList() {
    const projects = JSON.parse(localStorage.getItem('videoProjects') || '{}');
    const list = $('savedProjectsList');
    const keys = Object.keys(projects);
    if (keys.length === 0) {
        list.innerHTML = '<p style="font-size:0.7rem;color:var(--text-muted);padding:8px;">No saved projects</p>';
        return;
    }
    list.innerHTML = keys.map(name => `
        <div class="saved-project-item">
            <span onclick="loadProject('${name}')" style="cursor:pointer;flex:1;">📄 ${name}</span>
            <button onclick="deleteProject('${name}')">🗑️</button>
        </div>
    `).join('');
}

window.loadProject = (name) => {
    const projects = JSON.parse(localStorage.getItem('videoProjects') || '{}');
    const project = projects[name];
    if (!project) return;

    $('projectName').value = project.name;
    Object.entries(project.settings).forEach(([key, val]) => {
        const el = $(key === 'title' ? 'titleInput' : key === 'subtitle' ? 'subTitleInput' : key === 'badge' ? 'badgeInput' : key);
        if (!el) return;
        if (el.type === 'checkbox') el.checked = val;
        else el.value = val;
    });
    $('capSizeVal').textContent = project.settings.captionSize;
    state.captions = project.captions || [];
    state.currentTemplate = project.template;

    // Update template selection
    document.querySelectorAll('.template-item').forEach(i => {
        i.classList.toggle('active', i.dataset.template === project.template);
    });

    togglePickers(project.settings.bgType);
    updateAllStyles();
    renderCaptionListUI();
    $('savedProjectsList').classList.add('hidden');
    alert(`✅ Loaded "${name}"`);
};

window.deleteProject = (name) => {
    if (!confirm(`Delete project "${name}"?`)) return;
    const projects = JSON.parse(localStorage.getItem('videoProjects') || '{}');
    delete projects[name];
    localStorage.setItem('videoProjects', JSON.stringify(projects));
    renderProjectList();
};

// ============================================
// CAPTIONS
// ============================================
function setupCaptionEditor() {
    $('autoSplitBtn').onclick = autoSplitCaptions;
    $('addCaptionBtn').onclick = addCaptionManual;
    $('importSrtBtn').onclick = () => $('srtFileInput').click();
    $('srtFileInput').onchange = e => {
        if (e.target.files[0]) importSRTFile(e.target.files[0]);
    };
    $('clearCaptionsBtn').onclick = () => {
        if (confirm('Clear all captions?')) {
            state.captions = [];
            renderCaptionListUI();
            updatePlaybackUI(state.currentTime);
        }
    };
}

function autoSplitCaptions() {
    const text = $('scriptInput').value.trim();
    if (!text) return alert('Paste your script first!');
    const sentences = text.split(/(?<=[.!?])\s+|\n+/).filter(s => s.trim().length > 0);
    const dur = state.duration || sentences.length * 3;
    const per = dur / sentences.length;
    state.captions = sentences.map((s, i) => ({
        id: Date.now() + i,
        start: +(i * per).toFixed(2),
        end: +((i + 1) * per).toFixed(2),
        text: s.trim()
    }));
    renderCaptionListUI();
    updatePlaybackUI(state.currentTime);
}

function addCaptionManual() {
    const last = state.captions.length ? state.captions[state.captions.length - 1].end : 0;
    state.captions.push({
        id: Date.now(),
        start: last,
        end: Math.min(last + 3, state.duration || last + 3),
        text: 'New caption'
    });
    renderCaptionListUI();
}

function importSRTFile(file) {
    const reader = new FileReader();
    reader.onload = e => {
        state.captions = parseSRT(e.target.result);
        renderCaptionListUI();
        updatePlaybackUI(state.currentTime);
    };
    reader.readAsText(file);
}

function parseSRT(text) {
    return text.trim().split(/\n\s*\n/).map((b, i) => {
        const lines = b.split('\n');
        const tl = lines.find(l => l.includes('-->'));
        if (!tl) return null;
        const [s, e] = tl.split('-->').map(t => {
            const p = t.trim().replace(',', '.').split(':');
            return +p[0] * 3600 + +p[1] * 60 + +p[2];
        });
        return {
            id: Date.now() + i,
            start: s,
            end: e,
            text: lines.filter(l => l !== lines[0] && l !== tl).join(' ').replace(/<[^>]+>/g, '').trim()
        };
    }).filter(Boolean);
}

function renderCaptionListUI() {
    const list = $('captionList');
    if (state.captions.length === 0) {
        list.innerHTML = '<p style="font-size:0.7rem;color:var(--text-muted);padding:8px;">No captions yet.</p>';
        return;
    }
    list.innerHTML = state.captions.map((c, i) => `
        <div class="caption-row">
            <span class="caption-row-num">${i + 1}</span>
            <input type="number" step="0.1" value="${c.start.toFixed(1)}"
                onchange="window._updateCap(${c.id},'start',+this.value)">
            <input type="number" step="0.1" value="${c.end.toFixed(1)}"
                onchange="window._updateCap(${c.id},'end',+this.value)">
            <input type="text" value="${escapeHtml(c.text)}"
                oninput="window._updateCap(${c.id},'text',this.value)">
            <button class="caption-delete-btn" onclick="window._deleteCap(${c.id})">🗑️</button>
        </div>
    `).join('');
}

window._updateCap = (id, field, val) => {
    const c = state.captions.find(x => x.id === id);
    if (c) { c[field] = val; updatePlaybackUI(state.currentTime); }
};
window._deleteCap = (id) => {
    state.captions = state.captions.filter(x => x.id !== id);
    renderCaptionListUI();
    updatePlaybackUI(state.currentTime);
};

// ============================================
// PLAYBACK
// ============================================
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
    state.startTimestamp = state.audioCtx.currentTime - offset;
    state.sourceNode.start(0, offset);

    function loop() {
        if (!state.isPlaying) return;
        state.currentTime = state.audioCtx.currentTime - state.startTimestamp;
        if (state.currentTime >= state.duration) {
            pauseAudio();
            state.currentTime = 0;
            updatePlaybackUI(0);
            return;
        }
        updatePlaybackUI(state.currentTime);
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

function updatePlaybackUI(time) {
    $('timeScrubber').value = time;
    $('timeDisplay').textContent = `${formatTime(time)} / ${formatTime(state.duration)}`;

    if (state.duration > 0) {
        $('stageProgressBar').style.width = `${(time / state.duration) * 100}%`;
    }

    updateCaption(time);
    updateVisualizer();
}

// ============================================
// CAPTION RENDERING
// ============================================
function updateCaption(time) {
    const el = $('stageCaptionText');
    const active = state.captions.find(c => time >= c.start && time <= c.end);

    if (!active) {
        el.style.opacity = '0';
        return;
    }

    const anim = $('captionAnimation').value;
    const style = $('captionStyle').value;
    const fontSize = $('captionSize').value;
    const fontFamily = $('captionFont').value;
    const color = $('captionColor').value;
    const highlight = $('highlightColor').value;

    // Apply base styling
    el.style.opacity = '1';
    el.style.fontSize = `${fontSize}px`;
    el.style.fontFamily = fontFamily;
    el.style.color = color;
    el.style.setProperty('--accent', highlight);

    // Clear old classes
    el.className = 'caption-text';
    el.classList.add(`style-${style}`);
    if (anim !== 'none' && anim !== 'fade') el.classList.add(`anim-${anim}`);

    const words = active.text.split(/\s+/).filter(Boolean);
    const dur = active.end - active.start;
    const elapsed = time - active.start;

    if (anim === 'karaoke' || anim === 'popup' || anim === 'slideup' || anim === 'typewriter') {
        const wordDur = dur / words.length;
        const curIdx = Math.min(Math.floor(elapsed / wordDur), words.length - 1);
        el.innerHTML = words.map((w, i) => {
            let cls = 'word';
            if (anim === 'karaoke' && i <= curIdx) cls += ' active';
            if ((anim === 'popup' || anim === 'slideup' || anim === 'typewriter') && i <= curIdx) cls += ' visible';
            if (anim === 'karaoke' && i === curIdx) cls += ' active';
            return `<span class="${cls}">${escapeHtml(w)}</span>`;
        }).join(' ');
    } else {
        el.textContent = active.text;
    }
}

// ============================================
// EXPORT
// ============================================
function stageToCanvas(canvas, w, h) {
    return new Promise((resolve, reject) => {
        const stage = $('videoStage');
        const clone = stage.cloneNode(true);
        clone.style.transform = 'none';
        clone.style.width = `${w}px`;
        clone.style.height = `${h}px`;

        // Build embedded CSS
        const css = getInlineCSS(w, h);
        const serialized = new XMLSerializer().serializeToString(clone);

        const svg = `
            <svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
                <foreignObject width="100%" height="100%">
                    <div xmlns="http://www.w3.org/1999/xhtml">
                        <style>${css}</style>
                        ${serialized}
                    </div>
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
            ctx.clearRect(0, 0, w, h);
            ctx.drawImage(img, 0, 0, w, h);
            URL.revokeObjectURL(url);
            resolve();
        };
        img.onerror = err => { URL.revokeObjectURL(url); reject(err); };
        img.src = url;
    });
}

function getInlineCSS(w, h) {
    const highlight = $('highlightColor').value;
    const bgType = $('bgType').value;
    let bg = '';
    if (bgType === 'gradient') bg = `background:linear-gradient(135deg, ${$('bgColor1').value}, ${$('bgColor2').value});`;
    else if (bgType === 'solid') bg = `background:${$('bgSolid').value};`;
    else if (state.bgMediaUrl && state.bgMediaType === 'image') bg = `background:url(${state.bgMediaUrl}) center/cover;`;

    return `
        @import url('https://fonts.googleapis.com/css2?family=Georgia&family=Montserrat:wght@400;700;900&family=Poppins:wght@400;700;900&family=Bebas+Neue&family=Playfair+Display:wght@400;700;900&family=Space+Grotesk:wght@700&family=Dancing+Script:wght@700&family=Inter:wght@400;700;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .video-stage { position: relative; width: ${w}px; height: ${h}px; overflow: hidden; display: flex; flex-direction: column; justify-content: space-between; align-items: center; padding: 60px 40px; }
        .stage-bg { position: absolute; inset: 0; ${bg} z-index: 1; }
        .stage-bg-media { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; z-index: 2; }
        .stage-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.35); z-index: 3; }
        .stage-header { position: relative; z-index: 10; text-align: center; }
        .stage-header h1 { font-size: 68px; font-family: ${$('titleFont').value}; color: ${$('titleColor').value}; letter-spacing: 2px; text-shadow: 0 4px 20px rgba(0,0,0,0.8); margin-bottom: 8px; font-weight: 700; }
        .stage-header p { font-size: 24px; color: #eee; letter-spacing: 3px; text-transform: uppercase; text-shadow: 0 2px 10px rgba(0,0,0,0.7); }
        .stage-badge { position: absolute; top: 40px; right: 40px; background: rgba(0,0,0,0.5); padding: 10px 22px; border-radius: 30px; font-size: 20px; color: #fff; z-index: 20; border: 1px solid rgba(255,255,255,0.15); }
        .stage-captions { position: relative; z-index: 10; text-align: center; max-width: 85%; padding: 20px; }
        .stage-captions.pos-top { position: absolute; top: 220px; left: 50%; transform: translateX(-50%); }
        .stage-captions.pos-center { position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%); }
        .stage-captions.pos-bottom { position: relative; margin-bottom: 40px; }
        .caption-text { font-size: ${$('captionSize').value}px; line-height: 1.4; color: ${$('captionColor').value}; font-family: ${$('captionFont').value}; display: inline-block; word-wrap: break-word; }
        .style-box { background: rgba(0,0,0,0.75); padding: 14px 32px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); }
        .style-shadow { text-shadow: 0 6px 25px rgba(0,0,0,0.9), 0 2px 8px rgba(0,0,0,0.7); }
        .style-outline { text-shadow: -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000, 0 4px 15px rgba(0,0,0,0.8); font-weight: 900; }
        .style-glow { text-shadow: 0 0 20px ${highlight}, 0 0 40px ${highlight}, 0 4px 15px rgba(0,0,0,0.7); }
        .caption-text .word { display: inline-block; margin: 0 5px; }
        .caption-text .word.active { color: ${highlight}; transform: scale(1.15); }
        .caption-text .word.visible { opacity: 1; }
        .stage-visualizer { position: absolute; bottom: 60px; left: 50%; transform: translateX(-50%); display: flex; gap: 6px; align-items: flex-end; height: 60px; z-index: 10; }
        .vis-bar { width: 8px; background: rgba(255,255,255,0.7); border-radius: 4px; min-height: 6px; }
        .stage-progress { position: absolute; bottom: 0; left: 0; right: 0; height: 6px; background: rgba(0,0,0,0.4); z-index: 10; }
        .stage-progress-fill { height: 100%; width: ${$('stageProgressBar').style.width}; background: ${highlight}; }
        .hidden { display: none !important; }
    `;
}

async function renderVideo(format) {
    if (!state.audioBuffer) return alert('Upload audio first!');
    pauseAudio();
    state.exportCancelled = false;

    $('exportModal').classList.remove('hidden');
    $('exportTitle').textContent = `Rendering ${format.toUpperCase()}...`;
    $('exportDetail').textContent = 'Preparing...';
    $('exportProgressFill').style.width = '0%';

    const fps = 30;
    const w = state.width;
    const h = state.height;
    const exportCanvas = $('exportCanvas');

    try {
        if (format === 'webm') {
            await exportWebM(exportCanvas, w, h, fps);
        } else {
            await exportMP4(exportCanvas, w, h, fps);
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
            updatePlaybackUI(el);
            try { await stageToCanvas(canvas, w, h); } catch(e){}
            const pct = Math.round((el / state.duration) * 100);
            $('exportProgressFill').style.width = `${pct}%`;
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
        updatePlaybackUI(frameTime);
        await new Promise(r => setTimeout(r, 0));
        await stageToCanvas(canvas, w, h);
        const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
        const buffer = new Uint8Array(await blob.arrayBuffer());
        await ffmpeg.writeFile(`f_${String(i).padStart(6, '0')}.png`, buffer);

        if (i % 5 === 0) {
            const pct = Math.round((i / totalFrames) * 80);
            $('exportProgressFill').style.width = `${pct}%`;
            $('exportDetail').textContent = `Rendering frames: ${pct}%`;
        }
    }

    $('exportDetail').textContent = 'Encoding MP4...';
    $('exportProgressFill').style.width = '85%';

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

    $('exportProgressFill').style.width = '100%';
    $('exportDetail').textContent = '✅ Done!';
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
function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
}
