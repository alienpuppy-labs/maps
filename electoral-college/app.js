// app.js - Core Logic, State, and Event Handlers

let appState = {}; let activeProfile = null;
const splitStates = ["Maine", "Nebraska"];
const colors = { blue: 'var(--blue)', yellow: 'var(--yellow)', white: 'var(--white)', red: 'var(--red)' };
let dnvIsCandidate = false;

function loadElectionProfile(profileData) {
    activeProfile = profileData;
    document.getElementById('nameBlue').value = activeProfile.meta.blue.name;
    document.getElementById('nameYellow').value = activeProfile.meta.yellow.name;
    document.getElementById('nameRed').value = activeProfile.meta.red.name;

    document.documentElement.style.setProperty('--blue', activeProfile.meta.blue.color);
    document.documentElement.style.setProperty('--yellow', activeProfile.meta.yellow.color);
    document.documentElement.style.setProperty('--red', activeProfile.meta.red.color);

    const sourceDiv = document.getElementById('source-container');
    sourceDiv.innerHTML = ''; 
    if (activeProfile.meta.sourceName && activeProfile.meta.sourceUrl) {
        const textSpan = document.createElement('span'); textSpan.textContent = "Data Source: ";
        const linkNode = document.createElement('a'); linkNode.href = activeProfile.meta.sourceUrl;
        linkNode.target = "_blank"; linkNode.className = "source-link"; linkNode.textContent = activeProfile.meta.sourceName;
        sourceDiv.appendChild(textSpan); sourceDiv.appendChild(linkNode);
    }
    initData(); renderTable(); updateCalculations();
}

function initData() {
    for (const [state, data] of Object.entries(activeProfile.states)) {
        const [ev, b, y, w, r] = data;
        appState[state] = { ev: ev, baseB: b, baseY: y, baseW: w, baseR: r, pLeft: 0, pRight: 1, yLeft: 0, yRight: 1, evAlloc: { blue: 0, yellow: 0, white: 0, red: 0 } };
    }
}

// --- NEW: Helper for State Row Buttons & Double Clicks ---
window.calculateStateFlip = function(stateName, targetCand, poolType) {
    const s = appState[stateName];
    
    // If it's Maine or Nebraska, exact threshold math is ambiguous, so we just max the slider out.
    if (splitStates.includes(stateName)) {
        if (targetCand === 'blue') { if (poolType === 'dnv') s.pLeft = 1; else s.yLeft = 1; } 
        else { if (poolType === 'dnv') s.pRight = 0; else s.yRight = 0; }
    } else {
        // Reset the active pool before calculating
        if (poolType === 'dnv') { s.pLeft = 0; s.pRight = 1; } else { s.yLeft = 0; s.yRight = 1; }

        let activeB = s.baseB + (s.baseW * s.pLeft) + (s.baseY * s.yLeft);
        let activeR = s.baseR + (s.baseW * (1 - s.pRight)) + (s.baseY * (1 - s.yRight));
        let margin = targetCand === 'blue' ? (activeR - activeB) : (activeB - activeR);
        
        if (margin >= 0) {
            let needed = margin + 1;
            let available = poolType === 'dnv' ? s.baseW : s.baseY;
            if (needed <= available) {
                let prop = needed / available;
                if (targetCand === 'blue') { if (poolType === 'dnv') s.pLeft = prop; else s.yLeft = prop; } 
                else { if (poolType === 'dnv') s.pRight = 1 - prop; else s.yRight = 1 - prop; }
            } else {
                // Not enough votes to flip it. Max out the slider to show effort.
                if (targetCand === 'blue') { if (poolType === 'dnv') s.pLeft = 1; else s.yLeft = 1; } 
                else { if (poolType === 'dnv') s.pRight = 0; else s.yRight = 0; }
            }
        }
    }
    
    const safeId = stateName.replace(/\s+/g, '-');
    updateSliderDOM(stateName, document.getElementById(`slider-${poolType}-${safeId}`), poolType);
    updateCalculations();
}

