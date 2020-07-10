import {
  getLogger,
  getNamespace,
  isAutomaticMode,
  middleware,
  Segment,
  setSegment,
  utils,
} from 'aws-xray-sdk-core';
import { ServerResponse } from 'http';
import { Context, Next } from 'koa';

const { IncomingRequestData } = middleware;

/**
 * Use 'app.use(AWSXRayKoa.openSegment('defaultName'))' before defining your routes.
 * Use AWSXRay.getSegment() to access the current sub/segment.
 * Otherwise, for manual mode, this appends the Segment object to the request object as req.segment.
 * @param {string} defaultName - The default name for the segment.
 * @alias module:koa_mw.openSegment
 * @returns {function}
 */
export default function createMiddleware(defaultName: string) {
  if (!defaultName || typeof defaultName !== 'string')
    throw new Error(
      'Default segment name was not supplied.  Please provide a string.'
    );

  middleware.setDefaultName(defaultName);

  return async function xrayMiddleware(ctx: Context, next: Next) {
    try {
      const amznTraceHeader = middleware.processHeaders(ctx);
      const name = middleware.resolveName(ctx.host);
      ctx.segment = new Segment(
        name,
        amznTraceHeader.Root,
        amznTraceHeader.Parent
      );

      middleware.resolveSampling(
        amznTraceHeader,
        ctx.segment,
        (ctx as unknown) as ServerResponse
      );
      ctx.segment.addIncomingRequestData(new IncomingRequestData(ctx.req));

      getLogger().debug(
        `Starting koa segment: { url: ${ctx.url}, name: ${
          ctx.segment.name
        }, trace_id: ${ctx.segment.trace_id}, id: ${
          ctx.segment.id
        }, sampled: ${!ctx.segment.notTraced} }`
      );

      if (isAutomaticMode()) {
        const ns = getNamespace();
        ns.bindEmitter(ctx.req);
        ns.bindEmitter(ctx.res);

        ns.runAndReturn(async function namespace() {
          setSegment(ctx.segment);
          await next();
          if (ctx.segment) {
            ctx.segment.close();

            getLogger().debug(
              `Closed koa segment successfully: { url: ${ctx.url}, name: ${
                ctx.segment.name
              }, trace_id: ${ctx.segment.trace_id}, id: ${
                ctx.segment.id
              }, sampled: ${!ctx.segment.notTraced} }`
            );
            if (ctx.status === 429) ctx.segment.addThrottleFlag();
            if (utils.getCauseTypeFromHttpStatus(ctx.status))
              ctx.segment[
                utils.getCauseTypeFromHttpStatus(ctx.status) as string
              ] = true;

            ctx.segment.http.close(ctx);
            ctx.segment.close();
          }
        });
      } else {
        await next();
        if (ctx.status === 429) ctx.segment.addThrottleFlag();
        if (utils.getCauseTypeFromHttpStatus(ctx.status))
          ctx.segment[
            utils.getCauseTypeFromHttpStatus(ctx.status) as string
          ] = true;

        ctx.segment.http.close(ctx);
        ctx.segment.close();
      }
    } catch (err) {
      if (ctx.segment && err) {
        if (ctx.status === 429) ctx.segment.addThrottleFlag();
        if (utils.getCauseTypeFromHttpStatus(ctx.status))
          ctx.segment[
            utils.getCauseTypeFromHttpStatus(ctx.status) as string
          ] = true;
        ctx.segment.http.close(ctx);
        ctx.segment.close(err);

        getLogger().debug(
          `Closed koa segment with error: { url: ${ctx.url}, name: ${
            ctx.segment.name
          }, trace_id: ${ctx.segment.trace_id}, id: ${
            ctx.segment.id
          }, sampled: ${!ctx.segment.notTraced} }`
        );
      }
    }
  };
}
