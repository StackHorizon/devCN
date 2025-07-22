const newEnvironmentBtn = document.getElementById('newEnvironmentBtn');
const createEnvironmentBtn = document.getElementById('createEnvironmentBtn');
const environmentName = document.getElementById("environmentName");
const environmentType = document.getElementById("environmentType");
const modal = new bootstrap.Modal(document.getElementById('newEnvironmentModal'));
const logoutBtn = document.getElementById('logoutBtn');
const searchInput = document.getElementById('searchInput');
const environmentsTableBody = document.getElementById('environmentsTableBody');

// Elementi per loading
const loadingOverlay = document.getElementById('loadingOverlay');
const loadingText = document.getElementById('loadingText');
const loadingSubtext = document.getElementById('loadingSubtext');

// Variabile globale per memorizzare tutti gli ambienti
let allEnvironments = [];

// === FUNZIONI DI LOADING ===

const showLoading = (text = 'Caricamento...', subtext = 'Operazione in corso') =>{
    loadingText.textContent = text;
    loadingSubtext.textContent = subtext;
    loadingOverlay.classList.add('show');
    document.body.style.overflow = 'hidden';
}

const hideLoading = () => {
    loadingOverlay.classList.remove('show');
    document.body.style.overflow = '';
}

const showTableLoading = () => {
    environmentsTableBody.innerHTML = `
        <tr>
            <td colspan="2" class="table-loading">
                <div class="spinner-border" role="status">
                    <span class="visually-hidden">Caricamento...</span>
                </div>
                <div class="mt-3">
                    <h6 class="text-muted">Caricamento ambienti...</h6>
                    <small class="text-muted">Recupero dei tuoi ambienti Docker in corso</small>
                </div>
            </td>
        </tr>
    `;
}

const setButtonLoading = (button, isLoading, originalText) => {
    if (isLoading) {
        button.disabled = true;
        button.classList.add('btn-loading');
        button.setAttribute('data-original-text', originalText);
        button.innerHTML = `<span class="btn-text">${originalText}</span>`;
    } else {
        button.disabled = false;
        button.classList.remove('btn-loading');
        button.innerHTML = originalText;
    }
}

const templateAmbiente = `
                                        <tr class="environment-row">
                                            <td>
                                                <div class="d-flex align-items-center">
                                                    <div class="environment-icon me-3">
                                                        %TIPO_ICON%
                                                    </div>
                                                    <div class="environment-details">
                                                        <div class="environment-name">%NAME%</div>
                                                        <small class="text-muted">%TIPO_NOME% • Creato: %DATA%</small>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                <div class="d-flex action-buttons">
                                                    <button class="btn btn-outline-primary btn-sm action-btn me-2" title="Accedi" onclick="window.open('%URL%', '_blank')">
                                                        <i class="fas fa-terminal"></i>
                                                    </button>
                                                    <button class="btn btn-outline-danger btn-sm action-btn delete-btn" title="Elimina" onclick="eliminaAmbiente('%CONTAINER_ID%', '%NAME%')" data-container-id="%CONTAINER_ID%" data-name="%NAME%">
                                                        <i class="fas fa-trash"></i>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
`;

// Controllo autenticazione all'inizio
document.addEventListener('DOMContentLoaded', async function() {    
    const token = sessionStorage.getItem('authToken');
    if (!token) { 
        window.location.href = 'index.html';
        return;
    }
    
    // Decodifica il token per verificare che sia uno studente
    try {
        showLoading('Accesso in corso...', 'Verifica delle credenziali');
        
        const tokenParts = token.split('.');
        const tokenData = JSON.parse(atob(tokenParts[1]));
        
        if (tokenData.type !== 'student') {
            window.location.href = 'studenti.html';
            return;
        }
        
        const now = Math.floor(Date.now() / 1000);
        if (tokenData.exp && tokenData.exp < now) {
            sessionStorage.removeItem('authToken');
            window.location.href = 'index.html';
            return;
        }
         
        loadUserData(tokenData);
        
        // Mostra loading per la tabella
        showTableLoading();
        hideLoading();
        
        // Carica gli ambienti
        environmentsTableBody.innerHTML = await recuperaAmbienti(); 
        
        // Gestione ricerca (ora implementata)
        if (searchInput) {
            searchInput.addEventListener('input', filterEnvironments);
        }
        
    } catch (error) { 
        hideLoading();
        sessionStorage.removeItem('authToken');
        window.location.href = 'index.html';
        return;
    }
});

// Funzione per caricare i dati dell'utente
function loadUserData(userData) { 
    // Aggiorna l'interfaccia con i dati dell'utente
    const userNameElement = document.querySelector('[data-user-name]');
    if (userNameElement) {
        userNameElement.textContent = userData.username;
    }
    
} 

