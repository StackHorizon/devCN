// Elementi del DOM
const username = document.getElementById('username');
const password = document.getElementById('password');
const loginButton = document.getElementById('login-button');

// Controllo se l'utente è già loggato
document.addEventListener('DOMContentLoaded', function() {
    const token = sessionStorage.getItem('authToken');
    if (token) {
        try {
            const tokenData = JSON.parse(atob(token.split('.')[1]));
            const now = Math.floor(Date.now() / 1000);
            
            if (tokenData.exp && tokenData.exp > now) {
                // Token valido, reindirizza in base al tipo di utente
                if (tokenData.type === 'admin') {
                    window.location.href = 'studenti.html';
                } else if (tokenData.type === 'student') {
                    
                        window.location.href = 'dashboard.html';
                    
                }
                return;
            } else {
                // Token scaduto
                sessionStorage.removeItem('authToken');
            }
        } catch (error) {
            // Errore nella decodifica del token
            sessionStorage.removeItem('authToken');
        }
    }
});

// Gestione del login
loginButton.onclick = async () => {
    // Disabilita il pulsante durante il login
    loginButton.disabled = true;
    loginButton.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Accesso...';
    
    try {
        // Rimuovi eventuali classi di errore precedenti
        username.classList.remove('border-danger');
        password.classList.remove('border-danger');
        
        // Dati da inviare
        const loginData = {
            username: username.value.trim(),
            password: password.value.trim()
        };
        
        // Richiesta di login
        let response = await fetch('/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(loginData)
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.token) {
            // Salva token e username
            sessionStorage.setItem('authToken', result.token);
            sessionStorage.setItem('username', username.value.trim());
            
            // Reindirizza alla pagina appropriata dopo un breve delay
            setTimeout(() => {
                window.location.href = result.redirect;
            }, 100);
        } else {
            throw new Error('Token non ricevuto dal server');
        }
        
    } catch (error) {
        
        // Aggiungi classi di errore ai campi
        username.classList.add('border-danger');
        password.classList.add('border-danger');
        
        // Mostra messaggio di errore
        const errorElement = document.getElementById('loginError');
        if (errorElement) {
            errorElement.textContent = 'Credenziali non valide. Riprova.';
            errorElement.style.display = 'block';
        } else {
            alert('Credenziali non valide. Riprova.');
        }
    } finally {
        // Riabilita il pulsante
        loginButton.disabled = false;
        loginButton.innerHTML = '<i class="fas fa-sign-in-alt me-2"></i>Accedi';
    }
};
