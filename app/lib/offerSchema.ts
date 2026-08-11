// Shared schema.org fragments for Offer/AggregateOffer markup — the fields
// Google's Merchant listings report asks for beyond price/availability.
// Values mirror the real policies: /returns (14 days from delivery, buyer
// pays return postage) and checkout shipping (£2.50, free at £10+).

export const FREE_SHIPPING_THRESHOLD_GBP = 10
export const SHIPPING_FLAT_GBP = 2.5

export function offerShippingDetails(priceGbp: number) {
  return {
    '@type': 'OfferShippingDetails',
    shippingRate: {
      '@type': 'MonetaryAmount',
      value: priceGbp >= FREE_SHIPPING_THRESHOLD_GBP ? '0.00' : SHIPPING_FLAT_GBP.toFixed(2),
      currency: 'GBP',
    },
    shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'GB' },
    deliveryTime: {
      '@type': 'ShippingDeliveryTime',
      handlingTime: { '@type': 'QuantitativeValue', minValue: 0, maxValue: 2, unitCode: 'DAY' },
      transitTime: { '@type': 'QuantitativeValue', minValue: 2, maxValue: 3, unitCode: 'DAY' },
    },
  }
}

export const merchantReturnPolicy = {
  '@type': 'MerchantReturnPolicy',
  applicableCountry: 'GB',
  returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
  merchantReturnDays: 14,
  returnMethod: 'https://schema.org/ReturnByMail',
  returnFees: 'https://schema.org/ReturnFeesCustomerResponsibility',
}
