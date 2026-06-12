"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import type { Contact, Deal, ContactNote, Tag } from "@/types";
import {
  Phone,
  Mail,
  Copy,
  Check,
  User,
  Tag as TagIcon,
  DollarSign,
  StickyNote,
  Plus,
  Truck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";

function getPlanName(planId: string): string {
  switch (planId) {
    case "plan_trial":
      return "Trial Plan (₹49)";
    case "plan_daily":
      return "Daily Plan (₹79)";
    case "plan_weekly":
      return "Weekly Plan (₹999)";
    case "plan_monthly":
      return "Monthly Plan (₹3499)";
    case "plan_executive":
      return "Executive Plan (₹1999)";
    default:
      return planId;
  }
}

const RIDERS = [
  { id: "rider_ramesh", name: "Ramesh Kumar (Rider 1)", trackingLink: "https://maps.google.com/?q=Ramesh" },
  { id: "rider_suresh", name: "Suresh Singh (Rider 2)", trackingLink: "https://maps.google.com/?q=Suresh" },
  { id: "rider_self", name: "Self Delivery (Store)", trackingLink: "https://maps.google.com/?q=Store" }
];

interface ContactSidebarProps {
  contact: Contact | null;
}

export function ContactSidebar({ contact }: ContactSidebarProps) {
  const { accountId } = useAuth();
  const [copied, setCopied] = useState(false);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [notes, setNotes] = useState<ContactNote[]>([]);
  const [tags, setTags] = useState<(Tag & { contact_tag_id: string })[]>([]);
  const [newNote, setNewNote] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [activeRun, setActiveRun] = useState<any>(null);
  const [orderRun, setOrderRun] = useState<any>(null);
  const [paymentRef, setPaymentRef] = useState("");
  const [selectedRiderId, setSelectedRiderId] = useState("");
  const [dispatching, setDispatching] = useState(false);

  const fetchContactData = useCallback(async () => {
    if (!contact) return;

    const supabase = createClient();

    // Fetch deals, notes, tags, and recent flow runs in parallel
    const [dealsRes, notesRes, tagsRes, runsRes] = await Promise.all([
      supabase
        .from("deals")
        .select("*, stage:pipeline_stages(*)")
        .eq("contact_id", contact.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("contact_notes")
        .select("*")
        .eq("contact_id", contact.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("contact_tags")
        .select("id, tag_id, tags(*)")
        .eq("contact_id", contact.id),
      supabase
        .from("flow_runs")
        .select("*")
        .eq("contact_id", contact.id)
        .order("started_at", { ascending: false })
        .limit(50),
    ]);

    if (dealsRes.data) setDeals(dealsRes.data);
    if (notesRes.data) setNotes(notesRes.data);
    if (tagsRes.data) {
      const mapped = tagsRes.data
          .filter((ct: Record<string, unknown>) => ct.tags)
          .map((ct: Record<string, unknown>) => ({
            ...(ct.tags as Tag),
            contact_tag_id: ct.id as string,
          }));
      setTags(mapped);
    }
    if (runsRes.data) {
      const runs = runsRes.data;
      const active = runs.find((r) => r.status === "active");
      const order = runs.find((r) => r.vars && r.vars.reg_order_number);
      setActiveRun(active || null);
      setOrderRun(order || null);
    } else {
      setActiveRun(null);
      setOrderRun(null);
    }
  }, [contact]);

  // Load on contact change. setContactData/setTags run inside async
  // Supabase callbacks, not synchronously in the effect body.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchContactData();
  }, [fetchContactData]);

  const handleCopyPhone = useCallback(async () => {
    if (!contact?.phone) return;
    await navigator.clipboard.writeText(contact.phone);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    // Dep is the whole `contact` object (not `contact?.phone`) so the
    // React Compiler's inference agrees with the manual dep list —
    // fixes the `preserve-manual-memoization` lint error.
  }, [contact]);

  const handleAddNote = useCallback(async () => {
    if (!contact || !newNote.trim()) return;
    if (!accountId) return;
    setAddingNote(true);

    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;

    const { data, error } = await supabase
      .from("contact_notes")
      .insert({
        contact_id: contact.id,
        account_id: accountId,
        user_id: user?.id,
        note_text: newNote.trim(),
      })
      .select()
      .single();

    if (!error && data) {
      setNotes((prev) => [data, ...prev]);
      setNewNote("");
    }
    setAddingNote(false);
  }, [contact, newNote, accountId]);

  const handleConfirmPayment = useCallback(async () => {
    if (!contact || !activeRun || !paymentRef.trim()) return;
    const supabase = createClient();

    const orderNumber = activeRun.vars.reg_order_number || "N/A";
    const referenceNo = paymentRef.trim();

    // 1) Complete active flow run
    const { error: runErr } = await supabase
      .from("flow_runs")
      .update({
        status: "completed",
        ended_at: new Date().toISOString(),
        end_reason: "payment_verified_by_agent",
        vars: {
          ...activeRun.vars,
          payment_ref: referenceNo,
        },
      })
      .eq("id", activeRun.id);

    if (runErr) {
      console.error("Failed to complete flow run:", runErr);
      alert("Failed to confirm payment.");
      return;
    }

    // 2) Send WhatsApp confirmation message by posting to /api/whatsapp/send
    const { data: conv } = await supabase
      .from("conversations")
      .select("id")
      .eq("contact_id", contact.id)
      .maybeSingle();

    if (conv) {
      try {
        await fetch("/api/whatsapp/send", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            conversation_id: conv.id,
            message_type: "text",
            content_text: `🎉 *पेमेंट कन्फर्म हो गया है!*\n\nमाँ अन्नपूर्णा रसोई की ओर से आपका भुगतान प्राप्त हो गया है।\n\n📦 *ऑर्डर नंबर*: \`${orderNumber}\`\n💳 *पेमेंट रेफरेंस*: \`${referenceNo}\`\n\nआपकी सब्सक्रिप्शन अब एक्टिव है। स्वादिष्ट और शुद्ध भोजन के लिए धन्यवाद! 🙏`,
          }),
        });
      } catch (sendErr) {
        console.error("Failed to send WhatsApp confirmation:", sendErr);
      }
    }

    setActiveRun(null);
    setPaymentRef("");
    fetchContactData();
  }, [contact, activeRun, paymentRef, fetchContactData]);

  const handleDispatchOrder = useCallback(async () => {
    if (!contact || !orderRun || !selectedRiderId) return;
    const rider = RIDERS.find((r) => r.id === selectedRiderId);
    if (!rider) return;

    setDispatching(true);
    const supabase = createClient();
    const orderNumber = orderRun.vars.reg_order_number || "N/A";

    const updatedVars = {
      ...orderRun.vars,
      dispatched: true,
      rider_name: rider.name,
      tracking_link: rider.trackingLink,
      dispatched_at: new Date().toISOString(),
    };

    // 1) Update flow run variables in DB
    const { error: runErr } = await supabase
      .from("flow_runs")
      .update({
        vars: updatedVars,
      })
      .eq("id", orderRun.id);

    if (runErr) {
      console.error("Failed to update flow run for dispatch:", runErr);
      alert("Failed to dispatch order.");
      setDispatching(false);
      return;
    }

    // 2) Send WhatsApp dispatch message to customer
    const { data: conv } = await supabase
      .from("conversations")
      .select("id")
      .eq("contact_id", contact.id)
      .maybeSingle();

    if (conv) {
      try {
        await fetch("/api/whatsapp/send", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            conversation_id: conv.id,
            message_type: "text",
            content_text: `🚚 *आपका टिफिन भेज दिया गया है!*\n\n📦 *ऑर्डर नंबर*: \`${orderNumber}\`\n👤 *राइडर*: *${rider.name}*\n\n📍 अपने डिलीवरी एजेंट को लाइव ट्रैक करने के लिए नीचे दिए गए लिंक पर क्लिक करें:\n👉 ${rider.trackingLink}\n\nस्वादिष्ट और शुद्ध भोजन का आनंद लें! 🙏`,
          }),
        });
      } catch (sendErr) {
        console.error("Failed to send WhatsApp dispatch notification:", sendErr);
      }
    }

    setSelectedRiderId("");
    setDispatching(false);
    fetchContactData();
  }, [contact, orderRun, selectedRiderId, fetchContactData]);

  if (!contact) {
    return (
      <div className="flex h-full w-70 items-center justify-center border-l border-slate-800 bg-slate-900">
        <p className="text-sm text-slate-500">Select a conversation</p>
      </div>
    );
  }

  const displayName = contact.name || contact.phone;
  const initials = displayName.charAt(0).toUpperCase();

  return (
    <div className="flex h-full w-70 flex-col border-l border-slate-800 bg-slate-900">
      <ScrollArea className="flex-1">
        <div className="p-4">
          {/* Contact Info */}
          <div className="flex flex-col items-center text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-700 text-lg font-semibold text-white">
              {contact.avatar_url ? (
                <img
                  src={contact.avatar_url}
                  alt={displayName}
                  className="h-16 w-16 rounded-full object-cover"
                />
              ) : (
                initials
              )}
            </div>
            <h3 className="mt-3 text-sm font-semibold text-white">
              {displayName}
            </h3>
            {contact.company && (
              <p className="text-xs text-slate-400">{contact.company}</p>
            )}
          </div>

          {/* Phone */}
          <div className="mt-4 space-y-2">
            <button
              onClick={handleCopyPhone}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-300 transition-colors hover:bg-slate-800"
            >
              <Phone className="h-4 w-4 text-slate-500" />
              <span className="flex-1 text-left">{contact.phone}</span>
              {copied ? (
                <Check className="h-3 w-3 text-primary" />
              ) : (
                <Copy className="h-3 w-3 text-slate-600" />
              )}
            </button>

            {contact.email && (
              <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-300">
                <Mail className="h-4 w-4 text-slate-500" />
                <span className="truncate">{contact.email}</span>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="my-4 border-t border-slate-800" />

          {/* Tags */}
          <div>
            <div className="flex items-center gap-2 px-1 text-xs font-medium uppercase tracking-wider text-slate-500">
              <TagIcon className="h-3 w-3" />
              Tags
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {tags.length === 0 ? (
                <p className="px-1 text-xs text-slate-600">No tags</p>
              ) : (
                tags.map((tag) => (
                  <span
                    key={tag.contact_tag_id}
                    className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                    style={{
                      backgroundColor: `${tag.color}20`,
                      color: tag.color,
                    }}
                  >
                    {tag.name}
                  </span>
                ))
              )}
            </div>
          </div>

          {/* Active Tiffin Registration */}
          {activeRun && activeRun.current_node_key === "reg_verification" && (
            <>
              {/* Divider */}
              <div className="my-4 border-t border-slate-800" />
              
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
                <h4 className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5 uppercase tracking-wider">
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  Payment Verification
                </h4>
                <div className="mt-2 text-xs space-y-1 text-slate-300">
                  {activeRun.vars.reg_order_number && (
                    <p>📦 Order No: <span className="font-semibold text-white">{activeRun.vars.reg_order_number}</span></p>
                  )}
                  <p>🍛 Plan: <span className="font-semibold text-white">{getPlanName(activeRun.vars.reg_plan)}</span></p>
                  <p>👥 Plates: <span className="font-semibold text-white">{activeRun.vars.reg_qty}</span></p>
                  <p>💰 Amount: <span className="font-semibold text-white">₹{activeRun.vars.reg_price}</span></p>
                  {activeRun.vars.reg_location && (
                    <p className="truncate">📍 Location: <span className="text-white">{activeRun.vars.reg_location}</span></p>
                  )}
                  {activeRun.vars.payment_screenshot && (
                    <div className="mt-2">
                      <a
                        href={activeRun.vars.payment_screenshot}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-emerald-400 underline hover:text-emerald-300 flex items-center gap-1"
                      >
                        📄 View Payment Screenshot
                      </a>
                    </div>
                  )}
                </div>

                <input
                  type="text"
                  placeholder="Enter Payment Ref (e.g. UPI ID)"
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                  className="mt-3 w-full rounded border border-slate-700 bg-slate-800/80 px-2 py-1 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                />

                <Button
                  onClick={handleConfirmPayment}
                  disabled={!paymentRef.trim()}
                  className="mt-2 w-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium py-1.5 h-auto disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Confirm Payment
                </Button>
              </div>
            </>
          )}

          {/* Dispatch Tiffin Order */}
          {activeRun && 
            activeRun.status === "completed" && 
            activeRun.vars && 
            activeRun.vars.reg_order_number && 
            !activeRun.vars.dispatched && (
            <>
              {/* Divider */}
              <div className="my-4 border-t border-slate-800" />
              
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                <h4 className="text-xs font-semibold text-amber-400 flex items-center gap-1.5 uppercase tracking-wider">
                  <Truck className="h-3.5 w-3.5 text-amber-400" />
                  Dispatch Tiffin Order
                </h4>
                <div className="mt-2 text-xs space-y-1 text-slate-300">
                  <p>📦 Order No: <span className="font-semibold text-white">{activeRun.vars.reg_order_number}</span></p>
                  <p>🍛 Plan: <span className="font-semibold text-white">{getPlanName(activeRun.vars.reg_plan)}</span></p>
                  <p>👥 Plates: <span className="font-semibold text-white">{activeRun.vars.reg_qty}</span></p>
                  {activeRun.vars.reg_location && (
                    <p className="truncate">📍 Location: <span className="text-white">{activeRun.vars.reg_location}</span></p>
                  )}
                </div>

                <div className="mt-3 space-y-2">
                  <label className="text-[10px] text-slate-400 uppercase tracking-wider block">Select Rider</label>
                  <select
                    value={selectedRiderId}
                    onChange={(e) => setSelectedRiderId(e.target.value)}
                    className="h-9 w-full rounded-lg border border-slate-700 bg-slate-800 px-2.5 text-sm text-slate-200 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                  >
                    <option value="" className="bg-slate-900 text-slate-400">-- Select Rider --</option>
                    {RIDERS.map((rider) => (
                      <option key={rider.id} value={rider.id} className="bg-slate-900 text-slate-100">
                        {rider.name}
                      </option>
                    ))}
                  </select>
                </div>

                <Button
                  onClick={handleDispatchOrder}
                  disabled={!selectedRiderId || dispatching}
                  className="mt-3 w-full bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium py-1.5 h-auto disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {dispatching ? "Dispatching..." : "Confirm Dispatch"}
                </Button>
              </div>
            </>
          )}

          {/* Dispatched Status Panel */}
          {activeRun && 
            activeRun.vars && 
            activeRun.vars.dispatched && (
            <>
              {/* Divider */}
              <div className="my-4 border-t border-slate-800" />
              
              <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-3">
                <h4 className="text-xs font-semibold text-blue-400 flex items-center gap-1.5 uppercase tracking-wider">
                  <Check className="h-3.5 w-3.5 text-blue-400" />
                  Order Dispatched
                </h4>
                <div className="mt-2 text-xs space-y-1 text-slate-300">
                  <p>📦 Order No: <span className="font-semibold text-white">{activeRun.vars.reg_order_number}</span></p>
                  <p>👤 Rider: <span className="font-semibold text-white">{activeRun.vars.rider_name}</span></p>
                  {activeRun.vars.dispatched_at && (
                    <p>🕒 Dispatched At: <span className="text-white">{format(new Date(activeRun.vars.dispatched_at), "MMM d, yyyy HH:mm")}</span></p>
                  )}
                  {activeRun.vars.tracking_link && (
                    <div className="mt-2">
                      <a
                        href={activeRun.vars.tracking_link}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-blue-400 underline hover:text-blue-300 flex items-center gap-1"
                      >
                        📍 Track Live Location
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Divider */}
          <div className="my-4 border-t border-slate-800" />

          {/* Active Deals */}
          <div>
            <div className="flex items-center gap-2 px-1 text-xs font-medium uppercase tracking-wider text-slate-500">
              <DollarSign className="h-3 w-3" />
              Active Deals
            </div>
            <div className="mt-2 space-y-2">
              {deals.length === 0 ? (
                <p className="px-1 text-xs text-slate-600">No deals</p>
              ) : (
                deals.map((deal) => (
                  <div
                    key={deal.id}
                    className="rounded-lg bg-slate-800 px-3 py-2"
                  >
                    <p className="text-sm font-medium text-white">
                      {deal.title}
                    </p>
                    <div className="mt-1 flex items-center justify-between text-xs text-slate-400">
                      <span>
                        {deal.currency ?? "$"}
                        {deal.value.toLocaleString()}
                      </span>
                      {deal.stage && (
                        <span
                          className="rounded-full px-1.5 py-0.5 text-[10px]"
                          style={{
                            backgroundColor: `${deal.stage.color}20`,
                            color: deal.stage.color,
                          }}
                        >
                          {deal.stage.name}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Divider */}
          <div className="my-4 border-t border-slate-800" />

          {/* Notes */}
          <div>
            <div className="flex items-center gap-2 px-1 text-xs font-medium uppercase tracking-wider text-slate-500">
              <StickyNote className="h-3 w-3" />
              Notes
            </div>
            <div className="mt-2">
              <div className="flex gap-2">
                <textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Add a note..."
                  rows={2}
                  className="flex-1 resize-none rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-primary/50"
                />
                <Button
                  size="sm"
                  className="h-auto bg-primary px-2 hover:bg-primary/90"
                  onClick={handleAddNote}
                  disabled={!newNote.trim() || addingNote}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>

              <div className="mt-2 space-y-2">
                {notes.map((note) => (
                  <div
                    key={note.id}
                    className="rounded-lg bg-slate-800 px-3 py-2"
                  >
                    <p className="whitespace-pre-wrap text-xs text-slate-300">
                      {note.note_text}
                    </p>
                    <p className="mt-1 text-[10px] text-slate-600">
                      {format(new Date(note.created_at), "MMM d, yyyy HH:mm")}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
