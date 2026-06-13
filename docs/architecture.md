# AtomLens Relay Architecture

## Overview

AtomLens Relay is a single Node.js service with three responsibilities:

1. Serve the browser application for agents, customers, and admins.
2. Own all real-time session traffic through a custom WebSocket relay.
3. Persist support records, chat, files, events, durations, and recording metadata.

The platform deliberately avoids hosted video APIs. Media is captured in the browser as small WebM chunks and sent to the Node server. The server validates the participant session, optionally appends chunks to a recording stream, and forwards the chunks to the other participant.

## Main Components

| Component | Purpose |
| --- | --- |
| Agent Console | Creates a support session and produces separate agent/customer links. |
| Customer Invite | Validates invite token and joins the customer role. |
| Call Room | Runs local media capture, remote playback, mute/camera controls, chat, files, and recording status. |
| WebSocket Relay | Authenticates role tokens, tracks presence, relays chat/media/control events, and handles reconnect grace. |
| Session Store | Persists sessions to `data/store.json` for demo-friendly query and replay. |
| Upload Store | Saves shared chat files under `data/uploads` with token-protected retrieval. |
| Recording Store | Saves server-relayed role media and creates a downloadable TAR archive. |
| Admin Dashboard | Lists live/history sessions and can end active sessions. |
| Metrics Endpoint | Exposes Prometheus-compatible counters and gauges at `/metrics`. |

## Security and Access Control

- Agent and customer use different tokens.
- Customer invite tokens cannot start recordings or access recording downloads.
- Admin APIs require `x-admin-key` or `adminKey`.
- Shared files are served only when the request includes a valid session token or admin key.
- Filenames are sanitized before storage.
- Duplicate joins for an already connected role are rejected unless the browser is resuming the same client id.

## Reconnect Handling

When a participant socket closes, the server does not immediately broadcast a leave event. It stores the participant's disconnected timestamp and starts a grace timer. If the same role reconnects with the same client id during that window, the session resumes and no drop notification is emitted. If the grace window expires, the participant is marked as left and the event trail is updated.

## Recording Model

The recording feature is server-side because the relay already receives every media chunk. When the agent starts recording, the server appends incoming chunks into per-role WebM files. When stopped, it creates a TAR archive containing:

- `agent.webm`
- `customer.webm`
- `manifest.json`

The manifest includes session ids, timestamps, stream byte counts, chat history, and event history.

## Operational Metrics

`/metrics` returns:

- `atomlens_active_sessions`
- `atomlens_connected_participants`
- `atomlens_total_sessions`
- `atomlens_total_messages`
- `atomlens_error_count`

These are plain Prometheus exposition format metrics and can be scraped by standard monitoring tools.
