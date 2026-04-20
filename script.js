/* ============================================================
   PEPTIDECALC — CALCULATOR LOGIC
   ============================================================ */

let compoundCount = 1;
let activePreset  = null;
let bacUserEdited  = false;
let doseUserEdited = false;
let blendInputMode = 'units'; /* 'units' | 'dose' */

/* ============================================================
   PRESET DATA
   doseUnit: 'mg' | 'mcg'
   defaultDose: number (in doseUnit)
   typicalVialMg: number
   dosesPerWeek: number | null
   route: 'subq' | 'subq_or_iv' | 'intranasal_or_subq'
   ============================================================ */
const PRESETS = {
    1: [
        {
            label:        'Retatrutide',
            sublabel:     'GLP-3 Triple Agonist',
            name:         'Retatrutide',
            doseUnit:     'mg',
            defaultDose:  0.5,
            typicalVialMg: 10,
            dosesPerWeek: 1,
            route:        'subq',
            hint:         'Typically started at 0.5–2 mg per week and titrated upward based on tolerance. Common research doses range from 2–6 mg/week. Vial sizes vary — enter your specific amount above.',
        },
        {
            label:        'Tirzepatide',
            sublabel:     'GLP-1/GIP Dual Agonist',
            name:         'Tirzepatide',
            doseUnit:     'mg',
            defaultDose:  2.5,
            typicalVialMg: 10,
            dosesPerWeek: 1,
            route:        'subq',
            hint:         'Starting doses commonly 2.5 mg/week, titrating up to 5–15 mg/week over several months. Titrate slowly based on individual tolerance. Vial sizes vary.',
        },
        {
            label:        'Tesamorelin',
            sublabel:     'GHRH Analog',
            name:         'Tesamorelin',
            doseUnit:     'mg',
            defaultDose:  1,
            typicalVialMg: 10,
            dosesPerWeek: 7,
            route:        'subq',
            hint:         'Commonly researched at 1–2 mg/day subcutaneously. Most common vial size: 10 mg. Often used as a standalone GHRH without a GHRP.',
        },
        {
            label:        'MOTS-C',
            sublabel:     'Mitochondrial Peptide',
            name:         'MOTS-C',
            doseUnit:     'mg',
            defaultDose:  5,
            typicalVialMg: 10,
            dosesPerWeek: 2.5,
            route:        'subq',
            hint:         'Commonly researched at 1–5 mg/day, 2–3× per week. Research doses vary — always start at the low end. Typical vial sizes: 5 mg or 10 mg.',
        },
        {
            label:        'NAD+',
            sublabel:     'Coenzyme',
            name:         'NAD+',
            doseUnit:     'mg',
            defaultDose:  50,
            typicalVialMg: 500,
            dosesPerWeek: 4,
            route:        'subq_or_iv',
            hint:         'Typically starts at 20 mg, 2–3× per week or daily. Common range: 20–100 mg. Most common vial size: 500 mg. Recommended: 5 mL BAC water (500 units) per 500 mg vial for easy dosing and reduced discomfort.',
        },
        {
            label:        'GHK-Cu',
            sublabel:     'Copper Peptide',
            name:         'GHK-Cu',
            doseUnit:     'mg',
            defaultDose:  1,
            typicalVialMg: 50,
            dosesPerWeek: 7,
            route:        'subq',
            hint:         'Subcutaneous research doses: 1–2 mg/dose daily or every other day. Also widely used topically at much higher concentrations. Typical vial size: 50 mg.',
        },
        {
            label:        'BPC-157',
            sublabel:     'Healing Peptide',
            name:         'BPC-157',
            doseUnit:     'mcg',
            defaultDose:  250,
            typicalVialMg: 5,
            dosesPerWeek: 10.5,
            route:        'subq',
            hint:         'Commonly researched at 250–500 mcg per injection, 1–2× daily. Often cycled 4–8 weeks on, 2–4 weeks off. Typical vial sizes: 5 mg or 10 mg.',
        },
        {
            label:        'TB-500',
            sublabel:     'Systemic Recovery Peptide',
            name:         'TB-500',
            doseUnit:     'mg',
            defaultDose:  2,
            typicalVialMg: 5,
            dosesPerWeek: 2,
            route:        'subq',
            hint:         'Commonly researched at 2–2.5 mg twice per week for the first 4–6 weeks, then moving to a maintenance dose of 2–2.5 mg per month. Typical vial sizes: 5 mg or 10 mg.',
        },
        {
            label:        'CJC-1295',
            sublabel:     'GHRH Analog',
            name:         'CJC-1295',
            doseUnit:     'mcg',
            defaultDose:  200,
            typicalVialMg: 2,
            dosesPerWeek: 7,
            route:        'subq',
            hint:         'Commonly researched at 100–300 mcg per injection, 1–2× daily. Often paired with a GHRP like Ipamorelin for synergistic GH release. Typical vial sizes: 2 mg or 5 mg.',
        },
        {
            label:        'Ipamorelin',
            sublabel:     'GHRP / GH Secretagogue',
            name:         'Ipamorelin',
            doseUnit:     'mcg',
            defaultDose:  200,
            typicalVialMg: 2,
            dosesPerWeek: 7,
            route:        'subq',
            hint:         'Commonly researched at 100–300 mcg per injection, 1–3× daily. Considered one of the cleanest GHRPs with minimal cortisol or prolactin increase. Typical vial sizes: 2 mg or 5 mg.',
        },
        {
            label:        'KPV',
            sublabel:     'Anti-Inflammatory Tripeptide',
            name:         'KPV',
            doseUnit:     'mcg',
            defaultDose:  500,
            typicalVialMg: 5,
            dosesPerWeek: 7,
            route:        'subq',
            hint:         'Commonly researched at 500 mcg–1 mg per injection, daily. Shows strong anti-inflammatory and gut-healing properties. Typical vial sizes: 5 mg or 10 mg.',
        },
        {
            label:        'SS-31',
            sublabel:     'Mitochondrial Peptide',
            name:         'SS-31',
            doseUnit:     'mg',
            defaultDose:  2,
            typicalVialMg: 10,
            dosesPerWeek: 2.5,
            route:        'subq',
            hint:         'Commonly researched at 1–3 mg per injection, 2–3× per week. Targets mitochondrial membranes to reduce oxidative stress and support energy production. Typical vial sizes: 5 mg or 10 mg.',
        },
        {
            label:        'Sermorelin',
            sublabel:     'GHRH Analog',
            name:         'Sermorelin',
            doseUnit:     'mcg',
            defaultDose:  300,
            typicalVialMg: 5,
            dosesPerWeek: 7,
            route:        'subq',
            hint:         'Typical research doses: 200–500 mcg subcutaneously before bed. Often used in conjunction with a GHRP for synergistic effect. Typical vial sizes: 2 mg or 5 mg.',
        },
        {
            label:        'SELANK',
            sublabel:     'Anxiolytic Peptide',
            name:         'SELANK',
            doseUnit:     'mcg',
            defaultDose:  250,
            typicalVialMg: 5,
            dosesPerWeek: 7,
            route:        'intranasal_or_subq',
            hint:         'Common research dose: 250–3000 mcg per day, typically split into 1–3 subcutaneous or intranasal doses. Start low (250–300 mcg) to assess response. Common vial sizes: 5 mg, 10 mg.',
        },
        {
            label:        'SEMAX',
            sublabel:     'Nootropic Peptide',
            name:         'SEMAX',
            doseUnit:     'mcg',
            defaultDose:  300,
            typicalVialMg: 5,
            dosesPerWeek: 7,
            route:        'intranasal_or_subq',
            hint:         'Common research doses: 300–1000 mcg subcutaneously or intranasally, 1–2× daily. Often used in short cycles. Common vial sizes: 5 mg, 10 mg.',
        },
        {
            label:        'Kisspeptin-10',
            sublabel:     'Hormonal Peptide',
            name:         'Kisspeptin-10',
            doseUnit:     'mcg',
            defaultDose:  50,
            typicalVialMg: 2,
            dosesPerWeek: null,
            route:        'subq',
            hint:         'Research doses typically 50–100 mcg subcutaneously — timing and frequency are highly protocol-dependent. Common vial sizes: 2 mg, 5 mg.',
        },
        {
            label:        'PT-141',
            sublabel:     'Sexual Health Peptide',
            name:         'PT-141',
            doseUnit:     'mg',
            defaultDose:  1,
            typicalVialMg: 10,
            dosesPerWeek: null,
            route:        'subq',
            hint:         'Common research dose: 1–2 mg subcutaneously, 45–90 minutes before activity. Start at 0.5–1 mg to assess tolerance for nausea or flushing. Common vial size: 10 mg.',
        },
        {
            label:        'AOD-9604',
            sublabel:     'Fat Metabolism Fragment',
            name:         'AOD-9604',
            doseUnit:     'mcg',
            defaultDose:  300,
            typicalVialMg: 5,
            dosesPerWeek: 7,
            route:        'subq',
            hint:         'Commonly researched at 250–500 mcg/day subcutaneously, typically administered in a fasted state. Common vial size: 5 mg.',
        },
        {
            label:        'Glutathione',
            sublabel:     'Master Antioxidant',
            name:         'Glutathione',
            doseUnit:     'mg',
            defaultDose:  300,
            typicalVialMg: 600,
            dosesPerWeek: 4,
            route:        'subq_or_iv',
            hint:         'Common subcutaneous dose: 200–600 mg several times per week. IV protocols typically 400–1200 mg. Common vial sizes: 200 mg, 600 mg, 1200 mg.',
        },
        {
            label:    'Other',
            sublabel: null,
            isOther:  true,
        },
    ],
    2: [
        {
            label:        'BPC-157 + TB-500',
            names:        ['BPC-157', 'TB-500'],
            amounts:      [],
            isBlend:      true,
            equalAmounts: true,
            hint:         'Both compounds are in equal mg amounts — every draw gives you the same mcg of each. Common amounts: 5/5 mg or 10/10 mg per vial.',
        },
        {
            label:        'CJC-1295 + Ipamorelin',
            names:        ['CJC-1295', 'Ipamorelin'],
            amounts:      [],
            isBlend:      true,
            equalAmounts: true,
            hint:         'Both compounds are in equal mg amounts — every draw gives you the same mcg of each. Most common configuration: 5/5 mg.',
        },
    ],
    3: [
        {
            label:     'GLOW',
            names:     ['BPC-157', 'TB-500', 'GHK-Cu'],
            amounts:   ['10', '10', '50'],
            isBlend:   true,
            reconNote: 'Injection site irritation is common with this blend. Using 3 mL BAC water (more diluted) can help — 2–3 mL is the typical range.',
        },
    ],
    4: [
        {
            label:     'KLOW',
            names:     ['BPC-157', 'TB-500', 'GHK-Cu', 'KPV'],
            amounts:   ['10', '10', '50', '10'],
            isBlend:   true,
            reconNote: 'Injection site irritation is common with this blend. Using 3 mL BAC water (more diluted) can help — 2–3 mL is the typical range.',
        },
    ],
};

