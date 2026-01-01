<#
.SYNOPSIS
    Installs pychivalry prerequisites on Windows using winget.

.DESCRIPTION
    Checks for and installs required development tools:
    - Python 3.9+
    - Visual Studio Code
    - Git
    - Node.js 18+

.PARAMETER Auto
    Automatically install all missing prerequisites without prompting.

.EXAMPLE
    .\Install-Prerequisites.ps1
    .\Install-Prerequisites.ps1 -Auto
#>

[CmdletBinding()]
param(
    [switch]$Auto
)

$ErrorActionPreference = "Stop"

# ═══════════════════════════════════════════════════════════════════════════════
# Configuration
# ═══════════════════════════════════════════════════════════════════════════════

$Prerequisites = @(
    @{
        Name       = "Python"
        WingetId   = "Python.Python.3.12"
        MinVersion = [Version]"3.9.0"
        Commands   = @("python", "python3", "py")
        VersionPattern = "Python (\d+\.\d+\.\d+)"
    },
    @{
        Name       = "VS Code"
        WingetId   = "Microsoft.VisualStudioCode"
        MinVersion = $null
        Commands   = @("code")
        VersionPattern = "^(\d+\.\d+\.\d+)"
    },
    @{
        Name       = "Git"
        WingetId   = "Git.Git"
        MinVersion = $null
        Commands   = @("git")
        VersionPattern = "git version (\d+\.\d+\.\d+)"
    },
    @{
        Name       = "Node.js"
        WingetId   = "OpenJS.NodeJS.LTS"
        MinVersion = [Version]"18.0.0"
        Commands   = @("node")
        VersionPattern = "v(\d+\.\d+\.\d+)"
    }
)

# ═══════════════════════════════════════════════════════════════════════════════
# Helper Functions
# ═══════════════════════════════════════════════════════════════════════════════

function Write-Status {
    param(
        [string]$Message,
        [ValidateSet("Info", "Success", "Warning", "Error")]
        [string]$Type = "Info"
    )
    
    $symbols = @{
        Info    = @{ Symbol = "→"; Color = "Cyan" }
        Success = @{ Symbol = "✓"; Color = "Green" }
        Warning = @{ Symbol = "⚠"; Color = "Yellow" }
        Error   = @{ Symbol = "✗"; Color = "Red" }
    }
    
    $s = $symbols[$Type]
    Write-Host "$($s.Symbol) $Message" -ForegroundColor $s.Color
}

function Show-Banner {
    Write-Host ""
    Write-Host "╔═══════════════════════════════════════════════════════════╗" -ForegroundColor Magenta
    Write-Host "║         pychivalry - Prerequisites Installer              ║" -ForegroundColor Magenta
    Write-Host "╚═══════════════════════════════════════════════════════════╝" -ForegroundColor Magenta
    Write-Host ""
}

function Test-Winget {
    try {
        $null = winget --version 2>$null
        return $true
    }
    catch {
        return $false
    }
}

function Get-InstalledVersion {
    param(
        [string[]]$Commands,
        [string]$Pattern
    )
    
    foreach ($cmd in $Commands) {
        try {
            $output = & $cmd --version 2>$null | Select-Object -First 1
            if ($output -match $Pattern) {
                return @{
                    Command = $cmd
                    Version = $Matches[1]
                }
            }
        }
        catch { }
    }
    return $null
}

function Install-WithWinget {
    param([string]$PackageId, [string]$Name)
    
    Write-Status "Installing $Name..." -Type Info
    
    $result = winget install --id $PackageId --accept-source-agreements --accept-package-agreements 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Status "$Name installed successfully" -Type Success
        return $true
    }
    else {
        Write-Status "Failed to install $Name" -Type Error
        return $false
    }
}

function Update-PathFromRegistry {
    $machinePath = [Environment]::GetEnvironmentVariable("Path", "Machine")
    $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
    $env:Path = "$machinePath;$userPath"
}

