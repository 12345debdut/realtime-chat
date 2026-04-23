#!/usr/bin/env python3
"""
Generate Excalidraw HLD files for the server and client.

Writes two files:
  docs/hld/server.excalidraw
  docs/hld/client.excalidraw

Both are valid .excalidraw JSON. Open at https://excalidraw.com
(File → Open) or in the VS Code "Excalidraw" extension. Tweak layout as
desired; the bound arrows follow the boxes when you rearrange.

Re-run this script whenever the architecture changes materially. The
exported PNG that lives in the README is a downstream artefact — capture
it from Excalidraw after edits, don't edit the .png directly.
"""
from __future__ import annotations

import json
import random
import time
from pathlib import Path

random.seed(42)  # stable seeds → stable diffs on regen


def ms() -> int:
    return int(time.time() * 1000)


def seed() -> int:
    return random.randint(1_000_000, 9_999_999_999)


def rect(
    eid: str,
    x: int,
    y: int,
    w: int,
    h: int,
    stroke: str = "#1e1e1e",
    bg: str = "transparent",
    fill_style: str = "solid",
    stroke_style: str = "solid",
    stroke_width: int = 2,
    roundness: int | None = 3,
    group_ids: list[str] | None = None,
    bound_text_id: str | None = None,
    roughness: int = 1,
) -> dict:
    return {
        "id": eid,
        "type": "rectangle",
        "x": x,
        "y": y,
        "width": w,
        "height": h,
        "angle": 0,
        "strokeColor": stroke,
        "backgroundColor": bg,
        "fillStyle": fill_style,
        "strokeWidth": stroke_width,
        "strokeStyle": stroke_style,
        "roughness": roughness,
        "opacity": 100,
        "groupIds": group_ids or [],
        "frameId": None,
        "roundness": {"type": roundness} if roundness else None,
        "seed": seed(),
        "version": 1,
        "versionNonce": seed(),
        "isDeleted": False,
        "boundElements": (
            [{"type": "text", "id": bound_text_id}] if bound_text_id else []
        ),
        "updated": ms(),
        "link": None,
        "locked": False,
    }


def bound_text(
    eid: str,
    container_id: str,
    x: int,
    y: int,
    w: int,
    h: int,
    text: str,
    font_size: int = 18,
    font_family: int = 1,  # 1 = hand-drawn (Virgil), 2 = normal, 3 = code
    color: str = "#1e1e1e",
    group_ids: list[str] | None = None,
) -> dict:
    return {
        "id": eid,
        "type": "text",
        "x": x,
        "y": y,
        "width": w,
        "height": h,
        "angle": 0,
        "strokeColor": color,
        "backgroundColor": "transparent",
        "fillStyle": "solid",
        "strokeWidth": 1,
        "strokeStyle": "solid",
        "roughness": 1,
        "opacity": 100,
        "groupIds": group_ids or [],
        "frameId": None,
        "roundness": None,
        "seed": seed(),
        "version": 1,
        "versionNonce": seed(),
        "isDeleted": False,
        "boundElements": [],
        "updated": ms(),
        "link": None,
        "locked": False,
        "text": text,
        "fontSize": font_size,
        "fontFamily": font_family,
        "textAlign": "center",
        "verticalAlign": "middle",
        "containerId": container_id,
        "originalText": text,
        "lineHeight": 1.25,
        "baseline": font_size - 3,
    }


