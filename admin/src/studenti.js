const studentsTableBody = document.getElementById("studentsTableBody");
const submitBtn = document.getElementById("submitBtn");
const nomeAdd   = document.getElementById("nome");
const cognomeAdd = document.getElementById("cognome");
const emailAdd = document.getElementById("email");
const searchInput = document.getElementById("searchInput");
const passwordAD = document.getElementById("passwordAD");
const nomeAD = document.getElementById("nomeAD");

// Controllo autenticazione all'inizio
document.addEventListener('DOMContentLoaded', function() { 
    
    const token = sessionStorage.getItem('authToken');
    if (!token) {
        //console.log('❌ Nessun token trovato, redirect al login');
        window.location.href = '/';
        return;
    }
    
    // Decodifica il token per verificare che sia un admin
    try {
        const tokenData = JSON.parse(atob(token.split('.')[1]));
        //console.log('🔍 Token decodificato:', tokenData);
        
        if (tokenData.type !== 'admin') {
            window.location.href = '/';
            return;
        }
        
        // Controlla se il token è scaduto
        const now = Math.floor(Date.now() / 1000);
        if (tokenData.exp && tokenData.exp < now) {
            sessionStorage.removeItem('authToken');
            window.location.href = '/';
            return;
        }
        
        // Token valido, pagina pronta
        recuperaStudenti();
    } catch (error) {
        sessionStorage.removeItem('authToken');
        window.location.href = '/';
        return;
    }
});

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
        
        const response = await fetch('/admin/cambiaPassword', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${sessionStorage.getItem('authToken')}`
            },
            body: JSON.stringify({
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

// Gestione logout
document.getElementById('logoutBtn').addEventListener('click', () => {
    sessionStorage.removeItem('authToken');
    window.location.href = '/';
});

// Funzione per resettare il modal quando si apre
function resetModal() {
    document.getElementById('nome').value = '';
    document.getElementById('cognome').value = '';
    document.getElementById('email').value = '';
    document.getElementById('responseAdd').innerHTML = '';
    
    // Rimuovi classi di errore
    document.getElementById('nome').classList.remove('border-danger');
    document.getElementById('cognome').classList.remove('border-danger');
    document.getElementById('email').classList.remove('border-danger');
    
    // Ripristina il pulsante
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="fas fa-save me-2"></i>Salva Studente';
}

// Aggiungi event listener per quando si apre il modal
document.addEventListener('DOMContentLoaded', function() {
    const modal = document.getElementById('addStudentModal');
    if (modal) {
        modal.addEventListener('show.bs.modal', resetModal);
    }
});


const recuperaStudenti = async() => {
    try {
        let response = await fetch('/admin/getStudenti', {
            method: "GET",
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${sessionStorage.getItem('authToken')}`
            }
        });
        
        if (response.status === 401 || response.status === 403) {
            sessionStorage.removeItem('authToken');
            window.location.href = '/';
            return;
        }
        
        const students = await response.json();
        
        // Utilizza la funzione helper per visualizzare gli studenti
        displayStudents(students);
        
    } catch (error) {
        studentsTableBody.innerHTML = `
            <div class="student-row">
                <div class="col-12 text-center text-danger">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    Errore nel caricamento degli studenti
                </div>
            </div>
        `;
    }
}
submitBtn.onclick = async() => await aggiungiStudente();

