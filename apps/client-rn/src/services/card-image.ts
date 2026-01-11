import { CardImageMatching, Http } from "@aacesstalk/libs/ts-core"
import { Subject, Subscription, filter, map } from "rxjs"

export class CardImageManager{
    private static _instance: CardImageManager | undefined = undefined

    static get instance(): CardImageManager {
        if(this._instance == null){
            this._instance = new CardImageManager()
        }

        return this._instance
    }

    private readonly cardImageMatchingDict: Map<string, CardImageMatching>

    private readonly eventSubject: Subject<{id: string, matching: CardImageMatching}>

    // Cache for constructed image sources (stable objects to avoid re-fetching)
    private readonly imageSourceCache: Map<string, { headers: any, url: string, fetchedAt: number }>

    // Cache signed headers per token to avoid many header requests
    private readonly headersCache: Map<string, any>

    // Maximum number of cached images to keep in memory
    private readonly MAX_IMAGE_CACHE = 200

    private constructor(){
        this.cardImageMatchingDict = new Map()
        this.eventSubject = new Subject()
        this.imageSourceCache = new Map()
        this.headersCache = new Map()
    }

    getCachedMatching(cardInfoId: string): CardImageMatching | null {
        if(this.cardImageMatchingDict.has(cardInfoId)){
            return this.cardImageMatchingDict.get(cardInfoId)
        }else{
            return null
        }
    }

    getCachedImageSource(cardInfoId: string): { headers: any, url: string, fetchedAt: number } | null {
        if (this.imageSourceCache.has(cardInfoId)) {
            return this.imageSourceCache.get(cardInfoId)
        }
        return null
    }

    private cacheImageSource(cardInfoId: string, source: { headers: any, url: string, fetchedAt: number }) {
        if (this.imageSourceCache.size >= this.MAX_IMAGE_CACHE) {
            // evict oldest
            const oldestKey = this.imageSourceCache.keys().next().value
            if (oldestKey) {
                console.log(`[CardImageManager] evicting cached image source ${oldestKey}`)
                this.imageSourceCache.delete(oldestKey)
            }
        }
        this.imageSourceCache.set(cardInfoId, source)
    }

    private async getSignedHeadersCached(token: string) {
        const now = Date.now()
        if (this.headersCache.has(token)) {
            const cached = this.headersCache.get(token)
            const age = cached?.__fetchedAt ? now - cached.__fetchedAt : -1
            console.log(`[CardImageManager] headers cache hit (age ${age}ms)`)
            return cached
        }
        console.log("[CardImageManager] headers cache miss, fetching headers...")
        const t0 = Date.now()
        const headers = await Http.getSignedInHeaders(token)
        const t1 = Date.now()
        // stash timestamp for profiling
        try{ (headers as any).__fetchedAt = t1 }catch(e){}
        this.headersCache.set(token, headers)
        console.log(`[CardImageManager] fetched headers in ${t1 - t0}ms`)
        return headers
    }

    private async buildAndCacheImageSource(matching: CardImageMatching, token: string) {
        try {
            const t0 = Date.now()
            const headers = { ...(await this.getSignedHeadersCached(token)), Accept: 'image/webp,image/*,*/*' }
            const url = Http.axios.defaults.baseURL + Http.ENDPOINT_DYAD_MEDIA_CARD_IMAGE + "?card_type=" + matching.type + "&image_id=" + matching.image_id
            const source = { headers, url, fetchedAt: Date.now() }
            this.cacheImageSource(matching.card_info_id, source)
            const t1 = Date.now()
            console.log(`[CardImageManager] built image source for ${matching.card_info_id} (url=${url}) in ${t1 - t0}ms`)

            // Optional lightweight HEAD request for profiling in dev builds
            if (typeof __DEV__ !== 'undefined' && __DEV__) {
                try{
                    const t2 = Date.now()
                    // Use relative endpoint with same headers to avoid double baseURL
                    const headResp = await Http.axios.head(Http.ENDPOINT_DYAD_MEDIA_CARD_IMAGE + "?card_type=" + matching.type + "&image_id=" + matching.image_id, { headers })
                    const t3 = Date.now()
                    const size = headResp.headers?.['content-length'] || 'unknown'
                    console.log(`[CardImageManager] HEAD ${matching.image_id} size=${size} in ${t3 - t2}ms`)
                }catch(e){
                    console.log('[CardImageManager] HEAD failed for profiling', e?.message || e)
                }
            }

            return source
        } catch (err) {
            // ignore cache building errors
            console.log('[CardImageManager] buildAndCacheImageSource error', err)
            return null
        }
    }

    subscribeToImageMatching(cardInfoId: string, callback: ((matching: CardImageMatching)=>void) | ((matching: CardImageMatching)=>Promise<void>)): Subscription {
        return this.eventSubject.pipe(filter(event => event.id === cardInfoId), map(event => event.matching)).subscribe(callback)
    }

    registerImageMatchingTask(recommendationId: string, token: string): {cancel:()=>void}{
        let controller = new AbortController()

        const tStart = Date.now()
        Http.getSignedInHeaders(token).then(headers => {
            const reqUrl = Http.ENDPOINT_DYAD_MEDIA_MATCH_CARD_IMAGES + "/" + recommendationId
            console.log(`[CardImageManager] requesting matchings for ${recommendationId}`)
            Http.axios.get(reqUrl, {
                headers,
                signal: controller.signal
            }).then(
                result => {
                    const tEnd = Date.now()
                    const matchings: Array<CardImageMatching> = result.data.matchings
                    console.log(`[CardImageManager] Card image matching result received for ${recommendationId}: ${matchings.length} items in ${tEnd - tStart}ms`)
                    for(const match of matchings){
                        if(this.cardImageMatchingDict.has(match.card_info_id) == false){
                            this.cardImageMatchingDict.set(match.card_info_id, match)
                            this.eventSubject.next({id: match.card_info_id, matching: match})
                            console.log(`[CardImageManager] published matching for ${match.card_info_id}`)

                            // build and cache a stable image source so consumers don't need to fetch headers repeatedly
                            void this.buildAndCacheImageSource(match, token)
                        }
                    }
                }
            ).catch((err) => {
                console.log(err)
            }).finally(()=>{
                controller = null
            })
        })


        return {
            cancel:()=>{
                console.log("controller: ", controller)
                controller?.abort()
            }
        }
    }
}