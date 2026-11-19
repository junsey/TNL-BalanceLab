/** Numerical regularized upper incomplete gamma, used only by the audit. */
function logGamma(z: number): number {
  const c = [
    676.5203681218851, -1259.1392167224028, 771.3234287776531,
    -176.6150291621406, 12.507343278686905, -0.13857109526572012,
    9.984369578019572e-6, 1.5056327351493116e-7,
  ];
  if (z < 0.5)
    return (
      Math.log(Math.PI) - Math.log(Math.sin(Math.PI * z)) - logGamma(1 - z)
    );
  z -= 1;
  let x = 0.99999999999980993;
  for (let i = 0; i < c.length; i++) x += c[i]! / (z + i + 1);
  const t = z + 7.5;
  return (
    0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x)
  );
}
export function gammaQ(a: number, x: number) {
  if (!(a > 0) || x < 0 || !Number.isFinite(a) || !Number.isFinite(x))
    throw new RangeError("Gamma fuera de rango");
  if (x === 0) return 1;
  const factor = Math.exp(a * Math.log(x) - x - logGamma(a));
  if (x < a + 1) {
    let term = 1 / a,
      sum = term;
    for (let i = 1; i <= 100000; i++) {
      term *= x / (a + i);
      sum += term;
      if (Math.abs(term) <= Math.abs(sum) * 1e-14)
        return Math.max(0, Math.min(1, 1 - factor * sum));
    }
  } else {
    const tiny = 1e-300;
    let b = x + 1 - a,
      c = 1 / tiny,
      d = 1 / b,
      h = d;
    for (let i = 1; i <= 100000; i++) {
      const an = -i * (i - a);
      b += 2;
      d = an * d + b;
      if (Math.abs(d) < tiny) d = tiny;
      c = b + an / c;
      if (Math.abs(c) < tiny) c = tiny;
      d = 1 / d;
      const delta = d * c;
      h *= delta;
      if (Math.abs(delta - 1) < 1e-14)
        return Math.max(0, Math.min(1, factor * h));
    }
  }
  throw new Error("Gamma no convergió");
}
export function chiSquareTail(statistic: number, degrees: number) {
  return gammaQ(degrees / 2, statistic / 2);
}
export function chiSquareCritical(degrees: number, alpha: number) {
  if (degrees < 1 || !(alpha > 0 && alpha < 1))
    throw new RangeError("Contraste inválido");
  let lower = 0,
    upper = degrees + 20 * Math.sqrt(2 * degrees) + 100;
  while (chiSquareTail(upper, degrees) > alpha) upper *= 2;
  for (let i = 0; i < 70; i++) {
    const middle = (lower + upper) / 2;
    if (chiSquareTail(middle, degrees) > alpha) lower = middle;
    else upper = middle;
  }
  return (lower + upper) / 2;
}
