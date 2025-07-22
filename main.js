const express = require("express");
const fs = require('fs');
const path = require('path');
const http = require("http");
const app = express();
const jwt = require('jsonwebtoken');
const { generaAmbiente } = require('./generaAmbiente'); 
const {recuperaAmbienti} = require('./server/studenti/recuperaAmbienti');
const {eliminaAmbiente} = require('./server/studenti/eliminaAmbiente');
const { upload, caricaStudentiCSV, getStudenti } = require('./caricaStudenti');
const conf = JSON.parse(fs.readFileSync(path.join(__dirname, 'conf.json'), 'utf-8'));
const secretKey = conf.secretKey;
const admin = JSON.parse(fs.readFileSync(path.join(__dirname, 'admin.json'), 'utf-8'));
const server = http.createServer(app);
const generaPassword = require('./server/util/generaPassword');
const verificaAdmin = require('./server/admin/verificaAdmin');
const verificaToken = require('./server/studenti/verificaToken');
const mailSender = require('./server/util/mailSender');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "admin")));
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Array locale per memorizzare gli studenti (solo durante la sessione)
let students = [
    // Studente di test per debugging
    {
        nome: "MARIO",
        cognome: "ROSSI", 
        email: "mario.rossi@itis-molinari.eu",
        password: "test123",
        passwordCambiata: false // Forza il cambio password al primo accesso
    }
];


// Route per la home page (reindirizza al login)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'index.html'));
}); 


//--- MIDDLEWARE PER AMMINISTRATORE ---

app.post("/studente/cambiaPassword", verificaAdmin, (req, res) => {
    const { email, nuovaPassword } = req.body;
    if(!nuovaPassword || nuovaPassword == ""){
        return res.status(400).json({ message: 'La password è obbligatoria' });
    }

    // Trova lo studente
    const student = students.find(s => s.email === email);
    if (!student) {
        return res.status(404).json({ message: 'Studente non trovato' });
    }

    // Aggiorna la password
    student.password = nuovaPassword;
    return res.json({ success: true, message: 'Password cambiata con successo' });
});

app.post("/admin/cambiaPassword", verificaAdmin, (req, res) => {
    const { nuovaPassword } = req.body;
    if(!nuovaPassword || nuovaPassword == ""){
        return res.status(400).json({ message: 'La password è obbligatoria' });
    }
    admin.password = nuovaPassword;
    fs.writeFileSync(path.join(__dirname, 'admin.json'), JSON.stringify(admin, null, 2));
    return res.json({ success: true, message: 'Password cambiata con successo' });
});

app.post("/login", async(req, res) => {
    const {username, password} = req.body;
    
    // Controlla prima se è admin 
    if(username === admin.username && password === admin.password) {
        const token = jwt.sign({ username: "admin", type: "admin" }, secretKey, { expiresIn: '2h' });
        res.status(200)
        .header('Authorization', `Bearer ${token}`)
        .json({
            message: "Login admin effettuato con successo!",
            token: token,
            redirect: "studenti.html",
        });         

    } else {
        const student = students.find(student => student.email === username && student.password === password);
        if(student) {
            const primoAccesso = student.passwordCambiata !== true;
                        
            const tokenPayload = { 
                username: student.email, 
                type: "student",
                primoAccesso: primoAccesso
            };
            
            const token = jwt.sign(tokenPayload, secretKey, { expiresIn: '2h' });
            
            // Se è il primo accesso, reindirizza al cambio password
            const redirectPage = primoAccesso ? "dashboard.html" : "dashboard.html";
            
            res.status(200)
            .header('Authorization', `Bearer ${token}`)
            .json({
                message: "Login studente effettuato con successo!",
                token: token,
                redirect: redirectPage,
                primoAccesso: primoAccesso
            });      
        } else {
            res.status(401).json({message: "Credenziali non valide. Riprova."});
        }
    }
});


