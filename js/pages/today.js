/* ============================================
   Today Page
   ============================================ */

async function renderTodayPage() {
    const container = document.getElementById('page-today');

    container.innerHTML = '<div class="loading">加载中</div>';

    try {
        const material = await API.getTodayMaterial();
        currentMaterial = material;
        renderTodayContent(container, material);
    } catch (err) {
        // No material for today yet
        if (err.status === 404) {
            container.innerHTML = `
                <div class="empty-state">
                    <h2>今日朗读</h2>
                    <p>还没有今日的朗读素材</p>
                    <p style="font-size:0.85em;color:#aaa;">每次生成约 4-5 分钟的朗读内容</p>
                    <button class="btn btn-primary" onclick="generateTodayMaterial()" id="btn-generate">
                        生成今日素材
                    </button>
                </div>
            `;
        } else {
            container.innerHTML = `
                <div class="error-box">
                    <p>加载失败</p>
                    <div class="error-detail">${err.message}</div>
                </div>
            `;
        }
    }
}

async function generateTodayMaterial() {
    const btn = document.getElementById('btn-generate');
    if (btn) {
        btn.disabled = true;
        btn.textContent = '生成中（约 10-20 秒）...';
    }

    try {
        const material = await API.generateMaterial();
        currentMaterial = material;
        const container = document.getElementById('page-today');
        renderTodayContent(container, material);
        showToast('素材生成成功！', 'success');
    } catch (err) {
        if (err.message === 'API_KEY_MISSING') {
            showSettings();
            showToast('请先设置 API 密钥', 'error');
        } else {
            showToast('生成失败：' + err.message, 'error');
        }
        if (btn) {
            btn.disabled = false;
            btn.textContent = '重新生成';
        }
    }
}

function renderTodayContent(container, material) {
    container.innerHTML = `
        <div class="material-header">
            <h2>${material.title}</h2>
            <div class="material-meta">
                ${material.word_count || 0} 字 ·
                约 ${material.estimated_minutes || 7} 分钟 ·
                ${material.generated_date}
            </div>
        </div>

        <div class="material-content">
            ${material.content_html}
        </div>

        <div class="actions">
            <button class="btn btn-outline" onclick="generateTodayMaterial()" id="btn-generate">
                🔄 重新生成
            </button>
            <button class="btn btn-record" onclick="toggleRecording()" id="btn-record">
                🎤 开始录音
            </button>
        </div>

        <div class="recordings-section">
            <h3>录音记录</h3>
            <div id="recordings-list" class="recordings-list">
                <div class="loading">加载中</div>
            </div>
        </div>
    `;

    loadRecordings(material.id);
}

async function loadRecordings(materialId) {
    const listEl = document.getElementById('recordings-list');
    try {
        const recordings = await API.getRecordings(materialId);
        renderRecordings(listEl, recordings);
    } catch (err) {
        listEl.innerHTML = `<div class="empty-state"><p>加载录音失败</p></div>`;
    }
}

function renderRecordings(listEl, recordings) {
    if (!recordings || recordings.length === 0) {
        listEl.innerHTML = `<div class="empty-state"><p>还没有录音记录</p></div>`;
        return;
    }

    listEl.innerHTML = recordings.map(r => {
        const dateStr = new Date(r.created_at).toLocaleString('zh-CN', {
            month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit',
        });
        const durStr = r.duration_secs ? formatDuration(r.duration_secs) : '--:--';
        return `
            <div class="recording-item" data-recording-id="${r.id}">
                <span class="rec-time">${durStr}</span>
                <span class="rec-date">${dateStr}</span>
                <span style="font-size:0.78em;color:#aaa;">${formatFileSize(r.file_size_bytes)}</span>
                <div class="rec-actions">
                    <button class="btn-play" data-recording-id="${r.id}"
                            onclick="togglePlay(${r.id}, '${API.getAudioUrl(r.id)}')">▶</button>
                    <button class="btn-icon" onclick="downloadRecording(${r.id})" title="下载">⬇</button>
                    <button class="btn-icon" onclick="deleteRecording(${r.id})" title="删除">✕</button>
                </div>
            </div>
        `;
    }).join('');
}

function formatFileSize(bytes) {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + 'B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB';
    return (bytes / 1024 / 1024).toFixed(1) + 'MB';
}

function togglePlay(recordingId, audioUrl) {
    player.play(recordingId, audioUrl);
}

async function downloadRecording(recordingId) {
    try {
        await API.downloadRecording(recordingId);
    } catch (err) {
        showToast('下载失败：' + err.message, 'error');
    }
}

async function deleteRecording(recordingId) {
    if (!confirm('确定删除这条录音？')) return;
    try {
        await API.deleteRecording(recordingId);
        if (currentMaterial) loadRecordings(currentMaterial.id);
        player.stop();
        showToast('录音已删除', 'info');
    } catch (err) {
        showToast('删除失败：' + err.message, 'error');
    }
}
