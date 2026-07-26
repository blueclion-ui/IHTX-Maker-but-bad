import { vertexShaderSource, baseFragmentShader } from './shaders-core.js';
import { swirlFragmentShader, shakeFragmentShader, flipFragmentShader, mirrorFragmentShader, standardMirrorFragmentShader, sphereFragmentShader, zoomPanFragmentShader, rotateFragmentShader, wavinessFragmentShader, rippleFragmentShader, mosaicFragmentShader, animatedWaveFragmentShader } from './shaders-geometric.js';
import { hueFragmentShader, hueLumFragmentShader, invertFragmentShader, bgrFragmentShader, gradientMapFragmentShader, darknessFragmentShader, bit3FragmentShader, bit6FragmentShader, saturationFragmentShader, advInvertFragmentShader, hslMapFragmentShader, rgbCurveFragmentShader } from './shaders-color.js';

export class WebGLRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.gl = canvas.getContext('webgl');
        if (!this.gl) {
            console.error("WebGL not supported");
            return;
        }

        this.programs = {
            base: this.createProgram(vertexShaderSource, baseFragmentShader),
            swirl: this.createProgram(vertexShaderSource, swirlFragmentShader),
            hue: this.createProgram(vertexShaderSource, hueFragmentShader),
            hueLum: this.createProgram(vertexShaderSource, hueLumFragmentShader),
            waviness: this.createProgram(vertexShaderSource, wavinessFragmentShader),
            flip: this.createProgram(vertexShaderSource, flipFragmentShader),
            mirror: this.createProgram(vertexShaderSource, mirrorFragmentShader),
            standardMirror: this.createProgram(vertexShaderSource, standardMirrorFragmentShader),
            sphere: this.createProgram(vertexShaderSource, sphereFragmentShader),
            zoomPan: this.createProgram(vertexShaderSource, zoomPanFragmentShader),
            rotate: this.createProgram(vertexShaderSource, rotateFragmentShader),
            invert: this.createProgram(vertexShaderSource, invertFragmentShader),
            bgr: this.createProgram(vertexShaderSource, bgrFragmentShader),
            ripple: this.createProgram(vertexShaderSource, rippleFragmentShader),
            gradientMap: this.createProgram(vertexShaderSource, gradientMapFragmentShader),
            darkness: this.createProgram(vertexShaderSource, darknessFragmentShader),
            bit3: this.createProgram(vertexShaderSource, bit3FragmentShader),
            bit6: this.createProgram(vertexShaderSource, bit6FragmentShader),
            saturation: this.createProgram(vertexShaderSource, saturationFragmentShader),
            mosaic: this.createProgram(vertexShaderSource, mosaicFragmentShader),
            advInvert: this.createProgram(vertexShaderSource, advInvertFragmentShader),
            hslMap: this.createProgram(vertexShaderSource, hslMapFragmentShader),
            rgbCurve: this.createProgram(vertexShaderSource, rgbCurveFragmentShader),
            animatedWave: this.createProgram(vertexShaderSource, animatedWaveFragmentShader)
        };

        this.initBuffers();
        this.initFBOs();
        
        this.originalTexture = null;
        this.lutTexture = this.gl.createTexture();
        this.imageLoaded = false;
        this.aspectRatio = 1.0;

        // video support
        this.videoElement = null;
        this.videoTexture = null;
        this.isVideoPlaying = false;
    }

    createShader(type, source) {
        const shader = this.gl.createShader(type);
        this.gl.shaderSource(shader, source);
        this.gl.compileShader(shader);
        if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
            console.error(this.gl.getShaderInfoLog(shader));
            this.gl.deleteShader(shader);
            return null;
        }
        return shader;
    }

    createProgram(vsSource, fsSource) {
        const vs = this.createShader(this.gl.VERTEX_SHADER, vsSource);
        const fs = this.createShader(this.gl.FRAGMENT_SHADER, fsSource);
        if (!vs || !fs) return null;
        
        const program = this.gl.createProgram();
        this.gl.attachShader(program, vs);
        this.gl.attachShader(program, fs);
        this.gl.linkProgram(program);
        if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
            console.error(this.gl.getProgramInfoLog(program));
            return null;
        }
        return program;
    }

    initBuffers() {
        const positions = new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]);
        const texCoords = new Float32Array([0,0, 1,0, 0,1, 0,1, 1,0, 1,1]);

        this.posBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.posBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, positions, this.gl.STATIC_DRAW);

        this.texCoordBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.texCoordBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, texCoords, this.gl.STATIC_DRAW);
    }

    initFBOs() {
        this.fbos = [this.createFBO(), this.createFBO()];
    }

    createFBO() {
        const gl = this.gl;
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

        const fbo = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

        return { fbo, texture };
    }

    resizeFBOs(width, height) {
        const gl = this.gl;
        this.fbos.forEach(obj => {
            gl.bindTexture(gl.TEXTURE_2D, obj.texture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        });
    }

    loadImage(src) {
        // stop any current video
        if (this.videoElement) {
            try { this.videoElement.pause(); } catch(e) {}
            this.videoElement = null;
            this.videoTexture = null;
            this.isVideoPlaying = false;
        }

        return new Promise((resolve, reject) => {
            const image = new Image();
            image.crossOrigin = "anonymous";
            image.onload = () => {
                const gl = this.gl;
                this.originalTexture = gl.createTexture();
                gl.bindTexture(gl.TEXTURE_2D, this.originalTexture);
                gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
                
                this.canvas.width = image.width;
                this.canvas.height = image.height;
                this.aspectRatio = image.width / image.height;
                this.resizeFBOs(image.width, image.height);
                this.imageLoaded = true;
                resolve();
            };
            image.onerror = reject;
            image.src = src;
        });
    }

    loadVideo(src) {
        return new Promise((resolve, reject) => {
            // stop any previous video
            if (this.videoElement) {
                try { this.videoElement.pause(); } catch(e) {}
            }

            const video = document.createElement('video');
            video.crossOrigin = "anonymous";
            video.src = src;
            video.loop = true;
            video.muted = true;
            video.playsInline = true;
            video.preload = 'auto';
            video.addEventListener('loadedmetadata', () => {
                this.canvas.width = video.videoWidth;
                this.canvas.height = video.videoHeight;
                this.aspectRatio = video.videoWidth / video.videoHeight;
                this.resizeFBOs(video.videoWidth, video.videoHeight);

                const gl = this.gl;
                this.videoTexture = gl.createTexture();
                gl.bindTexture(gl.TEXTURE_2D, this.videoTexture);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
                
                this.videoElement = video;
                this.isVideoPlaying = false;
                // start playback; some browsers require a user gesture, caller should attempt play
                video.play().then(() => { this.isVideoPlaying = true; }).catch(()=>{});
                this.imageLoaded = true;
                resolve();
            });
            video.onerror = reject;
            // try to load
            video.load();
        });
    }

    render(effects) {
        if (!this.imageLoaded) return;

        const gl = this.gl;
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

        let currentInputTexture = this.originalTexture;
        let fboIndex = 0;

        // If we have a video source, update its texture from current frame
        if (this.videoElement && this.videoTexture && this.videoElement.readyState >= 2) {
            const gl = this.gl;
            gl.bindTexture(gl.TEXTURE_2D, this.videoTexture);
            try {
                gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.videoElement);
            } catch (e) {
                // browsers may require different handling; ignore errors
            }
            currentInputTexture = this.videoTexture;
        }

        // Sequence: Initial -> Effect 1 -> Effect 2 -> ... -> Final
        for (let i = 0; i < effects.length; i++) {
            const effect = effects[i];
            const target = this.fbos[fboIndex];
            
            this.drawPass(effect.type, effect.params, currentInputTexture, target.fbo);
            
            currentInputTexture = target.texture;
            fboIndex = (fboIndex + 1) % 2;
        }

        // Draw final result to screen
        this.drawPass('base', {}, currentInputTexture, null);
    }

    drawPass(type, params, inputTexture, targetFBO) {
        const gl = this.gl;
        const program = this.programs[type] || this.programs.base;
        if (!program) return;

        gl.bindFramebuffer(gl.FRAMEBUFFER, targetFBO);
        gl.useProgram(program);

        const posLoc = gl.getAttribLocation(program, "position");
        gl.enableVertexAttribArray(posLoc);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuffer);
        gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

        const texLoc = gl.getAttribLocation(program, "texCoord");
        gl.enableVertexAttribArray(texLoc);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
        gl.vertexAttribPointer(texLoc, 2, gl.FLOAT, false, 0, 0);

        // Uniforms based on type
        if (type === 'swirl') {
            gl.uniform2f(gl.getUniformLocation(program, "uCenter"), params.centerX, 1.0 - params.centerY);
            gl.uniform1f(gl.getUniformLocation(program, "uRadius"), params.radius);
            gl.uniform1f(gl.getUniformLocation(program, "uAngle"), params.angle);
            gl.uniform1f(gl.getUniformLocation(program, "uSwirlPower"), params.swirlPower);
            gl.uniform1i(gl.getUniformLocation(program, "uFillAspectRatio"), params.fillAspectRatio ? 1 : 0);
            gl.uniform1f(gl.getUniformLocation(program, "uAspectRatio"), this.aspectRatio);
        } else if (type === 'shake') {
            // convert pixel jitter into normalized UV units based on canvas size
            const pxX = Number(params.amountX) || 0;
            const pxY = Number(params.amountY) || 0;
            // params may be set to time-varying random values by caller; we expect uShakeX/uShakeY normalized already if so.
            // If values look large we convert from px to uv:
            const normX = pxX / Math.max(1, this.canvas.width);
            const normY = pxY / Math.max(1, this.canvas.height);
            // The params may supply precomputed uShakeX/uShakeY (normalized) or amountX/amountY; prefer uShake* when present
            const shakeX = typeof params.uShakeX !== 'undefined' ? params.uShakeX : (Math.random() * 2.0 - 1.0) * normX;
            const shakeY = typeof params.uShakeY !== 'undefined' ? params.uShakeY : (Math.random() * 2.0 - 1.0) * normY;
            gl.uniform1f(gl.getUniformLocation(program, "uShakeX"), shakeX);
            gl.uniform1f(gl.getUniformLocation(program, "uShakeY"), shakeY);
        } else if (type === 'hue' || type === 'hueLum') {
            gl.uniform1f(gl.getUniformLocation(program, "uHueShift"), params.hueShift);
        } else if (type === 'waviness') {
            gl.uniform1f(gl.getUniformLocation(program, "uFreqH"), params.freqH);
            gl.uniform1f(gl.getUniformLocation(program, "uAmpH"), params.ampH);
            gl.uniform1f(gl.getUniformLocation(program, "uPhaseH"), params.phaseH);
            gl.uniform1f(gl.getUniformLocation(program, "uFreqV"), params.freqV);
            gl.uniform1f(gl.getUniformLocation(program, "uAmpV"), params.ampV);
            gl.uniform1f(gl.getUniformLocation(program, "uPhaseV"), params.phaseV);
        } else if (type === 'flip') {
            gl.uniform1i(gl.getUniformLocation(program, "uFlipH"), params.flipH ? 1 : 0);
            gl.uniform1i(gl.getUniformLocation(program, "uFlipV"), params.flipV ? 1 : 0);
        } else if (type === 'mirror') {
            const angle = params.orientation === 'vertical' ? 90.0 : 0.0;
            gl.uniform1f(gl.getUniformLocation(program, "uAngle"), angle);
            gl.uniform1f(gl.getUniformLocation(program, "uOffset"), params.offset);
            gl.uniform1i(gl.getUniformLocation(program, "uFlipBefore"), params.flipBefore ? 1 : 0);
            gl.uniform1i(gl.getUniformLocation(program, "uFlipAfter"), params.flipAfter ? 1 : 0);
        } else if (type === 'standardMirror') {
            gl.uniform1f(gl.getUniformLocation(program, "uAngle"), params.angle);
            gl.uniform1f(gl.getUniformLocation(program, "uPosition"), params.position);
            gl.uniform1f(gl.getUniformLocation(program, "uAspectRatio"), this.aspectRatio);
        } else if (type === 'sphere') {
            gl.uniform2f(gl.getUniformLocation(program, "uCenter"), params.centerX, 1.0 - params.centerY);
            gl.uniform1f(gl.getUniformLocation(program, "uRadius"), params.radius);
            gl.uniform1f(gl.getUniformLocation(program, "uIntensity"), params.intensity);
            gl.uniform1i(gl.getUniformLocation(program, "uFillAspectRatio"), params.fillAspectRatio ? 1 : 0);
            gl.uniform1f(gl.getUniformLocation(program, "uAspectRatio"), this.aspectRatio);
        } else if (type === 'zoomPan') {
            gl.uniform1f(gl.getUniformLocation(program, "uZoom"), params.zoom);
            gl.uniform2f(gl.getUniformLocation(program, "uOffset"), params.offsetX, -params.offsetY);
        } else if (type === 'rotate') {
            gl.uniform1f(gl.getUniformLocation(program, "uAngle"), params.angle);
            gl.uniform1f(gl.getUniformLocation(program, "uAspectRatio"), this.aspectRatio);
            gl.uniform1i(gl.getUniformLocation(program, "uFixAspect"), params.fixAspect ? 1 : 0);
        } else if (type === 'invert') {
            gl.uniform1i(gl.getUniformLocation(program, "uInvertR"), params.invertR ? 1 : 0);
            gl.uniform1i(gl.getUniformLocation(program, "uInvertG"), params.invertG ? 1 : 0);
            gl.uniform1i(gl.getUniformLocation(program, "uInvertB"), params.invertB ? 1 : 0);
        } else if (type === 'ripple') {
            gl.uniform2f(gl.getUniformLocation(program, "uCenter"), params.centerX, 1.0 - params.centerY);
            gl.uniform1f(gl.getUniformLocation(program, "uFreq"), params.freq);
            gl.uniform1f(gl.getUniformLocation(program, "uAmp"), params.amp);
            gl.uniform1f(gl.getUniformLocation(program, "uPhase"), params.phase);
            gl.uniform1f(gl.getUniformLocation(program, "uAspectRatio"), this.aspectRatio);
        } else if (type === 'gradientMap') {
            const hexToRgb = (hex) => {
                const r = parseInt(hex.slice(1, 3), 16) / 255;
                const g = parseInt(hex.slice(3, 5), 16) / 255;
                const b = parseInt(hex.slice(5, 7), 16) / 255;
                return [r, g, b];
            };
            const colors = [params.c1, params.c2, params.c3, params.c4, params.c5].map(hexToRgb).flat();
            gl.uniform3fv(gl.getUniformLocation(program, "uColors"), new Float32Array(colors));
            gl.uniform1i(gl.getUniformLocation(program, "uColorCount"), params.colorCount);
            gl.uniform1i(gl.getUniformLocation(program, "uGrayMode"), params.grayMode);
            gl.uniform3f(gl.getUniformLocation(program, "uWeights"), params.wR, params.wG, params.wB);
        } else if (type === 'saturation') {
            gl.uniform1f(gl.getUniformLocation(program, "uSaturation"), params.saturation);
        } else if (type === 'mosaic') {
            gl.uniform1f(gl.getUniformLocation(program, "uPixelWidth"), params.pixelWidth);
            gl.uniform1f(gl.getUniformLocation(program, "uPixelHeight"), params.pixelHeight);
        } else if (type === 'advInvert') {
            const hexToRgb = (hex) => {
                const r = parseInt(hex.slice(1, 3), 16) / 255;
                const g = parseInt(hex.slice(3, 5), 16) / 255;
                const b = parseInt(hex.slice(5, 7), 16) / 255;
                return [r, g, b];
            };
            gl.uniform3fv(gl.getUniformLocation(program, "uTargetColor"), new Float32Array(hexToRgb(params.targetColor)));
            gl.uniform1i(gl.getUniformLocation(program, "uSquare"), params.square ? 1 : 0);
        } else if (type === 'hslMap') {
            gl.uniform1i(gl.getUniformLocation(program, "uMode"), params.mode);
        } else if (type === 'rgbCurve') {
            this.updateCurveLUT(params);
            gl.activeTexture(gl.TEXTURE1);
            gl.bindTexture(gl.TEXTURE_2D, this.lutTexture);
            gl.uniform1i(gl.getUniformLocation(program, "uCurveLUT"), 1);
        } else if (type === 'animatedWave') {
            // normalize direction
            const dx = params.directionX || 1.0;
            const dy = params.directionY || 0.0;
            const len = Math.max(1e-6, Math.sqrt(dx*dx + dy*dy));
            const ndx = dx / len;
            const ndy = dy / len;
            gl.uniform1f(gl.getUniformLocation(program, "uTime"), performance.now() / 1000.0);
            gl.uniform1f(gl.getUniformLocation(program, "uFreq"), params.freq);
            gl.uniform1f(gl.getUniformLocation(program, "uAmp"), params.amp);
            gl.uniform1f(gl.getUniformLocation(program, "uSpeed"), params.speed);
            gl.uniform1f(gl.getUniformLocation(program, "uPhase"), params.phase || 0.0);
            gl.uniform2f(gl.getUniformLocation(program, "uDirection"), ndx, ndy);
            gl.uniform1f(gl.getUniformLocation(program, "uAspectRatio"), this.aspectRatio);
        }

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, inputTexture);
        gl.uniform1i(gl.getUniformLocation(program, "uSampler"), 0);

        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    updateCurveLUT(params) {
        const gl = this.gl;
        const lut = new Uint8Array(256 * 4);
        
        const getVal = (points, x) => {
            if (x <= points[0].x) return points[0].y;
            if (x >= points[points.length - 1].x) return points[points.length - 1].y;
            for (let i = 0; i < points.length - 1; i++) {
                if (x >= points[i].x && x <= points[i + 1].x) {
                    const t = (x - points[i].x) / (points[i + 1].x - points[i].x);
                    return points[i].y + t * (points[i + 1].y - points[i].y);
                }
            }
            return x;
        };

        for (let i = 0; i < 256; i++) {
            const x = i / 255;
            lut[i * 4 + 0] = Math.max(0, Math.min(255, getVal(params.pointsR, x) * 255));
            lut[i * 4 + 1] = Math.max(0, Math.min(255, getVal(params.pointsG, x) * 255));
            lut[i * 4 + 2] = Math.max(0, Math.min(255, getVal(params.pointsB, x) * 255));
            lut[i * 4 + 3] = 255;
        }

        gl.bindTexture(gl.TEXTURE_2D, this.lutTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, lut);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    }
}