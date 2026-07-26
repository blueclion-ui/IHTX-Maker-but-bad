const hsvHelpers = `
    vec3 rgb2hsv(vec3 c) {
        vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
        vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
        vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
        float d = q.x - min(q.w, q.y);
        float e = 1.0e-10;
        return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
    }
    vec3 hsv2rgb(vec3 c) {
        vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
        vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
        return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
    }
`;

const hslHelpers = `
    vec3 rgb2hsl(vec3 c) {
        float maxC = max(c.r, max(c.g, c.b));
        float minC = min(c.r, min(c.g, c.b));
        float h, s, l = (maxC + minC) / 2.0;
        if (maxC == minC) {
            h = s = 0.0;
        } else {
            float d = maxC - minC;
            s = l > 0.5 ? d / (2.0 - maxC - minC) : d / (maxC + minC);
            if (maxC == c.r) h = (c.g - c.b) / d + (c.g < c.b ? 6.0 : 0.0);
            else if (maxC == c.g) h = (c.b - c.r) / d + 2.0;
            else h = (c.r - c.g) / d + 4.0;
            h /= 6.0;
        }
        return vec3(h, s, l);
    }
    float hue2rgb(float p, float q, float t) {
        if (t < 0.0) t += 1.0;
        if (t > 1.0) t -= 1.0;
        if (t < 1.0/6.0) return p + (q - p) * 6.0 * t;
        if (t < 1.0/2.0) return q;
        if (t < 2.0/3.0) return p + (q - p) * (2.0/3.0 - t) * 6.0;
        return p;
    }
    vec3 hsl2rgb(vec3 c) {
        float h = c.x, s = c.y, l = c.z;
        if (s == 0.0) return vec3(l);
        float q = l < 0.5 ? l * (1.0 + s) : l + s - l * s;
        float p = 2.0 * l - q;
        return vec3(hue2rgb(p, q, h + 1.0/3.0), hue2rgb(p, q, h), hue2rgb(p, q, h - 1.0/3.0));
    }
`;

export const hueFragmentShader = `
    precision highp float;
    varying vec2 vTexCoord;
    uniform sampler2D uSampler;
    uniform float uHueShift;
    ${hsvHelpers}
    void main() {
        vec4 color = texture2D(uSampler, vTexCoord);
        vec3 hsv = rgb2hsv(color.rgb);
        hsv.x = fract(hsv.x + uHueShift / 360.0);
        gl_FragColor = vec4(hsv2rgb(hsv), color.a);
    }
`;

export const hueLumFragmentShader = `
    precision highp float;
    varying vec2 vTexCoord;
    uniform sampler2D uSampler;
    uniform float uHueShift;
    ${hsvHelpers}
    float getLuminance(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
    void main() {
        vec4 color = texture2D(uSampler, vTexCoord);
        float originalLum = getLuminance(color.rgb);
        vec3 hsv = rgb2hsv(color.rgb);
        hsv.x = fract(hsv.x + uHueShift / 360.0);
        vec3 shiftedRgb = hsv2rgb(hsv);
        float newLum = getLuminance(shiftedRgb);
        if (newLum > 0.0) shiftedRgb *= (originalLum / newLum);
        gl_FragColor = vec4(shiftedRgb, color.a);
    }
`;

export const invertFragmentShader = `
    precision highp float;
    varying vec2 vTexCoord;
    uniform sampler2D uSampler;
    uniform bool uInvertR;
    uniform bool uInvertG;
    uniform bool uInvertB;
    void main() {
        vec4 color = texture2D(uSampler, vTexCoord);
        if (uInvertR) color.r = 1.0 - color.r;
        if (uInvertG) color.g = 1.0 - color.g;
        if (uInvertB) color.b = 1.0 - color.b;
        gl_FragColor = color;
    }
`;

export const bgrFragmentShader = `
    precision highp float;
    varying vec2 vTexCoord;
    uniform sampler2D uSampler;
    void main() {
        vec4 color = texture2D(uSampler, vTexCoord);
        gl_FragColor = vec4(color.b, color.g, color.r, color.a);
    }
`;

