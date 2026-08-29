document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('plotterCanvas');
    const ctx = canvas.getContext('2d');
    const container = document.getElementById('coordinateContainer');
    const addBtn = document.getElementById('addPointBtn');
    const calculateBtn = document.getElementById('calculateBtn');
    
    let scale = 4.0;
    let offsetX = canvas.width / 2; 
    let offsetY = canvas.height / 2;
    let isDragging = false;
    let startX, startY;

    // Track active pointers for pinch-to-zoom support on touch devices
    const activePointers = new Map();
    let pinchStartDistance = null;
    let pinchStartScale = null;
    let pinchStartMidpoint = null;

    function resizeCanvas() {
        const oldWidth = canvas.width;
        const oldHeight = canvas.height;
        
        canvas.width = canvas.parentElement.clientWidth - 48; 
        canvas.height = canvas.width; 

        if (oldWidth === 0) {
            offsetX = canvas.width / 2;
            offsetY = canvas.height / 2;
        } else {
            offsetX = offsetX * (canvas.width / oldWidth);
            offsetY = offsetY * (canvas.height / oldHeight);
        }
        drawPlotOnly();
    }

    function getPoints() {
        const points = [];
        const rows = container.querySelectorAll('.coord-input-row');
        rows.forEach(row => {
            const x = parseFloat(row.querySelector('.coord-x').value) || 0;
            const y = parseFloat(row.querySelector('.coord-y').value) || 0;
            points.push({ x, y });
        });
        return points;
    }

    function autoFitScaleAndPan(points) {
        if (points.length === 0) return;

        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;

        points.forEach(p => {
            if (p.x < minX) minX = p.x;
            if (p.x > maxX) maxX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.y > maxY) maxY = p.y;
        });

        const buffer = 20; 
        const lotWidth = (maxX - minX) || 10;
        const lotHeight = (maxY - minY) || 10;

        const availableWidth = canvas.width - (buffer * 2);
        const availableHeight = canvas.height - (buffer * 2);

        const scaleX = availableWidth / lotWidth;
        const scaleY = availableHeight / lotHeight;
        scale = Math.min(scaleX, scaleY);

        scale = Math.min(Math.max(scale, 0.5), 45);

        const midX = (minX + maxX) / 2;
        const midY = (minY + maxY) / 2;

        offsetX = (canvas.width / 2) - (midX * scale);
        offsetY = (canvas.height / 2) + (midY * scale);
    }

    function updateRowIndicesAndState() {
        const rows = container.querySelectorAll('.coord-input-row');
        rows.forEach((row, idx) => {
            row.querySelector('.point-index').textContent = `P${idx + 1}`;
            const delBtn = row.querySelector('.delete-row-btn');
            delBtn.disabled = rows.length <= 3;
            delBtn.setAttribute('aria-label', `Delete point ${idx + 1}`);
            row.querySelector('.coord-x').setAttribute('aria-label', `Point ${idx + 1} X value`);
            row.querySelector('.coord-y').setAttribute('aria-label', `Point ${idx + 1} Y value`);
        });
    }

    function processLotCalculations() {
        const points = getPoints();
        let area = 0;
        let perimeter = 0;
        const n = points.length;

        if (n < 3) {
            document.getElementById('areaOutput').textContent = '0.00';
            document.getElementById('perimeterOutput').textContent = '0.00';
            return;
        }

        for (let i = 0; i < n; i++) {
            let j = (i + 1) % n;
            area += points[i].x * points[j].y;
            area -= points[j].x * points[i].y;
            
            let dx = points[j].x - points[i].x;
            let dy = points[j].y - points[i].y;
            perimeter += Math.sqrt(dx * dx + dy * dy);
        }
        
        area = Math.abs(area) / 2;

        document.getElementById('areaOutput').textContent = area.toFixed(2);
        document.getElementById('perimeterOutput').textContent = perimeter.toFixed(2);
        
        autoFitScaleAndPan(points);
        drawLotPolygon(points);
    }

    function drawPlotOnly() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawGridlines();
        const points = getPoints();
        renderNodesOnly(points);
    }

    function drawLotPolygon(points) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawGridlines();

        if (points.length === 0) return;

        function toCanvasSpace(p) {
            return {
                x: offsetX + (p.x * scale),
                y: offsetY - (p.y * scale) 
            };
        }

        ctx.beginPath();
        points.forEach((pt, idx) => {
            let cPt = toCanvasSpace(pt);
            if (idx === 0) ctx.moveTo(cPt.x, cPt.y);
            else ctx.lineTo(cPt.x, cPt.y);
        });
        if (points.length > 2) ctx.closePath();
        ctx.strokeStyle = '#FCD34D';
        ctx.lineWidth = 3;
        ctx.lineJoin = 'round';
        ctx.stroke();
        ctx.fillStyle = 'rgba(252, 211, 77, 0.15)';
        ctx.fill();

        renderNodesOnly(points);
    }

    function drawGridlines() {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 1;
        let gridSize = 20 * scale;
        
        while (gridSize < 15) gridSize *= 2;
        while (gridSize > 120) gridSize /= 2;

        let startGridX = offsetX % gridSize;
        for (let x = startGridX; x < canvas.width; x += gridSize) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
        }
        let startGridY = offsetY % gridSize;
        for (let y = startGridY; y < canvas.height; y += gridSize) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
        }

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(0, offsetY); ctx.lineTo(canvas.width, offsetY); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(offsetX, 0); ctx.lineTo(offsetX, canvas.height); ctx.stroke();
    }

    function renderNodesOnly(points) {
        function toCanvasSpace(p) {
            return {
                x: offsetX + (p.x * scale),
                y: offsetY - (p.y * scale) 
            };
        }
        points.forEach((pt, idx) => {
            let cPt = toCanvasSpace(pt);
            ctx.beginPath();
            ctx.arc(cPt.x, cPt.y, 6, 0, 2 * Math.PI);
            ctx.fillStyle = '#3B82F6';
            ctx.fill();
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 2;
            ctx.stroke();

            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold 12px Arial';
            ctx.fillText(`P${idx + 1}`, cPt.x + 10, cPt.y - 10);
        });
    }

    addBtn.addEventListener('click', () => {
        const row = document.createElement('div');
        row.className = 'coord-input-row';
        row.innerHTML = `
            <span class="point-index">P</span>
            <input type="number" value="0" class="coord-field coord-x">
            <input type="number" value="0" class="coord-field coord-y">
            <button type="button" class="delete-row-btn"><i class="fa-solid fa-trash-can"></i></button>
        `;
        container.appendChild(row);
        updateRowIndicesAndState();
        container.scrollTop = container.scrollHeight;
        
        const points = getPoints();
        autoFitScaleAndPan(points);
        drawPlotOnly();
    });

    container.addEventListener('click', (e) => {
        const targetBtn = e.target.closest('.delete-row-btn');
        if (!targetBtn || targetBtn.disabled) return;
        
        const row = targetBtn.closest('.coord-input-row');
        row.remove();
        updateRowIndicesAndState();
        
        const points = getPoints();
        autoFitScaleAndPan(points);
        drawPlotOnly();
    });

    calculateBtn.addEventListener('click', processLotCalculations);

    // ---- Pan & zoom via Pointer Events (works for mouse, touch, and pen) ----

    function getCanvasRelativePoint(e) {
        const rect = canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }

    function getPinchDistanceAndMidpoint() {
        const pts = Array.from(activePointers.values());
        const dx = pts[0].x - pts[1].x;
        const dy = pts[0].y - pts[1].y;
        return {
            distance: Math.sqrt(dx * dx + dy * dy),
            midpoint: {
                x: (pts[0].x + pts[1].x) / 2,
                y: (pts[0].y + pts[1].y) / 2
            }
        };
    }

    canvas.addEventListener('pointerdown', (e) => {
        canvas.setPointerCapture(e.pointerId);
        activePointers.set(e.pointerId, getCanvasRelativePoint(e));

        if (activePointers.size === 1) {
            isDragging = true;
            startX = e.clientX - offsetX;
            startY = e.clientY - offsetY;
        } else if (activePointers.size === 2) {
            // Starting a pinch gesture — stop single-finger panning
            isDragging = false;
            const { distance, midpoint } = getPinchDistanceAndMidpoint();
            pinchStartDistance = distance;
            pinchStartScale = scale;
            pinchStartMidpoint = midpoint;
        }
    });

    function endPointer(e) {
        activePointers.delete(e.pointerId);
        if (activePointers.size < 2) {
            pinchStartDistance = null;
        }
        if (activePointers.size === 0) {
            isDragging = false;
        } else if (activePointers.size === 1) {
            // Dropped back to one finger — resume panning from here
            const remaining = Array.from(activePointers.values())[0];
            const rect = canvas.getBoundingClientRect();
            isDragging = true;
            startX = (remaining.x + rect.left) - offsetX;
            startY = (remaining.y + rect.top) - offsetY;
        }
    }

    canvas.addEventListener('pointerup', endPointer);
    canvas.addEventListener('pointercancel', endPointer);
    canvas.addEventListener('pointerleave', (e) => {
        if (activePointers.has(e.pointerId)) endPointer(e);
    });

    canvas.addEventListener('pointermove', (e) => {
        if (!activePointers.has(e.pointerId)) return;
        activePointers.set(e.pointerId, getCanvasRelativePoint(e));

        if (activePointers.size === 2 && pinchStartDistance) {
            // Pinch-to-zoom
            const { distance, midpoint } = getPinchDistanceAndMidpoint();
            const rawScale = pinchStartScale * (distance / pinchStartDistance);
            const newScale = Math.min(Math.max(rawScale, 0.5), 50);

            const mathX = (pinchStartMidpoint.x - offsetX) / scale;
            const mathY = (offsetY - pinchStartMidpoint.y) / scale;

            scale = newScale;
            offsetX = midpoint.x - (mathX * scale);
            offsetY = midpoint.y + (mathY * scale);

            drawLotPolygon(getPoints());
            return;
        }

        if (isDragging && activePointers.size === 1) {
            offsetX = e.clientX - startX;
            offsetY = e.clientY - startY;
            drawLotPolygon(getPoints());
        }
    });

    // Mouse wheel zoom (desktop trackpads/mice)
    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const zoomFactor = 1.1;
        const mouseX = e.clientX - canvas.getBoundingClientRect().left;
        const mouseY = e.clientY - canvas.getBoundingClientRect().top;

        const mathX = (mouseX - offsetX) / scale;
        const mathY = (offsetY - mouseY) / scale;

        if (e.deltaY < 0) scale *= zoomFactor;
        else scale /= zoomFactor;

        scale = Math.min(Math.max(scale, 0.5), 50);

        offsetX = mouseX - (mathX * scale);
        offsetY = mouseY + (mathY * scale);
        
        const points = getPoints();
        drawLotPolygon(points);
    }, { passive: false });

    window.addEventListener('resize', resizeCanvas);
    
    updateRowIndicesAndState();
    setTimeout(resizeCanvas, 100);

    const areaShapeSelector = document.getElementById('areaShapeSelector');
    const areaInputsContainer = document.getElementById('areaInputsContainer');
    const btnCalcArea = document.getElementById('btnCalcArea');
    const areaUnitSelector = document.getElementById('areaUnitSelector');
    const lblAreaResult = document.getElementById('lblAreaResult');
    const lblAreaUnit = document.getElementById('lblAreaUnit');

    const volumeShapeSelector = document.getElementById('volumeShapeSelector');
    const volumeInputsContainer = document.getElementById('volumeInputsContainer');
    const btnCalcVolume = document.getElementById('btnCalcVolume');
    const volumeUnitSelector = document.getElementById('volumeUnitSelector');
    const lblVolumeResult = document.getElementById('lblVolumeResult');
    const lblVolumeUnit = document.getElementById('lblVolumeUnit');

    const areaFields = {
        square: ['<label for="side">Side Value (m)</label><input type="number" id="side" class="coord-field" value="0">'],
        rectangle: [
            '<label for="length">Length Value (m)</label><input type="number" id="length" class="coord-field" value="0">',
            '<label for="width">Width Value (m)</label><input type="number" id="width" class="coord-field" value="0">'
        ],
        circle: ['<label for="radius">Radius Value (m)</label><input type="number" id="radius" class="coord-field" value="0">'],
        triangle: [
            '<label for="base">Base Value (m)</label><input type="number" id="base" class="coord-field" value="0">',
            '<label for="height">Height Value (m)</label><input type="number" id="height" class="coord-field" value="0">'
        ],
        trapezoid: [
            '<label for="baseA">Base A Value (m)</label><input type="number" id="baseA" class="coord-field" value="0">',
            '<label for="baseB">Base B Value (m)</label><input type="number" id="baseB" class="coord-field" value="0">',
            '<label for="trapHeight">Vertical Height (m)</label><input type="number" id="trapHeight" class="coord-field" value="0">'
        ]
    };

    const volumeFields = {
        cube: ['<label for="edge">Edge Value (m)</label><input type="number" id="edge" class="coord-field" value="0">'],
        prism: [
            '<label for="prismLength">Length Value (m)</label><input type="number" id="prismLength" class="coord-field" value="0">',
            '<label for="prismWidth">Width Value (m)</label><input type="number" id="prismWidth" class="coord-field" value="0">',
            '<label for="prismHeight">Height Value (m)</label><input type="number" id="prismHeight" class="coord-field" value="0">'
        ],
        cylinder: [
            '<label for="cylRadius">Radius Value (m)</label><input type="number" id="cylRadius" class="coord-field" value="0">',
            '<label for="cylHeight">Height Value (m)</label><input type="number" id="cylHeight" class="coord-field" value="0">'
        ],
        sphere: ['<label for="sphRadius">Radius Value (m)</label><input type="number" id="sphRadius" class="coord-field" value="0">'],
        cone: [
            '<label for="coneRadius">Radius Value (m)</label><input type="number" id="coneRadius" class="coord-field" value="0">',
            '<label for="coneHeight">Height Value (m)</label><input type="number" id="coneHeight" class="coord-field" value="0">'
        ]
    };

    function renderInputs(selector, container, fieldsMap) {
        container.innerHTML = '';
        const shape = selector.value;
        fieldsMap[shape].forEach(htmlStr => {
            const wrapper = document.createElement('div');
            wrapper.className = 'calc-input-group';
            wrapper.innerHTML = htmlStr;
            container.appendChild(wrapper);
        });
    }

    areaShapeSelector.addEventListener('change', () => renderInputs(areaShapeSelector, areaInputsContainer, areaFields));
    volumeShapeSelector.addEventListener('change', () => renderInputs(volumeShapeSelector, volumeInputsContainer, volumeFields));

    renderInputs(areaShapeSelector, areaInputsContainer, areaFields);
    renderInputs(volumeShapeSelector, volumeInputsContainer, volumeFields);

    function convertArea(valInSqM, targetUnit) {
        switch(targetUnit) {
            case 'sq_cm': return valInSqM * 10000;
            case 'sq_ft': return valInSqM * 10.76391;
            case 'hectare': return valInSqM / 10000;
            case 'acre': return valInSqM / 4046.856;
            default: return valInSqM;
        }
    }

    btnCalcArea.addEventListener('click', () => {
        const shape = areaShapeSelector.value;
        let areaInMeters = 0;

        if (shape === 'square') {
            const s = parseFloat(document.getElementById('side').value) || 0;
            areaInMeters = s * s;
        } else if (shape === 'rectangle') {
            const l = parseFloat(document.getElementById('length').value) || 0;
            const w = parseFloat(document.getElementById('width').value) || 0;
            areaInMeters = l * w;
        } else if (shape === 'circle') {
            const r = parseFloat(document.getElementById('radius').value) || 0;
            areaInMeters = Math.PI * r * r;
        } else if (shape === 'triangle') {
            const b = parseFloat(document.getElementById('base').value) || 0;
            const h = parseFloat(document.getElementById('height').value) || 0;
            areaInMeters = 0.5 * b * h;
        } else if (shape === 'trapezoid') {
            const a = parseFloat(document.getElementById('baseA').value) || 0;
            const b = parseFloat(document.getElementById('baseB').value) || 0;
            const h = parseFloat(document.getElementById('trapHeight').value) || 0;
            areaInMeters = 0.5 * (a + b) * h;
        }

        const targetUnit = areaUnitSelector.value;
        const converted = convertArea(areaInMeters, targetUnit);
        lblAreaResult.textContent = converted.toFixed(2);
        lblAreaUnit.textContent = areaUnitSelector.options[areaUnitSelector.selectedIndex].text.split('(')[1].replace(')', '');
    });

    function convertVolume(valInCuM, targetUnit) {
        switch(targetUnit) {
            case 'cu_cm': return valInCuM * 1000000;
            case 'cu_ft': return valInCuM * 35.31467;
            case 'liter': return valInCuM * 1000;
            case 'gallon': return valInCuM * 264.172;
            default: return valInCuM;
        }
    }

    btnCalcVolume.addEventListener('click', () => {
        const shape = volumeShapeSelector.value;
        let volInMeters = 0;

        if (shape === 'cube') {
            const e = parseFloat(document.getElementById('edge').value) || 0;
            volInMeters = Math.pow(e, 3);
        } else if (shape === 'prism') {
            const l = parseFloat(document.getElementById('prismLength').value) || 0;
            const w = parseFloat(document.getElementById('prismWidth').value) || 0;
            const h = parseFloat(document.getElementById('prismHeight').value) || 0;
            volInMeters = l * w * h;
        } else if (shape === 'cylinder') {
            const r = parseFloat(document.getElementById('cylRadius').value) || 0;
            const h = parseFloat(document.getElementById('cylHeight').value) || 0;
            volInMeters = Math.PI * r * r * h;
        } else if (shape === 'sphere') {
            const r = parseFloat(document.getElementById('sphRadius').value) || 0;
            volInMeters = (4/3) * Math.PI * Math.pow(r, 3);
        } else if (shape === 'cone') {
            const r = parseFloat(document.getElementById('coneRadius').value) || 0;
            const h = parseFloat(document.getElementById('coneHeight').value) || 0;
            volInMeters = (1/3) * Math.PI * r * r * h;
        }

        const targetUnit = volumeUnitSelector.value;
        const converted = convertVolume(volInMeters, targetUnit);
        lblVolumeResult.textContent = converted.toFixed(2);
        lblVolumeUnit.textContent = volumeUnitSelector.options[volumeUnitSelector.selectedIndex].text.split('(')[1].replace(')', '');
    });
});
