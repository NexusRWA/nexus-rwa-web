import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { TokenizeWizard } from "./TokenizeWizard";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Wallet hook — default to connected; individual tests can override
const mockUseWallet = jest.fn();
jest.mock("@/hooks/useWallet", () => ({
  useWallet: () => mockUseWallet(),
}));

// ConnectButton — renders a simple stub so wallet-gate tests stay simple
jest.mock("@/components/wallet/ConnectButton", () => ({
  ConnectButton: () => <button>Connect Wallet</button>,
}));

// StepIndicator — lightweight stub (not under test here)
jest.mock("./StepIndicator", () => ({
  StepIndicator: ({ current }: { current: number }) => (
    <nav aria-label="Wizard progress">
      <span data-testid="current-step">{current}</span>
    </nav>
  ),
}));

// validateTokenContract — mock the async validation
const mockValidateTokenContract = jest.fn();
jest.mock("@/lib/tokenizeFlow", () => ({
  validateTokenContract: (...args: unknown[]) => mockValidateTokenContract(...args),
}));

// Step1TokenContract — calls onValidated when "Verify" is clicked
jest.mock("./Step1TokenContract", () => ({
  Step1TokenContract: ({ onValidated }: { onValidated: (r: unknown) => void }) => (
    <div>
      <h2>Step 1</h2>
      <button
        onClick={() =>
          onValidated({
            tokenContract: "CTEST123",
            metadata: {
              name: "Test Token",
              symbol: "TST",
              assetType: "real_estate",
              totalSupply: 1000000n,
              decimals: 7,
              admin: "GADMIN",
              complianceContract: "CCOMP",
              assetDescription: "",
              valuation: 100000n,
              paused: false,
            },
          })
        }
      >
        Verify &amp; continue
      </button>
    </div>
  ),
}));

// Step2AssetDetails — calls onNext / onBack
jest.mock("./Step2AssetDetails", () => ({
  Step2AssetDetails: ({
    onBack,
    onNext,
  }: {
    onBack: () => void;
    onNext: (d: unknown) => void;
  }) => (
    <div>
      <h2>Step 2</h2>
      <button onClick={onBack}>← Back</button>
      <button
        onClick={() =>
          onNext({
            name: "Lagos Tower",
            assetType: "real_estate",
            valuation: 100000000n, // $1,000,000 in cents
          })
        }
      >
        Review →
      </button>
    </div>
  ),
}));

// Step3Confirm — calls onRegistered
jest.mock("./Step3Confirm", () => ({
  Step3Confirm: ({
    onBack,
    onRegistered,
  }: {
    onBack: () => void;
    onRegistered: (id: bigint | null, hash: string) => void;
  }) => (
    <div>
      <h2>Step 3</h2>
      <button onClick={onBack}>← Back</button>
      <button onClick={() => onRegistered(42n, "txhash123")}>
        Register asset on-chain
      </button>
    </div>
  ),
}));

