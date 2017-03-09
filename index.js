console.log('Loading Discovery Bib Poster');

const avro = require('avsc');
const config = require('config');
const _ = require('highland');
const OAuth = require('oauth');
const Promise = require('promise');
const request = require('request');

// Initialize cache
var CACHE = {};

// kinesis stream handler
exports.kinesisHandler = function(records, context, callback) {
  console.log('Processing ' + records.length + ' records');

  // initialize avro schema
  const avroType = avro.parse(config.get('schema'));

  // parse kinesis records
  var data = records
    .map(parseKinesis);

  // check cache for access_token
  if (CACHE['access_token']) {
    console.log('Already authenticated');
    postRecords(CACHE['access_token'], data);

  // access_token not in cache, request a new one
  } else {
    // request authorization, then post each record
    token().then(function(access_token){
      console.log('Successfully authenticated');
      // save access_token to cache
      CACHE['access_token'] = access_token;
      postRecords(access_token, data);
    });
  }

  // oauth token retriever
  function token() {
    var OAuth2 = OAuth.OAuth2;
    var key = process.env['NYPL_OAUTH_KEY'];
    var secret = process.env['NYPL_OAUTH_SECRET'];
    var url = process.env['NYPL_OAUTH_URL'];
    var auth = new OAuth2(key, secret, url, null, 'oauth/token', null);

    return new Promise(function (resolve, reject) {
      auth.getOAuthAccessToken('', { grant_type: 'client_credentials' }, function(e, access_token, refresh_token, results) {
        resolve(access_token);
      });
    });
  };

  // map to records objects as needed
  function parseKinesis(payload) {
    // decode base64
    var buf = new Buffer(payload.kinesis.data, 'base64');
    // decode avro
    var record = avroType.fromBuffer(buf);
    return record;
  }

  // bulk posts records
  function postRecords(access_token, records) {
    var options = {
      uri: process.env['NYPL_API_POST_URL'],
      method: 'POST',
      headers: { Authorization: `Bearer ${access_token}` },
      body: records,
      json: true
    };

    // POST request
    request(options, function(error, response, body){
      if (error || response.errors && response.errors.length) {
        console.log('POST error', response.errors);
        // callback(new Error(error));
        context.fail();

      } else {
        console.log('POST success');
        // callback(null, "Success");
        context.succeed();
      }
    });
  }
};

// main function
exports.handler = function(event, context) {
  var record = event.Records[0];
  if (record.kinesis) {
    exports.kinesisHandler(event.Records, context);
  }
};