function updateCalculations() {
    let totals = { blue: 0, yellow: 0, white: 0, red: 0 };
    let globalMobB = 0; let globalMobR = 0; let globalDrainedDNV = 0; let globalDrainedYEL = 0; let itemizedHTML = '';

    for (const [stateName, s] of Object.entries(appState)) {
        const safeId = stateName.replace(/\s+/g, '-');
        s.evAlloc = { blue: 0, yellow: 0, white: 0, red: 0 };

        let mobDnvB = s.baseW * s.pLeft; let mobDnvR = s.baseW * (1 - s.pRight);
        let mobYelB = s.baseY * s.yLeft; let mobYelR = s.baseY * (1 - s.yRight);
        
        let stateDrainedDNV = mobDnvB + mobDnvR; let stateDrainedYEL = mobYelB + mobYelR;
        let totalMobB = mobDnvB + mobYelB; let totalMobR = mobDnvR + mobYelR;
        
        globalMobB += totalMobB; globalMobR += totalMobR;
        globalDrainedDNV += stateDrainedDNV; globalDrainedYEL += stateDrainedYEL;

        let activeB = s.baseB + totalMobB; let activeR = s.baseR + totalMobR;
        let activeW = s.baseW - stateDrainedDNV; let activeY = s.baseY - stateDrainedYEL;

        if (totalMobB > 0 || totalMobR > 0) {
            itemizedHTML += `<div class="itemized-row"><strong title="${stateName}">${stateName}</strong><span>${totalMobB > 0 ? `<span style="color:var(--blue)">+${Math.round(totalMobB).toLocaleString()}</span> ` : ''}${totalMobR > 0 ? `<span style="color:var(--red)">+${Math.round(totalMobR).toLocaleString()}</span>` : ''}</span></div>`;
        }

        const lblMobB = document.getElementById(`mob-b-${safeId}`); const lblMobY = document.getElementById(`mob-y-${safeId}`); const lblMobR = document.getElementById(`mob-r-${safeId}`);
        if (lblMobB) lblMobB.textContent = `+${Math.round(totalMobB).toLocaleString()}`;
        if (lblMobY) lblMobY.textContent = `-${Math.round(stateDrainedYEL).toLocaleString()}`;
        if (lblMobR) lblMobR.textContent = `+${Math.round(totalMobR).toLocaleString()}`;

        if (splitStates.includes(stateName)) {
            let activeSum = dnvIsCandidate ? (activeB + activeY + activeW + activeR) : (activeB + activeY + activeR);
            if (activeSum === 0) activeSum = 1;
            let evB = Math.round((activeB / activeSum) * s.ev); let evY = Math.round((activeY / activeSum) * s.ev);
            let evW = dnvIsCandidate ? Math.round((activeW / activeSum) * s.ev) : 0;
            let evR = s.ev - (evB + evY + evW); if (evR < 0) { evB += evR; evR = 0; }
            s.evAlloc = { blue: evB, yellow: evY, white: evW, red: evR };
            d3.select(`#map-${safeId}`).attr("fill", "url(#hatch-split)");
            const ind = document.getElementById(`win-ind-${safeId}`); if (ind) ind.style.background = `repeating-linear-gradient(45deg, var(--blue), var(--blue) 5px, var(--red) 5px, var(--red) 10px)`;
        } else {
            let max = -1, winner = 'white';
            const cands = [ {id:'blue', val:activeB}, {id:'yellow', val:activeY}, {id:'red', val:activeR} ];
            if (dnvIsCandidate) cands.push({id:'white', val:activeW});
            cands.forEach(c => { if (c.val > max) { max = c.val; winner = c.id; } });
            s.evAlloc[winner] = s.ev;
            d3.select(`#map-${safeId}`).attr("fill", colors[winner]);
            const ind = document.getElementById(`win-ind-${safeId}`); if (ind) ind.style.background = colors[winner];
        }

        totals.blue += s.evAlloc.blue; totals.yellow += s.evAlloc.yellow; totals.white += s.evAlloc.white; totals.red += s.evAlloc.red;
        const label = document.getElementById(`ev-label-${safeId}`);
        if (label) { if (splitStates.includes(stateName)) { let arr = []; if(s.evAlloc.blue) arr.push(`${s.evAlloc.blue} B`); if(s.evAlloc.red) arr.push(`${s.evAlloc.red} R`); label.textContent = arr.join(' / '); } else { label.textContent = `${s.ev} EV`; } }
    }

    document.getElementById('itemized-shifts').innerHTML = itemizedHTML || '<div style="color:var(--text-muted); text-align:center;">No shifts applied yet</div>';
    document.getElementById('sum-mob-b').textContent = Math.round(globalMobB).toLocaleString();
    document.getElementById('sum-mob-r').textContent = Math.round(globalMobR).toLocaleString();
    document.getElementById('sum-mob-dnv').textContent = Math.round(globalDrainedDNV).toLocaleString();
    document.getElementById('sum-mob-yel').textContent = Math.round(globalDrainedYEL).toLocaleString();
    document.getElementById('sum-mob-total').textContent = Math.round(globalMobB + globalMobR).toLocaleString();

    ['blue', 'yellow', 'white', 'red'].forEach(col => { const seg = document.getElementById(`rib-${col}`); seg.style.width = `${(totals[col] / 538) * 100}%`; seg.textContent = totals[col] > 15 ? totals[col] : ''; });

    const bName = document.getElementById('nameBlue').value || "Blue"; const yName = document.getElementById('nameYellow').value || "Yellow"; const rName = document.getElementById('nameRed').value || "Red";
    const winnerHeader = document.getElementById('overall-winner'); winnerHeader.innerHTML = ''; 
    const winSpan = document.createElement('span'); winSpan.style.fontWeight = 'bold';

    if (totals.blue >= 270) { winSpan.style.color = 'var(--blue)'; winSpan.textContent = `${bName} Wins (${totals.blue} EVs)`; } 
    else if (totals.red >= 270) { winSpan.style.color = 'var(--red)'; winSpan.textContent = `${rName} Wins (${totals.red} EVs)`; } 
    else if (totals.white >= 270) { winSpan.style.color = 'var(--text-dark)'; winSpan.textContent = `Did Not Vote Wins (${totals.white} EVs)`; } 
    else if (totals.yellow >= 270) { winSpan.style.color = 'var(--yellow)'; winSpan.style.textShadow = '1px 1px 1px rgba(0,0,0,0.2)'; winSpan.textContent = `${yName} Wins (${totals.yellow} EVs)`; } 
    else { winSpan.textContent = "No clear winner yet"; }
    winnerHeader.appendChild(winSpan);
}

