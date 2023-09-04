import { App as uWebSockets, HttpResponse as UHttpResponse, TemplatedApp, getParts, RecognizedString } from 'uWebSockets.js';
import { HttpResponse } from './http-response';
import { HttpRequest } from './http-request';
import { parseQuery } from './utils';
import { Route } from './router';
import { WebSocketBehavior } from './ws';

export class App {
  private app: TemplatedApp;
  private catchFunction?: (error: any, req: HttpRequest, res: HttpResponse) => void | Promise<void>;
  private middlewares: {
    pattern?: string,
    middleware: (req: HttpRequest, res: HttpResponse) => void | Promise<void>
  }[] = [];

  /**
   * Creates an app
   */
  constructor() {
    this.app = uWebSockets();
  }

  /**
   * Handles `ANY` requests
   * 
   * @param pattern path to match
   * @param handler request handler function
   * @returns App instance
   * 
   * @example
   * ```ts
   * const app = new App();
   * 
   * app.any('/users', (req, res) => res.json({ success: true }));
   * ```
   */
  any(pattern: string, handler: (req: HttpRequest, res: HttpResponse) => void | Promise<void>) {
    this.register('any', pattern, handler);

    return this;
  }

  /**
   * Catches app errors
   * 
   * @param handler error handler function
   * @returns App instance
   * 
   * @example
   * ```ts
   * const app = new App();
   * 
   * app.catch((e, req, res) => res.status(e.status ?? 500).json({ message: e.message ?? 'Internal server error' }));
   * ```
   */
  catch(handler: (error: any, req: HttpRequest, res: HttpResponse) => void | Promise<void>) {
    this.catchFunction = handler;

    return this;
  }

  /**
   * Handles `DELETE` requests
   * 
   * @param pattern path to match
   * @param handler request handler function
   * @returns App instance
   * 
   * @example
   * ```ts
   * const app = new App();
   * 
   * app.del('/users', (req, res) => res.json({ success: true }));
   * ```
   */
  del(pattern: string, handler: (req: HttpRequest, res: HttpResponse) => void | Promise<void>) {
    this.register('del', pattern, handler);

    return this;
  }

  /**
   * Handles `GET` requests
   * 
   * @param pattern path to match
   * @param handler request handler function
   * @returns App instance
   * 
   * @example
   * ```ts
   * const app = new App();
   * 
   * app.get('/users', (req, res) => res.json({ success: true }));
   * ```
   */
  get(pattern: string, handler: (req: HttpRequest, res: HttpResponse) => void | Promise<void>) {
    this.register('get', pattern, handler);

    return this;
  }

  /**
   * Start listens requests
   * 
   * @param port port to listen
   * @param cb executes after success
   * 
   * @example
   * ```ts
   * const app = new App();
   * 
   * app.listen(1000);
   * ```
   */
  listen(host: string, port: number, cb?: () => void | Promise<void>) {
    this.app.any('/*', res => {
      res.cork(() => res.writeStatus('404 Not Found').end());
    });

    this.app.listen(host, port, cb ? cb : () => {});
  }

  /**
   * Handles `OPTIONS` requests
   * 
   * @param pattern path to match
   * @param handler request handler function
   * @returns App instance
   * 
   * @example
   * ```ts
   * const app = new App();
   * 
   * app.options('/users', (req, res) => res.json({ success: true }));
   * ```
   */
  options(pattern: string, handler: (req: HttpRequest, res: HttpResponse) => void | Promise<void>) {
    this.register('options', pattern, handler);

    return this;
  }

  /**
   * Handles `POST` requests
   * 
   * @param pattern path to match
   * @param handler request handler function
   * @returns App instance
   * 
   * @example
   * ```ts
   * const app = new App();
   * 
   * app.post('/users', (req, res) => res.json({ success: true }));
   * ```
   */
  post(pattern: string, handler: (req: HttpRequest, res: HttpResponse) => void | Promise<void>) {
    this.register('post', pattern, handler);

    return this;
  }

  /**
   * Handles `PUT` requests
   * 
   * @param pattern path to match
   * @param handler request handler function
   * @returns App instance
   * 
   * @example
   * ```ts
   * const app = new App();
   * 
   * app.put('/users', (req, res) => res.json({ success: true }));
   * ```
   */
  put(pattern: string, handler: (req: HttpRequest, res: HttpResponse) => void | Promise<void>) {
    this.register('put', pattern, handler);

    return this;
  }

