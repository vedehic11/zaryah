// Utility endpoint to update payment_status for existing orders
import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request) {
  try {
    // Update all existing orders to set payment_status based on payment_method
    // COD orders: payment_status = 'pending' (will be paid on delivery)
    // Online orders without payment_status or with null: payment_status = 'pending' (unpaid)
    
    console.log('Updating existing orders payment status...')
    
    // Get all orders
    const { data: orders, error: fetchError } = await supabase
      .from('orders')
      .select('id, payment_method, payment_status, razorpay_payment_id')
    
    if (fetchError) {
      console.error('Error fetching orders:', fetchError)
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }
    
    console.log(`Found ${orders.length} orders to check`)
    
    let updated = 0
    let alreadySet = 0
    let skipped = 0
    
    for (const order of orders) {
      let newStatus = null
      let shouldUpdate = false
      
      // Determine correct payment_status
      if (order.payment_method === 'online' && order.razorpay_payment_id) {
        // Online order with payment ID = paid
        newStatus = 'paid'
        shouldUpdate = order.payment_status !== 'paid'
      } else if (order.payment_method === 'online' && !order.razorpay_payment_id) {
        // Online order without payment ID = payment failed/unpaid
        newStatus = 'pending'
        shouldUpdate = order.payment_status !== 'pending' || !order.payment_status
      } else {
        // COD orders = pending (will be paid on delivery)
        newStatus = 'pending'
        shouldUpdate = order.payment_status !== 'pending' || !order.payment_status
      }
      
      if (!shouldUpdate) {
        alreadySet++
        continue
      }
      
      const { error: updateError } = await supabase
        .from('orders')
        .update({ payment_status: newStatus })
        .eq('id', order.id)
      
      if (updateError) {
        console.error(`Error updating order ${order.id}:`, updateError)
        skipped++
      } else {
        updated++
        console.log(`Updated order ${order.id}: ${order.payment_method} -> payment_status = ${newStatus}`)
      }
    }
    
    console.log(`Update complete: ${updated} updated, ${alreadySet} already correct, ${skipped} skipped`)
    
    return NextResponse.json({
      success: true,
      message: 'Payment status updated for existing orders',
      updated,
      alreadySet,
      skipped,
      total: orders.length
    })
    
  } catch (error) {
    console.error('Error updating payment status:', error)
    return NextResponse.json({ 
      error: 'Failed to update payment status',
      details: error.message 
    }, { status: 500 })
  }
}
