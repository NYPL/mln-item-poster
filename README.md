# Discovery Bib/Item Poster

Reads bibs or items from stream, posts to bib or item service.

## Setup

```
npm install
npm install -g node-lambda
node-lambda setup
```

Configure `.env` with at least these keys:

```
NYPL_OAUTH_URL=xxx
NYPL_OAUTH_KEY=xxx
NYPL_OAUTH_SECRET=xxx
NYPL_API_POST_URL=xxx
NYPL_API_SCHEMA_URL=xxx
```

`NYPL_API_POST_URL` is the API URL you will be posting to. So this can be configured to be the bib or item endpoint. Similarly with `NYPL_API_SCHEMA_URL`, you can configure this to be bib or item schema.

Generate mock-data by running

```
node kinesify-data.js event.unencoded.bibs.json event.json https://api.nypltech.org/api/v0.1/current-schemas/Bib
```

This will take the un-encoded data in `event.unencoded.bibs.json` and put it in a kinesis stream format using the avro schema. You can load items by replacing the input file with `event.unencoded.items.json`

Assuming you have the proper API and oauth credentials setup in your `.env`, you can run the lambda locally using the mock data in `events.json`

```
node-lambda run
```

This will take `events.json` (which is mocked-up kinesis stream data) as input, authenticate with oauth server, retrieve schema from Schema API, parse stream data, then post it to the bib or item API depending on config.

## Deploy

TODO
