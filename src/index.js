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

const report = {
    start_time: 0,
    end_time: null,
    duration_ms: 0,
    catalogue_pages_discovered: 0,
    cache_hits: 0,
    network_fetches: 0,
    valid_records: 0,
    invalid_records: 0,
    failed_pages: 0
};

const BASE_URL = 'https://books.toscrape.com/catalogue/';

async function requestWithRetry(url, maxRetries = 1) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      const response = await fetch(url, {
        method: 'GET',
        headers: { "User-Agent"   : "FlyRankInternship-A9/1.0 (+https://github.com/Yizuz02/Book-Scrapper)" },
        signal: AbortSignal.timeout(5000)
      });

      if (response.status === 200) {
        report.network_fetches += 1;
        return await response.text();
      }

      if (response.status === 404 || response.status === 403) {
        throw new Error(`HTTP ${response.status}: Permanent failure, no retry`);
      }

      if (response.status >= 500 && attempt < maxRetries) {
        console.warn(`Server error ${response.status} on ${url}. Retrying attempt ${attempt + 1}...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }

      throw new Error(`Failed to fetch page. HTTP status: ${response.status}`);
    } catch (err) {
      if (attempt < maxRetries && (err.name === 'TimeoutError' || err.code === 'UND_ERR_CONNECT_TIMEOUT')) {
        console.warn(`Timeout on ${url}. Retrying attempt ${attempt + 1}...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }
      throw err;
    }
  }
}

async function fecthOrCacheCatalogue(currentPageUrl, numPage) {
    await fs.mkdir('cache', { recursive: true });
    const cacheFile = `cache/page-${numPage}.html`;
    try {
        const fileContent = await fs.readFile(cacheFile, 'utf-8');
        const size = Buffer.byteLength(fileContent, 'utf-8');
        console.log("CACHE HIT")
        console.log(`Size: ${size} bytes`)
        report.cache_hits += 1;
        return fileContent
    } catch (error) {
        try {
            const html = await requestWithRetry(currentPageUrl, 5)
            await fs.writeFile(cacheFile, html, 'utf-8');
            const size = Buffer.byteLength(html, 'utf-8');
            console.log("FETCH")
            console.log(`Size: ${size} bytes`)
            return html;

        } catch (error) {
            throw new Error(error);
        }
        
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
        report.cache_hits += 1;
        return fileContent;
    } catch (error) {
        try {
            const html = await requestWithRetry(url, 5)
            await fs.writeFile(cacheFile, html, 'utf-8');
            const size = Buffer.byteLength(html, 'utf-8');
            console.log("FETCH BOOK")
            console.log(`Size: ${size} bytes`)
            return html;
        } catch (error) {
            throw new Error(error);
        }
        
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
    const startTime = Date.now();
    report.start_time = new Date(startTime).toISOString();

    let numPage = 1;
    let nextHref = "";
    let totalDiscovered = 0;
    const booksMap = new Map();

    while (numPage <= 3) {
        try {
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
        } catch (pageError) {
            console.error(`Error: ${pageError.message}`);
            return;
        }
    }

    console.log(`catalogue_pages=${numPage - 1} discovered=${totalDiscovered} unique_urls=${booksMap.size}`);
    
    report.catalogue_pages_discovered = numPage - 1;

    const rawRecords = [];

    for (const [url, source_page] of booksMap) {
        try {
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
        } catch (pageError) {
            console.error(`Skipping broken page (${url}): ${pageError.message}`);
            report.failed_pages += 1;
        }
        
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


    report.valid_records = books_parsed.length;
    report.invalid_records = errors.length;
    report.end_time = new Date().toISOString();
    report.duration_ms = Date.now() - startTime;

    await fs.writeFile('output/run-report.json', JSON.stringify(report, null, 2), 'utf-8');
    console.log('Run report completed:', report);
}

main()








