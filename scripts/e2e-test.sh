#!/usr/bin/env bash
# End-to-end API test suite for Swing AI
# Usage: ./scripts/e2e-test.sh [email] [password]
#
# Defaults to env vars E2E_EMAIL / E2E_PASSWORD if args not provided.

set -euo pipefail

BASE_URL="${E2E_BASE_URL:-http://localhost:5001}"
EMAIL="${1:-${E2E_EMAIL:-vedamshg@gmail.com}}"
PASSWORD="${2:-${E2E_PASSWORD:-vedamsh007}}"
COOKIE_JAR=$(mktemp)
trap 'rm -f "$COOKIE_JAR"' EXIT

PASS=0
FAIL=0
TOTAL=0

green() { printf "\033[32m%s\033[0m" "$1"; }
red()   { printf "\033[31m%s\033[0m" "$1"; }
bold()  { printf "\033[1m%s\033[0m" "$1"; }

assert_ok() {
  local name="$1" result="$2" expected="${3:-}"
  TOTAL=$((TOTAL + 1))
  if [ -n "$expected" ]; then
    if echo "$result" | grep -q "$expected"; then
      PASS=$((PASS + 1))
      printf "  %-4s %-40s %s\n" "$(green '✓')" "$name" "$(green 'PASS')"
      return 0
    else
      FAIL=$((FAIL + 1))
      printf "  %-4s %-40s %s\n" "$(red '✗')" "$name" "$(red 'FAIL')"
      printf "       Expected to contain: %s\n" "$expected"
      printf "       Got: %.200s\n" "$result"
      return 1
    fi
  else
    # just check non-empty
    if [ -n "$result" ]; then
      PASS=$((PASS + 1))
      printf "  %-4s %-40s %s\n" "$(green '✓')" "$name" "$(green 'PASS')"
      return 0
    else
      FAIL=$((FAIL + 1))
      printf "  %-4s %-40s %s\n" "$(red '✗')" "$name" "$(red 'FAIL')"
      return 1
    fi
  fi
}

assert_http() {
  local name="$1" code="$2" expected_code="${3:-200}"
  TOTAL=$((TOTAL + 1))
  if [ "$code" = "$expected_code" ]; then
    PASS=$((PASS + 1))
    printf "  %-4s %-40s %s\n" "$(green '✓')" "$name" "$(green "PASS ($code)")"
    return 0
  else
    FAIL=$((FAIL + 1))
    printf "  %-4s %-40s %s\n" "$(red '✗')" "$name" "$(red "FAIL (got $code, expected $expected_code)")"
    return 1
  fi
}

api_get() {
  curl -s -b "$COOKIE_JAR" "${BASE_URL}$1"
}

api_get_code() {
  curl -s -o /dev/null -w '%{http_code}' -b "$COOKIE_JAR" "${BASE_URL}$1"
}

api_post() {
  curl -s -c "$COOKIE_JAR" -b "$COOKIE_JAR" -X POST "${BASE_URL}$1" \
    -H 'Content-Type: application/json' --data-raw "$2"
}

api_post_code() {
  curl -s -o /dev/null -w '%{http_code}' -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
    -X POST "${BASE_URL}$1" -H 'Content-Type: application/json' --data-raw "$2"
}

api_put() {
  curl -s -b "$COOKIE_JAR" -X PUT "${BASE_URL}$1" \
    -H 'Content-Type: application/json' --data-raw "$2"
}

# ─── Header ───────────────────────────────────────────────────
echo ""
bold "━━━ Swing AI E2E Test Suite ━━━"
echo ""
echo "  Server:  $BASE_URL"
echo "  Account: $EMAIL"
echo ""

# ─── 1. Server Health ────────────────────────────────────────
bold "▸ Server Health"
echo ""

HTML=$(curl -s "${BASE_URL}/")
assert_ok "Root page serves HTML" "$HTML" "<title>Swing AI</title>" || true

BUNDLE_CODE=$(curl -s -o /dev/null -w '%{http_code}' \
  "${BASE_URL}/node_modules/expo-router/entry.bundle?platform=web&dev=true&hot=false&lazy=true&transform.engine=hermes&transform.routerRoot=app&transform.reactCompiler=true&unstable_transformProfile=hermes-stable")