const aggiungiStudente = async() => {
    // Rimuovi bordi rossi precedenti
    nomeAdd.classList.remove('border-danger');
    cognomeAdd.classList.remove('border-danger');
    emailAdd.classList.remove('border-danger');
    
    const responseDiv = document.getElementById('responseAdd');
    responseDiv.innerHTML = '';
    
    const n = nomeAdd.value.trim();
    const c = cognomeAdd.value.trim(); 
    const e = emailAdd.value.trim();

    if(n !== "" && c !== "" && e !== ""){
        try {
            // Mostra loading
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Salvando...';
            
            let response = await fetch('/admin/aggiungiStudente', {
                method: "POST",
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${sessionStorage.getItem('authToken')}`
                },
                body: JSON.stringify({
                    nome: n,
                    cognome: c,
                    email: e
                })   
            });
            
            const result = await response.json();
            
            if(response.ok){ 
                // Successo - mostra messaggio di successo
                responseDiv.innerHTML = `
                    <div class="alert alert-success alert-dismissible fade show" role="alert">
                        <i class="fas fa-check-circle me-2"></i>
                        ${result.message}
                        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
                    </div>
                `;
                
                // Pulisci i campi
                nomeAdd.value = '';
                cognomeAdd.value = '';
                emailAdd.value = '';
                
                // Ricarica la lista degli studenti senza chiudere il modal
                await recuperaStudenti();
                
                // Nasconde automaticamente il messaggio dopo 3 secondi
                setTimeout(() => {
                    responseDiv.innerHTML = '';
                }, 3000);
                
            } else {
                // Errore - mostra messaggio di errore
                responseDiv.innerHTML = `
                    <div class="alert alert-danger alert-dismissible fade show" role="alert">
                        <i class="fas fa-exclamation-triangle me-2"></i>
                        ${result.message || 'Errore durante l\'aggiunta dello studente'}
                        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
                    </div>
                `;
            }
        } catch (error) {
            //console.error('Errore:', error);
            responseDiv.innerHTML = `
                <div class="alert alert-danger alert-dismissible fade show" role="alert">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    Errore di connessione al server
                    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
                </div>
            `;
        } finally {
            // Ripristina il pulsante
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-save me-2"></i>Salva Studente';
        }
    } else {
        // Campi vuoti - evidenzia in rosso
        if(n === "") nomeAdd.classList.add('border-danger');
        if(c === "") cognomeAdd.classList.add('border-danger');  
        if(e === "") emailAdd.classList.add('border-danger');
        
        responseDiv.innerHTML = `
            <div class="alert alert-warning alert-dismissible fade show" role="alert">
                <i class="fas fa-exclamation-triangle me-2"></i>
                Tutti i campi sono obbligatori
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        `;
    }
}
// Funzioni per le azioni sui singoli studenti
function modificaStudente(email) {
    //console.log('Modifica studente:', email);
    // TODO: Implementare modifica studente
}

function inviaEmail(email) {
    // Implementa l'invio email tramite l'endpoint del server
    const sendEmail = async () => {
        try {
            const response = await fetch('/admin/reinviaEmail', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${sessionStorage.getItem('authToken')}`
                },
                body: JSON.stringify({ email })
            });
            
            const result = await response.json();
            
            if (response.ok) {
                showMessage( 'Email inviata!', 'success');
            } else {
                showMessage( result.message || 'Errore durante l\'invio dell\'email', 'error');
            }
        } catch (error) {
            //console.error('Errore:', error);
            showMessage('Errore di connessione al server', 'error');
        }
    };
    
    sendEmail();
}

const eliminaStudente = async(email) => {
    // Crea un modal di conferma dinamico
    const confirmModal = document.createElement('div');
    confirmModal.className = 'modal fade';
    confirmModal.id = 'confirmDeleteModal';
    confirmModal.innerHTML = `
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header bg-danger text-white">
                    <h5 class="modal-title">
                        <i class="fas fa-exclamation-triangle me-2"></i>Conferma Eliminazione
                    </h5>
                    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <p class="mb-3">Sei sicuro di voler eliminare lo studente:</p>
                    <div class="alert alert-warning">
                        <i class="fas fa-user me-2"></i>
                        <strong>${email}</strong>
                    </div>
                    <p class="text-muted mb-0">
                        <i class="fas fa-info-circle me-1"></i>
                        Questa azione non può essere annullata.
                    </p>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                        <i class="fas fa-times me-2"></i>Annulla
                    </button>
                    <button type="button" class="btn btn-danger" id="confirmDeleteBtn">
                        <i class="fas fa-trash-alt me-2"></i>Elimina Studente
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(confirmModal);
    const modal = new bootstrap.Modal(confirmModal);
    modal.show();
    
    // Gestione conferma eliminazione
    document.getElementById('confirmDeleteBtn').addEventListener('click', async () => {
        const deleteBtn = document.getElementById('confirmDeleteBtn');
        deleteBtn.disabled = true;
        deleteBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Eliminando...';
        
        try {
            let response = await fetch('/admin/eliminaStudente', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${sessionStorage.getItem('authToken')}`
                },
                body: JSON.stringify({ email })
            });
            
            const result = await response.json();
            
            modal.hide();
            
            if (response.ok) {
                // Mostra toast di successo
                showMessage( result.message, 'success');
                // Ricarica la lista degli studenti
                await recuperaStudenti();
            } else {
                // Mostra toast di errore
                showMessage(result.message || 'Errore durante l\'eliminazione', 'error');
            }
        } catch (error) { 
            modal.hide();
            showMessage('Errore di connessione al server', 'error');
        }
    });
    
    // Rimuovi il modal dal DOM quando viene chiuso
    confirmModal.addEventListener('hidden.bs.modal', () => {
        document.body.removeChild(confirmModal);
    });
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

