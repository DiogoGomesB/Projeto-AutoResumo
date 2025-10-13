// Configurações da API - ATUALIZE COM SUA NOVA CHAVE!
const API_URL_PT = 'https://api-inference.huggingface.co/models/facebook/bart-large-cnn';
const API_URL_EN = 'https://api-inference.huggingface.co/models/facebook/bart-large-cnn'; // Inglês fallback
let API_URL = API_URL_PT;
const API_TOKEN = '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'; // COLE A NOVA CHAVE AQUI (ex: 'hf_abc123...')

// Verificação inicial do token
if (!API_TOKEN || API_TOKEN.trim() === '') {
    console.error('Token inválido ou ausente! Gere uma nova em huggingface.co/settings/tokens e cole aqui.');
    alert('Token não configurado corretamente. Verifique script.js e use uma chave válida.');
    API_URL = API_URL_EN; // Fallback para EN sem token
}

// Chave para localStorage (histórico)
const STORAGE_KEY = 'resumosHistorico';

// Elementos do DOM
const textoInput = document.getElementById('textoInput');
const maxLengthInput = document.getElementById('maxLength');
const gerarBtn = document.getElementById('gerarBtn');
const spinner = document.getElementById('spinner');
const resultado = document.getElementById('resultado');
const resumoTexto = document.getElementById('resumoTexto');
const copiarBtn = document.getElementById('copiarBtn');
const contador = document.getElementById('contador');
const carregarHistorico = document.getElementById('carregarHistorico');
const limparHistorico = document.getElementById('limparHistorico');
const historicoDiv = document.getElementById('historico');

// Inicializações
atualizarContador();
carregarHistoricoLocal();

function atualizarContador() {
    const length = textoInput.value.length;
    contador.textContent = length;
    if (length > 1000) {
        contador.style.color = 'red';
        gerarBtn.disabled = true;
    } else {
        contador.style.color = 'inherit';
        gerarBtn.disabled = false;
    }
}

function salvarResumo(textoOriginal, resumo) {
    let historico = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    historico.unshift({ original: textoOriginal.substring(0, 100) + '...', resumo });
    if (historico.length > 3) historico = historico.slice(0, 3);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(historico));
    exibirHistorico();
}

function carregarHistoricoLocal() {
    const historico = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    exibirHistorico(historico);
}

function exibirHistorico(historico = JSON.parse(localStorage.getItem(STORAGE_KEY)) || []) {
    if (historico.length === 0) {
        historicoDiv.innerHTML = '<p class="text-muted small">Nenhum resumo salvo ainda.</p>';
        return;
    }
    let html = '<h6>Histórico Recente:</h6><ul class="list-group list-group-flush">';
    historico.forEach((item, index) => {
        html += `<li class="list-group-item d-flex justify-content-between align-items-start">
            <div>
                <small class="text-muted">Original: ${item.original}</small><br>
                <small>${item.resumo.substring(0, 100)}...</small>
            </div>
            <button class="btn btn-sm btn-outline-primary" onclick="carregarResumo(${index})">Carregar</button>
        </li>`;
    });
    html += '</ul>';
    historicoDiv.innerHTML = html;
}

function carregarResumo(index) {
    const historico = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    if (historico[index]) {
        textoInput.value = historico[index].original.replace(/\.\.\.$/, '');
        atualizarContador();
        alert('Resumo carregado! Gere novamente para o texto completo.');
    }
}

limparHistorico.addEventListener('click', () => {
    localStorage.removeItem(STORAGE_KEY);
    historicoDiv.innerHTML = '<p class="text-muted small">Histórico limpo.</p>';
    carregarHistorico.disabled = true;
});

carregarHistorico.addEventListener('click', () => {
    const historico = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    if (historico[0]) {
        textoInput.value = historico[0].original.replace(/\.\.\.$/, '');
        atualizarContador();
    } else {
        alert('Nenhum histórico disponível.');
    }
});

