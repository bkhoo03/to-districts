// ---------------------------------------------------------------------------
// Map setup
// ---------------------------------------------------------------------------
const map = L.map('map', {
    center: [43.6510, -79.3870],
    zoom: 14,
    zoomControl: false,
    attributionControl: true,
    zoomSnap: 0.25,
    zoomDelta: 1,
    wheelPxPerZoomLevel: 60
});

L.control.zoom({ position: 'topright' }).addTo(map);

// ---------------------------------------------------------------------------
// Base maps (switchable) — solves the "black screen when overlays are off"
// ---------------------------------------------------------------------------
const BASE_MAPS = {
    dark: L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OSM &copy; CARTO', subdomains: 'abcd', maxZoom: 20
    }),
    detailed: L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OSM &copy; CARTO', subdomains: 'abcd', maxZoom: 20
    }),
    satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri', maxZoom: 19
    }),
    light: L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OSM &copy; CARTO', subdomains: 'abcd', maxZoom: 20
    })
};
let currentBase = BASE_MAPS.detailed.addTo(map);

function setBaseMap(key) {
    if (BASE_MAPS[key] === currentBase) return;
    map.removeLayer(currentBase);
    currentBase = BASE_MAPS[key].addTo(map);
    currentBase.bringToBack();
    const isDark = key === 'dark';
    const isSat = key === 'satellite';
    document.body.classList.toggle('dark-base', isDark);
    document.body.classList.toggle('sat-mode', isSat);
    updateOverlayForZoom(); // re-apply zoom-based styling for new base
}

// Layer groups (so they can be toggled)
const districtsLayer = L.layerGroup().addTo(map);
const labelsLayer = L.layerGroup().addTo(map);
const subwayLayer = L.layerGroup().addTo(map);
const searchLayer = L.layerGroup().addTo(map); // temp markers from geocoder
const highlightLayer = L.layerGroup().addTo(map); // pulsing circle on selected location

// POI — one layer group per category so they can be toggled individually
const poiLayersByCategory = {};
Object.keys(POI_CATEGORIES).forEach(key => {
    poiLayersByCategory[key] = L.layerGroup().addTo(map);
});

const districtLayers = [];
let activeDistrict = null;

// ---------------------------------------------------------------------------
// District polygons + centered labels
// ---------------------------------------------------------------------------
DISTRICTS.forEach((district) => {
    const polygon = L.polygon(district.coordinates, {
        color: district.color,
        weight: 1.5,
        opacity: 0.6,
        fillColor: district.color,
        fillOpacity: 0.18,
        smoothFactor: 1
    });
    districtsLayer.addLayer(polygon);

    polygon.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        selectDistrict(district, polygon);
    });
    polygon.on('mouseover', () => {
        if (activeDistrict !== polygon) polygon.setStyle({ fillOpacity: 0.32, weight: 2.5 });
    });
    polygon.on('mouseout', () => {
        if (activeDistrict !== polygon) polygon.setStyle({ fillOpacity: 0.18, weight: 1.5 });
    });

    // Centered label using transform translate(-50%,-50%)
    const label = L.marker(district.center, {
        icon: L.divIcon({
            className: 'district-label',
            html: `<span class="dlabel" style="color:${district.color}">${district.name}</span>`,
            iconSize: [0, 0],
            iconAnchor: [0, 0]
        }),
        interactive: false,
        keyboard: false
    });
    labelsLayer.addLayer(label);

    districtLayers.push({ polygon, label, district });
});

function selectDistrict(district, polygon) {
    if (activeDistrict) activeDistrict.setStyle({ fillOpacity: 0.18, weight: 1.5 });
    if (polygon) {
        activeDistrict = polygon;
        polygon.setStyle({ fillOpacity: 0.4, weight: 2.5 });
    }
    showDistrictInfo(district);
}

// ---------------------------------------------------------------------------
// Subway lines + stations
// ---------------------------------------------------------------------------
// Draw the coloured route lines first (so stations sit on top)
Object.values(SUBWAY_LINES).forEach((line) => {
    // subtle dark casing underneath for contrast
    L.polyline(line.path, { color: '#000', weight: 8, opacity: 0.35, lineCap: 'round', lineJoin: 'round' }).addTo(subwayLayer);
    L.polyline(line.path, { color: line.color, weight: 4, opacity: 0.95, lineCap: 'round', lineJoin: 'round' })
        .bindTooltip(line.name, { sticky: true, className: 'map-tooltip' })
        .addTo(subwayLayer);
});

// Station markers: white rounded "ticks" (clearly different from POI dots)
function stationIcon(interchange) {
    return L.divIcon({
        className: 'station-wrap',
        html: `<span class="station-tick ${interchange ? 'interchange' : ''}"></span>`,
        iconSize: [interchange ? 12 : 9, interchange ? 12 : 9],
        iconAnchor: [interchange ? 6 : 4.5, interchange ? 6 : 4.5]
    });
}
SUBWAY_STATIONS.forEach((station) => {
    const interchange = station.line.includes("&");
    const marker = L.marker([station.lat, station.lng], { icon: stationIcon(interchange), zIndexOffset: 500 });
    marker.bindTooltip(`${station.name} Station · Line ${station.line}`, {
        direction: 'top', className: 'map-tooltip', offset: [0, -8]
    });
    marker.on('click', () => {
        if (routingMode) {
            handleRouteDestination(station.lat, station.lng, station.name + ' Station');
            return;
        }
    });
    subwayLayer.addLayer(marker);
});

