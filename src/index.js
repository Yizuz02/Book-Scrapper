const fs = require('fs').promises;
const cheerio = require('cheerio');
const z = require('zod')

const Book = z.object({
  title: z.string().min(1),
  product_url: z.string().startsWith('https://'),
  
  // Price (raw string + numeric)
  price_text: z.string(),
  price_gbp: z.number().positive(),
  
  // Availability & Stock (raw string + integer count + in-stock boolean)
  availability_text: z.string(),
  stock_count: z.number().int().nonnegative(),
  is_in_stock: z.boolean(),
  
  // Rating (raw string + integer 1-5)
  rating_text: z.string(),
  rating_num: z.number().int().min(0).max(5),
  
  // Details & Provenance
  description: z.string().nullable(),
  source_page: z.string().startsWith('https://'),
  fetched_at: z.string()
});

const BASE_URL = 'https://books.toscrape.com/catalogue/';

async function fecthOrCacheCatalogue(currentPageUrl, numPage) {
    await fs.mkdir('cache', { recursive: true });
    const cacheFile = `cache/page-${numPage}.html`;
    try {
        const fileContent = await fs.readFile(cacheFile, 'utf-8');
        const size = Buffer.byteLength(fileContent, 'utf-8');
        console.log("CACHE HIT")
        console.log(`Size: ${size} bytes`)
        return fileContent
    } catch (error) {
        await new Promise(resolve => setTimeout(resolve, 500));
        const response = await fetch(currentPageUrl, {
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

async function fecthOrCacheBook(url) {
    const slug = url.split('/').filter(Boolean).slice(-2, -1)[0] || 'book';
    await fs.mkdir('cache/books', { recursive: true });
    const cacheFile = `cache/books/${slug}.html`;
    try {
        const fileContent = await fs.readFile(cacheFile, 'utf-8');
        const size = Buffer.byteLength(fileContent, 'utf-8');
        console.log("CACHE HIT BOOK")
        console.log(`Size: ${size} bytes`)
        return fileContent;
    } catch (error) {
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
        console.log("FETCH BOOK")
        console.log(`Size: ${size} bytes`)
        return html;
    }
}

function ratingToInt(str) {
  const ratings = {
    'One': 1,
    'Two': 2,
    'Three': 3,
    'Four': 4,
    'Five': 5
  };
  return ratings[str] || 0;
}

async function main() {
    let numPage = 1;
    let nextHref = "";
    let totalDiscovered = 0;
    const booksMap = new Map();

    while (numPage <= 3) {
        const currentPageUrl = new URL(nextHref || 'page-1.html', BASE_URL).href;
        const html = await fecthOrCacheCatalogue(currentPageUrl, numPage);
        const $ = cheerio.load(html);

        $('article.product_pod h3 a').each((_, el) => {
            const href = $(el).attr('href');
            const absoluteUrl = new URL(href, BASE_URL).href;

            totalDiscovered += 1;
            booksMap.set(absoluteUrl, currentPageUrl);
        });

        const nextRelHref = $('li.next a').attr('href');
        if (nextRelHref) {
            nextHref = nextRelHref;
        }

        numPage += 1;
    }

    console.log(`catalogue_pages=${numPage - 1} discovered=${totalDiscovered} unique_urls=${booksMap.size}`);
    
    const rawRecords = [];

    for (const [url, source_page] of booksMap) {
        const bookHtml = await fecthOrCacheBook(url);
        const $ = cheerio.load(bookHtml);

        const bookTitle = $('article.product_page .product_main h1').text();
        const price_text = $('article.product_page th:contains("Price (excl. tax)") + td').text();
        const availability_text = $('article.product_page th:contains("Availability") + td').text();
        const stock = parseInt(availability_text.split('').filter(char => !isNaN(char) && char !== ' ').join(''));
        const rating_text = $('article.product_page .star-rating')[0].attribs.class.replace("star-rating ", "");
        const description = $('article.product_page #product_description + p').text();
        const fetched_at = new Date().toISOString();

        const bookInfo = {
            "title": bookTitle,
            "product_url": url,
            "price_text": price_text,
            "price_gbp": parseFloat(price_text.replace("£","")),
            "availability_text": availability_text,
            "stock_count": stock,
            "is_in_stock": stock > 0, 
            "rating_text": rating_text,
            "rating_num": ratingToInt(rating_text),
            "description": description.trim().length > 0 ? description.trim() : null,
            "source_page": source_page,
            "fetched_at": fetched_at
        }

        rawRecords.push(bookInfo);
    }

    console.log('Sample record:', rawRecords[10]);
    console.log(`detail_pages=${rawRecords.length}`);

    await fs.mkdir('output', { recursive: true });

    const books_parsed = [];
    const errors = [];

    for (const rawData of rawRecords) {
    const result = Book.safeParse(rawData);
    if (result.success) {
        books_parsed.push(result.data);
    } else {
        errors.push({
        record: rawData,
        errors: result.error.issues
        });
    }
    }

    await fs.writeFile('output/books.json', JSON.stringify(books_parsed, null, 2), 'utf-8');
    await fs.writeFile('output/errors.json', JSON.stringify(errors, null, 2), 'utf-8');
}

main()








