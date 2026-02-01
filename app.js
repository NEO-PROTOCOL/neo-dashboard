// API Configuration
const API_BASE = 'http://localhost:3000/api';

// State
let reminders = [];
let messages = [];
let stats = {
    totalReminders: 0,
    totalMessages: 0
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadReminders();
    loadMessages();
    updateStats();

    // Auto-refresh every 30 seconds
    setInterval(() => {
        loadReminders();
        loadMessages();
    }, 30000);
});

// Modal Functions
function openReminderModal() {
    document.getElementById('reminder-modal').classList.add('active');
}

function openMessageModal() {
    document.getElementById('message-modal').classList.add('active');
}

function openBugModal() {
    document.getElementById('bug-modal').classList.add('active');
    // Clear previous results
    document.getElementById('bug-result').style.display = 'none';
    document.getElementById('bug-form').reset();
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

function toggleCustomTime() {
    const select = document.getElementById('reminder-time-type');
    const customGroup = document.getElementById('custom-time-group');
    customGroup.style.display = select.value === 'custom' ? 'block' : 'none';
}

// Create Reminder
async function createReminder(event) {
    event.preventDefault();

    const text = document.getElementById('reminder-text').value;
    const timeType = document.getElementById('reminder-time-type').value;
    const customTime = document.getElementById('custom-time').value;

    let when;
    switch (timeType) {
        case '15min': when = 'in 15 minutes'; break;
        case '30min': when = 'in 30 minutes'; break;
        case '1hour': when = 'in 1 hour'; break;
        case '2hours': when = 'in 2 hours'; break;
        case 'custom': when = customTime; break;
    }

    try {
        const response = await fetch(`${API_BASE}/reminders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, when })
        });

        if (response.ok) {
            showNotification('✅ Lembrete criado com sucesso!', 'success');
            closeModal('reminder-modal');
            document.getElementById('reminder-form').reset();
            loadReminders();
            stats.totalReminders++;
            updateStats();
        } else {
            throw new Error('Falha ao criar lembrete');
        }
    } catch (error) {
        showNotification('❌ Erro ao criar lembrete', 'error');
        console.error(error);
    }
}

// Send Message
async function sendMessage(event) {
    event.preventDefault();

    const to = document.getElementById('message-to').value;
    const text = document.getElementById('message-text').value;

    try {
        const response = await fetch(`${API_BASE}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ to, message: text })
        });

        if (response.ok) {
            showNotification('✅ Mensagem enviada!', 'success');
            closeModal('message-modal');
            document.getElementById('message-form').reset();
            loadMessages();
            stats.totalMessages++;
            updateStats();
        } else {
            throw new Error('Falha ao enviar mensagem');
        }
    } catch (error) {
        showNotification('❌ Erro ao enviar mensagem', 'error');
        console.error(error);
    }
}

// Load Reminders
async function loadReminders() {
    try {
        const response = await fetch(`${API_BASE}/reminders`);
        if (response.ok) {
            reminders = await response.json();
            renderReminders();
            const countEl = document.getElementById('reminders-count');
            if (countEl) {
                countEl.textContent = `${reminders.length} agendados`;
            }
        }
    } catch (error) {
        console.error('Erro ao carregar lembretes:', error);
        // Fallback to mock data for demo
        renderMockReminders();
    }
}

function renderReminders() {
    const container = document.getElementById('reminders-list');
    if (!container) return;

    if (reminders.length === 0) {
        container.innerHTML = '<div class="empty-state">Nenhum lembrete agendado</div>';
        return;
    }

    container.innerHTML = reminders.map(reminder => `
        <div class="reminder-item">
            <div class="reminder-text">🔔 ${reminder.text}</div>
            <div class="reminder-time">${formatTime(reminder.scheduledFor)}</div>
        </div>
    `).join('');
}

function renderMockReminders() {
    const container = document.getElementById('reminders-list');
    if (!container) return;
    
    container.innerHTML = `
        <div class="reminder-item">
            <div class="reminder-text">🔔 Beber água</div>
            <div class="reminder-time">Daqui a 30 minutos</div>
        </div>
        <div class="reminder-item">
            <div class="reminder-text">🔔 Academia</div>
            <div class="reminder-time">Daqui a 2 horas</div>
        </div>
    `;
    
    const countEl = document.getElementById('reminders-count');
    if (countEl) {
        countEl.textContent = '2 agendados';
    }
}

// Load Messages
async function loadMessages() {
    try {
        const response = await fetch(`${API_BASE}/messages`);
        if (response.ok) {
            messages = await response.json();
            renderMessages();
        }
    } catch (error) {
        console.error('Erro ao carregar mensagens:', error);
        // Fallback to mock data
        renderMockMessages();
    }
}

