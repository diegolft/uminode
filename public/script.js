let isConnected = false;

// *** CONFIGURAÇÕES DE AUTOMAÇÃO NO FRONTEND ***
const AUTOMATION_CONFIG = {
    LIGAR_EM: 300,      // Liga bomba quando sensor <= 300
    DESLIGAR_EM: 350,   // Desliga bomba quando sensor >= 350
    enabled: true,      // Automação ativa/inativa
    ultimoComando: null,
    ultimoValor: null
};

let lastSensorValue = null;
let lastPumpState = null;

// Função para atualizar status
async function atualizarStatus() {
    try {
        const response = await fetch('/api/status');
        const data = await response.json();
        
        // Status de conexão
        const connectionStatus = document.getElementById('connectionStatus');
        if (data.conectado) {
            connectionStatus.textContent = 'Conectado';
            connectionStatus.className = 'status-badge status-connected';
            isConnected = true;
            hideError();
        } else {
            connectionStatus.textContent = 'Desconectado';
            connectionStatus.className = 'status-badge status-disconnected';
            isConnected = false;
            showError('Arduino desconectado');
        }
        
        // Valor do sensor
        document.getElementById('sensorValue').textContent = data.valorBruto || '--';
        
        // Status da bomba
        const pumpStatus = document.getElementById('pumpStatus');
        const pumpIndicator = document.getElementById('pumpIndicator');
        const pumpText = document.getElementById('pumpText');
        
        if (data.bomba === 'ON') {
            pumpStatus.className = 'pump-status pump-on';
            pumpIndicator.className = 'pump-indicator indicator-on';
            pumpText.textContent = 'Bomba Ligada';
        } else {
            pumpStatus.className = 'pump-status pump-off';
            pumpIndicator.className = 'pump-indicator indicator-off';
            pumpText.textContent = 'Bomba Desligada';
        }
        
        // Última atualização
        if (data.ultimaAtualizacao) {
            const dataUpdate = new Date(data.ultimaAtualizacao);
            document.getElementById('lastUpdate').textContent = 
                `Última atualização: ${dataUpdate.toLocaleTimeString()}`;
        }
        
        // *** LÓGICA DE AUTOMAÇÃO NO FRONTEND ***
        if (AUTOMATION_CONFIG.enabled && isConnected && data.valorBruto !== undefined) {
            processarAutomacao(data.valorBruto, data.bomba);
        }
        
        // Atualiza valores para próxima comparação
        lastSensorValue = data.valorBruto;
        lastPumpState = data.bomba;
        
    } catch (error) {
        console.error('Erro ao buscar status:', error);
        showError('Erro de comunicação com o servidor');
        isConnected = false;
    }
}

