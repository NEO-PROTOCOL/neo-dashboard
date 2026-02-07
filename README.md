# 🎨 NeoBot Dashboard - iOS Style

Dashboard moderno com design inspirado no iOS, usando glassmorphism, animações suaves e interface intuitiva.

## ✨ Features

### Design iOS-like

- 🌈 **Glassmorphism**: Efeitos de vidro com blur e transparência
- 🎭 **Dynamic Gradients**: Gradientes animados e coloridos
- ⚡ **Spring Animations**: Animações suaves estilo iOS
- 📱 **Responsive**: Adapta perfeitamente a mobile
- 🌙 **Dark Mode**: Design dark elegante

### Funcionalidades

- 📊 **Visualização em Tempo Real**: Status do sistema atualizado automaticamente
- 🤖 **Chat com Claude AI**: Interface de chat integrada
- 📅 **Gerenciamento de Lembretes**: Criar e visualizar lembretes
- 💬 **Envio de Mensagens**: Telegram integrado
- 🐛 **Analisador de Bugs**: Análise automática de erros com IA
- 🔄 **Automações**: Controle completo de automações avançadas
- 📄 **Relatórios**: Geração de relatórios inteligentes

## 🚀 Início Rápido

### Instalação

```bash
cd dashboard
npm install
```

### Configuração

1. Configure as variáveis de ambiente no arquivo `.env` na raiz do projeto:

```env
TELEGRAM_BOT_TOKEN=seu_token
TELEGRAM_ADMIN_CHAT=seu_chat_id
ANTHROPIC_API_KEY=sua_chave_claude
```

1. Inicie o servidor:

```bash
node server.js
```

1. Acesse o dashboard:

```
http://localhost:3000
```

## 🎨 Guia de Estilo

### Cores

```css
/* Primary Colors */
--accent-primary: #007AFF   /* iOS Blue */
--accent-secondary: #5856D6  /* iOS Purple */
--accent-success: #34C759    /* iOS Green */
--accent-warning: #FF9500    /* iOS Orange */
--accent-danger: #FF3B30     /* iOS Red */

/* Background */
--bg-primary: #000000
--bg-secondary: #1c1c1e
--bg-glass: rgba(255, 255, 255, 0.05)

/* Text */
--text-primary: #FFFFFF
--text-secondary: rgba(235, 235, 245, 0.6)
--text-muted: rgba(235, 235, 245, 0.3)
```

### Componentes

#### Bento Grid

Layout em grade responsivo que se adapta ao conteúdo:

```html
<div class="bento-grid">
    <div class="bento-card">Normal</div>
    <div class="bento-card card-tall">Alta</div>
    <div class="bento-card card-wide">Larga</div>
</div>
```

**Variantes:**

- `.card-primary` - Azul (ações principais)
- `.card-accent` - Verde (saúde/status)
- `.card-stats` - Laranja (estatísticas)
- `.card-tall` - Altura 2x
- `.card-wide` - Largura 2x

#### Action Buttons

Botões iOS-style com animação de shine:

```html
<button class="action-btn">
    <span class="btn-icon">🔔</span>
    <span>Novo Lembrete</span>
</button>
```

#### Modals

Modais com blur backdrop e animação slideUp:

```javascript
function openModal() {
    document.getElementById('my-modal').classList.add('active');
}

function closeModal() {
    document.getElementById('my-modal').classList.remove('active');
}
```

### Animações

#### Float Animation (Logo)

```css
@keyframes float {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-10px); }
}
```

#### Pulse Animation (Status Dot)

```css
@keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
}
```

#### Slide Up (Modal)

```css
@keyframes slideUp {
    from {
        opacity: 0;
        transform: translateY(20px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}
```

## 📱 Seções do Dashboard

### 1. Header

Status badge animado e logo com float effect.

```html
<header class="header">
    <div class="logo">
        <span class="logo-icon">🛰️</span>
        <h1>NΞØ BOT</h1>
    </div>
    <div class="status-badge">
        <span class="status-dot"></span>
        <span>Sistema Ativo</span>
    </div>
</header>
```

### 2. Ações Rápidas

Botões para ações principais do sistema.

### 3. Lembretes Agendados

Lista scrollável de lembretes com auto-refresh.

### 4. Saúde do Sistema

Métricas em tempo real:

- Status Telegram
- Status Scheduler
- Contagem de lembretes

### 5. Mensagens Recentes

Histórico das últimas mensagens enviadas.

### 6. Chat com Claude AI

Interface de chat em tempo real:

- Mensagens do usuário (direita, azul)
- Respostas da IA (esquerda, cinza)
- Input com envio rápido
- Histórico persistente

### 7. Estatísticas de IA

Métricas de uso do Claude:

- Total de requests
- Tokens consumidos
- Custo acumulado
- Tempo médio de resposta

### 8. Automações Avançadas

Lista de todas as automações com:

- Status (ativa/pausada)
- Schedule (cron)
- Contadores (runs/errors)
- Controles (executar/toggle)

### 9. Gerador de Relatórios

Botão para gerar relatórios sob demanda com preview.

### 10. Estatísticas de Automações

Contadores rápidos:

- Automações ativas
- Execuções do dia

