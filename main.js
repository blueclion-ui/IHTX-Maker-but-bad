import { WebGLRenderer } from './webgl-renderer.js';
import { DEFAULT_PARAMS } from './effect-params.js';
import { renderControls } from './ui-templates.js';
import { MusicManager } from './music-manager.js';

const canvas = document.getElementById('gl-canvas');
const renderer = new WebGLRenderer(canvas);
const activeStackEl = document.getElementById('active-stack');
const libBtns = document.querySelectorAll('.lib-btn:not(.download-btn):not(.music-btn)');
const downloadBtn = document.getElementById('download-btn');
const musicBtn = document.getElementById('music-btn');
const audioToggle = document.getElementById('audio-toggle');
const downloadVideoBtn = document.getElementById('download-video-btn');
const previewIhtxBtn = document.getElementById('preview-ihtx-btn');
const segmentLengthInput = document.getElementById('segment-length');
const maxRepeatsInput = document.getElementById('max-repeats');
const revertBtn = document.getElementById('revert-btn');
const clearEffectsBtn = document.getElementById('clear-effects-btn');

let activeEffects = [];
let nextId = 0;

// removed const DEFAULT_PARAMS = ...;

async function init() {
    // load default image (new starter) but allow user to revert to the original
    await renderer.loadImage('/IMG_2109.jpeg').catch(()=>{});
    // create a MusicManager instance and keep a reference for preview/export calls
    // Initialize MusicManager with path; if a video is later loaded, we'll hand its media element to the manager
    window.musicManager = new MusicManager('/Creative Exercise   Mario Paint Music Extended.mp3', musicBtn);

    // wire upload UI and revert button
    const fileInput = document.getElementById('file-input');
    const uploadBtn = document.getElementById('upload-btn');

    uploadBtn.onclick = () => fileInput.click();

    fileInput.onchange = async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        const url = URL.createObjectURL(file);
        if (file.type.startsWith('image/')) {
            await renderer.loadImage(url);
        } else if (file.type.startsWith('video/')) {
            await renderer.loadVideo(url);
            // tell music manager to use the video's audio so pitches come from the video audio
            if (window.musicManager && renderer.videoElement) {
                window.musicManager.useMediaElement(renderer.videoElement);
            }
            // try to play (some browsers require user gesture)
            try {
                renderer.videoElement.play().catch(()=>{});
            } catch(e){}
        } else {
            alert('Unsupported file type');
        }
        renderUI();
    };

    // Revert to original starter image (/i (1).jpeg)
    if (revertBtn) {
        revertBtn.onclick = async () => {
            await renderer.loadImage('/i (1).jpeg').catch(()=>{});
            renderUI();
        };
    }

    startRenderLoop();
    renderStack();
}

function addEffect(type) {
    const effect = {
        id: nextId++,
        type,
        params: { ...DEFAULT_PARAMS[type] },
        collapsed: false
    };
    activeEffects.push(effect);
    renderUI();
    renderStack();
}

function removeEffect(id) {
    activeEffects = activeEffects.filter(e => e.id !== id);
    renderUI();
    renderStack();
}

function toggleCollapse(id) {
    const effect = activeEffects.find(e => e.id === id);
    if (effect) {
        effect.collapsed = !effect.collapsed;
        renderUI();
    }
}

function updateParam(id, key, value) {
    const effect = activeEffects.find(e => e.id === id);
    if (effect) {
        if (effect.type === 'gradientMap' && (key === 'wR' || key === 'wG' || key === 'wB')) {
            adjustGradientWeights(effect, key, value);
            renderUI();
        } else if (key === 'activeChannel') {
            effect.params[key] = value;
            renderUI();
        } else {
            effect.params[key] = value;
        }
        renderStack();
    }
}

function adjustGradientWeights(effect, changedKey, newValue) {
    const keys = ['wR', 'wG', 'wB'];
    const others = keys.filter(k => k !== changedKey);
    const oldValue = effect.params[changedKey];
    const delta = newValue - oldValue;
    
    const otherSum = effect.params[others[0]] + effect.params[others[1]];
    
    if (otherSum > 0.0001) {
        effect.params[others[0]] -= delta * (effect.params[others[0]] / otherSum);
        effect.params[others[1]] -= delta * (effect.params[others[1]] / otherSum);
    } else {
        effect.params[others[0]] -= delta / 2;
        effect.params[others[1]] -= delta / 2;
    }
    
    effect.params[changedKey] = newValue;
    
    keys.forEach(k => effect.params[k] = Math.max(0, Math.min(1, effect.params[k])));
    const currentTotal = effect.params.wR + effect.params.wG + effect.params.wB;
    if (currentTotal > 0) {
        keys.forEach(k => effect.params[k] /= currentTotal);
    } else {
        effect.params.wR = 0.333; effect.params.wG = 0.334; effect.params.wB = 0.333;
    }
}

