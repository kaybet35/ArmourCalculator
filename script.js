/* =====================================================
   CONSTANTS
   Tier multipliers: "0" (no bonus) = ×1.0, T1 = ×1.1, T2 = ×1.2, T3 = ×1.3
   Base health and stability are both treated as 100 for EHP calculations.
   ===================================================== */

const BASE_VALUE = 100;

/** Crafting cost data keyed by item value. */
const ITEM_COSTS = {
    common_garment:    { "Linen": 2, "Fibre": 3 },
    common_bottoms:    { "Linen": 1, "Fibre": 1 },
    heavy_helmet:      { "Fire Clay": 2, "Rare Metals": 3, "Linen": 1, "Tanned Thick Leather": 1, "Iron Armour Plating": 1 },
    reinforced_helmet: { "Fibre": 2, "Iron Armour Plating": 1, "Thick Leather": 2 },
    light_helmet:      { "Fibre": 2, "Bronze Armour Plating": 1, "Thin Leather": 2 },
    heavy_chest:       { "Fire Clay": 5, "Rare Metals": 6, "Linen": 1, "Tanned Thick Leather": 2, "Iron Armour Plating": 2 },
    reinforced_chest:  { "Fibre": 3, "Iron Armour Plating": 2, "Thick Leather": 3 },
    light_chest:       { "Fibre": 3, "Bronze Armour Plating": 2, "Thin Leather": 3 },
    heavy_leg:         { "Fire Clay": 2, "Rare Metals": 3, "Linen": 1, "Tanned Thick Leather": 1, "Iron Armour Plating": 1 },
    reinforced_leg:    { "Fibre": 2, "Iron Armour Plating": 1, "Thick Leather": 2 },
    light_leg:         { "Fibre": 2, "Bronze Armour Plating": 1, "Thin Leather": 2 },
    auxiliary_helmet:  {},
    auxiliary_chest:   {},
    auxiliary_leg:     {},
    none:              {}
};

/** Image filenames for each material used in the cost breakdown UI. */
const MATERIAL_ICONS = {
    "Iron Armour Plating":   "ArmourPlatingIron.png",
    "Bronze Armour Plating": "IconArmourPlatingBronze.png",
    "Fibre":                 "IconFibre.png",
    "Thin Leather":          "IconLeatherCured.png",
    "Linen":                 "IconLinen.png",
    "Thick Leather":         "IconProcessedThickLeather.png",
    "Fire Clay":             "IconResourceClay.png",
    "Rare Metals":           "IconResourceRareMetal.png",
    "Tanned Thick Leather":  "IconResourceThickLeatherTanned.png"
};

/** Display groupings for the cost breakdown list. */
const MATERIAL_GROUPS = {
    "Rare Items": ["Rare Metals", "Fire Clay"],
    "Platings":   ["Bronze Armour Plating", "Iron Armour Plating"],
    "Leathers":   ["Tanned Thick Leather", "Thick Leather", "Thin Leather"],
    "Plants":     ["Fibre", "Linen"]
};

/* =====================================================
   STATE
   ===================================================== */

/** The loadout name currently used as the comparison baseline, or null. */
let comparisonBaselineName = null;

/** 'A' = Ancient faction, 'R' = Remnant faction (affects armour icon variants). */
let currentAlliance = 'A';

/* =====================================================
   CORE CALCULATION
   ===================================================== */

/**
 * Given a config object (keyed by slot ID), returns the combined stats and
 * aggregated crafting costs.
 *
 * @param {Object} config  - Map of slotId → { value, tier, mit, stab }
 * @returns {{ mitigation: number, stability: number, ehp: number, est: number, costs: Object }}
 */
function getStatsAndCosts(config) {
    let damageTakenMult      = 1.0;
    let stabilityReductionMult = 1.0;
    const totalMaterials     = {};

    Object.values(config).forEach(({ value, tier, mit, stab }) => {
        damageTakenMult        *= (1 - mit  * tier);
        stabilityReductionMult *= (1 - stab * tier);

        const costs = ITEM_COSTS[value] || {};
        for (const mat in costs) {
            totalMaterials[mat] = (totalMaterials[mat] || 0) + costs[mat];
        }
    });

    return {
        mitigation: (1 - damageTakenMult)        * 100,
        stability:  (1 - stabilityReductionMult)  * 100,
        ehp:        BASE_VALUE / damageTakenMult,
        est:        BASE_VALUE / stabilityReductionMult,
        costs:      totalMaterials
    };
}