// Step4Done — final success screen
jest.mock("./Step4Done", () => ({
  Step4Done: ({ name }: { name: string }) => (
    <div>
      <h2>Asset registered</h2>
      <p>{name}</p>
    </div>
  ),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const connectedWallet = () => ({
  address: "GTEST123",
  network: "testnet" as const,
});

const disconnectedWallet = () => ({
  address: null,
  network: "testnet" as const,
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockUseWallet.mockReturnValue(connectedWallet());
  mockValidateTokenContract.mockResolvedValue({
    tokenContract: "CTEST123",
    metadata: { name: "Test Token", symbol: "TST" },
  });
});

afterEach(() => {
  jest.clearAllMocks();
});

describe("TokenizeWizard — wallet gate", () => {
  it("shows a connect-wallet prompt when no address is connected", () => {
    mockUseWallet.mockReturnValue(disconnectedWallet());
    render(<TokenizeWizard />);
    expect(
      screen.getByRole("heading", { name: /connect your wallet/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /connect wallet/i })).toBeInTheDocument();
  });

  it("does not show the step indicator when disconnected", () => {
    mockUseWallet.mockReturnValue(disconnectedWallet());
    render(<TokenizeWizard />);
    expect(screen.queryByLabelText("Wizard progress")).not.toBeInTheDocument();
  });

  it("shows step 1 when a wallet is connected", () => {
    render(<TokenizeWizard />);
    expect(screen.getByRole("heading", { name: /step 1/i })).toBeInTheDocument();
  });
});

describe("TokenizeWizard — step navigation", () => {
  it("advances from step 1 to step 2 after validation", async () => {
    render(<TokenizeWizard />);

    fireEvent.click(screen.getByRole("button", { name: /verify & continue/i }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /step 2/i })).toBeInTheDocument();
    });
    expect(screen.queryByRole("heading", { name: /step 1/i })).not.toBeInTheDocument();
  });

  it("advances from step 2 to step 3", async () => {
    render(<TokenizeWizard />);

    // Step 1 → Step 2
    fireEvent.click(screen.getByRole("button", { name: /verify & continue/i }));
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /step 2/i })).toBeInTheDocument(),
    );

    // Step 2 → Step 3
    fireEvent.click(screen.getByRole("button", { name: /review/i }));
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /step 3/i })).toBeInTheDocument(),
    );
  });

  it("advances from step 3 to step 4 (done) after registration", async () => {
    render(<TokenizeWizard />);

    fireEvent.click(screen.getByRole("button", { name: /verify & continue/i }));
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /step 2/i })).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole("button", { name: /review/i }));
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /step 3/i })).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole("button", { name: /register asset on-chain/i }));
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /asset registered/i })).toBeInTheDocument(),
    );
  });
});

describe("TokenizeWizard — back navigation", () => {
  it("goes back from step 2 to step 1", async () => {
    render(<TokenizeWizard />);

    // Advance to step 2
    fireEvent.click(screen.getByRole("button", { name: /verify & continue/i }));
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /step 2/i })).toBeInTheDocument(),
    );

    // Go back
    fireEvent.click(screen.getByRole("button", { name: /← back/i }));
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /step 1/i })).toBeInTheDocument(),
    );
  });

  it("preserves form data when navigating back from step 2 and forward again", async () => {
    render(<TokenizeWizard />);

    // Step 1 → Step 2: validated token is stored
    fireEvent.click(screen.getByRole("button", { name: /verify & continue/i }));
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /step 2/i })).toBeInTheDocument(),
    );

    // Step 2 → step 1 (back)
    fireEvent.click(screen.getByRole("button", { name: /← back/i }));
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /step 1/i })).toBeInTheDocument(),
    );

    // Step 1 → Step 2 again: step 2 should still be reachable (validated state persisted)
    fireEvent.click(screen.getByRole("button", { name: /verify & continue/i }));
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /step 2/i })).toBeInTheDocument(),
    );
  });

  it("goes back from step 3 to step 2", async () => {
    render(<TokenizeWizard />);

    fireEvent.click(screen.getByRole("button", { name: /verify & continue/i }));
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /step 2/i })).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole("button", { name: /review/i }));
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /step 3/i })).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole("button", { name: /← back/i }));
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /step 2/i })).toBeInTheDocument(),
    );
  });
});

describe("TokenizeWizard — step indicator", () => {
  it("shows current step 1 initially", () => {
    render(<TokenizeWizard />);
    expect(screen.getByTestId("current-step")).toHaveTextContent("1");
  });

  it("shows current step 2 after advancing past step 1", async () => {
    render(<TokenizeWizard />);
    fireEvent.click(screen.getByRole("button", { name: /verify & continue/i }));
    await waitFor(() =>
      expect(screen.getByTestId("current-step")).toHaveTextContent("2"),
    );
  });
});
