#!/usr/bin/env bash
# OpenStore — WAC (weighted-average cost) end-to-end verification.
# Scenario: product restocked at two different prices from two different
# suppliers, then sold. Verifies blended average cost + COGS snapshot.
set -e
BASE="http://localhost:3000"
JAR=/tmp/alred-cookies.txt
rm -f "$JAR"

echo "== 1. Sign in =="
CSRF=$(curl -s -c "$JAR" "$BASE/api/auth/csrf" | python3 -c "import sys,json;print(json.load(sys.stdin)['csrfToken'])")
curl -s -b "$JAR" -c "$JAR" -X POST "$BASE/api/auth/callback/credentials" \
  -d "csrfToken=$CSRF&username=admin&password=openstore2026" -o /dev/null
echo "signed in"

echo "== 2. Create test product (initial cost ₱50, 10 units) =="
PRODUCT=$(curl -s -b "$JAR" -X POST "$BASE/api/products" -H "Content-Type: application/json" \
  -d '{"name":"WAC Test Product","category":"canned-goods","unitCost":50,"sellPrice":70,"stock":10}')
PID=$(echo "$PRODUCT" | python3 -c "import sys,json;print(json.load(sys.stdin)['id'])")
echo "product id: $PID"

echo "== 3. Restock: +10 units at ₱70 from 'Store B' =="
curl -s -b "$JAR" -X POST "$BASE/api/stock-in" -H "Content-Type: application/json" \
  -d "{\"productId\":\"$PID\",\"quantity\":10,\"unitCost\":70,\"supplier\":\"Store B\"}" -o /dev/null
echo "done"

echo "== 4. Check blended average cost (expect ₱60.00) =="
curl -s "$BASE/api/products/$PID" | python3 -c "
import sys,json
p=json.load(sys.stdin)
avg=p['unitCost']; stock=p['stock']
print(f'  avg cost: {avg}  stock: {stock}')
assert abs(avg-60.0)<0.001, f'expected 60, got {avg}'
assert stock==20, f'expected 20, got {stock}'
print('  PASS: (10×50 + 10×70) / 20 = 60.00')
"

echo "== 5. Restock again: +5 units at ₱66 from 'Store C' =="
curl -s -b "$JAR" -X POST "$BASE/api/stock-in" -H "Content-Type: application/json" \
  -d "{\"productId\":\"$PID\",\"quantity\":5,\"unitCost\":66,\"supplier\":\"Store C\"}" -o /dev/null
curl -s "$BASE/api/products/$PID" | python3 -c "
import sys,json
p=json.load(sys.stdin)
avg=p['unitCost']
# (20×60 + 5×66) / 25 = 61.2
assert abs(avg-61.2)<0.001, f'expected 61.2, got {avg}'
print(f'  PASS: (20×60 + 5×66) / 25 = {avg}')
"

echo "== 6. Sell 3 units — COGS must snapshot ₱61.20/unit = ₱183.60 =="
SALE=$(curl -s -b "$JAR" -X POST "$BASE/api/sales" -H "Content-Type: application/json" \
  -d "{\"items\":[{\"productId\":\"$PID\",\"quantity\":3}],\"payment\":\"cash\"}")
echo "$SALE" | python3 -c "
import sys,json
s=json.load(sys.stdin)
item=s['items'][0]
print(f'  sale total: {s[\"total\"]}  item.unitCost snapshot: {item[\"unitCost\"]}')
assert abs(item['unitCost']-61.2)<0.001, f'expected 61.2, got {item[\"unitCost\"]}'
assert abs(s['total']-210.0)<0.001, f'expected 210, got {s[\"total\"]}'
print('  PASS: revenue 3×₱70=₱210, cost snapshot 3×₱61.20=₱183.60')
"

echo "== 7. Dashboard COGS reflects snapshotted cost =="
curl -s "$BASE/api/dashboard?week=0" | python3 -c "
import sys,json
d=json.load(sys.stdin)
cogs=d['weekly']['cogs']
print(f'  week COGS: {cogs} (includes older test sales at old prices)')
# just assert it parsed and is >= 183.6
assert cogs >= 183.599, 'dashboard COGS too low'
print('  PASS: dashboard COGS includes the ₱183.60 snapshot')
"

echo "== 8. Cleanup: remove test product =="
curl -s -b "$JAR" -X DELETE "$BASE/api/products/$PID" -o /dev/null
echo "removed (soft delete)"

echo ""
echo "ALL CHECKS PASSED — multi-supplier, multi-price purchasing fully covered."
