import { render, screen } from "@testing-library/react";
import { PortfolioSummary } from "./PortfolioSummary";
import type { PortfolioData } from "@/hooks/usePortfolio";

// Mock ClaimButton to avoid transitively loading the Stellar SDK (ESM).
jest.mock("@/components/dividend/ClaimButton", () => ({
  ClaimButton: () => null,
}));

/** Minimal holding used to populate holdings arrays. */
const HOLDING = (id: bigint, balance: bigint, supply: bigint, valuation: bigint) => ({
  asset: {
    id,
    tokenContract: `C${id}`,
    issuer: "GABC",
    name: `Asset ${id}`,
    assetType: "real_estate" as const,
    valuation,
    createdAt: 1,
    active: true,
  },
  metadata: {
    name: `Asset ${id}`,
    symbol: `A${id}`,
    assetType: "real_estate" as const,
    totalSupply: supply,
    decimals: 2,
    admin: "GABC",
    complianceContract: "CCABC",
    assetDescription: "desc",
    valuation,
    paused: false,
  },
  balance,
  claimableDistributions: [],
  totalClaimable: [],
  failedAssetCount: 0,
  isIncomplete: false,
});

describe("PortfolioSummary", () => {
  describe("empty portfolio", () => {
    const emptyData: PortfolioData = {
      holdings: [],
      totalValueCents: 0n,
      totalClaimable: [],
      failedAssetCount: 0,
      isIncomplete: false,
    };

    it("renders all three stat cards", () => {
      render(<PortfolioSummary data={emptyData} />);

      expect(screen.getByText("Estimated Value")).toBeInTheDocument();
      expect(screen.getByText("Assets Held")).toBeInTheDocument();
      expect(screen.getByText("Claimable Dividends")).toBeInTheDocument();
    });

    it("shows $0 estimated value", () => {
      render(<PortfolioSummary data={emptyData} />);

      expect(screen.getByText("$0")).toBeInTheDocument();
    });

    it("shows 0 assets held", () => {
      render(<PortfolioSummary data={emptyData} />);

      expect(screen.getByText("0")).toBeInTheDocument();
    });

    it("shows em-dash for claimable dividends when there are none", () => {
      render(<PortfolioSummary data={emptyData} />);

      // em-dash placeholder when totalClaimable === 0n
      expect(screen.getByText("—")).toBeInTheDocument();
    });
  });

  describe("portfolio with holdings", () => {
    it("shows the correct asset count across multiple holdings", () => {
      const data: PortfolioData = {
        holdings: [
          HOLDING(1n, 500n, 1000n, 10_000_000n),
          HOLDING(2n, 250n, 1000n, 5_000_000n),
          HOLDING(3n, 100n, 1000n, 2_000_000n),
        ],
        totalValueCents: 8_750_000n,
        totalClaimable: [],
        failedAssetCount: 0,
        isIncomplete: false,
      };
      render(<PortfolioSummary data={data} />);

      expect(screen.getByText("3")).toBeInTheDocument();
    });

    it("formats the estimated total value in compact notation for large amounts", () => {
      const data: PortfolioData = {
        holdings: [HOLDING(1n, 1000n, 1000n, 5_000_000_00n)],
        totalValueCents: 5_000_000_00n, // $5,000,000
        totalClaimable: [],
        failedAssetCount: 0,
        isIncomplete: false,
      };
      render(<PortfolioSummary data={data} />);

      // formatUsdCents with compact -> "$5M"
      expect(screen.getByText("$5M")).toBeInTheDocument();
    });

    it("formats the estimated total value without compact for small amounts", () => {
      const data: PortfolioData = {
        holdings: [HOLDING(1n, 100n, 1000n, 250_000n)],
        totalValueCents: 25_000n, // $250
        totalClaimable: [],
        failedAssetCount: 0,
        isIncomplete: false,
      };
      render(<PortfolioSummary data={data} />);

      expect(screen.getByText("$250")).toBeInTheDocument();
    });
  });

  describe("claimable dividends", () => {
    it("shows each claimable amount formatted with its payment token decimals", () => {
      // 5_000_000_0n @ 7 decimals = "5" tokens
      const data: PortfolioData = {
        holdings: [HOLDING(1n, 1000n, 1000n, 1_000_000n)],
        totalValueCents: 1_000_000n,
        totalClaimable: [{ paymentToken: "CPAYMENT", decimals: 7, amount: 5_000_000_0n }],
        failedAssetCount: 0,
        isIncomplete: false,
      };
      render(<PortfolioSummary data={data} />);

      expect(screen.getByText("5 CPAYMENT")).toBeInTheDocument();
      // em-dash should NOT appear
      expect(screen.queryByText("—")).not.toBeInTheDocument();
    });

    it("does not render an em-dash when there are claimable dividends", () => {
      const data: PortfolioData = {
        holdings: [HOLDING(1n, 1000n, 1000n, 1_000_000n)],
        totalValueCents: 1_000_000n,
        totalClaimable: [{ paymentToken: "CPAYMENT", decimals: 7, amount: 1_000_000_0n }],
        failedAssetCount: 0,
        isIncomplete: false,
      };
      render(<PortfolioSummary data={data} />);

      expect(screen.queryByText("—")).not.toBeInTheDocument();
    });
  });
});
