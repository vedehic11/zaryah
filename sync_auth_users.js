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

const DEFAULT_PASSWORD = 'ZaryahUser@123';

async function syncAuthUsers() {
  console.log("Fetching all users from public.users...");
  const { data: publicUsers, error } = await supabase.from('users').select('id, email, name, user_type, supabase_auth_id');
  if (error) {
    console.error("Error fetching public.users:", error);
    return;
  }

  console.log(`Found ${publicUsers.length} user records in public.users.`);

  const { data: authData } = await supabase.auth.admin.listUsers();
  const existingAuthEmails = new Set((authData?.users || []).map(u => u.email.toLowerCase()));

  let createdCount = 0;
  let updatedCount = 0;

  for (const u of publicUsers) {
    if (!u.email) continue;
    const emailLower = u.email.toLowerCase();

    if (!existingAuthEmails.has(emailLower)) {
      console.log(`Creating Auth user for: ${u.email}...`);
      const { data: createdAuth, error: createErr } = await supabase.auth.admin.createUser({
        email: u.email,
        password: DEFAULT_PASSWORD,
        email_confirm: true,
        user_metadata: { name: u.name, user_type: u.user_type }
      });

      if (createErr) {
        console.error(`Error creating auth user ${u.email}:`, createErr.message);
      } else if (createdAuth?.user) {
        createdCount++;
        // Update public.users.supabase_auth_id to link with new auth ID
        await supabase.from('users').update({
          supabase_auth_id: createdAuth.user.id,
          is_verified: true,
          is_approved: true
        }).eq('id', u.id);
        console.log(`SUCCESS: Linked ${u.email} -> auth_id: ${createdAuth.user.id}`);
      }
    } else {
      // Find existing auth user and link
      const existingUser = authData.users.find(au => au.email.toLowerCase() === emailLower);
      if (existingUser) {
        await supabase.from('users').update({
          supabase_auth_id: existingUser.id,
          is_verified: true,
          is_approved: true
        }).eq('id', u.id);
        updatedCount++;
      }
    }
  }

  console.log(`\n========================================`);
  console.log(`AUTH SYNC COMPLETE!`);
  console.log(`Created ${createdCount} auth accounts.`);
  console.log(`Linked ${updatedCount} existing auth accounts.`);
  console.log(`Default login password for imported users: ${DEFAULT_PASSWORD}`);
  console.log(`========================================\n`);
}

syncAuthUsers();
