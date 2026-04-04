/**
 * i18next configuration and initialization
 * Handles internationalization for the KiraAI admin panel
 *
 * Translations are loaded from:
 *   /static/locales/en/translation.js  -> window._locale_en
 *   /static/locales/zh/translation.js  -> window._locale_zh
 */

// Translation resources — populated by locale files loaded before this script
const resources = {
    en: {
        translation: window._locale_en
    },
    zh: {
        translation: window._locale_zh
    }
};

/**
 * Update all elements with data-i18n attribute
 */
function updateTranslations() {
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        const translation = i18next.t(key);
        if (translation && translation !== key) {
            if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
                element.placeholder = translation;
            } else {
                element.textContent = translation;
            }
        }
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
        const key = element.getAttribute('data-i18n-placeholder');
        const translation = i18next.t(key);
        if (translation && translation !== key) {
            element.placeholder = translation;
            const ariaKey = element.getAttribute('data-i18n-aria-label');
            if (ariaKey) {
                const ariaTranslation = i18next.t(ariaKey);
                if (ariaTranslation && ariaTranslation !== ariaKey) {
                    element.setAttribute('aria-label', ariaTranslation);
                    element.setAttribute('data-i18n-aria-generated', 'false');
                } else {
                    element.setAttribute('aria-label', translation);
                    element.setAttribute('data-i18n-aria-generated', 'true');
                }
            } else if (!element.getAttribute('aria-label') || element.getAttribute('data-i18n-aria-generated') === 'true') {
                element.setAttribute('aria-label', translation);
                element.setAttribute('data-i18n-aria-generated', 'true');
            }
        }
    });

    document.querySelectorAll('[data-i18n-aria-label]:not([data-i18n-placeholder])').forEach(element => {
        const ariaKey = element.getAttribute('data-i18n-aria-label');
        const ariaTranslation = i18next.t(ariaKey);
        if (ariaTranslation && ariaTranslation !== ariaKey) {
            element.setAttribute('aria-label', ariaTranslation);
            element.setAttribute('title', ariaTranslation);
            element.setAttribute('data-i18n-aria-generated', 'false');
        } else {
            const fallbackLabel = element.placeholder || '';
            if (fallbackLabel) {
                element.setAttribute('aria-label', fallbackLabel);
                element.setAttribute('title', fallbackLabel);
                element.setAttribute('data-i18n-aria-generated', 'true');
            } else if (element.getAttribute('data-i18n-aria-generated') === 'true') {
                element.removeAttribute('aria-label');
                element.removeAttribute('title');
                element.removeAttribute('data-i18n-aria-generated');
            }
        }
    });
}

// Initialize i18next with language persistence
i18next
    .use(i18nextBrowserLanguageDetector)
    .init({
        resources: resources,
        fallbackLng: 'en',
        debug: false,
        interpolation: {
            escapeValue: false
        },
        detection: {
            order: ['localStorage', 'navigator'],
            caches: ['localStorage']
        }
    })
    .then(() => {
        updateTranslations();
        
        const syncLanguageSelector = () => {
            const languageSelector = document.getElementById('language-selector');
            if (languageSelector) {
                languageSelector.value = i18next.language;
            }
            
            const settingsLanguageSelect = document.getElementById('settings-language');
            if (settingsLanguageSelect) {
                settingsLanguageSelect.value = i18next.language;
            }
        };
        
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', syncLanguageSelector);
        } else {
            syncLanguageSelector();
        }
    });

// Handle language selector changes
document.addEventListener('change', (e) => {
    if (e.target.id === 'language-selector' || e.target.id === 'settings-language') {
        const newLang = e.target.value;
        
        i18next.changeLanguage(newLang).then(() => {
            try {
                updateTranslations();
                
                document.querySelectorAll('#language-selector, #settings-language').forEach(selector => {
                    if (selector !== e.target) {
                        selector.value = newLang;
                    }
                });
                
                const page = document.getElementById('page-configuration');
                if (page && !page.classList.contains('hidden') && window.configManager && typeof window.configManager.render === 'function') {
                    window.configManager.render();
                }
            } catch (error) {
                console.error('Failed to update translations after language change:', error);
            }
        }).catch((error) => {
            console.error('Failed to change language:', error);
        });
    }
});

// Export for use in other scripts
window.i18n = {
    t: (key) => i18next.t(key),
    changeLanguage: (lng) => i18next.changeLanguage(lng).then(() => {
        try {
            updateTranslations();
            
            document.querySelectorAll('#language-selector, #settings-language').forEach(selector => {
                selector.value = lng;
            });
            
            const page = document.getElementById('page-configuration');
            if (page && !page.classList.contains('hidden') && window.configManager && typeof window.configManager.render === 'function') {
                window.configManager.render();
            }
        } catch (error) {
            console.error('Failed to update translations after language change:', error);
        }
    })
};

window.updateTranslations = updateTranslations;