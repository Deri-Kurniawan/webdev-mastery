"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "./ui/button"
import { env } from "@/env"

async function getFiles() {
    return fetch(`${env.NEXT_PUBLIC_BASE_APP_URL}/api/files`).then(res => res.json())
}

async function deleteFile(id: number) {
    const res = await fetch(`${env.NEXT_PUBLIC_BASE_APP_URL}/api/files/${id}`, { method: 'DELETE' })
    if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.error || 'Failed to delete file')
    }
    return res.json()
}

const FileGallery = () => {
    const queryClient = useQueryClient()
    const query = useQuery({ queryKey: ['files'], queryFn: getFiles })

    const deleteMutation = useMutation({
        mutationFn: deleteFile,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['files'] })
            toast.success('File deleted successfully!')
        },
        onError: (error: any) => {
            toast.error(error?.message || 'Failed to delete file')
        }
    })

    return (
        <div>
            {query.isLoading && <p>Loading files...</p>}
            {query.isError && <p>Error loading files.</p>}
            {query.isSuccess && query.data.files.length === 0 && <p>No files found.</p>}
            {query.isSuccess && query.data.files.length > 0 && (
                <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                    {query.data.files.map((file: any) => (
                        <li key={file.id} className="border p-2 rounded flex flex-col gap-1">
                            <div className="flex items-start justify-between gap-2">
                                <a
                                    href={file.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm font-medium hover:text truncate"
                                >
                                    {file.name}
                                </a>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="shrink-0 size-6"
                                    disabled={deleteMutation.isPending}
                                    onClick={() => deleteMutation.mutate(file.id)}
                                >
                                    <Trash2 className="size-4 text-red-500" />
                                </Button>
                            </div>
                            <p className="text-xs text-gray-500">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                            <p className="text-xs text-gray-500">{file.type}</p>
                            <p className="text-xs text-gray-500">Status: {file.status} ({Math.round((file.uploadedChunks / file.totalChunks) * 100)})</p>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    )
}

export default FileGallery