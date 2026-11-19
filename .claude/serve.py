# Local preview server with caching disabled.
import http.server, functools, os, sys
class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
http.server.ThreadingHTTPServer(("", int(sys.argv[1]) if len(sys.argv) > 1 else 5317), functools.partial(H, directory=root)).serve_forever()
