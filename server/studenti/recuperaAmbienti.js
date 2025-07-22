const path = require('path');
const fs = require('fs');
const Docker = require('dockerode');

// Configurazione Docker per macOS
const docker = new Docker({
    socketPath: process.platform === 'win32' ? '//./pipe/docker_engine' : '/var/run/docker.sock'
});

const recuperaAmbienti = async(req, res)=>{
    try{
        const {email} = req.body;
        
        if(!email) {
            return res.status(400).json({
                success: false,
                error: "Email non fornita"
            });
        }
        
        const envFilePath = path.join(__dirname, 'workspaces', email, 'ambienti.json');
        let ambienti = [];
        
        if (fs.existsSync(envFilePath)) {
            try {
                ambienti = JSON.parse(fs.readFileSync(envFilePath, 'utf-8'));
                if (!Array.isArray(ambienti)) ambienti = [];
            } catch {
                ambienti = [];
            }
        }
        
        // Verifica stato attuale dei container
        for (let ambiente of ambienti) {
            try {
                const container = docker.getContainer(ambiente.containerId);
                const info = await container.inspect();
                ambiente.status = info.State.Status;
                
                // Aggiorna URL se running
                if (ambiente.status === 'running') {
                    const ports = info.NetworkSettings.Ports;
                    if (ports && ports['8080/tcp'] && ports['8080/tcp'][0]) {
                        const hostPort = ports['8080/tcp'][0].HostPort;
                        ambiente.url = `http://localhost:${hostPort}`;
                    }
                }
            } catch (error) {
                ambiente.status = 'deleted';
            }
        }
        fs.writeFileSync(envFilePath, JSON.stringify(ambienti, null, 2));
        
        res.status(200).json({
            success: true,
            ambienti: ambienti
        });
    }catch(error){
        res.status(500).json({
            success: false,
            error: `Errore durante il recupero: ${error.message}`
        });
    }
}

module.exports = {recuperaAmbienti};