function renderStack() {
    renderer.render(activeEffects);
}

/*
 Given a base array of semitone offsets, produce a list-of-sets where each entry corresponds
 to one video segment's pitched layers. This makes audio change at segment boundaries to
 match each video repetition. The shifting rule below shifts each base pitch by (segmentIndex * baseShift).
 For predictability we use baseShift = basePitches[0] if present, otherwise 0.
 Returns: [ [pitches for segment 0], [pitches for segment 1], ... ]
*/
function expandPitchesForRepeats(basePitches, repeats) {
    if (!Array.isArray(basePitches) || basePitches.length === 0) return [];
    const out = [];
    const baseShift = Number(basePitches[0]) || 0;
    for (let r = 0; r < repeats; r++) {
        const set = basePitches.map(p => {
            const b = Number(p) || 0;
            return b + r * baseShift;
        });
        out.push(set);
    }
    return out;
}

let rafId = null;
function startRenderLoop() {
    if (rafId) return;
    const loop = () => {
        // Update dynamic shake uniforms for any active shake effects (continuous)
        for (const e of activeEffects) {
            if (e.type === 'shake') {
                // randomize jitter; store normalized values on params for the renderer to consume
                const randX = (Math.random() * 2.0 - 1.0) * (Number(e.params.amountX) || 0);
                const randY = (Math.random() * 2.0 - 1.0) * (Number(e.params.amountY) || 0);
                e.params.uShakeX = randX / Math.max(1, renderer.canvas.width);
                e.params.uShakeY = randY / Math.max(1, renderer.canvas.height);
            }
        }

        renderer.render(activeEffects);
        rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
}

function renderUI() {
    activeStackEl.innerHTML = '';
    activeEffects.forEach(effect => {
        const card = createEffectCard(effect);
        activeStackEl.appendChild(card);
    });
}

function createEffectCard(effect) {
    const card = document.createElement('div');
    card.className = `effect-card ${effect.collapsed ? 'collapsed' : ''}`;
    card.innerHTML = `
        <div class="effect-header">
            <span class="effect-title">${effect.type.toUpperCase()} #${effect.id}</span>
            <div class="effect-actions">
                <span class="collapse-icon">${effect.collapsed ? '▼' : '▲'}</span>
                <button class="remove-btn">×</button>
            </div>
        </div>
        <div class="effect-body">
            ${renderControls(effect)}
        </div>
    `;

    card.querySelector('.effect-header').onclick = (e) => {
        if (e.target.classList.contains('remove-btn')) {
            removeEffect(effect.id);
        } else {
            toggleCollapse(effect.id);
        }
    };

    const inputs = card.querySelectorAll('input, select');
    inputs.forEach(input => {
        const key = input.dataset.key;
        input.oninput = (e) => {
            let val;
            if (input.type === 'checkbox') {
                val = input.checked;
            } else if (input.type === 'radio') {
                if (!input.checked) return;
                val = e.target.value;
            } else if (input.tagName === 'SELECT') {
                val = parseInt(e.target.value);
                if (key === 'grayMode') renderUI();
            } else {
                val = parseFloat(e.target.value);
            }
            
            if (input.type !== 'radio') {
                const pair = card.querySelector(`input[data-key="${key}"]:not([type="${input.type}"])`);
                if (pair) pair.value = e.target.value;
            }

            updateParam(effect.id, key, val);
        };
    });

    card.querySelectorAll('input[type="color"]').forEach(input => {
        input.oninput = (e) => updateParam(effect.id, input.dataset.key, e.target.value);
    });

    card.querySelectorAll('.preset-btn').forEach(pBtn => {
        pBtn.onclick = () => {
            updateParam(effect.id, 'hueShift', parseFloat(pBtn.dataset.value));
            renderUI();
        };
    });

    if (effect.type === 'rgbCurve') {
        setupCurveEditor(card, effect);
    }

    return card;
}

function setupCurveEditor(card, effect) {
    const canvas = card.querySelector('.curve-canvas');
    if (!canvas) return;
    
    canvas.width = 400;
    canvas.height = 400;
    
    const ctx = canvas.getContext('2d');
    const draw = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        for(let i=1; i<4; i++) {
            const p = i * canvas.width / 4;
            ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, canvas.height); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(canvas.width, p); ctx.stroke();
        }
        const channel = effect.params.activeChannel;
        const points = effect.params[`points${channel}`];
        ctx.lineWidth = 3;
        ctx.strokeStyle = channel === 'R' ? '#ff4d4d' : (channel === 'G' ? '#4dff4d' : '#4d4dff');
        ctx.beginPath();
        points.forEach((p, i) => {
            const x = p.x * canvas.width;
            const y = (1.0 - p.y) * canvas.height;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.stroke();
        ctx.fillStyle = '#fff';
        points.forEach(p => {
            ctx.beginPath();
            ctx.arc(p.x * canvas.width, (1.0 - p.y) * canvas.height, 8, 0, Math.PI * 2);
            ctx.fill();
        });
    };

    draw();

    const container = card.querySelector('.curve-editor-container');
    let draggedIdx = -1;

    const getMousePos = (e) => {
        const rect = container.getBoundingClientRect();
        return {
            x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
            y: Math.max(0, Math.min(1, 1.0 - (e.clientY - rect.top) / rect.height))
        };
    };

    const saveHistory = (chan) => {
        const history = effect.params[`history${chan}`];
        const currentPoints = effect.params[`points${chan}`].map(p => ({...p}));
        history.push(currentPoints);
        if (history.length > 30) history.shift();
    };

    const handlePointerMove = (e) => {
        if (draggedIdx === -1) return;
        const pos = getMousePos(e);
        const channel = effect.params.activeChannel;
        const points = effect.params[`points${channel}`];
        const p = points[draggedIdx];

        if (draggedIdx === 0) {
            p.y = pos.y;
            p.x = 0;
        } else if (draggedIdx === points.length - 1) {
            p.y = pos.y;
            p.x = 1;
        } else {
            const minX = points[draggedIdx - 1].x + 0.001;
            const maxX = points[draggedIdx + 1].x - 0.001;
            p.x = Math.max(minX, Math.min(maxX, pos.x));
            p.y = pos.y;
        }
        
        updateParam(effect.id, `points${channel}`, points);
        draw();
    };

    const handlePointerUp = () => {
        draggedIdx = -1;
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
    };

    container.onpointerdown = (e) => {
        const pos = getMousePos(e);
        const channel = effect.params.activeChannel;
        let points = effect.params[`points${channel}`];
        
        // Slightly larger hitbox (0.12 normalized units)
        draggedIdx = points.findIndex(p => Math.hypot(p.x - pos.x, p.y - pos.y) < 0.12);
        
        saveHistory(channel);

        if (draggedIdx === -1) {
            const newPoints = [...points, pos].sort((a, b) => a.x - b.x);
            effect.params[`points${channel}`] = newPoints;
            draggedIdx = newPoints.indexOf(pos);
            updateParam(effect.id, `points${channel}`, newPoints);
            draw();
        }

        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerUp);
    };

    card.querySelector('.reset-curve-btn').onclick = () => {
        const channel = effect.params.activeChannel;
        saveHistory(channel);
        effect.params[`points${channel}`] = [{x: 0, y: 0}, {x: 1, y: 1}];
        updateParam(effect.id, `points${channel}`, effect.params[`points${channel}`]);
        draw();
    };

    card.querySelector('.undo-curve-btn').onclick = () => {
        const channel = effect.params.activeChannel;
        const history = effect.params[`history${channel}`];
        if (history && history.length > 0) {
            const lastState = history.pop();
            effect.params[`points${channel}`] = lastState;
            updateParam(effect.id, `points${channel}`, lastState);
            draw();
        }
    };
}

