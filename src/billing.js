// ---------------------------------------------------------------------------
// Water Billing — data, config, and calculation logic
//
// Kolayil Kudivella Suchithwa Samithi tariff (slab based, split calculation):
//   0–7,000 L        -> ₹75          |  7,001–10,000 L  -> ₹100
//   10,001–12,500 L  -> ₹125         |  12,501–15,000 L -> ₹150
//   15,001–20,000 L  -> ₹5 per 100 L (on that portion only)
//   Above 20,000 L   -> Jan–May ₹10 per 50 L, Jun–Dec ₹5 per 50 L (that portion)
//   + ₹5 meter fee on every bill.  Disconnected -> ₹30 + ₹5 meter fee.
// Each band is charged separately and shown as its own line on the bill.
// ---------------------------------------------------------------------------

export const CURRENCY = "₹";

export const scheme = {
  name: "Kolayil Kudivella Suchithwa Samithi",
  malayalamName: "കോലയിൽ കുടിവെള്ള ശുചിത്വ സമിതി",
  subtitle: "Meenambalam, Kalluvathukkal · Reg. No. Q 1060/02",
  phone: "+91 81389 71257",
  // Cash-only for launch. Next month: set showUpi = true AND put the REAL UPI
  // id below, then the "Scan to pay" QR comes back on every bill/receipt.
  showUpi: false,
  upi: {
    vpa: "kollamwater@sbi",
    payeeName: "Kolayil Water Samithi",
    account: "SBI · A/c 3021 5566 7788 · IFSC SBIN0001234",
  },
};

export const initialTariff = {
  // Flat slabs covering the first 15,000 litres
  slabs: [
    { upTo: 7000, amount: 70 },
    { upTo: 10000, amount: 100 },
    { upTo: 12500, amount: 125 },
    { upTo: 15000, amount: 150 },
  ],
  // Middle band: 15,001–20,000 at ₹5 per 100 L (that portion only)
  midFrom: 15000, midTo: 20000, midPer: 100, midRate: 5,
  // High band: above 20,000, seasonal, per 50 L (that portion only)
  highFrom: 20000, highPer: 50, highRateJanMay: 10, highRateJunDec: 5,
  meterFee: 5,
  disconnectedCharge: 30,
  // Fixed calendar due dates each month: pay by the 20th (no fine), 25th (with fine).
  dueDayNoFine: 20,
  dueDayWithFine: 25,
};

// Friendly names for staff logins, keyed by the mobile part of the login.
// Add more here as more readers/admins are created (e.g. "9037979978": "Office").
export const staffNames = {
  "9745899685": "Gireesh",
};
export function readerLabel(readerName) {
  if (!readerName) return "";
  const id = String(readerName).replace(/@kolayil\.local$/i, "");
  return staffNames[id] || id;
}

export function money(n) {
  const v = Math.round((Math.abs(n) + Number.EPSILON) * 100) / 100;
  const s = CURRENCY + v.toLocaleString("en-IN");
  return n < 0 ? "-" + s : s;
}

const grp = (n) => Number(n).toLocaleString("en-IN");
const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

export function categoryLabel(c) {
  return c ? c.charAt(0).toUpperCase() + c.slice(1) : "—";
}

// Balance = opening old dues + all bills − all payments.
export function balanceOf(consumer, txns) {
  return txns
    .filter((t) => t.consumerId === consumer.id)
    .reduce((b, t) => (t.type === "bill" ? b + t.amount : b - t.amount), consumer.openingArrears);
}

// Is this bill month in the Jan–May season?
export function isJanMay(date = new Date()) {
  const m = date.getMonth() + 1;
  return m >= 1 && m <= 5;
}

