/**
 * Settings & configuration domain module
 * Handles i18n utilities, theme management, settings page load/save,
 * the configuration page (ConfigurationManager + legacy fallback),
 * and the file editor within the configuration page.
 *
 * Dependencies (loaded before this file):
 *   core/state.js    — AppState
 *   core/api.js      — apiCall
 *   core/notify.js   — showNotification
 *   core/monaco.js   — Monaco
 */

// ---------------------------------------------------------------------------
// i18n utilities
// ---------------------------------------------------------------------------

/**
 * Get a translated string with a fallback.
 * @param {string} key      - i18n key
 * @param {string} fallback - text to return when key is missing
 * @returns {string}
 */
function getTranslation(key, fallback) {
    if (window.i18n && typeof window.i18n.t === 'function') {
        try {
            const translation = window.i18n.t(key);
            return translation !== key ? translation : fallback;
        } catch (e) {
            return fallback;
        }
    }
    return fallback;
}

/** Apply translations to all [data-i18n] elements in the DOM */
function applyTranslations() {
    if (window.i18n && typeof window.i18n.t === 'function') {
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            const translation = window.i18n.t(key);
            if (translation && translation !== key) {
                if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
                    element.placeholder = translation;
                } else {
                    element.textContent = translation;
                }
            }
        });
    }
}

// ---------------------------------------------------------------------------
// Theme
// ---------------------------------------------------------------------------

/**
 * Apply a theme to the application.
 * @param {string} theme - 'light' or 'dark'
 */
function applyTheme(theme) {
    const htmlElement = document.documentElement;

    if (theme === 'dark') {
        htmlElement.classList.add('dark');
        document.body.classList.add('dark');
    } else {
        htmlElement.classList.remove('dark');
        document.body.classList.remove('dark');
    }

    // Persist choice
    localStorage.setItem('theme', theme);

    // Keep theme selector in sync
    const themeSelect = document.getElementById('settings-theme');
    if (themeSelect) {
        themeSelect.value = theme;
    }

    // Sync all Monaco editor instances to the new theme
    Monaco.syncTheme();
}

/**
 * Apply Aero effect (blur and opacity) to the application.
 * @param {boolean} aeroEnabled - Whether Aero effect is enabled
 * @param {number} blurIntensity - Blur intensity in pixels (0-30)
 * @param {number} aeroOpacity - Glass opacity (0.3-1.0)
 */
function applyAeroEffect(aeroEnabled, blurIntensity, aeroOpacity) {
    const root = document.documentElement;
    const body = document.body;
    
    if (aeroEnabled) {
        body.classList.remove('no-aero');
        root.style.setProperty('--blur-intensity', `${blurIntensity}px`);
        root.style.setProperty('--aero-opacity', aeroOpacity);
    } else {
        body.classList.add('no-aero');
        root.style.setProperty('--blur-intensity', '0px');
        root.style.setProperty('--aero-opacity', '1');
    }
    
    // Persist to localStorage
    localStorage.setItem('aero_enabled', aeroEnabled);
    localStorage.setItem('blur_intensity', blurIntensity);
    localStorage.setItem('aero_opacity', aeroOpacity);
}

/**
 * Load and apply saved Aero effect settings.
 */
function loadAeroEffect() {
    const savedAeroEnabled = localStorage.getItem('aero_enabled');
    const savedBlur = localStorage.getItem('blur_intensity');
    const savedOpacity = localStorage.getItem('aero_opacity');
    
    const aeroEnabled = savedAeroEnabled !== null ? savedAeroEnabled === 'true' : true;
    const blurIntensity = savedBlur !== null ? Number(savedBlur) : 16;
    const aeroOpacity = savedOpacity !== null ? Number(savedOpacity) : 0.7;
    
    applyAeroEffect(aeroEnabled, blurIntensity, aeroOpacity);
}

/**
 * Reset Aero effect settings to defaults.
 */
function resetAeroEffect() {
    applyAeroEffect(true, 16, 0.7);
}

/**
 * Apply modal backdrop blur effect to the application.
 * @param {boolean} modalBackdropBlurEnabled - Whether modal backdrop blur is enabled
 * @param {number} modalBackdropBlurIntensity - Modal backdrop blur intensity in pixels (0-30)
 */
