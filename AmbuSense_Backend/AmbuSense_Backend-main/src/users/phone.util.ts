export function getNepalPhoneVariants(phone: string): string[] {
  const original = phone.trim();
  const compact = original.replace(/[\s-]+/g, '');
  let digits = compact.replace(/\D/g, '');

  if (compact.startsWith('+977')) {
    digits = compact.slice(4).replace(/\D/g, '');
  } else if (compact.startsWith('977')) {
    digits = compact.slice(3).replace(/\D/g, '');
  }

  if (digits.startsWith('0')) {
    digits = digits.slice(1);
  }

  if (!/^9\d{9}$/.test(digits)) {
    return original ? [original] : [];
  }

  return [...new Set([original, digits, `+977${digits}`, `977${digits}`])];
}

export function areNepalPhoneNumbersEqual(first: string, second: string) {
  const secondVariants = new Set(getNepalPhoneVariants(second));
  return getNepalPhoneVariants(first).some((variant) =>
    secondVariants.has(variant),
  );
}