// ---------------------------------------------------------------------------
// Points of interest — clean category-coloured pins
// ---------------------------------------------------------------------------
function poiIcon(color, active = false) {
    return L.divIcon({
        className: 'poi-pin-wrap',
        html: `<span class="poi-pin ${active ? 'active' : ''}" style="--pin:${color}"></span>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7]
    });
}

POINTS_OF_INTEREST.forEach((poi) => {
    const cat = POI_CATEGORIES[poi.cat];
    const marker = L.marker([poi.lat, poi.lng], { icon: poiIcon(cat.color) });
    marker.bindTooltip(poi.name, { direction: 'top', className: 'map-tooltip', offset: [0, -8] });
    marker.on('click', () => {
        // If in routing mode, use this POI as destination
        if (routingMode) {
            handleRouteDestination(poi.lat, poi.lng, poi.name);
            return;
        }
        // Close timetable if it was in minimised/location mode
        timetablePanel.classList.add('hidden');
        timetablePanel.classList.remove('minimised');

        const district = DISTRICTS.find(d => d.name === poi.district);
        showPoiInfo(poi, district);
        highlightLocation(poi.lat, poi.lng);
    });
    poiLayersByCategory[poi.cat].addLayer(marker);
});

// Build per-category POI toggles in the layers panel
const poiTogglesEl = document.getElementById('poi-toggles');
poiTogglesEl.innerHTML = Object.entries(POI_CATEGORIES).map(([key, cat]) =>
    `<label class="layer-row">
        <input type="checkbox" data-poi-cat="${key}" checked>
        <span><span class="dot" style="background:${cat.color}; display:inline-block; width:8px; height:8px; border-radius:50%; margin-right:6px;"></span>${cat.label}</span>
    </label>`
).join('');

poiTogglesEl.querySelectorAll('input[data-poi-cat]').forEach(cb => {
    cb.addEventListener('change', (e) => {
        const cat = e.target.dataset.poiCat;
        if (e.target.checked) map.addLayer(poiLayersByCategory[cat]);
        else map.removeLayer(poiLayersByCategory[cat]);
    });
});

// ---------------------------------------------------------------------------
// Info panel
// ---------------------------------------------------------------------------
const infoPanel = document.getElementById('info-panel');

function showDistrictInfo(district) {
    document.getElementById('info-title').innerHTML =
        `<span class="info-color" style="background:${district.color}"></span> ${district.name}`;
    document.getElementById('info-description').textContent = district.description;
    document.getElementById('info-highlights').innerHTML = '';
    infoPanel.classList.remove('hidden');
}

function showPoiInfo(poi, district) {
    const cat = POI_CATEGORIES[poi.cat];
    document.getElementById('info-title').innerHTML =
        `<span class="info-color" style="background:${cat.color}"></span> ${poi.name}`;
    document.getElementById('info-description').textContent =
        district ? `${cat.label} · ${district.name}` : cat.label;
    document.getElementById('info-highlights').innerHTML = '';
    infoPanel.classList.remove('hidden');
}

function showPlaceInfo(name, typeLabel, districtName) {
    document.getElementById('info-title').innerHTML =
        `<span class="info-color" style="background:#58a6ff"></span> ${name}`;
    document.getElementById('info-description').textContent =
        districtName ? `${typeLabel} · Located in ${districtName}` : typeLabel;
    document.getElementById('info-highlights').innerHTML = '';
    infoPanel.classList.remove('hidden');
}

document.getElementById('info-close').addEventListener('click', () => {
    clearSelection();
    // If timetable was minimised (we came from timetable), expand it back
    if (!timetablePanel.classList.contains('hidden') && timetablePanel.classList.contains('minimised')) {
        highlightLayer.clearLayers();
        searchLayer.clearLayers();
        timetablePanel.classList.remove('minimised');
    }
});

// Close info panel on any map click
map.on('click', (e) => {
    const zoom = map.getZoom();

    // If in routing mode, set destination
    if (routingMode) {
        const { lat, lng } = e.latlng;
        fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=18`, { headers: { 'User-Agent': 'TODistricts' } })
            .then(r => r.json())
            .then(data => {
                const name = data.name || data.address?.road || 'Destination';
                handleRouteDestination(lat, lng, name);
            })
            .catch(() => handleRouteDestination(lat, lng, 'Destination'));
        return;
    }

    // If timetable is minimised (location mode), exit timetable entirely
    if (!timetablePanel.classList.contains('hidden')) {
        timetablePanel.classList.add('hidden');
        timetablePanel.classList.remove('minimised');
    }

    // If zoomed in (districts hidden), drop a pin and reverse-geocode
    if (zoom >= 14.5) {
        const { lat, lng } = e.latlng;
        reverseGeocode(lat, lng);
    } else {
        clearSelection();
    }
});

function clearSelection() {
    infoPanel.classList.add('hidden');
    highlightLayer.clearLayers();
    searchLayer.clearLayers();
    if (activeDistrict) {
        activeDistrict.setStyle({ fillOpacity: 0.18, weight: 1.5 });
        activeDistrict = null;
    }
}

// Central function: close everything, reset all modes
function closeAllPanels() {
    clearSelection();
    searchPanel.classList.add('hidden');
    layersPanel.classList.add('hidden');
    dlPanel.classList.add('hidden');
    savedPlacesPanel.classList.add('hidden');
    timetablePanel.classList.add('hidden');
    timetablePanel.classList.remove('minimised');
    routePanel.classList.add('hidden');
    highlightLayer.clearLayers();
    searchLayer.clearLayers();
    // Exit routing mode if active
    if (routingMode || document.body.classList.contains('routing-active')) {
        routingMode = false;
        routeOrigin = null;
        routeLayer.clearLayers();
        document.body.classList.remove('routing-active');
    }
}

