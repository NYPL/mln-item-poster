console.log('Loading Discovery Bib Poster');

const avro = require('avsc');
const config = require('config');
const _ = require('highland');
const OAuth = require('oauth');
const Promise = require('promise');
const request = require('request');

// kinesis stream handler
exports.kinesisHandler = function(records, context, callback) {
  console.log('Processing ' + records.length + ' records');

  // initialize avro schema
  const avroType = avro.parse(config.get('schema'));

  // parse kinesis records
  var data = records
    .map(parseKinesis);

  // oauth token retriever
  function token() {
    var OAuth2 = OAuth.OAuth2;
    var key = config.get('nyplOauth').key;
    var secret = config.get('nyplOauth').secret;
    var auth = new OAuth2(key, secret, config.get('nyplOauth').url, null, 'oauth/token', null);

    return new Promise(function (resolve, reject) {
      auth.getOAuthAccessToken('', { grant_type: 'client_credentials' }, function(e, access_token, refresh_token, results) {
        resolve(access_token);
      });
    });
  };

  // request authorization, then post each record
  token().then(function(access_token){
    console.log('Successfully authenticated');
    Promise.all(data.map(function(record){
      return postRecord(access_token, record);
    }))
      .then(function (res) {
        console.log(res.length + ' POST sucesses');
        // callback(null);
        context.succeed();
      })
      .catch(function (err) {
        console.log('POST errors', err);
        // callback(new Error(err));
        context.done();
      })
  });

  // map to records objects as needed
  function parseKinesis(payload) {
    // decode base64
    var buf = new Buffer(payload.kinesis.data, 'base64');
    // decode avro
    var record = avroType.fromBuffer(buf);
    return record;
  }

  // posts record to API
  function postRecord(access_token, payload) {
    var options = {
      uri: config.get('nyplApi').url,
      method: 'POST',
      headers: { Authorization: `Bearer ${access_token}` },
      body: {
        data: payload
      },
      json: true
    };

    return new Promise(function (resolve, reject) {
      request(options, function(error, response, body){
        if (error) {
          reject(error);

        } else {
          resolve(response);
        }
      });
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