/* =====================================================
   DOM HELPERS
   ===================================================== */

/**
 * Reads the current active selections from every .slot in the DOM and
 * returns a config object.
 *
 * @returns {Object} config map
 */
function getCurrentConfig() {
    const config = {};

    document.querySelectorAll('.slot').forEach(slot => {
        const slotId     = slot.getAttribute('data-slot-id');
        const activeItem = slot.querySelector('.armor-icons .active');
        const activeTier = slot.querySelector('.tier-icons .active');

        config[slotId] = {
            value: activeItem.getAttribute('data-value'),
            tier:  parseFloat(activeTier.getAttribute('data-tier')),
            mit:   parseFloat(activeItem.getAttribute('data-mit'))  / 100,
            stab:  parseFloat(activeItem.getAttribute('data-stab')) / 100
        };
    });

    return config;
}

/**
 * Updates a single delta indicator element.
 *
 * @param {string}  id            - Element ID
 * @param {number}  diff          - Current value minus baseline value
 * @param {string}  unit          - Unit suffix (e.g. '%' or '')
 * @param {boolean} highIsBetter  - When true, a positive diff is shown green
 */
function updateDelta(id, diff, unit, highIsBetter) {
    const el = document.getElementById(id);

    if (Math.abs(diff) < 0.01) {
        el.textContent = '';
        el.className   = 'delta';
        return;
    }

    const isPositive = highIsBetter ? diff > 0 : diff < 0;
    el.className  = `delta ${isPositive ? 'pos' : 'neg'}`;
    el.textContent = `(${diff > 0 ? '+' : ''}${diff.toFixed(2)}${unit})`;
}

/* =====================================================
   UPDATE LOOP
   ===================================================== */

/** Recalculates all stats and re-renders the results panel and cost list. */
function updateAll() {
    const current  = getStatsAndCosts(getCurrentConfig());

    // — Stats panel —
    document.getElementById('total-armour-mitigation').textContent    = current.mitigation.toFixed(2) + '%';
    document.getElementById('total-stability-mitigation').textContent = current.stability.toFixed(2)  + '%';
    document.getElementById('effective-health').textContent            = current.ehp.toFixed(1);
    document.getElementById('effective-stability').textContent         = current.est.toFixed(1);

    // — Delta indicators —
    document.querySelectorAll('.delta').forEach(d => {
        d.textContent = '';
        d.className   = 'delta';
    });

    const loadouts       = JSON.parse(localStorage.getItem('armor_loadouts') || '{}');
    let   baselineCosts  = {};

    if (comparisonBaselineName && loadouts[comparisonBaselineName]) {
        const baseline = getStatsAndCosts(loadouts[comparisonBaselineName]);
        baselineCosts  = baseline.costs;

        updateDelta('delta-mitigation', current.mitigation - baseline.mitigation, '%', true);
        updateDelta('delta-stability',  current.stability  - baseline.stability,  '%', true);
        updateDelta('delta-ehp',        current.ehp        - baseline.ehp,        '',  true);
        updateDelta('delta-est',        current.est        - baseline.est,        '',  true);
    }

    // — Cost list —
    renderCostList(current.costs, baselineCosts);
}

/**
 * Rebuilds the material cost <ul> with optional diff indicators against a
 * baseline loadout.
 *
 * @param {Object} currentMats   - Current loadout material counts
 * @param {Object} baselineMats  - Baseline loadout material counts (may be empty)
 */
function renderCostList(currentMats, baselineMats) {
    const materialList = document.getElementById('material-list');
    materialList.innerHTML = '';

    Object.entries(MATERIAL_GROUPS).forEach(([groupName, groupItems]) => {
        const hasItems = groupItems.some(
            mat => (currentMats[mat] || 0) > 0 || (baselineMats[mat] || 0) > 0
        );
        if (!hasItems) return;

        // Group header
        const header = document.createElement('li');
        header.className = 'cost-group-header';
        header.innerHTML = `<b>${groupName}</b>`;
        materialList.appendChild(header);

        // Material rows
        groupItems.forEach(mat => {
            const count  = currentMats[mat]  || 0;
            const bCount = baselineMats[mat] || 0;
            if (count === 0 && bCount === 0) return;

            const diff      = count - bCount;
            const iconFile  = MATERIAL_ICONS[mat] || '';
            const iconHtml  = iconFile
                ? `<img src="${iconFile}" class="material-icon" alt="${mat}">`
                : '';

            // Costs: more materials = worse (diff > 0 is neg/red, diff < 0 is pos/green)
            const diffHtml = comparisonBaselineName
                ? ` <span class="delta ${diff > 0 ? 'neg' : diff < 0 ? 'pos' : ''}">(${diff > 0 ? '+' : ''}${diff})</span>`
                : '';

            const li = document.createElement('li');
            li.innerHTML = `<span>${iconHtml}${mat}</span><span><b>${count}</b>${diffHtml}</span>`;
            materialList.appendChild(li);
        });
    });

    if (materialList.innerHTML === '') {
        materialList.innerHTML = '<li><span>Free</span></li>';
    }
}