def free_text(
    eid: str,
    x: int,
    y: int,
    text: str,
    font_size: int = 16,
    font_family: int = 1,
    color: str = "#1e1e1e",
    align: str = "left",
    group_ids: list[str] | None = None,
) -> dict:
    # Approximate width from text length + font size. Excalidraw re-measures
    # on load, so this is just an initial layout hint.
    width = int(len(text) * font_size * 0.55)
    return {
        "id": eid,
        "type": "text",
        "x": x,
        "y": y,
        "width": width,
        "height": font_size + 8,
        "angle": 0,
        "strokeColor": color,
        "backgroundColor": "transparent",
        "fillStyle": "solid",
        "strokeWidth": 1,
        "strokeStyle": "solid",
        "roughness": 1,
        "opacity": 100,
        "groupIds": group_ids or [],
        "frameId": None,
        "roundness": None,
        "seed": seed(),
        "version": 1,
        "versionNonce": seed(),
        "isDeleted": False,
        "boundElements": [],
        "updated": ms(),
        "link": None,
        "locked": False,
        "text": text,
        "fontSize": font_size,
        "fontFamily": font_family,
        "textAlign": align,
        "verticalAlign": "top",
        "containerId": None,
        "originalText": text,
        "lineHeight": 1.25,
        "baseline": font_size - 3,
    }


def arrow(
    eid: str,
    x1: int,
    y1: int,
    x2: int,
    y2: int,
    start_id: str | None = None,
    end_id: str | None = None,
    stroke: str = "#1e1e1e",
    stroke_style: str = "solid",
    stroke_width: int = 2,
    start_arrowhead: str | None = None,
    end_arrowhead: str | None = "arrow",
) -> dict:
    return {
        "id": eid,
        "type": "arrow",
        "x": x1,
        "y": y1,
        "width": abs(x2 - x1),
        "height": abs(y2 - y1),
        "angle": 0,
        "strokeColor": stroke,
        "backgroundColor": "transparent",
        "fillStyle": "solid",
        "strokeWidth": stroke_width,
        "strokeStyle": stroke_style,
        "roughness": 1,
        "opacity": 100,
        "groupIds": [],
        "frameId": None,
        "roundness": {"type": 2},
        "seed": seed(),
        "version": 1,
        "versionNonce": seed(),
        "isDeleted": False,
        "boundElements": [],
        "updated": ms(),
        "link": None,
        "locked": False,
        "points": [[0, 0], [x2 - x1, y2 - y1]],
        "lastCommittedPoint": None,
        "startBinding": (
            {"elementId": start_id, "focus": 0, "gap": 8} if start_id else None
        ),
        "endBinding": (
            {"elementId": end_id, "focus": 0, "gap": 8} if end_id else None
        ),
        "startArrowhead": start_arrowhead,
        "endArrowhead": end_arrowhead,
    }


def box(
    eid: str,
    x: int,
    y: int,
    w: int,
    h: int,
    text: str,
    *,
    bg: str = "transparent",
    stroke: str = "#1e1e1e",
    stroke_style: str = "solid",
    font_size: int = 18,
    group_ids: list[str] | None = None,
    roundness: int | None = 3,
) -> list[dict]:
    """Rectangle + centered text bound to it. Returns [rect, text]."""
    tid = f"{eid}-text"
    r = rect(
        eid,
        x,
        y,
        w,
        h,
        stroke=stroke,
        bg=bg,
        stroke_style=stroke_style,
        group_ids=group_ids,
        bound_text_id=tid,
        roundness=roundness,
    )
    t = bound_text(
        tid, eid, x, y + (h - font_size) // 2, w, font_size, text, font_size=font_size, group_ids=group_ids
    )
    return [r, t]


def wrap(
    elements: list[dict],
    app_state_extras: dict | None = None,
) -> dict:
    return {
        "type": "excalidraw",
        "version": 2,
        "source": "https://excalidraw.com",
        "elements": elements,
        "appState": {
            "gridSize": 20,
            "viewBackgroundColor": "#ffffff",
            **(app_state_extras or {}),
        },
        "files": {},
    }


# ──────────────────────────────────────────────────────────────────────────
# Server HLD
# ──────────────────────────────────────────────────────────────────────────

