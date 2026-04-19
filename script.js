/* ============================================================
   PEPTIDECALC — CALCULATOR LOGIC
   ============================================================ */

let compoundCount = 1;
let activePreset  = null;

/* ============================================================
   PRESET DATA
   doseUnit: 'mg' | 'mcg' — controls Step 4 input unit label
   ============================================================ */
const PRESETS = {
    1: [
        {
            label:    'Retatrutide',
            sublabel: 'GLP-3 Triple Agonist',
            name:     'Retatrutide',
            doseUnit: 'mg',
            hint:     'Typically started at 0.5–2 mg per week and titrated upward based on tolerance. Common research doses range from 2–6 mg/week. Vial sizes vary — enter your specific amount above.',
        },
        {
            label:    'Tirzepatide',
            sublabel: 'GLP-1/GIP Dual Agonist',
            name:     'Tirzepatide',
            doseUnit: 'mg',
            hint:     'Starting doses commonly 2.5 mg/week, titrating up to 5–15 mg/week over several months. Titrate slowly based on individual tolerance. Vial sizes vary.',
        },
        {
            label:    'Tesamorelin',
            sublabel: 'GHRH Analog',
            name:     'Tesamorelin',
            doseUnit: 'mg',
            hint:     'Commonly researched at 1–2 mg/day subcutaneously. Most common vial size: 10 mg. Often used as a standalone GHRH without a GHRP.',
        },
        {
            label:    'MOTS-C',
            sublabel: 'Mitochondrial Peptide',
            name:     'MOTS-C',
            doseUnit: 'mg',
            hint:     'Commonly researched at 1–5 mg/day, 2–3× per week. Research doses vary — always start at the low end. Typical vial sizes: 5 mg or 10 mg.',
        },
        {
            label:    'NAD+',
            sublabel: 'Coenzyme',
            name:     'NAD+',
            doseUnit: 'mg',
            hint:     'Typically starts at 20 mg, 2–3× per week or daily. Common range: 20–100 mg. Most common vial size: 500 mg. Recommended: 5 mL BAC water (500 units) per 500 mg vial for easy dosing and reduced discomfort.',
        },
        {
            label:    'GHK-Cu',
            sublabel: 'Copper Peptide',
            name:     'GHK-Cu',
            doseUnit: 'mg',
            hint:     'Subcutaneous research doses: 1–2 mg/dose daily or every other day. Also widely used topically at much higher concentrations. Typical vial size: 50 mg.',
        },
        {
            label:    'BPC-157',
            sublabel: 'Healing Peptide',
            name:     'BPC-157',
            doseUnit: 'mcg',
            hint:     'Commonly researched at 250–500 mcg per injection, 1–2× daily. Often cycled 4–8 weeks on, 2–4 weeks off. Typical vial sizes: 5 mg or 10 mg.',
        },
        {
            label:    'Sermorelin',
            sublabel: 'GHRH Analog',
            name:     'Sermorelin',
            doseUnit: 'mcg',
            hint:     'Typical research doses: 200–500 mcg subcutaneously before bed. Often used in conjunction with a GHRP for synergistic effect. Typical vial size: 2 mg or 5 mg.',
        },
        {
            label:    'Other',
            sublabel: null,
            isOther:  true,
        },
    ],
    2: [
        {
            label:   'BPC-157 + TB-500',
            names:   ['BPC-157', 'TB-500'],
            amounts: [],
            isBlend: true,
            equalAmounts: true,
            hint:    'Both compounds are in equal mg amounts — every draw gives you the same mcg of each. Common amounts: 5/5 mg or 10/10 mg per vial.',
        },
        {
            label:   'CJC-1295 + Ipamorelin',
            names:   ['CJC-1295', 'Ipamorelin'],
            amounts: [],
            isBlend: true,
            equalAmounts: true,
            hint:    'Both compounds are in equal mg amounts — every draw gives you the same mcg of each. Most common configuration: 5/5 mg.',
        },
    ],
    3: [
        {
            label:   'GLOW',
            names:   ['BPC-157', 'TB-500', 'GHK-Cu'],
            amounts: ['10', '10', '50'],
            isBlend: true,
        },
    ],
    4: [
        {
            label:   'KLOW',
            names:   ['BPC-157', 'TB-500', 'GHK-Cu', 'KPV'],
            amounts: ['10', '10', '50', '10'],
            isBlend: true,
        },
    ],
};