searchInput.addEventListener('input', async (e) => {
    const searchTerm = e.target.value.toLowerCase().trim();
    
    try {
        // Recupera tutti gli studenti dal server
        let response = await fetch('/admin/getStudenti', {
            method: "GET",
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${sessionStorage.getItem('authToken')}`
            }
        });
        
        if (response.status === 401 || response.status === 403) {
            sessionStorage.removeItem('authToken');
            window.location.href = '/';
            return;
        }
        
        const allStudents = await response.json();
        
        // Filtra gli studenti in base al termine di ricerca
        const filteredStudents = allStudents.filter(student => {
            const nomeCompleto = `${student.nome} ${student.cognome}`.toLowerCase();
            const email = student.email.toLowerCase();
            
            return nomeCompleto.includes(searchTerm) || 
                   email.includes(searchTerm) ||
                   student.nome.toLowerCase().includes(searchTerm) ||
                   student.cognome.toLowerCase().includes(searchTerm);
        });
        
        // Aggiorna la visualizzazione
        displayStudents(filteredStudents);
        
    } catch (error) {
        //console.error('Errore durante la ricerca:', error);
        showMessage( 'Errore durante la ricerca degli studenti', 'error');
    }
});

// Funzione helper per visualizzare gli studenti
function displayStudents(students) {
    const noStudentsMessage = document.getElementById('noStudentsMessage');
    
    studentsTableBody.innerHTML = '';
    
    if (students.length === 0) {
        // Mostra messaggio personalizzato per ricerca vuota
        if (searchInput.value.trim() !== '') {
            studentsTableBody.innerHTML = `
                <div class="student-row">
                    <div class="col-12 text-center py-5">
                        <i class="fas fa-search text-muted" style="font-size: 3rem; margin-bottom: 1rem;"></i>
                        <h5 class="text-muted">Nessun risultato trovato</h5>
                        <p class="text-muted">Prova a modificare i termini di ricerca</p>
                    </div>
                </div>
            `;
        } else {
            noStudentsMessage.style.display = 'block';
        }
        return;
    }
    
    noStudentsMessage.style.display = 'none';
    
    students.forEach(student => {
        const iniziali = student.nome.charAt(0).toUpperCase() + student.cognome.charAt(0).toUpperCase();
        const dataIscrizione = new Date(student.dataIscrizione || Date.now()).toLocaleDateString('it-IT');
        
        const studentRow = document.createElement('div');
        studentRow.className = 'student-row';
        
        // Evidenzia i termini di ricerca se presenti
        const searchTerm = searchInput.value.toLowerCase().trim();
        let nomeCompleto = `${student.nome} ${student.cognome}`;
        let emailDisplay = student.email;
        
        if (searchTerm) {
            // Evidenzia il termine di ricerca nel nome
            const regex = new RegExp(`(${searchTerm})`, 'gi');
            nomeCompleto = nomeCompleto.replace(regex, '<mark class="bg-warning text-dark">$1</mark>');
            emailDisplay = emailDisplay.replace(regex, '<mark class="bg-warning text-dark">$1</mark>');
        }
        
        // Controlla se siamo su mobile
        const isMobile = window.innerWidth <= 768;
        
        if (isMobile) {
            // Layout mobile - card style migliorato
            studentRow.innerHTML = `
                <div class="mobile-student-card">
                    <div class="mobile-student-info">
                        <div class="student-avatar">
                            ${iniziali}
                        </div>
                        <div class="mobile-student-details">
                            <div class="mobile-student-name">
                                ${nomeCompleto}
                            </div>
                            <a href="mailto:${student.email}" class="mobile-student-email">
                                ${emailDisplay}
                            </a>
                        </div>
                    </div>
                    <div class="mobile-actions">
                        <button class="btn btn-warning" title="Invia Email" onclick="inviaEmail('${student.email}')">
                            <i class="fas fa-envelope"></i>
                            <span>Email</span>
                        </button>
                        <button class="btn btn-danger" title="Elimina" onclick="eliminaStudente('${student.email}')">
                            <i class="fas fa-trash-alt"></i>
                            <span>Elimina</span>
                        </button>
                    </div>
                </div>
            `;
        } else {
            // Layout desktop - table style
            studentRow.innerHTML = `
                <div class="row">
                    <div class="col-md-5">
                        <div class="d-flex align-items-center">
                            <div class="student-avatar me-3">
                                <span class="avatar-text">${iniziali}</span>
                            </div>
                            <div class="student-name">${nomeCompleto}</div>
                        </div>
                    </div>
                    <div class="col-md-5">
                        <a href="mailto:${student.email}" class="email-link">${emailDisplay}</a>
                    </div> 
                    <div class="col-md-auto">
                        <div class="btn-group action-buttons" role="group">
                            <button class="btn btn-sm btn-warning action-btn" title="Invia Email" onclick="inviaEmail('${student.email}')">
                                <i class="fas fa-envelope"></i>
                            </button>
                            <button class="btn btn-sm btn-danger action-btn" title="Elimina" onclick="eliminaStudente('${student.email}')">
                                <i class="fas fa-trash-alt"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }
        studentsTableBody.appendChild(studentRow);
    });
}

// === GESTIONE CARICAMENTO CSV ===

// Gestione selezione file CSV
document.getElementById('csvFile').addEventListener('change', function(e) {
    const file = e.target.files[0];
    const uploadBtn = document.getElementById('uploadCsvBtn');
    const preview = document.getElementById('csvPreview');
    const results = document.getElementById('csvResults');
    
    // Reset
    preview.style.display = 'none';
    results.style.display = 'none';
    uploadBtn.disabled = true;
    
    if (!file) return;
    
    // Validazione file
    if (!file.name.toLowerCase().endsWith('.csv')) {
        showAlert('Errore: Solo file CSV sono accettati.', 'danger');
        return;
    }
    
    if (file.size > 5 * 1024 * 1024) { // 5MB
        showAlert('Errore: Il file non può superare i 5MB.', 'danger');
        return;
    }
    
    // Leggi e mostra anteprima
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const csvContent = e.target.result;
            const lines = csvContent.split('\n').filter(line => line.trim() !== '');
            
            if (lines.length === 0) {
                showAlert('Errore: File CSV vuoto.', 'danger');
                return;
            }
            
            // Parse headers
            const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
            const requiredHeaders = ['nome', 'cognome', 'email'];
            const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
            
            if (missingHeaders.length > 0) {
                showAlert(`Errore: Colonne mancanti nel CSV: ${missingHeaders.join(', ')}`, 'danger');
                return;
            }
            
            // Mostra anteprima (prime 5 righe)
            const headersRow = document.getElementById('csvHeaders');
            const dataBody = document.getElementById('csvData');
            
            headersRow.innerHTML = '';
            dataBody.innerHTML = '';
            
            // Headers
            headers.forEach(header => {
                const th = document.createElement('th');
                th.textContent = header.toUpperCase();
                headersRow.appendChild(th);
            });
            
            // Data (prime 5 righe)
            const previewLines = lines.slice(1, 6);
            previewLines.forEach(line => {
                const values = line.split(',').map(v => v.trim());
                if (values.length === headers.length) {
                    const tr = document.createElement('tr');
                    values.forEach(value => {
                        const td = document.createElement('td');
                        td.textContent = value;
                        tr.appendChild(td);
                    });
                    dataBody.appendChild(tr);
                }
            });
            
            // Mostra info
            const totalStudenti = lines.length - 1;
            const infoDiv = document.createElement('div');
            infoDiv.className = 'mt-2 text-muted';
            infoDiv.innerHTML = `<small><i class="fas fa-info-circle me-1"></i>Trovati ${totalStudenti} studenti nel file${previewLines.length < totalStudenti ? ' (mostrando i primi 5)' : ''}</small>`;
            
            preview.appendChild(infoDiv);
            preview.style.display = 'block';
            uploadBtn.disabled = false;
            
        } catch (error) {
            showAlert('Errore durante la lettura del file CSV.', 'danger');
            console.error('Errore CSV:', error);
        }
    };
    
    reader.readAsText(file);
});

