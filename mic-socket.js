/**
 * MICSocketManager - Gerencia o sistema de Augment Crystals (Magic Item Compendium)
 * Compatível com Foundry VTT v13 e sistema D35E.
 */
class MICSocketManager {
  
  static init() {
    console.log("MIC Socket | Inicializando sistema de cristais...");

    Hooks.on("renderItemSheet", (app, html, data) => {
      // Compatibilidade v13: garante objeto JQuery
      const jqHtml = html instanceof HTMLElement ? $(html) : html;
      this._onRenderItemSheet(app, jqHtml, data);
    });
  }

  /**
   * Identifica se um item é um cristal válido baseado no Nome e Origem.
   */
  static _identifyCrystal(item) {
    const name = item.name.toLowerCase();
    // Estrutura: ID_DO_MODULO.NOME_DO_PACK (definidos no module.json)
    const expectedPack = "mic-augment-crystals.mic-augment-crystals";
    
    const isFromCompendium = item.flags?.core?.sourceId?.includes(expectedPack) || 
                             item.pack === expectedPack;
    
    // Verificamos a flag usando o ID oficial do módulo
    const isCrystal = name.includes("crystal") || item.getFlag("mic-augment-crystals", "isCrystal");

    if (!isCrystal || !isFromCompendium) return null;

    let rank = "least";
    if (name.includes("lesser")) rank = "lesser";
    if (name.includes("greater")) rank = "greater";

    let type = "weapon";
    const armorKeywords = ["restful", "stamina", "shielding", "warding", "armor", "shield"];
    if (armorKeywords.some(key => name.includes(key))) type = "armor";

    return { rank, type };
  }

  static _getItemTotalBonus(item) {
    const system = item.system;
    const enhancement = system.enhancement ?? 
                        system.armor?.enhancement ?? 
                        system.weapon?.enhancement ?? 0;
    
    const isMasterwork = system.masterwork || system.quality === "masterwork";

    return { enhancement, isMasterwork };
  }

  static _canEquipCrystal(crystal, targetItem) {
    const info = this._identifyCrystal(crystal);
    if (!info) return { valid: false, error: "Apenas cristais do Compendium oficial do MIC são aceitos." };

    const { enhancement, isMasterwork } = this._getItemTotalBonus(targetItem);
    const isValidBase = isMasterwork || enhancement > 0;

    if (info.type === "armor" && targetItem.type !== "equipment") {
      return { valid: false, error: "Este é um cristal de ARMADURA/ESCUDO." };
    }
    if (info.type === "weapon" && targetItem.type !== "weapon") {
      return { valid: false, error: "Este é um cristal de ARMA." };
    }

    if (info.rank === "least" && !isValidBase) 
      return { valid: false, error: "Cristais 'Least' exigem item de Obra-Prima ou Mágico." };
    
    if (info.rank === "lesser" && enhancement < 1) 
      return { valid: false, error: "Cristais 'Lesser' exigem bônus mágico +1." };
    
    if (info.rank === "greater" && enhancement < 3) 
      return { valid: false, error: "Cristais 'Greater' exigem bônus mágico +3." };

    return { valid: true };
  }

  static async _onRenderItemSheet(app, html, data) {
    const item = app.item;

    if (!["weapon", "equipment"].includes(item.type)) return;
    if (this._identifyCrystal(item)) return; 
    if (html.find(".mic-socket-container").length > 0) return;

    // Recupera usando o ID 'mic-augment-crystals'
    const crystalUuid = item.getFlag("mic-augment-crystals", "crystalUuid");
    let crystalDisplay = { name: "Vazio", img: "" };

    if (crystalUuid) {
      const crystal = await fromUuid(crystalUuid);
      if (crystal) {
        crystalDisplay = { 
          name: crystal.name, 
          img: `<img src="${crystal.img}" class="mic-socket-img" />` 
        };
      }
    }

    const socketHtml = `
      <div class="mic-socket-container">
        <label class="mic-socket-label">Augment Crystal:</label>
        <div class="mic-socket-slot" id="mic-drop-zone">
            ${crystalDisplay.img || '<i class="fas fa-gem" style="color: #444;"></i>'}
        </div>
        <span class="mic-socket-name">${crystalDisplay.name}</span>
        ${crystalUuid ? '<i class="fas fa-times mic-socket-remove" title="Remover Cristal"></i>' : ''}
      </div>
    `;

    const target = html.find(".item-properties").first();
    if (target.length) target.after(socketHtml);
    else html.find(".sheet-body").prepend(socketHtml);

    html.find("#mic-drop-zone").on("drop", (e) => this._onCrystalDrop(e, item));
    html.find(".mic-socket-remove").on("click", (e) => {
      e.stopPropagation();
      this._removeCrystal(item);
    });
  }

  static async _onCrystalDrop(event, targetItem) {
    event.preventDefault();
    const data = TextEditor.getDragEventData(event);
    if (data.type !== "Item") return;

    const droppedItem = await fromUuid(data.uuid);
    if (!droppedItem) return;

    const validation = this._canEquipCrystal(droppedItem, targetItem);
    if (!validation.valid) return ui.notifications.error(validation.error);

    await targetItem.setFlag("mic-augment-crystals", "crystalUuid", data.uuid);
    this._refreshWindow(targetItem.id);
    ui.notifications.info(`${droppedItem.name} acoplado com sucesso!`);
  }

  static async _removeCrystal(item) {
    await item.unsetFlag("mic-augment-crystals", "crystalUuid");
    this._refreshWindow(item.id);
    ui.notifications.info("Cristal removido.");
  }

  static _refreshWindow(itemId) {
    Object.values(ui.windows)
      .filter(w => w.item?.id === itemId)
      .forEach(w => w.render(true));
  }
}

MICSocketManager.init();