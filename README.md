# Discovery Bib Poster

Reads bibs from stream, posts to bib service.

## Setup

```
npm install
npm install -g node-lambda
node-lambda setup
```

Configure `./config/default.json`, and generate mock-data by running

```
node kinesify-data.js event.unencoded.json event.json
```

This will take the un-encoded data in `event.unencoded.json` and put it in a kinesis stream format using the avro schema.

Assuming you have the proper API and oauth credentials setup, you can run the lambda locally using the mock data in `events.json`

```
node-lambda run
```
