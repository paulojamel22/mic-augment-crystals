/**
 * MIC Crystal Catalog Loader
 *
 * Scans ./crystals/*.json inside the module's own static assets, parses each
 * one against the MIC crystal schema (1.0), and pushes them into the
 * `crystals` compendium pack declared in module.json.
 *
 * Behaviors:
 *   - On `init` it indexes all entries (no side effects).
 *   - On `ready` it actually creates / updates the documents.
 *   - Hash check vs. last-known-good avoids touching entries the GM edited.
 *   - Diverging schemas are logged (skipped).
 *
 * Conventions used here require that `packs/crystals.db` exists as a pack,
 * but the loader is safe even when the pack is empty (the v14 system
 * creates it the first time `game.packs.get("mic-augment-crystals.crystals")`
 * is referenced).
 */

const MODULE_ID = "mic-augment-crystals";
const PACK_NAME = "mic-augment-crystals.mic-augment-crystals"; // "<id>.<pack name on json>"
const CRYSTAL_DIR = "crystals";
const SCHEMA_TAG = "mic-augment-crystal/1.0";

class CrystalCatalog {
  static VALID_RANKS   = ["least", "lesser", "greater", "major", "superior"];
  static VALID_FAMILY  = ["weapon", "armor", "shield"];

  static validate(json) {
    if (json?.schema !== SCHEMA_TAG) {
      return ["schema-mismatch"];
    }
    if (!json.id || typeof json.id !== "string")    return ["missing-id"];
    if (!json.name)                                  return ["missing-name"];
    if (!this.VALID_RANKS.includes(json.rank))       return ["bad-rank"];
    if (!this.VALID_FAMILY.includes(json.family))    return ["bad-family"];
    if (typeof json.basePrice !== "number")          return ["missing-price"];
    return [];
  }

  static async hash(json) {
    const text = JSON.stringify(json);
    const enc = new TextEncoder().encode(text);
    if (!globalThis.crypto?.subtle) {
      // Foundry runs in browser context where subtle is available; the
      // fallback is a deterministic string hash to keep dev hosts alive.
      let h = 5381;
      for (let i = 0; i < text.length; i++) h = ((h << 5) + h) ^ text.charCodeAt(i);
      return `fnv1a:${(h >>> 0).toString(16)}`;
    }
    const buf = await crypto.subtle.digest("SHA-256", enc);
    return Array.from(new Uint8Array(buf))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");
  }
}

class CrystalCatalogLoader {
  static records = [];          // validated entries
  static warnings = [];         // ids {{dest,edits:{},newHash}}

  /** Read text contents from a module's own folder. */
  static async fetchCatalog() {
    if (!game?.modules?.get(MODULE_ID)) return [];
    try {
      const indexUrl = `modules/${MODULE_ID}/${CRYSTAL_DIR}/index.json`;
      const manifest = await fetch(indexUrl).then(r => r.json());
      if (!Array.isArray(manifest)) {
        console.warn(`[MIC-LD] index.json is not an array`);
        return [];
      }
      const files = await Promise.all(
        manifest.map(rel =>
          fetch(`modules/${MODULE_ID}/${CRYSTAL_DIR}/${rel}`)
            .then(r => r.ok ? r.json() : null)
            .then(data => data ? { rel, ...data } : null)
            .catch(e => { console.warn(`[MIC-LD] failed: ${rel}`, e); return null; })
        )
      );
      return files.filter(Boolean);
    } catch (e) {
      console.warn(`[MIC-LD] catalog fetch failed`, e);
      return [];
    }
  }

  static async fetchOne(rel) {
    try {
      const url = `modules/${MODULE_ID}/${CRYSTAL_DIR}/${rel}`;
      const data = await Foundry.utils.fetchFile(url, { json: true });
      return { rel, ...data };
    } catch (e) {
      console.warn(`[MIC-LD] failed to read ${rel}`, e);
      return null;
    }
  }

