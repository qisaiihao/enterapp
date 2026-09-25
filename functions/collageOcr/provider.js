// Used by both the cloud function and the explicit, single-call live smoke test.
function createTencentRecognizer(credential) {
  const { Client } = require('tencentcloud-sdk-nodejs-ocr').ocr.v20181119;
  const client = new Client({
    credential,
    region: 'ap-guangzhou',
    profile: {
      signMethod: 'TC3-HMAC-SHA256',
      httpProfile: { endpoint: 'ocr.tencentcloudapi.com', reqTimeout: 45 }
    }
  });
  return ImageBase64 => client.GeneralAccurateOCR({ ImageBase64, IsWords: true, ConfigID: 'OCR', EnableDetectSplit: true });
}

module.exports = { createTencentRecognizer };