// -- THE CORE CALCULATION (split band by band) ----------------------------
export function calculateCharge(consumer, currentReading, tariff, meterReset = false, billDate = new Date()) {
  const t = { ...initialTariff, ...(tariff || {}) };
  const meterFee = Number(t.meterFee ?? 5);

  // Disconnected connections: flat charge + meter fee, no reading needed.
  if (consumer.status === "disconnected") {
    const amt = Number(t.disconnectedCharge ?? 30);
    return {
      metered: false, disconnected: true, meterReset: false,
      prevReading: consumer.prevReading, currentReading: null, consumption: 0,
      parts: [{ label: "Disconnected", detail: "", amount: amt }],
      waterCharge: amt, meterFee, currentCharge: Math.round(amt + meterFee), season: null,
    };
  }

  let consumption = 0;
  let prev = consumer.prevReading;
  let curr = null;
  if (consumer.metered) {
    curr = Number(currentReading);
    consumption = meterReset ? Math.max(0, curr) : Math.max(0, curr - consumer.prevReading);
    if (meterReset) prev = 0;
  }

  const parts = [];
  const slabs = t.slabs && t.slabs.length ? t.slabs : initialTariff.slabs;
  const topSlab = slabs[slabs.length - 1];

  // 1) Base slab — covers the first 15,000 L
  let base = Number(topSlab.amount);
  let baseLabel = `First ${grp(topSlab.upTo)} L`;
  for (let i = 0; i < slabs.length; i++) {
    if (consumption <= Number(slabs[i].upTo)) {
      base = Number(slabs[i].amount);
      const from = i === 0 ? 0 : Number(slabs[i - 1].upTo) + 1;
      baseLabel = `${grp(from)}–${grp(slabs[i].upTo)} L`;
      break;
    }
  }
  parts.push({ label: baseLabel, detail: "", amount: base });

  // 2) Middle band — only the litres between midFrom and midTo
  const midFrom = Number(t.midFrom ?? 15000);
  const midTo = Number(t.midTo ?? 20000);
  const midPer = Number(t.midPer ?? 100);
  const midRate = Number(t.midRate ?? 5);
  const midLitres = Math.max(0, Math.min(consumption, midTo) - midFrom);
  let midAmount = 0;
  if (midLitres > 0) {
    // Charge per STARTED block (round up), so any part of the first 100 L = ₹5 minimum.
    const midBlocks = Math.ceil(midLitres / midPer);
    midAmount = midBlocks * midRate;
    parts.push({
      label: `${grp(midFrom + 1)}–${grp(midTo)} L`,
      detail: `${grp(midLitres)} L → ${midBlocks} × ${CURRENCY}${midRate}/${grp(midPer)} L`,
      amount: midAmount,
    });
  }

  // 3) High band — only the litres above highFrom, seasonal rate
  const highFrom = Number(t.highFrom ?? 20000);
  const highPer = Number(t.highPer ?? 50);
  const janMay = isJanMay(billDate);
  const highRate = Number(janMay ? (t.highRateJanMay ?? 10) : (t.highRateJunDec ?? 5));
  const highLitres = Math.max(0, consumption - highFrom);
  let highAmount = 0;
  if (highLitres > 0) {
    // Same block-rounding above 20,000 L (per 50 L).
    const highBlocks = Math.ceil(highLitres / highPer);
    highAmount = highBlocks * highRate;
    parts.push({
      label: `Above ${grp(highFrom)} L`,
      detail: `${grp(highLitres)} L → ${highBlocks} × ${CURRENCY}${highRate}/${grp(highPer)} L`,
      amount: highAmount,
    });
  }

  const waterCharge = r2(base + midAmount + highAmount);

  return {
    metered: consumer.metered, disconnected: false, meterReset,
    prevReading: prev, currentReading: curr, consumption,
    parts, waterCharge, meterFee,
    currentCharge: Math.round(waterCharge + meterFee),
    season: janMay ? "Jan–May" : "Jun–Dec",
  };
}

// Add reader-entered Fine + Other charges on top of any computed charge. Kept as
// their own fields (not water bands) so the bill shows them as separate lines.
export function applyExtras(charge, { fine = 0, other = 0, otherReason = "" } = {}) {
  const f = Math.max(0, Number(fine) || 0);
  const o = Math.max(0, Number(other) || 0);
  return {
    ...charge,
    fine: f, other: o, otherReason: (otherReason || "").trim(),
    currentCharge: Math.round((charge.currentCharge || 0) + f + o),
  };
}

