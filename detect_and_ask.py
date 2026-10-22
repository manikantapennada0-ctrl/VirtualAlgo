"""
CLI Runner for OpenCV Visual Grounding and LLM Visual Question Answering.

Usage Examples:
    # 1. Using a sample image (offline or online)
    python detect_and_ask.py --image static/samples/traffic_light.jpg --question "Is the traffic light red?"

    # 2. Using custom image and saving annotated result
    python detect_and_ask.py --image my_photo.jpg --question "Find the person riding a bicycle" --output highlighted_result.jpg

    # 3. Passing Gemini API Key for live AI grounding
    python detect_and_ask.py --image input.jpg --question "What type of animal is this?" --api-key "AIzaSy..." --mode all_objects
"""

import argparse
import os
import sys
import base64
from detector import VisualGroundingEngine

def main():
    parser = argparse.ArgumentParser(
        description="Detect objects with OpenCV & Answer visual questions with LLM"
    )
    parser.add_argument(
        "--image", "-i",
        type=str,
        default="static/samples/traffic_light.jpg",
        help="Path to input image file (default: static/samples/traffic_light.jpg)"
    )
    parser.add_argument(
        "--question", "-q",
        type=str,
        default="Is the traffic light red?",
        help="Question to ask about the image"
    )
    parser.add_argument(
        "--mode", "-m",
        choices=["task_focused", "all_objects", "hybrid"],
        default="task_focused",
        help="Detection mode: task_focused (focus on question targets), all_objects, or hybrid"
    )
    parser.add_argument(
        "--output-dir", "-d",
        type=str,
        default="outputs",
        help="Folder to store all output files (default: outputs)"
    )
    parser.add_argument(
        "--output", "-o",
        type=str,
        default=None,
        help="Custom filename for the OpenCV annotated image inside the output folder"
    )
    parser.add_argument(
        "--api-key", "-k",
        type=str,
        default=None,
        help="Optional Gemini API key (defaults to GEMINI_API_KEY env var)"
    )

    args = parser.parse_args()

    if not os.path.exists(args.image):
        print(f"[ERROR] Image file not found: {args.image}")
        sys.exit(1)

    # Ensure output directory exists
    os.makedirs(args.output_dir, exist_ok=True)

    base_name = os.path.splitext(os.path.basename(args.image))[0]

    print("=" * 70)
    print(" VisionQuery AI: OpenCV Object Detection & LLM Visual Grounding")
    print("=" * 70)
    print(f" Input Image   : {args.image}")
    print(f" Question      : {args.question}")
    print(f" Mode          : {args.mode}")
    print(f" Output Folder : {args.output_dir}/")
    print(f" API Key       : {'Provided' if args.api_key or os.environ.get('GEMINI_API_KEY') else 'Offline Heuristic Engine'}")
    print("-" * 70)

    with open(args.image, "rb") as f:
        img_bytes = f.read()

    engine = VisualGroundingEngine(default_api_key=args.api_key)
    result = engine.analyze(
        image_bytes=img_bytes,
        question=args.question,
        mode=args.mode,
        api_key=args.api_key,
        save_to_disk=True,
        output_dir=args.output_dir,
        prefix=base_name
    )

    # If user provided a specific custom output name, also copy/save it to that filename in outputs
    if args.output:
        custom_out_path = args.output if os.path.isabs(args.output) or os.path.dirname(args.output) else os.path.join(args.output_dir, args.output)
        b64_data = result["annotated_image"].split(",")[1]
        with open(custom_out_path, "wb") as f:
            f.write(base64.b64decode(b64_data))
        result["saved_files"]["custom_output"] = custom_out_path.replace("\\", "/")

    print(f"\n[+] Processing complete! All output files stored in: {args.output_dir}/")
    saved = result.get("saved_files", {})
    if saved.get("highlighted_image"):
        print(f"    - Highlighted Image : {saved['highlighted_image']}")
    if saved.get("analysis_json"):
        print(f"    - Analysis JSON     : {saved['analysis_json']}")
    for c_path in saved.get("crops", []):
        print(f"    - Cropped Snippet   : {c_path}")

    print("\n" + "=" * 30 + " LLM ANSWER " + "=" * 30)
    print(result["answer"])
    print("\n" + "=" * 25 + " RELEVANT VISUAL INFO " + "=" * 25)
    print(result["relevant_visual_info"])
    print("\n" + "=" * 25 + f" DETECTED OBJECTS ({result['total_detected']}) " + "=" * 25)

    for i, obj in enumerate(result["detected_objects"], 1):
        box = obj["box_pixels"]
        print(f"{i}. {obj['label']} [Conf: {int(obj['confidence']*100)}%]")
        print(f"   Pixel Box (x, y, w, h): ({box['x']}, {box['y']}, {box['width']}, {box['height']})")
        print(f"   Normalized (ymin, xmin, ymax, xmax): {obj['box_norm']}")
        print(f"   Note: {obj['description']}")
    print("=" * 70 + "\n")

if __name__ == "__main__":
    main()
