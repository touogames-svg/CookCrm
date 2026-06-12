const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase URL or Key in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDb() {
  console.log('--- WHATSAPP CONFIG ---');
  const { data: configs, error: configErr } = await supabase
    .from('whatsapp_config')
    .select('*');

  if (configErr) {
    console.error('Error fetching whatsapp_config:', configErr);
  } else {
    console.log(JSON.stringify(configs, null, 2));
  }

  console.log('\n--- ACTIVE FLOWS ---');
  const { data: flows, error: flowsErr } = await supabase
    .from('flows')
    .select('*');

  if (flowsErr) {
    console.error('Error fetching flows:', flowsErr);
  } else {
    console.log(JSON.stringify(flows, null, 2));
  }

  console.log('\n--- AUTOMATIONS ---');
  const { data: automations, error: autoErr } = await supabase
    .from('automations')
    .select('*');

  if (autoErr) {
    console.error('Error fetching automations:', autoErr);
  } else {
    console.log(JSON.stringify(automations, null, 2));
  }

  console.log('\n--- RECENT FLOW RUNS ---');
  const { data: runs, error: runsErr } = await supabase
    .from('flow_runs')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(5);

  if (runsErr) {
    console.error('Error fetching flow_runs:', runsErr);
  } else {
    console.log(JSON.stringify(runs, null, 2));
  }
}

checkDb().catch(console.error);