function renderMessages() {
    const container = document.getElementById('messages-list');
    if (!container) return;

    if (messages.length === 0) {
        container.innerHTML = '<div class="empty-state">Nenhuma mensagem ainda</div>';
        return;
    }

    container.innerHTML = messages.slice(0, 5).map(msg => `
        <div class="message-item">
            <div class="message-header">
                <span class="message-from">${msg.from}</span>
                <span class="message-time">${formatTime(msg.timestamp)}</span>
            </div>
            <div class="message-text">${msg.text}</div>
        </div>
    `).join('');
}

function renderMockMessages() {
    const container = document.getElementById('messages-list');
    if (!container) return;
    
    container.innerHTML = `
        <div class="message-item">
            <div class="message-header">
                <span class="message-from">Você → Ana Carolina</span>
                <span class="message-time">há 5 minutos</span>
            </div>
            <div class="message-text">vc me ama?</div>
        </div>
        <div class="message-item">
            <div class="message-header">
                <span class="message-from">Sistema</span>
                <span class="message-time">há 10 minutos</span>
            </div>
            <div class="message-text">🔔 LEMBRETE: Teste funcionando!</div>
        </div>
    `;
}

// Update Stats
function updateStats() {
    const totalRemindersEl = document.getElementById('total-reminders');
    const totalMessagesEl = document.getElementById('total-messages');
    
    if (totalRemindersEl) {
        totalRemindersEl.textContent = stats.totalReminders;
    }
    if (totalMessagesEl) {
        totalMessagesEl.textContent = stats.totalMessages;
    }
}

// Refresh Status
async function refreshStatus() {
    showNotification('🔄 Atualizando...', 'info');
    await Promise.all([
        loadReminders(),
        loadMessages()
    ]);
    showNotification('✅ Atualizado!', 'success');
}

// Utility Functions
function formatTime(timestamp) {
    if (!timestamp) return 'Agora';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = date - now;

    if (diff < 0) return 'Expirado';

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `Em ${days} dia${days > 1 ? 's' : ''}`;
    if (hours > 0) return `Em ${hours} hora${hours > 1 ? 's' : ''}`;
    if (minutes > 0) return `Em ${minutes} minuto${minutes > 1 ? 's' : ''}`;
    return 'Agora';
}

function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 16px 24px;
        background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#6366f1'};
        color: white;
        border-radius: 12px;
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.5);
        z-index: 2000;
        animation: slideIn 0.3s ease-out;
        font-weight: 500;
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Add animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            opacity: 0;
            transform: translateX(100px);
        }
        to {
            opacity: 1;
            transform: translateX(0);
        }
    }
    
    @keyframes slideOut {
        from {
            opacity: 1;
            transform: translateX(0);
        }
        to {
            opacity: 0;
            transform: translateX(100px);
        }
    }
`;
document.head.appendChild(style);

// Close modals on outside click
window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        e.target.classList.remove('active');
    }
});

// ============================================
// AI CHAT FUNCTIONS
// ============================================

let aiChatHistory = [];

// Send AI Message
async function sendAIMessage(event) {
    event.preventDefault();

    const input = document.getElementById('ai-input');
    const message = input.value.trim();

    if (!message) return;

    // Clear input
    input.value = '';

    // Add user message to UI
    addAIMessage('user', message);

    // Show loading
    const loadingId = addAIMessage('loading', 'Claude está pensando...');

    // Disable input
    const sendBtn = document.querySelector('.ai-send-btn');
    sendBtn.disabled = true;

    try {
        const response = await fetch(`${API_BASE}/ai/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message,
                userId: 'dashboard-user'
            })
        });

        if (response.ok) {
            const data = await response.json();

            // Remove loading message
            removeAIMessage(loadingId);

            // Add assistant response
            addAIMessage('assistant', data.message);

            // Update stats
            loadAIStats();
        } else {
            throw new Error('Falha ao enviar mensagem');
        }
    } catch (error) {
        removeAIMessage(loadingId);
        addAIMessage('assistant', '❌ Erro ao processar mensagem. Verifique se a API do Claude está configurada.');
        console.error(error);
    } finally {
        sendBtn.disabled = false;
        input.focus();
    }
}

