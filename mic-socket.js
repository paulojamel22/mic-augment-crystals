class MICSocketManager {
  static init() {
    // Registra o Hook de renderização da ficha do item
    Hooks.on("renderItemSheet", (app, html, data) => {
      this._onRenderItemSheet(app, html, data);
    });
  }

  // Lógica para calcular o bônus total da arma/armadura
  static _getItemTotalBonus(item) {
    // No D35E, o dado costuma ficar em system.enhancement (direto) 
    // ou dentro de sub-objetos dependendo da versão do sistema.
    const bonus = item.system.enhancement || 
                  item.system.armor?.enhancement || 
                  item.system.weapon?.enhancement || 0;
    
    // Também vamos verificar se o item está marcado como 'Masterwork' na ficha
    const isMasterworkField = item.system.masterwork || false;

    console.log(`MIC Socket | Debug bônus de ${item.name}:`, {
      enhancement: bonus,
      isMasterwork: isMasterworkField
    });

    return {
      enhancement: bonus,
      isMasterwork: isMasterworkField
    };
  }

  // O "Cérebro" da regra do Magic Item Compendium
  static _canEquipCrystal(crystal, targetItem) {
    const itemData = this._getItemTotalBonus(targetItem);
    const itemBonus = itemData.enhancement || 0;
    const crystalName = crystal.name.toLowerCase();
    const crystalType = crystal.getFlag("mic-socket-system", "crystalType");
    // Um item é considerado válido para cristais se tiver bônus > 0 OU for Masterwork
    const isValidBase = itemData.isMasterwork || itemBonus > 0;

    if (crystalType === "armor" && targetItem.type !== "equipment") {
        return { valid: false, error: "Este cristal só pode ser usado em Armaduras." };
    }

    // Regra: Least (Menor) -> Exige Masterwork
    if (crystalName.includes("least")) {
      if (!isValidBase) return { valid: false, error: "Cristais 'Least' exigem um item de Obra-Prima." };
    }

    // Regra: Lesser (Inferior) -> Exige Bônus Mágico +1
    if (crystalName.includes("lesser")) {
      if (itemBonus < 1) return { valid: false, error: "Cristais 'Lesser' exigem bônus mágico de pelo menos +1." };
    }

    // Regra: Greater (Maior) -> Exige Bônus Mágico +3
    if (crystalName.includes("greater")) {
      if (itemBonus < 3) return { valid: false, error: "Cristais 'Greater' exigem bônus mágico de pelo menos +3." };
    }

    return { valid: true };
  }

  static async _onRenderItemSheet(app, html, data) {
    // 1. Validação de tipo
    const item = app.item;
    
    // 1. Validação de tipo (Armas e Armaduras)
    if (!["weapon", "equipment"].includes(item.type)) return;

    // NOVO: Se o item for um cristal, ele não pode ter um soquete
    // Checamos a flag ou se o nome contém "Crystal"
    const isCrystal = item.getFlag("mic-socket-system", "isCrystal");
    if (isCrystal) return;

    // 2. BUSCA O ALVO EXATO: 
    // Na ficha do D35E, '.item-properties' pode aparecer em vários lugares.
    // Vamos tentar ser mais específicos ou garantir que só apareça no topo.
    const propertyList = html.find(".item-properties");
    
    // Se o nosso container já existir nesta renderização, paramos por aqui
    if (html.find(".mic-socket-container").length > 0) return;

    // 3. Recuperar Dados do Cristal (Flags)
    const socketedCrystalUuid = item.getFlag("mic-socket-system", "crystalUuid");
    let crystalDisplayName = "Vazio";
    let crystalImg = "";

    if (socketedCrystalUuid) {
      const crystal = await fromUuid(socketedCrystalUuid);
      if (crystal) {
        crystalDisplayName = crystal.name;
        crystalImg = `<img src="${crystal.img}" class="mic-socket-img" />`;
      }
    }

    // 4. Preparar o HTML
    const socketHtml = `
      <div class="mic-socket-container">
        <label class="mic-socket-label">Augment Crystal:</label>
        <div class="mic-socket-slot" id="mic-drop-zone" data-item-id="${item.id}">
            ${crystalImg || '<i class="fas fa-gem" style="color: #444;"></i>'}
        </div>
        <span class="mic-socket-name">${crystalDisplayName}</span>
        ${socketedCrystalUuid ? '<i class="fas fa-times mic-socket-remove" title="Remover"></i>' : ''}
      </div>
    `;

    // 5. INJEÇÃO CONTROLADA:
    // Em vez de append, vamos garantir que ele entre apenas no primeiro bloco de propriedades
    propertyList.first().after(socketHtml); 

    // 6. Bind dos Eventos
    html.find("#mic-drop-zone").on("drop", (event) => this._onCrystalDrop(event, item));
    html.find(".mic-socket-remove").on("click", (event) => {
        event.stopPropagation(); // Evita disparar cliques indesejados na ficha
        this._removeCrystal(item);
    });
  }

  static async _onCrystalDrop(event, targetItem) { // Mudamos 'weapon' para 'targetItem' para ser genérico
    event.preventDefault();
    const data = JSON.parse(event.originalEvent.dataTransfer.getData("text/plain"));
    
    if (data.type !== "Item") return;

    // 1. Primeiro buscamos o item arrastado
    const droppedItem = await fromUuid(data.uuid);
    if (!droppedItem) return;

    // 2. Agora verificamos as flags (o droppedItem já existe aqui)
    const isCrystal = droppedItem.getFlag("mic-socket-system", "isCrystal") 
                     || droppedItem.name.toLowerCase().includes("crystal");
    const crystalType = droppedItem.getFlag("mic-socket-system", "crystalType");

    if (!isCrystal) {
        ui.notifications.warn("Isso não parece ser um Augment Crystal!");
        return;
    }

    // 3. Validação de Compatibilidade (Arma vs Armadura)
    if (crystalType === "armor" && targetItem.type !== "equipment") {
        ui.notifications.error("Este cristal só pode ser acoplado em Armaduras!");
        return;
    }
    if (crystalType === "weapon" && targetItem.type !== "weapon") {
        ui.notifications.error("Este cristal só pode ser acoplado em Armas!");
        return;
    }

    // 4. Executar regra de negócio do MIC (+1, +3, Masterwork)
    const validation = this._canEquipCrystal(droppedItem, targetItem);
    if (!validation.valid) {
        ui.notifications.error(validation.error);
        return; 
    }

    // 5. Salvar e Forçar atualização da ficha
    await targetItem.setFlag("mic-socket-system", "crystalUuid", data.uuid);
    
    // Como não temos 'app' aqui, buscamos a janela aberta para dar o render
    Object.values(ui.windows).forEach(w => {
        if (w.item?.id === targetItem.id) w.render(true);
    });

    ui.notifications.info(`Sucesso: ${droppedItem.name} acoplado a ${targetItem.name}.`);
  }

  static async _removeCrystal(weapon) {
    // 1. Remove a flag do item (banco de dados)
    await weapon.unsetFlag("mic-socket-system", "crystalUuid");
    
    ui.notifications.info(`Cristal removido de ${weapon.name}`);

    // 2. IMPORTANTE: O Foundry dnd35 as vezes precisa de um empurrãozinho 
    // para atualizar a ficha após mudar uma flag via script.
    // O comando abaixo força a atualização da ficha aberta.
    Object.values(ui.windows).forEach(app => {
        if (app.item?.id === weapon.id) app.render(true);
    });
  }
}

// Inicializa a classe
MICSocketManager.init();