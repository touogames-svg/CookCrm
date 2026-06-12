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
🍽️ *TIFFIN PACKAGE DETAILS* 🍽️
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

const VOTING_OPTIONS: Record<
  string,
  {
    title: string;
    label: string;
    description: string;
    options: { id: string; label: string; btnLabel: string }[];
  }
> = {
  monday: {
    title: "सोमवार (Monday) के लिए सब्जी चुनें:",
    label: "सोमवार (Monday)",
    description: "1️⃣ Dal Tadka + Aloo Gobhi\n2️⃣ Chole Masala + Paneer",
    options: [
      { id: "mon_opt_a", label: "Dal Tadka + Aloo Gobhi", btnLabel: "Dal Tadka + Aloo" },
      { id: "mon_opt_b", label: "Chole Masala + Paneer", btnLabel: "Chole + Paneer" },
    ],
  },
  tuesday: {
    title: "मंगलवार (Tuesday) के लिए सब्जी चुनें:",
    label: "मंगलवार (Tuesday)",
    description: "1️⃣ Chole Masala + Aloo Matar\n2️⃣ Rajma Masala + Seasonal Veg",
    options: [
      { id: "tue_opt_a", label: "Chole Masala + Aloo Matar", btnLabel: "Chole + Aloo Matar" },
      { id: "tue_opt_b", label: "Rajma Masala + Seasonal Veg", btnLabel: "Rajma + Mix Veg" },
    ],
  },
  wednesday: {
    title: "बुधवार (Wednesday) के लिए सब्जी चुनें:",
    label: "बुधवार (Wednesday)",
    description: "1️⃣ Moong Dal Fry + Mix Veg\n2️⃣ Dal Makhani + Aloo Gobhi",
    options: [
      { id: "wed_opt_a", label: "Moong Dal Fry + Mix Veg", btnLabel: "Moong Dal + Veg" },
      { id: "wed_opt_b", label: "Dal Makhani + Aloo Gobhi", btnLabel: "Dal Makhani + Aloo" },
    ],
  },
  thursday: {
    title: "गुरुवार (Thursday) के लिए सब्जी चुनें:",
    label: "गुरुवार (Thursday)",
    description: "1️⃣ Rajma Masala + Aloo Beans\n2️⃣ Kadhi Pakora + Seasonal Veg",
    options: [
      { id: "thu_opt_a", label: "Rajma Masala + Aloo Beans", btnLabel: "Rajma + Aloo Beans" },
      { id: "thu_opt_b", label: "Kadhi Pakora + Seasonal Veg", btnLabel: "Kadhi + Mix Veg" },
    ],
  },
  friday: {
    title: "शुक्रवार (Friday) के लिए सब्जी चुनें:",
    label: "शुक्रवार (Friday)",
    description: "1️⃣ Dal Makhani + Seasonal Veg\n2️⃣ Shahi Paneer + Dal Tadka",
    options: [
      { id: "fri_opt_a", label: "Dal Makhani + Seasonal Veg", btnLabel: "Dal Makhani + Veg" },
      { id: "fri_opt_b", label: "Shahi Paneer + Dal Tadka", btnLabel: "Paneer + Dal Tadka" },
    ],
  },
  saturday: {
    title: "शनिवार (Saturday) के लिए सब्जी चुनें:",
    label: "शनिवार (Saturday)",
    description: "1️⃣ Kadhi Pakora + Aloo Jeera\n2️⃣ Moong Dal Fry + Aloo Beans",
    options: [
      { id: "sat_opt_a", label: "Kadhi Pakora + Aloo Jeera", btnLabel: "Kadhi + Aloo Jeera" },
      { id: "sat_opt_b", label: "Moong Dal Fry + Aloo Beans", btnLabel: "Moong Dal + Beans" },
    ],
  },
  sunday: {
    title: "रविवार (Sunday) के लिए सब्जी चुनें:",
    label: "रविवार (Sunday)",
    description: "1️⃣ Shahi Paneer + Dal Tadka\n2️⃣ Paneer Bhurji + Dal Makhani",
    options: [
      { id: "sun_opt_a", label: "Shahi Paneer + Dal Tadka", btnLabel: "Paneer + Dal Tadka" },
      { id: "sun_opt_b", label: "Paneer Bhurji + Dal Makhani", btnLabel: "Bhurji + Makhani" },
    ],
  },
};

// ── Calendar & Subscription helpers ──────────────────────────

