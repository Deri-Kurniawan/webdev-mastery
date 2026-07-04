import { db } from '@/db'

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url)
    const fileHash = searchParams.get('fileHash')

    if (!fileHash) {
        return Response.json({ error: 'fileHash required' }, { status: 400 })
    }

    const fileRecord = await db.query.filesTable.findFirst({
        where: (files, { eq }) => eq(files.fileHash, fileHash)
    })

    if (!fileRecord) {
        return Response.json({ receivedChunks: [] })
    }

    const chunks = await db.query.chunksTable.findMany({
        where: (chunks, { eq }) => eq(chunks.fileId, fileRecord.id)
    })

    return Response.json({
        receivedChunks: chunks.map(c => c.chunkIndex),
        status: fileRecord.status,
        url: fileRecord.url,
    })
}