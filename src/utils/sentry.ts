// src/utils/sentry.ts

import * as Sentry from '@sentry/node';
import express from 'express';

export function setupSentry(app: express.Application) {
  if (!process.env.SENTRY_DSN) {
    console.warn('⚠️ Sentry DSN not set. Skipping Sentry setup.');
    return;
  }

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 1.0, // adjust for production
  });

  app.use(Sentry.Handlers.requestHandler());
  app.use(Sentry.Handlers.errorHandler());

  console.log('✅ Sentry initialized');
}
