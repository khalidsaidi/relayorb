# Contracts

## Contract Management

### Best Practices

Interactive Brokers does maintain the use of creating contracts in both the Trader Workstation and Client Portal APIs. The default structure will allow the individual to typically reference the ticker symbol, security type, exchange, and currency; however, the best practice recommended by Interactive Brokers for both platforms is to use only the contract identifier, or ConId, and the Exchange instead. This will cover a complete contract without the need for additional parameters.

These conids are static for each and every contract and will never change. Values such as 265598 for AAPL will always remain as the AAPL contract identifier for the underlying stock contract.

### ISLAND to NASDAQ API Compatibility

Since TWS 10.16+, there is one more setting called “*Compatibility Mode: Send ISLAND for US Stocks trading on NASDAQ” in TWS – Global Configuration – API – Settings. This setting will enable all of the contract definitions with ISLAND exchange to be still acknowledged. It is **strongly recommended** **for TWS Users** to start implementing the NASDAQ exchange definition.*

However, ***this setting has not been introduced in IB Gateway yet***. IB Gateway users still need to implement ISLAND exchange definition instead of the *NASDAQ exchange definition.*

### How to Find Contract Details

In TWS, you can right click the symbol and click “Financial Instrument Info” – “Description” or “Details” to find the target contract details information.

### Smart Routing

