# Event Contracts in the Web API

## Introduction

Interactive Brokers models Event Contract instruments on options (for ForecastEx products) and futures options (for CME Group products).

Event Contracts can generally be thought of as options products in the Web API, and their discovery workflow follows a familiar options-like sequence. This guide will make analogies to conventional index options for both ForecastEx and CME Group products.

IB’s Event Contract instrument records use the following fields inherited from the options model:

  - An **underlier**, which may or may not be artificial:
      - For **CME products**, a tradable Event Contract will have the relevant CME future as its underlier.
      - For **ForecastEx products**, IB has generated an artificial underlying index which serves as a container for related Event Contracts in the same product class. These artificial indices do not have any associated reference values and are purely an artifact of the option instrument model used to represent these Event Contracts. However, these artificial underlying indices can be used to search for groups of related Event Contracts, just as with index options.
  - A **Symbol** value which matches the symbol of the underlier, and which reflects the issuer’s product code.
  - A **Trading Class** which also reflects the issuer’s product code for the instrument, and in the case of CME Group products, is used to differentiate Event Contracts from CME futures options.
      - Note that many CME Group Event Contracts, which resolve against CME Group futures, are assigned a Trading Class prefixed with “EC” and followed by the symbol of the relevant futures product, to avoid naming collisions with other derivatives (i.e., proper futures options listed on the same future).
  - A **Put or Call (Right)** value, where Call = Yes and Put = No.
      - Note that ForecastEx instruments do not permit Sell orders. Instead, ForecastEx positions are flattened or reduced by buying the opposing contract. CME Group Event Contracts permit both buying and selling.
  - An artificial **Contract Month** value, again used primarily for searching and filtering available instruments. Most Event Contract products do not follow monthly series as is common with index or equity options, so these Contract Month values are typically not a meaningful attribute of the instrument. Rather, they permit filtering of instruments by calendar month.
  - A **Last Trade Date, Time, and Millisecond** values, which together indicate precisely when trading in an Event Contract will cease, just as with index options.
  - An **Expected Resolution Time** when the outcome of the tracked event is published, and contracts are determined to be in or out of the money. This is commonly referred to as the contract’s “expiration date”.
  - An **Expected Payout Time** when contracts are settled and removed from accounts. Proceeds are paid out to those expiring in the money.
  - A **Measured Period** as defined in the contract’s question. This is the primary date used for organization of contracts (as in an options chain).
  - A **Strike** value, which is the numerical value on which the event resolution hinges. Though numerical, this value need not represent a price.
  - An **instrument description (or “local symbol”)** in the form `"PRODUCT EXPIRATION STRIKE RIGHT"`, where:
      - `PRODUCT` is the issuer’s product identifier
      - `EXPIRATION` is the date of the instrument’s resolution in the form `MmmDD'YY`, e.g., “Sep26’24”
      - `STRIKE` is the numerical value that determines the contract’s moneyness at expiration
      - `RIGHT` is a value YES or NO

## Instrument Discovery

The Web API requires the use of IB’s contract ID (“conid”) to uniquely specify instruments. Knowledge of a particular instrument’s conid is required to retrieve intrument trading rules and market data, and also to submit orders.

Due to the novelty and variety of these instruments, the process of resolving Event Contract symbols and attributes into IB’s conids requires the most attention and is the primary focus of this guide. Once conids are obtained, other functionality operates as expected. The Web API offers two endpoints specifically for Event Contract discovery.

Note that IB conids are persistent for the life of an instrument. Therefore, we recommend retrieving conids and storing them locally prior to trading. Similarly, Event Contracts’ underlying indices possess their own conids which persist indefinitely. Once these underlier conids are captured, they can be used to retrieve a current set of tradable Event Contracts in that product class.

Please note that Event Contract product codes can also be obtained from IB’s ForecastTrader, or directly from the respective exchange websites:

  - IB ForecastTrader: <https://forecasttrader.interactivebrokers.com/eventtrader/#/markets>
  - CME Group: <https://www.cmegroup.com/activetrader/event-contracts.html>
  - ForecastEx: <https://forecastex.com/markets/>

### Categorization

ForecastEx forecast contracts are sorted into a category hierarchy for organizational purposes.

These categories are metadata rather than immutable attributes of the tradable instruments themselves – they can be expected to change slightly over time.

This category tree is three levels deep, and its leaves (the level 3 categories) contain the forecast contracts “Markets” — groups of tradable contracts sharing questions of the same form e.g. “will the Fed Funds rate on X date exceed Y percent”.

