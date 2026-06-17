# Crypto Price Ticker Derivatives for VS Code

Monitor real-time cryptocurrency derivatives prices directly in your Visual Studio Code status bar. Stay updated with the latest Binance USD-M Futures prices for Bitcoin, Ethereum, and any other supported coins while you code.

## Key Features

- **Live Crypto Prices**: View up-to-date prices for your favorite cryptocurrencies such as BTC, ETH, and more.
- **Binance Futures Provider**: Fetch data from Binance USD-M Futures.
- **Customizable Tickers**: Choose coins, quote currencies, text color, and display templates.
- **Track Multiple Coins**: Add as many tickers as you want.
- **Auto Refresh**: Set your own refresh interval or update only when VS Code is focused.
- **Lightweight & Fast**: Minimal impact on your workflow and system resources.

## Installation

1. Open Visual Studio Code.
2. Go to the Extensions view (`Ctrl+Shift+X`).
3. Search for `crypto-price-ticker-derivatives` and install it.
4. Or install directly from [Visual Studio Marketplace][marketplace].

[marketplace]: https://marketplace.visualstudio.com/items?itemName=cnxianyi.crypto-price-ticker-derivatives

## How to Use

### Configuration

Edit your VS Code `settings.json` to customize the extension:

```jsonc
// Refresh interval in seconds
"crypto-price-ticker-derivatives.interval": 60,

// Only refresh when VSCode window is focused (true/false)
"crypto-price-ticker-derivatives.onlyRefreshWhenFocused": false,

// Status bar text color. Leave empty to use the default VS Code color.
"crypto-price-ticker-derivatives.color": "",

// Array of ticker definitions
"crypto-price-ticker-derivatives.tickers": [
  {
    "symbol": "BTC",
    "currency": "USDT",
    "provider": "Binance",
    "template": "{symbol} {price} {percent}"
  },
  {
    "symbol": "ETH",
    "currency": "USDT",
    "provider": "Binance",
    "template": "{symbol} {price} {percent}"
  }
],

// Binance API keys (optional, improves rate limits)
"crypto-price-ticker-derivatives.providers": {
  "binance": {
    "apiKey": "",
    "secretKey": ""
  }
}
```

### Template Tags

Customize how each ticker appears in the status bar using these tags:

| Tag     | Description                       |
| ------- | --------------------------------- |
| symbol  | Cryptocurrency symbol (e.g., BTC) |
| price   | Current price                     |
| open    | Opening price for the period      |
| high    | Highest price in the period       |
| low     | Lowest price in the period        |
| change  | Price difference from opening     |
| percent | Percentage change from opening    |

**Example:**

```jsonc
"template": "{symbol} {price} {percent}"
```

### Example Configuration

```jsonc
"crypto-price-ticker-derivatives.tickers": [
  {
    "symbol": "BTC",
    "currency": "USDT",
    "provider": "Binance",
    "template": "{symbol}: {price} ({percent})"
  },
  {
    "symbol": "ETH",
    "currency": "USDT",
    "provider": "Binance",
    "template": "{symbol}: {price} ({percent})"
  }
],
"crypto-price-ticker-derivatives.providers": {
  "binance": {
    "apiKey": "your-binance-api-key",
    "secretKey": "your-binance-secret-key"
  }
}
```

## Supported Crypto Data Provider

- **Binance USD-M Futures** - [binance.com](https://binance.com)

## API Rate Limits

> **Important:** Binance Futures enforces API rate limits. Setting a very low refresh interval or tracking too many tickers may result in temporary bans or incomplete data.
>
> - **Binance Futures**: [API rate limits](https://developers.binance.com/docs/derivatives/usds-margined-futures/market-data/rest-api/24hr-Ticker-Price-Change-Statistics) apply per IP and endpoint.
>
> **Recommendation:** Use a refresh interval of 60 seconds or higher and limit the number of tracked tickers for best results. Providing API keys (optional) can help increase your rate limits and access more data.

## Screenshot

![Crypto Price Ticker Derivatives VS Code Example](https://github.com/cnxianyi/crypto-price-ticker-derivatives/raw/master/images/default.png)

## Why Use Crypto Price Ticker Derivatives for VS Code?

- Instantly see crypto prices without leaving your coding environment.
- Highly customizable and easy to set up.
- Supports the most popular exchanges and coins.

## License

[MIT](LICENSE.md)

---

**Crypto Price Ticker Derivatives for VS Code** - The best way to keep track of cryptocurrency derivatives prices while coding!
