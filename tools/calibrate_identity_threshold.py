"""
calibrate_identity_threshold.py — Find the right identity threshold.

Tests all available genuine selfies against the enrolled profile photo to build
a distribution of genuine similarity scores. The threshold must sit:
  - ABOVE all spoof/attack scores
  - BELOW all (or nearly all) genuine scores

Attack scores observed:
  PC screen photo: 0.4849

Genuine scores will be measured from all available attendance selfies.
"""

import sys
import numpy as np
from PIL import Image
from pathlib import Path
import onnxruntime as ort

MODELS_DIR = Path(r"D:\HRDesk\HRDesk.Web\App_Data\models")
PHOTOS_DIR = Path(r"D:\HRDesk\HRDesk.Web\wwwroot\attendance_photos")
FACE_RECOG = MODELS_DIR / "face_recognition.onnx"
YUNET      = MODELS_DIR / "face_detection_yunet.onnx"

DETECTOR_SIZE  = 640
MIN_CONFIDENCE = 0.60

sess_face = ort.InferenceSession(str(FACE_RECOG), providers=["CPUExecutionProvider"])
sess_det  = ort.InferenceSession(str(YUNET),      providers=["CPUExecutionProvider"])


def detect_landmarks(img_path):
    img = Image.open(img_path).convert("RGB")
    w, h = img.size
    sx = w / DETECTOR_SIZE; sy = h / DETECTOR_SIZE
    resized = img.resize((DETECTOR_SIZE, DETECTOR_SIZE), Image.BILINEAR)
    arr = np.array(resized, dtype=np.float32)
    bgr = arr[:, :, ::-1]
    tensor = bgr.transpose(2, 0, 1)[np.newaxis, :]
    inp = sess_det.get_inputs()[0].name
    outputs = sess_det.run(None, {inp: tensor})
    out_dict = {sess_det.get_outputs()[i].name: outputs[i].flatten() for i in range(len(outputs))}
    best_score = MIN_CONFIDENCE; best_lm = None
    for stride in [8, 16, 32]:
        cls = out_dict.get(f"cls_{stride}"); obj = out_dict.get(f"obj_{stride}"); kps = out_dict.get(f"kps_{stride}")
        if cls is None: continue
        cols = DETECTOR_SIZE // stride
        for i in range(len(cls)):
            score = float(np.sqrt(np.clip(cls[i],0,1) * np.clip(obj[i],0,1)))
            if score <= best_score: continue
            r = i // cols; c = i % cols
            lm = np.array([(c + kps[i*10+k*2])*stride*sx for k in range(5)] +
                          [(r + kps[i*10+k*2+1])*stride*sy for k in range(5)], dtype=np.float32)
            # reorder to x0,y0,x1,y1,...
            lm2 = np.zeros(10)
            for k in range(5): lm2[k*2] = lm[k]; lm2[k*2+1] = lm[5+k]
            best_score = score; best_lm = lm2
    return best_lm


# ArcFace 5-point canonical template (112x112)
TEMPLATE = np.array([[38.2946, 51.6963], [73.5318, 51.5014], [56.0252, 71.7366],
                      [41.5493, 92.3655], [70.7299, 92.2041]], dtype=np.float32)

def build_transform(lm):
    """Least-squares similarity transform fitting detected landmarks to template."""
    pts = lm.reshape(5, 2)
    ata = np.zeros((4,4)); atc = np.zeros(4)
    for (x, y), (u, v) in zip(pts, TEMPLATE):
        for row_v, tgt in [([x,-y,1,0], u), ([y,x,0,1], v)]:
            r = np.array(row_v)
            ata += np.outer(r, r); atc += r * tgt
    s = np.linalg.solve(ata, atc)
    a, b, tx, ty = s
    return np.array([[a, -b, tx], [b, a, ty]], dtype=np.float32)