/* ============================================================
   INIT
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initDropdown();
    initTierAccordion();
    renderFields(1);
    document.getElementById('calc-btn').addEventListener('click', calculate);
    document.getElementById('bac-water').addEventListener('input', onBacWaterInput);
    initLoadButtons();
});

/* ============================================================
   TIER ACCORDION (Stacks page)
   ============================================================ */
function initTierAccordion() {
    document.querySelectorAll('.tier-header').forEach(header => {
        header.addEventListener('click', () => {
            header.closest('.tier-section').classList.toggle('collapsed');
        });
    });
}

/* ============================================================
   TABS
   ============================================================ */
function initTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });
}

function switchTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    document.querySelector(`.tab-btn[data-tab="${tabName}"]`).classList.add('active');
    document.getElementById(`tab-${tabName}`).classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ============================================================
   DROPDOWN
   ============================================================ */
function initDropdown() {
    buildDropdown();

    const sel = document.getElementById('compound-select');
    sel.addEventListener('change', () => {
        const val = sel.value;
        if (!val) return;
        hideResult();
        bacUserEdited  = false;
        doseUserEdited = false;

        if (val === 'other') {
            compoundCount = 1;
            activePreset  = null;
            hideCustomBlendRow();
            renderFields(1);
            showOtherHint();
            return;
        }

        if (val === 'custom-blend') {
            compoundCount = 2;
            activePreset  = null;
            showCustomBlendRow(2);
            renderFields(2);
            return;
        }

        const dashIdx = val.indexOf('-');
        const count   = parseInt(val.slice(0, dashIdx));
        const idx     = parseInt(val.slice(dashIdx + 1));
        const preset  = PRESETS[count]?.[idx];
        if (!preset) return;

        compoundCount = count;
        activePreset  = preset;
        hideCustomBlendRow();
        renderFields(count);
        applyPreset(preset);
    });

    document.querySelectorAll('#custom-count-group .pill').forEach(pill => {
        pill.addEventListener('click', () => {
            const count = parseInt(pill.dataset.count);
            compoundCount = count;
            activePreset  = null;
            document.querySelectorAll('#custom-count-group .pill').forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            renderFields(count);
            hideResult();
        });
    });
}