The `GET /trsrv/event/category-tree` endpoint can be used to retrieve the complete category tree.

``` EnlighterJSRAW
{
  "g1003": {
    "label": "Economic Indicators",
    "markets": []
  },
  ...,
  "g17574": {
    "label": "Industry",
    "parentId": "g1003",
    "markets": [  ]
  },
  "g17654": {
    "label": "United States",
    "parentId": "g17574",
    "markets": [
      {
        "name": "US Industrial Production",
        "symbol": "USIP",
        "exchange": "FORECASTX",
        "conid": 751047561
      }
    ]
  },
  ...
}
```

### ForecastEx Discovery Workflow

ForecastEx products, modeled as index options, have two purpose-built endpoints permitting discovery of IB conids.

Please also note that the ForecastEx exchange’s routing destination is `FORECASTX` (without the final E).

Suppose we’d like to find ForecastEx’s “US Fed Funds Target Rate” (FF) Event Contracts.

### ForecastEx Request \#1 -- Categories and Markets

First, we’ll want to capture the conid of the underlying artificial FF index.

We make a `GET` request to the following endpoint:

`https://api.ibkr.com/v1/api/iserver/secdef/search`

And we provide the following parameter:

  - The Event Contract product code: `symbol=FF``  `

`GET https://api.ibkr.com/v1/api/iserver/secdef/search?symbol=FF`

Note that we’ve received more than one matching result, and will need to filter for the desired ForecastEx FF index record.

From this response we should capture two new values:

1.  The FF index’s conid: `"conid":"658663572"`
2.  The semicolon-separated list of options expiries: `"opt": "20240917;20241106;..."`

Before proceeding, we must convert the expiration dates to `MMMYY` format, as this presentation is used for future requests.  
For example, “`20240917`” becomes “`SEP24`“.

``` EnlighterJSRAW
[
  {
    "conid": "658663572",
    "companyHeader": "US Fed Funds Target Rate - FORECASTX",
    "companyName": "US Fed Funds Target Rate",
    "symbol": "FF",
    "description": "FORECASTX",
    "restricted": null,
    "fop": null,
    "opt": "20240917;20241106;20241217;20250128;20250129;20250318;20250506;20250617;20250729;20250916;20251028;20251209;20260127;20260317;20260428;20260616;20260728;20260915;20261027;20261208;20270126",
    "war": null,
    "sections": [
      { "secType": "IND", "exchange": "FORECASTX;" },
      { "secType": "EC" }
    ]
  },
  {
    "conid": "52298132",
    "companyHeader": "FUTUREFUEL CORP - NYSE",
    "companyName": "FUTUREFUEL CORP",
    "symbol": "FF",
    "description": "NYSE",
    "restricted": null,
    "fop": null,
    "opt": "20240920;20241018;20241115;20241220;20250221",
    "war": null,
    "sections": [
      { "secType": "STK" },
      {
        "secType": "OPT",
        "months": "SEP24;OCT24;NOV24;DEC24;FEB25",
        "exchange": "SMART;AMEX;BATS;BOX;CBOE;EDGX;EMERALD;IBUSOPT;ISE;MERCURY;MIAX;NASDAQOM;PEARL;PHLX"
      },
      { "secType": "IOPT" },
      { "secType": "BAG" }
    ]
  },
]
```

### ForecastEx Request \#2 -- Retrieving Contracts in a Market

Next, we need to query for valid strike values.

We make a `GET` request to the following endpoint:

`https://api.ibkr.com/v1/api/iserver/secdef/strikes`

And we provide the following parameters:

  - Conid of underlying index: `conid=``658663572`for NQ
  - Name of the exchange: `exchange=FORECASTX`
      - Note: Without `FORECASTX` final E
  - Security Type of the instruments we’re seeking, `sectype=OPT`, recalling that CME Event Contracts are modeled as futures options
  - Contract Month of interest, which restricts the scope of the query, `SEP24` in this example

`GET https://api.ibkr.com/v1/api/iserver/secdef/strikes?conid=658663572&exchange=FORECASTX&sectype=OPT&month=SEP24`

Though separate lists are always returned for Calls (Yes contracts) and Puts (No contracts), we do not need treat them as distinct. All events have matching Yes and No contracts at all strikes.

Therefore, we obtain a list of valid Strike values: `3.125, 4.875, 5.125, 5.375`

