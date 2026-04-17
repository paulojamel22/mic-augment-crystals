/**
 * MICSocketManager - Gerencia o sistema de Augment Crystals (Magic Item Compendium)
 * Compatível com Foundry VTT v13 e sistema D35E.
 */
class MICSocketManager {
  
  static init() {
    console.log("MIC Socket | Inicializando sistema de cristais...");

    // Hook de renderização da ficha do item
    Hooks.on("renderItemSheet", (app, html, data) => {
      // Compatibilidade v13: garante objeto JQuery para manipulação do DOM
      const jqHtml = html instanceof HTMLElement ? $(html) : html;
      this._onRenderItemSheet(app, jqHtml, data);
    });
  }

  /**
   * Identifica se um item é um cristal válido baseado no Nome e Origem (Compendium)
   */
  static _identifyCrystal(item) {
    const name = item.name.toLowerCase();
    const expectedPack = "mic-augment-crystals.crystals";
    
    // Verifica se o item nasceu no seu compendium ou tem a flag manual
    const isFromCompendium = item.flags?.core?.sourceId?.includes(expectedPack) || 
                             item.pack === expectedPack;
    
    const isCrystal = name.includes("crystal") || item.getFlag("mic-socket-system", "isCrystal");

    if (!isCrystal || !isFromCompendium) return null;

    // Detecta Rank por convenção de nome (RAW MIC)
    let rank = "least";
    if (name.includes("lesser")) rank = "lesser";
    if (name.includes("greater")) rank = "greater";

    // Detecta Tipo (Armor vs Weapon)
    let type = "weapon";
    const armorKeywords = ["restful", "stamina", "shielding", "warding", "armor", "shield"];
    if (armorKeywords.some(key => name.includes(key))) type = "armor";

    return { rank, type };
  }

  /**
   * Calcula o bônus de melhoria e status de Obra-Prima do item alvo
   */
  static _getItemTotalBonus(item) {
    const system = item.system;
    // Mapeamento de bônus comum no D35E
    const enhancement = system.enhancement ?? 
                        system.armor?.enhancement ?? 
                        system.weapon?.enhancement ?? 0;
    
    const isMasterwork = system.masterwork || system.quality === "masterwork";

    return { enhancement, isMasterwork };
  }

  /**
   * Aplica as regras de negócio do Magic Item Compendium
   */
  static _canEquipCrystal(crystal, targetItem) {
    const info = this._identifyCrystal(crystal);
    if (!info) return { valid: false, error: "Apenas cristais do Compendium 'MIC - Augment Crystals' são aceitos." };

    const { enhancement, isMasterwork } = this._getItemTotalBonus(targetItem);
    const isValidBase = isMasterwork || enhancement > 0;

    // 1. Validação de Categoria
    if (info.type === "armor" && targetItem.type !== "equipment") {
      return { valid: false, error: "Este é um cristal de ARMADURA/ESCUDO." };
    }
    if (info.type === "weapon" && targetItem.type !== "weapon") {
      return { valid: false, error: "Este é um cristal de ARMA." };
    }

    // 2. Validação de Rank (Rules as Written)
    if (info.rank === "least" && !isValidBase) 
      return { valid: false, error: "Cristais 'Least' exigem item de Obra-Prima ou Mágico." };
    
    if (info.rank === "lesser" && enhancement < 1) 
      return { valid: false, error: "Cristais 'Lesser' exigem bônus mágico de pelo menos +1." };
    
    if (info.rank === "greater" && enhancement < 3) 
      return { valid: false, error: "Cristais 'Greater' exigem bônus mágico de pelo menos +3." };

    return { valid: true };
  }

  /**
   * Renderiza o Slot de Cristal na ficha da Arma/Armadura
   */
  static async _onRenderItemSheet(app, html, data) {
    const item = app.item;

    // Filtros de Segurança
    if (!["weapon", "equipment"].includes(item.type)) return;
    if (this._identifyCrystal(item)) return; // Cristais não podem ter slots neles mesmos
    if (html.find(".mic-socket-container").length > 0) return;

    // Recupera cristal equipado
    const crystalUuid = item.getFlag("mic-socket-system", "crystalUuid");
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

    // Injeção de HTML
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

    // Localiza a lista de propriedades da ficha e injeta o slot abaixo dela
    const target = html.find(".item-properties").first();
    if (target.length) target.after(socketHtml);
    else html.find(".sheet-body").prepend(socketHtml); // Fallback caso a classe mude

    // Bind de Eventos
    html.find("#mic-drop-zone").on("drop", (e) => this._onCrystalDrop(e, item));
    html.find(".mic-socket-remove").on("click", (e) => {
      e.stopPropagation();
      this._removeCrystal(item);
    });
  }

  /**
   * Gerencia o recebimento do item arrastado
   */
  static async _onCrystalDrop(event, targetItem) {
    event.preventDefault();
    const data = TextEditor.getDragEventData(event);
    if (data.type !== "Item") return;

    const droppedItem = await fromUuid(data.uuid);
    if (!droppedItem) return;

    // Validação de Origem e Regras
    const validation = this._canEquipCrystal(droppedItem, targetItem);
    if (!validation.valid) {
      return ui.notifications.error(validation.error);
    }

    // Persistência
    await targetItem.setFlag("mic-socket-system", "crystalUuid", data.uuid);
    this._refreshWindow(targetItem.id);
    ui.notifications.info(`${droppedItem.name} acoplado com sucesso!`);
  }

  /**
   * Remove o cristal e limpa as flags
   */
  static async _removeCrystal(item) {
    await item.unsetFlag("mic-socket-system", "crystalUuid");
    this._refreshWindow(item.id);
    ui.notifications.info("Cristal removido.");
  }

  /**
   * Força o re-render da ficha aberta
   */
  static _refreshWindow(itemId) {
    Object.values(ui.windows)
      .filter(w => w.item?.id === itemId)
      .forEach(w => w.render(true));
  }
}

// Inicializa o Módulo
MICSocketManager.init();