#!/bin/bash

# ═══════════════════════════════════════════════════════════════════════════
# SMOKE TEST - Rapid Prototyping Verification
# ═══════════════════════════════════════════════════════════════════════════

BASE_URL="${1:-http://localhost:5173}"
API_URL="${2:-http://localhost:8000}"

echo "🔥 SMOKE TEST - Document Generator"
echo "══════════════════════════════════════════════════════════════"
echo "Frontend: $BASE_URL"
echo "Backend:  $API_URL"
echo ""

PASS=0
FAIL=0

test_endpoint() {
    local name="$1"
    local url="$2"
    local expected_status="${3:-200}"
    local check_content="$4"
    
    start_time=$(date +%s%3N)
    response=$(curl -s -w "\n%{http_code}\n%{time_total}" -o /tmp/response_body.txt "$url" 2>/dev/null)
    end_time=$(date +%s%3N)
    
    status_code=$(tail -2 /tmp/response_body.txt 2>/dev/null | head -1)
    time_total=$(tail -1 /tmp/response_body.txt 2>/dev/null)
    body=$(head -n -2 /tmp/response_body.txt 2>/dev/null)
    
    # Fallback für curl output parsing
    if [[ -z "$status_code" ]]; then
        status_code=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null)
        time_total=$(curl -s -o /dev/null -w "%{time_total}" "$url" 2>/dev/null)
        body=$(curl -s "$url" 2>/dev/null)
    fi
    
    ttfb_ms=$(echo "$time_total * 1000" | bc 2>/dev/null || echo "N/A")
    
    if [[ "$status_code" == "$expected_status" ]]; then
        if [[ -n "$check_content" ]]; then
            if echo "$body" | grep -q "$check_content"; then
                echo "✅ $name (${status_code}) - ${ttfb_ms}ms"
                ((PASS++))
            else
                echo "⚠️  $name (${status_code}) - Content check failed: '$check_content' not found"
                ((FAIL++))
            fi
        else
            echo "✅ $name (${status_code}) - ${ttfb_ms}ms"
            ((PASS++))
        fi
    else
        echo "❌ $name - Expected ${expected_status}, got ${status_code}"
        ((FAIL++))
    fi
}

echo ""
echo "═══ 1. WHITE SCREEN OF DEATH CHECK ═══"
test_endpoint "Frontend Root" "$BASE_URL" "200" "<div id=\"root\">"
test_endpoint "Vite Assets" "$BASE_URL" "200" "modulepreload"

echo ""
echo "═══ 2. BACKEND API HEALTH ═══"
test_endpoint "API Health" "$API_URL/api/v1/health" "200"
test_endpoint "API Docs" "$API_URL/docs" "200" "swagger"

echo ""
echo "═══ 3. CORE ENDPOINTS (Auth-Protected - expect 401/403) ═══"
test_endpoint "Feature Settings" "$API_URL/api/v1/feature-settings" "401"
test_endpoint "Document Types" "$API_URL/api/v1/document-types" "401"
test_endpoint "Deadlines Summary" "$API_URL/api/v1/deadlines/summary" "401"
test_endpoint "Audit Logs" "$API_URL/api/v1/audit" "401"
test_endpoint "Clause Approvals" "$API_URL/api/v1/clause-approval/pending" "401"

echo ""
echo "═══ 4. UPLOAD ENDPOINT (Should reject without file) ═══"
upload_response=$(curl -s -w "%{http_code}" -X POST "$API_URL/api/v1/document-upload/upload" 2>/dev/null)
upload_status="${upload_response: -3}"
if [[ "$upload_status" == "401" ]] || [[ "$upload_status" == "422" ]]; then
    echo "✅ Upload Endpoint responds (${upload_status}) - Auth/Validation working"
    ((PASS++))
else
    echo "⚠️  Upload Endpoint unexpected status: ${upload_status}"
    ((FAIL++))
fi

