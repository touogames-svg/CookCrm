import { supabaseAdmin } from "./admin-client";
import {
  engineSendText,
  engineSendInteractiveList,
  engineSendInteractiveButtons,
} from "./meta-send";
import type { DispatchInboundInput, DispatchInboundResult, FlowRunRow } from "./types";

// Emojis and content definitions exactly matching the USER_REQUEST
const WEEKLY_MENU_TEXT = `╔══════════════╗
🍽️ *WEEKLY TIFFIN MENU* 🍽️
╚══════════════╝

✨ Fresh • Healthy • Homemade ✨

🟢 *MONDAY*
🍛 Dal Tadka
🥔 Aloo Gobhi
🍚 Jeera Rice
🫓 Fresh Rotis
🥗 Salad

🟡 *TUESDAY*
🧆 Chole Masala
🥔 Aloo Matar
🍚 Rice
🫓 Rotis
🧅 Salad

🟠 *WEDNESDAY*
🥣 Moong Dal Fry
🥕 Mix Veg Curry
🍚 Jeera Rice
🫓 Rotis
🥒 Salad

🔵 *THURSDAY*
🫘 Rajma Masala
🌱 Aloo Beans
🍚 Rice
🫓 Rotis
🥗 Salad

🟣 *FRIDAY*
🍛 Dal Makhani
🥬 Seasonal Veg
🍚 Peas Pulao
🫓 Rotis
🥗 Salad

🟤 *SATURDAY*
🥣 Kadhi Pakora
🥔 Aloo Jeera
🍚 Rice
🫓 Rotis
🥗 Salad

👑 *SUNDAY SPECIAL* 👑
🧀 Shahi Paneer
🍛 Dal Tadka
🍚 Veg Pulao
🫓 Butter Rotis
🍮 Sweet Dish
🥗 Fresh Salad

══════════════

📦 *Monthly Tiffin Available*
🏠 Home-Style Cooking
💚 Hygienic & Fresh Daily

📞 *Book Your Tiffin Today*
☎️ +91 XXXXX XXXXX

🙏 Thank You 🙏`;

const RATE_CARD_TEXT = `╔════════════════════╗
🍽️ *TIFFIN PLANS & PRICING* 🍽️
╚════════════════════╝

🎉 *पहली थाली सिर्फ ₹49* 🎉
✨ Day OR Night (One-Time Trial)

━━━━━━━━━━━━━━━━

🍛 *डेली प्लान*
💰 ₹79
📦 1 समय का भोजन
🌞 Day OR 🌙 Night

━━━━━━━━━━━━━━━━

📆 *वीकली फैमिली प्लान*
💰 ₹999

✅ सुबह + शाम भोजन
🎁 1 दिन का भोजन FREE

━━━━━━━━━━━━━━━━

📅 *मंथली प्रीमियम प्लान*
💰 ₹3499

✅ सुबह + शाम भोजन
🎁 4 दिन का भोजन FREE

━━━━━━━━━━━━━━━━

⭐ *EXECUTIVE MONTHLY PLAN*
💰 ₹1999

🍱 1 समय का टिफिन (Daily)
📅 पूरे महीने के लिए
👨💼 ऑफिस स्टाफ • स्टूडेंट्स • बैचलर्स`;

// Helpler to map plan IDs to plan names
function getPlanName(planId: string): string {
  switch (planId) {
    case "plan_trial":
      return "पहली थाली (Trial) - ₹49";
    case "plan_daily":
      return "डेली प्लान (Daily) - ₹79";
    case "plan_weekly":
      return "वीकली फैमिली प्लान - ₹999";
    case "plan_monthly":
      return "मंथली प्रीमियम प्लान - ₹3499";
    case "plan_executive":
      return "EXECUTIVE MONTHLY PLAN - ₹1999";
    default:
      return planId;
  }
}

// Helper to get plan unit price
function getPlanPrice(planId: string): number {
  switch (planId) {
    case "plan_trial":
      return 49;
    case "plan_daily":
      return 79;
    case "plan_weekly":
      return 999;
    case "plan_monthly":
      return 3499;
    case "plan_executive":
      return 1999;
    default:
      return 0;
  }
}

async function getOrCreateAnnapurnaFlow(db: any, accountId: string, userId: string): Promise<string> {
  const { data: flows, error } = await db
    .from("flows")
    .select("id")
    .eq("account_id", accountId)
    .limit(1);

  if (flows && flows.length > 0) {
    return flows[0].id;
  }

  // Insert a fallback default flow row so we satisfy the foreign key constraint
  const { data: newFlow } = await db
    .from("flows")
    .insert({
      user_id: userId,
      account_id: accountId,
      name: "Maa Annapurna Rasoi Welcome Flow",
      status: "active",
      trigger_type: "keyword",
      trigger_config: { keywords: ["hi", "hello"] },
      entry_node_id: "main_menu",
    })
    .select("id")
    .single();

  if (!newFlow) {
    throw new Error("Could not find or create a flow record in flows table.");
  }
  return newFlow.id;
}

// ── Outbound message helpers ─────────────────────────────────

