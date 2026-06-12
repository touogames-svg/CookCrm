const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envFile = fs.readFileSync('/Users/arunyadav/Desktop/wacrm/.env.local', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match && !line.trim().startsWith('#')) {
    env[match[1]] = (match[2] || '').trim();
  }
});

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  console.log('--- Checking active automations ---');
  const { data: automations, error: autoErr } = await supabase
    .from('automations')
    .select('id, name, is_active, trigger_type')
    .eq('is_active', true);
  if (autoErr) console.error(autoErr);
  else console.log(automations);

  console.log('--- Checking WhatsApp configurations ---');
  const { data: configs, error: configErr } = await supabase
    .from('whatsapp_config')
    .select('id, phone_number_id, status, verify_token');
  if (configErr) console.error(configErr);
  else {
    configs.forEach(c => {
      console.log({
        id: c.id,
        phone_number_id: c.phone_number_id,
        status: c.status,
        verify_token_len: c.verify_token ? c.verify_token.length : 0
      });
    });
  }
}

check().catch(console.error);
