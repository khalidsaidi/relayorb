# Excel RTD

## Introduction

The Interactive Brokers Excel RTD offering is a .NET offering for IBKR Pro customers. This is a unique API implementation designed to efficiently retrieve live market data through Excel. This is optimized for ease of use and efficiency without overwhelming Excel. As such, this is the optimal choice for customers who wish to collect large quantities of data without prior coding experience, or interest in algorithmically-placed orders.

By design, Microsoft Excel gives precedence to the user interface over the data connection to other applications. For that reason, Excel only receives updates when it is in a ‘ready’ state, and may ignore data sent for instance when a modal dialogue box is displayed to the user, a cell is being edited, or Excel is busy doing other things. The Excel Real Time Data server (RTD) API has been introduced to help address some of these limitations, but they are inherent to Excel as a trading application and not specific to an API technology.

## Notes & Limitations

Please keep in mind that the **Excel RTD offering can only retrieve streaming market data**. There is no other established utility for this offering.

Sample spreadsheet applications are distributed with the API download for each of the API technologies (RTD Server, ActiveX, DDE). It is important to keep in mind that the sample applications are intended as simple demonstrations of API functionality for third party programmers. They do not have robust error handling functionality and are not intended to be used as production level trading tools.

Since the TWS RTD Server API technology directly refers to the C\# API client source functions, it is supported on Windows Environment only.

## macOS / Unix Support For Excel RTD

