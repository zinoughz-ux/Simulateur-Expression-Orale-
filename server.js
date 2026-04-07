const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { updateSubjects } = require('./updater');
const API_KEYS = require('./envi.js');

// Nécessaire sur Windows 7 pour éviter les erreurs de certificats SSL expirés
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

// Endpoint pour récupérer les sujets réels
app.get('/api/subjects', (req, res) => {
    try {
        const data = fs.readFileSync(path.join(__dirname, 'subjects.json'), 'utf8');
        res.json(JSON.parse(data));
    } catch (err) {
        res.status(500).json({ error: "Impossible de lire les sujets" });
    }
});

// Endpoint pour déclencher la mise à jour automatique
app.post('/api/update-subjects', async (req, res) => {
    try {
        const result = await updateSubjects();
        if (result) res.json({ success: true, count: result.task2.length + result.task3.length, lastUpdateInfo: result.lastUpdateInfo });
        else res.json({ success: false, message: "Aucun nouveau sujet trouvé." });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/chat', async (req, res) => {
    const { model, messages, stream, temperature, max_tokens } = req.body;
    const useNvidia = model && model.toLowerCase().includes('nvidia');

    try {
        const timeout = 60000; // 60s pour les évaluations longues
        
        if (!useNvidia) {
            const callGithub = async (modelName) => {
                const url = 'https://models.inference.ai.azure.com/chat/completions';
                console.log(`[Proxy] GitHub Chat Request -> Model: ${modelName}, Stream: ${stream}`);
                
                return await axios({
                    method: 'post',
                    url: url,
                    headers: {
                        'Authorization': `Bearer ${API_KEYS.GITHUB_API_KEY.trim()}`,
                        'Content-Type': 'application/json'
                    },
                    data: { 
                        model: modelName, 
                        messages, 
                        temperature: temperature || 0.7, 
                        max_tokens: max_tokens || 2048, 
                        stream: stream || false 
                    },
                    responseType: stream ? 'stream' : 'json',
                    timeout: timeout
                });
            };

            try {
                const response = await callGithub("gpt-4o-mini");
                if (stream) { 
                    res.setHeader('Content-Type', 'text/event-stream'); 
                    response.data.pipe(res); 
                } else {
                    return res.json(response.data);
                }
            } catch (err) {
                const status = err.response ? err.response.status : 'NO_RESPONSE';
                const errorData = err.response ? JSON.stringify(err.response.data) : err.message;
                console.error(`[Proxy] GitHub Main Error (${status}):`, errorData);
                
                // Ne pas fallback si c'est une erreur d'authentification ou quota
                if (status === 401 || status === 403 || status === 429) {
                    throw new Error(`GitHub API Error: ${status} - ${errorData}`);
                }

                console.log("[Proxy] Tentative Fallback (Llama 3.1 70b)...");
                try {
                    const response = await callGithub("meta-llama-3.1-70b-instruct");
                    if (stream) { 
                        res.setHeader('Content-Type', 'text/event-stream'); 
                        response.data.pipe(res); 
                    } else {
                        return res.json(response.data);
                    }
                } catch (err2) {
                    console.error("[Proxy] Fallback Error:", err2.message);
                    throw err2;
                }
            }
        } else {
            console.log(`[Proxy] NVIDIA Chat Request -> Stream: ${stream}`);
            const response = await axios({
                method: 'post',
                url: 'https://integrate.api.nvidia.com/v1/chat/completions',
                headers: { 
                    'Authorization': `Bearer ${API_KEYS.NVIDIA_API_KEY.trim()}`, 
                    'Content-Type': 'application/json' 
                },
                data: { 
                    model: "meta/llama-3.1-70b-instruct", 
                    messages, 
                    stream: stream || false, 
                    temperature: temperature || 0.5, 
                    max_tokens: max_tokens || 1024 
                },
                responseType: stream ? 'stream' : 'json',
                timeout: timeout
            });
            if (stream) { 
                res.setHeader('Content-Type', 'text/event-stream'); 
                response.data.pipe(res); 
            } else {
                res.json(response.data);
            }
        }
    } catch (error) {
        let errorMsg = error.message;
        if (error.response && error.response.data) {
            // Pour les flux stream, l'erreur est parfois dans un format différent
            errorMsg = `Erreur API: ${error.response.status} ${JSON.stringify(error.response.data)}`;
        }
        console.error("[Proxy] Fatal Error:", errorMsg);
        res.status(500).json({ error: errorMsg });
    }
});

// Servir les fichiers statiques du frontend
app.use(express.static(path.join(__dirname)));

// Route par defaut pour charger l'index.html via le serveur
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, '0.0.0.0', () => {
    console.log(`\n==================================================`);
    console.log(`   SERVEUR TCF CANADA - PRET SUR LE PORT ${port}`);
    console.log(`   URL Locale: http://127.0.0.1:${port}`);
    console.log(`==================================================`);
    console.log(`\nModèles configures :`);
    console.log(`- GitHub: ${API_KEYS.GITHUB_API_KEY ? 'OK (Configuré)' : 'ABSENT (Vérifiez envi.js)'}`);
    console.log(`- NVIDIA: ${API_KEYS.NVIDIA_API_KEY ? 'OK (Configuré)' : 'ABSENT'}`);
    console.log(`\nLogs des requêtes :`);
});
