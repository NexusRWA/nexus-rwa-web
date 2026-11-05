"use client";

import { useState } from "react";
import { useWallet } from "@/hooks/useWallet";
import { ConnectButton } from "@/components/wallet/ConnectButton";
import { StepIndicator } from "./StepIndicator";
import { Step1TokenContract } from "./Step1TokenContract";
import { Step2AssetDetails } from "./Step2AssetDetails";
import { Step3Confirm } from "./Step3Confirm";
import { Step4Done } from "./Step4Done";
import type { ValidatedToken, TokenizeFormData } from "@/lib/tokenizeFlow";

const STEPS = [
  { id: 1, label: "Token contract" },
  { id: 2, label: "Asset details" },
  { id: 3, label: "Confirm" },
  { id: 4, label: "Done" },
];

interface DoneState {
  assetId: bigint | null;
  txHash: string;
}

/** Multi-step wizard for registering a tokenized real-world asset. */
export function TokenizeWizard() {
  const { address } = useWallet();
  const [step, setStep] = useState(1);
  const [validated, setValidated] = useState<ValidatedToken | null>(null);
  const [formData, setFormData] = useState<Partial<Pick<TokenizeFormData, "name" | "assetType" | "valuation">>>({});
  const [done, setDone] = useState<DoneState | null>(null);

  // Wallet gate — must connect before starting
  if (!address) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 rounded-2xl border border-dashed border-white/10 px-6 py-20 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500/10 text-brand-400">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="m12 2 8 4.5v9L12 20l-8-4.5v-9L12 2Z" strokeLinejoin="round" />
            <path d="M12 8v8M8 10v4M16 10v4" strokeLinecap="round" />
          </svg>
        </div>
        <div>
          <h2 className="text-xl font-semibold text-base-100">Connect your wallet</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-base-100/55">
            You must connect the issuer wallet before registering an asset. The
            connected address will be recorded as the issuer.
          </p>
        </div>
        <ConnectButton />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <StepIndicator steps={STEPS} current={step} />

      {step === 1 && (
        <Step1TokenContract
          onValidated={(result) => {
            setValidated(result);
            setStep(2);
          }}
        />
      )}

      {step === 2 && validated && (
        <Step2AssetDetails
          validated={validated}
          initial={formData}
          onBack={() => setStep(1)}
          onNext={(data) => {
            setFormData(data);
            setStep(3);
          }}
        />
      )}

      {step === 3 && validated && formData.name && formData.assetType && formData.valuation !== undefined && (
        <Step3Confirm
          validated={validated}
          formData={{
            name: formData.name,
            assetType: formData.assetType,
            valuation: formData.valuation,
          }}
          onBack={() => setStep(2)}
          onRegistered={(assetId, txHash) => {
            setDone({ assetId, txHash });
            setStep(4);
          }}
        />
      )}

      {step === 4 && validated && done && formData.name && formData.assetType && formData.valuation !== undefined && (
        <Step4Done
          validated={validated}
          name={formData.name}
          assetType={formData.assetType}
          valuation={formData.valuation}
          assetId={done.assetId}
          txHash={done.txHash}
        />
      )}
    </div>
  );
}