// Gestione caricamento CSV
document.getElementById('uploadCsvBtn').addEventListener('click', function() {
    const fileInput = document.getElementById('csvFile');
    const file = fileInput.files[0];
    
    if (!file) {
        showAlert('Seleziona un file CSV prima di procedere.', 'warning');
        return;
    }
    
    const formData = new FormData();
    formData.append('csvFile', file);
    
    const uploadBtn = this;
    const originalText = uploadBtn.innerHTML;
    
    // Mostra loading
    uploadBtn.disabled = true;
    uploadBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Caricamento...';
    
    // Effettua upload
    const token = sessionStorage.getItem('authToken');
    fetch('/admin/caricaStudentiCSV', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`
        },
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        const resultsDiv = document.getElementById('csvResults');
        const resultsContent = document.getElementById('csvResultsContent');
        
        if (data.success) {
            const risultato = data.risultato;
            resultsContent.className = 'alert alert-success';
            resultsContent.innerHTML = `
                <h6><i class="fas fa-check-circle me-2"></i>Caricamento completato!</h6>
                <ul class="mb-0">
                    <li><strong>${risultato.aggiunti}</strong> studenti aggiunti con successo</li>
                    <li><strong>${risultato.duplicati}</strong> studenti duplicati (ignorati)</li>
                    <li><strong>${risultato.totale}</strong> studenti totali nel database</li>
                </ul>
            `;
            
            if (risultato.duplicati > 0 && risultato.dettagliDuplicati.length > 0) {
                const duplicatiList = risultato.dettagliDuplicati.map(d => d.email).join(', ');
                resultsContent.innerHTML += `
                    <hr>
                    <small><strong>Email duplicate ignoraate:</strong> ${duplicatiList}</small>
                `;
            }
            
            // Ricarica la lista studenti
            setTimeout(() => {
                recuperaStudenti();
                // Chiudi modal dopo 3 secondi
                setTimeout(() => {
                    bootstrap.Modal.getInstance(document.getElementById('csvUploadModal')).hide();
                }, 3000);
            }, 1000);
            
        } else {
            resultsContent.className = 'alert alert-danger';
            resultsContent.innerHTML = `
                <h6><i class="fas fa-exclamation-triangle me-2"></i>Errore durante il caricamento</h6>
                <p class="mb-0">${data.message}</p>
            `;
        }
        
        resultsDiv.style.display = 'block';
        
    })
    .catch(error => {
        console.error('Errore upload CSV:', error);
        const resultsDiv = document.getElementById('csvResults');
        const resultsContent = document.getElementById('csvResultsContent');
        
        resultsContent.className = 'alert alert-danger';
        resultsContent.innerHTML = `
            <h6><i class="fas fa-exclamation-triangle me-2"></i>Errore di connessione</h6>
            <p class="mb-0">Impossibile caricare il file. Riprova più tardi.</p>
        `;
        resultsDiv.style.display = 'block';
    })
    .finally(() => {
        // Ripristina bottone
        uploadBtn.disabled = false;
        uploadBtn.innerHTML = originalText;
    });
});

// Reset modal quando viene chiuso
document.getElementById('csvUploadModal').addEventListener('hidden.bs.modal', function() {
    document.getElementById('csvUploadForm').reset();
    document.getElementById('csvPreview').style.display = 'none';
    document.getElementById('csvResults').style.display = 'none';
    document.getElementById('uploadCsvBtn').disabled = true;
});

// Funzione helper per mostrare alert
function showAlert(message, type = 'info') {
    // Crea un alert temporaneo
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
    alertDiv.style.top = '20px';
    alertDiv.style.right = '20px';
    alertDiv.style.zIndex = '9999';
    alertDiv.style.minWidth = '300px';
    
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    document.body.appendChild(alertDiv);
    
    // Rimuovi automaticamente dopo 5 secondi
    setTimeout(() => {
        if (alertDiv.parentNode) {
            alertDiv.remove();
        }
    }, 5000);
}

// Funzione per gestire il resize della finestra
function handleResize() {
    // Re-render della lista quando cambia la dimensione della finestra
    const filteredStudents = searchInput.value 
        ? students.filter(student => 
            student.nome.toLowerCase().includes(searchInput.value.toLowerCase()) ||
            student.cognome.toLowerCase().includes(searchInput.value.toLowerCase()) ||
            student.email.toLowerCase().includes(searchInput.value.toLowerCase())
        )
        : students;
    
    displayStudents(filteredStudents);
}

// Aggiungi listener per il resize
window.addEventListener('resize', handleResize);

// Reset modal quando viene chiuso
document.getElementById('csvUploadModal').addEventListener('hidden.bs.modal', function() {
    document.getElementById('csvUploadForm').reset();
    document.getElementById('csvPreview').style.display = 'none';
    document.getElementById('csvResults').style.display = 'none';
    document.getElementById('uploadCsvBtn').disabled = true;
});

// Funzione helper per mostrare alert
function showAlert(message, type = 'info') {
    // Crea un alert temporaneo
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
    alertDiv.style.top = '20px';
    alertDiv.style.right = '20px';
    alertDiv.style.zIndex = '9999';
    alertDiv.style.minWidth = '300px';
    
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    document.body.appendChild(alertDiv);
    
    // Rimuovi automaticamente dopo 5 secondi
    setTimeout(() => {
        if (alertDiv.parentNode) {
            alertDiv.remove();
        }
    }, 5000);
}