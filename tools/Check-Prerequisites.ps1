#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Check if all pychivalry development prerequisites are installed.

.DESCRIPTION
    Verifies that all tools needed for pychivalry development are available:
    - Git (version control)
    - GitHub CLI (gh) (GitHub operations)
    - Python 3.9+ (LSP server)
    - Node.js 18+ (VS Code extension)
    - npm (package management)
    - VS Code (recommended)
    
    Also checks Python development packages:
    - pytest, black, flake8, mypy, pre-commit, isort

.PARAMETER Detailed
    Show additional details about each check.

.PARAMETER SkipPythonPackages
    Skip checking Python development packages.

.EXAMPLE
    .\Check-Prerequisites.ps1
    .\Check-Prerequisites.ps1 -Detailed
    .\Check-Prerequisites.ps1 -SkipPythonPackages

.NOTES
    Run this script to verify your development environment before starting work.
    Use Install-Prerequisites.ps1 to install missing tools.
#>

[CmdletBinding()]
param(
    [switch]$Detailed,
    [switch]$SkipPythonPackages
)

$script:allPassed = $true
$script:results = @()
$script:warnings = @()

# ═══════════════════════════════════════════════════════════════════════════════
# Helper Functions
# ═══════════════════════════════════════════════════════════════════════════════

function Write-Check {
    param(
        [string]$Name,
        [bool]$Passed,
        [string]$Details = "",
        [string]$FixHint = "",
        [bool]$Required = $true
    )
    
    if ($Required) {
        $status = if ($Passed) { "[PASS]" } else { "[FAIL]"; $script:allPassed = $false }
    } else {
        $status = if ($Passed) { "[PASS]" } else { "[SKIP]" }
    }
    
    $color = if ($Passed) { "Green" } elseif ($Required) { "Red" } else { "Yellow" }
    
    Write-Host "$status " -ForegroundColor $color -NoNewline
    Write-Host $Name -NoNewline
    if ($Details) {
        Write-Host " - $Details" -ForegroundColor Gray
    } else {
        Write-Host ""
    }
    
    if (-not $Passed -and $FixHint) {
        Write-Host "       Hint: $FixHint" -ForegroundColor Yellow
    }
    
    $script:results += [PSCustomObject]@{
        Name     = $Name
        Passed   = $Passed
        Required = $Required
        Details  = $Details
        FixHint  = $FixHint
    }
}

function Get-CommandVersion {
    param(
        [string]$Command,
        [string]$VersionArg = "--version",
        [string]$Pattern = "(\d+\.\d+\.\d+)"
    )
    
    try {
        $output = & $Command $VersionArg 2>&1 | Select-Object -First 1
        if ($output -match $Pattern) {
            return @{
                Found   = $true
                Version = $Matches[1]
                Output  = $output
            }
        }
        return @{ Found = $true; Version = "unknown"; Output = $output }
    }
    catch {
        return @{ Found = $false; Version = $null; Output = $null }
    }
}

function Test-MinVersion {
    param(
        [string]$Current,
        [string]$Minimum
    )
    
    try {
        return [Version]$Current -ge [Version]$Minimum
    }
    catch {
        return $false
    }
}

function Test-PythonPackage {
    param([string]$PackageName)
    
    try {
        $result = & python -c "import $PackageName; print('OK')" 2>&1
        return $result -eq "OK"
    }
    catch {
        return $false
    }
}

function Test-PipPackage {
    param([string]$PackageName)
    
    try {
        $result = & pip show $PackageName 2>&1
        return $LASTEXITCODE -eq 0
    }
    catch {
        return $false
    }
}

# ═══════════════════════════════════════════════════════════════════════════════
# Banner
# ═══════════════════════════════════════════════════════════════════════════════

Write-Host ""
Write-Host "╔═══════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║         pychivalry - Prerequisites Checker                    ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# ═══════════════════════════════════════════════════════════════════════════════
# Version Control & CLI Tools
# ═══════════════════════════════════════════════════════════════════════════════

Write-Host "── Version Control ──────────────────────────────────────────────" -ForegroundColor White

# Git
$git = Get-CommandVersion -Command "git" -Pattern "git version (\d+\.\d+\.\d+)"
if ($git.Found) {
    Write-Check -Name "Git" -Passed $true -Details "v$($git.Version)"
} else {
    Write-Check -Name "Git" -Passed $false `
        -FixHint "Install from https://git-scm.com/ or run: winget install Git.Git"
}

# GitHub CLI
$gh = Get-CommandVersion -Command "gh" -Pattern "gh version (\d+\.\d+\.\d+)"
if ($gh.Found) {
    # Check if authenticated
    $authStatus = & gh auth status 2>&1
    $isAuthed = $LASTEXITCODE -eq 0
    $details = "v$($gh.Version)"
    if ($isAuthed) {
        $details += " (authenticated)"
    } else {
        $details += " (not authenticated)"
        $script:warnings += "GitHub CLI is not authenticated. Run: gh auth login"
    }
    Write-Check -Name "GitHub CLI (gh)" -Passed $true -Details $details
} else {
    Write-Check -Name "GitHub CLI (gh)" -Passed $false `
        -FixHint "Install from https://cli.github.com/ or run: winget install GitHub.cli"
}

