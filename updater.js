const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const URLS = [
    'https://prepmontcfca.com/sujets-expression-orale/',
    'https://reussir-tcfcanada.com/expression-orale/',
    'https://formation-tcfcanada.com/expression-orale/expression-orale-sujets-dactualites/'
];

async function updateSubjects() {
    console.log("🚀 Lancement du tri intelligent par mois...");
    let allTask2 = [];
    let allTask3 = [];
    let byMonth = {}; 
    let latestMonthFound = "Inconnu";

    for (const url of URLS) {
        try {
            const { data } = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
            const $ = cheerio.load(data);
            
            let monthLinks = [];
            $('a').each((i, el) => {
                const text = $(el).text().trim();
                const href = $(el).attr('href');
                if ((text.includes('2025') || text.includes('2026')) && href) {
                    monthLinks.push({ text, href });
                }
            });

            if (monthLinks.length > 0) latestMonthFound = monthLinks[0].text;

            const latestToScrape = monthLinks.slice(0, 5); // On regarde les 5 derniers mois
            
            for (const month of latestToScrape) {
                const monthName = month.text.toLowerCase(); // ex: "mars 2026"
                if (!byMonth[monthName]) byMonth[monthName] = { task2: [], task3: [] };

                console.log(`   📂 Extraction : ${monthName}`);
                try {
                    const { data: monthData } = await axios.get(month.href);
                    const $$ = cheerio.load(monthData);
                    
                    $$('h3, h4, p, li, div').each((j, el) => {
                        const text = $$(el).text().trim();
                        if (text.length < 35 || text.length > 500) return;

                        const isT2 = text.includes('Je suis') || text.includes('votre ami') || text.includes('votre voisin');
                        const isT3 = text.includes('Pensez-vous') || text.includes('Êtes-vous d\'accord') || text.includes('Selon vous');

                        const cleanText = text.replace(/Sujet \d+\s*[:\-]\s*/i, '').trim();

                        if (isT2) {
                            allTask2.push(cleanText);
                            byMonth[monthName].task2.push(cleanText);
                        } else if (isT3) {
                            allTask3.push(cleanText);
                            byMonth[monthName].task3.push(cleanText);
                        }
                    });
                } catch (e) { }
            }
        } catch (err) { }
    }

    // Nettoyage des doublons pour chaque mois
    for (let m in byMonth) {
        byMonth[m].task2 = [...new Set(byMonth[m].task2)];
        byMonth[m].task3 = [...new Set(byMonth[m].task3)];
    }

    const final = {
        task2: [...new Set(allTask2)],
        task3: [...new Set(allTask3)],
        byMonth: byMonth,
        lastUpdateInfo: latestMonthFound,
        lastUpdateDate: new Date().toLocaleDateString('fr-FR')
    };
    
    fs.writeFileSync(path.join(__dirname, 'subjects.json'), JSON.stringify(final, null, 2));
    console.log(`✅ Terminé ! Tri par mois fini.`);
    return final;
}

if (require.main === module) {
    updateSubjects();
}

module.exports = { updateSubjects };