app.post("/admin/aggiungiStudente",verificaAdmin, async (req, res) => {
    let {nome, cognome, email} = req.body;

    if(!nome || !cognome || !email ) {
        return res.status(400).json({message: "Tutti i campi sono obbligatori."});
    }
    if(nome == "" || cognome == "" || email == "") {
        return res.status(400).json({message: "Tutti i campi devono essere compilati."});
    } 
    if(students.find(student => student.email === email)) {
        return res.status(400).json({message: "Uno studente con questa email esiste già."});
    }
    if(nome){ // Ripristinato il controllo del dominio
        nome = nome.toUpperCase();
        cognome = cognome.toUpperCase();
        email = email.toLowerCase();
        const password = generaPassword();
        const newStudent = { 
            nome,
            cognome,
            email,
            password,
            primoLogin: true,
            passwordCambiata: false, // Indica che è il primo accesso
            dataCreazione: new Date().toISOString()
        };
        students.push(newStudent);
        await mailSender(email, password, false); // false = non è un reinvio
        return res.status(201).json({message: "Studente aggiunto con successo!"});
    }else{
        return res.status(400).json({message: "L'email deve appartenere al dominio @itis-molinari.eu!"});
    }

});

app.post("/admin/eliminaStudente", verificaAdmin, (req, res)=>{
    const {email} = req.body;
    if(!email) {
        return res.status(400).json({message: "Email dello studente da eliminare non fornita."});
    }
    const index = students.findIndex(student => student.email === email);
    if(index !== -1) {
        students.splice(index, 1);
        return res.status(200).json({message: "Studente eliminato con successo!"});
    } else {
        return res.status(404).json({message: "Studente non trovato."});
    }
})

app.post("/admin/modificaStudente", verificaAdmin, (req, res) => {
    let {emailOriginale, nome, cognome, email} = req.body;
    nome = nome.toUpperCase();
    cognome = cognome.toUpperCase();
    email = email.toLowerCase();
    emailOriginale = emailOriginale.toLowerCase();
    if(!emailOriginale || !nome || !cognome || !email) {
        return res.status(400).json({message: "Tutti i campi sono obbligatori."});
    }
    const studentIndex = students.findIndex(student => student.email === emailOriginale);
    if(studentIndex === -1) {
        return res.status(404).json({message: "Studente non trovato."});
    }
    // Controlla se la nuova email è già utilizzata da un altro studente
    if(emailOriginale !== email) {
        const emailExists = students.some(student => student.email === email && student.email !== emailOriginale);
        if(emailExists) {
            return res.status(400).json({message: "Un altro studente sta già utilizzando questa email."});
        }
    }
    // Aggiorna i dati dello studente
    students[studentIndex] = {
        ...students[studentIndex],
        nome,
        cognome,
        email
    };
    return res.status(200).json({message: "Studente modificato con successo!"});
});

app.post("/admin/reinviaEmail", verificaAdmin, async (req, res) => {
    const {email} = req.body;
    if(!email) {
        return res.status(400).json({message: "Email dello studente non fornita."});
    }
    const student = students.find(student => student.email === email);
    if(student) {
        try {
            student.password = generaPassword(); // Genera una nuova password
            student.primoLogin = true;
            student.passwordCambiata = false; // Reset per forzare il cambio password
            student.dataUltimoReinvio = new Date().toISOString();
            await mailSender(email, student.password, true); // true = è un reinvio
            return res.status(200).json({message: "Email reinviata con successo!"});
        } catch (error) {
            return res.status(500).json({message: "Errore durante l'invio dell'email."});
        }
    } else {
        return res.status(404).json({message: "Studente non trovato."});
    }
});


app.get("/admin/getStudenti", verificaAdmin, (req, res)=>res.status(200).json(students));

// Nuovi endpoint per caricamento CSV
app.post("/admin/caricaStudentiCSV", verificaAdmin, upload.single('csvFile'), caricaStudentiCSV);

app.get("/admin/studentiCompleti", verificaAdmin, getStudenti);

app.post("/studenti/creaAmbiente", verificaToken, generaAmbiente);

app.post("/studenti/recuperaAmbienti", verificaToken, recuperaAmbienti);

app.post("/studenti/eliminaAmbiente", verificaToken, eliminaAmbiente);


server.listen(3007, () => {
  console.log(`🚀 Server running on http://localhost:3007`);
});
 

