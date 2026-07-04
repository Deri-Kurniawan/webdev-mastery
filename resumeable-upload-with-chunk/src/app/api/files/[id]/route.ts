import { db } from '@/db'
import { filesTable } from '@/db/schema'
import { eq } from 'drizzle-orm'
import fs from 'node:fs/promises'

export async function DELETE(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    const fileId = parseInt(id, 10)

    const fileRecord = await db.query.filesTable.findFirst({
        where: (files, { eq }) => eq(files.id, fileId)
    })

    if (!fileRecord) {
        return Response.json({ error: 'File not found' }, { status: 404 })
    }

    if (fileRecord.storagePath) {
        await fs.unlink(fileRecord.storagePath).catch(() => { })
    }

    const chunks = await db.query.chunksTable.findMany({
        where: (chunks, { eq }) => eq(chunks.fileId, fileId)
    })
    for (const chunk of chunks) {
        await fs.unlink(chunk.storagePath).catch(() => { })
    }

    await db.delete(filesTable).where(eq(filesTable.id, fileId))

    return Response.json({ success: true })
}