/* =====================================================
   LOADOUT MANAGEMENT
   ===================================================== */

/** Renders the saved loadouts chip list. */
function renderLoadouts() {
    const listContainer = document.getElementById('loadout-list');
    listContainer.innerHTML = '';

    const loadouts = JSON.parse(localStorage.getItem('armor_loadouts') || '{}');

    Object.keys(loadouts).forEach(name => {
        const chip = document.createElement('div');
        chip.className = 'loadout-chip';
        chip.innerHTML = `
            <span class="loadout-name">${name}</span>
            <span class="btn-compare ${comparisonBaselineName === name ? 'active' : ''}">VS</span>
            <span class="btn-delete">×</span>
        `;

        chip.onclick = (e) => {
            if (e.target.classList.contains('btn-delete')) {
                if (comparisonBaselineName === name) comparisonBaselineName = null;
                delete loadouts[name];
                localStorage.setItem('armor_loadouts', JSON.stringify(loadouts));
                renderLoadouts();
                updateAll();
            } else if (e.target.classList.contains('btn-compare')) {
                comparisonBaselineName = (comparisonBaselineName === name) ? null : name;
                renderLoadouts();
                updateAll();
            } else {
                applyLoadout(loadouts[name]);
            }
        };

        listContainer.appendChild(chip);
    });
}

/**
 * Applies a saved loadout config to the DOM, updating active states and
 * showing/hiding tier rows accordingly.
 *
 * @param {Object} config - Loadout config map (slotId → slot data)
 */
function applyLoadout(config) {
    Object.keys(config).forEach(slotId => {
        const slot    = document.querySelector(`.slot[data-slot-id="${slotId}"]`);
        const tierRow = slot.querySelector('.tier-row');

        // Deactivate everything in this slot first
        slot.querySelectorAll('.icon-item, .tier-item').forEach(item => {
            item.classList.remove('active');
        });

        // Re-activate the correct icon item
        slot.querySelectorAll('.icon-item').forEach(item => {
            if (item.getAttribute('data-value') === config[slotId].value) {
                item.classList.add('active');
            }
        });

        // Re-activate the correct tier item
        slot.querySelectorAll('.tier-item').forEach(item => {
            if (item.getAttribute('data-tier') === config[slotId].tier.toString()) {
                item.classList.add('active');
            }
        });

        // Show or hide the tier row based on the loaded item
        const activeVal = slot.querySelector('.icon-item.active').getAttribute('data-value');
        tierRow.style.display = (activeVal.startsWith('auxiliary_') || activeVal === 'none')
            ? 'none'
            : 'flex';
    });

    updateAll();
}

/* =====================================================
   DEFAULT LOADOUTS INITIALIZATION
   ===================================================== */

/**
 * Reads the base mit/stab values for a given item from the DOM so that
 * default loadouts stay in sync with the HTML data attributes.
 *
 * @param {string} slotId
 * @param {string} value
 * @returns {{ value: string, mit: number, stab: number }}
 */
function getUiData(slotId, value) {
    const item = document.querySelector(`.slot[data-slot-id="${slotId}"] [data-value="${value}"]`);
    return {
        value,
        mit:  item ? parseFloat(item.getAttribute('data-mit'))  / 100 : 0,
        stab: item ? parseFloat(item.getAttribute('data-stab')) / 100 : 0
    };
}

/**
 * Seeds localStorage with default loadouts if they do not already exist.
 * Runs once on page load.
 */
