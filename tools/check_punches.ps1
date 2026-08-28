$cs = "Server=sql5110.site4now.net;Database=db_acda8f_hrdeskhrms;User Id=db_acda8f_hrdeskhrms_admin;Password=Man_yooooh199#;TrustServerCertificate=True"
# First get actual column names
$dt1 = New-Object System.Data.DataTable
(New-Object System.Data.SqlClient.SqlDataAdapter("SELECT TOP 1 * FROM attendance_logs", $cs)).Fill($dt1) | Out-Null
Write-Host "Columns: $($dt1.Columns.ColumnName -join ', ')"
# Then get recent records
$dt2 = New-Object System.Data.DataTable
(New-Object System.Data.SqlClient.SqlDataAdapter("SELECT TOP 10 * FROM attendance_logs ORDER BY id DESC", $cs)).Fill($dt2) | Out-Null
$dt2 | Select-Object id, employee_id, punch_time, verify_type, photo_url | Format-Table -AutoSize
