const fs = require('fs');
const path = require('path');

const envFile = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8');
const envVars = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w_]+)\s*=\s*"(.*)"\s*$/) || line.match(/^\s*([\w_]+)\s*=\s*(.*)\s*$/);
  if (match) {
    envVars[match[1]] = match[2];
  }
});

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = envVars.SUPABASE_SERVICE_ROLE_KEY;

const { createClient } = require(path.join(process.cwd(), 'node_modules', '@supabase', 'supabase-js'));
const supabase = createClient(supabaseUrl, serviceRoleKey);

// First ensure any missing columns exist
async function fixMissingColumns() {
  console.log("Fixing missing columns if any...");
  // We can execute SQL or check via REST
}

const importSequence = [
  { table: 'users', file: 'users_rows.csv' },
  { table: 'buyers', file: 'buyers_rows.csv' },
  { table: 'sellers', file: 'sellers_rows.csv' },
  { table: 'seller_sections', file: 'seller_sections_rows.csv' },
  { table: 'products', file: 'products_rows.csv' },
  { table: 'addresses', file: 'addresses_rows.csv' },
  { table: 'carts', file: 'carts_rows.csv' },
  { table: 'cart_items', file: 'cart_items_rows.csv' },
  { table: 'orders', file: 'orders_rows.csv' },
  { table: 'order_items', file: 'order_items_rows.csv' },
  { table: 'wallets', file: 'wallets_rows.csv' },
  { table: 'transactions', file: 'transactions_rows.csv' },
  { table: 'withdrawal_requests', file: 'withdrawal_requests_rows.csv' },
  { table: 'wishlist', file: 'wishlist_rows.csv' },
  { table: 'notifications', file: 'notifications_rows.csv' },
  { table: 'otps', file: 'otps_rows.csv' },
  { table: 'email_verifications', file: 'email_verifications_rows.csv' }
];

async function runDirectCsvImport() {
  const dir = 'd:\\zaryah\\supabase_tables';
  for (const item of importSequence) {
    const filePath = path.join(dir, item.file);
    if (!fs.existsSync(filePath)) continue;
    
    const csvData = fs.readFileSync(filePath, 'utf8');
    console.log(`Sending direct CSV to '${item.table}'...`);
    
    const url = `${supabaseUrl}/rest/v1/${item.table}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type': 'text/csv',
        'Prefer': 'resolution=merge-duplicates'
      },
      body: csvData
    });
    
    if (res.ok) {
      console.log(`SUCCESS: ${item.table} direct CSV imported!`);
    } else {
      const errText = await res.text();
      console.error(`ERROR on ${item.table}:`, errText);
    }
  }
}

runDirectCsvImport();
