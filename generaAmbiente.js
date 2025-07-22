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

        // Range di porte più ampio (10000-50000)
        const hostPort = 10000 + Math.floor(Math.random() * 40000);
        
        // Nome container più sicuro
        const containerName = `vscode-${email.replace(/[@.]/g, '-')}-${nomeAmbiente.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}`;

        const workspacePath = path.join(__dirname, 'workspaces', email, nomeAmbiente);
        fs.mkdirSync(workspacePath, { recursive: true });

        // Controlla se il container name esiste già
        try {
            const existingContainer = docker.getContainer(containerName);
            await existingContainer.inspect();
            throw new Error('Container già esistente');
        } catch (err) {
            // Se il container non esiste, procedi (questo è quello che vogliamo)
            if (!err.message.includes('No such container')) {
                throw err;
            }
        }

        const container = await docker.createContainer({
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
        });

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
        installaEstensioniVSCode(container, tipoAmbiente).catch(console.warn);

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
            hostPort,
            workspacePath,
            url: `http://localhost:${hostPort}`,
            status: 'running'
        };

        ambienti.push(nuovoAmbiente);
        fs.writeFileSync(envFilePath, JSON.stringify(ambienti, null, 2));

        res.status(201).json({
            message: 'Ambiente creato con successo',
            ambiente: nuovoAmbiente
        });

    } catch (error) {
        console.error('Errore creazione ambiente:', error);
        res.status(500).json({
            message: 'Non è stato possibile creare l\'ambiente',
            error: error.message
        });
    }
};

// Funzione per installare strumenti specifici per tipo ambiente (OTTIMIZZATA)
const installaStrumentiAmbiente = async (container, tipoAmbiente, workspacePath) => {
    console.log(`⚡ Configurazione rapida ambiente ${tipoAmbiente}...`);
    
    try {
        switch (tipoAmbiente) {
            case 'nodejs':
                // Solo i comandi essenziali per Node.js
                const nodejs = [
                    'sudo apt-get update -qq > /dev/null 2>&1',
                    'curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash - > /dev/null 2>&1',
                    'sudo apt-get install -y nodejs > /dev/null 2>&1',
                    'cd /home/coder/project && npm init -y > /dev/null 2>&1',
                    'cd /home/coder/project && echo "console.log(\'🚀 Hello Node.js!\');" > app.js'
                ];
                    
                await eseguiComandi(container, nodejs);
                await creaFileBaseNodeJS(workspacePath);
                await creaConfigurazioneVSCode(workspacePath, 'nodejs');
                break;

            case 'python':
                // Python è già preinstallato nell'immagine
                const python = [
                    'sudo apt-get update -qq > /dev/null 2>&1',
                    'sudo apt-get install -y python3-pip > /dev/null 2>&1',
                    'cd /home/coder/project && echo "print(\'🐍 Hello Python!\')" > app.py'
                ];

                await eseguiComandi(container, python);
                await creaFileBasePython(workspacePath);
                await creaConfigurazioneVSCode(workspacePath, 'python');
                break;

            case 'cpp':
                // Solo compilatore essenziale
                const cpp = [
                    'sudo apt-get update -qq > /dev/null 2>&1',
                    'sudo apt-get install -y build-essential > /dev/null 2>&1',
                    'cd /home/coder/project && echo "#include <iostream>\nint main() { std::cout << \"⚡ Hello C++!\" << std::endl; return 0; }" > main.cpp'
                ];

                await eseguiComandi(container, cpp);
                await creaFileBaseCPP(workspacePath);
                await creaConfigurazioneVSCode(workspacePath, 'cpp');
                break;

            case 'java':
                // Solo JDK essenziale
                const java = [
                    'sudo apt-get update -qq > /dev/null 2>&1',
                    'sudo apt-get install -y openjdk-17-jdk > /dev/null 2>&1',
                    'cd /home/coder/project && echo "public class Main { public static void main(String[] args) { System.out.println(\"☕ Hello Java!\"); } }" > Main.java'
                ];

                await eseguiComandi(container, java);
                await creaFileBaseJava(workspacePath);
                await creaConfigurazioneVSCode(workspacePath, 'java');
                break;

            case 'vuoto':
                // Solo git per ambiente vuoto
                await eseguiComandi(container, [
                    'sudo apt-get update -qq > /dev/null 2>&1',
                    'cd /home/coder/project && echo "🚀 Ambiente vuoto pronto!" > README.md'
                ]);
                await creaFileBaseVuoto(workspacePath);
                break;
        }
        
    } catch (error) { 
        console.error(`❌ Errore configurazione ${tipoAmbiente}:`, error.message);
        throw error;
    }
};