# ═══════════════════════════════════════════════════════════════════════════════
# Main Logic
# ═══════════════════════════════════════════════════════════════════════════════

Show-Banner

# Check winget availability
Write-Status "Checking for winget..." -Type Info
if (-not (Test-Winget)) {
    Write-Status "winget is not installed" -Type Error
    Write-Host ""
    Write-Host "  Install 'App Installer' from Microsoft Store" -ForegroundColor Gray
    Write-Host "  Or download from: https://aka.ms/getwinget" -ForegroundColor Gray
    exit 1
}
Write-Status "winget is available" -Type Success
Write-Host ""

# Track results
$results = @()
$needsRestart = $false

# Check each prerequisite
foreach ($prereq in $Prerequisites) {
    Write-Status "Checking $($prereq.Name)..." -Type Info
    
    $installed = Get-InstalledVersion -Commands $prereq.Commands -Pattern $prereq.VersionPattern
    
    if ($installed) {
        $version = [Version]$installed.Version
        $meetsMinimum = ($null -eq $prereq.MinVersion) -or ($version -ge $prereq.MinVersion)
        
        if ($meetsMinimum) {
            Write-Status "$($prereq.Name) $($installed.Version) found" -Type Success
            $results += @{ Name = $prereq.Name; Status = "Installed"; Version = $installed.Version }
            continue
        }
        else {
            Write-Status "$($prereq.Name) $($installed.Version) found, but $($prereq.MinVersion)+ required" -Type Warning
        }
    }
    else {
        Write-Status "$($prereq.Name) not found" -Type Warning
    }
    
    # Prompt or auto-install
    $doInstall = $Auto
    if (-not $Auto) {
        $response = Read-Host "  Install $($prereq.Name)? (Y/n)"
        $doInstall = ($response -eq "") -or ($response -match "^[Yy]")
    }
    
    if ($doInstall) {
        if (Install-WithWinget -PackageId $prereq.WingetId -Name $prereq.Name) {
            $needsRestart = $true
            Update-PathFromRegistry
            
            # Re-check after install
            $installed = Get-InstalledVersion -Commands $prereq.Commands -Pattern $prereq.VersionPattern
            if ($installed) {
                $results += @{ Name = $prereq.Name; Status = "Installed"; Version = $installed.Version }
            }
            else {
                $results += @{ Name = $prereq.Name; Status = "Installed (restart needed)"; Version = "-" }
            }
        }
        else {
            $results += @{ Name = $prereq.Name; Status = "Failed"; Version = "-" }
        }
    }
    else {
        Write-Status "Skipped $($prereq.Name)" -Type Info
        $results += @{ Name = $prereq.Name; Status = "Skipped"; Version = "-" }
    }
    
    Write-Host ""
}

# ═══════════════════════════════════════════════════════════════════════════════
# Summary
# ═══════════════════════════════════════════════════════════════════════════════

Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Magenta
Write-Host "                          Summary                              " -ForegroundColor Magenta
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Magenta
Write-Host ""

$results | ForEach-Object {
    $statusColor = switch ($_.Status) {
        "Installed" { "Green" }
        "Installed (restart needed)" { "Yellow" }
        "Skipped" { "Yellow" }
        "Failed" { "Red" }
        default { "White" }
    }
    Write-Host ("  {0,-12} {1,-25} {2}" -f $_.Name, $_.Status, $_.Version) -ForegroundColor $statusColor
}

Write-Host ""

$allInstalled = ($results | Where-Object { $_.Status -match "Installed" }).Count -eq $Prerequisites.Count

if ($needsRestart) {
    Write-Status "Restart your terminal for PATH changes to take effect" -Type Warning
}

if ($allInstalled) {
    Write-Status "All prerequisites installed!" -Type Success
    Write-Host ""
    Write-Host "  Next: pip install pychivalry" -ForegroundColor Cyan
    exit 0
}
else {
    Write-Status "Some prerequisites are missing" -Type Warning
    exit 1
}
