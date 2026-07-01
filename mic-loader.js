/**
 * MIC Crystal Catalog Loader
 *
 * Scans ./crystals/*.json inside the module's own static assets, parses each
 * one against the MIC crystal schema (1.0), and pushes them into the
 * `crystals` compendium pack declared in module.json.
 */

const MODULE_ID = "mic-augment-crystals";
const PACK_NAME = "mic-augment-crystals.crystals";
const CRYSTAL_DIR = "crystals";
const SCHEMA_TAG = "mic-augment-crystal/1.0";

class CrystalCatalog {
  static VALID_RANKS   = ["least", "lesser", "greater"];
  static VALID_FAMILY  = ["weapon", "armor", "shield"];

  static validate(json) {
    if (json?.schema !== SCHEMA_TAG)   return ["schema-mismatch"];
    if (!json.id || typeof json.id !== "string") return ["missing-id"];
    if (!json.name)                    return ["missing-name"];
    if (!this.VALID_RANKS.includes(json.rank))    return ["bad-rank"];
    if (!this.VALID_FAMILY.includes(json.family)) return ["bad-family"];
    if (typeof json.basePrice !== "number")       return ["missing-price"];
    if (json.unidentifiedDesc != null
        && typeof json.unidentifiedDesc !== "string") {
      return ["bad-unidentified-desc"];
    }
    if (json.shell != null && typeof json.shell !== "string") {
      return ["bad-shell"];
    }
    // effects is an optional array of objects
    if (json.effects != null) {
      if (!Array.isArray(json.effects)) return ["bad-effects"];
      for (const e of json.effects) {
        if (typeof e !== "object" || e === null) return ["bad-effects"];
      }
    }
    // elements is optional array of strings
    if (json.elements != null) {
      if (!Array.isArray(json.elements)
        || !json.elements.every(el => typeof el === "string")) {
        return ["bad-elements"];
      }
    }
    return [];
  }

  static async hash(json) {
    const text = JSON.stringify(json);
    if (!globalThis.crypto?.subtle) {
      let h = 5381;
      for (let i = 0; i < text.length; i++) h = ((h << 5) + h) ^ text.charCodeAt(i);
      return `fnv1a:${(h >>> 0).toString(16)}`;
    }
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");
  }
}

class CrystalCatalogLoader {
  static records = [];

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
    console.log(`[MIC-LD] syncIntoCompendium called. records=${this.records.length}`);
    if (!this.records.length) {
      console.warn("[MIC-LD] nothing to sync (catalog empty)");
      return;
    }
    const pack = game.packs.get(PACK_NAME);
    console.log(`[MIC-LD] pack lookup:`, pack ? `${PACK_NAME} found, metadata={locked:${pack.metadata?.locked}, ownership:${JSON.stringify(pack.metadata?.ownership)}}` : `not found`);
    if (!pack) {
      console.warn(`[MIC-LD] pack ${PACK_NAME} not found in game.packs`);
      return;
    }

    // Foundry v14 keeps packs locked by default; we need to unlock before write.
    if (pack.locked) {
      console.warn(`[MIC-LD] pack is locked — temporarily unlocking for catalog write`);
      try {
        await pack.configure({ locked: false });
        console.log(`[MIC-LD] unlocked pack ${PACK_NAME}, locked=${pack.locked}`);
      } catch (e) {
        console.error(`[MIC-LD] could not unlock pack`, e?.stack ?? e);
      }
    }

    // Force a re-read of the pack contents so we know what's already there.
    let docs;
    try {
      docs = await pack.getDocuments();
      console.log(`[MIC-LD] pack.getDocuments() returned ${docs.length} docs`);
    } catch (e) {
      console.error(`[MIC-LD] pack.getDocuments() failed`, e);
      return;
    }

    let created = 0, updated = 0, kept = 0, warned = 0;

