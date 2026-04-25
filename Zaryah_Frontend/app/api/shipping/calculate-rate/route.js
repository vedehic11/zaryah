// API endpoint to calculate shipping rates dynamically
import { NextResponse } from 'next/server'
import { calculateShippingRates, getCheapestShippingRate } from '@/lib/shiprocket'
import { supabase } from '@/lib/supabase'
import { normalizeWeightToKg } from '@/lib/weight'

// POST /api/shipping/calculate-rate - Calculate delivery charges
export async function POST(request) {
  try {
    const body = await request.json()
    const { 
      deliveryPincode, 
      cartItems = [],
      codAmount = 0,
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
      const itemWeightKg = normalizeWeightToKg(item.weight, 0.5)
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

    // Default to 0.5 kg if no weight specified
    if (totalWeight === 0) {
      totalWeight = 0.5
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
      const deliveryCharge = await getCheapestShippingRate({
        pickupPincode,
        deliveryPincode,
        weight: totalWeight,
        codAmount
      })

      return NextResponse.json({
        success: true,
        deliveryCharge,
        weight: totalWeight,
        pickupPincode,
        deliveryPincode
      })
    }

  } catch (error) {
    console.error('Error calculating shipping rate:', error)
    
    // Return fallback rate on error
    return NextResponse.json({
      success: true,
      deliveryCharge: 50, // Fallback standard rate
      error: error.message,
      fallback: true
    })
  }
}
