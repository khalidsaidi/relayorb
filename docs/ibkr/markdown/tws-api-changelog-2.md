# TWS API Changelog

February 7, 2025

new

IBKR TWS API

TWS API 10.34.01 Release Notes:

  - A new EClient.reqCurrentTimeInMillis() function has been added, allowing clients to request the current epoch timestamp reflected from Trader Workstation. This value will return over EWrapper.currentTimeInMillis() containing the integer, timeInMillis.
  - The Order and Execution object now contains a “Submitter” field. The Submitter field returns the username that submitted a given order.

January 16, 2025

update

IBKR TWS API

The TWS API has been updated to accommodate higher pacing limitations. As noted in our refreshed [Pacing Limitations](https://www.interactivebrokers.com/campus/ibkr-api-page/twsapi-doc/#requests-limitations) section, your maximum requests per second are now based on your [Market Data Lines](https://www.interactivebrokers.com/campus/ibkr-api-page/market-data-subscriptions/#market-data-lines) divided by 2.

January 13, 2025

important

IBKR TWS API

Please be aware that Interactive Brokers will be increasing the minimum supported version of Trader Workstation and IB Gateway to 10.30 starting in March 20, 2025. Clients using lower versions will likely experience prompts to upgrade their machines or they will otherwise be restricted from access.

The Stable and Latest releases of TWS can be found on our website [here](https://www.interactivebrokers.com/en/trading/tws.php#tws-software).

The Latest release of IB Gateway, 10.33.1e, can be found [here](https://www.interactivebrokers.com/en/trading/ibgateway-latest.php).

December 17, 2024

important

IBKR TWS API

TWS API 10.33 has several additional changes that should be reflected in coming upgrades:

  - The [EWrapper.Error()](https://www.interactivebrokers.com/campus/ibkr-api-page/twsapi-doc/#error) function has been updated in include a new parameter as the second argument, “errorTime”. This variable is a long value denoting the epoch timestamp of when the error was returned.
  - The Order State source file now contains a new class object, [OrderAllocation](https://www.interactivebrokers.com/campus/ibkr-api-page/twsapi-ref/#orderallocation-ref). The class includes information about client allocation for a given order and declares the position change for a client.
  - The [OrderState](https://www.interactivebrokers.com/campus/ibkr-api-page/twsapi-ref/#orderstate-ref) class has updated the margin fields to clarify “initMarginBeforeOutsideRth” or similar updates to the other fields to reflect changes based on market close. New values such as “rejectReason”, “orderAllocations” and “suggestedSize” are included to improve transparency.
  - All instances referring to “commissions” have been updated to “commissionAndFees”
  - The EClient.cancelOrder() function’s second argument is now an [OrderCancel object](https://www.interactivebrokers.com/campus/ibkr-api-page/twsapi-ref/#ordercancel-ref) in place of a string. This object takes an extOperator, manualOrderIndicator, and manualOrderCancelTime parameters.

November 11, 2024

new

IBKR API Changelog

Unique changelog pages have been created for each major section of the IBKR Campus API Documentation.

October 18, 2024

new

IBKR TWS API

The [ManualOrderIndicator](https://www.interactivebrokers.com/campus/ibkr-api-page/twsapi-ref/#order-ref:~:text=existing%20short%20position.-,ManualOrderIndicator,-int) and [ExtOperator](https://www.interactivebrokers.com/campus/ibkr-api-page/twsapi-ref/#order-ref:~:text=or%20automated%20\(0\).-,ExtOperator,-String) fields have been added to the TWS API to comply with [CME Rule 576](https://www.cmegroup.com/rulebook/files/cme-group-Rule-576.pdf).

Clearing members trading through CME must submit orders using these fields in order to maintain compliance with the exchange. Please be aware that Interactive Brokers cannot provide legal assistance with respect to which clients would or would not require this field.

July 8, 2024

update

IBKR TWS API

Please be aware that endDateTime must be left as an empty string when requesting continuous futures contracts when using the TWS API with Trader Workstation or IB Gateway releases of 10.30 and above.

June 12, 2024

new

IBKR TWS API

The TWS Settings Best Practices: Configure TWS / IB Gateway section has been added. This includes numerous quality of life settings applicable for the TWS or IB gateway that should be reviewed by regular users to potential help improve day-to-day trading.

April 16, 2024

new

IBKR TWS API

ND Omni Accounts are now supported for use with the Trader Workstation/IB Gateway and TWS API along with the Web API.

February 8, 2024

new

IBKR TWS API

Added IBKR Pro requirement on [TWS Requirements](https://www.interactivebrokers.com/campus/ibkr-api-page/twsapi-doc/#tws-api-requirements) section.

December 8, 2023

update

IBKR TWS API

Customers who have previously implemented the TickTypeEnum.to\_str() method in TWS API release 10.25 or lower for Python should be aware this method has been updated to TickTypeEnum.toStr() for TWS API 10.26 and higher.

October 26, 2023

new

IBKR TWS API

Added the manualOrderTime field to the [exerciseOptions method](https://www.interactivebrokers.com/campus/ibkr-api-page/trader-workstation-api/#exercise-options) in the TWS API. Please keep in mind this field is only available in TWS API release 10.26 or higher.

October 18, 2023

new

IBKR TWS API

New tick types, Delayed Yield Bid and Delayed Yield Ask have been made available and added to the Available Tick Types table.

See [Available Tick Types](https://www.interactivebrokers.com/campus/ibkr-api-page/trader-workstation-api/#available-tick-types) for more information.

October 18, 2023

new

IBKR TWS API

Execution Object added to TWS API documentation. Additional Parameter “pendingPriceRevision” added to the Execution object in TWSAPI 10.25+.

See [The Execution Object](https://www.interactivebrokers.com/campus/ibkr-api-page/trader-workstation-api/#execution-object) section for more details.
