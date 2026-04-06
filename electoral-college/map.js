// map.js - Handles D3 Rendering and Tooltips

function renderMap() {
    const primaryUrl = "https://cdn.jsdelivr.net/npm/us-atlas@3/states-albers-10m.json";
    const backupUrl = "https://unpkg.com/us-atlas@3/states-albers-10m.json";

    d3.json(primaryUrl).then(us => {
        drawStates(us);
    }).catch(error => {
        console.warn("Primary map server failed. Trying backup...", error);
        d3.json(backupUrl).then(us => {
            drawStates(us);
        }).catch(backupError => {
            console.error("FATAL: Could not load map data.", backupError);
            document.getElementById('overall-winner').innerHTML = '<span style="color:var(--red);">Error: Map data blocked. Check Console.</span>';
        });
    });

    function drawStates(usData) {
        d3.select("#states-group").selectAll("path")
            .data(topojson.feature(usData, usData.objects.states).features)
            .enter().append("path").attr("class", "state-path").attr("d", d3.geoPath())
            .attr("id", d => `map-${d.properties.name.replace(/\s+/g, '-')}`)
            .on("mousemove", showTooltip).on("mouseout", hideTooltip);
        updateCalculations(); 
    }
}

function setupRibbonTooltips() {
    document.querySelectorAll('.ribbon-segment').forEach(seg => {
        seg.addEventListener('mousemove', (e) => {
            const id = seg.id.replace('rib-', '');
            const nameMap = { blue: document.getElementById('nameBlue').value, yellow: document.getElementById('nameYellow').value, red: document.getElementById('nameRed').value, white: 'Did Not Vote' };
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
}

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
    
    tooltip.style.display = 'flex'; tooltip.style.left = (event.pageX + 15) + 'px'; tooltip.style.top = (event.pageY + 15) + 'px';
}
function hideTooltip() { tooltip.style.display = 'none'; }