async function getSubscriptionRun(db: any, contactId: string) {
  const { data: runs } = await db
    .from("flow_runs")
    .select("*")
    .eq("contact_id", contactId)
    .order("started_at", { ascending: false });
  
  if (!runs) return null;
  return runs.find((r: any) => r.vars && r.vars.reg_order_number && (r.status === "completed" || r.vars.payment_ref));
}

function getLocalISODate(date: Date): string {
  // IST is UTC+5:30
  const offset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(date.getTime() + offset);
  return istDate.toISOString().split("T")[0];
}

function getDatesBetween(startDateStr: string, endDateStr: string): string[] {
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  const dates: string[] = [];
  
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  
  while (start <= end) {
    dates.push(getLocalISODate(start));
    start.setDate(start.getDate() + 1);
  }
  return dates;
}

function generateCalendarText(orderRun: any): string {
  const vars = orderRun.vars || {};
  const pausedDates = new Set<string>(vars.paused_dates || []);
  const deliveredDates = new Set<string>(vars.delivered_dates || []);
  const isPaused = !!vars.is_paused;
  const pausedAtStr = vars.paused_at;
  const dispatchedDateStr = vars.dispatched_at ? getLocalISODate(new Date(vars.dispatched_at)) : null;

  const startStr = vars.dispatched_at || orderRun.ended_at || orderRun.started_at;
  const startDate = new Date(startStr);
  
  const now = new Date();
  const todayStr = getLocalISODate(now);
  const pausedAtDateStr = pausedAtStr ? getLocalISODate(new Date(pausedAtStr)) : null;

  const daysList: { dateStr: string; label: string; status: 'delivered' | 'paused' | 'pending' }[] = [];

  for (let i = 0; i < 30; i++) {
    const d = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
    const dStr = getLocalISODate(d);
    
    const dayNum = d.getDate();
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthLabel = months[d.getMonth()];
    const label = `${dayNum}-${monthLabel}`;

    let status: 'delivered' | 'paused' | 'pending' = 'pending';

    if (pausedDates.has(dStr)) {
      status = 'paused';
    } else if (isPaused && pausedAtDateStr && dStr >= pausedAtDateStr) {
      status = 'paused';
    } else if (deliveredDates.has(dStr) || (dispatchedDateStr && dStr === dispatchedDateStr)) {
      status = 'delivered';
    } else if (dStr < todayStr) {
      status = 'delivered';
    }

    daysList.push({ dateStr: dStr, label, status });
  }

  let txt = `📅 *टिफिन डिलीवरी कैलेंडर (Monthly Package)*\n\n`;
  txt += `✅ - Delivered (डिलीवर हो गया)\n`;
  txt += `🟡 - Paused (रोका गया)\n`;
  txt += `🔵 - To be delivered (होने वाला)\n\n`;

  for (let w = 0; w < 5; w++) {
    txt += `*सप्ताह ${w + 1} (Week ${w + 1}):*\n`;
    const weekDays = daysList.slice(w * 7, (w + 1) * 7);
    if (weekDays.length === 0) break;

    const part1 = weekDays.slice(0, 4);
    const part2 = weekDays.slice(4);

    const formatDay = (item: typeof daysList[0]) => {
      const emoji = item.status === 'delivered' ? '✅' : item.status === 'paused' ? '🟡' : '🔵';
      return `${emoji} ${item.label}`;
    };

    txt += part1.map(formatDay).join("  |  ") + "\n";
    if (part2.length > 0) {
      txt += part2.map(formatDay).join("  |  ") + "\n";
    }
    txt += "\n";
  }

  return txt.trim();
}

// ── Outbound message helpers ─────────────────────────────────