def extract_embedding(img_path):
    """Extract L2-normalised 128-d ArcFace embedding with YuNet alignment."""
    try:
        img = Image.open(img_path).convert("RGB")
        lm = detect_landmarks(img_path)
        if lm is not None:
            M = build_transform(lm)
            pts = np.array(img, dtype=np.float32)
            # Simple affine warp via manual sampling (PIL doesn't have affine directly)
            # Use PIL with transform tuple (a,b,c,d,e,f) where x'=ax+by+c, y'=dx+ey+f
            a_,b_,c_,d_,e_,f_ = M[0,0], M[0,1], M[0,2], M[1,0], M[1,1], M[1,2]
            # PIL AFFINE coefficients map output->input: use inverse
            det = a_*e_ - b_*d_
            inv_a = e_/det; inv_b = -b_/det; inv_c = (b_*f_ - e_*c_)/det
            inv_d = -d_/det; inv_e = a_/det; inv_f = (d_*c_ - a_*f_)/det
            aligned = img.transform((112,112), Image.AFFINE,
                                    (inv_a, inv_b, inv_c, inv_d, inv_e, inv_f),
                                    Image.BILINEAR)
        else:
            # Fallback: center square crop
            w, h = img.size; side = min(w, h)
            x = (w-side)//2; y = max(0, (h-side)//2 - int(side*0.05))
            aligned = img.crop((x, y, x+side, y+side)).resize((112,112), Image.BILINEAR)

        arr = np.array(aligned, dtype=np.float32)  # raw 0-255
        tensor = arr.transpose(2,0,1)[np.newaxis,:]
        inp = sess_face.get_inputs()[0].name
        emb = sess_face.run(None, {inp: tensor})[0][0]
        norm = np.linalg.norm(emb)
        return emb / norm if norm > 1e-10 else None
    except Exception as e:
        return None


# ── All emp7 selfies ─────────────────────────────────────────────────────────
emp7 = sorted(PHOTOS_DIR.rglob("emp7_*.jpg"), key=lambda p: p.stat().st_mtime, reverse=True)
print(f"Found {len(emp7)} genuine selfies for employee 7")

# Use the most recent selfie as the enrolled reference (proxy for DB profile photo)
enrolled = emp7[0]
print(f"Enrolled reference: {enrolled.name}")
enrolled_emb = extract_embedding(str(enrolled))
if enrolled_emb is None:
    print("ERROR: Could not extract enrolled embedding"); sys.exit(1)

# Run all selfies
print(f"\n{'Selfie':<35} {'Similarity':>10}  {'@0.50':>6} {'@0.55':>6} {'@0.60':>6} {'@0.65':>6}")
print("-" * 75)

similarities = []
for p in emp7:
    emb = extract_embedding(str(p))
    if emb is None:
        print(f"  {p.name:<33} ERROR")
        continue
    sim = float(np.dot(emb, enrolled_emb))
    similarities.append(sim)
    r = [("PASS" if sim >= t else "FAIL") for t in [0.50, 0.55, 0.60, 0.65]]
    print(f"  {p.name:<33} {sim:>10.4f}  {r[0]:>6} {r[1]:>6} {r[2]:>6} {r[3]:>6}")

print()
print("=" * 75)
print(f"SUMMARY  (n={len(similarities)} genuine selfies)")
print(f"  Mean    : {np.mean(similarities):.4f}")
print(f"  Min     : {np.min(similarities):.4f}")
print(f"  Max     : {np.max(similarities):.4f}")
print(f"  Std dev : {np.std(similarities):.4f}")
print()
for threshold in [0.50, 0.55, 0.60, 0.62, 0.65, 0.70]:
    passes = sum(1 for s in similarities if s >= threshold)
    fails  = len(similarities) - passes
    print(f"  Threshold {threshold:.2f}: {passes:>3} PASS / {fails:>3} FAIL  "
          f"(genuine acceptance rate: {passes/len(similarities)*100:.0f}%)")

print()
print("KNOWN ATTACK SCORES:")
print("  PC screen photo (0.4849)  -- was blocked at 0.50")
print()
print("RECOMMENDATION:")
mins = np.min(similarities)
attack = 0.4849
gap = mins - attack
print(f"  Genuine min: {mins:.4f}   Attack: {attack:.4f}   Gap: {gap:.4f}")
if gap > 0.15:
    rec = round(attack + gap * 0.60, 2)
    print(f"  Recommended threshold: {rec:.2f}  (60% of gap above attack score)")
    print(f"  At {rec:.2f}: genuine rejection risk = ",
          f"{sum(1 for s in similarities if s < rec)}/{len(similarities)} selfies")
else:
    print(f"  Gap is narrow ({gap:.4f}). Threshold calibration needs more spoof test data.")
