/* eslint-disable no-underscore-dangle */
import AWSXRay from 'aws-xray-sdk-core';
import Application from 'koa';
import createError from 'http-errors';
import { IncomingMessage, ServerResponse } from 'http';
import { Socket } from 'net';
import { IncomingRequestData } from 'aws-xray-sdk-core/dist/lib/middleware/mw_utils';
import createMiddleware from './index';

jest.mock('aws-xray-sdk-core');

describe('Koa middleware', () => {
  const defaultName = 'defaultName';
  const hostName = 'middlewareTest';
  const parentId = '2c7ad569f5d6ff149137be86';
  const traceId = '1-f9194208-2c7ad569f5d6ff149137be86';
  const app = new Application();

  describe('createMiddleware', () => {
    it('should throw an error if no default name is supplied', () => {
      expect(() => createMiddleware()).toThrowErrorMatchingSnapshot();
    });

    it('should return a middleware function', () => {
      expect(createMiddleware(defaultName)).toBeInstanceOf(Function);
    });
  });

  describe('open', () => {
    describe('when handling a request', () => {
      let req = new IncomingMessage();
      let res = new ServerResponse(new Socket());
      let ctx = app.createContext(req, res);
      let middleware = createMiddleware(defaultName);
      beforeEach(() => {
        req = new IncomingMessage();
        res = new ServerResponse(new Socket());
        req.body = '{"body": "foo"}';
        req.headers = { host: hostName };
        ctx = app.createContext(req, res);
        middleware = createMiddleware(defaultName);
      });

      afterEach(() => {
        delete process.env.AWS_XRAY_TRACING_NAME;
      });

      it('should call middleware.processHeaders to split the headers, if any', async () => {
        await middleware(ctx, async () => {});
        expect(AWSXRay.middleware.processHeaders).toBeCalledWith(
          expect.objectContaining({ headers: ctx.headers })
        );
      });

      it('should call middleware.resolveName to find the name of the segment', async () => {
        await middleware(ctx, async () => {});
        expect(AWSXRay.middleware.resolveName).toBeCalledWith(ctx.headers.host);
      });

      it('should create a new segment', async () => {
        await middleware(ctx, async () => {});
        expect(AWSXRay._mocks.init).toBeCalledWith(
          defaultName,
          traceId,
          parentId
        );
      });

      it('should add a new http property on the segment', async () => {
        await middleware(ctx, async () => {});
        expect(
          AWSXRay._mocks.addIncomingRequestData.mock.calls[0][0]
        ).toBeInstanceOf(IncomingRequestData);
      });
    });

    describe('when the request completes', () => {
      let req = new IncomingMessage();
      let res = new ServerResponse(new Socket());
      let ctx = app.createContext(req, res);
      let middleware = createMiddleware(defaultName);
      beforeEach(() => {
        req = new IncomingMessage();
        res = new ServerResponse(new Socket());
        req.body = '{"body": "foo"}';
        req.headers = { host: hostName };
        ctx = app.createContext(req, res);
        middleware = createMiddleware(defaultName);
        AWSXRay._returnValues.getCauseTypeFromHttpStatus = undefined;
      });
      it('should add the error flag on the segment on 4xx', async () => {
        AWSXRay._returnValues.getCauseTypeFromHttpStatus = 'error';
        const next = async () => {
          ctx.status = 400;
          throw createError(400);
        };
        await middleware(ctx, next);
        expect(ctx.segment.error).toEqual(true);
        expect(AWSXRay.utils.getCauseTypeFromHttpStatus).toBeCalledWith(400);
      });

      it('should add the fault flag on the segment on 5xx', async () => {
        AWSXRay._returnValues.getCauseTypeFromHttpStatus = 'fault';
        const next = async () => {
          ctx.status = 500;
          throw createError(500);
        };
        await middleware(ctx, next);
        expect(ctx.segment.fault).toEqual(true);
        expect(AWSXRay.utils.getCauseTypeFromHttpStatus).toBeCalledWith(500);
      });

      it('should add the throttle flag and error flag on the segment on a 429', async () => {
        AWSXRay._returnValues.getCauseTypeFromHttpStatus = 'error';
        const next = async () => {
          ctx.status = 429;
          throw createError(429);
        };
        await middleware(ctx, next);
        expect(ctx.segment.throttle).toEqual(true);
        expect(ctx.segment.error).toEqual(true);
      });

      it('should add nothing on anything else', async () => {
        const next = async () => {
          ctx.status = 200;
        };
        await middleware(ctx, next);
        expect(ctx.segment.throttle).toBeFalsy();
        expect(ctx.segment.fault).toBeFalsy();
        expect(ctx.segment.error).toBeFalsy();
      });
    });
  });
});
