/**
 * MIC Settings module
 *
 * Exposes a single GM-only Configurable Setting that lets the world choose
 * which language the MIC augment-crystal helpers render text in.  The
 * option `auto` keeps the previous behaviour: follow Foundry's world
 * language (`game.i18n.lang`).
 */

import { MICI18n } from "./mic-i18n.js";

const MODULE_ID = "mic-augment-crystals";

const SETTING_LANGUAGE = "crystalLanguageOverride";

/** Choices shown in the Configure Settings UI. */
const LANGUAGE_CHOICES = {
  "auto": "Auto (follow Foundry world language)",
  "en":   "English",
  "pt-BR": "Português (Brasil)"
};

function readOverride() {
  try {
    const v = game?.settings?.get(MODULE_ID, SETTING_LANGUAGE);
    return (typeof v === "string" && v.length) ? v : "auto";
  } catch {
    return "auto";
  }
}

export function registerMicaSettings() {
  game.settings.register(MODULE_ID, SETTING_LANGUAGE, {
    name:      "Idioma do Módulo / Module Language",
    hint:      "Força o módulo Mic Augment Crystals a exibir textos em Inglês ou Português do Brasil. 'Auto' segue o idioma do mundo configurado em Foundry.",
    scope:     "world",
    config:    true,
    type:      String,
    choices:   LANGUAGE_CHOICES,
    default:   "auto",
    requiresReload: false,
  });

  // Sync setting → MICI18n override at boot
  MICI18n.setLanguageOverride(readOverride() === "auto" ? null : readOverride());
  console.log(`[MIC-Settings] language override = ${MICI18n.getLanguageOverride() ?? "auto"}`);
}

Hooks.once("init", registerMicaSettings);

// React when the GM flips the setting live
Hooks.on("updateSetting", (setting) => {
  if (setting?.key !== `${MODULE_ID}.${SETTING_LANGUAGE}`) return;
  const next = setting.value;
  MICI18n.setLanguageOverride(next === "auto" ? null : next);
  console.log(`[MIC-Settings] live override → ${MICI18n.getLanguageOverride() ?? "auto"}`);
});