// "Owner not home" — charge the monthly minimum without a reading, and remember
// how much to advance the meter baseline (the first slab's litres).
export function minimumCharge(tariff) {
  const t = { ...initialTariff, ...(tariff || {}) };
  const slab0 = (t.slabs && t.slabs[0]) || initialTariff.slabs[0];
  const water = Number(slab0.amount);
  const assumed = Number(slab0.upTo);
  const meterFee = Number(t.meterFee ?? 5);
  return {
    metered: true, disconnected: false, absent: true, assumedAdvance: assumed, meterReset: false,
    prevReading: null, currentReading: null, consumption: assumed,
    parts: [{ label: "Owner not home (min)", detail: `up to ${assumed.toLocaleString("en-IN")} L assumed`, amount: water }],
    waterCharge: water, meterFee, currentCharge: Math.round(water + meterFee), season: null,
  };
}

// Break the "previous arrears" into the split we loaded from the register
// (water / meter / other / fine). We only trust the split while the balance
// still equals the original opening dues — once a bill or payment moves the
// balance, the old split no longer maps to it, so we hide it.
export function arrearsBreakdown(consumer, arrears) {
  const m = consumer && consumer.dueMeta;
  if (!m) return null;
  if (Math.round(Number(arrears)) !== Math.round(Number(consumer.openingArrears || 0))) return null;
  const rows = [
    { key: "water", amount: Number(m.water) || 0 },
    { key: "meter", amount: Number(m.meter) || 0 },
    { key: "other", amount: Number(m.other) || 0 },
    { key: "fine", amount: Number(m.fine) || 0 },
  ].filter((r) => r.amount > 0);
  if (!rows.length) return null;
  return { rows, reason: (m.reason || "").trim(), period: (m.period || "").trim() };
}

// The old-dues split for MONITORING — always returns the register breakdown
// from due_meta (water / meter / other / fine), regardless of the current
// balance. Use this on the account view; arrearsBreakdown() (balance-gated) is
// for the fresh-bill snapshot only.
export function oldDuesSplit(consumer) {
  const m = consumer && consumer.dueMeta;
  if (!m) return null;
  const rows = [
    { key: "water", amount: Number(m.water) || 0 },
    { key: "meter", amount: Number(m.meter) || 0 },
    { key: "other", amount: Number(m.other) || 0 },
    { key: "fine", amount: Number(m.fine) || 0 },
  ].filter((r) => r.amount > 0);
  if (!rows.length) return null;
  return {
    rows,
    total: rows.reduce((s, r) => s + r.amount, 0),
    reason: (m.reason || "").trim(),
    period: (m.period || "").trim(),
    months: (m.months || "").trim(),
  };
}