function highlightLocation(lat, lng) {
    highlightLayer.clearLayers();
    L.circleMarker([lat, lng], {
        radius: 18, color: '#1a73e8', weight: 3,
        fillColor: '#1a73e8', fillOpacity: 0.12,
        className: 'pulse-marker'
    }).addTo(highlightLayer);
}

// ---------------------------------------------------------------------------
// Layer toggles
// ---------------------------------------------------------------------------
const layersToggle = document.getElementById('layers-toggle');
const layersPanel = document.getElementById('layers-panel');

layersToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    closeAllPanels();
    layersPanel.classList.remove('hidden');
});

function bindToggle(id, layer) {
    document.getElementById(id).addEventListener('change', (e) => {
        if (e.target.checked) map.addLayer(layer);
        else map.removeLayer(layer);
    });
}
bindToggle('toggle-districts', districtsLayer);
bindToggle('toggle-labels', labelsLayer);
bindToggle('toggle-subway', subwayLayer);

// Base map buttons
document.querySelectorAll('.basemap-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.basemap-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        setBaseMap(btn.dataset.base);
    });
});

// ---------------------------------------------------------------------------
// Search — local data + live OpenStreetMap (Photon) geocoder
// ---------------------------------------------------------------------------
const searchToggle = document.getElementById('search-toggle');
const searchPanel = document.getElementById('search-panel');
const searchInput = document.getElementById('search-input');
const searchResults = document.getElementById('search-results');
const searchSpinner = document.getElementById('search-spinner');

searchToggle.addEventListener('click', () => {
    const wasOpen = !searchPanel.classList.contains('hidden');
    closeAllPanels();
    if (!wasOpen) {
        searchPanel.classList.remove('hidden');
        // Temporarily hide route panel while searching
        routePanel.classList.add('hidden');
        searchInput.focus();
    }
});

let searchDebounce = null;
let lastQueryId = 0;

searchInput.addEventListener('input', (e) => {
    const query = e.target.value.trim();
    clearTimeout(searchDebounce);

    if (query.length < 2) {
        searchResults.innerHTML = '';
        searchSpinner.classList.add('hidden');
        return;
    }

    // Local results render immediately
    const local = getLocalResults(query.toLowerCase());
    renderResults(local, []);

    // Debounced remote geocoding
    searchSpinner.classList.remove('hidden');
    const queryId = ++lastQueryId;
    searchDebounce = setTimeout(() => geocode(query, queryId, local), 500);
});

function getLocalResults(q) {
    const results = [];
    DISTRICTS.forEach(d => {
        const s = matchScore(q, d.name, d.description, d.highlights);
        if (s > 0) results.push({ type: 'district', name: d.name, score: s, ref: d });
    });
    POINTS_OF_INTEREST.forEach(p => {
        const s = matchScore(q, p.name, p.district);
        if (s > 0) results.push({ type: 'poi', name: p.name, sub: p.district, score: s, ref: p });
    });
    SUBWAY_STATIONS.forEach(st => {
        if (st.name.toLowerCase().includes(q)) {
            results.push({ type: 'subway', name: st.name, sub: `Line ${st.line}`, score: st.name.toLowerCase().startsWith(q) ? 4 : 2, ref: st });
        }
    });
    return results.sort((a, b) => b.score - a.score).slice(0, 6);
}

async function geocode(query, queryId, localResults) {
    try {
        // Nominatim (official OpenStreetMap geocoder) — better coverage than Photon
        const url = `https://nominatim.openstreetmap.org/search?`
            + `q=${encodeURIComponent(query + ', Toronto, Canada')}`
            + `&format=json&addressdetails=1&limit=8`
            + `&viewbox=-79.50,43.70,-79.30,43.62&bounded=0`;
        const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
        const data = await res.json();
        if (queryId !== lastQueryId) return;

        const remote = (data || []).map(item => ({
            type: 'place',
            name: item.name || item.display_name.split(',')[0],
            sub: [item.type?.replace(/_/g, ' '), item.display_name.split(',').slice(1, 3).join(',').trim()].filter(Boolean).join(' · '),
            lat: parseFloat(item.lat),
            lng: parseFloat(item.lon)
        })).filter(r => r.name && Math.abs(r.lat - 43.65) < 0.15 && Math.abs(r.lng + 79.38) < 0.2);

        renderResults(localResults, remote);
    } catch (err) {
        // network error — keep local results only
    } finally {
        if (queryId === lastQueryId) searchSpinner.classList.add('hidden');
    }
}

function renderResults(local, remote) {
    const rows = [];

    local.forEach(r => {
        let icon = '📍', typeLabel = 'Neighbourhood';
        if (r.type === 'poi') { icon = '◉'; typeLabel = r.sub; }
        else if (r.type === 'subway') { icon = '🚇'; typeLabel = r.sub + ' · TTC'; }
        rows.push(`<li data-kind="${r.type}" data-name="${escapeAttr(r.name)}">
            <span class="result-icon">${icon}</span>
            <span class="result-text">
                <span class="result-name">${r.name}</span>
                <span class="result-type">${typeLabel}</span>
            </span></li>`);
    });

    if (remote.length) {
        rows.push(`<li class="result-header">Other places (OpenStreetMap)</li>`);
        remote.forEach(r => {
            rows.push(`<li data-kind="place" data-lat="${r.lat}" data-lng="${r.lng}" data-name="${escapeAttr(r.name)}" data-sub="${escapeAttr(r.sub)}">
                <span class="result-icon">🌐</span>
                <span class="result-text">
                    <span class="result-name">${r.name}</span>
                    <span class="result-type">${r.sub || 'Place'}</span>
                </span></li>`);
        });
    }

    searchResults.innerHTML = rows.join('');
    searchResults.querySelectorAll('li[data-kind]').forEach(li => {
        li.addEventListener('click', () => handleResultClick(li));
    });
}

