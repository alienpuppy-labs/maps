// app.js

let appState = {};
let activeProfile = null; // Stores the currently loaded election data

const splitStates = ["Maine", "Nebraska"];
const colors = { blue: 'var(--blue)', yellow: 'var(--yellow)', white: 'var(--white)', red: 'var(--red)' };
let dnvIsCandidate = false;

// --- NEW MULTI-YEAR LOADER ---
function loadElectionProfile(profileData) {
    activeProfile = profileData;

    // 1. Update Candidate Names
    document.getElementById('nameBlue').value = activeProfile.meta.blue.name;
    document.getElementById('nameYellow').value = activeProfile.meta.yellow.name;
    document.getElementById('nameRed').value = activeProfile.meta.red.name;

    // 2. Dynamically Inject CSS Colors 
    // This instantly updates the map, buttons, ribbons, and badges
    document.documentElement.style.setProperty('--blue', activeProfile.meta.blue.color);
    document.documentElement.style.setProperty('--yellow', activeProfile.meta.yellow.color);
    document.documentElement.style.setProperty('--red', activeProfile.meta.red.color);

    // 3. Reboot the Engine
    initData();
    renderTable();
    updateCalculations();
}

function initData() {
    // Note: Now reading from activeProfile.states instead of rawData2024
    for (const [state, data] of Object.entries(activeProfile.states)) {
        const [ev, b, y, w, r] = data;
        appState[state] = {
            ev: ev, baseB: b, baseY: y, baseW: w, baseR: r,
            pLeft: 0, pRight: 1, 
            evAlloc: { blue: 0, yellow: 0, white: 0, red: 0 }
        };
    }
}

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
                <div class="vote-line"><span style="color: var(--blue)">Mob B:</span> <span id="mob-b-${safeId}">+0</span></div>
                <div class="vote-line"><span style="color: var(--red)">Mob R:</span> <span id="mob-r-${safeId}">+0</span></div>
            </div>
            <div class="state-actions">
                <button class="btn-mini blue-btn" id="btn-blue-${safeId}" ${isSplit ? 'disabled title="N/A for split states"' : ''}>BLUE</button>
                <button class="btn-mini" id="btn-reset-${safeId}">RESET</button>
            </div>
            <div class="slider-container" id="slider-${safeId}">
                <div class="slider-segment seg-blue"></div>
                <div class="slider-segment seg-white"></div>
                <div class="slider-segment seg-red"></div>
                <div class="slider-handle h1"></div>
                <div class="slider-handle h2"></div>
            </div>
        `;
        container.appendChild(row);

        const sliderContainer = row.querySelector('.slider-container');
        updateSliderDOM(stateName, sliderContainer);
        bindSliderPhysics(stateName, sliderContainer);

        // Per-State Button Listeners
        document.getElementById(`btn-reset-${safeId}`).addEventListener('click', () => {
            s.pLeft = 0; s.pRight = 1;
            updateSliderDOM(stateName, sliderContainer);
            updateCalculations();
        });

        document.getElementById(`btn-blue-${safeId}`).addEventListener('click', () => {
            if (isSplit) return;
            s.pRight = 1; 
            if (s.baseR >= s.baseB) {
                const votesNeededToWin = (s.baseR - s.baseB) + 1;
                s.pLeft = s.baseW > 0 ? Math.min(1, votesNeededToWin / s.baseW) : 0;
            } else {
                s.pLeft = 0; 
            }
            updateSliderDOM(stateName, sliderContainer);
            updateCalculations();
        });
    });
}

function updateSliderDOM(stateName, container) {
    const s = appState[stateName];
    container.querySelector('.seg-blue').style.width = `${s.pLeft * 100}%`;
    const whiteSeg = container.querySelector('.seg-white');
    whiteSeg.style.left = `${s.pLeft * 100}%`;
    whiteSeg.style.width = `${(s.pRight - s.pLeft) * 100}%`;
    container.querySelector('.seg-red').style.width = `${(1 - s.pRight) * 100}%`;
    container.querySelector('.h1').style.left = `${s.pLeft * 100}%`;
    container.querySelector('.h2').style.left = `${s.pRight * 100}%`;
}

function bindSliderPhysics(stateName, container) {
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

        if (activeHandle === 1) s.pLeft = Math.min(percent, s.pRight);
        else if (activeHandle === 2) s.pRight = Math.max(percent, s.pLeft);
        
        updateSliderDOM(stateName, container);
        updateCalculations();
    });

    window.addEventListener('mouseup', () => { activeHandle = null; document.body.style.cursor = 'default'; });
}

function renderMap() {
    d3.json("https://cdn.jsdelivr.net/npm/us-atlas@3/states-albers-10m.json").then(us => {
        d3.select("#states-group").selectAll("path")
            .data(topojson.feature(us, us.objects.states).features)
            .enter().append("path").attr("class", "state-path").attr("d", d3.geoPath())
            .attr("id", d => `map-${d.properties.name.replace(/\s+/g, '-')}`)
            .on("mousemove", showTooltip).on("mouseout", hideTooltip);
        updateCalculations(); 
    });
}

function updateCalculations() {
    let totals = { blue: 0, yellow: 0, white: 0, red: 0 };
    let globalMobB = 0;
    let globalMobR = 0;

    for (const [stateName, s] of Object.entries(appState)) {
        const safeId = stateName.replace(/\s+/g, '-');
        s.evAlloc = { blue: 0, yellow: 0, white: 0, red: 0 };

        let mobilizedB = s.baseW * s.pLeft;
        let mobilizedR = s.baseW * (1 - s.pRight);
        
        globalMobB += mobilizedB;
        globalMobR += mobilizedR;

        let activeB = s.baseB + mobilizedB;
        let activeR = s.baseR + mobilizedR;
        let activeW = s.baseW - mobilizedB - mobilizedR;
        let activeY = s.baseY;

        const lblMobB = document.getElementById(`mob-b-${safeId}`);
        const lblMobR = document.getElementById(`mob-r-${safeId}`);
        if (lblMobB) lblMobB.textContent = `+${Math.round(mobilizedB).toLocaleString()}`;
        if (lblMobR) lblMobR.textContent = `+${Math.round(mobilizedR).toLocaleString()}`;

        if (splitStates.includes(stateName)) {
            let activeSum = dnvIsCandidate ? (activeB + activeY + activeW + activeR) : (activeB + activeY + activeR);
            if (activeSum === 0) activeSum = 1;

            let evB = Math.round((activeB / activeSum) * s.ev);
            let evY = Math.round((activeY / activeSum) * s.ev);
            let evW = dnvIsCandidate ? Math.round((activeW / activeSum) * s.ev) : 0;
            let evR = s.ev - (evB + evY + evW);
            if (evR < 0) { evB += evR; evR = 0; }

            s.evAlloc = { blue: evB, yellow: evY, white: evW, red: evR };
            d3.select(`#map-${safeId}`).attr("fill", "url(#hatch-split)");
            
            const ind = document.getElementById(`win-ind-${safeId}`);
            if (ind) ind.style.background = `repeating-linear-gradient(45deg, var(--blue), var(--blue) 5px, var(--red) 5px, var(--red) 10px)`;
        } else {
            let max = -1, winner = 'white';
            const cands = [ {id:'blue', val:activeB}, {id:'yellow', val:activeY}, {id:'red', val:activeR} ];
            if (dnvIsCandidate) cands.push({id:'white', val:activeW});

            cands.forEach(c => { if (c.val > max) { max = c.val; winner = c.id; } });
            s.evAlloc[winner] = s.ev;
            d3.select(`#map-${safeId}`).attr("fill", colors[winner]);
            
            const ind = document.getElementById(`win-ind-${safeId}`);
            if (ind) ind.style.background = colors[winner];
        }

        totals.blue += s.evAlloc.blue; totals.yellow += s.evAlloc.yellow; totals.white += s.evAlloc.white; totals.red += s.evAlloc.red;

        const label = document.getElementById(`ev-label-${safeId}`);
        if (label) {
            if (splitStates.includes(stateName)) {
                let arr = [];
                if(s.evAlloc.blue) arr.push(`${s.evAlloc.blue} B`);
                if(s.evAlloc.red) arr.push(`${s.evAlloc.red} R`);
                label.textContent = arr.join(' / ');
            } else { label.textContent = `${s.ev} EV`; }
        }
    }

    document.getElementById('sum-mob-b').textContent = Math.round(globalMobB).toLocaleString();
    document.getElementById('sum-mob-r').textContent = Math.round(globalMobR).toLocaleString();
    document.getElementById('sum-mob-total').textContent = Math.round(globalMobB + globalMobR).toLocaleString();

    ['blue', 'yellow', 'white', 'red'].forEach(col => {
        const seg = document.getElementById(`rib-${col}`);
        seg.style.width = `${(totals[col] / 538) * 100}%`;
        seg.textContent = totals[col] > 15 ? totals[col] : ''; 
    });

    const bName = document.getElementById('nameBlue').value || "Blue";
    const yName = document.getElementById('nameYellow').value || "Yellow";
    const rName = document.getElementById('nameRed').value || "Red";
    
    const winnerHeader = document.getElementById('overall-winner');
    winnerHeader.innerHTML = ''; 
    const winSpan = document.createElement('span');
    winSpan.style.fontWeight = 'bold';

    if (totals.blue >= 270) {
        winSpan.style.color = 'var(--blue)';
        winSpan.textContent = `${bName} Wins (${totals.blue} EVs)`;
    } else if (totals.red >= 270) {
        winSpan.style.color = 'var(--red)';
        winSpan.textContent = `${rName} Wins (${totals.red} EVs)`;
    } else if (totals.white >= 270) {
        winSpan.style.color = 'var(--text-dark)';
        winSpan.textContent = `Did Not Vote Wins (${totals.white} EVs)`;
    } else if (totals.yellow >= 270) {
        winSpan.style.color = 'var(--yellow)';
        winSpan.style.textShadow = '1px 1px 1px rgba(0,0,0,0.2)';
        winSpan.textContent = `${yName} Wins (${totals.yellow} EVs)`;
    } else {
        winSpan.textContent = "No clear winner yet";
    }
    winnerHeader.appendChild(winSpan);
}