// DYNAMIC dues breakdown — the live split of what a consumer STILL owes.
// Builds every charge oldest-first (old dues block + each monthly bill with its
// own water/meter/other/fine), applies all payments oldest-first, and returns
// the remaining split by component + a per-item (month) list with paid status.
// Nothing static: add a fine or record a payment and this recomputes.
export function duesBreakdown(consumer, txns) {
  const round = (n) => Math.round(n);
  const items = [];

  // 1) Old dues (before the system) — one block, split from due_meta.
  const oldTotal = Math.round(Number(consumer.openingArrears) || 0);
  if (oldTotal > 0) {
    const m = consumer.dueMeta || null;
    const comp = m
      ? { water: Number(m.water) || 0, meter: Number(m.meter) || 0, other: Number(m.other) || 0, fine: Number(m.fine) || 0 }
      : { water: oldTotal, meter: 0, other: 0, fine: 0 };
    items.push({ kind: "old", label: "Old dues", period: (m && m.period) || "", months: (m && m.months) || "", total: oldTotal, comp });
  }

  // 2) Each monthly bill, oldest-first, with its own component split.
  const bills = txns
    .filter((t) => t.consumerId === consumer.id && t.type === "bill")
    .sort((a, b) => String(a.createdAt || "").localeCompare(String(b.createdAt || "")));
  for (const b of bills) {
    const ch = b.meta && b.meta.charge ? b.meta.charge : {};
    const comp = {
      water: Number(ch.waterCharge) || 0, meter: Number(ch.meterFee) || 0,
      other: Number(ch.other) || 0, fine: Number(ch.fine) || 0,
    };
    items.push({ kind: "bill", label: (b.meta && b.meta.billNo) || "Bill", date: b.date, month: String(b.createdAt || "").slice(0, 7), total: Math.round(Number(b.amount) || 0), comp });
  }

  // 3) Apply all payments oldest-first.
  let paid = txns
    .filter((t) => t.consumerId === consumer.id && t.type === "payment")
    .reduce((s, t) => s + (Number(t.amount) || 0), 0);
  for (const it of items) {
    if (paid >= it.total) { paid -= it.total; it.status = "paid"; it.remain = { water: 0, meter: 0, other: 0, fine: 0 }; it.remainTotal = 0; }
    else if (paid <= 0) { it.status = "unpaid"; it.remain = { ...it.comp }; it.remainTotal = it.total; }
    else {
      const remainTotal = it.total - paid; const ratio = remainTotal / it.total;
      it.remain = { water: round(it.comp.water * ratio), meter: round(it.comp.meter * ratio), other: round(it.comp.other * ratio), fine: round(it.comp.fine * ratio) };
      it.remainTotal = remainTotal; it.status = "partial"; paid = 0;
    }
  }

  // 4) Aggregate the remaining split by component.
  const by = { water: 0, meter: 0, other: 0, fine: 0 };
  for (const it of items) { by.water += it.remain.water; by.meter += it.remain.meter; by.other += it.remain.other; by.fine += it.remain.fine; }
  const rows = [["water", by.water], ["meter", by.meter], ["other", by.other], ["fine", by.fine]]
    .filter(([, v]) => v > 0).map(([key, amount]) => ({ key, amount }));
  const total = by.water + by.meter + by.other + by.fine;
  return { rows, total, byComponent: by, items };
}

// Search matcher used by the reader + admin lists. A plain NUMBER is treated as
// a consumer-number lookup (prefix match on the digits, so "13" finds KWS-13,
// not every number containing "13"), and also matches phone/meter. Any text
// query matches name / number / meter / address / phone (+ optional extra).
export function matchesConsumer(c, query, extra = "") {
  const s = String(query || "").trim().toLowerCase();
  if (!s) return true;
  if (/^\d+$/.test(s)) {
    const numPart = String(c.consumerNo || "").replace(/\D/g, "");
    if (numPart === s || numPart.startsWith(s)) return true;
    if (String(c.phone || "").includes(s)) return true;
    if (String(c.meterNo || "").includes(s)) return true;
    return false;
  }
  return [c.name, c.consumerNo, c.meterNo, c.address, c.phone, extra].join(" ").toLowerCase().includes(s);
}

export function upiUri({ amount, note } = {}) {
  const { vpa, payeeName } = scheme.upi;
  const p = new URLSearchParams({ pa: vpa, pn: payeeName, cu: "INR" });
  if (amount && amount > 0) p.set("am", Number(amount).toFixed(2));
  if (note) p.set("tn", note);
  return "upi://pay?" + p.toString();
}

export function docNo(prefix, seq) {
  return prefix + String(seq).padStart(4, "0");
}

// Amount in words (Indian system), whole rupees.
export function amountInWords(num) {
  num = Math.round(num);
  if (num === 0) return "Zero Rupees";
  const a = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const two = (n) => (n < 20 ? a[n] : b[Math.floor(n / 10)] + (n % 10 ? " " + a[n % 10] : ""));
  const three = (n) => (n >= 100 ? a[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " " : "") : "") + (n % 100 ? two(n % 100) : "");
  let out = "";
  const crore = Math.floor(num / 10000000); num %= 10000000;
  const lakh = Math.floor(num / 100000); num %= 100000;
  const thousand = Math.floor(num / 1000); num %= 1000;
  if (crore) out += three(crore) + " Crore ";
  if (lakh) out += three(lakh) + " Lakh ";
  if (thousand) out += three(thousand) + " Thousand ";
  if (num) out += three(num);
  return out.trim() + " Rupees";
}
