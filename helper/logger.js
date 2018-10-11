const winston = require('winston');

// Suppress error handling
winston.emitErrs = true;

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

const getLogLevelCode = (levelString) => {
  switch (levelString) {
    case 'emergency':
      return 0;
    case 'alert':
      return 1;
    case 'critical':
      return 2;
    case 'error':
      return 3;
    case 'warning':
      return 4;
    case 'notice':
      return 5;
    case 'info':
      return 6;
    case 'debug':
      return 7;
    default:
      return 'n/a';
  }
};

const loggerTransports = [];

if (process.env.NODE_ENV !== 'test') {
  loggerTransports.push(
    new winston.transports.Console({
      timestamp: () => new Date().toISOString(),
      formatter: (options) => {
        const result = {
          timestamp: options.timestamp(),
          levelCode: getLogLevelCode(options.level),
          level: options.level.toUpperCase(),
          message: options.message.toString(),
        };

        if (process.pid) {
          result.pid = process.pid.toString();
        }

        if (options.meta) {
          result.meta = JSON.stringify(options.meta);
        }

        return JSON.stringify(result);
      },
    }) // eslint-disable-line comma-dangle
  );
}

const logger = new (winston.Logger)({
  levels: nyplLogLevels.levels,
  transports: loggerTransports,
  exitOnError: false,
});

// set the logger output level to one specified in the environment config
logger.level = process.env.LOG_LEVEL;

module.exports = logger;
