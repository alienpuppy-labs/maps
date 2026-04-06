// ui.js - Handles DOM rendering and Slider logic

function renderTable() {
    const container = document.getElementById('table-container');
    container.innerHTML = ''; 

    Object.keys(appState).sort().forEach(stateName => {
        const s = appState[stateName];
        const safeId = stateName.replace(/\s+/g, '-');
        const isSplit = splitStates.includes(stateName);
        
        const castTotal = s.baseB + s.baseY + s.baseR;
        const pctB = castTotal > 0 ? ((s.baseB / castTotal) * 100).toFixed(1) : 0;
        const pctR = castTotal > 0 ? ((s.baseR / castTotal) * 100).toFixed(1) : 0;
        const fmtB = s.baseB.toLocaleString();
        const fmtR = s.baseR.toLocaleString();

        const row = document.createElement('div');
        row.className = 'state-row';
        
        row.innerHTML = `
            <div class="winner-indicator" id="win-ind-${safeId}"></div>
            <div>
                <div class="state-name">${stateName}</div>
                <div class="state-ev" id="ev-label-${safeId}"></div>
            </div>
            <div class="fixed-votes">
                <div class="vote-line"><span style="color: var(--blue)">Blue:</span> <span>${fmtB} (${pctB}%)</span></div>
                <div class="vote-line"><span style="color: var(--red)">Red:</span> <span>${fmtR} (${pctR}%)</span></div>
            </div>
            <div class="mob-votes">
                <div class="vote-line"><span style="color: var(--blue)">Shift B:</span> <span id="mob-b-${safeId}">+0</span></div>
                <div class="vote-line"><span style="color: var(--red)">Shift R:</span> <span id="mob-r-${safeId}">+0</span></div>
            </div>
            <div class="state-actions">
                <button class="btn-mini blue-btn" id="btn-blue-${safeId}" ${isSplit ? 'disabled' : ''}>BLUE</button>
                <button class="btn-mini" id="btn-reset-${safeId}">RESET</button>
            </div>
            <div class="sliders-wrapper">
                <div class="slider-container" id="slider-dnv-${safeId}" title="Shift 'Did Not Vote' Pool">
                    <div class="slider-segment seg-blue"></div>
                    <div class="slider-segment seg-white"></div>
                    <div class="slider-segment seg-red"></div>
                    <div class="slider-handle h1"></div>
                    <div class="slider-handle h2"></div>
                </div>
                <div class="slider-container" id="slider-yel-${safeId}" title="Shift 'Yellow/Other' Pool">
                    <div class="slider-segment seg-blue"></div>
                    <div class="slider-segment seg-yellow"></div>
                    <div class="slider-segment seg-red"></div>
                    <div class="slider-handle h1"></div>
                    <div class="slider-handle h2"></div>
                </div>
            </div>
        `;
        container.appendChild(row);

        const sliderDNV = row.querySelector(`#slider-dnv-${safeId}`);
        const sliderYEL = row.querySelector(`#slider-yel-${safeId}`);
        
        updateSliderDOM(stateName, sliderDNV, 'dnv');
        updateSliderDOM(stateName, sliderYEL, 'yel');
        
        bindSliderPhysics(stateName, sliderDNV, 'dnv');
        bindSliderPhysics(stateName, sliderYEL, 'yel');

        document.getElementById(`btn-reset-${safeId}`).addEventListener('click', () => {
            s.pLeft = 0; s.pRight = 1; s.yLeft = 0; s.yRight = 1;
            updateSliderDOM(stateName, sliderDNV, 'dnv');
            updateSliderDOM(stateName, sliderYEL, 'yel');
            updateCalculations();
        });

        document.getElementById(`btn-blue-${safeId}`).addEventListener('click', () => {
            if (isSplit) return;
            s.pRight = 1; s.yRight = 1; s.yLeft = 0; 
            if (s.baseR >= s.baseB) {
                const votesNeededToWin = (s.baseR - s.baseB) + 1;
                s.pLeft = s.baseW > 0 ? Math.min(1, votesNeededToWin / s.baseW) : 0;
            } else {
                s.pLeft = 0; 
            }
            updateSliderDOM(stateName, sliderDNV, 'dnv');
            updateSliderDOM(stateName, sliderYEL, 'yel');
            updateCalculations();
        });
    });
}

function updateSliderDOM(stateName, container, type) {
    const s = appState[stateName];
    const leftProp = type === 'dnv' ? s.pLeft : s.yLeft;
    const rightProp = type === 'dnv' ? s.pRight : s.yRight;
    const centerClass = type === 'dnv' ? '.seg-white' : '.seg-yellow';

    container.querySelector('.seg-blue').style.width = `${leftProp * 100}%`;
    const centerSeg = container.querySelector(centerClass);
    centerSeg.style.left = `${leftProp * 100}%`;
    centerSeg.style.width = `${(rightProp - leftProp) * 100}%`;
    
    container.querySelector('.seg-red').style.width = `${(1 - rightProp) * 100}%`;
    container.querySelector('.h1').style.left = `${leftProp * 100}%`;
    container.querySelector('.h2').style.left = `${rightProp * 100}%`;
}

function bindSliderPhysics(stateName, container, type) {
    const h1 = container.querySelector('.h1');
    const h2 = container.querySelector('.h2');
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