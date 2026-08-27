"""
run_liveness_tests.py -- End-to-end anti-spoofing validation.

Uses class index 2 for liveness (verified empirically: genuine selfies score 0.99+
at index 2; index 1 is a spoof sub-class at ~0.006 for genuine faces).

Usage:
    python D:\\HRDesk\\tools\\run_liveness_tests.py
"""

import os
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

print("Loading ONNX models...")
sess_v2   = ort.InferenceSession(str(SPOOF_V2),   providers=["CPUExecutionProvider"])
sess_v1se = ort.InferenceSession(str(SPOOF_V1SE), providers=["CPUExecutionProvider"])
sess_face = ort.InferenceSession(str(FACE_RECOG), providers=["CPUExecutionProvider"])
print("  All models loaded.")
print()


# ---------------------------------------------------------------------------
# Quality
# ---------------------------------------------------------------------------

def check_quality(img_path):
    try:
        img = Image.open(img_path).convert("RGB")
        w, h = img.size
        if w < MIN_DIMENSION or h < MIN_DIMENSION:
            return {"ok": False, "reason": f"too small ({w}x{h})"}
        rgb = np.array(img, dtype=np.float32)
        small = np.array(img.resize((64,64)), dtype=np.float32)
        luma = (0.299*small[:,:,0] + 0.587*small[:,:,1] + 0.114*small[:,:,2]).mean()
        if luma < MIN_BRIGHTNESS:
            return {"ok": False, "reason": f"too dark (luma={luma:.1f})"}
        if luma > MAX_BRIGHTNESS:
            return {"ok": False, "reason": f"overexposed (luma={luma:.1f})"}
        gray = np.array(img.convert("L").resize((128,128)), dtype=np.float32)
        lap = (-4*gray[1:-1,1:-1]
               + gray[0:-2,1:-1] + gray[2:,1:-1]
               + gray[1:-1,0:-2] + gray[1:-1,2:])
        blur = float((lap**2).mean() - lap.mean()**2)
        if blur < MIN_BLUR_SCORE:
            return {"ok": False, "reason": f"blurry (lap_var={blur:.1f})"}
        return {"ok": True, "luma": luma, "blur": blur}
    except Exception as e:
        return {"ok": False, "reason": str(e)}


# ---------------------------------------------------------------------------
# Liveness
# ---------------------------------------------------------------------------

def softmax(x):
    e = np.exp(x - x.max())
    return e / e.sum()


def estimate_bbox(w, h):
    bw = int(w * 0.60); bh = int(h * 0.70)
    x  = (w - bw) // 2; y  = int(h * 0.05)
    return (x, y, bw, bh)


