// ---------------------------------------------------------------------------
// Water Billing — data, config, and calculation logic
//
// SAMPLE data for the demo. On go-live we replace `initialConsumers` with the
// client's real Excel import and `initialTariff` with his real rates. The
// tariff is now EDITABLE in the app (Admin → Settings), so it lives in state.
// ---------------------------------------------------------------------------

export const CURRENCY = "₹";

// The water scheme's own details (shown on printed bills + receipts)
export const scheme = {
  name: "Kollam Drinking Water Scheme",
  malayalamName: "കൊല്ലം കുടിവെള്ള പദ്ധതി",
  subtitle: "Thevally · Kavanad · Uliyakovil",
  phone: "+91 90379 79978",
  // Society bank / UPI details used to build the scan-to-pay QR on each bill.
  // (Static display QR only — NOT an online payment gateway.)
  upi: {
    vpa: "kollamwater@sbi",
    payeeName: "Kollam Water Scheme",
    account: "SBI · A/c 3021 5566 7788 · IFSC SBIN0001234",
  },
};

// Tariff = the charging rules. PLACEHOLDER numbers, editable in Admin → Settings.
export const initialTariff = {
  unitLabel: "unit (1000 L)",
  categories: {
    domestic: { label: "Domestic", ratePerUnit: 6, fixedCharge: 30 },
    commercial: { label: "Commercial", ratePerUnit: 12, fixedCharge: 60 },
  },
  // Monthly amount for houses with NO meter (flat-rate connections)
  flatRate: { domestic: 100, commercial: 200 },
};

// Every connection has its own CONSUMER NUMBER (consumerNo) — this, not the
// name, is the true identity. Payments can come from anyone (a son, a tenant),
// so we always match money to the consumer number, never to the payer's name.
export const initialConsumers = [
  { id: "C001", consumerNo: "KWS-1001", name: "Rajan Nair",     meterNo: "M-101", address: "Ward 3, Thevally",  category: "domestic",   metered: true,  prevReading: 1200, openingArrears: 0,   phone: "98470 11111", status: "active" },
  { id: "C002", consumerNo: "KWS-1002", name: "Suja Kumari",    meterNo: "M-102", address: "Ward 3, Thevally",  category: "domestic",   metered: true,  prevReading: 850,  openingArrears: 150, phone: "98470 22222", status: "active" },
  { id: "C003", consumerNo: "KWS-1003", name: "Ayesha Beevi",   meterNo: "F-201", address: "Ward 4, Kavanad",   category: "domestic",   metered: false, prevReading: 0,    openingArrears: 300, phone: "98470 33333", status: "active" },
  { id: "C004", consumerNo: "KWS-1004", name: "Krishna Stores", meterNo: "M-301", address: "Ward 4, Main Road", category: "commercial", metered: true,  prevReading: 3000, openingArrears: 540, phone: "98470 44444", status: "active" },
  { id: "C005", consumerNo: "KWS-1005", name: "Beena Thomas",   meterNo: "M-103", address: "Ward 3, Thevally",  category: "domestic",   metered: true,  prevReading: 400,  openingArrears: 80,  phone: "98470 55555", status: "active" },
  { id: "C006", consumerNo: "KWS-1006", name: "Faisal M",       meterNo: "M-104", address: "Ward 5, Uliyakovil", category: "domestic",  metered: true,  prevReading: 1560, openingArrears: 0,   phone: "98470 66666", status: "active" },
];

// Format money, e.g. 1500 -> "₹1,500", -200 -> "-₹200"
export function money(n) {
  const v = Math.round((Math.abs(n) + Number.EPSILON) * 100) / 100;
  const s = CURRENCY + v.toLocaleString("en-IN");
  return n < 0 ? "-" + s : s;
}

function rulesFor(consumer, tariff) {
  return tariff.categories[consumer.category] || tariff.categories.domestic;
}

// -- Balance = the running account for a consumer -------------------------
// opening old dues + all bills − all payments. Positive = owes money,
// negative = has advance credit, zero = settled.
export function balanceOf(consumer, txns) {
  return txns
    .filter((t) => t.consumerId === consumer.id)
    .reduce((b, t) => (t.type === "bill" ? b + t.amount : b - t.amount), consumer.openingArrears);
}

// -- THE CORE CALCULATION -------------------------------------------------
// Work out THIS month's charge (not including old arrears).
// meterReset = true when a meter was replaced, so units count from 0.
export function calculateCharge(consumer, currentReading, tariff, meterReset = false) {
  const rules = rulesFor(consumer, tariff);

  if (!consumer.metered) {
    const flat = tariff.flatRate[consumer.category] ?? tariff.flatRate.domestic;
    return {
      metered: false, units: 0, ratePerUnit: 0, fixedCharge: 0,
      currentCharge: flat, prevReading: null, currentReading: null, meterReset: false,
    };
  }

  const cr = Number(currentReading);
  const units = meterReset ? Math.max(0, cr) : Math.max(0, cr - consumer.prevReading);
  const currentCharge = units * rules.ratePerUnit + rules.fixedCharge;

  return {
    metered: true, units, ratePerUnit: rules.ratePerUnit, fixedCharge: rules.fixedCharge,
    currentCharge, prevReading: consumer.prevReading, currentReading: cr, meterReset,
  };
}

// Build a UPI scan-to-pay link for the society account.
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
