export function createControl(label, key, min, max, step, value) {
    return `
        <div class="control-group">
            <div class="control-header">
                <label>${label}</label>
                <input type="number" data-key="${key}" min="${min}" max="${max}" step="${step}" value="${value}">
            </div>
            <input type="range" data-key="${key}" min="${min}" max="${max}" step="${step}" value="${value}">
        </div>
    `;
}

export function renderControls(effect) {
    if (effect.type === 'swirl') {
        return `
            ${createControl('Position X', 'centerX', 0, 1, 0.01, effect.params.centerX)}
            ${createControl('Position Y', 'centerY', 0, 1, 0.01, effect.params.centerY)}
            ${createControl('Radius', 'radius', 0.01, 1.5, 0.01, effect.params.radius)}
            ${createControl('Angle (Deg)', 'angle', -1440, 1440, 1, effect.params.angle)}
            ${createControl('Power', 'swirlPower', 0.1, 10, 0.1, effect.params.swirlPower)}
            <div class="control-group">
                <label><input type="checkbox" data-key="fillAspectRatio" ${effect.params.fillAspectRatio ? 'checked' : ''}> Fill Aspect Ratio</label>
            </div>
        `;
    } else if (effect.type === 'hue' || effect.type === 'hueLum') {
        const presets = [30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];
        const presetButtons = presets.map(p => `<button class="preset-btn" data-value="${p}">${p}</button>`).join('');
        return `
            ${createControl('Hue Shift', 'hueShift', 0, 360, 1, effect.params.hueShift)}
            <div class="presets-container">
                <label>Presets</label>
                <div class="preset-grid">
                    ${presetButtons}
                </div>
            </div>
        `;
    } else if (effect.type === 'waviness') {
        return `
            <div style="border-bottom: 1px solid #444; padding-bottom: 5px; margin-bottom: 5px; font-size: 0.7rem; color: #888;">HORIZONTAL WAVES</div>
            ${createControl('Freq H', 'freqH', 0, 100, 0.1, effect.params.freqH)}
            ${createControl('Amp H', 'ampH', 0, 0.5, 0.001, effect.params.ampH)}
            ${createControl('Phase H', 'phaseH', 0, 6.28, 0.01, effect.params.phaseH)}
            <div style="border-bottom: 1px solid #444; padding-bottom: 5px; margin-bottom: 5px; margin-top: 10px; font-size: 0.7rem; color: #888;">VERTICAL WAVES</div>
            ${createControl('Freq V', 'freqV', 0, 100, 0.1, effect.params.freqV)}
            ${createControl('Amp V', 'ampV', 0, 0.5, 0.001, effect.params.ampV)}
            ${createControl('Phase V', 'phaseV', 0, 6.28, 0.01, effect.params.phaseV)}
        `;
    } else if (effect.type === 'flip') {
        return `
            <div class="control-group">
                <label><input type="checkbox" data-key="flipH" ${effect.params.flipH ? 'checked' : ''}> Flip Horizontal</label>
            </div>
            <div class="control-group">
                <label><input type="checkbox" data-key="flipV" ${effect.params.flipV ? 'checked' : ''}> Flip Vertical</label>
            </div>
        `;
    } else if (effect.type === 'mirror') {
        return `
            <div class="control-group">
                <label>Mirror Orientation</label>
                <div>
                    <label>
                        <input type="radio" name="mirror-orientation-${effect.id}" data-key="orientation" value="horizontal" ${effect.params.orientation === 'horizontal' ? 'checked' : ''}>
                        Horizontal (stretch width)
                    </label>
                </div>
                <div>
                    <label>
                        <input type="radio" name="mirror-orientation-${effect.id}" data-key="orientation" value="vertical" ${effect.params.orientation === 'vertical' ? 'checked' : ''}>
                        Vertical (stretch height)
                    </label>
                </div>
            </div>
            ${createControl('Offset', 'offset', -1, 1, 0.01, effect.params.offset)}
            <div class="control-group">
                <label><input type="checkbox" data-key="flipBefore" ${effect.params.flipBefore ? 'checked' : ''}> Flip image after mirror</label>
            </div>
            <div class="control-group">
                <label><input type="checkbox" data-key="flipAfter" ${effect.params.flipAfter ? 'checked' : ''}> Flip image before mirror</label>
            </div>
        `;
    } else if (effect.type === 'standardMirror') {
        return `
            ${createControl('Angle', 'angle', 0, 360, 1, effect.params.angle)}
            ${createControl('Position', 'position', -1, 1, 0.01, effect.params.position)}
        `;
    } else if (effect.type === 'sphere') {
        return `
            ${createControl('Position X', 'centerX', 0, 1, 0.01, effect.params.centerX)}
            ${createControl('Position Y', 'centerY', 0, 1, 0.01, effect.params.centerY)}
            ${createControl('Size', 'radius', 0.01, 1.0, 0.01, effect.params.radius)}
            ${createControl('Intensity', 'intensity', -1, 2, 0.01, effect.params.intensity)}
            <div class="control-group">
                <label><input type="checkbox" data-key="fillAspectRatio" ${effect.params.fillAspectRatio ? 'checked' : ''}> Fill Aspect Ratio</label>
            </div>
        `;
    } else if (effect.type === 'zoomPan') {
        return `
            ${createControl('Zoom', 'zoom', 0, 10, 0.01, effect.params.zoom)}
            ${createControl('Pan X', 'offsetX', -1, 1, 0.01, effect.params.offsetX)}
            ${createControl('Pan Y', 'offsetY', -1, 1, 0.01, effect.params.offsetY)}
        `;
    } else if (effect.type === 'rotate') {
        return `
            ${createControl('Angle', 'angle', -360, 360, 1, effect.params.angle)}
            <div class="control-group">
                <label><input type="checkbox" data-key="fixAspect" ${effect.params.fixAspect ? 'checked' : ''}> Fix Aspect Ratio</label>
            </div>
        `;
    } else if (effect.type === 'invert') {
        return `
            <div class="control-group">
                <label><input type="checkbox" data-key="invertR" ${effect.params.invertR ? 'checked' : ''}> Invert Red</label>
            </div>
            <div class="control-group">
                <label><input type="checkbox" data-key="invertG" ${effect.params.invertG ? 'checked' : ''}> Invert Green</label>
            </div>
            <div class="control-group">
                <label><input type="checkbox" data-key="invertB" ${effect.params.invertB ? 'checked' : ''}> Invert Blue</label>
            </div>
        `;
    } else if (effect.type === 'bgr' || effect.type === 'darkness' || effect.type === 'bit3' || effect.type === 'bit6') {
        return `<div class="control-group"><p style="font-size:0.75rem; color:#888;">No customization available for this effect.</p></div>`;
    } else if (effect.type === 'ripple') {
        return `
            ${createControl('Position X', 'centerX', 0, 1, 0.01, effect.params.centerX)}
            ${createControl('Position Y', 'centerY', 0, 1, 0.01, effect.params.centerY)}
            ${createControl('Frequency', 'freq', 0, 100, 0.1, effect.params.freq)}
            ${createControl('Amplitude', 'amp', 0, 0.5, 0.001, effect.params.amp)}
            ${createControl('Phase', 'phase', 0, 6.28, 0.01, effect.params.phase)}
        `;
    } else if (effect.type === 'gradientMap') {
        let colorControls = '';
        for (let i = 1; i <= 5; i++) {
            const hidden = i > effect.params.colorCount ? 'display:none;' : '';
            colorControls += `
                <div class="control-group" style="${hidden} flex-direction: row; align-items: center; justify-content: space-between;">
                    <label>Color ${i}</label>
                    <input type="color" data-key="c${i}" value="${effect.params['c' + i]}">
                </div>
            `;
        }
        return `
            ${createControl('Color Count', 'colorCount', 2, 5, 1, effect.params.colorCount)}
            <div class="control-group">
                <label>Gray Calculation Mode</label>
                <select data-key="grayMode" style="background:#444; color:white; border:1px solid #555; border-radius:3px; padding:2px; font-size:0.75rem;">
                    <option value="0" ${effect.params.grayMode === 0 ? 'selected' : ''}>Average (R+G+B)/3</option>
                    <option value="1" ${effect.params.grayMode === 1 ? 'selected' : ''}>Standard Luma (0.299, 0.587, 0.114)</option>
                    <option value="2" ${effect.params.grayMode === 2 ? 'selected' : ''}>Custom Weights (Sum to 1)</option>
                </select>
            </div>
            <div style="${effect.params.grayMode !== 2 ? 'display:none' : ''}">
                ${createControl('Weight Red', 'wR', 0, 1, 0.001, effect.params.wR.toFixed(3))}
                ${createControl('Weight Green', 'wG', 0, 1, 0.001, effect.params.wG.toFixed(3))}
                ${createControl('Weight Blue', 'wB', 0, 1, 0.001, effect.params.wB.toFixed(3))}
            </div>
            ${colorControls}
        `;
    } else if (effect.type === 'saturation') {
        return `
            ${createControl('Saturation', 'saturation', 0, 4, 0.01, effect.params.saturation)}
        `;
    } else if (effect.type === 'mosaic') {
        return `
            ${createControl('Pixel Width', 'pixelWidth', 0.001, 0.2, 0.001, effect.params.pixelWidth)}
            ${createControl('Pixel Height', 'pixelHeight', 0.001, 0.2, 0.001, effect.params.pixelHeight)}
        `;
    } else if (effect.type === 'advInvert') {
        return `
            <div class="control-group" style="flex-direction: row; align-items: center; justify-content: space-between;">
                <label>Target Color</label>
                <input type="color" data-key="targetColor" value="${effect.params.targetColor}">
            </div>
            <div class="control-group">
                <label><input type="checkbox" data-key="square" ${effect.params.square ? 'checked' : ''}> Square Output Values</label>
            </div>
        `;
    } else if (effect.type === 'hslMap') {
        return `
            <div class="control-group">
                <label>Mapping Mode</label>
                <div>
                    <label>
                        <input type="radio" name="hsl-mode-${effect.id}" data-key="mode" value="0" ${effect.params.mode === 0 ? 'checked' : ''}>
                        Black (0) & White (1) → Black (0)
                    </label>
                </div>
                <div>
                    <label>
                        <input type="radio" name="hsl-mode-${effect.id}" data-key="mode" value="1" ${effect.params.mode === 1 ? 'checked' : ''}>
                        Black (0) & White (1) → White (1)
                    </label>
                </div>
            </div>
        `;
    } else if (effect.type === 'rgbCurve') {
        const channels = ['R', 'G', 'B'];
        const channelSelect = channels.map(c => `
            <label style="flex: 1; text-align: center; background: ${effect.params.activeChannel === c ? '#444' : 'transparent'}; cursor: pointer; padding: 4px; border-radius: 4px;">
                <input type="radio" name="curve-chan-${effect.id}" data-key="activeChannel" value="${c}" ${effect.params.activeChannel === c ? 'checked' : ''} style="display:none">
                ${c}
            </label>
        `).join('');

        return `
            <div class="control-group" style="flex-direction: row; gap: 5px; margin-bottom: 5px;">
                ${channelSelect}
            </div>
            <div class="curve-editor-container" style="position: relative; width: 100%; aspect-ratio: 1; background: #111; border: 1px solid #444; cursor: crosshair; touch-action: none;">
                <canvas class="curve-canvas" style="width: 100%; height: 100%; pointer-events: none;"></canvas>
                <div style="position: absolute; bottom: 5px; right: 5px; font-size: 0.6rem; color: #666; pointer-events: none;">Click to add. Drag to move.</div>
            </div>
            <div style="display: flex; gap: 5px; margin-top: 5px;">
                <button class="undo-curve-btn" style="flex: 1; background: #444; border: none; color: #ccc; font-size: 0.7rem; padding: 4px; border-radius: 3px; cursor: pointer;">Undo</button>
                <button class="reset-curve-btn" style="flex: 1; background: #444; border: none; color: #ccc; font-size: 0.7rem; padding: 4px; border-radius: 3px; cursor: pointer;">Reset</button>
            </div>
        `;
    } else if (effect.type === 'animatedWave') {
        return `
            ${createControl('Frequency', 'freq', 0.1, 64, 0.1, effect.params.freq)}
            ${createControl('Amplitude', 'amp', 0.0, 0.5, 0.001, effect.params.amp)}
            ${createControl('Speed', 'speed', 0.0, 8.0, 0.01, effect.params.speed)}
            ${createControl('Phase', 'phase', 0.0, 6.283, 0.001, effect.params.phase)}
            <div class="control-group" style="display:flex; gap:6px;">
                ${createControl('Dir X', 'directionX', -1, 1, 0.01, effect.params.directionX)}
                ${createControl('Dir Y', 'directionY', -1, 1, 0.01, effect.params.directionY)}
            </div>
            <div style="font-size:0.72rem; color:#888;">Direction vector will be normalized in the shader.</div>
        `;
    } else if (effect.type === 'shake') {
        return `
            ${createControl('Amount X (px)', 'amountX', 0, 200, 1, effect.params.amountX)}
            ${createControl('Amount Y (px)', 'amountY', 0, 200, 1, effect.params.amountY)}
            ${createControl('Frequency (hz)', 'frequency', 0, 60, 1, effect.params.frequency)}
            <div class="control-group">
                <label><input type="checkbox" data-key="continuous" ${effect.params.continuous ? 'checked' : ''}> Continuous</label>
            </div>
        `;
    } else if (effect.type === 'chromatic') {
        return `
            ${createControl('Offset (px)', 'offset', 0, 40, 0.5, effect.params.offset)}
        `;
    } else if (effect.type === 'vignette') {
        return `
            ${createControl('Radius', 'radius', 0.0, 1.0, 0.01, effect.params.radius)}
            ${createControl('Softness', 'softness', 0.0, 1.0, 0.01, effect.params.softness)}
            ${createControl('Intensity', 'intensity', 0.0, 2.0, 0.01, effect.params.intensity)}
        `;
    } else if (effect.type === 'glitch') {
        return `
            ${createControl('Amount', 'amount', 0.0, 0.5, 0.001, effect.params.amount)}
            ${createControl('Speed', 'speed', 0.0, 5.0, 0.01, effect.params.speed)}
        `;
    }
    return '';
}