"use client"

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React, { FC } from 'react'

const queryClient = new QueryClient()

const TanstackProviderWrapper: FC<{
    children: React.ReactNode
}> = ({ children }) => {
    return (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    )
}

export default TanstackProviderWrapper