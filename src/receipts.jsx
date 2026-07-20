import { useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import { scheme, money, upiUri, amountInWords } from "./billing";
import { Button, Modal } from "./ui";
import { useLang } from "./i18n";

function L({ l, r, bold }) {
  return (
    <div className={`flex justify-between gap-2 ${bold ? "text-[13px] font-bold" : ""}`}>
      <span className="text-left">{l}</span>
      <span className="text-right">{r}</span>
    </div>
  );
}

function Dashed() {
  return <div className="my-1.5 border-t border-dashed border-slate-400" />;
}

function Head({ title }) {
  return (
    <div className="text-center">
      <div className="text-[11px] font-bold leading-tight">{scheme.malayalamName}</div>
      <div className="text-[12px] font-bold leading-tight">{scheme.name}</div>
      <div className="text-[9px]">{scheme.subtitle}</div>
      <div className="text-[9px]">Ph: {scheme.phone}</div>
      <div className="mt-1 inline-block rounded bg-black px-2 text-[11px] font-bold tracking-wider text-white">{title}</div>
    </div>
  );
}

function Paper({ children }) {
  return (
    <div
      id="receipt-print"
      className="mx-auto bg-white p-3 font-mono text-[11px] leading-tight text-black shadow-inner ring-1 ring-slate-200"
      style={{ width: "58mm" }}
    >
      {children}
    </div>
  );
}

export function BillReceipt({ data }) {
  const { consumer, charge, billNo, arrears, totalDue, date, dueNoFine, dueWithFine, readerName, currReadingDate, prevReadingDate } = data;
  const qr = upiUri({ amount: totalDue, note: `${consumer.consumerNo} ${billNo}` });
  return (
    <Paper>
      <Head title="WATER BILL / NOTICE" />
      <Dashed />
      <L l="Bill No" r={billNo} />
      <L l="Date" r={date} />
      <L l="Con. No" r={consumer.consumerNo} />
      <L l="Name" r={consumer.name} />
      <L l="Meter" r={consumer.meterNo} />
      <Dashed />
      {charge.disconnected ? (
        <L l="Connection" r="Disconnected" />
      ) : charge.metered ? (
        <>
          <L l="Prev reading" r={charge.prevReading} />
          <L l="  on" r={prevReadingDate} />
          <L l="Curr reading" r={charge.currentReading} />
          <L l="  on" r={currReadingDate} />
          {charge.meterReset && <L l="" r="(meter reset)" />}
          <L l="Consumption" r={`${charge.consumption.toLocaleString("en-IN")} L`} />
        </>
      ) : (
        <L l="Connection" r="Flat-rate (no meter)" />
      )}
      <Dashed />
      {charge.parts.map((p, i) => (
        <div key={i}>
          <L l={p.label} r={money(p.amount)} />
          {p.detail && <div className="pl-1 text-[9px]">{p.detail}</div>}
        </div>
      ))}
      <L l="Water charge" r={money(charge.waterCharge)} />
      <L l="Meter fee" r={money(charge.meterFee)} />
      <Dashed />
      <L l="This bill" r={money(charge.currentCharge)} bold />
      <L l="Arrears" r={money(arrears)} />
      <Dashed />
      <L l="TOTAL PAYABLE" r={money(totalDue)} bold />
      <div className="mt-1 text-[9px] italic">({amountInWords(totalDue)})</div>
      <Dashed />
      <div className="text-[9px]">
        <div>Pay by {dueNoFine} — no fine</div>
        <div>Pay by {dueWithFine} — with fine</div>
      </div>
      <Dashed />
      <div className="flex flex-col items-center gap-1 py-1">
        <QRCodeSVG value={qr} size={104} level="M" />
        <div className="text-center text-[10px] font-semibold">Scan to pay · UPI</div>
        <div className="text-center text-[9px]">{scheme.upi.vpa}</div>
      </div>
      <Dashed />
      {readerName && <div className="text-[9px]">Reader: {readerName}</div>}
      <div className="mt-2 text-[9px]">Reader's signature: ____________</div>
      <div className="mt-1 text-center text-[10px]">Thank you!</div>
    </Paper>
  );
}

export function PaymentReceipt({ data }) {
  const { consumer, amount, payerName, reference, mode, receiptNo, balanceAfter, date, alliedFor, spotBillNo, lastCharge } = data;
  const remaining = balanceAfter > 0 ? balanceAfter : 0;
  const credit = balanceAfter < 0 ? -balanceAfter : 0;
  return (
    <Paper>
      <Head title="RECEIPT" />
      <Dashed />
      <L l="Receipt No" r={receiptNo} />
      <L l="Date" r={date} />
      <L l="Con. No" r={consumer.consumerNo} />
      {spotBillNo && <L l="Spot Bill No" r={spotBillNo} />}
      <L l="From" r={payerName || consumer.name} />
      <Dashed />
      <L l="Received Rs" r={money(amount)} bold />
      <L l="Mode" r={mode} />
      {payerName && payerName !== consumer.name && <L l="(for)" r={consumer.name} />}
      {reference && <L l="Ref" r={reference} />}
      {alliedFor && <L l="Allied for" r={alliedFor} />}
      <Dashed />
      {credit > 0 ? <L l="Advance credit" r={money(credit)} bold /> : <L l="Balance due" r={money(remaining)} bold />}
      {lastCharge && (
        <>
          <Dashed />
          <div className="text-[9px] font-bold">Bill charges (ref)</div>
          <L l="Water charge" r={money(lastCharge.waterCharge)} />
          <L l="Meter fee" r={money(lastCharge.meterFee)} />
          <L l="Total" r={money(lastCharge.currentCharge)} bold />
        </>
      )}
      <div className="mt-1 text-[9px] italic">({amountInWords(amount)} received)</div>
      <Dashed />
      <div className="text-center text-[11px] font-bold tracking-wider">✓ PAID</div>
      {remaining > 0 && (
        <div className="mt-1 flex flex-col items-center gap-1">
          <QRCodeSVG value={upiUri({ amount: remaining, note: `${consumer.consumerNo} balance` })} size={92} level="M" />
          <div className="text-[9px]">Scan to pay balance</div>
        </div>
      )}
      <Dashed />
      <div className="text-center text-[10px]">Cashier ______</div>
    </Paper>
  );
}

export function ReceiptModal({ receipt, onClose, onPay }) {
  const { t } = useLang();
  const isBill = receipt.kind === "bill";

  // While a receipt is open, print on a 58mm continuous roll (no page splitting).
  // Removed on close so A4 report printing still works normally.
  useEffect(() => {
    document.body.classList.add("printing-receipt");
    const style = document.createElement("style");
    style.textContent = "@page { size: 58mm auto; margin: 0; }";
    document.head.appendChild(style);
    return () => {
      document.body.classList.remove("printing-receipt");
      style.remove();
    };
  }, []);
  return (
    <Modal
      title={isBill ? "Bill Ready" : "Payment Received"}
      subtitle={`${receipt.data.consumer.name} · ${receipt.data.consumer.consumerNo}`}
      onClose={onClose}
    >
      <div className="max-h-[55vh] overflow-y-auto rounded-2xl bg-slate-100 p-4">
        {isBill ? <BillReceipt data={receipt.data} /> : <PaymentReceipt data={receipt.data} />}
      </div>
      <div className="mt-4 flex gap-2">
        <Button variant="ghost" className="flex-1" onClick={onClose}>Close</Button>
        <Button className="flex-1" onClick={() => window.print()}>🖨 Print</Button>
      </div>
      {isBill && onPay && (
        <Button variant="gold" className="mt-2 w-full" onClick={() => onPay(receipt.data.consumer)}>
          💵 {t("recordPayment")}
        </Button>
      )}
      <p className="mt-2 text-center text-xs text-slate-400">
        On the reader's phone, Print sends this to the Bluetooth printer via RawBT.
      </p>
    </Modal>
  );
}
