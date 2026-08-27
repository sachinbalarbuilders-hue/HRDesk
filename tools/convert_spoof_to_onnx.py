"""
convert_spoof_to_onnx.py — One-time conversion of Silent-Face-Anti-Spoofing .pth models to ONNX.

Requirements:
    pip install torch onnx onnxruntime numpy

Usage:
    Run from the root of the Silent-Face-Anti-Spoofing repository:
        python /path/to/convert_spoof_to_onnx.py

    The script will create an output_onnx/ directory next to this script and write
    both ONNX files there. Copy the resulting files into HRDesk.Web/App_Data/models/.
"""

import hashlib
import os
import sys
import numpy as np

# ---------------------------------------------------------------------------
# Model definitions
# Each entry: (relative path to .pth from repo root, output ONNX filename, scale)
# ---------------------------------------------------------------------------
MODELS = [
    {
        "pth_path": os.path.join("resources", "anti_spoof_models", "2.7_80x80_MiniFASNetV2.pth"),
        "onnx_name": "spoof_v2_2.7_80x80.onnx",
        "scale": 2.7,
        "model_type": "MiniFASNetV2",
    },
    {
        "pth_path": os.path.join("resources", "anti_spoof_models", "4_0_0_80x80_MiniFASNetV1SE.pth"),
        "onnx_name": "spoof_v1se_4.0_80x80.onnx",
        "scale": 4.0,
        "model_type": "MiniFASNetV1SE",
    },
]

OUTPUT_DIR = "output_onnx"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def load_model(pth_path: str, model_type: str):
    """Load a Silent-Face-Anti-Spoofing model from a .pth checkpoint.

    Imports are deferred so the script fails fast with a readable message if
    the Silent-Face-Anti-Spoofing repo is not on sys.path / cwd is wrong.
    """
    try:
        import torch
        from src.model_lib.MiniFASNet import MiniFASNetV2, MiniFASNetV1SE  # noqa: PLC0415
    except ImportError as exc:
        print(
            f"ERROR: Could not import model classes. "
            f"Make sure you are running this script from the "
            f"Silent-Face-Anti-Spoofing repo root.\n  {exc}"
        )
        sys.exit(1)

    model_map = {
        "MiniFASNetV2": MiniFASNetV2,
        "MiniFASNetV1SE": MiniFASNetV1SE,
    }

    if model_type not in model_map:
        raise ValueError(f"Unknown model_type '{model_type}'. Expected one of {list(model_map)}")

    cls = model_map[model_type]
    # num_classes=3 matches the original repo training config (live / spoof / unknown)
    model = cls(conv6_kernel=(5, 5), num_classes=3)

    checkpoint = torch.load(pth_path, map_location="cpu", weights_only=False)
    # Checkpoints may be wrapped in a dict with a "state_dict" key
    state_dict = checkpoint.get("state_dict", checkpoint)
    # Strip any "module." prefix added by DataParallel
    state_dict = {k.replace("module.", ""): v for k, v in state_dict.items()}

    # Key-name compatibility fix for MiniFASNetV1SE / MiniFASNetSE:
    # Older checkpoints stored SE sub-layer weights as flat attributes on
    # Depth_Wise_SE (e.g. "...se_fc1.weight", "...se_bn1.weight") while the
    # current MiniFASNet.py wraps them inside a nested SEModule
    # ("...se_module.fc1.weight", "...se_module.bn1.weight").
    # Remap so load_state_dict succeeds without strict=False data loss.
    remap = {
        "se_fc1":  "se_module.fc1",
        "se_bn1":  "se_module.bn1",
        "se_fc2":  "se_module.fc2",
        "se_bn2":  "se_module.bn2",
    }
    remapped = {}
    for k, v in state_dict.items():
        new_k = k
        for old_fragment, new_fragment in remap.items():
            if old_fragment in k:
                new_k = k.replace(old_fragment, new_fragment)
                break
        remapped[new_k] = v
    state_dict = remapped
    model.load_state_dict(state_dict)
    model.eval()

    print(f"  Loaded '{pth_path}' ({model_type})")
    return model


