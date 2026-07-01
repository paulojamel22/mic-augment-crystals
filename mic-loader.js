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
  static VALID_RANKS   = ["least", "lesser", "greater", "major", "superior"];
  static VALID_FAMILY  = ["weapon", "armor", "shield"];

  static validate(json) {
    if (json?.schema !== SCHEMA_TAG)   return ["schema-mismatch"];
    if (!json.id || typeof json.id !== "string") return ["missing-id"];
    if (!json.name)                    return ["missing-name"];
    if (!this.VALID_RANKS.includes(json.rank))    return ["bad-rank"];
    if (!this.VALID_FAMILY.includes(json.family)) return ["bad-family"];
    if (typeof json.basePrice !== "number")       return ["missing-price"];
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
          created++;
        } catch (e) {
          console.error(`[MIC-LD] create failed for ${json.id}`, e?.stack ?? e);
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
        await existing.update({
          ...(await this.docFromJson(json)),
          [`flags.${MODULE_ID}.hash`]: newHash
        });
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
    return {
      name: json.name,
      type: "equipment",
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
