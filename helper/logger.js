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

const logger = createLogger({
  levels: nyplLogLevels.levels, 
  format: combine(
    timestamp(),
    format.json()
  ),
  exitOnError: false,
  transports: [new transports.Console()]
})

module.exports = logger;
