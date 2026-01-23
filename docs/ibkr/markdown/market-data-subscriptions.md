# Market Data Subscriptions

## Introduction

While working with Interactive Brokers’ APIs, most\* securities require a Level 1, top of book, market data subscription to receive market data. This is required for all users at Interactive Brokers retrieving market data through the API.

\*Forex and Cryptocurrencies do not require any additional market data subscriptions to receive market data.

## Market Data Requirements

In order to receive market data through the API, there are a few minimum requirements before data can be received.

1.  Opened IB Account (Demo accounts cannot subscribe to data).
2.  Must use an IBKR PRO account type
3.  Clients should have $500 USD in their account in addition to the cost of all market data subscriptions.
4.  Please be sure to subscribe to the market data through the Client Portal Market Data Subscriptions Page before requesting market data through the API.
5.  Please be sure to enable Market Data API access through the Client Portal Market Data Subscriptions Page.

## Market Data Subscription Minimum Equity Balance Requirements

| Category                                                       | The following minimums are required to subscribe and maintain market data and research subscriptions. This does not include the cost of the service. |
| :------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------- |
| Individual Accounts (unless listed below)                      | USD 500.00 (or non-USD equivalent)                                                                                                                   |
| Financial Advisor Client Accounts                              | USD 500.00 (or non-USD equivalent)                                                                                                                   |
| Institutional and/or Organizational Accounts                   | USD 500.00 (or non-USD equivalent)                                                                                                                   |
| Financial Advisor                                              | USD 500.00 (or non-USD equivalent)                                                                                                                   |
| Non-Professional Advisor                                       | USD 200.00 (or non-USD equivalent)                                                                                                                   |
| Introducing Broker Clients                                     | USD 200.00 (or non-USD equivalent)                                                                                                                   |
| Indian residents <sup>1</sup> trading with an IB India account | USD 100.00 (or non-USD equivalent)                                                                                                                   |

\*Please be aware the funded status for a given account will not take effect until the next business day. As a result, any market data subscriptions added on the day the account is funded will not be available until the following day.

**Notes:**

  - The minimum requirements plus the cost of the subscription are required to have the data activated.
  - Indian resident is an individual who resides in India for more than 182 days per year.
  - Market Data services will be terminated once clients receive Market Data Violator notice provided the equity falls below USD 500.00 (or non-USD equivalent)

## Support for Market Data Subscriptions

Please be aware that the Interactive Brokers API Support team is not permitted to provide advice with regards to Market Data Subscriptions.

For traders seeking support with market data subscriptions, please create a ticket with our Market Data team. The Market Data Subscription section is listed under the “Account Services” topic.

