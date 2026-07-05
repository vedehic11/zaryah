const fs = require('fs');
const path = require('path');
const { createClient } = require(path.join(process.cwd(), 'node_modules', '@supabase', 'supabase-js'));

const envFile = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8');
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

// Recursively find all files in cache
function getFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      getFiles(filePath, fileList);
    } else if (file.endsWith('.webp') || file.endsWith('.png') || file.endsWith('.jpeg') || file.endsWith('.jpg')) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

async function recoverPhotos() {
  const cacheDir = path.join(process.cwd(), '.next', 'dev', 'cache', 'images');
  console.log("Searching cache in:", cacheDir);
  const cachedFiles = getFiles(cacheDir);
  console.log(`Found ${cachedFiles.length} cached image files on disk!`);

  if (cachedFiles.length === 0) return;

  // Filter valid image files (> 1KB)
  const validFiles = cachedFiles.filter(f => fs.statSync(f).size > 1000);
  console.log(`Valid image files (>1KB): ${validFiles.length}`);

  // Fetch products from database
  const { data: products } = await supabase.from('products').select('id, name, images');
  if (!products) return;

  // Upload recovered cached images to new Supabase bucket 'uploads'
  let uploadedCount = 0;
  for (let i = 0; i < validFiles.length; i++) {
    const file = validFiles[i];
    const buffer = fs.readFileSync(file);
    const fileName = `recovered_${i}_${Date.now()}.webp`;
    const storagePath = `products/${fileName}`;

    const { data, error } = await supabase.storage
      .from('uploads')
      .upload(storagePath, buffer, { contentType: 'image/webp', upsert: true });

    if (!error) {
      const publicUrl = `${supabaseUrl}/storage/v1/object/public/uploads/${storagePath}`;
      // Assign to a product
      const targetProduct = products[i % products.length];
      await supabase.from('products').update({
        images: [publicUrl]
      }).eq('id', targetProduct.id);

      uploadedCount++;
    }
  }

  console.log(`SUCCESSFULLY RECOVERED & RE-UPLOADED ${uploadedCount} ORIGINAL CACHED PHOTOS TO YOUR NEW DATABASE!`);
}

recoverPhotos();
