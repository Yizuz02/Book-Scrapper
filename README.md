# Book Scrapper — Polite Scraping Pipeline

A robust, idempotent web scraping pipeline built for the Books to Scrape sandbox that extracts, normalizes, and schema-validates book catalogue data into structured JSON with failure survival and run reporting.

---

## 1. Target Classification

* **Target Site:** [https://books.toscrape.com](https://books.toscrape.com)
* **Purpose & Permission:** This site is explicitly designed as a public practice sandbox for learning web scraping. The homepage includes a clear notice:
  > *"Warning! This is a demo website for web scraping purposes. Prices and ratings here were randomly assigned and have no real meaning."*
* **Scope:** Only the first **3 catalogue pages** (a total of 60 books).
* **Data Collected:** Book metadata including title, price, stock status, rating, description, and canonical product URL.
* **`robots.txt` Inspection:**
  Checking `https://books.toscrape.com/robots.txt` returned a `404 Not Found` response:
  ```html
  <html>
  <head><title>404 Not Found</title></head>
  <body>
  <center><h1>404 Not Found</h1></center>
  <hr><center>nginx/1.21.6</center>
  </body>
  </html>
  ```

A missing robots.txt does not imply permission to scrape without limits; it simply means no specific crawling directives exist. Therefore, we still strictly follow polite scraping practices (rate limiting, identifiable user-agents, caching, and limited scope).

Pledge: I will not reuse this code on another site without checking its rules and terms first.

---

## 2. Installation


Clone the repository and install the dependencies:
```bash
git clone [https://github.com/Yizuz02/Book-Scrapper.git](https://github.com/Yizuz02/Book-Scrapper.git)
cd Book-Scrapper
npm install
```

---

## 3. How to Run

To execute the pipeline, run the npm start command:

```bash
npm start
```



## 4. Politeness Rules

This scraper acts as a responsible and polite web guest:

* **User-Agent Header:** Every request sends an honest user-agent header identifying the scraper and repository (`FlyRankInternship-A9/1.0 (+https://github.com/Yizuz02/Book-Scrapper)`).


* **Rate Limiting:** Enforces a minimum delay of 500 ms between live network requests to avoid hammering the host server.


* **Request Timeout:** All network requests include an `AbortSignal.timeout(5000)` timeout to prevent indefinite hangs.


* **Local Caching:** HTML files for catalogue and detail pages are cached locally under `cache/`. Subsequent executions reuse cached pages on disk, avoiding repeated network calls.


---

## 5. Record Schema

All records are validated using **Zod** before being saved to `output/books.json`:

```javascript
const Book = z.object({
  title: z.string().min(1),
  product_url: z.string().startsWith('https://'),
  price_text: z.string(),
  price_gbp: z.number().positive(),
  availability_text: z.string(),
  stock_count: z.number().int().nonnegative(),
  is_in_stock: z.boolean(),
  rating_text: z.string(),
  rating_num: z.number().int().min(0).max(5),
  description: z.string().nullable(),
  source_page: z.string().startsWith('https://'),
  fetched_at: z.string()
});
```

---

## 6. Execution Proof & Browser Cost Note

### Latest Run Report (`output/run-report.json`)

```json
{
  "start_time": "2026-08-19T04:45:23.925Z",
  "end_time": "2026-08-19T04:45:59.736Z",
  "duration_ms": 35811,
  "catalogue_pages_discovered": 3,
  "cache_hits": 2,
  "network_fetches": 61,
  "valid_records": 60,
  "invalid_records": 0,
  "failed_pages": 0
}
```

### Why No Headless Browser Was Needed

This assignment did not require a headless browser (such as Puppeteer or Playwright) because all target data is statically present in the raw HTML payload returned directly by the server; launching and rendering a full browser engine would only add unnecessary memory, CPU, and network overhead.

---

## 7. Ethics & Limitations

### Ethical Scraping Principles

* Always prefer official APIs when available.

* Never bypass authentication, logins, CAPTCHAs, or paywalls.

* Collect only the minimum scope of data necessary for the task.


### Honest Limitation

The scraper parses static server-side rendered HTML using CSS selectors tightly coupled to the DOM structure of `books.toscrape.com`. If the website updates its HTML markup, class names, or migrates to client-side JavaScript rendering (CSR), the selectors will fail and require manual schema and parser updates.

## Internship
This project was developed as part of the FlyRank AI Internship.

