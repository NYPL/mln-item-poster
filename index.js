const avro = require('avsc')
const OAuth = require('oauth')
const Promise = require('promise')
const request = require('request')
const winston = require('winston')
const awsDecrypt = require('./helper/awsDecrypt.js')
const logger = require('./helper/logger.js')

// Initialize cache
var CACHE = {}

logger.info({'message': 'Loading MLN Item Poster'})

// kinesis stream handler
exports.kinesisHandler = function (records, context, callback) {
  logger.info({'message': 'Processing ' + records.length + ' records'})
  logger.debug({'message': 'Records=' + records})

  // retrieve token and schema
  Promise.all([token(), schema()])
    .then(function (res) {
      var accessToken = res[0]
      var schema = res[1]
      onReady(records, accessToken, schema)
    })

  // run when access token and schema are loaded
  function onReady (payload, accessToken, schema) {
    logger.info({'message': 'onReady.start'})

    try {
      // load avro schema
      var avroType = avro.Type.forSchema(schema)
      // parse payload
      var records = payload
        .map(function (record) {
          return parseKinesis(record, avroType)
        })

      // see if the item(s) belong to MyLibraryNYC
      updateRecordsArray = []
      records.forEach(function(record) {
        logger.debug({'message': 'record.id=' + record.id})
        var record_type = 'unknown';
        if (record.fixedFields["61"]) {  record_type = record.fixedFields["61"].value;  }

        // we know the item belongs to a MyLibraryNYC bib when it has
        // "61":{"label":"Item Type","value":"252","display":"Teacher Set (DOE EDUCATOR ONLY)"},
        if (record_type == "252") {
          logger.debug({'message': 'record ' + record + ' is of MLN type'})
          updateRecordsArray.push(record)
        } else {
          logger.debug({'message': 'Record type=' + record_type + '. Will not send request to Rails API.'})
        }
      })

      logger.debug({'message': 'Update records array length' + updateRecordsArray.length })
      // if any MLN items, send them on to the MLN API
      if (updateRecordsArray.length != 0) {
        postRecords(updateRecordsArray, accessToken)
      }

      logger.debug({'message': 'Finished sending MyLibraryNYC records to the MLN API.'})

    } catch (error) {
      logger.error({'message': error.message, 'Error occcured': error})
      CACHE['accessToken'] = null
      callback(error)
    }
  }


  // map to records objects as needed
  function parseKinesis (payload, avroType) {
    logger.info({'message': 'Parsing Kinesis'})
      // decode base64
    try {
      var buf = new Buffer(payload.kinesis.data, 'base64')
        // decode avro
      var record = avroType.fromBuffer(buf)

      logger.debug({'message':  'Parsed Data' , 'data': record })
      return record
    } catch (err) {
      logger.error({'message': err.message, 'error': err})
      callback(null)
    }
  }

  const MAX_RETRIES = 5;
  const RETRY_DELAY = 1000; // Initial delay of 1 second

  function postRecords(records, accessToken, retries = 0) {
    logger.info({ message: `Posting records, attempt ${retries + 1}` });

    const options = {
      uri: process.env['MLN_API_URL'],
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: records,
      json: true
    };

    request(options, (error, response, body) => {
      if (error) {
        logger.error({ message: 'Request failed', error });
        return;
      }

      logger.info({ message: 'Response status: ' + response.statusCode + ' Response Body: ' + response.body });

      if ([500, 401].includes(response.statusCode)) {
        if (retries < MAX_RETRIES) {
          const delay = Math.pow(2, retries) * RETRY_DELAY; // Exponential backoff
          logger.info({ message: `Retrying in ${delay / 1000} seconds...` });

          if (response.statusCode === 401) {
            CACHE['accessToken'] = null; // Clear access token for re-authentication
          }

          setTimeout(() => {
            postRecords(records, accessToken, retries + 1);
          }, delay);
        } else {
          logger.error({ message: 'Max retries reached. Request failed.', 'Response Body': + response.body });
          return
        }
      } else if ([400, 404].includes(response.statusCode)) {
        logger.error({ message: 'Post API input validation failed!', 'Response Body': + response.body });
      } else {
        logger.info({ message: 'Request successful', response });
      }
    });
  }

  function schema () {
    // schema in cache; just return it as a instant promise
    if (CACHE['schema']) {
      logger.info({'message': 'Already have schema'})
      return new Promise(function (resolve, reject) {
        resolve(CACHE['schema'])
      })
    }

    return new Promise(function (resolve, reject) {
      var options = {
        uri: process.env['NYPL_API_SCHEMA_URL'],
        json: true
      }
      logger.info({'message': 'Loading schema...'})
      request(options, function (error, resp, body) {
        if (error) {
          logger.info({'message': 'Error! ' + error})
          reject(error)
        }
        if (body.data && body.data.schema) {
          logger.info({'message': 'Sucessfully loaded schema'})
          var schema = JSON.parse(body.data.schema)
          CACHE['schema'] = schema
          resolve(schema)
        } else {
          reject(new Error('Schema did not load'))
          logger.error({'message': 'Schema did not load'})
        }
      })
    })
  }

  // oauth token retriever
  function token () {
    // access token in cache; just return it as a instant promise
    if (CACHE['accessToken']) {
      logger.info({'message': 'Already authenticated'})
      return new Promise(function (resolve, reject) {
        resolve(CACHE['accessToken'])
      })
    }

    // request a new token
    logger.info({'message': 'Requesting new token...'})
    return new Promise(function (resolve, reject) {
      var OAuth2 = OAuth.OAuth2

      var nyplOauthKey = awsDecrypt.decryptKMS(process.env['NYPL_OAUTH_KEY'])
      var nyplOauthSecret = awsDecrypt.decryptKMS(process.env['NYPL_OAUTH_SECRET'])

      Promise.all([nyplOauthKey, nyplOauthSecret])
      .then((decryptedValues) => {
        [nyplOauthKey, nyplOauthSecret] = decryptedValues;
          var url = process.env['NYPL_OAUTH_URL']
          var auth = new OAuth2(nyplOauthKey, nyplOauthSecret, url, null, 'oauth/token', null)
          auth.getOAuthAccessToken('', { grant_type: 'client_credentials' }, function (error, accessToken, refreshToken, results) {
            if (error) {
              reject(error)
              logger.error({'message': 'Not authenticated'})
            } else {
              logger.info({'message': 'Successfully authenticated'})
              CACHE['accessToken'] = accessToken
              resolve(accessToken)
            }
          })
        })
    })
  }
}

// main function
exports.handler = function (event, context, callback) {
  var record = event.Records[0]
  if (record.kinesis) {
    exports.kinesisHandler(event.Records, context, callback)
  }
}
