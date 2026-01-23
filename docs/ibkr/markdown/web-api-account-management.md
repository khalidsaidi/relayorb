# Account Management Web API

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

View our Web API Trading documentation here.

[Web API Trading Documentation](/campus/ibkr-api-page/web-api-trading/#instrument-discovery-0)

## Account Management Introduction

Interactive Brokers (IBKR) Account Management API is available for Registered Advisors and Introducing Brokers that would like to customize IBKR’s Registration System and Client Portal or control client experience.

### Client Registration

  - Create New Account
  - View Account Status
  - View Registration Tasks
  - Complete Registration Tasks

### Account Maintenance

  - Update Account Information
  - Manage Account Settings
  - Manage Trade Capabilities
  - Fee Administration

### Funds and Banking

  - Cash Transfers
  - Configure Recurring Transactions
  - Manage Banking Instructions
  - Position Transfers
  - View Transactions

### Reporting

  - Generate Client Statement(s)
  - Retrieve Tax Form

### Authentication

  - Connect user to IBKR white branded platform.

The Account Management API can be used in parallel or as a replacement to the IBKR Portal which is our out of the box solution available to registered advisors and introducing brokers free of cost.

## Audience

Service is available by request only to advisors/brokers that are registered in a FATF Country. See [Setup Process](https://www.interactivebrokers.com/campus/ibkr-api-page/web-api-account-management/#setup-process) for instructions on how to get started.

## Connectivity

IBKR’s Web API implementation follows standard HTTP verbs for communication. It employs a range of HTTP status codes and JSON-formatted messages to convey operation status and error information. To ensure secure communication, all API requests must use HTTPS. Authorization and Authentication for IBKR’s Web API is managed using OAuth 2.0.

## Authentication

IBKR only supports **private\_key\_jwt** client authentication as described in [RFC 7521](https://www.rfc-editor.org/rfc/rfc7521.html) and [RFC 7523](https://www.rfc-editor.org/rfc/rfc7523.html).

  - Client authenticates against the authorization server by presenting a signed JWT token called a *client\_assertion* which the authorization server validates against the public key(s) provided by the client during registration.

<!-- end list -->

  - This scheme is considered safer than the standard client id/client secret authentication scheme used in early OAuth 2.0 integrations given that it prevents the client from having to pass the client secret in back-end requests.

## Data Transmission

User requests will be sent to IBKR in JSON format using HTTPS.

  - `[POST]` and `[PATCH]` will include JSON request that is encoded in base64.

## System Availability

<table>
<colgroup>
<col style="width: 50%" />
<col style="width: 50%" />
</colgroup>
<thead>
<tr class="header">
<th>Service Type</th>
<th>Downtime</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td><strong>Client Registration and Account Maintenance<br />
</strong>/gw/api/v1/accounts*<br />
/gw/api/v1/statements*<br />
/gw/api/v1/tax-documents*<br />
/gw/api/v1/enumerations*</td>
<td>Daily between 6pm ET-6:01pm ET.<br />
Sundays and Tuesdays between 6pm ET to 6:30pm ET</td>
</tr>
<tr class="even">
<td><strong>Funds and Banking</strong><br />
/gw/api/v1/bank-instructions*<br />
/gw/api/v1/client-instructions*<br />
/gw/api/v1/instruction*<br />
/gw/api/v1/external-asset-transfers*<br />
/gw/api/v1/external-cash-transfers*<br />
/gw/api/v1/internal*</td>
<td>Daily between 11:45pm ET-12:30am ET<br />
Saturdays (any time), Sundays before 3PM ET</td>
</tr>
</tbody>
</table>

System Status: <https://www.interactivebrokers.com/en/software/systemStatus.php>

### Rate Limiting

Interactive Brokers enforces a global request rate limit for the Account Management Web API:

  - **10 requests per second** per endpoint
  - **600 requests per minute** per master account (10 requests × 60 seconds)

##### Authentication Scope

Authentication for the Account Management API operates at the master account level, distinguishing it from the trading API’s user-level authentication structure.

##### Exceeding Rate Limits

If your application exceeds these established rate limits, the API will respond with a **429 HTTP status code** (Too Many Requests).

## Support

IBKR has a designated API team that is available for 24/5 support via email and will be primary point of contact during the integration process.

  - Account Management API: ****am-api@**interactivebrokers**.com****
  - Trading API: **api@**interactivebrokers**.com**

### What We Provide

Figuring out where to begin start is the hardest part. To assist with getting started, we have created guides and API references which include everything you need to program your interface for Client Registration, Account Maintenance, Trading, and Portfolio Management. Your designated integration manager will be available for weekly calls throughout the integration process and up to 3 months after going live.

### Resources

To help better understand the API endpoints, we suggest installing [postman](https://www.postman.com/downloads/) and install our [postman collection](https://www.interactivebrokers.com/campus/ibkr-api-page/web-api-account-management/#postman) and environment.

## Setup Process

*IBKR’s account registration system and client portal are carefully engineered to meet our requirements; any request to outsource application workflow requires additional approval. We have summarized steps involved to use API for registration and funding in sequential order.*

### Preliminary

1.  Send an email to **api-solutions@interactivebrokers.com** with the following:
      - Firm Name
      - Firm Role (ie. Introducing Broker, Financial Advisor OR Third Party Service Provider)
      - API Services which you are interested in using (ie. Registration, Funding, Single Sign On, View Portfolio Data, Trading, Reporting)
      - Describe intended usage (1-2 sentences)
2.  A rep from our API team will provide link to complete an integration questionnaire (electronically).
3.  Upon completing the questionnaire, a representative from our API solutions team will reach out to schedule an introductory call to assess needs and determine services required for a successful integration.

### Build and Test

Access to QA environment will be granted upon agreement of the integration requirements.

1.  To setup the QA (sandbox) environment for Registration and Funding API, provide the following to **am-api@**interactivebrokers**.com**:
      - RSA key
          - Size: 3072 or 4096
          - Format: PEM
          - IP Addresses (CIDR Format)
      - Signed Services [Agreement](https://www.interactivebrokers.com/campus/wp-content/uploads/sites/2/2024/09/Web-API-Account-Management-Services-Agreement-3.pdf)
2.  IBKR will provide QA credential which can be used to access QA.
3.  Build interface and test IBKR’s APIS.
      - [Developers tool kit](https://www.interactivebrokers.com/campus/ibkr-api-page/web-api-account-management/#developer-tool-kit) includes quick start guide
      - Suggested [test cases](https://www.interactivebrokers.com/campus/ibkr-api-page/web-api-account-management/#test-cases)

### Go Live

1.  If all development work is complete and your team is ready to go live with the API integration, complete following:
      - Provide IBKR with RSA Key for production using the [IBKR message center.](https://ibkrguides.com/brokerportal/messagecenter/messagecenter.htm#)
          - RSA key for production cannot be same as key that is used for QA
      - Contact your API integration manager with the following:
          - Web ticket number associated with RSA Key
          - Summary of services which will be offered within platform
              - Example: Hybrid registration, account deposits, single sign on for client portal, add trading permissions
          - Instructions to access application interface in QA
          - Screenshots of registration journey in sequential order (PDF)
          - Signed Services [Agreement](https://www.interactivebrokers.com/campus/wp-content/uploads/sites/2/2024/09/Web-API-Account-Management-Services-Agreement.pdf) (if this was not done during preliminary steps).
2.  IBKR will review and test interface.
3.  IBKR will send email with approval status of interface. If approved, IBKR will provide production credentials (Client ID) to your team using the [IBKR message center.](https://ibkrguides.com/brokerportal/messagecenter/messagecenter.htm#)
4.  Test connectivity with the production credentials. If successful, provide following to your IBKR API integration manager:
      - URL address to the application in the Production Environment.
      - Contacts for Production (operations and maintenance).
5.  Launch to Production

## Client Registration

The [accounts](https://www.interactivebrokers.com/campus/ibkr-api-page/webapi-ref-staging/#tag/Account-Management-Accounts/paths/~1gw~1api~1v1~1accounts/post) endpoint can be used to create a brokerage account with IBKR using the API. For client registration using the API, we offer **two** options:

  - **Full Integration**: Hosting firm provides **all** data and forms required to create IBKR brokerage account via API.

<!-- end list -->

  - **Hybrid**: Submit partial application data to IBKR via API to create the account. User will enter remaining application data via the IBKR White Branded application. The application will be prefilled with data that was passed via the API.
      - Connect user to IBKR White Branded Registration using [Single Sign On](https://www.interactivebrokers.com/campus/ibkr-api-page/webapi-ref-staging/#tag/Authorization-SSO-Sessions). Alternatively, provide user with login URL to access IBKR Portal. Upon accessing IBKR Portal, user will be prompted to complete registration journey.

*<sub>Available registration options at IBKR including IBKR hosted solutions can be found [here](https://www.interactivebrokers.com/campus/ibkr-api-page/web-api-account-management/#registration-options).</sub>*

### Full Integration versus Hybrid

It is important to determine which option your team will use for client registration before starting the the technical integration. If you are just getting started or development team has limited capacity, we suggest using our Hybrid option and transition to Full Integration in later phase (if desired).

*The table below includes the differences between Full Integration and Hybrid for client registration.*

<table>
<colgroup>
<col style="width: 33%" />
<col style="width: 33%" />
<col style="width: 33%" />
</colgroup>
<thead>
<tr class="header">
<th>Type</th>
<th>Full Integration</th>
<th>Hybrid</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td>Hosting Firm</td>
<td>Counterparty</td>
<td>Counterparty &amp; IBKR</td>
</tr>
<tr class="even">
<td>Development Work</td>
<td>Yes</td>
<td>Minimal</td>
</tr>
<tr class="odd">
<td>Eligibility</td>
<td>Available to Registered Advisors and Introducing Brokers with approval from IBKR management</td>
<td>Available to Registered Advisors and Introducing Brokers.</td>
</tr>
<tr class="even">
<td>Customization</td>
<td>Yes- design is managed by hosting firm.</td>
<td>Partial- IBKR platform will reflect your branding (Company name, logo, and color scheme).</td>
</tr>
<tr class="odd">
<td>Cost</td>
<td>Yes, the hosting firm is subject to an upfront and annual fee.<br />
Pricing model takes into account the complexity of the integration and scope of services needed.</td>
<td>Yes, the hosting firm [counterparty] is subject to an upfront and annual fee. Pricing model takes into account the complexity of the integration and scope of services needed.</td>
</tr>
<tr class="even">
<td>Supported Platforms</td>
<td>Determined by hosting firm.</td>
<td>Browser on desktop OR mobile device</td>
</tr>
<tr class="odd">
<td>Supported Customer Types</td>
<td>Individual<br />
Joint<br />
Retirement (U.S. and Canada)<br />
ISA (United Kingdom)<br />
JISA (United Kingdom)<br />
SMSF (Australia)</td>
<td>Individual<br />
Joint<br />
Retirement (U.S. and Canada)<br />
ISA (United Kingdom)<br />
JISA (United Kingdom)<br />
SMSF (Australia)<br />
Organization (Corporation, LLC, Partnership)<br />
Trust</td>
</tr>
<tr class="even">
<td>Minimum Data</td>
<td>All application data including documents (agreements, disclosures, and completed tax form) if applicable. Table <a href="https://www.interactivebrokers.com/campus/ibkr-api-page/web-api-account-management/#data-for-client-registration">here</a> for required data based on Account Type and Customer Type.</td>
<td><strong>Fully-Disclosed and Advisor Clients:</strong> IBKR minimally requires Name, Email, and Country of Residence to create an account.<br />
<strong>Non-Disclosed:</strong> All application data with exception of completed tax form is required.</td>
</tr>
</tbody>
</table>

## Data for Client Registration

The information necessary to establish a client account through our API varies based on several key factors:

1.  **Customer Type **
      - FD= Fully-Disclosed Introducing Broker
      - FA= Registered Investment Advisor
      - OWD= One Way Disclosed Introducing Broker
      - NonQI= Non-Disclosed Introducing Broker ; Non Qualified Intermediary
      - QI with Trading= Non-Disclosed Introducing Broker; Qualified Intermediary where clients have access to trading
      - QI with No Trading= Non-Disclosed Introducing Broker; Qualified Intermediary where clients do not have access to trading via IBKR system (eg. Trades will be placed via FIX).
2.  **Registration Type**
      - Hybrid
      - Full Integration
3.  **Account Type**
      - Retail = Individual, Joint, Retirement, ISA
      - Entity = SMSF, Trust, Organization
4.  **IBKR Entity** *Driven by entity which master account is associated with. While accounts are accepted from citizens or residents of [all countries](https://www.interactivebrokers.com/en/index.php?f=7021&nhf=T) except citizens or residents of those countries that are prohibited by the US Office of Foreign Assets Control, advisors/brokers may be limited from opening accounts for applicants that reside in the following countries:*
      - **United States:** Available to U.S. based IB-LLC brokers and advisors only.
      - **Canada**: Available to IB-CAN brokers and advisors only.
      - **Hong Kong:** Available to IB-HK brokers and advisors only.
      - **Australia**: Available to IB-AU brokers and advisors only.
      - **Japan**: Available to IBLLC brokers and advisors that are FSA Registered only.
      - **United Kingdom**: Available to IB-UK brokers only.
      - **Singapore**: Available to IB-SG brokers and advisors only.
      - **EEA**: Available to IB-IE or IB-CE brokers and advisors only.

|          |                |         |         |               |             |          |        |
| -------- | -------------- | ------- | ------- | ------------- | ----------- | -------- | ------ |
| Austria  | Cyprus         | Finland | Hungary | Lativa        | Malta       | Portugal | Spain  |
| Belgium  | Czech Republic | France  | Iceland | Liechtenstein | Netherlands | Romania  | Sweden |
| Bulgaria | Denmark        | Germany | Ireland | Lithuania     | Norway      | Slovakia |        |
| Croatia  | Estonia        | Greece  | Italy   | Luxembourg    | Poland      | Slovenia |        |

Expand each section to see specific data requirements by **Customer Type.** Refer to [schema](https://www.interactivebrokers.com/campus/ibkr-api-page/web-api-account-management/#application-schema) for structure of the JSON.

### Retail

Required fields for Individual, Joint, Retirement, ISA accounts.

**Object**

FD

FA

OWD

NonQI

QI With Trading

QI No Trading

**[Account Holder(s)](https://www.interactivebrokers.com/campus/ibkr-api-page/web-api-account-management/#associatedindividual-27)**\*

email\*

Y

Y

Y- email address of broker OR client is accepted.

Y- email address of broker OR client is accepted.

Y- email address of broker OR client is accepted.

Y- email address of broker OR client is accepted.

name\*  
<sub>first, last</sub>

Y

Y

Y

Y

Y

Y

dateOfBirth

Y

Y

Y

Y

Y

N

countryOfBirth

Y

Y

Y

Y

Y

N

numDependents

Y

Y

N

N

N

N

maritalStatus

Y

Y

N

N

N

N

identification   
<sub>ID Document, citizenship</sub>

Y

Y

Y

Y

Y

N

mailingAddress  
<sub>country\*, state, city, street1, postalCode</sub>

Y

Y

Y

Y

Y

N

residenceAddress  
<sub>country\*, state, city, street1, postalCode</sub>

Y

Y

Y

Y

Y

Y- country only.

phones  
<sub>number, type- Mobile Required</sub>

Y

Y

N

N

N

N

employmentType

Y

Y

Y

N

N

N

employmentDetails  
<sub>If EMPLOYED or SELFEMPLOYED: employer, occupation, employerBusiness, employerAddress</sub>

Y

Y

Y

N

N

N

taxResidencies\*  
<sub>country and tin</sub>

Y

Y

Y

Y

N

N

Tax Form  
<sub>w8Ben, w9</sub>

Y

Y

Y

Y

N

N

withholdingStatement

N

N

N

N

Y

Y

IBKR Agreements and Disclosures

Y

Y

N

N

N

N

Proof of Address and Proof of ID Documents

Y (If Trulioo Verification is NoMatch)

Y (If Trulioo Verification is NoMatch)

Y (If Trulioo Verification is NoMatch)

Y (If Trulioo Verification is NoMatch)

Y (If Trulioo Verification is NoMatch)

N

**[Account Information](https://www.interactivebrokers.com/campus/ibkr-api-page/web-api-account-management/#customer-28)**

financialInformation   
<sub>netWorth, liquidNetWorth, annualNetIncome</sub>

Y

Y

Y

N

N

N

sourcesOfWealth

Y

Y

Y

N

N

N

investmentExperience <sub>yearsTrading, tradesPerYear, knowledgeLevel</sub>

Y

Y

N

N

N

N

regulatoryInformation <sub>account holder or immediate family member controller, employee of a publicly traded company or a registered rep</sub>

Y

Y

Y

N

N

N

accounts\*  
<sub>baseCurrency, margin</sub>

Y

Y

Y

Y

Y

Y

tradingPermissions\*

Y

Y

Y

Y

Y

Y

investmentObjectives

Y

Y

N

N

N

N

advisorWrapFees\*

N

Y

N

N

N

N

**[IRA Beneficiaries](https://www.interactivebrokers.com/campus/ibkr-api-page/web-api-account-management/#accounts-28)**

name  
<sub>first, last</sub>

Y

Y

–

–

–

–

dateOfBirth

Y

Y

–

–

–

–

relationship

Y

Y

–

–

–

–

ownership

Y

Y

–

–

–

–

identification   
<sub>citizenship</sub>

Y

Y

–

–

–

–

mailingAddress  
<sub>country, state, city, street1, postalCode</sub>

N

N

–

–

–

–

residenceAddress  
<sub>country\*, state, city, street1, postalCode</sub>

Y

Y

–

–

–

–

### JISA

Required fields for Junior ISA Accounts

**Object**

FD

FA

**Junior Contact Information**

Y

Y

name\*  
<sub>first, last</sub>

Y

Y

residenceAddress  
<sub>country\*, state, city, street1, postalCode</sub>

Y

Y

mailingAddress  
<sub>country\*, state, city, street1, postalCode</sub>

Y

Y

dateOfBirth

Y

Y

countryOfBirth

Y

Y

identification   
<sub>ID Document, citizenship</sub>

Y

Y

taxResidencies\*  
<sub>country and tin</sub>

Y

Y

sourcesOfWealth

Y

Y

Tax Form  
<sub>w8Ben</sub>

**Registered Contact**

email\*

Y

Y

name\*  
<sub>first, last</sub>

Y

Y

dateOfBirth

Y

Y

countryOfBirth

Y

Y

mailingAddress  
<sub>country\*, state, city, street1, postalCode</sub>

Y

Y

residenceAddress  
<sub>country\*, state, city, street1, postalCode</sub>

Y

Y

identification   
<sub>ID Document, citizenship</sub>

phones  
<sub>number, type- Mobile Required</sub>

Y

Y

employmentType

Y

Y

employmentDetails  
<sub>If EMPLOYED or SELFEMPLOYED: employer, occupation, employerBusiness, employerAddress</sub>

Y

Y

IBKR Agreements and Disclosures

Y

Y

Proof of Address and Proof of ID Documents

Y (If Trulioo Verification is NoMatch)

Y (If Trulioo Verification is NoMatch)

**[Account Information](https://www.interactivebrokers.com/campus/ibkr-api-page/web-api-account-management/#customer-28)**

financialInformation   
<sub>netWorth, liquidNetWorth, annualNetIncome</sub>

Y

Y

investmentExperience <sub>yearsTrading, tradesPerYear, knowledgeLevel</sub>

Y

Y

regulatoryInformation <sub>account holder or immediate family member controller, employee of a publicly traded company or a registered rep</sub>

Y

Y

accounts\*  
<sub>baseCurrency, margin</sub>

Y

Y

tradingPermissions\*

Y

Y

investmentObjectives

Y

Y

advisorWrapFees\*

Y

Y

title  
<sub>code</sub>

Y

Y

### Trust

Required fields for Trust Accounts

Object

FD

FA

OWD

NonQI

**QI with Trading**

**QI No Trading**

**Trustee(s)**

**trustees** <sub>authorizedToSignOnBehalfOfOwner, authorizedTrader, primaryTrustee</sub>

Y

Y

Y

Y

N

N

email\*

Y

Y

Y- email address of broker OR client is accepted.

Y- email address of broker OR client is accepted.

Y- email address of broker OR client is accepted.

Y- email address of broker OR client is accepted.

name\*  
<sub>first, last</sub>

Y

Y

Y

Y

Y

Y

dateOfBirth

Y

Y

Y

Y

Y

N

countryOfBirth

Y

Y

Y

Y

Y

N

identification   
<sub>ID Document, citizenship</sub>

Y

Y

Y

Y

Y

N

mailingAddress  
<sub>country\*, state, city, street1, postalCode</sub>

Y

Y

Y

Y

Y

N

residenceAddress  
<sub>country\*, state, city, street1, postalCode</sub>

Y

Y

Y

Y

Y

Y- country only.

phones  
<sub>number, type- Mobile Required</sub>

Y

Y

N

N

N

N

employmentType

Y

Y

Y

N

N

N

employmentDetails  
<sub>(If EMPLOYED or SELFEMPLOYED) employer, occupation, employerBusiness, employerAddress</sub>

Y

Y

Y

N

N

N

taxResidencies\*  
<sub>country and tin</sub>

Y

Y

Y

Y

N

N

Proof of Address and Proof of ID Documents

Y (If Trulioo Verification is NoMatch)

Y (If Trulioo Verification is NoMatch)

Y (If Trulioo Verification is NoMatch)

Y (If Trulioo Verification is NoMatch)

Y (If Trulioo Verification is NoMatch)

N

**Trust Information**

identification  
<sub>dateFormed, formationCountry, formationState, name, registrationCountry, registrationNumber, registrationType, typeOfTrust</sub>

Y

Y

Y

Y

N

N

address  
<sub>country\*, state, city, street1, postalCode</sub>

Y

Y

Y

Y

N

N

financialInformation   
<sub>netWorth, liquidNetWorth, annualNetIncome</sub>

Y

Y

Y

N

N

N

sourcesOfWealth

Y

Y

Y

N

N

N

investmentExperience <sub>yearsTrading, tradesPerYear, knowledgeLevel</sub>

Y

Y

N

N

N

N

regulatoryInformation

N/A- User will answer questions when completing online steps.

N/A- User will answer questions when completing online steps.

Y

N

N

N

accounts  
<sub>baseCurrency, margin</sub>

Y

Y

Y

Y

Y

Y

tradingPermissions

Y

Y

Y

Y

Y

Y

investmentObjectives

Y

Y

N

N

N

N

advisorWrapFees

N

Y

N

N

N

N

**Grantors**

name  
<sub>first, last</sub>

Y

N

–

–

–

–

dateOfBirth

Y

N

–

–

–

–

relationship

Y

Y

–

–

–

–

identification   
<sub>citizenship</sub>

Y

Y

–

–

–

–

mailingAddress  
<sub>country, state, city, street1, postalCode</sub>

N

N

–

–

–

–

residenceAddress  
<sub>country\*, state, city, street1, postalCode</sub>

N

N

–

–

–

–

**Beneficiaries**

name  
<sub>first, last</sub>

Y

Y

–

–

–

–

ownershipPercentage

Y

Y

–

–

–

–

### Organization

Required fields for Org Accounts

Object

FD

FA

OWD

NonQI

**QI with Trading**

**QI No Trading**

**Associated Entities**

**associatedIndividual** <sub>authorizedToSignOnBehalfOfOwner, authorizedTrader</sub>

Y

Y

Y

Y

N

N

email\*

Y

Y

Y- email address of broker OR client is accepted.

Y- email address of broker OR client is accepted.

Y- email address of broker OR client is accepted.

Y- email address of broker OR client is accepted.

name\*  
<sub>first, last</sub>

Y

Y

Y

Y

Y

Y

dateOfBirth

Y

Y

Y

Y

Y

N

countryOfBirth

Y

Y

Y

Y

Y

N

identification   
<sub>ID Document, citizenship</sub>

Y

Y

Y

Y

Y

N

mailingAddress  
<sub>country\*, state, city, street1, postalCode</sub>

Y

Y

Y

Y

Y

N

residenceAddress  
<sub>country\*, state, city, street1, postalCode</sub>

Y

Y

Y

Y

Y

Y- country only.

phones  
<sub>number, type- Mobile Required</sub>

Y

Y

N

N

N

N

employmentType

Y

Y

Y

N

N

N

employmentDetails  
<sub>(If EMPLOYED or SELFEMPLOYED) employer, occupation, employerBusiness, employerAddress</sub>

Y

Y

Y

N

N

N

taxResidencies\*  
<sub>country and tin</sub>

Y

Y

Y

Y

N

N

Proof of Address and Proof of ID Documents

Y (If Trulioo Verification is NoMatch)

Y (If Trulioo Verification is NoMatch)

Y (If Trulioo Verification is NoMatch)

Y (If Trulioo Verification is NoMatch)

Y (If Trulioo Verification is NoMatch)

N

**Organization Information**

organization  
<sub>tradeIntentionType, type, typeOfTrading</sub>, <sub>usTaxPurposeType</sub>

Y

Y

Y

Y

Y

Y

taxResidencies\*  
<sub>country and tin</sub>

Y

Y

Y

Y

N

N

identification  
<sub>businessDescription, formationCountry, identification, identificationCountry, name</sub>

Y

Y

Y

Y

N

N

placeOfBusiness  
<sub>country\*, state, city, street1, postalCode</sub>

Y

Y

Y

Y

N

N

financialInformation   
<sub>netWorth, liquidNetWorth, annualNetIncome</sub>

Y

Y

Y

N

N

N

sourcesOfWealth

Y

Y

Y

N

N

N

investmentExperience <sub>yearsTrading, tradesPerYear, knowledgeLevel</sub>

Y

Y

N

N

N

N

regulatoryInformation

N/A- User will answer questions when completing online steps.

N/A- User will answer questions when completing online steps.

Y

N

N

N

accounts  
<sub>baseCurrency, margin</sub>

Y

Y

Y

Y

Y

Y

tradingPermissions

Y

Y

Y

Y

Y

Y

investmentObjectives

Y

Y

N

N

N

N

advisorWrapFees

N

Y

N

N

N

N

<sub>\*Required for Hybrid; otherwise optional if coordinated with the API Solutions team. If provided for Hybrid, data will be prefilled.</sub>

## KYC Documents

### Identity and Address Verification

Real-time Trulioo verification is processed upon account creation for selected countries. If Trulioo verification is not successful, OR Trulioo verification is not supported or the country which the applicant resides in, Identity and Address verification is required for approval.

#### Trulioo is supported for applicants that reside in following countries

|           |         |             |                    |                |
| --------- | ------- | ----------- | ------------------ | -------------- |
| Argentina | China   | Malaysia    | Russian Federation | Turkey         |
| Australia | Denmark | Mexico      | Singapore          | United Kingdom |
| Austria   | France  | Netherlands | South Africa       | United States  |
| Belgium   | Germany | New Zealand | Spain              |                |
| Brazil    | Ireland | Norway      | Sweden             |                |
| Canada    | Italy   | Portugal    | Switzerland        |                |

#### Other countries

  - Identity and Address verification will always be required for approval.

### Options for Identity and Address Verification

#### Option 1: Traditional Verification

Collect Proof of ID and Proof of Address documents from the client and submit documents to IBKR `documentSubmission`.

**Registration Tasks**

  - 8001: Proof of Identity (POI)
  - 8002: Proof of Address (POA)

<sub>Important to note: For IB-HK Non-Disclosed (QI and NonQI) clients, we only require Proof of Identity (8001).</sub>

**Processing Time**

IBKR has a ‘follow the sun’ model with operators located globally and constantly reviewing and processing supporting documents for new applications. Documents typically processed within 24 hours. Meaning, accounts are approved/opened within 24 hours of the supporting documents being accepted by IBKR.  
Causes for delays could be unsupported doc type is submitted or image received is blurry/too dark

#### Option 2: Instant Verification

Opt to allow clients to verify using Au10tix (third-party application used to verify client’s identity /geo location).

  - If Trulioo is NoMatch, IBKR will pass unique URL which can be used to connect user to Au10Tix to complete verification. The URL is valid for 24 hours. If more than 24 hours, a new URL will need to be generated using `/api/v1/accounts/{{accountId}}/kyc` endpoint.

**Workflow**:

  - Embed Au10Tix URL or provide a QR code with Au10Tix URL within application.
  - User accesses Au10Tix URL and will be prompted to complete consent message verifying they are OK for Au10Tix to capture Biometric information.
      - If user consents, they will be prompted to take photos of the front and back of their ID’s and take a selfie.
      - Au10Tix will process information and complete ID verification.
      - If Au10Tix verification fails; user will be required to complete ‘Traditional Verification) and Provide a Proof of Address and Proof of Identity Document.
  - If user declines consent, they will be prompted to complete Traditional Verification

**Processing Time**

Real-Time verification is completed- if Au10Tix verification passes; account will be approved/opened (Real-Time).

**Registration Tasks**

  - 8137: Au10Tix Identity and Address Verification
  - 8437: Au10Tix Identity

<sub>**Important:** While partners may implement Traditional Verification as their primary verification method, in certain risk-based scenarios determined by IBKR compliance, Au10Tix verification may be required even if Traditional Verification was initially assigned or completed. This requirement is non-negotiable and is triggered by IBKR’s internal risk assessment protocols. Failure to implement support for both verification methods may result in users being unable to complete the account opening process in certain scenarios. All partners are expected to support both verification paths either through direct API implementation or SSO fallback capability.</sub>

## Agreements and Disclosures

Fully-Disclosed and Advisor clients are required to sign IBKR customer agreements and disclosures.

  - **Full Integration**: Hosting firm will display IBKR agreements and disclosures within interface and collect electronic signature.
  - **Hybrid**: End use signs IBKR agreements via the IBKR White Branded Platform

This section covers handling agreements and disclosures for clients using Full Integration.

### Download IBKR Agreements and Disclosures

  - Option 1: Download from public FTP: [ftp://ftp2.interactivebrokers.com/outgoing/Forms/](ftp://ftp.interactivebrokers.com/outgoing/Forms/%20)
  - Option 2: Pull using the`  /gw/api/v1/forms ` endpoint.

###### Request Parameters

<table>
<colgroup>
<col style="width: 33%" />
<col style="width: 33%" />
<col style="width: 33%" />
</colgroup>
<thead>
<tr class="header">
<th>Name</th>
<th>Type</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td>getDocs <sub><mark class="has-inline-color has-vivid-red-color" style="background-color:rgba(0, 0, 0, 0)">required</mark></sub></td>
<td>T<br />
F</td>
<td>T= True (Documents will be pulled)<br />
F= False (Documents will not be pulled) </td>
</tr>
<tr class="even">
<td>fromDate <sub><mark class="has-inline-color has-vivid-red-color" style="background-color:rgba(0, 0, 0, 0)">required</mark></sub></td>
<td>YYYY-MM-DD</td>
<td>View forms that are updated as of fromDate</td>
</tr>
<tr class="odd">
<td>toDate <sub><mark class="has-inline-color has-vivid-red-color" style="background-color:rgba(0, 0, 0, 0)">required</mark></sub></td>
<td>YYYY-MM-DD</td>
<td>View forms that are updated between fromDate and toDate</td>
</tr>
<tr class="even">
<td>formNo</td>
<td>String</td>
<td>Form Number. If provided; only single formNo is supported per request. If excluded, endpoint will return all forms that meet the given criteria.</td>
</tr>
<tr class="odd">
<td>projection</td>
<td>DOCS<br />
NONE<br />
PAYLOAD</td>
<td>Determine output</td>
</tr>
</tbody>
</table>

### Submit Agreements and Disclosures

The `/gw/api/v1/accounts/documents` endpoint provides mechanism to submit Agreements and Disclosures to IBKR once a day instead of with each application. We store these documents on the servers and will use them for new application requests submitted that day.

  - Documents will need to be submitted once a day (before the Applications are submitted). PDFs will be displayed and submitted as is- no changes/edits will be made to the actual PDF files.
  - This end-point will not process any Tax Form Documents. Tax Form document should be submitted with every application
  - If submitted in the morning, you only need to include the Tax Form attachment for each applicant. Otherwise, you will need to include PDFs with each application (Create Account).

###### Schema

<table>
<colgroup>
<col style="width: 33%" />
<col style="width: 33%" />
<col style="width: 33%" />
</colgroup>
<thead>
<tr class="header">
<th>Name</th>
<th>Type</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td>fileName</td>
<td>String</td>
<td>File name of the PDF document submitted to IBKR. <code>fileName </code>included within the <code>documents </code>request must match the <code>fileName</code> of the PDF file that is included within the signed request.<br />
Acceptable formats: .jpeg, .jpg, .pdf, .png<br />
Max size: 10 MB</td>
</tr>
<tr class="even">
<td>fileLength</td>
<td>String</td>
<td>Length of the PDF form.</td>
</tr>
<tr class="odd">
<td>sha1Checksum</td>
<td>String</td>
<td>SHA-1 is crypto algorithm that is used to verify that a file has been unaltered. This is done by producing a checksum before the file has been transmitted, and then again once it reaches its destination.</td>
</tr>
<tr class="even">
<td>formNumber</td>
<td>String</td>
<td>Use <code>/gw/api/v1/accounts/{accountId}/tasks </code>to view a list of forms that are required for approval.</td>
</tr>
<tr class="odd">
<td>execTimestamp</td>
<td>YYYYMMDDHHMMSS</td>
<td>Timestamp when agreement was submitted to IBKR.</td>
</tr>
<tr class="even">
<td>execLoginTimestamp</td>
<td>YYYYMMDDHHMMSS</td>
<td>Timestamp when agreement was submitted to IBKR.</td>
</tr>
<tr class="odd">
<td>mimeType</td>
<td>application/pdf<br />
application/pdf<br />
image/png<br />
image/jpeg (Includes .jpeg, .jpg)</td>
<td>Format of the file.</td>
</tr>
<tr class="even">
<td>data</td>
<td>String</td>
<td>Includes document encoded in base64.</td>
</tr>
</tbody>
</table>

###### Example

``` wp-block-code
{
        "processDocuments":
            {
                "documents": [
                    {
                        "attachedFile": {
                            "fileName": "Form3024.pdf",
                            "fileLength": 432177,
                            "sha1Checksum": "03D899BA757F617C907A1F021D7046AC1DAC8707"
                        },
                        "payload": {
                            "mimeType": "application/pdf",
                            "data": pm.collectionVariables.get('form3024')
                        },
                        "formNumber": 3024,
                        "execLoginTimestamp": 20210929123113,
                        "execTimestamp": 20210929123113
                    }
                ],
                "inputLanguage": "en",
                "translation": false
            }
    }
```

### Processing of IBKR Agreements and Disclosures

  - Hosting firm will display IBKR agreements and disclosures within interface and collect electronic signature.
      - Collect a signature for each form OR display all forms on a single page with a single signature box at the bottom and pass that signature within the ` documents  `section for each form.
      - Example of IBKR’s Application as a reference![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMSIgaGVpZ2h0PSIxIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjwvc3ZnPg==)
  - The signature, which is collected will be included in the ` signedBy  `section of the `documents`.
  - Hosting firm will provide copy of the IBKR agreements which were presented to user in the application payload that is submitted to IBKR for client registration.
      - No changes should be made to the PDF (We validate the forms using sha1checksum if alterations have been made, error will be triggered and the form will not be accepted.
  - If a form is updated, hosting firm has a 7-calendar day grace period to update the form.

## Account Statuses

The **status** of an account can be one of the following:

| Status | Description                                                                                                                                                                                                             |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A      | Abandoned; deleted application. Only pending or new applications can be abandoned.  An account can be abandoned due to inactivity (after 135 days) OR if Broker OR client initiates request to abandon the application. |
| N      | Pending application and no funding details have been provided.                                                                                                                                                          |
| O      | Open; Account has been approved and opened by IBKR. This is considered an active account.                                                                                                                               |
| C      | Closed; Account that was once active OR opened accounts that were and then closed.                                                                                                                                      |
| P      | Pending application and funding instructions have been provided.                                                                                                                                                        |
| R      | Rejected; account was never approved/opened- rejected by Compliance)                                                                                                                                                    |
| E      | Reopen request is pending.                                                                                                                                                                                              |
| Q      | Bulk migration account that is not yet approved by IBKR.                                                                                                                                                                |

The `status` can change from:

|        |        |        |        |        |        |
| ------ | ------ | ------ | ------ | ------ | ------ |
| N \> P | N \> R | P \> R | A \> P | O \> C | E \> O |
| N \> O | N \> A | P \> A | A \> O | C \> O | Q \> R |
| N \> P | P \> O | A \> N | A \> R | C \> E | Q \> O |

### Close Account

The [accountClose](https://www.interactivebrokers.com/campus/ibkr-api-page/webapi-ref/#tag/Account-Management-Accounts/paths/~1gw~1api~1v1~1accounts/patch) can be used to **close** an opened account based on the `accountId`. Within the body of the request, include reason for account closure (closeReason).

  - Accounts eligible to be closed must have current status of O or Q and must have a cleared balance. If an account is funded at the time which the closure request is submitted, the request will be rejected.
  - If status Q account is closed, status will move to R (rejected)

Requests are processed between 8am EST to 11am EST. Requests received outside of these hours will be processed the following day.

###### Example

``` wp-block-code
POST /gw/api/v1/accounts/close

{
  "accountManagementRequests": {
   "accountClose": {
      "accountId": "U1233457",
      "closeReason": "time to go"
    }
  }
 
```

### Reopen Account

The [reopenAccount](https://www.interactivebrokers.com/campus/ibkr-api-page/webapi-ref/#tag/Account-Management-Accounts/paths/~1gw~1api~1v1~1accounts/patch) can be used to **reopen** an opened account based on the `accountId`.

  - The following accounts are eligible for reopening:
      - Fully-Disclosed and Advisor subs that originate using Hybrid
      - Current status of C (Closed)

Once the reopen request has been submitted, the end user must log into the IBKR Portal to review application information and sign updated agreements and disclosures. The request will not be processed until this step is completed.

###### Example

``` wp-block-code
PATCH /gw/api/v1/accounts

{
  "accountManagementRequests": {
   "reopenAccount": {      
   "accountId": "U1233457"
    }
  }
 
```

### Cancel Application

The [abandonAccount](https://www.interactivebrokers.com/campus/ibkr-api-page/webapi-ref/#tag/Account-Management-Accounts/paths/~1gw~1api~1v1~1accounts/patch) can be used to delete/cancel a pending application based on the `accountId`. Once the request is processed, the account will no longer appear in IBKR’s CRM as a PENDING account.

  - Accounts eligible to be abandoned must have current status of P or N.

###### Example

``` wp-block-code
PATCH /gw/api/v1/accounts

{
    "accountManagementRequests": {
        "abandonAccount": {
            "accountId": "U12345"
        }
    }
}
```

### Reset Application

The [resetAbandonedAccount](https://www.interactivebrokers.com/campus/ibkr-api-page/webapi-ref/#tag/Account-Management-Accounts/paths/~1gw~1api~1v1~1accounts/patch) can be used to reset application that was previously marked abandoned based on the `accountId`. Accounts eligible to be reset must have current status of A and be less than 6 months old. Once the account has been reset, user can proceed with registration process.

###### Example

``` wp-block-code
PATCH /gw/api/v1/accounts

{
    "accountManagementRequests": {
        "resetAbandonedAccount": {
            "accountId": "U12345"
        }
    }
}
```

## View Status by Account

The `/gw/api/v1/accounts/{accountId}/status` can be used to query the status by account. In addition to the status of the account, the response will include the following information:

<table>
<colgroup>
<col style="width: 50%" />
<col style="width: 50%" />
</colgroup>
<thead>
<tr class="header">
<th>Attribute</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td>dateOpened</td>
<td>Date and time which the account was approved and opened at IBKR. If value is null- this means the account has not been opened yet.</td>
</tr>
<tr class="even">
<td>dateStarted</td>
<td>Date and time which the account was created with IBKR.</td>
</tr>
<tr class="odd">
<td>dateClosed</td>
<td>Date and time which the account was closed with IBKR.</td>
</tr>
<tr class="even">
<td>accountId</td>
<td>IBKR account ID.</td>
</tr>
<tr class="odd">
<td>status</td>
<td>Status of the IBKR account.</td>
</tr>
<tr class="even">
<td>description</td>
<td>Description of the status.<br />
A= Abandoned<br />
N= New Account<br />
O= Open<br />
C= Closed<br />
P= Pending<br />
R= Rejected</td>
</tr>
<tr class="odd">
<td>masterAccountId</td>
<td>IBKR account ID which is associated with the advisor/broker which accountId is linked to.</td>
</tr>
<tr class="even">
<td>state</td>
<td>State of the application; only present if status is N (New Account) OR P (Pending).<br />
<strong>Incomplete Application</strong> = Client Action Needed, use <code>/gw/api/v1/accounts/{accountId}/tasks?type=pending</code> to view pending registration tasks<br />
<strong>Documents Required</strong> = Client Action Needed, use<code>/gw/api/v1/accounts/{accountId}/tasks?type=pending </code> to view documents required for approval.<br />
<strong>Under Review with IBKR</strong> = Application is PENDING on IBKR, no action needed.<br />
<strong>Pending Approval</strong> = Account is in the approval queue and should be opened by the following business day.<br />
<strong>Open =</strong> Account is opened and there are no pending tasks assigned to the account.</td>
</tr>
</tbody>
</table>

## View Status for Group of Accounts

The `/gw/api/v1/accounts/status` can be used to filter custom group of accounts associated with `masterAccountId` based on the following criteria:

<table>
<colgroup>
<col style="width: 33%" />
<col style="width: 33%" />
<col style="width: 33%" />
</colgroup>
<thead>
<tr class="header">
<th>Name</th>
<th>Value</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td>startDate</td>
<td>yyyy-mm-dd</td>
<td>Required if querying list of accounts created within certain time period.</td>
</tr>
<tr class="even">
<td>endDate</td>
<td>yyyy-mm-dd</td>
<td>Filter by date when account was created. If start date is provided, end date is mandatory</td>
</tr>
<tr class="odd">
<td>status</td>
<td>A<br />
N<br />
O<br />
C<br />
P<br />
R<br />
Q<br />
E</td>
<td>Required if querying list of accounts that are certain status.</td>
</tr>
</tbody>
</table>

Queries returning more than 10,000 results will trigger a timeout error, Implement pagination using ‘`limit`‘ and ‘`offset`‘ parameter to manage large result sets.

## Account Status Scenarios

The endpoint will return both a “status” and “state” that indicate where the account is in the account setup process. The below table will help you understand what these values mean and what actions need to be taken.

<table>
<colgroup>
<col style="width: 33%" />
<col style="width: 33%" />
<col style="width: 33%" />
</colgroup>
<thead>
<tr class="header">
<th><strong>Scenarios</strong></th>
<th><strong>Result when Querying Account Status</strong></th>
<th><strong>Client Action Needed?</strong></th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td>Opened Account &amp; Ready to Trade.</td>
<td><code>"state": "Open" "status": "O"</code></td>
<td>No</td>
</tr>
<tr class="even">
<td>Opened Account with Pending Tasks</td>
<td><code>"state": "Documents Required", "status": "O"</code></td>
<td>Yes, use <a href="https://www.interactivebrokers.com/campus/ibkr-api-page/webapi-ref/#tag/Account-Management-Accounts/paths/~1gw~1api~1v1~1accounts~1%7BaccountId%7D~1tasks/get"><code>/api/v1/accounts/{{accountId}}/tasks?type=registration </code></a> to view pending tasks that need to be completed <strong>and</strong> filter by “isComplete”: “false”</td>
</tr>
<tr class="odd">
<td>Application is Pending Approval.</td>
<td><code>"state": "Pending Approval", "status": "P"  </code><br />
<strong>OR</strong> <strong> </strong><br />
<code> "state": "Pending Approval", "status": "N"</code></td>
<td>No, continue polling for status to monitor when account changes to ‘O  (Open) status.</td>
</tr>
<tr class="even">
<td>Pending Application that is under review with IBKR.</td>
<td><code>"state": "Under Review with IBKR", "status": "P"  </code><br />
<strong>OR</strong> <strong> </strong><br />
<code>"state": "Under Review with IBKR", "status": "N"</code></td>
<td>No, continue polling for status to monitor when account changes to ‘O  (Open) status.</td>
</tr>
<tr class="odd">
<td>Pending Application with Pending Tasks that need to be completed.</td>
<td><code>"state": "Documents Required", "status": "P"   </code><br />
<strong>OR</strong> <strong> </strong><br />
<code>"state": "Documents Required", "status": "N"</code></td>
<td>Yes, use <a href="https://www.interactivebrokers.com/campus/ibkr-api-page/webapi-ref/#tag/Account-Management-Accounts/paths/~1gw~1api~1v1~1accounts~1%7BaccountId%7D~1tasks/get"><code>/api/v1/accounts/{{accountId}}/tasks?type=pending</code></a> to view pending tasks required for approval.</td>
</tr>
</tbody>
</table>

## Registration Tasks

Registration tasks represent tasks required to activate or maintain a brokerage account at IBKR.

  - Tasks include steps in the application sequence, client agreements and disclosures, tax form, supporting documents for approval, and additional verification tasks (Enhanced Due Diligence).
  - Tasks can be used to track the lifecycle of an account and identify if client action is required to proceed with approval process.

The following attributes will be returned when viewing registration tasks associated with an account:

<table>
<colgroup>
<col style="width: 50%" />
<col style="width: 50%" />
</colgroup>
<thead>
<tr class="header">
<th>Attribute</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td>formNumber</td>
<td>4 digit number which IBKR associates with the registration task.</td>
</tr>
<tr class="even">
<td>formName</td>
<td>Name of the form. The formNumber and formName will always be 1:1 mapping.</td>
</tr>
<tr class="odd">
<td>onlineTask</td>
<td>True= IBKR form that needs to be completed/Signed by the client.<br />
False= External document that needs to be sent to IBKR by the client.</td>
</tr>
<tr class="even">
<td>requiredForTrading</td>
<td>True= Applicant will not be able to place trades until the online task is completed.  <br />
False = Applicant can place trades prior to the task being completed.</td>
</tr>
<tr class="odd">
<td>requiredForApproval</td>
<td>True= Account will not be approved/opened until the task has been satisfied.  <br />
False= Task is not required for approval.</td>
</tr>
<tr class="even">
<td>action</td>
<td>Describes action associated with the task.<br />
<strong>to be sent</strong>= External Document that needs to be sent by the client to IBKR.  <br />
<strong>to complete</strong>= IBKR form that needs to be completed by the account holder.  <br />
<strong>to sign</strong>= IBKR form that needs to be signed by the client.</td>
</tr>
<tr class="odd">
<td>state</td>
<td>Current state of the task.<br />
<strong>To Be Sent:</strong> External document which needs to be submitted to IBKR. <strong><br />
To Be Signed:</strong> IBKR agreement/disclosure which needs to be signed by the client. <strong><br />
To Be Submitted:</strong> IBKR generated document which needs to be submitted to IBKR.<br />
<strong>To Be Completed:</strong> Online task which needs to be completed.<br />
<strong>Received- Being Processed:</strong> Document is being reviewed by IBKR.<br />
<strong>Rejected .. &lt;Rejection Reason&gt;</strong>: External document was rejected by IBKR. Submit new document that meets IBKR’s requirements to proceed with approval process.</td>
</tr>
</tbody>
</table>

## View Registration Tasks

IBKR will include the status of registration tasks in response file that is returned when creating an account via the API.

` documents:  `Represents tasks that were included and processed when creating account via the API.

`pendingTasks`: Represents tasks that are required for account approval. Hosting firm is responsible for communicating pending tasks required for approval to the end user.

The ` gw/api/v1/accounts/{accountId}/tasks  `can be used to view registration tasks which are associated with an account after an account has been created.

IBKR segregates tasks into **two types**:

**`type=pending:`** View pending (incomplete) registration tasks which are **required** for account approval.

  - If a registration task is assigned to a pending account and the task is not required for account approval, the task will not be returned in response.
  - If registration task is assigned to an opened account and the task is required for an account upgrade, the task will not be returned in response.

**`type=registration`** :View all tasks associated with an account irrespective of the account status or state of the registration task.

  - View date/time which user completed specific registration task.
  - View registration tasks which the client needs to complete in order to trade or maintain account with IBKR.

## Complete Registration Tasks

The **`[PATCH]`**[`/api/v1/accounts/`](https://www.interactivebrokers.com/campus/ibkr-api-page/webapi-ref-staging/#tag/Account-Management-Accounts/paths/~1gw~1api~1v1~1accounts/patch) can be used to complete registration tasks for an existing account.

###### documentSubmission

Submit documents required by IBKR for account approval or for an account upgrade.

Service can be used to submit the following:

  - IBKR agreements/disclosures
  - KYC Documents including Proof of Identity, Proof of Address and Proof of Source of Wealth.
      - Only single document accepted per formNumber, if document has multiple sides or pages, consolidate into single file prior to submitting to IBKR.

###### Schema

<table>
<colgroup>
<col style="width: 25%" />
<col style="width: 25%" />
<col style="width: 25%" />
<col style="width: 25%" />
</colgroup>
<thead>
<tr class="header">
<th>Name</th>
<th>Type</th>
<th>Usage based on form_no</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td>accountId</td>
<td>String</td>
<td>All</td>
<td>IBKR account ID of the advisor/broker client account documents are being submitted for. </td>
</tr>
<tr class="even">
<td>fileName</td>
<td>String</td>
<td>All</td>
<td>File name of the PDF document submitted to IBKR. <code>fileName </code>included within the <code>documents </code>request must match the <code>fileName</code> of the PDF file that is included within the signed request.<br />
Acceptable formats: .jpeg, .jpg, .pdf, .png<br />
Max size: 10 MB</td>
</tr>
<tr class="odd">
<td>sha1Checksum</td>
<td>String</td>
<td>All</td>
<td>SHA-1 is crypto algorithm that is used to verify that a file has been unaltered. This is done by producing a checksum before the file has been transmitted, and then again once it reaches its destination.</td>
</tr>
<tr class="even">
<td>formNumber</td>
<td>String</td>
<td>All</td>
<td>Use <code>/gw/api/v1/accounts/{accountId}/tasks </code>to view a list of forms that are required for approval.</td>
</tr>
<tr class="odd">
<td>execTimestamp</td>
<td>YYYYMMDDHHMMSS</td>
<td>All</td>
<td>Timestamp of the execution of the agreement by the customer (i.e. time the client signed the agreement).</td>
</tr>
<tr class="even">
<td>execLoginTimestamp</td>
<td>YYYYMMDDHHMMSS</td>
<td>All</td>
<td>Login timestamp for the session (when the client logged in and acknowledged the agreement.</td>
</tr>
<tr class="odd">
<td>signedBy</td>
<td>String</td>
<td>All</td>
<td><code>signedBy </code>must match the submitted: name (<code>first + middle </code>initial (if applicable) + <code>last</code>).<br />
*Data is case and space sensitive. </td>
</tr>
<tr class="even">
<td>proofOfIdentityType</td>
<td><strong>All Entities Except for IB-CAN</strong><br />
Driver License<br />
Passport<br />
Alien ID Card<br />
National ID Card<br />
<strong>IB-CAN only</strong><br />
Bank Statement<br />
Evidence of Ownership of Property<br />
Credit Card Statement<br />
Utility Bill<br />
Brokerage Statement<br />
T4 Statement<br />
CRA Assessment </td>
<td>8001<br />
8205<br />
8053<br />
8057</td>
<td>Description of document submitted to salsify proof of identity.</td>
</tr>
<tr class="odd">
<td>proofOfAddressType</td>
<td>Additional Proof of Identity Document<br />
Authorization to Open Account – Certification<br />
Authorization to Open Account – Evidence<br />
Bank Statement<br />
Brokerage Statement<br />
Certificate of Good Standing<br />
Certificate of Incorporation<br />
Certificate of Registration<br />
Certified Proof of Address<br />
Certified Proof of Identity<br />
Check<br />
Company Charter<br />
Company Ownership<br />
Corporate Charter|Articles of Incorporation<br />
Court- or Govt-issued document<br />
CRS card of Lombardy<br />
Current Lease<br />
Divorce Settlement<br />
Drivers License <br />
Employer Confirmation<br />
Entitlement to Payments<br />
Evidence of Ownership of Property<br />
Financial Statement<br />
Formation<br />
Government-issued Business License<br />
Income Tax Return<br />
Italian Electronic ID Card – CIE<br />
Italian Health Card (Tessera Sanitaria)<br />
Letter<br />
National ID<br />
Ownership<br />
Passport<br />
Pay Slip<br />
Proof of Principal Place of Business and Registration<br />
Proof of Sale<br />
Proof of Winnings<br />
Severance<br />
Statement<br />
Tax Return<br />
Utility Bill<br />
Will</td>
<td>8002<br />
8001<br />
8205<br />
8053<br />
8057</td>
<td>Description of document submitted to salsify proof of address.</td>
</tr>
<tr class="even">
<td>validAddress</td>
<td>true<br />
false</td>
<td>8001</td>
<td>If <code>Driver License</code> is provided as <code>proofOfIdentityType </code>AND <code>validAddress</code>=true, single document can be used to satisfy Proof of Identity and Proof of Address. ]</td>
</tr>
<tr class="odd">
<td>documentType</td>
<td>Check<br />
Company Ownership<br />
Divorce Settlement<br />
Employer Confirmation<br />
Entitlement to Payments<br />
Letter<br />
Ownership<br />
Pay Slip<br />
Proof of Sale<br />
Proof of Winnings<br />
Severance<br />
Tax Return<br />
Will<br />
Bank Statement<br />
Brokerage Statement<br />
Current Lease</td>
<td>8541<br />
8542<br />
8543<br />
8544<br />
8545<br />
8546<br />
8547<br />
8548<br />
8549</td>
<td>Acceptable documents will vary based on the formNo.</td>
</tr>
<tr class="even">
<td>externalIndividualId</td>
<td>String</td>
<td></td>
<td>Identifier at the external entity for the individual executing the agreement. Must be an individual listed on the application. Ignored for INDIVIDUAL applications as agreements must be executed by the Account Holder. Required for JOINT accounts created via ECA for POI/POA submission. For the JOINT holder created via ECA, external id of the account holder needs to be provided for which POI/POA is being submitted.</td>
</tr>
<tr class="odd">
<td>expirationDate</td>
<td>YYYY-MM-DD</td>
<td>Drivers License OR Passport</td>
<td>Provide expiration date of the ID document.</td>
</tr>
<tr class="even">
<td>mimeType</td>
<td>application/pdf<br />
application/pdf<br />
image/png<br />
image/jpeg (Includes .jpeg, .jpg)</td>
<td></td>
<td>Format of the file.</td>
</tr>
<tr class="odd">
<td>data</td>
<td>String</td>
<td></td>
<td>Includes document encoded in base64.</td>
</tr>
</tbody>
</table>

###### Validations

  - Acceptable formats: .jpeg, .jpg, .pdf, .png
  - Max upload size: 25 MB

#### Acceptable documentType based on formNumber

<table>
<colgroup>
<col style="width: 33%" />
<col style="width: 33%" />
<col style="width: 33%" />
</colgroup>
<thead>
<tr class="header">
<th>formName</th>
<th>formNumber</th>
<th>documentType</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td>Proof of Identity and Date of Birth</td>
<td>8001</td>
<td>Driver License<br />
Passport<br />
Alien ID Card<br />
National ID Card</td>
</tr>
<tr class="even">
<td>Proof of Address</td>
<td>8002</td>
<td>Bank Statement<br />
Brokerage Statement<br />
Homeowner Insurance Policy Bill<br />
Homeowner Insurance Policy Document<br />
Renter Insurance Policy bill<br />
Renter Insurance Policy Document<br />
Security System Bill<br />
Government Issued Letters<br />
Utility Bill<br />
Current Lease<br />
Evidence of Ownership of Property<br />
Driver License<br />
Other Document</td>
</tr>
<tr class="odd">
<td>Selfie Verification</td>
<td>8205</td>
<td>The account holder will need to take a ‘selfie’ holding their Identity document.For ID Document we only accept National ID OR Passport.Driver’s License/Alien card is not accepted.</td>
</tr>
<tr class="even">
<td>Hong Kong Signature Verification</td>
<td>8043</td>
<td><a href="https://ndcdyn.interactivebrokers.com/Universal/servlet/Registration_v2.formSampleView?formdb=8043&amp;preferredFormat=pdf">Form8043.pdf</a></td>
</tr>
<tr class="odd">
<td>PROOF OF SOW-IND-Allowance</td>
<td>8541</td>
<td>Bank Statement<br />
Pay Slip<br />
Employer Confirmation<br />
Divorce Settlement<br />
Company Ownership</td>
</tr>
<tr class="even">
<td>PROOF OF SOW-IND-Disability</td>
<td>8542</td>
<td>Bank Statement<br />
Entitlement to Payments<br />
Severance</td>
</tr>
<tr class="odd">
<td>PROOF OF SOW-IND-Income</td>
<td>8543</td>
<td>Pay Slip<br />
Bank Statement<br />
Employer Confirmation</td>
</tr>
<tr class="even">
<td>PROOF OF SOW-IND-Inheritance</td>
<td>8544</td>
<td>Letter<br />
Bank Statement<br />
Check<br />
Will<br />
Brokerage Statement</td>
</tr>
<tr class="odd">
<td>PROOF OF SOW-IND-Interest</td>
<td>8545</td>
<td>Brokerage<br />
Statement<br />
Tax Return</td>
</tr>
<tr class="even">
<td>PROOF OF SOW-IND-MarketProfit</td>
<td>8546</td>
<td>Ownership<br />
Brokerage Statement<br />
Tax Return</td>
</tr>
<tr class="odd">
<td>PROOF OF SOW-IND-Other</td>
<td>8547</td>
<td>Proof of Winnings<br />
Bank Statement<br />
Tax Return<br />
Brokerage Statement</td>
</tr>
<tr class="even">
<td>PROOF OF SOW-IND-Pension</td>
<td>8548</td>
<td>Bank Statement<br />
Pay Slip</td>
</tr>
<tr class="odd">
<td>PROOF OF SOW-IND-Property</td>
<td>8549</td>
<td>Proof of Sale<br />
Current Lease</td>
</tr>
<tr class="even">
<td>Proof of Existence</td>
<td>8003</td>
<td>Certificate of Incorporation<br />
Formation<br />
Certificate of Registration<br />
Company Charter<br />
Certificate of Good Standing<br />
Government-issued Business License<br />
Corporate Charter<br />
Articles of Incorporation</td>
</tr>
<tr class="odd">
<td>Proof of Principal Place of Business Address</td>
<td>8004</td>
<td>Statement<br />
Certified Proof of Identity<br />
Certified Proof of Address<br />
Income Tax Return<br />
Additional Proof of Identity Document<br />
Proof of Principal Place of Business and Registration<br />
Utility Bill<br />
Bank Statement<br />
Bank Statement<br />
Brokerage Statement<br />
Current Lease<br />
Evidence of Ownership of Property</td>
</tr>
<tr class="even">
<td>Proof of Name Change</td>
<td>8039</td>
<td>Court- or Govt-issued document<br />
Passport<br />
National ID<br />
Drivers License </td>
</tr>
<tr class="odd">
<td>Proof of Change of Name</td>
<td>8040</td>
<td>Court- or Govt-issued document</td>
</tr>
<tr class="even">
<td>Proof of Citizenship</td>
<td>8138</td>
<td>Passport<br />
National ID</td>
</tr>
<tr class="odd">
<td>Proof of Authorization to Open Account – Certification Task</td>
<td>8175</td>
<td>Authorization to Open Account – Certification</td>
</tr>
<tr class="even">
<td>Proof of Authorization to Open Account – Evidence Task</td>
<td>8176</td>
<td>Authorization to Open Account – Evidence</td>
</tr>
<tr class="odd">
<td>Proof of Tax Id</td>
<td>8360</td>
<td>CRS card of Lombardy<br />
Italian Electronic ID Card – CIE<br />
Italian Health Card (Tessera Sanitaria)</td>
</tr>
<tr class="even">
<td>Proof of Liquid Net Worth</td>
<td>9975</td>
<td>Bank Statement<br />
Brokerage Statement<br />
Financial Statement</td>
</tr>
</tbody>
</table>

###### Example

``` wp-block-code
PATCH /api/v1/accounts/

{"accountManagementRequests": {       
"documentSubmission": 
            {
                "documents": [
                    {
                        "signedBy": [
                            "Jane Doe"
                        ],
                        "attachedFile": {
                            "fileName": "ProofOfId.pdf",
                            "fileLength": 9508,
                            "sha1Checksum": "b6e3235d3d21dc999da2fa24c7009ad0815e7330"
                        },
                        "formNumber": 8001,
                        "validAddress": true,
                        "execLoginTimestamp": 20210929123113,
                        "execTimestamp": 20210929123113,
                        "proofOfIdentityType": "Drivers License",
                        "payload": {
                         "mimeType": "application/pdf",
                         "data": "<DocumentEncodedInBase64>"         }

                    }
                ],
                "accountId":"U123456,
                "inputLanguage": "en",
                "translation": false
            }
        
    }
```

###### questionnaires

Complete questionnaire(s) for an existing account.

Service supports following questionnaires

  - Due Diligence (EDD)
  - Knowledge Assessment

The`  /api/v1/enumerations/edd-avt?form-number=<formNumber> ` can be used to retrieve list of questions associated questionnaire based on the `formNumber`.

###### Schema

| Name       | Type   | Description                                                                             |
| ---------- | ------ | --------------------------------------------------------------------------------------- |
| accountId  | String | IBKR account ID of the advisor/broker client account documents are being requested for. |
| formNumber | String | Form number associated with the Questionnaire.                                          |
| detail     | String | Maximum of 350 Characters.                                                              |

###### Example- Due Diligence

``` wp-block-code
PATCH /api/v1/accounts/{
{
    "accountManagementRequests": {
        "questionnaires": {
            "accountId": "U123456",
            "questionnaire": [
                {
                    "formNumber": 9943,
                    "answers": [
                        {
                            "detail": "description",
                            "id": 2396,
                            "questionId": 1620
                        }
                    ]
                }
            ]
        }
    }
}
```

###### Example- Knowledge Assessment

``` wp-block-code
PATCH /api/v1/accounts/
{
"accountManagementRequests": {
"quizQuestionnaires": {
"questionnaire": [
{
"answers": [
{
"id": 4,
"questionId": 1
},
{
"id": 4,
"questionId": 2
},
{
"id": 4,
"questionId": 3
},
{
"id": 4,
"questionId": 4
},
{
"id": 4,
"questionId": 5
},
{
"id": 4,
"questionId": 6
},
{
"id": 4,
"questionId": 7
},
{
"id": 4,
"questionId": 8
},
{
"id": 4,
"questionId": 9
},
{
"id": 4,
"questionId": 10
}
],
"formNumber": 2430
},
{
"answers": [
{
"id": 4,
"questionId": 1
},
{
"id": 4,
"questionId": 2
},
{
"id": 4,
"questionId": 3
},
{
"id": 4,
"questionId": 4
},
{
"id": 4,
"questionId": 5
},
{
"id": 4,
"questionId": 6
},
{
"id": 4,
"questionId": 7
},
{
"id": 4,
"questionId": 8
},
{
"id": 4,
"questionId": 9
},
{
"id": 4,
"questionId": 10
}
],
"formNumber": 2438
},
{
"answers": [
{
"id": 4,
"questionId": 1
},
{
"id": 4,
"questionId": 2
},
{
"id": 4,
"questionId": 3
},
{
"id": 4,
"questionId": 4
},
{
"id": 4,
"questionId": 5
},
{
"id": 4,
"questionId": 6
},
{
"id": 4,
"questionId": 7
},
{
"id": 4,
"questionId": 8
},
{
"id": 4,
"questionId": 9
},
{
"id": 4,
"questionId": 10
}
],
"formNumber": 2432
}
],
"accountId": "U1111111",
"task": [
{
"formNumber": 2431,
"status": false
},
{
"formNumber": 2439,
"status": false
},
{
"formNumber": 2433,
"status": false
}
]
}
}
}
```

###### prohibitedCountryQuestionnaire

Complete Prohibited Country Questionnaire.

  - If `citizenship, citizenship2, citizenship3` or ` countryOfBirth  `is prohibited country then `prohibitedCountryQuestionnaire` (` formNumber  `3442) will be assigned to the account.
  - List of Prohibited Countries can be obtained using `/api/v1/enumerations/prohibited-country` endpoint.

###### Schema

<table>
<colgroup>
<col style="width: 33%" />
<col style="width: 33%" />
<col style="width: 33%" />
</colgroup>
<thead>
<tr class="header">
<th>Name</th>
<th>Type</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td>accountId</td>
<td>String</td>
<td>IBKR account ID of the client account which <code class="EnlighterJSRAW" data-enlighter-language="generic">prohibitedCountryQuestionnaire</code> is being submitted for.</td>
</tr>
<tr class="even">
<td>code</td>
<td>PASSPORT<br />
CITIZENSHIP<br />
BUSINESSDEALINGS<br />
FINANCIALACCOUNTS<br />
RESIDENT<br />
MULTI<br />
BIRTH</td>
<td><strong>PASSPORT</strong>: Do you currently hold a passport from a Prohibited Country?
<p><strong>CITIZENSHIP</strong>: Do you currently hold a citizenship from a Prohibited Country?</p>
<p><strong>BUSINESSDEALINGS</strong>: Do you currently have business dealings in a Prohibited Country?</p>
<p><strong>FINANCIALACCOUNTS</strong>: Do you currently have financial accounts in a Prohibited Country?</p>
<p><strong>RESIDENT</strong>: Do you currently have plans to reside in a Prohibited Country?</p>
<p><strong>MULTI</strong>: Do you hold citizenship and/or residency status in multiple countries</p>
<p><strong>BIRTH</strong>: Were you born in any of the following countries &lt;Prohibited Country&gt;</p></td>
</tr>
<tr class="odd">
<td>externalId</td>
<td>String</td>
<td><code>externalID</code> associated with the account holder. This should be the same <code>externalID</code> that was included in the  request to create the account.</td>
</tr>
<tr class="even">
<td>status</td>
<td>true<br />
false</td>
<td> </td>
</tr>
<tr class="odd">
<td>details</td>
<td>string</td>
<td>Required if status=”true”; provide a description.</td>
</tr>
</tbody>
</table>

###### Example

**PATCH /gw/api/v1/accounts**

``` wp-block-code
{
  "accountManagementRequests": {
    "prohibitedCountryQuestionnaire": {
      "accountId": "accountId",
      "entityId": "247519520",
      "prohibitedQuestionnaireDetails": [
        {
          "code": "PASSPORT",
          "details": "Do you hold passport for the following countries"
        },
        {
          "code": "BIRTH",
          "details": "Were you born in the following countries"
        },
        {
          "code": "CITIZENSHIP",
          "details": "Do you hold citizenship in the following countries"
        },
        {
          "code": "BUSINESSDEALINGS",
          "details": "Do you have business dealings in the following countries"
        },
        {
          "code": "FINANCIALACCOUNTS",
          "details": "Do you have financial accounts in the following countries"
        },
        {
          "code": "RESIDENT",
          "details": "Do you plan to reside in the following countries"
        },
        {
          "code": "MULTI",
          "details": "Do you hold citizenship and/or residency details in multiple countries"
        }
      ]
    }
  }
}
```

## Account Information

The`  /api/v1/accounts/{{accountId}}/details ` can be used to view account information based on the `accountId`.

The endpoint returns same data that is returned in IBKR’s end of day Acct\_Status including:

  - Application Information (Date Started, Date Approved, Date Opened, Status, Date Funded, Applicant Type, External ID )
  - Profile Information (Name, Address, Contact Information, Employment Information, Identification Document Information, Accepted Signatures)
  - Fee Configuration and Effective Date
  - Account Configuration (Base Currency, Permissions, Special Programs including SYEP and DRIP, MIFID Category, Market Data Subscriptions)
  - Trading Capabilities (Requested, Approved, Activated, Margin Type, Options Level)
  - Financial Information (Net Worth, Income, Sources of Wealth)
  - Appropriateness  (Investment Objectives, Knowledge & Experience)
  - Risk Score
  - User (Username, Last Login, Two Factor Authentication, Last Login)

## Update Information

The **`[PATCH]`**[`/api/v1/accounts/`](https://www.interactivebrokers.com/campus/ibkr-api-page/webapi-ref-staging/#tag/Account-Management-Accounts/paths/~1gw~1api~1v1~1accounts/patch) can be used to manage user-level and account-level settings.

  - Changes applied at the user level will be applied to all accounts associated with the user.
  - Updates are only supported for accounts that are opened.
  - Alternatively, information changes can be initiated within the [IBKR Portal](https://www.ibkrguides.com/clientportal/am_settings.htm).

#### User

##### addMiFIRData

Add/edit MiFIR data for user listed on the account.

MIFIR data pertains to transaction reporting requirements for investment firms operating within European Economic Area (EEA) and the UK. As a client of an Investment Firm that uses the IBKR platform, you may be required to provide additional information to allow the proper transaction reports to be filed.

For more information refer to this [link](https://www.ibkrguides.com/kb/mifir-transaction-reporting.htm)

###### Schema

<table>
<colgroup>
<col style="width: 33%" />
<col style="width: 33%" />
<col style="width: 33%" />
</colgroup>
<thead>
<tr class="header">
<th>Name</th>
<th>Type</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td>accountId</td>
<td>String</td>
<td>IBKR account ID of the advisor/broker client account which request is being submitted for.</td>
</tr>
<tr class="even">
<td>title</td>
<td>ACCOUNT HOLDER<br />
FIRST HOLDER<br />
SECOND HOLDER</td>
<td>Individual Account Type title will always be “ACCOUNT HOLDER” 
<p>Joint Account Type. title will be one of:<br />
FIRST HOLDER<br />
SECOND HOLDER</p></td>
</tr>
<tr class="odd">
<td>identification</td>
<td><a href="https://www.interactivebrokers.com/campus/ibkr-api-page/web-api-account-management/#associatedindividual-25">Identification</a></td>
<td><code>identification</code> node included in XML request should match <code>identification</code> node that was included in Account Opening Request </td>
</tr>
</tbody>
</table>

###### Example

``` wp-block-code
PATCH /gw/api/v1/accounts


{
    "accountManagementRequests": {
        "addMiFirData": {
            "accountId": "U12345",
            "title": "ACCOUNT HOLDER",
            "identifications": [
                {
                    "citizenship": "Liechtenstein",
                    "passport": "A11111",
                    "alienCard": "AlienCard",
                    "expire": false
                }
            ]
        }
    }
}
```

##### changeAccountHolderDetail

Update profile information for user listed on the account.

  - Within the body of the request, provide updated information for the individual. If the information included within the ` newAccountHolderDetails  `node does not match with what IBKR has on file, the information will be updated.
      - If multiple requests are submitted for single account; the new request will override the existing pending request.
      - When submitting request to update account information, either **` id  `**OR `externalId` will be required.
  - For Dual Language applications, details in both Native and Translated are required.
  - `changeAccountHolderDetails `requests are only supported for Individual AND Joint accounts that are open OR Pending/New application IF 9974 is assigned. If request is submitted for Pending/New application and 9974 is not assigned, the request will not be accepted.
      - If account information needs to be updated for a Pending/New account, a new application with the updated information will need to be submitted.
          - To avoid duplicate accounts, please use ` abandonAccount  `to delete the existing application with incorrect data.
          - When submitting a new application, a new unique external ID will need to be included. To submit a new application using the original external ID, ([updateExternalId](https://www.interactivebrokers.com/campus/ibkr-api-page/webapi-ref-staging/#tag/Account-Management-Accounts/paths/~1gw~1api~1v1~1accounts/post)) for the existing account.
          - Once updated, your team can resubmit the application for the applicant using the original external ID that was used to create the original account.
              - New IBKR account ID will be generated once the application has been resubmitted.
                  - You cannot resubmit application for an externalid that had already been processed unless the externalId has been delinked (updateExternalId) from the original account.

###### Schema

<table>
<colgroup>
<col style="width: 33%" />
<col style="width: 33%" />
<col style="width: 33%" />
</colgroup>
<thead>
<tr class="header">
<th>Name</th>
<th>Type</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td>accountId</td>
<td>String</td>
<td>IBKR account ID associated with the individual. If user has multiple accounts and <code>accountId</code>, information will only be updated for the <code>accountId</code>.</td>
</tr>
<tr class="even">
<td>referenceUserName</td>
<td>String</td>
<td>Username associated with the individual. If user has multiple accounts and <code>referenceUserName</code> is provided, data will be updated across all accounts.</td>
</tr>
<tr class="odd">
<td>inputLanguage</td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td>translation</td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td>id</td>
<td>String</td>
<td>The <strong><code>id</code></strong> is a unique id which IBKR assigns to each individual that is associated with account. The <strong><code>id</code></strong><br />
can be used as alternative to <code>externalId</code>. The <strong><code>id</code></strong><br />
can be obtained by calling <code>GET /api/v1/accounts/{{accountId}}/details</code>.</td>
</tr>
<tr class="even">
<td>externalId</td>
<td>String</td>
<td><code>externalId </code>associated with the individual. associated with the user. The <code>externalId </code>can be obtained from &lt;Entities&gt; section of response file for account creation. If there are multiple individuals on an account, each individual will have a unique <code>externalId</code>.</td>
</tr>
<tr class="odd">
<td>newAccountHolderDetails</td>
<td>Array of objects (<a href="https://www.interactivebrokers.com/campus/ibkr-api-page/web-api-account-management/#associatedindividual-25">AssociatedIndividual</a>)</td>
<td>Provide applicant data to be updated within the <code>newAccountHolderDetails</code>. node.</td>
</tr>
</tbody>
</table>

###### Example

``` wp-block-code
PATCH /gw/api/v1/accounts

{
    "accountManagementRequests": {
        "changeAccountHolderDetail": {
            "newAccountHolderDetails": [
                {
                    "id": "172032379",
                    "name": {
                        "salutation": "Ms.",
                        "first": "Jane",
                        "last": "Smith"
                    },
                    "referenceUserName": "joesm123",
                    "inputLanguage": "en",
                    "translation": false
                }
            ]
        }
    }
}
```

##### manageMarketDataSubscriptions

Update market data subscription for existing user.

  - Market data subscriptions are terminated if you have not logged into IBKR trading platform for 60 days. 
  - More information on market data can be found [here](https://www.ibkrguides.com/brokerportal/usersettings/marketdatasubscriptions.htm).

###### Schema

<table>
<colgroup>
<col style="width: 33%" />
<col style="width: 33%" />
<col style="width: 33%" />
</colgroup>
<thead>
<tr class="header">
<th>Name</th>
<th>Type</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td>referenceUserName</td>
<td>String</td>
<td>User name associated with the account. If you do not have the IBKR user name associated with the account, use <a href="https://www.interactivebrokers.com/campus/ibkr-api-page/webapi-ref-staging/#tag/Account-Management-Accounts/paths/~1gw~1api~1v1~1accounts~1%7BaccountId%7D~1details/get">/getAccountDetail</a> to query user name based on account ID.</td>
</tr>
<tr class="even">
<td>service</td>
<td>Use <code>/enumerations/market-data</code> to obtain service ID.</td>
<td>Market data service ID the user is requesting subscription to.</td>
</tr>
<tr class="odd">
<td>action</td>
<td>ADD<br />
REMOVE</td>
<td>Set action to ADD or REMOVE the market data subscription.</td>
</tr>
</tbody>
</table>

###### Example

``` wp-block-code
PATCH /gw/api/v1/accounts

{
  "accountManagementRequests": {
    "manageMarketDataSubscriptions": {
      "service": [
        460,
        462
      ],
      "referenceUserName": "test12345"
    }
  }
}
```

##### updateCredentials

Update email address for user listed on the account.

Non-Disclosed Clients: Email address will be updated immediately.

Fully-Disclosed and Advisor: User will need to retrieve email confirmation token.

1.   Upon submitting request to update email, confirmation token for current email address
      - IBKR will send confirmation token to users current email address.
      - Counterparty instructs user to check email for confirmation token. 
      - Counterparty sends confirmation token to IBKR
2.  Confirmation token for new email address
      - IBKR will send confirmation token to users new email address.
      - Counterparty instructs user to check email for confirmation token. 
      - Counterparty sends confirmation token to IBKR
      - Email address is updated successfully

###### Schema

<table>
<colgroup>
<col style="width: 33%" />
<col style="width: 33%" />
<col style="width: 33%" />
</colgroup>
<thead>
<tr class="header">
<th>Name</th>
<th>Type</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td>referenceUserName</td>
<td>String</td>
<td>User name associated with the account. If you do not have the IBKR user name associated with the account, use <a href="https://www.interactivebrokers.com/campus/ibkr-api-page/webapi-ref-staging/#tag/Account-Management-Accounts/paths/~1gw~1api~1v1~1accounts~1%7BaccountId%7D~1details/get">/getAccountDetail</a> to query user name based on account ID.</td>
</tr>
<tr class="even">
<td>email</td>
<td>String</td>
<td>New email address</td>
</tr>
<tr class="odd">
<td>hasAccess</td>
<td>true<br />
false</td>
<td>Indicate if the user has access to the current email address. If the user does not have access to the current email address, the user cannot update the email address using DAM.</td>
</tr>
<tr class="even">
<td>token</td>
<td>String</td>
<td>Confirmation <code>token</code> sent by IBKR to applicant via email.</td>
</tr>
</tbody>
</table>

###### Example

``` wp-block-code
PATCH /gw/api/v1/accounts

"accountManagementRequests": {
    "updateCredentials": [
        {
            "referenceUserName": "ctest9751",
            "updateEmail": {
             "email": "abqa@ibkr.com",
             "token": "12345",                
            "access": true
            }
        }
    ]
  }
}
```

##### updateWithholdingStatement

Update Withholding Statement for user listed on the account.

  - Error will be triggered if any of the following conditions are met
      - Request is submitted for ND-NonQI, FA, or FD sub account.
      - Effective date is missing or is not the current date (ie. Future or Past Date).

###### Schema

<table>
<colgroup>
<col style="width: 33%" />
<col style="width: 33%" />
<col style="width: 33%" />
</colgroup>
<thead>
<tr class="header">
<th>Name</th>
<th>Type</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td>accountId</td>
<td>String</td>
<td>IBKR account ID of the advisor/broker client account which request is being submitted for.</td>
</tr>
<tr class="even">
<td>effectiveDate</td>
<td>YYYY-MM-DD</td>
<td><code>effectivedate</code> of withholding statement. Current or future date.</td>
</tr>
<tr class="odd">
<td>certW8Imy</td>
<td>true<br />
false</td>
<td>Confirm that consistent with the IRS, Form W-8IMY you provided, you certify you are qualified intermediary and have not assumed primary withholding responsibilities under Chapter 3 and 4 and have not assumed primary 1099 reporting and backup withholding responsibility on this account.  You have assumed Form 1042 reporting to your customer This account is part of withholding statement for your Form W-8IMY. We wil request a W9 from those customers who you indicate are tax residents.</td>
</tr>
<tr class="even">
<td>fatcaCompliantType</td>
<td>FATCA_COMPLIANT
<p>NON_CONSENTING_US_ACCOUNT</p>
<p>NON_COOPERATIVE_ACCOUNT</p></td>
<td>Indicate if the Account Holder is FATCA compliant account</td>
</tr>
<tr class="odd">
<td>treatyCountry</td>
<td><a href="https://www.iso.org/obp/ui">3 Digit ISO Code</a></td>
<td>If the account holder qualifies for treaty benefits under US income tax treaty, please identify treaty.
<p>&gt;N/A is acceptable if account holder does not qualify for treaty benefits.</p>
<p>&gt;<a href="https://www.irs.gov/businesses/international-businesses/united-states-income-tax-treaties-a-to-z">Treaty Countries with United States</a></p></td>
</tr>
<tr class="even">
<td>usIncomeTax</td>
<td>true<br />
false</td>
<td>Indicate if the owner of this account is a US Income Tax Resident.</td>
</tr>
</tbody>
</table>

###### Example

``` wp-block-code
PATCH /gw/api/v1/accounts

{
  "accountManagementRequests": {
    "updateWithholdingStatement": 
        {
            "accountId": "U12345",
            "treatyCountry": "CHN",
            "fatcaCompliantType": "FATCA_COMPLIANT",
            "effectiveDate": "2020-01-02",
            "certW8Imy": true,
            "usIncomeTax": true
        }
    
  }
}
```

##### updateTaxForm

Update tax form (W8Ben, W9) for user listed on the account.

  -  `w8Ben`: US Treasury and IRS require IBKR to request new tax identification form from non-US Persons every 3 years IF tax treaty country (`part29ACountry` in `w8Ben`) is set.
    
      - The account holder must provide IBKR with a new tax form (Form 5001).Electronic Signature and Requirements for form submission are the same as account opening.Re-certification of this form ensures that account holder will be treated as non-US person for tax purposes.Failure to provide updated tax form by expiration date will result in account being subject to US Tax withholding at 30% on interest, dividends, payments in lieu and royalty. In addition, 28% US Tax withholding will apply to all gross proceeds from sales.
    
    If no tax treaty is set (`part29ACountry` =”N/A”), the `w8Ben`does not expire.

  - Certain `changeAccountHolderDetail `requests require user to submit a new tax form reflecting the updated information. The tax form can be submitted via DAM API or via IBKR Hosted Portal.
    
      - Profile changes which require user to submit a new tax form:
          - `name (first, last)`
          - `citizenship`
          - `residenceAddress`
          - `mailingAddress`
          - `taxResidency country`
          - `/gw/api/v1/accounts/{accountId}/login-messages` can be used to view login messages assigned to a specific account.

###### Schema

<table>
<colgroup>
<col style="width: 33%" />
<col style="width: 33%" />
<col style="width: 33%" />
</colgroup>
<thead>
<tr class="header">
<th>Name</th>
<th>Type</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td>accountId</td>
<td>String</td>
<td>IBKR account ID of the advisor/broker client account which request is being submitted for.</td>
</tr>
<tr class="even">
<td>externalId</td>
<td>String</td>
<td><code>externalId</code> associated with the individual.</td>
</tr>
<tr class="odd">
<td>entityId</td>
<td>String</td>
<td>Unique ID associated with the individual. ID can be obtained from &lt;Entities&gt; section of response file for <a href="https://www.interactivebrokers.com/campus/ibkr-api-page/webapi-ref-staging/#tag/Account-Management-Accounts/paths/~1gw~1api~1v1~1accounts/post">create</a>.
<p>If there are multiple individuals on an account, each individual will have a unique id.</p></td>
</tr>
<tr class="even">
<td>&lt;TaxForm&gt; </td>
<td><a href="https://www.interactivebrokers.com/campus/ibkr-api-page/web-api-account-management/#associatedindividual-25">w8Ben</a> (Non-US)<br />
<a href="https://www.interactivebrokers.com/campus/ibkr-api-page/web-api-account-management/#associatedindividual-25">localTaxForms</a><br />
OR <br />
<a href="https://www.interactivebrokers.com/campus/ibkr-api-page/web-api-account-management/#associatedindividual-25">w9</a> (US Clients)</td>
<td>Enter new tax form details. Validations for this section mimic same validations that are applied when including tax form for client registration.</td>
</tr>
<tr class="odd">
<td><a href="https://www.interactivebrokers.com/campus/ibkr-api-page/web-api-account-management/#documents-29">documents</a></td>
<td> </td>
<td>Include document details associated with the tax form. Validations for this section mimic same validations that are applied when including tax form for client registration</td>
</tr>
</tbody>
</table>

###### Example

``` wp-block-code
PATCH /gw/api/v1/accounts

{
    "accountManagementRequests": {
        "updateTaxForm": {
            "accountId": "U12345",
            "entityId": "123456",
            "externalId": "Test12346",
            "documents": {
                "formNumber": "5001",
                "execTimestamp": "20161221123500",
                "execLoginTimestamp": "20161221123500",
                "signedBy": "John Doe",
                "attachedFile": {
                    "fileName": "Form5001.pdf",
                    "fileLength": "67700",
                    "sha1Checksum": "D8AA699678D12DE6AC468A864D4FAE7999AA904B"
                },
                "w8Ben": {
                    "name": "John Doe",
                    "explanation": "TIN_NOT_REQUIRED",
                    "part29ACountry": "CAN",
                    "cert": true,
                    "blankForm": true,
                    "taxFormFile": "Form5001.pdf",
                    "proprietaryFormNumber": "5001"
                }
            }
        }
    }
}
```

#### Account

##### accountConfiguration

Update account configuration for the account.

Currently only LITE/PRO designation is supported. Requests submitted prior to 3pm EST are processed around 5pm EST. Requests submitted after 3pm EST are processed following business day at 5pm EST.

  - Users may switch between LITE and PRO up to three times within any 90-day period. Requests exceeding this limit will be rejected and subject to a 90-day processing delay.
      - **Limit Exceeded Response:** Request cannot be processed. You have exceeded the limit of three subscription changes per 90-day period. Please wait 90 days from your first change request before resubmitting.
      - **Important Note:**
          - Declined requests must be resubmitted after the 90-day period expires

###### Schema

<table>
<colgroup>
<col style="width: 33%" />
<col style="width: 33%" />
<col style="width: 33%" />
</colgroup>
<thead>
<tr class="header">
<th>Name</th>
<th>Type</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td>accountId</td>
<td>String</td>
<td>IBKR account ID of the advisor/broker client account which request is being submitted for.</td>
</tr>
<tr class="even">
<td>value</td>
<td>true<br />
false</td>
<td>true: Enable service<br />
false: Disable Service</td>
</tr>
<tr class="odd">
<td>type</td>
<td>LiteExecution</td>
<td>Configuration type</td>
</tr>
</tbody>
</table>

###### Example

``` wp-block-code
PATCH /gw/api/v1/accounts

{
    "accountManagementRequests": {
        "accountConfiguration" : 
            {
                "accountId" : "U12345",
                "type" : "LiteExecution",
                "value" : "true"
            }   
        
    }
}
```

##### accreditedInvestor

Update Investor Category for existing account.

  - Individual/Joint/IRA accounts with a net worth of at least $1,000,000 are identified as an Accredited Investor.
  - Accredited Investors can update their investor category to Qualified Purchaser or Eligible Contract Participant within IBKR Portal IF their ` netWorth  `\> 5M USD or equivalent. 

[More Information](https://www.ibkrguides.com/advisorportal/investorcategory.htm?cid=67cc40e3-b273-47c2-abe3-bb0abed6f201)

###### Schema

<table>
<colgroup>
<col style="width: 33%" />
<col style="width: 33%" />
<col style="width: 33%" />
</colgroup>
<thead>
<tr class="header">
<th>Code</th>
<th>Usage</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td>accountId</td>
<td>String</td>
<td>IBKR account ID of the advisor/broker client account which the Investor Category is being changed for.</td>
</tr>
<tr class="even">
<td>signedBy</td>
<td>String</td>
<td>Signature of the Account Holder. <code>signedBy</code> should be First Name + Middle Initial (If Applicable) + Last Name + Suffix (If Applicable). Data is case and case sensitive.</td>
</tr>
<tr class="odd">
<td>status</td>
<td>true<br />
false </td>
<td>true= Yes<br />
Fales = No</td>
</tr>
<tr class="even">
<td>accreditedInvestor</td>
<td>Required</td>
<td>The answers you provided in your account application indicate that you are qualified as an accredited Investor (as defined in Rule 501(a) of Regulation D of the Securities Act of 1933).</td>
</tr>
<tr class="odd">
<td>qualifiedPurchaser</td>
<td>Optional</td>
<td>qualifiedPurchaser:  You may be qualified as a Qualified Purchaser (as defined in Section 2(a)(51) of the Investment Company Act of 1940), which would allow you to participate in certain special programs.
<p>Would you like to answer a few questions so Interactive Brokers can determine if you may qualify as an ECP? YES/NO</p></td>
</tr>
<tr class="even">
<td>investmentCompanyAct</td>
<td>Required if qualifiedPurchaser=true</td>
<td>Are you a natural person who owns at least $5,000,000 in investments (as defined in Rule 2a51-1 under the Investment Company Act of 1940)?YES/NO</td>
</tr>
<tr class="odd">
<td>discretionaryBasis</td>
<td>Required if qualifiedPurchaser=true</td>
<td>Are you a natural person who is acting for his own account or the accounts of other qualified purchasers and who in the aggregate owns and invests on a <code>discretionaryBasis</code> at least $25,000,000 in investments? YES/NO</td>
</tr>
<tr class="even">
<td>eligibleContractParticipant</td>
<td>Optional</td>
<td>Eligible Contract Participant United States regulations impose restrictions on customers who are not Eligible Contract Participants (ECPs) (as defined in Section 1a(12) of the Commodity Exchange Act), which may limit your trading. Click here to learn more about the benefits of being an ECP.
<p>The answers you provided in your account application indicate that you may qualify as an ECP. YES/NO</p></td>
</tr>
<tr class="odd">
<td>discretionaryBasis</td>
<td>Required if EligibleContractParticipant = True</td>
<td>Are you an individual, acting for your own account, who has more than $10,000,000 invested on a discretionary basis? YES/NO</td>
</tr>
<tr class="even">
<td>highRisk</td>
<td>Required if discretionaryBasis= False</td>
<td>Are you an individual, acting for your own account, who has invested more than $5,000,000 on a discretionary basis and your transaction activity is intended to hedge the risk of other assets you have (or that you are reasonably likely to have)? YES/NO</td>
</tr>
</tbody>
</table>

###### Example

``` wp-block-code
PATCH /gw/api/v1/accounts

{
  "accountManagementRequests": {
    "accreditedInvestor": 
        {
            "accountId": "U12345",
            "status": true,
            "signedBy": 
                "Test Test"
            
"qualifiedPurchaser": {
                "status": true,
                "qualifiedPurchaserDetails": 
                    {
                        "code": "InvestmentCompanyAct",
                        "status": true
                    },
                    {
                        "code": "DiscretionaryBasis",
                        "status": true
                    }
             
            },
            "eligibleContractParticipant": {
                "status": true,
                "eligibleContractParticipantDetails": [
                    {
                        "code": "HighRisk",
                        "status": true
                    },
                    {
                        "code": "DiscretionaryBasis",
                        "status": false
                    }
                
            }
        }
    
  }
}
```

##### addCLPCapability

Add CLP capabilities for an existing account.

  - Add CLP (Complex Leverage Product) capabilities to an existing account.

###### Schema

| Name      | Type   | Description                                                                                |
| --------- | ------ | ------------------------------------------------------------------------------------------ |
| accountId | String | IBKR account ID of the advisor/broker client account which request is being submitted for. |

###### Example for Non-Disclosed

``` wp-block-code
PATCH /gw/api/v1/accounts

{
    "accountManagementRequests": {
        "addCLPCapability" : 
            {
                "accountId" : "U12345"
            }   
        
    }
}
```

###### Example for Fully-Disclosed and Advisor

#### Validations for Fully-Disclosed and Advisor-Clients

1.  The account holder must be presented with the required form AND sign the required form before the counterparty submits the request to IBKR.
      - 4155: Risk Disclosure for Complex or Leveraged Exch-Traded Products
2.  Eligibility is validated against users age, Investment Experience, and Financial Information.
3.  For Fully-Disclosed clients; the account holder must have a minimum of two years trading experience with stocks AND either options or futures.

**Futures**

  - 1 year, 1-10 Trades per year
      - This will not validate
      - Because client has less than two years trading Futures, client must take Futures Exam
  - 2 years, 1-10 Trades per year
      - This will validate if Knowledge level is Good or Extensive
      - Will not validate if Knowledge Level is Limited

**Options**

  - 1 year, 1-10 Trades per year
      - This will not validate
      - Because client has less than two years trading Options, client must take Options Exam
  - 2 years, 1-10 Trades per year
      - This will validate if Knowledge level is Good or Extensive
      - Will not validate if Knowledge Level is Limited

##### addLevFxCapability

Add Leverage Forex Capabilities to existing account.

By default, all clients have access to currency conversion. Leveraged FX allows you to trade currency pairs with leverage. With leveraged FX, you are able to trade larger position sizes with a smaller amount of margin. Leveraged FX trading to eligible clients.

###### Schema

| Name      | Type   | Description                                                                                |
| --------- | ------ | ------------------------------------------------------------------------------------------ |
| accountId | String | IBKR account ID of the advisor/broker client account which request is being submitted for. |

###### Example

``` wp-block-code
PATCH /gw/api/v1/accounts

{
    "accountManagementRequests": {
        "addLevFxCapability" : 
            {
                "accountId" : "U12345"
            }   
        
    }
}
```

##### addTradingPermissions

Add Trade Permissions for existing account.

Add trading permissions to an opened account.

**Processing Time:**

  - New Regions: Trade Permissions for new regions are effective immediately

<!-- end list -->

  - New Products: New Products take 1-2 business day to be processed and reviewed by our compliance team.

###### Schema

| Name                  | Type                                                                                                                                   | Description                                                                                |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| addTradingPermissions | Array of Objects [tradingPermissions](https://www.interactivebrokers.com/campus/ibkr-api-page/web-api-account-management/#accounts-27) | Trading permissions which are being requested.                                             |
| accountId             | String                                                                                                                                 | IBKR account ID of the advisor/broker client account which request is being submitted for. |

###### Example For Non-Disclosed

``` wp-block-code
PATCH /gw/api/v1/accounts

{
    "accountManagementRequests": {
        "addTradingPermissions": 
            {
                "tradingPermissions": [
                    {
                        "country": "BELGIUM",
                        "product": "STOCKS"
                    }
                ],
                    "accountId": "U1234",
            }
        
    }
}
```

###### Example For Fully-Disclosed and Advisor

``` wp-block-code
PATCH /gw/api/v1/accounts

{
    "accountManagementRequests": {
        "addTradingPermissions": 
            {
                "tradingPermissions": [
                    {
                        "country": "BELGIUM",
                        "product": "STOCKS"
                    }
                ],
                "documentSubmission": {
                    "documents": [],
                    "accountId": "U1234",
                    "inputLanguage": "en",
                    "translation": false
                },
                    "accountId": "U1234",
            }
        
    }
}
```

Disclaimer: For Fully-Disclosed and Advisor-Clients

  - If the exchange\_group requires a form, the request to AddTradePermissions must be initiated by the client.
  - The account holder must be presented with the required form AND sign the required form before the counterparty submits the request to IBKR.
  - If the trading bundle does not require a form, you can submit to IBKR directly as the client does not need to sign a disclosure.

##### applyFeeTemplate

Assign a predefined fee template to an existing account.

  - For broker clients, fee changes submitted before 17:00 ET are processed on the same day and will take effect starting from midnight on the following business day.
  - For advisor-clients, if the fee is increased or fee type is changed, the client will need to verify/acknowledge the fee increase directly in Account Management/Client Portal.
      - Fee templates acknowledged by the client prior to 5:45PM ET will be processed on the same day.
      - Fee templates acknowledged by the client after 5:45PM ET will be processed on the following business day.
      - If the fee is decreased, the fee will be automatically processed (no client acknowledgement is needed).

###### Schema

| Name         | Type   | Description                                                                                                                                                                                                                                                                                                   |
| ------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| templateName | String | Name of the fee template being applied. Data is case and space sensitive. The `templateName` must match the name of the template which was previously created in the advisor/broker portal. [Details](https://www.ibkrguides.com/advisorportal/homemenu/configclientfeetemplate.htm?Highlight=fee%20template) |
| accountId    | String | IBKR account ID of the advisor/broker client account which request is being submitted for.                                                                                                                                                                                                                    |

###### Example

``` wp-block-code
PATCH /gw/api/v1/accounts
 {
  "accountManagementRequests": {
   "applyFeeTemplate": {
      "accountId": "U10032411",
      "templateName": "FeePerTradeUnit100"
    }
  }
}
```

##### changeBaseCurrency

Change base currency for existing account.

Update the base currency for an opened account. Base currency requests will not be effective until the following business day.

###### Schema

| Name                | Type                                                                                                                                   | Description                                                                                |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| accountId           | String                                                                                                                                 | IBKR account ID of the advisor/broker client account which request is being submitted for. |
| new\_base\_currency | Currency code (3 digits). Available currencies can be found [here](https://www.interactivebrokers.com/en/support/fund-my-account.php). | New base currency for the account.                                                         |

###### Example

``` wp-block-code
PATCH /gw/api/v1/accounts

{
    "accountManagementRequests": {
        "changeBaseCurrency": {
            "accountId": "U12345",
            "newBaseCurrency": "USD"
        }
    }
}
```

##### changeFinancialInformation

Update financial information, investment objectives, investment experience, and sources of wealth.

  - Used to update and increase Investment Experience, Investment Objectives, and/or Financial Information for existing accounts.
      - The service cannot be used to downgrade the knowledge level.
  - **Processing Time**
      - Fully-Disclosed and Advisor Clients: Takes 1-2 business day to be processed and reviewed by our compliance team.

###### Schema

<table>
<colgroup>
<col style="width: 33%" />
<col style="width: 33%" />
<col style="width: 33%" />
</colgroup>
<thead>
<tr class="header">
<th>Name</th>
<th>Type</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td>accountId</td>
<td>String</td>
<td>IBKR account ID of the advisor/broker client account which request is being submitted for.</td>
</tr>
<tr class="even">
<td>newFinancialInformation</td>
<td>Array of objects <a href="https://www.interactivebrokers.com/campus/ibkr-api-page/web-api-account-management/#accounts-26">financialInformation<br />
investmentExperience<br />
</a><a href="https://www.interactivebrokers.com/campus/ibkr-api-page/web-api-account-management/#accounts-27">investmentObjectives</a><br />
<a href="https://www.interactivebrokers.com/campus/ibkr-api-page/web-api-account-management/#accounts-26">sourcesOfWealth</a></td>
<td>Provide updated information.</td>
</tr>
</tbody>
</table>

###### Example

``` wp-block-code
PATCH /gw/api/v1/accounts

{
    "accountManagementRequests": {
    "changeFinancialInformation": [
        {
          "accountId": "U12345",
          "newFinancialInformation": {
            "investmentExperience": [
              {
                "assetClass": "BILL",
                "yearsTrading": 2,
                "tradesPerYear": 5,
                "knowledgeLevel": "Extensive"
              }
            ],
            "investmentObjectives": [
              "Trading",
              "Growth",
              "Speculation",
              "Hedging",
              "Preservation",
              "Income"
            ],
            "additionalSourcesOfIncome": [
                {
                    "sourceType": "CONSULTING",
                    "percentage": 4,
                    "description": "from Spouse"
                },
                {
                    "sourceType": "INHERITANCE",
                    "percentage": 10,
                    "description": "father property"
                }
            ],
            "sourcesOfWealth": [
                {
                    "sourceType": "SOW-IND-Allowance",
                    "percentage": 25,
                    "usedForFunds": false,
                    "description": "Allowance from spouse"
                },
                {
                    "sourceType": "SOW-IND-Disability",
                    "percentage": 50,
                    "usedForFunds": false,
                    "description": "Allowance from spouse"
                },
                {
                    "sourceType": "SOW-IND-Inheritance",
                    "percentage": 23,
                    "usedForFunds": true,
                    "description": "Allowance from spouse"
                }
            ],
            "netWorth": 1700000,
            "liquidNetWorth": 120000,
            "annualNetIncome": 210000,
            "totalAssets": 173000,
            "sourceOfFunds": "string",
            "translated": false
          }
        }
      ]
    }
}
```

##### changeMarginType

Upgrade margin type for existing account

Upgrade margin capabilities for an existing account.

  - Cash accounts can upgrade to a Margin account.
  - To upgrade to a Portfolio Margin account, you must be approved to trade options and your account must have at least USD 110,000 (or USD equivalent) in Net Liquidation Value.

<!-- end list -->

  - **Processing Time**
      - Upgrade requests can take 1-2 business day to be processed and reviewed by our compliance team.

###### Schema

<table>
<colgroup>
<col style="width: 33%" />
<col style="width: 33%" />
<col style="width: 33%" />
</colgroup>
<thead>
<tr class="header">
<th>Name</th>
<th>Type</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td>accountId</td>
<td>String</td>
<td>IBKR account ID of the advisor/broker client account which request is being submitted for.</td>
</tr>
<tr class="even">
<td>newMargin</td>
<td>RegT<br />
REGT<br />
PortfolioMargin<br />
PORTFOLIOMARGIN</td>
<td><strong>Portfolio Margin:</strong> Risk Based Model and can offer anywhere from a 6:1 leverage for a diverse portfolio; and down to a 3:1 leverage for a more concentrated portfolio.
<p>Minimum Equity: $100,000</p>
<p>If the account falls below $100,000 the account will be in close only mode. </p>
<p><strong>RegT:</strong> Rule based margin and offers 4:1 leverage intraday and 2:1 leverage overnight. Minimum Equity: $2,000 </p></td>
</tr>
</tbody>
</table>

###### Example For Non-Disclosed

``` wp-block-code
PATCH /gw/api/v1/accounts

{
    "accountManagementRequests": {
        "changeMarginType": {
            "accountId": "U12345",
            "newMargin": "Margin"
        }
    }
}
```

###### Example for Fully-Disclosed and Advisor Clients

``` wp-block-code
PATCH /gw/api/v1/accounts

{
    "accountManagementRequests": {
        "changeMarginType": {
            "documentSubmission": {
                "documents": {
                    "signedBy": "John Smith",
                    "validAddress": true,
                    "execTimestamp": 10,
                    "documentType": "Certified Proof of Address",
                    "expirationDate": "2033-11-22"
                },
                "accountId": "U12345",
                "inputLanguage": "en",
                "translation": false
            },
            "accountId": "U12345",
            "newMargin": "xMargin"
        }
    }
}
```

Disclaimer: For Fully-Disclosed and Advisor-Clients

  - The account holder must be presented with the required form AND sign the required form before the counterparty submits the request to IBKR.

##### enrollInDrip

Enroll in Dividend Reinvestment Program.

Dividend reinvestment (DRIP) is an option where you can elect how you wish to receive your dividends for stocks and mutual funds. Dividend Reinvestment is available to IB LLC, IB AU, IB CAN, IB HK, IB IE, IB JP, IB SG and IB UK clients only.

Information on DRIP can be found [here](https://www.ibkrguides.com/clientportal/dividendreinvestment.htm).

###### Schema

| Name      | Type   | Description                                                                                |
| --------- | ------ | ------------------------------------------------------------------------------------------ |
| accountId | String | IBKR account ID of the advisor/broker client account which request is being submitted for. |

###### Example

``` wp-block-code
PATCH /gw/api/v1/accounts

{
    "accountManagementRequests":{
        "enrollInDrip":{
            "accountId": "U12345",
        }
    }
}
```

Disclaimer: For Fully-Disclosed and Advisor-Clients

  - The account holder must be presented with the required form AND sign the required form before the counterparty submits the request to IBKR.

##### leaveDrip

Unenroll in Dividend Reinvestment Program.

###### Schema

| Name      | Type   | Description                                                                                |
| --------- | ------ | ------------------------------------------------------------------------------------------ |
| accountId | String | IBKR account ID of the advisor/broker client account which request is being submitted for. |

###### Example

``` wp-block-code
PATCH /gw/api/v1/accounts

{
    "accountManagementRequests":{
        "leaveDrip":{
            "accountId": "U12345",
        }
    }
}
```

##### enrollInSyep

Enroll in Stock Yield Enhancement Program.

  - **Processing Time**
      - Requests submitted prior to 5pm EST will be processed same day.
      - Requests submitted after 5pm EST will be processed the following business day.
      - Users must wait 90 days from previous unenrollment date before re-enrolling.

###### Schema

| Name      | Type   | Description                                                                                |
| --------- | ------ | ------------------------------------------------------------------------------------------ |
| accountId | String | IBKR account ID of the advisor/broker client account which request is being submitted for. |

###### Example

``` wp-block-code
PATCH /gw/api/v1/accounts

{
    "accountManagementRequests":{
        "enrollInSyep":{
            "accountId": "U12345",
        }
    }
}
```

##### leaveSyep

Unenroll in Stock Yield Enhancement Program.

  - **Processing Time**
      - Requests submitted prior to 5pm EST will be processed same day.
      - Requests submitted after 5pm EST will be processed the following business day.
      - Users must wait 90 days from previous unenrollment date before re-enrolling.

###### Schema

| Name      | Type   | Description                                                                                |
| --------- | ------ | ------------------------------------------------------------------------------------------ |
| accountId | String | IBKR account ID of the advisor/broker client account which request is being submitted for. |

###### Example

``` wp-block-code
PATCH /gw/api/v1/accounts

{
    "accountManagementRequests":{
        "leaveSyep":{
            "accountId": "U12345",
        }
    }
}
```

##### removeTradingPermissions

Remove Trade Permissions for existing account

  - **Processing Time**
      - Requests submitted prior to 5pm EST will be processed same day.
      - Requests submitted after 5pm EST will be processed the following business day.

###### Schema

| Name              | Type                                                                                                                                   | Description                                                                                |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| tradingPermission | Array of Objects [tradingPermissions](https://www.interactivebrokers.com/campus/ibkr-api-page/web-api-account-management/#accounts-27) | Trading permissions to be removed.                                                         |
| accountId         | String                                                                                                                                 | IBKR account ID of the advisor/broker client account which request is being submitted for. |

###### Example

``` wp-block-code
PATCH /gw/api/v1/accounts
{
    "accountManagementRequests": {
        "removeTradingPermissions": [
            {
                "tradingPermissions": [
                    {
                        "assetClass": "STK",
                        "exchangeGroup": "EU-IBET",
                        "country": "BELGIUM",
                        "product": "STOCKS"
                    }
                ]
                "accountId":"U123456"
            }
        ]
    }
}
```

##### updateAccountAlias

Update account alias for existing account.

Account alias will appear on account statements, portal, and TWS.

  - **Processing Time:** Changes will be effective immediately. You will need to restart TWS OR Portal to view the new alias.

###### Schema

<table>
<colgroup>
<col style="width: 33%" />
<col style="width: 33%" />
<col style="width: 33%" />
</colgroup>
<thead>
<tr class="header">
<th>Name</th>
<th>Type</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td>accountId</td>
<td>String</td>
<td>IBKR account ID of the advisor/broker client account which request is being submitted for.</td>
</tr>
<tr class="even">
<td>accountAlias</td>
<td>String<br />
Max # of characters: 80 </td>
<td>Account alias or Nickname  </td>
</tr>
</tbody>
</table>

###### Example

``` wp-block-code
PATCH /gw/api/v1/accounts

{
    "accountManagementRequests": {
        "updateAccountAlias": [
            {
                "accountId": "U12345",
                "accountAlias": "U111"
            }
        ]
    }
}
```

##### UpdateAccountRepresentatives

Assign master user access to the account.

###### Schema

| Name             | Type   | Description                                                                                                              |
| ---------------- | ------ | ------------------------------------------------------------------------------------------------------------------------ |
| accountId        | String | IBKR account ID of the advisor/broker client account which request is being submitted for.                               |
| representativeId | String | IBKR username of the account representative. User must be listed on the master account which account is associated with. |
| percentage       | Number | Total percentage across all representatives should add up to 100%.                                                       |

###### Example

``` wp-block-code
PATCH /gw/api/v1/accounts

{
  "accountManagementRequests": {
    "updateAccountRepresentatives": [
        {
            "accountId": "U12345",
            "representativeDetails": [
                {
                    "representativeId": "ajd0318a",
                    "percentage": 100
                }
            ]
        }
    ]
  }
}
```

##### updateBcan

Generate BCAN for a Non-Disclosed IB-HK client account.

SFC regulation requires clients under IBHK with trading permissions to SEHK stocks OR bonds to provide BCAN.

  - Only applicable for Non Disclosed (QI and NonQI) – All Customer Types.

###### Schema

<table>
<colgroup>
<col style="width: 33%" />
<col style="width: 33%" />
<col style="width: 33%" />
</colgroup>
<thead>
<tr class="header">
<th>Name</th>
<th>Type</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td>accountId</td>
<td>String</td>
<td>IBKR account ID of the advisor/broker client account which request is being submitted for.</td>
</tr>
<tr class="even">
<td>bcan</td>
<td>String</td>
<td>Broker-to-Client-Assigned-Number (bcan).<br />
– It must be 10 digits or less without leading 0 and it cannot be 1-99.</td>
</tr>
<tr class="odd">
<td>ceNumber</td>
<td>String</td>
<td>Central entity number (CE#) of broker. It must be 6 digit alphanumeric identifier.</td>
</tr>
</tbody>
</table>

###### Example

``` wp-block-code
PATCH /gw/api/v1/accounts

{
  "accountManagementRequests": {
    "updateBcan": [
        {
            "accountId": "U12345",
            "bcan": "1125",
            "ceNumber": "BNO808"
        }
    ]
  }
}
```

##### updateExternalId

Update external ID associated with the account.

###### Schema

| Name          | Type   | Description                                                                                |
| ------------- | ------ | ------------------------------------------------------------------------------------------ |
| accountId     | String | IBKR account ID of the advisor/broker client account which request is being submitted for. |
| newExternalId | String | New external ID to be assigned to the account.                                             |

###### Example

``` wp-block-code
PATCH /gw/api/v1/accounts

{
    "accountManagementRequests": {
        "updateExternalId" : 
            {
                "accountId" : "U12345",
                "newExternalId" : "Test1234"            }   
        
    }
}
```

##### updatePropertyProfile

Update property profile for the account.

Service is available by request only. To use this service, please contact am-api@interactivebrokers.com.

###### Schema

| Name            | Type   | Description                                                                                |
| --------------- | ------ | ------------------------------------------------------------------------------------------ |
| accountId       | String | IBKR account ID of the advisor/broker client account which request is being submitted for. |
| propertyProfile | String | Name of property being assigned.                                                           |

###### Example

``` wp-block-code
PATCH /gw/api/v1/accounts

{
    "accountManagementRequests": {
        "updatePropertyProfile" : 
            {
                "accountId" : "U12345",
                "propertyProfile" : "Standard"            }   
        
    }
}
```

##### updateUserAccessRights

Manage account access for master users that have ‘sub specific’ access rights.

Manage account access to users associated with the master account.

  - Only applicable if the user is configured as ‘Specific Sub Accounts’ for the UAR

<!-- end list -->

  - This service will allow advisors/brokers to add/remove account access for users at master level that have access to ‘Specific Sub Accounts’

###### Schema

<table>
<colgroup>
<col style="width: 33%" />
<col style="width: 33%" />
<col style="width: 33%" />
</colgroup>
<thead>
<tr class="header">
<th>Name</th>
<th>Type</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td>accountId</td>
<td>String</td>
<td>IBKR account ID of the advisor/broker client account which request is being submitted for.</td>
</tr>
<tr class="even">
<td>action</td>
<td>ADD<br />
REMOVE</td>
<td>ADD=User will have access to the given account.<br />
REMOVE= User will no longer have access to the given account.</td>
</tr>
<tr class="odd">
<td>repId</td>
<td>String</td>
<td>User ID which account access is being updated for. This should be user ID associated with the master account.</td>
</tr>
</tbody>
</table>

###### Example

``` wp-block-code
PATCH /gw/api/v1/accounts

{
  "accountManagementRequests": {
    "updateUserAccessRights": [
        {
            "accountId": "U12345",
            "repId": "potest123",
            "action": "ADD"
        }
    ]
  }
}
```

## Client Fees

IBKR provides ability for advisors and brokers to charge fee for their services. Advisors/brokers can configure fees on an account by account basis OR manage fees using a client fee template. Client fees can be set during client registration journey and updated/ The fee schedule will be defined within `accounts`.

  - Advisor Managed: Fee schedule needs to be defined during client registration using `advisorWrapFees` OR `feesTemplateName`.
  - Broker Clients: `feesTemplateName` is optional. If no fee template is set during registration, the default client fee template will automatically apply to that account.

Fee configurations are effective starting effective date. The effective date for client fees can be obtained by calling [`/api/v1/accounts/{{accountId}}/details`](https://www.interactivebrokers.com/campus/ibkr-api-page/webapi-ref-staging/#tag/Account-Management-Accounts/paths/~1gw~1api~1v1~1accounts~1%7BaccountId%7D~1details/get)

  - If the account opening date is after the effective date, the fee configurations are effective 1 day after the open date.
  - If the request approval date is after the effective date, the fee configurations are effective 1 day after the request approval date.
  - Fee computations will not exist until effectiveDate (based on above bullet points) & the account is funded.

## Fee Templates

The API can be used to view and manage fee templates for existing accounts.

  - Client fee templates make it easy to maintain client fee schedule for multiple accounts. Fee templates can be created and updated directly within Portal \> Administration & Tools \> Fees & Invoicing \> Fee Templates.
      - [Advisor Fees](https://ibkrguides.com/advisorportal/homemenu/feesandinvoicing.htm)
      - [Brokers](https://ibkrguides.com/brokerportal/homemenu/feesandinvoicing.htm)

### Set Fee Template for Existing Account

The `applyFeeTemplate` can be used to assign a predefined fee template to an existing account. Within the body of the request, define the `accountId` and the `templateName`. The `templateName` represents name of fee template to be applied, the data is case sensitive and must match exact name of template that exists in portal.

  - For broker clients, fee changes submitted before 17:00 ET are processed on the same day and will take effect starting from midnight on the following business day.
  - For advisor-clients, if the fee is increased or fee type is changed, the client will need to verify/acknowledge the fee increase directly in Account Management/Client Portal.
      - Fee templates acknowledged by the client prior to 5:45PM ET will be processed on the same day.
      - Fee templates acknowledged by the client after 5:45PM ET will be processed on the following business day.
      - If the fee is decreased, the fee will be automatically processed (no client acknowledgement is needed).

###### Example

``` wp-block-code
PATCH /gw/api/v1/accounts
 {
  "accountManagementRequests": {
   "applyFeeTemplate": {
      "accountId": "U10032411",
      "templateName": "FeePerTradeUnit100"
    }
  }
}
```

## Login Messages

If client action is required post account creation, IBKR will assign a login message to the user. Once login message is assigned, user will be prompted to complete login message upon accessing IBKR Portal.

Scenarios which IBKR will assign a login message:

  - Expired tax form
  - Update CRS form
  - Verify Account Information
  - Email Bounced

The following login messages can be completed using the API:

  - ACK\_AGREEMENT\_UPDATE (Use [`DocumentSubmission`](https://www.interactivebrokers.com/campus/ibkr-api-page/web-api-account-management/#complete-registration-tasks))
  - W8INFO (Use [`UpdateTaxForm`](https://www.interactivebrokers.com/campus/ibkr-api-page/web-api-account-management/#complete-registration-tasks))
  - LLC\_AGREEMENT\_UPDATE (Use [`DocumentSubmission`](https://www.interactivebrokers.com/campus/ibkr-api-page/web-api-account-management/#complete-registration-tasks))

All other login messages will need to be completed within IBKR Portal (not via API).

### View Login Messages by Account

The `/gw/api/v1/accounts/{accountId}/login-messages` can be used to view login messages assigned to a specific account.

### View Login Messages for Group of Accounts

[`/gw/api/v1/accounts/login-messages`](https://www.interactivebrokers.com/campus/ibkr-api-page/webapi-ref/#tag/Account-Management-Accounts/paths/~1gw~1api~1v1~1accounts~1%7BaccountId%7D~1login-messages/get) can be used to filter list of accounts with login messages assigned.

  - Filter list of accounts with specific login message assigned.
  - Filter list of accounts created within certain time range.

<table>
<colgroup>
<col style="width: 33%" />
<col style="width: 33%" />
<col style="width: 33%" />
</colgroup>
<thead>
<tr class="header">
<th>Name</th>
<th>Value</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td>startDate</td>
<td>yyyy-mm-dd</td>
<td>Required if querying list of accounts created within certain time period.</td>
</tr>
<tr class="even">
<td>endDate</td>
<td>yyyy-mm-dd</td>
<td>Filter by date when account was created. If start date is provided, end date is mandatory</td>
</tr>
<tr class="odd">
<td>messageType</td>
<td>W8INFO<br />
MIFIR_INFO<br />
ACK_AGREEMENT_UPDATE<br />
LLC_AGREEMENT_UPDATE</td>
<td>W8INFO (Expired Tax Form)<br />
MIFIR_INFO (MIFIR Data Required)
<p>Optional- used to filter by Login Message Type</p></td>
</tr>
</tbody>
</table>

Queries returning more than 10,000 results will trigger a timeout error, Implement pagination using ‘`limit`‘ and ‘`offset`‘ parameter to manage large result sets.

## Funds and Banking

When submitting a funding requests using the API, a `clientInstructionId` will be set within body of the request. The `clientInstructionId `is a unique identifier associated with the request which is set by the hosting firm; this value cannot be reused. IBKR’s preference is that the **clientInstructionId **is established in sequential order ie 1, 2, 3, 4  or 100, 101, 102, 103 not 777, 589, 123. The maximum value is 20 digits.

### Status of Request

IBKR returns response within 30 seconds of funding request being submitted. The response will return one of the following status’

  - `PROCESSED`: Request has been processed.
  - `PENDING`: Pending Processing
  - `REJECTED`: IBKR unable to process the request.

The `/gw/api/v1/client-instructions/{clientInstructionId}` endpoint can be used to poll for status of previously uploaded funding request based on the `clientInstructionId` associated with the request.

### Cancel Request

Cancel transaction that is currently in a ` PENDING  `status, this includes active recurring transaction that are scheduled for future date. The `/gw/api/v1/instructions/cancel` can be used to cancel a transaction; within the body of the request, include the ` instructionId  `that is associated with request that needs to be canceled.

###### Example

<table>
<colgroup>
<col style="width: 33%" />
<col style="width: 33%" />
<col style="width: 33%" />
</colgroup>
<thead>
<tr class="header">
<th>Name</th>
<th>Type</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td>instructionId</td>
<td>String</td>
<td>IB instruction ID of the request that needs to be canceled.</td>
</tr>
<tr class="even">
<td>reason</td>
<td>String</td>
<td>Reason for canceling the request.</td>
</tr>
<tr class="odd">
<td>clientInstructionId</td>
<td>Number; max characters 20.</td>
<td>Unique identifier associated with the request.<br />
– The <strong>clientInstructionId </strong>cannot be reused.<br />
– IBKR’s preference is that the <strong>clientInstructionId </strong>is established in sequential order ie 1, 2, 3, 4  or 100, 101, 102, 103 not 777, 589, 123.</td>
</tr>
</tbody>
</table>

``` wp-block-code
POST /gw/api/v1/instructions/cancel

{
  "intructionType": "CANCEL_INSTRUCTION",
  "instruction": {
    "clientInstructionId": "12001810",
    "instructionId": 43085477,
    "reason": "Testing"
  }
}
```

### Get Transaction History

The `/gw/api/v1/instructions/query` endpoint can be used to view information about historical transactions including cash deposits, cash withdrawals, inbound and outbound position transfers and internal transfers by `accountId`. The `daysToGoBack` attribute will be used to set lookback period and can be maximum of 7 days. Optionally, include `transactionType` to filter for a specific transaction.

**Rate Limit**: 1 request per 10 minutes.

###### Example

``` wp-block-code
POST /gw/api/v1/instructions/query

{
  "instructionType": "QUERY_RECENT_INSTRUCTIONS",
  "instruction": {
    "clientInstructionId": "7009001",
    "accountId": "U139838",
    "transactionHistory": {
      "daysToGoBack": 3
    }
  }
}
```

### Available Cash for Withdrawal

The `/gw/api/v1/external-cash-transfers/query` can be used to view the available cash for withdrawal with and without margin loan based on an `accountId` **AND** `currency`. For non-disclosed clients, this endpoint will return available cash to transfer between master and sub account.

Response will return following values:

  - `withdrawableAmount`: Cash Amount available for withdrawal (assuming margin loan). Only applicable for Fully-Disclosed and Advisor Clients.
  - `withdrawableAmountNoBorrow`: Cash Amount available for withdrawal (without margin loan). Only applicable for Fully-Disclosed and Advisor Clients.
  - `allowedTransferAmountToMaster`: Allowed Transfer Amount to Master assuming margin loan. Only applicable for Non-Disclosed Clients.
  - `allowedTransferAmountToMasterNoBorrow`: Allowed Transfer Amount(no\_borrow) to Master. Only applicable for Non-Disclosed Clients.
  - `withdrawableBalanceWithoutOriginHold`: The amount available for withdrawal without origination hold.

###### Example

``` wp-block-code
POST /gw/api/v1/external-cash-transfers/query

{
  "instructionType": "QUERY_WITHDRAWABLE_FUNDS",
  "instruction": {
    "clientInstructionId": "7009005",
    "accountId": "U87440",
    "currency": "USD"
  }
}
```

## Bank Instructions

In this section we will review how to create, view, and delete banking instructions using the Web API. Please be advised options available using the API are limited in comparison to methods that are supported using the IBKR Hosted Application.

### Add Bank Instructions

The `/gw/api/v1/bank-instructions` endpoint can be used to add banking instructions to an existing IBKR brokerage account. The banking instructions can be used to facilitate future fund transfers.

###### ACH\_INSTRUCTION

Create bank instructions for Automated Clearing House (ACH) transfer initiated by IBKR.

1.  Counterparty will provide bank account information to IBKR (ach\_instruction).
2.  IBKR will provide a real-time response including a unique IBKR **id** and PENDING status.
3.  IBKR verifies the ACH instruction using JPM’s Account Validation Service (AVS) which leverages EWS’ PaymentChek and Account Ownership Authentication services as a data source.
      - Verification can take anywhere from 7-15 minutes.
      - Notification will be sent via [/callback](https://www.interactivebrokers.com/campus/ibkr-api-page/webapi-ref-staging/#tag/Account-Management-Accounts/paths/~1gw~1api~1v1~1accounts~1%7BaccountId%7D~1login-messages/get) once verification has been completed. Optionally, poll for status using [/gw/api/v1/client-instructions/{clientInstructionId}](https://www.interactivebrokers.com/campus/ibkr-api-page/webapi-ref/#tag/Account-Management-Banking/paths/~1gw~1api~1v1~1instruction-sets~1%7BinstructionSetId%7D/get) endpoint.
4.  Once verification has been completed, status will be updated to reflect one of:
      - **PROCESSED:** ACH Instruction was processed. The ACH instructions can be used for [DEPOSIT](https://www.interactivebrokers.com/campus/ibkr-api-page/web-api-account-management/#cash-transfer-17) and [WITHDRAWAL](https://www.interactivebrokers.com/campus/ibkr-api-page/web-api-account-management/#cash-transfer-17) using the Web API or IBKR Portal (Transfer & Pay).
      - **PENDING**: EWS Verification is in progress.
      - **PENDING\_VERIFICATION:** IBKR automatically sends micro amount to the bank account provided. Counterparty will need to submit micro amounts to IBKR using `"instructionType":"TRADITIONAL_BANK_INSTRUCTION_VERIFICATION"`
      - Once this step has been complete, the status will be updated to PROCESSED. The banking instructions can be used to submit [deposits](https://www.www.interactivebrokers.com/campus/ibkr-api-page/web-api-account-management/#cash-transfer-17) and [withdrawals](https://www.interactivebrokers.com/campus/ibkr-api-page/web-api-account-management/#cash-transfer-17) using the Web API or IBKR Portal (Transfer & Pay).
      - **REJECTED : **Instruction cannot be verified using EWS. To proceed with ACH, client will need to log into the IBKR Portal to add instructions via IBKR hosted Portal. Optionally, the user can use different funding method will need to be used.

###### Schema

<table>
<colgroup>
<col style="width: 33%" />
<col style="width: 33%" />
<col style="width: 33%" />
</colgroup>
<thead>
<tr class="header">
<th>Name</th>
<th>Type</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td>clientInstructionId</td>
<td>Number; max characters 20.</td>
<td>Unique identifier associated with the request.<br />
– The <strong>clientInstructionId </strong>cannot be reused.<br />
– IBKR’s preference is that the <strong>clientInstructionId </strong>is established in sequential order ie 1, 2, 3, 4  or 100, 101, 102, 103 not 777, 589, 123.</td>
</tr>
<tr class="even">
<td>bankInstructionCode</td>
<td>USACH</td>
<td>Static value and will always be USACH</td>
</tr>
<tr class="odd">
<td>achType</td>
<td>DEBIT_CREDIT<br />
DEBIT<br />
CREDIT</td>
<td>DEBIT_CREDIT: ACH Instructions for deposits and withdrawals.<br />
DEBIT: ACH Instructions for deposits only.<br />
CREDIT: ACH instructions for withdrawals only.</td>
</tr>
<tr class="even">
<td>bankInstructionName</td>
<td>String; max 32 characters</td>
<td>Name of the instructions. This is defined by counterparty.</td>
</tr>
<tr class="odd">
<td>bankName</td>
<td>String</td>
<td>Name of the bank.</td>
</tr>
<tr class="even">
<td>bankRoutingNumber</td>
<td>Numeric value; max 9 characters.</td>
<td>Routing number associated with the bank.</td>
</tr>
<tr class="odd">
<td>bankAccountNumber</td>
<td>String; max 32 characters</td>
<td>Bank account number.</td>
</tr>
<tr class="even">
<td>bankAccountTypeCode</td>
<td>1<br />
2</td>
<td>1: Checking<br />
2: Savings<br />
If unspecified, defaults to checking.</td>
</tr>
<tr class="odd">
<td>currency</td>
<td>USD</td>
<td>Currency of the assets being transferred.  Only supports USD at this time.</td>
</tr>
<tr class="even">
<td>accountId</td>
<td>String; max 32 characters</td>
<td>IBKR account ID associated with the client account.</td>
</tr>
</tbody>
</table>

###### Example

``` wp-block-code
POST /gw/api/v1/bank-instructions

{"instructionType": "ACH_INSTRUCTION",
"instruction": 

{
"clientInstructionId": "1012983",
"bankInstructionCode": "USACH",
"achType": "DEBIT_CREDIT",
"bankInstructionName": "TestInstr",
"currency": "USD",
"accountId": "U223454",
"clientAccountInfo": {
"bankRoutingNumber": "202012983",
"bankAccountNumber": "101267576983",
"bankName": "JPM Chase",
"bankAccountTypeCode": 1
}
}
}
```

###### TRADITIONAL\_BANK\_INSTRUCTION\_VERIFICATION

Verify micro deposits for ACH instructions initiated via Web API.

1.  We use EWS (Early Warning System) to verify ACH Instructions.
2.  Within 1-3 business days, two random credits (deposits) each less than one dollar and a corresponding debit (withdrawal) will be issued to the clients bank account.
3.  Client will need to monitor their bank account for these transactions as they will be needed to confirm this funding instruction. Note that these transactions may take place on different days.
4.  Once the client has these amounts, submit ` traditional_bank_instruction_verification  `request to verify the amounts. Once verified, the client can use ACH instructions for deposit and withdrawal requests.

###### Schema

<table>
<colgroup>
<col style="width: 33%" />
<col style="width: 33%" />
<col style="width: 33%" />
</colgroup>
<thead>
<tr class="header">
<th>Name</th>
<th>Type</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td>clientInstructionId</td>
<td>Number; max characters 20.</td>
<td>Unique identifier associated with the request.<br />
– The <strong>clientInstructionId </strong>cannot be reused.<br />
– IBKR’s preference is that the <strong>clientInstructionId </strong>is established in sequential order ie 1, 2, 3, 4  or 100, 101, 102, 103 not 777, 589, 123.</td>
</tr>
<tr class="even">
<td>pendingInstructionId</td>
<td>number</td>
<td>Instruction id of the pending transaction.</td>
</tr>
<tr class="odd">
<td>bankInstructionName</td>
<td>String; max 32 characters</td>
<td>Name of the banking instructions with IBKR. This should match the <code>bankInstructionName </code>that was provided in the <code>achInstruction </code>request.</td>
</tr>
<tr class="even">
<td>accountId</td>
<td>String; max 32 characters</td>
<td>Client account number at IBKR.</td>
</tr>
<tr class="odd">
<td>bankInstructionCode</td>
<td>ACHUS</td>
<td>Static value and will always be ACHUS</td>
</tr>
<tr class="even">
<td>creditAmount1</td>
<td>number</td>
<td>Cash amount that IBKR credited /debited to bank account. The order which the amounts are send does not matter. 3 attempts are allowed for confirming these credit amounts.</td>
</tr>
<tr class="odd">
<td>creditAmount2</td>
<td>number</td>
<td>Cash amount that IBKR credited /debited to bank account. The order which the amounts are send does not matter. 3 attempts are allowed for confirming these credit amounts.</td>
</tr>
</tbody>
</table>

###### Example

``` wp-block-code
POST /gw/api/v1/bank-instructions

{
"instructionType": "TRADITIONAL_BANK_INSTRUCTION_VERIFICATION",
"instruction": {
"clientInstructionId": 7013057,
"bankInstructionCode": "USACH",
"bankInstructionName": "ACH-Tst1Random172",
"accountId": "U117717",
"pendingInstructionId": 43086786,
"creditAmount1": 0.32,
"creditAmount2": 0.46
}
}
```

###### EDDA\_INSTRUCTION

Create bank instructions for Electronic Direct Debit Authorization (EDDA). EDDA can be used transfer HKD and CNY between Hong Kong bank account and IBKR Brokerage account.

Electronic Direct Debit Authorization, applicable for individuals that maintain Hong Kong bank account.

The ` /gw/api/v1/participating-banks  `endpoint can be used to view list of participating banks which support connection with Interactive Brokers for **`eDDA`** transfers and includes bankClearingCode, BIC and bank name.

###### Schema

<table>
<colgroup>
<col style="width: 33%" />
<col style="width: 33%" />
<col style="width: 33%" />
</colgroup>
<thead>
<tr class="header">
<th>Name</th>
<th>Type</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td>clientInstructionId</td>
<td>Number; max characters 20.</td>
<td>Unique identifier associated with the request.<br />
– The <strong>clientInstructionId </strong>cannot be reused.<br />
– IBKR’s preference is that the <strong>clientInstructionId </strong>is established in sequential order ie 1, 2, 3, 4  or 100, 101, 102, 103 not 777, 589, 123.</td>
</tr>
<tr class="even">
<td>bankInstructionName</td>
<td>String; max 100 characters</td>
<td>Name of the instructions. This is defined by counterparty.</td>
</tr>
<tr class="odd">
<td>accountId</td>
<td>String; max 32 characters</td>
<td>Client account number at IBKR.</td>
</tr>
<tr class="even">
<td>bankBranchCode</td>
<td>String; max 3 characters</td>
<td>Branch code associated with bank.</td>
</tr>
<tr class="odd">
<td>bankAccountNumber</td>
<td>String; max 32 characters</td>
<td>Bank account number.</td>
</tr>
<tr class="even">
<td>bankClearingCode</td>
<td>String; max 3 characters</td>
<td>The bankClearingCode can be obtained using <code>/gw/api/v1/participating-banks</code> endpoint.</td>
</tr>
<tr class="odd">
<td>debtorIdentificationDocumentType</td>
<td>hkid<br />
passport<br />
chinaId<br />
hkMacaoEntryPermit</td>
<td>ID document type</td>
</tr>
</tbody>
</table>

###### Example

``` wp-block-code
POST /gw/api/v1/bank-instructions

{
"instructionType": "EDDA_INSTRUCTION",
"instruction": {
"clientInstructionId": 7012743,
"bankInstructionName": "My EDDA Instructions",
"currency": "CNH",
"accountId": "U8072517",
"bankBranchCode": "003",
"bankAccountNumber": "132456",
"bankClearingCode": "003",
"debtorIdentificationDocumentType": "hkId"
}
```

###### PREDEFINED\_DESTINATION\_INSTRUCTION

Service can be used to create standing bank instruction for withdrawals. Only available if all accounts associated with clientID maintain bank account at the same bank.

1.  Create standing wire instructions.
2.  If all clients have account at a single bank, IB will hard-code the bank on the back-end and only client’s account \# will be submitted to IB.

###### Schema

<table>
<colgroup>
<col style="width: 33%" />
<col style="width: 33%" />
<col style="width: 33%" />
</colgroup>
<thead>
<tr class="header">
<th>Name</th>
<th>Type</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td>clientInstructionId</td>
<td>Number; max characters 20.</td>
<td>Unique identifier associated with the request.<br />
– The <strong>clientInstructionId </strong>cannot be reused.<br />
– IBKR’s preference is that the <strong>clientInstructionId </strong>is established in sequential order ie 1, 2, 3, 4  or 100, 101, 102, 103 not 777, 589, 123.</td>
</tr>
<tr class="even">
<td>bankInstructionName</td>
<td>String; max 100 characters</td>
<td>Name of the instructions. This is defined by counterparty.</td>
</tr>
<tr class="odd">
<td>accountId</td>
<td>String</td>
<td>Client account number at IBKR.</td>
</tr>
<tr class="even">
<td>bankInstructionMethod</td>
<td>ACH<br />
WIRE<br />
SEPA<br />
CPA</td>
<td>Static value and will always be ACHUS</td>
</tr>
<tr class="odd">
<td>currency</td>
<td>Currency code (3 digits). Available currencies can be found <a href="https://www.interactivebrokers.com/en/support/fund-my-account.php">here</a>.</td>
<td>Currency for the bank instructions.</td>
</tr>
<tr class="even">
<td>name</td>
<td>String; max 100characters</td>
<td>Name of the financial institution.</td>
</tr>
<tr class="odd">
<td>branchCode</td>
<td>String; max 32 characters</td>
<td></td>
</tr>
<tr class="even">
<td>branchCodeType</td>
<td>BSB_AUD<br />
BANK_CODE_CAD<br />
NONE</td>
<td>Bank state branch code.</td>
</tr>
<tr class="odd">
<td>identifier</td>
<td>String; max 16 characters</td>
<td></td>
</tr>
<tr class="even">
<td>identifierType</td>
<td>IFSC<br />
BIC</td>
<td><strong>IFSC</strong>: The Indian Financial System Code (IFSC) is an 11-character alphanumeric code that identifies a bank branch in India<br />
<strong>BIC</strong>: Bank Identifier Code, is a unique code that identifies a financial institution and is used for international money transfers. BICs are also known as SWIFT codes or SWIFT addresses.</td>
</tr>
<tr class="odd">
<td>clientAccountId</td>
<td>String; max 32 characters</td>
<td>Account number at financial institution</td>
</tr>
</tbody>
</table>

###### Example

``` wp-block-code
POST /gw/api/v1/bank-instructions

{
"instructionType": "PREDEFINED_DESTINATION_INSTRUCTION",
"instruction": {
"clientInstructionId": 7013053,
"bankInstructionName": "Test Wire Instructions",
"bankInstructionMethod": "WIRE",
"accountId": "U123456",
"currency": "USD",
"financialInstitution": {
"name": "Test Bank",
"branchCode": "0",
"branchCodetype": "BSB_AUD",
"identifier": "SBIN001000",
"identifierType": "BIC",
"clientAccountId": "132456789"
}
}
}
```

### View Saved Bank Instructions

When initiating deposit or withdrawal, the user can save the banking information, also referred to as the `bankInstructionName.` If banking information is saved, the user can reference the bank information for future funding requests rather than re-entering the banking information. The `/gw/api/v1/bank-instructions/query` endpoint can be used to view list of saved banking instructions on file by `accountId` and `bankInstructionMethod`. The response will return the corresponding `bankInstructionName` and, `bankRoutingNumber`, `currency` last 4 digits of the `bankAccountNumber` (if applicable).

###### Example

``` wp-block-code
POST /gw/api/v1/bank-instructions/query

{
  "instructionType": "QUERY_BANK_INSTRUCTION",
    "instruction": {
    "clientInstructionId": "1012983",
    "accountId": "U46377",
    "bankInstructionMethod": "ACH"
  }
}
```

### Delete Bank Instructions

The `/gw/api/v1/bank-instructions` can be used to delete banking instructions (`bankInstructionName`) for an existing account by `bankInstructionName`, `currency`, and `bankInstructionMethod`. Users are limited to 6 active banking instructions at a single time.

###### Example

``` wp-block-code
POST /gw/api/v1/bank-instructions

{
  "instructionType": "DELETE_BANK_INSTRUCTION",
  "instruction": {
    "clientInstructionId": 7013055,
    "accountId": "U46377",
    "bankInstructionName": "Test Delete",
    "bankInstructionMethod": "WIRE",
    "currency": "USD"
  }
}
```

## Cash Transfer

With support for over 20 + currencies, IBKR provides clients the flexibility to make deposits or withdrawals in base and non-base currency balances. Specific currency restrictions may apply, this is determined based on individuals country of residence and the selected funding method. Available currencies can be found [here](https://www.interactivebrokers.com/en/support/fund-my-account.php).

The `/gw/api/v1/external-cash-transfers` can be used to manage cash transfers between external bank account and the IBKR brokerage account. Transfer details including method (`ACH` and `WIRE`), transaction type (` DEPOSIT  `or `WITHDRAWAL`), `currency`, and ` amount  `will be defined within the body of the request.

To supplement the sample requests found in the [API reference documentation](https://www.interactivebrokers.com/campus/ibkr-api-page/webapi-ref-staging/#tag/Account-Management-Transfers/paths/~1gw~1api~1v1~1external-asset-transfers/post), we’ve provided a details breakdown of body parameters and their usage in the section that follows.

###### Request Parameters

<table>
<colgroup>
<col style="width: 33%" />
<col style="width: 33%" />
<col style="width: 33%" />
</colgroup>
<thead>
<tr class="header">
<th>Name</th>
<th>Type</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td>accountId</td>
<td>String</td>
<td>IBKR account ID of the advisor/broker client account which funds are being deposited to. </td>
</tr>
<tr class="even">
<td>instructionType</td>
<td>DEPOSIT<br />
WITHDRAWAL</td>
<td>Type of transaction.</td>
</tr>
<tr class="odd">
<td>clientInstructionId</td>
<td>Number; max characters 20.</td>
<td>Unique identifier associated with the request.<br />
– The <strong>clientInstructionId </strong>cannot be reused.<br />
– IBKR’s preference is that the <strong>clientInstructionId </strong>is established in sequential order ie 1, 2, 3, 4  or 100, 101, 102, 103 not 777, 589, 123.</td>
</tr>
<tr class="even">
<td>amount</td>
<td>number &gt; 0</td>
<td>Amount being deposited to the clients IBKR Account.</td>
</tr>
<tr class="odd">
<td>bankInstructionMethod</td>
<td>WIRE <br />
ACH<br />
SEPA</td>
<td>WIRE: Electronic fund transfer through the fed wire system.
<p>ACH: Includes US Automated Clearing House, Single Euro Payment Area, Canadian Electronic Funds Transfer.</p></td>
</tr>
<tr class="even">
<td>currency</td>
<td>Currency code (3 digits). Available currencies can be found <a href="https://www.interactivebrokers.com/en/support/fund-my-account.php">here</a>.</td>
<td>Currency of the funds being sent to IBKR.</td>
</tr>
<tr class="odd">
<td>bankInstructionName</td>
<td>String; maximum of 150characters.</td>
<td>Name of the previously created instruction (saved bank/account number. Only required for ACH initiated by IBKR.</td>
</tr>
<tr class="even">
<td>identifier</td>
<td>String; maximum of 64characters.</td>
<td>Bank Account Number</td>
</tr>
<tr class="odd">
<td>sendingInstitution</td>
<td>String; maximum of 128 characters.</td>
<td>Bank Name</td>
</tr>
<tr class="even">
<td>specialInstruction</td>
<td>String; maximum of 128 characters.</td>
<td>Any special instructions associated with the deposit.</td>
</tr>
<tr class="odd">
<td>iraContributionType</td>
<td>ROLLOVER<br />
LATE_ROLLOVER<br />
EMPLOYER_SEP_CONTRIBUTION<br />
DIRECT_ROLLOVER<br />
CONTRIBUTION<br />
SPOUSAL_CONTRIBUTION</td>
<td>ROLLOVER: Amount is distributed from a retirement account and ‘rolled over’ to the same or other retirement account<br />
LATE_ROLLOVER: Late rollover<br />
EMPLOYER_SEP_CONTRIBUTION: Simplified employee pension – employer contribution<br />
DIRECT_ROLLOVER: Direct rollover from a qualified plan<br />
CONTRIBUTION: Regular IRA contributions<br />
SPOUSAL_CONTRIBUTION: Spousal IRA contributions</td>
</tr>
<tr class="even">
<td>iraTaxYearType</td>
<td>CURRENT<br />
PRIOR</td>
<td>Current: Current Tax Year<br />
Prior: Prior Tax Year</td>
</tr>
<tr class="odd">
<td>fromIraType</td>
<td>NONE<br />
TRADITIONAL<br />
ROLLOVER<br />
ROTH<br />
SEP<br />
EDUCATION<br />
TRADITIONAL_INHERITED<br />
ROTH_INHERITED<br />
SEP_INHERITED<br />
RETIREMENT_SAVINGS_PLAN<br />
SPOUSAL_RETIREMENT_SAVINGS_PLAN<br />
TAX_FREE_SAVINGS_ACCOUNT</td>
<td> </td>
</tr>
<tr class="even">
<td>instructionName</td>
<td>String</td>
<td>Name of the recurring transaction.</td>
</tr>
<tr class="odd">
<td>frequency</td>
<td>MONTHLY<br />
QUARTERLY<br />
YEARLY</td>
<td>Frequency which the transaction will take place.</td>
</tr>
<tr class="even">
<td>startDate</td>
<td>YYYY-MM-DD</td>
<td>Date which recurring transaction will start.</td>
</tr>
<tr class="odd">
<td>endDate</td>
<td>YYYY-MM-DD</td>
<td>Date which the recurring transaction will end.</td>
</tr>
<tr class="even">
<td>fedIncomeTaxPercentage</td>
<td>Number &gt; 0</td>
<td></td>
</tr>
<tr class="odd">
<td>stateIncomeTaxPercentage</td>
<td>Number &gt; 0</td>
<td></td>
</tr>
<tr class="even">
<td>stateCd</td>
<td>2 digit state code.</td>
<td></td>
</tr>
<tr class="odd">
<td>iraWithholdType</td>
<td>DIRECT_ROLLOVER<br />
ROTH_DISTRIBUTION<br />
NORMAL<br />
EARLY<br />
DEATH<br />
EXCESS_CY<br />
EXCESS_PY<br />
EXCESS_SC</td>
<td></td>
</tr>
</tbody>
</table>

### **Deposit Funds**

Deposit cash into the brokerage account for trading. The funding process and time for funds to arrive will vary based on the method. Please be advised that methods available via the Web API are limited in comparison to options that are supported within the [IBKR Hosted Portal](https://www.ibkrguides.com/clientportal/transferandpay/deposit.htm).

#### Wire Deposit

Wire deposit is the quickest method to fund the brokerage account. Wire deposits arrive immediately to four business days, depending on your bank. Non-U.S. banks are generally at the longer end of the range. Credit to account is immediate upon arrival.

  - Fees: Determined by your bank, generally **fees do apply**.
  - Trading Hold: Funds are immediately available for trading after arriving at IBKR.
  - Withdrawal Hold: Funds are available for withdrawal after **three business days**.

A two-step process is used to complete a bank wire:

Step 1: Create deposit notification so that IBKR is aware of the incoming funds. This important step helps ensure the proper routing of your funds if we do not receive your IBKR account number / account title from the wire template you setup at your bank.

Step 2: Contact bank to request bank wire and supply the bank with IBKR’s wiring instructions.

  - IBKR wire instructions will vary based on the **currency** AND **account ID** which the account is associated with. Wire instructions can be obtained using `/api/v1/enumerations/wire-instructions`.

###### Example

``` wp-block-code
POST /gw/api/v1/external-cash-transfers
{
  "instructionType": "DEPOSIT",
  "instruction": {
    "clientInstructionId": 7013045,
    "accountId": "U46377",
    "currency": "USD",
    "amount": 100,
    "bankInstructionMethod": "WIRE",
    "sendingInstitution": "Chase Bank",
    "identifier": "123456",
    "specialInstruction": "My Deposit",
    "bankInstructionName": "Instruction",
  }
}
```

#### ACH Deposit

U.S. residents with [linked bank accoun](https://www.interactivebrokers.com/campus/ibkr-api/account-management-api/#create-bank-instructions)[t](https://www.interactivebrokers.com/campus/ibkr-api-page/web-api-account-management/#bank-instructions-16) can seamlessly deposit funds to their IBKR brokerage account using ACH initiated at IBKR.

  - Fees: Free
  - Trading Hold: For initial deposit, the first deposit is available to trade four business days after initiating the deposit in Client Portal. Subsequent deposits may be available immediately (depending on tenure, deposit history and account balance). Otherwise, four business days to trade.
  - Withdrawal Hold: Funds are available for withdrawal to the originating bank account after five business days. If you wish to withdraw the funds to an account other than the originating bank account, the hold period is 44 business days.

More information on ACH can be found [here](https://www.interactivebrokers.com/lib/cstools/faq/#/content/47455653).

###### Example

``` wp-block-code
POST /gw/api/v1/external-cash-transfers
{
  "instructionType": "DEPOSIT",
  "instruction": {
    "clientInstructionId": 7013045,
    "accountId": "U46377",
    "currency": "USD",
    "amount": 100,
    "bankInstructionMethod": "ACH",
    "bankInstructionName": "My Checking Account",
  }
}
```

### **Withdraw Funds**

Withdrawal requests can be initiated via the Web API if standing bank instructions are on file.

  - Withdrawal limit is 100K USD. Withdrawal requests for more than 100K USD will need to be summited via the IBKR hosted portal.
  - IBKR allows one free withdrawal request per calendar month. After the first withdrawal (of any kind), IBKR will charge the fees listed below for any subsequent withdrawal.
  - Information on processing time and fees can be found [here](https://www.interactivebrokers.com/en/pricing/other-fees.php).

#### Wire Withdrawal

At the present, IBKR infrastructure only supports creation of wire withdrawal instructions within IBKR Hosted (not via API). Once instructions have been created, ongoing withdrawal requests can be submitted for standing instruction using the API.

###### *Add Wire Instructions via IBKR Portal*

  - [Advisors](https://ibkrguides.com/advisorportal/addadvauth.htm?Highlight=streamline) and [brokers](https://www.ibkrguides.com/brokerportal/clientserviceprogram.htm) enrolled in Streamlined program can create manage banking instructions on behalf of client within IBKR Portal Broker.
  - End user can create banking instructions directly within IBKR Portal under **Transfer & Pay \> [Transfer Funds](https://www.ibkrguides.com/clientportal/transferandpay/enterwithdrawal.htm).** Alternatively, connect user to IBKR Portal using [Single Sign On (SSO)](https://www.interactivebrokers.com/campus/ibkr-api-page/web-api-account-management/#single-sign-on) and set deep link.

###### Example

``` wp-block-code
POST /gw/api/v1/external-cash-transfers

{ "instructionType": "WITHDRAWAL", 
 "instruction": {    "clientInstructionId": 7013048,
    "accountId": "U46377",
    "bankInstructionName": "Test Withdrawal",
    "bankInstructionMethod": "WIRE",
    "amount": "123.45",
    "currency": "USD",
    "dateTimeToOccur": "2023-11-20T09:12:13Z"
  }
```

#### ACH Withdrawal

U.S. residents with [linked ba](https://www.interactivebrokers.com/campus/ibkr-api-page/web-api-account-management/#bank-instructions-16)[nk account](https://www.interactivebrokers.com/campus/ibkr-api/account-management-api/#add-bank-instructions) can seamlessly withdraw funds from IBKR brokerage account to bank account via ACH.

###### Example

``` wp-block-code
POST /gw/api/v1/external-cash-transfers

{
  "instructionType": "WITHDRAWAL",
  "instruction": {
    "clientInstructionId": 7013048,
    "accountId": "U46377",
    "bankInstructionName": "Test Withdrawal",
    "bankInstructionMethod": "ACH",
    "amount": "500.12",
    "currency": "USD",
    "dateTimeToOccur": "2023-11-20T09:12:13Z"
  }
}
```

## Wire Instructions

This `/api/v1/enumerations/wire-instructions` can be used to retrieve the necessary banking details and wire transfer instructions required to deposit funds into your IBKR trading account. The response will include recipient bank information, account details, and any specific reference codes needed to ensure proper crediting of your deposit.

| Name        | Value                                                                                                                                  | Description                                      | Usage    |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | -------- |
| `accountId` | IBKR Client Account Number                                                                                                             |                                                  | Required |
| currency    | Currency code (3 digits). Available currencies can be found [here](https://www.interactivebrokers.com/en/support/fund-my-account.php). | Currency which wire instructions are needed for. | Required |

**Important Notes:**

  - Wire instructions are subject to change and will vary based on currency
  - It is recommended that you call this endpoint prior to depositing funds to IBKR to ensure you have the most current and accurate wire transfer details

###### Example

``` wp-block-code
POST /api/v1/enumerations/wire-instructions?currency=USD&accountId=U123456
{
    "enumerationsType": "wire-instructions",
    "jsonData": [
        {
            "currency": "USD",
            "accountNameAndBeneficiary": "Interactive Brokers LLC, One Pickwick Plaza, Greenwich, Connecticut, 06830, United States",
            "accountNumber": "12345678(Account Number)",
            "routingNumber": "12345678(ABA Code)",
            "bankSWIFTCode": "CHASUS33XXX",
            "bankTitleAndAddress": "JPMORGAN CHASE BANK, N.A., 383 Madison Avenue, New York, 10017, United States",
            "alternateAccountInfo": "",
            "paymentReference": "U123456/ IBLLC Test Test Account"
        }
    ]
}
```

## Recurring Transactions

When initiating a deposit or withdrawal request, include ` recurDetail  `with transaction details to configure recurring transaction.

  - `instruction_name`: This is the name of the saved recurring transaction and will be displayed within Client Portal under ‘Recurring Transactions’ page.
  - `frequency`: Schedule the transaction to recur at monthly, quarterly or annual intervals.
  - `start_date`: Entered in the format `YYYY-MM-DD`, this indicates the first date that the recurring transaction should be processed.
  - `end_date`: The `end_date` is optional and indicates the last date that the recurring transaction should be processed. If null, the transaction will recur indefinitely canceled.

The transaction information entered will be saved and the transaction will recur at the ` frequency  `and on the `start_date` which was entered. In the event the transaction falls on a US non-business day under normal circumstances, we will process the request on the business day prior to the recurring transaction date. In the even this processing leads to multiple withdrawals during the same month, the account holder will be assessed withdrawal fees.

###### Example

``` wp-block-code
POST /gw/api/v1/external-cash-transfers

{
  "instructionType": "DEPOSIT",
  "instruction": {
    "clientInstructionId": 7013047,
    "accountId": "U46377",
    "currency": "USD",
    "amount": 100,
    "bankInstructionMethod": "WIRE",
    "sendingInstitution": "Sending Institution name",
    "recurDetail": {
      "instruction_name": "Arkansas-Test-Instr",
      "start_date": "2023-10-16",
      "frequency": "MONTHLY"
    }
  }
}
```

### Cancel Recurring Transaction

Recurring transactions that are initiated using the API can be canceled by calling `/gw/api/v1/instructions/cancel` endpoint. Within the body of the request, include the ` instructionId  `of the recurring transaction to be canceled. The ` instructionId  `is a unique value assigned by IBKR at creation of the recurring transaction.

Optionally, instructions can be managed within IBKR Portal under **Transfer & Pay \> [Saved Information](https://www.ibkrguides.com/clientportal/transferandpay/savedinfo.htm).**

###### Example

``` wp-block-code
POST /gw/api/v1/instructions/cancel

{
  "intructionType": "cancel_instruction",
  "instruction": {
    "clientInstructionId": "12001810",
    "instructionId": 43085477,
    "reason": "Testing"
  }
}
```

### View Recurring Instructions

The `/gw/api/v1/bank-instructions/query` endpoint can be used to view active recurring instruction details by `accountId`. Details include type, method, amount, currency, frequency, start date, and end date.

###### Example

``` wp-block-code
POST /gw/api/v1/bank-instructions/query 

{
  "instructionType": "get_bank_instruction_details",
  "instruction": {
    "clientInstructionId": "1012983",
    "accountId": "U399192"
  }
}
```

### View Recurring Transactions

View historical transactions associated with a recurring instruction. The look back period is set by `numberOfTransactions`. Response will include the recurring instruction details and status of the individual `recurringTransactionStatus`.

###### Example

``` wp-block-code
POST /gw/api/v1/bank-instructions/query 

{
  "instructionType": "QUERY_RECURRING_EVENTS",
  "instruction": {
    "clientInstructionId": "1012983",
    "ibReferenceId": 206603050,
    "numberOfTransactions": 100
  }
}
```

## Open Banking

Our Open Banking integration provides a streamlined way to manage bank connections and transfers between your bank account and your IBKR brokerage account. We partner with Plaid to handle secure bank authentication and connection management.

We offer a **hybrid integration approach** rather than a full direct API integration:

  - **Bank connection management** is handled by our partner Plaid
  - **Transfer execution** is facilitated through our API endpoints
  - **Standing instructions** are managed within your IBKR account

## Add Open Banking Instructions

Connect users to the IBKR portal using [Single Sign On](https://www.interactivebrokers.com/campus/ibkr-api-page/web-api-account-management/#single-sign-on) to add new Open Banking instructions to their account.

plaintext

**Use Case:** First-time setup or adding additional bank accounts

**Flow:**

1.  Hosting firm will call the` /api/v1/sso-browser-sessions` and provide `credential `and `ip` of the end user.
2.  IBKR returns a response URL with SID (unique token).
      - SID is only valid for 60 seconds and can only be accessed from the IP which was included in the original request.
3.  Hosting firm appends `ACTION=TransferFunds&type=DEPOSIT&method=OPEN_BANKING&currency=<GBPorEUR>` to the URL
4.  Hosting firm invokes the URL into the users browser, new window opens and the user lands on IBKR funding page where they can add open banking instructions

###### Example

``` wp-block-code
https://www.clientam.com/sso/resolver?ACTION=TransferFunds&type=DEPOSIT&method=OPEN_BANKING&currency=<GBPorEUR>&SID=<TokenHere> 
```

## Initiate Open Banking Deposit

Initiate a deposit via Plaid when standing Open Banking instructions are already in place by calling the `/gw/api/v1/external-cash-transfers` endpoint.

**Prerequisites:**

  - User must have existing standing Open Banking instructions in their IBKR account
  - Bank account must be previously connected
  - Hosting firm has provided the URI to IBKR API representative.

**Flow:**

  - Hosting firm calls the `/gw/api/v1/external-cash-transfers` endpoint providing IBKR with deposit details.
  - IBKR returns unique URL address
  - Hosting firm invokes URL into users browser. User lands in Plaid interface.
  - User authenticates and confirms deposit
  - Funds transfer is initiated

###### Request Parameters

<table>
<colgroup>
<col style="width: 33%" />
<col style="width: 33%" />
<col style="width: 33%" />
</colgroup>
<thead>
<tr class="header">
<th>Name</th>
<th>Type</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td>accountId</td>
<td>String</td>
<td>IBKR account ID of the advisor/broker client account which funds are being deposited to. </td>
</tr>
<tr class="even">
<td>instructionType</td>
<td>DEPOSIT</td>
<td>Type of transaction.</td>
</tr>
<tr class="odd">
<td>clientInstructionId</td>
<td>Number; max characters 20.</td>
<td>Unique identifier associated with the request.<br />
– The <strong>clientInstructionId </strong>cannot be reused.<br />
– IBKR’s preference is that the <strong>clientInstructionId </strong>is established in sequential order ie 1, 2, 3, 4  or 100, 101, 102, 103 not 777, 589, 123.</td>
</tr>
<tr class="even">
<td>amount</td>
<td>number &gt; 0</td>
<td>Amount being deposited to the clients IBKR Account.</td>
</tr>
<tr class="odd">
<td>bankInstructionMethod</td>
<td>OPEN_BANKING</td>
<td>WIRE: Electronic fund transfer through the fed wire system. ACH: Includes US Automated Clearing House, Single Euro Payment Area, Canadian Electronic Funds Transfer.</td>
</tr>
<tr class="even">
<td>currency</td>
<td>Currency code (3 digits). Available currencies can be found <a href="https://nam02.safelinks.protection.outlook.com/?url=https%3A%2F%2Fwww.interactivebrokers.com%2Fen%2Fsupport%2Ffund-my-account.php&amp;data=05%7C02%7Cdam%40interactivebrokers.com%7Cf880a2adb1ab47c5b4bf08de4d51a5fe%7C7abd04ef837d48e69ba869d84f65a110%7C0%7C0%7C639033210317202011%7CUnknown%7CTWFpbGZsb3d8eyJFbXB0eU1hcGkiOnRydWUsIlYiOiIwLjAuMDAwMCIsIlAiOiJXaW4zMiIsIkFOIjoiTWFpbCIsIldUIjoyfQ%3D%3D%7C0%7C%7C%7C&amp;sdata=VdOJ46KLbNX4BLWWxnwlcd7UZ9dHDgTtyRX%2FQozIm3I%3D&amp;reserved=0"><strong>here</strong></a>.</td>
<td>Currency of the funds being sent to IBKR.</td>
</tr>
<tr class="odd">
<td>bankInstructionName</td>
<td>String; maximum of 150characters.</td>
<td>Name of the previously created instruction (saved bank/account number. Only required for ACH initiated by IBKR.</td>
</tr>
<tr class="even">
<td>identifier</td>
<td>String; maximum of 64characters.</td>
<td>Bank Account Number</td>
</tr>
<tr class="odd">
<td>serviceProvider</td>
<td>PLAID</td>
<td>Name of the service provider.</td>
</tr>
<tr class="even">
<td>linkDisplayName</td>
<td>String; maximum of 128 characters.</td>
<td>Name of the client displayed on Plaid’s UI</td>
</tr>
<tr class="odd">
<td>completeRedirectUri</td>
<td>URI address</td>
<td>Return URL (pre-configured in Plaid dashboard)</td>
</tr>
</tbody>
</table>

###### Example

``` wp-block-code
{
    "instructionType": "DEPOSIT",
    "instruction": {
        "clientInstructionId": 43454545,
        "accountId": "U1234567",
        "currency": "EUR",
        "amount": 1300,
        "bankInstructionMethod": "OPEN_BANKING",
        "openBanking": {
            "serviceProvider": "PLAID",
            "plaidOptions": {
                "linkDisplayName": "Test displayname",
                "completionRedirectUri": "wonderdust://complete"
            }
        },
        "bankInstructionName": "Test Bank"
    }
}
```

###### Example Response

``` wp-block-code
{
    "status": 202,
    "instructionSetId": 882059,
    "instructionResult": {
        "depositDetails": {
            "openBanking": {
                "serviceProvider": "PLAID",
                "providerResponse": {
                    "paymentId": "payment-id-sandbox-dc9f2de9-6c6d-4c04-b09c-c7fb8314afc7",
                    "hostedlinkUrl": "https://secure.plaid.com/hl/ls16p0n6orpq489p4s37o3rr16pqq9n3p2",
                    "linkToken": "link-sandbox-61c5a1be-cd93-4c9f-82b8-ee61cdd4a8c7"
                }
            }
        },
        "ibReferenceId": 320905649,
        "clientInstructionId": 601361111111301,
        "instructionType": "DEPOSIT",
        "instructionStatus": "PENDING",
        "instructionId": 703819361
    }
}
```

## Initiate Withdrawal

When you add Open Banking instructions to your IBKR account, IBKR automatically creates a set of **standing withdrawal instructions**. This one-time setup enables seamless ongoing transfers. This means withdrawal requests can be submitted without requiring user interaction with Plaid or IBKR.

**Prerequisites:**

  - Standing withdrawal instructions must be set up in IBKR account

###### Example

``` wp-block-code
POST /gw/api/v1/external-cash-transfers

{ "instructionType": "WITHDRAWAL", 
 "instruction": {    "clientInstructionId": 7013048,
    "accountId": "U46377",
    "bankInstructionName": "Test Withdrawal",
    "bankInstructionMethod": "ACH",
    "amount": "123.45",
    "currency": "EUR",
    "dateTimeToOccur": "2023-11-20T09:12:13Z"
  }
```

<sub>**TIP**: The `/gw/api/v1/bank-instructions/query` endpoint can be used to view list of saved banking instructions on file by `accountId` and `bankInstructionMethod`. The response will return the corresponding `bankInstructionName` and, `bankRoutingNumber`, `currency` last 4 digits of the `bankAccountNumber`.</sub>

## Internal Transfer

Internally transfer cash/positions between IBKR accounts based on eligibility.

**Processing Time**: Our system does not allow internal transfers on Saturdays (any time), Sundays before 3PM EST, and on any evening between 11:45PM-12:30AM EST. Requests submitted outside of these times are processed in real-time.

### Transfer Cash Internally

The [/gw/api/v1/internal-cas](https://www.interactivebrokers.com/campus/ibkr-api-page/webapi-ref-staging/#tag/Account-Management-Transfers/paths/~1gw~1api~1v1~1internal-asset-transfers/post)[h-transfers](https://www.interactivebrokers.com/campus/ibkr-api-page/webapi-ref-staging/#tag/Account-Management-Banking/paths/~1gw~1api~1v1~1internal-asset-transfers/post) can be used to transfer cash internally between IBKR accounts based on eligibility.

  - **Non-Disclosed**: Transfer cash between Non-Disclosed Master and Non-Disclosed Sub.
  - **Fully-Disclosed:** Transfer cash from Fully-Disclosed master to sub account.
  - **All Accounts**: Internal transfers supported between existing IBKR accounts IF both source and destination account have matching account titles, country of residence, tax ID, and are associated with the same IB Entity.

Requests submitted outside of downtime are processed in real-time and will be immediate (max of 15 seconds), if request is unable to be processed in 15 seconds, the request will move to a `PENDING `status. Optionally, include `dateTimeToOccur` to schedule transaction for set time in the future.

###### Request Parameters

<table>
<colgroup>
<col style="width: 33%" />
<col style="width: 33%" />
<col style="width: 33%" />
</colgroup>
<thead>
<tr class="header">
<th>Name</th>
<th>Type</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td>sourceAccountId</td>
<td>String</td>
<td>Account which funds are being sent from.</td>
</tr>
<tr class="even">
<td>clientInstructionId</td>
<td>Number; Max characters 20.</td>
<td>Unique identifier associated with the request.<br />
– The <strong>clientInstructionId </strong>cannot be reused.<br />
– IBKR’s preference is that the <strong>clientInstructionId </strong>is established in sequential order ie 1, 2, 3, 4  or 100, 101, 102, 103 not 777, 589, 123.</td>
</tr>
<tr class="odd">
<td>instructionType</td>
<td>INTERNAL_CASH_TRANSFER</td>
<td>Type of Transaction.</td>
</tr>
<tr class="even">
<td>amount</td>
<td>number &gt; 0</td>
<td>Amount of cash being transferred.</td>
</tr>
<tr class="odd">
<td>targetAccountId</td>
<td>String</td>
<td>Account which funds are being sent to.</td>
</tr>
<tr class="even">
<td>currency</td>
<td>Currency code (3 digits). Available currencies can be found <a href="https://www.interactivebrokers.com/en/support/fund-my-account.php">here</a>.</td>
<td>Currency of the funds being sent to IBKR.</td>
</tr>
<tr class="odd">
<td>dateTimeToOccur</td>
<td>2016-04-13T23:15:00+04:00 (UTC plus 4 hours)<br />
2016-04-13T23:15:00-04:00<br />
(UTC minus 4 hours)</td>
<td>Date which the transfer should take place. *This is optional.</td>
</tr>
<tr class="even">
<td>clientNote</td>
<td>String; Maximum of 64 characters.</td>
<td>Note associated with the internal cash transfer request. Note will be reflected on the client statement. This field is optional.</td>
</tr>
</tbody>
</table>

``` wp-block-code
POST /gw/api/v1/internal-cash-transfers

{
  "intructionType": "INTERNAL_CASH_TRANSFER",
  "instruction": {
    "clientInstructionId": "1012983",
    "sourceAccountId": "U46377",
    "targetAccountId": "U15667",
    "amount": 123.45,
    "currency": "GBP",
    "dateTimeToOccur": "2018-03-20T09:12:13Z"
  }
}
```

### Transfer Positions Internally

The [/gw/api/v1/internal-asset-transfers](https://www.interactivebrokers.com/campus/ibkr-api-page/webapi-ref-staging/#tag/Account-Management-Banking/paths/~1gw~1api~1v1~1internal-asset-transfers/post) can be used to transfer positions internally between IBKR accounts based on eligibility.

  - **All Accounts**: Internal transfers supported between existing IBKR sub accounts IF both source and destination account have matching account titles, country of residence, tax ID, and are associated with the same IB Entity.
  - **Non-Disclosed and Omnibus:** Internal transfer supported between sub accounts that are linked to the same master account.

#### Processing

Our system processes 200 requests every 5 minutes, this is an asynchronous process. If a bulk request of 600 transfer requests submitted. This will take 15 minutes to be processed (total of 3 batches). Users may be subject to additional fee if submitting more than 1000 internal position transfer requests daily.

###### Request Parameters

<table>
<colgroup>
<col style="width: 33%" />
<col style="width: 33%" />
<col style="width: 33%" />
</colgroup>
<thead>
<tr class="header">
<th>Name</th>
<th>Type</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td>clientInstructionId</td>
<td>Number; max characters 20.</td>
<td>Unique identifier associated with the request.<br />
– The <strong>clientInstructionId </strong>cannot be reused.<br />
– IBKR’s preference is that the <strong>clientInstructionId </strong>is established in sequential order ie 1, 2, 3, 4  or 100, 101, 102, 103 not 777, 589, 123.</td>
</tr>
<tr class="even">
<td>instructionType</td>
<td>INTERNAL_POSITION_TRANSFER</td>
<td>Type of transaction</td>
</tr>
<tr class="odd">
<td><span></span>securityId</td>
<td>String</td>
<td>CUSIP/ISIN number of the security being transferred.</td>
</tr>
<tr class="even">
<td>transferQuantity</td>
<td>Number</td>
<td>Number of shares being transferred in/out</td>
</tr>
<tr class="odd">
<td>assetType</td>
<td>STK</td>
<td>Product type. Internal transfer for Non-STK products (ie. Options, Bonds) are only supported using CONID (not ISIN). We do not require asset_type to be specified when submitting internal transfer using CONID.</td>
</tr>
<tr class="even">
<td>securityIdType</td>
<td>CUSIP<br />
ISIN<br />
CASH</td>
<td>Used to determine securityId  type that was provided. Either ISIN or CUSIP.</td>
</tr>
<tr class="odd">
<td>conId</td>
<td>String</td>
<td>Unique Contract ID assigned by Interactive Brokers.</td>
</tr>
<tr class="even">
<td>currency</td>
<td>Currency code (3 digits). Available currencies can be found <a href="https://www.interactivebrokers.com/en/support/fund-my-account.php">here</a>.</td>
<td>Currency of the assets being transferred. </td>
</tr>
<tr class="odd">
<td>country</td>
<td>Alpha-3 code (ISO)</td>
<td>Country which the contra broker is located.</td>
</tr>
<tr class="even">
<td>sourceAccountId</td>
<td>String</td>
<td>Account which funds are being sent from.</td>
</tr>
<tr class="odd">
<td>targetAccountId</td>
<td>String</td>
<td>Account which funds are being sent to.</td>
</tr>
</tbody>
</table>

2 options for submitting request (securityId **OR **conId)

***Option 1: Using securityId***

``` wp-block-code
POST /gw/api/v1/internal-asset-transfers
{
  "instructionType": "INTERNAL_POSITION_TRANSFER",
  "instruction": {
    "clientInstructionId": 7013044,
    "sourceAccountId": "U399192",
    "targetAccountId": "U87440",
    "position": 106,
    "transferQuantity": 6,
    "tradingInstrument": {
      "tradingInstrumentDescription": {
        "securityIdType": "ISIN",
        "securityId": "459200101",
        "assetType": "STK"
      },
      "currency": "USD"
    }
  }
}
```

***Option 2: Using conId***

``` wp-block-code
POST /gw/api/v1/internal-asset-transfers

{
  "instructionType": "INTERNAL_POSITION_TRANSFER",
  "instruction": {
    "clientInstructionId": 7013043,
    "sourceAccountId": "U399192",
    "targetAccountId": "U87440",
    "position": 106,
    "transferQuantity": 6,
    "tradingInstrument": {
      "conId": 21323,
      "currency": "USD"
    }
  }
}
```

## Position Transfers

Transfer positions between IBKR brokerage account and external account using the `/gw/api/v1/external-asset-transfers` endpoint. Transfer methods available will vary based on country of residence and currency of assets being transferred.

###### FOP

FOP (Free of Payment -US) is a method to transfer US securities, stocks, ETF's and fixed income. The delivery takes place through the Depository Trust Company (DTC).

Enter an FOP transfer, in which all of your assets are transferred from a third-party broker to your account (inbound), or from your IBKR account to a third-party broker. Account Name, Tax Identification Number and Client Type (i.e. individual, joint), must exactly match the third-party broker account in order for the transfer to take place.

**Inbound Transfer** (Transfer positions to IBKR): Transfer is initiated by delivering broker. The API can be used to create notification so IBKR is aware of the incoming transfer. The FOP receive notification at IBKR will expire after 5 business days if securities are not received. Once the notice has expired IBKR will not accept the shares.

**Outgoing Transfer** (Transfer positions out of the IBKR account): From your account to another US bank or broker that is a member of the DTC (outbound transfer).

For more information on FOP, refer to this [link](https://ibkrguides.com/adminportal/transferandpay/foptrans.htm).

###### Schema

<table>
<colgroup>
<col style="width: 33%" />
<col style="width: 33%" />
<col style="width: 33%" />
</colgroup>
<thead>
<tr class="header">
<th>Name</th>
<th>Type</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td>clientInstructionId</td>
<td>Number; max 20 characters.</td>
<td>Unique identifier associated with the request.<br />
– The <strong>clientInstructionId </strong>cannot be reused.<br />
– IBKR’s preference is that the <strong>clientInstructionId </strong>is established in sequential order ie 1, 2, 3, 4  or 100, 101, 102, 103 not 777, 589, 123.</td>
</tr>
<tr class="even">
<td>instructionType</td>
<td>FOP</td>
<td>Type of transaction.</td>
</tr>
<tr class="odd">
<td>direction</td>
<td>IN<br />
OUT</td>
<td>Indicate if this is an incoming our outgoing transfer.<br />
<strong>IN</strong> = Incoming to IBKR<br />
<strong>OUT</strong>= Transferring out to third party Broker.</td>
</tr>
<tr class="even">
<td>accountId</td>
<td>String</td>
<td>IBKR Account Number of the client account that is initiating the transfer.</td>
</tr>
<tr class="odd">
<td>contraBrokerAccountId</td>
<td>String</td>
<td>Client account number at the third party broker. </td>
</tr>
<tr class="even">
<td>contraBrokerDtcCode</td>
<td>Use <a href="https://www.interactivebrokers.com/campus/ibkr-api-page/webapi-ref/#tag/Account-Management-Utilities/paths/~1gw~1api~1v1~1enumerations~1%7BenumerationType%7D/get"><code>/gw/api/v1/enumerations/{enumerationType</code>}</a> for the value.</td>
<td>DTC Number of the third party  institution.</td>
</tr>
<tr class="odd">
<td>securityId</td>
<td>String</td>
<td>CUSIP/ISIN number of the security being transferred.</td>
</tr>
<tr class="even">
<td>quantity</td>
<td>Number</td>
<td>Number of shares being transferred in/out</td>
</tr>
<tr class="odd">
<td>asset_type</td>
<td>BILL<br />
BOND<br />
CASH<br />
FUND<br />
OPT<br />
STK<br />
WAR</td>
<td>Product type. </td>
</tr>
<tr class="even">
<td>securityIdType</td>
<td>CUSIP<br />
ISIN<br />
CASH</td>
<td>Used to determine securityId  type that was provided. Either ISIN or CUSIP.</td>
</tr>
<tr class="odd">
<td>conId</td>
<td>String</td>
<td>Unique Contract ID assigned by Interactive Brokers.</td>
</tr>
<tr class="even">
<td>currency</td>
<td>USD</td>
<td>Currency of the assets being transferred. </td>
</tr>
</tbody>
</table>

###### Example

2 options for submitting request (securityId **OR** conId)

***Option 1: Using securityId (CUSIP or ISIN)***

``` wp-block-code
POST /gw/api/v1/external-asset-transfers

{
  "instructionType": "FOP",
  "instruction": {
    "clientInstructionId": 7013039,
    "direction": "IN",
    "accountId": "U46377",
    "contraBrokerAccountId": "12345678A",
    "contraBrokerDtcCode": "534",
    "quantity": 1000,
    "tradingInstrument": {
      "tradingInstrumentDescription": {
        "securityIdType": "ISIN",
        "securityId": "459200101",
        "assetType": "STK"
      },
      "currency": "USD"
    }
  }
}
```

***Option 2: Using conId***

``` wp-block-code
POST /gw/api/v1/external-asset-transfers

{
  "instructionType": "fop",
  "instruction": {
    "clientInstructionId": 7013038,
    "direction": "IN",
    "accountId": "U46377",
    "contraBrokerAccountId": "12345678A",
    "contraBrokerDtcCode": "534",
    "quantity": 1000,
    "tradingInstrument": {
      "conId": 12123,
      "currency": "USD"
    }
  }
}
```

###### DWAC

DWAC (Deposit Withdrawal at Custodian) can be used to transfer new shares or certificates held at a transfer agent. This is commonly used when an individual has company-issued shares resulting from stock options or employee share plans.

DWAC or Deposit/Withdrawal at Custodian is an electronic method for transferring securities between transfer agent and your account facilitated by the DTC (Depository Trust company).

For more information on DWAC, refer to this [link](https://ibkrguides.com/adminportal/transferandpay/dwactrans.htm).

###### Schema

<table>
<colgroup>
<col style="width: 33%" />
<col style="width: 33%" />
<col style="width: 33%" />
</colgroup>
<thead>
<tr class="header">
<th>Name</th>
<th>Value</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td>clientInstructionId</td>
<td>Number; max 20 characters.</td>
<td>Unique identifier associated with the request.<br />
– The <strong>clientInstructionId </strong>cannot be reused.<br />
– IBKR’s preference is that the <strong>clientInstructionId </strong>is established in sequential order ie 1, 2, 3, 4  or 100, 101, 102, 103 not 777, 589, 123.</td>
</tr>
<tr class="even">
<td>instructionType</td>
<td>DWAC</td>
<td>Type of transaction.</td>
</tr>
<tr class="odd">
<td>direction</td>
<td>IN<br />
OUT</td>
<td>Indicate if this is an incoming our outgoing transfer.<br />
<strong>IN</strong> = Incoming to IBKR<br />
<strong>OUT</strong>= Transferring out to third party Broker.</td>
</tr>
<tr class="even">
<td>accountId</td>
<td>String; maximum 32 characters.</td>
<td>IBKR Account Number of the client account that is initiating the transfer.</td>
</tr>
<tr class="odd">
<td>contraBrokerAccountId</td>
<td>String; maximum 20 characters.</td>
<td>Client account number at the third party broker. </td>
</tr>
<tr class="even">
<td>contraBrokerTaxId</td>
<td><span></span>String; maximum 25 characters.</td>
<td>Tax ID associated with Contra.</td>
</tr>
<tr class="odd">
<td>securityId</td>
<td>String</td>
<td>CUSIP/ISIN number of the security being transferred.</td>
</tr>
<tr class="even">
<td>quantity</td>
<td>Number</td>
<td>Number of shares being transferred in/out</td>
</tr>
<tr class="odd">
<td>assetType</td>
<td>BILL<br />
BOND<br />
CASH<br />
FUND<br />
OPT<br />
STK<br />
WAR</td>
<td>Product type. </td>
</tr>
<tr class="even">
<td>securityIdType</td>
<td>CUSIP<br />
ISIN<br />
CASH</td>
<td>Used to determine securityId  type that was provided. Either ISIN or CUSIP.</td>
</tr>
<tr class="odd">
<td>conId</td>
<td>String</td>
<td>Unique Contract ID assigned by Interactive Brokers.</td>
</tr>
<tr class="even">
<td>currency</td>
<td>Currency code (3 digits). Available currencies can be found <a href="https://www.interactivebrokers.com/en/support/fund-my-account.php">here</a>.</td>
<td>Currency of the assets being transferred. </td>
</tr>
<tr class="odd">
<td>referenceId</td>
<td>String</td>
<td>Unique Contract ID assigned by Interactive Brokers.</td>
</tr>
<tr class="even">
<td>accountTitle</td>
<td>String; maximum 140 characters.</td>
<td>Account title of the receiving account at IBKR.</td>
</tr>
</tbody>
</table>

###### Example

``` wp-block-code
POST /gw/api/v1/external-asset-transfers

{
  "instructionType": "DWAC",
  "instruction": {
    "clientInstructionId": 7013036,
    "direction": "IN",
    "accountId": "U1001095",
    "contraBrokerAccountId": "12345678A",
    "contraBrokerTaxId": "123456789",
    "quantity": 1000,
    "accountTitle": "Special Company Holding LLC",
    "referenceId": "refId",
    "tradingInstrument": {
      "conId": 12123,
      "currency": "USD"
    }
  }
}
```

###### ACATS

ACATS is a system that automates and standardizes procedures for the transfer of assets in a customer account from one US brokerage firm or bank to another. ACATS supports USD cash, US equities, options, fixed income, US mutual funds, and non-US stocks.

The Automated Customer Account Transfer Service (ACATS) in the U.S facilitates the transfer of US stocks, warrants, options US mutual funds, US bonds and cash held at another brokerage firm to us through the National Securities Clearing Corporation’s (NSCC). The API currently only supports a **FULL** transfer. Partial transfer are supported within IBKR Portal.

  - **Processing Time:** US securities and USD Cash transfer between 4 and 8 days and can be traded immediately. See More Information for withdrawal restrictions. Non-US securities may take longer.
  - **Fees**: IBKR will pass through any fees that are charged by your current broker. See notes in More Information.

For more information on ACATS, refer to this [link](https://ibkrguides.com/adminportal/transferandpay/acatstrans.htm).

###### Schema

<table>
<colgroup>
<col style="width: 33%" />
<col style="width: 33%" />
<col style="width: 33%" />
</colgroup>
<thead>
<tr class="header">
<th>Name</th>
<th>Type</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td>clientInstructionId</td>
<td>Number; max 20 characters.</td>
<td>Unique identifier associated with the request.<br />
– The <strong>clientInstructionId </strong>cannot be reused.<br />
– IBKR’s preference is that the <strong>clientInstructionId </strong>is established in sequential order ie 1, 2, 3, 4  or 100, 101, 102, 103 not 777, 589, 123.</td>
</tr>
<tr class="even">
<td>instructionType</td>
<td>EXTERNAL_POSITION_TRANSFER</td>
<td>Type of Transaction.</td>
</tr>
<tr class="odd">
<td>type</td>
<td>FULL</td>
<td>Type will always be FULL.</td>
</tr>
<tr class="even">
<td>subType</td>
<td>ACATS</td>
<td>Method used to initiate the transfer. <a href="https://www.interactivebrokers.com/en/index.php?f=1544&amp;p=transfer">Details</a>: Overview of transfer methods.</td>
</tr>
<tr class="odd">
<td>brokerId</td>
<td>Use <a href="https://www.interactivebrokers.com/campus/ibkr-api-page/webapi-ref/#tag/Account-Management-Utilities/paths/~1gw~1api~1v1~1enumerations~1%7BenumerationType%7D/get"><code>/gw/api/v1/enumerations/{enumerationType</code>}</a> for the value.</td>
<td>DTC Number of the sending institution.</td>
</tr>
<tr class="even">
<td>brokerName</td>
<td>Use <a href="https://www.interactivebrokers.com/campus/ibkr-api-page/webapi-ref/#tag/Account-Management-Utilities/paths/~1gw~1api~1v1~1enumerations~1%7BenumerationType%7D/get"><code>/gw/api/v1/enumerations/{enumerationType</code>}</a> for the value.</td>
<td>Name of the sending institution.</td>
</tr>
<tr class="odd">
<td>accountAtBroker</td>
<td>String</td>
<td>Client account number at sending institution.</td>
</tr>
<tr class="even">
<td>accountId</td>
<td>String</td>
<td>IBKR Account Number of the client account that is initiating the transfer.</td>
</tr>
<tr class="odd">
<td>signature</td>
<td>String</td>
<td>Signature should match applicants first name middle initial (if applicable) last name suffix (if applicable) *Data is case and space sensitive.</td>
</tr>
<tr class="even">
<td>sourceIRAType</td>
<td> </td>
<td>If transfer is between <strong>two</strong> IRA accounts, specify the IRA type.</td>
</tr>
</tbody>
</table>

###### Example

``` wp-block-code
POST /gw/api/v1/external-asset-transfers

{
  "instructionType": "EXTERNAL_POSITION_TRANSFER",
  "instruction": {
    "clientInstructionId": 7013060,
    "type": "FULL",
    "subType": "ACATS",
    "brokerId": "0226",
    "brokerName": "Wall Street Financial Group",
    "accountAtBroker": "SOL12345",
    "sourceIRAType": "RO",
    "accountId": "U1225448",
    "signature": "John Tester"
  }
}
```

###### ATON

ATON is an electronic transfer method that supports the transfer of client accounts between Canadian financial institutions. ATON supports the transfer of Canadian stocks, Canadian options, Canadian cash, US stocks, US options, US warrants and US cash.

ATON transfer lets you transfer US or Canadian stocks, options and cash held at another brokerage firm to us through Account Transfer on Notification (ATON), the Canadian equivalent of ACATS

  - **Processing Time:** Most assets transfer between 3 to 8 business days, but it varies depending on your broker.
  - **Fees**: Your current broker may charge a fee for the outgoing transfer. See notes in More Information.

For more information on ATON, refer to this [link](https://ibkrguides.com/adminportal/transferandpay/atontrans.htm).

###### Schema

<table>
<colgroup>
<col style="width: 33%" />
<col style="width: 33%" />
<col style="width: 33%" />
</colgroup>
<thead>
<tr class="header">
<th>Name</th>
<th>Type</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td>clientInstructionId</td>
<td>Number; max 20 characters.</td>
<td>Unique identifier associated with the request.<br />
– The <strong>clientInstructionId </strong>cannot be reused.<br />
– IBKR’s preference is that the <strong>clientInstructionId </strong>is established in sequential order ie 1, 2, 3, 4  or 100, 101, 102, 103 not 777, 589, 123.</td>
</tr>
<tr class="even">
<td>instructionType</td>
<td>EXTERNAL_POSITION_TRANSFER</td>
<td>Type of Transaction.</td>
</tr>
<tr class="odd">
<td>type</td>
<td>FULL</td>
<td>Type will always be FULL.</td>
</tr>
<tr class="even">
<td>subType</td>
<td>ACATS</td>
<td>Method used to initiate the transfer. <a href="https://www.interactivebrokers.com/en/index.php?f=1544&amp;p=transfer">Details</a>: Overview of transfer methods.</td>
</tr>
<tr class="odd">
<td>brokerId</td>
<td>Use <a href="https://www.interactivebrokers.com/campus/ibkr-api-page/webapi-ref/#tag/Account-Management-Utilities/paths/~1gw~1api~1v1~1enumerations~1%7BenumerationType%7D/get"><code>/gw/api/v1/enumerations/{enumerationType</code>}</a> for the value.</td>
<td>DTC Number of the sending institution.</td>
</tr>
<tr class="even">
<td>brokerName</td>
<td>Use <a href="https://www.interactivebrokers.com/campus/ibkr-api-page/webapi-ref/#tag/Account-Management-Utilities/paths/~1gw~1api~1v1~1enumerations~1%7BenumerationType%7D/get"><code>/gw/api/v1/enumerations/{enumerationType</code>}</a> for the value.</td>
<td>Name of the sending institution.</td>
</tr>
<tr class="odd">
<td>accountAtBroker</td>
<td>String</td>
<td>Client account number at sending institution.</td>
</tr>
<tr class="even">
<td>accountId</td>
<td>String</td>
<td>IBKR Account Number of the client account that is initiating the transfer.</td>
</tr>
<tr class="odd">
<td>signature</td>
<td>String</td>
<td>Signature should match applicants first name middle initial (if applicable) last name suffix (if applicable) *Data is case and space sensitive.</td>
</tr>
</tbody>
</table>

###### Example

``` wp-block-code
POST /gw/api/v1/external-asset-transfers

{
  "instructionType": "EXTERNAL_POSITION_TRANSFER",
  "instruction": {
    "clientInstructionId": 7013060,
    "type": "FULL",
    "subType": "ATON",
    "brokerId": "3265",
    "brokerName": "Wall Street Financial Group",
    "accountAtBroker": "SOL12345",
    "accountId": "U1225448",
    "signature": "John Tester"
  }
}
```

###### COMPLEX\_ASSET\_TRANSFER

Basic FOP (Free of Payment) is a method to transfer assets from financial institutions that are generally outside the US and can be used to transfer global equities, fixed income, structured products, and options

For a basic FOP, IBKR will coordinate with the Canadian, European, Middle East/African, Asia/Pacific financial institution on settlement instructions to transfer global equities, fixed income, structured products, and options on a free-of-payment basis.

To expedite the transfer process, pass settlement instructions for transfer request to IBKR via the API. The settlement data will be included within ` nonDisclosedDetail.  `This service is available by request only, contact your IBKR representative if interested in using this service.

  - **Inbound Transfer **(Transfer positions to IBKR): Transfer is initiated by delivering broker. The API can be used to create notification so IBKR is aware of the incoming transfer.
  - **Outgoing Transfer **(Transfer positions out of the IBKR account): From your account to another bank or broker.

###### Schema

<table>
<colgroup>
<col style="width: 33%" />
<col style="width: 33%" />
<col style="width: 33%" />
</colgroup>
<thead>
<tr class="header">
<th>Name</th>
<th>Type</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td>clientInstructionId</td>
<td>Number; max 20 characters.</td>
<td>Unique identifier associated with the request.<br />
– The <strong>clientInstructionId </strong>cannot be reused.<br />
– IBKR’s preference is that the <strong>clientInstructionId </strong>is established in sequential order ie 1, 2, 3, 4  or 100, 101, 102, 103 not 777, 589, 123.</td>
</tr>
<tr class="even">
<td>instructionType</td>
<td>COMPLEX_ASSET_TRANSFER</td>
<td>Type of transaction.</td>
</tr>
<tr class="odd">
<td>direction</td>
<td>IN<br />
OUT</td>
<td>Indicate if this is an incoming our outgoing transfer.<br />
<strong>IN</strong> = Incoming to IBKR<br />
<strong>OUT</strong>= Transferring out to third party Broker.</td>
</tr>
<tr class="even">
<td>accountId</td>
<td>String; maximum 32 characters.</td>
<td>IBKR Account Number of the client account that is initiating the transfer.</td>
</tr>
<tr class="odd">
<td><span></span>securityId</td>
<td>String</td>
<td>CUSIP/ISIN number of the security being transferred.</td>
</tr>
<tr class="even">
<td>quantity</td>
<td>Number</td>
<td>Number of shares being transferred in/out</td>
</tr>
<tr class="odd">
<td>assetType</td>
<td>BILL<br />
BOND<br />
CASH<br />
FUND<br />
OPT<br />
STK<br />
WAR</td>
<td>Product type. </td>
</tr>
<tr class="even">
<td>securityIdType</td>
<td>CUSIP<br />
ISIN<br />
CASH</td>
<td>Used to determine securityId  type that was provided. Either ISIN or CUSIP.</td>
</tr>
<tr class="odd">
<td>conId</td>
<td>String</td>
<td>Unique Contract ID assigned by Interactive Brokers.</td>
</tr>
<tr class="even">
<td>currency</td>
<td>Currency code (3 digits). Available currencies can be found <a href="https://www.interactivebrokers.com/en/support/fund-my-account.php">here</a>.</td>
<td>Currency of the assets being transferred. </td>
</tr>
<tr class="odd">
<td>accountType</td>
<td>INDIVIDUAL<br />
JOINT<br />
ORG<br />
TRUST</td>
<td>Account Type (at Financial Institution)</td>
</tr>
<tr class="even">
<td>brokerName</td>
<td>Use <code>/api/v1/enumerations/</code>complex-asset-transfer to get accepted values.</td>
<td>Name of Financial Institution</td>
</tr>
<tr class="odd">
<td>tradeDate</td>
<td>YYYY-MM-DD</td>
<td>Current or future date. Trade date cannot exceed settleDate. Date should not be more than 30 days in advance.</td>
</tr>
<tr class="even">
<td>settleDate</td>
<td>YYYY-MM-DD</td>
<td>Cannot be prior to current date.</td>
</tr>
<tr class="odd">
<td>depositoryId</td>
<td>String</td>
<td>ID at Depository.</td>
</tr>
<tr class="even">
<td>psetBic</td>
<td>String</td>
<td>Place of Settlement</td>
</tr>
<tr class="odd">
<td>reagDeagBic</td>
<td>String</td>
<td>ID code of delivering agent.</td>
</tr>
<tr class="even">
<td>buyrSellBic</td>
<td>String</td>
<td>ID Code of Buyer or Seller.</td>
</tr>
<tr class="odd">
<td>memberAccountId</td>
<td>String</td>
<td>Account ID for market.</td>
</tr>
<tr class="even">
<td>safekeepingAccount</td>
<td>String</td>
<td>Safekeeping Account</td>
</tr>
<tr class="odd">
<td>brokerAccountId</td>
<td>String</td>
<td>Client account number at the third party broker. </td>
</tr>
<tr class="even">
<td>country</td>
<td>Alpha-3 code (ISO)</td>
<td>Country which the contra broker is located.</td>
</tr>
<tr class="odd">
<td>contractName</td>
<td>String; max of 64 characters.</td>
<td>Name of the contact at the contra broker.</td>
</tr>
<tr class="even">
<td>contactEmail</td>
<td>String; max of 64 characters.</td>
<td>Email of the contact at the contra broker. Note: We use REGEX to validate the email. Validations outlined <a href="https://www.interactivebrokers.com/campus/ibkr-api/account-management-api/#required-42">here</a>.</td>
</tr>
<tr class="odd">
<td>contactPhone</td>
<td>String; max of 16 characters.</td>
<td>Phone number of the contact at the contra broker. Note: We use Google API to validate the Phone Number. Validations outlined <a href="https://www.interactivebrokers.com/campus/ibkr-api/account-management-api/#dependent-on-type-43">here</a>.</td>
</tr>
</tbody>
</table>

###### Example without Settlement Data

2 options for submitting request (securityId **OR **conId)

***Option 1: conID based request***

``` wp-block-code
POST /gw/api/v1/external-asset-transfers

{
  "instructionType": "COMPLEX_ASSET_TRANSFER",
  "instruction": {
    "clientInstructionId": 7013040,
    "direction": "IN",
    "accountId": "U399192",
    "quantity": 10,
    "contraBrokerInfo": {
      "accountType": "ORG",
      "brokerName": "JP MORGAN",
      "depositoryId": "1234",
      "brokerAccountId": "as3456567678578N",
      "country": "United States",
      "contactName": "as",
      "contactEmail": "a@gmail.com",
      "contactPhone": "2039126155"
    },
    "tradingInstrument": {
      "conId": 12123,
      "currency": "USD"
    }
  }
}
```

**Option 2: securityId based request**

``` wp-block-code
POST /gw/api/v1/external-asset-transfers

{
  "instructionType": "COMPLEX_ASSET_TRANSFER",
  "instruction": {
    "clientInstructionId": 7013042,
    "direction": "IN",
    "accountId": "U399192",
    "quantity": 10,
    "contraBrokerInfo": {
      "accountType": "ORG",
      "brokerName": "JP MORGAN",
      "depositoryId": "1234",
      "brokerAccountId": "as3456567678578N",
      "country": "United States",
      "contactName": "as",
      "contactEmail": "a@gmail.com",
      "contactPhone": "2039126155"
    },
    "tradingInstrument": {
      "tradingInstrumentDescription": {
        "securityIdType": "ISIN",
        "securityId": "459200101",
        "assetType": "STK"
      },
      "currency": "USD"
    }
  }
}
```

###### Example with Settlement Data

2 options for submitting request (securityId **OR **conId)  
***Option 1: conID based request***

``` wp-block-code
POST /gw/api/v1/external-asset-transfers

{
  "instructionType": "complex_asset_transfer",
  "instruction": {
    "clientInstructionId": 7013041,
    "direction": "IN",
    "accountId": "U399192",
    "quantity": 10,
    "contraBrokerInfo": {
      "accountType": "ORG",
      "brokerName": "JP MORGAN",
      "depositoryId": "1234",
      "brokerAccountId": "as3456567678578N",
      "country": "United States",
      "contactName": "as",
      "contactEmail": "a@gmail.com",
      "contactPhone": "2039126155"
    },
       "tradingInstrument": {
      "conId": 12123,
      "currency": "USD"
    },
    "nonDisclosedDetail": {
      "tradeDate": "2018-03-20T09:12:13Z",
      "settleDate": "2018-03-20T09:12:13Z",
      "psetBic": "OCSDATWWXXX",       
      "reagDeagBic": "TMBECH22XXX",
      "buyerSellBic": "TMBECH22XXX",
      "memberAccountId": "OCSD212100",
      "safeKeepingAccountId": "OCSD212100"
    }
  }
}
```

***Option 2: Security Id based request***

``` wp-block-code
POST /gw/api/v1/external-asset-transfers
{
  "instructionType": "complex_asset_transfer",
  "instruction": {
    "clientInstructionId": 7013041,
    "direction": "IN",
    "accountId": "U399192",
    "quantity": 10,
    "contraBrokerInfo": {
      "accountType": "ORG",
      "brokerName": "JP MORGAN",
      "depositoryId": "1234",
      "brokerAccountId": "as3456567678578N",
      "country": "United States",
      "contactName": "as",
      "contactEmail": "a@gmail.com",
      "contactPhone": "2039126155"
    },
    "tradingInstrument": {
      "tradingInstrumentDescription": {
        "securityIdType": "ISIN",
        "securityId": "459200101",
        "assetType": "STK"
      },
      "currency": "USD"
    },
    "nonDisclosedDetail": {
      "tradeDate": "2018-03-20T09:12:13Z",
      "settleDate": "2018-03-20T09:12:13Z",
      "psetBic": "OCSDATWWXXX",       
      "reagDeagBic": "TMBECH22XXX",
      "buyerSellBic": "TMBECH22XXX",
      "memberAccountId": "OCSD212100",
      "safeKeepingAccountId": "OCSD212100"
    }
  }
}
```

###### Example with Settlement Data if transferring between 2 IBKR Accounts

Only applicable for Non-Disclosed Clients using FOP to transfer assets between 2 different IBKR accounts.

If`  brokerName= 'IB' ` OR ‘`INTERNAL`‘, ` accountTitle  `AND ` accountIdAtCurrentBroker  `are required.

There are 2 options for submitting request (securityId **OR **conId)  
***Option 1: conID based request***

``` wp-block-code
POST /gw/api/v1/external-asset-transfers

{
  "instructionType": "complex_asset_transfer",
  "instruction": {
    "clientInstructionId": 7013041,
    "direction": "IN",
    "accountId": "U399192",
    "quantity": 10,
     "accountIdAtCurrentBroker": "U123456",
    "contraBrokerInfo": {
      "accountType": "ORG",
      "brokerName": "INTERNAL",
      "depositoryId": "1234",
      "brokerAccountId": "as3456567678578N",
      "country": "United States",
      "contactName": "as",
      "contactEmail": "a@gmail.com",
      "contactPhone": "2039126155"
      "accountTitle": "My Account Title"

    },
       "tradingInstrument": {
      "conId": 12123,
      "currency": "USD"
    },
    "nonDisclosedDetail": {
      "tradeDate": "2018-03-20T09:12:13Z",
      "settleDate": "2018-03-20T09:12:13Z",
      "psetBic": "OCSDATWWXXX",       
      "reagDeagBic": "TMBECH22XXX",
      "buyerSellBic": "TMBECH22XXX",
      "memberAccountId": "OCSD212100",
      "safeKeepingAccountId": "OCSD212100"
    }
  }
}
```

***Option 2: Security Id based request***

``` wp-block-code
POST /gw/api/v1/external-asset-transfers
{
  "instructionType": "complex_asset_transfer",
  "instruction": {
    "clientInstructionId": 7013041,
    "direction": "IN",
    "accountId": "U399192",
    "quantity": 10,    
     "accountIdAtCurrentBroker": "U123456",    
      "contraBrokerInfo": {
      "accountType": "ORG",
      "brokerName": "INTERNAL",
      "depositoryId": "1234",
      "brokerAccountId": "as3456567678578N",
      "country": "United States",
      "contactName": "as",
      "contactEmail": "a@gmail.com",
      "contactPhone": "2039126155",      
       "accountTitle": "My Account Title"},
    "tradingInstrument": {
      "tradingInstrumentDescription": {
        "securityIdType": "ISIN",
        "securityId": "459200101",
        "assetType": "STK"
      },
      "currency": "USD"
    },
    "nonDisclosedDetail": {
      "tradeDate": "2018-03-20T09:12:13Z",
      "settleDate": "2018-03-20T09:12:13Z",
      "psetBic": "OCSDATWWXXX",       
      "reagDeagBic": "TMBECH22XXX",
      "buyerSellBic": "TMBECH22XXX",
      "memberAccountId": "OCSD212100",
      "safeKeepingAccountId": "OCSD212100"
    }
  }
}
```

###### Common Errors

| **                  Error Code                                            **                                              | **Error Message Example:**                                                                                                                                                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **<span class="underline">Upload Validity Checks</span>**                                                                 |                                                                                                                                                                                                                                                                                                                   |
| ERROR\_BROKER\_NAME\_NOT\_FOUND                                                                                           | Error: Broker name HSBCSCB not found. Please query for [/api/v1/enumerations/complex-asset-transfer}](https://www.interactivebrokers.com/campus/ibkr-api-page/webapi-ref/#tag/Account-Management-Utilities/paths/~1gw~1api~1v1~1enumerations~1%7BenumerationType%7D/get) retrieve a list of all accepted brokers. |
| NON\_DISCLOSED\_VALIDATION\_FAILED\_FOR\_COMPLEX\_ASSET\_TRANSFER                                                         | Incomplete information for non-disclosed client, null/empty value detected in some of these fields for pset BIC: CIKBBEBBXX – reagDeagBic, buyrSellBic, memberAccountId, safekeepingAccount.                                                                                                                      |
| CORRUPT\_DATA\_INVALID\_ACCT                                                                                              | Account UXXXXX does not exist                                                                                                                                                                                                                                                                                     |
| ERROR\_ACCOUNT\_CP\_NOT\_RELATED                                                                                          | Account UXXXXX not related to counterparty **\<CounterPartyNameHere\>**                                                                                                                                                                                                                                           |
| UNSUPPORTED\_CHARACTERS\_ERROR                                                                                            | value contains illegal character(s). Character set not supported.                                                                                                                                                                                                                                                 |
| CORRUPT\_DATA\_DUBPLICATE\_CP                                                                                             | counterPartyTranId 1195814 already exists for counterparty **\<CounterPartyNameHere\>**                                                                                                                                                                                                                           |
| **<span class="underline">Processing Validity Checks</span>**                                                             |                                                                                                                                                                                                                                                                                                                   |
| **Error Code:                                                                                                          ** | ** Error Message Example:**                                                                                                                                                                                                                                                                                       |
| NOT\_OPEN\_ACCOUNT                                                                                                        | Account UXXXXX is not open                                                                                                                                                                                                                                                                                        |
| COMPLEX\_ASSET \_TRANSFER\_NOT\_ALLOWED                                                                                   | isTransferAllowed is fales for acctid:UXXXXX transfer\_method:FOP quantity:80 isFullTransfer:false Direction:OUT clearingBrokerID:JP MORGAN ibConId:34234                                                                                                                                                         |

## Status of Position Transfer Request

For ` fop  `AND `complexAssetTransfer`, the response returned by IBKR will include ` clearingState  `AND `status`. The status returns the overall status of the ` clearingState  `reflects stage in the transfer process.

| **clearing\_state**                   | **status** | **Notes**                                                                                                                                                                                                                        |
| ------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| REJECTED                              | REJECTED   | Transfer request was rejected.                                                                                                                                                                                                   |
| POSTED                                | PROCESSED  | The asset deliveries on your transfer request are now in progress.  Market instructions have been placed and settlement will occur once matched with your recipient broker.                                                      |
| SETTLED                               | PROCESSED  | Your transfer request is complete.                                                                                                                                                                                               |
| PROCESSED                             | PROCESSED  | The transfer request has been processed.                                                                                                                                                                                         |
| PARTIALLYSETTLED                      | PENDING    | Some of the assets on your transfer request have settled.                                                                                                                                                                        |
| APPROVED                              | PENDING    | Your transfer request has been approved for processing.                                                                                                                                                                          |
| SETTLEMENT\_INSTRUCTIONS\_TRANSMITTED | PENDING    | Transfer instruction submitted to counterparty.                                                                                                                                                                                  |
| FULLYENTERED                          | PENDING    | Your transfer request has been received and is being reviewed by the Transfers Department.  If you have not already notified your receiving broker, please do so now.                                                            |
| BROKER\_CONTACTED                     | PENDING    | We have contacted your broker/bank and are awaiting their response to confirm your transfer request.  They must agree to the transfer details before we can proceed.  If you have not already instructed them, please do so now. |
| ACKNOWLEDGED                          | PENDING    | IBKR has received the transfer request.                                                                                                                                                                                          |

## Reporting

IBKR offers comprehensive reporting capabilities to meet your business requirements. This section provides detailed guidance on accessing various reports through our API.

  - **[Activity Statements](https://www.interactivebrokers.com/campus/ibkr-api-page/web-api-account-management/#activity-statements)**: Activity Statements reflect all account activity including cash transactions, dividends, corporate actions, and trades.
  - **[Tax Forms](https://www.interactivebrokers.com/campus/ibkr-api-page/web-api-account-management/#tax-forms)**: Access tax documents for the last 5 years.
  - **[Trade Confirmations](https://www.interactivebrokers.com/campus/ibkr-api-page/web-api-account-management/#trade-confirmations)**: Trade confirmation generated in real-time for all executions.

## Activity Statements

Activity statements show summary of account activity for a given time period. This includes net asset value, PnL data and transaction details. The API can be used to view available statements and generate statements in PDF format.

### Available Statements

The ` gw/api/v1/statements/available  `can be used to query list of available statements based on `accountId`. The endpoint will return available statements for up to 2 years and year to date for daily, monthly and annual statements.

  - Statements are available from date which account is funded.
  - The reporting window closes at 5:15PM EST for commodities and 8:20PM EST for securities. Statements will be available around midnight (EST).

For daily, response will return first date available to last date available.

###### Example

``` wp-block-code
GET gw/api/v1/statements/available?accountId=U123456

{
    "data": {
        "dataType": "String",
        "value": {
            "daily": {
                "endDate": "20241007",
                "startDate": "20220101"
            },
            "monthly": [
                "202201",
                "202202",
                "202203",
                "202204",
                "202205",
                "202206",
                "202207",
                "202208",
                "202209",
                "202210",
                "202211",
                "202212",
                "202301",
                "202302",
                "202303",
                "202304",
                "202305",
                "202306",
                "202307",
                "202308",
                "202309",
                "202310",
                "202311",
                "202312",
                "202401",
                "202402",
                "202403",
                "202404",
                "202405",
                "202406",
                "202407",
                "202408",
                "202409"
            ],
            "annual": [
                "2022",
                "2023"
            ]
        }
    }
}
```

### Generate Statements

The [`gw/api/v1/statements`](https://www.interactivebrokers.com/campus/ibkr-api-page/webapi-ref/#tag/Account-Management-Reports/paths/~1gw~1api~1v1~1statements/post) can be used to generate standard statements in PDF format for given time period. The ` startDate  `and ` endDate  `will be used to set the time period.

  - Maximum range is 365 days per request.
  - Statements are only available from date which account is funded.

Additional formats (Excel, CSV, HTML) and Custom Statements are available for download within IBKR [Portal](https://www.ibkrguides.com/clientportal/performanceandstatements/statements.htm).

###### Request Parameters

###### Schema

<table>
<colgroup>
<col style="width: 33%" />
<col style="width: 33%" />
<col style="width: 33%" />
</colgroup>
<thead>
<tr class="header">
<th>Name</th>
<th>Type</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td>accountId</td>
<td>string</td>
<td>The IBKR accountId which statement is being requested for.</td>
</tr>
<tr class="even">
<td>accountIds</td>
<td>Array of strings</td>
<td>array of accountId’s</td>
</tr>
<tr class="odd">
<td>startDate</td>
<td>YYYYMMDD</td>
<td>From date</td>
</tr>
<tr class="even">
<td>endDate</td>
<td>YYYYMMDD</td>
<td>Last reporting date to be included.</td>
</tr>
<tr class="odd">
<td>multiAccountFormat</td>
<td>consolidate<br />
concatenate<br />
customConsolidate</td>
<td><strong>consolidate:  </strong>A single statement with consolidated data for<br />
all sub accounts in a merged format.
<p><strong>concatenate:</strong> Includes all sub accounts as separate sections, in a format similar to selecting multiple accounts<br />
<strong><br />
customConsolidate</strong>: <strong> </strong>A single statement with consolidated data for custom group of sub accounts in a merged format.</p></td>
</tr>
<tr class="even">
<td>cryptoConsolIfAvailable</td>
<td>true<br />
false</td>
<td>Default is false. If request contains any accounts with crypto segment, will turn request into Crypto Consolidated</td>
</tr>
<tr class="odd">
<td>mimeType</td>
<td>application/pdf</td>
<td>Output format of the statement.</td>
</tr>
<tr class="even">
<td>language</td>
<td>en<br />
tw<br />
cn<br />
fr<br />
de<br />
es<br />
it<br />
ru<br />
ja<br />
pt</td>
<td>two character ISO language code<br />
Default: “en”
<p>tw= Chinese Traditional<br />
cn= Chinese Simplified<br />
fr= French<br />
de= German<br />
es= Spanish<br />
it= Italian<br />
ru= Russian<br />
ja= Japanese<br />
pt = Portuguese</p></td>
</tr>
<tr class="odd">
<td>gzip</td>
<td>true<br />
false</td>
<td>Default is false, If set to true, the response will be compressed (gzip).</td>
</tr>
</tbody>
</table>

###### Example

<table>
<colgroup>
<col style="width: 25%" />
<col style="width: 25%" />
<col style="width: 25%" />
<col style="width: 25%" />
</colgroup>
<thead>
<tr class="header">
<th>Period</th>
<th>startDate</th>
<th>endDate</th>
<th>Example</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td>Annual</td>
<td>YYYY</td>
<td>YYYY</td>
<td><code>POST gw/api/v1/statements</code><br />
<code>{ accountId: "U12345", startDate: "2023", endDate: "2023", mimeType: "application/pdf" }</code></td>
</tr>
<tr class="even">
<td>Monthlies</td>
<td>YYYYMM</td>
<td>YYYYMM</td>
<td><code>POST gw/api/v1/statements</code><br />
<code>{ accountId: "U12345", startDate: "202304", endDate: "202304", mimeType: "application/pdf" }</code></td>
</tr>
<tr class="odd">
<td>Custom Date Range</td>
<td>YYYYMMDD</td>
<td>YYYYMMDD</td>
<td><code>POST gw/api/v1/statements</code><br />
<code>{ accountId: "U12345", startDate: "20230401", endDate: "20230425", mimeType: "application/pdf" }</code></td>
</tr>
</tbody>
</table>

## Tax Forms

View available tax forms and generate historical or current tax forms by account ID.

### Available Tax Forms

The ` gw/api/v1/tax-documents/available  `can be used to query list of available tax forms based on `accountId`.

  - Tax Form availability
      - Form 1099 (Consolidated) will be available February 15 for the immediately preceding year.
      - Form 1099-R for IRA accounts will be available by January 31 for the immediately preceding year.
      - Form 5498 for IRA accounts will be available by May 31 for the immediately preceding year.

For more information on available tax forms, please visit our main [website](https://www.interactivebrokers.com/en/support/tax-overview.php).

###### Example

``` wp-block-code
GET gw/api/v1/tax-documents/available?accountId=U123456&year=2022

{
"data": {
"dataType": "String",
"value": {
"forms": [
{
"isForm": true,
"taxFormName": "1099",
"formats": [
"PDF"
]
}
]
}
}
}
```

### Generate Tax Documents

The [`gw/api/v1/tax-documents`](https://www.interactivebrokers.com/campus/ibkr-api-page/webapi-ref/#tag/Account-Management-Reports/paths/~1gw~1api~1v1~1tax-documents/post) can be used to generate tax documents in PDF, HTML or CSV format for given tax year.

###### Request Parameters

###### Schema

<table>
<colgroup>
<col style="width: 33%" />
<col style="width: 33%" />
<col style="width: 33%" />
</colgroup>
<thead>
<tr class="header">
<th>Name</th>
<th>Type</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td>accountId</td>
<td>string</td>
<td>The IBKR accountId which tax form is being requested for.</td>
</tr>
<tr class="even">
<td>year</td>
<td>YYYY</td>
<td>Tax Year</td>
</tr>
<tr class="odd">
<td>format</td>
<td>HTML<br />
CSV<br />
PDF</td>
<td>Format of tax form</td>
</tr>
<tr class="even">
<td>type</td>
<td>1099<br />
1099R<br />
1042S<br />
8949<br />
All</td>
<td>Type of tax form to be generated.</td>
</tr>
<tr class="odd">
<td>gzip</td>
<td>true<br />
false</td>
<td>Default is false, If set to true, the response will be compressed (gzip).</td>
</tr>
</tbody>
</table>

###### Example

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th>Example</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td><code>POST gw/api/v1/tax-documents</code><br />
<code>{"accountId": "UXXXX","year": 2023,"type": "ALL,1099,1099R,1042S,8949","format": "HTML,CSV,PDF","gzip": false}</code></td>
</tr>
</tbody>
</table>

## Trade Confirmations

Real-time trade confirmations are generated for all executions.

### Available Trade Confirmations

The ` gw/api/v1/trade-confimations/available  `can be used to view dates which trade confirmations are available for based on `accountId`. The endpoint will only return dates which account placed trades and will return available dates for up to 2 years.

For daily, response will return first date available to last date available.

###### Example

``` wp-block-code
GET gw/api/v1/trade-confirmations/available?accountId=U123456

{
    "data": {
        "dataType": "String",
        "value":["20230428","20230731","20231031","20240102","20240430","20240731","20241031","20241231","20250411","20250430"]
    }
}
```

### Generate Trade Confirmation

The [`gw/api/v1/trade-confirmations`](https://www.interactivebrokers.com/campus/ibkr-api-page/webapi-ref/#tag/Account-Management-Reports/paths/~1gw~1api~1v1~1statements/post) can be used to generate standard trade confirmations in PDF format for given time period. The ` startDate  `and ` endDate  `will be used to set the time period.

  - Maximum range is 365 days per request.
  - Trade confirmations are only available for days which trades are placed.

Additional formats (Excel, CSV, HTML) are available for download within IBKR [Portal](https://www.ibkrguides.com/clientportal/performanceandstatements/statements.htm).

###### Request Parameters

###### Schema

<table>
<colgroup>
<col style="width: 33%" />
<col style="width: 33%" />
<col style="width: 33%" />
</colgroup>
<thead>
<tr class="header">
<th>Name</th>
<th>Type</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td>accountId</td>
<td>string</td>
<td>The IBKR accountId which statement is being requested for.</td>
</tr>
<tr class="even">
<td>accountIds</td>
<td>Array of strings</td>
<td>array of accountId’s</td>
</tr>
<tr class="odd">
<td>startDate</td>
<td>YYYYMMDD</td>
<td>From date</td>
</tr>
<tr class="even">
<td>endDate</td>
<td>YYYYMMDD</td>
<td>Last reporting date to be included.</td>
</tr>
<tr class="odd">
<td>multiAccountFormat</td>
<td>consolidate<br />
concatenate<br />
customConsolidate</td>
<td><strong>consolidate:  </strong>A single statement with consolidated data for<br />
all sub accounts in a merged format.
<p><strong>concatenate:</strong> Includes all sub accounts as separate sections, in a format similar to selecting multiple accounts<br />
<strong><br />
customConsolidate</strong>: <strong> </strong>A single statement with consolidated data for custom group of sub accounts in a merged format.</p></td>
</tr>
<tr class="even">
<td>cryptoConsolIfAvailable</td>
<td>true<br />
false</td>
<td>Default is false. If request contains any accounts with crypto segment, will turn request into Crypto Consolidated</td>
</tr>
<tr class="odd">
<td>mimeType</td>
<td>application/pdf</td>
<td>Output format of the statement.</td>
</tr>
<tr class="even">
<td>language</td>
<td>en<br />
tw<br />
cn<br />
fr<br />
de<br />
es<br />
it<br />
ru<br />
ja<br />
pt</td>
<td>two character ISO language code<br />
Default: “en”
<p>tw= Chinese Traditional<br />
cn= Chinese Simplified<br />
fr= French<br />
de= German<br />
es= Spanish<br />
it= Italian<br />
ru= Russian<br />
ja= Japanese<br />
pt = Portuguese</p></td>
</tr>
<tr class="odd">
<td>gzip</td>
<td>true<br />
false</td>
<td>Default is false, If set to true, the response will be compressed (gzip).</td>
</tr>
</tbody>
</table>

###### Example

``` wp-block-code
POST gw/api/v1/trade-confirmations{ accountId: "U12345", startDate: "20230401", endDate: "20230425", mimeType: "application/pdf" }
{
    "data": {
        "dataType": "byte[]",
        "mimeType": "application/pdf",
        "encoding": "base64",
        "value": "BaseEncoded64String"
    },
    "accept": "*/*"
}
```

###### Example

<table>
<colgroup>
<col style="width: 33%" />
<col style="width: 33%" />
<col style="width: 33%" />
</colgroup>
<thead>
<tr class="header">
<th>startDate</th>
<th>endDate</th>
<th>Example</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td>YYYYMMDD</td>
<td>YYYYMMDD</td>
<td><code>POST gw/api/v1/trade-confirmations</code><br />
<code>{ accountId: "U12345", startDate: "20230401", endDate: "20230425", mimeType: "application/pdf" }</code></td>
</tr>
</tbody>
</table>

## Single Sign On

The `/api/v1/sso-browser-sessions` endpoint can be used to create Single Sign On (SSO) session to seamlessly connect user to the IBKR Client Portal. The IBKR Client Portal is a browser based interface where users can view portfolio information, manage account settings, manage orders, initiate funding, and access account statements. The portal will reflect hosting firms branding (logo, company name, color theme) IF white branding is configured. Parameters for target page are case and space sensitive.

#### Workflow

1.  Hosting firm will call the`  /api/v1/sso-browser-sessions ` and provide ` credential  `and `ip` of the end user.
      - ` credential:  `IBKR username associated with the user.
      - ` ip:  `Static IP is required and must be the actual customer’s computer (their IP-REMOTE\_ADDR).
      - ***Example***
          - `POST /api/v1/sso-browser-sessions { "ip": "206.106.137.230", "credential": "potest123"}`
2.  IBKR returns a response URL with SID (unique token). Hosting firm invokes the URL with SID token into the users browser, new window opens and the user lands in IBKR White Branded Portal.
      - SID is only valid for 60 seconds and can only be accessed from the IP which was included in the original request.
      - Error will be triggered IF unique SID is accessed more than once, entered after 60 seconds, OR if IP which SID is accessed from is different from IP that was passed in the original request to create single sign on session.
      - ***Example of IBKR Response***
          - `https://www.clientam.com/sso/resolver?<SID=<asdfsadf>`
3.  Optionally, set ‘Target’ page by appending ACTION to URL
      - See details [here](https://www.interactivebrokers.com/campus/ibkr-api-page/web-api-account-management/#single-sign-on) to set target page including available actions.
          - ***Example of URL if target page is set for Statements***
              - `https://www.clientam.com/sso/resolver?ACTION=Statement&SID=<asdfsadf>`

#### Limitations

  - SSO is only supported for browsers (Desktop or Mobile Browser). SSO is not supported for natively installed mobile applications.
  - When an account is initially created, IBKR will assign a temporary password to the account. One time setup where the user is required to reset the temporary password after the account has been created.
  - Authentication using the IBKR credential (username) and password is required when adding withdrawal instructions and initiating withdrawal requests using the IBKR hosted portal.

### Set Target Page

By default, when you create an SSO session for an opened account, your users will land on the Client Portal home page. However, you can direct users to a specific target page by adding the `ACTION` parameter to your start call.

If you set a target page, the IBKR navigation panel will be displayed by default, allowing users to access other features within the Portal beyond just the target page.

For a more streamlined experience, we offer an “IFRAME” option that removes the IBKR navigation panel. To create IFRAME, simply include `showNavBar=false` in your SSO URL.

<table>
<colgroup>
<col style="width: 50%" />
<col style="width: 50%" />
</colgroup>
<thead>
<tr class="header">
<th>SSO- Standard</th>
<th>SSO with IFRAME</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td>ACTION=TransferFunds&amp;method=WIRE&amp;type=WITHDRAWAL&amp;currency=<strong>USD</strong><img src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMSIgaGVpZ2h0PSIxIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjwvc3ZnPg==" class="lazyload" /></td>
<td>ACTION=TransferFunds&amp;method=WIRE&amp;type=WITHDRAWAL&amp;currency=USD&amp;showNavBar=false<br />
<img src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMSIgaGVpZ2h0PSIxIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjwvc3ZnPg==" class="lazyload" /><br />
</td>
</tr>
<tr class="even">
<td></td>
<td></td>
</tr>
</tbody>
</table>

### Request Parameters

<table>
<colgroup>
<col style="width: 33%" />
<col style="width: 33%" />
<col style="width: 33%" />
</colgroup>
<thead>
<tr class="header">
<th>Parameter</th>
<th>Type</th>
<th>Usage</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td>ACTION</td>
<td>Varies based on action, see table below.</td>
<td>Optional- If not set OR invalid, user is directed to the Client Portal home page.</td>
</tr>
<tr class="even">
<td>showNavBar</td>
<td>true<br />
false</td>
<td>Optional- If missing OR set to true, user will land on Client Portal home page.
<p>If set to false, navigation bar will not be displayed and this will create ‘IFRAME’.</p>
<p>showNavBar=false is only supported for select features. IF set for unsupported feature, user will land on Client Portal home page.</p></td>
</tr>
</tbody>
</table>

#### Common Target Pages

<table>
<colgroup>
<col style="width: 33%" />
<col style="width: 33%" />
<col style="width: 33%" />
</colgroup>
<thead>
<tr class="header">
<th>Landing Page</th>
<th>ACTION</th>
<th>IFRAME Supported?</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td>Account Settings</td>
<td>ACTION=AccountSettings&amp;SID=&lt;&gt;</td>
<td>Y</td>
</tr>
<tr class="even">
<td>Auto Select Account (for Linked Accounts) </td>
<td>If the autoSelect parameter is passed with an account ID, portal will select that account on the landing page (if the account is available for selection).<br />
Example where U1234 = Account ID<br />
ACTION=autoSelect=U1234&amp;noPickerClear=T
<p>Example if using auto select for Funding:  ACTION=TransferFunds&amp;autoSelect=U1234&amp;noPickerClear=T</p></td>
<td>N</td>
</tr>
<tr class="odd">
<td>Link Existing Account to master</td>
<td>forwardTo=AA_LINKAGE&amp;masterAccountId=&lt;InsertMasterAccountIDHere&gt;</td>
<td>N</td>
</tr>
<tr class="even">
<td>Client Profile</td>
<td>ACTION=AccountSettings&amp;config=Profile&amp;SID=&lt;&gt;</td>
<td>Y</td>
</tr>
<tr class="odd">
<td>Recurring Investments</td>
<td>ACTION=RecurringInvestment&amp;SID=&lt;&gt;</td>
<td>Y</td>
</tr>
<tr class="even">
<td>Saved Banking Instructions</td>
<td>ACTION=FUNDING_INSTRUCTIONS&amp;SID=&lt;&gt;</td>
<td>N</td>
</tr>
<tr class="odd">
<td>Statements</td>
<td>ACTION=Statement&amp;SID=&lt;&gt;</td>
<td>Y</td>
</tr>
<tr class="even">
<td>Trading Permissions</td>
<td>ACTION=AccountSettings&amp;config=TradingPermissions&amp;SID=&lt;&gt;</td>
<td>Y</td>
</tr>
<tr class="odd">
<td>Transaction History</td>
<td><strong>Funding:</strong> ACTION=TransactionHistory&amp;SID=&lt;&gt;<br />
<strong>All Transactions:</strong> ACTION=RpTransactionHistory&amp;SID=&lt;&gt;</td>
<td>Y</td>
</tr>
<tr class="even">
<td>Transfer Funds</td>
<td><strong>ACTION</strong>=TransferFunds&amp;SID=&lt;&gt;
<p><em>The following parameters can be set IF ACTION=TransferFunds<br />
</em><strong>type</strong>: DEPOSIT or WITHDRAWAL<br />
<strong>method</strong>: ACH, BPAY_NOTIFICATION, BILL_PAY_NOTIFICATION, CHECK_NOTIFICATION, DIRECT_DEPOSIT, EDDA, EFT, LVP, OPEN_BANKING, WIRE, WISE_BALANCE, WISE_BANK_NOTIFICATION,, WISE_OUTBOUND,<br />
<strong>currency</strong>: USD, CAD, HKD, CNH, EUR, GBP, AUD</p>
<p><strong>A few examples below:</strong><br />
<strong>Deposit</strong> (Display all saved instructions): ACTION=TransferFunds&amp;type=DEPOSIT&amp;currency=USD&amp;SID=&lt;&gt;<br />
<strong>ACH Deposit:</strong> ACTION=TransferFunds&amp;method=ACH&amp;type=DEPOSIT&amp;currency=USD&amp;SID=&lt;&gt;<br />
<strong>EFT Deposit:</strong> ACTION=TransferFunds&amp;method=EFT&amp;type=DEPOSIT&amp;currency=CAD&amp;SID=&lt;&gt;<br />
<strong>Open Banking</strong> <strong>Plaid Europe:</strong> ACTION=TransferFunds&amp;type=DEPOSIT&amp;method=OPEN_BANKING&amp;currency=&lt;GBP<strong>or</strong>EUR&gt;<br />
<strong>Wire Deposit:</strong> ACTION=TransferFunds&amp;method=WIRE_NOTIFICATION&amp;type=DEPOSIT&amp;currency=<strong>XXX</strong><br />
<strong>Wise Balance:</strong> ACTION=TransferFunds&amp;method=WISE_BALANCE&amp;type=DEPOSIT&amp;currency=XXX<br />
<strong>Wise Deposit:</strong> ACTION=TransferFunds&amp;method=WISE_BANK_NOTIFICATION&amp;type=DEPOSIT&amp;currency=<strong>XXX</strong></p>
<p><strong>Withdrawal</strong> (Display all saved instructions): ACTION=TransferFunds&amp;type=WITHDRAWAL&amp;currency=USD&amp;SID=&lt;&gt; <br />
<strong>ACH Withdrawal:</strong> ACTION=TransferFunds&amp;method=ACH&amp;type=WITHDRAWAL&amp;currency=<strong>XXX</strong><br />
<strong>EFT Withdrawal:</strong> ACTION=TransferFunds&amp;method=EFT&amp;type=WITHDRAWAL&amp;currency=CAD&amp;SID=&lt;&gt;<br />
<strong>Local Bank Transfer:</strong> ACTION=TransferFunds&amp;method=LVP&amp;type=WITHDRAWAL&amp;currency=<strong>XXX</strong><br />
<strong>SEPA Withdrawal:</strong> ACTION=TransferFunds&amp;method=SEPA&amp;type=WITHDRAWAL&amp;currency=<strong>XXX</strong><br />
<strong>Wire Withdrawal:</strong> ACTION=TransferFunds&amp;method=WIRE&amp;type=WITHDRAWAL&amp;currency=<strong>XXX</strong><br />
<strong>Wise Withdrawal:</strong> ACTION=TransferFunds&amp;method=WISE_OUTBOUND&amp;type=WITHDRAWAL&amp;currency=<strong>XXX</strong></p></td>
<td>Y</td>
</tr>
<tr class="odd">
<td>Transfer Positions</td>
<td><strong>ACTION</strong>=TransferPositions&amp;SID=&lt;&gt;
<p><em>The following parameters can be set IF ACTION=TransferPositions<br />
</em><strong>type</strong>: POSITION_INBOUND, POSITION_OUTBOUND, INTERNAL<br />
<strong>method:</strong> ACATS, ATON, FOP, DWAC, ASSET_TRANSFER</p>
<p><strong>A few examples below:</strong><br />
<strong>Incoming ACATS Transfer:</strong> ACTION=TransferPositions&amp;type=POSITION_INBOUND&amp;method=ACATS&amp;SID=&lt;&gt;<br />
<strong>Incoming US FOP:</strong> ACTION=TransferPositions&amp;type=POSITION_INBOUND&amp;method=FOP&amp;SID=&lt;&gt;<br />
<strong>Internal Transfer:</strong> ACTION=INTERNAL&amp;SID=&lt;&gt;<br />
<strong>Outgoing Basic Non-US FOP:</strong> ACTION=TransferPositions&amp;type=POSITION_OUTBOUND&amp;method=ASSET_TRANSFER&amp;SID=&lt;&gt;</p></td>
<td>Y</td>
</tr>
</tbody>
</table>

###### View All Landing Pages

| Target                                       | ACTION                                                                                                                                     | Limitations                                                                                                                                                                                                  |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Account Alias                                | ACTION=AccountSettings\&config=AccountAlias\&SID=\<\>                                                                                      |                                                                                                                                                                                                              |
| Account Confirmation Letter                  | ACTION=RM\_ACCOUNT\_CONFIRMATION\_LETTER\&SID=\<\>                                                                                         |                                                                                                                                                                                                              |
| Account Inheritance                          | ACTION=AccountSettings\&config=AccountBeneficiary\&SID=\<\>                                                                                |                                                                                                                                                                                                              |
| Account Type                                 | ACTION=ACCOUNT\_TYPE\&SID=\<\>                                                                                                             |                                                                                                                                                                                                              |
| Account Type                                 | ACTION=AccountSettings\&config=AccountType\&SID=\<\>                                                                                       |                                                                                                                                                                                                              |
| Activity Notifications                       | ACTION=AM\_NOTIFICATIONS\&SID=\<\>                                                                                                         |                                                                                                                                                                                                              |
| Add External Account                         | ACTION=ADD\_EXTERNAL\_ACCOUNTS\&SID=\<\>                                                                                                   |                                                                                                                                                                                                              |
| Administrator Search                         | ACTION=TA\_VIEW\_ADM\_MKT\_PLACE\&SID=\<\>                                                                                                 |                                                                                                                                                                                                              |
| Advertise Services                           | ACTION=MpApply\&SID=\<\>                                                                                                                   |                                                                                                                                                                                                              |
| Advisor Authorizations                       | ACTION=AccountSettings\&config=AdvisorAuthorizations\&SID=\<\>                                                                             |                                                                                                                                                                                                              |
| Advisor Search                               | ACTION=ADVISORS\_MKT\_PLACE\_SEARCH\&SID=\<\>                                                                                              |                                                                                                                                                                                                              |
| Alert Notification                           | ACTION=ALERT\_NOTIFICATION\&SID=\<\>                                                                                                       |                                                                                                                                                                                                              |
| Alert Notification                           | ACTION=UserSettings\&config=AlertNotification\&SID=\<\>                                                                                    |                                                                                                                                                                                                              |
| ASIC Short Positions Reporting               | ACTION=AccountSettings\&config=AsicShortPosition\&SID=\<\>                                                                                 |                                                                                                                                                                                                              |
| Audit Trail                                  | ACTION=AccountSettings\&config=AuditTrail\&SID=\<\>                                                                                        |                                                                                                                                                                                                              |
| Base Currency                                | ACTION=AccountSettings\&config=BaseCurrency\&SID=\<\>                                                                                      |                                                                                                                                                                                                              |
| Bill Pay                                     | ACTION=BILL\_PAY\&SID=\<\>                                                                                                                 |                                                                                                                                                                                                              |
| Cash Management                              | ACTION=CASH\_MGMT\&SID=\<\>                                                                                                                |                                                                                                                                                                                                              |
| CFDs and Metals                              | ACTION=AccountSettings\&config=UklAccountCreation\&SID=\<\>                                                                                |                                                                                                                                                                                                              |
| Chat under Support                           | ACTION=CS\_CHAT\&SID=\<\>                                                                                                                  |                                                                                                                                                                                                              |
| Close Account                                | ACTION=CLOSE\_ACCOUNT\&SID=\<\>                                                                                                            |                                                                                                                                                                                                              |
| Close Account                                | ACTION=AccountSettings\&config=CloseAccount\&SID=\<\>                                                                                      |                                                                                                                                                                                                              |
| Commission Pricing Structure                 | ACTION=COMM\_PRICE\_STRUCTURE\&SID=\<\>                                                                                                    |                                                                                                                                                                                                              |
| Contact IB                                   | ACTION=CS\_CONTACT\_IB\&SID=\<\>                                                                                                           |                                                                                                                                                                                                              |
| Contract Details                             | ACTION=CONTRACT\_DETAILS\&SID=\<\>                                                                                                         |                                                                                                                                                                                                              |
| Contract Search                              | ACTION=CS\_CONTRACT\_SEARCH\&SID=\<\>                                                                                                      |                                                                                                                                                                                                              |
| Corp Action                                  | ACTION=CS\_CORP\_ACTION\&SID=\<\>                                                                                                          |                                                                                                                                                                                                              |
| Debit Card Signup for Clients                | ACTION=AccountSettings\&config=ClientDebitcardConfig\&SID=\<\>                                                                             |                                                                                                                                                                                                              |
| Declared Investor Status                     | ACTION=AccountSettings\&config=SingaporeInvestorCategory\&SID=\<\>                                                                         |                                                                                                                                                                                                              |
| Dividend Election                            | ACTION=AccountSettings\&config=DividendReinvestment\&SID=\<\>                                                                              |                                                                                                                                                                                                              |
| Email Address                                | ACTION=CHANGE\_EMAIL\&SID=\<\>                                                                                                             |                                                                                                                                                                                                              |
| Email Address                                | ACTION=UserSettings\&config=EmailAddress\&SID=\<\>                                                                                         |                                                                                                                                                                                                              |
| EMIR & LEI Information                       | ACTION=AccountSettings\&config=Emir\&SID=\<\>                                                                                              |                                                                                                                                                                                                              |
| Excess Funds Sweep                           | ACTION=AccountSettings\&config=ExcessFundsSweep\&SID=\<\>                                                                                  |                                                                                                                                                                                                              |
| Exposure Fee                                 | ACTION=RM\_EXPOSURE\_FEE\&SID=\<\>                                                                                                         |                                                                                                                                                                                                              |
| Financial Info                               | ACTION=FINANCIAL\_INFO\&SID=\<\>                                                                                                           |                                                                                                                                                                                                              |
| Financial Profile                            | ACTION=AccountSettings\&config=FinancialInfo\&SID=\<\>                                                                                     |                                                                                                                                                                                                              |
| Financial Transactions                       | ACTION=FINANCIAL\_TRANS\_HISTORY\&SID=\<\>                                                                                                 |                                                                                                                                                                                                              |
| Find Services                                | ACTION=MpSearch\&SID=\<\>                                                                                                                  |                                                                                                                                                                                                              |
| Flex Queries                                 | ACTION=RM\_FLEX\_QUERIES\&SID=\<\>                                                                                                         |                                                                                                                                                                                                              |
| Flex Queries Delivery                        | ACTION=FLEX\_QUERIES\_DELIVERY\&SID=\<\>                                                                                                   |                                                                                                                                                                                                              |
| Flex Queries Delivery                        | ACTION=UserSettings\&config=FlexQueriesDelivery\&SID=\<\>                                                                                  |                                                                                                                                                                                                              |
| Flex Web Service                             | ACTION=AccountSettings\&config=FlexWebService\&SID=\<\>                                                                                    |                                                                                                                                                                                                              |
| FYI Notifications                            | ACTION=AccountSettings\&config=IbfyiNotification\&SID=\<\>                                                                                 |                                                                                                                                                                                                              |
| Goal Tracker                                 | ACTION=GoalTracker\&SID=\<\>                                                                                                               |                                                                                                                                                                                                              |
| Groups & Households                          | ACTION=Groups\&SID=\<\>                                                                                                                    |                                                                                                                                                                                                              |
| HFCIP Search                                 | ACTION=TA\_HFCI\_VIEW\&SID=\<\>                                                                                                            |                                                                                                                                                                                                              |
| IB FYI                                       | ACTION=TA\_FYI\&SID=\<\>                                                                                                                   |                                                                                                                                                                                                              |
| IB Notes                                     | ACTION=AccountSettings\&config=IbNotes\&SID=\<\>                                                                                           |                                                                                                                                                                                                              |
| IB SLB Tools                                 | ACTION=CS\_SLB\&SID=\<\>                                                                                                                   |                                                                                                                                                                                                              |
| IBKR Pricing Plan                            | ACTION=IBKR\_LITE\&SID=\<\>                                                                                                                |                                                                                                                                                                                                              |
| IBKR Pricing Plan                            | ACTION=AccountSettings\&config=ibkrLite\&SID=\<\>                                                                                          |                                                                                                                                                                                                              |
| Institutional Services                       | ACTION=AccountSettings\&config=InstitutionalService\&SID=\<\>                                                                              |                                                                                                                                                                                                              |
| Insured Bank Deposit Sweep Program           | ACTION=AccountSettings\&config=PROMONTORY\_CONFIG\&SID=\<\>                                                                                |                                                                                                                                                                                                              |
| Investor Category                            | ACTION=AccountSettings\&config=InvestorCategory\&SID=\<\>                                                                                  |                                                                                                                                                                                                              |
| IP Restrictions                              | ACTION=UserSettings\&config=IpRestriction\&SID=\<\>                                                                                        |                                                                                                                                                                                                              |
| IPO Subscription Permission                  | ACTION=AccountSettings\&config=IpoSubscriptionConfig\&SID=\<\>                                                                             |                                                                                                                                                                                                              |
| IRA Activity                                 | ACTION=AccountSettings\&config=IraActivity\&SID=\<\>                                                                                       |                                                                                                                                                                                                              |
| IRA Conversion                               | ACTION=AccountSettings\&config=IraConversion\&SID=\<\>                                                                                     |                                                                                                                                                                                                              |
| IRA Recharacterization                       | ACTION=AccountSettings\&config=IraRecharacterization\&SID=\<\>                                                                             |                                                                                                                                                                                                              |
| Large Trader ID                              | ACTION=AccountSettings\&config=LargeTraderId\&SID=\<\>                                                                                     |                                                                                                                                                                                                              |
| Link Account to Advisor/Broker/Administrator | ACTION=LINK\_ACCOUNT\&SID=\<\>                                                                                                             |                                                                                                                                                                                                              |
| Link Account to Advisor/Broker/Administrator | ACTION=AccountSettings\&config=Linkage\&SID=\<\>                                                                                           |                                                                                                                                                                                                              |
| Manage Administrators                        | ACTION=AccountSettings\&config=AdminManagement\&SID=\<\>                                                                                   |                                                                                                                                                                                                              |
| Market Data Assistant                        | ACTION=CS\_MARKET\_DATA\_ASSISTANT\&SID=\<\>                                                                                               |                                                                                                                                                                                                              |
| Market Data Restriction                      | ACTION=UserSettings\&config=MarketDataRestriction\&SID=\<\>                                                                                |                                                                                                                                                                                                              |
| Market Data Subscriptions                    | ACTION=UserSettings\&config=MarketData\&SID=\<\>                                                                                           |                                                                                                                                                                                                              |
| Market Overview                              | ACTION=ACCT\_MGMT\_MAIN\&loginType=1\&clt=0\&RL=1\#/markets\&SID=\<\>                                                                      |                                                                                                                                                                                                              |
| Marketing Preference                         | ACTION=MKT\_PREFERENCE\&SID=\<\>                                                                                                           |                                                                                                                                                                                                              |
| Marketing Preferences                        | ACTION=UserSettings\&config=MarketingPreference\&SID=\<\>                                                                                  |                                                                                                                                                                                                              |
| Message Center                               | ACTION=CS\_WEB\_TICKET\&SID=\<\>                                                                                                           |                                                                                                                                                                                                              |
| Message Center Notification Settings         | ACTION=UserSettings\&config=MessageCenterNotification\&SID=\<\>                                                                            |                                                                                                                                                                                                              |
| Message Center Notifications                 | ACTION=CS\_MESSAGE\_CENTER\_NOTIFICATIONS\&SID=\<\>                                                                                        |                                                                                                                                                                                                              |
| Mifid Client Category                        | ACTION=MIFID\_CLIENT\_CATEGORY\&SID=\<\>                                                                                                   |                                                                                                                                                                                                              |
| MiFID Client Category                        | ACTION=AccountSettings\&config=MifidClientCategory\&SID=\<\>                                                                               |                                                                                                                                                                                                              |
| Mifir                                        | ACTION=AccountSettings\&config=Mifir\&SID=\<\>                                                                                             |                                                                                                                                                                                                              |
| Mobile Number                                | ACTION=UserSettings\&config=MobileNumber\&SID=\<\>                                                                                         |                                                                                                                                                                                                              |
| Mobile Number Configuration                  | ACTION=MOBILE\_VERIFICATION\&SID=\<\>                                                                                                      |                                                                                                                                                                                                              |
| Money Manager Search                         | ACTION=TA\_VIEW\_MM\_MKT\_PLACE\&SID=\<\>                                                                                                  |                                                                                                                                                                                                              |
| New Features Poll (New) / Provide Feedback   | ACTION=FEEDBACK\&SID=\<\>                                                                                                                  |                                                                                                                                                                                                              |
| New ticket creation                          | ACTION=NEW\_TICKET\&SID=\<\>                                                                                                               |                                                                                                                                                                                                              |
| Non-US Dividend Tax Relief                   | ACTION=AccountSettings\&config=DividendTaxRelief\&SID=\<\>                                                                                 |                                                                                                                                                                                                              |
| Online Features                              | ACTION=UserSettings\&config=VoterSubscription\&SID=\<\>                                                                                    |                                                                                                                                                                                                              |
| Online Features (a.k.a. Voter Registration)  | ACTION=UM\_VOTER\_REGISTRATION\&SID=\<\>                                                                                                   |                                                                                                                                                                                                              |
| Open an Additional Account                   | ACTION=AccountSettings\&config=AdditionalAccount\&SID=\<\>                                                                                 |                                                                                                                                                                                                              |
| Order Ticket                                 | ACTION=ACCT\_MGMT\_MAIN\&loginType=1\&clt=0\&RL=1\#/order-ticket/stock\&SID=\<\>                                                           | Requires a minimum of 1200px width. If smaller then we only provide side-car order ticket which doesn’t open on a new page. Meaning, this can only be used when connecting from desktop browser, not mobile. |
| Other Reports                                | ACTION=RM\_MARGIN\_REPORTS\&SID=\<\>                                                                                                       |                                                                                                                                                                                                              |
| Paper Trading Account                        | ACTION=AccountSettings\&config=PaperTrading\&SID=\<\>                                                                                      |                                                                                                                                                                                                              |
| Paper Trading Account Reset                  | ACTION=AccountSettings\&config=PaperTradingReset\&SID=\<\>                                                                                 |                                                                                                                                                                                                              |
| Paper Trading Configuration                  | ACTION=TA\_PAPER\_TRADING\&SID=\<\>                                                                                                        |                                                                                                                                                                                                              |
| Password                                     | ACTION=UserSettings\&config=Password\&SID=\<\>                                                                                             |                                                                                                                                                                                                              |
| Password Change                              | ACTION=PASSWORDCHG\&SID=\<\>                                                                                                               |                                                                                                                                                                                                              |
| PDT Reset under Support                      | ACTION=PDTRESET\_STATUSCHECKED\&SID=\<\>                                                                                                   |                                                                                                                                                                                                              |
| Pending Items                                | ACTION=DOC\&SID=\<\>                                                                                                                       |                                                                                                                                                                                                              |
| Portfolio                                    | ACTION=ACCT\_MGMT\_MAIN\&loginType=1\&clt=0\&RL=1\#/portfolio\&SID=\<\>                                                                    |                                                                                                                                                                                                              |
| Portfolio Analyst                            | ACTION=PA\_DELIVERY\&SID=\<\>                                                                                                              |                                                                                                                                                                                                              |
| Portfolio Analyst                            | ACTION=PORTFOLIOANALYST\&SID=\<\>                                                                                                          |                                                                                                                                                                                                              |
| PortfolioAnalyst                             | ACTION=RM\_PORTFOLIO\_ANALYST\&SID=\<\>                                                                                                    |                                                                                                                                                                                                              |
| PortfolioAnalyst Delivery                    | ACTION=UserSettings\&config=PaDelivery\&SID=\<\>                                                                                           |                                                                                                                                                                                                              |
| PRIIPS                                       | ACTION=CS\_PRIIPS\&SID=\<\>                                                                                                                |                                                                                                                                                                                                              |
| Professional Advisor Qualification           | ACTION=AccountSettings\&config=ProAdvisorQualification\&SID=\<\>                                                                           |                                                                                                                                                                                                              |
| Profile                                      | [ACTION=AccountSettings\&config=Profile\&SID=\<\>](https://www.clientam.com/sso/resolver?action=AccountSettings&config=Profile&sid=%3c%3e) |                                                                                                                                                                                                              |
| Promontory                                   | ACTION=promontory\&SID=\<\>                                                                                                                |                                                                                                                                                                                                              |
| Questionnaire                                | ACTION=QUESTIONNAIRE\&SID=\<\>                                                                                                             |                                                                                                                                                                                                              |
| Read-Only Access                             | ACTION=UserSettings\&config=TradingReadOnly\&SID=\<\>                                                                                      |                                                                                                                                                                                                              |
| Read-only Setting                            | ACTION=TA\_MOBILE\_READONLY\&SID=\<\>                                                                                                      |                                                                                                                                                                                                              |
| Refer a Friend                               | ACTION=AccountSettings\&config=FriendReferral\&SID=\<\>                                                                                    |                                                                                                                                                                                                              |
| Registration Information                     | ACTION=AccountSettings\&config=JurisdictionInfo\&SID=\<\>                                                                                  |                                                                                                                                                                                                              |
| Regulatory Information                       | ACTION=AccountSettings\&config=RegulatoryInformation\&SID=\<\>                                                                             |                                                                                                                                                                                                              |
| Required Minimum Distribution Calculator     | ACTION=Rmd\&SID=\<\>                                                                                                                       |                                                                                                                                                                                                              |
| Research Subscriptions                       | ACTION=TA\_DATA\_SERVICES\&SID=\<\>                                                                                                        |                                                                                                                                                                                                              |
| Research Subscriptions                       | ACTION=UserSettings\&config=ResearchSubscription\&SID=\<\>                                                                                 |                                                                                                                                                                                                              |
| Risk Appetite Questionnaire                  | ACTION=AccountSettings\&config=BondRiskAppetite\&SID=\<\>                                                                                  |                                                                                                                                                                                                              |
| Risk Scores                                  | ACTION=RiskScores\&SID=\<\>                                                                                                                |                                                                                                                                                                                                              |
| Risk Scores                                  | ACTION=AccountSettings\&config=AdvisorQuestionnaireEdito\&SID=\<\>                                                                         |                                                                                                                                                                                                              |
| Section 13                                   | ACTION=AccountSettings\&config=Acors\&SID=\<\>                                                                                             |                                                                                                                                                                                                              |
| Secure Login Settings                        | ACTION=SECURE\_LOGIN\&SID=\<\>                                                                                                             |                                                                                                                                                                                                              |
| Secure Login System                          | ACTION=UserSettings\&config=SecureLogin\&SID=\<\>                                                                                          |                                                                                                                                                                                                              |
| Securities Class Action Recovery             | ACTION=AccountSettings\&config=litigationRecovery\&SID=\<\>                                                                                |                                                                                                                                                                                                              |
| Security Questions                           | ACTION=UserSettings\&config=SecurityQuestions\&SID=\<\>                                                                                    |                                                                                                                                                                                                              |
| Settings                                     | ACTION=ACCOUNT\_SETTINGS\&SID=\<\>                                                                                                         |                                                                                                                                                                                                              |
| SFTR                                         | ACTION=AccountSettings\&config=Sftr\&SID=\<\>                                                                                              |                                                                                                                                                                                                              |
| SMS Address                                  | ACTION=UserSettings\&config=SmsAddress\&SID=\<\>                                                                                           |                                                                                                                                                                                                              |
| SMS Alerts                                   | ACTION=SMS\_ALERTS\&SID=\<\>                                                                                                               |                                                                                                                                                                                                              |
| SMS Alerts                                   | ACTION=UserSettings\&config=SmsAlerts\&SID=\<\>                                                                                            |                                                                                                                                                                                                              |
| Soft Dollar Configuration                    | ACTION=AccountSettings\&config=SoftDollar\&SID=\<\>                                                                                        |                                                                                                                                                                                                              |
| Soft Dollars Disbursement                    | ACTION=AccountSettings\&config=SoftDollarDisbursement\&SID=\<\>                                                                            |                                                                                                                                                                                                              |
| Statements                                   | ACTION=Statement\&SID=\<\>                                                                                                                 |                                                                                                                                                                                                              |
| Statements Delivery                          | ACTION=UserSettings\&config=StatementsDelivery\&SID=\<\>                                                                                   |                                                                                                                                                                                                              |
| Stock Yield Enhancement Program              | ACTION=AccountSettings\&config=SYEP\&SID=\<\>                                                                                              |                                                                                                                                                                                                              |
| Support                                      | ACTION=Support\&SID=\<\>                                                                                                                   |                                                                                                                                                                                                              |
| Tax Reports                                  | ACTION=RM\_FIFO\_COST\_BASIS\&SID=\<\>                                                                                                     |                                                                                                                                                                                                              |
| Tax Reports                                  | ACTION=RM\_TAX\_FORMS\&SID=\<\>                                                                                                            |                                                                                                                                                                                                              |
| Third-Party Services                         | ACTION=AccountSettings\&config=ThirdPartyServices\&SID=\<\>                                                                                |                                                                                                                                                                                                              |
| Tools page under support                     | ACTION=IB\_TOOLS\&SID=\<\>                                                                                                                 |                                                                                                                                                                                                              |
| Trade Cancellation Request                   | ACTION=CS\_TRADE\_CANCEL\&SID=\<\>                                                                                                         |                                                                                                                                                                                                              |
| Trade Execution Notification                 | ACTION=UserSettings\&config=ActivityNotification\&SID=\<\>                                                                                 |                                                                                                                                                                                                              |
| Trade In Fractions                           | ACTION=TRADE\_IN\_FRACTIONS\&SID=\<\>                                                                                                      |                                                                                                                                                                                                              |
| Trade in Fractions                           | ACTION=AccountSettings\&config=tradeInFrACTIONs\&SID=\<\>                                                                                  |                                                                                                                                                                                                              |
| Trader Referral                              | ACTION=AccountSettings\&config=TraderReferral\&SID=\<\>                                                                                    |                                                                                                                                                                                                              |
| Trading Permissions                          | ACTION=AccountSettings\&config=TradingPermissions\&SID=\<\>                                                                                |                                                                                                                                                                                                              |
| Trading Restrictions                         | ACTION=AccountSettings\&config=TradingRestrictions\&SID=\<\>                                                                               |                                                                                                                                                                                                              |
| Trusted Contact Person                       | ACTION=AccountSettings\&config=TrustedContact\&SID=\<\>                                                                                    |                                                                                                                                                                                                              |
| VAT                                          | ACTION=AccountSettings\&config=SalesTax\&SID=\<\>                                                                                          |                                                                                                                                                                                                              |
| Virtual FX Tracking                          | ACTION=AccountSettings\&config=VirtualFxPortfolioTracking\&SID=\<\>                                                                        |                                                                                                                                                                                                              |
| White Branding                               | ACTION=AccountSettings\&config=WhiteBranding\&SID=\<\>                                                                                     |                                                                                                                                                                                                              |
| Why is it moving                             | ACTION=ACCT\_MGMT\_MAIN\&loginType=1\&clt=0\&RL=1\#/markets\&SID=\<\>                                                                      |                                                                                                                                                                                                              |

## Callback Notifications

IBKR will send notifications via RESTful Web API when status of a request changes. The notifications provided via the callback service have the same format as polling for a status (ie. `/gw/api/v1/accounts/{accountId}/status`) . Notifications are available for Client Registration, Account Information Changes, and Funding Requests that originate using Account Management API and IBKR Portal.

###### Enable Callback Service

1.  Callback service is available by request only. To configure the service, provide the following information to am-api@interactivebrokers.com:
      - URL which callback notifications should be sent to
      - Master account ID which the callback service should be configured for
2.  IBKR will register the URL and configure the callback service for your account. This can take 2-3 weeks.
      - Clients enabled for Callback Notification can still use Polling for Status without any restrictions.

#### View Callback Notifications

Callback notification is sent as a signed JWT.

  - Content-Type header: application/jwt

The [**api.ibkr.com/oauth2/api/v1/jwks**](https://api.ibkr.com/oauth2/api/v1/jwks) URL can be used to locate corresponding public key that is used to validate the signature.

###### Example

<table>
<colgroup>
<col style="width: 25%" />
<col style="width: 25%" />
<col style="width: 25%" />
<col style="width: 25%" />
</colgroup>
<thead>
<tr class="header">
<th>Service</th>
<th>request_type</th>
<th>Sample Notification (Accepted)</th>
<th>Sample Notification (Rejected)</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td>POST /gw/api/v1/accounts</td>
<td>ACCT_OPENING</td>
<td><code>{  "timestamp":"2021-08-18 12:07:31",  "request_type": "ACCT_OPENING",  "ref_acct_id":"U3519306",  "status":"OPENED"}</code></td>
<td><code>{  "timestamp":"2021-08-18 12:07:31",  "request_type": "ACCT_OPENING",  "ref_acct_id":"U3519306",  "status":"REJECTED"}</code></td>
</tr>
<tr class="even">
<td>PATCH /gw/api/v1/accounts ‘AddCLPCapability’</td>
<td>ADD_CLP</td>
<td><code>{  "timestamp":"2021-08-18 12:07:31",  "request_type": "ADD_CLP",  "status": "ACCEPTED",  "ref_acct_id":"U3519306"}</code></td>
<td><code>{  "timestamp":"2021-08-18 12:07:31",  "request_type": "ADD_CLP",   "status":"REJECTED"  "ref_acct_id":"U3519306"}</code></td>
</tr>
<tr class="odd">
<td>PATCH /gw/api/v1/accounts<br />
‘AddLEVFXCapability’</td>
<td>ADD_LEVFX</td>
<td><code>{  "timestamp":"2021-08-18 12:07:31",  "request_type": "ADD_LEVFX",  "status": "ACCEPTED",  "ref_acct_id":"U3519306"}</code></td>
<td><code>{  "timestamp":"2021-08-18 12:07:31",  "request_type": "ADD_LEVFX",   "status":"REJECTED"  "ref_acct_id":"U3519306"}</code></td>
</tr>
<tr class="even">
<td>PATCH /gw/api/v1/accounts<br />
‘AddTradingPermissions’</td>
<td>ADD_TRADING</td>
<td><code>{  "timestamp":"2021-08-18 12:07:31",  "request_type": "ADD_TRADING",  "ref_acct_id":"U3519306",  "details": {    "bundle": "US-Sec",    "status": "ACCEPTED"  }}</code></td>
<td><code>{  "timestamp":"2021-08-18 12:07:31",  "request_type": "ADD_TRADING",  "ref_acct_id":"U3519306",  "details": {    "bundle": "US-Sec",   "status":"REJECTED"  }}</code></td>
</tr>
<tr class="odd">
<td>PATCH /gw/api/v1/accounts<br />
‘ChangeFinancialInformation’</td>
<td>CHANGE_FIN_INFO</td>
<td><code>{  "timestamp":"2021-08-18 12:07:31",  "request_type": "CHANGE_FIN_INFO",  "status": "ACCEPTED",  "ref_acct_id":"U3519306"}</code></td>
<td><code>{  "timestamp":"2021-08-18 12:07:31",  "request_type": "CHANGE_FIN_INFO",   "status":"REJECTED"  "ref_acct_id":"U3519306"}</code></td>
</tr>
<tr class="even">
<td>PATCH /gw/api/v1/accounts<br />
‘ChangeMarginType’</td>
<td>CHANGE_MARGIN </td>
<td><code>{  "timestamp":"2021-08-18 12:07:31",  "request_type": "CHANGE_MARGIN",  "status": "ACCEPTED",  "ref_acct_id":"U3519306"}</code></td>
<td><code>{  "timestamp":"2021-08-18 12:07:31",  "request_type": "CHANGE_MARGIN",   "status":"REJECTED"  "ref_acct_id":"U3519306"}</code></td>
</tr>
<tr class="odd">
<td>PATCH /gw/api/v1/accounts<br />
‘DocumentSubmission’</td>
<td>DOC_SUBMISSION</td>
<td><code>{  "timestamp":"2021-08-18 12:07:31",  "request_type": "DOC_SUBMISSION",  "ref_acct_id":"U3519306",  "details": {    "form_number": "9490",    "status": "ACCEPTED",    "external_id": "ext_id_first_holder"  }}</code></td>
<td><code>{  "timestamp":"2021-08-18 12:07:31",  "request_type": "DOC_SUBMISSION",  "ref_acct_id":"U3519306",  "details": {    "form_number": "9490",   "status":"REJECTED"    "external_id": "ext_id_first_holder"  }}</code></td>
</tr>
<tr class="even">
<td>PATCH /gw/api/v1/accounts<br />
‘RemoveTradingPermissions’</td>
<td>REMOVE_TRADING</td>
<td><code>{  "timestamp":"2021-08-18 12:07:31",  "request_type": "REMOVE_TRADING",  "ref_acct_id":"U3519306",  "details": {    "bundle": "US-Sec",    "status": "REMOVED"  }}</code></td>
<td><code>{  "timestamp":"2021-08-18 12:07:31",  "request_type": "REMOVE_TRADING",  "ref_acct_id":"U3519306",  "details": {    "bundle": "US-Sec",   "status":"REJECTED"  }}</code></td>
</tr>
<tr class="odd">
<td>/gw/api/v1/bank-instructions*<br />
/gw/api/v1/client-instructions*<br />
/gw/api/v1/instruction*<br />
/gw/api/v1/external-asset-transfers*<br />
/gw/api/v1/external-cash-transfers*<br />
/gw/api/v1/internal*</td>
<td>All ‘POST’ requests</td>
<td><code>{    "status": 200,    "instructionSetId": 7760,    "instructionResult": {        "clientInstructionId": 169652918901,        "instructionType": "deposit_funds",        "instructionStatus": "PROCESSED",        "instructionId": 11453869    }}</code></td>
<td></td>
</tr>
</tbody>
</table>

## Application Schema

While fields for registration will vary based on various factors including the account type, IB entity, and permissions, the JSON should always include the following:

  - customer
  - accounts
  - users

This section includes information on objects and attributes for client registration, validations, and supported enumerations. List of required fields for client application based on account type can be found [here](https://www.interactivebrokers.com/campus/ibkr-api-page/web-api-account-management/#data-for-client-registration).

### Enumerations

The `/api/v1/enumerations/{enumerationType}` [](https://api.ibkr.com/gw/api/v1/enumerations/%7BenumerationType%7D) can be used to obtain supported enumerations for select attributes and objects.

#### Supported Types

<table>
<colgroup>
<col style="width: 33%" />
<col style="width: 33%" />
<col style="width: 33%" />
</colgroup>
<thead>
<tr class="header">
<th>Type</th>
<th>Description</th>
<th>Query Filters (Optional)</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td><code class="EnlighterJSRAW" data-enlighter-language="generic">acats</code></td>
<td>Query most up to date values for brokerId and brokerName. Used if funding via US ACATS extPositionsTransfers.</td>
<td> </td>
</tr>
<tr class="even">
<td><code class="EnlighterJSRAW" data-enlighter-language="generic">aton</code></td>
<td>Query most up to date values for brokerId and brokerName. Used if funding via ATON Canada extPositionsTransfers.</td>
<td> </td>
</tr>
<tr class="odd">
<td><code class="EnlighterJSRAW" data-enlighter-language="generic">business-and-occupation</code></td>
<td>List of occupation AND employerBusiness for employmentDetails.  </td>
<td> </td>
</tr>
<tr class="even">
<td><code class="EnlighterJSRAW" data-enlighter-language="generic">complex-asset-transfer</code></td>
<td>Query most up to date values for brokerName. Used if submitting a ComplexAssetTransfer (Basic FOP)</td>
<td> </td>
</tr>
<tr class="odd">
<td><code class="EnlighterJSRAW" data-enlighter-language="generic">employee-plans</code></td>
<td>View EPA that are linked to master account (applicable IF offering SEP IRA accounts).</td>
<td> </td>
</tr>
<tr class="even">
<td><code class="EnlighterJSRAW" data-enlighter-language="generic">employee-track</code></td>
<td>Query most up to date companyId for account. For affiliationDetails, if company has an existing IBKR Employee Track account.  </td>
<td> </td>
</tr>
<tr class="odd">
<td><code class="EnlighterJSRAW" data-enlighter-language="generic">exchange-bundles</code></td>
<td>Query most up to date list of exchangeGroup for TradingPermissions.</td>
<td> </td>
</tr>
<tr class="even">
<td><code class="EnlighterJSRAW" data-enlighter-language="generic">fin-info-ranges</code></td>
<td>Query most up to date range IDs by currency  for annualNetIncome, netWorth, liquidNetWorth.</td>
<td>currency<br />
ibEntity</td>
</tr>
<tr class="odd">
<td><code class="EnlighterJSRAW" data-enlighter-language="generic">market-data</code></td>
<td>View list of market data subscriptions.</td>
<td> </td>
</tr>
<tr class="even">
<td><code class="EnlighterJSRAW" data-enlighter-language="generic">product-country-bundles</code></td>
<td>Query most up to date list of product bundles (country and product) for TradingPermissions.</td>
<td></td>
</tr>
<tr class="odd">
<td><code class="EnlighterJSRAW" data-enlighter-language="generic">prohibited-country</code></td>
<td>View list of prohibited countries. Applicants that reside in prohibited country are restricted from opening an account with IBKR. Error will be thrown IF legalResidenceCountry, OR country (included within Residence, mailingAddress and employerAddress, taxResidency node) is a prohibited country.</td>
<td> </td>
</tr>
<tr class="even">
<td><code class="EnlighterJSRAW" data-enlighter-language="generic">questionnaires</code></td>
<td>Query questions associated with EDD (Enhanced Due Diligence) or AVT (Additional Verification) tasks assigned to an account.  </td>
<td>form-number</td>
</tr>
<tr class="odd">
<td><code class="EnlighterJSRAW" data-enlighter-language="generic">quiz-questions</code></td>
<td>Obtain list of questions associated with IBKR knowledge assessment.  </td>
<td>form-number</td>
</tr>
<tr class="even">
<td><code class="EnlighterJSRAW" data-enlighter-language="generic">security-questions</code></td>
<td>Obtain list of questions supported for IBKR security questions.</td>
<td> </td>
</tr>
</tbody>
</table>

## AssociatedIndividual

AssociatedIndividual represents data for individuals that are associated with the account. Required fields for the individual fill vary based on the association and account type.

  - **Individual**: customer \> accountHolder \> accountHolderDetails
  - **Retirement**:
      - customer \> accountHolder \> accountHolderDetails
      - accounts\> iraBeneficiaries \> primaryBeneficiaries **AND** contingentBeneficiaries
  - **Joint**: customer \> jointHolder \> firstHolderDetails **and** secondHolderDetails
  - **Trust**: customer \> trust \> grantors **AND** beneficiaries
  - **Organization**: customer \> organization \> associatedEntities \> associatedIndividuals **AND** associatedEntities

#### Required

###### externalId

Unique identifier associated with the individual defined by counterparty.

  - The `externalId`, `externalUserId`, and ` externalIndividualId  `are unique identifiers which the counterparty assigns. The identifier can be used as a mapping to map the IBKR account with the account/user information within counterparty’s system.
  - ` externalId  `is present within application multiple times including:
      - ` customer  `= Represents the customer which the account is associated with
      - `accountHolderDetails, firstHolderDetails, secondHolderDetails`: Represents Individuals associated with the account.
      - ` accountHolder, jointHolder  `= Represents the account itself
      - ` users  `(` externalUserId  `and `externalIndividualId`)= Represents users associated with the account.

| Name                                                                                                                                    | Description               |
| --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| externalId <sub><span class="mark has-inline-color has-vivid-red-color" style="background-color:rgba(0, 0, 0, 0)">required</span></sub> | String; max 64 characters |

##### Sample

|                                        |
| -------------------------------------- |
| `"externalId": "testapplication1234",` |

##### Required

| <sub>FD</sub> | <sub>FA</sub> | <sub>OWD</sub> | <sub>NonQI</sub> | <sub>ND-QI</sub> | <sub>ND-QI (NT)</sub> |
| ------------- | ------------- | -------------- | ---------------- | ---------------- | --------------------- |
| <sub>✓</sub>  | <sub>✓</sub>  | <sub>✓</sub>   | <sub>✓</sub>     | <sub>✓</sub>     | <sub>✓</sub>          |

###### name

Legal name of the associated individual.

|                                                                                    |
| ---------------------------------------------------------------------------------- |
| {`"name": {"first": "Jane", "middle": "May", "last": "Doe" ,"salutation":"Mrs."},` |

<table>
<colgroup>
<col style="width: 33%" />
<col style="width: 33%" />
<col style="width: 33%" />
</colgroup>
<thead>
<tr class="header">
<th>Name</th>
<th>Type</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td>first</td>
<td>String; max characters 50</td>
<td>Legal first name of the applicant. </td>
</tr>
<tr class="even">
<td>middle</td>
<td>String; max characters 50</td>
<td>Middle name of the applicant.</td>
</tr>
<tr class="odd">
<td>last</td>
<td>String; max characters 50</td>
<td>Legal last name of the applicant.</td>
</tr>
<tr class="even">
<td>salutation</td>
<td>Mr.<br />
Mrs.<br />
Ms.<br />
Dr.<br />
Mx.<br />
Ind.</td>
<td>Salutation of the applicant.</td>
</tr>
</tbody>
</table>

  - The ` first  `and ` last  `are required. If either are missing, error will be thrown.

###### email

Email address of the associated individual.

|                           |
| ------------------------- |
| `"email": test@ibkr.com,` |

| Name  | Type   | Description                             |
| ----- | ------ | --------------------------------------- |
| email | String | Email address of the associated person. |

  - Regular Expression (REGEX)  
    `^[A-Z0-9][A-Z0-9._%+-]{0,63}@(?:(?=[A-Z0-9-]{1,63}[.])[A-Z0-9]+(?:-[A-Z0-9]+)*[.]){1,8}[A-Z]{2,63}$`
  - Error thrown if email address is same as master account.

###### residenceAddress

Provide the residential address where the individual physically resides.

|                                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------- |
| {`"residenceAddress": {"street1": "1 Tester Street", "city": "London", "state": "GB-ENG" ,"country":"GBR","postalCode": "SW10 9QL"},` |

<table>
<colgroup>
<col style="width: 33%" />
<col style="width: 33%" />
<col style="width: 33%" />
</colgroup>
<thead>
<tr class="header">
<th>Name</th>
<th>Type</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td>country</td>
<td><a href="https://www.iso.org/obp/ui">3 Digit ISO Code</a></td>
<td>Country which the applicant resides.</td>
</tr>
<tr class="even">
<td>state</td>
<td><a href="https://www.iso.org/obp/ui#search">3166-2 ISO Code</a></td>
<td>State/Province which the applicant resides.</td>
</tr>
<tr class="odd">
<td>city</td>
<td>String; Max characters 100</td>
<td>City which the applicant resides.</td>
</tr>
<tr class="even">
<td>postalCode</td>
<td>String; Max characters 20</td>
<td>Postal / Zip code.<br />
For countries that do not provide postal code, please enter “00000″</td>
</tr>
<tr class="odd">
<td>street1</td>
<td>String; Max characters 200</td>
<td>Street which applicant resides</td>
</tr>
<tr class="even">
<td>street22</td>
<td>String; Max characters 200</td>
<td>Street which applicant resides</td>
</tr>
</tbody>
</table>

  - If the mailing address is different from the address provided in ` residenceAddress  `element, THEN you will also include ` mailingAddress  `element.
  - Post Office Box is not accepted for `residentialAddress`.
  - Our system validates ` street1  `and ` street2  `included within ` residenceAddress  `attribute to ensure Post Office Box address is not provided.
      - An error will be thrown if the below combinations are included within `street1 `OR `street2`:
          - PB
          - PO Box
          - Post Office Box
          - P.O. Box
          - In care of
          - General Delivery
      - Regular Expression to validate street\_1 and street\_2:
          - English: `(?:P(?:ost(?:al)?)?[\.\-\s]*(?:(?:O(?:ffice)?[\.\s]*)?B(?:ox|in|\b|\d)|o(?:ffice|\b)(?:[-\s]*\d)|code)|box[-\s]*\d)`
          - Chinese Simplified: `PO Box    (?i)\b((邮政信箱) [0-9]*)\bChinese Traditional: PO Box   (?i)\b((郵政信箱) [0-9]*)\b`

<!-- end list -->

| <sub>FD</sub> | <sub>FA</sub> | <sub>OWD</sub> | <sub>NonQI</sub> | <sub>ND-QI</sub> | <sub>ND-QI (NT)</sub> |
| ------------- | ------------- | -------------- | ---------------- | ---------------- | --------------------- |
| <sub>✓</sub>  | <sub>✓</sub>  | <sub>✓</sub>   | <sub>✓</sub>     | <sub>✓</sub>     | <sub>✓</sub>          |

#### Dependent on type

###### countryOfBirth

Country which the individual was born.

|                            |
| -------------------------- |
| `"countryOfBirth": "GBR",` |

| Name           | Type                                           | Description                           |
| -------------- | ---------------------------------------------- | ------------------------------------- |
| CountryOfBirth | [3 Digit ISO Code](https://www.iso.org/obp/ui) | Country which the applicant was born. |

  - Accounts are accepted from citizens or residents of all countries except citizens or residents of those countries that are prohibited by the US Office of Foreign Assets Control.
  - [Click here](https://www.interactivebrokers.com/en/index.php?f=7021&nhf=T) for a list of all available countries.
  - If countryOfBirth is classified as a ‘Prohibited Country’, ` prohibitedCountryQuestionnaire  `is required.
  - List of Prohibited Countries an be obtained using [ ](https://www.ibkrguides.com/dameca/Endpoint/getECAEnumerations.htm)`/api/v1/enumerations/prohibited-country` endpoint.

###### dateOfBirth

Date of birth of the associated individual.

|                               |
| ----------------------------- |
| `"dateOfBirth": "1990-08-14"` |

| Name        | Type       | Description                                                                                 |
| ----------- | ---------- | ------------------------------------------------------------------------------------------- |
| dateOfBirth | YYYY-MM-DD | Date of birth of the applicant. The applicant must be 18 years or older to open an account. |

  - If the YYY-MM-DD \< 18 years error will be triggered and the account will not be created.
  - If YYYY-MM-DD \< 21 the applicant is restricted to opening a CASH account only.
  - UGMA and UTMA accounts are available for minors 18 years of age or younger. An individual or entity who manages an account for a minor until that minor reaches a specific age. Available to US residents only.
      - This application must be opened using the front-end application which is available within the IBKR Portal.
      - Assets held in a single account managed by a single Custodian user.
  - Error will be thrown if ` dateOfBirth  `is any value other than YYYY-MM-DD. The below formats will trigger errors:

###### employmentDetails

Provide the Employment Details of the associated individual if EMPLOYED or SELFEMPLOYED

|                                                                                                                                                                                                                                                                                                                                                                                                                       |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `"employmentDetails": {              "employer": "My Test Employer",              "occupation": "ACCOUNTANT",              "employerBusiness": "ARCHITECTURE_ENGINEERING",              "employerAddress": {                "street1": "Grays Inn Road",                "city": "London",                "state": "GB-ENG",                "country": "GBR",                "postalCode": "WC1X 8PX"              }`} |

| Name                         | Type                                                                       | Description                                                                           |
| ---------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| employer                     | String; max characters 128                                                 | Name of the employer                                                                  |
| employerBusiness             | Use `/api/v1/enumerations/business-and-occupation` to get accepted values. |                                                                                       |
| occupation                   | `/api/v1/enumerations/business-and-occupation` to get accepted values.     |                                                                                       |
| country                      | [3 Digit ISO Code](https://www.iso.org/obp/ui)                             | Country which the employer is located.                                                |
| state                        | [3166-2 ISO Code](https://www.iso.org/obp/ui#search)                       | State/Province which the employer is located.                                         |
| city                         | String; Max characters 100                                                 | City which the employer is located.                                                   |
| postalCode                   | String; Max characters 20                                                  | Postal / Zip code.For countries that do not provide postal code, please enter “00000″ |
| street1                      | String; Max characters 200                                                 | Street which employer is located.                                                     |
| emplCountryResCountryDetails | String; Max characters 200                                                 | Explain why country of employment is different from country of current residence.     |
| description                  | String; Max characters 200                                                 | Required IF business OR occupation= OTHER\*Other is not case/space sensitive.         |

  - ` employmentType: "EMPLOYED"  `OR “SELFEMPLOYED”
      - FA and FD clients with IBLLC, IB-IE, IB-CE, and IB-UK: Full `employerAddress `(`country, state, city, street1, postalCode`) is required
      - All other clients, `country` within ` employerAddress  `is required.
  - If `employmentType:“EMPLOYED"`
  - `employmentType: "SELFEMPLOYED"`
      - ` employerAddress  `can be the same as ` residenceAddress  `OR `mailingAddress`.
  - EmploymentType=”EMPLOYED” OR “SELFEMPLOYED”
      - When the country included within ` residenceAddress  `node is different from the country included within ` employerAddress  `node, THEN ` emplCountryResCountryDetails  `is required within the ` employmentDetails  `node.

###### employmentType

Employment status of the associated person.

|                                 |
| ------------------------------- |
| `"employmentType": "EMPLOYED",` |

<table>
<colgroup>
<col style="width: 33%" />
<col style="width: 33%" />
<col style="width: 33%" />
</colgroup>
<thead>
<tr class="header">
<th>Name</th>
<th>Type</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td>employmentType</td>
<td>UNEMPLOYED<br />
EMPLOYED<br />
SELFEMPLOYED<br />
RETIRED<br />
STUDENT<br />
ATHOMETRADER<br />
HOMEMAKER</td>
<td>Employment Status of the associated individual. </td>
</tr>
</tbody>
</table>

  - IF ` employmentType  `= EMPLOYED OR SELFEMPLOYED THEN [EmploymentDeta](https://www.interactivebrokers.com/campus/ibkr-api-page/web-api-account-management/#associatedindividual-25)[ils](https://www.ibkrguides.com/dameca/Schema/EmployerDetails.htm#_EmployerDetails) are required.

###### gender

Gender of the applicant.

|                     |
| ------------------- |
| `"gender": "MALE",` |

<table>
<colgroup>
<col style="width: 33%" />
<col style="width: 33%" />
<col style="width: 33%" />
</colgroup>
<thead>
<tr class="header">
<th>Name</th>
<th>Type</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td>gender</td>
<td>Male<br />
Female</td>
<td>Gender of the Applicant. </td>
</tr>
</tbody>
</table>

  - Required for India and EEA applicants that are required to report MiFIR Data.
  - MiFIR Transaction Reporting applies to European Economic Area (“EEA”) Investment Firms. As a client of an investment firm that uses the platform, you may be required to provide additional information to allow the proper transaction reports to be filed. [More Information](https://ibkb.interactivebrokers.com/node/2974)

###### identification

Identification information of the associated individual.

Acceptable **id document** is dependent the country which associated individual resides.

###### alienCard

All countries except for USA, CAN, HKG and IND.

`"identification": {"citizenship": "MEX", "alienCard": "989444798", "issuingCountry": "MEX"},`

###### driversLicense

Australia

`"identification": {"citizenship": "AUS", "driversLicense": "989444798", "issuingCountry": "AUS", "expire": true, "expirationDate": "2029-03-22", "rta":"9999999", "issuingState":"AU-QLD"},`

###### driversLicense

All countries except for USA, CAN, HKG, AUS and IND.

`"identification": {"citizenship": "MEX", "driversLicense": "989444798", "issuingCountry": "MEX", "expire`": true, "expirationDate": "2029-03-22"},

###### nationalCard

All countries except for USA, CAN, HKG and IND.

`"identification": {"citizenship": "MEX", "nationalCard": "989444798", "issuingCountry": "MEX"},`

###### hkTravelPermit

Macao and HK Travel Permit is accepted as POI for LLC Clients based in China.

`"identification": {"citizenship": "CHN", "HKTravelPermit": "HO1234567", "issuingCountry": "CHN", "expire`": true, "expirationDate": "2029-03-22"},

###### panNumber

Required for India Residents, Citizens, and Tax Residents.

`"identification": {"citizenship": "IND", "panNumber": "AABPK6504E", "issuingCountry": "IND"}`

###### passport

All countries except for USA, CAN, HKG and IND.

`"identification": {"citizenship": "MEX", "passport": "989444798", "issuingCountry": "MEX", "expire`": true, "expirationDate": "2029-03-22"},

###### sin

Required for Canada Residents, Citizens, and Tax Residents.

`  "identification": {"citizenship": "CAN", "sin": "989444798", "issuingCountry": "CAN"}, `

###### ssn

Required for United States Residents, Citizens, and Tax Residents.

`  "identification": {"citizenship": "USA","SSN": "989444798", "issuingCountry": "USA"} `

###### taxId

All countries except for USA, CAN, HKG and IND.

`"identification": {"citizenship": "ESP", "taxId": "989444798", "issuingCountry": "ESP"},`

<table>
<colgroup>
<col style="width: 33%" />
<col style="width: 33%" />
<col style="width: 33%" />
</colgroup>
<thead>
<tr class="header">
<th>Name</th>
<th>Type</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td>citizenship</td>
<td><a href="https://www.iso.org/obp/ui">3 Digit ISO Code</a></td>
<td>Citizenship of the applicant. If <code>citizenship</code> is classified as a ‘Prohibited Country’, THEN <code>prohibitedCountryQuestionnaire </code>is required.<br />
List of Prohibited Countries an be obtained using <a href="https://www.ibkrguides.com/dameca/Endpoint/getECAEnumerations.htm"> </a><code>/api/v1/enumerations/prohibited-country</code> endpoint.</td>
</tr>
<tr class="even">
<td>citizenship2</td>
<td><a href="https://www.iso.org/obp/ui">3 Digit ISO Code</a></td>
<td>If the applicant has multiple citizenship, provide the additional citizenship of the applicant. If <code>citizenship2</code> is classified as a ‘Prohibited Country’, THEN <code>prohibitedCountryQuestionnaire</code> is required.<br />
List of Prohibited Countries an be obtained using <a href="https://www.ibkrguides.com/dameca/Endpoint/getECAEnumerations.htm"> </a><code>/api/v1/enumerations/prohibited-country</code> endpoint.</td>
</tr>
<tr class="odd">
<td>citizenship3</td>
<td><a href="https://www.iso.org/obp/ui">3 Digit ISO Code</a></td>
<td>If the applicant has multiple citizenship, provide the additional citizenship of the applicant. If <code>citizenship3</code> is classified as a ‘Prohibited Country’, THEN <code>prohibitedCountryQuestionnaire </code>is required.<br />
List of Prohibited Countries an be obtained using <a href="https://www.ibkrguides.com/dameca/Endpoint/getECAEnumerations.htm"> </a><code>/api/v1/enumerations/prohibited-country</code> endpoint.</td>
</tr>
<tr class="even">
<td>issuingCountry</td>
<td><a href="https://www.iso.org/obp/ui">3 Digit ISO Code</a></td>
<td>Issuing country of the ID document.</td>
</tr>
<tr class="odd">
<td>issuingState</td>
<td><a href="https://www.iso.org/obp/ui#search">3166-2 ISO Code</a></td>
<td>Required if driversLicense issued in Australia is provided.</td>
</tr>
<tr class="even">
<td>expire</td>
<td>true<br />
false</td>
<td>Indicate IF ID document has an ExpirationDate.</td>
</tr>
<tr class="odd">
<td>expirationDate</td>
<td>YYYY-MM-DD</td>
<td>Provide expiration date of the ID document. Cannot be past date.<br />
If <code>driversLicense </code>OR <code>passport </code>is provided AND <code>expirationDate </code>is missing, an error will be thrown.</td>
</tr>
<tr class="even">
<td>rta</td>
<td>String</td>
<td>Only applicable IF ID_Type=DriversLicense AND IssuingCountry=AUS</td>
</tr>
<tr class="odd">
<td>ssn</td>
<td>String</td>
<td><strong>Social Security Number</strong>: Required for US Residents and citizens.<br />
REGEX:(?!123456789|219099999|078051120)(?!666|000)\d{3}(?!00)\d{2}(?!0{4})\d{4}$</td>
</tr>
<tr class="even">
<td>sin</td>
<td>String</td>
<td><strong>Social Insurance Number</strong>: Required for Canada Residents and citizens.
<p>REGEX: ^\d{9}$</p></td>
</tr>
<tr class="odd">
<td>panNumber</td>
<td>String</td>
<td>India PanCard, required for India Residents and citizens.
<p>REGEX: [A-Z]{5}\d{4}[A-Z]{1}$</p></td>
</tr>
<tr class="even">
<td>driversLicense</td>
<td>String</td>
<td>Drivers License
<p>REGEX by Country:<br />
AUS: ^.{0,64}$<br />
NZL: ^[A-Z]{2}\d{6}$</p></td>
</tr>
<tr class="odd">
<td>passport</td>
<td>String</td>
<td>Passport
<p>REGEX by Country:<br />
AUS: ^([a-zA-Z0-9]{7,10})$<br />
CAN: ^[a-zA-Z0-9]{6,10}<br />
CHN: (^[A-Za-z0-9]{9})|\d{18}$<br />
IND: ^[a-zA-Z]{1}[0-9]{7}<br />
SGP: [A-Za-z0-9]{8,10}$<br />
USA: (^[a-zA-Z]*\d{6,9})|(\d{3}-\d{3}-\d{3})$</p></td>
</tr>
<tr class="even">
<td>nationalCard</td>
<td>String</td>
<td>National Identification Card<br />
REGEX by Country:<br />
ARG: ^\d{8}$<br />
FRA: ^\d{15}$<br />
FRA: ^([A-Za-z0-9]{9})|(\d{4}([A-Z]|\d){3}\d{5})$<br />
ITA: ^([A-Z]{2}\d{7}|\d{7}[A-Z]{2}|[A-Z]{2}\d{5}[A-Z]{2})$<br />
MEX: ^[A-Z]{4}\d{6}[A-Z]{6}\d{2}$<br />
MYS: ^\d{12}$<br />
RUS: ^\d{9}$<br />
RUS: ^\d{10}$<br />
SAU: ^<a href="\d%7B9%7D$">1|2</a><br />
ZAF: ^\d{13}$</td>
</tr>
<tr class="odd">
<td>taxId</td>
<td>String</td>
<td>Tax ID TIN within &lt;<a href="https://www.interactivebrokers.com/campus/ibkr-api-page/web-api-account-management/#associatedindividual-25">taxResidencies</a>&gt;foreignTaxId within &lt;<a href="https://www.interactivebrokers.com/campus/ibkr-api-page/web-api-account-management/#associatedindividual-25">w8Ben</a>&gt;
<p>REGEX by Country:<br />
AUS: ^(\d{8}|\d{9})$<br />
AUT: ^\d{9}$<br />
BEL: ^\d{11}$<br />
BGR: ^\d{10}$<br />
BRA: ^\d{11}$<br />
CHE: ^756\d{10}$<br />
CHN: ^\d{17}(\d|X)$<br />
CHN: ^(?:[0-9TMHWC][0-9]{16}[0-9A-Za-z]|[0-9TMHWC][0-9]{17}|J[0-9]{14})$<br />
CYP: ^[069]\d{7}[A-Z]$<br />
CZE: ^\d{9,10}$<br />
DEU: ^\d{11}$<br />
DNK: ^\d{10}$<br />
ESP: ^(\d{8}[A-Z]{1})|([A-Z]{1}\d{7}[A-Z]{1})$<br />
EST: ^\d{11}$<br />
FIN: ^((\d{6}A\d{3}|\d{9})[0-9A-Z])$<br />
FRA: ^[0-3]\d{12}$<br />
GBR: ^[A-Z]{2}\d{6}[ABCD]{1}$<br />
GRC: ^\d{9}$<br />
HKG: ^[A-Z]{1,2}[0-9]{6}([0-9]|A)$<br />
HRV: ^\d{11}$<br />
HUN: ^(8\d{9})$<br />
IDN: ^\d{16}$<br />
IRL: ^\d{7}[A-Z]{1,2}$<br />
ISL: ^\d{10}$<br />
ISR: ^\d{9}$<br />
ITA: ^[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]$<br />
KOR: ^\d{13}$<br />
LTU: ^\d{11}$<br />
LUX: ^\d{13}$<br />
LVA: ^\d{11}$<br />
MLT: ^(\d{9}|\d{7}[A-Z])$<br />
MYS: ^(\d{12}|IG\d{9,11})$<br />
NLD: ^\d{9}$<br />
NOR: ^\d{11}$<br />
POL: ^\d{11}$<br />
PRT: ^[1234]\d{8}$<br />
ROU: ^\d{13}$<br />
RUS: ^\d{12}$<br />
SGP: ^[A-Z]\d{7}[A-Z]$<br />
SVK: ^\d{9,10}$<br />
SVN: ^[1-9]\d{7}$<br />
SWE: ^(\d{10}|\d{12})$<br />
TUR: ^\d{11}$<br />
UKR: ^\d{10}$</p></td>
</tr>
<tr class="even">
<td>alienCard</td>
<td>String</td>
<td>Alien Card</td>
</tr>
<tr class="odd">
<td>cardColor</td>
<td>BLUE<br />
GREEN<br />
YELLOW</td>
<td>Required if MedicareCard is provided.</td>
</tr>
<tr class="even">
<td>medicareCard</td>
<td>String; 10 digits.</td>
<td>Only applicable for Australia residents.</td>
</tr>
<tr class="odd">
<td>mediCareReference</td>
<td>String; between 1-9 digits.</td>
<td>Required if MedicareCard is provided.</td>
</tr>
</tbody>
</table>

###### LocalTaxForms

Required when Non-US applicant requests trading permissions for Canada products OR Non-Australia/Non-U.S. applicant requests trading permissions for Australia products.

|                                                                                                            |
| ---------------------------------------------------------------------------------------------------------- |
| `"w8Ben": { "localTaxForms": [ { "taxAuthority": "CANADA_TA", "qualified": true, "treatyCountry": "DEU" }` |

<table>
<colgroup>
<col style="width: 33%" />
<col style="width: 33%" />
<col style="width: 33%" />
</colgroup>
<thead>
<tr class="header">
<th>Name</th>
<th>Type</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td>taxAuthority</td>
<td>CANADA_TAAUSTRALIA_TAIRELAND_TAISRAEL_TA</td>
<td>Tax Certification</td>
</tr>
<tr class="even">
<td>qualify</td>
<td>True<br />
False</td>
<td>Does the account holder qualify for ‘taxAuthority’ treaty benefits</td>
</tr>
<tr class="odd">
<td>treatyCountry</td>
<td><a href="https://www.iso.org/obp/ui">3 Digit ISO Code</a></td>
<td>If yes, provide Treaty Country. N/A is accepted for Non-Treaty Countries.
<p>Canada Treaty Countries: https://www.canada.ca/en/department-finance/programs/tax-policy/tax-treaties/in-force.html</p>
<p>Australia Countries: https://treasury.gov.au/tax-treaties/income-tax-treaties</p>
<p>Israel Countries: https://www.gov.il/en/departments/dynamiccollectors/international_agreements</p></td>
</tr>
</tbody>
</table>

###### mailingAddress

Provide the mailing address of the applicant.

  - IF `sameMailAaddress`: “false” THEN ` mailingAddress  `is required.

<table>
<colgroup>
<col style="width: 50%" />
<col style="width: 50%" />
</colgroup>
<thead>
<tr class="header">
<th>Name</th>
<th>Type</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td>country <sub><mark class="has-inline-color has-vivid-red-color" style="background-color:rgba(0, 0, 0, 0)">required</mark></sub></td>
<td><a href="https://www.iso.org/obp/ui">3 Digit ISO Code</a></td>
</tr>
<tr class="even">
<td>state <sub><mark class="has-inline-color has-vivid-red-color" style="background-color:rgba(0, 0, 0, 0)">required</mark></sub></td>
<td><a href="https://www.iso.org/obp/ui#search">3166-2 ISO Code</a></td>
</tr>
<tr class="odd">
<td>city <sub><mark class="has-inline-color has-vivid-red-color" style="background-color:rgba(0, 0, 0, 0)">required</mark></sub></td>
<td>String; Max characters 100</td>
</tr>
<tr class="even">
<td>postalCode <sub><mark class="has-inline-color has-vivid-red-color" style="background-color:rgba(0, 0, 0, 0)">required</mark></sub></td>
<td>String; Max characters 20
<p>Postal / Zip code.<br />
For countries that do not provide postal code, please enter “00000″</p></td>
</tr>
<tr class="odd">
<td>street1 <sub><mark class="has-inline-color has-vivid-red-color" style="background-color:rgba(0, 0, 0, 0)">required</mark></sub></td>
<td>String; Max characters 200</td>
</tr>
<tr class="even">
<td>street2</td>
<td>String; Max characters 200</td>
</tr>
</tbody>
</table>

##### **Example**

|                                                                                                                                     |
| ----------------------------------------------------------------------------------------------------------------------------------- |
| {`"mailingAddress": {"street1": "1 Tester Street", "city": "London", "state": "GB-ENG" ,"country":"GBR","postalCode": "SW10 9QL"},` |

##### **Required**

| <sub>FD</sub> | <sub>FA</sub> | <sub>OWD</sub> | <sub>NonQI</sub> | <sub>ND-QI</sub> | <sub>ND-QI (NT)</sub> |
| ------------- | ------------- | -------------- | ---------------- | ---------------- | --------------------- |
| <sub>✓</sub>  | <sub>✓</sub>  | <sub>✓</sub>   | <sub>✓</sub>     | <sub>✓</sub>     | <sub>–</sub>          |

###### maritalStatus

Marital Status of the applicant

<table>
<colgroup>
<col style="width: 50%" />
<col style="width: 50%" />
</colgroup>
<thead>
<tr class="header">
<th>Name</th>
<th>Type</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td>maritalStatus <sub><mark class="has-inline-color has-vivid-red-color" style="background-color:rgba(0, 0, 0, 0)">required</mark></sub></td>
<td>S= Single<br />
M= Married<br />
W= Widowed<br />
D= Divorced<br />
C= Common law partner</td>
</tr>
</tbody>
</table>

##### **Example**

|                         |
| ----------------------- |
| `"maritalStatus": "S",` |

##### Required

| <sub>FD</sub> | <sub>FA</sub> | <sub>OWD</sub> | <sub>NonQI</sub> | <sub>ND-QI</sub> | <sub>ND-QI (NT)</sub> |
| ------------- | ------------- | -------------- | ---------------- | ---------------- | --------------------- |
| <sub>✓</sub>  | <sub>✓</sub>  | <sub>–</sub>   | <sub>–</sub>     | <sub>–</sub>     | <sub>–</sub>          |

###### nativeName

Legal name of the associated individual.

|                                                                                          |
| ---------------------------------------------------------------------------------------- |
| `{"nativeName": {"first": "ון", "middle": "סמית", "last": "סמית" ,"salutation":"Mrs."},` |

<table>
<colgroup>
<col style="width: 33%" />
<col style="width: 33%" />
<col style="width: 33%" />
</colgroup>
<thead>
<tr class="header">
<th>Name</th>
<th>Type</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td>first</td>
<td>Required- String; max characters 50</td>
<td>Legal first name of the applicant. </td>
</tr>
<tr class="even">
<td>middle</td>
<td>String; max characters 50</td>
<td>Middle name of the applicant.</td>
</tr>
<tr class="odd">
<td>last</td>
<td>Required- String; max characters 50</td>
<td>Legal last name of the applicant.</td>
</tr>
<tr class="even">
<td>salutation</td>
<td>Mr.<br />
Mrs.<br />
Ms.<br />
Dr.<br />
Mx.<br />
Ind.</td>
<td>Salutation of the applicant.</td>
</tr>
</tbody>
</table>

  - Required for Russia and Israel Applicants. 
      - Error will be thrown IF first OR last are missing or null value is provided.
  - Optional for other countries.

###### numDependents

Number of dependents for the account holder.

|                       |
| --------------------- |
| `"numDependents": 0,` |

| Name          | Type   | Description                                                                                                                                                                     |
| ------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| numDependents | Number | Provide number of Individuals the Account Holder Supports (excluding the account holder). Account holder must provide at least half of the person’s total support for the year. |

###### ownershipPercentage

Ownership percentage for individual that is associated with the account.

|                              |
| ---------------------------- |
| `ownershipPercentage": 100,` |

| Name                  | Type   | Description |
| --------------------- | ------ | ----------- |
| `ownershipPercentage` | number |             |

  - Set ownership percentage for each indivdual associated with the account.
      - Joint: `ownershipPercentage` is ignored unless ` type  `is `tenants_common`.
      - IRA and TRUST: `ownershipPercentage` across all beneficiaries must add up to 100 or else error will be triggered.

###### phones

Phone number of the associated individual.

|                                                                                                   |
| ------------------------------------------------------------------------------------------------- |
| `"phones": [ {"type": "Mobile", "number": "2034228988", "country": "USA", "isVerified": true} ],` |

<table>
<colgroup>
<col style="width: 33%" />
<col style="width: 33%" />
<col style="width: 33%" />
</colgroup>
<thead>
<tr class="header">
<th>Name</th>
<th>Type</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td>type</td>
<td>Work<br />
Home<br />
Fax<br />
Mobile<br />
Business</td>
<td><strong>Individual / Joint/ Retirement</strong>: Mobile phone number is required. The user can provide additional phone numbers (ie. Home, Work) if desired.
<p><strong>Org</strong>: Business phone is optional. </p></td>
</tr>
<tr class="even">
<td>number</td>
<td>String; max characters 18</td>
<td>Phone number.</td>
</tr>
<tr class="odd">
<td>country</td>
<td><a href="https://www.iso.org/obp/ui">3 Digit ISO Code</a></td>
<td>Country which phone number is associated to.</td>
</tr>
<tr class="even">
<td>isVerified</td>
<td>true<br />
false</td>
<td>Indicate if mobile phone number has been verified.</td>
</tr>
</tbody>
</table>

  - We use Google API to validate the Phone Number. The API allows for country code to be passed along with the phone number.
  - Mobile Phone Number will be used for IBKR’s Two-Factor Authentication.
  - Interactive Brokers requires all applicants to be enrolled in two-factor authentication.
  - Account holders will be prompted to enroll in two factor authentication within 1 month of the account being opened and funded OR after the third login to the white branded Interactive Brokers Online Portal
      - We offer HandyKey (mobile application). The application will be branded with your firms Logo.
          - [iOS](https://www.clientam.com/en/handysolutions/handy-trader.php?p=dsa)/[Android](https://www.clientam.com/en/handysolutions/handy-trader.php?p=dsa) – Configured within Mobile Application
          - Details: <https://ibkr.info/article/2260>
      - Two-factor authentication cannot be enabled for clients using RESTful Web API
  - Two-factor authentication cannot be enabled by the advisor/broker on behalf even if Supplemental Power of Attorney is enabled.
  - For joint accounts, error will be thrown if ` number  `is same for both account holders.

###### residenceAddress

Provide the residential address where the individual physically resides.

|                                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------- |
| {`"residenceAddress": {"street1": "1 Tester Street", "city": "London", "state": "GB-ENG" ,"country":"GBR","postalCode": "SW10 9QL"},` |

<table>
<colgroup>
<col style="width: 33%" />
<col style="width: 33%" />
<col style="width: 33%" />
</colgroup>
<thead>
<tr class="header">
<th>Name</th>
<th>Type</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td>country</td>
<td><a href="https://www.iso.org/obp/ui">3 Digit ISO Code</a></td>
<td>Country which the applicant resides.</td>
</tr>
<tr class="even">
<td>state</td>
<td><a href="https://www.iso.org/obp/ui#search">3166-2 ISO Code</a></td>
<td>State/Province which the applicant resides.</td>
</tr>
<tr class="odd">
<td>city</td>
<td>String; Max characters 100</td>
<td>City which the applicant resides.</td>
</tr>
<tr class="even">
<td>postalCode</td>
<td>String; Max characters 20</td>
<td>Postal / Zip code.<br />
For countries that do not provide postal code, please enter “00000″</td>
</tr>
<tr class="odd">
<td>street_1</td>
<td>String; Max characters 200</td>
<td>Street which applicant resides</td>
</tr>
<tr class="even">
<td>street_2</td>
<td>String; Max characters 200</td>
<td>Street which applicant resides</td>
</tr>
</tbody>
</table>

  - If the mailing address is different from the address provided in Residence element, THEN you will also include MailingAddress element.
  - Post Office Box is not accepted for Residential Address.
  - Our system validates street\_1 and street\_2 included within Residence attribute to ensure Post Office Box address is not provided.
      - An error will be thrown if the below combinations are included within street\_1 OR street\_2:
          - PB
          - PO Box
          - Post Office Box
          - P.O. Box
          - In care of
          - General Delivery
      - Regular Expression to validate street\_1 and street\_2:
          - English: `(?:P(?:ost(?:al)?)?[\.\-\s]*(?:(?:O(?:ffice)?[\.\s]*)?B(?:ox|in|\b|\d)|o(?:ffice|\b)(?:[-\s]*\d)|code)|box[-\s]*\d)`
          - Chinese Simplified: `PO Box    (?i)\b((邮政信箱) [0-9]*)\bChinese Traditional: PO Box   (?i)\b((郵政信箱) [0-9]*)\b`

<!-- end list -->

###### sameMailAddress

Indicate if the mailing address is different from the residential address.

|                               |
| ----------------------------- |
| `  "sameMailAddress": true, ` |

<table>
<colgroup>
<col style="width: 33%" />
<col style="width: 33%" />
<col style="width: 33%" />
</colgroup>
<thead>
<tr class="header">
<th>Name</th>
<th>Type</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td><code>sameMailAddress</code></td>
<td>true<br />
false</td>
<td>Indicate if the mailing address is different from the residential address.</td>
</tr>
</tbody>
</table>

  -  IF `  "sameMailAddress": false, `THEN mailingAddress is required

###### taxResidencies

Tax Residency information of associated individual.

|                                                                             |
| --------------------------------------------------------------------------- |
| `"taxResidencies": [{"country": "USA","tin": "132228833","tinType": "SSN"}` |

  - Provide the tax residency of the associated individual.
  - Multiple tax residencies can be provided.

<table>
<colgroup>
<col style="width: 33%" />
<col style="width: 33%" />
<col style="width: 33%" />
</colgroup>
<thead>
<tr class="header">
<th>Name</th>
<th>Type</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td>tinType</td>
<td>SSN<br />
NonUS_NationalId<br />
EIN</td>
<td><strong>Individual / Retirement / Joint</strong><br />
Type of Tax ID number that is provided.
<p><strong>SSN</strong>: Required for United States citizens and residents.</p>
<p><strong>NonUS_NationalId</strong>: Required for all other countries.<br />
*For Non-U.S. Applicants, if the applicant does not have a Foreign Tax ID, then this can be excluded.</p>
<p><strong>Org / Trust</strong><br />
EIN is required</p></td>
</tr>
<tr class="even">
<td>country</td>
<td><a href="https://www.iso.org/obp/ui">3 Digit ISO Code</a> OR Full Country Name</td>
<td>Country where the applicant pays taxes.</td>
</tr>
<tr class="odd">
<td>tin</td>
<td>String</td>
<td>Tax Identification Number.
<p>United States citizens and Residents: This is required. Provide SSN of the applicant.</p>
<p>All other countries: if the applicant does not have a Foreign Tax ID, then this can be excluded.</p></td>
</tr>
</tbody>
</table>

###### translated

For applications submitted with dual language, indicate if data is translated.

|                        |
| ---------------------- |
| `"translated": false,` |

<table>
<colgroup>
<col style="width: 33%" />
<col style="width: 33%" />
<col style="width: 33%" />
</colgroup>
<thead>
<tr class="header">
<th>Name</th>
<th>Type</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td>translated</td>
<td>true<br />
false</td>
<td>Indicates if the information is the translated version. It is used only when providing information in a different language and English. Default values is “false”.</td>
</tr>
</tbody>
</table>

  - Indicates if the information is the translated version.
  - It is used only when providing information in a different language and English.
  - Default values is “false”.
  - If ` hasTranslation  `is set to `true`,

###### w8Ben

Tax form for Non-U.S. Applicants only.

  - Options for submitting tax form:
  - Option 1: Advisor/IBroker collects the tax form records on your website and attaches the corresponding blank form in the JSON.
  - Option 2:  Advisor/IBroker will display the tax form on your website and client completes and signs the tax form electronically. Advisor/IBroker attaches the electronically completed and sign tax form along with the JSON.

|                                                                                                                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `"w8Ben": {"name": "John Smith","foreignTaxId": "2555558888","tinOrExplanationRequired": true,"part29ACountry": "N/A","cert": true,"blankForm": true,"taxFormFile": "Form5001.pdf","proprietaryFormNumber": 5001,"electronicFormat": true}` |

<table>
<colgroup>
<col style="width: 33%" />
<col style="width: 33%" />
<col style="width: 33%" />
</colgroup>
<thead>
<tr class="header">
<th>Name</th>
<th>Type</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td>part29ACountry</td>
<td><a href="https://www.iso.org/obp/ui">3 Digit ISO Code</a></td>
<td>Certify that the beneficial owner is a resident of <strong>&lt;part29ACountry&gt;</strong> within the meaning of the income tax treaty between United States and that country.
<p>&gt; If the account holder is resident of a non-treaty country, enter N/A</p>
<p>&gt;If the account holder qualifies for treaty benefits under US income tax treaty, please identify treaty.</p>
<p>&gt;<a href="https://www.irs.gov/businesses/international-businesses/united-states-income-tax-treaties-a-to-z">Treaty Countries with United States</a>  </p></td>
</tr>
<tr class="even">
<td>name</td>
<td>String</td>
<td>Name listed on the W8 must = Applicants First Name + Middle Name (if Applicable) + Last Name + Suffix (if Applicable)<br />
*Data is case and space sensitive.</td>
</tr>
<tr class="odd">
<td>blankForm</td>
<td>true<br />
false</td>
<td>Indicate if the Tax Form provided to IBKR is blank.</td>
</tr>
<tr class="even">
<td>signatureType</td>
<td>Electronic</td>
<td>Signature type recorded for the Tax Form.</td>
</tr>
<tr class="odd">
<td>taxFormFile</td>
<td>String</td>
<td>File name of the tax form provided to IBKR in the archive file.</td>
</tr>
<tr class="even">
<td>foreignTaxId</td>
<td>String</td>
<td>The foreign tax ID of the applicant. This should be the same as the TIN which was provided in the TaxResidency node.</td>
</tr>
<tr class="odd">
<td>proprietaryFormNumber</td>
<td>String</td>
<td>Form number if broker/advisor sends proprietary blank forms instead of using the form numbers provided by IBKR.</td>
</tr>
<tr class="even">
<td>explanation</td>
<td>US_TIN<br />
TIN_NOT_DISCLOSED<br />
TIN_NOT_REQUIRED<br />
TIN_NOT_ISSUED</td>
<td>Required if client does not have a foreign taxID.Explanation for not providing either TIN or Foreign Tax Id:[US_TIN] Account holder possesses US TIN; it will be added to W8 Form. <br />
[TIN_NOT_DISCLOSED] Country issues TIN; however, applicant is exempt from disclosing TIN under laws of the country. <br />
[TIN_NOT_REQUIRED] Account holder is not legally required to obtain TIN. <br />
[TIN_NOT_ISSUED] Country does not issue TIN. </td>
</tr>
<tr class="odd">
<td>cert</td>
<td>true<br />
false</td>
<td>Under penalties of perjury, I declare that I have examined the information on this form and to the best of my knowledge and belief it is true, correct, and complete. By clicking each item, I further certify under penalties of perjury that:
<p>&gt;I am the individual that is the beneficial owner (or am authorized to sign for the individual that is the beneficial owner) of all the income to which this form relates or am using this form to document myself as an individual that is an owner or applicant of a foreign financial institution</p>
<p>&gt;The person named on line 1 of this form is not a U.S. person,</p>
<p>&gt; <strong></strong> The income to which this form relates is:</p>
<p>&gt;not effectively connected with the conduct of a trade or business in the United States,</p>
<p>&gt;effectively connected but is not subject to tax under an income tax treaty, or</p>
<p>&gt;the partner’s share of a partnership’s effectively connected income,</p>
<p>&gt;The person named on line 1 of this form is a resident of the treaty country listed on line 9 of the form (if any) within the meaning of the income tax treaty between the United States and that country, and</p>
<p>&gt;For broker transactions or barter exchanges, the beneficial owner is an exempt foreign person as defined in the instructions.</p>
<p>&gt;By checking this box you confirm the information on this Form W-8BEN is correct.</p></td>
</tr>
<tr class="even">
<td>submitDate</td>
<td>YYYY-MM-DD</td>
<td>For existing client, if firm has existing (valid) tax form on file for the account, include submit_date. submit_date represents date which client initially signed the tax form.</td>
</tr>
</tbody>
</table>

###### w9

Tax form for U.S. Residents, Citizens, and Taxpayers.

  - Options for submitting tax form:
  - Option 1: Advisor/IBroker collects the tax form records on your website and attaches the corresponding blank form in the JSON.
  - Option 2:  Advisor/IBroker will display the tax form on your website and client completes and signs the tax form electronically. Advisor/IBroker attaches the electronically completed and sign tax form along with the JSON.

|                                                                                                                                                                                                                                                                      |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `"w9": {       "name": "paulina orr M ibllc test","customerType": "Individual","tin": "132228833","tinType": "SSN","cert1": true,"cert2": true,"cert3": true,"blankForm": true,"taxFormFile": "Form5002.pdf","proprietaryFormNumber": 5002                        }` |

<table>
<colgroup>
<col style="width: 33%" />
<col style="width: 33%" />
<col style="width: 33%" />
</colgroup>
<thead>
<tr class="header">
<th>Name</th>
<th>Type</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td>cert1</td>
<td>true<br />
false</td>
<td>The number shown on this form is my correct taxpayer identification number (or I am waiting for a number to be issued to me)</td>
</tr>
<tr class="even">
<td>cert2</td>
<td>true<br />
false</td>
<td>I am not subject to backup withholding because: (a) I am exempt from backup withholding, or (b) I have not been notified by the Internal Revenue Service (IRS) that I am subject to backup withholding as a result of a failure to report all interest or dividends, or (c) the IRS has notified me that I am no longer subject to backup withholding</td>
</tr>
<tr class="odd">
<td>cert3</td>
<td>true<br />
false</td>
<td>I am a U.S. Citizen or other U.S. Person</td>
</tr>
<tr class="even">
<td>customerType</td>
<td>Individual<br />
Joint</td>
<td>Specify the account type</td>
</tr>
<tr class="odd">
<td>name</td>
<td>String</td>
<td>Name listed on the W9 must = Applicants First Name + Middle Name (if Applicable) + Last Name + Suffix (if Applicable)*Data is case and space sensitive.</td>
</tr>
<tr class="even">
<td>signatureType</td>
<td>Electronic</td>
<td>Signature type recorded for the Tax Form.</td>
</tr>
<tr class="odd">
<td>taxFormFile</td>
<td>String</td>
<td>File name of the tax form provided to IBKR in the archive file.</td>
</tr>
<tr class="even">
<td>tin</td>
<td>String</td>
<td>The applicant’s SSN. This should be the same as the TIN which was provided in the TaxResidency node.</td>
</tr>
<tr class="odd">
<td>tinType</td>
<td>SSN</td>
<td>Will always be SSN for U.S. citizens and Residents.</td>
</tr>
<tr class="even">
<td>blankForm</td>
<td>true<br />
false</td>
<td>Indicate if the Tax Form provided to IBKR is blank.</td>
</tr>
<tr class="odd">
<td>proprietaryFormNumber</td>
<td>String</td>
<td>Form number if broker/advisor sends proprietary blank forms instead of using the form numbers provided by IBKR.</td>
</tr>
</tbody>
</table>

#### Specific to AssociatedIndividual for an Organization or Trust

###### authorizedPerson

For orgs, individual that is completing the application and signing agreements.

|                                |
| ------------------------------ |
| `  "authorizedPerson": false ` |

<table>
<colgroup>
<col style="width: 33%" />
<col style="width: 33%" />
<col style="width: 33%" />
</colgroup>
<thead>
<tr class="header">
<th>Name</th>
<th>Type</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td><code>authorizedPerson</code></td>
<td>true<br />
false</td>
<td>Natural person who is completing the application ad has authority to sign agreements on behalf of the entity which the account is being opened for.</td>
</tr>
</tbody>
</table>

  - Individual will be required to provide corporate resolution or similar document authorization opening of the account and establishing that the person identified on the page can sign on behalf of he account holder and has authority to do so.
  - Applicable for `associatedIndividuals` listed on an Org.

###### authorizedTrader

Indicate if individual is authorized to place trades for the account.

|                              |
| ---------------------------- |
| `"authorizedTrader": false,` |

<table>
<colgroup>
<col style="width: 33%" />
<col style="width: 33%" />
<col style="width: 33%" />
</colgroup>
<thead>
<tr class="header">
<th>Name</th>
<th>Type</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td><code>authorizedTrader</code></td>
<td>true<br />
false</td>
<td>Indicate if employee associated with the entity can trade on behalf of the trust.</td>
</tr>
</tbody>
</table>

  - Required if ` entityTrustee  `is listed for Trust.
  - If only ` entityTrustee  `is provided as Trustee, at least one ` employee  `for the `entityTrustee` must be authorized to trade.
  - If both ` individual  `AND `entityTrustee` are listed as Trustees, value can be set to ` false  `and ` individual  `will be set as the authorized trader

###### authorizedToSignOnBehalfOfOwner

Indicate if individual is allowed to sign on behalf of the owner.

|                                                |
| ---------------------------------------------- |
| `  "authorizedToSignOnBehalfOfOwner": false, ` |

<table>
<colgroup>
<col style="width: 33%" />
<col style="width: 33%" />
<col style="width: 33%" />
</colgroup>
<thead>
<tr class="header">
<th>Name</th>
<th>Type</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td><code>authorizedToSignOnBehalfOfOwner</code></td>
<td>true<br />
false</td>
<td>Indicate if employee associated with the entity can sign on behalf of the owner.</td>
</tr>
</tbody>
</table>

  - Required if ` entityTrustee  `is listed for Trust.
  - If only ` entityTrustee  `is provided as Trustee, at least one ` employee  `for the `entityTrustee` must be authorized to sign on behalf of the owner.
  - If both ` individual  `AND `entityTrustee` are listed as Trustees, value can be set to ` false  `and ` individual  `will be authorized signer.

###### primaryTrustee

Indicate if the individual is the primary trustee.

|                              |
| ---------------------------- |
| `  "primaryTrustee": true, ` |

<table>
<colgroup>
<col style="width: 33%" />
<col style="width: 33%" />
<col style="width: 33%" />
</colgroup>
<thead>
<tr class="header">
<th>Name</th>
<th>Type</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td><code>primaryTrustee</code></td>
<td>true<br />
false</td>
<td>Indicate if primary trustee associated with the trust.</td>
</tr>
</tbody>
</table>

  - Applicable for Australian Trust Accounts.
      - If Non-Australia trust, this is not required.
  - Cannot be more than one primary trustee.
  - If ` entityTrustee  `is provided, primary flag should be included for the `employee` associated with the `entityTrustee`
  - If Individual Trustee, include flag for **`individual`**

###### title

Provide title of the associated individual.

|                                          |
| ---------------------------------------- |
| `"titles": [{"code": "Account Holder"}]` |

<table>
<colgroup>
<col style="width: 33%" />
<col style="width: 33%" />
<col style="width: 33%" />
</colgroup>
<thead>
<tr class="header">
<th>Name</th>
<th>Type</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td>code</td>
<td><strong>Org-</strong> Authorized Person<br />
DIRECTOR<br />
OTHER OFFICER<br />
SECRETARY
<p><strong>Org- Owner</strong><br />
SIGNATORY<br />
CEO<br />
OWNER</p>
<p><strong>Trust</strong><br />
Grantor<br />
Trustee<br />
Beneficiary</p></td>
<td>Title associated with the individual.</td>
</tr>
</tbody>
</table>

  - For Orgs and Trusts, set title for each individual that is associated with the account.
  - For ORG if “`authorizedPerson": true`, title code should be one of:
      - DIRECTOR
      - OTHER OFFICER
      - SECRETARY
  - For Trust, at least one trustee must be specified.

## customer

###### customer

Define general customer details.

|                                                                                                                                     |
| ----------------------------------------------------------------------------------------------------------------------------------- |
| `  "externalId": "tester111111", "type": "INDIVIDUAL", "prefix": "aabb", "email": "tester@gmail.com", "mdStatusNonPro": false, }, ` |

<table>
<colgroup>
<col style="width: 33%" />
<col style="width: 33%" />
<col style="width: 33%" />
</colgroup>
<thead>
<tr class="header">
<th>Name</th>
<th>Type</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td>externalId</td>
<td>String</td>
<td>The <code>externalId</code>, <code>externalUserId</code>, and <code>externalIndividualId </code>are unique identifiers which the counterparty assigns. The identifier can be used as a mapping to map the IBKR account with the account/user information within counterparty’s system.<br />
<code>externalId </code>is present within application multiple times including: <code>customer </code>= Represents the customer which the account is associated with<br />
<code>accountHolderDetails, firstHolderDetails, secondHolderDetails</code>: Represents Individuals associated with the account.<br />
<code>accountHolder, jointHolder </code>= Represents the account itself<br />
<code>users </code>(<code>externalUserId </code>and <code>externalIndividualId</code>)= Represents users associated with the account.</td>
</tr>
<tr class="even">
<td>type</td>
<td>INDIVIDUAL<br />
JOINT<br />
IRA<br />
TRUST<br />
ORG</td>
<td>Type of account.</td>
</tr>
<tr class="odd">
<td>prefix</td>
<td>String</td>
<td>Prefix will be used when creating the user ID. IBKR will assign 3-6 numbers to the end of the prefix.<br />
If prefix includes the following, you will receive an error:• symbols or numeric values<br />
– Upper case letters<br />
– Prefix is less than 3 letters or more than 6 letters</td>
</tr>
<tr class="even">
<td>email</td>
<td>String</td>
<td>Primary email address of the applicant.</td>
</tr>
<tr class="odd">
<td>userName</td>
<td>Alphanumeric
<p>– Letters (lower case) and numbers only.<br />
– Contains at least 3 letters.<br />
Min Characters 9; Max characters 63<br />
– Lower case only, no spaces, no special characters.</p></td>
<td>By default, IBKR will generate a user ID using the prefix that is specified in the Customer and User node. If the user would like to select the exact user name, this can be done with userName. The <a href="https://www.interactivebrokers.com/campus/ibkr-api-page/webapi-ref/#tag/Account-Management-Utilities/paths/~1gw~1api~1v1~1validations~1usernames~1%7Busername%7D/get"><code class="EnlighterJSRAW" data-enlighter-language="generic">/gw/api/v1/validations/usernames/{username}</code></a> endpoint can be used to verify if usernName is available.
<p>This feature is available by request only, to use this service, please contact am-api@interactivebrokers.com.</p></td>
</tr>
<tr class="even">
<td>mdStatusNonPro</td>
<td>true<br />
false</td>
<td>Indicate if the applicant is classified as Professional or Non-Professional user. Prices for live data will vary based on if the use is Pro  OR Non-Professional.
<p>mdStatusNonPro=FALSE IF any of the conditions outlined in the below link are met:<br />
https://ibkr.info/article/2369</p></td>
</tr>
<tr class="odd">
<td>directTradingAccess</td>
<td>true<br />
false</td>
<td>Indicate if the applicant will have direct access to placing trades. Required for Non-Disclosed Clients only.</td>
</tr>
<tr class="even">
<td>meetAmlStandard</td>
<td>true<br />
false</td>
<td>Customer meets anti-money laundering standards. Required for Non-Disclosed Clients only.</td>
</tr>
<tr class="odd">
<td>taxTreatyCountry</td>
<td><a href="https://www.iso.org/obp/ui">3 Digit ISO Code</a></td>
<td>If the account holder qualifies for treaty benefits under US income tax treaty, please identify treaty.
<p>N/A is acceptable if account holder does not qualify for treaty benefits.<br />
<a href="https://www.irs.gov/businesses/international-businesses/united-states-income-tax-treaties-a-to-z">Treaty Countries with United States</a></p></td>
</tr>
<tr class="even">
<td>legalResidenceCountry</td>
<td><a href="https://www.iso.org/obp/ui">3 Digit ISO Code</a></td>
<td>Country of legal residence of the customer. Only relevant for Non-Disclosed Broker Clients.</td>
</tr>
<tr class="odd">
<td>preferredPrimaryLanguage</td>
<td>en<br />
de<br />
es<br />
jp<br />
jp<br />
zh_CN<br />
fr<br />
zh_TW<br />
he</td>
<td>Specify Preferred Language for Communication sent by IBKR and for IBKR Systems including Portal and TWS.</td>
</tr>
<tr class="even">
<td>preferredSecondaryLanguage</td>
<td>en<br />
de<br />
es<br />
jp<br />
jp<br />
zh_CN<br />
fr<br />
zh_TW<br />
he</td>
<td>Specify Second Preferred Language for Communication sent by IBKR and for IBKR Systems including Portal and TWS.</td>
</tr>
</tbody>
</table>

###### financialInformation

Provide the net worth, liquid net worth, and annual net income of the applicant.

There are two options for providing `financialInformation`:

  - Option 1: Absolute Number
  - Option 2: Provide an interval range (range\_id)

Validations will vary based on each option. Expand each section below to view differences.

###### Absolute Value

  - Any value over 100 is considered as absolute. Error will be triggered IF the value is less than 100.
  - If absolute number is provided:
      - System converts the data provided in the `financialInformation` node using the ` baseCurrency  `specified within the ` account  `node to a range ID.
      - When validating the `financialInformation` against the IBKR’s Financial Minimum our system uses the lower bound value for the range\_id
      - Our system converts lower bound value of the range\_id from ` baseCurrency  `to IB Currency to validate eligibility for requested capabilities.
          - IBLLC = USD
          - IB-UK = GBP
          - IB-CE, IB-IE = EUR
          - IB-HK = HKD
          - IB-AU = AUD
          - IB-CAN = CAD

|                                                                                                     |
| --------------------------------------------------------------------------------------------------- |
| `financialInformation": [ {"netWorth": 750000, "liquidNetWorth": 500000, "annualNetIncome": 50000}` |

| Name                | Type   | Description                                                                                                                                                                                                                                                                                                                         |
| ------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| net\_worth          | Number | The total value of all assets you own, less what you owe (including all mortgages and debts).Your Net Worth cannot be less than your Liquid Net Worth. If absolute value is provided, minimum value accepted is 101; maximum value accepted is 50000001                                                                             |
| liquid\_net\_worth  | Number | The total value of any assets you own that can be quickly converted into cash.If absolute value is provided, minimum value accepted is 101; maximum value accepted is 5000001                                                                                                                                                       |
| annual\_net\_income | Number | The total amount of your earnings for one year minus any taxes or other deductions taken from your pay. These other deductions could include health insurance, retirement contributions, court ordered judgements or support payments.If absolute value is provided, minimum value accepted is 0; maximum value accepted is 1000001 |
| details             | String | Maximum of 350 Characters. Provide Description of Sources of Income.                                                                                                                                                                                                                                                                |

###### Interval Range

  - Eligibility for Trading Permissions and Account Type (Cash, Margin, Portfolio Margin) is validated against Financial Information Provided. [Financial Minimums](https://www.interactivebrokers.com/en/index.php?f=4945&p=tradingrequirements)
  - For Applications submitted to IBKR via API, `financialInformation` is collected in the currency which is associated with the IBKR entity.
  - When validating the `financialInformation` against the IBKR’s Financial Minimum our system uses the lower bound value for the range\_id.
  - Our system converts lower bound value of the range\_id from baseCurrency to IB Currency to validate eligibility for requested capabilities.
      - IBLLC = USD
      - IB-UK = GBP
      - IB-CE, IB-IE = EUR
      - IB-HK = HKD
      - IB-AU = AUD
      - IB-CAN = CAD
  - range\_id can only be used for the following currencies:

|     |     |     |     |     |
| --- | --- | --- | --- | --- |
| AUD | GBP | KRW | PLN | USD |
| CAD | HKD | MXN | RUB |     |
| CHF | ILS | SEK | SGD |     |
| EUR | JPY | NZD | TRY |     |

|                                                                                       |
| ------------------------------------------------------------------------------------- |
| `financialInformation": [ {"netWorth": 8, "liquidNetWorth": 5, "annualNetIncome": 7}` |

| Name            | Type                                                                                         | Description                                                                                                                                                                                                                            |
| --------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| netWorth        | range\_id: Pull directly using `/gw/api/v1/enumerations/fin-info-ranges?currency=<CURRENCY>` | The total value of all assets you own, less what you owe (including all mortgages and debts).Your Net Worth cannot be less than your Liquid Net Worth.                                                                                 |
| liquidNetWorth  | range\_id: Pull directly using `/gw/api/v1/enumerations/fin-info-ranges?currency=<CURRENCY>` | The total value of any assets you own that can be quickly converted into cash.                                                                                                                                                         |
| annualNetIncome | range\_id: Pull directly using `/gw/api/v1/enumerations/fin-info-ranges?currency=<CURRENCY>` | The total amount of your earnings for one year minus any taxes or other deductions taken from your pay. These other deductions could include health insurance, retirement contributions, court ordered judgements or support payments. |
| details         | String                                                                                       | Maximum of 350 Characters. Provide Description of Sources of Income.                                                                                                                                                                   |

###### investmentExperience

Investment Experience for the applicant.

  - yearsTrading is validated against the age of the applicant. If yearsTrading \> Date – 18, you will receive an error.
  - Cannot be hard coded.
  - We only require the experience for the products the client is requesting.
  - We do not require experience for FOP, SSF, WAR, FOP, ETFs, Mutual Funds as these are subcategories.
      - i.e. If the applicant only wants to trade Stocks, Mutual Funds and ETFs, we only need the experience for STK.

|                                                                                                                                                                                                              |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `{"investmentExperience": [{"assetClass": "STK","yearsTrading": 5,"tradesPerYear": 2,"knowledgeLevel": "Limited"},{"assetClass": "BOND","yearsTrading": 1,"tradesPerYear": 1,"knowledgeLevel": "Limited"}],` |

<table>
<colgroup>
<col style="width: 33%" />
<col style="width: 33%" />
<col style="width: 33%" />
</colgroup>
<thead>
<tr class="header">
<th>Name</th>
<th>Type</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td>assetClass</td>
<td>STK<br />
BOND<br />
OPT<br />
FUT<br />
CASH<br />
MRGN</td>
<td>STK= Stocks (ETFs, ADRs, and Mutual Funds)
<p>BOND= Bonds (T-Bills, Municipal/Corporate Bonds)</p>
<p>OPT= Options</p>
<p>FUT= Futures (includes Single Stock Futures, Futures Options)</p>
<p>CASH= Forex (includes currency conversion and leveraged forex)</p>
<p>MRGN= Margin (Only applicable for IB-UK/IB-EU/IB-IE/IB-CE accounts requesting Margin).</p></td>
</tr>
<tr class="even">
<td>knowledgeLevel</td>
<td>None<br />
Limited<br />
Good<br />
Extensive</td>
<td>Knowledge level the applicant has trading this product.</td>
</tr>
<tr class="odd">
<td>tradesPerYear</td>
<td>Non-Negative Integer Value</td>
<td>Average number of trades per year placed by the applicant for the specified product.</td>
</tr>
<tr class="even">
<td>yearsTrading</td>
<td>Non-Negative Integer Value</td>
<td>Years of experience the applicant has trading this specific product.</td>
</tr>
</tbody>
</table>

**For Advisor Clients:**

  - Investment Experience validations are driven by the Advisor-Master.
  - If Advisor is only registered for Securities, the sub-account is only eligible for Stocks, Options, Bonds, and Mutual Funds.

**For Broker clients:**

  - **STK**
      - yearsTrading=“1″ AND tradesPerYear \< 10:
          - knowledgeLevel= Good OR Extensive: This will validate.
          - knowledgeLevel= None OR Limited: This will trigger an error and the application will not be processed.
  - **OPT**
      - years\_trading=“1″ AND tradesPerYear \< 10:
          - This will trigger an error and the application will not be processed.
          - Because client has less than two years trading Options, client must take Options Exam
      - yearsTrading=“2″ AND tradesPerYear \< 10:
          - knowledgeLevel= Good OR Extensive: This will validate.
          - knowledgeLevel= None OR Limited: This will trigger an error and the application will not be processed.

<!-- end list -->

  - **BOND**
      - yearsTrading=“1″ AND tradesPerYear \< 10:
          - knowledgeLevel= Good OR Extensive: This will validate.
          - knowledgeLevel= None OR Limited: This will trigger an error and the application will not be processed.
  - **FUT**
      - yearsTrading=“1″ AND tradesPerYear \< 10:
          - This will trigger an error and the application will not be processed.
          - Because client has less than two years trading Futures, client must take Futures Exam
      - yearsTrading=“2″ AND tradesPerYear \< 10:
          - knowledgeLevel= Good OR Extensive: This will validate.
          - knowledgeLevel= None OR Limited: This will trigger an error and the application will not be processed.
      - **CASH**
          - yearsTrading=“1″ AND tradesPerYear \< 10:
              - This will not validate
          - year yearsTrading=“2″ AND tradesPerYear \< 10:
              - knowledgeLevel= Good OR Extensive: This will validate.
              - knowledgeLevel= None OR Limited: This will trigger an error and the application will not be processed.

###### sourcesOfWealth

Sources of wealth is how the applicant obtained funds to fund the account.

  - If EmploymentType = EMPLOYED OR SELFEMPLOYED
      - SOW-IND-Income must be listed as sourceOfWealth but does not need to be selected as a source used to fund the account.
  - Applicant cannot specify the same source multiple times.
  - percentage is not required IF usedForFunds=”false”
  - Percentage across all sourceOfWealth must = 100%
  - Required for all Applicants (ie. EMPLOYED, SELFEMPLOYED, RETIRED, UNEMPLOYMENT, STUDENT, ATHOMETRADER, or HOMEMAKER)

|                                                                                                             |
| ----------------------------------------------------------------------------------------------------------- |
| `  "sourcesOfWealth": [ { "sourceType": "SOW-IND-Inheritance", "percentage": 100, "usedForFunds": true }, ` |

<table>
<colgroup>
<col style="width: 33%" />
<col style="width: 33%" />
<col style="width: 33%" />
</colgroup>
<thead>
<tr class="header">
<th>Name</th>
<th>Type</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td>sourceType</td>
<td><strong>Individual/ Joint / Retirement</strong>
<p>SOW-IND-Allowance<br />
SOW-IND-Disability<br />
SOW-IND-Income<br />
SOW-IND-Inheritance<br />
SOW-IND-Interest<br />
SOW-IND-MarketProfit<br />
SOW-IND-Other<br />
SOW-IND-Pension<br />
SOW-IND-Property</p>
<p><strong>Orgs / Trusts</strong></p>
<p>SOW-ORG<br />
Business<br />
SOW-ORG-MarketTradingProfits<br />
SOW-ORG-Other<br />
SOW-ORG-OwnerEquity<br />
SOW-ORG-Property<br />
SOW-ORG-RetainedEarnings</p></td>
<td>Other- Description is required.</td>
</tr>
<tr class="even">
<td>description</td>
<td>String; maximum of 128 characters.</td>
<td>Describe source of funds.<br />
Only required if source_type=“SOW-IND-Other” or “SOW-ORG-Other”</td>
</tr>
<tr class="odd">
<td>percentage</td>
<td>Non-Negative Integer</td>
<td>Only required IF<br />
1) usedForFunds = true<br />
AND account is<br />
2) Account is with IB-HK, IB-AU, IB-UK, IB-UKL, IB-IE, IB-CE  </td>
</tr>
<tr class="even">
<td>usedForFunds</td>
<td>true<br />
false</td>
<td>Is the source used to fund the account? Yes/No</td>
</tr>
</tbody>
</table>

###### regulatoryInformation

Indicate if applicant or individual associated with account falls under FINRA category.

###### regulatoryDetail

**FA/FD:** **Individual, Retirement, Joint (All Entities) **

  - **AFFILIATION**: Is the applicant or any immediate family member who resides in the same household, registered as a broker-dealer or an employee, director or owner of a securities or commodities brokerage firm? (Yes/No) [affiliationDetails](https://www.interactivebrokers.com/campus/ibkr-api-page/web-api-account-management/#application-schema-24)is required IF **true**.

**FA/FD/OWD:** **Individual, Retirement, Joint (All Entities except for IB-AU) **

  - **EmployeePubTrade**: Are the owners of, or other non-owners listed on, the account Employees of a publicly traded company? (Yes/No)
  - **ControlPubTraded**:Do the owners of, or other non-owners listed on, the account Control a publicly traded company? (Yes/No)

**FA/FD: Individual, Retirement, Joint (IB-AU only) **

  - **POLITICALMILITARYDIPLOMATIC**: Is the account holder, or an immediate family member of the account holder: (i) a senior government official of any country, (ii) a senior diplomatic staff member or ambassador or high commissioner for Australia or a non-Australian embassy, or (iii) a high ranking member of any country’s armed forces, or (iv) a senior officer (CEO, CFO, or comparable position) of any State-owned enterprise of any country.  (Yes/No)
  - **CONTROLLER**: Is the account holder, or an immediate family member, a director or senior employee or officer of any publicly traded company (listed) or of an issuer/manager of any exchange traded financial product? (Yes/No)

**OWD: Orgs**

  - **STOCKCONTROL**: Is the organization a publicly-held entity whose shares are traded on a regulated exchange? (Yes/No) If Yes, provide Symbol within detail.
  - **FOREIGN\_BANK**:Is the organization a foreign bank (formed and located outside the European Union)?(Yes/No)
  - **MONEY\_TRANSMITTER**: Is the organization a licensed money transmitter?(Yes/No)
  - **HIGH\_RISK\_CONTRIBUTION**: Does your organization generate 10% or more of its revenue by conducting business in high risk countries? (Yes/No) If yes, provide countries that apply. (Contact dam@ibkr.com for list of countries).

<table>
<colgroup>
<col style="width: 33%" />
<col style="width: 33%" />
<col style="width: 33%" />
</colgroup>
<thead>
<tr class="header">
<th>Name</th>
<th>Type</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td>code</td>
<td>AFFILIATION<br />
EmployeePubTrade<br />
ControlPubTraded<br />
POLITICALMILITARYDIPLOMATICCONTROLLER<br />
STOCKCONTROL<br />
FOREIGN_BANK<br />
MONEY_TRANSMITTER<br />
HIGH_RISK_CONTRIBUTION</td>
<td></td>
</tr>
<tr class="even">
<td>status</td>
<td>true<br />
false</td>
<td>Response to the above Regulatory Questions.Yes= trueNo = false</td>
</tr>
<tr class="odd">
<td>detail</td>
<td>String</td>
<td>Required IF any of the following are true: 
<p><strong>EmployeePubTrade</strong> – Enter the stock symbol(s) of the company or companies, separated by commas. Stock symbol(s) must be upper case.</p>
<p><strong>ControlPubTraded</strong> – Enter the stock symbol(s) of the company or companies, separated by commas. Stock symbol(s) must be upper case.</p>
<p><strong>STOCKCONTROL</strong> – Enter the stock symbol(s) of the company or companies, separated by commas. Stock symbol(s) must be upper case.</p>
<p><strong>HIGH_RISK_CONTRIBUTION –</strong> Enter the country(ies), separated by commas. Country must be 3 digit ISO code and all upper case.</p></td>
</tr>
<tr class="even">
<td>externalIndividualId</td>
<td>String</td>
<td>External_ID associated with the account holder.</td>
</tr>
</tbody>
</table>

If ControlPubTraded and/or EmployeePubTrade=”false”

|                                                                                                                                                                                                            |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `"regulatoryInformation": [{"regulatoryDetail": [{"code": "ControlPubTraded","status": false},{"code": "EmployeePubTrade","status": false},{"code": "AFFILIATION","status": false}],"translated": false}]` |

If ControlPubTraded and/or EmployeePubTrade=”true”

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<tbody>
<tr class="odd">
<td><code>"regulatoryInformation": [{"regulatoryDetail": [{"code": "ControlPubTraded","status": true,"externalIndividualId": "tester12345","detail": "AAPL"},</code><br />
{<br />
"code": "EmployeePubTrade",<br />
"status": true,<br />
"externalIndividualId": "tester12345",<br />
"detail": "AAPL"},<br />
{<br />
"code": "AFFILIATION",<br />
"status": false<br />
}<br />
],<br />
"translated": false<br />
}<br />
]</td>
</tr>
</tbody>
</table>

###### affiliationDetails

**Option 1:** **Link to an existing IBKR EmployeeTrack Account**

<table>
<colgroup>
<col style="width: 33%" />
<col style="width: 33%" />
<col style="width: 33%" />
</colgroup>
<thead>
<tr class="header">
<th>Name</th>
<th>Type</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td>isDuplicateStmtRequired</td>
<td>true<br />
false</td>
<td>Indicates if IBKR should send duplicated statements to customers. For those included on FINRA Rule 3210 or equivalent on his/her jurisdiction, the expected answer is true, as they need to submit one copy to his/her employer compliance office.</td>
</tr>
<tr class="even">
<td>affiliationRelationship</td>
<td>Other<br />
Spouse<br />
Parent<br />
Child<br />
Self</td>
<td>Relationship of the affiliated person to the applicant.</td>
</tr>
<tr class="odd">
<td>personName</td>
<td>String</td>
<td>Name of the affiliated person.</td>
</tr>
<tr class="even">
<td>companyId</td>
<td>String</td>
<td>If the employer has an EmployeeTrack account with IBKR,  you can link the account to the EmployeeTrack account. The Employer will automatically receive duplicate statements for the account.
<p>Use <a href="https://www.interactivebrokers.com/campus/ibkr-api-page/webapi-ref-staging/#tag/Account-Management-Utilities/paths/~1gw~1api~1v1~1enumerations~1%7BenumerationType%7D/get">/getEnumerations</a> ‘company_id’ to query list of companies with active EmployeeTrack accounts at Interactive Brokers.</p></td>
</tr>
</tbody>
</table>

**Option 2:** **Provide Company Details (used if the Employer does not have an [EmployeeTrack](https://www.interactivebrokers.com/en/accounts/compliance-officer.php) account with IBKR)**

<table>
<colgroup>
<col style="width: 33%" />
<col style="width: 33%" />
<col style="width: 33%" />
</colgroup>
<thead>
<tr class="header">
<th>Name</th>
<th>Type</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td>is_duplicate_stmt_required</td>
<td>true<br />
false</td>
<td>Indicates if IBKR should send duplicated statements to customers. For those included on FINRA Rule 3210 or equivalent on his/her jurisdiction, the expected answer is true, as they need to submit one copy to his/her employer compliance office.</td>
</tr>
<tr class="even">
<td>affiliation_relationship</td>
<td>Other<br />
Spouse<br />
Parent<br />
Child<br />
Self</td>
<td>Relationship of the affiliated person to the applicant.</td>
</tr>
<tr class="odd">
<td>person_name</td>
<td>String; max characters 48</td>
<td>Name of the affiliated person.</td>
</tr>
<tr class="even">
<td>company</td>
<td>String; max characters 400</td>
<td>Name of the company where the affiliated person is employed.</td>
</tr>
<tr class="odd">
<td>company_phone</td>
<td>String; max characters 18</td>
<td>Phone number of the compliance officer at the company.We use Google API to validate the Phone Number. The API allows for country code to be passed along with the phone number.Google Phone Library to version 8.12.2https://github.com/google/libphonenumber</td>
</tr>
<tr class="even">
<td>company_email_address</td>
<td>String; max characters 80</td>
<td>Email address of the compliance officer at the company.We validate the email address using Regular Expression (REGEX)^[A-Z0-9][A-Z0-9._%+-]{0,63}@(?:(?=[A-Z0-9-]{1,63}[.])[A-Z0-9]+(?:-[A-Z0-9]+)*[.]){1,8}[A-Z]{2,63}$</td>
</tr>
<tr class="odd">
<td>country</td>
<td><a href="https://www.iso.org/obp/ui">3 Digit ISO Code</a></td>
<td>Country which the employer is located. </td>
</tr>
<tr class="even">
<td>state</td>
<td><a href="https://www.iso.org/obp/ui#search">3166-2 ISO Code</a></td>
<td>State/Province which the employer is located.</td>
</tr>
<tr class="odd">
<td>city</td>
<td>String; Max characters 100</td>
<td>City which the employer is located.</td>
</tr>
<tr class="even">
<td>postal_code</td>
<td>String; Max characters 20</td>
<td>Postal / Zip code. For countries that do not provide postal code, please enter “00000″</td>
</tr>
</tbody>
</table>

###### witholdingStatement

Provide withholding statement for the applicant.

|                                                                                                                              |
| ---------------------------------------------------------------------------------------------------------------------------- |
| `"withholdingStatement": { "effectiveDate": "2024-11-01", "fatcaCompliantType": "FATCA_COMPLIANT", "treatyCountry": "GBR" }` |

<table>
<colgroup>
<col style="width: 33%" />
<col style="width: 33%" />
<col style="width: 33%" />
</colgroup>
<thead>
<tr class="header">
<th>Name</th>
<th>Type</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td>effectiveDate</td>
<td>YYYY-MM-DD</td>
<td>Effective date of withholding statement.</td>
</tr>
<tr class="even">
<td>fatcaCompliantType</td>
<td>FATCA_COMPLIANT<br />
NON_CONSENTING_US_ACCOUNT<br />
NON_COOPERATIVE_ACCOUNT</td>
<td>Indicate if the Account Holder is FATCA compliant account</td>
</tr>
<tr class="odd">
<td>treatyCountry</td>
<td><a href="https://www.iso.org/obp/ui">3 Digit ISO Code</a></td>
<td>If the account holder qualifies for treaty benefits under US income tax treaty, please identify treaty.
<p>&gt;N/A is acceptable if account holder does not qualify for treaty benefits.<br />
&gt;<a href="https://www.irs.gov/businesses/international-businesses/united-states-income-tax-treaties-a-to-z">Treaty Countries with UnitedStates</a></p></td>
</tr>
</tbody>
</table>

## accounts

### Account Configurations

###### account

Mandatory attributes to be included within account

|                                                                                                                   |
| ----------------------------------------------------------------------------------------------------------------- |
| `"accounts": ["externalId": "TEST12345","baseCurrency": "USD","margin": "RegT","alias": "My Individual Account"}` |

<table>
<colgroup>
<col style="width: 33%" />
<col style="width: 33%" />
<col style="width: 33%" />
</colgroup>
<thead>
<tr class="header">
<th>Name</th>
<th>Type</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td>external_id</td>
<td>String; max characters 64</td>
<td>Identifier for the account. This will be specified by the counterparty.</td>
</tr>
<tr class="even">
<td>baseCurrency</td>
<td>Currency code (3 digits). Available currencies can be found <a href="https://www.interactivebrokers.com/en/support/fund-my-account.php">here</a>. </td>
<td>Base currency for the account. </td>
</tr>
<tr class="odd">
<td>alias</td>
<td>String; Max number of characters is 80</td>
<td>Nick name for the account. If you create an account alias, the alias will replace the IBKR Account number on account statements, portal, and TWS.</td>
</tr>
<tr class="even">
<td>margin</td>
<td>Cash<br />
Margin<br />
RegT<br />
PortfolioMargin</td>
<td>Type of margin rules to be applied to the account. <br />
<strong>Cash</strong>: No margin capabilities.<br />
<strong>Margin/RegT</strong>: Rule based margin and offers 4:1 leverage intraday and 2:1 leverage overnight.Minimum Equity: $2,000<br />
<strong>Portfolio Margin</strong>: Risk Based Model and can offer anywhere from a 6:1 leverage for a diverse portfolio; and down to a 3:1 leverage for a more concentrated portfolio.Minimum Equity: $100,000If the account falls below $100,000 the account will be in close only mode. Note: Margin Trading is not available for Australia Residents or accounts underneath IB-AU. For IB-AU accounts, it will always be margin=”CASH”</td>
</tr>
</tbody>
</table>

###### capabilities

Included if the applicant is requesting CLP (Complex Leverage Products) and/or LEVFX (Cash Forex) during account opening.

<table>
<colgroup>
<col style="width: 33%" />
<col style="width: 33%" />
<col style="width: 33%" />
</colgroup>
<thead>
<tr class="header">
<th>Name</th>
<th>Type</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td>capabilities</td>
<td>CLP<br />
LEVFX</td>
<td>CLP= Complex Leveraged Product.
<p>LEVFX= Leveraged Forex (Cash Forex) </p></td>
</tr>
</tbody>
</table>

|                                                                                                |
| ---------------------------------------------------------------------------------------------- |
| `    "accounts": [      {        "capabilities": [          "CLP",          "LEVFX"        ],` |

  - LEVFX allows you to trade currency pairs with leverage. With leveraged FX, you are able to trade larger position sizes with a smaller amount of margin. Leveraged FX trading to eligible clients.
  - CLP for for Fully-Disclosed clients; the account holder must have a minimum of two years trading experience with stocks AND either options or futures.
  - **Futures**
  - 1 year, 1-10 Trades per year
      - This will not validate
      - Because client has less than two years trading Futures, client must take Futures Exam
  - 2 years, 1-10 Trades per year
      - This will validate if Knowledge level is Good or Extensive
      - Will not validate if Knowledge Level is Limited
  - **Options**
  - 1 year, 1-10 Trades per year
      - This will not validate
      - Because client has less than two years trading Options, client must take Options Exam
  - 2 years, 1-10 Trades per year

###### investmentObjectives

Specify investmentObjectives for the applicant.

  - Eligibility for TradingPermissions will vary based on the InvestmentObjectives.
  - This cannot be hardcoded.
  - *To Trade All Products*
      - Growth + Trading Profits + Speculation + Hedging
      - Growth + Speculation + Hedging
      - Growth + Speculation
      - Growth + Trading Profits
      - Hedging + Trading Profits
      - Speculation + Hedging
      - Speculation + Hedging + Trading Profits
  - *Bonds Only*
      - Preservation of Capital only
  - Income + Preservation of Capital + Growth= cannot include Options or Forex
  - Income + Preservation of Capital + Growth + Hedging= cannot include Options

|                                                              |
| ------------------------------------------------------------ |
| `"accounts": [{"investmentObjectives": ["Income","Growth"],` |

<table>
<colgroup>
<col style="width: 33%" />
<col style="width: 33%" />
<col style="width: 33%" />
</colgroup>
<thead>
<tr class="header">
<th>Name</th>
<th>Type</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td>objective</td>
<td>Preservation<br />
Income<br />
Growth<br />
Trading<br />
Speculation<br />
Hedging</td>
<td><strong>Preservation of Capital: </strong>Seek maximum safety and stability for your principal by focusing on securities and investments that carry a low degree of risk.
<p><strong>Income</strong>: Generate dividend, interest or other income instead of, or in addition to, seeking long-term capital appreciation.</p>
<p><strong>Growth</strong>: Increase the principal value of your investments over time rather than seeking current income. Investor assumes higher degree of risk.</p>
<p><strong>Trading Profits</strong>: Increase the principal value of your investments by using shorter term trading strategies and by assuming higher risk.</p>
<p><strong>Speculation</strong>: Substantially increase the principal value of your investments by assuming substantially higher risk to your investment capital.</p>
<p><strong>Hedging</strong>: Take positions in a product in order to hedge or offset the risk in another product.</p></td>
</tr>
</tbody>
</table>

###### tradingPermissions

Specify trading permissions for the account.

Permissions can be requested by exchange OR by product and market.

For `exchange_group`, use[`/api/v1/enumerations/exchange-bundles`](https://www.interactivebrokers.com/campus/ibkr-api-page/webapi-ref-staging/#tag/Account-Management-Utilities/paths/~1gw~1api~1v1~1enumerations~1%7BenumerationType%7D/get) endpoint to query list of available permissions.

  - To trade Fractional Shares, include `"exchangeGroup": "IB-FRAC-STK".`

|                                                          |
| -------------------------------------------------------- |
| `{"tradingPermissions": [{"exchangeGroup": "US-Sec",}],` |

For bundle based, specify the country and Product. Table below includes a list of available products and countries.

<table>
<colgroup>
<col style="width: 33%" />
<col style="width: 33%" />
<col style="width: 33%" />
</colgroup>
<thead>
<tr class="header">
<th>Name</th>
<th>Type</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td>product</td>
<td>BONDS<br />
FUTURES<br />
FOREX<br />
FUTURES OPTIONS<br />
MUTUAL FUNDS<br />
STOCKS<br />
SINGLE STOCK FUTURES<br />
OPTIONS<br />
STOCK OPTIONS</td>
<td>Product type being requested  </td>
</tr>
<tr class="even">
<td>country</td>
<td>All<br />
AUSTRALIA<br />
AUSTRIA<br />
BELGIUM<br />
CANADA<br />
FRANCE<br />
GERMANY<br />
HONG KONG<br />
ITALY<br />
JAPAN<br />
KOREA<br />
MEXICO<br />
NORWAY<br />
SINGAPORE<br />
SPAIN<br />
SWEDEN<br />
SWITZERLAND<br />
THE NETHERLANDS<br />
UNITED KINGDOM<br />
UNITED STATES</td>
<td>Region which user is requesting to trade the product. If ALL is selected, this includes all available regions for the PRODUCT.<br />
Available products based on region can be found <a href="https://www.interactivebrokers.com/en/index.php?f=1563">here</a>.</td>
</tr>
</tbody>
</table>

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<tbody>
<tr class="odd">
<td>{<code>"tradingPermissions": [          </code><br />
<code>{"country": "AUSTRALIA", </code><br />
<code>"product": "STOCKS"</code><br />
<code>},          </code><br />
<code>{"country": "AUSTRIA",</code><br />
<code>"product": "STOCKS"</code><br />
<code>},</code></td>
</tr>
</tbody>
</table>

### Optional Configurations

#### Fee Management

###### advisorWrapFees

Specify fee schedule for the account.

|                                                                                                                                  |
| -------------------------------------------------------------------------------------------------------------------------------- |
| `"advisorWrapFees": { "strategy": "NO_FEE",          "chargeAdvisor": false,          "chargeOtherFeesToAdvisor": false      },` |

  - Required for advisor-clients. Optionally, set fees based on predefined template that was created in Advisor Portal using `feeTemplateName`.
  - Overview on advisor fees can be found [here](https://www.interactivebrokers.com/en/pricing/advisor-fees.php).

<table>
<colgroup>
<col style="width: 33%" />
<col style="width: 33%" />
<col style="width: 33%" />
</colgroup>
<thead>
<tr class="header">
<th>Name</th>
<th>Type</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td>strategy</td>
<td>NO_FEES<br />
AUTOMATED </td>
<td><strong>NO_FEES </strong>= No management fees will be applied to the account. Management fees can be added after the account is approved/opened. Please note, if fees are applied after the account is approved/opened, the client will need to sign off on the fee change.<br />
<strong>AUTOMATED</strong>= Only if automated_fees_detail is included. Fees will be billed to the client’s account with blanket client authorization.</td>
</tr>
<tr class="even">
<td>chargeAdvisor</td>
<td>true<br />
false</td>
<td>Indicates whether commissions will be charged to the advisor account. By default, this is set to false.</td>
</tr>
<tr class="odd">
<td>type</td>
<td>ANNUALFLATFEE<br />
ANNUALFLATFEE_MONTHLY<br />
ANNUALFLATFEE_QUATERLY<br />
BLENDEDPERCENTOFEQUITY<br />
BLENDEDPERCENTOFEQUITY_EOM<br />
BLENDEDPERCENTOFEQUITY_EOQ<br />
BLENDEDPERCENTOFEQUITY_MONTHLY<br />
BLENDEDPERCENTOFEQUITY_QUARTERLY<br />
PERCENTOFEQUITY<br />
PERCENTOFEQUITY_EOM<br />
PERCENTOFEQUITY_EOQ<br />
PERCENTOFEQUITY_MONTHLY<br />
PERCENTOFEQUITY_QUARTERLY<br />
PERCENTOFNLV_CAP<br />
PERCENTOFNLV_CAP_EOPEQTY<br />
PERCENTOFNLV_CAP_EOPEQTY_Q<br />
PERCENTOFNLV_CAP_Q</td>
<td><em>Annual Flat Fee; Entered as an annualized amount, applied on a daily, monthly or quarterly basis (apportioned by 252 days).</em><br />
ANNUALFLATFEE<br />
ANNUALFLATFEE_MONTHLY<br />
ANNUALFLATFEE_QUATERLY
<p><em>Percentage of net liquidation with ranges; Enter up to five separate net asset-value ranges, and an annualized fee percentage for each.</em><br />
BLENDEDPERCENTOFEQUITY<br />
BLENDEDPERCENTOFEQUITY_EOM<br />
BLENDEDPERCENTOFEQUITY_EOQ<br />
BLENDEDPERCENTOFEQUITY_MONTHLY<br />
BLENDEDPERCENTOFEQUITY_QUARTERLY</p>
<p><em>Percentage of net liquidation. Entered as an annualized percentage, applied on a daily, monthly or quarterly basis.</em><br />
PERCENTOFEQUITY<br />
PERCENTOFEQUITY_MONTHLY<br />
PERCENTOFEQUITY_QUARTERLY</p>
<p><em>Percentage of net liquidation, calculated by using the End of Month_/Quarter_ Net Liquidation Value, the rate and the number of business days in a particular month period.</em><br />
PERCENTOFEQUITY_EOM<br />
PERCENTOFEQUITY_EOQ<br />
<em><br />
Invoice; Specify the maximum percentage of the client’s Net Asset Value that can be deducted as advisory fees each month or quarter.</em><br />
PERCENTOFNLV_CAP<br />
PERCENTOFNLV_CAP_Q</p>
<p><em>Period-End Invoice Limit; The Month End Balance and Quarter End Balance invoicing options allow advisors to invoice clients with limits calculated based on the ending value of the previous period.</em><br />
PERCENTOFNLV_CAP_EOPEQTY<br />
PERCENTOFNLV_CAP_EOPEQTY_Q</p></td>
</tr>
<tr class="even">
<td>maxFee</td>
<td>Non-Negative Integer</td>
<td>Maximum fee to be charged to the client account, displayed as an annualized amount. </td>
</tr>
</tbody>
</table>

###### feesTemplateName

Assign pre-defined fee template to an account. Fee template will need to created in the Advisor/Broker Portal.

<table>
<colgroup>
<col style="width: 33%" />
<col style="width: 33%" />
<col style="width: 33%" />
</colgroup>
<thead>
<tr class="header">
<th>Name</th>
<th>Type</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td><code>feesTemplateName</code></td>
<td>String</td>
<td>Name of the fee template being applied. Data is case and space sensitive. The <code>feesTemplateName</code> must match the name of the template which was previously created in the advisor/broker portal.<br />
<a href="https://www.ibkrguides.com/advisorportal/homemenu/configclientfeetemplate.htm?Highlight=fee%20template">Details</a></td>
</tr>
</tbody>
</table>

|                                         |
| --------------------------------------- |
| ` "feesTemplateName": "MyFeeTemplate",` |

Disclaimer: Fee schedule will automatically be applied once the account is opened and funded.

#### Funding

###### depositNotification

Include funding instructions during client registration.

  - During account opening, we support deposit notifications for Checks OR Wires. Our New Accounts team prioritizes applications that are already funded, so we encourage users to include funding instructions in the Application.
  - CHECK: The request is indicating a check deposit notification. The client still needs to send the physical check to IBKR. The deposit notification is used by IBKR to match the deposited funds to the account.
  - WIRE: The request is indicating a wire deposit notification. The client still needs to contact their bank to initiate the transfer. The deposit notification is used by IBKR to match the deposited funds to the account. For list of wire instructions by currency, please contact dam@ibkr.com.
  - Refer to [Funding Limitations](https://www.interactivebrokers.com/en/index.php?f=1544&p=cash1)

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<tbody>
<tr class="odd">
<td><code>"depositNotification": {          </code><br />
<code>"wireDetails": {            </code><br />
<code>"bankName": "Macquarie"          </code><br />
<code>},          </code><br />
<code>"type": "WIRE",          </code><br />
<code>"amount": 30000,          </code><br />
<code>"currency": "AUD"        </code><br />
<code>},</code></td>
</tr>
</tbody>
</table>

<table>
<colgroup>
<col style="width: 33%" />
<col style="width: 33%" />
<col style="width: 33%" />
</colgroup>
<thead>
<tr class="header">
<th>Name</th>
<th>Type</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td>type</td>
<td>CHECK<br />
WIRE</td>
<td>Specify how fund are being sent to IBKR.</td>
</tr>
<tr class="even">
<td>amount</td>
<td>Non-Negative Integer Value</td>
<td>Amount being deposited to IBKR. If there is a discrepancy between amount included in the request versus actual amount sent to IBKR, the funds will not be automatically credited to the account. The applicant will need to contact our Customer Service team to verify the fund transfer.</td>
</tr>
<tr class="odd">
<td>currency</td>
<td>Currency code (3 digits). Available currencies can be found <a href="https://www.interactivebrokers.com/en/support/fund-my-account.php">here</a>.</td>
<td>Currency of the funds being sent to IBKR.</td>
</tr>
<tr class="even">
<td>bankName</td>
<td>String</td>
<td>Name of the sending institution. Only required for WIRE deposits</td>
</tr>
<tr class="odd">
<td>acctNumber</td>
<td>String</td>
<td>Account number at bank. Only required for CHECK deposits.</td>
</tr>
<tr class="even">
<td>routingNumber</td>
<td>String; max characters 9</td>
<td>The routing number listed on the check. Only required for CHECK deposits.</td>
</tr>
<tr class="odd">
<td>checkNumber</td>
<td>String; max characters 16</td>
<td>The check number listed on the check sent to IBKR. Only required for CHECK deposits.</td>
</tr>
</tbody>
</table>

###### extPositionsTransfers

  - Initiate ACATS transfer to the IBKR Account. ACATS will automatically be initiated once the IBKR Account is approved/opened. During account opening, we support FULL OR Partial Transfers. This guide only provides information on FULL transfers. For information on PARTIAL transfers, please send an email to dam@ibkr.com.
  - Usage is optional.
  - [Limitations and Time to Arrive](https://www.interactivebrokers.com/en/index.php?f=1544&p=transfer)

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<tbody>
<tr class="odd">
<td><code>"extPositionsTransfers": { "type": "FULL", "subType": "ACATS", "brokerId": "0226", "brokerName": "Wall Street Financial Group", </code><br />
<code>"accountAtBroker": "SOL12345", "sourceIRAType": "RO", "ssn": "123232323", "signature": "John Tester""marginLoan": true,"shortPos": false,"optionPos": false,"authorizeToRemoveFund": true}</code></td>
</tr>
</tbody>
</table>

<table>
<colgroup>
<col style="width: 33%" />
<col style="width: 33%" />
<col style="width: 33%" />
</colgroup>
<thead>
<tr class="header">
<th>Name</th>
<th>Type</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td>type</td>
<td>FULL<br />
PARTIAL</td>
<td>Indicate if this is a Full OR Partial Transfer.</td>
</tr>
<tr class="even">
<td>optionPos</td>
<td>true<br />
false</td>
<td>Does the account hold option positions? Yes/No</td>
</tr>
<tr class="odd">
<td>ssn</td>
<td>String</td>
<td>SSN listed on the account (This should match the SSN which was listed in Identification element AND TaxResidency element)</td>
</tr>
<tr class="even">
<td>brokerId</td>
<td>Use <a href="https://www.interactivebrokers.com/campus/ibkr-api-page/webapi-ref-staging/#tag/Account-Management-Utilities/paths/~1gw~1api~1v1~1enumerations~1%7BenumerationType%7D/get"><code>/api/v1/enumerations/acats </code></a>to view values.</td>
<td>DTC Number of the sending institution</td>
</tr>
<tr class="odd">
<td>brokerName</td>
<td>Use <a href="https://www.interactivebrokers.com/campus/ibkr-api-page/webapi-ref-staging/#tag/Account-Management-Utilities/paths/~1gw~1api~1v1~1enumerations~1%7BenumerationType%7D/get"><code>/api/v1/enumerations/acats </code></a>to view values.</td>
<td>Name of the sending Broker</td>
</tr>
<tr class="even">
<td>signature</td>
<td>String</td>
<td>This should match First Name + Middle Initial (If Applicable) + Last Name.</td>
</tr>
<tr class="odd">
<td>subType</td>
<td>ACATS</td>
<td>Static- will always be ACATS for ACATS transfer</td>
</tr>
<tr class="even">
<td>accountAtBroker</td>
<td>String</td>
<td>Account number at the sending institution.</td>
</tr>
<tr class="odd">
<td>marginLoan</td>
<td>true<br />
false</td>
<td>Does the account hold short positions? Yes/No</td>
</tr>
</tbody>
</table>

#### **Retirement Accounts**

###### decendent

|                                                                                                                                                                                                                                                                  |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `  "decendent": [ { "name": { "salutation": "Mr.", "first": "paulina", "last": "ibllc test", "middle": "M" }, "dateOfDeath": "2021-12-15", "relationship": "Individual", "inheritorType": I, "identification": { "SSN": "1231231212", "citizenship": "USA", }, ` |

<table>
<colgroup>
<col style="width: 33%" />
<col style="width: 33%" />
<col style="width: 33%" />
</colgroup>
<thead>
<tr class="header">
<th>Name</th>
<th>Type</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td>dateOfDeath</td>
<td>YYYY-MM-DD</td>
<td>Date of Death.</td>
</tr>
<tr class="even">
<td>SSN</td>
<td>String</td>
<td>Social security number, required for the deceased.</td>
</tr>
<tr class="odd">
<td>citizenship</td>
<td><a href="https://www.iso.org/obp/ui">3 Digit ISO Code</a></td>
<td>Citizenship of the deceased.</td>
</tr>
<tr class="even">
<td>inheritorType</td>
<td>I<br />
O<br />
T<br />
S</td>
<td>I=Individual<br />
O= Other<br />
T= Trust<br />
S= Spouse</td>
</tr>
<tr class="odd">
<td>relationship</td>
<td>Individual<br />
Other<br />
Trust<br />
Spouse</td>
<td></td>
</tr>
</tbody>
</table>

###### employeePlan

|                                 |
| ------------------------------- |
| `  "employePlan": "U1234456", ` |

| Name         | Type   | Description                                                     |
| ------------ | ------ | --------------------------------------------------------------- |
| employeePlan | String | IBKR Account ID associate with the Employee Plan Administrator. |

  - The  `/api/v1/enumerations/employee-plans`[ ](https://api.ibkr.com/gw/api/v1/enumerations/%7BenumerationType%7D) can be used to view list of EPA’s that are linked to the master.
  - Error will be thrown if the Employee Plan Administrator is not associated with the master account.
  - Employer will open an Employer Plan Admin account (**EPA**) directly with Interactive Brokers
  - The advisor/broker master will submit a one-time linking request to the EPA
      - EPA will accept
  - The SIMPLE IRA account will be linked to the EPA and Advisor.
      - Both the advisor/broker and EPA must have an open account with Interactive Brokers
  - The EPA manages all contributions into the SIMPLE IRA account
  - The advisor/broker can the trade on behalf of the SIMPLE IRA holder
  - Advisor/broker can use all designated FA functionality, except initiating a deposit notification

###### iraBeneficiaries

|                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `"iraBeneficiaries": {"primaryBeneficiaries": [{"name": {"salutation": "Mr.","first": "Joe","last": "Smith","middle": "A"},"dateOfBirth": "1967-11-09","countryOfBirth": "USA","residenceAddress": {"street1": "1 Tester Way","city": "Stamford","state": "CT","country": "United States","postalCode": "94510"},"identification": {"citizenship": "United States","ssn": "132121212",},"externalId": "100883PB1","sameMailAddress": true,"ownershipPercentage": 100,"relationship": "Husband"}],"successor": false"spousePrimaryBeneficiary": false},` |

<table>
<colgroup>
<col style="width: 33%" />
<col style="width: 33%" />
<col style="width: 33%" />
</colgroup>
<thead>
<tr class="header">
<th>Name</th>
<th>Type</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td>spousePrimaryBeneficiary</td>
<td>true<br />
false</td>
<td>Indicate if the spouse is the primary beneficiary.</td>
</tr>
<tr class="even">
<td>successor</td>
<td>true<br />
false</td>
<td>Indicate if Successor. Only applicable for Canadian TSFA accounts.</td>
</tr>
</tbody>
</table>

  - If **MaritalStatus=”M”** and **spouse\_primary\_beneficiary=”false”** , the Spousal Consent Form (form\_no=”4091″) will be required for approval. Spousal Consent Form can be submitted to IBKR using ‘[DocumentSubmission ](https://www.interactivebrokers.com/campus/ibkr-api-page/webapi-ref-staging/#tag/Account-Management-Accounts/paths/~1gw~1api~1v1~1accounts/patch)‘ via [/update](https://www.interactivebrokers.com/campus/ibkr-api-page/webapi-ref-staging/#tag/Account-Management-Accounts/paths/~1gw~1api~1v1~1accounts/patch) endpoint.[Download Spousal Consent Form](https://gdcdyn.interactivebrokers.com/Universal/servlet/Registration_v2.formSampleView?formdb=4091)

###### ira & iraType

Required for retirement accounts.

  - Indicate if retirement account and set retirement type.

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<tbody>
<tr class="odd">
<td><code>"iraType": "SIMPLE",</code><br />
<code>"ira": "true"</code></td>
</tr>
</tbody>
</table>

<table>
<colgroup>
<col style="width: 33%" />
<col style="width: 33%" />
<col style="width: 33%" />
</colgroup>
<thead>
<tr class="header">
<th>Name</th>
<th>Type</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td>ira</td>
<td>true<br />
false</td>
<td>Default is false. If retirement account, set to true.</td>
</tr>
<tr class="even">
<td>iraType</td>
<td>RI<br />
RO<br />
RT<br />
SP<br />
TH<br />
RH<br />
SH<br />
TFSA<br />
RRSP<br />
SRRSP<br />
SIMPLE<br />
ISA</td>
<td>Required IF <code>ira:"true"</code>
<p>Applicable for United States residents only:<br />
RI= Traditional New<br />
RO = Traditional Rollover<br />
RT = Roth New<br />
SP= SEP New<br />
TH = Traditional- Inherited<br />
RH= Roth- Inherited<br />
SIMPLE<br />
Details: <a href="https://www.interactivebrokers.com/en/index.php?f=14429">https://www.interactivebrokers.com/en/index.php?f=14429</a></p>
<p>Applicable for Canadian residents only:<br />
TFSA= Tax Free Savings Account.<br />
RRSP = Registered Retirement Savings Plan.<br />
SRRSP= Spousal Registered Retirement Savings Plan.<br />
Details: <a href="https://www.interactivebrokers.ca/en/index.php?f=13406&amp;p=tfsa">https://www.interactivebrokers.ca/en/index.php?f=11792</a></p>
<p>Applicable for UK Residents<br />
ISA= Individual Savings Account<br />
Details: https://www.interactivebrokers.co.uk/en/trading/isa-accounts.php</p></td>
</tr>
</tbody>
</table>

#### Trading Configuration

###### accountConfiguration

Manage LITE/PRO designation for account.

Available by request only, to use service, contact dam@ibkr.com.

<table>
<colgroup>
<col style="width: 33%" />
<col style="width: 33%" />
<col style="width: 33%" />
</colgroup>
<thead>
<tr class="header">
<th>Name</th>
<th>Type</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td>value</td>
<td>true<br />
false</td>
<td>true: Enable service<br />
false: Disable Service</td>
</tr>
<tr class="even">
<td>type</td>
<td>LiteExecution</td>
<td>Configuration type</td>
</tr>
</tbody>
</table>

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<tbody>
<tr class="odd">
<td><code>"accountConfiguration": { </code><br />
<code>"type": "LiteExecution",         </code><br />
<code>"value": true</code><br />
<code>},</code></td>
</tr>
</tbody>
</table>

###### accountType

Set trading account type, only applicable for clients facing IB-AU.

  - Applicable for accounts facing IB-AU entity.

|                            |
| -------------------------- |
| `"accountType":"Trading",` |

<table>
<colgroup>
<col style="width: 33%" />
<col style="width: 33%" />
<col style="width: 33%" />
</colgroup>
<thead>
<tr class="header">
<th>Name</th>
<th>Type</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td>accountType</td>
<td>Investment<br />
Trading</td>
<td><strong>Investment</strong>: For individual investors with 2K AUD minimum deposit and minimum liquid net worth of 20K AUD. No margin trading, limited options, unleveraged spot forex, and some low leverage derivatives trading allowed.<br />
<strong>Trading</strong>: Individual investors with a minimum of 10K Deposit AUD and minimum liquid net worth of 100K AUD or 20K AUD + 50K AUD minimum income. No trading on margin but limited options and unleveraged spot forex.</td>
</tr>
</tbody>
</table>

###### drip

Enroll account in the dividend reinvestment program.

  - Dividend reinvestment (DRIP) is an option where you can elect how you wish to receive your dividends for stocks and mutual funds. Dividend Reinvestment is available to IB LLC, IB AU, IB CAN, IB HK, IB IE, IB JP, IB SG and IB UK clients only.
  - Information on DRIP can be found [here](https://www.ibkrguides.com/clientportal/dividendreinvestment.htm).

|                  |
| ---------------- |
| `"drip": false,` |

<table>
<colgroup>
<col style="width: 33%" />
<col style="width: 33%" />
<col style="width: 33%" />
</colgroup>
<thead>
<tr class="header">
<th>Name</th>
<th>Type</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td>drip </td>
<td>true<br />
false</td>
<td>Flag to indicate if the account will subscribe to Dividend Reinvestment Plan.<br />
IBKR offers a dividend reinvestment program whereby accountholders may elect to reinvest qualifying cash dividends to purchase shares in the issuing company</td>
</tr>
</tbody>
</table>

###### stockYieldProgram

Enroll account in the Stock Yield Enhancement Program.

  - The Stock Yield Enhancement program provides customers with the opportunity to earn additional income on securities positions which would otherwise be segregated (i.e., fully-paid and excess margin securities) by permitting IBKR to lend out those securities to third parties. Customers who participate in the program will receive cash collateral to secure the return of the stock loan at its termination as well as interest on the cash collateral provided by the borrower for any day the loan exists.
  - Information on Stock Yield Program can be found [here](https://www.interactivebrokers.com/en/pricing/stock-yield-enhancement-program.php).

|                               |
| ----------------------------- |
| `"stockYieldProgram": false,` |

<table>
<colgroup>
<col style="width: 33%" />
<col style="width: 33%" />
<col style="width: 33%" />
</colgroup>
<thead>
<tr class="header">
<th>Name</th>
<th>Type</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td>stockYieldProgram</td>
<td>true<br />
false</td>
<td>Flag to indicate if the account will enroll in IBKR’s Stock Yield Enhancement Program.</td>
</tr>
</tbody>
</table>

###### limitedOptions

Enable access to limited options (Level 1 and Level 2)

|                           |
| ------------------------- |
| `"limitedOptions": false` |

<table>
<colgroup>
<col style="width: 33%" />
<col style="width: 33%" />
<col style="width: 33%" />
</colgroup>
<thead>
<tr class="header">
<th>Name</th>
<th>Type</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td>limitedOptions</td>
<td>true<br />
false</td>
<td>Indicate if limited options trading is elected . Default is “False”</td>
</tr>
</tbody>
</table>

  - Limited option trading is available with ANY Investment Objective.
  - Limited option trading lets you trade the following option strategies:
      - Long Call or Put
      - Covered Calls
      - Short Naked Put: Only if covered by cash
      - Call Spread: Only European-style cash-settled
      - Put Spread: Only European-style cash-settled
      - Long Butterfly: Only European-style cash settled
      - Iron Condor: Only European-style cash settled
      - Long Call and Puts
  - Information on option levels can be found [here](https://www.ibkrguides.com/clientportal/optionstradingpermissions.htm).

###### multiCurrency

Manage access to non-base currency products.

|                          |
| ------------------------ |
| `"multiCurrency": true,` |

<table>
<colgroup>
<col style="width: 33%" />
<col style="width: 33%" />
<col style="width: 33%" />
</colgroup>
<thead>
<tr class="header">
<th>Name</th>
<th>Type</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td>multicurrency</td>
<td>true<br />
false</td>
<td>Indicate if this account is multi-currency capable.</td>
</tr>
</tbody>
</table>

  - By default, all accounts have access to currency conversion (eg. Multiple Currencies).

#### Supplemental

###### accountRep

Designate account representative for the account.

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<tbody>
<tr class="odd">
<td><code>"accountRep": {        </code><br />
<code>"repDetails": {                   </code><br />
<code>"repId": "potest123",         </code><br />
<code>"percentage": 50        </code><br />
<code>},</code><br />
<code>"repId": "w3test123",         </code><br />
<code>"percentage": 50        </code><br />
<code>},</code></td>
</tr>
</tbody>
</table>

| Name       | Type   | Description                               |
| ---------- | ------ | ----------------------------------------- |
| **repId**  | String | Username associated with the account rep. |
| percentage | Number |                                           |

  - Designate account representative for the account. The account representative represents user at master level.
  - Multiple representatives can be assigned to a single account. Percentage across all reps must add up to 100.
  - If representative is not user at master level, error will be thrown.

###### migration

Indicate if account is part of bulk migration.

|                       |
| --------------------- |
| `"migration": false,` |

<table>
<colgroup>
<col style="width: 33%" />
<col style="width: 33%" />
<col style="width: 33%" />
</colgroup>
<thead>
<tr class="header">
<th>Name</th>
<th>Type</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td>migration</td>
<td>true<br />
false</td>
<td>Indicate if account is a migration account.</td>
</tr>
</tbody>
</table>

  - Only applicable for advisors/brokers that are completing bulk migration.
  - Usage of this attribute is available by request only, contact dam@ibkr.com.

###### propertyProfile

Assign account property to an account.

|                                  |
| -------------------------------- |
| `"propertyProfile": "Standard",` |

| Name            | Type   | Description                      |
| --------------- | ------ | -------------------------------- |
| propertyProfile | String | Name of property being assigned. |

  - Assign property profile to an account.
  - Available by request only. To use this, contact am-api@interactivebrokers.com.

###### sourceAccountId

For advisors/brokers that are completing bulk migration, include account ID of the source account.

|                                   |
| --------------------------------- |
| `"sourceAccountId": "ABA123123",` |

| Name            | Type   | Description                                                            |
| --------------- | ------ | ---------------------------------------------------------------------- |
| sourceAccountId | String | The account ID associated with individuals account at delivering firm. |

  - Only applicable for advisors/brokers that are completing bulk migration.
  - Usage of this attribute is available by request only, contact dam@ibkr.com.

## users

###### User

Define user(s) associated with the account.

|                                                                                                                |
| -------------------------------------------------------------------------------------------------------------- |
| `"users": [{"externalUserId": "MyTestAccount123","externalIndividualId": MyTestAccount123","prefix": "johnd"}` |

<table>
<colgroup>
<col style="width: 33%" />
<col style="width: 33%" />
<col style="width: 33%" />
</colgroup>
<thead>
<tr class="header">
<th>Name</th>
<th>Type</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td>externalIndividualId</td>
<td>String; max 64 characters</td>
<td>Identifier for the individual associated with this user. Required to create the association within the IBKR database.
<p>This is specified by the counterparty and must be unique for each account. If an externalIndividualId has already been used, you will receive an error. </p>
<p>*This can be the same externalId that was specified in the <a href="https://www.interactivebrokers.com/campus/ibkr-api-page/web-api-account-management/#customer-26">Customer</a> node.</p></td>
</tr>
<tr class="even">
<td>externalUserId</td>
<td>String; max 64 characters</td>
<td>Identifier for the individual associated with this user. Required to create the association within the IBKR database.
<p>This is specified by the counterparty and must be unique for each account. If an externalIndividualId has already been used, you will receive an error. </p>
<p>*This can be the same externalId that was specified in the <a href="https://www.interactivebrokers.com/campus/ibkr-api-page/web-api-account-management/#customer-26">Customer</a> node.</p></td>
</tr>
<tr class="odd">
<td>prefix</td>
<td>3-6 lowercase letters.</td>
<td>Prefix will be used when creating the user ID. IBKR will assign 3-6 numbers to the end of the prefix.<br />
If prefix includes the following, you will receive an error:
<p>• symbols or numeric values<br />
• Upper case letters<br />
• Prefix is less than 3 letters or more than 6 letters<br />
*This should be same prefix entered in the <a href="https://www.interactivebrokers.com/campus/ibkr-api-page/web-api-account-management/#customer-26">Customer</a> node.</p></td>
</tr>
</tbody>
</table>

###### mdServices

Manage market data subscriptions and subscribe to premium services.

|                        |
| ---------------------- |
| `"mdServices": [1473]` |

| Name | Type   | Description                                               |
| ---- | ------ | --------------------------------------------------------- |
| id   | String | Market service ID the user is requesting subscription to. |

  - List market data subscriptions which user is requesting based on the id associated with service.
  - The ` /api/v1/enumerations/market-data?mdStatusNonPro=F  `can be used to view subscriptions based on id.
  - If `mdStatusNonPro=F,` this will include subscriptions for Non-Professional.
  - If `mdStatusNonPro=T,` this will include subscriptions for Professional.
  - Prices for live data will vary based on if professional or non professional.
  - Conditions for Pro vs Non Pro can be found [here](https://ibkr.info/article/2369).

## documents

Include forms that are required for opening a brokerage account at IBKR. This includes any [agreements, disclosures](https://www.interactivebrokers.com/campus/ibkr-api-page/web-api-account-management/#agreements-and-disclosures), Tax Form, and supplemental documents such as Proof of ID and Proof of Address documents.

Required forms will vary based on the account configuration and the account type.

  - NonQI / OWD
      - Tax Form
      - Proof of Identity / Proof of Address if Trulioo is NoMatch.
  - Fully-Disclosed / Advisor
      - Tax Form
      - Proof of Identity / Proof of Address if Trulioo is NoMatch.
      - Customer Type (Individual, Joint, IRA etc.)
      - Capabilities (Margin, Portfolio Margin)
      - Trade Permissions (United States Stocks, United States Options, etc.)
      - IBKR Entity the Account is associated with. (ie. IBLLC-US, IB-CAN, IB-UK, IB-IE etc.)

###### Schema

<table>
<colgroup>
<col style="width: 25%" />
<col style="width: 25%" />
<col style="width: 25%" />
<col style="width: 25%" />
</colgroup>
<thead>
<tr class="header">
<th>Name</th>
<th>Type</th>
<th>Usage based on form_no</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td>fileName</td>
<td>String</td>
<td>All</td>
<td>File name of the PDF document submitted to IBKR. <code>fileName </code>included within the <code>documents </code>request must match the <code>fileName</code> of the PDF file that is included within the signed request.<br />
Acceptable formats: .jpeg, .jpg, .pdf, .png<br />
Max size: 10 MB</td>
</tr>
<tr class="even">
<td>fileLength</td>
<td>String</td>
<td>All</td>
<td>File length associated with document.</td>
</tr>
<tr class="odd">
<td>sha1Checksum</td>
<td>String</td>
<td>All</td>
<td>SHA-1 is crypto algorithm that is used to verify that a file has been unaltered. This is done by producing a checksum before the file has been transmitted, and then again once it reaches its destination.</td>
</tr>
<tr class="even">
<td>formNumber</td>
<td>String</td>
<td>All</td>
<td>Use <code>/gw/api/v1/accounts/{accountId}/tasks </code>to view a list of forms that are required for approval.</td>
</tr>
<tr class="odd">
<td>execTimestamp</td>
<td>YYYYMMDDHHMMSS</td>
<td>All</td>
<td>Timestamp of the execution of the agreement by the customer (i.e. time the client signed the agreement).</td>
</tr>
<tr class="even">
<td>execLoginTimestamp</td>
<td>YYYYMMDDHHMMSS</td>
<td>All</td>
<td>Login timestamp for the session (when the client logged in and acknowledged the agreement.</td>
</tr>
<tr class="odd">
<td>signedBy</td>
<td>String</td>
<td>All</td>
<td><code>signedBy </code>must match the submitted: name (<code>first + middle </code>initial (if applicable) + <code>last</code>).<br />
*Data is case and space sensitive. </td>
</tr>
<tr class="even">
<td>proofOfIdentityType</td>
<td><strong>All Entities Except for IB-CAN</strong><br />
Driver License<br />
Passport<br />
Alien ID Card<br />
National ID Card
<p><strong>IB-CAN only</strong><br />
Bank Statement<br />
Evidence of Ownership of Property<br />
Credit Card Statement<br />
Utility Bill<br />
Brokerage Statement<br />
T4 Statement<br />
CRA Assessment </p></td>
<td>8001<br />
8205<br />
8053<br />
8057</td>
<td>Description of document submitted to salsify proof of identity.</td>
</tr>
<tr class="odd">
<td>proofOfAddressType</td>
<td>Bank Statement<br />
Brokerage Statement<br />
Homeowner Insurance Policy Bill<br />
Homeowner Insurance Policy Document<br />
Renter Insurance Policy bill<br />
Renter Insurance Policy Document<br />
Security System Bill<br />
Government Issued Letters<br />
Utility Bill<br />
Current Lease<br />
Evidence of Ownership of Property<br />
Driver License<br />
Other Document</td>
<td>8002<br />
8001<br />
8205<br />
8053<br />
8057 </td>
<td>Description of document submitted to salsify proof of address.</td>
</tr>
<tr class="even">
<td>validAddress</td>
<td>true<br />
false</td>
<td>8001</td>
<td>If <code>Driver License</code> is provided as <code>proofOfIdentityType </code>AND <code>validAddress</code>=true, single document can be used to satisfy Proof of Identity and Proof of Address. ]</td>
</tr>
<tr class="odd">
<td>externalIndividualId</td>
<td>String</td>
<td></td>
<td>Identifier at the external entity for the individual executing the agreement. Must be an individual listed on the application. Ignored for INDIVIDUAL applications as agreements must be executed by the Account Holder. Required for JOINT accounts created via ECA for POI/POA submission. For the JOINT holder created via ECA, external id of the account holder needs to be provided for which POI/POA is being submitted.</td>
</tr>
<tr class="even">
<td>expirationDate</td>
<td>YYYY-MM-DD</td>
<td>Drivers License OR <br />
Passport</td>
<td>Provide expiration date of the ID document.</td>
</tr>
<tr class="odd">
<td>mimeType</td>
<td>application/pdf<br />
application/pdf<br />
image/png<br />
image/jpeg (Includes .jpeg, .jpg)</td>
<td></td>
<td>Format of the file.</td>
</tr>
<tr class="even">
<td>data</td>
<td>String</td>
<td></td>
<td>Includes document encoded in base64.</td>
</tr>
</tbody>
</table>

###### Example

``` wp-block-code
"documents": [
{
"signedBy": [
"Jane M Doe"
],
"attachedFile": {
"fileName": "Form5002.pdf",
"fileLength": 119331,
"sha1Checksum": "06c13ef0c01e831c1b9f0c2c0550812a4c242b3a",
"payload": {
                         "mimeType": "application/pdf",
                         "data": "<DocumentEncodedInBase64>"         }

                   
},
"formNumber": 5002,
"isValidAddress": false,
"execLoginTimestamp": 20240307114436,
"execTimestamp": 20240307114436
},
{
"signedBy": [
"Jane M Doe"
],
"attachedFile": {
"fileName": "POIandPOA.pdf",
"fileLength": 170163,
"sha1Checksum": "76bd4f17da8c8ed0d9ff752b5ffc0a1e38c16bd1"
},
"formNumber": 8001,
"proofOfIdentityType": "Drivers License",
"isValidAddress": true,
"execLoginTimestamp": 20240307114436,
"execTimestamp": 20240307114436
} ],
```

## Account Types

In this section, we review in detail the various account types that are supported. Each account type is designed to meet specific user needs and comes with its own set of features, capabilities, and limitations. Understanding the differences between these account types will help you select the most appropriate option for your requirements and ensure you have access to the functionality you need.

Please note that account types supported via API are limited compared to account types that are supported by our front end. Account types supported via the API are based on user demand. If there is an account type that you are interested in using and it is not currently supported, please contact your account representative to discuss your needs.

#### Supported Customer Types for Registration using the API

<table>
<colgroup>
<col style="width: 50%" />
<col style="width: 50%" />
</colgroup>
<thead>
<tr class="header">
<th>Full Integration</th>
<th>Hybrid</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td>Individual<br />
Joint<br />
Retirement (U.S. and Canada)<br />
ISA (United Kingdom)<br />
SMSF (Australia)</td>
<td>Individual<br />
Joint<br />
Retirement (U.S. and Canada)<br />
ISA (United Kingdom)<br />
SMSF (Australia)<br />
Organization (Corporation, LLC, Partnership)<br />
Trust</td>
</tr>
</tbody>
</table>

## Individual Savings Account for UK Residents

IBKR provides UK clients with access to tax-advantaged accounts, including Individual Savings Accounts (ISA) and Junior Individual Savings Accounts (JISA). This section provides guidance on implementing ISA and JISA account creation via the API.

## ISA (Individual Savings Account)

### Account Coupling Requirements

IBKR enforces mandatory account coupling with ISA accounts. When an ISA application is submitted, IBKR automatically creates a General Investment Account (GIA) underneath the IB-UK master.

**Important:** Agreements for both GIA and ISA must be included within the `documents` section of the JSON application submitted to IBKR using the `/accounts` endpoint.

### ISA Restrictions

#### Trading Permissions

  - **Stock Only** – No other asset types permitted

#### Margin Requirements

  - **No Margin Trading** – Accounts must be configured as CASH

#### Identification Requirements

  - **Tax Residency:** Must be GBR (United Kingdom)
  - **National ID:** If “`issuingCountry":"GBR`“, ` nationalCard  `is required

### ISA and GIA Coupling Details

#### Creation Method

  - ISA can **only** be created using new origination (submitting application using `/accounts` endpoint)
  - ISA **cannot** be added using `addAdditionalAcct`

#### Account Linking

  - ISA and linked GIA will be associated with a single username and password
  - Credentials for the GIA account will be included within the `ISASatelliteAccount` section of the response file
      - **Attribute:** `satelliteAccountId`

#### Multiple GIA Scenario

If a user maintains an existing GIA and requests an ISA:

  - The user will now have **two GIA accounts**, each with a different username
  - The GIA associated with ISA **cannot** be linked to the existing GIA
  - Each GIA operates independently with separate credentials

#### Account Closure Rules

  - The GIA associated with ISA **cannot** be closed independently of the ISA
  - To close: Submit closure request for the ISA, and the linked GIA will automatically be closed
  - If a closure request is submitted for the GIA linked to ISA, an **error will be thrown**

### Registration Tasks Assignment

Registration tasks are assigned at the applicant level:

#### Two Applicants Scenario

  - **Applicant 1:** ISA with Linked GIA
  - **Applicant 2:** Independent GIA

#### Single Applicant Scenario

Options include:

  - GIA + Linked GIA (created using `addAdditionalAcct`)
  - ISA with Linked GIA

### Technical Implementation

### Required fields for ISA Accounts

**Object**

FD

FA

**[Account Holder(s)](https://www.interactivebrokers.com/campus/ibkr-api-page/web-api-account-management/#associatedindividual-27)**\*

email\*

Y

Y

name\*  
<sub>first, last</sub>

Y

Y

dateOfBirth

Y

Y

countryOfBirth

Y

Y

numDependents

Y

Y

maritalStatus

Y

Y

identification   
<sub>ID Document, citizenship</sub>

Y

Y

mailingAddress  
<sub>country\*, state, city, street1, postalCode</sub>

Y

Y

residenceAddress  
<sub>country\*, state, city, street1, postalCode</sub>

Y

Y

phones  
<sub>number, type- Mobile Required</sub>

Y

Y

employmentType

Y

Y

employmentDetails  
<sub>If EMPLOYED or SELFEMPLOYED: employer, occupation, employerBusiness, employerAddress</sub>

Y

Y

taxResidencies\*  
<sub>country and tin</sub>

Y

Y

Tax Form  
<sub>w8Ben, w9</sub>

Y

Y

IBKR Agreements and Disclosures

Y

Y

Proof of Address and Proof of ID Documents

Y (If Trulioo Verification is NoMatch)

Y (If Trulioo Verification is NoMatch)

**[Account Information](https://www.interactivebrokers.com/campus/ibkr-api-page/web-api-account-management/#customer-28)**

financialInformation   
<sub>netWorth, liquidNetWorth, annualNetIncome</sub>

Y

Y

sourcesOfWealth

Y

Y

investmentExperience <sub>yearsTrading, tradesPerYear, knowledgeLevel</sub>

Y

Y

regulatoryInformation <sub>account holder or immediate family member controller, employee of a publicly traded company or a registered rep</sub>

Y

Y

accounts\*  
<sub>baseCurrency, margin</sub>

Y

Y

tradingPermissions\*

Y

Y

investmentObjectives

Y

Y

advisorWrapFees\*

N

Y

#### Sample Applications

###### ISA | GBR | Full Integration

``` wp-block-code
{
  "application": {
    "customer": {
      "accountHolder": {
        "accountHolderDetails": [
          {
            "name": {
              "first": "Jane",
              "last": "Doe"
            },
            "dateOfBirth": "1995-04-28",
            "countryOfBirth": "GBR",
            "maritalStatus": "S",
            "numDependents": 0,
            "residenceAddress": {
              "street1": "1 Tester Lane",
              "city": "London",
              "state": "GB-ENG",
              "country": "GBR",
              "postalCode": "SW9 9NY"
            },
            "phones": [
              {
                "type": "Mobile",
                "number": "+4407584089999",
                "country": "GBR"
              }
            ],
            "email": "janedoe@tester.com",
            "identification": {
              "citizenship": "GBR",
              "nationalCard": "PA123456D",
              "issuingCountry": "GBR",
              "expire": false
            },
            "employmentType": "EMPLOYED",
            "employmentDetails": {
              "employer": "CHIPOTLE",
              "occupation": "EXECUTIVE",
              "employerBusiness": "FOOD AND BEVERAGE",
              "employerAddress": {
                "street1": "1 TESTER Square",
                "city": "London",
                "state": "GB-ENG",
                "country": "GBR",
                "postalCode": "W1G 0PW"
              }
            },
            "taxResidencies": [
              {
                "country": "GBR",
                "tin": "PA123456D",
                "tinType": "NonUS_NationalId"
              }
            ],
            "w8Ben": {
              "name": "Jane Doe",
              "foreignTaxId": "PA141807D",
              "tinOrExplanationRequired": true,
              "part29ACountry": "GBR",
              "cert": true,
              "blankForm": true,
              "taxFormFile": "Form5001.pdf",
              "electronicFormat": true
            },
            "externalId": "testapp1234",
            "sameMailAddress": true,
            "translated": false
          }
        ],
        "financialInformation": [
          {
            "investmentExperience": [
              {
                "assetClass": "STK",
                "yearsTrading": 5,
                "tradesPerYear": 4,
                "knowledgeLevel": "Extensive"
              },
              {
                "assetClass": "OPT",
                "yearsTrading": 5,
                "tradesPerYear": 4,
                "knowledgeLevel": "Extensive"
              }
            ],
            "sourcesOfWealth": [
              {
                "sourceType": "SOW-IND-Income",
                "percentage": 100,
                "usedForFunds": true
              }
            ],
            "netWorth": 500000,
            "liquidNetWorth": 500000,
            "annualNetIncome": 250000,
            "translated": false
          }
        ],
        "regulatoryInformation": [
          {
            "regulatoryDetail": [
              {
                "code": "ControlPubTraded",
                "status": false
              },
              {
                "code": "EmployeePubTrade",
                "status": false
              },
              {
                "code": "AFFILIATION",
                "status": false
              }
            ],
            "translated": false
          }
        ]
      },
      "externalId": "testapp1234",
      "type": "INDIVIDUAL",
      "prefix": "nvest",
      "email": "janedoe@tester.com",
      "mdStatusNonPro": true
    },
    "accounts": [
      {
        "investmentObjectives": [
          "Speculation"
        ],
        "tradingPermissions": [
          {
            "country": "ALL",
            "product": "STOCKS"
          }
        ],
        "advisorWrapFees": {
          "strategy": "NO_FEE"
        },
        "externalId": "testapp1234",
        "baseCurrency": "GBP",
        "multiCurrency": false,
        "margin": "Cash",
        "ira": true,
        "iraType": "ISA"
      }
    ],
    "users": [
      {
        "externalUserId": "testapp1234",
        "externalIndividualId": "testapp1234",
        "prefix": "nvest"
      }
    ],
    "documents": [
      {
        "signedBy": [
          "Jane Doe"
        ],
        "attachedFile": {
          "fileName": "Form5001.pdf",
          "fileLength": 67700,
          "sha1Checksum": "D8AA699678D12DE6AC468A864D4FAE7999AA904B"
        },
        "formNumber": 5001,
        "validAddress": false,
        "execLoginTimestamp": 1731406668576,
        "execTimestamp": 1731406668576
      },
      {
        "signedBy": [
          "Jane Doe"
        ],
        "attachedFile": {
          "fileName": "Form2109.pdf",
          "fileLength": 15697,
          "sha1Checksum": "BF01D3C5B2B7BC6CA90A4051636051A828FD735F"
        },
        "formNumber": 2109,
        "validAddress": false,
        "execLoginTimestamp": 20240117041717,
        "execTimestamp": 20240117041717
      },
      {
        "signedBy": [
          "Jane Doe"
        ],
        "attachedFile": {
          "fileName": "Form3024.pdf",
          "fileLength": 67600,
          "sha1Checksum": "274FA053D7E4080F0AD429787B9F94ABDF5498D7"
        },
        "formNumber": 3024,
        "validAddress": false,
        "execLoginTimestamp": 20150716015642,
        "execTimestamp": 20150716152843
      },
      {
        "signedBy": [
          "Jane Doe"
        ],
        "attachedFile": {
          "fileName": "Form4319.pdf",
          "fileLength": 472704,
          "sha1Checksum": "485e44e6bc1e969ee1888fbf12bc957d7d41a182"
        },
        "formNumber": 4319,
        "validAddress": false,
        "execLoginTimestamp": 1731406668576,
        "execTimestamp": 1731406668576
      },
      {
        "signedBy": [
          "Jane Doe"
        ],
        "attachedFile": {
          "fileName": "Form4376.pdf",
          "fileLength": 118429,
          "sha1Checksum": "67D8506963789C3A2DA7B68F134D8F3F2515AFBC"
        },
        "formNumber": 4376,
        "validAddress": false,
        "execLoginTimestamp": 1731406668576,
        "execTimestamp": 1731406668576
      },
      {
        "signedBy": [
          "Jane Doe"
        ],
        "attachedFile": {
          "fileName": "Form4547.pdf",
          "fileLength": 409788,
          "sha1Checksum": "C7A601FD4C746EFC8767FCE886B03782A5C89A1C"
        },
        "formNumber": 4547,
        "validAddress": false,
        "execLoginTimestamp": 1731406668576,
        "execTimestamp": 1731406668576
      },
      {
        "signedBy": [
          "Jane Doe"
        ],
        "attachedFile": {
          "fileName": "Form4548.pdf",
          "fileLength": 416100,
          "sha1Checksum": "5FFF4BFEDD2F75A63EF493BB9F6ADEA63EBAF2A6"
        },
        "formNumber": 4548,
        "validAddress": false,
        "execLoginTimestamp": 1731406668576,
        "execTimestamp": 1731406668576
      }
    ],
    "translation": false
  }
}
```

###### ISA | GBR | Hybrid- All Info

``` wp-block-code
{
  "application": {
    "customer": {
      "accountHolder": {
        "accountHolderDetails": [
          {
            "name": {
              "first": "Jane",
              "last": "Doe"
            },
            "dateOfBirth": "1995-04-28",
            "countryOfBirth": "GBR",
            "maritalStatus": "S",
            "numDependents": 0,
            "residenceAddress": {
              "street1": "1 Tester Lane",
              "city": "London",
              "state": "GB-ENG",
              "country": "GBR",
              "postalCode": "SW9 9NY"
            },
            "phones": [
              {
                "type": "Mobile",
                "number": "+4407584089999",
                "country": "GBR"
              }
            ],
            "email": "janedoe@tester.com",
            "identification": {
              "citizenship": "GBR",
              "nationalCard": "PA123456D",
              "issuingCountry": "GBR",
              "expire": false
            },
            "employmentType": "EMPLOYED",
            "employmentDetails": {
              "employer": "CHIPOTLE",
              "occupation": "EXECUTIVE",
              "employerBusiness": "FOOD AND BEVERAGE",
              "employerAddress": {
                "street1": "1 TESTER Square",
                "city": "London",
                "state": "GB-ENG",
                "country": "GBR",
                "postalCode": "W1G 0PW"
              }
            },
            "taxResidencies": [
              {
                "country": "GBR",
                "tin": "PA123456D",
                "tinType": "NonUS_NationalId"
              }
            ],
            "w8Ben": {
              "name": "Jane Doe",
              "foreignTaxId": "PA141807D",
              "tinOrExplanationRequired": true,
              "part29ACountry": "GBR",
              "cert": true,
              "blankForm": true,
              "taxFormFile": "Form5001.pdf",
              "electronicFormat": true
            },
            "externalId": "testapp1234",
            "sameMailAddress": true,
            "translated": false
          }
        ],
        "financialInformation": [
          {
            "investmentExperience": [
              {
                "assetClass": "STK",
                "yearsTrading": 5,
                "tradesPerYear": 4,
                "knowledgeLevel": "Extensive"
              },
              {
                "assetClass": "OPT",
                "yearsTrading": 5,
                "tradesPerYear": 4,
                "knowledgeLevel": "Extensive"
              }
            ],
            "sourcesOfWealth": [
              {
                "sourceType": "SOW-IND-Income",
                "percentage": 100,
                "usedForFunds": true
              }
            ],
            "netWorth": 500000,
            "liquidNetWorth": 500000,
            "annualNetIncome": 250000,
            "translated": false
          }
        ],
        "regulatoryInformation": [
          {
            "regulatoryDetail": [
              {
                "code": "ControlPubTraded",
                "status": false
              },
              {
                "code": "EmployeePubTrade",
                "status": false
              },
              {
                "code": "AFFILIATION",
                "status": false
              }
            ],
            "translated": false
          }
        ]
      },
      "externalId": "testapp1234",
      "type": "INDIVIDUAL",
      "prefix": "nvest",
      "email": "janedoe@tester.com",
      "mdStatusNonPro": true
    },
    "accounts": [
      {
        "investmentObjectives": [
          "Speculation"
        ],
        "tradingPermissions": [
          {
            "country": "ALL",
            "product": "STOCKS"
          }
        ],
        "advisorWrapFees": {
          "strategy": "NO_FEE"
        },
        "externalId": "testapp1234",
        "baseCurrency": "GBP",
        "multiCurrency": false,
        "margin": "Cash",
        "ira": true,
        "iraType": "ISA"
      }
    ],
    "users": [
      {
        "externalUserId": "testapp1234",
        "externalIndividualId": "testapp1234",
        "prefix": "nvest"
      }
    ],
    "translation": false
  }
}
```

-----

## JISA (Junior Individual Savings Account)

Unlike ISA, JISA does **not** enforce account coupling with a GIA. However, JISA applications require two sets of contact information:

#### 1\. Account Holder Details

  - The `accountHolderDetails` section reflects the **Junior Contact (minor)** who owns the account

#### 2\. Registered Contact

  - The `associatedIndividual` section contains information about the individual overseeing or managing the account (parent/guardian)

### Technical Implementation

###### Required fields for Junior ISA Accounts

**Object**

FD

FA

**Junior Contact Information**

Y

Y

name\*  
<sub>first, last</sub>

Y

Y

residenceAddress  
<sub>country\*, state, city, street1, postalCode</sub>

Y

Y

mailingAddress  
<sub>country\*, state, city, street1, postalCode</sub>

Y

Y

dateOfBirth

Y

Y

countryOfBirth

Y

Y

identification   
<sub>ID Document, citizenship</sub>

Y

Y

taxResidencies\*  
<sub>country and tin</sub>

Y

Y

sourcesOfWealth

Y

Y

Tax Form  
<sub>w8Ben</sub>

**Registered Contact**

email\*

Y

Y

name\*  
<sub>first, last</sub>

Y

Y

dateOfBirth

Y

Y

countryOfBirth

Y

Y

mailingAddress  
<sub>country\*, state, city, street1, postalCode</sub>

Y

Y

residenceAddress  
<sub>country\*, state, city, street1, postalCode</sub>

Y

Y

identification   
<sub>ID Document, citizenship</sub>

phones  
<sub>number, type- Mobile Required</sub>

Y

Y

employmentType

Y

Y

employmentDetails  
<sub>If EMPLOYED or SELFEMPLOYED: employer, occupation, employerBusiness, employerAddress</sub>

Y

Y

IBKR Agreements and Disclosures

Y

Y

Proof of Address and Proof of ID Documents

Y (If Trulioo Verification is NoMatch)

Y (If Trulioo Verification is NoMatch)

**[Account Information](https://www.interactivebrokers.com/campus/ibkr-api-page/web-api-account-management/#customer-28)**

financialInformation   
<sub>netWorth, liquidNetWorth, annualNetIncome</sub>

Y

Y

investmentExperience <sub>yearsTrading, tradesPerYear, knowledgeLevel</sub>

Y

Y

regulatoryInformation <sub>account holder or immediate family member controller, employee of a publicly traded company or a registered rep</sub>

Y

Y

accounts\*  
<sub>baseCurrency, margin</sub>

Y

Y

tradingPermissions\*

Y

Y

investmentObjectives

Y

Y

advisorWrapFees\*

Y

Y

title  
<sub>code</sub>

Y

Y

#### Sample Applications

###### JISA | GBR | Full Integration

``` wp-block-code
{
  "application": {
    "customer": {
      "accountHolder": {
        "accountHolderDetails": [
          {
            "name": {
              "first": "Junior",
              "last": "Contact"
            },
            "dateOfBirth": "2022-12-20",
            "countryOfBirth": "GBR",
            "residenceAddress": {
              "street1": "24 TESTER LANE",
              "city": "LONDON",
              "state": "GB-LND",
              "country": "GB",
              "postalCode": "BR2 9FR"
            },
            "identification": {
              "citizenship": "GBR",
              "nationalCard": "NB123456C",
              "issuingCountry": "GBR",
              "expire": false
            },
            "taxResidencies": [
              {
                "country": "GBR",
                "tin": "NB123456C",
                "tinType": "NonUS_NationalId"
              }
            ],
            "w8Ben": {
              "localTaxForms": [
                {
                  "taxAuthority": "CANADA_TA",
                  "qualified": true,
                  "treatyCountry": "GBR"
                },
                {
                  "taxAuthority": "AUSTRALIA_TA",
                  "qualified": true,
                  "treatyCountry": "GBR"
                }
              ],
              "name": "Junior Contact",
              "foreignTaxId": "NB400056C",
              "tinOrExplanationRequired": true,
              "part29ACountry": "GBR",
              "cert": true,
              "signatureType": "Electronic",
              "blankForm": true,
              "taxFormFile": "Form5001.pdf",
              "electronicFormat": true
            },
            "externalId": "tester123",
            "sameMailAddress": false,
            "titles": [
              {
                "code": "Account Holder"
              }
            ],
            "authorizedPerson": false
          }
        ],
        "associatedIndividual": {
          "name": {
            "first": "Registered",
            "last": "Contact"
          },
          "dateOfBirth": "1963-12-20",
          "countryOfBirth": "GBR",
          "residenceAddress": {
            "street1": "24 TESTER LANE",
            "city": "LONDON",
            "state": "GB-LND",
            "country": "GB",
            "postalCode": "BR2 9FR"
          },
          "phones": [
            {
              "type": "Mobile",
              "number": "447483849999",
              "country": "GBR",
              "verified": false
            }
          ],
          "email": "DAM41832012@aol.com",
          "identification": {
            "citizenship": "GBR",
            "nationalCard": "NB400056A",
            "issuingCountry": "GBR",
            "expire": false
          },
          "employmentType": "EMPLOYED",
          "employmentDetails": {
            "employer": "Crown Prosecution Service ",
            "occupation": "Other",
            "description": "CIVIL",
            "employerBusiness": "Community/Social Service",
            "employerAddress": {
              "country": "GBR"
            }
          },
          "externalId": "tester123_rc",
          "sameMailAddress": true,
          "titles": [
            {
              "code": "Registered Contact"
            }
          ],
          "authorizedPerson": false
        },
        "financialInformation": [
          {
            "investmentExperience": [
              {
                "assetClass": "STK",
                "yearsTrading": 11,
                "tradesPerYear": 27,
                "knowledgeLevel": "Extensive"
              }
            ],
            "sourcesOfWealth": [
              {
                "sourceType": "SOW-IND-Income",
                "percentage": 10,
                "usedForFunds": true
              },
              {
                "sourceType": "SOW-IND-Pension",
                "percentage": 90,
                "usedForFunds": true
              }
            ],
            "netWorth": 375000,
            "liquidNetWorth": 70000,
            "annualNetIncome": 41600,
            "translated": false
          }
        ],
        "regulatoryInformation": [
          {
            "regulatoryDetail": [
              {
                "code": "EmployeePubTrade",
                "status": false
              },
              {
                "code": "ControlPubTraded",
                "status": false
              },
              {
                "code": "AFFILIATION",
                "status": false
              }
            ],
            "translated": false
          }
        ]
      },
      "externalId": "tester123",
      "type": "INDIVIDUAL",
      "prefix": "skm",
      "email": "DAM41832012@aol.com",
      "mdStatusNonPro": false
    },
    "accounts": [
      {
        "investmentObjectives": [
          "Growth"
        ],
        "tradingPermissions": [
          {
            "exchangeGroup": "US-SEC"
          },
          {
            "exchangeGroup": "EURONEXT-FUND"
          }
        ],
        "externalId": "tester123",
        "baseCurrency": "GBP",
        "multiCurrency": true,
        "margin": "Cash",
        "ira": true,
        "iraType": "JISA",
        "drip": false
      }
    ],
    "users": [
      {
        "externalUserId": "tester123",
        "externalIndividualId": "tester123",
        "prefix": "skm"
      }
    ],
    "documents": [
      {
        "signedBy": [
          "Registered Contact"
        ],
        "attachedFile": {
          "fileName": "Form5001.pdf",
          "fileLength": 67700,
          "sha1Checksum": "d8aa699678d12de6ac468a864d4fae7999aa904b"
        },
        "formNumber": 5001,
        "validAddress": false,
        "execLoginTimestamp": 20250511201657
      },
      {
        "signedBy": [
          "Registered Contact"
        ],
        "attachedFile": {
          "fileName": "Form3083.pdf",
          "fileLength": 557790,
          "sha1Checksum": "9C79DB3DF0925D126541817F2BBC7418BBD3EC4E"
        },
        "formNumber": 3083,
        "validAddress": false,
        "execLoginTimestamp": 20250511201657
      },
      {
        "signedBy": [
          "Registered Contact"
        ],
        "attachedFile": {
          "fileName": "Form4070.pdf",
          "fileLength": 27117,
          "sha1Checksum": "3BF982D0D81F0F6B1BBD37E9789EE6585F46F8DC"
        },
        "formNumber": 4070,
        "validAddress": false,
        "execLoginTimestamp": 20250511201657
      },
      {
        "signedBy": [
          "Registered Contact"
        ],
        "attachedFile": {
          "fileName": "Form9130.pdf",
          "fileLength": 252630,
          "sha1Checksum": "3F6E0751854D0BB7717AB4E954D97EDF31FEE6EA"
        },
        "formNumber": 9130,
        "validAddress": false,
        "execLoginTimestamp": 20250511201657
      }
    ],
    "translation": false
  }
}
```

###### JISA | GBR | Hybrid- All Info

``` wp-block-code
{
  "application": {
    "customer": {
      "accountHolder": {
        "accountHolderDetails": [
          {
            "name": {
              "first": "Junior",
              "last": "Contact"
            },
            "dateOfBirth": "2022-12-20",
            "countryOfBirth": "GBR",
            "residenceAddress": {
              "street1": "24 TESTER LANE",
              "city": "LONDON",
              "state": "GB-LND",
              "country": "GB",
              "postalCode": "BR2 9FR"
            },
            "identification": {
              "citizenship": "GBR",
              "nationalCard": "NB123456C",
              "issuingCountry": "GBR",
              "expire": false
            },
            "taxResidencies": [
              {
                "country": "GBR",
                "tin": "NB123456C",
                "tinType": "NonUS_NationalId"
              }
            ],
            "w8Ben": {
              "localTaxForms": [
                {
                  "taxAuthority": "CANADA_TA",
                  "qualified": true,
                  "treatyCountry": "GBR"
                },
                {
                  "taxAuthority": "AUSTRALIA_TA",
                  "qualified": true,
                  "treatyCountry": "GBR"
                }
              ],
              "name": "Junior Contact",
              "foreignTaxId": "NB400056C",
              "tinOrExplanationRequired": true,
              "part29ACountry": "GBR",
              "cert": true,
              "signatureType": "Electronic",
              "blankForm": true,
              "taxFormFile": "Form5001.pdf",
              "electronicFormat": true
            },
            "externalId": "tester123",
            "sameMailAddress": false,
            "titles": [
              {
                "code": "Account Holder"
              }
            ],
            "authorizedPerson": false
          }
        ],
        "associatedIndividual": {
          "name": {
            "first": "Registered",
            "last": "Contact"
          },
          "dateOfBirth": "1963-12-20",
          "countryOfBirth": "GBR",
          "residenceAddress": {
            "street1": "24 TESTER LANE",
            "city": "LONDON",
            "state": "GB-LND",
            "country": "GB",
            "postalCode": "BR2 9FR"
          },
          "phones": [
            {
              "type": "Mobile",
              "number": "447483849999",
              "country": "GBR",
              "verified": false
            }
          ],
          "email": "DAM41832012@aol.com",
          "identification": {
            "citizenship": "GBR",
            "nationalCard": "NB400056A",
            "issuingCountry": "GBR",
            "expire": false
          },
          "employmentType": "EMPLOYED",
          "employmentDetails": {
            "employer": "Crown Prosecution Service ",
            "occupation": "Other",
            "description": "CIVIL",
            "employerBusiness": "Community/Social Service",
            "employerAddress": {
              "country": "GBR"
            }
          },
          "externalId": "tester123_rc",
          "sameMailAddress": true,
          "titles": [
            {
              "code": "Registered Contact"
            }
          ],
          "authorizedPerson": false
        },
        "financialInformation": [
          {
            "investmentExperience": [
              {
                "assetClass": "STK",
                "yearsTrading": 11,
                "tradesPerYear": 27,
                "knowledgeLevel": "Extensive"
              }
            ],
            "sourcesOfWealth": [
              {
                "sourceType": "SOW-IND-Income",
                "percentage": 10,
                "usedForFunds": true
              },
              {
                "sourceType": "SOW-IND-Pension",
                "percentage": 90,
                "usedForFunds": true
              }
            ],
            "netWorth": 375000,
            "liquidNetWorth": 70000,
            "annualNetIncome": 41600,
            "translated": false
          }
        ],
        "regulatoryInformation": [
          {
            "regulatoryDetail": [
              {
                "code": "EmployeePubTrade",
                "status": false
              },
              {
                "code": "ControlPubTraded",
                "status": false
              },
              {
                "code": "AFFILIATION",
                "status": false
              }
            ],
            "translated": false
          }
        ]
      },
      "externalId": "tester123",
      "type": "INDIVIDUAL",
      "prefix": "skm",
      "email": "DAM41832012@aol.com",
      "mdStatusNonPro": false
    },
    "accounts": [
      {
        "investmentObjectives": [
          "Growth"
        ],
        "tradingPermissions": [
          {
            "exchangeGroup": "US-SEC"
          },
          {
            "exchangeGroup": "EURONEXT-FUND"
          }
        ],
        "externalId": "tester123",
        "baseCurrency": "GBP",
        "multiCurrency": true,
        "margin": "Cash",
        "ira": true,
        "iraType": "JISA",
        "drip": false
      }
    ],
    "users": [
      {
        "externalUserId": "tester123",
        "externalIndividualId": "tester123",
        "prefix": "skm"
      }
    ],
       "translation": false
  }
}
```

## Resources

In this section, you will find resources to help you get started with the API. We’ve assembled everything you need to begin integrating with our API quickly and efficiently.

#### [Postman Collection](https://www.interactivebrokers.com/campus/ibkr-api-page/web-api-account-management/#postman-35)

Get hands-on experience with our API endpoints immediately using our pre-configured Postman collection. This collection includes:

  - Ready-to-use API requests
  - Pre-set authentication parameters
  - Example payloads for each endpoint
  - Environment variables for easy configuration

#### [Developer Tool Kit](https://www.interactivebrokers.com/campus/ibkr-api-page/web-api-account-management/#developer-tool-kit-36)

  - Authentication and authorization methods
  - Common integration patterns

#### [Sample Applications](https://www.interactivebrokers.com/campus/ibkr-api-page/web-api-account-management/#sample-applications-37)

  - Endpoint documentation with request/response examples

#### [Sample Responses](https://www.interactivebrokers.com/campus/ibkr-api-page/web-api-account-management/#sample-responses)

  - Error handling best practices

## Postman

To effectively explore and understand our API endpoints, we recommend using Postman. This industry-standard tool will help you visualize requests and responses, making your development process more efficient.

Download our prepared resources to get started quickly:

  - [IBKR Postman Collection](https://www.interactivebrokers.com/campus/wp-content/uploads/api/IBPublic_Generic.PostmanCollection.postman_collection.json)
  - [IBKR QA Environment Settings](https://www.interactivebrokers.com/campus/wp-content/uploads/api/Generic-_IB_QA.postman_environment.json)
  - [IBKR Production Environment Settings](https://www.interactivebrokers.com/campus/wp-content/uploads/api/Generic-_IB_PROD.postman_environment.json)

### Setup Instructions

#### 1\. Install Postman

Download and install the latest version of [Postman](https://www.postman.com/downloads/) for your operating system.

#### 2\. Import Resources

Import our collection and environment files into your Postman workspace:

  - Open Postman
  - Click “Import” in the upper left corner
  - Upload the downloaded collection and environment files

#### 3\. Configure Environment Variables

For the API to function properly, update the following essential variables in your selected environment:

| Variable           | Description          | Your Value             |
| ------------------ | -------------------- | ---------------------- |
| `clientPrivateKey` | Your Private RSA Key | *\[Your private key\]* |
| `clientPublicKey`  | Your Public RSA Key  | *\[Your public key\]*  |
| `clientId`         | Your Client ID       | *\[Your client ID\]*   |

### Important Note

**API Credentials Required**: The collection and environment will only work with valid API credentials. If you don’t have credentials yet, please contact our support team at <am-api@interactivebrokers.com>.

### Next Steps

Once configured, you can explore all available endpoints, test requests, and examine responses to better understand our API functionality.

## Developer Tool Kit

This section provides comprehensive information on how to integrate with our Account Management API and a developer toolkit to get you up and running quickly.

#### Prerequisites

  - An API credential (contact our support team at [am-api@interactivebrokers.com](mailto:support@example.com) to obtain one)
  - Basic knowledge of REST API
  - A development environment capable of making HTTP requests

###### Start Trading

Establishing a customer profile, setting up your trading account, and executing your first transaction

###### Request Access Token

The access token is required to access IBKR Web API. Request an access token using `[POST]/api/v1/token`. These tokens contain a **scope** parameter which describes what you are allowed to do with a given access token.

For this exercise, we need the following scopes:

  - `accounts.read:` View Brokerage Account information
  - `accounts.write`: Create Brokerage Account
  - `bank-instructions.write`: Add Banking Instructions
  - `transfers.write`: Transfer Funds
  - `statements.read`: View Client Statement
  - `instructions.read:` View Fund Transfer
  - `sso-browser-sessions.write`: Create SSO session to IBKR Portal.
  - `sso.sessions.write`: Placing Trades

<!-- end list -->

``` wp-block-code
{
  "url": "https://api.ibkr.com/oauth2/api/v1/token",
  "method": "POST",
  "timeout": 0,
  "headers": {
    "Content-Type": "application/x-www-form-urlencoded",
    "Cookie": "x-sess-uuid=0.46eb7068.1753288804.ce36eee"
  },
  "data": {
    "client_assertion_type": "{{clientAssertionType}}",
    "client_assertion": "{{clientAssertion}}",
    "grant_type": "client_credentials",
    "scope": "accounts.read accounts.write bank-instructions.read bank-instructions.write clients.read clients.write echo.read echo.write fee-templates.read fee-templates.write instructions.read instructions.write statements.read transfers.read transfers.write sso-sessions.write sso-browser-sessions.write enumerations.read"
  }
}
```

###### Create Brokerage Account

To establish a brokerage account for the client within the IBKR platform, submit client data to IBKR using `[POST] gw/api/v1/accounts`. The [required data points](https://www.interactivebrokers.com/campus/ibkr-api-page/web-api-account-management/#data-for-client-registration-5) for the [request](https://www.interactivebrokers.com/campus/ibkr-api-page/web-api-account-management/#sample-applications-35) will vary based on the account type and customer type.

### Authentication & Processing

IBKR authenticates the provided access token to verify server authorization before proceeding with the account creation request. The system typically processes the request and delivers a response within 30 seconds, though in some instances this may extend to 120 seconds.

#### Response Interpretation

Upon completion, IBKR returns a structured response that will indicate either a successful account creation or an error requiring attention.

**Successful Creation**

When account creation is successful, the [response](https://www.interactivebrokers.com/campus/ibkr-api-page/web-api-account-management/#sample-responses-36) will contain:

  - IBKR Credential `user`
  - IBKR Account Number `accounts.value`
  - Password (if enabled) `password`
  - Pending Registration Tasks Required For Approval `pendingTasks`
      - If present: Account will not be approved/opened until tasks are complete.

**Note:** The hosting firm is responsible for securely communicating these credentials to the account holder.

**Error Resolution**

If an error occurs, the account will not be established. The hosting firm must:

1.  Review the error details
2.  Make necessary corrections based on the [**Error Library**](https://www.interactivebrokers.com/campus/ibkr-api-page/web-api-account-management/#error-handling-37) documentation
3.  Resubmit the request

###### Open Brokerage Account

Check state of the applications to see if any action is needed. Only accounts with an Open **state** are available for trading. <sup>**TIP:** Addressing all requirements promptly will help expedite your account activation. Regularly monitor your application status to ensure timely completion of the account opening process.</sup>

`[GET] /gw/api/v1/accounts/{accountId}/status`

  - **Incomplete Application** = Connect user to IBKR Portal using [Single Sign On](https://www.interactivebrokers.com/campus/ibkr-api-page/web-api-account-management/#single-sign-on-23) to complete online registration journey.
  - **Documents Required **= Action Needed
      - **View Pending Tasks Required for Approval**: `/gw/api/v1/accounts/{accountId}/tasks?type=pending ` 
  - **Under Review with IBKR** = Application is PENDING on IBKR, no action needed.
  - **Pending Approval **= Account is in the approval queue and should be opened by the following business day.
  - **Open = **Account is opened and there are no pending tasks assigned to the account.

### Task Requirements for Account Approval

Tasks fall into two categories:

  - **Required tasks** (`"isRequiredForApproval": true`) – Must be completed for account approval
  - **Optional tasks** (`"isRequiredForApproval": false`) – Not necessary for account approval

***Completing Tasks***

**Option 1: API Method**

  - Use the PATCH endpoint: `/api/v1/accounts/`
  - **Limitation**: Only supports select [tasks](https://www.interactivebrokers.com/campus/ibkr-api-page/web-api-account-management/#complete-registration-tasks-10).
  - Best for programmatic completion of supported tasks

**Option 2: IBKR Portal via Single Sign On**

  - Redirect users to complete tasks directly in the IBKR Portal using [Single Sign On](https://www.interactivebrokers.com/campus/ibkr-api-page/web-api-account-management/#single-sign-on-23)
  - **Advantage**: Supports all possible tasks; no development as the interface is hosted by IBKR.

**Recommended Implementation**

1.  First attempt to complete tasks via API (Option 1)
2.  If any required tasks are not supported via API, fall back to the IBKR Portal (Option 2)
3.  Always have Option 2 available as a fallback mechanism for unsupported tasks

This approach provides the most seamless experience while ensuring all required tasks can be completed.

###### Fund Account

Once your account has been successfully opened, you can proceed with account funding. The specific funding mechanism will depend on your customer type.

### Non-Disclosed Clients

For Non-Disclosed clients, all funds must be processed through the Non-Disclosed master account:

  - Funding is initiated by an [internal transfer](https://www.interactivebrokers.com/campus/ibkr-api-page/web-api-account-management/#internal-transfer-19) of cash or positions from the Non-Disclosed master account to the Non-Disclosed sub-account

### Direct Clients

For Direct Clients, including Fully-Disclosed and Advisor, funding is initiated directly at the sub-account level using a [cash](https://www.interactivebrokers.com/campus/ibkr-api-page/web-api-account-management/#cash-transfer-17) or [position](https://www.interactivebrokers.com/campus/ibkr-api-page/web-api-account-management/#position-transfers-20) transfer.

**Important:** If a transfer method is not supported using the front end, it will not be supported using the API

###### Place Trades

1.  **Request SSO Bearer Token**
      - [**`[POST]/api/v1/sso-sessions`**](https://www.interactivebrokers.com/campus/ibkr-api-page/webapi-ref/#tag/Authorization-SSO-Sessions/paths/~1gw~1api~1v1~1sso-sessions/post): Create a Single Sign On (SSO) session to access IBKR’s Trading Web API
      - Returns a JSON object containing a reference to the newly created SSO session (including an SSO Bearer Token).
2.  **Initialize Brokerage Session**
      - `[POST]/iserver/auth/ssodh/init` : This is essential in order to use all /iserver trading & market data endpoints.
          - Additional background regarding Trading Web API sessions noted [here](https://www.interactivebrokers.com/campus/ibkr-api-page/cpapi-v1/#auth-sessions-background).
      - **Receive Brokerage Accounts** (Optional): Receive a list of Brokerage Accounts the user has trading access to, their respective aliases and the currently *selectedAccount* via [**\[GET\]/iserver/accounts**](https://www.interactivebrokers.com/campus/ibkr-api-page/webapi-ref/#tag/Trading-Accounts/paths/~1iserver~1account~1%7BaccountId%7D~1summary~1market_value/get).
3.  **Place Order**
      - `[POST]/iserver/account/{accountID}/orders`: Available order types include (but are not limited to): MKT, LMT, STP, STP LMT, TRAIL, MOC, LOC, VWAP (IBALGO orders), Bracket, OCA, pre-trade allocation group orders (for Financial Advisors), cashQty orders etc.
4.  **Log Out**
      - Log the user out of the Trading Web API session using [**`[POST]/logout`**](https://www.interactivebrokers.com/campus/ibkr-api-page/webapi-ref/#tag/Trading-Session/paths/~1iserver~1reauthenticate/get). Any further activity requires re-authentication. 

###### View Account Activity

#### Option 1: Query Account Information using Web API

  - [`[GET]/portfolio/accounts`](https://www.interactivebrokers.com/campus/ibkr-api-page/web-api-trading/#querying-your-accounts-48): Real-time data access to view intra-day data including open positions and account balances.
  - [`[GET]/iserver/account/trades`](https://www.interactivebrokers.com/campus/ibkr-api-page/webapi-ref/#tag/Trading-Orders/paths/~1iserver~1account~1orders/get): Real-time order monitoring and execution reports.

#### Option 2: Generate Statements using Web API`  [POST]/api/v1/statements `

  - Generates PDF statements for specified date range
  - Maximum range: 365 days per request

#### Option 3: Start of Day and End of Day Files

  - We offer users with full suite of reports including [account statements](https://ibkrguides.com/clientportal/performanceandstatements/statements.htm), [PortfolioAnalyst ](https://www.interactivebrokers.com/en/portfolioanalyst/overview.php)and [flex queries](https://ibkrguides.com/clientportal/performanceandstatements/flex.htm) (raw data files).
      - Generate on the fly directly within [IBKR Portal](https://ibkrguides.com/clientportal/performanceandstatements/reports.htm)
      - Receive securely delivered via sFTP (contact <filedelivery@interactivebrokers.com>)
      - Retrieve files using [Flex Web Service](https://ibkrguides.com/clientportal/performanceandstatements/flex-web-service.htm) can be used to automate flex query processing.

###### Account Maintenance

Implementing comprehensive account maintenance capabilities is essential for effective post-approval client management. 

### [Profile Changes](https://www.interactivebrokers.com/campus/ibkr-api-page/web-api-account-management/#update-information-12)

  - **changeAccountHolderDetail**: Updating client account information, ensuring data accuracy and compliance with KYC requirements.
  - **updateCredentials**: Allows secure updating of email addresses associated with accounts, supporting proper client communications and security protocols.
  - **updateTaxForm**: Facilitates timely updates to tax forms associated with accounts, ensuring accurate tax reporting and compliance with tax authorities.
  - **completeLoginMessages**: Allows users to address pending tasks assigned to the account post approval including acknowledgement or changes to existing IBKR agreements and Disclosures.
  - **changeFinancialInformation**: Allows updates to client financial profile including objectives, experience and sources of wealth.
  - **changeBaseCurrency**: Supports international clients and those with changing currency needs.

### [Account Capabilities](https://www.interactivebrokers.com/campus/ibkr-api-page/web-api-account-management/#update-information-12)

  - [Trading Permissions](https://www.interactivebrokers.com/en/trading/products-stocks.php)
      - `addTradingPermissions`: Enables clients to access additional products and markets post account approval as their needs evolve. This capability allows for appropriate risk management through controlled access to trading features.
      - `removeTradingPermissions`: Removal of trading capabilities when needed, supporting both client-requested changes and compliance-driven restrictions.
  - [Dividend Reinvestment (DRIP)](https://ibkrguides.com/kb/en-us/overview-of-drip.htm)
      - `enrollInDRIP`: Enables participation in Dividend Reinvestment Plans, supporting long-term investment strategies and account growth. This capability promotes passive wealth accumulation and client retention.
      - `leaveDRIP`: Provides flexibility to exit dividend reinvestment programs when client needs or strategies change, supporting client autonomy and account management flexibility.
  - [Stock Yield Enhancement Program](https://www.interactivebrokers.com/en/pricing/stock-yield-enhancement-program.php)
      - `enrollInSYEP`: Allows clients to participate in Stock Yield Enhancement Programs, creating opportunities for additional income through securities lending. This capability supports portfolio optimization and income generation strategies.
      - ` leaveSYEP:  `Provides clients with the flexibility to exit Stock Yield Enhancement Programs when their investment strategy changes or when they wish to regain full control over their securities. This supports client autonomy and risk management preferences.

###### Cash Transactions

Transferring Funds Between External Bank Account and IBKR Brokerage Account

###### Request Access Token

The access token is required to access IBKR Web API. Request an access token using `[POST]/api/v1/token`. These tokens contain a **scope** parameter which describes what you are allowed to do with a given access token.

For this exercise, we need the following scopes:

  - `bank-instructions.write`: Add Banking Instructions
  - `transfers.write`: Transfer Funds
  - `instructions.read:` View Fund Transfer

<!-- end list -->

``` wp-block-code
{
  "url": "https://api.ibkr.com/oauth2/api/v1/token",
  "method": "POST",
  "timeout": 0,
  "headers": {
    "Content-Type": "application/x-www-form-urlencoded",
    "Cookie": "x-sess-uuid=0.46eb7068.1753288804.ce36eee"
  },
  "data": {
    "client_assertion_type": "{{clientAssertionType}}",
    "client_assertion": "{{clientAssertion}}",
    "grant_type": "client_credentials",
    "scope": "accounts.read accounts.write bank-instructions.read bank-instructions.write clients.read clients.write echo.read echo.write fee-templates.read fee-templates.write instructions.read instructions.write statements.read transfers.read transfers.write sso-sessions.write sso-browser-sessions.write enumerations.read"
  }
}
```

###### Banking Instructions

Verify that banking instructions exist for the specified account before allowing fund transfer.

1.  **Verify Active Banking Instructions for the account**: The `/gw/api/v1/bank-instructions/query` endpoint can be used to view list of saved banking instructions on file by `accountId` and `bankInstructionMethod`. The response will return the corresponding `bankInstructionName` and, `bankRoutingNumber`, `currency` last 4 digits of the `bankAccountNumber` (if applicable).
      - If instruction is returned, offer user option to use existing instruction
      - If no instruction is returned OR user does not want to use instruction on file, Hosting firm will instruct user they need to add instructions to process request.
2.  **Add Banking Instructions**
      - **ACH:** The `/gw/api/v1/bank-instructions` endpoint can be used to add banking instructions to an existing IBKR brokerage account. Only available to U.S. residents with [linked bank accoun](https://www.interactivebrokers.com/campus/ibkr-api/account-management-api/#create-bank-instructions-28)[t](https://www.interactivebrokers.com/campus/ibkr-api-page/web-api-account-management/#bank-instructions-16).
      - Additional payment types and currencies including Open Banking, Wise, Bill Pay, EFT, etc. will need to be added using the IBKR hosted interface. Seamlessly integrate these options into your platform by leveraging our [Single Sign-On (SSO)](https://www.interactivebrokers.com/campus/ibkr-api-page/web-api-account-management/#single-sign-on-26) functionality with IFRAME embedding, allowing IBKR funding screens to display natively within your application interface.

###### View Available Cash Balances

The `/gw/api/v1/external-cash-transfers/query` can be used to view the available cash for withdrawal with and without margin loan based on an `accountId` **AND **`currency`. For non-disclosed clients, this endpoint will return available cash to transfer between master and sub account.

Response will return following values:

  - `withdrawableAmount`: Cash Amount available for withdrawal (assuming margin loan). Only applicable for Fully-Disclosed and Advisor Clients.
  - `withdrawableAmountNoBorrow`: Cash Amount available for withdrawal (without margin loan). Only applicable for Fully-Disclosed and Advisor Clients.
  - `allowedTransferAmountToMaster`: Allowed Transfer Amount to Master assuming margin loan. Only applicable for Non-Disclosed Clients.
  - `allowedTransferAmountToMasterNoBorrow`: Allowed Transfer Amount(no\_borrow) to Master. Only applicable for Non-Disclosed Clients.
  - `withdrawableBalanceWithoutOriginHold`: The amount available for withdrawal without origination hold.

###### Transfer Funds

The `/gw/api/v1/external-cash-transfers` can be used to manage cash transfers between external bank account and the IBKR brokerage account. Transfer details including method (`ACH` and `WIRE`), transaction type (`DEPOSIT `or `WITHDRAWAL`), `currency`, and `amount `will be defined within the body of the request.

###### GBP- Open Banking

``` wp-block-code
POST /gw/api/v1/external-cash-transfers
{
  "instructionType": "DEPOSIT",
  "instruction": {
    "clientInstructionId": 7013045,
    "accountId": "U46377",
    "currency": "GBP",
    "amount": 100,
    "bankInstructionMethod": "ACH",
    "bankInstructionName": "British Bank",
  }
}
```

###### USD- ACH Deposit

``` wp-block-code
POST /gw/api/v1/external-cash-transfers
{
  "instructionType": "DEPOSIT",
  "instruction": {
    "clientInstructionId": 7013045,
    "accountId": "U46377",
    "currency": "USD",
    "amount": 100,
    "bankInstructionMethod": "ACH",
    "bankInstructionName": "My Checking Account",
  }
}
```

###### USD- Wire Withdrawal

``` wp-block-code
POST /gw/api/v1/external-cash-transfers
{
  "instructionType": "WITHDRAWAL",
  "instruction": {
    "clientInstructionId": 7013045,
    "accountId": "U46377",
    "currency": "USD",
    "amount": 100,
    "bankInstructionMethod": "WIRE",
    "bankInstructionName": "CHASE Bank",
  }
}
```

## Test Cases

###### Client Registration – Regression Test Cases

  - General
      - meetAmlStandard is set to false
      - mdStatusNonPro is set to false
      - prefix is set to teste
      - Invalid baseCurrency is provided (Eg. USDD)
      - externalId has already been processed
  - name
      - Name includes special characters, numbers, or white spaces
      - Single letter provided for last name
      - First name is null
  - dateOfBirth
      - Applicant is less than 18 years old
  - countryOfBirth
      - Country of Birth is a prohibited country (eg. AFG)
      - Country of Birth is United States (eg. USA)
  - residenceAddress
      - Country of Residence is a prohibited country (eg. AFG)
      - Country of Residence is United States (eg. USA)
      - Country of Residence is different from Tax Residency Country and part29aCountry for W8Ben
      - State provided as full state name versus the ISO code
      - street1 exceeds 200 characters
      - Postal code is null
  - email
      - Email address is null
      - Email address is same as the master account
      - Invalid email provided (eg. tester@gmail)
  - identification
      - Country of Citizenship is a prohibited country (eg. AFG)
      - Country of Citizenship is United States (eg. USA)
      - Invalid ID Type is provided
      - expire is set to true AND expirationDate is missing
      - expirationDate is past date
      - ID Type and ID document is missing
      - SSN is provided and issuingCountry **is not** United States
  - employmentType and employmentDetails
      - employmentType is null
      - employmentType is EMPLOYED and
          - employmentDetails is missing
          - occupation and/or employerBusiness is null
          - occupation and/or employerBusiness = ‘Other’
          - employerAddress is missing
          - State provided as full state name versus the ISO code
          - street1 exceeds 200 characters
          - Postal code is null
          - country of employment is different from country of residence
          - occupation/employerBusiness is not an IBKR enumeration value
  - taxResidencies
      - tax residency country AND part29ACountry are different
      - TIN and w8Ben.foreignTaxId are different
      - TIN AND w8Ben.explanation are provided
      - SSN is provided as TINType and country **is not** United States
  - w8Ben
      - blankForm is set to FALSE **AND** sha1Checksum reflects sha1Checksum of a blank form.
      - part29ACountry is N/A AND explanation is missing
      - part29ACountry is null
      - name **is** different from the name.first  + name.middle +  name.Last
  - financialInformation
      - liquidNetWorth is greater than netWorth
      - netWorth, liquidNetWorth, annualNetIncome is between 101 to 999
      - netWorth, liquidNetWorth, annualNetIncome is a negative value
      - netWorth, liquidNetWorth, annualNetIncome is null
  - regulatoryDetail
      - status is set to true AND details is missing
      - ControlPubTraded and/or EmployeePubTrade are missing
  - documents
      - signedBy **does not** match name.first + name.middleInitial + name.last
      - signedBy is missing
      - sha1checksum does not match sha1checksum of the form provided
      - formNumber is 8001 AND proofOfIdentityType is missing

## Sample Applications

##### Advisor and Fully-Disclosed

### Individual

###### Individual | USA | Full Integration

``` wp-block-code
{
  "application": {
    "customer": {
      "accountHolder": {
        "accountHolderDetails": [
          {
            "name": {
              "salutation": "Mr.",
              "first": "John",
              "last": "Does",
              "middle": "F"
            },
            "dateOfBirth": "1990-01-25",
            "countryOfBirth": "USA",
            "maritalStatus": "M",
            "numDependents": 0,
            "residenceAddress": {
              "street1": "1 Tester Street",
              "city": "Test City",
              "state": "CT",
              "country": "United States",
              "postalCode": "85755"
            },
            "phones": [
              {
                "type": "Mobile",
                "number": "2034228988",
                "country": "United States",
                "verified": false
              }
            ],
            "email": "test@gmail.com.com",
            "identification": {
              "citizenship": "United States",
              "ssn": "11223399",
              "issuingCountry": "USA",
              "legalResidenceCountry": "USA",
              "legalResidenceState": "AZ",
              "expire": false
            },
            "employmentType": "EMPLOYED",
            "employmentDetails": {
              "employer": "Test Employer Name Here",
              "occupation": "Analyst",
              "employerBusiness": "Computer/Information Technology",
              "employerAddress": {
                "street1": "22 Tester Road",
                "city": "Test City",
                "state": "CT",
                "country": "USA",
                "postalCode": "93929"
              }
            },
            "taxResidencies": [
              {
                "country": "United States",
                "tin": "11223399",
                "tinType": "SSN"
              }
            ],
            "w9": {
              "name": "John F Does",
              "customerType": "Individual",
              "tin": "11223399",
              "tinType": "SSN",
              "cert1": true,
              "cert2": true,
              "cert3": true,
              "cert4": true,
              "signatureType": "Electronic",
              "blankForm": true,
              "taxFormFile": "Form5002.pdf",
              "proprietaryFormNumber": 5002
            },
            "externalId": "testexternalId1234AH",
            "sameMailAddress": true,
            "ownershipPercentage": 100,
            "titles": [
              {
                "code": "Account Holder"
              }
            ],
            "authorizedPerson": false
          }
        ],
        "financialInformation": [
          {
            "investmentExperience": [
              {
                "assetClass": "BOND",
                "yearsTrading": 0,
                "tradesPerYear": 0,
                "knowledgeLevel": "Limited"
              },
              {
                "assetClass": "FUND",
                "yearsTrading": 4,
                "tradesPerYear": 5,
                "knowledgeLevel": "Good"
              },
              {
                "assetClass": "OPT",
                "yearsTrading": 0,
                "tradesPerYear": 0,
                "knowledgeLevel": "None"
              },
              {
                "assetClass": "STK",
                "yearsTrading": 7,
                "tradesPerYear": 5,
                "knowledgeLevel": "Good"
              }
            ],
            "sourcesOfWealth": [
              {
                "sourceType": "SOW-IND-Income",
                "percentage": 100,
                "usedForFunds": true
              }
            ],
            "netWorth": 750000,
            "liquidNetWorth": 375000,
            "annualNetIncome": 75000,
            "translated": false
          }
        ],
        "regulatoryInformation": [
          {
            "regulatoryDetail": [
              {
                "code": "ControlPubTraded",
                "status": false
              },
              {
                "code": "EmployeePubTrade",
                "status": false
              },
              {
                "code": "AFFILIATION",
                "status": false
              }
            ],
            "translated": false
          }
        ]
      },
      "externalId": "testexternalId1234",
      "type": "INDIVIDUAL",
      "prefix": "tess",
      "email": "test@gmail.com.com",
      "mdStatusNonPro": false
    },
    "accounts": [
      {
        "investmentObjectives": [
          "Growth",
          "Trading",
          "Hedging"
        ],
        "tradingPermissions": [
          {
            "country": "UNITED STATES",
            "product": "OPTIONS"
          },
          {
            "country": "UNITED STATES",
            "product": "STOCKS"
          },
          {
            "country": "UNITED STATES",
            "product": "MUTUAL FUNDS"
          },
          {
            "country": "UNITED STATES",
            "product": "BONDS"
          }
        ],
        "advisorWrapFees": {
          "strategy": "NO_FEE",
          "chargeAdvisor": false,
          "chargeOtherFeesToAdvisor": false
        },
        "externalId": "testexternalId1234",
        "baseCurrency": "USD",
        "multiCurrency": true,
        "margin": "RegT",
        "stockYieldProgram": true,
        "drip": false
      }
    ],
    "users": [
      {
        "externalUserId": "testexternalId1234USR",
        "externalIndividualId": "testexternalId1234AH",
        "prefix": "tess"
      }
    ],
    "documents": [
      {
        "signedBy": [
          "John F Does"
        ],
        "attachedFile": {
          "fileName": "Form5002.pdf",
          "fileLength": 119331,
          "sha1Checksum": "06c13ef0c01e831c1b9f0c2c0550812a4c242b3a"
        },
        "formNumber": 5002,
       
        "execLoginTimestamp": 20240307114436,
        "execTimestamp": 20240307114436,
    "payload": {
          "mimeType": "application/pdf",
          "data": pm.collectionVariables.get('form5002')
        }
      },
      {
        "signedBy": [
          "John F Does"
        ],
        "attachedFile": {
          "fileName": "Form1005.pdf",
          "fileLength": 170163,
          "sha1Checksum": "76bd4f17da8c8ed0d9ff752b5ffc0a1e38c16bd1"
        },
        "formNumber": 1005,
       
        "execLoginTimestamp": 20240307114436,
        "execTimestamp": 20240307114436
      },
      {
        "signedBy": [
          "John F Does"
        ],
        "attachedFile": {
          "fileName": "Form2109.pdf",
          "fileLength": 15697,
          "sha1Checksum": "bf01d3c5b2b7bc6ca90a4051636051a828fd735f"
        },
        "formNumber": 2109,
       
        "execLoginTimestamp": 20240307114436,
        "execTimestamp": 20240307114436
      },
      {
        "signedBy": [
          "John F Does"
        ],
        "attachedFile": {
          "fileName": "Form2192.pdf",
          "fileLength": 280855,
          "sha1Checksum": "53b136320042b76d0e589252c637dbd6ec88eef2"
        },
        "formNumber": 2192,
       
        "execLoginTimestamp": 20240307114436,
        "execTimestamp": 20240307114436
      },
      {
        "signedBy": [
          "John F Does"
        ],
        "attachedFile": {
          "fileName": "Form3024.pdf",
          "fileLength": 407487,
          "sha1Checksum": "e6a7f178e9aae1fdebe469365f24c49fa6ae04cd"
        },
        "formNumber": 3024,
       
        "execLoginTimestamp": 20240307114436,
        "execTimestamp": 20240307114436
      },
      {
        "signedBy": [
          "John F Does"
        ],
        "attachedFile": {
          "fileName": "Form3044.pdf",
          "fileLength": 564118,
          "sha1Checksum": "ccb239208b4d467ceaf79149274330497af4fb77"
        },
        "formNumber": 3044,
       
        "execLoginTimestamp": 20240307114436,
        "execTimestamp": 20240307114436
      },
      {
        "signedBy": [
          "John F Does"
        ],
        "attachedFile": {
          "fileName": "Form3070.pdf",
          "fileLength": 58156,
          "sha1Checksum": "97346bbb84c99e367fc66cfdf15c1e597af6d07c"
        },
        "formNumber": 3070,
       
        "execLoginTimestamp": 20240307114436,
        "execTimestamp": 20240307114436
      },
      {
        "signedBy": [
          "John F Does"
        ],
        "attachedFile": {
          "fileName": "Form3071.pdf",
          "fileLength": 71516,
          "sha1Checksum": "bea92f0a1f38607789ae6a62ff52e452d4c93a55"
        },
        "formNumber": 3071,
       
        "execLoginTimestamp": 20240307114436,
        "execTimestamp": 20240307114436
      },
      {
        "signedBy": [
          "John F Does"
        ],
        "attachedFile": {
          "fileName": "Form3074.pdf",
          "fileLength": 73340,
          "sha1Checksum": "3ec3e989d28f650bd6db3fab01327d90636acc31"
        },
        "formNumber": 3074,
       
        "execLoginTimestamp": 20240307114436,
        "execTimestamp": 20240307114436
      },
      {
        "signedBy": [
          "John F Does"
        ],
        "attachedFile": {
          "fileName": "Form3077.pdf",
          "fileLength": 214857,
          "sha1Checksum": "45bcf44bb66f4ef2d33d6bce1a567fd324998de6"
        },
        "formNumber": 3077,
       
        "execLoginTimestamp": 20240307114436,
        "execTimestamp": 20240307114436
      },
      {
        "signedBy": [
          "John F Does"
        ],
        "attachedFile": {
          "fileName": "Form3094.pdf",
          "fileLength": 216002,
          "sha1Checksum": "7aedd4e80e10ccaf6224bbe77e42f59d82aa1d3f"
        },
        "formNumber": 3094,
       
        "execLoginTimestamp": 20240307114436,
        "execTimestamp": 20240307114436
      },
      {
        "signedBy": [
          "John F Does"
        ],
        "attachedFile": {
          "fileName": "Form3230.pdf",
          "fileLength": 32483,
          "sha1Checksum": "294716d58d530fcc8da37074341b35f1850e12fa"
        },
        "formNumber": 3230,
       
        "execLoginTimestamp": 20240307114436,
        "execTimestamp": 20240307114436
      },
      {
        "signedBy": [
          "John F Does"
        ],
        "attachedFile": {
          "fileName": "Form4009.pdf",
          "fileLength": 60572,
          "sha1Checksum": "e5cc3f40464a25125b5095e6e66d0b3ffb65cdf5"
        },
        "formNumber": 4009,
       
        "execLoginTimestamp": 20240307114436,
        "execTimestamp": 20240307114436
      },
      {
        "signedBy": [
          "John F Does"
        ],
        "attachedFile": {
          "fileName": "Form4016.pdf",
          "fileLength": 39738,
          "sha1Checksum": "352edc6e973041c07b979819aec723d79b5fb6d1"
        },
        "formNumber": 4016,
       
        "execLoginTimestamp": 20240307114436,
        "execTimestamp": 20240307114436
      },
      {
        "signedBy": [
          "John F Does"
        ],
        "attachedFile": {
          "fileName": "Form4035.pdf",
          "fileLength": 160290,
          "sha1Checksum": "159b6fe0857275100f126a4df441e260ea6bb7f6"
        },
        "formNumber": 4035,
       
        "execLoginTimestamp": 20240307114436,
        "execTimestamp": 20240307114436
      },
      {
        "signedBy": [
          "John F Does"
        ],
        "attachedFile": {
          "fileName": "Form4036.pdf",
          "fileLength": 221862,
          "sha1Checksum": "6dee3536015318203ba52b63c49519c96874354d"
        },
        "formNumber": 4036,
       
        "execLoginTimestamp": 20240307114436,
        "execTimestamp": 20240307114436
      },
      {
        "signedBy": [
          "John F Does"
        ],
        "attachedFile": {
          "fileName": "Form6112.pdf",
          "fileLength": 61662,
          "sha1Checksum": "169ce3381a61df47eb5e56a9d5a704714ee62e29"
        },
        "formNumber": 6112,
       
        "execLoginTimestamp": 20240307114436,
        "execTimestamp": 20240307114436
      },
      {
        "signedBy": [
          "John F Does"
        ],
        "attachedFile": {
          "fileName": "Form6108.pdf",
          "fileLength": 72598,
          "sha1Checksum": "4bc30e9ff855dea9a957099507410a46f0eb6259"
        },
        "formNumber": 6108,
       
        "execLoginTimestamp": 20240307114436,
        "execTimestamp": 20240307114436
      },
      {
        "signedBy": [
          "John F Does"
        ],
        "attachedFile": {
          "fileName": "Form9130.pdf",
          "fileLength": 163891,
          "sha1Checksum": "6636769fe45ab48908880cf29293bfb77b488767"
        },
        "formNumber": 9130,
       
        "execLoginTimestamp": 20240307114436,
        "execTimestamp": 20240307114436
      },
      {
        "signedBy": [
          "John F Does"
        ],
        "attachedFile": {
          "fileName": "Form9490.pdf",
          "fileLength": 35089,
          "sha1Checksum": "2510e965d006011d1212f01fdf6fd7441013cd44"
        },
        "formNumber": 9490,
       
        "execLoginTimestamp": 20240307114436,
        "execTimestamp": 20240307114436
      },
      {
        "signedBy": [
          "John F Does"
        ],
        "attachedFile": {
          "fileName": "Form3076.pdf",
          "fileLength": 159700,
          "sha1Checksum": "3dd9aeb41d4166f6869d60a82af62b9e6b6338ff"
        },
        "formNumber": 3076,
       
        "execLoginTimestamp": 20240307114436,
        "execTimestamp": 20240307114436
      },
      {
        "signedBy": [
          "John F Does"
        ],
        "attachedFile": {
          "fileName": "Form4003.pdf",
          "fileLength": 93003,
          "sha1Checksum": "34787dd4cfbe2ba879776e6d4b4ed64c385acd91"
        },
        "formNumber": 4003,
       
        "execLoginTimestamp": 20240307114436,
        "execTimestamp": 20240307114436
      },
      {
        "signedBy": [
          "John F Does"
        ],
        "attachedFile": {
          "fileName": "Form5013.pdf",
          "fileLength": 221029,
          "sha1Checksum": "4d695bbfc4c57fc7f4f639aa941e5aca1d32aa78"
        },
        "formNumber": 5013,
       
        "execLoginTimestamp": 20240307114436,
        "execTimestamp": 20240307114436
      },
      {
        "signedBy": [
          "John F Does"
        ],
        "attachedFile": {
          "fileName": "Form4059.pdf",
          "fileLength": 89346,
          "sha1Checksum": "c049df38c0eeee83f9a8c0f1126dcadf67cb25d8"
        },
        "formNumber": 4059,
       
        "execLoginTimestamp": 20240307114436,
        "execTimestamp": 20240307114436
      },
      {
        "signedBy": [
          "John F Does"
        ],
        "attachedFile": {
          "fileName": "Form4060.pdf",
          "fileLength": 111000,
          "sha1Checksum": "0f4a3cffc129fe370e803498c384a12a795bceaf"
        },
        "formNumber": 4060,
       
        "execLoginTimestamp": 20240307114436,
        "execTimestamp": 20240307114436
      },
      {
        "signedBy": [
          "John F Does"
        ],
        "attachedFile": {
          "fileName": "Form6109.pdf",
          "fileLength": 56646,
          "sha1Checksum": "3bf0373691372865236830ff2e9dffe7600cf5e0"
        },
        "formNumber": 6109,
       
        "execLoginTimestamp": 20240307114436,
        "execTimestamp": 20240307114436
      },
      {
        "signedBy": [
          "John F Does"
        ],
        "attachedFile": {
          "fileName": "Form3089.pdf",
          "fileLength": 96294,
          "sha1Checksum": "4277e88904d8787339f000eb51566bad50c33076"
        },
        "formNumber": 3089,
       
        "execLoginTimestamp": 20240307114436,
        "execTimestamp": 20240307114436
      },
      {
        "signedBy": [
          "John F Does"
        ],
        "attachedFile": {
          "fileName": "Form3203.pdf",
          "fileLength": 241316,
          "sha1Checksum": "7793a2d7b990a5a3f6fd2b53f3ee7c1fc0bb359e"
        },
        "formNumber": 3203,
       
        "execLoginTimestamp": 20240307114436,
        "execTimestamp": 20240307114436
      },
      {
        "signedBy": [
          "John F Does"
        ],
        "attachedFile": {
          "fileName": "Form4024.pdf",
          "fileLength": 413238,
          "sha1Checksum": "0e615e51d2fa872b32373e944d24efc346421870"
        },
        "formNumber": 4024,
       
        "execLoginTimestamp": 20240307114436,
        "execTimestamp": 20240307114436
      },
      {
        "signedBy": [
          "John F Does"
        ],
        "attachedFile": {
          "fileName": "Form3081.pdf",
          "fileLength": 162236,
          "sha1Checksum": "5c9acb8e87c208df1995f0010781427ebb4f86ad"
        },
        "formNumber": 3081,
       
        "execLoginTimestamp": 20240307114436,
        "execTimestamp": 20240307114436
      },
      {
        "signedBy": [
          "John F Does"
        ],
        "attachedFile": {
          "fileName": "Form4010.pdf",
          "fileLength": 169702,
          "sha1Checksum": "62cc5de4255b429e54670ccc51672a2ea13a5abd"
        },
        "formNumber": 4010,
       
        "execLoginTimestamp": 20240307114436,
        "execTimestamp": 20240307114436
      },
      {
        "signedBy": [
          "John F Does"
        ],
        "attachedFile": {
          "fileName": "Form4215.pdf",
          "fileLength": 154627,
          "sha1Checksum": "82479c2070dbfaf17fe779c66bc5bf860c71a72e"
        },
        "formNumber": 4215,
       
        "execLoginTimestamp": 20240307114436,
        "execTimestamp": 20240307114436
      },
      {
        "signedBy": [
          "John F Does"
        ],
        "attachedFile": {
          "fileName": "Form4216.pdf",
          "fileLength": 95119,
          "sha1Checksum": "4f38a83cf86f394fbf8cde70d86a4fd687427309"
        },
        "formNumber": 4216,
       
        "execLoginTimestamp": 20240307114436,
        "execTimestamp": 20240307114436
      },
      {
        "signedBy": [
          "John F Does"
        ],
        "attachedFile": {
          "fileName": "Form4217.pdf",
          "fileLength": 93742,
          "sha1Checksum": "ecc23717af234613df14bce91703ed99ffe5b3b7"
        },
        "formNumber": 4217,
       
        "execLoginTimestamp": 20240307114436,
        "execTimestamp": 20240307114436
      },
      {
        "signedBy": [
          "John F Does"
        ],
        "attachedFile": {
          "fileName": "Form4212.pdf",
          "fileLength": 509033,
          "sha1Checksum": "9b7d10ed4023b31139163e1cbcfa4a1b5b54df03"
        },
        "formNumber": 4212,
       
        "execLoginTimestamp": 20240307114436,
        "execTimestamp": 20240307114436
      },
      {
        "signedBy": [
          "John F Does"
        ],
        "attachedFile": {
          "fileName": "Form4304.pdf",
          "fileLength": 391481,
          "sha1Checksum": "70a2a2806fa76aae2881da353966ace24bb8ffb2"
        },
        "formNumber": 4304,
       
        "execLoginTimestamp": 20240307114436,
        "execTimestamp": 20240307114436
      },
      {
        "signedBy": [
          "John F Does"
        ],
        "attachedFile": {
          "fileName": "Form4404.pdf",
          "fileLength": 20547,
          "sha1Checksum": "1ce663d10512d4a85d25fad12734c36e496c5f1d"
        },
        "formNumber": 4404,
       
        "execLoginTimestamp": 20240307114436,
        "execTimestamp": 20240307114436
      },
      {
        "signedBy": [
          "John F Does"
        ],
        "attachedFile": {
          "fileName": "Form4402.pdf",
          "fileLength": 32359,
          "sha1Checksum": "24509dd479c1b551e544d1cd24de7b15c139286e"
        },
        "formNumber": 4402,
       
        "execLoginTimestamp": 20240307114436,
        "execTimestamp": 20240307114436
      },
      {
        "signedBy": [
          "John F Does"
        ],
        "attachedFile": {
          "fileName": "Form3354.pdf",
          "fileLength": 415582,
          "sha1Checksum": "b6d27e47b233d053115904d497577b9999d12afc"
        },
        "formNumber": 3354,
       
        "execLoginTimestamp": 20240307114436,
        "execTimestamp": 20240307114436
      },
      {
        "signedBy": [
          "John F Does"
        ],
        "attachedFile": {
          "fileName": "Form4399.pdf",
          "fileLength": 65693,
          "sha1Checksum": "4dadfe7ac41ae2463a4d2c3164e559ee8ba1cf65"
        },
        "formNumber": 4399,
       
        "execLoginTimestamp": 20240307114436,
        "execTimestamp": 20240307114436
      },
      {
        "signedBy": [
          "John F Does"
        ],
        "attachedFile": {
          "fileName": "Form4587.pdf",
          "fileLength": 307426,
          "sha1Checksum": "17d109a79a3024243c6cf578d988d43cff31a51b"
        },
        "formNumber": 4587,
       
        "execLoginTimestamp": 20240307114436,
        "execTimestamp": 20240307114436
      }
    ],
    "translation": false
  }
}
```

###### Individual | USA | Hybrid- Minimal Info

``` wp-block-code
{
  "application": {
    "customer": {
      "accountHolder": {
        "accountHolderDetails": [
          {
            "name": {
              "first": "John",
              "last": "Smith",
            },
            "residenceAddress": {
              "country": "United States"
            },
            "phones": [
            ],
            "email": "tester@gmail.com",
    
            "externalId": "TestIndividual1234AH",
            "titles": [
              {
                "code": "Account Holder"
              }
            ],
          }
        ],
       
      },
      "externalId": "TestIndividual1234",
      "type": "INDIVIDUAL",
      "prefix": "ibkrte",
      "email": "tester@gmail.com",
      "mdStatusNonPro": false
    },
    "accounts": [
      {
        "tradingPermissions": [
          {
            "exchangeGroup": "US-Sec"
          }
        ],
"advisorWrapFees": { 
"strategy": "NO_FEE",         
},    
        "externalId": "TestIndividual1234",
        "baseCurrency": "USD",
        "multiCurrency": true
      }
    ],
    "users": [
      {
        "externalUserId": "TestIndividual1234USR",
        "externalIndividualId": "TestIndividual1234AH",
        "prefix": "ibkrte"
      }
    ],
  }
}
```

###### Individual | USA | Hybrid- All Info

``` wp-block-code
{
  "application": {
    "customer": {
      "accountHolder": {
        "accountHolderDetails": [
          {
            "name": {
              "salutation": "Mr.",
              "first": "John",
              "last": "Smith",
              "middle": "F"
            },
            "dateOfBirth": "1948-07-25",
            "countryOfBirth": "USA",
            "maritalStatus": "D",
            "numDependents": 0,
            "residenceAddress": {
              "street1": "1 Tester Streer",
              "city": "Tester City",
              "state": "AZ",
              "country": "United States",
              "postalCode": "85755"
            },
            "phones": [
              {
                "type": "Mobile",
                "number": "2034228988",
                "country": "United States",
                "verified": false
              }
            ],
            "email": "tester@gmail.com",
            "identification": {
              "citizenship": "United States",
              "ssn": "132112233",
              "issuingCountry": "USA",
              "expire": false
            },
            "employmentType": "RETIRED",
            "taxResidencies": [
              {
                "country": "United States",
                "tin": "132112233",
                "tinType": "SSN"
              }
            ],
            "w9": {
              "name": "John F Smith",
              "customerType": "Individual",
              "tin": "132112233",
              "tinType": "SSN",
              "cert1": true,
              "cert2": true,
              "cert3": true,
              "cert4": true
            },
            "externalId": "TestIndividual1234AH",
            "sameMailAddress": true,
            "ownershipPercentage": 100,
            "titles": [
              {
                "code": "Account Holder"
              }
            ],
            "authorizedPerson": false
          }
        ],
        "financialInformation": [
          {
            "investmentExperience": [
              {
                "assetClass": "BOND",
                "yearsTrading": 0,
                "tradesPerYear": 0,
                "knowledgeLevel": "Limited"
              },
              {
                "assetClass": "FUND",
                "yearsTrading": 4,
                "tradesPerYear": 5,
                "knowledgeLevel": "Good"
              },
              {
                "assetClass": "OPT",
                "yearsTrading": 0,
                "tradesPerYear": 0,
                "knowledgeLevel": "None"
              },
              {
                "assetClass": "STK",
                "yearsTrading": 7,
                "tradesPerYear": 5,
                "knowledgeLevel": "Good"
              }
            ],
            "sourcesOfWealth": [
              {
                "sourceType": "SOW-IND-Pension",
                "percentage": 100,
                "usedForFunds": true,
                "description": "None"
              }
            ],
            "soiQuestionnaire": {
              "details": "Pension"
            },
            "netWorth": 750000,
            "liquidNetWorth": 375000,
            "annualNetIncome": 75000,
            "translated": false
          }
        ],
        "regulatoryInformation": [
          {
            "regulatoryDetail": [
              {
                "code": "ControlPubTraded",
                "status": false
              },
              {
                "code": "EmployeePubTrade",
                "status": false
              },
              {
                "code": "AFFILIATION",
                "status": false
              }
            ],
            "translated": false
          }
        ]
      },
      "externalId": "TestIndividual1234",
      "type": "INDIVIDUAL",
      "prefix": "ibkrte",
      "email": "tester@gmail.com",
      "mdStatusNonPro": false
    },
    "accounts": [
      {
        "investmentObjectives": [
          "Growth",
          "Trading",
          "Hedging"
        ],
        "tradingPermissions": [
          {
            "exchangeGroup": "US-Sec"
          },
          {
            "exchangeGroup": "US-BOND"
          },
          {
            "exchangeGroup": "US-MUNIES"
          },
          {
            "exchangeGroup": "US-Funds"
          },
          {
            "exchangeGroup": "US-Penny"
          },
          {
            "exchangeGroup": "US-SecOpt"
          }
        ],
"advisorWrapFees": { 
"strategy": "NO_FEE",         
},    
        "externalId": "TestIndividual1234",
        "baseCurrency": "USD",
        "multiCurrency": true,
        "margin": "RegT",
        "ira": false,
        "stockYieldProgram": true,
        "drip": false,
        "limitedOptions": false
      }
    ],
    "users": [
      {
        "externalUserId": "TestIndividual1234USR",
        "externalIndividualId": "TestIndividual1234AH",
        "prefix": "ibkrte"
      }
    ],

    "translation": false  }
}
```

###### Individual | AUS | Hybrid- All Info

``` wp-block-code
{
  "application": {
    "customer": {
      "accountHolder": {
        "accountHolderDetails": [
          {
            "name": {
              "salutation": "Mr.",
              "first": "Jane",
              "last": "Tester",
              "middle": "F"
            },
            "dateOfBirth": "1948-07-25",
            "countryOfBirth": "AUS",
            "maritalStatus": "D",
            "numDependents": 0,
            "residenceAddress": {
              "street1": "1 tester Street",
              "city": "ORO VALLEY",
              "state": "AU-QLD",
              "country": "AUS",
              "postalCode": "85755"
            },
            "phones": [
              {
                "type": "Mobile",
                "number": "+61292662000",
                "country": "AUS",
              }
            ],
            "email": "tester@gmail.com",
            "identification": {
            "citizenship": "AUS", 
            "driversLicense": "989444798", 
            "issuingCountry": "AUS", 
            "expire": true, 
            "expirationDate": 
            "2029-03-22", 
            "rta":"9999999", 
            "issuingState":"AU-QLD"
            },
            "employmentType": "RETIRED",
            "taxResidencies": [
              {
                "country": "AUS",
                "tin": "132121212",
                "tinType": "NonUS_NationalId"
              }
            ],
            "externalId": "TestIndividual20250922",
            "sameMailAddress": true,
            "ownershipPercentage": 100,
            "titles": [
              {
                "code": "Account Holder"
              }
            ],
          }
        ],
        "financialInformation": [
          {
            "investmentExperience": [
              {
                "assetClass": "STK",
                "yearsTrading": 7,
                "tradesPerYear": 5,
                "knowledgeLevel": "Good"
              }
            ],
            "sourcesOfWealth": [
              {
                "sourceType": "SOW-IND-Pension",
                "percentage": 100,
                "usedForFunds": true,
                "description": "None"
              }
            ],
            "soiQuestionnaire": {
              "details": "Pension"
            },
            "netWorth": 750000,
            "liquidNetWorth": 375000,
            "annualNetIncome": 75000
}
        ],
        "regulatoryInformation": [
          {
            "regulatoryDetail": [
              {
                "code": "CONTROLLER",
                "status": false
              },
              {
                "code": "POLITICALMILITARYDIPLOMATIC",
                "status": false
              },
              {
                "code": "AFFILIATION",
                "status": false
              }
            ],
            "translated": false
          }
        ]
      },
      "externalId": "TestIndividual20250922",
      "type": "INDIVIDUAL",
      "prefix": "lewipg",
      "email": "tester@gmail.com",
      "mdStatusNonPro": false
      },
    "accounts": [
      {
        "investmentObjectives": [
          "Growth",
          "Trading",
          "Hedging"
        ],
        "tradingPermissions": [
          {
            "exchangeGroup": "US-Sec"
          },
        ],
        "externalId": "TestIndividual20250922",
        "baseCurrency": "AUD",
        "multiCurrency": true,
        "accountType":"Trading",
        "margin": "Cash",
        "stockYieldProgram": true,
        "drip": false,
      }
    ],
    "users": [
      {
        "externalUserId": "TestIndividual20250922",
        "externalIndividualId": "TestIndividual20250922",
        "prefix": "lewipg"
      }
    ],
    "documents": [],
    "translation": false,
    "paperAccount": false
  }
}
```

### Joint

###### Joint | USA | Full Integration

``` wp-block-code
```

###### Joint | USA | Hybrid- All Info

``` wp-block-code
```

###### Joint | Non-US | Full Integration

``` wp-block-code
```

###### Joint | Non-US | Hybrid- All Info

``` wp-block-code
```

### Trust Accounts

###### Trust | Non-US | Hybrid- Maximum Info

``` wp-block-code
{
  "application": {
    "customer": {
      "trust": {
        "identification": [
          {
            "address": {
              "street1": "2 Pickwick Plaza",
              "city": "Greenwich",
              "state": "SA-08",
              "country": "SAU",
              "postalCode": "53072"
            },
            "name": "Test Truster",
            "typeOfTrust": "REVOCABLE",
            "dateFormed": "2020-08-19",
            "formationCountry": "SAU",
            "formationState": "SA-08",
            "registrationNumber": "111555",
            "registrationType": "EIN",
            "registrationCountry": "SAU",
            "sameMailAddress": true,
            "translated": false
          }
        ],
        "financialInformation": [
          {
            "investmentExperience": [
              {
                "assetClass": "STK",
                "yearsTrading": 8,
                "tradesPerYear": 100,
                "knowledgeLevel": "Extensive"
              }
            ],
            "sourcesOfWealth": [
              {
                "sourceType": "SOW-ORG-RetainedEarnings",
                "percentage": 50,
                "usedForFunds": true
              },
              {
                "sourceType": "SOW-ORG-Other",
                "percentage": 50,
                "usedForFunds": true,
                "description": "Income"
              }
            ],
            "netWorth": 9,
            "liquidNetWorth": 7,
            "annualNetIncome": 7,
            "translated": false
          }
        ],
        "trustees": {
          "individuals": [
            {
              "name": {
                "first": "Jane",
                "last": "Doe"
              },
              "dateOfBirth": "1985-03-09",
              "residenceAddress": {
                "street1": "2 Pickwick Plaza",
                "city": "Greenwich",
                "state": "SA-08",
                "country": "SAU",
                "postalCode": "53072"
              },
              "email": "dam@ibkr.com",
              "identification": {
                "citizenship": "SAU",
                "nationalCard": "11122334",
                "issuingCountry": "SAU",
                "expire": false
              },
              "employmentType": "EMPLOYED",
              "employmentDetails": {
                "employer": "Interactive Brokers",
                "occupation": "Engineer",
                "employerBusiness": "Business_NonFinance",
                "employerAddress": {
                  "country": "SAU"
                }
              },
              "externalId": "TestTrust2022TASP1",
              "sameMailAddress": true,
              "authorizedToSignOnBehalfOfOwner": true,
              "authorizedTrader": true,
              "primaryTrustee": true
            }
          ]
        },
        "beneficiaries": {
          "individual": [
            {
              "name": {
                "first": "Jane",
                "last": "Doe"
              },
              "externalId": "TestTrust2022TASP3",
              "sameMailAddress": true
            },
            {
              "name": {
                "first": "John",
                "last": "Doe"
              },
              "externalId": "TestTrust2022TASP4",
              "sameMailAddress": true
            }
          ]
        },
        "grantors": {
          "individual": [
            {
              "name": {
                "first": "Jane",
                "last": "Doe"
              },
              "dateOfBirth": "1985-03-09",
              "residenceAddress": {
                "street1": "2 Pickwick Plaza",
                "city": "Greenwich",
                "state": "SA-08",
                "country": "SAU",
                "postalCode": "53072"
              },
              "email": "dam@ibkr.com",
              "identification": {
                "citizenship": "SAU",
                "nationalCard": "11122334",
                "issuingCountry": "SAU",
                "expire": false
              },
              "employeeTitle": "Dermatologist",
              "externalId": "TestTrust2022TASP5",
              "sameMailAddress": true,
              "authorizedToSignOnBehalfOfOwner": false,
              "authorizedTrader": false,
              "ownershipPercentage": 50,
              "titles": [
                {
                  "value": "Grantor"
                }
              ],
              "authorizedPerson": false
            }
          ]
        },
        "thirdPartyManagement": false
      },
      "externalId": "TestTrust2022",
      "type": "TRUST",
      "prefix": "testr",
      "email": "dam@ibkr.com",
      "mdStatusNonPro": true
    },
    "accounts": [
      {
        "investmentObjectives": [
          "Trading",
          "Growth"
        ],
        "tradingPermissions": [
          {
            "exchangeGroup": "US-Sec"
          }
        ],
        "advisorWrapFees": {
          "strategy": "NO_FEE",
          "chargeAdvisor": false,
          "chargeOtherFeesToAdvisor": false
        },
        "externalId": "TestTrust2022AC",
        "baseCurrency": "USD",
        "multiCurrency": true,
        "margin": "REGT",
        "stockYieldProgram": true,
        "alias": "Test Trust",
        "drip": false
      }
    ],
    "users": [
      {
        "externalUserId": "TestTrust2022USR",
        "externalIndividualId": "TestTrust2022TASP1",
        "prefix": "testr"
      }
    ],
    "translation": false
  }
}
```

###### Trust | Non-US | Hybrid- Minimal Info

``` wp-block-code
{
  "application": {
    "customer": {
      "trust": {
        "identification": [
          {
            "address": {
              "street1": "2 Pickwick Plaza",
              "city": "Greenwich",
              "state": "SA-08",
              "country": "SAU",
              "postalCode": "53072"
            },
            "name": "Test Truster",
            "typeOfTrust": "REVOCABLE",
            "dateFormed": "2020-08-19",
            "formationCountry": "SAU",
            "formationState": "SA-08",
            "sameMailAddress": true
          }
        ],
        "financialInformation": [
          {
            "translated": false
          }
        ],
        "trustees": {
          "individuals": [
            {
              "name": {
                "first": "Jane",
                "last": "Doe"
              },
              "email": "dam@ibkr.com",
              "identification": {
                "citizenship": "SAU",
                "issuingCountry": "SAU",
                "expire": false
              },
              "externalId": "TestTrust2022TASP1",
              "sameMailAddress": true,
              "authorizedToSignOnBehalfOfOwner": true,
              "authorizedTrader": true,
              "usTaxResident": true,
              "primaryTrustee": true
            }
          ]
        },
        "thirdPartyManagement": false
      },
      "externalId": "TestTrust2022",
      "type": "TRUST",
      "prefix": "testr",
      "email": "dam@ibkr.com",
      "mdStatusNonPro": true
    },
    "accounts": [
      {
        "tradingPermissions": [
          {
            "exchangeGroup": "US-Sec"
          }
        ],
        "advisorWrapFees": {
          "strategy": "NO_FEE",
          "chargeAdvisor": false,
          "chargeOtherFeesToAdvisor": false
        },
        "externalId": "TestTrust2022AC",
        "baseCurrency": "USD",
        "multiCurrency": true,
        "margin": "REGT",
        "ira": false,
        "alias": "Test Trust",
        "drip": false
      }
    ],
    "users": [
      {
        "externalUserId": "TestTrust2022USR",
        "externalIndividualId": "TestTrust2022TASP1",
        "prefix": "testr"
      }
    ],
    "translation": false
  }
}
```

### US Retirement Accounts

###### Traditional IRA | USA | Full Integration

``` wp-block-code
```

###### Roth IRA | USA | Hybrid- All Info

``` wp-block-code
```

### Canadian Retirement Accounts

###### SRRSP | CAN | Full Integration

``` wp-block-code
```

###### SRRSP | CAN | Hybrid- All Info

``` wp-block-code
```

###### RRSP | CAN | Full Integration

``` wp-block-code
```

###### RRSP | CAN | Hybrid- All Info

``` wp-block-code
```

###### TSFA | CAN | Full Integration

``` wp-block-code
```

###### TSFA | CAN | Hybrid- All Info

``` wp-block-code
```

### United Kingdom Savings Plan

###### ISA | GBR | Full Integration

``` wp-block-code
{
  "application": {
    "customer": {
      "accountHolder": {
        "accountHolderDetails": [
          {
            "name": {
              "first": "Jane",
              "last": "Doe"
            },
            "dateOfBirth": "1995-04-28",
            "countryOfBirth": "GBR",
            "maritalStatus": "S",
            "numDependents": 0,
            "residenceAddress": {
              "street1": "1 Tester Lane",
              "city": "London",
              "state": "GB-ENG",
              "country": "GBR",
              "postalCode": "SW9 9NY"
            },
            "phones": [
              {
                "type": "Mobile",
                "number": "+4407584089999",
                "country": "GBR"
              }
            ],
            "email": "janedoe@tester.com",
            "identification": {
              "citizenship": "GBR",
              "nationalCard": "PA123456D",
              "issuingCountry": "GBR",
              "expire": false
            },
            "employmentType": "EMPLOYED",
            "employmentDetails": {
              "employer": "CHIPOTLE",
              "occupation": "EXECUTIVE",
              "employerBusiness": "FOOD AND BEVERAGE",
              "employerAddress": {
                "street1": "1 TESTER Square",
                "city": "London",
                "state": "GB-ENG",
                "country": "GBR",
                "postalCode": "W1G 0PW"
              }
            },
            "taxResidencies": [
              {
                "country": "GBR",
                "tin": "PA123456D",
                "tinType": "NonUS_NationalId"
              }
            ],
            "w8Ben": {
              "name": "Jane Doe",
              "foreignTaxId": "PA141807D",
              "tinOrExplanationRequired": true,
              "part29ACountry": "GBR",
              "cert": true,
              "blankForm": true,
              "taxFormFile": "Form5001.pdf",
              "electronicFormat": true
            },
            "externalId": "testapp1234",
            "sameMailAddress": true,
            "translated": false
          }
        ],
        "financialInformation": [
          {
            "investmentExperience": [
              {
                "assetClass": "STK",
                "yearsTrading": 5,
                "tradesPerYear": 4,
                "knowledgeLevel": "Extensive"
              },
              {
                "assetClass": "OPT",
                "yearsTrading": 5,
                "tradesPerYear": 4,
                "knowledgeLevel": "Extensive"
              }
            ],
            "sourcesOfWealth": [
              {
                "sourceType": "SOW-IND-Income",
                "percentage": 100,
                "usedForFunds": true
              }
            ],
            "netWorth": 500000,
            "liquidNetWorth": 500000,
            "annualNetIncome": 250000,
            "translated": false
          }
        ],
        "regulatoryInformation": [
          {
            "regulatoryDetail": [
              {
                "code": "ControlPubTraded",
                "status": false
              },
              {
                "code": "EmployeePubTrade",
                "status": false
              },
              {
                "code": "AFFILIATION",
                "status": false
              }
            ],
            "translated": false
          }
        ]
      },
      "externalId": "testapp1234",
      "type": "INDIVIDUAL",
      "prefix": "nvest",
      "email": "janedoe@tester.com",
      "mdStatusNonPro": true
    },
    "accounts": [
      {
        "investmentObjectives": [
          "Speculation"
        ],
        "tradingPermissions": [
          {
            "country": "ALL",
            "product": "STOCKS"
          }
        ],
        "advisorWrapFees": {
          "strategy": "NO_FEE"
        },
        "externalId": "testapp1234",
        "baseCurrency": "GBP",
        "multiCurrency": false,
        "margin": "Cash",
        "ira": true,
        "iraType": "ISA"
      }
    ],
    "users": [
      {
        "externalUserId": "testapp1234",
        "externalIndividualId": "testapp1234",
        "prefix": "nvest"
      }
    ],
    "documents": [
      {
        "signedBy": [
          "Jane Doe"
        ],
        "attachedFile": {
          "fileName": "Form5001.pdf",
          "fileLength": 67700,
          "sha1Checksum": "D8AA699678D12DE6AC468A864D4FAE7999AA904B"
        },
        "formNumber": 5001,
        "validAddress": false,
        "execLoginTimestamp": 1731406668576,
        "execTimestamp": 1731406668576
      },
      {
        "signedBy": [
          "Jane Doe"
        ],
        "attachedFile": {
          "fileName": "Form2109.pdf",
          "fileLength": 15697,
          "sha1Checksum": "BF01D3C5B2B7BC6CA90A4051636051A828FD735F"
        },
        "formNumber": 2109,
        "validAddress": false,
        "execLoginTimestamp": 20240117041717,
        "execTimestamp": 20240117041717
      },
      {
        "signedBy": [
          "Jane Doe"
        ],
        "attachedFile": {
          "fileName": "Form3024.pdf",
          "fileLength": 67600,
          "sha1Checksum": "274FA053D7E4080F0AD429787B9F94ABDF5498D7"
        },
        "formNumber": 3024,
        "validAddress": false,
        "execLoginTimestamp": 20150716015642,
        "execTimestamp": 20150716152843
      },
      {
        "signedBy": [
          "Jane Doe"
        ],
        "attachedFile": {
          "fileName": "Form4319.pdf",
          "fileLength": 472704,
          "sha1Checksum": "485e44e6bc1e969ee1888fbf12bc957d7d41a182"
        },
        "formNumber": 4319,
        "validAddress": false,
        "execLoginTimestamp": 1731406668576,
        "execTimestamp": 1731406668576
      },
      {
        "signedBy": [
          "Jane Doe"
        ],
        "attachedFile": {
          "fileName": "Form4376.pdf",
          "fileLength": 118429,
          "sha1Checksum": "67D8506963789C3A2DA7B68F134D8F3F2515AFBC"
        },
        "formNumber": 4376,
        "validAddress": false,
        "execLoginTimestamp": 1731406668576,
        "execTimestamp": 1731406668576
      },
      {
        "signedBy": [
          "Jane Doe"
        ],
        "attachedFile": {
          "fileName": "Form4547.pdf",
          "fileLength": 409788,
          "sha1Checksum": "C7A601FD4C746EFC8767FCE886B03782A5C89A1C"
        },
        "formNumber": 4547,
        "validAddress": false,
        "execLoginTimestamp": 1731406668576,
        "execTimestamp": 1731406668576
      },
      {
        "signedBy": [
          "Jane Doe"
        ],
        "attachedFile": {
          "fileName": "Form4548.pdf",
          "fileLength": 416100,
          "sha1Checksum": "5FFF4BFEDD2F75A63EF493BB9F6ADEA63EBAF2A6"
        },
        "formNumber": 4548,
        "validAddress": false,
        "execLoginTimestamp": 1731406668576,
        "execTimestamp": 1731406668576
      }
    ],
    "translation": false
  }
}
```

###### JISA | GBR | Full Integration

``` wp-block-code
{
  "application": {
    "customer": {
      "accountHolder": {
        "accountHolderDetails": [
          {
            "name": {
              "first": "Junior",
              "last": "Contact"
            },
            "dateOfBirth": "2022-12-20",
            "countryOfBirth": "GBR",
            "residenceAddress": {
              "street1": "24 TESTER LANE",
              "city": "LONDON",
              "state": "GB-LND",
              "country": "GB",
              "postalCode": "BR2 9FR"
            },
            "identification": {
              "citizenship": "GBR",
              "nationalCard": "NB123456C",
              "issuingCountry": "GBR",
              "expire": false
            },
            "taxResidencies": [
              {
                "country": "GBR",
                "tin": "NB123456C",
                "tinType": "NonUS_NationalId"
              }
            ],
            "w8Ben": {
              "localTaxForms": [
                {
                  "taxAuthority": "CANADA_TA",
                  "qualified": true,
                  "treatyCountry": "GBR"
                },
                {
                  "taxAuthority": "AUSTRALIA_TA",
                  "qualified": true,
                  "treatyCountry": "GBR"
                }
              ],
              "name": "Junior Contact",
              "foreignTaxId": "NB400056C",
              "tinOrExplanationRequired": true,
              "part29ACountry": "GBR",
              "cert": true,
              "signatureType": "Electronic",
              "blankForm": true,
              "taxFormFile": "Form5001.pdf",
              "electronicFormat": true
            },
            "externalId": "tester123",
            "sameMailAddress": false,
            "titles": [
              {
                "code": "Account Holder"
              }
            ],
            "authorizedPerson": false
          }
        ],
        "associatedIndividual": {
          "name": {
            "first": "Registered",
            "last": "Contact"
          },
          "dateOfBirth": "1963-12-20",
          "countryOfBirth": "GBR",
          "residenceAddress": {
            "street1": "24 TESTER LANE",
            "city": "LONDON",
            "state": "GB-LND",
            "country": "GB",
            "postalCode": "BR2 9FR"
          },
          "phones": [
            {
              "type": "Mobile",
              "number": "447483849999",
              "country": "GBR",
              "verified": false
            }
          ],
          "email": "DAM41832012@aol.com",
          "identification": {
            "citizenship": "GBR",
            "nationalCard": "NB400056A",
            "issuingCountry": "GBR",
            "expire": false
          },
          "employmentType": "EMPLOYED",
          "employmentDetails": {
            "employer": "Crown Prosecution Service ",
            "occupation": "Other",
            "description": "CIVIL",
            "employerBusiness": "Community/Social Service",
            "employerAddress": {
              "country": "GBR"
            }
          },
          "externalId": "tester123_rc",
          "sameMailAddress": true,
          "titles": [
            {
              "code": "Registered Contact"
            }
          ],
          "authorizedPerson": false
        },
        "financialInformation": [
          {
            "investmentExperience": [
              {
                "assetClass": "STK",
                "yearsTrading": 11,
                "tradesPerYear": 27,
                "knowledgeLevel": "Extensive"
              }
            ],
            "sourcesOfWealth": [
              {
                "sourceType": "SOW-IND-Income",
                "percentage": 10,
                "usedForFunds": true
              },
              {
                "sourceType": "SOW-IND-Pension",
                "percentage": 90,
                "usedForFunds": true
              }
            ],
            "netWorth": 375000,
            "liquidNetWorth": 70000,
            "annualNetIncome": 41600,
            "translated": false
          }
        ],
        "regulatoryInformation": [
          {
            "regulatoryDetail": [
              {
                "code": "EmployeePubTrade",
                "status": false
              },
              {
                "code": "ControlPubTraded",
                "status": false
              },
              {
                "code": "AFFILIATION",
                "status": false
              }
            ],
            "translated": false
          }
        ]
      },
      "externalId": "tester123",
      "type": "INDIVIDUAL",
      "prefix": "skm",
      "email": "DAM41832012@aol.com",
      "mdStatusNonPro": false
    },
    "accounts": [
      {
        "investmentObjectives": [
          "Growth"
        ],
        "tradingPermissions": [
          {
            "exchangeGroup": "US-SEC"
          },
          {
            "exchangeGroup": "EURONEXT-FUND"
          }
        ],
        "externalId": "tester123",
        "baseCurrency": "GBP",
        "multiCurrency": true,
        "margin": "Cash",
        "ira": true,
        "iraType": "JISA",
        "drip": false
      }
    ],
    "users": [
      {
        "externalUserId": "tester123",
        "externalIndividualId": "tester123",
        "prefix": "skm"
      }
    ],
    "documents": [
      {
        "signedBy": [
          "Registered Contact"
        ],
        "attachedFile": {
          "fileName": "Form5001.pdf",
          "fileLength": 67700,
          "sha1Checksum": "d8aa699678d12de6ac468a864d4fae7999aa904b"
        },
        "formNumber": 5001,
        "validAddress": false,
        "execLoginTimestamp": 20250511201657
      },
      {
        "signedBy": [
          "Registered Contact"
        ],
        "attachedFile": {
          "fileName": "Form3083.pdf",
          "fileLength": 557790,
          "sha1Checksum": "9C79DB3DF0925D126541817F2BBC7418BBD3EC4E"
        },
        "formNumber": 3083,
        "validAddress": false,
        "execLoginTimestamp": 20250511201657
      },
      {
        "signedBy": [
          "Registered Contact"
        ],
        "attachedFile": {
          "fileName": "Form4070.pdf",
          "fileLength": 27117,
          "sha1Checksum": "3BF982D0D81F0F6B1BBD37E9789EE6585F46F8DC"
        },
        "formNumber": 4070,
        "validAddress": false,
        "execLoginTimestamp": 20250511201657
      },
      {
        "signedBy": [
          "Registered Contact"
        ],
        "attachedFile": {
          "fileName": "Form9130.pdf",
          "fileLength": 252630,
          "sha1Checksum": "3F6E0751854D0BB7717AB4E954D97EDF31FEE6EA"
        },
        "formNumber": 9130,
        "validAddress": false,
        "execLoginTimestamp": 20250511201657
      }
    ],
    "translation": false
  }
}
```

###### ISA | GBR | Hybrid- All Info

``` wp-block-code
{
  "application": {
    "customer": {
      "accountHolder": {
        "accountHolderDetails": [
          {
            "name": {
              "first": "Jane",
              "last": "Doe"
            },
            "dateOfBirth": "1995-04-28",
            "countryOfBirth": "GBR",
            "maritalStatus": "S",
            "numDependents": 0,
            "residenceAddress": {
              "street1": "1 Tester Lane",
              "city": "London",
              "state": "GB-ENG",
              "country": "GBR",
              "postalCode": "SW9 9NY"
            },
            "phones": [
              {
                "type": "Mobile",
                "number": "+4407584089999",
                "country": "GBR"
              }
            ],
            "email": "janedoe@tester.com",
            "identification": {
              "citizenship": "GBR",
              "nationalCard": "PA123456D",
              "issuingCountry": "GBR",
              "expire": false
            },
            "employmentType": "EMPLOYED",
            "employmentDetails": {
              "employer": "CHIPOTLE",
              "occupation": "EXECUTIVE",
              "employerBusiness": "FOOD AND BEVERAGE",
              "employerAddress": {
                "street1": "1 TESTER Square",
                "city": "London",
                "state": "GB-ENG",
                "country": "GBR",
                "postalCode": "W1G 0PW"
              }
            },
            "taxResidencies": [
              {
                "country": "GBR",
                "tin": "PA123456D",
                "tinType": "NonUS_NationalId"
              }
            ],
            "w8Ben": {
              "name": "Jane Doe",
              "foreignTaxId": "PA141807D",
              "tinOrExplanationRequired": true,
              "part29ACountry": "GBR",
              "cert": true,
              "blankForm": true,
              "taxFormFile": "Form5001.pdf",
              "electronicFormat": true
            },
            "externalId": "testapp1234",
            "sameMailAddress": true,
            "translated": false
          }
        ],
        "financialInformation": [
          {
            "investmentExperience": [
              {
                "assetClass": "STK",
                "yearsTrading": 5,
                "tradesPerYear": 4,
                "knowledgeLevel": "Extensive"
              },
              {
                "assetClass": "OPT",
                "yearsTrading": 5,
                "tradesPerYear": 4,
                "knowledgeLevel": "Extensive"
              }
            ],
            "sourcesOfWealth": [
              {
                "sourceType": "SOW-IND-Income",
                "percentage": 100,
                "usedForFunds": true
              }
            ],
            "netWorth": 500000,
            "liquidNetWorth": 500000,
            "annualNetIncome": 250000,
            "translated": false
          }
        ],
        "regulatoryInformation": [
          {
            "regulatoryDetail": [
              {
                "code": "ControlPubTraded",
                "status": false
              },
              {
                "code": "EmployeePubTrade",
                "status": false
              },
              {
                "code": "AFFILIATION",
                "status": false
              }
            ],
            "translated": false
          }
        ]
      },
      "externalId": "testapp1234",
      "type": "INDIVIDUAL",
      "prefix": "nvest",
      "email": "janedoe@tester.com",
      "mdStatusNonPro": true
    },
    "accounts": [
      {
        "investmentObjectives": [
          "Speculation"
        ],
        "tradingPermissions": [
          {
            "country": "ALL",
            "product": "STOCKS"
          }
        ],
        "advisorWrapFees": {
          "strategy": "NO_FEE"
        },
        "externalId": "testapp1234",
        "baseCurrency": "GBP",
        "multiCurrency": false,
        "margin": "Cash",
        "ira": true,
        "iraType": "ISA"
      }
    ],
    "users": [
      {
        "externalUserId": "testapp1234",
        "externalIndividualId": "testapp1234",
        "prefix": "nvest"
      }
    ],
    "translation": false
  }
}
```

###### JISA | GBR | Hybrid- All Info

``` wp-block-code
{
  "application": {
    "customer": {
      "accountHolder": {
        "accountHolderDetails": [
          {
            "name": {
              "first": "Junior",
              "last": "Contact"
            },
            "dateOfBirth": "2022-12-20",
            "countryOfBirth": "GBR",
            "residenceAddress": {
              "street1": "24 TESTER LANE",
              "city": "LONDON",
              "state": "GB-LND",
              "country": "GB",
              "postalCode": "BR2 9FR"
            },
            "identification": {
              "citizenship": "GBR",
              "nationalCard": "NB123456C",
              "issuingCountry": "GBR",
              "expire": false
            },
            "taxResidencies": [
              {
                "country": "GBR",
                "tin": "NB123456C",
                "tinType": "NonUS_NationalId"
              }
            ],
            "w8Ben": {
              "localTaxForms": [
                {
                  "taxAuthority": "CANADA_TA",
                  "qualified": true,
                  "treatyCountry": "GBR"
                },
                {
                  "taxAuthority": "AUSTRALIA_TA",
                  "qualified": true,
                  "treatyCountry": "GBR"
                }
              ],
              "name": "Junior Contact",
              "foreignTaxId": "NB400056C",
              "tinOrExplanationRequired": true,
              "part29ACountry": "GBR",
              "cert": true,
              "signatureType": "Electronic",
              "blankForm": true,
              "taxFormFile": "Form5001.pdf",
              "electronicFormat": true
            },
            "externalId": "tester123",
            "sameMailAddress": false,
            "titles": [
              {
                "code": "Account Holder"
              }
            ],
            "authorizedPerson": false
          }
        ],
        "associatedIndividual": {
          "name": {
            "first": "Registered",
            "last": "Contact"
          },
          "dateOfBirth": "1963-12-20",
          "countryOfBirth": "GBR",
          "residenceAddress": {
            "street1": "24 TESTER LANE",
            "city": "LONDON",
            "state": "GB-LND",
            "country": "GB",
            "postalCode": "BR2 9FR"
          },
          "phones": [
            {
              "type": "Mobile",
              "number": "447483849999",
              "country": "GBR",
              "verified": false
            }
          ],
          "email": "DAM41832012@aol.com",
          "identification": {
            "citizenship": "GBR",
            "nationalCard": "NB400056A",
            "issuingCountry": "GBR",
            "expire": false
          },
          "employmentType": "EMPLOYED",
          "employmentDetails": {
            "employer": "Crown Prosecution Service ",
            "occupation": "Other",
            "description": "CIVIL",
            "employerBusiness": "Community/Social Service",
            "employerAddress": {
              "country": "GBR"
            }
          },
          "externalId": "tester123_rc",
          "sameMailAddress": true,
          "titles": [
            {
              "code": "Registered Contact"
            }
          ],
          "authorizedPerson": false
        },
        "financialInformation": [
          {
            "investmentExperience": [
              {
                "assetClass": "STK",
                "yearsTrading": 11,
                "tradesPerYear": 27,
                "knowledgeLevel": "Extensive"
              }
            ],
            "sourcesOfWealth": [
              {
                "sourceType": "SOW-IND-Income",
                "percentage": 10,
                "usedForFunds": true
              },
              {
                "sourceType": "SOW-IND-Pension",
                "percentage": 90,
                "usedForFunds": true
              }
            ],
            "netWorth": 375000,
            "liquidNetWorth": 70000,
            "annualNetIncome": 41600,
            "translated": false
          }
        ],
        "regulatoryInformation": [
          {
            "regulatoryDetail": [
              {
                "code": "EmployeePubTrade",
                "status": false
              },
              {
                "code": "ControlPubTraded",
                "status": false
              },
              {
                "code": "AFFILIATION",
                "status": false
              }
            ],
            "translated": false
          }
        ]
      },
      "externalId": "tester123",
      "type": "INDIVIDUAL",
      "prefix": "skm",
      "email": "DAM41832012@aol.com",
      "mdStatusNonPro": false
    },
    "accounts": [
      {
        "investmentObjectives": [
          "Growth"
        ],
        "tradingPermissions": [
          {
            "exchangeGroup": "US-SEC"
          },
          {
            "exchangeGroup": "EURONEXT-FUND"
          }
        ],
        "externalId": "tester123",
        "baseCurrency": "GBP",
        "multiCurrency": true,
        "margin": "Cash",
        "ira": true,
        "iraType": "JISA",
        "drip": false
      }
    ],
    "users": [
      {
        "externalUserId": "tester123",
        "externalIndividualId": "tester123",
        "prefix": "skm"
      }
    ],
       "translation": false
  }
}
```

##### NonQI

###### Individual | CZE | Full Integration

``` wp-block-code
{
  "application": {
    "customer": {
      "accountHolder": {
        "accountHolderDetails": [
          {
            "name": {
              "first": "Jane",
              "last": "Doe"
            },
            "dateOfBirth": "1990-01-29",
            "countryOfBirth": "CZE",
            "residenceAddress": {
              "street1": "1 Test Street",
              "city": "Praha",
              "state": "CZ-10",
              "country": "CZE",
              "postalCode": "100001"
            },
            "email": Doe.Jane@hotmail.com,
            "identification": {
              "citizenship": "CZE",
              "nationalCard": "910829/5009",
              "issuingCountry": "CZE",
              "expire": false
            },
            "taxResidencies": [
              {
                "country": "CZE"
              }
            ],
            "w8Ben": {
              "name": "Jane Doe",
              "tinOrExplanationRequired": true,
              "explanation": "TIN_NOT_DISCLOSED",
              "part29ACountry": "CZE",
              "cert": true,
              "signatureType": "Electronic",
              "blankForm": false,
              "taxFormFile": "Form5001.pdf",
              "electronicFormat": true,
            },
            "externalId": "CZE_NonQI_Indi_Nov2024",
            "sameMailAddress": true
          }
        ]
      },
      "externalId": "CZE_NonQI_Indi_Nov2024",
      "type": "INDIVIDUAL",
      "prefix": "testr",
      "email": "Doe.Jane@hotmail.com",
      "mdStatusNonPro": false,
      "meetAmlStandard": "true",
      "directTradingAccess": true,
      "paperAccount": false
    },
    "accounts": [
      {
        "tradingPermissions": [
          {
            "country": "UNITED STATES",
            "product": "STOCKS"
          },
          {
            "country": "UNITED KINGDOM",
            "product": "STOCKS"
          },
          {
            "country": "GERMANY",
            "product": "STOCKS"
          }
        ],
        "externalId": "CZE_NonQI_Indi_Nov2024",
        "baseCurrency": "CZK",
        "multiCurrency": true,
        "margin": "Cash",
      }
    ],
    "users": [
      {
        "externalUserId": "CZE_NonQI_Indi_Nov2024",
        "externalIndividualId": "CZE_NonQI_Indi_Nov2024",
        "prefix": "testr"
      }
    ],
    "documents": [
      {
        "signedBy": [
          "Jane Doe"
        ],
        "attachedFile": {
          "fileName": "Form5001.pdf",
          "fileLength": 199261,
          "sha1Checksum": "bd60f461d19b9b052bb67a67f8e8a2eeaeb644f8"
        },
        "formNumber": 5001,
        "validAddress": false,
        "execLoginTimestamp": 20231108103920,
        "execTimestamp": 20231108103941
      },
      {
        "signedBy": [
          "Jane Doe"
        ],
        "attachedFile": {
          "fileName": "ProofOfAddressDocd.pdf",
          "fileLength": 329,
          "sha1Checksum": "118416bebc7373939b74d848cb072119e6c0fd5f"
        },
        "formNumber": 8002,
        "validAddress": false,
        "execLoginTimestamp": 20231108103913,
        "execTimestamp": 20231108104004,
        "proofOfAddressType": "Government Issued Letters"
      }
    ],
    "translation": false,
    "paperAccount": false
  }
}
```

##### OWD

###### Individual | SAU | Full Integration

``` wp-block-code
{
  "application": {
    "customer": {
      "accountHolder": {
        "accountHolderDetails": [
          {
            "name": {
              "first": "John",
              "last": "Doe",
              "middle": "S"
            },
            "dateOfBirth": "2002-10-25",
            "countryOfBirth": "SAU",
            "residenceAddress": {
              "street1": "1 Tester",
              "city": "aleala",
              "state": "SA-03",
              "country": "SAU",
              "postalCode": "93929"
            },
            "email": "tester@gmail.com",
            "identification": {
              "citizenship": "SAU",
              "nationalCard": "11225554",
              "issuingCountry": "SAU",
              "expire": false
            },
            "employmentType": "EMPLOYED",
            "employmentDetails": {
              "employer": "Test Employer Name Here",
              "occupation": "Analyst",
              "employerBusiness": "Computer/Information Technology",
              "employerAddress": {
                "street1": "22 Tester Road",
                "city": "Aleala",
                "state": "SA-03",
                "country": "SAU",
                "postalCode": "93929"
              }
            },
            "taxResidencies": [
              {
                "country": "SAU",
                "tinType": "NonUS_NationalId"
              }
            ],
            "w8Ben": {
              "name": "John S Doe",
              "tinOrExplanationRequired": true,
              "explanation": "TIN_NOT_ISSUED",
              "part29ACountry": "N/A",
              "cert": true,
              "signatureType": "Electronic",
              "blankForm": false,
              "taxFormFile": "5001.pdf",
              "electronicFormat": true
            },
            "externalId": "testExternalId3",
            "sameMailAddress": true,
            "titles": [
              {
                "value": "Account Holder"
              }
            ],
          }
        ],
        "financialInformation": [
          {
            "sourcesOfWealth": [
              {
                "sourceType": "SOW-IND-Income",
                "percentage": 100,
                "usedForFunds": true
              }
            ],
            "netWorth": 103,
            "liquidNetWorth": 101,
            "annualNetIncome": 300000,
            "translated": false
          }
        ],
        "regulatoryInformation": [
          {
            "regulatoryDetail": [
              {
                "code": "ControlPubTraded",
                "status": false
              },
              {
                "code": "EmployeePubTrade",
                "status": false
              }
            ],
            "translated": false
          }
        ]
      },
      "externalId": "testExternalId3",
      "type": "INDIVIDUAL",
      "prefix": "tesss",
      "email": "tester@gmail.com",
      "mdStatusNonPro": true,
      "legalResidenceCountry": "SAU",
      "meetAmlStandard": "true",
      "meetsAmlStandard": "true",
    },
    "accounts": [
      {
        "capabilities": [
          "CLP"
        ],
        "tradingPermissions": [
          {
            "country": "UNITED STATES",
            "product": "OPTIONS"
          },
          {
            "country": "UNITED STATES",
            "product": "STOCKS"
          }
        ],
        "externalId": "testExternalId3",
        "baseCurrency": "USD",
        "multiCurrency": true,
        "margin": "Margin",
        "stockYieldProgram": true,
        "alias": "John S Doe Indvidual",
        "drip": false
      }
    ],
    "users": [
      {
        "externalUserId": "testExternalId3",
        "externalIndividualId": "testExternalId3",
        "prefix": "xneecg"
      }
    ],
    "documents": [
      {
        "signedBy": [
          "John S Doe"
        ],
        "attachedFile": {
          "fileName": "5001.pdf",
          "fileLength": 93167,
          "sha1Checksum": "3D45EBC208CB6782C4512876C4E9ECD205E6F4F0"
        },
        "formNumber": 5001,
        "validAddress": false,
        "execLoginTimestamp": 20240418000000,
        "execTimestamp": 20240418000020,
        "payload": {
          "mimeType": "application/pdf",
           "data": pm.collectionVariables.get('form5001')
        }
      },
      {
        "signedBy": [
          "John S Doe"
        ],
        "attachedFile": {
          "fileName": "Form8001.pdf",
          "fileLength": 93167,
          "sha1Checksum": "3D45EBC208CB6782C4512876C4E9ECD205E6F4F0"
        },
        "formNumber": 8001,
        "validAddress": false,
        "execLoginTimestamp": 20240418000300,
        "execTimestamp": 20240418000315,
        "payload": {
          "mimeType": "application/pdf",
           "data": pm.collectionVariables.get('form8001')
        },
        "proofOfIdentityType": "National ID Card"
      },
      {
        "signedBy": [
          "John S Doe"
        ],
        "attachedFile": {
          "fileName": "Form8002.pdf",
          "fileLength": 93167,
          "sha1Checksum": "3D45EBC208CB6782C4512876C4E9ECD205E6F4F0"
        },
        "formNumber": 8002,
        "validAddress": false,
        "execLoginTimestamp": 20240418000800,
        "execTimestamp": 20240418000840,
         "payload": {
          "mimeType": "application/pdf",
           "data": pm.collectionVariables.get('form8002')
        }   ,
        "proofOfAddressType": "Other Document"

      }
    ],
    "translation": false,
    "paperAccount": false
  }
}
```

###### Individual | SAU | Hybrid

``` wp-block-code
{
  "application": {
    "customer": {
      "accountHolder": {
        "accountHolderDetails": [
          {
            "name": {
              "first": "John",
              "last": "Doe",
              "middle": "S"
            },
            "dateOfBirth": "2002-10-25",
            "countryOfBirth": "SAU",
            "residenceAddress": {
              "street1": "1 Tester",
              "city": "aleala",
              "state": "SA-03",
              "country": "SAU",
              "postalCode": "93929"
            },
            "email": "tester@gmail.com",
            "identification": {
              "citizenship": "SAU",
              "nationalCard": "11225554",
              "issuingCountry": "SAU",
              "expire": false
            },
            "employmentType": "EMPLOYED",
            "employmentDetails": {
              "employer": "Test Employer Name Here",
              "occupation": "Analyst",
              "employerBusiness": "Computer/Information Technology",
              "employerAddress": {
                "street1": "22 Tester Road",
                "city": "Aleala",
                "state": "SA-03",
                "country": "SAU",
                "postalCode": "93929"
              }
            },
            "taxResidencies": [
              {
                "country": "SAU",
                "tinType": "NonUS_NationalId"
              }
            ],
            "w8Ben": {
              "name": "John S Doe",
              "tinOrExplanationRequired": true,
              "explanation": "TIN_NOT_ISSUED",
              "part29ACountry": "N/A",
              "cert": true
            },
            "externalId": "testExternalId123999",
            "sameMailAddress": true,
            "titles": [
              {
                "value": "Account Holder"
              }
            ],
          }
        ],
        "financialInformation": [
          {
            "sourcesOfWealth": [
              {
                "sourceType": "SOW-IND-Income",
                "percentage": 100,
                "usedForFunds": true
              }
            ],
            "netWorth": 103,
            "liquidNetWorth": 101,
            "annualNetIncome": 300000,
            "translated": false
          }
        ],
        "regulatoryInformation": [
          {
            "regulatoryDetail": [
              {
                "code": "ControlPubTraded",
                "status": false
              },
              {
                "code": "EmployeePubTrade",
                "status": false
              }
            ],
            "translated": false
          }
        ]
      },
      "externalId": "testExternalId123999",
      "type": "INDIVIDUAL",
      "prefix": "tesss",
      "email": "tester@gmail.com",
      "mdStatusNonPro": true,
      "legalResidenceCountry": "SAU",
      "meetAmlStandard": "true",
      "meetsAmlStandard": "true",
    },
    "accounts": [
      {
        "capabilities": [
          "CLP"
        ],
        "tradingPermissions": [
          {
            "country": "UNITED STATES",
            "product": "OPTIONS"
          },
          {
            "country": "UNITED STATES",
            "product": "STOCKS"
          }
        ],
        "externalId": "testExternalId123999",
        "baseCurrency": "USD",
        "multiCurrency": true,
        "margin": "Margin",
        "stockYieldProgram": true,
        "alias": "John S Doe Indvidual",
        "drip": false
      }
    ],
    "users": [
      {
        "externalUserId": "testExternalId123999",
        "externalIndividualId": "testExternalId123999",
        "prefix": "xneecg"
      }
    ],
    
    "translation": false,
    "paperAccount": false
  }
}
```

##### QI

###### Individual | GBR | Full Integration QI with Trading

``` wp-block-code
{
  "application": {
    "customer": {
      "accountHolder": {
        "accountHolderDetails": [
          {
            "name": {
              "first": "John",
              "last": "Smith"
            },
            "dateOfBirth": "1973-08-14",
            "countryOfBirth": "GBR",
            "residenceAddress": {
              "street1": "1 Tester Street",
              "city": "London",
              "state": "GB-ENG",
              "country": "GBR",
              "postalCode": "SW10 9QL"
            },
            "phones": [],
            "email": "tester@ibkr.com",
            "identification": {
              "citizenship": "GBR",
              "nationalCard": "AB123456C",
              "issuingCountry": "GBR",
              "expire": false
            },
        "withholdingStatement": {
          "effectiveDate": "2024-11-01",
          "fatcaCompliantType": "FATCA_COMPLIANT",
          "treatyCountry": "GBR"
        }
      },
      "externalId": "MyExternalId1234",
      "type": "INDIVIDUAL",
      "prefix": "damtes",
      "email": "tester@ibkr.com",
      "mdStatusNonPro": true,
      "meetAmlStandard": "true",
      "directTradingAccess": true,
      "legalResidenceCountry": "GBR"
    },
    "accounts": [
      {
        "tradingPermissions": [
          {
            "country": "UNITED KINGDOM",
            "product": "STOCKS"
          },
          {
            "country": "UNITED STATES",
            "product": "OPTIONS"
          }
        ],
        "externalId": "MyExternalId1234",
        "baseCurrency": "GBP",
        "multiCurrency": true,
        "margin": "Cash",
      }
    ],
    "users": [
      {
        "externalUserId": "MyExternalId1234",
        "externalIndividualId": "MyExternalId1234",
        "prefix": "damtes"
      }
    ],
  },
}
```

###### Individual | GBR | Full Integration QI No Trading

``` wp-block-code
{
  "application": {
    "customer": {
      "accountHolder": {
        "accountHolderDetails": [
          {
            "name": {
              "first": "John",
              "last": "Smith"
            },
            "residenceAddress": {
              "country": "GBR"

            },
            "phones": [],
            "email": "tester@ibkr.com",
            "externalId": "MyExternalId12345",
            "sameMailAddress": true
          }
        ],
   
        "withholdingStatement": {
          "effectiveDate": "2024-11-01",
          "fatcaCompliantType": "FATCA_COMPLIANT",
          "treatyCountry": "GBR"
        }
      },
      "externalId": "MyExternalId12345",
      "type": "INDIVIDUAL",
      "prefix": "damtes",
      "email": "tester@ibkr.com",
      "mdStatusNonPro": true,
      "meetAmlStandard": "true",
      "directTradingAccess": false,
      "legalResidenceCountry": "GBR"
    },
    "accounts": [
      {
        "tradingPermissions": [
          {
            "country": "UNITED KINGDOM",
            "product": "STOCKS"
          },
          {
            "country": "UNITED STATES",
            "product": "OPTIONS"
          }
        ],
        "externalId": "MyExternalId12345",
        "baseCurrency": "GBP",
        "multiCurrency": true,
        "margin": "Cash",
      }
    ],
    "users": [
      {
        "externalUserId": "MyExternalId12345",
        "externalIndividualId": "MyExternalId12345",
        "prefix": "damtes"
      }
    ],
  },
}
```

## Sample Responses

## Error Handling

###### Client Registration – Create New Account

\[POST\] OR \[PATCH\] gw/api/v1/accounts

When making requests to our API, you will receive HTTP status codes that indicate the outcome of your request. However, it’s important to understand that a status code of 200 doesn’t always mean your request was successful.

### HTTP Status Codes

1.  **200**: Your request reached the server and was processed
2.  **Non-200 Codes**: Your request did not pass gateway validation (e.g., 400, 401, 404, 500)

### 200 OK

A 200 status code simply means your request successfully reached our application and was processed. However, the actual outcome can be one of two types:

**Success Response (200):** This indicates that your request not only reached the server but also passed all validation checks and was successfully processed.

**Error Response (200 with Error):** This indicates that while your request successfully reached the application (passing gateway validation), it failed some business logic or validation check within the application itself.

  - The status within response will return `ERROR`
  - Error detail will be included within `error.value`

###### Sample Response

``` wp-block-code
{
    "requestId": 464041722,
    "dateSubmitted": "20250805143508 UTC",
    "fileData": {
        "data": {
            "execution": {
                "executedAt": "20250805143509 UTC",
                "client": "Test client for account I19565014",
                "clientMasterAccount": "I1111111",
                "processFile": "II1111111-08-05_103508896_853839.json"
            },
            "application": {
                "customer": "Jane F Tester",
                "externalId": "testUser12345",
                "status": "Error",
                "error": [
                    {
                        "value": "Unable to determine client IB entity. Kindly provide valid Residence country and Legal Residence Country."
                    }
                   
                    }
                ]
            }
        },
        "name": "II1111111-103509392_144127.json.report"
    }
}
```

Understanding this distinction is crucial because:

1.  You cannot rely solely on the HTTP status code to determine if your operation succeeded
2.  Your code should always check the response body’s structure and status field
3.  Gateway errors (non-200) indicate problems with your request format, authentication, or server availability
4.  Application errors (200 with error status) indicate problems with the data or business logic

## Error Library

###### 200 with Error

### **customer**

<table>
<colgroup>
<col style="width: 50%" />
<col style="width: 50%" />
</colgroup>
<thead>
<tr class="header">
<th>Error Message</th>
<th>Explanation</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td>“Unsupported value. Property:’sourceType’, value:’SOW-IND-inheritance”,</td>
<td>Enter first letter for Inheritance as capital. Refer to <a href="https://www.interactivebrokers.com/campus/ibkr-api-page/web-api-account-management/#customer-26">https://www.interactivebrokers.com/campus/ibkr-api-page/web-api-account-management/#customer-26</a></td>
</tr>
<tr class="even">
<td>“SourcesOfWealth must include SOW-IND-Income when EmploymentType is EMPLOYED”</td>
<td>Sources Of Wealth must include Income from employment as the individual is employed.</td>
</tr>
<tr class="odd">
<td>“Total Percentage from SourcesOfWealth used to fund the account is 10%. It MUST add to 100%.”</td>
<td>If Sources of wealth  doesn’t constitute to 100%, this error is thrown</td>
</tr>
<tr class="even">
<td> “Investment Experience is missing.”</td>
<td>If ‘investmentExperience’ is missing in payload, this error is thrown</td>
</tr>
<tr class="odd">
<td>“Financial information is missing.”</td>
<td>If ‘financialInformation’  is missing in payload, this error is thrown</td>
</tr>
<tr class="even">
<td>Source(s) of Wealth is missing.</td>
<td>If sourcesOfWealth are missing, this error is thrown</td>
</tr>
<tr class="odd">
<td>“Regulatory Information is missing.”</td>
<td>If ‘regulatoryInformation’ are missing, this error is thrown</td>
</tr>
<tr class="even">
<td>“Investment Objectives are Mandatory.”</td>
<td>If ‘investment objectives’ are missing, this error is thrown</td>
</tr>
<tr class="odd">
<td> “Unrecognized property:’isUsTaxResident’”,</td>
<td>If ‘usTaxresident’ are missing, this error is thrown</td>
</tr>
<tr class="even">
<td>“Unrecognized property:’hasExpirationDate’”,</td>
<td>If ‘hasExpirationDate’ is missing in POI document</td>
</tr>
<tr class="odd">
<td>“Unsupported value. Property:’customerType’, value:’INDIVIDUAL’”</td>
<td>Enter customer type = ‘Individual’</td>
</tr>
<tr class="even">
<td>“Unsupported value. Property:’knowledgeLevel’, value:’LMT’”</td>
<td>Enter knowledgelevel= ‘Limited’</td>
</tr>
<tr class="odd">
<td>“Unsupported value. Property:’knowledgeLevel’, value:’NO Knowledge</td>
<td>Enter knowledgeLevel= ‘Limited’, ‘Good’ or ‘Extensive’</td>
</tr>
<tr class="even">
<td> “Unsupported value. Property:’assetClass’, value:’opt’”,</td>
<td>Enter assetClass should be in capital ‘OPT’</td>
</tr>
<tr class="odd">
<td> “Issuing country in Identification node for Account Holder is missing.”</td>
<td>Enter Issuing country in Identification node (Issuing country of the ID document)</td>
</tr>
<tr class="even">
<td>“Valid identification is missing for Account Holder. Please provide valid identification such as SSN, SIN, Passport, National Card, Alien Card, or Driver’s License or Tax Id.”</td>
<td>Provide valid ID. Refer to: <a href="https://www.interactivebrokers.com/campus/ibkr-api-page/web-api-account-management/#associatedindividual-25">https://www.interactivebrokers.com/campus/ibkr-api-page/web-api-account-management/#associatedindividual-25</a></td>
</tr>
<tr class="odd">
<td>Invalid value for Total Assets in financialInformation node. Total Assets must be a positive value.</td>
<td>Invalid value provided for <code>totalAssets</code></td>
</tr>
<tr class="even">
<td>Exception for accounts Incorrect Investment Objective specified. occurred.</td>
<td>If <code>investmentObjectives</code> is invalid/does not match an accepted value this error is thrown. See details <a href="https://www.interactivebrokers.com/campus/ibkr-api-page/web-api-account-management/#accounts-27">here</a>.</td>
</tr>
<tr class="odd">
<td>Incorrect Asset Class specified.</td>
<td>If <code>assetClass </code>attribute inside the <code>investmentExperience </code>is invalid or missing, the following is thrown.</td>
</tr>
<tr class="even">
<td>Asset Experience is missing.</td>
<td>If <code>assetClass </code>is absent from JSON, this error is thrown</td>
</tr>
<tr class="odd">
<td>Knowledge level is missing for asset class BOND in AssetExperience node.</td>
<td>If knowledgeLevel in assetExperience is missing or blank the following error is thrown</td>
</tr>
<tr class="even">
<td>Years trading is missing for asset class BOND in AssetExperience node.</td>
<td>If <code>yearsTrading</code> in assetExperience is missing or blank this error is thrown</td>
</tr>
<tr class="odd">
<td>Trades per year is missing for asset class BOND in AssetExperience node.</td>
<td>If <code>tradesPerYear</code> in assetExperience is missing or blank this error is thrown</td>
</tr>
<tr class="even">
<td>SourcesOfWealth must include SOW-IND-Income when employmentType is EMPLOYED.</td>
<td>If <code>employmentType</code> is Employed, then one SOW type must be “Income”</td>
</tr>
<tr class="odd">
<td>Description is missing for Source Type SOW-IND-Other.</td>
<td>If the <code>description </code>is missing for the “Other” SoW type, this error is thrown</td>
</tr>
<tr class="even">
<td>Source Type for sourceOfWealth is either missing or is invalid.</td>
<td>If the <code>sourceType</code> for the <code>sourcesOfWealth</code> is missing or an invalid value this error is thrown</td>
</tr>
<tr class="odd">
<td>At least one sourceOfWealth must be used to fund the account.</td>
<td>If there are no <code>sourceofWealth </code>nodes or if they are all set to false for funding the account, this error is thrown</td>
</tr>
<tr class="even">
<td>Percentage is required ONLY when SourceOfWealth is used to fund the account.</td>
<td>If percentage is included (other than 0) for an SoW that is not being used to fund the account, this error is thrown</td>
</tr>
<tr class="odd">
<td>Exception for accounts * Financial Criteria checks for Capabilities failed: {financial=Liquid Net Worth must be greater than USD 20,000.} occurred.</td>
<td>If the <code>liquidNetWorth</code> value is less than 20,000 then this error is thrown</td>
</tr>
<tr class="even">
<td>Exception for accounts * Financial Criteria checks for Capabilities failed: {est_net_worth=Your Liquid Net Worth cannot be larger than Net Worth} occurred.</td>
<td>If the <code>netWorth</code> is less than the liquid net worth this error is thrown</td>
</tr>
<tr class="odd">
<td>Invalid values for Net Worth, Liquid Net Worth and Annual Net Income in FinancialInformation node.</td>
<td>If <code>netWorth</code>, <code>liquidNetWorth</code>, or <code>annualNetIncome</code> are missing from <code>financialInformation </code>node this error is thrown</td>
</tr>
<tr class="even">
<td>NOT valid – null</td>
<td>If an invalid character is entered in the attributes in <code>financialInformation </code>node the following is thrown (including a letter, comma, space instead of only numbers)</td>
</tr>
<tr class="odd">
<td>Customer Type null or invalid (not INDIVIDUAL, UGMA, UTMA, JOINT, TRUST or ORG)</td>
<td>If the <code>type</code> attribute in the customer node is blank or an invalid value this error is thrown</td>
</tr>
<tr class="even">
<td>Attribute prefix at the Customer level is missing.</td>
<td>If the <code>prefix </code>value is blank or missing this error is thrown</td>
</tr>
<tr class="odd">
<td>NullPointerException</td>
<td></td>
</tr>
<tr class="even">
<td>Code is either invalid or is missing in Regulatory Details.</td>
<td>If the <code>code</code> attribute in <code>regulatoryDetail</code> is invalid or blank this error is thrown</td>
</tr>
<tr class="odd">
<td>String index out of range: 0</td>
<td>If an attribute is blank this error is thrown. Example status is blank within <code>regulatoryDetail.</code></td>
</tr>
<tr class="even">
<td>Total Percentage from SourcesOfWealth used to fund the account is 95%. It MUST add to 100%.</td>
<td>If SOW percentage doesnt add to exactly 100%, this error is thrown</td>
</tr>
<tr class="odd">
<td>All usernames starting with the prefix, &lt;insertPrefixHere&gt; are already taken. Please use a different prefix.</td>
<td>Indicate that all valid combinations (000 – 999) have been taken for that specific prefix. Please fix the prefix included within <code>customer </code>and <code>users  </code>node and resubmit.</td>
</tr>
<tr class="even">
<td>Following US Indicia checks came back positive.</td>
<td>For Non-US Applicants, US Indicia check will come back positive IF any of the below conditions are met:<br />
‘United States’ OR ‘USA’ is provided within <a href="https://www.ibkrguides.com/dameca/Schema/CountryOfBirth.htm">countryOfBirth</a><br />
IssuingCountry (<a href="https://www.ibkrguides.com/dameca/Schema/Identification.htm">Identification</a>) <br />
Citizenship, Citizenship2, Citizenship3 (<a href="https://www.ibkrguides.com/dameca/Schema/Identification.htm">Identification</a>) <br />
country (mailingAddress OR Residence) <br />
phone
<p>– Country of permanent or mailing address in AML/account opening documentation different from the country code in box 9 of the W8BEN<br />
– Address (permanent or mailing address) where the customer has not claimed tax residency<br />
– Address in Guernsey, Jersey, Gibraltar, or Isle of Man but the customer did not indicate tax residency there</p></td>
</tr>
<tr class="odd">
<td>“Unsupported value. Property:’customerType’, value:’individual</td>
<td></td>
</tr>
</tbody>
</table>

#### **AssociatedIndividual** 

<table>
<colgroup>
<col style="width: 50%" />
<col style="width: 50%" />
</colgroup>
<thead>
<tr class="header">
<th><strong>Error Message</strong></th>
<th><strong>Explanation</strong></th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td>Must be at least 18 to open account</td>
<td>Individual must be at least 18 years old to open account.</td>
</tr>
<tr class="even">
<td>Marital Status Type for Individual is missing</td>
<td>If Marital Status is missing, then this error is thrown</td>
</tr>
<tr class="odd">
<td>Employment Type for Individual is missing.</td>
<td>If <code>employmentType </code>is missing, blank or invalid the error is thrown</td>
</tr>
<tr class="even">
<td>American SSN is invalid.</td>
<td>If the <code>ssn</code> attribute in <code>Identification </code>node is blank or invalid this error is thrown</td>
</tr>
<tr class="odd">
<td>SSN or EIN must be provided for transfers</td>
<td>if <code>ssn </code>attribute is missing from <code>extPostisionTransfer</code> node this error is thrown</td>
</tr>
<tr class="even">
<td>Customer &lt;externalID&gt; – State code &lt;stateCode&gt; is not valid</td>
<td>If the <code>state</code> in any node is invalid this error is thrown</td>
</tr>
<tr class="odd">
<td>Name in Native Language is missing for Account Holder</td>
<td>Name in Native Language is missing for Account Holder.</td>
</tr>
<tr class="even">
<td>Details in NativeName Node must be provided in Native Language for Account Holder.</td>
<td>Values in <code>nativeName</code> node provided in English</td>
</tr>
<tr class="odd">
<td>Name of Individual is missing for Account Holder</td>
<td>Missing Name node</td>
</tr>
<tr class="even">
<td>Middle Name in English Language for Account Holder is missing.</td>
<td>Middle name is included in <code>nativeName</code> and missing in Name node</td>
</tr>
<tr class="odd">
<td>Date of Birth format for Account Holder is invalid. Expected format is yyyy-mm-dd.</td>
<td>Error will be thrown if DOB is any value other than yyyy-mm-dd.Following formats are validated for all the test cases listed below.97-12-24 (Invalid Year format)24-12-1997 (Invalid order)1997/12/24 (Invalid separator)1997-12-24T07:00:00.000Z (Time stamp included)1997-02-29 (29th in non-leap year)1997-13-24 (Invalid Month)1997-12-24a (Characters in date)1990-12-32 (Invalid day)1990-8-8 0000-00-001990-12-12</td>
</tr>
<tr class="even">
<td>Employer country and residence country details is mandatory for Account Holder.</td>
<td>Country of employment is different from the country of <code>residenceAddress </code>and <code>emplcountryRescountryDetail</code> is missing from <a href="https://www.ibkrguides.com/dameca/Schema/EmployerDetails.htm">employmentDetails</a> node.</td>
</tr>
<tr class="odd">
<td>PO Box not accepted as residential address</td>
<td>We validate <code>street1 </code>and <code>street2 </code>to ensure that PO Box is not being provided within<code> residenceAddress</code>. Refer to validations.</td>
</tr>
<tr class="even">
<td>Mobile  Number &lt;insertNumber&gt; is invalid.</td>
<td>Phone Number provided is invalid. We use Google API to validate the Phone Number. The API allows for country code to be passed along with the phone number, details are outlined <a href="https://www.ibkrguides.com/dameca/Schema/Phones.htm">Phone</a>. Google Phone Library to version 8.12.2 (<a href="https://github.com/google/libphonenumber">https://github.com/google/libphonenumber</a>).</td>
</tr>
<tr class="odd">
<td>Foreign Tax Id must be atleast 6 alphanumeric characters in Formw8BEN for Account Holder</td>
<td><code>foreignTaxId</code> within <a href="https://www.ibkrguides.com/dameca/Schema/W8Ben.htm"><code>w8Ben</code></a> needs to be greater than 6 characters.</td>
</tr>
<tr class="even">
<td>part29aCountry is a Non treaty Country in Formw8BEN for Account Holder</td>
<td><code>part29aCountry </code>within <code>w8Ben </code>does not have a tax treaty with the United States. N/A is acceptable for <code>part29aCountry </code>AND <code>treatyCountry</code>. United States Treaty Countries (<code>part29aCountry</code>): <a href="https://www.irs.gov/businesses/international-businesses/united-states-income-tax-treaties-a-to-zCanada">https://www.irs.gov/businesses/international-businesses/united-states-income-tax-treaties-a-to-zCanada</a> Treaty Countries (<code>treatyCountry</code>): <a href="https://www.canada.ca/en/department-finance/programs/tax-policy/tax-treaties/in-force.htmlAustralia">https://www.canada.ca/en/department-finance/programs/tax-policy/tax-treaties/in-force.htmlAustralia</a> Treaty Countries (<code>treatyCountry</code>): <a href="https://treasury.gov.au/tax-treaties/income-tax-treaties">https://treasury.gov.au/tax-treaties/income-tax-treaties</a></td>
</tr>
<tr class="odd">
<td>Residential and Employer Address for Individual are same.</td>
<td>If <code>"employmentType":“EMPLOYED"</code> or <code>employerAddress </code>cannot be the same as <code>residenceAddress </code>OR <code>mailingAddress </code>otherwise you will receive an error. If the applicant works remotely, please provide the Legal Address of the Employer. <code>"employmentType": "SELFEMPLOYED"</code> THEN  employerAddress can be the same as Residence OR mailingAddress.</td>
</tr>
<tr class="even">
<td>Employer country and residence country details is mandatory for Account Holder</td>
<td>When the country included within <code>residenceAddress </code>node is different from the country included within <code>employerAddress </code>node, THEN emplCountryResCountryDetails is required within the &lt;<a href="https://www.ibkrguides.com/dameca/Schema/EmployerDetails.htm">employmentDetails</a>&gt; node.</td>
</tr>
<tr class="odd">
<td>Unable to determine client IB entity. Kindly provide valid Residence country and Legal Residence Country.</td>
<td>Advisor/broker cannot open an account for the applicant due to the legalResidenceCountry or country within &lt;residence&gt; of the applicant.
<p><strong>United States:</strong> Available to U.S. based IB-LLC advisors/brokers only.</p>
<p><strong>Canada</strong>: Available to IB-CAN advisors/brokers only.</p>
<p><strong>Hong Kong</strong>: Available to IB-HK advisors/brokers only.</p>
<p><strong>Australia</strong>: Available to IB-AU advisors/brokers only.</p>
<p><strong>Japan</strong>: Available to IBLLC advisors/brokers that are FSA Registered only.</p>
<p><strong>United Kingdom</strong>: Available to IB-UK advisors/brokers only.<br />
<strong>Singapore</strong>: Available to IB-SG advisors/brokers only.</p>
<p><strong>EEA</strong>: Available to IB-IE or IB-CE advisors/brokers only.</p>
<p><strong>EEA Countries:</strong> Austria, Czech Republic, Germany, Italy, Malta, Romania, Belgium, Denmark, Greece, LatviaNetherlands, Slovakia, Bulgaria, Estonia, Hungary, Liechtenstein Norway Slovenia, Croatia,Finland, Iceland, Lithuania, Poland, Spain, Cyprus</p></td>
</tr>
<tr class="even">
<td>Prohibited Country listed Residence / Employer Address / Mailing Address.</td>
<td>[residence/employer address/ mailing Address] &lt;countryCode&gt; for Account Holder is prohibited.</td>
</tr>
<tr class="odd">
<td>Description for Occupation is missing for Account Holder with externalId ..</td>
<td>Error triggered if ‘other’ is provided as employerBusiness OR occupation AND description is missing. See <a href="https://www.ibkrguides.com/dameca/Schema/EmployerDetails.htm">employmentDetails</a></td>
</tr>
<tr class="even">
<td>Customer externalId- Country non-existent [name = States]</td>
<td>The error was triggered because invalid country provided. For country, IBKR requires <a href="https://www.iso.org/obp/ui"><br />
3 Digit ISO Code</a>.</td>
</tr>
<tr class="odd">
<td>The country of legal residence [United States] is not accepted for clients of this advisor</td>
<td></td>
</tr>
<tr class="even">
<td>Employment Type [Employed] for Account Holder is invalid</td>
<td>Employment type must be in Capital letters. For eg: “employmentType”: “EMPLOYED”</td>
</tr>
<tr class="odd">
<td>“The residential country [Australia] or country of legal residence [Australia] is not accepted as clients of advisor with IB entity IBLLC-US.”</td>
<td>Australian accounts must be created under IB-AU brokers</td>
</tr>
<tr class="even">
<td>“Country in Employer address Node for Account Holder is missing.”</td>
<td>If ‘Country’ Employer address is missing, this error is thrown </td>
</tr>
<tr class="odd">
<td>“City in Residence Node for Account Holder is missing.”</td>
<td>If ‘City’ in Residence node is missing, this error is thrown</td>
</tr>
<tr class="even">
<td>“Unrecognized property:’residence’”,</td>
<td>If ‘residenceAddress’ is missing in payload, this error is thrown</td>
</tr>
<tr class="odd">
<td> “Unrecognized property:’hasSameMailAddress’”,</td>
<td>If ‘sameMailAddress’ is missing in payload, this error is thrown</td>
</tr>
<tr class="even">
<td> “Employment Type for Account Holder is missing.”</td>
<td>If ’employmentType’  is missing in payload, this error is thrown</td>
</tr>
<tr class="odd">
<td>“value”: “Mobile Number 0022960414 is invalid.”</td>
<td>If mobile number is Invalid </td>
</tr>
<tr class="even">
<td>“Date of Birth format for Account Holder is invalid. Expected format is yyyy-mm-dd.”</td>
<td>DOB must be in yyyy-mm-dd  Format</td>
</tr>
<tr class="odd">
<td>“Employment Type [Retired] for Account Holder is invalid.”</td>
<td>Employment type must be in Capital letters. For eg: “employmentType”: “RETIRED”</td>
</tr>
</tbody>
</table>

### **accounts**

| **Error Message**                                                                              | **Explanation**                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|                                                                                                |                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| “Fee template called \[Test template\] not found for master \[account ID\]”                    | FEE\_TEMPLATE\_NOT\_FOUND response will be returned IF no fee template is applied OR if fee configuration applied is not defined by template. Eg: You can add fee template as ‘No fees’ if no fee template exists.                                                                                                                                                                                                                                                      |
| Create account where “Australian Accounts are not allowed under IBLLC-US Advisors”             | Australian accounts must be created under IB-AU brokers                                                                                                                                                                                                                                                                                                                                                                                                                 |
| “Canadian legal resident client cannot be client of this advisor as FA is not based in Canada” | Canadian accounts must be opened under FA based in Canada                                                                                                                                                                                                                                                                                                                                                                                                               |
| Error “product”: “STK”                                                                         | Enter assetclass as  ‘Stock’                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| “Unsupported value. Property:’assetClass’, value:’BONDS’”,                                     | Enter assetclass as ‘Bond’                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Account base currency is either missing or is invalid.                                         | If the `baseCurrency` in the `account` is invalid or missing this error is thrown                                                                                                                                                                                                                                                                                                                                                                                       |
| Fee details type is mandatory and should be in the list of acceptable values.                  | If type attribute is missing from the `automatedFeesDetails` node then this error is thrown                                                                                                                                                                                                                                                                                                                                                                             |
| Error processing advisor wrap fees: {type=required}                                            | If node ` automatedFeesDetails  `in `advisorWrapFees` node is missing this error is thrown                                                                                                                                                                                                                                                                                                                                                                              |
| Advisors must specify the fees scheme for the acct                                             | Advisors may charge their clients for services rendered either through automatic billing, electronic invoice or direct billing. You determine the advisor fees at the time of the client’s registration, and may modify these at any time in Account Management. The fee will be specified within the Accounts Node using [advisorWrapFees](https://www.ibkrguides.com/dameca/Schema/AdvisorWrapFees.htm) OR [Fees](https://www.ibkrguides.com/dameca/Schema/Fees.htm). |
| Advisors must specify the fees scheme for the account.                                         | For advisor clients, fee schema needs to be defined within ` advisorWrapFees  `**OR** `feeTemplateName`. Details can be found [here](https://www.interactivebrokers.com/campus/ibkr-api-page/web-api-account-management/#accounts-27).                                                                                                                                                                                                                                  |
|                                                                                                |                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |

### **users**

| **Error Message**                                                                          | **Explanation**                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Create account where city is missing.                                                      |                                                                                                                                                                                                                                                                                                                                                         |
| Already Processed                                                                          | e`xternalId` must be unique for each request. If the `externalId` has already been processed; you will receive error “Already Processed” Please resubmit the request using a new unique `externalId`. [/getResponseFile](https://www.ibkrguides.com/dameca/Endpoint/getResponseFile.htm) can be used to pull application details based on `externalId`. |
| “External User Id 46781USR in User node is already in use. Please provide a different id.” | If External ID has already been used, this error is thrown. Please create and update a new external ID                                                                                                                                                                                                                                                  |

### **documents**

| **Error Message**                                                                                                                                                             | **Explanation**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unrecognized property:’isAuthorizedToSignOnBehalfOfOwner                                                                                                                      | If inocrrect format entered. Enter “authorizedToSignOnBehalfOfOwner” as object in payload                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| “Valid MIFIR Document Type for United Kingdom : National ID”                                                                                                                  | If invalid MIFIR ID is submitted this error thrown.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| “Foreign Tax Id in W8Ben node for Account Holder should match TIN in TaxResidency                                                                                             | Foreign Tax Id and TIN number must be the same                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Prohibited Country Questionnaire is mandatory for Account Holder                                                                                                              | Triggered if ` countryOfBirth  `is a ‘Prohibited Country’and [prohibitedCountryQuestionnaire](https://www.ibkrguides.com/dameca/updateFunction/ProhibitedCountryQuestionnaire.htm) is missing.                                                                                                                                                                                                                                                                                                                                            |
| Prohibited Country Questionnaire is mandatory for Account Holder                                                                                                              | If `citizenship`, ` citizenship2, citizenship3  `or ` countryOfBirth  `is prohibited country then `prohibitedCountryQuestionnaire `is required.                                                                                                                                                                                                                                                                                                                                                                                           |
| Unable to process documents::java.sql.SQLIntegrityConstraintViolationException: ORA-02291: integrity constraint (IBCUST.TOSEND\_FKDOCUMENTID) violated – parent key not found | fileName within [Documents](https://www.ibkrguides.com/dameca/Schema/Document.htm) exceeds 20 characters.                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Proof of Identity Type (Form 8001) is either missing or is incorrect                                                                                                          | `proofOfIdentityType` within [Documents](https://www.ibkrguides.com/dameca/Schema/Document.htm) is not valid or is missing. The data is space and case sensitive.                                                                                                                                                                                                                                                                                                                                                                         |
| Proof of Address Type (Form 8002) is either missing or is incorrect                                                                                                           | `proofOfAddressType` within [Documents](https://www.ibkrguides.com/dameca/Schema/Document.htm) is not valid or is missing. The data is space and case sensitive.                                                                                                                                                                                                                                                                                                                                                                          |
| Signature not accepted.                                                                                                                                                       | ` signedBy  `within [Documents](https://www.ibkrguides.com/dameca/Schema/Document.htm) must match the submitted: first name middle initial (if applicable) last name suffix (if applicable). The data is case and space sensitive.                                                                                                                                                                                                                                                                                                        |
| I/O error file processing                                                                                                                                                     | This error is triggered when the ` fileName  `included in the ` documents  `section of the application is not submitted to IBKR. Resubmit the form to IBKR using [DocumentSubmission](https://www.interactivebrokers.com/campus/ibkr-api/account-management-api/#complete-registration-tasks-10)                                                                                                                                                                                                                                          |
| File has a different SHA-1 check sum in the archived original                                                                                                                 | This error is triggered when the sha1Checksum stored in the database is different from the sha1Checksum that is stored in the database. Error is triggered when an outdated document is submitted. Instructions to pull forms can be found [here](https://www.interactivebrokers.com/campus/ibkr-api/account-management-api/#download-ibkr-agreements-and-disclosures-65). Instructions to resubmit forms can be found [here](https://www.interactivebrokers.com/campus/ibkr-api/account-management-api/#complete-registration-tasks-10). |
| Local Tax Form is missing for TaxAuthority AUSTRALIA\_TA Local Tax Form is missing for TaxAuthority CANADA\_TA                                                                | This error is triggered when Canada or Australia permissions are requested AND [localTaxForms](https://www.ibkrguides.com/dameca/Schema/LocalTaxForms.htm) is missing from [w8Ben](https://www.interactivebrokers.com/campus/ibkr-api/account-management-api/#dependent-on-type-55).                                                                                                                                                                                                                                                      |
| Expiration Date for Identification Document (Form 8001)                                                                                                                       | Expiration Date for Proof of Identity document is required of `proofOfIdentityType` is Passport OR Drivers License                                                                                                                                                                                                                                                                                                                                                                                                                        |

###### Non-200 Codes

Your request did not pass gateway validation (e.g., 400, 401, 404, 500)

<table>
<colgroup>
<col style="width: 50%" />
<col style="width: 50%" />
</colgroup>
<thead>
<tr class="header">
<th><strong>Error Message</strong></th>
<th><strong>Explanation</strong></th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td>Contains non ASCII character.</td>
<td>Only ASCII Characters are supported. Error will be thrown if Non-ASCII characters are included.</td>
</tr>
<tr class="even">
<td>Invalid payload for security policy: SIGNED_JWT</td>
<td>Triggered for one of two reasons:<br />
1. Request includes Non-ASCII Characters.<br />
2. JWT is wrapped within JSON structure. We expect JWT Token directly. Meaning, it should be application/jwt <strong>instead of</strong> application/json.</td>
</tr>
</tbody>
</table>

## Registration Options

The IBKR systems including Registration, Client Portal, and Emails can be customized (free of cost) to reflect your company branding including logo, company name, and theme file.

Instructions to configure White Branding :

  - [Custom Theme File](https://ibkrguides.com/brokerportal/whitebranding/custom-theme.htm)
  - [Registration and Portal](https://ibkrguides.com/brokerportal/whitebranding/whitereg.htm)
  - [Emails](https://ibkrguides.com/brokerportal/whitebranding/whiteemail.htm)

### Embed IBKR Hosted Application to Website

Embed the [Fully Electronic](https://guides.interactivebrokers.com/bp/Default.htm#inviteclientstartelectronicapp.htm?TocPath=Dashboard%257CClient%2520Applications%257C_____2) application on your website, when the client clicks on the application link, they will be redirected to the IBKR hosted Application that is White Branded. Client will complete the application (in full) through the IBKR application and submit to  
IBKR for processing.

  - Display own agreements /pre-qualification questions (if needed)
  - Available to Registered Advisors and Introducing Brokers free of cost
  - Minimal development work involved
  - Registration process 100% Electronic
  - Application hosted by IBKR

###### Workflow

Configure White Branding for [Emails](https://www.ibkrguides.com/brokerportal/whitebranding/whiteemail.htm) AND [Client Portal, The Registration System, Statements, and PortfolioAnalyst](https://guides.interactivebrokers.com/bp/Content/whitebrandingportal.htm)

1.  The IBKR Portal can be customized (free of cost) to reflect your company branding including logo, company name, and [theme file](https://ibkrguides.com/brokerportal/whitebranding/custom-theme.htm). Generate URL to the Application
2.  From IBKR Portal, select Settings \> Client [Account Template](https://guides.interactivebrokers.com/bp/Default.htm#clientaccounttemplatesnew.htm).  
3.  Select ‘Chain’ icon
4.  Copy Hyperlink
5.  Embed Hyperlink to website
6.  You can ask pre-qualification questions/display your own forms then drive the client to a specific Client Account Template based on the answers.![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMSIgaGVpZ2h0PSIxIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjwvc3ZnPg==)

### Send Fully-Electronic Application to your Client

Initiate an email invitation to your potential client, who is then required to complete the application online electrically using the [Fully-Electronic](https://www.ibkrguides.com/brokerportal/homemenu/inviteclient.htm?Highlight=Fully-Electronic) application.

  - Available to Registered Advisors and Introducing Brokers free of cost
  - No development work involved
  - Registration process 100% Electronic
  - Application hosted by IBKR

###### Workflow

Tools available to help simplify the Fully-Electronic Application:

  - **Account Templates**: Client account template is used to simplify application. Use [Account Template](https://www.ibkrguides.com/advisorportal/clientaccttemplates.htm?Highlight=template) to specify Account Type, Base Currency, Trading Capabilities, Trade Permissions, Financial Information, and Fee Configuration.
  - **CRM**: Use the CRM Tool to Pre-Populate the Fully-Electronic Application. The client will receive an email with the prefilled application. The CRM tool and the use of a client account template would populate 90% of the application. Once completed, the client can submit the application back to Interactive Brokers electronically.
      - Add Contacts to IBKR’s [CRM](https://www.ibkrguides.com/advisorportal/homemenu/addcontact.htm) manually OR in bulk using import feature.
      - Initiate Invite from CRM Contact
      - Select ‘Contacts’ \> Select Individual Contact \> Select ![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMSIgaGVpZ2h0PSIxIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjwvc3ZnPg==)icon to send Application Invite \> Specify Application Method (Fully-Electronic)
      - Use Template?
      - If Yes, select Template
      - Prospect will receive an email invitation to start the IBKR application.
      - When prospect clicks on hyperlink to start the application, the application will be pre-filled with data that was entered in the CRM/Template. The client can modify information if needed.
      - The user will be required to enter the following information:
          - Create username and password
          - Specify 3 security questions and answers
          - Answer regulatory information
          - Specify funding
          - Specify information for second holder (For Joint Accounts Only)
  - Once completed, the client can submit the application back to Interactive Brokers electronically.

### Complete Semi-Electronic Application for your Client

With the [Semi-Electronic,](https://www.ibkrguides.com/brokerportal/homemenu/startsemielectronic.htm?Highlight=Semi-Electronic) you will complete an electronic application online for your potential client. At the end of the process, you will generate a PDF application. Provide the PDF application to prospect client for review and signing (physical signature is required).

  - Available to Registered Advisors and Introducing Brokers free of cost
  - No development work involved
  - Signed Government Issued ID + Physical Signature required for the application
  - Application hosted by IBKR

IBKR’s [CRM](https://www.ibkrguides.com/advisorportal/homemenu/addcontact.htm) can be used to pre-fill the Semi-Electronic Application.

### Mass Upload

Mass upload is designed for advisors/brokers that are seeking an efficient way to move 20+ clients over to IBKR in a seamless manner. Rather than completing individual applications for each account, accounts can be opened in bulk by providing application data in Excel Workbook.

  - Available to Registered Advisors and Introducing Brokers free of cost
  - Registration process 100% Electronic
  - Application hosted by IBKR
  - Bulk  Upload for existing client base

###### Workflow

1.  IBKR will provide FA/Broker with spreadsheets by account type.
2.  FA/BRoker will complete the spreadsheets with client information and submit to IBKR for Processing.
3.  IBKR will upload the accounts and provide the FA/Broker with the account credentials.
4.  Advisor/Broker will provide their clients with the credentials.
5.  Client will need to log into the IBKR White Branded Portal to review application information and electronically sign the IBKR agreements /disclosures.

### Link existing account to Advisor/Broker

An existing IB account can link under the Advisor/Broker directly through Client Portal.

  - Available to Registered Advisors and Introducing Brokers free of cost
  - Registration process 100% Electronic

###### Workflow

1.  **Initiate Linkage Request**
      - Option 1: Embed URL on your site where user can submit request to link to your master.
          - https://ndcdyn.interactivebrokers.com/sso/Login?forwardTo=AA\_LINKAGE\&masterAccountId=\<InsertMasterAccountIDHere\>
      - Option 2: Mutual client will initiate request to link to the advisor/broker within Client Portal \> Settings \> Account Settings \> [Create, Move, Link or Partition an Account.](https://www.ibkrguides.com/clientportal/createlinkedaccountunderadvisorbroker.htm?Highlight=link%20account)
2.  Confirm Linkage Request
      - An email will be sent to the Advisor/Broker to inform them of the request. The Advisor/Broker must accept the linkage request (in Pending Items) before the account is linked.

### Full Integration- Client Registration with Web API

Available for Advisors/Brokers that would like to customize the Registration System, Portal, and Funds and Banking System. Account Management web API is used as an alternative to the IB hosted Portal.

  - Intended for advisors/brokers who have working knowledge of OAuth 2.0 and JSON.
  - Control look, feel, flow of the application
  - Registration process 100% Electronic
  - Application hosted by Counterparty
  - Management approval is required- requests are reviewed on a case by case basis.
  - Generally advisors/brokers that plan on bringing over 100 + accounts within the first quarter OR 50M USD are eligible for this service.
  - Hosting advisors and brokers are subject to both an upfront and ongoing fee intended to offset the costs incurred by IBKR for vetting the initial request and to conduct an annual review of the hosted application. This annual review is intended to ensure that the hosted application has been updated to reflect changes IBKR has implemented to its own application and that no other changes which would cause IBKR to reject the hosted arrangement have been introduced by the advisor or broker.

###### Workflow

1.  The Advisor/IBroker builds an interface on their website to collect all required IBKR application fields + collect signature for the IBKR agreements /Disclosures
2.  The Advisor/IBroker sends all data and signed agreements and disclosures to IBKR (in JSON format) using Web API.
3.  IBKR retrieves the files and provides a response file. Response will have a status of Success or Error. Any errors will be corrected by the Advisor/IBroker and then resubmitted.
4.  Successful response files will include the IB account \#, username, temporary password, and confirmation of the agreements/disclosures that were successfully processed + pending registration tasks (if any) that are required for approval.
      - If no registration tasks are included in the response file, the account will be submitted for approval.
      - If registration tasks are included, the [registration tasks](https://www.interactivebrokers.com/campus/ibkr-api/account-management-api/#complete-registration-tasks-10) will need to be completed in order for the account to proceed with the approval process.
5.  The Advisor/IBroker is responsible for providing the account numbers, usernames and temporary passwords to their clients.
6.  The client will be prompted to reset his or her password and enter three security questions the first time they login to IBKR Portal after the account has been approved and opened.

### Hybrid

Provide IBKR with partial account data via Web API. Client will complete the remaining applications steps via the IBKR hosted application (white branded).

  - Advisor/Broker can direct the client to IBKR’s login page (white branded) or create [single sign on](https://www.interactivebrokers.com/campus/ibkr-api-page/web-api-account-management/#single-sign-on) session to complete remaining application steps.

<!-- end list -->

  - Intended for advisors/brokers who have working knowledge of JSON and OAuth 2.0.
  - Registration process 100% Electronic
  - Application hosted by IBKR
  - Moderate development work involved

###### Workflow

Workflow for Advisor and Fully-Disclosed clients

1.  **Create Account with IBKR **
      - Submit partial application data to IBKR using [accounts](https://www.interactivebrokers.com/campus/ibkr-api-page/webapi-ref-staging/#tag/Account-Management-Accounts/paths/~1gw~1api~1v1~1accounts/post) endpoint.
          - Minimally, we will require Name, Email, Country of Residence to create an account.
          - [Required Fields](https://www.interactivebrokers.com/campus/ibkr-api-page/web-api-account-management/#data-for-client-registration)
      - IBKR will return a real-time [response](https://www.interactivebrokers.com/campus/ibkr-api-page/web-api-account-management/#sample-responses) with the account credentials and pending tasks.
2.  **Direct user to IBKR Portal to complete remaining application steps.**
      - Create [s](https://www.interactivebrokers.com/campus/ibkr-api-page/webapi-ref-staging/#tag/Authorization-SSO-Sessions/paths/~1gw~1api~1v1~1sso-sessions/post)[ingle sign on](https://www.ibkrguides.com/dameca/Endpoint/ssoCreate.htm) session to seamlessly connect user to the IBKR Portal.
      - The IBKR Portal can be customized (free of cost) to reflect your company branding including [logo, company name](https://ibkrguides.com/brokerportal/whitebranding/whitereg.htm), and [theme file](https://ibkrguides.com/brokerportal/whitebranding/custom-theme.htm). This can be configured directly within IBKR Portal.
3.  **Set Password and Complete Email Verification (Optional)**
      - IBKR authentication with username and password is required IF setting / changing banking instructions OR facilitating withdrawals within the IBKR Hosted Portal.
      - API supports creation of ACH instructions for U.S. Based Clients. For all other clients, banking instructions for withdrawals will need to be added within the IBKR Portal; which means password will need to be set on the account.
      - IBKR provides 2 options for setting password (if option 2, post approval, skip to step 4).
      - **Option 1: Set Password During Registration (Suggested)**
          - Upon accessing IBKR Portal, user will be prompted to enter temporary password (that was included in the response file) + set new password.  
            ![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMSIgaGVpZ2h0PSIxIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjwvc3ZnPg==)  
            IBKR will send email confirmation toke to verify the identity. Email will be branded with your company logo and return email address.  
            ![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMSIgaGVpZ2h0PSIxIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjwvc3ZnPg==)  
            Sample email  
            ![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMSIgaGVpZ2h0PSIxIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjwvc3ZnPg==)  
            Password change has been processed.  
            ![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMSIgaGVpZ2h0PSIxIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjwvc3ZnPg==)
      - **Option 2: Set Password Post Approval**
          - Counterparty will direct user to IBKR’s Password Reset Tool to set password.
          - User enters IBKR username and date of birth.
          - IBKR will send SMS token to verify identity.
          - User will set password and complete email verification.
4.  User completes remaining application steps.
      - Application will be pre-filled with information that was included in the XML file to create the account.
      - Screen 1: About You
      - Screen 2: Configure Your Trading Account
      - Screen 3: Agreements and Disclosures
      - Screen 4: Application Status

## Flow Chart

#### Under construction, check back later\!
