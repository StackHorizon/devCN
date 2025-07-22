const path = require('path');
const fs = require('fs');
const Docker = require('dockerode');

// Configurazione Docker per macOS
const docker = new Docker({
    socketPath: process.platform === 'win32' ? '//./pipe/docker_engine' : '/var/run/docker.sock'
});

const eliminaAmbiente = async (req, res) => {
    try {
        const { email, containerId } = req.body;
        
        if (!email || !containerId) {
            return res.status(400).json({
                success: false,
                message: 'Email e Container ID sono obbligatori'
            });
        }

        // Ottieni e ferma il container
        try {
            const container = docker.getContainer(containerId);
            const info = await container.inspect();
            
            if (info.State.Running) {
                await container.stop();
            }
            
            await container.remove();
            
        } catch (dockerError) {
        }

        // Rimuovi dai file di configurazione
        const envFilePath = path.join(__dirname, 'workspaces', email, 'ambienti.json');
        
        if (fs.existsSync(envFilePath)) {
            let ambienti = [];
            try {
                ambienti = JSON.parse(fs.readFileSync(envFilePath, 'utf-8'));
                if (!Array.isArray(ambienti)) ambienti = [];
            } catch {
                ambienti = [];
            }

            // Filtra l'ambiente da eliminare
            const ambienteEliminato = ambienti.find(amb => amb.containerId === containerId);
            ambienti = ambienti.filter(amb => amb.containerId !== containerId);
            
            // Rimuovi la cartella workspace se esiste
            if (ambienteEliminato && ambienteEliminato.workspacePath) {
                try {
                    if (fs.existsSync(ambienteEliminato.workspacePath)) {
                        fs.rmSync(ambienteEliminato.workspacePath, { recursive: true, force: true });
                    }
                } catch (folderError) {
                    // Non bloccare l'operazione per questo errore
                }
            }
            
            // Salva il file aggiornato
            fs.writeFileSync(envFilePath, JSON.stringify(ambienti, null, 2));
            
            
            res.status(200).json({
                success: true,
                message: `Ambiente "${ambienteEliminato?.nomeAmbiente}" eliminato con successo`
            });
        } else {
            res.status(404).json({
                success: false,
                message: 'File ambienti non trovato'
            });
        }

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Errore durante l\'eliminazione dell\'ambiente',
            error: error.message
        });
    }
};

module.exports = { eliminaAmbiente };
