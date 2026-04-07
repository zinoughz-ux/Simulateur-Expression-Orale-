const { GoogleGenerativeAI } = require("@google/generative-ai");
const axios = require('axios');
const fs = require('fs');

async function listAll() {
    console.log("--- Lecture des clés ---");
    const content = fs.readFileSync('envi.js', 'utf8');
    const geminiKey = content.match(/GEMINI_API_KEY\s*:\s*['"](.*)['"]/)?.[1];
    const grokKey = content.match(/GROK_API_KEY\s*:\s*['"](.*)['"]/)?.[1];

    if (geminiKey) {
        console.log("\n--- Gemini Models (v1) ---");
        try {
            // On tente un appel simple pour voir si le modèle répond sur l'endpoint par défaut
            const genAI = new GoogleGenerativeAI(geminiKey);
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
            const result = await model.generateContent("Ping");
            console.log("Gemini 1.5 Flash est VALIDE !");
        } catch (e) {
            console.error("Gemini 1.5 Flash ERREUR:", e.message);
        }
    }

    if (grokKey) {
        console.log("\n--- Grok Models ---");
        try {
            const res = await axios.get('https://api.x.ai/v1/models', {
                headers: { 'Authorization': `Bearer ${grokKey}` }
            });
            console.log("Modèles Grok disponibles:", res.data.data.map(m => m.id).join(', '));
        } catch (e) {
            console.error("Grok Models ERREUR:", e.response?.data || e.message);
        }
    }
}

listAll();