// Ribbon Tooltips
document.querySelectorAll('.ribbon-segment').forEach(seg => {
    seg.addEventListener('mousemove', (e) => {
        const id = seg.id.replace('rib-', '');
        
        const bName = document.getElementById('nameBlue').value;
        const yName = document.getElementById('nameYellow').value;
        const rName = document.getElementById('nameRed').value;
        
        const nameMap = { blue: bName, yellow: yName, red: rName, white: 'Did Not Vote' };
        let evCount = 0;
        for (const s of Object.values(appState)) evCount += s.evAlloc[id];
        
        document.getElementById('tt-line1').textContent = nameMap[id];
        
        const ttCandidates = document.getElementById('tt-candidates');
        ttCandidates.innerHTML = '';
        
        const badge = document.createElement('div');
        badge.className = 'tt-badge';
        badge.style.backgroundColor = document.documentElement.style.getPropertyValue(`--${id}`) || `var(--${id})`;
        badge.style.color = (id === 'white' || id === 'yellow') ? 'black' : 'white';
        badge.textContent = `${evCount} EVs`;
        
        ttCandidates.appendChild(badge);
        
        document.getElementById('tooltip').style.display = 'flex';
        document.getElementById('tooltip').style.left = (e.pageX + 15) + 'px';
        document.getElementById('tooltip').style.top = (e.pageY + 15) + 'px';
    });
    seg.addEventListener('mouseout', hideTooltip);
});

