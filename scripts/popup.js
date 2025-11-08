/**
 * Flash Guardian Popup Script
 * Handles settings and statistics display
 */

// Current view state
let currentView = 'flash'; // 'flash' or 'summarizer'

// View toggle functionality
document.getElementById('viewToggle').addEventListener('click', () => {
  if (currentView === 'flash') {
    switchToSummarizer();
  } else {
    switchToFlash();
  }
});

function switchToFlash() {
  currentView = 'flash';
  document.getElementById('flashView').classList.add('active');
  document.getElementById('summarizerView').classList.remove('active');
  document.getElementById('viewToggle').textContent = '🛡️';
  document.getElementById('viewToggle').title = 'Switch to Summarizer';
  document.getElementById('headerSubtitle').textContent = 'Photosensitive Content Protection';
  // Hide settings button in flash view
  document.getElementById('settingsBtn').style.display = 'none';
}

function switchToSummarizer() {
  currentView = 'summarizer';
  document.getElementById('flashView').classList.remove('active');
  document.getElementById('summarizerView').classList.add('active');
  document.getElementById('viewToggle').textContent = '📝';
  document.getElementById('viewToggle').title = 'Switch to Flash Protection';
  document.getElementById('headerSubtitle').textContent = 'AI-Powered Text Summarizer';
  // Show settings button in summarizer view
  document.getElementById('settingsBtn').style.display = 'flex';
}

// Settings button - opens modal
document.getElementById('settingsBtn').addEventListener('click', () => {
  openSettingsModal();
});

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

// ============================================
// SUMMARIZER FUNCTIONALITY
// ============================================

// Generate button
document.getElementById('generateBtn').addEventListener('click', () => {
  const type = document.getElementById('summaryType').value;
  generateSummary(type);
});

// Clear button
document.getElementById('clearBtn').addEventListener('click', () => {
  document.getElementById('textInput').value = '';
  document.getElementById('summaryResult').style.display = 'none';
  document.getElementById('summaryError').style.display = 'none';
  document.getElementById('summaryLoading').style.display = 'none';
});

// Generate summary function
async function generateSummary(type) {
  const textInput = document.getElementById('textInput').value.trim();

  // Check if text is provided
  if (!textInput) {
    showError('Please paste some text to summarize.');
    return;
  }

  if (textInput.length < 100) {
    showError('Please provide more text (at least 100 characters) for a meaningful summary.');
    return;
  }

  // Check which provider is configured
  chrome.storage.sync.get(['aiProvider', 'geminiApiKey', 'groqApiKey'], async (data) => {
    const provider = data.aiProvider || 'gemini';
    const apiKey = provider === 'gemini' ? data.geminiApiKey : data.groqApiKey;

    if (!apiKey) {
      showError(`Please configure your ${provider === 'gemini' ? 'Gemini' : 'Groq'} API key first. Click the ⚙️ settings icon at the top.`);
      return;
    }

    // Show loading state
    showLoading();

    try {
      // Call appropriate API to summarize
      const summary = await summarizeText(textInput, type, apiKey, provider);
      showSummary(summary);
    } catch (error) {
      showError('Error: ' + error.message);
    }
  });
}

// Copy summary button
document.getElementById('copySummary').addEventListener('click', () => {
  const summaryText = document.getElementById('summaryText').textContent;
  navigator.clipboard.writeText(summaryText).then(() => {
    const btn = document.getElementById('copySummary');
    btn.textContent = '✓ Copied!';
    setTimeout(() => {
      btn.textContent = 'Copy';
    }, 2000);
  });
});

// AI Provider selector
document.getElementById('aiProvider').addEventListener('change', (e) => {
  const provider = e.target.value;
  if (provider === 'gemini') {
    document.getElementById('geminiKeySection').style.display = 'block';
    document.getElementById('groqKeySection').style.display = 'none';
  } else {
    document.getElementById('geminiKeySection').style.display = 'none';
    document.getElementById('groqKeySection').style.display = 'block';
  }
});

// Settings Modal Functions
function openSettingsModal() {
  // Load existing settings
  chrome.storage.sync.get(['aiProvider', 'geminiApiKey', 'groqApiKey'], (data) => {
    // Set provider
    const provider = data.aiProvider || 'gemini';
    document.getElementById('aiProvider').value = provider;

    // Trigger change event to show correct section
    document.getElementById('aiProvider').dispatchEvent(new Event('change'));

    // Load API keys
    if (data.geminiApiKey) {
      document.getElementById('apiKeyInput').value = data.geminiApiKey;
    }
    if (data.groqApiKey) {
      document.getElementById('groqApiKeyInput').value = data.groqApiKey;
    }
  });
  document.getElementById('settingsModal').classList.add('active');
}