// Add message to chat UI
function addAIMessage(type, content) {
    const messagesContainer = document.getElementById('ai-messages');

    // Remove welcome message if exists
    const welcome = messagesContainer.querySelector('.ai-welcome');
    if (welcome) {
        welcome.remove();
    }

    const messageId = `msg-${Date.now()}`;
    const messageDiv = document.createElement('div');
    messageDiv.className = `ai-message ${type}`;
    messageDiv.id = messageId;

    const contentDiv = document.createElement('div');
    contentDiv.className = 'ai-message-content';
    contentDiv.textContent = content;

    messageDiv.appendChild(contentDiv);

    if (type !== 'loading') {
        const timeDiv = document.createElement('div');
        timeDiv.className = 'ai-message-time';
        timeDiv.textContent = new Date().toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit'
        });
        messageDiv.appendChild(timeDiv);
    }

    messagesContainer.appendChild(messageDiv);

    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    return messageId;
}

// Remove message from chat UI
function removeAIMessage(messageId) {
    const message = document.getElementById(messageId);
    if (message) {
        message.remove();
    }
}

// Clear AI context
async function clearAIContext() {
    if (!confirm('Limpar histórico de conversa?')) return;

    try {
        await fetch(`${API_BASE}/ai/clear-context`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: 'dashboard-user' })
        });

        // Clear UI
        const messagesContainer = document.getElementById('ai-messages');
        messagesContainer.innerHTML = `
            <div class="ai-welcome">
                👋 Olá! Sou o Claude AI. Como posso ajudar você hoje?
            </div>
        `;

        showNotification('✅ Contexto limpo!', 'success');
    } catch (error) {
        showNotification('❌ Erro ao limpar contexto', 'error');
    }
}

// Load AI Stats
async function loadAIStats() {
    try {
        const response = await fetch(`${API_BASE}/ai/stats`);
        if (response.ok) {
            const stats = await response.json();

            const requestsEl = document.getElementById('ai-requests');
            const tokensEl = document.getElementById('ai-tokens');
            const costEl = document.getElementById('ai-cost');
            const avgTimeEl = document.getElementById('ai-avg-time');

            if (requestsEl) requestsEl.textContent = stats.totalRequests;
            if (tokensEl) tokensEl.textContent = stats.totalTokens.toLocaleString();
            if (costEl) costEl.textContent = `$${stats.totalCost.toFixed(4)}`;
            if (avgTimeEl) avgTimeEl.textContent = `${stats.avgResponseTime}ms`;
        }
    } catch (error) {
        console.error('Erro ao carregar stats de IA:', error);
    }
}

// Initialize AI features
document.addEventListener('DOMContentLoaded', () => {
    // Load AI stats on startup
    loadAIStats();

    // Refresh AI stats every 30 seconds
    setInterval(loadAIStats, 30000);
});

// ============================================
// BUG ANALYZER FUNCTIONS
// ============================================

async function analyzeBug(event) {
    event.preventDefault();

    const error = document.getElementById('bug-error').value.trim();
    const code = document.getElementById('bug-code').value.trim();

    if (!error) {
        showNotification('❌ Forneça uma mensagem de erro', 'error');
        return;
    }

    // Show loading
    const resultDiv = document.getElementById('bug-result');
    const analysisDiv = document.getElementById('bug-analysis');

    resultDiv.style.display = 'block';
    analysisDiv.innerHTML = '<div class="loading">🔍 Analisando bug...</div>';

    // Disable submit button
    const submitBtn = document.querySelector('#bug-form button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = '🔍 Analisando...';

    try {
        const response = await fetch(`${API_BASE}/ai/analyze-bug`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error, code })
        });

        if (response.ok) {
            const data = await response.json();

            // Format and display analysis
            analysisDiv.innerHTML = formatBugAnalysis(data.message);

            // Update AI stats
            loadAIStats();

            showNotification('✅ Análise concluída!', 'success');
        } else {
            throw new Error('Falha ao analisar bug');
        }
    } catch (error) {
        analysisDiv.innerHTML = `
            <div class="empty-state">
                ❌ Erro ao analisar bug. Verifique se a API do Claude está configurada.
            </div>
        `;
        showNotification('❌ Erro ao analisar bug', 'error');
        console.error(error);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = '🔍 Analisar Bug';
    }
}

