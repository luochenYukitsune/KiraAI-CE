/**
 * Theme Selector Component
 * UI component for selecting and previewing themes
 */

(function() {
    'use strict';

    const ThemeSelector = {
        container: null,
        isOpen: false,

        init() {
            this.createStyles();
            this.createContainer();
            this.bindEvents();
            return this;
        },

        createStyles() {
            if (document.getElementById('theme-selector-styles')) return;

            const styles = document.createElement('style');
            styles.id = 'theme-selector-styles';
            styles.textContent = `
                .theme-selector-container {
                    padding: var(--metro-spacing-lg, 16px);
                }

                .theme-selector-title {
                    font-size: var(--metro-font-size-lg, 16px);
                    font-weight: var(--metro-font-weight-semibold, 600);
                    color: var(--metro-text-primary, #1A1A1A);
                    margin-bottom: var(--metro-spacing-md, 12px);
                }

                .theme-selector-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
                    gap: var(--metro-spacing-md, 12px);
                }

                .theme-option {
                    position: relative;
                    background: var(--metro-surface, #FFFFFF);
                    border: 2px solid var(--metro-border, #D1D1D1);
                    border-radius: var(--metro-radius-md, 4px);
                    padding: var(--metro-spacing-md, 12px);
                    cursor: pointer;
                    transition: border-color 150ms ease-in-out,
                                box-shadow 150ms ease-in-out;
                }

                .theme-option:hover {
                    border-color: var(--metro-primary, #0078D4);
                }

                .theme-option.selected {
                    border-color: var(--metro-primary, #0078D4);
                    background: var(--metro-primary-light, rgba(0, 120, 212, 0.1));
                }

                .theme-option.selected::after {
                    content: '';
                    position: absolute;
                    top: var(--metro-spacing-sm, 8px);
                    right: var(--metro-spacing-sm, 8px);
                    width: 20px;
                    height: 20px;
                    background: var(--metro-primary, #0078D4);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .theme-option.selected::before {
                    content: '✓';
                    position: absolute;
                    top: var(--metro-spacing-sm, 8px);
                    right: var(--metro-spacing-sm, 8px);
                    width: 20px;
                    height: 20px;
                    color: white;
                    font-size: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1;
                }

                .theme-preview {
                    width: 100%;
                    height: 80px;
                    background: linear-gradient(135deg, #e0e7ff 0%, #f0f4ff 50%, #fff5f5 100%);
                    border-radius: var(--metro-radius-sm, 2px);
                    margin-bottom: var(--metro-spacing-sm, 8px);
                    overflow: hidden;
                    position: relative;
                }

                .theme-preview.metro {
                    background: #F3F3F3;
                }

                .theme-preview.metro::before {
                    content: '';
                    position: absolute;
                    top: 8px;
                    left: 8px;
                    right: 8px;
                    height: 12px;
                    background: #0078D4;
                }

                .theme-preview.metro::after {
                    content: '';
                    position: absolute;
                    top: 28px;
                    left: 8px;
                    width: 40px;
                    height: 40px;
                    background: #0078D4;
                }

                .theme-name {
                    font-size: var(--metro-font-size-sm, 14px);
                    font-weight: var(--metro-font-weight-semibold, 600);
                    color: var(--metro-text-primary, #1A1A1A);
                    margin-bottom: 2px;
                }

                .theme-description {
                    font-size: var(--metro-font-size-xs, 12px);
                    color: var(--metro-text-tertiary, #8A8A8A);
                }

                .dark-mode-toggle {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: var(--metro-spacing-md, 12px);
                    background: var(--metro-surface, #FFFFFF);
                    border: 2px solid var(--metro-border, #D1D1D1);
                    border-radius: var(--metro-radius-md, 4px);
                    margin-top: var(--metro-spacing-lg, 16px);
                }

                .dark-mode-toggle-label {
                    font-size: var(--metro-font-size-sm, 14px);
                    font-weight: var(--metro-font-weight-semibold, 600);
                    color: var(--metro-text-primary, #1A1A1A);
                }

                .dark-mode-switch {
                    width: 44px;
                    height: 22px;
                    background: var(--metro-btn-secondary-bg, #E5E5E5);
                    border-radius: var(--metro-radius-sm, 2px);
                    position: relative;
                    cursor: pointer;
                    transition: background-color 150ms ease-in-out;
                }

                .dark-mode-switch.active {
                    background: var(--metro-primary, #0078D4);
                }

                .dark-mode-switch::after {
                    content: '';
                    position: absolute;
                    top: 3px;
                    left: 3px;
                    width: 16px;
                    height: 16px;
                    background: white;
                    border-radius: var(--metro-radius-sm, 2px);
                    transition: transform 150ms ease-in-out;
                }

                .dark-mode-switch.active::after {
                    transform: translateX(22px);
                }

                /* Dark mode styles */
                .dark .theme-selector-title {
                    color: #FFFFFF;
                }

                .dark .theme-option {
                    background: #2D2D2D;
                    border-color: #3D3D3D;
                }

                .dark .theme-option:hover {
                    border-color: #0078D4;
                }

                .dark .theme-name {
                    color: #FFFFFF;
                }

                .dark .theme-description {
                    color: #9A9A9A;
                }

                .dark .dark-mode-toggle {
                    background: #2D2D2D;
                    border-color: #3D3D3D;
                }

                .dark .dark-mode-toggle-label {
                    color: #FFFFFF;
                }
            `;
            document.head.appendChild(styles);
        },

        createContainer() {
            const container = document.getElementById('theme-selector-container');
            if (!container) return;

            this.container = container;
            this.render();
        },

        render() {
            if (!this.container) return;

            const themes = window.ThemeManager ? window.ThemeManager.getAllThemes() : {};
            const currentTheme = window.ThemeManager ? window.ThemeManager.getCurrentTheme() : 'default';
            const isDarkMode = document.documentElement.classList.contains('dark');

            let html = `
                <div class="theme-selector-title">主题选择</div>
                <div class="theme-selector-grid">
            `;

            Object.entries(themes).forEach(([id, theme]) => {
                html += `
                    <div class="theme-option ${id === currentTheme ? 'selected' : ''}" 
                         data-theme-id="${id}">
                        <div class="theme-preview ${id}"></div>
                        <div class="theme-name">${theme.name}</div>
                        <div class="theme-description">${theme.description}</div>
                    </div>
                `;
            });

            html += `
                </div>
                <div class="dark-mode-toggle">
                    <span class="dark-mode-toggle-label">深色模式</span>
                    <div class="dark-mode-switch ${isDarkMode ? 'active' : ''}" 
                         id="dark-mode-switch"></div>
                </div>
            `;

            this.container.innerHTML = html;
        },

        bindEvents() {
            document.addEventListener('click', (e) => {
                const themeOption = e.target.closest('.theme-option');
                if (themeOption) {
                    const themeId = themeOption.dataset.themeId;
                    this.selectTheme(themeId);
                }

                const darkModeSwitch = e.target.closest('#dark-mode-switch');
                if (darkModeSwitch) {
                    this.toggleDarkMode();
                }
            });

            if (window.ThemeManager) {
                window.ThemeManager.onThemeChange(() => {
                    this.render();
                });
            }

            document.addEventListener('darkModeChange', () => {
                this.render();
            });
        },

        selectTheme(themeId) {
            if (window.ThemeManager) {
                window.ThemeManager.applyTheme(themeId);
            }

            document.querySelectorAll('.theme-option').forEach(option => {
                option.classList.toggle('selected', option.dataset.themeId === themeId);
            });

            this.showToast(`已切换到 ${window.ThemeManager.getThemeInfo(themeId)?.name || themeId}`);
        },

        toggleDarkMode() {
            if (window.ThemeManager) {
                const isDark = window.ThemeManager.toggleDarkMode();
                const darkModeSwitch = document.getElementById('dark-mode-switch');
                if (darkModeSwitch) {
                    darkModeSwitch.classList.toggle('active', isDark);
                }
            }
        },

        showToast(message) {
            if (typeof window.showToast === 'function') {
                window.showToast(message, 'success');
            } else {
                console.log(message);
            }
        }
    };

    window.ThemeSelector = ThemeSelector;

    document.addEventListener('DOMContentLoaded', () => {
        ThemeSelector.init();
    });

})();
