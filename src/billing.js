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
  malayalamName: "കോലായിൽ കുടിവെള്ള ശുചിത്വ സമിതി",
  subtitle: "Meenambalam, Kalluvathukkal · Reg. No. Q 1060/02",
  phone: "+91 90379 79978",
  upi: {
    vpa: "kollamwater@sbi",
    payeeName: "Kolayil Water Samithi",
    account: "SBI · A/c 3021 5566 7788 · IFSC SBIN0001234",
  },
};

export const initialTariff = {
  // Flat slabs covering the first 15,000 litres
  slabs: [
    { upTo: 7000, amount: 75 },
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
  dueDaysNoFine: 15,
  dueDaysWithFine: 30,
};

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
    midAmount = r2((midLitres / midPer) * midRate);
    parts.push({
      label: `${grp(midFrom + 1)}–${grp(midTo)} L`,
      detail: `${grp(midLitres)} L @ ${CURRENCY}${midRate}/${grp(midPer)} L`,
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
    highAmount = r2((highLitres / highPer) * highRate);
    parts.push({
      label: `Above ${grp(highFrom)} L`,
      detail: `${grp(highLitres)} L @ ${CURRENCY}${highRate}/${grp(highPer)} L`,
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
