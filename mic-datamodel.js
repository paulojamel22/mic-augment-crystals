/**
 * DataModel para os Cristais. 
 * Isso garante que 'isCrystal' seja sempre booleano e 'crystalType' seja validado.
 */
export class MICCrystalData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      isCrystal: new fields.BooleanField({ initial: true }),
      crystalType: new fields.StringField({ 
        required: true, 
        choices: ["weapon", "armor"], 
        initial: "weapon" 
      }),
      crystalRank: new fields.StringField({ 
        required: true, 
        choices: ["least", "lesser", "greater"], 
        initial: "least" 
      })
    };
  }
}

// Registra o modelo no Foundry
Hooks.once('init', () => {
  CONFIG.Item.dataModels["mic-socket-system.crystal"] = MICCrystalData;
  console.log("MIC Socket | DataModel registrado com sucesso.");
});