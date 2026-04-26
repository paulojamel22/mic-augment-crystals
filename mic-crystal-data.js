/**
 * DataModel para os Cristais do MIC Socket System.
 * Garante que todos os dados dos cristais sejam consistentes e validados.
 */
export class MICCrystalData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    
    return {
      // Identificação básica
      isCrystal: new fields.BooleanField({ 
        initial: true,
        label: "É Cristal",
        hint: "Indica se este item é um cristal augment"
      }),
      
      // Tipo de cristal
      crystalType: new fields.StringField({ 
        required: true, 
        choices: ["weapon", "armor", "ring", "amulet", "shield"],
        initial: "weapon",
        label: "Tipo de Cristal",
        hint: "Tipo de item que o cristal pode ser equipado"
      }),
      
      // Rank do cristal
      crystalRank: new fields.StringField({ 
        required: true, 
        choices: ["least", "lesser", "greater", "major", "superior"],
        initial: "least",
        label: "Rank do Cristal",
        hint: "Nível de poder do cristal"
      }),
      
      // Bônus de aprimoramento
      enhancementBonus: new fields.NumberField({ 
        initial: 0,
        min: 0,
        max: 10,
        label: "Bônus de Aprimoramento",
        hint: "Bônus de aprimoramento fornecido pelo cristal"
      }),
      
      // Efeitos especiais
      specialEffects: new fields.ArrayField(new fields.StringField(), {
        initial: [],
        label: "Efeitos Especiais",
        hint: "Efeitos especiais que o cristal proporciona"
      }),
      
      // Efeito de tipo específico
      effectType: new fields.StringField({ 
        choices: ["damage", "defense", "movement", "magic", "sight", "other"],
        initial: "other",
        label: "Tipo de Efeito",
        hint: "Tipo de efeito principal do cristal"
      }),
      
      // Nível de poder
      powerLevel: new fields.NumberField({ 
        initial: 1,
        min: 1,
        max: 10,
        label: "Nível de Poder",
        hint: "Nível de poder do cristal (1-10)"
      }),
      
      // Cor do cristal (para visual)
      crystalColor: new fields.StringField({ 
        initial: "#ffffff",
        label: "Cor do Cristal",
        hint: "Cor visual do cristal (hex code)"
      }),
      
      // Elemento (para jogos com elementos)
      element: new fields.StringField({ 
        choices: ["fire", "water", "earth", "air", "light", "dark", "none"],
        initial: "none",
        label: "Elemento",
        hint: "Elemento associado ao cristal"
      }),
      
      // Status de uso
      isActive: new fields.BooleanField({ 
        initial: false,
        label: "Ativo",
        hint: "Indica se o cristal está ativo no personagem"
      }),
      
      // Cooldown (tempo de recarga)
      cooldown: new fields.NumberField({ 
        initial: 0,
        label: "Cooldown (segundos)",
        hint: "Tempo de recarga em segundos"
      }),
      
      // Limites de uso
      maxUses: new fields.NumberField({ 
        initial: -1, // -1 = ilimitado
        min: -1,
        label: "Usos Máximos",
        hint: "Número máximo de usos (-1 = ilimitado)"
      }),
      
      // Usos atuais
      currentUses: new fields.NumberField({ 
        initial: 0,
        min: 0,
        label: "Usos Atuais",
        hint: "Número de usos atuais"
      }),
      
      // Descrição do cristal
      description: new fields.StringField({ 
        initial: "",
        label: "Descrição",
        hint: "Descrição detalhada do cristal"
      }),
      
      // Origem do cristal
      origin: new fields.StringField({ 
        initial: "compendium",
        choices: ["compendium", "quest", "loot", "crafted", "gift"],
        label: "Origem",
        hint: "Origem do cristal"
      }),
      
      // Raridade
      rarity: new fields.StringField({ 
        choices: ["common", "uncommon", "rare", "epic", "legendary"],
        initial: "common",
        label: "Raridade",
        hint: "Raridade do cristal"
      })
    };
  }
  
  static defineValidation() {
    return {
      crystalType: (value) => {
        const validTypes = ["weapon", "armor", "ring", "amulet", "shield"];
        if (!validTypes.includes(value)) {
          return `Tipo de cristal inválido: ${value}. Valores válidos: ${validTypes.join(", ")}`;
        }
        return true;
      },
      
      crystalRank: (value) => {
        const validRanks = ["least", "lesser", "greater", "major", "superior"];
        if (!validRanks.includes(value)) {
          return `Rank de cristal inválido: ${value}. Valores válidos: ${validRanks.join(", ")}`;
        }
        return true;
      },
      
      powerLevel: (value) => {
        if (value < 1 || value > 10) {
          return "Nível de poder deve estar entre 1 e 10";
        }
        return true;
      }
    };
  }
  
  /**
   * Valida se o cristal é válido para uso
   */
  isValid() {
    return this.isCrystal === true && 
           this.crystalType && 
           this.crystalRank;
  }
  
  /**
   * Retorna o nome completo do cristal
   */
  getFullDisplayName() {
    const rankNames = {
      "least": "Menor",
      "lesser": "Menor",
      "greater": "Maior",
      "major": "Maior",
      "superior": "Superior"
    };
    
    const typeNames = {
      "weapon": "Arma",
      "armor": "Armadura",
      "ring": "Anel",
      "amulet": "Amuleto",
      "shield": "Escudo"
    };
    
    return `${rankNames[this.crystalRank]} de ${typeNames[this.crystalType]}`;
  }
  
  /**
   * Verifica se o cristal pode ser usado em um tipo de item
   */
  canUseOnItemType(itemType) {
    if (this.crystalType === "weapon") {
      return itemType === "weapon";
    }
    if (this.crystalType === "armor" || this.crystalType === "shield") {
      return itemType === "equipment";
    }
    if (this.crystalType === "ring" || this.crystalType === "amulet") {
      return itemType === "equipment";
    }
    return false;
  }
}

// Registra o modelo no Foundry
Hooks.once('init', () => {
  CONFIG.Item.dataModels["mic-socket-system.crystal"] = MICCrystalData;
  console.log("MIC Socket | DataModel registrado com sucesso.");
});

// Exporta para uso em outros módulos
export default MICCrystalData;
