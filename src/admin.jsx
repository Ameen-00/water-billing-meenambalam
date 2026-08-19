import { useEffect, useMemo, useState } from "react";
import { scheme, money, balanceOf, categoryLabel, matchesConsumer, oldDuesSplit } from "./billing";
import { Avatar, Pill, Card, Button, Field, inputClass, BalancePill } from "./ui";

// ===========================================================================
// AdminArea — tab shell for Dashboard / Reports / Settings, plus consumer detail
// ===========================================================================
export function AdminArea({ consumers, txns, tariff, setTariff, onPay, onAddConsumer, onSetStatus, onCancelBill }) {
  const [tab, setTab] = useState("dashboard");
  const [detailId, setDetailId] = useState(null);

  if (detailId) {
    const consumer = consumers.find((c) => c.id === detailId);
    return (
      <ConsumerDetail consumer={consumer} tariff={tariff} txns={txns} onBack={() => setDetailId(null)} onPay={onPay} onSetStatus={onSetStatus} onCancelBill={onCancelBill} />
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
  const [sort, setSort] = useState({ by: "no", dir: "asc" });
  const s = q.trim().toLowerCase();

  const numOf = (c) => parseInt(String(c.consumerNo).replace(/\D/g, ""), 10) || 0;

  const rows = useMemo(() => {
    const list = consumers
      .map((c) => ({ c, bal: balanceOf(c, txns) }))
      .filter(({ c, bal }) => {
        if (mode === "due" && bal <= 0) return false;
        return matchesConsumer(c, s, (docIndex[c.id] || []).join(" "));
      });
    const dir = sort.dir === "asc" ? 1 : -1;
    list.sort((a, b) => {
      if (sort.by === "name") return String(a.c.name).localeCompare(String(b.c.name)) * dir;
      if (sort.by === "balance") return (a.bal - b.bal) * dir;
      return (numOf(a.c) - numOf(b.c)) * dir;
    });
    return list;
  }, [consumers, txns, mode, s, sort, docIndex]);

  const toggleSort = (by) => setSort((p) => ({ by, dir: p.by === by && p.dir === "asc" ? "desc" : "asc" }));
  const arrow = (by) => (sort.by === by ? (sort.dir === "asc" ? " ▲" : " ▼") : "");

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Outstanding" value={money(stats.outstanding)} tone="rose" sub={`${stats.defaulters} consumers owe`} onClick={() => setMode("due")} active={mode === "due"} />
        <Stat label="Collected" value={money(stats.collected)} tone="sky" sub="view report" onClick={onGoReports} />
        <Stat label="Consumers" value={consumers.length} tone="blue" sub="show all" onClick={() => { setMode("all"); setQ(""); }} active={mode === "all" && !s} />
        <Stat label="Bills made" value={stats.bills} tone="slate" sub="view report" onClick={onGoReports} />
      </div>

      <Card className="overflow-hidden">
        {/* toolbar */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3">
          <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200">
            <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" strokeLinecap="round" />
            </svg>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, consumer no, mobile, bill no…"
              className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
            />
          </div>
          <div className="flex gap-1 rounded-xl bg-slate-50 p-1 text-xs font-semibold ring-1 ring-slate-200">
            {[["all", "All"], ["due", "Dues only"]].map(([k, label]) => (
              <button
                key={k}
                onClick={() => setMode(k)}
                className={`rounded-lg px-3 py-1.5 transition ${mode === k ? "bg-blue-700 text-white shadow-sm" : "text-slate-600 hover:bg-white"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50/80 text-[11px] uppercase tracking-wider text-slate-500">
              <tr>
                <Th onClick={() => toggleSort("no")}>No.{arrow("no")}</Th>
                <Th onClick={() => toggleSort("name")}>Name{arrow("name")}</Th>
                <Th className="hidden md:table-cell">Mobile</Th>
                <Th className="hidden lg:table-cell">Address</Th>
                <Th className="text-right" onClick={() => toggleSort("balance")}>Balance{arrow("balance")}</Th>
                <Th className="text-right">Action</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map(({ c, bal }) => (
                <tr key={c.id} className="transition hover:bg-blue-50/40">
                  <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs text-slate-500">{c.consumerNo}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <button onClick={() => onOpen(c.id)} className="truncate text-left font-medium text-slate-800 hover:text-blue-700 hover:underline">
                        {c.name}
                      </button>
                      {c.status === "disconnected" && <Pill variant="flat">DC</Pill>}
                    </div>
                  </td>
                  <td className="hidden whitespace-nowrap px-3 py-2.5 text-slate-600 md:table-cell">{c.phone || "—"}</td>
                  <td className="hidden max-w-[22rem] truncate px-3 py-2.5 text-slate-500 lg:table-cell">{c.address}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right font-semibold">
                    <span className={bal > 0 ? "text-rose-600" : bal < 0 ? "text-sky-600" : "text-slate-300"}>
                      {bal === 0 ? "—" : money(bal)}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right">
                    <Button variant={bal > 0 ? "gold" : "ghost"} className="!px-3 !py-1.5 text-xs" disabled={bal <= 0} onClick={() => onPay(c)}>
                      Pay
                    </Button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={6} className="p-8 text-center text-sm text-slate-400">No consumers match "{q}".</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="border-t border-slate-100 px-3 py-2 text-xs text-slate-400">
          Showing {rows.length} of {consumers.length}
        </div>
      </Card>
    </div>
  );
}

function Th({ children, className = "", onClick }) {
  return (
    <th
      onClick={onClick}
      className={`px-3 py-2.5 text-left font-semibold ${onClick ? "cursor-pointer select-none hover:text-slate-700" : ""} ${className}`}
    >
      {children}
    </th>
  );
}

function Stat({ label, value, tone, sub, onClick, active }) {
  const tones = {
    rose: { text: "text-rose-600", bar: "bg-rose-500" },
    sky: { text: "text-sky-600", bar: "bg-sky-500" },
    blue: { text: "text-blue-700", bar: "bg-blue-600" },
    slate: { text: "text-slate-800", bar: "bg-slate-400" },
  };
  const t = tones[tone] || tones.slate;
  return (
    <Card className={`relative overflow-hidden p-4 ${active ? "ring-2 ring-blue-500" : ""}`} onClick={onClick}>
      <span className={`absolute inset-y-0 left-0 w-1 ${t.bar}`} />
      <div className="pl-2">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</div>
        <div className={`mt-1 text-2xl font-bold tracking-tight ${t.text}`}>{value}</div>
        {sub && <div className="mt-0.5 text-xs text-slate-400">{sub}</div>}
      </div>
    </Card>
  );
}

// ===========================================================================
// CONSUMER DETAIL — full ledger / history
// ===========================================================================
function ConsumerDetail({ consumer, tariff, txns, onBack, onPay, onSetStatus, onCancelBill }) {
  const isDisc = consumer.status === "disconnected";
  const lastBillId = [...txns].reverse().find((t) => t.type === "bill" && t.consumerId === consumer.id)?.id;
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
              {isDisc ? <Pill variant="flat">Disconnected</Pill> : <Pill variant="credit">Active</Pill>}
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
          {rows.map((r, i) => <LedgerRow key={i} row={r} consumerName={consumer.name} consumer={consumer} lastBillId={lastBillId} onCancelBill={onCancelBill} />)}
        </div>
      </Card>

      {/* Admin: connect / disconnect */}
      <Card className="flex items-center justify-between p-4">
        <div>
          <div className="text-sm font-semibold text-slate-700">Connection status</div>
          <div className="text-xs text-slate-500">
            {isDisc ? "This consumer is disconnected (not billed on meter)." : "This consumer is active."}
          </div>
        </div>
        {isDisc ? (
          <Button
            variant="primary"
            onClick={() => { if (confirm(`Reactivate ${consumer.name}? They will be billed normally again.`)) onSetStatus(consumer, "active"); }}
          >
            Reactivate
          </Button>
        ) : (
          <Button
            variant="danger"
            onClick={() => { if (confirm(`Disconnect ${consumer.name}? They will get the fixed disconnected charge.`)) onSetStatus(consumer, "disconnected"); }}
          >
            Disconnect
          </Button>
        )}
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

// Small labelled split of the old dues (water / meter / other / fine).
const ARREARS_LABELS = { water: "Water", meter: "Meter", other: "Other", fine: "Fine" };
export function ArrearsSplit({ info, className = "" }) {
  if (!info) return null;
  return (
    <div className={"rounded-xl bg-amber-50 px-3 py-2 ring-1 ring-amber-100 " + className}>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">Old dues breakdown</span>
        {(info.period || info.months) && (
          <span className="text-[11px] text-amber-600">
            {info.period}{info.months ? ` · ${info.months}` : ""}
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
        {info.rows.map((r) => (
          <span key={r.key}>
            {ARREARS_LABELS[r.key] || r.key}: <span className="font-semibold text-slate-800">{money(r.amount)}</span>
          </span>
        ))}
      </div>
      {info.reason && <div className="mt-1 text-[11px] text-slate-500">{info.reason}</div>}
    </div>
  );
}

function LedgerRow({ row, consumerName, consumer, lastBillId, onCancelBill }) {
  if (row.kind === "opening") {
    const info = oldDuesSplit(consumer);
    return (
      <div className="px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-slate-600">{row.label}</div>
            <div className="text-xs text-slate-400">before system started</div>
          </div>
          <div className="text-right">
            <div className="text-sm font-semibold text-slate-500">{money(row.amount)}</div>
            <div className="text-xs text-slate-400">bal {money(row.balance)}</div>
          </div>
        </div>
        {info && <ArrearsSplit info={info} className="mt-2" />}
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
          {isBill && t.meta.charge?.metered ? ` · reading ${t.meta.charge.prevReading} → ${t.meta.charge.currentReading}${t.meta.charge.consumption != null ? ` (${t.meta.charge.consumption} L)` : ""}` : ""}
          {isBill && t.meta.charge && !t.meta.charge.metered ? " · flat charge" : ""}
          {!isBill && t.meta.mode ? ` · ${t.meta.mode}` : ""}
          {!isBill && t.meta.payerName && t.meta.payerName !== consumerName ? ` · by ${t.meta.payerName}` : ""}
          {!isBill && t.meta.reference ? ` · ${t.meta.reference}` : ""}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="text-right">
          <div className={`text-sm font-semibold ${isBill ? "text-rose-600" : "text-sky-600"}`}>
            {isBill ? "+" : "−"}{money(t.amount)}
          </div>
          <div className="text-xs text-slate-400">bal {money(row.balance)}</div>
        </div>
        {isBill && onCancelBill && t.id === lastBillId && (
          <button
            type="button"
            onClick={() => { if (confirm("Cancel this bill? It will be deleted and the meter reading restored.")) onCancelBill(consumer, t); }}
            className="shrink-0 rounded-lg border border-rose-200 px-2 py-1 text-[11px] font-semibold text-rose-600 hover:bg-rose-50"
          >
            ✕ Cancel
          </button>
        )}
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

  const [view, setView] = useState("summary");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold">Reports</h2>
        <div className="flex gap-2">
          {view === "summary" && <Button variant="ghost" className="!py-2 text-xs" onClick={exportCSV}>⬇ Excel (CSV)</Button>}
          <Button variant="ghost" className="!py-2 text-xs" onClick={() => window.print()}>⬇ Save as PDF (A4)</Button>
        </div>
      </div>

      {/* sub-tabs — not printed */}
      <div className="inline-flex rounded-xl bg-slate-100 p-1 text-sm print:hidden">
        {[["summary", "Summary"], ["audit", "Audit"]].map(([k, l]) => (
          <button
            key={k}
            onClick={() => setView(k)}
            className={`rounded-lg px-4 py-1.5 font-medium transition ${view === k ? "bg-white text-blue-700 shadow" : "text-slate-500 hover:text-slate-700"}`}
          >
            {l}
          </button>
        ))}
      </div>

      {view === "audit" ? (
        <div id="print-report">
          <Audit consumers={consumers} txns={txns} />
        </div>
      ) : (
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
      )}
    </div>
  );
}

// ===========================================================================
// AUDIT — one A4 report of every bill + payment in a chosen day / month / year
// ===========================================================================
function periodLabel(type, k) {
  if (!k) return "";
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  if (type === "year") return k;
  const [y, m, d] = k.split("-");
  if (type === "day") return `${d} ${names[Number(m) - 1]} ${y}`;
  return `${names[Number(m) - 1]} ${y}`;
}

function Audit({ consumers, txns }) {
  const consumerById = useMemo(() => {
    const m = {};
    for (const c of consumers) m[c.id] = c;
    return m;
  }, [consumers]);

  const [ptype, setPtype] = useState("month"); // day | month | year
  const keyLen = ptype === "day" ? 10 : ptype === "year" ? 4 : 7;
  const periods = useMemo(() => {
    const s = new Set();
    for (const t of txns) { const k = (t.createdAt || "").slice(0, keyLen); if (k) s.add(k); }
    return Array.from(s).sort().reverse();
  }, [txns, keyLen]);

  const [period, setPeriod] = useState("");
  const activePeriod = period || periods[0] || "";

  // Save/print as A4 landscape, scaled so the wide table fits one page width.
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = "@media print { @page { size: A4 landscape; margin: 8mm; } #print-report { zoom: 0.82; } }";
    document.head.appendChild(style);
    return () => style.remove();
  }, []);

  const { rows, totals } = useMemo(() => {
    const map = new Map();
    for (const t of txns) {
      if ((t.createdAt || "").slice(0, keyLen) !== activePeriod) continue;
      const rec = map.get(t.consumerId) || { bill: null, paid: 0, payMeta: null, billDate: "", payDate: "" };
      if (t.type === "bill") { rec.bill = t; rec.billDate = t.date; }
      else { rec.paid += t.amount; rec.payMeta = t.meta; rec.payDate = t.date; }
      map.set(t.consumerId, rec);
    }
    const rows = Array.from(map.entries())
      .map(([cid, rec]) => {
        const c = consumerById[cid];
        const ch = rec.bill?.meta?.charge || {};
        const snap = rec.bill?.meta?.snapshot || {};
        const status = rec.bill
          ? (ch.disconnected ? "Disconnected" : ch.absent ? "Owner away" : ch.meterReset ? "Meter reset" : "Metered")
          : (rec.paid ? "Payment only" : "—");
        return {
          id: cid, c,
          meterNo: c.meterNo || "—",
          date: rec.billDate || rec.payDate || "—",
          billNo: rec.bill?.meta?.billNo || "—",
          prev: ch.prevReading, curr: ch.currentReading, used: ch.consumption,
          water: ch.waterCharge, meter: ch.meterFee, thisBill: ch.currentCharge, season: ch.season || "",
          arrears: snap.arrears, total: snap.totalDue,
          paid: rec.paid, mode: rec.payMeta?.mode || "", receiptNo: rec.payMeta?.receiptNo || "",
          balanceNow: balanceOf(c, txns), status,
        };
      })
      .filter((r) => r.c)
      .sort((a, b) => Number(String(a.c.consumerNo).replace(/\D/g, "")) - Number(String(b.c.consumerNo).replace(/\D/g, "")));
    const totals = rows.reduce((t, r) => ({
      used: t.used + (r.used || 0), water: t.water + (r.water || 0), meter: t.meter + (r.meter || 0),
      thisBill: t.thisBill + (r.thisBill || 0), total: t.total + (r.total || 0), paid: t.paid + (r.paid || 0),
      outstanding: t.outstanding + Math.max(0, r.balanceNow || 0),
    }), { used: 0, water: 0, meter: 0, thisBill: 0, total: 0, paid: 0, outstanding: 0 });
    return { rows, totals };
  }, [txns, activePeriod, keyLen, consumerById]);

  // Old dues (before the system) split by component, across all consumers.
  const oldDues = useMemo(() => {
    const agg = { water: 0, meter: 0, other: 0, fine: 0, total: 0, count: 0 };
    for (const c of consumers) {
      const m = c.dueMeta;
      if (!m) continue;
      const w = Number(m.water) || 0, mt = Number(m.meter) || 0, o = Number(m.other) || 0, f = Number(m.fine) || 0;
      if (w + mt + o + f <= 0) continue;
      agg.water += w; agg.meter += mt; agg.other += o; agg.fine += f;
      agg.total += w + mt + o + f; agg.count += 1;
    }
    return agg;
  }, [consumers]);

  const num = (v) => (v == null || v === "" ? "—" : Number(v).toLocaleString("en-IN"));
  const rs = (v) => (v == null ? "—" : money(v));
  const summary = [
    ["Consumers", rows.length],
    ["Water used", num(totals.used) + " L"],
    ["Water charge", money(totals.water)],
    ["Meter fees", money(totals.meter)],
    ["Billed", money(totals.thisBill)],
    ["Collected", money(totals.paid)],
    ["Outstanding (now)", money(totals.outstanding)],
  ];

  return (
    <div className="space-y-3">
      {/* controls — not printed */}
      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <div className="inline-flex rounded-lg bg-slate-100 p-1 text-xs">
          {[["day", "Daily"], ["month", "Monthly"], ["year", "Yearly"]].map(([k, l]) => (
            <button
              key={k}
              onClick={() => { setPtype(k); setPeriod(""); }}
              className={`rounded-md px-3 py-1 font-medium transition ${ptype === k ? "bg-white text-blue-700 shadow" : "text-slate-500 hover:text-slate-700"}`}
            >
              {l}
            </button>
          ))}
        </div>
        <select value={activePeriod} onChange={(e) => setPeriod(e.target.value)} className={inputClass + " max-w-[220px]"}>
          {periods.length === 0 && <option value="">No data yet</option>}
          {periods.map((p) => <option key={p} value={p}>{periodLabel(ptype, p)}</option>)}
        </select>
        <span className="text-xs text-slate-400">{rows.length} consumer(s)</span>
      </div>

      {/* print header */}
      <div className="hidden print:block">
        <h1 className="text-lg font-bold">{scheme.name}</h1>
        <p className="text-[11px] text-slate-600">{scheme.subtitle}</p>
        <p className="mt-1 text-sm font-semibold">
          Audit Report — {ptype === "day" ? "Daily" : ptype === "year" ? "Yearly" : "Monthly"} · {periodLabel(ptype, activePeriod) || "—"}
        </p>
      </div>

      {/* summary strip (also printed) */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {summary.map(([label, value]) => (
          <div key={label} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
            <div className="text-[10px] uppercase tracking-wide text-slate-400">{label}</div>
            <div className="text-sm font-bold text-slate-700">{value}</div>
          </div>
        ))}
      </div>

      {/* Old dues (before the system) — component breakdown across all consumers */}
      {oldDues.total > 0 && (
        <Card className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-700">Old dues (before system) — {oldDues.count} consumers</span>
            <span className="text-sm font-bold text-rose-600">{money(oldDues.total)}</span>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[["Water", oldDues.water], ["Meter", oldDues.meter], ["Other", oldDues.other], ["Fine", oldDues.fine]].map(([l, v]) => (
              <div key={l} className="rounded-lg bg-amber-50 px-3 py-2 ring-1 ring-amber-100">
                <div className="text-[10px] uppercase tracking-wide text-amber-700">{l}</div>
                <div className="text-sm font-bold text-slate-800">{money(v)}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[1120px] text-left text-[11px]">
          <thead className="bg-slate-50 text-[9px] uppercase text-slate-500">
            <tr>
              <th className="p-1.5">No</th><th className="p-1.5">Name</th><th className="p-1.5">Meter No</th><th className="p-1.5">Date</th>
              <th className="p-1.5 text-right">Prev</th><th className="p-1.5 text-right">Curr</th><th className="p-1.5 text-right">Used L</th>
              <th className="p-1.5 text-right">Water ₹</th><th className="p-1.5 text-right">M.Fee ₹</th><th className="p-1.5 text-right">Bill ₹</th>
              <th className="p-1.5">Bill No</th><th className="p-1.5 text-right">Arrears ₹</th><th className="p-1.5 text-right">Total ₹</th>
              <th className="p-1.5 text-right">Paid ₹</th><th className="p-1.5">Mode</th><th className="p-1.5">Receipt</th>
              <th className="p-1.5 text-right">Balance ₹</th><th className="p-1.5">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-slate-100">
                <td className="p-1.5 font-mono">{r.c.consumerNo}</td>
                <td className="p-1.5">{r.c.name}</td>
                <td className="p-1.5 font-mono text-[10px]">{r.meterNo}</td>
                <td className="p-1.5 whitespace-nowrap">{r.date}</td>
                <td className="p-1.5 text-right">{num(r.prev)}</td>
                <td className="p-1.5 text-right">{num(r.curr)}</td>
                <td className="p-1.5 text-right">{num(r.used)}</td>
                <td className="p-1.5 text-right">{rs(r.water)}</td>
                <td className="p-1.5 text-right">{rs(r.meter)}</td>
                <td className="p-1.5 text-right font-medium">{rs(r.thisBill)}</td>
                <td className="p-1.5 font-mono text-[10px]">{r.billNo}</td>
                <td className="p-1.5 text-right">{rs(r.arrears)}</td>
                <td className="p-1.5 text-right">{rs(r.total)}</td>
                <td className="p-1.5 text-right text-sky-700">{r.paid ? money(r.paid) : "—"}</td>
                <td className="p-1.5">{r.mode || "—"}</td>
                <td className="p-1.5 font-mono text-[10px]">{r.receiptNo || "—"}</td>
                <td className="p-1.5 text-right font-medium">{money(r.balanceNow)}</td>
                <td className="p-1.5 text-[10px]">{r.status}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={18} className="p-6 text-center text-slate-400">No bills or payments in this month.</td></tr>
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot className="border-t-2 border-slate-300 bg-slate-50 font-semibold">
              <tr>
                <td className="p-1.5" colSpan={6}>TOTAL ({rows.length})</td>
                <td className="p-1.5 text-right">{num(totals.used)}</td>
                <td className="p-1.5 text-right">{money(totals.water)}</td>
                <td className="p-1.5 text-right">{money(totals.meter)}</td>
                <td className="p-1.5 text-right">{money(totals.thisBill)}</td>
                <td className="p-1.5"></td>
                <td className="p-1.5"></td>
                <td className="p-1.5 text-right">{money(totals.total)}</td>
                <td className="p-1.5 text-right text-sky-700">{money(totals.paid)}</td>
                <td className="p-1.5"></td><td className="p-1.5"></td>
                <td className="p-1.5 text-right">{money(totals.outstanding)}</td>
                <td className="p-1.5"></td>
              </tr>
            </tfoot>
          )}
        </table>
      </Card>
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
        <h2 className="text-lg font-bold">Tariff & Charges</h2>
        <p className="text-sm text-slate-500">
          These are the rates used to calculate every bill. Change them here any time — the next bill uses the new values immediately.
        </p>
      </div>

      <Card className="p-4">
        <h3 className="mb-1 font-semibold">Slabs — first 15,000 L</h3>
        <p className="mb-3 text-xs text-slate-500">A flat amount, based on which slab the consumption falls in.</p>
        <div className="space-y-2">
          {(form.slabs || []).map((s, i) => (
            <div key={i} className="grid grid-cols-2 gap-3">
              <Field label={`Slab ${i + 1} — up to (L)`}>
                <input type="number" className={inputClass} value={s.upTo}
                  onChange={(e) => update((n, v) => (n.slabs[i].upTo = v), e.target.value)} />
              </Field>
              <Field label="Charge (₹)">
                <input type="number" className={inputClass} value={s.amount}
                  onChange={(e) => update((n, v) => (n.slabs[i].amount = v), e.target.value)} />
              </Field>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="mb-1 font-semibold">Above the slabs</h3>
        <p className="mb-3 text-xs text-slate-500">Only the litres inside each band are charged at that band's rate.</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="15,001–20,000: rate (₹)">
            <input type="number" step="0.01" className={inputClass} value={form.midRate}
              onChange={(e) => update((n, v) => (n.midRate = v), e.target.value)} />
          </Field>
          <Field label="…per litres">
            <input type="number" className={inputClass} value={form.midPer}
              onChange={(e) => update((n, v) => (n.midPer = v), e.target.value)} />
          </Field>
          <Field label="Above 20,000 — Jan–May (₹)">
            <input type="number" step="0.01" className={inputClass} value={form.highRateJanMay}
              onChange={(e) => update((n, v) => (n.highRateJanMay = v), e.target.value)} />
          </Field>
          <Field label="Above 20,000 — Jun–Dec (₹)">
            <input type="number" step="0.01" className={inputClass} value={form.highRateJunDec}
              onChange={(e) => update((n, v) => (n.highRateJunDec = v), e.target.value)} />
          </Field>
          <Field label="…per litres">
            <input type="number" className={inputClass} value={form.highPer}
              onChange={(e) => update((n, v) => (n.highPer = v), e.target.value)} />
          </Field>
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="mb-3 font-semibold">Other charges</h3>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Meter fee (₹)" hint="added to every bill">
            <input type="number" className={inputClass} value={form.meterFee}
              onChange={(e) => update((n, v) => (n.meterFee = v), e.target.value)} />
          </Field>
          <Field label="Disconnected charge (₹)">
            <input type="number" className={inputClass} value={form.disconnectedCharge}
              onChange={(e) => update((n, v) => (n.disconnectedCharge = v), e.target.value)} />
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
