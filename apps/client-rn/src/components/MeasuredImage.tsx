import React, {useEffect, useRef} from 'react'
import { FasterImageView } from '@candlefinance/faster-image'

// Minimal wrapper to measure image load time for profiling
export default function MeasuredImage(props: any){
    const { source } = props
    const url = source?.url
    const startRef = useRef<number | null>(null)

    useEffect(()=>{
        if(url){
            startRef.current = Date.now()
            console.log(`[MeasuredImage] start load ${url}`)
        }
    }, [url])

    const onLoad = (evt?: any) => {
        const duration = startRef.current ? Date.now() - startRef.current : -1
        console.log(`[MeasuredImage] loaded ${url} in ${duration}ms`)
        props.onLoad?.(evt)
    }

    const onError = (err: any) => {
        console.log(`[MeasuredImage] error loading ${url}:`, err?.message || err)
        props.onError?.(err)
    }

    return <FasterImageView {...props} onLoad={onLoad} onError={onError} />
}
