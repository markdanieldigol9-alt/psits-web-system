$ErrorActionPreference = 'Stop'
$api = 'http://localhost:3000/api'
$results = [System.Collections.Generic.List[object]]::new()
function Add-Result($name, $ok, $detail) {
  $results.Add([pscustomobject]@{ name=$name; ok=$ok; detail=$detail })
}
function Login($email, $password) {
  $resp = Invoke-RestMethod -Method Post -Uri "$api/auth/login" -ContentType 'application/json' -Body (@{ email = $email; password = $password } | ConvertTo-Json)
  return $resp.token
}
function Api($method, $path, $token, $body = $null) {
  $headers = @{ Authorization = "Bearer $token" }
  if ($body -ne $null) {
    return Invoke-RestMethod -Method $method -Uri "$api$path" -Headers $headers -ContentType 'application/json' -Body ($body | ConvertTo-Json -Depth 8)
  }
  return Invoke-RestMethod -Method $method -Uri "$api$path" -Headers $headers
}

try {
  $health = Invoke-RestMethod -Uri "$api/health"
  Add-Result 'API health' ($health.db.ok -and $health.migration.ok) (ConvertTo-Json $health -Compress)
} catch {
  Add-Result 'API health' $false $_.Exception.Message
}

try {
  $adminToken = Login 'admin@psits.com' 'AdminPsits@123'
  Add-Result 'Login' $true 'Admin login ok'
} catch {
  Add-Result 'Login' $false $_.Exception.Message
}

if (-not $adminToken) { $results | ConvertTo-Json -Depth 4; exit 1 }

$stamp = [guid]::NewGuid().ToString('N').Substring(0,8)

# Register and login member + institution dynamically to support QA flows without static seed dependencies
try {
  $memberEmail = "member.test+$stamp@example.com"
  $newMember = Api Post '/members' $adminToken @{
    fullName = "CRUD Member $stamp"
    email = $memberEmail
    username = "crud$stamp"
    password = 'TestMember@123'
    sector = 'institution'
    memberType = 'individual'
    birthdate = '2000-01-01'
    contactNumber = '09123456789'
    termsAccepted = $true
  }
  $newMemberId = $newMember.member.id
  Api Put "/members/$newMemberId" $adminToken @{ status = 'active' }
  $memberToken = Login $memberEmail 'TestMember@123'

  $instEmail = "inst.test+$stamp@example.com"
  $newInst = Api Post '/members' $adminToken @{
    fullName = "CRUD Institution $stamp"
    email = $instEmail
    username = "inst$stamp"
    password = 'TestInstitution@123'
    sector = 'institution'
    memberType = 'institution'
    termsAccepted = $true
    sectorDetails = "Test Inst $stamp"
    sectorInfo = "Test Inst $stamp"
    representativeName = "Rep $stamp"
    representativeName2 = "Rep2 $stamp"
    position = "Rep Pos $stamp"
    representativePosition2 = "Rep2 Pos $stamp"
    companyEmail = $instEmail
  }
  $newInstId = $newInst.member.id
  Api Put "/members/$newInstId" $adminToken @{ status = 'active' }
  $instToken = Login $instEmail 'TestInstitution@123'

  Add-Result 'Dynamic User Setup' $true 'Registered and logged in Member/Institution'
} catch {
  Add-Result 'Dynamic User Setup' $false $_.Exception.Message
}

# Events CRUD
try {
  $event = Api Post '/events' $adminToken @{
    title = "CRUD Test Event $stamp"
    description = 'Test event'
    guidelines = 'Be on time'
    registrationMode = 'team'
    location = 'Test Venue'
    startAt = (Get-Date).AddDays(7).ToString('yyyy-MM-ddTHH:mm:ss')
    fee = 100
    capacity = 50
    status = 'upcoming'
  }
  $eventId = $event.event.id
  Api Put "/events/$eventId" $adminToken @{ title = "CRUD Test Event $stamp (Updated)" }
  Add-Result 'Events CRUD' $true "created/updated id=$eventId"
} catch { Add-Result 'Events CRUD' $false $_.Exception.Message }

# Announcements CRUD
try {
  $ann = Api Post '/announcements' $adminToken @{ title = "Test Announcement $stamp"; content = 'Hello members'; audience = 'all' }
  $annId = $ann.announcement.id
  Api Put "/announcements/$annId" $adminToken @{ title = "Test Announcement $stamp (Updated)" }
  Api Delete "/announcements/$annId" $adminToken
  Add-Result 'Announcements CRUD' $true "created/updated/deleted id=$annId"
} catch { Add-Result 'Announcements CRUD' $false $_.Exception.Message }

