"use client"

import {
    Field,
    FieldDescription,
    FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { env } from "@/env"
import { hashFile } from "@/lib/utils"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { CheckCircle2, UploadCloud, XCircle } from "lucide-react"
import { FormEvent, useRef, useState } from "react"
import { toast } from "sonner"
import { Button } from "./ui/button"

function formatBytes(bytes: number) {
    if (bytes === 0) return '0 B'
    const units = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`
}

type UploadStatus = 'idle' | 'uploading' | 'success' | 'error'

const FileUpload = () => {
    const formRef = useRef<HTMLFormElement>(null)
    const queryClient = useQueryClient()

    const [progress, setProgress] = useState(0)
    const [status, setStatus] = useState<UploadStatus>('idle')
    const [uploadedBytes, setUploadedBytes] = useState(0)
    const [totalBytes, setTotalBytes] = useState(0)
    const [speed, setSpeed] = useState(0) // bytes/sec
    const [fileName, setFileName] = useState('')

    async function uploadFile(file: File, fileHash: string) {
        const CHUNK_SIZE = 1024 * 1024 // 1MB
        const totalChunks = Math.ceil(file.size / CHUNK_SIZE)

        setTotalBytes(file.size)
        setFileName(file.name)

        // check which chunks have already been uploaded
        const statusRes = await fetch(
            `${env.NEXT_PUBLIC_BASE_APP_URL}/api/files/upload/status?fileHash=${fileHash}`
        ).then(res => res.json())

        const receivedSet = new Set<number>(statusRes.receivedChunks ?? [])

        // if this file was already completed, finish immediately
        if (statusRes.status === 'completed') {
            setProgress(100)
            setUploadedBytes(file.size)
            return { fileHash, status: 'complete' }
        }

        const startTime = Date.now()

        // calculate initial progress from existing chunks
        const alreadyUploadedBytes = receivedSet.size * CHUNK_SIZE
        setUploadedBytes(Math.min(alreadyUploadedBytes, file.size))
        setProgress(Math.round((receivedSet.size / totalChunks) * 100))

        for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
            if (receivedSet.has(chunkIndex)) {
                continue // skip, already uploaded — not sent again
            }

            const start = chunkIndex * CHUNK_SIZE
            const end = Math.min(start + CHUNK_SIZE, file.size)
            const chunk = file.slice(start, end)
            const chunkFormData = new FormData()

            chunkFormData.append('fileHash', fileHash)
            chunkFormData.append('fileName', file.name)
            chunkFormData.append('fileType', file.type)
            chunkFormData.append('fileSize', file.size.toString())
            chunkFormData.append('totalChunks', totalChunks.toString())
            chunkFormData.append('chunkIndex', chunkIndex.toString())
            chunkFormData.append('chunk', chunk)
            chunkFormData.append('chunkSize', chunk.size.toString())

            const res = await fetch(`${env.NEXT_PUBLIC_BASE_APP_URL}/api/files/upload`, {
                method: 'POST',
                body: chunkFormData
            })

            if (!res.ok) {
                const errorData = await res.json().catch(() => null)
                throw new Error(errorData?.error || `Upload failed at chunk ${chunkIndex}`)
            }

            const result = await res.json()

            if (!result.received) {
                throw new Error(`Chunk ${chunkIndex} not received by server`)
            }

            receivedSet.add(chunkIndex)
            const uploaded = receivedSet.size * CHUNK_SIZE
            const percent = Math.round((receivedSet.size / totalChunks) * 100)
            const elapsedSec = (Date.now() - startTime) / 1000
            const currentSpeed = elapsedSec > 0 ? (uploaded - alreadyUploadedBytes) / elapsedSec : 0

            setProgress(percent)
            setUploadedBytes(Math.min(uploaded, file.size))
            setSpeed(currentSpeed)
        }

        return { fileHash, status: 'complete' }
    }

    const mutation = useMutation({
        mutationFn: ({ file, fileHash }: { file: File, fileHash: string }) =>
            uploadFile(file, fileHash),
        onMutate: () => {
            setStatus('uploading')
            setProgress(0)
            setUploadedBytes(0)
            setSpeed(0)
        },
        onSuccess: () => {
            setStatus('success')
            queryClient.invalidateQueries({ queryKey: ['files'] })
            toast.success('File uploaded successfully!')
        },
        onError: (error: any) => {
            setStatus('error')
            console.error('Upload failed:', error)
            toast.error(error?.message || 'File upload failed. Please try again.')
        }
    })

    const handleUpload = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        if (mutation.isPending) return

        const formData = new FormData(e.currentTarget)
        const file = formData.get('file') as File | null

        if (!file || file.size === 0) {
            toast.error('Please select a file to upload.')
            return
        }

        const fileHash = await hashFile(file)
        mutation.mutate({ file, fileHash })
    }

    const isUploading = status === 'uploading'

    return (
        <form ref={formRef} onSubmit={handleUpload} encType="multipart/form-data">
            <div className="flex items-center gap-4">
                <Field>
                    <FieldLabel htmlFor="file">Picture</FieldLabel>
                    <Input id="file" name="file" type="file" disabled={isUploading} />
                    <FieldDescription>Select a file to upload.</FieldDescription>
                </Field>
                <Button type="submit" disabled={isUploading}>
                    {isUploading ? 'Uploading...' : 'Upload'}
                </Button>
            </div>

            {status !== 'idle' && (
                <div className="mt-4 space-y-2 rounded-md border p-3">
                    <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2 font-medium">
                            {status === 'uploading' && <UploadCloud className="h-4 w-4 animate-pulse text-blue-500" />}
                            {status === 'success' && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                            {status === 'error' && <XCircle className="h-4 w-4 text-red-500" />}
                            <span className="truncate max-w-50">{fileName}</span>
                        </div>
                        <span className="text-gray-500">{progress}%</span>
                    </div>

                    <div className="h-2 w-full overflow-hidden rounded bg-gray-200">
                        <div
                            className={`h-full transition-all duration-200 ${status === 'error'
                                ? 'bg-red-500'
                                : status === 'success'
                                    ? 'bg-green-500'
                                    : 'bg-blue-500'
                                }`}
                            style={{ width: `${progress}%` }}
                        />
                    </div>

                    <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>
                            {formatBytes(uploadedBytes)} / {formatBytes(totalBytes)}
                        </span>
                        {isUploading && speed > 0 && (
                            <span>{formatBytes(speed)}/s</span>
                        )}
                        {status === 'success' && <span className="text-green-600">Completed</span>}
                        {status === 'error' && <span className="text-red-600">Failed</span>}
                    </div>
                </div>
            )}
        </form>
    )
}

export default FileUpload