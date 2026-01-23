# Trading Web API

## Introduction

Interactive Brokers (IBKR) RESTful Web API is designed to provide users with seamless, secure, and real-time access to their IBKR account. The Web API runs parallel to the IBKR hosted application, providing users with scalable, and efficient access to essential services. Our API is split into two key components:

  - **[Account Management](https://www.interactivebrokers.com/campus/ibkr-api-page/web-api-account-management/#introduction-0):** Provides solution for Introducing Brokers and Financial Advisors to preserve their current user experience and interface design while relying on IBKR’s brokerage services. Advisors and brokers can integrate with the Account Management API to manage Client Registration, Client Account Maintenance, User Authentication, Funding, and Reporting.
  - **[Trading](https://www.interactivebrokers.com/campus/ibkr-api-page/web-api-trading/#introduction-0):** Our trading API is available to all IBKR clients free of cost and can be used to manage trades, view real-time portfolio information, access market data, view contract information, and authenticate for brokerage sessions.

### Connectivity

IBKR’s Web API implementation follows standard HTTP verbs for communication. It employs a range of HTTP status codes and JSON-formatted messages to convey operation status and error information. To ensure secure communication, all API requests must use HTTPS. Authorization and Authentication for IBKR’s Web API is managed using OAuth 2.0.

### Authentication

IBKR only supports **private\_key\_jwt **client authentication as described in [RFC 7521](https://www.rfc-editor.org/rfc/rfc7521.html) and [RFC 7523](https://www.rfc-editor.org/rfc/rfc7523.html).

  - Client authenticates against the authorization server by presenting a signed JWT token called a *client\_assertion* which the authorization server validates against the public key(s) provided by the client during registration.
  - This scheme is considered safer than the standard client id/client secret authentication scheme used in early OAuth 2.0 integrations given that it prevents the client from having to pass the client secret in back-end requests.

### Data Transmission

User requests will be sent to IBKR in JSON format using HTTPS.

## References

We know that great documentation makes all the difference. In addition to IBKR’s dedicated API Integration team, IBKR provides documentation for both the developer AND project managers.

  - **[Documentation](https://www.interactivebrokers.com/campus/ibkr-api-page/webapi-doc):** Within our long form documentation we include best practices, flow charts, and descriptions to help users maximize the API’s potential.
  - **[Reference](https://www.interactivebrokers.com/campus/ibkr-api-page/webapi-ref):** Our API reference includes detailed endpoint references, schema requirements, authentication guides, and sample request and responses.

## Getting Started

### Retail

For retail and individual clients, Authentication to our WebAPI is managed using the Client Portal Gateway, a small java program used to route local web requests with appropriate authentication. Click [here](https://www.interactivebrokers.com/campus/ibkr-api-page/cpapi-v1/#gw-step-one) to get started.

### Institutional or Third Party

We understand that enterprise integrations can be more complex. We have a designated API Solutions team that will help in creating solution that aligns with your business objectives. To get started, please contact our API Solutions (e-mail: **api-solutions@interactivebrokers.com**) with the following information:

  - Firm Name
  - Firm Type (ie. Introducing Broker, Financial Advisor OR Third Party Service Provider)
  - API Services which you are interested in using (ie. Registration, Funding, Single Sign On, View Portfolio Data, Trading, Reporting)
  - Describe intended usage (1-2 sentences)

## Feedback

Have feedback on our Web API documentation or reference material?

Email us at <API-Feedback@interactivebrokers.com>.

We value your suggestions, ideas, and feedback in order to continuously improve our API solutions.

*This is an automated feedback inbox and unfortunately, we will not be actively responding from this email. However, if you need a specific answer or additional support, please contact our [API Support team](https://www.interactivebrokers.com/campus/ibkr-api-page/webapi-doc/#help) or [access our general support](https://www.interactivebrokers.com/en/support/customer-service.php). Current or prospective institutional clients may also [contact their sales representative](https://www.interactivebrokers.com/en/support/institutions.php).*

## Getting Started with the Trading API

Clients with fully open and funded accounts may use our Web API's Trading features to trade their accounts immediately, without any onboarding or approval process.

However, our Web API's Trading functionality is accessible via several methods of authentication in addition to OAuth 2.0, some of which do require approval or configuration prior to use.

### Trading Access for Organizations

Enterprise and Institutional clients have several methods of authorization and authentication at their disposal. All methods permit requests to be made directly to Interactive Brokers' infrastructure.

The list below outlines the general suitability of the available methods for various use-cases. For a more thorough discussion of these access methods, please contact our API Integrations team.

  - OAuth2.0 (beta)
      - Supports first-party (accessing one's own accounts) and third-party (accessing the accounts of unaffiliated IB clients with their authorization) usage
      - Offers access to account management and trading features
  - OAuth1.0a
      - Supports first-party (accessing one's own accounts) and third-party (accessing the accounts of unaffiliated IB clients with their authorization) usage
      - Offers access to trading features only
  - SSO
      - Available to Financial Advisors and Introducing Brokers
      - Supports the development of alternative UIs specifically for clients under your management
      - Offers access to account management and trading features

### Trading Access for Individuals

Trading in the Web API for individual clients involves an IBKR username and password.

Whether accessing a live account or its associated simulated paper account, the live account must be fully open and funded. The live account must also be of the "IBKR Pro" type.

If you do not already have an account, you can [create one for free](https://www.interactivebrokers.com/en/index.php?f=46380#open-account).

### Trading Access for Third Parties

Interactive Brokers identifies third-party developers as vendors of software that would interact with IB client accounts to which the vendor has no formal relationship or access within IB. This is in contrast to an advisor or introducing broker who maintains an account structure with IB and formally manages client accounts.

Third-party vendors may currently only seek approval for the use of OAuth1.0a.

Third-party vendors must receive Compliance approval for their product offerings before integration can proceed.

The third-party approval process begins with the submission of a third-party onboarding questionnaire.

Please note that vendors are expected to have an established business entity and a public presence online with material describing their offering. Proof of concept builds to demonstrate intended functionality are strongly encouraged as well. The onboarding process typically proceeds as follows:

1.  Our onboarding team conducts the initial screening. Estimated time to complete this step is 2-3 weeks. If our onboarding team is able to proceed with your request for approval, they will send your application to our Compliance team for review.
2.  IBKR Compliance conducts an enhanced due diligence review on all third-party applicants, followed by a three-tier approval process. Estimated time to complete Compliance-related reviews and tasks is 3-6 weeks.
3.  If Compliance grants approval, our Legal team will generate a Web API agreement which will be relayed to you for review and signature. In parallel, our third-party onboarding team will ask you to provide public keys and a callback URL in support of the configuration of your OAuth1.0a consumer. Detailed instructions for this process will be provided once this stage is reached. Estimated time for IB complete our portions of the aforementioned process is 3-5 weeks.

The above timelines are estimates and can vary. We recommend providing as much information as possible up front. Not doing so can extend timelines.

During the enhanced due diligence reviews conducted by our Compliance teams, they will expect vendors to have a completed website with finalized details of the product offering. This typically includes a clear user workflow for all components and descriptions of their functionality and capabilities.

Should Compliance approval be reached for your product offering, any significant changes to the offering following approved (such as the addition of trading functionality) would require additional review and approval from our Compliance teams before being offered to IBKR clients.

Please be aware we expect third-party vendors offering automated trading solutions to hold applicable registration with financial authorities in all regions they plan to service, unless the vendor is able to provide support (i.e., a legal opinion) as to why the proposed service would not require registration in a given location. Additionally, the offering will need to be reviewed and approved by Compliance teams in all regions in which you intend to serve IBKR clients.

## Trading API Support <span id="contacting-support"></span>

Interactive Brokers always welcomes clients to contact our customer support. We offer several ways to reach our support teams directly:

  - [Create a Support Ticket](https://www.interactivebrokers.com/en/general/contact/newContact/contact.php)
  - [Chat Live with API Support](https://www.interactivebrokers.com/en/support/customer-service.php?p=chat)
  - [Get Help by Phone](https://www.interactivebrokers.com/en/support/customer-service.php?p=contact)

To help expedite the troubleshooting process, we encourage our clients to first consider the following:

  - Does the issue persist in other platforms? Am I able to perform the action (e.g., submission of an certain order) via an IB interface like Trader Workstation, rather than through the API?
  - When was the issue first observed? Did the same request produce a different response in the past?
  - Do other, similar requests yield the expected response?
  - Did the request include the parameteres marked *Required* in the our [Web API Reference material](https://www.interactivebrokers.com/campus/ibkr-api-page/webapi-ref)?

Clients with [sales representation](https://www.interactivebrokers.com/en/support/institutional-sales-contacts.php) may also find it helpful to involve their representative, who can assist with routing inquiries to the appropriate team.

## Usage and Availability

### Scheduled Server Maintenance

Interactive Brokers conducts scheduled maintenance on the infrastructure that serves the Web API. During maintenance windows, some features of the Web API are momentarily unavailable.

The timing of the Web API's maintenance windows vary slightly from the those observed in other platforms, such as Trader Workstation.

The Web API itself is accessible 24 hours a day during the week. It receives maintenance only on Saturday evenings.

Brokerage functionality (provided by `/iserver` endpoints) is briefly unavailable each evening at approximately 0100 local time by region.

##### *Weekday IServer Reset Timing*

<table>
<colgroup>
<col style="width: 50%" />
<col style="width: 50%" />
</colgroup>
<tbody>
<tr class="odd">
<td>Region</td>
<td>Maintenance Onset</td>
</tr>
<tr class="even">
<td>North America<br />
*(NY and Chicago)*</td>
<td>01:00 US/Eastern</td>
</tr>
<tr class="odd">
<td>Europe</td>
<td>01:00 CEST</td>
</tr>
<tr class="even">
<td>Asia</td>
<td>01:00 HKT</td>
</tr>
</tbody>
</table>

### Pacing Limitations

Interactive Brokers currently enforces a global request rate limit of 50 requests per second for each authenticated username -- that is, each Web API session.

Users making requests via the CP Gateway tool are restricted to 10 requests per second.

Additionally, some endpoints are also subject to their own pacing limits as described in the table below.

When a rate limit is exceeded, the Web API will return a `429 Too Many Requests` status code.

Violator IP addresses may be put in a penalty box for 10 minutes. After this period, the IP address is removed from the penalty box. Repeat violator IP addresses may be permanently blocked until the issue is resolved.

##### *Per-Endpoint Request Rate Limits*

|                                     |        |               |
| ----------------------------------- | ------ | ------------- |
| Endpoint                            | Method | Limit         |
| /iserver/marketdata/snapshot        | GET    | 10 req/s      |
| /iserver/scanner/params             | GET    | 1 req/15 mins |
| /iserver/scanner/run                | POST   | 1 req/sec     |
| /iserver/trades                     | GET    | 1 req/5 secs  |
| /iserver/orders                     | GET    | 1 req/5 secs  |
| /iserver/account/pnl/partitioned    | GET    | 1 req/5 secs  |
| /portfolio/accounts                 | GET    | 1 req/5 secs  |
| /portfolio/subaccounts              | GET    | 1 req/5 secs  |
| /pa/performance                     | POST   | 1 req/15 mins |
| /pa/summary                         | POST   | 1 req/15 mins |
| /pa/transactions                    | POST   | 1 req/15 mins |
| /fyi/unreadnumber                   | GET    | 1 req/sec     |
| /fyi/settings                       | GET    | 1 req/sec     |
| /fyi/settings/{typecode}            | POST   | 1 req/sec     |
| /fyi/disclaimer/{typecode}          | GET    | 1 req/sec     |
| /fyi/disclaimer/{typecode}          | PUT    | 1 req/sec     |
| /fyi/deliveryoptions                | GET    | 1 req/sec     |
| /fyi/deliveryoptions/email          | PUT    | 1 req/sec     |
| /fyi/deliveryoptions/device         | POST   | 1 req/sec     |
| /fyi/deliveryoptions/{deviceId}     | DELETE | 1 req/sec     |
| /fyi/notifications                  | GET    | 1 req/sec     |
| /fyi/notifications/more             | GET    | 1 req/sec     |
| /fyi/notifications/{notificationId} | PUT    | 1 req/sec     |
| /tickle                             | GET    | 1 req/sec     |
| /sso/validate                       | GET    | 1 req/min     |

##### *Additional Usage Limits*

|                             |        |                       |
| --------------------------- | ------ | --------------------- |
| Endpoint                    | Method | Limit                 |
| /trsv/secdef                | POST   | 200 conids/request    |
| /iserver/marketdata/history | GET    | 5 concurrent requests |

## Trading Sessions in the Web API

Access to Trading functionality in the Web API entails the creation of a trading-enabled *brokerage session*.

A brokerage session is associated with an IB *username* (your credentials), which in turn has trading permissions for one or more *accounts* (the actual pools of equity).

A single username can only have one brokerage session active at a time across all IB platforms.

Permissions for trading in general, for specific asset classes, market data subscriptions (and thus access to the subscribed feeds), etc. are carried by IB usernames, not the underlying accounts. Hence references to brokerage sessions refer to a logged-in username that is in contact with IBKRÃ¢Â€Â™s backend trading infrastructure.

Though Interactive Brokers permits a username only one brokerage session at any given time, some of the Web API's Trading functionality is accessible without a brokerage session. This allows a username's active brokerage session to continue elsewhere undisturbed.

We typically refer to these non-brokerage features as the "read-only" subset of the Trading portion of the Web API. Examples of read-only features include retrieval of portfolio data and certain instrument search tools. When trading with the Web API, sessions can therefore be thought of as two-tiered:

1.  An "outer" prerequisite *read-only session* that is required to be active/valid in order to make any CP Web API request, though by itself it only permits access to non-`/iserver` endpoints.
2.  The *brokerage session*, established after the read-only, that permits access to trading, consumption of market data, and all other functionality behind `/iserver` endpoints.

## Instrument Discovery

The Web API requires the use of IB's contract ID ("`conid`") to uniquely specify instruments. Knowledge of a particular instrument's conid is required to retrieve intrument trading rules and market data, and also to submit orders.

The Web API offers several ways to retrieve our `conid` identifier, as well as well as all other attributes of the the instruments we offer for trading.

Note that IB `conids` are persistent for the life of an instrument. Therefore, we recommend retrieving `conids` and storing them locally prior to trading.

### Contract IDs

Before we can use the Web API to interact with a financial instrument, we must first determine its unique `conid`.

We start by searching IB's instrument database by symbol. Three endpoints exist to facilitate this step. All three endpoints will return all matching records within their scope. Subsequent requests will can further filter this result set.

#### Equities

The following endpoint is designed specifically for resolving stock symbols into `conids`. Note that it accepts a comma-separated list, and returns all matching results accordingly.

`GET /trsrv/stocks?symbols=AAPL`

    {
      "AAPL": [
        {
          "name": "APPLE INC",
          "assetClass": "STK",
          "contracts": [
            {
              "conid": 265598,
              "exchange": "NASDAQ",
              "isUS": true
            },
            {
              "conid": 38708077,
              "exchange": "MEXI",
              "isUS": false
            },
            ...
          ],
          ...
        },
        {
          "name": "LS 1X AAPL",
          "assetClass": "STK",
          "contracts": [
            {
              "conid": 493546048,
              "exchange": "LSEETF",
              "isUS": false
            }
          ],
          ...
        },
        ...
      ]
    }

*Note*: For a single product trading in multiple markets, IB will assign distinct `conids` for each combination of product and currency. For instance, AAPL stock trading in USD in the United States has a different `conid` than the same AAPL stock trading in MXN. A single instrument that is traded in multiple markets will have its records grouped together.

#### Futures

A similar endpoint exists to locate futures products by their symbols or product codes:

`GET /trsrv/futures?symbols=ES`

    {
      "ES": [
        {
          "symbol": "ES",
          "conid": 495512557,
          "underlyingConid": 11004968,
          "expirationDate": 20241220,
          "ltd": 20241219,
          "shortFuturesCutOff": 20241219,
          "longFuturesCutOff": 20241219
        },
        {
          "symbol": "ES",
          "conid": 495512563,
          "underlyingConid": 11004968,
          "expirationDate": 20251219,
          "ltd": 20251218,
          "shortFuturesCutOff": 20251218,
          "longFuturesCutOff": 20251218
        },
        ...
      ]
    }

### Finding Derivative Products

Both examples above yielded instruments that are referenced by derivative products, though these endpoints intentionally omit those results for simplicity.

However, if we want to find those derivatives, we start with a more general-purpose endpoint that identifies the relationships between underliers and their derivatives:

`GET /iserver/secdef/search`

Consider the following example workflow to locate ES futures options.

#### Step 1, Obtaining Index Conid and Contract Months

First, we'll want to capture the `conid` of the underlying ES index. This index `conid` can be stored and reused in the future to fetch derivative products as needed.

`GET https://api.ibkr.com/v1/api/iserver/secdef/search?symbol=ES&secType=FUT`

    [
      {
        "conid": "11004968",
        "companyHeader": "E-mini S&P 500 - CME",
        "companyName": "E-mini S&P 500",
        "symbol": "ES",
        "description": "CME",
        "restricted": null,
        "sections": [
          { "secType": "IND", "exchange": "CME;" },
          {
            "secType": "FUT",
            "months": "DEC24;MA...29;DEC29",
            "exchange": "CME",
            "showPrips": true
          },
          {
            "secType": "FOP",
            "months": "OCT24;NO...27;DEC28",
            "exchange": "CME",
            "showPrips": true
          },
          ...
        ]
      },
      ...
    ]

From this response we should capture these values:

1.  The index's conid ("conid":"11004958")
2.  From the "FOP" object, the semicolon-separated list of futures options Contract Months ("months":"DEC24;MAR25;JUN25;DEC25;DEC26;DEC27;DEC28")
3.  The index's exchange, "CME"

#### Step 2, Obtaining Futures Options Conids

Next we collect the following parameters.

1.  `Conid` of underlying index (`conid=11004968` for ES)
2.  Name of the exchange (`exchange=CME`)
3.  Security Type of the instruments we're seeking (`sectype=FOP`, recalling that CME Event Contracts are modeled as futures options)
4.  Contract Month of interest, which restricts the scope of the query

And make the following request to obtain records instrument records, including `conids`, for ES futures options in the DEC24 contract month:

`GET /iserver/secdef/info?conid=11004968&exchange=CME&sectype=FOP&month=DEC24`

    [
      {
        "conid": 732160324,
        "symbol": "ES",
        "secType": "FOP",
        "exchange": "CME",
        "listingExchange": null,
        "right": "C",
        "strike": 4975.0,
        "currency": "USD",
        "cusip": null,
        "coupon": "No Coupon",
        "desc1": "ES",
        "desc2": "(EW) Dec31'24 4975 Call Fut.Option(50) @CME",
        "maturityDate": "20241231",
        "multiplier": "50",
        "tradingClass": "EW",
        "validExchanges": "CME",
        "showPrips": true
      },
      {
        "conid": 732160331,
        "symbol": "ES",
        "secType": "FOP",
        "exchange": "CME",
        "listingExchange": null,
        "right": "P",
        "strike": 5875.0,
        "currency": "USD",
        "cusip": null,
        "coupon": "No Coupon",
        "desc1": "ES",
        "desc2": "(EW) Dec31'24 5875 Put Fut.Option(50) @CME",
        "maturityDate": "20241231",
        "multiplier": "50",
        "tradingClass": "EW",
        "validExchanges": "CME",
        "showPrips": true
      },
      ...
    ]

### Finding Options Chains

We will locate `conids` for equity options as an example.

##### Step 1, Obtaining Underlier Conid and Contract Months

First, we'll want to capture the conid of the underlying equity.

    GET https://api.ibkr.com/v1/api/iserver/secdef/search?symbol=AAPL&secType=STK
    200 OK
    [
      {
        "conid": "265598",
        "companyHeader": "APPLE INC - NASDAQ",
        "companyName": "APPLE INC",
        "symbol": "AAPL",
        "description": "NASDAQ",
        "restricted": null,
        "sections": [
          { "secType": "STK" },
          {
            "secType": "OPT",
            "months": "OCT24;NOV24;...;JAN27",
            "exchange": "SMART;AM...SAPPHIRE"
          },
          ...
        ]
      },
      ...
    ]

We've received more than one matching result, and we will need to filter for the desired AAPL (trading in USD in the United States) stock record.

From this response we should capture two values:

1.  The AAPL's `conid` (`"conid": "265598"`)
2.  In the `"secType": "OPT"` section, the semicolon-separated list of options contract months (`"months": "OCT24;NOV24;...;JAN27"`)

##### Step 2, Obtaining Valid Strike Values

Next, we need to query for valid strike values.

    GET https://api.ibkr.com/v1/api/iserver/secdef/strikes?conid=265598&exchange=SMART&sectype=OPT&month=OCT24
    200 OK
    {
      "call": [ ..., 212.5, 215.0, 217.5, 220.0, 222.5, 225.0, 227.5, ... ],
      "put": [ ..., 212.5, 215.0, 217.5, 220.0, 222.5, 225.0, 227.5, ... ]
    }

Separate lists are always returned for Calls and Puts, in case strike values differ according to right.

##### Step 3, Obtaining Option Contract Conids

Finally, we'll make a series of queries for records for tradable option contract instruments.

To obtain all possible `conids`, we must make one request for each combination of Contract Month and Strike value. Note that it is possible that a given Strike value has no tradable options in a given Contract Month, in which case the response will be empty.

Note that below we've received four options contract records, because there are two expirations with the month of October.

    GET https://api.ibkr.com/v1/api/iserver/secdef/info?conid=265598&exchange=SMART&sectype=OPT&month=OCT24&strike=217.5
    200 OK
    [
      {
        "conid": 730679583,
        "symbol": "AAPL",
        "secType": "OPT",
        "exchange": "SMART",
        "listingExchange": null,
        "right": "C",
        "strike": 217.5,
        "currency": "USD",
        "cusip": null,
        "coupon": "No Coupon",
        "desc1": "AAPL",
        "desc2": "OCT 18 '24 217.5 Call",
        "maturityDate": "20241018",
        "multiplier": "100",
        "tradingClass": "AAPL",
        "validExchanges": "SMART,AM...SAPPHIRE",
        "showPrips": true
      },
      {
        "conid": 730679981,
        "symbol": "AAPL",
        "secType": "OPT",
        "exchange": "SMART",
        "listingExchange": null,
        "right": "P",
        "strike": 217.5,
        "currency": "USD",
        "cusip": null,
        "coupon": "No Coupon",
        "desc1": "AAPL",
        "desc2": "OCT 18 '24 217.5 Put",
        "maturityDate": "20241018",
        "multiplier": "100",
        "tradingClass": "AAPL",
        "validExchanges": "SMART,AM...SAPPHIRE",
        "showPrips": true
      },
      {
        "conid": 733773440,
        "symbol": "AAPL",
        "secType": "OPT",
        "exchange": "SMART",
        "listingExchange": null,
        "right": "C",
        "strike": 217.5,
        "currency": "USD",
        "cusip": null,
        "coupon": "No Coupon",
        "desc1": "AAPL",
        "desc2": "OCT 25 '24 217.5 Call",
        "maturityDate": "20241025",
        "multiplier": "100",
        "tradingClass": "AAPL",
        "validExchanges": "SMART,AM...SAPPHIRE",
        "showPrips": true
      },
      {
        "conid": 733773853,
        "symbol": "AAPL",
        "secType": "OPT",
        "exchange": "SMART",
        "listingExchange": null,
        "right": "P",
        "strike": 217.5,
        "currency": "USD",
        "cusip": null,
        "coupon": "No Coupon",
        "desc1": "AAPL",
        "desc2": "OCT 25 '24 217.5 Put",
        "maturityDate": "20241025",
        "multiplier": "100",
        "tradingClass": "AAPL",
        "validExchanges": "SMART,AM...SAPPHIRE",
        "showPrips": true
      }
    ]

### Finding Event Contracts

Interactive Brokers models Event Contract instruments on options (for ForecastEx products) and futures options (for CME Group products). Therefore, Event Contracts can generally be treated as options products in the Web API, and most existing features and workflows will serve these instruments unaltered. This guide will frequently make analogies to conventional index options for both ForecastEx and CME Group products.

IB's Event Contract instrument records use the following fields inherited from the options model:

  - An underlying reference index, which may or may not be artificial:
      - For CME products, a tradable Event Contract will have the relevant CME index as its underlier.
      - For ForecastEx products, IB has generated an artificial underlying index which serves as a container for related Event Contracts in the same product class. These artificial indices do not have any associated reference values and are purely an artifact of the option instrument model used to represent these Event Contracts. However, these artificial underlying indices can be used to search for groups of related Event Contracts, just as with index options.
  - A Symbol value which matches the symbol of the underlying index and which reflects the issuer's product code for the instrument and points to the underlying index that
  - A Trading Class which reflects the issuer's product code for the instrument and serves as human-readable identifier for a group of related Event Contracts.
      - Note that many CME Group Event Contracts, which resolve against CME Group indices, have product codes prefixed with "EC" and followed by the symbol of the relevant exchange, to avoid naming collisions with other derivatives on the same index.
  - A Put or Call "Right" value, where Call = Yes and Put = No.
      - Note that Event Contracts do not permit Sell orders. Instead, positions are flattened or reduced by buying the opposing contract.
  - An artificial "Contract Month" value, again used primarily for searching and filtering available instruments. Most Event Contract products do not follow monthly series as is common with index or equity options, so these Contract Month values are typically not a meaningful attribute of the instrument. Rather, they permit filtering of instruments by calendar month.
  - A Last Trade Date, Time, and Millisecond values, which together indicate precisely when trading in an Event Contract will cease, just as with index options.
  - A Strike value, which is the numerical value on which the event resolution hinges. Though numerical, this value need not represent a price.
  - An instrument symbol in the form "\[PRODUCT CODE\] \[EXPIRATION DATE\] \[STRIKE\] \[RIGHT\]", where:
      - PRODUCT CODE is the issuer's product identifier
      - EXPIRATION DATE is the date of the instrument's resolution in the form MmmDD'YY, e.g., "Sep26'24"
      - STRIKE is the numerical value that determines the contract's moneyness at expiration
      - RIGHT is a value YES or NO

Similarly, Event Contracts' underlying indices possess their own conids which persist indefinitely. Once these underlier conids are captured, they can be used to retrieve a current set of tradable Event Contracts in that product class.

The Web API's existing derivative discovery workflow can be used to find Event Contracts offered by both CME Group and ForecastEx, though the workflow differs slightly for each issuer, owing to the modeling of their products as futures options and (index) options, respectively.

In both cases, instrument discovery begins by selecting a product code of interest.

Event Contract product codes can be obtained from IB's ForecastTrader, or directly from the exchange websites:

IB ForecastTrader: https://forecasttrader.interactivebrokers.com/eventtrader/\#/markets

CME Group: https://www.cmegroup.com/activetrader/event-contracts.html

ForecastEx: https://forecastex.com/markets/

#### CME Group Discovery Workflow

Note that CME Group's Event Contract products are listed on the CME venues where their underlying indices reside. For example, Event Contracts related to the closing price of Gold are listed on COMEX, while NQ-related Event Contracts are listed on CME.

Suppose we'd like to find CME's NQ Event Contracts.

##### CME Request 1, Obtaining Index Conid and Contract Months

First, we'll want to capture the conid of the underlying NQ index. This index conid can be stored, and this query does not need to be made more than once for a particular Event Contract product code. The retrieved conid can be reused in the future to fetch tradable Event Contracts as needed.

    GET https://api.ibkr.com/v1/api/iserver/secdef/search?symbol=NQ&secType=IND
    200 OK
    [
      {
        "conid": "11004958",
        "companyName": "E-mini NASDAQ 100 ",
        "symbol": "NQ",
        "description": "CME",
        ...,
        "sections": [
          { "secType": "IND", "exchange": "CME;" },
          ...,
          {
            "secType": "FOP",
            "months": "AUG24;SEP24;OCT24;NOV24;DEC24;MAR25;JUN25;DEC25;DEC26;DEC27;DEC28",
            "exchange": "CME"
          },
          ...,
          { "secType": "EC" }
        ]
      }
    ]

The response will deliver instrument records matching the provided symbol and instrument type, and results may not be unique. You'll want to filter the returned list for the index record of interest. This can be done by looking at the array of JSON objects in the "sections" field, which should contain (among others) three objects: one reflecting an index on the correct exchange, ("secType":"IND" & "exchange":"CME"), another reflecting futures options on that index ("secType":"FOP"), and a final object indicating the existence of Event Contract products on that index ("secType":"EC"). This confirms we've found the necessary NQ index record.

From this response we should capture two new values:

1.  The index's conid ("conid":"11004958")
2.  From the "FOP" object, the semicolon-separated list of futures options Contract Months ("months":"AUG24;SEP24;OCT24;NOV24;DEC24;MAR25;JUN25;DEC25;DEC26;DEC27;DEC28")

Note that this response will deliver values related to derivative products which have been omitted above and can be ignored for the purposes of this workflow.

##### CME Request 2, Obtaining Event Contract Conids

Next, we'll want to search for records for tradable Event Contract instruments, using the newly obtained values from the first request.

This step will consist of a series of requests, stepping through the Contract Month values obtained via the first request.

Importantly, this query will return records for both futures options proper and Event Contracts, so we'll filter the response.

The following query take four parameters:

1.  Conid of underlying index (conid=11004958 for NQ)
2.  Name of the exchange (exchange=CME)
3.  Security Type of the instruments we're seeking (sectype=FOP, recalling that CME Event Contracts are modeled as futures options)
4.  Contract Month of interest, which restricts the scope of the query

The final parameter, Contract Month, is inherited from the futures options model, and valid values are obtained in the first request. Note however that this list of Contract Months is also shared by both futures options proper and Event Contracts, so some of the more distant Contract Month values may not return any tradable Event Contract instruments, and instead will fetch only true futures options.

    GET https://api.ibkr.com/v1/api/iserver/secdef/info?conid=11004958&exchange=CME&sectype=FOP&month=AUG24
    200 OK
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

The response will likely be quite large, including both futures options and Event Contracts. The above example is abridged to show only one example of a futures option and one Event Contract.

For CME Event Contract products, we can use the "EC" prefix discussed above to identify Event Contract instruments by their Trading Class and filter out futures options from this response.

As we are looking for NQ Event Contracts, we will filter for records with "tradingClass":"ECNQ" and obtain a set of NQ Event Contract records for the month of August 2024. We can now capture their conids and other associated attributes, and then proceed to make a request for the next Contract Month, SEP24, repeating the process for as many months as desired.

#### ForecastEx Discovery Workflow

Suppose we'd like to find ForecastEx's "US Fed Funds Target Rate" (FF) Event Contracts.

##### ForecastEx Request 1, Obtaining Index Conid and Contract Months

First, we'll want to capture the conid of the underlying artificial FF index.

    GET https://api.ibkr.com/v1/api/iserver/secdef/search?symbol=FF
    200 OK
    [
      {
        "conid": "658663572",
        "companyHeader": "US Fed Funds Target Rate - FORECASTX",
        "companyName": "US Fed Funds Target Rate",
        "symbol": "FF",
        "description": "FORECASTX",
        "restricted": null,
        "sections": [
          { "secType": "IND", "exchange": "FORECASTX;" },
          { "secType": "EC" }
        ]
      },
      ...
    ]

Note that we've received more than one matching result, and will need to filter for the desired ForecastEx FF index record.

From this response we should capture two new values:

1.  The FF index's conid ("conid":"658663572")
2.  The semicolon-separated list of options expiries ("opt": "20240917;20241106;...")

Before proceeding, we must convert the expiration dates to MMMYY format, as this presentation is used for future requests. For example, "20240917" becomes "SEP24".

##### ForecastEx Request 2, Obtaining Valid Strike Values

Next, we need to query for valid strike values.

    GET https://api.ibkr.com/v1/api/iserver/secdef/strikes?conid=658663572&exchange=FORECASTX&sectype=OPT&month=SEP24
    200 OK
    {
      "call": [ 3.125, 4.875, 5.125, 5.375 ],
      "put": [ 3.125, 4.875, 5.125, 5.375 ]
    }

Though separate lists are always returned for Calls (Yes contracts) and Puts (No contracts), we do not need treat them as distinct. All events have matching Yes and No contracts at all strikes. Therefore, we obtain a list of valid strikesvalues : 3.125, 4.875, 5.125, 5.375

##### ForecastEx Request 3, Obtaining Event Contract Conids

Finally, we'll make a series of queries for records for tradable Event Contract instruments.

To obtain all possible conids, we must make one request for each combination of Contract Month and Strike value. Note that it is possible that a given Strike value has no tradable Event Contracts in a given Contract Month, in which case the response will be empty.

Each request returns a pair of instrument records: a Call (Yes) contract record, and a Put (No) contract record.

    GET https://api.ibkr.com/v1/api/iserver/secdef/info?conid=658663572&exchange=FORECASTX&sectype=OPT&month=SEP24&strike=3.125
    200 OK
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

## Market Data

In order to retrieve top-of-book, depth-of-book, or historical market data from the Web API, the following must be available:

  - Username with relevant live market data subscriptions and permission to trade the desired instruments
  - Authorized Web API session
  - Brokerage session (access to IServer endpoints)

### Top-of-Book Snapshots

Top-of-book snapshots deliver up-to-date market data values sourced from the same streams as are displayed in Trader Workstation's watchlists.

##### **Values needed:**

  - Contract ID ("conid") for the desired instrument(s)
  - Tag identifiers for the desired data points ("fields")

A `GET` request to the `/iserver/marketdata/snapshot` [\[ref\]](https://ibkrcampus.com/ibkr-api-page/webapi-ref/#tag/Market-Data/paths/~1api~1v1~1iserver~1marketdata~1snapshot/get) endpoint is used to retrieve a snapshot of top-of-book market data for one or more instruments. This endpoint takes two required query parameters:

  - `conids`: A comma-separated list of instrument conids
  - `fields`: A comma-separated list of field tags. A comprehensive list of available tags can be found in our [Reference material](https://ibkrcampus.com/ibkr-api-page/webapi-ref/#tag/Market-Data/paths/~1api~1v1~1iserver~1marketdata~1snapshot/get).

In order for the desired data to be available for snapshotting on request, a "pre-flight" request must be made to IServer to begin its consumption of the instrument's live data stream.

This initial request will not deliver any data, but rather makes the stream available for future snapshot requests. Snapshot market data is not cached and is extracted directly from these open streams.

This pre-flight request should include in its `fields` parameter all of the tags desired in the future:

    GET https://api.ibkr.com/v1/api/iserver/marketdata/snapshot?conids=265598,8314&fields=31,7059,84,88,86,85

If this is the first time you've made a `/iserver/marketdata/snapshot` request for `conids` 265598 and 8314, you will not receive data in response. Instead you'll see the requested `conids` returned, indicating that IServer is now streaming data for these instruments.

    [
      {
        "conid": 265598,
        "conidEx": "265598"
      },
      {
        "conid": 8314,
        "conidEx": "8314"
      }
    ]

Once a pre-flight request has been made for a given `conid`, all requested `fields` will be delivered with all future responses; future snapshot requests do not need to repeat the desired `fields`:

    GET https://api.ibkr.com/v1/api/iserver/marketdata/snapshot?conids=265598,8314

Returns:

    [
      {
        "31": "168.42",
        "6119": "q1",
        "6509": "RpB",
        "7059": "100",
        "84": "168.41",
        "85": "600",
        "86": "168.42",
        "88": "1,300",
        "_updated": 1712596911593,
        "conid": 265598,
        "conidEx": "265598",
        "server_id": "q1"
      },
      {
        "31": "189.60",
        "6119": "q2",
        "6509": "RpB",
        "7059": "100",
        "84": "189.56",
        "85": "500",
        "86": "189.61",
        "88": "200",
        "_updated": 1712596911593,
        "conid": 8314,
        "conidEx": "8314",
        "server_id": "q2"
      }
    ]

Certain `fields` that update less frequently, particularly those that are computed on an interval, maybe not be delivered immediately, and instead will be returned when updated.

### Streaming Top-of-Book Data

To open a stream for live, top-of-book market data for an instrument, we write a message to the websocket in the following form:

    smd+CONID+{"fields":["field_1","field_2",...,"field_n"]}

The values in the `fields` array are the same field tags used in the HTTP request to `/iserver/marketdata/snapshot`. These field tag values must be passed as JSON strings, wrapped in double-quotes.

For example, we may send the following message to obtain streaming data for IBM stock, conid 8314.

    smd+8314+{"fields":["31","84","85","86","88","7059"]}

If successful, we will begin to receive response messages on websocket in the following format:

    {
      "31": "189.60",
      "6119": "q2",
      "6509": "RpB",
      "7059": "100",
      "84": "189.56",
      "85": "500",
      "86": "189.61",
      "88": "200",
      "_updated": 1712596911593,
      "conid": 8314,
      "conidEx": "8314",
      "server_id": "q2",
      "topic": "smd+8314"
    }

We may cancel a top-of-book stream on the websocket by sending:

    umd+CONID+{}

For example:

    umd+8314+{}

## Orders

All order-related functionality described below assumes the following are available:

  - Username with relevant relevant trading permissions
  - Authorized Web API session
  - Brokerage session (access to IServer endpoints)
  - Account ID of an account that can receive the order, and for which your username has trading permissions

### New Order Example

The following workflow describes the submission of a new order ticket.

##### **Values needed:**

  - Contract ID ("conid") for the desired instrument(s)
  - Your desired order handling instructions

A `POST` request to the `/iserver/account/{accountId}/orders` endpoint is used to submit a new order ticket to the account referenced by `{accountId}` in the path. This endpoint takes one required path parameter:

  - `accountId`: The account ID of the account to which the order will be placed.

This endpoint also requires a JSON body. The specific keys required to successfully submit a given order ticket will vary depending on a variety of factors, including order type. More information on the construction of order tickets can be found on our Order Types page.

However, at a minimum, any new order ticket submitted via the Web API will require in its body:

  - `conid`: The instrument's conid
  - `orderType`: The Order Type of the new order ticket
  - `side`: The side of the order being placed (e.g., "BUY" or "SELL")
  - `tif`: Time in force, the duration for which the order will work.
  - `quantity`: A number of units of the instrument

Please consult our Reference Material for a list of all JSON keys available when submitting new order tickets.

Suppose we have trading permissions for account DU123456. We'd like submit a new order to this account to buy 100 shares of AAPL, with a limit price of USD 165, to work for the remainder of today's regular trading hours (an unmodified "day" order).

First we must have obtained IB's conid for AAPL stock, trading in the US in USD, which is 265598. We must also know how to represent our desired handling instructions to the Web API:

  - A buy order is `"side":"BUY"`
  - A quantity of 100 shares is `"quantity":100`
  - A limit order is `"orderType":"LMT"`
  - A limit price of USD 165 is `"price":165`
  - A day order is `"tif":"DAY"`
  - And finally, AAPL's conid is `"conid":265598`

Note that both the keys and values above are case-sensitive.

Care must also be taken to ensure the correct JSON data types are used, as detailed in our Reference Material. We may then construct the following request:

    POST https://api.ibkr.com/v1/api/iserver/account/DU123456/orders
    [
      {
        "conid": 265598,
        "side": "BUY",
        "orderType": "LMT",
        "price": 165,
        "quantity": 100,
        "tif": "DAY"
      }
    ]

Note also that the body of this POST request requires a JSON array containing the order ticket object. This array is used to submit order brackets, as detailed below. For now, we will submit only a single order ticket by way of a single object element in this array.

If we are successful in submitting our order, we will receive a response that includes an `order_id` value that can be used to keep track of the status of the order, as well as an indication of its current status at the time of submission:

    {
      "order_id": "987654",
      "order_status": "Submitted",
      "encrypt_message": "1"
    }

### Order Reply Messages

In some cases the response to an order submission request might not deliver an acknowledgment.

Instead, it might contain an "order reply message" -- essentially a notice -- which must be confirmed via a second request before our order ticket can go to work.

The receipt of such an "order reply message" does not indicate that the order is rejected or otherwise encountered a problem. Rather, IB requires explicit confirmation of some element of the order ticket, or some aspect of our subsequent handling, before we can seek the order's execution.

Very often these messages pertain to precautionary settings that are client-configurable for a given username -- effectively "fat finger" protections that you can adjust or remove if desired:

    [
      {
        "id": "07a13a5a-4a48-44a5-bb25-5ab37b79186c",
        "message": [
          "The following order \"BUY 100 AAPL NASDAQ.NMS @ 165.0\" price exceeds \nthe Percentage constraint of 3%.\nAre you sure you want to submit this order?"
        ],
        "isSuppressed": false,
        "messageIds": [
          "o163"
        ]
      }
    ]

Aside from the content of the message, there are two important values delivered in such an "order reply" response.

First, we have an `id`, which uniquely identifies the emitted message. Via the `/iserver/reply/{messageId}` endpoint, we can use this `id` value to dismiss the message and put our order to work:

    POST https://api.ibkr.com/v1/api/iserver/reply/a12b34c5-d678-9e012f-3456-7a890b12cd3e
    {
      "confirmed":true
    }

The above request requires a JSON body containing `{"confirmed":true}`, which is an instruction to IB that the message has been received, and you would like to continue with your order.

Provided the order can be accepted and put to work, the response to your `/iserver/reply/{messageId}` request will be an order acknowledgement response as shown above:

    {
      "order_id": "1234567890",
      "order_status": "Submitted",
      "encrypt_message": "1"
    }

Another important value (or set of values) to capture from order message response is `messageIds`, as in `"messageIds": ["o163"]` above.

These `messageIds` strings categorize varieties of order reply messages. You can use these IDs to suppress certain types of order reply messages for the remainder of your username's current Web API brokerage session.

Please see the Suppressing Order Reply Messages section for more detail.

### Order Reply Suppression

The following response to an order ticket submission indicates that we must confirm some aspect of our order ticket before it will be accepted:

    [
      {
        "id": "07a13a5a-4a48-44a5-bb25-5ab37b79186c",
        "message": [
          "The following order \"BUY 100 AAPL NASDAQ.NMS @ 165.0\" price exceeds \nthe Percentage constraint of 3%.\nAre you sure you want to submit this order?"
        ],
        "isSuppressed": false,
        "messageIds": [
          "o163"
        ]
      }
    ]

We call these messages "order reply messages".

The `"messageIds"` array contains identifiers that categorize the type of order reply message we've received. In this case, we've received `"messageIds": ["o163"]`.

Certain types of order reply messages may be suppressed for the duration of your username's current Web API brokerage session.

When a category of order reply messages is suppressed, you will no longer be sent order reply message responses requiring confirmation. Instead, a valid order ticket will be accepted and acknowledged immediately. Invalid order tickets will be rejected.

The `/iserver/questions/suppress` endpoint provides this suppression mechanism. You may `POST` an array of `messageIDs` to suppress those order message types for the remainder of the Web API brokerage session:

    POST https://api.ibkr.com/v1/api/iserver/questions/suppress
    {
      "messageIds": [
        "o163"
      ]
    }

The response will confirm their suppression:

    {
      "status": "submitted"
    }

You do not need to have received a given messageID value previously in order to suppress it.

We recommend that you submit this list of messages to be suppressed at the beginning of your brokerage session, prior to conducting any trading.

If you would like to suppress a new type of message while trading, please resend the complete array of `messageIds`.

You may also undo all suppression of messages within your current brokerage session:

    POST https://api.ibkr.com/v1/api/iserver/questions/suppress/reset

And the response will confirm the restoration of delivery of all messages generated during order submission:

    {
      "status": "submitted"
    }

### Modifying Orders

The following example describes the submission of a request to modify an existing, unfilled order ticket.

##### **Values needed:**

  - All previously submitted order handling instructions, including the instrument's conid
  - The orderId of the order ticket to be modified

A `POST` request to the `/iserver/account/{accountId}/order/{orderId}` endpoint is used to submit a request to modify the order ticket referenced by `{orderId}` in the account `{accountId}`. This endpoint takes two required path parameters:

  - `accountId`: The account ID to which the unfilled order belongs.
  - `orderId`: The orderId of the order ticket to be modified.

This endpoint also requires a JSON body. This JSON body must be a single JSON object (note: not an array) containing all of the attributes and handling instructions of the original order ticket.

All JSON keys from the initial order submission must be present, and all JSON values must also be the same, except for the value(s) you seek to modify.

Note that order modification can be subject to different sets of market rules compared to new order submission. Our /iserver/secdef/rules endpoint can be used to inspect the ruleset enforced on a modification.

Suppose we have an active, unfilled order with orderId 987654 belonging to account DU123456, originally submitted with the following handling instructions:

    [
      {
        "conid": 265598,
        "side": "BUY",
        "orderType": "LMT",
        "price": 165,
        "quantity": 100,
        "tif": "DAY"
      }
    ]

We'd like to change the limit price of this order from 165 to 170. To do so, we send the following request:

    POST https://api.ibkr.com/v1/api/iserver/account/DU123456/order/987654`
    {
      "conid": 265598,
      "side": "BUY",
      "orderType": "LMT",
      "price": 170,
      "quantity": 100,
      "tif": "DAY"
    }

Note first that order modification addresses only a single order per request. Therefore, this request does not use a JSON array as a container for the modified order ticket object. Instead, the modified order ticket object is the entirety of the request body.

Additionally, we must ensure that all other attributes of the order ticket, aside from the value being altered, are identical to the current, pre-modification attributes of the existing order ticket.

While it should be sufficient to store the contents of a successfully submitted new order ticket client-side, we may also inspect the contents of an existing order ticket with the Order Status endpoint, `/iserver/account/{accountId}/order/status/{orderId}`.

A successful order modification will return a response similar to a successful new order submission:

    {
      "order_id": "987654",
      "order_status": "Submitted",
      "encrypt_message": "1"
    }

Alternatively, we may also receive an order reply message, as described above.

### Canceling Orders

##### **Values needed:**

  - The orderId of the order ticket to be canceled

A `DELETE` request to the `/iserver/account/{accountId}/order/{orderId}` endpoint is used to submit a request cancel the order ticket referenced by `{orderId}` in the account `{accountId}`. This endpoint takes two required path parameters:

  - `accountId`: The account ID to which the unfilled order belongs.
  - `orderId`: The orderId of the order ticket to be modified.

The `DELETE` method of this endpoint does not accept any JSON body. To cancel an order with `orderId` 987654, we send the following request:

    DELETE https://api.ibkr.com/v1/api/iserver/account/DU123456/order/987654

A successful request for order cancellation returns a message that our request has been received:

    {
        "msg": "Request was submitted",
        "order_id": 987654,
        "conid": 265598,
        "account": "DU123456"
    }

Note that the above response indicates our request to cancel order 987654 was received, but not that the order ticket itself has been canceled. It is possible that an order working at an exchange or other external venue cannot be canceled, for instance, as a result of auction-related deadlines.

### Submitting Bracket Orders

Bracket orders can be submitted together in a single request.

The parent order is assigned an arbitrary identifier via the `cOID` (client order ID) field, and this same value is then used to link the child orders to the parent via the `parentId` field, establishing the conditional relationship.

    {
      "orders": [
        {
          "acctId": "U1234567",
          "conid": 265598,
          "cOID": "Parent",
          "orderType": "MKT",
          "listingExchange": "SMART",
          "outsideRTH": true,
          "side": "Buy",
          "referrer": "QuickTrade",
          "tif": "GTC",
          "quantity": 50
        },
        {
          "acctId": "U1234567",
          "conid": 265598,
          "orderType": "STP",
          "listingExchange": "SMART",
          "outsideRTH": false,
          "price": 157.30,
          "side": "Sell",
          "tif": "GTC",
          "quantity": 50,
          "parentId": "Parent"
        },
        {
          "acctId": "U1234567",
          "conid": 265598,
          "orderType": "LMT",
          "listingExchange": "SMART",
          "outsideRTH": false,
          "price": 157.00,
          "side": "Sell",
          "tif": "GTC",
          "quantity": 50,
          "parentId": "Parent"
        }
      ]
    }

### Orders for Combos/Spreads

Combo or spread orders may be submitted using the same `/iserver/account/{accountId}/orders` endpoint described above. In the case of combo orders, we must include the `conidex` field in our request body instead of `conid`. The `conidex` field is a string representation of our combo order's composition.

A combo order's `conidex` value takes the following form: `{spread_conid};;;{leg_conid1}/{ratio},{leg_conid2}/{ratio}`

The `spread_conid` value is a unique identifier associated with the currency in which the combo's legs trade. For US Stock Combos, the `spread_conid` value will the the USD conid integer by itself. For combo orders in all other currencies, `spread_conid` takes the form `spread_conid@exchange`.

*Available currency spread `conids`:*

|          |              |
| -------- | ------------ |
| Currency | Spread ConID |
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

The `spread_conid` is followed by three semicolons, and then the first leg's `leg_conid`. Next, a forward slash `/`, followed by the *ratio* of the preceding leg.

The ratio value conveys two pieces of information. The first is the side, buy or sell, of the leg, indicated by the sign of the ratio value, positive or negative. A positive ratio integer indicates a Buy, while a negative ratio integer represents a Sell. The second piece of information is the relative size of the leg in the combo, indicated by the integer magnitude itself. This magnitude acts as a multiplier when placing an order for the overall combo instrument.

Additional legs are separated by commas, and follow the same pattern as above: `{leg_conid}/{ratio}`.

Please be aware that the number of legs permissible in a single combo order varies by exchange.

Combo orders are priced by summing the per-leg prices, taking into account the side of each leg: `Combo order price = (Price_Leg1 * Ratio_Leg1) + (Price_Leg2 * Ratio_Leg2) + ... + (Cost_LegN * Ratio_LegN)`

### Monitoring Live Orders <span id="order-monitoring"></span>

The `/iserver/account/orders` endpoint is used to retrieve the status of all recently open orders in a given account. This includes orders currently working as well as those cancelled or filled within the same brokerage session.

Example request:

    GET https://api.ibkr.com/v1/api/iserver/account/orders?filters=filled&force=true&accountId=U1234567

Successful response:

    {
      "orders": [
        {
          "acct": "U1234567",
          "conidex": "265598",
          "conid": 265598,
          "account": "U1234567",
          "orderId": 1234568790,
          "cashCcy": "USD",
          "sizeAndFills": "5",
          "orderDesc": "Sold 5 Market, GTC",
          "description1": "AAPL",
          "ticker": "AAPL",
          "secType": "STK",
          "listingExchange": "NASDAQ.NMS",
          "remainingQuantity": 0.0,
          "filledQuantity": 5.0,
          "totalSize": 5.0,
          "companyName": "APPLE INC",
          "status": "Filled",
          "order_ccp_status": "Filled",
          "avgPrice": "192.26",
          "origOrderType": "MARKET",
          "supportsTaxOpt": "1",
          "lastExecutionTime": "231211180049",
          "orderType": "Market",
          "bgColor": "#FFFFFF",
          "fgColor": "#000000",
          "order_ref": "Order123",
          "timeInForce": "GTC",
          "lastExecutionTime_r": 1702317649000,
          "side": "SELL"
        }
      ],
      "snapshot": true
    }

## Portfolio and Positions <span id="portfolio-positions"></span>

### Querying Your Accounts <span id="querying-accounts"></span>

In non-tiered account structures, the `/portfolio/accounts` endpoint returns a list of accounts for which the user can view position and account information.

This endpoint must be called prior to calling other `/portfolio` endpoints for those accounts.

For querying a list of accounts which the user can trade, see `/iserver/accounts`. For a list of subaccounts in tiered account structures (e.g. financial advisor or ibroker accounts) see `/portfolio/subaccounts`.

Example request:

    GET https://api.ibkr.com/v1/api/portfolio/accounts

Successful response:

    [
      {
        "id": "U1234567",
        "PrepaidCrypto-Z": false,
        "PrepaidCrypto-P": false,
        "brokerageAccess": true,
        "accountId": "U1234567",
        "accountVan": "U1234567",
        "accountTitle": "",
        "displayName": "U1234567",
        "accountAlias": null,
        "accountStatus": 1644814800000,
        "currency": "USD",
        "type": "DEMO",
        "tradingType": "PMRGN",
        "businessType": "IB_PROSERVE",
        "ibEntity": "IBLLC-US",
        "faclient": false,
        "clearingStatus": "O",
        "covestor": false,
        "noClientTrading": false,
        "trackVirtualFXPortfolio": true,
        "parent": {
          "mmc": [],
          "accountId": "",
          "isMParent": false,
          "isMChild": false,
          "isMultiplex": false
        },
        "desc": "U1234567"
      }
    ]

In multi-level account structures (such as Financial Advisor and IBroker accounts), the `/portfolio/subaccounts` endpoint returns a list of up to 100 subaccounts for which the user can view position and account-related information.

This endpoint must be called prior to calling other `/portfolio` endpoints for those subaccounts.

If you have more than 100 subaccounts use `/portfolio/subaccounts2`. To query a list of accounts the user can trade, see `/iserver/accounts`.

Example request:

    GET https://api.ibkr.com/v1/api/portfolio/subaccounts

Successful response:

    [
      {
        "id": "U1234567",
        "PrepaidCrypto-Z": false,
        "PrepaidCrypto-P": false,
        "brokerageAccess": false,
        "accountId": "U1234567",
        "accountVan": "U1234567",
        "accountTitle": "",
        "displayName": "U1234567",
        "accountAlias": null,
        "accountStatus": 1644814800000,
        "currency": "USD",
        "type": "DEMO",
        "tradingType": "PMRGN",
        "businessType": "IB_PROSERVE",
        "ibEntity": "IBLLC-US",
        "faclient": false,
        "clearingStatus": "O",
        "covestor": false,
        "noClientTrading": false,
        "trackVirtualFXPortfolio": true,
        "parent": {
          "mmc": [],
          "accountId": "",
          "isMParent": false,
          "isMChild": false,
          "isMultiplex": false
        },
        "desc": "U1234567"
      }
    ]

### Querying Currency Balances <span id="portfolio-ledger"></span>

The `/portfolio/{accountId}/ledger` endpoint delivers information regarding cash balances, organized by currency.

Example request:

    GET https://api.ibkr.com/v1/api/portfolio/{accountId}/ledger

Successful response:

    {
      "USD": {
        "commoditymarketvalue": 0.0,
        "futuremarketvalue": -1051.0,
        "settledcash": 214716688.0,
        "exchangerate": 1,
        "sessionid": 1,
        "cashbalance": 214716688.0,
        "corporatebondsmarketvalue": 0.0,
        "warrantsmarketvalue": 0.0,
        "netliquidationvalue": 215335840.0,
        "interest": 305569.94,
        "unrealizedpnl": 39695.82,
        "stockmarketvalue": 314123.88,
        "moneyfunds": 0.0,
        "currency": "USD",
        "realizedpnl": 0.0,
        "funds": 0.0,
        "acctcode": "U1234567",
        "issueroptionsmarketvalue": 0.0,
        "key": "LedgerList",
        "timestamp": 1702582321,
        "severity": 0,
        "stockoptionmarketvalue": -2.88,
        "futuresonlypnl": -1051.0,
        "tbondsmarketvalue": 0.0,
        "futureoptionmarketvalue": 0.0,
        "cashbalancefxsegment": 0.0,
        "secondkey": "USD",
        "tbillsmarketvalue": 0.0,
        "endofbundle": 1,
        "dividends": 0.0
      },
      "BASE": {
        "commoditymarketvalue": 0.0,
        "futuremarketvalue": -1051.0,
        "settledcash": 215100080.0,
        "exchangerate": 1,
        "sessionid": 1,
        "cashbalance": 215100080.0,
        "corporatebondsmarketvalue": 0.0,
        "warrantsmarketvalue": 0.0,
        "netliquidationvalue": 215721776.0,
        "interest": 305866.88,
        "unrealizedpnl": 39907.37,
        "stockmarketvalue": 316365.38,
        "moneyfunds": 0.0,
        "currency": "BASE",
        "realizedpnl": 0.0,
        "funds": 0.0,
        "acctcode": "U1234567",
        "issueroptionsmarketvalue": 0.0,
        "key": "LedgerList",
        "timestamp": 1702582321,
        "severity": 0,
        "stockoptionmarketvalue": -2.88,
        "futuresonlypnl": -1051.0,
        "tbondsmarketvalue": 0.0,
        "futureoptionmarketvalue": 0.0,
        "cashbalancefxsegment": 0.0,
        "secondkey": "BASE",
        "tbillsmarketvalue": 0.0,
        "dividends": 0.0
      }
    }

### Querying Equity and Margin <span id="portfolio-summary"></span>

The `/portfolio/{accountId}/summary` endpoint delivers a wide variety of values related to an account's equity, margin use, and accrued balances.

Values are presented in aggregate form for the entire U-account ("universal account"), as well as diasaggregated by the account's underlying regulatory segments (for instance, the securities segment versus commodities segment, which holds futures products).

Example request:

    GET https://api.ibkr.com/v1/api/portfolio/{accountId}/summary

Successful response:

    {
      "accountcode": {
        "amount": 0.0,
        "currency": null,
        "isNull": false,
        "timestamp": 1702582422000,
        "value": "U1234567",
        "severity": 0
      },
      ...,
      "indianstockhaircut": {
        "amount": 0.0,
        "currency": "USD",
        "isNone": false,
        "timestamp": 1702582422000,
        "value": null,
        "severity": 0
      }
    }

## FYIs and Alerts

### Types of Notification Messages

  - FYIs
      - Disclaimers
  - Alerts
      - Mobile Trading Alerts
  - Bulletins

### FYIs

#### Unread FYIs

To get number of un-read notifications/disclaimers next api should be called `GET /fyi/unreadnumber` which return integer number that can be display to make user aware. For example, let's assume we have `1` un-read and `3` in total notifications/disclaimers.

    GET https://api.ibkr.com/v1/api/fyi/unreadnumber

Response:

    {
      "BN":  1
    }

#### All Recent FYIs

A list of all recent notifications can be retrieved by calling `GET /fyi/notifications`. An `R` in the response indicates if the notification was read or not.

The response also contains a title (`MS`), notification code/"FYI code" (`FC`), unique identifier (`ID`) and a detailed, HTML-formatted message (`MD`).

    GET https://api.ibkr.com/v1/api/fyi/notifications

Returns:

    [
      {
        "R": 0,
        "D": "1710847062.0",
        "MS": "FYI: Changes in Analyst Ratings",
        "MD": "<html>Some investors use analysts ratings to stay informed about their investments. Analysts have changed their ratings for one or more companies in which you hold positions.    <br />The following summary displays the affected companies, the current number of analysts by rating category and, in parentheses, the recent change in the number of analysts rating the company within each rating category.  <br /> - JWN@NYSE: Buy: 1(0), Outperform: 1(0), Hold: 12(-1), Underperform: 5(0), Sell: 0(0). Held in: D****000 <br /> - RF@NYSE: Buy: 4(+1), Outperform: 5(0), Hold: 17(-1), Underperform: 1(0), Sell: 0(0). Held in: D****000 <br /> <br />   Note: Current ratings are from Reuters and may not reflect all rating changes from other sources such as Street Insider and Briefing.</html>",
        "ID": "2024031947509444",
        "HT": 0,
        "FC": "PF"
      },
    ...
    ]

#### Marking FYIs Read

FYI notifications can be marked as read via `PUT /fyi/notifications/{notificationID}`.

Please note that you can have multiple notifications in the same category (grouped by `fyi code`)

#### Managing FYI Subscriptions

    GET https://api.ibkr.com/v1/api/fyi/settings

    [
      {
        "FC": "PF",
        "H": 0,
        "A": 1,
        "FD": "Notify me of recent activity affecting my portfolio holdings.",
        "FN": "Portfolio FYIs"
      },
      {
        "FC": "PT",
        "H": 0,
        "A": 1,
        "FD": "Notify me of potential account configuration changes needed and useful features based on my position transfers.",
        "FN": "Position Transfer"
      } 
    ]

#### FYI Disclaimers

Detailed message for notification must be shown to user only when user accept corresponding disclaimer.

Use `GET /fyi/settings` to see what disclaimers accepted and what not. `H` represents fact of disclaimer acceptance. More about fyi settings will be below.

    [
      {
        "FC": "PF",
        "H": 0,
        "A": 1,
        "FD": "Notify me of recent activity affecting my portfolio holdings.",
        "FN": "Portfolio FYIs"
      },
      {
        "FC": "PT",
        "H": 0,
        "A": 1,
        "FD": "Notify me of potential account configuration changes needed and useful features based on my position transfers.",
        "FN": "Position Transfer"
      } 
    ]

Supplemental text for accept disclaimer can be retrieved by calling `GET /fyi/disclaimer/{typecode}`

    {
      "FC": "PF",
      "DT": "This communication is provided for information purposes only and is not intended as a recommendation or a solicitation to buy, sell or hold any investment product. Customers are solely responsible for their own trading decisions."
    }

And call `PUT /fyi/disclaimer/{typecode}` to accept disclaimer. Once disclaimer is acknowledged, it should not be forced on notifications of the same type.

View our Web API Account Management documentation here.

[Web API Account Management Documentation](/campus/ibkr-api-page/web-api-account-management/#introduction-0)