function initializeDefaultLoadouts() {
    const loadouts = JSON.parse(localStorage.getItem('armor_loadouts') || '{}');

    const noneChest = getUiData('chest-clothing', 'none');
    const noneLeg   = getUiData('leg-clothing',   'none');

    const defaults = {
        'Clothing': {
            'chest-clothing': { ...getUiData('chest-clothing', 'common_garment'),          tier: 1.3 },
            'leg-clothing':   { ...getUiData('leg-clothing',   'common_bottoms'),          tier: 1.3 },
            'helmet':         { ...getUiData('helmet',      'none'),                       tier: 1   },
            'chest-armor':    { ...getUiData('chest-armor', 'none'),                       tier: 1   },
            'leg-armor':      { ...getUiData('leg-armor',   'none'),                       tier: 1   }
        },
        'Aux': {
            'chest-clothing': { ...noneChest,                                              tier: 1   },
            'leg-clothing':   { ...noneLeg,                                                tier: 1   },
            'helmet':         { ...getUiData('helmet',      'auxiliary_helmet'),           tier: 1   },
            'chest-armor':    { ...getUiData('chest-armor', 'auxiliary_chest'),            tier: 1   },
            'leg-armor':      { ...getUiData('leg-armor',   'auxiliary_leg'),              tier: 1   }
        },
        'Aux Clothing': {
            'chest-clothing': { ...getUiData('chest-clothing', 'common_garment'),          tier: 1.3 },
            'leg-clothing':   { ...getUiData('leg-clothing',   'common_bottoms'),          tier: 1.3 },
            'helmet':         { ...getUiData('helmet',      'auxiliary_helmet'),           tier: 1   },
            'chest-armor':    { ...getUiData('chest-armor', 'auxiliary_chest'),            tier: 1   },
            'leg-armor':      { ...getUiData('leg-armor',   'auxiliary_leg'),              tier: 1   }
        },
        'Light': {
            'chest-clothing': { ...noneChest,                                              tier: 1   },
            'leg-clothing':   { ...noneLeg,                                                tier: 1   },
            'helmet':         { ...getUiData('helmet',      'light_helmet'),               tier: 1.3 },
            'chest-armor':    { ...getUiData('chest-armor', 'light_chest'),                tier: 1.3 },
            'leg-armor':      { ...getUiData('leg-armor',   'light_leg'),                  tier: 1.3 }
        },
        'Light Clothing': {
            'chest-clothing': { ...getUiData('chest-clothing', 'common_garment'),          tier: 1.3 },
            'leg-clothing':   { ...getUiData('leg-clothing',   'common_bottoms'),          tier: 1.3 },
            'helmet':         { ...getUiData('helmet',          'light_helmet'),           tier: 1.3 },
            'chest-armor':    { ...getUiData('chest-armor',     'light_chest'),            tier: 1.3 },
            'leg-armor':      { ...getUiData('leg-armor',       'light_leg'),              tier: 1.3 }
        },
        'Reinforced': {
            'chest-clothing': { ...noneChest,                                              tier: 1   },
            'leg-clothing':   { ...noneLeg,                                                tier: 1   },
            'helmet':         { ...getUiData('helmet',      'reinforced_helmet'),          tier: 1.3 },
            'chest-armor':    { ...getUiData('chest-armor', 'reinforced_chest'),           tier: 1.3 },
            'leg-armor':      { ...getUiData('leg-armor',   'reinforced_leg'),             tier: 1.3 }
        },
        'Reinforced Clothing': {
            'chest-clothing': { ...getUiData('chest-clothing', 'common_garment'),          tier: 1.3 },
            'leg-clothing':   { ...getUiData('leg-clothing',   'common_bottoms'),          tier: 1.3 },
            'helmet':         { ...getUiData('helmet',         'reinforced_helmet'),       tier: 1.3 },
            'chest-armor':    { ...getUiData('chest-armor',    'reinforced_chest'),        tier: 1.3 },
            'leg-armor':      { ...getUiData('leg-armor',      'reinforced_leg'),          tier: 1.3 }
        },
        'Aux/Heavy': {
            'chest-clothing': { ...noneChest,                                              tier: 1   },
            'leg-clothing':   { ...noneLeg,                                                tier: 1   },
            'helmet':         { ...getUiData('helmet',      'auxiliary_helmet'),           tier: 1   },
            'chest-armor':    { ...getUiData('chest-armor', 'heavy_chest'),                tier: 1.3 },
            'leg-armor':      { ...getUiData('leg-armor',   'auxiliary_leg'),              tier: 1   }
        },
        'Reinforced/Heavy': {
            'chest-clothing': { ...noneChest,                                              tier: 1   },
            'leg-clothing':   { ...noneLeg,                                                tier: 1   },
            'helmet':         { ...getUiData('helmet',      'reinforced_helmet'),          tier: 1.3 },
            'chest-armor':    { ...getUiData('chest-armor', 'heavy_chest'),                tier: 1.3 },
            'leg-armor':      { ...getUiData('leg-armor',   'reinforced_leg'),             tier: 1.3 }
        },
        'Heavy': {
            'chest-clothing': { ...noneChest,                                              tier: 1   },
            'leg-clothing':   { ...noneLeg,                                                tier: 1   },
            'helmet':         { ...getUiData('helmet',      'heavy_helmet'),               tier: 1.3 },
            'chest-armor':    { ...getUiData('chest-armor', 'heavy_chest'),                tier: 1.3 },
            'leg-armor':      { ...getUiData('leg-armor',   'heavy_leg'),                  tier: 1.3 }
        },
        'Heavy Clothing': {
            'chest-clothing': { ...getUiData('chest-clothing', 'common_garment'),          tier: 1.3 },
            'leg-clothing':   { ...getUiData('leg-clothing',   'common_bottoms'),          tier: 1.3 },
            'helmet':         { ...getUiData('helmet',          'heavy_helmet'),           tier: 1.3 },
            'chest-armor':    { ...getUiData('chest-armor',     'heavy_chest'),            tier: 1.3 },
            'leg-armor':      { ...getUiData('leg-armor',       'heavy_leg'),              tier: 1.3 }
        }
    };

    // Only write entries that do not already exist (preserve user edits)
    let changed = false;
    Object.entries(defaults).forEach(([name, config]) => {
        if (!loadouts[name]) {
            loadouts[name] = config;
            changed = true;
        }
    });

    if (changed) {
        localStorage.setItem('armor_loadouts', JSON.stringify(loadouts));
    }
}