# ═══════════════════════════════════════════════════════════════════════════════
# Python Environment
# ═══════════════════════════════════════════════════════════════════════════════

Write-Host ""
Write-Host "── Python Environment ───────────────────────────────────────────" -ForegroundColor White

# Python
$python = Get-CommandVersion -Command "python" -Pattern "Python (\d+\.\d+\.\d+)"
$pythonOk = $false
if ($python.Found) {
    $pythonOk = Test-MinVersion -Current $python.Version -Minimum "3.9.0"
    if ($pythonOk) {
        Write-Check -Name "Python 3.9+" -Passed $true -Details "v$($python.Version)"
    } else {
        Write-Check -Name "Python 3.9+" -Passed $false `
            -Details "v$($python.Version) (too old)" `
            -FixHint "Upgrade to Python 3.9+: winget install Python.Python.3.12"
    }
} else {
    Write-Check -Name "Python 3.9+" -Passed $false `
        -FixHint "Install from https://python.org/ or run: winget install Python.Python.3.12"
}

# pip
$pip = Get-CommandVersion -Command "pip" -Pattern "pip (\d+\.\d+)"
if ($pip.Found) {
    Write-Check -Name "pip" -Passed $true -Details "v$($pip.Version)"
} else {
    Write-Check -Name "pip" -Passed $false `
        -FixHint "Usually installed with Python. Try: python -m ensurepip --upgrade"
}

# ═══════════════════════════════════════════════════════════════════════════════
# Node.js Environment
# ═══════════════════════════════════════════════════════════════════════════════

Write-Host ""
Write-Host "── Node.js Environment ──────────────────────────────────────────" -ForegroundColor White

# Node.js
$node = Get-CommandVersion -Command "node" -Pattern "v(\d+\.\d+\.\d+)"
$nodeOk = $false
if ($node.Found) {
    $nodeOk = Test-MinVersion -Current $node.Version -Minimum "18.0.0"
    if ($nodeOk) {
        Write-Check -Name "Node.js 18+" -Passed $true -Details "v$($node.Version)"
    } else {
        Write-Check -Name "Node.js 18+" -Passed $false `
            -Details "v$($node.Version) (too old)" `
            -FixHint "Upgrade to Node.js 18+: winget install OpenJS.NodeJS.LTS"
    }
} else {
    Write-Check -Name "Node.js 18+" -Passed $false `
        -FixHint "Install from https://nodejs.org/ or run: winget install OpenJS.NodeJS.LTS"
}

# npm
$npm = Get-CommandVersion -Command "npm" -Pattern "(\d+\.\d+\.\d+)"
if ($npm.Found) {
    Write-Check -Name "npm" -Passed $true -Details "v$($npm.Version)"
} else {
    Write-Check -Name "npm" -Passed $false `
        -FixHint "Usually installed with Node.js"
}

# ═══════════════════════════════════════════════════════════════════════════════
# Optional: VS Code
# ═══════════════════════════════════════════════════════════════════════════════

Write-Host ""
Write-Host "── Development Tools (Optional) ─────────────────────────────────" -ForegroundColor White

# VS Code
$code = Get-CommandVersion -Command "code" -Pattern "(\d+\.\d+\.\d+)"
if ($code.Found) {
    Write-Check -Name "VS Code" -Passed $true -Details "v$($code.Version)" -Required $false
} else {
    Write-Check -Name "VS Code" -Passed $false -Required $false `
        -FixHint "Install from https://code.visualstudio.com/ or run: winget install Microsoft.VisualStudioCode"
}

# ═══════════════════════════════════════════════════════════════════════════════
# Python Development Packages
# ═══════════════════════════════════════════════════════════════════════════════

if (-not $SkipPythonPackages -and $pythonOk) {
    Write-Host ""
    Write-Host "── Python Dev Packages ──────────────────────────────────────────" -ForegroundColor White
    
    $devPackages = @(
        @{ Name = "pytest"; Import = "pytest" }
        @{ Name = "black"; Import = "black" }
        @{ Name = "flake8"; Import = "flake8" }
        @{ Name = "mypy"; Import = "mypy" }
        @{ Name = "pre-commit"; Import = "pre_commit" }
        @{ Name = "isort"; Import = "isort" }
        @{ Name = "pygls"; Import = "pygls" }
        @{ Name = "pyyaml"; Import = "yaml" }
    )
    
    $missingPackages = @()
    
    foreach ($pkg in $devPackages) {
        $installed = Test-PipPackage -PackageName $pkg.Name
        if ($installed) {
            if ($Detailed) {
                Write-Check -Name $pkg.Name -Passed $true -Required $false
            }
        } else {
            $missingPackages += $pkg.Name
            if ($Detailed) {
                Write-Check -Name $pkg.Name -Passed $false -Required $false
            }
        }
    }
    
    if (-not $Detailed) {
        $installedCount = $devPackages.Count - $missingPackages.Count
        if ($missingPackages.Count -eq 0) {
            Write-Check -Name "Python dev packages" -Passed $true `
                -Details "$installedCount/$($devPackages.Count) installed" -Required $false
        } else {
            Write-Check -Name "Python dev packages" -Passed $false -Required $false `
                -Details "$installedCount/$($devPackages.Count) installed" `
                -FixHint "Run: pip install -e '.[dev]' in pychivalry root"
        }
    } elseif ($missingPackages.Count -gt 0) {
        Write-Host "       Hint: pip install $($missingPackages -join ' ')" -ForegroundColor Yellow
    }
}

