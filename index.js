console.log('Loading Discovery Bib Poster')

const avro = require('avsc')
const OAuth = require('oauth')
const Promise = require('promise')
const request = require('request')

// Initialize cache
var CACHE = {}

// kinesis stream handler
exports.kinesisHandler = function (records, context, callback) {
  console.log('Processing ' + records.length + ' records')

  // retrieve token and schema
  Promise.all([token(), schema()])
    .then(function (res) {
      var accessToken = res[0]
      var schema = res[1]
      onReady(records, accessToken, schema)
    })

  // run when access token and schema are loaded
  function onReady (payload, accessToken, schema) {
    console.log('Ready', accessToken, schema)
    // load avro schema
    var avroType = avro.parse(schema)
    // parse payload
    var records = payload
      .map(function (record) {
        return addSource(parseKinesis(record, avroType))
      })
    // post to API
    console.log('Posting records')
    console.log(records)
    postRecords(accessToken, records)
  }

  // map to records objects as needed
  function parseKinesis (payload, avroType) {
    console.log('Parsing Kinesis')
    // decode base64
    var buf = new Buffer(payload.kinesis.data, 'base64')
    // decode avro
    var record = avroType.fromBuffer(buf)
    return record
  }

  function addSource (record) {
    console.log('Adding source')
    record['nyplSource'] = 'sierra-nypl'
    record['nyplType'] = process.env['NYPL_POST_TYPE']
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
      console.log('Posting...')
      if (error || body.errors && body.errors.length) {
        if (error) {
          console.log('Error! ' + error)
          callback(new Error(error))
        } else {
          console.log('Error! ' + body.errors[0])
          callback(new Error(body.errors[0]))
        }
        context.fail()
      } else {
        callback(null, 'POST Success')
        context.succeed()
      }
    })
  }

  function schema() {
    // schema in cache; just return it as a instant promise
    if (CACHE['schema']) {
      console.log('Already have schema')
      return new Promise(function (resolve, reject) {
        resolve(CACHE['schema'])
      })
    }

    return new Promise(function (resolve, reject) {
      var options = {
        uri: process.env['NYPL_API_SCHEMA_URL'],
        json: true
      }
      console.log('Loading schema...')
      request(options, function (error, resp, body) {
        if (error) {
          console.log('Error! ' + error)
          reject(error)
        }
        if (body.data && body.data.schema) {
          console.log('Sucessfully loaded schema')
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
      console.log('Already authenticated')
      return new Promise(function (resolve, reject) {
        resolve(CACHE['accessToken'])
      })
    }

    // request a new token
    console.log('Requesting new token...')
    return new Promise(function (resolve, reject) {
      var OAuth2 = OAuth.OAuth2
      var key = process.env['NYPL_OAUTH_KEY']
      var secret = process.env['NYPL_OAUTH_SECRET']
      var url = process.env['NYPL_OAUTH_URL']
      var auth = new OAuth2(key, secret, url, null, 'oauth/token', null)
      auth.getOAuthAccessToken('', { grant_type: 'client_credentials' }, function (error, accessToken, refreshToken, results) {
        if (error) {
          reject(error)
          console.log('Not authenticated')
        } else {
          console.log('Successfully authenticated')
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
