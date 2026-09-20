from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import json
import os
import tempfile
from datetime import date


ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "data"
PRODUCTS_FILE = DATA_DIR / "products.json"
REVIEWS_FILE = DATA_DIR / "reviews.json"
MAX_BODY_BYTES = 20 * 1024 * 1024
MAX_REVIEWS_BODY_BYTES = 1024 * 1024


class FastGroupHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        if self.path == "/" or self.path.endswith(".html") or self.path.startswith("/api/"):
            self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_OPTIONS(self):
        if self.path.startswith("/api/"):
            self.send_response(204)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "GET, PUT, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.end_headers()
            return
        super().do_OPTIONS()

    def do_GET(self):
        if self.path == "/api/products":
            self.send_products()
            return
        if self.path == "/api/reviews":
            self.send_reviews()
            return
        if self.path == "/":
            self.path = "/index.html"
        super().do_GET()

    def do_POST(self):
        if self.path == "/api/reviews":
            self.append_review()
            return
        self.send_error(404, "Not found")

    def do_PUT(self):
        if self.path == "/api/products":
            self.save_products()
            return
        if self.path == "/api/reviews":
            self.save_reviews()
            return
        self.send_error(404, "Not found")

    def send_json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def send_products(self):
        if not PRODUCTS_FILE.exists():
            self.send_json(404, {"error": "products file not created yet"})
            return
        try:
            body = PRODUCTS_FILE.read_bytes()
        except OSError:
            self.send_json(500, {"error": "could not read products"})
            return
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def save_products(self):
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            self.send_json(400, {"error": "invalid content length"})
            return
        if length <= 0 or length > MAX_BODY_BYTES:
            self.send_json(413, {"error": "invalid body size"})
            return
        try:
            raw = self.rfile.read(length)
            data = json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            self.send_json(400, {"error": "invalid json"})
            return
        if not isinstance(data, list):
            self.send_json(400, {"error": "products must be an array"})
            return

        DATA_DIR.mkdir(exist_ok=True)
        fd, temp_path = tempfile.mkstemp(prefix="products-", suffix=".json", dir=str(DATA_DIR))
        try:
            with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as temp_file:
                json.dump(data, temp_file, ensure_ascii=False, indent=2)
                temp_file.write("\n")
            os.replace(temp_path, PRODUCTS_FILE)
        except OSError:
            try:
                os.unlink(temp_path)
            except OSError:
                pass
            self.send_json(500, {"error": "could not save products"})
            return

        self.send_json(200, {"ok": True, "count": len(data)})

    def read_json_body(self, max_bytes):
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            self.send_json(400, {"error": "invalid content length"})
            return None
        if length <= 0 or length > max_bytes:
            self.send_json(413, {"error": "invalid body size"})
            return None
        try:
            return json.loads(self.rfile.read(length).decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            self.send_json(400, {"error": "invalid json"})
            return None

    def write_json_file(self, file_path, data):
        DATA_DIR.mkdir(exist_ok=True)
        fd, temp_path = tempfile.mkstemp(prefix=f"{file_path.stem}-", suffix=".json", dir=str(DATA_DIR))
        try:
            with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as temp_file:
                json.dump(data, temp_file, ensure_ascii=False, indent=2)
                temp_file.write("\n")
            os.replace(temp_path, file_path)
            return True
        except OSError:
            try:
                os.unlink(temp_path)
            except OSError:
                pass
            return False

    def normalize_review(self, item, index=0):
        if not isinstance(item, dict):
            return None
        comment = " ".join(str(item.get("comment", "")).split())[:800]
        if not comment:
            return None
        try:
            stars = int(item.get("stars", 5))
        except (TypeError, ValueError):
            stars = 5
        stars = max(1, min(5, stars))
        return {
            "id": " ".join(str(item.get("id", "")).split())[:120] or f"review_{index}",
            "name": " ".join(str(item.get("name", "")).split())[:80] or "عميل",
            "stars": stars,
            "comment": comment,
            "date": " ".join(str(item.get("date", "")).split())[:20] or date.today().isoformat()
        }

    def normalize_reviews(self, data):
        if not isinstance(data, list):
            return None
        reviews = []
        seen = set()
        for index, item in enumerate(data):
            review = self.normalize_review(item, index)
            if not review or review["id"] in seen:
                continue
            seen.add(review["id"])
            reviews.append(review)
        return reviews

    def read_reviews_file(self):
        if not REVIEWS_FILE.exists():
            return []
        try:
            parsed = json.loads(REVIEWS_FILE.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return []
        return self.normalize_reviews(parsed) or []

    def send_reviews(self):
        self.send_json(200, self.read_reviews_file())

    def append_review(self):
        data = self.read_json_body(MAX_REVIEWS_BODY_BYTES)
        if data is None:
            return
        review = self.normalize_review(data)
        if not review:
            self.send_json(400, {"error": "invalid review"})
            return
        reviews = self.read_reviews_file()
        for index, existing in enumerate(reviews):
            if existing["id"] == review["id"]:
                reviews[index] = review
                break
        else:
            reviews.append(review)
        if not self.write_json_file(REVIEWS_FILE, reviews):
            self.send_json(500, {"error": "could not save reviews"})
            return
        self.send_json(200, {"ok": True, "count": len(reviews), "review": review})

    def save_reviews(self):
        data = self.read_json_body(MAX_REVIEWS_BODY_BYTES)
        if data is None:
            return
        reviews = self.normalize_reviews(data)
        if reviews is None:
            self.send_json(400, {"error": "reviews must be an array"})
            return
        if not self.write_json_file(REVIEWS_FILE, reviews):
            self.send_json(500, {"error": "could not save reviews"})
            return
        self.send_json(200, {"ok": True, "count": len(reviews)})


def main():
    port = int(os.environ.get("FAST_GROUP_PORT", "8765"))
    server = ThreadingHTTPServer(("127.0.0.1", port), FastGroupHandler)
    print(f"Fast Group local server: http://127.0.0.1:{port}/")
    server.serve_forever()


if __name__ == "__main__":
    main()
