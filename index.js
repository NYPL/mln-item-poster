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
      // post to API

      updateRecordsArray = []

      records.forEach(function(record) {
        // we know the item belongs to a MyLibraryNYC bib when it has
        // "61":{"label":"Item Type","value":"252","display":"Teacher Set (DOE EDUCATOR ONLY)"},
        if (record.fixedFields["61"].value == "252") {
          logger.debug({'message': 'record ' + record + ' is of MLN type'})
          updateRecordsArray.push(record)
        } else {
          logger.debug({'message': 'Record has a value type of: ' + record.fixedFields["61"].value + '. Therefore, will not send request to Rails API.'})
        }
      })

      if (updateRecordsArray.length != 0) postRecords(updateRecordsArray, accessToken)

    } catch (error) {
      logger.error({'message': error.message, 'error': error})
      CACHE['accessToken'] = null
      callback(error)
    }
  }


  // map to records objects as needed
  function parseKinesis (payload, avroType) {
    logger.info({'message': 'Parsing Kinesis'})
      // decode base64
    try{

    var buf = new Buffer(payload.kinesis.data, 'base64')
      // decode avro
    var record = avroType.fromBuffer(buf)

    logger.info({'message':  'Parsed Data' , 'data': record })
    return record
    }
    catch (err) {
    logger.error({'message': err.message, 'error': err})
    callback(null)
    }
  }


  // bulk posts item records to the MLN API
  function postRecords (records, accessToken) {
    logger.info({'message': 'Posting records'})
    var options = {
      uri: process.env['MLN_API_URL'],
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: records,
      json: true
    }

    request(options, function (error, response, body) {
      logger.info({'message': 'Posting...'})
      logger.info({'message': 'Response: ' + response.statusCode})
      if (response.statusCode !== 200) {
        if (response.statusCode === 401) {
          // Clear access token so new one will be requested on retried request
          CACHE['accessToken'] = null
        }
        callback(new Error())
        logger.error({'message': 'POST Error! ', 'response': response})
        return
      }
      logger.info({'message': 'POST Success'})
    })
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
