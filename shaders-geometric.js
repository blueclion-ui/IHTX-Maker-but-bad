export const swirlFragmentShader = `
    precision highp float;
    varying vec2 vTexCoord;
    uniform sampler2D uSampler;
    uniform vec2 uCenter;
    uniform float uRadius;
    uniform float uAngle;
    uniform float uSwirlPower;
    uniform bool uFillAspectRatio;
    uniform float uAspectRatio;

    void main() {
        vec2 uv = vTexCoord;
        vec2 offset = uv - uCenter;
        if (!uFillAspectRatio) { offset.x *= uAspectRatio; }
        float dist = length(offset);
        if (dist < uRadius) {
            float percent = (uRadius - dist) / uRadius;
            float theta = pow(percent, uSwirlPower) * radians(uAngle);
            float s = sin(theta);
            float c = cos(theta);
            vec2 rotatedOffset = vec2(
                offset.x * c - offset.y * s,
                offset.x * s + offset.y * c
            );
            if (!uFillAspectRatio) { rotatedOffset.x /= uAspectRatio; }
            uv = uCenter + rotatedOffset;
        }
        gl_FragColor = texture2D(uSampler, uv);
    }
`;

export const flipFragmentShader = `
    precision highp float;
    varying vec2 vTexCoord;
    uniform sampler2D uSampler;
    uniform bool uFlipH;
    uniform bool uFlipV;

    void main() {
        vec2 uv = vTexCoord;
        if (uFlipH) uv.x = 1.0 - uv.x;
        if (uFlipV) uv.y = 1.0 - uv.y;
        gl_FragColor = texture2D(uSampler, uv);
    }
`;

export const mirrorFragmentShader = `
    precision highp float;
    varying vec2 vTexCoord;
    uniform sampler2D uSampler;
    uniform float uAngle;
    uniform float uOffset;
    uniform bool uFlipBefore;
    uniform bool uFlipAfter;

    void main() {
        vec2 uv = vTexCoord;
        bool horizontal = (abs(uAngle - 0.0) < 0.5);
        if (uFlipBefore) {
            if (horizontal) uv.x = 1.0 - uv.x;
            else uv.y = 1.0 - uv.y;
        }
        float line = clamp(0.5 + 0.5 * uOffset, 0.001, 0.999);
        if (horizontal) {
            if (uv.x >= line) {
                float t = (uv.x - line) / (1.0 - line);
                uv.x = line - t * line;
            }
        } else {
            if (uv.y >= line) {
                float t = (uv.y - line) / (1.0 - line);
                uv.y = line - t * line;
            }
        }
        if (uFlipAfter) {
            if (horizontal) uv.x = 1.0 - uv.x;
            else uv.y = 1.0 - uv.y;
        }
        gl_FragColor = texture2D(uSampler, uv);
    }
`;

export const standardMirrorFragmentShader = `
    precision highp float;
    varying vec2 vTexCoord;
    uniform sampler2D uSampler;
    uniform float uAngle;
    uniform float uPosition;
    uniform float uAspectRatio;

    void main() {
        vec2 uv = vTexCoord;
        vec2 p = uv - 0.5;
        p.x *= uAspectRatio;
        float theta = radians(uAngle);
        vec2 n = vec2(cos(theta), sin(theta));
        float t = clamp(uPosition, -1.0, 1.0);
        vec2 p0 = n * (t * 0.5 * uAspectRatio);
        float d = dot(p - p0, n);
        if (d < 0.0) { p = p - 2.0 * d * n; }
        p.x /= uAspectRatio;
        uv = p + 0.5;
        gl_FragColor = texture2D(uSampler, uv);
    }
`;

export const sphereFragmentShader = `
    precision highp float;
    varying vec2 vTexCoord;
    uniform sampler2D uSampler;
    uniform vec2 uCenter;
    uniform float uRadius;
    uniform float uIntensity;
    uniform bool uFillAspectRatio;
    uniform float uAspectRatio;

    void main() {
        vec2 uv = vTexCoord;
        vec2 offset = uv - uCenter;
        if (!uFillAspectRatio) { offset.x *= uAspectRatio; }
        float dist = length(offset);
        if (dist < uRadius) {
            float percent = dist / uRadius;
            float scale;
            if (uIntensity >= 0.0) {
                scale = 1.0 + uIntensity * (1.0 - percent);
            } else {
                scale = 1.0 / (1.0 - uIntensity * (1.0 - percent));
            }
            uv = uCenter + (vTexCoord - uCenter) / scale;
        }
        gl_FragColor = texture2D(uSampler, uv);
    }
`;

export const zoomPanFragmentShader = `
    precision highp float;
    varying vec2 vTexCoord;
    uniform sampler2D uSampler;
    uniform float uZoom;
    uniform vec2 uOffset;

    void main() {
        vec2 uv = vTexCoord;
        uv -= 0.5;
        uv /= max(uZoom, 0.00001);
        uv += 0.5;
        uv -= uOffset;
        if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
            gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
        } else {
            gl_FragColor = texture2D(uSampler, uv);
        }
    }
`;

