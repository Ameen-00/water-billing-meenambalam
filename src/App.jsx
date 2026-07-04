import { useEffect, useState } from "react";
import {
  scheme, initialTariff, money, balanceOf, calculateCharge, docNo,
} from "./billing";
import { supabase, isConfigured } from "./lib/supabase";
import * as db from "./lib/db";
import { WaterDrop, Avatar, Card, Button, Field, inputClass, Modal, BalancePill } from "./ui";
import { AdminArea } from "./admin";
import { ReceiptModal } from "./receipts";
import { Toaster, toast } from "./toast";

function today() {
  return new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export default function App() {
  const [session, setSession] = useState(undefined); // undefined=checking, null=logged out
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(null);

  const [role, setRole] = useState("reader");
  const [consumers, setConsumers] = useState([]);
  const [tariff, setTariff] = useState(initialTariff);
  const [txns, setTxns] = useState([]);
  const [seq, setSeq] = useState({ bill: 0, receipt: 0 });
  const [receipt, setReceipt] = useState(null);
  const [paying, setPaying] = useState(null);

  // Watch the login session.
  useEffect(() => {
    if (!isConfigured) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  // Load data once logged in.
  useEffect(() => {
    if (!session) return;
    let alive = true;
    setLoaded(false);
    setLoadError(null);
    db.fetchAll()
      .then((d) => {
        if (!alive) return;
        setConsumers(d.consumers);
        setTxns(d.txns);
        if (d.tariff) setTariff(d.tariff);
        setSeq({
          bill: d.txns.filter((t) => t.type === "bill").length,
          receipt: d.txns.filter((t) => t.type === "payment").length,
        });
        setLoaded(true);
      })
      .catch((e) => alive && setLoadError(e.message));
    return () => { alive = false; };
  }, [session]);

  async function generateBill(consumer, charge) {
    try {
      const arrears = balanceOf(consumer, txns);
      const totalDue = arrears + charge.currentCharge;
      const billNo = docNo("B", seq.bill + 1);
      const txn = await db.insertTransaction({
        consumerId: consumer.id, type: "bill", amount: charge.currentCharge, date: today(), meta: { billNo, charge },
      });
      setTxns((p) => [...p, txn]);
      if (charge.metered) {
        await db.updatePrevReading(consumer.id, charge.currentReading);
        setConsumers((p) => p.map((c) => (c.id === consumer.id ? { ...c, prevReading: charge.currentReading } : c)));
      }
      setSeq((s) => ({ ...s, bill: s.bill + 1 }));
      setReceipt({ kind: "bill", data: { consumer, charge, billNo, arrears, totalDue, date: today() } });
      toast.success(`Bill ${billNo} saved`);
    } catch (e) {
      toast.error("Could not save the bill: " + e.message);
    }
  }

  async function recordPayment(consumer, { amount, payerName, reference, mode }) {
    try {
      const before = balanceOf(consumer, txns);
      const balanceAfter = before - amount;
      const receiptNo = docNo("R", seq.receipt + 1);
      const txn = await db.insertTransaction({
        consumerId: consumer.id, type: "payment", amount, date: today(), meta: { receiptNo, payerName, reference, mode },
      });
      setTxns((p) => [...p, txn]);
      setSeq((s) => ({ ...s, receipt: s.receipt + 1 }));
      setReceipt({ kind: "payment", data: { consumer, amount, payerName, reference, mode, receiptNo, balanceAfter, date: today() } });
      toast.success(`Payment ${receiptNo} recorded`);
    } catch (e) {
      toast.error("Could not save the payment: " + e.message);
    }
  }

  async function persistTariff(t) {
    setTariff(t);
    try {
      await db.saveTariffToDb(t);
      toast.success("Rates updated");
    } catch (e) {
      toast.error("Could not save rates: " + e.message);
    }
  }

  async function addConsumer(data) {
    try {
      const c = await db.insertConsumer(data);
      setConsumers((p) => [...p, c]);
      toast.success(`Connection ${c.consumerNo} added`);
      return true;
    } catch (e) {
      toast.error("Could not add connection: " + e.message);
      return false;
    }
  }

  // ---- gates ----
  let content;
  if (!isConfigured) content = <FullScreen title="Not connected" msg="Supabase keys are missing (.env.local)." />;
  else if (session === undefined) content = <FullScreen title="Loading" msg="Checking your login…" spinner />;
  else if (session === null) content = <Login />;
  else if (loadError) content = <FullScreen title="Could not load data" msg={loadError} />;
  else if (!loaded) content = <FullScreen title="Loading" msg="Fetching your consumers…" spinner />;
  else
    content = (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 text-slate-800">
        <TopBar role={role} setRole={setRole} email={session.user?.email} />

        <main key={role} className="animate-fade-in mx-auto max-w-5xl px-4 pb-24 pt-5">
          {role === "reader" ? (
            <ReaderFlow consumers={consumers} txns={txns} tariff={tariff} onGenerate={generateBill} />
          ) : (
            <AdminArea consumers={consumers} txns={txns} tariff={tariff} setTariff={persistTariff} onPay={setPaying} onAddConsumer={addConsumer} />
          )}
        </main>

        {paying && (
          <PaymentModal
            consumer={paying}
            balance={balanceOf(paying, txns)}
            onClose={() => setPaying(null)}
            onConfirm={(payload) => { recordPayment(paying, payload); setPaying(null); }}
          />
        )}
        {receipt && <ReceiptModal receipt={receipt} onClose={() => setReceipt(null)} />}
      </div>
    );

  return (
    <>
      {content}
      <Toaster />
    </>
  );
}

// ---------------------------------------------------------------------------
function FullScreen({ title, msg, spinner }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-gradient-to-b from-slate-50 to-slate-100 p-6 text-center">
      {spinner ? (
        <div className="relative flex h-14 w-14 items-center justify-center">
          <div className="absolute inset-0 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600" />
          <WaterDrop className="h-6 w-6 text-blue-600" />
        </div>
      ) : (
        <WaterDrop className="h-12 w-12 text-blue-600" />
      )}
      <h1 className="text-lg font-bold text-slate-800">{title}</h1>
      <p className="max-w-sm text-sm text-slate-500">{msg}</p>
    </div>
  );
}

function Login() {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pw });
    if (error) { setErr(error.message); toast.error("Sign in failed"); }
    setBusy(false);
  }

  return (
    <div className="animate-gradient relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-blue-800 via-blue-700 to-sky-600 p-4">
      {/* decorative layered waves */}
      <svg className="pointer-events-none absolute bottom-0 left-0 w-full text-white/10" viewBox="0 0 1440 220" preserveAspectRatio="none" fill="currentColor">
        <path d="M0 120 Q 360 40 720 120 T 1440 120 L1440 220 L0 220 Z" />
      </svg>
      <svg className="pointer-events-none absolute bottom-0 left-0 w-full text-white/10" viewBox="0 0 1440 160" preserveAspectRatio="none" fill="currentColor">
        <path d="M0 90 Q 360 150 720 90 T 1440 90 L1440 160 L0 160 Z" />
      </svg>
      <form onSubmit={submit} className="animate-slide-up relative z-10 w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex flex-col items-center gap-2 text-center">
          <div className="animate-floaty flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
            <WaterDrop className="h-8 w-8" />
          </div>
          <h1 className="text-lg font-bold">{scheme.name}</h1>
          <p className="text-xs text-slate-500">Water Billing System · Staff Login</p>
        </div>
        <div className="space-y-3">
          <Field label="Email">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} placeholder="office@kws.in" autoFocus />
          </Field>
          <Field label="Password">
            <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} className={inputClass} placeholder="••••••••" />
          </Field>
          {err && <p className="rounded-lg bg-rose-50 p-2 text-center text-sm text-rose-600">{err}</p>}
          <Button type="submit" className="w-full py-3" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function TopBar({ role, setRole, email }) {
  return (
    <header className="animate-gradient relative overflow-hidden bg-gradient-to-r from-blue-800 via-blue-700 to-sky-600 text-white shadow-lg">
      <div className="relative z-10 mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25 backdrop-blur">
            <WaterDrop className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold leading-tight sm:text-lg">{scheme.name}</h1>
            <p className="text-xs text-blue-100">{scheme.malayalamName} · Billing System</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-xl bg-black/15 p-1 text-xs font-semibold ring-1 ring-white/15">
            {["reader", "admin"].map((r) => (
              <button
                key={r}
                onClick={() => setRole(r)}
                className={`rounded-lg px-3 py-1.5 transition ${role === r ? "bg-white text-blue-800 shadow" : "text-blue-50 hover:bg-white/10"}`}
              >
                {r === "reader" ? "Meter Reader" : "Admin"}
              </button>
            ))}
          </div>
          <button
            onClick={() => supabase.auth.signOut()}
            title={email ? `Sign out (${email})` : "Sign out"}
            className="rounded-xl bg-black/15 p-2 ring-1 ring-white/15 hover:bg-black/25"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>
      <svg className="absolute bottom-0 left-0 h-6 w-full text-slate-50" viewBox="0 0 1440 40" preserveAspectRatio="none" fill="currentColor">
        <path d="M0 40 L0 24 Q 180 44 360 24 T 720 24 T 1080 24 T 1440 24 L1440 40 Z" opacity="0.5" />
      </svg>
    </header>
  );
}