// Funzione per mostrare messaggi
function showMessage(message, type = 'info') {
    // Rimuovi messaggi esistenti
    const existingToasts = document.querySelectorAll('.toast');
    existingToasts.forEach(toast => toast.remove());
    
    const toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container position-fixed top-0 end-0 p-3';
    toastContainer.style.zIndex = '9999';
    
    const iconMap = {
        success: 'fas fa-check-circle text-success',
        error: 'fas fa-exclamation-triangle text-danger',
        warning: 'fas fa-exclamation-circle text-warning',
        info: 'fas fa-info-circle text-info'
    };
    
    const bgMap = {
        success: 'bg-success',
        error: 'bg-danger',
        warning: 'bg-warning',
        info: 'bg-info'
    };
    
    toastContainer.innerHTML = `
        <div class="toast show" role="alert">
            <div class="toast-header ${bgMap[type]} text-white">
                <i class="${iconMap[type]} me-2"></i>
                <strong class="me-auto">Notifica</strong>
                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast"></button>
            </div>
            <div class="toast-body">
                ${message}
            </div>
        </div>
    `;
    
    document.body.appendChild(toastContainer);
    
    // Auto remove dopo 5 secondi
    setTimeout(() => {
        toastContainer.remove();
    }, 5000);
}

// Funzione per il logout
const logout = () => { 
    sessionStorage.removeItem('authToken');
    window.location.href = 'index.html';
}
newEnvironmentBtn.onclick = () =>{
    modal.show(); 
}
const creaAmbiente = async(nomeAmbiente, tipoAmbiente) =>{
    try {
        showLoading('Creazione ambiente...', `Configurazione dell'ambiente ${nomeAmbiente}`);
        
        console.log('🚀 Creando ambiente:', nomeAmbiente, 'Tipo:', tipoAmbiente);
        console.log('📧 Email utente:', sessionStorage.getItem('username'));
        
        let response = await fetch("/studenti/creaAmbiente", {
            method: "POST",
            headers: {
                "content-type": "application/json",
                "Authorization": `Bearer ${sessionStorage.getItem('authToken')}`
            },
            body: JSON.stringify({ 
                email: sessionStorage.getItem('username'),
                nomeAmbiente: nomeAmbiente,
                tipoAmbiente: tipoAmbiente
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        console.log('✅ Ambiente creato:', result);
        
        // Aggiorna loading per il refresh degli ambienti
        loadingText.textContent = 'Aggiornamento lista...';
        loadingSubtext.textContent = 'Caricamento dei tuoi ambienti';
        
        environmentsTableBody.innerHTML = await recuperaAmbienti();
        
        hideLoading();
        
        // Mostra messaggio di successo
        showMessage(result.message || 'Ambiente creato con successo!', 'success');
        modal.hide();
        
        return result;
        
    } catch (error) {
        hideLoading();
        console.error('❌ Errore creazione ambiente:', error);
        showMessage('Errore durante la creazione dell\'ambiente', 'error');
        throw error;
    }
}

createEnvironmentBtn.onclick = async()=>{
    // Validazione dei campi
    if (!environmentName.value || !environmentType.value) {
        showMessage('Per favore compila tutti i campi richiesti', 'warning');
        return;
    }
    
    const originalBtnText = createEnvironmentBtn.innerHTML;
    setButtonLoading(createEnvironmentBtn, true, originalBtnText);
    
    try {
        await creaAmbiente(environmentName.value, environmentType.value);
        environmentName.value = "";
        environmentType.value = "";
    } finally {
        setButtonLoading(createEnvironmentBtn, false, originalBtnText);
    }
}

const recuperaAmbienti = async() =>{
    try {
        console.log('📂 Recuperando ambienti...');
        console.log('📧 Email utente:', sessionStorage.getItem('username'));
        
        let response = await fetch("/studenti/recuperaAmbienti", {
            method: "POST",
            headers: {
                "content-type": "application/json",
                "Authorization": `Bearer ${sessionStorage.getItem('authToken')}`
            },
            body: JSON.stringify({
                email: sessionStorage.getItem('username')
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        
        // Salva tutti gli ambienti nella variabile globale
        allEnvironments = result.ambienti || [];
        
        return displayEnvironments(allEnvironments);
         
    } catch (error) { 
        console.error('❌ Errore recupero ambienti:', error);
        return displayNoEnvironments();
    }
}

// Funzione per visualizzare gli ambienti
const displayEnvironments = (environments) => {
    if (!environments || environments.length === 0) {
        return displayNoEnvironments();
    }
    
    // Mapping tipi ambiente a icone e nomi
    const tipoAmbienteMapping = {
        'nodejs': { icon: '<i class="fab fa-node-js fa-lg text-success"></i>', nome: 'Node.js' },
        'python': { icon: '<i class="fab fa-python fa-lg text-primary"></i>', nome: 'Python' },
        'cpp': { icon: '<i class="fas fa-code fa-lg text-info"></i>', nome: 'C/C++' },
        'java': { icon: '<i class="fab fa-java fa-lg text-warning"></i>', nome: 'Java' },
        'vuoto': { icon: '<i class="fas fa-cube fa-lg text-secondary"></i>', nome: 'Vuoto' }
    };
    
    let html = "";
    environments.forEach(ambiente => {
        console.log(ambiente);
        const tipoInfo = tipoAmbienteMapping[ambiente.tipoAmbiente] || 
                        { icon: '<i class="fa fa-server fa-lg"></i>', nome: 'Sconosciuto' };
        
        html += templateAmbiente
            .replaceAll('%NAME%', ambiente.nomeAmbiente)
            .replaceAll('%URL%', ambiente.url)
            .replaceAll('%CONTAINER_ID%', ambiente.containerId)
            .replaceAll('%TIPO_ICON%', tipoInfo.icon)
            .replaceAll('%TIPO_NOME%', tipoInfo.nome)
            .replaceAll('%DATA%', new Date(ambiente.dataCreazione).toLocaleDateString('it-IT', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            }));
    });
    return html;
}

// Funzione per visualizzare messaggio quando non ci sono ambienti
const displayNoEnvironments = () => {
    const searchTerm = searchInput ? searchInput.value.trim() : '';
    
    if (searchTerm !== '') {
        return `
            <tr>
                <td colspan="2" class="text-center py-5">
                    <div class="text-muted">
                        <i class="fas fa-search text-muted" style="font-size: 3rem; margin-bottom: 1rem;"></i>
                        <h5>Nessun ambiente trovato</h5>
                        <p>Nessun ambiente corrisponde alla ricerca "<strong>${searchTerm}</strong>"</p>
                        <button class="btn btn-outline-secondary btn-sm" onclick="document.getElementById('searchInput').value=''; filterEnvironments();">
                            <i class="fas fa-times me-1"></i>Cancella ricerca
                        </button>
                    </div>
                </td>
            </tr>
        `;
    } else {
        return `
            <tr>
                <td colspan="2" class="text-center py-5">
                    <div class="text-muted">
                        <i class="fas fa-server text-muted" style="font-size: 3rem; margin-bottom: 1rem;"></i>
                        <h5>Nessun ambiente disponibile</h5>
                        <p>Non hai ancora creato nessun ambiente di sviluppo.</p>
                        <button class="btn btn-primary" onclick="document.getElementById('newEnvironmentBtn').click();">
                            <i class="fas fa-plus me-1"></i>Crea il tuo primo ambiente
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }
}

// Funzione per eliminare un ambiente
const eliminaAmbiente = async (containerId, nomeAmbiente) => {
    // Mostra conferma prima di eliminare
    if (!confirm(`Sei sicuro di voler eliminare l'ambiente "${nomeAmbiente}"?\n\nQuesta azione non può essere annullata e tutti i dati nell'ambiente verranno persi.`)) {
        return;
    }
    
    try {
        showLoading('Eliminazione ambiente...', `Rimozione dell'ambiente ${nomeAmbiente}`);
        
        console.log('🗑️ Eliminando ambiente:', nomeAmbiente, 'Container ID:', containerId);
        
        const response = await fetch("/studenti/eliminaAmbiente", {
            method: "POST",
            headers: {
                "content-type": "application/json",
                "Authorization": `Bearer ${sessionStorage.getItem('authToken')}`
            },
            body: JSON.stringify({
                email: sessionStorage.getItem('username'),
                containerId: containerId
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        
        if (result.success) {
            console.log('✅ Ambiente eliminato con successo');
            
            // Aggiorna loading per il refresh degli ambienti
            loadingText.textContent = 'Aggiornamento lista...';
            loadingSubtext.textContent = 'Caricamento degli ambienti aggiornati';
            
            // Ricarica la lista degli ambienti
            environmentsTableBody.innerHTML = await recuperaAmbienti();
            
            hideLoading();
            showMessage(result.message || 'Ambiente eliminato con successo', 'success');
        } else {
            throw new Error(result.message || 'Errore durante l\'eliminazione');
        }
        
    } catch (error) {
        hideLoading();
        console.error('❌ Errore eliminazione ambiente:', error);
        showMessage('Errore durante l\'eliminazione dell\'ambiente: ' + error.message, 'error');
    }
}

// Funzione per filtrare gli ambienti in base al termine di ricerca
const filterEnvironments = () => {
    const searchTerm = searchInput.value.toLowerCase().trim();
    
    if (searchTerm === '') {
        // Se la ricerca è vuota, mostra tutti gli ambienti
        environmentsTableBody.innerHTML = displayEnvironments(allEnvironments);
    } else {
        // Filtra gli ambienti in base al termine di ricerca
        const filteredEnvironments = allEnvironments.filter(ambiente => {
            const nomeAmbiente = ambiente.nomeAmbiente?.toLowerCase() || '';
            const containerName = ambiente.containerName?.toLowerCase() || '';
            const status = ambiente.status?.toLowerCase() || '';
            
            return nomeAmbiente.includes(searchTerm) || 
                   containerName.includes(searchTerm) ||
                   status.includes(searchTerm);
        });
        
        environmentsTableBody.innerHTML = displayEnvironments(filteredEnvironments);
    }
}

if (logoutBtn) {
    logoutBtn.addEventListener('click', logout);
}

// Aggiungi event listener per la ricerca
if (searchInput) {
    searchInput.addEventListener('input', filterEnvironments);
}

// Gestione modal profilo - popola username quando si apre
document.getElementById('profilo').addEventListener('show.bs.modal', () => {
    const nomeAD = document.getElementById('nomeAD');
    const passwordAD = document.getElementById('passwordAD');
    const responseDiv = document.getElementById('responseProfilo');
    
    // Popola il nome admin
    nomeAD.value = sessionStorage.getItem("username");
    
    // Reset campo password e messaggi
    passwordAD.value = '';
    passwordAD.classList.remove('border-danger');
    responseDiv.innerHTML = '';
});


// Gestione cambio password admin
document.getElementById('inviaModificaPassword').addEventListener('click', async () => {
    const passwordAD = document.getElementById('passwordAD');
    const nuovaPassword = passwordAD.value.trim();
    const responseDiv = document.getElementById('responseProfilo');
    const cambiaPasswordBtn = document.getElementById('inviaModificaPassword');
    
    // Reset messaggi precedenti
    responseDiv.innerHTML = '';
    passwordAD.classList.remove('border-danger');
    
    if (!nuovaPassword) {
        passwordAD.classList.add('border-danger');
        responseDiv.innerHTML = `
            <div class="alert alert-warning alert-dismissible fade show" role="alert">
                <i class="fas fa-exclamation-triangle me-2"></i>
                La password è obbligatoria
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        `;
        return;
    }
    
    if (nuovaPassword.length < 6) {
        passwordAD.classList.add('border-danger');
        responseDiv.innerHTML = `
            <div class="alert alert-warning alert-dismissible fade show" role="alert">
                <i class="fas fa-exclamation-triangle me-2"></i>
                La password deve essere di almeno 6 caratteri
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        `;
        return;
    }
    
    try {
        // Mostra loading
        cambiaPasswordBtn.disabled = true;
        cambiaPasswordBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Salvando...';
        
        const response = await fetch('/studente/cambiaPassword', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${sessionStorage.getItem('authToken')}`
            },
            body: JSON.stringify({
                email: sessionStorage.getItem('username'),
                nuovaPassword: nuovaPassword
            })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            responseDiv.innerHTML = `
                <div class="alert alert-success alert-dismissible fade show" role="alert">
                    <i class="fas fa-check-circle me-2"></i>
                    Password cambiata con successo!
                    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
                </div>
            `;
            
            // Reset campo password
            passwordAD.value = '';
            
            // Chiudi modal dopo 2 secondi
            setTimeout(() => {
                bootstrap.Modal.getInstance(document.getElementById('profilo')).hide();
            }, 2000);
            
        } else {
            responseDiv.innerHTML = `
                <div class="alert alert-danger alert-dismissible fade show" role="alert">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    ${result.message || 'Errore durante il cambio password'}
                    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
                </div>
            `;
        }
        
    } catch (error) {
        console.error('Errore cambio password:', error);
        responseDiv.innerHTML = `
            <div class="alert alert-danger alert-dismissible fade show" role="alert">
                <i class="fas fa-exclamation-triangle me-2"></i>
                Errore di connessione al server
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        `;
    } finally {
        // Ripristina bottone
        cambiaPasswordBtn.disabled = false;
        cambiaPasswordBtn.innerHTML = '<i class="fas fa-save me-2"></i>Cambia Password';
    }
});