    for (const json of this.records) {
      const existing = docs.find(d =>
        d.getFlag(MODULE_ID, "catalogId") === json.id ||
        d.name === json.name
      );

      if (!existing) {
        console.log(`[MIC-LD] creating '${json.id}' (${json.name})`);
        const newDoc = this.docFromJson(json);
        try {
          const opts = { pack: pack.collection, keepId: false };
          const createdDoc = await CONFIG.Item.documentClass.create(newDoc, opts);
          console.log(`[MIC-LD] created doc id=${createdDoc?.id} uuid=${createdDoc?.uuid}`);

          if (createdDoc?.id) {
            await createdDoc.setFlag(MODULE_ID, "hash", await CrystalCatalog.hash(json));
            console.log(`[MIC-LD] hash flag written for ${json.id}`);
          }
          created++;
        } catch (e) {
          console.error(`[MIC-LD] create failed for ${json.id}`, e?.stack ?? e);
        }
        continue;
      }

      // If the existing doc has the wrong Item.type (an older version of
      // the catalogue that produced 'equipment' + armor subtype), force a
      // delete-and-recreate so it matches the current schema.
      const wrongType = existing.type !== "loot";
      const noCatalogId = !existing.getFlag(MODULE_ID, "catalogId");
      if (wrongType || noCatalogId) {
        console.warn(`[MIC-LD] ${json.id} exists but has wrong type ('${existing.type}') or no catalogId — recreating`);
        const staleId = existing.id;
        await existing.delete();
        // drop the stale reference from the cached 'docs' array
        docs = docs.filter(x => x.id !== staleId);
        const newDoc = this.docFromJson(json);
        try {
          const created2 = await CONFIG.Item.documentClass.create(newDoc, { pack: pack.collection });
          if (created2?.id) {
            await created2.setFlag(MODULE_ID, "hash", await CrystalCatalog.hash(json));
            console.log(`[MIC-LD] recreated '${json.id}' as loot item`);
          }
          created++;
        } catch (e) {
          console.error(`[MIC-LD] recreate failed for ${json.id}`, e?.stack ?? e);
        }
        continue;
      }

      const existingHash = existing.getFlag(MODULE_ID, "hash");
      const newHash      = await CrystalCatalog.hash(json);

      const otherFlags = Object.entries(existing.flags ?? {})
        .filter(([ns]) => ns !== MODULE_ID)
        .map(([ns, f]) => `${ns}.${Object.keys(f || {}).join(",")}`);

      if (otherFlags.length) {
        console.warn(`[MIC-LD] ${json.id} has GM edits (${otherFlags.join(" | ")}); updating catalogue fields only`);
        warned++;
      }

      if (existingHash !== newHash) {
        // Detect GM edits: any field outside our flag namespace is considered
        // user-curated. We only refresh catalogue metadata in that case;
        // body fields are left alone so a hand-tuned resale price survives.
        const isEdited = Object.keys(existing.system ?? {}).some(k =>
          // we touch only mic-socket-system.* and a few safe keys below
          false
        );
        const customFlags = Object.keys(existing.flags ?? {})
          .filter(ns => ns !== MODULE_ID);

        if (customFlags.length || isEdited) {
          console.warn(`[MIC-LD] ${json.id} has GM customisations (flags: ${customFlags.join(",")}) — refreshing catalogue metadata only`);
          const partialUpdate = {
            name: this.docFromJson(json).name,
            [`flags.${MODULE_ID}.hash`]:                                  newHash,
            "system.mic-socket-system.crystal.itemLevel":        json.itemLevel ?? null,
            "system.mic-socket-system.crystal.casterLevel":      json.casterLevel ?? null,
            "system.mic-socket-system.crystal.description":      json.description ?? "",
            "system.mic-socket-system.crystal.unidentifiedDesc": json.unidentifiedDesc ?? "",
            "system.mic-socket-system.crystal.shell":            json.shell ?? null,
            "system.mic-socket-system.crystal.elements":         json.elements ?? [],
            "system.mic-socket-system.crystal.effects":          json.effects ?? [],
            "system.mic-socket-system.crystal.prerequisites":    json.prerequisites ?? {},
            "system.mic-socket-system.crystal.costToCreate":     json.costToCreate ?? null,
            "system.mic-socket-system.crystal.sources":          json.sources ?? []
          };
          await existing.update(partialUpdate);
        } else {
          await existing.update({
            ...(this.docFromJson(json)),
            [`flags.${MODULE_ID}.hash`]: newHash
          });
        }
        console.log(`[MIC-LD] updated ${json.id}`);
        updated++;
      } else {
        kept++;
      }
    }

    for (const d of docs) {
      const catId = d.getFlag(MODULE_ID, "catalogId");
      if (!catId) continue;
      if (!this.records.some(r => r.id === catId)) {
        console.warn(`[MIC-LD] deleting stale entry ${catId}`);
        await d.delete();
      }
    }

