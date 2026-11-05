import { render, screen, fireEvent } from "@testing-library/react";
import type { AssetDetail } from "@/types";
import { useHolders, type Holder } from "@/hooks/useHolders";
import { useWallet } from "@/hooks/useWallet";
import { HolderList } from "./HolderList";

jest.mock("@/hooks/useHolders", () => ({
  useHolders: jest.fn(),
}));

jest.mock("@/hooks/useWallet", () => ({
  useWallet: jest.fn(),
}));

const mockUseHolders = useHolders as jest.MockedFunction<typeof useHolders>;
const mockUseWallet = useWallet as jest.MockedFunction<typeof useWallet>;

const asset = {
  tokenContract: "CTOKEN",
  metadata: {
    complianceContract: "CCOMPLIANCE",
    decimals: 0,
    symbol: "TOKEN",
    totalSupply: 1_000n,
  },
} as AssetDetail;

function setup(holders: Holder[]) {
  mockUseWallet.mockReturnValue({ address: null } as ReturnType<typeof useWallet>);
  mockUseHolders.mockReturnValue({
    data: holders,
    loading: false,
    error: null,
    updatedAt: null,
    refetch: jest.fn(),
  });
}

describe("HolderList", () => {
  afterEach(() => jest.clearAllMocks());

  it("renders holders in descending balance order", () => {
    setup([
      { address: "GHIGHHOLDER123456789ABCDEFGHIJKL", balance: 900n },
      { address: "GLOWWHOLDER123456789ABCDEFGHIJMN", balance: 100n },
    ]);

    render(<HolderList asset={asset} />);

    // useHolders does the sorting; this pins that the table renders rows in
    // the order given, with column headers exposed to assistive tech.
    expect(screen.getAllByRole("columnheader").map((h) => h.textContent)).toEqual([
      "Address",
      "Balance",
      "Share",
    ]);
    const rows = screen.getAllByRole("row").slice(1);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent(/900 TOKEN/);
    expect(rows[1]).toHaveTextContent(/100 TOKEN/);
  });

  it("shows an empty state when there are no holders", () => {
    setup([]);

    render(<HolderList asset={asset} />);

    expect(screen.getByRole("heading", { name: "No holders yet" })).toBeInTheDocument();
    expect(
      screen.getByText(
        "Once the issuer distributes this asset to approved addresses, holders appear here.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("renders an ErrorState with retry when loading holders fails", () => {
    const mockRefetch = jest.fn();
    mockUseWallet.mockReturnValue({ address: null } as ReturnType<typeof useWallet>);
    mockUseHolders.mockReturnValue({
      data: null,
      loading: false,
      error: "RPC unreachable",
      updatedAt: null,
      refetch: mockRefetch,
    });

    render(<HolderList asset={asset} />);

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(/couldn't load holders/i)).toBeInTheDocument();
    const retryBtn = screen.getByRole("button", { name: /try again/i });
    fireEvent.click(retryBtn);
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });
});
