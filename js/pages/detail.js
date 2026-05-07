/* ============================================
   Detail Page - View a past material
   ============================================ */

async function renderDetailPage(materialId) {
    const container = document.getElementById('page-detail');
    container.innerHTML = '<div class="loading">加载中</div>';

    if (!materialId) {
        container.innerHTML = `<div class="error-box"><p>未指定素材 ID</p></div>`;
        return;
    }

    try {
        const material = await API.getMaterial(parseInt(materialId));
        currentMaterial = material;

        container.innerHTML = `
            <a class="back-link" href="#history">← 返回历史</a>

            <div class="material-header">
                <h2>${material.title}</h2>
                <div class="material-meta">
                    ${material.generated_date} ·
                    ${material.word_count || 0} 字 ·
                    约 ${material.estimated_minutes || 7} 分钟
                </div>
            </div>

            <div class="material-content">
                ${material.content_html}
            </div>

            <div class="actions">
                <button class="btn btn-record" onclick="toggleRecording()" id="btn-record-detail">
                    🎤 开始录音
                </button>
            </div>

            <div class="recordings-section">
                <h3>录音记录</h3>
                <div id="recordings-list-detail" class="recordings-list">
                    <div class="loading">加载中</div>
                </div>
            </div>
        `;

        await loadDetailRecordings(material.id);
    } catch (err) {
        container.innerHTML = `
            <a class="back-link" href="#history">← 返回历史</a>
            <div class="error-box">
                <p>加载素材失败</p>
                <div class="error-detail">${err.message}</div>
            </div>
        `;
    }
}

async function loadDetailRecordings(materialId) {
    const listEl = document.getElementById('recordings-list-detail');
    if (!listEl) return;
    try {
        const recordings = await API.getRecordings(materialId);
        // Reuse the render function from today.js
        renderRecordings(listEl, recordings);
    } catch (err) {
        listEl.innerHTML = `<div class="empty-state"><p>加载录音失败</p></div>`;
    }
}

// Recording controls are shared from app.js