export const rotateFragmentShader = `
    precision highp float;
    varying vec2 vTexCoord;
    uniform sampler2D uSampler;
    uniform float uAngle;
    uniform float uAspectRatio;
    uniform bool uFixAspect;

    void main() {
        vec2 uv = vTexCoord;
        vec2 p = uv - 0.5;
        if (uFixAspect) { p.x *= uAspectRatio; }
        float theta = radians(uAngle);
        float s = sin(theta);
        float c = cos(theta);
        vec2 rotatedP = vec2(p.x * c - p.y * s, p.x * s + p.y * c);
        if (uFixAspect) { rotatedP.x /= uAspectRatio; }
        uv = rotatedP + 0.5;
        if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
            gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
        } else {
            gl_FragColor = texture2D(uSampler, uv);
        }
    }
`;

export const wavinessFragmentShader = `
    precision highp float;
    varying vec2 vTexCoord;
    uniform sampler2D uSampler;
    uniform float uFreqH;
    uniform float uAmpH;
    uniform float uPhaseH;
    uniform float uFreqV;
    uniform float uAmpV;
    uniform float uPhaseV;

    void main() {
        vec2 uv = vTexCoord;
        uv.x += sin(vTexCoord.y * uFreqH + uPhaseH) * uAmpH;
        uv.y += sin(vTexCoord.x * uFreqV + uPhaseV) * uAmpV;
        gl_FragColor = texture2D(uSampler, uv);
    }
`;

export const rippleFragmentShader = `
    precision highp float;
    varying vec2 vTexCoord;
    uniform sampler2D uSampler;
    uniform vec2 uCenter;
    uniform float uFreq;
    uniform float uAmp;
    uniform float uPhase;
    uniform float uAspectRatio;

    void main() {
        vec2 uv = vTexCoord;
        vec2 dir = uv - uCenter;
        dir.x *= uAspectRatio;
        float dist = length(dir);
        if (dist > 0.0) {
            float move = sin(dist * uFreq - uPhase) * uAmp;
            uv += (dir / dist) * move;
        }
        gl_FragColor = texture2D(uSampler, uv);
    }
`;

export const mosaicFragmentShader = `
    precision highp float;
    varying vec2 vTexCoord;
    uniform sampler2D uSampler;
    uniform float uPixelWidth;
    uniform float uPixelHeight;

    void main() {
        vec2 uv = vTexCoord;
        if (uPixelWidth > 0.0 && uPixelHeight > 0.0) {
            vec2 size = vec2(uPixelWidth, uPixelHeight);
            // Snap to grid and sample from center of the virtual pixel
            vec2 p = (floor(uv / size) * size) + (size * 0.5);
            gl_FragColor = texture2D(uSampler, p);
        } else {
            gl_FragColor = texture2D(uSampler, uv);
        }
    }
`;

 // Shake effect: simple pixel jitter using normalized offsets
 export const shakeFragmentShader = `
    precision highp float;
    varying vec2 vTexCoord;
    uniform sampler2D uSampler;
    uniform float uShakeX; // normalized UV offset X
    uniform float uShakeY; // normalized UV offset Y

    void main() {
        vec2 uv = vTexCoord;
        // apply jitter; the renderer supplies normalized offsets (can be dynamic)
        uv += vec2(uShakeX, uShakeY);
        // clamp to avoid sampling outside
        uv = clamp(uv, 0.0, 1.0);
        gl_FragColor = texture2D(uSampler, uv);
    }
 `;

 // Animated wave effect: directional moving wave that displaces UVs and can be tuned per-axis
 export const animatedWaveFragmentShader = `
     precision highp float;
     varying vec2 vTexCoord;
     uniform sampler2D uSampler;
     uniform float uTime;        // seconds
     uniform float uFreq;        // frequency of the wave
     uniform float uAmp;         // amplitude (max displacement)
     uniform float uSpeed;       // speed multiplier
     uniform vec2 uDirection;    // normalized direction of wave
     uniform float uPhase;       // global phase offset
     uniform float uAspectRatio; // canvas aspect

     // 2D simple smooth noise-ish function based on sin/cos combos for organic look
     float waveAt(vec2 p) {
         // Project point onto direction
         float proj = dot(p, uDirection);
         float val = sin((proj * uFreq) + (uTime * uSpeed) + uPhase);
         // Add a subtle perpendicular variation for richness
         float perp = cos((dot(p, vec2(uDirection.y, -uDirection.x)) * uFreq * 0.5) + uTime * (uSpeed * 0.7));
         return (val * 0.6 + perp * 0.4);
     }

     void main() {
         vec2 uv = vTexCoord;
         // center coordinates for tiling stability
         vec2 centered = uv - 0.5;
         centered.x *= uAspectRatio;

         float w = waveAt(centered);

         // Displace along direction scaled by amplitude
         vec2 disp = uDirection * (w * uAmp);
         // compensate aspect ratio on X when writing back
         disp.x /= uAspectRatio;
         vec2 sampleUV = uv + disp;

         // Soft edge wrapping to avoid hard black at borders
         sampleUV = clamp(sampleUV, 0.0, 1.0);

         gl_FragColor = texture2D(uSampler, sampleUV);
     }
 `;