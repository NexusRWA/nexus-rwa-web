import { render, screen } from "@testing-library/react";
import { Step3Confirm } from "./Step3Confirm";

jest.mock("@/hooks/useWallet", () => ({
  useWallet: () => ({ address: "GISSUER", network: "testnet" }),
}));

jest.mock("@/hooks/useTx", () => ({
  useTx: () => ({
    phase: "idle",
    hash: null,
    error: null,
    pending: false,
    retryable: false,
    run: jest.fn(),
    retry: jest.fn(),
    reset: jest.fn(),
  }),
}));

const validated = {
  tokenContract: "GTOKEN",
  metadata: {
    name: "On-chain Property",
    symbol: "PROP",
    assetType: "real_estate",
    totalSupply: 125000n,
    decimals: 2,
    admin: "GADMIN",
    complianceContract: "GCOMPLIANCE",
    assetDescription: "A property token",
    valuation: 25000000n,
    paused: false,
  },
};

describe("Step3Confirm", () => {
  it("renders every value collected in earlier steps", () => {
    render(
      <Step3Confirm
        validated={validated}
        formData={{
          name: "Registry Property",
          assetType: "real_estate",
          valuation: 25000000n,
        }}
        onBack={jest.fn()}
        onRegistered={jest.fn()}
      />,
    );

    expect(screen.getByText("Registry Property")).toBeInTheDocument();
    // Rendered both as the asset-type chip and in the summary rows.
    expect(screen.getAllByText("Real Estate")).not.toHaveLength(0);
    expect(screen.getByText("$250,000")).toBeInTheDocument();
    expect(screen.getByText("GTOKEN")).toBeInTheDocument();
    expect(screen.getAllByText("On-chain Property")).not.toHaveLength(0);
    expect(screen.getAllByText("PROP")).not.toHaveLength(0);
    expect(screen.getAllByText("1,250 PROP")).not.toHaveLength(0);
    expect(screen.getByText("GCOMPLIANCE")).toBeInTheDocument();
    expect(screen.getByText("GISSUER")).toBeInTheDocument();
  });
});