function handleResultClick(li) {
    const kind = li.dataset.kind;
    const name = li.dataset.name;

    let lat, lng, placeName;

    if (kind === 'district') {
        const d = DISTRICTS.find(x => x.name === name);
        const layer = districtLayers.find(l => l.district === d);
        map.fitBounds(layer.polygon.getBounds(), { padding: [40, 40] });
        selectDistrict(d, layer.polygon);
        closeSearch();
        return;
    } else if (kind === 'poi') {
        const p = POINTS_OF_INTEREST.find(x => x.name === name);
        lat = p.lat; lng = p.lng; placeName = p.name;
        map.setView([lat, lng], 17);
    } else if (kind === 'subway') {
        const st = SUBWAY_STATIONS.find(x => x.name === name);
        lat = st.lat; lng = st.lng; placeName = st.name + ' Station';
        map.setView([lat, lng], 16);
    } else if (kind === 'place') {
        lat = parseFloat(li.dataset.lat);
        lng = parseFloat(li.dataset.lng);
        placeName = name;
    }

    closeSearch();

    // If in routing mode, use this as destination
    if (routingMode && lat && lng) {
        handleRouteDestination(lat, lng, placeName);
        return;
    }

    // Otherwise normal behaviour
    if (kind === 'poi') {
        const p = POINTS_OF_INTEREST.find(x => x.name === name);
        const d = DISTRICTS.find(x => x.name === p.district);
        showPoiInfo(p, d);
    } else if (kind === 'place') {
        dropSearchMarker(lat, lng, placeName, li.dataset.sub);
    }
}

function dropSearchMarker(lat, lng, name, sub) {
    // If in routing mode, use this as destination
    if (routingMode) {
        handleRouteDestination(lat, lng, name);
        return;
    }

    searchLayer.clearLayers();
    const marker = L.marker([lat, lng], {
        icon: L.divIcon({
            className: 'search-pin-wrap',
            html: `<span class="search-pin"></span>`,
            iconSize: [20, 20],
            iconAnchor: [10, 10]
        })
    });
    marker.addTo(searchLayer);
    map.setView([lat, lng], 17);

    // Which district does it fall in?
    const d = findDistrictAtPoint(lat, lng);
    showPlaceInfo(name, sub || 'Place', d ? d.name : null);
    if (d) {
        const layer = districtLayers.find(l => l.district === d);
        if (layer) selectDistrict(d, layer.polygon);
    }
}

function closeSearch() {
    searchPanel.classList.add('hidden');
    searchInput.value = '';
    searchResults.innerHTML = '';
    searchSpinner.classList.add('hidden');
}

function matchScore(q, ...fields) {
    let score = 0;
    fields.flat().forEach(f => {
        const v = (f || '').toLowerCase();
        if (v.startsWith(q)) score += 5;
        else if (v.includes(q)) score += 3;
    });
    return score;
}

function escapeAttr(s) {
    return (s || '').replace(/"/g, '&quot;');
}

// ---------------------------------------------------------------------------
// All-neighbourhoods browser
// ---------------------------------------------------------------------------
const dlBtn = document.getElementById('districts-list-btn');
const dlPanel = document.getElementById('districts-list-panel');
const dlList = document.getElementById('districts-list');

dlList.innerHTML = [...DISTRICTS]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(d => `<li data-name="${escapeAttr(d.name)}">
        <span class="legend-color" style="background:${d.color}"></span>${d.name}</li>`)
    .join('');

dlList.querySelectorAll('li').forEach(li => {
    li.addEventListener('click', () => {
        const d = DISTRICTS.find(x => x.name === li.dataset.name);
        const layer = districtLayers.find(l => l.district === d);
        map.fitBounds(layer.polygon.getBounds(), { padding: [40, 40] });
        selectDistrict(d, layer.polygon);
        dlPanel.classList.add('hidden');
    });
});

dlBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    dlPanel.classList.toggle('hidden');
    layersPanel.classList.add('hidden');
});

// ---------------------------------------------------------------------------
// Geolocation
// ---------------------------------------------------------------------------
const locateBtn = document.createElement('button');
locateBtn.id = 'locate-btn';
locateBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/></svg>`;
locateBtn.setAttribute('aria-label', 'Find my location');
document.getElementById('app').appendChild(locateBtn);

let userMarker = null, userAccuracy = null;

locateBtn.addEventListener('click', () => {
    if (!navigator.geolocation) { showToast('Geolocation not supported'); return; }
    locateBtn.classList.add('locating');
    navigator.geolocation.getCurrentPosition(
        (pos) => {
            const { latitude, longitude, accuracy } = pos.coords;
            locateBtn.classList.remove('locating');
            if (userMarker) {
                userMarker.setLatLng([latitude, longitude]);
                userAccuracy.setLatLng([latitude, longitude]).setRadius(accuracy);
            } else {
                userAccuracy = L.circle([latitude, longitude], {
                    radius: accuracy, color: '#e94560', weight: 1,
                    fillColor: '#e94560', fillOpacity: 0.1
                }).addTo(map);
                userMarker = L.circleMarker([latitude, longitude], {
                    radius: 7, color: '#fff', weight: 3, fillColor: '#e94560', fillOpacity: 1
                }).addTo(map);
            }
            map.setView([latitude, longitude], 16);
            const d = findDistrictAtPoint(latitude, longitude);
            if (d) {
                const layer = districtLayers.find(l => l.district === d);
                selectDistrict(d, layer ? layer.polygon : null);
                showToast(`You're in ${d.name}`);
            } else {
                showToast("You're outside the mapped downtown area");
            }
        },
        () => { locateBtn.classList.remove('locating'); showToast('Could not get location — check permissions'); },
        { enableHighAccuracy: true, timeout: 10000 }
    );
});

