const { createLogger, format, transports } = require('winston');
const { combine, timestamp } = format;

// Set default NYPL agreed upon log levels
const nyplLogLevels = {
  levels: {
    emergency: 0,
    alert: 1,
    critical: 2,
    error: 3,
    warning: 4,
    notice: 5,
    info: 6,
    debug: 7,
  },
};

//Capitlizes the log level key
const upCaseLogLevels = format((info, opts) => {
  info.level = info.level.toUpperCase()
  return info
});


// Initiate the winston logger.
// To debug the lambda locally, set the debug level with:
// transports: [new transports.Console({level: 'error'})]
const logger = createLogger({
  level: process.env['LOGGING'],
  levels: nyplLogLevels.levels,
  format: combine(
    timestamp(),
    label({ label: 'mln-item-poster-lambda: ' }),
    format.json()
  ),
  defaultMeta: { service: 'mln-item-poster-lambda' },
  exitOnError: false,
  transports: [new transports.Console({level: process.env['LOGGING']})]
});

// If we're in local then log to the `console` with the format:
// `${info.level}: ${info.message} JSON.stringify({ ...rest }) `
if (process.env.NODE_ENV == 'local') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

module.exports = logger;
