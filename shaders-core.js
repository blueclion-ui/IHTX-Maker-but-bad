export const vertexShaderSource = `
    attribute vec2 position;
    attribute vec2 texCoord;
    varying vec2 vTexCoord;
    void main() {
        vTexCoord = texCoord;
        gl_Position = vec4(position, 0.0, 1.0);
    }
`;

export const baseFragmentShader = `
    precision highp float;
    varying vec2 vTexCoord;
    uniform sampler2D uSampler;
    void main() {
        gl_FragColor = texture2D(uSampler, vTexCoord);
    }
`;