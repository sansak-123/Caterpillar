"""Tiny in-memory WebSocket broadcast registry for /ws/supervisor. A single-process
hackathon scope is fine here — a multi-instance deployment would need a pub/sub layer
(Redis, etc.) instead, but that's out of scope for this demo backend."""

from __future__ import annotations

from fastapi import WebSocket


class SupervisorConnectionManager:
    def __init__(self) -> None:
        self._connections: set[WebSocket] = set()

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections.add(websocket)

    def disconnect(self, websocket: WebSocket) -> None:
        self._connections.discard(websocket)

    async def broadcast(self, message: dict) -> None:
        dead = []
        for connection in self._connections:
            try:
                await connection.send_json(message)
            except Exception:
                dead.append(connection)
        for connection in dead:
            self.disconnect(connection)


supervisor_manager = SupervisorConnectionManager()
