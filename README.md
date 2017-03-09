# Discovery Bib Poster

Reads bibs from stream, posts to bib service.

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

Generate mock-data by running

```
node kinesify-data.js event.unencoded.bibs.json event.json
```

This will take the un-encoded data in `event.unencoded.bibs.json` and put it in a kinesis stream format using the avro schema.

Assuming you have the proper API and oauth credentials setup, you can run the lambda locally using the mock data in `events.json`

```
node-lambda run
```