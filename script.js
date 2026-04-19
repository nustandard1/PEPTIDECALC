/* ============================================================
   PEPTIDECALC — CALCULATOR LOGIC
   ============================================================ */

let compoundCount = 1;

document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initCompoundSelector();
    renderFields(1);
    document.getElementById('calc-btn').addEventListener('click', calculate);
    initLoadButtons();
});

/* === TABS === */
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

/* === COMPOUND COUNT SELECTOR === */
function initCompoundSelector() {
    document.querySelectorAll('.pill[data-count]').forEach(pill => {
        pill.addEventListener('click', () => {
            const count = parseInt(pill.dataset.count);
            compoundCount = count;
            document.querySelectorAll('.pill[data-count]').forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            renderFields(count);
            hideResult();
        });
    });
}

/* === RENDER FIELDS === */
function renderFields(count) {
    const peptideContainer = document.getElementById('peptide-fields');
    const doseContainer    = document.getElementById('dose-fields');
    const step4Title       = document.getElementById('step4-title');

    peptideContainer.innerHTML = '';
    doseContainer.innerHTML    = '';

    /* --- Peptide amount fields (same for all modes) --- */
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
                               placeholder="${defaultCompoundName(i, count)}" autocomplete="off">
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

    /* --- Step 4: dose input differs by mode ---
         Single compound : enter desired dose (mcg) → output units
         Blend (2+)      : enter units to draw      → output dose per compound
    */
    if (count === 1) {
        step4Title.textContent = 'Desired Dose';
        const field = document.createElement('div');
        field.className = 'field solo';
        field.innerHTML = `
            <label class="field-label" for="dose-single">How much do you want to take?</label>
            <div class="input-wrap">
                <input class="field-input has-unit" type="number" id="dose-single"
                       placeholder="e.g. 500" min="0.01" step="0.01">
                <span class="input-unit">mcg</span>
            </div>
        `;
        doseContainer.appendChild(field);
    } else {
        step4Title.textContent = 'Draw Amount';
        const field = document.createElement('div');
        field.className = 'field solo';
        field.innerHTML = `
            <label class="field-label" for="units-draw">How many units are you drawing?</label>
            <div class="input-wrap">
                <input class="field-input has-unit" type="number" id="units-draw"
                       placeholder="e.g. 20" min="0.1" step="0.1">
                <span class="input-unit">units</span>
            </div>
            <span class="field-hint">
                With a blended vial every compound is dosed together —
                enter the units you plan to draw and we'll show you exactly
                what you're getting of each compound.
            </span>
        `;
        doseContainer.appendChild(field);
    }
}

function defaultCompoundName(index, total) {
    if (total === 1) return 'e.g. BPC-157';
    const defaults = ['BPC-157', 'TB-500', 'GHK-Cu', 'KPV'];
    return defaults[index - 1] || `Compound ${index}`;
}

/* === CALCULATE === */
function calculate() {
    const bacWater = parseFloat(document.getElementById('bac-water').value);
    if (!bacWater || bacWater <= 0) {
        return showError('Please enter the amount of bacteriostatic water you added (mL).');
    }

    /* Collect compound data */
    const compounds = [];
    for (let i = 1; i <= compoundCount; i++) {
        const name = document.getElementById(`name-${i}`)?.value.trim() || `Compound ${i}`;
        const mg   = parseFloat(document.getElementById(`mg-${i}`)?.value);
        if (!mg || mg <= 0) {
            return showError(`Please enter the vial amount (mg) for ${name}.`);
        }
        const concentration = (mg * 1000) / bacWater; // mcg/mL
        compounds.push({ name, mg, concentration });
    }

    if (compoundCount === 1) {
        /* ── SINGLE COMPOUND: dose → units ── */
        const dose_mcg = parseFloat(document.getElementById('dose-single')?.value);
        if (!dose_mcg || dose_mcg <= 0) {
            return showError('Please enter your desired dose (mcg).');
        }
        const { name, concentration } = compounds[0];
        const volume_ml = dose_mcg / concentration;
        const units     = volume_ml * 100;
        showResultsSingle({ name, dose_mcg, concentration, volume_ml, units });

    } else {
        /* ── BLEND: units → dose per compound ── */
        const units = parseFloat(document.getElementById('units-draw')?.value);
        if (!units || units <= 0) {
            return showError('Please enter the number of units you plan to draw.');
        }
        const volume_ml = units / 100;
        const results = compounds.map(c => ({
            ...c,
            volume_ml,
            units,
            dose_mcg: c.concentration * volume_ml,
        }));
        showResultsBlend(results, units, volume_ml);
    }
}

