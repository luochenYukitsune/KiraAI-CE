/**
 * Color Scheme UI Initialization
 * Initializes the color scheme management interface
 */

(function() {
    'use strict';

    let colorPickers = {};
    let currentTab = 'basics';
    let pendingSchemeId = null;
    let isInitialized = false;

    const colorFields = [
        { key: 'primary', label: '主色调', group: 'basics', type: 'color' },
        { key: 'primaryHover', label: '悬停色', group: 'basics', type: 'color' },
        { key: 'primaryActive', label: '激活色', group: 'basics', type: 'color' },
        { key: 'navText', label: '文字颜色', group: 'navigation', type: 'color' },
        { key: 'navBg', label: '背景颜色', group: 'navigation', type: 'color' },
        { key: 'navHoverBg', label: '悬停背景', group: 'navigation', type: 'color' },
        { key: 'navActiveBg', label: '激活背景', group: 'navigation', type: 'color' },
        { key: 'navActiveText', label: '激活文字', group: 'navigation', type: 'color' },
        { key: 'sidebarBg', label: '背景颜色', group: 'sidebar', type: 'color' },
        { key: 'sidebarBorder', label: '边框颜色', group: 'sidebar', type: 'color' },
        { key: 'pageBgStart', label: '起始颜色', group: 'content', type: 'color' },
        { key: 'pageBgMid1', label: '中间色1', group: 'content', type: 'color' },
        { key: 'pageBgMid2', label: '中间色2', group: 'content', type: 'color' },
        { key: 'pageBgMid3', label: '中间色3', group: 'content', type: 'color' },
        { key: 'pageBgEnd', label: '结束颜色', group: 'content', type: 'color' },
        { key: 'textPrimary', label: '标题颜色', group: 'text', type: 'color' },
        { key: 'textSecondary', label: '正文颜色', group: 'text', type: 'color' },
        { key: 'textMuted', label: '辅助文字', group: 'text', type: 'color' },
        { key: 'buttonDefaultBg', label: '默认背景', group: 'buttons', type: 'color' },
        { key: 'buttonHoverBg', label: '悬停背景', group: 'buttons', type: 'color' },
        { key: 'buttonActiveBg', label: '激活背景', group: 'buttons', type: 'color' },
        { key: 'buttonDisabledBg', label: '禁用背景', group: 'buttons', type: 'color' },
        { key: 'aeroOpacity', label: '透明度', group: 'effects', type: 'range', min: 0, max: 1, step: 0.05 },
        { key: 'blurIntensity', label: '模糊强度', group: 'effects', type: 'range', min: 0, max: 32, step: 1 },
        { key: 'scrollbarTrack', label: '轨道颜色', group: 'scrollbar', type: 'color' },
        { key: 'scrollbarThumb', label: '滑块颜色', group: 'scrollbar', type: 'color' },
        { key: 'scrollbarThumbHover', label: '悬停滑块', group: 'scrollbar', type: 'color' }
    ];

    window.initColorSchemeUI = function() {
        if (isInitialized) return;
        if (!document.getElementById('color-scheme-settings')) return;
        if (typeof ColorSchemeManager === 'undefined') {
            console.error('ColorSchemeManager not loaded');
            return;
        }
        if (typeof ColorPicker === 'undefined') {
            console.error('ColorPicker not loaded');
            return;
        }

        isInitialized = true;
        ColorSchemeManager.init();
        loadColorPickers();
        renderSchemeList();
        setupEventListeners();
        updatePreview();
    };

    function loadColorPickers() {
        const colors = ColorSchemeManager.getSchemeColors();

        colorFields.forEach(field => {
            const container = document.getElementById(`color-picker-${field.key}`);
            if (!container) return;

            if (field.type === 'color') {
                const picker = new ColorPicker({
                    container: container,
                    value: colors[field.key] || '#000000',
                    showHistory: true,
                    onChange: (value) => {
                        handleColorChange(field.key, value);
                    }
                });
                colorPickers[field.key] = picker;
            } else if (field.type === 'range') {
                const wrapper = document.createElement('div');
                wrapper.className = 'range-input-wrapper';
                wrapper.innerHTML = `
                    <input type="range" 
                           class="range-slider" 
                           min="${field.min}" 
                           max="${field.max}" 
                           step="${field.step}" 
                           value="${colors[field.key] || field.min}">
                    <span class="range-value">${colors[field.key] || field.min}</span>
                `;
                container.appendChild(wrapper);

                const input = wrapper.querySelector('.range-slider');
                const valueDisplay = wrapper.querySelector('.range-value');
                
                input.addEventListener('input', () => {
                    const value = input.value;
                    valueDisplay.textContent = value;
                    handleColorChange(field.key, value);
                });
                
                colorPickers[field.key] = { setValue: (v) => { input.value = v; valueDisplay.textContent = v; } };
            }
        });
    }

    function handleColorChange(key, value) {
        const colors = ColorSchemeManager.getSchemeColors();
        colors[key] = value;

        const scheme = ColorSchemeManager.getCurrentScheme();
        if (scheme) {
            scheme.colors[key] = value;
            ColorSchemeManager.applyColors(colors);
            
            if (key === 'pageBgStart' || key === 'pageBgEnd') {
                const isDark = ColorSchemeManager.isDarkColor(value);
                if (isDark) {
                    document.documentElement.classList.add('dark');
                } else {
                    document.documentElement.classList.remove('dark');
                }
            }
        }

        updatePreview();
    }

    function updatePreview() {
        const colors = ColorSchemeManager.getSchemeColors();

        const previewNav = document.querySelector('.preview-nav');
        if (previewNav) {
            previewNav.style.background = colors.navBg || '#ffffff';
        }

        const previewNavItems = document.querySelectorAll('.preview-nav-item');
        previewNavItems.forEach(item => {
            item.style.color = colors.navText || '#24141d';
        });

        const previewCard = document.querySelector('.preview-card');
        if (previewCard) {
            const opacity = parseFloat(colors.aeroOpacity) || 0.7;
            const blur = parseInt(colors.blurIntensity) || 16;
            previewCard.style.background = `rgba(255, 255, 255, ${opacity})`;
            previewCard.style.backdropFilter = `blur(${blur}px)`;
        }

        const previewBtnDefault = document.querySelector('.preview-btn-default');
        if (previewBtnDefault) {
            previewBtnDefault.style.background = colors.buttonDefaultBg || '#3b82f6';
        }

        const previewBtnOutline = document.querySelector('.preview-btn-outline');
        if (previewBtnOutline) {
            previewBtnOutline.style.borderColor = colors.primary || '#3b82f6';
            previewBtnOutline.style.color = colors.primary || '#3b82f6';
        }

        const previewScrollbarThumb = document.querySelector('.preview-scrollbar-thumb');
        if (previewScrollbarThumb) {
            previewScrollbarThumb.style.background = colors.scrollbarThumb || '#888888';
        }
    }

    window.renderSchemeList = function() {
        const listContainer = document.getElementById('scheme-list');
        if (!listContainer) return;

        const schemes = ColorSchemeManager.getAllSchemes();
        const currentId = ColorSchemeManager.currentSchemeId;

        let html = '';
        Object.values(schemes).forEach(scheme => {
            const isActive = scheme.id === currentId;
            const colorDots = Object.values(scheme.colors).slice(0, 5).map(color => 
                `<div class="scheme-color-dot" style="background-color: ${color}"></div>`
            ).join('');

            html += `
                <div class="scheme-card ${isActive ? 'active' : ''}" data-scheme-id="${scheme.id}">
                    <div class="scheme-preview-colors">${colorDots}</div>
                    <div class="scheme-info">
                        <div class="scheme-name">${scheme.name}</div>
                        ${scheme.isPreset ? '<span class="scheme-badge">预设</span>' : ''}
                    </div>
                    ${!scheme.isPreset ? `
                    <div class="scheme-card-actions">
                        <button class="scheme-action-btn" onclick="event.stopPropagation(); window.editScheme('${scheme.id}')" title="编辑">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                            </svg>
                        </button>
                        <button class="scheme-action-btn delete" onclick="event.stopPropagation(); window.deleteScheme('${scheme.id}')" title="删除">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                            </svg>
                        </button>
                    </div>
                    ` : ''}
                </div>
            `;
        });

        listContainer.innerHTML = html;

        document.querySelectorAll('.scheme-card').forEach(card => {
            card.addEventListener('click', function() {
                const schemeId = this.dataset.schemeId;
                window.applyScheme(schemeId);
            });
        });
    };

    function setupEventListeners() {
        document.querySelectorAll('.config-tab').forEach(tab => {
            tab.addEventListener('click', function() {
                const tabName = this.dataset.tab;
                switchTab(tabName);
            });
        });

        document.getElementById('create-scheme-btn')?.addEventListener('click', showCreateSchemeModal);
        document.getElementById('import-scheme-btn')?.addEventListener('click', showImportModal);
        document.getElementById('export-scheme-btn')?.addEventListener('click', window.exportCurrentScheme);
    }

    function switchTab(tabName) {
        currentTab = tabName;

        document.querySelectorAll('.config-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });

        document.querySelectorAll('.config-content').forEach(content => {
            content.classList.toggle('active', content.dataset.tab === tabName);
        });
    }

    function showCreateSchemeModal() {
        pendingSchemeId = null;
        const modal = document.getElementById('scheme-modal');
        if (modal) {
            document.getElementById('modal-title').textContent = '创建新配色方案';
            document.getElementById('scheme-name-input').value = '';
            document.getElementById('modal-save-btn').textContent = '创建';
            modal.classList.add('show');
        }
    }

    window.editScheme = function(schemeId) {
        const scheme = ColorSchemeManager.getSchemeById(schemeId);
        if (!scheme) return;

        pendingSchemeId = schemeId;
        const modal = document.getElementById('scheme-modal');
        if (modal) {
            document.getElementById('modal-title').textContent = '重命名配色方案';
            document.getElementById('scheme-name-input').value = scheme.name;
            document.getElementById('modal-save-btn').textContent = '保存';
            modal.classList.add('show');
        }
    };

    window.saveSchemeFromModal = function() {
        const name = document.getElementById('scheme-name-input').value.trim();
        if (!name) {
            window.showToast('请输入方案名称', 'error');
            return;
        }

        if (pendingSchemeId) {
            ColorSchemeManager.updateScheme(pendingSchemeId, { name });
            window.showToast('配色方案已保存', 'success');
        } else {
            const scheme = ColorSchemeManager.createScheme(name);
            ColorSchemeManager.applyScheme(scheme.id);
            window.showToast('配色方案已创建并应用', 'success');
        }

        document.getElementById('scheme-modal')?.classList.remove('show');
        window.renderSchemeList();
    };

    window.deleteScheme = function(schemeId) {
        const scheme = ColorSchemeManager.getSchemeById(schemeId);
        if (!scheme || scheme.isPreset) return;

        pendingSchemeId = schemeId;
        const modal = document.getElementById('confirm-modal');
        if (modal) {
            document.getElementById('delete-scheme-name').textContent = scheme.name;
            modal.classList.add('show');
        }
    };

    window.confirmDeleteScheme = function() {
        if (pendingSchemeId) {
            ColorSchemeManager.deleteScheme(pendingSchemeId);
            window.showToast('配色方案已删除', 'success');
            window.renderSchemeList();
        }
        pendingSchemeId = null;
        document.getElementById('confirm-modal')?.classList.remove('show');
    };

    window.applyScheme = function(schemeId) {
        ColorSchemeManager.applyScheme(schemeId);

        const colors = ColorSchemeManager.getSchemeColors();
        Object.keys(colorPickers).forEach(key => {
            if (colorPickers[key] && colors[key]) {
                colorPickers[key].setValue(colors[key]);
            }
        });

        updatePreview();
        window.renderSchemeList();
        window.showToast('配色方案已应用', 'success');
    };

    function showImportModal() {
        const modal = document.getElementById('import-modal');
        if (modal) {
            document.getElementById('import-file-input').value = '';
            document.getElementById('import-preview').innerHTML = '';
            modal.classList.add('show');
        }
    }

    window.handleFileSelect = function(e) {
        const file = e.target.files[0];
        if (!file) return;

        if (!file.name.endsWith('.json')) {
            window.showToast('请选择JSON格式文件', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = function(event) {
            try {
                const data = JSON.parse(event.target.result);
                if (!data.colors) {
                    throw new Error('Invalid format');
                }
                previewImport(data);
            } catch (err) {
                window.showToast('文件格式错误', 'error');
            }
        };
        reader.readAsText(file);
    };

    function previewImport(data) {
        const preview = document.getElementById('import-preview');
        if (!preview) return;

        const colorDots = Object.values(data.colors).slice(0, 5).map(color => 
            `<div class="scheme-color-dot" style="background-color: ${color}"></div>`
        ).join('');

        preview.innerHTML = `
            <div class="scheme-card">
                <div class="scheme-preview-colors">${colorDots}</div>
                <div class="scheme-info">
                    <div class="scheme-name">${data.name || '未命名方案'}</div>
                </div>
            </div>
        `;

        preview.dataset.importData = JSON.stringify(data);
    }

    window.importScheme = function() {
        const preview = document.getElementById('import-preview');
        if (!preview) return;

        const importData = preview.dataset.importData;
        if (!importData) {
            window.showToast('请先选择文件', 'error');
            return;
        }

        try {
            const data = JSON.parse(importData);
            const scheme = ColorSchemeManager.importScheme(data);
            ColorSchemeManager.applyScheme(scheme.id);
            window.showToast('配色方案已导入', 'success');
            document.getElementById('import-modal')?.classList.remove('show');
            window.renderSchemeList();

            const colors = ColorSchemeManager.getSchemeColors();
            Object.keys(colorPickers).forEach(key => {
                if (colorPickers[key] && colors[key]) {
                    colorPickers[key].setValue(colors[key]);
                }
            });
            updatePreview();
        } catch (err) {
            window.showToast('导入失败: ' + err.message, 'error');
        }
    };

    window.exportCurrentScheme = function() {
        const scheme = ColorSchemeManager.getCurrentScheme();
        if (!scheme) return;

        const exportData = ColorSchemeManager.exportScheme(scheme.id);
        if (!exportData) {
            window.showToast('导出失败', 'error');
            return;
        }

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = (scheme.name.replace(/\s+/g, '_')) + '_color_scheme.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        window.showToast('配色方案已导出', 'success');
    };

    window.showToast = function(message, type) {
        const container = document.getElementById('toast-container') || createToastContainer();

        const toast = document.createElement('div');
        toast.className = 'toast ' + type;
        toast.innerHTML = '<span class="toast-message">' + message + '</span>';
        container.appendChild(toast);

        setTimeout(function() {
            toast.style.opacity = '0';
            setTimeout(function() { toast.remove(); }, 300);
        }, 3000);
    };

    function createToastContainer() {
        const container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
        return container;
    }

    window.hideModal = function(modalId) {
        document.getElementById(modalId)?.classList.remove('show');
    };

    window.saveColorScheme = function() {
        const scheme = ColorSchemeManager.getCurrentScheme();
        if (scheme && !scheme.isPreset) {
            ColorSchemeManager.updateScheme(scheme.id, { colors: ColorSchemeManager.getSchemeColors() });
            window.showToast('配色方案已保存', 'success');
        } else {
            showCreateSchemeModal();
        }
    };

    window.undoColorChange = function() {
        ColorSchemeManager.applyCurrentScheme();
        const colors = ColorSchemeManager.getSchemeColors();
        Object.keys(colorPickers).forEach(key => {
            if (colorPickers[key] && colors[key]) {
                colorPickers[key].setValue(colors[key]);
            }
        });
        updatePreview();
        window.showToast('已撤销更改', 'info');
    };

})();
