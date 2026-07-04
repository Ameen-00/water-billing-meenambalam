import { useMemo, useState } from "react";
import { scheme, money, balanceOf, categoryLabel } from "./billing";
import { Avatar, Pill, Card, Button, Field, inputClass, BalancePill } from "./ui";

// ===========================================================================
// AdminArea — tab shell for Dashboard / Reports / Settings, plus consumer detail
// ===========================================================================
export function AdminArea({ consumers, txns, tariff, setTariff, onPay, onAddConsumer }) {
  const [tab, setTab] = useState("dashboard");
  const [detailId, setDetailId] = useState(null);

  if (detailId) {
    const consumer = consumers.find((c) => c.id === detailId);
    return (
      <ConsumerDetail consumer={consumer} tariff={tariff} txns={txns} onBack={() => setDetailId(null)} onPay={onPay} />
    );
  }

  const tabs = [
    { key: "dashboard", label: "Dashboard" },
    { key: "reports", label: "Reports" },
    { key: "settings", label: "Settings" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex gap-1 rounded-xl bg-white p-1 text-sm font-semibold shadow-sm ring-1 ring-slate-200">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-lg px-3 py-2 transition ${tab === t.key ? "bg-blue-700 text-white shadow" : "text-slate-500 hover:bg-slate-50"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "dashboard" && (
        <AdminDashboard consumers={consumers} txns={txns} onOpen={setDetailId} onPay={onPay} onGoReports={() => setTab("reports")} />
      )}
      {tab === "reports" && <Reports consumers={consumers} txns={txns} />}
      {tab === "settings" && <Settings tariff={tariff} setTariff={setTariff} onAddConsumer={onAddConsumer} />}
    </div>
  );
}

// ===========================================================================
// DASHBOARD
// ===========================================================================
function AdminDashboard({ consumers, txns, onOpen, onPay, onGoReports }) {
  const stats = useMemo(() => {
    const balances = consumers.map((c) => balanceOf(c, txns));
    const outstanding = balances.filter((b) => b > 0).reduce((a, b) => a + b, 0);
    const collected = txns.filter((t) => t.type === "payment").reduce((a, t) => a + t.amount, 0);
    const defaulters = balances.filter((b) => b > 0).length;
    return { outstanding, collected, defaulters, bills: txns.filter((t) => t.type === "bill").length };
  }, [consumers, txns]);

  // Index of bill/receipt numbers per consumer, so search can find them.
  const docIndex = useMemo(() => {
    const m = {};
    for (const t of txns) {
      const no = t.type === "bill" ? t.meta?.billNo : t.meta?.receiptNo;
      if (no) (m[t.consumerId] ||= []).push(String(no).toLowerCase());
    }
    return m;
  }, [txns]);

  const [q, setQ] = useState("");
  const [mode, setMode] = useState("all"); // all | due
  const s = q.trim().toLowerCase();

  const filtered = consumers.filter((c) => {
    if (mode === "due" && balanceOf(c, txns) <= 0) return false;
    if (!s) return true;
    const hay = [c.name, c.consumerNo, c.meterNo, c.address].join(" ").toLowerCase();
    const docs = (docIndex[c.id] || []).join(" ");
    return hay.includes(s) || docs.includes(s);
  });

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Outstanding" value={money(stats.outstanding)} tone="rose" sub={`${stats.defaulters} owe · tap`} onClick={() => setMode("due")} active={mode === "due"} />
        <Stat label="Collected" value={money(stats.collected)} tone="sky" sub="tap for report" onClick={onGoReports} />
        <Stat label="Consumers" value={consumers.length} tone="blue" sub="tap to show all" onClick={() => setMode("all")} active={mode === "all" && !s} />
        <Stat label="Bills made" value={stats.bills} tone="slate" sub="tap for report" onClick={onGoReports} />
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center gap-2 border-b border-slate-100 p-3">
          <svg viewBox="0 0 24 24" className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" strokeLinecap="round" />
          </svg>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, consumer no, meter, or bill no…"
            className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
          />
        </div>

        {mode === "due" && (
          <div className="flex items-center justify-between bg-rose-50 px-3 py-2 text-xs text-rose-700">
            <span>Showing only consumers with dues</span>
            <button onClick={() => setMode("all")} className="font-semibold underline">Show all</button>
          </div>
        )}

        <div className="divide-y divide-slate-100">
          {filtered.map((c) => {
            const bal = balanceOf(c, txns);
            return (
              <div key={c.id} className="flex items-center gap-3 p-3 transition hover:bg-slate-50">
                <Avatar name={c.name} />
                <button className="min-w-0 flex-1 text-left" onClick={() => onOpen(c.id)}>
                  <div className="flex items-center gap-2">
                    <span className="truncate font-semibold">{c.name}</span>
                    {!c.metered && <Pill variant="flat">flat</Pill>}
                  </div>
                  <div className="truncate text-xs text-slate-500">{c.consumerNo} · {c.meterNo} · {c.address}</div>
                </button>
                <div className="hidden sm:block"><BalancePill amount={bal} /></div>
                <Button variant={bal > 0 ? "gold" : "ghost"} className="!px-3 !py-1.5 text-xs" disabled={bal <= 0} onClick={() => onPay(c)}>
                  Pay
                </Button>
              </div>
            );
          })}
          {filtered.length === 0 && <div className="p-6 text-center text-sm text-slate-400">No consumers match "{q}".</div>}
        </div>
      </Card>
    </div>
  );
}

