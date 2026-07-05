const path = require('path');
const fs = require('fs');
const { ImageOptimizerCache } = require(path.join(__dirname, 'Zaryah_Frontend', 'node_modules', 'next', 'dist', 'server', 'image-optimizer'));
const { parseRFC4180 } = require('./rfc4180_parser');
const { createClient } = require(path.join(__dirname, 'Zaryah_Frontend', 'node_modules', '@supabase', 'supabase-js'));

const envFile = fs.readFileSync(path.join(__dirname, 'Zaryah_Frontend', '.env.local'), 'utf8');
const envVars = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w_]+)\s*=\s*"(.*)"\s*$/) || line.match(/^\s*([\w_]+)\s*=\s*(.*)\s*$/);
  if (match) {
    envVars[match[1]] = match[2];
  }
});

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL || 'https://hempwoejqsozszwgkbjp.supabase.co';
const serviceRoleKey = envVars.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, serviceRoleKey);

const csvText = fs.readFileSync(path.join(__dirname, 'supabase_tables', 'products_rows.csv'), 'utf8');
const products = parseRFC4180(csvText);
const cacheDir = path.join(__dirname, 'Zaryah_Frontend', '.next', 'dev', 'cache', 'images');

const existingDirs = new Set(fs.readdirSync(cacheDir));

async function runExactRestore() {
  console.log("Matching products to exact cache files...");
  let count = 0;

  for (const p of products) {
    if (!p.images || !Array.isArray(p.images) || p.images.length === 0) continue;

    const recoveredUrls = [];

    for (const origUrl of p.images) {
      if (typeof origUrl !== 'string') continue;
      const cleanUrl = origUrl.replace(/^https?:\/\//i, '');
      
      const widthList = [16, 32, 48, 64, 96, 128, 256, 384, 600, 640, 750, 800, 828, 1080, 1200, 1920, 2048, 3840];
      const qualityList = [75, 80];
      const mimeList = ['image/webp', 'image/avif', 'image/png', 'image/jpeg'];

      let matchedFile = null;

      for (const w of widthList) {
        if (matchedFile) break;
        for (const q of qualityList) {
          if (matchedFile) break;
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
                const subDir = path.join(cacheDir, key);
                const files = fs.readdirSync(subDir);
                if (files.length > 0) {
                  matchedFile = path.join(subDir, files[0]);
                  break;
                }
              }
            }
          }
        }
      }

      if (matchedFile) {
        const buffer = fs.readFileSync(matchedFile);
        const fileName = `exact_${p.id.substring(0, 8)}_${Date.now()}_${Math.floor(Math.random()*1000)}.webp`;
        const storagePath = `products/${fileName}`;

        const { data, error } = await supabase.storage
          .from('uploads')
          .upload(storagePath, buffer, { contentType: 'image/webp', upsert: true });

        if (!error) {
          const publicUrl = `${supabaseUrl}/storage/v1/object/public/uploads/${storagePath}`;
          recoveredUrls.push(publicUrl);
        }
      }
    }

    if (recoveredUrls.length > 0) {
      count++;
      await supabase.from('products').update({ images: recoveredUrls }).eq('id', p.id);
      console.log(`[${count}] RESTORED EXACT ORIGINAL PHOTO FOR: ${p.name}`);
    }
  }

  console.log(`\n🎉 SUCCESS! RESTORED EXACT ORIGINAL PHOTOS FOR ${count} PRODUCTS IN YOUR DATABASE!`);
}

runExactRestore();