def build_server() -> dict:
    els: list[dict] = []

    # Title
    els.append(free_text("title", 540, 40, "Server HLD — Realtime Chat", font_size=28, align="center"))
    els.append(free_text("subtitle", 500, 80, "Fastify + Socket.IO + Prisma · deployed to Fly.io (bom)", font_size=14, color="#666"))

    # ── Mobile clients (left) ────────────────────────────────────────────
    els += box("clients_group", 60, 140, 280, 200, "", stroke="#868e96", stroke_style="dashed", roundness=None)
    els.append(free_text("clients_label", 80, 150, "Mobile clients", font_size=14, color="#868e96"))
    els += box("ios", 90, 200, 110, 60, "iOS", bg="#e7f5ff", stroke="#1971c2")
    els += box("android", 210, 200, 110, 60, "Android", bg="#e7f5ff", stroke="#1971c2")

    # ── Fly.io group (middle) ────────────────────────────────────────────
    els += box("fly_group", 440, 140, 680, 620, "", stroke="#9775fa", stroke_style="dashed", roundness=None)
    els.append(free_text("fly_label", 460, 150, "Fly.io · Mumbai region · 1 machine, min_running=1", font_size=14, color="#9775fa"))

    # Fastify process
    els += box("fastify_outer", 470, 200, 620, 400, "", stroke="#343a40", stroke_style="dashed", roundness=None)
    els.append(free_text("fastify_label", 490, 212, "Fastify process · Node 22", font_size=14, color="#495057"))

    els += box("middleware", 500, 250, 560, 50, "Middleware — helmet · CORS · rate-limit · authenticate", bg="#fff4e6", stroke="#e8590c", font_size=14)
    els += box("error_handler", 500, 320, 560, 40, "Global error handler → {error: 'internal_error'}", bg="#fff5f5", stroke="#c92a2a", font_size=13)

    els += box("rest", 500, 390, 270, 70, "REST routes\n/auth /me /rooms /users /tags /connections", bg="#d3f9d8", stroke="#2f9e44", font_size=13)
    els += box("sockets", 790, 390, 270, 70, "Socket.IO (chat)\nmessage · typing · presence · read", bg="#d3f9d8", stroke="#2f9e44", font_size=13)

    els += box("zod", 500, 480, 560, 50, "Zod validators · @rtc/contracts (shared with mobile)", bg="#e3fafc", stroke="#0c8599", font_size=14)

    els += box("prisma", 500, 550, 270, 40, "Prisma client", bg="#f3f0ff", stroke="#5f3dc4", font_size=14)
    els += box("privacy_cache", 790, 550, 270, 40, "privacyCache (5-min TTL, Redis)", bg="#f3f0ff", stroke="#5f3dc4", font_size=13)

    # Boot tasks
    els += box("boot", 470, 630, 620, 60, "Boot: warmup `SELECT 1` · 4-min keep-alive ping · Zod env validation", bg="#fff9db", stroke="#f59f00", font_size=13, roundness=None)

    # GitHub Actions side-note
    els += box("ci", 470, 710, 620, 40, "deploy: GitHub Actions `deploy-server.yml` → fly deploy (on approve)", bg="#f8f9fa", stroke="#868e96", stroke_style="dashed", font_size=13)

    # ── External services (right) ───────────────────────────────────────
    els += box("postgres", 1200, 300, 260, 80, "Postgres\n(Neon · us-east-1)", bg="#ffe0e6", stroke="#c2255c", font_size=16)
    els.append(free_text("postgres_note", 1200, 385, "migrations · users · messages\nrooms · connections · tags", font_size=11, color="#868e96"))

    els += box("redis", 1200, 470, 260, 80, "Redis\n(Upstash)", bg="#ffe0e6", stroke="#c2255c", font_size=16)
    els.append(free_text("redis_note", 1200, 555, "Socket.IO adapter (pub/sub)\nprivacy-settings cache", font_size=11, color="#868e96"))

    # ── Arrows ──────────────────────────────────────────────────────────
    # Clients → Fly (HTTPS+WSS)
    els.append(arrow("a1", 340, 230, 470, 230, start_id="android", end_id="fastify_outer"))
    els.append(free_text("a1_label", 355, 210, "HTTPS + WSS", font_size=12, color="#495057"))

    # Middleware → REST / Socket
    els.append(arrow("a2", 600, 300, 600, 390, start_id="middleware", end_id="rest"))
    els.append(arrow("a3", 900, 300, 900, 390, start_id="middleware", end_id="sockets"))

    # REST / Socket → Zod
    els.append(arrow("a4", 620, 460, 700, 480, start_id="rest", end_id="zod"))
    els.append(arrow("a5", 900, 460, 820, 480, start_id="sockets", end_id="zod"))

    # Zod → Prisma / privacyCache
    els.append(arrow("a6", 620, 530, 620, 550, start_id="zod", end_id="prisma"))
    els.append(arrow("a7", 900, 530, 900, 550, start_id="zod", end_id="privacy_cache"))

    # Prisma → Postgres
    els.append(arrow("a8", 770, 570, 1200, 340, start_id="prisma", end_id="postgres"))

    # privacyCache → Redis
    els.append(arrow("a9", 1060, 570, 1200, 510, start_id="privacy_cache", end_id="redis"))

    # Socket.IO ↔ Redis (adapter is bidirectional pub/sub)
    els.append(arrow("a10", 1060, 425, 1200, 490, start_id="sockets", end_id="redis", start_arrowhead="arrow"))
    els.append(free_text("a10_label", 1080, 440, "pub/sub", font_size=11, color="#868e96"))

    return wrap(els)