/* ============================================================
   INIT
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initDropdown();
    renderFields(1);
    document.getElementById('calc-btn').addEventListener('click', calculate);
    document.getElementById('bac-water').addEventListener('input', onBacWaterChange);
    initLoadButtons();
});

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
   DROPDOWN — replaces compound count pills + preset buttons
   ============================================================ */
function initDropdown() {
    buildDropdown();

    const sel = document.getElementById('compound-select');
    sel.addEventListener('change', () => {
        const val = sel.value;
        if (!val) return;
        hideResult();

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

        /* Encoded as "count-index" e.g. "1-0", "3-0" */
        const dashIdx = val.indexOf('-');
        const count   = parseInt(val.slice(0, dashIdx));
        const idx     = parseInt(val.slice(dashIdx + 1));
        const preset  = PRESETS[count]?.[idx];
        if (!preset) return;

        compoundCount = count;
        activePreset  = preset;   /* set BEFORE renderFields so dose unit is correct */
        hideCustomBlendRow();
        renderFields(count);
        applyPreset(preset);
    });

    /* Custom blend count picker */
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

    /* Single compounds group */
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

    /* Common blends group */
    const blendGroup = document.createElement('optgroup');
    blendGroup.label = 'Common Blends';
    [2, 3, 4].forEach(count => {
        (PRESETS[count] || []).forEach((p, i) => {
            const opt = document.createElement('option');
            opt.value = `${count}-${i}`;
            opt.textContent = `${p.label}  (${p.names.join(' + ')})`;
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

/* Set the dropdown to a specific value without triggering the change handler */
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
    }

    hideResult();
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

    /* Known amounts (GLOW, KLOW) — build dose table */
    const bacWater       = parseFloat(document.getElementById('bac-water').value) || 2;
    const usingDefault   = !document.getElementById('bac-water').value;
    const names          = activePreset.names;
    const amounts_mg     = activePreset.amounts.map(Number);
    const concentrations = amounts_mg.map(mg => (mg * 1000) / bacWater);

    const unitRows = [5, 10, 15, 20, 25];
    const cols     = names.length + 1;
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
    `;
    hint.classList.remove('hidden');
}

function clearDoseHint() {
    const hint = document.getElementById('dose-hint');
    if (hint) hint.classList.add('hidden');
}

function onBacWaterChange() {
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

    /* Peptide amount fields */
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

    /* Step 4 */
    if (count === 1) {
        /* Determine dose unit from active preset; show toggle for unlisted compounds */
        const doseUnit  = activePreset?.doseUnit || null;
        const unitLabel = doseUnit || 'mcg';
        const showToggle = !doseUnit; /* only when "Other / Not Listed" */

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
    } else {
        step4Title.textContent = 'Draw Amount';
        doseContainer.innerHTML = `
            <div class="field solo">
                <label class="field-label" for="units-draw">How many units are you drawing?</label>
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
        const doseInput    = document.getElementById('dose-single');
        const doseUnit     = doseInput?.dataset.unit || 'mcg';
        const doseEntered  = parseFloat(doseInput?.value);
        if (!doseEntered || doseEntered <= 0) return showError('Please enter your desired dose.');
        const dose_mcg     = doseUnit === 'mg' ? doseEntered * 1000 : doseEntered;

        const { name, concentration } = compounds[0];
        const volume_ml = dose_mcg / concentration;
        showResultsSingle({ name, dose_mcg, concentration, volume_ml, units: volume_ml * 100 });
    } else {
        const units = parseFloat(document.getElementById('units-draw')?.value);
        if (!units || units <= 0) return showError('Please enter the number of units you plan to draw.');
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
function showResultsSingle({ name, dose_mcg, concentration, volume_ml, units }) {
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
    `;
    showResultBox();
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
    `;
    showResultBox();
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
}

function hideResult() {
    document.getElementById('result-box').classList.add('hidden');
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

            if (count === 1) {
                /* Single compound — find matching preset by name */
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
                    if (preset) showSingleHint(preset.hint);
                    else showOtherHint();
                    switchTab('calculator');
                });

            } else {
                /* Blend */
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
