// Copyright (c) Mavis2103. Licensed under the MIT license.
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
  private items: { [key: string]: vscode.StatusBarItem } = {};

  private tickers: Ticker[];
  private tickerProviders: TickerProvider[] = [];
  private allTokens: { [key: string]: any[] } = {};
  private lastSuccessfulTokens: { [key: string]: any[] } = {}; // Cache for fallback
  private isRefreshing = false;
  private higherColor: string;
  private lowerColor: string;

  // construct a new ticker based on a ticker definition
  constructor(tickers: Ticker[]) {
    this.tickers = tickers;

    const configuration: any = vscode.workspace.getConfiguration().get('crypto-price-ticker');
    this.higherColor = configuration.higherColor || 'lightgreen';
    this.lowerColor = configuration.lowerColor || 'coral';

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

    // create status bar items for each configured ticker
    this.tickers.forEach((ticker, priority) => {
      this.items[this.getItemKey(ticker, priority)] = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, priority);
    });

    // handle the first refresh call
    this.refresh();
  }

  // dispose of the ticker
  dispose() {
    // hide and dispose the status bar item
    Object.values(this.items).forEach(item => {
      item.hide();
      item.dispose();
    });
  }

  private getItemKey(ticker: Ticker, index: number): string {
    return `${ticker.provider}:${ticker.symbol}:${ticker.currency}:${index}`;
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
      for (const [index, ticker] of this.tickers.entries()) {
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
          const item = this.items[this.getItemKey(ticker, index)];

          // set the status bar item text using the template
          item.text = this.formatTickerText(ticker, tickerData);
          // set the status bar item colour based on the percent change
          item.color = tickerData.percent < 0 ? this.lowerColor : this.higherColor;
          // make sure the status bar item is visible
          item.show();
        } catch (error: any) {
          console.error(`Error refreshing ${ticker.symbol} from ${ticker.provider}:`, error.message);
          const item = this.items[this.getItemKey(ticker, index)];

          // Display error message on status bar
          if (error.name === 'AuthError') {
            item.text = `${ticker.symbol}: API Key error`;
            item.color = 'red';
          } else if (error.name === 'NetworkError') {
            item.text = `${ticker.symbol}: Network error`;
            item.color = 'orange';
          } else {
            item.text = `${ticker.symbol}: Error`;
            item.color = 'red';
          }
          item.show();
        }
      }
    } catch (error: any) {
      console.error('Error refreshing all tickers:', error.message);
      // Display error message on all items
      Object.values(this.items).forEach(item => {
        item.text = 'Connection error';
        item.color = 'red';
        item.show();
      });
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
