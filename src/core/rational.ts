/** Exact positive fractions; pitch is converted to floating point only at I/O. */
export interface Rational {
  readonly n: bigint;
  readonly d: bigint;
}

export function fraction(n: bigint | number, d: bigint | number = 1): Rational {
  let numerator = BigInt(n);
  let denominator = BigInt(d);
  if (numerator <= 0n || denominator <= 0n) throw new RangeError("Use positive fractions.");
  let a = numerator;
  let b = denominator;
  while (b) [a, b] = [b, a % b];
  numerator /= a;
  denominator /= a;
  return { n: numerator, d: denominator };
}

export const ONE = fraction(1);
export const multiply = (a: Rational, b: Rational): Rational => fraction(a.n * b.n, a.d * b.d);
export const divide = (a: Rational, b: Rational): Rational => fraction(a.n * b.d, a.d * b.n);
export const equal = (a: Rational, b: Rational): boolean => a.n * b.d === b.n * a.d;
export const numeric = (a: Rational): number => Number(a.n) / Number(a.d);
export const ratioText = (a: Rational): string => `${a.n}/${a.d}`;
export const cents = (a: Rational): number => 1200 * Math.log2(numeric(a));
