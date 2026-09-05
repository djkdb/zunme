import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// DROPZONE is almost entirely client-rendered; no incremental cache needed.
export default defineCloudflareConfig({});
