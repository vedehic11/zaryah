const path = require('path');
const { ImageOptimizerCache } = require(path.join(__dirname, 'Zaryah_Frontend', 'node_modules', 'next', 'dist', 'server', 'image-optimizer'));
const { parseRFC4180 } = require('./rfc4180_parser');
const fs = require('fs');

const csvText = fs.readFileSync(path.join(__dirname, 'supabase_tables', 'products_rows.csv'), 'utf8');
const products = parseRFC4180(csvText);
const cacheDir = path.join(__dirname, 'Zaryah_Frontend', '.next', 'dev', 'cache', 'images');

if (!fs.existsSync(cacheDir)) {
  console.log("Cache dir not found:", cacheDir);
  process.exit(1);
}

const existingDirs = new Set(fs.readdirSync(cacheDir));
console.log(`Searching across ${existingDirs.size} Next.js cache directories...`);

let matches = 0;
const productImagesMap = {};

for (const p of products) {
  if (p.images && Array.isArray(p.images)) {
    for (const origUrl of p.images) {
      if (typeof origUrl !== 'string') continue;
      
      const cleanUrl = origUrl.replace(/^https?:\/\//i, '');
      
      const widthList = [16, 32, 48, 64, 96, 128, 256, 384, 600, 640, 750, 800, 828, 1080, 1200, 1920, 2048, 3840];
      const qualityList = [75, 80];
      const mimeList = ['image/webp', 'image/avif', 'image/png', 'image/jpeg'];

      for (const w of widthList) {
        for (const q of qualityList) {
          for (const mime of mimeList) {
            const urlVariations = [
              origUrl,
              origUrl.replace('umnizxayjwnknetaspxg.supabase.co', 'hempwoejqsozszwgkbjp.supabase.co'),
              `https://wsrv.nl/?url=${encodeURIComponent(cleanUrl)}&w=${w}&q=${q}&output=webp`,
              `https://wsrv.nl/?url=${encodeURIComponent(cleanUrl.replace('umnizxayjwnknetaspxg.supabase.co', 'hempwoejqsozszwgkbjp.supabase.co'))}&w=${w}&q=${q}&output=webp`
            ];

            for (const href of urlVariations) {
              const key = ImageOptimizerCache.getCacheKey({ href, width: w, quality: q, mimeType: mime });
              if (existingDirs.has(key)) {
                matches++;
                if (!productImagesMap[p.id]) productImagesMap[p.id] = { product: p, images: [] };
                productImagesMap[p.id].images.push({ origUrl, key, href });
                console.log(`EXACT MATCH! Product: "${p.name}" -> CacheKey: ${key}`);
                break;
              }
            }
          }
        }
      }
    }
  }
}

console.log(`\n========================================`);
console.log(`TOTAL EXACT MATCHES: ${matches}`);
console.log(`PRODUCTS WITH RECOVERED MATCHED IMAGES: ${Object.keys(productImagesMap).length} / ${products.length}`);
console.log(`========================================\n`);

module.exports = { productImagesMap };
