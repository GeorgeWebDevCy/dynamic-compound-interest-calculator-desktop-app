
export type Freedom24Config = {
    apiKey: string
    secretKey: string
}

export type Quote = {
    ticker: string
    ltp: number // Last Trade Price
    chg: number // Change
    pcp: number // Percentage Change
    min_step: number
}

export type PortfolioPosition = {
    ticker: string
    q: number // Quantity
    avg_price: number // Average Price
}

const API_URL = 'https://tradernet.com/api/v2'

async function signRequest(
    apiKey: string,
    secretKey: string,
    cmd: string,
    params: any,
): Promise<string> {
    const payload = `apiKey=${apiKey}&cmd=${cmd}&params=${JSON.stringify(params)}`

    const encoder = new TextEncoder()
    const keyData = encoder.encode(secretKey)
    const msgData = encoder.encode(payload)

    const key = await window.crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign'],
    )

    const signature = await window.crypto.subtle.sign('HMAC', key, msgData)

    // Convert ArrayBuffer to Hex string
    return Array.from(new Uint8Array(signature))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
}

export async function fetchQuote(
    ticker: string,
): Promise<Quote | null> {
    // Note: 'getQuote' might not be the exact v2 command, usually it's getting security info or using the public endpoint.
    // However, for v2, we can often use 'getSecurityInfo' or similar.
    // Based on research, quotes are often fetched via a different endpoint or 'getQuotesJson' if available.
    // Let's try to use the public export endpoint for quotes as it's simpler and documented for quotes.
    // BUT, the user wants "Sync".
    // Let's stick to v2 if possible for consistency, but if not, use the export endpoint.
    // The export endpoint: https://tradernet.com/securities/export?tickers=VUAA

    // Let's try the public endpoint for quotes first as it doesn't strictly require auth for basic data usually,
    // but if we have keys, we might as well use v2 'getSecurityInfo' if it gives price.
    // Actually, 'quotes-get' (public) returns CSV.

    try {
        const response = await fetch(
            `https://tradernet.com/securities/export?tickers=${ticker}&params=ltp,chg,pcp,min_step`,
        )
        if (!response.ok) throw new Error('Failed to fetch quote')

        const text = await response.text()
        // Parse CSV: ticker,ltp,chg,pcp,min_step
        // Example: VUAA,95.20,0.5,0.52,0.01
        const lines = text.trim().split('\n')
        if (lines.length < 1) return null

        // Assuming first line is data if no header, or check format.
        // Usually it returns just the data line if we don't ask for header.

        // Let's try to find the line with the ticker.
        const dataLine = lines.find(l => l.includes(ticker))
        if (!dataLine) return null

        const values = dataLine.split(';') // Tradernet export usually uses ';'
        if (values.length < 4) return null

        return {
            ticker: values[0],
            ltp: parseFloat(values[1].replace(',', '.')), // Handle potential comma decimals
            chg: parseFloat(values[2].replace(',', '.')),
            pcp: parseFloat(values[3].replace(',', '.')),
            min_step: parseFloat(values[4]?.replace(',', '.') ?? '0.01'),
        }
    } catch (e) {
        console.error('Error fetching quote:', e)
        return null
    }
}

export async function fetchPortfolio(config: Freedom24Config): Promise<PortfolioPosition[]> {
    const cmd = 'getPositionJson'
    const params = {}

    const signature = await signRequest(config.apiKey, config.secretKey, cmd, params)

    const formData = new URLSearchParams()
    formData.append('apiKey', config.apiKey)
    formData.append('cmd', cmd)
    formData.append('params', JSON.stringify(params))

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'X-NtApi-Sig': signature,
            },
            body: formData,
        })

        if (!response.ok) throw new Error(`API Error: ${response.status}`)

        const data = await response.json()
        if (!data.result) throw new Error(data.errMsg || 'Unknown API error')

        // Transform result to PortfolioPosition[]
        // data.result.ps is usually the array of positions
        const positions = data.result.ps || []

        return positions.map((p: any) => ({
            ticker: p.i, // 'i' is usually ticker
            q: p.q,      // 'q' is quantity
            avg_price: p.a, // 'a' is average price
        }))
    } catch (e) {
        console.error('Error fetching portfolio:', e)
        throw e
    }
}
