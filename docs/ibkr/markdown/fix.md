# FIX

## FIX for Clients

FIX (Financial Information eXchange) is an open, industry-standard protocol for the electronic transmission of orders and related data. The protocol is defined and maintained by an industry association, the [FIX Trading Community](https://www.fixtrading.org).

Use of FIX requires an integration process lead by our FIX Engineering team, who can be reached at <fixengineering@ibkr.com>.

For a basic understanding of the FIX protocol, its history, and its capabilities, please review this link: <https://www.fixtrading.org/what-is-fix/>

### Account Minimums

Interactive Brokers supports routing of orders via the FIX protocol for clients who meet the following criteria:

  - Minimum equity under management: 10,000 USD
  - Minimum commissions per month: 1,500 USD

### Connectivity

Interactive Brokers requires Institutional and Enterprise clients to arrange for dedicated connectivity to IBKR infrastructure in order to route orders using FIX. Examples include connection via VPN, extranet, leased line, and cross-connect. Please contact [FIX Engineering](mailto:fixengineering@ibkr.com) for detail on available methods and service providers.

Non-Institutional/Enterprise clients may use FIX over the Internet by way of our IB Gateway platform. Download links are available to the right.

[IB Gateway Stable](https://www.interactivebrokers.com/en/trading/ibgateway-stable.php) [IB Gateway Latest](https://www.interactivebrokers.com/en/trading/ibgateway-latest.php)

### Onboarding and Integration

Once a client is vetted by the FIX Engineering team, they will require that the FIX Integration Form be completed and returned.

[Download The FIX Integration Form](https://www.interactivebrokers.com/campus/wp-content/uploads/sites/2/2024/07/IBKR-FIX-Integration-Form.pdf)

The FIX onboarding process begins with contacting our FIX Engineering team at <fixengineering@ibkr.com>.

In general, FIX onboarding proceeds as follows:

1.  The FIX Engineering team will review your account to validate you meet the [Account Minimums](https://www.interactivebrokers.com/campus/ibkr-api-page/fix/#fix-minimums)
2.  FIX Engineering creates a test FIX session for you in our QA system.
3.  You begin testing to determine any necessary messaging configuration changes.
4.  When ready, you may schedule a supervised FIX certification test with a member of the FIX Engineering team. The certification test will replicate all order types, instructions, etc., that you plan to send in production. The test will also include unsolicited cancels, simulated trade busts, and recovery testing (simulated line failure).
5.  Upon successful completion of the certification test, FIX Engineering will convert an existing production TWS user in your account into a dedicated FIX session user.
6.  With the new FIX user in place, we test connectivity to the session, heartbeats, and a few small test orders. Once ready, production order flow can continue at the pace you choose.

## FIX for OMS Vendors

If you are a vendor of an OMS platform and would like to support routing of orders to Interactive Brokers, please contact our FIX Engineering team at <fixengineering@ibkr.com>.

## FIX Implementation Manual

Please find a link to IBKR’s FIX Implementation Manual to the right.

While Interactive Brokers does implement the FIX protocol standard, it is important to remember that all FIX tags from 5000-9999 are reserved for custom implementations. As such, it is recommended to review our use of custom tags as outlined in our FIX Implementation Manual.

[IBKR FIX Specification](/campus/wp-content/uploads/sites/2/2023/07/IBKR-FIX-Specification.pdf)
