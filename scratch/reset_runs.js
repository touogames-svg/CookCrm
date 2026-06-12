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

async function reset() {
  console.log('--- Deleting all active flow runs to allow a fresh start ---');
  const { data, error } = await supabase
    .from('flow_runs')
    .delete()
    .eq('status', 'active');
  
  if (error) {
    console.error('Error deleting runs:', error);
  } else {
    console.log('Successfully deleted active runs:', data);
  }
}

reset().catch(console.error);
