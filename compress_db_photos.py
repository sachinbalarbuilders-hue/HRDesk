import pyodbc
from PIL import Image
import io

def compress_photo(image_bytes, max_size=500):
    try:
        # Load the image from bytes
        img = Image.open(io.BytesIO(image_bytes))
        
        # Convert to RGB (to drop alpha channel if PNG, needed for JPEG save)
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")
            
        # Resize if larger than max_size
        img.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
        
        # Save compressed image
        out_bytes = io.BytesIO()
        img.save(out_bytes, format='JPEG', quality=85, optimize=True)
        return out_bytes.getvalue()
    except Exception as e:
        print(f"Error compressing image: {e}")
        return None

# SQL Server Connection
sql_conn_str = r"Driver={ODBC Driver 17 for SQL Server};Server=.\SQLEXPRESS;Database=biometric_attendance;Trusted_Connection=yes;"
sql_conn = pyodbc.connect(sql_conn_str)
sql_cursor = sql_conn.cursor()

print("Scanning SQL Server for photos larger than 250KB...")
sql_cursor.execute("SELECT employee_id, organization_id, PhotoData, DATALENGTH(PhotoData) as size FROM employees WHERE PhotoData IS NOT NULL")
rows = sql_cursor.fetchall()

total_compressed = 0
total_saved_bytes = 0

for row in rows:
    employee_id = row.employee_id
    org_id = row.organization_id
    photo_data = row.PhotoData
    original_size = row.size
    
    # 250KB threshold (250 * 1024 = 256000 bytes)
    if original_size > 256000:
        print(f"Compressing employee {employee_id}'s photo (Original Size: {original_size / 1024:.2f} KB)...")
        
        compressed_bytes = compress_photo(photo_data)
        if compressed_bytes:
            new_size = len(compressed_bytes)
            saved = original_size - new_size
            total_saved_bytes += saved
            
            print(f"  -> Compressed to {new_size / 1024:.2f} KB (Saved {saved / 1024:.2f} KB)")
            
            update_cursor = sql_conn.cursor()
            update_cursor.execute("""
                UPDATE employees 
                SET PhotoData = ?, PhotoContentType = 'image/jpeg'
                WHERE employee_id = ? AND organization_id = ?
            """, (compressed_bytes, employee_id, org_id))
            
            total_compressed += 1

sql_conn.commit()

print("-" * 50)
print(f"Finished! Compressed {total_compressed} photos.")
print(f"Total Database Space Saved: {total_saved_bytes / (1024 * 1024):.2f} MB")

sql_cursor.close()
sql_conn.close()
