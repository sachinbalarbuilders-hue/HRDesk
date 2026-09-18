$files = Get-ChildItem -Path d:\HRDesk\web-client\src\pages\*.tsx
foreach ($f in $files) {
    $content = Get-Content $f.FullName -Raw
    $newContent = $content -replace 'const \[pageSize, setPageSize\] = useState\((\d+)\);', "const defaultPageSize = Number(localStorage.getItem('hrdesk_default_page_size')) || `$1;`r`n  const [pageSize, setPageSize] = useState(defaultPageSize);"
    
    if ($content -ne $newContent) {
        $newContent | Set-Content $f.FullName -Encoding UTF8
        Write-Host "Updated $($f.Name)"
    }
}
