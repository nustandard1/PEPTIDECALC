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
        btn.addEventListener('click', () => {
            switchTab(btn.dataset.tab);
        });
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

/* === RENDER PEPTIDE + DOSE FIELDS === */
function renderFields(count) {
    const peptideContainer = document.getElementById('peptide-fields');
    const doseContainer    = document.getElementById('dose-fields');

    peptideContainer.innerHTML = '';
    doseContainer.innerHTML    = '';

    for (let i = 1; i <= count; i++) {
        const defaultName = defaultCompoundName(i, count);

        /* --- Peptide amount group --- */
        const group = document.createElement('div');
        group.className = 'compound-group';
        group.innerHTML = `
            ${count > 1 ? `<div class="compound-group-label">Compound ${i}</div>` : ''}
            <div class="compound-row">
                <div class="field">
                    <label class="field-label" for="name-${i}">Peptide Name</label>
                    <div class="input-wrap">
                        <input class="field-input"
                               type="text"
                               id="name-${i}"
                               placeholder="${defaultName}"
                               autocomplete="off">
                    </div>
                </div>
                <div class="field">
                    <label class="field-label" for="mg-${i}">Amount in Vial</label>
                    <div class="input-wrap">
                        <input class="field-input has-unit"
                               type="number"
                               id="mg-${i}"
                               placeholder="e.g. 5"
                               min="0.01"
                               step="0.01">
                        <span class="input-unit">mg</span>
                    </div>
                </div>
            </div>
        `;
        peptideContainer.appendChild(group);

        /* --- Dose field --- */
        const doseWrap = document.createElement('div');
        doseWrap.className = 'field';
        doseWrap.innerHTML = `
            <label class="field-label" for="dose-${i}">
                ${count > 1 ? `Compound ${i} — ` : ''}Desired Dose
            </label>
            <div class="input-wrap">
                <input class="field-input has-unit"
                       type="number"
                       id="dose-${i}"
                       placeholder="e.g. 500"
                       min="0.01"
                       step="0.01">
                <span class="input-unit">mcg</span>
            </div>
        `;

        if (count > 1) {
            doseWrap.querySelector('.field-label').textContent =
                `Compound ${i} Desired Dose`;
        }

        /* wrap in dose-grid for multiple compounds */
        if (i === 1 && count > 1) {
            const grid = document.createElement('div');
            grid.className = 'dose-grid';
            grid.id = 'dose-grid';
            doseContainer.appendChild(grid);
        }

        if (count > 1) {
            document.getElementById('dose-grid').appendChild(doseWrap);
        } else {
            doseWrap.classList.add('solo');
            doseContainer.appendChild(doseWrap);
        }
    }
}

function defaultCompoundName(index, total) {
    if (total === 1) return 'e.g. BPC-157';
    const defaults = ['BPC-157', 'TB-500', 'CJC-1295', 'Ipamorelin'];
    return defaults[index - 1] || `Compound ${index}`;
}

/* === CALCULATE === */
function calculate() {
    const bacWater = parseFloat(document.getElementById('bac-water').value);

    if (!bacWater || bacWater <= 0) {
        return showError('Please enter the amount of bacteriostatic water you added (mL).');
    }

    const results = [];

    for (let i = 1; i <= compoundCount; i++) {
        const nameEl = document.getElementById(`name-${i}`);
        const mgEl   = document.getElementById(`mg-${i}`);
        const doseEl = document.getElementById(`dose-${i}`);

        const name     = (nameEl?.value.trim()) || `Compound ${i}`;
        const mg       = parseFloat(mgEl?.value);
        const dose_mcg = parseFloat(doseEl?.value);

        if (!mg || mg <= 0) {
            return showError(`Please enter the vial amount (mg) for ${name}.`);
        }
        if (!dose_mcg || dose_mcg <= 0) {
            return showError(`Please enter the desired dose (mcg) for ${name}.`);
        }

        /* Core math:
           concentration (mcg/mL) = peptide_mg × 1000 / bac_water_mL
           volume_mL               = dose_mcg / concentration
           units (U-100 syringe)   = volume_mL × 100
        */
        const concentration = (mg * 1000) / bacWater;   // mcg/mL
        const volume_ml     = dose_mcg / concentration;  // mL
        const units         = volume_ml * 100;           // U-100 units

        results.push({ name, mg, dose_mcg, concentration, volume_ml, units });
    }

    showResults(results);
}

/* === DISPLAY RESULTS === */
function showResults(results) {
    const box     = document.getElementById('result-box');
    const content = document.getElementById('result-content');

    box.classList.remove('error');

    content.innerHTML = results.map(r => `
        <div class="result-item">
            <div class="result-item-label">${escapeHtml(r.name)}</div>
            <div class="result-item-units">
                <span class="units-number">${formatUnits(r.units)}</span>
                <span class="units-label">units</span>
            </div>
            <div class="result-item-sub">
                ${r.dose_mcg} mcg &nbsp;·&nbsp;
                ${r.volume_ml.toFixed(3)} mL &nbsp;·&nbsp;
                ${Math.round(r.concentration)} mcg/mL
            </div>
        </div>
    `).join('');

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

/* === LOAD STACK INTO CALCULATOR === */
function initLoadButtons() {
    document.querySelectorAll('.load-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const count   = parseInt(btn.dataset.count);
            const names   = btn.dataset.names.split(',').map(s => s.trim());
            const amounts = btn.dataset.amounts.split(',').map(s => s.trim());

            /* set compound count */
            compoundCount = count;
            document.querySelectorAll('.pill[data-count]').forEach(p => p.classList.remove('active'));
            document.querySelector(`.pill[data-count="${count}"]`).classList.add('active');
            renderFields(count);
            hideResult();

            /* populate fields after render */
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

function escapeHtml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
