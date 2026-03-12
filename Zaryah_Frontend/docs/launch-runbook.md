# Zaryah Launch Runbook (Vercel + Supabase Free)

## 1) Pre-launch checks

- Confirm build is green: `npm run build`
- Confirm production health endpoint: `GET /api/health`
- Confirm webhook endpoint responds:
  - `GET /api/webhooks/delivery-updates`
  - test ping from Shiprocket dashboard
- Confirm one end-to-end order flow:
  - place order
  - seller confirm
  - shipment created
  - status sync works (`Sync` button in seller order card)

## 2) Required env variables

- Supabase:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
- Shiprocket:
  - `SHIPROCKET_EMAIL`
  - `SHIPROCKET_PASSWORD`
  - `SHIPROCKET_WEBHOOK_SECRET`
- Payments (if enabled):
  - Razorpay public and secret keys

## 3) Monitoring setup (manual)

Because free plans have no advanced autoscaling guarantees, monitor these continuously:

- Vercel Function logs for:
  - `GET /api/orders`
  - `POST /api/webhooks/delivery-updates`
  - `POST /api/orders/[id]/sync-status`
- Supabase logs for:
  - slow queries on `orders`
  - auth failures and connection errors

Set alert thresholds:

- p95 API latency > 1200ms for 5+ minutes
- error rate > 2% for 5+ minutes
- webhook failures > 0 in 10-minute windows

## 4) Incident quick actions

If order status is stale:

1. Seller dashboard → click `Sync` button on affected order
2. Verify order row fields updated:
   - `status`
   - `shipment_status`
   - `awb_code`
3. Check Shiprocket webhook log and payload mapping

If high traffic causes timeouts:

1. Keep orders tab open only when needed
2. Temporarily reduce non-critical refreshes
3. Prioritize checkout/order APIs over secondary endpoints

## 5) Rollback plan

If release causes instability:

1. Redeploy previous successful Vercel build
2. Keep manual sync endpoint available for status recovery
3. Re-run smoke checks before re-opening traffic