// --- BULK ACTION ALGORITHMS ---

function globalFlipAll(targetCand, poolType) {
    for (const [stateName, s] of Object.entries(appState)) {
        if (targetCand === 'blue') { if (poolType === 'dnv') { s.pLeft = 1; s.pRight = 1; } else { s.yLeft = 1; s.yRight = 1; } } 
        else { if (poolType === 'dnv') { s.pLeft = 0; s.pRight = 0; } else { s.yLeft = 0; s.yRight = 0; } }
        updateSliderDOM(stateName, document.getElementById(`slider-${poolType}-${stateName.replace(/\s+/g, '-')}`), poolType);
    }
    updateCalculations();
}

function globalMinShift(targetCand, poolType) {
    for (const s of Object.values(appState)) { if (poolType === 'dnv') { s.pLeft = 0; s.pRight = 1; } else { s.yLeft = 0; s.yRight = 1; } }
    updateCalculations();

    let currentEVs = 0;
    for (const s of Object.values(appState)) { currentEVs += s.evAlloc[targetCand] || 0; }
    
    const target = 270 - currentEVs;
    if (target <= 0) return; // Already winning!

    let flippable = [];
    for (const [stateName, s] of Object.entries(appState)) {
        if (splitStates.includes(stateName)) continue; // Exclude ME/NE to prevent exact-math breakage
        
        let oppEVs = targetCand === 'blue' ? s.evAlloc.red : s.evAlloc.blue;
        if (oppEVs > 0) {
            let activeB = s.baseB + (s.baseW * s.pLeft) + (s.baseY * s.yLeft);
            let activeR = s.baseR + (s.baseW * (1 - s.pRight)) + (s.baseY * (1 - s.yRight));
            let margin = targetCand === 'blue' ? (activeR - activeB) : (activeB - activeR);
            let available = poolType === 'dnv' ? s.baseW : s.baseY;

            if ((margin + 1) <= available) flippable.push({ name: stateName, ev: oppEVs, cost: margin + 1, avail: available });
        }
    }

    const maxEVs = flippable.reduce((sum, state) => sum + state.ev, 0);
    if (maxEVs < target) {
        alert(`Not enough flippable votes in the ${poolType.toUpperCase()} pool to reach 270 Electoral Votes.`);
        return; // Crash protected!
    }

    let dp = new Array(maxEVs + 1).fill(Infinity); let selected = new Array(maxEVs + 1).fill(null).map(() => []); dp[0] = 0;
    for (const state of flippable) {
        for (let j = maxEVs; j >= state.ev; j--) {
            if (dp[j - state.ev] !== Infinity) {
                const newCost = dp[j - state.ev] + state.cost;
                if (newCost < dp[j]) { dp[j] = newCost; selected[j] = [...selected[j - state.ev], state.name]; }
            }
        }
    }

    let minCost = Infinity, bestSubset = [];
    for (let j = target; j <= maxEVs; j++) { if (dp[j] < minCost) { minCost = dp[j]; bestSubset = selected[j]; } }

    bestSubset.forEach(stateName => {
        const stateInfo = flippable.find(f => f.name === stateName); const s = appState[stateName];
        let prop = stateInfo.cost / stateInfo.avail;
        if (targetCand === 'blue') { if (poolType === 'dnv') s.pLeft = prop; else s.yLeft = prop; } 
        else { if (poolType === 'dnv') s.pRight = 1 - prop; else s.yRight = 1 - prop; }
    });

    for (const stateName of Object.keys(appState)) updateSliderDOM(stateName, document.getElementById(`slider-${poolType}-${stateName.replace(/\s+/g, '-')}`), poolType);
    updateCalculations();
}

