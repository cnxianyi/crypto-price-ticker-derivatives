import { BaseTickerProvider } from './tickerProvider';
import got from 'got';
import { ApiClientError } from './errors';

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
    try {
      const url = 'https://api.binance.com/api/v3/ticker/24hr';
      const options: any = {
        headers: {}
      };

      if (this.apiKey) {
        options.headers['X-MBX-APIKEY'] = this.apiKey;
        console.log('Binance: Using API key to increase rate limit');
      }

      const response = await got(url, options);
      const data: BinanceTickerData[] = JSON.parse(response.body);

      console.log(`Binance: Successfully retrieved ${data.length} tickers`);
      return data;
    } catch (error: any) {
      console.error('Binance: Error retrieving tickers:', error.message);

      // If API key fails, try fallback to public API
      if (this.apiKey && !(error instanceof ApiClientError)) {
        console.warn('Binance: Retrying with public API...');
        try {
          const response = await got('https://api.binance.com/api/v3/ticker/24hr');
          const data: BinanceTickerData[] = JSON.parse(response.body);
          console.log(`Binance: Successfully retrieved ${data.length} tickers (public API)`);
          return data;
        } catch (fallbackError: any) {
          console.error('Binance: Even public API failed:', fallbackError.message);
        }
      }

      throw new Error(`Could not retrieve tickers from Binance: ${error.message}`);
    }
  }

  async getTicker(symbol: string, currency: string, allTickers: BinanceTickerData[]): Promise<BinanceTicker> {
    const tickerData = allTickers.find(ticker => ticker.symbol === `${symbol}${currency.toUpperCase()}`);

    if (!tickerData) {
      throw new Error(`Could not retrieve price for ${symbol} from Binance`);
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
