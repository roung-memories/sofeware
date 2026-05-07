/* ============================================
   App - Router & Global State
   ============================================ */

const recorder = new AudioRecorder();
const player = new AudioPlayer();
let currentMaterial = null;
let recordingTimer = null;

// === Shared recording controls ===

async function toggleRecording() {
  const bar = document.getElementById('recording-bar');
  const stopBtn = document.getElementById('btn-stop-recording');

  if (recorder.recording) {
    // Stop recording
    stopBtn.disabled = true;
    stopBtn.innerHTML = '<span class="stop-icon">■</span> 处理中...';
    clearInterval(recordingTimer);

    try {
      const result = await recorder.stop();
      bar.classList.remove('active');

      if (result.blob && result.blob.size > 0 && currentMaterial) {
        await API.uploadRecording(currentMaterial.id, result.blob, result.duration);
        await refreshActiveRecordings();
        showToast('录音已保存', 'success');
      }
    } catch (err) {
      showToast('录音失败：' + err.message, 'error');
    }

    stopBtn.disabled = false;
    stopBtn.innerHTML = '<span class="stop-icon">■</span> 停止';
    updateRecordButtonState(false);
  } else {
    // Start recording
    try {
      await recorder.start();
      bar.classList.add('active');
      document.getElementById('recording-bar-timer').textContent = formatDuration(0);
      updateRecordButtonState(true);

      const startTime = Date.now();
      recordingTimer = setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000;
        document.getElementById('recording-bar-timer').textContent = formatDuration(elapsed);
      }, 200);
    } catch (err) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        showToast('需要麦克风权限才能在浏览器中录音', 'error');
      } else {
        showToast('无法启动录音：' + err.message, 'error');
      }
    }
  }
}

async function stopRecording() {
  await toggleRecording();
}

async function refreshActiveRecordings() {
  if (!currentMaterial) return;
  const activePage = document.querySelector('.page.active');
  if (!activePage) return;
  const listEl = activePage.querySelector('.recordings-list');
  if (!listEl) return;
  try {
    const recordings = await API.getRecordings(currentMaterial.id);
    renderRecordings(listEl, recordings);
  } catch (err) {
    // silent
  }
}

function updateRecordButtonState(isRecording) {
  document.querySelectorAll('.btn-record').forEach((btn) => {
    if (isRecording) {
      btn.textContent = '🎤 录音中...';
      btn.classList.add('recording');
      btn.disabled = true;
    } else {
      btn.textContent = '🎤 开始录音';
      btn.classList.remove('recording');
      btn.disabled = false;
    }
  });
}

function formatDuration(secs) {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// === Settings / API Key ===

function showSettings() {
  const overlay = document.getElementById('settings-overlay');
  overlay.classList.remove('hidden');
  const input = document.getElementById('settings-api-key');
  input.value = localStorage.getItem('anthropic_api_key') || '';
  document.getElementById('settings-status').textContent = '';
  // Small delay: let the overlay render, then scroll save button into view
  setTimeout(() => {
    input.focus();
    document.getElementById('btn-save-key').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 300);
}

function hideSettings() {
  document.getElementById('settings-overlay').classList.add('hidden');
}

function saveApiKey() {
  const input = document.getElementById('settings-api-key');
  const key = input.value.trim();
  const status = document.getElementById('settings-status');

  if (!key) {
    status.textContent = '请输入 API 密钥';
    status.style.color = '#e53935';
    return;
  }

  localStorage.setItem('anthropic_api_key', key);
  status.textContent = '已保存';
  status.style.color = '#2e7d32';
  setTimeout(hideSettings, 800);
}

// Close settings on overlay click
document.addEventListener('click', (e) => {
  if (e.target.id === 'settings-overlay') hideSettings();
});

// === Service Worker registration ===

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

function showToast(message, type = 'info', duration = 3000) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = 'toast ' + type;
    toast.classList.remove('hidden');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.add('hidden'), duration);
}

function showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const page = document.getElementById('page-' + pageId);
    if (page) page.classList.add('active');

    document.querySelectorAll('.nav-link').forEach(a => {
        const hash = a.getAttribute('href').slice(1);
        a.classList.toggle('active', hash === pageId);
    });
}

function router() {
    const hash = location.hash.slice(1) || 'today';
    const parts = hash.split('/');
    const page = parts[0];

    switch (page) {
        case 'today':
            showPage('today');
            renderTodayPage();
            break;
        case 'history':
            showPage('history');
            renderHistoryPage();
            break;
        case 'material':
            showPage('detail');
            renderDetailPage(parts[1]);
            break;
        default:
            showPage('today');
            renderTodayPage();
    }
}

// Player state callback
player.onStateChange = (recordingId, playing) => {
    document.querySelectorAll('.btn-play').forEach(btn => {
        const rid = parseInt(btn.dataset.recordingId);
        btn.classList.toggle('playing', playing && rid === recordingId);
        btn.textContent = playing && rid === recordingId ? '⏸' : '▶';
    });
};

window.addEventListener('hashchange', router);
window.addEventListener('load', router);
