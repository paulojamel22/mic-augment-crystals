/**
 * MICSocketManager - Gerencia o sistema de Augment Crystals (Magic Item Compendium)
 * Compatível com Foundry VTT v13 e sistema D35E.
 */
class MICSocketManager {
  
  static init() {
    console.log("MIC Socket | Inicializando sistema de cristais...");

    // Registra o hook para renderização das folhas de itens
    Hooks.on("renderItemSheet", (app, html, data) => {
      // Compatibilidade v13: garante objeto JQuery
      const jqHtml = html instanceof HTMLElement ? $(html) : html;
      this._onRenderItemSheet(app, jqHtml, data);
    });

    // Hook para quando o módulo é carregado
    Hooks.once("ready", () => {
      console.log("MIC Socket | Sistema de cristais pronto para uso.");
      // Adiciona botão de criação no menu do GM
      this._addGMTools();
    });
  }

  /**
   * Adiciona ferramentas para o GM no menu
   */
  static _addGMTools() {
    // Adiciona opção no menu do GM para criar cristais
    const createCrystalButton = `
      <button id="mic-create-crystal" class="mic-gm-button">
        <i class="fas fa-plus"></i> Criar Cristal Augment
      </button>
    `;

    // Adiciona ao menu do GM (se estiver no menu principal)
    Hooks.on("getSceneControlButtons", (controls) => {
      if (game.user.isGM) {
        controls.find(c => c.name === "token").tools.push({
          name: "createCrystal",
          title: "Criar Cristal Augment",
          icon: "fas fa-plus",
          onClick: () => this._openCrystalCreationDialog(),
          active: false,
          toggle: false
        });
      }
    });
  }

