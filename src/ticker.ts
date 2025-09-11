// Copyright (c) Mavis2103. Licensed under the MIT license.
// See LICENSE file in the project root for full license information.

import * as vscode from 'vscode';
import { TickerProvider } from './tickerProvider';
import { BinanceTickerProvider } from './binanceTickerProvider';
import { OKXTickerProvider } from './okxTickerProvider';

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
  private higherColor: string;
  private lowerColor: string;

  // construct a new ticker based on a ticker definition
  constructor(tickers: Ticker[]) {
    this.tickers = tickers;

    const configuration: any = vscode.workspace.getConfiguration().get('crypto-price-ticker');
    this.higherColor = configuration.higherColor || 'lightgreen';
    this.lowerColor = configuration.lowerColor || 'coral';

    this.tickers.forEach(ticker => {
      let tickerProvider: TickerProvider;
      switch (ticker.provider) {
        case 'Binance':
          tickerProvider = new BinanceTickerProvider(configuration.providers?.binance?.apiKey, configuration.providers?.binance?.secretKey);
          break;
        case 'OKX':
          tickerProvider = new OKXTickerProvider(configuration.providers?.okx?.apiKey, configuration.providers?.okx?.secretKey);
          break;
        default:
          throw new Error(`Unknown ticker provider: ${ticker.provider}`);
      }
      this.tickerProviders.push(tickerProvider);
    });

    // create status bar items for each symbol
    this.tickers.forEach((ticker, priority) => {
      this.items[ticker.symbol] = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, priority);
    });

    this.getAllTokens();
    setInterval(() => this.getAllTokens(), 60000);

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

  // refresh the ticker
  refresh() {
    (async () => {
      try {
        await this.getAllTokens();
        for (const ticker of this.tickers) {
          try {
            const tickerProvider = this.tickerProviders.find(
              provider =>
                (provider instanceof BinanceTickerProvider && ticker.provider === 'Binance') ||
                (provider instanceof OKXTickerProvider && ticker.provider === 'OKX')
            );
            if (!tickerProvider) {
              continue;
            }
            const allTokensForProvider = this.allTokens[ticker.provider];
            const tickerData = await tickerProvider.getTicker(ticker.symbol, ticker.currency, allTokensForProvider);
            const item = this.items[ticker.symbol];

            // set the status bar item text using the template
            item.text = ticker.template
              .replace('{symbol}', ticker.symbol)
              .replace('{price}', tickerData.price.toString())
              .replace('{open}', tickerData.open.toString())
              .replace('{high}', tickerData.high.toString())
              .replace('{low}', tickerData.low.toString())
              .replace('{change}', tickerData.change.toString())
              .replace('{percent}', (tickerData.percent >= 0 ? '+' : '') + tickerData.percent + '%');
            // set the status bar item colour based on the percent change
            item.color = tickerData.percent < 0 ? this.lowerColor : this.higherColor;
            // make sure the status bar item is visible
            item.show();
          } catch (error: any) {
            console.error(`Error refreshing ${ticker.symbol} from ${ticker.provider}:`, error.message);
            const item = this.items[ticker.symbol];

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
      }
    })();
  }

  async getAllTokens() {
    try {
      for (const tickerProvider of this.tickerProviders) {
        if (tickerProvider instanceof BinanceTickerProvider) {
          const binanceTickers = await tickerProvider.getTickers();
          this.allTokens['Binance'] = binanceTickers;
        } else if (tickerProvider instanceof OKXTickerProvider) {
          const okxTickers = await tickerProvider.getTickers();
          this.allTokens['OKX'] = okxTickers;
        }
      }
    } catch (error: any) {
      console.error('Error retrieving all tokens:', error.message);
      // Don't throw error to avoid stopping entire refresh
    }
  }
}
