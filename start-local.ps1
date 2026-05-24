$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path

function Wait-ForUrl {
  param(
    [Parameter(Mandatory = $true)][string] $Url,
    [int] $TimeoutSeconds = 30
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    try {
      Invoke-RestMethod -Uri $Url -TimeoutSec 2 | Out-Null
      return $true
    } catch {
      Start-Sleep -Milliseconds 400
    }
  }
  return $false
}

function Wait-ForHealth {
  param(
    [Parameter(Mandatory = $true)][string] $Url,
    [int] $TimeoutSeconds = 30
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    try {
      $health = Invoke-RestMethod -Uri $Url -TimeoutSec 2

      if ($health -and $health.db -and $health.db.ok -eq $true -and $health.migration -and $health.migration.ok -eq $true) {
        return $true
      }

      if ($health -and $health.migration -and $health.migration.error) {
        Write-Host ("Migration failed: " + ($health.migration.error | ConvertTo-Json -Compress)) -ForegroundColor Red
        return $false
      }
    } catch {
      # ignore and retry
    }

    Start-Sleep -Milliseconds 400
  }

  return $false
}

Write-Host "Starting PSITS API (http://localhost:3000/api)..." -ForegroundColor Cyan
Start-Process -FilePath node -ArgumentList "server/index.js" -WorkingDirectory $root -WindowStyle Minimized | Out-Null

if (-not (Wait-ForHealth -Url "http://localhost:3000/api/health" -TimeoutSeconds 30)) {
  Write-Host "API health check failed (DB or migration not ready). Check MySQL + API logs, then run: npm run api:dev" -ForegroundColor Red
  exit 1
}

Write-Host "Starting PSITS Web (http://localhost:5173)..." -ForegroundColor Cyan
Start-Process -FilePath cmd.exe -ArgumentList @('/c', 'npm run dev') -WorkingDirectory (Join-Path $root 'PSITS') -WindowStyle Minimized | Out-Null

Write-Host "Done. Open http://localhost:5173" -ForegroundColor Green
