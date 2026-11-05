import { render, screen, fireEvent } from "@testing-library/react";
import { HoldingRow } from "./HoldingRow";
import type { Holding } from "@/hooks/usePortfolio";

// Mock sub-components that pull in Stellar SDK / wallet context
jest.mock("@/components/asset/AssetTypeBadge", () => ({
  AssetTypeBadge: ({ type }: { type: string }) => <span>{type}</span>,
}));

jest.mock("@/components/dividend/DistributionCard", () => ({
  DistributionCard: ({ distribution }: { distribution: { id: bigint } }) => (
    <div>Distribution {distribution.id.toString()}</div>
  ),
}));

// ClaimButton imports lib/contracts → @stellar/stellar-sdk (ESM); mock it out
// and re-export the constant so HoldingRow's import still resolves.
jest.mock("@/components/dividend/ClaimButton", () => ({
  ClaimButton: () => <button>Claim</button>,
}));

// next/link renders an <a> in test env, no mock needed

const BASE_HOLDING: Holding = {
  asset: {
    id: 1n,
    tokenContract: "CABC",
    issuer: "GABC",
    name: "Harbor View Apartments",
    assetType: "real_estate",
    valuation: 25_000_000n, // $250,000 in cents
    createdAt: 1,
    active: true,
  },
  metadata: {
    name: "Harbor View Apartments",
    symbol: "HVA",
    assetType: "real_estate",
    totalSupply: 1_000_000n, // 10,000 tokens (decimals=2)
    decimals: 2,
    admin: "GABC",
    complianceContract: "CCABC",
    assetDescription: "Tokenized apartments",
    valuation: 25_000_000n,
    paused: false,
  },
  balance: 100_00n, // 100.00 tokens
  claimableDistributions: [],
  totalClaimable: [],
};

describe("HoldingRow", () => {
  describe("asset link", () => {
    it("renders the asset name as a link to the asset detail page", () => {
      render(<HoldingRow holding={BASE_HOLDING} />);

      const link = screen.getByRole("link", { name: "Harbor View Apartments" });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute("href", "/asset/1");
    });
  });

  describe("balance formatting", () => {
    it("formats the token balance using the metadata decimals", () => {
      render(<HoldingRow holding={BASE_HOLDING} />);

      // 10000n @ decimals=2 -> "100"
      expect(screen.getByText("100")).toBeInTheDocument();
    });

    it("shows the share of total supply as a percentage", () => {
      render(<HoldingRow holding={BASE_HOLDING} />);

      // 10000n / 1_000_000n * 100 = 1.00%
      expect(screen.getByText(/1\.00%\s*of supply/)).toBeInTheDocument();
    });
  });

  describe("estimated value", () => {
    it("displays the estimated USD value proportional to balance", () => {
      render(<HoldingRow holding={BASE_HOLDING} />);

      // valuation=25_000_000 cents, balance=10000, totalSupply=1_000_000
      // estimatedValue = 25_000_000 * 10_000 / 1_000_000 = 250_000 cents = $2,500
      expect(screen.getByText("$2,500")).toBeInTheDocument();
    });

    it("shows $0 estimated value when total supply is zero", () => {
      const holding: Holding = {
        ...BASE_HOLDING,
        metadata: { ...BASE_HOLDING.metadata, totalSupply: 0n },
      };
      render(<HoldingRow holding={holding} />);

      expect(screen.getByText("$0")).toBeInTheDocument();
    });
  });

  describe("claimable dividends", () => {
    it("does not show a claimable section when totalClaimable is zero", () => {
      render(<HoldingRow holding={BASE_HOLDING} />);

      expect(screen.queryByText(/claimable/i)).not.toBeInTheDocument();
    });

    it("shows claimable amounts formatted with their payment token decimals", () => {
      // 1_000_000_0n @ decimals=7 -> "1" XLM-unit
      const holding: Holding = {
        ...BASE_HOLDING,
        totalClaimable: [{ paymentToken: "CPAYMENT", decimals: 7, amount: 1_000_000_0n }],
      };
      render(<HoldingRow holding={holding} />);

      expect(screen.getByText("1 CPAYMENT")).toBeInTheDocument();
    });
  });

  describe("distributions panel", () => {
    it("does not render a toggle button when there are no distributions", () => {
      render(<HoldingRow holding={BASE_HOLDING} />);

      expect(
        screen.queryByRole("button", { name: /distributions/i }),
      ).not.toBeInTheDocument();
    });

    it("renders a toggle button when distributions exist", () => {
      const holding: Holding = {
        ...BASE_HOLDING,
        claimableDistributions: [
          {
            id: 1n,
            assetToken: "CABC",
            paymentToken: "CPAYMENT",
            totalAmount: 1000n,
            distributed: 0n,
            paymentTokenDecimals: 2,
            createdAt: 100,
            completed: false,
            claimable: 500n,
            claimed: false,
          },
        ],
      };
      render(<HoldingRow holding={holding} />);

      expect(
        screen.getByRole("button", { name: /show distributions/i }),
      ).toBeInTheDocument();
    });

    it("expands to show DistributionCard entries on click", () => {
      const holding: Holding = {
        ...BASE_HOLDING,
        claimableDistributions: [
          {
            id: 42n,
            assetToken: "CABC",
            paymentToken: "CPAYMENT",
            totalAmount: 1000n,
            distributed: 0n,
            paymentTokenDecimals: 2,
            createdAt: 100,
            completed: false,
            claimable: 500n,
            claimed: false,
          },
        ],
      };
      render(<HoldingRow holding={holding} />);

      const toggleBtn = screen.getByRole("button", {
        name: /show distributions/i,
      });
      expect(toggleBtn).toHaveAttribute("aria-expanded", "false");

      fireEvent.click(toggleBtn);

      expect(
        screen.getByRole("button", { name: /collapse distributions/i }),
      ).toHaveAttribute("aria-expanded", "true");
      expect(screen.getByText("Distribution 42")).toBeInTheDocument();
    });

    it("collapses the distributions panel on second click", () => {
      const holding: Holding = {
        ...BASE_HOLDING,
        claimableDistributions: [
          {
            id: 7n,
            assetToken: "CABC",
            paymentToken: "CPAYMENT",
            totalAmount: 1000n,
            distributed: 0n,
            paymentTokenDecimals: 2,
            createdAt: 100,
            completed: false,
            claimable: 0n,
            claimed: true,
          },
        ],
      };
      render(<HoldingRow holding={holding} />);

      const toggleBtn = screen.getByRole("button", {
        name: /show distributions/i,
      });
      fireEvent.click(toggleBtn);
      expect(screen.getByText("Distribution 7")).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: /collapse distributions/i }));
      expect(screen.queryByText("Distribution 7")).not.toBeInTheDocument();
    });
  });

  describe("inactive asset", () => {
    it("shows an Inactive label when the asset is not active", () => {
      const holding: Holding = {
        ...BASE_HOLDING,
        asset: { ...BASE_HOLDING.asset, active: false },
      };
      render(<HoldingRow holding={holding} />);

      expect(screen.getByText("Inactive")).toBeInTheDocument();
    });

    it("does not show an Inactive label for active assets", () => {
      render(<HoldingRow holding={BASE_HOLDING} />);

      expect(screen.queryByText("Inactive")).not.toBeInTheDocument();
    });
  });
});
