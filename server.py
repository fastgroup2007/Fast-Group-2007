from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import json
import os
import tempfile


ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "data"
PRODUCTS_FILE = DATA_DIR / "products.json"
MAX_BODY_BYTES = 20 * 1024 * 1024


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
        if self.path == "/":
            self.path = "/index.html"
        super().do_GET()

    def do_PUT(self):
        if self.path == "/api/products":
            self.save_products()
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


def main():
    port = int(os.environ.get("FAST_GROUP_PORT", "8765"))
    server = ThreadingHTTPServer(("127.0.0.1", port), FastGroupHandler)
    print(f"Fast Group local server: http://127.0.0.1:{port}/")
    server.serve_forever()


if __name__ == "__main__":
    main()
