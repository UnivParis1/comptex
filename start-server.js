#!/usr/bin/env node

if (!process.env.NODE_ENV) {
   process.env.NODE_ENV = 'production';
}
import './server/start-server.ts';
