"""
diagnose_liveness.py — Investigate class mapping and preprocessing for MiniFASNet.

The test run showed V2=0.006, V1SE=0.027 on a genuine employee selfie.
Expected: genuine live person >> 0.60 at index 1.

This script checks:
1. Raw logits (not just softmax probs) for all 3 classes
2. All 3 class softmax probabilities (not just index 1)
3. Logit ordering to determine which index is truly the live class
4. Cross-checks against the original test.py from the repo
"""

import sys
from pathlib import Path
import numpy as np
from PIL import Image
import onnxruntime as ort

MODELS_DIR = Path(r"D:\HRDesk\HRDesk.Web\App_Data\models")
SPOOF_V2   = MODELS_DIR / "spoof_v2_2.7_80x80.onnx"
SPOOF_V1SE = MODELS_DIR / "spoof_v1se_4.0_80x80.onnx"
PHOTOS_DIR = Path(r"D:\HRDesk\HRDesk.Web\wwwroot\attendance_photos")

# Use most recent emp7 selfie (known genuine live person)
EMP7_RECENT = sorted(PHOTOS_DIR.rglob("emp7_*.jpg"),
                     key=lambda p: p.stat().st_mtime, reverse=True)[0]
print(f"Test image (genuine live): {EMP7_RECENT}")
print()

sess_v2   = ort.InferenceSession(str(SPOOF_V2),   providers=["CPUExecutionProvider"])
sess_v1se = ort.InferenceSession(str(SPOOF_V1SE), providers=["CPUExecutionProvider"])


def softmax(x):
    e = np.exp(x - x.max())
    return e / e.sum()


