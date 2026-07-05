const fs = require('fs');
const path = require('path');

// Read env variables directly from .env.local
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

const { createClient } = require(path.join(process.cwd(), 'node_modules', '@supabase', 'supabase-js'));
const supabase = createClient(supabaseUrl, serviceRoleKey);

function parseCSV(text) {
  const lines = [];
  let cur = '';
  let inQuotes = false;
  
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (inQuotes && text[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === '\n' && !inQuotes) {
      lines.push(cur);
      cur = '';
    } else if (c === '\r' && !inQuotes) {
      // skip \r
    } else {
      cur += c;
    }
  }
  if (cur.trim()) lines.push(cur);
  if (lines.length === 0) return [];

  const headers = parseLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const values = parseLine(lines[i]);
    const obj = {};
    headers.forEach((h, idx) => {
      let val = values[idx];
      if (val === undefined || val === '' || val === 'NULL' || val === '\\N') {
        val = null;
      } else if (val === 'true') {
        val = true;
      } else if (val === 'false') {
        val = false;
      } else if (val && (val.startsWith('{') || val.startsWith('['))) {
        try { val = JSON.parse(val); } catch(e) {}
      }
      obj[h.trim()] = val;
    });
    rows.push(obj);
  }
  return rows;
}

function parseLine(line) {
  const res = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      res.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  res.push(cur);
  return res;
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

async function runImport() {
  const dir = 'd:\\zaryah\\supabase_tables';
  for (const item of importSequence) {
    const filePath = path.join(dir, item.file);
    if (!fs.existsSync(filePath)) {
      console.log(`File not found: ${item.file}, skipping.`);
      continue;
    }
    const content = fs.readFileSync(filePath, 'utf8');
    const rows = parseCSV(content);
    if (rows.length === 0) {
      console.log(`Table ${item.table}: 0 rows found.`);
      continue;
    }
    console.log(`Importing ${rows.length} rows into '${item.table}'...`);
    const { data, error } = await supabase.from(item.table).upsert(rows);
    if (error) {
      console.error(`ERROR importing ${item.table}:`, error.message || error);
    } else {
      console.log(`SUCCESS: ${item.table} imported successfully (${rows.length} rows).`);
    }
  }
}

runImport();