function applyModalBackdropBlur(modalBackdropBlurEnabled, modalBackdropBlurIntensity) {
    const root = document.documentElement;
    const body = document.body;
    
    if (modalBackdropBlurEnabled) {
        body.classList.remove('no-modal-backdrop-blur');
        root.style.setProperty('--modal-backdrop-blur', `${modalBackdropBlurIntensity}px`);
    } else {
        body.classList.add('no-modal-backdrop-blur');
        root.style.setProperty('--modal-backdrop-blur', '0px');
    }
    
    // Persist to localStorage
    localStorage.setItem('modal_backdrop_blur_enabled', modalBackdropBlurEnabled);
    localStorage.setItem('modal_backdrop_blur_intensity', modalBackdropBlurIntensity);
}

/**
 * Load and apply saved modal backdrop blur settings.
 */
function loadModalBackdropBlur() {
    const savedEnabled = localStorage.getItem('modal_backdrop_blur_enabled');
    const savedIntensity = localStorage.getItem('modal_backdrop_blur_intensity');
    
    const enabled = savedEnabled !== null ? savedEnabled === 'true' : true;
    const intensity = savedIntensity !== null ? Number(savedIntensity) : 8;
    
    applyModalBackdropBlur(enabled, intensity);
}

/**
 * Reset modal backdrop blur settings to defaults.
 */
function resetModalBackdropBlur() {
    applyModalBackdropBlur(true, 8);
}

// ---------------------------------------------------------------------------
// Settings page
// ---------------------------------------------------------------------------

async function loadSettingsData() {
    try {
        const response = await apiCall('/api/settings');
        const data = await response.json();
        AppState.data.settings = data;

        const languageSelect = document.getElementById('settings-language');
        const themeSelect = document.getElementById('settings-theme');

        const currentLanguage = window.i18n && typeof window.i18n.t === 'function' ? 
            (window.i18next && window.i18next.language) || 'en' : 'en';

        if (languageSelect) {
            languageSelect.value = data.language || currentLanguage;
            
            languageSelect.onchange = function(e) {
                if (window.i18n && typeof window.i18n.changeLanguage === 'function') {
                    window.i18n.changeLanguage(e.target.value).catch((error) => {
                        console.error('Failed to change language:', error);
                    });
                } else if (window.i18next) {
                    window.i18next.changeLanguage(e.target.value).then(() => {
                        if (typeof window.updateTranslations === 'function') {
                            window.updateTranslations();
                        }
                    }).catch((error) => {
                        console.error('Failed to change language:', error);
                    });
                }
            };
        }

        if (themeSelect) {
            themeSelect.value = data.theme || 'light';
        }

        applyTheme(data.theme || 'light');

    } catch (error) {
        console.error('Error loading settings data:', error);
    }
}

async function saveSettings() {
    try {
        const language = document.getElementById('settings-language')?.value;
        const theme = document.getElementById('settings-theme')?.value;

        const response = await apiCall('/api/settings', {
            method: 'PUT',
            body: JSON.stringify({ language, theme })
        });

        const data = await response.json();

        if (data.updated_by) {
            showNotification(window.i18n ? window.i18n.t('settings.saved') : 'Settings saved successfully', 'success');
            applyTheme(theme);
        } else {
            showNotification('Failed to save settings', 'error');
        }
    } catch (error) {
        console.error('Error saving settings:', error);
        showNotification('Error saving settings', 'error');
    }
}

// loadConfigurationData, _bindConfigToolbarEvents → modules/config.js

// ---------------------------------------------------------------------------
// Configuration page — tabs (message / model)
// ---------------------------------------------------------------------------

/**
 * Initialize configuration page tabs (Message / Model).
 * Idempotent — skips if already initialized.
 */