// ---------------------------------------------------------------------------
// METER READER FLOW
// ---------------------------------------------------------------------------
function ReaderFlow({ consumers, txns, tariff, onGenerate }) {
  const [selected, setSelected] = useState(null);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("pending"); // pending | all | done

  if (selected) {
    return (
      <ReadingEntry
        consumer={selected}
        tariff={tariff}
        arrears={balanceOf(selected, txns)}
        onBack={() => setSelected(null)}
        onGenerate={(charge) => { onGenerate(selected, charge); setSelected(null); }}
      />
    );
  }

  // "Done this cycle" = billed in the current calendar month. Order-independent,
  // so the reader can walk in any direction and still see who is left.
  const monthKey = new Date().toISOString().slice(0, 7);
  const isDone = (c) =>
    txns.some((t) => t.type === "bill" && t.consumerId === c.id && (t.createdAt || "").slice(0, 7) === monthKey);
  const doneCount = consumers.filter(isDone).length;
  const total = consumers.length;
  const pct = total ? Math.round((doneCount / total) * 100) : 0;

  const s = q.trim().toLowerCase();
  const list = consumers.filter((c) => {
    if (s && ![c.name, c.consumerNo, c.meterNo, c.address].join(" ").toLowerCase().includes(s)) return false;
    if (filter === "pending") return !isDone(c);
    if (filter === "done") return isDone(c);
    return true;
  });

  const chips = [
    { key: "pending", label: `Pending (${total - doneCount})` },
    { key: "all", label: `All (${total})` },
    { key: "done", label: `Billed (${doneCount})` },
  ];

  return (
    <div className="mx-auto max-w-md">
      <div className="mb-3">
        <h2 className="text-lg font-bold">Meter Reading</h2>
        <p className="text-sm text-slate-500">This month's progress — read in any order</p>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
          <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: pct + "%" }} />
        </div>
        <p className="mt-1 text-xs text-slate-500">{doneCount} of {total} billed ({pct}%)</p>
      </div>

      <div className="mb-3 flex items-center gap-2 rounded-xl bg-white p-2.5 shadow-sm ring-1 ring-slate-200">
        <svg viewBox="0 0 24 24" className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" strokeLinecap="round" />
        </svg>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search the house you're at — name, no, meter…"
          className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
        />
      </div>

      <div className="mb-3 flex gap-2">
        {chips.map((ch) => (
          <button
            key={ch.key}
            onClick={() => setFilter(ch.key)}
            className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold ring-1 transition ${filter === ch.key ? "bg-blue-700 text-white ring-blue-700" : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50"}`}
          >
            {ch.label}
          </button>
        ))}
      </div>

      <div className="space-y-2.5">
        {list.map((c) => {
          const bal = balanceOf(c, txns);
          const done = isDone(c);
          return (
            <Card key={c.id} className="flex items-center gap-3 p-3.5" onClick={() => setSelected(c)}>
              <Avatar name={c.name} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-semibold">{c.name}</span>
                  {done && <span className="shrink-0 rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700">✓ billed</span>}
                </div>
                <div className="truncate text-xs text-slate-500">{c.consumerNo} · {c.meterNo}</div>
              </div>
              <BalancePill amount={bal} />
            </Card>
          );
        })}
        {list.length === 0 && (
          <div className="rounded-xl bg-white p-6 text-center text-sm text-slate-400 ring-1 ring-slate-200">No houses match.</div>
        )}
      </div>
    </div>
  );
}

