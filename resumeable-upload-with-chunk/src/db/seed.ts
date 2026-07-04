import { env } from "@/env";
import { createClient } from "@libsql/client";
import { createHash } from "crypto";
import "dotenv/config";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";
import { chunksTable, filesTable } from "./schema";

const client = createClient({
    url: env.DATABASE_URL!,
});

const db = drizzle(client, { schema });

function hash(input: string) {
    return createHash("sha256").update(input).digest("hex");
}

async function seed() {
    console.log("Seeding database...");

    // Clear old data (chunks first if FK doesn't auto-cascade)
    await db.delete(chunksTable);
    await db.delete(filesTable);

    const now = Date.now();

    // --- File 1: completed ---
    const file1ChunkSize = 1024 * 1024; // 1MB
    const file1Size = 4.5 * 1024 * 1024; // 4.5MB
    const file1TotalChunks = 5;

    const [file1] = await db
        .insert(filesTable)
        .values({
            fileHash: hash("video-presentation.mp4"),
            name: "video-presentation.mp4",
            size: file1Size,
            type: "video/mp4",
            chunkSize: file1ChunkSize,
            totalChunks: file1TotalChunks,
            uploadedChunks: file1TotalChunks,
            status: "completed",
            url: "https://storage.example.com/files/video-presentation.mp4",
            storagePath: "uploads/video-presentation.mp4",
            checksum: hash("video-presentation.mp4-content"),
            completed: true,
            createdAt: now - 86400000, // yesterday
            updatedAt: now - 86000000,
        })
        .returning();

    await db.insert(chunksTable).values(
        Array.from({ length: file1TotalChunks }, (_, i) => ({
            fileId: file1.id,
            chunkIndex: i,
            size: i === file1TotalChunks - 1 ? file1Size % file1ChunkSize : file1ChunkSize,
            storagePath: `tmp/${file1.fileHash}/chunk-${i}`,
            checksum: hash(`chunk-${i}-${file1.fileHash}`),
            uploaded: true,
            createdAt: now - 86400000 + i * 1000,
        }))
    );

    // --- File 2: uploading (some chunks received) ---
    const file2ChunkSize = 2 * 1024 * 1024; // 2MB
    const file2Size = 8 * 1024 * 1024; // 8MB
    const file2TotalChunks = 4;
    const file2UploadedChunks = 2;

    const [file2] = await db
        .insert(filesTable)
        .values({
            fileHash: hash("document-report.pdf"),
            name: "document-report.pdf",
            size: file2Size,
            type: "application/pdf",
            chunkSize: file2ChunkSize,
            totalChunks: file2TotalChunks,
            uploadedChunks: file2UploadedChunks,
            status: "uploading",
            url: null,
            storagePath: null,
            checksum: null,
            completed: false,
            createdAt: now - 3600000, // 1 hour ago
            updatedAt: now - 1800000,
        })
        .returning();

    await db.insert(chunksTable).values(
        Array.from({ length: file2UploadedChunks }, (_, i) => ({
            fileId: file2.id,
            chunkIndex: i,
            size: file2ChunkSize,
            storagePath: `tmp/${file2.fileHash}/chunk-${i}`,
            checksum: hash(`chunk-${i}-${file2.fileHash}`),
            uploaded: true,
            createdAt: now - 3600000 + i * 1000,
        }))
    );

    // --- File 3: pending (no chunks received yet) ---
    await db.insert(filesTable).values({
        fileHash: hash("image-photo.jpg"),
        name: "image-photo.jpg",
        size: 512 * 1024, // 512KB
        type: "image/jpeg",
        chunkSize: 256 * 1024,
        totalChunks: 2,
        uploadedChunks: 0,
        status: "pending",
        url: null,
        storagePath: null,
        checksum: null,
        completed: false,
        createdAt: now,
        updatedAt: null,
    });

    // --- File 4: failed ---
    await db.insert(filesTable).values({
        fileHash: hash("backup-archive.zip"),
        name: "backup-archive.zip",
        size: 15 * 1024 * 1024,
        type: "application/zip",
        chunkSize: 5 * 1024 * 1024,
        totalChunks: 3,
        uploadedChunks: 1,
        status: "failed",
        url: null,
        storagePath: null,
        checksum: null,
        completed: false,
        createdAt: now - 7200000,
        updatedAt: now - 7000000,
    });

    console.log("Seeding done ✅");
}

seed()
    .catch((err) => {
        console.error("Seeding failed ❌", err);
        process.exit(1);
    })
    .finally(() => {
        process.exit(0);
    });