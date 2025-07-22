const path = require('path');
const fs = require('fs');
const multer = require('multer');

// Funzione per generare password casuali
const generaPassword = (lunghezza = 12) => {
    const caratteri = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let password = '';
    for (let i = 0; i < lunghezza; i++) {
        password += caratteri.charAt(Math.floor(Math.random() * caratteri.length));
    }
    return password;
};

// Configurazione multer per l'upload dei file
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // Nome file con timestamp per evitare conflitti
        const timestamp = Date.now();
        cb(null, `studenti-${timestamp}.csv`);
    }
});

const fileFilter = (req, file, cb) => {
    // Accetta solo file CSV
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
        cb(null, true);
    } else {
        cb(new Error('Solo file CSV sono accettati'), false);
    }
};

const upload = multer({ 
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 // Limite 5MB
    }
});

// Funzione per parsare il CSV
const parseCSV = (csvContent) => {
    const lines = csvContent.split('\n').filter(line => line.trim() !== '');
    
    if (lines.length === 0) {
        throw new Error('File CSV vuoto');
    }
    
    // Prima riga dovrebbe contenere le intestazioni
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    
    // Verifica che le colonne richieste siano presenti
    const requiredColumns = ['nome', 'cognome', 'email'];
    const missingColumns = requiredColumns.filter(col => !headers.includes(col));
    
    if (missingColumns.length > 0) {
        throw new Error(`Colonne mancanti nel CSV: ${missingColumns.join(', ')}`);
    }
    
    const studenti = [];
    
    // Processa ogni riga di dati
    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        
        if (values.length !== headers.length) {
            console.warn(`Riga ${i + 1} ignorata: numero di colonne non corrispondente`);
            continue;
        }
        
        const studente = {};
        headers.forEach((header, index) => {
            studente[header] = values[index];
        });
        
        // Validazione dati studente
        if (!studente.nome || !studente.cognome || !studente.email) {
            console.warn(`Riga ${i + 1} ignorata: dati mancanti`);
            continue;
        }
        
        // Validazione formato email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(studente.email)) {
            console.warn(`Riga ${i + 1} ignorata: email non valida (${studente.email})`);
            continue;
        }
        
        studenti.push({
            nome: studente.nome,
            cognome: studente.cognome,
            email: studente.email.toLowerCase(),
            password: generaPassword(),
            dataIscrizione: new Date().toISOString(),
            stato: 'attivo',
            passwordCambiata: false, // Primo accesso
            primoLogin: true
        });
    }
    
    return studenti;
};

// Funzione per salvare gli studenti
const salvaStudenti = (nuoviStudenti) => {
    const studentiFilePath = path.join(__dirname, 'dati', 'studenti.json');
    const datiDir = path.join(__dirname, 'dati');
    
    // Crea la directory se non esiste
    if (!fs.existsSync(datiDir)) {
        fs.mkdirSync(datiDir, { recursive: true });
    }
    
    let studentiEsistenti = [];
    
    // Carica studenti esistenti se il file esiste
    if (fs.existsSync(studentiFilePath)) {
        try {
            const content = fs.readFileSync(studentiFilePath, 'utf-8');
            studentiEsistenti = JSON.parse(content);
            if (!Array.isArray(studentiEsistenti)) {
                studentiEsistenti = [];
            }
        } catch (error) {
            console.warn('Errore lettura file studenti esistente, creando nuovo file');
            studentiEsistenti = [];
        }
    }
    
    // Controlla duplicati basandosi sull'email
    const emailEsistenti = new Set(studentiEsistenti.map(s => s.email));
    const studentiDaAggiungere = [];
    const duplicati = [];
    
    nuoviStudenti.forEach(studente => {
        if (emailEsistenti.has(studente.email)) {
            duplicati.push(studente);
        } else {
            studentiDaAggiungere.push(studente);
            emailEsistenti.add(studente.email);
        }
    });
    
    // Aggiungi i nuovi studenti
    const tuttiStudenti = [...studentiEsistenti, ...studentiDaAggiungere];
    
    // Salva il file aggiornato
    fs.writeFileSync(studentiFilePath, JSON.stringify(tuttiStudenti, null, 2));
    
    return {
        aggiunti: studentiDaAggiungere.length,
        duplicati: duplicati.length,
        dettagliDuplicati: duplicati,
        totale: tuttiStudenti.length
    };
};

// Endpoint per il caricamento CSV
const caricaStudentiCSV = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'Nessun file caricato'
            });
        }
        
        // Leggi il contenuto del file
        const csvContent = fs.readFileSync(req.file.path, 'utf-8');
        
        // Parsa il CSV
        const studenti = parseCSV(csvContent);
        
        if (studenti.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Nessuno studente valido trovato nel file CSV'
            });
        }
        
        // Salva gli studenti
        const risultato = salvaStudenti(studenti);
        
        // Aggiungi studenti all'array locale del main.js
        if (risultato.aggiunti > 0) {
            try {
                const mainModule = require('./main.js');
                if (mainModule.aggiungiStudentiDaCSV) {
                    mainModule.aggiungiStudentiDaCSV(studenti.filter(s => 
                        !risultato.dettagliDuplicati.some(d => d.email === s.email)
                    ));
                    console.log(`✅ Sincronizzati ${risultato.aggiunti} studenti con array locale`);
                }
            } catch (error) {
                console.warn('⚠️ Avviso: impossibile sincronizzare con array locale:', error.message);
            }
        }
        
        // Rimuovi il file temporaneo
        fs.unlinkSync(req.file.path);
        
        res.json({
            success: true,
            message: 'Studenti caricati con successo',
            risultato: risultato
        });
        
    } catch (error) {
        console.error('Errore caricamento CSV:', error);
        
        // Rimuovi il file temporaneo in caso di errore
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        
        res.status(500).json({
            success: false,
            message: 'Errore durante il caricamento del CSV',
            error: error.message
        });
    }
};

// Funzione per ottenere template CSV
const getTemplateCSV = (req, res) => {
    const templateCSV = `nome,cognome,email
Mario,Rossi,mario.rossi@scuola.edu
Lucia,Bianchi,lucia.bianchi@scuola.edu
Francesco,Verdi,francesco.verdi@scuola.edu
Giulia,Neri,giulia.neri@scuola.edu`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="template-studenti.csv"');
    res.send(templateCSV);
};

// Funzione per ottenere lista studenti
const getStudenti = (req, res) => {
    try {
        const studentiFilePath = path.join(__dirname, 'dati', 'studenti.json');
        
        if (!fs.existsSync(studentiFilePath)) {
            return res.json({
                success: true,
                studenti: []
            });
        }
        
        const content = fs.readFileSync(studentiFilePath, 'utf-8');
        const studenti = JSON.parse(content);
        
        res.json({
            success: true,
            studenti: Array.isArray(studenti) ? studenti : []
        });
        
    } catch (error) {
        console.error('Errore lettura studenti:', error);
        res.status(500).json({
            success: false,
            message: 'Errore durante la lettura degli studenti',
            error: error.message
        });
    }
};

module.exports = {
    upload,
    caricaStudentiCSV,
    getTemplateCSV,
    getStudenti,
    parseCSV,
    salvaStudenti
};
