const fs = require('fs');
const path = require('path');
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

async function exportBackup() {
  console.log("Fetching updated products from database...");
  const { data: products, error } = await supabase.from('products').select('*');
  if (error) {
    console.error("Error fetching products:", error);
    return;
  }

  console.log(`Found ${products.length} products to backup.`);

  // 1. Generate SQL file
  let sqlContent = `-- Restored Products Backup (${new Date().toISOString()})\n\n`;
  products.forEach(p => {
    const imagesJson = JSON.stringify(p.images).replace(/'/g, "''");
    const nameEsc = (p.name || '').replace(/'/g, "''");
    sqlContent += `UPDATE public.products SET images = '${imagesJson}'::jsonb WHERE id = '${p.id}';\n`;
  });

  const sqlPath = path.join(__dirname, 'products_restored_backup.sql');
  fs.writeFileSync(sqlPath, sqlContent, 'utf8');
  console.log(`Saved SQL backup to ${sqlPath}`);

  // 2. Export updated JSON backup
  const jsonPath = path.join(__dirname, 'products_restored_backup.json');
  fs.writeFileSync(jsonPath, JSON.stringify(products, null, 2), 'utf8');
  console.log(`Saved JSON backup to ${jsonPath}`);

  console.log("DATABASE SAVE COMPLETE!");
}

exportBackup();