function formatBugAnalysis(text) {
    // Convert markdown-like formatting to HTML
    let formatted = text
        .replace(/### (.*)/g, '<h3>$1</h3>')
        .replace(/## (.*)/g, '<h3>$1</h3>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\n\n/g, '<br><br>');

    return formatted;
}

// ============================================
// AUTOMATIONS FUNCTIONS
// ============================================

async function loadAutomations() {
    try {
        const response = await fetch(`${API_BASE}/automations/tasks`);
        
        if (!response.ok) {
            throw new Error('Failed to load automations');
        }

        const data = await response.json();
        
        if (data.success) {
            displayAutomations(data.tasks);
            updateAutomationStats(data.stats);
        }
    } catch (error) {
        console.error('Error loading automations:', error);
        const container = document.getElementById('automations-list');
        if (container) {
            container.innerHTML = '<div class="empty-state">❌ Erro ao carregar automações</div>';
        }
    }
}

function displayAutomations(tasks) {
    const container = document.getElementById('automations-list');
    if (!container) return;
    
    if (!tasks || tasks.length === 0) {
        container.innerHTML = '<div class="empty-state">Nenhuma automação configurada</div>';
        return;
    }

    container.innerHTML = tasks.map(task => `
        <div class="automation-item">
            <div class="automation-info">
                <div class="automation-name">
                    <span class="automation-status ${task.enabled ? 'enabled' : 'disabled'}"></span>
                    ${task.name}
                </div>
                <div class="automation-schedule">${task.schedule}</div>
                <div class="automation-meta">
                    <span>✓ ${task.runCount} execuções</span>
                    ${task.errorCount > 0 ? `<span>⚠️ ${task.errorCount} erros</span>` : ''}
                    ${task.lastRun ? `<span>📅 ${formatDate(task.lastRun)}</span>` : ''}
                </div>
            </div>
            <div class="automation-actions">
                <button class="automation-btn" onclick="executeAutomation('${task.id}')">
                    ▶️ Executar
                </button>
                <button class="automation-btn toggle ${task.enabled ? 'enabled' : 'disabled'}" 
                        onclick="toggleAutomation('${task.id}', ${!task.enabled})">
                    ${task.enabled ? '⏸️ Pausar' : '▶️ Ativar'}
                </button>
            </div>
        </div>
    `).join('');
}

function updateAutomationStats(stats) {
    const totalEl = document.getElementById('automation-total');
    const runsEl = document.getElementById('automation-runs');
    
    if (totalEl) totalEl.textContent = stats.enabled;
    if (runsEl) runsEl.textContent = stats.totalRuns;
}

async function executeAutomation(taskId) {
    try {
        showNotification('🚀 Executando automação...', 'info');
        
        const response = await fetch(`${API_BASE}/automations/tasks/${taskId}/execute`, {
            method: 'POST'
        });

        const data = await response.json();

        if (data.success) {
            showNotification('✅ Automação executada com sucesso!', 'success');
            loadAutomations();
        } else {
            throw new Error(data.error || 'Failed to execute automation');
        }
    } catch (error) {
        console.error('Error executing automation:', error);
        showNotification('❌ Erro ao executar automação', 'error');
    }
}

async function toggleAutomation(taskId, enabled) {
    try {
        const response = await fetch(`${API_BASE}/automations/tasks/${taskId}/toggle`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enabled })
        });

        const data = await response.json();

        if (data.success) {
            showNotification(`✅ Automação ${enabled ? 'ativada' : 'pausada'}!`, 'success');
            loadAutomations();
        } else {
            throw new Error(data.error || 'Failed to toggle automation');
        }
    } catch (error) {
        console.error('Error toggling automation:', error);
        showNotification('❌ Erro ao alterar automação', 'error');
    }
}

async function generateReport() {
    try {
        showNotification('📊 Gerando relatório inteligente...', 'info');
        
        const button = event.target.closest('button');
        button.disabled = true;
        button.innerHTML = '<span class="spinner"></span> Gerando...';

        const response = await fetch(`${API_BASE}/automations/report/generate`, {
            method: 'POST'
        });

        const data = await response.json();

        if (data.success) {
            const previewDiv = document.getElementById('report-preview');
            const contentDiv = document.getElementById('report-content');
            
            if (contentDiv) {
                contentDiv.textContent = data.report;
            }
            if (previewDiv) {
                previewDiv.style.display = 'block';
            }
            
            showNotification('✅ Relatório gerado com sucesso!', 'success');
        } else {
            throw new Error(data.error || 'Failed to generate report');
        }
    } catch (error) {
        console.error('Error generating report:', error);
        showNotification('❌ Erro ao gerar relatório', 'error');
    } finally {
        const button = event.target.closest('button');
        button.disabled = false;
        button.innerHTML = '<span class="btn-icon">📄</span><span>Gerar Relatório Inteligente</span>';
    }
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    
    // Less than 1 minute
    if (diff < 60000) {
        return 'agora mesmo';
    }
    
    // Less than 1 hour
    if (diff < 3600000) {
        const minutes = Math.floor(diff / 60000);
        return `há ${minutes} min`;
    }
    
    // Less than 24 hours
    if (diff < 86400000) {
        const hours = Math.floor(diff / 3600000);
        return `há ${hours}h`;
    }
    
    // More than 24 hours
    return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Initialize automations on page load
document.addEventListener('DOMContentLoaded', () => {
    loadAutomations();
    
    // Auto-refresh automations every 30 seconds
    setInterval(loadAutomations, 30000);
});
