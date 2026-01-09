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
            if (oldestKey) this.imageSourceCache.delete(oldestKey)
        }
        this.imageSourceCache.set(cardInfoId, source)
    }

    private async getSignedHeadersCached(token: string) {
        if (this.headersCache.has(token)) {
            return this.headersCache.get(token)
        }
        const headers = await Http.getSignedInHeaders(token)
        this.headersCache.set(token, headers)
        return headers
    }

    private async buildAndCacheImageSource(matching: CardImageMatching, token: string) {
        try {
            const headers = await this.getSignedHeadersCached(token)
            const url = Http.axios.defaults.baseURL + Http.ENDPOINT_DYAD_MEDIA_CARD_IMAGE + "?card_type=" + matching.type + "&image_id=" + matching.image_id
            const source = { headers, url, fetchedAt: Date.now() }
            this.cacheImageSource(matching.card_info_id, source)
            return source
        } catch (err) {
            // ignore cache building errors
            return null
        }
    }

    subscribeToImageMatching(cardInfoId: string, callback: ((matching: CardImageMatching)=>void) | ((matching: CardImageMatching)=>Promise<void>)): Subscription {
        return this.eventSubject.pipe(filter(event => event.id === cardInfoId), map(event => event.matching)).subscribe(callback)
    }

    registerImageMatchingTask(recommendationId: string, token: string): {cancel:()=>void}{
        let controller = new AbortController()

        Http.getSignedInHeaders(token).then(headers => {
            Http.axios.get(Http.ENDPOINT_DYAD_MEDIA_MATCH_CARD_IMAGES + "/" + recommendationId, {
                headers,
                signal: controller.signal
            }).then(
                result => {
                    const matchings: Array<CardImageMatching> = result.data.matchings
                    console.log("Card image matching result received.", matchings.length)
                    for(const match of matchings){
                        if(this.cardImageMatchingDict.has(match.card_info_id) == false){
                            this.cardImageMatchingDict.set(match.card_info_id, match)
                            this.eventSubject.next({id: match.card_info_id, matching: match})

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