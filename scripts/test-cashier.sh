#!/bin/bash
# OpenStore — cashier role end-to-end test.
set -e
BASE=http://localhost:3000
AJ=/tmp/admin.jar
CJ=/tmp/cashier.jar
rm -f $AJ $CJ

login() { # $1=username $2=password $3=jar
  local csrf=$(curl -s -c "$3" $BASE/api/auth/csrf | python3 -c 'import sys,json;print(json.load(sys.stdin)["csrfToken"])')
  curl -s -b "$3" -c "$3" -X POST $BASE/api/auth/callback/credentials \
    -d "csrfToken=$csrf&username=$1&password=$2&json=true" -o /dev/null
}

code() { curl -s -o /tmp/resp.json -w "%{http_code}" "$@"; }

echo "=== 1. Admin login ==="
login admin openstore2026 $AJ
who=$(curl -s -b $AJ $BASE/api/auth/session)
echo "$who" | python3 -c 'import sys,json;d=json.load(sys.stdin);print("session:",d["user"]["username"],d["user"]["role"])'

echo "=== 2. Admin lists users ==="
code -b $AJ $BASE/api/users; echo " GET /api/users -> $?"
cat /tmp/resp.json | python3 -m json.tool | head -12

echo "=== 3. Admin creates cashier 'maria' ==="
MID=$(curl -s -b $AJ $BASE/api/users | python3 -c 'import sys,json;us=[u for u in json.load(sys.stdin) if u["username"]=="maria"];print(us[0]["id"] if us else "")')
if [ -n "$MID" ]; then
  curl -s -b $AJ -X DELETE $BASE/api/users/$MID -o /dev/null
  echo "  (removed leftover maria from a previous run)"
fi
code -b $AJ -X POST $BASE/api/users -H 'Content-Type: application/json' \
  -d '{"username":"maria","password":"maria123","name":"Maria Santos","role":"cashier"}'
echo " POST /api/users -> HTTP $code"; cat /tmp/resp.json; echo

echo "=== 3b. Duplicate username rejected ==="
code -b $AJ -X POST $BASE/api/users -H 'Content-Type: application/json' \
  -d '{"username":"maria","password":"maria123"}'; echo " -> HTTP $code"; cat /tmp/resp.json; echo

echo "=== 4. Cashier login ==="
login maria maria123 $CJ
who=$(curl -s -b $CJ $BASE/api/auth/session)
echo "$who" | python3 -c 'import sys,json;d=json.load(sys.stdin);print("session:",d["user"]["username"],d["user"]["role"])'

PID=$(curl -s $BASE/api/products | python3 -c 'import sys,json;print(json.load(sys.stdin)[0]["id"])')

echo "=== 5. Cashier records a sale ==="
code -b $CJ -X POST $BASE/api/sales -H 'Content-Type: application/json' \
  -d "{\"items\":[{\"productId\":\"$PID\",\"quantity\":1}],\"payment\":\"cash\",\"customerName\":\"Test Buyer\"}"
echo " POST /api/sales -> HTTP $code"
cat /tmp/resp.json | python3 -c 'import sys,json;d=json.load(sys.stdin);print("createdBy:",d["createdBy"],"| userId set:",bool(d["userId"]),"| total:",d["total"])'

echo "=== 6. Sale list shows who made it ==="
curl -s -b $CJ "$BASE/api/sales?limit=3" | python3 -c '
import sys,json
for s in json.load(sys.stdin)[:3]:
    print("  %8.2f  by %s" % (s["total"], s["createdBy"]))'

echo "=== 7. Cashier is BLOCKED from admin APIs ==="
for ep in /api/users /api/expenses /api/losses /api/stock-in /api/reports/weekly /api/dashboard /api/analytics; do
  c=$(code -b $CJ $BASE$ep); echo "  GET $ep -> HTTP $c"
done
c=$(code -b $CJ -X POST $BASE/api/stock-in -H 'Content-Type: application/json' -d "{\"productId\":\"$PID\",\"quantity\":1,\"unitCost\":10}")
echo "  POST /api/stock-in -> HTTP $c  ($(cat /tmp/resp.json))"

echo "=== 8. Anonymous is BLOCKED ==="
for ep in /api/users /api/sales /api/expenses; do
  c=$(code $BASE$ep); echo "  GET $ep (no cookie) -> HTTP $c"
done

echo "=== 9. Weekly report (admin) includes Recorded-by ==="
curl -s -b $AJ "$BASE/api/reports/weekly" | python3 -c '
import sys,json
d=json.load(sys.stdin)
print("  sales this week:", len(d["sales"]))
for s in d["sales"][:3]:
    print("  %8.2f  recorded by %s" % (s["total"], s["createdBy"]))'

echo "=== 10. Admin resets cashier password + deletes guard ==="
MID=$(curl -s -b $AJ $BASE/api/users | python3 -c 'import sys,json;print([u["id"] for u in json.load(sys.stdin) if u["username"]=="maria"][0])')
AID=$(curl -s -b $AJ $BASE/api/users | python3 -c 'import sys,json;print([u["id"] for u in json.load(sys.stdin) if u["username"]=="admin"][0])')
code -b $AJ -X PATCH $BASE/api/users/$MID -H 'Content-Type: application/json' -d '{"password":"newpass9"}'
echo " PATCH password -> HTTP $code"
login maria newpass9 $CJ && echo "  maria can sign in with new password"
c=$(code -b $AJ -X DELETE $BASE/api/users/$AID); echo "  DELETE last admin -> HTTP $c  ($(cat /tmp/resp.json))"
echo "=== ALL TESTS DONE ==="