// Ray-casting point-in-polygon
function findDistrictAtPoint(lat, lng) {
    for (const { district } of districtLayers) {
        if (pointInPolygon([lat, lng], district.coordinates)) return district;
    }
    return null;
}
function pointInPolygon(point, poly) {
    const [y, x] = point; let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const [yi, xi] = poly[i], [yj, xj] = poly[j];
        if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
}

// ---------------------------------------------------------------------------
// Routing — directions between two points
// ---------------------------------------------------------------------------
const routeLayer = L.layerGroup().addTo(map);
let routingMode = false;
let routeOrigin = null; // { lat, lng, name }

const routePanel = document.getElementById('route-panel');
const routeTitle = document.getElementById('route-title');
const routeInfo = document.getElementById('route-info');
const routeDetails = document.getElementById('route-details');
const routeClear = document.getElementById('route-clear');
const directionsBtn = document.getElementById('info-directions');

// Show directions button when a place is shown (has lat/lng)
function showDirectionsButton() {
    if (currentInfoPlace && currentInfoPlace.lat) {
        directionsBtn.classList.remove('hidden');
    } else {
        directionsBtn.classList.add('hidden');
    }
}

// Start routing mode
directionsBtn.addEventListener('click', () => {
    routeOrigin = { ...currentInfoPlace };
    routingMode = true;
    infoPanel.classList.add('hidden');
    searchPanel.classList.add('hidden');
    routePanel.classList.remove('hidden');
    document.body.classList.add('routing-active');
    routeTitle.textContent = `From: ${routeOrigin.name}`;
    routeInfo.textContent = 'Tap the map or search for a destination.';
    routeDetails.classList.add('hidden');
    routeClear.classList.add('hidden');

    // Mark origin
    routeLayer.clearLayers();
    L.circleMarker([routeOrigin.lat, routeOrigin.lng], {
        radius: 8, color: '#1a73e8', weight: 3, fillColor: '#fff', fillOpacity: 1
    }).addTo(routeLayer);
});

// Close routing
document.getElementById('route-close').addEventListener('click', exitRouting);
routeClear.addEventListener('click', exitRouting);

function exitRouting() {
    routingMode = false;
    routeOrigin = null;
    routePanel.classList.add('hidden');
    routeLayer.clearLayers();
    highlightLayer.clearLayers();
    document.body.classList.remove('routing-active');
}

// Handle destination selection (map tap while in routing mode)
function handleRouteDestination(lat, lng, name) {
    if (!routeOrigin) return;

    // Mark destination with highlight
    L.circleMarker([lat, lng], {
        radius: 8, color: '#e8453a', weight: 3, fillColor: '#fff', fillOpacity: 1
    }).addTo(routeLayer);

    // Pulsing circles on both points
    highlightLayer.clearLayers();
    L.circleMarker([routeOrigin.lat, routeOrigin.lng], {
        radius: 16, color: '#1a73e8', weight: 2.5,
        fillColor: '#1a73e8', fillOpacity: 0.1,
        className: 'pulse-marker'
    }).addTo(highlightLayer);
    L.circleMarker([lat, lng], {
        radius: 16, color: '#e8453a', weight: 2.5,
        fillColor: '#e8453a', fillOpacity: 0.1,
        className: 'pulse-marker'
    }).addTo(highlightLayer);

    routeTitle.textContent = `${routeOrigin.name} → ${name || 'Destination'}`;
    routeInfo.innerHTML = '<span class="route-spinner"></span> Calculating route…';
    routePanel.classList.remove('hidden');

    // Fetch walking route
    fetchRoute(routeOrigin.lat, routeOrigin.lng, lat, lng);
}

async function fetchRoute(lat1, lng1, lat2, lng2) {
    try {
        // OpenRouteService — foot-walking profile (handles campus paths)
        const ORS_KEY = 'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjNlOGRiZTAyNWM2NDQwYWY4MzY5MmQzYjQ3OTYxMjE5IiwiaCI6Im11cm11cjY0In0=';
        const url = `https://api.openrouteservice.org/v2/directions/foot-walking?api_key=${ORS_KEY}&start=${lng1},${lat1}&end=${lng2},${lat2}`;
        const res = await fetch(url);
        const data = await res.json();

        if (data.features && data.features.length > 0) {
            const route = data.features[0];
            const coords = route.geometry.coordinates.map(c => [c[1], c[0]]);
            const summary = route.properties.summary;

            // Draw route line
            L.polyline(coords, {
                color: '#1a73e8', weight: 5, opacity: 0.8,
                lineCap: 'round', lineJoin: 'round'
            }).addTo(routeLayer);

            // Show distance and time
            const distM = summary.distance;
            const distText = distM < 1000 ? `${Math.round(distM)} m` : `${(distM / 1000).toFixed(1)} km`;
            const walkMin = Math.round(summary.duration / 60);
            const timeText = walkMin < 1 ? '< 1 min' : `${walkMin} min`;
            document.getElementById('route-distance').textContent = distText;
            document.getElementById('route-time').textContent = timeText;
            routeDetails.classList.remove('hidden');
            routeClear.classList.remove('hidden');
            routeInfo.textContent = '';
            routePanel.classList.remove('hidden');

            // Fit map to route — gentle, don't zoom in too much
            map.fitBounds(L.polyline(coords).getBounds(), { padding: [60, 60], maxZoom: 16 });

            routingMode = false;
        } else {
            routeInfo.textContent = 'No route found. Try a different destination.';
        }
    } catch (err) {
        routeInfo.textContent = 'Could not calculate route. Check your connection.';
    }
}

