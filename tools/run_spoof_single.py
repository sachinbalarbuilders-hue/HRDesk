"""
run_spoof_single.py -- Test a specific image against the liveness pipeline.
Reports all intermediate scores.
"""

import sys
import numpy as np
from PIL import Image
from pathlib import Path
import onnxruntime as ort

MODELS_DIR = Path(r"D:\HRDesk\HRDesk.Web\App_Data\models")
PHOTOS_DIR = Path(r"D:\HRDesk\HRDesk.Web\wwwroot\attendance_photos")

SPOOF_V2   = MODELS_DIR / "spoof_v2_2.7_80x80.onnx"
SPOOF_V1SE = MODELS_DIR / "spoof_v1se_4.0_80x80.onnx"
FACE_RECOG = MODELS_DIR / "face_recognition.onnx"

LIVENESS_THRESHOLD = 0.60
IDENTITY_THRESHOLD = 0.50

MIN_DIMENSION  = 80
MIN_BRIGHTNESS = 25.0
MAX_BRIGHTNESS = 240.0
MIN_BLUR_SCORE = 30.0

# The spoof photo to test
SPOOF_PHOTO = r"D:\HRDesk\tools\WhatsApp Image 2026-08-27 at 11.36.31 PM.jpeg"

# Enrolled reference (most recent genuine selfie of employee 7)
emp7 = sorted(PHOTOS_DIR.rglob("emp7_*.jpg"),
              key=lambda p: p.stat().st_mtime, reverse=True)
ENROLLED = str(emp7[0]) if emp7 else None

sess_v2   = ort.InferenceSession(str(SPOOF_V2),   providers=["CPUExecutionProvider"])
sess_v1se = ort.InferenceSession(str(SPOOF_V1SE), providers=["CPUExecutionProvider"])
sess_face = ort.InferenceSession(str(FACE_RECOG), providers=["CPUExecutionProvider"])


def softmax(x):
    e = np.exp(x - x.max())
    return e / e.sum()

