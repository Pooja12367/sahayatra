import { getNepalPhoneVariants, normalizeNepalPhone } from './phone.util';

describe('Nepal phone normalization', () => {
  it.each([
    ['+9779841234567', '+9779841234567'],
    ['9841234567', '+9779841234567'],
    ['09841234567', '+9779841234567'],
    ['9779841234567', '+9779841234567'],
    ['009779841234567', '+9779841234567'],
  ])('normalizes %s to %s', (input, expected) => {
    expect(normalizeNepalPhone(input)).toBe(expected);
  });

  it('returns all supported representations for duplicate lookup', () => {
    expect(getNepalPhoneVariants('+9779841234567')).toEqual(
      expect.arrayContaining([
        '+9779841234567',
        '9841234567',
        '09841234567',
        '9779841234567',
        '009779841234567',
      ]),
    );
  });

  it('does not normalize invalid or repeated-digit phone numbers', () => {
    expect(normalizeNepalPhone('1234567890')).toBeNull();
    expect(normalizeNepalPhone('9999999999')).toBeNull();
  });
});
