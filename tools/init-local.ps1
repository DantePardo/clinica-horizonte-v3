$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$apiDirectory = Join-Path $repoRoot 'clinica-horizonte-api'
$appDirectory = Join-Path $repoRoot 'clinica-horizonte-app'
$rootEnv = Join-Path $repoRoot '.env'
$apiEnv = Join-Path $apiDirectory '.env'
$appEnv = Join-Path $appDirectory '.env'
$utf8 = New-Object System.Text.UTF8Encoding -ArgumentList $false

if (-not (Test-Path $rootEnv)) {
    Copy-Item (Join-Path $repoRoot '.env.example') $rootEnv
}

$rootVariables = @{}
foreach ($line in Get-Content $rootEnv) {
    if ($line -match '^([^#=\s]+)=(.*)$') {
        $rootVariables[$matches[1]] = $matches[2]
    }
}
if (-not $rootVariables.POSTGRES_PASSWORD) {
    throw 'POSTGRES_PASSWORD is missing from the repository .env file.'
}

function New-Base64Key {
    $bytes = New-Object byte[] 32
    $generator = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $generator.GetBytes($bytes) } finally { $generator.Dispose() }
    [Convert]::ToBase64String($bytes)
}

if (-not (Test-Path $apiEnv)) {
    $apiContents = @(
        'NODE_ENV=development'
        'PORT=3000'
        'APP_ORIGIN=http://localhost:1420'
        "DATABASE_URL=postgresql://clinic:$($rootVariables.POSTGRES_PASSWORD)@localhost:5432/clinic?schema=public"
        'OIDC_ISSUER=http://localhost:8080/realms/clinica-horizonte'
        'OIDC_AUDIENCE=clinica-horizonte-api'
        "FIELD_ENCRYPTION_KEY=$(New-Base64Key)"
        "PII_LOOKUP_HMAC_KEY=$(New-Base64Key)"
    ) -join "`n"
    [System.IO.File]::WriteAllText($apiEnv, "$apiContents`n", $utf8)
}

if (-not (Test-Path $appEnv)) {
    $appContents = @(
        'VITE_API_URL=http://localhost:3000/api'
        'VITE_OIDC_URL=http://localhost:8080'
        'VITE_OIDC_REALM=clinica-horizonte'
        'VITE_OIDC_CLIENT_ID=clinica-horizonte-app'
    ) -join "`n"
    [System.IO.File]::WriteAllText($appEnv, "$appContents`n", $utf8)
}

Write-Output 'Local environment files are ready. Secret values were not displayed or overwritten.'