function buildDropdown() {
    const sel = document.getElementById('compound-select');
    sel.innerHTML = '<option value="" disabled selected>Choose a compound or blend…</option>';

    const singleGroup = document.createElement('optgroup');
    singleGroup.label = 'Single Compounds';
    PRESETS[1].forEach((p, i) => {
        if (p.isOther) return;
        const opt = document.createElement('option');
        opt.value = `1-${i}`;
        opt.textContent = p.sublabel ? `${p.label} — ${p.sublabel}` : p.label;
        singleGroup.appendChild(opt);
    });
    const otherOpt = document.createElement('option');
    otherOpt.value = 'other';
    otherOpt.textContent = 'Other / Not Listed';
    singleGroup.appendChild(otherOpt);
    sel.appendChild(singleGroup);

    const blendGroup = document.createElement('optgroup');
    blendGroup.label = 'Common Blends';
    [2, 3, 4].forEach(count => {
        (PRESETS[count] || []).forEach((p, i) => {
            const opt      = document.createElement('option');
            opt.value      = `${count}-${i}`;
            const namesStr = p.names.join(' + ');
            opt.textContent = p.label === namesStr ? p.label : `${p.label}  (${namesStr})`;
            blendGroup.appendChild(opt);
        });
    });
    const customOpt = document.createElement('option');
    customOpt.value = 'custom-blend';
    customOpt.textContent = 'Custom Blend  (2–4 compounds)';
    blendGroup.appendChild(customOpt);
    sel.appendChild(blendGroup);
}

function showCustomBlendRow(activeCount) {
    const row = document.getElementById('custom-blend-row');
    if (row) row.classList.remove('hidden');
    document.querySelectorAll('#custom-count-group .pill').forEach(p => {
        p.classList.toggle('active', parseInt(p.dataset.count) === activeCount);
    });
}

function hideCustomBlendRow() {
    const row = document.getElementById('custom-blend-row');
    if (row) row.classList.add('hidden');
}

function setDropdownValue(val) {
    const sel = document.getElementById('compound-select');
    if (sel) sel.value = val;
}

/* ============================================================
   APPLY PRESET
   ============================================================ */
function applyPreset(preset) {
    activePreset = preset;

    if (preset.isOther) {
        clearFields();
        showOtherHint();
        return;
    }

    if (preset.isBlend) {
        preset.names.forEach((name, i) => {
            const nameEl = document.getElementById(`name-${i + 1}`);
            const mgEl   = document.getElementById(`mg-${i + 1}`);
            if (nameEl) nameEl.value = name;
            if (mgEl && preset.amounts[i]) mgEl.value = preset.amounts[i];
        });
        updateBlendHint();
    } else {
        const nameEl = document.getElementById('name-1');
        if (nameEl) nameEl.value = preset.name || '';
        showSingleHint(preset.hint);

        /* Smart dose suggestion */
        if (preset.defaultDose && !doseUserEdited) {
            applyDoseSuggestion(preset);
        }

        /* BAC water auto-fill */
        if (preset.typicalVialMg && !bacUserEdited) {
            applyBacSuggestion(preset.typicalVialMg);
        }
    }

    hideResult();
}

function applyDoseSuggestion(preset) {
    const input = document.getElementById('dose-single');
    if (!input) return;
    input.value = preset.defaultDose;

    const wrap = document.getElementById('dose-suggestion');
    if (wrap) {
        wrap.textContent = 'Suggested starting dose — adjust as needed';
        wrap.classList.remove('hidden');
    }
}

function applyBacSuggestion(vialMg) {
    const bacInput = document.getElementById('bac-water');
    if (!bacInput) return;
    const suggested = suggestedBacWater(vialMg);
    bacInput.value = suggested;

    const wrap = document.getElementById('bac-suggestion');
    if (wrap) {
        wrap.textContent = 'Recommended for this vial size';
        wrap.classList.remove('hidden');
    }

    /* Update blend hint if applicable */
    if (activePreset && activePreset.isBlend && !activePreset.equalAmounts) {
        updateBlendHint();
    }
}

function suggestedBacWater(vialMg) {
    if (vialMg <= 5)  return 1;
    if (vialMg <= 20) return 2;
    return 5;
}

function clearFields() {
    for (let i = 1; i <= compoundCount; i++) {
        const n = document.getElementById(`name-${i}`);
        const m = document.getElementById(`mg-${i}`);
        if (n) n.value = '';
        if (m) m.value = '';
    }
}

/* ============================================================
   DOSE HINTS
   ============================================================ */
function showSingleHint(text) {
    const hint = document.getElementById('dose-hint');
    if (!hint || !text) { clearDoseHint(); return; }
    hint.innerHTML = `
        <div class="dose-hint-title">Typical Dosing — Reference Only</div>
        <div class="dose-hint-text">${escapeHtml(text)}</div>
    `;
    hint.classList.remove('hidden');
}

