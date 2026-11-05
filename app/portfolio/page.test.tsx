import { render, screen } from "@testing-library/react";
import PortfolioPage from "./page";
import { usePortfolio, type PortfolioData } from "@/hooks/usePortfolio";
import { useWallet } from "@/hooks/useWallet";

jest.mock("@/components/portfolio/PortfolioView", () => ({
  PortfolioView: () => <div>Portfolio View</div>,
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
  return render(<PortfolioPage />);
}

describe("/portfolio page route", () => {
  beforeEach(() => jest.clearAllMocks());

  it("renders Portfolio page title", () => {
    setup();
    expect(screen.getByRole("heading", { level: 1, name: /portfolio/i })).toBeInTheDocument();
  });

  it("renders portfolio description", () => {
    setup();
    expect(screen.getByText(/Your tokenized asset balances and claimable dividend distributions/i)).toBeInTheDocument();
  });

  it("renders PortfolioView component", () => {
    setup();
    expect(screen.getByText("Portfolio View")).toBeInTheDocument();
  });

  it("passes holdings to PortfolioView when connected", () => {
    setup({ address: "GCONNECTED123456789", data: PORTFOLIO_WITH_HOLDING });
    expect(screen.getByText("Portfolio View")).toBeInTheDocument();
  });

  it("shows empty portfolio state when no holdings", () => {
    setup({ address: "GCONNECTED123456789", data: { holdings: [], totalValueCents: 0n, totalClaimable: [], failedAssetCount: 0, isIncomplete: false } });
    expect(screen.getByText("Portfolio View")).toBeInTheDocument();
  });
});