def export_to_onnx(model, onnx_path: str) -> None:
    """Export a PyTorch model to ONNX with opset 17, single self-contained file.

    Input shape: (1, 3, 80, 80)  — NCHW, float32, RGB, values in [0, 1]
    Output shape: (1, 3)         — raw logits for [spoof, live, unknown]

    Uses the TorchScript-based (legacy) exporter explicitly via dynamo=False to
    produce a single self-contained .onnx file without external data files.
    This is required for ONNX Runtime in-process loading in the .NET backend.
    """
    import torch  # noqa: PLC0415

    dummy_input = torch.zeros(1, 3, 80, 80, dtype=torch.float32)

    # Force the legacy TorchScript tracer (dynamo=False) which always writes all
    # weights inline into the .onnx file. The dynamo exporter (default in PT 2.x)
    # produces external data format which ONNX Runtime cannot load as a single file.
    with torch.no_grad():
        torch.onnx.export(
            model,
            dummy_input,
            onnx_path,
            export_params=True,
            opset_version=17,
            do_constant_folding=True,
            input_names=["input"],
            output_names=["output"],
            dynamic_axes={
                "input":  {0: "batch_size"},
                "output": {0: "batch_size"},
            },
            dynamo=False,
        )
    print(f"  Exported ONNX -> '{onnx_path}'")


def verify_shape(onnx_path: str) -> None:
    """Run a quick shape check with onnxruntime to confirm the exported model
    accepts (1, 3, 80, 80) and produces (1, 3) output."""
    import onnxruntime as ort  # noqa: PLC0415

    sess = ort.InferenceSession(onnx_path, providers=["CPUExecutionProvider"])
    dummy = np.zeros((1, 3, 80, 80), dtype=np.float32)
    outputs = sess.run(None, {"input": dummy})

    assert len(outputs) == 1, f"Expected 1 output tensor, got {len(outputs)}"
    assert outputs[0].shape == (1, 3), (
        f"Expected output shape (1, 3), got {outputs[0].shape}"
    )
    print(f"  Shape check passed: input (1,3,80,80) -> output {outputs[0].shape}")


def equivalence_check(model, onnx_path: str, rtol: float = 1e-4, atol: float = 1e-5) -> None:
    """Compare PyTorch and ONNX outputs on a random input to confirm numeric
    equivalence within tolerance."""
    import torch  # noqa: PLC0415
    import onnxruntime as ort  # noqa: PLC0415

    rng = np.random.default_rng(seed=42)
    data = rng.random((1, 3, 80, 80), dtype=np.float32)

    with torch.no_grad():
        pt_out = model(torch.from_numpy(data)).numpy()

    sess = ort.InferenceSession(onnx_path, providers=["CPUExecutionProvider"])
    ort_out = sess.run(None, {"input": data})[0]

    np.testing.assert_allclose(
        pt_out, ort_out, rtol=rtol, atol=atol,
        err_msg="PyTorch and ONNX outputs differ beyond tolerance!"
    )
    max_diff = float(np.abs(pt_out - ort_out).max())
    print(f"  Equivalence check passed (max diff={max_diff:.2e})")


def sha256_file(path: str) -> str:
    """Return the hex SHA-256 digest of a file."""
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    print(f"Output directory: {os.path.abspath(OUTPUT_DIR)}\n")

    for entry in MODELS:
        pth_path = entry["pth_path"]
        onnx_name = entry["onnx_name"]
        model_type = entry["model_type"]
        onnx_path = os.path.join(OUTPUT_DIR, onnx_name)

        print(f"--- {onnx_name} ---")

        if not os.path.isfile(pth_path):
            print(f"  ERROR: .pth file not found at '{pth_path}'")
            print("  Make sure you are running from the Silent-Face-Anti-Spoofing repo root.")
            sys.exit(1)

        model = load_model(pth_path, model_type)
        export_to_onnx(model, onnx_path)
        verify_shape(onnx_path)
        equivalence_check(model, onnx_path)

        digest = sha256_file(onnx_path)
        size_kb = os.path.getsize(onnx_path) / 1024
        print(f"  SHA-256 : {digest}")
        print(f"  Size    : {size_kb:.1f} KB")
        print()

    print("Conversion complete.")
    print(f"Copy the .onnx files from '{OUTPUT_DIR}/' into HRDesk.Web/App_Data/models/")


if __name__ == "__main__":
    main()