// --- GLOBAL EVENT LISTENERS ---
document.getElementById('allDnvBlueBtn').addEventListener('click', () => globalFlipAll('blue', 'dnv'));
document.getElementById('allDnvRedBtn').addEventListener('click', () => globalFlipAll('red', 'dnv'));
document.getElementById('allYelBlueBtn').addEventListener('click', () => globalFlipAll('blue', 'yel'));
document.getElementById('allYelRedBtn').addEventListener('click', () => globalFlipAll('red', 'yel'));

document.getElementById('minDnvBlueBtn').addEventListener('click', () => globalMinShift('blue', 'dnv'));
document.getElementById('minDnvRedBtn').addEventListener('click', () => globalMinShift('red', 'dnv'));
document.getElementById('minYelBlueBtn').addEventListener('click', () => globalMinShift('blue', 'yel'));
document.getElementById('minYelRedBtn').addEventListener('click', () => globalMinShift('red', 'yel'));

document.getElementById('load2024Btn').addEventListener('click', () => { if (typeof data_2024 !== 'undefined') loadElectionProfile(data_2024); });
document.getElementById('load2020Btn').addEventListener('click', () => { if (typeof data_2020 !== 'undefined') loadElectionProfile(data_2020); });
document.getElementById('load2016Btn').addEventListener('click', () => { if (typeof data_2016 !== 'undefined') loadElectionProfile(data_2016); });

document.getElementById('toggleDNV').addEventListener('change', (e) => { dnvIsCandidate = e.target.checked; updateCalculations(); });
document.querySelectorAll('.name-input').forEach(i => i.addEventListener('input', updateCalculations));

// --- MODAL EVENT LISTENERS ---
document.getElementById('helpBtn').addEventListener('click', () => document.getElementById('helpModal').style.display = 'flex');
document.getElementById('closeModalBtn').addEventListener('click', () => document.getElementById('helpModal').style.display = 'none');
document.getElementById('gotItBtn').addEventListener('click', () => document.getElementById('helpModal').style.display = 'none');

window.addEventListener('load', () => { setupRibbonTooltips(); renderMap(); if (typeof data_2024 !== 'undefined') loadElectionProfile(data_2024); });
