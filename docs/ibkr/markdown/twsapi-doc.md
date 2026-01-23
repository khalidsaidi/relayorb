# TWS API Documentation

## Introduction

The TWS API is a TCP Socket Protocol API based on connectivity to the Trader Workstation or IB Gateway. The API acts as an interface to retrieve and send data autonomously to Interactive Brokers. Interactive Brokers provides code systems in Python, Java, C++, C\#, and VisualBasic.

The TWS API is a message protocol as its core, and any library that implements the TWS API, whether created by IB or someone else, is a tool to send and receive these messages over a TCP socket connection with the IB host platform (TWS or IB Gateway). As such the system can be tweaked and modified into any language of interest given the intention to translate the underlying decoder.

In short, a library written in any other languages must be sending and receiving the same data in the same format as any other conformant TWS API library, so users can look at the documentation for our libraries to see what a given request or response consists of (what it must include, in what form, etc.) and implement them in their own structure.

Our TWS API components are aimed at experienced professional developers willing to enhance the current TWS functionality. Before you use TWS API, please make sure you fully understand the concepts of OOP (<https://www.geeksforgeeks.org/introduction-of-object-oriented-programming/>) and other Computer Science Concepts. Regrettably, Interactive Brokers cannot offer any programming consulting. Before contacting our API support, please always refer to our available documentation, sample applications and Recorded Webinars

This guide references the Java, VB, C\#, C++ and Python Testbed sample projects to demonstrate the TWS API functionality. Code snippets are extracted from these projects and we suggest all those users new to the TWS API to get familiar with them in order to quickly understand the fundamentals of our programming interface. The Testbed sample projects can be found within the samples folder of the TWS API’s installation directory.

## Notes & Limitations

While Interactive Brokers does maintain a Python, Java, C\#, and C++ offering for the TWS API, C\# and our Excel offerings are exclusively available for Windows PC. As a result, these features are not available on Linux or Mac OS.

### Requirements

  - A funded and opened IBKR Pro account
  - The current Stable or Latest release of the TWS or IB Gateway
  - The current Stable or Latest release of the TWS API
  - A working knowledge of the programming language our **Testbed** sample projects are developed in.

The minimum supported language version is documented on the right for each of our supported languages.

Please be sure to toggle the indicated language to the language of your choosing.

  - Python
  - Java
  - C++
  - C\#

Minimum supported Python release is version 3.11.0.

The minimum supported Java version is \< href="[“\>Java 21](https://www.oracle.com/java/technologies/downloads/).

The minimum supported C++ version is C++ 14 Standard.

The C\# implementation was built using:

  - .NET Core 3.1
  - .NET Framework 4.8
  - .NET Standard 2.0

### Limitations

Our programming interface is designed to automate some of the operations a user normally performs manually within the TWS Software such as placing orders, monitoring your account balance and positions, viewing an instrument’s live data… etc. There is no logic within the API other than to ensure the integrity of the exchanged messages. Most validations and checks occur in the backend of TWS and our servers. Because of this it is highly convenient to familiarize with the TWS itself, in order to gain a better understanding on how our platform works. Before spending precious development time troubleshooting on the API side, it is recommended to first experiment with the TWS directly.

**Remember:** If a certain feature or operation is not available in the TWS, it will not be available on the API side either\!

### C\# for MacOS

The TWS API C\# source files are not available through the Mac and Unix distribution download as the language is built around Dynamic Link Library (DLL) files for execution. This is because DLL files are exclusively supported through Windows platforms.

### C++ DLLs and Static Linking

Following the TWS API’s recent migration to Protobuf, clients developing in C++ should prioritize static linking over the use of DLLs.

This recommendation is based on the Google Protobuf documentation. For more information on the reasoning behind it, or questions on enabling DLLs for use with Protobuf, please see [DLLs vs static linking](https://chromium.googlesource.com/external/github.com/google/protobuf/+/HEAD/cmake/README.md#dlls-vs_static-linking).

### Canadian Residents Restricted From Programmatically Trading Canadian Products

Interactive Brokers Canada Inc. (IBC) does not allow users to use your own trading application to electronically submit order for products traded on a Canadian exchange or other marketplace through API, which would include Third Party Integrations. This decision was made through multiple and extensive communications between IBC compliance and personnel and senior management of the Canadian Investment Regulatory Organization (CIRO), formerly the Investment Industry Regulatory Organization of Canada (IIROC), our self-regulatory organization.

CIRO has implemented [IIROC Dealer Member Rule (DMR) 3200](https://www.ciro.ca/sites/default/files/legacy/2021-09/RulesCollated_090121_en.pdf) A. 1. (b) (i) which prohibits CIRO registrants, including IBC, from allowing its clients to use their own automated order systems to generated orders.

Unfortunately, these restrictions would be also applicable with third-party applications like TradingView, NinjaTrader, or other such groups as they use an API connection.

### Paper Trading

If your regular trading account has been approved and funded, you can use your Account Management page to open a [Paper Trading Account](https://www.ibkrguides.com/clientportal/papertradingaccount.htm) which lets you use the full range of trading facilities in a simulated environment using real market conditions. Using a Paper Trading Account will allow you not only to get familiar with the TWS API but also to test your trading strategies without risking your capital.

Please be aware that the Paper Trading Environment relies on more simulated technologies than the Live trading environment. As a result, certain behavior such as order execution may vary

Note the paper trading environment has inherent [limitations](https://www.ibkrguides.com/clientportal/aboutpapertradingaccounts.htm).

## Download TWS or IB Gateway

In order to use the TWS API, all customers must install either Trader Workstation or IB Gateway to connect the API to. Both downloads maintain the same level of usage and support; however, they both have equal benefits. For example, IB Gateway will be less resource intensive as there is no UI; however, the Trader Workstation has access all of the same information as the API, if users would like an interface to confirm data.

[Download Trader Workstation](https://www.interactivebrokers.com/en/trading/tws.php#tws-software) [Download IB Gateway](https://www.interactivebrokers.com/en/trading/ibgateway-stable.php)

### TWS Online or Offline Version?

It is recommended for API users to use offline TWS because TWS online version has automatic update. Please use same TWS version to make sure the TWS version and TWS API version are synced. These will help preventing version conflict issue.

## TWS Settings

Some TWS Settings affect API.

### TWS Configuration For API Use

The settings required to use the TWS API with the Trader Workstation are managed in the Global Configuration under “API” -\> “Settings”

In this section, only the most important API settings for API connection are covered.

Please:

  - Enable “ActiveX and Socket Clients”
  - Disable “Read-Only API”
  - Verify the “Socket Port” value

### Best Practice: Configure TWS / IB Gateway

The information listed below are not required or necessary in order to operate the TWS API. However, these steps include many references which can help improve the day to day usage of the TWS API that is not explicitly offered as a callable method within the API itself.

### "Never Lock Trader Workstation" Setting

Note: For IBHK API users, it is commended to use IB Gateway instead of TWS. It is because all IBHK users cannot choose “Never Lock Trader Workstation” in TWS – Global Configuration – Lock and Exit. If there is inactivity, TWS will be locked and there will be API disconnection.

### Memory Allocation

In TWS/ IB Gateway – “Global Configuration” – “General”, you can adjust the **Memory Allocation (in MB)\***.

This feature is to control how much memory your computer can assign to the TWS/ IB Gateway application. Usually, higher value allows users to have faster data returning speed.

Normally, it is recommended for API users to set 4000. However, it depends on your computer memory size because setting too high may cause High Memory Usage and application not responding.

For details, please visit: <https://www.ibkrguides.com/traderworkstation/increase-tws-memory-size.htm>

Note:

1.  In IB Gateway Global Configuration – API – settings, there is no “Compatibility Mode: Send ISLAND for US stocks trading on NASDAQ”. Specifying NASDAQ exchange in contract details may cause error if connecting to IB Gateway. For this error, please specify ISLAND exchange.

### Daily & Weekly Reauthentication

### **Daily Reauthentication**

In TWS/ IB Gateway – “Global Configuration” – “Lock and Exit”, you can choose the time of your TWS being shut down.

For API users, it is recommended to choose “Never lock Trader Workstation” and “Auto restart”.

Note:

1.  IBHK users do not have “**Never lock Trader Workstation**” and “**Auto restart**” in TWS. It is suggested for IBHK users to use IB Gateway in order to have stable API connection because IB Gateway won’t be locked due to inactivity. Also, IBHK users can choose “**Auto restart**” in IB Gateway.

### **Weekly Reauthentication**

The weekly authentication cycle starts on every Monday. If you receive `Login failed = Soft token=0 received instead of expected permanent for zdc1.ibllc.com:4001 (SSL)`,  this means you need to manually login again to complete the weekly reauthentication task.

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

Each IB account has a pre-decided IB server. You can visit this link to know our IB servers’ locations: <https://www.interactivebrokers.com/download/IB-Host-and-Ports.pdf>

Yet, all IB paper accounts are connected to US server by default and its location cannot be changed.

As IB servers in different regions have different scheduled server maintenance time ( [https://www.interactivebrokers.com/en/software/systemStatus.php ](https://www.interactivebrokers.com/en/software/systemStatus.php)), you may need to change the IB server location in order to avoid service downtime.

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

After you submit the ticket, you will receive a web ticket reply which **require you to confirm and understand the migration request**.

Note:

1.  For Internet users, as the connection between IB server and Exchange goes through a dedicated line, it is commonly recommended to choose a IB server location which is closer to your TWS location. For IB connection types, please visit: <https://www.interactivebrokers.co.uk/en/software/connectionInterface.php>
2.  The pre-decided IB server location connected from TWS is different from the IB Server location connected from IB Client Portal and IBKR Mobile.
      - IB server location connected from TWS is pre-decided. You can submit a web ticket to request the IB server relocation for the TWS connection.
      - IB server location connected from Client Portal or IBKR Mobile is based on your nearest IB server location. You cannot request the IB server relocation for Client Portal and IBKR Mobile connections. OAuth CP API users now cannot specify which server they want to connect to by themselves.

### SMART Algorithm

In TWS Global Configuration – Orders – Smart Routing, you can set your SMART order routing algorithm. For available SMART Routing via TWS API, please visit: <https://www.interactivebrokers.com/campus/ibkr-api-page/contracts/#smart-routing>

### Allocation Setup (For Financial Advisors)

In TWS Global Configuration – Advisor Setup – Presets, you can need to choose Allocation Preference in order to avoid wrong allocation result.

### Intelligent Order Resubmission

The TWS Setting listed in the Global Configuration under API -\> Setting for **Maintain and resubmit orders when connection is restored**, is enabled by default in TWS 10.28 and above. When this setting is checked, all orders received while connectivity is lost will be saved and automatically resubmitted when connectivity is restored. Please note, if the Trader Workstation is closed during this time, the orders are deleted regardless of the setting.

Beginning with Trader Workstation and IB Gateway 10.40, the Global Configuration -\> API -\> Settings will provide a new setting for “Maintain and resubmit orders when connection is restored.” This setting will automatically maintain or submit any orders on the platform after a network disconnect or the [auto-restart behavior](/campus/ibkr-api-page/twsapi-doc/#bp-reauthenticate).

### Disconnect on Invalid Format

The TWS Setting listed in the Global Configuration under API -\> Setting for **Maintain connection upon receiving incorrectly formatted fields**, is enabled by default in TWS 10.28 and above. For clients operating on Client Version 100 and above, users will not disconnect from fields with invalid value submissions when the setting is enabled.

## Download the TWS API

It is recommended for API users to use same TWS API version to make sure the TWS version and TWS API version are synced in order to prevent version conflict issue.

Running the Windows version of the API installer creates a directory “C:\\\\TWS API\\” for the API source code in addition to automatically copying two files into the Windows directory for the DDE and C++ APIs. ***It is important that the API installs to the C: drive***, as otherwise API applications may not be able to find the associated files. The Windows installer also copies compiled dynamic linked libraries (DLL) of the ActiveX control TWSLib.dll, C\# API CSharpAPI.dll, and C++ API TwsSocketClient.dll. Starting in API version **973.07**, running the API installer is designed to install an ActiveX control TWSLib.dll, and TwsRtdServer control TwsRTDServer.dll which are compatible with both 32 and 64 bit applications.

It is important to know that the TWS API is **only** available through the interactivebrokers.github.io MSI or ZIP file. Any other resource, including pip, NuGet, or any other online repository is not hosted, endorsed, supported, or connected to Interactive Brokers. As such, updates to the installation should always be downloaded from the github directly.

[TWS API Download Page](https://interactivebrokers.github.io)

### Install the TWS API on Windows

### Windows:

1.  Download the IB API for Windows to your local machine

2.  This will direct you to Interactive Brokers **API License Agreement**, please review it

3.  Once you have clicked “***I Agree*****“**, refer to the *Windows* section to download the API Software version of your preference

4.  This will download **TWS API** folder to your computer

5.  Go to your IDE and Open Terminal

6.  Navigate to the directory where the installer has been downloaded (normally it should be your C: drive or D: drive) and confirm the file is present. Now, let’s take an example: install TWS API Python
    
    ** $ ** ***cd \~/TWS API/source/pythonclient***  
    ** $**  ***python3 setup.py install***

### Install the TWS API on MacOs / Linux

### Unix/ Linux:

1.  Download the IB API for Mac/Unix zip file to your local machine
2.  This will direct you to Interactive Brokers **API License Agreement**, please review it
3.  Once you have clicked “***I Agree*****“**, refer to the *Mac / Unix* section to download the API Software version of your preference  
    ![Highlights the TWS API versions for Mac/Unix. ](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMSIgaGVpZ2h0PSIxIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjwvc3ZnPg==)

<!-- end list -->

4.  This will download **twsapi\_macunix.\<Major Version\>.\<Minor Version\>.zip** to your computer  
    *(where \<Major Version\> and \<Minor Version\> are the major and minor version numbers respectively)*

5.  Open Terminal (**Ctrl+Alt+T** on most distributions)

6.  Navigate to the directory where the installer has been downloaded (normally it should be the Download folder within your home folder) and confirm the file is present
    
    ** $ ***** cd \~/Downloads***  
    ** $** *** ls***

<!-- end list -->

7.  Unzip the contents the installer into your home folder with the following command *(if prompted, enter your password):  
    ***NOTE: **replace the values ‘n.m’ with the name of your installed file.  
    **$*  sudo unzip twsapi\_macunix.n.m.zip -d $HOME/  
    ![Highlights the zip file name in command prompt.](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMSIgaGVpZ2h0PSIxIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjwvc3ZnPg==)  
    ***
8.  To access the sample and source files, navigate to the **IBJts** directory and confirm the subfolders samples and source are present*  
    ***$*  cd \~/IBJts  
    *$*  ls***

Note:

  - When running “***python3 setup.py install***“,  you may get “***ModuleNotFoundError: No Module named ‘setuptools’***“. As “**setuptools**” is deprecated, please grant the write permission on the target folder (e.g. **source/pythonclient**) using “***sudo chmod -R 777***” in order to avoid “***error: could not create ‘ibapi.egg-info’: Permission denied***“. After that, run “***python3 -m pip install .***“

### MacOS:

1.  Download the IB API for Mac/Unix zip file to your local machine
2.  This will direct you to Interactive Brokers **API License Agreement**, please review it
3.  Once you have clicked “***I Agree*****“**, refer to the *Mac / Unix* section to download the API Software version of your preference  
    ![Highlights the TWS API versions for Mac/Unix.](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMSIgaGVpZ2h0PSIxIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjwvc3ZnPg==)
4.  This will download **twsapi\_macunix.\<Major Version\>.\<Minor Version\>.zip** to your computer  
    *(where \<Major Version\> and \<Minor Version\> are the major and minor version numbers respectively)*
5.  Open MacOS Terminal (***Command+Space** to launch Spotlight, then type **terminal** and press **Return**)*
6.  Go to find the zipped TWS API file and Copy the zipped TWS API file path.
7.  Run the following command in MacOS Terminal.
      - **$ unzip** **twsapi\_macunix.\<Major Version\>.\<Minor Version\>.zip**

Note: On MacOS, if you directly open the **twsapi\_macunix.\<Major Version\>.\<Minor Version\>.zip** file, you will get an error: “**Unable to expand…… It is an unsupported format**“. It is required for users to unzip the zipped TWS API file using the above MacOS Terminal command.

### TWS API File Location & Tools

#### TWS API Folder Files Explanation:

  - **“API\_VersionNum.txt”**

**File Path:** \~\\TWS API\\API\_VersionNum.txt 

You can check your API version in this file.

  - **“IBSampleApp.exe”**

**File Path:** \~\\TWS API\\samples\\CSharp\\IBSampleApp\\bin\\Release\\IBSampleApp.exe

You can manually use the IBSampleApp to test the API functions.

  - **“ApiDemo.jar”**

**File Path:** \~\\TWS API\\samples\\Java\\ApiDemo.jar

This is built with Java. Java users can use it to quickly test the IB TWS API functions.

## TWSAPI Basics Tutorial

Many of our most common features, as well as instructions for installing and running the Trader Workstation API, are available in our TWS API Tutorial Series. The series uses Python to implement the TWS API functionality; however, the function calls are identical across languages, and will follow a similar patter regardless of language.

This tutorial covers:

  - Downloading and running the Trader Workstation and IB Gateway
  - How to install the TWS API and update the Python Interpreter
  - Requesting Live and Historical Market Data
  - Placing and Monitoring Orders
  - Reviewing Individual Account Information
  - Handling Market Scanners

[Python TWS API Tutorial](https://www.interactivebrokers.com/campus/trading-course/python-tws-api/)

## Third Party API Platforms

Third party software vendors make use of the TWS’ programming interface (API) to integrate their platforms with Interactive Broker’s. Thanks to the TWS API, well known platforms such as Ninja Trader or Multicharts can interact with the TWS to fetch market data, place orders and/or manage account and portfolio information.

**It is important to keep in mind that most third party API platforms are not compatible with all IBKR account structures**. Always check first with the software vendor before opening a specific account type or converting an IBKR account type. For instance, many third party API platforms such as NinjaTrader and TradeNavigator are **not** compatible with IBKR linked account structures, so it is highly recommended to first check with the third party vendor before linking your IBKR accounts.

An ongoing list of common [Third Party Connections](https://www.interactivebrokers.com/campus/ibkr-api-page/third-party-connections/) are available within our documentation. This resource will also link out to connection guides detailing how a user can connect with a given platform.

A non-exhaustive list of third party platforms implementing our interface can be found in our [Investor’s Marketplace](https://www.interactivebrokers.com/Universal/servlet/MarketPlace.MarketPlaceServlet). As stated in the marketplace, the vendors’ list is in no way a recommendation from Interactive Brokers. If you are interested in a given platform that is not listed, please contact the platform’s vendor directly for further information.

### Non-Standard TWS API Languages and Packages

Noted in further depth through our [Architecture](/ibkr-api-page/twsapi-doc/#architecture) section, the TWS API is built using standardized socket protocol. As a result, users may develop or access alternative third party modules and classes in place of Interactive Brokers default modules through the [TWS API Download](/ibkr-api-page/twsapi-doc/#find-the-api). While the API is adaptable for client implementations, please understand that **Interactive Brokers API Support cannot provide support for non-standard implementations.** While we can review your [API logs](/ibkr-api-page/twsapi-doc/#api-logs) to affirm what content is being submitted, any further assistance will need to take place with the module’s original developer.

*This is neither an endorsement or admonishment of third party implementations. Interactive Brokers will always advise clients use our direct TWS API implementation whenever possible.*

### ib\_insync and ib\_async

While Interactive Brokers’ API Support is aware of the ib\_insync package, we [cannot provide coding assistance](/campus/ibkr-api-page/twsapi-doc/#troubleshooting) for the package.

With that in mind, users should be aware that the original ib\_insync package is built using a legacy release of the TWS API and is no longer updated. Users who wish to implement the ib\_insync structure using supported releases of the Trader Workstation should migrate to the [ib\_async package](https://pypi.org/project/ib_async/), which is a modernized implementation of the package by one of its original developers.

*This is neither an endorsement or admonishment of either the ib\_insync or ib\_async library. Interactive Brokers will always advise clients use our direct TWS API implementation whenever possible.*

## Unique Configurations

While all of the available Trader Workstation API default samples provide equivalent functionality, some languages have unique configurations that must be implemented in order to use our samples or program code with the underlying API.

### Implementing the Intel Decimal Library for MacOS and Linux

Due to the malleability of the many Linux distributions including MacOS, Interactive Brokers is unable to provide a pre-built binary for the library. As such, users programming in C++ on a Linux machine must manually build the Intel® Decimal Floating-Point Math Library manually.

As described in the README file from the linked page, you can find the library’s build steps within the \~/IntelRDFPMathLib20U2/LIBRARY/README file.

[Download the Intel® Decimal Floating-Point Math Library](https://www.intel.com/content/www/us/en/developer/articles/tool/intel-decimal-floating-point-math-library.html)

### Updating The Python Interpreter

Python has a unique system for importing libraries into it’s IDEs. This extends even further when it comes to virtual environments. In order to utilize Python code with the TWS API, you must run our setup file in order to import the code.

### 1\. Open Command Prompt or Terminal

In order to update the Python IDE, these steps MUST be performed through Command Prompt or Terminal. This can not be done through an explorer interface.

As such, users should begin by launching their respective command line interface.

These samples will display Windows commands, though the procedure is identical on Windows, MacOS, and Linux.

### 2\. Navigate to Python Source

Customers should then change their directory to  `{TWS API}\source\pythonclient` .

It is then recommend to display the contents of the directory with “ls” for Unix, or “dir” for Windows users.

### 3\. Run The setup.py File

Customers will now need to run the setup.py steps with the installation parameter. This can be done with the command: `python setup.py install`

### 4\. Confirm Updates

After running the prior command, users should see a large block of text describing various values being updated and added to their system. It is important to confirm that the version installed on your system mirrors the build version displayed. This example represents 10.25; however, you may have a different version.

### 5\. Confirm your installation

Finally, users should look to confirm their installation. The simplest way to do this is to confirm their version with pip. Typing this command should show the latest installed version on your system: `python -m pip show ibapi`

### Protobuf UserWarning messages

After resolving the reference errors, using the TWSAPI may print a UserWarning upon connection. These warnings are predominantly cosmetic and can be ignored. These issues are caused by the Pypi release of protobuf running version 6.30.1 and above, while the TWS API is built with 5.29.3. The warning is simply notifying users that their version is 1 major version different. However, given protobuf is currently backgwards compatible, this should not present any issues with the implementation. Developers uncomfortable with the warning messages have a few options:

1.  [Recompile Protobuf](https://protobuf.dev/getting-started/pythontutorial/) against their [Github 5.29.3 version](https://github.com/protocolbuffers/protobuf/tree/v5.29.3) to maintain parity with the TWS API implementations.
2.  Users can also modify the code source, linked by the protobuf warning, and simply remove lines 94 and on from the runtime\_version.py file.

### Implementing Visual Basic .NET

Our VB.NET code is provided for demonstration purposes only; there is no pure, standalone VB.NET-based TWS API library. Both our “VB\_API\_Sample” and the VB.NET “Testbed” projects included with our TWS API releases call the C\# TWS API source. The provided VB.NET code only interfaces with the C\# source. Please keep in mind that these samples are in VB.NET, not Visual Basic for Applications.

## Troubleshooting & Support

If there are remaining questions about available API functionality after reviewing the content of this documentation, the API Support group is available to help.

\-\> It is important to keep in mind that IB **cannot provide programming assistance** or give suggestions on how to code custom applications. The API group can review log files which contain a record of communications between API applications and TWS, and give details about what the API can provide.

General suggestions on starting out with the IB system:

  - **Become familiar with the analogous functionality in TWS before using the API**: the TWS API is nothing but a communication channel between your client application and TWS. Each API function has a corresponding tool in TWS. For instance, the market data tick types in the API correspond to watchlist columns in TWS. Any order which can be created in the API can first be created in TWS, and it is recommended to do so. Additionally, if information is not available in TWS, it will not be available in the API. Before using IB Gateway with the API, it is recommended to first become familiar with TWS.
  - **Make use of the sample API applications**: the sample applications distributed with the API download have examples of essentially every API function in each of the available programming languages. If an issue does not occur in the corresponding sample application, that implies there is a problem with the custom implementation.
  - **Upgrade TWS or IB Gateway periodically**: TWS and IB Gateway often have new software releases that have enhancements, and that can sometimes have bug fixes. Because of this, we strongly recommend our users to keep their software as up to date as possible. If you are experiencing a specific problem that is occurring in TWS or IB Gateway and not in the API program, it is likely resolved in the more recent software build.

### Log Files

Log files are used by developers and support to unambiguously understand the behavior of a request.

These files are stored on the clients machine and are only sent to Interactive Brokers by client request.

These logs will recycle every 7 days. This would include the current day and the prior 6 days.

### API Logs

TWS and IB Gateway can be configured to create a separate log file which has a record of just communications with API applications. This log is not enabled by default; but needs to be enabled by the Global Configuration setting **“Create API Message Log File”**(picture below).

  - API logs contain a record of exchanged messages between API applications and TWS/IB Gateway. Since only API messages are recorded, the API logs are more compact and easier to handle. However they do not contain general diagnostic information about TWS/IBG as the TWS/IBG logs. The TWS/IBG settings folder is by default **C:\\Jts** (or IBJts on Mac/Linux). The API logs are named **api.\[clientId\].\[day\].log**, where \[clientId\] corresponds to the Id the client application used to connect to the TWS and \[day\] to the week day (i.e. api.123.Thu.log).
  - There is also a setting “Include Market Data in API Log” that will include streaming market data values in the API log file. Historical candlestick data is always recorded in the API log.

**Note:** Both the API and TWS logs are encrypted locally. The API logs can be decrypted for review from the associated TWS or IB Gateway session, just like the TWS logs, as shown in the section describing the Local location of logs.

**Note:** The TWS/IB Gateway log file setting has to be set to ‘Detail’ level before an issue occurs so that information recorded correctly when it manifests. However due to the high amount of information that will be generated under this level, the resulting logs can grow considerably in size.  
 

**Enabling creation of API logs**

TWS:

1.  Navigate to File/Edit → Global Configuration → API → Settings
2.  Check the box *Create API message log file*
3.  Set *Logging Level* to *Detail*
4.  Click Apply and Ok

IB Gateway:

1.  Navigate to Configure → Settings → API → Settings
2.  Check the box *Create API message log file*
3.  Set *Logging Level* to *Detail*
4.  Click Apply and Ok

### How To Enable Debug Logging

Enabling DEBUG-level logging for the host platform (TWS or IBG, this does not affect API logs):

1.  Navigate to the root TWS/IBG installation directory
2.  Find jts.ini and open in text editor
3.  Put debug=1 under the \[Communication\] section
4.  Reboot TWS/IBG

Setting debug=1 has added benefits in TWS.

1.  Debug=1 also allows you to enter conIds into a watchlist to resolve them into symbols. Type/paste the conId in an empty watchlist row, add |C (vertical bar, capital C) at the end, and press Enter. Example: 265598|C will resolve immediately to AAPL (exchange will be SMART where available, primary otherwise).
      - If the instrument is already present in the watchlist, nothing will happen.
2.  Additional detail in the “Description” window for an instrument, normally available by right-clicking on an instrument in a watchlist and selecting Financial Instrument Info \>\> Description from the context menu. Debug=1 will add the conId, min order sizes, market rules (i.e., min price increments and thresholds), all available order types, and all available exchanges to this interface. Changing the behavior of TWS to bring up that Description window on double-click can make it easier to find.
    1.  In TWS, go to Global Configuration \>\> Display \>\> Ticker Row
    2.  Change “Double-click on Financial Instrument will” dropdown menu to “Open Contract Details”

### Location of Interactive Brokers Logs

Logs are stored in the TWS settings directory, C:\\Jts\\ and then your user subdirectory by default on a Windows computer (the default can be configured differently on the login screen).

The path to the log file directory can be found from a TWS or IB Gateway session by using the combination **Ctrl-Alt-U**. This will reveal path such as C:\\Jts\\detcfsvirl\\ (on Windows).

Due to privacy regulations, logs are **encrypted** before they are saved to disk. To review them on your machine, you may need to [Export Your Logs](https://www.interactivebrokers.com/campus/ibkr-api-page/twsapi-doc/#export-logs) from the associated TWS or IB Gateway session.

### How To Delete Logs

In some instances, your logs may be too large to export or upload for Client Services to review. In scenarios such as this, the Support team may request that you delete your existing API logs, and then replicate the error before attempting to upload them again.

To delete your logs:

1.  [Locate your Logs](https://www.interactivebrokers.com/campus/ibkr-api-page/twsapi-doc/#log-location).
2.  Exit TWS or IB Gateway session by clicking “File” and “Exit”.
3.  In your terminal or window explorer, navigate to your user subdirectory.
4.  Once in the directory, select the files labeled like “api.0.20250110.105733.ibgzenc”, “tws.20250110.105733.ibgzenc” or “ibgateway.20250110.105733.ibgzenc” and press the “Delete” key on your keyboard, or type ‘del {filename}’ into your terminal.

### Uploading Logs

If API logging has been enabled with the setting “Create API Message Log” during the time when an issue occurs, it can be uploaded to the API group.

**Important:** Please be aware that the process of uploading logs does not notify support, nor is a ticket logged. You will need to contact our representatives through a direct call, chat, or secure message center message for our representatives to be aware of the upload.

To upload logs as a Windows user:

1.  In TWS or IB Gateway, press CTRL+ALT+H to bring up the Upload Diagnostics window.
2.  In the “reason” text field, please type the reason for your upload.
      - Alternatively, type “ATTENTION: ” and then the ticket number you are working with, or the name of your customer service representative.
3.  Find the small arrow in the upper right corner, click it and select “Advanced View”
4.  Make sure “Full internal state of the application” is checked
5.  Make sure “Include previous days logs and settings” is unchecked, unless the error happened on a prior day.
6.  Click Submit

To upload logs as a Mac and Linux user:

1.  In TWS or IB Gateway, press CMD+OPT+H to bring up the Upload Diagnostics window.
2.  In the “reason” text field, please type the reason for your upload.
      - Alternatively, type “ATTENTION: ” and then the ticket number you are working with, or the name of your customer service representative.
3.  Find the small arrow in the upper right corner, click it and select “Advanced View”
4.  Make sure “Full internal state of the application” is checked
5.  Make sure “Include previous days logs and settings” is unchecked, unless the error happened on a prior day.
6.  Click Submit

If logs have been uploaded, please let the API Support group know by **creating a webticket** in the Message Center in Account Management (under Support) indicating the **username** of the associated TWS session. In some cases a TWS log may also be requested at the Detailed logging level. The TWS log can grow quite large and may not be uploadable by the automatic method; in this case an alternative means of upload can be found.

### Exporting Logs

1.  In TWS, navigate to Help menu \>\> Troubleshooting \>\> Diagnostics \>\> “API Logs” or “TWS Logs”.
2.  In IBG, both “API Logs” and “Gateway Logs” are accessible directly from the File menu.
3.  Click “Export Today Logs…” to decrypt the logs and save them in plaintext (logs are stored encrypted on your local machine)

### Reading Exported Logs

Each supported API language of the API contains a message file that translates a given number identifier into their corresponding request. The message identifier numbers used in the underlying wire protocol is the core of the TWS API.

The information on the right documents where each message reader file is located. The {TWS API} listed is the path to the primary TWS API or JTS folder created from the API installation.

By default, this will be saved directly on the C: drive.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

Both the Incoming and Outgoing message IDs are listed in one file.

{TWS API}\\source\\pythonclient\\ibapi\\messages.py

Incoming Message IDs:  
{TWS API}\\source\\JavaClient\\com\\ib\\client\\EDecoder.java

Outgoing Message IDs:  
{TWS API}\\source\\JavaClient\\com\\ib\\client\\EClient.java

Incoming Message IDs:  
{TWS API}\\source\\CppClient\\client\\EDecoder.h

Outgoing Message IDs:  
{TWS API}\\source\\CppClient\\client\\EClient.h

Incoming Message IDs:  
{TWS API}\\source\\CSharpClient\\client\\IncomingMessage.cs

Outgoing Message IDs:  
{TWS API}\\source\\CSharpClient\\client\\OutgoingMessages.cs

Depending on the Excel structure used, either C\# or Java file path will be used.

For ActiveX and RTD, see C\#

For DDE, see Java.

In our API logs, the direction of the message is indicated by the arrow at the beginning:

**-\>** for incoming messages (TWS to client)

**\<-** for outgoing messages (client to TWS)

Thus  **\<- 3** (outgoing request of type 3) is a placeOrder request, and the subsequent incoming requests are:

**-\> 5 **= openOrder response

**-\> 11 **= executionData response

**-\> 59 **= commissionReport response

Also note that the first openOrder response carries with it an orderStatus response in the same message. If that status were to change later, it would be delivered as a standalone message:

**-\> 3 **= orderStatus response

### Unset Values

Developers may often find a super-massive value returned from requests like market data, P\&L information, and elsewhere. These are known as Unset values. Unset values are used throughout programming systems to indicate that a value is not available. Unset values are used in place of NULL characters to prevent any unexpected error be thrown in your code. Unset values are also used in place of values like 0 to avoid confusing viewers to believe they have an account balance of 0, or that an equity is worth $0.

An unset value is the maximum value of a given data type. So the Unset Double value will appear like 1.7976931348623157E308, which contains approximately 308 digits to intentionally appear extraneous.

## Architecture

The TWS API is a BSD implementation that communicates request and response values across TCP socket using a end-line-delimited message protocol. While the underlying structure of the message will vary by request, requests typically follow a patter of indicating a message identifier, request identifier, and then directly relevant content for the request such as contract details or market data parameters.

The provided TWS API package use two distinct classes to accommodate the request / response functionality of the socket protocol, EClient and EWrapper respectively.

The EWrapper class is used to receive all messages from the host and distribute them amongst the affiliated response functions. The EReader class will retrieve the messages from the socket connection and decode them for distribution by the EWrapper class.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
class TestWrapper(wrapper.EWrapper):
```

``` EnlighterJSRAW
public class EWrapperImpl implements EWrapper {
```

``` EnlighterJSRAW
class TestCppClient : public EWrapper
    {
```

``` EnlighterJSRAW
public class EWrapperImpl : EWrapper 
   {
```

``` EnlighterJSRAW
Public Class EWrapperImpl
    Implements EWrapper
```

EClient or EClientSocket is used to send requests to the Trader Workstation. This client class contains all the available methods to communicate with the host. Up to 32 clients can be connected to a single instance of the host Trader Workstation or IB Gateway simultaneously.

The primary distinction in EClient and EClientSocket is the involvement of the EReader Class to trigger when requests should be processed. EClient is unique to the Python implementation and utilizes the Python Queue module in place of the EReaderSignal directly. Both the EReaderSignal and Python Queue module handle the queueing process for submitting messages across the socket connection. In either scenario, the EWrapper class must be implemented first to acknowledge the EClient requests.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
class TestClient(EClient):
     def __init__(self, wrapper):
         EClient.__init__(self, wrapper)
...
class TestApp(TestWrapper, TestClient):
    def __init__(self):
    TestWrapper.__init__(self)
         TestClient.__init__(self, wrapper=self)
```

**Note**: The EReaderSignal class is not used for Python API. The Python Queue module is used for inter-thread communication and data exchange.

``` EnlighterJSRAW
private EReaderSignal readerSignal;
private EClientSocket clientSocket;
protected int currentOrderId = -1;
```

…

``` EnlighterJSRAW
public EWrapperImpl() {
    readerSignal = new EJavaSignal();
    clientSocket = new EClientSocket(this, readerSignal);
}
```

``` EnlighterJSRAW
EReaderOSSignal m_osSignal;
    EClientSocket * const m_pClient;
```

…

``` EnlighterJSRAW
TestCppClient::TestCppClient() :
      m_osSignal(2000)//2-seconds timeout
    , m_pClient(new EClientSocket(this, &m_osSignal))
    , m_state(ST_CONNECT)
    , m_sleepDeadline(0)
    , m_orderId(0)
    , m_extraAuth(false)
{
}
```

``` EnlighterJSRAW
EClientSocket clientSocket;
public readonly EReaderSignal Signal;
```

…

``` EnlighterJSRAW
public EWrapperImpl()
{
    Signal = new EReaderMonitorSignal();
    clientSocket = new EClientSocket(this, Signal);
}
```

``` EnlighterJSRAW
Public eReaderSignal As EReaderSignal
Public socketClient As EClientSocket
```

…

``` EnlighterJSRAW
Sub New()
    eReaderSignal = New EReaderMonitorSignal
    socketClient = New EClientSocket(Me, eReaderSignal)
End Sub
```

### The Trader Workstation

Our market maker-designed IBKR Trader Workstation (TWS) lets traders, investors, and institutions trade stocks, options, futures, forex, bonds, and funds on over 100 markets worldwide from a single account. The TWS API is a programming interface to TWS, and as such, for an application to connect to the API there must first be a running instance of TWS or IB Gateway.

### The IB Gateway

As an alternative to TWS for API users, IBKR also offers IB Gateway (IBGW). From the perspective of an API application, IB Gateway and TWS are identical; both represent a server to which an API client application can open a socket connection after the user has authenticated. With either application (TWS or IBGW), the user must manually enter their username and password into a login window. For security reasons, a headless session of TWS or IBGW without a GUI is not supported. From the user’s perspective, IB Gateway may be advantageous because it is a lighter application which consumes about 40% fewer resources.

Both TWS and IBGW were designed to be restarted daily. This is necessary to perform functions such as re-downloading contract definitions in cases where contracts have been changed or new contracts have been added. Beginning in version 974+ both applications offer an autorestart feature that allows the application to restart daily without user intervention. With this option enabled, TWS or IBGW can potentially run from Sunday to Sunday without re-authenticating. After the nightly server reset on Saturday night it will be necessary to again enter security credentials.

The advantages of TWS over IBGW is that it provides the end user with many tools (Risk Navigator, OptionTrader, BookTrader, etc) and a graphical user interface which can be used to monitor an account or place orders. For beginning API users, it is recommended to first become acquainted with TWS before using IBGW.

**For simplicity, this guide will mostly refer to the TWS although the reader should understand that for the TWS API’s purposes, TWS and IB Gateway are synonymous.**

## Pacing Limitations

Pacing Limitations with regards to the TWS API are based on the number of requests submitted by a client connection. A “request” is a user-submitted query to retrieve some form of data.

An example of a request is a query to retrieve [live watchlist data](https://www.interactivebrokers.com/campus/ibkr-api-page/twsapi-doc/#watchlist-data). While you may make a single request for market data, you will receive market data until the subscription is cancelled or your session is disconnected. Only the original request to begin the flow of data will contribute to the pacing limitation.

The maximum number of API requests that can be submitted are equivalent to your [Maximum Market Data Lines](https://www.interactivebrokers.com/campus/ibkr-api-page/market-data-subscriptions/#costs-and-fees) divided by 2, per second.

By default, all users maintain 100 market data lines. Therefore, users have a pacing limitation of (100/2)= **50 requests per second**.

Clients that have increased their market data lines to 200, by way of commission or [Quote Booster Subscription](https://www.interactivebrokers.com/campus/ibkr-api-page/market-data-subscriptions/#quote-max), would receive (200/2)= 100 requests per second, and this would increment as your market data lines increase or decrease.

In some use cases, if you plan to send more than 50 requests per second, some orders may be queued and delayed. For this scenario, please consider switching to FIX API.

For FIX API users in IB Gateway, the limitation is 250 messages per second.

For FIX API users without using IB Gateway or TWS, there is no limitation on messages per second, but less is better.

### Pacing Behavior

The TWS API supports two formats for users who break the pacing limitations. This behavior is set in the Global Configuration of Trader Workstation or IB Gateway. Under “API” and then “Settings” users will see a setting for “Reject messages above maximum allowed message rate vs applying pacing.”

1.  If the setting is checked, TWS will notify the user they surpassed the pacing limit using error code 100. If the pacing limits are broken 3 times, the API session will terminate and the user will receive WinError 10053 on Windows or a BrokenPipe error on MacOS or Linux machines.
2.  If the setting is unchecked, TWS will automatically pace the requests submitted by the user. The system will wait to acknowledge requests in the EReader Thread prior to moving on to new requests.

## Connectivity

A socket connection between the API client application and TWS is established with the IBApi.EClientSocket.eConnect function. TWS acts as a server to receive requests from the API application (the client) and responds by taking appropriate actions. The first step is for the API client to initiate a connection to TWS on a socket port where TWS is already listening. It is possible to have multiple TWS instances running on the same computer if each is configured with a different API socket port number. Also, each TWS session can receive up to 32 different client applications simultaneously. The client ID field specified in the API connection is used to distinguish different API clients.

### Establishing an API connection

Once our two main objects have been created, EWrapper and ESocketClient, the client application can connect via the IBApi.EClientSocket object:

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
app.connect("127.0.0.1", args.port, clientId=0)
```

``` EnlighterJSRAW
m_client.eConnect("127.0.0.1", 7497, 2);
```

``` EnlighterJSRAW
bool bRes = m_pClient->eConnect( host, port, clientId, m_extraAuth);
```

``` EnlighterJSRAW
clientSocket.eConnect("127.0.0.1", 7497, 0);
```

``` EnlighterJSRAW
socketClient.eConnect("127.0.0.1", 7497, 0)
```

eConnect starts by requesting from the operating system that a TCP socket be opened to the specified IP address and socket port. If the socket cannot be opened, the operating system (not TWS) returns an error which is received by the API client as error code 502 to IBApi.EWrapper.error (Note: since this error is not generated by TWS it is not captured in TWS log files). Most commonly error 502 will indicate that TWS is not running with the API enabled, or it is listening for connections on a different socket port. If connecting across a network, the error can also occur if there is a firewall or antivirus program blocking connections, or if the router’s IP address is not listed in the “Trusted IPs” in TWS.

After the socket has been opened, there must be an initial handshake in which information is exchanged about the supported version of the TWS and API to ensure each platform can interpret received messages correctly.

  - For this reason it is important that the main EReader object is not created until after a connection has been established. The initial connection results in a negotiated common version between TWS and the API client which will be needed by the EReader thread in interpreting subsequent messages.

After the highest version number which can be used for communication is established, TWS will return certain pieces of data that correspond specifically to the logged-in TWS user’s session. This includes (1) the account number(s) accessible in this TWS session, (2) the next valid order identifier (ID), and (3) the time of connection. In the most common mode of operation the EClient.AsyncEConnect field is set to false and the initial handshake is taken to completion immediately after the socket connection is established. TWS will then immediately provides the API client with this information.

  - Important: The **IBApi.EWrapper.nextValidID** callback is commonly used to indicate that the connection is completed and other messages can be sent from the API client to TWS. There is the possibility that function calls made prior to this time could be dropped by TWS.

There is an alternative, deprecated mode of connection used in special cases in which the variable AsyncEconnect is set to true, and the call to startAPI is only called from the connectAck() function. All IB samples use the mode AsyncEconnect = False.

The ConnectAck function is called automatically once a connection has been established with the Trader Workstation or IB Gateway.

  - Python
  - Java
  - C++
  - C\#

<!-- end list -->

``` EnlighterJSRAW
def connectAck(self):
    print("API Connection Established.")
```

``` EnlighterJSRAW
public void connectAck(){
    System.out.println("API Connection Established.");
}
```

``` EnlighterJSRAW
void TestCppClient::connectAck()
{
    printf("API Connection Established.");
}
```

``` EnlighterJSRAW
public void connectAck()
{
    Console.WriteLine("API Connection Established.");
}
```

### Verify API Connection

A user can verify whether their API session is connected at any point with the EClient.isConnected() function.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
print(app.isConnected())
```

``` EnlighterJSRAW
System.out.println(m_client.isConnected());
```

``` EnlighterJSRAW
printf(m_pClient->isConnected());
```

``` EnlighterJSRAW
Console.WriteLine(clientSocket.isConnected());
```

``` EnlighterJSRAW
socketClient.eConnect("127.0.0.1", 7497, 0)
```

eConnect starts by requesting from the operating system that a TCP socket be opened to the specified IP address and socket port. If the socket cannot be opened, the operating system (not TWS) returns an error which is received by the API client as error code 502 to IBApi.EWrapper.error (Note: since this error is not generated by TWS it is not captured in TWS log files). Most commonly error 502 will indicate that TWS is not running with the API enabled, or it is listening for connections on a different socket port. If connecting across a network, the error can also occur if there is a firewall or antivirus program blocking connections, or if the router’s IP address is not listed in the “Trusted IPs” in TWS.

After the socket has been opened, there must be an initial handshake in which information is exchanged about the supported version of the TWS and API to ensure each platform can interpret received messages correctly.

  - For this reason it is important that the main EReader object is not created until after a connection has been established. The initial connection results in a negotiated common version between TWS and the API client which will be needed by the EReader thread in interpreting subsequent messages.

After the highest version number which can be used for communication is established, TWS will return certain pieces of data that correspond specifically to the logged-in TWS user’s session. This includes (1) the account number(s) accessible in this TWS session, (2) the next valid order identifier (ID), and (3) the time of connection. In the most common mode of operation the EClient.AsyncEConnect field is set to false and the initial handshake is taken to completion immediately after the socket connection is established. TWS will then immediately provides the API client with this information.

  - Important: The **IBApi.EWrapper.nextValidID** callback is commonly used to indicate that the connection is completed and other messages can be sent from the API client to TWS. There is the possibility that function calls made prior to this time could be dropped by TWS.

There is an alternative, deprecated mode of connection used in special cases in which the variable AsyncEconnect is set to true, and the call to startAPI is only called from the connectAck() function. All IB samples use the mode AsyncEconnect = False.

### The EReader Thread

API programs always have at least two threads of execution. One thread is used for sending messages to TWS, and another thread is used for reading returned messages. The second thread uses the API EReader class to read from the socket and add messages to a queue. Everytime a new message is added to the message queue, a notification flag is triggered to let other threads know that there is a message waiting to be processed. In the two-thread design of an API program, the message queue is also processed by the first thread. In a three-thread design, an additional thread is created to perform this task. The thread responsible for the message queue will decode messages and invoke the appropriate functions in EWrapper. The two-threaded design is used in the IB Python sample Program.py and the C++ sample TestCppClient, while the ‘Testbed’ samples in the other languages use a three-threaded design. Commonly in a Python asynchronous network application, the asyncio module will be used to create a more sequential looking code design.

The class which has functionality for reading and parsing raw messages from TWS is the IBApi.EReader class.

### C++, C\#, and Java Implementations

For C\#, Java, C++, and Visual Basic, we instead maintain a triple thread structure which requires the creation of a reader thread, a queue thread, and then a wrapper thread. The documentation listed here further elaborates on the structure for those languages.

  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
final EReader reader = new EReader(m_client, m_signal); 

reader.start();
//An additional thread is created in this program design to empty the messaging queue
new Thread(() -> {
    while (m_client.isConnected()) {
        m_signal.waitForSignal();
        try {
             reader.processMsgs();
        } catch (Exception e) {
            System.out.println("Exception: "+e.getMessage());
        }
    }
}).start();
```

``` EnlighterJSRAW
m_pReader = std::unique_ptr<EReader>( new EReader(m_pClient, &m_osSignal) );
m_pReader->start();
```

``` EnlighterJSRAW
//Create a reader to consume messages from the TWS. The EReader will consume the incoming messages and put them in a queue
var reader = new EReader(clientSocket, readerSignal);
reader.Start();
//Once the messages are in the queue, an additional thread can be created to fetch them
new Thread(() => { while (clientSocket.IsConnected()) { readerSignal.waitForSignal(); reader.processMsgs(); } }) { IsBackground = true }.Start();
```

``` EnlighterJSRAW
'Once the messages are in the queue, an additional thread need to fetch them
Dim msgThread As Thread = New Thread(AddressOf messageProcessing)
msgThread.IsBackground = True
If (wrapperImpl.serverVersion() > 0) Then Call msgThread.Start()
```

``` EnlighterJSRAW
Private Sub messageProcessing()
    Dim reader As EReader = New EReader(wrapperImpl.socketClient, wrapperImpl.eReaderSignal)
    reader.Start()
    While (wrapperImpl.socketClient.IsConnected)
        wrapperImpl.eReaderSignal.waitForSignal()
        reader.processMsgs()
    End While
End Sub
```

Now it is time to revisit the role of IBApi.EReaderSignal initially introduced in The EClientSocket Class. As mentioned in the previous paragraph, after the EReader thread places a message in the queue, a notification is issued to make known that a message is ready for processing. In the (C++, C\#/.NET, Java) APIs, this is done via the IBApi.EReaderSignal object we initiated within the IBApi.EWrapper’s implementer.

### Python Implementation

In Python IB API, the EReader logic is handled in the EClient.connect so the EReader thread is automatically started upon connection. There is **no need** for user to start the reader.

Once the client is connected, a reader thread will be automatically created to handle incoming messages and put the messages into a message queue for further process. User **is required** to trigger Client::run() below, where the message queue is processed in an infinite loop and the EWrapper call-back functions are automatically triggered.

Now it is time to revisit the role of IBApi.EReaderSignal initially introduced in The EClientSocket Class. As mentioned in the previous paragraph, after the EReader thread places a message in the queue, a notification is issued to make known that a message is ready for processing. In the Python API, this is handled automatically by the Queue class.

### Remote TWS API Connections with Trader Workstation

If you want to connect TWS/ IB Gateway from a remote server, uncheck the “Allow connection from localhost only” setting. Under the “Trusted IPs” section, click “Create” and enter the IP Address detected in “Accept incoming connection attempt from \<IP Address\>” into “Trusted IPs”.

“Trusted IPs” does not accept subnet (e.g. /27, /28). It only accepts single IP Addresses. In the following example, there is a remote computing cluster /27 which has 32 IP Addresses and the remote computing cluster will randomly assign one of the computing nodes to connect to TWS in every connection.  To make this happen, every Private IPv4 Address of the subnet are put into the “Trusted IPs” (You can also exclude the first IP Network Address and the last IP Broadcast Address of the subnet).

### Accepting an API connection from TWS

For security reasons, by default the API is not configured to automatically accept connection requests from API applications. After a connection attempt, a dialogue will appear in TWS asking the user to manually confirm that a connection can be made:

Untrusted IPs attempting to make a connection will be denied without prompting.

To prevent the TWS from asking the end user to accept the connection, it is possible to configure it to automatically accept the connection from a trusted IP address and/or the local machine. This can easily be done via the TWS API settings:

### Logging into multiple applications

It is not possible to login to multiple trading applications simultaneously with the same username. However, it is possible to create additional usernames for an account that can be used in different trading applications simultaneously, as long as there is not more than a single trading application logged in with a given username at a time. There are some additional cases in which it is also useful to create additional usernames:

  - If TWS or IBGW is logged in with a username that is used to login to Client Portal during that session, that application will not be able to automatically reconnect to the server after the next disconnection (such as the server reset).
  - A TWS or IBGW session logged into a paper trading account will not to receive market data if it is sharing data from a live user which is used to login to Client Portal.

If a different username is utilized to login to Client Portal in either of these cases, then it will not affect the TWS/IBGW session.

[How to add additional usernames in Account Management](https://www.ibkrguides.com/clientportal/uar/addingauser.htm)

  - It is important to note that market data subscriptions are setup independently for each live username.

### Broken API socket connection

If there is a problem with the socket connection between TWS and the API client, for instance if TWS suddenly closes, this will trigger an exception in the EReader thread which is reading from the socket. This exception will also occur if an API client attempts to connect with a client ID that is already in use.

The socket EOF is handled slightly differently in different API languages. For instance in Java, it is caught and sent to the client application to IBApi::EWrapper::error with errorCode 507: “Bad Message”. In C\# it is caught and sent to IBApi::EWrapper::error with errorCode -1. The client application needs to handle this error message and use it to indicate that an exception has been thrown in the socket connection.

Clients can validate a broken connection with the EWrapper.connectionClosed and EClient.isConnected functions.

Once a connection fails for any reason, the EWrapper.connectionClosed function will be called. This function can be used to build reconnection logic or affirm a system disconnect.

  - Python
  - Java
  - C++
  - C\#

<!-- end list -->

``` EnlighterJSRAW
def connectClosed(self):
    print("API Connection Lost.")
```

``` EnlighterJSRAW
public void connectClosed(){
    System.out.println("API Connection Lost.");
}
```

``` EnlighterJSRAW
void TestCppClient::connectClosed()
{
    printf("API Connection Lost.");
}
```

``` EnlighterJSRAW
public void connectClosed()
{
    Console.WriteLine("API Connection Lost.");
}
```

## Synchronous API

With the release of TWS API 10.40, Interactive Brokers has introduced the Synchronous API Wrapper class. This class provides a synchronous API structure, combining the functionality of EClient and EWrapper into a beginner-friendly interface.

The current release is still in a Beta state, slowly rolling out only a portion of what is available in the larger Trader Workstation API configuration. The interface is exclusively available through the *Python* programming language.

The content shown here is an example of what the Sync Wrapper structure looks like. A larger example of all current functionality is available in the 10.40 release of the TWS API under `{TWS API}/samples/Python/Testbed/sync_test.py` .

#### Request sample

``` EnlighterJSRAW
# Import our Sync Wrapper and Contract objects
from ibapi.sync_wrapper_alt import *
from datetime import datetime

# Instantiate the reference for our sync class
app = TWSSyncWrapper(timeout=30)

# make a connection to Trader Workstation
# In this case, we're connecting on Localhost with port 7496 and Client ID 0.
if not app.connect_and_start(host="127.0.0.1", port=7496, client_id=8675309):
    print("Failed to connect to TWS")
    exit(1)
else:
    print("Connected to TWS")
 
# Create a contract class reference.
# In our case, we'll be testing with AAPL.
contract = Contract()
contract.symbol = "AAPL"
contract.secType = "STK"
contract.exchange = "SMART"
contract.primaryExchange = "ISLAND"
contract.currency = "USD"

'''
Contract details requests will return all contracts the match the details
of our contract object in a list. Because a list is returned, we are 
taking the first (or 0 index) contract returned. 
'''
aapl_contract = app.get_contract_details(contract)[0].contract
print(aapl_contract)

market_data = app.get_market_data_snapshot(aapl_contract)

order = Order()
order.action = "BUY"
order.orderType = "LMT"
order.totalQuantity = 100
order.lmtPrice = 258

order_status = app.place_order_sync(contract, order)
oid = order_status["orderId"]

print(app.get_open_orders()[oid]['orderState'].status)

print(app.cancel_order_sync(oid, OrderCancel()))

app.disconnect_and_stop()
exit()
```

#### Response Sample

``` EnlighterJSRAW
ERROR -1 1761170335710 2104 Market data farm connection is OK:usbond
ERROR -1 1761170335711 2104 Market data farm connection is OK:usfarm.nj
ERROR -1 1761170335712 2104 Market data farm connection is OK:eufarm
ERROR -1 1761170335712 2104 Market data farm connection is OK:usfarm
ERROR -1 1761170335712 2106 HMDS data farm connection is OK:ushmds
ERROR -1 1761170335713 2158 Sec-def data farm connection is OK:secdefil
Connected to TWS
ConId: 265598, Symbol: AAPL, SecType: STK, LastTradeDateOrContractMonth: , Strike: 0, Right: , Multiplier: , Exchange: SMART, PrimaryExchange: ISLAND, Currency: USD, LocalSymbol: AAPL, TradingClass: NMS, IncludeExpired: False, SecIdType: , SecId: , Description: , IssuerId: Combo:
{'price': {1: {'price': 258.5, 'attrib': 2076793531408: CanAutoExecute: 1, PastLimit: 0, PreOpen: 0}, 2: {'price': 258.65, 'attrib': 2076793531536: CanAutoExecute: 1, PastLimit: 0, PreOpen: 0}, 4: {'price': 258.62, 'attrib': 2076793531600: CanAutoExecute: 0, PastLimit: 0, PreOpen: 0}, 6: {'price': 262.85, 'attrib': 2076793531856: CanAutoExecute: 0, PastLimit: 0, PreOpen: 0}, 7: {'price': 255.43, 'attrib': 2076793531920: CanAutoExecute: 0, PastLimit: 0, PreOpen: 0}, 9: {'price': 262.77, 'attrib': 2076793531984: CanAutoExecute: 0, PastLimit: 0, PreOpen: 0}, 14: {'price': 262.74, 'attrib': 2076793532048: CanAutoExecute: 0, PastLimit: 0, PreOpen: 0}}, 'size': {0: Decimal('1'), 3: Decimal('5'), 5: Decimal('3'), 8: Decimal('449348')}}
PreSubmitted
{'orderId': 358, 'status': 'PreSubmitted', 'filled': Decimal('0'), 'remaining': Decimal('100'), 'avgFillPrice': 0.0, 'permId': 1054257323, 'parentId': 0, 'lastFillPrice': 0.0, 'clientId': 8675309, 'whyHeld': '', 'mktCapPrice': 0.0}
```

### TWSSyncWrapper Class

The TWSSyncWrapper class is produced from the ibapi/sync\_wrapper file. Clients looking to utilize the class may seek to replace their typical imports for ibapi/client and ibapi/wrapper with an import for “from ibapi.sync\_wrapper import TWSSyncWrapper”.

The TWSSyncWrapper class accepts a single argument, timeout. This will provide a default timeout integer in seconds for all connected functions to work with. If no timeout is specified, a default value of 30 seconds is passed instead.

Each function supports a timeout argument for unique endpoint timeout behavior.

  - Python

<!-- end list -->

``` EnlighterJSRAW
from ibapi.sync_wrapper import TWSSyncWrapper

app = TWSSyncWrapper(timeout=30)
```

### Connect & Start Connection

After creating the class object reference with sync wrapper, connect\_and\_start() must be used to connect the Python program with the active Trader Workstation implementation. Identical to EClient’s connect() function, connect\_and\_start() supports arguments for host, port, and client\_id.

#### connect\_and\_start(

**host:** String. Determine the connecting host IP for the API to connect to. Connections on the same computer should use “localhost” or “127.0.0.1”.

**port:** Integer. Determine the connecting port number configured in the Global Configuration in the “Socket Port” field.

Defaults: {TWS Live: 7496; TWS Paper: 7497; IBG Live: 4001; IBG Paper: 4002′}

**client\_id:** Integer. Determine the connecting client ID. TWS Supports up to 32 simultaneous API connections.

Users should connect with a client\_id of 0 for [optimal order management functionality](/campus/ibkr-api-page/twsapi-doc/#master-client-id).

#### )

  - Python

<!-- end list -->

``` EnlighterJSRAW
app.connect_and_start(host="127.0.0.1", port=7496, client_id=0)
```

#### Response Object

While it is not necessary to handle the response from connect\_and\_start(), the function will return the result of EClient.isConnected() to help with connection validation.

The function call will return a single Boolean value, True or False, in reference to the connection status at the time of reference.

Developers may look to implement code such as this that will gracefully handle the connection procedure should it fail to connect rather than proceeding with the rest of the code implementation.

  - Python

<!-- end list -->

``` EnlighterJSRAW
# Connect to TWS
# If the connection succeeded, notify the user.
# If the connection fails and False is returned, notify the user and gracefully exit the application.
if not app.connect_and_start(host="127.0.0.1", port=7496, client_id=0):
    print("Failed to connect to TWS")
    exit(1)
else:
    print("Connected to TWS")
```

### Disconnect & Stop Connection

Once a connection is no longer needed, developers should disconnect the session. This will terminate all ongoing requests through the class’s client\_id. Connections through any other client ID or port will be unaffected.

#### disconnect\_and\_stop()

  - Python

<!-- end list -->

``` EnlighterJSRAW
app.disconnect_and_stop()
```

The function call does not return after calling. As a result, None is automatically passed in the event the function is referenced.

### Current Time

Whenever a user would need to verify the current time used within Trader Workstation or to verify the connection with the application, users may call the get\_current\_time() function.

#### get\_current\_time(

**timeout:** Integer. Timeout before the request disconnects. Function-specific timeout default of 1 second.

)

  - Python

<!-- end list -->

``` EnlighterJSRAW
app.get_current_time()
```

#### Response Object

get\_current\_time() will return the current timestamp as an integer representing an epoch timestamp.

``` EnlighterJSRAW
1760478515
```

### Next Valid ID

Requests should utilize an unique identifier after each request is submitted.

The same order identifier cannot be reused except to modify an existing order.

#### get\_next\_valid\_id(

**timeout:** Integer. Uses default timeout value passed to TWSSyncClass.

#### )

  - Python

<!-- end list -->

``` EnlighterJSRAW
app.get_next_valid_id()
```

#### Response Object

Requests to the get\_next\_valid\_id() function will return the next valid order ID, which may be used in order submission.

``` EnlighterJSRAW
123456789
```

### Account Summary

The get\_account\_summary() function returns all relevant account details identical to Trader Workstation’s “Account” window. Users may query to receive all available data or a narrow window based on the [Account Summary Tag](/campus/ibkr-api-page/twsapi-doc/#account-summary-tags).

#### get\_account\_summary(

**tags:** String. Account summary key value to receive data for. See [Account Summary Tags](/campus/ibkr-api-page/twsapi-doc/#account-summary-tags) for details.

**group:** String. Indicates a Financial Advisor’s allocation group to reference account details for. Non-advisor account structures should always pass “All”.

Default value passed, “All”.

**timeout:** Integer. Timeout before the request disconnects. Function-specific timeout default of 5 second.

#### )

  - Python

<!-- end list -->

``` EnlighterJSRAW
from ibapi.account_summary_tags import AccountSummaryTags

app.get_account_summary(AccountSummaryTags.AllTags, "All")
```

Total size of the request may vary depending on number of accounts held in the account, and the number of tags requested.

#### Response Object

**{AccountId}:** Dictionary. Contains all tag value pairs for the designated accountId.

{

**{Tag}:** Dictionary. Contains the value of the affiliated tag along with the relevant currency.

**value:** String. Contains the alphanumeric value affiliated with the designated tag.

**currency:** String. Returns the currency used to denote the value. May return an empty string if returning value does not contain a price.

}

``` EnlighterJSRAW
{'U1234567': {'AccountType': {'value': 'LLC', 'currency': ''}, 'Cushion': {'value': '0.993764', 'currency': ''}, 'DayTradesRemaining': {'value': '-1', 'currency': ''}, 'LookAheadNextChange': {'value': '1760558400', 'currency': ''}, 'AccruedCash': {'value': '262079.00', 'currency': 'USD'}, 'AvailableFunds': {'value': '219944453.18', 'currency': 'USD'}, 'BuyingPower': {'value': '1466299088.69', 'currency': 'USD'}, 'EquityWithLoanValue': {'value': '221042710.95', 'currency': 'USD'}, 'ExcessLiquidity': {'value': '220044618.70', 'currency': 'USD'}, 'FullAvailableFunds': {'value': '219944453.18', 'currency': 'USD'}, 'FullExcessLiquidity': {'value': '220044618.70', 'currency': 'USD'}, 'FullInitMarginReq': {'value': '1101020.27', 'currency': 'USD'}, 'FullMaintMarginReq': {'value': '1000859.00', 'currency': 'USD'}, 'GrossPositionValue': {'value': '2982965.22', 'currency': 'USD'}, 'InitMarginReq': {'value': '1101020.27', 'currency': 'USD'}, 'LookAheadAvailableFunds': {'value': '219944453.18', 'currency': 'USD'}, 'LookAheadExcessLiquidity': {'value': '220044618.70', 'currency': 'USD'}, 'LookAheadInitMarginReq': {'value': '1101020.27', 'currency': 'USD'}, 'LookAheadMaintMarginReq': {'value': '1000859.00', 'currency': 'USD'}, 'MaintMarginReq': {'value': '1000859.00', 'currency': 'USD'}, 'NetLiquidation': {'value': '221425500.56', 'currency': 'USD'}, 'PreviousDayEquityWithLoanValue': {'value': '205659145.23', 'currency': 'USD'}, 'TotalCashValue': {'value': '218181198.71', 'currency': 'USD'}}
```

### Contract Details

Interactive Brokers trading is centered around [Contract Objects](/campus/ibkr-api-page/twsapi-doc/#contract-object). This is used when submitting requests for market data, retrieving position information, and placing orders. The Synchronous Wrapper utilizes the same [Contract Object](/campus/ibkr-api-page/twsapi-doc/#contract-object) as the standard TWS API.

Passing as much known information through a Contract Details will return all contracts that match the requesting information. At a minimum, the Contract ID, or Symbol and Security Type must be passed for contract discovery.

#### get\_contract\_details(

**contract:** [Contract Object](/campus/ibkr-api-page/twsapi-doc/#contract-object). Contract details you are searching for.

**timeout:** Integer. Timeout before the request disconnects. Function-specific timeout default of 5 second.

#### )

  - Python

<!-- end list -->

``` EnlighterJSRAW
contract = Contract()
contract.symbol = "AAPL"
contract.secType = "STK"

app.get_contract_details(contract=contract)
```

#### Response Object

The get\_contract\_details() function will return a list of [Contract](/campus/ibkr-api-page/twsapi-doc/#contract-object) objects.  
Unless a relatively narrow scope is provided during the initial contract details request, multiple contract objects may be returned within the list. Please be aware that directly printing this information may result in the memory address being displayed.

``` EnlighterJSRAW
[3039334541648: ConId: 265598, Symbol: AAPL, SecType: STK, LastTradeDateOrContractMonth: , Strike: 0, Right: , Multiplier: , Exchange: SMART, PrimaryExchange: ISLAND, Currency: USD, LocalSymbol: AAPL, TradingClass: NMS, IncludeExpired: False, SecIdType: , SecId: , Description: , IssuerId: Combo:,NMS,0.01,ACTIVETIM,AD,ADDONT,ADJUST,ALERT,ALGO,ALLOC,AON,AVGCOST,BASKET,BENCHPX,CASHQTY,COND,CONDORDER,DARKONLY,DARKPOLL,DAY,DEACT,DEACTDIS,DEACTEOD,DIS,DUR,GAT,GTC,GTD,GTT,HID,IBKRATS,ICE,IMB,IOC,LIT,LMT,LOC,MIDPX,MIT,MKT,MOC,MTL,NGCOMB,NODARK,NONALGO,OCA,OPG,OPGREROUT,PEGBENCH,PEGMID,POSTATS,POSTONLY,PREOPGRTH,PRICECHK,REL,REL2MID,RELPCTOFS,RPI,RTH,SCALE,SCALEODD,SCALERST,SIZECHK,SMARTSTG,SNAPMID,SNAPMKT,SNAPREL,STP,STPLMT,SWEEP,TRAIL,TRAILLIT,TRAILLMT,TRAILMIT,WHATIF,SMART,AMEX,NYSE,CBOE,PHLX,ISE,CHX,ARCA,ISLAND,DRCTEDGE,BEX,BATS,EDGEA,BYX,IEX,EDGX,FOXRIVER,PEARL,NYSENAT,LTSE,MEMX,IBEOS,OVERNIGHT,TPLUS0,PSX,T24X,1,0,APPLE INC,,Technology,Computers,Computers,US/Eastern,20251015:0400-20251015:2000;20251016:0400-20251016:2000;20251017:0400-20251017:2000;20251018:CLOSED;20251019:CLOSED;20251020:0400-20251020:2000,20251015:0930-20251015:1600;20251016:0930-20251016:1600;20251017:0930-20251017:1600;20251018:CLOSED;20251019:CLOSED;20251020:0930-20251020:1600,,0,,,26,26,26,26,26,26,26,26,26,26,26,26,26,26,26,26,26,26,26,26,26,26,26,26,26,26,1,[3039334542544: ISIN=US0378331005;],,COMMON,,,,,,False,False,0,False,,,,,False,,0.0001,0.0001,100,None,,,, 3039334543504: ConId: 273982664,...]
```

### Live Market Data

Users may request market data using get\_market\_data\_snapshot() to retrieve available market data.  
The request currently supports [tickPrice, tickSize, tickString, tickGeneric, tickNews, and tickOptionCompution](/campus/ibkr-api-page/twsapi-doc/#receive-live-data) data.

#### get\_market\_data\_snapshot(

**contract:** [Contract Object](/campus/ibkr-api-page/twsapi-doc/#contract-object). Contract to retrieve market data for.

**generic\_tick\_list:** String. String containing comma-separate values to determine addition data to retrieve.

Default: Automatically sends an empty string, returning only the basic data such as Last, Bid, and Ask. See [Available Tick Types](/campus/ibkr-api-page/twsapi-doc/#available-tick-types) for more details.

**snapshot:** Boolean. Determine if a single snapshot should be returned or if data should be continuously updated until the timeout threshold has been reached.

Default: Set to True, returning a snapshot of data as soon as possible.

**timeout:** Integer. Uses default timeout value passed to TWSSyncClass.

#### )

  - Python

<!-- end list -->

``` EnlighterJSRAW
contract = Contract()
contract.symbol = "AAPL"
contract.secType = "STK"
contract.exchange = "SMART"
contract.primaryExchange = "NASDAQ"
contract.currency = "USD"

market_data = app.get_market_data_snapshot(contract, "225,232", False)
```

Data returned by get\_market\_data\_snapshot() is delivered as a json dictionary object, separating data into “price” and “size” tags. Values are then returned as the affiliated tick types alongside any price or attribute data.

#### Response Object

{

**{TickType}:** Integer, Float String. The value of the tag. Can include price values (Float), Size values (Decimal), or direct information (string).

}

``` EnlighterJSRAW
{'BID': 276.17, 'BID_SIZE': Decimal('900'), 'ASK': 276.2, 'ASK_SIZE': Decimal('300'), 'LAST_TIMESTAMP': '1764009996', 'LAST': 276.18, 'LAST_SIZE': Decimal('100'), 'VOLUME': Decimal('271511')}
```

### Historical Market Data

#### get\_historical\_data(

**contract:** [Contract Object](/campus/ibkr-api-page/twsapi-doc/#contract-object). Contract to retrieve market data for.

**end\_date\_time:** String. The request’s end date and time. This should be formatted as “YYYYMMDD HH:mm:ss TMZ”. You may also pass an empty string to indicate the current moment  
Please be aware that endDateTime must be left as an empty string when requesting continuous futures contracts or certain whatToShow values like ADJUSTED\_LAST.

**duration\_str:** String. The total timespan the bars should cover. See [Duration](/campus/ibkr-api-page/twsapi-doc/#hist-duration) for details.

**bar\_size\_setting:** String. The time span covered by each bar. See [Bar Sizes](/campus/ibkr-api-page/twsapi-doc/#hist-bar-size) for details.

**what\_to\_show:** String. Determines what kind of data should be returned. See [whatToShow](/campus/ibkr-api-page/twsapi-doc/#historical-whattoshow) for more details.

**use\_rth:** Boolean. Define if data should only be returned from the regular trading session or if extended trading hours should be included.

Default: True is passed by default, only returning data from the regular trading sesions.

**format\_date:** Integer. Determine the return structure of the date. Supports (1) to return a datetime formatting string or 2 to return a epoch Unix timestamp.

Default: Set to 1, returning a datetime string.

**timeout:** Integer. A default value of 30 is supplied.

#### )

  - Python

<!-- end list -->

``` EnlighterJSRAW
contract = Contract()
contract.symbol = "AAPL"
contract.secType = "STK"
contract.exchange = "SMART"
contract.primaryExchange = "NASDAQ"
contract.currency = "USD"

app.get_historical_data(contract=contract, end_date_time="", duration_str="1 W", bar_size_setting="1 day", what_to_show="TRADES", use_rth=True)
```

#### Response Object

Requesting historical bars will return return a list containing all [Bar](/campus/ibkr-api-page/twsapi-ref/#bar-ref) objects for the duration. Please be aware that directly printing this information may result in the memory address being displayed.

``` EnlighterJSRAW
[2524872613328: Date: 20251013, Open: 249.31, High: 249.69, Low: 245.56, Close: 247.66, Volume: 187465.43, WAP: 247.952, BarCount: 105768, 2524872614864: Date: 20251014, Open: 246.6, High: 248.85, Low: 244.7, Close: 247.77, Volume: 176034.99, WAP: 247.21, BarCount: 100507, 2524872615120: Date: 20251015, Open: 249.49, High: 251.82, Low: 247.47, Close: 249.34, Volume: 172136.46, WAP: 249.754, BarCount: 96331, 2524872615248: Date: 20251016, Open: 248.28, High: 249.04, Low: 245.13, Close: 247.45, Volume: 235179.94, WAP: 247.351, BarCount: 132811, 2524872615376: Date: 20251017, Open: 248.08, High: 253.38, Low: 247.27, Close: 252.29, Volume: 260673.48, WAP: 250.408, BarCount: 125863]
```

### Place Order

#### place\_order\_sync(

**contract:** [Contract Object](/campus/ibkr-api-page/twsapi-doc/#contract-object). Contract to trade.

**order:** [Order Object](/campus/ibkr-api-page/twsapi-doc/#order-object). Order parameters to be traded.

**timeout:** Integer. Uses default timeout value passed to TWSSyncClass. Please be aware the timeout is only relevant for the response details. The order will submit in accordance with the order object’s details.

#### )

  - Python

<!-- end list -->

``` EnlighterJSRAW
contract = Contract()
contract.symbol = "AAPL"
contract.secType = "STK"
contract.exchange = "SMART"
contract.primaryExchange = "NASDAQ"
contract.currency = "USD"

order = Order()
order.action = "BUY"
order.orderType = "LMT"
order.totalQuantity = 100
order.lmtPrice = 250

app.place_order_sync(contract, order)
```

Upon placing an order, a dictionary containing all of the order status’s information will be returned. As the response is static, refer to the [get\_open\_orders](/campus/ibkr-api-page/twsapi-doc/#sync-open-orders) function more more details on the current order status.

#### Response Object

{  
orderId: Integer. The identifier for the order. Relevant for order tracking, modification, and cancellation.  
status: String. The current status of the order. See [Order Status](/campus/ibkr-api-page/twsapi-doc/#order-status-message) for more details.  
filled: Decimal. The total quantity of executed shares for the order.  
remaining: Decimal. The total quantity of shares that have yet to execute for the order.  
avgFillPrice: Float. The average execution price across fills.  
permId: Integer. The permanent identifier for the order. This is calculated based on orderId and client ID for internal order tracking.  
parentId: Integer. The orderId for the parent of this contract. Will return 0 unless trading a [bracket or](/campus/ibkr-api-page/order-types/#bracket-orders) [OCA](/campus/ibkr-api-page/order-types/#one-cancels-all-orders) order.  
lastFillPrice: Float. The price of the most recent execution for the order.  
clientId: Integer. The identifier for which client ID the order was placed through. Orders can only be cancelled or modified by their on the [clientId they are bound to](/campus/ibkr-api-page/twsapi-doc/#modify-order).  
whyHeld: String. In the event an order is held instead of being transmitted, the reason will be documented here.  
mktCapPrice: Float. If an order is capped due to it exceeding the market price and the price is automatically modified, the modified price will be returned. Otherwise 0.0 is displayed.  
}  
 

``` EnlighterJSRAW
{'orderId': 347, 'status': 'PreSubmitted', 'filled': Decimal('0'), 'remaining': Decimal('100'), 'avgFillPrice': 0.0, 'permId': 979867961, 'parentId': 0, 'lastFillPrice': 0.0, 'clientId': 8675309, 'whyHeld': '', 'mktCapPrice': 0.0}
```

### Cancel Order

#### cancel\_order\_sync(

**order\_id:** Integer. Identifier for the order to cancel. Retrieved from the original [Order Placement](/campus/ibkr-api-page/twsapi-doc/#sync-place-order) or [get\_open\_orders()](/campus/ibkr-api-page/twsapi-doc/#sync-open-orders).

**order:** [OrderCancel Object](/campus/ibkr-api-page/twsapi-doc/#ordercancel-ref). Order cancellation parameters.

**timeout:** Integer. A default value of 3 seconds is supplied.

#### )

  - Python

<!-- end list -->

``` EnlighterJSRAW
app.cancel_order_sync(347, OrderCancel())
```

Upon cancellingan order, a dictionary containing all of the order status’s information will be returned. As the response is static, refer to the [get\_open\_orders](/campus/ibkr-api-page/twsapi-doc/#sync-open-orders) function more more details on the current order status.

#### Response Object

{

**orderId:** Integer. The identifier for the order. Relevant for order tracking, modification, and cancellation.

**status:** String. The current status of the order. See [Order Status](/campus/ibkr-api-page/twsapi-doc/#order-status-message) for more details.

**filled:** Decimal. The total quantity of executed shares for the order.

**remaining:** Decimal. The total quantity of shares that have yet to execute for the order.

**avgFillPrice:** Float. The average execution price across fills.

**permId:** Integer. The permanent identifier for the order. This is calculated based on orderId and client ID for internal order tracking.

**parentId:** Integer. The orderId for the parent of this contract. Will return 0 unless trading a [bracket](/campus/ibkr-api-page/order-types/#bracket-orders) or [OCA](/campus/ibkr-api-page/order-types/#one-cancels-all-orders) order.

**lastFillPrice:** Float. The price of the most recent execution for the order.

**clientId:** Integer. The identifier for which client ID the order was placed through. Orders can only be cancelled or modified by their on the [clientId](/campus/ibkr-api-page/twsapi-doc/#modify-order) they are bound to.

**whyHeld:** String. In the event an order is held instead of being transmitted, the reason will be documented here.

**mktCapPrice:** Float. If an order is capped due to it exceeding the market price and the price is automatically modified, the modified price will be returned. Otherwise 0.0 is displayed.

}

``` EnlighterJSRAW
{'orderId': 347, 'status': 'PendingCancel', 'filled': Decimal('0'), 'remaining': Decimal('100'), 'avgFillPrice': 0.0, 'permId': 1395073938, 'parentId': 0, 'lastFillPrice': 0.0, 'clientId': 8675309, 'whyHeld': '', 'mktCapPrice': 0.0}
```

### Open Orders

#### get\_open\_orders(

**timeout:** Integer. A default value of 3 seconds is supplied.

#### )

  - Python

<!-- end list -->

``` EnlighterJSRAW
app.get_open_orders()
```

All orders from the current day’s trading session are returned in a dictionary, using the orderId as the key to discover the specific order.

#### Response Object

{  
{Order ID}: Dictionary. Returns the [Contract](/campus/ibkr-api-page/twsapi-doc/#contract-object), [Order](/campus/ibkr-api-page/twsapi-doc/#order-object), and [OrderState](/campus/ibkr-api-page/twsapi-ref/#orderstate-ref) objects of the affiliated orderId.  
{  
orderId: Integer. The identifier for the order. Relevant for order tracking, modification, and cancellation.

**contract:** [Contract Object](/campus/ibkr-api-page/twsapi-doc/#contract-object). Contract to trade.

**order:** [Order Object](/campus/ibkr-api-page/twsapi-doc/#order-object). Parameters for the given order to execute.

**orderState:** [OrderState Object](/campus/ibkr-api-page/twsapi-ref/#orderstate-ref). Current state of the order. Contains margin impact and status details.

}  
 

``` EnlighterJSRAW
{351: {'orderId': 351, 'contract': 2172957720272: ConId: 265598, Symbol: AAPL, SecType: STK, LastTradeDateOrContractMonth: , Strike: 0, Right: , Multiplier: , Exchange: SMART, PrimaryExchange: , Currency: USD, LocalSymbol: AAPL, TradingClass: NMS, IncludeExpired: False, SecIdType: , SecId: , Description: , IssuerId: Combo:, 'order': 2172957719120: 351,8675309,979867965: LMT BUY 100@800 GTC, 'orderState': }}
```

### Executions

Request all executions following the Execution Filter’s restrictions.

#### get\_executions(

**exec\_filter:** [ExecutionFilter Object](/campus/ibkr-api-page/twsapi-ref/#execfilter-ref). Parameters to restrict the Execution data to be returned.

**timeout:** Integer. A default value of 10 seconds is supplied.

#### )

  - Python

<!-- end list -->

``` EnlighterJSRAW
app.get_open_orders()
```

All executions passed in the context of the ExecutionFilter are returned in a list.

#### Response Object

\[{

**contract:** [Contract Object](/campus/ibkr-api-page/twsapi-doc/#contract-object). Contract to trade.

**execution:** [Execution Object](/campus/ibkr-api-page/twsapi-ref/#exec-ref). Execution details regarding the recent trade.

}\]  
 

``` EnlighterJSRAW
[{'contract': 1530250139984: ConId: 265598, Symbol: AAPL, SecType: STK, LastTradeDateOrContractMonth: , Strike: 0, Right: , Multiplier: , Exchange: IEX, PrimaryExchange: , Currency: USD, LocalSymbol: AAPL, TradingClass: NMS, IncludeExpired: False, SecIdType: , SecId: , Description: , IssuerId: Combo:, 'execution': 1530250140432: ExecId: 0000e0d5.68fa9014.01.01, Time: 20251022 14:56:24 US/Eastern, Account: U1234567, Exchange: IEX, Side: BOT, Shares: 100, Price: 256.62, PermId: 1395073936, ClientId: 8675309, OrderId: 355, Liquidation: 0, CumQty: 100, AvgPrice: 256.62, OrderRef: , EvRule: , EvMultiplier: 0, ModelCode: , LastLiquidity: 2, PendingPriceRevision: False, Submitter: csdem9545, OptExerciseOrLapseType: None}]
```

### Positions

Request positions for all accounts available to the user.

#### get\_positions(

**timeout:** Integer. A default value of 10 seconds is supplied.

#### )

  - Python

<!-- end list -->

``` EnlighterJSRAW
app.get_positions()
```

All orders from the current day’s trading session are returned in a dictionary, using the orderId as the key to discover the specific order.

#### Response Object

{  
{Account ID}: List. List of all contracts  
\[{

**contract:** [Contract Object](/campus/ibkr-api-page/twsapi-doc/#contract-object). Contract to trade.

**position:** Decimal. The total number of shares held in the account.

**avgCost:** Float. The average price across executions for the position.

}\]  
 

``` EnlighterJSRAW
{'U1234567': [{'contract': 2333839861008: ConId: 340216238, Symbol: COIL, SecType: FUT, LastTradeDateOrContractMonth: 20251031, Strike: 0, Right: , Multiplier: 1000, Exchange: IPE, PrimaryExchange: , Currency: , LocalSymbol: COILZ5, TradingClass: COIL, IncludeExpired: False, SecIdType: , SecId: , Description: , IssuerId: Combo:, 'position': Decimal('4'), 'avgCost': 61359.9}]}
```

### Portfolio

Request portfolio details for the selected account or accounts available to the user.

#### get\_portfolio(

**account\_code:** String. The accountID to pull portfolio information for. If an empty string is passed, all accounts are requested.

**timeout:** Integer. A default value of 10 seconds is supplied.

#### )

  - Python

<!-- end list -->

``` EnlighterJSRAW
app.get_portfolio("")
```

#### Response Object

{  
{Account ID}: List. List of all contracts  
\[{

**contract:** [Contract Object](/campus/ibkr-api-page/twsapi-doc/#contract-object). Contract to trade.

**position:** Decimal. The total number of shares held in the account.

**marketPrice:** Float. The current market price of the instrument.

**marketValue:** Float. The current value of the total position.

**averageCost:** Float. The average price across executions for the position.

**unrealizedPNL:** Float. The unrealized profit and loss for the instrument.

**realizedPNL:** Float. The realized profit and loss for the instrument.

**accountName:** String. The account identifier that holds the given position.

}\]  
 

``` EnlighterJSRAW
[{'contract': 1957652380880: ConId: 265598, Symbol: AAPL, SecType: STK, LastTradeDateOrContractMonth: , Strike: 0, Right: , Multiplier: , Exchange: ISLAND, PrimaryExchange: , Currency: USD, LocalSymbol: AAPL, TradingClass: NMS, IncludeExpired: False, SecIdType: , SecId: , Description: , IssuerId: Combo:, 'position': Decimal('202635'), 'marketPrice': 258.57998655, 'marketValue': 52397355.58, 'averageCost': 263.3360764, 'unrealizedPNL': -963750.26, 'realizedPNL': 0.0, 'accountName': 'DU5240685'}]
```

## Account & Portfolio Data

The IBApi.EClient.reqAccountSummary method creates a subscription for the account data displayed in the TWS Account Summary window. It is commonly used with multiple-account structures. Introducing broker (IBroker) accounts with more than 50 subaccounts or configured for on-demand account lookup cannot use reqAccountSummary with group=”All”. A profile name can be accepted in place of group. See Unification of Groups and Profiles.

The TWS offers a comprehensive overview of your account and portfolio through its Account and Portfolio windows. This information can be obtained via the TWS API through three different kind of requests/operations.

### Account Summary

The initial invocation of reqAccountSummary will result in a list of all requested values being returned, and then every three minutes those values which have changed will be returned. The update frequency of 3 minutes is the same as the TWS Account Window and cannot be changed.

### Requesting Account Summary

Requests a specific account’s summary. This method will subscribe to the account summary as presented in the TWS’ Account Summary tab. Customers can specify the data received by using a specific tags value. See the Account Summary Tags section for available options.

Alternatively, many languages offer the import of AccountSummaryTags with a method to retrieve all tag values.

#### EClient.reqAccountSummary (

**reqId:** int. The unique request identifier.

**group:** String. set to “All” to return account summary data for all accounts, or set to a specific Advisor Account Group name that has already been created in TWS Global Configuration.

**tags:** String. A comma separated list with the [desired tags](#account-summary-tags)

)

**Important:** only **two** active summary subscriptions are allowed at a time\!

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
self.reqAccountSummary(9001, "All", AccountSummaryTags.AllTags)
```

Code example:

``` EnlighterJSRAW
from ibapi.client import *
from ibapi.wrapper import *
from ibapi.contract import Contract
import time

class TradeApp(EWrapper, EClient): 
    def __init__(self): 
        EClient.__init__(self, self) 

    def accountSummary(self, reqId: int, account: str, tag: str, value: str,currency: str):
        print("AccountSummary. ReqId:", reqId, "Account:", account,"Tag: ", tag, "Value:", value, "Currency:", currency)
    
    def accountSummaryEnd(self, reqId: int):
        print("AccountSummaryEnd. ReqId:", reqId)
    
app = TradeApp()      
app.connect("127.0.0.1", 7496, clientId=1)

time.sleep(1)

app.reqAccountSummary(9001, "All", 'NetLiquidation')
app.run()
```

``` EnlighterJSRAW
client.reqAccountSummary(9001, "All", "AccountType,NetLiquidation,TotalCashValue,SettledCash,AccruedCash,BuyingPower,EquityWithLoanValue,PreviousEquityWithLoanValue,GrossPositionValue,ReqTEquity,ReqTMargin,SMA,InitMarginReq,MaintMarginReq,AvailableFunds,ExcessLiquidity,Cushion,FullInitMarginReq,FullMaintMarginReq,FullAvailableFunds,FullExcessLiquidity,LookAheadNextChange,LookAheadInitMarginReq ,LookAheadMaintMarginReq,LookAheadAvailableFunds,LookAheadExcessLiquidity,HighestSeverity,DayTradesRemaining,Leverage");
```

``` EnlighterJSRAW
m_pClient->reqAccountSummary(9001, "All", AccountSummaryTags::getAllTags());
```

``` EnlighterJSRAW
client.reqAccountSummary(9001, "All", AccountSummaryTags.GetAllTags());
```

``` EnlighterJSRAW
client.reqAccountSummary(9001, "All", AccountSummaryTags.GetAllTags())
```

### Account Summary Tags

|                             |                                                                                                                                                                   |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AccountType                 | Identifies the IB account structure                                                                                                                               |
| NetLiquidation              | The basis for determining the price of the assets in your account. Total cash value + stock value + options value + bond value                                    |
| TotalCashValue              | Total cash balance recognized at the time of trade + futures PNL                                                                                                  |
| SettledCash                 | Cash recognized at the time of settlement – purchases at the time of trade – commissions – taxes – fees                                                           |
| AccruedCash                 | Total accrued cash value of stock, commodities and securities                                                                                                     |
| BuyingPower                 | Buying power serves as a measurement of the dollar value of securities that one may purchase in a securities account without depositing additional funds          |
| EquityWithLoanValue         | Forms the basis for determining whether a client has the necessary assets to either initiate or maintain security positions. Cash + stocks + bonds + mutual funds |
| PreviousEquityWithLoanValue | Marginable Equity with Loan value as of 16:00 ET the previous day                                                                                                 |
| GrossPositionValue          | The sum of the absolute value of all stock and equity option positions                                                                                            |
| RegTEquity                  | Regulation T equity for universal account                                                                                                                         |
| RegTMargin                  | Regulation T margin for universal account                                                                                                                         |
| SMA                         | Special Memorandum Account: Line of credit created when the market value of securities in a Regulation T account increase in value                                |
| InitMarginReq               | Initial Margin requirement of whole portfolio                                                                                                                     |
| MaintMarginReq              | Maintenance Margin requirement of whole portfolio                                                                                                                 |
| AvailableFunds              | This value tells what you have available for trading                                                                                                              |
| ExcessLiquidity             | This value shows your margin cushion, before liquidation                                                                                                          |
| Cushion                     | Excess liquidity as a percentage of net liquidation value                                                                                                         |
| FullInitMarginReq           | Initial Margin of whole portfolio with no discounts or intraday credits                                                                                           |
| FullMaintMarginReq          | Maintenance Margin of whole portfolio with no discounts or intraday credits                                                                                       |
| FullAvailableFunds          | Available funds of whole portfolio with no discounts or intraday credits                                                                                          |
| FullExcessLiquidity         | Excess liquidity of whole portfolio with no discounts or intraday credits                                                                                         |
| LookAheadNextChange         | Time when look-ahead values take effect                                                                                                                           |
| LookAheadInitMarginReq      | Initial Margin requirement of whole portfolio as of next period’s margin change                                                                                   |
| LookAheadMaintMarginReq     | Maintenance Margin requirement of whole portfolio as of next period’s margin change                                                                               |
| LookAheadAvailableFunds     | This value reflects your available funds at the next margin change                                                                                                |
| LookAheadExcessLiquidity    | This value reflects your excess liquidity at the next margin change                                                                                               |
| HighestSeverity             | A measure of how close the account is to liquidation                                                                                                              |
| DayTradesRemaining          | The Number of Open/Close trades a user could put on before Pattern Day Trading is detected. A value of “-1” means that the user can put on unlimited day trades.  |
| Leverage                    | GrossPositionValue / NetLiquidation                                                                                                                               |
| $LEDGER                     | Single flag to relay all cash balance tags\*, only in base currency.                                                                                              |
| $LEDGER:CURRENCY            | Single flag to relay all cash balance tags\*, only in the specified currency.                                                                                     |
| $LEDGER:ALL                 | Single flag to relay all cash balance tags\* in all currencies.                                                                                                   |

### Receiving Account Summary

#### EWrapper.accountSummary (

**reqId:** int. the request’s unique identifier.

**account:** String. the account id

**tag:** String. the account’s attribute being received.

**value:** String. the account’s attribute’s value.

**currency:** String. the currency on which the value is expressed.

)

Receives the account information. This method will receive the account information just as it appears in the TWS’ Account Summary Window.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
def accountSummary(self, reqId: int, account: str, tag: str, value: str,currency: str):
  print("AccountSummary. ReqId:", reqId, "Account:", account,"Tag: ", tag, "Value:", value, "Currency:", currency)
```

``` EnlighterJSRAW
@Override
public void accountSummary(int reqId, String account, String tag, String value, String currency) {
    System.out.println(EWrapperMsgGenerator.accountSummary(reqId, account, tag, value, currency));
}
```

``` EnlighterJSRAW
void TestCppClient::accountSummary( int reqId, const std::string& account, const std::string& tag, const std::string& value, const std::string& currency) {
    printf( "Acct Summary. ReqId: %d, Account: %s, Tag: %s, Value: %s, Currency: %s\n", reqId, account.c_str(), tag.c_str(), value.c_str(), currency.c_str());
}
```

``` EnlighterJSRAW
public virtual void accountSummary(int reqId, string account, string tag, string value, string currency)
{
    Console.WriteLine("Acct Summary. ReqId: " + reqId + ", Acct: " + account + ", Tag: " + tag + ", Value: " + value + ", Currency: " + currency);
}
```

``` EnlighterJSRAW
Public Sub accountSummary(reqId As Integer, account As String, tag As String, value As String, currency As String) Implements IBApi.EWrapper.accountSummary
    Console.WriteLine("AccountSummary - ReqId [" & reqId & "] Account [" & account & "] Tag [" & tag & "] Value [" & value & "] Currency [" & currency & "]")
End Sub
```

#### EWrapper.accountSummaryEnd(

**reqId:** String. The request’s identifier.

)

Notifies when all the accounts’ information has ben received. Requires TWS 967+ to receive accountSummaryEnd in linked account structures.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
def accountSummaryEnd(self, reqId: int):
    print("AccountSummaryEnd. ReqId:", reqId)
```

``` EnlighterJSRAW
@Override
public void accountSummaryEnd(int reqId) {
    System.out.println("Account Summary End. Req Id: " + EWrapperMsgGenerator.accountSummaryEnd(reqId));
}
```

``` EnlighterJSRAW
void TestCppClient::accountSummaryEnd( int reqId) {
    printf( "AccountSummaryEnd. Req Id: %d\n", reqId);
}
```

``` EnlighterJSRAW
public virtual void accountSummaryEnd(int reqId)
{
    Console.WriteLine("AccountSummaryEnd. Req Id: "+reqId+"\n");
}
```

``` EnlighterJSRAW
Public Sub accountSummaryEnd(reqId As Integer) Implements IBApi.EWrapper.accountSummaryEnd
    Console.WriteLine("AccountSummaryEnd - ReqId [" & reqId & "]")
End Sub
```

### Cancel Account Summary

Once the subscription to account summary is no longer needed, it can be cancelled via the IBApi::EClient::cancelAccountSummary method:

#### EClient.cancelAccountSummary (

**reqId:** int. The identifier of the previously performed account request

)

  - Python
  - C++

<!-- end list -->

``` EnlighterJSRAW
self.cancelAccountSummary(9001)
```

``` EnlighterJSRAW
m_pClient->cancelAccountSummary(9001);
```

### Account Updates

The IBApi.EClient.reqAccountUpdates function creates a subscription to the TWS through which account and portfolio information is delivered. This information is the exact same as the one displayed within the TWS’ Account Window. Just as with the TWS’ Account Window, unless there is a position change this information is updated at a fixed interval of three minutes.

Unrealized and Realized P\&L is sent to the API function IBApi.EWrapper.updateAccountValue function after a subscription request is made with IBApi.EClient.reqAccountUpdates. This information corresponds to the data in the TWS Account Window, and has a different source of information, a different update frequency, and different reset schedule than PnL data in the TWS Portfolio Window and associated API functions (below). In particular, the unrealized P\&L information shown in the TWS Account Window which is sent to [EWrapper.updatePortfolio](/campus/ibkr-api-page/twsapi-doc/#receive-account-updates) will update either (1) when a trade for that particular instrument occurs or (2) every 3 minutes. The realized P\&L data in the TWS Account Window is reset to 0 once per day.

It is important to keep in mind that the P\&L data shown in the Account Window and Portfolio Window will sometimes differ because there is a different source of information and a different reset schedule.

See [Profit & Loss](#pnl) for alternative PnL data

### Requesting Account Updates

Subscribes to a specific account’s information and portfolio. Through this method, a single account’s subscription can be started/stopped. As a result from the subscription, the account’s information, portfolio and last update time will be received at EWrapper.updateAccountValue, EWrapper.updatePortfolio, EWrapper.updateAccountTime respectively. All account values and positions will be returned initially, and then there will only be updates when there is a change in a position, or to an account value every 3 minutes if it has changed. Only one account can be subscribed at a time. A second subscription request for another account when the previous one is still active will cause the first one to be canceled in favor of the second one.

#### EClient.reqAccountUpdates (

**subscribe:** bool. Set to true to start the subscription and to false to stop it.

**acctCode:** String. The account id (i.e. U123456) for which the information is requested.

)

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
self.reqAccountUpdates(True, self.account)
```

Code example:

``` EnlighterJSRAW
from ibapi.client import *
from ibapi.wrapper import *
from ibapi.contract import Contract
import time

class TradeApp(EWrapper, EClient): 
    def __init__(self): 
        EClient.__init__(self, self) 

    def updateAccountValue(self, key: str, val: str, currency: str,accountName: str):
        print("UpdateAccountValue. Key:", key, "Value:", val, "Currency:", currency, "AccountName:", accountName)
    
    def updatePortfolio(self, contract: Contract, position: Decimal,marketPrice: float, marketValue: float, averageCost: float, unrealizedPNL: float, realizedPNL: float, accountName: str):
        print("UpdatePortfolio.", "Symbol:", contract.symbol, "SecType:", contract.secType, "Exchange:",contract.exchange, "Position:", decimalMaxString(position), "MarketPrice:", floatMaxString(marketPrice),"MarketValue:", floatMaxString(marketValue), "AverageCost:", floatMaxString(averageCost), "UnrealizedPNL:", floatMaxString(unrealizedPNL), "RealizedPNL:", floatMaxString(realizedPNL), "AccountName:", accountName)

    def updateAccountTime(self, timeStamp: str):
        print("UpdateAccountTime. Time:", timeStamp)

    def accountDownloadEnd(self, accountName: str):
        print("AccountDownloadEnd. Account:", accountName)
    
app = TradeApp()      
app.connect("127.0.0.1", 7496, clientId=1)

time.sleep(1)

app.reqAccountUpdates(True, 'U123456')
app.run()
```

``` EnlighterJSRAW
client.reqAccountUpdates(true, "U1234567");
```

``` EnlighterJSRAW
m_pClient->reqAccountUpdates(true, "U150462");
```

``` EnlighterJSRAW
client.reqAccountUpdates(true, "U1234567");
```

``` EnlighterJSRAW
client.reqAccountUpdates(True, "U1234567")
```

### Receiving Account Updates

Resulting account and portfolio information will be delivered via the IBApi.EWrapper.updateAccountValue, IBApi.EWrapper.updatePortfolio, IBApi.EWrapper.updateAccountTime and IBApi.EWrapper.accountDownloadEnd

#### EWrapper.updateAccountValue (

**key:** String. The value being updated.

**value:** String. up-to-date value

**currency:** String. The currency on which the value is expressed.

**accountName:** String. The account identifier.  
)

Receives the subscribed account’s information. Only one account can be subscribed at a time. After the initial callback to updateAccountValue, callbacks only occur for values which have changed. This occurs at the time of a position change, or every 3 minutes at most. This frequency cannot be adjusted.

**Note:** An important key passed back in EWrapper.updateAccountValue after a call to EClient.reqAccountUpdates is a boolean value ‘accountReady’. If an accountReady value of false is returned that means that the IB server is in the process of resetting at that moment, i.e. the account is ‘not ready’. When this occurs subsequent key values returned to EWrapper.updateAccountValue in the current update can be out of date or incorrect.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
def updateAccountValue(self, key: str, val: str, currency: str,accountName: str):
    print("UpdateAccountValue. Key:", key, "Value:", val, "Currency:", currency, "AccountName:", accountName)
```

``` EnlighterJSRAW
@Override
public void updateAccountValue(String key, String value, String currency, String accountName) {
    System.out.println(EWrapperMsgGenerator.updateAccountValue( key, value, currency, accountName));
}
```

``` EnlighterJSRAW
void TestCppClient::updateAccountValue(const std::string& key, const std::string& val, const std::string& currency, const std::string& accountName) {
    printf("UpdateAccountValue. Key: %s, Value: %s, Currency: %s, Account Name: %s\n", key.c_str(), val.c_str(), currency.c_str(), accountName.c_str());
}
```

``` EnlighterJSRAW
public virtual void updateAccountValue(string key, string value, string currency, string accountName)
{
    Console.WriteLine("UpdateAccountValue. Key: " + key + ", Value: " + value + ", Currency: " + currency + ", AccountName: " + accountName);
}
```

``` EnlighterJSRAW
Public Sub updateAccountValue(key As String, value As String, currency As String, accountName As String) Implements IBApi.EWrapper.updateAccountValue
        Console.WriteLine("UpdateAccountValue. Key: " & key & ", Value: " & value & ", Currency: " & currency & ", AccountName: " & accountName)
End Sub
```

#### EWrapper.updatePortfolio (

**contract:** Contract. The Contract for which a position is held.

**position:** Decimal. The number of positions held.

**marketPrice:** Double. The instrument’s unitary price

**marketValue:** Double. Total market value of the instrument.

**averageCost:** Double. Average cost of the overall position.

**unrealizedPNL:** Double. Daily unrealized profit and loss on the position.

**realizedPNL:** Double. Daily realized profit and loss on the position.

**accountName:** String. Account ID for the update.

)

Receives the subscribed account’s portfolio. This function will receive only the portfolio of the subscribed account. After the initial callback to updatePortfolio, callbacks only occur for positions which have changed.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
def updatePortfolio(self, contract: Contract, position: Decimal,marketPrice: float, marketValue: float, averageCost: float, unrealizedPNL: float, realizedPNL: float, accountName: str):
    print("UpdatePortfolio.", "Symbol:", contract.symbol, "SecType:", contract.secType, "Exchange:",contract.exchange, "Position:", decimalMaxString(position), "MarketPrice:", floatMaxString(marketPrice),"MarketValue:", floatMaxString(marketValue), "AverageCost:", floatMaxString(averageCost), "UnrealizedPNL:", floatMaxString(unrealizedPNL), "RealizedPNL:", floatMaxString(realizedPNL), "AccountName:", accountName)
```

``` EnlighterJSRAW
@Override
public void updatePortfolio(Contract contract, Decimal position, double marketPrice, double marketValue, double averageCost, double unrealizedPNL, double realizedPNL, String accountName) {
    System.out.println(EWrapperMsgGenerator.updatePortfolio( contract, position, marketPrice, marketValue, averageCost, unrealizedPNL, realizedPNL, accountName));
}
```

``` EnlighterJSRAW
void TestCppClient::updatePortfolio(const Contract& contract, Decimal position, double marketPrice, double marketValue, double averageCost, double unrealizedPNL, double realizedPNL, const std::string& accountName){
    printf("UpdatePortfolio. %s, %s @ %s: Position: %s, MarketPrice: %s, MarketValue: %s, AverageCost: %s, UnrealizedPNL: %s, RealizedPNL: %s, AccountName: %s\n", (contract.symbol).c_str(), (contract.secType).c_str(), (contract.primaryExchange).c_str(), decimalStringToDisplay(position).c_str(), Utils::doubleMaxString(marketPrice).c_str(), Utils::doubleMaxString(marketValue).c_str(), Utils::doubleMaxString(averageCost).c_str(), Utils::doubleMaxString(unrealizedPNL).c_str(), Utils::doubleMaxString(realizedPNL).c_str(), accountName.c_str());
}
```

``` EnlighterJSRAW
public virtual void updatePortfolio(Contract contract, decimal position, double marketPrice, double marketValue, double averageCost, double unrealizedPNL, double realizedPNL, string accountName)
{
    Console.WriteLine("UpdatePortfolio. " + contract.Symbol + ", " + contract.SecType + " @ " + contract.Exchange + ": Position: " + Util.DecimalMaxString(position) + ", MarketPrice: " + Util.DoubleMaxString(marketPrice) + ", MarketValue: " + Util.DoubleMaxString(marketValue) +  ", AverageCost: " + Util.DoubleMaxString(averageCost) + ", UnrealizedPNL: " + Util.DoubleMaxString(unrealizedPNL) + ", RealizedPNL: " + Util.DoubleMaxString(realizedPNL) +  ", AccountName: " + accountName);
}
```

``` EnlighterJSRAW
Public Sub updatePortfolio(contract As IBApi.Contract, position As Decimal, marketPrice As Double, marketValue As Double, averageCost As Double, unrealizedPNL As Double, realizedPNL As Double, accountName As String) Implements IBApi.EWrapper.updatePortfolio
        Console.WriteLine("UpdatePortfolio. " & contract.Symbol & ", " & contract.SecType & " @ " & contract.Exchange & ": Position: " & Util.DecimalMaxString(position) & ", MarketPrice: " & Util.DoubleMaxString(marketPrice) & ", MarketValue: " & Util.DoubleMaxString(marketValue) & ", AverageCost: " & Util.DoubleMaxString(averageCost) & ", UnrealizedPNL: " & Util.DoubleMaxString(unrealizedPNL) & ", RealizedPNL: " & Util.DoubleMaxString(realizedPNL) & ", AccountName: " & accountName)
End Sub
```

#### EWrapper.updateAccountTime (

**timestamp:** String. the last update system time.

)

Receives the last time on which the account was updated.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
def updateAccountTime(self, timeStamp: str):
     print("UpdateAccountTime. Time:", timeStamp)
```

``` EnlighterJSRAW
@Override
public void updateAccountTime(String timeStamp) {
    System.out.println(EWrapperMsgGenerator.updateAccountTime( timeStamp));
}
```

``` EnlighterJSRAW
void TestCppClient::updateAccountTime(const std::string& timeStamp) {
    printf( "UpdateAccountTime. Time: %s\n", timeStamp.c_str());
}
```

``` EnlighterJSRAW
public virtual void updateAccountTime(string timestamp)
{
        Console.WriteLine("UpdateAccountTime. Time: " + timestamp+"\n");
}
```

``` EnlighterJSRAW
Public Sub updateAccountTime(timestamp As String) Implements IBApi.EWrapper.updateAccountTime
    Console.WriteLine("UpdateAccountTime. Time: " & timestamp)
End Sub
```

#### EWrapper.accountDownloadEnd (

**account:** String. The account identifier.

)

Notifies when all the account’s information has finished.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
def accountDownloadEnd(self, accountName: str):
    print("AccountDownloadEnd. Account:", accountName)
```

``` EnlighterJSRAW
@Override
public void accountDownloadEnd(String accountName) {
    System.out.println(EWrapperMsgGenerator.accountDownloadEnd(accountName));
}
```

``` EnlighterJSRAW
void TestCppClient::accountDownloadEnd(const std::string& accountName) {
    printf( "Account download finished: %s\n", accountName.c_str());
}
```

``` EnlighterJSRAW
public virtual void accountDownloadEnd(string account)
{
    Console.WriteLine("Account download finished: "+account+"\n");
}
```

``` EnlighterJSRAW
Public Sub accountDownloadEnd(account As String) Implements IBApi.EWrapper.accountDownloadEnd
    Console.WriteLine("accountDownloadEnd - Account[" & account & "]")
End Sub
```

### Account Value Keys

When requesting [reqAccountUpdates](https://www.interactivebrokers.com/campus/ibkr-api-page/trader-workstation-api/#request-account-updates) customers will receive values corresponding to various account key/value pairs. The table below documents potential responses and what they mean.

Account values delivered via [IBApi.EWrapper.updateAccountValue](https://www.interactivebrokers.com/campus/ibkr-api-page/trader-workstation-api/#receive-account-updates) can be classified in the following way:

  - Commodities: suffixed by a “-C”
  - Securities: suffixed by a “-S”
  - Totals: no suffix

| Key                              | Description                                                                                                                                                                                                                                                                                       |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AccountCode                      | The account ID number                                                                                                                                                                                                                                                                             |
| AccountOrGroup                   | “All” to return account summary data for all accounts, or set to a specific Advisor Account Group name that has already been created in TWS Global Configuration                                                                                                                                  |
| AccountReady                     | If an accountReady value of false is returned that means that the IB server is in the process of resetting at that moment, i.e. the account is ‘not ready’. When this occurs subsequent key values returned to EWrapper.updateAccountValue in the current update can be out of date or incorrect. |
| AccountType                      | Identifies the IB account structure                                                                                                                                                                                                                                                               |
| AccruedCash                      | Total accrued cash value of stock, commodities and securities                                                                                                                                                                                                                                     |
| AccruedCash-C                    | Reflects the current’s month accrued debit and credit interest to date, updated daily in commodity segment                                                                                                                                                                                        |
| AccruedCash-S                    | Reflects the current’s month accrued debit and credit interest to date, updated daily in security segment                                                                                                                                                                                         |
| AccruedDividend                  | Total portfolio value of dividends accrued                                                                                                                                                                                                                                                        |
| AccruedDividend-C                | Dividends accrued but not paid in commodity segment                                                                                                                                                                                                                                               |
| AccruedDividend-S                | Dividends accrued but not paid in security segment                                                                                                                                                                                                                                                |
| AvailableFunds                   | This value tells what you have available for trading                                                                                                                                                                                                                                              |
| AvailableFunds-C                 | Net Liquidation Value – Initial Margin                                                                                                                                                                                                                                                            |
| AvailableFunds-S                 | Equity with Loan Value – Initial Margin                                                                                                                                                                                                                                                           |
| Billable                         | Total portfolio value of treasury bills                                                                                                                                                                                                                                                           |
| Billable-C                       | Value of treasury bills in commodity segment                                                                                                                                                                                                                                                      |
| Billable-S                       | Value of treasury bills in security segment                                                                                                                                                                                                                                                       |
| BuyingPower                      | Cash Account: Minimum (Equity with Loan Value, Previous Day Equity with Loan Value)-Initial Margin, Standard Margin Account: Minimum (Equity with Loan Value, Previous Day Equity with Loan Value) – Initial Margin \*4                                                                           |
| CashBalance                      | Cash recognized at the time of trade + futures PNL                                                                                                                                                                                                                                                |
| CorporateBondValue               | Value of non-Government bonds such as corporate bonds and municipal bonds                                                                                                                                                                                                                         |
| Currency                         | Open positions are grouped by currency                                                                                                                                                                                                                                                            |
| Cushion                          | Excess liquidity as a percentage of net liquidation value                                                                                                                                                                                                                                         |
| DayTradesRemaining               | Number of Open/Close trades one could do before Pattern Day Trading is detected                                                                                                                                                                                                                   |
| DayTradesRemainingT+1            | Number of Open/Close trades one could do tomorrow before Pattern Day Trading is detected                                                                                                                                                                                                          |
| DayTradesRemainingT+2            | Number of Open/Close trades one could do two days from today before Pattern Day Trading is detected                                                                                                                                                                                               |
| DayTradesRemainingT+3            | Number of Open/Close trades one could do three days from today before Pattern Day Trading is detected                                                                                                                                                                                             |
| DayTradesRemainingT+4            | Number of Open/Close trades one could do four days from today before Pattern Day Trading is detected                                                                                                                                                                                              |
| EquityWithLoanValue              | Forms the basis for determining whether a client has the necessary assets to either initiate or maintain security positions                                                                                                                                                                       |
| EquityWithLoanValue-C            | Cash account: Total cash value + commodities option value – futures maintenance margin requirement + minimum (0, futures PNL) Margin account: Total cash value + commodities option value – futures maintenance margin requirement                                                                |
| EquityWithLoanValue-S            | Cash account: Settled Cash Margin Account: Total cash value + stock value + bond value + (non-U.S. & Canada securities options value)                                                                                                                                                             |
| ExcessLiquidity                  | This value shows your margin cushion, before liquidation                                                                                                                                                                                                                                          |
| ExcessLiquidity-C                | Equity with Loan Value – Maintenance Margin                                                                                                                                                                                                                                                       |
| ExcessLiquidity-S                | Net Liquidation Value – Maintenance Margin                                                                                                                                                                                                                                                        |
| ExchangeRate                     | The exchange rate of the currency to your base currency                                                                                                                                                                                                                                           |
| FullAvailableFunds               | Available funds of whole portfolio with no discounts or intraday credits                                                                                                                                                                                                                          |
| FullAvailableFunds-C             | Net Liquidation Value – Full Initial Margin                                                                                                                                                                                                                                                       |
| FullAvailableFunds-S             | Equity with Loan Value – Full Initial Margin                                                                                                                                                                                                                                                      |
| FullExcessLiquidity              | Excess liquidity of whole portfolio with no discounts or intraday credits                                                                                                                                                                                                                         |
| FullExcessLiquidity-C            | Net Liquidation Value – Full Maintenance Margin                                                                                                                                                                                                                                                   |
| FullExcessLiquidity-S            | Equity with Loan Value – Full Maintenance Margin                                                                                                                                                                                                                                                  |
| FullInitMarginReq                | Initial Margin of whole portfolio with no discounts or intraday credits                                                                                                                                                                                                                           |
| FullInitMarginReq-C              | Initial Margin of commodity segment’s portfolio with no discounts or intraday credits                                                                                                                                                                                                             |
| FullInitMarginReq-S              | Initial Margin of security segment’s portfolio with no discounts or intraday credits                                                                                                                                                                                                              |
| FullMaintMarginReq               | Maintenance Margin of whole portfolio with no discounts or intraday credits                                                                                                                                                                                                                       |
| FullMaintMarginReq-C             | Maintenance Margin of commodity segment’s portfolio with no discounts or intraday credits                                                                                                                                                                                                         |
| FullMaintMarginReq-S             | Maintenance Margin of security segment’s portfolio with no discounts or intraday credits                                                                                                                                                                                                          |
| FundValue                        | Value of funds value (money market funds + mutual funds)                                                                                                                                                                                                                                          |
| FutureOptionValue                | Real-time market-to-market value of futures options                                                                                                                                                                                                                                               |
| FuturesPNL                       | Real-time changes in futures value since last settlement                                                                                                                                                                                                                                          |
| FxCashBalance                    | Cash balance in related IB-UKL account                                                                                                                                                                                                                                                            |
| GrossPositionValue               | Gross Position Value in securities segment                                                                                                                                                                                                                                                        |
| GrossPositionValue-S             | Long Stock Value + Short Stock Value + Long Option Value + Short Option Value                                                                                                                                                                                                                     |
| IndianStockHaircut               | Margin rule for IB-IN accounts                                                                                                                                                                                                                                                                    |
| InitMarginReq                    | Initial Margin requirement of whole portfolio                                                                                                                                                                                                                                                     |
| InitMarginReq-C                  | Initial Margin of the commodity segment in base currency                                                                                                                                                                                                                                          |
| InitMarginReq-S                  | Initial Margin of the security segment in base currency                                                                                                                                                                                                                                           |
| IssuerOptionValue                | Real-time mark-to-market value of Issued Option                                                                                                                                                                                                                                                   |
| Leverage-S                       | GrossPositionValue / NetLiquidation in security segment                                                                                                                                                                                                                                           |
| LookAheadNextChange              | Time when look-ahead values take effect                                                                                                                                                                                                                                                           |
| LookAheadAvailableFunds          | This value reflects your available funds at the next margin change                                                                                                                                                                                                                                |
| LookAheadAvailableFunds-C        | Net Liquidation Value – look ahead Initial Margin                                                                                                                                                                                                                                                 |
| LookAheadAvailableFunds-S        | Equity with Loan Value – look ahead Initial Margin                                                                                                                                                                                                                                                |
| LookAheadExcessLiquidity         | This value reflects your excess liquidity at the next margin change                                                                                                                                                                                                                               |
| LookAheadExcessLiquidity-C       | Net Liquidation Value – look ahead Maintenance Margin                                                                                                                                                                                                                                             |
| LookAheadExcessLiquidity-S       | Equity with Loan Value – look ahead Maintenance Margin                                                                                                                                                                                                                                            |
| LookAheadInitMarginReq           | Initial margin requirement of whole portfolio as of next period’s margin change                                                                                                                                                                                                                   |
| LookAheadInitMarginReq-C         | Initial margin requirement as of next period’s margin change in the base currency of the account                                                                                                                                                                                                  |
| LookAheadInitMarginReq-S         | Initial margin requirement as of next period’s margin change in the base currency of the account                                                                                                                                                                                                  |
| LookAheadMaintMarginReq          | Maintenance margin requirement of whole portfolio as of next period’s margin change                                                                                                                                                                                                               |
| LookAheadMaintMarginReq-C        | Maintenance margin requirement as of next period’s margin change in the base currency of the account                                                                                                                                                                                              |
| LookAheadMaintMarginReq-S        | Maintenance margin requirement as of next period’s margin change in the base currency of the account                                                                                                                                                                                              |
| MaintMarginReq                   | Maintenance Margin requirement of whole portfolio                                                                                                                                                                                                                                                 |
| MaintMarginReq-C                 | Maintenance Margin for the commodity segment                                                                                                                                                                                                                                                      |
| MaintMarginReq-S                 | Maintenance Margin for the security segment                                                                                                                                                                                                                                                       |
| MoneyMarketFundValue             | Market value of money market funds excluding mutual funds                                                                                                                                                                                                                                         |
| MutualFundValue                  | Market value of mutual funds excluding money market funds                                                                                                                                                                                                                                         |
| NetDividend                      | The sum of the Dividend Payable/Receivable Values for the securities and commodities segments of the account                                                                                                                                                                                      |
| NetLiquidation                   | The basis for determining the price of the assets in your account                                                                                                                                                                                                                                 |
| NetLiquidation-C                 | Total cash value + futures PNL + commodities options value                                                                                                                                                                                                                                        |
| NetLiquidation-S                 | Total cash value + stock value + securities options value + bond value                                                                                                                                                                                                                            |
| NetLiquidationByCurrency         | Net liquidation for individual currencies                                                                                                                                                                                                                                                         |
| OptionMarketValue                | Real-time mark-to-market value of options                                                                                                                                                                                                                                                         |
| PASharesValue                    | Personal Account shares value of whole portfolio                                                                                                                                                                                                                                                  |
| PASharesValue-C                  | Personal Account shares value in commodity segment                                                                                                                                                                                                                                                |
| PASharesValue-S                  | Personal Account shares value in security segment                                                                                                                                                                                                                                                 |
| PostExpirationExcess             | Total projected “at expiration” excess liquidity                                                                                                                                                                                                                                                  |
| PostExpirationExcess-C           | Provides a projected “at expiration” excess liquidity based on the soon-to expire contracts in your portfolio in commodity segment                                                                                                                                                                |
| PostExpirationExcess-S           | Provides a projected “at expiration” excess liquidity based on the soon-to expire contracts in your portfolio in security segment                                                                                                                                                                 |
| PostExpirationMargin             | Total projected “at expiration” margin                                                                                                                                                                                                                                                            |
| PostExpirationMargin-C           | Provides a projected “at expiration” margin value based on the soon-to expire contracts in your portfolio in commodity segment                                                                                                                                                                    |
| PostExpirationMargin-S           | Provides a projected “at expiration” margin value based on the soon-to expire contracts in your portfolio in security segment                                                                                                                                                                     |
| PreviousDayEquityWithLoanValue   | Marginable Equity with Loan value as of 16:00 ET the previous day in securities segment                                                                                                                                                                                                           |
| PreviousDayEquityWithLoanValue-S | IMarginable Equity with Loan value as of 16:00 ET the previous day                                                                                                                                                                                                                                |
| RealCurrency                     | Open positions are grouped by currency                                                                                                                                                                                                                                                            |
| RealizedPnL                      | Shows your profit on closed positions, which is the difference between your entry execution cost and exit execution costs, or (execution price + commissions to open the positions) – (execution price + commissions to close the position)                                                       |
| RegTEquity                       | Regulation T equity for universal account                                                                                                                                                                                                                                                         |
| RegTEquity-S                     | Regulation T equity for security segment                                                                                                                                                                                                                                                          |
| RegTMargin                       | Regulation T margin for universal account                                                                                                                                                                                                                                                         |
| RegTMargin-S                     | Regulation T margin for security segment                                                                                                                                                                                                                                                          |
| SMA                              | Line of credit created when the market value of securities in a Regulation T account increase in value                                                                                                                                                                                            |
| SMA-S                            | Regulation T Special Memorandum Account balance for security segment                                                                                                                                                                                                                              |
| SegmentTitle                     | Account segment name                                                                                                                                                                                                                                                                              |
| StockMarketValue                 | Real-time mark-to-market value of stock                                                                                                                                                                                                                                                           |
| TBondValue                       | Value of treasury bonds                                                                                                                                                                                                                                                                           |
| TBillValue                       | Value of treasury bills                                                                                                                                                                                                                                                                           |
| TotalCashBalance                 | Total Cash Balance including Future PNL                                                                                                                                                                                                                                                           |
| TotalCashValue                   | Total cash value of stock, commodities and securities                                                                                                                                                                                                                                             |
| TotalCashValue-C                 | CashBalance in commodity segment                                                                                                                                                                                                                                                                  |
| TotalCashValue-S                 | CashBalance in security segment                                                                                                                                                                                                                                                                   |
| TradingType-S                    | Account Type                                                                                                                                                                                                                                                                                      |
| UnrealizedPnL                    | The difference between the current market value of your open positions and the average cost, or Value – Average Cost                                                                                                                                                                              |
| WarrantValue                     | Value of warrants                                                                                                                                                                                                                                                                                 |
| WhatIfPMEnabled                  | To check projected margin requirements under Portfolio Margin model                                                                                                                                                                                                                               |

### Cancel Account Updates

Once the subscription to account updates is no longer needed, it can be cancelled by invoking the IBApi.EClient.reqAccountUpdates method while specifying the susbcription flag to be False.

**Important:** only one account at a time can be subscribed at a time. Attempting a second subscription without previously cancelling an active one will not yield any error message although it will override the already subscribed account with the new one. With Financial Advisory (FA) account structures there is an alternative way of specifying the account code such that information is returned for ‘All’ sub accounts- this is done by appending the letter ‘A’ to the end of the account number, i.e. reqAccountUpdates(true, “F123456A”)

#### EClient.reqAccountUpdates (

**subscribe:** bool. Set to true to start the subscription and to false to stop it.

**acctCode:** String. The account id (i.e. U123456) for which the information is requested.

)

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
self.reqAccountUpdates(False, self.account)
```

``` EnlighterJSRAW
client.reqAccountUpdates(false, "U1234567");
```

``` EnlighterJSRAW
m_pClient->reqAccountUpdates(true, "U150462");
```

``` EnlighterJSRAW
client.reqAccountUpdates(true, "U1234567");
```

``` EnlighterJSRAW
client.reqAccountUpdates(True, "U1234567")
```

### Account Update by Model

### Requesting Account Update by Model

The IBApi.EClient.reqAccountUpdatesMulti can be used in any account structure to create simultaneous account value subscriptions from one or multiple accounts and/or models. As with IBApi.EClient.reqAccountUpdates the data returned will match that displayed within the TWS Account Window.

#### EClient.reqAccountUpdatesMulti (

**reqId:** int. Identifier to label the request

**account:** String. Account values can be requested for a particular account

**modelCode:** String. Values can also be requested for a model

**ledgerAndNLV:** bool. returns light-weight request; only currency positions as opposed to account values and currency positions

)

Requests account updates for account and/or model.

IBApi.EClient.reqAccountUpdatesMulti cannot be used with Account=”All” in IBroker accounts with more than 50 subaccounts.

A profile name can be accepted in place of group in the account parameter for [Financial Advisors](https://www.interactivebrokers.com/campus/ibkr-api-page/trader-workstation-api/#financial-advisors)

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
self.reqAccountUpdatesMulti(reqId, self.account, "", True)
```

Code example:

``` EnlighterJSRAW
from ibapi.client import *
from ibapi.wrapper import *
import time

class TradeApp(EWrapper, EClient): 
    def __init__(self): 
        EClient.__init__(self, self) 

    def accountUpdateMulti(self, reqId: int, account: str, modelCode: str, key: str, value: str, currency: str):
        print("AccountUpdateMulti. RequestId:", reqId, "Account:", account, "ModelCode:", modelCode, "Key:", key, "Value:", value, "Currency:", currency)

    def accountUpdateMultiEnd(self, reqId: int):
        print("AccountUpdateMultiEnd. RequestId:", reqId)
    
app = TradeApp()      
app.connect("127.0.0.1", 7496, clientId=1)

time.sleep(1)

app.reqAccountUpdatesMulti(103, 'U123456', "", True)

app.run()
```

``` EnlighterJSRAW
client.reqAccountUpdatesMulti(reqId, "U1234567", "", true);
```

``` EnlighterJSRAW
m_pClient->reqAccountUpdatesMulti(reqId, "U1234567", "", true);
```

``` EnlighterJSRAW
client.reqAccountUpdatesMulti(reqId, "U1234567", "", true);
```

``` EnlighterJSRAW
client.reqAccountUpdatesMulti(reqId, "U1234567", "", True)
```

### Receiving Account Updates by Model

The resulting account and portfolio information will be delivered via the IBApi.EWrapper.accountUpdateMulti and IBApi.EWrapper.accountUpdateMultiEnd

#### EWrapper.accountUpdateMulti (

**requestId:** int. The id of request.

**account:** String. The account with updates.

**modelCode:** String. The model code with updates.

**key:** String. The name of parameter.

**value:** String. The value of parameter.

**currency:** String. The currency of parameter.  
)

Provides the account updates.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
def accountUpdateMulti(self, reqId: int, account: str, modelCode: str, key: str, value: str, currency: str):
  print("AccountUpdateMulti. RequestId:", reqId, "Account:", account, "ModelCode:", modelCode, "Key:", key, "Value:", value, "Currency:", currency)
```

``` EnlighterJSRAW
@Override
public void accountUpdateMulti(int reqId, String account, String modelCode, String key, String value, String currency) {
    System.out.println("Account Update Multi: " + EWrapperMsgGenerator.accountUpdateMulti(reqId, account, modelCode, key, value, currency));
}
```

``` EnlighterJSRAW
void TestCppClient::accountUpdateMulti( int reqId, const std::string& account, const std::string& modelCode, const std::string& key, const std::string& value, const std::string& currency) {
    printf("AccountUpdate Multi. Request: %d, Account: %s, ModelCode: %s, Key, %s, Value: %s, Currency: %s\n", reqId, account.c_str(), modelCode.c_str(), key.c_str(), value.c_str(), currency.c_str());
}
```

``` EnlighterJSRAW
public virtual void accountUpdateMulti(int reqId, string account, string modelCode, string key, string value, string currency)
{
    Console.WriteLine("Account Update Multi. Request: " + reqId + ", Account: " + account + ", ModelCode: " + modelCode + ", Key: " + key + ", Value: " + value + ", Currency: " + currency + "\n");
}
```

``` EnlighterJSRAW
Public Sub accountUpdateMulti(requestId As Integer, account As String, modelCode As String, key As String, value As String, currency As String) Implements IBApi.EWrapper.accountUpdateMulti
    Console.WriteLine("accountUpdateMulti. Id: " & requestId & ", Account: " & account & ", modelCode: " & modelCode & ", key: " & key & ", value: " & value & ", currency: " & currency)
End Sub
```

#### EWrapper.accountUpdateMultiEnd (

**requestId:** int. The id of request

)

Indicates all the account updates have been transmitted.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
def accountUpdateMultiEnd(self, reqId: int):
    print("AccountUpdateMultiEnd. RequestId:", reqId)
```

``` EnlighterJSRAW
@Override
public void accountUpdateMultiEnd(int reqId, ) {
    System.out.println( "Account Update Multi End: " + EWrapperMsgGenerator.accountUpdateMultiEnd(reqId));
}
```

``` EnlighterJSRAW
void TestCppClient::accountUpdateMultiEnd( int reqId) {
    printf("Account Update Multi End. Request: %d\n", reqId);
}
```

``` EnlighterJSRAW
public virtual void accountUpdateMultiEnd(int reqId)
{
    Console.WriteLine("Account Update Multi End. Request: " + reqId + "\n");
}
```

``` EnlighterJSRAW
Public Sub accountUpdateMultiEnd(requestId As Integer) Implements IBApi.EWrapper.accountUpdateMultiEnd
    Console.WriteLine("accountUpdateMultiEnd. id: " & requestId)
End Sub
```

### Cancel Account Updates by Model

#### EClient.reqAccountUpdatesMulti (

**reqId:** int. Identifier to label the request

**account:** String. Account values can be requested for a particular account

**modelCode:** String. Values can also be requested for a model

**ledgerAndNLV:** bool. Specify false to cancel your subscription.

)

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
self.reqAccountUpdatesMulti(reqId, self.account, "", False)
```

``` EnlighterJSRAW
client.reqAccountUpdatesMulti(reqId, "U1234567", "", false);
```

``` EnlighterJSRAW
m_pClient->reqAccountUpdatesMulti(reqId, "U1234567", "", true);
```

``` EnlighterJSRAW
client.reqAccountUpdatesMulti(reqId, "U1234567", "", false);
```

``` EnlighterJSRAW
client.reqAccountUpdatesMulti(reqId, "U1234567", "", False)
```

### Family Codes

It is possible to determine from the API whether an account exists under an account family, and find the family code using the function reqFamilyCodes.

For instance, if individual account U112233 is under a financial advisor with account number F445566, if the function reqFamilyCodes is invoked for the user of account U112233, the family code “F445566A” will be returned, indicating that it belongs within that account family.

### Request Family Codes

#### EClient.reqFamilyCodes()

Requests family codes for an account, for instance if it is a FA, IBroker, or associated account.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
self.reqFamilyCodes()
```

``` EnlighterJSRAW
client.reqFamilyCodes();
```

``` EnlighterJSRAW
m_pClient->reqFamilyCodes();
```

``` EnlighterJSRAW
client.reqFamilyCodes()
```

``` EnlighterJSRAW
client.reqFamilyCodes()
```

### Receive Family Codes

#### EWrapper.familyCodes(

**familyCodes:** FamilyCodes\[\]. Unique family codes array of accountIds.

)

Returns array of family codes.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
def familyCodes(self, familyCodes: ListOfFamilyCode):
    print("Family Codes:", familyCode)
```

``` EnlighterJSRAW
@Override
public void familyCodes(FamilyCode[] familyCodes) {
    System.out.print(EWrapperMsgGenerator.familyCodes(familyCodes));
}
```

``` EnlighterJSRAW
void TestCppClient::familyCodes(const std::vector<FamilyCode> &familyCodes) {
    printf("Family codes (%lu):\n", familyCodes.size());
    for (unsigned int i = 0; i < familyCodes.size(); i++) {
        printf("Family code [%d] - accountID: %s familyCodeStr: %s\n", i, familyCodes[i].accountID.c_str(), familyCodes[i].familyCodeStr.c_str());
    }
}
```

``` EnlighterJSRAW
public void familyCodes(FamilyCode[] familyCodes)
{
  Console.WriteLine("Family Codes:");
  foreach (var familyCode in familyCodes)
  {
    Console.WriteLine("Account ID: {0}, Family Code Str: {1}", familyCode.AccountID, familyCode.FamilyCodeStr);
  }
}
```

``` EnlighterJSRAW
Public Sub familyCodes(familyCodes As FamilyCode()) Implements EWrapper.familyCodes
  Console.WriteLine("Family Codes:")
  For Each familyCode In familyCodes
    Console.WriteLine("Account ID: " & familyCode.AccountID & " Family Code Str: " & familyCode.FamilyCodeStr)
  Next
End Sub
```

### Managed Accounts

A single user name can handle more than one account. As mentioned in the [Connectivity](https://www.interactivebrokers.com/campus/ibkr-api-page/trader-workstation-api/#connectivity) section, the TWS will automatically send a list of managed accounts once the connection is established. The list can also be fetched via the IBApi.EClient.reqManagedAccts method.

### Request Managed Accounts

#### EClient.reqManagedAccts()

Requests the accounts to which the logged user has access to.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
self.reqManagedAccts()
```

``` EnlighterJSRAW
client.reqManagedAccts();
```

``` EnlighterJSRAW
m_pClient->reqManagedAccts();
```

``` EnlighterJSRAW
client.reqManagedAccts();
```

``` EnlighterJSRAW
client.reqManagedAccts()
```

### Receive Managed Accounts

#### EWrapper.managedAccounts (

**accountsList:** String. A comma-separated string with the managed account ids.

)

Returns a string of all available accounts for the logged in user. Occurs automatically on initial API client connection.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
def managedAccounts(self, accountsList: str):
    print("Account list:", accountsList)
```

``` EnlighterJSRAW
@Override
public void managedAccounts(String accountsList) {
    System.out.println("Account list: " + accountsList);
}
```

``` EnlighterJSRAW
void TestCppClient::managedAccounts( const std::string& accountsList) {
    printf( "Account List: %s\n", accountsList.c_str());
}
```

``` EnlighterJSRAW
public virtual void managedAccounts(string accountsList) 
{
    Console.WriteLine("Account list: "+accountsList);
}
```

``` EnlighterJSRAW
Public Sub managedAccounts(accountsList As String) Implements IBApi.EWrapper.managedAccounts
    Console.WriteLine("ManagedAccounts - AccountsList [" & accountsList & "]")
End Sub
```

### Positions

A limitation of the function IBApi.EClient.reqAccountUpdates is that it can only be used with a single account at a time. To create a subscription for position updates from multiple accounts, the function IBApi.EClient.reqPositions is available.

**Note:** The reqPositions function is not available in Introducing Broker or Financial Advisor master accounts that have very large numbers of subaccounts (\> 50) to optimize the performance of TWS/IB Gateway. Instead the function reqPositionsMulti can be used to subscribe to updates from individual subaccounts. Also not available with IBroker accounts configured for on-demand account lookup.

After initially invoking reqPositions, information about all positions in all associated accounts will be returned, followed by the IBApi::EWrapper::positionEnd callback. Thereafter, when a position has changed an update will be returned to the IBApi::EWrapper::position function. To cancel a reqPositions subscription, invoke IBApi::EClient::cancelPositions.

### Request Positions

#### EClient.reqPositions()

Subscribes to position updates for all accessible accounts. All positions sent initially, and then only updates as positions change.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
self.reqPositions()
```

Code example:

``` EnlighterJSRAW
from ibapi.client import *
from ibapi.wrapper import *
import threading
import time

class TradingApp(EWrapper, EClient):
    def __init__(self):
        EClient.__init__(self,self)

    def position(self, account: str, contract: Contract, position: Decimal, avgCost: float):
        print("Position.", "Account:", account, "Contract:", contract, "Position:", position, "Avg cost:", avgCost)
        
    def positionEnd(self):
       print("PositionEnd")
       
def websocket_con():
    app.run()
    
app = TradingApp()      
app.connect("127.0.0.1", 7496, clientId=1)

con_thread = threading.Thread(target=websocket_con, daemon=True)
con_thread.start()
time.sleep(1) 

app.reqPositions()
time.sleep(1)
```

``` EnlighterJSRAW
client.reqPositions();
```

``` EnlighterJSRAW
m_pClient->reqPositions();
```

``` EnlighterJSRAW
client.reqPositions();
```

``` EnlighterJSRAW
client.reqPositions()
```

### Receive Positions

#### EWrapper.position(

**account:** String. The account holding the position.

**contract:** Contract. The position’s Contract

**pos:** decimal. The number of positions held. avgCost the average cost of the position.

**avgCost:** double. The total average cost of all trades for the currently held position.  
)

Provides the portfolio’s open positions. After the initial callback (only) of all positions, the IBApi.EWrapper.positionEnd function will be triggered.

For futures, the exchange field will not be populated in the position callback as some futures trade on multiple exchanges

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
def position(self, account: str, contract: Contract, position: Decimal, avgCost: float):
  print("Position.", "Account:", account, "Contract:", contract, "Position:", position, "Avg cost:", avgCost)
```

``` EnlighterJSRAW
@Override
public void position(String account, Contract contract, Decimal pos, double avgCost) {
    System.out.println(EWrapperMsgGenerator.position(account, contract, pos, avgCost));
}
```

``` EnlighterJSRAW
@Override
public void position(String account, Contract contract, Decimal pos, double avgCost) {
    System.out.println(EWrapperMsgGenerator.position(account, contract, pos, avgCost));
}
```

``` EnlighterJSRAW
public virtual void position(string account, Contract contract, decimal pos, double avgCost)
{
Console.WriteLine("Position. " + account + " - Symbol: " + contract.Symbol + ", SecType: " + contract.SecType + ", Currency: " + contract.Currency + ", Position: " + Util.DecimalMaxString(pos) + ", Avg cost: " + Util.DoubleMaxString(avgCost));
}
```

``` EnlighterJSRAW
Public Sub position(account As String, contract As IBApi.Contract, pos As Decimal, avgCost As Double) Implements IBApi.EWrapper.position
  Console.WriteLine("Position. " & account & " - Symbol: " & contract.Symbol & ", SecType: " & contract.SecType & ", Currency: " &  contract.Currency & ", Position: " & Util.DecimalMaxString(pos) & ", Avg cost: " & Util.DoubleMaxString(avgCost))
End Sub
```

#### Ewrapper.positionEnd() 

Indicates all the positions have been transmitted. Only returned after the initial callback of EWrapper.position.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
def positionEnd(self):
  print("PositionEnd")
```

``` EnlighterJSRAW
@Override
public void positionEnd() {
    System.out.println("Position End: " + EWrapperMsgGenerator.positionEnd());
}
```

``` EnlighterJSRAW
void TestCppClient::positionEnd() {
    printf( "PositionEnd\n");
}
```

``` EnlighterJSRAW
public virtual void positionEnd()
{
    Console.WriteLine("PositionEnd \n");
}
```

``` EnlighterJSRAW
Public Sub positionEnd() Implements IBApi.EWrapper.positionEnd
    Console.WriteLine("PositionEnd")
End Sub
```

### Cancel Positions Request

#### EClient.cancelPositions()

Cancels a previous position subscription request made with EClient.reqPositions().

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
self.cancelPositions()
```

``` EnlighterJSRAW
client.cancelPositions();
```

``` EnlighterJSRAW
m_pClient->cancelPositions();
```

``` EnlighterJSRAW
client.cancelPositions()
```

``` EnlighterJSRAW
client.cancelPositions()
```

### Positions By Model

The function IBApi.EClient.reqPositionsMulti can be used with any account structure to subscribe to positions updates for multiple accounts and/or models. The account and model parameters are optional if there are not multiple accounts or models available. It is more efficient to use this function for a specific subset of accounts than using IBApi.EClient.reqPositions. A profile name can be accepted in place of group in the account parameter.

### Request Positions By Model

#### EClient.reqPositionsMulti(

**requestId:** int. Request’s identifier.

**account:** String. If an account Id is provided, only the account’s positions belonging to the specified model will be delivered.

**modelCode:** String. The code of the model’s positions we are interested in.  
)

Requests position subscription for account and/or model Initially all positions are returned, and then updates are returned for any position changes in real time.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
self.reqPositionsMulti(requestid, "U1234567", "")
```

Code example:

``` EnlighterJSRAW
from ibapi.client import *
from ibapi.wrapper import *
import threading
import time

class TradingApp(EWrapper, EClient):
    def __init__(self):
        EClient.__init__(self,self)
            
    def positionMulti(self, reqId: int, account: str, modelCode: str, contract: Contract, pos: Decimal, avgCost: float):
       print("PositionMulti. RequestId:", reqId, "Account:", account, "ModelCode:", modelCode, "Contract:", contract, ",Position:", pos, "AvgCost:", avgCost)         
        
    def positionMultiEnd(self, reqId: int):
        print("")
        print("PositionMultiEnd. RequestId:", reqId)       

def websocket_con():
    app.run()
    
app = TradingApp()      
app.connect("127.0.0.1", 7497, clientId=1)

con_thread = threading.Thread(target=websocket_con, daemon=True)
con_thread.start()
time.sleep(1) 

app.reqPositionsMulti(2, "DU1234567", "")  #To specify a U-account number
time.sleep(1)

app.reqPositionsMulti(3, "Group1", "")     #To specify a Financial Advisor Group / Profile 
time.sleep(1)
```

``` EnlighterJSRAW
client.reqPositionsMulti(requestid, "U1234567", "");
```

``` EnlighterJSRAW
m_pClient->reqPositionsMulti(requestid, "U1234567", "");
```

``` EnlighterJSRAW
client.reqPositionsMulti(requestid, "U1234567", "");
```

``` EnlighterJSRAW
client.reqPositionsMulti(requestid, "U1234567", "")
```

### Receive Positions By Model

#### EWrapper.positionMulti(

**requestId:** int. The id of request

**account:** String. The account holding the position.

**modelCode:** String. The model code holding the position.

**contract:** Contract. The position’s Contract

**pos:** decimal. The number of positions held.

**avgCost:** double. The average cost of the position.  
)

Provides the portfolio’s open positions.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
def positionMulti(self, reqId: int, account: str, modelCode: str, contract: Contract, pos: Decimal, avgCost: float):
  print("PositionMulti. RequestId:", reqId, "Account:", account, "ModelCode:", modelCode, "Contract:", contract, ",Position:", pos, "AvgCost:", avgCost)
```

``` EnlighterJSRAW
@Override
public void positionMulti(int reqId, String account, String modelCode, Contract contract, Decimal pos, double avgCost) {
    System.out.println(EWrapperMsgGenerator.positionMulti(reqId, account, modelCode, contract, pos, avgCost));
}
```

``` EnlighterJSRAW
void TestCppClient::positionMulti( int reqId, const std::string& account,const std::string& modelCode, const Contract& contract, Decimal pos, double avgCost) {
    printf("Position Multi. Request: %d, Account: %s, ModelCode: %s, Symbol: %s, SecType: %s, Currency: %s, Position: %s, Avg Cost: %s\n", reqId, account.c_str(), modelCode.c_str(), contract.symbol.c_str(), contract.secType.c_str(), contract.currency.c_str(), decimalStringToDisplay(pos).c_str(), Utils::doubleMaxString(avgCost).c_str());
}
```

``` EnlighterJSRAW
public virtual void positionMulti(int reqId, string account, string modelCode, Contract contract, decimal pos, double avgCost)
{
    Console.WriteLine("Position Multi. Request: " + reqId + ", Account: " + account + ", ModelCode: " + modelCode + ", contract: " + contract + ", Position: " + Util.DecimalMaxString(pos) + ", Avg cost: " + Util.DoubleMaxString(avgCost) + "\n");
}
```

``` EnlighterJSRAW
Public Sub positionMulti(requestId As Integer, account As String, modelCode As String, contract As Contract, pos As Decimal, avgCost As Double) Implements IBApi.EWrapper.positionMulti
    Console.WriteLine("PositionMulti. Id: " & requestId & ", Account: " & account & ", ModelCode: " & modelCode & ", Contract: " & contract.Symbol & ", pos: " & Util.DecimalMaxString(pos) & ", avgCost: " & Util.DoubleMaxString(avgCost))
End Sub
```

#### EWrapper.positionMultiEnd(

**requestId:** int. The id of request  
)

Indicates all the positions have been transmitted.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
def positionMultiEnd(self, reqId: int):
    print("PositionMultiEnd. RequestId:", reqId)
```

``` EnlighterJSRAW
@Override
public void positionMultiEnd(int reqId) {
    System.out.println("Position Multi End: " + EWrapperMsgGenerator.positionMultiEnd(reqId));
}
```

``` EnlighterJSRAW
void TestCppClient::positionMultiEnd( int reqId) {
    printf("Position Multi End. Request: %d\n", reqId);
}
```

``` EnlighterJSRAW
public virtual void positionMultiEnd(int reqId)
{
    Console.WriteLine("Position Multi End. Request: " + reqId + "\n");
}
```

``` EnlighterJSRAW
Public Sub positionMultiEnd(requestId As Integer) Implements IBApi.EWrapper.positionMultiEnd
    Console.WriteLine("PositionMultiEnd")
End Sub
```

### Cancel Positions By Model

#### EClient.cancelPositionsMulti (

**requestId:** int. The identifier of the request to be canceled.

)

Cancels positions request for account and/or model.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
self.cancelPositionsMulti(requestid)
```

``` EnlighterJSRAW
client.cancelPositionsMulti(requestid);
```

``` EnlighterJSRAW
m_pClient->cancelPositionsMulti(requestid);
```

``` EnlighterJSRAW
client.cancelPositionsMulti(requestid);
```

``` EnlighterJSRAW
client.cancelPositionsMulti(requestid)
```

### Profit & Loss (PnL)

Requests can be made to receive real time updates about the daily P\&L and unrealized P\&L for an account, or for individual positions. Financial Advisors can also request P\&L figures for ‘All’ subaccounts, or for a portfolio model. This is further extended to include realized P\&L information at the account or individual position level.

The P\&L API functions demonstrated below return the data which is displayed in the TWS Portfolio Window in current versions of TWS. As such, the P\&L values are calculated based on the reset schedule specified in TWS Global Configuration (by default an instrument-specific reset schedule) and this setting affects values sent to the associated API functions as well. Also in TWS, P\&L data from virtual forex positions will be included in the account P\&L if and only if the Virtual Fx section of the Account Window is expanded.

See [Account Updates](#account-updates) for alternative PnL data.

### Request P\&L for individual positions

Subscribe using the IBApi::EClient::reqPnLSingle function Cannot be used with IBroker accounts configured for on-demand lookup with account = ‘All’. Currently updates are returned to IBApi.EWrapper.pnlSingle approximately once per second\*.

  - If a P\&L subscription request is made for an invalid conId or contract not in the account, there will not be a response.
  - As elsewhere in the API, a max double value will indicate an ‘unset’ value. This corresponds to an empty cell in TWS.
  - Introducing broker accounts without a large number of subaccounts (\<50) can receive aggregate data by specifying the account as “All”.
  - \*Cannot be used with IBroker accounts configured for on-demand lookup with account = ‘All’

\*subject to change in the future.

#### EClient.reqPnLSingle (

**reqId:** int. Request identifier for to track the data.

**account:** String. Account in which position exists

**modelCode:** String. Model in which position exists

**conId:** int. Contract ID (conId) of contract to receive daily PnL updates for. Note: does not return message if invalid conId is entered

)

Requests real time updates for daily PnL of individual positions.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
self.reqPnLSingle(requestId, "U1234567", "", 265598)
```

Code example:

``` EnlighterJSRAW
from ibapi.client import *
from ibapi.wrapper import *
import time

class TradeApp(EWrapper, EClient): 
    def __init__(self): 
        EClient.__init__(self, self) 

    def pnlSingle(self, reqId: int, pos: Decimal, dailyPnL: float, unrealizedPnL: float, realizedPnL: float, value: float):
        print("Daily PnL Single. ReqId:", reqId, "Position:", pos, "DailyPnL:", dailyPnL, "UnrealizedPnL:", unrealizedPnL, "RealizedPnL:", realizedPnL, "Value:", value)
    
app = TradeApp()      
app.connect("127.0.0.1", 7496, clientId=1)

time.sleep(1)
app.reqPnLSingle(101, "U123456", "", 8314) #IBM conId: 8314

app.run()
```

``` EnlighterJSRAW
client.reqPnLSingle(requestId, "U1234567", "", 265598);
```

``` EnlighterJSRAW
m_pClient->reqPnLSingle(requestId, "U1234567", "", 265598);
```

``` EnlighterJSRAW
client.reqPnLSingle(requestId, "U1234567", "", 265598);
```

``` EnlighterJSRAW
client.reqPnLSingle(requestId, "U1234567", "", 265598)
```

### Receive P\&L for individual positions

#### EWrapper.pnlSingle (

**reqId:** int. Request identifier used for tracking.

**pos:** decimal. Current size of the position

**dailyPnL:** double. DailyPnL for the position

**unrealizedPnL:** double. Total unrealized PnL for the position (since inception) updating in real time

**realizedPnL:** double. Total realized PnL for the position (since inception) updating in real time

**value:** double. Current market value of the position.  
)

Receives real time updates for single position daily PnL values

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
def pnlSingle(self, reqId: int, pos: Decimal, dailyPnL: float, unrealizedPnL: float, realizedPnL: float, value: float):
  print("Daily PnL Single. ReqId:", reqId, "Position:", pos, "DailyPnL:", dailyPnL, "UnrealizedPnL:", unrealizedPnL, "RealizedPnL:", realizedPnL, "Value:", value)
```

``` EnlighterJSRAW
@Override
public void pnlSingle(int reqId, Decimal pos, double dailyPnL, double unrealizedPnL, double realizedPnL, double value) {
  System.out.println(EWrapperMsgGenerator.pnlSingle(reqId, pos, dailyPnL, unrealizedPnL, realizedPnL, value));                
}
```

``` EnlighterJSRAW
void TestCppClient::pnlSingle(int reqId, Decimal pos, double dailyPnL, double unrealizedPnL, double realizedPnL, double value) {
    printf("PnL Single. ReqId: %d, pos: %s, daily PnL: %s, unrealized PnL: %s, realized PnL: %s, value: %s\n", reqId, decimalStringToDisplay(pos).c_str(), Utils::doubleMaxString(dailyPnL).c_str(), Utils::doubleMaxString(unrealizedPnL).c_str(), Utils::doubleMaxString(realizedPnL).c_str(), Utils::doubleMaxString(value).c_str());
}
```

``` EnlighterJSRAW
public void pnlSingle(int reqId, decimal pos, double dailyPnL, double unrealizedPnL, double realizedPnL, double value)
{
    Console.WriteLine("PnL Single. Request Id: {0}, Pos {1}, Daily PnL {2}, Unrealized PnL {3}, Realized PnL: {4}, Value: {5}", reqId, Util.DecimalMaxString(pos), Util.DoubleMaxString(dailyPnL), Util.DoubleMaxString(unrealizedPnL),
        Util.DoubleMaxString(realizedPnL), Util.DoubleMaxString(value));
}
```

``` EnlighterJSRAW
Public Sub pnlSingle(reqId As Integer, pos As Decimal, dailyPnL As Double, unrealizedPnL As Double, realizedPnL As Double, value As Double) Implements EWrapper.pnlSingle
    Console.WriteLine("PnL Single. Request Id: {0}, pos: {1}, daily PnL: {2}, unrealized PnL: {3}, realized PnL: {4}, value: {5}", reqId, Util.DecimalMaxString(pos), Util.DoubleMaxString(dailyPnL), Util.DoubleMaxString(unrealizedPnL), Util.DoubleMaxString(realizedPnL), Util.DoubleMaxString(value))
End Sub
```

### Cancel P\&L request for individual positions

#### EClient.cancelPnLSingle (

**reqId:** int. Request identifier to cancel the P\&L subscription for.  
)

Cancels real time subscription for a positions daily PnL information.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
self.cancelPnLSingle(requestId);
```

``` EnlighterJSRAW
client.cancelPnLSingle(reqId);
```

``` EnlighterJSRAW
m_pClient->cancelPnLSingle(reqId);
```

``` EnlighterJSRAW
client.cancelPnLSingle(reqId);
```

``` EnlighterJSRAW
client.cancelPnLSingle(reqId);
```

### Request P\&L for accounts

Subscribe using the IBApi::EClient::reqPnL function. Updates are sent to IBApi.EWrapper.pnl.

  - Introducing broker accounts with less than 50 subaccounts can receive aggregate PnL for all subaccounts by specifying ‘All’ as the account code.
  - With requests for advisor accounts with many subaccounts and/or positions can take several seconds for aggregated P\&L to be computed and returned.
  - For account P\&L data the TWS setting “Prepare portfolio PnL data when downloading positions” must be checked.

#### EClient.reqPnL (

**reqId:** int. Request ID to track the data.

**account:** String. Account for which to receive PnL updates

**modelCode:** String. Specify to request PnL updates for a specific model.  
)

Creates subscription for real time daily PnL and unrealized PnL updates.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
self.reqPnL(reqId, "U1234567", "")
```

Code example:

``` EnlighterJSRAW
from ibapi.client import *
from ibapi.wrapper import *
import time

class TradeApp(EWrapper, EClient): 
    def __init__(self): 
        EClient.__init__(self, self) 

    def pnl(self, reqId: int, dailyPnL: float, unrealizedPnL: float, realizedPnL: float):
        print("Daily PnL. ReqId:", reqId, "DailyPnL:", dailyPnL, "UnrealizedPnL:", unrealizedPnL, "RealizedPnL:", realizedPnL)
    
app = TradeApp()      
app.connect("127.0.0.1", 7496, clientId=1)

time.sleep(1)
app.reqPnL(102, "U123456", "")

app.run()
```

``` EnlighterJSRAW
client.reqPnL(reqId, "U1234567", "");
```

``` EnlighterJSRAW
m_pClient->reqPnL(reqId, "U1234567", "");
```

``` EnlighterJSRAW
client.reqPnL(reqId, "U1234567", "");
```

``` EnlighterJSRAW
client.reqPnL(reqId, "U1234567", "")
```

### Receive P\&L for accounts

#### EWrapper.pnl (

**reqId:** int. Request identifier for tracking data.

**dailyPnL:** double. DailyPnL updates for the account in real time

**unrealizedPnL:** double. Total Unrealized PnL updates for the account in real time

**realizedPnL:** double. Total Realized PnL updates for the account in real time

)

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
def pnl(self, reqId: int, dailyPnL: float, unrealizedPnL: float, realizedPnL: float):
  print("Daily PnL. ReqId:", reqId, "DailyPnL:", dailyPnL, "UnrealizedPnL:", unrealizedPnL, "RealizedPnL:", realizedPnL)
```

``` EnlighterJSRAW
@Override
public void pnl(int reqId, double dailyPnL, double unrealizedPnL, double realizedPnL) {
    System.out.println(EWrapperMsgGenerator.pnl(reqId, dailyPnL, unrealizedPnL, realizedPnL));
}
```

``` EnlighterJSRAW
void TestCppClient::pnl(int reqId, double dailyPnL, double unrealizedPnL, double realizedPnL) {
    printf("PnL. ReqId: %d, daily PnL: %s, unrealized PnL: %s, realized PnL: %s\n", reqId, Utils::doubleMaxString(dailyPnL).c_str(), Utils::doubleMaxString(unrealizedPnL).c_str(), 
        Utils::doubleMaxString(realizedPnL).c_str());
}
```

``` EnlighterJSRAW
public void pnl(int reqId, double dailyPnL, double unrealizedPnL, double realizedPnL)
{
    Console.WriteLine("PnL. Request Id: {0}, Daily PnL: {1}, Unrealized PnL: {2}, Realized PnL: {3}", reqId, Util.DoubleMaxString(dailyPnL), Util.DoubleMaxString(unrealizedPnL), Util.DoubleMaxString(realizedPnL));
}
```

``` EnlighterJSRAW
 Public Sub pnl(reqId As Integer, dailyPnL As Double, unrealizedPnL As Double, realizedPnL As Double) Implements EWrapper.pnl
    Console.WriteLine("PnL. Request Id: {0}, daily PnL: {1}, unrealized PnL: {2}, realized PnL: {3}", reqId, Util.DoubleMaxString(dailyPnL), Util.DoubleMaxString(unrealizedPnL), Util.DoubleMaxString(realizedPnL))
End Sub
```

### Cancel P\&L subscription requests for accounts

#### EClient.cancelPnL (

**reqId:** int. Request identifier for tracking data.  
)

Cancels subscription for real time updated daily PnL params reqId

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
self.cancelPnL(reqId)
```

``` EnlighterJSRAW
client.cancelPnL(reqId);
```

``` EnlighterJSRAW
m_pClient->cancelPnL(7001);
```

``` EnlighterJSRAW
client.cancelPnL(reqId);
```

``` EnlighterJSRAW
client.cancelPnL(reqId)
```

### White Branding User Info

This function will return [White Branding ID](https://www.interactivebrokers.com/en/trading/white-branding.php) associated with the user.

Please note, that nothing will be returned if requesting username is not associated with any White Branding entity.

### Requesting White Branding Info

#### EClient.reqUserInfo(

**reqId:** int. Request ID

)

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
self.reqUserInfo(reqId)
```

``` EnlighterJSRAW
client.reqUserInfo(reqId);
```

``` EnlighterJSRAW
m_pClient->reqUserInfo(0);
```

``` EnlighterJSRAW
client.reqUserInfo(reqId);
```

``` EnlighterJSRAW
client.reqUserInfo(reqId)
```

### Receiving White Branding Info

#### EWrapper.userInfo (

**reqId:** int. Identifier for the given request.

**whiteBrandingId:** String. Identifier for the white branded entity.  
)

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
def userInfo(self, reqId: int, whiteBrandingId: str):
    print("UserInfo.", "ReqId:", reqId, "WhiteBrandingId:", whiteBrandingId)
```

``` EnlighterJSRAW
@Override
public void userInfo(int reqId, String whiteBrandingId) {
    System.out.println(EWrapperMsgGenerator.userInfo(reqId, whiteBrandingId));
}
```

``` EnlighterJSRAW
void TestCppClient::userInfo(int reqId, const std::string& whiteBrandingId) {
    printf("User Info. ReqId: %d, WhiteBrandingId: %s\n", reqId, whiteBrandingId.c_str());
}
```

``` EnlighterJSRAW
public void userInfo(int reqId, string whiteBrandingId)
{
    Console.WriteLine($"User Info. ReqId: {reqId}, WhiteBrandingId: {whiteBrandingId}");
}
```

``` EnlighterJSRAW
Public Sub userInfo(reqId As Integer, whiteBrandingId As String) Implements EWrapper.userInfo
  Console.WriteLine($"User Info. ReqId: {reqId}, WhiteBrandingId: {whiteBrandingId}")
End Sub
```

## Bulletins

From time to time, IB sends out important [News Bulletins](https://ibkrguides.com/tws/usersguidebook/realtimeactivitymonitoring/bulletins%20and%20system%20status.htm), which can be accessed via the TWS API through the EClient.reqNewsBulletins. Bulletins are delivered via IBApi.EWrapper.updateNewsBulletin whenever there is a new bulletin. In order to stop receiving bulletins you need to cancel the subscription.

### Request IB Bulletins

#### EClient.reqNewsBulletins (

**allMessages:** bool. If set to true, will return all the existing bulletins for the current day, set to false to receive only the new bulletins.  
)

Subscribes to IB’s News Bulletins.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
self.reqNewsBulletins(True)
```

``` EnlighterJSRAW
client.reqNewsBulletins(true);
```

``` EnlighterJSRAW
m_pClient->reqNewsBulletins(true);
```

``` EnlighterJSRAW
client.reqNewsBulletins(true);
```

``` EnlighterJSRAW
client.reqNewsBulletins(True)
```

### Receive IB Bulletins

#### EWrapper.updateNewsBulletin (

**msgId:** int. The bulletin’s identifier.

**msgType:** int. 1: Regular news bulletin; 2: Exchange no longer available for trading; 3: Exchange is available for trading.

**message:** String. The news bulletin context.

**origExchange:** String. The exchange where the message comes from.  
)

Provides IB’s bulletins

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
def updateNewsBulletin(self, msgId: int, msgType: int, newsMessage: str, originExch: str):
  print("News Bulletins. MsgId:", msgId, "Type:", msgType, "Message:", newsMessage, "Exchange of Origin: ", originExch)
```

``` EnlighterJSRAW
@Override
public void updateNewsBulletin(int msgId, int msgType, String message, String origExchange) {
    System.out.println("News Bulletin: " + EWrapperMsgGenerator.updateNewsBulletin( msgId, msgType, message, origExchange));
}
```

``` EnlighterJSRAW
void TestCppClient::updateNewsBulletin(int msgId, int msgType, const std::string& newsMessage, const std::string& originExch) {
    printf( "News Bulletins. %d - Type: %d, Message: %s, Exchange of Origin: %s\n", msgId, msgType, newsMessage.c_str(), originExch.c_str());
}
```

``` EnlighterJSRAW
public virtual void updateNewsBulletin(int msgId, int msgType, String message, String origExchange)
{
    Console.WriteLine("News Bulletins. "+msgId+" - Type: "+msgType+", Message: "+message+", Exchange of Origin: "+origExchange+"\n");
}
```

``` EnlighterJSRAW
Public Sub updateNewsBulletin(msgId As Integer, msgType As Integer, message As String, origExchange As String) Implements IBApi.EWrapper.updateNewsBulletin
    Console.WriteLine("News Bulletins. " & msgId & " - Type: " & msgType & ", Message: " & message & ", Exchange of Origin: " & origExchange)
End Sub
```

### Cancel Bulletin Request

#### EClient.cancelNewsBulletin ()

Cancels IB’s news bulletin subscription.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
self.cancelNewsBulletins()
```

``` EnlighterJSRAW
client.cancelNewsBulletins();
```

``` EnlighterJSRAW
m_pClient->cancelNewsBulletins();
```

``` EnlighterJSRAW
client.cancelNewsBulletin();
```

``` EnlighterJSRAW
client.cancelNewsBulletin()
```

## Contracts (Financial Instruments)

An IBApi.Contract object represents trading instruments such as a stocks, futures or options. Every time a new request that requires a contract (i.e. market data, order placing, etc.) is sent to TWS, the platform will try to match the provided contract object with a single candidate.

### The Contract Object

The Contract object is an object used throughout the TWS API to define the target of your requests. Contract objects will be used for market data, portfolios, orders, executions, and even some news request. This is the staple structure used for all of the TWS API.

In all contracts, the minimum viable structure requires at least a conId and exchange; or a symbol, secType, exchange, primaryExchange, and currency. Derivatives will require additional fields, such as lastTradeDateOrExpiration, tradingClass, multiplier, strikes, and so on.

The values to the right represent the most common Contract values to pass for complete contracts. For a more comprehensive list of contract structures, please see [the Contracts page](https://www.interactivebrokers.com/campus/ibkr-api-page/contracts/).

#### Contract()

**ConId:** int. Identifier to specify an exact contract.

**Symbol:** String. Ticker symbol of the underlying instrument.

**SecType:** String. Security type of the traded instrument.

**Exchange:** String. Exchange for which data or trades should be routed.

**PrimaryExchange:** String. Primary listing exchange of the instrument.

**Currency:** String. Base currency the instrument is traded on.

**LastTradeDateOrContractMonth:** String. For derivatives, the expiration date of the contract.

**Strike:** double. For derivatives, the strike price of the instrument.

**Right:** String. For derivatives, the right (P/C) of the instrument.

**TradingClass:** String. For derivatives, the trading class of the instrument.  
May be used to indicate between a monthly or a weekly contract.

Given additional structures for contracts are ever evolving, it is recommended to review the relevant Contract class in your programming language for a comprehensive review of what fields are available.

[Contract Class Reference](https://www.interactivebrokers.com/campus/ibkr-api-page/twsapi-ref/#contract-ref)

### Finding Contract Details in Trader Workstation

If there is more than one contract matching the same description, TWS will return an error notifying you there is an ambiguity. In these cases the TWS needs further information to narrow down the list of contracts matching the provided description to a single element.

The best way of finding a contract’s description is within TWS itself. Within TWS, you can easily check a contract’s description either by double clicking it or through the Financial Instrument Info -\> Description menu, which you access by right-clicking a contract in TWS:

The description will then appear:

Note: you can see the extended contract details by choosing Contract Info -\> Details. This option will open a web page showing all available information on the contract.

Whenever a contract description is provided via the TWS API, the TWS will try to match the given description to a single contract. This mechanism allows for great flexibility since it gives the possibility to define the same contract in multiple ways.

The simplest way to define a contract is by providing its symbol, security type, currency, exchange, and primary exchange. The vast majority of stocks, CFDs, Indexes or FX pairs can be uniquely defined through these four attributes. More complex contracts such as options and futures require some extra information due to their nature. Below are several examples for different types of instruments.

### Contract Details

Complete details about a contract in IB’s database can be retrieved using the function [IBApi.EClient.reqContractDetails](#request-contract-details). This includes information about a contract’s conID, symbol, local symbol, currency, etc. which is returned in a IBApi.ContractDetails object. reqContractDetails takes as an argument a Contract object which may uniquely match one contract, and unlike other API functions it can also take a Contract object which matches multiple contracts in IB’s database. When there are multiple matches, they will each be returned individually to the function [IBApi::EWrapper::contractDetails.](#receive-contract-details)

Request for Bond details will be returned to [IBApi::EWrapper::bondContractDetails](#receive-bond-details) instead. Because of bond market data license restrictions, there are only a few available fields to be returned in a bond contract description, namely the minTick, exchange, and short name.

Note: Invoking reqContractDetails with a Contract object which has currency = USD will only return US contracts, even if there are non-US instruments which have the USD currency.

Another function of IBApi::EClient::reqContractDetails is to request the trading schedule of an instrument via the TradingHours and LiquidHours fields. The corresponding timeZoneId field will then indicate the time zone for the trading schedule of the instrument. TWS sends these timeZoneId strings to the API from the schedule responses as-is, and may not exactly match the time zones displayed in the TWS contract description.

Possible timeZoneId values are:

  - Europe/Riga
  - Australia/NSW
  - Europe/Warsaw
  - US/Pacific
  - Europe/Tallinn
  - Japan
  - US/Eastern
  - Europe/London
  - Africa/Johannesburg
  - Israel
  - Europe/Vilnius
  - MET
  - Europe/Helsinki
  - US/Central
  - Europe/Budapest
  - Asia/Calcutta
  - Hongkong
  - Europe/Moscow
  - GMT

### Request Contract Details

#### EClient.reqContractDetails (

**reqId:** int. Request identifier to track data.

**contract:** ContractDetails. the contract used as sample to query the available contracts.  
Typically contains at least the Symbol, SecType, Exchange, and Currency.  
)

Upon requesting EClient.reqContractDetails, all contracts matching the requested [Contract Object](https://www.interactivebrokers.com/campus/ibkr-api-page/twsapi-ref/#contract-ref) will be returned to [EWrapper.contractDetails](https://www.interactivebrokers.com/campus/ibkr-api-page/twsapi-doc/#receive-contract-details) or [EWrapper.bondContractDetails](https://www.interactivebrokers.com/campus/ibkr-api-page/twsapi-doc/#receive-bond-details).

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
self.reqContractDetails(reqId, contract)
```

``` EnlighterJSRAW
client.reqContractDetails(reqId, contract)
```

``` EnlighterJSRAW
m_pClient->reqContractDetails(reqId, contract);
```

``` EnlighterJSRAW
client.reqContractDetails(reqId, contract);
```

``` EnlighterJSRAW
client.reqContractDetails(reqId, contract)
```

### Receive Contract Details

#### EWrapper.contractDetails (

**reqId:** int. Request identifier to track data.

**contract:** ContractDetails. Contains the full contract object contents including all information about a specific traded instrument.  
)

Receives the full contract’s definitions This method will return all contracts matching the requested via EClientSocket::reqContractDetails. For example, one can obtain the whole option chain with it.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
def contractDetails(self, reqId: int, contractDetails: ContractDetails):
  print(reqId, contractDetails)
```

``` EnlighterJSRAW
@Override
public void contractDetails(int reqId, ContractDetails contractDetails) {
    System.out.println(EWrapperMsgGenerator.contractDetails(reqId, contractDetails)); 
}
```

``` EnlighterJSRAW
void TestCppClient::contractDetails( int reqId, const ContractDetails& contractDetails) {
    printf( "ContractDetails. ReqId: %d\n", reqId);
    printContractDetailsMsg(contractDetails);
}
```

``` EnlighterJSRAW
public virtual void contractDetails(int reqId, ContractDetails contractDetails)
{
    Console.WriteLine("ContractDetails. ReqId: " + reqId);
    printContractDetailsMsg(contractDetails);
}
```

``` EnlighterJSRAW
Public Sub contractDetails(reqId As Integer, contractDetails As IBApi.ContractDetails) Implements IBApi.EWrapper.contractDetails
    Console.WriteLine("ContractDetails. ReqId: " & reqId)
    printContractDetailsMsg(contractDetails)
End Sub
```

#### EWrapper.contractDetailsEnd (

**reqId:** int. Request identifier to track data.  
)

After all contracts matching the request were returned, this method will mark the end of their reception.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
def contractDetailsEnd(self, reqId: int):
    print("ContractDetailsEnd. ReqId:", reqId)
```

``` EnlighterJSRAW
@Override
public void contractDetailsEnd(int reqId) {
    System.out.println("Contract Details End: " + EWrapperMsgGenerator.contractDetailsEnd(reqId));
}
```

``` EnlighterJSRAW
void TestCppClient::contractDetailsEnd( int reqId) {
    printf( "ContractDetailsEnd. %d\n", reqId);
}
```

``` EnlighterJSRAW
public virtual void contractDetailsEnd(int reqId)
{
    Console.WriteLine("ContractDetailsEnd. "+reqId+"\n");
}
```

``` EnlighterJSRAW
 Public Sub contractDetailsEnd(reqId As Integer) Implements IBApi.EWrapper.contractDetailsEnd
            Console.WriteLine("ContractDetailsEnd - ReqId [" & reqId & "]")
        End Sub
```

### Receive Bond Details

#### EWrapper.bondContractDetails (

**reqId:** int. Request identifier to track data.

**contract:** ContractDetails. Contains the full contract object contents including all information about a specific traded instrument.  
)

Delivers the Bond contract data after this has been requested via reqContractDetails.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
def bondContractDetails(self, reqId: int, contractDetails: ContractDetails):
  printinstance(reqId, contractDetails)
```

``` EnlighterJSRAW
@Override
public void bondContractDetails(int reqId, ContractDetails contractDetails) {
    System.out.println(EWrapperMsgGenerator.contractDetails(reqId, contractDetails)); 
}
```

``` EnlighterJSRAW
void TestCppClient::bondContractDetails( int reqId, const ContractDetails& contractDetails) {
    printf( "BondContractDetails. ReqId: %d\n", reqId);
    printContractDetailsMsg(contractDetails);
}
```

``` EnlighterJSRAW
public virtual void bondContractDetails(int reqId, ContractDetails contractDetails)
{
    Console.WriteLine("BondContractDetails. ReqId: " + reqId);
    printContractDetailsMsg(contractDetails);
}
```

``` EnlighterJSRAW
Public Sub bondContractDetails(reqId As Integer, contractDetails As IBApi.ContractDetails) Implements IBApi.EWrapper.contractDetails
    Console.WriteLine("BondContractDetails. ReqId: " & reqId)
    printContractDetailsMsg(contractDetails)
End Sub
```

### Option Chains

The option chain for a given security can be returned using the function [EClient.reqContractDetails](https://www.interactivebrokers.com/campus/ibkr-api-page/twsapi-doc/#request-contract-details). If an option contract is incompletely defined (for instance with the strike undefined) and used as an argument to [EClient.reqContractDetails](https://www.interactivebrokers.com/campus/ibkr-api-page/twsapi-doc/#request-contract-details), a list of all matching option contracts will be returned.

One limitation of this technique is that the return of option chains will be throttled and take a longer time the more ambiguous the contract definition. The function [EClient.reqSecDefOptParams](https://www.interactivebrokers.com/campus/ibkr-api-page/twsapi-doc/#request-opt-chain) was introduced that does not have the throttling limitation.

  - It is not recommended to use [EClient.reqContractDetails](https://www.interactivebrokers.com/campus/ibkr-api-page/twsapi-doc/#request-contract-details) to receive complete option chains on an underlying, e.g. all combinations of strikes/rights/expiries.
  - For very large option chains returned from [EClient.reqContractDetails](https://www.interactivebrokers.com/campus/ibkr-api-page/twsapi-doc/#request-contract-details), unchecking the setting in TWS Global Configuration at API -\> Settings -\> “Expose entire trading schedule to the API” will decrease the amount of data returned per option and help to return the contract list more quickly.

[EClient.reqSecDefOptParams](https://www.interactivebrokers.com/campus/ibkr-api-page/twsapi-doc/#request-opt-chain) returns a list of expiries and a list of strike prices. In some cases, it is possible there are combinations of strike and expiry that would not give a valid option contract.

### Request Option Chains

#### EClient.reqSecDefOptParams (

**reqId:** int. The ID chosen for the request

**underlyingSymbol:** String. Contract symbol of the underlying.

**futFopExchange:** String. The exchange on which the returned options are trading. Can be set to the empty string “” for all exchanges.

**underlyingSecType:** String. The type of the underlying security, i.e. STK

**underlyingConId:** int. The contract ID of the underlying security.  
)

Requests security definition option parameters for viewing a contract’s option chain.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
self.reqSecDefOptParams(0, "IBM", "", "STK", 8314)
```

``` EnlighterJSRAW
client.reqSecDefOptParams(0, "IBM", "", "STK", 8314);
```

``` EnlighterJSRAW
m_pClient->reqSecDefOptParams(0, "IBM", "", "STK", 8314);
```

``` EnlighterJSRAW
client.reqSecDefOptParams(0, "IBM", "", "STK", 8314);
```

``` EnlighterJSRAW
client.reqSecDefOptParams(0, "IBM", "", "STK", 8314)
```

### Receive Option Chains

#### EWrapper.securityDefinitionOptionParameter (

**reqId:** int. ID of the request initiating the callback.

**underlyingConId:** int. The conID of the underlying security.

**tradingClass:** String. The option trading class.

**multiplier:** String. The option multiplier.

**exchange:** String. Exchange for which the derivative is hosted.

**expirations:** HashSet. A list of the expiries for the options of this underlying on this exchange.

**strikes:** HashSet. A list of the possible strikes for options of this underlying on this exchange.  
)

Returns the option chain for an underlying on an exchange specified in reqSecDefOptParams There will be multiple callbacks to securityDefinitionOptionParameter if multiple exchanges are specified in reqSecDefOptParams

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
def securityDefinitionOptionParameter(self, reqId: int, exchange: str, underlyingConId: int, tradingClass: str, multiplier: str, expirations: SetOfString, strikes: SetOfFloat):
  print("SecurityDefinitionOptionParameter.", "ReqId:", reqId, "Exchange:", exchange, "Underlying conId:", underlyingConId, "TradingClass:", tradingClass, "Multiplier:", multiplier, "Expirations:", expirations, "Strikes:", strikes)
```

``` EnlighterJSRAW
@Override
public void securityDefinitionOptionalParameter(int reqId, String exchange, int underlyingConId, String tradingClass, String multiplier, Set expirations, Set strikes) {
    System.out.println("Security Definition Optional Parameter: " + EWrapperMsgGenerator.securityDefinitionOptionalParameter(reqId, exchange, underlyingConId, tradingClass, multiplier, expirations, strikes));
}
```

``` EnlighterJSRAW
void TestCppClient::securityDefinitionOptionalParameter(int reqId, const std::string& exchange, int underlyingConId, const std::string& tradingClass,
                                                        const std::string& multiplier, const std::set& expirations, const std::set& strikes) {
    printf("Security Definition Optional Parameter. Request: %d, Trading Class: %s, Multiplier: %s\n", reqId, tradingClass.c_str(), multiplier.c_str());
}
```

``` EnlighterJSRAW
public void securityDefinitionOptionParameter(int reqId, string exchange, int underlyingConId, string tradingClass, string multiplier, HashSet expirations, HashSet strikes)
{
    Console.WriteLine("Security Definition Option Parameter. Reqest: {0}, Exchange: {1}, Undrelying contract id: {2}, Trading class: {3}, Multiplier: {4}, Expirations: {5}, Strikes: {6}", reqId, exchange, Util.IntMaxString(underlyingConId), tradingClass, multiplier, string.Join(", ", expirations), string.Join(", ", strikes));
}
```

``` EnlighterJSRAW
Public Sub securityDefinitionOptionParameter(reqId As Integer, exchange As String, underlyingConId As Integer, tradingClass As String, multiplier As String, expirations As HashSet(Of String), strikes As HashSet(Of Double)) Implements EWrapper.securityDefinitionOptionParameter
            Console.WriteLine("securityDefinitionOptionParameter: " & reqId & " tradingClass: " & tradingClass & " multiplier: ")
End Sub
```

### Stock Symbol Search

The function IBApi::EClient::reqMatchingSymbols is available to search for stock contracts. The input can be either the first few letters of the ticker symbol, or for longer strings, a character sequence matching a word in the security name. For instance to search for the stock symbol ‘IBKR’, the input ‘I’ or ‘IB’ can be used, as well as the word ‘Interactive’. Up to 16 matching results are returned.

There must be an interval of at least 1 second between successive calls to reqMatchingSymbols

Matching stock contracts are returned to IBApi::EWrapper::symbolSamples with information about types of derivative contracts which exist (warrants, options, dutch warrants, futures).

### Request Stock Contract Search

#### EClient.reqMatchingSymbols ( 

**reqId:** int. Request identifier used to track data.

**pattern:** String. Either start of ticker symbol or (for larger strings) company name.  
)

Requests matching stock symbols.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
self.reqMatchingSymbols(reqId, "IBM")
```

``` EnlighterJSRAW
client.reqMatchingSymbols(reqId, "IB");
```

``` EnlighterJSRAW
m_pClient->reqMatchingSymbols(reqId, "IBM");
```

``` EnlighterJSRAW
client.reqMatchingSymbols(reqId, "IBM");
```

``` EnlighterJSRAW
client.reqMatchingSymbols(reqId, "IBM")
```

### Receive Searched Stock Contract

#### EWrapper.symbolSamples (

**reqID:** int. Request identifier used to track data.

**contractDescription:** ContractDescription\[\]. Provide an array of contract objects matching the requested descriptoin.  
)

Returns array of sample contract descriptions

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
def symbolSamples(self, reqId: int, contractDescriptions: ListOfContractDescription):
    print("Symbol Samples. Request Id: ", reqId)
    for contractDescription in contractDescriptions:
        derivSecTypes = ""
        for derivSecType in contractDescription.derivativeSecTypes:
            derivSecTypes += " "
            derivSecTypes += derivSecType
            print("Contract: conId:%s, symbol:%s, secType:%s primExchange:%s, "
                "currency:%s, derivativeSecTypes:%s, description:%s, issuerId:%s" % (
                contractDescription.contract.conId,
                contractDescription.contract.symbol,
                contractDescription.contract.secType,
                contractDescription.contract.primaryExchange,
                contractDescription.contract.currency, derivSecTypes,
                contractDescription.contract.description,
                contractDescription.contract.issuerId))
```

``` EnlighterJSRAW
@Override
public void symbolSamples(int reqId, ContractDescription[] contractDescriptions) {
    System.out.println(EWrapperMsgGenerator.symbolSamples(reqId, contractDescriptions));
}
```

``` EnlighterJSRAW
void TestCppClient::symbolSamples(int reqId, const std::vector &contractDescriptions) {
    printf("Symbol Samples (total=%lu) reqId: %d\n", contractDescriptions.size(), reqId);
    for (unsigned int i = 0; i < contractDescriptions.size(); i++) {
        Contract contract = contractDescriptions[i].contract;
        std::vector derivativeSecTypes = contractDescriptions[i].derivativeSecTypes;
        printf("Contract (%u): conId: %ld, symbol: %s, secType: %s, primaryExchange: %s, currency: %s, ", i, contract.conId, contract.symbol.c_str(), contract.secType.c_str(), contract.primaryExchange.c_str(), contract.currency.c_str());
        printf("Derivative Sec-types (%lu):", derivativeSecTypes.size());
        for (unsigned int j = 0; j < derivativeSecTypes.size(); j++) {
            printf(" %s", derivativeSecTypes[j].c_str());
        }
        printf(", description: %s, issuerId: %s", contract.description.c_str(), contract.issuerId.c_str());
        printf("\n");
    }
}
```

``` EnlighterJSRAW
public void symbolSamples(int reqId, ContractDescription[] contractDescriptions) 
{
    string derivSecTypes;
    Console.WriteLine("Symbol Samples. Request Id: {0}", reqId);
    foreach (var contractDescription in contractDescriptions)
    {
        derivSecTypes = "";
        foreach (var derivSecType in contractDescription.DerivativeSecTypes)
        {
            derivSecTypes += derivSecType;
            derivSecTypes += " ";
        }
        Console.WriteLine("Contract: conId - {0}, symbol - {1}, secType - {2}, primExchange - {3}, currency - {4}, derivativeSecTypes - {5}, description - {6}, issuerId - {7}", 
            contractDescription.Contract.ConId, contractDescription.Contract.Symbol, contractDescription.Contract.SecType, 
            contractDescription.Contract.PrimaryExch, contractDescription.Contract.Currency, derivSecTypes, contractDescription.Contract.Description, contractDescription.Contract.IssuerId);
    }
}
```

``` EnlighterJSRAW
Public Sub symbolSamples(reqId As Integer, contractDescriptions As ContractDescription()) Implements EWrapper.symbolSamples
    Dim derivSecTypes As String
    Console.WriteLine("Symbol Samples. Request Id: " & reqId)
    For Each contractDescription In contractDescriptions
        derivSecTypes = ""
        For Each derivSecType In contractDescription.DerivativeSecTypes
            derivSecTypes += derivSecType
            derivSecTypes += " "
        Next
        Console.WriteLine("Contract conId: " & contractDescription.Contract.ConId & ", symbol: " & contractDescription.Contract.Symbol &
                          ", secType: " & contractDescription.Contract.SecType & ", primExchange: " & contractDescription.Contract.PrimaryExch &
                          ", currency: " & contractDescription.Contract.Currency & ", derivativeSecTypes: " & derivSecTypes &
                          ", description: " & contractDescription.Contract.Description & ", issuerId: " & contractDescription.Contract.IssuerId)
    Next
End Sub
```

## Event Trading

Forecast and Event Contracts enable investors to trade their opinion on specific yes-or-no questions on economic indicators such as the Consumer Price Index and the Fed Funds Rate, climate indicators including temperatures and atmospheric CO2, key futures markets including  energy, metals, and equity indexes.

### Introduction

Interactive Brokers models Event Contract instruments on options (for ForecastEx products) and futures options (for CME Group products).

Event Contracts can generally be thought of as options products in the TWS API, and their discovery workflow follows a familiar options-like sequence. This guide will make analogies to conventional index options for both ForecastEx and CME Group products.

### ForecastEx Forecast Contracts

Forecast Contracts let you trade your view on the outcomes of various economic, government and environmental indicators, elections and tight races.

Each contract pays USD 1.00 at expiry if expiring in-the-money, and your max profit per contract is USD 1.00 minus the premium you paid to purchase the contract. Forecast Contracts are quoted in USD 0.01 increments.

ForecastEx Website: <https://forecastex.com/>

### CME Event Contracts

CME event contracts let you trade your view on whether the price of key futures markets will move up or down by the end of each day’s trading session.

Each contract pays USD 100.00 at expiry if expiring in-the-money, and your max profit per contract is USD 100.00 minus the premium you paid to purchase the contract (plus fees and commissions). CME event contracts are quoted in USD 1.00 increments.

ForecastEx Website: <https://www.cmegroup.com/activetrader/event-contracts.html>

### Contract Definition & Discovery

IB’s Event Contract instrument records use the following fields inherited from the options model:

  - An **underlier**, which may or may not be artificial:
      - For **CME products**, a tradable Event Contract will have the relevant CME future as its underlier. Therefore, the security type of the CME contract will be a futures option, or “FOP”.
      - For **ForecastEx products**, IB has generated an artificial underlying index which serves as a container for related Event Contracts in the same product class. These artificial indices do not have any associated reference values and are purely an artifact of the option instrument model used to represent these Event Contracts. However, these artificial underlying indices can be used to search for groups of related Event Contracts, just as with index options. Therefore, the security type of ForecastEx products are always options, or “OPT”.
  - An **Exchange** value will reflect the listing exchange of the given Event contract.
      - ForecastEx contracts will always use “FORECASTX” as the exchange value. Note the value does not include the final “E” in “ForecastEx”.
      - A CME product may use “CBOT”, “CME”, “COMEX”, or “NYMEX” depending on the contract’s listing.
  - A **Symbol** value which matches the symbol of the underlier, and which reflects the issuer’s product code.
  - A **Trading Class** which also reflects the issuer’s product code for the instrument, and in the case of CME Group products, is used to differentiate Event Contracts from CME futures options.
      - Note that many CME Group Event Contracts, which resolve against CME Group futures, are assigned a Trading Class prefixed with “EC” and followed by the symbol of the relevant futures product, to avoid naming collisions with other derivatives (i.e., proper futures options listed on the same future).
  - A **Put or Call (Right)** value, where Call = Yes and Put = No.
      - Note that ForecastEx instruments do not permit Sell orders. Instead, ForecastEx positions are flattened or reduced by buying the opposing contract. CME Group Event Contracts permit both buying and selling.
  - An artificial **Contract Month** value, again used primarily for searching and filtering available instruments. Most Event Contract products do not follow monthly series as is common with index or equity options, so these Contract Month values are typically not a meaningful attribute of the instrument. Rather, they permit filtering of instruments by calendar month.
      - Requesting Contract Details for a given instrument will return a “realExpirationDate”, which will correspond with the same values printed in the ForecastTrader page.
  - A **Last Trade Date, Time, and Millisecond** values, which together indicate precisely when trading in an Event Contract will cease, just as with index options.
  - A **Strike** value, which is the numerical value on which the event resolution hinges. Though numerical, this value need not represent a price.
  - An **instrument description (or “local symbol”)** in the form `"PRODUCT EXPIRATION STRIKE RIGHT"`, where:
      - `PRODUCT` is the issuer’s product identifier
      - `EXPIRATION` is the date of the instrument’s resolution in the form `MmmDD'YY`, e.g., “Sep26’24”
      - `STRIKE` is the numerical value that determines the contract’s moneyness at expiration
      - `RIGHT` is a value YES or NO

### ForecastEx Contract Example

Given the information above, we can establish a working example against the Global Carbon Dioxide Emissions contract on the [ForecastTrader Website](https://forecasttrader.interactivebrokers.com/eventtrader/#/markets).

Reviewing the page to the right, we can see all of the contract details necessary to get started.

1.  Above the chart next to the contract name, we can see the Symbol, “GCE”.
2.  On the left side of the web page, we can find the contract’s expiration date, June 30, 2026.
3.  Equally important is the value on the right, “Market closes in 287 days.”
4.  The bolded excess on the top, 40,5000, indicates our strike price. This can be corroborated by the table on the left which acts like an Option Chain table users may be more familiar with.

While not explicitly stated in the web page, there are several details that may be inferred based on the information present:

1.  All ForecastEx contracts use the “OPT” security type, as mentioned in the [Contract Definition & Discovery](https://www.interactivebrokers.com/campus/ibkr-api-page/twsapi-doc/#ec-contracts) section above.
2.  The ForecastEx exchange value is always listed as “FORECASTX”.
3.  All currently offered Event Contracts are hosted in the United States of America, and therefore will always use “USD” as their currency value.
4.  “Yes” or “No” contracts are based on option rights, “Call” and “Put” respectively.

In order to request our specific contract, we will need to focus on the “Market closes in 287 days” statement. This value indicates the last day the contract may be traded.

This document is written on the 19th of March, 2025. That is the 78th day of the calendar year.

Given the context that this is day 78, and the market will close in 287 days, the contract’s last trade date would then be the 365th day of the year, or December 31st, 2025.

Given the TWS API date standards, this will be written as 20251231.  
 

This information can now be distilled into a standard TWS API contract definition:

Symbol: “GCE”

SecType: “OPT”

Exchange: “FORECASTX”

Currency: “USD”

LastTradeDateOrContractMonth: “20251231”

Right: “C”

Strike: 40500  
 

  - Python
  - Java
  - C++
  - C\#

<!-- end list -->

``` EnlighterJSRAW
contract= Contract()
contract.symbol = "GCE"
contract.secType = "OPT"
contract.currency = "USD"
contract.exchange = "FORECASTX"
contract.lastTradeDateOrContractMonth = "20251231"
contract.right = "C"
contract.strike = 40500
```

``` EnlighterJSRAW
Contract contract = new Contract();
contract.symbol("GCE");
contract.secType("OPT");
contract.currency("USD");
contract.exchange("FORECASTX");
contract.lastTradeDateOrContractMonth("20251231");
contract.right("C");
contract.strike(40500);
```

``` EnlighterJSRAW
Contract contract;
contract.symbol = "GCE";
contract.secType = "OPT";
contract.currency = "USD";
contract.exchange = "FORECASTX";
contract.lastTradeDateOrContractMonth = "20251231";
contract.right = "C";
contract.strike = 40500;
```

``` EnlighterJSRAW
Contract contract = new Contract();
contract.Symbol = "GCE";
contract.SecType = "OPT";
contract.Currency = "USD";
contract.Exchange = "FORECASTX";
contract.LastTradeDateOrContractMonth = "20251231";
contract.Right = "C";
contract.Strike = 40500;
```

### Market Data

Requesting market data for event contracts will follow the same request structure as for any other security type.

Noted in our [Contract Definition & Discovery](https://www.interactivebrokers.com/campus/ibkr-api-page/twsapi-doc/#ec-contracts) section, ForecastEx instruments do not support buying and selling. Therefore, “BID” and “ASK” values will not correlate to buy and sell values, but the “Highest Bid” and “Buy **Yes** Now at” prices for the Bid and Ask respectively.

Because “BID” and “ASK” do not correctly directly to Buying and Selling, historical “Trades” nor real-time “Last” prices will not be available.

### Order Submission

Order Submission for Event Contracts function the same as any other instrument offered at Interactive Brokers.

There are some unique order behaviors for both CME Group and ForecastEx contracts:

  - Event Contracts only support Limit Orders
  - Event Contracts only support a Time in Force of Day, Good till Canceled, or Immediate-Or-Cancel.
  - Event Contracts do not support Cash Quantity in the TWS API. Orders must be submitted as whole-share values.
  - CME Group instruments can be bought and sold and function as normal futures options.
  - ForecastEx instruments cannot be sold, only bought. To exit or reduce a position, one must buy the opposing Event Contract, and IB will net the opposing positions together automatically.

**Event Contracts cannot be sold short.**  
 

### Order Example

Reviewing the same material as our [Contract Example](https://www.interactivebrokers.com/campus/ibkr-api-page/twsapi-doc/#ec-contract-example), we have all the tools needed to submit our order with some additional context available in the Order Ticket, featured on the right.

We are already aware that:

  - ForecastEx contracts are always “BUY” orders.
  - Event Contracts only support “LMT” as the Order Type.

This leaves us to decide the quantity, limit price, and time-in-force values.

We can set our limit price based on the values shown in the Order Ticket, or base the value on the Bid and Ask Price from our [Requested Market Data](https://www.interactivebrokers.com/campus/ibkr-api-page/twsapi-doc/#ec-market-data).  
 

Given the information above, we are able to create a full order ticket.

Action: “BUY”

TotalQuantity: 1000

OrderType: “LMT”

LmtPrice: 0.57

Tif: “DAY”

  - Python
  - Java
  - C++
  - C\#

<!-- end list -->

``` EnlighterJSRAW
order = Order()
order.action = "BUY"
order.orderType = "LMT"
order.totalQuantity = 1000
order.lmtPrice = 0.57
```

``` EnlighterJSRAW
Order order = new Order();
order.action("BUY");
order.orderType("LMT");
order.totalQuantity(1000);
order.lmtPrice(0.57);
```

``` EnlighterJSRAW
Order order;
order.action = "BUY";
order.orderType = "LMT";
order.totalQuantity = 1000;
order.lmtPrice = 0.57;
```

``` EnlighterJSRAW
Order order = new Order();
order.Action = "BUY";
order.OrderType = "LMT";
order.TotalQuantity = 1000;
order.LmtPrice = 0.57;
```

### Other Functionality

  - Event Contracts fundamentally behave like Options or Futures Options. As a result, instrument rules, position information, and instrument-specific behavior will follow the same presentation in the Trader Workstation as those other instruments.
  - Market Scanners are not currently available to research Event Contracts. Users will need to discover Event Contract symbols through [Interactive Brokers’ ForecastTrader](https://forecasttrader.interactivebrokers.com/en/home.php).

## Error Handling

When a client application sends a message to TWS which requires a response which has an expected response (i.e. placing an order, requesting market data, subscribing to account updates, etc.), TWS will almost either always 1) respond with the relevant data or 2) send an error message to [EWrapper.error()](https://www.interactivebrokers.com/campus/ibkr-api-page/twsapi-doc/#error).

  - **Exceptions when no response can occur**: Also, if a request is made prior to full establishment of connection (denoted by a returned 2104 or 2106 error code *“Data Server is Ok”*), there may not be a response from the request.

Error messages sent by the TWS are handled by the [EWrapper.error()](https://www.interactivebrokers.com/campus/ibkr-api-page/twsapi-doc/#error) method. The [EWrapper.error()](https://www.interactivebrokers.com/campus/ibkr-api-page/twsapi-doc/#error) event contains the originating request Id (or the orderId in case the error was raised when placing an order), a numeric error code and a brief description. It is important to keep in mind that this function is used for *true* error messages as well as notifications that do not mean anything is wrong.

**API Error Messages when TWS is not set to the English Language**

  - Currently on the Windows platform, error messages are sent using Latin1 encoding. If TWS is launched in a non-Western language, it is recommended to enable the setting at Global Configuration -\> API -\> Settings to “Show API error messages in English”.

### Understanding Message Codes

The TWS uses the [EWrapper.error](https://www.interactivebrokers.com/campus/ibkr-api-page/trader-workstation-api/#error) method not only to deliver errors but also warnings or informative messages. This is done mostly for simplicity’s sake. Below is a table with all the messages which can be sent by the TWS/IB Gateway. All messages delivered by the TWS are usually accompanied by a brief but meaningful description pointing in the direction of the problem.

Remember that the TWS API simply connects to a running TWS/IB Gateway which most of times will be running on your local network if not in the same host as the client application. It is your responsibility to provide reliable connectivity between the TWS and your client application.

### System Message Codes

The messages in the table below are not a consequence of any action performed by the client application. They are notifications about the connectivity status between the TWS and our servers. Your client application must pay special attention to them and handle the situation accordingly. You are very likely to lose connectivity to our servers at least once a day due to our daily server maintenance downtime as clearly detailed in our Current System Status page. Note that after the system reset, the TWS/IB Gateway will automatically reconnect to our servers and you can resume your operations normally.

**Note:**

1.  During a reset period, there may be an interruption in the ability to log in or manage orders. Existing orders (native types) will operate normally although execution reports and simulated orders will be delayed until the reset is complete. It is not recommended to operate during the scheduled reset times.

| Code | TWS message                                                                                                           | Additional notes                                                                                                                                                                |
| ---- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1100 | Connectivity between IB and the TWS has been lost.                                                                    | Your TWS/IB Gateway has been disconnected from IB servers. This can occur because of an internet connectivity issue, a nightly reset of the IB servers, or a competing session. |
| 1101 | Connectivity between IB and TWS has been restored- data lost.\*                                                       | The TWS/IB Gateway has successfully reconnected to IB’s servers. Your market data requests have been lost and need to be re-submitted.                                          |
| 1102 | Connectivity between IB and TWS has been restored- data maintained.                                                   | The TWS/IB Gateway has successfully reconnected to IB’s servers. Your market data requests have been recovered and there is no need for you to re-submit them.                  |
| 1300 | TWS socket port has been reset and this connection is being dropped. Please reconnect on the new port – \<port\_num\> | The port number in the TWS/IBG settings has been changed during an active API connection.                                                                                       |

### Error Codes

Error codes in different ranges have different indications.

<table>
<colgroup>
<col style="width: 33%" />
<col style="width: 33%" />
<col style="width: 33%" />
</colgroup>
<thead>
<tr class="header">
<th>Code</th>
<th>TWS message</th>
<th>Additional notes</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td>100</td>
<td>Max rate of messages per second has been exceeded.</td>
<td>The client application has exceeded the rate of 50 messages/second. The TWS will likely disconnect the client application after this message.</td>
</tr>
<tr class="even">
<td>101</td>
<td>Max number of tickers has been reached.</td>
<td>““The current number of active market data subscriptions in TWS and the API altogether has been exceeded. This number is calculated based on a formula which is based on the equity, commissions, and quote booster packs in an account. Active lines can be checked in Tws using the Ctrl-Alt-= combination””</td>
</tr>
<tr class="odd">
<td>102</td>
<td>Duplicate ticker ID.</td>
<td>A market data request used a ticker ID which is already in use by an active request.</td>
</tr>
<tr class="even">
<td>103</td>
<td>Duplicate order ID.</td>
<td>An order was placed with an order ID that is less than or equal to the order ID of a previous order from this client</td>
</tr>
<tr class="odd">
<td>104</td>
<td>Can’t modify a filled order.</td>
<td>An attempt was made to modify an order which has already been filled by the system.</td>
</tr>
<tr class="even">
<td>105</td>
<td>Order being modified does not match original order.</td>
<td>An order was placed with an order ID of a currently open order but basic parameters differed (aside from quantity or price fields)</td>
</tr>
<tr class="odd">
<td>106</td>
<td>Can’t transmit order ID:</td>
<td>Order ID may not be transmitted. This is most often caused by an invalid order type or order formatting.</td>
</tr>
<tr class="even">
<td>107</td>
<td>Cannot transmit incomplete order.</td>
<td>Order is missing a required field.</td>
</tr>
<tr class="odd">
<td>109</td>
<td>Price is out of the range defined by the Percentage setting at order defaults frame. The order will not be transmitted.</td>
<td>Price entered is outside the range of prices set in TWS or IB Gateway Order Precautionary Settings</td>
</tr>
<tr class="even">
<td>110</td>
<td>The price does not conform to the minimum price variation for this contract.</td>
<td>An entered price field has more digits of precision than is allowed for this particular contract. Minimum increment information can be found on the IB Contracts and Securities Search page.</td>
</tr>
<tr class="odd">
<td>111</td>
<td>The TIF (Tif type) and the order type are incompatible.</td>
<td>The time in force specified cannot be used with this order type. Please refer to order tickets in TWS for allowable combinations.</td>
</tr>
<tr class="even">
<td>113</td>
<td>The Tif option should be set to DAY for MOC and LOC orders.</td>
<td>Market-on-close or Limit-on-close orders should be sent with time in force set to ‘DAY’</td>
</tr>
<tr class="odd">
<td>114</td>
<td>Relative orders are valid for stocks only.</td>
<td>This error is deprecated.</td>
</tr>
<tr class="even">
<td>115</td>
<td>““Relative orders for US stocks can only be submitted to SMART, SMART_ECN, INSTINET, or PRIMEX.””</td>
<td>This error is deprecated.</td>
</tr>
<tr class="odd">
<td>116</td>
<td>The order cannot be transmitted to a dead exchange.</td>
<td>Exchange field is invalid.</td>
</tr>
<tr class="even">
<td>117</td>
<td>The block order size must be at least 50.</td>
<td>Caused by a block order submission using a quantity less than 50.</td>
</tr>
<tr class="odd">
<td>118</td>
<td>VWAP orders must be routed through the VWAP exchange.</td>
<td></td>
</tr>
<tr class="even">
<td>119</td>
<td>Only VWAP orders may be placed on the VWAP exchange.</td>
<td>““When an order is routed to the VWAP exchange, the type of the order must be defined as ‘VWAP’.””</td>
</tr>
<tr class="odd">
<td>120</td>
<td>It is too late to place a VWAP order for today.</td>
<td>The cutoff has passed for the current day to place VWAP orders.</td>
</tr>
<tr class="even">
<td>121</td>
<td>“Invalid BD flag for the order. Check “”Destination”” and “”BD”” flag.”</td>
<td>This error is deprecated.</td>
</tr>
<tr class="odd">
<td>122</td>
<td>No request tag has been found for order:</td>
<td>Caused when request encoding to socket improperly formed.</td>
</tr>
<tr class="even">
<td>123</td>
<td>No record is available for conid:</td>
<td>The specified contract ID cannot be found. This error is deprecated.</td>
</tr>
<tr class="odd">
<td>124</td>
<td>No market rule is available for conid:</td>
<td>Returned in the event a market rule is not applied to a given contract identifier. May be caused when interacting with a non-tradeable instrument such as an Index.</td>
</tr>
<tr class="even">
<td>125</td>
<td>Buy price must be the same as the best asking price.</td>
<td>Caused by a Buy order exceptionally above the Best Ask price. Please request market data to identify the NBO.</td>
</tr>
<tr class="odd">
<td>126</td>
<td>Sell price must be the same as the best bidding price.</td>
<td>Caused by a Sell order exceptionally below the Best Bid price. Please request market data to identify the NBB.</td>
</tr>
<tr class="even">
<td>129</td>
<td>VWAP orders must be submitted at least three minutes before the start time.</td>
<td>The start time specified in the VWAP order is less than 3 minutes after when it is placed.</td>
</tr>
<tr class="odd">
<td>131</td>
<td>““The sweep-to-fill flag and display size are only valid for US stocks routed through SMART, and will be ignored.””</td>
<td>Sweep-to-fill used on an unsupported order type.</td>
</tr>
<tr class="even">
<td>132</td>
<td>This order cannot be transmitted without a clearing account.</td>
<td>Order parameters do not include a valid clearing account.</td>
</tr>
<tr class="odd">
<td>133</td>
<td>Submit new order failed.</td>
<td>Failure in order submission. May be caused by order parameters or network connectivity.</td>
</tr>
<tr class="even">
<td>134</td>
<td>Modify order failed.</td>
<td>Unable to modify an existing order. The order may have already been executed or cancelled. Please request open orders to verify current order status.</td>
</tr>
<tr class="odd">
<td>135</td>
<td>Can’t find order with ID =</td>
<td>An attempt was made to cancel an order not currently in the system.</td>
</tr>
<tr class="even">
<td>136</td>
<td>This order cannot be cancelled.</td>
<td>““An attempt was made to cancel an order than cannot be cancelled, for instance because””</td>
</tr>
<tr class="odd">
<td>137</td>
<td>VWAP orders can only be cancelled up to three minutes before the start time.</td>
<td>VWAP order cancellation taking place within three minutes of submission.</td>
</tr>
<tr class="even">
<td>138</td>
<td>Could not parse ticker request:</td>
<td>“Ticker symbol cannot be parsed, likely due to the inclusion of invalid symbols or content.”</td>
</tr>
<tr class="odd">
<td>139</td>
<td>Parsing error:</td>
<td>Error in command syntax generated parsing error.</td>
</tr>
<tr class="even">
<td>140</td>
<td>The size value should be an integer:</td>
<td>The size field in the Order class has an invalid type.</td>
</tr>
<tr class="odd">
<td>141</td>
<td>The price value should be a double:</td>
<td>A price field in the Order type has an invalid type.</td>
</tr>
<tr class="even">
<td>142</td>
<td>Institutional customer account does not have account info</td>
<td>Institutional account structure is not including account details in order submission.</td>
</tr>
<tr class="odd">
<td>143</td>
<td>Requested ID is not an integer number.</td>
<td>The IDs used in API requests must be integer values.</td>
</tr>
<tr class="even">
<td>144</td>
<td>““Order size does not match total share allocation. To adjust the share allocation, right-click on the order and select Modify &gt; Share Allocation ””</td>
<td></td>
</tr>
<tr class="odd">
<td>145</td>
<td>Error in validating entry fields –</td>
<td>An error occurred with the syntax of a request field.</td>
</tr>
<tr class="even">
<td>146</td>
<td>Invalid trigger method.</td>
<td>The trigger method specified for a method such as stop or trail stop was not one of the allowable methods.</td>
</tr>
<tr class="odd">
<td>147</td>
<td>The conditional contract info is incomplete.</td>
<td></td>
</tr>
<tr class="even">
<td>148</td>
<td>“Conditional submission of orders is supported for Limit, Market, MidPrice, Relative and Snap order types only. Conditional cancelation of orders is supported for Limit and MidPrice order types only.”</td>
<td></td>
</tr>
<tr class="odd">
<td>151</td>
<td>This order cannot be transmitted without a user name.</td>
<td>In DDE the user name is a required field in the place order command.</td>
</tr>
<tr class="even">
<td>152</td>
<td>“The “”hidden”” order attribute may not be specified for this order.”</td>
<td>The order in question cannot be placed as a hidden order. See- https://www.interactivebrokers.com/en/index.php?f=596</td>
</tr>
<tr class="odd">
<td>153</td>
<td>EFPs can only be limit orders.</td>
<td>This error is deprecated.</td>
</tr>
<tr class="even">
<td>154</td>
<td>Orders cannot be transmitted for a halted security.</td>
<td>A security was halted for trading when an order was placed.</td>
</tr>
<tr class="odd">
<td>155</td>
<td>A sizeOp order must have a user name and account.</td>
<td>This error is deprecated.</td>
</tr>
<tr class="even">
<td>156</td>
<td>A SizeOp order must go to IBSX</td>
<td>This error is deprecated.</td>
</tr>
<tr class="odd">
<td>157</td>
<td>An order can be EITHER Iceberg or Discretionary. Please remove either the Discretionary amount or the Display size.</td>
<td>In the Order class extended attributes the fields ‘Iceberg’ and ‘Discretionary’ cannot</td>
</tr>
<tr class="even">
<td>158</td>
<td>You must specify an offset amount or a percent offset value.</td>
<td>TRAIL and TRAIL STOP orders must have an absolute offset amount or offset percentage specified.</td>
</tr>
<tr class="odd">
<td>159</td>
<td>The percent offset value must be between 0% and 100%.</td>
<td>A percent offset value was specified outside the allowable range of 0% and 100%.</td>
</tr>
<tr class="even">
<td>160</td>
<td>The size value cannot be zero.</td>
<td>The size of an order must be a positive quantity.</td>
</tr>
<tr class="odd">
<td>161</td>
<td>Cancel attempted when order is not in a cancellable state. Order permId =</td>
<td>An attempt was made to cancel an order not active at the time.</td>
</tr>
<tr class="even">
<td>162</td>
<td>Historical market data Service error message.</td>
<td></td>
</tr>
<tr class="odd">
<td>163</td>
<td>The price specified would violate the percentage constraint specified in the default order settings.</td>
<td>The order price entered is outside the allowable range specified in the Order Precautionary Settings of TWS or IB Gateway</td>
</tr>
<tr class="even">
<td>164</td>
<td>There is no market data to check price percent violations.</td>
<td>No market data is available for the specified contract to determine whether the specified price is outside the price percent precautionary order setting.</td>
</tr>
<tr class="odd">
<td>165</td>
<td>Historical market Data Service query message.</td>
<td>““There was an issue with a historical data request, such is no such data in IB’s database. Note this message is not specific to the API.””</td>
</tr>
<tr class="even">
<td>166</td>
<td>HMDS Expired Contract Violation.</td>
<td>Historical data is not available for the specified expired contract.</td>
</tr>
<tr class="odd">
<td>167</td>
<td>VWAP order time must be in the future.</td>
<td>The start time of a VWAP order has already passed.</td>
</tr>
<tr class="even">
<td>168</td>
<td>Discretionary amount does not conform to the minimum price variation for this contract.</td>
<td>The discretionary field is specified with a number of degrees of precision higher than what is allowed for a specified contract.</td>
</tr>
<tr class="odd">
<td>200</td>
<td>No security definition has been found for the request.</td>
<td>““The specified contract does not match any in IB’s database, usually because of an incorrect or missing parameter.””</td>
</tr>
<tr class="even">
<td>200</td>
<td>The contract description specified for is ambiguous</td>
<td>Ambiguity may occur when the contract definition provided is not unique.</td>
</tr>
<tr class="odd">
<td>200</td>
<td></td>
<td>““For some stocks that has the same Symbol, Currency and Exchange, you need to specify the IBApi.Contract.PrimaryExch attribute to avoid ambiguity. Please refer to a sample stock contract here.””</td>
</tr>
<tr class="even">
<td>200</td>
<td></td>
<td>““For futures that has multiple multipliers for the same expiration, You need to specify the IBApi.Contract.Multiplier attribute to avoid ambiguity. Please refer to a sample futures contract here.””</td>
</tr>
<tr class="odd">
<td>201</td>
<td>Order rejected – Reason:</td>
<td>An attempted order was rejected by the IB servers. See Order Placement Considerations for additional information/considerations for these errors.</td>
</tr>
<tr class="even">
<td>202</td>
<td>Order cancelled – Reason:</td>
<td>An active order on the IB server was cancelled. See Order Placement Considerations for additional information/considerations for these errors.</td>
</tr>
<tr class="odd">
<td>203</td>
<td>The security is not available or allowed for this account.</td>
<td>The specified security has a trading restriction with a specific account.</td>
</tr>
<tr class="even">
<td>203</td>
<td>The contract description specified for %S is ambiguous; you must specify the currency.</td>
<td>The contract definition is incomplete. The currency must be included.</td>
</tr>
<tr class="odd">
<td>300</td>
<td>Can’t find EId with ticker Id:</td>
<td>An attempt was made to cancel market data for a ticker ID that was not associated with a current subscription. With the DDE API this occurs by clearing the spreadsheet cell.</td>
</tr>
<tr class="even">
<td>301</td>
<td>Invalid ticker action:</td>
<td></td>
</tr>
<tr class="odd">
<td>302</td>
<td>Error parsing stop ticker string:</td>
<td></td>
</tr>
<tr class="even">
<td>303</td>
<td>Invalid action:</td>
<td>An action field was specified that is not available for the account. For most accounts this is only BUY or SELL. Some institutional accounts also have the options SSHORT or SLONG available.</td>
</tr>
<tr class="odd">
<td>304</td>
<td>Invalid account value action:</td>
<td></td>
</tr>
<tr class="even">
<td>305</td>
<td>““Request parsing error, the request has been ignored.””</td>
<td>The syntax of a DDE request is invalid.</td>
</tr>
<tr class="odd">
<td>306</td>
<td>Error processing DDE request:</td>
<td>An issue with a DDE request prevented it from processing.</td>
</tr>
<tr class="even">
<td>307</td>
<td>Invalid request topic:</td>
<td>The ‘topic’ field in a DDE request is invalid.</td>
</tr>
<tr class="odd">
<td>308</td>
<td>Unable to create the ‘API’ page in TWS as the maximum number of pages already exists.</td>
<td>““An order placed from the API will automatically open a new page in classic TWS, however there are already the maximum number of pages open.””</td>
</tr>
<tr class="even">
<td>309</td>
<td>““Max number (3) of market depth requests has been reached. Note: TWS currently limits users to a maximum of 3 distinct market depth requests. This same restriction applies to API clients, however API clients may make multiple market depth requests for the same security.””</td>
<td>“Maximum market depth requests exceeded. Please see our <span>Market Data Line Documentation</span> for more information.”</td>
</tr>
<tr class="odd">
<td>310</td>
<td>Can’t find the subscribed market depth with tickerId:</td>
<td>An attempt was made to cancel market depth for a ticker not currently active.</td>
</tr>
<tr class="even">
<td>311</td>
<td>The origin is invalid.</td>
<td>The origin field specified in the Order class is invalid.</td>
</tr>
<tr class="odd">
<td>312</td>
<td>The combo details are invalid.</td>
<td>Combination contract specified has invalid parameters.</td>
</tr>
<tr class="even">
<td>313</td>
<td>The combo details for leg ” are invalid.</td>
<td>A combo leg was not defined correctly.</td>
</tr>
<tr class="odd">
<td>314</td>
<td>Security type ‘BAG’ requires combo leg details.</td>
<td>When specifying security type as ‘BAG’ make sure to also add combo legs with details.</td>
</tr>
<tr class="even">
<td>315</td>
<td>Stock combo legs are restricted to SMART order routing.</td>
<td>Make sure to specify ‘SMART’ as an exchange when using stock combo contracts.</td>
</tr>
<tr class="odd">
<td>316</td>
<td>Market depth data has been HALTED. Please re-subscribe.</td>
<td>You need to re-subscribe to start receiving market depth data again.</td>
</tr>
<tr class="even">
<td>317</td>
<td>Market depth data has been RESET. Please empty deep book contents before applying any new entries.</td>
<td></td>
</tr>
<tr class="odd">
<td>319</td>
<td>Invalid log level</td>
<td>Make sure that you are setting a log level to a value in range of 1 to 5.</td>
</tr>
<tr class="even">
<td>320</td>
<td>Server error when reading an API client request.</td>
<td></td>
</tr>
<tr class="odd">
<td>321</td>
<td>Server error when validating an API client request.</td>
<td></td>
</tr>
<tr class="even">
<td>322</td>
<td>Server error when processing an API client request.</td>
<td></td>
</tr>
<tr class="odd">
<td>323</td>
<td>Server error: cause – s</td>
<td></td>
</tr>
<tr class="even">
<td>324</td>
<td>Server error when reading a DDE client request (missing information).</td>
<td>Make sure that you have specified all the needed information for your request.</td>
</tr>
<tr class="odd">
<td>325</td>
<td>Discretionary orders are not supported for this combination of exchange and order type.</td>
<td>Make sure that you are specifying a valid combination of exchange and order type for the discretionary order.</td>
</tr>
<tr class="even">
<td>326</td>
<td>Unable to connect as the client id is already in use. Retry with a unique client id.</td>
<td>Another client application is already connected with the specified client id.</td>
</tr>
<tr class="odd">
<td>327</td>
<td>Only API connections with clientId set to 0 can set the auto bind TWS orders property.</td>
<td></td>
</tr>
<tr class="even">
<td>328</td>
<td>Trailing stop orders can be attached to limit or stop-limit orders only.</td>
<td>Indicates attempt to attach trail stop to order which was not a limit or stop-limit.</td>
</tr>
<tr class="odd">
<td>329</td>
<td>Order modify failed. Cannot change to the new order type.</td>
<td>You are not allowed to modify initial order type to the specific order type you are using.</td>
</tr>
<tr class="even">
<td>330</td>
<td>Only FA or STL customers can request managed accounts list.</td>
<td>Make sure that your account type is either FA or STL.</td>
</tr>
<tr class="odd">
<td>331</td>
<td>Internal error. FA or STL does not have any managed accounts.</td>
<td>You do not have any managed accounts.</td>
</tr>
<tr class="even">
<td>332</td>
<td>The account codes for the order profile are invalid.</td>
<td>You need to check that the account codes you specified for your request are valid.</td>
</tr>
<tr class="odd">
<td>333</td>
<td>Invalid share allocation syntax.</td>
<td></td>
</tr>
<tr class="even">
<td>334</td>
<td>Invalid Good Till Date order</td>
<td>Check you order settings.</td>
</tr>
<tr class="odd">
<td>335</td>
<td>Invalid delta: The delta must be between 0 and 100.</td>
<td></td>
</tr>
<tr class="even">
<td>336</td>
<td>““The time or time zone is invalid. The correct format is hh:mm:ss xxx where xxx is an optionally specified time-zone. E.g.: 15:59:00 EST Note that there is a space between the time and the time zone. If no time zone is specified, local time is assumed.””</td>
<td></td>
</tr>
<tr class="odd">
<td>337</td>
<td>““The date, time, or time-zone entered is invalid. The correct format is yyyymmdd hh:mm:ss xxx where yyyymmdd and xxx are optional. E.g.: 20031126 15:59:00 ESTNote that there is a space between the date and time, and between the time and time-zone.””</td>
<td></td>
</tr>
<tr class="even">
<td>338</td>
<td>Good After Time orders are currently disabled on this exchange.</td>
<td></td>
</tr>
<tr class="odd">
<td>339</td>
<td>Futures spread are no longer supported. Please use combos instead.</td>
<td></td>
</tr>
<tr class="even">
<td>340</td>
<td>Invalid improvement amount for box auction strategy.</td>
<td></td>
</tr>
<tr class="odd">
<td>341</td>
<td>“Invalid delta. Valid values are from 1 to 100. You can set the delta from the “Pegged to Stock” section of the Order Ticket Panel, or by selecting Page/Layout from the main menu and adding the Delta column.”</td>
<td></td>
</tr>
<tr class="even">
<td>342</td>
<td>Pegged order is not supported on this exchange.</td>
<td>You can review all order types and supported exchanges on the Order Types and Algos page.</td>
</tr>
<tr class="odd">
<td>343</td>
<td>““The date, time, or time-zone entered is invalid. The correct format is yyyymmdd hh:mm:ss xxx””</td>
<td></td>
</tr>
<tr class="even">
<td>344</td>
<td>The account logged into is not a financial advisor account.</td>
<td>You are trying to perform an action that is only available for the financial advisor account.</td>
</tr>
<tr class="odd">
<td>345</td>
<td>Generic combo is not supported for FA advisor account.</td>
<td></td>
</tr>
<tr class="even">
<td>346</td>
<td>Not an institutional account or an away clearing account.</td>
<td></td>
</tr>
<tr class="odd">
<td>347</td>
<td>Short sale slot value must be 1 (broker holds shares) or 2 (delivered from elsewhere).</td>
<td>Make sure that your slot value is either 1 or 2.</td>
</tr>
<tr class="even">
<td>348</td>
<td>Order not a short sale – type must be SSHORT to specify short sale slot.</td>
<td>Make sure that the action you specified is ‘SSHORT’.</td>
</tr>
<tr class="odd">
<td>349</td>
<td>“Generic combo does not support “”Good After”” attribute.”</td>
<td></td>
</tr>
<tr class="even">
<td>350</td>
<td>Minimum quantity is not supported for best combo order.</td>
<td></td>
</tr>
<tr class="odd">
<td>351</td>
<td>“The “”Regular Trading Hours only”” flag is not valid for this order.”</td>
<td></td>
</tr>
<tr class="even">
<td>352</td>
<td>Short sale slot value of 2 (delivered from elsewhere) requires location.</td>
<td>You need to specify designatedLocation for your order.</td>
</tr>
<tr class="odd">
<td>353</td>
<td>Short sale slot value of 1 requires no location be specified.</td>
<td>You do not need to specify designatedLocation for your order.</td>
</tr>
<tr class="even">
<td>354</td>
<td>Requested market data is not subscribed. Check API status by selecting the Account menu then under Management choose Market Data Subscription Manager and/or availability of delayed data.</td>
<td>You do not have live market data available in your account for the specified instruments. For further details please refer to our <a href="/campus/ibkr-api-page/market-data-subscriptions/">Market Data Subscriptions page</a>.</td>
</tr>
<tr class="odd">
<td>355</td>
<td>Order size does not conform to market rule.</td>
<td>Check order size parameters for the specified contract from the TWS Contract Details.</td>
</tr>
<tr class="even">
<td>356</td>
<td>Smart-combo order does not support OCA group.</td>
<td>Remove OCA group from your order.</td>
</tr>
<tr class="odd">
<td>357</td>
<td>Your client version is out of date.</td>
<td></td>
</tr>
<tr class="even">
<td>358</td>
<td>Smart combo child order not supported.</td>
<td></td>
</tr>
<tr class="odd">
<td>359</td>
<td>Combo order only supports reduce on fill without block(OCA).</td>
<td></td>
</tr>
<tr class="even">
<td>360</td>
<td>No whatif check support for smart combo order.</td>
<td>Pre-trade commissions and margin information is not available for this type of order.</td>
</tr>
<tr class="odd">
<td>361</td>
<td>Invalid trigger price.</td>
<td></td>
</tr>
<tr class="even">
<td>362</td>
<td>Invalid adjusted stop price.</td>
<td></td>
</tr>
<tr class="odd">
<td>363</td>
<td>Invalid adjusted stop limit price.</td>
<td></td>
</tr>
<tr class="even">
<td>364</td>
<td>Invalid adjusted trailing amount.</td>
<td></td>
</tr>
<tr class="odd">
<td>365</td>
<td>No scanner subscription found for ticker id:</td>
<td>Scanner market data subscription request with this ticker id has either been cancelled or is not found.</td>
</tr>
<tr class="even">
<td>366</td>
<td>No historical data query found for ticker id:</td>
<td>Historical market data request with this ticker id has either been cancelled or is not found.</td>
</tr>
<tr class="odd">
<td>367</td>
<td>Volatility type if set must be 1 or 2 for VOL orders. Do not set it for other order types.</td>
<td></td>
</tr>
<tr class="even">
<td>368</td>
<td>Reference Price Type must be 1 or 2 for dynamic volatility management. Do not set it for non-VOL orders.</td>
<td></td>
</tr>
<tr class="odd">
<td>369</td>
<td>Volatility orders are only valid for US options.</td>
<td>Make sure that you are placing an order for US OPT contract.</td>
</tr>
<tr class="even">
<td>370</td>
<td>““Dynamic Volatility orders must be SMART routed, or trade on a Price Improvement Exchange.””</td>
<td></td>
</tr>
<tr class="odd">
<td>371</td>
<td>VOL order requires positive floating point value for volatility. Do not set it for other order types.</td>
<td></td>
</tr>
<tr class="even">
<td>372</td>
<td>Cannot set dynamic VOL attribute on non-VOL order.</td>
<td>Make sure that your order type is ‘VOL’.</td>
</tr>
<tr class="odd">
<td>373</td>
<td>Can only set stock range attribute on VOL or RELATIVE TO STOCK order.</td>
<td></td>
</tr>
<tr class="even">
<td>374</td>
<td>““If both are set, the lower stock range attribute must be less than the upper stock range attribute.””</td>
<td></td>
</tr>
<tr class="odd">
<td>375</td>
<td>Stock range attributes cannot be negative.</td>
<td></td>
</tr>
<tr class="even">
<td>376</td>
<td>The order is not eligible for continuous update. The option must trade on a cheap-to-reroute exchange.</td>
<td></td>
</tr>
<tr class="odd">
<td>377</td>
<td>Must specify valid delta hedge order aux. price.</td>
<td></td>
</tr>
<tr class="even">
<td>378</td>
<td>Delta hedge order type requires delta hedge aux. price to be specified.</td>
<td>Make sure your order has delta attribute.</td>
</tr>
<tr class="odd">
<td>379</td>
<td>Delta hedge order type requires that no delta hedge aux. price be specified.</td>
<td>Make sure you do not specify aux. delta hedge price.</td>
</tr>
<tr class="even">
<td>380</td>
<td>This order type is not allowed for delta hedge orders.</td>
<td>““Limit, Market or Relative orders are supported.””</td>
</tr>
<tr class="odd">
<td>381</td>
<td>Your DDE.dll needs to be upgraded.</td>
<td></td>
</tr>
<tr class="even">
<td>382</td>
<td>The price specified violates the number of ticks constraint specified in the default order settings.</td>
<td></td>
</tr>
<tr class="odd">
<td>383</td>
<td>The size specified violates the size constraint specified in the default order settings.</td>
<td></td>
</tr>
<tr class="even">
<td>384</td>
<td>Invalid DDE array request.</td>
<td></td>
</tr>
<tr class="odd">
<td>385</td>
<td>Duplicate ticker ID for API scanner subscription.</td>
<td>Make sure you are using a unique ticker ID for your new scanner subscription.</td>
</tr>
<tr class="even">
<td>386</td>
<td>Duplicate ticker ID for API historical data query.</td>
<td>Make sure you are using a unique ticker ID for your new historical market data query.</td>
</tr>
<tr class="odd">
<td>387</td>
<td>Unsupported order type for this exchange and security type.</td>
<td>You can review all order types and supported exchanges on the Order Types and Algos page.</td>
</tr>
<tr class="even">
<td>388</td>
<td>Order size is smaller than the minimum requirement.</td>
<td>Check order size parameters for the specified contract from the TWS Contract Details.</td>
</tr>
<tr class="odd">
<td>389</td>
<td>Supplied routed order ID is not unique.</td>
<td></td>
</tr>
<tr class="even">
<td>390</td>
<td>Supplied routed order ID is invalid.</td>
<td></td>
</tr>
<tr class="odd">
<td>391</td>
<td>The time or time-zone entered is invalid. The correct format is hh:mm:ss xxx</td>
<td></td>
</tr>
<tr class="even">
<td>392</td>
<td>Invalid order: contract expired.</td>
<td>You can not place an order for the expired contract.</td>
</tr>
<tr class="odd">
<td>393</td>
<td>Short sale slot may be specified for delta hedge orders only.</td>
<td></td>
</tr>
<tr class="even">
<td>394</td>
<td>Invalid Process Time: must be integer number of milliseconds between 100 and 2000. Found:</td>
<td></td>
</tr>
<tr class="odd">
<td>395</td>
<td>““Due to system problems, orders with OCA groups are currently not being accepted.””</td>
<td>Check TWS bulletins for more information.</td>
</tr>
<tr class="even">
<td>396</td>
<td>““Due to system problems, application is currently accepting only Market and Limit orders for this contract.””</td>
<td>Check TWS bulletins for more information.</td>
</tr>
<tr class="odd">
<td>397</td>
<td>““Due to system problems, application is currently accepting only Market and Limit orders for this contract.””</td>
<td></td>
</tr>
<tr class="even">
<td>398</td>
<td>cannot be used as a condition trigger.</td>
<td>Please make sure that you specify a valid condition</td>
</tr>
<tr class="odd">
<td>399</td>
<td>Order message error</td>
<td></td>
</tr>
<tr class="even">
<td>400</td>
<td>Algo order error.</td>
<td></td>
</tr>
<tr class="odd">
<td>401</td>
<td>Length restriction.</td>
<td></td>
</tr>
<tr class="even">
<td>402</td>
<td>Conditions are not allowed for this contract.</td>
<td>Condition order type does not support for this contract</td>
</tr>
<tr class="odd">
<td>403</td>
<td>Invalid stop price.</td>
<td>The Stop Price you specified for the order is invalid for the contract</td>
</tr>
<tr class="even">
<td>404</td>
<td>Shares for this order are not immediately available for short sale. The order will be held while we attempt to locate the shares.</td>
<td>You order is held by the TWS because you are trying to sell a contract but you do not have any long position and the market does not have short sale available. You order will be transmitted once there is short sale available on the market</td>
</tr>
<tr class="odd">
<td>405</td>
<td>The child order quantity should be equivalent to the parent order size.</td>
<td>This error is deprecated.</td>
</tr>
<tr class="even">
<td>406</td>
<td>The currency is not allowed.</td>
<td>Please specify a valid currency</td>
</tr>
<tr class="odd">
<td>407</td>
<td>The symbol should contain valid non-unicode characters only.</td>
<td>Please check your contract Symbol</td>
</tr>
<tr class="even">
<td>408</td>
<td>Invalid scale order increment.</td>
<td></td>
</tr>
<tr class="odd">
<td>409</td>
<td>Invalid scale order. You must specify order component size.</td>
<td>ScaleInitLevelSize specified is invalid</td>
</tr>
<tr class="even">
<td>410</td>
<td>Invalid subsequent component size for scale order.</td>
<td>ScaleSubsLevelSize specified is invalid</td>
</tr>
<tr class="odd">
<td>411</td>
<td>“The “”Outside Regular Trading Hours”” flag is not valid for this order.”</td>
<td>Trading outside of regular trading hours is not available for this security</td>
</tr>
<tr class="even">
<td>412</td>
<td>The contract is not available for trading.</td>
<td></td>
</tr>
<tr class="odd">
<td>413</td>
<td>What-if order should have the transmit flag set to true.</td>
<td>You need to set IBApi.Order.Transmit to TRUE</td>
</tr>
<tr class="even">
<td>414</td>
<td>Snapshot market data subscription is not applicable to generic ticks.</td>
<td>You must leave Generic Tick List to be empty when requesting snapshot market data</td>
</tr>
<tr class="odd">
<td>415</td>
<td>Wait until previous RFQ finishes and try again.</td>
<td></td>
</tr>
<tr class="even">
<td>416</td>
<td>RFQ is not applicable for the contract. Order ID:</td>
<td></td>
</tr>
<tr class="odd">
<td>417</td>
<td>Invalid initial component size for scale order.</td>
<td>ScaleInitLevelSize specified is invalid</td>
</tr>
<tr class="even">
<td>418</td>
<td>Invalid scale order profit offset.</td>
<td>ScaleProfitOffset specified is invalid</td>
</tr>
<tr class="odd">
<td>419</td>
<td>Missing initial component size for scale order.</td>
<td>You need to specify the ScaleInitLevelSize</td>
</tr>
<tr class="even">
<td>420</td>
<td>Invalid real-time query.</td>
<td>Information about pacing violations</td>
</tr>
<tr class="odd">
<td>421</td>
<td>Invalid route.</td>
<td>This error is deprecated.</td>
</tr>
<tr class="even">
<td>422</td>
<td>The account and clearing attributes on this order may not be changed.</td>
<td></td>
</tr>
<tr class="odd">
<td>423</td>
<td>Cross order RFQ has been expired. THI committed size is no longer available. Please open order dialog and verify liquidity allocation.</td>
<td></td>
</tr>
<tr class="even">
<td>424</td>
<td>FA Order requires allocation to be specified.</td>
<td>This error is deprecated.</td>
</tr>
<tr class="odd">
<td>425</td>
<td>FA Order requires per-account manual allocations because there is no common clearing instruction. Please use order dialog Adviser tab to enter the allocation.</td>
<td>This error is deprecated.</td>
</tr>
<tr class="even">
<td>426</td>
<td>None of the accounts have enough shares.</td>
<td>You are not able to enter short position with Cash Account</td>
</tr>
<tr class="odd">
<td>427</td>
<td>Mutual Fund order requires monetary value to be specified.</td>
<td>This error is deprecated.</td>
</tr>
<tr class="even">
<td>428</td>
<td>Mutual Fund Sell order requires shares to be specified.</td>
<td>This error is deprecated.</td>
</tr>
<tr class="odd">
<td>429</td>
<td>Delta neutral orders are only supported for combos (BAG security type).</td>
<td></td>
</tr>
<tr class="even">
<td>430</td>
<td>““We are sorry, but fundamentals data for the security specified is not available.””</td>
<td></td>
</tr>
<tr class="odd">
<td>431</td>
<td>What to show field is missing or incorrect.</td>
<td>This error is deprecated.</td>
</tr>
<tr class="even">
<td>432</td>
<td>Commission must not be negative.</td>
<td>This error is deprecated.</td>
</tr>
<tr class="odd">
<td>433</td>
<td>“Invalid “”Restore size after taking profit”” for multiple account allocation scale order.”</td>
<td></td>
</tr>
<tr class="even">
<td>434</td>
<td>The order size cannot be zero.</td>
<td></td>
</tr>
<tr class="odd">
<td>435</td>
<td>You must specify an account.</td>
<td>The function you invoked only works on a single account</td>
</tr>
<tr class="even">
<td>436</td>
<td>““You must specify an allocation (either a single account, group, or profile).””</td>
<td>““When you try to place an order with a Financial Advisor account, you must specify the order to be routed to either a single account, a group, or a profile.””</td>
</tr>
<tr class="odd">
<td>437</td>
<td>Order can have only one flag Outside RTH or Allow PreOpen.</td>
<td>This error is deprecated.</td>
</tr>
<tr class="even">
<td>438</td>
<td>The application is now locked.</td>
<td>This error is deprecated.</td>
</tr>
<tr class="odd">
<td>439</td>
<td>Order processing failed. Algorithm definition not found.</td>
<td>Please double check your specification for IBApi.Order.AlgoStrategy and IBApi.Order.AlgoParams</td>
</tr>
<tr class="even">
<td>440</td>
<td>Order modify failed. Algorithm cannot be modified.</td>
<td></td>
</tr>
<tr class="odd">
<td>441</td>
<td>Algo attributes validation failed:</td>
<td>Please double check your specification for IBApi.Order.AlgoStrategy and IBApi.Order.AlgoParams</td>
</tr>
<tr class="even">
<td>442</td>
<td>Specified algorithm is not allowed for this order.</td>
<td></td>
</tr>
<tr class="odd">
<td>443</td>
<td>Order processing failed. Unknown algo attribute.</td>
<td>Specification for IBApi.Order.AlgoParams is incorrect</td>
</tr>
<tr class="even">
<td>444</td>
<td>Volatility Combo order is not yet acknowledged. Cannot submit changes at this time.</td>
<td>The order is not in a state that is able to be modified</td>
</tr>
<tr class="odd">
<td>445</td>
<td>The RFQ for this order is no longer valid.</td>
<td></td>
</tr>
<tr class="even">
<td>446</td>
<td>Missing scale order profit offset.</td>
<td>ScaleProfitOffset is not properly specified</td>
</tr>
<tr class="odd">
<td>447</td>
<td>Missing scale price adjustment amount or interval.</td>
<td>ScalePriceAdjustValue or ScalePriceAdjustInterval is not specified properly</td>
</tr>
<tr class="even">
<td>448</td>
<td>Invalid scale price adjustment interval.</td>
<td>ScalePriceAdjustInterval specified is invalid</td>
</tr>
<tr class="odd">
<td>449</td>
<td>Unexpected scale price adjustment amount or interval.</td>
<td>ScalePriceAdjustValue or ScalePriceAdjustInterval specified is invalid</td>
</tr>
<tr class="even">
<td>481</td>
<td>Order size reduced.</td>
<td></td>
</tr>
<tr class="odd">
<td>501</td>
<td>Already Connected.</td>
<td>Your client application is already connected to the TWS.</td>
</tr>
<tr class="even">
<td>502</td>
<td>“Couldn’t connect to TWS. Confirm that “”Enable ActiveX and Socket Clients”” is enabled and connection port is the same as “”Socket Port”” on the TWS “”Edit-&gt;Global Configuration…-&gt;API-&gt;Settings”” menu.”</td>
<td>When you receive this error message it is either because you have not enabled API connectivity in the TWS and/or you are trying to connect on the wrong port. Refer to the TWS’ API Settings as explained in the error message. See also Connectivity</td>
</tr>
<tr class="odd">
<td>503</td>
<td>The TWS is out of date and must be upgraded.</td>
<td>Indicates TWS or IBG is too old for use with the current API version. Can also be triggered if the TWS version does not support a specific API function.</td>
</tr>
<tr class="even">
<td>504</td>
<td>Not connected.</td>
<td>You are trying to perform a request without properly connecting and/or after connection to the TWS has been broken probably due to an unhandled exception within your client application.</td>
</tr>
<tr class="odd">
<td>505</td>
<td>Fatal Error: Unknown message id.</td>
<td></td>
</tr>
<tr class="even">
<td>506</td>
<td>Unsupported Version (not used in Python client)</td>
<td></td>
</tr>
<tr class="odd">
<td>507</td>
<td>Bad Message Length (Java-only)</td>
<td>““Indicates EOF exception was caught while reading from the socket. This can occur if there is an attempt to connect to TWS with a client ID that is already in use, or if TWS is locked, closes, or breaks the connection. It should be handled by the client application and used to indicate that the socket connection is not valid.””</td>
</tr>
<tr class="even">
<td>508</td>
<td>Bad Message</td>
<td></td>
</tr>
<tr class="odd">
<td>509</td>
<td>Exception caught while reading socket</td>
<td>(not used in Python C# client)</td>
</tr>
<tr class="even">
<td>510</td>
<td>Request Market Data Sending Error –</td>
<td></td>
</tr>
<tr class="odd">
<td>511</td>
<td>Cancel Market Data Sending Error –</td>
<td></td>
</tr>
<tr class="even">
<td>512</td>
<td>Order Sending Error –</td>
<td></td>
</tr>
<tr class="odd">
<td>513</td>
<td>Account Update Request Sending Error –</td>
<td></td>
</tr>
<tr class="even">
<td>514</td>
<td>Request For Executions Sending Error –</td>
<td></td>
</tr>
<tr class="odd">
<td>515</td>
<td>Cancel Order Sending Error –</td>
<td></td>
</tr>
<tr class="even">
<td>516</td>
<td>Request Open Order Sending Error –</td>
<td></td>
</tr>
<tr class="odd">
<td>517</td>
<td>Unknown contract. Verify the contract details supplied. (not used in Python C# client)</td>
<td></td>
</tr>
<tr class="even">
<td>518</td>
<td>Request Contract Data Sending Error –</td>
<td></td>
</tr>
<tr class="odd">
<td>519</td>
<td>Request Market Depth Sending Error –</td>
<td></td>
</tr>
<tr class="even">
<td>520</td>
<td>Failed to create socket (not used in C# client)</td>
<td></td>
</tr>
<tr class="odd">
<td>521</td>
<td>Set Server Log Level Sending Error –</td>
<td></td>
</tr>
<tr class="even">
<td>522</td>
<td>FA Information Request Sending Error –</td>
<td></td>
</tr>
<tr class="odd">
<td>523</td>
<td>FA Information Replace Sending Error –</td>
<td></td>
</tr>
<tr class="even">
<td>524</td>
<td>Request Scanner Subscription Sending Error –</td>
<td></td>
</tr>
<tr class="odd">
<td>525</td>
<td>Cancel Scanner Subscription Sending Error –</td>
<td></td>
</tr>
<tr class="even">
<td>526</td>
<td>Request Scanner Parameter Sending Error –</td>
<td></td>
</tr>
<tr class="odd">
<td>527</td>
<td>Request Historical Data Sending Error –</td>
<td></td>
</tr>
<tr class="even">
<td>528</td>
<td>Request Historical Data Sending Error –</td>
<td></td>
</tr>
<tr class="odd">
<td>529</td>
<td>Request Real-time Bar Data Sending Error –</td>
<td></td>
</tr>
<tr class="even">
<td>530</td>
<td>Cancel Real-time Bar Data Sending Error –</td>
<td></td>
</tr>
<tr class="odd">
<td>531</td>
<td>Request Current Time Sending Error –</td>
<td></td>
</tr>
<tr class="even">
<td>532</td>
<td>Request Fundamental Data Sending Error –</td>
<td></td>
</tr>
<tr class="odd">
<td>533</td>
<td>Cancel Fundamental Data Sending Error –</td>
<td></td>
</tr>
<tr class="even">
<td>534</td>
<td>Request Calculate Implied Volatility Sending Error –</td>
<td></td>
</tr>
<tr class="odd">
<td>535</td>
<td>Request Calculate Option Price Sending Error –</td>
<td></td>
</tr>
<tr class="even">
<td>536</td>
<td>Cancel Calculate Implied Volatility Sending Error –</td>
<td></td>
</tr>
<tr class="odd">
<td>537</td>
<td>Cancel Calculate Option Price Sending Error –</td>
<td></td>
</tr>
<tr class="even">
<td>538</td>
<td>Request Global Cancel Sending Error –</td>
<td></td>
</tr>
<tr class="odd">
<td>539</td>
<td>Request Market Data Type Sending Error –</td>
<td></td>
</tr>
<tr class="even">
<td>540</td>
<td>Request Positions Sending Error –</td>
<td></td>
</tr>
<tr class="odd">
<td>541</td>
<td>Cancel Positions Sending Error –</td>
<td></td>
</tr>
<tr class="even">
<td>542</td>
<td>Request Account Data Sending Error –</td>
<td></td>
</tr>
<tr class="odd">
<td>543</td>
<td>Cancel Account Data Sending Error –</td>
<td></td>
</tr>
<tr class="even">
<td>544</td>
<td>Verify Request Sending Error –</td>
<td></td>
</tr>
<tr class="odd">
<td>545</td>
<td>Verify Message Sending Error –</td>
<td></td>
</tr>
<tr class="even">
<td>546</td>
<td>Query Display Groups Sending Error –</td>
<td></td>
</tr>
<tr class="odd">
<td>547</td>
<td>Subscribe To Group Events Sending Error –</td>
<td></td>
</tr>
<tr class="even">
<td>548</td>
<td>Update Display Group Sending Error –</td>
<td></td>
</tr>
<tr class="odd">
<td>549</td>
<td>Unsubscribe From Group Events Sending Error –</td>
<td></td>
</tr>
<tr class="even">
<td>550</td>
<td>Start API Sending Error –</td>
<td></td>
</tr>
<tr class="odd">
<td>551</td>
<td>Verify And Auth Request Sending Error –</td>
<td></td>
</tr>
<tr class="even">
<td>552</td>
<td>Verify And Auth Message Sending Error –</td>
<td></td>
</tr>
<tr class="odd">
<td>553</td>
<td>Request Positions Multi Sending Error –</td>
<td></td>
</tr>
<tr class="even">
<td>554</td>
<td>Cancel Positions Multi Sending Error –</td>
<td></td>
</tr>
<tr class="odd">
<td>555</td>
<td>Request Account Updates Multi Sending Error –</td>
<td></td>
</tr>
<tr class="even">
<td>556</td>
<td>Cancel Account Updates Multi Sending Error –</td>
<td></td>
</tr>
<tr class="odd">
<td>557</td>
<td>Request Security Definition Option Params Sending Error –</td>
<td></td>
</tr>
<tr class="even">
<td>558</td>
<td>Request Soft Dollar Tiers Sending Error –</td>
<td></td>
</tr>
<tr class="odd">
<td>559</td>
<td>Request Family Codes Sending Error –</td>
<td></td>
</tr>
<tr class="even">
<td>560</td>
<td>Request Matching Symbols Sending Error –</td>
<td></td>
</tr>
<tr class="odd">
<td>561</td>
<td>Request Market Depth Exchanges Sending Error –</td>
<td></td>
</tr>
<tr class="even">
<td>562</td>
<td>Request Smart Components Sending Error –</td>
<td></td>
</tr>
<tr class="odd">
<td>563</td>
<td>Request News Providers Sending Error –</td>
<td></td>
</tr>
<tr class="even">
<td>564</td>
<td>Request News Article Sending Error –</td>
<td></td>
</tr>
<tr class="odd">
<td>565</td>
<td>Request Historical News Sending Error –</td>
<td></td>
</tr>
<tr class="even">
<td>566</td>
<td>Request Head Time Stamp Sending Error –</td>
<td></td>
</tr>
<tr class="odd">
<td>567</td>
<td>Request Histogram Data Sending Error –</td>
<td></td>
</tr>
<tr class="even">
<td>568</td>
<td>Cancel Request Histogram Data Sending Error –</td>
<td></td>
</tr>
<tr class="odd">
<td>569</td>
<td>Cancel Head Time Stamp Sending Error –</td>
<td></td>
</tr>
<tr class="even">
<td>570</td>
<td>Request Market Rule Sending Error –</td>
<td></td>
</tr>
<tr class="odd">
<td>571</td>
<td>Request PnL Sending Error –</td>
<td></td>
</tr>
<tr class="even">
<td>572</td>
<td>Cancel PnL Sending Error –</td>
<td></td>
</tr>
<tr class="odd">
<td>573</td>
<td>Request PnL Single Error –</td>
<td></td>
</tr>
<tr class="even">
<td>574</td>
<td>Cancel PnL Single Sending Error –</td>
<td></td>
</tr>
<tr class="odd">
<td>575</td>
<td>Request Historical Ticks Error –</td>
<td></td>
</tr>
<tr class="even">
<td>576</td>
<td>Request Tick-By-Tick Data Sending Error –</td>
<td></td>
</tr>
<tr class="odd">
<td>577</td>
<td>Cancel Tick-By-Tick Data Sending Error –</td>
<td></td>
</tr>
<tr class="even">
<td>578</td>
<td>Request Completed Orders Sending Error –</td>
<td></td>
</tr>
<tr class="odd">
<td>579</td>
<td>Invalid symbol in string –</td>
<td></td>
</tr>
<tr class="even">
<td>580</td>
<td>Request WSH Meta Data Sending Error –</td>
<td></td>
</tr>
<tr class="odd">
<td>581</td>
<td>Cancel WSH Meta Data Sending Error –</td>
<td></td>
</tr>
<tr class="even">
<td>582</td>
<td>Request WSH Event Data Sending Error –</td>
<td></td>
</tr>
<tr class="odd">
<td>583</td>
<td>Cancel WSH Event Data Sending Error –</td>
<td></td>
</tr>
<tr class="even">
<td>584</td>
<td>Request User Info Sending Error –</td>
<td></td>
</tr>
<tr class="odd">
<td>585</td>
<td>“FA Profile is not supported anymore, use FA Group instead”</td>
<td>“Indicates FaDataTypeEnum.PROFILES is deprecated. Use FaDataTypeEnum.GROUPS or 1 instead”</td>
</tr>
<tr class="even">
<td>586</td>
<td>Failed to read message because not connected (Used only in Java client)</td>
<td></td>
</tr>
<tr class="odd">
<td>587</td>
<td>Request Current Time In Millis Sending Error –</td>
<td></td>
</tr>
<tr class="even">
<td>588</td>
<td>Error encoding protobuf</td>
<td>(Used only in Java client)</td>
</tr>
<tr class="odd">
<td>589</td>
<td>Cancel Market Depth Sending Error –</td>
<td></td>
</tr>
<tr class="even">
<td>2100</td>
<td>New account data requested from TWS. API client has been unsubscribed from account data.</td>
<td>““The TWS only allows one IBApi.EClient.reqAccountUpdates request at a time. If the client application attempts to subscribe to a second account without canceling the previous subscription, the new request will override the old one and the TWS will send this message notifying so.””</td>
</tr>
<tr class="odd">
<td>2101</td>
<td>Unable to subscribe to account as the following clients are subscribed to a different account.</td>
<td>““If a client application invokes IBApi.EClient.reqAccountUpdates when there is an active subscription started by a different client, the TWS will reject the new subscription request with this message.””</td>
</tr>
<tr class="even">
<td>2102</td>
<td>Unable to modify this order as it is still being processed.</td>
<td>““If you attempt to modify an order before it gets processed by the system, the modification will be rejected. Wait until the order has been fully processed before modifying it. See Placing Orders for further details.””</td>
</tr>
<tr class="odd">
<td>2103</td>
<td>A market data farm is disconnected.</td>
<td>““Indicates a connectivity problem to an IB server. Outside of the nightly IB server reset, this typically indicates an underlying ISP connectivity issue.””</td>
</tr>
<tr class="even">
<td>2104</td>
<td>Market data farm connection is OK</td>
<td>““A notification that connection to the market data server is ok. This is a notification and not a true error condition, and is expected on first establishing connection.””</td>
</tr>
<tr class="odd">
<td>2105</td>
<td>A historical data farm is disconnected.</td>
<td>““Indicates a connectivity problem to an IB server. Outside of the nightly IB server reset, this typically indicates an underlying ISP connectivity issue.””</td>
</tr>
<tr class="even">
<td>2106</td>
<td>A historical data farm is connected.</td>
<td>““A notification that connection to the market data server is ok. This is a notification and not a true error condition, and is expected on first establishing connection.””</td>
</tr>
<tr class="odd">
<td>2107</td>
<td>A historical data farm connection has become inactive but should be available upon demand.</td>
<td>““Whenever a connection to the historical data farm is not being used because there is not an active historical data request, the connection will go inactive in IB Gateway. This does not indicate any connectivity issue or problem with IB Gateway. As soon as a historical data request is made the status will change back to active.””</td>
</tr>
<tr class="even">
<td>2108</td>
<td>A market data farm connection has become inactive but should be available upon demand.</td>
<td>““Whenever a connection to our data farms is not needed, it will become dormant. There is nothing abnormal nor wrong with your client application nor with the TWS. You can safely ignore this message.””</td>
</tr>
<tr class="odd">
<td>2109</td>
<td>“Order Event Warning: Attribute “”Outside Regular Trading Hours”” is ignored based on the order type and destination. PlaceOrder is now processed.”</td>
<td>Indicates the outsideRth flag was set for an order for which there is not a regular vs outside regular trading hour distinction</td>
</tr>
<tr class="even">
<td>2110</td>
<td>Connectivity between TWS and server is broken. It will be restored automatically.</td>
<td>Indicates a connectivity problem between TWS or IBG and the IB server. This will usually only occur during the IB nightly server reset; cases at other times indicate a problem in the local ISP connectivity.</td>
</tr>
<tr class="odd">
<td>2111</td>
<td>“The Start and/or End Time for algo order BUY/SELL a contract was adjusted to use the next trading date. To modify this setting, use the Auto-adjust algo order date item on the Orders configuration page”</td>
<td>Please go to TWS Global Configuration – “Orders” – “Settings” to correct the configuration.</td>
</tr>
<tr class="even">
<td>2119</td>
<td>Market data farm is connecting.</td>
<td></td>
</tr>
<tr class="odd">
<td>2130</td>
<td>Warning: products are trading on the basis of currency price with factor.</td>
<td></td>
</tr>
<tr class="even">
<td>2137</td>
<td>Cross Side Warning</td>
<td>““This warning message occurs in TWS version 955 and higher. It occurs when an order will change the position in an account from long to short or from short to long. To bypass the warning, a new feature has been added to IB Gateway 956 (or higher) and TWS 957 (or higher) so that once can go to Global Configuration &gt; Messages and disable the “”Cross Side Warning””.””</td>
</tr>
<tr class="odd">
<td>2152</td>
<td>Market depth smart depth exchanges.</td>
<td></td>
</tr>
<tr class="even">
<td>2158</td>
<td>Sec-def data farm connection is OK</td>
<td>““A notification that connection to the Security definition data server is ok. This is a notification and not a true error condition, and is expected on first establishing connection.””</td>
</tr>
<tr class="odd">
<td>2168</td>
<td>Etrade Only Not Supported Warning</td>
<td>The EtradeOnly IBApi.Order attribute is no longer supported. Error received with TWS versions 983+. Remove attribute to place order.</td>
</tr>
<tr class="even">
<td>2169</td>
<td>Firm Quote Only Not Supported Warning</td>
<td>The firmQuoteOnly IBApi.Order attribute is no longer supported. Error received with TWS versions 983+. Remove attribute to place order.</td>
</tr>
<tr class="odd">
<td>10000</td>
<td>Cross currency combo error.</td>
<td></td>
</tr>
<tr class="even">
<td>10001</td>
<td>Cross currency vol error.</td>
<td></td>
</tr>
<tr class="odd">
<td>10002</td>
<td>Invalid non-guaranteed legs.</td>
<td></td>
</tr>
<tr class="even">
<td>10003</td>
<td>IBSX not allowed.</td>
<td></td>
</tr>
<tr class="odd">
<td>10005</td>
<td>Read-only models.</td>
<td></td>
</tr>
<tr class="even">
<td>10006</td>
<td>Missing parent order.</td>
<td>The parent order ID specified cannot be found. In some cases this can occur with bracket orders if the child order is placed immediately after the parent order; a brief pause of 50 ms or less will be necessary before the child order is transmitted to TWS/IBG.</td>
</tr>
<tr class="odd">
<td>10007</td>
<td>Invalid hedge type.</td>
<td></td>
</tr>
<tr class="even">
<td>10008</td>
<td>Invalid beta value.</td>
<td></td>
</tr>
<tr class="odd">
<td>10009</td>
<td>Invalid hedge ratio.</td>
<td></td>
</tr>
<tr class="even">
<td>10010</td>
<td>Invalid delta hedge order.</td>
<td></td>
</tr>
<tr class="odd">
<td>10011</td>
<td>Currency is not supported for Smart combo.</td>
<td></td>
</tr>
<tr class="even">
<td>10012</td>
<td>Invalid allocation percentage</td>
<td>FaPercentage specified is not valid</td>
</tr>
<tr class="odd">
<td>10013</td>
<td>Smart routing API error (Smart routing opt-out required).</td>
<td></td>
</tr>
<tr class="even">
<td>10014</td>
<td>PctChange limits.</td>
<td>This error is deprecated</td>
</tr>
<tr class="odd">
<td>10015</td>
<td>Trading is not allowed in the API.</td>
<td></td>
</tr>
<tr class="even">
<td>10016</td>
<td>Contract is not visible.</td>
<td>This error is deprecated</td>
</tr>
<tr class="odd">
<td>10017</td>
<td>Contracts are not visible.</td>
<td>This error is deprecated</td>
</tr>
<tr class="even">
<td>10018</td>
<td>Orders use EV warning.</td>
<td></td>
</tr>
<tr class="odd">
<td>10019</td>
<td>Trades use EV warning.</td>
<td></td>
</tr>
<tr class="even">
<td>10020</td>
<td>Display size should be smaller than order size./td&gt;</td>
<td>The display size should be smaller than the total quantity</td>
</tr>
<tr class="odd">
<td>10021</td>
<td>Invalid leg2 to Mkt Offset API.</td>
<td>This error is deprecated</td>
</tr>
<tr class="even">
<td>10022</td>
<td>Invalid Leg Prio API.</td>
<td>This error is deprecated</td>
</tr>
<tr class="odd">
<td>10023</td>
<td>Invalid combo display size API.</td>
<td>This error is deprecated</td>
</tr>
<tr class="even">
<td>10024</td>
<td>Invalid don’t start next legin API.</td>
<td>This error is deprecated</td>
</tr>
<tr class="odd">
<td>10025</td>
<td>Invalid leg2 to Mkt time1 API.</td>
<td>This error is deprecated</td>
</tr>
<tr class="even">
<td>10026</td>
<td>Invalid leg2 to Mkt time2 API.</td>
<td>This error is deprecated</td>
</tr>
<tr class="odd">
<td>10027</td>
<td>Invalid combo routing tag API.</td>
<td>This error is deprecated</td>
</tr>
<tr class="even">
<td>10090</td>
<td>Part of requested market data is not subscribed.</td>
<td>““Indicates that some tick types requested require additional market data subscriptions not held in the account. This commonly occurs for instance if a user has options subscriptions but not the underlying stock so the system cannot calculate the real time greek values (other default ticks will be returned). Or alternatively, if generic tick types are specified in a market data request without the associated subscriptions.””</td>
</tr>
<tr class="odd">
<td>10147</td>
<td>Order to be canceled was not found.</td>
<td></td>
</tr>
<tr class="even">
<td>10148</td>
<td>““OrderId that needs to be cancelled can not be cancelled, state:””</td>
<td>An attempt was made to cancel an order that had already been filled by the system.</td>
</tr>
<tr class="odd">
<td>10186</td>
<td>Requested market data is not subscribed. Delayed market data is not enabled</td>
<td>See Market Data Types on how to enable delayed data.</td>
</tr>
<tr class="even">
<td>10187</td>
<td>Failed to request historical ticks:No market data permissions</td>
<td></td>
</tr>
<tr class="odd">
<td>10189</td>
<td>Failed to request tick-by-tick data. Invalid Real-time Query</td>
<td>“Trading TWS session is connected from a different IP address. Or, No market data permissions”</td>
</tr>
<tr class="even">
<td>10197</td>
<td>No market data during competing session</td>
<td>““Indicates that the user is logged into the paper account and live account simultaneously trying to request live market data using both the accounts. In such a scenario preference would be given to the live account, for more details please refer: https://ibkr.info/node/1719””</td>
</tr>
<tr class="odd">
<td>10225</td>
<td>““Bust event occurred, current subscription is deactivated. Please resubscribe real-time bars immediately””</td>
<td></td>
</tr>
<tr class="even">
<td>10230</td>
<td>““You have unsaved FA changes. Please retry ‘request FA’ operation later, when ‘replace FA’ operation is complete””</td>
<td>There are pending Financial Advisor configuration changes. See Financial Advisors</td>
</tr>
<tr class="odd">
<td>10231</td>
<td>The following Groups and/or Profiles contain invalid accounts:</td>
<td>““If the account(s) inside Groups or Profiles is/are incorrect in xml-formatted configuration string of replaceFA request, then the error shows list of such Groups and/or Profiles.””</td>
</tr>
<tr class="even">
<td>10233</td>
<td>Defaults were inherited from CASH preset during the creation of this order.</td>
<td></td>
</tr>
<tr class="odd">
<td>10234</td>
<td>The Decision Maker field is required and not set for this order (non-desktop).</td>
<td></td>
</tr>
<tr class="even">
<td>10235</td>
<td>The Decision Maker field is required and not set for this order (ibbot).</td>
<td></td>
</tr>
<tr class="odd">
<td>10236</td>
<td>Child has to be AON if parent order is AON</td>
<td></td>
</tr>
<tr class="even">
<td>10237</td>
<td>All or None ticket can route entire unfilled size only</td>
<td></td>
</tr>
<tr class="odd">
<td>10238</td>
<td>Some error occured during communication with Advisor Setup web-app</td>
<td></td>
</tr>
<tr class="even">
<td>10239</td>
<td>This order will affect one or more accounts that are flagged because they do not fit the required risk score criteria prescribed by the group/profile/model allocation.</td>
<td></td>
</tr>
<tr class="odd">
<td>10240</td>
<td>You must enter a valid Price Cap.</td>
<td></td>
</tr>
<tr class="even">
<td>10241</td>
<td>Order Quantity is expressed in monetary terms. Modification is not supported via API. Please use desktop version to revise this order.</td>
<td></td>
</tr>
<tr class="odd">
<td>10242</td>
<td>Fractional-sized order cannot be modified via API. Please use desktop version to revise this order.</td>
<td></td>
</tr>
<tr class="even">
<td>10243</td>
<td>Fractional-sized order cannot be placed via API. Please use desktop version to place this order.</td>
<td></td>
</tr>
<tr class="odd">
<td>10244</td>
<td>Cash Quantity cannot be used for this order</td>
<td></td>
</tr>
<tr class="even">
<td>10245</td>
<td>This financial instrument does not support fractional shares trading</td>
<td></td>
</tr>
<tr class="odd">
<td>10246</td>
<td>This order doesn’t support fractional shares trading</td>
<td></td>
</tr>
<tr class="even">
<td>10247</td>
<td>Only IB SmartRouting supports fractional shares</td>
<td></td>
</tr>
<tr class="odd">
<td>10248</td>
<td>doesn’t have permission to trade fractional shares</td>
<td></td>
</tr>
<tr class="even">
<td>10249</td>
<td>“=””””&gt; order doesn’t support fractional shares”</td>
<td></td>
</tr>
<tr class="odd">
<td>10250</td>
<td>The size does not conform to the minimum variation of for this contract</td>
<td></td>
</tr>
<tr class="even">
<td>10251</td>
<td>Fractional shares are not supported for allocation orders</td>
<td></td>
</tr>
<tr class="odd">
<td>10252</td>
<td>This non-close-position order doesn’t support fractional shares trading</td>
<td></td>
</tr>
<tr class="even">
<td>10253</td>
<td>Clear Away orders are not supported for multi-leg combo with attached hedge.</td>
<td></td>
</tr>
<tr class="odd">
<td>10254</td>
<td>Invalid Order: bond expired</td>
<td></td>
</tr>
<tr class="even">
<td>10268</td>
<td>The ‘EtradeOnly’ order attribute is not supported</td>
<td>The EtradeOnly IBApi.Order attribute is no longer supported. Error received with TWS versions 983+</td>
</tr>
<tr class="odd">
<td>10269</td>
<td>The ‘firmQuoteOnly’ order attribute is not supported</td>
<td>The firmQuoteOnly IBApi.Order attribute is no longer supported. Error received with TWS versions 983+</td>
</tr>
<tr class="even">
<td>10270</td>
<td>The ‘nbboPriceCap’ order attribute is not supported</td>
<td>The nbboPriceCap IBApi.Order attribute is no longer supported. Error received with TWS versions 983+</td>
</tr>
<tr class="odd">
<td>10276</td>
<td>News feed is not allowed</td>
<td>The API client is not permissioned for receiving WSH news feed.</td>
</tr>
<tr class="even">
<td>10277</td>
<td>News feed permissions required</td>
<td>The API client is not subscribed to receive WSH news feed</td>
</tr>
<tr class="odd">
<td>10278</td>
<td>Duplicate WSH metadata request</td>
<td>A request is already pending for the same API client.</td>
</tr>
<tr class="even">
<td>10279</td>
<td>Failed request WSH metadata</td>
<td>A general error occurred when processing the request.</td>
</tr>
<tr class="odd">
<td>10280</td>
<td>Failed cancel WSH metadata</td>
<td>A general error occurred when processing the request.</td>
</tr>
<tr class="even">
<td>10281</td>
<td>Duplicate WSH event data request</td>
<td>A request is already pending for the same API client.</td>
</tr>
<tr class="odd">
<td>10282</td>
<td>WSH metadata not requested</td>
<td>WSH metadata was not requested by first sending a reqWshMetaData request.</td>
</tr>
<tr class="even">
<td>10283</td>
<td>Fail request WSH event data</td>
<td>A general error occurred when processing the request.</td>
</tr>
<tr class="odd">
<td>10284</td>
<td>Fail cancel WSH event data</td>
<td>A general error occurred when processing the request.</td>
</tr>
<tr class="even">
<td>10285</td>
<td>Your API version does not support fractional sizing rules. Please upgrade to at least version 163</td>
<td></td>
</tr>
<tr class="odd">
<td>10286</td>
<td>%s field cannot contain more than %s decimals.</td>
<td></td>
</tr>
<tr class="even">
<td>10287</td>
<td>Cryptocurrency order is not confirmed</td>
<td></td>
</tr>
<tr class="odd">
<td>10288</td>
<td>Market order confirmation dialog title for cryptocurrencies</td>
<td></td>
</tr>
<tr class="even">
<td>10289</td>
<td>You must set Cash Quantity for this order</td>
<td></td>
</tr>
<tr class="odd">
<td>10290</td>
<td>This order only supports CashQty trading.</td>
<td></td>
</tr>
<tr class="even">
<td>10291</td>
<td>Orders to harvest Capital Loss must use the DAY time-in-force.</td>
<td></td>
</tr>
<tr class="odd">
<td>10292</td>
<td>Order type/action restriction</td>
<td></td>
</tr>
<tr class="even">
<td>10293</td>
<td>Cryptocurrency Cash Quantity order cannot specify size</td>
<td></td>
</tr>
<tr class="odd">
<td>10294</td>
<td>Cash quantity set on the order does not match total monetary amount of the Group.</td>
<td></td>
</tr>
<tr class="even">
<td>10295</td>
<td>Orders to harvest Capital Loss must use the DAY time-in-force.</td>
<td></td>
</tr>
<tr class="odd">
<td>10295</td>
<td>Only daily resolution supported for Schedule requests</td>
<td></td>
</tr>
<tr class="even">
<td>10296</td>
<td>“The Smart Routing features \””Seek Price Improvement\”” (aka \””Route to Dark Pools\””) and \””Do not route to Dark Pools\”” are mutually exclusive.<br />
Enabling both will result in the order being rejected. Please choose only one of these commands.%s”</td>
<td></td>
</tr>
<tr class="odd">
<td>10297</td>
<td>Not Held attribute is invalid for this order.</td>
<td></td>
</tr>
<tr class="even">
<td>10298</td>
<td>Cannot trade an instrument with currency different from model currency</td>
<td></td>
</tr>
<tr class="odd">
<td>10299</td>
<td>Expected what to show is %s</td>
<td>please use that instead of %s.</td>
</tr>
<tr class="even">
<td>10300</td>
<td>%s: The date</td>
<td>time</td>
</tr>
<tr class="odd">
<td>10301</td>
<td>%s: The date</td>
<td>time</td>
</tr>
<tr class="even">
<td>10302</td>
<td>Min trade trade quantity is not allowed for this order</td>
<td></td>
</tr>
<tr class="odd">
<td>10303</td>
<td>Invalid min trade quantity value (%s).<br />
It must be a positive integer</td>
<td>not exceeding the total order size.</td>
</tr>
<tr class="even">
<td>10304</td>
<td>Minimum Competing Size value must be non-negative.</td>
<td></td>
</tr>
<tr class="odd">
<td>10305</td>
<td>Compete against best bid or offer Offset dollar value must be positive</td>
<td>multiple of a cent.</td>
</tr>
<tr class="even">
<td>10306</td>
<td>Mid offsets are not allowed</td>
<td></td>
</tr>
<tr class="odd">
<td>10307</td>
<td>Invalid MidOffsetAtWhole and/or MidOffsetAtHalf attribute values</td>
<td></td>
</tr>
<tr class="even">
<td>10308</td>
<td>Revision to Post to ATS value presence is not allowed.</td>
<td></td>
</tr>
<tr class="odd">
<td>10309</td>
<td>Invalid WSH event data request.</td>
<td></td>
</tr>
<tr class="even">
<td>10310</td>
<td>The Solicited field should be used for orders initiated or recommended by the broker or advisor that were approved by the client (by phone</td>
<td>email</td>
</tr>
<tr class="odd">
<td>10311</td>
<td>This order will be directly routed to %s. Direct routed orders may result in higher trade fees.</td>
<td></td>
</tr>
<tr class="even">
<td>10312</td>
<td>The order type Volatility is currently not supported for this combination of financial instrument and account type</td>
<td></td>
</tr>
<tr class="odd">
<td>10314</td>
<td>%s: The date</td>
<td>time</td>
</tr>
<tr class="even">
<td>10315</td>
<td>%s: The time entered is invalid. The correct format is hh:mm:ss. E.g.: 15:00:00 in UTC. No date should be specified</td>
<td>current date is assumed.</td>
</tr>
<tr class="odd">
<td>10316</td>
<td>Trigger Outside RTH was deprecated. Please upgrade your API Client software to submit order with Outside RTH attribute instead.</td>
<td></td>
</tr>
<tr class="even">
<td>10317</td>
<td>The Cash Quantity size for the below contracts does not conform to minimum variation of %s</td>
<td></td>
</tr>
<tr class="odd">
<td>10318</td>
<td>This order doesn’t support fractional quantity trading</td>
<td></td>
</tr>
<tr class="even">
<td>10319</td>
<td>Placing orders for Municipal Bonds via API is currently disabled</td>
<td></td>
</tr>
<tr class="odd">
<td>10321</td>
<td>Placing orders for Municipal Bonds is currently disabled for attached and OCA orders.</td>
<td></td>
</tr>
<tr class="even">
<td>10322</td>
<td>This API request for All is not supported for Dynamic Account Addition</td>
<td></td>
</tr>
<tr class="odd">
<td>10324</td>
<td>Invalid parameters for OCA group for exchange %s. Overfill Protection is implied.</td>
<td></td>
</tr>
<tr class="even">
<td>10325</td>
<td>OCA group is not supported</td>
<td></td>
</tr>
<tr class="odd">
<td>10326</td>
<td>OCA group revision is not allowed</td>
<td></td>
</tr>
<tr class="even">
<td>10327</td>
<td>OCA group type revision is not allowed</td>
<td></td>
</tr>
<tr class="odd">
<td>10328</td>
<td>Connection lost</td>
<td>order data could not be resolved</td>
</tr>
<tr class="even">
<td>10329</td>
<td>This order will be directly routed to %s.</td>
<td></td>
</tr>
<tr class="odd">
<td>10330</td>
<td>The expiry date/time format is invalid.\nThe correct format is yyyyMM</td>
<td>yyyyMMdd HH:mm:ss (operator or instrument time zone) or yyyyMMdd-HH:mm:ss (UTC time zone).</td>
</tr>
<tr class="even">
<td>10331</td>
<td>Any stop warning</td>
<td></td>
</tr>
<tr class="odd">
<td>10332</td>
<td>Cryptocurrency volatility warning</td>
<td></td>
</tr>
<tr class="even">
<td>10333</td>
<td>Option Exercise at-the-money warning</td>
<td></td>
</tr>
<tr class="odd">
<td>10334</td>
<td>Confirm Omnibus Order Account</td>
<td></td>
</tr>
<tr class="even">
<td>10335</td>
<td>“Order presets cannot be applied as configured. Please review<br />
%s Settings and Rapid Order Entry Configuration for consistency.”</td>
<td></td>
</tr>
<tr class="odd">
<td>10336</td>
<td>Per-leg executing broker configuration is not supported</td>
<td></td>
</tr>
<tr class="even">
<td>10337</td>
<td>Misc options key=%s is invalid in %s request. Valid keys are: %s</td>
<td></td>
</tr>
<tr class="odd">
<td>10338</td>
<td>Misc options value=%s is invalid for key=%s in %s request. Valid values are: %s</td>
<td></td>
</tr>
<tr class="even">
<td>10339</td>
<td>Setting end date/time for continuous future security type is not allowed</td>
<td></td>
</tr>
<tr class="odd">
<td>10340</td>
<td>The following order attribute is not supported: %s</td>
<td></td>
</tr>
<tr class="even">
<td>10341</td>
<td>Parent order id cannot be modified</td>
<td></td>
</tr>
<tr class="odd">
<td>10342</td>
<td>The ‘ImbalanceOnly’ order attribute may not be specified for this order.</td>
<td></td>
</tr>
<tr class="even">
<td>10343</td>
<td>Selling Event Contracts is neither allowed directly</td>
<td>nor as an attached profit taker.</td>
</tr>
<tr class="odd">
<td>10344</td>
<td>Price value must be between 0.02 and 0.99 with a maximum of two decimal places.</td>
<td></td>
</tr>
<tr class="even">
<td>10345</td>
<td>You cannot trade a %s</td>
<td></td>
</tr>
<tr class="odd">
<td>10346</td>
<td>Market data for %s cannot be delivered because ticker for the same financial instrument is displayed on %s</td>
<td></td>
</tr>
<tr class="even">
<td>10347</td>
<td>This security has limited liquidity. If you choose to trade this security</td>
<td>there is a heightened risk that you may not be able to close your position<br />
at the time you wish</td>
</tr>
<tr class="odd">
<td>WinError 10038</td>
<td>An operation was attempted on something that is not a socket.</td>
<td>This indicates socket connection was closed improperly.</td>
</tr>
</tbody>
</table>

### Receiving Error Messages

#### EWrapper.error(

**reqId:** int. The request identifier corresponding to the most recent reqId that maintained the error stream.  
This does not pertain to the orderId from placeOrder, but whatever the most recent requestId is.

**errorTime:** int. The Unix timestamp of when the error took place.  
Note: This is only implemented for TWS API 10.33+

**errorCode:** int. The code identifying the error.

**errorMsg:** String. The error’s description.

**advancedOrderRejectJson:** String. Advanced order reject description in json format.  
)

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
def error(self, reqId: TickerId, errorTime: int, errorCode: int, errorString: str, advancedOrderRejectJson = ""):
  print("Error. Id:", reqId, errorTime, "Code:", errorCode, "Msg:", errorString, "AdvancedOrderRejectJson:", advancedOrderRejectJson)
```

``` EnlighterJSRAW
@Override
public void error(int id, long errorTime, int errorCode, String errorMsg, String advancedOrderRejectJson) {
  String str = "Error. Id: " + id + ", Code: " + errorCode + ", Msg: " + errorMsg;
  if (advancedOrderRejectJson != null) {
    str += (", AdvancedOrderRejectJson: " + advancedOrderRejectJson);
  }
  System.out.println(str + "\n");
}
```

``` EnlighterJSRAW
void TestCppClient::error(int id, time_t errorTime, int errorCode, const std::string& errorString, const std::string& advancedOrderRejectJson)
{
    printf("Error. Id: %d, Timestamp: %d, Code: %d, Msg: %s, AdvancedOrderRejectJson: %s\n", id, errorTime, errorCode, errorString.c_str(), advancedOrderRejectJson.c_str());
}
```

``` EnlighterJSRAW
public virtual void error(int id, long errorTime, int errorCode, string errorMsg, string advancedOrderRejectJson)
{
  Console.WriteLine("Error. Id: " + id + "Timestamp: " + errorTime + ", Code: " + errorCode + ", Msg: " + errorMsg + ", AdvancedOrderRejectJson: " + advancedOrderRejectJson + "\n");
}
```

``` EnlighterJSRAW
Public Sub [error](id As Integer, errorCode As Integer, errorMsg As String, advancedOrderRejectJson As String) Implements IBApi.EWrapper.error
            Console.WriteLine("Error - Id [" & id & "] ErrorCode [" & errorCode & "] ErrorMsg [" & errorMsg & "] AdvancedOrderRejectJson [" & advancedOrderRejectJson & "]")
End Sub
```

### Common Error Resolution

The content below references some of the most common errors received by clients at Interactive Brokers, and offers direct resolutions for the matters in most instances. If further information is required, please feel to contact [Customer Service](https://www.interactivebrokers.com/en/support/customer-service.php?p=contact) for additional insight.  
 

### Market data farm connection is OK

Error code 2104, 2106, and 2158 all generally state that farm connection is OK. What this means is that the API has successfully connected to Trader Workstation or the IB Gateway, and that connection is able to reach Interactive Brokers servers. There is no issue with the connection, and it is a sign you connected successfully.

While using IB Gateway, users may encounter the error, “A historical data farm connection has become inactive but should be available upon demand.” This means that while no historical data requests are being sent, the connection is halted. Once a historical data request is sent over the API connection, the market data farm will reconnect and supply market data.

### Requested market data requires additional subscription for API. See link in 'Market Data Connections' dialog for more details.Delayed market data is available.

Error 10089 notes that clients are requesting market data when they do not maintain a valid market data subscription. To resolve this issue, users must add a market data subscription to [the specific user they are requesting market data with](/campus/ibkr-api-page/market-data-subscriptions/#md-users). Alternatively, users must [request delayed market data](/campus/ibkr-api-page/twsapi-doc/#delayed-market-data) prior to requesting market data.

Market data availability is different in [TWS versus the API](/campus/ibkr-api-page/market-data-subscriptions/#tws-vs-api). As a result, market data you can receive in Trader Workstation may not be available in the API.

Interactive Brokers lists many of our most popular market data subscriptions [here](/campus/ibkr-api-page/market-data-subscriptions/#popular-md-subscriptions).

## Financial Advisors

Financial Advisors are able to manage their allocation groups from the TWS API.

**Note:** Modifications made through the API will effect orders placed through TWS, the TWS API, Client Portal, and the Client Portal API.

### Request FA Groups and Profiles

#### EClient.requestFA (

**faDataType:** int. The configuration to change. Set to 1 or 3 as defined in the table below.  
)

Requests the FA configuration as set in TWS for the given FA Group or Profile.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
self.requestFA(1)
```

``` EnlighterJSRAW
client.requestFA(1);
```

``` EnlighterJSRAW
m_pClient->requestFA(1);
```

``` EnlighterJSRAW
client.requestFA(1);
```

``` EnlighterJSRAW
client.requestFA(1)
```

#### requestFA FA Data Types

| Type Code | Type Name       | Description                                                                                                          |
| --------- | --------------- | -------------------------------------------------------------------------------------------------------------------- |
| 1         | Groups          | offer traders a way to create a group of accounts and apply a single allocation method to all accounts in the group. |
| 3         | Account Aliases | let you easily identify the accounts by meaningful names rather than account numbers.                                |

### Receiving FA Groups and Profiles

#### EWrapper.receiveFA (

**faDataType:** int. Receive the faDataType value specified in the requestFA. See [FA Data Types](#fa-data-types)

**faXmlData:** String. The xml-formatted configuration.  
)

Receives the Financial Advisor’s configuration available in the TWS.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
def receiveFA(self, faData: FaDataType, cxml: str):
    print("Receiving FA: ", faData)
    open('log/fa.xml', 'w').write(cxml)
```

``` EnlighterJSRAW
@Override
public void receiveFA(int faDataType, String xml) {
    System.out.println("Receiving FA: " + faDataType + " - " + xml);
}
```

``` EnlighterJSRAW
void TestCppClient::receiveFA(faDataType pFaDataType, const std::string& cxml) {
    std::cout << "Receiving FA: " << (int)pFaDataType << std::endl << cxml << std::endl;
}
```

``` EnlighterJSRAW
public virtual void receiveFA(int faDataType, string faXmlData)
{
    Console.WriteLine("Receing FA: "+faDataType+" - "+faXmlData);
}
```

``` EnlighterJSRAW
Public Sub receiveFA(faDataType As Integer, faXmlData As String) Implements IBApi.EWrapper.receiveFA
  Console.WriteLine("Receing FA: " & faDataType & " - " & faXmlData)
End Sub
```

### Replace FA Allocations

#### EClient.replaceFA (

**reqId:** int. Request identifier used to track data.

**faDataType:** int. The configuration structure to change. Set to 1 or 3 as defined above.

**xml:** String. XML configuration for allocation profiles or group. See [Allocation Method XML Format](https://www.interactivebrokers.com/campus/ibkr-api-page/twsapi-doc/#allocation-format) for more details.  
)

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
self.replaceFa(reqId, 1, xml)
```

``` EnlighterJSRAW
client.replaceFa(reqId, 1, xml);
```

``` EnlighterJSRAW
m_pClient->replaceFa(reqId, 1, xml);
```

``` EnlighterJSRAW
client.replaceFa(reqId, 1, xml);
```

``` EnlighterJSRAW
client.replaceFa(reqId, 1, xml)
```

#### replaceFA FA Data Types

| replaceFA Type Code | Type Name       | Description                                                                                                          |
| ------------------- | --------------- | -------------------------------------------------------------------------------------------------------------------- |
| 1                   | Groups          | offer traders a way to create a group of accounts and apply a single allocation method to all accounts in the group. |
| 2                   | Account Aliases | let you easily identify the accounts by meaningful names rather than account numbers.                                |

**Note: **

In order to confirm that your FA changes were saved, you may wait for the [EWrapper.replaceFAEnd](https://www.interactivebrokers.com/campus/ibkr-api-page/twsapi-methods-e-f/#receive-fa "notifies the end of the FA replace. ") callback, which provides the corresponding reqId. In addition, after saving changes, it is advised to verify the new FA setup via [EClient.requestFA](https://www.interactivebrokers.com/campus/ibkr-api-page/twsapi-methods-e-f/#request-fa "Requests the FA configuration A Financial Advisor can define three different configurations: ..."). If it is called before changes are fully saved, you may receive an error, such as [error 10230](https://www.interactivebrokers.com/campus/ibkr-api-page/twsapi-ref/#api-error-codes). See [Message Codes](https://www.interactivebrokers.com/campus/ibkr-api-page/twsapi-ref/#api-error-codes).

[EClient.replaceFA](https://www.interactivebrokers.com/campus/ibkr-api-page/twsapi-doc/#replace-fa) only accepts faDataType 1 now. Otherwise, it may trigger [error 585](https://www.interactivebrokers.com/campus/ibkr-api-page/twsapi-doc/#api-error-codes).

#### EWrapper.replaceFAEnd (

**reqId:** int. Request identifier used to track data.

**text:** String. the message text.

)

Marks the ending of the replaceFA reception.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
def replaceFAEnd(self, reqId: int, text: str):
    super().replaceFAEnd(reqId, text)
    print("ReplaceFAEnd.", "ReqId:", reqId, "Text:", text)
```

``` EnlighterJSRAW
@Override
public void replaceFAEnd(int reqId, String text) {
        System.out.println(EWrapperMsgGenerator.replaceFAEnd(reqId, text));
}
```

``` EnlighterJSRAW
void TestCppClient::replaceFAEnd(int reqId, const std::string& text) {
    printf("Replace FA End. Request: %d, Text:%s\n", reqId, text.c_str());
}
```

``` EnlighterJSRAW
public virtual void replaceFAEnd(int reqId, string text)
{
    Console.WriteLine("Replace FA End. ReqId: " + reqId + ", Text: " + text + "\n");
}
```

``` EnlighterJSRAW
Public Sub replaceFAEnd(reqId As Integer, text As String) Implements IBApi.EWrapper.replaceFAEnd
    Console.WriteLine("replaceFAEnd. ReqId: {0}, Text: {1}", reqId, text)
End Sub
```

### Allocation Methods and Groups

A number of methods for account allocations are available with Financial Advisor and IBroker account structures to specify how trades should be distributed across multiple accounts.

Allocation Groups can be created or modified in the Trader Workstation directly as described in [TWS: Allocations and Transfers](https://www.ibkrguides.com/tws/usersguidebook/financialadvisors/create%20an%20account%20group%20for%20share%20allocation.htm).

Alternatively, allocation groups can be created or modified through the [EClient.replaceFA()](https://www.interactivebrokers.com/campus/ibkr-api-page/twsapi-doc/#replace-fa) method in the API.

Interactive Brokers supports two forms of allocation methods. Allocation methods that have calculations completed by Interactive Brokers, and a set of allocation methods calculated by the user and then specified.

#### IB-computed allocation methods

  - [Available Equity](https://www.interactivebrokers.com/campus/ibkr-api-page/twsapi-doc/#available-equity-xml)
  - [Equal Quantity](https://www.interactivebrokers.com/campus/ibkr-api-page/twsapi-doc/#equal-quantity-xml)
  - [Net Liquidation Value](https://www.interactivebrokers.com/campus/ibkr-api-page/twsapi-doc/#nlv-xml)

#### User-specified allocation methods

###### Formerly known as Allocation Profiles

  - [Cash Quantity](https://www.interactivebrokers.com/campus/ibkr-api-page/twsapi-doc/#cash-xml)
  - [Percentages](https://www.interactivebrokers.com/campus/ibkr-api-page/twsapi-doc/#percentage-xml)
  - [Ratios](https://www.interactivebrokers.com/campus/ibkr-api-page/twsapi-doc/#ratio-xml)
  - [Shares](https://www.interactivebrokers.com/campus/ibkr-api-page/twsapi-doc/#shares-xml)

### Allocation Method XML Format

Allocation methods for financial advisor’s allocation groups are created using an XML format. The content below signifies the supported allocation groups and how to format them in their respective XML.

### Available Equity

Requires you to specify an order size. This method distributes shares based on the amount of available equity in each account. The system calculates ratios based on the Available Equity in each account and allocates shares based on these ratios.

**Example:** You transmit an order for 700 shares of stock XYZ. The account group includes three accounts, A, B and C with available equity in the amounts of $25,000, $50,000 and $100,000 respectively. The system calculates a ratio of 1:2:4 and allocates 100 shares to Client A, 200 shares to Client B, and 400 shares to Client C.

``` EnlighterJSRAW
<?xml version="1.0" encoding="UTF-8"?>
<ListOfGroups>
  <Group>
    <name>MyTestProfile2</name>
    <defaultMethod>AvailableEquity</defaultMethod>
    <ListOfAccts varName="list">
      <Account>
        <acct>DU6202167</acct>
      </Account>
      <Account>
        <acct>DU6202168</acct>
      </Account>
    </ListOfAccts>
  </Group>
</ListOfGroups>
```

### Contracts Or Shares

This method allocates the absolute number of shares you enter to each account listed. If you use this method, the order size is calculated by adding together the number of shares allocated to each account in the profile.

**Example:**

Assume an order for 300 shares of stock ABC is transmitted.

In the example code shown in the right side, you can see that:

1.  Account A is set to receive 100.0 shares while Account B is set to receive 200.0 shares. Account A should receive 100 shares and Account B should receive 200 shares.

<!-- end list -->

``` EnlighterJSRAW
<?xml version="1.0" encoding="UTF-8"?>
<ListOfGroups>
  <Group>
  <name>MyTestProfile2</name>
  <defaultMethod>ContractsOrShares</defaultMethod>
  
  <ListOfAccts varName="list">
  <Account>
    <acct>DU6202167</acct>
    <amount>100.0</amount>
  </Account>
  <Account>
    <acct>DU6202168</acct>
    <amount>200.0</amount>
  </Account>
  </ListOfAccts>
  </Group>
</ListOfGroups>
```

### Equal Quantity

Requires you to specify an order size. This method distributes shares equally between all accounts in the group.

**Example:** You transmit an order for 400 shares of stock ABC. If your Account Group includes four accounts, each account receives 100 shares. If your Account Group includes six accounts, each account receives 66 shares, and then 1 share is allocated to each account until all are distributed.

``` EnlighterJSRAW
<?xml version="1.0" encoding="UTF-8"?>
<ListOfGroups>
  <Group>
    <name>MyTestProfile2</name>
    <defaultMethod>Equal</defaultMethod>
    <ListOfAccts varName="list">
      <Account>
        <acct>DU6202167</acct>
      </Account>
      <Account>
        <acct>DU6202168</acct>
      </Account>
    </ListOfAccts>
  </Group>
</ListOfGroups>
```

### MonetaryAmount

The Monetary Amount method calculates the number of units to be allocated based on the monetary value assigned to each account.

``` EnlighterJSRAW
<?xml version="1.0" encoding="UTF-8"?>
<ListOfGroups>
  <Group>
  <name>MyTestProfile2</name>
  <defaultMethod>MonetaryAmount</defaultMethod>
  
  <ListOfAccts varName="list">
  <Account>
    <acct>DU6202167</acct>
    <amount>1000.0</amount>
  </Account>
  <Account>
    <acct>DU6202168</acct>
    <amount>2000.0</amount>
  </Account>
  </ListOfAccts>
  </Group>
</ListOfGroups>
```

### Net Liquidation Value

Requires you to specify an order size. This method distributes shares based on the net liquidation value of each account. The system calculates ratios based on the Net Liquidation value in each account and allocates shares based on these ratios.

**Example:** You transmit an order for 700 shares of stock XYZ. The account group includes three accounts, A, B and C with Net Liquidation values of $25,000, $50,000 and $100,000 respectively. The system calculates a ratio of 1:2:4 and allocates 100 shares to Client A, 200 shares to Client B, and 400 shares to Client C.

``` EnlighterJSRAW
<?xml version="1.0" encoding="UTF-8"?>
<ListOfGroups>
  <Group>
    <name>MyTestProfile2</name>
    <defaultMethod>NetLiq</defaultMethod>
    <ListOfAccts varName="list">
      <Account>
        <acct>DU6202167</acct>
      </Account>
      <Account>
        <acct>DU6202168</acct>
      </Account>
    </ListOfAccts>
  </Group>
</ListOfGroups>
```

### Percentages

This method will split the total number of shares in the order between listed accounts based on the percentages you indicate.

**Example:**

Assume an order for 300 shares of stock ABC is transmitted.

In the example code shown in the right side, you can see that:

1.  Account A is set to have 60.0 percentage while Account B is set to have 40.0 percentage. Account A should receive 180 shares and Account B should receive 120 shares.

While making modifications to allocations for profiles, the method uses an enumerated value. The number shown below demonstrates precisely what profile corresponds to which value.

|                |                    |                    |
| -------------- | ------------------ | ------------------ |
| **BUY ORDER**  | *Positive Percent* | *Negative Percent* |
| Long Position  | Increases position | No effect          |
| Short Position | No effect          | Decreases position |

|                |                    |                    |
| -------------- | ------------------ | ------------------ |
| **SELL ORDER** | *Positive Percent* | *Negative Percent* |
| Long Position  | No effect          | Decreases position |
| Short Position | Increases position | No effect          |

**Note:**  
Do not specify an order size. Since the quantity is calculated by the system, the order size is displayed in the Quantity field after the order is acknowledged. This method increases or decreases an already existing position. Positive percents will increase a position, negative percents will decrease a position. For exmaple, to fully close out a position, you just need to specify percentage to be -100.

``` EnlighterJSRAW
<?xml version="1.0" encoding="UTF-8"?>
<ListOfGroups>
  <Group>
  <name>MyTestProfile2</name>
  <defaultMethod>Percent</defaultMethod>
  <ListOfAccts varName="list">
  <Account>
    <acct>DU6202167</acct>
    <amount>60.0</amount>
  </Account>
  <Account>
    <acct>DU6202168</acct>
    <amount>40.0</amount>
  </Account>
  </ListOfAccts>
  </Group>
</ListOfGroups>
```

### Ratios

This method calculates the allocation of shares based on the ratios you enter.

**Example:**

Assume an order for 300 shares of stock ABC is transmitted.

In the example code shown in the right side, you can see that:

1.  A ratio of 1.0 and 2.0 is set to Account A and Account B. Account A should receive 100 shares and Account B should receive 200 shares.

<!-- end list -->

``` EnlighterJSRAW
<?xml version="1.0" encoding="UTF-8"?>
<ListOfGroups>
  <Group>
  <name>MyTestProfile2</name>
  <defaultMethod>Ratio</defaultMethod>
  
  <ListOfAccts varName="list">
  <Account>
    <acct>DU6202167</acct>
    <amount>1.0</amount>
  </Account>
  <Account>
    <acct>DU6202168</acct>
    <amount>2.0</amount>
  </Account>
  </ListOfAccts>
  </Group>
</ListOfGroups>
```

### Model Portfolios and the API

Advisors can use Model Portfolios to easily invest some or all of a client’s assets into one or multiple custom-created portfolios, rather than tediously managing individual investments in single instruments.

[More about Model Portfolios](https://www.interactivebrokers.com/en/index.php?f=20917)

The TWS API can access model portfolios in accounts where this functionality is available and a specific model has previously been setup in TWS. API functionality allows the client application to request model position update subscriptions, request model account update subscriptions, or place orders to a specific model.

Model Portfolio functionality **not** available in the TWS API:

  - Portfolio Model Creation
  - Portfolio Model Rebalancing
  - Portfolio Model Position or Cash Transfer

To request position updates from a specific model, the function [IBApi::EClient::reqPositionsMulti](https://www.interactivebrokers.com/campus/ibkr-api-page/trader-workstation-api/#request-positions-multi "Requests position subscription for account and/or model Initially all positions are returned...") can be used: [Position Update Subscription by Model](https://www.interactivebrokers.com/campus/ibkr-api-page/trader-workstation-api/#positions-multi)

To request model account updates, there is the function [IBApi::EClient::reqAccountUpdatesMulti](https://www.interactivebrokers.com/campus/ibkr-api-page/trader-workstation-api/#request-model-account-update "Requests account updates for account and/or model. "), see: [Account Value Update Subscriptions by Model](https://www.interactivebrokers.com/campus/ibkr-api-page/trader-workstation-api/#model-account-update)

To place an order to a model, the IBApi.Order.ModelCode field must be set accordingly, for example:

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
modelOrder = Order()
modelOrder.account = "DF12345"
modelOrder.modelCode = "Technology" # model for tech stocks first created in TWS
self.placeOrder(self.nextOrderId(), contract, modelOrder)
```

``` EnlighterJSRAW
Order modelOrder = Order();
modelOrder.account("DF12345");  // master FA account number
modelOrder.modelCode("Technology"); // model for tech stocks first created in TWS
client.placeOrder(nextOrderId++, contract, modelOrder);
```

``` EnlighterJSRAW
Order modelOrder = Order();
modelOrder.account = "DF12345";
modelOrder.modelCode = "Technology";
m_pClient->placeOrder(m_orderId++, contract, modelOrder);
```

``` EnlighterJSRAW
Order modelOrder = Order();
modelOrder.Account = "DF12345";  // master FA account number
modelOrder.ModelCode = "Technology"; // model for tech stocks first created in TWS
client.placeOrder(nextOrderId++, contract, modelOrder);
```

``` EnlighterJSRAW
Dim modelOrder As Order = Order()
modelOrder.Account = "DF12345" 'master FA account number
modelOrder.ModelCode = "Technology" 'model for tech stocks first created in TWS
client.placeOrder(increment(nextOrderId), contract, modelOrder)
```

### Unification of Groups and Profiles

With TWS/IBGW build 983+, the API settings will have a new flag/checkbox, **“Use Account Groups with Allocation Methods”** (enabled by default for new users). If not enabled, groups and profiles would behave the same as before. If it is checked, group and profile functionality will be merged.

With TWS/IBGW Build 10.20+, this setting is now enabled by default, and moving forward into new versions, the two systems can be deemed as interchangeable for modifying allocation groups, placing orders, requesting account or portfolio summaries, or requesting multiple positions.

### Order Placement

For advisors to place orders to their [allocation groups](https://www.interactivebrokers.com/campus/ibkr-api-page/twsapi-doc/#replace-fa) users would simply declare their allocation group name in the order object. This would be done with the Order’s faGroup field. The example to the right references a standard market order placed to our allocation group, MyTestProfile.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
order = Order()
order.action = "BUY"
order.orderType = "MKT"
order.totalQuantity = 50
order.faGroup = "MyTestProfile"
```

``` EnlighterJSRAW
Order order = new Order();
order.action("BUY");
order.orderType("MKT");
order.totalQuantity(50);
order.faGroup("MyTestProfile");
```

``` EnlighterJSRAW
Order order;
order.action = "BUY";
order.orderType = "MKT";
order.totalQuantity = 50;
order.faGroup = "MyTestProfile";
```

``` EnlighterJSRAW
Order order = new Order();
order.Action = "BUY";
order.OrderType = "MKT";
order.TotalQuantity = 50;
order.FaGroup = "MyTestProfile";
```

``` EnlighterJSRAW
Dim order As Order = New Order
order.Action = "BUY"
order.OrderType = "MKT"
order.TotalQuantity = 50
order.FaGroup = "MyTestProfile"
```

## Market Data: Delayed

Delayed market data can **only** be used with [EClient.reqMktData](https://www.interactivebrokers.com/campus/ibkr-api-page/trader-workstation-api/#watchlist-data) and [EClient.reqHistoricalData](https://www.interactivebrokers.com/campus/ibkr-api-page/trader-workstation-api/#historical-bars). This does not function for tick data.

The API can request Live, Frozen, Delayed and Delayed Frozen market data from Trader Workstation by switching market data type via the [EClient.reqMarketDataType](#request-md-type) before making a market data request. A successful switch to a different (non-live) market data type for a particular market data request will be indicated by a callback to [EWrapper.marketDataType](#receive-md-type "Returns the market data type (real-time, frozen, delayed, delayed-frozen) of ticker sent by EClientSo...") with the ticker ID of the market data request which is returning a different type of data.

  - A [EClient.reqMarketDataType](#request-md-type) callback of **1** will occur automatically after invoking reqMktData if the user has live data permissions for the instrument.

| Market Data Type | ID | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ---------------- | -- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Live             | 1  | Live market data is streaming data relayed back in real time. Market data subscriptions are required to receive live market data.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Frozen           | 2  | Frozen market data is the last data recorded at market close. In TWS, Frozen data is displayed in gray numbers. When you set the market data type to Frozen, you are asking TWS to send the last available quote when there is not one currently available. For instance, if a market is currently closed and real time data is requested, -1 values will commonly be returned for the bid and ask prices to indicate there is no current bid/ask data available. TWS will often show a ‘frozen’ bid/ask which represents the last value recorded by the system. To receive the last know bid/ask price before the market close, switch to market data type 2 from the API before requesting market data. API frozen data requires TWS/IBG v.962 or higher and the same market data subscriptions necessary for real time streaming data. |
| Delayed          | 3  | Free, delayed data is 15 – 20 minutes delayed. In TWS, delayed data is displayed in brown background. When you set market data type to delayed, you are telling TWS to automatically switch to delayed market data if the user does not have the necessary real time data subscription. If live data is available a request for delayed data would be ignored by TWS. Delayed market data is returned with delayed [Tick Types](#available-tick-types) (Tick ID 66\~76).                                                                                                                                                                                                                                                                                                                                                                  |
| Delayed Frozen   | 4  | Requests delayed “frozen” data for a user without market data subscriptions.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

### Market Data Type Behavior

1\) If user sends reqMarketDataType(1) – TWS will start sending only regular (1) market data.

2\) If user sends reqMarketDataType(2) – frozen, TWS will start sending regular (1) as default and frozen (2) market data. TWS sends marketDataType callback (1 or 2) indicating what market data will be sent after this callback. It can be regular or frozen.

3\) If user sends reqMarketDataType(3) – delayed, TWS will start sending regular (1) as default and delayed (3) market data.

4\) If user sends reqMarketDataType(4) – delayed-frozen, TWS will start sending regular (1) as default, delayed (3) and delayed-frozen (4) market data.

Interactive Brokers data will always try to provide the most up to date market data possible, but will permit additional delayed or frozen data if available upon request.

### Request Market Data Type

#### EClient.reqMarketDataType (

**marketDataType:** int. Type of market data to retrieve.  
)

Switches data type returned from reqMktData request to Live (1), Frozen (2), Delayed (3), or Frozen-Delayed (4).

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
self.reqMarketDataType(3)
```

``` EnlighterJSRAW
client.reqMarketDataType(2);
```

``` EnlighterJSRAW
m_pClient->reqMarketDataType(3);
```

``` EnlighterJSRAW
client.reqMarketDataType(3);
```

``` EnlighterJSRAW
client.reqMarketDataType(4)
```

### Receive Market Data Type

#### EWrapper.marketDataType (

**reqId:** int. Request identifier used to track data.

**marketDataType:** int. Type of market data to retrieve.  
)

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
def marketDataType(self, reqId: TickerId, marketDataType: int):
    print("MarketDataType. ReqId:", reqId, "Type:", marketDataType)
```

``` EnlighterJSRAW
@Override
public void marketDataType(int reqId, int marketDataType) {
    System.out.println("MarketDataType: " + EWrapperMsgGenerator.marketDataType(reqId, marketDataType));
}
```

``` EnlighterJSRAW
void TestCppClient::marketDataType(TickerId reqId, int marketDataType) {
    printf( "MarketDataType. ReqId: %ld, Type: %d\n", reqId, marketDataType);
}
```

``` EnlighterJSRAW
public virtual void marketDataType(int reqId, int marketDataType)
{
    Console.WriteLine("MarketDataType. "+reqId+", Type: "+marketDataType+"\n");
}
```

``` EnlighterJSRAW
Public Sub marketDataType(reqId As Integer, marketDataType As Integer) Implements IBApi.EWrapper.marketDataType
    Console.WriteLine("MarketDataType - ReqId [" & reqId & "] MarketDataType [" & marketDataType & "]")
End Sub
```

## Market Data: Historical

Historical Market data is available for Interactive Brokers market data subscribers in a range of methods and structures. This includes requests for historical bars, identical to the Trader Workstation, historical Time & Sales, as well as Histogram data.

### Historical Data Limitations

Historical market data has it’s own set of market data limitations unique to other requests such as real time market data. This section will cover all limitations that effect historical market data in the Trader Workstation API.

### Historical Data Filtering

Historical data at IB is filtered for trade types which occur away from the NBBO such as combo legs, block trades, and derivative trades. For that reason the daily volume from the (unfiltered) real time data functionality will generally be larger than the (filtered) historical volume reported by historical data functionality. Also, differences are expected in other fields such as the VWAP between the real time and historical data feeds.

As historical data at IB gets adjusted, compressed and filtered by default, there may be historical data differences if you request historical data at different time points.

### Historical Volume Scaling

Volume data returned for historical bars can be modified to return in shares or lots.

1.  Open the Global Configuration window
2.  Navigate to “API” and then “Settings” on the left pane
3.  Scroll down to the “Send market data in lots for US Stocks for dual-mode API clients”

If the setting is checked, historical volume data will return as a [Round Lot](https://www.investopedia.com/terms/r/roundlot.asp).

If the setting is unchecked, historical volume data will return in Shares.

### Pacing Violations for Small Bars (30 secs or less)

Although Interactive Brokers offers our clients high quality market data, IB is not a specialised market data provider and as such it is forced to put in place restrictions to limit traffic which is not directly associated to trading. A Pacing Violation occurs whenever one or more of the following restrictions is not observed:

Important: these limitations apply to all our clients and it is not possible to overcome them. If your trading strategy’s market data requirements are not met by our market data services please consider contacting a specialized provider.

  - Making identical historical data requests within 15 seconds.
  - Making six or more historical data requests for the same Contract, Exchange and Tick Type within two seconds.
  - Making more than 60 requests within any ten minute period.
  - Note that when BID\_ASK historical data is requested, each request is counted twice. In a nutshell, the information above can simply be put as “do not request too much data too quick”.

### Unavailable Historical Data

The other historical data limitations listed are general limitations for all trading platforms:

  - Bars whose size is 30 seconds or less older than six months
  - Expired futures data older than two years counting from the future’s expiration date.
  - Expired options, FOPs, warrants and structured products.
  - End of Day (EOD) data for options, FOPs, warrants and structured products.
  - Data for expired future spreads
  - Data for securities which are no longer trading.
  - Native historical data for combos. Historical data is not stored in the IB database separately for combos.; combo historical data in TWS or the API is the sum of data from the legs.
  - Historical data for securities which move to a new exchange will often not be available prior to the time of the move. For example, SOXX stock moved to NASDAQ exchange on 15 Oct 2010, so no SOXX data before 15 Oct 2010 can be retrieved despite SOXX was listed in 2001. This limitation also applied to contract which specifies `SMART` as the exchange.
  - Studies and indicators such as Weighted Moving Averages or Bollinger Bands are not available from the API.

### Finding the Earliest Available Data Point

For many functions, such as EClient.reqHistoricalData, you will need to request market data for a contract. Given that you may not know how long a symbol has been available, you can use EClient.reqHeadTimestamp to find the first available point of data for a given whatToShow value.

ReqHeadTimeStamp counts as an ongoing historical data request, similar to using EClient.reqHistoricalData’s keepUpToDate=True flag. As a result, users should always:

  - Cancel timestamp requests using [EClient.cancelHeadTimeStamp](https://www.interactivebrokers.com/campus/ibkr-api-page/twsapi-doc/#cancelling-earliest-data).
  - All EClient.reqHeadTimestamp requests follow the [30 second bar limitations](https://www.interactivebrokers.com/campus/ibkr-api-page/twsapi-doc/#historical-pacing-limitations), regardless of which bar size value has been requested.

### Requesting the Earliest Data Point

#### EClient.reqHeadTimestamp (

**tickerId:** int., A unique identifier which will serve to identify the incoming data.

**contract:** Contract**.** The IBApi.Contract you are interested in.

**whatToShow:** String. The type of data to retrieve. See Historical Data Types

**useRTH:** int. Whether (1) or not (0) to retrieve data generated only within Regular Trading Hours (RTH)

**formatDate:** int. Using 1 will return UTC time in YYYYMMDD-hh:mm:ss format. Using 2 will return epoch time.  
)

Returns the timestamp of earliest available historical data for a contract and data type.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
self.reqHeadTimeStamp(1, ContractSamples.USStockAtSmart(), "TRADES", 1, 1)
```

``` EnlighterJSRAW
client.reqHeadTimestamp(4003, contract, "TRADES", 1, 1);
```

``` EnlighterJSRAW
m_pClient->reqHeadTimestamp(14001, contract, "MIDPOINT", 1, 1);
```

``` EnlighterJSRAW
client.reqHeadTimestamp(14001, contract, "TRADES", 1, 1);
```

``` EnlighterJSRAW
client.reqHeadTimestamp(14001, ContractSamples.USStock(), "TRADES", 1, 1)
```

### Receiving the Earliest Data Point

#### EWrapper.headTimestamp (

**requestId:** int. Request identifier used to track data.

**headTimestamp:** String. Value identifying earliest data date  
)

The data requested will be returned to EWrapper.headTimeStamp.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
def headTimestamp(self, reqId, headTimestamp):
        print(reqId, headTimestamp)
```

``` EnlighterJSRAW
@Override
public void headTimestamp(int reqId, String headTimestamp) {
    System.out.println(EWrapperMsgGenerator.headTimestamp(reqId, headTimestamp));
}
```

``` EnlighterJSRAW
void TestCppClient::headTimestamp(int reqId, const std::string& headTimestamp) {
    printf( "Head time stamp. ReqId: %d - Head time stamp: %s,\n", reqId, headTimestamp.c_str());
}
```

``` EnlighterJSRAW
public void headTimestamp(int reqId, string headTimestamp)
{
    Console.WriteLine("Head time stamp. Request Id: {0}, Head time stamp: {1}", reqId, headTimestamp);
}
```

``` EnlighterJSRAW
Public Sub headTimestamp(requestId As Integer, timeStamp As String) Implements IBApi.EWrapper.headTimestamp
    Console.WriteLine("Head time stamp. Request Id: {0}, Head time stamp: {1}", requestId, timeStamp)
End Sub
```

### Cancelling Timestamp Requests

#### EWrapper.cancelHistogramData (

**tickerId:** int. Request identifier used to track data.  
)

A reqHeadTimeStamp request can be cancelled with EClient.cancelHeadTimestamp

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
self.cancelHeadTimeStamp(reqId)
```

``` EnlighterJSRAW
client.cancelHeadTimestamp(4003);
```

``` EnlighterJSRAW
m_pClient->cancelHeadTimestamp(14001);
```

``` EnlighterJSRAW
client.cancelHeadTimestamp(14001);
```

``` EnlighterJSRAW
client.cancelHeadTimestamp(14001)
```

### Historical Bars

Historical Bar data returns a candlestick value based on the requested duration and bar size. This will always return an open, high, low, and close values. Based on which whatToShow value is used, you may also receive volume data. See the [whatToShow section](#historical-whattoshow) for more details.

### Requesting Historical Bars

#### EClient.reqHistoricalData(

**reqId:** int, A unique identifier which will serve to identify the incoming data.

**contract:** Contract, The IBApi.Contract object you are working with.

**endDateTime:** String, The request’s end date and time. This should be formatted as “YYYYMMDD HH:mm:ss TMZ” or an empty string indicates current present moment).  
Please be aware that endDateTime must be left as an empty string when requesting continuous futures contracts.

**[durationStr:](https://www.interactivebrokers.com/campus/ibkr-api-page/trader-workstation-api/#hist-duration)** String, The amount of time (or Valid Duration String units) to go back from the request’s given end date and time.

**[barSizeSetting:](https://www.interactivebrokers.com/campus/ibkr-api-page/trader-workstation-api/#hist-bar-size)** String, The data’s granularity or Valid Bar Sizes

**[whatToShow:](https://www.interactivebrokers.com/campus/ibkr-api-page/trader-workstation-api/#historical-whattoshow)** String, The type of data to retrieve. See Historical Data Types

**useRTH:** bool, Whether (1) or not (0) to retrieve data generated only within Regular Trading Hours (RTH)

**[formatDate:](https://www.interactivebrokers.com/campus/ibkr-api-page/trader-workstation-api/#hist-format-date)** bool, The format in which the incoming bars’ date should be presented. Note that for day bars, only yyyyMMdd format is available.

**[keepUpToDate:](https://www.interactivebrokers.com/campus/ibkr-api-page/trader-workstation-api/#hist-keepUp-date)** bool, Whether a subscription is made to return updates of unfinished real time bars as they are available (True), or all data is returned on a one-time basis (False). If *True*, and endDateTime cannot be specified.  
Supported whatToShow values: Trades, Midpoint, Bid, Ask.

**chartOptions:** TagValueList, This is a field used exclusively for internal use.

)

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
self.reqHistoricalData(4102, contract, queryTime, "1 M", "1 day", "MIDPOINT", 1, 1, False, [])
```

``` EnlighterJSRAW
client.reqHistoricalData(4002, contract, formatted, "10 D", "1 min", "TRADES", 1, 1, false, null);
```

``` EnlighterJSRAW
m_pClient->reqHistoricalData(4001, contract, queryTime, "1 M", "1 day", "MIDPOINT", 1, 1, false, TagValueListSPtr());
```

``` EnlighterJSRAW
client.reqHistoricalData(4001, contract, queryTime, "1 M", "1 day", "MIDPOINT", 1, 1, false, null);
```

``` EnlighterJSRAW
client.reqHistoricalData(4001, contract, queryTime, "1 M", "1 day", "MIDPOINT", 1, 1, False, Nothing)
```

### Duration

The Interactive Brokers Historical Market Data maintains a duration parameter which specifies the overall length of time that data can be collected. The duration specified will derive the bars of data that can then be collected.

#### Valid Duration String Units:

| Unit | Description |
| ---- | ----------- |
| S    | Seconds     |
| D    | Day         |
| W    | Week        |
| M    | Month       |
| Y    | Year        |

### Historical Bar Sizes

Bar sizes dictate the data returned by historical bar requests. The bar size will dictate the scale over which the OHLC/V is returned to the API.

#### Valid Bar Sizes:

| Bar Unit | Bar Sizes                  |
| -------- | -------------------------- |
| secs     | 1, 5, 10, 15, 30           |
| mins     | 1, 2, 3, 5, 10, 15, 20, 30 |
| hours    | 1, 2, 3, 4, 8              |
| day      | 1                          |
| weeks    | 1                          |
| months   | 1                          |

### Step Sizes

The functionality of market data requests are predicated on preset step sizes. As such, not all bar sizes will work with all duration values. The table listed here will discuss the smallest to largest bar size value for each duration string.

| Duration Unit | Bar units allowed | Bar size Interval (Min/Max) |
| ------------- | ----------------- | --------------------------- |
| S             | secs | mins       | 1 secs -\> 1mins            |
| D             | secs | mins | hrs | 5 secs -\> 1 hours          |
| W             | sec | mins | hrs  | 10 secs -\> 4 hrs           |
| M             | sec | mins | hrs  | 30 secs -\> 8 hrs           |
| Y             | mins | hrs   | d  | 1 mins-\> 1 day             |

### Max Duration Per Bar Size

The table below displays the maximum duration values allowed for a given bar.

As an example, the maximum duration for Seconds values supported for 5 seconds bars are 86400 S. This means that if I want to retrieve more than 1 day’s worth of 5 second bars, I will then need to request data in increments of D (days).

| Bar Size | Max Second Duration | Max Day Duration | Max Week Duration | Max Month Duration | Max Year Duration |
| -------- | ------------------- | ---------------- | ----------------- | ------------------ | ----------------- |
| 1 secs   | 2000 S              | {Not Supported}  | {Not Supported}   | {Not Supported}    | {Not Supported}   |
| 5 secs   | 86400 S             | 365 D            | 52 W              | 12 M               | 68 Y              |
| 10 secs  | 86400 S             | 365 D            | 52 W              | 12 M               | 68 Y              |
| 15 secs  | 86400 S             | 365 D            | 52 W              | 12 M               | 68 Y              |
| 30 secs  | 86400 S             | 365 D            | 52 W              | 12 M               | 68 Y              |
| 1 min    | 86400 S             | 365 D            | 52 W              | 12 M               | 68 Y              |
| 2 mins   | 86400 S             | 365 D            | 52 W              | 12 M               | 68 Y              |
| 3 mins   | 86400 S             | 365 D            | 52 W              | 12 M               | 68 Y              |
| 5 mins   | 86400 S             | 365 D            | 52 W              | 12 M               | 68 Y              |
| 10 mins  | 86400 S             | 365 D            | 52 W              | 12 M               | 68 Y              |
| 15 mins  | 86400 S             | 365 D            | 52 W              | 12 M               | 68 Y              |
| 20 mins  | 86400 S             | 365 D            | 52 W              | 12 M               | 68 Y              |
| 30 mins  | 86400 S             | 365 D            | 52 W              | 12 M               | 68 Y              |
| 1 hour   | 86400 S             | 365 D            | 52 W              | 12 M               | 68 Y              |
| 2 hours  | 86400 S             | 365 D            | 52 W              | 12 M               | 68 Y              |
| 3 hours  | 86400 S             | 365 D            | 52 W              | 12 M               | 68 Y              |
| 4 hours  | 86400 S             | 365 D            | 52 W              | 12 M               | 68 Y              |
| 8 hours  | 86400 S             | 365 D            | 52 W              | 12 M               | 68 Y              |
| 1 day    | 86400 S             | 365 D            | 52 W              | 12 M               | 68 Y              |
| 1M       | 86400 S             | 365 D            | 52 W              | 12 M               | 68 Y              |
| 1W       | 86400 S             | 365 D            | 52 W              | 12 M               | 68 Y              |

### Format Date Received

Interactive Brokers will return historical market data based on the format set from the request. The formatDate parameter can be provided an integer value to indicate how data should be returned.

**Note:** Day bars will only return dates in the yyyyMMdd format. Time data is not available.

| Value | Description           | Example                               |
| ----- | --------------------- | ------------------------------------- |
| 1     | String Time Zone Date | “20231019 16:11:48 America/New\_York” |
| 2     | Epoch Date            | 1697746308                            |
| 3     | Day & Time Date       | “1019 16:11:48 America/New\_York”     |

### Keep Up To Date

When using keepUpToDate=True for historical data requests, you will see several bars returned with the same timestamp. This is because data is updated approximately every 4-6 seconds. These updates compound until the end of the specified bar size.

In our example to the below, 15 second bars are requested, and we can see the 30 second bar built out incrementally until 20231204 13:30:30 is completed. At which point, we move on to the 45th second bars. This same logic extends into minute, hourly, or daily bars.

##### Note:

keepUpToDate is only available for whatToShow: Trades, Midpoint, Bid, Ask

``` EnlighterJSRAW
Date: 20231204 13:30:30 US/Eastern, Open: 188.56, High: 188.56, Low: 188.54, Close: 188.55
Date: 20231204 13:30:30 US/Eastern, Open: 188.56, High: 188.56, Low: 188.54, Close: 188.55
Date: 20231204 13:30:30 US/Eastern, Open: 188.56, High: 188.56, Low: 188.54, Close: 188.55
Date: 20231204 13:30:30 US/Eastern, Open: 188.56, High: 188.56, Low: 188.54, Close: 188.55
Date: 20231204 13:30:30 US/Eastern, Open: 188.56, High: 188.56, Low: 188.54, Close: 188.55
Date: 20231204 13:30:30 US/Eastern, Open: 188.56, High: 188.56, Low: 188.54, Close: 188.56
Date: 20231204 13:30:30 US/Eastern, Open: 188.56, High: 188.56, Low: 188.54, Close: 188.56
Date: 20231204 13:30:30 US/Eastern, Open: 188.56, High: 188.57, Low: 188.54, Close: 188.55
Date: 20231204 13:30:45 US/Eastern, Open: 188.54, High: 188.54, Low: 188.54, Close: 188.54
```

### Receiving Historical Bars

#### EWrapper.historicalData (

**reqId:** int. Request identifier used to track data.

**bar:** Bar. The OHLC historical data Bar. The time zone of the bar is the time zone chosen on the TWS login screen. Smallest bar size is 1 second.  
)

The historical data will be delivered via the EWrapper.historicalData method in the form of candlesticks. The time zone of returned bars is the time zone chosen in TWS on the login screen.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
def historicalData(self, reqId:int, bar: BarData):
    print("HistoricalData. ReqId:", reqId, "BarData.", bar)
```

``` EnlighterJSRAW
@Override
public void historicalData(int reqId, Bar bar) {
    System.out.println("HistoricalData:  " + EWrapperMsgGenerator.historicalData(reqId, bar.time(), bar.open(), bar.high(), bar.low(), bar.close(), bar.volume(), bar.count(), bar.wap()));
}
```

``` EnlighterJSRAW
void TestCppClient::historicalData(TickerId reqId, const Bar& bar) {
    printf( "HistoricalData. ReqId: %ld - Date: %s, Open: %s, High: %s, Low: %s, Close: %s, Volume: %s, Count: %s, WAP: %s\n", reqId, bar.time.c_str(), 
        Utils::doubleMaxString(bar.open).c_str(), Utils::doubleMaxString(bar.high).c_str(), Utils::doubleMaxString(bar.low).c_str(), Utils::doubleMaxString(bar.close).c_str(), 
        decimalStringToDisplay(bar.volume).c_str(), Utils::intMaxString(bar.count).c_str(), decimalStringToDisplay(bar.wap).c_str());
}
```

``` EnlighterJSRAW
public virtual void historicalData(int reqId, Bar bar)
{
    Console.WriteLine("HistoricalData. " + reqId + " - Time: " + bar.Time + ", Open: " + Util.DoubleMaxString(bar.Open) + ", High: " + Util.DoubleMaxString(bar.High) + ", Low: " + Util.DoubleMaxString(bar.Low) + ", Close: " + Util.DoubleMaxString(bar.Close) + ", Volume: " + Util.DecimalMaxString(bar.Volume) + ", Count: " + Util.IntMaxString(bar.Count) + ", WAP: " + Util.DecimalMaxString(bar.WAP));
}
```

``` EnlighterJSRAW
public virtual void historicalData(int reqId, Bar bar)
{
    Console.WriteLine("HistoricalData. " + reqId + " - Time: " + bar.Time + ", Open: " + Util.DoubleMaxString(bar.Open) + ", High: " + Util.DoubleMaxString(bar.High) + ", Low: " + Util.DoubleMaxString(bar.Low) + ", Close: " + Util.DoubleMaxString(bar.Close) + ", Volume: " + Util.DecimalMaxString(bar.Volume) + ", Count: " + Util.IntMaxString(bar.Count) + ", WAP: " + Util.DecimalMaxString(bar.WAP));
}
```

#### Default Return Format

The text on the right is the default formatting for returning data.

The datetime value here was [modified to return UTC datetime](https://www.interactivebrokers.com/campus/ibkr-api-page/twsapi-doc/#modify-return-date) formatting.

**Note:** The datetime value indicates the **beginning** of the request range rather than the end. The last bar on the right would then indicate data that took place between 20241111-16:53:15 to 20241111-16:53:20.

``` EnlighterJSRAW
Date: 20241111-16:53:00, Open: 222.97, High: 222.97, Low: 222.96, Close: 222.97, Volume: 300, WAP: 222.965, BarCount: 2
Date: 20241111-16:53:05, Open: 222.97, High: 223.01, Low: 222.96, Close: 223.01, Volume: 5378, WAP: 222.981, BarCount: 38
Date: 20241111-16:53:10, Open: 223.02, High: 223.02, Low: 222.98, Close: 222.98, Volume: 3659, WAP: 222.997, BarCount: 24
Date: 20241111-16:53:15, Open: 222.98, High: 222.98, Low: 222.96, Close: 222.97, Volume: 2585, WAP: 222.963, BarCount: 24
```

#### EWrapper.historicalSchedule (

**reqId:** int. Request identifier used to track data.

**startDateTime:** String. Returns the start date and time of the historical schedule range.

**endDateTime:** String. Returns the end date and time of the historical schedule range.

**timeZone:** String. Returns the time zone referenced by the schedule.

**sessions:** HistoricalSession\[\]. Returns the full block of historical schedule data for the duration.  
)

In the case of whatToShow=”schedule”, you will need to also define the EWrapper.historicalSchedule value. This is a unique method that will only be called in the case of the unique whatToShow value to display calendar information.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
def historicalSchedule(self, reqId: int, startDateTime: str, endDateTime: str, timeZone: str, sessions: ListOfHistoricalSessions):
    print("HistoricalSchedule. ReqId:", reqId, "Start:", startDateTime, "End:", endDateTime, "TimeZone:", timeZone)
    for session in sessions:
        print("\tSession. Start:", session.startDateTime, "End:", session.endDateTime, "Ref Date:", session.refDate)
```

``` EnlighterJSRAW
@Override
public void historicalSchedule(int reqId, String startDateTime, String endDateTime, String timeZone, List sessions) {
    System.out.println(EWrapperMsgGenerator.historicalSchedule(reqId, startDateTime, endDateTime, timeZone, sessions));
}
```

``` EnlighterJSRAW
void TestCppClient::historicalSchedule(int reqId, const std::string& startDateTime, const std::string& endDateTime, const std::string& timeZone, const std::vector& sessions) {
    printf("Historical Schedule. ReqId: %d, Start: %s, End: %s, TimeZone: %s\n", reqId, startDateTime.c_str(), endDateTime.c_str(), timeZone.c_str());
    for (unsigned int i = 0; i < sessions.size(); i++) {
        printf("\tSession. Start: %s, End: %s, RefDate: %s\n", sessions[i].startDateTime.c_str(), sessions[i].endDateTime.c_str(), sessions[i].refDate.c_str());
    }
}
```

``` EnlighterJSRAW
public void historicalSchedule(int reqId, string startDateTime, string endDateTime, string timeZone, HistoricalSession[] sessions)
{
    Console.WriteLine($"Historical Schedule. ReqId: {reqId}, Start: {startDateTime}, End: {endDateTime}, Time Zone: {timeZone}");
    foreach (var session in sessions)
    {
        Console.WriteLine($"\tSession. Start: {session.StartDateTime}, End: {session.EndDateTime}, Ref Date: {session.RefDate}");
    }
}
```

``` EnlighterJSRAW
public void historicalSchedule(int reqId, string startDateTime, string endDateTime, string timeZone, HistoricalSession[] sessions)
{
    Console.WriteLine($"Historical Schedule. ReqId: {reqId}, Start: {startDateTime}, End: {endDateTime}, Time Zone: {timeZone}");
    foreach (var session in sessions)
    {
        Console.WriteLine($"\tSession. Start: {session.StartDateTime}, End: {session.EndDateTime}, Ref Date: {session.RefDate}");
    }
}
```

#### EWrapper.historicalDataUpdate (

**reqId:** int. Request identifier used to track data.

**bar:** Bar. The OHLC historical data Bar. The time zone of the bar is the time zone chosen on the TWS login screen. Smallest bar size is 1 second.  
)

Receives bars in real time if keepUpToDate is set as True in reqHistoricalData. Similar to realTimeBars function, except returned data is a composite of historical data and real time data that is equivalent to TWS chart functionality to keep charts up to date. Returned bars are successfully updated using real time data.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
def historicalDataUpdate(self, reqId: int, bar: BarData):
    print("HistoricalDataUpdate. ReqId:", reqId, "BarData.", bar)
```

``` EnlighterJSRAW
@Override
public void historicalDataUpdate(int reqId, Bar bar) {
    System.out.println("HistoricalDataUpdate. " + EWrapperMsgGenerator.historicalData(reqId, bar.time(), bar.open(), bar.high(), bar.low(), bar.close(), bar.volume(), bar.count(), bar.wap()));
}
```

``` EnlighterJSRAW
void TestCppClient::historicalDataUpdate(TickerId reqId, const Bar& bar) {
    printf( "HistoricalDataUpdate. ReqId: %ld - Date: %s, Open: %s, High: %s, Low: %s, Close: %s, Volume: %s, Count: %s, WAP: %s\n", reqId, bar.time.c_str(), 
        Utils::doubleMaxString(bar.open).c_str(), Utils::doubleMaxString(bar.high).c_str(), Utils::doubleMaxString(bar.low).c_str(), Utils::doubleMaxString(bar.close).c_str(), 
        decimalStringToDisplay(bar.volume).c_str(), Utils::intMaxString(bar.count).c_str(), decimalStringToDisplay(bar.wap).c_str());
}
```

``` EnlighterJSRAW
public void historicalDataUpdate(int reqId, Bar bar)
{
    Console.WriteLine("HistoricalDataUpdate. " + reqId + " - Time: " + bar.Time + ", Open: " + Util.DoubleMaxString(bar.Open) + ", High: " + Util.DoubleMaxString(bar.High) + 
        ", Low: " + Util.DoubleMaxString(bar.Low) + ", Close: " + Util.DoubleMaxString(bar.Close) + ", Volume: " + Util.DecimalMaxString(bar.Volume) + 
        ", Count: " + Util.IntMaxString(bar.Count) + ", WAP: " + Util.DecimalMaxString(bar.WAP));
}
```

``` EnlighterJSRAW
public void historicalDataUpdate(int reqId, Bar bar)
{
    Console.WriteLine("HistoricalDataUpdate. " + reqId + " - Time: " + bar.Time + ", Open: " + Util.DoubleMaxString(bar.Open) + ", High: " + Util.DoubleMaxString(bar.High) + ", Low: " + Util.DoubleMaxString(bar.Low) + ", Close: " + Util.DoubleMaxString(bar.Close) + ", Volume: " + Util.DecimalMaxString(bar.Volume) + ", Count: " + Util.IntMaxString(bar.Count) + ", WAP: " + Util.DecimalMaxString(bar.WAP));
}
```

#### EWrapper.historicalDataEnd (

**reqId:** int. Request identifier used to track data.

**start:** String. Returns the starting time of the first historical data bar.

**end:** String. Returns the end time of the last historical data bar.  
)

Marks the ending of the historical bars reception.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
def historicalDataEnd(self, reqId: int, start: str, end: str):
    print("HistoricalDataEnd. ReqId:", reqId, "from", start, "to", end)
```

``` EnlighterJSRAW
@Override
public void historicalDataEnd(int reqId, String startDateStr, String endDateStr) {
    System.out.println("HistoricalDataEnd. " + EWrapperMsgGenerator.historicalDataEnd(reqId, startDateStr, endDateStr));
}
```

``` EnlighterJSRAW
void TestCppClient::historicalDataEnd(int reqId, const std::string& startDateStr, const std::string& endDateStr) {
    std::cout << "HistoricalDataEnd. ReqId: " << reqId << " - Start Date: " << startDateStr << ", End Date: " << endDateStr << std::endl;   
}
```

``` EnlighterJSRAW
public virtual void historicalDataEnd(int reqId, string startDate, string endDate)
{
    Console.WriteLine("HistoricalDataEnd - "+reqId+" from "+startDate+" to "+endDate);
}
```

``` EnlighterJSRAW
public virtual void historicalDataEnd(int reqId, string startDate, string endDate)
        {
            Console.WriteLine("HistoricalDataEnd - "+reqId+" from "+startDate+" to "+endDate);
        }
```

### Historical Bar whatToShow

The historical bar types listed below can be used as the whatToShow value for historical bars. These values are used to request different data such as Trades, Midpoint, Bid\_Ask data and more. Some bar types support more products than others. Please note the **Supported Products** section for each bar type below.

### AGGTRADES

**Bar Values:**

| Open               | High                 | Low                 | Close             | Volume              |
| ------------------ | -------------------- | ------------------- | ----------------- | ------------------- |
| First traded price | Highest traded price | Lowest traded price | Last traded price | Total traded volume |

**Supported Products:** Cryptocurrency

### ADJUSTED\_LAST

**Bar Values:**

| Open               | High                 | Low                 | Close             | Volume              |
| ------------------ | -------------------- | ------------------- | ----------------- | ------------------- |
| First traded price | Highest traded price | Lowest traded price | Last traded price | Total traded volume |

**Supported Products:** ETFs, Options, Stocks

**NOTES:** ADJUSTED\_LAST data is adjusted for splits and dividends.

### ASK

**Bar Values:**

| Open               | High              | Low              | Close          | Volume |
| ------------------ | ----------------- | ---------------- | -------------- | ------ |
| Starting ask price | Highest ask price | Lowest ask price | Last ask price | N/A    |

**Supported Products:** Bonds, CFDs, Commodities, Cryptocurrencies, ETFs, FOPs, Forex, Funds, Futures,  Metals, Options, SSFs, Stocks, Structured Products, Warrants

### BID

**Bar Values:**

| Open               | High              | Low              | Close          | Volume |
| ------------------ | ----------------- | ---------------- | -------------- | ------ |
| Starting bid price | Highest bid price | Lowest bid price | Last bid price | N/A    |

**Supported Products:** Bonds, CFDs, Commodities, Cryptocurrencies, ETFs, FOPs, Forex, Funds, Futures,  Metals, Options, SSFs, Stocks, Structured Products, Warrants

### BID\_ASK

**Bar Values:**

| Open             | High    | Low     | Close            | Volume |
| ---------------- | ------- | ------- | ---------------- | ------ |
| Time average bid | Max Ask | Min Bid | Time average ask | N/A    |

**Supported Products:** Bonds, CFDs, Commodities, Cryptocurrencies, ETFs, FOPs, Forex, Funds, Futures, Metals, Options, SSFs, Stocks, Structured Products, Warrants

### FEE\_RATE

**Bar Values:**

| Open              | High             | Low             | Close         | Volume |
| ----------------- | ---------------- | --------------- | ------------- | ------ |
| Starting Fee Rate | Highest fee rate | Lowest fee rate | Last fee rate | N/A    |

**Supported Products:** Stocks, ETFs,

### HISTORICAL\_VOLATILITY

**Bar Values:**

| Open                | High               | Low               | Close           | Volume |
| ------------------- | ------------------ | ----------------- | --------------- | ------ |
| Starting volatility | Highest volatility | Lowest volatility | Last volatility | N/A    |

**Supported Products:** ETFs, Indices, Stocks

### MIDPOINT

**Bar Values:**

| Open                    | High                   | Low                   | Close               | Volume |
| ----------------------- | ---------------------- | --------------------- | ------------------- | ------ |
| Starting midpoint price | Highest midpoint price | Lowest midpoint price | Last midpoint price | N/A    |

**Supported Products:** Bonds, CFDs, Commodities, Cryptocurrencies, ETFs, FOPs, Forex, Funds, Futures,  Metals, Options, SSFs, Stocks, Structured Products, Warrants

### OPTION\_IMPLIED\_VOLATILITY

**Bar Values:**

| Open                        | High                       | Low                       | Close                   | Volume |
| --------------------------- | -------------------------- | ------------------------- | ----------------------- | ------ |
| Starting implied volatility | Highest implied volatility | Lowest implied volatility | Last implied volatility | N/A    |

**Supported Products:** ETFs, Indices, Stocks

### SCHEDULE

**Bar Values:**

| Open               | High              | Low              | Close          | Volume |
| ------------------ | ----------------- | ---------------- | -------------- | ------ |
| Starting ask price | Highest ask price | Lowest ask price | Last ask price | N/A    |

**Supported Products:** Bonds, CFDs, Commodities, Cryptocurrencies, ETFs, Forex, Funds, Futures, Indices, Metals,  SSFs, Stocks, Structured Products, Warrants

**NOTE:** SCHEDULE data returns only on 1 day bars but returns historical trading schedule only with no information about OHLCV.

### TRADES

**Bar Values:**

| Open               | High                 | Low                 | Close             | Volume              |
| ------------------ | -------------------- | ------------------- | ----------------- | ------------------- |
| First traded price | Highest traded price | Lowest traded price | Last traded price | Total traded volume |

**Supported Products:** Bonds, ETFs, FOPs, Futures, Indices, Metals, Options, SSFs, Stocks, Structured Products, Warrants

**NOTES:** TRADES data is adjusted for splits, but not dividends.

### YIELD\_ASK

**Bar Values:**

| Open               | High              | Low              | Close          | Volume |
| ------------------ | ----------------- | ---------------- | -------------- | ------ |
| Starting ask yield | Highest ask yield | Lowest ask yield | Last ask yield | N/A    |

**Supported Products:** Indices

**Note:** Yield historical data only available for corporate bonds.

### YIELD\_BID

**Bar Values:**

| Open               | High              | Low              | Close          | Volume |
| ------------------ | ----------------- | ---------------- | -------------- | ------ |
| Starting bid yield | Highest bid yield | Lowest bid yield | Last bid yield | N/A    |

**Supported Products:** Indices

**Note:** Yield historical data only available for corporate bonds.

### YIELD\_BID\_ASK

**Bar Values:**

| Open                   | High              | Low              | Close                  | Volume |
| ---------------------- | ----------------- | ---------------- | ---------------------- | ------ |
| Time average bid yield | Highest ask yield | Lowest bid yield | Time average ask yield | N/A    |

**Supported Products:** Indices

**Note:** Yield historical data only available for corporate bonds.

### YIELD\_LAST

**Bar Values:**

| Open                | High               | Low               | Close           | Volume |
| ------------------- | ------------------ | ----------------- | --------------- | ------ |
| Starting last yield | Highest last yield | Lowest last yield | Last last yield | N/A    |

**Supported Products:** Indices

**Note:** Yield historical data only available for corporate bonds.

### Histogram Data

Instead of returned data points as a function of time as with the function IBApi::EClient::reqHistoricalData, histograms return data as a function of price level with function IBApi::EClient::reqHistogramData

### Requesting Histogram Data

#### EClient.reqHistogramData (

**requestId:** int, id of the request

**contract:** Contract, Contract object that is subject of query.

**useRth:** bool, Data from regular trading hours (1), or all available hours (0).

**period:** String, string value of requested date range. This will be tied to the same bar size strings as the [historical bar sizes](https://www.interactivebrokers.com/campus/ibkr-api-page/trader-workstation-api/#hist-bar-size)  
)

Returns data histogram of specified contract.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
self.reqHistogramData(4004, contract, false, "3 days")
```

``` EnlighterJSRAW
client.reqHistogramData(4004, contract, false, "3 days");
```

``` EnlighterJSRAW
m_pClient->reqHistogramData(15001, contract, false, "1 weeks");
```

``` EnlighterJSRAW
client.reqHistogramData(15001, contract, false, "1 week");
```

``` EnlighterJSRAW
client.reqHistogramData(15001, contract, False, "1 week")
```

### Receiving Histogram Data

#### EWrapper.histogramData (

**requestId:** int. Request identifier used to track data.

**data:** HistogramEntry\[\]. Returned Tuple of histogram data, number of trades at specified price level.  
)

Returns relevant histogram data.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
def histogramData(self, reqId:int, items:HistogramDataList):
    print("HistogramData. reqid, items)
```

``` EnlighterJSRAW
@Override
public void histogramData(int reqId, List items) {
    System.out.println(EWrapperMsgGenerator.histogramData(reqId, items));
}
```

``` EnlighterJSRAW
void TestCppClient::histogramData(int reqId, const HistogramDataVector& data) {
    printf("Histogram. ReqId: %d, data length: %lu\n", reqId, data.size());
    for (const HistogramEntry& entry : data) {
        printf("\t price: %s, size: %s\n", Utils::doubleMaxString(entry.price).c_str(), decimalStringToDisplay(entry.size).c_str());
    }
}
```

``` EnlighterJSRAW
public void histogramData(int reqId, HistogramEntry[] data)
{
    Console.WriteLine("Histogram data. Request Id: {0}, data size: {1}", reqId, data.Length);
    data.ToList().ForEach(i => Console.WriteLine("\tPrice: {0}, Size: {1}", Util.DoubleMaxString(i.Price), Util.DecimalMaxString(i.Size)));
}
```

``` EnlighterJSRAW
Public Sub histogramData(reqId As Integer, data As HistogramEntry()) Implements EWrapper.histogramData
    Console.WriteLine("Histogram data. Request Id: {0}, data size: {1}", reqId, data.Length) 
    data.ToList().ForEach(Sub(i) Console.WriteLine(vbTab & "Price: {0}, Size: {1}", Util.DoubleMaxString(i.Price), Util.DecimalMaxString(i.Size)))
End Sub
```

### Cancelling Histogram Data

#### EClient.cancelHistogramData (

**tickerId:** int. Request identifier used to track data.  
)

An active histogram request which has not returned data can be cancelled with EClient.cancelHistogramData

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
self.reqHistogramData(4004)
```

``` EnlighterJSRAW
client.cancelHistogramData(4004);
```

``` EnlighterJSRAW
m_pClient->cancelHistogramData(15001);
```

``` EnlighterJSRAW
client.cancelHistogramData(15001);
```

``` EnlighterJSRAW
client.cancelHistogramData(15001)
```

### Historical Time & Sales

The highest granularity of historical data from IB’s database can be retrieved using the API function [EClient.reqHistoricalTicks](https://www.interactivebrokers.com/campus/ibkr-api-page/twsapi-doc/#requesting-time-and-sales) for historical time and sales values. Historical Time & Sales will return the same data as what is available in Trader Workstation under the Time and Sales window. This is a series of ticks indicating each trade based on the requested values.

  - Historical Tick-By-Tick data is not available for combos.
  - Data will not be returned from multiple trading sessions in a single request; Multiple requests must be used.
  - To complete a full second, more ticks may be returned than requested.
  - Time & Sales data requires a Level 1, Top Of Book market data subscription. This would be the same subscription as [EClient.reqMktData()](https://www.interactivebrokers.com/campus/ibkr-api-page/trader-workstation-api/#watchlist-data) or [EClient.reqHistoricalData()](https://www.interactivebrokers.com/campus/ibkr-api-page/trader-workstation-api/#historical-bars).

### Requesting Time and Sales data

#### EClient.reqHistoricalTicks (

**requestId:** *int*, id of the request

**contract:** *Contract*, Contract object that is subject of query.

**startDateTime:** *String*, i.e. “20170701 12:01:00”. Uses TWS timezone specified at login.

**endDateTime:** *String*, i.e. “20170701 13:01:00”. In TWS timezone. Exactly one of startDateTime or endDateTime must be defined.

**numberOfTicks:** *int*, Number of distinct data points. Max is 1000 per request.

**whatToShow:** *String*, (Bid\_Ask, Midpoint, or Trades) Type of data requested.

**useRth:** *bool*, Data from regular trading hours (1), or all available hours (0).

**ignoreSize:** *bool*, Omit updates that reflect only changes in size, and not price. Applicable to Bid\_Ask data requests.  
**Note:** Options and Future Options will only display a value of 1, unless to indicate a removed bid/ask, which will instead return a price and size value of 0.

**miscOptions:** *list,* Should be defined as *null*; reserved for internal use.  
)

Requests historical Time & Sales data for an instrument.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
self.reqHistoricalTicks(18001, contract, "20170712 21:39:33 US/Eastern", "", 10, "TRADES", 1, True, [])
```

``` EnlighterJSRAW
client.reqHistoricalTicks(18001, contract, "20220808 10:00:00 US/Eastern", null, 10, "TRADES", 1, true, null);
```

``` EnlighterJSRAW
m_pClient->reqHistoricalTicks(19001, contract, "20170621 09:38:33 US/Eastern", "", 10, "BID_ASK", 1, true, TagValueListSPtr());
```

``` EnlighterJSRAW
client.reqHistoricalTicks(18001, contract, "20170712 21:39:33 US/Eastern", null, 10, "TRADES", 1, true, null);
```

``` EnlighterJSRAW
client.reqHistoricalTicks(18001, contact, "20170712 21:39:33 US/Eastern", Nothing, 10, "TRADES", 1, True, Nothing)
```

### Receiving Time and Sales data

Data is returned to unique functions based on what is requested in the whatToShow field.

  - IBApi.EWrapper.historicalTicks for whatToShow=MIDPOINT
  - IBApi.EWrapper.historicalTicksBidAsk for whatToShow=BID\_ASK
  - IBApi.EWrapper.historicalTicksLast for for whatToShow=TRADES

#### EWrapper.historicalTicks (

**reqId:** int, id of the request

**ticks:** ListOfHistoricalTick, object containing a list of tick values for the requested timeframe.

**done:** bool, return whether or not this is the end of the historical ticks requested.  
)

For whatToShow=MIDPOINT

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
def historicalTicks(self, reqId: int, ticks: ListOfHistoricalTickLast, done: bool):
    for tick in ticks:
        print("historicalTicks. ReqId:", reqId, tick)
```

``` EnlighterJSRAW
@Override
public void historicalTicks(int reqId, List ticks, boolean done) {
    for (HistoricalTick tick : ticks) {
        System.out.println(EWrapperMsgGenerator.historicalTick(reqId, tick.time(), tick.price(), tick.size()));
    }
}
```

``` EnlighterJSRAW
void TestCppClient::historicalTicks(int reqId, const std::vector& ticks, bool done) {
    for (const HistoricalTick& tick : ticks) {
    std::time_t t = tick.time;
        std::cout << "Historical tick. ReqId: " << reqId << ", time: " << ctime(&t) << ", price: "<< Utils::doubleMaxString(tick.price).c_str() << ", size: " << decimalStringToDisplay(tick.size).c_str() << std::endl;
    }
}
```

``` EnlighterJSRAW
public void historicalTicks(int reqId, HistoricalTick[] ticks, bool done)
{
    foreach (var tick in ticks)
    {
        Console.WriteLine("Historical Tick. Request Id: {0}, Time: {1}, Price: {2}, Size: {3}", reqId, Util.UnixSecondsToString(tick.Time, "yyyyMMdd-HH:mm:ss"), Util.DoubleMaxString(tick.Price), Util.DecimalMaxString(tick.Size));
    }
}
```

``` EnlighterJSRAW
Public Sub historicalTick(reqId As Integer, ticks As HistoricalTick(), done As Boolean) Implements EWrapper.historicalTicks
    For Each tick In ticks
        Console.WriteLine("Historical Tick. Request Id: {0}, Time: {1}, Price: {2}, Size: {3}", reqId, Util.UnixSecondsToString(tick.Time, "yyyyMMdd-HH:mm:ss"), Util.DoubleMaxString(tick.Price), Util.DecimalMaxString(tick.Size))
    Next
End Sub
```

#### EWrapper.historicalTicksBidAsk (

**reqId:** int, id of the request

**ticks:** ListOfHistoricalTick, object containing a list of tick values for the requested timeframe.

**done:** bool, return whether or not this is the end of the historical ticks requested.  
)

For whatToShow=BidAsk

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
def historicalTicksBidAsk(self, reqId: int, ticks: ListOfHistoricalTickLast, done: bool):
    for tick in ticks:
        print("historicalTicksBidAsk. ReqId:", reqId, tick)
```

``` EnlighterJSRAW
@Override
public void historicalTicksBidAsk(int reqId, List ticks, boolean done) {
    for (HistoricalTickBidAsk tick : ticks) {
        System.out.println(EWrapperMsgGenerator.historicalTickBidAsk(reqId, tick.time(), tick.tickAttribBidAsk(), tick.priceBid(), tick.priceAsk(), tick.sizeBid(),
                tick.sizeAsk()));
    }
}   
```

``` EnlighterJSRAW
void TestCppClient::historicalTicksBidAsk(int reqId, const std::vector& ticks, bool done) {
    for (const HistoricalTickBidAsk& tick : ticks) {
        std::time_t t = tick.time;
        std::cout << "Historical tick bid/ask. ReqId: " << reqId << ", time: " << ctime(&t) << ", price bid: "<< Utils::doubleMaxString(tick.priceBid).c_str()  << ", price ask: "<< Utils::doubleMaxString(tick.priceAsk).c_str() << ", size bid: " << decimalStringToDisplay(tick.sizeBid).c_str() << ", size ask: " << decimalStringToDisplay(tick.sizeAsk).c_str() << ", bidPastLow: " << tick.tickAttribBidAsk.bidPastLow << ", askPastHigh: " << tick.tickAttribBidAsk.askPastHigh << std::endl;
    }
}
```

``` EnlighterJSRAW
public void historicalTicksBidAsk(int reqId, HistoricalTickBidAsk[] ticks, bool done)
{
    foreach (var tick in ticks)
    {
        Console.WriteLine("Historical Tick Bid/Ask. Request Id: {0}, Time: {1}, Price Bid: {2}, Price Ask: {3}, Size Bid: {4}, Size Ask: {5}, Bid/Ask Tick Attribs: {6} ", reqId, Util.UnixSecondsToString(tick.Time, "yyyyMMdd-HH:mm:ss"), Util.DoubleMaxString(tick.PriceBid), Util.DoubleMaxString(tick.PriceAsk), Util.DecimalMaxString(tick.SizeBid), Util.DecimalMaxString(tick.SizeAsk), tick.TickAttribBidAsk);
    }
}
```

``` EnlighterJSRAW
Public Sub historicalTickBidAsk(reqId As Integer, ticks As HistoricalTickBidAsk(), done As Boolean) Implements EWrapper.historicalTicksBidAsk
    For Each tick In ticks
        Console.WriteLine("Historical Tick Bid/Ask. Request Id: {0}, Time: {1}, Price Bid: {2}, Price Ask: {3}, Size Bid: {4}, Size Ask: {5}, Bid/Ask Tick Attribs: {6}", reqId, Util.UnixSecondsToString(tick.Time, "yyyyMMdd-HH:mm:ss"), Util.DoubleMaxString(tick.PriceBid), Util.DoubleMaxString(tick.PriceAsk), Util.DecimalMaxString(tick.SizeBid), Util.DecimalMaxString(tick.SizeAsk), tick.TickAttribBidAsk.ToString())
    Next
End Sub
```

#### EWrapper.historicalTicksLast (

**reqId:** int, id of the request

**ticks:** ListOfHistoricalTick, object containing a list of tick values for the requested timeframe.

**done:** bool, return whether or not this is the end of the historical ticks requested.  
)

For whatToShow=Last & AllLast

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
def historicalTicksLast(self, reqId: int, ticks: ListOfHistoricalTickLast, done: bool):
    for tick in ticks:
        print("HistoricalTickLast. ReqId:", reqId, tick)
```

``` EnlighterJSRAW
public void historicalTicksLast(int reqId, List ticks, boolean done) {
    for (HistoricalTickLast tick : ticks) {
        System.out.println(EWrapperMsgGenerator.historicalTickLast(reqId, tick.time(), tick.tickAttribLast(), tick.price(), tick.size(), tick.exchange(), 
            tick.specialConditions()));
    }
}
```

``` EnlighterJSRAW
void TestCppClient::historicalTicksLast(int reqId, const std::vector& ticks, bool done) {
    for (HistoricalTickLast tick : ticks) {
        std::time_t t = tick.time;
        std::cout << "Historical tick last. ReqId: " << reqId << ", time: " << ctime(&t) << ", price: "<< Utils::doubleMaxString(tick.price).c_str() << ", size: " << decimalStringToDisplay(tick.size).c_str() << ", exchange: " << tick.exchange << ", special conditions: " << tick.specialConditions << ", unreported: " << tick.tickAttribLast.unreported << ", pastLimit: " << tick.tickAttribLast.pastLimit << std::endl;
    }
}
```

``` EnlighterJSRAW
public void historicalTicksLast(int reqId, HistoricalTickLast[] ticks, bool done)
{
    foreach (var tick in ticks)
    {
        Console.WriteLine("Historical Tick Last. Request Id: {0}, Time: {1}, Price: {2}, Size: {3}, Exchange: {4}, Special Conditions: {5}, Last Tick Attribs: {6} ", reqId, Util.UnixSecondsToString(tick.Time, "yyyyMMdd-HH:mm:ss"), Util.DoubleMaxString(tick.Price), Util.DecimalMaxString(tick.Size), tick.Exchange, tick.SpecialConditions, tick.TickAttribLast);
    }
}
```

``` EnlighterJSRAW
Public Sub historicalTickLast(reqId As Integer, ticks As HistoricalTickLast(), done As Boolean) Implements EWrapper.historicalTicksLast
    For Each tick In ticks
        Console.WriteLine("Historical Tick Last. Request Id: {0}, Time: {1}, Price: {2}, Size: {3}, Exchange: {4}, Special Conditions: {5}, Last Tick Attribs: {6}", reqId, Util.UnixSecondsToString(tick.Time, "yyyyMMdd-HH:mm:ss"), Util.DoubleMaxString(tick.Price), Util.DecimalMaxString(tick.Size), tick.Exchange, tick.SpecialConditions, tick.TickAttribLast.ToString())
    Next
End Sub
```

### Historical Halted and Unhalted ticks

The tick attribute pastLimit is also returned with streaming Tick-By-Tick responses. Check Halted and Unhalted ticks section.

  - If tick has zero price, zero size and pastLimit flag is set – this is “Halted” tick.
  - If tick has zero price, zero size and followed immediately after “Halted” tick – this is “Unhalted” tick.

### Historical Date Formatting

When creating dates in the TWS API, Interactive Brokers typically supports three methods:

1.  [Operator Time Zone](https://www.interactivebrokers.com/campus/ibkr-api-page/trader-workstation-api/#operator-tz)
2.  [Exchange Time Zone](https://www.interactivebrokers.com/campus/ibkr-api-page/trader-workstation-api/#exchange-tz)
3.  [Coordinated Universal Time (UTC)](https://www.interactivebrokers.com/campus/ibkr-api-page/trader-workstation-api/#utc-tz)

### Operator Time Zone

Operator Time Zone is the local time set by the user in Trader Workstation. The Operator Time Zone typically maintains a unique formatting structure separate from Exchange Time Zones; however, they can match.

A user can confirm their Operator Time Zone by launching Trader Workstation then, before logging in, click “More Options \>”.

Users can then confirm their active Operator Time Zone by referencing the “Time Zone” field.

For US residents, this will typically appear as “America/New\_York”, “America/Chicago”, or “America/Los\_Angeles”. It is essential to note the Time Zone value, as this will be the value supplied when making requests with the Operator Time Zone.

After logging in to Trader Workstation or IB Gateway, you would be able to submit time stamps in the format of “YYYYMMDD HH:mm:ss Operator/Time\_Zone”.

Given our prior example, a historical data endDateTime value would appear as”20250101 23:59:59 America/Chicago”. This would mean the latest value I want is just before midnight in Chicago on January 1st, 2025. Even if I am trading contracts in New York or overseas, all historical data requests would be relative to my own time zone.

### Exchange Time Zone

The exchange Time Zone is the value the exchange itself uses to calculate time. This value is typically unique to the Operator Time Zone, but these values can overlap.

As an example, the New York Stock Exchange operates on “US/Eastern”. However, the CME operates on “US/Central”. This values can be programmatically requested using the EClient.reqContractDetails method, and then received from EWrapper.contractDetails in contractDetails.Time ZoneId.

Note that this will be interpreted differently from “America/Chicago”.

### Coordinated Universal Time (UTC)

UTC is a time standard centered around Greenwich Mean Time (GMT). UTC historical data can be formatted as “YYYYMMDD-hh:mm:ss”. Please keep in mind this is based on UTC+0, and as a reference, US/Eastern time is approximately UTC-4 or UTC-5 depending on U.S. Daylight savings.

Please note GMT is unaffected by Daylight savings, and so 09:00:00 will be the same time of day year round regardless of the exchange’s or your local daylight savings observation.

### Modifying Returned Date

You may also log in to the Trader Workstation and modify this in the Global Configuration under API and then Settings. Here, you will find a modifiable setting labeled “Send instrument-specific attributes for dual-mode API client in” Here you can select one of the following:

  - operator timezone: refers to the local timezone you have set in the Trader Workstation or IB Gateway
  - instrument timezone: refers to the timezone of the requested exchange. If “SMART” is used, this will use the instrument’s primary exchange.
  - UTC format: refers to a standardized return using UTC as the timezone. This will be returned in the format YYYYMMDD-hh:mm:ss

## Market Data: Live

### Live Data Limitations

For all data, besides [Delayed Watchlist Data](/campus/ibkr-api-page/twsapi-doc/#delayed-market-data), a paid data subscription is required to receive market data through the API. See the [Market Data Subscriptions](/campus/ibkr-api-page/market-data-subscriptions/) page for more information.

  - Live market data and historical bars are currently not available from the API for the exchange **OSE**. Only 15 minute delayed streaming data will be available for this exchange.

  - Some [Available Tick Types](/campus/ibkr-api-page/twsapi-doc/#available-tick-types) may not be provided due to the contract details, the time that you run the code…… ,etc. To verify whether the specific Available Tick Type is provided, it is suggested to manually check the data in TWS.

  - Different [Available Tick Types](/campus/ibkr-api-page/twsapi-doc/#available-tick-types) have different updating frequency.

The bid, ask, and last size quotes are displayed in shares instead of lots.

API users have the option to configure the TWS API to work in compatibility mode for older programs, but we recommend migrating to “quotes in shares” at your earliest convenience.

To display quotes as lots, from the Global Configuration \> API \> Settings page, check “Bypass US Stocks market data in shares warning for API orders.”

### 5 Second Bars

Real time and historical data functionality is combined through the EClient.reqRealTimeBars request. reqRealTimeBars will create an active subscription that will return a single bar in real time every five seconds that has the OHLC values over that period. reqRealTimeBars can only be used with a bar size of 5 seconds.

**Important:** real time bars subscriptions combine the limitations of both, top and historical market data. Make sure you observe Market Data Lines and [Pacing Violations for Small Bars (30 secs or less)](https://www.interactivebrokers.com/campus/ibkr-api-page/trader-workstation-api/#historical-pacing-limitations). For example, no more than 60 **\*new\*** requests for real time bars can be made in 10 minutes, and the total number of active active subscriptions of all types cannot exceed the maximum allowed market data lines for the user.

### Request Real Time Bars

#### EClient.reqRealTimeBars (

**tickerId:** int. Request identifier used to track data.

**contract:** Contract. The Contract object for which the depth is being requested

**barSize:** int. Currently being ignored

**whatToShow:** String. The nature of the data being retrieved:  
Available Values: TRADES, MIDPOINT, BID, ASK

**useRTH:** int. Set to 0 to obtain the data which was also generated outside of the Regular Trading Hours, set to 1 to obtain only the RTH data  
)

**realTimeBarOptions**: List\<TagValue\>. Internal use only.

Requests real time bars.

Only 5 seconds bars are provided. This request is subject to the same pacing as any historical data request: no more than 60 API queries in more than 600 seconds.

Real time bars subscriptions are also included in the calculation of the number of Level 1 market data subscriptions allowed in an account.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
self.reqRealTimeBars(3001, contract, 5, "MIDPOINT", 0, [])
```

Code example:

``` EnlighterJSRAW
from ibapi.client import *
from ibapi.wrapper import *
from ibapi.contract import Contract
import time

class TradeApp(EWrapper, EClient): 
    def __init__(self): 
        EClient.__init__(self, self) 

    def realtimeBar(self, reqId: TickerId, time:int, open_: float, high: float, low: float, close: float, volume: Decimal, wap: Decimal, count: int):
        print("RealTimeBar. TickerId:", reqId, RealTimeBar(time, -1, open_, high, low, close, volume, wap, count))
    
app = TradeApp()      
app.connect("127.0.0.1", 7496, clientId=1)

contract = Contract() 
contract.symbol = "AAPL" 
contract.secType = "STK" 
contract.currency = "USD" 
contract.exchange = "SMART" 

app.reqRealTimeBars(3001, contract, 5, "TRADES", 0, [])

app.run()
```

``` EnlighterJSRAW
client.reqRealTimeBars(3001, contract, 5, "MIDPOINT", true, null);
```

``` EnlighterJSRAW
m_pClient->reqRealTimeBars(3001, contract, 5, "MIDPOINT", true, TagValueListSPtr());
```

``` EnlighterJSRAW
client.reqRealTimeBars(3001, contract, 5, "MIDPOINT", true, null);
```

``` EnlighterJSRAW
client.reqRealTimeBars(3001, contract, 5, "MIDPOINT", True, Nothing)
```

### Receive Real Time Bars

#### EWrapper.realtimeBar (

**reqId:** int. Request identifier used to track data.

**time:** long. The bar’s start date and time (Epoch/Unix time)

**open:** double. The bar’s open point

**high:** double. The bar’s high point

**low:** double. The bar’s low point

**close:** double. The bar’s closing point

**volume:** decimal. The bar’s traded volume (only returned for TRADES data)

**WAP:** decimal. The bar’s Weighted Average Price rounded to minimum increment (only available for TRADES).

**count:** int. The number of trades during the bar’s timespan (only available for TRADES).  
)

Receives the real time 5 second bars.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
def realtimeBar(self, reqId: TickerId, time:int, open_: float, high: float, low: float, close: float, volume: Decimal, wap: Decimal, count: int):
    print("RealTimeBar. TickerId:", reqId, RealTimeBar(time, -1, open_, high, low, close, volume, wap, count))
```

``` EnlighterJSRAW
@Override
public void realtimeBar(int reqId, long time, double open, double high, double low, double close, Decimal volume, Decimal wap, int count) {
    System.out.println("RealTimeBar: " + EWrapperMsgGenerator.realtimeBar(reqId, time, open, high, low, close, volume, wap, count));
}
```

``` EnlighterJSRAW
void TestCppClient::realtimeBar(TickerId reqId, long time, double open, double high, double low, double close, Decimal volume, Decimal wap, int count) {
    printf( "RealTimeBars. %ld - Time: %s, Open: %s, High: %s, Low: %s, Close: %s, Volume: %s, Count: %s, WAP: %s\n", reqId, Utils::longMaxString(time).c_str(), Utils::doubleMaxString(open).c_str(), Utils::doubleMaxString(high).c_str(), Utils::doubleMaxString(low).c_str(), Utils::doubleMaxString(close).c_str(), decimalStringToDisplay(volume).c_str(), Utils::intMaxString(count).c_str(), decimalStringToDisplay(wap).c_str());
}
```

``` EnlighterJSRAW
public virtual void realtimeBar(int reqId, long time, double open, double high, double low, double close, decimal volume, decimal WAP, int count)
{
    Console.WriteLine("RealTimeBars. " + reqId + " - Time: " + Util.LongMaxString(time) + ", Open: " + Util.DoubleMaxString(open) + ", High: " + Util.DoubleMaxString(high) +  ", Low: " + Util.DoubleMaxString(low) + ", Close: " + Util.DoubleMaxString(close) + ", Volume: " + Util.DecimalMaxString(volume) + ", Count: " + Util.IntMaxString(count) + ", WAP: " + Util.DecimalMaxString(WAP));
}
```

``` EnlighterJSRAW
Public Sub realtimeBar(reqId As Integer, time As Long, open As Double, high As Double, low As Double, close As Double, volume As Decimal, WAP As Decimal, count As Integer) Implements IBApi.EWrapper.realtimeBar
    Console.WriteLine("RealTimeBars. " & reqId & " - Time: " & Util.LongMaxString(time) & ", Open: " & Util.DoubleMaxString(open) & ", High: " & Util.DoubleMaxString(high) & ", Low: " & Util.DoubleMaxString(low) & ", Close: " & Util.DoubleMaxString(close) & ", Volume: " & Util.DecimalMaxString(volume) & ", Count: " & Util.IntMaxString(count) & ", WAP: " & Util.DecimalMaxString(WAP))
End Sub
```

### Cancel Real Time Bars

#### EClient.cancelRealTimeBars (

**tickerId:** int. Request identifier used to track data.  
)

Cancels Real Time Bars’ subscription.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
self.cancelRealTimeBars(3001)
```

``` EnlighterJSRAW
client.cancelRealTimeBars(3001);
```

``` EnlighterJSRAW
m_pClient->cancelRealTimeBars(3001);
```

``` EnlighterJSRAW
client.cancelRealTimeBars(3001);
```

``` EnlighterJSRAW
client.cancelRealTimeBars(3001)
```

### Component Exchanges

A single data request from the API can receive aggregate quotes from multiple exchanges. The tick types ‘bidExch’ (tick type 32), ‘askExch’ (tick type 33), ‘lastExch’ (tick type 84) are used to identify the source of a quote. To preserve bandwidth, the data returned to these tick types consists of a sequence of capital letters rather than a long list of exchange names for every returned exchange name field. To find the full exchange name corresponding to a single letter code returned in tick types 32, 33, or 84, and API function IBApi::[EClient::reqSmartComponents](#exchange-component-mapping) is available. Note: This function can only be used when the exchange is open.

Different IB contracts have a different exchange map containing the set of exchanges on which they trade. Each exchange map has a different code, such as “a6” or “a9”. This exchange mapping code is returned to [EWrapper.tickReqParams](#exchange-component-mapping) immediately after a market data request is made by a user with market data subscriptions. To find a particular map of single letter codes to full exchange names, the function reqSmartComponents is invoked with the exchange mapping code returned to tickReqParams.

For instance, a market data request for the IBKR US contract may return the exchange mapping identifier “a6” to [EWrapper.tickReqParams](#exchange-component-mapping) . Invoking the function [EClient.reqSmartComponents](#exchange-component-mapping) with the symbol “a9” will reveal the list of exchanges offering market data for the IBKR US contract, and their single letter codes. The code for “ARCA” may be “P”. In that case if “P” is returned to the exchange tick types, that would indicate the quote was provided by ARCA.

### Request Component Exchanges

#### EClient.reqSmartComponents (

**reqId:** int. Request identifier used to track data.

**bboExchange:** String. Mapping identifier received from EWrapper.tickReqParams  
)

Returns the mapping of single letter codes to exchange names given the mapping identifier.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
self.reqSmartComponents(1018, "a6")
```

``` EnlighterJSRAW
client.reqSmartComponents(1013, "a6");
```

``` EnlighterJSRAW
m_pClient->reqSmartComponents(13002, m_bboExchange);
```

``` EnlighterJSRAW
client.reqSmartComponents(13002, testImpl.BboExchange);
```

``` EnlighterJSRAW
client.reqSmartComponents(13002, wrapperImpl.BboExchange)
```

### Receive Component Exchanges

#### EWrapper.smartComponents (

**reqId:** int. Request identifier used to track data.

**smartComponentMap:** SmartComponentMap. Unique object containing a map of all key-value pairs  
)

Containing a bit number to exchange + exchange abbreviation dictionary. All IDs can be initially retrieved using [reqTickParams](#exchange-component-mapping).

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
def smartComponents(self, reqId:int, smartComponentMap:SmartComponentMap):
    print("SmartComponents:")
    for smartComponent in smartComponentMap:
        print("SmartComponent.", smartComponent)
```

``` EnlighterJSRAW
@Override
public void smartComponents(int reqId, Map<Integer, Entry> theMap) {
    System.out.println(EWrapperMsgGenerator.smartComponents(reqId, theMap));
}
```

``` EnlighterJSRAW
void TestCppClient::smartComponents(int reqId, const SmartComponentsMap& theMap) {
    printf("Smart components: (%lu):\n", theMap.size());
    for (SmartComponentsMap::const_iterator i = theMap.begin(); i != theMap.end(); i++) {
        printf(" bit number: %d exchange: %s exchange letter: %c\n", i->first, std::get(i->second).c_str(), std::get(i->second));
    }
}
```

``` EnlighterJSRAW
public void smartComponents(int reqId, Dictionary<int, KeyValuePair> theMap)
{
    StringBuilder sb = new StringBuilder();
    sb.AppendFormat("==== Smart Components Begin (total={0}) reqId = {1} ====\n", theMap.Count, reqId);
    foreach (var item in theMap)
    {
        sb.AppendFormat("bit number: {0}, exchange: {1}, exchange letter: {2}\n", item.Key, item.Value.Key, item.Value.Value);
    }
    sb.AppendFormat("==== Smart Components Begin (total={0}) reqId = {1} ====\n", theMap.Count, reqId);
    Console.WriteLine(sb);
}
```

``` EnlighterJSRAW
Public Sub smartComponents(reqId As Integer, theMap As Dictionary(Of Integer, KeyValuePair(Of String, Char))) Implements EWrapper.smartComponents
    Dim sb As New StringBuilder
    sb.AppendFormat("==== Smart Components Begin (total={0}) reqId = {1} ===={2}", theMap.Count, reqId, Environment.NewLine)
    For Each item In theMap
        sb.AppendFormat("bit number: {0}, exchange: {1}, exchange letter: {2}{3}", item.Key, item.Value.Key, item.Value.Value, Environment.NewLine)
    Next
    sb.AppendFormat("==== Smart Components Begin (total={0}) reqId = {1} ===={2}", theMap.Count, reqId, Environment.NewLine)
    Console.WriteLine(sb)
End Sub
```

### Market Depth Exchanges

To check which exchanges offer deep book data, the function EClient.reqMktDepthExchanges can be invoked. It will return a list of exchanges from where market depth is available if the user has the appropriate market data subscription.

API ‘Exchange’ fields for which a market depth request would return market maker information and result in a callback to EWrapper.updateMktDepthL2 will be indicated in the results from the EWrapper.mktDepthExchanges field by a ‘True’ value in the ‘isL2’ field:

### Requesting Market Depth Exchanges

#### EClient.reqMktDepthExchanges ()

Requests venues for which market data is returned to updateMktDepthL2 (those with market makers).

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
self.reqMktDepthExchanges()
```

``` EnlighterJSRAW
client.reqMktDepthExchanges();
```

``` EnlighterJSRAW
m_pClient->reqMktDepthExchanges();
```

``` EnlighterJSRAW
client.reqMktDepthExchanges();
```

``` EnlighterJSRAW
client.reqMktDepthExchanges()
```

### Receive Market Depth Exchanges

#### EWrapper.mktDepthExchanges (

**depthMktDataDescriptions:** DepthMktDataDescription\[\]. A list containing all available exchanges offering market depth.  
)

Called when receives Depth Market Data Descriptions.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
def mktDepthExchanges(self, depthMktDataDescriptions:ListOfDepthExchanges):
    print("MktDepthExchanges:")
    for desc in depthMktDataDescriptions:
        print("DepthMktDataDescription.", desc)
```

``` EnlighterJSRAW
@Override
public void mktDepthExchanges(DepthMktDataDescription[] depthMktDataDescriptions) {
    System.out.println(EWrapperMsgGenerator.mktDepthExchanges(depthMktDataDescriptions));
}
```

``` EnlighterJSRAW
void TestCppClient::mktDepthExchanges(const std::vector &depthMktDataDescriptions) {
    printf("Mkt Depth Exchanges (%lu):\n", depthMktDataDescriptions.size());
    for (unsigned int i = 0; i < depthMktDataDescriptions.size(); i++) {
        printf("Depth Mkt Data Description [%d] - exchange: %s secType: %s listingExch: %s serviceDataType: %s aggGroup: %s\n", i, depthMktDataDescriptions[i].exchange.c_str(), depthMktDataDescriptions[i].secType.c_str(), depthMktDataDescriptions[i].listingExch.c_str(), depthMktDataDescriptions[i].serviceDataType.c_str(), Utils::intMaxString(depthMktDataDescriptions[i].aggGroup).c_str());
    }
}
```

``` EnlighterJSRAW
public void mktDepthExchanges(DepthMktDataDescription[] depthMktDataDescriptions)
{
    Console.WriteLine("Market Depth Exchanges:");
    foreach (var depthMktDataDescription in depthMktDataDescriptions)
    {
        Console.WriteLine("Depth Market Data Description: Exchange: {0}, Security Type: {1}, Listing Exch: {2}, Service Data Type: {3}, Agg Group: {4}", depthMktDataDescription.Exchange, depthMktDataDescription.SecType, depthMktDataDescription.ListingExch, depthMktDataDescription.ServiceDataType, Util.IntMaxString(depthMktDataDescription.AggGroup));
    }
}
```

``` EnlighterJSRAW
Public Sub mktDepthExchanges(depthMktDataDescriptions As DepthMktDataDescription()) Implements EWrapper.mktDepthExchanges
    Console.WriteLine("Market Depth Exchanges:")
    For Each depthMktDataDescription In depthMktDataDescriptions
        Console.WriteLine("Depth Market Data Descriprion. Exchange: " & depthMktDataDescription.Exchange & " Security Type: " & depthMktDataDescription.SecType & " Listing Exch: " & depthMktDataDescription.ListingExch & " Service Data Type: " & depthMktDataDescription.ServiceDataType & "  Agg Group: " & Util.IntMaxString(depthMktDataDescription.AggGroup))
    Next
End Sub
```

### Market Depth (L2)

Market depth data, also known as level II, represents an instrument’s order book. Via the TWS API it is possible to obtain this information with the [EClient.reqMarketDepth](/campus/ibkr-api-page/twsapi-doc/#request-market-depth) function.

Unlike [Top Market Data (Level I)](/campus/ibkr-api-page/twsapi-doc/#watchlist-data), market depth data is sent without sampling or filtering, however we cannot guarantee that every price quoted for a particular security will be displayed. In particular, odd lot orders are not included.

It is possible to Smart-route a [EClient.reqMarketDepth](/campus/ibkr-api-page/twsapi-doc/#request-market-depth) request to receive aggregated data from all available exchanges.

An integral part of processing the incoming data is monitoring [EWrapper.error](/campus/ibkr-api-page/twsapi-doc/#error) for message 317 “Market depth data has been RESET. Please empty deep book contents before applying any new entries.” and handling it appropriately, otherwise the update process would be corrupted.

Market Depth is not support for Calendar Spreads or Combos.

### Request Market Depth

**Important:** Please note that the languages use different method names for requesting market depth.

The C\# and Visual Basic APIs use **reqMarketDepth()**.

The Python, Java, and C++ APIs use **reqMktDepth()**.

#### EClient.reqMarketDepth (

**tickerId:** int. Request identifier used to track data.

**contract:** Contract. The Contract for which the depth is being requested.

**numRows:** int. The number of rows on each side of the order book.

**isSmartDepth:** bool. Flag indicates that this is a Smart-routed market depth request. Supplying true will return data identical to the [TWS Book Trader](https://www.ibkrguides.com/traderworkstation/booktrader.htm) while False returns direct routed data similar to the [TWS Market Depth tool](https://www.ibkrguides.com/traderworkstation/level-ii-market-depth.htm).

**mktDepthOptions:** List. Internal use only. Leave an empty array or None type.  
)

Requests the contract’s market depth (order book).

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
self.reqMktDepth(2001, contract, 5, False, [])
```

``` EnlighterJSRAW
client.reqMktDepth(2001, contract, 5, false, null);
```

``` EnlighterJSRAW
m_pClient->reqMktDepth(2001, contract, 5, false, TagValueListSPtr());
```

``` EnlighterJSRAW
client.reqMarketDepth(2001, contract, 5, false, null);
```

``` EnlighterJSRAW
client.reqMarketDepth(2001, contract, 5, False, Nothing)
```

### Receive Market Depth

#### EWrapper.updateMktDepth (

**tickerId:** int. Request identifier used to track data.

**position:** int. The order book’s row being updated

**operation:** int. Indicates a change in the row’s value.:

  - 0 = insert (insert new price into the row)·
  - 1 = update (update the existing order in the row)·
  - 2 = delete (delete the existing order at the row).

**side:** int. 0 for ask, 1 for bid

**price:** double. The order’s price

**size:** decimal. The order’s size  
)

Returns the order book. Used for direct routed requests only.  
 

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
def updateMktDepth(self, reqId: TickerId, position: int, operation: int, side: int, price: float, size: Decimal):
        print("UpdateMarketDepth. ReqId:", reqId, "Position:", position, "Operation:", operation, "Side:", side, "Price:", floatMaxString(price), "Size:", decimalMaxString(size))
```

``` EnlighterJSRAW
@Override
public void updateMktDepth(int tickerId, int position, int operation, int side, double price, Decimal size) {
    System.out.println(EWrapperMsgGenerator.updateMktDepth(tickerId, position, operation, side, price, size));
}
```

``` EnlighterJSRAW
void TestCppClient::updateMktDepth(TickerId id, int position, int operation, int side, double price, Decimal size) {
    printf( "UpdateMarketDepth. %ld - Position: %s, Operation: %d, Side: %d, Price: %s, Size: %s\n", id, Utils::intMaxString(position).c_str(), operation, side, Utils::doubleMaxString(price).c_str(), decimalStringToDisplay(size).c_str());
}
```

``` EnlighterJSRAW
public virtual void updateMktDepth(int tickerId, int position, int operation, int side, double price, decimal size)
{
    Console.WriteLine("UpdateMarketDepth. " + tickerId + " - Position: " + position + ", Operation: " + operation + ", Side: " + side + ", Price: " + Util.DoubleMaxString(price) + ", Size: " + Util.DecimalMaxString(size));
}
```

``` EnlighterJSRAW
Public Sub updateMktDepth(tickerId As Integer, position As Integer, operation As Integer, side As Integer, price As Double, size As Decimal) Implements IBApi.EWrapper.updateMktDepth
    Console.WriteLine("UpdateMarketDepth. " & CStr(tickerId) & " - Position: " & CStr(position) & ", Operation: " & CStr(operation) & ", Side: " & CStr(side) & ", Price: " & Util.DoubleMaxString(price) & ", Size: " & Util.DecimalMaxString(size))
End Sub
```

#### EWrapper.updateMktDepthL2 (

**tickerId:** int. Request identifier used to track data.

**position:** int. The order book’s row being updated.

**marketMaker:** String. The exchange holding the order if isSmartDepth is True, otherwise the MPID of the market maker.

**operation:** int. Indicates a change in the row’s value.:

  - 0 = insert (insert new price into the row)·
  - 1 = update (update the existing order in the row)·
  - 2 = delete (delete the existing order at the row).

**side:** int. 0 for ask, 1 for bid

**price:** double. The order’s price

**size:** decimal. The order’s size

**isSmartDepth:** bool. Flag indicating if this is smart depth response (True) or the MPID of the market maker.  
)

Returns the order book.  
 

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
def updateMktDepthL2(self, reqId: TickerId, position: int, marketMaker: str, operation: int, side: int, price: float, size: Decimal, isSmartDepth: bool):
    print("UpdateMarketDepthL2. ReqId:", reqId, "Position:", position, "MarketMaker:", marketMaker, "Operation:", operation, "Side:", side, "Price:", floatMaxString(price), "Size:", decimalMaxString(size), "isSmartDepth:", isSmartDepth)
```

``` EnlighterJSRAW
@Override
public void updateMktDepthL2(int tickerId, int position, String marketMaker, int operation, int side, double price, Decimal size, boolean isSmartDepth) {
    System.out.println(EWrapperMsgGenerator.updateMktDepthL2( tickerId, position, marketMaker, operation, side, price, size, isSmartDepth));
}
```

``` EnlighterJSRAW
void TestCppClient::updateMktDepthL2(TickerId id, int position, const std::string& marketMaker, int operation, int side, double price, Decimal size, bool isSmartDepth) {
    printf( "UpdateMarketDepthL2. %ld - Position: %s, Operation: %d, Side: %d, Price: %s, Size: %s, isSmartDepth: %d\n", id, Utils::intMaxString(position).c_str(), operation, side, Utils::doubleMaxString(price).c_str(), decimalStringToDisplay(size).c_str(), isSmartDepth);
}
```

``` EnlighterJSRAW
public virtual void updateMktDepthL2(int tickerId, int position, string marketMaker, int operation, int side, double price, decimal size, bool isSmartDepth)
{
    Console.WriteLine("UpdateMarketDepthL2. " + tickerId + " - Position: " + position + ", Operation: " + operation + ", Side: " + side + ", Price: " + Util.DoubleMaxString(price) + ", Size: " + Util.DecimalMaxString(size) + ", isSmartDepth: " + isSmartDepth);
}
```

``` EnlighterJSRAW
Public Sub updateMktDepthL2(tickerId As Integer, position As Integer, marketMaker As String, operation As Integer, side As Integer, price As Double, size As Decimal, isSmartDepth As Boolean) Implements IBApi.EWrapper.updateMktDepthL2
    Console.WriteLine("UpdateMarketDepthL2. " & CStr(tickerId) & " MarketMaker: " & marketMaker & ", Position: " & CStr(position) & ", Operation: " & CStr(operation) & ", Side: " & CStr(side) & ", Price: " & Util.DoubleMaxString(price) & ", Size: " & Util.DecimalMaxString(size) & ", isSmartDepth: " & CStr(isSmartDepth))
End Sub
```

### Cancel Market Depth

#### EClient.cancelMarketDepth (

**tickerId:** int. Request identifier used to track data.

**isSmartDepth:** bool. Flag indicates that this is smart depth request.

)

Cancel’s market depth’s request.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
self.cancelMktDepth(2001, False)
```

``` EnlighterJSRAW
client.cancelMktDepth(2001, false);
```

``` EnlighterJSRAW
m_pClient->cancelMktDepth(2001, false);
```

``` EnlighterJSRAW
client.cancelMktDepth(2001, false);
```

``` EnlighterJSRAW
client.cancelMktDepth(2001, False)
```

### Option Greeks

The option greek values- delta, gamma, theta, vega- are returned by default following a reqMktData() request for the option. See Available Tick Types

Tick types “Bid Option Computation” (\#10), “Ask Option Computation” (\#11), “Last Option Computation” (\#12), and “Model Option Computation” (\#13) return all Greeks (delta, gamma, vega, theta), the underlying price and the stock and option reference price when requested.

MODEL\_OPTION\_COMPUTATION also returns model implied volatility.

Note that to receive live greek values it is necessary to have market data subscriptions for both the option and the underlying contract.

The implied volatility for an option given its price and the price of the underlying can be calculated with the function EClient.calculateImpliedVolatility.

Alternatively, given the price of the underlying and an implied volatility it is possible to calculate the option price using the function EClient.calculateOptionPrice.

After the request, the option specific information will be delivered via the EWrapper.tickOptionComputation method.

### Request Options Greeks

#### EClient.reqMktData (

**reqId:** int. Request identifier for tracking data.

**contract:** Contract. Contract object used for specifying an instrument.

**genericTickList:** String. Comma separated ids of the available generic ticks.

**snapshot:** bool. Set to True for snapshot data with a relevant subscription or False for live data.

**regulatorySnapshot:** bool. Set to True for a paid, regulatory snapshot or False for live data.

**mktDataOptions:** List\<TagValue\>. Internal use only.  
)

Greeks are requested automatically when pulling market data for an Options contract.  
Users that do not have a valid [Market Data Subscription](/campus/ibkr-api-page/market-data-subscriptions/#popular-md-subscriptions) for the underlying contract will receive an error that Market Data Is Not Subscribed. This error can be ignored if Greeks are not wanted.  
 

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
self.reqMktData(reqId, OptionContract, "", False, False, [])
```

``` EnlighterJSRAW
client.reqMktData(reqId, OptionContract, "", false, false, null);
```

``` EnlighterJSRAW
m_pClient->reqMktData(reqId, OptionContract, "", false, false, TagValueListSPtr());
```

``` EnlighterJSRAW
client.reqMktData(reqId, OptionContract, "", false, false, null);
```

``` EnlighterJSRAW
client.reqMktData(reqId, OptionContract, "", False, False, Nothing)
```

### Calculating option prices

#### EClient.calculateOptionPrice (

**reqId:** int. Request identifier used to track data.

**contract:** Contract. The Contract object for which the depth is being requested

**volatility:** double. Hypothetical volatility.

**underPrice:** double. Hypothetical option’s underlying price.

**optionPriceOptions:** List\<TagValue\>. Internal use only. Send an empty tag value list.  
)

Calculates an option’s price based on the provided volatility and its underlying’s price.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
self.calculateOptionPrice(5002, OptionContract, 0.6, 55, [])
```

``` EnlighterJSRAW
client.calculateOptionPrice(5002, OptionContract, 0.5, 55, null);
```

``` EnlighterJSRAW
m_pClient->calculateOptionPrice(5002, OptionContract, 0.6, 55, TagValueListSPtr());
```

``` EnlighterJSRAW
client.calculateOptionPrice(5002, OptionContract, 0.6, 55, null);
```

``` EnlighterJSRAW
client.calculateOptionPrice(5002, OptionContract, 0.6, 55, Nothing)
```

### Calculating historical volatility

#### EClient.calculateImpliedVolatility (

**reqId:** int. Request identifier used to track data.

**contract:** Contract. The Contract object for which the depth is being requested

**optionPrice:** double. Hypothetical option price.

**underPrice:** double. Hypothetical option’s underlying price.

**impliedVolatilityOptions:** List\<TagValue\>. Internal use only. Send an empty tag value list.  
)

Calculate the volatility for an option. Request the calculation of the implied volatility based on hypothetical option and its underlying prices.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
self.calculateImpliedVolatility(5001, OptionContract, 0.5, 55, [])
```

``` EnlighterJSRAW
client.calculateImpliedVolatility(5001, OptionContract, 0.6, 55, null);
```

``` EnlighterJSRAW
m_pClient->calculateImpliedVolatility(5001, OptionContract, 0.5, 55, TagValueListSPtr());
```

``` EnlighterJSRAW
client.calculateImpliedVolatility(5001, OptionContract, 0.5, 55, null);
```

``` EnlighterJSRAW
client.calculateImpliedVolatility(5001, OptionContract, 0.5, 55, Nothing)
```

### Receiving Options Data

#### EWrapper.tickOptionComputation (

**tickerId** the request’s unique identifier.

**field:** int. Specifies the type of option computation.  
Pass the field value into  
TickType.getField(int tickType) to retrieve the field description. For example, a field value of 13 will map to modelOptComp, etc. 10 = Bid 11 = Ask 12 = Last

**tickAttrib:** int. 0 – return based, 1- price based.

**impliedVolatility:** double. the implied volatility calculated by the TWS option modeler, using the specified tick type value.

**delta:** double. The option delta value.

**optPrice:** double. The option price.

**pvDividend:** double. The present value of dividends expected on the option’s underlying.

**gamma:** double. The option gamma value.

**vega:** double. The option vega value.

**theta:** double. The option theta value.

**undPrice:** double. The price of the underlying.  
)

Receives option specific market data. This method is called when the market in an option or its underlier moves. TWS’s option model volatilities, prices, and deltas, along with the present value of dividends expected on that options underlier are received.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
def tickOptionComputation(self, reqId: TickerId, tickType: TickType, tickAttrib: int, impliedVol: float, delta: float, optPrice: float, pvDividend: float, gamma: float, vega: float, theta: float, undPrice: float):
    print("TickOptionComputation. TickerId:", reqId, "TickType:", tickType, "TickAttrib:", intMaxString(tickAttrib), "ImpliedVolatility:", floatMaxString(impliedVol), "Delta:", floatMaxString(delta), "OptionPrice:", floatMaxString(optPrice), "pvDividend:", floatMaxString(pvDividend), "Gamma: ", floatMaxString(gamma), "Vega:", floatMaxString(vega), "Theta:", floatMaxString(theta), "UnderlyingPrice:", floatMaxString(undPrice))
```

``` EnlighterJSRAW
@Override
public void tickOptionComputation(int tickerId, int field, int tickAttrib, double impliedVol, double delta, double optPrice,
        double pvDividend, double gamma, double vega, double theta, double undPrice) {
    System.out.println("TickOptionComputation: " + EWrapperMsgGenerator.tickOptionComputation( tickerId, field, tickAttrib, impliedVol, delta, optPrice, pvDividend, gamma, vega, theta, undPrice));
}
```

``` EnlighterJSRAW
void TestCppClient::tickOptionComputation( TickerId tickerId, TickType tickType, int tickAttrib, double impliedVol, double delta, double optPrice, double pvDividend, double gamma, double vega, double theta, double undPrice) {
    printf( "TickOptionComputation. Ticker Id: %ld, Type: %d, TickAttrib: %s, ImpliedVolatility: %s, Delta: %s, OptionPrice: %s, pvDividend: %s, Gamma: %s, Vega: %s, Theta: %s, Underlying Price: %s\n", tickerId, (int)tickType, Utils::intMaxString(tickAttrib).c_str(), Utils::doubleMaxString(impliedVol).c_str(), Utils::doubleMaxString(delta).c_str(), Utils::doubleMaxString(optPrice).c_str(), Utils::doubleMaxString(pvDividend).c_str(), Utils::doubleMaxString(gamma).c_str(), Utils::doubleMaxString(vega).c_str(), Utils::doubleMaxString(theta).c_str(), Utils::doubleMaxString(undPrice).c_str());
}
```

``` EnlighterJSRAW
public virtual void tickOptionComputation(int tickerId, int field, int tickAttrib, double impliedVolatility, double delta, double optPrice, double pvDividend, double gamma, double vega, double theta, double undPrice)
{
    Console.WriteLine("TickOptionComputation. TickerId: " + tickerId + ", field: " + field + ", TickAttrib: " + Util.IntMaxString(tickAttrib) + ", ImpliedVolatility: " + Util.DoubleMaxString(impliedVolatility) + ", Delta: " + Util.DoubleMaxString(delta) + ", OptionPrice: " + Util.DoubleMaxString(optPrice) +", pvDividend: " + Util.DoubleMaxString(pvDividend) + ", Gamma: " + Util.DoubleMaxString(gamma) + ", Vega: " + Util.DoubleMaxString(vega) + ", Theta: " + Util.DoubleMaxString(theta) + ", UnderlyingPrice: " + Util.DoubleMaxString(undPrice));
}
```

``` EnlighterJSRAW
Public Sub tickOptionComputation(tickerId As Integer, field As Integer, tickAttrib As Integer, impliedVolatility As Double, delta As Double, optPrice As Double, pvDividend As Double, gamma As Double, vega As Double, theta As Double, undPrice As Double) Implements IBApi.EWrapper.tickOptionComputation
    Console.WriteLine("TickOptionComputation. TickerId: " & tickerId & ", field: " & field & ", TickAttrib: " & Util.IntMaxString(tickAttrib) & ", ImpliedVolatility: " & Util.DoubleMaxString(impliedVolatility) & ", Delta: " & Util.DoubleMaxString(delta) & ", OptionPrice: " & Util.DoubleMaxString(optPrice) & ", pvDividend: " & Util.DoubleMaxString(pvDividend) & ", Gamma: " & Util.DoubleMaxString(gamma) & ", Vega: " & Util.DoubleMaxString(vega) & ", Theta: " & Util.DoubleMaxString(theta) & ", UnderlyingPrice: " & Util.DoubleMaxString(undPrice))
End Sub
```

### Top of Book (L1)

Streaming market data values corresponding to data shown in TWS watchlists is available via the EClient.reqMktData. This data is not tick-by-tick but consists of aggregate snapshots taken several times per second. A set of ‘default’ tick types are returned by default from a call to EClient.reqMktData, and additional tick types are available by specifying the corresponding generic tick type in the market data request. Including the generic tick types many, but not all, types of data are available that can be displayed in TWS watchlists by adding additional columns.

Using the TWS API, you can request real time market data for trading and analysis. From the API, market data returned from the function IBApi.EClient.reqMktData corresponds to market data displayed in TWS watchlists. This data is not tick-by-tick but consists of aggregated snapshots taken at intra-second intervals which differ depending on the type of instrument:

| Product                    | Frequency |
| -------------------------- | --------- |
| Stocks, Futures and others | 250 ms    |
| US Options                 | 100 ms    |
| FX pairs                   | 5 ms      |

### Request Watchlist Data

#### EClient.reqMktData (

**reqId:** int. Request identifier for tracking data.

**contract:** Contract. Contract object used for specifying an instrument.

**[genericTickList](#generic-tick-types):** String. Comma separated ids of the available generic ticks.

[**snapshot:**](#streaming-data-snapshot) bool. Used to retrieve a single snapshot of data for those with an existing market data subscirption.

[**regulatorySnapshot:**](#regulatory-snapshot) bool. Used to retrieve a single snapshot of paid data. Each snapshot costs $0.01.  
See [here](/campus/ibkr-api-page/market-data-subscriptions/#reg-snapshot) for more information about Regulatory Snapshots and Market Data.

**mktDataOptions:** List\<TagValue\>. Internal use only.  
)

Requests real time market data. Returns market data for an instrument either in real time or [10-15 minutes delayed data.](https://www.interactivebrokers.com/campus/ibkr-api-page/trader-workstation-api/#delayed-market-data)

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
self.reqMktData(reqId, contract, "", False, False, [])
```

``` EnlighterJSRAW
client.reqMktData(reqId, contract, "", false, false, null);
```

``` EnlighterJSRAW
m_pClient->reqMktData(reqId, contract, "", false, false, TagValueListSPtr());
```

``` EnlighterJSRAW
client.reqMktData(reqId, contract, "", false, false, null);
```

``` EnlighterJSRAW
client.reqMktData(reqId, contract, "", False, False, Nothing)
```

### Market Data Update Frequency

Watchlist market data at Interactive Brokers is derived from time-based snapshot intervals which vary by product and region. This means that a given tick will only update as frequently as its interval allows. See the table for more details on product specifics.

Product

Frequency

United States

Stocks, Futures, Bonds, Indices

250ms

Options

10ms

Forex

5ms

Europe

All Products

250ms

Asia

All Products

250ms

### Generic Tick Types

The most common tick types are delivered automatically after a successful market data request. There are however other tick types available by explicit request: the generic tick types. When invoking IBApi.EClient.reqMktData, specific generic ticks can be requested via the genericTickList parameter of the function:

See the [Available Tick Types](#available-tick-types) section for more information on generic ticks.

### Streaming Data Snapshots

With an exchange market data subscription, such as Network A (NYSE), Network B(ARCA), or Network C(NASDAQ) for US stocks, it is possible to request a snapshot of the current state of the market once instead of requesting a stream of updates continuously as market values change. By invoking the EClient.reqMktData function passing in true for the snapshot parameter, the client application will receive the currently available market data once before a EWrapper.tickSnapshotEnd event is sent 11 seconds later. Snapshot requests can only be made for the default tick types; no generic ticks can be specified. It is important to note that a snapshot request will only return available data over the 11 second span; in some cases values may not be returned for all tick types.

#### EWrapper.tickSnapshotEnd (

**tickerId:** int. Request identifier used to track data.  
)

When requesting market data snapshots, this market will indicate the snapshot reception is finished. Expected to occur 11 seconds after beginning of request.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
def tickSnapshotEnd(self, reqId: int):
  print("TickSnapshotEnd. TickerId:", reqId)
```

``` EnlighterJSRAW
@Override
public void tickSnapshotEnd(int reqId) {
  System.out.println("TickSnapshotEnd: " + EWrapperMsgGenerator.tickSnapshotEnd(reqId));
}
```

``` EnlighterJSRAW
void TestCppClient::tickSnapshotEnd(int reqId) {
    printf( "TickSnapshotEnd: %d\n", reqId);
}
```

``` EnlighterJSRAW
public virtual void tickSnapshotEnd(int tickerId)
{
  Console.WriteLine("TickSnapshotEnd: "+tickerId);
}
```

``` EnlighterJSRAW
Public Sub tickSnapshotEnd(tickerId As Integer) Implements IBApi.EWrapper.tickSnapshotEnd
  Console.WriteLine("TickSnapshotEnd: " & CStr(tickerId))
End Sub
```

### Regulatory Snapshots

The fifth argument to reqMktData specifies a regulatory snapshot request to US stocks and options.

For stocks, there are individual exchange-specific market data subscriptions necessary to receive streaming quotes. For instance, for NYSE stocks this subscription is known as “Network A”, for ARCA/AMEX stocks it is called “Network B” and for NASDAQ stocks it is “Network C”. Each subscription is added a la carte and has a separate market data fee.

Alternatively, there is also a “US Securities Snapshot Bundle” subscription which does not provide streaming data but which allows for real time calculated snapshots of US market NBBO prices. By setting the 5th parameter in the function EClient::reqMktData to **True**, a regulatory snapshot request can be made from the API. The returned value is a calculation of the current market state based on data from all available exchanges.

**Important: Each regulatory snapshot made will incur a fee of 0.01 USD to the account. This applies to both live *and* paper accounts.**. If the monthly fee for regulatory snapshots reaches the price of a particular ‘Network’ subscription, the user will automatically be subscribed to that Network subscription for continuous streaming quotes and charged the associated fee for that month. At the end of the month the subscription will be terminated. Each listing exchange will be capped independently and will not be combined across listing exchanges.

Requesting regulatory snapshots is subject to pacing limitations:

  - No more than one request per second.

The following table lists the cost and maximum allocation for regulatory snapshot quotes:

| Listed Network Feed    | Price per reqSnapshot request | Pro or non-Pro | Max reqSnapshot request |
| ---------------------- | ----------------------------- | -------------- | ----------------------- |
| NYSE (Network A/CTA)   | 0.01 USD                      | Pro            | 4500                    |
| NYSE (Network A/CTA)   | 0.01 USD                      | Non-Pro        | 150                     |
| AMEX (Network B/CTA)   | 0.01 USD                      | Pro            | 2300                    |
| AMEX (Network B/CTA)   | 0.01 USD                      | Non-Pro        | 150                     |
| NASDAQ (Network C/UTP) | 0.01 USD                      | Pro            | 2300                    |
| NASDAQ (Network C/UTP) | 0.01 USD                      | Non-Pro        | 150                     |

### Receive Live Data

**Note:** Please be aware that in the event subsequent orders are received with the same price value, but different size values, no new tickPrice value should be returned. Only an updated tickSize will denote that a new order was retrieved with the assumption the last tickPrice value will also correlate with the new size.

#### EWrapper.tickGeneric (

**tickerId:** int. Request identifier used to track data.

**field:** int. The type of tick being received.

**value:** double. Return value corresponding to value. See Available Tick Types for more details.  
)

Returns generic data back to requester. Used for an array of tick types and is used to represent general evaluations.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
def tickGeneric(self, reqId: TickerId, tickType: TickType, value: float):
    print("TickGeneric. TickerId:", reqId, "TickType:", tickType, "Value:", floatMaxString(value))
```

``` EnlighterJSRAW
@Override
public void tickGeneric(int tickerId, int tickType, double value) {
    System.out.println("Tick Generic: " + EWrapperMsgGenerator.tickGeneric(tickerId, tickType, value));
}
```

``` EnlighterJSRAW
void TestCppClient::tickGeneric(TickerId tickerId, TickType tickType, double value) {
    printf( "Tick Generic. Ticker Id: %ld, Type: %d, Value: %s\n", tickerId, (int)tickType, Utils::doubleMaxString(value).c_str());
}
```

``` EnlighterJSRAW
public virtual void tickGeneric(int tickerId, int field, double value)
{
    Console.WriteLine("Tick Generic. Ticker Id:" + tickerId + ", Field: " + field + ", Value: " + Util.DoubleMaxString(value));
}
```

``` EnlighterJSRAW
Public Sub tickGeneric(tickerId As Integer, field As Integer, value As Double) Implements IBApi.EWrapper.tickGeneric
    Console.WriteLine("Tick Generic. Ticker Id:" & tickerId & ", Field: " & field & ", Value: " & Util.DoubleMaxString(value))
End Sub
```

#### EWrapper.tickPrice (

**tickerId:** int. Request identifier used to track data.

**tickType:** int. The type of the price being received (See Tick ID field in [Available Tick Types](https://www.interactivebrokers.com/campus/ibkr-api-page/twsapi-doc/#available-tick-types)).

**price:** double. The monetary value for the given tick type.

**attribs:** TickAttrib. A TickAttrib object that contains price attributes such as TickAttrib::CanAutoExecute, TickAttrib::PastLimit and TickAttrib::PreOpen.  
)

Market data tick price callback. Handles all price related ticks. Every tickPrice callback is followed by a tickSize. A tickPrice value of -1 or 0 followed by a tickSize of 0 indicates there is no data for this field currently available, whereas a tickPrice with a positive tickSize indicates an active quote of 0 (typically for a combo contract).

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
def tickPrice(self, reqId: TickerId, tickType: TickType, price: float, attrib: TickAttrib):
    print(reqId, tickType, price, attrib)
```

``` EnlighterJSRAW
@Override
public void tickPrice(int tickerId, int field, double price, TickAttrib attribs) {
    System.out.println("Tick Price: " + EWrapperMsgGenerator.tickPrice( tickerId, field, price, attribs));
}
```

``` EnlighterJSRAW
void TestCppClient::tickPrice( TickerId tickerId, TickType field, double price, const TickAttrib& attribs) {
    printf( "Tick Price. Ticker Id: %ld, Field: %d, Price: %s, CanAutoExecute: %d, PastLimit: %d, PreOpen: %d\n", tickerId, (int)field, Utils::doubleMaxString(price).c_str(), attribs.canAutoExecute, attribs.pastLimit, attribs.preOpen);
}
```

``` EnlighterJSRAW
public virtual void tickPrice(int tickerId, int field, double price, TickAttrib attribs) 
{
    Console.WriteLine("Tick Price. Ticker Id:" + tickerId + ", Field: " + field + ", Price: " + Util.DoubleMaxString(price) + ", CanAutoExecute: " + attribs.CanAutoExecute + ", PastLimit: " + attribs.PastLimit + ", PreOpen: " + attribs.PreOpen);
}
```

``` EnlighterJSRAW
Public Sub tickPrice(tickerId As Integer, field As Integer, price As Double, attribs As TickAttrib) Implements IBApi.EWrapper.tickPrice
    Console.WriteLine("TickPrice - TickerId [" & CStr(tickerId) & "] Field [" & TickType.getField(field) & "] Price [" & Util.DoubleMaxString(price) & "] PreOpen [" & attribs.PreOpen & "]")
End Sub
```

#### EWrapper.tickSize (

**tickerId:** int. Request identifier used to track data.

**field:** int. the type of size being received (i.e. bid size)

**size:** int. the actual size. US stocks have a multiplier of 100.  
)

Market data tick size callback. Handles all size-related ticks.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
def tickSize(self, reqId: TickerId, tickType: TickType, size: Decimal):
    print("TickSize. TickerId:", reqId, "TickType:", tickType, "Size: ", decimalMaxString(size))
```

``` EnlighterJSRAW
@Override
public void tickSize(int tickerId, int field, Decimal size) {
    System.out.println("Tick Size: " + EWrapperMsgGenerator.tickSize( tickerId, field, size));
}
```

``` EnlighterJSRAW
void TestCppClient::tickSize( TickerId tickerId, TickType field, Decimal size) {
    printf( "Tick Size. Ticker Id: %ld, Field: %d, Size: %s\n", tickerId, (int)field, decimalStringToDisplay(size).c_str());
}
```

``` EnlighterJSRAW
public virtual void tickSize(int tickerId, int field, decimal size)
{
    Console.WriteLine("Tick Size. Ticker Id:" + tickerId + ", Field: " + field + ", Size: " + Util.DecimalMaxString(size));
}
```

``` EnlighterJSRAW
Public Sub tickSize(tickerId As Integer, field As Integer, size As Decimal) Implements IBApi.EWrapper.tickSize
    Console.WriteLine("Tick Size. Ticker Id:" & CStr(tickerId) & ", Field: " & TickType.getField(field) & ", Size: " & Util.DecimalMaxString(size))
End Sub
```

#### EWrapper.tickString (

**tickerId:** int. Request identifier used to track data.

**field:** int. The type of the tick being received

**value:** String. Variable containining message response.  
)

Market data callback.

**Note:** Every tickPrice is followed by a tickSize. There are also independent tickSize callbacks anytime the tickSize changes, and so there will be duplicate tickSize messages following a tickPrice.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
def tickString(self, reqId: TickerId, tickType: TickType, value: str):
    print("TickString. TickerId:", reqId, "Type:", tickType, "Value:", value)
```

``` EnlighterJSRAW
@Override
    public void tickString(int tickerId, int tickType, String value) {
        System.out.println("Tick String: " + EWrapperMsgGenerator.tickString(tickerId, tickType, value));
    }
```

``` EnlighterJSRAW
void TestCppClient::tickString(TickerId tickerId, TickType tickType, const std::string& value) {
    printf( "Tick String. Ticker Id: %ld, Type: %d, Value: %s\n", tickerId, (int)tickType, value.c_str());
}
```

``` EnlighterJSRAW
public virtual void tickString(int tickerId, int tickType, string value)
{
    Console.WriteLine("Tick string. Ticker Id:" + tickerId + ", Type: " + tickType + ", Value: " + value);
}
```

``` EnlighterJSRAW
Public Sub tickString(tickerId As Integer, field As Integer, value As String) Implements IBApi.EWrapper.tickString
    Console.WriteLine("Tick string. Ticker Id:" & CStr(tickerId) & ", Type: " & TickType.getField(field) & ", Value: " & value)
End Sub
```

### Exchange Component Mapping

A market data request is able to return data from multiple exchanges. After a market data request is made for an instrument covered by market data subscriptions, a message will be sent to function IBApi::EWrapper::tickReqParams with information about ‘minTick’, BBO exchange mapping, and available snapshot permissions.

The exchange mapping identifier bboExchange will be a symbol such as “a6” which can be used to decode the single letter exchange abbreviations returned to the bidExch, askExch, and lastExch fields by invoking the function IBApi::EClient::reqSmartComponents. More information about Component Exchanges.

The minTick returned to tickReqParams indicates the minimum increment in market data values returned to the API. It can differ from the minTick value in the ContractDetails class. For instance, combos will often have a minimum increment of 0.01 for market data and a minTick of 0.05 for order placement.

#### EWrapper.tickReqParams (

**tickerId:** int. Request identifier used to track data.

**minTick:** Minimum tick for the contract on the exchange.

**bboExchange:** String. Exchange offering the best bid offer.

**snapshotPermissions:** Based on the snapshot parameter in EClient.reqMktData.  
)

Displays the ticker with BBO exchange.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
def tickReqParams(self, tickerId:int, minTick:float, bboExchange:str, snapshotPermissions:int):
    print("TickReqParams. TickerId:", tickerId, "MinTick:", floatMaxString(minTick), "BboExchange:", bboExchange, "SnapshotPermissions:", intMaxString(snapshotPermissions))
```

``` EnlighterJSRAW
@Override
public void tickReqParams(int tickerId, double minTick, String bboExchange, int snapshotPermissions) {
    System.out.println("Tick req params: " + EWrapperMsgGenerator.tickReqParams(tickerId, minTick, bboExchange, snapshotPermissions));
}
```

``` EnlighterJSRAW
void TestCppClient::tickReqParams(int tickerId, double minTick, const std::string& bboExchange, int snapshotPermissions) {
    printf("tickerId: %d, minTick: %s, bboExchange: %s, snapshotPermissions: %u\n", tickerId, Utils::doubleMaxString(minTick).c_str(), bboExchange.c_str(), snapshotPermissions);
    m_bboExchange = bboExchange;
}
```

``` EnlighterJSRAW
public void tickReqParams(int tickerId, double minTick, string bboExchange, int snapshotPermissions)
{
    Console.WriteLine("id={0} minTick = {1} bboExchange = {2} snapshotPermissions = {3}", tickerId, Util.DoubleMaxString(minTick), bboExchange, Util.IntMaxString(snapshotPermissions)); BboExchange = bboExchange;
}
```

``` EnlighterJSRAW
Public Sub tickReqParams(tickerId As Integer, minTick As Double, bboExchange As String, snapshotPermissions As Integer) Implements EWrapper.tickReqParams
    Console.WriteLine("id={0} minTick = {1} bboExchange = {2} snapshotPermissions = {3}", tickerId, Util.DoubleMaxString(minTick), bboExchange, Util.IntMaxString(snapshotPermissions))
    Me.BboExchange = bboExchange
End Sub
```

### Re-Routing CFDs

IB does not provide market data for certain types of instruments, such as stock CFDs and forex CFDs. If a stock CFD or forex CFD is entered into a TWS watchlist, TWS will automatically display market data for the underlying ticker and show a ‘U’ icon next to the instrument name to indicate that the data is for the underlying instrument.

From the API, when level 1 or level 2 market data is requested for a stock CFD or a forex CFD, a callback is made to the functions EWrapper.rerouteMktDataReq or EWrapper.rerouteMktDepthReq respectively with details about the underlying instrument in IB’s database which does have market data.

#### EWrapper.rerouteMktDataReq (

**reqId:** int. Request identifier used to track data.

**conId:** int. Contract identifier of the underlying instrument which has market data.

**exchange:** int. Primary exchange of the underlying.  
)

Returns conid and exchange for CFD market data request re-route.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
def rerouteMktDataReq(self, reqId: int, conId: int, exchange: str):
    print("Re-route market data request. ReqId:", reqId, "ConId:", conId, "Exchange:", exchange)
```

``` EnlighterJSRAW
@Override
public void rerouteMktDataReq(int reqId, int conId, String exchange) {
    System.out.println(EWrapperMsgGenerator.rerouteMktDataReq(reqId, conId, exchange));
}
```

``` EnlighterJSRAW
void TestCppClient::rerouteMktDataReq(int reqId, int conid, const std::string& exchange) {
    printf( "Re-route market data request. ReqId: %d, ConId: %d, Exchange: %s\n", reqId, conid, exchange.c_str());
}
```

``` EnlighterJSRAW
public void rerouteMktDataReq(int reqId, int conId, string exchange)
{
    Console.WriteLine("Re-route market data request. Req Id: {0}, ConId: {1}, Exchange: {2}", reqId, conId, exchange);
}
```

``` EnlighterJSRAW
Public Sub rerouteMktDataReq(reqId As Integer, conId As Integer, exchange As String) Implements IBApi.EWrapper.rerouteMktDataReq
    Console.WriteLine("Re-route market data request. Req Id: {0}, Con Id: {1}, Exchange: {2}", reqId, conId, exchange)
End Sub
```

#### EWrapper.rerouteMktDepthReq (

**reqId:** int. Request identifier used to track data.

**conId:** int. Contract identifier of the underlying instrument which has market data.

**exchange:** int. Primary exchange of the underlying.  
)

Returns the conId and exchange for an underlying contract when a request is made for level 2 data for an instrument which does not have data in IB’s database. For example stock CFDs and index CFDs.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
def rerouteMktDepthReq(self, reqId: int, conId: int, exchange: str):
    print("Re-route market depth request. ReqId:", reqId, "ConId:", conId, "Exchange:", exchange)
```

``` EnlighterJSRAW
@Override
public void rerouteMktDepthReq(int reqId, int conId, String exchange) {
    System.out.println(EWrapperMsgGenerator.rerouteMktDepthReq(reqId, conId, exchange));
}
```

``` EnlighterJSRAW
void TestCppClient::rerouteMktDepthReq(int reqId, int conid, const std::string& exchange) {
    printf( "Re-route market depth request. ReqId: %d, ConId: %d, Exchange: %s\n", reqId, conid, exchange.c_str());
}
```

``` EnlighterJSRAW
public void rerouteMktDepthReq(int reqId, int conId, string exchange)
{
    Console.WriteLine("Re-route market depth request. Req Id: {0}, ConId: {1}, Exchange: {2}", reqId, conId, exchange);
}
```

``` EnlighterJSRAW
Public Sub rerouteMktDepthReq(reqId As Integer, conId As Integer, exchange As String) Implements IBApi.EWrapper.rerouteMktDepthReq
            Console.WriteLine("Re-route market depth request. Req Id: {0}, Con Id: {1}, Exchange: {2}", reqId, conId, exchange)
        End Sub
```

### Cancel Watchlist Data

#### EClient.cancelMktData(

**tickerId:** int. Request identifier used to track data.  
)

Cancels a watchlist market data request.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
self.cancelMktData(2001)
```

``` EnlighterJSRAW
client.cancelMktData(2001);
```

``` EnlighterJSRAW
m_pClient->cancelMktData(2001);
```

``` EnlighterJSRAW
client.cancelMktData(2001);
```

``` EnlighterJSRAW
client.cancelMktData(2001)
```

### Available Tick Types

EClient.reqMktData will return data to various methods such as EWrapper.tickPrice, EWrapper.tickSize, EWrapper.tickString, etc. The values returned are dependent upon the generic tick requested and the type of data returned. The table below references which tick ID will be returned upon requesting a given generic tick.

\*RDD: These tick types are provided only when the user makes a request to [EClient.reqMarketDataType(3)](/campus/ibkr-api-page/twsapi-doc/#delayed-market-data) prior to their market data request.

– : These ticks are returned by default and do not have any generic tick requirements.

| Tick Name                    | Description                                                                                                                                                                                                                                                                     | Generic tick required | Delivery Method                      | Tick Id |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | ------------------------------------ | ------- |
| Disable Default Market Data  | Disables standard market data stream and allows the TWS & API feed to prioritize other listed generic tick types.                                                                                                                                                               | mdoff                 | –                                    | –       |
| Bid Size                     | Number of contracts or lots offered at the bid price.                                                                                                                                                                                                                           | –                     | IBApi.EWrapper.tickSize              | 0       |
| Bid Price                    | Highest priced bid for the contract.                                                                                                                                                                                                                                            | –                     | IBApi.EWrapper.tickPrice             | 1       |
| Ask Price                    | Lowest price offer on the contract.                                                                                                                                                                                                                                             | –                     | IBApi.EWrapper.tickPrice             | 2       |
| Ask Size                     | Number of contracts or lots offered at the ask price.                                                                                                                                                                                                                           | –                     | IBApi.EWrapper.tickSize              | 3       |
| Last Price                   | Last price at which the contract traded (does not include some trades in RTVolume).                                                                                                                                                                                             | –                     | IBApi.EWrapper.tickPrice             | 4       |
| Last Size                    | Number of contracts or lots traded at the last price.                                                                                                                                                                                                                           | –                     | IBApi.EWrapper.tickSize              | 5       |
| High                         | High price for the day.                                                                                                                                                                                                                                                         | –                     | IBApi.EWrapper.tickPrice             | 6       |
| Low                          | Low price for the day.                                                                                                                                                                                                                                                          | –                     | IBApi.EWrapper.tickPrice             | 7       |
| Volume                       | Trading volume for the day for the selected contract (US Stocks volume is display as [Round Lots](https://www.investopedia.com/terms/r/roundlot.asp)).                                                                                                                          | –                     | IBApi.EWrapper.tickSize              | 8       |
| Close Price                  | “The last available closing price for the previous day. For US Equities we use corporate action processing to get the closing price so the close price is adjusted to reflect forward and reverse splits and cash and stock dividends.”                                         | –                     | IBApi.EWrapper.tickPrice             | 9       |
| Bid Option Computation       | Computed Greeks and implied volatility based on the underlying stock price and the option bid price. See Option Greeks                                                                                                                                                          | –                     | IBApi.EWrapper.tickOptionComputation | 10      |
| Ask Option Computation       | Computed Greeks and implied volatility based on the underlying stock price and the option ask price. See Option Greeks                                                                                                                                                          | –                     | IBApi.EWrapper.tickOptionComputation | 11      |
| Last Option Computation      | Computed Greeks and implied volatility based on the underlying stock price and the option last traded price. See Option Greeks                                                                                                                                                  | –                     | IBApi.EWrapper.tickOptionComputation | 12      |
| Model Option Computation     | Computed Greeks and implied volatility based on the underlying stock price and the option model price. Correspond to greeks shown in TWS. See Option Greeks                                                                                                                     | –                     | IBApi.EWrapper.tickOptionComputation | 13      |
| Open Tick                    | Current session’s opening price. Before open will refer to previous day. The official opening price requires a market data subscription to the native exchange of the instrument.                                                                                               | –                     | IBApi.EWrapper.tickPrice             | 14      |
| Low 13 Weeks                 | Lowest price for the last 13 weeks. For stocks only.                                                                                                                                                                                                                            | 165                   | IBApi.EWrapper.tickPrice             | 15      |
| High 13 Weeks                | Highest price for the last 13 weeks. For stocks only.                                                                                                                                                                                                                           | 165                   | IBApi.EWrapper.tickPrice             | 16      |
| Low 26 Weeks                 | Lowest price for the last 26 weeks. For stocks only.                                                                                                                                                                                                                            | 165                   | IBApi.EWrapper.tickPrice             | 17      |
| High 26 Weeks                | Highest price for the last 26 weeks. For stocks only.                                                                                                                                                                                                                           | 165                   | IBApi.EWrapper.tickPrice             | 18      |
| Low 52 Weeks                 | Lowest price for the last 52 weeks. For stocks only.                                                                                                                                                                                                                            | 165                   | IBApi.EWrapper.tickPrice             | 19      |
| High 52 Weeks                | Highest price for the last 52 weeks. For stocks only.                                                                                                                                                                                                                           | 165                   | IBApi.EWrapper.tickPrice             | 20      |
| Average Volume               | The average daily trading volume over 90 days. Multiplier of 100. For stocks only.                                                                                                                                                                                              | 165                   | IBApi.EWrapper.tickSize              | 21      |
| Open Interest                | “(Deprecated not currently in use) Total number of options that are not closed.”                                                                                                                                                                                                | –                     | IBApi.EWrapper.tickSize              | 22      |
| Option Historical Volatility | The 30-day historical volatility (currently for stocks).                                                                                                                                                                                                                        | 104                   | IBApi.EWrapper.tickGeneric           | 23      |
| Option Implied Volatility    | “A prediction of how volatile an underlying will be in the future. The IB 30-day volatility is the at-market volatility estimated for a maturity thirty calendar days forward of the current trading day and is based on option prices from two consecutive expiration months.” | 106                   | IBApi.EWrapper.tickGeneric           | 24      |
| Option Bid Exchange          | Not Used.                                                                                                                                                                                                                                                                       | –                     | IBApi.EWrapper.tickString            | 25      |
| Option Ask Exchange          | Not Used.                                                                                                                                                                                                                                                                       | –                     | IBApi.EWrapper.tickString            | 26      |
| Option Call Open Interest    | Call option open interest.                                                                                                                                                                                                                                                      | 101                   | IBApi.EWrapper.tickSize              | 27      |
| Option Put Open Interest     | Put option open interest.                                                                                                                                                                                                                                                       | 101                   | IBApi.EWrapper.tickSize              | 28      |
| Option Call Volume           | Call option volume for the trading day.                                                                                                                                                                                                                                         | 100                   | IBApi.EWrapper.tickSize              | 29      |
| Option Put Volume            | Put option volume for the trading day.                                                                                                                                                                                                                                          | 100                   | IBApi.EWrapper.tickSize              | 30      |
| Index Future Premium         | The number of points that the index is over the cash index.                                                                                                                                                                                                                     | 162                   | IBApi.EWrapper.tickGeneric           | 31      |
| Bid Exchange                 | “For stock and options identifies the exchange(s) posting the bid price. See Component Exchanges”                                                                                                                                                                               | –                     | IBApi.EWrapper.tickString            | 32      |
| Ask Exchange                 | “For stock and options identifies the exchange(s) posting the ask price. See Component Exchanges”                                                                                                                                                                               | –                     | IBApi.EWrapper.tickString            | 33      |
| Auction Volume               | The number of shares that would trade if no new orders were received and the auction were held now.                                                                                                                                                                             | 225                   | IBApi.EWrapper.tickSize              | 34      |
| Auction Price                | The price at which the auction would occur if no new orders were received and the auction were held now- the indicative price for the auction. Typically received after Auction imbalance (tick type 36)                                                                        | 225                   | IBApi.EWrapper.tickPrice             | 35      |
| Auction Imbalance            | The number of unmatched shares for the next auction; returns how many more shares are on one side of the auction than the other. Typically received after Auction Volume (tick type 34)                                                                                         | 225                   | IBApi.EWrapper.tickSize              | 36      |
| Mark Price                   | “The mark price is the current theoretical calculated value of an instrument. Since it is a calculated value it will typically have many digits of precision.”                                                                                                                  | 232                   | IBApi.EWrapper.tickPrice             | 37      |
| Bid EFP Computation          | Computed EFP bid price                                                                                                                                                                                                                                                          | –                     | IBApi.EWrapper.tickEFP               | 38      |
| Ask EFP Computation          | Computed EFP ask price                                                                                                                                                                                                                                                          | –                     | IBApi.EWrapper.tickEFP               | 39      |
| Last EFP Computation         | Computed EFP last price                                                                                                                                                                                                                                                         | –                     | IBApi.EWrapper.tickEFP               | 40      |
| Open EFP Computation         | Computed EFP open price                                                                                                                                                                                                                                                         | –                     | IBApi.EWrapper.tickEFP               | 41      |
| High EFP Computation         | Computed high EFP traded price for the day                                                                                                                                                                                                                                      | –                     | IBApi.EWrapper.tickEFP               | 42      |
| Low EFP Computation          | Computed low EFP traded price for the day                                                                                                                                                                                                                                       | –                     | IBApi.EWrapper.tickEFP               | 43      |
| Close EFP Computation        | Computed closing EFP price for previous day                                                                                                                                                                                                                                     | –                     | IBApi.EWrapper.tickEFP               | 44      |
| Last Timestamp               | Time of the last trade (in UNIX time).                                                                                                                                                                                                                                          | –                     | IBApi.EWrapper.tickString            | 45      |
| Shortable                    | Describes the level of difficulty with which the contract can be sold short. See Shortable                                                                                                                                                                                      | 236                   | IBApi.EWrapper.tickGeneric           | 46      |
| RT Volume (Time & Sales)     | “Last trade details (Including both “”Last”” and “”Unreportable Last”” trades). See RT Volume”                                                                                                                                                                                  | 233                   | IBApi.EWrapper.tickString            | 48      |
| Halted                       | Indicates if a contract is halted. See Halted                                                                                                                                                                                                                                   | –                     | IBApi.EWrapper.tickGeneric           | 49      |
| Bid Yield                    | Implied yield of the bond if it is purchased at the current bid.                                                                                                                                                                                                                | –                     | IBApi.EWrapper.tickPrice             | 50      |
| Ask Yield                    | Implied yield of the bond if it is purchased at the current ask.                                                                                                                                                                                                                | –                     | IBApi.EWrapper.tickPrice             | 51      |
| Last Yield                   | Implied yield of the bond if it is purchased at the last price.                                                                                                                                                                                                                 | –                     | IBApi.EWrapper.tickPrice             | 52      |
| Custom Option Computation    | Greek values are based off a user customized price.                                                                                                                                                                                                                             | –                     | IBApi.EWrapper.tickOptionComputation | 53      |
| Trade Count                  | Trade count for the day.                                                                                                                                                                                                                                                        | 293                   | IBApi.EWrapper.tickGeneric           | 54      |
| Trade Rate                   | Trade count per minute.                                                                                                                                                                                                                                                         | 294                   | IBApi.EWrapper.tickGeneric           | 55      |
| Volume Rate                  | Volume per minute.                                                                                                                                                                                                                                                              | 295                   | IBApi.EWrapper.tickGeneric           | 56      |
| Last RTH Trade               | Last Regular Trading Hours traded price.                                                                                                                                                                                                                                        | 318                   | IBApi.EWrapper.tickPrice             | 57      |
| RT Historical Volatility     | 30-day real time historical volatility.                                                                                                                                                                                                                                         | 411                   | IBApi.EWrapper.tickGeneric           | 58      |
| IB Dividends                 | Contract’s dividends. See IB Dividends.                                                                                                                                                                                                                                         | 456                   | IBApi.EWrapper.tickString            | 59      |
| Bond Factor Multiplier       | The bond factor is a number that indicates the ratio of the current bond principal to the original principal                                                                                                                                                                    | 460                   | IBApi.EWrapper.tickGeneric           | 60      |
| Regulatory Imbalance         | The imbalance that is used to determine which at-the-open or at-the-close orders can be entered following the publishing of the regulatory imbalance.                                                                                                                           | 225                   | IBApi.EWrapper.tickSize              | 61      |
| News                         | Contract’s news feed.                                                                                                                                                                                                                                                           | 292                   | IBApi.EWrapper.tickString            | 62      |
| Short-Term Volume 3 Minutes  | The past three minutes volume. Interpolation may be applied. For stocks only.                                                                                                                                                                                                   | 595                   | IBApi.EWrapper.tickSize              | 63      |
| Short-Term Volume 5 Minutes  | The past five minutes volume. Interpolation may be applied. For stocks only.                                                                                                                                                                                                    | 595                   | IBApi.EWrapper.tickSize              | 64      |
| Short-Term Volume 10 Minutes | The past ten minutes volume. Interpolation may be applied. For stocks only.                                                                                                                                                                                                     | 595                   | IBApi.EWrapper.tickSize              | 65      |
| Delayed Bid                  | Delayed bid price. See Market Data Types.                                                                                                                                                                                                                                       | \*RDD                 | IBApi.EWrapper.tickPrice             | 66      |
| Delayed Ask                  | Delayed ask price. See Market Data Types.                                                                                                                                                                                                                                       | \*RDD                 | IBApi.EWrapper.tickPrice             | 67      |
| Delayed Last                 | Delayed last traded price. See Market Data Types.                                                                                                                                                                                                                               | \*RDD                 | IBApi.EWrapper.tickPrice             | 68      |
| Delayed Bid Size             | Delayed bid size. See Market Data Types.                                                                                                                                                                                                                                        | \*RDD                 | IBApi.EWrapper.tickSize              | 69      |
| Delayed Ask Size             | Delayed ask size. See Market Data Types.                                                                                                                                                                                                                                        | \*RDD                 | IBApi.EWrapper.tickSize              | 70      |
| Delayed Last Size            | Delayed last size. See Market Data Types.                                                                                                                                                                                                                                       | \*RDD                 | IBApi.EWrapper.tickSize              | 71      |
| Delayed High Price           | Delayed highest price of the day. See Market Data Types.                                                                                                                                                                                                                        | \*RDD                 | IBApi.EWrapper.tickPrice             | 72      |
| Delayed Low Price            | Delayed lowest price of the day. See Market Data Types                                                                                                                                                                                                                          | \*RDD                 | IBApi.EWrapper.tickPrice             | 73      |
| Delayed Volume               | Delayed traded volume of the day. See Market Data Types                                                                                                                                                                                                                         | \*RDD                 | IBApi.EWrapper.tickSize              | 74      |
| Delayed Close                | The prior day’s closing price.                                                                                                                                                                                                                                                  | \*RDD                 | IBApi.EWrapper.tickPrice             | 75      |
| Delayed Open                 | Displays the current day’s Open price. The price will return 15 minutes after the Open price is made available.                                                                                                                                                                 | \*RDD                 | IBApi.EWrapper.tickPrice             | 76      |
| RT Trade Volume              | “Last trade details that excludes “”Unreportable Trades””. See RT Trade Volume”                                                                                                                                                                                                 | 375                   | IBApi.EWrapper.tickString            | 77      |
| Creditman mark price         | Not currently available                                                                                                                                                                                                                                                         | –                     | IBApi.EWrapper.tickPrice             | 78      |
| Creditman slow mark price    | Slower mark price update used in system calculations                                                                                                                                                                                                                            | 619                   | IBApi.EWrapper.tickPrice             | 79      |
| Delayed Bid Option           | Computed greeks based on delayed bid price. See Market Data Types and Option Greeks.                                                                                                                                                                                            | \*RDD                 | IBApi.EWrapper.tickOptionComputation | 80      |
| Delayed Ask Option           | Computed greeks based on delayed ask price. See Market Data Types and Option Greeks.                                                                                                                                                                                            | \*RDD                 | IBApi.EWrapper.tickOptionComputation | 81      |
| Delayed Last Option          | Computed greeks based on delayed last price. See Market Data Types and Option Greeks.                                                                                                                                                                                           | \*RDD                 | IBApi.EWrapper.tickOptionComputation | 82      |
| Delayed Model Option         | Computed Greeks and model’s implied volatility based on delayed stock and option prices.                                                                                                                                                                                        | \*RDD                 | IBApi.EWrapper.tickOptionComputation | 83      |
| Last Exchange                | Exchange of last traded price                                                                                                                                                                                                                                                   | –                     | IBApi.EWrapper.tickString            | 84      |
| Last Regulatory Time         | Timestamp (in Unix ms time) of last trade returned with regulatory snapshot                                                                                                                                                                                                     | –                     | IBApi.EWrapper.tickString            | 85      |
| Futures Open Interest        | Total number of outstanding futures contracts. \*HSI open interest requested with generic tick 101                                                                                                                                                                              | 588                   | IBApi.EWrapper.tickSize              | 86      |
| Average Option Volume        | Average volume of the corresponding option contracts(TWS Build 970+ is required)                                                                                                                                                                                                | 105                   | IBApi.EWrapper.tickSize              | 87      |
| Delayed Last Timestamp       | Delayed time of the last trade (in UNIX time) (TWS Build 970+ is required)                                                                                                                                                                                                      | \*RDD                 | IBApi.EWrapper.tickString            | 88      |
| Shortable Shares             | Number of shares available to short (TWS Build 974+ is required)                                                                                                                                                                                                                | 236                   | IBApi.EWrapper.tickSize              | 89      |
| ETF Nav Last                 | The last price of Net Asset Value (NAV). For ETFs: Calculation is based on prices of ETF’s underlying securities. For NextShares: Value is provided by NASDAQ                                                                                                                   | 577                   | IBApi.EWrapper.tickPrice             | 96      |
| ETF Nav Frozen Last          | ETF Nav Last for Frozen data                                                                                                                                                                                                                                                    | 623                   | IBApi.EWrapper.tickPrice             | 97      |
| ETF Nav High                 | The high price of ETF’s Net Asset Value (NAV)                                                                                                                                                                                                                                   | 614                   | IBApi.EWrapper.tickPrice             | 98      |
| ETF Nav Low                  | The low price of ETF’s Net Asset Value (NAV)                                                                                                                                                                                                                                    | 614                   | IBApi.EWrapper.tickPrice             | 99      |
| Estimated IPO – Midpoint     | Midpoint is calculated based on IPO price range                                                                                                                                                                                                                                 | 586                   | IBApi.EWrapper.tickGeneric           | 101     |
| Final IPO Price              | Final price for IPO                                                                                                                                                                                                                                                             | 586                   | IBApi.EWrapper.tickGeneric           | 102     |
| Delayed Yield Bid            | Delayed implied yield of the bond if it is purchased at the current bid.                                                                                                                                                                                                        | \*RDD                 | IBApi.EWrapper.tickPrice             | 103     |
| Delayed Yield Ask            | Delayed implied yield of the bond if it is purchased at the current ask.                                                                                                                                                                                                        | \*RDD                 | IBApi.EWrapper.tickPrice             | 104     |

### Halted

The Halted tick type indicates if a contract has been halted for trading. It can have the following values:

| Value | Description                                                                                       |
| ----- | ------------------------------------------------------------------------------------------------- |
| \-1   | Halted status not available. Usually returned with frozen data.                                   |
| 0     | Not halted. This value will **only** be returned if the contract is in a TWS watchlist.           |
| 1     | General halt. Trading halt is imposed for purely regulatory reasons with/without volatility halt. |
| 2     | Volatility halt. Trading halt is imposed by the exchange to protect against extreme volatility.   |

### Shortable

The shortable tick is an indicative on the amount of shares which can be sold short for the contract:

Receiving the actual number of shares available to short requires TWS 974+. For detailed information about shortability data (shortable shares, fee rate) available outside of TWS, IB also provides an FTP site. For more information on the FTP site, see [knowledge base article 2024](https://www.ibkrguides.com/kb/article-2024.htm)

| Range                 | Description                                                                 |
| --------------------- | --------------------------------------------------------------------------- |
| Value higher than 2.5 | There are at least 1000 shares available for short selling.                 |
| Value higher than 1.5 | This contract will be available for short selling if shares can be located. |
| 1.5 or less           | Contract is not available for short selling.                                |

### Volume Data

The API reports the current day’s volume in several ways. They are summarized as follows:

  - Volume tick type 8: The ‘native volume’. This includes delayed transactions, busted trades, and combos, but will not update with every tick.
  - RTVolume: highest number, includes non-reportable trades such as odd lots, average price and derivative trades.
  - RTTradeVolume: only includes ‘last’ ticks, similar to number also used in charts/historical data.

### RT Volume

The RT Volume tick type corresponds to the TWS’ Time & Sales window and contains the last trade’s price, size and time along with current day’s total traded volume, Volume Weighted Average Price (VWAP) and whether or not the trade was filled by a single market maker.

There is a setting in TWS which displays tick-by-tick data in the TWS Time & Sales Window. If this setting is checked, it will provide a higher granularity of data than RTVolume.

Example: 701.28;1;1348075471534;67854;701.46918464;true

As volume for US stocks is reported in lots, a volume of 0 reported in RTVolume will typically indicate an odd lot data point (less than 100 shares).

It is important to note that while the TWS Time & Sales Window also has information about trade conditions available with data points, this data is not available through the API. So for instance, the ‘unreportable’ trade status displayed with points in the Time & Sales Window is not available through the API, and that trade data will appear in the API just as any other data point. As always, an API application needs to exercise caution in responding to single data points.

**Note:** Please be aware that RT Volume is not supported with Cryptocurrencies.

RT Trade Volume

The RT Trade Volume is similar to RT Volume, but designed to avoid relaying back “Unreportable Trades” shown in TWS Time\&Sales via the API. RT Trade Volume will not contain average price or derivative trades which are included in RTVolume.

### IB Dividends

This tick type provides four different comma-separated elements:

  - The sum of dividends for the past 12 months (0.83 in the example below).
  - The sum of dividends for the next 12 months (0.92 from the example below).
  - The next dividend date (20130219 in the example below).
  - The next single dividend amount (0.23 from the example below).

**Example: **0.83,0.92,20130219,0.23

To receive dividend information it is sometimes necessary to direct-route rather than smart-route market data requests.

### Tick By Tick Data

In TWS, tick-by-tick data is available in the Time & Sales Window.

The maximum number of simultaneous tick-by-tick subscriptions allowed for a user is 5% of the user’s total market data lines. See [Specialized Market Data Lines](/campus/ibkr-api-page/market-data-subscriptions/#market-data-lines) for more information.

  - Real time tick-by-tick data is currently not available for options. Historical tick-by-tick data is available.

  - The tick type field is case sensitive – it must be BidAsk, Last, AllLast, MidPoint. AllLast has additional trade types such as combos, derivatives, and average price trades which are not included in Last.

  - Tick-by-tick data for options is currently only available historically and not in real time.

  - Tick-by-tick data for indices is only provided for indices which are on CME.

  - Tick-by-tick data is not available for combos.

  - No more than 1 tick-by-tick request can be made for the same instrument within 15 seconds.

  - Time & Sales data requires a Level 1, Top Of Book market data subscription. This would be the same subscription as [EClient.reqMktData()](/campus/ibkr-api-page/trader-workstation-api/#watchlist-data) or [EClient.reqHistoricalData()](/campus/ibkr-api-page/trader-workstation-api/#historical-bars).

### Request Tick By Tick Data

#### EClient.reqTickByTickData (

**reqId:** int. unique identifier of the request.

**contract:** Contract. the contract for which tick-by-tick data is requested.

**tickType:** String. tick-by-tick data type: “Last”, “AllLast”, “BidAsk” or “MidPoint”.

**numberOfTicks:** int. If a non-zero value is entered, then historical tick data is first returned via one of the  [Historical Time and Sales Ewrapper Methods](https://www.interactivebrokers.com/campus/ibkr-api-page/trader-workstation-api/#receiving-time-and-sales)  respectively. (Max number of historical Ticks is 1000)

**ignoreSize:** bool. Omit updates that reflect only changes in size, and not price. *Applicable to Bid\_Ask data requests*.  
)

Requests tick by tick or Time & Sales data.

Note:

The maximum number of simultaneous tick-by-tick subscriptions allowed for a user is 5% of the user’s total market data lines. See [Specialized Market Data Lines](/campus/ibkr-api-page/market-data-subscriptions/#market-data-lines) for more information.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
self.reqTickByTickData(19001, contract, "Last", 0, True)
```

``` EnlighterJSRAW
client.reqTickByTickData(19001, contract, "Last", 0, false);
```

``` EnlighterJSRAW
m_pClient->reqTickByTickData(20005, contract, "Last", 10, false);
```

``` EnlighterJSRAW
client.reqTickByTickData(19001, contract, "Last", 0, false);
```

``` EnlighterJSRAW
client.reqTickByTickData(19001, contract, "Last", 0, False)
```

### Receive Tick By Tick Data

#### EWrapper.tickByTickAllLast (

**reqId:** int. unique identifier of the request.

**tickType:** int. 0: “Last” or 1: “AllLast”.

**time:** long. tick-by-tick real-time tick timestamp.

**price:** double. tick-by-tick real-time tick last price.

**size:** decimal. tick-by-tick real-time tick last size.

**tickAttribLast:** TickAttribLast. tick-by-tick real-time last tick attribs (bit 0 – past limit, bit 1 – unreported).

**exchange:** String. tick-by-tick real-time tick exchange.

**specialConditions:** String. tick-by-tick real-time tick special conditions. Conditions under which the operation took place (Refer to [Trade Conditions Page](https://www.interactivebrokers.com/en/index.php?f=7235))  
)

Returns “Last” or “AllLast” tick-by-tick real-time tick.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
def tickByTickAllLast(self, reqId: int, tickType: int, time: int, price: float, size: Decimal, tickAtrribLast: TickAttribLast, exchange: str,specialConditions: str):
    print(" ReqId:", reqId, "Time:", time, "Price:", floatMaxString(price), "Size:", size, "Exch:" , exchange, "Spec Cond:", specialConditions, "PastLimit:", tickAtrribLast.pastLimit, "Unreported:", tickAtrribLast.unreported)
```

``` EnlighterJSRAW
@Override
public void tickByTickAllLast(int reqId, int tickType, long time, double price, Decimal size, TickAttribLast tickAttribLast, String exchange, String specialConditions) {
    System.out.println(EWrapperMsgGenerator.tickByTickAllLast(reqId, tickType, time, price, size, tickAttribLast, exchange, specialConditions));
}
```

``` EnlighterJSRAW
void TestCppClient::tickByTickAllLast(int reqId, int tickType, time_t time, double price, Decimal size, const TickAttribLast& tickAttribLast, const std::string& exchange, const std::string& specialConditions) {
    printf("Tick-By-Tick. ReqId: %d, TickType: %s, Time: %s, Price: %s, Size: %s, PastLimit: %d, Unreported: %d, Exchange: %s, SpecialConditions:%s\n", reqId, (tickType == 1 ? "Last" : "AllLast"), ctime(&time), Utils::doubleMaxString(price).c_str(), decimalStringToDisplay(size).c_str(), tickAttribLast.pastLimit, tickAttribLast.unreported, exchange.c_str(), specialConditions.c_str());
}
```

``` EnlighterJSRAW
public void tickByTickAllLast(int reqId, int tickType, long time, double price, decimal size, TickAttribLast tickAttribLast, string exchange, string specialConditions)
        {
            Console.WriteLine("Tick-By-Tick. Request Id: {0}, TickType: {1}, Time: {2}, Price: {3}, Size: {4}, Exchange: {5}, Special Conditions: {6}, PastLimit: {7}, Unreported: {8}",
                reqId, tickType == 1 ? "Last" : "AllLast", Util.UnixSecondsToString(time, "yyyyMMdd-HH:mm:ss"), Util.DoubleMaxString(price), Util.DecimalMaxString(size), exchange, specialConditions, tickAttribLast.PastLimit, tickAttribLast.Unreported);
        }
```

``` EnlighterJSRAW
Public Sub tickByTickAllLast(reqId As Integer, tickType As Integer, time As Long, price As Double, size As Decimal, tickAttribLast As TickAttribLast, exchange As String, specialConditions As String) Implements EWrapper.tickByTickAllLast
    Dim tickTypeStr As String
    If tickType = 1 Then
        tickTypeStr = "Last"
    Else
        tickTypeStr = "AllLast"
    End If
    Console.WriteLine("Tick-By-Tick. Request Id: {0}, TickType: {1}, Time: {2}, Price: {3}, Size: {4}, Exchange: {5}, Special Conditions: {6}, PastLimit: {7}, Unreported: {8}",
        reqId, tickTypeStr, Util.UnixSecondsToString(time, "yyyyMMdd-HH:mm:ss"), Util.DoubleMaxString(price), Util.DecimalMaxString(size), exchange, specialConditions,
        tickAttribLast.PastLimit, tickAttribLast.Unreported)
End Sub
```

#### EWrapper.tickByTickBidAsk (

**reqId:** int. unique identifier of the request.

**time:** long. timestamp of the tick.

**bidPrice:** double. bid price of the tick.

**askPrice:** double. ask price of the tick.

**bidSize:** decimal. bid size of the tick.

**askSize:** decimal. ask size of the tick.

**tickAttribBidAsk:** TickAttribBidAsk. tick-by-tick real-time bid/ask tick attribs (bit 0 – bid past low, bit 1 – ask past high).  
)

Returns “BidAsk” tick-by-tick real-time tick.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
 def tickByTickBidAsk(self, reqId: int, time: int, bidPrice: float, askPrice: float, bidSize: Decimal, askSize: Decimal, tickAttribBidAsk: TickAttribBidAsk):
    print("BidAsk. ReqId:", reqId, "Time:", time, "BidPrice:", floatMaxString(bidPrice), "AskPrice:", floatMaxString(askPrice), "BidSize:", decimalMaxString(bidSize), "AskSize:", decimalMaxString(askSize), "BidPastLow:", tickAttribBidAsk.bidPastLow, "AskPastHigh:", tickAttribBidAsk.askPastHigh)
```

``` EnlighterJSRAW
@Override
public void tickByTickBidAsk(int reqId, long time, double bidPrice, double askPrice, Decimal bidSize, Decimal askSize, TickAttribBidAsk tickAttribBidAsk) {
    System.out.println(EWrapperMsgGenerator.tickByTickBidAsk(reqId, time, bidPrice, askPrice, bidSize, askSize, tickAttribBidAsk));
}
```

``` EnlighterJSRAW
void TestCppClient::tickByTickBidAsk(int reqId, time_t time, double bidPrice, double askPrice, Decimal bidSize, Decimal askSize, const TickAttribBidAsk& tickAttribBidAsk) {
    printf("Tick-By-Tick. ReqId: %d, TickType: BidAsk, Time: %s, BidPrice: %s, AskPrice: %s, BidSize: %s, AskSize: %s, BidPastLow: %d, AskPastHigh: %d\n", reqId, ctime(&time), Utils::doubleMaxString(bidPrice).c_str(), Utils::doubleMaxString(askPrice).c_str(), decimalStringToDisplay(bidSize).c_str(), decimalStringToDisplay(askSize).c_str(), tickAttribBidAsk.bidPastLow, tickAttribBidAsk.askPastHigh);
}
```

``` EnlighterJSRAW
public void tickByTickBidAsk(int reqId, long time, double bidPrice, double askPrice, decimal bidSize, decimal askSize, TickAttribBidAsk tickAttribBidAsk)
{
    Console.WriteLine("Tick-By-Tick. Request Id: {0}, TickType: BidAsk, Time: {1}, BidPrice: {2}, AskPrice: {3}, BidSize: {4}, AskSize: {5}, BidPastLow: {6}, AskPastHigh: {7}", reqId, Util.UnixSecondsToString(time, "yyyyMMdd-HH:mm:ss"), Util.DoubleMaxString(bidPrice), Util.DoubleMaxString(askPrice), Util.DecimalMaxString(bidSize), Util.DecimalMaxString(askSize), tickAttribBidAsk.BidPastLow, tickAttribBidAsk.AskPastHigh);
}
```

``` EnlighterJSRAW
Public Sub tickByTickBidAsk(reqId As Integer, time As Long, bidPrice As Double, askPrice As Double, bidSize As Decimal, askSize As Decimal, tickAttribBidAsk As TickAttribBidAsk) Implements EWrapper.tickByTickBidAsk
            Console.WriteLine("Tick-By-Tick. Request Id: {0}, TickType: BidAsk, Time: {1}, BidPrice: {2}, AskPrice: {3}, BidSize: {4}, AskSize: {5}, BidPastLow: {6}, AskPastHigh: {7}",
                reqId, Util.UnixSecondsToString(time, "yyyyMMdd-HH:mm:ss"), Util.DoubleMaxString(bidPrice), Util.DoubleMaxString(askPrice), Util.DecimalMaxString(bidSize), Util.DecimalMaxString(askSize),
                tickAttribBidAsk.BidPastLow, tickAttribBidAsk.AskPastHigh)
        End Sub
```

#### EWrapper.tickByTickMidPoint (

**reqId:** int. Request identifier used to track data.

**time:** long. Timestamp of the tick.

**midPoint:** double. Mid point value of the tick.  
)

Returns “MidPoint” tick-by-tick real-time tick.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
def tickByTickMidPoint(self, reqId: int, time: int, midPoint: float):
    print("Midpoint. ReqId:", reqId, "Time:", time, "MidPoint:", floatMaxString(midPoint))
```

``` EnlighterJSRAW
@Override
public void tickByTickMidPoint(int reqId, long time, double midPoint) {
    System.out.println(EWrapperMsgGenerator.tickByTickMidPoint(reqId, time, midPoint));
}
```

``` EnlighterJSRAW
void TestCppClient::tickByTickMidPoint(int reqId, time_t time, double midPoint) {
    printf("Tick-By-Tick. ReqId: %d, TickType: MidPoint, Time: %s, MidPoint: %s\n", reqId, ctime(&time), Utils::doubleMaxString(midPoint).c_str());
}
```

``` EnlighterJSRAW
public void tickByTickMidPoint(int reqId, long time, double midPoint)
{
    Console.WriteLine("Tick-By-Tick. Request Id: {0}, TickType: MidPoint, Time: {1}, MidPoint: {2}", reqId, Util.UnixSecondsToString(time, "yyyyMMdd-HH:mm:ss"), Util.DoubleMaxString(midPoint));
}
```

``` EnlighterJSRAW
Public Sub tickByTickMidPoint(reqId As Integer, time As Long, midPoint As Double) Implements EWrapper.tickByTickMidPoint
    Console.WriteLine("Tick-By-Tick. Request Id: {0}, TickType: MidPoint, Time: {1}, MidPoint: {2}", reqId, Util.UnixSecondsToString(time, "yyyyMMdd-HH:mm:ss"), Util.DoubleMaxString(midPoint))
End Sub
```

### Cancel Tick By Tick Data

#### EClient.cancelTickByTickData (

**requestId:** int. Request identifier used to track data.  
)

Cancels specified tick-by-tick data.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
self.cancelTickByTickData(19001)
```

``` EnlighterJSRAW
client.cancelTickByTickData(19001);
```

``` EnlighterJSRAW
m_pClient->cancelTickByTickData(20001);
```

``` EnlighterJSRAW
client.cancelTickByTickData(19001);
```

``` EnlighterJSRAW
client.cancelTickByTickData(19001)
```

### Halted and Unhalted ticks

The Tick-By-Tick attribute has been introduced. The tick attribute *pastLimit* is also returned with historical Tick-By-Tick responses.

  - If tick has zero price, zero size and pastLimit flag is set – this is “Halted” tick.
  - If tick has zero price, zero size and followed immediately after “Halted” tick – this is “Unhalted” tick.

## Market Scanner

Some scans in the TWS Advanced Market Scanner can be accessed via the TWS API through the EClient.reqScannerSubscription.

Results are delivered via EWrapper.scannerData and the EWrapper.scannerDataEnd marker will indicate when all results have been delivered. The returned results to scannerData simply consist of a list of contracts. There are no market data fields (bid, ask, last, volume, …) returned from the scanner, and so if these are desired they have to be requested separately with the reqMktData function. Since the scanner results do not include any market data fields, it is not necessary to have market data subscriptions to use the API scanner. However to use filters, market data subscriptions are generally required.

Since the EClient.reqScannerSubscription request keeps a subscription open you will keep receiving periodic updates until the request is cancelled via EClient.cancelScannerSubscription :

Scans are limited to a maximum result of 50 results per scan code, and only 10 API scans can be active at a time.

scannerSubscriptionFilterOptions has been added to the API to allow for generic filters. This field is entered as a list of TagValues which have a tag followed by its value, e.g. TagValue(“usdMarketCapAbove”, “10000”) indicates a market cap above 10000 USD. Available filters can be found using the EClient.reqScannerParameters function.

A string containing all available XML-formatted parameters will then be returned via EWrapper.scannerParameters.

**Important:** remember the TWS API is just an interface to the TWS. If you are having problems defining a scanner, always make sure you can create a similar scanner using the TWS’ [Advanced Market Scanner](https://ibkrguides.com/tws/usersguidebook/mosaic/advancedscanner.htm).

### Market Scanner Parameters

A string containing all available XML-formatted parameters will then be returned via EWrapper.scannerParameters.

### Request Market Scanner Parameters

#### EClient.reqScannerParameters ()

Requests an XML list of scanner parameters valid in TWS.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
self.reqScannerParameters()
```

``` EnlighterJSRAW
client.reqScannerParameters();
```

``` EnlighterJSRAW
m_pClient->reqScannerParameters();
```

``` EnlighterJSRAW
client.reqScannerParameters();
```

``` EnlighterJSRAW
client.reqScannerParameters()
```

### Receive Market Scanner Parameters

#### EWrapper.scannerParameters (

**xml:** String. The xml-formatted string with the available parameters.  
)

Provides the xml-formatted parameters available from TWS market scanners (not all available in API).

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
def scannerParameters(self, xml: str):
    open('log/scanner.xml', 'w').write(xml)
    print("ScannerParameters received.")
```

``` EnlighterJSRAW
@Override
public void scannerParameters(String xml) {
    System.out.println("ScannerParameters. " + xml + "\n");
}
```

``` EnlighterJSRAW
void TestCppClient::scannerParameters(const std::string& xml) {
    printf( "ScannerParameters. %s\n", xml.c_str());
}
```

``` EnlighterJSRAW
public virtual void scannerParameters(string xml)
{
    Console.WriteLine("ScannerParameters. "+xml+"\n");
}
```

``` EnlighterJSRAW
Public Sub scannerParameters(xml As String) Implements IBApi.EWrapper.scannerParameters
    Console.WriteLine("ScannerParameters. " & xml & "\n")
End Sub
```

### Market Scanner Subscription

All values used for the ScannerSubscription object are pulled from EClient.scannerParams response. The XML tree will relay a tree containing a corresponding code to each ScannerSubscription field as documented below.

**instrument:** `<ScanParameterResponse> <InstrumentList> <Instrument> <type>`

**Location Code: **`<ScanParameterResponse> <LocationTree> <Location> <LocationTree> <Location> <locationCode>`

**Scan Code:** `<ScanParameterResponse> <ScanTypeList> <ScanType> <scanCode>`

**Subscription Options** should be an empty array of TagValues.

**Filter Options:** `<ScanParameterResponse> <FilterList> <RangeFilter> <AbstractField> <code>`

#### ScannerSubscription()

**Instrument:** String. Instrument Type to use.

**Location Code:** String. Country or region for scanner to search.

**Scan Code:** String. Value for scanner to sort by.

**Subscription Options:** Array of TagValues. For internal use only.

**Filter Options:** Array of TagValues. Contains an array of TagValue objects which filters the scanner subscription.

### Request Market Scanner Subscription

#### EClient.reqScannerSubscription (

**reqId:** int. Request identifier used for tracking data.

**subscription:** [ScannerSubscription](/campus/ibkr-api-page/twsapi-ref/#scannersubscription-ref). Object containing details on what values should be used to construct and sort the list.

**scannerSubscriptionOptions:** List. Internal use only.

**scannerSubscriptionFilterOptions:** List. List of values used to filter the results of the scanner subscription. May result in an empty scanner response from over-filtering.  
)

Starts a subscription to market scan results based on the provided parameters.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
self.reqScannerSubscription(7002, scannerSubscription, [], filterTagvalues)
```

``` EnlighterJSRAW
client.reqScannerSubscription(7002, scannerSubscription, null, FilterTagValues);
```

``` EnlighterJSRAW
m_pClient->reqScannerSubscription(7002, scannerSubscription, TagValueListSPtr(), filterTagValues);
```

``` EnlighterJSRAW
client.reqScannerSubscription(7002, scannerSubscription, null, filterTagValues);
```

``` EnlighterJSRAW
client.reqScannerSubscription(7002, scannerSubscription, Nothing, filterTagValues)
```

### Receive Market Scanner Subscription

#### EWrapper.scannerData (

**reqid:** int. Request identifier used to track data.

**rank:** int. The ranking position of the contract in the scanner sort.

**contractDetails:** ContractDetails. Contract object of the resulting object.

**distance:** String. Internal use only.

**benchmark:** String. Internal use only.

**projection:** String. Internal use only.

**legStr:** String. Describes the combo legs when the scanner is returning EFP  
)

Provides the data resulting from the market scanner request.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
def scannerData(self, reqId: int, rank: int, contractDetails: ContractDetails, distance: str, benchmark: str, projection: str, legsStr: str):
    print("ScannerData. ReqId:", reqId, ScanData(contractDetails.contract, rank, distance, benchmark, projection, legsStr))
```

``` EnlighterJSRAW
@Override
public void scannerData(int reqId, int rank, ContractDetails contractDetails, String distance, String benchmark, String projection, String legsStr) {
    System.out.println("ScannerData: " + EWrapperMsgGenerator.scannerData(reqId, rank, contractDetails, distance, benchmark, projection, legsStr));
}
```

``` EnlighterJSRAW
void TestCppClient::scannerData(int reqId, int rank, const ContractDetails& contractDetails, const std::string& distance, const std::string& benchmark, const std::string& projection, const std::string& legsStr) {
    printf( "ScannerData. %d - Rank: %d, Symbol: %s, SecType: %s, Currency: %s, Distance: %s, Benchmark: %s, Projection: %s, Legs String: %s\n", reqId, rank, contractDetails.contract.symbol.c_str(), contractDetails.contract.secType.c_str(), contractDetails.contract.currency.c_str(), distance.c_str(), benchmark.c_str(), projection.c_str(), legsStr.c_str());
}
```

``` EnlighterJSRAW
public virtual void scannerData(int reqId, int rank, ContractDetails contractDetails, string distance, string benchmark, string projection, string legsStr)
{
    Console.WriteLine("ScannerData. "+reqId+" - Rank: "+rank+", Symbol: "+contractDetails.Contract.Symbol+", SecType: "+contractDetails.Contract.SecType+", Currency: "+contractDetails.Contract.Currency +", Distance: "+distance+", Benchmark: "+benchmark+", Projection: "+projection+", Legs String: "+legsStr);
}
```

``` EnlighterJSRAW
Public Sub scannerData(reqId As Integer, rank As Integer, contractDetails As IBApi.ContractDetails, distance As String, benchmark As String, projection As String, legsStr As String) Implements IBApi.EWrapper.scannerData
    Console.WriteLine("ScannerData. " & reqId & " - Rank: " & rank & ", : " & contractDetails.Contract.Symbol & ", SecType: " &contractDetails.Contract.SecType & ", Currency: " & contractDetails.Contract.Currency & ", Distance: " & distance & ", Benchmark: " & benchmark & ", Projection: " & projection & ", Legs String: " & legsStr)
End Sub
```

### Cancel Market Scanner Subscription

#### EClient.cancelScannerSubscription (

**tickerId:** int. Request identifier used to track data.  
)

Cancels the specified scanner subscription using the tickerId.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
self.cancelScannerSubscription(7003)
```

``` EnlighterJSRAW
client.cancelScannerSubscription(7003);
```

``` EnlighterJSRAW
m_pClient->cancelScannerSubscription(7002);
```

``` EnlighterJSRAW
client.cancelScannerSubscription(7003);
```

``` EnlighterJSRAW
client.cancelScannerSubscription(7003)
```

## News

API news requires news subscriptions that are specific to the API; most news services in TWS are not also available in the API. There are three API news services enabled in accounts by default and available from the API. They are:

  - Briefing.com General Market Columns (BRFG)
  - Briefing.com Analyst Actions (BRFUPDN)
  - Dow Jones Newsletters (DJNL)

There are also four additional news services available with all TWS versions which require **API-specific subscriptions** to first be made in Account Management. They have different data fees than the subscription for the same news in TWS-only. As with all subscriptions, they only apply to the specific TWS username under which they were made:

  - Briefing Trader (BRF)
  - Benzinga Pro (BZ)
  - Fly on the Wall (FLY)

The API functions which handle news are able to query available news provides, subscribe to news in real time to receive headlines as they are released, request specific news articles, and return a historical list of news stories that are cached in the system.

### News Providers

Adding or removing API news subscriptions from an account is accomplished through Account Management. From the API, currently subscribed news sources can be retrieved using the function IBApi::EClient::reqNewsProviders. A list of available subscribed news sources is returned to the function IBApi::EWrapper::newsProviders

### Request News Providers

#### EClient.reqNewsProviders()

Requests news providers which the user has subscribed to.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
self.reqNewsProviders()
```

``` EnlighterJSRAW
client.reqNewsProviders();
```

``` EnlighterJSRAW
m_pClient->reqNewsProviders();
```

``` EnlighterJSRAW
client.reqNewsProviders();
```

``` EnlighterJSRAW
client.reqNewsProviders()
```

### Receive News Providers

#### EWrapper.newsProviders (

**newsProviders:** NewsProviders\[\]. Unique array containing all available news sources.  
)

Returns array of subscribed API news providers for this user

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
def newsProviders(self, newsProviders: ListOfNewsProviders):
    print("NewsProviders: ", newsProviders)
```

``` EnlighterJSRAW
@Override
public void newsProviders(NewsProvider[] newsProviders) {
    System.out.print(EWrapperMsgGenerator.newsProviders(newsProviders));
}
```

``` EnlighterJSRAW
void TestCppClient::newsProviders(const std::vector &newsProviders) {
    printf("News providers (%lu):\n", newsProviders.size());
    for (unsigned int i = 0; i < newsProviders.size(); i++) {
        printf("News provider [%d] - providerCode: %s providerName: %s\n", i, newsProviders[i].providerCode.c_str(), newsProviders[i].providerName.c_str());
    }
}
```

``` EnlighterJSRAW
public void newsProviders(NewsProvider[] newsProviders)
{
    Console.WriteLine("News Providers:");
    foreach (var newsProvider in newsProviders)
    {
        Console.WriteLine("News provider: providerCode - {0}, providerName - {1}",
            newsProvider.ProviderCode, newsProvider.ProviderName);
    }
}
```

``` EnlighterJSRAW
Public Sub newsProviders(newsProviders As NewsProvider()) Implements EWrapper.newsProviders
  Console.WriteLine("News Providers")
  For Each newsProvider In newsProviders
    Console.WriteLine("News Provider: providerCode - " & newsProvider.ProviderCode & ", providerName - " & newsProvider.ProviderName)
  Next
End Sub
```

### Live News Headlines

**Important:** in order to obtain news feeds via the TWS API you need to acquire the relevant API-specific subscriptions via your Account Management.

News articles provided through the API may not correspond to what is available directly through the Trader Workstation. Off-platform distribution of data is at the discretion of the news source provider, not by Interactive Brokers.

When invoking IBApi.EClient.reqMktData, for a specific IBApi.Contract you will follow the same format convention as any other basic contracts. The News Source is identified by the genericTickList argument.

**Note:** The error message “invalid tick type” will be returned if the username has not added the appropriate API news subscription.

****Note**:** For Briefing Trader live head lines via the API is only offered on a case-by-case basis directly from Briefing.com offers Briefing Trader subscribers access to the subscription live head lines via the API. For more information and to submit an API entitlement application, please contact Briefing.com directly at [dbeasley@briefing.com](https://interactivebrokers.github.io/tws-api/news.html#).

### Request Contract Specific News

#### EClient.reqMktData (

**reqId:** int. Request identifier for tracking data.

**contract:** Contract. Contract object used for specifying an instrument.

**genericTickList:** String. Comma separated ids of the available generic ticks.

**snapshot:** bool. Always set to false for news data.

**regulatorySnapshot:** bool. Always set to false for news data.

**mktDataOptions:** List\<TagValue\>. Internal use only.  
)

Used to request market data typically, but can also be used to retrieve news. “mdoff” can be specified to disable standard market data while retrieving news.  
For news sources, genericTick 292 needs to be specified followed by a colon and the news provider’s code.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
self.reqMktData(reqId, contract, "mdoff,292:BRFG", False, False, [])
```

``` EnlighterJSRAW
client.reqMktData(reqId, contract, "mdoff,292:BRFG", false, false, null);
```

``` EnlighterJSRAW
m_pClient->reqMktData(reqId, contract, "mdoff,292:BRFG", false, false, TagValueListSPtr());
```

``` EnlighterJSRAW
client.reqMktData(reqId, contract, "mdoff,292:BRFG", false, false, null);
```

``` EnlighterJSRAW
client.reqMktData(reqId, contract, "mdoff,292:BRFG", False, False, Nothing)
```

### Request BroadTape News

#### BroadTape News Contracts

For BroadTape News you specify the contract for the specific news source. This is uniquely identified by the symbol and exchange. The symbol of an instrument can easily be obtained via the [EClientSocket.reqContractDetails](#request-contract-details) request.

The symbol is typically the provider code, a colon, then the news provider codes appended with “\_ALL”

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

#### Example news contract

``` EnlighterJSRAW
contract = Contract()
contract.symbol  = "BRF:BRF_ALL"
contract.secType = "NEWS"
contract.exchange = "BRF"
```

#### Example news contract

``` EnlighterJSRAW
Contract contract = new Contract();
contract.symbol("BRF:BRF_ALL");
contract.secType("NEWS");
contract.exchange("BRF"); 
```

#### Example news contract

``` EnlighterJSRAW
Contract contract;
contract.symbol = "BRF:BRF_ALL"; 
contract.secType = "NEWS";
contract.exchange = "BRF";
```

#### Example news contract

``` EnlighterJSRAW
Contract contract = new Contract();
contract.Symbol = "BRF:BRF_ALL";
contract.SecType = "NEWS";
contract.Exchange = "BRF";
```

#### Example news contract

``` EnlighterJSRAW
Dim contract As Contract = New Contract()
contract.Symbol = "BRF:BRF_ALL"
contract.SecType = "NEWS"
contract.Exchange = "BRF"
```

#### EClient.reqMktData (

**reqId:** int. Request identifier for tracking data.

**contract:** Contract. Contract object used for specifying an instrument.

**genericTickList:** String. Comma separated ids of the available generic ticks.

**snapshot:** bool. Always set to false for news data.

**regulatorySnapshot:** bool. Always set to false for news data.

**mktDataOptions:** List\<TagValue\>. Internal use only.  
)

Used to request market data typically, but can also be used to retrieve news. “mdoff” can be specified to disable standard market data while retrieving news.

For news sources, genericTick 292 needs to be specified.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
self.reqMktData(reqId, contract, "mdoff,292", False, False, [])
```

``` EnlighterJSRAW
client.reqMktData(reqId, contract, "mdoff,292", false, false, null);
```

``` EnlighterJSRAW
m_pClient->reqMktData(reqId, contract, "mdoff,292", false, false, TagValueListSPtr());
```

``` EnlighterJSRAW
client.reqMktData(reqId, contract, "mdoff,292", false, false, null);
```

``` EnlighterJSRAW
client.reqMktData(reqId, contract, "mdoff,292", False, False, Nothing)
```

### Receive Live News Headlines

#### EWrapper.tickNews (

**tickerId:** int. Request identifier used to track data.

**timeStamp:** int. Epoch time of the article’s published time.

**providerCode:** String. News provider code based on requested data.

**articleId:** String. Identifier used to track the particular article. See [News Article](https://www.interactivebrokers.com/campus/ibkr-api-page/trader-workstation-api/#news-articles) for more.

**headline:** String. Headline of the provided news article.

**extraData:** String. Returns any additional data available about the article.  
)

Returns news headlines for requested contracts.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
def tickNews(self, tickerId: int, timeStamp: int, providerCode: str, articleId: str, headline: str, extraData: str):
  print("TickNews. TickerId:", tickerId, "TimeStamp:", timeStamp, "ProviderCode:", providerCode, "ArticleId:", articleId, "Headline:", headline, "ExtraData:", extraData)
```

``` EnlighterJSRAW
@Override
public void tickNews(int tickerId, long timeStamp, String providerCode, String articleId, String headline, String extraData) {
    System.out.println(EWrapperMsgGenerator.tickNews(tickerId, timeStamp, providerCode, articleId, headline, extraData));
}
```

``` EnlighterJSRAW
void TestCppClient::tickNews(int tickerId, time_t timeStamp, const std::string& providerCode, const std::string& articleId, const std::string& headline, const std::string& extraData) {
    printf("News Tick. TickerId: %d, TimeStamp: %s, ProviderCode: %s, ArticleId: %s, Headline: %s, ExtraData: %s\n", tickerId, ctime(&(timeStamp /= 1000)), providerCode.c_str(), articleId.c_str(), headline.c_str(), extraData.c_str());
}
```

``` EnlighterJSRAW
public void tickNews(int tickerId, long timeStamp, string providerCode, string articleId, string headline, string extraData)
{
    Console.WriteLine("Tick News. Ticker Id: {0}, Time Stamp: {1}, Provider Code: {2}, Article Id: {3}, headline: {4}, extraData: {5}", tickerId, Util.LongMaxString(timeStamp), providerCode, articleId, headline, extraData);
}
```

``` EnlighterJSRAW
Public Sub tickNews(tickerId As Integer, timeStamp As Long, providerCode As String, articleId As String, headline As String, extraData As String) Implements IBApi.EWrapper.tickNews
    Console.WriteLine("Tick News. Ticker Id: " & tickerId & ", Time Stamp: " & Util.LongMaxString(timeStamp) & ", Provider Code: " & providerCode & ", Article Id: " & articleId & ", Headline: " & headline & ", Extra Data: " & extraData)
End Sub
```

### Historical News Headlines

With the appropriate API news subscription, historical news headlines can be requested from the API using the function EClient::reqHistoricalNews. The resulting headlines are returned to EWrapper::historicalNews.

### Requesting Historical News

#### EClient.reqHistoricalNews (

**requestId:** int. Request identifier used to track data.

**conId:** int. Contract id of ticker. See Contract Details for how to retrieve conId.

**providerCodes:** String. A ‘+’-separated list of provider codes.

**startDateTime:** String. Marks the (exclusive) start of the date range. The format is yyyy-MM-dd HH:mm:ss.

**endDateTime:** String. Marks the (inclusive) end of the date range. The format is yyyy-MM-dd HH:mm:ss.

**totalResults:** int. The maximum number of headlines to fetch (1 – 300)

**historicalNewsOptions:** Null. Reserved for internal use. Should be defined as null.  
)

Requests historical news headlines.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
self.reqHistoricalNews(reqId, 8314, "BRFG", "", "", 10, [])
```

``` EnlighterJSRAW
client.reqHistoricalNews(reqId, 8314, "BZ+FLY", "", "", 10, null);
```

``` EnlighterJSRAW
TagValueList* list = new TagValueList();
list->push_back((TagValueSPtr)new TagValue("manual", "1"));
m_pClient->reqHistoricalNews(reqId, 8314, "BZ+FLY", "", "", 5, TagValueListSPtr(list));
```

``` EnlighterJSRAW
client.reqHistoricalNews(reqId, 8314, "BZ+FLY", "", "", 10, null);
```

``` EnlighterJSRAW
client.reqHistoricalNews(reqId, 8314, "BZ+FLY", "", "", 10, Nothing)
```

### Receive Historical News

#### EWrapper.historicalNews (

**requestId:** int. Request identifier used to track data.

**time:** int. Epoch time of the article’s published time.

**providerCode:** String. News provider code based on requested data.

**articleId:** String. Identifier used to track the particular article. See [News Article](https://www.interactivebrokers.com/campus/ibkr-api-page/trader-workstation-api/#news-articles) for more.

**headline:** String. Headline of the provided news article.  
)

Returns news headlines for requested contracts.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
def historicalNews(self, requestId: int, time: int, providerCode: str, articleId: str, headline: str):
  print("historicalNews. RequestId:", requestId, "Time:", time, "ProviderCode:", providerCode, "ArticleId:", articleId, "Headline:", headline)
```

``` EnlighterJSRAW
@Override
public void historicalNews(int requestId, long time, String providerCode, String articleId, String headline) {
    System.out.println( EWrapperMsgGenerator.historicalNews( requestId, time, providerCode, articleId, headline));
}
```

``` EnlighterJSRAW
void TestCppClient::historicalNews(int requestId, time_t time, const std::string& providerCode, const std::string& articleId, const std::string& headline) {
    printf("historicalNews. RequestId: %d, Time: %s, ProviderCode: %s, ArticleId: %s, Headline: %s\n", requestId, ctime(&(time /= 1000)), providerCode.c_str(), articleId.c_str(), headline.c_str());
}
```

``` EnlighterJSRAW
public void historicalNews(int requestId, long time, string providerCode, string articleId, string headline)
{
    Console.WriteLine("historicalNews. RequestId: {0}, Time Stamp: {1}, Provider Code: {2}, Article Id: {3}, headline: {4}, extraData: {5}", requestId, Util.LongMaxString(time), providerCode, articleId, headline);
}
```

``` EnlighterJSRAW
Public Sub historicalNews(requestId As Integer, time As Long, providerCode As String, articleId As String, headline As String) Implements IBApi.EWrapper.tickNews
    Console.WriteLine("Tick News. Ticker Id: " & tickerId & ", Time: " & Util.LongMaxString(time) & ", Provider Code: " & providerCode & ", Article Id: " & articleId & ", Headline: " & headline)
End Sub
```

#### EWrapper.historicalNewsEnd (

**requestId:** int. Request identifier used to track data.

**hasMore:** bool. Returns whether there is more data (true) or not (false).  
)

Returns news headlines end marker

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
def historicalDataEnd(self, reqId: int, hasMore: bool):
    print("historicalDataEnd. ReqId:", reqId, "Has More:", hasMore)
```

``` EnlighterJSRAW
@Override
public void historicalDataEnd(int reqId, bool hasMore) {
    System.out.println("historicalDataEnd. Req Id: " + EWrapperMsgGenerator.historicalDataEnd(reqId, hasMore));
}
```

``` EnlighterJSRAW
void TestCppClient::historicalDataEnd( int reqId, bool hasMore) {
    printf( "historicalDataEnd. Req Id: %d\n", reqId);
}
```

``` EnlighterJSRAW
public virtual void historicalDataEnd(int reqId, bool hasMore)
{
    Console.WriteLine("historicalDataEnd. Req Id: "+reqId+"\n");
}
```

``` EnlighterJSRAW
Public Sub historicalDataEnd(reqId As Integer, hasMore as Boolean) Implements IBApi.EWrapper.historicalDataEnd
    Console.WriteLine("historicalDataEnd - ReqId [" & reqId & "]")
End Sub
```

### News Articles

After requesting news headlines using one of the above functions, the body of a news article can be requested with the article ID returned by invoking the function IBApi::EClient::reqNewsArticle. The body of the news article is returned to the function IBApi::EWrapper::newsArticle.

### Request News Articles

#### EClient.reqNewsArticle (

**requestId:** int. id of the request.

**providerCode:** String. Short code indicating news provider, e.g. FLY.

**articleId:** String. Id of the specific article.

**newsArticleOptions:** List. Reserved for internal use. Should be defined as null.  
)

Requests news article body given articleId.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
self.reqNewsArticle(10002,"BRFG", "BRFG$04fb9da2", [])
```

``` EnlighterJSRAW
client.reqNewsArticle(10002, "BZ", "BZ$04507322", null);
```

``` EnlighterJSRAW
TagValueList* list = new TagValueList();
m_pClient->reqNewsArticle(12001, "MST", "MST$06f53098", TagValueListSPtr(list));
```

``` EnlighterJSRAW
client.reqNewsArticle(12002, "BZ", "BZ$04507322", null);
```

``` EnlighterJSRAW
client.reqNewsArticle(10002, "BZ", "BZ$04507322", Nothing)
```

### Receive News Articles

#### EWrapper.newsArticle (

**requestId:** int. Request identifier used to track data.

**articleType:** int. The type of news article (0 – plain text or html, 1 – binary data / pdf).

**articleText:** String. The body of article (if articleType == 1, the binary data is encoded using the Base64 scheme).  
)

Called when receiving a News Article in response to reqNewsArticle().

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
def newsArticle(self, requestId: int, articleType: int, articleText: str):
  print("requestId: ", requestId, "articleType: ", articleType, "articleText: ", articleText)
```

``` EnlighterJSRAW
@Override
public void newsArticle(int requestId, int articleType, str articleText) {
  System.out.print(EWrapperMsgGenerator.newsArticle(requestId, articleType, articleText));
}
```

``` EnlighterJSRAW
void TestCppClient::newsArticle(int requestId, int articleType, const std::string& articleText) {
    printf("newsArticle.", requestId, articleType, articleText);
}
```

``` EnlighterJSRAW
public void newsArticle(int requestId, int articleType, string articleText)
{
  Console.WriteLine("newsArticle. Request Id: {0}, Article Type: {1}, Article Text: {2}", requestId, articleType, articleText);
}
```

``` EnlighterJSRAW
Public Sub newsArticle(requestId As Integer, articleType As Integer, articleText As String) Implements IBApi.EWrapper.newsArticle
  Console.WriteLine("newsArticle. Request Id: " & requestId & ", Article Type: " & articleType & ", Article Text: " & articleText)
End Sub
```

## Next Valid ID

The nextValidId event provides the next valid identifier needed to place an order. It is necessary to use an order ID with new orders which is greater than all previous order IDs used to place an order. While requests such as EClient.reqMktData will not increment the minimum request ID value, more than one market data request cannot use the same request ID at the same time.

The nextValidId value may be queried on each request. However, it is often recommended to make a request once at the beginning of the session, and then locally increment the value for each request.

### Request Next Valid ID

#### EClient.reqIds (

**numIds:** int. This parameter will not affect the value returned to nextValidId but is required.  
)

Requests the next valid order ID at the current moment be returned to the EWrapper.nextValidId function.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
self.reqIds(-1)
```

``` EnlighterJSRAW
client.reqIds(-1);
```

``` EnlighterJSRAW
m_pClient->reqIds(-1);
```

``` EnlighterJSRAW
client.reqIds(-1);
```

``` EnlighterJSRAW
client.reqIds(-1)
```

### Receive Next Valid ID

#### EWrapper.nextValidId (

**orderId:** int. Receives next valid order id.  
)

Will be invoked automatically upon successful API client connection, or after call to EClient.reqIds.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
def nextValidId(self, orderId: int):
    print("NextValidId:", orderId)
```

``` EnlighterJSRAW
@Override
public void nextValidId(int orderId) {
    System.out.println(EWrapperMsgGenerator.nextValidId(orderId));
    currentOrderId = orderId;
}
```

``` EnlighterJSRAW
void TestCppClient::nextValidId( OrderId orderId)
{
    printf("Next Valid Id: %ld\n", orderId);
    m_orderId = orderId;
}
```

``` EnlighterJSRAW
public virtual void nextValidId(int orderId) 
{
    Console.WriteLine("Next Valid Id: "+orderId);
    NextOrderId = orderId;
}
```

``` EnlighterJSRAW
Public Sub nextValidId(orderId As Integer) Implements IBApi.EWrapper.nextValidId
    Console.WriteLine("NextValidId - OrderId [" & orderId & "]")
    nextOrderId = orderId
End Sub
```

### Reset Order ID Sequence

The next valid identifier is persistent between TWS sessions.

If necessary, you can reset the order ID sequence within the API Settings dialogue. Note however that the order sequence Id can only be reset if there are no active API orders.

## Order Management

### ClientId 0 and the Master Client ID

Each TWS API connection maintains its own ClientID to the host through the EClient.connect function. There are two unique client ID behaviors developers must be aware of:

  - **Master ClientID:** The Master Client ID is set in the Global Configuration and is used to distinguish the connecting Client ID used to pull order and trades data even from other API connections. Connecting without using the Master Client ID will mean only trades on the connected Client ID will be returning from calls to the openOrder or execDetails functions.
  - **ClientID 0:** ClientID 0 is unique from the rest of the client IDs in that users can receive trades made through Trader Workstation or through FIX in addition to trades that take place on the current client ID.

The Master ClientID value can be assigned to 0 so that a connection can retrieve orders placed from TWS, FIX sessions, and all API connections on the account.

### Commission And Fees Report

When an order is filled either fully or partially, the [IBApi.EWrapper.execDetails](#exec-details) and IBApi.EWrapper.commissionReport events will deliver [IBApi.Execution](#exec-details) and IBApi.CommissionAndFeesReport objects. This allows to obtain the full picture of the order’s execution and the resulting commissions.

  - Advisors executing allocation orders will receive execution details and commissions for the allocation order itself. To receive allocation details and commissions for a specific subaccount [IBApi.EClient.reqExecutions](https://www.interactivebrokers.com/campus/ibkr-api-page/trader-workstation-api/#request-exec-details) can be used.

#### EWrapper.commissionReport (

**commissionAndFeesReport:** [CommissionAndFeesReport](/ibkr-api-page/twsapi-ref/#commreport-ref). Returns a commissions report object containing the fields execId, commission, currency, realizedPnl, yield, and yieldRedemptionDate.  
)

Provides the Commission Report of an Execution

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
def commissionAndFeesReport(self, commissionAndFeesReport: CommissionAndFeesReport):
    print("CommissionReport.", commissionAndFeesReport)
```

``` EnlighterJSRAW
@Override
public void commissionAndFeesReport(CommissionAndFeesReport commissionAndFeesReport) {
     System.out.println(EWrapperMsgGenerator.commissionAndFeesReport(commissionAndFeesReport));
}
```

``` EnlighterJSRAW
void TestCppClient::commissionAndFeesReport( const CommissionAndFeesReport& commissionAndFeesReport) {
    printf( "CommissionAndFeesReport. %s - %s %s RPNL %s\n", commissionAndFeesReport.execId.c_str(), Utils::doubleMaxString(commissionAndFeesReport.commission).c_str(), commissionAndFeesReport.currency.c_str(), Utils::doubleMaxString(commissionAndFeesReport.realizedPNL).c_str());
}
```

``` EnlighterJSRAW
public virtual void commissionAndFeesReport(CommissionAndFeesReport commissionAndFeesReport)
{
  Console.WriteLine("CommissionAndFeesReport. " + commissionAndFeesReport.ExecId + " - " + Util.DoubleMaxString(commissionAndFeesReport.Commission) + " " + commissionAndFeesReport.Currency + " RPNL " + Util.DoubleMaxString(commissionAndFeesReport.RealizedPNL));
}
```

``` EnlighterJSRAW
Public Sub commissionAndFeesReport(commissionAndFeesReportAs IBApi.CommissionAndFeesReport) Implements IBApi.EWrapper.commissionAndFeesReport
  Console.WriteLine("CommissionAndFeesReport - CommissionAndFeesReport[" & Util.DoubleMaxString(commissionAndFeesReport.Commission) & " " & commissionAndFeesReport.Currency & "]")
End Sub
```

### Execution Details

IBApi.Execution and IBApi.CommissionReport can be requested on demand via the IBApi.EClient.reqExecutions method which receives a IBApi.ExecutionFilter object as parameter to obtain only those executions matching the given criteria. An empty IBApi.ExecutionFilter object can be passed to obtain all previous executions.

Once all matching executions have been delivered, an IBApi.EWrapper.execDetailsEnd event will be triggered.

Important: By default, only those executions occurring since midnight for that particular account will be delivered. If you want to request executions from the last 7 days, TWS’s Trade Log setting “Show trades for …” must be adjusted to your requirement. The IB Gateway is limited to only executions from the current trading day since midnight.

### ExecID Behavior

If a correction to an execution is published it will be received as an additional IBApi.EWrapper.execDetails callback with all parameters identical except for the execID in the Execution object. The execID will differ only in the digits after the final period.

By default, most ExecID values will return as 4-segment alphanumeric sequence to identify each unique order. In the case of Combo orders, you may encounter a 5-segment alphanumeric sequence which will be used to denote per-leg executions. As an example, if a 1:1 combo for 200 shares of both contracts is placed, the first leg may fill for 200 shares, then leg 2 may fill for 100 in one execution, and then another execution for leg 2 of 100. The fifth segment will distinguish between these unique inner-combo executions.

### The Execution Object

The Execution object is used to maintain all data related to a user’s traded orders. This can be used in both querying execution details and navigating received data. The details provided will display all information pertaining to the execution, including how many shares were filled, the price of the execution, and what time it took place.

#### Execution()

**OrderId:** int. The API client’s order Id. May not be unique to an account.

**ClientId:** int. The API client identifier which placed the order which originated this execution.

**ExecId:** String. The execution’s identifier. Each partial fill has a separate ExecId. A correction is indicated by an ExecId which differs from a previous ExecId in only the digits after the final period, e.g. an ExecId ending in “.02” would be a correction of a previous execution with an ExecId ending in “.01”.

**Time:** String. The execution’s server time.

**AcctNumber:** String. The account to which the order was allocated.

**Exchange:** String. The exchange where the execution took place.

**Side:** String. Specifies if the transaction was buy or sale BOT for bought, SLD for sold.

**Shares:** decimal. The number of shares filled.

**Price:** double. The order’s execution price excluding commissions.

**PermId:** int. The TWS order identifier. The PermId can be 0 for trades originating outside IB.

**Liquidation:** int. Identifies whether an execution occurred because of an IB-initiated liquidation.

**CumQty:** decimal. Cumulative quantity. Used in regular trades, combo trades and legs of the combo.

**AvgPrice:** double. Average price. Used in regular trades, combo trades and legs of the combo. Does not include commissions.

**OrderRef:** String. The OrderRef is a user-customizable string that can be set from the API or TWS and will be associated with an order for its lifetime.

**EvRule:** String. The Economic Value Rule name and the respective optional argument. The two values should be separated by a colon. For example, aussieBond:YearsToExpiration=3. When the optional argument is not present, the first value will be followed by a colon.

**EvMultiplier:** double. Tells you approximately how much the market value of a contract would change if the price were to change by 1. It cannot be used to get market value by multiplying the price by the approximate multiplier.

**ModelCode:** String. model code

**LastLiquidity:** Liquidity. The liquidity type of the execution.

**pendingPriceRevision:** bool. Describes if the execution is still pending price revision.

Given additional structures for executions are ever evolving, it is recommended to review the relevant Execution class in your programming language for a comprehensive review of what fields are available.

[Execution Class Reference](https://www.interactivebrokers.com/campus/ibkr-api-page/twsapi-ref/#exec-ref)

### Request Execution Details

#### EClient.reqExecutions (

**reqId:** int. The request’s unique identifier.

**filter:** ExecutionFilter. The filter criteria used to determine which execution reports are returned.  
)

Requests current day’s (since midnight) executions and commission report matching the filter. Only the current day’s executions can be retrieved.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
self.reqExecutions(10001, ExecutionFilter())
```

``` EnlighterJSRAW
client.reqExecutions(10001, new ExecutionFilter());
```

``` EnlighterJSRAW
m_pClient->reqExecutions(10001, ExecutionFilter());
```

``` EnlighterJSRAW
client.reqExecutions(10001, new ExecutionFilter());
```

``` EnlighterJSRAW
client.reqExecutions(10001, New ExecutionFilter())
```

### Receive Execution Details

#### EWrapper.execDetails (

**reqId:** int. The request’s identifier.

**contract:** Contract. The Contract of the Order.

**execution:** Execution. The Execution details.  
)

Provides the executions which happened in the last 24 hours.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
def execDetails(self, reqId: int, contract: Contract, execution: Execution):
  print("ExecDetails. ReqId:", reqId, "Symbol:", contract.symbol, "SecType:", contract.secType, "Currency:", contract.currency, execution)
```

``` EnlighterJSRAW
@Override
public void execDetails(int reqId, Contract contract, Execution execution) {
    System.out.println(EWrapperMsgGenerator.execDetails( reqId, contract, execution));
}
```

``` EnlighterJSRAW
void TestCppClient::execDetails( int reqId, const Contract& contract, const Execution& execution) {
    printf( "ExecDetails. ReqId: %d - %s, %s, %s - %s, %s, %s, %s, %s\n", reqId, contract.symbol.c_str(), contract.secType.c_str(), contract.currency.c_str(), execution.execId.c_str(), Utils::longMaxString(execution.orderId).c_str(), decimalStringToDisplay(execution.shares).c_str(), decimalStringToDisplay(execution.cumQty).c_str(), Utils::intMaxString(execution.lastLiquidity).c_str());
}
```

``` EnlighterJSRAW
public virtual void execDetails(int reqId, Contract contract, Execution execution)
{
    Console.WriteLine("ExecDetails. " + reqId + " - " + contract.Symbol + ", " + contract.SecType+", " + contract.Currency+" - " + execution.ExecId + ", " + Util.IntMaxString(execution.OrderId) + 
        ", " + Util.DecimalMaxString(execution.Shares) + ", " + Util.DecimalMaxString(execution.CumQty) + ", " + execution.LastLiquidity);
}
```

``` EnlighterJSRAW
Public Sub execDetails(reqId As Integer, contract As IBApi.Contract, execution As IBApi.Execution) Implements IBApi.EWrapper.execDetails
  Console.WriteLine("ExecDetails - ReqId [" & reqId & "] Contract [" & contract.Symbol & ", " & contract.SecType &
          "] Execution [Price: " & Util.DoubleMaxString(execution.Price) & ", Exchange: " & execution.Exchange & ", Last Liquidity: " & execution.LastLiquidity.ToString() & ", Shares: " & Util.DecimalMaxString(execution.Shares) & ", Cum Qty: " & Util.DecimalMaxString(execution.CumQty) & "]")
End Sub
```

#### EWrapper.execDetailsEnd (

**reqId:** int. The request’s identifier  
)

Indicates the end of the Execution reception.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
def execDetailsEnd(self, reqId: int):
    print("ExecDetailsEnd. ReqId:", reqId)
```

``` EnlighterJSRAW
@Override
public void execDetailsEnd(int reqId) {
    System.out.println("Exec Details End: " + EWrapperMsgGenerator.execDetailsEnd( reqId));
}
```

``` EnlighterJSRAW
void TestCppClient::execDetailsEnd( int reqId) {
    printf( "ExecDetailsEnd. %d\n", reqId);
}
```

``` EnlighterJSRAW
public virtual void execDetailsEnd(int reqId)
{
    Console.WriteLine("ExecDetailsEnd. "+reqId+"\n");
}
```

``` EnlighterJSRAW
Public Sub execDetailsEnd(reqId As Integer) Implements IBApi.EWrapper.execDetailsEnd
    Console.WriteLine("ExecDetailsEnd - ReqId [" & reqId & "]")
End Sub
```

### Open Orders

#### EWrapper.openOrder (

**orderId:** int. The order’s unique id

**contract:** Contract. The order’s Contract.

**order:** Order. The currently active Order.

**orderState:** OrderState. The order’s OrderState  
)

Feeds in currently open orders.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
def openOrder(self, orderId: OrderId, contract: Contract, order: Order, orderState: OrderState):
    print(orderId, contract, order, orderState)
```

``` EnlighterJSRAW
@Override
public void openOrder(int orderId, Contract contract, Order order, OrderState orderState) {
    System.out.println(EWrapperMsgGenerator.openOrder(orderId, contract, order, orderState));
}
```

``` EnlighterJSRAW
void TestCppClient::openOrder( OrderId orderId, const Contract& contract, const Order& order, const OrderState& orderState) {
    printf(orderId, contract, order, orderState);
}
```

``` EnlighterJSRAW
public virtual void openOrder(int orderId, Contract contract, Order order, OrderState orderState)
{
    Console.WriteLine(orderId, contract, order, orderState);
}
```

``` EnlighterJSRAW
Public Sub openOrder(orderId As Integer, contract As IBApi.Contract, order As IBApi.Order, orderState As IBApi.OrderState) Implements IBApi.EWrapper.openOrder
    Console.WriteLine(orderId, contract, order , orderState)
End Sub
```

#### EWrapper.openOrderEnd ()

Notifies the end of the open orders’ reception.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
def openOrderEnd(self):
    print("OpenOrderEnd")
```

``` EnlighterJSRAW
@Override
public void openOrderEnd() {
    System.out.println("Open Order End: " + EWrapperMsgGenerator.openOrderEnd());
}
```

``` EnlighterJSRAW
void TestCppClient::openOrderEnd() {
    printf( "OpenOrderEnd\n");
}
```

``` EnlighterJSRAW
public virtual void openOrderEnd()
{
    Console.WriteLine("OpenOrderEnd");
}
```

``` EnlighterJSRAW
Public Sub openOrderEnd() Implements IBApi.EWrapper.openOrderEnd
    Console.WriteLine("OpenOrderEnd")
End Sub
```

### Order Status

#### EWrapper.orderStatus (

**orderId:** int. The order’s client id.

**status:** String. The current status of the order.

**filled:** decimal. Number of filled positions.

**remaining:** decimal. The remnant positions.

**avgFillPrice:** double. Average filling price.

**permId:** int. The order’s permId used by the TWS to identify orders.

**parentId:** int. Parent’s id. Used for bracket and auto trailing stop orders.

**lastFillPrice:** double. Price at which the last positions were filled.

**clientId:** int. API client which submitted the order.

**whyHeld:** String. this field is used to identify an order held when TWS is trying to locate shares for a short sell. The value used to indicate this is ‘locate’.

**mktCapPrice:** double. If an order has been capped, this indicates the current capped price.  
)

Gives the up-to-date information of an order every time it changes. Often there are duplicate orderStatus messages.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
def orderStatus(self, orderId: OrderId, status: str, filled: Decimal, remaining: Decimal, avgFillPrice: float, permId: int, parentId: int, lastFillPrice: float, clientId: int, whyHeld: str, mktCapPrice: float):
    super().orderStatus(orderId, status, filled, remaining, avgFillPrice, permId, parentId, lastFillPrice, clientId, whyHeld, mktCapPrice)
```

``` EnlighterJSRAW
@Override
public void orderStatus(int orderId, String status, Decimal filled, Decimal remaining, double avgFillPrice, int permId, int parentId, double lastFillPrice, int clientId, String whyHeld, double mktCapPrice) {
    System.out.println(EWrapperMsgGenerator.orderStatus( orderId, status, filled, remaining, avgFillPrice, permId, parentId, lastFillPrice, clientId, whyHeld, mktCapPrice));
}
```

``` EnlighterJSRAW
void TestCppClient::orderStatus(OrderId orderId, const std::string& status, Decimal filled, Decimal remaining, double avgFillPrice, int permId, int parentId, double lastFillPrice, int clientId, const std::string& whyHeld, double mktCapPrice){
    printf(orderId, status, filled, remaining, avgFillPrice, permId, parentId, lastFillPrice, clientId, whyHeld, mktCapPrice);
}
```

``` EnlighterJSRAW
public virtual void orderStatus(int orderId, string status, decimal filled, decimal remaining, double avgFillPrice, int permId, int parentId, double lastFillPrice, int clientId, string whyHeld, double mktCapPrice)
{
    Console.WriteLine("OrderStatus. Id: " + orderId + ", Status: " + status + ", Filled: " + Util.DecimalMaxString(filled) + ", Remaining: " + Util.DecimalMaxString(remaining)
        + ", AvgFillPrice: " + Util.DoubleMaxString(orderId, status, filled, remaining, avgFillPrice, permId, parentId, lastFillPrice, clientId, whyHeld, mktCapPrice);
}
```

``` EnlighterJSRAW
Public Sub orderStatus(orderId As Integer, status As String, filled As Decimal, remaining As Decimal, avgFillPrice As Double, permId As Integer, parentId As Integer, lastFillPrice As Double, clientId As Integer, whyHeld As String, mktCapPrice As Double) Implements IBApi.EWrapper.orderStatus
    Console.WriteLine(orderId , status, filled, remaining, avgFillPrice, permId, parentId, lastFillPrice, clientId, whyHeld, mktCapPrice)
End Sub
```

### Understanding Order Status Message

| Status Code   | Description                                                                                                                                                                                                                                                              |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| PendingSubmit | indicates that you have transmitted the order, but have not yet received confirmation that it has been accepted by the order destination.                                                                                                                                |
| PendingCancel | indicates that you have sent a request to cancel the order but have not yet received cancel confirmation from the order destination. At this point, your order is not confirmed canceled. It is not guaranteed that the cancellation will be successful.                 |
| PreSubmitted  | indicates that a simulated order type has been accepted by the IB system and that this order has yet to be elected. The order is held in the IB system until the election criteria are met. At that time the order is transmitted to the order destination as specified. |
| Submitted     | indicates that your order has been accepted by the system.                                                                                                                                                                                                               |
| ApiCancelled  | after an order has been submitted and before it has been acknowledged, an API client client can request its cancelation, producing this state.                                                                                                                           |
| Cancelled     | indicates that the balance of your order has been confirmed canceled by the IB system. This could occur unexpectedly when IB or the destination has rejected your order.                                                                                                 |
| Filled        | indicates that the order has been completely filled. Market orders executions will not always trigger a Filled status.                                                                                                                                                   |
| Inactive      | indicates that the order was received by the system but is no longer active because it was rejected or canceled.                                                                                                                                                         |

### Requesting Currently Active Orders

As long as an order is active, it is possible to retrieve it using the TWS API. Orders submitted via the TWS API will always be bound to the client application (i.e. client Id) they were submitted from meaning only the submitting client will be able to modify the placed order. Three different methods are provided to allow for maximum flexibility. Active orders will be returned via the [IBApi.EWrapper.openOrder](/campus/ibkr-api-page/twsapi-api/#open-orders) and [IBApi.EWrapper.orderStatus](/campus/ibkr-api-page/twsapi-api/#order-status) methods as already described in [The openOrder callback](/campus/ibkr-api-page/trader-workstation-api/#open-orders) and [The orderStatus callback](/campus/ibkr-api-page/twsapi-doc/#order-status) sections

**Note:** it is not possible to obtain cancelled or fully filled orders.

### API client's orders

The IBApi.EClient.reqOpenOrders method allows to obtain all active orders submitted by the client application connected with the exact same client Id with which the order was sent to the TWS. If client 0 invokes reqOpenOrders, it will cause currently open orders placed from TWS manually to be ‘bound’, i.e. assigned an order ID so that they can be modified or cancelled by the API client 0.

When an order is bound by API client 0 there will be callback to IBApi::EWrapper::orderBound. This indicates the mapping between API order ID and permID. The [IBApi.EWrapper.orderBound](#order-bound-notification) callback in response to newly bound orders that indicates the mapping between the permID (unique account-wide) and API Order ID (specific to an API client). In the API settings in Global Configuration, is a setting checked by default “Use negative numbers to bind automatic orders” which will specify how manual TWS orders are assigned an API order ID.

Because binding the order will change the order ID, this function will be rejected when used with the API Read-Only Mode enabled. You can find the steps for disabling read-only mode at in [TWS Settings](/campus/ibkr-api-page/twsapi-doc/#tws-config-api).

#### EClient.reqOpenOrders ()

Requests all open orders places by this specific API client (identified by the API client id). For client ID 0, this will bind previous manual TWS orders.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
self.reqOpenOrders()
```

``` EnlighterJSRAW
client.reqOpenOrders();
```

``` EnlighterJSRAW
m_pClient->reqOpenOrders();
```

``` EnlighterJSRAW
client.reqOpenOrders();
```

``` EnlighterJSRAW
client.reqOpenOrders()
```

### All submitted orders

#### EClient.reqAllOpenOrders ()

Requests all current open orders in associated accounts at the current moment. The existing orders will be received via the [openOrder](#open-order) and [orderStatus](#order-status) events. Open orders are returned once; this function does not initiate a subscription.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
self.reqAllOpenOrders()
```

``` EnlighterJSRAW
client.reqAllOpenOrders();
```

``` EnlighterJSRAW
m_pClient->reqAllOpenOrders();
```

``` EnlighterJSRAW
client.reqAllOpenOrders();
```

``` EnlighterJSRAW
client.reqAllOpenOrders()
```

### Manually Submitted TWS Orders

#### EClient.reqAutoOpenOrders (

**autoBind:** bool. If set to true, the newly created orders will be assigned an API order ID and implicitly associated with this client. If set to false, future orders will not be.  
)

Requests status updates about future orders placed from TWS. Can only be used with client ID 0.

**Important:** only those applications connecting with client Id 0 will be able to take over manually submitted orders

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
self.reqAutoOpenOrders(True)
```

``` EnlighterJSRAW
client.reqAutoOpenOrders(true);
```

``` EnlighterJSRAW
m_pClient->reqAutoOpenOrders(true);
```

``` EnlighterJSRAW
client.reqAutoOpenOrders(true);
```

``` EnlighterJSRAW
client.reqAutoOpenOrders(True)
```

### Order Binding Notification

#### EWrapper.orderBound (

**orderId:** long. IBKR permId.

**apiClientId:** int. API client id.

**apiOrderId:** int. API order id.  
)

Response to API bind order control message.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
def orderBound(self, orderId: int, apiClientId: int, apiOrderId: int):
    print("OrderBound.", "OrderId:", intMaxString(orderId), "ApiClientId:", intMaxString(apiClientId), "ApiOrderId:", intMaxString(apiOrderId))
```

``` EnlighterJSRAW
@Override
public void orderBound(long orderId, int apiClientId, int apiOrderId) {
    System.out.println(EWrapperMsgGenerator.orderBound(orderId, apiClientId, apiOrderId));
}
```

``` EnlighterJSRAW
void TestCppClient::orderBound(long long orderId, int apiClientId, int apiOrderId) {
    printf("Order bound. OrderId: %s, ApiClientId: %s, ApiOrderId: %s\n", Utils::llongMaxString(orderId).c_str(), Utils::intMaxString(apiClientId).c_str(), Utils::intMaxString(apiOrderId).c_str());
}
```

``` EnlighterJSRAW
public void orderBound(long orderId, int apiClientId, int apiOrderId)
{
    Console.WriteLine("Order bound. Order Id: {0}, Api Client Id: {1}, Api Order Id: {2}", Util.LongMaxString(orderId), Util.IntMaxString(apiClientId), Util.IntMaxString(apiOrderId));
}
```

``` EnlighterJSRAW
Public Sub orderBound(orderId As Long, apiClientId As Integer, apiOrderId As Integer) Implements EWrapper.orderBound
    Console.WriteLine("Order bound. Order Id: {0}, Api Client Id: {1}, Api Order Id: {2}", Util.LongMaxString(orderId), Util.IntMaxString(apiClientId), Util.IntMaxString(apiOrderId))
End Sub
```

### Retrieving Completed Orders

EClient.reqCompletedOrders allows users to request all orders for the given day that are no longer modifiable. This will include orders have that executed, been rejected, or have been cancelled by the user. Clients may use these requests in order to retain a roster of those order submissions that are no longer traceable via reqOpenOrders.

### Requesting Completed Orders

### EClient.**reqCompletedOrders**(

**apiOnly: **bool. Determines if only API orders should be returned or if TWS submitted orders should be included.

)

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
self.reqCompletedOrders(True)
```

``` EnlighterJSRAW
client.reqCompletedOrders(True)
```

``` EnlighterJSRAW
m_pClient->reqCompletedOrders(true)
```

``` EnlighterJSRAW
client.reqCompletedOrders(true)
```

``` EnlighterJSRAW
client.reqCompletedOrders(True)
```

### Receiving Completed Orders

#### EWrapper.completedOrders(

**contract:** Contract. The order’s Contract.  
**order:** Order. The currently active Order.  
**orderState:** OrderState. The order’s OrderState  
)

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
def completedOrder(self, orderId: OrderId, contract: Contract, order: Order, orderState: OrderState):
    print(orderId, contract, order, orderState)
```

``` EnlighterJSRAW
@Override
public void completedOrder(int orderId, Contract contract, Order order, OrderState orderState) {
  System.out.println(EWrapperMsgGenerator.openOrder(orderId, contract, order, orderState));
}
```

``` EnlighterJSRAW
void TestCppClient::completedOrder( OrderId orderId, const Contract& contract, const Order& order, const OrderState& orderState) {
    printf(orderId, contract, order, orderState);
}
```

``` EnlighterJSRAW
public virtual void completedOrder(int orderId, Contract contract, Order order, OrderState orderState)
{
  Console.WriteLine(orderId, contract, order, orderState);
}
```

``` EnlighterJSRAW
Public Sub completedOrder(orderId As Integer, contract As IBApi.Contract, order As IBApi.Order, orderState As IBApi.OrderState) Implements IBApi.EWrapper.openOrder
  Console.WriteLine(orderId, contract, order , orderState)
End Sub
```

## Orders

### The Order Object

The order object is an essential piece of the TWS API which is used to both place and manage orders. This is primarily built with an ever increasing range of attributes used to create the best order possible. With that being said, the value to the right represents the required fields in order to place or reference any order. Keep in mind that there are several other attributes that can and should be referenced.

#### Order()

**action:** String. Determines whether the contract should be a BUY or SELL.

**auxPrice:** double. Used to determine the stop price for STP, STP LMT, and TRAIL orders.

**lmtPrice:** double. Used to determine the limit price for LMT, STP LMT, and TRAIL orders.

**orderType:** String. Specify the type of order to place. For example, MKT, LMT, STP.

**tif:** String. Time in force for the order. Default tif is DAY.

**totalQuantity:** decimal. Total size of the order.

Given additional structures for orders are ever evolving, it is recommended to review the relevant order class in your programming language for a comprehensive review of what fields are available.

[Order Class Reference](https://www.interactivebrokers.com/campus/ibkr-api-page/twsapi-ref/#order-ref)

### Cancelling an Order

An order can be cancelled from the API with the functions EClient.cancelOrder and EClient::reqGlobalCancel.

EClient.cancelOrder can only be used to cancel an order that was placed originally by a client with the same client ID (or from TWS for client ID 0).

EClient.reqGlobalCancel will cancel all open orders, regardless of how they were originally placed.

### Cancel Individual Order

#### EClient.cancelOrder (

**orderId:** int. Specify which order should be cancelled by its identifier.

**orderCancel:** orderCancel. An OrderCancel object that can receive the manualOrderCancelTime, manualOrderIndicator, and extOperator fields. See [OrderCancel Reference](/campus/ibkr-api-page/twsapi-ref/#ordercancel-ref) for more insight on the OrderCancel class.  
)

Cancels an active order placed by from the same API client ID.

**Note:** API clients cannot cancel individual orders placed by other clients. Only reqGlobalCancel is available.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
self.cancelOrder(orderId, OrderCancel())
```

``` EnlighterJSRAW
client.cancelOrder(cancelID, new OrderCancel());
```

``` EnlighterJSRAW
m_pClient->cancelOrder(m_orderId-1, OrderCancel());
```

``` EnlighterJSRAW
client.cancelOrder(nextOrderId - 1, OrderCancel());
```

``` EnlighterJSRAW
client.cancelOrder(nextOrderId - 1, OrderCancel)
```

### Cancel All Open Orders

#### EClient.reqGlobalCancel ()

This method will cancel ALL open orders including those placed directly from TWS.

**orderCancel:** orderCancel. An OrderCancel object that can receive the manualOrderCancelTime, manualOrderIndicator, and extOperator fields. See [OrderCancel Reference](/campus/ibkr-api-page/twsapi-ref/#ordercancel-ref) for more insight on the OrderCancel class.  
)

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
self.reqGlobalCancel(OrderCancel())
```

``` EnlighterJSRAW
client.reqGlobalCancel(new OrderCancel());
```

``` EnlighterJSRAW
m_pClient->reqGlobalCancel(OrderCancel());
```

``` EnlighterJSRAW
client.reqGlobalCancel(OrderCancel());
```

``` EnlighterJSRAW
client.reqGlobalCancel()
```

### Exercise Options

Options are exercised or lapsed from the API with the function EClient.exerciseOptions.

  - Option exercise will appear with order status side = “BUY” and limit price of 0, but only at the time the request is made
  - Option exercise can be distinguished by price = 0

#### EClient.exerciseOptions (

**tickerId:** int. Exercise request’s identifier

**contract:** Contract. the option Contract to be exercised.

**exerciseAction:** int. Set to 1 to exercise the option, set to 2 to let the option lapse.

**exerciseQuantity:** int. Number of contracts to be exercised

**account:** String. Destination account

**ovrd:** int. Specifies whether your setting will override the system’s natural action.  
Set to 1 to override, set to 0 not to.

For example, if your action is “exercise” and the option is not in-the-money, by natural action the option would not exercise. If you have override set to “yes” the natural action would be overridden and the out-of-the money option would be exercised.

**manualOrderTime:** String. Specify the time at which the options should be exercised. An empty string will assume the current time.  
Required TWS API 10.26 or higher.  
)

Exercises an options contract.

**Note:** this function is affected by a TWS setting which specifies if an exercise request must be finalized.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
self.exerciseOptions(5003, contract, 1, 1, self.account, 1, "")
```

``` EnlighterJSRAW
client.exerciseOptions(5003, contract, 1, 1, "", 1, "");
```

``` EnlighterJSRAW
m_pClient->exerciseOptions(5003, contract, 1, 1, "", 1, "");
```

``` EnlighterJSRAW
client.exerciseOptions(5003, contract, 1, 1, null, 1, null);
```

``` EnlighterJSRAW
client.exerciseOptions(5003, contract, 1, 1, Nothing, 1, Nothing)
```

### Minimum Price Increment

The minimum increment is the minimum difference between price levels at which a contract can trade. Some trades have constant price increments at all price levels. However some contracts have difference minimum increments on different exchanges on which they trade and/or different minimum increments at different price levels. In the contractDetails class, there is a field ‘minTick’ which specifies the smallest possible minimum increment encountered on any exchange or price. For complete information about minimum price increment structure, there is the IB Contracts and Securities search site, or the API function EClient.reqMarketRule.

The function [EClient.reqContractDetails](#request-contract-details) when used with a Contract object will return contractDetails object to the contractDetails function which has a list of the valid exchanges where the instrument trades. Also within the contractDetails object is a field called marketRuleIDs which has a list of “market rules”. A market rule is defined as a rule which defines the minimum price increment given the price. The market rule list returned in contractDetails has a list of market rules in the same order as the list of valid exchanges. In this way, the market rule ID for a contract on a particular exchange can be determined.

  - Market rule for forex and forex CFDs indicates default configuration (1/2 and not 1/10 pips). It can be adjusted to 1/10 pips through TWS or IB Gateway Global Configuration.
  - Some non-US securities, for instance on the SEHK exchange, have a minimum lot size. This information is not available from the API but can be obtained from the IB Contracts and Securities search page. It will also be indicated in the error message returned from an order which does not conform to the minimum lot size.

With the market rule ID number, the corresponding rule can be found with the API function EClient.reqMarketRule. The rule is returned to the function EWrapper.marketRule.

  - For forex, there is an option in TWS/IB Gateway configuration which allows trading in 1/10 pips instead of 1/5 pips (the default).
  - TWS Global Configuration -\> Display -\> Ticker Row -\> Allow Forex trading in 1/10 pips

### Request Market Rule

#### EClient.reqMarketRule (

**marketRuleId**: int. The id of market rule  
)

Requests details about a given market rule. The market rule for an instrument on a particular exchange provides details about how the minimum price increment changes with price.

A list of market rule ids can be obtained by invoking [EClient.reqContractDetails](https://www.interactivebrokers.com/campus/ibkr-api-page/trader-workstation-api/#contract-details) on a particular contract. The returned market rule ID list will provide the market rule ID for the instrument in the correspond valid exchange list in contractDetails.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
self.reqMarketRule(26)
```

``` EnlighterJSRAW
client.reqMarketRule(26);
```

``` EnlighterJSRAW
m_pClient->reqMarketRule(26);
```

``` EnlighterJSRAW
client.reqMarketRule(26);
```

``` EnlighterJSRAW
client.reqMarketRule(26)
```

### Receive Market Rule

#### EWrapper.marketRule (

**marketRuleId:** int. Market Rule ID requested.

**priceIncrements:** PriceIncrement\[\]. Returns the available price increments based on the market rule.  
)

Returns minimum price increment structure for a particular market rule ID market rule IDs for an instrument on valid exchanges can be obtained from the [contractDetails](https://www.interactivebrokers.com/campus/ibkr-api-page/trader-workstation-api/#contract-details) object for that contract

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
def marketRule(self, marketRuleId: int, priceIncrements: ListOfPriceIncrements):
    print("Market Rule ID: ", marketRuleId)
    for priceIncrement in priceIncrements:
    print("Price Increment.", priceIncrement)
```

``` EnlighterJSRAW
@Override
public void marketRule(int marketRuleId, PriceIncrement[] priceIncrements) {
    System.out.println(EWrapperMsgGenerator.marketRule(marketRuleId, priceIncrements));
}
```

``` EnlighterJSRAW
void TestCppClient::marketRule(int marketRuleId, const std::vector &priceIncrements) {
    printf("Market Rule Id: %s\n", Utils::intMaxString(marketRuleId).c_str());
    for (unsigned int i = 0; i < priceIncrements.size(); i++) {
        printf("Low Edge: %s, Increment: %s\n", Utils::doubleMaxString(priceIncrements[i].lowEdge).c_str(), Utils::doubleMaxString(priceIncrements[i].increment).c_str());
    }
}
```

``` EnlighterJSRAW
public void marketRule(int marketRuleId, PriceIncrement[] priceIncrements) 
{
    Console.WriteLine("Market Rule Id: " + marketRuleId);
    foreach (var priceIncrement in priceIncrements) 
    {
        Console.WriteLine("Low Edge: {0}, Increment: {1}", Util.DoubleMaxString(priceIncrement.LowEdge), Util.DoubleMaxString(priceIncrement.Increment));
    }
}
```

``` EnlighterJSRAW
Public Sub marketRule(marketRuleId As Integer, priceIncrements As PriceIncrement()) Implements EWrapper.marketRule
    Console.WriteLine("Market Rule Id:" & marketRuleId)
    For Each priceIncrement In priceIncrements
        Console.WriteLine("LowEdge: " & Util.DoubleMaxString(priceIncrement.LowEdge) & " Increment: " & Util.DoubleMaxString(priceIncrement.Increment))
    Next
End Sub
```

### MiFIR Transaction Reporting Fields

For EEA investment firms required to comply with MiFIR reporting, and who have opted in to Enriched and Delegated Transaction Reporting, we have added four new order attributes to the Order class, and several new presets to TWS and IB Gateway Global Configuration.

New order attributes include:

  - **IBApi.Order.Mifid2DecisionMaker** – Used to send “investment decision within the firm” value (if IBApi.Order.Mifid2DecisionAlgo is not used).
  - **IBApi.Order.Mifid2DecisionAlgo** – Used to send “investment decision within the firm” value (if IBApi.Order.Mifid2DecisionMaker is not used).
  - **IBApi.Order.Mifid2ExecutionTrader** – Used to send “execution within the firm” value (if IBApi.Order.Mifid2ExecutionAlgo is not used).
  - **IBApi.Order.Mifid2ExecutionAlgo** – Used to send “execution within the firm” value (if IBApi.Order.Mifid2ExecutionTrader is not used).

New TWS and IB Gateway Order Presets can be found in the Orders \> MiFIR page of Global Configuration, and include TWS Decision-Maker Defaults, API Decision-Maker Defaults, and Executing Trader/Algo presets.

The following choices are available for the “investment decision within the firm” IBApi.Order.Mifid2DecisionMaker and IBApi.Order.Mifid2DecisionAlgo attributes:

1.  This field does not need to be reported if you are:
    
      - Using the TWS API to transmit orders, AND
      - The investment decision is always made by the client, AND
      - None of these clients are an EEA investment firm with delegated reporting selected (the “delegated reporting firm”).
    
    You can configure the preset to indicate this via TWS Global Configuration using the Orders \> MiFIR page. In this scenario, the orders for the proprietary account will need to be placed via TWS.

2.  If you are using the TWS API to transmit orders, and the investment decision is made by a person, or a group of people within a delegated reporting firm, with one person being the primary decision maker:
    
      - Your TWS API program can, on each order, transmit a decision maker’s IB-assigned short code using the field IBApi.Order.Mifid2DecisionMaker. You can define persons who can be the decision-makers via IB Account Management. To obtain the short codes that IB assigned to those persons, please contact IB Client Services.
      - If your TWS API program is unable to transmit the above field, and the investment decision is either made by, or approved by, a single person who can be deemed to be the primary investment decision maker, you can pre-configure a default investment decision-maker that will be used for orders where the above fields are not present. You must define the investment decision-maker(s) in IB Account Management, and can then configure the default investment decision-maker in TWS Global Configuration using the Orders \> MiFIR page.

3.  If you are using the TWS API to transmit orders and the investment decision is made by an algorithm:
    
      - Your TWS API program can, on each order, transmit a decision maker’s IB-assigned short code using the field IBApi.Order.Mifid2DecisionAlgo. You can define algorithms that can be the decision-makers via IB Account Management. To obtain the short codes that IB assigned to those persons, please contact IB Client Services.
    
      - If your TWS API program is unable to transmit the above field, and/or the investment decision is made by a single or primary decision-maker algorithm, you can pre-configure a default investment decision-maker algo that will be used for orders where the above field is not sent. You must define the investment decision-maker(s) in IB Account Management, and can then configure the default investment decision-maker in TWS Global Configuration using the Orders \> MiFIR page.
        
        *NOTE: Only ONE investment decision-maker, either a primary person or algorithm, should be provided on an order, or selected as the default.*

The following choices are available for “execution within the firm” IBApi.Order.Mifid2ExecutionTrader and IBApi.Order.Mifid2ExecutionAlgo attributes:

1.  No additional information is needed if you are using the TWS API to transmit orders entered in a third-party trading interface, and you are the trader responsible for execution within the firm.
2.  If your TWS API program transmits orders to IB automatically without human intervention, please contact **IB Client Services** to register the program or programs with IB as an algo. Only the primary program or algo needs to be registered and identified. You can then configure the default in TWS Global Configuration using the Orders \> MiFIR page.
3.  Your TWS API program, on each order, can transmit the IB-assigned short code of the algo or person responsible for execution within the firm using the field IBApi.Order.Mifid2ExecutionAlgo (for the algorithm) or IBApi.Order.Mifid2ExecutionTrader (for the person).

For more information, or to obtain short codes for persons or algos defined in IB Account Management, please contact IB Client Services.

To find out more about the MiFIR transaction reporting obligations, see the [MiFIR Enriched and Delegated Transaction Reporting for EEA Investment Firms](https://ibkr.info/node/2975) knowledge base article.

### Modifying Orders

Modification of an API order can be done if the API client is connected to a session of TWS with the same username of TWS and using the same API client ID. The function [EClient.placeOrder](#place-order) can then be called with the same fields as the open order, except for the parameter to modify. This includes the Order.OrderId, which must match the Order.OrderId of the **open** order. It is not generally recommended to try to change order fields aside from order price, size, and tif (for DAY -\> IOC modifications). To change other parameters, it might be preferable to instead cancel the open order, and create a new one.

  - To modify or cancel an individual order placed manually from TWS, it is necessary to connect with client ID 0 and then bind the order before attempting to modify it. The process of binding assigns the order an API order ID; prior to binding it will be returned to the API with an **API order ID of 0**. Orders with API order ID 0 cannot be modified/cancelled from the API. The function reqOpenOrders binds orders open at that moment which do not already have an API order ID, and the function reqAutoOpenOrders binds future orders automatically. The function reqAllOpenOrders does not bind orders.
  - To modify API orders when connecting to a different session of TWS (logged in with a different username than used for the original order), it is necessary to first bind the order with client ID 0 in the same manner as manual TWS orders are bound before they can be modified. The binding assignment of API order IDs is independent for each TWS user, so the same order can have different API order IDs for different users. The permID returned in the API Order class which is assigned by TWS can be used to identify an order in an account uniquely.
  - The process of order binding from the API cancels/resubmits an order working on an exchange. This may affect the order’s place in the exchange queue. Enhancements are planned to allow for API binding with modification of exchange queue priority.

### Place Order

Orders are submitted via the EClient.placeOrder method.

Immediately after an order is submitted correctly, the TWS will start sending events concerning the order’s activity via [EWrapper.openOrder](https://www.interactivebrokers.com/campus/ibkr-api-page/twsapi-doc/#open-order) and [EWrapper.orderStatus](https://www.interactivebrokers.com/campus/ibkr-api-page/twsapi-doc/#order-status)

Advisors executing allocation orders will receive execution details and commissions for the allocation order itself. To receive allocation details and commissions for a specific subaccount [EClient.reqExecutions](https://www.interactivebrokers.com/campus/ibkr-api-page/twsapi-doc/#request-exec-details) can be used.

An order can be sent to TWS but not transmitted to the IB server by setting the Order.Transmit flag in the order class to False. Untransmitted orders will only be available within that TWS session (not for other usernames) and will be cleared on restart. Also, they can be cancelled or transmitted from the API but not viewed while they remain in the “untransmitted” state.

#### EClient.placeOrder (

**id:** int. The order’s unique identifier. If a new order is placed with an order ID less than or equal to the order ID of a previous order an error will occur.

**contract:** Contract. The order’s contract

**order:** Order. The order object.  
)

Places or modifies an order.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
self.placeOrder(orderId, contract, order)
```

``` EnlighterJSRAW
client.placeOrder(nextOrderId++, contract, order);
```

``` EnlighterJSRAW
m_pClient->placeOrder(m_orderId++, 
 contract, order);
```

``` EnlighterJSRAW
client.placeOrder(orderId, contract, order);
```

``` EnlighterJSRAW
client.placeOrder(orderId, contract, order)
```

### Trading The Overnight Session

In the event a user would like to designate a trade to take place during the Overnight trading hours, the [Order object](/campus/ibkr-api-page/twsapi-ref/#order-ref) must set “includeOvernight” set to True and optionally set the Exchange value to OVERNIGHT.

#### Routing exclusively to the Overnight market

Users that would like to route orders to [Overnight](/en/trading/ordertypes.php?m=overnightTradingModal) without trading during the regular session must set the [Order Object’s](/campus/ibkr-api-page/twsapi-ref/#order-ref) includeOvernight value as True and designate the exchange value as “OVERNIGHT”.

``` EnlighterJSRAW
order = Order()
order.exchange = "OVERNIGHT"
order.includeOvernight = True
```

#### Routing as Overnight+DAY

Users that would like to route orders to [Overnight+DAY](/en/trading/ordertypes.php?m=overnightSmartModal) to trade during the day and the overnight session must set the [Order Object’s](/campus/ibkr-api-page/twsapi-ref/#order-ref) includeOvernight value as True and designate the exchange value as “SMART”.

``` EnlighterJSRAW
order = Order()
order.exchange = "SMART"
order.includeOvernight = True
```

### Understanding Order Precautions

By default, the Trader Workstation implements several precautionary settings that will notify customers of potential order risks to make sure users are well informed before transmitting orders. As a result, customers will typically need to acknowledge a precautionary message and manually transmit the orders through the Trader Workstation. These precautionary messages may be disabled if the user is comfortable and aware of the behavior they are disabling.  
 

### Disabling Warning Messages

1.  Log in to the Trader Workstation
2.  Open the Global Configuration by selecting the Cog Wheel icon in the top right corner
3.  Navigate to the “Messages” section on the left.
4.  **Carefully read each message before disabling it**. You can then disable the warning by unchecking the box on the right of the message description.

### Modifying Precautionary Settings

1.  Log in to the Trader Workstation
2.  Open the Global Configuration by selecting the Cog Wheel icon in the top right corner
3.  Navigate to the “Presets” section on the left
4.  Select the instrument(s) you are trading
5.  **Carefully read each setting before making changes to it. **You may modify the values inside the “Precautionary Settings” settings to be more or less restrictive. You may also set the value to ‘0’ to disable the precaution entirely.

### Order Placement Considerations

When placing orders via the API and building a robust trading system, it is important to monitor for callback notifications, specifically for **[IBApi::EWrapper::error](https://www.interactivebrokers.com/campus/ibkr-api-page/twsapi-doc/#error)**, [**IBApi:**:**EWrapper::orderStatus** ](https://www.interactivebrokers.com/campus/ibkr-api-page/twsapi-doc/#order-status)changes, [**IBApi::EWrapper::openOrder** ](https://www.interactivebrokers.com/campus/ibkr-api-page/twsapi-doc/#open-orders)warnings, and **[IBApi::EWrapper::execDetails](https://www.interactivebrokers.com/campus/ibkr-api-page/twsapi-doc/#receive-exec-details)** to ensure proper operation.

If you experience issues with orders you place via the API, such as orders not filling, the first thing to check is what these callbacks returned. Your order may have been rejected or cancelled. If needed, see the **[API Log ](https://www.interactivebrokers.com/campus/ibkr-api-page/twsapi-doc/#log-location)**section, for information on obtaining your API logs or submitting them for review.

<span class="underline">Common cases of order rejections, cancellations, and warnings, and the corresponding message returned:</span>

  - If an order is subject to a large size (LGSZ) reject, the API client would receive **Error (201)** via **[IBApi::EWrapper::error](https://www.interactivebrokers.com/campus/ibkr-api-page/twsapi-doc/#error)**. The error text would indicate that order size too large and suggest another smaller size.
      - In accordance with our regulatory obligations as a broker, we cannot accept Large Limit Orders for \#\#\#\# shares of ABCD that you have submitted. Please submit a smaller order (not exceeding \#\#\#) *or convert your order to an algorithmic Order (IBALGO) \[conditional on instrument\]*

<!-- end list -->

  - If an order is subject to price checks the client may receive status (cancelled) + **Error (202)** via [**IBApi.EWrapper.orderStatus**](https://www.interactivebrokers.com/campus/ibkr-api-page/twsapi-doc/#order-status) and **[IBApi::EWrapper::error](https://www.interactivebrokers.com/campus/ibkr-api-page/twsapi-doc/#error)**. The error text would indicate the price is too far from current price.
      - In accordance with our regulatory obligations as a broker, we cannot accept your order at the limit price \#\#\# you selected because it is too far through the market. Please submit your order using a limit price that is closer to the current market price \#\#\#

<!-- end list -->

  - The client may receive warning Text via **[IBApi::EWrapper::openOrder](https://www.interactivebrokers.com/campus/ibkr-api-page/twsapi-doc/#open-orders)** indicating that the order could be subject to price capping.
      - If your order does not immediately execute, in accordance with our regulatory obligations as a broker we may, depending on market conditions, reject your order if the limit price of your order is more than allowed distance from the current reference price. This is designed to ensure that the price of your order is in line with an orderly market and reduce the impact your order has on the market. Please note that such rejection will result in you not receiving a fill.
      - ***[mktCapPrice](https://www.interactivebrokers.com/campus/ibkr-api-page/twsapi-doc/#order-status)*** – If an order has been capped, this indicates the current capped price (returned to[** IBApi.EWrapper.orderStatus**](https://www.interactivebrokers.com/campus/ibkr-api-page/twsapi-doc/#open-orders))

### Pre-Borrow Shares For Shorting

The TWS API supports the ability to pre-borrow shares for shorting.

  - See [here](About%20Pre-Borrows) for Pre-Borrow Eligibility
  - See [here](https://www.interactivebrokers.com/en/pricing/other-fees.php#:~:text=Stock%20Loan-,Pre%2DBorrows,-Universal) for pricing details

To place a Pre-Borrow order, users must:

  - Assign the contract’s exchange to “PREBORROW”
  - Assign the contract’s security type to “SBL”
  - Assign the order’s orderType to “MKT”

<!-- end list -->

  - Python
  - Java
  - C++
  - C\#

<!-- end list -->

``` EnlighterJSRAW
contract = Contract()
contract.symbol = symbol
contract.secType = "SBL"
contract.exchange = "PREBORROW"
contract.currency = "USD"

order = Order()
order.action = "BUY"
order.orderType = "MKT"
order.totalQuantity = quantity
```

``` EnlighterJSRAW
Contract contract = new Contract();
contract.symbol(symbol);
contract.secType("SBL");
contract.currency("USD");
contract.exchange("PREBORROW");

Order order = new Order();
order.orderType("MKT");
order.totalQuantity(quantity);
```

``` EnlighterJSRAW
Contract contract;
contract.symbol = symbol;
contract.secType = "SBL";
contract.currency = "USD";
contract.exchange = "PREBORROW";

Order order;
order.orderType = "MKT";
order.totalQuantity = quantity;
```

``` EnlighterJSRAW
Contract contract = new Contract();
contract.Symbol = symbol;
contract.SecType = "SBL";
contract.Currency = "USD";
contract.Exchange = "PREBORROW";

Order order = new Order();
order.Action = action;
order.OrderType = "MKT";
order.TotalQuantity = quantity;
```

### Test Order Impact (WhatIf)

From the API it is possible to check how a specified trade execution is expected to change the account margin requirements for an account in real time. This is done by creating an Order object which has the IBApi.Order.WhatIf flag set to true. By default, the whatif boolean in Order has a false value, but if set to True in an Order object with is passed to [IBApi.EClient.placeOrder](https://www.interactivebrokers.com/campus/ibkr-api-page/trader-workstation-api/#place-order), instead of sending the order to a destination the IB server it will undergo a credit check for the expected post-trade margin requirement. The estimated post-trade margin requirement is returned to the IBApi.OrderState object in the [EWrapper.openOrder](https://www.interactivebrokers.com/campus/ibkr-api-page/trader-workstation-api/#open-orders) callback..

This is equivalent to creating a order ticket in TWS, clicking “Preview”, and viewing the information in the “Margin Impact” panel.

For example, most users want to check the margin details or available leverage of the order. Here is the example of checking the Initial Maintenance Margin Change.

Python:

``` EnlighterJSRAW
def openOrder(self, orderId: OrderId, contract: Contract, order: Order, orderState: OrderState):
    print(orderId, contract, order, orderState.initMarginChange) 

.
.
.
order.whatIf = True
.
.
.
self.placeOrder(order_id, contract, order)
```

Expected output:

``` EnlighterJSRAW
210 152791428,700,STK,,0,?,,SEHK,,HKD,700,700,False,,,,combo: 210,1,1832692965: MKT BUY 100@0 DAY 12567.5
```

You can see that 12567.5 is the initMarginChange which matches the Initial Margin Change result shown in TWS Order Ticket Preview.

Apart from InitMarginChange, there are other supported variables. For details, please visit: <https://www.interactivebrokers.com/campus/ibkr-api-page/twsapi-ref/#orderstate-ref>

Note:

It is not recommended for users to submit lots of what-if orders. When a user submits a what-if order for margin preview only, the request is sent to IB credit system for review. In some cases, if user(s) submit lots of what-if orders, the creditman is affected. There is no clear limitation about this what-if feature. However, if you want to use this what-if feature, please:

  - keep the ratio: 10 order submissions: 1 what-if request
  - do not overuse the what-if request (\> 1 what-if request per minute)
  - cancel the what-if order after margin review

### Trigger Methods

The Trigger Method defined in the [IBApi.Order](https://www.interactivebrokers.com/campus/ibkr-api-page/trader-workstation-api/#order-object) class specifies how simulated stop, stop-limit, and trailling stops, and conditional orders are triggered. Valid values are:

  - 0 – The default method for instrument
  - 1 – “Double bid/ask” function, where stop orders are triggered based on two consecutive bid or ask prices.
  - 2 – “Last” function, where stop orders are triggered based on the last price
  - 3 – “Double last” function
  - 4 – Bid/ask function
  - 7 – Last or bid/ask function
  - 8 – Mid-point function

Below is a table which indicates whether a given secType is compatible with bid/ask-driven or last-driven trigger methods (method 7 only used in iBot alerts)

| secType     | Bid/Ask-driven (1, 4, 8) | Last-driven (2, 3) | Default behavior                    | Notes                                     |
| ----------- | ------------------------ | ------------------ | ----------------------------------- | ----------------------------------------- |
| STK         | yes                      | yes                | Last                                | The double bid/ask is used for OTC stocks |
| CFD         | yes                      | yes                | Last                                |                                           |
| CFD – Index | yes                      | n/a                | n/a                                 | Ex IBUS500                                |
| OPT         | yes                      | yes                | US OPT: Double bid/ask, Other: Last |                                           |
| FOP         | yes                      | yes                | Last                                |                                           |
| WAR         | yes                      | yes                | Last                                |                                           |
| IOPT        | yes                      | yes                | Last                                |                                           |
| FUT         | yes                      | yes                | Last                                |                                           |
| COMBO       | yes                      | yes                | Last                                |                                           |
| CASH        | yes                      | n/a                | Bid/ask                             |                                           |
| CMDTY       | yes                      | n/a                | Last                                |                                           |
| IND         | n/a                      | yes                | n/a                                 | For conditions only                       |

**Important notes** :

  - If an incompatible triggerMethod and secType are used in your API order, the order may never trigger.
  - These trigger methods only apply to stop orders simulated by IB. If a stop-variant is handled natively, the trigger method specified is ignored. See our [Stop Orders](https://www.interactivebrokers.com/en/index.php?f=609) page for more information.

## TWS UI Display Groups

Display Groups function allows API clients to integrate with [TWS Color Grouping Windows](https://www.ibkrguides.com/tws/usersguidebook/specializedorderentry/use_windows_grouping_to_link_blotter.htm).

TWS Color Grouping Windows are identified by a colored chain in TWS and by an integer number via the API. Currently that number ranges from 1 to 7 and are mapped to specific colors, as indicated in TWS.

### Query Display Groups

The IBApi.EClient.queryDisplayGroups method is used to request all available Display Groups in TWS. The IBApi.EWrapper.displayGroupList is a one-time response to IBApi.EClient.queryDisplayGroups.

It returns a list of integers representing visible Group ID separated by the “|” character, and sorted by most used group first. This list will not change during TWS session. In other words, user cannot add a new group, but only the sorting of the group numbers can change.

Example: “4|1|2|5|3|6|7”

### Request Query Display Groups

#### EClient.queryDisplayGroups (

**requestId:** int. Request identifier used to track data.  
)

Requests all available Display Groups in TWS.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
self.queryDisplayGroups(requestId)
```

``` EnlighterJSRAW
client.queryDisplayGroups(requestId);
```

``` EnlighterJSRAW
m_pClient->queryDisplayGroups(requestId);
```

``` EnlighterJSRAW
client.queryDisplayGroups(requestId);
```

``` EnlighterJSRAW
client.queryDisplayGroups(requestId)
```

### Receive Query Display Groups

#### EWrapper.displayGroupList (

**requestId:** Request identifier used to track data.

**groups:** String. Returns a list of integers representing visible Group ID separated by the “|” character, and sorted by most used group first.  
)

A one-time response to querying the display groups.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
def displayGroupList(self, reqId: int, groups: str):
  print("DisplayGroupList. ReqId:", reqId, "Groups", groups)
```

``` EnlighterJSRAW
@Override
public void displayGroupList(int reqId, String groups) {
  System.out.println("Display Group List. ReqId: " + reqId + ", Groups: " + groups + "\n");
}
```

``` EnlighterJSRAW
void TestCppClient::displayGroupList( int reqId, const std::string& groups) {
  printf("Display Group List. ReqId: %d, Groups: %s\n", reqId, groups.c_str());
}
```

``` EnlighterJSRAW
public virtual void displayGroupList(int reqId, string groups)
{
  Console.WriteLine("DisplayGroupList. Request: " + reqId + ", Groups" + groups);
}
```

``` EnlighterJSRAW
Public Sub displayGroupList(reqId As Integer, groups As String) Implements IBApi.EWrapper.displayGroupList
  Console.WriteLine("DisplayGroupList - ReqId [" & reqId & "] Groups [" & groups & "]")
End Sub
```

### Subscribe To Group Events

To integrate with a specific Group, you need to first subscribe to the group number by invoking IBApi.EClient.subscribeToGroupEvents. The IBApi.EWrapper.displayGroupUpdated call back is triggered once after receiving the subscription request, and will be sent again if the selected contract in the subscribed display group has changed.

### Request Group Events Subscription

#### EClient.subscribeToGroupEvents (

**requestId:** int. Request identifier used to track data.

**groupId:** int. The display group for integration.  
)

Integrates API client and TWS window grouping.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
self.subscribeToGroupEvents(19002, 1)
```

``` EnlighterJSRAW
client.subscribeToGroupEvents(9002, 1);
```

``` EnlighterJSRAW
m_pClient->subscribeToGroupEvents(9002, 1);
```

``` EnlighterJSRAW
client.subscribeToGroupEvents(9002, 1);
```

``` EnlighterJSRAW
client.subscribeToGroupEvents(9002, 1)
```

### Receive Group Events Subscription

#### EWrapper.displayGroupUpdated (

**requestId:** int. Request identifier used to track data.

**contractInfo:** String. Contract information produced for the active display group.

)  
Call triggered once after receiving the subscription request, and will be sent again if the selected contract in the subscribed \* display group has changed.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
def displayGroupUpdated(self, reqId: int, contractInfo: str):
    print("DisplayGroupUpdated. ReqId:", reqId, "ContractInfo:", contractInfo)
```

``` EnlighterJSRAW
@Override
public void displayGroupUpdated(int reqId, String contractInfo) {
    System.out.println("Display Group Updated. ReqId: " + reqId + ", Contract info: " + contractInfo + "\n");
}
```

``` EnlighterJSRAW
void TestCppClient::displayGroupUpdated( int reqId, const std::string& contractInfo) {
    std::cout << "Display Group Updated. ReqId: " << reqId << ", Contract Info: " << contractInfo << std::endl;
}
```

``` EnlighterJSRAW
public virtual void displayGroupUpdated(int reqId, string contractInfo)
{
    Console.WriteLine("displayGroupUpdated. Request: " + reqId + ", ContractInfo: " + contractInfo);
}
```

``` EnlighterJSRAW
Public Sub displayGroupUpdated(reqId As Integer, contractInfo As String) Implements IBApi.EWrapper.displayGroupUpdated
    Console.WriteLine("DisplayGroupUpdated - ReqId [" & reqId & "] ContractInfo [" & contractInfo & "]")
End Sub
```

### Unsubscribe From Group Events

#### EClient.unsubscribeFromGroupEvents (

**requestId:** int. Request identifier used to track data.  
)

Cancels a TWS Window Group subscription.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
self.unsubscribeFromGroupEvents(19002)
```

``` EnlighterJSRAW
client.unsubscribeFromGroupEvents(9002);
```

``` EnlighterJSRAW
m_pClient->unsubscribeFromGroupEvents(9002);
```

``` EnlighterJSRAW
client.unsubscribeFromGroupEvents(9002);
```

``` EnlighterJSRAW
client.unsubscribeFromGroupEvents(9002)
```

### Update Display Group

#### EClient.updateDisplayGroup (

**requestId:** int. Request identifier used for tracking data.

**contractInfo:** String. An encoded value designating a unique IB contract. Possible values include:

  - none: Empty selection
  - contractID: Any non-combination contract. Examples 8314 for IBM SMART; 8314 for IBM ARCA
  - combo: If any combo is selected Note: This request from the API does not get a TWS response unless an error occurs.  
    )

Updates the contract displayed in a TWS Window Group.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
self.updateDisplayGroup(19002, "8314@SMART")
```

``` EnlighterJSRAW
client.updateDisplayGroup(9002, "8314@SMART");
```

``` EnlighterJSRAW
m_pClient->updateDisplayGroup(9002, "8314@SMART");
```

``` EnlighterJSRAW
client.updateDisplayGroup(9002, "8314@SMART");
```

``` EnlighterJSRAW
client.updateDisplayGroup(9002, "8314@SMART")
```

**Note:** This request from the API does not get a response from TWS unless an error occurs.

In this sample we have commanded TWS Windows that chained with Group \#1 to display IBM@SMART. The screenshot of TWS Mosaic to the right shows that both the pink chained (Group \#1) windows are now displaying IBM@SMART, while the green chained (Group \#4) window remains unchanged.

## Wall Street Horizon

Calendar and Event data can be retrieved from the Wall Street Horizon Event Calendar and accessed via the TWS API through the functions IBApi.EClient.reqWshMetaData and IBApi.EClient.reqWshEventData.

It is necessary to have the **Wall Street Horizon Corporate Event Data** research subscription activated first in [Account Management](https://www.ibkrguides.com/clientportal/usersettings/marketdatasubscriptions.htm).

WSH provides IBKR with corporate event datasets, including earnings dates, dividend dates, options expiration dates, splits, spinoffs and a wide variety of investor-related conferences.

[Data Classes and Fields PDF](https://www.interactivebrokers.com/campus/wp-content/uploads/sites/2/2023/09/WSHEclassesandfieldsforIBAPI2022-12-23.pdf)

### Meta Data

The function IBApi.EClient.reqWshMetaData is used to request available event types, or supported filter values, that may be used in the call for [EClient.reqWshEventData()](https://www.interactivebrokers.com/campus/ibkr-api-page/twsapi-doc/#event-data) filter field.

Regardless of whether or not you are aware of the Meta Data filters, this request must **always** be called once per session prior to the [EClient.reqWshEventData()](https://www.interactivebrokers.com/campus/ibkr-api-page/twsapi-doc/#event-data) function.

### Meta Data Filters

While this list contains an array of Meta Data filters that may be used, please be aware that new values may be made available or removed without notice.

In addition to the EClient.reqWshMetaData field being mandatory prior to the [EClient.reqWshEventData()](https://www.interactivebrokers.com/campus/ibkr-api-page/twsapi-doc/#event-data) function, the JSON content will also return the appropriate column values that are returned along with the function.

| Event Type Name                | Event Type Tag       |
| ------------------------------ | -------------------- |
| Board of Directors Meeting     | wshe\_bod            |
| Buyback                        | wshe\_bybk           |
| BuyBack Modification           | wshe\_bybkmod        |
| Conference Call                | wshe\_cc             |
| FDA Advisory Committee Meeting | wshe\_fda\_adv\_comm |
| Future Quarter                 | wshe\_fq             |
| Investors Conference           | wshe\_ic             |
| Index Change                   | wshe\_idx            |
| Interim Dates                  | wshe\_interim\_dates |
| Initial Public Offering        | wshe\_ipo            |
| Movie Release                  | wshe\_movies         |
| Option Expiration Date         | wshe\_option         |
| Merger and Acquistion          | wshe\_merg\_acq      |
| Quarter End                    | wshe\_qe             |
| Secondary Offering             | wshe\_secondary      |
| Video Release                  | wshe\_videos         |
| Splits                         | wshe\_splits         |
| Spinoff                        | wshe\_spinoffs       |
| Shareholder Meeting            | wshe\_sh             |
| Filing Due Date                | wshe\_sec            |
| WSHE Dividend                  | wshe\_div            |
| Dividends Suspend/Resume       | wshe\_divsr          |
| Earnings Date                  | wshe\_ed             |
| Earnings Report                | wshe\_eps            |

### Requesting Meta Data

#### EClient.reqWshMetaData (

**requestId:** int. Request identifier used to track data.  
)

Requests metadata from the WSH calendar.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
self.reqWshMetaData(1100)
```

``` EnlighterJSRAW
client.reqWshMetaData(1100);
```

``` EnlighterJSRAW
m_pClient->reqWshMetaData(30001);
```

``` EnlighterJSRAW
client.reqWshMetaData(1100);
```

``` EnlighterJSRAW
client.reqWshMetaData(1100)
```

### Receive Meta Data

#### EWrapper.wshEventData (

**requestId:** int. Request identifier used to track data.

**dataJson:** String. metadata in json format.  
)

Returns meta data from the WSH calendar

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
def wshMetaData(self, reqId: int, dataJson: str):
    print("WshMetaData.", "ReqId:", reqId, "Data JSON:", dataJson)
```

``` EnlighterJSRAW
@Override
public void wshMetaData(int reqId, String dataJson) {
    System.out.println(EWrapperMsgGenerator.wshMetaData(reqId, dataJson));
}
```

``` EnlighterJSRAW
void TestCppClient::wshMetaData(int reqId, const std::string& dataJson) {
    printf("WSH Meta Data. ReqId: %d, dataJson: %s\n", reqId, dataJson.c_str());
}
```

``` EnlighterJSRAW
public void wshMetaData(int reqId, string dataJson)
{
    Console.WriteLine($"WSH Meta Data. Request Id: {reqId}, Data JSON: {dataJson}\n");
}
```

``` EnlighterJSRAW
Public Sub wshMetaData(reqId As Integer, dataJson As String) Implements EWrapper.wshMetaData
    Console.WriteLine($"WSH Meta Data. Request Id: {reqId}, Data JSON: {dataJson}")
End Sub
```

Once the json content has been received, the specific event types used to filter [EClient.reqWshEventData()](https://www.interactivebrokers.com/campus/ibkr-api-page/twsapi-doc/#event-data) are listed under “meta\_data” -\> “event\_types”.

The “name” field will express what the filter will return, such as “Board of Directors Meeting”

The “tag” field will return the filter used in your JSON query. The related example would be “wshe\_bod”.

### Cancel Meta Data

#### EClient.cancelWshMetaData (

**requestId:** int. Request identifier used to track data.  
)

Cancels pending request for WSH metadata.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
self.cancelWshMetaData(1100)
```

``` EnlighterJSRAW
client.cancelWshMetaData(1100);
```

``` EnlighterJSRAW
m_pClient->cancelWshMetaData(30001);
```

``` EnlighterJSRAW
client.cancelWshMetaData(1100);
```

``` EnlighterJSRAW
client.cancelWshMetaData(1100)
```

### Event Data

The function EClient.reqWshEventData is used to request various calendar events from Wall Street Horizon. The event data is then received via the callback EWrapper.wshEventData. Pending event data requests can be canceled with the function IBApi.EClient.cancelWshEventData.

**Note:** Prior to sending this message, the API client must make a request for metadata via [EClient.reqWshMetaData](#meta-data).

Also note that TWS will not support multiple concurrent requests. Previous request should succeed, fail, or be cancelled by client before next one. TWS will reject such requests with text “Duplicate WSH meta-data request” or “Duplicate WSH event request”.

### WshEventData Object

When making a request to the Wall Street Horizons Event Calendar with the API, users must create a wshEventData Object. This object contains several fields, along with a filter field, which takes a json-formatted string. The filter values are returned from WSH Meta Data requests.

When creating the object, users are able to specify either the WshEventData.conId, WshEventData.startDate, and WshEventData.endDate, or they may choose to use the WshEventData.filter value. Attempting to use both will result in an error. 

Only one Event Type tag may be passed per request. Multiple submitted filters will be ignored beyond the final request.

#### WshEventData()

**conId:** String. Specify the contract identifier for the event request.

**startDate:** String. Specify the start date of the event requests. Formatted as “YYYYMMDD”

**endDate:** String. Specify the end date of the event requests. Formatted as “YYYYMMDD”

**fillCompetitors:** bool. Automatically fill in competitor values of existing positions.

**fillPortfolio:** bool. Automatically fill in portfolio values.

**fillWatchlist:** bool. Automatically fill in watchlist values.

**totalLimit:** int. Maximum of 100.

**filter:** String. Json-formatted string containing all filter values. Some available values include:

  - watchlist: Array of string. Takes a single conid.
  - country: String. Specify a country code, or “All”.
  - [EClient.reqWshMetaData()](https://www.interactivebrokers.com/campus/ibkr-api-page/twsapi-doc/#meta-data) responses will include an Event Type tag which can be used to filter the Event Data’s response. The Json field is a boolean that can only take true to filter the given value

### Request Event Data

#### EClient.reqWshEventData (

**requestId:** int. Request identifier used to track data.

**wshEventData:** WshEventData. Unique object used to track all parameters for the event data request. See [WshEventData Object](#wsheventdata-object) for more details.  
)

**MIN\_SERVER\_VER\_WSH\_EVENT\_DATA\_FILTERS\_DATE:** \*Only passed in the Python implementation. Server version of the API implementationmust be passed. This can be accomplished with the EClient.serverVersion() function call.

Requests event data from the WSH calendar.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
self.reqWshEventData(1101, eventDataObj, serverVersion)
```

``` EnlighterJSRAW
client.reqWshEventData(1101, eventDataObj, serverVersion);
```

``` EnlighterJSRAW
 m_pClient->reqWshEventData(30002, eventDataObj, serverVersion);
```

``` EnlighterJSRAW
client.reqWshEventData(1101, eventDataObj, serverVersion);
```

``` EnlighterJSRAW
client.reqWshEventData(1101, eventDataobj, serverVersion)
```

### Receive Event Data

#### EWrapper.wshEventData (

**requestId:** int. Request identifier used to track data.

**dataJson:** String. Event data json format.  
)

Returns calendar events from the WSH.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
def wshEventData(self, reqId: int, dataJson: str):
    print("WshEventData.", "ReqId:", reqId, "Data JSON:", dataJson)
```

``` EnlighterJSRAW
@Override
public void wshEventData(int reqId, String dataJson) {
    System.out.println(EWrapperMsgGenerator.wshEventData(reqId, dataJson));
}
```

``` EnlighterJSRAW
void TestCppClient::wshEventData(int reqId, const std::string& dataJson) {
    printf("WSH Event Data. ReqId: %d, dataJson: %s\n", reqId, dataJson.c_str());
}
```

``` EnlighterJSRAW
public void wshEventData(int reqId, string dataJson)
{
    Console.WriteLine($"WSH Event Data. Request Id: {reqId}, Data JSON: {dataJson}\n");
}
```

``` EnlighterJSRAW
Public Sub wshEventData(reqId As Integer, dataJson As String) Implements EWrapper.wshEventData
    Console.WriteLine($"WSH Event Data. Request Id: {reqId}, Data JSON: {dataJson}")
End Sub
```

### Cancel Event Data

#### EClient.cancelWshEventData (

**requestId:** int. Request identifier used to track data.

)

Cancels pending WSH event data request.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
self.cancelWshEventData(1101, eventDataObj)
```

``` EnlighterJSRAW
client.cancelWshEventData(1101, eventDataObj);
```

``` EnlighterJSRAW
 m_pClient->cancelWshEventData(30002, eventDataObj);
```

``` EnlighterJSRAW
client.cancelWshEventData(1101, eventDataObj);
```

``` EnlighterJSRAW
client.cancelWshEventData(1101, eventDataobj)
```
