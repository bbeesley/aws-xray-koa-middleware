const AWSXRay = require('aws-xray-sdk-core/lib/aws-xray');

const { Segment } = AWSXRay;

const _mocks = {
  addIncomingRequestData: jest.fn(),
  init: jest.fn(),
}

AWSXRay.Segment = class extends Segment {
  addIncomingRequestData(...args) {
    _mocks.addIncomingRequestData.call(this, ...args);
    return super.addIncomingRequestData(...args);
  }
  init(...args) {
    _mocks.init.call(this, ...args);
    return super.init(...args);
  }
}
AWSXRay.Segment.prototype.init = jest.fn(
  AWSXRay.Segment.prototype.init
);
const parentId = '2c7ad569f5d6ff149137be86';
const traceId = '1-f9194208-2c7ad569f5d6ff149137be86';
const defaultName = 'defaultName';
AWSXRay.middleware.processHeaders = jest.fn(() => ({ Root: traceId, Parent: parentId, Sampled: '0' }));
AWSXRay.middleware.resolveName = jest.fn(() => defaultName);
AWSXRay.isAutomaticMode = jest.fn(() => false);
AWSXRay.SegmentEmitter = jest.fn();
AWSXRay.utils.getCauseTypeFromHttpStatus = jest.fn(() => _returnValues.getCauseTypeFromHttpStatus);
const _returnValues = {
  getCauseTypeFromHttpStatus: undefined
}

AWSXRay._returnValues = _returnValues;
AWSXRay._mocks = _mocks;

module.exports = AWSXRay;