//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
    test: {
        environment: "jsdom",
        setupFiles: ["src/test/setup.ts"],
        globals: true,
        // Tests always run in the synthetic local backend, regardless of any
        // .env.local a `rayfin env` / `rayfin up` wrote: force VITE_RAYFIN_API_URL
        // empty so isLocalBackend() is deterministically true. Without this, a
        // populated .env.local flips the services to the Fabric branch and the
        // local-mode tests fail.
        env: { VITE_RAYFIN_API_URL: "" },
    },
    resolve: {
        alias: { "@": resolve(import.meta.dirname, "src") },
    },
});