// ---------------------------------------------------------------------------
// Reverse geocode — drop pin on map tap when zoomed in
// ---------------------------------------------------------------------------
async function reverseGeocode(lat, lng) {
    // Drop pin immediately
    searchLayer.clearLayers();
    const marker = L.marker([lat, lng], {
        icon: L.divIcon({
            className: 'search-pin-wrap',
            html: `<span class="search-pin"></span>`,
            iconSize: [20, 20],
            iconAnchor: [10, 10]
        })
    });
    marker.addTo(searchLayer);

    // Show loading state
    const d = findDistrictAtPoint(lat, lng);
    document.getElementById('info-title').innerHTML =
        `<span class="info-color" style="background:#58a6ff"></span> Loading...`;
    document.getElementById('info-description').textContent =
        d ? `In ${d.name}` : `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    document.getElementById('info-highlights').innerHTML = '';
    currentInfoPlace = { name: `${lat.toFixed(5)}, ${lng.toFixed(5)}`, sub: '', lat, lng };
    updateSaveButton();
    showDirectionsButton();
    highlightLocation(lat, lng);
    infoPanel.classList.remove('hidden');

    // Reverse geocode via Nominatim
    try {
        const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=18&addressdetails=1`;
        const res = await fetch(url, { headers: { 'User-Agent': 'TODistricts' } });
        const data = await res.json();

        const name = data.name || data.address?.road || data.display_name?.split(',')[0] || 'Dropped pin';
        const parts = [];
        if (data.address?.road) parts.push(data.address.road);
        if (data.address?.house_number) parts.unshift(data.address.house_number);
        if (data.address?.neighbourhood) parts.push(data.address.neighbourhood);
        const sub = parts.join(', ') || data.display_name?.split(',').slice(0, 2).join(',') || '';

        document.getElementById('info-title').innerHTML =
            `<span class="info-color" style="background:#58a6ff"></span> ${name}`;
        document.getElementById('info-description').textContent =
            d ? `${sub} · ${d.name}` : sub;
        currentInfoPlace = { name, sub, lat, lng };
        updateSaveButton();
        showDirectionsButton();
    } catch (err) {
        document.getElementById('info-title').innerHTML =
            `<span class="info-color" style="background:#58a6ff"></span> Dropped pin`;
        document.getElementById('info-description').textContent =
            d ? `${d.name} · ${lat.toFixed(4)}, ${lng.toFixed(4)}` : `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        currentInfoPlace = { name: 'Dropped pin', sub: '', lat, lng };
        updateSaveButton();
        showDirectionsButton();
    }
}

// ---------------------------------------------------------------------------
// Toast + misc
// ---------------------------------------------------------------------------
function showToast(msg) {
    let t = document.getElementById('toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; document.getElementById('app').appendChild(t); }
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3000);
}

// Close popups when tapping the map / pressing Escape
map.on('click', () => {
    layersPanel.classList.add('hidden');
    dlPanel.classList.add('hidden');
    searchPanel.classList.add('hidden');
});
map.on('movestart', () => {
    layersPanel.classList.add('hidden');
    dlPanel.classList.add('hidden');
    searchPanel.classList.add('hidden');
});
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        clearSelection();
        searchPanel.classList.add('hidden');
        layersPanel.classList.add('hidden');
        dlPanel.classList.add('hidden');
    }
    if (e.key === '/' && document.activeElement !== searchInput) {
        e.preventDefault();
        searchPanel.classList.remove('hidden');
        searchInput.focus();
    }
});

// ---------------------------------------------------------------------------
// Dynamic zoom-responsive overlays
// ---------------------------------------------------------------------------
function updateOverlayForZoom() {
    const zoom = map.getZoom();

    // Districts only visible at default zoom and below
    // At 14.5+ they disappear so taps go through to drop pins
    if (zoom >= 14.5) {
        if (map.hasLayer(districtsLayer)) map.removeLayer(districtsLayer);
        if (map.hasLayer(labelsLayer)) map.removeLayer(labelsLayer);
    } else {
        if (!map.hasLayer(districtsLayer) && document.getElementById('toggle-districts').checked) {
            map.addLayer(districtsLayer);
        }
        if (!map.hasLayer(labelsLayer) && document.getElementById('toggle-labels').checked) {
            map.addLayer(labelsLayer);
        }
    }
}

map.on('zoomend', updateOverlayForZoom);
updateOverlayForZoom();

// ---------------------------------------------------------------------------
// U of T Campus boundary overlay
// ---------------------------------------------------------------------------
const campusLayer = L.layerGroup().addTo(map);
if (typeof UOFT_CAMPUS_BOUNDARY !== 'undefined') {
    L.polygon(UOFT_CAMPUS_BOUNDARY, {
        color: '#002a5c',
        weight: 2,
        opacity: 0.7,
        fillColor: '#002a5c',
        fillOpacity: 0.08,
        dashArray: '6 4'
    }).bindTooltip('U of T St. George Campus', { sticky: true, className: 'map-tooltip' })
      .addTo(campusLayer);
}

// ---------------------------------------------------------------------------
// Saved Places (localStorage)
// ---------------------------------------------------------------------------
const savedLayer = L.layerGroup().addTo(map);
const SAVED_KEY = 'to-districts-saved';

function getSavedPlaces() {
    try { return JSON.parse(localStorage.getItem(SAVED_KEY)) || []; }
    catch { return []; }
}
function setSavedPlaces(places) {
    localStorage.setItem(SAVED_KEY, JSON.stringify(places));
}

let currentInfoPlace = null; // track what's shown in info panel for saving

function renderSavedMarkers() {
    savedLayer.clearLayers();
    getSavedPlaces().forEach(p => {
        const m = L.marker([p.lat, p.lng], {
            icon: L.divIcon({
                className: 'saved-pin-wrap',
                html: `<span class="saved-pin"></span>`,
                iconSize: [12, 16],
                iconAnchor: [6, 8]
            })
        });
        m.bindTooltip(p.name, { direction: 'top', className: 'map-tooltip', offset: [0, -10] });
        m.on('click', () => {
            // If in routing mode, use this as destination
            if (routingMode) {
                handleRouteDestination(p.lat, p.lng, p.name);
                return;
            }
            document.getElementById('info-title').innerHTML =
                `<span class="info-color" style="background:#f8c300"></span> ${p.name}`;
            document.getElementById('info-description').textContent = p.sub || 'Saved place';
            document.getElementById('info-highlights').innerHTML = '';
            currentInfoPlace = p;
            updateSaveButton();
            showDirectionsButton();
            highlightLocation(p.lat, p.lng);
            infoPanel.classList.remove('hidden');
        });
        savedLayer.addLayer(m);
    });
}

function renderSavedList() {
    const list = document.getElementById('saved-list');
    const empty = document.getElementById('saved-empty');
    const places = getSavedPlaces();
    if (places.length === 0) {
        list.innerHTML = '';
        empty.style.display = '';
        return;
    }
    empty.style.display = 'none';
    list.innerHTML = places.map((p, i) =>
        `<li data-idx="${i}">
            <span class="saved-name">${p.name}</span>
            <button class="saved-del" data-idx="${i}" aria-label="Remove">✕</button>
        </li>`
    ).join('');
    list.querySelectorAll('li').forEach(li => {
        li.addEventListener('click', (e) => {
            if (e.target.classList.contains('saved-del')) return;
            const p = places[li.dataset.idx];
            map.setView([p.lat, p.lng], 17);
            savedPlacesPanel.classList.add('hidden');

            // If in routing mode, use this saved place as destination
            if (routingMode) {
                handleRouteDestination(p.lat, p.lng, p.name);
            }
        });
    });
    list.querySelectorAll('.saved-del').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const places = getSavedPlaces();
            places.splice(parseInt(btn.dataset.idx), 1);
            setSavedPlaces(places);
            renderSavedMarkers();
            renderSavedList();
            updateSaveButton();
            showToast('Place removed');
        });
    });
}

function updateSaveButton() {
    const btn = document.getElementById('info-save');
    if (!currentInfoPlace || !currentInfoPlace.lat) {
        btn.style.display = 'none';
        return;
    }
    btn.style.display = '';
    const places = getSavedPlaces();
    const isSaved = places.some(p => p.lat === currentInfoPlace.lat && p.lng === currentInfoPlace.lng);
    btn.classList.toggle('saved', isSaved);
    btn.innerHTML = isSaved
        ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="#f59e0b" stroke="#f59e0b" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`
        : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
}

