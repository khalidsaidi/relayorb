# Web API Documentation

## Introduction

Interactive Brokers is merging our web-based API products into a single, comprehensive IBKR Web API, bringing the features of the Client Portal Web API, Digital Account Management, and the Flex Web Service together in a unified interface, accessible by a shared means of authorization and authentication: OAuth 2.0.

Existing endpoints and authentication schemes are not deprecated and will continue to receive features and updates. Rather, we look forward to providing our clients with a new, coordinated set of endpoints exposing the same backend resources. To support this orchestration, the documentation below addresses the functionality of the Client Portal Web API, Digital Account Management, and the Flex Web Service side by side under the Web API umbrella.

Additionally, we have reorganized our development resources into two sections:

  - **Documentation:** Long-form, workflow-oriented material located on this page.

  - **Reference:** Per-endpoint API definitions, presented in a Swagger interface. We apologize that not all endpoints in our Web API are currently included in this Reference. We are working to expand its contents, and they will be available shortly.

## Feedback

Have feedback on our Web API documentation or reference material?

Email us at <API-Feedback@interactivebrokers.com>.

We value your suggestions, ideas, and feedback in order to continuously improve our API solutions.

*This is an automated feedback inbox and unfortunately, we will not be actively responding from this email. However, if you need a specific answer or additional support, please contact our [API Support team](https://ibkrcampus.com/api/webapi-doc/#help) or [access our general support](https://www.interactivebrokers.com/en/support/customer-service.php). Current or prospective institutional clients may also [contact their sales representative](https://www.interactivebrokers.com/en/support/institutions.php).*

## Getting Started

Clients with fully open and funded accounts may use our Web API to interact with their accounts immediately, without any onboarding or approval process.

However, our Web API offers several methods of authentication, some of which do require approval or configuration prior to use.

Additionally, certain sets of features of the Web API, such as Account Registration and Funds and Banking, are not available to all account types and also require configuration by our Sales Engineering team prior to use.

### Web API Access for Organizations

Enterprise and Institutional clients have several methods of authorization and authentication at their disposal. All methods permit requests to be made directly to Interactive Brokers' infrastructure.

Please also note that our Web API consists of two broad feature sets, *Trading* and *Account Management*. While the Trading functionality is available to all accountholders, certain Account Management features may not be applicable or available to a given account structure, and they require require approval and onboarding before use.

Please contact your [Sales Representative](https://www.interactivebrokers.com/en/support/institutional-sales-contacts.php) for an introduction to this onboarding process.

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

### Web API Access for Individuals

Web API usage for individual clients involves an IBKR username and password.

Whether accessing a live account or its associated simulated paper account, the live account must be fully open and funded. The live account must also be of the "IBKR Pro" type.

If you do not already have an account, you can [create one for free](https://www.interactivebrokers.com/en/index.php?f=46380#open-account).

### Web API Access for Third Parties

Interactive Brokers identifies third-party developers as vendors of software that would interact with IB client accounts to which the vendor has no formal relationship or access within IB. This is in contrast to an advisor or introducing broker who maintains an account structure with IB and formally manages client accounts.

Third-party vendors may currently only seek approval for the use of OAuth1.0a.

Third-party vendors must be receive Compliance approval for their product offerings before integration can proceed.

The third-party approval process begins with our third-party onboarding form, which can be submitted to <webapionboarding@interactivebrokers.com>. Please note that vendors are expected to have an established business entity and a public presence online with material describing their offering. Proof of concept builds to demonstrate intended functionality are strongly encouraged as well. The onboarding process typically proceeds as follows:

1.  Our onboarding team conducts the initial screening. Estimated time to complete this step is 2-3 weeks. If our onboarding team is able to proceed with your request for approval, they will send your application to our Compliance team for review.
2.  IBKR Compliance conducts an enhanced due diligence review on all third-party applicants, followed by a three-tier approval process. Estimated time to complete Compliance-related reviews and tasks is 3-6 weeks.
3.  If Compliance grants approval, our Legal team will generate a Web API agreement which will be relayed to you for review and signature. In parallel, our third-party onboarding team will ask you to provide public keys and a callback URL in support of the configuration of your OAuth1.0a consumer. Detailed instructions for this process will be provided once this stage is reached. Estimated time for IB complete our portions of the aforementioned process is 3-5 weeks.

The above timelines are estimates and can vary. We recommend providing as much information as possible up front. Not doing so can extend timelines.

During the enhanced due diligence reviews conducted by our Compliance teams, they will expect vendors to have a completed website with finalized details of the product offering. This typically includes a clear user workflow for all components and descriptions of their functionality and capabilities.

Should Compliance approval be reached for your product offering, any significant changes to the offering following approved (such as the addition of trading functionality) would require additional review and approval from our Compliance teams before being offered to IBKR clients.

Please be aware we expect third-party vendors offering automated trading solutions to hold applicable registration with financial authorities in all regions they plan to service, unless the vendor is able to provide support (i.e., a legal opinion) as to why the proposed service would not require registration in a given location. Additionally, the offering will need to be reviewed and approved by Compliance teams in all regions in which you intend to serve IBKR clients.

## Usage and Support

### Contacting API Support

Interactive Brokers always welcomes users to contact customer support in the event of API behavior issues. To help expedite the troubleshooting process for customers, it is encouraged to first consider the following:

  - Does this issue persist in other platforms? Am I receiving errors with an order even when performing the same action in Trader Workstation rather than through the API?
  - Did the request match the Required parameters from the documentation?
  - Were documentation or guides consulted on the matter prior?
  - How long has this issue been going on? Is the error on the first attempt, or has this request been working for days prior?
  - Do other, similar requests work as expected?

Interactive Brokers offers several contact methods based on your needs. The buttons below link directly to the associated channels.

  - [Create a Support Ticket](https://www.interactivebrokers.com/en/general/contact/newContact/contact.php)
  - [Chat Live with API Support](https://www.interactivebrokers.com/en/support/customer-service.php?p=chat)
  - [Get Help by Phone](https://www.interactivebrokers.com/en/support/customer-service.php?p=contact)

### Scheduled Server Maintenance

Interactive Brokers conducts scheduled maintenance on the infrastructure that serves the Web API. During maintenance windows, some features of the Web API are momentarily unavailable.

The timing of the Web API's maintenance windows vary slightly from the those observed in other platforms, such as Trader Workstation.

The Web API itself is accessible 24 hours a day during the week. It receives maintenance only on Saturday evenings.

Brokerage functionality (provided by `/iserver` endpoints) is briefly unavailable each evening at approximately 0100 local time by region.

#### *Weekday IServer Reset Timing*

| Region | Maintenance Onset | | :---------- | :--------- | | North America  
*(NY and Chicago)* | 01:00 US/Eastern | | Europe | 01:00 CEST | | Asia | 01:00 HKT |

### Pacing Limitations

Interactive Brokers currently enforces a global request rate limit of 10 requests per second for each authenticated username -- that is, each Web API session.

Users making requests via the CP Gateway tool are restricted to 10 requests per second.

Additionally, some endpoints are also subject to their own pacing limits as described in the table below.

When a rate limit is exceeded, the Web API will return a `429 Too Many Requests` status code.

Violator IP addresses may be put in a penalty box for 10 minutes. After this period, the IP address is removed from the penalty box. Repeat violator IP addresses may be permanently blocked until the issue is resolved.

#### *Per-Endpoint Request Rate Limits*

| Endpoint | Method | Limit | | :---------------------------------- | :----: | :-------------------- | | /iserver/marketdata/snapshot | GET | 10 req/s | | /iserver/scanner/params | GET | 1 req/15 mins | | /iserver/scanner/run | POST | 1 req/sec | | /iserver/trades | GET | 1 req/5 secs | | /iserver/orders | GET | 1 req/5 secs | | /iserver/account/pnl/partitioned | GET | 1 req/5 secs | | /portfolio/accounts | GET | 1 req/5 secs | | /portfolio/subaccounts | GET | 1 req/5 secs | | /pa/performance | POST | 1 req/15 mins | | /pa/summary | POST | 1 req/15 mins | | /pa/transactions | POST | 1 req/15 mins | | /fyi/unreadnumber | GET | 1 req/sec | | /fyi/settings | GET | 1 req/sec | | /fyi/settings/{typecode} | POST | 1 req/sec | | /fyi/disclaimer/{typecode} | GET | 1 req/sec | | /fyi/disclaimer/{typecode} | PUT | 1 req/sec | | /fyi/deliveryoptions | GET | 1 req/sec | | /fyi/deliveryoptions/email | PUT | 1 req/sec | | /fyi/deliveryoptions/device | POST | 1 req/sec | | /fyi/deliveryoptions/{deviceId} | DELETE | 1 req/sec | | /fyi/notifications | GET | 1 req/sec | | /fyi/notifications/more | GET | 1 req/sec | | /fyi/notifications/{notificationId} | PUT | 1 req/sec | | /tickle | GET | 1 req/sec | | /sso/validate | GET | 1 req/min |

#### *Additional Usage Limits*

| Endpoint | Method | Limit | | :---------------------------------- | :----: | :-------------------- | | /trsv/secdef | POST | 200 conids/request | | /iserver/marketdata/history | GET | 5 concurrent requests |

## Sessions in the Web API

Access to Trading functionality in the Web API entails the creation of a trading-enabled *brokerage session*.

A brokerage session is associated with an IB *username* (your credentials), which in turn has trading permissions for one or more *accounts* (the actual pools of equity).

A single username can only have one brokerage session active at a time across all IB platforms.

Permissions for trading in general, for specific asset classes, market data subscriptions (and thus access to the subscribed feeds), etc. are carried by IB usernames, not the underlying accounts. Hence references to brokerage sessions refer to a logged-in username that is in contact with IBKR's backend trading infrastructure.

Though Interactive Brokers permits a username only one brokerage session at any given time, some of the Web API's Trading functionality is accessible without a brokerage session. This allows a username's active brokerage session to continue elsewhere undisturbed.

We typically refer to these non-brokerage features as the "read-only" subset of the Trading portion of the Web API. Examples of read-only features include retrieval of portfolio data and certain instrument search tools. When trading with the Web API, sessions can therefore be thought of as two-tiered:

1.  An "outer" prerequisite *read-only session* that is required to be active/valid in order to make any CP Web API request, though by itself it only permits access to non-`/iserver` endpoints.
2.  The *brokerage session*, established after the read-only, that permits access to trading, consumption of market data, and all other functionality behind `/iserver` endpoints.

## Cookie Management

Authenticating with OAuth 1.0a and OAuth 2.0 requires client-side cookie management.

A cookie with the Interactive Brokers Web API requires users make a request to the `/tickle` endpoint and capture the session token. The session token should then be added as a cookie in the format `"api={session_token}"` such that the end result will appear like `{"Cookie": "api=c8fh17fnjr01hfnrh39rhfh8shd1hd93"}`.

Upon session termination either passively or through `/logout`, client-side cookies must be discarded.

## Instrument Discovery

Documentation coming soon.

## Market Data

In order to retrieve top-of-book, depth-of-book, or historical market data from the Web API, the following must be available:

  - Username with relevant live market data subscriptions and permission to trade the desired instruments
  - Authorized Web API session
  - Brokerage session (access to IServer endpoints)

### Top-of-Book Snapshots

Top-of-book snapshots deliver up-to-date market data values sourced from the same streams as are displayed in Trader Workstation's watchlists.

#### **Values needed:**

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

#### **Values needed:**

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
      "confirmed": true
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

### Order Rejections

Documentation coming soon.

### Previewing Orders

Documentation coming soon.

### Modifying Orders

The following example describes the submission of a request to modify an existing, unfilled order ticket.

#### **Values needed:**

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

    POST https://api.ibkr.com/v1/api/iserver/account/DU123456/order/987654
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

#### **Values needed:**

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

Documentation coming soon.

### Orders for Combos/Spreads

Combo or spread orders may be submitted using the same `/iserver/account/{accountId}/orders` endpoint described above. In the case of combo orders, we must include the `conidex` field in our request body instead of `conid`. The `conidex` field is a string representation of our combo order's composition.

A combo order's `conidex` value takes the following form: `{spread_conid};;;{leg_conid1}/{ratio},{leg_conid2}/{ratio}`

The `spread_conid` value is a unique identifier associated with the currency in which the combo's legs trade. For US Stock Combos, the `spread_conid` value will the the USD conid integer by itself. For combo orders in all other currencies, `spread_conid` takes the form `spread_conid@exchange`.

##### *Available currency spread `conids`:*

|Currency|Spread ConID| |--- |--- | |AUD|61227077| |CAD|61227082| |CHF|61227087| |CNH|136000441| |GBP|58666491| |HKD|61227072| |INR|136000444| |JPY|61227069| |KRW|136000424| |MXN|136000449| |SEK|136000429| |SGD|426116555| |USD|28812380|

The `spread_conid` is followed by three semicolons, and then the first leg's `leg_conid`. Next, a forward slash `/`, followed by the *ratio* of the preceding leg.

The ratio value conveys two pieces of information. The first is the side, buy or sell, of the leg, indicated by the sign of the ratio value, positive or negative. A positive ratio integer indicates a Buy, while a negative ratio integer represents a Sell. The second piece of information is the relative size of the leg in the combo, indicated by the integer magnitude itself. This magnitude acts as a multiplier when placing an order for the overall combo instrument.

Additional legs are separated by commas, and follow the same pattern as above: `{leg_conid}/{ratio}`.

Please be aware that the number of legs permissible in a single combo order varies by exchange.

Combo orders are priced by summing the per-leg prices, taking into account the side of each leg: `Combo order price = (Price_Leg1 * Ratio_Leg1) + (Price_Leg2 * Ratio_Leg2) + ... + (Cost_LegN * Ratio_LegN)`

### Monitoring Live Orders

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

### Monitoring Executions

Documentation coming soon.

## Portfolio and Positions

### Querying Your Accounts

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

### Querying Currency Balances

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

### Querying Equity and Margin

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

## Advisor Features

Documentation coming soon.

## FYIs, Alerts, and Bulletins

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

List of all recent notifications can be retrieved by calling `GET /fyi/notifications` which will provide list of all notifications. `R` in response indicate if notification/disclaimer was read or not.

So by using it, corresponding notification can be highlighted to user. Response also contains a title (`MS`), notification code "fyi code" (`FC`), unique identifier (`ID`) and detailed html formatted message (`MD`).

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
      {
        "R": 1,
        "D": "1710761985.0",
        "MS": "FYI: Changes in Analyst Ratings",
        "MD": "<html>Some investors use analysts ratings to stay informed about their investments. Analysts have changed their ratings for one or more companies in which you hold positions.    <br />The following summary displays the affected companies, the current number of analysts by rating category and, in parentheses, the recent change in the number of analysts rating the company within each rating category.  <br /> - F@NYSE: Buy: 4(0), Outperform: 4(0), Hold: 15(+1), Underperform: 3(-1), Sell: 1(0). Held in: D****000 <br /> - RF@NYSE: Buy: 4(+1), Outperform: 5(0), Hold: 17(-1), Underperform: 1(0), Sell: 0(0). Held in: D****000 <br /> - TSLA@NASDAQ: Buy: 5(0), Outperform: 12(0), Hold: 21(0), Underperform: 7(+1), Sell: 4(0). Held in: D****000 <br /> - UAA@NYSE: Buy: 6(0), Outperform: 2(-1), Hold: 17(+1), Underperform: 2(0), Sell: 0(0). Held in: D****000 <br /> <br />   Note: Current ratings are from Reuters and may not reflect all rating changes from other sources such as Street Insider and Briefing.</html>",
        "ID": "2024031843829868",
        "HT": 0,
        "FC": "PF"
      },
      {
        "R": 1,
        "D": "1710501829.0",
        "MS": "FYI: Changes in Analyst Ratings",
        "MD": "<html>Some investors use analysts ratings to stay informed about their investments. Analysts have changed their ratings for one or more companies in which you hold positions.    <br />The following summary displays the affected companies, the current number of analysts by rating category and, in parentheses, the recent change in the number of analysts rating the company within each rating category.  <br /> - F@NYSE: Buy: 4(0), Outperform: 4(0), Hold: 14(+1), Underperform: 4(0), Sell: 1(0). Held in: D****000 <br /> - UAA@NYSE: Buy: 6(0), Outperform: 3(-1), Hold: 16(-1), Underperform: 2(+1), Sell: 0(0). Held in: D****000 <br /> <br />   Note: Current ratings are from Reuters and may not reflect all rating changes from other sources such as Street Insider and Briefing.</html>",
        "ID": "2024031537589663",
        "HT": 0,
        "FC": "PF"
      }
    ]

#### Marking FYIs Read

Specific FYI notifications can be marked as read via `PUT /fyi/notifications/{notificationID}`. Please note that you can have multiple notifications for the same group (grouped by `fyi code`)

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

### FYI Delivery Options

TBD, This needs to be revisited. We should figure out if we need to should only email delivery option or others too.

### Alerts

#### Creating and Modifying Alerts

#### Listing Configured Alerts

#### Retrieving Alert Details

#### Mobile Trading Alerts

### Bulletins
