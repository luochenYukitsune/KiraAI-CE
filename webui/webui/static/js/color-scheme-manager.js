/**
 * KiraAI Color Scheme Manager
 * A comprehensive color scheme management system for WebUI
 */

(function() {
    'use strict';

    const ColorSchemeManager = {
        storageKey: 'kira_color_schemes',
        currentSchemeKey: 'kira_current_scheme',
        colorHistoryKey: 'kira_color_history',
        maxHistoryItems: 10,

        defaultColors: {
            primary: '#3b82f6',
            primaryHover: '#2563eb',
            primaryActive: '#1d4ed8',
            navBg: '#ffffff',
            navText: '#24141d',
            navHoverBg: 'rgba(0, 0, 0, 0.05)',
            navActiveBg: 'rgba(197, 213, 246, 0.7)',
            navActiveText: '#3864d5',
            sidebarBg: 'rgba(255, 255, 255, 0.15)',
            sidebarBorder: 'rgba(255, 255, 255, 0.1)',
            pageBgStart: '#e0e7ff',
            pageBgMid1: '#f0f4ff',
            pageBgMid2: '#e8f4f8',
            pageBgMid3: '#f5f0ff',
            pageBgEnd: '#fff5f5',
            textPrimary: '#111827',
            textSecondary: '#374151',
            textMuted: '#9ca3af',
            aeroOpacity: '0.7',
            blurIntensity: '16',
            scrollbarTrack: '#f1f1f1',
            scrollbarThumb: '#888888',
            scrollbarThumbHover: '#555555',
            buttonDefaultBg: '#3b82f6',
            buttonHoverBg: '#2563eb',
            buttonActiveBg: '#1d4ed8',
            buttonDisabledBg: '#9ca3af'
        },

        presetSchemes: {
            default: {
                id: 'preset-default',
                name: '默认主题',
                nameEn: 'Default Theme',
                isPreset: true,
                colors: {
                    primary: '#3b82f6',
                    primaryHover: '#2563eb',
                    primaryActive: '#1d4ed8',
                    navBg: '#ffffff',
                    navText: '#24141d',
                    navHoverBg: 'rgba(0, 0, 0, 0.05)',
                    navActiveBg: 'rgba(197, 213, 246, 0.7)',
                    navActiveText: '#3864d5',
                    sidebarBg: 'rgba(255, 255, 255, 0.15)',
                    sidebarBorder: 'rgba(255, 255, 255, 0.1)',
                    pageBgStart: '#e0e7ff',
                    pageBgMid1: '#f0f4ff',
                    pageBgMid2: '#e8f4f8',
                    pageBgMid3: '#f5f0ff',
                    pageBgEnd: '#fff5f5',
                    textPrimary: '#111827',
                    textSecondary: '#374151',
                    textMuted: '#9ca3af',
                    aeroOpacity: '0.7',
                    blurIntensity: '16',
                    scrollbarTrack: '#f1f1f1',
                    scrollbarThumb: '#888888',
                    scrollbarThumbHover: '#555555',
                    buttonDefaultBg: '#3b82f6',
                    buttonHoverBg: '#2563eb',
                    buttonActiveBg: '#1d4ed8',
                    buttonDisabledBg: '#9ca3af'
                }
            },
            dark: {
                id: 'preset-dark',
                name: '深色主题',
                nameEn: 'Dark Theme',
                isPreset: true,
                colors: {
                    primary: '#60a5fa',
                    primaryHover: '#3b82f6',
                    primaryActive: '#2563eb',
                    navBg: 'rgba(0, 0, 0, 0.2)',
                    navText: '#f9fafb',
                    navHoverBg: 'rgba(255, 255, 255, 0.1)',
                    navActiveBg: 'rgba(59, 130, 246, 0.3)',
                    navActiveText: '#93c5fd',
                    sidebarBg: 'rgba(0, 0, 0, 0.15)',
                    sidebarBorder: 'rgba(255, 255, 255, 0.05)',
                    pageBgStart: '#0f172a',
                    pageBgMid1: '#1e1b4b',
                    pageBgMid2: '#172554',
                    pageBgMid3: '#1e293b',
                    pageBgEnd: '#0f172a',
                    textPrimary: '#f9fafb',
                    textSecondary: '#e5e7eb',
                    textMuted: '#9ca3af',
                    aeroOpacity: '0.85',
                    blurIntensity: '16',
                    scrollbarTrack: '#374151',
                    scrollbarThumb: '#6b7280',
                    scrollbarThumbHover: '#9ca3af',
                    buttonDefaultBg: '#3b82f6',
                    buttonHoverBg: '#2563eb',
                    buttonActiveBg: '#1d4ed8',
                    buttonDisabledBg: '#6b7280'
                }
            },
            highContrast: {
                id: 'preset-high-contrast',
                name: '高对比度主题',
                nameEn: 'High Contrast',
                isPreset: true,
                colors: {
                    primary: '#0051a8',
                    primaryHover: '#003d7e',
                    primaryActive: '#002b5c',
                    navBg: '#ffffff',
                    navText: '#000000',
                    navHoverBg: '#e5e5e5',
                    navActiveBg: '#ffffff',
                    navActiveText: '#0051a8',
                    sidebarBg: '#ffffff',
                    sidebarBorder: '#000000',
                    pageBgStart: '#ffffff',
                    pageBgMid1: '#f5f5f5',
                    pageBgMid2: '#f0f0f0',
                    pageBgMid3: '#ebebeb',
                    pageBgEnd: '#e6e6e6',
                    textPrimary: '#000000',
                    textSecondary: '#1a1a1a',
                    textMuted: '#4d4d4d',
                    aeroOpacity: '1',
                    blurIntensity: '0',
                    scrollbarTrack: '#cccccc',
                    scrollbarThumb: '#666666',
                    scrollbarThumbHover: '#333333',
                    buttonDefaultBg: '#0051a8',
                    buttonHoverBg: '#003d7e',
                    buttonActiveBg: '#002b5c',
                    buttonDisabledBg: '#999999'
                }
            }
        },

        schemes: {},
        currentSchemeId: null,
        colorHistory: [],

        init() {
            this.loadSchemes();
            this.loadColorHistory();
            this.applyCurrentScheme();
            this.setupKeyboardShortcuts();
        },

        loadSchemes() {
            try {
                const stored = localStorage.getItem(this.storageKey);
                if (stored) {
                    this.schemes = JSON.parse(stored);
                }
                
                Object.assign(this.schemes, this.presetSchemes);
                
                const currentId = localStorage.getItem(this.currentSchemeKey);
                if (currentId && this.schemes[currentId]) {
                    this.currentSchemeId = currentId;
                } else {
                    this.currentSchemeId = 'preset-default';
                }
            } catch (e) {
                console.error('Error loading color schemes:', e);
                this.schemes = Object.assign({}, this.presetSchemes);
                this.currentSchemeId = 'preset-default';
            }
        },

        saveSchemes() {
            try {
                const toSave = {};
                Object.keys(this.schemes).forEach(id => {
                    if (!this.schemes[id].isPreset) {
                        toSave[id] = this.schemes[id];
                    }
                });
                localStorage.setItem(this.storageKey, JSON.stringify(toSave));
            } catch (e) {
                console.error('Error saving color schemes:', e);
                if (e.name === 'QuotaExceededError') {
                    this.showStorageQuotaWarning();
                }
            }
        },

        loadColorHistory() {
            try {
                const stored = localStorage.getItem(this.colorHistoryKey);
                if (stored) {
                    this.colorHistory = JSON.parse(stored);
                }
            } catch (e) {
                this.colorHistory = [];
            }
        },

        saveColorHistory() {
            try {
                localStorage.setItem(this.colorHistoryKey, JSON.stringify(this.colorHistory));
            } catch (e) {
                console.error('Error saving color history:', e);
            }
        },

        addToHistory(color) {
            const normalizedColor = this.normalizeColor(color);
            this.colorHistory = this.colorHistory.filter(c => c !== normalizedColor);
            this.colorHistory.unshift(normalizedColor);
            if (this.colorHistory.length > this.maxHistoryItems) {
                this.colorHistory = this.colorHistory.slice(0, this.maxHistoryItems);
            }
            this.saveColorHistory();
        },

        getCurrentScheme() {
            return this.schemes[this.currentSchemeId] || this.presetSchemes.default;
        },

        getSchemeById(id) {
            return this.schemes[id];
        },

        getAllSchemes() {
            return this.schemes;
        },

        createScheme(name, colors = null) {
            const id = 'custom-' + Date.now();
            const scheme = {
                id,
                name,
                isPreset: false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                colors: colors || Object.assign({}, this.defaultColors)
            };
            this.schemes[id] = scheme;
            this.saveSchemes();
            return scheme;
        },

        updateScheme(id, updates) {
            if (!this.schemes[id] || this.schemes[id].isPreset) {
                return false;
            }
            
            const scheme = this.schemes[id];
            if (updates.name) scheme.name = updates.name;
            if (updates.colors) {
                Object.assign(scheme.colors, updates.colors);
            }
            scheme.updatedAt = new Date().toISOString();
            
            this.saveSchemes();
            
            if (this.currentSchemeId === id) {
                this.applyScheme(id);
            }
            
            return true;
        },

        deleteScheme(id) {
            if (!this.schemes[id] || this.schemes[id].isPreset) {
                return false;
            }
            
            delete this.schemes[id];
            this.saveSchemes();
            
            if (this.currentSchemeId === id) {
                this.applyScheme('preset-default');
            }
            
            return true;
        },

        applyScheme(id) {
            const scheme = this.schemes[id];
            if (!scheme) return false;
            
            this.currentSchemeId = id;
            localStorage.setItem(this.currentSchemeKey, id);
            
            this.applyColors(scheme.colors);
            
            if (typeof onColorSchemeChange === 'function') {
                onColorSchemeChange(scheme);
            }
            
            document.dispatchEvent(new CustomEvent('colorSchemeChanged', { detail: scheme }));
            
            return true;
        },

        applyColors(colors) {
            const startTime = performance.now();
            
            const root = document.documentElement;
            
            Object.entries(colors).forEach(([key, value]) => {
                root.style.setProperty(`--color-${this.camelToKebab(key)}`, value);
            });
            
            const endTime = performance.now();
            console.log(`Color application took ${(endTime - startTime).toFixed(2)}ms`);
        },

        applyCurrentScheme() {
            const scheme = this.getCurrentScheme();
            if (scheme) {
                this.applyColors(scheme.colors);
            }
        },

        getSchemeColors() {
            const scheme = this.getCurrentScheme();
            return scheme ? Object.assign({}, scheme.colors) : Object.assign({}, this.defaultColors);
        },

        exportScheme(id) {
            const scheme = this.schemes[id];
            if (!scheme) return null;
            
            return {
                name: scheme.name,
                nameEn: scheme.nameEn || scheme.name,
                createdAt: new Date().toISOString(),
                colors: Object.assign({}, scheme.colors)
            };
        },

        importScheme(data) {
            if (!this.validateImportData(data)) {
                throw new Error('Invalid color scheme data');
            }
            
            const id = 'imported-' + Date.now();
            const scheme = {
                id,
                name: data.name || 'Imported Scheme',
                isPreset: false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                colors: Object.assign({}, data.colors)
            };
            
            this.schemes[id] = scheme;
            this.saveSchemes();
            
            return scheme;
        },

        validateImportData(data) {
            if (!data || typeof data !== 'object') return false;
            if (!data.colors || typeof data.colors !== 'object') return false;
            
            const requiredColors = Object.keys(this.defaultColors);
            for (const color of requiredColors) {
                if (!(color in data.colors)) {
                    data.colors[color] = this.defaultColors[color];
                }
            }
            
            for (const [key, value] of Object.entries(data.colors)) {
                if (value && !this.isValidColor(value)) {
                    data.colors[key] = this.defaultColors[key];
                }
            }
            
            return true;
        },

        isValidColor(color) {
            if (!color || typeof color !== 'string') return false;
            color = color.trim();
            
            if (/^#[0-9A-Fa-f]{3,8}$/.test(color)) return true;
            if (/^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(,\s*[\d.]+\s*)?\)$/i.test(color)) return true;
            if (/^rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*[\d.]+\s*\)$/i.test(color)) return true;
            if (/^hsl\(\s*\d+\s*,\s*[\d.]+%\s*,\s*[\d.]+%\s*\)$/i.test(color)) return true;
            if (/^hsla\(\s*\d+\s*,\s*[\d.]+%\s*,\s*[\d.]+%\s*,\s*[\d.]+\s*\)$/i.test(color)) return true;
            
            return false;
        },

        normalizeColor(color) {
            if (!color) return '#000000';
            color = color.trim();
            
            if (/^#[0-9A-Fa-f]{3}$/.test(color)) {
                const r = color[1];
                const g = color[2];
                const b = color[3];
                return `#${r}${r}${g}${g}${b}${b}`;
            }
            
            return color;
        },

        hexToRgb(hex) {
            hex = this.normalizeColor(hex);
            const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return result ? {
                r: parseInt(result[1], 16),
                g: parseInt(result[2], 16),
                b: parseInt(result[3], 16)
            } : null;
        },

        rgbToHex(r, g, b) {
            return '#' + [r, g, b].map(x => {
                const hex = Math.round(Math.max(0, Math.min(255, x))).toString(16);
                return hex.length === 1 ? '0' + hex : hex;
            }).join('');
        },

        getLuminance(r, g, b) {
            const [rs, gs, bs] = [r, g, b].map(c => {
                c = c / 255;
                return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
            });
            return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
        },

        getContrastRatio(color1, color2) {
            const rgb1 = this.hexToRgb(color1);
            const rgb2 = this.hexToRgb(color2);
            
            if (!rgb1 || !rgb2) return 1;
            
            const l1 = this.getLuminance(rgb1.r, rgb1.g, rgb1.b);
            const l2 = this.getLuminance(rgb2.r, rgb2.g, rgb2.b);
            
            const lighter = Math.max(l1, l2);
            const darker = Math.min(l1, l2);
            
            return (lighter + 0.05) / (darker + 0.05);
        },

        checkWCAGCompliance(foreground, background, isLargeText = false) {
            const ratio = this.getContrastRatio(foreground, background);
            
            const threshold = isLargeText ? 3 : 4.5;
            
            return {
                ratio: ratio.toFixed(2),
                passesAA: ratio >= threshold,
                passesAAA: ratio >= 7,
                threshold: threshold,
                level: ratio >= 7 ? 'AAA' : ratio >= threshold ? 'AA' : 'Fail'
            };
        },

        setupKeyboardShortcuts() {
            document.addEventListener('keydown', (e) => {
                if (e.ctrlKey || e.metaKey) {
                    if (e.key === 's') {
                        e.preventDefault();
                        if (typeof saveColorScheme === 'function') {
                            saveColorScheme();
                        }
                    }
                    if (e.key === 'z' && !e.shiftKey) {
                        e.preventDefault();
                        if (typeof undoColorChange === 'function') {
                            undoColorChange();
                        }
                    }
                }
            });
        },

        showStorageQuotaWarning() {
            console.warn('LocalStorage quota exceeded');
            if (typeof showNotification === 'function') {
                showNotification('存储空间已满，请删除一些自定义配色方案', 'warning');
            }
        },

        camelToKebab(string) {
            return string.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
        }
    };

    window.ColorSchemeManager = ColorSchemeManager;

    document.addEventListener('DOMContentLoaded', () => {
        if (document.getElementById('color-scheme-settings')) {
            ColorSchemeManager.init();
            initColorSchemeUI();
        }
    });

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        ColorSchemeManager.init();
    }

})();
