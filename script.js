/* ============================================================
   PEPTIDECALC — CALCULATOR LOGIC
   ============================================================ */

let compoundCount = 1;
let activePreset  = null;

/* ============================================================
   PRESET DATA
   ============================================================ */
const PRESETS = {
    1: [
        {
            label:    'Retatrutide',
            sublabel: 'GLP-3 Triple Agonist',
            name:     'Retatrutide',
            hint:     'Typically started at 0.5–2 mg per week and titrated upward based on tolerance. Common research doses range from 2–8 mg/week. Vial sizes vary — enter your specific amount above.',
        },
        {
            label:    'Tirzepatide',
            sublabel: 'GLP-1/GIP Dual Agonist',
            name:     'Tirzepatide',
            hint:     'Starting doses commonly 2.5 mg/week, titrating up to 5–15 mg/week over several months. Titrate slowly — allow 4 weeks at each level. Vial sizes vary.',
        },
        {
            label:    'Tesamorelin',
            sublabel: 'GHRH Analog',
            name:     'Tesamorelin',
            hint:     'Commonly researched at 1–2 mg/day subcutaneously. Common vial sizes: 1 mg or 2 mg. Often used as a standalone GHRH without a GHRP.',
        },
        {
            label:    'MOTS-C',
            sublabel: 'Mitochondrial Peptide',
            name:     'MOTS-C',
            hint:     'Commonly researched at 5–10 mg, 2–3× per week. Some protocols use up to 15 mg per dose. Typical vial sizes: 5 mg or 10 mg.',
        },
        {
            label:    'NAD+',
            sublabel: 'Coenzyme',
            name:     'NAD+',
            hint:     'Research doses vary widely — 100–500 mg subcutaneously. Use 3–5 mL BAC water to reduce injection site discomfort. Typical vial sizes: 100 mg, 250 mg, 500 mg.',
        },
        {
            label:    'GHK-Cu',
            sublabel: 'Copper Peptide',
            name:     'GHK-Cu',
            hint:     'Subcutaneous research doses: 1–2 mg/dose daily or every other day. Also widely used topically at much higher concentrations. Typical vial size: 50 mg.',
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
            amounts: [],          /* user enters mg — equal amounts, so dose is same for both */
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
    initCompoundSelector();
    renderPresets(1);   /* show presets on load for count=1 */
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
   COMPOUND COUNT SELECTOR
   ============================================================ */
function initCompoundSelector() {
    document.querySelectorAll('.pill[data-count]').forEach(pill => {
        pill.addEventListener('click', () => {
            const count = parseInt(pill.dataset.count);
            compoundCount = count;
            activePreset = null;
            document.querySelectorAll('.pill[data-count]').forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            renderPresets(count);
            renderFields(count);
            hideResult();
        });
    });
}

/* ============================================================
   PRESETS
   ============================================================ */
function renderPresets(count) {
    const group   = document.getElementById('preset-group');
    const buttons = document.getElementById('preset-buttons');
    const presets = PRESETS[count];

    if (!presets) { group.style.display = 'none'; return; }
    group.style.display = '';
    buttons.innerHTML = '';

    const label = group.querySelector('.preset-label');
    label.textContent = count === 1 ? 'Select your compound' : 'Select a common blend';

    presets.forEach(preset => {
        const btn = document.createElement('button');
        btn.className = 'preset-btn';
        btn.innerHTML = preset.sublabel
            ? `<span class="preset-btn-main">${preset.label}</span><span class="preset-btn-sub">${preset.sublabel}</span>`
            : `<span class="preset-btn-main">${preset.label}</span>`;

        btn.addEventListener('click', () => {
            document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            applyPreset(preset);
        });
        buttons.appendChild(btn);
    });
}

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
        /* single compound */
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

    /* For equal-amount blends where user enters mg, show a simple note */
    if (activePreset.equalAmounts || !activePreset.amounts.length) {
        hint.innerHTML = `
            <div class="dose-hint-title">How blended vials work</div>
            <div class="dose-hint-text">${escapeHtml(activePreset.hint || 'Enter the mg amounts above, add BAC water, then enter units to draw to see what you get of each compound.')}</div>
        `;
        hint.classList.remove('hidden');
        return;
    }

    /* Known amounts (GLOW, KLOW) — build dose table */
    const bacWater = parseFloat(document.getElementById('bac-water').value) || 2;
    const usingDefault = !document.getElementById('bac-water').value;
    const names        = activePreset.names;
    const amounts_mg   = activePreset.amounts.map(Number);
    const concentrations = amounts_mg.map(mg => (mg * 1000) / bacWater); /* mcg/mL */

    /* Pick sensible unit rows based on vial size */
    const maxMg  = Math.min(...amounts_mg);
    const maxUnits = Math.round((maxMg * 1000 / bacWater) * 0.4); /* ~40% of max conc */
    const unitRows = buildUnitRows(maxUnits);

    const cols = names.length + 1;
    const gridStyle = `grid-template-columns: repeat(${cols}, 1fr)`;

    const headerCells = ['Units', ...names]
        .map(n => `<div class="dht-cell dht-header">${escapeHtml(n)}</div>`)
        .join('');

    const rows = unitRows.map((units, rowIdx) => {
        const vol  = units / 100;
        const isLast = rowIdx === unitRows.length - 1;
        const cells = concentrations
            .map(c => `<div class="dht-cell${isLast ? ' dht-row-last' : ''}">${formatDose(c * vol)}</div>`)
            .join('');
        return `<div class="dht-cell dht-units${isLast ? ' dht-row-last' : ''}">${units} u</div>${cells}`;
    }).join('');

    hint.innerHTML = `
        <div class="dose-hint-title">
            What you get per draw${usingDefault ? ' — assuming 2 mL BAC water (update above to recalculate)' : ` — ${bacWater} mL BAC water`}
        </div>
        <div class="dht-grid" style="${gridStyle}">
            ${headerCells}
            ${rows}
        </div>
        <div class="dose-hint-note">Every draw delivers all compounds at this fixed ratio. Adjust BAC water above to update the table.</div>
    `;
    hint.classList.remove('hidden');
}

function buildUnitRows(maxUnits) {
    /* Generate 4–5 evenly spaced unit amounts from low to maxUnits */
    if (maxUnits <= 0) return [5, 10, 15, 20];
    const step  = Math.max(5, Math.round(maxUnits / 4 / 5) * 5);
    const rows  = [];
    for (let u = step; u <= maxUnits + step && rows.length < 5; u += step) {
        rows.push(Math.round(u / 5) * 5 || 5);
    }
    return [...new Set(rows)].slice(0, 5);
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

    /* Step 4: single → dose in mcg; blend → units to draw */
    if (count === 1) {
        step4Title.textContent = 'Desired Dose';
        doseContainer.innerHTML = `
            <div class="field solo">
                <label class="field-label" for="dose-single">How much do you want to take?</label>
                <div class="input-wrap">
                    <input class="field-input has-unit" type="number" id="dose-single"
                           placeholder="e.g. 500" min="0.01" step="0.01">
                    <span class="input-unit">mcg</span>
                </div>
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
        const dose_mcg = parseFloat(document.getElementById('dose-single')?.value);
        if (!dose_mcg || dose_mcg <= 0) return showError('Please enter your desired dose (mcg).');
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
   LOAD BUTTONS (from Blends tab)
   ============================================================ */
function initLoadButtons() {
    document.querySelectorAll('.load-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const count   = parseInt(btn.dataset.count);
            const names   = btn.dataset.names.split(',').map(s => s.trim());
            const amounts = btn.dataset.amounts ? btn.dataset.amounts.split(',').map(s => s.trim()) : [];

            compoundCount = count;
            document.querySelectorAll('.pill[data-count]').forEach(p => p.classList.remove('active'));
            document.querySelector(`.pill[data-count="${count}"]`).classList.add('active');

            renderPresets(count);
            renderFields(count);
            hideResult();

            /* Find matching preset and select it */
            const matchingPreset = (PRESETS[count] || []).find(p =>
                p.isBlend && p.names && p.names[0] === names[0]
            );

            requestAnimationFrame(() => {
                names.forEach((name, idx) => {
                    const nameEl = document.getElementById(`name-${idx + 1}`);
                    const mgEl   = document.getElementById(`mg-${idx + 1}`);
                    if (nameEl) nameEl.value = name;
                    if (mgEl && amounts[idx]) mgEl.value = amounts[idx];
                });

                if (matchingPreset) {
                    activePreset = matchingPreset;
                    /* Highlight matching preset button */
                    document.querySelectorAll('.preset-btn').forEach((b, idx) => {
                        if ((PRESETS[count] || [])[idx] === matchingPreset) b.classList.add('selected');
                    });
                    updateBlendHint();
                }

                switchTab('calculator');
            });
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
