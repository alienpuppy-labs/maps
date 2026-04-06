// ui.js - Handles DOM rendering and Slider logic

function renderTable() {
    const container = document.getElementById('table-container');
    container.innerHTML = ''; 

    Object.keys(appState).sort().forEach(stateName => {
        const s = appState[stateName];
        const safeId = stateName.replace(/\s+/g, '-');
        
        const castTotal = s.baseB + s.baseY + s.baseR;
        const pctB = castTotal > 0 ? ((s.baseB / castTotal) * 100).toFixed(1) : 0;
        const pctY = castTotal > 0 ? ((s.baseY / castTotal) * 100).toFixed(1) : 0;
        const pctR = castTotal > 0 ? ((s.baseR / castTotal) * 100).toFixed(1) : 0;
        
        const row = document.createElement('div');
        row.className = 'state-row';
        
        row.innerHTML = `
            <div class="winner-indicator" id="win-ind-${safeId}"></div>
            <div>
                <div class="state-name">${stateName}</div>
                <div class="state-ev" id="ev-label-${safeId}"></div>
            </div>
            <div class="fixed-votes">
                <div class="vote-line"><span style="color: var(--blue)">Blue:</span> <span>${s.baseB.toLocaleString()} (${pctB}%)</span></div>
                <div class="vote-line"><span style="color: var(--yellow); text-shadow: 0 0 1px rgba(0,0,0,0.2);">Yel:</span> <span>${s.baseY.toLocaleString()} (${pctY}%)</span></div>
                <div class="vote-line"><span style="color: var(--red)">Red:</span> <span>${s.baseR.toLocaleString()} (${pctR}%)</span></div>
            </div>
            <div class="mob-votes">
                <div class="vote-line"><span style="color: var(--blue)">Shift B:</span> <span id="mob-b-${safeId}">+0</span></div>
                <div class="vote-line"><span style="color: var(--yellow); text-shadow: 0 0 1px rgba(0,0,0,0.2);">Shift Y:</span> <span id="mob-y-${safeId}">-0</span></div>
                <div class="vote-line"><span style="color: var(--red)">Shift R:</span> <span id="mob-r-${safeId}">+0</span></div>
            </div>
            <div class="state-actions">
                <button class="btn-mini blu" id="btn-blue-${safeId}" title="Min DNV to Flip Blue">BLU</button>
                <button class="btn-mini red" id="btn-red-${safeId}" title="Min DNV to Flip Red">RED</button>
                <button class="btn-mini" id="btn-reset-${safeId}">RST</button>
            </div>
            <div class="sliders-wrapper">
                <div class="slider-container" id="slider-dnv-${safeId}" title="Double-Click Left for Blue, Right for Red">
                    <div class="slider-segment seg-blue"></div><div class="slider-segment seg-white"></div><div class="slider-segment seg-red"></div>
                    <div class="slider-handle h1"></div><div class="slider-handle h2"></div>
                </div>
                <div class="slider-container" id="slider-yel-${safeId}" title="Double-Click Left for Blue, Right for Red">
                    <div class="slider-segment seg-blue"></div><div class="slider-segment seg-yellow"></div><div class="slider-segment seg-red"></div>
                    <div class="slider-handle h1"></div><div class="slider-handle h2"></div>
                </div>
            </div>
        `;
        container.appendChild(row);

        const sliderDNV = row.querySelector(`#slider-dnv-${safeId}`);
        const sliderYEL = row.querySelector(`#slider-yel-${safeId}`);
        
        updateSliderDOM(stateName, sliderDNV, 'dnv'); updateSliderDOM(stateName, sliderYEL, 'yel');
        bindSliderPhysics(stateName, sliderDNV, 'dnv'); bindSliderPhysics(stateName, sliderYEL, 'yel');

        // Reset Button
        document.getElementById(`btn-reset-${safeId}`).addEventListener('click', () => {
            s.pLeft = 0; s.pRight = 1; s.yLeft = 0; s.yRight = 1;
            updateSliderDOM(stateName, sliderDNV, 'dnv'); updateSliderDOM(stateName, sliderYEL, 'yel');
            updateCalculations();
        });

        // Row Buttons (Default to using DNV pool)
        document.getElementById(`btn-blue-${safeId}`).addEventListener('click', () => window.calculateStateFlip(stateName, 'blue', 'dnv'));
        document.getElementById(`btn-red-${safeId}`).addEventListener('click', () => window.calculateStateFlip(stateName, 'red', 'dnv'));

        // DOUBLE CLICK MAGIC
        sliderDNV.addEventListener('dblclick', (e) => {
            const rect = sliderDNV.getBoundingClientRect();
            if ((e.clientX - rect.left) < rect.width / 2) window.calculateStateFlip(stateName, 'blue', 'dnv');
            else window.calculateStateFlip(stateName, 'red', 'dnv');
        });
        sliderYEL.addEventListener('dblclick', (e) => {
            const rect = sliderYEL.getBoundingClientRect();
            if ((e.clientX - rect.left) < rect.width / 2) window.calculateStateFlip(stateName, 'blue', 'yel');
            else window.calculateStateFlip(stateName, 'red', 'yel');
        });
    });
}

function updateSliderDOM(stateName, container, type) {
    const s = appState[stateName];
    const leftProp = type === 'dnv' ? s.pLeft : s.yLeft; const rightProp = type === 'dnv' ? s.pRight : s.yRight;
    const centerClass = type === 'dnv' ? '.seg-white' : '.seg-yellow';

    container.querySelector('.seg-blue').style.width = `${leftProp * 100}%`;
    const centerSeg = container.querySelector(centerClass);
    centerSeg.style.left = `${leftProp * 100}%`; centerSeg.style.width = `${(rightProp - leftProp) * 100}%`;
    container.querySelector('.seg-red').style.width = `${(1 - rightProp) * 100}%`;
    container.querySelector('.h1').style.left = `${leftProp * 100}%`; container.querySelector('.h2').style.left = `${rightProp * 100}%`;
}

function bindSliderPhysics(stateName, container, type) {
    const h1 = container.querySelector('.h1'); const h2 = container.querySelector('.h2');
    let activeHandle = null;

    h1.addEventListener('mousedown', () => { activeHandle = 1; document.body.style.cursor = 'ew-resize'; });
    h2.addEventListener('mousedown', () => { activeHandle = 2; document.body.style.cursor = 'ew-resize'; });

    window.addEventListener('mousemove', (e) => {
        if (!activeHandle) return;
        const rect = container.getBoundingClientRect();
        let percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const s = appState[stateName];

        if (type === 'dnv') {
            if (activeHandle === 1) s.pLeft = Math.min(percent, s.pRight);
            else if (activeHandle === 2) s.pRight = Math.max(percent, s.pLeft);
        } else {
            if (activeHandle === 1) s.yLeft = Math.min(percent, s.yRight);
            else if (activeHandle === 2) s.yRight = Math.max(percent, s.yLeft);
        }
        
        updateSliderDOM(stateName, container, type);
        updateCalculations();
    });
    window.addEventListener('mouseup', () => { activeHandle = null; document.body.style.cursor = 'default'; });
}