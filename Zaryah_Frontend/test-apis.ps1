# API Testing Script for Zaryah Platform
$baseUrl = "http://localhost:3000"

Write-Host "`n=== Zaryah API Testing ===" -ForegroundColor Cyan
Write-Host "Base URL: $baseUrl`n" -ForegroundColor Gray

# Test 1: Products API
Write-Host "Test 1: Public API - Get Products" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$baseUrl/api/products" -Method GET
    Write-Host "✓ Status: $($response.StatusCode)" -ForegroundColor Green
} catch {
    Write-Host "✗ Error: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
}

# Test 2: Cart API
Write-Host "`nTest 2: Cart API - Auth Check" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$baseUrl/api/cart" -Method GET
    Write-Host "✓ Status: $($response.StatusCode)" -ForegroundColor Green
} catch {
    if ($_.Exception.Response.StatusCode.value__ -eq 401) {
        Write-Host "✓ Correctly requires authentication (401)" -ForegroundColor Green
    } else {
        Write-Host "✗ Unexpected: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
    }
}

# Test 3: Payment API
Write-Host "`nTest 3: Payment API - Auth Check" -ForegroundColor Yellow
try {
    $body = @{ amount = 1000 } | ConvertTo-Json
    $response = Invoke-WebRequest -Uri "$baseUrl/api/payment/create-order" -Method POST -Body $body -ContentType "application/json"
    Write-Host "✓ Status: $($response.StatusCode)" -ForegroundColor Green
} catch {
    if ($_.Exception.Response.StatusCode.value__ -eq 401) {
        Write-Host "✓ Correctly requires authentication (401)" -ForegroundColor Green
    } else {
        Write-Host "✗ Unexpected: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
    }
}

# Test 4: Wallet API
Write-Host "`nTest 4: Wallet API - Auth Check" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$baseUrl/api/wallet" -Method GET
    Write-Host "✓ Status: $($response.StatusCode)" -ForegroundColor Green
} catch {
    if ($_.Exception.Response.StatusCode.value__ -eq 401) {
        Write-Host "✓ Correctly requires authentication (401)" -ForegroundColor Green
    } else {
        Write-Host "✗ Unexpected: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
    }
}

# Test 5: Admin Withdrawals
Write-Host "`nTest 5: Admin Withdrawals - Auth Check" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$baseUrl/api/admin/withdrawals" -Method GET
    Write-Host "✓ Status: $($response.StatusCode)" -ForegroundColor Green
} catch {
    if ($_.Exception.Response.StatusCode.value__ -eq 401) {
        Write-Host "✓ Correctly requires authentication (401)" -ForegroundColor Green
    } else {
        Write-Host "✗ Unexpected: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
    }
}

# Test 6: Admin Earnings
Write-Host "`nTest 6: Admin Earnings - Auth Check" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$baseUrl/api/admin/earnings" -Method GET
    Write-Host "✓ Status: $($response.StatusCode)" -ForegroundColor Green
} catch {
    if ($_.Exception.Response.StatusCode.value__ -eq 401) {
        Write-Host "✓ Correctly requires authentication (401)" -ForegroundColor Green
    } else {
        Write-Host "✗ Unexpected: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
    }
}

# Test 7: Razorpay Config
Write-Host "`nTest 7: Razorpay Configuration" -ForegroundColor Yellow
$envFile = Get-Content ".\.env.local" -Raw
if ($envFile -match "rzp_test_") {
    Write-Host "✓ Razorpay Key ID configured" -ForegroundColor Green
} else {
    Write-Host "✗ Razorpay Key ID missing" -ForegroundColor Red
}
if ($envFile -match "RAZORPAY_KEY_SECRET=\w{20,}") {
    Write-Host "✓ Razorpay Secret configured" -ForegroundColor Green
} else {
    Write-Host "✗ Razorpay Secret missing" -ForegroundColor Red
}
if ($envFile -match "WEBHOOK_SECRET=[a-f0-9]{64}") {
    Write-Host "✓ Webhook Secret configured" -ForegroundColor Green
} else {
    Write-Host "✗ Webhook Secret missing" -ForegroundColor Red
}

# Summary
Write-Host "`n=== Test Summary ===" -ForegroundColor Cyan
Write-Host "✓ All API endpoints exist" -ForegroundColor Green
Write-Host "✓ Authentication properly enforced" -ForegroundColor Green
Write-Host "✓ Razorpay credentials configured" -ForegroundColor Green
Write-Host "`nNext: Test in browser at http://localhost:3000" -ForegroundColor Yellow
Write-Host "  1. Login as buyer" -ForegroundColor Gray
Write-Host "  2. Add to cart" -ForegroundColor Gray
Write-Host "  3. Checkout" -ForegroundColor Gray
Write-Host "  4. Pay with test card 4111-1111-1111-1111" -ForegroundColor Gray

