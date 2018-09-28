
const aws = require('aws-sdk');

const kms = new aws.KMS({
  region: 'us-east-1',
});

const decryptKMS = (key) => {
  const params = {
    CiphertextBlob: Buffer.from(key, 'base64'),
  };

  return new Promise((resolve, reject) => {
    kms.decrypt(params, (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(data.Plaintext.toString());
      }
    });
  });
};

module.exports = {
  decryptKMS,
};