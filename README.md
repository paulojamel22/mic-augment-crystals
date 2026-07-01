# MIC - Augment Crystals (D&D 3.5e for Foundry VTT)

Este módulo implementa o sistema de **Augment Crystals** do livro *Magic Item Compendium*
(D&D 3.5e) para o sistema D35E no Foundry VTT. Ele permite que jogadores acoplem
cristais mágicos em armas, armaduras e escudos, respeitando as regras de pré-requisitos
de bônus de melhoria.

## ✨ Funcionalidades

* **Catálogo JSON-driven**: cristais definidos em `crystals/*.json`, carregados
  automaticamente em um compendium próprio (`MIC - Augment Crystals`).
* **Folders automáticos**: cada item é organizado por *família* (Weapon / Armor / Shield)
  e por *rank* (Least / Lesser / Greater).
* **Slot de Cristal Dinâmico**: cada arma, armadura ou escudo ganha um
  receptáculo visual na ficha para drag & drop de cristais.
* **Validação RAW**:
  - **Least:** exige Obra-Prima (masterwork) ou bônus de melhoria.
  - **Lesser:** exige bônus mínimo +1.
  - **Greater:** exige bônus mínimo +3.
* **Multi-família e multi-rank** no mesmo arquivo JSON (ex.: `adamant-armor.json`
  expande em 6 itens: 3 ranks × armor/shield).
* **Auto-cura**: items antigos `equipment` no compendium são recriados como
  `loot` (D35E 3.1 não renderiza crystals como equipment).
* **Preserva edições do GM**: modificações manuais em flags/algo que não sejam
  do namespace `mic-augment-crystals` não são sobrescritas.
* **Compatível Foundry v13/14** usando `findry.applications.ux.TextEditor.implementation`
  com fallback para o global deprecado.

## 🧪 Versão atual

**1.3.0** — adiciona **Crystal of Adaptation** (Armor / Least, Lesser, Greater),
com endure elements + protection contra alignment/extraplanar traits.

## 📦 Instalação

Duas formas suportadas:

### A) Instalação via Foundry (recomendado — usa o instalador interno)

1. No Foundry, abra o painel **Setup → Manage Modules**.
2. Clique em **Install Module**.
3. Em **Manifest URL**, cole:
   ```
   https://raw.githubusercontent.com/paulojamel22/mic-augment-crystals/main/module.json
   ```
4. Clique em **Install**. O Foundry baixa a versão atual direto da branch
   `main` (que já foi validada contra o Foundry 14).
5. Ative o módulo na sua configuração de mundo.
6. Reinicie a sessão.

> Para fixar em **v1.3.0** (recomendado), troque a Manifest URL para o
> tag Release:
>
> ```
> https://raw.githubusercontent.com/paulojamel22/mic-augment-crystals/v1.3.0/module.json
> ```
> (sem `/main/`, com `/v1.3.0/`).

### B) Download manual

1. Baixe o `.zip` da
   [página de release](https://github.com/paulojamel22/mic-augment-crystals/releases/tag/v1.2.0).
2. Extraia em `FoundryVTT/Data/modules/mic-augment-crystals/`.
3. Em **Manage Modules**, ative *Magic Item Compendium: Augment Crystals*.
4. Reinicie a sessão. O compendium `MIC - Augment Crystals` será populado na
   primeira inicialização.

## 📋 Cristais incluídos

* **Restful Crystal** (Armor / Least): dormir com armadura não causa Fadiga.
* **Crystal of Adamant Armor** (Armor & Shield / Least, Lesser, Greater): +
  Hardness à peça (2 / 5 / 10).
* **Clasp of Energy Protection** (Shield / Least, Lesser, Greater): 5 variantes
  (Fire, Cold, Acid, Electricity, Sonic) — concede Resistance 5/10/15 à peça.
* **Crystal of Adaptation** (Armor / Least, Lesser, Greater): proteção em
  camadas — `endure elements` no least; + todas as *alignment traits*
  (chaotic/good/etc.) no lesser; + *positive/negative-dominant traits*
  no greater.

Cada cristal respeita os pré-requisitos do MIC 3.5.

## 🛠️ Detalhes Técnicos

O módulo é construído com a API de Hooks do Foundry VTT. Principais arquivos:

* `mic-socket.js` — `MICSocketManager`, hooks de `renderItemSheet`,
  drag & drop, validação de regras.
* `mic-crystal-data.js` — `MICCrystalData` registra o DataModel
  `mic-socket-system.crystal`.
* `mic-loader.js` — varre `crystals/index.json` e cria/atualiza items no
  compendium `crystals` com persistência em Foundry v14 (creates folders,
  unlocks pack, populates items, preserva hashes).

### Lógica de Detecção de Bônus

Para garantir compatibilidade com a estrutura de dados do D35E 3.1, o bônus
de melhoria é procurado em múltiplos pontos:

```javascript
const enhancement = Number(
  system.enhancement
  ?? system.armor?.enh
  ?? system.shield?.enh
  ?? system.weapon?.enh
  ?? system.equipment?.enhancement
  ?? 0
);
```

O D35E 3.1.0 guarda o enhancement em subárvores diferentes (armor.shield.weapon)
dependendo do tipo de item.

## 📁 Estrutura

```
mic-augment-crystals/
├── mic-socket.js
├── mic-crystal-data.js
├── mic-loader.js
├── crystals/
│   ├── index.json
│   ├── restful-least.json
│   ├── adamant-armor.json              (multi-family + multi-rank)
│   ├── clasp-energy-{fire,cold,acid,electricity,sonic}-{least,lesser,greater}.json
├── packs/crystals/                     (LevelDB runtime, ignorado)
├── styles/mic-socket.css
└── module.json
```
