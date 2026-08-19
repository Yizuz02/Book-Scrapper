const fs = require('fs').promises;

const CACHE_FILE = 'cache/page-1.html';
const URL = 'https://books.toscrape.com/catalogue/page-1.html';

async function fecthOrCache() {
    await fs.mkdir('cache', { recursive: true })

    try {
        const fileContent = await fs.readFile(CACHE_FILE, 'utf-8');
        const size = Buffer.byteLength(fileContent, 'utf-8');
        console.log("CACHE HIT")
        console.log(`Size: ${size} bytes`)
        return fileContent
    } catch (error) {
        const response = await fetch(URL, {
            method  : 'GET', 
            headers : {
                "User-Agent"   : "FlyRankInternship-A9/1.0 (https://github.com/Yizuz02/Book-Scrapper)"
            },
            signal: AbortSignal.timeout(5000)
        });

        if (response.status !== 200) {
            throw new Error(`Failed to fetch page. HTTP status: ${response.status}`);
        }

        const html = await response.text();
        await fs.writeFile(CACHE_FILE, html, 'utf-8');

        const size = Buffer.byteLength(html, 'utf-8');
        console.log("FETCH")
        console.log(`Size: ${size} bytes`)
        return html;
    }
}

fecthOrCache()