// Funzione helper per eseguire comandi nel container (OTTIMIZZATA)
const eseguiComandi = async (container, comandi) => {
    console.log(`⚡ Eseguendo ${comandi.length} comandi in parallelo...`);
    
    // Raggruppa comandi per ridurre exec calls
    const comandoCombinato = comandi.join(' && ');
    
    try {
        const exec = await container.exec({
            Cmd: ['bash', '-c', comandoCombinato],
            AttachStdout: false, // Non raccogliere output per velocità
            AttachStderr: false,
            Tty: false
        });
        
        await exec.start({ Detach: false, Tty: false });
        
        // Controlla solo il risultato finale
        const inspection = await exec.inspect();
        if (inspection.ExitCode !== 0 && inspection.ExitCode !== null) {
            throw new Error(`Comandi falliti con codice ${inspection.ExitCode}`);
        }
        
        console.log(`✅ Configurazione completata`);
        
    } catch (error) {
        console.error(`❌ Errore esecuzione comandi:`, error.message);
        throw error;
    }
};

// Funzione per installare estensioni VS Code specifiche (SEMPLIFICATA)
const installaEstensioniVSCode = async (container, tipoAmbiente) => {
    console.log(`🔌 Installando estensioni essenziali per ${tipoAmbiente}...`);
    
    // Solo le estensioni più essenziali
    let extensions = ['formulahendry.code-runner'];
    
    switch (tipoAmbiente) {
        case 'nodejs':
            extensions.push('ms-vscode.vscode-typescript-next');
            break;
        case 'python':
            extensions.push('ms-python.python');
            break;
        case 'cpp':
            extensions.push('ms-vscode.cpptools');
            break;
        case 'java':
            extensions.push('redhat.java');
            break;
    }
    
    // Installa solo le estensioni essenziali in background
    const installCommand = extensions.map(ext => 
        `code-server --install-extension ${ext} --force > /dev/null 2>&1`
    ).join(' & ');
    
    try {
        await container.exec({
            Cmd: ['bash', '-c', `${installCommand} & exit 0`],
            AttachStdout: false,
            AttachStderr: false,
            Tty: false
        }).then(exec => exec.start({ Detach: true, Tty: false }));
        
        console.log(`✅ Installazione estensioni avviata in background`);
    } catch (error) {
        console.warn(`⚠️ Errore installazione estensioni (ignorato):`, error.message);
    }
};

// Funzioni per creare file base semplici (VELOCI)
const creaFileBaseNodeJS = (workspacePath) => {
    fs.writeFileSync(path.join(workspacePath, 'package.json'), JSON.stringify({
        "name": "nodejs-app",
        "version": "1.0.0",
        "description": "Node.js Application",
        "main": "app.js",
        "scripts": {
            "start": "node app.js",
            "dev": "nodemon app.js"
        }
    }, null, 2));
    
    fs.writeFileSync(path.join(workspacePath, 'app.js'), `// 🚀 Node.js Application
console.log('🟢 Server Node.js avviato!');

// Server HTTP semplice
const http = require('http');
const server = http.createServer((req, res) => {
    res.writeHead(200, {'Content-Type': 'text/html'});
    res.end('<h1>🚀 Hello Node.js!</h1><p>Server funzionante</p>');
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(\`🌐 Server in ascolto su http://localhost:\${PORT}\`);
});
`);
    
    fs.writeFileSync(path.join(workspacePath, 'README.md'), `# 🚀 Node.js App

Premi **Ctrl+F5** per eseguire o usa il terminal:
\`\`\`bash
node app.js
\`\`\`
`);
};

const creaFileBasePython = (workspacePath) => {
    fs.writeFileSync(path.join(workspacePath, 'app.py'), `#!/usr/bin/env python3
# 🐍 Python Application
print('🟢 Applicazione Python avviata!')

def main():
    print('🌟 Hello Python!')
    print('✨ Ambiente pronto per il coding!')
    
    # Esempio semplice
    numbers = [1, 2, 3, 4, 5]
    squared = [x**2 for x in numbers]
    print(f'📊 Numeri al quadrato: {squared}')

if __name__ == '__main__':
    main()
`);
    
    fs.writeFileSync(path.join(workspacePath, 'README.md'), `# 🐍 Python App

Premi **Ctrl+F5** per eseguire o usa il terminal:
\`\`\`bash
python3 app.py
\`\`\`
`);
};

