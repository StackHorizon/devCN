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

        // Container configuration minima per velocità
        const containerConfig = {
            Image: 'codercom/code-server:latest',
            name: containerName,
            Env: [
                `SUDO_PASSWORD=${email}`,
                'DEFAULT_WORKSPACE=/home/coder/project'
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

        // Crea e avvia il container
        const container = await docker.createContainer(containerConfig);
        await container.start();

        // Verifica che il container sia effettivamente avviato
        const containerInfo = await container.inspect();
        if (!containerInfo.State.Running) {
            throw new Error('Container non si è avviato correttamente');
        }

        // Aspetta che il container sia completamente pronto (ridotto)
        console.log('⏳ Verificando container...');
        await new Promise(resolve => setTimeout(resolve, 1000)); // Ridotto da 3s a 1s

        // Installa tools specifici per tipo ambiente (OTTIMIZZATO)
        await installaStrumentiAmbiente(container, tipoAmbiente, workspacePath);

        // Installa estensioni VS Code solo essenziali (IN BACKGROUND)
        await installaEstensioniVSCode(container, tipoAmbiente).catch(console.warn);

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

        // Risposta immediata
        res.status(201).json({
            success: true,
            message: `Ambiente ${nomeAmbiente} creato con successo!`,
            ambiente: nuovoAmbiente
        });

        // Setup minimo in background (non bloccante)
        setTimeout(async () => {
            try {
                await setupAmbienteVeloce(container, tipoAmbiente, workspacePath);
                console.log(`✅ Setup completato per ${nomeAmbiente}`);
            } catch (error) {
                console.warn(`⚠️ Setup warning per ${nomeAmbiente}:`, error.message);
            }
        }, 500);

    } catch (error) {
        console.error('❌ Errore creazione ambiente:', error);
        res.status(500).json({
            success: false,
            message: 'Errore durante la creazione dell\'ambiente: ' + error.message
        });
    }
};

// Setup velocissimo e leggero (solo essenziale)
const setupAmbienteVeloce = async (container, tipoAmbiente, workspacePath) => {
    const setupComandi = {
        nodejs: 'echo "console.log(\'🚀 Hello Node.js!\');" > /home/coder/project/app.js',
        python: 'echo "print(\'🐍 Hello Python!\')" > /home/coder/project/main.py',
        cpp: 'echo "#include<iostream>\nint main(){std::cout<<\"⚡ Hello C++!\";return 0;}" > /home/coder/project/main.cpp',
        java: 'echo "public class Main{public static void main(String[] args){System.out.println(\"☕ Hello Java!\");}}" > /home/coder/project/Main.java',
        vuoto: 'echo "🎉 Ambiente pronto!" > /home/coder/project/README.md'
    };

    const comando = setupComandi[tipoAmbiente] || setupComandi.vuoto;
    
    try {
        const exec = await container.exec({
            Cmd: ['sh', '-c', comando],
            AttachStdout: false,
            AttachStderr: false
        });
        await exec.start({ Detach: true });
    } catch (error) {
        // Ignora errori per non rallentare
        console.warn('Setup minimo fallito, continuando...');
    }
};

module.exports = { generaAmbiente };