    if (!pack.locked && pack.metadata?.ownership?.PLAYER !== true) {
      // Re-lock the pack as a courtesy, but only if we changed it ourselves.
      try {
        await pack.configure({ locked: false });
      } catch (e) {
        // ignore - coinforme we already did the writes
      }
    }

    const final = await pack.getDocuments();
    console.log(`[MIC-LD] sync done — created=${created} updated=${updated} kept=${kept} warned=${warned} | pack has ${final.length} doc(s) now`);
  }

  static docFromJson(json) {
    // D35E treats items of type "loot" as non-equippable treasures.
    // Crystals must be loot with a flag that says "I am a crystal".
    // The mic-socket-system.crystal.* fields live under system; they are
    // the D35E-recognized source of truth via the registered DataModel.
    const desc = json.description ?? "";
    const unidentifiedDesc = json.unidentifiedDesc ?? "";
    const itemLevel = json.itemLevel ?? null;
    const casterLevel = json.casterLevel ?? null;

    // Variant disambiguation: when multiple JSONs share the same display
    // name (e.g. Clasp of Fire Protection x least/lesser/greater), suffix
    // the rank so the compendium shows clear entries. Otherwise keep the
    // name verbatim.
    const rankCap = json.rank
      ? json.rank.charAt(0).toUpperCase() + json.rank.slice(1)
      : "";
    const sameNameCount = (this.records || []).filter(r => r.name === json.name).length;
    const displayName = (sameNameCount > 1 && rankCap)
      ? `${json.name} (${rankCap})`
      : json.name;

    return {
      name: displayName,
      type: "loot",
      img:  "icons/commodities/treasure/token-silver-blue.webp",
      system: {
        // Description block — D35E requires both identified and unidentified.
        description: {
          value:        `<p>${desc}</p>`,
          chat:         "",
          unidentified: `<p>${unidentifiedDesc}</p>`
        },
        // Common D35E schema flags populated so the sheet renders cleanly.
        identified:    true,
        identifiedName: json.name,
        quantity:      1,
        weight:        json.weight ?? 0,
        constantWeight: false,
        price:         json.basePrice ?? 0,
        resalePrice:   Math.floor((json.basePrice ?? 0) / 2),
        brokenResalePrice: Math.floor((json.basePrice ?? 0) / 10),
        hp:            { max: 10, value: 10 },
        hardness:      0,
        carried:       true,
        unidentified:  { price: 0, name: "" },
        subType:       "misc",
        rarity:        "common",
        aura:          json.aura?.school ?? "",
        desc:          desc,
        // D35E expects an `index` block for caches:
        index: { subType: null, uniqueId: json.id || "" },
        // Our custom data model key:
        "mic-socket-system.crystal": {
          isCrystal:        true,
          crystalFamily:    json.family,
          crystalRank:      json.rank,
          enhancementBonus: json.enhancement ?? 0,
          description:      desc,
          unidentifiedDesc: unidentifiedDesc,
          effectType:       Array.isArray(json.tags) ? json.tags[0] : "other",
          itemLevel, casterLevel,
          shell:            json.shell ?? null,
          elements:         json.elements ?? [],
          effects:          json.effects ?? [],
          prerequisites:    json.prerequisites ?? {},
          costToCreate:     json.costToCreate ?? null,
          sources:          json.sources ?? []
        }
      },
      flags: {
        [MODULE_ID]: {
          catalogId: json.id,
          hash: null,
          catalog: json
        }
      }
    };
  }
}

export async function initLoader() {
  console.log("[MIC-LD] initLoader start");
  await CrystalCatalogLoader.index();
  console.log("[MIC-LD] initLoader done");

  const moduleDescriptor = game.modules.get(MODULE_ID);
  moduleDescriptor.api ??= {};
  Object.assign(moduleDescriptor.api, {
    catalog: () => CrystalCatalogLoader.records,
    rerun:   () => CrystalCatalogLoader.syncIntoCompendium()
  });
  console.log(`[MIC-LD] api ready: catalog(), rerun()`);
}

export async function readyLoader() {
  console.log("[MIC-LD] readyLoader invoked");
  try {
    await CrystalCatalogLoader.syncIntoCompendium();
  } catch (e) {
    console.error("[MIC-LD] syncIntoCompendium threw", e?.stack ?? e);
  }
}

Hooks.once("init", initLoader);
Hooks.on("ready", readyLoader);