function showOtherHint() {
    const hint = document.getElementById('dose-hint');
    if (!hint) return;
    hint.innerHTML = `
        <div class="dose-hint-title">Need dosing information?</div>
        <div class="dose-hint-text">
            Check the <button class="hint-ref-link" onclick="switchTab('reference')">Reference tab →</button> for dose ranges on common peptides.
        </div>
    `;
    hint.classList.remove('hidden');
}

function updateBlendHint() {
    if (!activePreset || !activePreset.isBlend) return;
    const hint = document.getElementById('dose-hint');
    if (!hint) return;

    if (activePreset.equalAmounts || !activePreset.amounts.length) {
        hint.innerHTML = `
            <div class="dose-hint-title">How blended vials work</div>
            <div class="dose-hint-text">${escapeHtml(activePreset.hint || 'Enter the mg amounts above, add BAC water, then enter units to draw to see what you get of each compound.')}</div>
        `;
        hint.classList.remove('hidden');
        return;
    }

    const bacWater       = parseFloat(document.getElementById('bac-water').value) || 2;
    const usingDefault   = !document.getElementById('bac-water').value;
    const names          = activePreset.names;
    const amounts_mg     = activePreset.amounts.map(Number);
    const concentrations = amounts_mg.map(mg => (mg * 1000) / bacWater);

    const unitRows  = [5, 10, 15, 20, 25];
    const cols      = names.length + 1;
    const gridStyle = `grid-template-columns: repeat(${cols}, 1fr)`;

    const headerCells = ['Units drawn', ...names]
        .map(n => `<div class="dht-cell dht-header">${escapeHtml(n)}</div>`)
        .join('');

    const rows = unitRows.map((units, rowIdx) => {
        const vol    = units / 100;
        const isLast = rowIdx === unitRows.length - 1;
        const cells  = concentrations
            .map(c => `<div class="dht-cell${isLast ? ' dht-row-last' : ''}">${formatDose(c * vol)}</div>`)
            .join('');
        return `<div class="dht-cell dht-units${isLast ? ' dht-row-last' : ''}">${units}</div>${cells}`;
    }).join('');

    hint.innerHTML = `
        <div class="dose-hint-title">How much of each compound you get per draw</div>
        <p class="dose-hint-subtext">${
            usingDefault
                ? 'Calculated with 2 mL BAC water — enter your amount in Step 3 to update.'
                : `Calculated with ${bacWater} mL BAC water.`
        } "Units drawn" = units on a U-100 syringe (100 units = 1 mL).</p>
        <div class="dht-scroll">
            <div class="dht-grid" style="${gridStyle}">
                ${headerCells}${rows}
            </div>
        </div>
        <div class="dose-hint-note">This is a blended vial — every draw delivers all compounds at the same fixed ratio. You can't adjust one independently.</div>
        ${activePreset.reconNote ? `<div class="dose-hint-recon-note">${escapeHtml(activePreset.reconNote)}</div>` : ''}
    `;
    hint.classList.remove('hidden');
}

function clearDoseHint() {
    const hint = document.getElementById('dose-hint');
    if (hint) hint.classList.add('hidden');
}

function onBacWaterInput() {
    bacUserEdited = true;
    const wrap = document.getElementById('bac-suggestion');
    if (wrap) wrap.classList.add('hidden');

    if (activePreset && activePreset.isBlend && !activePreset.equalAmounts) {
        updateBlendHint();
    }
}

/* ============================================================
   DOSE UNIT TOGGLE (for "Other / Not Listed" compounds)
   ============================================================ */
function setDoseUnit(unit) {
    const input = document.getElementById('dose-single');
    const label = document.getElementById('dose-unit-label');
    if (input) {
        input.dataset.unit  = unit;
        input.placeholder   = unit === 'mg' ? 'e.g. 2' : 'e.g. 500';
    }
    if (label) label.textContent = unit;
    document.querySelectorAll('.unit-toggle-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.unit === unit);
    });
}

/* ============================================================
   RENDER FIELDS
   ============================================================ */
