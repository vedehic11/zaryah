// API endpoint to calculate shipping rates dynamically
import { NextResponse } from 'next/server'
import { calculateShippingRates, getCheapestShippingRate, getCheapestShippingRateDetails } from '@/lib/shiprocket'
import { supabase } from '@/lib/supabase'
import { normalizeWeightToKg } from '@/lib/weight'

// POST /api/shipping/calculate-rate - Calculate delivery charges
export async function POST(request) {
  try {
    const body = await request.json()
    const includeDebug = process.env.NODE_ENV !== 'production' ||
      request.headers.get('x-shiprocket-debug') === '1' ||
      body?.debug === true
    const { 
      deliveryPincode, 
      cartItems = [],
      codAmount = 0,
      twoWayDelivery = false,
      returnAllOptions = false 
    } = body

    // Validate delivery pincode
    if (!deliveryPincode || deliveryPincode.length !== 6) {
      return NextResponse.json({ 
        error: 'Invalid delivery pincode' 
      }, { status: 400 })
    }

    // Calculate total weight from cart items
    let totalWeight = 0
    const sellerPincodes = new Set()

    for (const item of cartItems) {
      const itemWeightKg = normalizeWeightToKg(item.weight, 0.7)
      totalWeight += itemWeightKg * (item.quantity || 1)

      // Get seller pincode for this product
      if (item.seller_id) {
        const { data: seller } = await supabase
          .from('users')
          .select('pincode, city, state, address')
          .eq('id', item.seller_id)
          .single()

        if (seller?.pincode) {
          sellerPincodes.add(seller.pincode)
        }
      }
    }

    // Default to 0.7 kg if no weight specified
    if (totalWeight === 0) {
      totalWeight = 0.7
    }

    // If multiple sellers, use first seller's pincode
    // In production, you might want to split shipments per seller
    const pickupPincode = sellerPincodes.size > 0 
      ? Array.from(sellerPincodes)[0] 
      : '400001' // Default Mumbai pincode

    if (sellerPincodes.size > 1) {
      console.warn('Multiple sellers in cart - using first seller pincode:', pickupPincode)
    }

    // Get shipping rates from Shiprocket
    if (returnAllOptions) {
      // Return all available courier options
      const couriers = await calculateShippingRates({
        pickupPincode,
        deliveryPincode,
        weight: totalWeight,
        codAmount
      })

      return NextResponse.json({
        success: true,
        pickupPincode,
        deliveryPincode,
        weight: totalWeight,
        couriers,
        cheapest: couriers[0]?.total_charge || 50
      })
    } else {
      // Return only cheapest option
      const outboundDetails = await getCheapestShippingRateDetails({
        pickupPincode,
        deliveryPincode,
        weight: totalWeight,
        codAmount
      })
      const outboundCharge = outboundDetails.deliveryCharge

      if (!twoWayDelivery) {
        return NextResponse.json({
          success: true,
          deliveryCharge: outboundCharge,
          weight: totalWeight,
          pickupPincode,
          deliveryPincode,
          ...(includeDebug
            ? {
                debug: {
                  baseRate: outboundDetails.baseRate,
                  markup: outboundDetails.markup,
                  buffer: outboundDetails.buffer,
                  fallback: outboundDetails.fallback
                    courier: outboundDetails.courier || null,
                    env: {
                      SHIPROCKET_RATE_MARKUP: process.env.SHIPROCKET_RATE_MARKUP || null,
                      SHIPROCKET_BUFFER_PERCENT: process.env.SHIPROCKET_BUFFER_PERCENT || null,
                      SHIPROCKET_BUFFER_FLAT: process.env.SHIPROCKET_BUFFER_FLAT || null
                    }
                }
              }
            : {})
        })
      }

      const inboundDetails = await getCheapestShippingRateDetails({
        pickupPincode: deliveryPincode,
        deliveryPincode: pickupPincode,
        weight: totalWeight,
        codAmount: 0
      })
      const inboundCharge = inboundDetails.deliveryCharge

      return NextResponse.json({
        success: true,
        deliveryCharge: outboundCharge + inboundCharge,
        outboundCharge,
        inboundCharge,
        weight: totalWeight,
        pickupPincode,
        deliveryPincode,
        ...(includeDebug
          ? {
              debug: {
                outbound: {
                  baseRate: outboundDetails.baseRate,
                  markup: outboundDetails.markup,
                  buffer: outboundDetails.buffer,
                  fallback: outboundDetails.fallback
                },
                inbound: {
                  baseRate: inboundDetails.baseRate,
                  markup: inboundDetails.markup,
                  buffer: inboundDetails.buffer,
                  fallback: inboundDetails.fallback
                }
              }
            }
          : {})
      })
    }

  } catch (error) {
    console.error('Error calculating shipping rate:', error)

    const baseFallback = 50
    const fallbackCharge = twoWayDelivery ? baseFallback * 2 : baseFallback

    // Return fallback rate on error
    return NextResponse.json({
      success: true,
      deliveryCharge: fallbackCharge,
      outboundCharge: twoWayDelivery ? baseFallback : undefined,
      inboundCharge: twoWayDelivery ? baseFallback : undefined,
      error: error.message,
      fallback: true
    })
  }
}
