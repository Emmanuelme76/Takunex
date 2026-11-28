"use client";

import type { PayoutData } from "./types";
import { payoutMissing } from "./types";
import { fieldClass } from "./StepProfile";

const BANKS = [
  "BBVA", "Banorte", "Santander", "HSBC", "Citibanamex",
  "Scotiabank", "Inbursa", "Banco Azteca", "Other",
];

interface Props {
  data: PayoutData;
  onChange: (data: PayoutData) => void;
  showErrors: boolean;
}

export function StepPayout({ data, onChange, showErrors }: Props) {
  const missing = payoutMissing(data);
  const set = (patch: Partial<PayoutData>) => onChange({ ...data, ...patch });
  const border = (bad: boolean) => (showErrors && bad ? "border-red-500" : "");
  const label = "mb-1.5 block text-sm font-bold text-tx-navy";
  const err = "mt-1 text-xs font-medium text-red-600";

  return (
    <div className="mx-auto max-w-md space-y-5">
      <div>
        <label htmlFor="bank" className={label}>Bank Name</label>
        <select
          id="bank"
          value={data.bankName}
          onChange={(e) => set({ bankName: e.target.value })}
          className={`${fieldClass} ${border(missing.bankName)}`}
        >
          <option value="">Bank Name</option>
          {BANKS.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
        {showErrors && missing.bankName && <p className={err}>Select your bank.</p>}
      </div>

      <div>
        <label htmlFor="account" className={label}>Card / Account Number</label>
        <input
          id="account"
          inputMode="numeric"
          maxLength={16}
          value={data.accountNumber}
          onChange={(e) => set({ accountNumber: e.target.value.replace(/\D/g, "") })}
          placeholder="Card / Account Number"
          autoComplete="off"
          className={`${fieldClass} ${border(missing.accountNumber)}`}
        />
        {showErrors && missing.accountNumber && <p className={err}>Enter 10 to 16 digits.</p>}
      </div>

      <div>
        <label htmlFor="holder" className={label}>Cardholder Name</label>
        <input
          id="holder"
          value={data.cardholderName}
          onChange={(e) => set({ cardholderName: e.target.value })}
          placeholder="Cardholder Name"
          autoComplete="off"
          className={`${fieldClass} ${border(missing.cardholderName)}`}
        />
        {showErrors && missing.cardholderName && <p className={err}>Enter a valid name.</p>}
      </div>

      <div>
        <label htmlFor="clabe" className={label}>Interbank CLABE</label>
        <input
          id="clabe"
          inputMode="numeric"
          maxLength={18}
          value={data.clabe}
          onChange={(e) => set({ clabe: e.target.value.replace(/\D/g, "") })}
          placeholder="Interbank CLABE"
          autoComplete="off"
          className={`${fieldClass} ${border(missing.clabe)}`}
        />
        {showErrors && missing.clabe && <p className={err}>The CLABE must have exactly 18 digits.</p>}
      </div>
    </div>
  );
}