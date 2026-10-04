from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import os
import posixpath
import re
import shutil
import sys
import urllib.parse


class RangeRequestHandler(SimpleHTTPRequestHandler):
    def send_head(self):
        path = self.translate_path(self.path)
        if os.path.isdir(path):
            return super().send_head()

        ctype = self.guess_type(path)
        try:
            file_handle = open(path, "rb")
        except OSError:
            self.send_error(404, "File not found")
            return None

        file_size = os.fstat(file_handle.fileno()).st_size
        range_header = self.headers.get("Range")
        if not range_header:
            self.send_response(200)
            self.send_header("Content-type", ctype)
            self.send_header("Content-Length", str(file_size))
            self.send_header("Accept-Ranges", "bytes")
            self.end_headers()
            return file_handle

        match = re.match(r"bytes=(\d*)-(\d*)", range_header)
        if not match:
            self.send_error(416, "Invalid Range header")
            file_handle.close()
            return None

        start_text, end_text = match.groups()
        if start_text == "" and end_text == "":
            self.send_error(416, "Invalid Range header")
            file_handle.close()
            return None

        if start_text == "":
            length = int(end_text)
            start = max(file_size - length, 0)
            end = file_size - 1
        else:
            start = int(start_text)
            end = int(end_text) if end_text else file_size - 1

        if start >= file_size or end < start:
            self.send_error(416, "Requested Range Not Satisfiable")
            file_handle.close()
            return None

        end = min(end, file_size - 1)
        self.range = (start, end)
        file_handle.seek(start)
        self.send_response(206)
        self.send_header("Content-type", ctype)
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Content-Range", f"bytes {start}-{end}/{file_size}")
        self.send_header("Content-Length", str(end - start + 1))
        self.end_headers()
        return file_handle

    def copyfile(self, source, outputfile):
        if not hasattr(self, "range"):
            return super().copyfile(source, outputfile)

        start, end = self.range
        remaining = end - start + 1
        while remaining > 0:
            chunk = source.read(min(64 * 1024, remaining))
            if not chunk:
                break
            outputfile.write(chunk)
            remaining -= len(chunk)
        del self.range

    def translate_path(self, path):
        path = path.split("?", 1)[0].split("#", 1)[0]
        path = posixpath.normpath(urllib.parse.unquote(path))
        words = [word for word in path.split("/") if word]
        resolved = Path.cwd()
        for word in words:
            if os.path.dirname(word) or word in (os.curdir, os.pardir):
                continue
            resolved = resolved / word
        return str(resolved)


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    server = ThreadingHTTPServer(("127.0.0.1", port), RangeRequestHandler)
    print(f"Serving {Path.cwd()} at http://127.0.0.1:{port}/")
    server.serve_forever()
