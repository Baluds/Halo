/**
 * Flash Guardian Popup Script
 * Handles settings and statistics display
 */

// Load settings from storage
chrome.storage.sync.get(['enabled', 'autoPause'], (data) => {
  // Set toggle state for enable protection
  document.getElementById('enableToggle').checked = data.enabled !== false;

  // Auto-pause is always enabled (no toggle in UI)

  // Update status display
  updateStatusDisplay(data.enabled !== false);
});

// Load statistics from local storage (faster and more reliable)
chrome.storage.local.get(['stats'], (data) => {
  if (data.stats) {
    document.getElementById('videosMonitored').textContent = data.stats.videosMonitored || 0;
    document.getElementById('warningsIssued').textContent = data.stats.warningsIssued || 0;
    document.getElementById('flashesDetected').textContent = data.stats.flashesDetected || 0;
  }
});

// Handle enable/disable toggle
document.getElementById('enableToggle').addEventListener('change', (e) => {
  const enabled = e.target.checked;

  chrome.storage.sync.set({ enabled }, () => {
    updateStatusDisplay(enabled);

    // Notify content scripts
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: enabled ? 'enable' : 'disable'
        }).catch(() => {
          // Ignore errors for tabs that don't have our content script
        });
      }
    });
  });
});

// Auto-pause is always enabled (removed toggle from UI)

/**
 * Update status display based on enabled state
 */
function updateStatusDisplay(enabled) {
  const statusDiv = document.getElementById('status');

  if (enabled) {
    statusDiv.classList.remove('disabled');
    statusDiv.querySelector('h2').innerHTML = `
      <span class="status-indicator"></span>
      Protection Active
    `;
    statusDiv.querySelector('p').textContent = 'Monitoring videos for flashing content';
  } else {
    statusDiv.classList.add('disabled');
    statusDiv.querySelector('h2').innerHTML = `
      <span class="status-indicator"></span>
      Protection Disabled
    `;
    statusDiv.querySelector('p').textContent = 'Flash detection is currently off';
  }
}

// Function to update stats display
function updateStatsDisplay() {
  chrome.storage.local.get(['stats'], (data) => {
    if (data.stats) {
      console.log('[Flash Guardian Popup] Updating stats display:', data.stats);
      document.getElementById('videosMonitored').textContent = data.stats.videosMonitored || 0;
      document.getElementById('warningsIssued').textContent = data.stats.warningsIssued || 0;
      document.getElementById('flashesDetected').textContent = data.stats.flashesDetected || 0;
    }
  });
}

// Refresh statistics every second while popup is open
setInterval(updateStatsDisplay, 500); // Update twice per second for better responsiveness

// Also listen for storage changes for immediate updates
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (changes.stats) {
    console.log('[Flash Guardian Popup] Storage changed:', changes.stats.newValue);
    updateStatsDisplay();
  }
});

// Reset statistics button
document.getElementById('resetStats').addEventListener('click', () => {
  const resetStats = {
    videosMonitored: 0,
    warningsIssued: 0,
    flashesDetected: 0
  };

  // Use both sync and local storage to ensure complete reset
  chrome.storage.local.set({ stats: resetStats }, () => {
    chrome.storage.sync.set({ stats: resetStats }, () => {
      // Update UI immediately
      document.getElementById('videosMonitored').textContent = '0';
      document.getElementById('warningsIssued').textContent = '0';
      document.getElementById('flashesDetected').textContent = '0';

      // Notify all content scripts to clear their visited videos cache
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
          chrome.tabs.sendMessage(tab.id, { action: 'resetStats' }).catch(() => {
            // Ignore errors for tabs that don't have our content script
          });
        });
      });

      // Visual feedback
      const button = document.getElementById('resetStats');
      const originalText = button.textContent;
      button.textContent = 'Statistics Reset!';
      button.style.background = '#faee21';
      button.style.color = '#000000';

      setTimeout(() => {
        button.textContent = originalText;
        button.style.background = '#000000';
        button.style.color = '#fff';
      }, 1500);

      console.log('[Flash Guardian] Statistics reset successfully');
    });
  });
});