The TWS API Excel RTD Implementation is built around the [Component Object Model (COM)](https://learn.microsoft.com/en-us/windows/win32/com/component-object-model--com--portal) architecture. The COM object and it’s derivatives like ActiveX and [OLE (Compound Documents)](https://learn.microsoft.com/en-us/windows/win32/com/compound-documents) are built exclusively into Microsoft Windows and are reliant on the Operating System’s Registry structure.

Given the underlying technology of RTD requires Windows-specific architecture regarding it’s registry, the TWSAPI Excel RTD functionality is not available in the Mac and Unix distribution of the TWSAPI offering.

### Unset Value Responses

In many cases, customers might see a response for a given market data column which displays “N/A”, “0”, “-1” in some of their cells. This can be occur for a few different reasons.

1.  While you may have part of the required market data subscription on the instrument, you may not have all of it. This is particularly common for derivatives traders who may not have a market data subscription for the given underlying.
2.  You might also encounter this by requesting too many symbols simultaneously. This is discussed further in the [Outgoing Message Rate Limitations](#message-rate) section
3.  Similar to (2) above, every client has a maximum number of market data lines shared between TWS and their API. By default, all customer’s have a maximum of 100 market data lines, allowing for 100 unique contracts to be requested at any one time. If you surpass this limit, you may find that some fields can not be returned.
4.  This may also happen in the event your machine, in tandem with Excel, simply can not handle the volume of data requested. While the machine limitations are unique to each user, you may explore and modify the refresh rate [as described in our documentation](#rtd-refresh-rate)

### 'NA' Connection Unavailable

Clients who may have installed the API into a unique location may receive an \#NA message in each RTD cell. While this is often indicative of a reference error, the \#NA reference may be failing to call an installed DLL essential for the connection with Trader Workstation. To resolve this error, please follow the steps listed below:

1.  Uninstall the API from the “Add/Remove Tool” in the Windows Control Panel as usual
2.  Delete the C:\\TWS API\\ folder if any files are still remaining to prevent a version mismatch.
3.  Locate the file “C:\\Windows\\SysWOW64\\TwsSocketClient.dll”. Delete this file.

### Outgoing Message Rate Limitation

It is important to keep in mind the 50 message/second API limit applies to RTD Server in the same way as other socket-based API technologies. So the Excel spreadsheet can send no more than 50 messages/second to TWS. Each subscription or cancellation request counts as 1 message (messages in the opposite direction are not included). So a spreadsheet can have hundreds of streaming tickers, but the subscriptions must be spread out over time so that no more than 50 new subscriptions are made per second, or the spreadsheet can become disconnected.

### Watchlist Data Limitations

It is important to mention that our real time market data is not tick-by-tick, meaning you will not obtain every single price movement happening in the market. Instead, real time data is given as snapshots generated at a fixed given pace:

| Product                    | Frequency |
| -------------------------- | --------- |
| Stocks, Futures and others | 250 ms    |
| US Options                 | 100 ms    |
| FX pairs                   | 5 ms      |

## Download TWS or IB Gateway

In order to use the TWS API, all customers must install either Trader Workstation or IB Gateway to connect the API to. Both downloads maintain the same level of usage and support; however, they both have equal benefits. For example, IB Gateway will be less resource intensive as there is no UI; however, the Trader Workstation has access all of the same information as the API, if users would like an interface to confirm data.

It is recommended for API users to use offline TWS because TWS online version has automatic update. Please use same TWS version to make sure the TWS version and TWS API version are synced. These will help preventing version conflict issue.

Note:

1.  For IBHK API users, it is commended to use IB Gateway instead of TWS. it is because all IBHK users cannot choose “Never Lock Trader Workstation” in TWS – Global Configuration – Lock and Exit. If there is inactivity, TWS will be locked and there will be API disconnection.

[Download Trader Workstation](https://www.interactivebrokers.com/en/trading/tws.php#tws-software) [Download IB Gateway](https://www.interactivebrokers.com/en/trading/ibgateway-stable.php)

## Download the TWS API

It is recommended for API users to use same TWS API version to make sure the TWS version and TWS API version are synced in order to prevent version conflict issue.

Running the Windows version of the API installer creates a directory “C:\\\\TWS API\\” for the API source code in addition to automatically copying two files into the Windows directory for the DDE and C++ APIs. ***It is important that the API installs to the C: drive***, as otherwise API applications may not be able to find the associated files. The Windows installer also copies compiled dynamic linked libraries (DLL) of the ActiveX control TWSLib.dll, C\# API CSharpAPI.dll, and C++ API TwsSocketClient.dll. Starting in API version **973.07**, running the API installer is designed to install an ActiveX control TWSLib.dll, and TwsRtdServer control TwsRTDServer.dll which are compatible with both 32 and 64 bit applications.

It is important to know that the TWS API is **only** available through the interactivebrokers.github.io MSI or ZIP file. Any other resource, including pip, NuGet, or any other online repository is not hosted, endorsed, supported, or connected to Interactive Brokers. As such, updates to the installation should always be downloaded from the github directly.

[TWS API Download Page](https://interactivebrokers.github.io)

## Best Practice: Configure TWS / IB Gateway for RTD

Some TWS Settings affect API. You can open the Global Configuration by selecting the Cog Wheel icon in the top right corner.  

### Memory Allocation

In TWS/ IB Gateway – “Global Configuration” – “General”, you can adjust the **Memory Allocation (in MB)\***.

This feature is to control how much memory your computer can assign to the TWS/ IB Gateway application. Usually, higher value allows users to have faster data returning speed.

Normally, it is recommended for API users to set 4000. However, it depends on your computer memory size because setting too high may cause High Memory Usage and application not responding.

For details, please visit: <https://www.ibkrguides.com/traderworkstation/increase-tws-memory-size.htm>

### API Settings

In TWS Global Configuration – API – Settings, there are many API settings. Please enable/disable some API settings based on your use case.

In this section, only the most important API settings for API connection and incident troubleshooting are covered.

Please:

  - Enable “ActiveX and Socket Clients”
  - Disable “Read-Only API”
  - Enable “Create API message log file”
  - Enable “Include market data in API log file”
  - Change “Logging Level” to “Detail”

Note:

1.  In IB Gateway Global Configuration – API – settings, there is no “Compatibility Mode: Send ISLAND for US stocks trading on NASDAQ”. Specifying NASDAQ exchange in contract details may cause error if connecting to IB Gateway. For this error, please specify ISLAND exchange.

### Weekly Reauthentication

It is compulsory for TWS users to **auto logoff/auto restart TWS daily** and **manually login TWS weekly**.

In TWS/ IB Gateway – “Global Configuration” – “Lock and Exit”, you can choose the time that your TWS will be shut down.

For API users, it is recommended to choose “Never lock Trader Workstation” and “Auto restart”.

Note:

1.  IBHK users does not have “**Never lock Trader Workstation**” and “**Auto restart**” in TWS.
2.  **Windows Sleeping Mode also causes API disconnection**. It is strongly suggested to choose “**Never Sleep**” in Windows.

### Order Precautions

In TWS – “Global Configuration” – “API” – “Precautions”, you can enable the following items to stop receiving the order submission messages.

  - Enable “Bypass Order Precautions for API orders”.
  - Enable “Bypass Bond warning for API orders”.
  - Enable “Bypass negative yield to worst confirmation for API orders”.
  - Enable “Bypass Called Bond warning for API orders”.
  - Enable “Bypass “same action pair trade” warning for API orders”.
  - Enable “Bypass price-based volatility risk warning for API orders”.
  - Enable “Bypass US Stocks market data in shares warning for API orders”.
  - Enable “Bypass Redirect Order warning for Stock API orders”.
  - Enable “Bypass No Overfill Protection precaution for destinations where implied natively”.

### Connected IB Server Location in TWS

Each IB account has a pre-decided IB server. You can visit this link to know our IB servers’ locations: <https://www.interactivebrokers.com/download/IB-Host-and-Ports.pdf>

Yet, all IB paper accounts are connected to US server by default and its location cannot be changed.

As IB servers in different regions have different scheduled server maintenance time ( [https://www.interactivebrokers.com/en/software/systemStatus.php ](https://www.interactivebrokers.com/en/software/systemStatus.php)), you may need to change the IB server location in order to avoid service downtime.

For checking your connected IB server location, you can go to TWS and click “Data” to see your Primary server. In the below image, the pre-decided IB server location is: cdc1.ibllc.com

If you want to change your live IB account server location in TWS, please submit a web ticket to “Technical Assistance” – “Connectivity” in order to request changing the IB server location.

In the web ticket, you need to provide:

1.  Which account do you want to have IB server location change?
2.  Which IB server location would you like to connect to?
      - TWS AMERICA – EAST (New York)
      - TWS AMERICA – CENTRAL (Chicago)
      - TWS Europe (Zurich)
      - TWS Asia (Hong Kong)
      - TWS Asia – CHINA (For mainland China users, if the account server is hosted in Hong Kong, they will automatically connect with the Shenzhen Gateway mcgw1.ibllc.com.cn)
3.  Which IB scheduled maintenance time do you choose? (Recommended to choose the default schedule maintenance time of its own IB server location)
      - North America
      - Europe
      - Asia

After you submit the ticket, you will receive a web ticket reply which **require you to confirm and understand the migration request**.

Note:

1.  For Internet users, as the connection between IB server and Exchange goes through a dedicated line, it is commonly recommended to choose a IB server location which is closer to your TWS location. For IB connection types, please visit: <https://www.interactivebrokers.co.uk/en/software/connectionInterface.php>
2.  The pre-decided IB server location connected from TWS is different from the IB Server location connected from IB Client Portal and IBKR Mobile.
      - IB server location connected from TWS is pre-decided. You can submit a web ticket to request the IB server relocation for the TWS connection.
      - IB server location connected from Client Portal, IBKR Mobile is based on your nearest IB server location. You cannot request the IB server relocation for Client Portal and IBKR Mobile connections. However, OAuth CP API users can specify which server they want to connect to by themselves. For details, please visit: <https://www.interactivebrokers.com/campus/ibkr-api-page/cpapi-v1/#oauth-base-url>

### SMART Algorithm

In TWS Global Configuration – Orders – Smart Routing, you can set your SMART order routing algorithm behavior.

## Refresh Rate

Microsoft RTD interface has a [ThrottleInterval](https://msdn.microsoft.com/en-us/library/microsoft.office.interop.excel.rtd.throttleinterval.aspx) property that determines the interval between data refreshes. By default, the value is set to 2000 milliseconds, which means Excel waits at least 2000 milliseconds between checks for updates. You are able to manually change the Throttle Interval to a smaller value\* so as to increase the refresh rate of real time data.

The easiest way to change the ThrottleInterval property is through VBA:

1.  In Excel, go to the Visual Basic Editor window by pressing **Alt\_F11**.
2.  On the Visual Basic Editor window, click on **View -\> Immediate Window** or hold **Ctrl\_G** to open the **Immediate Window**.
3.  On the **Immediate Window**, type in the following code and then click **Enter**:  
    `Application.RTD.ThrottleInterval=250`
4.  To verify that it is set correctly, type this line of code on the **Immediate Window** and click **Enter**:`? Application.RTD.ThrottleInterval`
5.  Verify the next line should display 250. If this value is changed, the new value will persist when Microsoft Excel is restarted.

**\*Warning:** As the ThrottleInterval is lowered, updates can come in so frequently that Excel is continuously updating values and doing calculations, Excel might end up in a state where it never gives the user a chance to do anything, effectively getting in a hung state. If this happens, set the Excel throttle interval higher.

![rtd\_throttle\_interval.PNG](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMSIgaGVpZ2h0PSIxIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjwvc3ZnPg==)

<span class="small">*Source: Microsoft Real-Time Data: Frequently Asked Questions [How Do I Configure the RTD Throttle Interval in Excel?](https://msdn.microsoft.com/en-us/library/aa140060\(office.10\).aspx#odc_xlrtdfaq_howconfigrtdthrottle).*</span>

## Frequently Asked Questions

Q:

###### TwsRtdServer error: Cannot connect to TWS.

A:

This error message is most likely triggered because your TWS has not been configured properly for API socket connection. Please make sure to Enable ActiveX and Socket Client settings in your TWS. Also bear in mind that TWS Rtd Server connects to socket port 7496 by default. You will see the above error message if the socket port configured in your TWS API settings does not match what RTD is trying to connect to. See more details in What You Will Need .

Q:

###### TwsRtdServer error: RTD Server disconnects from TWS such that cells stop updating

A:

This can occur if the API message rate of 50 messages/second is exceeded. No more than 50 messages can be sent from an API application such as RTD Server to TWS per second (this does not include messages in the opposite direction). Each ticker subscription request and subscription cancellation request corresponds to 1 message. If the 50 messages/second rate is exceeded, TWS will eventually close the connection. So for constructing an RTD spreadsheet with more than 50 tickers, it must be built to only make at most 50 new subscriptions or cancellations per second.

Q:

###### TwsRtdServer error: No security definition has been found for the request.

A:

This error message is triggered to indicate the contract definition provided in your RTD formula cannot be found by TWS. Usually it is caused by incorrect contract attribute definitions or typo. You are suggested to refer to some Syntax Samples and find out the issue in your RTD formula.

Q:

###### TwsRtdServer error: The contract description specified for is ambiguous.

A:

This error message indicates the contract definition provided by you does not uniquely define one single contract. It is mostly triggered for stock symbols, such as MSFT and CSCO, that are listed on multiple primary exchanges. Specifying the *PrimaryExchange* will resolve the issue.

Q:

###### TwsRtdServer error: Requested market data is not subscribed. Displaying delayed market data...

A:

The error message is displayed when you are trying to request for a live tick type, while only delayed data is available due to missing Market Data Subscription. You need to either subscribe to market data pacakegs via Account Management, or request for Delayed Tick Types instead.

Q:

###### Some data show '0' when requesting data for many securities

A:

This is most likely because you have exceeded the limit of Market Data Lines . You can verify if this is reason by going to TWS and hold **Ctrl\_Alt\_=** at the same time. This should show a small pop-up window and indicate the maximum allowed market data lines as well as the currently subscribed top market data count. If you are subscribed to more than the maximum allowed, some of the data point will show ‘0’. Explore further troubleshooting in our [Unset Value Responses](#unset-value-responses) section.

![rtd\_maxdataline.PNG](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMSIgaGVpZ2h0PSIxIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjwvc3ZnPg==)

## RTD Request Structure

The default Excel RTD API library is made up of at least four primary components, with an optional fifth component for those not using a Live TWS session.

The basic components of a the RTD formula are **ProgID**, **Server**, **[Ticker](#ticker)**, **[Topic](#topic)** and **[Connection Parameters](#connection-parameters)** (optional).

While there may be some variety for the other topics, **ProgID** should always be set to “Tws.TwsRtdServerCtrl” or an equivalent cell, and **Server** should always be left as an empty string.

`=RTD(ProgID, Server, Ticker, Topic, ConnectionParams...)`

## Connection Parameters

Since the TWS RTD Server API directly refers to the C\# API Client, so it connects to TWS (or IB Gateway) the same as C\# via the socket. The Host IP Address, Socket Port and Client ID are required parameters for initiating a socket connection.

  - The Host IP Address is the IP address where your TWS is running on. For a local connection, local IP 127.0.0.1 can be used.
  - The Socket Port is the port for socket connection. You can setup the host port in TWS API Settings, and you need to have your API connect to the same port as you setup in TWS.
  - The Client ID is an identification for each API connection. TWS can maintain up to 32 API Clients connecting at the same time, and the Client ID is used to distinguish each connection. This was originally designed so that API users can have multiple API programs (i.e. clients) running at the same using different strategies to trade separately. Since the TWS RTD Server API is only provided for relaying real-time data, there is no need to use multiple client IDs.

The above three parameters are defaulted to the following values if not directly specified by the user:

  - Host = “127.0.0.1” (i.e. the “localhost”)
  - Port = “7496”
  - ClientID = Integer.MaxValue – 1

Simple Syntax supports several pre-defined Connection Parameters that can be specified as a separate string (i.e. String2, String3…) in the RTD formula:

  - “paper”: use port=7497 for connection instead (7497 is the default port for paper TWS sessions)
  - “gw”: use port=4001 for connection instead (4001 is the default port for live IB Gateway sessions)
  - “gwpaper”: use port=4002 for connection instead (4002 is the default port for paper IB Gateway sessions)

For example, to request High price for SPY@SMART while connecting to a TWS logged with a paper account via port 7497:

`=RTD("Tws.TwsRtdServerCtrl",,"SPY@ARCA", "High", "paper")`

## Ticker

The ticker is a means of defining a contract for a given market data request. This will incorporate the symbol, security type, exchange, currency, and potentially more in some shape.

This can be achieved in a single string, known as [Simple Syntax,](#simple-syntax) or through multiple definitions, known as [Complex Syntax](#complex-syntax). While both are of equal value, some security types benefit from one structure over another.

### Simple Syntax

Simple Syntax is built to supply all of the contract details in a single string. This can be a useful tool to compile all of the data in one cell for ease of access.

This is most suited for contracts with less detail, such as Stocks or Indices.

The ticker string is delimited with the use of a forward slash, ‘/’. Each attribute of a contract has a unique position in the series of forward slashes that determines what value should be sent.

Simple Syntax Structure: “SYMBOL@EXCHANGE/PRIMEXCH/SECTYPE/EXPIRATION/RIGHT/STRIKE/CURRENCY”

Example Structure: “SPX@SMART/CBOE/OPT/20230810/P/4480/USD”

***Notes:***

1.  Not all contract attributes are required to be specified. You can leave the field to be blank to make that field un-specified. Sequentially, if you only need to specify several contract attributes at the begining part of the Ticker string, you can leave out the rest of the string entirely as well. For example, instead of specifying “SPY@SMART//////”, “SPY@SMART” would be sufficient to define the contract properly.
2.  There are several default contract attributes in the Ticker string. If you leave them un-specified, they will take the default values as following:
      - EXCHANGE **= **“SMART”
      - SECTYPE **= **“STK”
      - CURRENCY **= **“USD”

*For example, Ticker = “SPY” is the same as “SPY@SMART//STK////USD”.*

### Complex Syntax

Complex Syntax provides the most flexibility that it allows users to customize all formula strings individually, where each string only represent one single parameter. There is no rule for the sequence of the appearance of each parameter.

Unlike the Simple Syntax, each field of a Complex Syntax contract is submitted separately within its own string. There is no limit to the number of fields included so long as it remains relevant to a given contract.

It should be noted this may be interspersed with the Simple Syntax, in the event an additional parameter needs to be included.

The Complex Syntax below will request the Bid price for SPY:

`=RTD("Tws.TwsRtdServerCtrl",,"sym=ES", "sec=FUT", "exch=CME", "cur=USD", "exp=202212", "qt=Bid")`

The mixed syntax below with request AskSize data for SPY using the simple syntax defaults along with a designated primary exchange, ARCA:

`=RTD("Tws.TwsRtdServerCtrl",,"SPY", "prim=ARCA", "qt=AskSize")`

#### Complex Syntax Strings

<table>
<colgroup>
<col style="width: 33%" />
<col style="width: 33%" />
<col style="width: 33%" />
</colgroup>
<thead>
<tr class="header">
<th>Name</th>
<th>String Syntax</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td>Contract ID</td>
<td>“conid=”</td>
<td>The unique contract ID generated by IB. Can be found at TWS <a href="https://pennies.interactivebrokers.com/cstools/contract_info/v3.10/index.php" class="el">Contract Description</a> .</td>
</tr>
<tr class="even">
<td>Symbol</td>
<td>“sym=”</td>
<td>The contract symbol.</td>
</tr>
<tr class="odd">
<td>SecurityType</td>
<td>“sec=”</td>
<td>The type of security, e.g. ‘STK’, ‘FUT’ and so on.</td>
</tr>
<tr class="even">
<td>LastTradeDateOrContractMonth</td>
<td>“exp=”</td>
<td>Format ‘YYYYMMDD’ is used for defining the Last Trade Date, while format ‘YYYYMM’ is used for defining the Contract Month.</td>
</tr>
<tr class="odd">
<td>Strike</td>
<td>“strike=”</td>
<td>The strike price for an option contract.</td>
</tr>
<tr class="even">
<td>Right</td>
<td>“right=”</td>
<td>‘C’ or ‘P’ for an option contract.</td>
</tr>
<tr class="odd">
<td>Multiplier</td>
<td>“mult=”</td>
<td>The contract multiplier.</td>
</tr>
<tr class="even">
<td>Exchange</td>
<td>“exch=”</td>
<td>The exchange where to get market data from. For equities, ‘SMART’ means top data from all possible exchanges.</td>
</tr>
<tr class="odd">
<td>PrimaryExchange</td>
<td>“prim=”</td>
<td>The primary exchange of the contract. It is mostly specified when an contract ambiguity occurs for equity symbols that are listed on multiple exchanges.</td>
</tr>
<tr class="even">
<td>Currency</td>
<td>“cur=”</td>
<td>The currency the contract is traded in.</td>
</tr>
<tr class="odd">
<td>LocalSymbol</td>
<td>“loc=”</td>
<td>The local symbol of the contract. Note the Local Symbol is mostly used for futures and options, and is different from the Symbol.</td>
</tr>
<tr class="even">
<td>TradingClass</td>
<td>“tc=”</td>
<td>The trading class of the contract.</td>
</tr>
<tr class="odd">
<td>Combo</td>
<td>“cmb=”</td>
<td>Combo contract has to be defined using Complex Syntax or Mixed Syntax. The syntax for defining the combo is:
<p>“cmb=&lt;conid1&gt;#&lt;ratio1&gt;#&lt;action1&gt;#&lt;exchange1&gt;;&lt;conid2&gt;#&lt;ratio2&gt;#&lt;action2&gt;#&lt;exchange2&gt;;”</p>
<p>,where combo legs are separated by ‘;’ and individual leg parameters are separated by ‘#’. See more <a href="#combo-sample" class="el">Combo Samples</a> .</p></td>
</tr>
<tr class="even">
<td>DeltaNeutralContract</td>
<td>“und=”</td>
<td>Delta-Neutral Contract. The syntax for defining the delta-neutral contract is:
<p>“und=&lt;&lt;conid&gt;#&lt;delta&gt;#&lt;price&gt;”</p>
<p>, where delta-neutral contract parameters are separated by ‘#’.</p></td>
</tr>
<tr class="odd">
<td>MktDataOptions</td>
<td>“opt=”</td>
<td>Currently not supported.</td>
</tr>
<tr class="even">
<td>GenericTickList</td>
<td>“genticks=”</td>
<td>A comma separated Ids of available Generic Tick Types.</td>
</tr>
<tr class="odd">
<td>Topic</td>
<td>“qt=”</td>
<td>Topic of market data request.</td>
</tr>
<tr class="even">
<td>Host</td>
<td>“host=”</td>
<td>Host IP address.</td>
</tr>
<tr class="odd">
<td>Port</td>
<td>“port=”</td>
<td>Socket port.</td>
</tr>
<tr class="even">
<td>ClientId</td>
<td>“clientid=”</td>
<td>The client ID for socket connection. Note that the client ID is used for identify multiple simultaneous API connections to the same TWS. It was originally designed for API users who would like to manage their strategies separately from different API programs. Since the TWS RTD Server API is currently only supported for real-time market data, there is no need to use multiple client IDs.</td>
</tr>
</tbody>
</table>

## Topic

The Topic specifies the tick types returned values after requesting market data. Each cell in Excel will correspond to a given Topic string to represent the given dataset. If no Topic is specified,  “Last” value will be returned by default.

***Note: **If you do not have the corresponding Market Data Subscription, ‘0’ will be displayed if you request for live tick types above. Please refer to [Delayed Tick Types](#delayed-tick-types) if you are interested in receiving 15-minute delayed data.*

### Basic Tick Types

Standard tick types returned to the user upon requesting data by default.

| Tick Name                 | Topic String      | Description                                                                                                                                                                                                                             |
| ------------------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bid Size                  | “BidSize”         | Number of contracts (or lots) offered at the bid price.                                                                                                                                                                                 |
| Bid Price                 | “Bid”             | Highest bid price for the contract.                                                                                                                                                                                                     |
| Ask Price                 | “Ask”             | Lowest offer price for the contract.                                                                                                                                                                                                    |
| Ask Size                  | “AskSize”         | Number of contracts (or lots) offered at the ask price.                                                                                                                                                                                 |
| Last Price                | “Last”            | Last price at which the contract traded.                                                                                                                                                                                                |
| Last Size                 | “LastSize”        | Number of contracts or lots traded at the last price.                                                                                                                                                                                   |
| High                      | “High”            | High price for the day.                                                                                                                                                                                                                 |
| Low                       | “Low”             | Low price for the day.                                                                                                                                                                                                                  |
| Volume                    | “Volume”          | Trading volume for the day for the selected contract (Volume for US Stocks are quoted in lots. The actual number of shares in volume can be calculated by multiplying 100).                                                             |
| Close Price               | “Close”           | The last available closing price for the previous day. For US Equities, we use corporate action processing to get the closing price, so the close price is adjusted to reflect forward and reverse splits and cash and stock dividends. |
| Open Price                | “Open”            | Today’s opening price. The official opening price requires a market data subscription to the native exchange of a contract.                                                                                                             |
| Last Exchange             | “LastExch”        | The exchange where the Last Price is provided from.                                                                                                                                                                                     |
| Bid Exchange              | “BidExch”         | The exchange where the Bid Price is provided from.                                                                                                                                                                                      |
| Ask Exchange              | “AskExch”         | The exchange where the Ask Price is provided from.                                                                                                                                                                                      |
| Last Timestamp            | “LastTime”        | Time of the last trade (in UNIX time).                                                                                                                                                                                                  |
| Halted                    | “Halted”          | Indicates if a contract is halted.                                                                                                                                                                                                      |
| Bid Implied Volatility    | “BidImpliedVol”   | Implied volatility calculated from option bid prices.                                                                                                                                                                                   |
| Bid Delta                 | “BidDelta”        | Delta calculated from the option bid prices.                                                                                                                                                                                            |
| Bid Option Price          | “BidOptPrice”     | Current bid price for the option contract.                                                                                                                                                                                              |
| Bid PV Dividend           | “BidPvDividend”   | The present value of dividends expected on the option’s underlying.                                                                                                                                                                     |
| Bid Gamma                 | “BidGamma”        | The option gamma value calculated from the option bid prices.                                                                                                                                                                           |
| Bid Vega                  | “BidVega”         | The option vega value calculated from the option bid prices.                                                                                                                                                                            |
| Bid Theta                 | “BidTheta”        | The option theta value calculated from the option bid prices.                                                                                                                                                                           |
| Bid Price of Underlying   | “BidUndPrice”     | The current bid price of the option underlying.                                                                                                                                                                                         |
| Ask Implied Volatility    | “AskImpliedVol”   | Implied volatility calculated from option ask prices.                                                                                                                                                                                   |
| Ask Delta                 | “AskDelta”        | Delta calculated from the option ask prices.                                                                                                                                                                                            |
| Ask Option Price          | “AskOptPrice”     | Current ask price for the option contract.                                                                                                                                                                                              |
| Ask PV Dividend           | “AskPvDividend”   | The present value of dividends expected on the option’s underlying.                                                                                                                                                                     |
| Ask Gamma                 | “AskGamma”        | The option gamma value calculated from the option ask prices.                                                                                                                                                                           |
| Ask Vega                  | “AskVega”         | The option vega value calculated from the option ask prices.                                                                                                                                                                            |
| Ask Theta                 | “AskTheta”        | The option theta value calculated from the option ask prices.                                                                                                                                                                           |
| Ask Price of Underlying   | “AskUndPrice”     | The current ask price of the option underlying.                                                                                                                                                                                         |
| Last Implied Volatility   | “LastImpliedVol”  | Implied volatility calculated from option last prices.                                                                                                                                                                                  |
| Last Delta                | “LastDelta”       | Delta calculated from the option last prices.                                                                                                                                                                                           |
| Last Option Price         | “LastOptPrice”    | Current last price for the option contract.                                                                                                                                                                                             |
| Last PV Dividend          | “LastPvDividend”  | The present value of dividends expected on the option’s underlying.                                                                                                                                                                     |
| Last Gamma                | “LastGamma”       | The option gamma value calculated from the option last prices.                                                                                                                                                                          |
| Last Vega                 | “LastVega”        | The option vega value calculated from the option last prices.                                                                                                                                                                           |
| Last Theta                | “LastTheta”       | The option theta value calculated from the option last prices.                                                                                                                                                                          |
| Last Price of Underlying  | “LastUndPrice”    | The current last price of the option underlying.                                                                                                                                                                                        |
| Model Implied Volatility  | “ModelImpliedVol” | Implied volatility calculated from option model prices.                                                                                                                                                                                 |
| Model Delta               | “ModelDelta”      | Delta calculated from the option model prices.                                                                                                                                                                                          |
| Model Option Price        | “ModelOptPrice”   | Current model price for the option contract.                                                                                                                                                                                            |
| Model PV Dividend         | “ModelPvDividend” | The present value of dividends expected on the option’s underlying.                                                                                                                                                                     |
| Model Gamma               | “ModelGamma”      | The option gamma value calculated from the option model prices.                                                                                                                                                                         |
| Model Vega                | “ModelVega”       | The option vega value calculated from the option model prices.                                                                                                                                                                          |
| Model Theta               | “ModelTheta”      | The option theta value calculated from the option model prices.                                                                                                                                                                         |
| Model Price of Underlying | “ModelUndPrice”   | The current model price of the option underlying.                                                                                                                                                                                       |

### Generic Tick Types

A selection of Generic Tick Types are also supported in TWS RTD Server API. To request for any Generic Tick Type, you just need to specify the name of the generic tick type as the Topic string in the RTD formula.

By default, all Generic Tick Types are automatically requested. User just need to directly specify the Topic as the name of a generic tick type to populate the data to Excel.

In order to consume less data resource and make your market data request more efficient, you can directly specify the Generic Tick Type to be requested by defining string *“genticks=id1,id2,…”*.

For example, to request 52-Week High price, only Generic Tick Type = 165 is required. The below formula will only request Generic Tick Type = 165:

`=RTD("Tws.TwsRtdServerCtrl",,"SPY@SMART", "Week52Hi", "genticks=165")`

| Generic Tick Type Name        | Topic String             | Description                                                                                                                                                                                                                                                                    | Generic Tick Required |
| ----------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------- |
| Auction Volume                | “AuctionVolume”          | The number of shares that would trade if no new orders were received and the auction were held now.                                                                                                                                                                            | 225                   |
| Auction Imbalance             | “AuctionImbalance”       | The number of unmatched shares for the next auction; returns how many more shares are on one side of the auction than the other.                                                                                                                                               | 225                   |
| Auction Price                 | “AuctionPrice”           | The price at which the auction would occur if no new orders were received and the auction were held now. The indicative price for the auction.                                                                                                                                 | 225                   |
| Regulatory Imbalance          | “RegulatoryImbalance”    | The imbalance that is used to determine which at-the-open or at-the-close orders can be entered following the publishing of the regulatory imbalance.                                                                                                                          | 225                   |
| PL Price                      | “PlPrice”                | The PL Price, also known as the Mark Price, is the current theoretical calculated value of an instrument. Since it is a calculated value, it will typically have many digits of precision.                                                                                     | 232                   |
| Creditmanager Mark Price      | “CreditmanMarkPrice”     | Not currently available.                                                                                                                                                                                                                                                       | 221                   |
| Creditmanager Slow Mark Price | “CreditmanSlowMarkPrice” | Slow Mark Price update used in system calculations (same as Mark Price update in TWS Account Window -\> Portfolio).                                                                                                                                                            | 619                   |
| Call Option Volume            | “CallOptionVolume”       | Call option volume for the trading day.                                                                                                                                                                                                                                        | 100                   |
| Put Option Volume             | “PutOptionVolume”        | Put option volume for the trading day.                                                                                                                                                                                                                                         | 100                   |
| Call Option Open Interest     | “CallOptionOpenInterest” | Call option open interest.                                                                                                                                                                                                                                                     | 101                   |
| Put Option Open Interest      | “PutOptionOpenInterest”  | Put option open interest.                                                                                                                                                                                                                                                      | 101                   |
| Option Historical Volatility  | “OptionHistoricalVol”    | The 30-day historical volatility (currently for stocks).                                                                                                                                                                                                                       | 104                   |
| RT Historical Volatility      | “RTHistoricalVol”        | 30-day real time historical volatility (Futures only).                                                                                                                                                                                                                         | 411                   |
| Option Implied Volatility     | “OptionImpliedVol”       | A prediction of how volatile an underlying will be in the future. The IB 30-day volatility is the at-market volatility estimated for a maturity thirty calendar days forward of the current trading day, and is based on option prices from two consecutive expiration months. | 106                   |
| Index Future Premium          | “IndexFuturePremium”     | The number of points that the index is over the cash index (Indeses only).                                                                                                                                                                                                     | 162                   |
| Shortable                     | “Shortable”              | Describes the level of difficulty with which the contract can be sold short. See [Shortable](https://interactivebrokers.github.io/tws-api/tick_types.html#shortable) .                                                                                                         | 236                   |
| Fundamental Ratios            | “Fundamentals”           | Provides the available Reuter’s Fundamental Ratios. See fundamental\_ratios\_tags .                                                                                                                                                                                            | 258                   |
| Trade Count                   | “TradeCount”             | Trade count for the day.                                                                                                                                                                                                                                                       | 293                   |
| Trade Rate                    | “TradeRate”              | Trade count per minute.                                                                                                                                                                                                                                                        | 294                   |
| Volume Rate                   | “VolumeRate”             | Volume per minute.                                                                                                                                                                                                                                                             | 295                   |
| Last RTH Trade                | “LastRthTrade”           | Last Regular Trading Hours traded price.                                                                                                                                                                                                                                       | 318                   |
| IB Dividends                  | “IBDividends”            | Contract’s dividends. See [IB Dividends](https://interactivebrokers.github.io/tws-api/tick_types.html#ib_dividends) .                                                                                                                                                          | 456                   |
| Bond Factor Multipler         | “BondMultiplier”         | Not currenctly available.                                                                                                                                                                                                                                                      | 460                   |
| Average Volume                | “AvgVolume”              | The average daily trading volume over 90 days (multiply this value times 100).                                                                                                                                                                                                 | 165                   |
| High 13 Weeks                 | “Week13Hi”               | Highest price for the last 13 weeks.                                                                                                                                                                                                                                           | 165                   |
| Low 13 Weeks                  | “Week13Lo”               | Lowest price for the last 13 weeks.                                                                                                                                                                                                                                            | 165                   |
| High 26 Weeks                 | “Week26Hi”               | Highest price for the last 26 weeks.                                                                                                                                                                                                                                           | 165                   |
| Low 26 Weeks                  | “Week26Lo”               | Lowest price for the last 26 weeks.                                                                                                                                                                                                                                            | 165                   |
| High 52 Weeks                 | “Week52Hi”               | Highest price for the last 52 weeks.                                                                                                                                                                                                                                           | 165                   |
| Low 52 Weeks                  | “Week52Lo”               | Lowest price for the last 52 weeks.                                                                                                                                                                                                                                            | 165                   |
| Short-Term Volume 3 Minutes   | “ShortTermVolume3Min”    | The past three minutes volume. Interpolation may be applied.                                                                                                                                                                                                                   | 595                   |
| Short-Term Volume 5 Minutes   | “ShortTermVolume5Min”    | The past five minutes volume. Interpolation may be applied.                                                                                                                                                                                                                    | 595                   |
| Short-Term Volume 10 Minutes  | “ShortTermVolume10Min”   | The past ten minutes volume. Interpolation may be applied.                                                                                                                                                                                                                     | 595                   |
| Futures Open Interest         | “FuturesOpenInterest”    | Total number of outstanding futures contracts (TWS Build 965+ is required)                                                                                                                                                                                                     | 588                   |
| Average Option Volume         | “AvgOptVolume”           | Average volume of the corresponding option contracts (TWS Build 970+ is required)                                                                                                                                                                                              | 105                   |

### Delayed Tick Types

When live streaming market data is not available because of missing Market Data Subscription, delayed data will be automatically relayed back. To request delayed data via RTD, you need to specify delayed tick types for the Topic. The table below shows a full list of available delayed tick types:

***Note: **Delayed tick types are 15-minute delayed. Requesting for live tick types without market data subscription will result in error message “Requested market data is not subscribed. Displaying delayed market data…”*

| Tick Name              | Topic String           | Description                                                                                                                                                                                                                             |
| ---------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Delayed Bid Size       | “DelayedBidSize”       | Number of contracts (or lots) offered at the bid price.                                                                                                                                                                                 |
| Delayed Bid Price      | “DelayedBid”           | Highest bid price for the contract.                                                                                                                                                                                                     |
| Delayed Ask Price      | “DelayedAsk”           | Lowest offer price for the contract.                                                                                                                                                                                                    |
| Delayed Ask Size       | “DelayedAskSize”       | Number of contracts (or lots) offered at the ask price.                                                                                                                                                                                 |
| Delayed Last Price     | “DelayedLast”          | Last price at which the contract traded.                                                                                                                                                                                                |
| Delayed Last Size      | “DelayedLastSize”      | Number of contracts or lots traded at the last price.                                                                                                                                                                                   |
| Delayed High           | “DelayedHigh”          | High price for the day.                                                                                                                                                                                                                 |
| Delayed Low            | “DelayedLow”           | Low price for the day.                                                                                                                                                                                                                  |
| Delayed Volume         | “DelayedVolume”        | Trading volume for the day for the selected contract (Volume for US Stocks are quoted in lots. The actual number of shares in volume can be calculated by multiplying 100).                                                             |
| Delayed Close Price    | “DelayedClose”         | The last available closing price for the previous day. For US Equities, we use corporate action processing to get the closing price, so the close price is adjusted to reflect forward and reverse splits and cash and stock dividends. |
| Delayed Open Price     | “DelayedOpen”          | Today’s opening price. The official opening price requires a market data subscription to the native exchange of a contract.                                                                                                             |
| Delayed Last Timestamp | “DelayedLastTimestamp” | Delayed time of the last trade (in UNIX time) (TWS Build 970+ is required).                                                                                                                                                             |

## Contract

This page is provided as a demonstration of RTD formulas categorized by security type as well as syntax type. This will help to provide context on how a unique contract type should be formatted for either Simple or Complex syntax structures. The generic structure of a Contract is as follows:

`Symbol@Exchange/PrimaryExchange/SecType/Expiration/Right/Strike/Currency`

**Note:** TradingClass, Multiplier, and LocalSymbol can only be specified through Complex Syntax.

### Bonds

Simple Syntax

*Comment: Bonds can be specified by defining the **Symbol** as the CUSIP. **Currency** = “USD” is used as default here.*

`=RTD("Tws.TwsRtdServerCtrl",,"912828C57@SMART//BOND", "Bid")`

Complex Syntax

*Comment: Bonds can also be defined with the **ConId** and **Exchange** as with any security type.*

`=RTD("Tws.TwsRtdServerCtrl",,"sym=912828C57","cur=USD", "exch=SMART", "sec=BOND", "qt=Bid")`

`=RTD("Tws.TwsRtdServerCtrl",,"conid=147554578", "exch=SMART", "qt=Ask")`

### Combos & Spreads

Spread contracts, also known as combos or combinations, combine two or more instruments. To define a combination contract it is required to know the Contract ID of the combo legs. The ConId can be easily found in the Contract Description page in TWS. The spread contract’s symbol can be either the symbol of one of the contract legs or, for two-legged combinations the symbols of both legs separated by a comma as shown in the examples below.

Simple Syntax is not sufficient to define spread contracts. You need to use either [Complex Syntax](#complex-syntax) . As a reminder, here is the string formula for defining the Combo Legs:

“cmb=\<conid1\>\#\<ratio1\>\#\<action1\>\#\<exchange1\>;\<conid2\>\#\<ratio2\>\#\<action2\>\#\<exchange2\>;”

### Options Spread

Complex Syntax

Buy 1 DBK May19’17 15 CALL @EUREX+ Sell 1 DBK May19’17 16 CALL @EUREX:

`=RTD("tws.twsrtdserverctrl",,"sym=DBK", "exch=EUREX", "cur=EUR", "sec=BAG", "cmb=270579950#1#BUY#EUREX;270579957#1#SELL#EUREX;", "Bid")`

### Stock Spread

Complex Syntax

Buy 1 IBKR@SMART + Sell 1 MCD@SMART:

`=RTD("Tws.TwsRtdServerCtrl",,"sym=IBKR,MCD", "exch=SMART", "cur=USD", "sec=BAG", "cmb=43645865#1#BUY#SMART;9408#1#SELL#SMART;", "Bid")`

### Futures Spread

Complex Syntax

Buy 1 VXJ7@CFE + Sell 1 VXK7@CFE:

`=RTD("tws.twsrtdserverctrl",,"sym=VIX", "exch=CFE", "cur=USD", "sec=BAG", "cmb=249139906#1#BUY#CFE;252623425#1#SELL#CFE;", "Bid")`

### Multi-Security Spread

Complex Syntax

Buy 1 CL May’17 @COMEX+ Sell 1 BZ Jun’17 @COMEX:

`=RTD("tws.twsrtdserverctrl",,"sym=CL.BZ", "exch=COMEX", "cur=USD", "sec=BAG", "cmb=55977404#1#BUY#COMEX;55807026#1#SELL#COMEX;", "Bid")`

### Commodities

Simple Syntax

`=RTD("Tws.TwsRtdServerCtrl",,"XAUUSD@SMART//CMDTY", "Bid")`

Complex Syntax

`=RTD("Tws.TwsRtdServerCtrl",,"sym=XAUUSD","cur=USD", "exch=SMART", "sec=CMDTY", "qt=Ask")`

### Contract for Differences ( CFD )

***Note: **Only Index CFD data can be directly queried via the API, but not equity CFD. Please directly request data for the underlying equity if you need data for an equity CFD contract.*

Simple Syntax

`=RTD("Tws.TwsRtdServerCtrl",,"IBDE30@SMART//CFD////EUR", "Bid")`

Complex Syntax

`=RTD("Tws.TwsRtdServerCtrl",,"sym=IBDE30","cur=EUR", "exch=SMART", "sec=CFD", "qt=ASK")`

### Foreign Exchange/Forex/FX/CASH

Simple Syntax

Forex Ticker is defined in format “CURRENCY1.CURRENCY2/CASH”.

`=RTD("Tws.TwsRtdServerCtrl",,"EUR.USD/CASH", "Bid")`

Complex Syntax

For Complex Syntax, Forex Symbol is defined as the foreign currency, and the Currency is defined as the base currency.

`=RTD("Tws.TwsRtdServerCtrl",,"sym=EUR","cur=USD", "exch=IDEALPRO", "sec=CASH", "qt=Bid")`

### Futures

Simple Syntax

For futures that have multipler Multipliers (e.g. DAX has 5 and 25), Simple Syntax is not adequate to define the contract uniquely. Mixed Syntax can help to add addition specification for the Multiplier.

`=RTD("Tws.TwsRtdServerCtrl",,"ES@CME//FUT/201712///USD", "Bid")`

Complex Syntax

The LastTradeDateOrContractMonth and underlying Symbol can be replaced with the contract’s own symbol, also known as LocalSymbol (named as Symbol within the TWS’ Contract Description dialog). Local Symbol is not available in Simple Syntax.

`=RTD("Tws.TwsRtdServerCtrl",,"loc=ESZ7","cur=USD", "exch=CME", "sec=FUT", "qt=Ask")`

### Futures Options

Simple Syntax

*Comment: Futures Options follow the same rule as conventional option contracts.*

`=RTD("Tws.TwsRtdServerCtrl",,"ES@CME//FOP/20180316/C/1000/USD", "Close")`

Complex Syntax

`=RTD("Tws.TwsRtdServerCtrl",,"loc=ESH8 C1000", "cur=USD", "exch=CME", "sec=FOP", "qt=Close")`

### Index

Simple Syntax

Comment: Default Currency = “USD” is used.

`=RTD("Tws.TwsRtdServerCtrl",,"SPX@CBOE//IND", "Last")`

Complex Syntax

`=RTD("Tws.TwsRtdServerCtrl",,"sym=INDU","cur=USD", "exch=NYSE", "sec=IND", "qt=Close")`

### Mutual Funds

Simple Syntax

`=RTD("Tws.TwsRtdServerCtrl",,"VINIX@FUNDSERV//FUND", "Close")`

Complex Syntax

`=RTD("Tws.TwsRtdServerCtrl",,"sym=VINIX","cur=USD", "exch=FUNDSERV", "sec=FUND", "qt=Close")`

### Options

Simple Syntax

*Comment: Options follow the same rule as Futures Options contracts.*

`=RTD("Tws.TwsRtdServerCtrl",,"SPX/SMART/OPT/20240322/C/5110/USD", "Close")`

Complex Syntax

`=RTD("Tws.TwsRtdServerCtrl",,"loc=SPX   240315C05110000", "cur=USD", "exch=SMART", "sec=OPT", "qt=Close")`

### Standard Warrants

Simple Syntax

Comment: Use Symbol, LastTradeDateOrContractMonth, Right and Strike to define warrants contract.

`=RTD("tws.twsrtdserverctrl",,"MSFT@FWB//WAR/202401/C/200/EUR", "Bid")`

Complex Syntax

LocalSymbol can be used to define warrants contract.

`=RTD("tws.twsrtdserverctrl",,"loc=TT45K3","cur=EUR", "exch=FWB", "sec=WAR", "qt=Bid")`

### Stocks & ETFs

Important notes for Stocks and SMART routing

  - Specifying the Exchange as opposed to using PrimaryExchange means requesting data from that exchange specifically.
  - Stock symbols that contain a ‘.’ are supported in both Simple Syntax Complex Syntax.
  - For certain smart-routed stock contracts that have the same Symbol, Currency and Exchange, you would also need to specify the PrimaryExchange attribute to uniquely define the contract. This should be defined as the native exchange of a contract, and is good practice for all stocks.

Simple Syntax

`=RTD("Tws.TwsRtdServerCtrl",,"SPY@SMART/ARCA/STK///USD", "qt=Open")`

Complex Syntax

`=RTD("Tws.TwsRtdServerCtrl",,"sym=SPY", "sec=STK", "exch=SMART", "cur=USD", "prim=ARCA", "qt=Open")`

## Modifying The Request Code

Some customers may find that as opposed to generic ticks or live streaming data, they may want to remove or reduce the number of ticks. It is even possible to change RTD to report snapshot data instead. This section will document the process to change these underlying values requested.

Keep in mind, RTD is based on underlying C\# code. As such, a working knowledge of C\# is required. These modifications will also require a C\# compiler and interpreter are installed on your windows machine.

### Open The Solution File

Navigate to the TwsRtdServer source directory and launch the solution file.

This can be found at `{TWS API}\source\CSharpClient\TwsRtdServer\TwsRtdServer.sln`

### Find The Request

Within the solution file, you will need to navigate to the TwsRtdServerMktDataRequest.cs file. This file contains the request for [EClient.reqMktData](https://www.interactivebrokers.com/campus/ibkr-api-page/trader-workstation-api/#request-watchilst-data), which effects the underlying behavior. The request is on line 73.

### Update GenericTicks, Snapshot, or RegulatorySnapshot

By default, all generic ticks are requested in the RTD sample. For those who only need minimum values, such as Bid, Ask, Last, and their respective sizes, may want to change the genericTicks variable from monitoring the sample-provided values, and instead return an empty list.

### Compile the C\# Code

In your platform of choice, you will need to compile your code to be built moving forward. Compiling in debug is recommended for testing, though compiling for Release will provide the best performance once in production.

### Test The Result

It is then recommended to test any changes made. Depending on the software used to compile changes, users may be automatically launched into a new file to test with. It is encouraged to test any changes made to see that expected changes are changed correctly, while no other actions are effected.

## Sample Spreadsheet Guide

This guide is intended to introduce new customers to the RTD Excel Sample Sheet and introduce the systems available of our underlying API.

Sample spreadsheet applications are distributed with the API download for each of the API technologies (RTD Server, ActiveX, DDE). It is important to keep in mind that the sample applications are intended as simple demonstrations of API functionality for third party programmers. They do not have robust error handling functionality and are not intended to be used as production level trading tools.

### Locating the Sample Spreadsheet

While having TWS up and running and all the necessary API settings are set on TWS, as show [Configure Trader Workstation for RTD](#configure-tws-for-rtd), we can then locate our sample sheet. Navigate to `  C:\TWS API\samples\Excel  ` and select “TwsRtdServer.xls”.

### Navigating Through The Sample Spreadsheet

The sample sheet primarily uses the START and END macro buttons to automatically add or remove an equal sign at the beginning of the pre-populated formulas in order to complete each request.

In the sample, the names of the columns in the spreadsheet such as “Volume”, are used as the “topic string” and are referenced directly in the RTD formulas to create the formulas for each cell. You may do the same in your custom spreadsheet or you may write your formulas explicitly.

This spreadsheet consists of 3 pages:

  - **Samples**: includes examples for different security types (stocks, options, futures, forex, etc.)
  - **Tickers(EUR)**: includes a variety of European stokcs
  - **Tickers(USD)**: includes a variety of US stocks

NOTE: If if Exchange, Currency and SecType are not specified, those values default to SMART, USD and STK accordingly.

### Requesting Data

Requesting data through the Excel RTD sample is a simple process and can be done in 2 ways:

1.  Locate and click the start button on one of the 3 pages. This will trigger the data to start streaming. Implicitly, you may change the values in the columns to define your own security/contract.
2.  Create and enter a formula into any empty cell. Once you hit enter, the data will start streaming in that cell with the requested quote.

### Receiving Data

To request a specific Tick type, you can utilize the ‘qt’ parameter in the complex syntax by specifying it (for example, “qt=Bid”) or simply enter its name at the end of a simple syntax formula (for example, “AAPL@SMART BidSize”). Explore the various available tick types in our [Generic Tick Types section.](#generic-tick-types)  
\*It is important to note that each cell can only return one tick type (one quote).

## Underlying Requests

As stated within the [Architecture](/campus/ibkr-api-page/excel-rtd/#introduction) section, the Excel RTD API is built on the underlying Java API with standard Visual Basic Translations to allocate the data onto the Excel sheets. For additional insight into the underlying methods, see the [TWS API Documentation](/campus/ibkr-api-page/twsapi-doc/).