``` EnlighterJSRAW
{
  "call": [ 3.125, 4.875, 5.125, 5.375 ],
  "put": [ 3.125, 4.875, 5.125, 5.375 ]
}
```

### ForecastEx Request \#2 -- Obtaining Event Contract Conids

Finally, we’ll make a series of queries for records for tradable Event Contract instruments.

To obtain all possible conids, we must make one request for each combination of Contract Month and Strike value.

Note that it is possible that a given Strike value has no tradable Event Contracts in a given Contract Month, in which case the response will be empty.

We make a `GET` request to the following endpoint:

`https://api.ibkr.com/v1/api/iserver/secdef/info`

We supply the following parameters:

  - The underlying FF index conid: `conid=658663572`
  - The relevant exchange: `exchange=FORECASTX`
  - The relevent security type, recalling that ForecastEx instruments are modeled as options: `sectype=OPT`
  - A Contract Month value: `month=SEP24`
  - A Strike value: `strike=3.125`

`GET https://api.ibkr.com/v1/api/iserver/secdef/info?conid=658663572&exchange=FORECASTX&sectype=OPT&month=SEP24&strike=3.125`

Each request returns a pair of instrument records: a Call (Yes) contract record, and a Put (No) contract record.

Note that it is possible that a given Strike value has no tradable Event Contracts in a given Contract Month, in which case the response will be empty.

``` EnlighterJSRAW
[
  {
    "conid": 713921696,
    "symbol": "FF",
    "secType": "OPT",
    "exchange": "FORECASTX",
    "listingExchange": null,
    "right": "C",
    "strike": 3.125,
    "currency": "USD",
    "cusip": null,
    "coupon": "No Coupon",
    "desc1": "FF",
    "desc2": "SEP 17 '24 3.13 Call @FORECASTX (AM)",
    "maturityDate": "20240917",
    "multiplier": "1",
    "tradingClass": "FF",
    "validExchanges": "FORECASTX"
  },
  {
    "conid": 713921701,
    "symbol": "FF",
    "secType": "OPT",
    "exchange": "FORECASTX",
    "listingExchange": null,
    "right": "P",
    "strike": 3.125,
    "currency": "USD",
    "cusip": null,
    "coupon": "No Coupon",
    "desc1": "FF",
    "desc2": "SEP 17 '24 3.13 Put @FORECASTX (AM)",
    "maturityDate": "20240917",
    "multiplier": "1",
    "tradingClass": "FF",
    "validExchanges": "FORECASTX"
  }
]
```

### CME Group Discovery Workflow

CME Group’s Event Contract products are listed on the CME venues where their underlying indices reside.  
For example, Event Contracts related to the closing price of Gold are listed on COMEX, while NQ-related Event Contracts are listed on CME.

Suppose we’d like to find CME’s NQ Event Contracts.

### CME Request \#1 -- Obtaining Index Conid and Contract Months

First, we’ll want to capture the conid of the underlying NQ index, along with a list of valid Contract Months for which tradable Event Contracts exist.

We make a `GET` request to the following endpoint:

`https://api.ibkr.com/v1/api/iserver/secdef/search`

And we provide the following parameter:

  - The Event Contract product code: `symbol=NQ``  `

`GET https://api.ibkr.com/v1/api/iserver/secdef/search?symbol=NQ&secType=IND`

A successful request is shown to the right.

The index conid can be stored, and it is possible to skip this query in the future once this conid is obtained, as the Contract Month values can simply be incremented. The index conid can be reused in the future to fetch tradable Event Contracts as needed.

The response will deliver instrument records matching the provided symbol and instrument type, and results may not be unique.

You’ll want to filter the returned list for the index record of interest.  
This can be done by looking at the array of JSON objects in the “sections” field, which should contain (among others) three objects:

  - One reflecting an index on the correct exchange: `{"secType":"IND","exchange":"CME"}`
  - Another reflecting futures options on that index: `{"secType":"FOP",...}`
  - A third object indicating the existence of Event Contract products on that index: ` {"secType":"EC"}  `

Together, these elements confirm we’ve found the necessary NQ index record.

From this response we should capture two new values:

1.  The index’s conid:  
    `"conid":"11004958"`
2.  From the “FOP” object, the semicolon-separated list of futures options Contract Months:  
    `"months":"AUG24;SEP24;OCT24;NOV24;DEC24;MAR25;JUN25;DEC25;DEC26;DEC27;DEC28"`

