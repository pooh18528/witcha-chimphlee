import cv2
import json
import os
import sys
import numpy as np
from pathlib import Path

def imread_unicode(path):
    with open(path, 'rb') as f:
        bytes = f.read()
        arr = np.frombuffer(bytes, np.uint8)
        return cv2.imdecode(arr, cv2.IMREAD_COLOR)

face_cascade = cv2.CascadeClassifier(
    cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
)

base_dir = Path(__file__).resolve().parent.parent / "public"
output_file = base_dir / "face_data" / "face_locations.json"
output_file.parent.mkdir(parents=True, exist_ok=True)

image_dirs = [
    base_dir / "รูป",
    base_dir / "รูป_web",
]

results = {}
total_images = 0
total_faces = 0

for img_dir in image_dirs:
    if not img_dir.exists():
        print(f"Directory not found: {img_dir}")
        continue
    for year_dir in sorted(img_dir.iterdir()):
        if not year_dir.is_dir():
            continue
        for img_path in sorted(year_dir.glob("*.jpg")):
            rel = str(img_path.relative_to(base_dir)).replace("\\", "/")
            try:
                img = imread_unicode(str(img_path))
                if img is None:
                    continue
                gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
                faces = face_cascade.detectMultiScale(
                    gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30)
                )
                face_list = []
                for x, y, w, h in faces:
                    face_list.append({
                        "x": int(x), "y": int(y),
                        "w": int(w), "h": int(h),
                    })
                results[rel] = {
                    "face_count": len(face_list),
                    "faces": face_list,
                }
                total_images += 1
                total_faces += len(face_list)
            except Exception as e:
                print(f"Error: {img_path} - {e}")

output = {
    "total_images_processed": total_images,
    "total_faces_detected": total_faces,
    "images": results,
}

with open(output_file, "w", encoding="utf-8") as f:
    json.dump(output, f, ensure_ascii=False, indent=2)

print(f"Processed {total_images} images, detected {total_faces} faces")
print(f"Output: {output_file}")
