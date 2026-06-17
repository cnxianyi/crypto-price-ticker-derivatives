// Copyright (c) cnxianyi. Licensed under the MIT license.
// See LICENSE file in the project root for full license information.

import * as vscode from 'vscode';
import { TickerProvider } from './providers';
import { BinanceTickerProvider } from './providers/binance';

// represents a ticker object
export interface Ticker {
  symbol: string;
  currency: string;
  exchange: string;
  template: string;
  provider: string;
}

export class Tickers {
  // the tickers status bar item
  private item: vscode.StatusBarItem;

  private tickers: Ticker[];
  private tickerProviders: TickerProvider[] = [];
  private allTokens: { [key: string]: any[] } = {};
  private lastSuccessfulTokens: { [key: string]: any[] } = {}; // Cache for fallback
  private isRefreshing = false;
  private color: string | undefined;

  // construct a new ticker based on a ticker definition
  constructor(tickers: Ticker[]) {
    this.tickers = tickers;
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0);

    const configuration: any = vscode.workspace.getConfiguration().get('crypto-price-ticker-derivatives');
    this.color = typeof configuration.color === 'string' && configuration.color.trim() !== '' ? configuration.color : undefined;

    // Get unique providers that are actually used
    const usedProviders = [...new Set(this.tickers.map(ticker => ticker.provider))];

    // Create only one instance per provider type
    usedProviders.forEach(providerName => {
      let tickerProvider: TickerProvider;
      switch (providerName) {
        case 'Binance':
          tickerProvider = new BinanceTickerProvider(configuration.providers?.binance?.apiKey, configuration.providers?.binance?.secretKey);
          break;
        default:
          throw new Error(`Unknown ticker provider: ${providerName}`);
      }
      this.tickerProviders.push(tickerProvider);
    });

    // handle the first refresh call
    this.refresh();
  }

  // dispose of the ticker
  dispose() {
    this.item.hide();
    this.item.dispose();
  }

  private formatTickerText(ticker: Ticker, tickerData: any): string {
    let text = ticker.template;
    const replacements: { [key: string]: string } = {
      symbol: ticker.symbol,
      price: tickerData.price.toString(),
      open: tickerData.open.toString(),
      high: tickerData.high.toString(),
      low: tickerData.low.toString(),
      change: tickerData.change.toString(),
      percent: (tickerData.percent >= 0 ? '+' : '') + tickerData.percent + '%'
    };

    Object.keys(replacements).forEach(key => {
      text = text.split(`{${key}}`).join(replacements[key]);
    });

    return text;
  }

  // refresh the ticker
  async refresh() {
    if (this.isRefreshing) {
      console.warn('Ticker refresh skipped because a previous refresh is still running');
      return;
    }

    this.isRefreshing = true;

    try {
      await this.getAllTokens();
      const texts: string[] = [];

      for (const ticker of this.tickers) {
        try {
          const tickerProvider = this.tickerProviders.find(
            provider =>
              provider instanceof BinanceTickerProvider && ticker.provider === 'Binance'
          );
          if (!tickerProvider) {
            continue;
          }
          const allTokensForProvider = this.allTokens[ticker.provider];

          // Skip if no data available for this provider
          if (!allTokensForProvider || allTokensForProvider.length === 0) {
            console.warn(`No data available for ${ticker.provider}, skipping ${ticker.symbol}`);
            continue;
          }

          const tickerData = await tickerProvider.getTicker(ticker.symbol, ticker.currency, allTokensForProvider);

          texts.push(this.formatTickerText(ticker, tickerData));
        } catch (error: any) {
          console.error(`Error refreshing ${ticker.symbol} from ${ticker.provider}:`, error.message);

          // Display error message on status bar
          if (error.name === 'AuthError') {
            texts.push(`${ticker.symbol}: API Key error`);
          } else if (error.name === 'NetworkError') {
            texts.push(`${ticker.symbol}: Network error`);
          } else {
            texts.push(`${ticker.symbol}: Error`);
          }
        }
      }

      this.item.text = texts.join('  ');
      this.item.color = this.color;
      this.item.show();
    } catch (error: any) {
      console.error('Error refreshing all tickers:', error.message);
      this.item.text = 'Connection error';
      this.item.color = this.color;
      this.item.show();
    } finally {
      this.isRefreshing = false;
    }
  }

  async getAllTokens() {
    // Get unique providers that are actually used by configured tickers
    const usedProviders = [...new Set(this.tickers.map(ticker => ticker.provider))];

    for (const tickerProvider of this.tickerProviders) {
      try {
        if (tickerProvider instanceof BinanceTickerProvider && usedProviders.includes('Binance')) {
          const binanceTickers = await tickerProvider.getTickers();
          this.allTokens['Binance'] = binanceTickers;
          this.lastSuccessfulTokens['Binance'] = binanceTickers; // Cache successful data
          console.log('Binance: Successfully updated token data');
        }
      } catch (error: any) {
        const providerName = 'Binance';
        console.error(`Error retrieving tokens from ${providerName}:`, error.message);

        // Use cached data if available, otherwise keep current data
        if (this.lastSuccessfulTokens[providerName]) {
          this.allTokens[providerName] = this.lastSuccessfulTokens[providerName];
          console.warn(`${providerName}: Using cached data due to API error`);
        } else if (!this.allTokens[providerName]) {
          // If no cached data and no current data, initialize empty array
          this.allTokens[providerName] = [];
          console.warn(`${providerName}: No cached data available, using empty array`);
        }
        // If we have current data but no cached data, just keep using current data
      }
    }
  }
}
