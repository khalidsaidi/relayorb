# Excel DDE

## Introduction

The Dynamic Data Exchange protocol is a method of inter-process communication developed by Microsoft to establish communication between Windows applications running on the same computer. The DDE API is available for Windows computers to create a means of communication between Microsoft Excel and TWS or IB Gateway. This allows users to make calls to the standard API library using Visual Basic.

The Excel DDE API has the full functionality offered by the Trader Workstation API implemented via a DDE socket bridge that uses the open source Java – DDE interoperability library JDDE. This means the DDE API offering is built utilizing both Java and VB together in order to create a complete Excel offering to the standard put in place by Microsoft.

## Notes & Limitations

  - Sample spreadsheet applications are distributed with the API download for each of the API technologies (RTD Server, ActiveX, DDE). It is important to keep in mind that the sample applications are intended as simple demonstrations of API functionality for third party programmers. They do not have robust error handling functionality and are not intended to be used as production level trading tools.
  - Interactive Brokers does not offer any programming assistance and therefore it is strongly advised to anyone willing to use any of the TWS DDE API to become familiar with the technologies involved such as the DDE protocol and VBA.
  - By design, Microsoft Excel gives precedence to the user interface over the data connection to other applications. For that reason, Excel only receives updates when it is in a ‘ready’ state, and may ignore data sent for instance when a modal dialogue box is displayed to the user, a cell is being edited, or Excel is busy doing other things. A new Excel Real Time Data server (RTD) API has been introduced to help address some of these limitations, but they are inherent to Excel as a trading application and not specific to an API technology.
  - Excel must be set to the **US convention for commas and periods**. That is, commas denote thousands and periods denote decimals.

<!-- end list -->

  - Other programs running on the same computer which use DDE can interfere with the communication between Excel and TWS and cause Excel to ‘hang’ or ‘freeze’ after making the initial request. The only solution to this problem is to close other programs using DDE one-by-one to find the culprit. Programs which are known to cause this issue include Google Chrome, Microsoft OneNote, Skype and Adobe Creative Cloud.
  - Because the DDE Bridge is built using Java technologies, please install the latest version on your operating system from <https://www.oracle.com/java/technologies/downloads/#jdk21-windows> .

### macOS / Unix Support For Excel DDE

