## Target Classification

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