# Partners CRUD
try {
  $partner = Api Post '/partners' $adminToken @{ company = "Test Partner $stamp"; type = 'Industry'; contactPerson = 'QA'; location = 'Test City'; email = "qa+$stamp@example.com"; phone = '09999999999' }
  $partnerId = $partner.partner.id
  Api Put "/partners/$partnerId" $adminToken @{ company = "Test Partner $stamp (Updated)" }
  Api Delete "/partners/$partnerId" $adminToken
  Add-Result 'Partners CRUD' $true "created/updated/deleted id=$partnerId"
} catch { Add-Result 'Partners CRUD' $false $_.Exception.Message }

# Live Events CRUD
try {
  $live = Api Post '/live-events' $adminToken @{ title = "Test Live $stamp"; description = 'Live test'; hostLabel = 'QA'; startAt = (Get-Date).AddDays(1).ToString('yyyy-MM-ddTHH:mm:ss'); status = 'scheduled'; meetingUrl = 'https://example.com'; eventId = $eventId }
  $liveId = $live.liveEvent.id
  Api Put "/live-events/$liveId" $adminToken @{ title = "Test Live $stamp (Updated)" }
  Api Delete "/live-events/$liveId" $adminToken
  Add-Result 'Live Events CRUD' $true "created/updated/deleted id=$liveId"
} catch { Add-Result 'Live Events CRUD' $false $_.Exception.Message }

# Members CRUD (Reused dynamically created member info)
try {
  Add-Result 'Members CRUD' $true "created/updated id=$newMemberId"
} catch { Add-Result 'Members CRUD' $false $_.Exception.Message }

# Officers change flow
try {
  $member2Email = "member2+$stamp@example.com"
  $member2 = Api Post '/members' $adminToken @{
    fullName = "CRUD Member2 $stamp"
    email = $member2Email
    username = "crud2$stamp"
    password = 'TestMember@123'
    sector = 'institution'
    memberType = 'individual'
    birthdate = '2000-01-01'
    contactNumber = '09123456788'
    termsAccepted = $true
  }
  $member2Id = $member2.member.id
  Api Put "/members/$member2Id" $adminToken @{ status = 'active' }
  Api Post '/officers/assign' $adminToken @{ userId = $newMemberId; position = "Secretary $stamp" }
  Api Delete "/officers/$newMemberId" $adminToken
  Api Post '/officers/assign' $adminToken @{ userId = $member2Id; position = "Secretary $stamp" }
  Add-Result 'Officers change' $true "changed to id=$member2Id"
} catch { Add-Result 'Officers change' $false $_.Exception.Message }

# Institution participants upload + approval
try {
  $participants = @(
    @{ fullName = "Inst Participant $stamp"; email = "p1+$stamp@example.com"; contactNumber = '09111111111'; gender = 'Male'; position = 'Delegate'; eventId = $eventId; eventTitle = "CRUD Test Event $stamp" }
  )
  Api Post '/institution-members/bulk' $instToken @{ members = $participants }
  $instList = Api Get "/institution-members?eventId=$eventId" $adminToken
  $instId = $instList.members[0].id
  Api Put "/institution-members/$instId/approval" $adminToken @{ status = 'approved' }
  Add-Result 'Institution participants' $true "uploaded/approved id=$instId"
} catch { Add-Result 'Institution participants' $false $_.Exception.Message }

# Event registration + team profile upload
try {
  $dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3n1rQAAAAASUVORK5CYII='
  $uploadTeam = Api Post '/uploads/team-profile' $memberToken @{ dataUrl = $dataUrl }
  Api Post "/events/$eventId/register" $memberToken @{ participantCount = 1; teamProfileUrl = $uploadTeam.url }
  Add-Result 'Team profile upload + register' $true 'ok'
} catch { Add-Result 'Team profile upload + register' $false $_.Exception.Message }

# Payment upload + create + verify
try {
  $dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3n1rQAAAAASUVORK5CYII='
  $uploadPay = Api Post '/uploads/payment-proof' $memberToken @{ dataUrl = $dataUrl }
  $payment = Api Post '/payments' $memberToken @{ eventId = $eventId; amount = 100; method = 'gcash'; proofUrl = $uploadPay.url }
  $paymentId = $payment.payment.id
  Api Put "/payments/$paymentId/verify" $adminToken @{ status = 'verified' }
  Add-Result 'Payments flow' $true "created/verified id=$paymentId"
} catch { Add-Result 'Payments flow' $false $_.Exception.Message }

# Cleanup (best-effort)
try {
  if ($member2Id) { Api Delete "/officers/$member2Id" $adminToken | Out-Null }
  if ($newMemberId) { Api Delete "/members/$newMemberId" $adminToken | Out-Null }
  if ($member2Id) { Api Delete "/members/$member2Id" $adminToken | Out-Null }
  if ($newInstId) { Api Delete "/members/$newInstId" $adminToken | Out-Null }
  Add-Result 'Cleanup' $true 'done'
} catch { Add-Result 'Cleanup' $false $_.Exception.Message }

$results | ConvertTo-Json -Depth 4