const tooltip = document.getElementById('tooltip');
function showTooltip(event, d) {
    const stateName = d.properties.name;
    const s = appState[stateName];
    if (!s) return;
    
    document.getElementById('tt-line1').textContent = stateName;
    const cands = document.getElementById('tt-candidates'); 
    cands.innerHTML = '';
    
    const createBadge = (n, ev, col) => {
        if (ev <= 0) return;
        const badge = document.createElement('div');
        badge.className = 'tt-badge';
        badge.style.backgroundColor = document.documentElement.style.getPropertyValue(`--${col}`) || `var(--${col})`;
        badge.style.color = (col === 'white' || col === 'yellow') ? 'black' : 'white';
        badge.textContent = `${n} (${ev})`;
        cands.appendChild(badge);
    };
    
    createBadge(document.getElementById('nameBlue').value, s.evAlloc.blue, 'blue');
    createBadge(document.getElementById('nameYellow').value, s.evAlloc.yellow, 'yellow');
    createBadge(document.getElementById('nameRed').value, s.evAlloc.red, 'red');
    createBadge("Did Not Vote", s.evAlloc.white, 'white');
    
    tooltip.style.display = 'flex'; 
    tooltip.style.left = (event.pageX + 15) + 'px'; 
    tooltip.style.top = (event.pageY + 15) + 'px';
}
function hideTooltip() { tooltip.style.display = 'none'; }