async function sendWelcomeMenu(input: DispatchInboundInput) {
  const db = supabaseAdmin();
  const subRun = await getSubscriptionRun(db, input.contactId);
  const isSubscribed = !!subRun;

  const text = `Maa annapurna rasoi में आपका हृदय से स्वागत है 🙏\n"घर जैसा शुद्ध और पौष्टिक भोजन, आपसे सिर्फ एक क्लिक की दूरी पर".`;
  
  const rows = [
    { id: "menu_menu", title: "1️⃣ Menu", description: "Weekly tiffin menu board" },
    { id: "menu_rate", title: "2️⃣ Package", description: "Tiffin plans & pricing" },
  ];

  if (isSubscribed) {
    rows.push({ id: "menu_pause", title: "3️⃣ Pause Delivery", description: "Pause/resume your food deliveries" });
  } else {
    rows.push({ id: "menu_reg", title: "3️⃣ Registration", description: "Register & order your tiffin" });
  }

  rows.push(
    { id: "menu_lang", title: "4️⃣ Language", description: "Select preferred language" },
    { id: "menu_support", title: "5️⃣ Support", description: "Get support or contact agent" },
    { id: "menu_vote", title: "6️⃣ Tiffin Voting", description: "Vote for what to cook" }
  );

  if (isSubscribed) {
    rows.push({ id: "menu_calendar", title: "7️⃣ Delivery Calendar", description: "View your tiffin delivery calendar" });
  }

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
        rows: rows,
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

  // Load subscription status
  const subRun = await getSubscriptionRun(db, contactId);
  const isSubscribed = !!subRun;

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
      else if (cleanText === "2" || cleanText.includes("rate") || cleanText.includes("price") || cleanText.includes("package") || cleanText.includes("पैकेज")) selection = "menu_rate";
      else if (cleanText === "3") {
        selection = isSubscribed ? "menu_pause" : "menu_reg";
      } else if (cleanText.includes("reg") || cleanText.includes("register") || cleanText.includes("order")) {
        selection = "menu_reg";
      } else if (cleanText.includes("pause") || cleanText.includes("resume") || cleanText.includes("रोकें")) {
        selection = "menu_pause";
      } else if (cleanText === "4" || cleanText.includes("lang") || cleanText.includes("bhasha") || cleanText.includes("भाषा")) selection = "menu_lang";
      else if (cleanText === "5" || cleanText.includes("support") || cleanText.includes("help") || cleanText.includes("सहायता")) selection = "menu_support";
      else if (cleanText === "6" || cleanText.includes("vote") || cleanText.includes("voting") || cleanText.includes("चुनाव") || cleanText.includes("मतदान")) selection = "menu_vote";
      else if (cleanText === "7" || cleanText.includes("calendar") || cleanText.includes("calender") || cleanText.includes("कैलेंडर")) selection = "menu_calendar";
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

    if (selection === "menu_pause") {
      if (!subRun) {
        await sendWelcomeMenu(input);
        return { consumed: true, flow_run_id: activeRun.id, outcome: "fallback_fired" };
      }
      const isPaused = !!subRun.vars.is_paused;
      if (isPaused) {
        await engineSendInteractiveButtons({
          accountId,
          userId: input.userId,
          conversationId,
          contactId,
          bodyText: "🔴 आपकी टिफिन डिलीवरी अभी *PAUSED (रुकी हुई)* है।\n\nक्या आप इसे फिर से शुरू करना चाहते हैं?",
          buttons: [
            { id: "sub_action_resume", title: "▶️ Resume Delivery" },
            { id: "go_back", title: "⬅️ Back to Menu" },
          ],
          resolvedContext: input.resolvedContext,
        });
      } else {
        await engineSendInteractiveButtons({
          accountId,
          userId: input.userId,
          conversationId,
          contactId,
          bodyText: "🟢 आपकी टिफिन डिलीवरी अभी *ACTIVE (चालू)* है।\n\nक्या आप इसे रोकना चाहते हैं?",
          buttons: [
            { id: "sub_action_pause", title: "⏸️ Pause Delivery" },
            { id: "go_back", title: "⬅️ Back to Menu" },
          ],
          resolvedContext: input.resolvedContext,
        });
      }
      await updateRunState("pause_view");
      return { consumed: true, flow_run_id: activeRun.id, outcome: "advanced" };
    }

    if (selection === "menu_calendar") {
      if (!subRun) {
        await sendWelcomeMenu(input);
        return { consumed: true, flow_run_id: activeRun.id, outcome: "fallback_fired" };
      }
      const calText = generateCalendarText(subRun);
      await engineSendText({
        accountId,
        userId: input.userId,
        conversationId,
        contactId,
        text: calText,
        resolvedContext: input.resolvedContext,
      });
      await sendBackToMenuButton(input, "मुख्य मेनू पर वापस जाने के लिए नीचे बटन दबाएं। 👇");
      await updateRunState("calendar_view");
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

    if (selection === "menu_vote") {
      await engineSendInteractiveList({
        accountId,
        userId: input.userId,
        conversationId,
        contactId,
        bodyText: "🗳️ *टिफिन वोटिंग (Tiffin Voting)*\n\nकृपया उस दिन को चुनें जिसके लिए आप मतदान करना चाहते हैं:",
        buttonLabel: "दिन चुनें",
        sections: [
          {
            title: "सप्ताह के दिन (Days)",
            rows: [
              { id: "day_monday", title: "सोमवार (Monday)" },
              { id: "day_tuesday", title: "मंगलवार (Tuesday)" },
              { id: "day_wednesday", title: "बुधवार (Wednesday)" },
              { id: "day_thursday", title: "गुरुवार (Thursday)" },
              { id: "day_friday", title: "शुक्रवार (Friday)" },
              { id: "day_saturday", title: "शनिवार (Saturday)" },
              { id: "day_sunday", title: "रविवार (Sunday)" },
            ],
          },
        ],
        resolvedContext: input.resolvedContext,
      });

      await updateRunState("menu_vote_day_list");
      return { consumed: true, flow_run_id: activeRun.id, outcome: "advanced" };
    }

    // Reprompt
    await sendWelcomeMenu(input);
    return { consumed: true, flow_run_id: activeRun.id, outcome: "fallback_fired" };
  }

  // STATE: calendar_view
  if (currentState === "calendar_view") {
    if (selection === "go_back") {
      await sendWelcomeMenu(input);
      await updateRunState("main_menu");
      return { consumed: true, flow_run_id: activeRun.id, outcome: "advanced" };
    }
    // Reprompt back button
    await sendBackToMenuButton(input, "मुख्य मेनू पर वापस जाने के लिए नीचे बटन दबाएं। 👇");
    return { consumed: true, flow_run_id: activeRun.id, outcome: "fallback_fired" };
  }

  // STATE: pause_view
  if (currentState === "pause_view") {
    if (selection === "go_back") {
      await sendWelcomeMenu(input);
      await updateRunState("main_menu");
      return { consumed: true, flow_run_id: activeRun.id, outcome: "advanced" };
    }

    if (!subRun) {
      await sendWelcomeMenu(input);
      await updateRunState("main_menu");
      return { consumed: true, flow_run_id: activeRun.id, outcome: "advanced" };
    }

    if (selection === "sub_action_pause") {
      const updatedVars = {
        ...(subRun.vars || {}),
        is_paused: true,
        paused_at: new Date().toISOString(),
      };

      // Save in DB
      await db
        .from("flow_runs")
        .update({ vars: updatedVars })
        .eq("id", subRun.id);

      await engineSendText({
        accountId,
        userId: input.userId,
        conversationId,
        contactId,
        text: "⏸️ *आपकी टिफिन डिलीवरी सफलतापूर्वक रोक (Pause) दी गई है!*",
        resolvedContext: input.resolvedContext,
      });

      await sendBackToMenuButton(input, "मुख्य मेनू पर वापस जाने के लिए नीचे बटन दबाएं। 👇");
      await updateRunState("pause_confirmed");
      return { consumed: true, flow_run_id: activeRun.id, outcome: "advanced" };
    }

    if (selection === "sub_action_resume") {
      let pausedDates = [...(subRun.vars.paused_dates || [])];
      if (subRun.vars.paused_at) {
        const pausedAtDate = getLocalISODate(new Date(subRun.vars.paused_at));
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = getLocalISODate(yesterday);
        
        if (pausedAtDate <= yesterdayStr) {
          const dates = getDatesBetween(subRun.vars.paused_at, yesterdayStr);
          pausedDates = Array.from(new Set([...pausedDates, ...dates]));
        }
      }

      const updatedVars = {
        ...(subRun.vars || {}),
        is_paused: false,
        paused_at: null,
        paused_dates: pausedDates,
      };

      // Save in DB
      await db
        .from("flow_runs")
        .update({ vars: updatedVars })
        .eq("id", subRun.id);

      await engineSendText({
        accountId,
        userId: input.userId,
        conversationId,
        contactId,
        text: "▶️ *आपकी टिफिन डिलीवरी सफलतापूर्वक पुनः चालू (Resume) कर दी गई है!* आपकी सेवा कल से फिर से शुरू हो जाएगी।",
        resolvedContext: input.resolvedContext,
      });

      await sendBackToMenuButton(input, "मुख्य मेनू पर वापस जाने के लिए नीचे बटन दबाएं। 👇");
      await updateRunState("pause_confirmed");
      return { consumed: true, flow_run_id: activeRun.id, outcome: "advanced" };
    }

    // Reprompt
    const isPaused = !!subRun.vars.is_paused;
    if (isPaused) {
      await engineSendInteractiveButtons({
        accountId,
        userId: input.userId,
        conversationId,
        contactId,
        bodyText: "🔴 आपकी टिफिन डिलीवरी अभी *PAUSED (रुकी हुई)* है।\n\nक्या आप इसे फिर से शुरू करना चाहते हैं?",
        buttons: [
          { id: "sub_action_resume", title: "▶️ Resume Delivery" },
          { id: "go_back", title: "⬅️ Back to Menu" },
        ],
        resolvedContext: input.resolvedContext,
      });
    } else {
      await engineSendInteractiveButtons({
        accountId,
        userId: input.userId,
        conversationId,
        contactId,
        bodyText: "🟢 आपकी टिफिन डिलीवरी अभी *ACTIVE (चालू)* है।\n\nक्या आप इसे रोकना चाहते हैं?",
        buttons: [
          { id: "sub_action_pause", title: "⏸️ Pause Delivery" },
          { id: "go_back", title: "⬅️ Back to Menu" },
        ],
        resolvedContext: input.resolvedContext,
      });
    }
    return { consumed: true, flow_run_id: activeRun.id, outcome: "fallback_fired" };
  }

  // STATE: pause_confirmed
  if (currentState === "pause_confirmed") {
    if (selection === "go_back") {
      await sendWelcomeMenu(input);
      await updateRunState("main_menu");
      return { consumed: true, flow_run_id: activeRun.id, outcome: "advanced" };
    }
    // Reprompt back button
    await sendBackToMenuButton(input, "मुख्य मेनू पर वापस जाने के लिए नीचे बटन दबाएं। 👇");
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

  // STATE: menu_vote_day_list
  if (currentState === "menu_vote_day_list") {
    if (selection === "go_back") {
      await sendWelcomeMenu(input);
      await updateRunState("main_menu");
      return { consumed: true, flow_run_id: activeRun.id, outcome: "advanced" };
    }

    let selectedDay: string | null = null;
    if (selection && selection.startsWith("day_")) {
      selectedDay = selection.replace("day_", "");
    } else if (message.kind === "text") {
      const cleanText = text.toLowerCase();
      if (cleanText.includes("mon") || cleanText.includes("सोम")) selectedDay = "monday";
      else if (cleanText.includes("tue") || cleanText.includes("मंग")) selectedDay = "tuesday";
      else if (cleanText.includes("wed") || cleanText.includes("बुध")) selectedDay = "wednesday";
      else if (cleanText.includes("thu") || cleanText.includes("गुरु")) selectedDay = "thursday";
      else if (cleanText.includes("fri") || cleanText.includes("शुक्र")) selectedDay = "friday";
      else if (cleanText.includes("sat") || cleanText.includes("शनि")) selectedDay = "saturday";
      else if (cleanText.includes("sun") || cleanText.includes("रवि")) selectedDay = "sunday";
    }

    if (selectedDay && VOTING_OPTIONS[selectedDay]) {
      const dayConfig = VOTING_OPTIONS[selectedDay];
      
      // Send interactive buttons for the selected day options
      await engineSendInteractiveButtons({
        accountId,
        userId: input.userId,
        conversationId,
        contactId,
        bodyText: `🗳️ *${dayConfig.title}*\n\n${dayConfig.description}\n\nकृपया अपनी पसंद की सब्जी जोड़ी चुनें:`,
        buttons: dayConfig.options.map((opt) => ({
          id: `vote_opt_${opt.id}`,
          title: opt.btnLabel,
        })),
        resolvedContext: input.resolvedContext,
      });

      await updateRunState("menu_vote_day_selected", {
        vote_selected_day: selectedDay,
      });
      return { consumed: true, flow_run_id: activeRun.id, outcome: "advanced" };
    }

    // Reprompt day list
    await engineSendInteractiveList({
      accountId,
      userId: input.userId,
      conversationId,
      contactId,
      bodyText: "🗳️ *टिफिन वोटिंग (Tiffin Voting)*\n\nकृपया उस दिन को चुनें जिसके लिए आप मतदान करना चाहते हैं:",
      buttonLabel: "दिन चुनें",
      sections: [
        {
          title: "सप्ताह के दिन (Days)",
          rows: [
            { id: "day_monday", title: "सोमवार (Monday)" },
            { id: "day_tuesday", title: "मंगलवार (Tuesday)" },
            { id: "day_wednesday", title: "बुधवार (Wednesday)" },
            { id: "day_thursday", title: "गुरुवार (Thursday)" },
            { id: "day_friday", title: "शुक्रवार (Friday)" },
            { id: "day_saturday", title: "शनिवार (Saturday)" },
            { id: "day_sunday", title: "रविवार (Sunday)" },
          ],
        },
      ],
      resolvedContext: input.resolvedContext,
    });
    return { consumed: true, flow_run_id: activeRun.id, outcome: "fallback_fired" };
  }

  // STATE: menu_vote_day_selected
  if (currentState === "menu_vote_day_selected") {
    if (selection === "go_back") {
      // Send interactive list of days
      await engineSendInteractiveList({
        accountId,
        userId: input.userId,
        conversationId,
        contactId,
        bodyText: "🗳️ *टिफिन वोटिंग (Tiffin Voting)*\n\nकृपया उस दिन को चुनें जिसके लिए आप मतदान करना चाहते हैं:",
        buttonLabel: "दिन चुनें",
        sections: [
          {
            title: "सप्ताह के दिन (Days)",
            rows: [
              { id: "day_monday", title: "सोमवार (Monday)" },
              { id: "day_tuesday", title: "मंगलवार (Tuesday)" },
              { id: "day_wednesday", title: "बुधवार (Wednesday)" },
              { id: "day_thursday", title: "गुरुवार (Thursday)" },
              { id: "day_friday", title: "शुक्रवार (Friday)" },
              { id: "day_saturday", title: "शनिवार (Saturday)" },
              { id: "day_sunday", title: "रविवार (Sunday)" },
            ],
          },
        ],
        resolvedContext: input.resolvedContext,
      });

      await updateRunState("menu_vote_day_list");
      return { consumed: true, flow_run_id: activeRun.id, outcome: "advanced" };
    }

    const selectedDay = activeRun.vars.vote_selected_day as string;
    const dayConfig = VOTING_OPTIONS[selectedDay];

    let voteOptionId: string | null = null;
    if (selection && selection.startsWith("vote_opt_")) {
      voteOptionId = selection.replace("vote_opt_", "");
    } else if (message.kind === "text") {
      const cleanText = text.toLowerCase();
      // Map 1/2 or keywords
      if (cleanText === "1" || cleanText.includes("a") || cleanText.includes("first")) {
        voteOptionId = dayConfig.options[0].id;
      } else if (cleanText === "2" || cleanText.includes("b") || cleanText.includes("second")) {
        voteOptionId = dayConfig.options[1].id;
      }
    }

    if (voteOptionId && dayConfig.options.some((o) => o.id === voteOptionId)) {
      // Check if user already voted for this day
      const oldVotes: Record<string, string> = (activeRun.vars.votes as Record<string, string>) || {};
      const alreadyVoted = !!oldVotes[selectedDay];

      // Save vote inside variables map
      const votes: Record<string, string> = { ...oldVotes };
      votes[selectedDay] = voteOptionId;

      // Update flow run variables in DB
      await db
        .from("flow_runs")
        .update({
          vars: {
            ...activeRun.vars,
            votes,
          },
        })
        .eq("id", activeRun.id);

      // Fetch all runs to calculate voting results percentages
      const { data: voteRuns } = await db
        .from("flow_runs")
        .select("contact_id, vars")
        .eq("account_id", accountId)
        .order("started_at", { ascending: false })
        .limit(500);

      // Deduplicate on contact_id to count only the latest run per contact
      const uniqueVotes: Record<string, Record<string, string>> = {};
      for (const run of voteRuns || []) {
        if (run.vars && run.vars.votes && run.contact_id) {
          if (!uniqueVotes[run.contact_id]) {
            uniqueVotes[run.contact_id] = run.vars.votes as Record<string, string>;
          }
        }
      }

      // Count votes for selected day
      let totalVotes = 0;
      const counts: Record<string, number> = {};
      for (const opt of dayConfig.options) {
        counts[opt.id] = 0;
      }

      for (const cid in uniqueVotes) {
        const uVotes = uniqueVotes[cid];
        const voteVal = uVotes[selectedDay];
        if (voteVal && counts[voteVal] !== undefined) {
          counts[voteVal]++;
          totalVotes++;
        }
      }

      // Format results message
      let resultText = `🗳️ *${dayConfig.label} के लिए मतदान के परिणाम:*\n\n`;
      for (const opt of dayConfig.options) {
        const count = counts[opt.id] || 0;
        const percentage = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
        resultText += `🔸 *${opt.label}*: *${percentage}%* (${count} vote${count !== 1 ? "s" : ""})\n`;
      }
      resultText += `\n📊 *कुल वोट (Total Votes):* ${totalVotes}\n\n`;
      if (alreadyVoted) {
        resultText += `ℹ️ *आपने इस दिन के लिए पहले भी वोट किया था। आपका नया वोट अपडेट कर दिया गया है!*`;
      } else {
        resultText += `आपका वोट दर्ज कर लिया गया है। धन्यवाद! 🙏`;
      }

      // Send results with navigation buttons
      await engineSendInteractiveButtons({
        accountId,
        userId: input.userId,
        conversationId,
        contactId,
        bodyText: resultText,
        buttons: [
          { id: "vote_go_days", title: "⬅️ Back to Days" },
          { id: "go_back", title: "🏠 Main Menu" },
        ],
        resolvedContext: input.resolvedContext,
      });

      await updateRunState("menu_vote_result");
      return { consumed: true, flow_run_id: activeRun.id, outcome: "advanced" };
    }

    // Reprompt selection
    await engineSendInteractiveButtons({
      accountId,
      userId: input.userId,
      conversationId,
      contactId,
      bodyText: `⚠️ *अमान्य चयन (Invalid Selection)*\n\n🗳️ *${dayConfig.title}*\n\n${dayConfig.description}\n\nकृपया अपनी पसंद की सब्जी जोड़ी चुनें:`,
      buttons: dayConfig.options.map((opt) => ({
        id: `vote_opt_${opt.id}`,
        title: opt.btnLabel,
      })),
      resolvedContext: input.resolvedContext,
    });
    return { consumed: true, flow_run_id: activeRun.id, outcome: "fallback_fired" };
  }

  // STATE: menu_vote_result
  if (currentState === "menu_vote_result") {
    if (selection === "vote_go_days" || text.toLowerCase().includes("day") || text === "1") {
      // Send interactive list of days
      await engineSendInteractiveList({
        accountId,
        userId: input.userId,
        conversationId,
        contactId,
        bodyText: "🗳️ *टिफिन वोटिंग (Tiffin Voting)*\n\nकृपया उस दिन को चुनें जिसके लिए आप मतदान करना चाहते हैं:",
        buttonLabel: "दिन चुनें",
        sections: [
          {
            title: "सप्ताह के दिन (Days)",
            rows: [
              { id: "day_monday", title: "सोमवार (Monday)" },
              { id: "day_tuesday", title: "मंगलवार (Tuesday)" },
              { id: "day_wednesday", title: "बुधवार (Wednesday)" },
              { id: "day_thursday", title: "गुरुवार (Thursday)" },
              { id: "day_friday", title: "शुक्रवार (Friday)" },
              { id: "day_saturday", title: "शनिवार (Saturday)" },
              { id: "day_sunday", title: "रविवार (Sunday)" },
            ],
          },
        ],
        resolvedContext: input.resolvedContext,
      });

      await updateRunState("menu_vote_day_list");
      return { consumed: true, flow_run_id: activeRun.id, outcome: "advanced" };
    }

    if (selection === "go_back" || text.toLowerCase().includes("menu") || text === "2") {
      await sendWelcomeMenu(input);
      await updateRunState("main_menu");
      return { consumed: true, flow_run_id: activeRun.id, outcome: "advanced" };
    }

    // Reprompt navigation options
    await engineSendInteractiveButtons({
      accountId,
      userId: input.userId,
      conversationId,
      contactId,
      bodyText: "वोटिंग मेनू में वापस जाने या मुख्य मेनू पर लौटने के लिए नीचे दिए गए बटन चुनें: 👇",
      buttons: [
        { id: "vote_go_days", title: "⬅️ Back to Days" },
        { id: "go_back", title: "🏠 Main Menu" },
      ],
      resolvedContext: input.resolvedContext,
    });
    return { consumed: true, flow_run_id: activeRun.id, outcome: "fallback_fired" };
  }

  return { consumed: false, outcome: "no_match" };
}
