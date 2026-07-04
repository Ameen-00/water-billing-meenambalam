// ---------------------------------------------------------------------------
// Water Billing — data, config, and calculation logic
//
// Models the real "Kolayil Kudivella Suchithwa Samithi" bill/notice:
//   water charge (minimum + excess per litre) + meter fund + maintenance fund
//   + fine/others + arrears = total payable.
// All numbers are EXAMPLES, editable in Admin → Settings. Real values after 12th.
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

// Tariff — EXAMPLE numbers. Edit in Admin → Settings; real values plug in later.
export const initialTariff = {
  minCharge: 100,        // monthly minimum (covers the included litres)
  freeLitres: 15000,     // litres included in the minimum charge
  excessPerLitre: 0.5,   // ₹ per litre above the included litres
  meterFund: 20,         // fixed meter fund per bill
  maintenanceFund: 30,   // fixed maintenance fund per bill
  fine: 0,               // fine / others (default 0)
  dueDaysNoFine: 15,     // days to pay without fine
  dueDaysWithFine: 30,   // days to pay with fine
};

// Consumer number is the true identity. `category` is metadata only now —
// the tariff is the same for everyone (matching the real single-rate scheme).
export const initialConsumers = [
  { id: "C001", consumerNo: "KWS-1001", name: "Rajan Nair",     meterNo: "M-101", address: "Meenambalam", category: "domestic",   metered: true,  prevReading: 12000, openingArrears: 0,   phone: "98470 11111", status: "active" },
  { id: "C002", consumerNo: "KWS-1002", name: "Suja Kumari",    meterNo: "M-102", address: "Meenambalam", category: "domestic",   metered: true,  prevReading: 8500,  openingArrears: 150, phone: "98470 22222", status: "active" },
  { id: "C003", consumerNo: "KWS-1003", name: "Ayesha Beevi",   meterNo: "F-201", address: "Kalluvathukkal", category: "domestic", metered: false, prevReading: 0,   openingArrears: 300, phone: "98470 33333", status: "active" },
  { id: "C004", consumerNo: "KWS-1004", name: "Krishna Stores", meterNo: "M-301", address: "Kalluvathukkal", category: "commercial", metered: true, prevReading: 30000, openingArrears: 540, phone: "98470 44444", status: "active" },
  { id: "C005", consumerNo: "KWS-1005", name: "Beena Thomas",   meterNo: "M-103", address: "Meenambalam", category: "domestic",   metered: true,  prevReading: 4000,  openingArrears: 80,  phone: "98470 55555", status: "active" },
  { id: "C006", consumerNo: "KWS-1006", name: "Faisal M",       meterNo: "M-104", address: "Meenambalam", category: "domestic",   metered: true,  prevReading: 15600, openingArrears: 0,   phone: "98470 66666", status: "active" },
];

// Format money, e.g. 1500 -> "₹1,500", -200.5 -> "-₹200.5"
export function money(n) {
  const v = Math.round((Math.abs(n) + Number.EPSILON) * 100) / 100;
  const s = CURRENCY + v.toLocaleString("en-IN");
  return n < 0 ? "-" + s : s;
}

export function categoryLabel(c) {
  return c ? c.charAt(0).toUpperCase() + c.slice(1) : "—";
}

// Balance = opening old dues + all bills − all payments.
export function balanceOf(consumer, txns) {
  return txns
    .filter((t) => t.consumerId === consumer.id)
    .reduce((b, t) => (t.type === "bill" ? b + t.amount : b - t.amount), consumer.openingArrears);
}

// -- THE CORE CALCULATION -------------------------------------------------
export function calculateCharge(consumer, currentReading, tariff, meterReset = false) {
  const t = {
    minCharge: tariff.minCharge ?? 100,
    freeLitres: tariff.freeLitres ?? 15000,
    excessPerLitre: tariff.excessPerLitre ?? 0.5,
    meterFund: tariff.meterFund ?? 0,
    maintenanceFund: tariff.maintenanceFund ?? 0,
    fine: tariff.fine ?? 0,
  };

  let consumption = 0;
  let prev = consumer.prevReading;
  let curr = null;

  if (consumer.metered) {
    curr = Number(currentReading);
    consumption = meterReset ? Math.max(0, curr) : Math.max(0, curr - consumer.prevReading);
    if (meterReset) prev = 0;
  }

  const excessLitres = Math.max(0, consumption - t.freeLitres);
  const waterCharge = t.minCharge + excessLitres * t.excessPerLitre;
  const currentCharge = waterCharge + t.meterFund + t.maintenanceFund + t.fine;

  return {
    metered: consumer.metered,
    prevReading: prev,
    currentReading: curr,
    consumption,
    freeLitres: t.freeLitres,
    excessLitres,
    minCharge: t.minCharge,
    waterCharge,
    meterFund: t.meterFund,
    maintenanceFund: t.maintenanceFund,
    fine: t.fine,
    currentCharge,
    meterReset,
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

// Amount in words (Indian system), whole rupees — for the "amount in words" line.
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