/* =====================================================
   INTERACTION HANDLERS
   ===================================================== */

/** Handles clicks on armour icon items. */
document.querySelectorAll('.icon-item').forEach(el => {
    el.onclick = () => {
        // Deselect siblings in the same icon row
        el.parentElement.querySelectorAll('.active').forEach(a => a.classList.remove('active'));
        el.classList.add('active');

        const tierRow = el.closest('.slot').querySelector('.tier-row');
        const val     = el.getAttribute('data-value');

        // Auxiliary items and "none" do not use a tier multiplier
        if (val.startsWith('auxiliary_') || val === 'none') {
            tierRow.style.display = 'none';
            tierRow.querySelectorAll('.tier-item').forEach(t => t.classList.remove('active'));
            tierRow.querySelector('[data-tier="1"]').classList.add('active');
        } else {
            tierRow.style.display = 'flex';
        }

        updateAll();
    };
});

/** Handles clicks on tier items. */
document.querySelectorAll('.tier-item').forEach(el => {
    el.onclick = () => {
        el.parentElement.querySelectorAll('.active').forEach(a => a.classList.remove('active'));
        el.classList.add('active');
        updateAll();
    };
});

/** Save loadout button. */
document.getElementById('save-loadout').onclick = () => {
    const loadoutInput = document.getElementById('loadout-name');
    const name = loadoutInput.value.trim();
    if (!name) return;

    const loadouts = JSON.parse(localStorage.getItem('armor_loadouts') || '{}');
    loadouts[name] = getCurrentConfig();
    localStorage.setItem('armor_loadouts', JSON.stringify(loadouts));

    loadoutInput.value = '';
    renderLoadouts();
};

/** Alliance (faction) toggle button — swaps the _A / _R suffix on all armour icons. */
document.getElementById('alliance-toggle').onclick = () => {
    const oldSuffix = `_${currentAlliance}`;
    currentAlliance = currentAlliance === 'A' ? 'R' : 'A';
    const newSuffix = `_${currentAlliance}`;

    document.getElementById('alliance-toggle').textContent =
        currentAlliance === 'A' ? 'Ancient' : 'Remnant';

    document.querySelectorAll('.armor-icons img').forEach(img => {
        img.src = img.src.replace(oldSuffix, newSuffix);
    });
};

/* =====================================================
   INITIALISATION
   ===================================================== */

// Sync tier row visibility to match the default active icon in each slot
document.querySelectorAll('.slot').forEach(slot => {
    const activeVal = slot.querySelector('.icon-item.active').getAttribute('data-value');
    const tierRow   = slot.querySelector('.tier-row');
    if (tierRow) {
        tierRow.style.display =
            (activeVal.startsWith('auxiliary_') || activeVal === 'none') ? 'none' : 'flex';
    }
});

initializeDefaultLoadouts();
renderLoadouts();
updateAll();
