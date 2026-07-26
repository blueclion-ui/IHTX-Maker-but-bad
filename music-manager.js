export class MusicManager {
    constructor(audioPathOrElement, musicBtn) {
        this.audioSource = audioPathOrElement; // can be a path string or an HTMLMediaElement
        this.musicBtn = musicBtn;
        this.audioContext = null;
        this.buffer = null;
        this.layers = []; // active layer sources + gain nodes
        this.isToggled = false;
        // A destination we can extract as a MediaStream (for recording)
        this._dest = null;
        // If using a MediaElement source, keep reference
        this._mediaElement = null;

        this._initButton();
        this._loadBufferOrElement();
        // container for cloned media elements when using media element pitch layering
        this._clonedElements = [];
    }

    _initButton() {
        if (!this.musicBtn) return;
        this.musicBtn.onclick = () => {
            if (!this.audioContext) return;
            if (!this.isToggled) {
                // default single layer (no pitch shift)
                this.playLayers([0], true);
                this.musicBtn.textContent = 'Pause Music';
                this.musicBtn.style.background = '#e83e8c';
            } else {
                this.stopLayers();
                this.musicBtn.textContent = 'Play Music';
                this.musicBtn.style.background = '#6f42c1';
            }
            this.isToggled = !this.isToggled;
        };
    }

    async _loadBufferOrElement() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            // create a MediaStreamDestination to capture audio for recording
            this._dest = this.audioContext.createMediaStreamDestination();

            // If a live HTMLMediaElement was supplied, keep it and wire it to destinations.
            if (this.audioSource && typeof this.audioSource !== 'string' && this.audioSource instanceof HTMLMediaElement) {
                this._mediaElement = this.audioSource;
                try {
                    // createMediaElementSource must be called only once per element; guard it
                    if (!this._mediaElementSource) {
                        this._mediaElementSource = this.audioContext.createMediaElementSource(this._mediaElement);
                        // route playback to both default destination (so user hears it) and our capture dest
                        this._mediaElementSource.connect(this.audioContext.destination);
                        this._mediaElementSource.connect(this._dest);
                    }
                } catch (e) {
                    console.warn('Could not create MediaElementSource:', e);
                }
                this.buffer = null;
                return;
            }

            // otherwise try to fetch path and decode into buffer
            if (typeof this.audioSource === 'string' && this.audioSource.length > 0) {
                const resp = await fetch(this.audioSource);
                const ab = await resp.arrayBuffer();
                this.buffer = await this.audioContext.decodeAudioData(ab);
            } else {
                this.buffer = null;
            }
        } catch (e) {
            console.warn('Failed to initialize audio source:', e);
            this.buffer = null;
        }
    }

    // allow runtime swapping to a MediaElement (useful when user uploads/loads video)
    async useMediaElement(mediaEl) {
        // allow switching to a live HTMLMediaElement; reinitialize routing
        this.stopLayers();
        this.audioSource = mediaEl;
        await this._loadBufferOrElement();
    }

    // Return MediaStream (or null) representing current internal destination
    getStream() {
        return this._dest ? this._dest.stream : null;
    }

    // Play multiple pitched layers. pitches: array of semitone offsets (numbers).
    // loop: boolean to loop playback.
    // Note: if a MediaElement was provided as the audio source we cannot create BufferSource layers;
    // in that case we try to pre-render pitched layers so playback rate stays at 1.0 (pitch changed without changing speed).
    async playLayers(pitches = [0], loop = true) {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }

        // Stop any existing layers / clones first
        this.stopLayers();

        // Helper fallback: simple clone approach using playbackRate (changes speed) if no better method available
        const fallbackCloneWithRate = async (srcUrl) => {
            for (let i = 0; i < pitches.length; i++) {
                const semis = Number(pitches[i]) || 0;
                const clone = document.createElement('audio');
                clone.src = srcUrl;
                clone.crossOrigin = 'anonymous';
                clone.loop = !!loop;
                clone.playbackRate = Math.pow(2, semis / 12);
                clone.muted = false;
                clone.preload = 'auto';
                clone.play().catch(()=>{});
                let srcNode = null;
                try {
                    srcNode = this.audioContext.createMediaElementSource(clone);
                    srcNode.connect(this.audioContext.destination);
                    if (this._dest) srcNode.connect(this._dest);
                } catch (e2) {
                    try {
                        const stream = clone.captureStream ? clone.captureStream() : null;
                        if (stream) {
                            const msSource = this.audioContext.createMediaStreamSource(stream);
                            msSource.connect(this.audioContext.destination);
                            if (this._dest) msSource.connect(this._dest);
                            srcNode = msSource;
                        }
                    } catch (e3) {
                        console.warn('Fallback clone source creation failed:', e3);
                    }
                }
                this._clonedElements.push({ el: clone, srcNode });
            }
        };

        // If we have an attached live media element (e.g., video), attempt to derive a buffer and pre-render pitched layers
        if (this._mediaElement) {
            try {
                // ensure audio context resumed
                if (this.audioContext.state === 'suspended') {
                    try { await this.audioContext.resume(); } catch(e){}
                }

                const srcUrl = this._mediaElement.currentSrc || this._mediaElement.src;
                if (!srcUrl) {
                    console.warn('Media element has no source to derive pitched layers from.');
                    return;
                }

                // load & decode into an AudioBuffer if not already available as this.buffer
                let baseBuffer = this.buffer;
                if (!baseBuffer || this._lastLoadedSrc !== srcUrl) {
                    try {
                        const resp = await fetch(srcUrl, { mode: 'cors' });
                        const ab = await resp.arrayBuffer();
                        baseBuffer = await this.audioContext.decodeAudioData(ab);
                        this.buffer = baseBuffer;
                        this._lastLoadedSrc = srcUrl;
                    } catch (e) {
                        console.warn('Could not fetch/decode media element source for pitch rendering:', e);
                        // fallback to simple clones (changes speed) if fetch fails
                        await fallbackCloneWithRate(srcUrl);
                        return;
                    }
                }

                // Try to dynamically import SoundTouch processing (time-stretch/pitch-shift preserving duration).
                // If unavailable, fall back to pre-render via OfflineAudioContext (may alter duration) or clone fallback.
                let soundtouch = null;
                try {
                    // Try commonly available package name on esm.sh
                    soundtouch = await import('https://esm.sh/soundtouchjs@0.0.4?dev');
                    // some builds expose default
                    soundtouch = soundtouch.default || soundtouch;
                } catch (e) {
                    try {
                        soundtouch = await import('https://esm.sh/soundtouch@0.1.0?dev');
                        soundtouch = soundtouch.default || soundtouch;
                    } catch (e2) {
                        soundtouch = null;
                    }
                }

                if (soundtouch && soundtouch.SoundTouch) {
                    // Use SoundTouch library to create pitched buffers that preserve original duration
                    // Implementation: convert AudioBuffer to Float32 arrays, feed into SimpleFilter with rate ratio,
                    // collect processed samples and build new AudioBuffer for playback.
                    for (let i = 0; i < pitches.length; i++) {
                        const semis = Number(pitches[i]) || 0;
                        // pitch shift ratio: targetPitch = original * 2^(semitones/12)
                        const ratio = Math.pow(2, semis / 12);

                        try {
                            const st = new soundtouch.SoundTouch(this.audioContext.sampleRate);
                            st.tempo = 1.0; // keep tempo
                            st.pitch = ratio; // if library supports direct pitch; otherwise use rate below
                            // Fallback: if pitch property not supported, adjust rate and compensate with tempo
                            if (typeof st.pitch === 'undefined') {
                                // Using rate and tempo hack: set rate = ratio, tempo = 1/ratio to preserve duration
                                st.rate = ratio;
                                st.tempo = 1.0 / ratio;
                            }

                            const channels = [];
                            for (let ch = 0; ch < baseBuffer.numberOfChannels; ch++) {
                                channels.push(baseBuffer.getChannelData(ch));
                            }

                            const bufferSource = new soundtouch.BufferSource(channels, baseBuffer.length);
                            const filter = new soundtouch.SimpleFilter(bufferSource, st);

                            const outLength = baseBuffer.length; // preserve original length
                            const out = new Float32Array(outLength * baseBuffer.numberOfChannels);
                            let offset = 0;
                            const tmp = new Float32Array(1024);

                            while (offset < outLength) {
                                const framesExtracted = filter.extract(tmp, 1024);
                                if (framesExtracted === 0) break;
                                for (let f = 0; f < framesExtracted; f++) {
                                    for (let ch = 0; ch < baseBuffer.numberOfChannels; ch++) {
                                        const idx = (offset + f) * baseBuffer.numberOfChannels + ch;
                                        out[idx] = tmp[f * baseBuffer.numberOfChannels + ch] || 0;
                                    }
                                }
                                offset += framesExtracted;
                            }

                            // Create new AudioBuffer and copy data
                            const rendered = this.audioContext.createBuffer(baseBuffer.numberOfChannels, outLength, this.audioContext.sampleRate);
                            for (let ch = 0; ch < baseBuffer.numberOfChannels; ch++) {
                                const channelData = rendered.getChannelData(ch);
                                for (let s = 0; s < outLength; s++) {
                                    channelData[s] = out[s * baseBuffer.numberOfChannels + ch] || 0;
                                }
                            }

                            // Encode rendered AudioBuffer to WAV and play via media element to route through audioContext destination+_dest
                            const wavBlob = this._encodeWAV(rendered);
                            const blobUrl = URL.createObjectURL(wavBlob);
                            const audioEl = document.createElement('audio');
                            audioEl.src = blobUrl;
                            audioEl.loop = !!loop;
                            audioEl.crossOrigin = 'anonymous';
                            audioEl.preload = 'auto';
                            audioEl.playbackRate = 1.0; // ensure normal speed
                            audioEl.muted = false;
                            audioEl.play().catch(()=>{});

                            let srcNode = null;
                            try {
                                srcNode = this.audioContext.createMediaElementSource(audioEl);
                                srcNode.connect(this.audioContext.destination);
                                if (this._dest) srcNode.connect(this._dest);
                            } catch (e) {
                                try {
                                    const stream = audioEl.captureStream ? audioEl.captureStream() : null;
                                    if (stream) {
                                        const msSource = this.audioContext.createMediaStreamSource(stream);
                                        msSource.connect(this.audioContext.destination);
                                        if (this._dest) msSource.connect(this._dest);
                                        srcNode = msSource;
                                    }
                                } catch (e2) {
                                    console.warn('Could not create stream source for soundtouch result:', e2);
                                }
                            }

                            this._clonedElements.push({ el: audioEl, srcNode, _blobUrl: blobUrl });
                        } catch (e) {
                            console.warn('SoundTouch processing failed for a pitch layer, falling back to offline render for that layer:', e);
                            // fallback to offline render for this layer below
                            // (we just let the outer code continue to offline fallback)
                        }
                    }

                    // If we successfully produced clonedElements for all pitches, return early.
                    if (this._clonedElements.length >= pitches.length) return;
                    // else continue to offline fallback for remaining layers
                }

                // If SoundTouch not available or failed to produce all layers, fallback to offline rendering per-pitch.
                for (let i = 0; i < pitches.length; i++) {
                    const semis = Number(pitches[i]) || 0;
                    const rate = Math.pow(2, semis / 12);

                    // Render pitched audio via OfflineAudioContext (this changes duration to baseBuffer.duration / rate).
                    // We still play the resulting blob at playbackRate = 1 to avoid changing playback speed in playback,
                    // but note the wall-clock duration will differ if rate != 1. This is a pragmatic fallback.
                    try {
                        const offlineSampleRate = this.audioContext.sampleRate;
                        const offlineLength = Math.max(1, Math.ceil(baseBuffer.length / Math.max(0.0001, rate)));
                        const offline = new OfflineAudioContext(baseBuffer.numberOfChannels, offlineLength, offlineSampleRate);

                        const src = offline.createBufferSource();
                        src.buffer = baseBuffer;
                        src.playbackRate.value = rate;
                        src.loop = false;

                        const gain = offline.createGain();
                        gain.gain.value = 1.0;

                        src.connect(gain);
                        gain.connect(offline.destination);
                        src.start(0);

                        const renderedBuffer = await offline.startRendering();

                        const wavBlob = this._encodeWAV(renderedBuffer);
                        const blobUrl = URL.createObjectURL(wavBlob);

                        const audioEl = document.createElement('audio');
                        audioEl.src = blobUrl;
                        audioEl.loop = !!loop;
                        audioEl.crossOrigin = 'anonymous';
                        audioEl.preload = 'auto';
                        audioEl.playbackRate = 1.0; // ensure normal speed
                        audioEl.muted = false;
                        audioEl.play().catch(()=>{});

                        let srcNode = null;
                        try {
                            srcNode = this.audioContext.createMediaElementSource(audioEl);
                            srcNode.connect(this.audioContext.destination);
                            if (this._dest) srcNode.connect(this._dest);
                        } catch (e) {
                            try {
                                const stream = audioEl.captureStream ? audioEl.captureStream() : null;
                                if (stream) {
                                    const msSource = this.audioContext.createMediaStreamSource(stream);
                                    msSource.connect(this.audioContext.destination);
                                    if (this._dest) msSource.connect(this._dest);
                                    srcNode = msSource;
                                }
                            } catch (e2) {
                                console.warn('Could not create stream source for pre-rendered pitch:', e2);
                            }
                        }

                        this._clonedElements.push({ el: audioEl, srcNode, _blobUrl: blobUrl });
                    } catch (e) {
                        console.warn('Offline rendering failed for a pitch layer, falling back to playbackRate clone:', e);
                        await fallbackCloneWithRate(srcUrl);
                        return;
                    }
                }
            } catch (e) {
                console.warn('Error playing media element layers (pre-render path):', e);
            }
            return;
        }

        // Otherwise use decoded buffer sources. Try to preserve speed while shifting pitch by using SoundTouch if available,
        // otherwise fall back to the classic playbackRate change (which alters speed).
        if (!this.buffer) {
            // try to load buffer once more, then retry
            this._loadBufferOrElement().then(() => this.playLayers(pitches, loop));
            return;
        }

        // Try dynamic SoundTouch import to perform pitch shifting without changing speed on decoded buffer case.
        let usedSoundTouch = false;
        try {
            let soundtouch = null;
            try {
                soundtouch = await import('https://esm.sh/soundtouchjs@0.0.4?dev');
                soundtouch = soundtouch.default || soundtouch;
            } catch (e) {
                try {
                    soundtouch = await import('https://esm.sh/soundtouch@0.1.0?dev');
                    soundtouch = soundtouch.default || soundtouch;
                } catch (e2) {
                    soundtouch = null;
                }
            }

            if (soundtouch && soundtouch.SoundTouch) {
                const baseBuffer = this.buffer;
                for (let i = 0; i < pitches.length; i++) {
                    const semis = Number(pitches[i]) || 0;
                    const ratio = Math.pow(2, semis / 12);
                    try {
                        const st = new soundtouch.SoundTouch(this.audioContext.sampleRate);
                        st.tempo = 1.0;
                        st.pitch = ratio;
                        if (typeof st.pitch === 'undefined') {
                            st.rate = ratio;
                            st.tempo = 1.0 / ratio;
                        }

                        const channels = [];
                        for (let ch = 0; ch < baseBuffer.numberOfChannels; ch++) {
                            channels.push(baseBuffer.getChannelData(ch));
                        }

                        const bufferSource = new soundtouch.BufferSource(channels, baseBuffer.length);
                        const filter = new soundtouch.SimpleFilter(bufferSource, st);

                        const outLength = baseBuffer.length;
                        const out = new Float32Array(outLength * baseBuffer.numberOfChannels);
                        let offset = 0;
                        const tmp = new Float32Array(1024);

                        while (offset < outLength) {
                            const framesExtracted = filter.extract(tmp, 1024);
                            if (framesExtracted === 0) break;
                            for (let f = 0; f < framesExtracted; f++) {
                                for (let ch = 0; ch < baseBuffer.numberOfChannels; ch++) {
                                    const idx = (offset + f) * baseBuffer.numberOfChannels + ch;
                                    out[idx] = tmp[f * baseBuffer.numberOfChannels + ch] || 0;
                                }
                            }
                            offset += framesExtracted;
                        }

                        const rendered = this.audioContext.createBuffer(baseBuffer.numberOfChannels, outLength, this.audioContext.sampleRate);
                        for (let ch = 0; ch < baseBuffer.numberOfChannels; ch++) {
                            const channelData = rendered.getChannelData(ch);
                            for (let s = 0; s < outLength; s++) {
                                channelData[s] = out[s * baseBuffer.numberOfChannels + ch] || 0;
                            }
                        }

                        // Create and play via media element so we can route to _dest for recording
                        const wavBlob = this._encodeWAV(rendered);
                        const blobUrl = URL.createObjectURL(wavBlob);
                        const audioEl = document.createElement('audio');
                        audioEl.src = blobUrl;
                        audioEl.loop = !!loop;
                        audioEl.crossOrigin = 'anonymous';
                        audioEl.preload = 'auto';
                        audioEl.playbackRate = 1.0;
                        audioEl.muted = false;
                        audioEl.play().catch(()=>{});

                        let srcNode = null;
                        try {
                            srcNode = this.audioContext.createMediaElementSource(audioEl);
                            srcNode.connect(this.audioContext.destination);
                            if (this._dest) srcNode.connect(this._dest);
                        } catch (e) {
                            try {
                                const stream = audioEl.captureStream ? audioEl.captureStream() : null;
                                if (stream) {
                                    const msSource = this.audioContext.createMediaStreamSource(stream);
                                    msSource.connect(this.audioContext.destination);
                                    if (this._dest) msSource.connect(this._dest);
                                    srcNode = msSource;
                                }
                            } catch (e2) {
                                console.warn('Could not create stream source for soundtouch result:', e2);
                            }
                        }

                        this._clonedElements.push({ el: audioEl, srcNode, _blobUrl: blobUrl });
                    } catch (e) {
                        console.warn('SoundTouch processing failed for a decoded-buffer pitch layer:', e);
                    }
                }
                usedSoundTouch = this._clonedElements.length > 0;
            }
        } catch (e) {
            console.warn('SoundTouch dynamic import or processing error:', e);
        }

        if (usedSoundTouch) return;

        // Final fallback: classic BufferSource playbackRate approach (changes speed)
        const now = this.audioContext.currentTime;
        for (const semis of pitches) {
            const src = this.audioContext.createBufferSource();
            src.buffer = this.buffer;
            const rate = Math.pow(2, (Number(semis) || 0) / 12);
            src.playbackRate.value = rate;
            src.loop = !!loop;
            const gain = this.audioContext.createGain();
            gain.gain.value = 1.0 / Math.max(1, pitches.length);
            src.connect(gain);
            try { gain.connect(this.audioContext.destination); } catch (e) {}
            if (this._dest) {
                try { gain.connect(this._dest); } catch (e) {}
            }
            src.start(now);
            this.layers.push({ src, gain });
        }
    }

    stopLayers() {
        // stop buffer layers
        if (this.layers && this.layers.length > 0) {
            for (const l of this.layers) {
                try { l.src.stop(); } catch(e) {}
                try { l.src.disconnect(); } catch(e){}
                try { l.gain.disconnect(); } catch(e){}
            }
            this.layers = [];
        }

        // stop and remove any cloned media elements (used when using video audio)
        if (this._clonedElements && this._clonedElements.length > 0) {
            for (const item of this._clonedElements) {
                try { if (item.srcNode) item.srcNode.disconnect(); } catch(e){}
                try { item.el.pause(); } catch(e){}
                try { 
                    // revoke any blob URLs we created
                    if (item._blobUrl) URL.revokeObjectURL(item._blobUrl);
                } catch(e){}
                try { item.el.src = ''; } catch(e){}
                try { if (item.el.parentNode) item.el.parentNode.removeChild(item.el); } catch(e){}
            }
            this._clonedElements = [];
        }

        // if using a single media element and there are no cloned layers, also pause the main media element
        if (this._mediaElement && (!this._clonedElements || this._clonedElements.length === 0)) {
            try { this._mediaElement.pause(); } catch(e){}
        }
    }

    // Helper: encode an AudioBuffer into a WAV blob (16-bit PCM)
    _encodeWAV(buffer) {
        const numChannels = buffer.numberOfChannels;
        const sampleRate = buffer.sampleRate;
        const format = 1; // PCM
        const bitsPerSample = 16;
        const blockAlign = numChannels * bitsPerSample / 8;
        const byteRate = sampleRate * blockAlign;
        const samples = buffer.length * numChannels;
        const dataSize = samples * (bitsPerSample / 8);
        const bufferSize = 44 + dataSize;
        const arrayBuffer = new ArrayBuffer(bufferSize);
        const view = new DataView(arrayBuffer);

        function writeString(view, offset, str) {
            for (let i = 0; i < str.length; i++) {
                view.setUint8(offset + i, str.charCodeAt(i));
            }
        }

        let offset = 0;
        writeString(view, offset, 'RIFF'); offset += 4;
        view.setUint32(offset, 36 + dataSize, true); offset += 4;
        writeString(view, offset, 'WAVE'); offset += 4;
        writeString(view, offset, 'fmt '); offset += 4;
        view.setUint32(offset, 16, true); offset += 4;
        view.setUint16(offset, format, true); offset += 2;
        view.setUint16(offset, numChannels, true); offset += 2;
        view.setUint32(offset, sampleRate, true); offset += 4;
        view.setUint32(offset, byteRate, true); offset += 4;
        view.setUint16(offset, blockAlign, true); offset += 2;
        view.setUint16(offset, bitsPerSample, true); offset += 2;
        writeString(view, offset, 'data'); offset += 4;
        view.setUint32(offset, dataSize, true); offset += 4;

        // interleave channels and convert to 16-bit PCM
        const interleaved = new Int16Array(samples);
        let idx = 0;
        for (let i = 0; i < buffer.length; i++) {
            for (let ch = 0; ch < numChannels; ch++) {
                const channelData = buffer.getChannelData(ch);
                const s = Math.max(-1, Math.min(1, channelData[i]));
                interleaved[idx++] = s < 0 ? s * 0x8000 : s * 0x7FFF;
            }
        }

        // write samples
        for (let i = 0; i < interleaved.length; i++, offset += 2) {
            view.setInt16(offset, interleaved[i], true);
        }

        return new Blob([view], { type: 'audio/wav' });
    }
}