  /**
   * Registers routes
   * 
   * @param routes
   * @returns App instance
   * 
   * @example
   * ```
   * const
   *  app = new App(),
   *  router = new Router();
   * 
   * router.get((req, res) => res.json({ success: true }));
   * 
   * app.routes(router.routes());
   * ```
   */
  routes(routes: Route[]) {
    for (const r of routes) {
      if (r.method === 'use') this.use(r.pattern as string, r.handler as any);
      else if (r.method === 'ws') this.ws(r.pattern as string, r.behavior as WebSocketBehavior);
      else this.register(r.method, r.pattern as string, r.handler as any);
    }

    return this;
  }

  /**
   * Registers a middleware
   * 
   * @param middleware executes on requests
   * @returns App instance
   * 
   * @example
   * ```ts
   * const app = new App();
   * 
   * app.use((req, res) => console.log('Hello World!'));
   * ```
   */
  use(middleware: (req: HttpRequest, res: HttpResponse) => void | Promise<void>): this;

  /**
   * Registers a middleware
   * 
   * @param pattern path to match
   * @param middleware executes on requests
   * @returns App instance
   * 
   * @example
   * ```ts
   * const app = new App();
   * 
   * app.use('/users', (req, res) => console.log('Hello World!'));
   * ```
   */
  use(pattern: string, middleware: (req: HttpRequest, res: HttpResponse) => void | Promise<void>): this;
  use(arg1: string | ((req: HttpRequest, res: HttpResponse) => void | Promise<void>), arg2?: (req: HttpRequest, res: HttpResponse) => void | Promise<void>) {
    this.middlewares.push(typeof arg1 === 'string' ? {
      middleware: arg2 as (req: HttpRequest, res: HttpResponse) => void | Promise<void>,
      pattern: arg1
    } : { middleware: arg1 });

    return this;
  }

  /**
   * Handles WebSockets requests
   * 
   * @param pattern path to match
   * @param behavior WebSockets behavior
   * @returns App instance
   * 
   * @example
   * ```ts
   * const app = new App();
   * 
   * app.ws('/ws', { message: () => { } });
   * ```
   */
  ws(pattern: string, behavior: WebSocketBehavior) {
    this.app.ws(pattern, {
      close: (ws, code, message) => {
        if (behavior.close) behavior.close({ send: (message: string) => ws.send(message) }, code, message);
      },
      message: (ws, message) => {
        if (behavior.message) behavior.message({ send: (message: string) => ws.send(message) }, message);
      },
      open: ws => {
        if (behavior.open) behavior.open({ send: (message: string) => ws.send(message) });
      }
    });

    return this;
  }

  private async getBody(res: UHttpResponse): Promise<Buffer> {
    let buffer: Buffer;

    return new Promise(resolve => res.onData((ab, isLast) => {
      const chunk = Buffer.from(ab);

      if (isLast) {
        if (buffer) resolve(Buffer.concat([buffer, chunk]));
        else resolve(chunk);
      } else {
        if (buffer) buffer = Buffer.concat([buffer, chunk]);
        else buffer = Buffer.concat([chunk]);
      }
    }));
  }

  private parseBody(body: Buffer, req: HttpRequest) {
    if (!body) return;

    const contentType = req.headers['content-type'];

    if (contentType === 'application/json' || contentType === 'application/x-www-form-urlencoded') {
      const bodyStr = body.toString();
      
      if (!bodyStr) return;

      req.body = contentType === 'application/json' ? JSON.parse(body.toString()) : parseQuery(body.toString());
    } else if (contentType?.startsWith('multipart/form-data')) getParts(body, contentType)?.forEach(p => {
      if (p.type && p.filename) req.files[p.name] = { data: p.data, filename: p.filename, type: p.type };
      else req.body[p.name] = Buffer.from(p.data).toString();
    });
    else req.body = body;
  }

  private register(
    method: 'any' | 'del' |  'get' | 'options' | 'post' | 'put',
    pattern: string,
    handler: (req: HttpRequest, res: HttpResponse) => void | Promise<void>
  ) {
    const middlewares = this.middlewares.filter(m => !m.pattern || pattern.startsWith(m.pattern));

    let aborted = false;

    this.app[method](pattern, async (ures, ureq) => {
      const
        req = new HttpRequest(ureq, pattern),
        res = new HttpResponse();
        
      ures.onAborted(() => aborted = true);

      this.parseBody(await this.getBody(ures), req);

      try {
        for (const m of middlewares) await m.middleware(req, res);

        await handler(req, res);
      } catch(e) {
        if (this.catchFunction) this.catchFunction(e, req, res);
      }

      if (!aborted) ures.cork(() => {
        ures.writeStatus(res.statusCode);

        for (const h in res.headers) ures.writeHeader(h, res.headers[h]);

        ures.end(res.body);
      });
    });
  }
}
