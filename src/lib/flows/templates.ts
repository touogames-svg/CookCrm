/**
 * Starter flow templates.
 *
 * Three pre-canned flows users can clone with one click instead of
 * building from scratch. Each template is a plain JS object describing
 * the same shape `/api/flows` PUT accepts — name, trigger config,
 * entry_node_id, fallback_policy, nodes[] — keyed by a stable
 * `slug`.
 *
 * The clone path (`/api/flows` POST with `template_slug`) creates a
 * NEW flow_row + flow_nodes rows for the user. `node_key`s are kept
 * verbatim (they're stable strings, not UUIDs, so cloning never
 * needs to rewrite edge references).
 *
 * Choosing a single static module over a DB-backed gallery for v1
 * because: (a) the set is small and changes with code releases, not
 * data; (b) keeps templates portable across self-hosted instances
 * without migrations; (c) editing in source is the lowest-friction
 * way to add the next template.
 */

import type {
  CollectInputNodeConfig,
  ConditionNodeConfig,
  HandoffNodeConfig,
  KeywordTriggerConfig,
  SendButtonsNodeConfig,
  SendListNodeConfig,
  SendMessageNodeConfig,
  StartNodeConfig,
} from "./types";

export type FlowTemplateNodeType =
  | "start"
  | "send_message"
  | "send_buttons"
  | "send_list"
  | "collect_input"
  | "condition"
  | "set_tag"
  | "handoff"
  | "end";

export interface FlowTemplateNode {
  node_key: string;
  node_type: FlowTemplateNodeType;
  config:
    | StartNodeConfig
    | SendMessageNodeConfig
    | SendButtonsNodeConfig
    | SendListNodeConfig
    | CollectInputNodeConfig
    | ConditionNodeConfig
    | HandoffNodeConfig
    | Record<string, unknown>;
}

export interface FlowTemplate {
  slug: string;
  name: string;
  description: string;
  /** Used by the gallery to surface a relevant icon. lucide-react name. */
  icon: "MessageSquare" | "HelpCircle" | "UserPlus";
  trigger_type: "keyword" | "first_inbound_message" | "manual";
  trigger_config: KeywordTriggerConfig | Record<string, unknown>;
  entry_node_id: string;
  nodes: FlowTemplateNode[];
}

// ============================================================
// 1. Welcome menu — the example from the owner's brief
// ============================================================
const WELCOME_MENU: FlowTemplate = {
  slug: "welcome_menu",
  name: "Welcome menu",
  description:
    "Greet customers who type a keyword and route them to the right agent based on whether they're new or existing.",
  icon: "MessageSquare",
  trigger_type: "keyword",
  trigger_config: { keywords: ["support", "help", "hi"], match_type: "contains" },
  entry_node_id: "start",
  nodes: [
    {
      node_key: "start",
      node_type: "start",
      config: { next_node_key: "welcome" },
    },
    {
      node_key: "welcome",
      node_type: "send_buttons",
      config: {
        text: "Hi! 👋 Welcome to support. Are you an existing customer or new here?",
        footer_text: "Tap a button below to continue.",
        buttons: [
          {
            reply_id: "existing",
            title: "Existing customer",
            next_node_key: "existing_handoff",
          },
          {
            reply_id: "new",
            title: "New customer",
            next_node_key: "new_handoff",
          },
        ],
      } as SendButtonsNodeConfig,
    },
    {
      node_key: "existing_handoff",
      node_type: "handoff",
      config: {
        note: "Existing customer needs assistance — please check account history before replying.",
      } as HandoffNodeConfig,
    },
    {
      node_key: "new_handoff",
      node_type: "handoff",
      config: {
        note: "New customer — share pricing + onboarding link.",
      } as HandoffNodeConfig,
    },
  ],
};

