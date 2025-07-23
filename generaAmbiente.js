const path = require('path');
const fs = require('fs');
const Docker = require('dockerode');

// Configurazione Docker per macOS
const docker = new Docker({
    socketPath: process.platform === 'win32' ? '//./pipe/docker_engine' : '/var/run/docker.sock'
});

const generaAmbiente = async (req, res) => {
    try {
        const { email, nomeAmbiente, tipoAmbiente = 'vuoto' } = req.body;
        
        // Validazione input
        if (!email || !nomeAmbiente) {
            return res.status(400).json({
                message: 'Email e nome ambiente sono obbligatori'
            });
        }

        // Validazione tipo ambiente
        const ambientiValidi = ['nodejs', 'python', 'cpp', 'java', 'vuoto'];
        if (!ambientiValidi.includes(tipoAmbiente)) {
            return res.status(400).json({
                message: 'Tipo ambiente non valido. Scegli tra: ' + ambientiValidi.join(', ')
            });
        }

        // Genera porta casuale velocemente
        const hostPort = 3100 + Math.floor(Math.random() * 100); // Range 3100-3199
        
        // Nome container semplice
        const timestamp = Date.now();
        const containerName = `env-${email.split('@')[0]}-${timestamp}`;

        // Crea cartella workspace velocemente
        const workspacePath = path.join(__dirname, 'workspaces', email, nomeAmbiente);
        fs.mkdirSync(workspacePath, { recursive: true });

        // Mappa le immagini Docker specifiche per ogni ambiente
        const imageMap = {
            'nodejs': 'devenv-nodejs:latest',
            'python': 'devenv-python:latest',
            'cpp': 'devenv-cpp:latest',
            'java': 'devenv-java:latest',
            'vuoto': 'devenv-vuoto:latest'
        };

        // Seleziona l'immagine appropriata
        const dockerImage = imageMap[tipoAmbiente] || imageMap['vuoto'];

        // Container configuration ottimizzata per ogni ambiente
        const containerConfig = {
            Image: dockerImage,
            name: containerName,
            Env: [
                `SUDO_PASSWORD=${email}`,
                'DEFAULT_WORKSPACE=/home/coder/project',
                `ENVIRONMENT_TYPE=${tipoAmbiente}`,
                `USER_EMAIL=${email}`
            ],
            Cmd: ['--auth', 'none', '--bind-addr', '0.0.0.0:8080'],
            ExposedPorts: { '8080/tcp': {} },
            HostConfig: {
                PortBindings: {
                    '8080/tcp': [{ HostPort: `${hostPort}` }]
                },
                Binds: [`${workspacePath}:/home/coder/project`],
                Memory: 1024 * 1024 * 1024, // 1GB invece di 512MB
                NanoCpus: 1.0 * 1000000000, // 1 CPU invece di 0.5
                RestartPolicy: { Name: 'unless-stopped' } // Auto-restart
            },
            WorkingDir: '/home/coder/project',
            // Aggiungi labels per identificazione
            Labels: {
                'user.email': email,
                'environment.name': nomeAmbiente,
                'created.by': 'cloud-environments'
            }
        };

        // Verifica che l'immagine Docker esista
        try {
            await docker.getImage(dockerImage).inspect();
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: `Immagine Docker non trovata: ${dockerImage}. Esegui prima lo script build-images.sh per costruire le immagini.`
            });
        }

        // Crea e avvia il container
        const container = await docker.createContainer(containerConfig);
        await container.start();

        // Verifica che il container sia effettivamente avviato
        const containerInfo = await container.inspect();
        if (!containerInfo.State.Running) {
            throw new Error('Container non si è avviato correttamente');
        }

        // Aspetta che il container sia completamente pronto (ridotto)
        console.log('⏳ Container verificato velocemente');
        await new Promise(resolve => setTimeout(resolve, 500)); // Ridotto a 500ms

        const userDataPath = path.join(__dirname, 'workspaces', email);
        fs.mkdirSync(userDataPath, { recursive: true });

        const envFilePath = path.join(userDataPath, 'ambienti.json');
        let ambienti = [];

        if (fs.existsSync(envFilePath)) {
            try {
                ambienti = JSON.parse(fs.readFileSync(envFilePath, 'utf-8'));
                if (!Array.isArray(ambienti)) ambienti = [];
            } catch {
                ambienti = [];
            }
        }

        const nuovoAmbiente = {
            containerId: container.id,
            containerName: containerName,
            nomeAmbiente,
            email,
            tipoAmbiente,
            dataCreazione: new Date().toISOString(),
            port: hostPort,
            workspacePath,
            url: `https://coding.servehttp.com/env/${hostPort}`,
            vscodeUrl: `https://coding.servehttp.com/vscode/${hostPort}`,
            status: 'running'
        };

        ambienti.push(nuovoAmbiente);
        fs.writeFileSync(envFilePath, JSON.stringify(ambienti, null, 2));

        // Setup non necessario - tutto è già configurato nelle immagini Docker
        console.log(`✅ Ambiente ${tipoAmbiente} creato con immagine ${dockerImage}`);

        // Risposta immediata
        res.status(201).json({
            success: true,
            message: `Ambiente ${nomeAmbiente} (${tipoAmbiente}) creato con successo!`,
            ambiente: nuovoAmbiente,
            dockerImage: dockerImage
        });

    } catch (error) {
        console.error('❌ Errore creazione ambiente:', error);
        res.status(500).json({
            success: false,
            message: 'Errore durante la creazione dell\'ambiente: ' + error.message
        });
    }
};

module.exports = { generaAmbiente };