Excel DDE, Dynamic Data Exchange, is a system which produces a sub-task in order to exchange information to and from a given program. Given the TWS API is built around the EClient and EWrapper communication, discussed further in [TWS API Connectivity](/campus/ibkr-api-page/twsapi-doc/#connectivity). This data exchange system is essential for the functionality of our API offering.

The macOS [App Sandbox](https://developer.apple.com/documentation/security/app-sandbox) limit’s an apps ability to create additional tasks required for dynamic data exchange and is required for macOS application distribution.

Because this process limits the task creation of DDE, the TWS API Excel DDE offering cannot run on macOS, and is the reason the library is excluded from the Mac and Unix distribution of the TWS API.

### Unset Value Responses

In many cases, customers might see a response for a given market data column which displays “N/A”, “0”, “-1” in some of their cells. This can be occur for a few different reasons.

1.  While you may have part of the required market data subscription on the instrument, you may not have all of it. This is particularly common for derivatives traders who may not have a market data subscription for the given underlying.
2.  You might also encounter this by requesting too many symbols simultaneously. This is discussed further in the [Outgoing Message Rate Limitations](https://www.interactivebrokers.com/campus/ibkr-api-page/rtd/#message-rate) section
3.  Similar to (2) above, every client has a maximum number of market data lines shared between TWS and their API. By default, all customer’s have a maximum of 100 market data lines, allowing for 100 unique contracts to be requested at any one time. If you surpass this limit, you may find that some fields can not be returned.
4.  This may also happen in the event your machine, in tandem with Excel, simply can not handle the volume of data requested. While the machine limitations are unique to each user, you may explore and modify the refresh rate [as described in our documentation](https://www.interactivebrokers.com/campus/ibkr-api-page/rtd/#refresh-rate)

## Excel DDE Setup

### Step 1: Install Java

DDE Bridge is built using Java technologies, please install Java to run the DDE Socket Bridge. If Java is not installed, the Command Prompt window will be immediately shut down after you attempt to run DDE Socket Bridge.

[Java Installation Link](https://www.java.com/en/)

### **Step 2: Download TWS or IB Gateway**

In order to use the TWS API, all customers must install either Trader Workstation or IB Gateway to connect the API to. Both downloads maintain the same level of usage and support; however, they both have equal benefits. For example, IB Gateway will be less resource intensive as there is no UI; however, the Trader Workstation has access all of the same information as the API, if users would like an interface to confirm data.

It is recommended for API users to use offline TWS because TWS online version has automatic update. Please use same TWS version to make sure the TWS version and TWS API version are synced. These will help preventing version conflict issue.

Note:

1.  For IBHK API users, it is commended to use IB Gateway instead of TWS. it is because all IBHK users cannot choose “Never Lock Trader Workstation” in TWS – Global Configuration – Lock and Exit. If there is inactivity, TWS will be locked and there will be API disconnection.

[Download Trader Workstation](https://www.interactivebrokers.com/en/trading/tws.php#tws-software) [Download IB Gateway](https://www.interactivebrokers.com/en/trading/ibgateway-stable.php)

### Step 3: Download TWS API

It is recommended for API users to use same TWS API version to make sure the TWS version and TWS API version are synced in order to prevent version conflict issue.

Running the Windows version of the API installer creates a directory “C:\\\\TWS API\\” for the API source code in addition to automatically copying two files into the Windows directory for the DDE and C++ APIs. ***It is important that the API installs to the C: drive***, as otherwise API applications may not be able to find the associated files. The Windows installer also copies compiled dynamic linked libraries (DLL) of the ActiveX control TWSLib.dll, C\# API CSharpAPI.dll, and C++ API TwsSocketClient.dll. Starting in API version **973.07**, running the API installer is designed to install an ActiveX control TWSLib.dll, and TwsRtdServer control TwsRTDServer.dll which are compatible with both 32 and 64 bit applications.

It is important to know that the TWS API is **only** available through the interactivebrokers.github.io MSI or ZIP file. Any other resource, including pip, NuGet, or any other online repository is not hosted, endorsed, supported, or connected to Interactive Brokers. As such, updates to the installation should always be downloaded from the github directly.

[TWS API Download Page](https://interactivebrokers.github.io)

## Best Practice: Configure TWS / IB Gateway for DDE

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

## DDE Socket Bridge

The DDE Socket Bridge is an essential component of the Excel DDE API library. This governs all communication between the Trader Workstation and Excel using the JDDE implementation.

### Steps to launch DDE Socket Bridge

1.  Launch Trader Workstation or IB Gateway
2.  Open the Windows File Explorer
3.  Navigate to `C:\TWS API\samples\DdeSocketBridge`
4.  Double click the file, runDdeSocketBridge.bat. It may just be labeled as runDdeSocketBridge on your computer.
5.  There should be two popup windows that appear.
      - The first will be a black command prompt window. You may see a few lines stating you are connected, and a few stating “Error… data farm connection is OK.” These “errors” are only notifications, and should not cause concern.
      - You will also see a small java window. This will list the service name, host, port, clientId, and you should see “Connected\!”. If you see “Disconnected” instead, you may need to Configure Your Socket Bridge.
6.  Assuming your socket bridge is showing “Connected\!” then you can navigate to `C:\TWS API\samples\Excel` and open the  TwsDde.xls file sample.

Note:

DDE Socket Bridge is built with Java. Excel DDE users must have installed [Java 21](https://download.oracle.com/java/21/latest/jdk-21_windows-x64_bin.exe) in order to launch DDE Socket Bridge. If you open the runDdeSocketBridge.bat without an installed Java, you may discover that your Windows Command Prompt (CMD) is automatically opened and closed very quickly.

### Configuring the Socket Bridge

For various reasons, you may find the need to modify the connection values used for the DDE Socket Bridge. You are able to modify the ClientID, Host IP, Socket Port, or even the Service Name.

### Configure the Connecting ClientId

1.  Launch Trader Workstation or IB Gateway
2.  Open the Windows File Explorer
3.  Navigate to `C:\TWS API\samples\DdeSocketBridge`
4.  Right click the “runDdeSocketBridge.bat” file.
5.  Click **Edit** from the list. This will open a new Notepad window.
      - NOTE: Windows 11 users may need to choose “Show more options” first.
6.  On the third line after “DdeSocketBridge.jar” **add -c** followed by whichever ClientID you wish to connect with.

<!-- end list -->

``` EnlighterJSRAW
echo off
if not exist "DdeSocketBridge.jar" goto :error
java -Djava.library.path=.\src\main\resources -jar DdeSocketBridge.jar -c12345
goto :end
:error
echo DdeSocketBridge.jar is not found
:end
```

### Configure the Connecting Host IP Address

1.  Launch Trader Workstation or IB Gateway
2.  Open the Windows File Explorer
3.  Navigate to `C:\TWS API\samples\DdeSocketBridge`
4.  Right click the “runDdeSocketBridge.bat” file.
5.  Click **Edit** from the list. This will open a new Notepad window.
      - NOTE: Windows 11 users may need to choose “Show more options” first.
6.  On the third line after “DdeSocketBridge.jar” **add -h** followed by whichever IP Address you need to connect to.

NOTE: Be sure this IP address matches the location of your Trader Workstation. Also be sure that the Socket Bridge’s IP matches where Excel is being hosted.

``` EnlighterJSRAW
echo off
if not exist "DdeSocketBridge.jar" goto :error
java -Djava.library.path=.\src\main\resources -jar DdeSocketBridge.jar -h123.123.123.123
goto :end
:error
echo DdeSocketBridge.jar is not found
:end
```

### Configure the Connecting Service Name

1.  Launch Trader Workstation or IB Gateway
2.  Open the Windows File Explorer
3.  Navigate to `C:\TWS API\samples\DdeSocketBridge`
4.  Right click the “runDdeSocketBridge.bat” file.
5.  Click **Edit** from the list. This will open a new Notepad window.
      - NOTE: Windows 11 users may need to choose “Show more options” first.
6.  On the third line after “DdeSocketBridge.jar” **add -s** followed by whichever Service name you wish to use in Excel.

NOTE: Be sure on each page of your connected DDE that you match the User Name cell with what is listed here.

``` EnlighterJSRAW
echo off
if not exist "DdeSocketBridge.jar" goto :error
java -Djava.library.path=.\src\main\resources -jar DdeSocketBridge.jar -sExcelsior
goto :end
:error
echo DdeSocketBridge.jar is not found
:end
```

### Configure the Connecting Socket Port

1.  Launch Trader Workstation or IB Gateway
2.  Open the Windows File Explorer
3.  Navigate to `C:\TWS API\samples\DdeSocketBridge`
4.  Right click the “runDdeSocketBridge.bat” file.
5.  Click **Edit** from the list. This will open a new Notepad window.
      - NOTE: Windows 11 users may need to choose “Show more options” first.
6.  On the third line after “DdeSocketBridge.jar” **add -p** followed by whichever socket port you have specified in TWS or IB Gateway.

The default ports supplied by Interactive Brokers are as follows:

  - TWS Live Account: 7496 (Socket Bridge’s default value)
  - TWS Paper Account: 7497
  - IB Gateway Live Account: 4001
  - IB Gateway Paper Account: 4002

<!-- end list -->

``` EnlighterJSRAW
echo off
if not exist "DdeSocketBridge.jar" goto :error
java -Djava.library.path=.\src\main\resources -jar DdeSocketBridge.jar -p7497
goto :end
:error
echo DdeSocketBridge.jar is not found
:end
```

## Frequently Asked Questions

Q:

###### Why does nothing happen when I make a request in Excel?

A:

The most common reason for this behavior is that the DDE socket bridge is not running at the time of the request. Please refer to the [Socket Bridge](#socket-bridge) section to learn more on operating the socket bridge connection.

Q:

###### I launch the socket bridge and I see a window flash, then nothing happens?

A:

This is typical where Java is not installed properly on the machine. This is explained further in our [Notes & Limitations](#limitations) section.

Q:

###### Do I need to keep the command prompt open after running the "runDdeSocketBridge.bat" file?

A:

Yes. Both the black command prompt and white java window must remain open at all times while using DDE. Please refer to the [Socket Bridge](#socket-bridge) section to learn more on operating the socket bridge connection.

## Architecture

To elaborate further on the Excel DDE API, it is worth elaborating upon the underlying architecture of the system given its complexity. As stated prior, the Excel DDE is implemented using the open source Java – DDE interoperability library, JDDE because DDE is built around 32-bit systems natively. This is implemented utilizing two key parts.

First and foremost, there is the creation of the socket bridge itself. If you explore further in the DdeSocketBridge directory, you will find the full path towards  `C:\TWS API\samples\DdeSocketBridge\src\main` where the source code of the socket bridge is housed. The socket bridge is used as a translation tool between the DDE implemented by Visual Basic and the Trader Workstation. Listed within  `C:\TWS API\samples\DdeSocketBridge\src\main\java\com\ib\api\impl\EWrapperImpl.java` users will be able to find the full Java implementation structure of the TWS API. This particular file is used to receive and transmit data from Trader Workstation to Excel.

Meanwhile, the `C:\TWS API\samples\DdeSocketBridge\src\main\java\com\ib\api\dde\dde2socket\requests` directory encapsulates all of the various outbound requests sent from Excel to Trader Workstation. These files could be modified such that all outbound requests will then better modify values such as defaults or other passed information so as to not require they be implemented in each Excel request directly.

It is important to note that whenever modifications are made under  `C:\TWS API\samples\DdeSocketBridge\src\main` then the socket bridge will need to be recompiled

The socket bridge is only half of the greater DDE API. As the socket bridge handles the transmission of data from Excel to the socket bridge, then the socket bridge to TWS and back again. However, once the data has reached Excel from the socket bridge, Visual Basic must now carry the translations into the designated cells for which the data will be displayed. The content of the visual basic which impacts the default sample sheet is hosted in `C:\TWS API\samples\Excel\TwsDde`. Users who wish to modify how data behaves within Excel itself, such as how or where data is set, would need to make modifications here. Files such as BasicOrders.cls will handle how orders are placed or from which sheets and cells the data can be handled. These functions and can be copied to new files or resaved as needed by developers so long as they are appropriately modified to match their new environment.

## Requests in DDE

Requests made through the Excel DDE are handled through two primary methods: An [Excel Formula Structure](https://www.interactivebrokers.com/campus/ibkr-api-page/excel-dde/#dde-formula-structure) or a [DDEPoke method call](https://www.interactivebrokers.com/campus/ibkr-api-page/excel-dde/#dde-poke).

Requests with the TWS API that do not take any arguments, such as EClient.reqCurrentTime, EClient.reqOpenOrders, or EClient.reqPositions are all made using an Excel Formula request using the [DDERequest Method call](https://learn.microsoft.com/en-us/office/vba/api/excel.application.dderequest). Please note there is a known restriction in Excel that the DDERequest method can only send 255 symbols in its request.

For requests that contain at least one or more argument, such as EClient.reqMktData, EClient.reqContractDetails, or EClient.placeOrder, must be made using the [Visual Basic DDEPoke Method Call](https://learn.microsoft.com/en-us/office/vba/api/excel.application.ddepoke).

Please be sure to review the underlying [TWS API functions](https://www.interactivebrokers.com/campus/ibkr-api-page/twsapi-doc/) to understand which requests have arguments and which do not.

### Excel Formula Structure

Requests with the TWS API that do not take any arguments, such as EClient.reqCurrentTime, EClient.reqOpenOrders, or EClient.reqPositions are all made using an Excel Formula request using the [DDERequest Method call](https://learn.microsoft.com/en-us/office/vba/api/excel.application.dderequest).

##### Note:

There is a known restriction in Excel that the DDERequest method can only send 255 symbols in its request.

The Excel DDE formula is comprised of several separate components. As a baseline there is the Server, also known as the Service Name from your DDE Socket Bridge. This is followed by your Request Type, and finally the Request String.

We will use this formula to elaborate on this structure: `=@Stwsserver|reqCurrentTime!id4?time`

  - ‘=@Stwsserver’: This first part indicates the Service Name set for our socket bridge connection. The ‘=@S’ indicates the start of a formula, and that the next value will be our Service Name.
  - ‘|’: The pipe, the character typically above the Enter/Return key, is used to divide our service name from the rest of the request.
  - ‘reqCurrentTime’ immediately after the pipe is used to state the Request Type we would like to make. These request types are based on the TWS API EClient request types documented in the [TWS API Documentation](https://www.interactivebrokers.com/campus/ibkr-api-page/twsapi-doc/).
  - “\!'”: The exclamation, (\!) indicates the start of the request with the request ID. This is formatted as id1 or whichever number is pertinent.
  - After the ID we should indicate a question mark (?), to denote which parameter to receive. In the example above, we are both requesting the current time and then printing the time value to the cell using “?time”.

### DDE Poke Requests

For requests that contain at least one or more argument, the request must be made using the [Visual Basic DDEPoke Method Call](https://learn.microsoft.com/en-us/office/vba/api/excel.application.ddepoke).

The DDEPoke request method call will send Excel table values in binary format to the [DdeSocketBridge](https://www.interactivebrokers.com/campus/ibkr-api-page/excel-dde/#socket-bridge).

The VBA code below is an example of how DDE Poke requests are sent from Excel to the DDE Socket Bridge. Please be aware that this function call uses the sendPoke function of the TwsDde Sample’s “util.bas” file located at “C:\\TWS API\\samples\\Excel\\TwsDde\\util.bas”.

``` EnlighterJSRAW
Sub sendPlaceOrder(server As String, cell As Range)

    ' get id
    Dim id As String
    Dim placeOrderStr As String
    Dim requestStr As String
    Dim i As Integer
    Dim columnsArray() As Variant
    Dim columnIndex As Integer

    With Worksheets(STR_SHEET_NAME)
        id = .Cells(cell.row, errorColumnIndex + 1).value
        If id = util.STR_EMPTY Then ' none exists yet -- is original placement as opposed to modify
            id = OrderFunctions.makeId(server)

            ' fill "id" column with id
            .Cells(cell.row, errorColumnIndex + 1).value = id
        End If
        
        
        ' fill "error" column with formula
        .Cells(cell.row, errorColumnIndex).Formula = util.composeLink(server, requestStr, id, util.STR_ERROR)

        
        ' send request
        util.sendPoke Worksheets(STR_SHEET_NAME), server, placeOrderStr, id, cell, startOfContractColumns, getContractColumns(), 0, idColumnIndex, orderBaseColumnsStart, orderBaseColumnsEnd, orderExtColumnsStart, orderExtColumnsEnd
        
        ' fill columns with formulas
        For i = 0 To UBound(columnsArray) - LBound(columnsArray)
            .Cells(cell.row, columnIndex + i).Formula = util.composeLink(server, requestStr, id, columnsArray(i))
        Next i
    End With

End Sub
```

## DDE Response Structures

Requests made using our Excel DDE will respond in [single variable structures](https://www.interactivebrokers.com/campus/ibkr-api-page/excel-dde/#single-value-requests) such that a single value will be returned to a given cell. In other scenarios, requests will handle responses through an array passed to Visual Basic. These [array value responses](https://www.interactivebrokers.com/campus/ibkr-api-page/excel-dde/#array-value-responses) must be handled through Visual Basic to assign a range of cells in your sheet to assign the data.

### Single value responses

It is possible to view live quotes for multiple products updating real time within Excel. Requests via the TWS DDE API are nothing but Excel formulas (DDE data links) each of them serving a very specific purpose. Market Data retrieval requires at least two different DDE links: one to start the market data subscription and another one which will be receiving the specific tick type.

In many instances, customers are able to designate a single cell and print out values as they are retrieved from the DDE Socket Bridge as they are produced. These are single variable responses, such as data ticks to retrieve specifically a “LAST” or “BID” value.

### Array Value Responses

In many cases, you will find that data may be returned to visual basic in an array of values rather than as a single value. In these instances, we must implement Visual Basic to receive and distribute this data throughout the sheet. This can not be done using a formula alone.

## Building A Contract

For nearly all instrument-based requests, you will need to create a contract. The standard format of a contract is built for the request, and will utilize an underscore (\_) delimited string of all of the contracts attributes. The contract is then concluded with a final “\~/'”

Below, we have included an array of different samples that can be used as samples.

### Combo / Spread (BAG)

#### *Formula*

\[num\_of\_legs\]\_\[Leg ConId\]\_\[Leg Ratio\]\_\[Leg Side\]\_\[Leg Exchange\]\_\[Open/Close\]\_\[Short Sale Slot\]\_\[Designated Location\]\_\[Exempt Code\]

If a field is to be ignored, a tilde, \~, should be passed in the given position.

#### *Example*

`2_265598_1_BUY_SMART_~_~_~_~_8314_1_SELL_SMART_~_~_~_~`  
The example above would be a combo that is Long AAPL and Short IBM.

### Forex Pairs

#### *Formula*

\[symbol\]\_\[SecType\]\_\[exchange\]\_\[currency\]\_\~/

#### *Example*

EUR\_CASH\_IDEALPRO\_USD\_\~/

### Futures contract w/ local symbol

#### *Formula*

\[symbol\]\_\[sec type\]\_\[exchange\]\_\[currency\]\_\~/

#### *Example*

ESZ6\_FUT\_CME\_USD\_\~/

### Futures contract w/ underlying

#### *Formula*

\[underlying symbol\]\_\[sec Type\]\_\[expiry\]\_\[multiplier\]\_\[exchange\]\_\[currency\]\_\~\_\~/

#### *Example*

ES\_FUT\_201612\_50\_CME\_USD\_\~\_\~/

### Futures Option w/ local symbol

#### *Formula*

\[symbol\]\_\[SecType\]\_\[exchange\]\_\[currency\]\_\~/

#### *Example*

XTZ6 C1100\_FOP\_CME\_USD\_\~/

### Futures Option w/ underlying contract

#### *Formula*

\[underlying symbol\]\_\[sec type\]\_\[expiry\]\_\[strike\]\_\[P/C\]\_\[multiplier\]\_\[exchange\]\_\[currency\]\_\~\_\[trading class\]/

#### *Example*

EUR\_FOP\_20161209\_1.1\_C\_125000\_CME\_USD\_\~\_XT/

### Indices

#### *Formula*

\[symbol\]\_\[sec type\]\_\[exchange\]\_\[currency\]\_\~/

#### *Example*

ES\_IND\_CME\_USD\_\~/

### Options contract w/ local symbol

*Note: The format of the option local symbol conforms to the [Option Symbology Initiative (OSI)](https://ibkb.interactivebrokers.com/article/972).*

#### *Formula*

\[symbol\]\_\[SecType\]\_\[exchange\]\_\[currency\]\_\~/’

#### *Example*

C DBK DEC 22 1300\_OPT\_EUREX\_EUR\_\~/’

### Options contract w/ underlying

#### *Formula*

\[underlying symbol\]\_\[sec type\]\_\[expiry\]\_\[strike\]\_\[P/C\]\_\[multiplier\]\_\[exchange\]\_\[currency\]\_\~\_\~/’

#### *Example*

DBK\_OPT\_20221007\_13\_C\_100\_EUREX\_EUR\_\~\_\~/’

### Stocks & ETFs

#### *Formula*

\[symbol\]\_\[sec Type\]\_\[exchange\]\_\[currency\]\_\~/’

#### *Example*

IBKR\_STK\_SMART\_USD\_\~/’

## Sample Spreadsheet Guide

This guide is intended to introduce new customers to the DDE Excel Sample Sheet and introduce the systems available of our underlying API.

Sample spreadsheet applications are distributed with the API download for each of the API technologies (RTD Server, ActiveX, DDE). It is important to keep in mind that the sample applications are intended as simple demonstrations of API functionality for third party programmers. They do not have robust error handling functionality and are not intended to be used as production level trading tools.

### Initial Connection

To build a connection between Excel and the TWS for DDE, users must first launch the DdeSocketBridge. This can be found in the C: drive by default, inside `{TWS API}\samples\DdeSocketBridge`. Double clicking the file, runDdeSocketBridge.bat, will launch the socket bridge and allow communication between the Trader Workstation and Excel.

If you have any issues connecting with the socket bridge, please see the section, [DDE Socket Bridge](#socket-bridge)

After launching the socket bridge and all the necessary API settings are set on TWS, as show in [Configure Trader Workstation for DDE](#dde-tws-config) and having TWS running, we can then locate our sample sheet. Navigate to C:/TWS API/samples/Excel and select “TwsDde.xls”.

### Locating the Sample Spreadsheet

After launching the socket bridge and while having TWS open and all the necessary API settings are set on it, as show in [Configure Trader Workstation for DDE](#dde-tws-config), we can then locate and open our sample sheet. Navigate to`  C:\TWS API\samples\Excel  ` and select “TwsDde.xls”.

### Navigating Through The Sample

The Excel DDE Sample sheet should launch, initially displaying a yellow and grey sheet with several symbols listed. By looking in the bottom let, you should see a white banner labeled “Tickers”. You will then see several additional tabs on the bottom such as Errors, BasicOrders, ExtendedOrderAttributes, and more. All of these tabs on the bottom correspond to different functionality of the API. You may need to click the arrow in the bottom left to scroll to the right, showing even more tabs.

### Requesting Data

Requesting data through the Excel DDE API is quite simple in our sample structure. All that must be done for most pages is to select the row or rows of data, and select the “Request Mkt Data” button at the top. This will request data for whatever respective row is selected.

### Receiving Data

Endpoints can be received in two standard ways. The first most common method is to retrieve all of the data in-line within the same page. This is prevalent in the Tickers and BasicOrders and several others. This is common for situations where single cell values are released for a given value.

Other times, you will see a new page created to house returned data. This is prevalent for Historical Market Data, Market Scanners, and more. This is where multiple values will be retrieved that correspond to the same identifier.

### Receiving Data: In-row data

For in-line data, you will see the value appear directly to the right. The code has been designed to reference the column headers. As such, if you find that certain data in in-line responses are not needed, you may simply remove the column form the sheet.

### Receiving Data: New Page

This will generate a brand new page at the end of the tab list as defined in the “Page Name” column of the original request. In the case of Historical data and the IBKR Stock request, you will see column V list “IBKR\_STK\_SMART\_USD”. In Column W, we will see the Activate Page column.

## Underlying Requests

As stated within the [Architecture](#architecture) section, the Excel DDE API is built on the underlying Java API with standard Visual Basic Translations to allocate the data onto the Excel sheets. For additional insight into the underlying methods, see the [TWS API Documentation](https://www.interactivebrokers.com/campus/ibkr-api-page/trader-workstation-api/).

## Use Case

This guide is intended to introduce new customers to the DDE Excel example use cases.

### Requesting Live Data

You can use “Tickers” tab to request live market data.

### Placing Conditional Order

In TWS API 10.28+, you can use Excel DDE to place conditional order again.

In “Basic Order Tab”, placing conditional order requires entering:

  - Conditions (Column DY)
  - Ignore Rth (0 / 1) (Column DZ)
  - Cancel Order (0 / 1) (Column EA)

The images shown in the right-side show how to place a Price Conditional Order for IBM (ConId: 8314).

Here are the example formulas for Conditions (Column DY):

  - Price

*Default:*

default Price of 8314(SMART) is \<= 55 and

default Price of 8314(SMART) is \<= 55 or

*Double Bid/Ask:*

double bid/ask Price of 8314(SMART) is \<= 55 or

*Last:*

last Price of 8314(SMART) is \<= 55 or

*Double Last:*

double last Price of 8314(SMART) is \<= 55 or

*Bid/Ask:*

bid/ask Price of 8314(SMART) is \<= 55 or

*Last or Bid/Ask:*

last of bid/ask Price of 8314(SMART) is \>= 55 or

*Mid-point:*

mid-point Price of 8314(SMART) is \<= 55 or

  - Time

time is \<= 20240415 12:00:00 Europe/Tallinn and

time is \>= 20240415 12:00:00 Europe/Tallinn and

  - Margin Cushion

the margin cushion percent is \<= 4 and

the margin cushion percent is \>= 5 and

  - Daily P\&L

<!-- end list -->

  - Volume

Volume of 8314(SMART) is \<= 1200 and

Volume of 8314(SMART) is \>= 1200 or

  - Trade

trade occurs for IBM symbol on ARCA exchange for STK security type and

  - Percentage Change

PercentChange of 8314(SMART) is \<= 1 and

PercentChange of 8314(SMART) is \>= 2 and

  - Shortable Shares

<!-- end list -->

  - Fee Rate in %

Here is an example of placing an order with multiple conditions:

  - `OR`

bid/ask Price of 8314(SMART) is \<= 55 or default Price of 8314(SMART) is \<= 55 or

  - `AND`

bid/ask Price of 8314(SMART) is \<= 55 and default Price of 8314(SMART) is \<= 55 and

### Requesting Open Orders

You can use “OpenOrders” tab to request OpenOrders data.

### Requesting Positions

For individual accounts, you can use “Positions” tab to request Positions data.  
The image shown on the top right-side shows how to request Positions data.

For FA accounts, you can use “PositionsMulti” tab to request your clients’ positions.  
The image shown on the bottom right-side shows how to request FA clients’ Positions.

### Requesting Option Chain

You can use “SecDefOptParams” tab to request Option Chain live market data.

Getting Option Chain live market data requires entering:

  - Underlying Symbol
  - Underlying SecType
  - Underlying ConId
  - Page Name
  - Activate Page (TRUE / FALSE)

The images shown in the right-side show how to request IBM STK Option data and its output.
