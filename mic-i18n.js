/**
 * MIC Localization helper.
 *
 * Loads every lang/<locale>.json shipped with the module, then exposes a
 * single `MICI18n.t(key, fallbackString?, vars?)` function.  Resolution order:
 *
 *   1. keyed lookup in <current locale> dict
 *   2. keyed lookup in en.json fallback
 *   3. caller-supplied fallback string
 *   4. the key itself (so a missing translation never blocks the game)
 *
 * `vars` is a { name: value } map applied via simple "[[name]]" substitution.
 * No ICU plurals / no-nesting — small and explicit on purpose.
 *
 * We do **not** attempt to translate the original MIC descriptions sourced
 * from the book; those stay verbatim English in `system.description.value`.
 * i18n is for runtime UI / chat-card copy produced by the module.
 */

const I18N_LANGS = ["en", "pt-BR"];
const FALLBACK_LANG = "en";

const MODULE_ID = "mic-augment-crystals";

const dicts = new Map(); // lang -> { key -> string }

async function loadDict(lang) {
  if (dicts.has(lang)) return dicts.get(lang);
  try {
    const url = `modules/${MODULE_ID}/lang/${lang}.json`;
    const res = await fetch(url, { cache: "no-cache" });
    if (!res.ok) {
      console.warn(`[MIC-i18n] ${lang}.json HTTP ${res.status}`);
      dicts.set(lang, {});
      return {};
    }
    const json = await res.json();
    dicts.set(lang, json || {});
    return json || {};
  } catch (e) {
    console.warn(`[MIC-i18n] failed to load ${lang}`, e);
    dicts.set(lang, {});
    return {};
  }
}

function applyVars(template, vars) {
  if (!vars || typeof template !== "string") return template;
  return template.replace(/\[\[(\w+)\]\]/g, (_, k) =>
    vars[k] != null ? String(vars[k]) : `[[${k}]]`
  );
}

function currentLang() {
  const lang = game?.i18n?.lang;
  if (typeof lang === "string" && lang.length) return lang;
  if (typeof navigator !== "undefined" && navigator.language) return navigator.language;
  return FALLBACK_LANG;
}

export const MICI18n = {
  MODULE_ID,

  ready: false,

  async init() {
    await Promise.all(I18N_LANGS.map(loadDict));
    this.ready = true;
    console.log(`[MIC-i18n] ready. langs=${I18N_LANGS.filter(l => Object.keys(dicts.get(l) || {}).length > 0).join(",")}`);
  },

  /**
   * Translate a key. Returns the localised string or the fallback.
   * @param {string} key               — dotted key, e.g. "crystal.rank.greater"
   * @param {string|object} [fallback] — string used if neither locale has it;
   *                                     or `{fallback, vars}` shortcut.
   * @param {object} [vars]            — substitution map (optional)
   */
  t(key, fallback, vars) {
    if (typeof fallback === "object" && fallback !== null) {
      vars = fallback.vars || vars || fallback;
      fallback = fallback.fallback || fallback.fallback;
    }
    const lang = currentLang();
    const dict    = dicts.get(lang);
    const enDict  = dicts.get(FALLBACK_LANG);
    const raw =
      (dict   && dict[key]) ||
      (enDict && enDict[key]) ||
      (typeof fallback === "string" ? fallback : null) ||
      key;
    return applyVars(raw, vars);
  },

  /** True if any dict loaded a translation for `key`. */
  has(key) {
    for (const lang of I18N_LANGS) {
      const d = dicts.get(lang);
      if (d && Object.prototype.hasOwnProperty.call(d, key)) return true;
    }
    return false;
  },

  /** Programmatic re-fetch (debug / hot reload). */
  async reload() {
    dicts.clear();
    await this.init();
  }
};

Hooks.once("init", () => {
  MICI18n.init().catch(e => console.error("[MIC-i18n] init failed", e));
});

/**
 * Convenience: bind an exposed `game.modules.get(MODULE_ID).api.t(key, fallback)`
 * so GMs/macros can call it without import.
 */
Hooks.once("ready", () => {
  const mod = game?.modules?.get(MODULE_ID);
  mod?.api && (mod.api.t = MICI18n.t.bind(MICI18n));
});