// removed function renderControls(effect) ...
// removed function createControl(label, key, min, max, step, value) ...
// removed music audio setup and musicBtn.onclick ...

libBtns.forEach(btn => {
    btn.onclick = () => addEffect(btn.dataset.type);
});

if (clearEffectsBtn) {
    clearEffectsBtn.onclick = () => {
        activeEffects = [];
        renderUI();
        renderStack();
    };
}

downloadBtn.onclick = () => {
    renderer.render(activeEffects);
    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = 'processed-image.png';
    link.href = dataUrl;
    link.click();
};

// Generate a video where each segment (default 0.4s) shows the active effects chain repeated N times (N from 1..maxRepeats)
downloadVideoBtn.onclick = async () => {
    const segSeconds = Math.max(0.05, parseFloat(segmentLengthInput.value) || 0.4);
    const maxRepeats = Math.max(1, Math.floor(parseInt(maxRepeatsInput.value) || 10));
    await generateRepeatVideo(segSeconds, maxRepeats);
};

previewIhtxBtn.onclick = async () => {
    const segSeconds = Math.max(0.05, parseFloat(segmentLengthInput.value) || 0.4);
    const maxRepeats = Math.max(1, Math.floor(parseInt(maxRepeatsInput.value) || 10));
    const pitchesVal = document.getElementById('pitches-input')?.value || '-12,0,12';
    const basePitches = pitchesVal.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
    // Reuse generation logic but instead of downloading, play the resulting blob in an overlay player.
    if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
    }

    // Prepare per-segment pitch sets
    const perSegmentPitchSets = expandPitchesForRepeats(basePitches, maxRepeats);

    // Start layered audio for preview if available: play the first segment's layers and then swap layers at segment boundaries.
    let swapTimer = null;
    if (audioToggle?.checked && window.musicManager && perSegmentPitchSets.length > 0) {
        // play first segment
        window.musicManager.playLayers(perSegmentPitchSets[0], true);
        // schedule updates to match each segment transition
        let currentSegment = 0;
        swapTimer = setInterval(() => {
            currentSegment++;
            if (currentSegment >= perSegmentPitchSets.length) {
                // loop back for continuous preview
                currentSegment = 0;
            }
            window.musicManager.stopLayers();
            window.musicManager.playLayers(perSegmentPitchSets[currentSegment], true);
        }, Math.max(50, Math.round(segSeconds * 1000)));
    }

    renderer.render(activeEffects);
    const fps = 30;
    const segmentFrames = Math.max(1, Math.round(segSeconds * fps));

    const videoStream = canvas.captureStream(fps);
    // If music manager has a capture stream, combine audio tracks with video tracks so recorder includes sound
    let finalStream = videoStream;
    if (audioToggle?.checked && window.musicManager) {
        const audioStream = window.musicManager.getStream?.();
        if (audioStream && audioStream.getAudioTracks().length > 0) {
            finalStream = new MediaStream([
                ...videoStream.getVideoTracks(),
                ...audioStream.getAudioTracks()
            ]);
        }
    }

    const recordedChunks = [];
    const mime = 'video/webm; codecs=vp8,opus';
    let recorder;
    try {
        recorder = new MediaRecorder(finalStream, { mimeType: mime });
    } catch (e) {
        alert('MediaRecorder not supported in this browser.');
        if (window.musicManager) window.musicManager.stopLayers();
        startRenderLoop();
        return;
    }

    recorder.ondataavailable = (ev) => { if (ev.data && ev.data.size) recordedChunks.push(ev.data); };

    recorder.start();

    for (let repeat = 1; repeat <= maxRepeats; repeat++) {
        const dup = [];
        for (let r = 0; r < repeat; r++) {
            for (const e of activeEffects) {
                dup.push({
                    id: `gen-${r}-${e.id}`,
                    type: e.type,
                    params: JSON.parse(JSON.stringify(e.params))
                });
            }
        }

        // If we have per-segment pitch sets, switch audio for this repeat index (use index repeat-1)
        if (window.musicManager && perSegmentPitchSets[repeat - 1]) {
            window.musicManager.stopLayers();
            window.musicManager.playLayers(perSegmentPitchSets[repeat - 1], true);
        }

        renderer.render(dup);
        for (let f = 0; f < segmentFrames; f++) {
            renderer.render(dup);
            await new Promise(requestAnimationFrame);
        }
    }

    recorder.stop();
    await new Promise(resolve => recorder.onstop = resolve);

    // stop audio layers started for preview
    if (window.musicManager) {
        window.musicManager.stopLayers();
    }
    if (swapTimer) clearInterval(swapTimer);

    const blob = new Blob(recordedChunks, { type: mime });
    const url = URL.createObjectURL(blob);

    // create overlay player
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.left = 0;
    overlay.style.top = 0;
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.background = 'rgba(0,0,0,0.85)';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.zIndex = 9999;

    const container = document.createElement('div');
    container.style.position = 'relative';
    container.style.maxWidth = '90%';
    container.style.maxHeight = '90%';
    container.style.background = '#000';
    container.style.padding = '8px';
    container.style.borderRadius = '8px';
    container.style.boxShadow = '0 8px 30px rgba(0,0,0,0.7)';

    const videoEl = document.createElement('video');
    videoEl.src = url;
    videoEl.controls = true;
    videoEl.autoplay = true;
    videoEl.style.maxWidth = '100%';
    videoEl.style.maxHeight = '80vh';
    videoEl.loop = true;

    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Close';
    closeBtn.style.position = 'absolute';
    closeBtn.style.top = '8px';
    closeBtn.style.right = '8px';
    closeBtn.style.zIndex = 10000;
    closeBtn.style.background = '#ff4d4d';
    closeBtn.style.border = 'none';
    closeBtn.style.color = '#fff';
    closeBtn.style.padding = '6px 8px';
    closeBtn.style.borderRadius = '4px';
    closeBtn.style.cursor = 'pointer';

    closeBtn.onclick = () => {
        try { videoEl.pause(); } catch (e) {}
        URL.revokeObjectURL(url);
        document.body.removeChild(overlay);
        startRenderLoop();
    };

    container.appendChild(videoEl);
    container.appendChild(closeBtn);
    overlay.appendChild(container);
    document.body.appendChild(overlay);
};

