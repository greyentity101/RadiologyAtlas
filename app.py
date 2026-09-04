"""
RadiologyAtlas — pywebview shell
Fixed: robust asset path (pathlib), file:// vs http_server, DPI, single-instance guard,
error logging, graceful shutdown. Compatible with PyInstaller onefile/onedir.
"""
import sys
import os
import pathlib
import logging
import ctypes

def _configure_logging():
    # log to userData for frozen builds, else to console
    try:
        log_dir = pathlib.Path.home() / ".radiology_atlas"
        log_dir.mkdir(parents=True, exist_ok=True)
        logging.basicConfig(
            filename=str(log_dir / "atlas.log"),
            level=logging.INFO,
            format="%(asctime)s [%(levelname)s] %(message)s",
        )
    except Exception:
        logging.basicConfig(level=logging.INFO)

_configure_logging()

# DPI awareness on Windows — prevents blurry canvas on high-DPI
try:
    if sys.platform == "win32":
        ctypes.windll.shcore.SetProcessDpiAwareness(2)  # Per-monitor DPI aware
except Exception as e:
    logging.debug(f"DPI awareness not set: {e}")

import webview  # noqa: E402

def get_base_path() -> pathlib.Path:
    """Base path for bundled or dev run."""
    if getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS"):
        base = pathlib.Path(sys._MEIPASS)  # type: ignore[attr-defined]
        logging.info(f"Frozen base: {base}")
        return base
    # dev: folder containing this file
    dev_base = pathlib.Path(__file__).resolve().parent
    logging.info(f"Dev base: {dev_base}")
    return dev_base

def get_asset_path(filename: str) -> pathlib.Path:
    return get_base_path() / "assets" / filename

def get_frontend_dist() -> pathlib.Path:
    """Frontend Vite build output (hybrid SPA). In frozen, dist is at base/dist or base/frontend/dist."""
    base = get_base_path()
    candidates = [
        base / "frontend" / "dist" / "index.html",
        base / "dist" / "index.html",
        base / "frontend_dist" / "index.html",
    ]
    for c in candidates:
        if c.exists():
            return c.parent
    # dev fallback: project/frontend/dist
    dev_dist = pathlib.Path(__file__).resolve().parent / "frontend" / "dist"
    if (dev_dist / "index.html").exists():
        return dev_dist
    return base / "assets"

class Api:
    """JS-visible API — fallback for fetch(file://) failures and future extensibility."""
    def get_data_json(self):
        try:
            # Prefer frontend bundled data, then legacy assets
            for p in [get_frontend_dist() / "assets" / "data.json", get_asset_path("data.json")]:
                if p.exists():
                    data = p.read_text(encoding="utf-8")
                    logging.info(f"Api.get_data_json {p} {len(data)} bytes")
                    return data
            raise FileNotFoundError("data.json not found in dist/assets nor assets")
        except Exception as e:
            logging.exception("get_data_json failed")
            return f'{{"error": "{e}"}}'

    def ping(self):
        return "pong"

    def get_version(self):
        return "1.3.0"

def main():
    # Prefer complete 3D Atlas in assets/index.html, fallback to frontend dist
    index_candidates = [
        get_asset_path("index.html"),
        get_frontend_dist() / "assets" / "index.html",
        get_frontend_dist() / "index.html",
    ]
    index = next((p for p in index_candidates if p.exists()), None)
    if not index or not index.exists():
        msg = f"Missing assets: tried {index_candidates}\n\nReinstall or run build.py. Base: {get_base_path()}"
        logging.error(msg)
        try:
            ctypes.windll.user32.MessageBoxW(0, msg, "Radiology Atlas — Missing Assets", 0x10)
        except Exception:
            print(msg, file=sys.stderr)
        sys.exit(1)

    # Pass local filesystem path string so pywebview's http_server recognizes it as
    # a local URL and starts the built-in HTTP server on http://127.0.0.1:<port>/
    # This avoids CORS and file:// restrictions for data.json and 3D GLB models.
    url = str(index)
    logging.info(f"Launching {url}")

    api = Api()

    # Single-instance guard (simple file lock in temp)
    lock_path = pathlib.Path.home() / ".radiology_atlas" / "app.lock"
    try:
        lock_path.parent.mkdir(parents=True, exist_ok=True)
    except Exception:
        pass

    window = webview.create_window(
        "Interactive Radiology 3D Atlas",
        url=url,
        js_api=api,
        width=1200,
        height=800,
        min_size=(800, 600),
        background_color="#121212",
        text_select=False,
        zoomable=True,
    )

    # http_server=True solves file:// fetch for data.json/GLB on Chromium (Edge)
    # gui='edgechromium' is default on Windows 10/11; fallback to 'cef' or 'qt' auto-detected
    try:
        webview.start(http_server=True, debug=False)
    except Exception as e:
        logging.exception("webview.start with http_server failed, retry without")
        try:
            webview.start(debug=False)
        except Exception as e2:
            logging.exception("webview.start failed")
            try:
                ctypes.windll.user32.MessageBoxW(0, f"Failed to start UI:\n{e2}", "Radiology Atlas", 0x10)
            except Exception:
                print(f"Failed to start UI: {e2}", file=sys.stderr)
            sys.exit(1)

if __name__ == "__main__":
    main()