function Stat({ label, value, tone, sub, onClick, active }) {
  const tones = { rose: "text-rose-600", sky: "text-sky-600", blue: "text-blue-700", slate: "text-slate-800" };
  return (
    <Card className={`p-4 ${active ? "ring-2 ring-blue-500" : ""}`} onClick={onClick}>
      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${tones[tone]}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-slate-400">{sub}</div>}
    </Card>
  );
}

// ===========================================================================
// CONSUMER DETAIL — full ledger / history
// ===========================================================================
function ConsumerDetail({ consumer, tariff, txns, onBack, onPay }) {
  const rows = useMemo(() => {
    const list = txns.filter((t) => t.consumerId === consumer.id);
    let bal = consumer.openingArrears;
    const out = [{ kind: "opening", label: "Opening balance (old records)", amount: consumer.openingArrears, balance: bal }];
    for (const t of list) {
      bal = t.type === "bill" ? bal + t.amount : bal - t.amount;
      out.push({ kind: t.type, t, balance: bal });
    }
    return out.reverse();
  }, [consumer, txns]);

  const balance = balanceOf(consumer, txns);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <button onClick={onBack} className="text-sm font-medium text-blue-700 hover:underline">← Back to all consumers</button>

      <Card className="p-5">
        <div className="flex items-start gap-4">
          <Avatar name={consumer.name} size="h-14 w-14 text-lg" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold">{consumer.name}</h2>
              {!consumer.metered && <Pill variant="flat">flat-rate</Pill>}
              <Pill variant="info">{categoryLabel(consumer.category)}</Pill>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
              <Info label="Consumer No" value={consumer.consumerNo} strong />
              <Info label="Meter No" value={consumer.meterNo} />
              <Info label="Address" value={consumer.address} />
              <Info label="Phone" value={consumer.phone || "—"} />
            </dl>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-400">Current balance</div>
            <div className={`text-2xl font-bold ${balance > 0 ? "text-rose-600" : balance < 0 ? "text-sky-600" : "text-slate-500"}`}>
              {balance > 0 ? money(balance) : balance < 0 ? `${money(-balance)} credit` : "Settled"}
            </div>
          </div>
          <Button variant="gold" disabled={balance <= 0} onClick={() => onPay(consumer)}>Record Payment</Button>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-600">Account history</div>
        <div className="divide-y divide-slate-100">
          {rows.map((r, i) => <LedgerRow key={i} row={r} consumerName={consumer.name} />)}
        </div>
      </Card>
    </div>
  );
}

