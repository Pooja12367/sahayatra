declare module 'cookie-parser' {
  import { RequestHandler } from 'express';

  function cookieParser(secret?: string | string[]): RequestHandler;

  export default cookieParser;
}
