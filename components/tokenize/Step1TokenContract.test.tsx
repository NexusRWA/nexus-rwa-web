/**
 * Tests for components/tokenize/Step1TokenContract.tsx
 *
 * useWallet and the contract read behind validateTokenContract are mocked, so
 * no wallet or Soroban RPC is involved. validateTokenContract itself runs for
 * real, so the error text shown is exactly what it throws.
 */

import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { AssetMetadata } from "@/types";

jest.mock("@/hooks/useWallet", () => ({
  useWallet: () => ({ network: "testnet" }),
}));

jest.mock("@/lib/contracts", () => ({
  assetToken: { getMetadata: jest.fn() },
  registry: {},
}));

import { assetToken } from "@/lib/contracts";
import { Step1TokenContract } from "./Step1TokenContract";

const getMetadata = assetToken.getMetadata as jest.Mock;

const VALID_CONTRACT = "CBX5SMLTXX6JP4HA5GQIO2V6QM7WCUGL2GZ6D4U773HMRI6RXISKPUR3";

const METADATA: AssetMetadata = {
  name: "Manhattan Office",
  symbol: "MOFF",
  assetType: "RealEstate",
  totalSupply: 1000n,
  decimals: 7,
  admin: "GAIQGTOBTTLLDJ4SWGGESM7UWJ2DI4K3ZNHUSHPDKJL2IE5FKY3BSRAA",
  complianceContract: "CBUERYDM7DXTZLLKDBRJKUBPFJ7M4OSUN4T7XKUARU345RLXNAIQD2IU",
  assetDescription: "",
  valuation: 100n,
  paused: false,
};

async function submit(address: string) {
  fireEvent.change(screen.getByLabelText("Contract address"), { target: { value: address } });
  const button = screen.getByRole("button", { name: /verify & continue/i });
  // act() flushes the async validation and its state updates before asserting.
  await act(async () => {
    fireEvent.click(button);
  });
}

beforeEach(() => getMetadata.mockReset());

describe("Step1TokenContract", () => {
  it("calls onValidated with the validated token for a valid contract", async () => {
    getMetadata.mockResolvedValue(METADATA);
    const onValidated = jest.fn();
    render(<Step1TokenContract onValidated={onValidated} />);

    await submit(`  ${VALID_CONTRACT}  `);

    await waitFor(() =>
      expect(onValidated).toHaveBeenCalledWith({
        tokenContract: VALID_CONTRACT,
        metadata: METADATA,
      }),
    );
    expect(getMetadata).toHaveBeenCalledWith("testnet", VALID_CONTRACT);
    expect(screen.queryByText(/valid soroban contract address/i)).not.toBeInTheDocument();
  });

  it("shows an error and skips validation for a malformed address", async () => {
    const onValidated = jest.fn();
    render(<Step1TokenContract onValidated={onValidated} />);

    await submit("not-a-contract");

    expect(
      screen.getByText("Enter a valid Soroban contract address (starts with C)."),
    ).toBeInTheDocument();
    expect(getMetadata).not.toHaveBeenCalled();
    expect(onValidated).not.toHaveBeenCalled();
  });

  it("shows the validateTokenContract error when the contract can't be read", async () => {
    getMetadata.mockRejectedValue(new Error("rpc down"));
    const onValidated = jest.fn();
    render(<Step1TokenContract onValidated={onValidated} />);

    await submit(VALID_CONTRACT);

    expect(
      await screen.findByText(
        "Could not read the token contract. Make sure the address is correct and the contract is deployed on this network.",
      ),
    ).toBeInTheDocument();
    expect(onValidated).not.toHaveBeenCalled();
  });

  it("shows the validateTokenContract error when metadata lacks name or symbol", async () => {
    getMetadata.mockResolvedValue({ ...METADATA, symbol: "" });
    const onValidated = jest.fn();
    render(<Step1TokenContract onValidated={onValidated} />);

    await submit(VALID_CONTRACT);

    expect(
      await screen.findByText(
        "The contract responded but doesn't look like a valid asset-token (missing name or symbol).",
      ),
    ).toBeInTheDocument();
    expect(onValidated).not.toHaveBeenCalled();
  });
});
