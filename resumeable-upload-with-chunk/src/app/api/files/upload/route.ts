import { db } from '@/db'
import { filesTable, chunksTable } from '@/db/schema'
import fs from 'fs/promises'
import { eq, and, sql } from 'drizzle-orm'

export async function POST(req: Request) {
    const formData = await req.formData()
    const fileHash = formData.get('fileHash') as string
    const fileName = formData.get('fileName') as string
    const fileType = formData.get('fileType') as string
    const fileSize = parseInt(formData.get('fileSize') as string)
    const chunk = formData.get('chunk') as Blob
    const chunkIndex = parseInt(formData.get('chunkIndex') as string)
    const totalChunks = parseInt(formData.get('totalChunks') as string)
    const chunkSize = parseInt(formData.get('chunkSize') as string)

    if (!fileSize || fileSize === 0) {
        return Response.json({ error: 'Invalid file size' }, { status: 400 })
    }

    console.log(`Received chunk ${chunkIndex} of ${totalChunks} for file ${fileName} (hash: ${fileHash})`)

    let fileRecord = await db.query.filesTable.findFirst({
        where: (files, { eq }) => eq(files.fileHash, fileHash)
    })

    if (!fileRecord) {
        console.log({
            fileHash,
            name: fileName,
            size: fileSize,
            type: fileType,
            chunkSize,
            totalChunks,
            uploadedChunks: 0,
            status: 'uploading',
            createdAt: Date.now(),
            completed: false,
        })
        const [inserted] = await db.insert(filesTable).values({
            fileHash,
            name: fileName,
            size: fileSize,
            type: fileType,
            chunkSize,
            totalChunks,
            uploadedChunks: 0,
            status: 'uploading',
            createdAt: Date.now(),
            completed: false,
        }).returning()
        fileRecord = inserted
    }

    // idempotency check: skip if this chunk was already received
    const existingChunk = await db.query.chunksTable.findFirst({
        where: (chunks, { and, eq }) =>
            and(eq(chunks.fileId, fileRecord!.id), eq(chunks.chunkIndex, chunkIndex))
    })

    if (existingChunk) {
        return Response.json({ chunkIndex, received: true, skipped: true })
    }

    // write chunk to temp
    const chunkTempPath = `./.temp/${fileHash}-${chunkIndex}`
    await fs.mkdir('./.temp', { recursive: true })
    const arrayBuffer = await chunk.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    await fs.writeFile(chunkTempPath, buffer)

    // record this chunk in DB
    await db.insert(chunksTable).values({
        fileId: fileRecord!.id,
        chunkIndex,
        size: chunk.size,
        storagePath: chunkTempPath,
        createdAt: Date.now(),
    })

    // atomic increment, not counted manually in JS
    await db.update(filesTable).set({
        uploadedChunks: sql`${filesTable.uploadedChunks} + 1`,
    }).where(eq(filesTable.fileHash, fileHash))

    const updatedFile = await db.query.filesTable.findFirst({
        where: (files, { eq }) => eq(files.fileHash, fileHash)
    })

    if (updatedFile && updatedFile.uploadedChunks === updatedFile.totalChunks) {
        const chunks = await db.query.chunksTable.findMany({
            where: (chunks, { eq }) => eq(chunks.fileId, updatedFile.id),
            orderBy: (chunks, { asc }) => asc(chunks.chunkIndex)
        })

        const mergedFilePath = `./public/uploads/${fileHash}-${fileName}`
        await fs.mkdir('./public/uploads', { recursive: true })
        const fileHandle = await fs.open(mergedFilePath, 'w')

        try {
            for (const c of chunks) {
                const tempPath = `./.temp/${fileHash}-${c.chunkIndex}`
                const chunkBuffer = await fs.readFile(tempPath)
                await fileHandle.write(chunkBuffer)
                await fs.unlink(tempPath)
            }
        } finally {
            await fileHandle.close()
        }

        await db.update(filesTable).set({
            url: `/uploads/${fileHash}-${fileName}`,
            storagePath: mergedFilePath,
            status: 'completed',
            completed: true,
            updatedAt: Date.now(),
        }).where(eq(filesTable.fileHash, fileHash))

        return Response.json({
            fileHash,
            chunkIndex,
            received: true,
            completed: true,
            url: `/uploads/${fileHash}-${fileName}`,
        })
    }

    return Response.json({
        fileHash,
        chunkIndex,
        totalChunks,
        received: true,
        completed: false,
    })
}