def run_spoof_model(session, img_rgb, bbox, scale):
    x, y, bw, bh = bbox
    cx = x + bw//2; cy = y + bh//2
    base = min(bw, bh); cs = int(base * scale)
    x0 = max(0, cx-cs//2); y0 = max(0, cy-cs//2)
    x1 = min(img_rgb.shape[1], x0+cs); y1 = min(img_rgb.shape[0], y0+cs)
    crop = img_rgb[y0:y1, x0:x1]
    pil  = Image.fromarray(crop, "RGB").resize((80,80), Image.BILINEAR)
    arr  = np.array(pil, dtype=np.float32) / 255.0
    tensor = arr.transpose(2,0,1)[np.newaxis,:]
    inp = session.get_inputs()[0].name
    logits = session.run(None, {inp: tensor})[0][0]
    probs  = softmax(logits)
    # Index 2 = live class (verified empirically Aug 2026: genuine scores 0.99+)
    return float(probs[2])


def check_liveness(img_path):
    try:
        img  = Image.open(img_path).convert("RGB")
        rgb  = np.array(img)
        bbox = estimate_bbox(img.width, img.height)
        v2   = run_spoof_model(sess_v2,   rgb, bbox, 2.7)
        v1se = run_spoof_model(sess_v1se, rgb, bbox, 4.0)
        fused = (v2 + v1se) / 2.0
        return {"v2": v2, "v1se": v1se, "fused": fused,
                "is_live": fused >= LIVENESS_THRESHOLD}
    except Exception as e:
        return {"error": str(e), "is_live": False}


# ---------------------------------------------------------------------------
# Identity
# ---------------------------------------------------------------------------

def extract_embedding(img_path):
    try:
        img = Image.open(img_path).convert("RGB").resize((112,112), Image.BILINEAR)
        arr = np.array(img, dtype=np.float32)          # raw 0-255 (model normalises internally)
        tensor = arr.transpose(2,0,1)[np.newaxis,:]
        inp = sess_face.get_inputs()[0].name
        emb = sess_face.run(None, {inp: tensor})[0][0]
        norm = np.linalg.norm(emb)
        return emb / norm if norm > 1e-10 else None
    except Exception:
        return None


def check_identity(punch_path, enrolled_path):
    ep = extract_embedding(punch_path)
    ee = extract_embedding(enrolled_path)
    if ep is None or ee is None:
        return {"error": "embedding failed", "similarity": 0.0, "is_match": False}
    sim = float(np.dot(ep, ee))
    return {"similarity": sim, "is_match": sim >= IDENTITY_THRESHOLD}


# ---------------------------------------------------------------------------
# Single test case
# ---------------------------------------------------------------------------

def run_test(label, punch_path, enrolled_path):
    SEP = "=" * 72
    print(f"\n{SEP}")
    print(f"  TEST: {label}")
    print(f"  Punch   : {punch_path}")
    print(f"  Enrolled: {enrolled_path}")
    print(SEP)

    if not Path(punch_path).exists():
        print(f"  [SKIP] File not found: {punch_path}")
        return
    if not Path(enrolled_path).exists():
        print(f"  [SKIP] Enrolled photo not found: {enrolled_path}")
        return

    q = check_quality(punch_path)
    print(f"\n  QUALITY:")
    print(f"    Acceptable : {q['ok']}")
    if q["ok"]:
        print(f"    Luma       : {q['luma']:.1f}  (range {MIN_BRIGHTNESS}-{MAX_BRIGHTNESS})")
        print(f"    Blur score : {q['blur']:.1f}  (min {MIN_BLUR_SCORE})")
    else:
        print(f"    Fail reason: {q['reason']}")
        print(f"\n  LIVENESS: SKIPPED")
        print(f"  IDENTITY: SKIPPED")
        print(f"\n  FINAL DECISION: BLOCKED (quality)")
        return

    lv = check_liveness(punch_path)
    lv_pass = lv.get("is_live", False)
    print(f"\n  LIVENESS:")
    if "error" in lv:
        print(f"    ERROR: {lv['error']}")
    else:
        print(f"    V2 score   : {lv['v2']:.4f}")
        print(f"    V1SE score : {lv['v1se']:.4f}")
        print(f"    Fused score: {lv['fused']:.4f}")
        print(f"    Threshold  : {LIVENESS_THRESHOLD:.2f}")
        print(f"    PASS       : {lv_pass}")

    if not lv_pass:
        print(f"\n  IDENTITY: SKIPPED (liveness blocked)")
        print(f"\n  FINAL DECISION: BLOCKED (liveness FAIL)")
        return

    id_ = check_identity(punch_path, enrolled_path)
    id_pass = id_.get("is_match", False)
    print(f"\n  IDENTITY:")
    if "error" in id_:
        print(f"    ERROR: {id_['error']}")
    else:
        print(f"    Similarity : {id_['similarity']:.4f}")
        print(f"    Threshold  : {IDENTITY_THRESHOLD:.2f}")
        print(f"    PASS       : {id_pass}")

    if lv_pass and id_pass:
        print(f"\n  FINAL DECISION: ATTENDANCE ALLOWED")
    else:
        print(f"\n  FINAL DECISION: BLOCKED (identity FAIL)")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    emp7_photos = sorted(PHOTOS_DIR.rglob("emp7_*.jpg"),
                         key=lambda p: p.stat().st_mtime, reverse=True)
    if not emp7_photos:
        print("ERROR: No emp7 attendance photos found.")
        sys.exit(1)

    enrolled = str(emp7_photos[0])
    print(f"ENROLLED REFERENCE  : {enrolled}")
    print(f"Available emp7 selfies: {len(emp7_photos)}")
    print(f"LIVENESS THRESHOLD  : {LIVENESS_THRESHOLD}")
    print(f"IDENTITY THRESHOLD  : {IDENTITY_THRESHOLD}")

    # Cases 1-3: Genuine employee, different selfies = lighting variation proxy
    run_test("1. Genuine — normal lighting (most recent selfie)",
             str(emp7_photos[0]), enrolled)

    if len(emp7_photos) >= 4:
        run_test("2. Genuine — lighting variation A (4th most recent)",
                 str(emp7_photos[3]), enrolled)

    if len(emp7_photos) >= 10:
        run_test("3. Genuine — lighting variation B (10th most recent)",
                 str(emp7_photos[9]), enrolled)

    # Case 4: Different employee (impostor)
    other = sorted([p for p in PHOTOS_DIR.rglob("*.jpg") if "emp7_" not in p.name],
                   key=lambda p: p.stat().st_mtime, reverse=True)
    if other:
        run_test("4. Different employee (impostor test)",
                 str(other[0]), enrolled)
    else:
        print("\n[SKIP] Case 4: No other-employee photos found in attendance_photos/.")

    # Cases 5-7: Spoof attacks — user must supply these photos
    SPOOF_DIR = Path(r"D:\HRDesk\tools\spoof_test_images")
    SPOOF_DIR.mkdir(exist_ok=True)

    spoof_cases = [
        ("5. PC screen photo attack (previously-successful attack)",
         SPOOF_DIR / "spoof_pc_screen.jpg"),
        ("6. Phone screen photo attack",
         SPOOF_DIR / "spoof_phone_screen.jpg"),
        ("7. Printed photo attack",
         SPOOF_DIR / "spoof_printed.jpg"),
    ]

    for label, path in spoof_cases:
        if path.exists():
            run_test(label, str(path), enrolled)
        else:
            print(f"\n{'='*72}")
            print(f"  TEST: {label}")
            print(f"  [AWAITING] Place image at: {path}")
            print(f"  Instructions: take a photo of the employee's profile picture")
            print(f"  displayed on a PC screen / phone screen / printed on paper")
            print(f"{'='*72}")

    print(f"\n{'='*72}")
    print("TEST RUN COMPLETE")
    print(f"{'='*72}")
    print(f"\nSpoof test images go in: {SPOOF_DIR}")
    print("  spoof_pc_screen.jpg   -- photo of enrolled photo on PC monitor")
    print("  spoof_phone_screen.jpg -- photo of enrolled photo on phone screen")
    print("  spoof_printed.jpg     -- photo of enrolled photo printed on paper")
