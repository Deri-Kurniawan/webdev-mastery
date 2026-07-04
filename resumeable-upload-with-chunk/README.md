# Resumable File Upload with Chunking

A full-stack demo of resumable file uploads using chunking, content-addressing (SHA-256), and SQLite-based progress tracking. Built with **Next.js 16**, **Drizzle ORM**, **TanStack Query**, and **libSQL** (Turso).

## How It Works

### 1. Client hashes the file

Before transmitting any data, the browser computes a SHA-256 hash of the entire file using `crypto.subtle.digest`. This hash acts as a **content fingerprint** — no two different files share it.

### 2. Client checks upload status

The client calls `GET /api/files/upload/status?fileHash=<hash>` to ask the server:

- **Never seen before** → start from scratch (chunk 0)
- **Already completed** → skip entirely, use existing URL
- **Partially uploaded** → server returns the set of chunk indices already received; client resumes from where it left off

### 3. Client uploads missing chunks

The client splits the file into **1 MB chunks** and sends each missing chunk sequentially as `multipart/form-data` to `POST /api/files/upload`.

Each request includes: `fileHash`, `fileName`, `fileType`, `fileSize`, `chunkIndex`, `totalChunks`, `chunkSize`, and the binary `chunk` blob.

### 4. Server processes each chunk

For each chunk the server:

1. **Checks for duplicates** — if this chunk index already exists in `chunks_table`, it skips (idempotency)
2. **Writes the chunk** to a temp file at `./.temp/<hash>-<index>`
3. **Records the chunk** in `chunks_table` with `fileId`, `chunkIndex`, `size`, and `storagePath`
4. **Atomically increments** `uploadedChunks` counter on `files_table`

### 5. Server merges chunks on completion

When `uploadedChunks === totalChunks`, the server:

1. Reads all chunks from `.temp/` in order
2. Writes them sequentially into `./public/uploads/<hash>-<name>`
3. Deletes the individual temp chunk files
4. Updates `files_table` with the final URL, storage path, and `status: "completed"`

### 6. Response to client

After each chunk the server responds with `{ chunkIndex, received: true, completed: false }`. On the final chunk it returns `{ completed: true, url: "/uploads/..." }`.

### 7. Gallery

`GET /api/files` returns all completed and in-progress uploads. The gallery displays file name, size, type, and upload progress percentage.

## API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/files` | List all uploads |
| `GET` | `/api/files/upload/status?fileHash=` | Check which chunks are already stored |
| `POST` | `/api/files/upload` | Upload a single chunk |
| `DELETE` | `/api/files/:id` | Delete a file and its chunks |

## Tech Stack

- **Framework:** Next.js 16 (App Router, Turbopack)
- **Database:** SQLite via libSQL client + Drizzle ORM
- **State & caching:** TanStack Query (React Query)
- **UI:** Tailwind CSS 4 + shadcn/ui (Radix primitives + Sonner toasts)
- **Validation:** Zod + `@t3-oss/env-nextjs`
- **Linting:** Biome

## Getting Started

```bash
bun install
bun run db:push     # create SQLite schema
bun run dev         # start dev server at localhost:3000
```