def estimate_bbox(w, h):
    bw = int(w * 0.60); bh = int(h * 0.70)
    return ((w - bw) // 2, int(h * 0.05), bw, bh)

def run_spoof_model(session, img_rgb, bbox, scale):
    x, y, bw, bh = bbox
    cx = x + bw//2; cy = y + bh//2
    cs = int(min(bw, bh) * scale)
    x0 = max(0, cx-cs//2); y0 = max(0, cy-cs//2)
    x1 = min(img_rgb.shape[1], x0+cs); y1 = min(img_rgb.shape[0], y0+cs)
    crop = img_rgb[y0:y1, x0:x1]
    pil  = Image.fromarray(crop, "RGB").resize((80, 80), Image.BILINEAR)
    arr  = np.array(pil, dtype=np.float32) / 255.0
    tensor = arr.transpose(2, 0, 1)[np.newaxis, :]
    inp = session.get_inputs()[0].name
    logits = session.run(None, {inp: tensor})[0][0]
    probs  = softmax(logits)
    return probs, float(probs[2])   # all probs + live score at index 2

def extract_embedding(img_path):
    img = Image.open(img_path).convert("RGB").resize((112, 112), Image.BILINEAR)
    arr = np.array(img, dtype=np.float32)
    tensor = arr.transpose(2, 0, 1)[np.newaxis, :]
    inp = sess_face.get_inputs()[0].name
    emb = sess_face.run(None, {inp: tensor})[0][0]
    norm = np.linalg.norm(emb)
    return emb / norm if norm > 1e-10 else None


SEP = "=" * 72
print(SEP)
print("  SPOOF ATTACK TEST: PC/Laptop Screen Photo")
print(f"  Image : {SPOOF_PHOTO}")
print(f"  Enrolled: {ENROLLED}")
print(SEP)

# ── Open and inspect image ──────────────────────────────────────────────────
img = Image.open(SPOOF_PHOTO).convert("RGB")
rgb = np.array(img)
print(f"\n  Image size : {img.width} x {img.height} px")

# ── Quality ─────────────────────────────────────────────────────────────────
small = np.array(img.resize((64, 64)), dtype=np.float32)
luma  = (0.299*small[:,:,0] + 0.587*small[:,:,1] + 0.114*small[:,:,2]).mean()
gray128 = np.array(img.convert("L").resize((128, 128)), dtype=np.float32)
lap  = (-4*gray128[1:-1,1:-1]
        + gray128[0:-2,1:-1] + gray128[2:,1:-1]
        + gray128[1:-1,0:-2] + gray128[1:-1,2:])
blur = float((lap**2).mean() - lap.mean()**2)

q_ok = (img.width >= MIN_DIMENSION and img.height >= MIN_DIMENSION
        and MIN_BRIGHTNESS <= luma <= MAX_BRIGHTNESS
        and blur >= MIN_BLUR_SCORE)

print(f"\n  QUALITY:")
print(f"    Image size    : {img.width}x{img.height}  (min {MIN_DIMENSION}x{MIN_DIMENSION})")
print(f"    Luma          : {luma:.1f}  (range {MIN_BRIGHTNESS}-{MAX_BRIGHTNESS})")
print(f"    Blur score    : {blur:.1f}  (min {MIN_BLUR_SCORE})")
print(f"    PASS          : {q_ok}")

if not q_ok:
    print(f"\n  LIVENESS : SKIPPED (quality blocked)")
    print(f"  IDENTITY : SKIPPED")
    print(f"\n  FINAL    : BLOCKED (quality)")
    sys.exit(0)

# ── Liveness — show ALL three class probabilities ──────────────────────────
bbox = estimate_bbox(img.width, img.height)
probs_v2,   lv_v2   = run_spoof_model(sess_v2,   rgb, bbox, 2.7)
probs_v1se, lv_v1se = run_spoof_model(sess_v1se, rgb, bbox, 4.0)
fused   = (lv_v2 + lv_v1se) / 2.0
lv_pass = fused >= LIVENESS_THRESHOLD

print(f"\n  LIVENESS (class 2 = live, confirmed empirically):")
print(f"    V2   all probs : [{probs_v2[0]:.4f}, {probs_v2[1]:.4f}, {probs_v2[2]:.4f}]")
print(f"    V1SE all probs : [{probs_v1se[0]:.4f}, {probs_v1se[1]:.4f}, {probs_v1se[2]:.4f}]")
print(f"    V2   live score (idx2) : {lv_v2:.4f}")
print(f"    V1SE live score (idx2) : {lv_v1se:.4f}")
print(f"    Fused live score       : {fused:.4f}")
print(f"    Threshold              : {LIVENESS_THRESHOLD:.2f}")
print(f"    PASS                   : {lv_pass}")

if not lv_pass:
    margin = LIVENESS_THRESHOLD - fused
    print(f"    Margin below threshold : {margin:.4f}")
    print(f"\n  IDENTITY : SKIPPED (liveness blocked)")
    print(f"\n  FINAL    : BLOCKED (liveness FAIL) -- attack REJECTED")
    sys.exit(0)

# ── Identity (only reached if liveness passes) ─────────────────────────────
print(f"\n  IDENTITY:")
if ENROLLED:
    ep = extract_embedding(SPOOF_PHOTO)
    ee = extract_embedding(ENROLLED)
    if ep is not None and ee is not None:
        sim = float(np.dot(ep, ee))
        id_pass = sim >= IDENTITY_THRESHOLD
        print(f"    Similarity : {sim:.4f}")
        print(f"    Threshold  : {IDENTITY_THRESHOLD:.2f}")
        print(f"    PASS       : {id_pass}")
        final = id_pass
    else:
        print(f"    ERROR: embedding extraction failed")
        final = False
else:
    print(f"    SKIPPED (no enrolled photo found)")
    final = False

if final:
    print(f"\n  FINAL    : ATTENDANCE ALLOWED  <-- CONCERN: spoof passed liveness")
else:
    if not lv_pass:
        print(f"\n  FINAL    : BLOCKED (liveness FAIL)")
    else:
        print(f"\n  FINAL    : BLOCKED (identity FAIL)")
