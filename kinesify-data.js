// Usage:
//  The following command will take unencoded json, encode it with avro schema, encode it with base64, and put in Kinesis format.
//    node kinesify-data.js event.unencoded.json event.json

const args = process.argv.slice(2);
const avro = require('avsc');
const config = require('config');
const fs = require('fs');
const _ = require('highland');

// config
const infile = args[0];
const outfile = args[1];

// initialize avro schema
const avroType = avro.parse(config.get('schema'));

// read unencoded data
var unencodedData = JSON.parse(fs.readFileSync(infile, 'utf8'));

// encode data and put in kinesis format
var kinesisEncodedData = unencodedData.Records
  .map(kinesify);

// stringify and write to file
var json = JSON.stringify({"Records": kinesisEncodedData});
fs.writeFile(outfile, json, 'utf8', function(err, data){
  if (err) {
    console.log('Write error:', err);

  } else {
    console.log('Successfully wrote data to file');
  }
});

function kinesify(record){
  // encode avro
  var buf = avroType.toBuffer(record);
  // encode base64
  var encoded = buf.toString('base64');
  // kinesis format
  return {
    "kinesis": {
      "kinesisSchemaVersion": "1.0",
      "partitionKey": "s1",
      "sequenceNumber": "00000000000000000000000000000000000000000000000000000001",
      "data": encoded,
      "approximateArrivalTimestamp": 1428537600
    },
    "eventSource": "aws:kinesis",
    "eventVersion": "1.0",
    "eventID": "shardId-000000000000:00000000000000000000000000000000000000000000000000000001",
    "eventName": "aws:kinesis:record",
    "invokeIdentityArn": "arn:aws:iam::EXAMPLE",
    "awsRegion": "us-east-1",
    "eventSourceARN": "arn:aws:kinesis:EXAMPLE"
  };
}
