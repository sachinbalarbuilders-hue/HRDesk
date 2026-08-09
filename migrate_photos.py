import mysql.connector
import pyodbc

# MariaDB Connection
mariadb_conn = mysql.connector.connect(
    host="localhost",
    user="root",
    password="",
    database="biometric_attendance"
)
mariadb_cursor = mariadb_conn.cursor()

# SQL Server Connection
sql_conn_str = r"Driver={ODBC Driver 17 for SQL Server};Server=.\SQLEXPRESS;Database=biometric_attendance;Trusted_Connection=yes;"
sql_conn = pyodbc.connect(sql_conn_str)
sql_cursor = sql_conn.cursor()

print("Fetching photos from MariaDB...")
mariadb_cursor.execute("SELECT employee_id, organization_id, PhotoData, PhotoContentType FROM employees WHERE PhotoData IS NOT NULL")
rows = mariadb_cursor.fetchall()
print(f"Found {len(rows)} photos to migrate.")

migrated_count = 0
for row in rows:
    employee_id = row[0]
    org_id = row[1]
    photo_data = row[2]
    content_type = row[3]
    
    # Update SQL Server
    sql_cursor.execute("""
        UPDATE employees 
        SET PhotoData = ?, PhotoContentType = ? 
        WHERE employee_id = ? AND organization_id = ?
    """, (photo_data, content_type, employee_id, org_id))
    
    migrated_count += sql_cursor.rowcount

sql_conn.commit()
print(f"Successfully migrated {migrated_count} photos to SQL Server.")

mariadb_cursor.close()
mariadb_conn.close()
sql_cursor.close()
sql_conn.close()
