"""
Simple object detection with OpenCV.
Input : an image
Output: the same image with every detected object highlighted by a box.

Usage:  python simple_detect.py input.jpg output.jpg
Needs : opencv-python (4.x), numpy, and in ./models:
        yolov4-tiny.cfg, yolov4-tiny.weights, coco.names
"""
import sys
import cv2
import numpy as np

CFG, WEIGHTS, NAMES = "models/yolov4-tiny.cfg", "models/yolov4-tiny.weights", "models/coco.names"
CONF, NMS, SIZE = 0.25, 0.40, 608

in_path = sys.argv[1] if len(sys.argv) > 1 else "input.jpg"
out_path = sys.argv[2] if len(sys.argv) > 2 else "output.jpg"

classes = [l.strip() for l in open(NAMES) if l.strip()]
net = cv2.dnn.readNetFromDarknet(CFG, WEIGHTS)
model = cv2.dnn_DetectionModel(net)
model.setInputParams(size=(SIZE, SIZE), scale=1 / 255.0, swapRB=True)

img = cv2.imread(in_path)
if img is None:
    sys.exit(f"Cannot read image: {in_path}")

ids, scores, boxes = model.detect(img, CONF, NMS)

rng = np.random.default_rng(42)
colors = rng.integers(0, 255, size=(len(classes), 3)).tolist()

result = img.copy()
for cid, score, (x, y, w, h) in zip(np.array(ids).flatten(), np.array(scores).flatten(), boxes):
    color = colors[int(cid)]
    cv2.rectangle(result, (x, y), (x + w, y + h), color, 2)          # box
    label = f"{classes[int(cid)]} {score:.2f}"
    (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.55, 1)
    ty = max(y, th + 6)
    cv2.rectangle(result, (x, ty - th - 6), (x + tw + 4, ty), color, -1)  # label background
    cv2.putText(result, label, (x + 2, ty - 4), cv2.FONT_HERSHEY_SIMPLEX, 0.55,
                (255, 255, 255), 1, cv2.LINE_AA)
    print(f"{classes[int(cid)]:15s} {score:.2f}  box=({x},{y},{x+w},{y+h})")

cv2.imwrite(out_path, result)
print(f"Saved -> {out_path}  ({len(ids)} objects)")