Note that this response will deliver other values related to derivative products which have been omitted above and can be ignored for the purposes of this workflow.

``` EnlighterJSRAW
[
  {
    "conid": "11004958",
    "companyName": "E-mini NASDAQ 100 ",
    "symbol": "NQ",
    "description": "CME",
    ...,
    "sections": [
      {
        "secType": "IND",
        "exchange": "CME;"
      },
      ...,
      {
        "secType": "FOP",
        "months": "AUG24;SEP24;OCT24;NOV24;DEC24;MAR25;JUN25;DEC25;DEC26;DEC27;DEC28",
        "exchange": "CME"
      },
      ...,
      {
        "secType": "EC"
      }
    ]
  }
]
```

### CME Request \#2 -- Obtaining Event Contract Conids

Next, we’ll want to search for records for tradable Event Contract instruments, using the newly obtained values from the first request.

This will consist of a series of requests, stepping through the Contract Month values obtained via the first request.

Importantly, this query will return records for both futures options proper and Event Contracts, so we’ll filter the response.

We will use the following endpoint:

`https://api.ibkr.com/v1/api/iserver/secdef/info`

The request takes four parameters:

1.  Conid of underlying index: `conid=11004958` for NQ
2.  Name of the exchange: `exchange=CME`
3.  Security Type of the instruments we’re seeking, `sectype=FOP`, recalling that CME Event Contracts are modeled as futures options
4.  Contract Month of interest, which restricts the scope of the query, `AUG24` in this example

The final parameter, Contract Month, is inherited from the futures options model, and valid values are obtained in the first request.  
Note however that this list of Contract Months is also shared by both futures options proper and Event Contracts, so some of the more distant Contract Month values may not return any tradable Event Contract instruments, and instead will fetch only true futures options.

`GET https://api.ibkr.com/v1/api/iserver/secdef/info?conid=11004958&exchange=CME&sectype=FOP&month=AUG24`

The response will likely be quite large, including both futures options and Event Contracts. The example to the right is abridged to show only one example of a futures option and one Event Contract.

For CME Event Contract products, we can use the “`EC`” prefix discussed above to identify Event Contract instruments by their Trading Class and filter out futures options from this response.

As we are looking for NQ Event Contracts, we will filter for records with `"tradingClass":"ECNQ"` and obtain a set of NQ Event Contract records for the month of August 2024. We can now capture their conids and other associated attributes, and then proceed to make a request for the next Contract Month, `SEP24`, repeating the process for as many months as desired.

``` EnlighterJSRAW
[
  {
    "conid": 722021819,
    "symbol": "NQ",
    "secType": "FOP",
    "exchange": "CME",
    "listingExchange": null,
    "right": "P",
    "strike": 18200.0,
    "currency": "USD",
    "cusip": null,
    "coupon": "No Coupon",
    "desc1": "NQ",
    "desc2": "(Q4A) Aug26'24 18200 Put Fut.Option(20) @CME",
    "maturityDate": "20240826",
    "multiplier": "20",
    "tradingClass": "Q4A",
    "validExchanges": "CME"
  },
  ...,
  {
    "conid": 724307144,
    "symbol": "NQ",
    "secType": "FOP",
   "exchange": "CME",
    "listingExchange": null,
    "right": "P",
    "strike": 19800.0,
    "currency": "USD",
    "cusip": null,
    "coupon": "No Coupon",
    "desc1": "NQ",
    "desc2": "(ECNQ) Aug20'24 19800 Put Fut.Option @CME",
    "maturityDate": "20240820",
    "multiplier": "1",
    "tradingClass": "ECNQ",
    "validExchanges": "CME"
  },
  ...
]
```

## Market Data

Retrieval of market data, both live and historical, also functions the same for Event Contracts as for other instruments.

Like other options instruments, historical data for Event Contracts is available only while the instrument is trading and not yet expired.

### Live Market Data

Real-time market data for Event Contracts can be retrieved in two ways:

  - As snapshots via HTTP requests
  - As a stream via websocket

