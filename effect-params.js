export const DEFAULT_PARAMS = {
    swirl: {
        centerX: 0.5,
        centerY: 0.5,
        radius: 0.5,
        angle: 360,
        swirlPower: 2.0,
        fillAspectRatio: false
    },
    hue: {
        hueShift: 0
    },
    hueLum: {
        hueShift: 0
    },
    waviness: {
        freqH: 10.0,
        ampH: 0.05,
        phaseH: 4.75,
        freqV: 10.0,
        ampV: 0.05,
        phaseV: 4.0
    },
    flip: {
        flipH: false,
        flipV: false
    },
    mirror: {
        orientation: 'horizontal',
        offset: 0,
        flipBefore: false,
        flipAfter: false
    },
    standardMirror: {
        angle: 0,
        position: 0
    },
    sphere: {
        centerX: 0.5,
        centerY: 0.5,
        radius: 0.25,
        intensity: 0.5,
        fillAspectRatio: false
    },
    zoomPan: {
        zoom: 1.0,
        offsetX: 0,
        offsetY: 0
    },
    rotate: {
        angle: 0,
        fixAspect: true
    },
    invert: {
        invertR: true,
        invertG: true,
        invertB: true
    },
    bgr: {},
    ripple: {
        centerX: 0.5,
        centerY: 0.5,
        freq: 20.0,
        amp: 0.05,
        phase: 0.0
    },
    gradientMap: {
        colorCount: 2,
        c1: '#000000',
        c2: '#ffffff',
        c3: '#ff0000',
        c4: '#00ff00',
        c5: '#0000ff',
        grayMode: 1, // 0: Average, 1: Luma, 2: Custom
        wR: 0.299,
        wG: 0.587,
        wB: 0.114
    },
    darkness: {},
    bit3: {},
    bit6: {},
    saturation: {
        saturation: 1.0
    },
    mosaic: {
        pixelWidth: 0.02,
        pixelHeight: 0.02
    },
    advInvert: {
        targetColor: '#ffffff',
        square: false
    },
    hslMap: {
        mode: 0 // 0: 0-0.5-0, 1: 1-0.5-1
    },
    rgbCurve: {
        pointsR: [{x: 0, y: 0}, {x: 1, y: 1}],
        pointsG: [{x: 0, y: 0}, {x: 1, y: 1}],
        pointsB: [{x: 0, y: 0}, {x: 1, y: 1}],
        activeChannel: 'R',
        historyR: [],
        historyG: [],
        historyB: []
    },
    animatedWave: {
        freq: 8.0,
        amp: 0.03,
        speed: 1.0,
        phase: 0.0,
        directionX: 1.0,
        directionY: 0.0
    },
    // new effects
    shake: {
        amountX: 10,   // max jitter in pixels or normalized units (we'll interpret as pixels)
        amountY: 10,
        frequency: 30, // times per second to randomize (0 = every frame)
        continuous: true
    },
    chromatic: {
        offset: 4.0
    },
    vignette: {
        radius: 0.5,
        softness: 0.5,
        intensity: 0.6
    },
    glitch: {
        amount: 0.08,
        speed: 0.5
    }
};