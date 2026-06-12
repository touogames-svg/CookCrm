/**
 * seed_annapurna_flow.js
 *
 * Seeds the Maa Annapurna Rasoi welcome-menu flow directly into Supabase.
 * Run from the wacrm project root:
 *   node seed_annapurna_flow.js
 *
 * The flow is inserted as status='active' so it starts responding
 * to hi/hello messages immediately — no need to activate it manually
 * in the UI.
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// ── Parse .env.local ─────────────────────────────────────────
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

// ── Fetch the existing account and user ─────────────────────
async function run() {
  const { data: profiles } = await supabase.from('profiles').select('*');
  if (!profiles || profiles.length === 0) {
    console.error('No profiles found!');
    process.exit(1);
  }

  const profile = profiles[0];
  const accountId = profile.account_id;
  const userId = profile.user_id;
  console.log(`Using account: ${accountId}, user: ${userId}`);

  // ── Check if the flow already exists ──────────────────────
  const { data: existingFlows } = await supabase
    .from('flows')
    .select('id, name')
    .eq('account_id', accountId)
    .like('name', '%Annapurna%');

  if (existingFlows && existingFlows.length > 0) {
    console.log('Flow already exists:', existingFlows[0].id, existingFlows[0].name);
    console.log('Deleting old flow and nodes...');
    // Delete old nodes and flow
    for (const f of existingFlows) {
      await supabase.from('flow_nodes').delete().eq('flow_id', f.id);
      await supabase.from('flow_runs').delete().eq('flow_id', f.id);
      await supabase.from('flows').delete().eq('id', f.id);
    }
    console.log('Old flow deleted. Re-inserting...');
  }

  // ── Insert the flow row ────────────────────────────────────
  const { data: flow, error: flowErr } = await supabase
    .from('flows')
    .insert({
      user_id: userId,
      account_id: accountId,
      name: 'Maa Annapurna Rasoi — स्वागत मेनू',
      description: 'Maa Annapurna Rasoi का पूरा WhatsApp मेनू — hi/hello पर trigger होता है।',
      status: 'active',
      trigger_type: 'keyword',
      trigger_config: {
        keywords: ['hi', 'hello', 'नमस्ते', 'hey', 'hii', 'helloo'],
        match_type: 'contains',
        case_sensitive: false,
      },
      entry_node_id: 'start',
      fallback_policy: {
        on_unknown_reply: 'reprompt',
        max_reprompts: 2,
        on_timeout_hours: 24,
        on_exhaust: 'handoff',
      },
    })
    .select()
    .single();

  if (flowErr || !flow) {
    console.error('Failed to insert flow:', flowErr);
    process.exit(1);
  }
  console.log('Flow inserted:', flow.id);

  // ── Insert all nodes ───────────────────────────────────────
  const nodes = [
    // ── Start ─────────────────────────────────────────────────
    {
      flow_id: flow.id,
      node_key: 'start',
      node_type: 'start',
      config: { next_node_key: 'welcome_msg' },
    },

    // ── Welcome text ──────────────────────────────────────────
    {
      flow_id: flow.id,
      node_key: 'welcome_msg',
      node_type: 'send_message',
      config: {
        text:
          '🙏 *Maa Annapurna Rasoi* में आपका हृदय से स्वागत है!\n\n' +
          '*"घर जैसा शुद्ध और पौष्टिक भोजन, अब सिर्फ एक क्लिक दूर"*\n\n' +
          'कृपया नीचे दिए गए ऑप्शन मेनू को खोलें और एक विकल्प चुनें 👇',
        next_node_key: 'main_menu',
      },
    },

    // ── Main menu list (10 rows max) ──────────────────────────
    {
      flow_id: flow.id,
      node_key: 'main_menu',
      node_type: 'send_list',
      config: {
        text: '🍱 *Maa Annapurna Rasoi* — हमारी सेवाएं\n\nआप क्या करना चाहते हैं?',
        button_label: 'मेनू देखें',
        footer_text: 'Powered by Maa Annapurna Rasoi 🙏',
        sections: [
          {
            title: '📋 सेवाएं',
            rows: [
              { reply_id: 'opt_1', title: '1️⃣ नया रजिस्ट्रेशन', description: 'Daily/Weekly/Monthly प्लान', next_node_key: 'resp_1' },
              { reply_id: 'opt_2', title: '2️⃣ मील क्रेडिट', description: 'क्रेडिट सिस्टम की जानकारी', next_node_key: 'resp_2' },
              { reply_id: 'opt_3', title: '3️⃣ पॉज/स्किप', description: 'टिफिन रोकें या स्किप करें', next_node_key: 'resp_3' },
              { reply_id: 'opt_4', title: '4️⃣ वीकली मेन्यू', description: 'इस हफ्ते का मेन्यू बोर्ड', next_node_key: 'resp_4' },
              { reply_id: 'opt_5', title: '5️⃣ फोटो/शिकायत', description: 'शिकायत दर्ज करें', next_node_key: 'resp_5' },
            ],
          },
          {
            title: '🍽️ स्पेशल ऑर्डर',
            rows: [
              { reply_id: 'opt_6', title: '6️⃣ एग्जाम स्पेशल', description: 'एग्जाम के लिए विशेष भोजन', next_node_key: 'resp_6' },
              { reply_id: 'opt_7', title: '7️⃣ लेट नाइट स्नैक्स', description: 'रात के स्नैक्स ऑर्डर करें', next_node_key: 'resp_7' },
              { reply_id: 'opt_8', title: '8️⃣ Vegetable Voting', description: 'कल के भोजन के लिए वोट करें', next_node_key: 'resp_8' },
              { reply_id: 'opt_9', title: '9️⃣ आज का टिफिन', description: 'आज का ऑर्डर करें', next_node_key: 'resp_9' },
              { reply_id: 'opt_more', title: '➡️ और विकल्प...', description: 'अतिरिक्त सेवाएं देखें', next_node_key: 'more_menu' },
            ],
          },
        ],
      },
    },

    // ── More options list ─────────────────────────────────────
    {
      flow_id: flow.id,
      node_key: 'more_menu',
      node_type: 'send_list',
      config: {
        text: '🍱 *Maa Annapurna Rasoi* — अतिरिक्त सेवाएं',
        button_label: 'विकल्प देखें',
        footer_text: 'Powered by Maa Annapurna Rasoi 🙏',
        sections: [
          {
            title: '🛒 अधिक विकल्प',
            rows: [
              { reply_id: 'opt_10', title: '🔟 अतिरिक्त आइटम', description: 'Extra items ऑर्डर करें', next_node_key: 'resp_10' },
              { reply_id: 'opt_11', title: '⭐ भोजन रेटिंग', description: 'आज के भोजन की रेटिंग दें', next_node_key: 'resp_11' },
              { reply_id: 'opt_0', title: '0️⃣ मानव सहायता', description: 'Agent से बात करें', next_node_key: 'resp_0' },
              { reply_id: 'opt_back', title: '⬅️ मुख्य मेनू', description: 'मुख्य मेनू पर वापस', next_node_key: 'main_menu' },
            ],
          },
        ],
      },
    },

    // ── Responses ─────────────────────────────────────────────
    {
      flow_id: flow.id, node_key: 'resp_1', node_type: 'send_message',
      config: {
        text:
          '📝 *नया रजिस्ट्रेशन / प्लान जानकारी*\n\n' +
          'हमारे प्लान्स:\n' +
          '• *Daily:* ₹60/दिन — सुबह & शाम\n' +
          '• *Weekly:* ₹380/सप्ताह (7 दिन)\n' +
          '• *Monthly:* ₹1400/माह (30 दिन)\n\n' +
          'रजिस्ट्रेशन के लिए अपना *पूरा नाम, पता और प्लान* टाइप करें — हमारी टीम आपसे जल्द संपर्क करेगी! 🙏',
        next_node_key: 'end',
      },
    },
    {
      flow_id: flow.id, node_key: 'resp_2', node_type: 'send_message',
      config: {
        text:
          '💳 *मील क्रेडिट सिस्टम*\n\n' +
          '• हर 10 मील पर 1 फ्री मील का क्रेडिट मिलता है\n' +
          '• क्रेडिट 30 दिनों तक valid रहते हैं\n' +
          '• क्रेडिट balance जानने के लिए \'CREDIT\' टाइप करें\n\n' +
          'अपना balance जानने के लिए हमारी टीम से संपर्क करें। 🙏',
        next_node_key: 'end',
      },
    },
    {
      flow_id: flow.id, node_key: 'resp_3', node_type: 'send_message',
      config: {
        text:
          '⏸️ *पॉज / स्किप फीचर*\n\n' +
          '• *Pause:* अपनी सब्सक्रिप्शन को 1-7 दिन के लिए pause करें\n' +
          '• *Skip:* सिर्फ एक दिन की डिलीवरी skip करें\n\n' +
          'Pause/Skip के लिए कम से कम *1 दिन पहले* सुबह 10 बजे तक सूचित करें।\n\n' +
          'Format: PAUSE [तारीख से] [तारीख तक]\nExample: PAUSE 12-Jun 15-Jun 🙏',
        next_node_key: 'end',
      },
    },
    {
      flow_id: flow.id, node_key: 'resp_4', node_type: 'send_message',
      config: {
        text:
          '📋 *वीकली मेन्यू बोर्ड*\n\n' +
          'इस हफ्ते का मेनू जल्द ही शेयर किया जाएगा! 🍽️\n\n' +
          'हर सोमवार को हम इस हफ्ते का पूरा मेनू WhatsApp पर भेजते हैं।\n\n' +
          'हमारे साथ बने रहें — घर जैसा शुद्ध और स्वादिष्ट भोजन! 🙏',
        next_node_key: 'end',
      },
    },
    {
      flow_id: flow.id, node_key: 'resp_5', node_type: 'send_message',
      config: {
        text:
          '📸 *फोटो अपलोड / शिकायत*\n\n' +
          'कोई समस्या है? हम सुनना चाहते हैं!\n\n' +
          '• अपने भोजन की फोटो यहाँ भेजें\n' +
          '• या अपनी शिकायत लिखें\n\n' +
          'हमारी टीम 2 घंटे के अंदर जवाब देगी। आपकी संतुष्टि हमारी प्राथमिकता है! 🙏',
        next_node_key: 'end',
      },
    },
    {
      flow_id: flow.id, node_key: 'resp_6', node_type: 'send_message',
      config: {
        text:
          '📚 *एग्जाम स्पेशल मील*\n\n' +
          'परीक्षा के दौरान विशेष पौष्टिक भोजन:\n\n' +
          '• 🧠 Brain Booster Thali — ड्राई फ्रूट्स, दही, हरी सब्जी\n' +
          '• 💪 Energy Pack — पराठा, पनीर, फल\n' +
          '• 🌙 Night Study Pack — हल्का & पौष्टिक\n\n' +
          'ऑर्डर के लिए \'EXAM\' + तारीख + समय टाइप करें।\nExample: EXAM 15-Jun 7pm 🙏',
        next_node_key: 'end',
      },
    },
    {
      flow_id: flow.id, node_key: 'resp_7', node_type: 'send_message',
      config: {
        text:
          '🌙 *लेट नाइट स्नैक्स*\n\n' +
          'रात 9 बजे से 12 बजे तक उपलब्ध:\n\n' +
          '• 🥗 Maggi/Noodles — ₹40\n' +
          '• 🧆 Bread Pakoda — ₹30\n' +
          '• ☕ Chai + Biscuits — ₹20\n' +
          '• 🌽 Sweet Corn — ₹35\n\n' +
          'ऑर्डर के लिए अपना Item + Quantity + Address टाइप करें! 🙏',
        next_node_key: 'end',
      },
    },
    {
      flow_id: flow.id, node_key: 'resp_8', node_type: 'send_message',
      config: {
        text:
          '🗳️ *Vegetable Voting — कल के भोजन का चयन*\n\n' +
          'कल के टिफिन के लिए अपनी पसंद का कॉम्बिनेशन चुनें। नीचे से एक नंबर टाइप करें:\n\n' +
          '1. 🍲 पनीर दो प्याजा + सूखी गोभी गाजर (Veg + Veg)\n' +
          '2. 🫑 कढ़ाई पनीर + आलू शिमला मिर्च (Veg + Veg)\n' +
          '3. 🥣 दाल फ्राई + भुना मसाला बैंगन (Dal + Veg)\n' +
          '4. 🥣 दाल तड़का + भिंडी दो प्याजा (Dal + Veg)\n' +
          '5. 🥣 दाल मखनी + आलू जीरा (Dal + Veg)\n\n' +
          'रात 8 बजे तक वोट करें — सबसे ज्यादा वोट वाले कॉम्बिनेशन को कल के मेनू में शामिल किया जाएगा! 🙏',
        next_node_key: 'end',
      },
    },
    {
      flow_id: flow.id, node_key: 'resp_9', node_type: 'send_message',
      config: {
        text:
          '🥡 *आज का टिफिन ऑर्डर*\n\n' +
          '⚠️ Note: ऑर्डर सुबह 9 बजे तक complete करें\n\n' +
          'आज का मेनू:\n' +
          '• 🍱 दाल, चावल, रोटी, सब्जी — ₹60\n' +
          '• 🍛 राजमा चावल Special — ₹70\n' +
          '• 🥗 Veg Thali Full — ₹80\n\n' +
          'ऑर्डर के लिए: Item + Quantity + Delivery Address टाइप करें\n\nजय माँ अन्नपूर्णा! 🙏',
        next_node_key: 'end',
      },
    },
    {
      flow_id: flow.id, node_key: 'resp_10', node_type: 'send_message',
      config: {
        text:
          '🛒 *अतिरिक्त आइटम ऑर्डर*\n\n' +
          'अपनी Regular Tiffin के साथ Extra items ऑर्डर करें:\n\n' +
          '• 🥛 Lassi/Buttermilk — ₹25\n' +
          '• 🫓 Extra Roti (4 pcs) — ₹20\n' +
          '• 🥗 Salad — ₹15\n' +
          '• 🍮 Mithai/Sweet — ₹30\n' +
          '• 🥤 Fresh Juice — ₹40\n\n' +
          'Item + Quantity टाइप करें और हम आपके टिफिन के साथ भेजेंगे! 🙏',
        next_node_key: 'end',
      },
    },
    {
      flow_id: flow.id, node_key: 'resp_11', node_type: 'send_message',
      config: {
        text:
          '⭐ *आज के भोजन की रेटिंग*\n\n' +
          'आपका फीडबैक हमारे लिए बहुत important है!\n\n' +
          '1️⃣ ⭐ — बेहतर हो सकता था\n' +
          '2️⃣ ⭐⭐ — ठीक था\n' +
          '3️⃣ ⭐⭐⭐ — अच्छा था\n' +
          '4️⃣ ⭐⭐⭐⭐ — बहुत अच्छा!\n' +
          '5️⃣ ⭐⭐⭐⭐⭐ — लाजवाब!\n\n' +
          'कृपया 1 से 5 के बीच नंबर भेजें + कोई सुझाव हो तो जरूर लिखें! 🙏',
        next_node_key: 'end',
      },
    },

    // ── Option 0 — Human handoff ──────────────────────────────
    {
      flow_id: flow.id,
      node_key: 'resp_0',
      node_type: 'handoff',
      config: {
        note: 'Customer ने मानव सहायता (Option 0) चुना है। कृपया जल्द से जल्द जवाब दें।',
      },
    },

    // ── End node ──────────────────────────────────────────────
    {
      flow_id: flow.id,
      node_key: 'end',
      node_type: 'end',
      config: {},
    },
  ];

  const { error: nodesErr } = await supabase.from('flow_nodes').insert(nodes);
  if (nodesErr) {
    console.error('Failed to insert nodes:', nodesErr);
    // Roll back the flow
    await supabase.from('flows').delete().eq('id', flow.id);
    process.exit(1);
  }

  console.log(`✅ Flow seeded successfully!`);
  console.log(`   Flow ID: ${flow.id}`);
  console.log(`   Status: active`);
  console.log(`   Trigger: hi, hello, नमस्ते, hey (keyword contains)`);
  console.log(`   Nodes: ${nodes.length} nodes inserted`);
  console.log('');
  console.log('📱 Test: Send "hi" or "hello" to your WhatsApp number!');
}

run().catch(e => { console.error(e); process.exit(1); });
