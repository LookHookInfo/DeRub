export function formatAmount(
  amount: string | number | bigint,
  decimals: number = 6
): string {
  let amountStr: string;
  if (typeof amount === 'number' || typeof amount === 'bigint') {
    amountStr = amount.toString();
  } else {
    amountStr = amount;
  }

  const [integer, fractional] = amountStr.split('.');
  if (!fractional || fractional.length <= decimals) {
    return amountStr;
  }
  return `${integer}.${fractional.substring(0, decimals)}`;
}
