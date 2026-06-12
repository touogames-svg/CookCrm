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
  console.log('--- Checking automation steps ---');
  const { data: steps, error } = await supabase
    .from('automation_steps')
    .select('*')
    .eq('automation_id', '3e83b63a-faff-41fd-b360-516229271be7')
    .order('position', { ascending: true });
  
  if (error) console.error(error);
  else console.log(JSON.stringify(steps, null, 2));
}

check().catch(console.error);
