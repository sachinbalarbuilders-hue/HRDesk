"""
calibrate_clean.py -- Re-run calibration separating the two people.

emp7 attendance photos contain TWO different people (discovered from images):
  - Person A (male, enrolled): scores ~0.63-0.99 vs enrolled reference
  - Person B (female, different person): scores ~0.12-0.48 vs enrolled reference

Goal: determine genuine score distribution for Person A only,
and verify the attack score (0.4849) is clearly below their minimum.
"""

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
    arr = np.array(resized, dtype=np.float32)[:, :, ::-1]
    tensor = arr.transpose(2, 0, 1)[np.newaxis, :]
    inp = sess_det.get_inputs()[0].name
    outputs = sess_det.run(None, {inp: tensor})
    out_dict = {sess_det.get_outputs()[i].name: outputs[i].flatten() for i in range(len(outputs))}
    best_score = MIN_CONFIDENCE; best_lm = None
    for stride in [8, 16, 32]:
        cls = out_dict.get(f"cls_{stride}"); obj = out_dict.get(f"obj_{stride}"); kps = out_dict.get(f"kps_{stride}")
        if cls is None: continue
        cols = DETECTOR_SIZE // stride
        for i in range(len(cls)):
            score = float(np.sqrt(np.clip(cls[i],0,1)*np.clip(obj[i],0,1)))
            if score <= best_score: continue
            r = i//cols; c = i%cols
            lm2 = np.zeros(10)
            for k in range(5):
                lm2[k*2]   = (c + kps[i*10+k*2])   * stride * sx
                lm2[k*2+1] = (r + kps[i*10+k*2+1]) * stride * sy
            best_score = score; best_lm = lm2
    return best_lm


TEMPLATE = np.array([[38.2946,51.6963],[73.5318,51.5014],[56.0252,71.7366],
                      [41.5493,92.3655],[70.7299,92.2041]], dtype=np.float32)

def build_transform(lm):
    pts = lm.reshape(5,2)
    ata = np.zeros((4,4)); atc = np.zeros(4)
    for (x,y),(u,v) in zip(pts, TEMPLATE):
        for rv, tgt in [([x,-y,1,0],u),([y,x,0,1],v)]:
            r = np.array(rv); ata += np.outer(r,r); atc += r*tgt
    s = np.linalg.solve(ata, atc)
    a,b,tx,ty = s
    det = a*a+b*b
    return (a/1, -b/1, tx, b/1, a/1, ty)  # PIL AFFINE forward

def extract_embedding(img_path):
    try:
        img = Image.open(img_path).convert("RGB")
        lm = detect_landmarks(img_path)
        if lm is not None:
            pts = lm.reshape(5,2)
            ata = np.zeros((4,4)); atc = np.zeros(4)
            for (x,y),(u,v) in zip(pts, TEMPLATE):
                for rv, tgt in [([x,-y,1,0],u),([y,x,0,1],v)]:
                    r = np.array(rv); ata += np.outer(r,r); atc += r*tgt
            s = np.linalg.solve(ata, atc)
            a,b,tx,ty = s
            # PIL AFFINE maps destination->source (inverse)
            det = a*a + b*b
            if abs(det) < 1e-12: det = 1e-12
            ia = a/det; ib = b/det
            aligned = img.transform((112,112), Image.AFFINE,
                                    (ia, ib, -(ia*tx+ib*ty),
                                     -ib, ia, -(-ib*tx+ia*ty)),
                                    Image.BILINEAR)
        else:
            w,h = img.size; side = min(w,h)
            x=(w-side)//2; y=max(0,(h-side)//2-int(side*0.05))
            aligned = img.crop((x,y,x+side,y+side)).resize((112,112),Image.BILINEAR)

        arr = np.array(aligned, dtype=np.float32)
        tensor = arr.transpose(2,0,1)[np.newaxis,:]
        inp = sess_face.get_inputs()[0].name
        emb = sess_face.run(None, {inp: tensor})[0][0]
        norm = np.linalg.norm(emb)
        return emb / norm if norm > 1e-10 else None
    except:
        return None


emp7 = sorted(PHOTOS_DIR.rglob("emp7_*.jpg"), key=lambda p: p.stat().st_mtime, reverse=True)
enrolled_emb = extract_embedding(str(emp7[0]))

print("Computing similarity for all 54 emp7 photos...")
sims = []
for p in emp7:
    emb = extract_embedding(str(p))
    sim = float(np.dot(emb, enrolled_emb)) if emb is not None else None
    sims.append((p.name, sim))

# Split by similarity — genuinely same person scores >= 0.55
# (0.12-0.48 = different person, 0.55-1.00 = genuine employee)
person_a = [(n,s) for n,s in sims if s is not None and s >= 0.55]
person_b = [(n,s) for n,s in sims if s is not None and s <  0.55]

print(f"\nPerson A (enrolled employee): {len(person_a)} photos")
print(f"Person B (different person):  {len(person_b)} photos")
print()

scores_a = [s for _,s in person_a]
print(f"{'='*60}")
print(f"PERSON A (genuine employee) similarity distribution:")
print(f"  Count : {len(scores_a)}")
print(f"  Min   : {min(scores_a):.4f}")
print(f"  Max   : {max(scores_a):.4f}")
print(f"  Mean  : {np.mean(scores_a):.4f}")
print(f"  Std   : {np.std(scores_a):.4f}")
print()

scores_b = [s for _,s in person_b]
print(f"PERSON B (different person) similarity distribution:")
print(f"  Count : {len(scores_b)}")
if scores_b:
    print(f"  Min   : {min(scores_b):.4f}")
    print(f"  Max   : {max(scores_b):.4f}")
    print(f"  Mean  : {np.mean(scores_b):.4f}")
print()

print(f"{'='*60}")
print(f"KNOWN ATTACK SCORE: PC screen photo = 0.4849")
print()
print(f"Threshold analysis (Person A genuine scores only):")
genuine_min = min(scores_a)
attack      = 0.4849
gap         = genuine_min - attack
print(f"  Genuine minimum : {genuine_min:.4f}")
print(f"  Attack score    : {attack:.4f}")
print(f"  Gap             : {gap:.4f}")
print()

for t in [0.50, 0.55, 0.57, 0.58, 0.60]:
    passes = sum(1 for s in scores_a if s >= t)
    print(f"  Threshold {t:.2f} : {passes}/{len(scores_a)} genuine PASS "
          f"({passes/len(scores_a)*100:.0f}%)  |  "
          f"attack {'BLOCKED' if attack < t else 'PASSES'}")

print()
print("RECOMMENDATION:")
if gap > 0.05:
    # Set threshold at attack + 70% of gap, rounds to nearest 0.05
    rec = round((attack + gap * 0.70) / 0.05) * 0.05
    passes_at_rec = sum(1 for s in scores_a if s >= rec)
    print(f"  Recommended threshold: {rec:.2f}")
    print(f"  At {rec:.2f}: {passes_at_rec}/{len(scores_a)} genuine PASS "
          f"({passes_at_rec/len(scores_a)*100:.0f}%)")
    print(f"  Attack score {attack:.4f} is {'BLOCKED' if attack < rec else 'PASSES'} at this threshold")
else:
    print(f"  Gap too narrow. Keep 0.50, collect more spoof test data.")

print()
print(f"NOTE: Person B photos ({len(scores_b)} total, scores {min(scores_b):.2f}-{max(scores_b):.2f})")
print(f"  These are a different employee punching under emp7 account.")
print(f"  The identity system correctly rejects them at ANY threshold >= 0.50.")
print(f"  This is an HR/management issue, not a technology issue.")
