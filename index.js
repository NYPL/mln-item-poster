const avro = require('avsc')
const OAuth = require('oauth')
const Promise = require('promise')
const request = require('request')
const winston = require('winston');
const defaultNyplSource = 'sierra-nypl'

// Initialize cache
var CACHE = {}

winston.log('info', {'message': 'Loading Discovery Poster'})

// kinesis stream handler
exports.kinesisHandler = function (records, context, callback) {
  winston.log('info', {'message': 'Processing ' + records.length + ' records'})

  // retrieve token and schema
  Promise.all([token(), schema()])
    .then(function (res) {
      var accessToken = res[0]
      var schema = res[1]
      onReady(records, accessToken, schema)
    })

  // run when access token and schema are loaded
  function onReady (payload, accessToken, schema) {
    // load avro schema
    var avroType = avro.parse(schema)
    // parse payload
    var records = payload
      .map(function (record) {
        return addSource(parseKinesis(record, avroType))
      })
    // post to API
    winston.log('info', {'message': 'Posting records'})
    postRecords(accessToken, records)
  }

  // map to records objects as needed
  function parseKinesis (payload, avroType) {
    winston.log('info', {'message': 'Parsing Kinesis'})
    // decode base64
    var buf = new Buffer(payload.kinesis.data, 'base64')
    // decode avro
    var record = avroType.fromBuffer(buf)
    return record
  }

  function addSource (record) {
    winston.log('info', {'message': 'Adding source'})
    record['nyplSource'] = defaultNyplSource
    record['nyplType'] = process.env['NYPL_POST_TYPE']
    winston.log('info', {'message': 'Added ' + record['nyplSource'] + ' and ' + record['nyplType']})
    return record
  }

  // bulk posts records
  function postRecords (accessToken, records) {
    var options = {
      uri: process.env['NYPL_API_POST_URL'],
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: records,
      json: true
    }

    // POST request
    request(options, function (error, response, body) {
      winston.log('info', {'message': 'Posting...'})
      winston.log('info', {'message': 'Response: ' + JSON.stringify(response.statusCode)})
      if (error || response.statusCode !== 200) {
        if (response.statusCode === 401) {
          CACHE['accessToken'] = null
        }
        winston.log('info', {'message': 'POST Error! ' + JSON.stringify(error)})
        callback(new Error(error))
        return
      }
      if (body.errors && body.errors.length) {
        winston.log('info', {'message': 'Data error: ' + JSON.stringify(body.errors)})
      }
      winston.log('info', {'message': 'POST Success'})
      callback(null, 'POST Success')
    })
  }

  function schema () {
    // schema in cache; just return it as a instant promise
    if (CACHE['schema']) {
      winston.log('info', {'message': 'Already have schema'})
      return new Promise(function (resolve, reject) {
        resolve(CACHE['schema'])
      })
    }

    return new Promise(function (resolve, reject) {
      var options = {
        uri: process.env['NYPL_API_SCHEMA_URL'],
        json: true
      }
      winston.log('info', {'message': 'Loading schema...'})
      request(options, function (error, resp, body) {
        if (error) {
          winston.log('info', {'message': 'Error! ' + error})
          reject(error)
        }
        if (body.data && body.data.schema) {
          winston.log('info', {'message': 'Sucessfully loaded schema'})
          var schema = JSON.parse(body.data.schema)
          CACHE['schema'] = schema
          resolve(schema)
        } else {
          reject()
        }
      })
    })
  }

  // oauth token retriever
  function token () {
    // access token in cache; just return it as a instant promise
    if (CACHE['accessToken']) {
      winston.log('info', {'message': 'Already authenticated'})
      return new Promise(function (resolve, reject) {
        resolve(CACHE['accessToken'])
      })
    }

    // request a new token
    winston.log('info', {'message': 'Requesting new token...'})
    return new Promise(function (resolve, reject) {
      var OAuth2 = OAuth.OAuth2
      var key = process.env['NYPL_OAUTH_KEY']
      var secret = process.env['NYPL_OAUTH_SECRET']
      var url = process.env['NYPL_OAUTH_URL']
      var auth = new OAuth2(key, secret, url, null, 'oauth/token', null)
      auth.getOAuthAccessToken('', { grant_type: 'client_credentials' }, function (error, accessToken, refreshToken, results) {
        if (error) {
          reject(error)
          winston.log('info', {'message': 'Not authenticated'})
        } else {
          winston.log('info', {'message': 'Successfully authenticated'})
          CACHE['accessToken'] = accessToken
          resolve(accessToken)
        }
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