function Info({ label, value, strong }) {
  return (
    <div>
      <dt className="text-xs text-slate-400">{label}</dt>
      <dd className={strong ? "font-semibold text-blue-700" : "text-slate-700"}>{value}</dd>
    </div>
  );
}

function LedgerRow({ row, consumerName }) {
  if (row.kind === "opening") {
    return (
      <div className="flex items-center justify-between px-4 py-3">
        <div>
          <div className="text-sm font-medium text-slate-600">{row.label}</div>
          <div className="text-xs text-slate-400">before system started</div>
        </div>
        <div className="text-right">
          <div className="text-sm font-semibold text-slate-500">{money(row.amount)}</div>
          <div className="text-xs text-slate-400">bal {money(row.balance)}</div>
        </div>
      </div>
    );
  }
  const t = row.t;
  const isBill = t.type === "bill";
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-sm font-medium">
          <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${isBill ? "bg-rose-100 text-rose-600" : "bg-sky-100 text-sky-600"}`}>
            {isBill ? "↑" : "↓"}
          </span>
          {isBill ? `Bill ${t.meta.billNo}` : `Payment ${t.meta.receiptNo}`}
        </div>
        <div className="ml-8 truncate text-xs text-slate-400">
          {t.date}
          {isBill && t.meta.charge?.metered ? ` · reading ${t.meta.charge.prevReading} → ${t.meta.charge.currentReading} (${t.meta.charge.consumption} L)` : ""}
          {isBill && t.meta.charge && !t.meta.charge.metered ? " · flat charge" : ""}
          {!isBill && t.meta.mode ? ` · ${t.meta.mode}` : ""}
          {!isBill && t.meta.payerName && t.meta.payerName !== consumerName ? ` · by ${t.meta.payerName}` : ""}
          {!isBill && t.meta.reference ? ` · ${t.meta.reference}` : ""}
        </div>
      </div>
      <div className="text-right">
        <div className={`text-sm font-semibold ${isBill ? "text-rose-600" : "text-sky-600"}`}>
          {isBill ? "+" : "−"}{money(t.amount)}
        </div>
        <div className="text-xs text-slate-400">bal {money(row.balance)}</div>
      </div>
    </div>
  );
}

// A tiny dependency-free horizontal bar chart.
function MiniBars({ items, empty }) {
  if (!items.length) return <div className="p-6 text-center text-sm text-slate-400">{empty || "No data"}</div>;
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="space-y-2.5 p-4">
      {items.map((it, i) => (
        <div key={i}>
          <div className="mb-1 flex justify-between text-xs">
            <span className="truncate text-slate-600">{it.label}</span>
            <span className="font-semibold text-slate-700">{it.display ?? it.value}</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: (it.value / max) * 100 + "%" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ===========================================================================
// REPORTS — collection summary, defaulters, charts, export (CSV + print/PDF)
// ===========================================================================
function Reports({ consumers, txns }) {
  const data = useMemo(() => {
    const payments = txns.filter((t) => t.type === "payment");
    const collected = payments.reduce((a, t) => a + t.amount, 0);
    const byMode = {};
    for (const p of payments) byMode[p.meta.mode] = (byMode[p.meta.mode] || 0) + p.amount;
    const withBal = consumers.map((c) => ({ c, bal: balanceOf(c, txns) }));
    const defaulters = withBal.filter((x) => x.bal > 0).sort((a, b) => b.bal - a.bal);
    const outstanding = defaulters.reduce((a, x) => a + x.bal, 0);
    return { collected, receipts: payments.length, byMode, defaulters, outstanding };
  }, [consumers, txns]);

  function exportCSV() {
    const header = ["Consumer No", "Name", "Meter No", "Category", "Phone", "Balance"];
    const rows = consumers.map((c) => [c.consumerNo, c.name, c.meterNo, c.category, c.phone, balanceOf(c, txns)]);
    const csv = [header, ...rows].map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "water-dues.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold">Reports</h2>
        <div className="flex gap-2">
          <Button variant="ghost" className="!py-2 text-xs" onClick={exportCSV}>⬇ Excel (CSV)</Button>
          <Button variant="ghost" className="!py-2 text-xs" onClick={() => window.print()}>🖨 Print / PDF</Button>
        </div>
      </div>

      <div id="print-report" className="space-y-4">
        <div className="hidden print:block">
          <h1 className="text-xl font-bold">{scheme.name}</h1>
          <p className="text-sm">Collection & Dues Report</p>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Collected" value={money(data.collected)} tone="sky" sub={`${data.receipts} receipts`} />
          <Stat label="Outstanding" value={money(data.outstanding)} tone="rose" sub={`${data.defaulters.length} defaulters`} />
          <Stat label="Consumers" value={consumers.length} tone="blue" sub="total" />
          <Stat label="By UPI" value={money(data.byMode.UPI || 0)} tone="slate" sub="online collection" />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="overflow-hidden">
            <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-600">Collection by mode</div>
            <MiniBars items={["UPI", "Cash", "Bank"].map((m) => ({ label: m, value: data.byMode[m] || 0, display: money(data.byMode[m] || 0) }))} />
          </Card>
          <Card className="overflow-hidden">
            <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-600">Top dues</div>
            <MiniBars items={data.defaulters.slice(0, 5).map((d) => ({ label: d.c.name, value: d.bal, display: money(d.bal) }))} empty="No dues 🎉" />
          </Card>
        </div>

        <Card className="overflow-hidden">
          <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-600">Defaulters ({data.defaulters.length})</div>
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr><th className="p-3">Consumer</th><th className="p-3">Phone</th><th className="p-3 text-right">Due</th></tr>
            </thead>
            <tbody>
              {data.defaulters.map(({ c, bal }) => (
                <tr key={c.id} className="border-t border-slate-100">
                  <td className="p-3">
                    <div className="font-medium">{c.name}</div>
                    <div className="text-xs text-slate-500">{c.consumerNo} · {c.meterNo}</div>
                  </td>
                  <td className="p-3 text-slate-600">{c.phone || "—"}</td>
                  <td className="p-3 text-right font-semibold text-rose-600">{money(bal)}</td>
                </tr>
              ))}
              {data.defaulters.length === 0 && (
                <tr><td colSpan={3} className="p-6 text-center text-slate-400">No dues — everyone is settled 🎉</td></tr>
              )}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}

// ===========================================================================
// SETTINGS — edit tariff rates (no code needed)
// ===========================================================================
function Settings({ tariff, setTariff, onAddConsumer }) {
  const [form, setForm] = useState(() => JSON.parse(JSON.stringify(tariff)));
  const [saved, setSaved] = useState(false);

  function num(v) { return Math.max(0, Number(v) || 0); }
  function update(path, value) {
    setForm((f) => { const next = JSON.parse(JSON.stringify(f)); path(next, num(value)); return next; });
    setSaved(false);
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <AddConnection onAddConsumer={onAddConsumer} />

      <div>
        <h2 className="text-lg font-bold">Tariff Settings</h2>
        <p className="text-sm text-slate-500">Example values — edit any time (e.g. after the 12th). No coding needed.</p>
      </div>

      <Card className="p-4">
        <h3 className="mb-3 font-semibold">Water charge</h3>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Monthly minimum (₹)" hint="covers the included litres">
            <input type="number" className={inputClass} value={form.minCharge}
              onChange={(e) => update((n, v) => (n.minCharge = v), e.target.value)} />
          </Field>
          <Field label="Litres included">
            <input type="number" className={inputClass} value={form.freeLitres}
              onChange={(e) => update((n, v) => (n.freeLitres = v), e.target.value)} />
          </Field>
          <Field label="Excess (₹ per litre)" hint="above the included litres">
            <input type="number" step="0.01" className={inputClass} value={form.excessPerLitre}
              onChange={(e) => update((n, v) => (n.excessPerLitre = v), e.target.value)} />
          </Field>
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="mb-3 font-semibold">Funds & fine</h3>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Meter fund (₹)">
            <input type="number" className={inputClass} value={form.meterFund}
              onChange={(e) => update((n, v) => (n.meterFund = v), e.target.value)} />
          </Field>
          <Field label="Maintenance fund (₹)">
            <input type="number" className={inputClass} value={form.maintenanceFund}
              onChange={(e) => update((n, v) => (n.maintenanceFund = v), e.target.value)} />
          </Field>
          <Field label="Fine / others (₹)">
            <input type="number" className={inputClass} value={form.fine}
              onChange={(e) => update((n, v) => (n.fine = v), e.target.value)} />
          </Field>
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="mb-3 font-semibold">Due dates</h3>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Days to pay (no fine)">
            <input type="number" className={inputClass} value={form.dueDaysNoFine}
              onChange={(e) => update((n, v) => (n.dueDaysNoFine = v), e.target.value)} />
          </Field>
          <Field label="Days to pay (with fine)">
            <input type="number" className={inputClass} value={form.dueDaysWithFine}
              onChange={(e) => update((n, v) => (n.dueDaysWithFine = v), e.target.value)} />
          </Field>
        </div>
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={() => { setTariff(form); setSaved(true); }}>Save values</Button>
        {saved && <span className="text-sm font-medium text-sky-600">✓ Saved — new bills use these values.</span>}
      </div>
    </div>
  );
}

// Collapsible form to register a new water connection (consumer).
function AddConnection({ onAddConsumer }) {
  const empty = { consumerNo: "", name: "", meterNo: "", address: "", category: "domestic", metered: true, prevReading: "", openingArrears: "", phone: "" };
  const [f, setF] = useState(empty);
  const [open, setOpen] = useState(false);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const valid = f.consumerNo.trim() && f.name.trim();

  async function submit() {
    if (!valid || !onAddConsumer) return;
    const ok = await onAddConsumer({
      consumerNo: f.consumerNo.trim(), name: f.name.trim(), meterNo: f.meterNo.trim(),
      address: f.address.trim(), category: f.category, metered: f.metered,
      prevReading: Number(f.prevReading) || 0, openingArrears: Number(f.openingArrears) || 0,
      phone: f.phone.trim(), status: "active",
    });
    if (ok) { setF(empty); setOpen(false); }
  }

  return (
    <Card className="p-4">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between">
        <div className="text-left">
          <h3 className="font-semibold">Add New Connection</h3>
          <p className="text-xs text-slate-500">Register a new water consumer</p>
        </div>
        <span className="rounded-lg bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700">{open ? "Close" : "+ Add"}</span>
      </button>

      {open && (
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Consumer No *"><input className={inputClass} value={f.consumerNo} onChange={(e) => set("consumerNo", e.target.value)} placeholder="KWS-1007" /></Field>
            <Field label="Name *"><input className={inputClass} value={f.name} onChange={(e) => set("name", e.target.value)} /></Field>
            <Field label="Meter No"><input className={inputClass} value={f.meterNo} onChange={(e) => set("meterNo", e.target.value)} /></Field>
            <Field label="Phone"><input className={inputClass} value={f.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
            <div className="col-span-2"><Field label="Address"><input className={inputClass} value={f.address} onChange={(e) => set("address", e.target.value)} /></Field></div>
            <Field label="Category">
              <select className={inputClass} value={f.category} onChange={(e) => set("category", e.target.value)}>
                <option value="domestic">Domestic</option>
                <option value="commercial">Commercial</option>
              </select>
            </Field>
            <Field label="Opening arrears (₹)"><input type="number" className={inputClass} value={f.openingArrears} onChange={(e) => set("openingArrears", e.target.value)} /></Field>
            <div className="col-span-2">
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input type="checkbox" checked={f.metered} onChange={(e) => set("metered", e.target.checked)} className="h-4 w-4" />
                Has a meter (uncheck for flat-rate)
              </label>
            </div>
            {f.metered && <Field label="Current reading"><input type="number" className={inputClass} value={f.prevReading} onChange={(e) => set("prevReading", e.target.value)} /></Field>}
          </div>
          <Button onClick={submit} disabled={!valid}>Add connection</Button>
        </div>
      )}
    </Card>
  );
}