function renderFields(count) {
    const peptideContainer = document.getElementById('peptide-fields');
    const doseContainer    = document.getElementById('dose-fields');
    const step4Title       = document.getElementById('step4-title');

    peptideContainer.innerHTML = '';
    doseContainer.innerHTML    = '';

    for (let i = 1; i <= count; i++) {
        const group = document.createElement('div');
        group.className = 'compound-group';
        group.innerHTML = `
            ${count > 1 ? `<div class="compound-group-label">Compound ${i}</div>` : ''}
            <div class="compound-row">
                <div class="field">
                    <label class="field-label" for="name-${i}">Peptide Name</label>
                    <div class="input-wrap">
                        <input class="field-input" type="text" id="name-${i}"
                               placeholder="${defaultName(i, count)}" autocomplete="off">
                    </div>
                </div>
                <div class="field">
                    <label class="field-label" for="mg-${i}">Amount in Vial</label>
                    <div class="input-wrap">
                        <input class="field-input has-unit" type="number" id="mg-${i}"
                               placeholder="e.g. 5" min="0.01" step="0.01">
                        <span class="input-unit">mg</span>
                    </div>
                </div>
            </div>
        `;
        peptideContainer.appendChild(group);
    }

    if (count === 1) {
        const doseUnit   = activePreset?.doseUnit || null;
        const unitLabel  = doseUnit || 'mcg';
        const showToggle = !doseUnit;

        step4Title.textContent = 'Desired Dose';
        doseContainer.innerHTML = `
            <div class="field solo">
                <label class="field-label" for="dose-single">How much do you want to take?</label>
                <div class="input-wrap">
                    <input class="field-input has-unit" type="number" id="dose-single"
                           placeholder="${unitLabel === 'mg' ? 'e.g. 2' : 'e.g. 500'}"
                           min="0.0001" step="0.0001" data-unit="${unitLabel}">
                    <span class="input-unit" id="dose-unit-label">${unitLabel}</span>
                </div>
                <div id="dose-suggestion" class="field-suggestion hidden"></div>
                ${showToggle ? `
                <div class="unit-toggle" id="unit-toggle">
                    <span class="unit-toggle-label">Unit:</span>
                    <button class="unit-toggle-btn active" data-unit="mcg" onclick="setDoseUnit('mcg')">mcg</button>
                    <button class="unit-toggle-btn" data-unit="mg" onclick="setDoseUnit('mg')">mg</button>
                </div>
                ` : ''}
                <div id="dose-hint" class="dose-hint hidden"></div>
            </div>
        `;

        /* Attach user-edit listener for dose field */
        requestAnimationFrame(() => {
            const doseInput = document.getElementById('dose-single');
            if (doseInput) {
                doseInput.addEventListener('input', () => {
                    doseUserEdited = true;
                    const wrap = document.getElementById('dose-suggestion');
                    if (wrap) wrap.classList.add('hidden');
                });
            }
        });

    } else {
        step4Title.textContent = 'Draw Amount';

        /* Blend mode toggle */
        const toggleHtml = (activePreset && !activePreset.equalAmounts && activePreset.amounts?.length)
            ? `<div class="blend-mode-toggle">
                <button class="blend-mode-btn ${blendInputMode === 'units' ? 'active' : ''}" onclick="setBlendMode('units')">Units to Draw</button>
                <button class="blend-mode-btn ${blendInputMode === 'dose' ? 'active' : ''}" onclick="setBlendMode('dose')">Target Dose of Primary</button>
               </div>`
            : '';

        if (blendInputMode === 'dose' && activePreset && !activePreset.equalAmounts && activePreset.amounts?.length) {
            const primaryName = activePreset.names[0];
            doseContainer.innerHTML = `
                <div class="field solo">
                    <label class="field-label" for="dose-primary">Target dose of ${escapeHtml(primaryName)}</label>
                    ${toggleHtml}
                    <div class="input-wrap">
                        <input class="field-input has-unit" type="number" id="dose-primary"
                               placeholder="e.g. 250" min="0.001" step="0.001">
                        <span class="input-unit">mcg</span>
                    </div>
                    <span class="field-hint">Enter your desired dose of ${escapeHtml(primaryName)} — units to draw will be back-calculated from this.</span>
                    <div id="dose-hint" class="dose-hint hidden"></div>
                </div>
            `;
        } else {
            doseContainer.innerHTML = `
                <div class="field solo">
                    <label class="field-label" for="units-draw">How many units are you drawing?</label>
                    ${toggleHtml}
                    <div class="input-wrap">
                        <input class="field-input has-unit" type="number" id="units-draw"
                               placeholder="e.g. 10" min="0.1" step="0.1">
                        <span class="input-unit">units</span>
                    </div>
                    <span class="field-hint">With a blended vial every compound is dosed together — enter units to draw and see what you get of each.</span>
                    <div id="dose-hint" class="dose-hint hidden"></div>
                </div>
            `;
        }

        requestAnimationFrame(() => {
            if (activePreset) updateBlendHint();
        });
    }
}

function setBlendMode(mode) {
    blendInputMode = mode;
    renderFields(compoundCount);
    requestAnimationFrame(() => {
        if (activePreset) updateBlendHint();
    });
}

function defaultName(i, total) {
    if (total === 1) return 'e.g. BPC-157';
    const d = ['BPC-157', 'TB-500', 'GHK-Cu', 'KPV'];
    return d[i - 1] || `Compound ${i}`;
}

/* ============================================================
   CALCULATE
   ============================================================ */
function calculate() {
    const bacWater = parseFloat(document.getElementById('bac-water').value);
    if (!bacWater || bacWater <= 0) {
        return showError('Please enter the amount of bacteriostatic water you added (mL).');
    }

    const compounds = [];
    for (let i = 1; i <= compoundCount; i++) {
        const name = document.getElementById(`name-${i}`)?.value.trim() || `Compound ${i}`;
        const mg   = parseFloat(document.getElementById(`mg-${i}`)?.value);
        if (!mg || mg <= 0) return showError(`Please enter the vial amount (mg) for ${name}.`);
        compounds.push({ name, mg, concentration: (mg * 1000) / bacWater });
    }

    if (compoundCount === 1) {
        const doseInput   = document.getElementById('dose-single');
        const doseUnit    = doseInput?.dataset.unit || 'mcg';
        const doseEntered = parseFloat(doseInput?.value);
        if (!doseEntered || doseEntered <= 0) return showError('Please enter your desired dose.');
        const dose_mcg = doseUnit === 'mg' ? doseEntered * 1000 : doseEntered;

        const { name, mg, concentration } = compounds[0];
        const volume_ml = dose_mcg / concentration;
        const units     = volume_ml * 100;
        showResultsSingle({ name, mg, dose_mcg, concentration, volume_ml, units });

    } else {
        let units;

        if (blendInputMode === 'dose' && activePreset && !activePreset.equalAmounts && activePreset.amounts?.length) {
            const dosePrimaryInput = document.getElementById('dose-primary');
            const targetDose_mcg   = parseFloat(dosePrimaryInput?.value);
            if (!targetDose_mcg || targetDose_mcg <= 0) return showError('Please enter the target dose for the primary compound.');
            units = (targetDose_mcg / compounds[0].concentration) * 100;
        } else {
            units = parseFloat(document.getElementById('units-draw')?.value);
            if (!units || units <= 0) return showError('Please enter the number of units you plan to draw.');
        }

        const volume_ml = units / 100;
        showResultsBlend(
            compounds.map(c => ({ ...c, volume_ml, units, dose_mcg: c.concentration * volume_ml })),
            units, volume_ml
        );
    }
}

/* ============================================================
   RESULTS
   ============================================================ */