// ============================================================
// 2. FAQ bot — list-message answers, fully automated
// ============================================================
const FAQ_BOT: FlowTemplate = {
  slug: "faq_bot",
  name: "FAQ bot",
  description:
    "Answer common questions automatically. Customer picks a topic from a list; the bot replies with the answer and ends.",
  icon: "HelpCircle",
  trigger_type: "keyword",
  trigger_config: {
    keywords: ["faq", "question", "info"],
    match_type: "contains",
  },
  entry_node_id: "start",
  nodes: [
    {
      node_key: "start",
      node_type: "start",
      config: { next_node_key: "topics" },
    },
    {
      node_key: "topics",
      node_type: "send_list",
      config: {
        text: "What can I help you with?",
        button_label: "View topics",
        sections: [
          {
            title: "Common questions",
            rows: [
              {
                reply_id: "hours",
                title: "Opening hours",
                next_node_key: "answer_hours",
              },
              {
                reply_id: "pricing",
                title: "Pricing",
                next_node_key: "answer_pricing",
              },
              {
                reply_id: "refunds",
                title: "Refund policy",
                next_node_key: "answer_refunds",
              },
            ],
          },
          {
            title: "Other",
            rows: [
              {
                reply_id: "human",
                title: "Talk to a human",
                next_node_key: "human_handoff",
              },
            ],
          },
        ],
      } as SendListNodeConfig,
    },
    {
      node_key: "answer_hours",
      node_type: "send_message",
      config: {
        text: "We're open Mon–Fri, 9am–6pm local time. Weekend support is limited to urgent issues.",
        next_node_key: "end",
      } as SendMessageNodeConfig,
    },
    {
      node_key: "answer_pricing",
      node_type: "send_message",
      config: {
        text: "Our pricing starts at $9/mo. Visit https://example.com/pricing for the full breakdown.",
        next_node_key: "end",
      } as SendMessageNodeConfig,
    },
    {
      node_key: "answer_refunds",
      node_type: "send_message",
      config: {
        text: "Refunds are honored within 30 days of purchase. Reply with your order number and we'll process it.",
        next_node_key: "end",
      } as SendMessageNodeConfig,
    },
    {
      node_key: "human_handoff",
      node_type: "handoff",
      config: {
        note: "Customer asked to talk to a human from the FAQ bot.",
      } as HandoffNodeConfig,
    },
    {
      node_key: "end",
      node_type: "end",
      config: {},
    },
  ],
};

// ============================================================
// 3. Lead capture — collect_input chain, ends in a handoff
// ============================================================
const LEAD_CAPTURE: FlowTemplate = {
  slug: "lead_capture",
  name: "Lead capture",
  description:
    "Greet first-time inbounds, capture name + email + company, then hand off to sales with the answers in the note.",
  icon: "UserPlus",
  trigger_type: "first_inbound_message",
  trigger_config: {},
  entry_node_id: "start",
  nodes: [
    {
      node_key: "start",
      node_type: "start",
      config: { next_node_key: "intro" },
    },
    {
      node_key: "intro",
      node_type: "send_message",
      config: {
        text: "Welcome! 👋 I'll ask a few quick questions so we can get you to the right person.",
        next_node_key: "ask_name",
      } as SendMessageNodeConfig,
    },
    {
      node_key: "ask_name",
      node_type: "collect_input",
      config: {
        prompt_text: "What's your name?",
        var_key: "name",
        next_node_key: "ask_email",
      } as CollectInputNodeConfig,
    },
    {
      node_key: "ask_email",
      node_type: "collect_input",
      config: {
        prompt_text: "Thanks {{vars.name}}! What's your work email?",
        var_key: "email",
        next_node_key: "ask_company",
      } as CollectInputNodeConfig,
    },
    {
      node_key: "ask_company",
      node_type: "collect_input",
      config: {
        prompt_text: "Almost done — what's your company name?",
        var_key: "company",
        next_node_key: "handoff",
      } as CollectInputNodeConfig,
    },
    {
      node_key: "handoff",
      node_type: "handoff",
      config: {
        note: "New lead — name={{vars.name}}, email={{vars.email}}, company={{vars.company}}.",
      } as HandoffNodeConfig,
    },
  ],
};

