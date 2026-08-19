const fs = require('fs').promises;
const cheerio = require('cheerio');

const CACHE_FILE = 'cache/page-1.html';
const BASE_URL = 'https://books.toscrape.com/catalogue/';

async function fecthOrCache(href, numPage) {
    await fs.mkdir('cache', { recursive: true });
    const cacheFile = `cache/page-${numPage}.html`;
    try {
        const fileContent = await fs.readFile(cacheFile, 'utf-8');
        const size = Buffer.byteLength(fileContent, 'utf-8');
        console.log("CACHE HIT")
        console.log(`Size: ${size} bytes`)
        return fileContent
    } catch (error) {
        const url = new URL(href, BASE_URL)
        await new Promise(resolve => setTimeout(resolve, 500));
        const response = await fetch(url, {
            method  : 'GET', 
            headers : {
                "User-Agent"   : "FlyRankInternship-A9/1.0 (+https://github.com/Yizuz02/Book-Scrapper)"
            },
            signal: AbortSignal.timeout(5000)
        });

        if (response.status !== 200) {
            throw new Error(`Failed to fetch page. HTTP status: ${response.status}`);
        }

        const html = await response.text();
        await fs.writeFile(cacheFile, html, 'utf-8');

        const size = Buffer.byteLength(html, 'utf-8');
        console.log("FETCH")
        console.log(`Size: ${size} bytes`)
        return html;
    }
}

async function main() {
    let numPage = 1
    let nextHref = ""
    const bookUrls = []

    while (numPage<=3) {
        const html = await fecthOrCache(nextHref, numPage)
        const $ = cheerio.load(html);

        $('article.product_pod h3 a').each((_, el) => {
            const href = $(el).attr('href');
            const absoluteUrl = new URL(href, BASE_URL).href;
            bookUrls.push(absoluteUrl);
        });

        const nextRelHref = $('li.next a').attr('href');
            if (nextRelHref) {
            nextHref = nextRelHref;
        }


        numPage+=1;
    }

    const uniqueUrls = Array.from(new Set(bookUrls));
    console.log(`catalogue_pages=${numPage - 1} discovered=${bookUrls.length} unique_urls=${uniqueUrls.length}`);
}

main()








