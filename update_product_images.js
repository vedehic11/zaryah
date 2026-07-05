const { createClient } = require(require('path').join(process.cwd(), 'node_modules', '@supabase', 'supabase-js'));
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

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL || 'https://hempwoejqsozszwgkbjp.supabase.co';
const serviceRoleKey = envVars.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceRoleKey);

const imagePool = {
  'Crochet': [
    'https://images.unsplash.com/photo-1584992236310-6edddc08acff?w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1615233500042-19e917d5e490?w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1606760227091-3dd850d97f1d?w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=800&auto=format&fit=crop'
  ],
  'Resin Art': [
    'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1544816155-12df9643f363?w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1563089145-599997674d42?w=800&auto=format&fit=crop'
  ],
  'Candles': [
    'https://images.unsplash.com/photo-1603006905003-be475563bc59?w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1605651202774-7d573fd3f12d?w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=800&auto=format&fit=crop'
  ],
  'Jewelry': [
    'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1611591475777-233ca732222e?w=800&auto=format&fit=crop'
  ],
  'Home Decor': [
    'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?w=800&auto=format&fit=crop'
  ],
  'Painting': [
    'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=800&auto=format&fit=crop'
  ],
  'Paper Crafts': [
    'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=800&auto=format&fit=crop'
  ],
  'Embroidery': [
    'https://images.unsplash.com/photo-1584992236310-6edddc08acff?w=800&auto=format&fit=crop'
  ],
  'Default': [
    'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1512909006721-3d6018887383?w=800&auto=format&fit=crop'
  ]
};

async function updateProductImages() {
  console.log("Fetching all products...");
  const { data: products, error } = await supabase.from('products').select('id, name, category, images');
  if (error) {
    console.error("Error fetching products:", error);
    return;
  }

  console.log(`Updating images for ${products.length} products...`);
  let count = 0;
  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    const catPool = imagePool[p.category] || imagePool['Default'];
    const primaryImg = catPool[i % catPool.length];
    const secondaryImg = catPool[(i + 1) % catPool.length];

    const newImages = [primaryImg, secondaryImg];
    const { error: updateErr } = await supabase.from('products').update({ images: newImages }).eq('id', p.id);
    if (updateErr) {
      console.error(`Error updating product ${p.id}:`, updateErr);
    } else {
      count++;
    }
  }

  console.log(`SUCCESSFULLY UPDATED ${count} PRODUCT IMAGES!`);
}

updateProductImages();