# ═══════════════════════════════════════════════════════════════════════════════
# Project-Specific Checks
# ═══════════════════════════════════════════════════════════════════════════════

Write-Host ""
Write-Host "── Project Setup ────────────────────────────────────────────────" -ForegroundColor White

# Check if pychivalry is installed
$pychivalryInstalled = Test-PipPackage -PackageName "pychivalry"
if ($pychivalryInstalled) {
    Write-Check -Name "pychivalry package" -Passed $true -Required $false
} else {
    Write-Check -Name "pychivalry package" -Passed $false -Required $false `
        -FixHint "Run: pip install -e '.[dev]' in pychivalry root"
}

# Check if vscode-extension node_modules exist
$nodeModulesPath = Join-Path $PSScriptRoot "..\vscode-extension\node_modules"
if (Test-Path $nodeModulesPath) {
    Write-Check -Name "VS Code extension deps" -Passed $true -Required $false
} else {
    Write-Check -Name "VS Code extension deps" -Passed $false -Required $false `
        -FixHint "Run: npm install in vscode-extension folder"
}

# ═══════════════════════════════════════════════════════════════════════════════
# Summary
# ═══════════════════════════════════════════════════════════════════════════════

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan

$requiredPassed = ($script:results | Where-Object { $_.Required -and $_.Passed }).Count
$requiredTotal = ($script:results | Where-Object { $_.Required }).Count
$optionalPassed = ($script:results | Where-Object { -not $_.Required -and $_.Passed }).Count
$optionalTotal = ($script:results | Where-Object { -not $_.Required }).Count

if ($script:allPassed) {
    Write-Host " All required tools are installed!" -ForegroundColor Green
    Write-Host " Required: $requiredPassed/$requiredTotal  |  Optional: $optionalPassed/$optionalTotal" -ForegroundColor Gray
} else {
    $failCount = ($script:results | Where-Object { $_.Required -and -not $_.Passed }).Count
    Write-Host " $failCount required tool(s) missing" -ForegroundColor Red
    Write-Host " Required: $requiredPassed/$requiredTotal  |  Optional: $optionalPassed/$optionalTotal" -ForegroundColor Gray
}

# Show warnings
if ($script:warnings.Count -gt 0) {
    Write-Host ""
    Write-Host " Warnings:" -ForegroundColor Yellow
    foreach ($warning in $script:warnings) {
        Write-Host "   - $warning" -ForegroundColor Yellow
    }
}

Write-Host ""

if ($script:allPassed) {
    Write-Host " Next steps:" -ForegroundColor White
    Write-Host "   1. cd to pychivalry root" -ForegroundColor Gray
    Write-Host "   2. pip install -e '.[dev]'" -ForegroundColor Gray
    Write-Host "   3. cd vscode-extension && npm install" -ForegroundColor Gray
    Write-Host "   4. npm run compile" -ForegroundColor Gray
} else {
    Write-Host " To install missing tools:" -ForegroundColor White
    Write-Host "   Run: .\Install-Prerequisites.ps1" -ForegroundColor Gray
    Write-Host ""
    Write-Host " Quick install commands (winget):" -ForegroundColor White
    
    $failedRequired = $script:results | Where-Object { $_.Required -and -not $_.Passed }
    foreach ($item in $failedRequired) {
        switch ($item.Name) {
            "Git" { Write-Host "   winget install Git.Git" -ForegroundColor Gray }
            "GitHub CLI (gh)" { Write-Host "   winget install GitHub.cli" -ForegroundColor Gray }
            "Python 3.9+" { Write-Host "   winget install Python.Python.3.12" -ForegroundColor Gray }
            "pip" { Write-Host "   python -m ensurepip --upgrade" -ForegroundColor Gray }
            "Node.js 18+" { Write-Host "   winget install OpenJS.NodeJS.LTS" -ForegroundColor Gray }
            "npm" { Write-Host "   (Comes with Node.js)" -ForegroundColor Gray }
        }
    }
}

Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Return results for scripting
if ($Detailed) {
    return $script:results
}

exit $(if ($script:allPassed) { 0 } else { 1 })
