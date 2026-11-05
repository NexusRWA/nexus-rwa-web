import { render, screen } from "@testing-library/react";
import { Step4Done } from "./Step4Done";

jest.mock("@/hooks/useWallet", () => ({
  useWallet: () => ({ network: "testnet" }),
}));

jest.mock("@/lib/stellar", () => ({
  explorerTxUrl: (network: string, hash: string) => `/${network}/tx/${hash}`,
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

describe("Step4Done", () => {
  it("renders the explorer link for the created asset", () => {
    render(
      <Step4Done
        validated={validated}
        name="Registry Property"
        assetType="real_estate"
        valuation={25000000n}
        assetId={42n}
        txHash="tx-hash"
      />,
    );

    expect(screen.getByRole("link", { name: /view asset page/i })).toHaveAttribute(
      "href",
      "/asset/42",
    );
  });
});