[How to create a ticket](https://www.ibkrguides.com/complianceportal/creatingaticket.htm)

## Compliance Requirements for API Market Data

To maintain Interactive Brokers compliance with regulatory and exchange mandates, there are a handful of market data questionnaires that must be completed in order to retrieve market data through the API. The details listed below showcase two of these that must be completed, otherwise your user will automatically be set to deny API market data access.

### Market Data API Acknowledgement

The Market Data API Acknowledgement is required for all users who intend to request market data through any API platform. Proceeding without this form being acknowledged, users will receive errors from their market data requests stating that market data is not subscribed.

This will effect users who trade programmatically with either the TWS API or the Web API.

This will also effect those that use [Third Party software](https://www.interactivebrokers.com/campus/ibkr-api-page/third-party-connections/).

If you are not prompted through the notification bell after logging in to [Client Portal](https://interactivebrokers.com), you can find the Market Data API Acknowledgement by:

1.  Log in to the [Client Portal](https://interactivebrokers.com)
2.  Click “Welcome {Your Name}” in the top right corner, and select “Settings”
3.  Select the “Market Data Subscriptions” button in the Settings page.
4.  On the right side of your settings page, you should see a box for “Market Data API Acknowledgement”. Please select the blue Cog Wheel icon to modify the settings.
5.  On the next page, under “Would you like to enable this functionality”, you will need to select “Yes” and then continue.
6.  The next page will display a form that must be reviewed and digitally signed.
7.  Logging out of all active platforms and then logging will allow market data access for your net API session.

### API User Activity Certification

Users that have interacted with Futures trading or market data through our API offerings will be prompted on login to complete the “API User Activity Certification”. As opposed to blocking general API market data, this will specifically effect those that trade Futures through CME to remain in compliance with [CME Rule 576](https://www.cmegroup.com/rulebook/files/cme-group-Rule-576.pdf).

### Automation and Software Disclosure

If you proceed and agree with the form, you will be prompted with three separate choices:

The user does not submit API messages. Please disable this functionality.

  - If you do not interact with the API at all, this choice will disable the API functionality moving forward.

All or some of the API messages submitted are manually approved (e.g by clicking a button) (You do not need to check this box if you only use TWS for manual orders. Check this box if you use a third party front end).

  - This option is for users who are using a [Third Party Software provider](https://www.interactivebrokers.com/campus/ibkr-api-page/third-party-connections/) to manually submit your order.

All or Some of the API messages submitted are generated & submitted by an automated system.

  - Any trader using the API to programmatically submit trades without manually approving their submission should select this option for their user.
  - After selecting this option, users will need to provide any software used to place these orders and then denote who manages order submission, whether it is an individual, a rotating team of individuals, or on a per-order basis to denote the [External Operator](https://www.cmegroup.com/rulebook/files/cme-group-Rule-576.pdf).

## Professional vs Non-Professional

Most exchanges and data vendors classify clients as either non-professional or professional. By default, organizations such as corporations, limited liability companies, partnerships and any account where the data is used for more than personal investment purposes is deemed to be professional. In addition, private persons may be considered professional if they are registered as a security or investment advisor, or act in a similar capacity. A trader who is employed by a financial services business may also be considered a professional. [Click here](https://ibkr.info/node/2369) for more information about non-professional qualifications.  
 

By default, all users are classified as Professional Market Data users. Individuals who believe they should be classified as Non-Professional market data users should update their market data subscriber status within the client portal.  
 

[How To Update Professional Status](https://www.ibkrguides.com/orgportal/usersettings/marketdatasubscriberstatus.htm)

## Market Data & Users

Market data is provisioned on a per-user basis. This means that even though you may have a market data subscription on one user in an account, a second user on the same account does not gain those permissions.

### Multiple Users

Some individuals may choose to have multiple users under a single account. This is quite common particularly for traders who may wish to use the API and the Trader Workstation or Client Portal at the same time. Alternatively, institutions may have a dedicated machine for an automated trading algorithm that a developer would supervise while other individuals are manually trading on the account.

It is important to note that in the last case, individuals can create a limited-permission user which has restricted access from the standard. This would allow somebody like a developer to build out an implementation with the live account without having withdrawal access, or direct trading access. Users interested in creating reduced-permission users can contact the Interactive Brokers Account Configuration team, as listed on our [Customer Service Contacts page](https://www.interactivebrokers.com/en/support/customer-service.php?p=contact).

### Market Data Sharing

Market data may also be shared between a live and paper username so that both can retrieve data using the same market data subscription. Each Live user can share data with one (1) Paper account, with one Paper account allowed per live account. Please see our [Market Data Considerations](https://www.ibkrguides.com/kb/article-1719.htm) page for additional insight into the behavior of shared market data.

### Finding your Paper User Credentials

Each Live account structure has access to a Paper account with unique credentials. While the Live username can typically be used for Trader Workstation, accessing Third Party Platforms or the Client Portal API require the direct Paper credentials. The steps to find your Paper account credentials are as follows:

### Step One: Log In To Client Portal

Log in to the [Client Portal](https://ndcdyn.interactivebrokers.com/sso/Login) using your Live Account’s username and password.

### Step Two: Click the Head & Shoulders Icon

Click the Head and Shoulders icon next to “Welcome {Your Name}”.

### Step Three: Go to the Settings Page

From the Head & Shoulders dropdown, click the “Settings” button.

### Step Four: Open the Paper Trading Account settings

Once on the Settings page, navigate to the Paper Trading Account link, under the Account Configuration section.

### Step Five: Review Your Paper Credentials

After selectin the Paper Trading Account, you will be able to review your paper username and account ID. You will also see which Live user your paper account is linked to, and a link to reset the password of your paper user separate from your Live account.

## TWS Data vs API Data

IBKR allows for free on-platform data; however, data on the API is considered off-platform. Exchanges maintain different licensing requirements and agreements for off-platform market data viewing.

While you may receive live pricing through the Trader Workstation for some securities like US Stocks in your Trader Workstation, this may not be the same through your API. This is because this data is often provided for free to our customers under our existing market data agreements. In some IB accounts, clients may see there are 2 different data bundles with same names, but one is free while another one is not free.

For example,  `Hong Kong Securities Exchange (Stocks, Warrants & Bonds) (L1) HKD 0/month` is free while `Hong Kong Securities Exchange (Stocks, Warrants & Bonds) (L1) HKD 130/month` is not free.

The free one only provides data in Trader Workstation, and it does not provide data via API or 3rd Party platform. Some regional users (e.g. IB-HK Users) cannot manually unsubscribe the free data bundles (e.g. `Hong Kong Securities Exchange (Stocks, Warrants & Bonds) (L1) HKD 0/month`). For users who need to unsubscribe the free data bundle(s), please contact IB Customer Service to cancel the free data subscription from IB back-end side.

## Market Data Costs and Fees

  - Market data subscriptions are paid once, every calendar month.
  - Market data subscriptions are **not** pro-rated.
  - After subscribing to market data, no additional usage fees or other costs will be incurred.

## Market Data Lines

All users at Interactive Brokers are given a set amount of market data lines. Market data lines dictate how much market data can be retrieved simultaneously from a given user. This Includes all data pulled through Trader Workstation watchlist and the API. After going over the market data line cap, any future requests would return an error message that additional market data lines are required.

In TWS, if you want to know how many data lines are being used, you can click the following buttons to show current used market data lines.

**Windows/ Unix/ Linux:** Click “*Ctrl*” + “*Alt*” + “*=*”

**MacOS:** Click “*CMD*” + “*OPT*” + “*+*”

###### For example:

The username is provisioned for 100 market data lines. If the TWS Watchlist is displaying 50 symbols in their watchlist, and one API connection is retrieving 25 market data lines, that means a second API connection could retrieve a maximum of 25 additional market data lines before reaching the 100 market data line limit.

### Specialized Market Data Lines

Given the potentially high amount of data being sent, market depth and tick data requests are more limited. Just as with historical data requests, the amount of active depth or tick requests are related to the amount of market data lines:

| Number of market data lines | Tick By Tick Data | Max Market Depth (Level II) | Number of subscribed Quote Booster packs |
| --------------------------- | ----------------- | --------------------------- | ---------------------------------------- |
| 100                         | 5                 | 3                           | 0                                        |
| 101 – 200                   | 10                | 3                           | 1                                        |
| 201 – 300                   | 15                | 3                           | 2                                        |
| 301 – 400                   | 20                | 3                           | 3                                        |
| 401 – 500                   | 25                | 4                           | 4                                        |
| 501 – 600                   | 30                | 5                           | 5                                        |
| 601 – 700                   | 35                | 6                           | 6                                        |
| 701 – 800                   | 40                | 7                           | 7                                        |
| 801 – 900                   | 45                | 8                           | 8                                        |
| 901 – 1000                  | 50                | 9                           | 9                                        |
| 1001 – 1100                 | 55                | 10                          | 10                                       |
| 1100+                       | 60-500            | 11 – 60                     | special offer                            |

Note:

  - Tick By Tick market data lines scale at 5% of total market data lines. The values shown in the table above are for approximations.
  - End users from IB IBroker clients which use CP API + DAM SSO still have this limitation: each IBroker end-user can get up to max \>= 100 data lines. However, the limit is on a per session basis per IP Address. For details, please contact IB DAM team.

### How Market Data is Allocated

In order to receive real-time market data, customers must be a subscriber to market data. All clients initially receive 100 concurrent lines of real-time market data (which can be displayed in TWS or via the API) and always have a minimum of 100 lines of data. After the first month of trading, the quantity of market data is allocated using the greater value of:

  - USD monthly commissions divided by 8
  - USD equity multiplied by 100 divided by $1,000,000  
    (rounded down to the nearest integer)
  - 100

**Example 1:**

In month two, your account shows the following values: USD Monthly Commissions: $16, USD Equity: $950,000  
Using the calculations above, you would still receive the minimum 100 lines of data, since: $16/8 = 2  
$950,000 x 100 / $1,000,000 = 95

**Example 2:**

In month three, your account shows the following values: USD Monthly Commissions: $500, USD Equity: $1,245,000  
Using the calculations above, you would receive 124 lines of data, since: $500/8 = 62.5  
$1,245,000 x 100 / $1,000,000 = 124.5, rounded down to 124.

## Understanding Market Data Subscriptions

While market data might seem overwhelming at first, it can be broken down and made more digestible from covering a few important points.

1.  Level 1 market data subscriptions provide: live watchlist data, tick-by-tick data, historical bar data, historical tick data.
2.  Level 2 market data subscriptions only are needed for market depth.
3.  The OPRA market data subscription will provide options data for all options in the United States.
      - Options Greeks data is based on  the underlying symbols. As such, a market data subscription for both the underlying and derivative are necessary for options greeks data.
4.  Indices sometimes require a separate market data subscriptions from the derivatives, and may require a direct market data subscription.

## Regulatory Snapshots

For stocks, there are individual exchange-specific market data subscriptions necessary to receive streaming quotes. For instance, for NYSE stocks this subscription is known as “Network A”, for ARCA/AMEX stocks it is called “Network B” and for NASDAQ stocks it is “Network C”. Each subscription is added a la carte and has a separate market data fee.

Alternatively, there is also a “US Securities Snapshot Bundle” subscription which does not provide streaming data but which allows for real time calculated snapshots of US market NBBO prices. Making a request with this endpoint, the returned value is a calculation of the current market state based on data from all available exchanges.

The following table lists the cost and maximum allocation for regulatory snapshot quotes:

| Listed Network Feed    | Price per reqSnapshot request | Pro or non-Pro | Max reqSnapshot request |
| ---------------------- | ----------------------------- | -------------- | ----------------------- |
| NYSE (Network A/CTA)   | 0.01 USD                      | Pro            | 4500                    |
| NYSE (Network A/CTA)   | 0.01 USD                      | Non-Pro        | 150                     |
| AMEX (Network B/CTA)   | 0.01 USD                      | Pro            | 2300                    |
| AMEX (Network B/CTA)   | 0.01 USD                      | Non-Pro        | 150                     |
| NASDAQ (Network C/UTP) | 0.01 USD                      | Pro            | 2300                    |
| NASDAQ (Network C/UTP) | 0.01 USD                      | Non-Pro        | 150                     |

## Popular Market Data Subscriptions

Interactive Brokers support is often asked about which subscription is best for each individual. While there is no perfect subscription for everyone, the table below describes some of the more common subscriptions along with what they cover.

If you have direct questions for an exact symbol, please try our Market Data Assistant for assistance.

The Market Data Pricing section will provide context for the prices of all market data subscriptions available at Interactive Brokers.

[Market Data Assistant](https://www.interactivebrokers.com/lib/cstools/faq/#/content/28215165) [Market Data Pricing](https://www.interactivebrokers.com/en/pricing/market-data-pricing.php?p=mktDataPricing)

While this list contains some of the more common market data subscriptions, this does not indicate trading advice, nor the best subscription for every individual. If you have any questions about specific market data subscriptions, please [create a ticket](https://www.interactivebrokers.com/campus/ibkr-api-page/market-data-subscriptions/#md-support) with our market data team.

| NAME                                                               | EXCHANGES COVERED                                                                                                        | Examples               |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ | ---------------------- |
| CBOE Streaming Market Indexes                                      | Provides L1 data for CBOE indices.                                                                                       | SPX\*                  |
| NYSE (Network A/CTA)                                               | Provides L1 data for NYSE listed securities.                                                                             | CYS, F, LLY            |
| NYSE American, BATS, ARCA, IEX, and Regional Exchanges (Network B) | Provides L1 data for ARCA, BATS, IEX, and other major US Regional Exchanges listed securities.                           | IBKR, SPY, VXX         |
| NASDAQ (Network C/UTP)                                             | Provides L1 data for NASDAQ listed securities.                                                                           | AAPL, IBKR, MSFT, TSLA |
| OPRA (US Options Exchanges)                                        | Provides L1 data for US Options.\*                                                                                       | SPX\*\*                |
| US Securities Snapshot and Futures Value Bundle                    | Provides L1 data for US Futures.                                                                                         | ES \*\*                |
| US Equity and Options Add-On Streaming Bundle                      | Bundle containing all three market data requests and OPRA. Requires the US Securities Snapshot and Futures Value Bundle. | AAPL, F, IBKR, SPX\*\* |

\*Please note values such as greeks that are based on the underlying require the Network subscription as well.

\*\* For options and futures market data subscriptions, the underlying Index will not be included.

### Chinese Market Data Subscriptions

API users can subscribe to the following “Alternative Display” market data packs for getting Chinese Market Data via API and TWS.

| NAME                                                                   | EXCHANGES COVERED                                                                      | Examples                                |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | --------------------------------------- |
| Shanghai Stock Exchange 5 Second Snapshot via HKEx Alternative Display | Shanghai Stock Exchange, Shanghai-Hong Kong Stock Connect (SEHKNTL), SEHKSTAR, ChiNEXT | 600000, 601728 SEHKNTL, 688256 SEHKSTAR |
| Shanghai Stock Exchange Alternative Display Top of Book (L1)           | Shanghai Stock Exchange                                                                | 600000                                  |
| Shenzhen Stock Exchange 3 Second Snapshot via HKEx Alternative Display | Shenzhen Stock Exchange, Shanghai-Hong Kong Stock Connect (SEHKSZSE)                   | 000001, 000001 SEHKSZSE                 |
| Shenzhen Stock Exchange Alternative Display Top of Book (L1)           | Shenzhen Stock Exchange                                                                | 000001                                  |

\*Please note that Non-Professional and Professional clients may have different available market data packs.

\*Do not subscribe “Alternative Display” market data pack(s) and Non-“Alternative Display” market data pack(s) at the same time. This may cause data pack conflict. For example, having “Shanghai Stock Exchange 5 Second Snapshot (via HKEx)” and “Shanghai Stock Exchange 5 Second Snapshot via HKEx Alternative Display” at the same time may cause data pack conflict.

\*For API clients, please unsubscribe Non-“Alternative Display” Chinese market data pack(s) before subscribing “Alternative Display” Chinese market data pack(s). If data pack conflict happens, please wait until next month or please contact Interactive Brokers Customer Services for unsubscribing the Non-“Alternative Display” Chinese market data pack(s) from IB back-end side.

\*”Shanghai Stock Exchange 5 Second Snapshot via HKEx Alternative Display” only provides 5 seconds snapshot bid, ask and last data.

\*”Shenzhen Stock Exchange 3 Second Snapshot via HKEx Alternative Display” provides real time data, but its bid/ ask data will be 3 seconds snapshot.

### News Data

To get data via API, client needs to first to go TWS/ IB Gateway – Global Configuration – API – News Configuration to enable News Providers.

IB only supports client to get News data from the following 4 News providers:

  - Briefing.com Analyst Actions (BRFUPDN) (Free)
  - Briefing.com General Market Columns (BRFG) (Free)
  - Dow Jones Newsletters (DJNL) (Free)
  - Benzinga (BZ) (“Benzinga Breaking News via API” (USD 35/month) research subscription is required)

To subscribe “Benzinga Breaking News via API”, please Live Account IB Client Portal – Setting – Research Subscriptions.

## NASDAQ Specialty Subscriptions

Interactive Brokers will typically require a Level 1 market data subscription for tick data and a Level 2 subscription for market depth. However, to retrieve Tick data or Market Depth through NASDAQ/ISLAND, users requires an additional market data subscription in order to retrieve market depth off-platform in the form of the API or third party platforms.

Clients must subscribe to the following:

1.  All US level 1 US Equity market data subscriptions. This includes either:
      - “NYSE (Network A/CTA)”, “NYSE American, BATS, ARCA, IEX, and Regional Exchanges (Network B)”, AND “NASDAQ (Network C/UTP)” (All three subscriptions)
      - “US Equity and Options Add-On Streaming Bundle”
2.  The “NASDAQ TotalView-OpenView” is required for all platforms.
      - While this is necessary for market depth and NASDAQ tick data, this alone will not provide data for off-platform subscriptions
      - If “NASDAQ (Network C)” and “NASDAQ TotalView-OpenView” are subscribed without the EDS subscription, NASDAQ data will not be available whatsoever through the API. Users must either subscribed to the single Network subscription, or all three subscriptions.
3.  The “NASDAQ TotalView-OpenView EDS” market data subscription is required for off-platform market data subscriptions.