/* === DISPLAY: single compound === */
function showResultsSingle({ name, dose_mcg, concentration, volume_ml, units }) {
    const box     = document.getElementById('result-box');
    const content = document.getElementById('result-content');
    box.classList.remove('error');

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

/* === DISPLAY: blend === */
function showResultsBlend(results, units, volume_ml) {
    const box     = document.getElementById('result-box');
    const content = document.getElementById('result-content');
    box.classList.remove('error');

    const header = `
        <div class="blend-draw-summary">
            Drawing <strong>${formatUnits(units)} units</strong>
            <span class="blend-draw-ml">(${volume_ml.toFixed(3)} mL)</span>
            — here's what you're getting:
        </div>
    `;

    const cards = results.map(r => `
        <div class="result-item">
            <div class="result-item-label">${escapeHtml(r.name)}</div>
            <div class="result-item-units">
                <span class="units-number">${formatDoseNumber(r.dose_mcg)}</span>
                <span class="units-label">${formatDoseUnit(r.dose_mcg)}</span>
            </div>
            <div class="result-item-sub">
                ${Math.round(r.concentration)} mcg/mL concentration
            </div>
        </div>
    `).join('');

    content.innerHTML = header + `<div class="result-grid-inner">${cards}</div>`;
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

/* === LOAD STACK BUTTONS === */
function initLoadButtons() {
    document.querySelectorAll('.load-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const count   = parseInt(btn.dataset.count);
            const names   = btn.dataset.names.split(',').map(s => s.trim());
            const amounts = btn.dataset.amounts.split(',').map(s => s.trim());

            compoundCount = count;
            document.querySelectorAll('.pill[data-count]').forEach(p => p.classList.remove('active'));
            document.querySelector(`.pill[data-count="${count}"]`).classList.add('active');
            renderFields(count);
            hideResult();

            requestAnimationFrame(() => {
                names.forEach((name, idx) => {
                    const nameEl = document.getElementById(`name-${idx + 1}`);
                    const mgEl   = document.getElementById(`mg-${idx + 1}`);
                    if (nameEl) nameEl.value = name;
                    if (mgEl && amounts[idx]) mgEl.value = amounts[idx];
                });
                switchTab('calculator');
            });
        });
    });
}

/* === HELPERS === */
function formatUnits(units) {
    if (units >= 100) return Math.round(units).toString();
    if (units >= 10)  return (Math.round(units * 10) / 10).toFixed(1);
    return (Math.round(units * 100) / 100).toFixed(2);
}

/* Show dose as mcg or mg depending on size */
function formatDose(mcg) {
    if (mcg >= 1000) return `${(mcg / 1000).toFixed(2).replace(/\.?0+$/, '')} mg`;
    return `${Math.round(mcg * 10) / 10} mcg`;
}

/* Number and unit separately for the big display */
function formatDoseNumber(mcg) {
    if (mcg >= 1000) return (mcg / 1000).toFixed(2).replace(/\.?0+$/, '');
    return (Math.round(mcg * 10) / 10).toString();
}

function formatDoseUnit(mcg) {
    return mcg >= 1000 ? 'mg' : 'mcg';
}

function escapeHtml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
