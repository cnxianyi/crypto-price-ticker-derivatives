import { BaseTickerProvider } from '.';
import got from 'got';
import { ApiClientError } from '../errors';

export interface BinanceTicker {
  price: number;
  open: number;
  high: number;
  low: number;
  change: number;
  percent: number;
}

export interface BinanceTickerData {
  symbol: string;
  lastPrice: string;
  openPrice: string;
  highPrice: string;
  lowPrice: string;
  priceChange: string;
  priceChangePercent: string;
}

export class BinanceTickerProvider extends BaseTickerProvider {
  constructor(apiKey?: string, secretKey?: string) {
    super(apiKey, secretKey, 'Binance');
  }

  async getTickers(): Promise<BinanceTickerData[]> {
    const url = 'https://fapi.binance.com/fapi/v1/ticker/24hr';

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const options: any = {
          headers: {
            'User-Agent': 'CryptoPriceTicker/1.0',
            'Accept': 'application/json'
          },
          timeout: {
            request: 15000
          },
          retry: {
            limit: 0
          },
          http2: false,
          followRedirect: true,
          maxRedirects: 3
        };

        if (this.apiKey) {
          options.headers['X-MBX-APIKEY'] = this.apiKey;
        }

        if (attempt > 0) {
          const baseDelay = 2000 * attempt;
          const jitter = Math.random() * 1000;
          await new Promise(resolve => setTimeout(resolve, baseDelay + jitter));
        }

        const response = await got(url, options);
        const data = JSON.parse(response.body);

        if (this.isApiError(data)) {
          this.handleApiError(data, attempt);
        }

        if (!Array.isArray(data)) {
          throw new Error('Unexpected Binance futures ticker response format');
        }

        console.log(`Binance: Successfully retrieved ${data.length} futures tickers`);
        return data;
      } catch (error: any) {
        console.warn(`Binance: Failed to fetch futures tickers (attempt ${attempt + 1}/3):`, error.message);

        if (attempt < 2) {
          continue;
        }

        throw new Error(`Could not retrieve Binance futures tickers: ${error.message}`);
      }
    }

    throw new Error('Could not retrieve Binance futures tickers');
  }

  async getTicker(symbol: string, currency: string, allTickers: BinanceTickerData[]): Promise<BinanceTicker> {
    const tickerData = allTickers.find(ticker => ticker.symbol === `${symbol}${currency.toUpperCase()}`);

    if (!tickerData) {
      throw new Error(`Could not retrieve futures price for ${symbol} from Binance`);
    }

    return {
      price: parseFloat(tickerData.lastPrice),
      open: parseFloat(tickerData.openPrice),
      high: parseFloat(tickerData.highPrice),
      low: parseFloat(tickerData.lowPrice),
      change: parseFloat(tickerData.priceChange),
      percent: parseFloat(parseFloat(tickerData.priceChangePercent).toFixed(2))
    };
  }

  protected isApiError(data: any): boolean {
    // Binance API errors have 'code' and 'msg' fields
    return data && typeof data.code === 'number' && data.code !== 200;
  }

  protected handleApiError(data: any, retries: number): void {
    const code = data.code;
    const message = data.msg || 'Unknown Binance API error';

    console.error(`Binance API Error [${code}]: ${message}`);

    switch (code) {
      case -1000:
        throw new ApiClientError(`Binance: System error - ${message}`, code);
      case -1001:
        throw new ApiClientError(`Binance: Network error - ${message}`, code);
      case -1002:
        throw new ApiClientError(`Binance: Authorization failed - ${message}`, code);
      case -1003:
        // Rate limit - can retry
        if (retries < 2) {
          console.warn(`Binance: Rate limit hit (${message}), will retry...`);
          throw new ApiClientError(`Binance: Rate limit - ${message}`, code);
        } else {
          throw new ApiClientError(`Binance: Rate limit exceeded - ${message}`, code);
        }
      case -1015:
        throw new ApiClientError(`Binance: Too many requests - ${message}`, code);
      case -1021:
        throw new ApiClientError(`Binance: Invalid timestamp - ${message}`, code);
      default:
        throw new ApiClientError(`Binance: API error [${code}] - ${message}`, code);
    }
  }
}
