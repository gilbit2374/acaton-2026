// lang/i18n.js  —  Translation engine
// Usage:
//   • Add data-i18n="key"             → sets el.textContent
//   • Add data-i18n-html="key"        → sets el.innerHTML  (use for strings with <br/> or <span>)
//   • Add data-i18n-placeholder="key" → sets el.placeholder
//   • Call setLanguage('en') to switch; call applyTranslations() to re-apply after dynamic renders.

const LANGUAGES = {
  en: typeof LANG_EN !== 'undefined' ? LANG_EN : {},
  he: typeof LANG_HE !== 'undefined' ? LANG_HE : {},
  // add more languages here, e.g.:
};

let _currentLang = 'en';

/** Return the translated string for a key in the active language. */
function t(key) {
  const dict = LANGUAGES[_currentLang] || LANGUAGES['en'] || {};
  return (dict[key] !== undefined) ? dict[key] : key;
}

/** Walk the DOM and apply all translations. */
function applyTranslations() {
  // Plain text
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });

  // HTML (for strings that contain tags like <br/> or <span>)
  document.querySelectorAll('[data-i18n-html]').forEach(el => {
    el.innerHTML = t(el.dataset.i18nHtml);
  });

  // Placeholders
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });

  // Page title
  document.title = t('page_title');

  // Update language selector UI if present
  document.querySelectorAll('.lang-select').forEach(sel => {
    sel.value = _currentLang;
  });
}

/**
 * Switch to a different language and re-render.
 * @param {string} lang  Language code, e.g. 'en'
 */
function setLanguage(lang) {

  if (!LANGUAGES[lang]) {
    console.warn('[i18n] Unknown language:', lang);
    return;
  }
  document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr';
  _currentLang = lang;
  localStorage.setItem('justalk_lang', lang);
  applyTranslations();
}

// Auto-apply on DOM ready, using the saved preference (default: 'en')
document.addEventListener('DOMContentLoaded', () => {
  const saved = localStorage.getItem('justalk_lang') || 'en';
  setLanguage(saved);
});
