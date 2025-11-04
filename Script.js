// Configurações da API - ATUALIZE COM SUA NOVA CHAVE!
const API_URL_PT = 'https://api-inference.huggingface.co/models/facebook/bart-large-cnn';
const API_URL_EN = 'https://api-inference.huggingface.co/models/facebook/bart-large-cnn'; // Inglês fallback
let API_URL = API_URL_PT;
const API_TOKEN = 'AIzaSyAXSagQtq69w7Xao64M9Vy6plGl5i3O4Z0'; // COLE A NOVA CHAVE AQUI (ex: 'hf_abc123...')

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

        let resumo = '';

        if (Array.isArray(data) && data.length > 0 && data[0].summary_text) {
            resumo = data[0].summary_text;
        }
        else if (data.error) {
            throw new Error(data.error);
        }
        else {
            resumo = 'Resumo não gerado. Tente novamente com outro texto.';
        }

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

// ===== NOVA FUNCIONALIDADE: Upload e Extração de Texto de Arquivos =====
// Este código adiciona funcionalidade de upload de arquivos sem alterar o código existente

// Elementos do DOM para upload de arquivos
const fileUpload = document.getElementById('file-upload');
const fileInfo = document.getElementById('file-info');
const fileName = document.getElementById('file-name');
const clearFileBtn = document.getElementById('clear-file');
const fileExtractionStatus = document.getElementById('file-extraction-status');
const textToSummarize = document.getElementById('text-to-summarize');
const charCount = document.getElementById('char-count');

// Variável para armazenar arquivo atual
let currentFile = null;

// Inicializar eventos de upload quando os elementos existirem
if (fileUpload && clearFileBtn) {
    fileUpload.addEventListener('change', handleFileUpload);
    clearFileBtn.addEventListener('click', clearFile);
}

// Funções para upload e extração de texto de arquivos
async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    currentFile = file;
    if (fileName) fileName.textContent = file.name;
    if (fileInfo) fileInfo.style.display = 'flex';

    // Extrair texto do arquivo
    try {
        showFileExtractionStatus('Extraindo texto do arquivo...', 'extracting');
        const text = await extractTextFromFile(file);
        
        if (text && text.trim()) {
            if (textToSummarize) {
                textToSummarize.value = text;
                // Atualizar contador se existir função updateCharCount
                if (typeof updateCharCount === 'function') {
                    updateCharCount();
                } else if (charCount) {
                    const count = text.length;
                    charCount.textContent = `Caracteres: ${count}/32000`;
                }
            }
            showFileExtractionStatus('✅ Texto extraído com sucesso!', 'success');
        } else {
            throw new Error('Nenhum texto encontrado no arquivo');
        }
    } catch (error) {
        console.error('Erro ao extrair texto:', error);
        showFileExtractionStatus(`❌ Erro ao extrair texto: ${error.message}`, 'error');
        clearFile();
    }
}

async function extractTextFromFile(file) {
    const fileExtension = file.name.split('.').pop().toLowerCase();
    
    switch (fileExtension) {
        case 'pdf':
            return await extractTextFromPDF(file);
        case 'docx':
        case 'doc':
            return await extractTextFromDOCX(file);
        case 'txt':
            return await extractTextFromTXT(file);
        default:
            throw new Error('Formato de arquivo não suportado. Use PDF, DOCX ou TXT.');
    }
}

async function extractTextFromPDF(file) {
    return new Promise((resolve, reject) => {
        const fileReader = new FileReader();
        
        fileReader.onload = async function(e) {
            try {
                // Configurar PDF.js worker
                if (typeof pdfjsLib !== 'undefined') {
                    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                    
                    const typedarray = new Uint8Array(e.target.result);
                    const pdf = await pdfjsLib.getDocument({ data: typedarray }).promise;
                    
                    let fullText = '';
                    const numPages = pdf.numPages;
                    
                    for (let i = 1; i <= numPages; i++) {
                        const page = await pdf.getPage(i);
                        const textContent = await page.getTextContent();
                        const pageText = textContent.items.map(item => item.str).join(' ');
                        fullText += pageText + '\n';
                    }
                    
                    resolve(fullText.trim());
                } else {
                    reject(new Error('Biblioteca PDF.js não carregada. Recarregue a página.'));
                }
            } catch (error) {
                reject(error);
            }
        };
        
        fileReader.onerror = reject;
        fileReader.readAsArrayBuffer(file);
    });
}

async function extractTextFromDOCX(file) {
    return new Promise((resolve, reject) => {
        const fileReader = new FileReader();
        
        fileReader.onload = async function(e) {
            try {
                if (typeof mammoth !== 'undefined') {
                    const arrayBuffer = e.target.result;
                    const result = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
                    resolve(result.value);
                } else {
                    reject(new Error('Biblioteca Mammoth.js não carregada. Recarregue a página.'));
                }
            } catch (error) {
                reject(error);
            }
        };
        
        fileReader.onerror = reject;
        fileReader.readAsArrayBuffer(file);
    });
}

async function extractTextFromTXT(file) {
    return new Promise((resolve, reject) => {
        const fileReader = new FileReader();
        
        fileReader.onload = function(e) {
            resolve(e.target.result);
        };
        
        fileReader.onerror = reject;
        fileReader.readAsText(file, 'UTF-8');
    });
}

function clearFile() {
    if (fileUpload) fileUpload.value = '';
    if (fileInfo) fileInfo.style.display = 'none';
    if (fileExtractionStatus) fileExtractionStatus.style.display = 'none';
    currentFile = null;
}

function showFileExtractionStatus(message, type) {
    if (!fileExtractionStatus) return;
    
    fileExtractionStatus.textContent = message;
    fileExtractionStatus.className = `file-extraction-status ${type}`;
    fileExtractionStatus.style.display = 'block';
    
    if (type === 'success') {
        setTimeout(() => {
            if (fileExtractionStatus) fileExtractionStatus.style.display = 'none';
        }, 3000);
    }
}
// ===== FIM DA NOVA FUNCIONALIDADE =====