async function sendWelcomeMenu(input: DispatchInboundInput) {
  const text = `Maa annapurna rasoi में आपका हृदय से स्वागत है 🙏\n"घर जैसा शुद्ध और पौष्टिक भोजन, आपसे सिर्फ एक क्लिक की दूरी पर".`;
  await engineSendInteractiveList({
    accountId: input.accountId,
    userId: input.userId,
    conversationId: input.conversationId,
    contactId: input.contactId,
    bodyText: text,
    buttonLabel: "मेनू विकल्प चुनें",
    sections: [
      {
        title: "मुख्य मेनू (Main Menu)",
        rows: [
          { id: "menu_menu", title: "1️⃣ Menu", description: "Weekly tiffin menu board" },
          { id: "menu_rate", title: "2️⃣ Rate Card", description: "Tiffin plans & pricing" },
          { id: "menu_reg", title: "3️⃣ Registration", description: "Register & order your tiffin" },
          { id: "menu_lang", title: "4️⃣ Language", description: "Select preferred language" },
          { id: "menu_support", title: "5️⃣ Support", description: "Get support or contact agent" },
        ],
      },
    ],
    resolvedContext: input.resolvedContext,
  });
}

async function sendBackToMenuButton(input: DispatchInboundInput, text: string) {
  await engineSendInteractiveButtons({
    accountId: input.accountId,
    userId: input.userId,
    conversationId: input.conversationId,
    contactId: input.contactId,
    bodyText: text,
    buttons: [{ id: "go_back", title: "⬅️ Back to Menu" }],
    resolvedContext: input.resolvedContext,
  });
}

// ── Entry point ──────────────────────────────────────────────

