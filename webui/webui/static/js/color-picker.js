/**
 * Color Picker Component
 * Interactive color picker with HEX/RGB input and visual selection
 */

(function() {
    'use strict';

    class ColorPicker {
        constructor(options = {}) {
            this.container = options.container || document.body;
            this.value = options.value || '#3b82f6';
            this.onChange = options.onChange || (() => {});
            this.showHistory = options.showHistory !== false;
            this.id = options.id || 'color-picker-' + Date.now();
            this.isOpen = false;
            this.history = ColorSchemeManager.colorHistory || [];
            
            this.init();
        }

        init() {
            this.createElements();
            this.bindEvents();
            this.updateDisplay();
        }

        createElements() {
            const wrapper = document.createElement('div');
            wrapper.className = 'color-picker-wrapper';
            wrapper.id = this.id;
            
            wrapper.innerHTML = `
                <div class="color-picker-input-group">
                    <div class="color-preview-swatch" style="background-color: ${this.value}"></div>
                    <input type="text" class="color-input hex-input" value="${this.value}" placeholder="#000000">
                    <input type="number" class="color-input rgb-input r-input" min="0" max="255" placeholder="R">
                    <input type="number" class="color-input rgb-input g-input" min="0" max="255" placeholder="G">
                    <input type="number" class="color-input rgb-input b-input" min="0" max="255" placeholder="B">
                    <button type="button" class="color-picker-toggle" aria-label="打开颜色选择器">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"></path>
                        </svg>
                    </button>
                </div>
                <div class="color-picker-dropdown hidden">
                    <div class="color-picker-panel">
                        <div class="saturation-brightness-picker">
                            <div class="sb-picker-area">
                                <div class="sb-picker-white"></div>
                                <div class="sb-picker-black"></div>
                                <div class="sb-picker-handle"></div>
                            </div>
                            <div class="hue-slider">
                                <div class="hue-gradient"></div>
                                <input type="range" min="0" max="360" value="0" class="hue-input">
                            </div>
                        </div>
                        ${this.showHistory ? `
                        <div class="color-history-section">
                            <span class="history-label">最近使用</span>
                            <div class="color-history-grid"></div>
                        </div>
                        ` : ''}
                        <div class="contrast-checker-section">
                            <span class="contrast-label">对比度检测</span>
                            <div class="contrast-preview">
                                <div class="contrast-sample-text">示例文字</div>
                            </div>
                            <div class="contrast-info">
                                <span class="contrast-ratio">--</span>
                                <span class="contrast-badge">--</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            this.container.appendChild(wrapper);
            
            this.wrapper = wrapper;
            this.previewSwatch = wrapper.querySelector('.color-preview-swatch');
            this.hexInput = wrapper.querySelector('.hex-input');
            this.rInput = wrapper.querySelector('.r-input');
            this.gInput = wrapper.querySelector('.g-input');
            this.bInput = wrapper.querySelector('.b-input');
            this.toggleBtn = wrapper.querySelector('.color-picker-toggle');
            this.dropdown = wrapper.querySelector('.color-picker-dropdown');
            this.sbPickerArea = wrapper.querySelector('.sb-picker-area');
            this.sbHandle = wrapper.querySelector('.sb-picker-handle');
            this.hueInput = wrapper.querySelector('.hue-input');
            this.contrastPreview = wrapper.querySelector('.contrast-sample-text');
            this.contrastRatio = wrapper.querySelector('.contrast-ratio');
            this.contrastBadge = wrapper.querySelector('.contrast-badge');
            this.historyGrid = wrapper.querySelector('.color-history-grid');
            
            if (this.showHistory) {
                this.renderHistory();
            }
        }

        bindEvents() {
            this.hexInput.addEventListener('input', (e) => {
                const value = e.target.value;
                if (this.isValidHex(value)) {
                    this.setValue(value);
                }
            });

            this.hexInput.addEventListener('blur', (e) => {
                if (!this.isValidHex(e.target.value)) {
                    this.updateDisplay();
                }
            });

            [this.rInput, this.gInput, this.bInput].forEach(input => {
                input.addEventListener('input', () => {
                    const r = parseInt(this.rInput.value) || 0;
                    const g = parseInt(this.gInput.value) || 0;
                    const b = parseInt(this.bInput.value) || 0;
                    const hex = this.rgbToHex(
                        Math.max(0, Math.min(255, r)),
                        Math.max(0, Math.min(255, g)),
                        Math.max(0, Math.min(255, b))
                    );
                    this.setValue(hex);
                });
            });

            this.toggleBtn.addEventListener('click', () => {
                this.toggle();
            });

            this.sbPickerArea.addEventListener('mousedown', (e) => {
                this.startSBDrag(e);
            });

            this.hueInput.addEventListener('input', (e) => {
                this.updateSBFromHue(parseInt(e.target.value));
            });

            document.addEventListener('click', (e) => {
                if (!this.wrapper.contains(e.target)) {
                    this.close();
                }
            });
        }

        toggle() {
            this.isOpen ? this.close() : this.open();
        }

        open() {
            this.isOpen = true;
            this.dropdown.classList.remove('hidden');
            this.dropdown.classList.add('show');
            this.updateSBPosition();
            this.renderHistory();
        }

        close() {
            this.isOpen = false;
            this.dropdown.classList.add('hidden');
            this.dropdown.classList.remove('show');
        }

        setValue(color) {
            this.value = this.normalizeColor(color);
            this.updateDisplay();
            this.updateSBPosition();
            this.onChange(this.value);
            this.addToHistory(this.value);
        }

        getValue() {
            return this.value;
        }

        updateDisplay() {
            const rgb = this.hexToRgb(this.value);
            
            this.previewSwatch.style.backgroundColor = this.value;
            this.hexInput.value = this.value;
            
            if (rgb) {
                this.rInput.value = rgb.r;
                this.gInput.value = rgb.g;
                this.bInput.value = rgb.b;
            }
            
            this.updateContrast();
        }

        updateSBPosition() {
            const rgb = this.hexToRgb(this.value);
            if (!rgb) return;
            
            const hsl = this.rgbToHsl(rgb.r, rgb.g, rgb.b);
            
            this.hueInput.value = hsl.h;
            
            const s = hsl.s;
            const b = hsl.l;
            
            this.sbHandle.style.left = `${s}%`;
            this.sbHandle.style.top = `${100 - b}%`;
        }

        updateSBFromHue(hue) {
            const rgb = this.hexToRgb(this.value);
            if (!rgb) return;
            
            const currentHsl = this.rgbToHsl(rgb.r, rgb.g, rgb.b);
            const newHsl = { h: hue, s: currentHsl.s, l: currentHsl.l };
            const newRgb = this.hslToRgb(newHsl.h, newHsl.s, newHsl.l);
            const newHex = this.rgbToHex(newRgb.r, newRgb.g, newRgb.b);
            
            this.setValue(newHex);
        }

        startSBDrag(e) {
            e.preventDefault();
            
            const moveHandler = (e) => {
                const rect = this.sbPickerArea.getBoundingClientRect();
                let x = (e.clientX - rect.left) / rect.width * 100;
                let y = (e.clientY - rect.top) / rect.height * 100;
                
                x = Math.max(0, Math.min(100, x));
                y = Math.max(0, Math.min(100, y));
                
                const hue = parseInt(this.hueInput.value);
                const rgb = this.hslToRgb(hue, x, 100 - y);
                const hex = this.rgbToHex(rgb.r, rgb.g, rgb.b);
                
                this.setValue(hex);
            };
            
            const upHandler = () => {
                document.removeEventListener('mousemove', moveHandler);
                document.removeEventListener('mouseup', upHandler);
            };
            
            document.addEventListener('mousemove', moveHandler);
            document.addEventListener('mouseup', upHandler);
            
            moveHandler(e);
        }

        renderHistory() {
            if (!this.historyGrid) return;
            
            this.historyGrid.innerHTML = '';
            
            this.history.slice(0, 10).forEach(color => {
                const swatch = document.createElement('button');
                swatch.type = 'button';
                swatch.className = 'history-swatch';
                swatch.style.backgroundColor = color;
                swatch.title = color;
                swatch.addEventListener('click', () => {
                    this.setValue(color);
                });
                this.historyGrid.appendChild(swatch);
            });
        }

        addToHistory(color) {
            ColorSchemeManager.addToHistory(color);
            this.history = ColorSchemeManager.colorHistory;
            this.renderHistory();
        }

        updateContrast() {
            const bg = this.getContrastBackground();
            const ratio = ColorSchemeManager.getContrastRatio(this.value, bg);
            
            const passesAA = ratio >= 4.5;
            const passesAAA = ratio >= 7;
            
            this.contrastPreview.style.backgroundColor = bg;
            this.contrastPreview.style.color = this.value;
            this.contrastRatio.textContent = `${ratio.toFixed(2)}:1`;
            
            this.contrastBadge.textContent = passesAAA ? 'AAA' : passesAA ? 'AA' : '不足';
            this.contrastBadge.className = 'contrast-badge ' + (passesAAA ? 'pass-aaa' : passesAA ? 'pass-aa' : 'fail');
        }

        getContrastBackground() {
            return getComputedStyle(document.documentElement)
                .getPropertyValue('--color-page-bg-start')
                .trim() || '#ffffff';
        }

        isValidHex(value) {
            return /^#?[0-9A-Fa-f]{6}$/.test(value) || /^#?[0-9A-Fa-f]{3}$/.test(value);
        }

        normalizeColor(color) {
            if (!color) return '#000000';
            color = color.trim();
            
            if (/^#?[0-9A-Fa-f]{3}$/.test(color)) {
                const r = color[1];
                const g = color[2];
                const b = color[3];
                return `#${r}${r}${g}${g}${b}${b}`;
            }
            
            return color.startsWith('#') ? color : '#' + color;
        }

        hexToRgb(hex) {
            hex = this.normalizeColor(hex);
            const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return result ? {
                r: parseInt(result[1], 16),
                g: parseInt(result[2], 16),
                b: parseInt(result[3], 16)
            } : null;
        }

        rgbToHex(r, g, b) {
            return '#' + [r, g, b].map(x => {
                const hex = Math.round(Math.max(0, Math.min(255, x))).toString(16);
                return hex.length === 1 ? '0' + hex : hex;
            }).join('');
        }

        rgbToHsl(r, g, b) {
            r /= 255;
            g /= 255;
            b /= 255;
            
            const max = Math.max(r, g, b);
            const min = Math.min(r, g, b);
            let h, s, l = (max + min) / 2;
            
            if (max === min) {
                h = s = 0;
            } else {
                const d = max - min;
                s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
                
                switch (max) {
                    case r:
                        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
                        break;
                    case g:
                        h = ((b - r) / d + 2) / 6;
                        break;
                    case b:
                        h = ((r - g) / d + 4) / 6;
                        break;
                }
            }
            
            return { h: h * 360, s: s * 100, l: l * 100 };
        }

        hslToRgb(h, s, l) {
            h /= 360;
            s /= 100;
            l /= 100;
            
            let r, g, b;
            
            if (s === 0) {
                r = g = b = l;
            } else {
                const hue2rgb = (p, q, t) => {
                    if (t < 0) t += 1;
                    if (t > 1) t -= 1;
                    if (t < 1/6) return p + (q - p) * 6 * t;
                    if (t < 1/2) return q;
                    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
                    return p;
                };
                
                const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
                const p = 2 * l - q;
                
                r = hue2rgb(p, q, h + 1/3);
                g = hue2rgb(p, q, h);
                b = hue2rgb(p, q, h - 1/3);
            }
            
            return {
                r: Math.round(r * 255),
                g: Math.round(g * 255),
                b: Math.round(b * 255)
            };
        }

        destroy() {
            if (this.wrapper && this.wrapper.parentNode) {
                this.wrapper.parentNode.removeChild(this.wrapper);
            }
        }
    }

    window.ColorPicker = ColorPicker;

})();
