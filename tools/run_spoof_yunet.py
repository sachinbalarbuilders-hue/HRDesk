"""
run_spoof_yunet.py -- Re-run the PC-screen photo attack test using the same
YuNet-detected bounding box that FaceAntiSpoofingService now uses.

This validates whether the YuNet integration actually helps detect the attack.
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
YUNET      = MODELS_DIR / "face_detection_yunet.onnx"
FACE_RECOG = MODELS_DIR / "face_recognition.onnx"

LIVENESS_THRESHOLD = 0.60
IDENTITY_THRESHOLD = 0.50
DETECTOR_SIZE      = 640
MIN_CONFIDENCE     = 0.60

SPOOF_PHOTO = r"D:\HRDesk\tools\WhatsApp Image 2026-08-27 at 11.36.31 PM.jpeg"
emp7 = sorted(PHOTOS_DIR.rglob("emp7_*.jpg"), key=lambda p: p.stat().st_mtime, reverse=True)
ENROLLED = str(emp7[0]) if emp7 else None

sess_v2   = ort.InferenceSession(str(SPOOF_V2),   providers=["CPUExecutionProvider"])
sess_v1se = ort.InferenceSession(str(SPOOF_V1SE), providers=["CPUExecutionProvider"])
sess_det  = ort.InferenceSession(str(YUNET),      providers=["CPUExecutionProvider"])
sess_face = ort.InferenceSession(str(FACE_RECOG), providers=["CPUExecutionProvider"])


def softmax(x):
    e = np.exp(x - x.max())
    return e / e.sum()


def detect_face_bbox(img_path):
    """Mirrors FaceRecognitionService.DetectFaceBoundingBox + DetectFaceLandmarks."""
    img = Image.open(img_path).convert("RGB")
    w, h = img.size
    sx = w / DETECTOR_SIZE
    sy = h / DETECTOR_SIZE

    # Stretch resize to 640x640, BGR channel order
    resized = img.resize((DETECTOR_SIZE, DETECTOR_SIZE), Image.BILINEAR)
    arr = np.array(resized, dtype=np.float32)
    bgr = arr[:, :, ::-1]  # RGB -> BGR
    tensor = bgr.transpose(2, 0, 1)[np.newaxis, :]  # NCHW

    inp = sess_det.get_inputs()[0].name
    outputs = sess_det.run(None, {inp: tensor})
    out_dict = {sess_det.get_outputs()[i].name: outputs[i].flatten()
                for i in range(len(outputs))}

    best_score = MIN_CONFIDENCE
    best_lm = None

    for stride in [8, 16, 32]:
        cls = out_dict.get(f"cls_{stride}")
        obj = out_dict.get(f"obj_{stride}")
        kps = out_dict.get(f"kps_{stride}")
        if cls is None or obj is None or kps is None:
            continue
        cols = DETECTOR_SIZE // stride
        n = len(cls)
        for i in range(n):
            score = float(np.sqrt(np.clip(cls[i], 0, 1) * np.clip(obj[i], 0, 1)))
            if score <= best_score:
                continue
            r = i // cols; c = i % cols
            lm = np.zeros(10, dtype=np.float32)
            for k in range(5):
                lm[k*2]   = (c + kps[i*10 + k*2])   * stride * sx
                lm[k*2+1] = (r + kps[i*10 + k*2+1]) * stride * sy
            best_score = score
            best_lm = lm

    if best_lm is None:
        return None, None, best_score

    # Compute bbox from landmarks with 40% padding (mirrors C# DetectFaceBoundingBox)
    xs = best_lm[0::2]; ys = best_lm[1::2]
    min_x, max_x = xs.min(), xs.max()
    min_y, max_y = ys.min(), ys.max()
    lw = max_x - min_x; lh = max_y - min_y
    side = max(lw, lh)
    pad  = side * 0.40
    cx   = (min_x + max_x) / 2
    cy   = (min_y + max_y) / 2

    bx  = int(max(0,  cx - side/2 - pad))
    by  = int(max(0,  cy - side/2 - pad * 1.2))
    bx2 = int(min(w,  cx + side/2 + pad))
    by2 = int(min(h,  cy + side/2 + pad))
    bw  = bx2 - bx
    bh  = by2 - by

    if bw < 20 or bh < 20:
        return None, None, best_score

    return (bx, by, bw, bh), best_lm, best_score


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
    return probs, float(probs[2])


def estimate_bbox_heuristic(w, h):
    bw = int(w * 0.60); bh = int(h * 0.70)
    return ((w-bw)//2, int(h*0.05), bw, bh)


def extract_embedding(img_path):
    img = Image.open(img_path).convert("RGB").resize((112, 112), Image.BILINEAR)
    arr = np.array(img, dtype=np.float32)
    tensor = arr.transpose(2, 0, 1)[np.newaxis, :]
    inp = sess_face.get_inputs()[0].name
    emb = sess_face.run(None, {inp: tensor})[0][0]
    norm = np.linalg.norm(emb)
    return emb / norm if norm > 1e-10 else None


def test_image(label, img_path, enrolled_path):
    SEP = "=" * 72
    print(f"\n{SEP}")
    print(f"  {label}")
    print(f"  Image: {img_path}")
    print(SEP)

    img = Image.open(img_path).convert("RGB")
    rgb = np.array(img)
    print(f"\n  Size: {img.width}x{img.height}")

    # YuNet detection
    bbox, landmarks, det_score = detect_face_bbox(img_path)
    if bbox is not None:
        print(f"\n  YuNet detection:")
        print(f"    Score : {det_score:.4f}")
        print(f"    BBox  : x={bbox[0]} y={bbox[1]} w={bbox[2]} h={bbox[3]}")
        if landmarks is not None:
            print(f"    Landmarks (5 pts): {['({:.0f},{:.0f})'.format(landmarks[k*2], landmarks[k*2+1]) for k in range(5)]}")
        using_bbox = bbox
        bbox_source = "YuNet"
    else:
        using_bbox = estimate_bbox_heuristic(img.width, img.height)
        bbox_source = "Heuristic fallback (no face detected)"
        print(f"\n  YuNet: No face detected (score={det_score:.4f})")
        print(f"  Heuristic bbox: x={using_bbox[0]} y={using_bbox[1]} w={using_bbox[2]} h={using_bbox[3]}")

    print(f"\n  Bbox source: {bbox_source}")

    # Liveness with both bbox methods for comparison
    probs_v2_y, lv_v2_y     = run_spoof_model(sess_v2,   rgb, using_bbox, 2.7)
    probs_v1se_y, lv_v1se_y = run_spoof_model(sess_v1se, rgb, using_bbox, 4.0)
    fused_y = (lv_v2_y + lv_v1se_y) / 2.0

    print(f"\n  LIVENESS ({bbox_source}):")
    print(f"    V2   probs: [{probs_v2_y[0]:.4f}, {probs_v2_y[1]:.4f}, {probs_v2_y[2]:.4f}]")
    print(f"    V1SE probs: [{probs_v1se_y[0]:.4f}, {probs_v1se_y[1]:.4f}, {probs_v1se_y[2]:.4f}]")
    print(f"    V2   live score : {lv_v2_y:.4f}")
    print(f"    V1SE live score : {lv_v1se_y:.4f}")
    print(f"    Fused           : {fused_y:.4f}")
    print(f"    Threshold       : {LIVENESS_THRESHOLD:.2f}")
    lv_pass = fused_y >= LIVENESS_THRESHOLD
    print(f"    PASS            : {lv_pass}")

    # Also show heuristic for comparison if YuNet was used
    if bbox is not None:
        h_bbox = estimate_bbox_heuristic(img.width, img.height)
        _, lv_v2_h    = run_spoof_model(sess_v2,   rgb, h_bbox, 2.7)
        _, lv_v1se_h  = run_spoof_model(sess_v1se, rgb, h_bbox, 4.0)
        fused_h = (lv_v2_h + lv_v1se_h) / 2.0
        print(f"\n  LIVENESS (heuristic bbox for comparison):")
        print(f"    Fused: {fused_h:.4f}  PASS: {fused_h >= LIVENESS_THRESHOLD}")

    # Identity
    print(f"\n  IDENTITY:")
    ep = extract_embedding(img_path)
    ee = extract_embedding(enrolled_path) if enrolled_path else None
    if ep is not None and ee is not None:
        sim = float(np.dot(ep, ee))
        id_pass = sim >= IDENTITY_THRESHOLD
        print(f"    Similarity : {sim:.4f}")
        print(f"    Threshold  : {IDENTITY_THRESHOLD:.2f}")
        print(f"    PASS       : {id_pass}")
    else:
        print(f"    ERROR: embedding failed")
        id_pass = False

    if lv_pass and id_pass:
        print(f"\n  FINAL: ATTENDANCE ALLOWED  <-- CONCERN: spoof passed")
    elif not lv_pass:
        print(f"\n  FINAL: BLOCKED (liveness FAIL)  -- attack REJECTED")
    else:
        print(f"\n  FINAL: BLOCKED (identity FAIL)")


# ── Run tests ──────────────────────────────────────────────────────────────
print("Testing with YuNet-detected bounding box")
print(f"LIVENESS_THRESHOLD={LIVENESS_THRESHOLD}  IDENTITY_THRESHOLD={IDENTITY_THRESHOLD}")

# Test 1: Genuine employee with YuNet
test_image("GENUINE EMPLOYEE (YuNet bbox)", str(emp7[0]), ENROLLED)

# Test 2: PC screen attack with YuNet
test_image("PC SCREEN PHOTO ATTACK (YuNet bbox)", SPOOF_PHOTO, ENROLLED)

# Test 3: A second genuine selfie (different date)
if len(emp7) >= 5:
    test_image("GENUINE (different day, lighting variation)", str(emp7[4]), ENROLLED)
