# ╔══════════════════════════════════════════════════╗
# ║  Pulsewave Release Script                        ║
# ║  Usage: .\release.ps1 1.0.1                      ║
# ║  → Bumps version, pushes tag → GitHub Actions    ║
# ║    builds automatically and uploads to Releases  ║
# ╚══════════════════════════════════════════════════╝

param(
  [Parameter(Mandatory=$true)]
  [string]$version
)

$ErrorActionPreference = "Stop"

Write-Host "`n🎵 Pulsewave Release v$version" -ForegroundColor Yellow
Write-Host "================================" -ForegroundColor Yellow

# 1. Update version in package.json
Write-Host "`n📦 Updating package.json version..." -ForegroundColor Cyan
$pkg = Get-Content "package.json" -Raw | ConvertFrom-Json
$pkg.version = $version
$pkg | ConvertTo-Json -Depth 10 | Set-Content "package.json" -Encoding UTF8
Write-Host "   ✓ Version set to $version"

# 2. Git commit + tag + push
Write-Host "`n📤 Committing and pushing..." -ForegroundColor Cyan
git add package.json
git commit -m "v$version"
git tag "v$version"
git push origin main
git push origin "v$version"

Write-Host "`n✅ Done! GitHub Actions is now building v$version" -ForegroundColor Green
Write-Host "   Watch progress at: https://github.com/welias123/pulsewave-app/actions" -ForegroundColor Gray
Write-Host "   Download will be live at: https://github.com/welias123/pulsewave-app/releases/latest" -ForegroundColor Gray
Write-Host "`n   The website download link updates automatically. 🚀" -ForegroundColor Green