// Função para gerar resumo com retry e fallback
async function gerarResumo(texto, tentativas = 0) {
    if (!texto.trim() || texto.length > 1000) {
        alert('Por favor, insira um texto válido (máx. 1.000 caracteres)!');
        return;
    }

    spinner.classList.remove('d-none');
    gerarBtn.disabled = true;
    gerarBtn.textContent = 'Gerando...';
    resultado.classList.remove('d-none');
    resumoTexto.innerHTML = '<p class="text-muted">Processando com IA... Aguarde!</p>';
    copiarBtn.classList.add('d-none');

    const maxLength = parseInt(maxLengthInput.value) || 100;
    const headers = {
        'Content-Type': 'application/json',
        ...(API_TOKEN && API_TOKEN.trim() !== '' && { 'Authorization': `Bearer ${API_TOKEN.trim()}` })
    };

    try {
        console.log(`Tentativa ${tentativas + 1}: Chamando ${API_URL} com token: ${API_TOKEN ? 'Sim' : 'Não'}`);
        console.log('Headers enviados:', headers);
        console.log('Body:', { inputs: texto, parameters: { max_length: maxLength, min_length: 30 } });

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({
                inputs: texto,
                parameters: { max_length: maxLength, min_length: 30 }
            })
        });

        console.log('Status da resposta:', response.status, response.statusText);
        console.log('Headers da resposta:', [...response.headers.entries()]);

        if (!response.ok) {
            if (response.status === 401) {
                console.error('401: Token inválido. Fallback para modelo inglês.');
                if (API_URL === API_URL_PT) {
                    API_URL = API_URL_EN; // Muda para EN
                    if (tentativas < 1) return gerarResumo(texto, tentativas + 1); // Retry com EN
                }
                throw new Error('Autenticação falhou (401). Verifique o token ou use o modelo inglês.');
            } else if (response.status === 503) {
                if (tentativas < 2) {
                    console.log('503: Modelo carregando. Retry em 5s...');
                    await new Promise(resolve => setTimeout(resolve, 5000));
                    return gerarResumo(texto, tentativas + 1);
                }
                throw new Error('Modelo não disponível (503). Tente mais tarde.');
            }
            throw new Error(`Erro na API: ${response.status} - ${response.statusText}`);
        }

        const data = await response.json();
        console.log('Dados recebidos:', data);

        if (data.error) {
            throw new Error(`Erro da API: ${data.error}`);
        }

        const resumo = data[0]?.summary_text || 'Resumo não gerado. Tente um texto diferente.';
        resumoTexto.innerHTML = `<p class="mb-0">${resumo}</p><small class="text-muted">Modelo usado: ${API_URL === API_URL_PT ? 'Português' : 'Inglês'}</small>`;
        copiarBtn.classList.remove('d-none');
        salvarResumo(texto, resumo);

    } catch (error) {
        console.error('Erro completo:', error);
        resumoTexto.innerHTML = `<p class="text-danger mb-0">Erro: ${error.message}<br><small>Console (F12) tem mais detalhes. Tente texto em inglês para teste.</small></p>`;
    } finally {
        spinner.classList.add('d-none');
        gerarBtn.disabled = false;
        gerarBtn.textContent = 'Gerar Resumo';
    }
}

// Event listeners
gerarBtn.addEventListener('click', () => gerarResumo(textoInput.value));
textoInput.addEventListener('input', atualizarContador);
textoInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
        e.preventDefault();
        gerarResumo(textoInput.value);
    }
});
copiarBtn.addEventListener('click', async () => {
    const textoResumo = resumoTexto.textContent;
    try {
        await navigator.clipboard.writeText(textoResumo);
        copiarBtn.innerHTML = '<i class="bi bi-check-lg"></i> Copiado!';
        setTimeout(() => copiarBtn.innerHTML = '<i class="bi bi-clipboard"></i> Copiar Resumo', 2000);
    } catch (err) {
        alert('Falha ao copiar.');
    }
});
window.carregarResumo = carregarResumo;