// --- GLOBAL EVENT LISTENERS ---

// BOILERPLATE: Loading Election Years
document.getElementById('load2024Btn').addEventListener('click', () => { 
    if (typeof data_2024 !== 'undefined') loadElectionProfile(data_2024);
});

document.getElementById('load2020Btn').addEventListener('click', () => { 
    if (typeof data_2020 !== 'undefined') loadElectionProfile(data_2020);
});

document.getElementById('flipAllBlueBtn').addEventListener('click', () => {
    for (const [stateName, s] of Object.entries(appState)) {
        if (splitStates.includes(stateName)) continue; 
        s.pRight = 1; 
        if (s.baseR >= s.baseB) {
            const votesNeededToWin = (s.baseR - s.baseB) + 1;
            s.pLeft = s.baseW > 0 ? Math.min(1, votesNeededToWin / s.baseW) : 0;
        } else {
            s.pLeft = 0; 
        }
        updateSliderDOM(stateName, document.getElementById(`slider-${stateName.replace(/\s+/g, '-')}`));
    }
    updateCalculations();
});

document.getElementById('minShiftBlueBtn').addEventListener('click', () => {
    for (const s of Object.values(appState)) { s.pLeft = 0; s.pRight = 1; }
    updateCalculations();

    let blueEVs = 0;
    for (const s of Object.values(appState)) { blueEVs += s.evAlloc.blue; }

    const target = 270 - blueEVs;
    if (target <= 0) return;

    let flippable = [];
    for (const [stateName, s] of Object.entries(appState)) {
        if (splitStates.includes(stateName)) continue; 
        if (s.evAlloc.red > 0) { 
            const cost = (s.baseR - s.baseB) + 1;
            if (cost <= s.baseW) { 
                flippable.push({ name: stateName, ev: s.evAlloc.red, cost: cost });
            }
        }
    }

    const maxEVs = flippable.reduce((sum, state) => sum + state.ev, 0);
    let dp = new Array(maxEVs + 1).fill(Infinity);
    let selected = new Array(maxEVs + 1).fill(null).map(() => []);
    dp[0] = 0;

    for (const state of flippable) {
        for (let j = maxEVs; j >= state.ev; j--) {
            if (dp[j - state.ev] !== Infinity) {
                const newCost = dp[j - state.ev] + state.cost;
                if (newCost < dp[j]) {
                    dp[j] = newCost;
                    selected[j] = [...selected[j - state.ev], state.name];
                }
            }
        }
    }

    let minCost = Infinity;
    let bestSubset = [];
    for (let j = target; j <= maxEVs; j++) {
        if (dp[j] < minCost) {
            minCost = dp[j];
            bestSubset = selected[j];
        }
    }

    bestSubset.forEach(stateName => {
        const s = appState[stateName];
        const cost = (s.baseR - s.baseB) + 1;
        s.pLeft = cost / s.baseW;
    });

    for (const stateName of Object.keys(appState)) {
        updateSliderDOM(stateName, document.getElementById(`slider-${stateName.replace(/\s+/g, '-')}`));
    }
    updateCalculations();
});

document.getElementById('toggleDNV').addEventListener('change', (e) => { dnvIsCandidate = e.target.checked; updateCalculations(); });
document.querySelectorAll('.name-input').forEach(i => i.addEventListener('input', updateCalculations));

// BOOT: Load 2024 by Default
renderMap();
if (typeof data_2024 !== 'undefined') {
    loadElectionProfile(data_2024);
}
