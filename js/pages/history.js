/* ============================================
   History Page
   ============================================ */

let currentPage = 1;
const PER_PAGE = 20;

async function renderHistoryPage() {
    const container = document.getElementById('page-history');
    container.innerHTML = '<div class="loading">加载中</div>';

    try {
        const data = await API.listMaterials(currentPage, PER_PAGE);
        renderHistory(container, data);
    } catch (err) {
        container.innerHTML = `
            <div class="error-box">
                <p>加载历史记录失败</p>
                <div class="error-detail">${err.message}</div>
            </div>
        `;
    }
}

function renderHistory(container, data) {
    if (!data.items || data.items.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <h2>历史记录</h2>
                <p>还没有朗读记录</p>
                <p style="font-size:0.85em;color:#aaa;">去今日页面生成第一篇素材吧</p>
            </div>
        `;
        return;
    }

    const totalPages = Math.ceil(data.total / PER_PAGE);

    container.innerHTML = `
        <h2 style="margin-bottom:16px;">历史记录</h2>
        <div class="history-list">
            ${data.items.map(m => `
                <a class="history-item" href="#material/${m.id}">
                    <span class="hist-date">${m.generated_date}</span>
                    <span class="hist-title">${m.title}</span>
                    <span class="hist-meta">
                        ${m.recording_count} 条录音
                        ${m.estimated_minutes ? '· ' + m.estimated_minutes + ' 分钟' : ''}
                    </span>
                </a>
            `).join('')}
        </div>
        ${totalPages > 1 ? renderPagination(currentPage, totalPages) : ''}
    `;

    // Wire up pagination
    container.querySelectorAll('.page-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const page = parseInt(btn.dataset.page);
            if (page !== currentPage) {
                currentPage = page;
                renderHistoryPage();
            }
        });
    });
}

function renderPagination(current, total) {
    let html = '<div class="pagination">';
    html += `<button class="page-btn" data-page="${current - 1}" ${current <= 1 ? 'disabled' : ''}>←</button>`;

    for (let i = 1; i <= total; i++) {
        html += `<button class="page-btn ${i === current ? 'active-page' : ''}" data-page="${i}">${i}</button>`;
    }

    html += `<button class="page-btn" data-page="${current + 1}" ${current >= total ? 'disabled' : ''}>→</button>`;
    html += '</div>';
    return html;
}
