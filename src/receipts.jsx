import { QRCodeSVG } from "qrcode.react";
import { scheme, CURRENCY, money, upiUri } from "./billing";
import { Button, Modal } from "./ui";

// A thin line of the receipt (label left, value right)
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
      <div className="text-[13px] font-bold leading-tight">{scheme.name}</div>
      <div className="text-[10px]">{scheme.malayalamName}</div>
      <div className="text-[10px]">{scheme.subtitle}</div>
      <div className="text-[10px]">Ph: {scheme.phone}</div>
      <div className="mt-1 inline-block rounded bg-black px-2 text-[11px] font-bold tracking-wider text-white">
        {title}
      </div>
    </div>
  );
}

// The 58mm paper. Same look on screen and when printed.
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
  const { consumer, charge, billNo, arrears, totalDue, date } = data;
  const qr = upiUri({ amount: totalDue, note: `${consumer.consumerNo} ${billNo}` });
  return (
    <Paper>
      <Head title="WATER BILL" />
      <Dashed />
      <L l="Bill No" r={billNo} />
      <L l="Date" r={date} />
      <L l="Consumer" r={consumer.consumerNo} />
      <L l="Name" r={consumer.name} />
      <L l="Meter" r={consumer.meterNo} />
      <Dashed />
      {charge.metered ? (
        <>
          <L l="Prev reading" r={charge.prevReading} />
          <L l="Curr reading" r={charge.currentReading} />
          {charge.meterReset && <L l="" r="(meter reset)" />}
          <L l="Units used" r={charge.units} />
          <L l={`Water @${CURRENCY}${charge.ratePerUnit}`} r={money(charge.units * charge.ratePerUnit)} />
          <L l="Fixed charge" r={money(charge.fixedCharge)} />
        </>
      ) : (
        <L l="Flat charge" r={money(charge.currentCharge)} />
      )}
      <L l="This month" r={money(charge.currentCharge)} />
      <L l="Old arrears" r={money(arrears)} />
      <Dashed />
      <L l="TOTAL DUE" r={money(totalDue)} bold />
      <Dashed />
      <div className="flex flex-col items-center gap-1 py-1">
        <QRCodeSVG value={qr} size={104} level="M" />
        <div className="text-center text-[10px] font-semibold">Scan to pay · UPI</div>
        <div className="text-center text-[9px]">{scheme.upi.vpa}</div>
      </div>
      <Dashed />
      <div className="text-center text-[10px]">Please pay before due date. Thank you!</div>
    </Paper>
  );
}

export function PaymentReceipt({ data }) {
  const { consumer, amount, payerName, reference, mode, receiptNo, balanceAfter, date } = data;
  const remaining = balanceAfter > 0 ? balanceAfter : 0;
  const credit = balanceAfter < 0 ? -balanceAfter : 0;
  return (
    <Paper>
      <Head title="PAYMENT RECEIPT" />
      <Dashed />
      <L l="Receipt No" r={receiptNo} />
      <L l="Date" r={date} />
      <L l="Consumer" r={consumer.consumerNo} />
      <L l="Name" r={consumer.name} />
      <Dashed />
      <L l="Amount paid" r={money(amount)} bold />
      <L l="Mode" r={mode} />
      {payerName && payerName !== consumer.name && <L l="Paid by" r={payerName} />}
      {reference && <L l="Ref" r={reference} />}
      <Dashed />
      {credit > 0 ? (
        <L l="Advance credit" r={money(credit)} bold />
      ) : (
        <L l="Balance remaining" r={money(remaining)} bold />
      )}
      <Dashed />
      <div className="text-center text-[11px] font-bold tracking-wider">✓ PAID</div>
      {remaining > 0 && (
        <div className="mt-1 flex flex-col items-center gap-1">
          <QRCodeSVG value={upiUri({ amount: remaining, note: `${consumer.consumerNo} balance` })} size={92} level="M" />
          <div className="text-[9px]">Scan to pay balance</div>
        </div>
      )}
      <Dashed />
      <div className="text-center text-[10px]">Thank you!</div>
    </Paper>
  );
}

// One modal for both kinds of receipt.
export function ReceiptModal({ receipt, onClose }) {
  const isBill = receipt.kind === "bill";
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
        <Button variant="ghost" className="flex-1" onClick={onClose}>
          Close
        </Button>
        <Button className="flex-1" onClick={() => window.print()}>
          🖨 Print
        </Button>
      </div>
      <p className="mt-2 text-center text-xs text-slate-400">
        On the reader's phone, Print sends this to the Bluetooth printer via RawBT.
      </p>
    </Modal>
  );
}
