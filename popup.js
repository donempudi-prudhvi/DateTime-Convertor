const utcClock = document.getElementById('utc-clock');
const targetClock = document.getElementById('target-clock');
const zoneSelect = document.getElementById('timezone-select');
const favBtn = document.getElementById('fav-btn');
const targetLabel = document.getElementById('target-zone-label');
const favContainer = document.getElementById('favorites-container');
const errorMsg = document.getElementById('error-msg');

let favoriteZones = []; 

const timeOptions = {
  dateStyle: 'medium',
  timeStyle: 'medium',
};

// 1. Calculate and build precise GMT strings (e.g., "GMT+05:30")
function getGMTOffsetStr(zone) {
  try {
    const now = new Date();
    // Format to extract components in target timezone
    const tzString = now.toLocaleString('en-US', { timeZone: zone, timeZoneName: 'longOffset' });
    const match = tzString.match(/GMT([+-]\d+:\d+)/);
    
    if (match) return `GMT${match[1]}`;
    
    // Fallback manual math approximation if longOffset is restricted
    const parts = Intl.DateTimeFormat('en-US', { hour: '2-digit', hourCycle: 'h23', timeZone: zone }).formatToParts(now);
    const targetHour = parseInt(parts.find(p => p.type === 'hour').value, 10);
    const utcHour = now.getUTCHours();
    let diff = targetHour - utcHour;
    if (diff > 12) diff -= 24;
    if (diff < -12) diff += 24;
    
    const sign = diff >= 0 ? '+' : '-';
    return `GMT${sign}${String(Math.abs(diff)).padStart(2, '0')}:00`;
  } catch (e) {
    return 'GMT+00:00';
  }
}

// 2. Fetch standard short descriptive abbreviations (PST, IST, CET)
function getTimezoneNotation(zone) {
  try {
    const parts = Intl.DateTimeFormat('en-US', { timeZoneName: 'short', timeZone: zone }).formatToParts(new Date());
    const tzPart = parts.find(part => part.type === 'timeZoneName');
    return tzPart ? tzPart.value : '';
  } catch (e) {
    return '';
  }
}

// 3. Populate picklist utilizing exact single entry deduplication matching rules
function populateTimezones() {
  const allTimezones = Intl.supportedValuesOf('timeZone');
  const seenOptions = new Set();
  const sortedOptionsList = [];

  allTimezones.forEach(zone => {
    // Generate clean city identifier names
    const rawCityName = zone.split('/').pop().replace(/_/g, ' ');
    if (!rawCityName || zone.startsWith('Etc/')) return;

    const gmtStr = getGMTOffsetStr(zone);
    const notation = getTimezoneNotation(zone);
    
    // Create notation layout string format: "PST" or "IST"
    const notationStr = notation ? ` ${notation}` : '';
    
    // Enforce target uniform naming format requested: GMT+2 City Time notation
    const fullDisplayText = `${gmtStr} ${rawCityName} Time${notationStr}`;
    
    // Unique fingerprint deduplication constraint check
    if (!seenOptions.has(fullDisplayText)) {
      seenOptions.add(fullDisplayText);
      sortedOptionsList.push({
        zoneValue: zone,
        displayText: fullDisplayText,
        offsetValue: gmtStr
      });
    }
  });

  // Sort numerical values linearly based upon global GMT relative offsets
  sortedOptionsList.sort((a, b) => a.displayText.localeCompare(b.displayText));

  // Build element fragments into the DOM picklist
  sortedOptionsList.forEach(opt => {
    const option = document.createElement('option');
    option.value = opt.zoneValue;
    option.textContent = opt.displayText;
    zoneSelect.appendChild(option);
  });
}

function updateClocks() {
  const now = new Date();

  // Live Sync UTC Main Label
  utcClock.textContent = now.toLocaleString('en-US', { ...timeOptions, timeZone: 'UTC' }) + ' UTC';

  // Live Sync Target Display Card
  const selectedZone = zoneSelect.value;
  if (selectedZone) {
    try {
      const convertedTime = now.toLocaleString('en-US', { ...timeOptions, timeZone: selectedZone });
      const notation = getTimezoneNotation(selectedZone);
      targetClock.textContent = convertedTime;
      
      const cleanCity = selectedZone.split('/').pop().replace(/_/g, ' ');
      targetLabel.textContent = `${cleanCity} Time ${notation ? `(${notation})` : ''}`;
    } catch (e) {
      targetClock.textContent = "Error formatting time";
    }
  }

  // Active validation state toggle for favorite stars
  if (favoriteZones.includes(selectedZone)) {
    favBtn.classList.add('active');
  } else {
    favBtn.classList.remove('active');
  }

  // Update live ticking inside top shelf boxes 
  const favElements = favContainer.querySelectorAll('.fav-item');
  favElements.forEach(item => {
    const zone = item.getAttribute('data-zone');
    try {
      const timeStr = now.toLocaleString('en-US', { timeStyle: 'medium', timeZone: zone });
      item.querySelector('.fav-item-time').textContent = timeStr;
    } catch (e) { }
  });
}

function removeFavorite(zoneToRemove) {
  favoriteZones = favoriteZones.filter(z => z !== zoneToRemove);
  chrome.storage.sync.set({ favTimezonesList: favoriteZones }, () => {
    renderFavoritesShelf();
    updateClocks();
  });
}

function renderFavoritesShelf() {
  favContainer.innerHTML = ''; 
  
  favoriteZones.forEach(zone => {
    const item = document.createElement('div');
    item.className = 'fav-item';
    item.setAttribute('data-zone', zone);

    const gmtStr = getGMTOffsetStr(zone);
    const notation = getTimezoneNotation(zone);
    const displayCity = zone.split('/').pop().replace(/_/g, ' ');

    item.innerHTML = `
      <div class="fav-item-left">
        <div class="fav-item-zone">${gmtStr} ${displayCity} ${notation ? `(${notation})` : ''}</div>
        <div class="fav-item-time">Loading...</div>
      </div>
      <button class="remove-fav-btn" title="Remove Favorite">×</button>
    `;

    item.querySelector('.remove-fav-btn').addEventListener('click', () => {
      removeFavorite(zone);
    });

    favContainer.appendChild(item);
  });
}

// System Execution Instantiation Hooks
populateTimezones();

chrome.storage.sync.get(['favTimezonesList'], (result) => {
  if (result.favTimezonesList && Array.isArray(result.favTimezonesList)) {
    favoriteZones = result.favTimezonesList.slice(0, 5); 
  } else {
    favoriteZones = [];
  }
  
  zoneSelect.value = Intl.DateTimeFormat().resolvedOptions().timeZone;
  
  renderFavoritesShelf();
  updateClocks();
  setInterval(updateClocks, 1000);
});

zoneSelect.addEventListener('change', () => {
  errorMsg.style.display = 'none';
  updateClocks();
});

favBtn.addEventListener('click', () => {
  const currentSelection = zoneSelect.value;
  errorMsg.style.display = 'none';

  if (favoriteZones.includes(currentSelection)) {
    removeFavorite(currentSelection);
  } else {
    if (favoriteZones.length >= 5) {
      errorMsg.style.display = 'block';
      return; 
    }
    favoriteZones.push(currentSelection);
    chrome.storage.sync.set({ favTimezonesList: favoriteZones }, () => {
      renderFavoritesShelf();
      updateClocks();
    });
  }
});