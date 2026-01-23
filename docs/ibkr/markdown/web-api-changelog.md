# Web API Changelog

December 10, 2025

update

IBKR WebAPI

Web API Reference

The /iserver/marketdata/snapshot conids parameter is now limited to 100 conids per query with 50 maximum fields at any given time.

November 18, 2025

update

IBKR WebAPI

Trading Web API

The /hmds/history endpoint has been removed from the documentation as it is now considered deprecated. Users interested in retrieving historical data from the WebAPI should instead use the <span>/iserver/marketdata/history</span> endpoint.

August 27, 2025

new

IBKR WebAPI

Trading Web API

The [sor websocket topic](/campus/ibkr-api-page/cpapi-v1/#ws-order-updates-sub) now includes the “filters” argument, which can take any one order status to filter orders by.

March 28, 2025

important

IBKR APIs

IBKR WebAPI

Web API Reference

Beginning May 1st, all requests to [Place an Order](https://www.interactivebrokers.com/campus/ibkr-api-page/cpapi-v1/#place-order), [Cancel an Order](https://www.interactivebrokers.com/campus/ibkr-api-page/cpapi-v1/#cancel-order), or [Modify an Order](https://www.interactivebrokers.com/campus/ibkr-api-page/cpapi-v1/#modify-order) for US Futures Orders **must** include the [manualIndicator](https://www.interactivebrokers.com/campus/ibkr-api-page/cpapi-v1/#place-order:~:text=instead%20of%20conid.-,manualIndicator,-%3A%20boolean.) field.

The Manual Indicator field is used to determine if an order was manual entered or done through an automated tool.

This field is required in order to remain in compliance with [CME Group Rule 536-B](https://www.cmegroup.com/rulebook/files/cme-group-Rule-536-B-Tag1028.pdf).

December 18, 2024

new

Account Management API

Extend accountManagementRequests to support [assignment of fee template](https://www.interactivebrokers.com/campus/ibkr-api-page/web-api-account-management/#client-fees-13) and account [closure requests.](https://www.interactivebrokers.com/campus/ibkr-api-page/web-api-account-management/#account-statuses-7)

December 18, 2024

new

Account Management API

New ‘types’ added for /[enumerations](https://www.interactivebrokers.com/campus/ibkr-api-page/web-api-account-management/#application-schema-24) endpoint.

  - **COMPLEX\_ASSET\_TRANSFER**: Query most up to date values for brokerName. Used if submitting a ComplexAssetTransfer (Basic FOP)
  - **questionnaires**: Query questions associated with EDD (Enhanced Due Diligence) or AVT (Additional Verification) tasks assigned to an account.
  - **quiz-questions**: Obtain list of questions associated with IBKR knowledge assessment.
  - **security-questions**: Obtain list of questions supported for IBKR security questions.

November 11, 2024

new

IBKR API Changelog

Unique changelog pages have been created for each major section of the IBKR Campus API Documentation.

October 15, 2024

update

IBKR WebAPI

Trading Web API

Fully revamped the OAuth 1.0a documentation section to further clarify involved RFC values as well as provide additional samples of how OAuth 1.0a can be implemented.

The new OAuth 1.0a documentation structure provides direct procedural documentation for easy of implementation with exact information for each endpoint.

October 11, 2024

update

IBKR WebAPI

The [Flex Web Service documentation](https://www.interactivebrokers.com/campus/ibkr-api-page/cpapi-v1/#flex-intro) has been fully updated to reflect the new Client Portal layout as well as the primary request url for the /SendRequest and /GetStatement endpoints.

September 24, 2024

update

IBKR WebAPI

Trading Web API

Updated our [Live Orders endpoint](https://www.interactivebrokers.com/campus/ibkr-api-page/cpapi-v1/#live-orders) documentation to describe filter behavior.

September 10, 2024

update

IBKR WebAPI

Updated Flex Web Service URLs for [Generating](https://www.interactivebrokers.com/campus/ibkr-api-page/flex-web-service/#flex-generate-report) and [Retrieving](https://www.interactivebrokers.com/campus/ibkr-api-page/flex-web-service/#retrieve-report) Reports.

September 6, 2024

important

IBKR WebAPI

Trading Web API

The [WebApi v1 Pacing Limitations section](https://www.interactivebrokers.com/campus/ibkr-api-page/cpapi-v1/#pacing-limitations) has been updated to better reflect global pacing limitation. We have also alphabetized the list to improve discovery.

August 30, 2024

update

IBKR WebAPI

Trading Web API

We have updated the [Order Status documentation](https://www.interactivebrokers.com/campus/ibkr-api-page/cpapi-v1/#order-status) to reflect potential expected ‘503’ error scenarios.

July 23, 2024

new

The [Combination Position](https://www.interactivebrokers.com/campus/ibkr-api-page/cpapi-v1/#portfolio-combo) endpoint has been added to the Client Portal API Documentation. This endpoints allows users to retrieve any combo or spread positions held in the account as an object from an array.

July 23, 2024

update

The [Live Orders](https://www.interactivebrokers.com/campus/ibkr-api-page/cpapi-v1/#live-orders) endpoint has been updated to reflect the order\_ref descriptions in the Response Object section.

July 23, 2024

new

IBKR WebAPI

Trading Web API

The [Beta release of the Client Portal Gateway](https://www.interactivebrokers.com/campus/ibkr-api-page/cpapi-v1/#start-step-two) has been updated to our latest software bundle.

April 10, 2024

important

IBKR WebAPI

Trading Web API

The IBKRCampus API documentation is going through several quality of life updates to provide the best possible experience for our users.

  - The previous Client Portal API documentation has been rolled into the [Client Portal V1](https://www.interactivebrokers.com/campus/ibkr-api-page/cpapi-v1/) documentation page.
  - The previous OAuth 1.0a documentation has been rolled into the general [Client Portal API V1 documentation](https://www.interactivebrokers.com/campus/ibkr-api-page/cpapi-v1/)
  - We are introducing a split content structure reflecting endpoint reference material under the [Web API Reference](https://www.interactivebrokers.com/campus/ibkr-api-page/webapi-ref/) and general workflow instructions under [Web API Documentation](https://www.interactivebrokers.com/campus/ibkr-api-page/webapi-doc/).

April 10, 2024

update

IBKR WebAPI

Trading Web API

Please be aware that the Client Portal websocket topic documentation, spl+{}, has been updated to now return “uel” instead of “el”. See the [Request Profit & Loss section for more details](https://www.interactivebrokers.com/campus/ibkr-api-page/cpapi-v1/#ws-pnl-sub)

March 7, 2024

new

IBKR WebAPI

Trading Web API

The [/iserver/questions/suppress](https://www.interactivebrokers.com/campus/ibkr-api-page/cpapi-v1/#questions-suppress) and [/iserver/questions/suppress/reset/iserver/reply/{replyId} endpoint](https://www.interactivebrokers.com/campus/ibkr-api-page/cpapi/#reset-questions-suppress).

February 15, 2024

warning

IBKR WebAPI

Trading Web API

Presentation of bid & ask sizes delivered by [Web API’s “sbd” websocket subscription](https://www.interactivebrokers.com/campus/ibkr-api-page/cpapi/#ws-price-ladder-sub) to change by end of Feb 2024. Bid & ask sizes will be unformatted and will not include M/K formatters or comma delimiters.

February 5, 2024

new

IBKR WebAPI

Trading Web API

The [/iserver/auth/ssodh/init endpoint](https://www.interactivebrokers.com/campus/ibkr-api-page/cpapi-v1/#ssodh-init) has been documented for use with the Client Portal API. This endpoint allows users to initialize their brokerage session after logging in through the standard Gateway portal. This will replace any prior use of the /reauthenticate endpoint.

February 5, 2024

warning

IBKR WebAPI

Trading Web API

The [/reauthenticate endpoint](https://www.interactivebrokers.com/campus/ibkr-api-page/cpapi-v1/#reauthenticate), used to reconnect a disconnected session, has been flagged as DEPRECATED, and all use of the endpoint should instead be handled with /iserver/auth/ssodh/init endpoint.

January 24, 2024

update

IBKR WebAPI

Trading Web API

Updated the Market Data Field 7680 and replaced it with 7724 to reflect Price to Exponential Moving Average in the [Client Portal Market Data Fields](https://www.interactivebrokers.com/campus/ibkr-api-page/cpapi/#market-data-fields) section.

December 1, 2023

important

Trading Web API

We have added full documentation for OAuth 1.0a for all institutional clients looking to get started with this alternative authentication method. See the [OAuth 1.0a](https://www.interactivebrokers.com/campus/ibkr-api-page/cpapi-v1/#oauth-10a) page for more details.

December 1, 2023

new

IBKR WebAPI

Trading Web API

Financial Advisor Allocation Management has been added to the Client Portal API and relevant documentation has been added to the CPAPI documentation.  
See [FA Allocation Management](https://www.interactivebrokers.com/campus/ibkr-api-page/cpapi-v1/#fa-mgmt) for more details on these new endpoints for Advisors.

November 21, 2023

new

IBKR WebAPI

Trading Web API

The [/bond-filters endpoint](https://www.interactivebrokers.com/campus/ibkr-api-page/cpapi-v1/#search-bond-filters) has been added to documentation, which is used to retrieve relevant bond information such as maturity dates, issue dates, coupon, and currency.
