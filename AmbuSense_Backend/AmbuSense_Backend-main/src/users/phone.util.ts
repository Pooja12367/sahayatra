export function normalizeNepalPhone(phone: string): string | null {
  const compact = phone.trim().replace(/[\s()-]+/g, '');
  if (!compact) {
    return null;
  }

  let digits = compact.replace(/\D/g, '');
  if (compact.startsWith('+977')) {
    digits = compact.slice(4).replace(/\D/g, '');
  } else if (compact.startsWith('00977')) {
    digits = compact.slice(5).replace(/\D/g, '');
  } else if (compact.startsWith('977')) {
    digits = compact.slice(3).replace(/\D/g, '');
  }

  if (digits.startsWith('0')) {
    digits = digits.slice(1);
  }

  if (!/^9\d{9}$/.test(digits) || /^(\d)\1{9}$/.test(digits)) {
    return null;
  }

  return `+977${digits}`;
}

export function getNepalPhoneVariants(phone: string): string[] {
  const original = phone.trim();
  const normalized = normalizeNepalPhone(phone);
  if (!normalized) {
    return original ? [original] : [];
  }

  const digits = normalized.slice(4);
  return [
    ...new Set([
      original,
      digits,
      `0${digits}`,
      normalized,
      `977${digits}`,
      `00977${digits}`,
    ]),
  ];
}

export function areNepalPhoneNumbersEqual(first: string, second: string) {
  const secondVariants = new Set(getNepalPhoneVariants(second));
  return getNepalPhoneVariants(first).some((variant) =>
    secondVariants.has(variant),
  );
}