echo ""
echo "═══ 5. PERFORMANCE CHECK ═══"
frontend_ttfb=$(curl -s -o /dev/null -w "%{time_starttransfer}" "$BASE_URL" 2>/dev/null)
backend_ttfb=$(curl -s -o /dev/null -w "%{time_starttransfer}" "$API_URL/docs" 2>/dev/null)
frontend_ms=$(echo "$frontend_ttfb * 1000" | bc 2>/dev/null || echo "N/A")
backend_ms=$(echo "$backend_ttfb * 1000" | bc 2>/dev/null || echo "N/A")

echo "Frontend TTFB: ${frontend_ms}ms"
echo "Backend TTFB:  ${backend_ms}ms"

if [[ $(echo "$frontend_ttfb < 0.5" | bc 2>/dev/null) == "1" ]]; then
    echo "✅ Frontend is snappy (<500ms)"
    ((PASS++))
else
    echo "⚠️  Frontend might be slow (>500ms)"
fi

if [[ $(echo "$backend_ttfb < 0.5" | bc 2>/dev/null) == "1" ]]; then
    echo "✅ Backend is snappy (<500ms)"
    ((PASS++))
else
    echo "⚠️  Backend might be slow (>500ms)"
fi

echo ""
echo "═══ 6. NEW COMPONENT CHECK (DOM/Code Analysis) ═══"
# Check if new context file exists and has correct exports
if grep -q "FeatureSettingsProvider" frontend/src/contexts/FeatureSettingsContext.tsx 2>/dev/null; then
    echo "✅ FeatureSettingsContext.tsx - Provider exists"
    ((PASS++))
else
    echo "❌ FeatureSettingsContext.tsx - Provider missing"
    ((FAIL++))
fi

if grep -q "useFeatureEnabled" frontend/src/contexts/FeatureSettingsContext.tsx 2>/dev/null; then
    echo "✅ FeatureSettingsContext.tsx - useFeatureEnabled hook exists"
    ((PASS++))
else
    echo "❌ FeatureSettingsContext.tsx - useFeatureEnabled hook missing"
    ((FAIL++))
fi

# Check if App.tsx uses the new provider
if grep -q "FeatureSettingsProvider" frontend/src/App.tsx 2>/dev/null; then
    echo "✅ App.tsx - FeatureSettingsProvider integrated"
    ((PASS++))
else
    echo "❌ App.tsx - FeatureSettingsProvider not integrated"
    ((FAIL++))
fi

# Check Upload Dialog improvements
if grep -q "maxSize" frontend/src/components/documents/DocumentUploadDialog.tsx 2>/dev/null; then
    echo "✅ DocumentUploadDialog.tsx - File size limit added"
    ((PASS++))
else
    echo "❌ DocumentUploadDialog.tsx - File size limit missing"
    ((FAIL++))
fi

if grep -q "onDropRejected" frontend/src/components/documents/DocumentUploadDialog.tsx 2>/dev/null; then
    echo "✅ DocumentUploadDialog.tsx - Drop rejection handler added"
    ((PASS++))
else
    echo "❌ DocumentUploadDialog.tsx - Drop rejection handler missing"
    ((FAIL++))
fi

# Check backend streaming fix
if grep -q "chunk_size" backend/app/api/v1/endpoints/document_upload.py 2>/dev/null; then
    echo "✅ document_upload.py - Chunked streaming implemented"
    ((PASS++))
else
    echo "❌ document_upload.py - Chunked streaming missing"
    ((FAIL++))
fi

# Check approval schema fix
if grep -q "ApproveRequest" backend/app/api/v1/endpoints/clause_approval.py 2>/dev/null; then
    echo "✅ clause_approval.py - ApproveRequest schema added"
    ((PASS++))
else
    echo "❌ clause_approval.py - ApproveRequest schema missing"
    ((FAIL++))
fi

echo ""
echo "══════════════════════════════════════════════════════════════"
echo "📊 RESULTS: $PASS passed, $FAIL failed"
echo "══════════════════════════════════════════════════════════════"

if [[ $FAIL -eq 0 ]]; then
    echo "🎉 ALL TESTS PASSED!"
    exit 0
else
    echo "⚠️  SOME TESTS FAILED - Check output above"
    exit 1
fi
