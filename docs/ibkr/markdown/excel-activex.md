# Excel ActiveX

## Introduction

The ActiveX API is available for Windows computers to create a means of communication between Microsoft Excel and TWS or IB Gateway.

The ActiveX API wraps the C\#/.NET API and is provided as an open source project TWSLib. ActiveX is a legacy technology developed by Microsoft, it essentially allows applications to share information with each other. The current ActiveX API for Excel wraps the C\#/.NET API and is provided as an open source project TWSLib. It is suggested to also consider using the C\# API directly as it provides seamless integration with the .NET framework.

One possible advantage of using the ActiveX for Excel API as compared to RTDServer or DDE is that ActiveX does provide the same number of functions as the other socket-based technologies (C\#, Java, C++, Python). Disadvantages of the ActiveX Excel API is that it is more difficult to program as compared to other Excel APIs and not as robust as non-Excel socket-based API applications.

## Notes & Limitations

  - The sample ActiveX spreadsheet provided with the API is meant only as a demonstration of API functionality, and not intended as a production-level tool to be used in trading. While it is designed with examples of almost all API functions, it does not have the necessary functionality to handle problems that may occur during trading such as disconnections, error codes, or dropped events in a robust way.
  - One possible advantage of using the ActiveX for Excel API as compared to RTDServer or DDE is that ActiveX does provide the same number of functions as the other socket-based technologies (C\#, Java, C++, Python). Disadvantages of the ActiveX Excel API is that it is more difficult to program as compared to other Excel APIs and not as robust as non-Excel socket-based API applications.
  - Sample spreadsheet applications are distributed with the API download for each of the API technologies (RTD Server, ActiveX, DDE). It is important to keep in mind that the sample applications are intended as simple demonstrations of API functionality for third party programmers. They do not have robust error handling functionality and are not intended to be used as production level trading tools.
  - Interactive Brokers does not offer any programming assistance and therefore it is strongly advised to anyone willing to use any of the TWS ActiveX API to become familiar with the technologies involved such as C\#.
  - By design, Microsoft Excel gives precedence to the user interface over the data connection to other applications. For that reason, Excel only receives updates when it is in a ‘ready’ state, and may ignore data sent for instance when a modal dialogue box is displayed to the user, a cell is being edited, or Excel is busy doing other things. A new Excel Real Time Data server (RTD) API has been introduced to help address some of these limitations, but they are inherent to Excel as a trading application and not specific to an API technology.
  - Excel must be set to the US convention for commas and periods. That is, commas denote thousands and periods denote decimals.

### macOS / UNIX Support For Excel ActiveX

The TWS API Excel ActiveX Implementation is built around the [Component Object Model (COM)](https://learn.microsoft.com/en-us/windows/win32/com/component-object-model--com--portal) architecture. The COM object and it’s derivatives like ActiveX and [OLE (Compound Documents)](https://learn.microsoft.com/en-us/windows/win32/com/compound-documents) are built exclusively into Microsoft Windows and are reliant on the Operating System’s Registry structure.

Given the underlying technology of ActiveX requires Windows-specific architecture regarding it’s registry, the TWSAPI Excel ActiveX functionality is not available in the Mac and Unix distribution of the TWSAPI offering.

### NA Reference Error

Clients who may have installed the API into a unique location may receive an \#NA message in each ActiveX cell. While this is often indicative of a reference error, the \#NA reference may be failing to call an installed DLL essential for the connection with Trader Workstation. To resolve this error, please follow the steps listed below:

1.  Uninstall the API from the “Add/Remove Tool” in the Windows Control Panel as usual
2.  Delete the C:\\TWS API\\ folder if any files are still remaining to prevent a version mismatch.
3.  Locate the file “C:\\Windows\\SysWOW64\\TwsSocketClient.dll”. Delete this file.

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

## Best Practice: Configure TWS / IB Gateway for ActiveX

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

## Sample Spreadsheet Guide

This guide is intended to introduce new customers to the ActiveX Excel Sample Sheet and introduce the systems available of our underlying API.

Sample spreadsheet applications are distributed with the API download for each of the API technologies (RTD Server, ActiveX, DDE). It is important to keep in mind that the sample applications are intended as simple demonstrations of API functionality for third party programmers. They do not have robust error handling functionality and are not intended to be used as production level trading tools.

### Locating the Sample Spreadsheet

While having TWS up and running and all the necessary API settings are set on TWS, as show on {TWS API CONFIG LINK}, we can then locate our sample sheet. Navigate to `  C:\TWS API\samples\Excel  ` and select “TwsActiveX.xls”.

### Initial Connection

After launching the sheet, you will be greeted with the General tab, which includes the connection details.

As it is with other Socket-based technologies, the host, port and ClientID are required when establishing the connection to TWS:

  - If TWS and Excel are on the same machine, then Host could be left blank as this represents the ‘localHost’.
  - Port Number must be the same port TWS listens on. By default, it will be set to 7496.
  - The client ID can be any positive integer and will be used to identify this specific API connection.

Assuming your connection details are correct, you may click the “Connect to TWS” button in the top right corner now. The red “Not connected” button will turn yellow while “Connecting”. When can start using the sheet once the button says “Connected” in green.

**Note:** Please be aware it may take a second or two for the connection to begin. You may need to wait a moment for the connection to establish.

### Navigating Through The Sample

Selecting other tabs will display a green and grey sheet with several symbols listed. By looking in the bottom left, you should see a white banner labeled “Tickers”. You will then see several additional tabs on the bottom such as Bulletins, Market Depth, Basic Orders, and more. All of these tabs on the bottom correspond to different functionality of the API. You may need to click the arrow in the bottom left to scroll to the right, showing even more tabs.

### Requesting Data

Requesting data through the Excel ActiveX API is quite simple in our sample structure. All that must be done for most pages is to select the row or rows of data, and select the “Request \_\_\_ Data” button at the top. This will request data for whatever respective row is selected.

### Receiving Data

Endpoints can be received in two standard ways. The first most common method is to retrieve all of the data in-line within the same page. This is prevalent in the Tickers and BasicOrders and several others. This is common for situations where single cell values are released for a given value.

Other times, you will see a new page created to house returned data. This is prevalent for Historical Market Data, Market Scanners, and more. This is where multiple values will be retrieved that correspond to the same identifier.

### Receiving Data: In-row data

For in-line data, you will see the value appear directly to the right. The code has been designed to reference the column headers. As such, if you find that certain data in in-line responses are not needed, you may simply remove the column form the sheet.

### Receiving Data: New Page

This will generate a brand new page at the end of the tab list as defined in the “Page Name” column of the original request. In the case of Historical data and the IBKR Stock request, you will see column V list “IBKR\_STK\_SMART\_USD”. In Column W, we will see the Activate Page column.

## Architecture

The Interactive Brokers ActiveX API is rather unique in the sense that it demands the most Visual Basic knowledge to operate the API of our three Excel offerings. However, the API is similar to RTD in the sense that much of the underlying functionality and requests are based on C\# source code.

To elaborate on this process further, C\# makes the underlying requests to EClient.reqMktData, receiving data in EWrapper.tickData, and so on with accordance to the [Trader Workstation API](https://www.interactivebrokers.com/campus/ibkr-api-page/trader-workstation-api/). As such, changes to method request systems are built in the C\# code directly. As with our other source code, this is the baseline for all clients and is used to interpret data from a TCP socket bridge connection to the Trader Workstation. This is documented within `C:\TWS API\source\CSharpClient\activex`

The ActiveX component of this API comes from the communication between C\# and Visual Basic. Specifically, the use of the [System.Runtime.InteropServices Namespace](https://learn.microsoft.com/en-us/dotnet/api/system.runtime.interopservices?view=net-7.0) supports the COM interoperability that provides the foundation of ActiveX.

Finally, Visual Basic will intercept the messages sent through the Namespace and then assign that data to specific cells in your active workbook. This code is all established at `{TWS API}\samples\Excel\TwsActiveX`

## Underlying Requests

As stated within the Architecture section, the Excel ActiveX API is built on the underlying C\# API with standard Visual Basic Translations to allocate the data onto the Excel sheets. For additional insight into the underlying methods, see the TWS API Documentation.
