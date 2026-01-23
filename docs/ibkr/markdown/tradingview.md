# TradingView

## Introduction

[TradingView](https://tradingview.com) is an popular third party software provider that supports a connection with Interactive Brokers as an available avenue for charting.

## Requirements

Interactive Brokers clients that wish to connect with TradingView will need to maintain an account with both TradingView and Interactive Brokers.

There are some additional requirements users may want to be considerate of:

  - Users that want market data from Interactive Brokers must maintain $500 USD + cost of subscriptions
      - Please see our [Market Data](/campus/ibkr-api-page/market-data-subscriptions/) page for more details
  - Interactive Brokers requires a user have relevant trading permission for each security type they wish to trade. This distinguishes Stocks, Options, Futures, Crypto, and beyond.
      - See our guide on [Adding Trading Permissions](/campus/trading-lessons/trade-permissions-mkt/) for more information.

## Troubleshooting & Support

Clients facing issues with their integration between Interactive Brokers and TradingView should always create a ticket with both TradingView and Interactive Brokers.

Interactive Brokers is always happy to help investigate an array of issues with our trading systems. TradingView is always eager to assist their clients; however, due to customer service policy, TradingView Support is limited in their ability to investigate unless a ticket is created by the affected user. As a result, Interactive Brokers cannot escalate all issues on a client’s behalf, and a ticket must be created by TradingView users directly.

[Create an IBKR Ticket](https://www.ibkrguides.com/orgportal/messagecenter/creatingaticket.htm) [TradingView Ticket Center](https://www.tradingview.com/support/tickets/)

## Connecting TradingView with Interactive Brokers

1\. Log in to [tradingview.com](https://www.tradingview.com/chart/).  
2\. Select the Trading Panel tab on the bottom window of TradingView.

For some users, this screen may be minimized, and users will need to expand it.

3\. Choose the Interactive Brokers tile in the Trading Panel. The position of the tile in the window may vary.  
4\. Click the Connect button in the pop-up.

5\. Sign in with your Interactive Brokers credentials

6\. The Trading Panel tab containing brokers will update to showcase your positions held at Interactive Brokers. You will also see tabs for your orders, trade history, balances, and more.

## Log Out Of Your Interactive Brokers Account

Many users may utilize Interactive Brokers Live and Paper accounts on TradingView or may need to logout of TradingView to interact with other brokers. The instructions below showcase how to logout of an account so a user can [Connect with Interactive Brokers](/campus/ibkr-api-page/tradingview/#connection) using a different set of credentials.

1.  Users would start by selecting the Interactive Brokers Live/Paper option shown in the Trading Panel next to their username.
2.  Next a user would need to select “Log out Interactive Brokers”.
3.  This will show the Trading Panel as it had appeared when first connecting with TradingView. At this point, users can select the Interactive Brokers icon to login with their credentials.

## Which securities are supported between TradingView and Interactive Brokers?

Interactive Brokers currently supports Stocks, U.S. Equity & Index Options, Futures, Crypto, and Forex contracts in our integration with TradingView. Please be aware that your Interactive Brokers account must have these trading permissions enabled to access them through TradingView.

  - Please see [here](https://www.ibkrguides.com/clientportal/tradingpermissions.htm) for more details on requesting trading permissions.
  - Users planning to trade Forex must have Virtual Forex permissions enabled at Interactive Brokers. Please see [here](https://www.ibkrguides.com/clientportal/virtualfxtracking.htm) for more details on how to register.

Bonds, CFDs, Futures Options, EMEA & APAC Options, and Warrants are not available for trade through TradingView.

### Finding IBKR Supported Instruments in TradingView

In order to confirm you are looking at a symbol supported by Interactive Brokers, make sure to select the Interactive Brokers checkbox while searching for symbols.

If the Interactive Brokers check box is grey or clear, that means Interactive Brokers is not selected, and you may find non-tradable symbols.

If the Interactive Brokers check box is blue, that means Interactive Brokers is selected and the symbol is tradable with Interactive Brokers.

### Non-tradable Symbols In TradingView

Non-tradable symbols are contracts offered by TradingView that may not be supported by Interactive Brokers. This is most commonly seen from trading security types not supported in our integration, such as Bonds or CLPs.

Non-tradable symbols are contracts offered by TradingView that may not be supported by Interactive Brokers. This is most commonly seen from trading security types not supported in our integration, such as Options or Cryptocurrencies.

## Market Data & TradingView

There are several flexible offerings for users to integrate data between Interactive Brokers and TradingView. This section will help guide users in understanding that path.

### Interactive Brokers & TradingView market data subscriptions

Users are welcome to subscribe to any resource for their market data needs. Interactive Brokers does not require users to use IBKR-provided data.

That being said, Interactive Brokers is required to warn customers about potentially trading with delayed. As such, if customers are trading without IBKR resources, we will warn users on each trade about the dangers of trading without data given we do not have a guarantee that the customer is making an informed decision.

### Market Data Sharing

Users that subscribe to market data through Interactive Brokers will be able to see the corresponding live market data in TradingView in both the chart and order entry window / DOM.

Users that subscribe to market data with TradingView will be able to view data on the TradingView platform, but not in Interactive Brokers’ platforms like Trader Workstation or Client Portal.

### Live Chart Data With Delayed Order Data

In some instances, customers who have purchased market data through TradingView or another resource may see that they are receiving live data in their charts. However, users may see that their Order window within TradingView is showing an orange “D” for Delayed Data. That is because the data within the trading window itself is produced by Interactive Brokers, which would not be paid for in this instance.

At this time, the only method to display live data in the Order window is by purchasing market data directly through Interactive Brokers.

### Delayed Market Data for Orders Warning

If a user is attempting to trade a contract while they do not have market data through Interactive Brokers, users are expected to receive a warning message that must be confirmed before the order is placed.

This does not prevent users from trading with TradingView, and is only intended as a warning message. At this time, the only method to prevent this warning message is by purchasing market data directly through Interactive Brokers.

## Can I use TradingView Pine Script during the connection between IB and TradingView?

Pine Script is not supported for Trading with Interactive Brokers. For more details, please see [TradingView’s support article](https://www.tradingview.com/support/solutions/43000481026-how-to-autotrade-using-pine-script-strategies/).

Pine script can still be used for market data indicators as it is broker-agnostic. Users interested in implementing Pine Script for this structure are welcome to contact TradingView directly for assistance, as Interactive Brokers cannot comment on the third-party implementation structure.

## Why can't I add a Take Profit or Stop loss to my order in TradingView?

Interactive Brokers only allows orders to be bracketed so long as the order is still open and has not been executed. Once an order has executed, no modifications or brackets can be added to an order.

Child orders can be added to open orders on the TradingView “Trade” window, or by selecting the “TP” or “SL” icons beside your order in the chart.