function setupConfigurationTabs() {
    if (AppState.configurationTabsInitialized) {
        return;
    }
    const tabMessage = document.getElementById('config-tab-message');
    const tabModel = document.getElementById('config-tab-model');
    const contentMessage = document.getElementById('configuration-content-message');
    const contentModel = document.getElementById('configuration-content-model');
    if (!tabMessage || !tabModel || !contentMessage || !contentModel) {
        return;
    }
    const activateTab = (tab) => {
        AppState.configTab = tab;
        const isMessage = tab === 'message';
        contentMessage.classList.toggle('hidden', !isMessage);
        contentModel.classList.toggle('hidden', isMessage);
        if (isMessage) {
            tabMessage.classList.add('border-blue-600', 'dark:border-blue-500', 'text-blue-600', 'dark:text-blue-500');
            tabMessage.classList.remove('border-transparent', 'text-gray-500', 'dark:text-gray-400');
            tabModel.classList.remove('border-blue-600', 'dark:border-blue-500', 'text-blue-600', 'dark:text-blue-500');
            tabModel.classList.add('border-transparent', 'text-gray-500', 'dark:text-gray-400');
        } else {
            tabModel.classList.add('border-blue-600', 'dark:border-blue-500', 'text-blue-600', 'dark:text-blue-500');
            tabModel.classList.remove('border-transparent', 'text-gray-500', 'dark:text-gray-400');
            tabMessage.classList.remove('border-blue-600', 'dark:border-blue-500', 'text-blue-600', 'dark:text-blue-500');
            tabMessage.classList.add('border-transparent', 'text-gray-500', 'dark:text-gray-400');
        }
    };
    tabMessage.addEventListener('click', (e) => {
        e.preventDefault();
        activateTab('message');
    });
    tabModel.addEventListener('click', (e) => {
        e.preventDefault();
        activateTab('model');
    });
    activateTab(AppState.configTab || 'message');
    AppState.configurationTabsInitialized = true;
}

// ---------------------------------------------------------------------------
// Legacy configuration save (fallback when configManager is unavailable)
// ---------------------------------------------------------------------------

/**
 * Read a text input value by element ID.
 * @param {string} id
 * @returns {string}
 */
function getInputValue(id) {
    const el = document.getElementById(id);
    if (!el) {
        return '';
    }
    return String(el.value || '').trim();
}

/** Populate legacy message-configuration form fields from bot config object */
function populateMessageConfiguration(botConfig) {
    const bot = botConfig.bot || {};
    const agent = botConfig.agent || {};
    const selfie = botConfig.selfie || {};
    const setValue = (id, value) => {
        const el = document.getElementById(id);
        if (el) {
            el.value = value != null ? value : '';
        }
    };
    setValue('msg-max-memory-length', bot.max_memory_length);
    setValue('msg-max-message-interval', bot.max_message_interval);
    setValue('msg-max-buffer-messages', bot.max_buffer_messages);
    setValue('msg-min-message-delay', bot.min_message_delay);
    setValue('msg-max-message-delay', bot.max_message_delay);
    setValue('msg-agent-max-tool-loop', agent.max_tool_loop);
    setValue('msg-selfie-path', selfie.path);
}

/** Legacy configuration save — only called when configManager is not available */
async function saveConfiguration() {
    try {
        const botConfig = {
            bot: {
                max_memory_length: getInputValue('msg-max-memory-length'),
                max_message_interval: getInputValue('msg-max-message-interval'),
                max_buffer_messages: getInputValue('msg-max-buffer-messages'),
                min_message_delay: getInputValue('msg-min-message-delay'),
                max_message_delay: getInputValue('msg-max-message-delay')
            },
            agent: {
                max_tool_loop: getInputValue('msg-agent-max-tool-loop')
            },
            selfie: {
                path: getInputValue('msg-selfie-path')
            }
        };
        const models = buildModelsConfiguration();
        const response = await apiCall('/api/configuration', {
            method: 'POST',
            body: JSON.stringify({
                bot_config: botConfig,
                models: models
            })
        });

        const data = await response.json();

        if (data.status === 'ok') {
            showNotification(window.i18n ? window.i18n.t('configuration.saved') : 'Configuration saved successfully', 'success');
        } else {
            showNotification('Failed to save configuration', 'error');
        }
    } catch (error) {
        console.error('Error saving configuration:', error);
        showNotification('Error saving configuration', 'error');
    }
}

// ---------------------------------------------------------------------------
// Monaco file editor (within the configuration page)
// ---------------------------------------------------------------------------

/** Initialize Monaco editor — attaches callback for when Monaco is ready */
function initializeMonacoEditor() {
    Monaco.load().then(() => {
        if (AppState.currentPage === 'configuration') {
            createEditor();
        }
    });
}