// Save button click
document.getElementById('info-save').addEventListener('click', () => {
    if (!currentInfoPlace || !currentInfoPlace.lat) return;
    const places = getSavedPlaces();
    const idx = places.findIndex(p => p.lat === currentInfoPlace.lat && p.lng === currentInfoPlace.lng);
    if (idx >= 0) {
        places.splice(idx, 1);
        showToast('Removed from saved');
    } else {
        places.push(currentInfoPlace);
        showToast('Saved!');
    }
    setSavedPlaces(places);
    renderSavedMarkers();
    renderSavedList();
    updateSaveButton();
});

// Override info display functions to track currentInfoPlace
const _origShowPlaceInfo = showPlaceInfo;
showPlaceInfo = function(name, sub, districtName) {
    _origShowPlaceInfo(name, sub, districtName);
    // find lat/lng from the search marker
    let lat = null, lng = null;
    searchLayer.eachLayer(l => { if (l.getLatLng) { lat = l.getLatLng().lat; lng = l.getLatLng().lng; } });
    currentInfoPlace = lat ? { name, sub: sub || '', lat, lng } : null;
    updateSaveButton();
    showDirectionsButton();
};

const _origShowPoiInfo = showPoiInfo;
showPoiInfo = function(poi, district) {
    _origShowPoiInfo(poi, district);
    currentInfoPlace = { name: poi.name, sub: POI_CATEGORIES[poi.cat].label, lat: poi.lat, lng: poi.lng };
    updateSaveButton();
    showDirectionsButton();
};

const _origShowDistrictInfo = showDistrictInfo;
showDistrictInfo = function(district) {
    _origShowDistrictInfo(district);
    currentInfoPlace = null;
    updateSaveButton();
    showDirectionsButton();
};

// Saved places panel
const savedPlacesBtn = document.getElementById('saved-places-btn');
const savedPlacesPanel = document.getElementById('saved-places-panel');

savedPlacesBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    savedPlacesPanel.classList.toggle('hidden');
    dlPanel.classList.add('hidden');
    layersPanel.classList.add('hidden');
    renderSavedList();
});

// Toggle saved places visibility
document.getElementById('toggle-saved').addEventListener('change', (e) => {
    if (e.target.checked) map.addLayer(savedLayer);
    else map.removeLayer(savedLayer);
});