function showResultsSingle({ name, mg, dose_mcg, concentration, volume_ml, units }) {
    const content = document.getElementById('result-content');
    document.getElementById('result-box').classList.remove('error');

    content.innerHTML = `
        <div class="result-item">
            <div class="result-item-label">${escapeHtml(name)}</div>
            <div class="result-item-units">
                <span class="units-number">${formatUnits(units)}</span>
                <span class="units-label">units</span>
            </div>
            <div class="result-item-sub">
                ${formatDose(dose_mcg)} &nbsp;·&nbsp;
                ${volume_ml.toFixed(3)} mL &nbsp;·&nbsp;
                ${Math.round(concentration)} mcg/mL
            </div>
        </div>
        <div id="syringe-section" class="syringe-section"></div>
        <div id="vial-duration" class="vial-duration"></div>
    `;

    /* Build syringe */
    const syringeSec = document.getElementById('syringe-section');
    if (syringeSec) syringeSec.innerHTML = buildSyringe(units);

    /* Build vial duration */
    const durSec = document.getElementById('vial-duration');
    if (durSec) durSec.innerHTML = buildVialDuration(mg, dose_mcg, activePreset);

    showResultBox();
    buildAndShowDoseTable([{ name, concentration }], units);
    buildAndShowNextSteps(activePreset?.route || 'subq', units);
}

function showResultsBlend(results, units, volume_ml) {
    const content = document.getElementById('result-content');
    document.getElementById('result-box').classList.remove('error');

    const cards = results.map(r => `
        <div class="result-item">
            <div class="result-item-label">${escapeHtml(r.name)}</div>
            <div class="result-item-units">
                <span class="units-number">${formatDoseNumber(r.dose_mcg)}</span>
                <span class="units-label">${formatDoseUnit(r.dose_mcg)}</span>
            </div>
            <div class="result-item-sub">${Math.round(r.concentration)} mcg/mL</div>
        </div>
    `).join('');

    content.innerHTML = `
        <div class="blend-draw-summary">
            Drawing <strong>${formatUnits(units)} units</strong>
            <span class="blend-draw-ml">(${volume_ml.toFixed(3)} mL)</span> — dose per compound:
        </div>
        <div class="result-grid-inner">${cards}</div>
        <div id="syringe-section" class="syringe-section"></div>
    `;

    const syringeSec = document.getElementById('syringe-section');
    if (syringeSec) syringeSec.innerHTML = buildSyringe(units);

    showResultBox();
    buildAndShowDoseTable(results.map(r => ({ name: r.name, concentration: r.concentration })), units);
    buildAndShowNextSteps(activePreset?.route || 'subq', units);
}

