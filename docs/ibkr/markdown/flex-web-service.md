# Flex Web Service

## Flex Web Service

The Flex Web Service is a small, standalone HTTP API for programmatically generating and retrieving pre-configured Flex Queries. Flex Queries are first constructed manually as templates in Client Portal, after which the Flex Web Service API is used to generate an instance of a report populated with up-to-date data and deliver it back to the requesting client. The Flex Web Service offers access to the same Flex Query reports that you’d otherwise retrieve manually from within Client Portal.

For more information about Flex Queries and about IB’s reporting functionality overall, please consult the following documentation:

  - [Flex Queries](https://www.ibkrguides.com/clientportal/performanceandstatements/flex.htm)
  - [Reporting Guide](https://www.ibkrguides.com/clientportal/performanceandstatements/reports.htm)

**Usage Notes:**

1.  Though Flex Query reports can be generated and retrieve at any time, the data they contain will not necessarily change throughout the day. “Activity Statement” Flex Queries contain data that is only updated once daily at close of business, so there is no benefit to generating and retrieving these reports more than once per day. Normally one would retrieve the prior day’s Activity Statements at the start of the following day, which guarantees that all values have been updated by IB’s reporting backend.
2.  “Trade Confirmation” Flex Queries will yield updated data throughout the day as executions occur against working orders, but these execution entries are also not available in Trade Confirmation Flex Queries in real-time. Typically a new execution will be available for inclusion in a newly generated Flex Query report within 5 to 10 minutes.
3.  Given the above restrictions on the refresh rate of Flex Query data, the Flex Web Service is not suitable for active polling for newly generated reports. Rather, it is best used to capture the desired reports once daily, or at most intermittently throughout the day in the case of Trade Confirmation reports.
4.  Depending on the size of the report to be generated, there may be a slight delay between the initial request to generate the report and the report’s availability via the second request. Time to availability is also dependent on system utilization, so please permit some flexibility in the timing of the final report retrieval, either via an explicit “wait” between the first and second requests, or via periodic reattempts of the second request.
5.  Note that the same Flex Query reports (as well as many other report types) can also be scheduled for delivery via email or FTP:
      - [Scheduled Delivery of User-Defined Flex Queries](https://www.ibkrguides.com/clientportal/performanceandstatements/deliverysettingsflex.htm)
      - [Scheduled Delivery of IB-Defined Statements](https://www.ibkrguides.com/clientportal/performanceandstatements/deliver.htm)
6.  Flex queries using a variable duration, such as “Last N Days” will always use the maximum possible days for a given request, rather than following the last used number of days in Client Portal. It is recommended to use the precise request values such as “Last Month”, “Last Quarter”, “Year To Date”, etc.

### Client Portal Configuration

Before using the Flex Web Service API to programmatically retrieve Flex Query reports, you’ll need to manually obtain some values from within **Client Portal**:

1.  An access token to authenticate our requests
2.  One or more query IDs corresponding to the reports you’d like to fetch

If you want to retrieve Flex Queries that you’ve already created, you’ll need to log into Client Portal with the username that created them, as these Flex Query report configurations are username-specific. Once we obtain these values, however, the use of the Flex Web Service API does not involve your IB credentials. Your username will only be involved in any subsequent management of the access token or reconfiguration of the report templates.

**Note: **these steps can only be completed by logging in to the Client Portal directly.

### Enable and Create Access Token

Navigate to the “Reporting” Tab, and select “Flex Queries”. Here, you can find information about your Activity Flex Query, Trade Confirmation Flex Query, Flex Query Delivery, and Flex Web Service Configuration.

We will need to start by selecting the “Flex Web Service Configuration” section on the right.

On the new page, click the empty box next to **Flex Web Service Status** to enable the Flex Web Service, and then click “Save” to save your credentials. This will enable the flex web service and provide a new “Current Token” value that will be used in your flex web service requests moving forward.

You also have the option to generate a new token. A token can be specified to remain active anywhere between 6 hours and 1 year. Generating a new token also allows users to restrict which IPs can make flex web service requests.

### Create a Flex Query

Returning to the Flex Queries page, we will now need to generate at least one Activity Flex Query or Trade Confirmation Flex Query.

Next, click on the **Info** icon to the left of a Flex Query.

From the info pop-over, capture the **Query ID** number listed at the top. This will be used when generating your report.

### Using Flex Web Service

The Flex Web Service API consists of two endpoints. Obtaining Flex Query reports via the Flex Web Service API is a two-step workflow involving requests to both endpoints in sequence. First, you will make a request to trigger IB’s backend to generate an instance of your report, which will populate your Flex Query template with the available data. In response, you’ll receive a reference code identifying this particular instance of the report. Next, you’ll make a request to fetch the generated report using the reference code.

Note that all requests must include a User-Agent header.

### Generate a Report

To begin, you’ll make a GET request to the `/SendRequest` endpoint, passing your access token and the desired Flex Query template’s query ID as query parameters:

`https://ndcdyn.interactivebrokers.com/AccountManagement/FlexWebService/SendRequest?t={CurrentToken}&q={QueryID}&v=3`

### Make request to /SendRequest

###### Query Params

**t**. Required  
Accepts the **Current Token** created for the Flex Web Service in Client Portal’s Account Settings interface.

**q**. Required  
The **Query ID** identifier for the desired report template, obtained from the Client Portal’s Flex Query interface.

**v**. Required, leave value = 3  
Specifies the **version** of the Flex Web Service to be used. Values `2` and `3` are supported, but version 3 should always be used.

  - Python

<!-- end list -->

``` EnlighterJSRAW
requestBase = "https://ndcdyn.interactivebrokers.com/AccountManagement/FlexWebService"
token = 528191644107458877539776
queryId = 800969
flex_version = 3

send_path = "/SendRequest"
send_params = {
    "t":token, 
    "q":queryId, 
    "v":flex_version
}

flexReq = requests.get(url=requestBase+send_slug, params=send_params)
```

### Success response from /SendRequest

**Status**. A value of `Success` indicates a successful request to generate the report. If the request failed, Status will deliver `Fail`.

**ReferenceCode**. If the request was successful, the XML response will contain this numeric reference code. This code will be used in the subsequent request to retrieve the generated Flex Query.

**url**. This is a legacy URL. Should be ignored.

``` EnlighterJSRAW
<FlexStatementResponse timestamp="28 August, 2012 10:37 AM EDT">
    <Status>Success</Status>
    <ReferenceCode>1234567890</ReferenceCode>
   <url>https://gdcdyn.interactivebrokers.com/Universal/servlet/FlexStatementService.GetStatement</url>
</FlexStatementResponse>
```

### Failure response from /SendRequest

**Status**. A failed request will deliver a Status of `Fail`.

**ErrorCode**.  
A numeric code indicating the nature of the failure. See [Error Codes](#error-codes) for a list of error code values and their descriptions.

**ErrorMessage**.  
A human-readable description of the error. See [Error Codes](#error-codes) for a list of error code values and their descriptions.

``` EnlighterJSRAW
<FlexStatementResponse timestamp="28 August, 2012 10:37 AM EDT">
    <Status>Fail</Status>
    <ErrorCode>1012</ErrorCode>
    <ErrorMessage>Token has expired.</ErrorMessage>
</FlexStatementResponse>
```

### Retrieve the Report

Next, you’ll make a GET request to the `/GetStatement` endpoint, again passing your access token, but now passing the reference code obtained from the prior endpoint:

`https://ndcdyn.interactivebrokers.com/AccountManagement/FlexWebService/GetStatement?t={AccessToken}&q={ReferenceCode}&v=3`

Depending on the size of the request, you may need to wait longer between the /SendRequest and /GetStatement endpoint calls for the full report to finish generating.

### Make request to /GetStatement

###### Query Params

**t**. Required  
Accepts the **Access Token** created for the Flex Web Service in Client Portal’s Account Settings interface.

**q** Required  
Accepts the **ReferenceCode** returned by the previous successful request, which identifies the instance of the report to be retrieved. Note that a given Flex Query template can be used to generate multiple reports over time, each populated with data at the time of generation, so this ReferenceCode identifier is used to retrieve a specific instance, presumably the one generated immediately prior.

**v**. Required, leave value = 3  
Specifies the **version** of the Flex Web Service to be used. Values `2` and `3` are supported, but version 3 should always be used.

  - Python

<!-- end list -->

``` EnlighterJSRAW
tree = ET.ElementTree(ET.fromstring(flexReq.text))
root = tree.getroot()

for child in root:
    if child.tag == "Status":
        if child.text != "Success":
            print(f"Failed to generate Flex statement. Stopping...")
            exit()
    elif child.tag == "ReferenceCode":
        refCode = child.text

print("Hold for Request.")
time.sleep(20)

receive_slug = "/GetStatement"
receive_params = {
    "t":token, 
    "q":refCode, 
    "v":flex_version
}

receiveUrl = requests.get(url=requestBase+receive_slug, params=receive_params, allow_redirects=True)

open(csvPath, 'wb').write(receiveUrl.content)
```

### Error Codes

The following is a consolidated list of error codes returnable by the `/SendRequest` and `/GetStatement` endpoints when a server-side failure occurs.

<table>
<colgroup>
<col style="width: 50%" />
<col style="width: 50%" />
</colgroup>
<thead>
<tr class="header">
<th>ErrorCode</th>
<th style="text-align: left;">ErrorMessage</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td>1001</td>
<td style="text-align: left;">Statement could not be generated at this time. Please try again shortly.</td>
</tr>
<tr class="even">
<td>1003</td>
<td style="text-align: left;">Statement is not available.</td>
</tr>
<tr class="odd">
<td>1004</td>
<td style="text-align: left;">Statement is incomplete at this time. Please try again shortly.</td>
</tr>
<tr class="even">
<td>1005</td>
<td style="text-align: left;">Settlement data is not ready at this time. Please try again shortly.</td>
</tr>
<tr class="odd">
<td>1006</td>
<td style="text-align: left;">FIFO P/L data is not ready at this time. Please try again shortly.</td>
</tr>
<tr class="even">
<td>1007</td>
<td style="text-align: left;">MTM P/L data is not ready at this time. Please try again shortly.</td>
</tr>
<tr class="odd">
<td>1008</td>
<td style="text-align: left;">MTM and FIFO P/L data is not ready at this time. Please try again shortly.</td>
</tr>
<tr class="even">
<td>1009</td>
<td style="text-align: left;">The server is under heavy load. Statement could not be generated at this time. Please try again shortly.</td>
</tr>
<tr class="odd">
<td>1010</td>
<td style="text-align: left;">Legacy Flex Queries are no longer supported. Please convert over to Activity Flex.</td>
</tr>
<tr class="even">
<td>1011</td>
<td style="text-align: left;">Service account is inactive.</td>
</tr>
<tr class="odd">
<td>1012</td>
<td style="text-align: left;">Token has expired.</td>
</tr>
<tr class="even">
<td>1013</td>
<td style="text-align: left;">IP restriction.</td>
</tr>
<tr class="odd">
<td>1014</td>
<td style="text-align: left;">Query is invalid.</td>
</tr>
<tr class="even">
<td>1015</td>
<td style="text-align: left;">Token is invalid.</td>
</tr>
<tr class="odd">
<td>1016</td>
<td style="text-align: left;">Account in invalid.</td>
</tr>
<tr class="even">
<td>1017</td>
<td style="text-align: left;">Reference code is invalid.</td>
</tr>
<tr class="odd">
<td>1018</td>
<td style="text-align: left;">Too many requests have been made from this token. Please try again shortly.<br />
Limited to one request per second, 10 requests per minute (per token).</td>
</tr>
<tr class="even">
<td>1019</td>
<td style="text-align: left;">Statement generation in progress. Please try again shortly.</td>
</tr>
<tr class="odd">
<td>1020</td>
<td style="text-align: left;">Invalid request or unable to validate request.</td>
</tr>
<tr class="even">
<td>1021</td>
<td style="text-align: left;">Statement could not be retrieved at this time. Please try again shortly.</td>
</tr>
</tbody>
</table>
