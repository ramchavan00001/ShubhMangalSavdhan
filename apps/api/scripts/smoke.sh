#!/usr/bin/env bash
# End-to-end smoke test against a running API (development only).
#
# Needs: API started with OTP_PROVIDER=console and PAYMENTS_MODE=mock, its log written to $API_LOG,
# a freshly seeded database (SEED_DEMO=true npm run db:seed) and ADMIN_PHONES containing 919999999999.
#
#   API_LOG=/path/to/api.log ./scripts/smoke.sh
set -euo pipefail

API=${API:-http://localhost:4000}
API_LOG=${API_LOG:?Set API_LOG to the API log file}
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
J='content-type: application/json'
PASS=0

ok() { PASS=$((PASS + 1)); echo "  ✓ $1"; }
fail() { echo "  ✗ $1"; echo "    got: $2"; exit 1; }
expect() { # expect <description> <needle> <haystack>
  if [[ "$3" == *"$2"* ]]; then ok "$1"; else fail "$1" "$3"; fi
}
json() { python3 -c "import sys,json; d=json.load(sys.stdin); print($1)"; }

login() { # login <10-digit phone> <jar>
  curl -s -X POST "$API/auth/otp/request" -H "$J" -d "{\"phone\":\"$1\"}" >/dev/null
  sleep 0.3
  local code
  code=$(grep -o "OTP for +91$1: [0-9]*" "$API_LOG" | tail -1 | awk '{print $NF}')
  curl -s -c "$TMP/$2" -X POST "$API/auth/otp/verify" -H "$J" -d "{\"phone\":\"$1\",\"code\":\"$code\"}" >/dev/null
}
as() { local jar=$1; shift; curl -s -b "$TMP/$jar" "$@"; }

echo "Signup & profile wizard"
login 9876500001 rohan
expect "browsing needs a profile" "complete your profile" "$(as rohan "$API/matches")"
expect "men must be 21+" "21 for men" "$(as rohan -X PATCH "$API/profiles/me/step/1" -H "$J" -d '{"createdFor":"SELF","firstName":"Rohan","lastName":"Pawar","gender":"MALE","dateOfBirth":"2008-01-01","heightCm":176,"maritalStatus":"NEVER_MARRIED","religion":"Hindu","community":"Maratha","motherTongue":"Marathi"}')"
as rohan -X PATCH "$API/profiles/me/step/1" -H "$J" -d '{"createdFor":"SELF","firstName":"Rohan","lastName":"Pawar","gender":"MALE","dateOfBirth":"1997-03-15","heightCm":176,"maritalStatus":"NEVER_MARRIED","religion":"Hindu","community":"Maratha","motherTongue":"Marathi"}' >/dev/null
as rohan -X PATCH "$API/profiles/me/step/2" -H "$J" -d '{"country":"India","state":"Maharashtra","city":"Pune"}' >/dev/null
as rohan -X PATCH "$API/profiles/me/step/3" -H "$J" -d '{"education":"B.E. / B.Tech","profession":"Software Engineer","annualIncome":"₹10–15 lakh"}' >/dev/null
as rohan -X PATCH "$API/profiles/me/step/4" -H "$J" -d '{"familyType":"JOINT","familyValues":"TRADITIONAL"}' >/dev/null
as rohan -X PATCH "$API/profiles/me/step/5" -H "$J" -d '{"diet":"VEG"}' >/dev/null
expect "phone numbers blocked in bio" "phone numbers" "$(as rohan -X PATCH "$API/profiles/me/step/6" -H "$J" -d '{"aboutMe":"Software engineer from Pune. Call me on 98765 43210 to know more about me and family."}')"
as rohan -X PATCH "$API/profiles/me/step/6" -H "$J" -d '{"aboutMe":"I am a software engineer from Pune who loves trekking, reading and spending time with family."}' >/dev/null
printf '\xff\xd8\xff\xe0smoke' >"$TMP/p.jpg"
expect "photo upload" '"status":"PENDING"' "$(as rohan -F "file=@$TMP/p.jpg" "$API/photos")"
printf 'GIF89a' >"$TMP/p.gif"
expect "non-image rejected" "Only JPG" "$(as rohan -F "file=@$TMP/p.gif" "$API/photos")"
as rohan -X PUT "$API/profiles/me/preferences" -H "$J" -d '{"ageMin":24,"ageMax":30,"religions":["Hindu"],"motherTongues":["Marathi"]}' >/dev/null
expect "submit for review" '"status":"PENDING"' "$(as rohan -X POST "$API/profiles/me/submit")"
expect "interests need approval" "under review" "$(as rohan -X POST "$API/interests" -H "$J" -d '{"profileId":"x"}')"

echo "Admin"
login 9999999999 admin
expect "non-admin blocked from admin" "Not allowed" "$(as rohan "$API/admin/dashboard")"
PID=$(as admin "$API/admin/approvals" | json "[p['id'] for p in d['profiles'] if p['firstName']=='Rohan'][0]")
expect "approve profile" '"ok":true' "$(as admin -X POST "$API/admin/profiles/$PID/approve")"

echo "Matching"
MATCHES=$(as rohan "$API/matches" | json "sorted(i['firstName'] for i in d['items'])")
expect "mutual matches respect both preferences" "['Anjali', 'Priya', 'Sneha']" "$MATCHES"
idof() { as rohan "$API/search" | json "[i['id'] for i in d['items'] if i['firstName']=='$1'][0]"; }
ANJALI=$(idof Anjali); MEERA=$(idof Meera); SNEHA=$(idof Sneha); PRIYA=$(idof Priya)

echo "Interests"
expect "send interest" '"status":"PENDING"' "$(as rohan -X POST "$API/interests" -H "$J" -d "{\"profileId\":\"$ANJALI\",\"message\":\"Namaste\"}")"
expect "no duplicate interests" "already sent" "$(as rohan -X POST "$API/interests" -H "$J" -d "{\"profileId\":\"$ANJALI\"}")"
login 9000000003 anjali
INBOX=$(as anjali "$API/interests?box=received" | json "[(i['profile']['firstName'], i['id']) for i in d['items']]")
expect "interest reaches the right person" "Rohan" "$INBOX"
IID=$(as anjali "$API/interests?box=received" | json "d['items'][0]['id']")
expect "accept interest" '"ACCEPTED"' "$(as anjali -X POST "$API/interests/$IID/accept")"
expect "sender notified" "accepted your interest" "$(as rohan "$API/notifications")"

echo "Free contact quota (1/week)"
expect "unlock returns the chosen member" "Meera Raman" "$(as rohan -X POST "$API/contacts/$MEERA/unlock")"
expect "re-opening is free" "Meera Raman" "$(as rohan -X POST "$API/contacts/$MEERA/unlock")"
expect "second unlock blocked" "Upgrade to Premium" "$(as rohan -X POST "$API/contacts/$SNEHA/unlock")"

echo "Premium (₹150 + GST)"
ORDER=$(as rohan -X POST "$API/payments/order" | json "d['orderId'] + ' ' + str(d['amountPaise'])")
expect "order total is ₹177" " 17700" "$ORDER"
ORDER_ID=${ORDER%% *}
expect "payment completes" '"PAID"' "$(as rohan -X POST "$API/payments/mock/complete" -H "$J" -d "{\"orderId\":\"$ORDER_ID\"}")"
expect "completing twice is harmless" '"PAID"' "$(as rohan -X POST "$API/payments/mock/complete" -H "$J" -d "{\"orderId\":\"$ORDER_ID\"}")"
expect "only one subscription" "1" "$(as admin "$API/admin/users?q=9876500001" | json "1 if d['items'][0]['premium'] else 0")"
expect "premium quota is 4 from payment time" '"limit":4,"used":0' "$(as rohan "$API/contacts/quota")"
for who in SNEHA PRIYA ANJALI; do as rohan -X POST "$API/contacts/${!who}/unlock" >/dev/null; done
expect "3 premium unlocks leave 1 this week" '"remaining":1' "$(as rohan "$API/contacts/quota")"
PAY=$(as rohan "$API/payments" | json "d[0]['id']")
expect "GST invoice (same state → CGST+SGST)" "CGST @ 9%" "$(as rohan "$API/payments/$PAY/invoice")"

echo "Concurrency"
login 9000000002 sneha
for id in $(as sneha "$API/search" | json "' '.join(i['id'] for i in d['items'])"); do
  as sneha -o /dev/null -X POST "$API/contacts/$id/unlock" &
done
wait
expect "parallel unlocks can't beat the weekly limit" '"used":1' "$(as sneha "$API/contacts/quota")"

echo "Privacy & safety"
as anjali -X PUT "$API/profiles/me/privacy" -H "$J" -d '{"hidden":true}' >/dev/null
expect "hidden profiles disappear from search" "False" "$(as rohan "$API/search" | json "'$ANJALI' in [i['id'] for i in d['items']]")"
as anjali -X PUT "$API/profiles/me/privacy" -H "$J" -d '{"hidden":false}' >/dev/null
as rohan -X POST "$API/marks" -H "$J" -d "{\"profileId\":\"$PRIYA\",\"type\":\"BLOCK\"}" >/dev/null
login 9000000001 priya
expect "blocked member can't see the blocker" "False" "$(as priya "$API/search" | json "any(i['firstName']=='Rohan' for i in d['items'])")"
expect "report a profile" "review this report" "$(as priya -X POST "$API/reports" -H "$J" -d "{\"profileId\":\"$SNEHA\",\"reason\":\"FAKE_PROFILE\"}")"

echo "Chat"
ROHAN_CODE=$(as rohan "$API/auth/me" | json "d['profile']['code']")
ANJALI_CODE=$(as rohan "$API/search" | json "[i['code'] for i in d['items'] if i['firstName']=='Anjali'][0]")
expect "free member can't start a chat" "Free members can reply" "$(as anjali -X POST "$API/chats/$ROHAN_CODE" -H "$J" -d '{"body":"Namaste"}')"
expect "premium member starts a chat" '"fromMe":true' "$(as rohan -X POST "$API/chats/$ANJALI_CODE" -H "$J" -d '{"body":"Namaste Anjali ji"}')"
expect "phone numbers blocked in chat" "can’t be shared in chat" "$(as rohan -X POST "$API/chats/$ANJALI_CODE" -H "$J" -d '{"body":"call 98765 43210"}')"
expect "receiver sees unread count" '"unreadMessages":1' "$(as anjali "$API/auth/me")"
expect "receiver sees the message" "Namaste Anjali ji" "$(as anjali "$API/chats/$ROHAN_CODE")"
expect "opening the thread marks it read" '"unreadMessages":0' "$(as anjali "$API/auth/me")"
expect "free member can reply" '"fromMe":true' "$(as anjali -X POST "$API/chats/$ROHAN_CODE" -H "$J" -d '{"body":"Namaste Rohan ji"}')"
expect "not connected → no chat" "accepted an interest" "$(as sneha "$API/chats/$ROHAN_CODE")"

echo "WhatsApp (test mode)"
expect "consent starts off" '"digest":false,"shareProfile":false,"alerts":false' "$(as sneha "$API/whatsapp/preferences")"
as sneha -X PUT "$API/whatsapp/preferences" -H "$J" -d '{"digest":true,"alerts":true}' >/dev/null
expect "joining digests later queues you for matches" '"shareProfile":true' "$(as rohan -X PUT "$API/whatsapp/preferences" -H "$J" -d '{"shareProfile":true}')"
expect "daily digest runs" '"sent":1' "$(as admin -X POST "$API/admin/whatsapp/run-digest")"
DIGEST=$(as admin "$API/admin/whatsapp/messages?phone=9000000002" | json "[m['body'] for m in d['items'] if m['kind']=='DIGEST'][0]")
expect "digest lists the match" "1. Rohan, " "$DIGEST"
if [[ "$DIGEST" == *"Pawar"* || "$DIGEST" == *"9876500001"* ]]; then fail "digest hides surname and phone" "$DIGEST"; else ok "digest hides surname and phone"; fi
sim() { as admin -X POST "$API/admin/whatsapp/simulate" -H "$J" -d "{\"phone\":\"$1\",\"text\":\"$2\"}"; }
expect "\"1 pasand hai\" sends interest" "Rohan: interest sent" "$(sim 9000000002 '1 pasand hai')"
expect "unknown reply shows the menu" "didn’t understand" "$(sim 9000000002 'what is his height?')"
login 9000000004 meera
as meera -X PUT "$API/whatsapp/preferences" -H "$J" -d '{"alerts":true}' >/dev/null
as rohan -X POST "$API/interests" -H "$J" -d "{\"profileId\":\"$MEERA\"}" >/dev/null
expect "interest alert is sent" "is interested in you" "$(as admin "$API/admin/whatsapp/messages?phone=9000000004")"
expect "\"Accept\" accepts the alerted interest" "connected with Rohan" "$(sim 9000000004 'Accept')"
expect "STOP unsubscribes" "won’t get WhatsApp messages" "$(sim 9000000002 'STOP')"
expect "STOP turns consent off" '"digest":false' "$(as sneha "$API/whatsapp/preferences")"
expect "unregistered numbers are told to sign up" "isn't registered" "$(sim 9811100000 'hi')"

echo "Verification"
expect "starts unverified" '"verified":false' "$(as rohan "$API/verification")"
expect "bad ID number rejected" "doesn’t look like a valid PAN" "$(as rohan -X POST "$API/verification/id" -H "$J" -d '{"docType":"PAN","number":"ABCD123","nameOnDoc":"Rohan Pawar"}')"
expect "ID with matching name is approved (test mode)" '"status":"APPROVED","docType":"PAN","docLast4":"234F"' "$(as rohan -X POST "$API/verification/id" -H "$J" -d '{"docType":"PAN","number":"abcde 1234 f","nameOnDoc":"ROHAN SURESH PAWAR"}')"
expect "verified name can't be changed" "verified against your ID" "$(as rohan -X PATCH "$API/profiles/me" -H "$J" -d '{"firstName":"Rahul"}')"
expect "ID with a different name goes to review" '"status":"PENDING"' "$(as sneha -X POST "$API/verification/id" -H "$J" -d '{"docType":"VOTER_ID","number":"ABC1234567","nameOnDoc":"Sneha Joshi"}')"
expect "selfie needs a profile photo" "Add a profile photo first" "$(as sneha -F "file=@$TMP/p.jpg" "$API/verification/selfie")"
expect "selfie goes to a moderator" '"status":"PENDING"' "$(as rohan -F "file=@$TMP/p.jpg" "$API/verification/selfie")"
expect "one review at a time" "still being reviewed" "$(as rohan -F "file=@$TMP/p.jpg" "$API/verification/selfie")"
VID=$(as admin "$API/admin/verifications" | json "[v['id'] for v in d if v['type']=='SELFIE' and v['profile']['name']=='Rohan Pawar'][0]")
expect "moderator can view the selfie" "smoke" "$(as admin "$API/admin/verifications/$VID/selfie")"
if [[ "$(as sneha -o /dev/null -w '%{http_code}' "$API/admin/verifications/$VID/selfie")" == "403" ]]; then ok "members can't view selfies"; else fail "members can't view selfies" "not 403"; fi
as admin -X POST "$API/admin/verifications/$VID/approve" >/dev/null
expect "approved member gets the badge" '"verified":true' "$(as rohan "$API/verification")"
expect "verified-only search" "Rohan" "$(as sneha "$API/search?verifiedOnly=true" | json "[i['firstName'] for i in d['items'] if i['verified']]")"

echo
echo "All $PASS checks passed."