function ReadingEntry({ consumer, tariff, arrears, onBack, onGenerate }) {
  const [reading, setReading] = useState("");
  const [reset, setReset] = useState(false);
  const charge = calculateCharge(consumer, reading, tariff, reset);
  const totalDue = arrears + charge.currentCharge;

  const readingLow = consumer.metered && !reset && reading !== "" && Number(reading) < consumer.prevReading;
  const canSave = !consumer.metered || (reading !== "" && !readingLow);

  return (
    <div className="mx-auto max-w-md space-y-3">
      <button onClick={onBack} className="text-sm font-medium text-blue-700 hover:underline">← Back to route</button>

      <Card className="p-4">
        <div className="flex items-center gap-3">
          <Avatar name={consumer.name} size="h-12 w-12" />
          <div className="min-w-0">
            <div className="truncate font-bold">{consumer.name}</div>
            <div className="truncate text-xs text-slate-500">{consumer.consumerNo} · {consumer.meterNo} · {consumer.address}</div>
          </div>
        </div>

        {consumer.metered ? (
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm ring-1 ring-slate-200">
              <span className="text-slate-500">Previous reading</span>
              <span className="font-semibold">{reset ? "0 (reset)" : consumer.prevReading}</span>
            </div>
            <Field label="Current reading">
              <input
                type="number" inputMode="numeric" value={reading}
                onChange={(e) => setReading(e.target.value)}
                placeholder={`e.g. ${consumer.prevReading + 10}`}
                className={inputClass + " text-lg"} autoFocus
              />
            </Field>
            {readingLow && (
              <p className="text-xs text-rose-600">
                Reading is below previous ({consumer.prevReading}). If the meter was replaced, tick the box below.
              </p>
            )}
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={reset} onChange={(e) => setReset(e.target.checked)} className="h-4 w-4 rounded" />
              Meter was replaced / reset (count from 0)
            </label>
          </div>
        ) : (
          <div className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800 ring-1 ring-amber-200">
            Flat-rate connection (no meter). Fixed monthly charge applies.
          </div>
        )}
      </Card>

      <Card className="p-4">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Bill preview</h3>
        <Line l="Units used" v={consumer.metered ? charge.units : "—"} />
        <Line l="This month's charge" v={money(charge.currentCharge)} />
        <Line l="Previous arrears" v={money(arrears)} />
        <div className="my-2 border-t border-dashed border-slate-200" />
        <Line l="TOTAL DUE" v={money(totalDue)} bold />
      </Card>

      <Button className="w-full py-3 text-base" disabled={!canSave} onClick={() => onGenerate(charge)}>
        Save & Print Bill
      </Button>
    </div>
  );
}

