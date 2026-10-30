import { EventEmitter } from "node:events";

// shortcut: this process owns the sockets; add a shared pub/sub when running multiple API instances.
export const chatEvents = new EventEmitter();
