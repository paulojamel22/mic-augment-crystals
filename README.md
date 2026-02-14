# MIC - Augment Crystals (D&D 3.5e for Foundry VTT)

Este módulo implementa o sistema de **Augment Crystals** do livro *Magic Item Compendium* para o sistema D35E no Foundry VTT. Ele permite que jogadores acoplem cristais mágicos em armas e armaduras, respeitando as regras de pré-requisitos de bônus.

## ✨ Funcionalidades

* **Slot de Cristal Dinâmico:** Adiciona um receptáculo visual nas fichas de Armas e Armaduras.
* **Validação de Regras (RAW):** O sistema impede o acoplamento se os requisitos não forem atendidos:
    * **Least:** Requer item de Obra-Prima (Masterwork) ou bônus mágico.
    * **Lesser:** Requer bônus de melhoria mínimo de +1.
    * **Greater:** Requer bônus de melhoria mínimo de +3.
* **Interface Inteligente:** O slot identifica automaticamente se o item é uma arma ou armadura e bloqueia cristais incompatíveis.

## 🛠️ Detalhes Técnicos (Para Desenvolvedores)

O módulo foi construído utilizando a API de Hooks do Foundry VTT. A lógica principal reside na classe `MICSocketManager`, que intercepta a renderização da ficha do item (`renderItemSheet`).

### Lógica de Detecção de Bônus
Para garantir compatibilidade com a estrutura de dados do sistema D35E, o bônus de melhoria é extraído dinamicamente:
```javascript
const bonus = item.system.enhancement || 
              item.system.armor?.enhancement || 
              item.system.weapon?.enhancement || 0;