# ──────────────────────────────────────────────────────────────────────────
# Client HLD
# ──────────────────────────────────────────────────────────────────────────

def build_client() -> dict:
    els: list[dict] = []

    els.append(free_text("title", 540, 40, "Client HLD — Mobile (React Native)", font_size=28, align="center"))
    els.append(free_text("subtitle", 480, 80, "New Architecture · WatermelonDB + Reanimated 4 · offline-first", font_size=14, color="#666"))

    # ── App outer frame ────────────────────────────────────────────────
    els += box("app_group", 60, 140, 1360, 720, "", stroke="#9775fa", stroke_style="dashed", roundness=None)
    els.append(free_text("app_label", 80, 150, "React Native app — iOS + Android (single codebase, RN 0.85)", font_size=14, color="#9775fa"))

    # ── UI layer ───────────────────────────────────────────────────────
    els += box("ui", 100, 200, 1280, 80, "UI layer — Screens · FlashList · Reanimated 4 · Gesture Handler · react-navigation", bg="#d3f9d8", stroke="#2f9e44", font_size=14)

    # ── State layer ────────────────────────────────────────────────────
    els += box("zustand", 100, 310, 300, 80, "Zustand\nephemeral UI state\n(keyboard, drafts)", bg="#fff9db", stroke="#f59f00", font_size=13)
    els += box("query", 430, 310, 300, 80, "TanStack Query\nREST cache\n(auth refresh, user search)", bg="#fff9db", stroke="#f59f00", font_size=13)
    els += box("hooks", 760, 310, 300, 80, "Feature hooks\nuseChatRoom · useConnections\nuseTypingIndicator · usePrivacy", bg="#fff9db", stroke="#f59f00", font_size=13)

    # ── Repository layer ───────────────────────────────────────────────
    els += box("repos", 100, 420, 1280, 70, "Feature repositories — Auth · Room · Message · Tag · Connection · Privacy", bg="#e3fafc", stroke="#0c8599", font_size=14)

    # ── Data / sync layer ──────────────────────────────────────────────
    els += box("mmkv", 100, 520, 260, 90, "MMKV\nprivacy flags\nlast-seen, drafts\n(~30× AsyncStorage)", bg="#f3f0ff", stroke="#5f3dc4", font_size=13)
    els += box("watermelon", 390, 520, 380, 90, "WatermelonDB\nSource of truth\nSQLite via JSI · observables\ndrive the UI", bg="#f3f0ff", stroke="#5f3dc4", font_size=13)
    els += box("keychain", 800, 520, 240, 90, "Keychain\nrefresh tokens\n(encrypted,\nhardware-backed)", bg="#f3f0ff", stroke="#5f3dc4", font_size=13)
    els += box("sync", 1070, 520, 310, 90, "SyncEngine\noutbox · drain\nack reconcile\nidempotent replay", bg="#ffe0e6", stroke="#c2255c", font_size=13)

    # ── Transport ──────────────────────────────────────────────────────
    els += box("axios", 300, 650, 400, 80, "axios (REST)\nauth interceptor → silent refresh\n30 s timeout, 15 s on /auth/refresh", bg="#fff4e6", stroke="#e8590c", font_size=13)
    els += box("socketio", 740, 650, 400, 80, "socket.io-client (WS)\nauth callback form (fresh token)\nauto-reconnect with backoff", bg="#fff4e6", stroke="#e8590c", font_size=13)

    # ── External (outside app) ─────────────────────────────────────────
    els += box("server", 540, 900, 400, 80, "Server (Fly.io · Mumbai)\nHTTPS + WSS", bg="#e7f5ff", stroke="#1971c2", font_size=16)

    # ── Arrows ─────────────────────────────────────────────────────────
    # UI → state
    els.append(arrow("b1", 250, 280, 250, 310, start_id="ui", end_id="zustand"))
    els.append(arrow("b2", 580, 280, 580, 310, start_id="ui", end_id="query"))
    els.append(arrow("b3", 910, 280, 910, 310, start_id="ui", end_id="hooks"))

    # state → repos
    els.append(arrow("b4", 250, 390, 250, 420, start_id="zustand", end_id="repos"))
    els.append(arrow("b5", 580, 390, 580, 420, start_id="query", end_id="repos"))
    els.append(arrow("b6", 910, 390, 910, 420, start_id="hooks", end_id="repos"))

    # repos → data/sync
    els.append(arrow("b7", 230, 490, 230, 520, start_id="repos", end_id="mmkv"))
    els.append(arrow("b8", 580, 490, 580, 520, start_id="repos", end_id="watermelon"))
    els.append(arrow("b9", 920, 490, 920, 520, start_id="repos", end_id="keychain"))
    els.append(arrow("b10", 1225, 490, 1225, 520, start_id="repos", end_id="sync"))

    # SyncEngine ↔ WatermelonDB (bidirectional: writes from sync, reads for outbox)
    els.append(arrow("b11", 1070, 565, 770, 565, start_id="sync", end_id="watermelon", start_arrowhead="arrow"))

    # SyncEngine + Keychain → transport
    els.append(arrow("b12", 1225, 610, 940, 650, start_id="sync", end_id="socketio"))
    els.append(arrow("b13", 920, 610, 500, 650, start_id="keychain", end_id="axios"))

    # Transport → server
    els.append(arrow("b14", 500, 730, 700, 900, start_id="axios", end_id="server"))
    els.append(arrow("b15", 940, 730, 800, 900, start_id="socketio", end_id="server"))

    return wrap(els)


def main() -> None:
    root = Path(__file__).resolve().parent.parent
    out_dir = root / "docs" / "hld"
    out_dir.mkdir(parents=True, exist_ok=True)

    (out_dir / "server.excalidraw").write_text(json.dumps(build_server(), indent=2))
    (out_dir / "client.excalidraw").write_text(json.dumps(build_client(), indent=2))

    print(f"✓ wrote {out_dir / 'server.excalidraw'}")
    print(f"✓ wrote {out_dir / 'client.excalidraw'}")
    print()
    print("Next: open each file at https://excalidraw.com (File → Open) or in the")
    print("      VS Code Excalidraw extension. Tweak layout as you like, then")
    print("      export as PNG (File → Save as image / ⌘+S in the app).")


if __name__ == "__main__":
    main()