const creaFileBaseCPP = (workspacePath) => {
    fs.writeFileSync(path.join(workspacePath, 'main.cpp'), `#include <iostream>
#include <vector>
#include <string>

int main() {
    std::cout << "🟢 Applicazione C++ avviata!" << std::endl;
    std::cout << "⚡ Hello C++!" << std::endl;
    
    // Esempio semplice
    std::vector<int> numbers = {1, 2, 3, 4, 5};
    std::cout << "📊 Numeri: ";
    for(int n : numbers) {
        std::cout << n << " ";
    }
    std::cout << std::endl;
    
    return 0;
}
`);
    
    fs.writeFileSync(path.join(workspacePath, 'Makefile'), `CC=g++
CFLAGS=-std=c++17 -Wall -O2
TARGET=main
SOURCE=main.cpp

all: \$(TARGET)

\$(TARGET): \$(SOURCE)
\t\$(CC) \$(CFLAGS) \$(SOURCE) -o \$(TARGET)

run: \$(TARGET)
\t./\$(TARGET)

clean:
\trm -f \$(TARGET)

.PHONY: all run clean
`);
    
    fs.writeFileSync(path.join(workspacePath, 'README.md'), `# ⚡ C++ App

Compila ed esegui:
\`\`\`bash
make && make run
\`\`\`

O usa **Ctrl+F5**
`);
};

const creaFileBaseJava = (workspacePath) => {
    fs.writeFileSync(path.join(workspacePath, 'Main.java'), `public class Main {
    public static void main(String[] args) {
        System.out.println("🟢 Applicazione Java avviata!");
        System.out.println("☕ Hello Java!");
        
        // Esempio semplice
        int[] numbers = {1, 2, 3, 4, 5};
        System.out.print("📊 Numeri: ");
        for(int n : numbers) {
            System.out.print(n + " ");
        }
        System.out.println();
    }
}
`);
    
    fs.writeFileSync(path.join(workspacePath, 'README.md'), `# ☕ Java App

Compila ed esegui:
\`\`\`bash
javac Main.java && java Main
\`\`\`

O usa **Ctrl+F5**
`);
};

const creaFileBaseVuoto = (workspacePath) => {
    fs.writeFileSync(path.join(workspacePath, 'README.md'), `# 🚀 Ambiente Vuoto

Ambiente pronto per qualsiasi linguaggio!

## Linguaggi supportati:
- **Node.js**: \`node file.js\`
- **Python**: \`python3 file.py\`  
- **C++**: \`g++ file.cpp -o app && ./app\`
- **Java**: \`javac File.java && java File\`

Inizia creando il tuo primo file! 🎯
`);
};

// Funzione per creare configurazione VS Code (SEMPLIFICATA)
const creaConfigurazioneVSCode = async (workspacePath, tipoAmbiente) => {
    const vscodeDir = path.join(workspacePath, '.vscode');
    fs.mkdirSync(vscodeDir, { recursive: true });
    
    // Settings minimi essenziali
    const settings = {
        "code-runner.runInTerminal": true,
        "code-runner.saveFileBeforeRun": true,
        "files.autoSave": "afterDelay"
    };
    
    // Comandi specifici per Code Runner
    switch (tipoAmbiente) {
        case 'nodejs':
            settings["code-runner.executorMap"] = {
                "javascript": "node $fileName"
            };
            break;
        case 'python':
            settings["code-runner.executorMap"] = {
                "python": "python3 $fileName"
            };
            break;
        case 'cpp':
            settings["code-runner.executorMap"] = {
                "cpp": "g++ $fileName -o main && ./main"
            };
            break;
        case 'java':
            settings["code-runner.executorMap"] = {
                "java": "javac $fileName && java $fileNameWithoutExt"
            };
            break;
    }
    
    fs.writeFileSync(path.join(vscodeDir, 'settings.json'), JSON.stringify(settings, null, 2));
    console.log(`✅ Configurazione VS Code semplificata per ${tipoAmbiente}`);
};

module.exports = { generaAmbiente };