export const gradientMapFragmentShader = `
    precision highp float;
    varying vec2 vTexCoord;
    uniform sampler2D uSampler;
    uniform vec3 uColors[5];
    uniform int uColorCount;
    uniform int uGrayMode; // 0: Average, 1: Luma, 2: Custom
    uniform vec3 uWeights;
    float getGray(vec3 c) {
        if (uGrayMode == 1) return dot(c, vec3(0.299, 0.587, 0.114));
        if (uGrayMode == 2) return dot(c, uWeights);
        return (c.r + c.g + c.b) / 3.0;
    }
    void main() {
        vec4 color = texture2D(uSampler, vTexCoord);
        float gray = clamp(getGray(color.rgb), 0.0, 1.0);
        vec3 finalColor = uColors[0];
        if (uColorCount == 2) {
            finalColor = mix(uColors[0], uColors[1], gray);
        } else if (uColorCount == 3) {
            if (gray < 0.5) finalColor = mix(uColors[0], uColors[1], gray * 2.0);
            else finalColor = mix(uColors[1], uColors[2], (gray - 0.5) * 2.0);
        } else if (uColorCount == 4) {
            if (gray < 0.3333) finalColor = mix(uColors[0], uColors[1], gray * 3.0);
            else if (gray < 0.6666) finalColor = mix(uColors[1], uColors[2], (gray - 0.3333) * 3.0);
            else finalColor = mix(uColors[2], uColors[3], (gray - 0.6666) * 3.0);
        } else {
            if (gray < 0.25) finalColor = mix(uColors[0], uColors[1], gray * 4.0);
            else if (gray < 0.5) finalColor = mix(uColors[1], uColors[2], (gray - 0.25) * 4.0);
            else if (gray < 0.75) finalColor = mix(uColors[2], uColors[3], (gray - 0.5) * 4.0);
            else finalColor = mix(uColors[3], uColors[4], (gray - 0.75) * 4.0);
        }
        gl_FragColor = vec4(finalColor, color.a);
    }
`;

export const darknessFragmentShader = `
    precision highp float;
    varying vec2 vTexCoord;
    uniform sampler2D uSampler;
    void main() {
        vec4 color = texture2D(uSampler, vTexCoord);
        vec3 rgb = max(vec3(0.0), (color.rgb - 0.5) * 2.0);
        gl_FragColor = vec4(rgb, color.a);
    }
`;

export const bit3FragmentShader = `
    precision highp float;
    varying vec2 vTexCoord;
    uniform sampler2D uSampler;
    void main() {
        vec4 color = texture2D(uSampler, vTexCoord);
        vec3 rgb = step(0.5, color.rgb);
        gl_FragColor = vec4(rgb, color.a);
    }
`;

export const bit6FragmentShader = `
    precision highp float;
    varying vec2 vTexCoord;
    uniform sampler2D uSampler;
    void main() {
        vec4 color = texture2D(uSampler, vTexCoord);
        vec3 rgb = floor(color.rgb * 3.999) / 3.0;
        gl_FragColor = vec4(rgb, color.a);
    }
`;

export const saturationFragmentShader = `
    precision highp float;
    varying vec2 vTexCoord;
    uniform sampler2D uSampler;
    uniform float uSaturation;
    void main() {
        vec4 color = texture2D(uSampler, vTexCoord);
        float luma = dot(color.rgb, vec3(0.299, 0.587, 0.114));
        vec3 gray = vec3(luma);
        gl_FragColor = vec4(mix(gray, color.rgb, uSaturation), color.a);
    }
`;

export const advInvertFragmentShader = `
    precision highp float;
    varying vec2 vTexCoord;
    uniform sampler2D uSampler;
    uniform vec3 uTargetColor;
    uniform bool uSquare;
    void main() {
        vec4 color = texture2D(uSampler, vTexCoord);
        vec3 diff = abs(color.rgb - uTargetColor);
        if (uSquare) { diff = diff * diff; }
        gl_FragColor = vec4(diff, color.a);
    }
`;

export const hslMapFragmentShader = `
    precision highp float;
    varying vec2 vTexCoord;
    uniform sampler2D uSampler;
    uniform int uMode;
    ${hslHelpers}
    void main() {
        vec4 color = texture2D(uSampler, vTexCoord);
        vec3 hsl = rgb2hsl(color.rgb);
        float l = hsl.z;
        if (uMode == 0) { l = 0.5 - abs(l - 0.5); }
        else { l = abs(l - 0.5) + 0.5; }
        hsl.z = clamp(l, 0.0, 1.0);
        gl_FragColor = vec4(hsl2rgb(hsl), color.a);
    }
`;

export const rgbCurveFragmentShader = `
    precision highp float;
    varying vec2 vTexCoord;
    uniform sampler2D uSampler;
    uniform sampler2D uCurveLUT;
    void main() {
        vec4 color = texture2D(uSampler, vTexCoord);
        // Look up each channel in the 256x1 LUT texture
        // R is in the R channel, G in G, B in B
        float r = texture2D(uCurveLUT, vec2(color.r, 0.5)).r;
        float g = texture2D(uCurveLUT, vec2(color.g, 0.5)).g;
        float b = texture2D(uCurveLUT, vec2(color.b, 0.5)).b;
        gl_FragColor = vec4(r, g, b, color.a);
    }
`;