Both approaches require IB’s conids to refer to a particular Event Contract instrument. It is also necessary to specify one or more [market data tags](https://www.interactivebrokers.com/campus/ibkr-api-page/cpapi-v1/#market-data-fields) to be returned.

To obtain a snapshot of the market for an Event Contract, we will make a `GET` request to the following endpoint:  
`https://api.ibkr.com/v1/api/iserver/marketdata/snapshot`

We include as query parameters:

  - One or more conids as a comma-separated list: `conids=725644263,725644264,721095497,721095500`
  - One or more market data field identifiers, or tags, also as a comma-separated list: `fields=31,84,85,86,88,7059`
      - A complete list of available market data tags can be found in our [Market Data Fields documentation](https://www.interactivebrokers.com/campus/ibkr-api-page/cpapi-v1/#market-data-fields). Please note that not all fields are relevant to Event Contracts, and those without any data for Event Contracts will not be returned.
      - In this example, we will request fields: `31 = Last Price`, `84 = Bid Price`, `85 = Ask Size`, `86 = Ask Price`, `88 = Bid Size`, and `7059 = Last Size`

As an example, we will make a request for four Event Contracts, two pairs of Yes and No contracts for one CME Group product and one ForecastEx product:

  - `725644263` = `EUR Aug28'24 1.11 YES @CME` (“Will European Monetary Union Euro close above 1.112 on Aug 28, 2024?” YES)
  - `725644264` = `EUR Aug28'24 1.11 NO @CME` (“Will European Monetary Union Euro close above 1.112 on Aug 28, 2024?” NO)
  - `721095497` = `FF Sep17'24 4.88 YES @FORECASTX` (“Will the US Fed Funds Target Rate be set above 4.875% at the FOMC meeting ending September 18, 2024?” YES)
  - `721095500` = `FF Sep17'24 4.88 NO @FORECASTX` (“Will the US Fed Funds Target Rate be set above 4.875% at the FOMC meeting ending September 18, 2024?” NO)

Our example request:  
`GET https://api.ibkr.com/v1/api/iserver/marketdata/snapshot?conids=725644263,725644264,721095497,721095500&fields=31,84,85,86,88,7059`

To the right, you’ll find an example successful response.

``` EnlighterJSRAW
[
  {
    "88": "20",
    "6509": "R",
    "conidEx": "725644263",
    "7059": "10",
    "_updated": 1724869925699,
    "conid": 725644263,
    "6119": "q0",
    "server_id": "q0",
    "84": "50.00",
    "31": "48.00"
  },
  {
    "88": "20",
    "conidEx": "725644264",
    "7059": "1",
    "_updated": 1724869929205,
    "server_id": "q1",
    "6509": "R",
    "conid": 725644264,
    "6119": "q1",
    "84": "45.00",
    "85": "19",
    "86": "50.00",
    "31": "64.00"
  },
  {
    "88": "11",
    "conidEx": "721095497",
    "7059": "6",
    "_updated": 1724869922862,
    "server_id": "q2",
    "6509": "R",
    "conid": 721095497,
    "6119": "q2",
    "84": "0.79",
    "85": "14",
    "86": "0.82",
    "31": "0.81"
  },
  {
    "88": "14",
    "conidEx": "721095500",
    "7059": "6",
    "_updated": 1724869922862,
    "server_id": "q3",
    "6509": "R",
    "conid": 721095500,
    "6119": "q3",
    "84": "0.19",
    "85": "11",
    "86": "0.22",
    "31": "0.20"
  }
]
```

The same top-of-book market data can also be streamed via websocket.

Websocket streams of market data are opened one instrument at a time, so we must write a separate subscription message to the websocket for each instrument of interest.

We will also pass our list of fields of interest with each subscription message, in this case formatted as a JSON array, as shown below. Note that the field keys are JSON strings.

Once opened, data for an instrument will be delivered via websocket as available, until the subscription for that instrument is closed.

Example websocket subscription message:  
`smd+721095500+{"fields":["31","84","85","86","88","7059"]}`

An example response message is shown to the right.

``` EnlighterJSRAW
{
  "88": "19",
  "conidEx": "721095500",
  "7059": "1",
  "_updated": 1724934591491,
  "server_id": "q3",
  "6509": "R",
  "topic": "smd+721095500",
  "conid": 721095500,
  "6119": "q3",
  "84": "0.18",
  "85": "1",
  "31": "0.19",
  "86": "0.21"
}
```

### Historical Market Data

Historical market data for Event Contracts can be retrieved in OHLC bar form.

Please note that, as options, historical data for Event Contracts is only available for a given instrument while it is trading. On expiration, historical data will no longer be available.

We will use the normal `/iserver/marketdata/history` endpoint to retrieve historical Last Trade data for Event Contracts.

Please consult our [documentation regarding valid period and bar size combinations](https://www.interactivebrokers.com/campus/ibkr-api-page/cpapi-v1/#hmds-period-bar-size).

We must provide the following query parameters:

  - `conid`
  - `period` = the duration of the time interval of interest.
  - `bar` = the width of each individual bar, i.e., how the period will be divided.
  - `startTime` = the starting point of the period of interest, from which the period duration extends backward chronologically in time.

An example request:  
`GET https://api.ibkr.com/v1/api/iserver/marketdata/history?conid=721095500&period=2d&bar=1h&startTime=20240828-17:00:00`

An abbreviated successful response is shown to the right.

``` EnlighterJSRAW
{
  "serverId": "1420779",
  "symbol": "FF",
  "text": "US Fed Funds Target Rate",
  "priceFactor": 100,
  "startTime": "20240828-17:00:00",
  "high": "20/0/0",
  "low": "19/1/420",
  "timePeriod": "2d",
  "barLength": 3600,
  "mdAvailability": "S",
  "mktDataDelay": 0,
  "outsideRth": false,
  "volumeFactor": 1,
  "priceDisplayRule": 1,
  "priceDisplayValue": "2",
  "chartPanStartTime": "20240828-16:00:00",
  "direction": 1,
  "negativeCapable": false,
  "messageVersion": 2,
  "data": [
    {
      "o": 0.2,
      "c": 0.2,
      "h": 0.2,
      "l": 0.2,
      "v": 0,
      "t": 1724864400000
    },
    {
      "o": 0.2,
      "c": 0.2,
      "h": 0.2,
      "l": 0.2,
      "v": 0,
      "t": 1724868000000
    },
    ...
  ],
  "points": 9,
  "travelTime": 34
}
```

### Underlying Data Sets

Most Markets’ underlier contract IDs have a data set associated with them. These data sets are specified by ForecastEx in the market rules of the tradable contracts as the official source for contract resolution, e.g., a particular NOAA temperature dataset for temperature contracts. Most of these data sets are sparse, reflecting the payout frequency of the contracts listed against them. These data sets can be retrieved via normal historical market data requests.

## Order Submission

Submission of orders for Event Contracts via the Web API functions like orders for any other instrument.

However, it is important to note the differing mechanics between CME Group products and ForecastEx instruments:

  - CME Group instruments can be bought and sold and function as normal futures options.
  - ForecastEx instruments cannot be sold, only bought. To exit or reduce a position, one must buy the opposing Event Contract, and IB will net the opposing positions together automatically.

In both cases, no short selling is permitted.

A forecast contract order will receive order status updates like any other order. Executions are also reported over standard rails (e.g., str topic on websocket).

## Executions and Netting Mechanics

Positions in forecast contracts are opened by buying either a YES or NO contract. Positions are reduced or closed by buying the opposite contract at the same strike: NO reduces YES, and YES reduces NO.  
An opening order will receive normal Bought/Bot execution reports (“side”: “B”). However, if an account is already long YES or NO, a reduction of that position will produce a series of execution reports.

For example, consider an account long 100 YES contracts. A new order is submitted to buy 10 NO contracts of the same strike. Execution of this Buy NO order will be netted against the long 100 YES position.

  - Order receives an execution for 10 NO contracts.
  - IB sends an execution report of Bot 10 NO (“side”: “B”). This momentarily creates a long 10 NO position in the account.
  - IB sends an execution report of Netting 10 YES (“side”: “N”). This reduces the long 100 YES position in the account by 10, yielding 90.
  - IB sends an execution report of Netting 10 NO (“side”: “N”). This reduces the long 10 NO position by 10 to 0, flattening it.
  - Net result: Account contains only the long 90 YES position.

The above netting execution reports will arrive within milliseconds of the first Bot execution. IB’s ForecastTrader reflects all such Bot & Netting executions as separate trades in the account’s Trade History.

Note that it is also possible to change the side of a position from YES to NO via a single opposite-side buy order.

For example, consider the same account, now long 90 YES. Another order is submitted to buy 130 NO contracts on the same strike.

  - Order receives an execution for 130 NO contracts.
  - IB sends an execution report of Bot 130 NO (“side”: “B”). This momentarily creates a long 130 NO position in the account.
  - IB sends an execution report of Netting 90 YES (“side”: “N”). This reduces the long 90 YES position in the account to 0, flattening it.
  - IB sends an execution report of Netting 90 NO (“side”: “N”). This reduces the the long 130 NO position by 90, yielding 40.
  - Net result: Account contains only the long 40 NO position.