export async function dispatchAnnapurnaFlow(
  input: DispatchInboundInput & { isFirstInboundMessage: boolean }
): Promise<DispatchInboundResult> {
  const db = supabaseAdmin();
  const accountId = input.accountId;
  const contactId = input.contactId;
  const conversationId = input.conversationId;

  // 0) Handle Rider Dispatch Commands (e.g. #track AMAR-XXXX [Rider Name] <link> or #track AMAR-XXXX <link>)
  if (input.message.kind === "text") {
    const text = input.message.text.trim();
    if (text.startsWith("#track") || text.startsWith("#dispatch")) {
      const parts = text.split(/\s+/);
      const command = parts[0];
      const orderNumber = parts.find((p) => p.startsWith("AMAR-"));
      const trackingLink = parts.find(
        (p) => p.startsWith("http://") || p.startsWith("https://")
      );

      if (!orderNumber || !trackingLink) {
        await engineSendText({
          accountId,
          userId: input.userId,
          conversationId,
          contactId,
          text: `⚠️ *गलत प्रारूप (Invalid Format)*\n\nकृपया इस प्रारूप में भेजें:\n👉 \`#track AMAR-XXXX [राइडर का नाम] <गूगल मैप्स लिंक>\`\n\nउदाहरण:\n\`#track AMAR-4892 Ramesh https://maps.app.goo.gl/xyz\``,
          resolvedContext: input.resolvedContext,
        });
        return { consumed: true, outcome: "advanced" };
      }

      // Extract Rider Name if present
      const nameParts = parts.slice(1).filter((p) => p !== orderNumber && p !== trackingLink);
      let riderName = nameParts.join(" ").trim();
      if (!riderName) {
        // Look up sender's contact name
        const { data: senderContact } = await db
          .from("contacts")
          .select("name, phone")
          .eq("id", contactId)
          .maybeSingle();
        riderName = senderContact?.name || senderContact?.phone || "Rider";
      }

      // Find customer flow run by order number in variables
      const { data: recentRuns } = await db
        .from("flow_runs")
        .select("*")
        .eq("account_id", accountId)
        .order("started_at", { ascending: false })
        .limit(100);

      const customerRun = recentRuns?.find(
        (r) => r.vars && r.vars.reg_order_number === orderNumber
      );

      if (!customerRun) {
        await engineSendText({
          accountId,
          userId: input.userId,
          conversationId,
          contactId,
          text: `❌ *ऑर्डर ${orderNumber} नहीं मिला!*\n\nकृपया जांचें कि ऑर्डर नंबर सही है या नहीं।`,
          resolvedContext: input.resolvedContext,
        });
        return { consumed: true, outcome: "no_match" };
      }

      // Update customer run variables
      const updatedVars = {
        ...customerRun.vars,
        dispatched: true,
        rider_name: riderName,
        tracking_link: trackingLink,
        dispatched_at: new Date().toISOString(),
      };

      const updatePayload: Record<string, any> = {
        vars: updatedVars,
      };

      if (customerRun.status !== "completed") {
        updatePayload.status = "completed";
        updatePayload.ended_at = new Date().toISOString();
        updatePayload.end_reason = "dispatched_by_rider_command";
      }

      await db
        .from("flow_runs")
        .update(updatePayload)
        .eq("id", customerRun.id);

      // Send dispatch WhatsApp message to customer
      await engineSendText({
        accountId,
        userId: input.userId,
        conversationId: customerRun.conversation_id,
        contactId: customerRun.contact_id,
        text: `🚚 *आपका टिफिन भेज दिया गया है!*\n\n📦 *ऑर्डर नंबर*: \`${orderNumber}\`\n👤 *राइडर*: *${riderName}*\n\n📍 अपने डिलीवरी एजेंट को लाइव ट्रैक करने के लिए नीचे दिए गए लिंक पर क्लिक करें:\n👉 ${trackingLink}\n\nस्वादिष्ट और शुद्ध भोजन का आनंद लें! 🙏`,
        resolvedContext: input.resolvedContext,
      });

      // Confirm dispatch to rider
      await engineSendText({
        accountId,
        userId: input.userId,
        conversationId,
        contactId,
        text: `✅ *ऑर्डर ${orderNumber} भेज दिया गया है!*\n\nग्राहक (*${
          customerRun.vars.reg_name || "Customer"
        }*) को लाइव लोकेशन लिंक भेज दिया गया है।`,
        resolvedContext: input.resolvedContext,
      });

      return { consumed: true, flow_run_id: customerRun.id, outcome: "completed" };
    }
  }

  // 1) Load or create active run
  const { data: runs, error: runError } = await db
    .from("flow_runs")
    .select("*")
    .eq("account_id", accountId)
    .eq("contact_id", contactId)
    .eq("status", "active")
    .order("started_at", { ascending: false })
    .limit(1);

  let activeRun: FlowRunRow | null = runs && runs.length > 0 ? runs[0] : null;

  // Log incoming reply event on active run if it exists
  if (activeRun) {
    await db.from("flow_run_events").insert({
      flow_run_id: activeRun.id,
      event_type: "reply_received",
      node_key: activeRun.current_node_key,
      payload: {
        meta_message_id: input.message.meta_message_id,
        reply_kind: input.message.kind,
        reply_id: input.message.kind === "interactive_reply" ? input.message.reply_id : null,
        text: input.message.kind === "text" ? input.message.text : null,
      },
    });
  }

  // 2) Handle new run starting
  if (!activeRun) {
    const flowId = await getOrCreateAnnapurnaFlow(db, accountId, input.userId);
    
    // Create new flow run
    const { data: newRun, error: insertError } = await db
      .from("flow_runs")
      .insert({
        flow_id: flowId,
        account_id: accountId,
        user_id: input.userId,
        contact_id: contactId,
        conversation_id: conversationId,
        status: "active",
        current_node_key: "main_menu",
        vars: {},
      })
      .select("*")
      .single();

    if (insertError || !newRun) {
      console.error("Failed to start new flow run:", insertError);
      return { consumed: false, outcome: "no_match" };
    }

    activeRun = newRun;
    await sendWelcomeMenu(input);
    return { consumed: true, flow_run_id: newRun.id, outcome: "started" };
  }

  // 3) Process state machine based on activeRun.current_node_key
  const currentState = activeRun.current_node_key;
  const message = input.message;

  // Helper to update state in DB
  const updateRunState = async (nextState: string, varsUpdate?: Record<string, any>) => {
    const nextVars = { ...activeRun!.vars, ...varsUpdate };
    await db
      .from("flow_runs")
      .update({
        current_node_key: nextState,
        vars: nextVars,
        last_advanced_at: new Date().toISOString(),
      })
      .eq("id", activeRun!.id);
  };

  // Helper to complete run in DB
  const completeRun = async (reason: string) => {
    await db
      .from("flow_runs")
      .update({
        status: "completed",
        ended_at: new Date().toISOString(),
        end_reason: reason,
      })
      .eq("id", activeRun!.id);
  };

  // Helper to handoff run in DB
  const handoffRun = async (reason: string) => {
    await db
      .from("flow_runs")
      .update({
        status: "handed_off",
        ended_at: new Date().toISOString(),
        end_reason: reason,
      })
      .eq("id", activeRun!.id);
  };

  // Normalise reply selection
  let selection: string | null = null;
  let text = "";
  if (message.kind === "interactive_reply") {
    selection = message.reply_id;
  } else if (message.kind === "text") {
    text = message.text.trim();
    const cleanText = text.toLowerCase();
    
    // Global back/menu command
    if (cleanText === "back" || cleanText === "menu" || cleanText === "home" || cleanText === "रद्द") {
      selection = "go_back";
    }
  }

  // STATE: main_menu
  if (currentState === "main_menu") {
    // If text, map numeric inputs or phrases
    if (message.kind === "text" && !selection) {
      const cleanText = text.toLowerCase();
      if (cleanText === "1" || cleanText.includes("menu") || cleanText.includes("मेन्यू")) selection = "menu_menu";
      else if (cleanText === "2" || cleanText.includes("rate") || cleanText.includes("price") || cleanText.includes("प्राइस")) selection = "menu_rate";
      else if (cleanText === "3" || cleanText.includes("reg") || cleanText.includes("register") || cleanText.includes("order")) selection = "menu_reg";
      else if (cleanText === "4" || cleanText.includes("lang") || cleanText.includes("bhasha") || cleanText.includes("भाषा")) selection = "menu_lang";
      else if (cleanText === "5" || cleanText.includes("support") || cleanText.includes("help") || cleanText.includes("सहायता")) selection = "menu_support";
    }

    if (selection === "menu_menu") {
      await engineSendText({
        accountId,
        userId: input.userId,
        conversationId,
        contactId,
        text: WEEKLY_MENU_TEXT,
        resolvedContext: input.resolvedContext,
      });
      await sendBackToMenuButton(input, "मुख्य मेनू पर वापस जाने के लिए नीचे बटन दबाएं। 👇");
      await updateRunState("menu_view");
      return { consumed: true, flow_run_id: activeRun.id, outcome: "advanced" };
    }
    
    if (selection === "menu_rate") {
      await engineSendText({
        accountId,
        userId: input.userId,
        conversationId,
        contactId,
        text: RATE_CARD_TEXT,
        resolvedContext: input.resolvedContext,
      });
      await sendBackToMenuButton(input, "मुख्य मेनू पर वापस जाने के लिए नीचे बटन दबाएं। 👇");
      await updateRunState("rate_view");
      return { consumed: true, flow_run_id: activeRun.id, outcome: "advanced" };
    }

    if (selection === "menu_reg") {
      // Load current contact info
      const { data: contact } = await db
        .from("contacts")
        .select("name, phone")
        .eq("id", contactId)
        .maybeSingle();

      const contactName = contact?.name || "Customer";
      const contactPhone = contact?.phone || input.resolvedContext?.contactPhone || "";

      await engineSendInteractiveButtons({
        accountId,
        userId: input.userId,
        conversationId,
        contactId,
        bodyText: `📝 *रजिस्ट्रेशन (1/6) — संपर्क जानकारी*\n\nक्या आप इस नाम और मोबाइल नंबर के साथ पंजीकरण करना चाहते हैं?\n👤 नाम: *${contactName}*\n📱 मोबाइल: *${contactPhone}*`,
        buttons: [
          { id: "reg_confirm_contact_yes", title: "हाँ, यह सही है" },
          { id: "reg_confirm_contact_edit_name", title: "नाम बदलें" },
          { id: "reg_confirm_contact_edit_phone", title: "नंबर बदलें" },
        ],
        resolvedContext: input.resolvedContext,
      });

      await updateRunState("reg_step_1_confirm", {
        reg_name: contactName,
        reg_phone: contactPhone,
      });
      return { consumed: true, flow_run_id: activeRun.id, outcome: "advanced" };
    }

    if (selection === "menu_lang") {
      await engineSendInteractiveButtons({
        accountId,
        userId: input.userId,
        conversationId,
        contactId,
        bodyText: "🌐 *Language / भाषा चुनें*\n\nकृपया अपनी पसंदीदा भाषा चुनें:",
        buttons: [
          { id: "lang_hi", title: "Hindi (हिंदी)" },
          { id: "lang_en", title: "English" },
          { id: "go_back", title: "⬅️ Back" },
        ],
        resolvedContext: input.resolvedContext,
      });
      await updateRunState("language_view");
      return { consumed: true, flow_run_id: activeRun.id, outcome: "advanced" };
    }

    if (selection === "menu_support") {
      await engineSendInteractiveButtons({
        accountId,
        userId: input.userId,
        conversationId,
        contactId,
        bodyText: "📞 *Support / सहायता*\n\nयदि आपको कोई समस्या या सहायता चाहिए, तो आप हमसे संपर्क कर सकते हैं:\n☎️ +91 XXXXX XXXXX\n✉️ support@annapurnarasoi.com\n\nनीचे बटन दबाकर हमारे एजेंट से भी सीधे बात कर सकते हैं।",
        buttons: [
          { id: "support_handoff", title: "Agent Handoff" },
          { id: "go_back", title: "⬅️ Back to Menu" },
        ],
        resolvedContext: input.resolvedContext,
      });
      await updateRunState("support_view");
      return { consumed: true, flow_run_id: activeRun.id, outcome: "advanced" };
    }

    // Reprompt
    await sendWelcomeMenu(input);
    return { consumed: true, flow_run_id: activeRun.id, outcome: "fallback_fired" };
  }

  // STATE: menu_view OR rate_view
  if (currentState === "menu_view" || currentState === "rate_view") {
    if (selection === "go_back") {
      await sendWelcomeMenu(input);
      await updateRunState("main_menu");
      return { consumed: true, flow_run_id: activeRun.id, outcome: "advanced" };
    }
    // Reprompt back button
    await sendBackToMenuButton(input, "मुख्य मेनू पर वापस जाने के लिए नीचे बटन दबाएं। 👇");
    return { consumed: true, flow_run_id: activeRun.id, outcome: "fallback_fired" };
  }

  // STATE: language_view
  if (currentState === "language_view") {
    if (selection === "go_back") {
      await sendWelcomeMenu(input);
      await updateRunState("main_menu");
      return { consumed: true, flow_run_id: activeRun.id, outcome: "advanced" };
    }
    if (selection === "lang_hi" || selection === "lang_en") {
      const selected = selection === "lang_hi" ? "Hindi (हिंदी)" : "English";
      await engineSendText({
        accountId,
        userId: input.userId,
        conversationId,
        contactId,
        text: `👍 Preference saved: *${selected}* / भाषा अपडेट कर दी गई है!`,
        resolvedContext: input.resolvedContext,
      });
      await sendWelcomeMenu(input);
      await updateRunState("main_menu");
      return { consumed: true, flow_run_id: activeRun.id, outcome: "advanced" };
    }
    // Reprompt language selection
    await engineSendInteractiveButtons({
      accountId,
      userId: input.userId,
      conversationId,
      contactId,
      bodyText: "🌐 *Language / भाषा चुनें*\n\nकृपया अपनी पसंदीदा भाषा चुनें:",
      buttons: [
        { id: "lang_hi", title: "Hindi (हिंदी)" },
        { id: "lang_en", title: "English" },
        { id: "go_back", title: "⬅️ Back" },
      ],
      resolvedContext: input.resolvedContext,
    });
    return { consumed: true, flow_run_id: activeRun.id, outcome: "fallback_fired" };
  }

  // STATE: support_view
  if (currentState === "support_view") {
    if (selection === "go_back") {
      await sendWelcomeMenu(input);
      await updateRunState("main_menu");
      return { consumed: true, flow_run_id: activeRun.id, outcome: "advanced" };
    }
    if (selection === "support_handoff" || text.toLowerCase().includes("agent") || text.toLowerCase().includes("human")) {
      // Handoff conversation
      await db
        .from("conversations")
        .update({ status: "pending", updated_at: new Date().toISOString() })
        .eq("id", conversationId);

      await engineSendText({
        accountId,
        userId: input.userId,
        conversationId,
        contactId,
        text: "🙏 हमारे एजेंट को सूचित कर दिया गया है। वे जल्द ही आपसे संपर्क करेंगे। / Our agent has been notified and will reply shortly.",
        resolvedContext: input.resolvedContext,
      });
      await handoffRun("human_handoff_requested");
      return { consumed: true, flow_run_id: activeRun.id, outcome: "handed_off" };
    }
    // Reprompt
    await engineSendInteractiveButtons({
      accountId,
      userId: input.userId,
      conversationId,
      contactId,
      bodyText: "📞 *Support / सहायता*\n\nयदि आपको कोई समस्या या सहायता चाहिए, तो आप हमसे संपर्क कर सकते हैं:\n☎️ +91 XXXXX XXXXX\n✉️ support@annapurnarasoi.com\n\nनीचे बटन दबाकर हमारे एजेंट से भी सीधे बात कर सकते हैं।",
      buttons: [
        { id: "support_handoff", title: "Agent Handoff" },
        { id: "go_back", title: "⬅️ Back to Menu" },
      ],
      resolvedContext: input.resolvedContext,
    });
    return { consumed: true, flow_run_id: activeRun.id, outcome: "fallback_fired" };
  }

  // STATE: reg_step_1_confirm
  if (currentState === "reg_step_1_confirm") {
    if (selection === "go_back") {
      await sendWelcomeMenu(input);
      await updateRunState("main_menu");
      return { consumed: true, flow_run_id: activeRun.id, outcome: "advanced" };
    }
    if (selection === "reg_confirm_contact_yes" || text.toLowerCase() === "yes" || text === "1") {
      // Proceed to Step 2: Location sharing
      await engineSendInteractiveButtons({
        accountId,
        userId: input.userId,
        conversationId,
        contactId,
        bodyText: `📍 *रजिस्ट्रेशन (2/6) — डिलीवरी लोकेशन*\n\nकृपया डिलीवरी के लिए अपना WhatsApp Location शेयर करें।\n\n*(WhatsApp में 📎 या + आइकन पर क्लिक करके Location -> Share Current/Live Location चुनें)*\n\nलोकेशन भेजने में समस्या होने पर आप अपना पता टाइप भी कर सकते हैं।`,
        buttons: [{ id: "go_back", title: "⬅️ मुख्य मेनू" }],
        resolvedContext: input.resolvedContext,
      });
      await updateRunState("reg_location");
      return { consumed: true, flow_run_id: activeRun.id, outcome: "advanced" };
    }
    if (selection === "reg_confirm_contact_edit_name" || text === "2") {
      await engineSendText({
        accountId,
        userId: input.userId,
        conversationId,
        contactId,
        text: "👤 कृपया अपना पूरा नाम टाइप करके भेजें:",
        resolvedContext: input.resolvedContext,
      });
      await updateRunState("reg_edit_name");
      return { consumed: true, flow_run_id: activeRun.id, outcome: "advanced" };
    }
    if (selection === "reg_confirm_contact_edit_phone" || text === "3") {
      await engineSendText({
        accountId,
        userId: input.userId,
        conversationId,
        contactId,
        text: "📱 कृपया अपना नया मोबाइल नंबर टाइप करके भेजें:",
        resolvedContext: input.resolvedContext,
      });
      await updateRunState("reg_edit_phone");
      return { consumed: true, flow_run_id: activeRun.id, outcome: "advanced" };
    }

    // Reprompt step 1
    const regName = activeRun.vars.reg_name || "Customer";
    const regPhone = activeRun.vars.reg_phone || "";
    await engineSendInteractiveButtons({
      accountId,
      userId: input.userId,
      conversationId,
      contactId,
      bodyText: `📝 *रजिस्ट्रेशन (1/6) — संपर्क जानकारी*\n\nक्या आप इस नाम और मोबाइल नंबर के साथ पंजीकरण करना चाहते हैं?\n👤 नाम: *${regName}*\n📱 मोबाइल: *${regPhone}*`,
      buttons: [
        { id: "reg_confirm_contact_yes", title: "हाँ, यह सही है" },
        { id: "reg_confirm_contact_edit_name", title: "नाम बदलें" },
        { id: "reg_confirm_contact_edit_phone", title: "नंबर बदलें" },
      ],
      resolvedContext: input.resolvedContext,
    });
    return { consumed: true, flow_run_id: activeRun.id, outcome: "fallback_fired" };
  }

  // STATE: reg_edit_name
  if (currentState === "reg_edit_name") {
    if (message.kind === "text") {
      const newName = text;
      const regPhone = activeRun.vars.reg_phone || "";
      await engineSendInteractiveButtons({
        accountId,
        userId: input.userId,
        conversationId,
        contactId,
        bodyText: `📝 *रजिस्ट्रेशन (1/6) — संपर्क जानकारी*\n\nक्या आप इस नाम और मोबाइल नंबर के साथ पंजीकरण करना चाहते हैं?\n👤 नाम: *${newName}*\n📱 मोबाइल: *${regPhone}*`,
        buttons: [
          { id: "reg_confirm_contact_yes", title: "हाँ, यह सही है" },
          { id: "reg_confirm_contact_edit_name", title: "नाम बदलें" },
          { id: "reg_confirm_contact_edit_phone", title: "नंबर बदलें" },
        ],
        resolvedContext: input.resolvedContext,
      });
      await updateRunState("reg_step_1_confirm", { reg_name: newName });
      return { consumed: true, flow_run_id: activeRun.id, outcome: "advanced" };
    }
    // Reprompt name edit
    await engineSendText({
      accountId,
      userId: input.userId,
      conversationId,
      contactId,
      text: "👤 कृपया अपना पूरा नाम टाइप करके भेजें:",
      resolvedContext: input.resolvedContext,
    });
    return { consumed: true, flow_run_id: activeRun.id, outcome: "fallback_fired" };
  }

  // STATE: reg_edit_phone
  if (currentState === "reg_edit_phone") {
    if (message.kind === "text") {
      const newPhone = text;
      const regName = activeRun.vars.reg_name || "";
      await engineSendInteractiveButtons({
        accountId,
        userId: input.userId,
        conversationId,
        contactId,
        bodyText: `📝 *रजिस्ट्रेशन (1/6) — संपर्क जानकारी*\n\nक्या आप इस नाम और मोबाइल नंबर के साथ पंजीकरण करना चाहते हैं?\n👤 नाम: *${regName}*\n📱 मोबाइल: *${newPhone}*`,
        buttons: [
          { id: "reg_confirm_contact_yes", title: "हाँ, यह सही है" },
          { id: "reg_confirm_contact_edit_name", title: "नाम बदलें" },
          { id: "reg_confirm_contact_edit_phone", title: "नंबर बदलें" },
        ],
        resolvedContext: input.resolvedContext,
      });
      await updateRunState("reg_step_1_confirm", { reg_phone: newPhone });
      return { consumed: true, flow_run_id: activeRun.id, outcome: "advanced" };
    }
    // Reprompt phone edit
    await engineSendText({
      accountId,
      userId: input.userId,
      conversationId,
      contactId,
      text: "📱 कृपया अपना नया मोबाइल नंबर टाइप करके भेजें:",
      resolvedContext: input.resolvedContext,
    });
    return { consumed: true, flow_run_id: activeRun.id, outcome: "fallback_fired" };
  }

  // STATE: reg_location
  if (currentState === "reg_location") {
    if (selection === "go_back") {
      await sendWelcomeMenu(input);
      await updateRunState("main_menu");
      return { consumed: true, flow_run_id: activeRun.id, outcome: "advanced" };
    }

    if (message.kind === "text" && text.length > 3) {
      // User shared location maps link or typed address
      const locationText = text;
      
      await engineSendInteractiveList({
        accountId,
        userId: input.userId,
        conversationId,
        contactId,
        bodyText: "🍛 *रजिस्ट्रेशन (3/6) — प्लान चयन*\n\nकृपया अपना पसंदीदा टिफिन प्लान चुनें:",
        buttonLabel: "प्लान देखें",
        sections: [
          {
            title: "टिफिन प्लान (Plans)",
            rows: [
              { id: "plan_trial", title: "Trial Plan (₹49)", description: "पहली थाली सिर्फ ₹49" },
              { id: "plan_daily", title: "Daily Plan (₹79)", description: "1 समय का टिफिन" },
              { id: "plan_weekly", title: "Weekly Plan (₹999)", description: "सुबह + शाम भोजन (Family)" },
              { id: "plan_monthly", title: "Monthly Plan (₹3499)", description: "सुबह + शाम भोजन (Premium)" },
              { id: "plan_executive", title: "Executive Plan (₹1999)", description: "1 समय टिफिन (Monthly)" },
            ],
          },
        ],
        resolvedContext: input.resolvedContext,
      });

      await updateRunState("reg_plan", { reg_location: locationText });
      return { consumed: true, flow_run_id: activeRun.id, outcome: "advanced" };
    }

    // Reprompt location share
    await engineSendInteractiveButtons({
      accountId,
      userId: input.userId,
      conversationId,
      contactId,
      bodyText: `📍 *रजिस्ट्रेशन (2/6) — डिलीवरी लोकेशन*\n\nकृपया डिलीवरी के लिए अपना WhatsApp Location शेयर करें।\n\n*(WhatsApp में 📎 या + आइकन पर क्लिक करके Location -> Share Current/Live Location चुनें)*\n\nलोकेशन भेजने में समस्या होने पर आप अपना पता टाइप भी कर सकते हैं।`,
      buttons: [{ id: "go_back", title: "⬅️ मुख्य मेनू" }],
      resolvedContext: input.resolvedContext,
    });
    return { consumed: true, flow_run_id: activeRun.id, outcome: "fallback_fired" };
  }

  // STATE: reg_plan
  if (currentState === "reg_plan") {
    if (selection === "go_back") {
      await sendWelcomeMenu(input);
      await updateRunState("main_menu");
      return { consumed: true, flow_run_id: activeRun.id, outcome: "advanced" };
    }

    let selectedPlan: string | null = null;
    if (selection && selection.startsWith("plan_")) {
      selectedPlan = selection;
    } else if (message.kind === "text") {
      const cleanText = text.toLowerCase();
      if (cleanText.includes("trial") || cleanText.includes("49")) selectedPlan = "plan_trial";
      else if (cleanText.includes("daily") || cleanText.includes("79")) selectedPlan = "plan_daily";
      else if (cleanText.includes("weekly") || cleanText.includes("999")) selectedPlan = "plan_weekly";
      else if (cleanText.includes("monthly") || cleanText.includes("3499")) selectedPlan = "plan_monthly";
      else if (cleanText.includes("executive") || cleanText.includes("1999")) selectedPlan = "plan_executive";
    }
    if (selectedPlan) {
      await engineSendInteractiveList({
        accountId,
        userId: input.userId,
        conversationId,
        contactId,
        bodyText: "👥 *रजिस्ट्रेशन (4/6) — टिफिन मात्रा*\n\nकितने लोगों के लिए टिफिन चाहिए? कृपया नीचे दिए गए मेनू से मात्रा चुनें:",
        buttonLabel: "मात्रा चुनें",
        sections: [
          {
            title: "मात्रा (Quantity)",
            rows: [
              { id: "qty_1", title: "1 व्यक्ति (1 Plate)" },
              { id: "qty_2", title: "2 व्यक्ति (2 Plates)" },
              { id: "qty_3", title: "3 व्यक्ति (3 Plates)" },
              { id: "qty_4", title: "4 व्यक्ति (4 Plates)" },
              { id: "qty_5", title: "5 व्यक्ति (5 Plates)" },
            ],
          },
        ],
        resolvedContext: input.resolvedContext,
      });

      await updateRunState("reg_quantity", { reg_plan: selectedPlan });
      return { consumed: true, flow_run_id: activeRun.id, outcome: "advanced" };
    }

    // Reprompt plans
    await engineSendInteractiveList({
      accountId,
      userId: input.userId,
      conversationId,
      contactId,
      bodyText: "🍛 *रजिस्ट्रेशन (3/6) — प्लान चयन*\n\nकृपया अपना पसंदीदा टिफिन प्लान चुनें:",
      buttonLabel: "प्लान देखें",
      sections: [
        {
          title: "टिफिन प्लान (Plans)",
          rows: [
            { id: "plan_trial", title: "Trial Plan (₹49)", description: "पहली थाली सिर्फ ₹49" },
            { id: "plan_daily", title: "Daily Plan (₹79)", description: "1 समय का टिफिन" },
            { id: "plan_weekly", title: "Weekly Plan (₹999)", description: "सुबह + शाम भोजन (Family)" },
            { id: "plan_monthly", title: "Monthly Plan (₹3499)", description: "सुबह + शाम भोजन (Premium)" },
            { id: "plan_executive", title: "Executive Plan (₹1999)", description: "1 समय टिफिन (Monthly)" },
          ],
        },
      ],
      resolvedContext: input.resolvedContext,
    });
    return { consumed: true, flow_run_id: activeRun.id, outcome: "fallback_fired" };
  }

  // STATE: reg_quantity
  if (currentState === "reg_quantity") {
    if (selection === "go_back") {
      await sendWelcomeMenu(input);
      await updateRunState("main_menu");
      return { consumed: true, flow_run_id: activeRun.id, outcome: "advanced" };
    }

    let qty = 0;
    if (selection && selection.startsWith("qty_")) {
      qty = parseInt(selection.replace("qty_", ""), 10);
    } else if (message.kind === "text") {
      const num = parseInt(text, 10);
      if (!isNaN(num) && num > 0) {
        qty = num;
      }
    }

    if (qty > 0) {
      const planId = activeRun.vars.reg_plan as string;
      const unitPrice = getPlanPrice(planId);
      const totalPrice = unitPrice * qty;

      const regName = activeRun.vars.reg_name || "Customer";
      const regPhone = activeRun.vars.reg_phone || "";
      const regLocation = activeRun.vars.reg_location || "";

      await engineSendInteractiveButtons({
        accountId,
        userId: input.userId,
        conversationId,
        contactId,
        bodyText: `📋 *रजिस्ट्रेशन (5/6) — ऑर्डर समरी*\n\nकृपया विवरण की जांच करें:\n👤 नाम: *${regName}*\n📱 मोबाइल: *${regPhone}*\n📍 लोकेशन: *${regLocation}*\n🍛 प्लान: *${getPlanName(planId)}*\n👥 मात्रा: *${qty} व्यक्ति*\n💰 कुल राशि: *₹${totalPrice}*\n\nक्या आप इस ऑर्डर को पक्का करना चाहते हैं?`,
        buttons: [
          { id: "reg_confirm_order", title: "हाँ, पक्का करें" },
          { id: "go_back", title: "रद्द करें" },
        ],
        resolvedContext: input.resolvedContext,
      });

      await updateRunState("reg_summary", {
        reg_qty: qty,
        reg_price: totalPrice,
      });
      return { consumed: true, flow_run_id: activeRun.id, outcome: "advanced" };
    }

    // Reprompt qty
    await engineSendInteractiveList({
      accountId,
      userId: input.userId,
      conversationId,
      contactId,
      bodyText: "👥 *रजिस्ट्रेशन (4/6) — टिफिन मात्रा*\n\nकितने लोगों के लिए टिफिन चाहिए? कृपया नीचे दिए गए मेनू से मात्रा चुनें:",
      buttonLabel: "मात्रा चुनें",
      sections: [
        {
          title: "मात्रा (Quantity)",
          rows: [
            { id: "qty_1", title: "1 व्यक्ति (1 Plate)" },
            { id: "qty_2", title: "2 व्यक्ति (2 Plates)" },
            { id: "qty_3", title: "3 व्यक्ति (3 Plates)" },
            { id: "qty_4", title: "4 व्यक्ति (4 Plates)" },
            { id: "qty_5", title: "5 व्यक्ति (5 Plates)" },
          ],
        },
      ],
      resolvedContext: input.resolvedContext,
    });
    return { consumed: true, flow_run_id: activeRun.id, outcome: "fallback_fired" };
  }

  // STATE: reg_summary
  if (currentState === "reg_summary") {
    if (selection === "go_back") {
      await sendWelcomeMenu(input);
      await updateRunState("main_menu");
      return { consumed: true, flow_run_id: activeRun.id, outcome: "advanced" };
    }

    if (selection === "reg_confirm_order" || text.toLowerCase() === "yes" || text.toLowerCase() === "confirm") {
      const regName = activeRun.vars.reg_name as string;
      const regPlan = activeRun.vars.reg_plan as string;
      const regQty = activeRun.vars.reg_qty as number;
      const totalPrice = activeRun.vars.reg_price as number;
      const regLocation = activeRun.vars.reg_location as string;

      // Generate a unique order number (e.g. AMAR-XXXX)
      const orderNumber = `AMAR-${Math.floor(1000 + Math.random() * 9000)}`;

      // Create a CRM deal in pipeline stage (best-effort)
      try {
        // Fetch first pipeline stage to put the deal in
        const { data: stages } = await db
          .from("pipeline_stages")
          .select("id, pipeline_id")
          .order("position", { ascending: true })
          .limit(1);

        if (stages && stages.length > 0) {
          const firstStage = stages[0];
          await db.from("deals").insert({
            account_id: accountId,
            user_id: input.userId,
            pipeline_id: firstStage.pipeline_id,
            stage_id: firstStage.id,
            contact_id: contactId,
            conversation_id: conversationId,
            title: `${regName} — Tiffin Registration`,
            value: totalPrice,
            currency: "INR",
            notes: `Order No: ${orderNumber}\nPlan: ${getPlanName(regPlan)}\nQty: ${regQty}\nLocation: ${regLocation}`,
            status: "active",
          });
        }
      } catch (dealErr) {
        console.error("Failed to create deal for registration:", dealErr);
      }

      await engineSendText({
        accountId,
        userId: input.userId,
        conversationId,
        contactId,
        text: `✅ *ऑर्डर सफलता पूर्वक प्लेस हो गया है!*\n\n📦 *ऑर्डर नंबर*: \`${orderNumber}\`\n\n💳 कृपया भुगतान करने के लिए इस UPI ID पर राशि भेजें:\n👉 *annapurnarasoi@upi* (कुल राशि: *₹${totalPrice}*)\n\nभुगतान करने के बाद, कृपया भुगतान के *स्क्रीनशॉट (Payment Proof)* को यहाँ भेजें। 🙏`,
        resolvedContext: input.resolvedContext,
      });

      await updateRunState("reg_payment", {
        reg_order_number: orderNumber
      });
      return { consumed: true, flow_run_id: activeRun.id, outcome: "advanced" };
    }

    // Reprompt summary
    const totalPrice = activeRun.vars.reg_price;
    const planId = activeRun.vars.reg_plan as string;
    const qty = activeRun.vars.reg_qty;
    const regName = activeRun.vars.reg_name;
    const regPhone = activeRun.vars.reg_phone;
    const regLocation = activeRun.vars.reg_location;
    await engineSendInteractiveButtons({
      accountId,
      userId: input.userId,
      conversationId,
      contactId,
      bodyText: `📋 *रजिस्ट्रेशन (5/6) — ऑर्डर समरी*\n\nकृपया विवरण की जांच करें:\n👤 नाम: *${regName}*\n📱 मोबाइल: *${regPhone}*\n📍 लोकेशन: *${regLocation}*\n🍛 प्लान: *${getPlanName(planId)}*\n👥 मात्रा: *${qty} व्यक्ति*\n💰 कुल राशि: *₹${totalPrice}*\n\nक्या आप इस ऑर्डर को पक्का करना चाहते हैं?`,
      buttons: [
        { id: "reg_confirm_order", title: "हाँ, पक्का करें" },
        { id: "go_back", title: "रद्द करें" },
      ],
      resolvedContext: input.resolvedContext,
    });
    return { consumed: true, flow_run_id: activeRun.id, outcome: "fallback_fired" };
  }

  // STATE: reg_payment
  if (currentState === "reg_payment") {
    if (selection === "go_back") {
      await sendWelcomeMenu(input);
      await updateRunState("main_menu");
      return { consumed: true, flow_run_id: activeRun.id, outcome: "advanced" };
    }

    // Check if the user uploaded an image message (payment screenshot proof)
    const { data: dbMsg } = await db
      .from("messages")
      .select("content_type, media_url")
      .eq("message_id", message.meta_message_id)
      .maybeSingle();

    if (dbMsg && dbMsg.content_type === "image") {
      await engineSendText({
        accountId,
        userId: input.userId,
        conversationId,
        contactId,
        text: "🙏 स्क्रीनशॉट प्राप्त हो गया है! हमारी टीम आपके पेमेंट की पुष्टि कर रही है। जल्द ही आपकी सेवा शुरू की जाएगी।",
        resolvedContext: input.resolvedContext,
      });

      await updateRunState("reg_verification", {
        payment_screenshot: dbMsg.media_url,
      });
      return { consumed: true, flow_run_id: activeRun.id, outcome: "advanced" };
    }

    // Reprompt for screenshot
    await engineSendText({
      accountId,
      userId: input.userId,
      conversationId,
      contactId,
      text: `⚠️ कृपया अपने भुगतान का *स्क्रीनशॉट (Payment Proof)* यहाँ भेजें ताकि हम आपके ऑर्डर की पुष्टि कर सकें। 🙏\n\n📦 *ऑर्डर नंबर*: \`${activeRun.vars.reg_order_number || "N/A"}\`\n💳 UPI ID: *annapurnarasoi@upi*\n💰 कुल राशि: *₹${activeRun.vars.reg_price}*`,
      resolvedContext: input.resolvedContext,
    });
    return { consumed: true, flow_run_id: activeRun.id, outcome: "fallback_fired" };
  }

  // STATE: reg_verification (awaiting agent verification)
  if (currentState === "reg_verification") {
    await engineSendText({
      accountId,
      userId: input.userId,
      conversationId,
      contactId,
      text: "🙏 आपका पेमेंट वेरिफिकेशन प्रगति पर है। हमारी टीम जल्द ही इसकी पुष्टि करेगी। किसी अन्य सहायता के लिए कृपया प्रतीक्षा करें या सहायता से संपर्क करें।",
      resolvedContext: input.resolvedContext,
    });
    return { consumed: true, flow_run_id: activeRun.id, outcome: "fallback_fired" };
  }

  return { consumed: false, outcome: "no_match" };
}