assert_http "JS bundle loads" "$BUNDLE_CODE" "200" || true

echo ""

# ─── 2. Authentication ───────────────────────────────────────
bold "▸ Authentication"
echo ""

LOGIN_BODY="{\"identifier\":\"$EMAIL\",\"password\":\"$PASSWORD\"}"
LOGIN_RESP=$(api_post "/api/auth/login" "$LOGIN_BODY")
assert_ok "POST /api/auth/login" "$LOGIN_RESP" '"email"' || true

COOKIE_SET=$(grep -c 'connect.sid' "$COOKIE_JAR" 2>/dev/null || echo 0)
assert_ok "Session cookie set" "$COOKIE_SET" "1" || true

ME_RESP=$(api_get "/api/auth/me")
assert_ok "GET /api/auth/me (session valid)" "$ME_RESP" '"email"' || true

echo ""

# ─── 3. Core Read Endpoints ──────────────────────────────────
bold "▸ Core API Endpoints"
echo ""

SPORTS=$(api_get "/api/sports")
assert_ok "GET /api/sports" "$SPORTS" '"name"' || true

USERS=$(api_get "/api/users")
assert_ok "GET /api/users" "$USERS" '"email"' || true

SUMMARY=$(api_get "/api/analyses/summary")
assert_ok "GET /api/analyses/summary" "$SUMMARY" '"id"' || true

ANALYSES=$(api_get "/api/analyses")
assert_ok "GET /api/analyses" "$ANALYSES" '"videoFilename"' || true

PROFILE=$(api_get "/api/profile")
assert_ok "GET /api/profile" "$PROFILE" '"email"' || true

REGISTRY=$(api_get "/api/model-registry/config")
assert_ok "GET /api/model-registry/config" "$REGISTRY" '"activeModelVersion"' || true

TRAINING=$(api_get "/api/model-training/tennis")
assert_ok "GET /api/model-training/tennis" "$TRAINING" '"eligibleShotCount"' || true

echo ""

# ─── 4. Analysis Detail ──────────────────────────────────────
bold "▸ Analysis Detail"
echo ""

FIRST_ID=$(echo "$ANALYSES" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d[0]['id'] if d else '')" 2>/dev/null || echo "")
if [ -n "$FIRST_ID" ]; then
  DETAIL=$(api_get "/api/analyses/$FIRST_ID")
  assert_ok "GET /api/analyses/:id" "$DETAIL" '"analysis"' || true

  DETAIL_CODE=$(api_get_code "/api/analyses/$FIRST_ID")
  assert_http "Analysis detail returns 200" "$DETAIL_CODE" "200" || true
else
  echo "  ⚠  No analyses found — skipping detail tests"
fi

echo ""

# ─── 5. Write Endpoints ──────────────────────────────────────
bold "▸ Write Endpoints"
echo ""

PROFILE_UPDATE=$(api_put "/api/profile" '{"name":"Vedamsh"}')
assert_ok "PUT /api/profile (update name)" "$PROFILE_UPDATE" '"name"' || true

echo ""

# ─── 6. Logout & Denial ──────────────────────────────────────
bold "▸ Logout & Access Denial"
echo ""

LOGOUT=$(api_post "/api/auth/logout" '{}')
assert_ok "POST /api/auth/logout" "$LOGOUT" '"Logged out"' || true

DENIED_CODE=$(api_get_code "/api/auth/me")
assert_http "GET /api/auth/me after logout → 401" "$DENIED_CODE" "401" || true

DENIED_CODE2=$(api_get_code "/api/analyses/summary")
assert_http "GET /api/analyses/summary after logout → 401" "$DENIED_CODE2" "401" || true

echo ""

# ─── Summary ─────────────────────────────────────────────────
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ "$FAIL" -eq 0 ]; then
  green "  ALL $TOTAL TESTS PASSED"
  echo ""
else
  red "  $FAIL/$TOTAL TESTS FAILED"
  echo ""
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

exit "$FAIL"