  /**
   * Abre o diálogo para criação de cristal
   */
  static _openCrystalCreationDialog() {
    const crystalTypes = ["weapon", "armor", "ring", "amulet", "shield"];
    const crystalRanks = ["least", "lesser", "greater", "major", "superior"];
    const crystalElements = ["fire", "water", "earth", "air", "light", "dark", "none"];
    const crystalRarities = ["common", "uncommon", "rare", "epic", "legendary"];

    new Dialog({
      title: "Criar Cristal Augment",
      content: `
        <div class="mic-crystal-form">
          <div class="form-group">
            <label>Nome do Cristal:</label>
            <input type="text" id="crystal-name" placeholder="Ex: Cristal Menor de Força">
          </div>
          <div class="form-group">
            <label>Tipo:</label>
            <select id="crystal-type">
              ${crystalTypes.map(type => `<option value="${type}">${this._getCrystalTypeName(type)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Rank:</label>
            <select id="crystal-rank">
              ${crystalRanks.map(rank => `<option value="${rank}">${this._getCrystalRankName(rank)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Elemento:</label>
            <select id="crystal-element">
              ${crystalElements.map(el => `<option value="${el}">${this._getElementName(el)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Raridade:</label>
            <select id="crystal-rarity">
              ${crystalRarities.map(rarity => `<option value="${rarity}">${this._getRarityName(rarity)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Bônus de Aprimoramento:</label>
            <input type="number" id="crystal-bonus" min="0" max="10" value="0">
          </div>
          <div class="form-group">
            <label>Efeitos Especiais:</label>
            <textarea id="crystal-effects" placeholder="Efeitos separados por vírgula"></textarea>
          </div>
        </div>
      `,
      buttons: {
        create: {
          label: "Criar Cristal",
          callback: (html) => this._createCrystalFromForm(html)
        },
        cancel: {
          label: "Cancelar"
        }
      },
      default: "create"
    }).render(true);
  }

  /**
   * Cria o cristal com base nos dados do formulário
   */
  static async _createCrystalFromForm(html) {
    const name = html.find("#crystal-name").val().trim();
    const type = html.find("#crystal-type").val();
    const rank = html.find("#crystal-rank").val();
    const element = html.find("#crystal-element").val();
    const rarity = html.find("#crystal-rarity").val();
    const bonus = parseInt(html.find("#crystal-bonus").val()) || 0;
    const effects = html.find("#crystal-effects").val().split(',').map(e => e.trim()).filter(e => e);

    if (!name) {
      ui.notifications.error("Por favor, informe um nome para o cristal.");
      return;
    }

    try {
      const crystalData = {
        name: name,
        type: "loot",
        system: {
          "mic-socket-system.crystal": {
            isCrystal: true,
            crystalType: type,
            crystalRank: rank,
            enhancementBonus: bonus,
            specialEffects: effects,
            element: element,
            rarity: rarity,
            crystalColor: this._getCrystalColor(rank),
            description: `Cristal ${this._getCrystalRankName(rank)} de ${this._getCrystalTypeName(type)}`
          }
        },
        img: this._getCrystalImage(type, rank)
      };

      const createdItem = await Item.create(crystalData, { renderSheet: true });
      ui.notifications.info(`Cristal "${name}" criado com sucesso!`);
      console.log("Cristal criado:", createdItem);
    } catch (error) {
      console.error("Erro ao criar cristal:", error);
      ui.notifications.error("Erro ao criar cristal. Verifique o console.");
    }
  }

  /**
   * Retorna o nome legível do tipo de cristal
   */
  static _getCrystalTypeName(type) {
    const names = {
      "weapon": "Arma",
      "armor": "Armadura",
      "ring": "Anel",
      "amulet": "Amuleto",
      "shield": "Escudo"
    };
    return names[type] || type;
  }

  /**
   * Retorna o nome legível do rank do cristal
   */
  static _getCrystalRankName(rank) {
    const names = {
      "least": "Menor",
      "lesser": "Menor",
      "greater": "Maior",
      "major": "Maior",
      "superior": "Superior"
    };
    return names[rank] || rank;
  }

  /**
   * Retorna o nome legível do elemento
   */
  static _getElementName(element) {
    const names = {
      "fire": "Fogo",
      "water": "Água",
      "earth": "Terra",
      "air": "Ar",
      "light": "Luz",
      "dark": "Escuridão",
      "none": "Nenhum"
    };
    return names[element] || element;
  }

  /**
   * Retorna o nome legível da raridade
   */
  static _getRarityName(rarity) {
    const names = {
      "common": "Comum",
      "uncommon": "Incomum",
      "rare": "Raro",
      "epic": "Épico",
      "legendary": "Lendário"
    };
    return names[rarity] || rarity;
  }

  /**
   * Retorna a cor do cristal baseado no rank
   */
  static _getCrystalColor(rank) {
    const colors = {
      "least": "#888888",
      "lesser": "#4444ff",
      "greater": "#ff4444",
      "major": "#ff8800",
      "superior": "#ff00ff"
    };
    return colors[rank] || "#ffffff";
  }

  /**
   * Retorna a imagem do cristal baseado no tipo e rank
   */
  static _getCrystalImage(type, rank) {
    const baseImages = {
      "weapon": "icons/weapons/swords/sword-leafed-gold.webp",
      "armor": "icons/equipment/chest/armor-banded-leather.webp",
      "ring": "icons/jewelry/rings/ring-simple-gold.webp",
      "amulet": "icons/jewelry/necklaces/necklace-simple-gold.webp",
      "shield": "icons/equipment/shield/wooden-shield.webp"
    };
    
    return baseImages[type] || "icons/svg/gem.svg";
  }

  /**
   * Identifica se um item é um cristal válido baseado no Nome e Origem.
   */
  static _identifyCrystal(item) {
    // Verificação de segurança contra itens nulos
    if (!item || !item.name) return null;
    
    const name = item.name.toLowerCase();
    // Estrutura: ID_DO_MODULO.NOME_DO_PACK (definidos no module.json)
    const expectedPack = "mic-augment-crystals.mic-augment-crystals";
    
    const isFromCompendium = item.flags?.core?.sourceId?.includes(expectedPack) || 
                             item.pack === expectedPack;
    
    // Verificamos a flag usando o ID oficial do módulo
    const isCrystal = name.includes("crystal") || 
                     item.getFlag("mic-augment-crystals", "isCrystal") ||
                     item.system?.["mic-socket-system.crystal"]?.isCrystal;

    if (!isCrystal || !isFromCompendium) return null;

    let rank = "least";
    if (name.includes("lesser")) rank = "lesser";
    if (name.includes("greater")) rank = "greater";
    if (name.includes("major")) rank = "major";
    if (name.includes("superior")) rank = "superior";

    let type = "weapon";
    const armorKeywords = ["restful", "stamina", "shielding", "warding", "armor", "shield", "shield"];
    if (armorKeywords.some(key => name.includes(key))) type = "armor";

    return { rank, type };
  }

  static _getItemTotalBonus(item) {
    // Verificação de segurança
    if (!item || !item.system) return { enhancement: 0, isMasterwork: false };
    
    const system = item.system;
    const enhancement = system.enhancement ?? 
                        system.armor?.enhancement ?? 
                        system.weapon?.enhancement ?? 0;
    
    const isMasterwork = system.masterwork || system.quality === "masterwork";

    return { enhancement, isMasterwork };
  }

  static _canEquipCrystal(crystal, targetItem) {
    // Verificação de segurança
    if (!crystal || !targetItem) {
      return { valid: false, error: "Item inválido para equipamento." };
    }

    const info = this._identifyCrystal(crystal);
    if (!info) return { valid: false, error: "Apenas cristais do Compendium oficial do MIC são aceitos." };

    // Restrição: só pode ser colocado em armas ou armaduras
    if (!["weapon", "equipment"].includes(targetItem.type)) {
      return { valid: false, error: "Cristais e runas só podem ser colocados em armas ou armaduras." };
    }

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
    
    if (info.rank === "lesser" && enhancement < 2) 
      return { valid: false, error: "Cristais 'Lesser' exigem bônus mágico +2." };
    
    if (info.rank === "greater" && enhancement < 3) 
      return { valid: false, error: "Cristais 'Greater' exigem bônus mágico +3." };

    return { valid: true };
  }

  static async _onRenderItemSheet(app, html, data) {
    // Verificação de segurança
    if (!app || !app.item) return;
    
    const item = app.item;

    // Restrição: só mostrar o slot em armas ou armaduras
    if (!["weapon", "equipment"].includes(item.type)) return;
    
    // Não mostrar slot para cristais em si
    if (this._identifyCrystal(item)) return; 
    
    // Evitar duplicação de elementos
    if (html.find(".mic-socket-container").length > 0) return;

    // Recupera usando o ID 'mic-augment-crystals'
    const crystalUuid = item.getFlag("mic-augment-crystals", "crystalUuid");
    let crystalDisplay = { name: "Vazio", img: "" };

    if (crystalUuid) {
      try {
        const crystal = await fromUuid(crystalUuid);
        if (crystal) {
          crystalDisplay = { 
            name: crystal.name, 
            img: `<img src="${crystal.img}" class="mic-socket-img" />` 
          };
        }
      } catch (error) {
        console.warn("Erro ao carregar cristal:", error);
      }
    }

    const socketHtml = `
      <div class="mic-socket-container">
        <label class="mic-socket-label">Augment Crystal:</label>
        <div class="mic-socket-slot" id="mic-drop-zone">
            ${crystalDisplay.img || '<i class="fas fa-gem" style="color: #444; font-size: 24px;"></i>'}
        </div>
        <span class="mic-socket-name">${crystalDisplay.name}</span>
        ${crystalUuid ? '<i class="fas fa-times mic-socket-remove" title="Remover Cristal"></i>' : ''}
      </div>
    `;

    const target = html.find(".item-properties").first();
    if (target.length) target.after(socketHtml);
    else html.find(".sheet-body").prepend(socketHtml);

    // Adiciona eventos com verificação de segurança
    try {
      html.find("#mic-drop-zone").on("drop", (e) => this._onCrystalDrop(e, item));
      html.find(".mic-socket-remove").on("click", (e) => {
        e.stopPropagation();
        this._removeCrystal(item);
      });
    } catch (error) {
      console.error("Erro ao adicionar eventos:", error);
    }
  }

  static async _onCrystalDrop(event, targetItem) {
    event.preventDefault();
    
    // Verificação de segurança
    if (!targetItem) return;

    const data = TextEditor.getDragEventData(event);
    if (data.type !== "Item") return;

    const droppedItem = await fromUuid(data.uuid);
    if (!droppedItem) {
      ui.notifications.error("Item não encontrado para equipamento.");
      return;
    }

    // Verificação adicional: só permite em armas ou armaduras
    if (!["weapon", "equipment"].includes(targetItem.type)) {
      ui.notifications.error("Cristais e runas só podem ser colocados em armas ou armaduras.");
      return;
    }

    const validation = this._canEquipCrystal(droppedItem, targetItem);
    if (!validation.valid) {
      ui.notifications.error(validation.error);
      return;
    }

    try {
      await targetItem.setFlag("mic-augment-crystals", "crystalUuid", data.uuid);
      this._refreshWindow(targetItem.id);
      ui.notifications.info(`${droppedItem.name} acoplado com sucesso!`);
    } catch (error) {
      console.error("Erro ao equipar cristal:", error);
      ui.notifications.error("Erro ao equipar cristal. Verifique o console.");
    }
  }

  static async _removeCrystal(item) {
    // Verificação de segurança
    if (!item) return;

    try {
      await item.unsetFlag("mic-augment-crystals", "crystalUuid");
      this._refreshWindow(item.id);
      ui.notifications.info("Cristal removido.");
    } catch (error) {
      console.error("Erro ao remover cristal:", error);
      ui.notifications.error("Erro ao remover cristal.");
    }
  }

  static _refreshWindow(itemId) {
    try {
      Object.values(ui.windows)
        .filter(w => w.item?.id === itemId)
        .forEach(w => {
          if (w.render) w.render(true);
        });
    } catch (error) {
      console.error("Erro ao atualizar janela:", error);
    }
  }
}

// Inicializa o sistema
MICSocketManager.init();
