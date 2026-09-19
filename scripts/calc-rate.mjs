import pkg from '../Zaryah_Frontend/lib/shiprocket.js'
const { getCheapestShippingRateDetails } = pkg

async function run() {
  try {
    const weight = 0.02 // 20 g

    console.log('Scenario A: pickup 302017 → delivery 400025')
    const a = await getCheapestShippingRateDetails({ pickupPincode: '302017', deliveryPincode: '400025', weight, codAmount: 0 })
    console.log(JSON.stringify({ scenario: 'A', pickup: '302017', delivery: '400025', weight, result: a }, null, 2))

    console.log('\nScenario B: pickup 400025 → delivery 302017')
    const b = await getCheapestShippingRateDetails({ pickupPincode: '400025', deliveryPincode: '302017', weight, codAmount: 0 })
    console.log(JSON.stringify({ scenario: 'B', pickup: '400025', delivery: '302017', weight, result: b }, null, 2))
  } catch (err) {
    console.error('Error running rate checks:', err)
    process.exit(1)
  }
}

run()