function Line({ l, v, bold }) {
  return (
    <div className="flex items-center justify-between py-1 text-sm">
      <span className={bold ? "font-bold" : "text-slate-600"}>{l}</span>
      <span className={bold ? "text-lg font-bold text-blue-700" : "font-medium"}>{v}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PAYMENT MODAL
// ---------------------------------------------------------------------------
function PaymentModal({ consumer, balance, onClose, onConfirm }) {
  const [amount, setAmount] = useState(String(Math.max(0, balance)));
  const [payerName, setPayerName] = useState(consumer.name);
  const [reference, setReference] = useState("");
  const [mode, setMode] = useState("UPI");
  const value = Number(amount) || 0;
  const after = balance - value;

  return (
    <Modal title="Record Payment" subtitle={`${consumer.name} · ${consumer.consumerNo}`} onClose={onClose}>
      <div className="mb-3 flex items-center justify-between rounded-xl bg-rose-50 px-3 py-2 text-sm ring-1 ring-rose-200">
        <span className="text-slate-600">Current due</span>
        <span className="font-bold text-rose-600">{money(Math.max(0, balance))}</span>
      </div>

      <div className="space-y-3">
        <Field label="Amount received">
          <input type="number" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass + " text-lg"} autoFocus />
        </Field>

        <div className="grid grid-cols-3 gap-2">
          {["UPI", "Cash", "Bank"].map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded-xl border py-2 text-sm font-medium transition ${mode === m ? "border-blue-600 bg-blue-50 text-blue-700" : "border-slate-300 text-slate-600 hover:bg-slate-50"}`}
            >
              {m}
            </button>
          ))}
        </div>

        <Field label="Paid by (if different from consumer)" hint="e.g. paid via son's / tenant's account">
          <input value={payerName} onChange={(e) => setPayerName(e.target.value)} className={inputClass} />
        </Field>

        <Field label="Reference / notes (optional)" hint="UPI txn id, cheque no, remark">
          <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. UPI 4432 (son's a/c)" className={inputClass} />
        </Field>

        <div className={`rounded-xl px-3 py-2 text-sm ring-1 ${after < 0 ? "bg-sky-50 ring-sky-200" : "bg-slate-50 ring-slate-200"}`}>
          {after < 0 ? (
            <span className="text-sky-700">Overpayment — <b>{money(-after)}</b> kept as advance credit.</span>
          ) : (
            <span className="text-slate-600">Balance after payment: <b>{money(after)}</b></span>
          )}
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <Button variant="ghost" className="flex-1" onClick={onClose}>Cancel</Button>
        <Button variant="gold" className="flex-1" disabled={value <= 0} onClick={() => onConfirm({ amount: value, payerName: payerName.trim() || consumer.name, reference: reference.trim(), mode })}>
          Confirm & Print Receipt
        </Button>
      </div>
    </Modal>
  );
}
