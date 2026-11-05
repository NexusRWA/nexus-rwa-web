import { render, screen } from "@testing-library/react";
import { PortfolioView } from "./PortfolioView";
import { usePortfolio, type PortfolioData } from "@/hooks/usePortfolio";
import { useWallet } from "@/hooks/useWallet";

jest.mock("@/components/portfolio/PortfolioSummary", () => ({
  PortfolioSummary: () => <div>Portfolio summary</div>,
}));

jest.mock("@/components/portfolio/HoldingRow", () => ({
  HoldingRow: ({ holding }: { holding: PortfolioData["holdings"][number] }) => (
    <a href={`/asset/${holding.asset.id.toString()}`}>{holding.asset.name}</a>
  ),
}));

jest.mock("@/components/dividend/ClaimAllButton", () => ({
  ClaimAllButton: ({ distributions }: { distributions: unknown[] }) =>
    distributions.length >= 2 ? <button>Claim all distributions</button> : null,
}));

jest.mock("@/components/wallet/ConnectButton", () => ({
  ConnectButton: () => <button>Connect Wallet</button>,
}));

jest.mock("@/hooks/useWallet", () => ({
  useWallet: jest.fn(),
}));

jest.mock("@/hooks/usePortfolio", () => ({
  usePortfolio: jest.fn(),
}));

const mockUseWallet = useWallet as jest.MockedFunction<typeof useWallet>;
const mockUsePortfolio = usePortfolio as jest.MockedFunction<typeof usePortfolio>;

const BASE_WALLET: ReturnType<typeof useWallet> = {
  address: null,
  connect: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn(),
  connecting: false,
  installed: true,
  network: "testnet",
  walletNetwork: null,
  networkUnknown: false,
  error: null,
  setNetwork: jest.fn(),
  sign: jest.fn(),
  writeCtx: jest.fn(),
};

const PORTFOLIO_WITH_HOLDING: PortfolioData = {
  holdings: [
    {
      asset: {
        id: 1n,
        tokenContract: "CABC",
        issuer: "GABC",
        name: "Harbor View Apartments",
        assetType: "real_estate",
        valuation: 25000000n,
        createdAt: 1,
        active: true,
      },
      metadata: {
        name: "Harbor View Apartments",
        symbol: "HVA",
        assetType: "real_estate",
        totalSupply: 1000000n,
        decimals: 2,
        admin: "GABC",
        complianceContract: "CCABC",
        assetDescription: "Tokenized apartments",
        valuation: 25000000n,
        paused: false,
      },
      balance: 10000n,
      claimableDistributions: [],
      totalClaimable: [],
    },
  ],
  totalValueCents: 250000n,
  totalClaimable: [],
  failedAssetCount: 0,
  isIncomplete: false,
};

function setup({ address = null, data = PORTFOLIO_WITH_HOLDING }: {
  address?: string | null;
  data?: PortfolioData;
} = {}) {
  mockUseWallet.mockReturnValue({ ...BASE_WALLET, address });
  mockUsePortfolio.mockReturnValue({
    data,
    loading: false,
    error: null,
    updatedAt: null,
    refetch: jest.fn(),
  });
  return render(<PortfolioView />);
}

describe("PortfolioView", () => {
  beforeEach(() => jest.clearAllMocks());

  it("prompts disconnected users to connect their wallet", () => {
    setup({ data: { holdings: [], totalValueCents: 0n, totalClaimable: [], failedAssetCount: 0, isIncomplete: false } });

    expect(
      screen.getByRole("heading", { name: /connect your wallet/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /connect wallet/i }),
    ).toBeInTheDocument();
  });

  it("lists holdings for a connected wallet", () => {
    setup({ address: "GCONNECTED123456789" });

    expect(
      screen.getByRole("heading", { name: /your holdings/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Harbor View Apartments" }),
    ).toBeInTheDocument();
  });

  it("offers one action for multiple claimable distributions", () => {
    const data: PortfolioData = {
      ...PORTFOLIO_WITH_HOLDING,
      holdings: [
        {
          ...PORTFOLIO_WITH_HOLDING.holdings[0]!,
          totalClaimable: [{ paymentToken: "CPAYMENT", decimals: 7, amount: 200n }],
          claimableDistributions: [
            {
              id: 1n,
              assetToken: "CABC",
              paymentToken: "CPAYMENT",
              totalAmount: 100n,
              distributed: 0n,
              createdAt: 1,
              completed: false,
              paymentTokenDecimals: 7,
              claimable: 100n,
              claimed: false,
            },
            {
              id: 2n,
              assetToken: "CABC",
              paymentToken: "CPAYMENT",
              totalAmount: 100n,
              distributed: 0n,
              createdAt: 2,
              completed: false,
              paymentTokenDecimals: 7,
              claimable: 100n,
              claimed: false,
            },
          ],
        },
      ],
      totalClaimable: [{ paymentToken: "CPAYMENT", decimals: 7, amount: 200n }],
    };
    setup({ address: "GCONNECTED123456789", data });

    expect(
      screen.getByRole("button", { name: /claim all distributions/i }),
    ).toBeInTheDocument();
  });
});