"""
verify_class2.py — Confirm class 2 = live by checking the original repo source code
and running all available genuine selfies to measure the distribution.
"""

import sys
from pathlib import Path
import numpy as np
from PIL import Image
import onnxruntime as ort

sys.path.insert(0, r'D:\SilentFace')

# ── Check the original anti_spoof_predict.py source ──────────────────────
print("=== ORIGINAL REPO anti_spoof_predict.py ANALYSIS ===")
try:
    src = Path(r'D:\SilentFace\src\anti_spoof_predict.py').read_text()
    # Find the label/prediction logic
    for line in src.splitlines():
        if 'label' in line.lower() or 'fake' in line.lower() or 'real' in line.lower() or 'prediction' in line.lower():
            print(f"  {line}")
except Exception as e:
    print(f"Could not read: {e}")

print()

# ── Check test.py to see exactly how scores are used ─────────────────────
print("=== ORIGINAL REPO test.py SCORE FUSION LOGIC ===")
try:
    src = Path(r'D:\SilentFace\test.py').read_text()
    lines = src.splitlines()
    in_block = False
    for i, line in enumerate(lines):
        if 'prediction' in line.lower() or 'score' in line.lower() or 'label' in line.lower():
            # Print surrounding context
            start = max(0, i-1); end = min(len(lines), i+3)
            for l in lines[start:end]:
                print(f"  {l}")
            print()
            in_block = True
except Exception as e:
    print(f"Could not read: {e}")

print()

# ── Run all emp7 genuine selfies and report class 2 distribution ──────────
MODELS_DIR = Path(r"D:\HRDesk\HRDesk.Web\App_Data\models")
sess_v2    = ort.InferenceSession(str(MODELS_DIR/"spoof_v2_2.7_80x80.onnx"), providers=["CPUExecutionProvider"])
sess_v1se  = ort.InferenceSession(str(MODELS_DIR/"spoof_v1se_4.0_80x80.onnx"), providers=["CPUExecutionProvider"])
PHOTOS_DIR = Path(r"D:\HRDesk\HRDesk.Web\wwwroot\attendance_photos")
emp7_photos = sorted(PHOTOS_DIR.rglob("emp7_*.jpg"), key=lambda p: p.stat().st_mtime, reverse=True)

def softmax(x): e = np.exp(x-x.max()); return e/e.sum()

def get_scores(session, img_path, scale):
    img = Image.open(img_path).convert('RGB')
    w, h = img.size
    bw = int(w*0.6); bh = int(h*0.7)
    x = (w-bw)//2;  y = int(h*0.05)
    cx = x+bw//2;   cy = y+bh//2
    base = min(bw,bh); cs = int(base*scale)
    x0 = max(0,cx-cs//2); y0 = max(0,cy-cs//2)
    x1 = min(w,x0+cs);    y1 = min(h,y0+cs)
    crop = np.array(img)[y0:y1,x0:x1]
    pil  = Image.fromarray(crop,'RGB').resize((80,80),Image.BILINEAR)
    t    = (np.array(pil,dtype=np.float32)/255.).transpose(2,0,1)[np.newaxis,:]
    inp  = session.get_inputs()[0].name
    log  = session.run(None,{inp:t})[0][0]
    return softmax(log)

print(f"=== GENUINE EMPLOYEE SELFIES — CLASS 2 DISTRIBUTION (n={min(20,len(emp7_photos))}) ===")
print(f"{'File':<40} {'V2[2]':>7} {'V1SE[2]':>8} {'fused':>7} {'PASS@0.6':>9}")
print("-"*75)
all_fused = []
for p in emp7_photos[:20]:
    probs_v2   = get_scores(sess_v2,   p, 2.7)
    probs_v1se = get_scores(sess_v1se, p, 4.0)
    fused = (probs_v2[2] + probs_v1se[2]) / 2.0
    all_fused.append(fused)
    verdict = "PASS" if fused >= 0.60 else "FAIL"
    print(f"  {p.name:<38} {probs_v2[2]:>7.4f} {probs_v1se[2]:>8.4f} {fused:>7.4f} {verdict:>9}")

print()
print(f"Mean fused live score (class 2): {np.mean(all_fused):.4f}")
print(f"Min: {np.min(all_fused):.4f}  Max: {np.max(all_fused):.4f}")
print(f"Pass rate at 0.60: {sum(1 for f in all_fused if f>=0.60)}/{len(all_fused)}")
