const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { parseRFC4180 } = require('./rfc4180_parser');

const csvPath = 'd:\\zaryah\\supabase_tables\\products_rows.csv';
const csvText = fs.readFileSync(csvPath, 'utf8');
const products = parseRFC4180(csvText);

const urlToProduct = {};
products.forEach(p => {
  if (p.images && Array.isArray(p.images)) {
    p.images.forEach(url => {
      if (typeof url === 'string') {
        urlToProduct[url] = p;
      }
    });
  }
});

const originalUrls = Object.keys(urlToProduct);
const cacheDir = path.join(process.cwd(), '.next', 'dev', 'cache', 'images');
const existingDirs = new Set(fs.readdirSync(cacheDir));

let matched = 0;
const matchedMap = {};

// Test permutations of parameters Next.js or wsrv uses
originalUrls.forEach(url => {
  const variations = [
    url,
    url.replace('umnizxayjwnknetaspxg.supabase.co', 'hempwoejqsozszwgkbjp.supabase.co'),
    `https://wsrv.nl/?url=${encodeURIComponent(url.replace(/^https?:\/\//i, ''))}&w=600&q=80&output=webp`,
    `https://wsrv.nl/?url=${encodeURIComponent(url.replace(/^https?:\/\//i, ''))}&w=800&q=80&output=webp`,
    `https://wsrv.nl/?url=${encodeURIComponent(url.replace(/^https?:\/\//i, ''))}&w=1200&q=80&output=webp`,
    `/_next/image?url=${encodeURIComponent(url)}&w=640&q=75`,
    `/_next/image?url=${encodeURIComponent(url)}&w=750&q=75`,
    `/_next/image?url=${encodeURIComponent(url)}&w=828&q=75`,
    `/_next/image?url=${encodeURIComponent(url)}&w=1080&q=75`,
    `/_next/image?url=${encodeURIComponent(url)}&w=1200&q=75`
  ];

  for (const v of variations) {
    const h1 = crypto.createHash('sha256').update(v).digest('base64url');
    const h2 = crypto.createHash('sha256').update(v).digest('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const h3 = crypto.createHash('md5').update(v).digest('hex');

    const found = [h1, h2, h3].find(h => existingDirs.has(h));
    if (found) {
      matched++;
      matchedMap[url] = { dir: found, product: urlToProduct[url] };
      console.log(`MATCH! ${urlToProduct[url].name} -> ${url} -> Dir: ${found}`);
      break;
    }
  }
});

console.log(`\nTOTAL MATCHED PRODUCT IMAGES: ${matched} / ${originalUrls.length}`);