/** Create the Monaco editor instance for the file editor */
function createEditor() {
    const container = document.getElementById('monaco-editor-container');
    if (!container) return;

    const editor = Monaco.register('config', container,
        AppState.editor.currentFormat,
        AppState.editor.files[AppState.editor.currentFile]?.content || '',
        { renderWhitespace: 'selection' }
    );

    updateEditorStatus();

    editor.onDidChangeModelContent(() => {
        updateEditorStatus(true); // true = unsaved changes
    });
}

/** Set up file-editor toolbar event listeners */
function setupEditorEventListeners() {
    // File selector change
    const fileSelector = document.getElementById('file-selector');
    if (fileSelector) {
        fileSelector.addEventListener('change', (e) => {
            const selectedFile = e.target.value;
            if (selectedFile) {
                loadFile(selectedFile);
            }
        });
    }

    // Format selector change
    const formatSelector = document.getElementById('format-selector');
    if (formatSelector) {
        formatSelector.addEventListener('change', (e) => {
            AppState.editor.currentFormat = e.target.value;
            Monaco.setLanguage('config', AppState.editor.currentFormat);
            updateEditorStatus();
        });
    }

    // Copy button
    const copyButton = document.getElementById('editor-copy');
    if (copyButton) {
        copyButton.addEventListener('click', () => {
            if (Monaco.get('config')) {
                navigator.clipboard.writeText(Monaco.getValue('config'));
                showNotification(window.i18n ? window.i18n.t('configuration.copied') : 'Content copied to clipboard', 'success');
            }
        });
    }

    // Download button
    const downloadButton = document.getElementById('editor-download');
    if (downloadButton) {
        downloadButton.addEventListener('click', () => {
            if (Monaco.get('config') && AppState.editor.currentFile) {
                const content = Monaco.getValue('config');
                const blob = new Blob([content], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = AppState.editor.currentFile;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                showNotification(window.i18n ? window.i18n.t('configuration.downloaded') : 'File downloaded', 'success');
            }
        });
    }

    // Refresh files button
    const refreshButton = document.getElementById('refresh-files');
    if (refreshButton) {
        refreshButton.addEventListener('click', () => {
            refreshFileList();
        });
    }
}

/**
 * Load a file into the Monaco editor.
 * @param {string} fileName
 */
function loadFile(fileName) {
    if (!AppState.editor.files[fileName]) return;

    AppState.editor.currentFile = fileName;
    AppState.editor.currentFormat = AppState.editor.files[fileName].format;

    const formatSelector = document.getElementById('format-selector');
    if (formatSelector) {
        formatSelector.value = AppState.editor.currentFormat;
    }

    if (Monaco.get('config')) {
        Monaco.get('config').setValue(AppState.editor.files[fileName].content);
        Monaco.setLanguage('config', AppState.editor.currentFormat);
    }

    updateEditorStatus();
}

/** Save the current file content from the editor back to AppState */
function saveCurrentFile() {
    if (!Monaco.get('config') || !AppState.editor.currentFile) return;

    const content = Monaco.getValue('config');
    AppState.editor.files[AppState.editor.currentFile].content = content;

    updateEditorStatus(false);
    showNotification(window.i18n ? window.i18n.t('configuration.saved') : 'File saved successfully', 'success');
}

/** Prompt for a filename and create a new file with default content */
function createNewFile() {
    const fileName = prompt(window.i18n ? window.i18n.t('configuration.enter_filename') : 'Enter filename:');
    if (!fileName) return;

    const format = fileName.split('.').pop().toLowerCase();
    const supportedFormats = ['ini', 'json', 'md', 'xml'];

    if (!supportedFormats.includes(format)) {
        showNotification(window.i18n ? window.i18n.t('configuration.unsupported_format') : 'Unsupported file format', 'error');
        return;
    }

    let defaultContent = '';
    switch (format) {
        case 'ini':
            defaultContent = '; New INI file\n[section]\nkey = value';
            break;
        case 'json':
            defaultContent = '{\n  "key": "value"\n}';
            break;
        case 'md':
            defaultContent = '# New Markdown File\n\n## Section\n\nContent here';
            break;
        case 'xml':
            defaultContent = '<?xml version="1.0" encoding="UTF-8"?>\n<root>\n  <element>Content</element>\n</root>';
            break;
    }

    AppState.editor.files[fileName] = { content: defaultContent, format };
    updateFileSelector();
    loadFile(fileName);
}

/** Refresh file list (placeholder — currently shows notification only) */
function refreshFileList() {
    showNotification(window.i18n ? window.i18n.t('configuration.refreshed') : 'File list refreshed', 'info');
}

/** Rebuild file selector dropdown from AppState.editor.files */
function updateFileSelector() {
    const fileSelector = document.getElementById('file-selector');
    if (!fileSelector) return;

    // Remove all options except the first placeholder
    while (fileSelector.children.length > 1) {
        fileSelector.removeChild(fileSelector.lastChild);
    }

    Object.keys(AppState.editor.files).forEach(fileName => {
        const option = document.createElement('option');
        option.value = fileName;
        option.textContent = fileName;
        option.setAttribute('data-format', AppState.editor.files[fileName].format);
        fileSelector.appendChild(option);
    });

    if (AppState.editor.currentFile) {
        fileSelector.value = AppState.editor.currentFile;
    }
}

/**
 * Update the editor status bar text.
 * @param {boolean} hasChanges - Whether there are unsaved changes
 */
function updateEditorStatus(hasChanges = false) {
    const statusElement = document.getElementById('editor-status');
    if (!statusElement) return;

    let statusText = '';
    if (AppState.editor.currentFile) {
        statusText = AppState.editor.currentFile;
        if (hasChanges) {
            statusText += ' *';
        }
    } else {
        statusText = window.i18n ? window.i18n.t('configuration.no_file') : 'No file selected';
    }

    statusElement.textContent = statusText;
}

// ---------------------------------------------------------------------------
// Background Music Player
// ---------------------------------------------------------------------------

const BackgroundMusicPlayer = {
    audio: null,
    _initialized: false,
    state: {
        enabled: false,
        volume: 0.5,
        url: '',
        loop: true,
        isPlaying: false
    },

    init() {
        if (this.audio) {
            this.audio.pause();
            this.audio.src = '';
        }
        
        this.audio = new Audio();
        this.audio.volume = this.state.volume;
        this.audio.loop = this.state.loop;
        
        this.audio.addEventListener('ended', () => {
            if (!this.state.loop) {
                this.state.isPlaying = false;
                this.updatePlayButton();
                this.updateStatus();
            }
        });

        this.audio.addEventListener('error', (e) => {
            console.error('Audio error:', e);
            this.state.isPlaying = false;
            this.updatePlayButton();
            this.updateStatus();
            showNotification(
                getTranslation('settings.background_music_load_error', 'Failed to load audio file'),
                'error'
            );
        });

        this.audio.addEventListener('canplaythrough', () => {
            if (this.state.enabled && this.state.url && !this.state.isPlaying) {
                this.play();
            }
        });

        this.loadSettings();
        this.bindEvents();
    },

    async loadSettings() {
        try {
            const response = await apiCall('/api/settings/background-music');
            if (response.ok) {
                const data = await response.json();
                this.state.enabled = data.enabled || false;
                this.state.volume = data.volume ?? 0.5;
                this.state.url = data.url || '';
                this.state.loop = data.loop ?? true;
                
                if (this.audio) {
                    this.audio.volume = this.state.volume;
                    this.audio.loop = this.state.loop;
                    
                    if (this.state.url) {
                        this.audio.src = this.state.url;
                    }
                }
                
                this.updateUI();
            }
        } catch (error) {
            console.error('Error loading background music settings:', error);
        }
    },

    async saveSettings() {
        try {
            await apiCall('/api/settings/background-music', {
                method: 'PUT',
                body: JSON.stringify({
                    enabled: this.state.enabled,
                    volume: this.state.volume,
                    url: this.state.url,
                    loop: this.state.loop
                })
            });
        } catch (error) {
            console.error('Error saving background music settings:', error);
        }
    },

    bindEvents() {
        const toggleBtn = document.getElementById('bg-music-toggle');
        const controlsDiv = document.getElementById('bg-music-controls');
        const volumeSlider = document.getElementById('bg-music-volume');
        const urlInput = document.getElementById('bg-music-url');
        const applyUrlBtn = document.getElementById('bg-music-apply-url');
        const loopToggle = document.getElementById('bg-music-loop-toggle');
        const playBtn = document.getElementById('bg-music-play');

        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                this.state.enabled = !this.state.enabled;
                this.updateToggle(toggleBtn, this.state.enabled);
                
                if (controlsDiv) {
                    controlsDiv.classList.toggle('hidden', !this.state.enabled);
                }
                
                if (this.state.enabled && this.state.url) {
                    this.play();
                } else {
                    this.stop();
                }
                
                this.saveSettings();
            });
        }

        if (volumeSlider) {
            volumeSlider.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                this.state.volume = value / 100;
                if (this.audio) {
                    this.audio.volume = this.state.volume;
                }
                
                const volumeValue = document.getElementById('bg-music-volume-value');
                if (volumeValue) {
                    volumeValue.textContent = `${value}%`;
                }
            });

            volumeSlider.addEventListener('change', () => {
                this.saveSettings();
            });
        }

        if (applyUrlBtn && urlInput) {
            applyUrlBtn.addEventListener('click', () => {
                const url = urlInput.value.trim();
                if (url) {
                    this.setUrl(url);
                } else {
                    showNotification(
                        getTranslation('settings.background_music_url_required', 'Please enter a valid URL'),
                        'warning'
                    );
                }
            });
        }

        if (loopToggle) {
            loopToggle.addEventListener('click', () => {
                this.state.loop = !this.state.loop;
                if (this.audio) {
                    this.audio.loop = this.state.loop;
                }
                this.updateToggle(loopToggle, this.state.loop);
                this.saveSettings();
            });
        }

        if (playBtn) {
            playBtn.addEventListener('click', () => {
                if (this.state.isPlaying) {
                    this.pause();
                } else {
                    this.play();
                }
            });
        }

        const fileInput = document.getElementById('bg-music-file-input');
        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    this.uploadFile(file);
                }
            });
        }

        const fileSelect = document.getElementById('bg-music-file-select');
        if (fileSelect) {
            fileSelect.addEventListener('change', (e) => {
                const selectedUrl = e.target.value;
                if (selectedUrl) {
                    this.setUrl(selectedUrl);
                }
            });
        }
    },

    async uploadFile(file) {
        const formData = new FormData();
        formData.append('file', file);

        try {
            showNotification(
                getTranslation('settings.background_music_uploading', 'Uploading file...'),
                'info'
            );

            const response = await apiCall('/api/settings/background-music/upload', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            
            if (result.success) {
                showNotification(
                    getTranslation('settings.background_music_upload_success', 'File uploaded successfully'),
                    'success'
                );
                this.setUrl(result.url);
                await this.loadLocalFiles();
            } else {
                throw new Error(result.detail || 'Upload failed');
            }
        } catch (error) {
            console.error('Error uploading file:', error);
            showNotification(
                getTranslation('settings.background_music_upload_error', 'Failed to upload file'),
                'error'
            );
        }
    },

    async loadLocalFiles() {
        const fileSelect = document.getElementById('bg-music-file-select');
        if (!fileSelect) return;

        try {
            const response = await apiCall('/api/settings/background-music/files');
            const data = await response.json();
            
            fileSelect.innerHTML = `<option value="" data-i18n="settings.background_music_select_file">${getTranslation('settings.background_music_select_file', 'Select a file...')}</option>`;
            
            data.files.forEach(file => {
                const option = document.createElement('option');
                option.value = file.url;
                option.textContent = `${file.filename} (${this.formatFileSize(file.size)})`;
                if (this.state.url && this.state.url.endsWith(file.filename)) {
                    option.selected = true;
                }
                fileSelect.appendChild(option);
            });
        } catch (error) {
            console.error('Error loading local files:', error);
        }
    },

    formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    },

    setUrl(url) {
        this.state.url = url;
        if (this.audio) {
            this.audio.src = url;
            if (this.state.enabled) {
                this.audio.load();
            }
        }
        this.updateSource();
        this.saveSettings();
        
        showNotification(
            getTranslation('settings.background_music_url_applied', 'Music URL applied'),
            'success'
        );
    },

    play() {
        if (!this.state.url) {
            showNotification(
                getTranslation('settings.background_music_no_url', 'Please set a music URL first'),
                'warning'
            );
            return;
        }

        if (!this.audio) {
            return;
        }

        this.audio.play().then(() => {
            this.state.isPlaying = true;
            this.updatePlayButton();
            this.updateStatus();
        }).catch((error) => {
            console.error('Error playing audio:', error);
            showNotification(
                getTranslation('settings.background_music_play_error', 'Failed to play audio'),
                'error'
            );
        });
    },

    pause() {
        if (this.audio) {
            this.audio.pause();
        }
        this.state.isPlaying = false;
        this.updatePlayButton();
        this.updateStatus();
    },

    stop() {
        if (this.audio) {
            this.audio.pause();
            this.audio.currentTime = 0;
        }
        this.state.isPlaying = false;
        this.updatePlayButton();
        this.updateStatus();
    },

    updateToggle(button, isOn) {
        const span = button.querySelector('span');
        if (isOn) {
            button.classList.remove('bg-gray-200', 'dark:bg-gray-600');
            button.classList.add('bg-blue-600');
            button.setAttribute('aria-checked', 'true');
            if (span) {
                span.classList.remove('translate-x-0');
                span.classList.add('translate-x-5');
            }
        } else {
            button.classList.remove('bg-blue-600');
            button.classList.add('bg-gray-200', 'dark:bg-gray-600');
            button.setAttribute('aria-checked', 'false');
            if (span) {
                span.classList.remove('translate-x-5');
                span.classList.add('translate-x-0');
            }
        }
    },

    updatePlayButton() {
        const playBtn = document.getElementById('bg-music-play');
        const playIcon = document.getElementById('bg-music-play-icon');
        
        if (playIcon) {
            if (this.state.isPlaying) {
                playIcon.innerHTML = `
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                `;
            } else {
                playIcon.innerHTML = `
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path>
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                `;
            }
        }
    },

    updateStatus() {
        const statusEl = document.getElementById('bg-music-status');
        if (statusEl) {
            if (this.state.isPlaying) {
                statusEl.textContent = getTranslation('settings.background_music_playing', 'Playing');
            } else {
                statusEl.textContent = getTranslation('settings.background_music_stopped', 'Stopped');
            }
        }
    },

    updateSource() {
        const sourceEl = document.getElementById('bg-music-source');
        if (sourceEl) {
            if (this.state.url) {
                try {
                    const url = new URL(this.state.url);
                    const filename = url.pathname.split('/').pop() || 'Audio';
                    sourceEl.textContent = filename;
                } catch {
                    sourceEl.textContent = this.state.url.substring(0, 30) + '...';
                }
            } else {
                sourceEl.textContent = getTranslation('settings.background_music_no_source', 'No music source');
            }
        }
        
        const urlInput = document.getElementById('bg-music-url');
        if (urlInput && this.state.url) {
            urlInput.value = this.state.url;
        }
    },

    updateUI() {
        const toggleBtn = document.getElementById('bg-music-toggle');
        const controlsDiv = document.getElementById('bg-music-controls');
        const volumeSlider = document.getElementById('bg-music-volume');
        const volumeValue = document.getElementById('bg-music-volume-value');
        const loopToggle = document.getElementById('bg-music-loop-toggle');

        if (toggleBtn) {
            this.updateToggle(toggleBtn, this.state.enabled);
        }

        if (controlsDiv) {
            controlsDiv.classList.toggle('hidden', !this.state.enabled);
        }

        if (volumeSlider) {
            volumeSlider.value = Math.round(this.state.volume * 100);
        }

        if (volumeValue) {
            volumeValue.textContent = `${Math.round(this.state.volume * 100)}%`;
        }

        if (loopToggle) {
            this.updateToggle(loopToggle, this.state.loop);
        }

        this.updateSource();
        this.updateStatus();
        this.loadLocalFiles();
    }
};

function initBackgroundMusic() {
    if (!BackgroundMusicPlayer._initialized) {
        BackgroundMusicPlayer.init();
        BackgroundMusicPlayer._initialized = true;
    }
}
