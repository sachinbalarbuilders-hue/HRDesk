using System;
using Microsoft.Data.SqlClient;

var hash = BCrypt.Net.BCrypt.HashPassword("password", 12);
Console.WriteLine($"Hash: {hash}");

var connStr = "Server=.\\SQLEXPRESS;Database=biometric_attendance;Trusted_Connection=True;TrustServerCertificate=True;";
using var conn = new SqlConnection(connStr);
conn.Open();
using var cmd = new SqlCommand("UPDATE users SET password_hash = @h WHERE username = 'admin'", conn);
cmd.Parameters.AddWithValue("@h", hash);
int rows = cmd.ExecuteNonQuery();
Console.WriteLine($"Updated {rows} user(s). Admin password is now: password");
