import { RequestHandler } from 'express';

// Simple type for Express route handlers to avoid any warnings
// Using a more permissive type to handle various request parameter combinations
export type RouteHandler = RequestHandler<any, any, any, any>;