IB SmartRoutingSM is dedicated to best price execution for our customers. And with that, Interactive Brokers offers an array of SmartRouting options to our Trader Workstation and TWS API users. Users familiar with Trader Workstation are likely already familiar with the process of [Configuring SmartRouting via Global Configuration;](https://ibkrguides.com/tws/usersguidebook/configuretws/configure%20smartrouting.htm)however, these features are available in the API as well.

The values are specifically formatted when submitted through the TWS API, and must follow the specified patterns below.

#### Available throughout TWS API

| SMART Option Algorithm | API String       |
| ---------------------- | ---------------- |
| SMART Multipurpose     | “SMART”          |
| SMART Dark Only        | “SMART DarkOnly” |

#### Available for CAD-currency Exchanges Only

| SMART Option Algorithm                      | API String           |
| ------------------------------------------- | -------------------- |
| SMART Maximize Rebate                       | “SMART MaxRebate”    |
| SMART Maximize Fill                         | “SMART MaxFill”      |
| SMART Prefer Rebate                         | “SMART PreferRebate” |
| SMART Prefer Fill                           | “SMART PreferFill”   |
| SMART Primary Exchange                      | “SMART Primary”      |
| SMART Highest Volume Exchange w/ Rebate     | “SMART VRebate”      |
| SMART Highest Volume Exchange w/ Lowest Fee | “SMART VLowFee”      |

### The Value Exchange

While clients will typically trade a given instrument at a designated exchange, some clients may find their contracts listed as trading on VALUE. The VALUE exchange is a holding exchange used for clients to close positions on a contract that is no longer listed.

A recent example of this is when TWTR / X was recently purchased. In this event, customers would be able to close all existing positions they had on the contract; however, no new positions could be taken. This is a result of the company going private and no longer allowing the stocks to be publicly traded.

## Bonds

**Symbol:** String. The CUSIP of the bond.

**SecType:** String. Always specify as BOND.

**Exchange:** String. Smart may be specified. May direct route if interested.

**Currency:** String. Specify the base currency the BOND is traded with.

``` EnlighterJSRAW
symbol= "912828C57"
secType = "BOND"
exchange = "SMART"
currency = "USD"
```

## CFDs

**Symbol:** String. Specify the symbol of the CFD.

**SecType:** String. Specify CFD.

**Exchange:** String. Specify SMART.

**Currency:** String. Specify the base currency the CFD is traded with.

``` EnlighterJSRAW
 symbol = "IBDE30"
 secType = "CFD"
 currency = "EUR"
 exchange = "SMART"
```

## Commodities

**Symbol:** String. Specify the symbol of the commodity.

**SecType:** String. Specify CMDTY.

**Exchange:** String. Specify SMART.

**Currency:** String. Specify the base currency the commodity is traded with.

``` EnlighterJSRAW
symbol = "XAUUSD"
secType = "CMDTY"
exchange = "SMART"
currency = "USD"
```

## Contracts specified by CUSIP, FIGI, or ISIN

**SecId:** String. Specify the CUSIP, FIGI, or ISIN code of the instrument

**SecIdType:** String. Supports “CUSIP”, “FIGI”, or “ISIN”.

**Exchange:** String. Specify SMART.

``` EnlighterJSRAW
secIdType = "FIGI"
secId = "BBG000B9XRY4"
exchange = "SMART"
```

## Cryptocurrency

**Important:** Please be aware that a Contract ID (conid) will vary for Cryptocurrencies based on their Listing Exchange.

Bitcoin (BTC) held at PAXOS (479624278) will have a different conid than the listing at Zerohash (541686651). This behavior will apply to all other coins.  
 

**Symbol:** String. Specify the symbol of the cryptocurrency.

**SecType:** String. Specify CRYPTO.

**Exchange:** String. Specify PAXOS or ZEROHASH. Not all accounts are permitted for both routing destinations.

**Currency:** String. Only USD is available at this time.  
 

``` EnlighterJSRAW
symbol = "ETH"
secType = "CRYPTO"
currency = "USD"
exchange = "PAXOS"
```

``` EnlighterJSRAW
symbol = "ETH"
secType = "CRYPTO"
currency = "USD"
exchange = "ZEROHASH"
```

WebAPI Orders for Crypto Currencies cannot use the “conid” field. Instead, orders must be submitted using “conidEx” and specifying both the contract identifier in addition to the exchange for trading.

``` EnlighterJSRAW
// BTC ConId
"conidex": "557335679@ZEROHASH"
"conidex": "479624278@PAXOS"
```

## Futures

**Symbol:** String. Specify the underlying symbol of the future.

**SecType:** String. Specify FUT.

**Exchange:** String. Specify the exchange where the future is traded.

**Currency:** String. Specify the currency which the future is traded.

**LastTradeDateOrContractMonth:** String. Enter the month the contract expires. If there are multiple expiries in the same month, exact date must be specified.

**Multiplier:** Integer. Enter the multiplier which the future is traded.

``` EnlighterJSRAW
symbol = "ES"
secType = "FUT"
exchange = "CME"
currency = "USD"
lastTradeDateOrContractMonth = "202809"
multiplier = 50
```

### Continuous Futures

Users may choose to use Continuous Futures as well, which automatically presents the front future contract for customers to request historical data.

This security type can only be used in the TWS API to request historical data.

Continuous Futures can **not** be used:

  - For placing orders
  - For live market data
  - For **specific** historical data. Please be aware that endDateTime must be left as an empty string when requesting historical data for continuous futures contracts.
  - In the Client Portal API

<!-- end list -->

``` EnlighterJSRAW
symbol = "ES"
secType = "CONTFUT"
exchange = "CME"
currency = "USD"
```

### Expired Futures

While they can not be traded, TWS API users can refer to expired Futures contracts by including the [“IncludeExpired”](https://www.interactivebrokers.com/campus/ibkr-api-page/twsapi-ref/#contract-ref:~:text=well.%20For%20example-,IncludeExpired) field. This will permit users to review historical market data for contracts that have expired within the last 2 years.

This functionality is not supported in the web api.

``` EnlighterJSRAW
symbol = "ES"
secType = "FUT"
exchange = "CME"
currency = "USD"
lastTradeDateOrContractMonth = "202309"
IncludeExpired= True
```

## Futures Options

**Symbol:** String. Specify the underlying symbol of the futures option.

**SecType:** String. Specify FOP.

**Exchange:** String. Specify the exchange where the underlying is traded.

**Currency:** String. Specify the base currency of the futures option.

**LastTradeDateOrContractMonth:** String. Enter the month the contract expires. In the event there are multiple expiries in the same month, exact date must be specified.

**Strike:** float. Enter the strike price of the derivative.

**Right:** String. Enter the right, “C” for Calls and “P” for Puts.

**Multiplier:** String. Enter the multiplier of the derivative.

``` EnlighterJSRAW
symbol = "GBL"
secType = "FOP"
exchange = "EUREX"
currency = "EUR"
lastTradeDateOrContractMonth = "20230224"
strike = 138
right = "C"
multiplier = "1000"
```

## FX Pairs

**Symbol:** String. Specify the target currency. For orders, this will dictate the quantity value.

**SecType:** String. Specify CASH.

**Exchange:** String. Specify IDEAL for Virtual Forex or IDEALPRO for true forex trading.

**Currency:** String. Specify the base currency forex pair. This will dictate size with cash quantity trades.

``` EnlighterJSRAW
symbol = "EUR"
secType = "CASH"
exchange = "IDEALPRO"
currency = "GBP"
```

## Indices

**Symbol:** String. Specify the symbol for the index.

**SecType:** String. Specify IND.

**Exchange:** String. Specify the host exchange for the index.

**Currency:** String. Specify the base currency of the index.

``` EnlighterJSRAW
symbol = "DAX"
secType = "IND"
exchange = "EUREX"
currency = "EUR"
```

## Mutual Funds

**Symbol:** String. Specify the symbol for the mutual fund.

**SecType:** String. Specify FUND.

**Exchange:** String. Specify the exchange of the fund. FUNDSERV is the most common.

**Currency:** String. Specify the base currency of the fund.

``` EnlighterJSRAW
symbol = "VINIX"
secType = "FUND"
exchange = "FUNDSERV"
currency = "USD"
```

Note: It is recommended to understand mutual fund orders on TWS UI before implementing via API due to restrictions enforced on trading mutual funds For example to buy ARBIX one requires to use cash quantity ie cashQty while selling ARBIX can be implemented using total quantity ie totalQuantity

## Options

**Symbol:** String. Specify the underlying symbol of the option.

**SecType:** String. Specify OPT.

**Exchange:** String. SMART routing may be specified. May use direct routing such as BOX.

**Currency:** String. Specify the base currency of the option.

**LastTradeDateOrContractMonth:** String. Enter the month the contract expires. In the event there are multiple expiries in the same month, exact date must be specified.

**Strike:** float. Enter the strike price of the derivative.

**Right:** String. Enter the right, “C” for Calls and “P” for Puts.

**Multiplier:** String. Enter the multiplier of the derivative.

``` EnlighterJSRAW
symbol = "GOOG"
secType = "OPT"
exchange = "BOX"
currency = "USD"
lastTradeDateOronth = "20190315"
strike = 1180
right = "C"
multiplier = "100"
```

## Stocks

**Symbol:** String. Specify the symbol for the Stock or ETF.

**SecType:** String. Specify STK.

**Exchange:** String. Smart routing is available. Otherwise, a direct exchange may be specified.

**Currency:** String. Specify the base currency of the stock.

``` EnlighterJSRAW
symbol = "AAPL"
secType = "STK"
exchange = "SMART"
currency = "USD"
```

For certain smart-routed stock that have the same symbol, currency and exchange, you would also need to specify the primary exchange attribute to uniquely define the This should be defined as the native exchange of a and is good practice to include for all stocks.

For the purpose of requesting market data, the routing exchange and primary exchange can be specified in a single ‘exchange’ field if they are separated by a valid component exchange separator, for instance exchange = “SMART:ARCA” The default separators available are colon “:” and slash “/” Other component exchange separators can be defined using the field defined in TWS Global Configuration under API -\> Settings.

**Symbol:** String. Specify the symbol for the Stock or ETF.

**SecType:** String. Specify STK.

**Exchange:** String. Smart routing is available. Otherwise, a direct exchange may be specified.

**Currency:** String. Specify the base currency of the stock.

**PrimaryExchange:** Specify the primary listing exchange of the instrument.

``` EnlighterJSRAW
symbol = "SPY"
secType = "STK"
currency = "USD"
exchange = "SMART"
primaryExchange = "ARCA"
```

## Stock Contract with IPO price

**Symbol:** String. Specify the symbol for the Stock or ETF.

**SecType:** String. Specify STK.

**Exchange:** String. Smart routing is available. Otherwise, a direct exchange may be specified.

**Currency:** String. Specify the base currency of the stock.

``` EnlighterJSRAW
symbol = "EMCGU"
secType = "STK"
currency = "USD"
exchange = "SMART"
```

## Warrants

Warrants, like options, require an expiration date, a right, a strike and a multiplier. For some warrants it will be necessary to define a localSymbol or conId to uniquely identify the contract.

### Standard Warrants

**Symbol:** String. Specify the underlying symbol of the warrant.

**SecType:** String. Specify WAR.

**Exchange:** String. Specify the holding exchange for the warrant. SWB, FWB, and GETTEX are common holding exchanges.

**Currency:** String. Specify the base currency of the warrant.

**LastTradeDateOrContractMonth:** String. Enter the month the contract expires. In the event there are multiple expiries in the same month, exact date must be specified.

**Strike:** float. Enter the strike price of the derivative.

**Right:** String. Enter the right, “C” for Calls and “P” for Puts.

**Multiplier:** String. Enter the multiplier of the derivative.

``` EnlighterJSRAW
symbol = "GOOG"
secType = "WAR"
exchange = "FWB"
currency = "EUR"
lastTradeDateOronth = "20201117"
strike = 15000
right = "C"
multiplier = "001"
```

### Dutch Warrants and Structured Products

**LocalSymbol:** String. Specify the exact symbol of the derivative.

**SecType:** String. Specify IOPT.

**Exchange:** String. Specify the holding exchange for the warrant. SWB, FWB, and GETTEX are common holding exchanges.

**Currency:** String. Specify the base currency of the warrant.

``` EnlighterJSRAW
localSymbol = "B881G"
secType = "IOPT"
exchange = "SBF"
currency = "EUR"
```

To unambiguously define a Dutch Warrant or Structured Product (IOPTs) the conId or localSymbol field must be used.

  - It is important to note that if reqContractDetails is used with an incompletely-defined IOPT contract definition, that thousands of results can be returned and the API connection broken.
  - IOPT contract definitions will often change and it will be necessary to restart TWS or IB Gateway to download the new contract definition.

## Spread Contracts

Spread contracts, also known as combos or combinations, combine two or more instruments. To define a combination contract it is required to know the conId of the contract in question.

The conId of an instrument can easily be obtained via the [EClientSocket.reqContractDetails](https://www.interactivebrokers.com/campus/ibkr-api-page/trader-workstation-api/#contract-details) request or the [/iserver/secdef/search endpoint.](https://www.interactivebrokers.com/campus/ibkr-api-page/cpapi/#search-symbol-contract)

**Note:** Even though a contract can be created with any pair of instruments,  not all instruments are as actively traded as others. If you are unsure why data may not be retrieved, or why an order may not be executed, it is considered best practice to confirm data against the Trader Workstation or Client Portal market data.

### TWSAPI Spreads

As with standard contracts, you will continue to define the standard values such as symbol, secType, exchange, and currency. However, with combo orders, the “ComboLegs” field must be added and the ComboLeg objects should be attached. The example provided will showcase more detail of behavior; however, these require a conid, exchange, ratio, and an action for every ComboLeg on the order.

###### Contract()

**Symbol:** String. Specify the symbol of the CFD.

**SecType:** String. Specify CFD.

**Exchange:** String. Specify SMART.

**Currency:** String. Specify the base currency the CFD is traded with.

**ComboLegs:** List of ComboLeg objects. Create a list to contain all subsequent legs.

###### ComboLeg()

**ConId:** int. The conId, or contract Identifier, should be used to specify the exact contract. Symbols or local symbols can not be used for ComboLegs.

**Ratio:** int. Specify the ratio for the specific leg. The ratio will be multiplied by the totalQuantity field for of the order object.

**Action:** String. Specify what to do with the order. Users may choose Buy or Sell for these orders.

**Exchange:** String. Specify the routing exchange for the contract. SMART may be used.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
contract = Contract()
contract.symbol = "IBKR,MCD"
contract.secType = "BAG"
contract.currency = "USD"
contract.exchange = "SMART"

leg1 = ComboLeg()
leg1.conId = 43645865#IBKR STK
leg1.ratio = 1
leg1.action = "BUY"
leg1.exchange = "SMART"

leg2 = ComboLeg()
leg2.conId = 9408#MCD STK
leg2.ratio = 1
leg2.action = "SELL"
leg2.exchange = "SMART"

contract.comboLegs = []
contract.comboLegs.append(leg1)
contract.comboLegs.append(leg2)
```

``` EnlighterJSRAW
Contract contract = new Contract();
contract.symbol("IBKR,MCD");
contract.secType("BAG");
contract.currency("USD");
contract.exchange("SMART");

ComboLeg leg1 = new ComboLeg();
ComboLeg leg2 = new ComboLeg();
List addAllLegs = new ArrayList();

leg1.conid(43645865);//IBKR STK
leg1.ratio(1);
leg1.action("BUY");
leg1.exchange("SMART");

leg2.conid(9408);//MCD STK
leg2.ratio(1);
leg2.action("SELL");
leg2.exchange("SMART");
addAllLegs.add(leg1);
addAllLegs.add(leg2);

contract.comboLegs(addAllLegs);
```

``` EnlighterJSRAW
Contract contract;
contract.symbol = "IBKR,MCD";
contract.secType = "BAG";
contract.currency = "USD";
contract.exchange = "SMART";

ComboLegSPtr leg1(new ComboLeg);
leg1->conId = 43645865;
leg1->action = "BUY";
leg1->ratio = 1;
leg1->exchange = "SMART";

ComboLegSPtr leg2(new ComboLeg);
leg2->conId = 9408;
leg2->action = "SELL";
leg2->ratio = 1;
leg2->exchange = "SMART";

contract.comboLegs.reset(new Contract::ComboLegList());
contract.comboLegs->push_back(leg1);
contract.comboLegs->push_back(leg2);
```

``` EnlighterJSRAW
Contract contract = new Contract();
contract.Symbol = "IBKR,MCD";
contract.SecType = "BAG";
contract.Currency = "USD";
contract.Exchange = "SMART";

ComboLeg leg1 = new ComboLeg();
leg1.ConId = 43645865;//IBKR STK
leg1.Ratio = 1;
leg1.Action = "BUY";
leg1.Exchange = "SMART";

ComboLeg leg2 = new ComboLeg();
leg2.ConId = 9408;//MCD STK
leg2.Ratio = 1;
leg2.Action = "SELL";
leg2.Exchange = "SMART";

contract.ComboLegs = new List();
contract.ComboLegs.Add(leg1);
contract.ComboLegs.Add(leg2);
```

``` EnlighterJSRAW
Dim contract As Contract = New Contract
contract.Symbol = "MCD"
contract.SecType = "BAG"
contract.Currency = "USD"
contract.Exchange = "SMART"

Dim leg1 As ComboLeg = New ComboLeg
leg1.ConId = 43645865
leg1.Ratio = 1
leg1.Action = "BUY"
leg1.Exchange = "SMART"

Dim leg2 As ComboLeg = New ComboLeg
leg2.ConId = 9408
leg2.Ratio = 1
leg2.Action = "SELL"
leg2.Exchange = "SMART"

contract.ComboLegs = New List(Of ComboLeg)
contract.ComboLegs.Add(leg1)
contract.ComboLegs.Add(leg2)
```

### Smart-Routed Futures Spread

Futures spreads can also be defined as Smart-routed (non-guaranteed) combos. When placing an order for a non-guaranteed combo from the API, the non-guaranteed flag must be set to 1. Historical data for smart-routed futures spreads is generally available from the API with the requisite market data subscriptions.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
contract = Contract()
contract.symbol = "WTI" # WTI,COIL spread. Symbol can be defined as first leg symbol ("WTI") or currency ("USD")
contract.secType = "BAG"
contract.currency = "USD"
contract.exchange = "SMART"

leg1 = ComboLeg()
leg1.conId = 55928698 # WTI future June 2017
leg1.ratio = 1
leg1.action = "BUY"
leg1.exchange = "IPE"

leg2 = ComboLeg()
leg2.conId = 55850663 # COIL future June 2017
leg2.ratio = 1
leg2.action = "SELL"
leg2.exchange = "IPE"

contract.comboLegs = []
contract.comboLegs.append(leg1)
contract.comboLegs.append(leg2)
```

``` EnlighterJSRAW
Contract contract = new Contract();
contract.symbol("WTI");  // WTI,COIL spread. Symbol can be defined as first leg symbol ("WTI") or currency ("USD").
contract.secType("BAG");
contract.currency("USD");
contract.exchange("SMART"); // smart-routed rather than direct routed

ComboLeg leg1 = new ComboLeg();
ComboLeg leg2 = new ComboLeg();
List addAllLegs = new ArrayList();

leg1.conid(55928698);// WTI future June 2017
leg1.ratio(1);
leg1.action("BUY");
leg1.exchange("IPE");

leg2.conid(55850663);// COIL future June 2017
leg2.ratio(1);
leg2.action("SELL");
leg2.exchange("IPE");

addAllLegs.add(leg1);
addAllLegs.add(leg2);
contract.comboLegs(addAllLegs);
```

``` EnlighterJSRAW
Contract contract;
contract.symbol = "WTI"; // WTI,COIL spread. Symbol can be defined as first leg symbol ("WTI") or currency ("USD").
contract.secType = "BAG";
contract.currency = "USD";
contract.exchange = "SMART";

ComboLegSPtr leg1(new ComboLeg);
leg1->conId = 55928698; // WTI future June 2017
leg1->action = "BUY";
leg1->ratio = 1;
leg1->exchange = "IPE";

ComboLegSPtr leg2(new ComboLeg);
leg2->conId = 55850663; // COIL future June 2017
leg2->action = "SELL";
leg2->ratio = 1;
leg2->exchange = "IPE";

contract.comboLegs.reset(new Contract::ComboLegList());
contract.comboLegs->push_back(leg1);
contract.comboLegs->push_back(leg2);
```

``` EnlighterJSRAW
Contract contract = new Contract();
contract.Symbol = "WTI"; // WTI,COIL spread. Symbol can be defined as first leg symbol ("WTI") or currency ("USD").
contract.SecType = "BAG";
contract.Currency = "USD";
contract.Exchange = "SMART";

ComboLeg leg1 = new ComboLeg();
leg1.ConId = 55928698;//WTI future June 2017
leg1.Ratio = 1;
leg1.Action = "BUY";
leg1.Exchange = "IPE";

ComboLeg leg2 = new ComboLeg();
leg2.ConId = 55850663;//COIL future June 2017
leg2.Ratio = 1;
leg2.Action = "SELL";
leg2.Exchange = "IPE";

contract.ComboLegs = new List();
contract.ComboLegs.Add(leg1);
contract.ComboLegs.Add(leg2);
```

``` EnlighterJSRAW
Dim contract As Contract = New Contract
contract.Symbol = "WTI" ' WTI,COIL spread. Symbol can be defined as first leg symbol ("WTI") or currency ("USD")
contract.SecType = "BAG"
contract.Currency = "USD"
contract.Exchange = "SMART"

Dim leg1 As ComboLeg = New ComboLeg
leg1.ConId = 55928698 ' WTI future June 2017
leg1.Ratio = 1
leg1.Action = "BUY"
leg1.Exchange = "IPE"

Dim leg2 As ComboLeg = New ComboLeg
leg2.ConId = 55850663 ' COIL future June 2017
leg2.Ratio = 1
leg2.Action = "SELL"
leg2.Exchange = "IPE"

contract.ComboLegs = New List(Of ComboLeg)
contract.ComboLegs.Add(leg1)
contract.ComboLegs.Add(leg2)
```

### Inter-Commodity Futures

For Inter-Commodity futures, the ‘Local Symbol’ field in TWS is used for the ‘Symbol’ field in the API contract definition, e.g. “CL.BZ”. They are always guaranteed combos, which is the default in the API.

In some instances, a generic symbol must be provided instead. For example, a inter-commodity future containing ZF and ZN will require that the symbol be set to “FYT”.

Please be mindful of the fact that inter-commodity spreads are offered by the exchange directly, and so they are direct-routed though the legs have different underlyings. Only real time, and not historical, data is offered for inter-commodity spread contracts through the API.

It is also possible in many cases to create a spread of the same future contracts in a inter-commodity spread which is smart-routed and non-guaranteed. Historical data for this spread would generally be available from the API. Also, historical data for expired spread contracts is not available in TWS or the API.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
contract = Contract()
contract.symbol = "COL.WTI" #symbol is 'local symbol' of intercommodity spread. 
contract.secType = "BAG"
contract.currency = "USD"
contract.exchange = "IPE"

leg1 = ComboLeg()
leg1.conId = 183405603 #WTI�Dec'23�@IPE
leg1.ratio = 1
leg1.action = "BUY"
leg1.exchange = "IPE"

leg2 = ComboLeg()
leg2.conId = 254011009 #COIL�Dec'23�@IPE
leg2.ratio = 1
leg2.action = "SELL"
leg2.exchange = "IPE"

contract.comboLegs = []
contract.comboLegs.append(leg1)
contract.comboLegs.append(leg2)
```

``` EnlighterJSRAW
Contract contract = new Contract();
contract.symbol("COIL.WTI");
contract.secType("BAG");
contract.currency("USD");
contract.exchange("IPE");

ComboLeg leg1 = new ComboLeg();
ComboLeg leg2 = new ComboLeg();
List addAllLegs = new ArrayList();

leg1.conid(183405603); //WTI�Dec'23�@IPE
leg1.ratio(1);
leg1.action("BUY");
leg1.exchange("IPE");

leg2.conid(254011009); //COIL�Dec'23�@IPE
leg2.ratio(1);
leg2.action("SELL");
leg2.exchange("IPE");
addAllLegs.add(leg1);
addAllLegs.add(leg2);

contract.comboLegs(addAllLegs);
```

``` EnlighterJSRAW
Contract contract;
contract.symbol = "COIL.WTI";
contract.secType = "BAG";
contract.currency = "USD";
contract.exchange = "IPE";

ComboLegSPtr leg1(new ComboLeg);
leg1->conId = 183405603; //WTI Dec'23 @IPE
leg1->action = "BUY";
leg1->ratio = 1;
leg1->exchange = "IPE";

ComboLegSPtr leg2(new ComboLeg);
leg2->conId = 254011009; //COIL Dec'23 @IPE
leg2->action = "SELL";
leg2->ratio = 1;
leg2->exchange = "IPE";

contract.comboLegs.reset(new Contract::ComboLegList());
contract.comboLegs->push_back(leg1);
contract.comboLegs->push_back(leg2);
```

``` EnlighterJSRAW
Contract contract = new Contract();
contract.Symbol = "COIL.WTI";
contract.SecType = "BAG";
contract.Currency = "USD";
contract.Exchange = "IPE";

ComboLeg leg1 = new ComboLeg();
leg1.ConId = 183405603; //WTI Dec'23 @IPE
leg1.Ratio = 1;
leg1.Action = "BUY";
leg1.Exchange = "IPE";

ComboLeg leg2 = new ComboLeg();
leg2.ConId = 254011009; //COIL Dec'23 @IPE
leg2.Ratio = 1;
leg2.Action = "SELL";
leg2.Exchange = "IPE";

contract.ComboLegs = new List();
contract.ComboLegs.Add(leg1);
contract.ComboLegs.Add(leg2);
```

``` EnlighterJSRAW
Dim contract As Contract = New Contract
contract.Symbol = "COIL.WTI"
contract.SecType = "BAG"
contract.Currency = "USD"
contract.Exchange = "IPE"

Dim leg1 As ComboLeg = New ComboLeg
leg1.ConId = 183405603 ' WTI Dec'23 @IPE
leg1.Ratio = 1
leg1.Action = "BUY"
leg1.Exchange = "IPE"

Dim leg2 As ComboLeg = New ComboLeg
leg2.ConId = 254011009 ' COIL Dec'23 @IPE
leg2.Ratio = 1
leg2.Action = "SELL"
leg2.Exchange = "IPE"

contract.ComboLegs = New List(Of ComboLeg)
contract.ComboLegs.Add(leg1)
contract.ComboLegs.Add(leg2)
```

### CPAPI Spreads

Combo Orders follow the format of: ‘{spread\_conid};;;{leg\_conid1}/{ratio},{leg\_conid2}/{ratio}‘

This example documents the same structure of a long IBKR order against a short MCD order.

``` EnlighterJSRAW
"conidex": "28812380;;;43645865/1,9408/-1"
```

Combination orders or spread orders may also be placed using the same orders endpoint. In the case of combo orders, we must use the ‘conidex’ instead of “conid”. The conidex field is a string representation of our combo order parameters.

The spread\_conid is a unique identified used to denote a spread order. For US Stock Combos, only the spread\_conid needs to be submitted.. For all other countries, you will need to use the format ‘spread\_conid@exchange’.

###### *Available currency spread conids:*

| Currency | Spread ConID |
| -------- | ------------ |
| AUD      | 61227077     |
| CAD      | 61227082     |
| CHF      | 61227087     |
| CNH      | 136000441    |
| GBP      | 58666491     |
| HKD      | 61227072     |
| INR      | 136000444    |
| JPY      | 61227069     |
| KRW      | 136000424    |
| MXN      | 136000449    |
| SEK      | 136000429    |
| SGD      | 426116555    |
| USD      | 28812380     |

Following our spread\_conid, we will then follow with 4 semicolnons, and then the first leg\_coind. This will be the first contract to trade. After the conid, a forward slash, ‘/’, needs to be included followed by your spread ratio.

The ratio indicates two parts. The first is the sign of the ratio, whether it is positive or negative. Positive signs indicate a ‘Buy’ side, while a negative value represents a ‘Sell’ side. This could also be explained as a state of ‘Long’ and ‘Short’ respectively, depending on your current position and intention. After indicating the side, you would indicate the ratio value. This is the multiplier of your quantity value.

Now, you can continue to add legs to the order by separating them with a comma. The number of legs available is based on the exchange’s rules.