// ============================================================
// 4. Maa Annapurna Rasoi — Full Hindi menu with 12 options
// ============================================================
//
// Flow architecture:
//   start → welcome_msg → main_menu (send_list, 10 rows: 1-9 + more)
//   "more" row → more_menu (send_list, rows: 10, 11, 0)
//   Every option row → a response send_message → end
//   Option 0 (support) → handoff
//
const MAA_ANNAPURNA_RASOI: FlowTemplate = {
  slug: "maa_annapurna_rasoi",
  name: "Maa Annapurna Rasoi — स्वागत मेनू",
  description:
    "Maa Annapurna Rasoi का पूरा WhatsApp मेनू — रजिस्ट्रेशन, मील क्रेडिट, पॉज/स्किप, मेन्यू बोर्ड, शिकायत, एग्जाम मील, स्नैक्स, वोटिंग, ऑर्डर, रेटिंग और सपोर्ट।",
  icon: "MessageSquare",
  trigger_type: "keyword",
  trigger_config: {
    keywords: ["hi", "hello", "नमस्ते", "hey", "hii", "helloo"],
    match_type: "contains",
    case_sensitive: false,
  } as KeywordTriggerConfig,
  entry_node_id: "start",
  nodes: [
    // ── Start node ──────────────────────────────────────────
    {
      node_key: "start",
      node_type: "start",
      config: { next_node_key: "welcome_msg" } as StartNodeConfig,
    },

    // ── Welcome text ─────────────────────────────────────────
    {
      node_key: "welcome_msg",
      node_type: "send_message",
      config: {
        text:
          "🙏 *Maa Annapurna Rasoi* में आपका हृदय से स्वागत है!\n\n" +
          "*\"घर जैसा शुद्ध और पौष्टिक भोजन, अब सिर्फ एक क्लिक दूर\"*\n\n" +
          "कृपया नीचे दिए गए ऑप्शन मेनू को खोलें और एक विकल्प चुनें 👇",
        next_node_key: "main_menu",
      } as SendMessageNodeConfig,
    },

    // ── Main menu list (options 1–9 + "और विकल्प") ──────────
    // Meta cap: 10 rows total across all sections.
    {
      node_key: "main_menu",
      node_type: "send_list",
      config: {
        text: "🍱 *Maa Annapurna Rasoi* — हमारी सेवाएं\n\nआप क्या करना चाहते हैं?",
        button_label: "मेनू देखें",
        footer_text: "Powered by Maa Annapurna Rasoi 🙏",
        sections: [
          {
            title: "📋 सेवाएं",
            rows: [
              {
                reply_id: "opt_1",
                title: "1️⃣ नया रजिस्ट्रेशन",
                description: "Daily/Weekly/Monthly प्लान देखें",
                next_node_key: "resp_1",
              },
              {
                reply_id: "opt_2",
                title: "2️⃣ मील क्रेडिट",
                description: "क्रेडिट सिस्टम की जानकारी",
                next_node_key: "resp_2",
              },
              {
                reply_id: "opt_3",
                title: "3️⃣ पॉज/स्किप",
                description: "टिफिन रोकें या स्किप करें",
                next_node_key: "resp_3",
              },
              {
                reply_id: "opt_4",
                title: "4️⃣ वीकली मेन्यू",
                description: "इस हफ्ते का मेन्यू बोर्ड",
                next_node_key: "resp_4",
              },
              {
                reply_id: "opt_5",
                title: "5️⃣ फोटो/शिकायत",
                description: "फोटो अपलोड या शिकायत दर्ज करें",
                next_node_key: "resp_5",
              },
            ],
          },
          {
            title: "🍽️ स्पेशल ऑर्डर",
            rows: [
              {
                reply_id: "opt_6",
                title: "6️⃣ एग्जाम स्पेशल",
                description: "एग्जाम के लिए विशेष भोजन",
                next_node_key: "resp_6",
              },
              {
                reply_id: "opt_7",
                title: "7️⃣ लेट नाइट स्नैक्स",
                description: "रात के स्नैक्स ऑर्डर करें",
                next_node_key: "resp_7",
              },
              {
                reply_id: "opt_8",
                title: "8️⃣ कल की सब्जी वोट",
                description: "कल की सब्जी के लिए वोट दें",
                next_node_key: "resp_8",
              },
              {
                reply_id: "opt_9",
                title: "9️⃣ आज का टिफिन",
                description: "आज का ऑर्डर करें",
                next_node_key: "resp_9",
              },
              {
                reply_id: "opt_more",
                title: "➡️ और विकल्प...",
                description: "अतिरिक्त सेवाएं देखें",
                next_node_key: "more_menu",
              },
            ],
          },
        ],
      } as SendListNodeConfig,
    },

    // ── More options list (options 10, 11, 0) ────────────────
    {
      node_key: "more_menu",
      node_type: "send_list",
      config: {
        text: "🍱 *Maa Annapurna Rasoi* — अतिरिक्त सेवाएं",
        button_label: "विकल्प देखें",
        footer_text: "Powered by Maa Annapurna Rasoi 🙏",
        sections: [
          {
            title: "🛒 अधिक विकल्प",
            rows: [
              {
                reply_id: "opt_10",
                title: "🔟 अतिरिक्त आइटम",
                description: "Extra items ऑर्डर करें",
                next_node_key: "resp_10",
              },
              {
                reply_id: "opt_11",
                title: "1️⃣1️⃣ भोजन रेटिंग",
                description: "आज के भोजन की रेटिंग दें",
                next_node_key: "resp_11",
              },
              {
                reply_id: "opt_0",
                title: "0️⃣ मानव सहायता",
                description: "Agent से बात करें",
                next_node_key: "resp_0",
              },
              {
                reply_id: "opt_back",
                title: "⬅️ मुख्य मेनू",
                description: "मुख्य मेनू पर वापस जाएं",
                next_node_key: "main_menu",
              },
            ],
          },
        ],
      } as SendListNodeConfig,
    },

    // ── Option responses ─────────────────────────────────────
    {
      node_key: "resp_1",
      node_type: "send_message",
      config: {
        text:
          "📝 *नया रजिस्ट्रेशन / प्लान जानकारी*\n\n" +
          "हमारे प्लान्स:\n" +
          "• *Daily:* ₹60/दिन — सुबह & शाम\n" +
          "• *Weekly:* ₹380/सप्ताह (7 दिन)\n" +
          "• *Monthly:* ₹1400/माह (30 दिन)\n\n" +
          "रजिस्ट्रेशन के लिए अपना *पूरा नाम, पता और प्लान* टाइप करें — हमारी टीम आपसे जल्द संपर्क करेगी! 🙏",
        next_node_key: "end",
      } as SendMessageNodeConfig,
    },
    {
      node_key: "resp_2",
      node_type: "send_message",
      config: {
        text:
          "💳 *मील क्रेडिट सिस्टम*\n\n" +
          "• हर 10 मील पर 1 फ्री मील का क्रेडिट मिलता है\n" +
          "• क्रेडिट 30 दिनों तक valid रहते हैं\n" +
          "• क्रेडिट balance जानने के लिए 'CREDIT' टाइप करें\n\n" +
          "अपना balance जानने के लिए हमारी टीम से संपर्क करें। 🙏",
        next_node_key: "end",
      } as SendMessageNodeConfig,
    },
    {
      node_key: "resp_3",
      node_type: "send_message",
      config: {
        text:
          "⏸️ *पॉज / स्किप फीचर*\n\n" +
          "• *Pause:* अपनी सब्सक्रिप्शन को 1-7 दिन के लिए pause करें\n" +
          "• *Skip:* सिर्फ एक दिन की डिलीवरी skip करें\n\n" +
          "Pause/Skip के लिए कम से कम *1 दिन पहले* सुबह 10 बजे तक सूचित करें।\n\n" +
          "Format: PAUSE [तारीख से] [तारीख तक]\nExample: PAUSE 12-Jun 15-Jun 🙏",
        next_node_key: "end",
      } as SendMessageNodeConfig,
    },
    {
      node_key: "resp_4",
      node_type: "send_message",
      config: {
        text:
          "📋 *वीकली मेन्यू बोर्ड*\n\n" +
          "इस हफ्ते का मेनू जल्द ही शेयर किया जाएगा! 🍽️\n\n" +
          "हर सोमवार को हम इस हफ्ते का पूरा मेनू WhatsApp पर भेजते हैं।\n\n" +
          "हमारे साथ बने रहें — घर जैसा शुद्ध और स्वादिष्ट भोजन! 🙏",
        next_node_key: "end",
      } as SendMessageNodeConfig,
    },
    {
      node_key: "resp_5",
      node_type: "send_message",
      config: {
        text:
          "📸 *फोटो अपलोड / शिकायत*\n\n" +
          "कोई समस्या है? हम सुनना चाहते हैं!\n\n" +
          "• अपने भोजन की फोटो यहाँ भेजें\n" +
          "• या अपनी शिकायत लिखें\n\n" +
          "हमारी टीम 2 घंटे के अंदर जवाब देगी। आपकी संतुष्टि हमारी प्राथमिकता है! 🙏",
        next_node_key: "end",
      } as SendMessageNodeConfig,
    },
    {
      node_key: "resp_6",
      node_type: "send_message",
      config: {
        text:
          "📚 *एग्जाम स्पेशल मील*\n\n" +
          "परीक्षा के दौरान विशेष पौष्टिक भोजन:\n\n" +
          "• 🧠 Brain Booster Thali — ड्राई फ्रूट्स, दही, हरी सब्जी\n" +
          "• 💪 Energy Pack — पराठा, पनीर, फल\n" +
          "• 🌙 Night Study Pack — हल्का & पौष्टिक\n\n" +
          "ऑर्डर के लिए 'EXAM' + तारीख + समय टाइप करें।\nExample: EXAM 15-Jun 7pm 🙏",
        next_node_key: "end",
      } as SendMessageNodeConfig,
    },
    {
      node_key: "resp_7",
      node_type: "send_message",
      config: {
        text:
          "🌙 *लेट नाइट स्नैक्स*\n\n" +
          "रात 9 बजे से 12 बजे तक उपलब्ध:\n\n" +
          "• 🥗 Maggi/Noodles — ₹40\n" +
          "• 🧆 Bread Pakoda — ₹30\n" +
          "• ☕ Chai + Biscuits — ₹20\n" +
          "• 🌽 Sweet Corn — ₹35\n\n" +
          "ऑर्डर के लिए अपना Item + Quantity + Address टाइप करें! 🙏",
        next_node_key: "end",
      } as SendMessageNodeConfig,
    },
    {
      node_key: "resp_8",
      node_type: "send_message",
      config: {
        text:
          "🗳️ *कल की सब्जी के लिए वोट करें*\n\n" +
          "आपकी पसंद क्या है? नीचे से एक नंबर टाइप करें:\n\n" +
          "1. 🥔 आलू-टमाटर\n" +
          "2. 🌶️ मटर-पनीर\n" +
          "3. 🍆 बैंगन भर्ता\n" +
          "4. 🥬 पालक-दाल\n" +
          "5. 🎃 कद्दू की सब्जी\n\n" +
          "रात 8 बजे तक वोट करें — सबसे ज्यादा वोट वाली सब्जी कल बनेगी! 🙏",
        next_node_key: "end",
      } as SendMessageNodeConfig,
    },
    {
      node_key: "resp_9",
      node_type: "send_message",
      config: {
        text:
          "🥡 *आज का टिफिन ऑर्डर*\n\n" +
          "⚠️ Note: ऑर्डर सुबह 9 बजे तक complete करें\n\n" +
          "आज का मेनू:\n" +
          "• 🍱 दाल, चावल, रोटी, सब्जी — ₹60\n" +
          "• 🍛 राजमा चावल Special — ₹70\n" +
          "• 🥗 Veg Thali Full — ₹80\n\n" +
          "ऑर्डर के लिए: Item + Quantity + Delivery Address टाइप करें\n\nजय माँ अन्नपूर्णा! 🙏",
        next_node_key: "end",
      } as SendMessageNodeConfig,
    },
    {
      node_key: "resp_10",
      node_type: "send_message",
      config: {
        text:
          "🛒 *अतिरिक्त आइटम ऑर्डर*\n\n" +
          "अपनी Regular Tiffin के साथ Extra items ऑर्डर करें:\n\n" +
          "• 🥛 Lassi/Buttermilk — ₹25\n" +
          "• 🫓 Extra Roti (4 pcs) — ₹20\n" +
          "• 🥗 Salad — ₹15\n" +
          "• 🍮 Mithai/Sweet — ₹30\n" +
          "• 🥤 Fresh Juice — ₹40\n\n" +
          "Item + Quantity टाइप करें और हम आपके टिफिन के साथ भेजेंगे! 🙏",
        next_node_key: "end",
      } as SendMessageNodeConfig,
    },
    {
      node_key: "resp_11",
      node_type: "send_message",
      config: {
        text:
          "⭐ *आज के भोजन की रेटिंग*\n\n" +
          "आपका फीडबैक हमारे लिए बहुत important है!\n\n" +
          "1️⃣ ⭐ — बेहतर हो सकता था\n" +
          "2️⃣ ⭐⭐ — ठीक था\n" +
          "3️⃣ ⭐⭐⭐ — अच्छा था\n" +
          "4️⃣ ⭐⭐⭐⭐ — बहुत अच्छा!\n" +
          "5️⃣ ⭐⭐⭐⭐⭐ — लाजवाब!\n\n" +
          "कृपया 1 से 5 के बीच नंबर भेजें + कोई सुझाव हो तो जरूर लिखें! 🙏",
        next_node_key: "end",
      } as SendMessageNodeConfig,
    },

    // ── Option 0 — Human support (handoff) ───────────────────
    {
      node_key: "resp_0",
      node_type: "handoff",
      config: {
        note:
          "Customer ने मानव सहायता (Option 0) चुना है। कृपया जल्द से जल्द जवाब दें।",
      } as HandoffNodeConfig,
    },

    // ── End node ─────────────────────────────────────────────
    {
      node_key: "end",
      node_type: "end",
      config: {},
    },
  ],
};

// ============================================================
// Registry
// ============================================================

const TEMPLATES: Record<string, FlowTemplate> = {
  welcome_menu: WELCOME_MENU,
  faq_bot: FAQ_BOT,
  lead_capture: LEAD_CAPTURE,
  maa_annapurna_rasoi: MAA_ANNAPURNA_RASOI,
};

export function getFlowTemplate(slug: string): FlowTemplate | null {
  return TEMPLATES[slug] ?? null;
}

export function listFlowTemplates(): FlowTemplate[] {
  return Object.values(TEMPLATES);
}
