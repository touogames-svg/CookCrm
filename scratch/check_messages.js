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
  console.log('--- Checking latest 5 messages ---');
  const { data: messages, error } = await supabase
    .from('messages')
    .select('id, content_text, sender_type, content_type, created_at')
    .order('created_at', { ascending: false })
    .limit(5);
  
  if (error) console.error(error);
  else console.log(messages);
}

check().catch(console.error);