// *** FUNÇÃO DE AUTOMAÇÃO NO FRONTEND ***
async function processarAutomacao(valorBruto, estadoBomba) {
    const bombaLigada = estadoBomba === 'ON';
    const agora = Date.now();
    
    // Evita comandos muito frequentes (mínimo 5 segundos entre comandos)
    if (AUTOMATION_CONFIG.ultimoComando && (agora - AUTOMATION_CONFIG.ultimoComando) < 5000) {
        return;
    }
    
    // Liga bomba quando solo está SECO (valor <= 350)
    if (!bombaLigada && valorBruto <= AUTOMATION_CONFIG.LIGAR_EM) {
        console.log(`🚰 Automação Frontend: Ligando bomba - Sensor: ${valorBruto} (≤ ${AUTOMATION_CONFIG.LIGAR_EM})`);
        
        try {
            const response = await fetch('/api/bomba/ligar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            
            const result = await response.json();
            if (result.sucesso) {
                showAutomationMessage(`Automação: Bomba ligada - Solo seco (${valorBruto})`);
                AUTOMATION_CONFIG.ultimoComando = agora;
            }
        } catch (error) {
            console.error('Erro ao ligar bomba automaticamente:', error);
        }
    }
    
    // Desliga bomba quando solo está ÚMIDO (valor >= 400)
    else if (bombaLigada && valorBruto >= AUTOMATION_CONFIG.DESLIGAR_EM) {
        console.log(`⏹️ Automação Frontend: Desligando bomba - Sensor: ${valorBruto} (≥ ${AUTOMATION_CONFIG.DESLIGAR_EM})`);
        
        try {
            const response = await fetch('/api/bomba/desligar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            
            const result = await response.json();
            if (result.sucesso) {
                showAutomationMessage(`Automação: Bomba desligada - Solo úmido (${valorBruto})`);
                AUTOMATION_CONFIG.ultimoComando = agora;
            }
        } catch (error) {
            console.error('Erro ao desligar bomba automaticamente:', error);
        }
    }
    
    // Log para debug
    else {
        console.log(`📊 Automação: Sem ação - Bomba: ${bombaLigada ? 'ON' : 'OFF'}, Sensor: ${valorBruto}, Faixa: ${AUTOMATION_CONFIG.LIGAR_EM}-${AUTOMATION_CONFIG.DESLIGAR_EM}`);
    }
}

// Função para mostrar mensagens de automação
function showAutomationMessage(message) {
    const automationDiv = document.createElement('div');
    automationDiv.className = 'automation-message';
    automationDiv.textContent = message;
    automationDiv.style.cssText = `
        position: fixed;
        top: 70px;
        right: 20px;
        background: #4CAF50;
        color: white;
        padding: 10px 15px;
        border-radius: 5px;
        z-index: 1000;
        font-size: 14px;
        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    `;
    
    document.body.appendChild(automationDiv);
    
    // Remove após 4 segundos
    setTimeout(() => {
        if (automationDiv.parentNode) {
            automationDiv.parentNode.removeChild(automationDiv);
        }
    }, 4000);
}

// Funções de controle manual
async function ligarBomba() {
    if (!isConnected) {
        showError('Arduino não conectado');
        return;
    }
    
    try {
        const response = await fetch('/api/bomba/ligar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        const result = await response.json();
        if (!result.sucesso) {
            showError(result.mensagem);
        } else {
            showAutomationMessage('Bomba ligada manualmente');
        }
    } catch (error) {
        showError('Erro ao ligar bomba');
    }
}

async function desligarBomba() {
    if (!isConnected) {
        showError('Arduino não conectado');
        return;
    }
    
    try {
        const response = await fetch('/api/bomba/desligar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        const result = await response.json();
        if (!result.sucesso) {
            showError(result.mensagem);
        } else {
            showAutomationMessage('Bomba desligada manualmente');
        }
    } catch (error) {
        showError('Erro ao desligar bomba');
    }
}

// Função para alternar automação
function toggleAutomacao() {
    AUTOMATION_CONFIG.enabled = !AUTOMATION_CONFIG.enabled;
    
    const button = document.getElementById('toggleAutomacao');
    if (button) {
        button.textContent = AUTOMATION_CONFIG.enabled ? 'Desativar Automação' : 'Ativar Automação';
        button.className = AUTOMATION_CONFIG.enabled ? 'btn btn-warning' : 'btn btn-success';
    }
    
    const status = AUTOMATION_CONFIG.enabled ? 'ativada' : 'desativada';
    showAutomationMessage(`Automação ${status}`);
    
    console.log(`Automação ${status}`);
}

// Funções de UI
function showError(message) {
    const errorDiv = document.getElementById('errorMessage');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    setTimeout(hideError, 5000);
}

function hideError() {
    document.getElementById('errorMessage').style.display = 'none';
}

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
    // Adiciona botão de controle de automação
    const controlsDiv = document.querySelector('.controls');
    if (controlsDiv) {
        const toggleButton = document.createElement('button');
        toggleButton.id = 'toggleAutomacao';
        toggleButton.className = 'btn btn-warning';
        toggleButton.textContent = 'Desativar Automação';
        toggleButton.onclick = toggleAutomacao;
        controlsDiv.appendChild(toggleButton);
        
        // Adiciona informações de configuração
        const configDiv = document.createElement('div');
        configDiv.className = 'automation-config';
        configDiv.innerHTML = `
            <small style="display: block; margin-top: 10px; color: #666;">
                Automação: Liga ≤ ${AUTOMATION_CONFIG.LIGAR_EM} | Desliga ≥ ${AUTOMATION_CONFIG.DESLIGAR_EM}
            </small>
        `;
        controlsDiv.appendChild(configDiv);
    }
    
    // Atualizar status imediatamente
    atualizarStatus();
    
    // Atualizar a cada 3 segundos (um pouco mais devagar para evitar spam)
    setInterval(atualizarStatus, 3000);
    
    console.log('Sistema iniciado com automação no frontend');
    console.log('Configuração:', AUTOMATION_CONFIG);
});

// *** FUNCIONALIDADES DO MENU LATERAL E NAVEGAÇÃO ***

// Função para navegar entre páginas
function navegarPara(pagina) {
    // Remove classe active de todas as páginas
    const todasPaginas = document.querySelectorAll('.page');
    todasPaginas.forEach(p => p.classList.remove('active'));
    
    // Remove classe active de todos os botões do header
    const todosBotoes = document.querySelectorAll('.nav-btn');
    todosBotoes.forEach(btn => btn.classList.remove('active'));
    
    // Ativa a página selecionada
    const paginaSelecionada = document.getElementById(pagina);
    if (paginaSelecionada) {
        paginaSelecionada.classList.add('active');
    }
    
    // Ativa o botão correspondente no header
    const botaoAtivo = document.querySelector(`[data-page="${pagina}"]`);
    if (botaoAtivo) {
        botaoAtivo.classList.add('active');
    }
    
    console.log(`Navegando para: ${pagina}`);
}

// *** FUNCIONALIDADES DO POPUP E FOGOS DE ARTIFÍCIO ***

// Função para mostrar popup de nota máxima
function mostrarPopupNota() {
    const popup = document.getElementById('popupNota');
    if (popup) {
        popup.classList.add('active');
        iniciarFogosDeArtificio();
    }
}

// Função para fechar popup
function fecharPopupNota() {
    const popup = document.getElementById('popupNota');
    if (popup) {
        popup.classList.remove('active');
        pararFogosDeArtificio();
    }
}

// *** SISTEMA DE FOGOS DE ARTIFÍCIO ***

let animacaoFogos = null;
let canvas = null;
let ctx = null;
let fogos = [];

// Classe para representar um fogo de artifício
class FogoDeArtificio {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.particulas = [];
        this.cores = ['#ffae00', '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57', '#ff9ff3', '#54a0ff'];
        this.criarParticulas();
    }
    
    criarParticulas() {
        const numParticulas = 15 + Math.random() * 15;
        for (let i = 0; i < numParticulas; i++) {
            this.particulas.push({
                x: this.x,
                y: this.y,
                vx: (Math.random() - 0.5) * 8,
                vy: (Math.random() - 0.5) * 8,
                vida: 1.0,
                cor: this.cores[Math.floor(Math.random() * this.cores.length)],
                tamanho: 2 + Math.random() * 3
            });
        }
    }
    
    atualizar() {
        this.particulas.forEach(particula => {
            particula.x += particula.vx;
            particula.y += particula.vy;
            particula.vy += 0.1; // gravidade
            particula.vida -= 0.02;
            particula.vx *= 0.99; // resistência do ar
            particula.vy *= 0.99;
        });
        
        // Remove partículas mortas
        this.particulas = this.particulas.filter(p => p.vida > 0);
        
        return this.particulas.length > 0;
    }
    
    desenhar(ctx) {
        this.particulas.forEach(particula => {
            ctx.save();
            ctx.globalAlpha = particula.vida;
            ctx.fillStyle = particula.cor;
            ctx.beginPath();
            ctx.arc(particula.x, particula.y, particula.tamanho, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        });
    }
}

// Função para iniciar fogos de artifício
function iniciarFogosDeArtificio() {
    canvas = document.getElementById('fireworksCanvas');
    if (!canvas) return;
    
    ctx = canvas.getContext('2d');
    canvas.style.display = 'block';
    
    // Ajusta o tamanho do canvas
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    // Cria fogos iniciais
    for (let i = 0; i < 5; i++) {
        setTimeout(() => {
            criarNovoFogo();
        }, i * 300);
    }
    
    // Inicia a animação
    animarFogos();
    
    // Cria novos fogos periodicamente
    animacaoFogos = setInterval(() => {
        if (Math.random() < 0.7) {
            criarNovoFogo();
        }
    }, 800);
}

// Função para criar um novo fogo
function criarNovoFogo() {
    const x = Math.random() * canvas.width;
    const y = Math.random() * (canvas.height * 0.6) + (canvas.height * 0.2);
    fogos.push(new FogoDeArtificio(x, y));
}

// Função para animar os fogos
function animarFogos() {
    if (!canvas || !ctx) return;
    
    ctx.fillStyle = 'rgba(18, 18, 18, 0.1)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Atualiza e desenha todos os fogos
    fogos = fogos.filter(fogo => {
        const ativo = fogo.atualizar();
        fogo.desenhar(ctx);
        return ativo;
    });
    
    // Continua a animação se o popup estiver ativo
    const popup = document.getElementById('popupNota');
    if (popup && popup.classList.contains('active')) {
        requestAnimationFrame(animarFogos);
    }
}

// Função para parar fogos de artifício
function pararFogosDeArtificio() {
    if (animacaoFogos) {
        clearInterval(animacaoFogos);
        animacaoFogos = null;
    }
    
    if (canvas) {
        canvas.style.display = 'none';
    }
    
    fogos = [];
}

// *** EVENTOS E INICIALIZAÇÃO ADICIONAL ***

// Adiciona evento para redimensionar canvas
window.addEventListener('resize', () => {
    if (canvas && canvas.style.display !== 'none') {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
});

// Adiciona evento para fechar popup com ESC
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        fecharPopupNota();
    }
});

// Adiciona evento para fechar popup clicando fora
document.addEventListener('click', (e) => {
    const popup = document.getElementById('popupNota');
    if (popup && popup.classList.contains('active') && e.target === popup) {
        fecharPopupNota();
    }
});

console.log('Funcionalidades do menu lateral e fogos de artifício carregadas!');