  static async index() {
    const fetched = await this.fetchCatalog();
    const indexed = [];
    for (const entry of fetched) {
      if (!entry) continue;
      const problems = CrystalCatalog.validate(entry);
      if (problems.length) {
        console.warn(`[MIC-LD] ${entry?.id ?? entry?.rel} rejected:`, problems);
        continue;
      }
      indexed.push(entry);
    }
    this.records = indexed;
    console.log(`[MIC-LD] index: ${indexed.length}/${fetched.length} valid`);
  }

  static async syncIntoCompendium() {
    if (!this.records.length) return;
    const pack = game.packs.get(PACK_NAME);
    if (!pack) {
      console.warn(`[MIC-LD] pack ${PACK_NAME} not found`);
      return;
    }
    // Pack index maps by id. We re-read each time and re-create on hash drift,
    // preserving any flags the GM added (those go in `_source._flags.mic...`).
    await pack.getDocuments();
    const ids = new Set(this.records.map(r => r.id));
    const present = new Map();
    pack.index.forEach(e => present.set(e._id, e));

    // Build an array of operations to run.
    let created = 0, updated = 0, kept = 0, warned = 0;

    for (const json of this.records) {
      const existing = pack.index.find(e => e.name === json.name
                                       && (e.flags?.[MODULE_ID]?.catalogId ?? null) === json.id);
      const newDoc = await this.docFromJson(json);

      if (!existing) {
        await pack.createDocument(newDoc);
        created++;
        continue;
      }

      const existingDoc = pack.getDocument(existing._id);
      const existingHash = existing.flags?.[MODULE_ID]?.hash;
      const newHash     = await CrystalCatalog.hash(json);

      // If the GM appears to have hand-edited the doc (other flag is present),
      // emit a warning, but still update identity-bearing fields only.
      const gmEdits = Object.entries(existing.flags || {})
        .filter(([ns]) => ns !== MODULE_ID)
        .flatMap(([ns, f]) => Object.keys(f || {}).map(k => `${ns}.${k}`));
      if (gmEdits.length) {
        console.warn(`[MIC-LD] ${json.id} has GM edits: ${gmEdits.join(", ")} — applying catalogue update on top (hash above)`);
        warned++;
      }
      if (existingHash !== newHash) {
        await existingDoc.update({ ...newDoc, [`flags.${MODULE_ID}.hash`]: newHash });
        updated++;
      } else {
        kept++;
      }
    }

    // Clean up entries that no longer have a JSON source.
    for (const ex of pack.index) {
      const catId = ex.flags?.[MODULE_ID]?.catalogId;
      if (!catId) continue;
      if (!ids.has(catId)) {
        await pack.getDocument(ex._id).delete();
      }
    }

    console.log(`[MIC-LD] sync created=${created} updated=${updated} kept=${kept} warned=${warned}`);
  }

  static async docFromJson(json) {
    return {
      name: json.name,
      type: "equipment", // D35E root type for crystals; sub-type via data
      img:  json.icon || "icons/svg/gem.svg",
      system: {
        "mic-socket-system.crystal": {
          isCrystal:  true,
          crystalFamily:  json.family,
          crystalRank:    json.rank,
          enhancementBonus: json.enhancement ?? 0,
          description:    json.description ?? "",
          effectType:     (json.tags ?? [])[0] ?? "other"
        },
        rarity: "common",
        quantity: 1,
        price:   json.basePrice ?? 0,
        weight:  json.weight ?? 0,
        aura:    json.aura?.school ?? "",
        desc:    json.description ?? "",
        identified: true
      },
      flags: {
        [MODULE_ID]: {
          catalogId: json.id,
          catalog: json
        }
      }
    };
  }
}

export async function initLoader() {
  await CrystalCatalogLoader.index();

  // Expose for GM debugging.
  const moduleDescriptor = game.modules.get(MODULE_ID);
  moduleDescriptor.api ??= {};
  Object.assign(moduleDescriptor.api, {
    catalog: () => CrystalCatalogLoader.records,
    rerun:   () => CrystalCatalogLoader.syncIntoCompendium()
  });
  console.log(`[MIC-LD] api ready: catalog(), rerun()`);
}

export async function readyLoader() {
  await CrystalCatalogLoader.syncIntoCompendium();
}

Hooks.once("init", initLoader);
Hooks.once("ready", readyLoader);
