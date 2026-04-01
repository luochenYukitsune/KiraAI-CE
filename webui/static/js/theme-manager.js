/**
 * Theme Manager Module
 * Handles theme switching and persistence
 */

(function() {
    'use strict';

    const ThemeManager = {
        storageKey: 'kira_theme',
        currentTheme: null,
        availableThemes: {
            'default': {
                name: '默认主题',
                nameEn: 'Default',
                description: '玻璃态设计风格',
                preview: '/static/images/themes/default-preview.png'
            },
            'metro': {
                name: 'Metro UI',
                nameEn: 'Metro UI',
                description: 'Windows Metro 设计风格',
                preview: '/static/images/themes/metro-preview.png'
            }
        },
        listeners: [],

        init() {
            this.loadTheme();
            this.setupThemeChangeListener();
            return this;
        },

        loadTheme() {
            const savedTheme = localStorage.getItem(this.storageKey);
            if (savedTheme && this.availableThemes[savedTheme]) {
                this.applyTheme(savedTheme, false);
            } else {
                this.applyTheme('default', false);
            }
        },

        applyTheme(themeId, animate = true) {
            if (!this.availableThemes[themeId]) {
                console.warn(`Theme "${themeId}" not found`);
                return false;
            }

            const startTime = performance.now();
            const root = document.documentElement;
            const previousTheme = this.currentTheme;

            if (animate) {
                root.classList.add('theme-changing');
            }

            root.setAttribute('data-theme', themeId);
            this.currentTheme = themeId;
            localStorage.setItem(this.storageKey, themeId);

            this.notifyListeners({
                themeId,
                previousTheme,
                timestamp: Date.now()
            });

            if (animate) {
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        root.classList.remove('theme-changing');
                    });
                });
            }

            const endTime = performance.now();
            console.log(`Theme applied in ${(endTime - startTime).toFixed(2)}ms`);

            return true;
        },

        getCurrentTheme() {
            return this.currentTheme;
        },

        getThemeInfo(themeId) {
            return this.availableThemes[themeId] || null;
        },

        getAllThemes() {
            return this.availableThemes;
        },

        onThemeChange(callback) {
            if (typeof callback === 'function') {
                this.listeners.push(callback);
            }
        },

        offThemeChange(callback) {
            const index = this.listeners.indexOf(callback);
            if (index > -1) {
                this.listeners.splice(index, 1);
            }
        },

        notifyListeners(event) {
            this.listeners.forEach(callback => {
                try {
                    callback(event);
                } catch (e) {
                    console.error('Theme change listener error:', e);
                }
            });
        },

        setupThemeChangeListener() {
            document.addEventListener('theme:change', (e) => {
                if (e.detail && e.detail.themeId) {
                    this.applyTheme(e.detail.themeId);
                }
            });
        },

        toggleDarkMode() {
            const root = document.documentElement;
            const isDark = root.classList.contains('dark');
            
            if (isDark) {
                root.classList.remove('dark');
                localStorage.setItem('theme_mode', 'light');
            } else {
                root.classList.add('dark');
                localStorage.setItem('theme_mode', 'dark');
            }

            document.dispatchEvent(new CustomEvent('darkModeChange', {
                detail: { isDark: !isDark }
            }));

            return !isDark;
        },

        isDarkMode() {
            return document.documentElement.classList.contains('dark');
        },

        loadDarkModePreference() {
            const savedMode = localStorage.getItem('theme_mode');
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            
            if (savedMode === 'dark' || (savedMode === null && prefersDark)) {
                document.documentElement.classList.add('dark');
            }
        }
    };

    window.ThemeManager = ThemeManager.init();

    document.addEventListener('DOMContentLoaded', () => {
        ThemeManager.loadDarkModePreference();
        
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            const savedMode = localStorage.getItem('theme_mode');
            if (savedMode === null) {
                if (e.matches) {
                    document.documentElement.classList.add('dark');
                } else {
                    document.documentElement.classList.remove('dark');
                }
            }
        });
    });

})();
