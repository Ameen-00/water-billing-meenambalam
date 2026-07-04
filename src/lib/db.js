import { supabase } from "./supabase";

// Map database rows (snake_case) <-> app objects (camelCase)
const consumerFromRow = (r) => ({
  id: r.id, consumerNo: r.consumer_no, name: r.name, meterNo: r.meter_no,
  address: r.address, category: r.category, metered: r.metered,
  prevReading: Number(r.prev_reading), openingArrears: Number(r.opening_arrears),
  phone: r.phone, status: r.status,
});
const txnFromRow = (r) => ({
  id: r.id, consumerId: r.consumer_id, type: r.type,
  amount: Number(r.amount), date: r.date, meta: r.meta, createdAt: r.created_at,
});

// Load everything the app needs in one go.
export async function fetchAll() {
  const [c, t, s] = await Promise.all([
    supabase.from("consumers").select("*").order("consumer_no"),
    supabase.from("transactions").select("*").order("created_at"),
    supabase.from("settings").select("*").eq("id", 1).maybeSingle(),
  ]);
  if (c.error) throw c.error;
  if (t.error) throw t.error;
  if (s.error) throw s.error;
  return {
    consumers: (c.data || []).map(consumerFromRow),
    txns: (t.data || []).map(txnFromRow),
    tariff: s.data?.tariff || null,
  };
}

// Insert a bill or payment; returns the saved transaction (with its new id).
export async function insertTransaction({ consumerId, type, amount, date, meta }) {
  const { data, error } = await supabase
    .from("transactions")
    .insert({ consumer_id: consumerId, type, amount, date, meta })
    .select()
    .single();
  if (error) throw error;
  return txnFromRow(data);
}

export async function insertConsumer(c) {
  const row = {
    consumer_no: c.consumerNo, name: c.name, meter_no: c.meterNo, address: c.address,
    category: c.category, metered: c.metered, prev_reading: c.prevReading,
    opening_arrears: c.openingArrears, phone: c.phone, status: c.status || "active",
  };
  const { data, error } = await supabase.from("consumers").insert(row).select().single();
  if (error) throw error;
  return consumerFromRow(data);
}

export async function updatePrevReading(consumerId, prevReading) {
  const { error } = await supabase.from("consumers").update({ prev_reading: prevReading }).eq("id", consumerId);
  if (error) throw error;
}

export async function saveTariffToDb(tariff) {
  const { error } = await supabase
    .from("settings")
    .update({ tariff, updated_at: new Date().toISOString() })
    .eq("id", 1);
  if (error) throw error;
}
