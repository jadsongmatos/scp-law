import base64
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from scripts.shared.nvidia import edit_image

if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("Uso: python3 scripts/generate/nvidia_edit.py <imagem_ref> <prompt> <output_path>")
        sys.exit(1)
        
    ref_path = Path(sys.argv[1])
    prompt = sys.argv[2]
    out_path = Path(sys.argv[3])
    
    img_b64 = edit_image(prompt, ref_path)
    if img_b64:
        out_path.write_bytes(base64.b64decode(img_b64))
        print(f"Salvo em {out_path}")
    else:
        print("Falha na edicao de imagem")
        sys.exit(1)