def run_model_full(session, img_rgb, bbox, scale):
    x, y, bw, bh = bbox
    cx = x + bw // 2
    cy = y + bh // 2
    base = min(bw, bh)
    crop_size = int(base * scale)
    x0 = max(0, cx - crop_size // 2)
    y0 = max(0, cy - crop_size // 2)
    x1 = min(img_rgb.shape[1], x0 + crop_size)
    y1 = min(img_rgb.shape[0], y0 + crop_size)
    crop = img_rgb[y0:y1, x0:x1]
    pil  = Image.fromarray(crop, 'RGB').resize((80, 80), Image.BILINEAR)
    arr  = np.array(pil, dtype=np.float32) / 255.0
    tensor = arr.transpose(2, 0, 1)[np.newaxis, :]
    inp = session.get_inputs()[0].name
    logits = session.run(None, {inp: tensor})[0][0]
    probs  = softmax(logits)
    return logits, probs


def estimate_bbox(w, h):
    bw = int(w * 0.60); bh = int(h * 0.70)
    x  = (w - bw) // 2; y  = int(h * 0.05)
    return (x, y, bw, bh)


img  = Image.open(str(EMP7_RECENT)).convert('RGB')
rgb  = np.array(img)
bbox = estimate_bbox(img.width, img.height)

print(f"Image size: {img.width}x{img.height}")
print(f"Estimated face bbox: x={bbox[0]}, y={bbox[1]}, w={bbox[2]}, h={bbox[3]}")
print()

# V2 model full output
logits_v2, probs_v2 = run_model_full(sess_v2, rgb, bbox, 2.7)
print("MiniFASNetV2 (scale=2.7):")
print(f"  Raw logits : [{logits_v2[0]:.4f}, {logits_v2[1]:.4f}, {logits_v2[2]:.4f}]")
print(f"  Softmax    : [{probs_v2[0]:.4f}, {probs_v2[1]:.4f}, {probs_v2[2]:.4f}]")
print(f"  argmax     : {int(np.argmax(probs_v2))}  (predicted class)")
print()

# V1SE model full output
logits_v1se, probs_v1se = run_model_full(sess_v1se, rgb, bbox, 4.0)
print("MiniFASNetV1SE (scale=4.0):")
print(f"  Raw logits : [{logits_v1se[0]:.4f}, {logits_v1se[1]:.4f}, {logits_v1se[2]:.4f}]")
print(f"  Softmax    : [{probs_v1se[0]:.4f}, {probs_v1se[1]:.4f}, {probs_v1se[2]:.4f}]")
print(f"  argmax     : {int(np.argmax(probs_v1se))}  (predicted class)")
print()

# Check all 3 indices to find which one is highest for a genuine person
print("=" * 60)
print("CLASS MAPPING INVESTIGATION")
print("=" * 60)
print()
print("For a genuine live person, the 'live' class index should dominate.")
print()
print(f"V2   index0={probs_v2[0]:.4f}  index1={probs_v2[1]:.4f}  index2={probs_v2[2]:.4f}")
print(f"V1SE index0={probs_v1se[0]:.4f}  index1={probs_v1se[1]:.4f}  index2={probs_v1se[2]:.4f}")
print()

# The original repo's AntiSpoofPredict.py uses:
#   prediction = model.predict(...)
#   label = np.argmax(prediction)
#   if label == 1: "Fake Face" — meaning index 1 is SPOOF, not live
# Let's check all label interpretations:
for live_idx in [0, 1, 2]:
    fused_v2   = float(probs_v2[live_idx])
    fused_v1se = float(probs_v1se[live_idx])
    fused = (fused_v2 + fused_v1se) / 2.0
    label = "live" if fused >= 0.60 else "spoof"
    print(f"If live_class=index{live_idx}: V2={fused_v2:.4f} V1SE={fused_v1se:.4f} fused={fused:.4f} -> {label.upper()}")

print()

# Also check what the original anti_spoof_predict.py does
# The original code: label = np.argmax(prediction)
# prediction = softmax output
# The check is: if label == 1 -> Fake Face
# This means:
#   Class 0 = Real/Live
#   Class 1 = Fake/Spoof  <-- THIS IS KEY
#   Class 2 = Unknown
print("Original repo class mapping (from anti_spoof_predict.py):")
print("  Class 0 = Real/Live face")
print("  Class 1 = Fake/Spoof face")
print("  Class 2 = Unknown/irrelevant")
print()
print(f"With mapping: LIVE = index 0")
fused_v2_idx0   = float(probs_v2[0])
fused_v1se_idx0 = float(probs_v1se[0])
fused_idx0 = (fused_v2_idx0 + fused_v1se_idx0) / 2.0
print(f"  V2 live score  (idx0): {fused_v2_idx0:.4f}")
print(f"  V1SE live score (idx0): {fused_v1se_idx0:.4f}")
print(f"  Fused live score:       {fused_idx0:.4f}")
print(f"  At threshold 0.60: {'LIVE (PASS)' if fused_idx0 >= 0.60 else 'SPOOF (FAIL)'}")
print()

# Verify by checking the test.py fusion logic
sys.path.insert(0, r'D:\SilentFace')
try:
    import torch
    from src.anti_spoof_predict import AntiSpoofPredict, get_kernel
    from src.generate_patches import CropImage
    print("Loaded original AntiSpoofPredict for cross-check...")
    print()

    # Load original PyTorch models for comparison
    from src.model_lib.MiniFASNet import MiniFASNetV2, MiniFASNetV1SE
    import os

    # Load V2 with original code
    pth_v2 = r'D:\SilentFace\resources\anti_spoof_models\2.7_80x80_MiniFASNetV2.pth'
    pt_model_v2 = MiniFASNetV2(conv6_kernel=(5, 5), num_classes=3)
    ck = torch.load(pth_v2, map_location='cpu', weights_only=False)
    sd = {k.replace('module.', ''): v for k, v in ck.items()}
    pt_model_v2.load_state_dict(sd)
    pt_model_v2.eval()

    # Run original preprocessing (from generate_patches.py)
    from torchvision import transforms
    trans = transforms.Compose([transforms.ToTensor()])

    # Replicate original crop at scale 2.7
    img_pil = Image.open(str(EMP7_RECENT))
    x, y, bw, bh = bbox
    cx_ = x + bw // 2; cy_ = y + bh // 2
    base_ = min(bw, bh); crop_ = int(base_ * 2.7)
    x0_ = max(0, cx_ - crop_//2); y0_ = max(0, cy_ - crop_//2)
    x1_ = min(img_pil.width, x0_+crop_); y1_ = min(img_pil.height, y0_+crop_)
    crop_pil = img_pil.crop((x0_, y0_, x1_, y1_)).resize((80,80), Image.BILINEAR)
    crop_rgb = np.array(crop_pil.convert('RGB'))

    # PyTorch uses ToTensor() which divides by 255 -> [0,1]
    tensor_pt = trans(crop_pil).unsqueeze(0)  # (1,3,80,80) float [0,1]
    with torch.no_grad():
        out = pt_model_v2(tensor_pt).numpy()[0]
    probs_pt = np.exp(out - out.max()); probs_pt /= probs_pt.sum()
    print("PyTorch V2 full output on genuine image:")
    print(f"  Logits : [{out[0]:.4f}, {out[1]:.4f}, {out[2]:.4f}]")
    print(f"  Softmax: [{probs_pt[0]:.4f}, {probs_pt[1]:.4f}, {probs_pt[2]:.4f}]")
    print(f"  argmax : {int(np.argmax(probs_pt))}")
    print()
    print("ONNX V2 for same crop:")
    arr_ = crop_rgb.astype(np.float32) / 255.0
    t_   = arr_.transpose(2,0,1)[np.newaxis,:]
    inp_ = sess_v2.get_inputs()[0].name
    log_ = sess_v2.run(None, {inp_: t_})[0][0]
    pr_  = softmax(log_)
    print(f"  Logits : [{log_[0]:.4f}, {log_[1]:.4f}, {log_[2]:.4f}]")
    print(f"  Softmax: [{pr_[0]:.4f}, {pr_[1]:.4f}, {pr_[2]:.4f}]")
    print(f"  argmax : {int(np.argmax(pr_))}")
    print()
    print("CONCLUSION:")
    print(f"  PyTorch predicted class {int(np.argmax(probs_pt))}")
    if int(np.argmax(probs_pt)) == 0:
        print("  -> This confirms class 0 = Live/Real")
        print("  -> The C# service is using index 1 (spoof) as 'live' -- WRONG")
    elif int(np.argmax(probs_pt)) == 1:
        print("  -> Class 1 dominates on genuine person")
        print("  -> Either class 1 = Live OR the image is being classified as spoof by PyTorch too")

except Exception as e:
    print(f"Could not run PyTorch cross-check: {e}")
    print("Relying on ONNX raw output analysis only.")
