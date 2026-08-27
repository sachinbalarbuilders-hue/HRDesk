import numpy as np
from PIL import Image
from pathlib import Path

PHOTOS_DIR = Path(r"D:\HRDesk\HRDesk.Web\wwwroot\attendance_photos")
emp7 = sorted(PHOTOS_DIR.rglob("emp7_*.jpg"), key=lambda p: p.stat().st_mtime, reverse=True)
spoof = Path(r"D:\HRDesk\tools\WhatsApp Image 2026-08-27 at 11.36.31 PM.jpeg")

print("Spoof image (laptop screen photo):")
img = Image.open(str(spoof)).convert("RGB")
rgb = np.array(img, dtype=np.float32)
print(f"  Size        : {img.width}x{img.height}")
print(f"  Mean R/G/B  : {rgb[:,:,0].mean():.1f} / {rgb[:,:,1].mean():.1f} / {rgb[:,:,2].mean():.1f}")
gray = np.array(img.convert("L").resize((256,256)), dtype=np.float32)
lap = -4*gray[1:-1,1:-1] + gray[0:-2,1:-1] + gray[2:,1:-1] + gray[1:-1,0:-2] + gray[1:-1,2:]
print(f"  Blur (lap var 256px): {(lap**2).mean() - lap.mean()**2:.1f}")
print(f"  Note: face fills frame, grey background, slight screen blur visible")
print()

print("Genuine selfie (real person, camera selfie):")
img2 = Image.open(str(emp7[0])).convert("RGB")
rgb2 = np.array(img2, dtype=np.float32)
print(f"  Size        : {img2.width}x{img2.height}")
print(f"  Mean R/G/B  : {rgb2[:,:,0].mean():.1f} / {rgb2[:,:,1].mean():.1f} / {rgb2[:,:,2].mean():.1f}")
gray2 = np.array(img2.convert("L").resize((256,256)), dtype=np.float32)
lap2 = -4*gray2[1:-1,1:-1] + gray2[0:-2,1:-1] + gray2[2:,1:-1] + gray2[1:-1,0:-2] + gray2[1:-1,2:]
print(f"  Blur (lap var 256px): {(lap2**2).mean() - lap2.mean()**2:.1f}")
print()
print("Key observation:")
print("  The spoof photo was taken VERY close to the laptop screen - the face")
print("  fills the entire frame with no screen border visible. This means:")
print("  - No screen reflection/glare artifacts in the crop region")
print("  - No screen bezel visible to provide spatial context")
print("  - The image content is nearly identical to the original profile photo")
print("  - MiniFASNet cannot detect this attack without a face detector providing")
print("    correct scale crops AND without moiré/reflection being visible in the crop")