## 🔧 Customização

### Adicionar Nova Seção

1. Adicione o HTML no `index.html`:

```html
<div class="bento-card">
    <div class="card-header">
        <h2>🎯 Minha Seção</h2>
        <button class="icon-btn" onclick="loadMyData()">↻</button>
    </div>
    <div id="my-data" class="my-container">
        <!-- Conteúdo -->
    </div>
</div>
```

1. Adicione estilos no `styles.css`:

```css
.my-container {
    /* seus estilos */
}
```

1. Adicione lógica no `app.js`:

```javascript
async function loadMyData() {
    const response = await fetch(`${API_BASE}/my-endpoint`);
    const data = await response.json();
    // Renderizar dados
}
```

### Modificar Cores

Edite as variáveis CSS no início de `styles.css`:

```css
:root {
    --accent-primary: #007AFF; /* Sua cor aqui */
}
```

### Adicionar Animação

```css
.minha-classe {
    animation: minhaAnimacao 2s ease-in-out infinite;
}

@keyframes minhaAnimacao {
    0% { /* estado inicial */ }
    50% { /* meio */ }
    100% { /* estado final */ }
}
```

## 🎯 Boas Práticas

### Performance

1. **Use backdrop-filter com moderação**: É pesado para GPU
2. **Limite auto-refresh**: 30s é um bom intervalo
3. **Lazy load**: Carregue dados sob demanda
4. **Debounce inputs**: Em campos de busca e chat

### Acessibilidade

1. **Contraste**: Mantenha contraste mínimo de 4.5:1
2. **Focus states**: Sempre visível em elementos interativos
3. **Alt text**: Em todas as imagens
4. **ARIA labels**: Em botões sem texto

### Responsividade

O dashboard usa CSS Grid com auto-fit:

```css
.bento-grid {
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
}
```

Em mobile (< 768px):

- Grid colapsa para 1 coluna
- Cards wide/tall voltam ao tamanho normal
- Padding reduzido

## 🐛 Debug

### Console do navegador

Abra com F12 e verifique:

1. **Network**: Requisições API
2. **Console**: Erros JavaScript
3. **Elements**: Inspecionar estilos

### Logs do servidor

```bash
# No terminal do servidor
# Veja logs de requests e errors
```

### Testar API manualmente

```bash
# Health check
curl http://localhost:3000/api/health

# Automações
curl http://localhost:3000/api/automations/tasks

# AI Stats
curl http://localhost:3000/api/ai/stats
```

## 📚 Recursos

- [SF Symbols](https://developer.apple.com/sf-symbols/) - Ícones iOS
- [Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/)
- [iOS Color Palette](https://developer.apple.com/design/human-interface-guidelines/color)
- [Glassmorphism Generator](https://hype4.academy/tools/glassmorphism-generator)

## 🎨 Screenshots

### Desktop View

- Layout em grid com múltiplas colunas
- Glassmorphism effects
- Hover animations

### Mobile View

- Single column
- Touch-friendly buttons
- Optimized spacing

## 🔄 Auto-refresh

O dashboard atualiza automaticamente:

- **Reminders**: A cada 30s
- **Messages**: A cada 30s
- **AI Stats**: Ao enviar mensagem
- **Automations**: A cada 30s
- **System Health**: A cada 30s

## 💡 Tips

1. **Use Command/Ctrl + R**: Refresh rápido
2. **Atalho do Chat**: Enter para enviar
3. **Modais**: Clique fora para fechar (adicione se quiser)
4. **Mobile**: Adicione à tela inicial para app-like experience

## 🚀 Deploy

### Opção 1: Servidor Local

```bash
node server.js
```

### Opção 2: Docker

```dockerfile
FROM node:22
WORKDIR /app
COPY dashboard/package*.json ./
RUN npm install
COPY dashboard/ ./
EXPOSE 3000
CMD ["node", "server.js"]
```

### Opção 3: Render/Vercel

1. Configure variáveis de ambiente
2. Deploy com `npm start`
3. Configure domínio customizado

## 🎯 Performance & Otimizações (v1.1.0)

### ⚡ Melhorias de Performance

- **Hover Effects Otimizados**: Transições 2.6x mais rápidas (0.4s → 0.15s)
- **Sem Transform Pesados**: Removido translateX/Y, scale e rotate
- **CPU/GPU Otimizado**: Redução significativa de uso de recursos
- **Cache Inteligente**: Sistema de cache para requisições da IA
- **Batch Processing**: Processar múltiplas operações em paralelo

### 🐛 Correções de Bugs

- ✅ Corrigido 11 null pointer errors
- ✅ Validação de DOM elements antes de acessar
- ✅ Fail gracefully quando elementos não existem
- ✅ Error handling robusto em todas as funções

### 💰 Economia de IA (30-50%)

- Cache agressivo com TTL de 1 hora
- Auto-limpeza de cache a cada 30 minutos
- Tracking de economia em tempo real
- Ver: [OPTIMIZATIONS.md](../OPTIMIZATIONS.md)

## 📄 License

MIT

---

**Made with ❤️ for NeoBot** | v1.1.0 | Design inspired by iOS 17
*Optimized for performance and cost efficiency* ⚡💰
