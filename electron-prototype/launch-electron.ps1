# Script to launch Electron prototype
$workingDir = "C:\iptv-player-github-review\electron-prototype"
Set-Location $workingDir

Write-Host "Starting Electron prototype..."
Write-Host "Working directory: $workingDir"
Write-Host ""

# Launch Electron
Start-Process electron -ArgumentList "." -WindowStyle Normal

Write-Host "Electron should be starting in a new window..."
Write-Host ""
Write-Host "Testing Checklist:"
Write-Host "1. App opens successfully"
Write-Host "2. Login with IPTV credentials"
Write-Host "3. Test Live TV, Movies, Series"
Write-Host "4. Check Network tab - should show direct URLs to provider"
Write-Host "5. Check IPTV provider panel - should show YOUR IP"
Write-Host ""
Write-Host "Press any key to close this window..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")