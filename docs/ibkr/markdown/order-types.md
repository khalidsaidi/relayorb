# Order Types

## Introduction

This page is used to document all available order types available through the Interactive Brokers API interfaces. The values documented showcase the minimum values needed to create the order. Additional parameters can be used or combined in some cases.

You can find the available fields or parameters for orders in their respective interfaces:

  - [TWS API’s Order Object](https://www.interactivebrokers.com/campus/ibkr-api-page/trader-workstation-api/#order-object)
  - [CPAPI’s /iserver/account/{{accountId}}/orders endpoint](https://www.interactivebrokers.com/campus/ibkr-api-page/cpapi/#place-order)

## Notes & Limitations

  - While the Interactive Brokers support team can help assist with required parameters for the API, they can not comment on best orders to use, financial or trading advice, or any further information aside from API logic.
  - It is important to test the order type idea manually in TWS before writing the API execution tactic because some execution ideas (e.g. applying STP LMT on Iceberg / applying Bracket Order with IBALGO) may not supported by TWS. As a result, they will not be supported by API too.
  - Paper Trading Accounts are based on a simulated environment, and as a result, order execution behavior is not indicative of real world trading conditions. The paper accounts should be used exclusively for understanding how tools function.
  - It is important to test the order type idea manually in TWS before writing the API execution tactic because some execution ideas (e.g. applying STP LMT on Iceberg / applying Bracket Order with IBALGO) may not supported by TWS. As a result, they will not be supported by API too.
  - Interacive Brokers APIs do not support fractional or cash quantity trading with exception to Cryptocurrencies and Forex trading.

### Cryptocurrency Trading

Because Cryptocurrencies at Interactive Brokers are managed through external groups like ZEROHASH and PAXOS, the available order types and behaviors are slightly different from average. The lists below indicate what is available for BUY and SELL orders when using Cryptocurrencies.

Please be aware that no other order types are available for Crypto orders.

#### BUY

###### Order Types

  - LMT Order Using “quantity” or “totalQuantity” values.
  - MKT Orders using “cashQty” value.

###### Time in Force

LMT Orders support “DAY”, “GTC”, “IOC”

  - The TWS API Also Supports the “Minutes” time in force.

MKT Orders only support “IOC”.

#### SELL

###### Order Types

  - LMT Order Using “quantity” or “totalQuantity values.
  - MKT orders using “quantity” or “totalQuantity” values.

###### Time in Force

LMT Orders support “DAY”, “GTC”, “IOC”

  - The TWS API Also Supports the “Minutes” time in force.

MKT Orders only support “IOC”.

### Order Efficiency Ratio

While Interactive Brokers’ API offerings do maintain their own pacing limitations, Interactive Brokers as a whole maintains an order pacing limitation. This is known as the Order Efficiency Ratio. While this does not typically effect regular traders, automated trading systems may be impacted. This is because OER does not necessarily impact a lower volume of trades, but will effect those who submit thousands of orders without regular execution.

More information about measuring and understanding the order efficiency ratio can be found in our [Order Management Overview article](https://www.ibkrguides.com/kb/article-1343.htm).

### Order Type by API

It is important to note that while this page does document both our TWS API and CPAPI, not all order types are available in both platforms.

As such, please keep in mind:

  - Orders labeled in Python, Java, C++, C\#, and Visual Basic are for use in the TWS API
  - Orders labeled in CURL are for use in the Client Portal API

## Basic Orders

This section will explore all available orders through Interactive Brokers that can be accomplished in a single standard request structure. This includes typical behaviors such as Market, Limit, and Stop orders.

### Auction Orders

### Auction

An Auction order is entered into the electronic trading system during the pre-market opening period for execution at the Calculated Opening Price (COP). If your order is not filled on the open, the order is re-submitted as a limit order with the limit price set to the COP or the best bid/ask after the market opens.<span class="underline"></span>

Products: FUT, STK

More on [Auction Orders](https://www.interactivebrokers.com/en/index.php?f=578)

More on [Supported exchanges](https://www.interactivebrokers.com/en/index.php?f=3883?ot=auc)

  - Python
  - cURL
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
order = Order()
order.action = action
order.tif = "AUC"
order.orderType = "MTL"
order.totalQuantity = quantity
order.lmtPrice = price
```

Not available for use in the Client Portal API.

``` EnlighterJSRAW
Order order = new Order();
order.action(action);
order.tif("AUC");
order.orderType("MTL");
order.totalQuantity(quantity);
order.lmtPrice(price);
```

``` EnlighterJSRAW
Order order;
order.action = action;
order.tif = "AUC";
order.orderType = "MTL";
order.totalQuantity = quantity;
order.lmtPrice = price;
```

``` EnlighterJSRAW
Order order = new Order();
order.Action = action;
order.Tif = "AUC";
order.OrderType = "MTL";
order.TotalQuantity = quantity;
order.LmtPrice = price;
```

``` EnlighterJSRAW
Dim order As Order = New Order
order.Action = action
order.Tif = "AUC"
order.OrderType = "MTL"
order.TotalQuantity = quantity
order.LmtPrice = price
```

### Auction Limit

For option orders routed to the Boston Options Exchange (BOX) you may elect to participate in the BOX’s price improvement auction in pennies. All BOX-directed price improvement orders are immediately sent from Interactive Brokers to the BOX order book, and when the terms allow, IB will evaluate it for inclusion in a price improvement auction based on price and volume priority. In the auction, your order will have priority over broker-dealer price improvement orders at the same price. An Auction Limit order at a specified price. Use of a limit order ensures that you will not receive an execution at a price less favorable than the limit price. Enter limit orders in penny increments with your auction improvement amount computed as the difference between your limit order price and the nearest listed increment.

Products: OPT (BOX only)

More on [price improvement orders](https://www.interactivebrokers.com/en/index.php?f=614)

  - Python
  - cURL
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
order = Order()
order.action = action
order.orderType = "LMT"
order.totalQuantity = quantity
order.lmtPrice = price
order.auctionStrategy = auctionStrategy
```

Not available for use in the Client Portal API.

``` EnlighterJSRAW
Order order = new Order();
order.action(action);
order.orderType("LMT");
order.totalQuantity(quantity);
order.lmtPrice(price);
order.auctionStrategy(auctionStrategy);
```

``` EnlighterJSRAW
Order order;
order.action = action;
order.orderType = "LMT";
order.totalQuantity = quantity;
order.lmtPrice = price;
order.auctionStrategy = auctionStrategy;
```

``` EnlighterJSRAW
Order order = new Order();
order.Action = action;
order.OrderType = "LMT";
order.TotalQuantity = quantity;
order.LmtPrice = price;
order.AuctionStrategy = auctionStrategy;
```

``` EnlighterJSRAW
Dim order As Order = New Order
order.Action = action
order.OrderType = "LMT"
order.TotalQuantity = quantity
order.LmtPrice = price
order.AuctionStrategy = auctionStrategy
```

### Auction Pegged to Stock

For option orders routed to the Boston Options Exchange (BOX) you may elect to participate in the BOX’s price improvement auction in pennies. All BOX-directed price improvement orders are immediately sent from Interactive Brokers to the BOX order book, and when the terms allow, IB will evaluate it for inclusion in a price improvement auction based on price and volume priority. In the auction, your order will have priority over broker-dealer price improvement orders at the same price. An Auction Pegged to Stock order adjusts the order price by the product of a signed delta (which is entered as an absolute and assumed to be positive for calls, negative for puts) and the change of the option’s underlying stock price. A buy or sell call order price is determined by adding the delta times a change in an underlying stock price change to a specified starting price for the call. To determine the change in price, a stock reference price (NBBO midpoint at the time of the order is assumed if no reference price is entered) is subtracted from the current NBBO midpoint. A stock range may also be entered that cancels an order when reached. The delta times the change in stock price will be rounded to the nearest penny in favor of the order and will be used as your auction improvement amount.

Products: OPT (BOX only)

More on [price improvement orders](https://www.interactivebrokers.com/en/index.php?f=614)

  - Python
  - cURL
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
order = Order()
order.action = action
order.orderType = "PEG STK"
order.totalQuantity = quantity
order.delta = delta
order.startingPrice = startingPrice
```

Not available for use in the Client Portal API.

``` EnlighterJSRAW
Order order = new Order();
order.action(action);
order.orderType("PEG STK");
order.totalQuantity(quantity);
order.delta(delta);
order.startingPrice(startingPrice);
```

``` EnlighterJSRAW
Order order;
order.action = action;
order.orderType = "PEG STK";
order.totalQuantity = quantity;
order.delta = delta;
order.startingPrice = startingPrice;
```

``` EnlighterJSRAW
Order order = new Order();
order.Action = action;
order.OrderType = "PEG STK";
order.TotalQuantity = quantity;
order.Delta = delta;
order.StartingPrice = startingPrice;
```

``` EnlighterJSRAW
Dim order As Order = New Order
order.Action = action
order.OrderType = "PEG STK"
order.TotalQuantity = quantity
order.Delta = delta
order.StartingPrice = startingPrice
```

### Auction Relative

Stock-Option contracts directly routed to BOX will support a Price Improvement Auction Orders compared to standard SMART routing. This order will necessitate a standard [Relative / Pegged-To-Primary order](https://www.interactivebrokers.com/campus/ibkr-api-page/order-types/#pegged-to-primary-orders) with the contract being directly routed to “BOX” rather than “SMART” or another exchange.

Products: OPT (BOX only)

More on [price improvement orders](https://www.interactivebrokers.com/en/index.php?f=614)

  - Python
  - cURL
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
contract.exchange = "BOX"
order = Order()
order.action = action
order.orderType = "REL"
order.totalQuantity = quantity
order.auxPrice = offset
```

Not available for use in the Client Portal API.

``` EnlighterJSRAW
Order order = new Order();
order.action(action);
order.orderType("REL");
order.totalQuantity(quantity);
order.auxPrice(offset);
```

``` EnlighterJSRAW
Order order;
order.action = action;
order.orderType = "REL";
order.totalQuantity = quantity;
order.auxPrice = offset;
```

``` EnlighterJSRAW
Order order = new Order();
order.Action = action;
order.OrderType = "REL";
order.TotalQuantity = quantity;
order.AuxPrice = offset;
```

``` EnlighterJSRAW
Dim order As Order = New Order
order.Action = action
order.OrderType = "REL"
order.TotalQuantity = quantity
order.AuxPrice = offset
```

### Block

The Block attribute is used for large volume option orders on ISE that consist of at least 50 contracts. To execute large-volume orders over time without moving the market, use the [Accumulate/Distribute](https://interactivebrokers.github.io/tws-api/ibalgos.html#ad) algorithm.

Products: OPT

More on [Block Orders](https://www.interactivebrokers.com/en/index.php?f=580)

More on [Supported exchanges](https://www.interactivebrokers.com/en/index.php?f=3883?ot=block)

  - Python
  - cURL
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
order = Order()
order.action = action
order.orderType = "LMT"
order.totalQuantity = quantity#Large volumes!
order.lmtPrice = price
order.blockOrder = True
```

Not available for use in the Client Portal API.

``` EnlighterJSRAW
Order order = new Order();
order.action(action);
order.orderType("LMT");
order.totalQuantity(quantity);//Large volumes!
order.lmtPrice(price);
order.blockOrder(true);
```

``` EnlighterJSRAW
Order order;
order.action = action;
order.orderType = "LMT";
order.totalQuantity = quantity;
order.lmtPrice = price;
order.blockOrder = true;
```

``` EnlighterJSRAW
Order order = new Order();
order.Action = action;
order.OrderType = "LMT";
order.TotalQuantity = quantity;//Large volumes!
order.LmtPrice = price;
order.BlockOrder = true;
```

``` EnlighterJSRAW
Dim order As Order = New Order
order.Action = action
order.OrderType = "LMT"
order.TotalQuantity = quantity ' Large volumes!
order.LmtPrice = price
order.BlockOrder = True
```

### Box Top

A Box Top order executes as a market order at the current best price. If the order is only partially filled, the remainder is submitted as a limit order with the limit price equal to the price at which the filled portion of the order executed.

Products: OPT (BOX only)

More on [Box Top Orders](https://www.interactivebrokers.com/en/index.php?f=582)

  - Python
  - cURL
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
order = Order()
order.action = action
order.orderType = "BOX TOP"
order.totalQuantity = quantity
```

Not available for use in the Client Portal API.

``` EnlighterJSRAW
Order order = new Order();
order.action(action);
order.orderType("BOX TOP");
order.totalQuantity(quantity);
```

``` EnlighterJSRAW
Order order;
order.action = action;
order.orderType = "BOX TOP";
order.totalQuantity = quantity;
```

``` EnlighterJSRAW
Order order = new Order();
order.Action = action;
order.OrderType = "BOX TOP";
order.TotalQuantity = quantity;
```

``` EnlighterJSRAW
Dim order As Order = New Order
order.Action = action
order.OrderType = "BOX TOP"
order.TotalQuantity = quantity
```

### Combo Limit

Create combination orders that include options, stock and futures legs (stock legs can be included if the order is routed through SmartRouting). Although a combination/spread order is constructed of separate legs, it is executed as a single transaction if it is routed directly to an exchange. For combination orders that are SmartRouted, each leg may be executed separately to ensure best execution.

Products: OPT, STK, FUT

  - Python
  - cURL
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
order.action = action
order.orderType = "LMT"
order.totalQuantity = quantity
order.lmtPrice = limitPrice
if nonGuaranteed:
    order.smartComboRoutingParams = []
    order.smartComboRoutingParams.append(TagValue("NonGuaranteed", "1"))
```

``` EnlighterJSRAW
curl --insecure https://localhost:5000/v1/api/iserver/account/{{accountId}}/orders \
--request POST \
--header 'Content-Type:application/json' \
--data '{
  "orders": [
    {
      "conid": conid,
      "orderType": "LMT",
      "price": price,
      "side": "side",
      "tif": "tif",
      "quantity": quantity
    }
  ]
}
```

``` EnlighterJSRAW
Order order = new Order();
order.action(action);
order.orderType("LMT");
order.lmtPrice(limitPrice);
order.totalQuantity(quantity);
if (nonGuaranteed)
{
    order.smartComboRoutingParams().add(new TagValue("NonGuaranteed", "1"));
}
```

``` EnlighterJSRAW
Order order;
order.action = action;
order.orderType = "LMT";
order.totalQuantity = quantity;
order.lmtPrice = limitPrice;
if(nonGuaranteed){
    TagValueSPtr tag1(new TagValue("NonGuaranteed", "1"));
    order.smartComboRoutingParams.reset(new TagValueList());
    order.smartComboRoutingParams->push_back(tag1);
}
```

``` EnlighterJSRAW
Order order = new Order();
order.Action = action;
order.OrderType = "LMT";
order.TotalQuantity = quantity;
order.LmtPrice = limitPrice;
if (nonGuaranteed)
{
    order.SmartComboRoutingParams = new List<TagValue>();
    order.SmartComboRoutingParams.Add(new TagValue("NonGuaranteed", "1"));
}
```

``` EnlighterJSRAW
Dim order As Order = New Order
order.Action = action
order.OrderType = "LMT"
order.TotalQuantity = quantity
order.LmtPrice = limitPrice
If (nonGuaranteed) Then
    order.SmartComboRoutingParams = New List(Of TagValue)
    order.SmartComboRoutingParams.Add(New TagValue("NonGuaranteed", "1"))
End If
```

### Combo Limit with Price per Leg

Create combination orders that include options, stock and futures legs (stock legs can be included if the order is routed through SmartRouting). Although a combination/spread order is constructed of separate legs, it is executed as a single transaction if it is routed directly to an exchange. For combination orders that are SmartRouted, each leg may be executed separately to ensure best execution.

Products: OPT, STK, FUT

  - Python
  - cURL
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
order = Order()
order.action = action
order.orderType = "LMT"
order.totalQuantity = quantity
order.orderComboLegs = []

for price in legPrices:
    comboLeg = OrderComboLeg()
    comboLeg.price = price
    order.orderComboLegs.append(comboLeg)
   
if nonGuaranteed:
    order.smartComboRoutingParams = []
    order.smartComboRoutingParams.append(TagValue("NonGuaranteed", "1"))
```

Not available for use in the Client Portal API.

``` EnlighterJSRAW
Order order = new Order();
order.action(action);
order.orderType("LMT");
order.totalQuantity(quantity);
order.orderComboLegs(new ArrayList<>());

for(double price : legPrices) {
    OrderComboLeg comboLeg = new OrderComboLeg();
    comboLeg.price(5.0);
    order.orderComboLegs().add(comboLeg);
}

if (nonGuaranteed)
{
    order.smartComboRoutingParams().add(new TagValue("NonGuaranteed", "1"));
}
```

``` EnlighterJSRAW
Order order;
order.action = action;
order.orderType = "LMT";
order.totalQuantity = quantity;
order.orderComboLegs.reset(new Order::OrderComboLegList());
for(unsigned int i = 0; i < legprices.size(); i++){
    OrderComboLegSPtr comboLeg(new OrderComboLeg());
    comboLeg->price = legprices[i];
    order.orderComboLegs->push_back(comboLeg);
}
if(nonGuaranteed){
    TagValueSPtr tag1(new TagValue("NonGuaranteed", "1"));
    order.smartComboRoutingParams.reset(new TagValueList());
    order.smartComboRoutingParams->push_back(tag1);
}
```

``` EnlighterJSRAW
Order order = new Order();
order.Action = action;
order.OrderType = "LMT";
order.TotalQuantity = quantity;
order.OrderComboLegs = new List<OrderComboLeg>();
foreach(double price in legPrices)
{
    OrderComboLeg comboLeg = new OrderComboLeg();
    comboLeg.Price = 5.0;
    order.OrderComboLegs.Add(comboLeg);
}           
if (nonGuaranteed)
{
    order.SmartComboRoutingParams = new List<TagValue>();
    order.SmartComboRoutingParams.Add(new TagValue("NonGuaranteed", "1"));
}
```

``` EnlighterJSRAW
Dim order As Order = New Order
order.Action = action
order.OrderType = "LMT"
order.TotalQuantity = quantity
order.OrderComboLegs = New List(Of OrderComboLeg)
For Each price As Double In legPrices
    Dim ComboLeg As OrderComboLeg = New OrderComboLeg
    ComboLeg.Price = 5.0
    order.OrderComboLegs.Add(ComboLeg)
Next price
If (nonGuaranteed) Then
    order.SmartComboRoutingParams = New List(Of TagValue)
    order.SmartComboRoutingParams.Add(New TagValue("NonGuaranteed", "1"))
End If
```

### Combo Market

Create combination orders that include options, stock and futures legs (stock legs can be included if the order is routed through SmartRouting). Although a combination/spread order is constructed of separate legs, it is executed as a single transaction if it is routed directly to an exchange. For combination orders that are SmartRouted, each leg may be executed separately to ensure best execution.

Products: OPT, STK, FUT

  - Python
  - cURL
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
order = Order()
order.action = action
order.orderType = "MKT"
order.totalQuantity = quantity
if nonGuaranteed:
    order.smartComboRoutingParams = []
    order.smartComboRoutingParams.append(TagValue("NonGuaranteed", "1"))
```

``` EnlighterJSRAW
curl --insecure https://localhost:5000/v1/api/iserver/account/{{accountId}}/orders \
--request POST \
--header 'Content-Type:application/json' \
--data '{
  "orders": [
    {
      "conidex": "{spread_conid};;;{leg_conid1}/{ratio},{leg_conid2}/{ratio}",
      "orderType": "orderType",
      "side": "side",
      "tif": "tif",
      "quantity": quantity
    }
  ]
}
```

See the [Client Portal Combo / Spread Orders section](https://www.interactivebrokers.com/campus/ibkr-api-page/cpapi/#combo-orders)

``` EnlighterJSRAW
Order order = new Order();
order.action(action);
order.orderType("MKT");
order.totalQuantity(quantity);
if (nonGuaranteed)
{
    order.smartComboRoutingParams().add(new TagValue("NonGuaranteed", "1"));
}
```

``` EnlighterJSRAW
Order order;
order.action = action;
order.orderType = "MKT";
order.totalQuantity = quantity;
if(nonGuaranteed){
    TagValueSPtr tag1(new TagValue("NonGuaranteed", "1"));
    order.smartComboRoutingParams.reset(new TagValueList());
    order.smartComboRoutingParams->push_back(tag1);
}
```

``` EnlighterJSRAW
Order order = new Order();
order.Action = action;
order.OrderType = "MKT";
order.TotalQuantity = quantity;
if (nonGuaranteed)
{
    order.SmartComboRoutingParams = new List<TagValue>();
    order.SmartComboRoutingParams.Add(new TagValue("NonGuaranteed", "1"));
}
```

``` EnlighterJSRAW
Dim order As Order = New Order
order.Action = action
order.OrderType = "MKT"
order.TotalQuantity = quantity
If (nonGuaranteed) Then
    order.SmartComboRoutingParams = New List(Of TagValue)
    order.SmartComboRoutingParams.Add(New TagValue("NonGuaranteed", "1"))
End If
```

### Discretionary

An Discretionary order is a limit order submitted with a hidden, specified ‘discretionary’ amount off the limit price which may be used to increase the price range over which the limit order is eligible to execute. The market sees only the limit price.

Products: STK

More on [Discretionary Orders](https://www.interactivebrokers.com/en/index.php?f=585)

More on [Supported exchanges](https://www.interactivebrokers.com/en/index.php?f=3883?ot=dis)

  - Python
  - cURL
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
order = Order()
order.action = action
order.orderType = "LMT"
order.totalQuantity = quantity
order.lmtPrice = price
order.discretionaryAmt = discretionaryAmount
```

Not available for use in the Client Portal API.

``` EnlighterJSRAW
Order order = new Order();
order.action(action);
order.orderType("LMT");
order.totalQuantity(quantity);
order.lmtPrice(price);
order.discretionaryAmt(discretionaryAmt);
```

``` EnlighterJSRAW
Order order;
order.action = action;
order.orderType = "LMT";
order.totalQuantity = quantity;
order.lmtPrice = price;
order.discretionaryAmt = discretionaryAmount;
```

``` EnlighterJSRAW
Order order = new Order();
order.Action = action;
order.OrderType = "LMT";
order.TotalQuantity = quantity;
order.LmtPrice = price;
order.DiscretionaryAmt = discretionaryAmount;
```

``` EnlighterJSRAW
Dim order As Order = New Order
order.Action = action
order.OrderType = "LMT"
order.TotalQuantity = quantity
order.LmtPrice = price
order.DiscretionaryAmt = discretionaryAmount
```

### Forex Cash Quantity Order

Forex orders can be placed in denomination of second currency in pair using cashQty field.

Products: CASH

More on [Forex Cash Quantity Orders](https://www.interactivebrokers.com/en/index.php?f=23876#963-02)

  - Python
  - cURL
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
order = Order()
order.action = action
order.orderType = "LMT"
order.lmtPrice = limitPrice
order.cashQty = cashQty
```

``` EnlighterJSRAW
curl --insecure https://localhost:5000/v1/api/iserver/account/{{accountId}}/orders \
--request POST \
--header 'Content-Type:application/json' \
--data '{
  "orders": [
    {
      "conid": conid,
      "orderType": "orderType",
      "price": price,
      "side": "side",
      "tif": "tif",
      "fxQty": fxQty,
      "isCcyConv": true
    }
  ]
}
```

``` EnlighterJSRAW
Order order = new Order();
order.action(action);
order.orderType("LMT");
order.lmtPrice(limitPrice);
order.cashQty(cashQty);
```

``` EnlighterJSRAW
Order order;
order.action = action;
order.orderType = "LMT";
order.lmtPrice = limitPrice;
order.cashQty = cashQty;
```

``` EnlighterJSRAW
Order order = new Order();
order.Action = action;
order.OrderType = "LMT";
order.LmtPrice = limitPrice;
order.CashQty = cashQty;
```

``` EnlighterJSRAW
Dim order As Order = New Order
order.Action = action
order.OrderType = "LMT"
order.LmtPrice = limitPrice
order.CashQty = cashQty
```

### Limit Orders

### Limit Order

A Limit order is an order to buy or sell at a specified price or better. The Limit order ensures that if the order fills, it will not fill at a price less favorable than your limit price, but it does not guarantee a fill.

Products: BOND, CASH, CFD, CMDTY, FUT, FOP, OPT, STK, WAR

More on [Limit Orders](https://www.interactivebrokers.com/en/index.php?f=593)

More on [Supported exchanges](https://www.interactivebrokers.com/en/index.php?f=3883?ot=lmt)

  - Python
  - cURL
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
order = Order()
order.action = action
order.orderType = "LMT"
order.totalQuantity = quantity
order.lmtPrice = limitPrice
```

``` EnlighterJSRAW
curl --insecure https://localhost:5000/v1/api/iserver/account/{{accountId}}/orders \
--request POST \
--header 'Content-Type:application/json' \
--data '{
  "orders": [
    {
      "conid": conid,
      "orderType": "LMT",
      "price": price,
      "side": "side",
      "tif": "tif",
      "quantity": quantity
    }
  ]
}
```

``` EnlighterJSRAW
Order order = new Order();
order.action(action);
order.orderType("LMT");
order.totalQuantity(quantity);
order.lmtPrice(limitPrice);
order.tif(TimeInForce.DAY);
```

``` EnlighterJSRAW
Order order;
order.action = action;
order.orderType = "LMT";
order.totalQuantity = quantity;
order.lmtPrice = limitPrice;
```

``` EnlighterJSRAW
Order order = new Order();
order.Action = action;
order.OrderType = "LMT";
order.TotalQuantity = quantity;
order.LmtPrice = limitPrice;
```

``` EnlighterJSRAW
Dim order As Order = New Order
order.Action = action
order.OrderType = "LMT"
order.TotalQuantity = quantity
order.LmtPrice = limitPrice
```

### Limit If Touched

A Limit if Touched is an order to buy (or sell) a contract at a specified price or better, below (or above) the market. This order is held in the system until the trigger price is touched. An LIT order is similar to a stop limit order, except that an LIT sell order is placed above the current market price, and a stop limit sell order is placed below.

Products: BOND, CASH, CFD, CMDTY, FUT, FOP, OPT, STK, WAR

More on [Limit If Touched Orders](https://www.interactivebrokers.com/en/index.php?f=592)

More on [Supported exchanges](https://www.interactivebrokers.com/en/index.php?f=3883?ot=lit)

  - Python
  - cURL
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
order = Order()
order.action = action
order.orderType = "LIT"
order.totalQuantity = quantity
order.lmtPrice = limitPrice
order.auxPrice = triggerPrice
```

``` EnlighterJSRAW
curl --insecure https://localhost:5000/v1/api/iserver/account/{{accountId}}/orders \
--request POST \
--header 'Content-Type:application/json' \
--data '{
  "orders": [
    {
      "conid": conid,
      "orderType": "LIT",
      "price": price,
      "side": "side",
      "tif": "tif",
      "quantity": quantity
    }
  ]
}
```

``` EnlighterJSRAW
Order order = new Order();
order.action(action);
order.orderType("LIT");
order.totalQuantity(quantity);
order.lmtPrice(limitPrice);
order.auxPrice(triggerPrice);
```

``` EnlighterJSRAW
Order order;
order.action = action;
order.orderType = "LIT";
order.totalQuantity = quantity;
order.lmtPrice = limitPrice;
order.auxPrice = triggerPrice;
```

``` EnlighterJSRAW
Order order = new Order();
order.Action = action;
order.OrderType = "LIT";
order.TotalQuantity = quantity;
order.LmtPrice = limitPrice;
order.AuxPrice = triggerPrice;
```

``` EnlighterJSRAW
Dim order As Order = New Order
order.Action = action
order.OrderType = "LIT"
order.TotalQuantity = quantity
order.LmtPrice = limitPrice
order.AuxPrice = triggerPrice
```

### Limit On Close

A Limit-on-close (LOC) order will be submitted at the close and will execute if the closing price is at or better than the submitted limit price.

Products: CFD, FUT, STK, WAR

More on [Limit On Close Orders](https://www.interactivebrokers.com/en/index.php?f=591)

More on [Supported exchanges](https://www.interactivebrokers.com/en/index.php?f=3883?ot=loc)

  - Python
  - cURL
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
order = Order()
order.action = action
order.orderType = "LOC"
order.totalQuantity = quantity
order.lmtPrice = limitPrice
```

``` EnlighterJSRAW
curl --insecure https://localhost:5000/v1/api/iserver/account/{{accountId}}/orders \
--request POST \
--header 'Content-Type:application/json' \
--data '{
  "orders": [
    {
      "conid": conid,
      "orderType": "LOC",
      "price": price,
      "side": "side",
      "tif": "tif",
      "quantity": quantity
    }
  ]
}
```

``` EnlighterJSRAW
Order order = new Order();
order.action(action);
order.orderType("LOC");
order.totalQuantity(quantity);
order.lmtPrice(limitPrice);
```

``` EnlighterJSRAW
Order order;
order.action = action;
order.orderType = "LOC";
order.totalQuantity = quantity;
order.lmtPrice = limitPrice;
```

``` EnlighterJSRAW
Order order = new Order();
order.Action = action;
order.OrderType = "LOC";
order.TotalQuantity = quantity;
order.LmtPrice = limitPrice;
```

``` EnlighterJSRAW
Dim order As Order = New Order
order.Action = action
order.OrderType = "LOC"
order.TotalQuantity = quantity
order.LmtPrice = limitPrice
```

### Limit On Open

A Limit-on-Open (LOO) order combines a limit order with the OPG time in force to create an order that is submitted at the market’s open, and that will only execute at the specified limit price or better. Orders are filled in accordance with specific exchange rules.

Products: CFD, STK, OPT, WAR

More on [Limit on Open Orders](https://www.interactivebrokers.com/en/index.php?f=590)

More on [Supported exchanges](https://www.interactivebrokers.com/en/index.php?f=3883?ot=moo)

  - Python
  - cURL
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
order = Order()
order.action = action
order.tif = "OPG"
order.orderType = "LMT"
order.totalQuantity = quantity
order.lmtPrice = limitPrice
```

``` EnlighterJSRAW
curl --insecure https://localhost:5000/v1/api/iserver/account/{{accountId}}/orders \
--request POST \
--header 'Content-Type:application/json' \
--data '{
  "orders": [
    {
      "conid": conid,
      "orderType": "LMT",
      "price": price,
      "side": "side",
      "tif": "OPG",
      "quantity": quantity
    }
  ]
}
```

``` EnlighterJSRAW
Order order = new Order();
order.action(action);
order.tif("OPG");
order.orderType("LOC");
order.totalQuantity(quantity);
order.lmtPrice(limitPrice);
```

``` EnlighterJSRAW
Order order;
order.action = action;
order.orderType = "LMT";
order.tif = "OPG";
order.totalQuantity = quantity;
order.lmtPrice = limitPrice;
```

``` EnlighterJSRAW
Order order = new Order();
order.Action = action;
order.Tif = "OPG";
order.OrderType = "LMT";
order.TotalQuantity = quantity;
order.LmtPrice = limitPrice;
```

``` EnlighterJSRAW
Dim order As Order = New Order
order.Action = action
order.Tif = "OPG"
order.OrderType = "LMT"
order.TotalQuantity = quantity
order.LmtPrice = limitPrice
```

### Limit Order With Manual Order Time

The Limit Order With Manual Order Time is a Limit Order with ManualOrderTime property.

**Placing a Limit Order With Manual Order Time**  
The *Manual Order Time* field is required for, and becomes editable for, “manual” orders, which are orders that originate from a client (whether by phone, email, chat, verbally from the floor, from another desk, etc.) and are then entered into the system.  
The *Manual Order Time* field is not used for client orders received electronically, nor for orders that originate from the account manager (with discretion) in the client’s accounts, or when an order is allocated to ALL accounts or among multiple accounts using an account group or model portfolio.

**Canceling a Limit Order With Manual Order Time**  
The *Manual Order Cancel Time* field is required for, and becomes editable for, “manual” order cancelations, which are order cancelations that originate from a client (whether by phone, email, chat, verbally from the floor, from another desk, etc.) and are then entered into the system.  
The *Manual Order Cancel Time* field is not used for client orders cancelations received electronically, nor for orders that originate from the account manager (with discretion) in the client’s accounts, or when an order is allocated to ALL accounts or among multiple accounts using an account group or model portfolio.

More on [Limit Orders](https://interactivebrokers.github.io/tws-api/basic_orders.html#limitorder)

  - Python
  - cURL
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
order = OrderSamples.LimitOrder(action, quantity, limitPrice)
order.manualOrderTime = manualOrderTime

self.placeOrder(self.nextOrderId(), ContractSamples.USStockAtSmart(), OrderSamples.LimitOrderWithManualOrderTime("BUY", Decimal("100"), 111.11, "20220314-13:00:00"))

self.cancelOrder(self.simplePlaceOid, "20220303-13:00:00")
```

Not available for use in the Client Portal API.

``` EnlighterJSRAW
Order order = OrderSamples.LimitOrder(action, quantity, limitPrice);
order.manualOrderTime(manualOrderTime);

client.placeOrder(nextOrderId++, ContractSamples.USStockAtSmart(), OrderSamples.LimitOrderWithManualOrderTime("BUY", Decimal.get(100), 111.11, "20220314-13:00:00"));
 
cancelID = nextOrderId - 1;
client.cancelOrder(cancelID, "20220314-19:00:00");
```

``` EnlighterJSRAW
Order order = OrderSamples::LimitOrder(action, quantity, limitPrice);
order.manualOrderTime = manualOrderTime;

m_pClient->placeOrder(m_orderId++, ContractSamples::USStockAtSmart(), OrderSamples::LimitOrderWithManualOrderTime("BUY", stringToDecimal("100"), 111.11, "20220314-13:00:00"));

m_pClient->cancelOrder(m_orderId - 1, "20220314-19:00:00");
```

``` EnlighterJSRAW
Order order = OrderSamples.LimitOrder(action, quantity, limitPrice);
order.ManualOrderTime = manualOrderTime;

client.placeOrder(nextOrderId++, ContractSamples.USStockAtSmart(), OrderSamples.LimitOrderWithManualOrderTime("BUY", Util.StringToDecimal("100"), 111.11, "20220314-13:00:00"));

client.cancelOrder(nextOrderId - 1, "20220314-19:00:00");
```

``` EnlighterJSRAW
Dim order As Order = OrderSamples.LimitOrder(action, quantity, limitPrice)
order.ManualOrderTime = manualOrderTime

client.placeOrder(increment(nextOrderId), ContractSamples.USStockAtSmart(), OrderSamples.LimitOrderWithManualOrderTime("BUY", Util.StringToDecimal("100"), 111.11, "20220314-13:00:00"))

client.cancelOrder(nextOrderId - 1, "20220314-19:00:00")
```

### Market Orders

### Market Order

A Market order is an order to buy or sell at the market bid or offer price. A market order may increase the likelihood of a fill and the speed of execution, but unlike the Limit order a Market order provides no price protection and may fill at a price far lower/higher than the current displayed bid/ask.

Products: BOND, CFD, EFP, CASH, FUND, FUT, FOP, OPT, STK, WAR

More on [Market Orders](https://www.interactivebrokers.com/en/index.php?f=602)

More on [Supported exchanges](https://www.interactivebrokers.com/en/index.php?f=3883?ot=mkt)

  - Python
  - cURL
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
order = Order()
order.action = action
order.orderType = "MKT"
order.totalQuantity = quantity
```

``` EnlighterJSRAW
curl --insecure https://localhost:5000/v1/api/iserver/account/{{accountId}}/orders \
--request POST \
--header 'Content-Type:application/json' \
--data '{
  "orders": [
    {
      "conid": conid,
      "orderType": "MKT",
      "side": "side",
      "tif": "tif",
      "quantity": quantity
    }
  ]
}
```

``` EnlighterJSRAW
Order order = new Order();
order.action(action);
order.orderType("MKT");
order.totalQuantity(quantity);
```

``` EnlighterJSRAW
Order order;
order.action = action;
order.orderType = "MKT";
order.totalQuantity = quantity;
```

``` EnlighterJSRAW
Order order = new Order();
order.Action = action;
order.OrderType = "MKT";
order.TotalQuantity = quantity;
```

``` EnlighterJSRAW
Dim order As Order = New Order
order.Action = action
order.OrderType = "MKT"
order.TotalQuantity = quantity
```

### Market If Touched

A Market If Touched (MIT) is an order to buy (or sell) a contract below (or above) the market. Its purpose is to take advantage of sudden or unexpected changes in share or other prices and provides investors with a trigger price to set an order in motion. Investors may be waiting for excessive strength (or weakness) to cease, which might be represented by a specific price point. MIT orders can be used to determine whether or not to enter the market once a specific price level has been achieved. This order is held in the system until the trigger price is touched, and is then submitted as a market order. An MIT order is similar to a stop order, except that an MIT sell order is placed above the current market price, and a stop sell order is placed below

Products: BOND, CFD, CASH, FUT, FOP, OPT, STK, WAR

More on [Market If Touched Orders](https://www.interactivebrokers.com/en/index.php?f=600)

More on [Supported exchanges](https://www.interactivebrokers.com/en/index.php?f=3883?ot=mit)

  - Python
  - cURL
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
order = Order()
order.action = action
order.orderType = "MIT"
order.totalQuantity = quantity
order.auxPrice = price
```

``` EnlighterJSRAW
curl --insecure https://localhost:5000/v1/api/iserver/account/{{accountId}}/orders \
--request POST \
--header 'Content-Type:application/json' \
--data '{
  "orders": [
    {
      "conid": conid,
      "orderType": "MIT",
      "side": "side",
      "tif": "tif",
      "quantity": quantity
    }
  ]
}
```

``` EnlighterJSRAW
Order order = new Order();
order.action(action);
order.orderType("MIT");
order.totalQuantity(quantity);
order.auxPrice(price);
```

``` EnlighterJSRAW
Order order;
order.action = action;
order.orderType = "MIT";
order.totalQuantity = quantity;
order.auxPrice = price;
```

``` EnlighterJSRAW
Order order = new Order();
order.Action = action;
order.OrderType = "MIT";
order.TotalQuantity = quantity;
order.AuxPrice = price;
```

``` EnlighterJSRAW
Dim order As Order = New Order
order.Action = action
order.OrderType = "MIT"
order.TotalQuantity = quantity
order.AuxPrice = price
```

### Market On Close

A Market On Close (MOC) order is a market order that is submitted to execute as close to the closing price as possible.

Products: CFD, FUT, STK, WAR

More on [Market On Close Orders](https://www.interactivebrokers.com/en/index.php?f=599)

More on [Supported exchanges](https://www.interactivebrokers.com/en/index.php?f=3883?ot=moc)

  - Python
  - cURL
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
order = Order()
order.action = action
order.orderType = "MOC"
order.totalQuantity = quantity
```

``` EnlighterJSRAW
curl --insecure https://localhost:5000/v1/api/iserver/account/{{accountId}}/orders \
--request POST \
--header 'Content-Type:application/json' \
--data '{
  "orders": [
    {
      "conid": conid,
      "orderType": "MOC",
      "side": "side",
      "tif": "DAY",
      "quantity": quantity
    }
  ]
}
```

``` EnlighterJSRAW
order = Order()
order.action = action
order.orderType = "MOC"
order.totalQuantity = quantity
```

``` EnlighterJSRAW
Order order;
order.action = action;
order.orderType = "MOC";
order.totalQuantity = quantity;
```

``` EnlighterJSRAW
Order order = new Order();
order.Action = action;
order.OrderType = "MOC";
order.TotalQuantity = quantity;
```

``` EnlighterJSRAW
Dim order As Order = New Order
order.Action = action
order.OrderType = "MOC"
order.TotalQuantity = quantity
```

### Market On Open

A Market On Open (MOO) combines a market order with the OPG time in force to create an order that is automatically submitted at the market’s open and fills at the market price.

Products: CFD, FUT, STK, WAR

More on [Market On Open Orders](https://www.interactivebrokers.com/en/index.php?f=598)

More on [Supported exchanges](https://www.interactivebrokers.com/en/index.php?f=3883?ot=moo)

  - Python
  - cURL
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
order = Order()
order.action = action
order.orderType = "MKT"
order.totalQuantity = quantity
order.tif = "OPG"
```

``` EnlighterJSRAW
curl --insecure https://localhost:5000/v1/api/iserver/account/{{accountId}}/orders \
--request POST \
--header 'Content-Type:application/json' \
--data '{
  "orders": [
    {
      "conid": conid,
      "orderType": "MKT",
      "side": "side",
      "tif": "OPG",
      "quantity": quantity
    }
  ]
}
```

``` EnlighterJSRAW
Order order = new Order();
order.action(action);
order.orderType("MKT");
order.totalQuantity(quantity);
order.tif("OPG");
```

``` EnlighterJSRAW
Order order;
order.action = action;
order.orderType = "MKT";
order.totalQuantity = quantity;
order.tif = "OPG";
```

``` EnlighterJSRAW
Order order = new Order();
order.Action = action;
order.OrderType = "MKT";
order.TotalQuantity = quantity;
order.Tif = "OPG";
```

``` EnlighterJSRAW
Dim order As Order = New Order
order.Action = action
order.OrderType = "MKT"
order.TotalQuantity = quantity
order.Tif = "OPG"
```

### Market to Limit

A Market-to-Limit (MTL) order is submitted as a market order to execute at the current best market price. If the order is only partially filled, the remainder of the order is canceled and re-submitted as a limit order with the limit price equal to the price at which the filled portion of the order executed.

Products: CFD, FUT, FOP, OPT, STK, WAR

More on [Market to Limit Orders](https://www.interactivebrokers.com/en/index.php?f=597)

More on [Supported exchanges](https://www.interactivebrokers.com/en/index.php?f=3883?ot=mtl)

  - Python
  - cURL
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
order = Order()
order.action = action
order.orderType = "MTL"
order.totalQuantity = quantity
```

Not available for use in the Client Portal API.

``` EnlighterJSRAW
Order order = new Order();
order.action(action);
order.orderType("MTL");
order.totalQuantity(quantity);
```

``` EnlighterJSRAW
Order order;
order.action = action;
order.orderType = "MTL";
order.totalQuantity = quantity;
```

``` EnlighterJSRAW
Order order = new Order();
order.Action = action;
order.OrderType = "MTL";
order.TotalQuantity = quantity;
```

``` EnlighterJSRAW
Dim order As Order = New Order
order.Action = action
order.OrderType = "MTL"
order.TotalQuantity = quantity
```

### Market with Protection

This order type is useful for futures traders using Globex. A Market with Protection order is a market order that will be cancelled and resubmitted as a limit order if the entire order does not immediately execute at the market price. The limit price is set by Globex to be close to the current market price, slightly higher for a sell order and lower for a buy order.

Products: FUT, FOP

More on [Market with Protection](https://www.interactivebrokers.com/en/index.php?f=601) Orders

More on [Supported exchanges](https://www.interactivebrokers.com/en/index.php?f=3883?ot=mktprot)

  - Python
  - cURL
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
order = Order()
order.action = action
order.orderType = "MKT PRT"
order.totalQuantity = quantity
```

Not available for use in the Client Portal API.

``` EnlighterJSRAW
Order order = new Order();
order.action(action);
order.orderType("MKT PRT");
order.totalQuantity(quantity);
```

``` EnlighterJSRAW
Order order;
order.action = action;
order.orderType = "MKT PRT";
order.totalQuantity = quantity;
```

``` EnlighterJSRAW
Order order = new Order();
order.Action = action;
order.OrderType = "MKT PRT";
order.TotalQuantity = quantity;
```

``` EnlighterJSRAW
Dim order As Order = New Order
order.Action = action
order.OrderType = "MKT PRT"
order.TotalQuantity = quantity
```

### Passive Relative

Passive Relative orders provide a means for traders to seek a less aggressive price than the National Best Bid and Offer (NBBO) while keeping the order pegged to the best bid (for a buy) or ask (for a sell). The order price is automatically adjusted as the markets move to keep the order less aggressive. For a buy order, your order price is pegged to the NBB by a less aggressive offset, and if the NBB moves up, your bid will also move up. If the NBB moves down, there will be no adjustment because your bid will become aggressive and execute. For a sell order, your price is pegged to the NBO by a less aggressive offset, and if the NBO moves down, your offer will also move down. If the NBO moves up, there will be no adjustment because your offer will become aggressive and execute. In addition to the offset, you can define an absolute cap, which works like a limit price, and will prevent your order from being executed above or below a specified level. The Passive Relative order is similar to the Relative/Pegged-to-Primary order, except that the Passive relative subtracts the offset from the bid and the Relative adds the offset to the bid.

Products: STK, WAR

More on [Passive Relative Orders](https://www.interactivebrokers.com/en/index.php?f=3124)

More on [Supported exchanges](https://www.interactivebrokers.com/en/index.php?f=3883?ot=passvrel)

  - Python
  - cURL
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
order = Order()
order.action = action
order.orderType = "PASSV REL"
order.totalQuantity = quantity
order.auxPrice = offset
```

Not available for use in the Client Portal API.

``` EnlighterJSRAW
Order order = new Order();
order.action(action);
order.orderType("PASSV REL");
order.totalQuantity(quantity);
order.auxPrice(offset);
```

``` EnlighterJSRAW
Order order;
order.action = action;
order.orderType = "PASSV REL";
order.totalQuantity = quantity;
order.auxPrice = offset;
```

``` EnlighterJSRAW
Order order = new Order();
order.Action = action;
order.OrderType = "PASSV REL";
order.TotalQuantity = quantity;
order.AuxPrice = offset;
```

``` EnlighterJSRAW
Dim order As Order = New Order
order.Action = action
order.OrderType = "PASSV REL"
order.TotalQuantity = quantity
order.AuxPrice = offset
```

### Peg Orders

### Pegged to Benchmark

The Pegged to Benchmark order is similar to the Pegged to Stock order for options, except that the Pegged to Benchmark allows you to specify any asset type as the reference (benchmark) contract for a stock or option order. Both the primary and reference contracts must use the same currency.

Products: STK, OPT

More on [Pegged to Benchmark Orders](https://www.interactivebrokers.com/en/index.php?f=7100)

More on [Supported exchanges](https://www.interactivebrokers.com/en/index.php?f=3883?ot=pegbench)

  - Python
  - cURL
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
order = Order()
order.orderType = "PEG BENCH"
#BUY or SELL
order.action = action
order.totalQuantity = quantity
#Beginning with price...
order.startingPrice = startingPrice
#increase/decrease price..
order.isPeggedChangeAmountDecrease = peggedChangeAmountDecrease
#by... (and likewise for price moving in opposite direction)
order.peggedChangeAmount = peggedChangeAmount
#whenever there is a price change of...
order.referenceChangeAmount = referenceChangeAmount
#in the reference contract...
order.referenceContractId = referenceConId
#being traded at...
order.referenceExchange = referenceExchange
#starting reference price is...
order.stockRefPrice = stockReferencePrice
#Keep order active as long as reference contract trades between...
order.stockRangeLower = referenceContractLowerRange
#and...
order.stockRangeUpper = referenceContractUpperRange
```

Not available for use in the Client Portal API.

``` EnlighterJSRAW
Order order = new Order();
order.orderType("PEG BENCH");
//BUY or SELL
order.action(action);
order.totalQuantity(quantity);
//Beginning with price...
order.startingPrice(startingPrice);
//increase/decrease price...
order.isPeggedChangeAmountDecrease(peggedChangeAmountDecrease);
//by... (and likewise for price moving in opposite direction)
order.peggedChangeAmount(peggedChangeAmount);
//whenever there is a price change of...
order.referenceChangeAmount(referenceChangeAmount);
//in the reference contract...
order.referenceContractId(referenceConId);
//being traded at...
order.referenceExchangeId(referenceExchange);
//starting reference price is...
order.stockRefPrice(stockReferencePrice);
//Keep order active as long as reference contract trades between...
order.stockRangeLower(referenceContractLowerRange);
//and...
order.stockRangeUpper(referenceContractUpperRange);
```

``` EnlighterJSRAW
Order order = new Order();
order.orderType("PEG BENCH");
//BUY or SELL
order.action(action);
order.totalQuantity(quantity);
//Beginning with price...
order.startingPrice(startingPrice);
//increase/decrease price...
order.isPeggedChangeAmountDecrease(peggedChangeAmountDecrease);
//by... (and likewise for price moving in opposite direction)
order.peggedChangeAmount(peggedChangeAmount);
//whenever there is a price change of...
order.referenceChangeAmount(referenceChangeAmount);
//in the reference contract...
order.referenceContractId(referenceConId);
//being traded at...
order.referenceExchangeId(referenceExchange);
//starting reference price is...
order.stockRefPrice(stockReferencePrice);
//Keep order active as long as reference contract trades between...
order.stockRangeLower(referenceContractLowerRange);
//and...
order.stockRangeUpper(referenceContractUpperRange);
```

``` EnlighterJSRAW
Order order = new Order();
order.OrderType = "PEG BENCH";
//BUY or SELL
order.Action = action;
order.TotalQuantity = quantity;
//Beginning with price...
order.StartingPrice = startingPrice;
//increase/decrease price..
order.IsPeggedChangeAmountDecrease = peggedChangeAmountDecrease;
//by... (and likewise for price moving in opposite direction)
order.PeggedChangeAmount = peggedChangeAmount;
//whenever there is a price change of...
order.ReferenceChangeAmount = referenceChangeAmount;
//in the reference contract...
order.ReferenceContractId = referenceConId;
//being traded at...
order.ReferenceExchange = referenceExchange;
//starting reference price is...
order.StockRefPrice = stockReferencePrice;
//Keep order active as long as reference contract trades between...
order.StockRangeLower = referenceContractLowerRange;
//and...
order.StockRangeUpper = referenceContractUpperRange;
```

``` EnlighterJSRAW
Dim order As Order = New Order
order.OrderType = "PEG BENCH"
'BUY Or SELL
order.Action = action
order.TotalQuantity = quantity
'Beginning with price...
order.StartingPrice = startingPrice
'increase/decrease price..
order.IsPeggedChangeAmountDecrease = peggedChangeAmountDecrease
'by... (And likewise for price moving in opposite direction)
order.PeggedChangeAmount = peggedChangeAmount
'whenever there Is a price change of...
order.ReferenceChangeAmount = referenceChangeAmount
'in the reference contract...
order.ReferenceContractId = referenceConId
'being traded at...
order.ReferenceExchange = referenceExchange
'starting reference price Is...
order.StockRefPrice = stockReferencePrice
'Keep order active as long as reference contract trades between...
order.StockRangeLower = referenceContractLowerRange
'And...
order.StockRangeUpper = referenceContractUpperRange
```

### Pegged To Market

A pegged-to-market order is designed to maintain a purchase price relative to the national best offer (NBO) or a sale price relative to the national best bid (NBB). Depending on the width of the quote, this order may be passive or aggressive. The trader creates the order by entering a limit price which defines the worst limit price that they are willing to accept. Next, the trader enters an offset amount which computes the active limit price as follows: Sell order price = Bid price + offset amount Buy order price = Ask price – offset amount

Products: STK

More on [Pegged To Market Orders](https://www.interactivebrokers.com/en/index.php?f=616)

More on [Supported exchanges](https://www.interactivebrokers.com/en/index.php?f=3883?ot=pegmkt)

  - Python
  - cURL
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
order = Order()
order.action = action
order.orderType = "PEG MKT"
order.totalQuantity = quantity
order.auxPrice = marketOffset#Offset price
```

Not available for use in the Client Portal API.

``` EnlighterJSRAW
Order order = new Order();
order.action(action);
order.orderType("PEG MKT");
order.totalQuantity(Decimal.ONE_HUNDRED);
order.auxPrice(marketOffset);//Offset price
```

``` EnlighterJSRAW
Order order;
order.action = action;
order.orderType = "PEG MKT";
order.totalQuantity = quantity;
order.auxPrice = marketOffset;
```

``` EnlighterJSRAW
Order order = new Order();
order.Action = action;
order.OrderType = "PEG MKT";
order.TotalQuantity = 100;
order.AuxPrice = marketOffset;//Offset price
```

``` EnlighterJSRAW
Dim order As Order = New Order
order.Action = action
order.OrderType = "PEG MKT"
order.TotalQuantity = 100
order.AuxPrice = marketOffset ' Offset price
```

### Pegged To Primary / Relative

Relative (a.k.a. Pegged-to-Primary) orders provide a means for traders to seek a more aggressive price than the National Best Bid and Offer (NBBO). By acting as liquidity providers, and placing more aggressive bids and offers than the current best bids and offers, traders increase their odds of filling their order. Quotes are automatically adjusted as the markets move, to remain aggressive. Stocks, Options and Futures – not available on paper trading.

Products: CFD, STK, OPT, FUT

More on [Pegged To Primary Orders](https://www.interactivebrokers.com/en/index.php?f=613)

More on [Supported exchanges](https://www.interactivebrokers.com/en/index.php?f=3883?ot=rel)

  - Python
  - cURL
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
order = Order()
order.action = action
order.orderType = "REL"
order.totalQuantity = quantity
order.lmtPrice = priceCap
order.auxPrice = offsetAmount
```

``` EnlighterJSRAW
curl {baseURL}/iserver/account/{accountId}/orders \
--request POST \
--header 'Content-Type:application/json' \
--data '{
  "orders": [
    {
      "conid": conid,
      "orderType": "REL",
      "price": Limit_Price,
      "auxPrice": Offset_Price,
      "side": "side",
      "quantity": quantity
    }
  ]
}
```

``` EnlighterJSRAW
Order order = new Order();
order.action(action);
order.orderType("REL");
order.totalQuantity(quantity);
order.lmtPrice(priceCap);
order.auxPrice(offsetAmount);
```

``` EnlighterJSRAW
Order order;
order.action = action;
order.orderType = "REL";
order.totalQuantity = quantity;
order.lmtPrice = priceCap;
order.auxPrice = offsetAmount;
```

``` EnlighterJSRAW
Order order = new Order();
order.Action = action;
order.OrderType = "REL";
order.TotalQuantity = quantity;
order.LmtPrice = priceCap;
order.AuxPrice = offsetAmount;
```

``` EnlighterJSRAW
Dim order As Order = New Order
order.Action = action
order.OrderType = "REL"
order.TotalQuantity = quantity
order.LmtPrice = priceCap
order.AuxPrice = offsetAmount
```

### Pegged To Stock

A Pegged to Stock order continually adjusts the option order price by the product of a signed user-define delta and the change of the option’s underlying stock price. The delta is entered as an absolute and assumed to be positive for calls and negative for puts. A buy or sell call order price is determined by adding the delta times a change in an underlying stock price to a specified starting price for the call. To determine the change in price, the stock reference price is subtracted from the current NBBO midpoint. The Stock Reference Price can be defined by the user, or defaults to the NBBO midpoint at the time of the order if no reference price is entered. You may also enter a high/low stock price range which cancels the order when reached. The delta times the change in stock price will be rounded to the nearest penny in favor of the order.

Products: OPT

More on [Pegged To Stock Orders](https://www.interactivebrokers.com/en/index.php?f=615)

More on [Supported exchanges](https://www.interactivebrokers.com/en/index.php?f=3883?ot=relstk)

  - Python
  - cURL
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
order = Order()
order.action = action
order.orderType = "PEG STK"
order.totalQuantity = quantity
order.delta = delta
order.stockRefPrice = stockReferencePrice
order.startingPrice = startingPrice
```

Not available for use in the Client Portal API.

``` EnlighterJSRAW
Order order = new Order();
order.action(action);
order.orderType("PEG STK");
order.totalQuantity(quantity);
order.delta(delta);
order.stockRefPrice(stockReferencePrice);
order.startingPrice(startingPrice);
```

``` EnlighterJSRAW
Order order;
order.action = action;
order.orderType = "PEG STK";
order.totalQuantity = quantity;
order.delta = delta;
order.stockRefPrice = stockReferencePrice;
order.startingPrice = startingPrice;
```

``` EnlighterJSRAW
Order order = new Order();
order.Action = action;
order.OrderType = "PEG STK";
order.TotalQuantity = quantity;
order.Delta = delta;
order.StockRefPrice = stockReferencePrice;
order.StartingPrice = startingPrice;
```

``` EnlighterJSRAW
Dim order As Order = New Order
order.Action = action
order.OrderType = "PEG STK"
order.TotalQuantity = quantity
order.Delta = delta
order.StockRefPrice = stockReferencePrice
order.StartingPrice = startingPrice
```

### Relative Limit Combo

Create combination orders that include options, stock and futures legs (stock legs can be included if the order is routed through SmartRouting). Although a combination/spread order is constructed of separate legs, it is executed as a single transaction if it is routed directly to an exchange. For combination orders that are SmartRouted, each leg may be executed separately to ensure best execution.

Products: OPT, STK, FUT

  - Python
  - cURL
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
order = Order()
order.action = action
order.totalQuantity = quantity
order.orderType = "REL + LMT"
order.lmtPrice = limitPrice

if nonGuaranteed:
    order.smartComboRoutingParams = []
    order.smartComboRoutingParams.append(TagValue("NonGuaranteed", "1"))
```

Not available for use in the Client Portal API.

``` EnlighterJSRAW
Order order = new Order();
order.action(action);
order.orderType("REL + LMT");
order.totalQuantity(quantity);
order.lmtPrice(limitPrice);
if (nonGuaranteed)
{
    order.smartComboRoutingParams().add(new TagValue("NonGuaranteed", "1"));
}
```

``` EnlighterJSRAW
Order order;
order.action = action;
order.totalQuantity = quantity;
order.orderType = "Rel + LMT";
order.lmtPrice = limitPrice;
if(nonGuaranteed){
    TagValueSPtr tag1(new TagValue("NonGuaranteed", "1"));
    order.smartComboRoutingParams.reset(new TagValueList());
    order.smartComboRoutingParams->push_back(tag1);
}
```

``` EnlighterJSRAW
Order order = new Order();
order.Action = action;
order.TotalQuantity = quantity;
order.OrderType = "REL + LMT";
order.LmtPrice = limitPrice;
if (nonGuaranteed)
{
    order.SmartComboRoutingParams = new List<TagValue>();
    order.SmartComboRoutingParams.Add(new TagValue("NonGuaranteed", "1"));
}
```

``` EnlighterJSRAW
Dim order As Order = New Order
order.Action = action
order.TotalQuantity = quantity
order.OrderType = "REL + LMT"
order.LmtPrice = limitPrice
If (nonGuaranteed) Then
    order.SmartComboRoutingParams = New List(Of TagValue)
    order.SmartComboRoutingParams.Add(New TagValue("NonGuaranteed", "1"))
End If
```

### Relative Market Combo

Create combination orders that include options, stock and futures legs (stock legs can be included if the order is routed through SmartRouting). Although a combination/spread order is constructed of separate legs, it is executed as a single transaction if it is routed directly to an exchange. For combination orders that are SmartRouted, each leg may be executed separately to ensure best execution.

Products: OPT, STK, FUT

  - Python
  - cURL
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
order = Order()
order.action = action
order.totalQuantity = quantity
order.orderType = "REL + MKT"

if nonGuaranteed:
    order.smartComboRoutingParams = []
    order.smartComboRoutingParams.append(TagValue("NonGuaranteed", "1"))
```

Not available for use in the Client Portal API.

``` EnlighterJSRAW
Order order = new Order();
order.action(action);
order.orderType("REL + MKT");
order.totalQuantity(quantity);
if (nonGuaranteed)
{
    order.smartComboRoutingParams().add(new TagValue("NonGuaranteed", "1"));
}
```

``` EnlighterJSRAW
Order order;
order.action = action;
order.totalQuantity = quantity;
order.orderType = "Rel + MKT";
if(nonGuaranteed){
    TagValueSPtr tag1(new TagValue("NonGuaranteed", "1"));
    order.smartComboRoutingParams.reset(new TagValueList());
    order.smartComboRoutingParams->push_back(tag1);
}
```

``` EnlighterJSRAW
Order order = new Order();
order.Action = action;
order.TotalQuantity = quantity;
order.OrderType = "REL + MKT";
if (nonGuaranteed)
{
    order.SmartComboRoutingParams = new List<TagValue>();
    order.SmartComboRoutingParams.Add(new TagValue("NonGuaranteed", "1"));
}
```

``` EnlighterJSRAW
Dim order As Order = New Order
order.Action = action
order.TotalQuantity = quantity
order.OrderType = "REL + MKT"
If (nonGuaranteed) Then
    order.SmartComboRoutingParams = New List(Of TagValue)
    order.SmartComboRoutingParams.Add(New TagValue("NonGuaranteed", "1"))
End If
```

### Stop

A Stop order is an instruction to submit a buy or sell market order if and when the user-specified stop trigger price is attained or penetrated. A Stop order is not guaranteed a specific execution price and may execute significantly away from its stop price. A Sell Stop order is always placed below the current market price and is typically used to limit a loss or protect a profit on a long stock position. A Buy Stop order is always placed above the current market price. It is typically used to limit a loss or help protect a profit on a short sale.

Products: CFD, BAG, CASH, FUT, FOP, OPT, STK, WAR

More on [Stop Orders](https://www.interactivebrokers.com/en/index.php?f=609)

More on [Supported exchanges](https://www.interactivebrokers.com/en/index.php?f=3883?ot=stp)

  - Python
  - cURL
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
order = Order()
order.action = action
order.orderType = "STP"
order.auxPrice = stopPrice
order.totalQuantity = quantity
```

``` EnlighterJSRAW
curl --insecure https://localhost:5000/v1/api/iserver/account/{{accountId}}/orders \
--request POST \
--header 'Content-Type:application/json' \
--data '{
  "orders": [
    {
      "conid": conid,
      "orderType": "STP",
      "price": price,
      "side": "side",
      "tif": "tif",
      "quantity": quantity
    }
  ]
}
```

``` EnlighterJSRAW
Order order = new Order();
order.action(action);
order.orderType("STP");
order.auxPrice(stopPrice);
order.totalQuantity(quantity);
```

``` EnlighterJSRAW
Order order;
order.action = action;
order.orderType = "STP";
order.totalQuantity = quantity;
order.auxPrice = stopPrice;
```

``` EnlighterJSRAW
Order order = new Order();
order.Action = action;
order.OrderType = "STP";
order.AuxPrice = stopPrice;
order.TotalQuantity = quantity;
```

``` EnlighterJSRAW
Dim order As Order = New Order
order.Action = action
order.OrderType = "STP"
order.AuxPrice = stopPrice
order.TotalQuantity = quantity
```

### Stop Limit

A Stop-Limit order is an instruction to submit a buy or sell limit order when the user-specified stop trigger price is attained or penetrated. The order has two basic components: the stop price and the limit price. When a trade has occurred at or through the stop price, the order becomes executable and enters the market as a limit order, which is an order to buy or sell at a specified price or better.

Products: CFD, CASH, FUT, FOP, OPT, STK, WAR

More on [Stop Limit Orders](https://www.interactivebrokers.com/en/index.php?f=608)

More on [Supported exchanges](https://www.interactivebrokers.com/en/index.php?f=3883?ot=stplmt)

  - Python
  - cURL
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
order = Order()
order.action = action
order.orderType = "STP LMT"
order.totalQuantity = quantity
order.lmtPrice = limitPrice
order.auxPrice = stopPrice
```

``` EnlighterJSRAW
curl --insecure https://localhost:5000/v1/api/iserver/account/{{accountId}}/orders \
--request POST \
--header 'Content-Type:application/json' \
--data '{
  "orders": [
    {
      "conid": conid,
      "orderType": "STP LMT",
      "price": price,
      "auxPrice": "auxPrice",
      "side": "side",
      "tif": "tif",
      "quantity": quantity
    }
  ]
}
```

Price is the Limit price while auxPrice represents the stop price trigger.  
 

``` EnlighterJSRAW
Order order = new Order();
order.action(action);
order.orderType("STP LMT");
order.lmtPrice(limitPrice);
order.auxPrice(stopPrice);
order.totalQuantity(quantity);
```

``` EnlighterJSRAW
Order order;
order.action = action;
order.orderType = "STP LMT";
order.totalQuantity = quantity;
order.lmtPrice = limitPrice;
order.auxPrice = stopPrice;
```

``` EnlighterJSRAW
Order order = new Order();
order.Action = action;
order.OrderType = "STP LMT";
order.TotalQuantity = quantity;
order.LmtPrice = limitPrice;
order.AuxPrice = stopPrice;
```

``` EnlighterJSRAW
Dim order As Order = New Order
order.Action = action
order.OrderType = "STP LMT"
order.TotalQuantity = quantity
order.LmtPrice = limitPrice
order.AuxPrice = stopPrice
```

### Stop with Protection

A Stop with Protection order combines the functionality of a stop limit order with a market with protection order. The order is set to trigger at a specified stop price. When the stop price is penetrated, the order is triggered as a market with protection order, which means that it will fill within a specified protected price range equal to the trigger price +/- the exchange-defined protection point range. Any portion of the order that does not fill within this protected range is submitted as a limit order at the exchange-defined trigger price +/- the protection points.

Products: FUT

More on [Stop with Protection](https://www.interactivebrokers.com/en/index.php?f=3077) Orders

More on [Supported exchanges](https://www.interactivebrokers.com/en/index.php?f=3883?ot=stpprot)

  - Python
  - cURL
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
order = Order()
order.totalQuantity = quantity
order.action = action
order.orderType = "STP PRT"
order.auxPrice = stopPrice
```

Not available for use in the Client Portal API.

``` EnlighterJSRAW
Order order = new Order();
order.action(action);
order.orderType("STP PRT");
order.auxPrice(stopPrice);
order.totalQuantity(quantity);
```

``` EnlighterJSRAW
Order order;
order.action = action;
order.orderType = "STP PRT";
order.totalQuantity = quantity;
order.auxPrice = stopPrice;
```

``` EnlighterJSRAW
Order order = new Order();
order.TotalQuantity = quantity;
order.Action = action;
order.OrderType = "STP PRT";
order.AuxPrice = stopPrice;
```

``` EnlighterJSRAW
Dim order As Order = New Order
order.TotalQuantity = quantity
order.Action = action
order.OrderType = "STP PRT"
order.AuxPrice = stopPrice
```

### Sweep to Fill

Sweep-to-fill orders are useful when a trader values speed of execution over price. A sweep-to-fill order identifies the best price and the exact quantity offered/available at that price, and transmits the corresponding portion of your order for immediate execution. Simultaneously it identifies the next best price and quantity offered/available, and submits the matching quantity of your order for immediate execution.

Products: CFD, STK, WAR (SMART only)

More on [Sweep to Fill Orders](https://www.interactivebrokers.com/en/index.php?f=607)

  - Python
  - cURL
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
order = Order()
order.action = action
order.orderType = "LMT"
order.totalQuantity = quantity
order.lmtPrice = price
order.sweepToFill = True
```

Not available for use in the Client Portal API.

``` EnlighterJSRAW
Order order = new Order();
order.action(action);
order.orderType("LMT");
order.totalQuantity(quantity);
order.lmtPrice(price);
order.sweepToFill(true);
```

``` EnlighterJSRAW
Order order;
order.action = action;
order.orderType = "LMT";
order.totalQuantity = quantity;
order.lmtPrice = price;
order.sweepToFill = true;
```

``` EnlighterJSRAW
Order order = new Order();
order.Action = action;
order.OrderType = "LMT";
order.TotalQuantity = quantity;
order.LmtPrice = price;
order.SweepToFill = true;
```

``` EnlighterJSRAW
Dim order As Order = New Order
order.Action = action
order.OrderType = "LMT"
order.TotalQuantity = quantity
order.LmtPrice = price
order.SweepToFill = True
```

### Trailing Stop

For a discussion of the handling and behavior of Trailing Stop orders, please see our brokerage-wide documentation on this order type at: [Trailing Stop Orders](https://www.interactivebrokers.com/en/index.php?f=605)  
Supported exchanges for Trailing Stop orders: [Supported Exchanges](https://www.interactivebrokers.com/en/index.php?f=3883?ot=trail)

###### Order Type Identifier:

“TRAIL”

###### Parameters:

**Trail Offset.** Required.  
Specifies the distance that your order’s stop price will maintain away from the market. A Trailing Stop order ticket must include exactly one of the following two forms of Trail Offset:

  - **Absolute Offset:** An explicit numerical value (in the instrument’s currency) which will be added to or subtracted from the market price of the instrument.
  - **Relative Offset:** A percentage of the market price of the instrument, from which absolute price offsets will be computed (which in turn may vary in size as the market price moves).

***Note: The Trail Offset value, whether absolute or relative, must conform to the instrument’s price increment rules.***

**Stop Price.**  
This value is not required. If supplied, this is the trigger price beyond which the Trailing Stop order will begin its trailing behavior. If no Stop Price value is supplied, the market price for the instrument at the time of submission will assigned to this value automatically.

### TWS API: Trailing Stop

**Trail Offset.** Required.  
One of the following class attributes must be supplied with the order ticket.

  - **Absolute Offset:** `Order.auxPrice`
  - **Relative Offset:** `Order.trailingPercent`  
    Note that the value assigned to `trailingPercent` will be interpreted as a true percent, e.g., `trailingPercent = 0.50` becomes 0.50% = 0.0050.

**Stop Price:** `Order.trailStopPrice`

In the example to the right, we have outlined two Trailing Stop orders with explicit Stop Prices via `order.trailStopPrice`.  
In the first order, we supply a relative offset of 2% using `order.TrailStopPercent`.  
In the second order, we supply an absolute offset of 3 units of currency using `order.auxPrice`.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
order = Order()
order.orderType = "TRAIL"
order.trailStopPrice = 100
order.trailingPercent = 2
```

``` EnlighterJSRAW
order = Order()
order.orderType = "TRAIL"
order.trailStopPrice = 100
order.auxPrice = 3
```

``` EnlighterJSRAW
Order order = new Order();
order.orderType("TRAIL");
order.trailStopPrice(100);
order.trailingPercent(2);
```

``` EnlighterJSRAW
Order order = new Order();
order.orderType("TRAIL");
order.trailStopPrice(100);
order.auxPrice(3);
```

``` EnlighterJSRAW
Order order;
order.orderType = "TRAIL";
order.trailStopPrice = 100;
order.trailingPercent = 2;
```

``` EnlighterJSRAW
Order order;
order.orderType = "TRAIL";
order.trailStopPrice = 100;
order.auxPrice = 3;
```

``` EnlighterJSRAW
Order order = new Order();
order.OrderType = "TRAIL";
order.TrailStopPrice = 100;
order.TrailingPercent = 2;
```

``` EnlighterJSRAW
Order order = new Order();
order.OrderType = "TRAIL";
order.TrailStopPrice = 100;
order.AuxPrice= 3;
```

``` EnlighterJSRAW
Dim order As Order = New Order
order.OrderType = "TRAIL"
order.TrailStopPrice = 100
order.TrailingPercent = 2
```

``` EnlighterJSRAW
Dim order As Order = New Order
order.OrderType = "TRAIL"
order.TrailStopPrice = 100
order.AuxPrice= 3
```

### CP API: Trailing Stop

**Trail Offset.** Required.  
One of the following approaches to Trail Offset specification must be used with the order ticket.

  - **Absolute Offset:** `"trailingType": "amt", "trailingAmt": {{currency}}`
  - **Relative Offset:** `"trailingType": "%", "trailingAmt": {{number 0 to 100}}`  
    Note that you must pass a literal % character as the value of the trailingType field in order to use a percentage trailingAmt value.

**Stop Price:** `"price"`

In the example to the right, we have outlined two Trailing Stop orders with explicit Stop Prices via the `price` field.  
In the first order, we supply a relative offset of 2% using `"trailingType": "%"` and `"trailingAmt": 2`.  
In the second order, we supply an absolute offset of 3 units of currency using `"trailingType": "amt"` and `"trailingAmt": 3`.

``` EnlighterJSRAW
{
  "orderType": "TRAIL",
  "price": 100,
  "trailingAmt": 2,
  "trailingType": "%"
}
```

``` EnlighterJSRAW
{
  "orderType": "TRAIL",
  "price": 100,
  "trailingAmt": 3,
  "trailingType": "amt"
}
```

### Trailing Stop Limit

A trailing stop limit order is designed to allow an investor to specify a limit on the maximum possible loss, without setting a limit on the maximum possible gain. A SELL trailing stop limit moves with the market price, and continually recalculates the stop trigger price at a fixed amount below the market price, based on the user-defined “trailing” amount. The limit order price is also continually recalculated based on the limit offset. As the market price rises, both the stop price and the limit price rise by the trail amount and limit offset respectively, but if the stock price falls, the stop price remains unchanged, and when the stop price is hit a limit order is submitted at the last calculated limit price. A “Buy” trailing stop limit order is the mirror image of a sell trailing stop limit, and is generally used in falling markets.

Trailing Stop Limit orders can be sent with the trailing amount specified as an absolute amount, as in the example below, or as a percentage, specified in the trailingPercent field.

**Important:** the ‘limit offset’ field is set by default in the TWS/IBG settings. This setting either needs to be changed in the Order Presets, the default value accepted, or the limit price offset sent from the API as in the example below. Not both the ‘limit price’ and ‘limit price offset’ fields can be set in TRAIL LIMIT orders.

Products: BOND, CFD, CASH, FUT, FOP, OPT, STK, WAR

More on [Trailing Stop Limit Orders](https://www.interactivebrokers.com/en/index.php?f=606)

  - Python
  - cURL
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
order = Order()
order.action = action
order.orderType = "TRAIL LIMIT"
order.totalQuantity = quantity
order.trailStopPrice = trailStopPrice
order.lmtPriceOffset = lmtPriceOffset
order.auxPrice = trailingAmount
```

``` EnlighterJSRAW
curl --insecure https://localhost:5000/v1/api/iserver/account/{{accountId}}/orders \
--request POST \
--header 'Content-Type:application/json' \
--data '{
  "orders": [
    {
      "conid": conid,
      "orderType": "TRAILLMT",
      "price": price,
      "auxPrice": "auxPrice",
      "side": "side",
      "tif": "tif",
      "trailingAmt": trailingAmt,
      "trailingType": "trailingType",
      "quantity": quantity
    }
  ]
}
```

``` EnlighterJSRAW
Order order = new Order();
order.action(action);
order.orderType("TRAIL LIMIT");
order.lmtPriceOffset(lmtPriceOffset);
order.auxPrice(trailingAmount);
order.trailStopPrice(trailStopPrice);
order.totalQuantity(quantity);
```

``` EnlighterJSRAW
Order order;
order.action = action;
order.orderType = "TRAIL LIMIT";
order.totalQuantity = quantity;
order.trailStopPrice = trailStopPrice;
order.lmtPriceOffset = lmtPriceOffset;
order.auxPrice = trailingAmount;
```

``` EnlighterJSRAW
Order order = new Order();
order.Action = action;
order.OrderType = "TRAIL LIMIT";
order.TotalQuantity = quantity;
order.TrailStopPrice = trailStopPrice;
order.LmtPriceOffset = lmtPriceOffset;
order.AuxPrice = trailingAmount;
```

``` EnlighterJSRAW
Dim order As Order = New Order
order.Action = action
order.OrderType = "TRAIL LIMIT"
order.TotalQuantity = quantity
order.LmtPriceOffset = lmtPriceOffset
order.TrailStopPrice = trailStopPrice
order.AuxPrice = trailingAmount
```

### Volatility

Specific to US options, investors are able to create and enter Volatility-type orders for options and combinations rather than price orders. Option traders may wish to trade and position for movements in the price of the option determined by its implied volatility. Because implied volatility is a key determinant of the premium on an option, traders position in specific contract months in an effort to take advantage of perceived changes in implied volatility arising before, during or after earnings or when company specific or broad market volatility is predicted to change. In order to create a Volatility order, clients must first create a Volatility Trader page from the Trading Tools menu and as they enter option contracts, premiums will display in percentage terms rather than premium. The buy/sell process is the same as for regular orders priced in premium terms except that the client can limit the volatility level they are willing to pay or receive.

Products: FOP, OPT

More on [Volatility Type Orders](https://www.interactivebrokers.com/en/index.php?f=604)

More on [Supported exchanges](https://www.interactivebrokers.com/en/index.php?f=3883?ot=volat)

  - Python
  - cURL
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
order = Order()
order.action = action
order.orderType = "VOL"
order.totalQuantity = quantity
order.volatility = volatilityPercent#Expressed in percentage (40%)
order.volatilityType = volatilityType# 1=daily, 2=annual
```

Not available for use in the Client Portal API.

``` EnlighterJSRAW
Order order = new Order();
order.action(action);
order.orderType("VOL");
order.volatility(volatilityPercent);//Expressed in percentage (40%)
order.volatilityType(volatilityType);// 1=daily, 2=annual
order.totalQuantity(quantity);
```

``` EnlighterJSRAW
Order order;
order.action = action;
order.orderType = "VOL";
order.totalQuantity = quantity;
order.volatility = volatilityPercent; //Expressed in percentage (40%)
order.volatilityType = volatilityType; // 1=daily, 2=annual
```

``` EnlighterJSRAW
Order order = new Order();
order.Action = action;
order.OrderType = "VOL";
order.TotalQuantity = quantity;
order.Volatility = volatilityPercent;//Expressed in percentage (40%)
order.VolatilityType = volatilityType;// 1=daily, 2=annual
```

``` EnlighterJSRAW
Dim order As Order = New Order
order.Action = action
order.OrderType = "VOL"
order.TotalQuantity = quantity
order.Volatility = volatilityPercent  'Expressed in percentage (40%)
order.VolatilityType = volatilityType  ' 1=daily, 2=annual
```

## Complex Orders

### Adjustable Stops

You can attach one-time adjustments to stop, stop limit, trailing stop and trailing stop limit orders. When you attach an adjusted order, you set a trigger price that triggers a modification of the original (or parent) order, instead of triggering order transmission.

You can adjust any of the parent stop order types to any other stop order type; for example if you set up a Stop Limit, you can attach the one-time adjustment to change the order to a Trailing Stop, or if you start with a Stop order the adjustment can change it to a Trailing Stop Limit order.

### Adjusted to Stop

**TriggerPrice:** Price threshold for when the order type should just to the AdjustedOrderType value.

**AdjustedOrderType:** Resulting order type in the event an order passes the triggerPrice threshold.  
This can be “STP”, “STP LMT”, “TRAIL”, “TRAILING LIMIT”

**AdjustedStopPrice:** The stop order’s trigger price after being adjusted.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
order = Order()
order.orderType = "TRAIL"
order.trailStopPrice = 100
order.auxPrice = 3

order.triggerPrice = triggerPrice
order.adjustedOrderType = "STP"
order.adjustedStopPrice = adjustStopPrice
```

``` EnlighterJSRAW
Order order = new Order();
order.orderType("TRAIL");
order.trailStopPrice(100);
order.trailingPercent(2);

order.triggerPrice(triggerPrice);
order.adjustedOrderType(OrderType.STP);
order.adjustedStopPrice(adjustStopPrice);
```

``` EnlighterJSRAW
Order order;
order.orderType = "TRAIL";
order.trailStopPrice = 100;
order.trailingPercent = 2;

order.triggerPrice = triggerPrice;
order.adjustedOrderType = "STP";
order.adjustedStopPrice = adjustStopPrice;
```

``` EnlighterJSRAW
Order order = new Order();
order.OrderType = "TRAIL";
order.TrailStopPrice = 100;
order.TrailingPercent = 2;

order.TriggerPrice = triggerPrice;
order.AdjustedOrderType = "STP";
order.AdjustedStopPrice = adjustStopPrice;
```

``` EnlighterJSRAW
Dim order As Order = New Order
order.OrderType = "TRAIL"
order.TrailStopPrice = 100
order.TrailingPercent = 2

order.TriggerPrice = triggerPrice
order.AdjustedOrderType = "STP"
order.AdjustedStopPrice = adjustStopPrice
```

### Adjusted to Stop Limit

**TriggerPrice:** Price threshold for when the order type should just to the AdjustedOrderType value.

**AdjustedOrderType:** Resulting order type in the event an order passes the triggerPrice threshold.  
This can be “STP”, “STP LMT”, “TRAIL”, “TRAILING LIMIT”

**AdjustedStopPrice:** The stop order’s trigger price after being adjusted.

**AdjustedStopLimitPrice:** The stop order’s limit price for execution after being adjusted.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
order = Order()
order.orderType = "TRAIL"
order.trailStopPrice = 100
order.auxPrice = 3

order.triggerPrice = triggerPrice
order.adjustedOrderType = "STP LMT"
order.adjustedStopPrice = adjustStopPrice
order.adjustedStopLimitPrice = adjustedStopLimitPrice
```

``` EnlighterJSRAW
Order order = new Order();
order.orderType("TRAIL");
order.trailStopPrice(100);
order.trailingPercent(2);

order.triggerPrice(triggerPrice);
order.adjustedOrderType("STP LMT");
order.adjustedStopPrice(adjustStopPrice);
order.adjustStopLimitPrice(adjustStopLimitPrice);
```

``` EnlighterJSRAW
Order order;
order.orderType = "TRAIL";
order.trailStopPrice = 100;
order.trailingPercent = 2;

order.triggerPrice = triggerPrice;
order.adjustedOrderType = "STP LMT";
order.adjustedStopPrice = adjustStopPrice;
order.adjustedStopLimitPrice = adjustedStopLimitPrice;
```

``` EnlighterJSRAW
Order order = new Order();
order.OrderType = "TRAIL";
order.TrailStopPrice = 100;
order.TrailingPercent = 2;

order.TriggerPrice = triggerPrice;
order.AdjustedOrderType = "STP LMT";
order.AdjustedStopPrice = adjustStopPrice;
order.AdjustedStopLimitPrice = adjustedStopLimitPrice;
```

``` EnlighterJSRAW
Dim order As Order = New Order
order.OrderType = "TRAIL"
order.TrailStopPrice = 100
order.TrailingPercent = 2

order.TriggerPrice = triggerPrice
order.AdjustedOrderType = "STP LMT"
order.AdjustedStopPrice = adjustStopPrice
order.AdjustedStopLimitPrice = adjustedStopLimitPrice
```

### Adjusted to Trail

**TriggerPrice:** Price threshold for when the order type should just to the AdjustedOrderType value.

**AdjustedOrderType:** Resulting order type in the event an order passes the triggerPrice threshold.  
This can be “STP”, “STP LMT”, “TRAIL”, “TRAILING LIMIT”.

**AdjustedStopPrice:** The trail order’s trigger price after being adjusted.

**AdjustableTrailingUnit:** Dictate how trail should be adjusted.  
This can be “amt” or “%”.

**AdjustedTrailingAmount:** The value to trail by. This will be a set amount or percentage based on the AdjustedTrailingUnit.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
order = Order()
order.action = action
order.orderType = "STP"
order.auxPrice = stopPrice
order.totalQuantity = quantity

order.triggerPrice = triggerPrice
order.adjustedOrderType = "TRAIL"
order.adjustedStopPrice = adjustedStopPrice
order.adjustableTrailingUnit = trailUnit
order.adjustedTrailingAmount = adjustedTrailAmount
```

``` EnlighterJSRAW
Order order = new Order();
order.action(action);
order.orderType("STP");
order.auxPrice(stopPrice);
order.totalQuantity(quantity);

order.triggerPrice(triggerPrice);
order.adjustedOrderType("TRAIL");
order.adjustedStopPrice(adjustStopPrice);
order.adjustableTrailingUnit(trailUnit);
order.adjustedTrailingAmount(adjustedTrailAmount);
```

``` EnlighterJSRAW
Order order;
order.action = action;
order.orderType = "STP";
order.totalQuantity = quantity;
order.auxPrice = stopPrice;

order.triggerPrice = triggerPrice;
order.adjustedOrderType = "TRAIL";
order.adjustedStopPrice = adjustStopPrice;
order.adjustableTrailingUnit = trailUnit;
order.adjustedTrailingAmount = adjustedTrailAmount;
```

``` EnlighterJSRAW
Order order = new Order();
order.Action = action;
order.OrderType = "STP";
order.AuxPrice = stopPrice;
order.TotalQuantity = quantity;

order.TriggerPrice = triggerPrice;
order.AdjustedOrderType = "TRAIL";
order.AdjustedStopPrice = adjustedStopPrice;
order.AdjustableTrailingUnit = trailUnit;
order.AdjustedTrailingAmount = adjustedTrailAmount;
```

``` EnlighterJSRAW
Dim order As Order = New Order
order.Action = action
order.OrderType = "STP"
order.AuxPrice = stopPrice
order.TotalQuantity = quantity

'Adjusted Stop Component
order.TriggerPrice = triggerPrice
order.AdjustedOrderType = "TRAIL"
order.AdjustedStopPrice = adjustedStopPrice
order.AdjustableTrailingUnit = trailUnit
order.AdjustedTrailingAmount = adjustedTrailAmount
```

### Adjusted to Trail Limit

**TriggerPrice:** Price threshold for when the order type should just to the AdjustedOrderType value.

**AdjustedOrderType:** Resulting order type in the event an order passes the triggerPrice threshold.  
This can be “STP”, “STP LMT”, “TRAIL”, “TRAILING LIMIT”.

**AdjustedStopPrice:** The trail order’s trigger price after being adjusted.

**AdjustedStopLimitPrice:** The trailing order’s limit price for execution after being adjusted.

**AdjustableTrailingUnit:** Dictate how trail should be adjusted.  
This can be “amt” or “%”.

**AdjustedTrailingAmount:** The value to trail by. This will be a set amount or percentage based on the AdjustedTrailingUnit.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
order = Order()
order.action = action
order.orderType = "STP"
order.auxPrice = stopPrice
order.totalQuantity = quantity

order.triggerPrice = triggerPrice
order.adjustedOrderType = "TRAIL LIMIT"
order.adjustedStopPrice = adjustedStopPrice
order.adjustedStopLimitPrice = adjustedStopLimitPrice
order.adjustableTrailingUnit = trailUnit
order.adjustedTrailingAmount = adjustedTrailAmount
```

``` EnlighterJSRAW
Order order = new Order();
order.action(action);
order.orderType("STP");
order.auxPrice(stopPrice);
order.totalQuantity(quantity);

order.triggerPrice(triggerPrice);
order.adjustedOrderType("TRAIL LIMIT");
order.adjustedStopPrice(adjustStopPrice);
order.adjustStopLimitPrice(adjustStopLimitPrice);
order.adjustableTrailingUnit(trailUnit);
order.adjustedTrailingAmount(adjustedTrailAmount);
```

``` EnlighterJSRAW
Order order;
order.action = action;
order.orderType = "STP";
order.totalQuantity = quantity;
order.auxPrice = stopPrice;

order.triggerPrice = triggerPrice;
order.adjustedOrderType = "TRAIL LIMIT";
order.adjustedStopPrice = adjustStopPrice;
order.adjustedStopLimitPrice = adjustedStopLimitPrice;
order.adjustableTrailingUnit = trailUnit;
order.adjustedTrailingAmount = adjustedTrailAmount;
```

``` EnlighterJSRAW
Order order = new Order();
order.Action = action;
order.OrderType = "STP";
order.AuxPrice = stopPrice;
order.TotalQuantity = quantity;

order.TriggerPrice = triggerPrice;
order.AdjustedOrderType = "TRAIL LIMIT";
order.AdjustedStopPrice = adjustedStopPrice;
order.AdjustedStopLimitPrice = adjustedStopLimitPrice;
order.AdjustableTrailingUnit = trailUnit;
order.AdjustedTrailingAmount = adjustedTrailAmount;
```

``` EnlighterJSRAW
Dim order As Order = New Order
order.Action = action
order.OrderType = "STP"
order.AuxPrice = stopPrice
order.TotalQuantity = quantity

'Adjusted Stop Component
order.TriggerPrice = triggerPrice
order.AdjustedOrderType = "TRAIL LIMIT"
order.AdjustedStopPrice = adjustedStopPrice
order.AdjustedStopLimitPrice = adjustedStopLimitPrice
order.AdjustableTrailingUnit = trailUnit
order.AdjustedTrailingAmount = adjustedTrailAmount
```

### Hedging

Hedging orders are similar to Bracket Orders. With hedging order, a child order is submitted only on execution of the parent. Orders can be hedged by an attached forex trade, Beta hedge, or Pair Trade, just as in TWS.

For an example of a forex hedge, when buying a contract on a currency other than your base, you can attach an FX order to convert base currency to the currency of the contract to cover the cost of the trade thanks to the TWS API’s Attaching Orders mechanism.

More on [Hedging Orders in TWS](https://www.interactivebrokers.com/en/software/tws/attachedordertop.htm)

More on [Attaching Orders](https://interactivebrokers.github.io/tws-api/order_submission.html#order_attach)

Note that in some cases it will be necessary to include a small delay of 50 ms or less after placing the parent order for processing, before placing the child order. Otherwise the error “10006: Missing parent order” will be triggered.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
 @staticmethod
def MarketFHedge(parentOrderId:int, action:str):
    #FX Hedge orders can only have a quantity of 0
    order = OrderSamples.MarketOrder(action, 0)
    order.parentId = parentOrderId
    order.hedgeType = "F"
    return order

# Parent order on a contract which currency differs from your base currency
parent = OrderSamples.LimitOrder("BUY", 100, 10)
parent.orderId = self.nextOrderId()
parent.transmit = False

# Hedge on the currency conversion
hedge = OrderSamples.MarketFHedge(parent.orderId, "BUY")

# Place the parent first...
self.placeOrder(parent.orderId, ContractSamples.EuropeanStock(), parent)

# Then the hedge order
self.placeOrder(self.nextOrderId(), ContractSamples.EurGbpFx(), hedge)
```

``` EnlighterJSRAW
public static Order MarketFHedge(int parentOrderId, String action) {
    //FX Hedge orders can only have a quantity of 0
    Order order = MarketOrder(action, Decimal.ZERO);
    order.parentId(parentOrderId);
    order.hedgeType("F");
    return order;
}

//Parent order on a contract which currency differs from your base currency
Order parent = OrderSamples.LimitOrder("BUY", Decimal.ONE_HUNDRED, 10);
parent.orderId(nextOrderId++);
parent.transmit(false);
//Hedge on the currency conversion
Order hedge = OrderSamples.MarketFHedge(parent.orderId(), "BUY");
//Place the parent first...
client.placeOrder(parent.orderId(), ContractSamples.EuropeanStock(), parent);
//Then the hedge order
client.placeOrder(nextOrderId++, ContractSamples.EurGbpFx(), hedge);
```

``` EnlighterJSRAW
Order OrderSamples::MarketFHedge(int parentOrderId, std::string action){
    //FX Hedge orders can only have a quantity of 0
    Order order = MarketOrder(action, 0);
    order.parentId = parentOrderId;
    order.hedgeType = "F";
    return order;
}

//Parent order on a contract which currency differs from your base currency
Order parent = OrderSamples::LimitOrder("BUY", stringToDecimal("100"), 10);
parent.orderId = m_orderId++;
parent.transmit = false;

//Hedge on the currency conversion
Order hedge = OrderSamples::MarketFHedge(parent.orderId, "BUY");

//Place the parent first...
m_pClient->placeOrder(parent.orderId, ContractSamples::EuropeanStock(), parent);

//Then the hedge order
m_pClient->placeOrder(m_orderId++, ContractSamples::EurGbpFx(), hedge);
```

``` EnlighterJSRAW
 public static Order MarketFHedge(int parentOrderId, string action)
{
    //FX Hedge orders can only have a quantity of 0
    Order order = MarketOrder(action, 0);
    order.ParentId = parentOrderId;
    orderHedgeType = "F";
    return order;
 }

 //Parent order on a contract which currency differs from your base currency
Order parent = OrderSamples.LimitOrder("BUY", 100, 10);
parent.OrderId = nextOrderId++;
parent.Transmit = false;

 //Hedge on the currency conversion
Order hedge = OrderSamples.MarketFHedge(parent.OrderId, "BUY");

//Place the parent first...
client.placeOrder(parent.OrderId, ContractSamples.EuropeanStock(), parent);

//Then the hedge order
client.placeOrder(nextOrderId++, ContractSamples.EurGbpFx(), hedge);
```

``` EnlighterJSRAW
Public Shared Function MarketFHedge(parentOrderId As Integer, action As String) As Order
    'FX Hedge orders can only have a quantity of 0
    Dim Order As Order = MarketOrder(action, 0)
    Order.ParentId = parentOrderId
    Order.HedgeType = "F"
    Return Order
End Function

'Parent order on a contract which currency differs from your base currency
Dim parent As Order = OrderSamples.LimitOrder("BUY", 100, 10)
parent.OrderId = increment(nextOrderId)
parent.Transmit = False

'Hedge on the currency conversion
Dim hedge As Order = OrderSamples.MarketFHedge(parent.OrderId, "BUY")

'Place the parent first...
client.placeOrder(parent.OrderId, ContractSamples.EuropeanStock(), parent)

'Then the hedge order
client.placeOrder(increment(increment(nextOrderId)), ContractSamples.EurGbpFx(), hedge)
```

### Bracket Orders

Bracket Orders are designed to help limit your loss and lock in a profit by “bracketing” an order with two opposite-side orders. A BUY order is bracketed by a high-side sell limit order and a low-side sell stop order. A SELL order is bracketed by a high-side buy stop order and a low side buy limit order. Note how bracket orders make use of the TWS API’s Attaching Orders mechanism.

One key thing to keep in mind is to handle the order transmission accurately. Since a Bracket consists of three orders, there is always a risk that at least one of the orders gets filled before the entire bracket is sent. To avoid it, make use of the IBApi.Order.Transmit flag. When this flag is set to ‘false’, the TWS will receive the order but it will not send (transmit) it to the servers. In the example below, the first (parent) and second (takeProfit) orders will be send to the TWS but not transmitted to the servers. When the last child order (stopLoss) is sent however and given that its IBApi.Order.Transmit flag is set to true, the TWS will interpret this as a signal to transmit not only its parent order but also the rest of siblings, removing the risks of an accidental execution.

More on [Bracket Orders](https://www.interactivebrokers.com/en/index.php?f=583)

More on [Attaching Orders](https://interactivebrokers.github.io/tws-api/order_submission.html#order_attach)

More on the  [IBApi.Order.Transmit](https://interactivebrokers.github.io/tws-api/classIBApi_1_1Order.html#aaa1c4f31b9580ee0715edcd78a51cbec) flag

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
@staticmethod
def BracketOrder(parentOrderId:int, action:str, quantity:Decimal, 
                 limitPrice:float, takeProfitLimitPrice:float, 
                 stopLossPrice:float):
     
    #This will be our main or "parent" order
    parent = Order()
    parent.orderId = parentOrderId
    parent.action = action
    parent.orderType = "LMT"
    parent.totalQuantity = quantity
    parent.lmtPrice = limitPrice
    #The parent and children orders will need this attribute set to False to prevent accidental executions.
    #The LAST CHILD will have it set to True, 
    parent.transmit = False
 
    takeProfit = Order()
    takeProfit.orderId = parent.orderId + 1
    takeProfit.action = "SELL" if action == "BUY" else "BUY"
    takeProfit.orderType = "LMT"
    takeProfit.totalQuantity = quantity
    takeProfit.lmtPrice = takeProfitLimitPrice
    takeProfit.parentId = parentOrderId
    takeProfit.transmit = False
 
    stopLoss = Order()
    stopLoss.orderId = parent.orderId + 2
    stopLoss.action = "SELL" if action == "BUY" else "BUY"
    stopLoss.orderType = "STP"
    #Stop trigger price
    stopLoss.auxPrice = stopLossPrice
    stopLoss.totalQuantity = quantity
    stopLoss.parentId = parentOrderId
    #In this case, the low side order will be the last child being sent. Therefore, it needs to set this attribute to True 
    #to activate all its predecessors
    stopLoss.transmit = True
 
    bracketOrder = [parent, takeProfit, stopLoss]
    return bracketOrder

bracket = OrderSamples.BracketOrder(self.nextOrderId(), "BUY", 100, 30, 40, 20)
for o in bracket:
    self.placeOrder(o.orderId, ContractSamples.EuropeanStock(), o)
    self.nextOrderId()  # need to advance this we'll skip one extra oid, it's fine
```

``` EnlighterJSRAW
 public static List<Order> BracketOrder(int parentOrderId, String action, Decimal quantity, double limitPrice, double takeProfitLimitPrice, double stopLossPrice) {
    //This will be our main or "parent" order
    Order parent = new Order();
    parent.orderId(parentOrderId);
    parent.action(action);
    parent.orderType("LMT");
    parent.totalQuantity(quantity);
    parent.lmtPrice(limitPrice);
    //The parent and children orders will need this attribute set to false to prevent accidental executions.
    //The LAST CHILD will have it set to true.
    parent.transmit(false);
        
    Order takeProfit = new Order();
    takeProfit.orderId(parent.orderId() + 1);
    takeProfit.action(action.equals("BUY") ? "SELL" : "BUY");
    takeProfit.orderType("LMT");
    takeProfit.totalQuantity(quantity);
    takeProfit.lmtPrice(takeProfitLimitPrice);
    takeProfit.parentId(parentOrderId);
    takeProfit.transmit(false);
        
    Order stopLoss = new Order();
    stopLoss.orderId(parent.orderId() + 2);
    stopLoss.action(action.equals("BUY") ? "SELL" : "BUY");
    stopLoss.orderType("STP");
    //Stop trigger price
    stopLoss.auxPrice(stopLossPrice);
    stopLoss.totalQuantity(quantity);
    stopLoss.parentId(parentOrderId);
    //In this case, the low side order will be the last child being sent. Therefore, it needs to set this attribute to true 
    //to activate all its predecessors
    stopLoss.transmit(true);
        
    List<Order> bracketOrder = new ArrayList<>();
    bracketOrder.add(parent);
    bracketOrder.add(takeProfit);
    bracketOrder.add(stopLoss);
        
    return bracketOrder;
}

List<Order> bracket = OrderSamples.BracketOrder(nextOrderId++, "BUY", Decimal.ONE_HUNDRED, 30, 40, 20);
for(Order o : bracket) {
    client.placeOrder(o.orderId(), ContractSamples.EuropeanStock(), o);
}
```

``` EnlighterJSRAW
void OrderSamples::BracketOrder(int parentOrderId, Order& parent, Order& takeProfit, Order& stopLoss, std::string action, Decimal quantity, double limitPrice, double takeProfitLimitPrice, double stopLossPrice){
    //This will be our main or "parent" order
    parent.orderId = parentOrderId;
    parent.action = action;
    parent.orderType = "LMT";
    parent.totalQuantity = quantity;
    parent.lmtPrice = limitPrice;
    //The parent and children orders will need this attribute set to false to prevent accidental executions.
    //The LAST CHILD will have it set to true, 
    parent.transmit = false;
    takeProfit.orderId = parent.orderId + 1;
    takeProfit.action = (action == "BUY") ? "SELL" : "BUY";
    takeProfit.orderType = "LMT";
    takeProfit.totalQuantity = quantity;
    takeProfit.lmtPrice = takeProfitLimitPrice;
    takeProfit.parentId = parentOrderId;
    takeProfit.transmit = false;
    stopLoss.orderId = parent.orderId + 2;
    stopLoss.action = (action == "BUY") ? "SELL" : "BUY";
    stopLoss.orderType = "STP";
    //Stop trigger price
    stopLoss.auxPrice = stopLossPrice;
    stopLoss.totalQuantity = quantity;
    stopLoss.parentId = parentOrderId;
    //In this case, the low side order will be the last child being sent. Therefore, it needs to set this attribute to true 
    //to activate all its predecessors
    stopLoss.transmit = true;
}

OrderSamples::BracketOrder(m_orderId++, parent, takeProfit, stopLoss, "BUY", stringToDecimal("100"), 30, 40, 20);
m_pClient->placeOrder(parent.orderId, ContractSamples::EuropeanStock(), parent);
m_pClient->placeOrder(takeProfit.orderId, ContractSamples::EuropeanStock(), takeProfit);
m_pClient->placeOrder(stopLoss.orderId, ContractSamples::EuropeanStock(), stopLoss);
```

``` EnlighterJSRAW
public static List<Order> BracketOrder(int parentOrderId, string action, decimal quantity, double limitPrice, 
            double takeProfitLimitPrice, double stopLossPrice)
{
    //This will be our main or "parent" order
    Order parent = new Order();
    parent.OrderId = parentOrderId;
    parent.Action = action;
    parent.OrderType = "LMT";
    parent.TotalQuantity = quantity;
    parent.LmtPrice = limitPrice;
    //The parent and children orders will need this attribute set to false to prevent accidental executions.
    //The LAST CHILD will have it set to true, 
    parent.Transmit = false;
    Order takeProfit = new Order();
    takeProfit.OrderId = parent.OrderId + 1;
    takeProfit.Action = action.Equals("BUY") ? "SELL" : "BUY";
    takeProfit.OrderType = "LMT";
    takeProfit.TotalQuantity = quantity;
    takeProfit.LmtPrice = takeProfitLimitPrice;
    takeProfit.ParentId = parentOrderId;
    takeProfit.Transmit = false;
    Order stopLoss = new Order();
    stopLoss.OrderId = parent.OrderId + 2;
    stopLoss.Action = action.Equals("BUY") ? "SELL" : "BUY";
    stopLoss.OrderType = "STP";
    //Stop trigger price
    stopLoss.AuxPrice = stopLossPrice;
    stopLoss.TotalQuantity = quantity;
    stopLoss.ParentId = parentOrderId;
    //In this case, the low side order will be the last child being sent. Therefore, it needs to set this attribute to true 
    //to activate all its predecessors
    stopLoss.Transmit = true;
    List<Order> bracketOrder = new List<Order>();
    bracketOrder.Add(parent);
    bracketOrder.Add(takeProfit);
    bracketOrder.Add(stopLoss);
    return bracketOrder;
}

List<Order> bracket = OrderSamples.BracketOrder(nextOrderId++, "BUY", 100, 30, 40, 20);
foreach (Order o in bracket)
    client.placeOrder(o.OrderId, ContractSamples.EuropeanStock(), o);
```

``` EnlighterJSRAW
'This will be our main Or "parent" order
Dim parent As Order = New Order
parent.OrderId = parentOrderId
parent.Action = action
parent.OrderType = "LMT"
parent.TotalQuantity = quantity
parent.LmtPrice = limitPrice
'The parent And children orders will need this attribute set to false to prevent accidental executions.
'The LAST CHILD will have it set to true, 
parent.Transmit = False
Dim takeProfit As Order = New Order
'
takeProfit.OrderId = parent.OrderId + 1
If action.Equals("BUY") Then takeProfit.Action = "SELL" Else takeProfit.Action = "BUY"
takeProfit.OrderType = "LMT"
takeProfit.TotalQuantity = quantity
takeProfit.LmtPrice = takeProfitLimitPrice
takeProfit.ParentId = parentOrderId
takeProfit.Transmit = False
Dim stopLoss As Order = New Order
stopLoss.OrderId = parent.OrderId + 2
If action.Equals("BUY") Then stopLoss.Action = "SELL" Else stopLoss.Action = "BUY"
stopLoss.OrderType = "STP"
'Stop trigger price
stopLoss.AuxPrice = stopLossPrice
stopLoss.TotalQuantity = quantity
stopLoss.ParentId = parentOrderId
'In this case, the low side order will be the last child being sent. Therefore, it needs to set this attribute to true 
'to activate all its predecessors
stopLoss.Transmit = True
Dim orders As List(Of Order) = New List(Of Order)
orders.Add(parent)
orders.Add(takeProfit)
orders.Add(stopLoss)

Dim bracket As List(Of Order) = OrderSamples.BracketOrder(increment(nextOrderId), "BUY", 100, 30, 40, 20)
For Each o As Order In bracket
    client.placeOrder(o.OrderId, ContractSamples.EuropeanStock(), o)
Next
```

### One Cancels All

The One-Cancels All (OCA) order type allows an investor to place multiple and possibly unrelated orders assigned to a group. The aim is to complete just one of the orders, which in turn will cause TWS to cancel the remaining orders.

The investor may submit several orders aimed at taking advantage of the most desirable price within the group. Completion of one piece of the group order causes cancellation of the remaining group orders while partial completion causes the group to re-balance.

An investor might desire to sell 1000 shares of only ONE of three positions held above prevailing market prices. The OCA order group allows the investor to enter prices at specified target levels and if one is completed, the other two will automatically cancel. Alternatively, an investor may wish to take a LONG position in eMini S\&P stock index futures in a falling market or else SELL US treasury futures at a more favorable price.

Grouping the two orders using an OCA order type offers the investor two chances to enter a similar position, while only running the risk of taking on a single position.

**Multiple OCA types cannot be used in a single OCA Group.**

More on [One-Cancels All](https://www.interactivebrokers.com/en/index.php?f=617) orders

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
@staticmethod
def OneCancelsAll(ocaGroup:str, ocaOrders:ListOfOrder, ocaType:int):
    for o in ocaOrders: 
        o.ocaGroup = ocaGroup
        o.ocaType = ocaType         
    return ocaOrders
```

``` EnlighterJSRAW
ocaOrders = [OrderSamples.LimitOrder("BUY", 1, 10), OrderSamples.LimitOrder("BUY", 1, 11), OrderSamples.LimitOrder("BUY", 1, 12)]
OrderSamples.OneCancelsAll("TestOCA_" + str(self.nextValidOrderId), ocaOrders, 2)
for o in ocaOrders:
self.placeOrder(self.nextOrderId(), ContractSamples.USStockAtSmart(), o)
```

``` EnlighterJSRAW
public static List<Order> OneCancelsAll(String ocaGroup, List<Order> ocaOrders, int ocaType) {
    for (Order o : ocaOrders) {
        o.ocaGroup(ocaGroup);
        o.ocaType(ocaType);
    }
    return ocaOrders;
}
```

``` EnlighterJSRAW
List<Order> OcaOrders = new ArrayList<>();
OcaOrders.add(OrderSamples.LimitOrder("BUY", Decimal.ONE, 10));
OcaOrders.add(OrderSamples.LimitOrder("BUY", Decimal.ONE, 11));
OcaOrders.add(OrderSamples.LimitOrder("BUY", Decimal.ONE, 12));
OcaOrders = OrderSamples.OneCancelsAll("TestOCA_" + nextOrderId, OcaOrders, 2);
for (Order o : OcaOrders) {
    client.placeOrder(nextOrderId++, ContractSamples.USStock(), o);
}
```

``` EnlighterJSRAW
void OrderSamples::OneCancelsAll(std::string ocaGroup, Order& ocaOrder, int ocaType){
        ocaOrder.ocaGroup = ocaGroup;
        ocaOrder.ocaType = ocaType;
}
```

``` EnlighterJSRAW
std::vector<Order> ocaOrders;
ocaOrders.push_back(OrderSamples::LimitOrder("BUY", stringToDecimal("1"), 10));
ocaOrders.push_back(OrderSamples::LimitOrder("BUY", stringToDecimal("1"), 11));
ocaOrders.push_back(OrderSamples::LimitOrder("BUY", stringToDecimal("1"), 12));
for(unsigned int i = 0; i < ocaOrders.size(); i++){
    OrderSamples::OneCancelsAll("TestOca", ocaOrders[i], 2);
    m_pClient->placeOrder(m_orderId++, ContractSamples::USStock(), ocaOrders[i]);
}
```

``` EnlighterJSRAW
public static List<Order> OneCancelsAll(string ocaGroup, List<Order> ocaOrders, int ocaType)
{
    foreach (Order o in ocaOrders)
    {
        o.OcaGroup = ocaGroup;
        o.OcaType = ocaType;
    }
    return ocaOrders;
}
```

``` EnlighterJSRAW
List<Order> ocaOrders = new List<Order>();
ocaOrders.Add(OrderSamples.LimitOrder("BUY", 1, 10));
ocaOrders.Add(OrderSamples.LimitOrder("BUY", 1, 11));
ocaOrders.Add(OrderSamples.LimitOrder("BUY", 1, 12));
OrderSamples.OneCancelsAll("TestOCA_" + nextOrderId, ocaOrders, 2);
foreach (Order o in ocaOrders)
    client.placeOrder(nextOrderId++, ContractSamples.USStock(), o);
```

``` EnlighterJSRAW
For Each o As Order In ocaOrders
    o.OcaGroup = ocaGroup
    o.OcaType = ocaType
    'Same as with Bracket orders. To prevent accidental executions, set all orders' transmit flag to false.
    'This will tell the TWS Not to send the orders, allowing your program to send them all first.
    o.Transmit = False
Next o

'Telling the TWS to transmit the last order in the OCA will also cause the transmission of its predecessors.
ocaOrders.Item(ocaOrders.Count - 1).Transmit = True
```

``` EnlighterJSRAW
Dim ocaOrders As List(Of Order) = New List(Of Order)
ocaOrders.Add(OrderSamples.LimitOrder("BUY", 1, 10))
ocaOrders.Add(OrderSamples.LimitOrder("BUY", 1, 11))
ocaOrders.Add(OrderSamples.LimitOrder("BUY", 1, 12))
OrderSamples.OneCancelsAll("TestOCA_" + nextOrderId, ocaOrders, 2)
For Each o As Order In ocaOrders
    client.placeOrder(increment(nextOrderId), ContractSamples.USStock(), o)
Next
```

### OCA Types

Via the IBApi.Order.OcaType attribute, the way in which remaining orders should be handled after an execution can be configured as indicated in the table.

| Value | Description                                                         |
| ----- | ------------------------------------------------------------------- |
| 1     | Cancel all remaining orders with block.\*                           |
| 2     | Remaining orders are proportionately reduced in size with block.\*  |
| 3     | Remaining orders are proportionately reduced in size with no block. |

Note\*: if you use a value “with block” it gives the order overfill protection. This means that only one order in the group will be routed at a time to remove the possibility of an overfill. Click here for further discussion of OCA orders.

**Multiple OCA types cannot be used in a single OCA Group.**

More on [OCA Orders](https://www.interactivebrokers.com/en/index.php?f=617)

More on the [IBApi.Order.OcaType](https://interactivebrokers.github.io/tws-api/classIBApi_1_1Order.html#a3485999c42d64f3c879ec4a424bab697) attribute

## Order Conditioning

Order Conditions are a set of parameters attached to an order that allow the order to either be placed or cancel upon achieving the condition criteria. There are 6 unique Order Conditions that can be applied to a given order: Price, Time, Margin, Execution, Volume, and PercentChange.

Order Conditions can be applied to nearly any order and more than one condition can be attached to an individual order using to be Inclusive, “AND”, or Exclusive, “OR”.

More information on Order Conditions can be found [here](https://www.ibkrguides.com/riskprofile/usersguidebook/ordertypes/conditionaltest.htm).

For the sake of simplicity, all Condition Orders below will be based on an example order, shown here. The additional content will be included in each order’s content.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
base_order = Order()
base_order.action = action
base_order.orderType = "MKT"
base_order.totalQuantity = quantity
base_order.conditionsCancelOrder = False
```

``` EnlighterJSRAW
Order base_order= new Order();
base_order.action(action);
base_order.orderType("MKT");
base_order.totalQuantity(quantity);
base_order.conditionsCancelOrder(false);
```

``` EnlighterJSRAW
Order base_order;
base_order.action = action;
base_order.orderType = "MKT";
base_order.totalQuantity = quantity;
base_order.conditionsCancelOrder = false;
```

``` EnlighterJSRAW
Order base_order= new Order();
base_order.Action = action;
base_order.OrderType = "MKT";
base_order.TotalQuantity = quantity;
base_order.ConditionsCancelOrder = false;
```

``` EnlighterJSRAW
Dim base_order As Order = New Order
base_order.Action = action
base_order.OrderType = "MKT"
base_order.TotalQuantity = quantity
base_order.ConditionsCancelOrder = false
```

### Execution Conditions

The Execution Condition triggers an order whenever another order on your account has executed. The parameters allow the developer to specify how narrow a scope will trigger a condition.

See [ExecutionCondition](/campus/ibkr-api-page/twsapi-ref/#execcondition-ref) for more details on the ExecutionCondition class.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
execCondition = order_condition.Create(OrderCondition.Execution)
execCondition.symbol = symbol
execCondition.exchange = exchange
execCondition.secType = secType

base_order.conditions = [execCondition]
```

``` EnlighterJSRAW
 ExecutionCondition execCondition = (ExecutionCondition)OrderCondition.create(OrderConditionType.Execution);
execCondition.symbol(symbol);
execCondition.exchange(exchange);
execCondition.secType(secType);
execCondition.conjunctionConnection(isConjunction);

base_order.conditions().add(execCondition)
```

``` EnlighterJSRAW
 ExecutionCondition* execCondition = dynamic_cast<ExecutionCondition *>(OrderCondition::create(OrderCondition::OrderConditionType::Execution));
execCondition->symbol(symbol);
execCondition->exchange(exchange);
execCondition->secType(secType);
execCondition->conjunctionConnection(isConjunction);

base_order.conditions->push_back(execCondition)
```

``` EnlighterJSRAW
ExecutionCondition execCondition = (ExecutionCondition)OrderCondition.Create(OrderConditionType.Execution);
//When an execution on symbol
execCondition.Symbol = symbol;
execCondition.Exchange = exchange;
execCondition.SecType = secType;
execCondition.IsConjunctionConnection = isConjunction;

base_order.Conditions = new List();
base_order.Conditions.Add(execCondition);
```

``` EnlighterJSRAW
Dim execCondition As ExecutionCondition = OrderCondition.Create(OrderConditionType.Execution) ' cast to (ExecutionCondition)
execCondition.Symbol = symbol
execCondition.Exchange = exchange
execCondition.SecType = secType
execCondition.IsConjunctionConnection = isConjunction

base_order.Conditions = New List()
base_order.Conditions.Add(execCondition)
```

### Margin Conditions

Margin Conditions permit users to ready an order in case their order starts falling to a given threshold that may lead to liquidation or to submit an order after ample margin cushion has been established.

See [MarginCondition](/campus/ibkr-api-page/twsapi-ref/#margincondition-ref) for more details on the MarginCondition class.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
marginCondition = order_condition.Create(OrderCondition.Margin)
marginCondition.isMore = isMore
marginCondition.percent = percent
marginCondition.isConjunctionConnection = isConjunction

base_order.conditions = [marginCondition]
```

``` EnlighterJSRAW
MarginCondition marginCondition = (MarginCondition)OrderCondition.create(OrderConditionType.Margin);
marginCondition.isMore(isMore);
marginCondition.percent(percent);
marginCondition.conjunctionConnection(isConjunction);

base_order.conditions().add(marginCondition)
```

``` EnlighterJSRAW
MarginCondition* marginCondition = dynamic_cast<MarginCondition *>(OrderCondition::create(OrderCondition::OrderConditionType::Margin));
marginCondition->percent(percent);
marginCondition->isMore(isMore);
marginCondition->conjunctionConnection(isConjunction);

base_order.conditions->push_back(marginCondition);
```

``` EnlighterJSRAW
MarginCondition marginCondition = (MarginCondition)OrderCondition.Create(OrderConditionType.Margin);
marginCondition.IsMore = isMore;
marginCondition.Percent = percent;
marginCondition.IsConjunctionConnection = isConjunction;

base_order.Conditions = new List();
base_order.Conditions.Add(marginCondition);
```

``` EnlighterJSRAW
Dim _MarginCondition As MarginCondition = OrderCondition.Create(OrderConditionType.Margin) ' cast to (MarginCondition)
_MarginCondition.IsMore = isMore
_MarginCondition.Percent = percent
_MarginCondition.IsConjunctionConnection = isConjunction

base_order.Conditions = New List()
base_order.Conditions.Add(_MarginCondition)
```

### Price Conditions

A Price Condition will trigger if an order should transmit or cancel when a given contract’s price goes above or beyond a given threshold.

See [PriceCondition](/campus/ibkr-api-page/twsapi-ref/#pricecondition-ref) for more details on the PriceCondition class.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
priceCondition = PriceCondition()
priceCondition.conId = conId
priceCondition.exchange = exchange
priceCondition.isMore = isMore
priceCondition.triggerMethod = triggerMethod
priceCondition.price = price

base_order.conditions = [priceCondition]
```

``` EnlighterJSRAW
PriceCondition priceCondition = (PriceCondition)OrderCondition.create(OrderConditionType.Price);
priceCondition.conId(conId);
priceCondition.exchange(exchange);
priceCondition.isMore(isMore);
priceCondition.price(price);
priceCondition.conjunctionConnection(isConjunction);

base_order.conditions().add(priceCondition)
```

``` EnlighterJSRAW
PriceCondition* priceCondition = dynamic_cast<PriceCondition *>(OrderCondition::create(OrderCondition::OrderConditionType::Price));
priceCondition->conId(conId);
priceCondition->exchange(exchange);
priceCondition->isMore(isMore);
priceCondition->price(price);
priceCondition->conjunctionConnection(isConjunction);

base_order.conditions->push_back(priceCondition);
```

``` EnlighterJSRAW
PriceCondition priceCondition = (PriceCondition)OrderCondition.Create(OrderConditionType.Price);
priceCondition.ConId = conId;
priceCondition.Exchange = exchange;
priceCondition.IsMore = isMore;
priceCondition.Price = price;
priceCondition.IsConjunctionConnection = isConjunction;

base_order.Conditions = new List();
base_order.Conditions.Add(priceCondition);
```

``` EnlighterJSRAW
Dim _priceCondition As PriceCondition = OrderCondition.Create(OrderConditionType.Price) 
_priceCondition.ConId = conId
_priceCondition.Exchange = exchange
_priceCondition.IsMore = isMore
_priceCondition.Price = price
_priceCondition.IsConjunctionConnection = isConjunction

base_order.Conditions = New List()
base_order.Conditions.Add(_priceCondition)
```

### Percentage Conditions

The Percent Change Condition will trigger if there is a price percent change measured against last close price.

See [PercentChangeCondition](/campus/ibkr-api-page/twsapi-ref/#percchange-ref) for more details on the PercentChangeCondition class.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
 pctChangeCondition = order_condition.Create(OrderCondition.PercentChange)
pctChangeCondition.isMore = isMore
pctChangeCondition.changePercent = pctChange
pctChangeCondition.conId = conId
pctChangeCondition.exchange = exchange
pctChangeCondition.isConjunctionConnection = isConjunction

base_order.conditions = [pctChangeCondition]
```

``` EnlighterJSRAW
PercentChangeCondition pctChangeCondition = (PercentChangeCondition)OrderCondition.create(OrderConditionType.PercentChange);
pctChangeCondition.isMore(isMore);
pctChangeCondition.changePercent(pctChange);
pctChangeCondition.conId(conId);
pctChangeCondition.exchange(exchange);
pctChangeCondition.conjunctionConnection(isConjunction);

base_order.conditions().add(pctChangeCondition)
```

``` EnlighterJSRAW
PercentChangeCondition* pctChangeCondition = dynamic_cast<PercentChangeCondition *>(OrderCondition::create(OrderCondition::OrderConditionType::PercentChange));
pctChangeCondition->isMore(isMore);
pctChangeCondition->changePercent(pctChange);
pctChangeCondition->conId(conId);
pctChangeCondition->exchange(exchange);
pctChangeCondition->conjunctionConnection(isConjunction);

base_order.conditions->push_back(pctChangeCondition);
```

``` EnlighterJSRAW
PercentChangeCondition pctChangeCondition = (PercentChangeCondition)OrderCondition.Create(OrderConditionType.PercentCange);
pctChangeCondition.IsMore = isMore;
pctChangeCondition.ChangePercent = pctChange;
pctChangeCondition.ConId = conId;
pctChangeCondition.Exchange = exchange;
pctChangeCondition.IsConjunctionConnection = isConjunction;

base_order.Conditions = new List();
base_order.Conditions.Add(pctChangeCondition);
```

``` EnlighterJSRAW
Dim pctChangeCondition As PercentChangeCondition = OrderCondition.Create(OrderConditionType.PercentCange)
pctChangeCondition.IsMore = isMore
pctChangeCondition.ChangePercent = pctChange
pctChangeCondition.ConId = conId
pctChangeCondition.Exchange = exchange
pctChangeCondition.IsConjunctionConnection = isConjunction

base_order.Conditions = New List()
base_order.Conditions.Add(pctChangeCondition)
```

### Time Conditions

The Time Condition will trigger an order for submission or cancellation after a time has been reached.

See [TimeCondition](/campus/ibkr-api-page/twsapi-ref/#timecondition-ref) for more details on the TimeCondition class.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
timeCondition = order_condition.Create(OrderCondition.Time)
timeCondition.isMore = isMore
timeCondition.time = time   
timeCondition.isConjunctionConnection = isConjunction

base_order.conditions = [timeCondition]
```

``` EnlighterJSRAW
TimeCondition timeCondition = (TimeCondition)OrderCondition.create(OrderConditionType.Time);
timeCondition.isMore(isMore);
timeCondition.time(time);
timeCondition.conjunctionConnection(isConjunction);

base_order.conditions().add(timeCondition)
```

``` EnlighterJSRAW
TimeCondition* timeCondition = dynamic_cast<TimeCondition *>(OrderCondition::create(OrderCondition::OrderConditionType::Time));
timeCondition->isMore(isMore);
timeCondition->time(time);
timeCondition->conjunctionConnection(isConjunction);

base_order.conditions->push_back(timeCondition);
```

``` EnlighterJSRAW
TimeCondition timeCondition = (TimeCondition)OrderCondition.Create(OrderConditionType.Time);
timeCondition.IsMore = isMore;
timeCondition.Time = time;
timeCondition.IsConjunctionConnection = isConjunction;

base_order.Conditions = new List();
base_order.Conditions.Add(timeCondition);
```

``` EnlighterJSRAW
Dim _TimeCondition As TimeCondition = OrderCondition.Create(OrderConditionType.Time)
_TimeCondition.IsMore = isMore
_TimeCondition.Time = time
_TimeCondition.IsConjunctionConnection = isConjunction

base_order.Conditions = New List()
base_order.Conditions.Add(_TimeCondition)
```

### Volume Conditions

Volume Condition will trigger in the event the contract’s volume remains above or below a given threshold.

**Note:** VolumeCondition orders must be SMART routed.

See [VolumeCondition](/campus/ibkr-api-page/twsapi-ref/#volumecondition-ref) for more details on the VolumeCondition class.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
volCond = order_condition.Create(OrderCondition.Volume)
volCond.conId = conId
volCond.exchange = exchange
volCond.isMore = isMore
volCond.volume = volume
volCond.isConjunctionConnection = isConjunction
```

``` EnlighterJSRAW
VolumeCondition volCon = (VolumeCondition)OrderCondition.create(OrderConditionType.Volume);
volCon.conId(conId);
volCon.exchange(exchange);
volCon.isMore(isMore);
volCon.volume(volume);
volCon.conjunctionConnection(isConjunction);
```

``` EnlighterJSRAW
VolumeCondition* volCondition = dynamic_cast<VolumeCondition *>(OrderCondition::create(OrderCondition::OrderConditionType::Volume));
volCondition->conId(conId);
volCondition->exchange(exchange);
volCondition->isMore(isMore);
volCondition->volume(volume);
volCondition->conjunctionConnection(isConjunction);
```

``` EnlighterJSRAW
VolumeCondition volCond = (VolumeCondition)OrderCondition.Create(OrderConditionType.Volume);
//Whenever contract...
volCond.ConId = conId;
//When traded at
volCond.Exchange = exchange;
//reaches a volume higher/lower
volCond.IsMore = isMore;
//than this...
volCond.Volume = volume;
//AND | OR next condition (will be ignored if no more conditions are added)
volCond.IsConjunctionConnection = isConjunction;
```

``` EnlighterJSRAW
 Dim volCond As VolumeCondition = OrderCondition.Create(OrderConditionType.Volume) 'cast (VolumeCondition)
'Whenever contract...
volCond.ConId = conId
'When traded at
volCond.Exchange = exchange
'reaches a volume higher/lower
volCond.IsMore = isMore
'than this...
volCond.Volume = volume
'And | Or next condition (will be ignored if no more conditions are added)
volCond.IsConjunctionConnection = isConjunction
```

## IBKRATS Order Types

Customers can direct non-marketable U.S. stock orders to the IBKRATS destination to add liquidity. Orders directed to IBKRATS are tagged as “not held” orders, and are posted in IBKR’s order book where incoming SmartRouted orders from other IBKR customers are eligible to take liquidity by trading against them.  
To route an order to IBKRATS via the API, you need to set the IBApi::Contract::Exchange field to “IBKRATS” and IBApi::Order::NotHeld to True.

More on [IBKRATS Orders](https://www.interactivebrokers.com/en/index.php?f=4485)

Note: The order must have the NotHeld field set to True, or you may receive a rejection with the reason; “IBKRAts order must be a not-held”. When submitting via the TWS UI, this is set automatically.

### Pegged-to-Best

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
order = Order()
order.action = action
order.orderType = "PEG BEST"
order.lmtPrice = limitPrice
order.totalQuantity = quantity
order.notHeld = True
order.minCompeteSize = minCompeteSize
order.competeAgainstBestOffset = competeAgainstBestOffset
```

``` EnlighterJSRAW
Order order = new Order();
order.action(action);
order.orderType("PEG BEST");
order.lmtPrice(limitPrice);
order.totalQuantity(quantity);
order.notHeld(true);
order.minCompeteSize(minCompeteSize);
order.competeAgainstBestOffset(competeAgainstBestOffset);
```

``` EnlighterJSRAW
Order order;
order.action = action;
order.orderType = "PEG BEST";
order.lmtPrice = limitPrice;
order.totalQuantity = quantity;
order.notHeld = true;
order.minCompeteSize = minCompeteSize;
order.competeAgainstBestOffset = competeAgainstBestOffset;
```

``` EnlighterJSRAW
Order order = new Order();
order.Action = action;
order.OrderType = "PEG BEST";
order.LmtPrice = limitPrice;
order.TotalQuantity = quantity;
order.NotHeld = true;
order.MinCompeteSize = minCompeteSize;
order.CompeteAgainstBestOffset = competeAgainstBestOffset;
```

``` EnlighterJSRAW
Dim order As Order = New Order
order.Action = action
order.OrderType = "PEG BEST"
order.LmtPrice = limitPrice
order.TotalQuantity = quantity
order.NotHeld = True
order.MinCompeteSize = minCompeteSize
order.CompeteAgainstBestOffset = competeAgainstBestOffset
```

### Pegged-to-Best offset difference

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
order = Order()
order.action = action
order.orderType = "PEG BEST"
order.lmtPrice = limitPrice
order.totalQuantity = quantity
order.notHeld = True
order.minCompeteSize = minCompeteSize
order.competeAgainstBestOffset = COMPETE_AGAINST_BEST_OFFSET_UP_TO_MID
order.midOffsetAtWhole = midOffsetAtWhole
order.midOffsetAtHalf = midOffsetAtHalf
```

``` EnlighterJSRAW
Order order = new Order();
order.action(action);
order.orderType("PEG BEST");
order.lmtPrice(limitPrice);
order.totalQuantity(quantity);
order.notHeld(true);
order.minCompeteSize(minCompeteSize);
order.competeAgainstBestOffset(Order.COMPETE_AGAINST_BEST_OFFSET_UP_TO_MID);
order.midOffsetAtWhole(midOffsetAtWhole);
order.midOffsetAtHalf(midOffsetAtHalf);
```

``` EnlighterJSRAW
Order order;
order.action = action;
order.orderType = "PEG BEST";
order.lmtPrice = limitPrice;
order.totalQuantity = quantity;
order.notHeld = true;
order.minCompeteSize = minCompeteSize;
order.competeAgainstBestOffset = COMPETE_AGAINST_BEST_OFFSET_UP_TO_MID;
order.midOffsetAtWhole = midOffsetAtWhole;
order.midOffsetAtHalf = midOffsetAtHalf;
```

``` EnlighterJSRAW
Order order = new Order();
order.Action = action;
order.OrderType = "PEG BEST";
order.LmtPrice = limitPrice;
order.TotalQuantity = quantity;
order.NotHeld = true;
order.MinCompeteSize = minCompeteSize;
order.CompeteAgainstBestOffset = Order.COMPETE_AGAINST_BEST_OFFSET_UP_TO_MID;
order.MidOffsetAtWhole = midOffsetAtWhole;
order.MidOffsetAtHalf = midOffsetAtHalf;
```

``` EnlighterJSRAW
Dim order As Order = New Order
order.Action = action
order.OrderType = "PEG BEST"
order.LmtPrice = limitPrice
order.TotalQuantity = quantity
order.NotHeld = True
order.MinCompeteSize = minCompeteSize
order.CompeteAgainstBestOffset = Order.COMPETE_AGAINST_BEST_OFFSET_UP_TO_MID
order.MidOffsetAtWhole = midOffsetAtWhole
order.MidOffsetAtHalf = midOffsetAtHalf
```

### Pegged-to-Midpoint

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
order = Order()
order.action = action
order.orderType = "PEG MID"
order.lmtPrice = limitPrice
order.totalQuantity = quantity
order.notHeld = True
order.minTradeQty = minTradeQty
order.midOffsetAtWhole = midOffsetAtWhole
order.midOffsetAtHalf = midOffsetAtHalf
```

``` EnlighterJSRAW
Order order = new Order();
order.action(action);
order.orderType("PEG MID");
order.lmtPrice(limitPrice);
order.totalQuantity(quantity);
order.notHeld(true);
order.minTradeQty(minTradeQty);
order.midOffsetAtWhole(midOffsetAtWhole);
order.midOffsetAtHalf(midOffsetAtHalf);
```

``` EnlighterJSRAW
Order order;
order.action = action;
order.orderType = "PEG MID";
order.lmtPrice = limitPrice;
order.totalQuantity = quantity;
order.notHeld = true;
order.minTradeQty = minTradeQty;
order.midOffsetAtWhole = midOffsetAtWhole;
order.midOffsetAtHalf = midOffsetAtHalf;
```

``` EnlighterJSRAW
Order order = new Order();
order.Action = action;
order.OrderType = "PEG MID";
order.LmtPrice = limitPrice;
order.TotalQuantity = quantity;
order.NotHeld = true;
order.MinTradeQty = minTradeQty;
order.MidOffsetAtWhole = midOffsetAtWhole;
order.MidOffsetAtHalf = midOffsetAtHalf;
```

``` EnlighterJSRAW
Dim order As Order = New Order
order.Action = action
order.OrderType = "PEG MID"
order.LmtPrice = limitPrice
order.TotalQuantity = quantity
order.NotHeld = True
order.MinTradeQty = minTradeQty
order.MidOffsetAtWhole = midOffsetAtWhole
order.MidOffsetAtHalf = midOffsetAtHalf
```

## Algorithmic Orders

Order types and algos may help limit risk, speed execution, provide price improvement, allow privacy, time the market and simplify the trading process through advanced trading functions.

**Important:** IB ALGO orders are only supported during regular trading hours. Orders submitted with the outsideRth field set to “true” will be rejected.

This page is intended to provide assistance with creating algo orders in the API. For more information on what IB Algorithms can do, please visit our [IBKR Order Types and Algos](https://www.interactivebrokers.com/en/trading/ordertypes.php) page.

In nearly all cases,  Algo orders are additional parameters that can be used in addition to a standing order. 

Because of this structure, we will be using our Limit Order sample as a baseline. The algos documented here will be attached to the same “order” variable as used here.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
order = Order()
order.action = action
order.orderType = "LMT"
order.totalQuantity = quantity
order.lmtPrice = limitPrice
```

``` EnlighterJSRAW
Order order = new Order();
order.action(action);
order.orderType("LMT");
order.totalQuantity(quantity);
order.lmtPrice(limitPrice);
order.tif(TimeInForce.DAY);
```

``` EnlighterJSRAW
Order order;
order.action = action;
order.orderType = "LMT";
order.totalQuantity = quantity;
order.lmtPrice = limitPrice;
```

``` EnlighterJSRAW
Order order = new Order();
order.Action = action;
order.OrderType = "LMT";
order.TotalQuantity = quantity;
order.LmtPrice = limitPrice;
```

``` EnlighterJSRAW
Dim order As Order = New Order
order.Action = action
order.OrderType = "LMT"
order.TotalQuantity = quantity
order.LmtPrice = limitPrice
```

### IB Algorithms

### Accumulate/Distribute

The [Accumulate/Distribute](https://www.interactivebrokers.com/en/index.php?f=1223) algo can help you to achieve the best price for a large volume order without being noticed in the market, and can be set up for high frequency trading. By slicing your order into smaller randomly-sized order increments that are released at random time intervals within a user-defined time period, the algo allows the trading of large blocks of stock and other instruments without being detected in the market. The algo allows limit, market, and relative order types. It is important to keep in mind the API A/D algo will not have all available parameters of the A/D algos that can be created in TWS.

**Algo Strategy Value:** AD

**componentSize:** int. Quantity of increment.  
Valid Value/Format: Cannot exceed initial size

**timeBetweenOrders:** int. Time interval in seconds between each order.  
Valid Value/Format: 30

**randomizeTime20:** bool. Randomize time period by +/- 20%.  
Valid Value/Format: 1 (true) or 0 (false)

**randomizeSize55:** bool. Randomize size by +/- 55%.  
Valid Value/Format: 1 (true) or 0 (false)

**giveUp:** int. Stop attempting to catch up to the size value if the conditions are not achieved.

**catchUp:** bool. Catch up in time.  
Valid Value/Format: 1 (true) or 0 (false)

**waitForFill:** bool. Wait for current order to fill before submitting next order.  
Valid Value/Format: 1 (true) or 0 (false)

**activeTimeStart:** String. Algorithm starting time.  
Valid Value/Format: YYYYMMDD-hh:mm:ss TMZ

**activeTimeEnd:** String. Algorithm ending time.  
Valid Value/Format: YYYYMMDD-hh:mm:ss TMZ

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
order.algoStrategy = "AD"
order.algoParams = []
order.algoParams.append(TagValue("componentSize", componentSize))
order.algoParams.append(TagValue("timeBetweenOrders", timeBetweenOrders))
order.algoParams.append(TagValue("randomizeTime20", int(randomizeTime20)))
order.algoParams.append(TagValue("randomizeSize55", int(randomizeSize55)))
order.algoParams.append(TagValue("giveUp", giveUp))
order.algoParams.append(TagValue("catchUp", int(catchUp)))
order.algoParams.append(TagValue("waitForFill", int(waitForFill)))
order.algoParams.append(TagValue("activeTimeStart", startTime))
order.algoParams.append(TagValue("activeTimeEnd", endTime))
```

``` EnlighterJSRAW
order.algoStrategy("AD");
order.algoParams(new ArrayList());
order.algoParams().add(new TagValue("componentSize", String.valueOf(componentSize)));
order.algoParams().add(new TagValue("timeBetweenOrders", String.valueOf(timeBetweenOrders)));
order.algoParams().add(new TagValue("randomizeTime20", randomizeTime20 ? "1" : "0"));
order.algoParams().add(new TagValue("randomizeSize55", randomizeSize55 ? "1" : "0"));
order.algoParams().add(new TagValue("giveUp", String.valueOf(giveUp)));
order.algoParams().add(new TagValue("catchUp", catchUp ? "1" : "0"));
order.algoParams().add(new TagValue("waitForFill", waitForFill ? "1" : "0"));
order.algoParams().add(new TagValue("activeTimeStart", startTime));
order.algoParams().add(new TagValue("activeTimeEnd", endTime));
```

``` EnlighterJSRAW
order.algoStrategy = "AD";
order.algoParams.reset(new TagValueList());
TagValueSPtr tag1(new TagValue("componentSize", std::to_string(componentSize)));
TagValueSPtr tag2(new TagValue("timeBetweenOrders",std::to_string(timeBetweenOrders)));
TagValueSPtr tag3(new TagValue("randomizeTime20", randomizeTime20 ? "1" : "0"));
TagValueSPtr tag4(new TagValue("randomizeSize55", randomizeSize55 ? "1" : "0"));
TagValueSPtr tag5(new TagValue("giveUp", std::to_string(giveUp)));
TagValueSPtr tag6(new TagValue("catchUp", catchUp ? "1" : "0"));
TagValueSPtr tag7(new TagValue("waitForFill", waitForFill ? "1" : "0"));
TagValueSPtr tag8(new TagValue("activeTimeStart", startTime));
TagValueSPtr tag9(new TagValue("activeTimeEnd", endTime));

order.algoParams->push_back(tag1);
order.algoParams->push_back(tag2);
order.algoParams->push_back(tag3);
order.algoParams->push_back(tag4);
order.algoParams->push_back(tag5);
order.algoParams->push_back(tag6);
order.algoParams->push_back(tag7);
order.algoParams->push_back(tag8);
order.algoParams->push_back(tag9);
```

``` EnlighterJSRAW
order.AlgoStrategy = "AD";
order.AlgoParams = new List();
order.AlgoParams.Add(new TagValue("componentSize", componentSize.ToString()));
order.AlgoParams.Add(new TagValue("timeBetweenOrders", timeBetweenOrders.ToString()));
order.AlgoParams.Add(new TagValue("randomizeTime20", randomizeTime20 ? "1" : "0"));
order.AlgoParams.Add(new TagValue("randomizeSize55", randomizeSize55 ? "1" : "0"));
order.AlgoParams.Add(new TagValue("giveUp", giveUp.ToString()));
order.AlgoParams.Add(new TagValue("catchUp", catchUp ? "1" : "0"));
order.AlgoParams.Add(new TagValue("waitForFill", waitForFill ? "1" : "0"));
order.AlgoParams.Add(new TagValue("activeTimeStart", startTime));
order.AlgoParams.Add(new TagValue("activeTimeEnd", endTime));
```

``` EnlighterJSRAW
order.AlgoStrategy = "AD"
order.AlgoParams = New List(Of TagValue)
order.AlgoParams.Add(New TagValue("componentSize", componentSize.ToString()))
order.AlgoParams.Add(New TagValue("timeBetweenOrders", timeBetweenOrders.ToString()))
order.AlgoParams.Add(New TagValue("randomizeTime20", BooleantoString(randomizeTime20)))
order.AlgoParams.Add(New TagValue("randomizeSize55", BooleantoString(randomizeSize55)))
order.AlgoParams.Add(New TagValue("giveUp", giveUp.ToString()))
order.AlgoParams.Add(New TagValue("catchUp", BooleantoString(catchUp)))
order.AlgoParams.Add(New TagValue("waitForFill", BooleantoString(waitForFill)))
order.AlgoParams.Add(New TagValue("activeTimeStart", startTime))
order.AlgoParams.Add(New TagValue("activeTimeEnd", endTime))
```

### Accumulate/Distribute (Alt.)

The “AccuDistr” variant of the Accumulate/Distribute Algo is conceptually the same as the pre-existing “AD”. However, “AccuDistr” introduces the ability to close existing Trader Workstation sessions while still allowing the algo to continue working. In addition to the underlying behavior change, “AccuDistr” appears visually different while viewed from Trader Workstation, offering a new menu under the “IB ALGO” tab.

It is important to note that “AccuDistr” has removed the ability to use the “giveUp” field. As such, users who require “giveUp” for their strategy MUST continue utilizing the “AD” variant for the Accumulate/Distribute algo.

**Algo Strategy Value:** AccuDistr

**componentSize:** int. Quantity of increment.  
Valid Value/Format: Cannot exceed initial size

**timeBetweenOrders:** int. Time interval in seconds between each order.  
Valid Value/Format: 30

**randomizeTime20:** bool. Randomize time period by +/- 20%.  
Valid Value/Format: 1 (true) or 0 (false)

**randomizeSize55:** bool. Randomize size by +/- 55%.  
Valid Value/Format: 1 (true) or 0 (false)

**catchUp:** bool. Catch up in time.  
Valid Value/Format: 1 (true) or 0 (false)

**waitForFill:** bool. Wait for current order to fill before submitting next order.  
Valid Value/Format: 1 (true) or 0 (false)

**activeTimeStart:** String. Algorithm starting time.  
Valid Value/Format: YYYYMMDD-hh:mm:ss TMZ

**activeTimeEnd:** String. Algorithm ending time.  
Valid Value/Format: YYYYMMDD-hh:mm:ss TMZ

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
order.algoStrategy = "AccuDistr"
order.algoParams = []
order.algoParams.append(TagValue("componentSize", componentSize))
order.algoParams.append(TagValue("timeBetweenOrders", timeBetweenOrders))
order.algoParams.append(TagValue("randomizeTime20", int(randomizeTime20)))
order.algoParams.append(TagValue("randomizeSize55", int(randomizeSize55)))
order.algoParams.append(TagValue("catchUp", int(catchUp)))
order.algoParams.append(TagValue("waitForFill", int(waitForFill)))
order.algoParams.append(TagValue("activeTimeStart", startTime))
order.algoParams.append(TagValue("activeTimeEnd", endTime))
```

``` EnlighterJSRAW
order.algoStrategy("AccuDistr");
order.algoParams(new ArrayList());
order.algoParams().add(new TagValue("componentSize", String.valueOf(componentSize)));
order.algoParams().add(new TagValue("timeBetweenOrders", String.valueOf(timeBetweenOrders)));
order.algoParams().add(new TagValue("randomizeTime20", randomizeTime20 ? "1" : "0"));
order.algoParams().add(new TagValue("randomizeSize55", randomizeSize55 ? "1" : "0"));
order.algoParams().add(new TagValue("catchUp", catchUp ? "1" : "0"));
order.algoParams().add(new TagValue("waitForFill", waitForFill ? "1" : "0"));
order.algoParams().add(new TagValue("activeTimeStart", startTime));
order.algoParams().add(new TagValue("activeTimeEnd", endTime));
```

``` EnlighterJSRAW
order.algoStrategy = "AccuDistr";
order.algoParams.reset(new TagValueList());
TagValueSPtr tag1(new TagValue("componentSize", std::to_string(componentSize)));
TagValueSPtr tag2(new TagValue("timeBetweenOrders",std::to_string(timeBetweenOrders)));
TagValueSPtr tag3(new TagValue("randomizeTime20", randomizeTime20 ? "1" : "0"));
TagValueSPtr tag4(new TagValue("randomizeSize55", randomizeSize55 ? "1" : "0"));
TagValueSPtr tag5(new TagValue("giveUp", std::to_string(catchUp)));
TagValueSPtr tag6(new TagValue("waitForFill", waitForFill ? "1" : "0"));
TagValueSPtr tag7(new TagValue("activeTimeStart", startTime));
TagValueSPtr tag8(new TagValue("activeTimeEnd", endTime));

order.algoParams->push_back(tag1);
order.algoParams->push_back(tag2);
order.algoParams->push_back(tag3);
order.algoParams->push_back(tag4);
order.algoParams->push_back(tag5);
order.algoParams->push_back(tag6);
order.algoParams->push_back(tag7);
order.algoParams->push_back(tag8);
```

``` EnlighterJSRAW
order.AlgoStrategy = "AccuDistr";
order.AlgoParams = new List();
order.AlgoParams.Add(new TagValue("componentSize", componentSize.ToString()));
order.AlgoParams.Add(new TagValue("timeBetweenOrders", timeBetweenOrders.ToString()));
order.AlgoParams.Add(new TagValue("randomizeTime20", randomizeTime20 ? "1" : "0"));
order.AlgoParams.Add(new TagValue("randomizeSize55", randomizeSize55 ? "1" : "0"));
order.AlgoParams.Add(new TagValue("catchUp", catchUp ? "1" : "0"));
order.AlgoParams.Add(new TagValue("waitForFill", waitForFill ? "1" : "0"));
order.AlgoParams.Add(new TagValue("activeTimeStart", startTime));
order.AlgoParams.Add(new TagValue("activeTimeEnd", endTime));
```

``` EnlighterJSRAW
order.AlgoStrategy = "AccuDistr"
order.AlgoParams = New List(Of TagValue)
order.AlgoParams.Add(New TagValue("componentSize", componentSize.ToString()))
order.AlgoParams.Add(New TagValue("timeBetweenOrders", timeBetweenOrders.ToString()))
order.AlgoParams.Add(New TagValue("randomizeTime20", BooleantoString(randomizeTime20)))
order.AlgoParams.Add(New TagValue("randomizeSize55", BooleantoString(randomizeSize55)))
order.AlgoParams.Add(New TagValue("catchUp", BooleantoString(catchUp)))
order.AlgoParams.Add(New TagValue("waitForFill", BooleantoString(waitForFill)))
order.AlgoParams.Add(New TagValue("activeTimeStart", startTime))
order.AlgoParams.Add(New TagValue("activeTimeEnd", endTime))
```

### Adaptive Algo

The [Adaptive Algo](https://www.interactivebrokers.com/en/index.php?f=19091) combines IB’s Smart routing capabilities with user-defined priority settings in an effort to achieve further cost efficiency at the point of execution. Using the Adaptive algo leads to better execution prices on average than for regular limit or market orders.

**Algo Strategy Value:** Adaptive

**adaptivePriority:** String. The ‘Priority’ selector determines the time taken to scan for better execution prices. The ‘Urgent’ setting scans only briefly, while the ‘Patient’ scan works more slowly and has a higher chance of achieving a better overall fill for your order.  
Valid Value/Format: Urgent \> Normal \> Patient

  - Python
  - cURL
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
order.algoStrategy = "Adaptive"
order.algoParams = []
order.algoParams.append(TagValue("adaptivePriority", priority))
```

``` EnlighterJSRAW
curl {baseUrl}/iserver/account/{accountId}/orders \
--request POST \
--header 'Content-Type:application/json' \
--data '{
  "orders": [
    {
      "conid": conid,
      "orderType": "LMT",
      "price": price,
      "side": "side",
      "tif": "tif",
      "quantity": quantity,
      "strategy": "Adaptive",
        "strategyParameters": {
          "adaptivePriority": "priority"
        }
    }
  ]
}'
```

``` EnlighterJSRAW
order.algoStrategy("Adaptive");
order.algoParams(new ArrayList());
order.algoParams().add(new TagValue("adaptivePriority", priority));
```

``` EnlighterJSRAW
order.algoStrategy = "Adaptive";
order.algoParams.reset(new TagValueList());
TagValueSPtr tag1(new TagValue("adaptivePriority", priority));
order.algoParams->push_back(tag1);
```

``` EnlighterJSRAW
order.AlgoStrategy = "Adaptive";
order.AlgoParams = new List();
order.AlgoParams.Add(new TagValue("adaptivePriority", priority));
```

``` EnlighterJSRAW
order.AlgoStrategy = "Adaptive"
order.AlgoParams = New List(Of TagValue)
order.AlgoParams.Add(New TagValue("adaptivePriority", priority))
```

### ArrivalPrice

The [Arrival Price](https://www.interactivebrokers.com/en/index.php?f=1122) algorithmic order type will attempt to achieve, over the course of the order, the bid/ask midpoint at the time the order is submitted. The Arrival Price algo is designed to keep hidden orders that will impact a high percentage of the average daily volume (ADV). The pace of execution is determined by the user-assigned level of risk aversion and the user-defined target percent of average daily volume. How quickly the order is submitted during the day is determined by the level of urgency: the higher the urgency the faster it will execute but will expose it to a greater market impact. Market impact can be lessened by assigning lesser urgency, which is likely to lengthen the duration of the order. The user can set the max percent of ADV from 1 to 50%. The order entry screen allows the user to determine when the order will start and end regardless of whether or not the full amount of the order has been filled. By checking the box marked Allow trading past end time the algo will continue to work past the specified end time in an effort to fill the remaining portion of the order.

**Algo Strategy Value:** ArrivalPx

**maxPctVol:** double. Maximum percentage of ADV  
Valid Value/Format: 0.1 (10%) – 0.5 (50%)

**riskAversion:** String. Urgency/risk aversion  
Valid Value/Format: Get Done, Aggressive, Neutral, Passive

**startTime:** String. Algorithm starting time  
Valid Value/Format: hh:mm:ss TMZ or YYYYMMDD-hh:mm:ss TMZ

**endTime:** String. Algorithm ending time  
Valid Value/Format: hh:mm:ss TMZ or YYYYMMDD-hh:mm:ss TMZ

**allowPastEndTime:** bool. Allow trading past end time  
Valid Value/Format: 1 (true) or 0 (false)

**forceCompletion:** bool. Attempt completion by the end of the day  
Valid Value/Format: 1 (true) or 0 (false)

  - Python
  - cURL
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
def FillArrivalPriceParams(baseOrder: Order, maxPctVol: float,
                               riskAversion: str, startTime: str, endTime: str,
                               forceCompletion: bool, allowPastTime: bool):
        baseOrder.algoStrategy = "ArrivalPx"
        baseOrder.algoParams = []
        baseOrder.algoParams.append(TagValue("maxPctVol", maxPctVol))
        baseOrder.algoParams.append(TagValue("riskAversion", riskAversion))
        baseOrder.algoParams.append(TagValue("startTime", startTime))
        baseOrder.algoParams.append(TagValue("endTime", endTime))
        baseOrder.algoParams.append(TagValue("forceCompletion",
                                             int(forceCompletion)))
        baseOrder.algoParams.append(TagValue("allowPastEndTime",
                                             int(allowPastTime)))

order = Order()
order.action = "BUY"
order.orderType = "MKT"
order.totalQuantity = 100

self.FillArrivalPriceParams(order, 0.1, "Aggressive", "09:00:00 US/Eastern", "16:00:00 US/Eastern", True, True)
order_id = self.nextValidOrderId   
self.placeOrder(order_id, contract, order)
```

``` EnlighterJSRAW
curl {baseUrl}/iserver/account/{accountId}/orders \
--request POST \
--header 'Content-Type:application/json' \
--data '{
  "orders": [
    {
      "conid": conid,
      "orderType": "LMT",
      "price": price,
      "side": "side",
      "tif": "tif",
      "quantity": quantity,
      "strategy": "ArrivalPx",
        "strategyParameters": {
          "maxPctVol": 0.1,
          "riskAversion": true,
          "startTime": "20250415-12:34:56",
          "endTime": "20250415-15:00:00",
          "allowPastEndTime": true,
          "forceCompletion": true
        }
    }
  ]
}'
```

``` EnlighterJSRAW
order.algoStrategy("ArrivalPx");
order.algoParams(new ArrayList());
order.algoParams().add(new TagValue("maxPctVol", String.valueOf(maxPctVol)));
order.algoParams().add(new TagValue("riskAversion", riskAversion));
order.algoParams().add(new TagValue("startTime", startTime));
order.algoParams().add(new TagValue("endTime", endTime));
order.algoParams().add(new TagValue("forceCompletion", forceCompletion ? "1" : "0"));
order.algoParams().add(new TagValue("allowPastEndTime", allowPastTime ? "1" : "0"));
```

``` EnlighterJSRAW
order.algoStrategy = "ArrivalPx";
order.algoParams.reset(new TagValueList());
TagValueSPtr tag1(new TagValue("maxPctVol", std::to_string(maxPctVol)));
TagValueSPtr tag2(new TagValue("riskAversion", riskAversion));
TagValueSPtr tag3(new TagValue("startTime", startTime));
TagValueSPtr tag4(new TagValue("endTime", endTime));
TagValueSPtr tag5(new TagValue("forceCompletion", forceCompletion ? "1" : "0"));
TagValueSPtr tag6(new TagValue("allowPastEndTime", allowPastTime ? "1" : "0"));
order.algoParams->push_back(tag1);
order.algoParams->push_back(tag2);
order.algoParams->push_back(tag3);
order.algoParams->push_back(tag4);
order.algoParams->push_back(tag5);
order.algoParams->push_back(tag6);
```

``` EnlighterJSRAW
order.AlgoStrategy = "ArrivalPx";
order.AlgoParams = new List();
order.AlgoParams.Add(new TagValue("maxPctVol", maxPctVol.ToString()));
order.AlgoParams.Add(new TagValue("riskAversion", riskAversion));
order.AlgoParams.Add(new TagValue("startTime", startTime));
order.AlgoParams.Add(new TagValue("endTime", endTime));
order.AlgoParams.Add(new TagValue("forceCompletion", forceCompletion ? "1" : "0"));
order.AlgoParams.Add(new TagValue("allowPastEndTime", allowPastTime ? "1" : "0"));
```

``` EnlighterJSRAW
order.AlgoStrategy = "ArrivalPx"
order.AlgoParams = New List(Of TagValue)
order.AlgoParams.Add(New TagValue("maxPctVol", maxPctVol.ToString()))
order.AlgoParams.Add(New TagValue("riskAversion", riskAversion))
order.AlgoParams.Add(New TagValue("startTime", startTime))
order.AlgoParams.Add(New TagValue("endTime", endTime))
order.AlgoParams.Add(New TagValue("forceCompletion", BooleantoString(forceCompletion)))
order.AlgoParams.Add(New TagValue("allowPastEndTime", BooleantoString(allowPastTime)))
```

### Balance Impact Risk

The [Balance Impact Risk](https://www.interactivebrokers.com/en/index.php?f=1120) balances the market impact of trading the option with the risk of price change over the time horizon of the order. This strategy considers the user-assigned level of risk aversion to define the pace of the execution, along with the user-defined target percent of volume.

**Algo Strategy Value:** BalanceImpactRisk

**maxPctVol:** double. Maximum percentage of ADV  
Valid Value/Format: 0.1 (10%) – 0.5 (50%)

**riskAversion:** String. Urgency/risk aversion  
Valid Value/Format: Get Done, Aggressive, Neutral, Passive

**forceCompletion:** bool. Attempt completion by the end of the day  
Valid Value/Format: 1 (true) or 0 (false)

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
order.algoStrategy = "BalanceImpactRisk"
order.algoParams = []
order.algoParams.append(TagValue("maxPctVol", maxPctVol))
order.algoParams.append(TagValue("riskAversion", riskAversion))
order.algoParams.append(TagValue("forceCompletion", int(forceCompletion)))
```

``` EnlighterJSRAW
order.algoStrategy("BalanceImpactRisk");
order.algoParams(new ArrayList());
order.algoParams().add(new TagValue("maxPctVol", String.valueOf(maxPctVol)));
order.algoParams().add(new TagValue("riskAversion", riskAversion));
order.algoParams().add(new TagValue("forceCompletion", forceCompletion ? "1" : "0"));
```

``` EnlighterJSRAW
order.algoStrategy = "BalanceImpactRisk";
order.algoParams.reset(new TagValueList());
TagValueSPtr tag1(new TagValue("maxPctVol", std::to_string(maxPctVol)));
TagValueSPtr tag2(new TagValue("riskAversion", riskAversion));
TagValueSPtr tag3(new TagValue("forceCompletion", forceCompletion ? "1" : "0"));
order.algoParams->push_back(tag1);
order.algoParams->push_back(tag2);
order.algoParams->push_back(tag3);
```

``` EnlighterJSRAW
order.AlgoStrategy = "BalanceImpactRisk";
order.AlgoParams = new List();
order.AlgoParams.Add(new TagValue("maxPctVol", maxPctVol.ToString()));
order.AlgoParams.Add(new TagValue("riskAversion", riskAversion));
order.AlgoParams.Add(new TagValue("forceCompletion", forceCompletion ? "1" : "0"));
```

``` EnlighterJSRAW
order.AlgoStrategy = "BalanceImpactRisk"
order.AlgoParams = New List(Of TagValue)
order.AlgoParams.Add(New TagValue("maxPctVol", maxPctVol.ToString()))
order.AlgoParams.Add(New TagValue("riskAversion", riskAversion))
order.AlgoParams.Add(New TagValue("forceCompletion", BooleantoString(forceCompletion)))
```

### Close Price

Investors submitting market or limit orders into the closing auction may adversely affect the closing price, especially when the size of the order is large relative to the average close auction volume. In order to help investors attempting to execute towards the end of the trading session we have developed the [Close Price](https://www.interactivebrokers.com/en/index.php?f=19749) algo Strategy. This algo breaks down large order amounts and determines the timing of order entry so that it will continuously execute in order to minimize slippage. The start and pace of execution are determined by the user who assigns a level of market risk and specifies the target percentage of volume, while the algo considers the prior volatility of the stock.

**Algo Strategy Value:** ClosePx

**maxPctVol:** double. Maximum percentage of ADV  
Valid Value/Format: 0.1 (10%) – 0.5 (50%)

**riskAversion:** String. Urgency/risk aversion  
Valid Value/Format: Get Done, Aggressive, Neutral, Passive

**startTime:** String. Algorithm starting time  
Valid Value/Format: hh:mm:ss TMZ or YYYYMMDD-hh:mm:ss TMZ

**forceCompletion:** bool. Attempt completion by the end of the day  
Valid Value/Format: 1 (true) or 0 (false)

  - Python
  - cURL
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
order.algoStrategy = "ClosePx"
order.algoParams = []
order.algoParams.append(TagValue("maxPctVol", maxPctVol))
order.algoParams.append(TagValue("riskAversion", riskAversion))
order.algoParams.append(TagValue("startTime", startTime))
order.algoParams.append(TagValue("forceCompletion", int(forceCompletion)))
```

``` EnlighterJSRAW
curl {baseUrl}/iserver/account/{accountId}/orders \
--request POST \
--header 'Content-Type:application/json' \
--data '{
  "orders": [
    {
      "conid": conid,
      "orderType": "LMT",
      "price": price,
      "side": "side",
      "tif": "tif",
      "quantity": quantity,
      "strategy": "ClosePx",
        "strategyParameters": {
          "riskAversion": "Aggressive",
          "forceCompletion": true,
          "startTime": "20250415-12:34:56",
          "maxPctVol": 0.1
        }
    }
  ]
}'
```

``` EnlighterJSRAW
order.algoStrategy("ClosePx");
order.algoParams(new ArrayList());
order.algoParams().add(new TagValue("maxPctVol", String.valueOf(maxPctVol)));
order.algoParams().add(new TagValue("riskAversion", riskAversion));
order.algoParams().add(new TagValue("startTime", startTime));
order.algoParams().add(new TagValue("forceCompletion", forceCompletion ? "1" : "0"));
```

``` EnlighterJSRAW
order.algoStrategy = "ClosePx";
order.algoParams.reset(new TagValueList());
TagValueSPtr tag1(new TagValue("maxPctVol", std::to_string(maxPctVol)));
TagValueSPtr tag2(new TagValue("riskAversion",riskAversion));
TagValueSPtr tag3(new TagValue("startTime", startTime));
TagValueSPtr tag4(new TagValue("forceCompletion", forceCompletion ? "1" : "0"));
order.algoParams->push_back(tag1);
order.algoParams->push_back(tag2);
order.algoParams->push_back(tag3);
order.algoParams->push_back(tag4);
```

``` EnlighterJSRAW
order.AlgoStrategy = "ClosePx";
order.AlgoParams = new List();
order.AlgoParams.Add(new TagValue("maxPctVol", maxPctVol.ToString()));
order.AlgoParams.Add(new TagValue("riskAversion", riskAversion));
order.AlgoParams.Add(new TagValue("startTime", startTime));
order.AlgoParams.Add(new TagValue("forceCompletion", forceCompletion ? "1" : "0"));
```

``` EnlighterJSRAW
order.AlgoStrategy = "ClosePx"
order.AlgoParams = New List(Of TagValue)
order.AlgoParams.Add(New TagValue("maxPctVol", maxPctVol.ToString()))
order.AlgoParams.Add(New TagValue("riskAversion", riskAversion))
order.AlgoParams.Add(New TagValue("startTime", startTime))
order.AlgoParams.Add(New TagValue("forceCompletion", BooleantoString(forceCompletion)))
```

### DarkIce

The [Dark Ice](https://www.interactivebrokers.com/en/index.php?f=3123) order type develops the concept of privacy adopted by orders such as Iceberg or Reserve, using a proprietary algorithm to further hide the volume displayed to the market by the order. Clients can determine the timeframe an order remains live and have the option to allow trading past end time in the event it is unfilled by the stated end time. In order to minimize market impact in the event of large orders, users can specify a display size to be shown to the market different from the actual order size. Additionally, the Dark Ice algo randomizes the display size +/- 50% based upon the probability of the price moving favorably. Further, using calculated probabilities, the algo decides whether to place the order at the limit price or one tick lower than the current offer for buy orders and one tick higher than the current bid for sell orders.

**Algo Strategy Value:** DarkIce

**displaySize:** double. Order size to be displayed  
Valid Value/Format: 100

**startTime:** String. Algorithm starting time  
Valid Value/Format: hh:mm:ss TMZ or YYYYMMDD-hh:mm:ss TMZ

**endTime:** String. Algorithm ending time  
Valid Value/Format: hh:mm:ss TMZ or YYYYMMDD-hh:mm:ss TMZ

**allowPastEndTime:** bool. Allow trading past end time  
Valid Value/Format: 1 (true) or 0 (false)

  - Python
  - cURL
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
order.algoStrategy = "DarkIce"
order.algoParams = []
order.algoParams.append(TagValue("displaySize", displaySize))
order.algoParams.append(TagValue("startTime", startTime))
order.algoParams.append(TagValue("endTime", endTime))
order.algoParams.append(TagValue("allowPastEndTime", int(allowPastEndTime)))
```

``` EnlighterJSRAW
curl {baseUrl}/iserver/account/{accountId}/orders \
--request POST \
--header 'Content-Type:application/json' \
--data '{
  "orders": [
    {
      "conid": conid,
      "orderType": "LMT",
      "price": price,
      "side": "side",
      "tif": "tif",
      "quantity": quantity,
      "strategy": "DarkIce",
        "strategyParameters": {
          "allowPastEndTime": true,
          "displaySize": 100,
          "startTime": "20250415-12:34:56",
          "endTime": "20250415-15:00:00"
        }
    }
  ]
}'
```

``` EnlighterJSRAW
order.algoStrategy("DarkIce");
order.algoParams(new ArrayList());
order.algoParams().add(new TagValue("displaySize", String.valueOf(displaySize)));
order.algoParams().add(new TagValue("startTime", startTime));
order.algoParams().add(new TagValue("endTime", endTime));
order.algoParams().add(new TagValue("allowPastEndTime", allowPastEndTime ? "1" : "0"));
```

``` EnlighterJSRAW
order.algoStrategy = "DarkIce";
order.algoParams.reset(new TagValueList());
TagValueSPtr tag1(new TagValue("displaySize", std::to_string(displaySize)));
TagValueSPtr tag2(new TagValue("startTime", startTime));
TagValueSPtr tag3(new TagValue("endTime", endTime));
TagValueSPtr tag4(new TagValue("allowPastEndTime", allowPastEndTime ? "1" : "0"));
order.algoParams->push_back(tag1);
order.algoParams->push_back(tag2);
order.algoParams->push_back(tag3);
order.algoParams->push_back(tag4);
```

``` EnlighterJSRAW
order.AlgoStrategy = "DarkIce";
order.AlgoParams = new List();
order.AlgoParams.Add(new TagValue("displaySize", displaySize.ToString()));
order.AlgoParams.Add(new TagValue("startTime", startTime));
order.AlgoParams.Add(new TagValue("endTime", endTime));
order.AlgoParams.Add(new TagValue("allowPastEndTime", allowPastEndTime ? "1" : "0"));
```

``` EnlighterJSRAW
order.AlgoStrategy = "DarkIce"
order.AlgoParams = New List(Of TagValue)
order.AlgoParams.Add(New TagValue("displaySize", displaySize.ToString()))
order.AlgoParams.Add(New TagValue("startTime", startTime))
order.AlgoParams.Add(New TagValue("endTime", endTime))
order.AlgoParams.Add(New TagValue("allowPastEndTime", BooleantoString(allowPastEndTime)))
```

### Midprice

A [Midprice](https://www.interactivebrokers.com/en/index.php?f=36735) order is designed to split the difference between the bid and ask prices, and fill at the current midpoint of the NBBO or better. Set an optional price cap to define the highest price (for a buy order) or the lowest price (for a sell order) you are willing to accept. Smart-routing to US stocks only.

  - Products: US STK
  - Exchanges: Smart-routing only

**Set OrderType to** “MIDPRICE”.

No algo params or strategy required.

  - Python
  - cURL
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
order = Order()
order.action = action
order.orderType = "MIDPRICE"
order.totalQuantity = quantity
order.lmtPrice = priceCap
```

``` EnlighterJSRAW
curl --insecure https://localhost:5000/v1/api/iserver/account/{{accountId}}/orders \
--request POST \
--header 'Content-Type:application/json' \
--data '{
    "orders":[
        {
            "conid": {{ conid }},
            "orderType": "MIDPRICE",
            "price": {{ price }},
            "quantity": {{ quantity }},
            "side": {{ side }},
            "tif": {{ tif }}
        }
    ]
}'
```

For the Client Portal API, a price must be included. If no price cap is desired, ‘”price”: 0’ should be included.

``` EnlighterJSRAW
Order order = new Order();
order.action(action);
order.orderType("MIDPRICE");
order.totalQuantity(quantity);
order.lmtPrice(priceCap); 
```

``` EnlighterJSRAW
Order order;
order.action = action;
order.orderType = "MIDPRICE";
order.totalQuantity = quantity;
order.lmtPrice = priceCap; 
```

``` EnlighterJSRAW
Order order = new Order();
order.Action = action;
order.OrderType = "MIDPRICE";
order.TotalQuantity = quantity;
order.LmtPrice = priceCap;
```

``` EnlighterJSRAW
Dim order As Order = New Order
order.Action = action
order.OrderType = "MIDPRICE"
order.TotalQuantity = quantity
order.LmtPrice = priceCap  ' optional
```

### Minimise Impact

The [Minimise Impact](https://www.interactivebrokers.com/en/index.php?f=1121) algo minimises market impact by slicing the order over time to achieve a market average without going over the given maximum percentage value.

**Algo Strategy Value:** MinImpact

**maxPctVol:** double. Maximum percentage of ADV  
Valid Value/Format: 0.1 (10%) – 0.5 (50%)

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
order.algoStrategy = "MinImpact"
order.algoParams = []
order.algoParams.append(TagValue("maxPctVol", maxPctVol))
```

``` EnlighterJSRAW
order.algoStrategy("BalanceImpactRisk");
order.algoParams(new ArrayList());
order.algoParams().add(new TagValue("maxPctVol", String.valueOf(maxPctVol)));
```

``` EnlighterJSRAW
order.algoStrategy = "MinImpact";
order.algoParams.reset(new TagValueList());
TagValueSPtr tag1(new TagValue("maxPctVol", std::to_string(maxPctVol)));
order.algoParams->push_back(tag1);
```

``` EnlighterJSRAW
order.AlgoStrategy = "MinImpact";
order.AlgoParams = new List();
order.AlgoParams.Add(new TagValue("maxPctVol", maxPctVol.ToString()));
```

``` EnlighterJSRAW
order.AlgoStrategy = "MinImpact"
order.AlgoParams = New List(Of TagValue)
order.AlgoParams.Add(New TagValue("maxPctVol", maxPctVol.ToString()))
```

### Percentage of Volume

The [Percent of Volume ](https://www.interactivebrokers.com/en/index.php?f=1123)algo can limit the contribution of orders to overall average daily volume in order to minimize impact. Clients can set a value between 1-50% to control their participation between stated start and end times. Order quantity and volume distribution over the day is determined using the target percent of volume you entered along with continuously updated volume forecasts calculated from TWS market data. In addition, the algo can be set to avoid taking liquidity, which may help avoid liquidity-taker fees and could result in liquidity-adding rebates. By checking the Attempt to never take liquidity box, the algo is discouraged from hitting the bid or lifting the offer if possible. However, this may also result in greater deviations from the benchmark, and in partial fills, since the posted bid/offer may not always get hit as the price moves up/down. IB will use best efforts not to take liquidity when this box is checked, however, there will be times that it cannot be avoided.

**Algo Strategy Value:** PctVol

**pctVol:** double. Total percentage  
Valid Value/Format: 0.1 (10%) – 0.5 (50%)

**startTime:** String. Algorithm starting time  
Valid Value/Format: hh:mm:ss TMZ or YYYYMMDD-hh:mm:ss TMZ

**endTime:** String. Algorithm ending time  
Valid Value/Format: hh:mm:ss TMZ or YYYYMMDD-hh:mm:ss TMZ

**noTakeLiq:** bool. Attempt to never take liquidity  
Valid Value/Format: 1 (true) or 0 (false)

  - Python
  - cURL
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
order.algoStrategy = "PctVol"
order.algoParams = []
order.algoParams.append(TagValue("pctVol", pctVol))
order.algoParams.append(TagValue("startTime", startTime))
order.algoParams.append(TagValue("endTime", endTime))
order.algoParams.append(TagValue("noTakeLiq", int(noTakeLiq)))
```

``` EnlighterJSRAW
curl {baseUrl}/iserver/account/{accountId}/orders \
--request POST \
--header 'Content-Type:application/json' \
--data '{
  "orders": [
    {
      "conid": conid,
      "orderType": "LMT",
      "price": price,
      "side": "side",
      "tif": "tif",
      "quantity": quantity,
      "strategy": "PctVol",
        "strategyParameters": {
          "noTakeLiq": true,
          "includeBlockTrades": true,
          "pctVol": 15.0,
          "conditionalPrice": 123.45,
          "startTime": "20250415-12:34:56",
          "endTime": "20250415-15:00:00"
        }
    }
  ]
}'
```

``` EnlighterJSRAW
order.algoStrategy("PctVol");
order.algoParams(new ArrayList());
order.algoParams().add(new TagValue("pctVol", String.valueOf(pctVol)));
order.algoParams().add(new TagValue("startTime", startTime));
order.algoParams().add(new TagValue("endTime", endTime));
order.algoParams().add(new TagValue("noTakeLiq", noTakeLiq ? "1" : "0"));
```

``` EnlighterJSRAW
order.algoStrategy = "PctVol";
order.algoParams.reset(new TagValueList());
TagValueSPtr tag1(new TagValue("pctVol", std::to_string(pctVol)));
TagValueSPtr tag2(new TagValue("startTime", startTime));
TagValueSPtr tag3(new TagValue("endTime", endTime));
TagValueSPtr tag4(new TagValue("noTakeLiq", noTakeLiq ? "1" : "0"));
order.algoParams->push_back(tag1);
order.algoParams->push_back(tag2);
order.algoParams->push_back(tag3);
order.algoParams->push_back(tag4);
```

``` EnlighterJSRAW
order.AlgoStrategy = "PctVol";
order.AlgoParams = new List();
order.AlgoParams.Add(new TagValue("pctVol", pctVol.ToString()));
order.AlgoParams.Add(new TagValue("startTime", startTime));
order.AlgoParams.Add(new TagValue("endTime", endTime));
order.AlgoParams.Add(new TagValue("noTakeLiq", noTakeLiq ? "1" : "0"));
```

``` EnlighterJSRAW
order.AlgoStrategy = "PctVol"
order.AlgoParams = New List(Of TagValue)
order.AlgoParams.Add(New TagValue("pctVol", pctVol.ToString()))
order.AlgoParams.Add(New TagValue("startTime", startTime))
order.AlgoParams.Add(New TagValue("endTime", endTime))
order.AlgoParams.Add(New TagValue("noTakeLiq", BooleantoString(noTakeLiq)))
```

### Price Variant Percentage

[Price Variant Percentage of Volume Strategy](https://www.interactivebrokers.com/en/index.php?f=14369#collapse03) – This algo allows you to participate in volume at a user-defined rate that varies over time depending on the market price of the security. This algo allows you to buy more aggressively when the price is low and be more passive as the price increases, and just the opposite for sell orders. The order quantity and volume distribution over the time during which the order is active is determined using the target percent of volume you entered along with continuously updated volume forecasts calculated from TWS market data.

**Algo Strategy Value:** PctVolPx

**pctVol:** double. Total percentage  
Valid Value/Format: 0.1 (10%) – 0.5 (50%)

**deltaPctVol:** double. Target Percentage Change Rate  
Valid Value/Format: 0.1 (10%) – 0.5 (50%)

**minPctVol4Px:** double. Minimum Target Percentage  
Valid Value/Format: 0.1 (10%) – 0.5 (50%)

**maxPctVol4Px:** double. Maximum Target Percentage  
Valid Value/Format: 0.1 (10%) – 0.5 (50%)

**startTime:** String. Algorithm starting time  
Valid Value/Format: hh:mm:ss TMZ or YYYYMMDD-hh:mm:ss TMZ

**endTime:** String. Algorithm ending time  
Valid Value/Format: hh:mm:ss TMZ or YYYYMMDD-hh:mm:ss TMZ

**noTakeLiq:** bool. Attempt to never take liquidity  
Valid Value/Format: 1 (true) or 0 (false)

  - Python
  - cURL
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
order.algoStrategy = "PctVolPx"
order.algoParams = []
order.algoParams.append(TagValue("pctVol", pctVol))
order.algoParams.append(TagValue("deltaPctVol", deltaPctVol))
order.algoParams.append(TagValue("minPctVol4Px", minPctVol4Px))
order.algoParams.append(TagValue("maxPctVol4Px", maxPctVol4Px))
order.algoParams.append(TagValue("startTime", startTime))
order.algoParams.append(TagValue("endTime", endTime))
order.algoParams.append(TagValue("noTakeLiq", int(noTakeLiq)))
```

``` EnlighterJSRAW
curl {baseUrl}/iserver/account/{accountId}/orders \
--request POST \
--header 'Content-Type:application/json' \
--data '{
  "orders": [
    {
      "conid": conid,
      "orderType": "LMT",
      "price": price,
      "side": "side",
      "tif": "tif",
      "quantity": quantity,
      "strategy": "PctVolPx",
        "strategyParameters": {
          "minPctVol4Px": 0.1,
          "maxPctVol4Px": 0.5,
          "noTakeLiq": true,
          "includeBlockTrades": true,
          "pctVol": 15.0,
          "deltaPctVol": 1.00,
          "conditionalPrice": 123.45,
          "startTime": "20250415-12:34:56",
          "endTime": "20250415-15:00:00"
        }
    }
  ]
}'
```

``` EnlighterJSRAW
order.algoStrategy("PctVolPx");
order.algoParams(new ArrayList());
order.algoParams().add(new TagValue("pctVol", String.valueOf(pctVol)));
order.algoParams().add(new TagValue("deltaPctVol", String.valueOf(deltaPctVol)));
order.algoParams().add(new TagValue("minPctVol4Px", String.valueOf(minPctVol4Px)));
order.algoParams().add(new TagValue("maxPctVol4Px", String.valueOf(maxPctVol4Px)));
order.algoParams().add(new TagValue("startTime", startTime));
order.algoParams().add(new TagValue("endTime", endTime));
order.algoParams().add(new TagValue("noTakeLiq", noTakeLiq ? "1" : "0"));
```

``` EnlighterJSRAW
order.algoStrategy = "PctVolPx";
order.algoParams.reset(new TagValueList());
TagValueSPtr tag1(new TagValue("pctVol", std::to_string(pctVol)));
TagValueSPtr tag2(new TagValue("deltaPctVol", std::to_string(deltaPctVol)));
TagValueSPtr tag3(new TagValue("minPctVol4Px", std::to_string(minPctVol4Px)));
TagValueSPtr tag4(new TagValue("maxPctVol4Px", std::to_string(maxPctVol4Px)));
TagValueSPtr tag5(new TagValue("startTime", startTime));
TagValueSPtr tag6(new TagValue("endTime", endTime));
TagValueSPtr tag7(new TagValue("noTakeLiq", noTakeLiq ? "1" : "0"));
order.algoParams->push_back(tag1);
order.algoParams->push_back(tag2);
order.algoParams->push_back(tag3);
order.algoParams->push_back(tag4);
order.algoParams->push_back(tag5);
order.algoParams->push_back(tag6);
order.algoParams->push_back(tag7);
```

``` EnlighterJSRAW
order.AlgoStrategy = "PctVolPx";
order.AlgoParams = new List();
order.AlgoParams.Add(new TagValue("pctVol", pctVol.ToString()));
order.AlgoParams.Add(new TagValue("deltaPctVol", deltaPctVol.ToString()));
order.AlgoParams.Add(new TagValue("minPctVol4Px", minPctVol4Px.ToString()));
order.AlgoParams.Add(new TagValue("maxPctVol4Px", maxPctVol4Px.ToString()));
order.AlgoParams.Add(new TagValue("startTime", startTime));
order.AlgoParams.Add(new TagValue("endTime", endTime));
order.AlgoParams.Add(new TagValue("noTakeLiq", noTakeLiq ? "1" : "0"));
```

``` EnlighterJSRAW
order.AlgoStrategy = "PctVolPx"
order.AlgoParams = New List(Of TagValue)
order.AlgoParams.Add(New TagValue("pctVol", pctVol.ToString()))
order.AlgoParams.Add(New TagValue("deltaPctVol", deltaPctVol.ToString()))
order.AlgoParams.Add(New TagValue("minPctVol4Px", minPctVol4Px.ToString()))
order.AlgoParams.Add(New TagValue("maxPctVol4Px", maxPctVol4Px.ToString()))
order.AlgoParams.Add(New TagValue("startTime", startTime))
order.AlgoParams.Add(New TagValue("endTime", endTime))
order.AlgoParams.Add(New TagValue("noTakeLiq", BooleantoString(noTakeLiq)))
```

### Size Variant Percentage

[Size Variant Percentage of Volume Strategy](https://www.interactivebrokers.com/en/index.php?f=14369#collapse02) – This algo allows you to participate in volume at a user-defined rate that varies over time depending on the remaining size of the order. Define the target percent rate at the start time (Initial Participation Rate) and at the end time (Terminal Participation Rate), and the algo calculates the participation rate over time between the two based on the remaining order size. This allows the order to be more aggressive initially and less aggressive toward the end, or vice versa.

**Algo Strategy Value:** PctVolSz

**startPctVol:** double. Initial Target Percentage  
Valid Value/Format: 0.1 (10%) – 0.5 (50%)

**endPctVol:** double. Terminal Target Percentage  
Valid Value/Format: 0.1 (10%) – 0.5 (50%)

**startTime:** String. Algorithm starting time  
Valid Value/Format: hh:mm:ss TMZ or YYYYMMDD-hh:mm:ss TMZ

**endTime:** String. Algorithm ending time  
Valid Value/Format: hh:mm:ss TMZ or YYYYMMDD-hh:mm:ss TMZ

**noTakeLiq:** bool. Attempt to never take liquidity  
Valid Value/Format: 1 (true) or 0 (false)

  - Python
  - cURL
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
order.algoStrategy = "PctVolSz"
order.algoParams = []
order.algoParams.append(TagValue("startPctVol", startPctVol))
order.algoParams.append(TagValue("endPctVol", endPctVol))
order.algoParams.append(TagValue("startTime", startTime))
order.algoParams.append(TagValue("endTime", endTime))
order.algoParams.append(TagValue("noTakeLiq", int(noTakeLiq)))
```

``` EnlighterJSRAW
curl {baseUrl}/iserver/account/{accountId}/orders \
--request POST \
--header 'Content-Type:application/json' \
--data '{
  "orders": [
    {
      "conid": conid,
      "orderType": "LMT",
      "price": price,
      "side": "side",
      "tif": "tif",
      "quantity": quantity,
      "strategy": "PctVolSz",
        "strategyParameters": {
          "startPctVol": 0.1,
          "endPctVol": 50.0,
          "noTakeLiq": true,
          "includeBlockTrades": true,
          "pctVol": 15.0,
          "conditionalPrice": 123.45,
          "startTime": "20250415-12:34:56",
          "endTime": "20250415-15:00:00"
        }
    }
  ]
}'
```

``` EnlighterJSRAW
order.algoStrategy("PctVolSz");
order.algoParams(new ArrayList());
order.algoParams().add(new TagValue("startPctVol", String.valueOf(startPctVol)));
order.algoParams().add(new TagValue("endPctVol", String.valueOf(endPctVol)));
order.algoParams().add(new TagValue("startTime", startTime));
order.algoParams().add(new TagValue("endTime", endTime));
order.algoParams().add(new TagValue("noTakeLiq", noTakeLiq ? "1" : "0"));
```

``` EnlighterJSRAW
order.algoStrategy = "PctVolSz";
order.algoParams.reset(new TagValueList());
TagValueSPtr tag1(new TagValue("startPctVol", std::to_string(startPctVol)));
TagValueSPtr tag2(new TagValue("endPctVol", std::to_string(endPctVol)));
TagValueSPtr tag3(new TagValue("startTime", startTime));
TagValueSPtr tag4(new TagValue("endTime", endTime));
TagValueSPtr tag5(new TagValue("noTakeLiq", noTakeLiq ? "1" : "0"));
order.algoParams->push_back(tag1);
order.algoParams->push_back(tag2);
order.algoParams->push_back(tag3);
order.algoParams->push_back(tag4);
order.algoParams->push_back(tag5);
```

``` EnlighterJSRAW
order.AlgoStrategy = "PctVolSz";
order.AlgoParams = new List();
order.AlgoParams.Add(new TagValue("startPctVol", startPctVol.ToString()));
order.AlgoParams.Add(new TagValue("endPctVol", endPctVol.ToString()));
order.AlgoParams.Add(new TagValue("startTime", startTime));
order.AlgoParams.Add(new TagValue("endTime", endTime));
order.AlgoParams.Add(new TagValue("noTakeLiq", noTakeLiq ? "1" : "0"));
```

``` EnlighterJSRAW
order.AlgoStrategy = "PctVolSz"
order.AlgoParams = New List(Of TagValue)
order.AlgoParams.Add(New TagValue("startPctVol", startPctVol.ToString()))
order.AlgoParams.Add(New TagValue("endPctVol", endPctVol.ToString()))
order.AlgoParams.Add(New TagValue("startTime", startTime))
order.AlgoParams.Add(New TagValue("endTime", endTime))
order.AlgoParams.Add(New TagValue("noTakeLiq", BooleantoString(noTakeLiq)))
```

### Time Variant Percentage

[Time Variant Percentage of Volume Strategy](https://www.interactivebrokers.com/en/index.php?f=14369#collapse01) – This algo allows you to participate in volume at a user-defined rate that varies with time. Define the target percent rate at the start time and at the end time, and the algo calculates the participation rate over time between the two. This allows the order to be more aggressive initially and less aggressive toward the end, or vice versa.

**Algo Strategy Value:** PctVolTm

**startPctVol:** double. Initial Target Percentage  
Valid Value/Format: 0.1 (10%) – 0.5 (50%)

**endPctVol:** double. Terminal Target Percentage  
Valid Value/Format: 0.1 (10%) – 0.5 (50%)

**startTime:** String. Algorithm starting time  
Valid Value/Format: hh:mm:ss TMZ or YYYYMMDD-hh:mm:ss TMZ

**endTime:** String. Algorithm ending time  
Valid Value/Format: hh:mm:ss TMZ or YYYYMMDD-hh:mm:ss TMZ

**noTakeLiq:** bool. Attempt to never take liquidity  
Valid Value/Format: 1 (true) or 0 (false)

  - Python
  - cURL
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
order.algoStrategy = "PctVolTm"
order.algoParams = []
order.algoParams.append(TagValue("startPctVol", startPctVol))
order.algoParams.append(TagValue("endPctVol", endPctVol))
order.algoParams.append(TagValue("startTime", startTime))
order.algoParams.append(TagValue("endTime", endTime))
order.algoParams.append(TagValue("noTakeLiq", int(noTakeLiq)))
```

``` EnlighterJSRAW
curl {baseUrl}/iserver/account/{accountId}/orders \
--request POST \
--header 'Content-Type:application/json' \
--data '{
  "orders": [
    {
      "conid": conid,
      "orderType": "LMT",
      "price": price,
      "side": "side",
      "tif": "tif",
      "quantity": quantity,
      "strategy": "PctVolTm",
        "strategyParameters": {
          "startPctVol": 0.1,
          "endPctVol": 50.0,
          "noTakeLiq": true,
          "includeBlockTrades": true,
          "conditionalPrice": 123.45,
          "startTime": "20250415-12:34:56",
          "endTime": "20250415-15:00:00"
        }
    }
  ]
}'
```

``` EnlighterJSRAW
order.algoStrategy("PctVolTm");
order.algoParams(new ArrayList());
order.algoParams().add(new TagValue("startPctVol", String.valueOf(startPctVol)));
order.algoParams().add(new TagValue("endPctVol", String.valueOf(endPctVol)));
order.algoParams().add(new TagValue("startTime", startTime));
order.algoParams().add(new TagValue("endTime", endTime));
order.algoParams().add(new TagValue("noTakeLiq", noTakeLiq ? "1" : "0"));
```

``` EnlighterJSRAW
order.algoStrategy = "PctVolTm";
order.algoParams.reset(new TagValueList());
TagValueSPtr tag1(new TagValue("startPctVol", std::to_string(startPctVol)));
TagValueSPtr tag2(new TagValue("endPctVol", std::to_string(endPctVol)));
TagValueSPtr tag3(new TagValue("startTime", startTime));
TagValueSPtr tag4(new TagValue("endTime", endTime));
TagValueSPtr tag5(new TagValue("noTakeLiq", noTakeLiq ? "1" : "0"));
order.algoParams->push_back(tag1);
order.algoParams->push_back(tag2);
order.algoParams->push_back(tag3);
order.algoParams->push_back(tag4);
order.algoParams->push_back(tag5);
```

``` EnlighterJSRAW
order.AlgoStrategy = "PctVolTm";
order.AlgoParams = new List();
order.AlgoParams.Add(new TagValue("startPctVol", startPctVol.ToString()));
order.AlgoParams.Add(new TagValue("endPctVol", endPctVol.ToString()));
order.AlgoParams.Add(new TagValue("startTime", startTime));
order.AlgoParams.Add(new TagValue("endTime", endTime));
order.AlgoParams.Add(new TagValue("noTakeLiq", noTakeLiq ? "1" : "0"));
```

``` EnlighterJSRAW
order.AlgoStrategy = "PctVolTm"
order.AlgoParams = New List(Of TagValue)
order.AlgoParams.Add(New TagValue("startPctVol", startPctVol.ToString()))
order.AlgoParams.Add(New TagValue("endPctVol", endPctVol.ToString()))
order.AlgoParams.Add(New TagValue("startTime", startTime))
order.AlgoParams.Add(New TagValue("endTime", endTime))
order.AlgoParams.Add(New TagValue("noTakeLiq", BooleantoString(noTakeLiq)))
```

### TWAP

The [TWAP](https://www.interactivebrokers.com/en/index.php?f=1125) algo aims to achieve the time-weighted average price calculated from the time you submit the order to the time it completes. Incomplete orders at the end of the stated completion time will continue to fill if the box ‘allow trading past end time’ is checked. Users can set the order to trade only when specified conditions are met. Those user-defined inputs include when the order is marketable, when the midpoint matches the required price, when the same side (buy or sell) matches to make the order marketable or when the last traded price would make the order marketable. For the TWAP algo, the average price calculation is calculated from the order entry time through the close of the market and will only attempt to execute when the criterion is met. The order may not fill throughout its stated duration and so the order is not guaranteed. TWAP is available for all US equities.

**Algo Strategy Value:** Twap

**catchUp:** bool. Catch up in time.  
Valid Value/Format: 1 (true) or 0 (false)

**startTime:** String. Algorithm starting time  
Valid Value/Format: hh:mm:ss TMZ or YYYYMMDD-hh:mm:ss TMZ

**endTime:** String. Algorithm ending time  
Valid Value/Format: hh:mm:ss TMZ or YYYYMMDD-hh:mm:ss TMZ

**allowPastEndTime:** bool. Allow trading past end time  
Valid Value/Format: 1 (true) or 0 (false)

**conditionalPrice:** double. Enter the trade when a price is more aggressive than the listed value.  
Valid Value/Format: 120.0

  - Python
  - cURL
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
order.algoStrategy = "Twap"
order.algoParams = []
order.algoParams.append(TagValue("catchUp", catchUp))
order.algoParams.append(TagValue("startTime", startTime))
order.algoParams.append(TagValue("endTime", endTime))
order.algoParams.append(TagValue("allowPastEndTime", int(allowPastEndTime)))
order.algoParams.append(TagValue("conditionalPrice", conditionalPrice))
```

``` EnlighterJSRAW
curl {baseUrl}/iserver/account/{accountId}/orders \
--request POST \
--header 'Content-Type:application/json' \
--data '{
  "orders": [
    {
      "conid": conid,
      "orderType": "LMT",
      "price": price,
      "side": "side",
      "tif": "tif",
      "quantity": quantity,
      "strategy": "Twap",
        "strategyParameters": {
          "allowPastEndTime": true,
          "conditionalPrice": 123.45,
          "catchUp": true,
          "startTime": "20250415-12:34:56",
          "endTime": "20250415-15:00:00"
        }
    }
  ]
}'
```

``` EnlighterJSRAW
order.algoStrategy("Twap");
order.algoParams(new ArrayList());
order.algoParams().add(new TagValue("catchUp", catchUp));
order.algoParams().add(new TagValue("startTime", startTime));
order.algoParams().add(new TagValue("endTime", endTime));
order.algoParams().add(new TagValue("allowPastEndTime", allowPastEndTime ? "1" : "0"));
order.algoParams().add(new TagValue("conditionalPrice", conditionalPrice);
```

``` EnlighterJSRAW
order.algoStrategy = "Twap";
order.algoParams.reset(new TagValueList());
TagValueSPtr tag1(new TagValue("catchUp", catchUp));
TagValueSPtr tag2(new TagValue("startTime", startTime));
TagValueSPtr tag3(new TagValue("endTime", endTime));
TagValueSPtr tag4(new TagValue("allowPastEndTime", allowPastEndTime ? "1" : "0"));
TagValueSPtr tag5(new TagValue("conditionalPrice", std::to_string(conditionalPrice)));
order.algoParams->push_back(tag1);
order.algoParams->push_back(tag2);
order.algoParams->push_back(tag3);
order.algoParams->push_back(tag4);
order.algoParams->push_back(tag5);
```

``` EnlighterJSRAW
order.AlgoStrategy = "Twap";
order.AlgoParams = new List();
order.AlgoParams.Add(new TagValue("catchUp", catchUp));
order.AlgoParams.Add(new TagValue("startTime", startTime));
order.AlgoParams.Add(new TagValue("endTime", endTime));
order.AlgoParams.Add(new TagValue("allowPastEndTime", allowPastEndTime));
order.AlgoParams.Add(new TagValue("conditionalPrice", conditionalPrice));
```

``` EnlighterJSRAW
order.AlgoStrategy = "Twap"
order.AlgoParams = New List(Of TagValue)
order.AlgoParams.Add(New TagValue("catchUp", catchUp))
order.AlgoParams.Add(New TagValue("startTime", startTime))
order.AlgoParams.Add(New TagValue("endTime", endTime))
order.AlgoParams.Add(New TagValue("allowPastEndTime", BooleantoString(allowPastEndTime)))
order.AlgoParams.Add(new TagValue("conditionalPrice", conditionalPrice))
```

### VWAP

IB’s best-efforts [VWAP](https://www.interactivebrokers.com/en/index.php?f=1124) algo seeks to achieve the Volume-Weighted Average price (VWAP), calculated from the time you submit the order to the close of the market.

Best-efforts VWAP algo is a lower-cost alternative to the Guaranteed VWAP (no longer supported) that enables the user to attempt never to take liquidity while also trading past the end time. Because the order may not be filled on the bid or at the ask prices, there is a trade-off with this algo. The order may not fully fill if the user is attempting to avoid liquidity-taking fees and/or maximize liquidity-adding rebates, and may miss the benchmark by asking to stay on the bid or ask. The user can determine the maximum percentage of average daily volume (up to 50%) his order will comprise. The system will generate the VWAP from the time the order is entered through the close of trading, and the order can be limited to trading over a pre-determined period. The user can request the order to continue beyond its stated end time if unfilled at the end of the stated period. The best-efforts VWAP algo is available for all US equities.

**Algo Strategy Value:** Vwap

**maxPctVol:** double. Maximum percentage of ADV  
Valid Value/Format: 0.1 (10%) – 0.5 (50%)

**startTime:** String. Algorithm starting time  
Valid Value/Format: hh:mm:ss TMZ or YYYYMMDD-hh:mm:ss TMZ

**endTime:** String. Algorithm ending time  
Valid Value/Format: hh:mm:ss TMZ or YYYYMMDD-hh:mm:ss TMZ

**allowPastEndTime:** bool. Allow trading past end time  
Valid Value/Format: 1 (true) or 0 (false)

**noTakeLiq:** bool. Attempt to never take liquidity  
Valid Value/Format: 1 (true) or 0 (false)

**speedUp:** bool. Compensate for the decreased fill rate due to presence of limit price.  
Valid Value/Format: 1 (true) or 0 (false)

  - Python
  - cURL
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
order.algoStrategy = "Vwap"
order.algoParams = []
order.algoParams.append(TagValue("maxPctVol", maxPctVol))
order.algoParams.append(TagValue("startTime", startTime))
order.algoParams.append(TagValue("endTime", endTime))
order.algoParams.append(TagValue("allowPastEndTime", int(allowPastEndTime)))
order.algoParams.append(TagValue("noTakeLiq", int(noTakeLiq)))
```

``` EnlighterJSRAW
curl {baseUrl}/iserver/account/{accountId}/orders \
--request POST \
--header 'Content-Type:application/json' \
--data '{
  "orders": [
    {
      "conid": conid,
      "orderType": "LMT",
      "price": price,
      "side": "side",
      "tif": "tif",
      "quantity": quantity,
      "strategy": "VWAP",
        "strategyParameters": {
          "noTakeLiq": true,
          "optoutClosingAuction": true,
          "allowPastEndTime": true,
          "speedUp": true,
          "conditionalPrice": 123.45,
          "maxPctVol": 0.1,
          "startTime": "20250415-12:34:56",
          "endTime": "20250415-15:00:00"
        }
    }
  ]
}'
```

``` EnlighterJSRAW
order.algoStrategy("Vwap");
order.algoParams(new ArrayList());
order.algoParams().add(new TagValue("maxPctVol", String.valueOf(maxPctVol)));
order.algoParams().add(new TagValue("startTime", startTime));
order.algoParams().add(new TagValue("endTime", endTime));
order.algoParams().add(new TagValue("allowPastEndTime", allowPastEndTime ? "1" : "0"));
order.algoParams().add(new TagValue("noTakeLiq", noTakeLiq ? "1" : "0"));
order.algoParams().add(new TagValue("speedUp", speedUp ? "1" : "0"));
```

``` EnlighterJSRAW
order.algoStrategy = "Vwap";
order.algoParams.reset(new TagValueList());
TagValueSPtr tag1(new TagValue("maxPctVol", std::to_string(maxPctVol)));
TagValueSPtr tag2(new TagValue("startTime", startTime));
TagValueSPtr tag3(new TagValue("endTime", endTime));
TagValueSPtr tag4(new TagValue("allowPastEndTime", allowPastEndTime ? "1" : "0"));
TagValueSPtr tag5(new TagValue("noTakeLiq", noTakeLiq ? "1" : "0"));
TagValueSPtr tag6(new TagValue("speedUp", speedUp ? "1" : "0"));
order.algoParams->push_back(tag1);
order.algoParams->push_back(tag2);
order.algoParams->push_back(tag3);
order.algoParams->push_back(tag4);
order.algoParams->push_back(tag5);
order.algoParams->push_back(tag6);
```

``` EnlighterJSRAW
order.AlgoStrategy = "Vwap";
order.AlgoParams = new List();
order.AlgoParams.Add(new TagValue("maxPctVol", maxPctVol.ToString()));
order.AlgoParams.Add(new TagValue("startTime", startTime));
order.AlgoParams.Add(new TagValue("endTime", endTime));
order.AlgoParams.Add(new TagValue("allowPastEndTime", allowPastEndTime ? "1" : "0"));
order.AlgoParams.Add(new TagValue("noTakeLiq", noTakeLiq ? "1" : "0"));
order.AlgoParams.Add(new TagValue("speedUp", speedUp ? "1" : "0"));
```

``` EnlighterJSRAW
order.AlgoStrategy = "Vwap"
order.AlgoParams = New List(Of TagValue)
order.AlgoParams.Add(New TagValue("maxPctVol", maxPctVol.ToString()))
order.AlgoParams.Add(New TagValue("startTime", startTime))
order.AlgoParams.Add(New TagValue("endTime", endTime))
order.AlgoParams.Add(New TagValue("allowPastEndTime", BooleantoString(allowPastEndTime)))
order.AlgoParams.Add(New TagValue("noTakeLiq", BooleantoString(noTakeLiq)))
order.AlgoParams.Add(New TagValue("speedUp", BooleantoString(speedUp)))
```

### Quantitative Brokers Algorithms

It is recommended to first try to create the QBAlgo in TWS to see the most current available field values.

QBAlgos are only available in live accounts.

Some fields have default values and are optional in TWS but must be explicitly specified in the API.

### Bolt

**Algo Strategy Value:** Bolt

**StartTime:** String. Start Time.  
Valid Value/Format: hh:mm:ss tmz

**EndTime:** String.Must be on the same date as Start Time. Takes precedence over Duration.  
Valid Value/Format: hh:mm:ss tmz

**Duration:** double. Alternative order end time specifier. This value is a number of minutes that the order should be worked.  
Valid Value/Format: 10. A value of -99 will specify that the end time should be the exchange close time.

**Mode:** String. Mode  
Valid Value/Format: Passive, Normal, Aggressive

**PercentVolume:** double. Volume %  
Valid Value/Format: 0 \<= PercentVolume \<= 1

**EventPause:** String. Event Pause  
Valid Value/Format: Attempt\_To\_Complete, Pause\_Trading, Trade\_Through

**NoCleanup:** bool. No Cleanup  
Valid Value/Format: “0” (false) or “1” (true)

**LiquidityAggressThreshold:** double. Liquidity Aggressiveness Threshold  
Valid Value/Format: 0 \<= LiquidityAggressThreshold \<= 1

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
order.algoStrategy = "Bolt"
order.algoParams = []
order.algoParams.append(TagValue("StartTime", StartTime))
order.algoParams.append(TagValue("EndTime", EndTime))
order.algoParams.append(TagValue("Duration", Duration))
order.algoParams.append(TagValue("Mode", Mode))
order.algoParams.append(TagValue("PercentVolume", PercentVolume))
order.algoParams.append(TagValue("EventPause", EventPause))
order.algoParams.append(TagValue("NoCleanup", NoCleanup))
order.algoParams.append(TagValue("LiquidityAggressThreshold", liqAggThreshold))
```

``` EnlighterJSRAW
order.algoStrategy("Bolt");
order.algoParams(new ArrayList());
order.algoParams().add(new TagValue("StartTime", startTime));
order.algoParams().add(new TagValue("EndTime", endTime));
order.algoParams().add(new TagValue("Duration", Duration));
order.algoParams().add(new TagValue("Mode", Mode));
order.algoParams().add(new TagValue("PercentVolume", PercentVolume));
order.algoParams().add(new TagValue("EventPause", EventPause));
order.algoParams().add(new TagValue("NoCleanup", NoCleanup));
order.algoParams().add(new TagValue("LiquidityAggressThreshold", liqAggThreshold));
```

``` EnlighterJSRAW
order.algoStrategy = "Bolt";

order.algoParams.reset(new TagValueList());
TagValueSPtr tag1(new TagValue("StartTime", StartTime));
TagValueSPtr tag2(new TagValue("EndTime", endTime));
TagValueSPtr tag3(new TagValue("Duration", Duration));
TagValueSPtr tag4(new TagValue("Mode", std::to_string(Mode)));
TagValueSPtr tag5(new TagValue("PercentVolume", std::to_string(PercentVolume)));
TagValueSPtr tag6(new TagValue("EventPause", std::to_string(EventPause)));
TagValueSPtr tag7(new TagValue("NoCleanup", std::to_string(NoCleanup)));
TagValueSPtr tag8(new TagValue("LiquidityAggressThreshold", std::to_string(LiquidityAggressThreshold)));

order.algoParams->push_back(tag1);
order.algoParams->push_back(tag2);
order.algoParams->push_back(tag3);
order.algoParams->push_back(tag4);
order.algoParams->push_back(tag5);
order.algoParams->push_back(tag6);
order.algoParams->push_back(tag7);
order.algoParams->push_back(tag8);
```

``` EnlighterJSRAW
order.AlgoStrategy("Bolt");
order.AlgoParams(new ArrayList());
order.AlgoParams.Add(new TagValue("StartTime", startTime));
order.AlgoParams.Add(new TagValue("EndTime", endTime));
order.AlgoParams.Add(new TagValue("Duration", Duration));
order.AlgoParams.Add(new TagValue("Mode", Mode));
order.AlgoParams.Add(new TagValue("PercentVolume", PercentVolume));
order.AlgoParams.Add(new TagValue("EventPause", EventPause));
order.AlgoParams.Add(new TagValue("NoCleanup", NoCleanup));
order.AlgoParams.Add(new TagValue("LiquidityAggressThreshold", liqAggThreshold));
```

``` EnlighterJSRAW
order.AlgoStrategy("Bolt");
order.AlgoParams = New List(Of TagValue)
order.AlgoParams.Add(new TagValue("StartTime", startTime))
order.AlgoParams.Add(new TagValue("EndTime", endTime))
order.AlgoParams.Add(new TagValue("Duration", Duration))
order.AlgoParams.Add(new TagValue("Mode", Mode))
order.AlgoParams.Add(new TagValue("PercentVolume", PercentVolume))
order.AlgoParams.Add(new TagValue("EventPause", EventPause))
order.AlgoParams.Add(new TagValue("NoCleanup", NoCleanup))
order.AlgoParams.Add(new TagValue("LiquidityAggressThreshold", liqAggThreshold))
```

### Closer

**Algo Strategy Value:** Closer

No parameters should be attached. Only the strategy needs to be specified as Closer.

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
order.algoStrategy = "Closer"
```

``` EnlighterJSRAW
order.algoStrategy("Closer");
```

``` EnlighterJSRAW
order.algoStrategy = "Closer";
```

``` EnlighterJSRAW
order.AlgoStrategy = "Closer";
```

``` EnlighterJSRAW
order.AlgoStrategy = "Closer"
```

### Octane

**Algo Strategy Value:** Octane

**StartTime:** String. Start Time.  
Valid Value/Format: hh:mm:ss tmz

**EndTime:** String.Must be on the same date as Start Time. Takes precedence over Duration.  
Valid Value/Format: hh:mm:ss tmz

**Duration:** double. Alternative order end time specifier. This value is a number of minutes that the order should be worked.  
Valid Value/Format: 10. A value of -99 will specify that the end time should be the exchange close time.

**Urgency:** String. Fill urgency  
Valid Value/Format: High, Ultra\_High

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
order.algoStrategy = "Octane"
order.algoParams = []
order.algoParams.append(TagValue("StartTime", StartTime))
order.algoParams.append(TagValue("EndTime", EndTime))
order.algoParams.append(TagValue("Duration", Duration))
order.algoParams.append(TagValue("Urgency", Urgency))
```

``` EnlighterJSRAW
order.algoStrategy("Octane");
order.algoParams(new ArrayList());
order.algoParams().add(new TagValue("StartTime", startTime));
order.algoParams().add(new TagValue("EndTime", endTime));
order.algoParams().add(new TagValue("Duration", Duration));
order.algoParams().add(new TagValue("Urgency", Urgency));
```

``` EnlighterJSRAW
order.algoStrategy = "Octane";

order.algoParams.reset(new TagValueList());
TagValueSPtr tag1(new TagValue("StartTime", StartTime));
TagValueSPtr tag2(new TagValue("EndTime", endTime));
TagValueSPtr tag3(new TagValue("Duration", Duration));
TagValueSPtr tag4(new TagValue("Urgency", std::to_string(Urgency)));

order.algoParams->push_back(tag1);
order.algoParams->push_back(tag2);
order.algoParams->push_back(tag3);
order.algoParams->push_back(tag4);
```

``` EnlighterJSRAW
order.AlgoStrategy("Octane");
order.AlgoParams(new ArrayList());
order.AlgoParams.Add(new TagValue("StartTime", startTime));
order.AlgoParams.Add(new TagValue("EndTime", endTime));
order.AlgoParams.Add(new TagValue("Duration", Duration));
order.AlgoParams.Add(new TagValue("Urgency", Urgency));
```

``` EnlighterJSRAW
order.AlgoStrategy("Octane");
order.AlgoParams = New List(Of TagValue)
order.AlgoParams.Add(new TagValue("StartTime", startTime))
order.AlgoParams.Add(new TagValue("EndTime", endTime))
order.AlgoParams.Add(new TagValue("Duration", Duration))
order.AlgoParams.Add(new TagValue("Urgency", Urgency))
```

### Strobe

**Algo Strategy Value:** Strobe

**StartTime:** String. Start Time.  
Valid Value/Format: hh:mm:ss tmz

**EndTime:** String.Must be on the same date as Start Time. Takes precedence over Duration.  
Valid Value/Format: hh:mm:ss tmz

**Duration:** double. Alternative order end time specifier. This value is a number of minutes that the order should be worked.  
Valid Value/Format: 10. A value of -99 will specify that the end time should be the exchange close time.

**Benchmark:** String. Benchmark  
Valid Value/Format: TWAP, VWAP

**PercentVolume:** double. Volume %  
Valid Value/Format: 0 \<= PercentVolume \<= 1

**NoCleanup:** bool. No Cleanup  
Valid Value/Format: “0” (false) or “1” (true)

  - Python
  - Java
  - C++
  - C\#
  - VB.NET

<!-- end list -->

``` EnlighterJSRAW
order.algoStrategy = "Strobe"
order.algoParams = []
order.algoParams.append(TagValue("StartTime", StartTime))
order.algoParams.append(TagValue("EndTime", EndTime))
order.algoParams.append(TagValue("Duration", Duration))
order.algoParams.append(TagValue("Benchmark", Benchmark))
order.algoParams.append(TagValue("PercentVolume", PercentVolume))
order.algoParams.append(TagValue("NoCleanup", NoCleanup))
```

``` EnlighterJSRAW
order.algoStrategy("Strobe");
order.algoParams(new ArrayList());
order.algoParams().add(new TagValue("StartTime", startTime));
order.algoParams().add(new TagValue("EndTime", endTime));
order.algoParams().add(new TagValue("Duration", Duration));
order.algoParams().add(new TagValue("Benchmark", Benchmark));
order.algoParams().add(new TagValue("PercentVolume", PercentVolume));
order.algoParams().add(new TagValue("NoCleanup", NoCleanup));
```

``` EnlighterJSRAW
order.algoStrategy = "Strobe";

order.algoParams.reset(new TagValueList());
TagValueSPtr tag1(new TagValue("StartTime", StartTime));
TagValueSPtr tag2(new TagValue("EndTime", endTime));
TagValueSPtr tag3(new TagValue("Duration", Duration));
TagValueSPtr tag4(new TagValue("Benchmark", std::to_string(Benchmark)));
TagValueSPtr tag5(new TagValue("PercentVolume", std::to_string(PercentVolume)));
TagValueSPtr tag6(new TagValue("NoCleanup", std::to_string(NoCleanup)));

order.algoParams->push_back(tag1);
order.algoParams->push_back(tag2);
order.algoParams->push_back(tag3);
order.algoParams->push_back(tag4);
order.algoParams->push_back(tag5);
order.algoParams->push_back(tag6);
```

``` EnlighterJSRAW
order.AlgoStrategy("Strobe");
order.AlgoParams(new ArrayList());
order.AlgoParams.Add(new TagValue("StartTime", startTime));
order.AlgoParams.Add(new TagValue("EndTime", endTime));
order.AlgoParams.Add(new TagValue("Duration", Duration));
order.AlgoParams.Add(new TagValue("Benchmark", Benchmark));
order.AlgoParams.Add(new TagValue("PercentVolume", PercentVolume));
order.AlgoParams.Add(new TagValue("NoCleanup", NoCleanup));
```

``` EnlighterJSRAW
order.AlgoStrategy("Strobe");
order.AlgoParams = New List(Of TagValue)
order.AlgoParams.Add(new TagValue("StartTime", startTime))
order.AlgoParams.Add(new TagValue("EndTime", endTime))
order.AlgoParams.Add(new TagValue("Duration", Duration))
order.AlgoParams.Add(new TagValue("Benchmark", Benchmark))
order.AlgoParams.Add(new TagValue("PercentVolume", PercentVolume))
order.AlgoParams.Add(new TagValue("NoCleanup", NoCleanup))
```

### Fox River Algos

[Fox River algos](https://www.ibkrguides.com/traderworkstation/fox-river-top.htm) are exclusively available in Live Accounts.  
The use of Fox River Algos incur [additional commissions](/en/accounts/fees/FOXRIVERALGOstkfee.php) compared to standard orders from Interactive Brokers.

Fox River Algos must always be directed to the FOXRIVER exchange.

Like all algos, the [Basic Order Parameters](/campus/ibkr-api-page/order-types/#limit-order) are still required. The details here would assume a Limit Order is being placed in addition to the Fox River algo strategy.

``` EnlighterJSRAW
contract = Contract()
contract.conId = 265598 # Contract ID for AAPL Stock
contract.exchange = "FOXRIVER"

order = Order()
order.action = "BUY"
order.orderType = "LMT"
order.lmtPrice = 265
order.totalQuantity = 100
order.tif = "DAY"
order.transmit = False # This order will not be submitted. Remove or modify to True to submit the order.
```

### Dark Sweep

**Algo Strategy:** [DarkSweep](https://www.ibkrguides.com/traderworkstation/fox-sweep.htm)

**Effective Time:** string. Optional. Set the time to begin the order.  
Between market open and market close, and prior to Expire Time (if set).  
Defaults to immediately.

**Expire Time:** string. Optional. Time/date for the order to expire.  
Between market open and market close, and after Effective Time (if set).  
Defaults to market close if not set.

**Dollar Certain Limit:** integer. Optional. The maximum acceptable dollar amount of the trade, including Dollar Certain Commission. Used to trade by dollar amount.  
Must be a value greater than 0.

**Dollar Certain Commission:** integer. Optional. The commission cost on a cents-per-share basis, e.g. 0.1 = 1 cent  
Must be a value greater than 0.

**Dollar Certain Execution:** integer. Optional. Check to determine the order quantity by dollar value. Must be checked for other “Dollar Certain” fields to be valid.  
If set to 1, Dollar Certain Limit at least must be defined.

  - Python
  - cURL

<!-- end list -->

``` EnlighterJSRAW
order.algoStrategy = "DarkSweep"
order.algoParams = [
    TagValue("EffectiveTime", "15:00:00 US/Eastern"),
    TagValue("ExpireTime", "15:45:00 US/Eastern"),
    TagValue("DollarCertainLimit", 260),
    TagValue("DollarCertainCommission", 10),
    TagValue("DollarCertainExecution", 1)
]
```

``` EnlighterJSRAW
"strategy": "DarkSweep",
"strategyParameters": {
    "EffectiveTime": "15:00:00 US/Eastern",
    "ExpireTime": "15:45:00 US/Eastern",
    "DollarCertainLimit": 260,
    "DollarCertainCommission": 10,
    "DollarCertainExecution": 1
}
```

### Fox Alpha

**Algo Strategy:** [FoxAlpha](https://www.ibkrguides.com/traderworkstation/fox-dark-alpha.htm)

**Effective Time:** string. Optional. Set the time to begin the order.  
Between market open and market close, and prior to Expire Time (if set).  
Defaults to immediately.

**Expire Time:** string. Optional. Time/date for the order to expire.  
Between market open and market close, and after Effective Time (if set).  
Defaults to market close if not set.

**Participation Rate Limit:** integer. Optional. The participation of volume rate limit, as a percentage.  
Digit that will be used as a percentage  
0 \< rate \<= 1.  
Example: 0.05 equals 5%

**End Time Behavior:** string. Optional. Tells how to treat an order that expires.  
Cancel\_balance – cancels any remaining balance  
Hard\_EndTime – Complete the order with give up

**Participation Rate Target:** integer. Optional. The percentage of traded volume that is the target participation rate.  
0 \> rate \>= 1, e.g. 0.05 is 5%

**Elasticity:** string. Optional. Elasticity describes the pacing of the Fox trading signal. This value tells how much leeway the model has to be off the expected fill rate.  
Low, Medium, High.  
Set the High by default to provide the most flexibility and best performance.

**Aggressiveness:** string.Optional. How aggressive to fill.  
Low, Medium, High

**Dark Attack:** string. Optional. Whether or not to favor dark pools.  
0-Do\_not\_favor\_dark\_pools, 1-Least\_aggressive, 2,3,4,5,6,7,8,9, 10-Most\_aggressive  
Will default to 0.

**I Would Dark:** integer. Optional. Set as 1 to allow the order to complete in a dark venue at any time. Very aggressive if set.  
If set to 0, pacing will not be affected by fills from dark venues.

**Sweep Price:** integer. Optional. Set a price at which you would be willing to sweep all available equity.  
Must be a value greater than 0.

**Dollar Certain Limit:** integer. Optional. The maximum acceptable dollar amount of the trade, including Dollar Certain Commission. Used to trade by dollar amount.  
Must be a value greater than 0.

**Dollar Certain Commission:** integer. Optional. The commission cost on a cents-per-share basis, e.g. 0.1 = 1 cent  
Must be a value greater than 0.

**Dollar Certain Execution:** integer. Optional. Check to determine the order quantity by dollar value. Must be checked for other “Dollar Certain” fields to be valid.  
If set to 1, Dollar Certain Limit at least must be defined.

  - Python
  - cURL

<!-- end list -->

``` EnlighterJSRAW
order.algoStrategy = "FoxAlpha"
order.algoParams = [
    TagValue("EffectiveTime", "15:00:00 US/Eastern"),
    TagValue("ExpireTime", "15:45:00 US/Eastern"),
    TagValue("PartRateLimit", 0.05),
    TagValue("EndTimeBehavior", "Hard_EndTime"),
    TagValue("PartRateTarget", 0.075),
    TagValue("Elasticity", "Medium"),
    TagValue("Aggressiveness", "Medium"),
    TagValue("DarkAttack", "10-Most_aggressive"),
    TagValue("IWouldDark", 0),
    TagValue("SweepPrice", 304),
    TagValue("DollarCertainLimit", 260),
    TagValue("DollarCertainCommission", 10),
    TagValue("DollarCertainExecution", 1)
]
```

``` EnlighterJSRAW
"strategy": "FoxAlpha",
"strategyParameters": {
    "EffectiveTime": "15:00:00 US/Eastern",
    "ExpireTime": "15:45:00 US/Eastern",
    "PartRateLimit": 0.05,
    "EndTimeBehavior": "Hard_EndTime",
    "PartRateTarget": 0.075,
    "Elasticity": "Medium",
    "Aggressiveness": "Medium",
    "DarkAttack": "10-Most_aggressive",
    "IWouldDark": 0,
    "SweepPrice": 304,
    "DollarCertainLimit": 260,
    "DollarCertainCommission": 10,
    "DollarCertainExecution": 1
}
```

### Fox Blaster

**Algo Strategy:** [FoxBlaster](https://www.ibkrguides.com/traderworkstation/fox-blaster.htm)

**Effective Time:** string. Optional. Set the time to begin the order.  
Between market open and market close, and prior to Expire Time (if set).  
Defaults to immediately.

**Expire Time:** string. Optional. Time/date for the order to expire.  
Between market open and market close, and after Effective Time (if set).  
Defaults to market close if not set.

**Aggressiveness:** string.Optional. How aggressive to fill.  
Low, Medium, High

**Dark Attack:** string. Optional. Whether or not to favor dark pools.  
0-Do\_not\_favor\_dark\_pools, 1-Least\_aggressive, 2,3,4,5,6,7,8,9, 10-Most\_aggressive  
Will default to 0.

**I Would Dark:** integer. Optional. Check to allow the order to complete in a dark venue at any time. Very aggressive if set.  
If unchecked, pacing will not be affected by fills from dark venues.

**Dollar Certain Limit:** integer. Optional. The maximum acceptable dollar amount of the trade, including Dollar Certain Commission. Used to trade by dollar amount.  
Must be a value greater than 0.

**Dollar Certain Commission:** integer. Optional. The commission cost on a cents-per-share basis, e.g. 0.1 = 1 cent  
Must be a value greater than 0.

**Dollar Certain Execution:** integer. Optional. Check to determine the order quantity by dollar value. Must be checked for other “Dollar Certain” fields to be valid.  
If set to 1, Dollar Certain Limit at least must be defined.

  - Python
  - cURL

<!-- end list -->

``` EnlighterJSRAW
order.algoStrategy = "FoxBlaster"
order.algoParams = [
    TagValue("EffectiveTime", "15:00:00 US/Eastern"),
    TagValue("ExpireTime", "15:45:00 US/Eastern"),
    TagValue("Aggressiveness", "Medium"),
    TagValue("DollarCertainLimit", 260),
    TagValue("DollarCertainCommission", 10),
    TagValue("DollarCertainExecution", 1)
]
```

``` EnlighterJSRAW
"strategy": "FoxBlaster",
        "strategyParameters": {
            "EffectiveTime": "15:00:00 US/Eastern",
            "ExpireTime": "15:45:00 US/Eastern",
            "Aggressiveness": "Medium",
            "DollarCertainLimit": 260,
            "DollarCertainCommission": 10,
            "DollarCertainExecution": 1
        }
```

### Fox Dark Attack

**Algo Strategy:** [FoxDarkAttack](https://www.ibkrguides.com/traderworkstation/fox-dark-attack.htm)

**Effective Time:** string. Optional. Set the time to begin the order.  
Between market open and market close, and prior to Expire Time (if set).  
Defaults to immediately.

**Expire Time:** string. Optional. Time/date for the order to expire.  
Between market open and market close, and after Effective Time (if set).  
Defaults to market close if not set.

**Dark Minimum Fill Quantity:** integer. Optional. The minimum fill quantity in a dark pool.  
If set, must be greater than or equal to the lot size.

**Dark Attack:** string. Optional. Whether or not to favor dark pools.  
0-Do\_not\_favor\_dark\_pools, 1-Least\_aggressive, 2,3,4,5,6,7,8,9, 10-Most\_aggressive  
Will default to 0.

**Dollar Certain Limit:** integer. Optional. The maximum acceptable dollar amount of the trade, including Dollar Certain Commission. Used to trade by dollar amount.  
Must be a value greater than 0.

**Dollar Certain Commission:** integer. Optional. The commission cost on a cents-per-share basis, e.g. 0.1 = 1 cent  
Must be a value greater than 0.

**Dollar Certain Execution:** integer. Optional. Check to determine the order quantity by dollar value. Must be checked for other “Dollar Certain” fields to be valid.  
If set to 1, Dollar Certain Limit at least must be defined.

  - Python
  - cURL

<!-- end list -->

``` EnlighterJSRAW
order.algoStrategy = "FoxDarkAttack"
order.algoParams = [
    TagValue("EffectiveTime", "15:00:00 US/Eastern"),
    TagValue("ExpireTime", "15:45:00 US/Eastern"),
    TagValue("DarkMinFillQty", 150),
    TagValue("DarkAttack", "10-Most_aggressive"), 
    TagValue("DollarCertainLimit", 260),
    TagValue("DollarCertainCommission", 10),
    TagValue("DollarCertainExecution", 1)
]
```

``` EnlighterJSRAW
"strategy": "FoxDarkAttack",
"strategyParameters": {
    "EffectiveTime": "15:00:00 US/Eastern",
    "ExpireTime": "15:45:00 US/Eastern",
    "DarkMinFillQty": 150,
    "DarkAttack": "10-Most_aggressive",
    "DollarCertainLimit": 260,
    "DollarCertainCommission": 10,
    "DollarCertainExecution": 1
}
```

### Fox River Pyramid

**Algo Strategy:** [FoxPyramid](https://www.ibkrguides.com/traderworkstation/fox-pyramid.htm)

**Effective Time:** string. Optional. Set the time to begin the order.  
Between market open and market close, and prior to Expire Time (if set).  
Defaults to immediately.

**Expire Time:** string. Optional. Time/date for the order to expire.  
Between market open and market close, and after Effective Time (if set).  
Defaults to market close if not set.

**Participation Rate Limit:** integer. Optional. The participation of volume rate limit, as a percentage.  
Digit that will be used as a percentage  
0 \< rate \<= 1.  
Example: 0.05 equals 5%

**End Time Behavior:** string. Optional. Tells how to treat an order that expires.  
Cancel\_balance – cancels any remaining balance  
Hard\_EndTime – Complete the order with give up

**Participation Rate Target:** integer. Optional. The percentage of traded volume that is the target participation rate.  
0 \> rate \>= 1, e.g. 0.05 is 5%

**Aggressiveness:** string.Optional. How aggressive to fill.  
Low, Medium, High

**Dark Minimum Fill Quantity:** integer. Optional. The minimum fill quantity in a dark pool.  
If set, must be greater than or equal to the lot size.

**Dark Attack:** string. Optional. Whether or not to favor dark pools.  
0-Do\_not\_favor\_dark\_pools, 1-Least\_aggressive, 2,3,4,5,6,7,8,9, 10-Most\_aggressive  
Will default to 0.

**I Would Dark:** integer. Optional. Set as 1 to allow the order to complete in a dark venue at any time. Very aggressive if set.  
If set to 0, pacing will not be affected by fills from dark venues.

**Price Level 1:** integer. Optional. Define a price level at which POV Rate 1 would be triggered.  
Must be a value greater than 0.  
If a value is entered POV Rate 1 and I Would Dark 1 (if set) are in effect.

**POV Rate 1:** integer. Required if Price Level 1 is populated. This is the participation rate of volume at which to execute when Price Level 1 is active.  
0 \> rate \>= 1, e.g. 0.05 is 5%  
This POV Rate is used when Price Level 1 (if set) has been triggered.

**I Would Dark 1:** integer. Optional. Check to allow the order to complete in a dark venue at any time. Very aggressive if set.

**Price Level 2:** integer. Optional. Define a price level at which POV Rate 2 would be triggered.  
Must be a value greater than 0.  
If a value is entered POV Rate 2 and I Would Dark 2 (if set) are in effect.

**POV Rate 2:** integer. Required if Price Level 2 is populated. This is the participation rate of volume at which to execute when Price Level 1 is active.  
0 \> rate \>= 1, e.g. 0.05 is 5%  
This POV Rate is used when Price Level 2 (if set) has been triggered.

**I Would Dark 2:** integer. Optional. Check to allow the order to complete in a dark venue at any time. Very aggressive if set.

**Price Level 3:** integer. Optional. Define a price level at which POV Rate 3 and I Would Dark 3 would be triggered.  
Must be a value greater than 0.  
If a value is entered POV Rate 3 and I Would Dark 3 (if set) are in effect.

**POV Rate 3:** integer. Required if Price Level 3 is populated. This is the participation rate of volume at which to execute when Price Level 1 is active.  
0 \> rate \>= 1, e.g. 0.05 is 5%  
This POV Rate is used when Price Level 3 (if set) has been triggered.

**I Would Dark 3:** integer. Optional. Check to allow the order to complete in a dark venue at any time. Very aggressive if set.

**Pyramid Strategy:** integer. Required. Select the strategy to which price levels of the pyramid will be applied.  
Supported Values: [Alpha](https://www.ibkrguides.com/traderworkstation/fox-dark-alpha.htm), [Dark Attack](https://www.ibkrguides.com/traderworkstation/fox-dark-attack.htm), [POV](https://www.ibkrguides.com/traderworkstation/fox-pov.htm), [TWAP](https://www.ibkrguides.com/traderworkstation/fox-fox-twap.htm), [VWAP](https://www.ibkrguides.com/traderworkstation/fox-fox-vwap.htm)

**Dollar Certain Limit:** integer. Optional. The maximum acceptable dollar amount of the trade, including Dollar Certain Commission. Used to trade by dollar amount. \>0

**Dollar Certain Commission:** integer. Optional. The commission cost on a cents-per-share basis, e.g. 0.1 = 1 cent \>0

**Dollar Certain Execution:** integer. Optional. Check to determine the order quantity by dollar value. Must be checked for other “Dollar Certain” fields to be valid.  
If set to 1, Dollar Certain Limit at least must be defined.

  - Python
  - cURL

<!-- end list -->

``` EnlighterJSRAW
order.algoStrategy = "FoxPyramid"
order.algoParams = [
    TagValue("EffectiveTime", "15:00:00 US/Eastern"),
    TagValue("ExpireTime", "15:45:00 US/Eastern"),
    TagValue("PartRateLimit", 0.05),
    TagValue("EndTimeBehavior", "Hard_EndTime"),
    TagValue("PartRateTarget", 0.075),
    TagValue("Aggressiveness", "Medium"),
    TagValue("DarkMinFillQty", 150),
    TagValue("DarkAttack", "10-Most_aggressive"),
    TagValue("IWouldDark", 0),

    TagValue("PriceLevel1", 304),
    TagValue("POVRate1", 0.04),
    TagValue("IWouldDark1", 0),

    TagValue("PriceLevel2", 304),
    TagValue("POVRate2", 0.04),
    TagValue("IWouldDark2", 0),
    
    TagValue("PriceLevel3", 304),
    TagValue("POVRate3", 0.04),
    TagValue("IWouldDark3", 0),

    TagValue("PyramidStrategy", "POV"),
    TagValue("DollarCertainLimit", 260),
    TagValue("DollarCertainCommission", 10),
    TagValue("DollarCertainExecution", 1)
]
```

``` EnlighterJSRAW
"strategy": "FoxPyramid",
"strategyParameters": {
    "PartRateLimit": 0.05,
    "EndTimeBehavior": "Hard_EndTime",
    "PartRateTarget": 0.075,
    "Aggressiveness": "Medium",
    "DarkMinFillQty": 150,
    "DarkAttack": "10-Most_aggressive",
    "IWouldDark": 0,
    "PriceLevel1": 304,
    "POVRate1": 0.04,
    "IWouldDark1": 0,
    "PriceLevel2": 304,
    "POVRate2": 0.04,
    "IWouldDark2": 0,
    "PriceLevel3": 304,
    "POVRate3": 0.04,
    "IWouldDark3": 0,
    "PyramidStrategy": "POV",
    "DollarCertainLimit": 260,
    "DollarCertainCommission": 10,
    "DollarCertainExecution": 1
}
```

### Fox Smart Order Router

**Algo Strategy:** [FoxSmartRouter](https://www.ibkrguides.com/traderworkstation/fox-smart-router.htm)

**Effective Time:** string. Optional. Set the time to begin the order.  
Between market open and market close, and prior to Expire Time (if set).  
Defaults to immediately.

**Expire Time:** string. Optional. Time/date for the order to expire.  
Between market open and market close, and after Effective Time (if set).  
Defaults to market close if not set.

**Sweep Type:** string. Optional. Describes market interaction for smart routing behavior.  
Sweep, Sweep-Post, Flashlight, Flashlight-Post, Flashpoint

**Dollar Certain Limit:** integer. Optional. The maximum acceptable dollar amount of the trade, including Dollar Certain Commission. Used to trade by dollar amount.  
Must be a value greater than 0.

**Dollar Certain Commission:** integer. Optional. The commission cost on a cents-per-share basis, e.g. 0.1 = 1 cent  
Must be a value greater than 0.

**Dollar Certain Execution:** integer. Optional. Check to determine the order quantity by dollar value. Must be checked for other “Dollar Certain” fields to be valid.  
If set to 1, Dollar Certain Limit at least must be defined.

  - Python
  - cURL

<!-- end list -->

``` EnlighterJSRAW
order.algoStrategy = "FoxSmartRouter"
order.algoParams = [
    TagValue("EffectiveTime", "15:00:00 US/Eastern"),
    TagValue("ExpireTime", "15:45:00 US/Eastern"),
    TagValue("SweepType", "Sweep"),
    TagValue("DollarCertainLimit", 260),
    TagValue("DollarCertainCommission", 10),
    TagValue("DollarCertainExecution", 1)
]
```

``` EnlighterJSRAW
"strategy": "FoxSmartRouter",
"strategyParameters": {
    "EffectiveTime": "15:00:00 US/Eastern",
    "ExpireTime": "15:45:00 US/Eastern",
    "SweepType": "Sweep",
    "DollarCertainLimit": 260,
    "DollarCertainCommission": 10,
    "DollarCertainExecution": 1
}
```

### Fox Spotlight

**Algo Strategy:** [FoxSpotlight](https://www.ibkrguides.com/traderworkstation/fox-spotlight.htm)

**Effective Time:** string. Optional. Set the time to begin the order.  
Between market open and market close, and prior to Expire Time (if set).  
Defaults to immediately.

**Expire Time:** string. Optional. Time/date for the order to expire.  
Between market open and market close, and after Effective Time (if set).  
Defaults to market close if not set.

**Dollar Certain Limit:** integer. Optional. The maximum acceptable dollar amount of the trade, including Dollar Certain Commission. Used to trade by dollar amount.  
Must be a value greater than 0.

**Dollar Certain Commission:** integer. Optional. The commission cost on a cents-per-share basis, e.g. 0.1 = 1 cent  
Must be a value greater than 0.

**Dollar Certain Execution:** integer. Optional. Check to determine the order quantity by dollar value. Must be checked for other “Dollar Certain” fields to be valid.  
If set to 1, Dollar Certain Limit at least must be defined.

  - Python
  - cURL

<!-- end list -->

``` EnlighterJSRAW
order.algoStrategy = "FoxSpotlight"
order.algoParams = [
    TagValue("EffectiveTime", "15:00:00 US/Eastern"),
    TagValue("ExpireTime", "15:45:00 US/Eastern"),
    TagValue("DollarCertainLimit", 260),
    TagValue("DollarCertainCommission", 10),
    TagValue("DollarCertainExecution", 1)
]
```

``` EnlighterJSRAW
"strategy": "FoxSpotlight",
"strategyParameters": {
    "EffectiveTime": "15:00:00 US/Eastern",
    "ExpireTime": "15:45:00 US/Eastern",
    "DollarCertainLimit": 260,
    "DollarCertainCommission": 10,
    "DollarCertainExecution": 1
}
```

### Fox TWAP

**Algo Strategy:** [FoxTWAP](https://www.ibkrguides.com/traderworkstation/fox-fox-twap.htm)

**Effective Time:** string. Optional. Set the time to begin the order.  
Between market open and market close, and prior to Expire Time (if set).  
Defaults to immediately.

**Expire Time:** string. Optional. Time/date for the order to expire.  
Between market open and market close, and after Effective Time (if set).  
Defaults to market close if not set.

**Participation Rate Limit:** integer. Optional. The participation of volume rate limit, as a percentage.  
Digit that will be used as a percentage  
0 \< rate \<= 1.  
Example: 0.05 equals 5%

**End Time Behavior:** string. Optional. Tells how to treat an order that expires.  
Cancel\_balance – cancels any remaining balance  
Hard\_EndTime – Complete the order with give up

**Elasticity:** string. Optional. Elasticity describes the pacing of the Fox trading signal. This value tells how much leeway the model has to be off the expected fill rate.  
Low, Medium, High.  
Set the High by default to provide the most flexibility and best performance.

**Dark Attack:** string. Optional. Whether or not to favor dark pools.  
0-Do\_not\_favor\_dark\_pools, 1-Least\_aggressive, 2,3,4,5,6,7,8,9, 10-Most\_aggressive  
Will default to 0.

**I Would Dark:** integer. Optional. Set as 1 to allow the order to complete in a dark venue at any time. Very aggressive if set.  
If set to 0, pacing will not be affected by fills from dark venues.

**Sweep Price:** integer. Optional. Set a price at which you would be willing to sweep all available equity.  
Must be a value greater than 0.

**Dollar Certain Limit:** integer. Optional. The maximum acceptable dollar amount of the trade, including Dollar Certain Commission. Used to trade by dollar amount.  
Must be a value greater than 0.

**Dollar Certain Commission:** integer. Optional. The commission cost on a cents-per-share basis, e.g. 0.1 = 1 cent  
Must be a value greater than 0.

**Dollar Certain Execution:** integer. Optional. Check to determine the order quantity by dollar value. Must be checked for other “Dollar Certain” fields to be valid.  
If set to 1, Dollar Certain Limit at least must be defined.

  - Python
  - cURL

<!-- end list -->

``` EnlighterJSRAW
order.algoStrategy = "FoxTWAP"
order.algoParams = [
    TagValue("EffectiveTime", "15:00:00 US/Eastern"),
    TagValue("ExpireTime", "15:45:00 US/Eastern"),
    TagValue("PartRateLimit", 0.05),
    TagValue("EndTimeBehavior", "Hard_EndTime"), # Hard_EndTime, Cancel_balance, or an empty string.
    TagValue("Elasticity", "Medium"), # Low, Medium, High
    TagValue("DarkAttack", "10-Most_aggressive"), # 0-Do_not_favor_dark_pools, 1-Least_aggressive, 2,3,4,5,6,7,8,9, 10-Most_aggressive
    TagValue("IWouldDark", 0),
    TagValue("SweepPrice", 304),
    TagValue("DollarCertainLimit", 260),
    TagValue("DollarCertainCommission", 10),
    TagValue("DollarCertainExecution", 1)
]
```

``` EnlighterJSRAW
"strategy": "FoxTWAP",
"strategyParameters": {
    "EffectiveTime": "15:00:00 US/Eastern",
    "ExpireTime": "15:45:00 US/Eastern",
    "PartRateLimit": 0.05,
    "EndTimeBehavior": "Hard_EndTime",
    "Elasticity": "Medium",
    "DarkAttack": "10-Most_aggressive",
    "IWouldDark": 0,
    "SweepPrice": 304,
    "DollarCertainLimit": 260,
    "DollarCertainCommission": 10,
    "DollarCertainExecution": 1
}
```

### Fox VWAP

**Algo Strategy:** [FoxVWAP](https://www.ibkrguides.com/traderworkstation/fox-fox-vwap.htm)

**Effective Time:** string. Optional. Set the time to begin the order.  
Between market open and market close, and prior to Expire Time (if set).  
Defaults to immediately.

**Expire Time:** string. Optional. Time/date for the order to expire.  
Between market open and market close, and after Effective Time (if set).  
Defaults to market close if not set.

**Participation Rate Limit:** integer. Optional. The participation of volume rate limit, as a percentage.  
Digit that will be used as a percentage  
0 \< rate \<= 1.  
Example: 0.05 equals 5%

**End Time Behavior:** string. Optional. Tells how to treat an order that expires.  
Cancel\_balance – cancels any remaining balance  
Hard\_EndTime – Complete the order with give up

**Elasticity:** string. Optional. Elasticity describes the pacing of the Fox trading signal. This value tells how much leeway the model has to be off the expected fill rate.  
Low, Medium, High.  
Set the High by default to provide the most flexibility and best performance.

**Dark Attack:** string. Optional. Whether or not to favor dark pools.  
0-Do\_not\_favor\_dark\_pools, 1-Least\_aggressive, 2,3,4,5,6,7,8,9, 10-Most\_aggressive  
Will default to 0.

**I Would Dark:** integer. Optional. Set as 1 to allow the order to complete in a dark venue at any time. Very aggressive if set.  
If set to 0, pacing will not be affected by fills from dark venues.

**Sweep Price:** integer. Optional. Set a price at which you would be willing to sweep all available equity.  
Must be a value greater than 0.

**Dollar Certain Limit:** integer. Optional. The maximum acceptable dollar amount of the trade, including Dollar Certain Commission. Used to trade by dollar amount.  
Must be a value greater than 0.

**Dollar Certain Commission:** integer. Optional. The commission cost on a cents-per-share basis, e.g. 0.1 = 1 cent  
Must be a value greater than 0.

**Dollar Certain Execution:** integer. Optional. Check to determine the order quantity by dollar value. Must be checked for other “Dollar Certain” fields to be valid.  
If set to 1, Dollar Certain Limit at least must be defined.

**Corporate Buy Back:** integer. Optional. Check for 10b-18 corporate repurchase.  
Set to 1 to enable.

  - Python
  - cURL

<!-- end list -->

``` EnlighterJSRAW
order.algoStrategy = "FoxVWAP"
order.algoParams = [
    TagValue("EffectiveTime", "15:00:00 US/Eastern"),
    TagValue("ExpireTime", "15:45:00 US/Eastern"),
    TagValue("PartRateLimit", 0.05),
    TagValue("EndTimeBehavior", "Hard_EndTime"), # Hard_EndTime, Cancel_balance, or an empty string.
    TagValue("Elasticity", "Medium"), # Low, Medium, High
    TagValue("DarkAttack", "10-Most_aggressive"), # 0-Do_not_favor_dark_pools, 1-Least_aggressive, 2,3,4,5,6,7,8,9, 10-Most_aggressive
    TagValue("IWouldDark", 0),
    TagValue("SweepPrice", 304),
    TagValue("DollarCertainLimit", 260),
    TagValue("DollarCertainCommission", 10),
    TagValue("DollarCertainExecution", 1),
    TagValue("CorpBuyBack", 1)
]
```

``` EnlighterJSRAW
"strategy": "FoxVWAP",
"strategyParameters": {
    "EffectiveTime": "15:00:00 US/Eastern",
    "ExpireTime": "15:45:00 US/Eastern",
    "PartRateLimit": 0.05,
    "EndTimeBehavior": "Hard_EndTime",
    "Elasticity": "Medium",
    "DarkAttack": "10-Most_aggressive",
    "IWouldDark": 0,
    "SweepPrice": 304,
    "DollarCertainLimit": 260,
    "DollarCertainCommission": 10,
    "DollarCertainExecution": 1,
    "CorpBuyBack": 1
}
```

### Percent of Volume (POV)

**Algo Strategy:** [POV](https://www.ibkrguides.com/traderworkstation/fox-pov.htm)

**Effective Time:** string. Optional. Set the time to begin the order.  
Between market open and market close, and prior to Expire Time (if set).  
Defaults to immediately.

**Expire Time:** string. Optional. Time/date for the order to expire.  
Between market open and market close, and after Effective Time (if set).  
Defaults to market close if not set.

**End Time Behavior:** string. Optional. Tells how to treat an order that expires.  
Cancel\_balance – cancels any remaining balance  
Hard\_EndTime – Complete the order with give up

**POV Rate:** integer. Required. The percentage of traded volume that is the target participation rate.  
0 \> rate \>= 1, e.g. 0.05 is 5%

**Dark Attack:** string. Optional. Whether or not to favor dark pools.  
0-Do\_not\_favor\_dark\_pools, 1-Least\_aggressive, 2,3,4,5,6,7,8,9, 10-Most\_aggressive  
Will default to 0.

**I Would Dark:** integer. Optional. Set as 1 to allow the order to complete in a dark venue at any time. Very aggressive if set.  
If set to 0, pacing will not be affected by fills from dark venues.

**Sweep Price:** integer. Optional. Set a price at which you would be willing to sweep all available equity.  
Must be a value greater than 0.

**Dollar Certain Limit:** integer. Optional. The maximum acceptable dollar amount of the trade, including Dollar Certain Commission. Used to trade by dollar amount.  
Must be a value greater than 0.

**Dollar Certain Commission:** integer. Optional. The commission cost on a cents-per-share basis, e.g. 0.1 = 1 cent  
Must be a value greater than 0.

**Dollar Certain Execution:** integer. Optional. Check to determine the order quantity by dollar value. Must be checked for other “Dollar Certain” fields to be valid.  
If set to 1, Dollar Certain Limit at least must be defined.

  - Python
  - cURL

<!-- end list -->

``` EnlighterJSRAW
order.algoStrategy = "POV"
order.algoParams = [
    TagValue("EffectiveTime", "15:58:00 US/Eastern"),
    TagValue("ExpireTime", "15:59:00 US/Eastern"),
    TagValue("EndTimeBehavior", "Hard_EndTime"), # Hard_EndTime, Cancel_balance, or an empty string.
    TagValue("POVRate", 0.075),
    TagValue("DarkAttack", "10-Most_aggressive"), # 0-Do_not_favor_dark_pools, 1-Least_aggressive, 2,3,4,5,6,7,8,9, 10-Most_aggressive
    TagValue("IWouldDark", 0),
    TagValue("SweepPrice", 304),
    TagValue("DollarCertainLimit", 260),
    TagValue("DollarCertainCommission", 10),
    TagValue("DollarCertainExecution", 1)
]
```

``` EnlighterJSRAW
"strategy": "POV",
"strategyParameters": {
    "EffectiveTime": "15:58:00 US/Eastern",
    "ExpireTime": "15:59:00 US/Eastern",
    "EndTimeBehavior": "Hard_EndTime",
    "POVRate": 0.075,
    "DarkAttack": "10-Most_aggressive",
    "IWouldDark": 0,
    "SweepPrice": 304,
    "DollarCertainLimit": 260,
    "DollarCertainCommission": 10,
    "DollarCertainExecution": 1
}
```

### TWAP (Fox River)

**Algo Strategy:** [TWAP](https://www.ibkrguides.com/traderworkstation/fox-twap.htm)

**Effective Time:** string. Optional. Set the time to begin the order.  
Between market open and market close, and prior to Expire Time (if set).  
Defaults to immediately.

**Expire Time:** string. Optional. Time/date for the order to expire.  
Between market open and market close, and after Effective Time (if set).  
Defaults to market close if not set.

**Participation Rate Limit:** integer. Optional. The participation of volume rate limit, as a percentage.  
Digit that will be used as a percentage  
0 \< rate \<= 1.  
Example: 0.05 equals 5%

**End Time Behavior:** string. Optional. Tells how to treat an order that expires.  
Cancel\_balance – cancels any remaining balance  
Hard\_EndTime – Complete the order with give up

**Dark Attack:** string. Optional. Whether or not to favor dark pools.  
0-Do\_not\_favor\_dark\_pools, 1-Least\_aggressive, 2,3,4,5,6,7,8,9, 10-Most\_aggressive  
Will default to 0.

**I Would Dark:** integer. Optional. Set as 1 to allow the order to complete in a dark venue at any time. Very aggressive if set.  
If set to 0, pacing will not be affected by fills from dark venues.

**Sweep Price:** integer. Optional. Set a price at which you would be willing to sweep all available equity.  
Must be a value greater than 0.

**Dollar Certain Limit:** integer. Optional. The maximum acceptable dollar amount of the trade, including Dollar Certain Commission. Used to trade by dollar amount.  
Must be a value greater than 0.

**Dollar Certain Commission:** integer. Optional. The commission cost on a cents-per-share basis, e.g. 0.1 = 1 cent  
Must be a value greater than 0.

**Dollar Certain Execution:** integer. Optional. Check to determine the order quantity by dollar value. Must be checked for other “Dollar Certain” fields to be valid.  
If set to 1, Dollar Certain Limit at least must be defined.

  - Python
  - cURL

<!-- end list -->

``` EnlighterJSRAW
order.algoStrategy = "TWAP"
order.algoParams = [
    TagValue("EffectiveTime", "15:00:00 US/Eastern"),
    TagValue("ExpireTime", "15:45:00 US/Eastern"),
    TagValue("PartRateLimit", 0.05),
    TagValue("EndTimeBehavior", "Hard_EndTime"), # Hard_EndTime, Cancel_balance, or an empty string.
    TagValue("DarkAttack", "10-Most_aggressive"), # 0-Do_not_favor_dark_pools, 1-Least_aggressive, 2,3,4,5,6,7,8,9, 10-Most_aggressive
    TagValue("IWouldDark", 0),
    TagValue("SweepPrice", 304),
    TagValue("DollarCertainLimit", 260),
    TagValue("DollarCertainCommission", 10),
    TagValue("DollarCertainExecution", 1)
]
```

``` EnlighterJSRAW
"strategy": "TWAP",
"strategyParameters": {
    "EffectiveTime": "15:00:00 US/Eastern",
    "ExpireTime": "15:45:00 US/Eastern",
    "PartRateLimit": 0.05,
    "EndTimeBehavior": "Hard_EndTime",
    "DarkAttack": "10-Most_aggressive",
    "IWouldDark": 0,
    "SweepPrice": 304,
    "DollarCertainLimit": 260,
    "DollarCertainCommission": 10,
    "DollarCertainExecution": 1
}
```

### VWAP (Fox River)

**Algo Strategy:** [VWAP](https://www.ibkrguides.com/traderworkstation/fox-vwap.htm)

**Effective Time:** string. Optional. Set the time to begin the order.  
Between market open and market close, and prior to Expire Time (if set).  
Defaults to immediately.

**Expire Time:** string. Optional. Time/date for the order to expire.  
Between market open and market close, and after Effective Time (if set).  
Defaults to market close if not set.

**Participation Rate Limit:** integer. Optional. The participation of volume rate limit, as a percentage.  
Digit that will be used as a percentage  
0 \< rate \<= 1.  
Example: 0.05 equals 5%

**End Time Behavior:** string. Optional. Tells how to treat an order that expires.  
Cancel\_balance – cancels any remaining balance  
Hard\_EndTime – Complete the order with give up

**Dark Attack:** string. Optional. Whether or not to favor dark pools.  
0-Do\_not\_favor\_dark\_pools, 1-Least\_aggressive, 2,3,4,5,6,7,8,9, 10-Most\_aggressive  
Will default to 0.

**I Would Dark:** integer. Optional. Set as 1 to allow the order to complete in a dark venue at any time. Very aggressive if set.  
If set to 0, pacing will not be affected by fills from dark venues.

**Sweep Price:** integer. Optional. Set a price at which you would be willing to sweep all available equity.  
Must be a value greater than 0.

**Dollar Certain Limit:** integer. Optional. The maximum acceptable dollar amount of the trade, including Dollar Certain Commission. Used to trade by dollar amount.  
Must be a value greater than 0.

**Dollar Certain Commission:** integer. Optional. The commission cost on a cents-per-share basis, e.g. 0.1 = 1 cent  
Must be a value greater than 0.

**Dollar Certain Execution:** integer. Optional. Check to determine the order quantity by dollar value. Must be checked for other “Dollar Certain” fields to be valid.  
If set to 1, Dollar Certain Limit at least must be defined.

**Corporate Buy Back:** integer. Optional. Check for 10b-18 corporate repurchase.  
Set to 1 to enable.

  - Python
  - cURL

<!-- end list -->

``` EnlighterJSRAW
order.algoStrategy = "VWAP"
order.algoParams = [
    TagValue("EffectiveTime", "15:00:00 US/Eastern"),
    TagValue("ExpireTime", "15:45:00 US/Eastern"),
    TagValue("PartRateLimit", 0.05),
    TagValue("EndTimeBehavior", "Hard_EndTime"), # Hard_EndTime, Cancel_balance, or an empty string.
    TagValue("DarkAttack", "10-Most_aggressive"), # 0-Do_not_favor_dark_pools, 1-Least_aggressive, 2,3,4,5,6,7,8,9, 10-Most_aggressive
    TagValue("IWouldDark", 0),
    TagValue("SweepPrice", 304),
    TagValue("DollarCertainLimit", 260),
    TagValue("DollarCertainCommission", 10),
    TagValue("DollarCertainExecution", 1),
    TagValue("CorpBuyBack", 1)
]
```

``` EnlighterJSRAW
"strategy": "VWAP",
"strategyParameters": {
    "EffectiveTime": "15:00:00 US/Eastern",
    "ExpireTime": "15:45:00 US/Eastern",
    "PartRateLimit": 0.05,
    "EndTimeBehavior": "Hard_EndTime",
    "DarkAttack": "10-Most_aggressive",
    "IWouldDark": 0,
    "SweepPrice": 304,
    "DollarCertainLimit": 260,
    "DollarCertainCommission": 10,
    "DollarCertainExecution": 1,
    "CorpBuyBack": 1
}
```