function showResultBox() {
    const box = document.getElementById('result-box');
    box.classList.remove('hidden');
    box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function showError(msg) {
    const box     = document.getElementById('result-box');
    const content = document.getElementById('result-content');
    box.classList.add('error');
    content.innerHTML = `<div class="result-error">⚠ ${escapeHtml(msg)}</div>`;
    box.classList.remove('hidden');
    hideDoseTable();
    hideNextSteps();
}

function hideResult() {
    document.getElementById('result-box').classList.add('hidden');
    hideDoseTable();
    hideNextSteps();
}

/* ============================================================
   SYRINGE SVG
   ============================================================ */
function buildSyringe(units) {
    const OVER_MAX = units > 100;
    const UNDER_MIN = units < 1;
    const drawUnits = Math.min(Math.max(units, 0), 100);

    const BARREL_X = 48;
    const BARREL_Y = 24;
    const BARREL_W = 390;
    const BARREL_H = 28;
    const PX_PER_U = BARREL_W / 100;
    const fluidW   = drawUnits * PX_PER_U;

    /* Tick marks */
    let ticks = '';
    let labels = '';
    for (let u = 0; u <= 100; u += 5) {
        const x      = BARREL_X + u * PX_PER_U;
        const isTen  = u % 10 === 0;
        const h      = isTen ? 12 : 7;
        const yTop   = BARREL_Y + BARREL_H;
        ticks += `<line x1="${x}" y1="${yTop}" x2="${x}" y2="${yTop + h}" stroke="#2a3450" stroke-width="${isTen ? 1.5 : 1}"/>`;
        if (isTen && u > 0) {
            labels += `<text x="${x}" y="${yTop + h + 11}" text-anchor="middle" font-size="9" fill="#4e5a72" font-family="Inter,sans-serif">${u}</text>`;
        }
    }

    /* Callout arrow at draw point */
    const calloutX  = BARREL_X + drawUnits * PX_PER_U;
    const calloutY  = BARREL_Y - 4;
    const labelText = `${formatUnits(units)}u`;

    let warning = '';
    if (OVER_MAX) {
        warning = `<div class="syringe-warning syringe-warning--over">⚠ ${formatUnits(units)} units exceeds a standard U-100 syringe (100 units = 1 mL). Consider splitting into multiple injections or using a larger syringe.</div>`;
    } else if (UNDER_MIN) {
        warning = `<div class="syringe-warning syringe-warning--under">⚠ ${formatUnits(units)} units is a very small volume — consider adding more BAC water to make measurement easier.</div>`;
    }

    const svgW  = BARREL_X + BARREL_W + 60;
    const svgH  = 78;

    const svg = `
<svg class="syringe-svg" viewBox="0 0 ${svgW} ${svgH}" xmlns="http://www.w3.org/2000/svg" aria-label="Syringe diagram showing ${formatUnits(units)} units">
  <defs>
    <linearGradient id="fluid-grad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#00d4ff" stop-opacity="0.85"/>
      <stop offset="100%" stop-color="#0098cc" stop-opacity="0.7"/>
    </linearGradient>
    <linearGradient id="barrel-grad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#1b2240"/>
      <stop offset="100%" stop-color="#131929"/>
    </linearGradient>
    <clipPath id="barrel-clip">
      <rect x="${BARREL_X}" y="${BARREL_Y}" width="${BARREL_W}" height="${BARREL_H}" rx="4"/>
    </clipPath>
  </defs>

  <!-- Barrel background -->
  <rect x="${BARREL_X}" y="${BARREL_Y}" width="${BARREL_W}" height="${BARREL_H}" rx="4" fill="url(#barrel-grad)" stroke="#252d48" stroke-width="1.5"/>

  <!-- Fluid fill -->
  ${fluidW > 0 ? `<rect x="${BARREL_X}" y="${BARREL_Y}" width="${fluidW}" height="${BARREL_H}" rx="4" fill="url(#fluid-grad)" clip-path="url(#barrel-clip)"/>` : ''}

  <!-- Plunger end cap -->
  <rect x="${BARREL_X - 8}" y="${BARREL_Y - 4}" width="8" height="${BARREL_H + 8}" rx="2" fill="#252d48"/>

  <!-- Needle -->
  <rect x="${BARREL_X + BARREL_W}" y="${BARREL_Y + BARREL_H / 2 - 2}" width="42" height="4" rx="2" fill="#1b2240"/>
  <line x1="${BARREL_X + BARREL_W + 42}" y1="${BARREL_Y + BARREL_H / 2 - 2}" x2="${BARREL_X + BARREL_W + 52}" y2="${BARREL_Y + BARREL_H / 2}" stroke="#2a3450" stroke-width="1"/>

  <!-- Ticks & labels -->
  ${ticks}
  ${labels}

  <!-- Callout -->
  ${!OVER_MAX && !UNDER_MIN && drawUnits > 0 ? `
  <line x1="${calloutX}" y1="${BARREL_Y}" x2="${calloutX}" y2="${calloutY - 14}" stroke="#00d4ff" stroke-width="1.5" stroke-dasharray="3 2"/>
  <rect x="${calloutX - 18}" y="${calloutY - 26}" width="36" height="14" rx="4" fill="#00d4ff" opacity="0.15"/>
  <text x="${calloutX}" y="${calloutY - 16}" text-anchor="middle" font-size="10" font-weight="600" fill="#00d4ff" font-family="Inter,sans-serif">${labelText}</text>
  ` : ''}
</svg>`;

    return `<div class="syringe-wrap">${svg}${warning}</div>`;
}

/* ============================================================
   DOSE TABLE — "Dosing at a Glance"
   ============================================================ */
const DOSE_TABLE_ROWS = [5, 10, 15, 20, 25, 30, 40, 50];

function buildAndShowDoseTable(compounds, calculatedUnits) {
    const wrap = document.getElementById('dose-table-wrap');
    if (!wrap) return;

    const isMulti = compounds.length > 1;
    const closest = DOSE_TABLE_ROWS.reduce((best, u) =>
        Math.abs(u - calculatedUnits) < Math.abs(best - calculatedUnits) ? u : best,
        DOSE_TABLE_ROWS[0]
    );

    const headerCols = isMulti
        ? ['Units', ...compounds.map(c => escapeHtml(c.name))]
        : ['Units', 'Dose'];

    const headerHtml = headerCols
        .map((h, i) => `<div class="dtg-cell dtg-head${i === 0 ? ' dtg-units-col' : ''}">${h}</div>`)
        .join('');

    const rowsHtml = DOSE_TABLE_ROWS.map(u => {
        const vol        = u / 100;
        const isActive   = u === closest;
        const activeClass = isActive ? ' dtg-row-active' : '';

        if (isMulti) {
            const cells = compounds
                .map(c => `<div class="dtg-cell${activeClass}">${formatDose(c.concentration * vol)}</div>`)
                .join('');
            return `<div class="dtg-cell dtg-units-col${activeClass}">${u}</div>${cells}`;
        } else {
            const dose = formatDose(compounds[0].concentration * vol);
            return `<div class="dtg-cell dtg-units-col${activeClass}">${u}</div><div class="dtg-cell${activeClass}">${dose}</div>`;
        }
    }).join('');

    const colCount = headerCols.length;
    wrap.innerHTML = `
        <div class="dose-table-header">
            <span class="dose-table-title">Dosing at a Glance</span>
            <span class="dose-table-sub">Highlighted row = your current draw</span>
        </div>
        <div class="dose-table-grid" style="grid-template-columns: repeat(${colCount}, 1fr)">
            ${headerHtml}
            ${rowsHtml}
        </div>
    `;
    wrap.classList.remove('hidden');
    wrap.style.animation = 'none';
    requestAnimationFrame(() => {
        wrap.style.animation = '';
        wrap.classList.add('dose-table-fadein');
    });
}

function hideDoseTable() {
    const wrap = document.getElementById('dose-table-wrap');
    if (wrap) {
        wrap.classList.add('hidden');
        wrap.classList.remove('dose-table-fadein');
    }
}

/* ============================================================
   VIAL DURATION
   ============================================================ */
function buildVialDuration(vialMg, dose_mcg, preset) {
    if (!vialMg || !dose_mcg) return '';
    const doses = Math.floor((vialMg * 1000) / dose_mcg);
    if (doses < 1) return '';

    let weekStr = '';
    if (preset?.dosesPerWeek && preset.dosesPerWeek > 0) {
        const weeks = (doses / preset.dosesPerWeek).toFixed(1).replace(/\.0$/, '');
        weekStr = ` &nbsp;·&nbsp; ~${weeks} weeks`;
    }

    return `<div class="vial-duration-line">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        Vial contains ~${doses} doses${weekStr}
    </div>`;
}

/* ============================================================
   NEXT STEPS ACCORDION
   ============================================================ */
function getShowGuide() {
    return localStorage.getItem('pcalc_show_guide') === 'true';
}

function setShowGuide(val) {
    localStorage.setItem('pcalc_show_guide', val ? 'true' : 'false');
}

function buildAndShowNextSteps(route, units) {
    const wrap = document.getElementById('next-steps-wrap');
    if (!wrap) return;

    const alwaysShow = getShowGuide();

    let adminTitle, adminContent;
    if (route === 'subq_or_iv') {
        adminTitle   = 'Administration (SubQ or IV)';
        adminContent = `<p>Subcutaneous (SubQ) is most common for home use. Pinch skin at belly, thigh, or glute. Insert needle at 45°, inject slowly, withdraw.</p>
<p>IV protocols require sterile technique. If administered by a clinic, communicate your reconstitution math with the provider.</p>`;
    } else if (route === 'intranasal_or_subq') {
        adminTitle   = 'Administration (Intranasal or SubQ)';
        adminContent = `<p>Intranasal: transfer reconstituted solution to a nasal spray bottle. Tilt head back, insert tip into nostril, spray while inhaling gently. Alternate nostrils.</p>
<p>SubQ alternative: pinch skin at belly or thigh, insert at 45°, inject slowly.</p>`;
    } else {
        adminTitle   = 'Injection (SubQ)';
        adminContent = `<p>Pinch a fold of skin at the belly, thigh, or glute. Insert the insulin syringe needle at 45°, inject the solution slowly and steadily, then withdraw.</p>
<p>Rotate injection sites each time to reduce irritation.</p>`;
    }

    const bodyHtml = `
        <div class="next-steps-section">
            <div class="next-steps-section-title">1 — Preparation</div>
            <p>Wash hands. Wipe the vial top and your injection site with an alcohol swab. Let dry for 10–15 seconds.</p>
            <p>Draw ${formatUnits(units)} units of air into the syringe, inject into the vial to equalize pressure, then withdraw ${formatUnits(units)} units of solution.</p>
        </div>
        <div class="next-steps-section">
            <div class="next-steps-section-title">2 — ${escapeHtml(adminTitle)}</div>
            ${adminContent}
        </div>
        <div class="next-steps-section">
            <div class="next-steps-section-title">3 — Storage</div>
            <p>Reconstituted peptides should be refrigerated (2–8°C / 36–46°F) and used within 28–30 days. Keep away from light. Do not freeze after reconstitution.</p>
        </div>
        <label class="next-steps-always-show">
            <input type="checkbox" id="always-show-guide" ${alwaysShow ? 'checked' : ''} onchange="setShowGuide(this.checked)">
            Always show this guide
        </label>
    `;

    const isOpen = alwaysShow;

    wrap.innerHTML = `
        <button class="next-steps-toggle" onclick="toggleNextSteps(this)" aria-expanded="${isOpen}">
            <span>Injection Guide</span>
            <svg class="next-steps-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        <div class="next-steps-body" style="${isOpen ? '' : 'display:none'}">
            ${bodyHtml}
        </div>
    `;

    wrap.classList.remove('hidden');
}

function toggleNextSteps(btn) {
    const body = btn.nextElementSibling;
    const open = btn.getAttribute('aria-expanded') === 'true';
    btn.setAttribute('aria-expanded', !open);
    body.style.display = open ? 'none' : 'block';
    btn.querySelector('.next-steps-chevron').style.transform = open ? '' : 'rotate(180deg)';
}

function hideNextSteps() {
    const wrap = document.getElementById('next-steps-wrap');
    if (wrap) wrap.classList.add('hidden');
}

/* ============================================================
   LOAD BUTTONS (from Blends / Reference tabs)
   ============================================================ */
function initLoadButtons() {
    document.querySelectorAll('.load-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const count   = parseInt(btn.dataset.count);
            const names   = btn.dataset.names.split(',').map(s => s.trim());
            const amounts = btn.dataset.amounts ? btn.dataset.amounts.split(',').map(s => s.trim()) : [];

            hideResult();
            hideCustomBlendRow();
            bacUserEdited  = false;
            doseUserEdited = false;

            if (count === 1) {
                const presetIdx = (PRESETS[1] || []).findIndex(p => !p.isOther && p.name === names[0]);
                const preset    = presetIdx !== -1 ? PRESETS[1][presetIdx] : null;

                compoundCount = 1;
                activePreset  = preset;

                if (presetIdx !== -1) {
                    setDropdownValue(`1-${presetIdx}`);
                } else {
                    setDropdownValue('other');
                }

                renderFields(1);

                requestAnimationFrame(() => {
                    const nameEl = document.getElementById('name-1');
                    if (nameEl) nameEl.value = names[0];
                    if (preset) {
                        showSingleHint(preset.hint);
                        if (preset.defaultDose) applyDoseSuggestion(preset);
                        if (preset.typicalVialMg) applyBacSuggestion(preset.typicalVialMg);
                    } else {
                        showOtherHint();
                    }
                    switchTab('calculator');
                });

            } else {
                const presetIdx = (PRESETS[count] || []).findIndex(p =>
                    p.isBlend && p.names && p.names[0] === names[0]
                );
                const preset = presetIdx !== -1 ? PRESETS[count][presetIdx] : null;

                compoundCount = count;
                activePreset  = preset;

                if (presetIdx !== -1) {
                    setDropdownValue(`${count}-${presetIdx}`);
                } else {
                    setDropdownValue('custom-blend');
                    showCustomBlendRow(count);
                }

                renderFields(count);

                requestAnimationFrame(() => {
                    names.forEach((name, idx) => {
                        const nameEl = document.getElementById(`name-${idx + 1}`);
                        const mgEl   = document.getElementById(`mg-${idx + 1}`);
                        if (nameEl) nameEl.value = name;
                        if (mgEl && amounts[idx]) mgEl.value = amounts[idx];
                    });
                    if (preset) updateBlendHint();
                    switchTab('calculator');
                });
            }
        });
    });
}

/* ============================================================
   HELPERS
   ============================================================ */
function formatUnits(units) {
    if (units >= 100) return Math.round(units).toString();
    if (units >= 10)  return (Math.round(units * 10) / 10).toFixed(1);
    return (Math.round(units * 100) / 100).toFixed(2);
}

function formatDose(mcg) {
    if (mcg >= 1000) return `${+(mcg / 1000).toFixed(3).replace(/\.?0+$/, '')} mg`;
    return `${+(Math.round(mcg * 10) / 10)} mcg`;
}

function formatDoseNumber(mcg) {
    if (mcg >= 1000) return `${+(mcg / 1000).toFixed(2).replace(/\.?0+$/, '')}`;
    return `${+(Math.round(mcg * 10) / 10)}`;
}

function formatDoseUnit(mcg) { return mcg >= 1000 ? 'mg' : 'mcg'; }

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
