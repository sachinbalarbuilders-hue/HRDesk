$sql = ""
for ($i = 151; $i -le 250; $i++) {
    $empId = 9 + $i
    $guid1 = [guid]::NewGuid().ToString()
    $guid2 = [guid]::NewGuid().ToString()
    $phone = "98" + $i.ToString("D8")
    $email = "dummy$i@villeflora.com"
    $name = "Dummy Employee $i"
    $sql += "INSERT INTO Employees (employee_id, organization_id, branch_id, employee_name, phone, joining_date, status, AttendanceType, Gender, WorkEmail, VerificationId, PublicId) VALUES ($empId, 1, 1, '$name', '$phone', '2026-01-01', 'active', 'face', 'Male', '$email', '$guid1', '$guid2');`r`n"
}
$sql | Out-File -FilePath d:\HRDesk\scratch\insert_200_employees.sql -Encoding utf8
sqlcmd -S .\SQLEXPRESS -d HRDeskDb -i d:\HRDesk\scratch\insert_200_employees.sql
