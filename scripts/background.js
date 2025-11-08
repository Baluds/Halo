/**
 * Flash Guardian Background Service Worker
 * Handles message passing and statistics tracking
 */

// Queue to serialize stat updates and prevent race conditions
let updateQueue = Promise.resolve();

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[Flash Guardian Background] Received message:', request);

  if (request.action === 'updateStats') {
    // Serialize updates using a queue to prevent race conditions
    updateQueue = updateQueue.then(() => {
      return new Promise((resolve) => {
        // Read from local storage for faster access
        chrome.storage.local.get(['stats'], (data) => {
          const stats = data.stats || {
            videosMonitored: 0,
            warningsIssued: 0,
            flashesDetected: 0
          };

          console.log('[Flash Guardian Background] Current stats:', stats);
          console.log('[Flash Guardian Background] Update type:', request.stat);

          // Update stats based on the request
          if (request.stat === 'videoMonitored') {
            stats.videosMonitored++;
            console.log('[Flash Guardian Background] Incremented videosMonitored to:', stats.videosMonitored);
          }
          if (request.stat === 'warningIssued') {
            stats.warningsIssued++;
            console.log('[Flash Guardian Background] Incremented warningsIssued to:', stats.warningsIssued);
          }
          if (request.stat === 'flashDetected') {
            stats.flashesDetected += request.count || 1;
            console.log('[Flash Guardian Background] Incremented flashesDetected by', request.count || 1, 'to:', stats.flashesDetected);
          }

          // Save to both storages simultaneously
          const localSave = new Promise(saveResolve => {
            chrome.storage.local.set({ stats }, () => {
              console.log('[Flash Guardian Background] Stats saved to local storage:', stats);
              saveResolve();
            });
          });

          const syncSave = new Promise(saveResolve => {
            chrome.storage.sync.set({ stats }, () => {
              console.log('[Flash Guardian Background] Stats saved to sync storage:', stats);
              saveResolve();
            });
          });

          Promise.all([localSave, syncSave]).then(() => {
            console.log('[Flash Guardian Background] Stats saved to both storages successfully');
            sendResponse({ success: true, stats });
            resolve();
          });
        });
      });
    });

    return true; // Keep message channel open for async response
  }
});

// Initialize default settings on install (first time only)
chrome.runtime.onInstalled.addListener((details) => {
  console.log('[Flash Guardian] onInstalled event:', details.reason);

  if (details.reason === 'install') {
    // First time installation - set defaults in both storages
    const defaultSettings = {
      enabled: true,
      autoPause: true,
      stats: {
        videosMonitored: 0,
        warningsIssued: 0,
        flashesDetected: 0
      }
    };
    chrome.storage.sync.set(defaultSettings);
    chrome.storage.local.set(defaultSettings);
    console.log('[Flash Guardian] Extension installed with default settings');
  } else if (details.reason === 'update') {
    // Extension updated - preserve existing stats, ensure settings exist
    // Check both local and sync storage to preserve stats
    chrome.storage.local.get(['stats'], (localData) => {
      chrome.storage.sync.get(['enabled', 'autoPause', 'stats'], (syncData) => {
        const updates = {};
        if (syncData.enabled === undefined) updates.enabled = true;
        if (syncData.autoPause === undefined) updates.autoPause = true;

        // Preserve stats from local storage if available, otherwise use sync, otherwise reset
        if (!syncData.stats && !localData.stats) {
          updates.stats = {
            videosMonitored: 0,
            warningsIssued: 0,
            flashesDetected: 0
          };
        } else if (localData.stats) {
          // Copy from local to sync if local has stats
          updates.stats = localData.stats;
        }

        if (Object.keys(updates).length > 0) {
          chrome.storage.sync.set(updates, () => {
            // Also ensure local storage has the stats
            if (updates.stats) {
              chrome.storage.local.set({ stats: updates.stats });
            }
          });
        }
        console.log('[Flash Guardian] Extension updated, settings preserved');
      });
    });
  }
});
