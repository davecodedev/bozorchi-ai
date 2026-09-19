/**
 * Platform commission on an accepted deal, split 50/50 between buyer and seller.
 *
 * Bracket rates apply to the WHOLE order value based on the bracket it falls in — deliberately
 * not marginal/progressive. Known simplification, chosen so the number is checkable by hand.
 */
export const COMMISSION_BRACKETS: { upTo: number; rate: number }[] = [
  { upTo: 1_000_000, rate: 0.01 },
  { upTo: 10_000_000, rate: 0.03 },
  { upTo: Infinity, rate: 0.05 },
];

export interface Commission {
  rate: number;
  totalCommission: number;
  buyerShare: number;
  sellerShare: number;
}

export function commissionRate(totalValue: number): number {
  for (const b of COMMISSION_BRACKETS) if (totalValue < b.upTo) return b.rate;
  return COMMISSION_BRACKETS[COMMISSION_BRACKETS.length - 1].rate;
}

export function calculateCommission(totalValue: number): Commission {
  if (!Number.isFinite(totalValue) || totalValue < 0) throw new Error("totalValue must be a non-negative number");
  const rate = commissionRate(totalValue);
  const totalCommission = Math.round(totalValue * rate);
  const buyerShare = Math.round(totalCommission / 2);
  return { rate, totalCommission, buyerShare, sellerShare: totalCommission - buyerShare };
}
