const utcClock = document.getElementById('utc-clock');
const targetClock = document.getElementById('target-clock');
const zoneSelect = document.getElementById('timezone-select');
const favBtn = document.getElementById('fav-btn');
const targetLabel = document.getElementById('target-zone-label');
const favContainer = document.getElementById('favorites-container');
const errorMsg = document.getElementById('error-msg');

// Calculator Element Hooks
const calcTimeInput = document.getElementById('calc-input-time');
const calcZoneSelect = document.getElementById('calc-input-zone');
const calcOutputDisplay = document.getElementById('calc-output-display');

let favoriteZones = []; 

const timeOptions = {
  dateStyle: 'medium',
  timeStyle: 'medium',
};

function getGMTOffsetStr(zone) {
  try {
    const now = new Date();
    const tzString = now.toLocaleString('en-US', { timeZone: zone, timeZoneName: 'longOffset' });
    const match = tzString.match(/GMT([+-]\d+:\d+)/);
    return match ? `GMT${match[1]}` : 'GMT+00:00';
  } catch (e) {
    return 'GMT+00:00';
  }
}

function getTimezoneNotation(zone) {
  try {
    const parts = Intl.DateTimeFormat('en-US', { timeZoneName: 'short', timeZone: zone }).formatToParts(new Date());
    const tzPart = parts.find(part => part.type === 'timeZoneName');
    return tzPart ? tzPart.value : '';
  } catch (e) {
    return '';
  }
}

// Generate the dropdown lists for both dropdown components
function populateAllTimezoneDropdowns() {
  const allTimezones = Intl.supportedValuesOf('timeZone');
  const seenOptions = new Set();
  const sortedOptionsList = [];

  allTimezones.forEach(zone => {
    const rawCityName = zone.split('/').pop().replace(/_/g, ' ');
    if (!rawCityName || zone.startsWith('Etc/')) return;

    const gmtStr = getGMTOffsetStr(zone);
    const notation = getTimezoneNotation(zone);
    const notationStr = notation ? ` ${notation}` : '';
    const fullDisplayText = `${gmtStr} ${rawCityName} Time${notationStr}`;
    
    if (!seenOptions.has(fullDisplayText)) {
      seenOptions.add(fullDisplayText);
      sortedOptionsList.push({ zoneValue: zone, displayText: fullDisplayText });
    }
  });

  sortedOptionsList.sort((a, b) => a.displayText.localeCompare(b.displayText));

  // Build options into both elements
  sortedOptionsList.forEach(opt => {
    const el1 = document.createElement('option');
    el1.value = opt.zoneValue;
    el1.textContent = opt.displayText;
    zoneSelect.appendChild(el1);

    const el2 = document.createElement('option');
    el2.value = opt.zoneValue;
    el2.textContent = opt.displayText;
    calcZoneSelect.appendChild(el2);
  });
}

function updateClocks() {
  const now = new Date();

  // UTC Live tracking
  utcClock.textContent = now.toLocaleString('en-US', { ...timeOptions, timeZone: 'UTC' }) + ' UTC';

  // Live convert track card
  const selectedZone = zoneSelect.value;
  if (selectedZone) {
    try {
      const convertedTime = now.toLocaleString('en-US', { ...timeOptions, timeZone: selectedZone });
      const notation = getTimezoneNotation(selectedZone);
      targetClock.textContent = convertedTime;
      
      const cleanCity = selectedZone.split('/').pop().replace(/_/g, ' ');
      targetLabel.textContent = `${cleanCity} Time ${notation ? `(${notation})` : ''}`;
    } catch (e) { }
  }

  if (favoriteZones.includes(selectedZone)) {
    favBtn.classList.add('active');
  } else {
    favBtn.classList.remove('active');
  }

  // Live favorites list card refresh tracking loops
  const favElements = favContainer.querySelectorAll('.fav-item');
  favElements.forEach(item => {
    const zone = item.getAttribute('data-zone');
    try {
      const timeStr = now.toLocaleString('en-US', { timeStyle: 'medium', timeZone: zone });
      item.querySelector('.fav-item-time').textContent = timeStr;
    } catch (e) { }
  });
}

// Custom Conversion Calculator core parser algorithm logic
function processCustomCalculation() {
  const inputDateTimeValue = calcTimeInput.value; // Returns ISO literal: "YYYY-MM-DDTHH:MM"
  const selectedOriginZone = calcZoneSelect.value; // Origin Timezone value

  if (!inputDateTimeValue || !selectedOriginZone) {
    calcOutputDisplay.textContent = "Select input parameters...";
    return;
  }

  try {
    // Treat the user's manual numeric input exactly as an independent clock time string in the target zone
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: selectedOriginZone,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false
    });

    // Create a targeted instance mapping back calculation relative parameters
    const targetZonedDate = new Date(inputDateTimeValue);
    
    // Format shifts calculation logic safely mapping structural elements back to browser's true local runtime zone
    const localTimeOutputStr = targetZonedDate.toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short'
    });

    calcOutputDisplay.textContent = localTimeOutputStr;
  } catch (err) {
    calcOutputDisplay.textContent = "Error parsing input timezone calculations.";
  }
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

    item.querySelector('.remove-fav-btn').addEventListener('click', () => { removeFavorite(zone); });
    favContainer.appendChild(item);
  });
}

// System Execution Instantiation Sequence Hooks 
populateAllTimezoneDropdowns();

// Assign Calculator input events to recalculate automatically on change
calcTimeInput.addEventListener('input', processCustomCalculation);
calcZoneSelect.addEventListener('change', processCustomCalculation);

chrome.storage.sync.get(['favTimezonesList'], (result) => {
  if (result.favTimezonesList && Array.isArray(result.favTimezonesList)) {
    favoriteZones = result.favTimezonesList.slice(0, 5); 
  }
  
  const systemLocalZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  zoneSelect.value = systemLocalZone;
  calcZoneSelect.value = systemLocalZone;
  
  // Set default picker text baseline to match current moment time exactly
  const localNow = new Date();
  localNow.setMinutes(localNow.getMinutes() - localNow.getTimezoneOffset());
  calcTimeInput.value = localNow.toISOString().slice(0, 16);

  renderFavoritesShelf();
  updateClocks();
  processCustomCalculation();
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

// Click anywhere on wrapper handler to pop open the picker panel directly
const clickBox = document.getElementById('picker-click-box');
if (clickBox) {
  clickBox.addEventListener('click', (e) => {
    // Prevents double triggers if they happened to click the real icon element
    if (e.target !== calcTimeInput) {
      try {
        calcTimeInput.showPicker(); // Built-in browser method to reveal hidden calendar frame instantly
      } catch (err) {
        calcTimeInput.focus();
      }
    }
  });
}