async function generateRepeatVideo(segmentSeconds, maxRepeats) {
    // Pause the live render loop to take manual frames
    if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
    }
    // Ensure canvas rendered at least once before capture
    renderer.render(activeEffects);

    const fps = 30;
    const segmentFrames = Math.max(1, Math.round(segmentSeconds * fps));

    const videoStream = canvas.captureStream(fps);
    let finalStream = videoStream;
    if (audioToggle?.checked && window.musicManager) {
        const audioStream = window.musicManager.getStream?.();
        if (audioStream && audioStream.getAudioTracks().length > 0) {
            finalStream = new MediaStream([
                ...videoStream.getVideoTracks(),
                ...audioStream.getAudioTracks()
            ]);
        }
    }

    const recordedChunks = [];
    const mime = 'video/webm; codecs=vp8,opus';
    let recorder;
    try {
        recorder = new MediaRecorder(finalStream, { mimeType: mime });
    } catch (e) {
        alert('MediaRecorder not supported in this browser.');
        // resume render loop
        startRenderLoop();
        return;
    }

    recorder.ondataavailable = (ev) => { if (ev.data && ev.data.size) recordedChunks.push(ev.data); };

    const totalFrames = segmentFrames * maxRepeats;
    recorder.start();

    // start audio layers for export if pitches specified
    const pitchesVal = document.getElementById('pitches-input')?.value || '-12,0,12';
    const basePitches = pitchesVal.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
    // compute per-segment pitch sets once for the whole export routine
    const perSegmentPitchSets = window.musicManager ? expandPitchesForRepeats(basePitches, maxRepeats) : [];
    // For export we will switch layers at the start of each segment (below).
    // Prime the audioContext by starting the first segment's layers if present and audio is enabled.
    if (audioToggle?.checked && window.musicManager && perSegmentPitchSets.length > 0) {
        window.musicManager.playLayers(perSegmentPitchSets[0], true);
    }

    // For each repeat count, render the chain duplicated that many times and hold for segmentFrames.
    // Also switch audio layers at the start of each segment so audio matches the visual repetition.
    // Precompute per-segment pitch sets (if any) — already computed above (perSegmentPitchSets)

    for (let repeat = 1; repeat <= maxRepeats; repeat++) {
        // Build duplicated effects array (shallow clones of params to avoid mutation)
        const dup = [];
        for (let r = 0; r < repeat; r++) {
            for (const e of activeEffects) {
                dup.push({
                    id: `gen-${r}-${e.id}`,
                    type: e.type,
                    params: JSON.parse(JSON.stringify(e.params))
                });
            }
        }

        // Switch audio layer for this segment if we have a set for it and audio is enabled
        if (audioToggle?.checked && window.musicManager && perSegmentPitchSets[repeat - 1]) {
            window.musicManager.stopLayers();
            window.musicManager.playLayers(perSegmentPitchSets[repeat - 1], true);
        }

        // Render once to ensure texture updated
        renderer.render(dup);

        // Hold the rendered frame for segmentFrames frames (advance via requestAnimationFrame)
        for (let f = 0; f < segmentFrames; f++) {
            // draw current state (textures are static, but we call render to ensure GPU has current)
            renderer.render(dup);
            await new Promise(requestAnimationFrame);
        }
    }

    // Stop recording and collect blob
    recorder.stop();
    await new Promise(resolve => recorder.onstop = resolve);

    // stop audio layers that were started for export
    if (window.musicManager) {
        window.musicManager.stopLayers();
    }

    const blob = new Blob(recordedChunks, { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `repeat-effects_${maxRepeats}x_${segmentSeconds}s.webm`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 20000);

    // Resume render loop
    startRenderLoop();
}

window.onresize = () => renderStack();

init();