function closeSettingsModal() {
  document.getElementById('settingsModal').classList.remove('active');
  document.getElementById('apiKeyInput').value = '';
}

// Save settings
document.getElementById('saveSettings').addEventListener('click', () => {
  const provider = document.getElementById('aiProvider').value;
  const geminiKey = document.getElementById('apiKeyInput').value.trim();
  const groqKey = document.getElementById('groqApiKeyInput').value.trim();

  // Validate based on provider
  if (provider === 'gemini' && !geminiKey) {
    alert('Please enter a Gemini API key');
    return;
  }
  if (provider === 'groq' && !groqKey) {
    alert('Please enter a Groq API key');
    return;
  }

  // Save settings
  chrome.storage.sync.set({
    aiProvider: provider,
    geminiApiKey: geminiKey,
    groqApiKey: groqKey
  }, () => {
    closeSettingsModal();
    // Show success message
    if (currentView === 'summarizer') {
      document.getElementById('summaryError').style.background = '#d4edda';
      document.getElementById('summaryError').style.borderColor = '#28a745';
      document.getElementById('summaryError').style.color = '#155724';
      showError(`✓ ${provider === 'gemini' ? 'Gemini' : 'Groq'} API key saved! You can now generate summaries.`);
      setTimeout(() => {
        document.getElementById('summaryError').style.display = 'none';
        document.getElementById('summaryError').style.background = '#ffebee';
        document.getElementById('summaryError').style.borderColor = '#ef5350';
        document.getElementById('summaryError').style.color = '#c62828';
      }, 3000);
    }
  });
});

// Cancel settings
document.getElementById('cancelSettings').addEventListener('click', () => {
  closeSettingsModal();
});

// Close modal when clicking outside
document.getElementById('settingsModal').addEventListener('click', (e) => {
  if (e.target.id === 'settingsModal') {
    closeSettingsModal();
  }
});

// Show loading state
function showLoading() {
  document.getElementById('summaryResult').style.display = 'none';
  document.getElementById('summaryError').style.display = 'none';
  document.getElementById('summaryLoading').style.display = 'block';
}

// Show summary result
function showSummary(text) {
  document.getElementById('summaryLoading').style.display = 'none';
  document.getElementById('summaryError').style.display = 'none';
  document.getElementById('summaryText').textContent = text;
  document.getElementById('summaryResult').style.display = 'block';
}

// Show error message
function showError(message) {
  document.getElementById('summaryLoading').style.display = 'none';
  document.getElementById('summaryResult').style.display = 'none';
  document.getElementById('summaryError').textContent = message;
  document.getElementById('summaryError').style.display = 'block';
}

// Call AI API to summarize text (supports Gemini and Groq)
async function summarizeText(text, type, apiKey, provider = 'gemini') {
  const prompts = {
    quick: 'Summarize this article in 2-3 clear, concise sentences. Focus on the main point and key takeaway. DO NOT use markdown formatting like ** or bold. Just plain text:\n\n',
    bullets: 'Summarize this article as 3-5 KEY bullet points only. Focus on the most important takeaways. Keep each bullet point to ONE short sentence. Use simple hyphens (-) for bullets. DO NOT use sub-bullets or nested points. DO NOT use markdown. Be concise:\n\n'
  };

  const prompt = prompts[type] + text.substring(0, 15000); // Limit text length

  let summary;
  if (provider === 'gemini') {
    summary = await summarizeWithGemini(prompt, apiKey);
  } else if (provider === 'groq') {
    summary = await summarizeWithGroq(prompt, apiKey);
  } else {
    throw new Error('Unknown AI provider: ' + provider);
  }

  // Clean up markdown formatting
  summary = cleanMarkdown(summary);
  return summary;
}

// Remove markdown formatting from summary
function cleanMarkdown(text) {
  // Remove bold/italic markers
  text = text.replace(/\*\*/g, '');
  text = text.replace(/\*/g, '');
  text = text.replace(/__/g, '');
  text = text.replace(/_/g, '');

  // Clean up bullet points - replace * with -
  text = text.replace(/^\s*\*\s+/gm, '- ');

  return text.trim();
}

// Gemini API implementation
async function summarizeWithGemini(prompt, apiKey) {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{
        parts: [{
          text: prompt
        }]
      }]
    })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `Gemini API error: ${response.status}`);
  }

  const data = await response.json();
  return data.candidates[0].content.parts[0].text;
}

// Groq API implementation
async function summarizeWithGroq(prompt, apiKey) {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'llama-3.1-70b-versatile',
      messages: [{
        role: 'user',
        content: prompt
      }],
      temperature: 0.7,
      max_tokens: 1000
    })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `Groq API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}
