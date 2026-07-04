import { int, sqliteTable, text, real } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

export const filesTable = sqliteTable("files_table", {
    id: int().primaryKey({ autoIncrement: true }),
    fileHash: text().notNull().unique(), // unique file fingerprint
    name: text().notNull(),
    size: int().notNull(),         // total file size (bytes)
    type: text().notNull(),
    chunkSize: int().notNull(),    // size of each chunk (bytes)
    totalChunks: int().notNull(),  // expected number of chunks
    uploadedChunks: int().notNull().default(0), // count of chunks already received
    status: text({ enum: ["pending", "uploading", "completed", "failed"] })
        .notNull()
        .default("pending"),
    url: text(),                   // null until upload completes & file is merged
    storagePath: text(),           // path/key in storage (S3, local disk, etc.) before becoming a public URL
    checksum: text(),              // optional: hash (md5/sha256) for integrity verification
    completed: int({ mode: "boolean" }).notNull().default(false),
    createdAt: int().notNull(),
    updatedAt: int(),
});

export const chunksTable = sqliteTable("chunks_table", {
    id: int().primaryKey({ autoIncrement: true }),
    fileId: int()
        .notNull()
        .references(() => filesTable.id, { onDelete: "cascade" }),
    chunkIndex: int().notNull(),   // chunk sequence (0, 1, 2, ...)
    size: int().notNull(),         // size of this chunk (bytes), can differ in the last chunk
    storagePath: text().notNull(), // temporary storage location for the chunk (before merging)
    checksum: text(),              // optional: hash per chunk for validation
    uploaded: int({ mode: "boolean" }).notNull().default(false),
    createdAt: int().notNull(),
});

export const filesRelations = relations(filesTable, ({ many }) => ({
    chunks: many(chunksTable),
}));

export const chunksRelations = relations(chunksTable, ({ one }) => ({
    file: one(filesTable, {
        fields: [chunksTable.fileId],
        references: [filesTable.id],
    }),
}));
