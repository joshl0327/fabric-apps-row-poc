//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import { afterEach, describe, expect, it } from "vitest";
import { getLoadedLocale } from "@microsoft/fabric-visuals-core";
import { bootstrapLanguage } from "./language.service";

// This app is English-only (prompt 18, ruling 1): bootstrapLanguage loads the
// bundled en strings synchronously, with no Fabric settings round-trip and no
// per-locale dynamic import. The template's multi-locale behaviour (and its
// original, larger spec) was intentionally removed.
describe("bootstrapLanguage (English-only)", () => {
    afterEach(() => {
        document.documentElement.lang = "";
    });

    it("loads the English strings and sets the document language to en", async () => {
        await bootstrapLanguage();
        expect(getLoadedLocale()).toBe("en");
        expect(document.documentElement.lang).toBe("en");
    });

    it("resolves without throwing when called repeatedly", async () => {
        await expect(bootstrapLanguage()).resolves.toBeUndefined();
        await expect(bootstrapLanguage()).resolves.toBeUndefined();
    });
});
