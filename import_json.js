const fs = require('fs');
const path = require('path');
const { parseRFC4180 } = require('./rfc4180_parser');

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

async function runJsonImport() {
  const dir = 'd:\\zaryah\\supabase_tables';
  for (const item of importSequence) {
    const filePath = path.join(dir, item.file);
    if (!fs.existsSync(filePath)) continue;
    
    const csvContent = fs.readFileSync(filePath, 'utf8');
    let objects = parseRFC4180(csvContent);
    if (objects.length === 0) continue;
    
    if (item.table === 'addresses') {
      objects.forEach(o => {
        if (!o.state) o.state = 'Maharashtra';
        if (!o.city) o.city = 'Mumbai';
      });
    } else if (item.table === 'orders') {
      const allowed = ['id', 'buyer_id', 'seller_id', 'total_amount', 'status', 'payment_method', 'payment_status', 'payment_id', 'razorpay_order_id', 'razorpay_payment_id', 'address', 'notes', 'shipment_id', 'shipment_status', 'awb_code', 'courier_name', 'tracking_url', 'delivery_fee', 'gift_packaging_fee', 'platform_fee', 'commission_amount', 'seller_amount', 'two_way_delivery', 'wallet_credited', 'created_at', 'updated_at'];
      objects = objects.map(o => {
        const clean = {};
        allowed.forEach(k => { if (o[k] !== undefined) clean[k] = o[k]; });
        return clean;
      });
    } else if (item.table === 'withdrawal_requests') {
      const allowed = ['id', 'seller_id', 'amount', 'status', 'upi_id', 'bank_details', 'payout_mode', 'manual_transaction_id', 'razorpay_payout_id', 'failure_reason', 'processed_at', 'processed_by', 'transaction_id', 'created_at', 'updated_at'];
      objects = objects.map(o => {
        if (o.status === 'completed') o.status = 'approved';
        const clean = {};
        allowed.forEach(k => { if (o[k] !== undefined) clean[k] = o[k]; });
        return clean;
      });
    }

    console.log(`Upserting ${objects.length} clean RFC4180 records into '${item.table}'...`);
    const { data, error } = await supabase.from(item.table).upsert(objects);
    
    if (error) {
      console.error(`ERROR on ${item.table}:`, error.message || error);
    } else {
      console.log(`SUCCESS: ${item.table} (${objects.length} records) imported!`);
    }
  }
}

runJsonImport();
