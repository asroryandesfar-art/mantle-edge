import { Contract, formatUnits, parseUnits, type Provider, type Signer } from "ethers";

export const ERC20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address owner) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "event Approval(address indexed owner, address indexed spender, uint256 value)",
] as const;

/** Thin convenience wrapper around an ERC-20 token contract. */
export class Erc20 {
  readonly contract: Contract;
  readonly address: string;

  constructor(address: string, runner: Provider | Signer) {
    this.address = address;
    this.contract = new Contract(address, ERC20_ABI, runner);
  }

  async balanceOf(owner: string): Promise<bigint> {
    return (await this.contract.balanceOf(owner)) as bigint;
  }

  async decimals(): Promise<number> {
    return Number(await this.contract.decimals());
  }

  async symbol(): Promise<string> {
    return (await this.contract.symbol()) as string;
  }

  async allowance(owner: string, spender: string): Promise<bigint> {
    return (await this.contract.allowance(owner, spender)) as bigint;
  }

  /** Sends an `approve` transaction if `spender`'s current allowance is below `amount`. */
  async ensureAllowance(owner: string, spender: string, amount: bigint): Promise<void> {
    const current = await this.allowance(owner, spender);
    if (current >= amount) return;

    const tx = await this.contract.approve(spender, amount);
    await tx.wait();
  }

  static formatUnits(value: bigint, decimals: number): string {
    return formatUnits(value, decimals);
  }

  static parseUnits(value: string, decimals: number): bigint {
    return parseUnits(value, decimals);
  }
}
