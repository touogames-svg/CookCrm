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
  console.log('--- Checking active flows ---');
  const { data: flows, error: flowsErr } = await supabase
    .from('flows')
    .select('id, name, status, trigger_type, trigger_config')
    .eq('status', 'active');
  if (flowsErr) console.error(flowsErr);
  else console.log(flows);

  console.log('--- Checking active flow runs ---');
  const { data: runs, error: runsErr } = await supabase
    .from('flow_runs')
    .select('id, flow_id, contact_id, status, current_node_key, vars')
    .eq('status', 'active');
  if (runsErr) console.error(runsErr);
  else console.log(runs);

  console.log('--- Checking active automations ---');
  const { data: automations, error: autoErr } = await supabase
    .from('automations')
    .select('id, name, status, trigger_type');
  if (autoErr) console.error(autoErr);
  else console.log(automations);
}

check().catch(console.error);
