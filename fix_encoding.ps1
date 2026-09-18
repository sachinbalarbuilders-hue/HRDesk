$files = Get-ChildItem -Path "d:\HRDesk\web-client\src" -Filter "*.tsx" -Recurse

$replacements = @{
    "â€“" = "–"
    "â€¢" = "•"
    "â ³" = "⏳"
    "âœ“" = "✓"
    "âœ•" = "✕"
    "â˜•" = "☕"
    "â”€" = "─"
    "âˆ’" = "−"
    "âš–ï¸ " = "⚖️"
    "âš ï¸ " = "⚠️"
    "âš " = "⚠️"
    "â† " = "←"
    "â†’" = "→"
    "â€¦" = "…"
    "â• " = "═"
}

foreach ($file in $files) {
    $content = Get-Content -Path $file.FullName -Raw -Encoding UTF8
    $modified = $false
    foreach ($key in $replacements.Keys) {
        if ($content -match [regex]::Escape($key)) {
            $content = $content -replace [regex]::Escape($key), $replacements[$key]
            $modified = $true
        }
    }
    if ($modified) {
        [System.IO.File]::WriteAllText($file.FullName, $content, [System.Text.Encoding]::UTF8)
        Write-Host "Fixed encoding in: $($file.Name)"
    }
}
