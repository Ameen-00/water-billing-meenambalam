import { createContext, useContext, useEffect, useState } from "react";

// Simple two-language dictionary for the meter-reader screens (English / Malayalam).
const STR = {
  en: {
    billingSystem: "Billing System",
    meterReading: "Meter Reading",
    monthProgress: "This month's progress — read in any order",
    of: "of",
    billedWord: "billed",
    pending: "Pending",
    all: "All",
    billedChip: "Billed",
    searchHouse: "Search the house you're at — name, no, meter…",
    noHouses: "No houses match.",
    backToRoute: "← Back to route",
    prevReading: "Previous reading",
    currReading: "Current reading",
    meterReset: "Meter was replaced / reset (count from 0)",
    readingLow: "Reading is below previous",
    flatNote: "Flat-rate connection (no meter). Fixed monthly charge applies.",
    billPreview: "Bill preview",
    consumption: "Consumption",
    waterCharge: "Water charge",
    meterFee: "Meter fee",
    disconnectedNote: "Disconnected connection — fixed charge applies, no reading needed.",
    meterFund: "Meter fund",
    maintenanceFund: "Maintenance fund",
    fineOthers: "Fine / others",
    thisBill: "This bill",
    prevArrears: "Previous arrears",
    totalPayable: "TOTAL PAYABLE",
    savePrintBill: "Save & Print Bill",
    recordPayment: "Record Payment",
    recentActivity: "Recent activity",
    bill: "Bill",
    payment: "Payment",
    category: "Category",
    connection: "Connection",
    statusL: "Status",
    phone: "Phone",
    address: "Address",
    outstandingDues: "Outstanding dues",
    metered: "Metered",
    flatRate: "Flat-rate",
  },
  ml: {
    billingSystem: "ബില്ലിംഗ് സിസ്റ്റം",
    meterReading: "മീറ്റർ റീഡിംഗ്",
    monthProgress: "ഈ മാസത്തെ പുരോഗതി — ഏത് ക്രമത്തിലും എടുക്കാം",
    of: "/",
    billedWord: "ബിൽ ചെയ്തു",
    pending: "ബാക്കി",
    all: "എല്ലാം",
    billedChip: "ബിൽ ചെയ്തവ",
    searchHouse: "വീട് തിരയുക — പേര്, നമ്പർ, മീറ്റർ…",
    noHouses: "വീടുകളൊന്നും കണ്ടെത്തിയില്ല.",
    backToRoute: "← പട്ടികയിലേക്ക് മടങ്ങുക",
    prevReading: "മുൻ റീഡിംഗ്",
    currReading: "ഇപ്പോഴത്തെ റീഡിംഗ്",
    meterReset: "മീറ്റർ മാറ്റി / റീസെറ്റ് ചെയ്തു (0 മുതൽ)",
    readingLow: "റീഡിംഗ് മുൻ റീഡിംഗിനെക്കാൾ കുറവാണ്",
    flatNote: "ഫ്ലാറ്റ്-റേറ്റ് കണക്ഷൻ (മീറ്റർ ഇല്ല). സ്ഥിര പ്രതിമാസ ചാർജ്.",
    billPreview: "ബിൽ പ്രിവ്യൂ",
    consumption: "ഉപഭോഗം",
    waterCharge: "വെള്ളക്കരം",
    meterFee: "മീറ്റർ ഫീസ്",
    disconnectedNote: "കണക്ഷൻ വിച്ഛേദിച്ചു — സ്ഥിര ചാർജ്, റീഡിംഗ് ആവശ്യമില്ല.",
    meterFund: "മീറ്റർ ഫണ്ട്",
    maintenanceFund: "മെയിന്റനൻസ് ഫണ്ട്",
    fineOthers: "പിഴ / മറ്റുള്ളവ",
    thisBill: "ഈ ബിൽ",
    prevArrears: "മുൻ കുടിശ്ശിക",
    totalPayable: "ആകെ അടയ്ക്കേണ്ടത്",
    savePrintBill: "ബിൽ സേവ് ചെയ്ത് പ്രിന്റ് ചെയ്യുക",
    recordPayment: "പണം സ്വീകരിക്കുക",
    recentActivity: "സമീപകാല വിവരങ്ങൾ",
    bill: "ബിൽ",
    payment: "പണം",
    category: "വിഭാഗം",
    connection: "കണക്ഷൻ",
    statusL: "സ്ഥിതി",
    phone: "ഫോൺ",
    address: "വിലാസം",
    outstandingDues: "കുടിശ്ശിക",
    metered: "മീറ്റർ ഉള്ളത്",
    flatRate: "ഫ്ലാറ്റ്-റേറ്റ്",
  },
};

const LangCtx = createContext(null);

export function LangProvider({ children }) {
  const [lang, setLang] = useState(() => {
    try { return localStorage.getItem("lang") || "en"; } catch { return "en"; }
  });
  useEffect(() => {
    try { localStorage.setItem("lang", lang); } catch { /* ignore */ }
  }, [lang]);
  const t = (k) => (STR[lang] && STR[lang][k]) || STR.en[k] || k;
  return <LangCtx.Provider value={{ lang, setLang, t }}>{children}</LangCtx.Provider>;
}

export function useLang() {
  return useContext(LangCtx);
}