// Close saved panel on map interaction
map.on('click', () => { savedPlacesPanel.classList.add('hidden'); });
map.on('movestart', () => { savedPlacesPanel.classList.add('hidden'); });

// ---------------------------------------------------------------------------
// Timetable popup
// ---------------------------------------------------------------------------
const timetableBtn = document.getElementById('timetable-btn');
const timetablePanel = document.getElementById('timetable-panel');
const timetableContent = document.getElementById('timetable-content');
let ttCurrentView = 'modules';

function getBuildingLatLng(code) {
    const b = MY_CLASS_BUILDINGS.find(b => b.name.startsWith(code + ' |'));
    return b ? { lat: b.lat, lng: b.lng, name: b.name } : null;
}

function renderTimetable() {
    if (ttCurrentView === 'days') {
        timetableContent.innerHTML = FULL_TIMETABLE.map(day => {
            if (!day.slots || day.slots.length === 0) {
                return `<div class="tt-day"><div class="tt-day-name">${day.day}</div><div class="tt-empty">No classes</div></div>`;
            }
            return `<div class="tt-day"><div class="tt-day-name">${day.day}</div>${
                day.slots.map(s => `<div class="tt-slot">
                    <span class="tt-time">${s.time}</span>
                    <span class="tt-course"><span class="tt-code">${s.code}</span> ${s.name}<br><span class="tt-room-link" data-building="${s.building}">${s.room}</span></span>
                </div>`).join('')
            }</div>`;
        }).join('');
    } else {
        timetableContent.innerHTML = COURSES_BY_MOD.map(mod => `
            <div class="tt-mod-card" style="border-left-color:${mod.color}">
                <div class="tt-mod-title" style="color:${mod.color}">${mod.code} — ${mod.name}</div>
                ${mod.sessions.map(s => `<div class="tt-mod-session">
                    <span class="tt-mod-type">${s.type}</span>
                    ${s.day} ${s.time} · <span class="tt-room-link" data-building="${s.building}">${s.room}</span>
                </div>`).join('')}
            </div>
        `).join('');
    }

    // Bind room link clicks
    timetableContent.querySelectorAll('.tt-room-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.stopPropagation();
            const buildingCode = link.dataset.building;
            const b = getBuildingLatLng(buildingCode);
            if (b) {
                // Minimise timetable panel (glides down)
                timetablePanel.classList.add('minimised');

                // Fly to building
                map.flyTo([b.lat, b.lng], 17, { duration: 0.8 });

                // Highlight the building with a pulsing circle
                searchLayer.clearLayers();
                L.circleMarker([b.lat, b.lng], {
                    radius: 18, color: '#e63946', weight: 3,
                    fillColor: '#e63946', fillOpacity: 0.15,
                    className: 'pulse-marker'
                }).addTo(searchLayer);

                // Show the building info panel
                const poi = POINTS_OF_INTEREST.find(p => p.name.startsWith(buildingCode + ' |'));
                if (poi) {
                    const district = DISTRICTS.find(d => d.name === poi.district);
                    showPoiInfo(poi, district);
                }
            }
        });
    });
}

// Render immediately on button click
timetableBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    closeAllPanels();
    timetablePanel.classList.remove('hidden');
    timetablePanel.classList.remove('minimised');
    renderTimetable();
});

// Tab switching
document.querySelectorAll('.tt-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.tt-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        ttCurrentView = tab.dataset.view;
        renderTimetable();
    });
});

// Click minimised panel to expand
timetablePanel.addEventListener('click', () => {
    if (timetablePanel.classList.contains('minimised')) {
        // Exiting location mode — clear everything and expand timetable
        clearSelection();
        searchLayer.clearLayers();
        highlightLayer.clearLayers();
        timetablePanel.classList.remove('minimised');
    }
});

document.getElementById('timetable-close').addEventListener('click', (e) => {
    e.stopPropagation();
    timetablePanel.classList.add('hidden');
    timetablePanel.classList.remove('minimised');
});
map.on('click', () => {
    if (timetablePanel.classList.contains('minimised')) {
        timetablePanel.classList.remove('minimised');
    } else {
        timetablePanel.classList.add('hidden');
    }
});
map.on('movestart', () => {
    // Don't hide when minimised — that's intentional
    if (!timetablePanel.classList.contains('minimised')) {
        timetablePanel.classList.add('hidden');
    }
});

// ---------------------------------------------------------------------------
// Show course info when tapping a class building
// ---------------------------------------------------------------------------
const _origShowPoiInfo2 = showPoiInfo;
showPoiInfo = function(poi, district) {
    _origShowPoiInfo2(poi, district);

    // Check if this is a class building and show courses
    if (poi.cat === 'myclasses') {
        const code = poi.name.split(' | ')[0]; // e.g. "MC"
        const courses = MY_COURSES[code] || [];
        if (courses.length > 0) {
            document.getElementById('info-highlights').innerHTML = `<div class="course-list">${
                courses.map(c => `<div class="course-item">
                    <span class="ci-code">${c.code}</span> — ${c.name}<br>
                    <span class="ci-time">${c.time}</span><br>
                    <span class="ci-room">${c.room}</span>
                </div>`).join('')
            }</div>`;
        }
    }
};

// Initial render
renderSavedMarkers();

// Add Home if not already saved
(function seedHome() {
    const HOME = { name: '🏠 Home — 29 Glasgow St', sub: 'Kensington-Chinatown', lat: 43.65728, lng: -79.39859 };
    const places = getSavedPlaces();
    const already = places.some(p => p.lat === HOME.lat && p.lng === HOME.lng);
    if (!already) {
        places.unshift(HOME);
        setSavedPlaces(places);
        renderSavedMarkers();
    }
})();
